/**
 * Standalone Checker CLI for Constraint Evaluation
 * CSC13114 - LeeTKOB PA#3 (Criterion 6 — 10 points)
 *
 * Standalone command-line utility used by lecturers and TAs to evaluate
 * student submissions against constraints across datasets (dev-set, held-out).
 *
 * Supports:
 * - Offline evaluation via MODEL_OFF=1 (no network, hard rules only, 0 wrongful deductions)
 * - Output format: JSONL conforming strictly to PredictionRecord schema
 * - Flexible dataset layouts (root folder or problem subfolders)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSubmissionWithEngine } from '../engine/constraint-adapter.js';
import { isBanListConstraint } from './hard-rules.js';
import type {
  ConstraintDefinition,
  PredictionRecord,
} from '../types/constraint.types.js';

export interface CheckerCliOptions {
  datasetDir: string;
  outFile: string;
  modelOff?: boolean;
}

export interface CheckerCliResult {
  processedProblems: number;
  processedSolutions: number;
  totalPredictions: number;
  outFile: string;
}

interface ProblemSpec {
  problemName: string;
  statement: string;
  constraints: ConstraintDefinition[];
  solutionFiles: { id: string; filePath: string }[];
}

/**
 * Parses raw JSON constraints into strongly typed ConstraintDefinition[].
 */
export function parseConstraints(raw: unknown): ConstraintDefinition[] {
  let list: Record<string, unknown>[] = [];

  if (Array.isArray(raw)) {
    list = raw as Record<string, unknown>[];
  } else if (raw && typeof raw === 'object') {
    const rawObj = raw as Record<string, unknown>;
    if (Array.isArray(rawObj.constraints)) {
      list = rawObj.constraints as Record<string, unknown>[];
    } else {
      list = Object.entries(rawObj).map(([key, val]) => ({
        id: key,
        ...(typeof val === 'object' && val !== null
          ? (val as Record<string, unknown>)
          : { description: String(val) }),
      }));
    }
  }

  return list.map((item, idx) => {
    const id = String(item.id || `C${idx + 1}`);
    const description = String(
      item.description || item.text || item.prompt || ''
    );
    const deduction = typeof item.deduction === 'number' ? item.deduction : 0;
    const type =
      item.type === 'ban-list' || item.type === 'semantic'
        ? (item.type as 'ban-list' | 'semantic')
        : isBanListConstraint({ id, description, deduction, type: 'semantic' })
          ? 'ban-list'
          : 'semantic';

    return {
      id,
      description,
      deduction,
      type,
    };
  });
}

/**
 * Parses command-line arguments into CheckerCliOptions.
 */
export function parseCliArgs(args: string[]): CheckerCliOptions {
  let datasetDir: string | undefined;
  let outFile = 'predictions.jsonl';
  let modelOff = process.env.MODEL_OFF === '1';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dataset' || arg === '-d') {
      datasetDir = args[++i];
    } else if (arg === '--out' || arg === '-o') {
      outFile = args[++i];
    } else if (arg === '--model-off' || arg === '-m') {
      modelOff = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!datasetDir) {
    throw new Error('Missing required argument: --dataset <directory>');
  }

  return {
    datasetDir,
    outFile,
    modelOff,
  };
}

function printHelp(): void {
  console.log(`
LeeTKOB Standalone Checker CLI - PA#3 (CSC13114)

Usage:
  npx tsx src/checker/cli.ts --dataset <dir> [--out <predictions.jsonl>] [--model-off]

Options:
  --dataset, -d    Path to dataset directory containing problem(s) [Required]
  --out, -o        Output path for predictions JSONL (default: predictions.jsonl)
  --model-off, -m  Disable LLM calls (hard rules only, semantic -> unsure, no network)
  --help, -h       Display this help message
`);
}

/**
 * Discovers problems and solutions in the dataset directory.
 */
