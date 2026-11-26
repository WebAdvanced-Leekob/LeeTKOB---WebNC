import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compareTokens, runSandboxCode } from '../../src/sandbox/runner.js';

const { mockExecSync, mockSpawn } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockSpawn: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: mockExecSync,
  spawn: mockSpawn,
}));

interface MockChildProcess extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createMockChild(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

describe('Sandbox Runner Grading & Compilation (A1 Fixes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate Docker daemon available
    mockExecSync.mockReturnValue(Buffer.from(''));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('compareTokens', () => {
    it('matches outputs with differing whitespace, tabs, and newlines', () => {
      expect(compareTokens('  1   2\n3\t4 \n', '1 2 3 4')).toBe(true);
      expect(compareTokens('', '   \n\t  ')).toBe(true);
    });

    it('rejects outputs with differing token values or counts', () => {
      expect(compareTokens('1 2 3', '1 2 4')).toBe(false);
      expect(compareTokens('1 2', '1 2 3')).toBe(false);
      expect(compareTokens('12 3', '1 23')).toBe(false);
    });
  });

  describe('Docker compilation, stdin, multi-test, and timer isolation', () => {
    it('compiles with -std=c++17 and returns compileSuccess: false + compileOutput on g++ failure', async () => {
      const capturedCmds: string[] = [];

      mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
        const child = createMockChild();
        if (args[0] === 'run') {
          setTimeout(() => child.emit('close', 0), 5);
        } else if (args[0] === 'exec') {
          const bashCmd = args[args.length - 1];
          capturedCmds.push(bashCmd);
          setTimeout(() => {
            child.stderr.write(
              "/sandbox/solution.cpp:2:5: error: 'foo' was not declared"
            );
            child.stderr.end();
            child.stdout.end();
            child.emit('close', 1);
          }, 5);
        }
        return child;
      });

      const result = await runSandboxCode({
        sourceCode: 'int main() { foo(); }',
        testCases: [{ id: 'tc1', input: '1 2', expectedOutput: '3' }],
      });

      expect(capturedCmds[0]).toContain('g++ -std=c++17 -O2');
      expect(result.compileSuccess).toBe(false);
      expect(result.compileOutput).toContain("error: 'foo' was not declared");
      expect(result.status).toBe('RUNTIME_ERROR');
      expect(result.passedTests).toBe(0);
      expect(result.totalTests).toBe(1);
    });

    it('passes each testCase.input to stdin, compares tokens, and counts partial passes accurately', async () => {
      const capturedInputs: string[] = [];
      let execCallIndex = 0;

      mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
        const child = createMockChild();
        if (args[0] === 'run') {
          setTimeout(() => child.emit('close', 0), 5);
        } else if (args[0] === 'exec') {
          const currentExec = execCallIndex++;
          let stdinData = '';
          child.stdin.on('data', (chunk: Buffer) => {
            stdinData += chunk.toString();
          });
          child.stdin.on('end', () => {
            if (currentExec > 0) {
              capturedInputs.push(stdinData);
            }
          });

          setTimeout(() => {
            if (currentExec === 0) {
              // Compile succeeds
              child.stdout.end();
              child.stderr.end();
              child.emit('close', 0);
            } else if (currentExec === 1) {
              // Test 1: matches with extra whitespace
              child.stdout.write('  5 \n');
              child.stdout.end();
              child.stderr.end();
              child.emit('close', 0);
            } else if (currentExec === 2) {
              // Test 2: wrong answer
              child.stdout.write('999\n');
              child.stdout.end();
              child.stderr.end();
              child.emit('close', 0);
            } else {
              // Test 3: matches
              child.stdout.write('10 20\n');
              child.stdout.end();
              child.stderr.end();
              child.emit('close', 0);
            }
          }, 10);
        }
        return child;
      });

      const result = await runSandboxCode({
        sourceCode: 'int main() { return 0; }',
        testCases: [
          { id: 'tc1', input: '2 3\n', expectedOutput: '5' },
          { id: 'tc2', input: '4 5\n', expectedOutput: '9' },
          { id: 'tc3', input: '10 20\n', expectedOutput: '10   20' },
        ],
      });

      expect(capturedInputs).toEqual(['2 3\n', '4 5\n', '10 20\n']);
      expect(result.compileSuccess).toBe(true);
      expect(result.status).toBe('WRONG_ANSWER');
      expect(result.passedTests).toBe(2);
      expect(result.totalTests).toBe(3);
    });

    it('reports ACCEPTED and full passedTests when all test cases match token-by-token', async () => {
      let execCallIndex = 0;

      mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
        const child = createMockChild();
        if (args[0] === 'run') {
          setTimeout(() => child.emit('close', 0), 5);
        } else if (args[0] === 'exec') {
          const currentExec = execCallIndex++;
          setTimeout(() => {
            if (currentExec === 0) {
              child.emit('close', 0);
            } else if (currentExec === 1) {
              child.stdout.write('1  2\n');
              child.emit('close', 0);
            } else {
              child.stdout.write('3\t4\n');
              child.emit('close', 0);
            }
          }, 5);
        }
        return child;
      });

      const result = await runSandboxCode({
        sourceCode: 'int main() { return 0; }',
        testCases: [
          { id: 'tc1', input: '1 2', expectedOutput: '1 2' },
          { id: 'tc2', input: '3 4', expectedOutput: '3 4' },
        ],
      });

      expect(result.compileSuccess).toBe(true);
      expect(result.status).toBe('ACCEPTED');
      expect(result.passedTests).toBe(2);
      expect(result.totalTests).toBe(2);
    });

    it('does not count container startup or compilation time toward wallClockLimitMs', async () => {
      let execCallIndex = 0;

      mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
        const child = createMockChild();
        if (args[0] === 'run') {
          // Slow container start (200ms) > wallClockLimitMs (100ms)
          setTimeout(() => child.emit('close', 0), 200);
        } else if (args[0] === 'exec') {
          const currentExec = execCallIndex++;
          if (currentExec === 0) {
            // Slow compile (200ms) > wallClockLimitMs (100ms)
            setTimeout(() => child.emit('close', 0), 200);
          } else {
            // Fast test execution (20ms) < wallClockLimitMs (100ms)
            setTimeout(() => {
              child.stdout.write('OK');
              child.emit('close', 0);
            }, 20);
          }
        }
        return child;
      });

      const result = await runSandboxCode({
        sourceCode: 'int main() { return 0; }',
        limits: { wallClockLimitMs: 100, cpuTimeLimitMs: 1000 },
        testCases: [{ id: 'tc1', input: '', expectedOutput: 'OK' }],
      });

      expect(result.status).toBe('ACCEPTED');
      expect(result.passedTests).toBe(1);
    });

    it('fails closed with compileSuccess: false when Docker daemon is unavailable', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Cannot connect to the Docker daemon');
      });

      const result = await runSandboxCode({
        sourceCode: 'int main() { return 0; }',
        testCases: [{ id: 'tc1', input: '', expectedOutput: '' }],
      });

      expect(result.compileSuccess).toBe(false);
      expect(result.compileOutput).toContain('Docker daemon is not available');
      expect(result.status).toBe('RUNTIME_ERROR');
      expect(result.passedTests).toBe(0);
      expect(result.totalTests).toBe(1);
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });
});
