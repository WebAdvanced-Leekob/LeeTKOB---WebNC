import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_MS = 5000;

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}

export function resolveDefaultStorePath(filename: string): string | undefined {
  if (isTestEnvironment()) {
    return undefined;
  }
  return path.resolve(process.cwd(), '.leetkob-data', filename);
}

export function withFileLock<T>(filePath: string, fn: () => T): T {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  let acquired = false;
  while (!acquired) {
    try {
      const fd = openSync(lockPath, 'wx');
      closeSync(fd);
      acquired = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw error;
      }
      try {
        const stats = statSync(lockPath);
        if (Date.now() - stats.mtimeMs > STALE_LOCK_MS) {
          unlinkSync(lockPath);
          continue;
        }
      } catch {
        // Lock file may have been released right now
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for lock on ${filePath}`);
      }
      sleepSync(5);
    }
  }

  try {
    return fn();
  } finally {
    try {
      unlinkSync(lockPath);
    } catch {
      // Ignore if already removed
    }
  }
}

export function readJsonFile<T>(filePath: string, createDefault: () => T): T {
  if (!existsSync(filePath)) {
    return createDefault();
  }
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    return createDefault();
  }
  return JSON.parse(raw) as T;
}

export function writeJsonAtomic<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data), 'utf8');

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      renameSync(tmpPath, filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code === 'EPERM' || code === 'EBUSY') && attempt < 4) {
        sleepSync(5);
        continue;
      }
      try {
        unlinkSync(tmpPath);
      } catch {
        // ignore cleanup error
      }
      throw error;
    }
  }
}

export function updateJsonFile<T, R>(
  filePath: string,
  createDefault: () => T,
  updater: (state: T) => { result: R; changed: boolean }
): R {
  return withFileLock(filePath, () => {
    const state = readJsonFile(filePath, createDefault);
    const { result, changed } = updater(state);
    if (changed) {
      writeJsonAtomic(filePath, state);
    }
    return result;
  });
}
