/**
 * LLM Client for Semantic Constraints
 * CSC13114 - LeeTKOB PA#3 (Criterion 4 — 20 points)
 *
 * Evaluates semantic constraints by invoking Google Gemini API (or a custom provider).
 * Connects with Prompt Sanitizer (strip comments & student info), Guardrails (schema & timeout),
 * and Call Logger (records requestId, tokens, and cost).
 *
 * Supports MODEL_OFF=1 environment variable (Criterion 6): immediately returns 'unsure'
 * without opening any network connection.
 */

import { randomUUID } from 'node:crypto';
import type {
  ConstraintDefinition,
  ConstraintVerdict,
} from '../types/constraint.types.js';
import {
  appendCallLog,
  DEFAULT_CALL_LOG_PATH,
  GEMINI_15_FLASH_PRICING,
} from './call-logger.js';
import { validateModelOutput, withTimeout } from './guardrails.js';
import { buildSanitizedPrompt } from './prompt-sanitizer.js';

export interface ProviderCallResult {
  requestId: string;
  rawOutput: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export type ProviderCallFn = (
  prompt: string,
  model: string
) => Promise<ProviderCallResult>;

export interface EvaluateSemanticParams {
  statement: string;
  constraints: ConstraintDefinition[];
  sourceCode: string;
  model?: string;
  apiKey?: string;
  callProvider?: ProviderCallFn;
  logFilePath?: string;
  timeoutMs?: number;
}

/**
 * Native REST call to Google Gemini Generative Language API.
 * Uses built-in Node 20 fetch without heavy third-party SDK dependencies.
 */
export async function callGeminiApi(
  prompt: string,
  model: string = 'gemini-1.5-flash',
  apiKey?: string
): Promise<ProviderCallResult> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.MODEL_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not configured in environment variables or parameters.'
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const startTime = Date.now();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  const latencyMs = Date.now() - startTime;
  const requestId =
    response.headers.get('x-goog-request-id') ||
    response.headers.get('request-id') ||
    `gemini-${randomUUID()}`;

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Gemini API error (status ${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };

  const rawOutput =
    data.candidates?.[0]?.content?.parts?.[0]?.text || '{"verdicts": []}';
  const promptTokens = data.usageMetadata?.promptTokenCount || 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

  return {
    requestId,
    rawOutput,
    promptTokens,
    completionTokens,
    latencyMs,
  };
}

/**
 * Evaluates semantic constraints for a student submission using the real LLM.
 *
 * Enforces:
 * 1. MODEL_OFF switch: If MODEL_OFF=1 is set, immediately returns 'unsure' with zero network calls.
 * 2. Prompt sanitization: Strips comments and student identity before sending to the model.
 * 3. Guardrails: Validates JSON schema, checks evidence against submitted code, enforces timeout.
 * 4. Call logging: Appends a detailed entry to call_log.jsonl with provider requestId and token metrics.
 */
export async function evaluateSemanticWithLlm(
  params: EvaluateSemanticParams
): Promise<ConstraintVerdict[]> {
  const {
    statement,
    constraints,
    sourceCode,
    model = 'gemini-1.5-flash',
    apiKey,
    callProvider,
    logFilePath = DEFAULT_CALL_LOG_PATH,
    timeoutMs = 15000,
  } = params;

  // Filter semantic constraints (hard rules handle ban-list constraints)
  const semanticConstraints = constraints.filter(
    (c) =>
      c.type === 'semantic' || !c.description.toLowerCase().startsWith('do not')
  );

  if (semanticConstraints.length === 0) {
    return [];
  }

  // 1. Check MODEL_OFF switch (Criterion 6 requirement)
  if (process.env.MODEL_OFF === '1') {
    return semanticConstraints.map((c) => ({
      constraintId: c.id,
      verdict: 'unsure',
      evidence: [],
      suggestedDeduction: 0,
      unsureReason: 'model_unsure',
      decidedBy: 'llm',
    }));
  }

  // 2. Build sanitized prompt (comments and student info stripped)
  const sanitizedPrompt = buildSanitizedPrompt({
    statement,
    constraints: semanticConstraints,
    sourceCode,
  });

  const providerFn = callProvider || ((p, m) => callGeminiApi(p, m, apiKey));

  let providerResult: ProviderCallResult;
  try {
    providerResult = await withTimeout(
      providerFn(sanitizedPrompt, model),
      timeoutMs
    );
  } catch (error) {
    const isTimeout =
      error instanceof Error && error.message.includes('timed out');
    return semanticConstraints.map((c) => ({
      constraintId: c.id,
      verdict: 'unsure',
      evidence: [],
      suggestedDeduction: 0,
      unsureReason: isTimeout ? 'timeout' : 'model_unsure',
      decidedBy: 'llm',
    }));
  }

  // 3. Compute cost and record call log
  const promptTokens = providerResult.promptTokens;
  const completionTokens = providerResult.completionTokens;
  const totalTokens = promptTokens + completionTokens;

  const costUsd =
    (promptTokens / 1_000_000) *
      GEMINI_15_FLASH_PRICING.costPerMillionPromptTokens +
    (completionTokens / 1_000_000) *
      GEMINI_15_FLASH_PRICING.costPerMillionCompletionTokens;

  await appendCallLog(
    {
      requestId: providerResult.requestId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs: providerResult.latencyMs,
      costUsd,
      sanitizedPrompt,
      rawResponse: providerResult.rawOutput,
    },
    logFilePath
  );

  // 4. Validate output against schema and verify evidence lines
  return validateModelOutput(
    providerResult.rawOutput,
    semanticConstraints,
    sourceCode
  );
}
