import type { SubmissionQueueStatus } from '../queue/submission-queue.js';
import type {
  AuthUser,
  Lab,
  PublishStatus,
  ReviewItemStatus,
  ReviewQueueItem,
  ReviewQueueResponse,
  Verdict,
} from '../types/review-queue.types.js';
import type {
  SandboxExecutionResult,
  SubmissionJob,
} from '../types/sandbox.types.js';
import {
  readJsonFile,
  resolveDefaultStorePath,
  updateJsonFile,
  withFileLock,
} from './json-file-store.js';

export interface StoredSubmission extends SubmissionJob {
  status: SubmissionQueueStatus;
  result: SandboxExecutionResult | null;
}

// Extend the shared contract without changing the existing route's mock data.
export interface StoredReviewQueueItem extends ReviewQueueItem {
  labId: string;
  reviewDecision?: ReviewDecision;
}

export type ReviewDecision =
  | { decision: 'confirm' }
  | { decision: 'override'; newVerdict: Verdict; reason?: string };

export interface StoredLab extends Lab {
  status?: 'published';
}

export interface ReviewQueueFilters {
  status?: ReviewItemStatus | 'all';
  verdict?: Verdict | 'all';
  page?: number;
  limit?: number;
}

export interface StoredReviewQueueResponse extends ReviewQueueResponse {
  items: StoredReviewQueueItem[];
}

export interface PassSamplingWindow {
  totalPasses: number;
  currentSampledItemId: string | null;
}

interface DataStoreState {
  accounts: Record<string, AuthUser>;
  labs: Record<string, StoredLab>;
  submissions: Record<string, StoredSubmission>;
  reviewItems: Record<string, StoredReviewQueueItem>;
  passSamplingWindows?: Record<string, PassSamplingWindow>;
}

function createEmptyDataStoreState(): DataStoreState {
  return {
    accounts: {},
    labs: {},
    submissions: {},
    reviewItems: {},
    passSamplingWindows: {},
  };
}

/**
 * Persistent / in-memory DataStore.
 * Uses file-backed atomic JSON storage when configured (or outside tests)
 * so independent API and Worker processes share state seamlessly.
 */
export class DataStore {
  private readonly storagePath: string | undefined;
  private memoryState: DataStoreState = createEmptyDataStoreState();

  constructor(storagePath?: string) {
    this.storagePath =
      storagePath ??
      process.env.DATA_STORE_PATH ??
      resolveDefaultStorePath('data-store.json');
  }

  private readState(): DataStoreState {
    if (!this.storagePath) {
      return this.memoryState;
    }
    return withFileLock(this.storagePath, () =>
      readJsonFile(this.storagePath!, createEmptyDataStoreState)
    );
  }

  private updateState<R>(
    updater: (state: DataStoreState) => { result: R; changed: boolean }
  ): R {
    if (!this.storagePath) {
      return updater(this.memoryState).result;
    }
    return updateJsonFile(this.storagePath, createEmptyDataStoreState, updater);
  }

  getAccountCount(): number {
    return Object.keys(this.readState().accounts).length;
  }

  createAccount(token: string, user: AuthUser): boolean {
    return this.updateState((state) => {
      if (state.accounts[token]) {
        return { result: false, changed: false };
      }
      state.accounts[token] = structuredClone(user);
      return { result: true, changed: true };
    });
  }

  getAccountByToken(token: string): AuthUser | null {
    return structuredClone(this.readState().accounts[token] ?? null);
  }

  createLab(lab: Lab): Lab {
    return this.updateState((state) => {
      if (state.labs[lab.id]) {
        throw new Error(`Lab '${lab.id}' already exists.`);
      }
      state.labs[lab.id] = structuredClone(lab);
      return { result: structuredClone(lab), changed: true };
    });
  }

  getLab(labId: string): StoredLab | null {
    return structuredClone(this.readState().labs[labId] ?? null);
  }

  getLabsByClassId(classId: string): Lab[] {
    const labs = Object.values(this.readState().labs);
    return structuredClone(labs.filter((lab) => lab.classId === classId));
  }

  createSubmission(job: SubmissionJob): string {
    return this.updateState((state) => {
      if (state.submissions[job.submissionId]) {
        throw new Error(`Submission '${job.submissionId}' already exists.`);
      }
      state.submissions[job.submissionId] = {
        ...structuredClone(job),
        status: 'queued',
        result: null,
      };
      return { result: job.submissionId, changed: true };
    });
  }

  getSubmission(submissionId: string): StoredSubmission | null {
    return structuredClone(this.readState().submissions[submissionId] ?? null);
  }

  updateSubmissionResult(
    submissionId: string,
    result: SandboxExecutionResult
  ): void {
    this.updateState((state) => {
      const submission = state.submissions[submissionId];
      if (!submission) {
        throw new Error(`Submission '${submissionId}' not found.`);
      }
      submission.result = structuredClone(result);
      submission.status = 'completed';
      return { result: undefined, changed: true };
    });
  }

  addReviewItem(item: StoredReviewQueueItem): void {
    this.updateState((state) => {
      if (state.reviewItems[item.id]) {
        throw new Error(`Review item '${item.id}' already exists.`);
      }
      state.reviewItems[item.id] = structuredClone(item);
      return { result: undefined, changed: true };
    });
  }

