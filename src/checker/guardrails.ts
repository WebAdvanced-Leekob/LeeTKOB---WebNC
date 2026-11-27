/**
 * Guardrails and Fallbacks
 * CSC13114 - LeeTKOB PA#3 (Criterion 5 — 10 points)
 *
 * Implements safety limits for LLM interactions:
 * - Schema Guard: validates JSON output and handles malformed responses (schema_mismatch / schema_invalid)
 * - Evidence Guard: strictly validates that evidence lines match submitted student code verbatim (evidence_mismatch)
 * - Timeout Guard: bounds execution time and safely falls back to unsure (timeout)
 * - Deduction Protection: guarantees model cannot alter the TA's configured deduction
 */

import type {
  ConstraintDefinition,
  ConstraintVerdict,
  EvidenceLine,
  UnsureReason,
  Verdict,
} from '../types/constraint.types.js';

export interface ApplyGuardrailsParams {
  modelCall: () => Promise<string>;
  constraints: ConstraintDefinition[];
  sourceCode: string;
  timeoutMs?: number;
}

/**
 * Wraps an asynchronous operation with an execution time limit.
 * If the promise does not resolve within timeoutMs, rejects with an Error.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timerId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`LLM call timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.then((res) => {
      clearTimeout(timerId);
      return res;
    }),
    timeoutPromise,
  ]);
}

/**
 * Extracts clean JSON string from model response, safely stripping markdown
 * code fences (e.g. ```json ... ```) if present.
 */
export function extractJsonFromOutput(rawOutput: string): string {
  const trimmed = rawOutput.trim();

  // If wrapped in markdown code fence: ```json ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }

  // Find first { and last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

/**
 * Verifies that all evidence lines match the actual submitted source code.
 * Every evidence line must:
 * 1. Have a valid 1-based line number within the bounds of the source code.
 * 2. Match the verbatim content of that line (ignoring trailing whitespace).
 */
export function verifyEvidenceLines(
  evidence: unknown[],
  sourceLines: string[]
): boolean {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return false;
  }

  for (const item of evidence) {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const { line, text } = item as Record<string, unknown>;
    if (
      typeof line !== 'number' ||
      !Number.isInteger(line) ||
      line < 1 ||
      line > sourceLines.length
    ) {
      return false;
    }

    if (typeof text !== 'string') {
      return false;
    }

    const actualLine = sourceLines[line - 1];
    if (actualLine.trim() !== text.trim()) {
      return false;
    }
  }

  return true;
}

/**
 * Validates the raw model output string against the expected schema and constraints.
 * Implements schema guard and evidence line verification with safe fallback to 'unsure'.
 */
export function validateModelOutput(
  rawOutput: string,
  constraints: ConstraintDefinition[],
  sourceCode: string
): ConstraintVerdict[] {
  const sourceLines = sourceCode.split(/\r?\n/);
  const cleanJson = extractJsonFromOutput(rawOutput);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    // Schema mismatch: model output could not be parsed as valid JSON
    return constraints.map((c) => createUnsureVerdict(c.id, 'schema_mismatch'));
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).verdicts)
  ) {
    return constraints.map((c) => createUnsureVerdict(c.id, 'schema_invalid'));
  }

  const modelVerdicts = (parsed as { verdicts: unknown[] }).verdicts;
  const verdictMap = new Map<string, Record<string, unknown>>();

  for (const item of modelVerdicts) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).constraintId === 'string'
    ) {
      verdictMap.set(
        (item as Record<string, unknown>).constraintId as string,
        item as Record<string, unknown>
      );
    }
  }

  return constraints.map((constraint) => {
    const rawVerdictObj = verdictMap.get(constraint.id);

    if (!rawVerdictObj || typeof rawVerdictObj.verdict !== 'string') {
      return createUnsureVerdict(constraint.id, 'schema_invalid');
    }

    const rawVerdict = rawVerdictObj.verdict.toLowerCase().trim();
    if (!['pass', 'violation', 'unsure'].includes(rawVerdict)) {
      return createUnsureVerdict(constraint.id, 'schema_invalid');
    }

    const verdict = rawVerdict as Verdict;

    if (verdict === 'violation') {
      const rawEvidence = rawVerdictObj.evidence;
      if (!Array.isArray(rawEvidence)) {
        return createUnsureVerdict(constraint.id, 'evidence_mismatch');
      }

      const isValidEvidence = verifyEvidenceLines(
        rawEvidence as EvidenceLine[],
        sourceLines
      );

      if (!isValidEvidence) {
        return createUnsureVerdict(constraint.id, 'evidence_mismatch');
      }

      return {
        constraintId: constraint.id,
        verdict: 'violation',
        evidence: rawEvidence as EvidenceLine[],
        suggestedDeduction: constraint.deduction, // TA configured deduction strictly preserved
        unsureReason: null,
        decidedBy: 'llm',
      };
    }

    if (verdict === 'pass') {
      return {
        constraintId: constraint.id,
        verdict: 'pass',
        evidence: [],
        suggestedDeduction: 0,
        unsureReason: null,
        decidedBy: 'llm',
      };
    }

    // Default: model returned unsure
    return createUnsureVerdict(constraint.id, 'model_unsure');
  });
}

function createUnsureVerdict(
  constraintId: string,
  reason: UnsureReason
): ConstraintVerdict {
  return {
    constraintId,
    verdict: 'unsure',
    evidence: [],
    suggestedDeduction: 0,
    unsureReason: reason,
    decidedBy: 'llm',
  };
}

/**
 * Executes a model call within timeout and schema guardrails.
 * Automatically falls back to 'unsure' (timeout) if the operation takes too long.
 */
export async function applyGuardrails(
  params: ApplyGuardrailsParams
): Promise<ConstraintVerdict[]> {
  const { modelCall, constraints, sourceCode, timeoutMs = 15000 } = params;

  try {
    const rawOutput = await withTimeout(modelCall(), timeoutMs);
    return validateModelOutput(rawOutput, constraints, sourceCode);
  } catch (error) {
    const isTimeout =
      error instanceof Error && error.message.includes('timed out');
    const reason: UnsureReason = isTimeout ? 'timeout' : 'model_unsure';

    return constraints.map((c) => createUnsureVerdict(c.id, reason));
  }
}
