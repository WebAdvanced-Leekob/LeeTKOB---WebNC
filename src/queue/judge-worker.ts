/**
 * Background Judge Worker
 * CSC13114 - LeeTKOB PA#3 (Criterion 2)
 */

import { randomUUID } from 'node:crypto';
import { evaluateSubmissionWithEngine } from '../engine/constraint-adapter.js';
import { runSandboxCode } from '../sandbox/runner.js';
import {
  defaultDataStore,
  DataStore,
  type StoredReviewQueueItem,
} from '../store/data-store.js';
import type { SandboxExecutionResult } from '../types/sandbox.types.js';
import { defaultSubmissionQueue, SubmissionQueue } from './submission-queue.js';

/** Deterministic PRNG (Mulberry32) for reproducible fixed-seed sampling tests. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface JudgeWorkerOptions {
  rng?: () => number;
  seed?: number;
}

export class JudgeWorker {
  private isRunning = false;
  private isProcessing = false;
  private readonly rng: () => number;

  constructor(
    private readonly queue: SubmissionQueue = defaultSubmissionQueue,
    private readonly dataStore: DataStore = defaultDataStore,
    options?: JudgeWorkerOptions
  ) {
    if (options?.rng) {
      this.rng = options.rng;
    } else if (options?.seed !== undefined) {
      this.rng = createSeededRng(options.seed);
    } else if (process.env.REVIEW_SAMPLE_SEED !== undefined) {
      const parsed = Number(process.env.REVIEW_SAMPLE_SEED);
      this.rng = Number.isFinite(parsed)
        ? createSeededRng(parsed)
        : () => Math.random();
    } else {
      this.rng = () => Math.random();
    }
  }

  /** Stop picking up new jobs; the current job is allowed to finish. */
  stop(): void {
    this.isRunning = false;
  }

  start(): void {
    this.isRunning = true;
  }

  /** Use the same pipeline for manual draining and background polling. */
  async startAndDrain(): Promise<void> {
    this.start();
    while (await this.processNext()) {
      // Continue until stopped or the queue is empty.
    }
  }

  async processNext(): Promise<boolean> {
    if (!this.isRunning || this.isProcessing) return false;
    this.isProcessing = true;
    try {
      const job = await this.queue.dequeue();
      if (!job) return false;
      if ((await this.queue.getResults(job.submissionId)).length > 0) {
        return true;
      }

      let result: SandboxExecutionResult;
      let failed = false;
      try {
        result = await runSandboxCode({
          sourceCode: job.sourceCode,
          limits: job.limits,
          testCases: job.testCases,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        failed = true;
        result = {
          compileSuccess: false,
          compileOutput: errorMessage,
          status: 'RUNTIME_ERROR',
          passedTests: 0,
          totalTests: job.testCases.length,
          cpuTimeMs: 0,
          memoryKb: 0,
          stdout: '',
          stderr: errorMessage,
        };
      }

      const lab = this.dataStore.getLab(job.labId);
      if (lab && result.status === 'ACCEPTED') {
        const verdicts = await evaluateSubmissionWithEngine({
          statement: lab.statement,
          sourceCode: job.sourceCode,
          constraints: lab.constraints,
          labId: job.labId,
          ...(lab.spendingCapUsd !== undefined
            ? { spendingCapUsd: lab.spendingCapUsd }
            : {}),
        });
        for (const verdict of verdicts) {
          const reviewItem: StoredReviewQueueItem = {
            id: randomUUID(),
            labId: job.labId,
            submissionId: job.submissionId,
            studentAnonymousId: job.studentAnonymousId,
            constraintId: verdict.constraintId,
            constraintDescription: lab.constraints.find(
              (constraint) => constraint.id === verdict.constraintId
            )!.description,
            verdict: verdict.verdict,
            suggestedDeduction: verdict.suggestedDeduction,
            evidence: verdict.evidence,
            unsureReason: verdict.unsureReason,
            status: 'pending',
            reviewedBy: null,
            reviewedAt: null,
          };

          if (verdict.verdict === 'pass') {
            this.dataStore.recordPassVerdict(reviewItem, this.rng());
          } else {
            this.dataStore.addReviewItem(reviewItem);
          }
        }
      }

      // Queue-only clients may not have a corresponding DataStore submission.
      if (this.dataStore.getSubmission(job.submissionId)) {
        this.dataStore.updateSubmissionResult(job.submissionId, result);
      }
      await this.queue.storeResult(job.submissionId, result);
      if (failed) await this.queue.markFailed(job.submissionId);
      return true;
    } finally {
      this.isProcessing = false;
    }
  }
}

export const defaultJudgeWorker = new JudgeWorker();
