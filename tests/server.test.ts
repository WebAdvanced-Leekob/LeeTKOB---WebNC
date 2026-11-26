import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  processNext: vi.fn(),
  close: vi.fn((callback: () => void) => callback()),
}));
vi.mock('../src/app.js', () => ({
  default: { listen: vi.fn(() => ({ close: mocks.close })) },
}));
vi.mock('../src/queue/judge-worker.js', () => ({
  defaultJudgeWorker: mocks,
}));

const originalListeners = {
  SIGINT: process.listeners('SIGINT'),
  SIGTERM: process.listeners('SIGTERM'),
};

afterEach(() => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    for (const listener of process.listeners(signal)) {
      if (!originalListeners[signal].includes(listener)) {
        process.removeListener(signal, listener);
      }
    }
  }
  vi.useRealTimers();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('Server & Standalone Worker lifecycle', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)(
    'server.ts runs API only without inline worker and closes safely on %s',
    async (signal) => {
      await import('../src/server.js');
      expect(mocks.start).not.toHaveBeenCalled();
      expect(mocks.processNext).not.toHaveBeenCalled();

      const handler = process
        .listeners(signal)
        .find((listener) => !originalListeners[signal].includes(listener));
      expect(handler).toBeDefined();
      handler!(signal);
      expect(mocks.close).toHaveBeenCalledOnce();
    }
  );

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'worker.ts starts polling and stops safely on %s while a job is active',
    async (signal) => {
      vi.useFakeTimers();
      let finish!: (value: boolean) => void;
      mocks.processNext.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          })
      );
      await import('../src/worker.js');
      expect(mocks.start).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1500);
      expect(mocks.processNext).toHaveBeenCalledOnce();
      const handler = process
        .listeners(signal)
        .find((listener) => !originalListeners[signal].includes(listener));
      expect(handler).toBeDefined();
      handler!(signal);
      expect(mocks.stop).toHaveBeenCalledOnce();
      finish(true);
      await vi.advanceTimersByTimeAsync(1500);
      expect(mocks.processNext).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    }
  );
});
