import { describe, expect, it } from 'vitest';
import {
  applyGuardrails,
  validateModelOutput,
  verifyEvidenceLines,
  withTimeout,
} from '../../src/checker/guardrails.js';
import type {
  ConstraintDefinition,
  ConstraintVerdict,
} from '../../src/types/constraint.types.js';

describe('Guardrails & First Limits (Criterion 5 — 10 points)', () => {
  const semanticConstraint: ConstraintDefinition = {
    id: 'C_SEMANTIC_01',
    description: 'Must implement Merge Sort recursively',
    deduction: 4.0,
    type: 'semantic',
  };

  const sampleSourceCode = [
    '#include <iostream>',
    'void mergeSort(int a[], int l, int r) {',
    '    if (l < r) {',
    '        int m = l + (r - l) / 2;',
    '        mergeSort(a, l, m);',
    '        mergeSort(a, m + 1, r);',
    '    }',
    '}',
  ].join('\n');

  describe('1. Schema Guard (JSON Parsing & Schema Validation)', () => {
    it('should fallback to unsure (schema_mismatch) when model output is invalid JSON or free text', () => {
      const freeTextOutput =
        'I analyzed the code and found it looks like merge sort.';

      const verdicts = validateModelOutput(
        freeTextOutput,
        [semanticConstraint],
        sampleSourceCode
      );

      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].constraintId).toBe('C_SEMANTIC_01');
      expect(verdicts[0].verdict).toBe('unsure');
      expect(verdicts[0].unsureReason).toBe('schema_mismatch');
      expect(verdicts[0].decidedBy).toBe('llm');
      expect(verdicts[0].suggestedDeduction).toBe(0);
    });

    it('should fallback to unsure (schema_invalid) when JSON is valid but missing required fields or has invalid verdict', () => {
      // Missing 'verdict' field
      const invalidJson = JSON.stringify({
        verdicts: [
          {
            constraintId: 'C_SEMANTIC_01',
            evidence: [],
          },
        ],
      });

      const verdicts = validateModelOutput(
        invalidJson,
        [semanticConstraint],
        sampleSourceCode
      );

      expect(verdicts[0].verdict).toBe('unsure');
      expect(verdicts[0].unsureReason).toBe('schema_invalid');
    });

    it('should fallback to unsure (schema_invalid) when verdict is not pass/violation/unsure', () => {
      const invalidVerdictJson = JSON.stringify({
        verdicts: [
          {
            constraintId: 'C_SEMANTIC_01',
            verdict: 'acceptable', // invalid enum
            evidence: [],
          },
        ],
      });

      const verdicts = validateModelOutput(
        invalidVerdictJson,
        [semanticConstraint],
        sampleSourceCode
      );

      expect(verdicts[0].verdict).toBe('unsure');
      expect(verdicts[0].unsureReason).toBe('schema_invalid');
    });

    it('should parse markdown fenced JSON codeblocks cleanly if model wrapped output in ```json', () => {
      const markdownJson = [
        '```json',
        JSON.stringify({
          verdicts: [
            {
              constraintId: 'C_SEMANTIC_01',
              verdict: 'pass',
              evidence: [],
            },
          ],
        }),
        '```',
      ].join('\n');

      const verdicts = validateModelOutput(
        markdownJson,
        [semanticConstraint],
        sampleSourceCode
      );

      expect(verdicts[0].verdict).toBe('pass');
      expect(verdicts[0].unsureReason).toBeNull();
    });
  });

  describe('2. Evidence Line Guard (Exact Code Verification)', () => {
    it('should fallback to unsure (evidence_mismatch) when evidence line number is out of bounds', () => {
      const outputWithBadLine = JSON.stringify({
        verdicts: [
          {
            constraintId: 'C_SEMANTIC_01',
            verdict: 'violation',
            evidence: [{ line: 999, text: 'non-existent line' }],
          },
        ],
      });

      const verdicts = validateModelOutput(
        outputWithBadLine,
        [semanticConstraint],
        sampleSourceCode
      );

      expect(verdicts[0].verdict).toBe('unsure');
      expect(verdicts[0].unsureReason).toBe('evidence_mismatch');
      expect(verdicts[0].suggestedDeduction).toBe(0);
    });

    it('should fallback to unsure (evidence_mismatch) when evidence text does not match the actual code line', () => {
      const outputWithMismatchedText = JSON.stringify({
        verdicts: [
          {
            constraintId: 'C_SEMANTIC_01',
            verdict: 'violation',
            evidence: [
              {
                line: 2,
                text: 'std::sort(a, a + n);', // Line 2 in code is void mergeSort(...)
              },
            ],
          },
        ],
      });

      const verdicts = validateModelOutput(
        outputWithMismatchedText,
        [semanticConstraint],
        sampleSourceCode
      );

      expect(verdicts[0].verdict).toBe('unsure');
      expect(verdicts[0].unsureReason).toBe('evidence_mismatch');
    });

    it('should accept violation when evidence line and text match submitted code verbatim', () => {
      const outputWithValidEvidence = JSON.stringify({
        verdicts: [
          {
            constraintId: 'C_SEMANTIC_01',
            verdict: 'violation',
            evidence: [
              {
                line: 4,
                text: '        int m = l + (r - l) / 2;',
              },
            ],
          },
        ],
      });

      const verdicts = validateModelOutput(
        outputWithValidEvidence,
        [semanticConstraint],
        sampleSourceCode
      );

      expect(verdicts[0].verdict).toBe('violation');
      expect(verdicts[0].unsureReason).toBeNull();
      expect(verdicts[0].suggestedDeduction).toBe(semanticConstraint.deduction);
      expect(verdicts[0].evidence).toHaveLength(1);
      expect(verdicts[0].evidence[0].line).toBe(4);
    });
  });

  describe('3. Timeout Guard (Execution Time Limits)', () => {
    it('should resolve normally when async task finishes within timeout', async () => {
      const fastTask = async () => 'completed';
      const result = await withTimeout(fastTask(), 200);
      expect(result).toBe('completed');
    });

    it('should throw timeout error when async task exceeds timeout limit', async () => {
      const slowTask = new Promise((resolve) => setTimeout(resolve, 500));
      await expect(withTimeout(slowTask, 50)).rejects.toThrow(
        'LLM call timed out'
      );
    });
  });

  describe('4. Full Guardrails Wrapper with Fake Model (Offline & No Network)', () => {
    it('should fallback to unsure (timeout) when fake model call times out', async () => {
      const fakeDelayedModel = async (): Promise<string> => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return JSON.stringify({
          verdicts: [
            { constraintId: 'C_SEMANTIC_01', verdict: 'pass', evidence: [] },
          ],
        });
      };

      const verdicts = await applyGuardrails({
        modelCall: () => fakeDelayedModel(),
        constraints: [semanticConstraint],
        sourceCode: sampleSourceCode,
        timeoutMs: 50, // Short timeout for test
      });

      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].verdict).toBe('unsure');
      expect(verdicts[0].unsureReason).toBe('timeout');
      expect(verdicts[0].decidedBy).toBe('llm');
    });

    it('should preserve TA deduction value and NEVER allow model to override deduction', async () => {
      const fakeModelWithInjectedDeduction = async (): Promise<string> => {
        return JSON.stringify({
          verdicts: [
            {
              constraintId: 'C_SEMANTIC_01',
              verdict: 'violation',
              deduction: 99.0, // Injected attempt to override deduction
              evidence: [
                { line: 2, text: 'void mergeSort(int a[], int l, int r) {' },
              ],
            },
          ],
        });
      };

      const verdicts = await applyGuardrails({
        modelCall: () => fakeModelWithInjectedDeduction(),
        constraints: [semanticConstraint], // deduction is 4.0
        sourceCode: sampleSourceCode,
        timeoutMs: 5000,
      });

      expect(verdicts[0].verdict).toBe('violation');
      // Must equal TA's configured deduction (4.0), NEVER 99.0
      expect(verdicts[0].suggestedDeduction).toBe(4.0);
    });
  });
});
