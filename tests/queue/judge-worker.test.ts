import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateSubmissionWithEngine } from '../../src/engine/constraint-adapter.js';
import { JudgeWorker } from '../../src/queue/judge-worker.js';
import { SubmissionQueue } from '../../src/queue/submission-queue.js';
import { runSandboxCode } from '../../src/sandbox/runner.js';
import { DataStore } from '../../src/store/data-store.js';
import type { SandboxExecutionResult } from '../../src/types/sandbox.types.js';

vi.mock('../../src/sandbox/runner.js', () => ({ runSandboxCode: vi.fn() }));
vi.mock('../../src/engine/constraint-adapter.js', () => ({
  evaluateSubmissionWithEngine: vi.fn(),
}));

const result: SandboxExecutionResult = {
  compileSuccess: true,
  compileOutput: '',
  status: 'ACCEPTED',
  passedTests: 1,
  totalTests: 1,
  cpuTimeMs: 1,
  memoryKb: 1024,
  stdout: 'OK',
  stderr: '',
};

function setup() {
  const store = new DataStore();
  const queue = new SubmissionQueue();
  const worker = new JudgeWorker(queue, store);
  const lab = store.createLab({
    id: randomUUID(),
    classId: 'class-1',
    title: 'Worker test',
    statement: 'Implement recursive merge sort.',
    testCases: [{ id: 'tc1', input: '', expectedOutput: 'OK' }],
    constraints: [
      { id: 'C1', description: 'No sort', deduction: 3, type: 'ban-list' },
    ],
  });
  const job = {
    submissionId: randomUUID(),
    labId: lab.id,
    studentAnonymousId: 'anon-1',
    sourceCode: 'int main() {}',
    testCases: lab.testCases,
  };
  store.createSubmission(job);
  return { store, queue, worker, lab, job };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(runSandboxCode).mockResolvedValue(result);
  vi.mocked(evaluateSubmissionWithEngine).mockResolvedValue([
    {
      constraintId: 'C1',
      verdict: 'unsure',
      suggestedDeduction: 3,
      evidence: [{ line: 1, text: 'int main() {}' }],
      unsureReason: 'model_unsure',
      decidedBy: 'llm',
    },
  ]);
});

