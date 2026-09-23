# Agent Lab Core Implementation Plan

> **For agentic workers:** Use executing-plans inline. Steps use checkbox syntax.

**Goal:** Deliver a repeatable local skill comparison with independently verified results.

**Architecture:** A bundled task is copied into clean attempt workspaces. A thin
Codex subprocess adapter captures events; an independent grader checks the edited
module. JSON and Markdown reports are consumed without a website.

**Tech Stack:** Node.js 22+, ES modules, node:test, Codex CLI, GitHub Actions.

**Spec:** ../specs/2026-09-23-agent-lab-core.md

## Global Constraints

- Node.js 22+, no runtime package dependencies.
- English public artifacts; raw local runs and credentials are untracked.
- One task and one agent; no frontend or external service provisioning.
- Never equate a successful process exit or agent message with a correct fix.
- Same model/settings/task for both conditions; clean workspace per attempt.

## Task 1: Task and independent verdict

Files: tasks/duplicate-events/{TASK.md,workspace/src/inbox.mjs,workspace/smoke.test.mjs,
oracle/inbox.mjs,verifier.mjs,skill/SKILL.md}, src/verify.mjs, tests/verify.test.mjs.

Interface: `verifyCandidate(candidatePath, {timeoutMs})` returns
`{status, passed, total, checks}` with a finite duration and no secret environment.

- [x] Write behavior tests: original has fewer than all checks passing; the known
  repair passes every check; missing/malformed module returns verification_error.
- [x] Run `node --test tests/verify.test.mjs` and observe the missing behavior.
- [x] Implement fresh verification directories and a bounded verifier subprocess.
- [x] Run that test file and `node bin/agent-lab.mjs self-check`.

The key acceptance assertion is `assert.equal(oracle.status, 'passed')` paired
with `assert.equal(original.status, 'failed')`. Corrupting the implementation or
failing to execute the checks must break at least one assertion.

## Task 2: Trace and honest report

Files: src/trace.mjs, src/report.mjs, tests/trace.test.mjs, tests/report.test.mjs.

Interfaces: `parseTrace(text)` returns completion, failure and nullable usage;
`summarize(experiment)` returns per-condition counts; `renderMarkdown(experiment)`
renders that data without ranking or inferring API charges.

- [x] Test actual Codex event shapes: completed turn, failed turn, missing usage,
  malformed JSON, command failure and skill-read evidence.
- [x] Run the tests with minimal stubs and observe failed assertions.
- [x] Implement parsing and aggregation, preserving nulls and error categories.
- [x] Test that model/task/settings fingerprint mismatches reject aggregation,
  and failed attempts stay in the attempted-run denominator.

## Task 3: Runner, CLI and release

Files: src/{process,runner}.mjs, bin/agent-lab.mjs, tests/{runner,cli}.test.mjs,
README.md, .gitignore, LICENSE, package.json, .github/workflows/test.yml.

Interface: `runExperiment({outputDir, model, reasoning, repeats, timeoutMs})`
creates a new directory exclusively and writes experiment.json and report.md.
The subprocess boundary accepts a command and arguments without a shell.

- [x] Test with a local executable double that changes a real task file: the
  verifier, workspace copying, trace capture and aggregation remain real.
- [x] Test timeout, crash, malformed trace, output collision and fresh copies.
- [x] Implement the Codex command with workspace-write sandbox, explicit model,
  ephemeral JSONL output and ignore-user-config; feed prompts through stdin.
- [x] Implement doctor/self-check/run/report CLI and argument validation.
- [x] Run all tests, offline self-check, then one live pair with the existing login.
- [x] Inspect the publishable file list for raw runs, credentials and local paths.
- [ ] Commit verified English source and documentation; publish the scoped repo.

## Verification record

The offline suite passes 23 tests. The original task passes 3/7 independent checks
and the reference repair passes 7/7. Review findings about custom-output Git
ignores, incomplete token usage, and descendant-process termination were fixed
with regression tests.

Both live pilot attempts encountered a local tool-execution policy denial before
reading the task. They are classified as `execution_blocked`, not graded failures.
Their original manifests and traces are retained locally; a valid live comparison
remains unverified. No permissions were changed to bypass this denial.

Representative commands:

```sh
node --test tests/verify.test.mjs tests/trace.test.mjs tests/report.test.mjs tests/runner.test.mjs tests/cli.test.mjs
node bin/agent-lab.mjs self-check
node bin/agent-lab.mjs run --model MODEL_ID --repeats 1 --out runs/pilot
node bin/agent-lab.mjs report runs/pilot/experiment.json
```
