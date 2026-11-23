import { describe, expect, it } from 'vitest';
import {
  buildSanitizedPrompt,
  formatNumberedCode,
  sanitizeSourceCode,
  stripCommentsPreservingLines,
  stripStudentIdentifiers,
} from '../../src/checker/prompt-sanitizer.js';
import type { ConstraintDefinition } from '../../src/types/constraint.types.js';

describe('Prompt Sanitizer (Criterion 4 — Data Protection & Comment Stripping)', () => {
  describe('Comment Stripping (Line Preservation)', () => {
    it('should strip single-line comments while preserving newlines and line numbers', () => {
      const code = [
        '#include <iostream>',
        '// Student note: using quick sort algorithm',
        'void sort(int a[], int n) {',
        '    int x = 1; // inline comment',
        '}',
      ].join('\n');

      const sanitized = stripCommentsPreservingLines(code);
      const lines = sanitized.split('\n');

      expect(lines).toHaveLength(5);
      expect(sanitized).not.toContain('Student note: using quick sort');
      expect(sanitized).not.toContain('inline comment');
      expect(lines[0]).toBe('#include <iostream>');
      expect(lines[1].trim()).toBe(''); // line 2 preserved as empty/whitespace
      expect(lines[2]).toBe('void sort(int a[], int n) {');
      expect(lines[3]).toContain('int x = 1;');
    });

    it('should strip multi-line block comments while preserving the exact line count', () => {
      const code = [
        '/*',
        ' * Author: Nguyen Van A (23120001)',
        ' * Lab 01: Sorting algorithm',
        ' */',
        'void mergeSort(int a[], int l, int r) {',
        '    // recursive step',
        '}',
      ].join('\n');

      const originalLineCount = code.split('\n').length;
      const sanitized = stripCommentsPreservingLines(code);

      expect(sanitized.split('\n')).toHaveLength(originalLineCount);
      expect(sanitized).not.toContain('Nguyen Van A');
      expect(sanitized).not.toContain('Lab 01: Sorting algorithm');
      expect(sanitized).not.toContain('recursive step');
      expect(sanitized).toContain('void mergeSort(int a[], int l, int r) {');
    });

    it('should NOT strip comment markers inside string literals', () => {
      const code = [
        '#include <iostream>',
        'int main() {',
        '    std::cout << "// this is not a comment" << std::endl;',
        '    const char* p = "/* also not a comment */";',
        '    return 0;',
        '}',
      ].join('\n');

      const sanitized = stripCommentsPreservingLines(code);
      expect(sanitized).toContain('"// this is not a comment"');
      expect(sanitized).toContain('"/* also not a comment */"');
    });
  });

  describe('Student Identifier Removal', () => {
    it('should strip student IDs, student emails, and author headers', () => {
      const code = [
        '// Student ID: 23120319 - Truong Thanh Phat',
        '// Email: 23120319@student.hcmus.edu.vn',
        'int student_id = 23120319;',
        'void solve() {}',
      ].join('\n');

      const sanitized = stripStudentIdentifiers(code);
      expect(sanitized).not.toContain('23120319');
      expect(sanitized).not.toContain('Truong Thanh Phat');
      expect(sanitized).not.toContain('student.hcmus.edu.vn');
      expect(sanitized).toContain('void solve() {}');
    });
  });

  describe('Full Code Sanitization', () => {
    it('should produce sanitized code with strictly matching line count for evidence alignment', () => {
      const code = [
        '// Header: 23120999 Nguyen Van B',
        '#include <iostream>',
        '/*',
        ' * Explanation: this uses bubble sort',
        ' */',
        'void sort(int a[], int n) {',
        '    // nested comment',
        '    for (int i = 0; i < n; i++) {}',
        '}',
      ].join('\n');

      const originalLines = code.split('\n');
      const sanitized = sanitizeSourceCode(code);
      const sanitizedLines = sanitized.split('\n');

      expect(sanitizedLines).toHaveLength(originalLines.length);
      expect(sanitized).not.toContain('23120999');
      expect(sanitized).not.toContain('Nguyen Van B');
      expect(sanitized).not.toContain('bubble sort');
      expect(sanitized).not.toContain('nested comment');
      expect(sanitizedLines[7]).toContain('for (int i = 0; i < n; i++) {}');
    });
  });

  describe('Numbered Code Formatting for Evidence Referencing', () => {
    it('should format code with 1-based line numbers', () => {
      const code = ['void a() {}', 'void b() {}'].join('\n');
      const numbered = formatNumberedCode(code);

      expect(numbered).toContain('1 | void a() {}');
      expect(numbered).toContain('2 | void b() {}');
    });
  });

  describe('Sanitized Prompt Builder', () => {
    const semanticConstraint: ConstraintDefinition = {
      id: 'C_SEMANTIC',
      description:
        'Must implement Merge Sort recursively; do not use Bubble Sort',
      deduction: 4.0,
      type: 'semantic',
    };

    it('should construct a secure prompt containing statement, constraints, and sanitized code without student info', () => {
      const statement = 'Implement merge sort for an array of integers.';
      const code = [
        '// Author: Student 23120123 - Le Van C',
        '// Email: 23120123@student.hcmus.edu.vn',
        'void mergeSort(int a[], int l, int r) {',
        '    // Merge sort implementation',
        '}',
      ].join('\n');

      const prompt = buildSanitizedPrompt({
        statement,
        constraints: [semanticConstraint],
        sourceCode: code,
      });

      // Contains task statement & constraints
      expect(prompt).toContain(statement);
      expect(prompt).toContain(semanticConstraint.description);
      expect(prompt).toContain('C_SEMANTIC');

      // Contains code structure
      expect(prompt).toContain('void mergeSort(int a[], int l, int r) {');

      // DOES NOT contain comments or student identifiers
      expect(prompt).not.toContain('23120123');
      expect(prompt).not.toContain('Le Van C');
      expect(prompt).not.toContain('student.hcmus.edu.vn');
      expect(prompt).not.toContain('Merge sort implementation');

      // Contains instructions on output schema (verdict: pass/violation/unsure, evidence with line/text)
      expect(prompt).toContain('verdict');
      expect(prompt).toContain('pass');
      expect(prompt).toContain('violation');
      expect(prompt).toContain('unsure');
      expect(prompt).toContain('evidence');

      // Instructs model not to decide deductions
      expect(prompt).toMatch(/do not (decide|change|set) (the )?deduction/i);
    });
  });
});
