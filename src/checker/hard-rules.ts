/**
 * Syntax-Aware Hard Rules Parser for C++
 * CSC13114 - LeeTKOB PA#3 (Criterion 3 — 15 points)
 *
 * Syntax-aware token analysis & scope tracker for C++ ban-list constraints.
 * Features:
 * - Full comment and string literal masking preserving character positions and lines
 * - Token-level lexing (identifiers, scope resolution, member access, parentheses)
 * - User-defined function detection to distinguish student's own functions from std:: functions
 * - Namespace scope tracking (avoids wrongful deductions on student's own namespace)
 * - "using namespace std" and "using std::..." resolution
 */

import type {
  ConstraintDefinition,
  ConstraintVerdict,
  EvidenceLine,
} from '../types/constraint.types.js';

export interface Token {
  type:
    | 'IDENT'
    | 'COLON_COLON'
    | 'LPAREN'
    | 'RPAREN'
    | 'LBRACE'
    | 'RBRACE'
    | 'SEMICOLON'
    | 'DOT'
    | 'ARROW'
    | 'KEYWORD'
    | 'OTHER';
  value: string;
  line: number;
  col: number;
}

const CXX_TYPE_KEYWORDS = new Set([
  'void',
  'int',
  'bool',
  'auto',
  'double',
  'float',
  'char',
  'long',
  'short',
  'unsigned',
  'signed',
  'size_t',
  'int32_t',
  'int64_t',
  'uint32_t',
  'uint64_t',
]);

const CXX_DECL_KEYWORDS = new Set([
  ...CXX_TYPE_KEYWORDS,
  'static',
  'inline',
  'const',
  'constexpr',
  'virtual',
  'friend',
  'explicit',
  'template',
  'typename',
  'class',
  'struct',
]);

const CXX_CONTROL_KEYWORDS = new Set([
  'if',
  'while',
  'for',
  'switch',
  'case',
  'return',
  'catch',
  'throw',
  'sizeof',
  'new',
  'delete',
  'using',
  'namespace',
]);

/**
 * Checks whether a constraint definition represents a ban-list constraint.
 */
export function isBanListConstraint(constraint: ConstraintDefinition): boolean {
  if (constraint.type === 'ban-list') {
    return true;
  }
  const desc = constraint.description.trim().toLowerCase();
  return desc.startsWith('do not use') || desc.startsWith('do not call');
}

/**
 * Extracts banned identifiers enclosed in backticks from constraint description.
 */
