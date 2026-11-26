/**
 * Hardened Docker Sandbox Runner
 * CSC13114 - LeeTKOB PA#3 (Criterion 2)
 */

import { type ChildProcess, execSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import type {
  ExecutionStatus,
  SandboxExecutionResult,
  SandboxLimits,
  TestCase,
} from '../types/index.js';

export interface RunSandboxCodeOptions {
  sourceCode: string;
  limits?: Partial<SandboxLimits>;
  testCases?: TestCase[];
}

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  cpuTimeLimitMs: 2000,
  wallClockLimitMs: 3000,
  memoryLimitMb: 256,
  outputLimitKb: 64,
  pidsLimit: 64,
};

const COMPILE_TIMEOUT_MS = 15000;
const CONTAINER_START_TIMEOUT_MS = 10000;

/**
 * Compare actual stdout against expected output token-by-token (whitespace-separated).
 */
export function compareTokens(actual: string, expected: string): boolean {
  const actualTrimmed = actual.trim();
  const expectedTrimmed = expected.trim();
  const actualTokens = actualTrimmed === '' ? [] : actualTrimmed.split(/\s+/);
  const expectedTokens =
    expectedTrimmed === '' ? [] : expectedTrimmed.split(/\s+/);

  if (actualTokens.length !== expectedTokens.length) {
    return false;
  }

  for (let i = 0; i < actualTokens.length; i++) {
    if (actualTokens[i] !== expectedTokens[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Check if Docker daemon is running and accessible
 */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute C++ code inside isolated Docker container adhering to 9 security minimums
 */
export async function runSandboxCode(
  options: RunSandboxCodeOptions
): Promise<SandboxExecutionResult> {
  const { sourceCode, limits: customLimits, testCases = [] } = options;

  const limits: SandboxLimits = {
    ...DEFAULT_SANDBOX_LIMITS,
    ...customLimits,
  };

  if (!isDockerAvailable()) {
    return {
      compileSuccess: false,
      compileOutput:
        'Docker daemon is not available. Sandbox execution requires Docker.',
      status: 'RUNTIME_ERROR',
      passedTests: 0,
      totalTests: testCases.length,
      cpuTimeMs: 0,
      memoryKb: 0,
      stdout: '',
      stderr: 'Docker daemon is not available.',
    };
  }

  return executeInDockerSandbox(sourceCode, limits, testCases);
}

function killSandboxContainer(
  containerName: string,
  child?: ChildProcess
): void {
  try {
    execSync(`docker kill ${containerName}`, {
      stdio: 'ignore',
      timeout: 2000, // Timeout prevents execSync from blocking Node event loop
    });
  } catch {
    // Container may have already terminated
  }

  if (child) {
    try {
      child.kill('SIGKILL');
    } catch {
      // Child process may have already exited
    }
  }
}

function removeSandboxContainer(containerName: string): void {
  try {
    execSync(`docker rm -f ${containerName}`, {
      stdio: 'ignore',
      timeout: 3000,
    });
  } catch {
    // Container may have already been removed via --rm
  }
}

function startSandboxContainer(
  containerName: string,
  dockerImage: string,
  limits: SandboxLimits
): Promise<void> {
  const dockerArgs = [
    'run',
    '-d',
    '--rm',
    '--init', // PID 1 reaper for clean process termination (prevents fork bomb hang)
    '--name',
    containerName,
    '--network',
    'none',
    '--cpus',
    '1.0',
    '--memory',
    `${limits.memoryLimitMb}m`,
    '--memory-swap',
    `${limits.memoryLimitMb}m`,
    '--pids-limit',
    `${limits.pidsLimit}`,
    '--user',
    '1000:1000',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,nosuid,size=64m,mode=1777',
    '--tmpfs',
    '/sandbox:rw,exec,nosuid,size=64m,uid=1000,gid=1000,mode=1777',
    dockerImage,
    'sleep',
    '120',
  ];

  return new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn('docker', dockerArgs, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      reject(new Error('Timed out starting sandbox container'));
    }, CONTAINER_START_TIMEOUT_MS);

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Failed to start sandbox container (code ${code}): ${stderr}`
          )
        );
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function compileInContainer(
  containerName: string,
  sourceCode: string
): Promise<{
  success: boolean;
  output: string;
  stdout: string;
  stderr: string;
}> {
  const compileCmd =
    'cat > /sandbox/solution.cpp && g++ -std=c++17 -O2 /sandbox/solution.cpp -o /sandbox/solution';

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const child = spawn(
      'docker',
      ['exec', '-i', containerName, '/bin/bash', '-c', compileCmd],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      killSandboxContainer(containerName, child);
      resolve({
        success: false,
        output: 'Compilation timed out',
        stdout,
        stderr: stderr || 'Compilation timed out',
      });
    }, COMPILE_TIMEOUT_MS);

    child.stdin?.on('error', () => {
      // Ignore EPIPE if process exits early
    });
    child.stdin?.write(sourceCode);
    child.stdin?.end();

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      const output = (stderr || stdout).trim();
      resolve({
        success: code === 0,
        output,
        stdout,
        stderr,
      });
    });

    child.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({
        success: false,
        output: err.message,
        stdout,
        stderr: err.message,
      });
    });
  });
}

function runSingleTestInContainer(
  containerName: string,
  limits: SandboxLimits,
  input: string
): Promise<{
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
}> {
  const cpuSec = Math.max(1, Math.ceil(limits.cpuTimeLimitMs / 1000));
  const maxOutputBytes = limits.outputLimitKb * 1024;
  const runCmd = `ulimit -t ${cpuSec} && exec /sandbox/solution`;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let wallTimeExceeded = false;
    let outputLimitExceeded = false;
    let isTerminated = false;
    let resolved = false;

    const child = spawn(
      'docker',
      ['exec', '-i', containerName, '/bin/bash', '-c', runCmd],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Wall-clock timer starts ONLY when the compiled binary execution starts
    const startTime = Date.now();

    const terminateContainer = () => {
      if (isTerminated) return;
      isTerminated = true;
      killSandboxContainer(containerName, child);
    };

    const wallClockTimer = setTimeout(() => {
      wallTimeExceeded = true;
      terminateContainer();
    }, limits.wallClockLimitMs);

    const failsafeTimer = setTimeout(() => {
      if (!resolved) {
        terminateContainer();
        finalize(128 + 9);
      }
    }, limits.wallClockLimitMs + 5000);

    child.stdin?.on('error', () => {
      // Ignore EPIPE if process exits before reading all input
    });
    if (input.length > 0) {
      child.stdin?.write(input);
    }
    child.stdin?.end();

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length + chunk.length > maxOutputBytes) {
        outputLimitExceeded = true;
        child.stdout?.destroy();
        terminateContainer();
      } else {
        stdout += chunk.toString();
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length + chunk.length <= maxOutputBytes) {
        stderr += chunk.toString();
      }
    });

    const finalize = (code: number | null) => {
      if (resolved) return;
      resolved = true;

      clearTimeout(wallClockTimer);
      clearTimeout(failsafeTimer);

      const executionTimeMs = Date.now() - startTime;
      let status: ExecutionStatus = 'ACCEPTED';

      const isCpuTimeExceeded =
        wallTimeExceeded ||
        code === 152 ||
        stderr.includes('CPU time limit') ||
        stderr.includes('time limit') ||
        ((code === 137 || stderr.includes('Killed')) &&
          executionTimeMs >= limits.cpuTimeLimitMs * 0.8);

      const isMemoryLimitExceeded =
        stderr.includes('bad_alloc') ||
        stdout.includes('bad_alloc') ||
        ((code === 137 || stderr.includes('Killed')) && !isCpuTimeExceeded);

      if (outputLimitExceeded) {
        status = 'OUTPUT_LIMIT_EXCEEDED';
      } else if (isCpuTimeExceeded) {
        status = 'TIME_LIMIT_EXCEEDED';
      } else if (isMemoryLimitExceeded) {
        status = 'MEMORY_LIMIT_EXCEEDED';
      } else if (code !== 0) {
        status = 'RUNTIME_ERROR';
      }

      resolve({
        status,
        stdout,
        stderr,
        executionTimeMs,
      });
    };

    // Only listen to 'close' to ensure stdio streams have fully flushed
    child.on('close', (code) => finalize(code));
    child.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(wallClockTimer);
      clearTimeout(failsafeTimer);

      resolve({
        status: 'RUNTIME_ERROR',
        stdout,
        stderr: err.message,
        executionTimeMs: Date.now() - startTime,
      });
    });
  });
}

/**
 * Real Docker Sandbox Execution
 */
async function executeInDockerSandbox(
  sourceCode: string,
  limits: SandboxLimits,
  testCases: TestCase[]
): Promise<SandboxExecutionResult> {
  const containerName = `leetkob-sandbox-${randomUUID().slice(0, 8)}`;
  const dockerImage =
    process.env.SANDBOX_DOCKER_IMAGE || 'leetkob-sandbox:latest';

  try {
    await startSandboxContainer(containerName, dockerImage, limits);

    const compileResult = await compileInContainer(containerName, sourceCode);
    if (!compileResult.success) {
      return {
        compileSuccess: false,
        compileOutput: compileResult.output,
        status: 'RUNTIME_ERROR',
        passedTests: 0,
        totalTests: testCases.length,
        cpuTimeMs: 0,
        memoryKb: 0,
        stdout: compileResult.stdout,
        stderr: compileResult.stderr,
      };
    }

    const totalTests = testCases.length;
    if (totalTests === 0) {
      const singleRun = await runSingleTestInContainer(
        containerName,
        limits,
        ''
      );
      return {
        compileSuccess: true,
        compileOutput: compileResult.output,
        status: singleRun.status,
        passedTests: 0,
        totalTests: 0,
        cpuTimeMs: singleRun.executionTimeMs,
        memoryKb: limits.memoryLimitMb * 1024,
        stdout: singleRun.stdout,
        stderr: singleRun.stderr,
      };
    }

    let passedTests = 0;
    let overallStatus: ExecutionStatus = 'ACCEPTED';
    let maxCpuTimeMs = 0;
    let lastStdout = '';
    let lastStderr = '';

    for (const testCase of testCases) {
      const runResult = await runSingleTestInContainer(
        containerName,
        limits,
        testCase.input
      );

      maxCpuTimeMs = Math.max(maxCpuTimeMs, runResult.executionTimeMs);
      lastStdout = runResult.stdout;
      lastStderr = runResult.stderr;

      if (runResult.status !== 'ACCEPTED') {
        overallStatus = runResult.status;
        break;
      }

      if (compareTokens(runResult.stdout, testCase.expectedOutput)) {
        passedTests++;
      } else if (overallStatus === 'ACCEPTED') {
        overallStatus = 'WRONG_ANSWER';
      }
    }

    return {
      compileSuccess: true,
      compileOutput: compileResult.output,
      status: overallStatus,
      passedTests,
      totalTests,
      cpuTimeMs: maxCpuTimeMs,
      memoryKb: limits.memoryLimitMb * 1024,
      stdout: lastStdout,
      stderr: lastStderr,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      compileSuccess: false,
      compileOutput: message,
      status: 'RUNTIME_ERROR',
      passedTests: 0,
      totalTests: testCases.length,
      cpuTimeMs: 0,
      memoryKb: 0,
      stdout: '',
      stderr: message,
    };
  } finally {
    removeSandboxContainer(containerName);
  }
}
