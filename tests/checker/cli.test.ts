import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseCliArgs,
  runCheckerCli,
  type CheckerCliOptions,
} from '../../src/checker/cli.js';
import type { PredictionRecord } from '../../src/types/constraint.types.js';

describe('Checker CLI & MODEL_OFF Mode (Criterion 6 — 10 points)', () => {
  let tempDir: string;
  let datasetDir: string;
  let outFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checker-cli-test-'));
    datasetDir = path.join(tempDir, 'dataset');
    outFile = path.join(tempDir, 'predictions.jsonl');
    fs.mkdirSync(datasetDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('CLI Arguments Parsing', () => {
    it('should parse --dataset and --out flags correctly', () => {
      const args = ['--dataset', '/path/to/dataset', '--out', '/path/to/out.jsonl'];
      const parsed = parseCliArgs(args);

      expect(parsed.datasetDir).toBe('/path/to/dataset');
      expect(parsed.outFile).toBe('/path/to/out.jsonl');
      expect(parsed.modelOff).toBe(false);
    });

    it('should recognize --model-off flag', () => {
      const args = ['--dataset', './data', '--out', './out.jsonl', '--model-off'];
      const parsed = parseCliArgs(args);

      expect(parsed.modelOff).toBe(true);
    });

    it('should default --out to predictions.jsonl if omitted', () => {
      const args = ['--dataset', './data'];
      const parsed = parseCliArgs(args);

      expect(parsed.datasetDir).toBe('./data');
      expect(parsed.outFile).toBe('predictions.jsonl');
    });

    it('should throw an error when --dataset is missing', () => {
      expect(() => parseCliArgs(['--out', './out.jsonl'])).toThrow(
        /Missing required argument: --dataset/i
      );
    });
  });

  describe('Dataset Execution with MODEL_OFF=1 (Offline Evaluation)', () => {
    beforeEach(() => {
      // Create statement.md
      fs.writeFileSync(
        path.join(datasetDir, 'statement.md'),
        '# Sort Merge Problem\nImplement merge sort without using std::sort.\n',
        'utf8'
      );

      // Create constraints.json with 1 ban-list and 1 semantic constraint
      const constraints = [
        {
          id: 'C1',
          description: 'Do not use `std::sort`',
          deduction: 3.0,
          type: 'ban-list',
        },
        {
          id: 'C2',
          description: 'Must implement merge sort recursively',
          deduction: 5.0,
          type: 'semantic',
        },
      ];
      fs.writeFileSync(
        path.join(datasetDir, 'constraints.json'),
        JSON.stringify(constraints, null, 2),
        'utf8'
      );

      // Create s01.cpp: Compliant solution (manual sort, no std::sort)
      const s01Code = `
#include <iostream>
#include <vector>

void bubbleSort(std::vector<int>& a) {
    int n = a.size();
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - 1; j++) {
            if (a[j] > a[j + 1]) std::swap(a[j], a[j + 1]);
        }
    }
}

int main() {
    std::vector<int> a = {3, 1, 2};
    bubbleSort(a);
    return 0;
}
`.trim();
      fs.writeFileSync(path.join(datasetDir, 's01.cpp'), s01Code, 'utf8');

      // Create s02.cpp: Violation solution (uses std::sort)
      const s02Code = `
#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> a = {3, 1, 2};
    std::sort(a.begin(), a.end());
    return 0;
}
`.trim();
      fs.writeFileSync(path.join(datasetDir, 's02.cpp'), s02Code, 'utf8');
    });

    it('should generate valid predictions.jsonl with exact PredictionRecord format', async () => {
      const options: CheckerCliOptions = {
        datasetDir,
        outFile,
        modelOff: true,
      };

      const result = await runCheckerCli(options);
      expect(result.processedSolutions).toBe(2);
      expect(result.totalPredictions).toBe(4); // 2 solutions x 2 constraints

      expect(fs.existsSync(outFile)).toBe(true);
      const lines = fs
        .readFileSync(outFile, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as PredictionRecord);

      expect(lines.length).toBe(4);

      for (const record of lines) {
        expect(record).toHaveProperty('solution');
        expect(record).toHaveProperty('constraint');
        expect(record).toHaveProperty('verdict');
        expect(record).toHaveProperty('evidence');
        expect(Array.isArray(record.evidence)).toBe(true);
        expect(['pass', 'violation', 'unsure']).toContain(record.verdict);
      }
    });

    it('should achieve 0 wrongful deductions on compliant solution when MODEL_OFF=1', async () => {
      const options: CheckerCliOptions = {
        datasetDir,
        outFile,
        modelOff: true,
      };

      await runCheckerCli(options);
      const lines = fs
        .readFileSync(outFile, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as PredictionRecord);

      // Check s01 against C1 (ban-list): should be pass
      const s01C1 = lines.find(
        (r) => r.solution.includes('s01') && r.constraint === 'C1'
      );
      expect(s01C1).toBeDefined();
      expect(s01C1?.verdict).toBe('pass');
      expect(s01C1?.evidence).toEqual([]);

      // Check s01 against C2 (semantic): should be unsure because model is off
      const s01C2 = lines.find(
        (r) => r.solution.includes('s01') && r.constraint === 'C2'
      );
      expect(s01C2).toBeDefined();
      expect(s01C2?.verdict).toBe('unsure');
    });

    it('should detect violations and extract evidence lines on violating solution', async () => {
      const options: CheckerCliOptions = {
        datasetDir,
        outFile,
        modelOff: true,
      };

      await runCheckerCli(options);
      const lines = fs
        .readFileSync(outFile, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as PredictionRecord);

      // Check s02 against C1 (ban-list): should be violation with evidence
      const s02C1 = lines.find(
        (r) => r.solution.includes('s02') && r.constraint === 'C1'
      );
      expect(s02C1).toBeDefined();
      expect(s02C1?.verdict).toBe('violation');
      expect(s02C1?.evidence.length).toBeGreaterThan(0);
      expect(s02C1?.evidence[0].text).toContain('std::sort');
    });
  });

  describe('Nested Dataset Layout (e.g. dev-set/sort-merge/)', () => {
    it('should process subproblem folders and include problem prefix in solution ID', async () => {
      const problemDir = path.join(datasetDir, 'sort-merge');
      fs.mkdirSync(problemDir, { recursive: true });

      fs.writeFileSync(
        path.join(problemDir, 'statement.md'),
        '# Sort Merge\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(problemDir, 'constraints.json'),
        JSON.stringify([
          { id: 'C1', description: 'Do not use `std::sort`', deduction: 3.0 },
        ]),
        'utf8'
      );
      fs.writeFileSync(
        path.join(problemDir, 's03.cpp'),
        'int main() { std::sort(a, a + n); return 0; }',
        'utf8'
      );

      const result = await runCheckerCli({
        datasetDir,
        outFile,
        modelOff: true,
      });

      expect(result.processedSolutions).toBe(1);
      const lines = fs
        .readFileSync(outFile, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as PredictionRecord);

      expect(lines.length).toBe(1);
      expect(lines[0].solution).toBe('sort-merge/s03');
      expect(lines[0].constraint).toBe('C1');
      expect(lines[0].verdict).toBe('violation');
    });
  });
});