describe('Judge worker pipeline', () => {
  it.each(['processNext', 'startAndDrain'] as const)(
    '%s persists sandbox results and pending verdicts exactly once',
    async (method) => {
      const { store, queue, worker, lab, job } = setup();
      await queue.enqueue(job);
      worker.start();
      await worker[method]();
      await queue.enqueue(job);
      await worker[method]();
      expect(runSandboxCode).toHaveBeenCalledTimes(1);
      expect(evaluateSubmissionWithEngine).toHaveBeenCalledTimes(1);
      expect(evaluateSubmissionWithEngine).toHaveBeenCalledWith({
        statement: lab.statement,
        sourceCode: job.sourceCode,
        constraints: lab.constraints,
        labId: lab.id,
      });
      expect(store.getSubmission(job.submissionId)).toMatchObject({
        status: 'completed',
        result,
      });
      expect(await queue.getResults(job.submissionId)).toEqual([result]);
      expect(store.getReviewQueue(lab.id).items).toEqual([
        {
          id: expect.any(String),
          labId: lab.id,
          submissionId: job.submissionId,
          studentAnonymousId: job.studentAnonymousId,
          constraintId: 'C1',
          constraintDescription: 'No sort',
          verdict: 'unsure',
          suggestedDeduction: 3,
          evidence: [{ line: 1, text: job.sourceCode }],
          unsureReason: 'model_unsure',
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
        },
      ]);
    }
  );

  it.each(['WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR'] as const)(
    'skips constraint evaluation when compiled submission has status %s',
    async (nonAcceptedStatus) => {
      const { queue, worker, job, store, lab } = setup();
      vi.mocked(runSandboxCode).mockResolvedValue({
        ...result,
        compileSuccess: true,
        status: nonAcceptedStatus,
      });
      await queue.enqueue(job);
      await worker.startAndDrain();
      expect(evaluateSubmissionWithEngine).not.toHaveBeenCalled();
      expect(store.getReviewQueue(lab.id).items).toEqual([]);
      expect(store.getSubmission(job.submissionId)?.result?.status).toBe(
        nonAcceptedStatus
      );
    }
  );

  it.each(['compile error', 'sandbox exception'])(
    'skips constraints and persists failure for %s',
    async (failure) => {
      const { store, queue, worker, lab, job } = setup();
      if (failure === 'sandbox exception') {
        vi.mocked(runSandboxCode).mockRejectedValue(
          new Error('Sandbox unavailable')
        );
      } else {
        vi.mocked(runSandboxCode).mockResolvedValue({
          ...result,
          compileSuccess: false,
          status: 'RUNTIME_ERROR',
        });
      }
      await queue.enqueue(job);
      await worker.startAndDrain();
      expect(evaluateSubmissionWithEngine).not.toHaveBeenCalled();
      expect(store.getReviewQueue(lab.id).items).toEqual([]);
      expect(
        store.getSubmission(job.submissionId)?.result?.compileSuccess
      ).toBe(false);
      expect(await queue.getResults(job.submissionId)).toHaveLength(1);
      expect(await queue.getStatus(job.submissionId)).toBe(
        failure === 'sandbox exception' ? 'failed' : 'completed'
      );
    }
  );

  it('does not overlap jobs and finishes the active job after stop', async () => {
    const { queue, worker, job, store } = setup();
    let finish!: (value: SandboxExecutionResult) => void;
    vi.mocked(runSandboxCode).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await queue.enqueue(job);
    worker.start();
    const active = worker.processNext();
    await vi.waitFor(() => expect(runSandboxCode).toHaveBeenCalledTimes(1));
    expect(await worker.processNext()).toBe(false);
    worker.stop();
    finish(result);
    await active;
    expect(store.getSubmission(job.submissionId)?.result).toEqual(result);
    expect(await worker.processNext()).toBe(false);
  });

  it('samples a deterministic random 10% (rounded up, not the first ones) of pass verdicts with a fixed seed', async () => {
    async function runWithSeed(seed: number, count: number) {
      const store = new DataStore();
      const queue = new SubmissionQueue();
      const worker = new JudgeWorker(queue, store, { seed });
      const lab = store.createLab({
        id: randomUUID(),
        classId: 'class-1',
        title: 'Sampling test',
        statement: 'Sort.',
        testCases: [{ id: 'tc1', input: '', expectedOutput: 'OK' }],
        constraints: [
          { id: 'C1', description: 'No sort', deduction: 3, type: 'ban-list' },
        ],
      });

      vi.mocked(evaluateSubmissionWithEngine).mockResolvedValue([
        {
          constraintId: 'C1',
          verdict: 'pass',
          suggestedDeduction: 0,
          evidence: [],
          unsureReason: null,
          decidedBy: 'hard_rule',
        },
      ]);

      const submissionIds: string[] = [];
      for (let i = 0; i < count; i++) {
        const submissionId = `sub-${i}`;
        submissionIds.push(submissionId);
        const job = {
          submissionId,
          labId: lab.id,
          studentAnonymousId: `anon-${i}`,
          sourceCode: 'int main() {}',
          testCases: lab.testCases,
        };
        store.createSubmission(job);
        await queue.enqueue(job);
      }

      await worker.startAndDrain();
      const items = store.getReviewQueue(lab.id, { limit: 100 }).items;
      return {
        sampledSubmissionIds: items.map((item) => item.submissionId),
        stats: store.getPassSamplingStats(lab.id),
      };
    }

    // 25 pass verdicts -> ceil(25 * 0.1) = 3 sampled items
    const runA = await runWithSeed(42, 25);
    const runB = await runWithSeed(42, 25);

    expect(runA.stats).toEqual({ totalPasses: 25, sampledPasses: 3 });
    expect(runA.sampledSubmissionIds).toHaveLength(3);
    // Fixed seed must be 100% reproducible
    expect(runA.sampledSubmissionIds).toEqual(runB.sampledSubmissionIds);
    // Must not simply pick the first 3 submissions (sub-0, sub-1, sub-2)
    expect(runA.sampledSubmissionIds).not.toEqual(['sub-0', 'sub-1', 'sub-2']);

    // Edge case: 1 pass verdict -> ceil(1 * 0.1) = 1
    const singleRun = await runWithSeed(42, 1);
    expect(singleRun.stats).toEqual({ totalPasses: 1, sampledPasses: 1 });
    expect(singleRun.sampledSubmissionIds).toEqual(['sub-0']);
  });

  it('forwards 100% of violations and unsure verdicts while sampling 10% of passes', async () => {
    const store = new DataStore();
    const queue = new SubmissionQueue();
    const worker = new JudgeWorker(queue, store, { seed: 7 });
    const lab = store.createLab({
      id: randomUUID(),
      classId: 'class-1',
      title: 'Mixed verdicts test',
      statement: 'Sort.',
      testCases: [{ id: 'tc1', input: '', expectedOutput: 'OK' }],
      constraints: [
        { id: 'C1', description: 'No sort', deduction: 3, type: 'ban-list' },
      ],
    });

    const totalSubs = 15;
    for (let i = 0; i < totalSubs; i++) {
      const submissionId = `sub-${i}`;
      const job = {
        submissionId,
        labId: lab.id,
        studentAnonymousId: `anon-${i}`,
        sourceCode: 'int main() {}',
        testCases: lab.testCases,
      };
      store.createSubmission(job);
      await queue.enqueue(job);
    }

    // 10 passes, 3 violations, 2 unsures
    let callIdx = 0;
    vi.mocked(evaluateSubmissionWithEngine).mockImplementation(async () => {
      const idx = callIdx++;
      if (idx < 10) {
        return [
          {
            constraintId: 'C1',
            verdict: 'pass',
            suggestedDeduction: 0,
            evidence: [],
            unsureReason: null,
            decidedBy: 'hard_rule',
          },
        ];
      }
      if (idx < 13) {
        return [
          {
            constraintId: 'C1',
            verdict: 'violation',
            suggestedDeduction: 3,
            evidence: [{ line: 1, text: 'int main() {}' }],
            unsureReason: null,
            decidedBy: 'hard_rule',
          },
        ];
      }
      return [
        {
          constraintId: 'C1',
          verdict: 'unsure',
          suggestedDeduction: 0,
          evidence: [],
          unsureReason: 'model_unsure',
          decidedBy: 'llm',
        },
      ];
    });

    await worker.startAndDrain();
    const allItems = store.getReviewQueue(lab.id, { limit: 100 }).items;
    const passItems = allItems.filter((i) => i.verdict === 'pass');
    const violationItems = allItems.filter((i) => i.verdict === 'violation');
    const unsureItems = allItems.filter((i) => i.verdict === 'unsure');

    expect(violationItems).toHaveLength(3);
    expect(unsureItems).toHaveLength(2);
    expect(passItems).toHaveLength(1); // ceil(10 * 0.1) = 1
    expect(allItems).toHaveLength(6);
  });
});
