import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendCallLog,
  calculateLabCost,
  DEEPSEEK_V4_FLASH_PRICING,
  GEMINI_15_FLASH_PRICING,
  readCallLog,
} from '../../src/checker/call-logger.js';
import {
  callDeployApi,
  evaluateSemanticWithLlm,
} from '../../src/checker/llm-client.js';
import type { ConstraintDefinition } from '../../src/types/constraint.types.js';

describe('LLM Client & Call Logger (Criterion 4 — 20 points)', () => {
  const testLogPath = path.join(
    process.cwd(),
    'tests',
    'fixtures',
    'test_call_log.jsonl'
  );

  const semanticConstraint: ConstraintDefinition = {
    id: 'C_MERGE_SORT',
    description:
      'Must implement Merge Sort recursively; do not use Bubble Sort',
    deduction: 5.0,
    type: 'semantic',
  };

  const sampleStudentCode = [
    '#include <iostream>',
    'void merge(int a[], int l, int m, int r) {}',
    'void mergeSort(int a[], int l, int r) {',
    '    if (l < r) {',
    '        int m = l + (r - l) / 2;',
    '        mergeSort(a, l, m);',
    '        mergeSort(a, m + 1, r);',
    '        merge(a, l, m, r);',
    '    }',
    '}',
  ].join('\n');

  beforeEach(async () => {
    await fs.mkdir(path.dirname(testLogPath), { recursive: true });
    try {
      await fs.unlink(testLogPath);
    } catch {
      // ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    try {
      await fs.unlink(testLogPath);
    } catch {
      // ignore
    }
  });

  describe('1. Cost Arithmetic for 80 Submissions Lab', () => {
    it('should calculate arithmetic for 80 student submissions accurately', () => {
      // Average 1200 prompt tokens, 150 completion tokens per submission
      const result = calculateLabCost({
        submissionsCount: 80,
        avgPromptTokens: 1200,
        avgCompletionTokens: 150,
        pricing: GEMINI_15_FLASH_PRICING,
      });

      expect(result.totalSubmissions).toBe(80);
      expect(result.totalPromptTokens).toBe(80 * 1200); // 96,000 tokens
      expect(result.totalCompletionTokens).toBe(80 * 150); // 12,000 tokens
      expect(result.totalCostUsd).toBeGreaterThan(0);
      expect(result.costPerSubmissionUsd).toBeGreaterThan(0);

      // Must produce readable arithmetic string for README and AI-LOG.md
      expect(result.arithmetic).toContain('80 submissions');
      expect(result.arithmetic).toContain('gemini-1.5-flash');
      expect(result.arithmetic).toContain('Total Lab Cost: $');
    });
  });

  describe('2. Call Logger (call_log.jsonl)', () => {
    it('should append structured call log entry with provider requestId, tokens, and cost', async () => {
      await appendCallLog(
        {
          requestId: 'goog-req-123456-abc',
          model: 'gemini-1.5-flash',
          promptTokens: 1250,
          completionTokens: 85,
          totalTokens: 1335,
          latencyMs: 820,
          costUsd: 0.000119,
          sanitizedPrompt: 'Sanitized prompt content here...',
          rawResponse: '{"verdicts": []}',
        },
        testLogPath
      );

      const entries = await readCallLog(testLogPath);
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.requestId).toBe('goog-req-123456-abc');
      expect(entry.model).toBe('gemini-1.5-flash');
      expect(entry.promptTokens).toBe(1250);
      expect(entry.completionTokens).toBe(85);
      expect(entry.totalTokens).toBe(1335);
      expect(entry.costUsd).toBe(0.000119);
      expect(entry.timestamp).toBeDefined();
    });
  });

  describe('3. Semantic Constraint Evaluation with Mocked Provider Call', () => {
    it('should evaluate semantic constraint, record provider requestId in log, and return compliant verdict', async () => {
      const mockProviderResponse = {
        requestId: 'provider-req-789-xyz',
        rawOutput: JSON.stringify({
          verdicts: [
            {
              constraintId: 'C_MERGE_SORT',
              verdict: 'pass',
              evidence: [],
            },
          ],
        }),
        promptTokens: 800,
        completionTokens: 40,
        latencyMs: 450,
      };

      const mockFetchFn = vi.fn().mockResolvedValue(mockProviderResponse);

      const verdicts = await evaluateSemanticWithLlm({
        statement: 'Implement recursive merge sort.',
        constraints: [semanticConstraint],
        sourceCode: sampleStudentCode,
        callProvider: mockFetchFn,
        logFilePath: testLogPath,
      });

      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].constraintId).toBe('C_MERGE_SORT');
      expect(verdicts[0].verdict).toBe('pass');
      expect(verdicts[0].decidedBy).toBe('llm');

      // Verify that the call was logged with real provider requestId
      const logs = await readCallLog(testLogPath);
      expect(logs).toHaveLength(1);
      expect(logs[0].requestId).toBe('provider-req-789-xyz');
      expect(logs[0].promptTokens).toBe(800);
      expect(logs[0].completionTokens).toBe(40);
    });

    it('should detect semantic violation with exact evidence lines and maintain TA deduction', async () => {
      const violationStudentCode = [
        '#include <iostream>',
        'void bubbleSort(int a[], int n) {',
        '    for (int i = 0; i < n; i++) {}',
        '}',
      ].join('\n');

      const mockProviderResponse = {
        requestId: 'provider-req-violation-001',
        rawOutput: JSON.stringify({
          verdicts: [
            {
              constraintId: 'C_MERGE_SORT',
              verdict: 'violation',
              evidence: [
                {
                  line: 2,
                  text: 'void bubbleSort(int a[], int n) {',
                },
              ],
            },
          ],
        }),
        promptTokens: 750,
        completionTokens: 60,
        latencyMs: 510,
      };

      const mockFetchFn = vi.fn().mockResolvedValue(mockProviderResponse);

      const verdicts = await evaluateSemanticWithLlm({
        statement: 'Implement recursive merge sort.',
        constraints: [semanticConstraint],
        sourceCode: violationStudentCode,
        callProvider: mockFetchFn,
        logFilePath: testLogPath,
      });

      expect(verdicts[0].verdict).toBe('violation');
      expect(verdicts[0].suggestedDeduction).toBe(5.0); // Preserves TA's configured deduction
      expect(verdicts[0].evidence).toHaveLength(1);
      expect(verdicts[0].evidence[0].line).toBe(2);
    });

    it('should immediately return unsure and skip network when MODEL_OFF=1 is set', async () => {
      const originalEnv = process.env.MODEL_OFF;
      process.env.MODEL_OFF = '1';

      const mockFetchFn = vi.fn();

      try {
        const verdicts = await evaluateSemanticWithLlm({
          statement: 'Implement recursive merge sort.',
          constraints: [semanticConstraint],
          sourceCode: sampleStudentCode,
          callProvider: mockFetchFn,
          logFilePath: testLogPath,
        });

        expect(verdicts).toHaveLength(1);
        expect(verdicts[0].verdict).toBe('unsure');
        expect(verdicts[0].unsureReason).toBe('model_unsure');
        expect(verdicts[0].decidedBy).toBe('llm');

        // Network call must NOT be triggered
        expect(mockFetchFn).not.toHaveBeenCalled();

        // No log entry generated when model is off
        const logs = await readCallLog(testLogPath);
        expect(logs).toHaveLength(0);
      } finally {
        if (originalEnv !== undefined) {
          process.env.MODEL_OFF = originalEnv;
        } else {
          delete process.env.MODEL_OFF;
        }
      }
    });
  });

  describe('4. Deploy API Provider (OpenAI-compatible DeepSeek)', () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.DEPLOY_API_KEY;
    const originalProvider = process.env.MODEL_PROVIDER;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      if (originalApiKey !== undefined) {
        process.env.DEPLOY_API_KEY = originalApiKey;
      } else {
        delete process.env.DEPLOY_API_KEY;
      }
      if (originalProvider !== undefined) {
        process.env.MODEL_PROVIDER = originalProvider;
      } else {
        delete process.env.MODEL_PROVIDER;
      }
    });

    it('should format request with Bearer auth, model, and extract response metrics accurately', async () => {
      process.env.DEPLOY_API_KEY = 'test-deploy-key-123';

      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'x-request-id': 'custom-req-id-001',
          }),
          json: async () => ({
            id: 'deploy-resp-999',
            model: 'deepseek-ai/deepseek-v4.1-flash-1017',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    verdicts: [
                      {
                        constraintId: 'C_MERGE_SORT',
                        verdict: 'pass',
                        evidence: [],
                      },
                    ],
                  }),
                },
              },
            ],
            usage: {
              prompt_tokens: 350,
              completion_tokens: 45,
              total_tokens: 395,
            },
          }),
        } as unknown as Response;
      });

      const result = await callDeployApi(
        'Test prompt',
        'deepseek-ai/deepseek-v4.1-flash-1017'
      );

      expect(capturedUrl).toBe(
        'https://api-cdn.deploy.com/api/v1/chat/completions'
      );
      expect(capturedInit?.method).toBe('POST');
      expect(
        (capturedInit?.headers as Record<string, string>)['Authorization']
      ).toBe('Bearer test-deploy-key-123');
      expect(
        (capturedInit?.headers as Record<string, string>)['Content-Type']
      ).toBe('application/json');

      const parsedBody = JSON.parse(String(capturedInit?.body));
      expect(parsedBody.model).toBe('deepseek-ai/deepseek-v4.1-flash-1017');
      expect(parsedBody.messages[0]).toEqual({
        role: 'user',
        content: 'Test prompt',
      });
      expect(parsedBody.response_format).toEqual({ type: 'json_object' });

      expect(result.requestId).toBe('deploy-resp-999');
      expect(result.promptTokens).toBe(350);
      expect(result.completionTokens).toBe(45);
      expect(result.rawOutput).toContain('C_MERGE_SORT');
    });

    it('should throw an error when DEPLOY_API_KEY is not configured', async () => {
      delete process.env.DEPLOY_API_KEY;

      await expect(
        callDeployApi('Test prompt', 'deepseek-ai/deepseek-v4.1-flash-1017')
      ).rejects.toThrow('DEPLOY_API_KEY is not configured');
    });

    it('should calculate cost accurately for DeepSeek model pricing', () => {
      const costResult = calculateLabCost({
        submissionsCount: 80,
        avgPromptTokens: 1000,
        avgCompletionTokens: 100,
        pricing: DEEPSEEK_V4_FLASH_PRICING,
      });

      expect(costResult.totalSubmissions).toBe(80);
      expect(costResult.totalPromptTokens).toBe(80000);
      expect(costResult.totalCompletionTokens).toBe(8000);
      // (80000 / 1e6) * 0.14 = $0.0112; (8000 / 1e6) * 0.28 = $0.00224; total = $0.01344
      expect(costResult.totalCostUsd).toBeCloseTo(0.01344, 4);
      expect(costResult.arithmetic).toContain(
        'deepseek-ai/deepseek-v4.1-flash-1017'
      );
    });
  });
});
