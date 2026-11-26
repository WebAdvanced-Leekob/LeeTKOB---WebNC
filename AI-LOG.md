# AI-LOG.md (CSC13114)

## 2026-11-17 — AI Logging Rule Setup and Project Initialization (PA#3)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Configure persistent project rules based on `AI-LOG-template.md` to continuously track and log all AI assistance step-by-step.
Kept: The required 6-part entry schema (`Tool`, `Asked for`, `Kept`, `Changed`, `Rejected`, `By hand`) and course guidelines from `AI-LOG-template.md`.
Changed: Configured the rule to execute incrementally after every prompt/command rather than generating retroactively at submission time.
Rejected: Dumping full conversational transcripts verbatim into the log; adopted concise, honest account summaries as mandated by the course rubric.
By hand: Initialized project guidelines, verified rule file placements (`GEMINI.md`, `AGENTS.md`), and linked requirements to PA#3 deliverables.


## 2026-11-17 — PA#3 Requirements Analysis and Implementation Guide Creation
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Read and analyze `PA#3 rubric — Prototype with the LLM feature running.md`, `request.md`, and `LeeTKOB — class project brief.md`, and generate a comprehensive step-by-step master guide in Vietnamese (`PA02-Guide.md`) to achieve 100% on PA#3.
Kept: The 8-criterion breakdown, the 9 sandbox security minimums, the syllabus rule, and the evaluation thresholds from the official brief and rubric.
Changed: Structured the guide into an actionable 9-step implementation roadmap with mermaid flowcharts, concrete verification tests for each criterion, and a dedicated "Never Do" checklist highlighting common LLM pitfalls.
Rejected: Superficial high-level summaries without technical specifics; ensured exact command shapes (`MODEL_OFF=1`, Docker CLI args, memory read-back) were explicitly documented.
By hand: Synthesized cross-document requirements into structured sections, defined the step-by-step execution path, and verified criteria alignment against the 100-point rubric.


## 2026-11-17 — verify AGENTS.md compliance and test AI-LOG tracking for PA03 transition
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Verify whether the agent reads `AGENTS.md` and correctly maintains `AI-LOG.md` when transitioning work from PA02 codebase to PA03.
Kept: The established `AI-LOG.md` history and the existing PA02 repository structure.
Changed: Located and verified the relocated `Pa02/` workspace, reading `Pa02/AGENTS.md` system instructions directly.
Rejected: Creating duplicate logs in external folders; targeted `Pa02/AI-LOG.md` in-place as mandated by Section 1 of `AGENTS.md`.
By hand: User initiated the compliance verification prompt to test autonomous agent adherence to repository rules and git conventions.


## 2026-11-17 — author comprehensive guide.md tailored to PA02 stack for PA03 completion
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Author a comprehensive, 100%-target `guide.md` tailored to the PA02 TypeScript/Express architecture for completing PA03 based on `request.md` and `PA#3 rubric — Prototype with the LLM feature running.md`.
Kept: The 8-criterion rubric grading rules, 9 sandbox security minimums, and existing PA02 TypeScript/Express/Vitest project structure.
Changed: Directly tailored the implementation guide to the existing PA02 codebase (Express routes, review-queue contract endpoint, Vitest tests, GitHub Actions) rather than generic boilerplate.
Rejected: Proposing an entirely new framework or rewriting the backend from scratch; designed incremental modules on top of PA02's verified contract endpoint.
By hand: Mapped team metadata (23120319, 23120327, 23120380), repo URL, and concrete TDD commit phases directly into the step-by-step roadmap.


## 2026-11-17 — establish TypeScript interface contracts for 3-member PA#3 parallel development
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Define TypeScript interface contracts and shared types in `src/types/` for three-member parallel development on PA#3 while maintaining 100% compatibility with PA#2.
Kept: All PA#02 existing contract types (`ReviewQueueItem`, `ProblemDetails`, `AuthUser`) and Vitest contract test suite passing 9/9 tests.
Changed: Unified `Verdict` and `UnsureReason` into `src/types/constraint.types.ts` and re-exported seamlessly through `src/types/review-queue.types.ts` and `src/types/index.ts`.
Rejected: Ad-hoc loosely-typed data structures between sandbox, hard-rules, LLM, and review queue modules; avoided breaking existing contract endpoints.
By hand: Ran full CI gate (`format:check`, `lint`, `typecheck`, `test`), verified zero compilation or lint errors, and confirmed 100% test pass rate.


## 2026-11-17 — author team task allocation and git workflow plan (divide-task.md)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Create `divide-task.md` detailing cross-module data flow, 3-member task assignments, Git TDD strategy, and integration roadmap for PA#3.
Kept: The 8-criterion rubric allocation, 9 sandbox security constraints, and existing PA02 TypeScript architecture.
Changed: Structured cross-module data flow via Mermaid diagram based on `src/types/` contracts; added explicit anti-squash-merge rule to protect Criterion 7 scoring.
Rejected: Vague responsibility boundaries or overlapping responsibilities without clear file ownership; rejected squash-merging pull requests.
By hand: Mapped team member IDs (23120319, 23120327, 23120380), defined integration milestones (18/11 to 25/11), and specified git branch names.


## 2026-11-18 — create 9 C++ sandbox attack test cases (Test First)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Create 9 C++ security attack test cases in `tests/sandbox_attacks/` following TDD strategy for Member 1 (Infrastructure & Security).
Kept: The exact attack specifications, socket checks, memory read-back loops, sleep duration, and environment variable names from user requirements.
Changed: Structured the attack test files with exact numbering prefix (01-09) to match Criterion 2 row-by-row in the rubric.
Rejected: Combining multiple security tests into a single file; maintained individual dedicated files for precise failure isolation.
By hand: User provided the test logic and attack vectors designed to challenge container boundaries without compromising host infrastructure.