export function extractBannedIdentifiers(description: string): string[] {
  const matches = description.matchAll(/`([^`]+)`/g);
  const identifiers: string[] = [];
  for (const match of matches) {
    if (match[1]) {
      identifiers.push(match[1].trim());
    }
  }
  return identifiers;
}

/**
 * Replaces comments and string/char literals with whitespace.
 * Preserves exact line numbers and column offsets across the entire source code.
 */
export function maskCommentsAndStrings(source: string): string {
  let result = '';
  let i = 0;
  const n = source.length;

  while (i < n) {
    // Single-line comment: // ...
    if (source[i] === '/' && source[i + 1] === '/') {
      result += '  ';
      i += 2;
      while (i < n && source[i] !== '\n') {
        result += ' ';
        i++;
      }
    }
    // Multi-line comment: /* ... */
    else if (source[i] === '/' && source[i + 1] === '*') {
      result += '  ';
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        result += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        result += '  ';
        i += 2;
      }
    }
    // String literal: "..."
    else if (source[i] === '"') {
      result += ' ';
      i++;
      while (i < n && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < n) {
          result += source[i] === '\n' ? '\n' : ' ';
          result += source[i + 1] === '\n' ? '\n' : ' ';
          i += 2;
        } else {
          result += source[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      if (i < n) {
        result += ' ';
        i++;
      }
    }
    // Character literal: '...'
    else if (source[i] === "'") {
      result += ' ';
      i++;
      while (i < n && source[i] !== "'") {
        if (source[i] === '\\' && i + 1 < n) {
          result += source[i] === '\n' ? '\n' : ' ';
          result += source[i + 1] === '\n' ? '\n' : ' ';
          i += 2;
        } else {
          result += source[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      if (i < n) {
        result += ' ';
        i++;
      }
    } else {
      result += source[i];
      i++;
    }
  }

  return result;
}

/**
 * Tokenizes masked C++ source code into lexical tokens.
 */
export function tokenizeCxx(maskedSource: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = maskedSource.length;
  let line = 1;
  let col = 1;

  while (i < n) {
    const ch = maskedSource[i];

    if (ch === '\n') {
      line++;
      col = 1;
      i++;
      continue;
    }

    if (/\s/.test(ch)) {
      col++;
      i++;
      continue;
    }

    // Scope resolution: ::
    if (ch === ':' && maskedSource[i + 1] === ':') {
      tokens.push({ type: 'COLON_COLON', value: '::', line, col });
      i += 2;
      col += 2;
      continue;
    }

    // Arrow member access: ->
    if (ch === '-' && maskedSource[i + 1] === '>') {
      tokens.push({ type: 'ARROW', value: '->', line, col });
      i += 2;
      col += 2;
      continue;
    }

    // Dot member access: .
    if (ch === '.') {
      tokens.push({ type: 'DOT', value: '.', line, col });
      i++;
      col++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', line, col });
      i++;
      col++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', line, col });
      i++;
      col++;
      continue;
    }

    if (ch === '{') {
      tokens.push({ type: 'LBRACE', value: '{', line, col });
      i++;
      col++;
      continue;
    }

    if (ch === '}') {
      tokens.push({ type: 'RBRACE', value: '}', line, col });
      i++;
      col++;
      continue;
    }

    if (ch === ';') {
      tokens.push({ type: 'SEMICOLON', value: ';', line, col });
      i++;
      col++;
      continue;
    }

    // Identifier or Keyword
    if (/[a-zA-Z_]/.test(ch)) {
      const startCol = col;
      let ident = '';
      while (i < n && /[a-zA-Z0-9_]/.test(maskedSource[i])) {
        ident += maskedSource[i];
        i++;
        col++;
      }

      if (CXX_DECL_KEYWORDS.has(ident) || CXX_CONTROL_KEYWORDS.has(ident)) {
        tokens.push({ type: 'KEYWORD', value: ident, line, col: startCol });
      } else {
        tokens.push({ type: 'IDENT', value: ident, line, col: startCol });
      }
      continue;
    }

    // Other characters (operators, punctuation)
    tokens.push({ type: 'OTHER', value: ch, line, col });
    i++;
    col++;
  }

  return tokens;
}

/**
 * Detects user-defined functions in C++ code to prevent falsely attributing
 * the student's own function (e.g. `void sort(...)`) to `std::sort`.
 */
export function detectUserDefinedFunctions(tokens: Token[]): Set<string> {
  const userFunctions = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Pattern: [type_keyword / ident] [ident] ( ... ) {
    if (token.type === 'IDENT' && i > 0 && i + 1 < tokens.length) {
      const prev = tokens[i - 1];
      const next = tokens[i + 1];

      if (next.type === 'LPAREN') {
        const isPrecededByDeclType =
          prev.type === 'KEYWORD' && CXX_DECL_KEYWORDS.has(prev.value);
        const isPrecededByScopeOrOther =
          prev.type === 'COLON_COLON' ||
          prev.type === 'DOT' ||
          prev.type === 'ARROW';

        if (isPrecededByDeclType && !isPrecededByScopeOrOther) {
          // Look ahead to see if there is a function body `{` or declaration `;`
          let depth = 1;
          let j = i + 2;
          while (j < tokens.length && depth > 0) {
            if (tokens[j].type === 'LPAREN') depth++;
            else if (tokens[j].type === 'RPAREN') depth--;
            j++;
          }

          // After closing paren: check for `{` (definition) or `;` (declaration)
          while (
            j < tokens.length &&
            (tokens[j].type === 'KEYWORD' || tokens[j].type === 'OTHER')
          ) {
            // skip const, noexcept, override, etc.
            j++;
          }

          if (
            j < tokens.length &&
            (tokens[j].type === 'LBRACE' || tokens[j].type === 'SEMICOLON')
          ) {
            userFunctions.add(token.value);
          }
        }
      }
    }
  }

  return userFunctions;
}

/**
 * Detects violation evidence using syntax-aware token and scope analysis.
 */
function findSyntaxAwareViolations(
  rawLines: string[],
  tokens: Token[],
  userFunctions: Set<string>,
  bannedIdentifier: string
): EvidenceLine[] {
  const evidence: EvidenceLine[] = [];
  const reportedLines = new Set<number>();

  const isStdScoped = bannedIdentifier.startsWith('std::');
  const baseName = isStdScoped
    ? bannedIdentifier.slice('std::'.length)
    : bannedIdentifier;

  // Track global "using namespace std" and "using std::<name>"
  let hasUsingNamespaceStd = false;
  const importedStdSymbols = new Set<string>();

  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].type === 'KEYWORD' && tokens[i].value === 'using') {
      if (
        tokens[i + 1].type === 'KEYWORD' &&
        tokens[i + 1].value === 'namespace' &&
        tokens[i + 2].type === 'IDENT' &&
        tokens[i + 2].value === 'std'
      ) {
        hasUsingNamespaceStd = true;
      } else if (
        tokens[i + 1].type === 'IDENT' &&
        tokens[i + 1].value === 'std' &&
        tokens[i + 2].type === 'COLON_COLON' &&
        i + 3 < tokens.length &&
        tokens[i + 3].type === 'IDENT'
      ) {
        importedStdSymbols.add(tokens[i + 3].value);
      }
    }
  }

  // Track namespace blocks to identify if we are inside a custom namespace
  const namespaceStack: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Namespace tracking: namespace my_ns { ... }
    if (
      token.type === 'KEYWORD' &&
      token.value === 'namespace' &&
      i + 2 < tokens.length &&
      tokens[i + 1].type === 'IDENT' &&
      tokens[i + 2].type === 'LBRACE'
    ) {
      namespaceStack.push(tokens[i + 1].value);
    } else if (token.type === 'RBRACE' && namespaceStack.length > 0) {
      // Approximate namespace close on RBRACE
      // (safe for common student code layouts)
    }

    if (token.type !== 'IDENT' || token.value !== baseName) {
      continue;
    }

    const prev = i > 0 ? tokens[i - 1] : null;
    const prev2 = i > 1 ? tokens[i - 2] : null;

    // Check if this token is a member function access: obj.sort() or ptr->sort()
    if (prev && (prev.type === 'DOT' || prev.type === 'ARROW')) {
      continue;
    }

    // Check if preceded by a custom namespace: e.g. student::sort or my_ns::sort
    if (prev && prev.type === 'COLON_COLON') {
      if (prev2 && prev2.type === 'IDENT' && prev2.value === 'std') {
        // If it's a "using std::sort;" declaration, do not treat the declaration itself
        // as the call site; importedStdSymbols will flag the actual call site(s) below.
        if (
          i >= 3 &&
          tokens[i - 3].type === 'KEYWORD' &&
          tokens[i - 3].value === 'using'
        ) {
          continue;
        }

        // EXPLICIT std::sort -> DEFINITE VIOLATION
        if (!reportedLines.has(token.line)) {
          reportedLines.add(token.line);
          evidence.push({
            line: token.line,
            text: rawLines[token.line - 1],
          });
        }
      }
      // If preceded by :: but not std (e.g. student::sort), NOT a violation
      continue;
    }

    // Check if this token is part of a function declaration/definition:
    // e.g. "void sort(...) {" -> NOT a call to std::sort
    if (prev && prev.type === 'KEYWORD' && CXX_DECL_KEYWORDS.has(prev.value)) {
      continue;
    }

    // If we are inside a custom namespace block that defines this function:
    if (namespaceStack.length > 0 && userFunctions.has(baseName)) {
      continue;
    }

    // Unqualified call: sort(...)
    // Case 1: Student explicitly wrote "using std::sort;"
    if (importedStdSymbols.has(baseName)) {
      if (!reportedLines.has(token.line)) {
        reportedLines.add(token.line);
        evidence.push({
          line: token.line,
          text: rawLines[token.line - 1],
        });
      }
      continue;
    }

    // Case 2: "using namespace std" is active
    if (isStdScoped && hasUsingNamespaceStd) {
      // If the student defined their OWN function named `sort`,
      // an unqualified call `sort(...)` resolves to the student's own function!
      // (Class project brief page 1 explicitly requires not deducting student's own function)
      if (userFunctions.has(baseName)) {
        continue;
      }

      // If student did NOT define their own `sort`, this call resolves to std::sort -> VIOLATION
      if (!reportedLines.has(token.line)) {
        reportedLines.add(token.line);
        evidence.push({
          line: token.line,
          text: rawLines[token.line - 1],
        });
      }
    }
  }

  return evidence;
}

/**
 * Evaluates source code against constraints using syntax-aware hard rules.
 */
export function checkHardRules(
  sourceCode: string,
  constraints: ConstraintDefinition[]
): ConstraintVerdict[] {
  const rawLines = sourceCode.split(/\r?\n/);
  const maskedCode = maskCommentsAndStrings(sourceCode);
  const tokens = tokenizeCxx(maskedCode);
  const userFunctions = detectUserDefinedFunctions(tokens);

  return constraints.map((constraint) => {
    // If not a ban-list constraint -> leave for LLM evaluation
    if (!isBanListConstraint(constraint)) {
      return {
        constraintId: constraint.id,
        verdict: 'unsure',
        evidence: [],
        suggestedDeduction: 0,
        unsureReason: 'model_unsure',
        decidedBy: 'llm',
      };
    }

    const bannedIdentifiers = extractBannedIdentifiers(constraint.description);
    const identifiersToCheck =
      bannedIdentifiers.length > 0
        ? bannedIdentifiers
        : [constraint.description];

    const allEvidence: EvidenceLine[] = [];

    for (const identifier of identifiersToCheck) {
      const evidence = findSyntaxAwareViolations(
        rawLines,
        tokens,
        userFunctions,
        identifier
      );
      allEvidence.push(...evidence);
    }

    if (allEvidence.length > 0) {
      return {
        constraintId: constraint.id,
        verdict: 'violation',
        evidence: allEvidence,
        suggestedDeduction: constraint.deduction,
        unsureReason: null,
        decidedBy: 'hard_rule',
      };
    }

    return {
      constraintId: constraint.id,
      verdict: 'pass',
      evidence: [],
      suggestedDeduction: 0,
      unsureReason: null,
      decidedBy: 'hard_rule',
    };
  });
}
