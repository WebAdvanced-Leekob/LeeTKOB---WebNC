/**
 * Real Constraint Evaluation Adapter
 * CSC13114 - LeeTKOB PA#3 (Criterion 3, 4, 5)
 *
 * Replaces the mock adapter with the real two-tier evaluation pipeline:
 * 1. Syntax-aware Hard Rules: Evaluates ban-list constraints without calling LLM.
 * 2. LLM Semantic Review: Evaluates semantic constraints with prompt sanitization,
 *    guardrails (schema/timeout/evidence), and call logging.
 */

import { checkHardRules } from '../checker/hard-rules.js';
import {
  evaluateSemanticWithLlm,
  type ProviderCallFn,
} from '../checker/llm-client.js';
import type {
  ConstraintDefinition,
  ConstraintVerdict,
} from '../types/constraint.types.js';

export interface EvaluateWithEngineParams {
  statement?: string;
  sourceCode: string;
  constraints: ConstraintDefinition[];
  labId?: string;
  spendingCapUsd?: number;
  callProvider?: ProviderCallFn;
  model?: string;
  apiKey?: string;
  logFilePath?: string;
  timeoutMs?: number;
}

/**
 * Full asynchronous evaluation pipeline combining Hard Rules and LLM.
 *
 * Pipeline:
 * 1. Executes Hard Rules for all ban-list constraints.
 *    - Violations and passes for ban-list are decided immediately (decidedBy: 'hard_rule').
 *    - The LLM is NEVER invoked for constraints resolved by hard rules.
 * 2. Unresolved semantic constraints are sanitized and forwarded to the LLM Client.
 *    - Guardrails enforce schema validation, timeout limits, and evidence matching.
 *    - Every provider call is audited to call_log.jsonl with provider requestId.
 * 3. Assembles and returns the unified list of ConstraintVerdict in original constraint order.
 */
export async function evaluateSubmissionWithEngine(
  params: EvaluateWithEngineParams
): Promise<ConstraintVerdict[]> {
  const {
    statement = 'Evaluate submission against constraints.',
    sourceCode,
    constraints,
    labId,
    spendingCapUsd,
    callProvider,
    model,
    apiKey,
    logFilePath,
    timeoutMs,
  } = params;

  // 1. Run syntax-aware hard rules
  const hardRuleVerdicts = checkHardRules(sourceCode, constraints);

  // Identify semantic constraints that need LLM evaluation
  const semanticConstraintsToEvaluate = constraints.filter((c) => {
    const verdict = hardRuleVerdicts.find((hv) => hv.constraintId === c.id);
    return verdict && verdict.decidedBy === 'llm';
  });

  // If no semantic constraints or MODEL_OFF=1, return hard rule verdicts directly
  if (
    semanticConstraintsToEvaluate.length === 0 ||
    process.env.MODEL_OFF === '1'
  ) {
    return hardRuleVerdicts;
  }

  // 2. Evaluate semantic constraints with LLM
  const llmVerdicts = await evaluateSemanticWithLlm({
    statement,
    constraints: semanticConstraintsToEvaluate,
    sourceCode,
    labId,
    spendingCapUsd,
    callProvider,
    model,
    apiKey,
    logFilePath,
    timeoutMs,
  });

  const llmVerdictMap = new Map(llmVerdicts.map((v) => [v.constraintId, v]));

  // 3. Merge verdicts in original order
  return constraints.map((c) => {
    const llmVerdict = llmVerdictMap.get(c.id);
    if (llmVerdict) {
      return llmVerdict;
    }
    const hardVerdict = hardRuleVerdicts.find((hv) => hv.constraintId === c.id);
    if (hardVerdict) {
      return hardVerdict;
    }
    return {
      constraintId: c.id,
      verdict: 'unsure',
      evidence: [],
      suggestedDeduction: 0,
      unsureReason: 'model_unsure',
      decidedBy: 'llm',
    };
  });
}

/**
 * Synchronous interface maintaining backward compatibility with background judge worker.
 * Evaluates ban-list constraints using syntax-aware hard rules, and defers semantic
 * constraints to unsure/llm pending human review.
 */
export function evaluateSubmission(
  sourceCode: string,
  constraints: ConstraintDefinition[]
): ConstraintVerdict[] {
  return checkHardRules(sourceCode, constraints);
}