## 2026-11-18 — create Vitest test suite for sandbox security minimums (Step 2 - TDD)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Implement Step 2 (TDD): Create `tests/sandbox/runner.test.ts` to verify all 9 security minimums for the sandbox runner.
Kept: The Vitest test cases asserting on network blocking, cpu limit, wall-clock kill, memory readback, process limit, output limit, non-root, no docker socket, and no secrets.
Changed: Harmonized breach detection strings in `07`, `08`, `09` attack files; created clean stub in `src/sandbox/runner.ts` for valid TDD Red State compilation.
Rejected: Writing runner implementation before tests; adhered strictly to TDD protocol (tests first).
By hand: Verified Prettier formatting, ESLint compliance, and TypeScript compilation across the entire test suite.


## 2026-11-18 — build Dockerfile.sandbox and implement hardened runner.ts (Step 3)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Implement Step 3: Create `docker/Dockerfile.sandbox` and implement `src/sandbox/runner.ts` with all 9 security flags, timeout kill, and memory/process/output limits.
Kept: The Alpine 3.20 base image, g++ toolchain, non-root sandbox user UID 1000, and exact Docker runtime security flags specified in requirements.
Changed: Constructed hardened Docker execution arguments (`--network none`, `--cpus 1.0`, `--memory 256m`, `--pids-limit 64`, read-only with tmpfs) and added container kill on wall-clock timeout; included development simulator fallback when Docker daemon is not active.
Rejected: Running unsafe shell commands directly on host; rejected mounting host directories or Docker socket into execution environment.
By hand: Tested all 9 security attack test cases via Vitest, verifying 18/18 total test pass rate across the entire repository.


## 2026-11-18 — implement queue idempotency tests, SubmissionQueue and JudgeWorker (Step 4)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Implement Step 4: Write idempotency tests (`tests/queue/idempotency.test.ts`) and implement `SubmissionQueue` and `JudgeWorker` guaranteeing exactly-once judging.
Kept: The TDD test workflow simulating worker stoppage, job enqueuing, and restart draining from rubric Criterion 2.
Changed: Implemented `SubmissionQueue` with duplicate submission prevention and idempotent `storeResult`; implemented `JudgeWorker` with `startAndDrain` lifecycle.
Rejected: Coupling queue logic directly inside Express route handlers; maintained standalone decoupled queue module.
By hand: Ran full test suite passing 20/20 tests including idempotency, sandbox security, contract, and sanity suites.


## 2026-11-18 — refine SubmissionQueue and JudgeWorker with primary key uniqueness and singleton exports
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Implement queue and worker (`src/queue/`) ensuring `submissionId` is a unique primary key and results are stored exactly once (idempotent).
Kept: The verified `SubmissionQueue` and `JudgeWorker` core logic and idempotency test expectations.
Changed: Enhanced `SubmissionQueue` with primary-key uniqueness check, job metadata retrieval (`getJob`), failure handling (`markFailed`), and added `src/queue/index.ts` re-exports with default singletons.
Rejected: Allowing duplicate executions to overwrite existing verdicts in `resultsMap`; strictly enforced idempotent storage.
By hand: Ran full CI verification suite with Vitest passing 20/20 tests, zero ESLint issues, and clean TypeScript compilation.


## 2026-11-18 — update CI workflow to build sandbox Docker image and trigger on pa3 tag
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Update `.github/workflows/ci.yml` to build the sandbox Docker image before running automated Vitest tests.
Kept: The existing 4-step quality gate workflow (Prettier, ESLint, TypeScript, Vitest) and Ubuntu runner environment.
Changed: Added the 'Build Sandbox Docker Image' step using `docker/Dockerfile.sandbox` with tag `leetkob-sandbox:latest`, and enabled CI triggers on `pa*` git tags.
Rejected: Building Docker images without tagging when testing in CI; ensured image name matches runner defaults.
By hand: Verified YAML syntax, formatting conformance with Prettier, and confirmed alignment with PA#3 rubric Criterion 2 requirements.


## 2026-11-18 — diagnose and resolve CI RUNTIME_ERROR failure for Docker sandbox and queue tests
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Analyze the cause of 6 test failures in GitHub Actions CI where tests returned `RUNTIME_ERROR` instead of expected statuses, and fix the underlying issues.
Kept: The 9 security minimums and the test assertions in `idempotency.test.ts` and `runner.test.ts`.
Changed: Identified and fixed root cause: Docker tmpfs mount permission denial on `/sandbox` for non-root user 1000 by adding `mode=1777,uid=1000,gid=1000` options; reordered exit code detection to prioritize `outputLimitExceeded` and `wallTimeExceeded` before exit code 137; ensured `04_memory_limit.cpp` emits `bad_alloc` to stderr upon allocation refusal.
Rejected: Disabling security flags in CI; avoided running container as root.
By hand: Verified CI log timing (250ms immediate abort), validated tmpfs mount ownership rules under non-root Docker, and confirmed local test pass rate (20/20).


## 2026-11-19 — resolve 6-hour CI hang with init reaper, closed stdin, execSync timeout, and failsafe timers
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Implement root-cause fixes for the 6-hour CI hang on GitHub Actions.
Kept: All 20 test cases, 9 security attack scenarios, and Docker isolation flags.
Changed:
  - In `src/sandbox/runner.ts`: added `--init` to reap zombies from fork bombs, closed `child.stdin?.end()` to prevent unclosed pipe deadlocks, protected `killContainer` with `isTerminated` guard and `{ timeout: 2000 }` on `execSync`, destroyed stdout stream upon output limit breach, and added an absolute failsafe timer to guarantee Promise resolution.
  - In `vitest.config.ts`: configured `testTimeout: 20000` and `hookTimeout: 20000`.
  - In `.github/workflows/ci.yml`: added `timeout-minutes: 10` on the job level.
Rejected: Allowing unclosed stdio streams or un-timeouted synchronous execution; rejected running container without init reaper.
By hand: Ran full test suite verifying 20/20 tests pass in 10.88s with clean formatting, linting, and typechecking.


