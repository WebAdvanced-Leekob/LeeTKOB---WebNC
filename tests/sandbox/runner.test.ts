import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { isDockerAvailable, runSandboxCode } from '../../src/sandbox/runner.js';

const dockerAvailable = isDockerAvailable();

describe('Docker Availability Guard', () => {
  it('requires Docker daemon in CI environment', () => {
    if (process.env.CI === 'true') {
      expect(dockerAvailable).toBe(true);
    }
  });
});

describe.skipIf(!dockerAvailable)(
  'Sandbox Security Minimums (Criterion 2)',
  () => {
    const attacksDir = path.resolve(__dirname, '../sandbox_attacks');

    it('1. should block network connections', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '01_no_network.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({ sourceCode: code });
      expect(result.compileSuccess).toBe(true);
      expect(result.stdout).not.toContain('BREACH_NETWORK');
      expect(result.status).not.toBe('ACCEPTED');
    });

    it('2. should enforce CPU time limit', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '02_cpu_limit.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({
        sourceCode: code,
        limits: {
          cpuTimeLimitMs: 1000,
          wallClockLimitMs: 3000,
          memoryLimitMb: 256,
          outputLimitKb: 64,
          pidsLimit: 64,
        },
      });
      expect(result.compileSuccess).toBe(true);
      expect(result.status).toBe('TIME_LIMIT_EXCEEDED');
    });

    it('3. should enforce wall-clock limit and kill container on sleep', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '03_wall_time.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({
        sourceCode: code,
        limits: {
          cpuTimeLimitMs: 2000,
          wallClockLimitMs: 2000,
          memoryLimitMb: 256,
          outputLimitKb: 64,
          pidsLimit: 64,
        },
      });
      expect(result.compileSuccess).toBe(true);
      expect(result.status).toBe('TIME_LIMIT_EXCEEDED');
    });

    it('4. should enforce memory limit on allocation and readback', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '04_memory_limit.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({
        sourceCode: code,
        limits: {
          cpuTimeLimitMs: 2000,
          wallClockLimitMs: 4000,
          memoryLimitMb: 256,
          outputLimitKb: 64,
          pidsLimit: 64,
        },
      });
      expect(result.compileSuccess).toBe(true);
      expect(result.status).toBe('MEMORY_LIMIT_EXCEEDED');
    });

    it('5. should block fork bombs via pids limit', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '05_process_limit.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({
        sourceCode: code,
        limits: {
          cpuTimeLimitMs: 2000,
          wallClockLimitMs: 3000,
          memoryLimitMb: 256,
          outputLimitKb: 64,
          pidsLimit: 32,
        },
      });
      expect(result.compileSuccess).toBe(true);
      expect(result.status).not.toBe('ACCEPTED');
    });

    it('6. should enforce output size limit', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '06_output_limit.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({
        sourceCode: code,
        limits: {
          cpuTimeLimitMs: 2000,
          wallClockLimitMs: 3000,
          memoryLimitMb: 256,
          outputLimitKb: 64,
          pidsLimit: 64,
        },
      });
      expect(result.compileSuccess).toBe(true);
      expect(result.status).toBe('OUTPUT_LIMIT_EXCEEDED');
    });

    it('7. should run as non-root user', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '07_non_root.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({ sourceCode: code });
      expect(result.compileSuccess).toBe(true);
      expect(result.stdout).toContain('SAFE_NON_ROOT');
      expect(result.stdout).not.toContain('BREACH_RUNNING_AS_ROOT');
    });

    it('8. should not mount docker socket or host filesystem', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '08_no_docker_socket.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({ sourceCode: code });
      expect(result.compileSuccess).toBe(true);
      expect(result.stdout).toContain('SAFE_NO_DOCKER_SOCKET');
      expect(result.stdout).not.toContain('BREACH_DOCKER_SOCKET_FOUND');
    });

    it('9. should not expose model API keys or secrets', async () => {
      const code = fs.readFileSync(
        path.join(attacksDir, '09_no_secrets.cpp'),
        'utf-8'
      );
      const result = await runSandboxCode({ sourceCode: code });
      expect(result.compileSuccess).toBe(true);
      expect(result.stdout).toContain('SAFE_NO_SECRETS');
      expect(result.stdout).not.toContain('BREACH_SECRET_FOUND');
    });
  }
);
