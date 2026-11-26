/**
 * Submission Queue with Idempotent Storage Guarantee
 * CSC13114 - LeeTKOB PA#3 (Criterion 2)
 */

import {
  readJsonFile,
  resolveDefaultStorePath,
  updateJsonFile,
  withFileLock,
  writeJsonAtomic,
} from '../store/json-file-store.js';
import type { SandboxExecutionResult, SubmissionJob } from '../types/index.js';

export type SubmissionQueueStatus =
  'queued' | 'processing' | 'completed' | 'failed';

interface QueueState {
  queue: SubmissionJob[];
  jobs: Record<string, SubmissionJob>;
  statuses: Record<string, SubmissionQueueStatus>;
  results: Record<string, SandboxExecutionResult[]>;
}

function createEmptyQueueState(): QueueState {
  return {
    queue: [],
    jobs: {},
    statuses: {},
    results: {},
  };
}

export class SubmissionQueue {
  private readonly storagePath: string | undefined;
  private memoryState: QueueState = createEmptyQueueState();

  constructor(storagePath?: string) {
    this.storagePath =
      storagePath ??
      process.env.QUEUE_STORE_PATH ??
      resolveDefaultStorePath('submission-queue.json');
  }

  private readState(): QueueState {
    if (!this.storagePath) {
      return this.memoryState;
    }
    return withFileLock(this.storagePath, () =>
      readJsonFile(this.storagePath!, createEmptyQueueState)
    );
  }

  private updateState<R>(
    updater: (state: QueueState) => { result: R; changed: boolean }
  ): R {
    if (!this.storagePath) {
      return updater(this.memoryState).result;
    }
    return updateJsonFile(this.storagePath, createEmptyQueueState, updater);
  }

  /**
   * Enqueue a submission job for judging with unique primary key check
   */
  async enqueue(job: SubmissionJob): Promise<void> {
    this.updateState((state) => {
      const existingStatus = state.statuses[job.submissionId];

      // If job is already completed or currently queued, do not duplicate
      if (existingStatus === 'completed' || existingStatus === 'queued') {
        return { result: undefined, changed: false };
      }

      const snapshot = structuredClone(job);
      state.jobs[job.submissionId] = snapshot;
      state.statuses[job.submissionId] = 'queued';
      state.queue.push(snapshot);
      return { result: undefined, changed: true };
    });
  }

  /**
   * Dequeue the next pending job in FIFO order
   */
  async dequeue(): Promise<SubmissionJob | null> {
    return this.updateState((state) => {
      const job = state.queue.shift();
      if (!job) {
        return { result: null, changed: false };
      }
      state.statuses[job.submissionId] = 'processing';
      return { result: structuredClone(job), changed: true };
    });
  }

  /**
   * Get submission job details by ID
   */
  async getJob(submissionId: string): Promise<SubmissionJob | null> {
    const state = this.readState();
    return structuredClone(state.jobs[submissionId] ?? null);
  }

  /**
   * Get the current status of a submission
   */
  async getStatus(submissionId: string): Promise<SubmissionQueueStatus | null> {
    const state = this.readState();
    return state.statuses[submissionId] ?? null;
  }

  /**
   * Store execution result with strict idempotency (judged exactly once)
   */
  async storeResult(
    submissionId: string,
    result: SandboxExecutionResult
  ): Promise<void> {
    this.updateState((state) => {
      // Idempotency check: exactly one set of verdicts is stored
      if (state.results[submissionId]) {
        return { result: undefined, changed: false };
      }
      state.results[submissionId] = [structuredClone(result)];
      state.statuses[submissionId] = 'completed';
      return { result: undefined, changed: true };
    });
  }

  /**
   * Mark a submission as failed
   */
  async markFailed(submissionId: string): Promise<void> {
    this.updateState((state) => {
      state.statuses[submissionId] = 'failed';
      return { result: undefined, changed: true };
    });
  }

  /**
   * Get all stored results for a submission
   */
  async getResults(submissionId: string): Promise<SandboxExecutionResult[]> {
    const state = this.readState();
    return structuredClone(state.results[submissionId] ?? []);
  }

  /**
   * Clear all queue state
   */
  clear(): void {
    if (!this.storagePath) {
      this.memoryState = createEmptyQueueState();
      return;
    }
    withFileLock(this.storagePath, () => {
      writeJsonAtomic(this.storagePath!, createEmptyQueueState());
    });
  }
}

/**
 * Shared default singleton queue instance
 */
export const defaultSubmissionQueue = new SubmissionQueue();
