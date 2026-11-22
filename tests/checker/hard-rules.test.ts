import { describe, expect, it } from 'vitest';
import {
  checkHardRules,
  extractBannedIdentifiers,
  isBanListConstraint,
} from '../../src/checker/hard-rules.js';
import type { ConstraintDefinition } from '../../src/types/constraint.types.js';

describe('Hard Rules Parser (Criterion 3 — Syntax-Aware AST & Anti-Traps)', () => {
  const stdSortConstraint: ConstraintDefinition = {
    id: 'C1',
    description: 'Do not use `std::sort` or `std::stable_sort`',
    deduction: 3.0,
    type: 'ban-list',
  };

  const algorithmConstraint: ConstraintDefinition = {
    id: 'C2',
    description: 'Do not call `std::qsort`',
    deduction: 2.0,
    type: 'ban-list',
  };

  const semanticConstraint: ConstraintDefinition = {
    id: 'C_SEMANTIC',
    description: 'Must implement Merge Sort recursively',
    deduction: 5.0,
    type: 'semantic',
  };

  describe('Ban-list Identifier Extraction', () => {
    it('should identify ban-list constraints starting with "Do not use" or "Do not call"', () => {
      expect(isBanListConstraint(stdSortConstraint)).toBe(true);
      expect(isBanListConstraint(algorithmConstraint)).toBe(true);
      expect(isBanListConstraint(semanticConstraint)).toBe(false);
    });

    it('should extract backtick-enclosed identifiers correctly', () => {
      const identifiers = extractBannedIdentifiers(stdSortConstraint.description);
      expect(identifiers).toEqual(['std::sort', 'std::stable_sort']);

      const singleId = extractBannedIdentifiers('Do not call `qsort`');
      expect(singleId).toEqual(['qsort']);
    });
  });

  describe('Violation Detection (Catch Plain Violations)', () => {
    it('should catch direct call to std::sort and extract exact line evidence', () => {
      const code = [
        '#include <iostream>',
        '#include <algorithm>',
        'using namespace std;',
        '',
        'void sortArray(int a[], int n) {',
        '    std::sort(a, a + n);',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint]);
      expect(verdicts).toHaveLength(1);

      const v = verdicts[0];
      expect(v.constraintId).toBe('C1');
      expect(v.verdict).toBe('violation');
      expect(v.decidedBy).toBe('hard_rule');
      expect(v.suggestedDeduction).toBe(3.0);
      expect(v.unsureReason).toBeNull();
      expect(v.evidence).toHaveLength(1);
      expect(v.evidence[0]).toEqual({
        line: 6,
        text: '    std::sort(a, a + n);',
      });
    });

    it('should catch sort call when using namespace std is declared', () => {
      const code = [
        '#include <iostream>',
        '#include <algorithm>',
        'using namespace std;',
        '',
        'void solve(int a[], int n) {',
        '    sort(a, a + n);',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint]);
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].verdict).toBe('violation');
      expect(verdicts[0].evidence[0].line).toBe(6);
    });

    it('should catch violations across multiple ban-list constraints', () => {
      const code = [
        '#include <algorithm>',
        '#include <cstdlib>',
        'void run(int a[], int n) {',
        '    std::stable_sort(a, a + n);',
        '    std::qsort(a, n, sizeof(int), nullptr);',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint, algorithmConstraint]);
      expect(verdicts).toHaveLength(2);
      expect(verdicts[0].verdict).toBe('violation');
      expect(verdicts[0].constraintId).toBe('C1');
      expect(verdicts[1].verdict).toBe('violation');
      expect(verdicts[1].constraintId).toBe('C2');
    });
  });

  describe('Anti-Trap Protections (0 Wrongful Deductions)', () => {
    it('Trap 1a: should NOT flag banned identifier inside single-line comments', () => {
      const code = [
        '#include <iostream>',
        '// std::sort is banned in this lab',
        '// We implement merge sort manually',
        'void mergeSort(int a[], int l, int r) {',
        '    // recursive sort',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint]);
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].verdict).toBe('pass');
      expect(verdicts[0].evidence).toHaveLength(0);
      expect(verdicts[0].decidedBy).toBe('hard_rule');
      expect(verdicts[0].suggestedDeduction).toBe(0);
    });

    it('Trap 1b: should NOT flag banned identifier inside multi-line block comments', () => {
      const code = [
        '#include <iostream>',
        '/*',
        ' * Author note: Do not use std::sort or std::stable_sort',
        ' * because TA will deduct points.',
        ' */',
        'void mergeSort(int a[], int l, int r) {}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint]);
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].verdict).toBe('pass');
      expect(verdicts[0].evidence).toHaveLength(0);
    });

    it('Trap 1c: should NOT flag banned identifier inside string literals', () => {
      const code = [
        '#include <iostream>',
        'int main() {',
        '    std::cout << "std::sort was executed successfully" << std::endl;',
        '    const char* msg = "calling std::stable_sort here";',
        '    return 0;',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint]);
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].verdict).toBe('pass');
      expect(verdicts[0].evidence).toHaveLength(0);
    });

    it('Trap 2: should NOT flag student-defined function or custom namespace sort', () => {
      const code = [
        '#include <iostream>',
        'namespace student {',
        '    void sort(int a[], int n) {',
        '        // Custom merge sort implementation',
        '    }',
        '}',
        '',
        'void run(int a[], int n) {',
        '    student::sort(a, n);',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint]);
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].verdict).toBe('pass');
      expect(verdicts[0].evidence).toHaveLength(0);
    });

    it('Trap 3: should NOT flag #include <algorithm> when only std::swap is called', () => {
      const code = [
        '#include <iostream>',
        '#include <algorithm>',
        '',
        'void customPartition(int a[], int i, int j) {',
        '    std::swap(a[i], a[j]);',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [stdSortConstraint]);
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].verdict).toBe('pass');
      expect(verdicts[0].evidence).toHaveLength(0);
    });
  });

  describe('Semantic Constraints Handling', () => {
    it('should NOT decide semantic constraints by hard rules (defer to LLM / unsure)', () => {
      const code = [
        'void mergeSort(int a[], int l, int r) {',
        '    if (l < r) {',
        '        int m = l + (r - l) / 2;',
        '        mergeSort(a, l, m);',
        '        mergeSort(a, m + 1, r);',
        '    }',
        '}',
      ].join('\n');

      const verdicts = checkHardRules(code, [semanticConstraint]);
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].constraintId).toBe('C_SEMANTIC');
      // For semantic constraints, hard rules cannot decide -> unsure for model to evaluate
      expect(verdicts[0].verdict).toBe('unsure');
      expect(verdicts[0].unsureReason).toBe('model_unsure');
      expect(verdicts[0].decidedBy).toBe('llm');
    });
  });
});