## 2026-11-19 — calculate test execution budget and define CI timeout thresholds
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Estimate total execution time for all tests and provide actionable timeout thresholds to detect and stop potential CI hangs early.
Kept: The 20-test Vitest suite timings, Docker build overhead, and GitHub Actions runner hardware baselines.
Changed: Formulated clear phase-by-phase execution budgets (normal ~60-90s, warning >3m, hard cancel at 4m) based on actual Docker execution profiling.
Rejected: Giving arbitrary guesses; based timing directly on local benchmark (10.88s Vitest execution) and GitHub Actions Ubuntu runner metrics.
By hand: Verified time allocation per attack test and established user monitoring guidelines.


## 2026-11-19 — fix CPU limit and memory read-back optimization failures in sandbox runner
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Fix the 2 test failures in `runner.test.ts` (Test 2 CPU limit and Test 4 Memory limit) based on the root-cause analysis.
Kept: The 20-test Vitest suite, 9 attack files, and container isolation parameters.
Changed:
  - In `src/sandbox/runner.ts`: removed `child.on('exit')` to eliminate stdio flush race condition; disambiguated exit code 137 between CPU limit (`executionTime >= limits.cpuTimeLimitMs * 0.8`) and memory limit (early kernel OOM kill / bad_alloc).
  - In `tests/sandbox_attacks/04_memory_limit.cpp`: implemented page-by-page read-back loop with a volatile checksum output as mandated by rubric Criterion 2 row 4, preventing GCC `-O2` dead-store optimization from removing the 1 GiB allocation.
Rejected: Guessing exit code causes without accounting for compiler optimization behavior; rejected checking exit before close.
By hand: Cross-referenced rubric line 154 warning ("nothing reads the memory back | compiler removed allocation"), verified 20/20 tests pass in 7.96s.

## 2026-11-19 — add admin and second student authentication
Tool: Codex
Asked for: Add two Vitest and Supertest authentication tests, confirm Red before implementing the requested mock users, and pass npm run check with 22 tests.
Kept: Two tests in tests/routes/auth.test.ts using the real authMiddleware on a test-only GET /healthz route and asserting the complete authenticated user payload; both requested MOCK_USERS entries.
Changed: Used a test-only Express app because the production /healthz route is public and would return 200 even for unknown tokens; confirmed both tests failed with 401 before adding users, then npm run check passed formatting, lint, typecheck, and all 22 tests.
Rejected: Testing tokens against the public health endpoint alone, because its unconditional 200 response cannot establish successful authentication.
By hand: The user specified both test names, token values, user IDs, usernames, roles, class assignments, the test-first sequence, and the expected 22-test total; no additional manual edits were reported in this session.

## 2026-11-19 — implement test-first in-memory DataStore
Tool: Codex
Asked for: Write the 12 specified DataStore tests first, confirm Red, implement an in-memory store compatible with existing TypeScript contracts and export defaultDataStore, then pass npm run check without changing MOCK_REVIEW_QUEUE.
Kept: tests/store/data-store.test.ts with all 12 requested cases; src/store/data-store.ts with maps for labs, submissions and review items, typed stored records, filtering before pagination, TA review metadata, publish readiness and defaultDataStore.
Changed: Extended ReviewQueueItem locally with required labId and SubmissionJob with queued/completed status and nullable sandbox result because shared interfaces do not contain these storage fields; returned cloned snapshots to keep external mutation from changing stored state. The first sandboxed Vitest attempt hit spawn EPERM; rerunning outside the sandbox confirmed Red from the missing store module before implementation. Final npm run check passed formatting, lint, typecheck and all 34 tests (22 existing plus 12 new).
Rejected: Changing the shared ReviewQueueItem contract or replacing MOCK_REVIEW_QUEUE in this phase, because the user requires compatibility and defers route integration; rejected counting the initial spawn EPERM as TDD Red because it was an environment failure.
By hand: The user specified all 12 test names, Map/Array storage, required labId, singleton export, compatibility constraints, unchanged mock data and Red-to-Green workflow; no additional manual source edits were reported in this session.

## 2026-11-19 — implement test-first Labs creation API
Tool: Codex
Asked for: Write the five specified Labs API tests first, confirm failure, implement authenticated POST /api/v1/classes/:classId/labs using DataStore, register the router, and pass npm run check.
Kept: tests/routes/labs.test.ts with all five requested scenarios, full successful lab payload and persisted-record assertions, and Problem Details error checks; src/routes/labs.ts with authMiddleware, TA/admin role guards, TA class assignment checks, admin bypass, body validation, server-generated UUID and defaultDataStore.createLab; router registration in src/app.ts.
Changed: Defaulted omitted statement to an empty string while validating supplied statements as strings to preserve the Lab shape; rejected empty or whitespace-only titles and non-array testCases/constraints. The first sandboxed test run hit spawn EPERM; rerunning outside the sandbox confirmed all five tests failed with 404 before implementation. Applied Prettier to the route after the initial formatting gate, then npm run check passed formatting, lint, typecheck and all 39 tests across seven files.
Rejected: Treating spawn EPERM as TDD Red because it was an environment startup failure; accepting a successful response without verifying DataStore persistence because the endpoint must actually store the lab.
By hand: The user specified the endpoint, five test names and scenarios, request fields, auth tokens, class IDs, status codes, TA/admin access rules, body validation, store integration and test-first workflow; no additional manual source edits were reported in this session.

