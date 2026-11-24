/**
 * Prompt Sanitizer and Data Protection
 * CSC13114 - LeeTKOB PA#3 (Criterion 4 — 20 points)
 *
 * Strips comments and student identity information from C++ source code
 * before building prompts for LLM evaluation. Preserves exact line numbers
 * so evidence line referencing remains strictly aligned with the original code.
 */

import type { ConstraintDefinition } from '../types/constraint.types.js';

export interface BuildPromptParams {
  statement: string;
  constraints: ConstraintDefinition[];
  sourceCode: string;
}

/**
 * Strips single-line (//) and multi-line (/* * /) comments while strictly
 * preserving original line breaks so that 1-based line numbering matches
 * the student's original submission.
 */
export function stripCommentsPreservingLines(source: string): string {
  let result = '';
  let i = 0;
  const n = source.length;

  while (i < n) {
    // String literal: "..."
    if (source[i] === '"') {
      result += '"';
      i++;
      while (i < n && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < n) {
          result += source[i] + source[i + 1];
          i += 2;
        } else {
          result += source[i];
          i++;
        }
      }
      if (i < n) {
        result += '"';
        i++;
      }
    }
    // Char literal: '...'
    else if (source[i] === "'") {
      result += "'";
      i++;
      while (i < n && source[i] !== "'") {
        if (source[i] === '\\' && i + 1 < n) {
          result += source[i] + source[i + 1];
          i += 2;
        } else {
          result += source[i];
          i++;
        }
      }
      if (i < n) {
        result += "'";
        i++;
      }
    }
    // Single-line comment: // ...
    else if (source[i] === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < n && source[i] !== '\n') {
        i++;
      }
      // Leave \n to be consumed by the loop, keeping the line break
    }
    // Multi-line block comment: /* ... */
    else if (source[i] === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') {
          result += '\n'; // Preserve line break count
        }
        i++;
      }
      if (i < n) {
        i += 2; // Skip */
      }
    } else {
      result += source[i];
      i++;
    }
  }

  return result;
}

/**
 * Strips student identifiers (8-digit student IDs, student emails, author headers,
 * and personal names) to prevent prompt leakage and grading bias.
 */
export function stripStudentIdentifiers(source: string): string {
  let cleaned = source;

  // 1. Remove student emails (e.g. 23120319@student.hcmus.edu.vn or *.edu*)
  cleaned = cleaned.replace(
    /[a-zA-Z0-9._%+-]+@(?:student\.)?[a-zA-Z0-9.-]+\.edu(?:\.[a-zA-Z]+)?/gi,
    '[REDACTED_EMAIL]'
  );

  // 2. Remove common author/student headers (e.g. Author: ..., Sinh vien: ..., MSSV: ...)
  cleaned = cleaned.replace(
    /(?:Author|Tác giả|Sinh viên|Student(?:\s+ID)?|MSSV|Họ và tên|Name):\s*[^\n\r;]+/gi,
    '[REDACTED_HEADER]'
  );

  // 3. Remove 8-digit student IDs (e.g. 23120319, 23120001)
  cleaned = cleaned.replace(/\b\d{8}\b/g, '[REDACTED_ID]');

  // 4. Remove common student names
  const knownNames = [
    'Truong Thanh Phat',
    'Thái Thiên Phú',
    'Thai Thien Phu',
    'Huỳnh Lê Minh Triết',
    'Huynh Le Minh Triet',
    'Nguyen Van A',
    'Nguyen Van B',
    'Le Van C',
  ];

  for (const name of knownNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escaped, 'gi'), '[REDACTED_NAME]');
  }

  return cleaned;
}

/**
 * Combines comment stripping and identifier removal, ensuring the line count
 * exactly matches the input source code.
 */
export function sanitizeSourceCode(source: string): string {
  const withoutComments = stripCommentsPreservingLines(source);
  return stripStudentIdentifiers(withoutComments);
}

/**
 * Formats source code with 1-based line numbers (e.g. "1 | #include <iostream>")
 * to help the LLM cite exact line numbers in its evidence.
 */
export function formatNumberedCode(source: string): string {
  const lines = source.split(/\r?\n/);
  return lines.map((line, idx) => `${idx + 1} | ${line}`).join('\n');
}

/**
 * Builds the sanitized evaluation prompt for the LLM.
 * Contains only:
 * - Lab assignment problem statement
 * - Constraints to judge
 * - Sanitized, numbered student source code
 * - Strict schema instructions (verdict: pass/violation/unsure, evidence: line/text)
 * - Strict mandate that the model does NOT decide or alter deductions.
 */
export function buildSanitizedPrompt(params: BuildPromptParams): string {
  const { statement, constraints, sourceCode } = params;
  const sanitizedCode = sanitizeSourceCode(sourceCode);
  const numberedCode = formatNumberedCode(sanitizedCode);

  const constraintsList = constraints
    .map(
      (c) =>
        `- Constraint ID: "${c.id}"\n  Type: ${c.type}\n  Description: "${c.description}"`
    )
    .join('\n\n');

  return `You are a strict, objective C++ code constraint checker for university programming labs.
You will evaluate an anonymous student submission against declared semantic constraints.

### LAB PROBLEM STATEMENT
${statement.trim()}

### CONSTRAINTS TO EVALUATE
${constraintsList}

### ANONYMOUS STUDENT C++ CODE (Numbered Lines)
\`\`\`cpp
${numberedCode}
\`\`\`

### EVALUATION INSTRUCTIONS & GUARDRAIL RULES
1. Evaluate each constraint independently. Focus strictly on whether the code adheres to the requested structural or algorithmic paradigm (e.g., recursive divide-and-conquer structure), not on algorithmic correctness or test-case bugs which are tested by unit test suites. If the code exhibits the required recursive divide-and-conquer structure and merge logic, return "pass".
2. For each constraint, return ONE of three verdicts:
   - "pass": The student complies with the constraint paradigm.
   - "violation": The student clearly violates the constraint (e.g., uses iteration or a completely different algorithm like bubble sort instead of recursion). You MUST provide exact evidence lines that prove the violation.
   - "unsure": You are uncertain, the code is ambiguous, or there is conflicting evidence.
3. Every evidence item MUST contain:
   - "line": The exact 1-based line number from the numbered code above.
   - "text": The exact verbatim source code from that line.
4. CRITICAL: Do not decide the deduction. Do not change or set the deduction points. The TA has already configured the deduction value.
5. Return ONLY a valid JSON object matching this schema without any markdown formatting or explanations:

{
  "verdicts": [
    {
      "constraintId": "string",
      "verdict": "pass" | "violation" | "unsure",
      "evidence": [
        {
          "line": 12,
          "text": "exact line content"
        }
      ]
    }
  ]
}`;
}
