/**
 * LLM Provider Call Logger and Cost Calculator
 * CSC13114 - LeeTKOB PA#3 (Criterion 4 — 20 points)
 *
 * Implements persistent call logging (call_log.jsonl) with provider request IDs,
 * token consumption, latency, and cost calculations for a lab of 80 submissions.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ModelPricing {
  modelName: string;
  costPerMillionPromptTokens: number;
  costPerMillionCompletionTokens: number;
}

/**
 * Standard baseline pricing for Google Gemini 1.5 Flash.
 * Prompt tokens: $0.075 per 1,000,000 tokens
 * Completion tokens: $0.300 per 1,000,000 tokens
 */
export const GEMINI_15_FLASH_PRICING: ModelPricing = {
  modelName: 'gemini-1.5-flash',
  costPerMillionPromptTokens: 0.075,
  costPerMillionCompletionTokens: 0.3,
};

/**
 * Standard baseline pricing for DeepSeek V4.1 Flash.
 * Prompt tokens: $0.14 per 1,000,000 tokens
 * Completion tokens: $0.28 per 1,000,000 tokens
 */
export const DEEPSEEK_V4_FLASH_PRICING: ModelPricing = {
  modelName: 'deepseek-ai/deepseek-v4.1-flash-1017',
  costPerMillionPromptTokens: 0.14,
  costPerMillionCompletionTokens: 0.28,
};

/**
 * Resolves model pricing dynamically from environment variables,
 * falling back to GEMINI_15_FLASH_PRICING defaults if not specified.
 */
export function getModelPricingFromEnv(): ModelPricing {
  const modelName = process.env.MODEL_NAME || GEMINI_15_FLASH_PRICING.modelName;
  const promptCost = process.env.MODEL_PROMPT_PRICE_PER_M
    ? Number(process.env.MODEL_PROMPT_PRICE_PER_M)
    : GEMINI_15_FLASH_PRICING.costPerMillionPromptTokens;
  const completionCost = process.env.MODEL_COMPLETION_PRICE_PER_M
    ? Number(process.env.MODEL_COMPLETION_PRICE_PER_M)
    : GEMINI_15_FLASH_PRICING.costPerMillionCompletionTokens;

  return {
    modelName,
    costPerMillionPromptTokens: Number.isNaN(promptCost)
      ? GEMINI_15_FLASH_PRICING.costPerMillionPromptTokens
      : promptCost,
    costPerMillionCompletionTokens: Number.isNaN(completionCost)
      ? GEMINI_15_FLASH_PRICING.costPerMillionCompletionTokens
      : completionCost,
  };
}

export interface LabCostParams {
  submissionsCount: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  pricing?: ModelPricing;
}

export interface LabCostResult {
  totalSubmissions: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  costPerSubmissionUsd: number;
  totalCostUsd: number;
  arithmetic: string;
}

/**
 * Computes arithmetic and cost breakdown for evaluating an entire lab of submissions.
 * Meets Criterion 4 requirement: "README and AI-LOG.md name the model and what one
 * lab of 80 submissions costs, with the arithmetic."
 */
export function calculateLabCost(params: LabCostParams): LabCostResult {
  const {
    submissionsCount,
    avgPromptTokens,
    avgCompletionTokens,
    pricing = getModelPricingFromEnv(),
  } = params;

  const totalPromptTokens = submissionsCount * avgPromptTokens;
  const totalCompletionTokens = submissionsCount * avgCompletionTokens;

  const promptCost =
    (totalPromptTokens / 1_000_000) * pricing.costPerMillionPromptTokens;
  const completionCost =
    (totalCompletionTokens / 1_000_000) *
    pricing.costPerMillionCompletionTokens;

  const totalCostUsd = promptCost + completionCost;
  const costPerSubmissionUsd = totalCostUsd / submissionsCount;

  const arithmetic = [
    `=== Lab Cost Estimation: ${submissionsCount} submissions using ${pricing.modelName} ===`,
    `1. Input Tokens:  ${submissionsCount} submissions * ${avgPromptTokens} avg tokens = ${totalPromptTokens.toLocaleString()} tokens`,
    `   Input Cost:    (${totalPromptTokens.toLocaleString()} / 1,000,000) * $${pricing.costPerMillionPromptTokens} = $${promptCost.toFixed(6)} USD`,
    `2. Output Tokens: ${submissionsCount} submissions * ${avgCompletionTokens} avg tokens = ${totalCompletionTokens.toLocaleString()} tokens`,
    `   Output Cost:   (${totalCompletionTokens.toLocaleString()} / 1,000,000) * $${pricing.costPerMillionCompletionTokens} = $${completionCost.toFixed(6)} USD`,
    `------------------------------------------------------------------------`,
    `Total Lab Cost: $${totalCostUsd.toFixed(4)} USD (~${(totalCostUsd * 25400).toFixed(0)} VND)`,
    `Cost / Solution: $${costPerSubmissionUsd.toFixed(6)} USD (~${(costPerSubmissionUsd * 25400).toFixed(2)} VND)`,
  ].join('\n');

  return {
    totalSubmissions: submissionsCount,
    totalPromptTokens,
    totalCompletionTokens,
    costPerSubmissionUsd,
    totalCostUsd,
    arithmetic,
  };
}

export interface CallLogEntry {
  timestamp?: string;
  requestId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  sanitizedPrompt: string;
  rawResponse: string;
}

export const DEFAULT_CALL_LOG_PATH = path.join(process.cwd(), 'call_log.jsonl');

/**
 * Appends a call log entry to the JSONL log file.
 * Preserves the provider's requestId to prove real model execution.
 */
export async function appendCallLog(
  entry: CallLogEntry,
  logFilePath: string = DEFAULT_CALL_LOG_PATH
): Promise<void> {
  const record: CallLogEntry = {
    timestamp: entry.timestamp || new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(record) + '\n';
  await fs.mkdir(path.dirname(logFilePath), { recursive: true });
  await fs.appendFile(logFilePath, line, 'utf-8');
}

/**
 * Reads all entries from the call_log.jsonl file.
 */
export async function readCallLog(
  logFilePath: string = DEFAULT_CALL_LOG_PATH
): Promise<CallLogEntry[]> {
  try {
    const content = await fs.readFile(logFilePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    return lines.map((l) => JSON.parse(l) as CallLogEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