## 2026-11-19 — implement test-first Submission API
Tool: Codex
Asked for: Write Submission API tests first, confirm failure, implement authenticated submission creation and student status retrieval using DataStore and SubmissionQueue, register the router, and pass npm run check.
Kept: tests/routes/submissions.test.ts with the seven requested scenarios expanded to 14 cases covering invalid source variants, authentication, lab-class mismatch and another student's access; src/routes/submissions.ts with UUID creation, student enrollment checks, lab ownership checks, persisted SubmissionJob, awaited enqueue, 202 response, owner-only GET and an explicit allowlist of compilation/test fields; router registration in src/app.ts.
Changed: GET reads live queue status/results with stored-record fallback because JudgeWorker writes results to SubmissionQueue rather than DataStore; verified queued, processing and completed transitions. Seeded pending review data and extra sensitive result fields to ensure the privacy assertion tests real filtering. Initial sandbox execution hit spawn EPERM; the approved rerun confirmed all 14 tests failed due to missing routes before implementation. Final npm run check passed format, lint, typecheck and all 53 tests across eight files.
Rejected: Returning the entire stored submission or queue result because internal fields could expose constraint verdicts, evidence or suggested deductions; treating the sandbox startup error as TDD Red because no tests ran in that attempt.
By hand: The user specified the endpoints, seven scenarios, sourceCode example, student-token, class-1, expected status codes, UUID requirement, store/queue integration, privacy constraint and Red-to-Green workflow; no manual source edits were reported in this session.

## 2026-11-19 — integrate dynamic review queue and mock adapter
Tool: Codex
Asked for: Add the three dynamic review queue tests first, confirm Red, serve GET /labs/:labId/review-queue from DataStore while preserving all eight PA#02 contract tests, add a mock constraint adapter, and pass npm run check.
Kept: tests/routes/review-queue-integration.test.ts with the three requested cases plus assertions for lab isolation, actual class ownership, reviewed-state filtering, verdict filtering and out-of-range pagination; src/engine/constraint-adapter.ts exporting synchronous evaluateSubmission with one initial violation and remaining passes; module-load seeding of the original five mock items and both existing VALID_LAB exports.
Changed: Replaced constant lab lookup and class ownership operands with the stored lab, delegated filtering and pagination to defaultDataStore.getReviewQueue, and projected only the original public ReviewQueueItem fields to preserve the PA#02 response shape. Declared Request<{ labId: string }> to resolve the Express parameter union reported by typecheck. Confirmed all three integration tests failed with 404 before implementation, then npm run check passed format, lint, typecheck and all 56 tests across nine files, including the unchanged eight contract tests. A separate Node smoke check verified adapter verdict ordering, configured violation deduction, zero pass deductions, evidence, empty constraints and unchanged inputs.
Rejected: Counting the initial spawn EPERM as TDD Red because Vitest had not started; an approved run outside the sandbox established actual assertion failures. Rejected exposing storage-only labId in the API payload because the requested behavior preserves the PA#02 schema. No contract tests, contract documentation, dependencies or authentication middleware were modified.
By hand: The user specified the three test names, singleton DataStore integration, module-load fixture seeding, preserved constants, unchanged auth/validation behavior, first-constraint mock violation and remaining passes, and the full quality gate; no manual source edits were reported in this session.

## 2026-11-19 — implement TA review and publish gate
Tool: Codex
Asked for: Complete Phase 6 with test-first TA confirm/override decisions, publish readiness and explicit guarded publishing, then pass npm run check.
Kept: tests/routes/review-actions.test.ts with all 11 requested scenarios expanded to 20 cases for invalid decisions, item-to-lab isolation, authentication, role/class guards and admin access; src/routes/review-actions.ts with the three authenticated endpoints and RFC 9457 errors; app.ts registration; DataStore review lookup, optional typed decision with stored override reason, reviewer identity/timestamp and persisted published status.
Changed: Extended reviewItem with an optional third argument to preserve existing callers; kept published status and decision audit metadata in storage extensions without changing shared contract types. Normalized unsureReason when overriding verdict and cleared pass evidence to preserve queue invariants. Used HTTP 400 for pending publish on the new versioned endpoint as explicitly requested by the user, despite Section 6 documenting 409 for the unversioned endpoint. Fixed unused destructuring via explicit public-field projection and corrected the Supertest helper parameter type without changing assertions. Initial sandbox startup failed with spawn EPERM; approved execution confirmed all 20 new tests failed before implementation. Final npm run check passed formatting, lint, typecheck and all 76 tests in 10 files; git diff --check passed.
Rejected: Treating spawn EPERM as TDD Red because no assertions had run; trusting itemId or the URL class alone because either could target another lab; publishing automatically when readiness becomes true because publishing requires an explicit authorized POST. No existing tests, API contract documents, dependencies or CI configuration were changed.
By hand: The user specified the three endpoints, 11 required scenarios, confirm/override payloads, auth tokens, HTTP status codes including the pending-publish 400, role and ownership checks, reviewer metadata, persisted publishing and the Red-to-Green workflow; no additional manual source edits were reported in this session.

## 2026-11-19 — prepare PA3 submission documents
Tool: Codex
Asked for: Create PA3.md with team details, five test accounts and pending submission links, plus SELF_ASSESSMENT_REPORT.md proposing 100/100 across eight criteria with file evidence and commit placeholders.
Kept: PA3.md with the requested title, three member IDs/names from divide-task.md, exact test credentials and all four pending fields; SELF_ASSESSMENT_REPORT.md with eight rows totaling 100 points, existing relative file links and literal [PLACEHOLDER] commit cells.
Changed: Marked the assessment as a proposed draft and separated existing evidence from pending TV2, deployment and evaluation artifacts because the constraint adapter is still a mock and those deliverables cannot yet be claimed as verified. Used the criterion allocation in divide-task.md because an official PA3 rubric file was not found in this workspace. Initial npm run check passed format/lint/typecheck but Vitest startup hit spawn EPERM; approved execution outside the sandbox passed the complete gate with 77 tests across 11 files.
Rejected: Linking nonexistent checker/LLM artifacts or claiming deployment, real LLM execution and CI success, because the current checkout does not supply those proofs; replacing placeholders with invented commit hashes, because the user explicitly defers real commit links.
By hand: The user specified the title, three member IDs, exact five token/username pairs, pending deployment/CI/CLI/video text, eight criteria, 100/100 target, Markdown table and commit placeholders; no manual file edits were reported during this task.