function discoverProblems(datasetDir: string): ProblemSpec[] {
  const resolvedPath = path.resolve(datasetDir);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Dataset directory does not exist: ${resolvedPath}`);
  }

  const problems: ProblemSpec[] = [];

  // Check if datasetDir follows the official layout: problems/ and solutions/
  const problemsDir = path.join(resolvedPath, 'problems');
  const solutionsDir = path.join(resolvedPath, 'solutions');
  if (fs.existsSync(problemsDir) && fs.existsSync(solutionsDir)) {
    const pEntries = fs.readdirSync(problemsDir, { withFileTypes: true });
    for (const pEntry of pEntries) {
      if (pEntry.isDirectory() && !pEntry.name.startsWith('.')) {
        const problemName = pEntry.name;
        const pSubPath = path.join(problemsDir, problemName);
        const cPath = path.join(pSubPath, 'constraints.json');
        if (fs.existsSync(cPath)) {
          const statementPath = path.join(pSubPath, 'statement.md');
          const statement = fs.existsSync(statementPath)
            ? fs.readFileSync(statementPath, 'utf8')
            : `Problem ${problemName}`;
          const constraintsRaw = JSON.parse(fs.readFileSync(cPath, 'utf8'));
          const constraints = parseConstraints(constraintsRaw);

          const sSubPath = path.join(solutionsDir, problemName);
          const solutionFiles: { id: string; filePath: string }[] = [];
          if (fs.existsSync(sSubPath)) {
            const sEntries = fs.readdirSync(sSubPath, { withFileTypes: true });
            for (const sEntry of sEntries) {
              if (sEntry.isFile() && sEntry.name.endsWith('.cpp')) {
                const baseName = path.basename(sEntry.name, '.cpp');
                const id = `${problemName}/${baseName}`;
                solutionFiles.push({
                  id,
                  filePath: path.join(sSubPath, sEntry.name),
                });
              }
            }
          }
          solutionFiles.sort((a, b) => a.id.localeCompare(b.id));
          problems.push({
            problemName,
            statement,
            constraints,
            solutionFiles,
          });
        }
      }
    }
    // Sort problems deterministically by name
    problems.sort((a, b) => a.problemName.localeCompare(b.problemName));
    return problems;
  }

  // Check if datasetDir itself is a single problem (contains constraints.json)
  const singleConstraintsPath = path.join(resolvedPath, 'constraints.json');
  if (fs.existsSync(singleConstraintsPath)) {
    const problemName = path.basename(resolvedPath);
    const spec = loadProblemSpec(resolvedPath, problemName);
    problems.push(spec);
    return problems;
  }

  // Otherwise, scan subdirectories for problem folders
  const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const subPath = path.join(resolvedPath, entry.name);
      const subConstraintsPath = path.join(subPath, 'constraints.json');
      if (fs.existsSync(subConstraintsPath)) {
        const spec = loadProblemSpec(subPath, entry.name);
        problems.push(spec);
      }
    }
  }

  if (problems.length === 0) {
    throw new Error(
      `No valid problems with constraints.json found in dataset: ${resolvedPath}`
    );
  }

  return problems;
}

/**
 * Loads a problem specification from a problem directory.
 */
function loadProblemSpec(dirPath: string, problemName: string): ProblemSpec {
  const statementPath = path.join(dirPath, 'statement.md');
  const statement = fs.existsSync(statementPath)
    ? fs.readFileSync(statementPath, 'utf8')
    : `Problem ${problemName}`;

  const constraintsRaw = JSON.parse(
    fs.readFileSync(path.join(dirPath, 'constraints.json'), 'utf8')
  );
  const constraints = parseConstraints(constraintsRaw);

  const solutionFiles: { id: string; filePath: string }[] = [];

  function collectCppFiles(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        collectCppFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.cpp')) {
        const baseName = path.basename(entry.name, '.cpp');
        const id = `${problemName}/${baseName}`;
        solutionFiles.push({ id, filePath: fullPath });
      }
    }
  }

  collectCppFiles(dirPath);

  // Sort solution files deterministically by id
  solutionFiles.sort((a, b) => a.id.localeCompare(b.id));

  return {
    problemName,
    statement,
    constraints,
    solutionFiles,
  };
}

/**
 * Executes evaluation on the dataset and writes predictions.jsonl.
 */
export async function runCheckerCli(
  options: CheckerCliOptions
): Promise<CheckerCliResult> {
  const { datasetDir, outFile, modelOff } = options;

  if (modelOff) {
    process.env.MODEL_OFF = '1';
  }

  const problems = discoverProblems(datasetDir);
  const resolvedOutFile = path.resolve(outFile);

  // Ensure output directory exists
  const outDir = path.dirname(resolvedOutFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputStream = fs.createWriteStream(resolvedOutFile, {
    flags: 'w',
    encoding: 'utf8',
  });

  let processedSolutions = 0;
  let totalPredictions = 0;

  for (const problem of problems) {
    for (const sol of problem.solutionFiles) {
      processedSolutions++;
      const sourceCode = fs.readFileSync(sol.filePath, 'utf8');

      const verdicts = await evaluateSubmissionWithEngine({
        statement: problem.statement,
        sourceCode,
        constraints: problem.constraints,
      });

      const verdictMap = new Map(verdicts.map((v) => [v.constraintId, v]));

      for (const constraint of problem.constraints) {
        totalPredictions++;
        const v = verdictMap.get(constraint.id);
        const record: PredictionRecord = {
          solution: sol.id,
          constraint: constraint.id,
          verdict: v ? v.verdict : 'unsure',
          evidence: v ? v.evidence : [],
        };

        outputStream.write(JSON.stringify(record) + '\n');
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    outputStream.end((err?: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return {
    processedProblems: problems.length,
    processedSolutions,
    totalPredictions,
    outFile: resolvedOutFile,
  };
}

// Direct CLI execution guard
const isDirectEntry =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectEntry) {
  const args = process.argv.slice(2);
  try {
    const opts = parseCliArgs(args);
    const result = await runCheckerCli(opts);
    console.log(
      `[Checker CLI] Successfully generated ${result.totalPredictions} predictions across ${result.processedSolutions} solution(s) to ${result.outFile}`
    );
    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Checker CLI Error] ${message}`);
    process.exit(1);
  }
}
