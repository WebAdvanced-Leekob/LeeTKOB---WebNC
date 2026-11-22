import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheckerCli } from '../../src/checker/cli.js';
import type { PredictionRecord } from '../../src/types/constraint.types.js';

describe('Custom Cases Evaluation (Criterion 6 & 7)', () => {
  let tempOutDir: string;
  let outFile: string;
  const customCasesDir = path.resolve('custom-cases');

  beforeEach(() => {
    tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-cases-test-'));
    outFile = path.join(tempOutDir, 'predictions.jsonl');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempOutDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should verify custom-cases contains at least 5 solutions with labels.jsonl', () => {
    expect(fs.existsSync(customCasesDir)).toBe(true);
    expect(
      fs.existsSync(
        path.join(customCasesDir, 'problems/sort-merge/statement.md')
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(customCasesDir, 'problems/sort-merge/constraints.json')
      )
    ).toBe(true);
    expect(fs.existsSync(path.join(customCasesDir, 'labels.jsonl'))).toBe(true);

    const labels = fs
      .readFileSync(path.join(customCasesDir, 'labels.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));

    // Must have at least one trap and one injection
    const tags = labels.flatMap((l: { tags?: string[] }) => l.tags || []);
    expect(tags).toContain('trap');
    expect(tags).toContain('injection');
  });

  it('should run Checker CLI on custom-cases with MODEL_OFF=1 with 0 wrongful deductions', async () => {
    const result = await runCheckerCli({
      datasetDir: customCasesDir,
      outFile,
      modelOff: true,
    });

    expect(result.processedSolutions).toBe(5);
    expect(result.totalPredictions).toBe(10); // 5 solutions x 2 constraints

    const predictions: PredictionRecord[] = fs
      .readFileSync(outFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(predictions.length).toBe(10);

    // s01: compliant -> C1 must be pass (0 wrongful deduction)
    const s01C1 = predictions.find(
      (p) => p.solution.endsWith('s01') && p.constraint === 'C1'
    );
    expect(s01C1?.verdict).toBe('pass');

    // s02: plain violation -> C1 must be violation with evidence
    const s02C1 = predictions.find(
      (p) => p.solution.endsWith('s02') && p.constraint === 'C1'
    );
    expect(s02C1?.verdict).toBe('violation');
    expect(s02C1?.evidence.length).toBeGreaterThan(0);
    expect(s02C1?.evidence[0].line).toBe(8);
    expect(s02C1?.evidence[0].text).toContain('std::sort');

    // s03: TRAP -> student_algo::sort must NOT be flagged as std::sort (0 wrongful deduction)
    const s03C1 = predictions.find(
      (p) => p.solution.endsWith('s03') && p.constraint === 'C1'
    );
    expect(s03C1?.verdict).toBe('pass');
    expect(s03C1?.evidence).toEqual([]);

    // s04: INJECTION -> prompt injection in comment must NOT affect C1
    const s04C1 = predictions.find(
      (p) => p.solution.endsWith('s04') && p.constraint === 'C1'
    );
    expect(s04C1?.verdict).toBe('pass');

    // s05: Semantic violation -> C1 is pass (no std::sort)
    const s05C1 = predictions.find(
      (p) => p.solution.endsWith('s05') && p.constraint === 'C1'
    );
    expect(s05C1?.verdict).toBe('pass');

    // All semantic C2 constraints must be unsure under MODEL_OFF=1
    const semanticPredictions = predictions.filter(
      (p) => p.constraint === 'C2'
    );
    for (const sp of semanticPredictions) {
      expect(sp.verdict).toBe('unsure');
    }
  });
});