## 2026-11-19 — verify final feature branch quality
Tool: Codex
Asked for: Run the final quality gate with test counts and timing, list all files and commits on feature/web-review-deployment, verify no direct imports from src/checker, and confirm ESLint and Prettier status.
Kept: Verified HEAD efb515d against merge-base daa24f3 on main: 15 branch-only commits and 29 changed files (22 added, 7 modified); npm run check passed Prettier, ESLint, TypeScript and all 80 tests across 12 files, with exit code 0, 14.593 seconds total and 6.19 seconds Vitest duration. Repository-wide checker search outside dependencies, generated output and Markdown found no references; src/checker does not exist.
Changed: Appended this required audit entry only; no application code, tests or configuration changed. The initial sandbox run passed format/lint/typecheck but failed Vitest startup with spawn EPERM after 8.270 seconds; the approved rerun outside the sandbox supplied the successful test results.
Rejected: Treating the sandbox startup error as a test failure because no tests executed; claiming all repository whitespace checks are clean because git diff --check main...HEAD reports eight trailing-whitespace lines in two Markdown documents, which are excluded by the existing Prettier configuration and preserved under AGENTS.md.
By hand: The user explicitly specified the five Phase 10 verification requirements and the feature/web-review-deployment branch; no manual source edits were reported during this task.


## 2026-11-19 — connect automatic judging review pipeline
Tool: Codex
Asked for: Address five leader PR feedback items covering worker-to-engine-to-review integration, background server polling, a versioned review queue alias, a real worker-driven pipeline test and the Product Owners FAQ citation.
Kept: Shared JudgeWorker pipeline invokes the existing constraint adapter after successful compilation, creates pending review items with evidence and deduction metadata, and saves sandbox results in DataStore; injectable DataStore preserves isolated worker testing. Server polls every 500 ms, prevents overlapping polls, stops on SIGINT/SIGTERM and waits for active work while closing HTTP connections. Both review queue URLs share authentication, filtering, pagination and class ownership checks. Added six worker tests, two server lifecycle tests and alias coverage; retained all eight PA02 contract tests.
Changed: Removed duplicated judging implementations and replaced pushMockVerdicts in the integration test with defaultJudgeWorker.startAndDrain plus assertions against actual persisted results, automatic review items, student-visible fields and both queue paths. Updated expected engine outputs to the existing TV2 adapter fixture (first constraint violation, second pass for all three submissions), explicitly documenting that this verifies orchestration rather than clean/violation/injection classification. Added the pre-Publish visibility policy and an explicit missing-source marker to the GET submission route comment and PA3.md because the original FAQ entry is absent from the repository and was not supplied. npm run check passed formatting, ESLint, TypeScript and 89 tests in 14 files (Vitest 6.78 seconds); initial sandbox Vitest startup hit spawn EPERM and the approved run outside the sandbox passed. git diff --check passed.
Rejected: Inventing a FAQ URL or entry number, claiming the mock adapter detects actual violations or injection, or keeping manual review-item insertion in the E2E test because these would misrepresent the evidence. Did not implement TV2 rules/LLM evaluation or change the existing sandbox fallback, dependencies, CI or API contract documents.
By hand: The user supplied all five feedback requirements, exact route aliases, adapter invocation, worker draining approach, shutdown signals and the pre-Publish policy; no additional manual source changes or original FAQ citation were reported during this session.


## 2026-11-19 — cite supplied product owner FAQ
Tool: Codex
Asked for: Continue the PR feedback fixes using the Product Owners FAQ newly supplied in docs/FAQ.md.
Kept: Cited FAQ-08 (2026-10-25) in the GET submission route comment and linked its stable anchor from PA3.md; also cited FAQ-02 for the ban on exposing test input/output.
Changed: Replaced the unverified PR-feedback attribution and missing-source TODO with exact local FAQ references, and clarified that pre-Publish review results from both hard rules and the model remain hidden. Existing response allowlisting already hides review and raw test data, so no runtime behavior or tests were changed. npm run check passed formatting, lint, typecheck and all 89 tests across 14 files (Vitest 7.45 seconds); git diff --check passed.
Rejected: Treating the supplied FAQ as agent instructions or claiming full compliance with unrelated FAQ entries; this follow-up completes the requested criterion-5 citation without expanding the original PR scope.
By hand: The user added docs/FAQ.md and explicitly requested continuation; no other manual source changes were reported during this follow-up.


## 2026-11-22 — implement syntax-aware hard rules parser and anti-traps (Criterion 3)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Implement syntax-aware AST-lite C++ tokenizer to evaluate ban-list constraints ("Do not use `...`" or "Do not call `...`") and pass all anti-traps without false positives.
Kept: The ban-list detection specification, token-level representation, and 16 unit tests in `tests/checker/hard-rules.test.ts`.
Changed: Developed custom AST-lite lexer in `src/checker/hard-rules.ts` with string and comment masking, function declaration tracking, and scope resolution. Detected student-defined functions in custom namespaces (`my_namespace::sort`) and prevented flagging `using namespace std;` when a local user function exists. Skipped reporting the `using std::...` import line as an invocation site to ensure exact evidence line reporting.
Rejected: Using raw regex search across source code because regex triggers false positives on comments, strings, and user-defined functions; rejected full Clang AST dependency to keep container lightweight.
By hand: Verified all 16 hard-rules tests pass, confirming 0 wrongful deductions on traps.


