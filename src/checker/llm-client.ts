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

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type {
  ConstraintDefinition,
  ConstraintVerdict,
} from '../types/constraint.types.js';
import {
  appendCallLog,
  DEFAULT_CALL_LOG_PATH,
  getModelPricingFromEnv,
  getSpendingCapUsdFromEnv,
  getTotalSpentUsd,
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
 * Native REST call to Deploy API (OpenAI-compatible chat completions).
 * Supports DeepSeek and other models proxied via api-cdn.deploy.com.
 */
export async function callDeployApi(
  prompt: string,
  model: string = process.env.MODEL_NAME ||
    'deepseek-ai/deepseek-v4.1-flash-1017',
  apiKey?: string
): Promise<ProviderCallResult> {
  const key = apiKey || process.env.DEPLOY_API_KEY;
  if (!key) {
    throw new Error(
      'DEPLOY_API_KEY is not configured in environment variables or parameters.'
    );
  }

  const endpoint =
    process.env.DEPLOY_API_URL ||
    'https://api-cdn.deploy.com/api/v1/chat/completions';
  const maxRetries = 2;
  let attempt = 0;
  let response!: Response;
  let latencyMs = 0;

  while (attempt <= maxRetries) {
    const startTime = Date.now();
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    latencyMs = Date.now() - startTime;
    if (
      (response.status === 503 || response.status === 429) &&
      attempt < maxRetries
    ) {
      attempt++;
      const baseDelay = 3500 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 800);
      const waitTimeMs = baseDelay + jitter;
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          `[LLM Client] Máy chủ tạm bận (${response.status}), tự động chờ ${(waitTimeMs / 1000).toFixed(1)}s rồi thử lại (lượt ${attempt}/${maxRetries})...`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      continue;
    }
    break;
  }

  const requestId =
    response.headers.get('x-request-id') ||
    response.headers.get('request-id') ||
    `deploy-${randomUUID()}`;

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Deploy API error (status ${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    id?: string;
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const message = data.choices?.[0]?.message;
  const rawOutput =
    message?.content || message?.reasoning_content || '{"verdicts": []}';
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const finalRequestId = data.id || requestId;

  return {
    requestId: finalRequestId,
    rawOutput,
    promptTokens,
    completionTokens,
    latencyMs,
  };
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

  const normalizedModel = model.startsWith('models/') ? model.slice(7) : model;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent?key=${key}`;
  const maxRetries = 2;
  let attempt = 0;
  let response!: Response;
  let latencyMs = 0;

  while (attempt <= maxRetries) {
    const startTime = Date.now();
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
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

    latencyMs = Date.now() - startTime;
    if (
      (response.status === 503 || response.status === 429) &&
      attempt < maxRetries
    ) {
      attempt++;
      // Exponential backoff with jitter: 3.5s -> 7.0s + jitter
      const baseDelay = 3500 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 800);
      const waitTimeMs = baseDelay + jitter;
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          `[LLM Client] Máy chủ tạm bận (${response.status}), tự động chờ ${(waitTimeMs / 1000).toFixed(1)}s rồi thử lại (lượt ${attempt}/${maxRetries})...`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      continue;
    }
    break;
  }
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
  const isDeployProvider =
    process.env.MODEL_PROVIDER === 'deploy' ||
    Boolean(process.env.DEPLOY_API_KEY);

  const defaultModel = isDeployProvider
    ? 'deepseek-ai/deepseek-v4.1-flash-1017'
    : 'gemini-1.5-flash';

  const {
    statement,
    constraints,
    sourceCode,
    model = process.env.MODEL_NAME || defaultModel,
    apiKey,
    callProvider,
    logFilePath = DEFAULT_CALL_LOG_PATH,
    timeoutMs = 30000,
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

  // 1b. Enforce MODEL_SPENDING_CAP_USD safety cap
  const spendingCapUsd = getSpendingCapUsdFromEnv();
  if (spendingCapUsd !== null) {
    const spentUsd = await getTotalSpentUsd(logFilePath);
    if (spentUsd >= spendingCapUsd) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(
          `[LLM Client] Spending cap reached ($${spentUsd.toFixed(4)} >= $${spendingCapUsd.toFixed(2)}); returning unsure.`
        );
      }
      return semanticConstraints.map((c) => ({
        constraintId: c.id,
        verdict: 'unsure',
        evidence: [],
        suggestedDeduction: 0,
        unsureReason: 'model_unsure',
        decidedBy: 'llm',
      }));
    }
  }

  // 2. Build sanitized prompt (comments and student info stripped)
  const sanitizedPrompt = buildSanitizedPrompt({
    statement,
    constraints: semanticConstraints,
    sourceCode,
  });

  const providerFn =
    callProvider ||
    ((p, m) => {
      const provider =
        process.env.MODEL_PROVIDER ||
        (process.env.DEPLOY_API_KEY ? 'deploy' : 'gemini');
      if (provider === 'deploy') {
        return callDeployApi(p, m, apiKey);
      }
      return callGeminiApi(p, m, apiKey);
    });

  let providerResult: ProviderCallResult;
  try {
    providerResult = await withTimeout(
      providerFn(sanitizedPrompt, model),
      timeoutMs
    );
  } catch (error) {
    const isTimeout =
      error instanceof Error && error.message.includes('timed out');
    const msg = error instanceof Error ? error.message : String(error);
    if (!isTimeout && process.env.NODE_ENV !== 'test') {
      console.warn(`[LLM Client Warning] ${msg}`);
    }
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

  const pricing = getModelPricingFromEnv();
  const costUsd =
    (promptTokens / 1_000_000) * pricing.costPerMillionPromptTokens +
    (completionTokens / 1_000_000) * pricing.costPerMillionCompletionTokens;

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

  // 4. Validate output against schema and verify evidence lines (never throw out to worker)
  try {
    return validateModelOutput(
      providerResult.rawOutput,
      semanticConstraints,
      sourceCode
    );
  } catch {
    return semanticConstraints.map((c) => ({
      constraintId: c.id,
      verdict: 'unsure',
      evidence: [],
      suggestedDeduction: 0,
      unsureReason: 'schema_invalid',
      decidedBy: 'llm',
    }));
  }
}