  /**
   * Records a 'pass' verdict using stratified reservoir sampling (1 random item per 10-pass window).
   * Guarantees ceil(totalPasses * 0.1) random pass verdicts enter the review queue without
   * always picking the first ones, and never overwrites an already-reviewed item.
   */
  recordPassVerdict(
    item: StoredReviewQueueItem,
    randomValue: number = Math.random()
  ): boolean {
    return this.updateState((state) => {
      if (state.reviewItems[item.id]) {
        throw new Error(`Review item '${item.id}' already exists.`);
      }
      if (!state.passSamplingWindows) {
        state.passSamplingWindows = {};
      }
      const window = state.passSamplingWindows[item.labId] ?? {
        totalPasses: 0,
        currentSampledItemId: null,
      };

      const indexInWindow = window.totalPasses % 10;
      window.totalPasses += 1;

      let sampled = false;
      if (indexInWindow === 0) {
        state.reviewItems[item.id] = structuredClone(item);
        window.currentSampledItemId = item.id;
        sampled = true;
      } else {
        const probability = 1 / (indexInWindow + 1);
        if (randomValue < probability) {
          const prevId = window.currentSampledItemId;
          const prevItem = prevId ? state.reviewItems[prevId] : undefined;
          if (!prevItem) {
            state.reviewItems[item.id] = structuredClone(item);
            window.currentSampledItemId = item.id;
            sampled = true;
          } else if (prevItem.status === 'pending') {
            delete state.reviewItems[prevId!];
            state.reviewItems[item.id] = structuredClone(item);
            window.currentSampledItemId = item.id;
            sampled = true;
          }
        }
      }

      state.passSamplingWindows[item.labId] = window;
      return { result: sampled, changed: true };
    });
  }

  getPassSamplingStats(labId: string): {
    totalPasses: number;
    sampledPasses: number;
  } {
    const state = this.readState();
    const totalPasses = state.passSamplingWindows?.[labId]?.totalPasses ?? 0;
    const sampledPasses = Object.values(state.reviewItems).filter(
      (item) => item.labId === labId && item.verdict === 'pass'
    ).length;
    return { totalPasses, sampledPasses };
  }

  getReviewItem(itemId: string): StoredReviewQueueItem | null {
    return structuredClone(this.readState().reviewItems[itemId] ?? null);
  }

  getReviewQueue(
    labId: string,
    filters: ReviewQueueFilters = {}
  ): StoredReviewQueueResponse {
    const {
      status = 'pending',
      verdict = 'all',
      page = 1,
      limit = 20,
    } = filters;
    if (!Number.isInteger(page) || page < 1) {
      throw new RangeError(
        'page must be an integer greater than or equal to 1.'
      );
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('limit must be an integer between 1 and 100.');
    }
    const filtered = Object.values(this.readState().reviewItems).filter(
      (item) =>
        item.labId === labId &&
        (status === 'all' || item.status === status) &&
        (verdict === 'all' || item.verdict === verdict)
    );
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    return {
      items: structuredClone(filtered.slice(startIndex, startIndex + limit)),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1 && totalPages > 0,
      },
    };
  }

  // Authentication and class ownership are checked by the calling route.
  reviewItem(
    itemId: string,
    reviewedBy: AuthUser['id'],
    decision?: ReviewDecision
  ): StoredReviewQueueItem {
    return this.updateState((state) => {
      const item = state.reviewItems[itemId];
      if (!item) {
        throw new Error(`Review item '${itemId}' not found.`);
      }
      if (item.status === 'reviewed') {
        throw new Error(`Review item '${itemId}' is already reviewed.`);
      }
      if (decision?.decision === 'override') {
        item.verdict = decision.newVerdict;
        item.unsureReason =
          decision.newVerdict === 'unsure'
            ? (item.unsureReason ?? 'model_unsure')
            : null;
        if (decision.newVerdict === 'pass') item.evidence = [];
      }
      if (decision) item.reviewDecision = structuredClone(decision);
      item.status = 'reviewed';
      item.reviewedBy = reviewedBy;
      item.reviewedAt = new Date().toISOString();
      return { result: structuredClone(item), changed: true };
    });
  }

  /** Reports readiness only; this method does not publish marks. */
  getPublishStatus(labId: string): PublishStatus {
    const unreviewedCount = Object.values(this.readState().reviewItems).filter(
      (item) => item.labId === labId && item.status === 'pending'
    ).length;
    return { canPublish: unreviewedCount === 0, unreviewedCount };
  }

  /** Called only after an explicit, authorized publish request. */
  publishLab(labId: string): StoredLab {
    return this.updateState((state) => {
      const lab = state.labs[labId];
      if (!lab) throw new Error(`Lab '${labId}' not found.`);
      const unreviewedCount = Object.values(state.reviewItems).filter(
        (item) => item.labId === labId && item.status === 'pending'
      ).length;
      if (unreviewedCount > 0) {
        throw new Error(`Lab '${labId}' still has unreviewed items.`);
      }
      lab.status = 'published';
      return { result: structuredClone(lab), changed: true };
    });
  }
}

export const defaultDataStore = new DataStore();