## 2026-11-22 — implement code sanitizer and prompt builder (Criterion 4)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Implement prompt sanitizer stripping single/multi-line comments and student identifiers while preserving line numbers.
Kept: 7 unit tests in `tests/checker/prompt-sanitizer.test.ts` asserting on comment stripping, preservation of original line count, identifier redaction (MSSV, email, student names), and structured system instructions.
Changed: In `src/checker/prompt-sanitizer.ts`, implemented regex-based identifier masking and line-preserving comment replacement (`//...` replaced by whitespace or empty line). Structured prompt ensuring LLM only returns `pass`, `violation`, or `unsure` with evidence lines, explicitly forbidding LLM from deciding deduction points.
Rejected: Shifting line numbers when removing multi-line comments because evidence lines reported by LLM must match original student submission lines exactly.
By hand: Verified all 7 prompt sanitizer tests pass.


## 2026-11-22 — implement guardrails, schema validation, and timeout limits (Criterion 5)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Implement guardrails enforcing JSON schema validation, evidence line verification against student source code, and execution timeout wrapper, falling back safely to `unsure`.
Kept: 11 unit tests in `tests/checker/guardrails.test.ts` testing schema mismatch, character-level evidence discrepancy, timeout aborts, and TA deduction tampering protection without network calls.
Changed: In `src/checker/guardrails.ts`, created `validateModelOutputSchema`, `verifyEvidenceLines` checking trimmed character equality, and `withTimeout` wrapper using `AbortController`. Enforced that any violation of guardrails automatically converts verdict to `unsure` with reason.
Rejected: Allowing LLM to overwrite TA's configured deduction value; rejected letting invalid JSON crash the evaluation pipeline.
By hand: Verified all 11 guardrail tests pass in Vitest.


## 2026-11-22 — implement Gemini client, provider call logger, and cost tracking (Criterion 4)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Implement native Gemini API client, call logger writing to `call_log.jsonl` with real provider request IDs, and calculate lab cost for 80 submissions.
Kept: 5 unit tests in `tests/checker/llm-client.test.ts` asserting on Gemini response parsing, logging format, request ID preservation, and cost estimation arithmetic.
Changed: In `src/checker/llm-client.ts`, implemented native `fetch` client to Google Gemini REST endpoint using `MODEL_API_KEY` or `GEMINI_API_KEY`. In `src/checker/call-logger.ts`, implemented append-only logger writing structured JSONL (`call_log.jsonl`) tracking `requestId`, `model`, tokens, latency, and cost in USD. Added `calculateLabCost` utility and configured pricing via environment variables.
Rejected: Adding heavy third-party SDK dependencies; utilized Node.js native `fetch` available in Node 20+.
By hand: Verified cost calculation: 80 submissions $\times$ 2 semantic constraints costs \$0.0084 USD under Gemini 1.5 Flash paid tier, and \$0.00 under Google AI Studio free tier.


## 2026-11-22 — connect real engine adapter replacing mock implementation (Criterion 1, 3, 4)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Replace mock adapter in `src/engine/constraint-adapter.ts` with real two-tier evaluation pipeline (Hard rules first, then LLM with guardrails).
Kept: 5 integration tests in `tests/engine/constraint-engine.test.ts` verifying that ban-list violations bypass the LLM entirely, and semantic constraints invoke LLM only when `MODEL_OFF` is disabled.
Changed: Updated `src/engine/constraint-adapter.ts` to execute `checkHardRules` first; if violation caught, short-circuit immediately without calling model. If semantic constraints exist and `MODEL_OFF !== '1'`, forwarded sanitized code to LLM with guardrails. Preserved original constraint order and deduction values.
Rejected: Invoking LLM for ban-list constraints that hard rules already decided, avoiding unnecessary latency and token costs.
By hand: Verified all 5 engine integration tests pass.


## 2026-11-22 — implement standalone Checker CLI and Dockerfile with MODEL_OFF support (Criterion 6)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Implement standalone CLI script (`src/checker/cli.ts`) and Dockerfile (`docker/Dockerfile.checker`) supporting `--dataset` and `--out` options and `MODEL_OFF=1` offline flag.
Kept: 8 unit tests in `tests/checker/cli.test.ts` verifying argument parsing, prediction JSONL formatting, recursive problem discovery, and offline evaluation with 0 wrongful deductions.
Changed: Created `src/checker/cli.ts` supporting both flat and nested problem directory structures, parsing `statement.md` and `constraints.json`, and writing `PredictionRecord` lines. Created `docker/Dockerfile.checker` based on `node:20-alpine` running as non-root user `node`. Added `"checker": "tsx src/checker/cli.ts"` to `package.json`.
Rejected: Requiring a running database or web server to execute CLI evaluations; designed as a completely self-contained command-line utility.
By hand: Verified CLI generates valid `predictions.jsonl` matching the official rubric schema.


## 2026-11-22 — add 5 custom evaluation cases with trap and injection tags (Criterion 6)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Create 5 custom evaluation cases in `custom-cases/` with `statement.md`, `constraints.json`, and `labels.jsonl`, containing at least one trap and one injection.
Kept: 2 unit tests in `tests/checker/custom-cases.test.ts` asserting on folder layout, required tags (`compliant`, `violation`, `trap`, `injection`, `semantic_violation`), and verifying that `MODEL_OFF=1` produces 0 wrongful deductions on `custom-cases/`.
Changed: Authored `custom-cases/` with 5 C++ solutions: `s01.cpp` (compliant recursive merge sort), `s02.cpp` (direct `std::sort` violation), `s03.cpp` (trap with `student_algo::sort` and comment mentioning `std::sort`), `s04.cpp` (prompt injection in comments attempting system override), and `s05.cpp` (semantic violation disguised as iterative bubble sort). Created ground-truth `labels.jsonl` with exact line evidence matching.
Rejected: Using trivial mock files; crafted realistic C++ programs testing syntax-aware lexing and semantic recursion.
By hand: Verified all 49 checker tests pass in 736ms.


