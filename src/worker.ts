import 'dotenv/config';
import { defaultJudgeWorker } from './queue/judge-worker.js';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS) || 500;

defaultJudgeWorker.start();
console.log(
  `LeeTKOB Judge Worker started (poll interval: ${POLL_INTERVAL_MS}ms)`
);

let activeJob: Promise<void> | undefined;
const workerTimer = setInterval(() => {
  if (activeJob) return;
  activeJob = defaultJudgeWorker
    .processNext()
    .then(() => {})
    .catch((error: unknown) => {
      console.error('Judge worker failed:', error);
    })
    .finally(() => {
      activeJob = undefined;
    });
}, POLL_INTERVAL_MS);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(workerTimer);
  defaultJudgeWorker.stop();
  await activeJob;
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown();
  });
}
