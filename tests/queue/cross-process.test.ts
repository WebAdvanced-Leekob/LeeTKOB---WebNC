import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SubmissionQueue } from '../../src/queue/submission-queue.js';
import { isDockerAvailable } from '../../src/sandbox/runner.js';
import { DataStore } from '../../src/store/data-store.js';

describe('Cross-Process Queue & Worker Persistence (A2 Fixes)', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    tmpDir = undefined;
  });

  it('shares queue and DataStore across independent API and Worker OS processes', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leetkob-xproc-'));
    const queuePath = path.join(tmpDir, 'submission-queue.json');
    const dataStorePath = path.join(tmpDir, 'data-store.json');

    const apiQueue = new SubmissionQueue(queuePath);
    const apiStore = new DataStore(dataStorePath);

    // 1. API process creates lab + submission and enqueues job while worker is NOT running
    apiStore.createLab({
      id: 'lab-xproc',
      classId: 'class-1',
      title: 'Cross-process test lab',
      statement: 'Print OK',
      testCases: [{ id: 'tc1', input: '', expectedOutput: 'OK' }],
      constraints: [
        {
          id: 'C1',
          description: 'Do not use `std::sort`',
          deduction: 3,
          type: 'ban-list',
        },
      ],
    });

    const job = {
      submissionId: 'sub-xproc-01',
      labId: 'lab-xproc',
      studentAnonymousId: 'anon-xproc',
      sourceCode:
        '#include <iostream>\nint main(){ std::cout << "OK"; return 0; }',
      testCases: [{ id: 'tc1', input: '', expectedOutput: 'OK' }],
    };

    apiStore.createSubmission(job);
    await apiQueue.enqueue(job);
    expect(await apiQueue.getStatus('sub-xproc-01')).toBe('queued');

    // 2. Start independent worker process
    const pa02Root = path.resolve(__dirname, '../..');
    const tsxCli = path.resolve(pa02Root, 'node_modules/tsx/dist/cli.mjs');
    const workerScript = path.resolve(pa02Root, 'src/worker.ts');

    const spawnWorker = () =>
      spawn(process.execPath, [tsxCli, workerScript], {
        cwd: pa02Root,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          VITEST: '',
          MODEL_OFF: '1',
          QUEUE_STORE_PATH: queuePath,
          DATA_STORE_PATH: dataStorePath,
          WORKER_POLL_INTERVAL_MS: '50',
        },
        stdio: 'ignore',
      });

    const worker1 = spawnWorker();
    try {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const status = await apiQueue.getStatus('sub-xproc-01');
        if (status === 'completed') break;
        await new Promise((r) => setTimeout(r, 50));
      }
    } finally {
      worker1.kill('SIGTERM');
    }

    // 3. Verify API process sees the persisted result & review items from Worker process
    const dockerAvailable = isDockerAvailable();
    expect(await apiQueue.getStatus('sub-xproc-01')).toBe('completed');
    const results = await apiQueue.getResults('sub-xproc-01');
    expect(results).toHaveLength(1);

    const storedSub = apiStore.getSubmission('sub-xproc-01');
    expect(storedSub?.status).toBe('completed');

    if (dockerAvailable) {
      expect(results[0].compileSuccess).toBe(true);
      expect(results[0].status).toBe('ACCEPTED');
      expect(storedSub?.result?.status).toBe('ACCEPTED');

      const reviewQueue = apiStore.getReviewQueue('lab-xproc');
      expect(reviewQueue.items).toHaveLength(1);
      expect(reviewQueue.items[0].submissionId).toBe('sub-xproc-01');
    } else {
      // Fail-closed behavior when Docker daemon is unavailable
      expect(results[0].compileSuccess).toBe(false);
      expect(results[0].status).toBe('RUNTIME_ERROR');
    }

    // 4. Restarting another worker process does not re-judge already completed submission
    const worker2 = spawnWorker();
    try {
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      worker2.kill('SIGTERM');
    }

    expect(await apiQueue.getResults('sub-xproc-01')).toHaveLength(1);
  }, 15000);
});