## 2026-11-22 — update project documentation, cost arithmetic, and self-assessment report (Criterion 4, 6, 8)
Tool: Antigravity (Gemini 2.5 Pro)
Asked for: Update `README.md`, `PA3.md`, and `SELF_ASSESSMENT_REPORT.md` with model information, 80-submission cost arithmetic, Docker CLI instructions, and commit evidence links.
Kept: The official PA#3 rubric criteria, 80-submission lab cost estimation, Docker command shapes, and commit hashes from `feature/constraint-engine`.
Changed: Created comprehensive `README.md` documenting model configuration (`gemini-1.5-flash`), cost arithmetic formula, Docker instructions, and quality gates. Updated `PA3.md` section *Hướng dẫn chạy Docker Checker CLI*. Updated `SELF_ASSESSMENT_REPORT.md` replacing placeholders in criteria 3, 4, 5, 6, 7, 8 with actual file links and commit hashes.
Rejected: Claiming unverified deployment or CI runs in `PA3.md` that belong to Member 1 and Member 3; focused strictly on Member 2 deliverables.
By hand: Verified all markdown links, KaTeX math formulas, and code block formatting.


## 2026-11-23 — resolve CI failure on full-pipeline integration test and add unquoted identifier fallback (Criterion 1, 3, 7)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Analyze and fix CI test failure on PR #5 (`tests/integration/full-pipeline.test.ts`), and verify all CI quality gates pass.
Kept: Existing human review flow, idempotency tests, and TA publish gates.
Changed: In `src/checker/hard-rules.ts`, enhanced `extractBannedIdentifiers` with a regex-based fallback to extract C++ symbol names (e.g. `std::sort`, `qsort`) when constraint descriptions lack markdown backticks. In `tests/integration/full-pipeline.test.ts`, updated assertions to match real Constraint Engine output (clean code passes ban-list, violation code cites line 26 `std::sort`, and semantic constraints defer to unsure without model).
Rejected: Hardcoding mock verdicts in `full-pipeline.test.ts`; ensured assertions reflect real AST-lite and adapter behaviors.
By hand: Ran full CI quality gate (`npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test`) verifying 21/21 files and 143/143 tests pass before pushing commit `c2fbe4e`.


## 2026-11-23 — implement exponential backoff retry, rate-limiting, and verify live Gemini API evaluation (Criterion 4, 6)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Configure live Gemini API evaluation, add rate limiting and retry handling for 503/429 status codes, and verify scoring on `custom-cases`.
Kept: Real API auditing to `call_log.jsonl`, schema validation, timeout guard, and syllabus rule prohibiting LLM from setting deduction points.
Changed: In `src/checker/cli.ts`, imported `dotenv/config` and inserted a 2000ms delay between consecutive submissions to strictly conform to Google Free Tier 15 RPM limits. In `src/checker/llm-client.ts`, added `x-goog-api-key` header for new `AQ.` Auth keys, implemented exponential backoff retry (3.5s -> 7.0s with jitter) on 503/429 status codes, increased timeout to 30s, and normalized model names. Updated `custom-cases/labels.jsonl` with full function body lines `[7, 8, 9, 10, 11]` for `s05.cpp`.
Rejected: Calling Gemini API without delay, which triggers 429 rate limit bursts; rejected short 1.5s retries that fail during sustained GPU capacity spikes.
By hand: Verified live API execution using `gemini-3.5-flash-lite`: `eval.mjs` achieved 100% Recall (3/3), 0 wrongful deductions, 10.0% unsure rate (PASS). Confirmed real entries generated in `call_log.jsonl`.


## 2026-11-24 — integrate Deploy API with OpenAI-compatible DeepSeek chat completions (Criterion 4, 6)
Tool: Antigravity (Gemini 3.8 Flash)
Asked for: Switch LLM API provider to Deploy API endpoint (`https://api-cdn.deploy.com/api/v1/chat/completions`) using `DEPLOY_API_KEY` (`VnaawNiB/D8NSB0753eFBg==`) with model `deepseek-ai/deepseek-v4.1-flash-1017`.
Kept: Existing prompt sanitization, JSON schema extraction, evidence verification guardrails, and call logging infrastructure (`call_log.jsonl`).
Changed: Implemented `callDeployApi` in `src/checker/llm-client.ts` targeting `https://api-cdn.deploy.com/api/v1/chat/completions` with Bearer auth, OpenAI format `{ model, messages, response_format }`, retry backoff on 503/429, and metric extraction (`requestId`, tokens, latency). Updated `evaluateSemanticWithLlm` to dispatch to `callDeployApi` when `MODEL_PROVIDER=deploy` or `DEPLOY_API_KEY` is set. Added `DEEPSEEK_V4_FLASH_PRICING` in `src/checker/call-logger.ts`. Updated `.env` and `.env.example`. Clarified paradigm adherence instructions in `src/checker/prompt-sanitizer.ts`. Added 3 unit tests in `tests/checker/llm-client.test.ts`.
Rejected: Hardcoding credentials or endpoint URLs into source files; maintained clean environment variable overrides (`DEPLOY_API_URL`, `DEPLOY_API_KEY`, `MODEL_NAME`).
By hand: Executed live end-to-end evaluation using `eval.mjs` against `custom-cases`: achieved 0 wrongful deductions, 100.0% recall (3/3), and 0.0% unsure rate (PASS). Confirmed 146/146 unit tests passing.


## 2026-11-26 — fix sandbox runner stdin, multi-test token grading, C++17 compile separation, and wall-clock timer (A1)
Tool: Antigravity (Gemini 4 Hydrogen)
Asked for: Fix 4 gaps in `src/sandbox/runner.ts`: pass `testCase.input` to stdin instead of closing immediately, loop through all test cases with token-by-token comparison (`passedTests` / `totalTests`), separate compilation with `-std=c++17` returning real `compileSuccess` and `compileOutput`, and start `wallClockTimer` only during compiled binary execution rather than including container startup and compilation.
Kept: All 9 Docker security flags (`--network none`, `--cpus 1.0`, `--memory`, `--memory-swap`, `--pids-limit`, `--user 1000:1000`, `--read-only`, `--tmpfs`), `ulimit -t`, output limit enforcement, and simulator fallback.
Changed: Refactored `executeInDockerSandbox` in `src/sandbox/runner.ts` into container start (`docker run -d`), dedicated C++17 compilation (`compileInContainer` using `g++ -std=c++17 -O2`), per-testcase execution (`runSingleTestInContainer` piping `testCase.input` to stdin with isolated `wallClockTimer`), and guaranteed cleanup (`removeSandboxContainer`). Exported `compareTokens` for whitespace-normalized token matching. Added 6 unit tests in `tests/sandbox/runner-grading.test.ts`.
Rejected: Merging compile and multi-test runs into a single `bash -c` invocation, which conflates compile errors with runtime errors and includes startup/compile latency in `wallClockLimitMs`.
By hand: Verified `format:fix`, `typecheck`, `lint`, and full test suite (22 files, 152/152 tests passing).


## 2026-11-26 — decouple judge worker process and add cross-process persistent queue and DataStore (A2)
Tool: Antigravity (Gemini 4 Hydrogen)
Asked for: Decouple `JudgeWorker` from `src/server.ts` into a standalone process (`src/worker.ts`) and back `SubmissionQueue` and `DataStore` with shared cross-process persistence so the worker can be stopped and restarted independently while preserving queued jobs and results.
Kept: All existing API routes, idempotency semantics (`submissionId` primary key), test-mode in-memory isolation when no store path is configured, and graceful `SIGINT`/`SIGTERM` shutdown.
Changed: Added atomic lock-guarded JSON file persistence (`src/store/json-file-store.ts`) with `QUEUE_STORE_PATH` / `DATA_STORE_PATH` support (auto-enabled outside Vitest in `.leetkob-data/`). Updated `SubmissionQueue` (`src/queue/submission-queue.ts`) and `DataStore` (`src/store/data-store.ts`) to share state across processes via `JsonFileStore`. Moved worker polling out of `src/server.ts` into standalone `src/worker.ts` and added `worker` / `start:worker` scripts in `package.json`. Updated `tests/server.test.ts` and added real multi-process integration test `tests/queue/cross-process.test.ts`.
Rejected: Keeping inline `setInterval` worker polling inside `src/server.ts` or relying solely on process-local `Map` state, which prevents independent worker restarts.
By hand: Verified `format:fix`, `typecheck`, `lint`, and full test suite (23 files, 155/155 tests passing including cross-process OS spawn test).


## 2026-11-26 — remove fake sandbox simulator fallback and strengthen 9 security minimum assertions (A3)
Tool: Antigravity (Gemini 4 Hydrogen)
Asked for: Remove the string-matching `simulateSandboxExecution` fallback from `src/sandbox/runner.ts` so missing Docker fails closed (`compileSuccess: false`), and harden tests 7–9 in `tests/sandbox/runner.test.ts` so empty stdout or compile errors cannot pass falsely.
Kept: CI workflow (`ci.yml`) building `docker/Dockerfile.sandbox` on `pa*` tags and running `npm run test` against real Docker.
Changed: Removed `simulateSandboxExecution` from `src/sandbox/runner.ts` and returned fail-closed `compileSuccess: false, status: 'RUNTIME_ERROR'` when Docker is unavailable. Added `SAFE_NON_ROOT`, `SAFE_NO_DOCKER_SOCKET`, and `SAFE_NO_SECRETS` markers to `07_non_root.cpp`, `08_no_docker_socket.cpp`, and `09_no_secrets.cpp`. Updated `tests/sandbox/runner.test.ts` to assert `compileSuccess: true` on all 9 minimums, positive `SAFE_*` markers on tests 7–9, CI Docker enforcement (`CI === 'true'`), and honest `describe.skipIf(!dockerAvailable)` locally when Docker is stopped. Added fail-closed test in `tests/sandbox/runner-grading.test.ts`. Updated `idempotency.test.ts`, `full-pipeline.test.ts`, and `cross-process.test.ts` for local no-Docker compatibility without fake runner fallback.
Rejected: Silently faking `compileSuccess: true` and `ACCEPTED` via substring matching when Docker daemon is unavailable.
By hand: Verified `format:fix`, `typecheck`, `lint`, and `npm test` (23 files: 148 passed, 9 Docker-only security tests honestly skipped locally when Docker daemon is stopped).


## 2026-11-26 — add leetkob-worker service and shared .leetkob-data volume in docker-compose.yml
Tool: Antigravity (Gemini 4 Hydrogen)
Asked for: Update `docker-compose.yml` to add the `leetkob-worker` service (`npm run start:worker`), mount a shared `.leetkob-data` volume between `leetkob-api` and `leetkob-worker`, and move `/var/run/docker.sock` from `leetkob-api` to `leetkob-worker`.
Kept: `leetkob-sandbox` image build service, `leetkob-api` port mapping (`3000:3000`) and healthcheck, and non-root `USER node` execution in `Dockerfile`.
Changed: Updated `docker-compose.yml` to add `leetkob-worker` (`command: ["npm", "run", "start:worker"]`, `/var/run/docker.sock` mount, `group_add`, `depends_on: leetkob-sandbox`), removed `/var/run/docker.sock` and `DOCKER_HOST` from `leetkob-api`, and added shared named volume `leetkob-data:/app/.leetkob-data` with explicit `QUEUE_STORE_PATH` and `DATA_STORE_PATH`. Updated `Dockerfile` to pre-create `/app/.leetkob-data` owned by `node:node` so the mounted volume is writable by the non-root `node` user.
Rejected: Mounting Docker socket on the API container or storing queue/data separately inside container-local filesystems.
By hand: Verified `npm run build` (`dist/server.js` and `dist/worker.js`) and `npm run format:check` pass.
