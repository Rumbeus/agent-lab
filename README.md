# Agent Lab

A small local tool for comparing a coding agent with and without an additional
debugging skill. It saves the code, execution trace, independent check results,
elapsed time, and reported token usage for each attempt.

**Status: experimental core.** Offline checks and runner integration tests work.
The first live pilot on the development host was blocked by local tool-execution
policy before the agent could read the task. There is no valid live comparison
result yet. A successful process exit alone is never counted as a successful fix.

No website is needed to run the experiment. Results are local JSON and Markdown
files that a future interface can read.

## Try it without a model

Requires Node.js 22 or later. There are no package dependencies to install.

```sh
git clone https://github.com/Rumbeus/agent-lab.git
cd agent-lab
npm test
node bin/agent-lab.mjs self-check
```

These commands are offline and do not need a Codex login or API key. The bundled
broken implementation should pass **3 of 7** checks; the reference repair should
pass **7 of 7**. This validates the task and verifier, not the ability of a model
to repair it.

## Run a live pair

Install and authenticate the [Codex CLI](https://developers.openai.com/codex/cli/)
separately. Then check the local setup:

```sh
node bin/agent-lab.mjs doctor
```

Replace `MODEL_ID` with a model available to your account:

```sh
node bin/agent-lab.mjs run --model MODEL_ID --reasoning medium --repeats 1 --timeout-seconds 180 --out runs/pilot
node bin/agent-lab.mjs report runs/pilot/experiment.json
```

One repeat means **two agent calls**, one per condition. Live calls use your
existing Codex authentication and consume its usage allowance or configured API
usage. Agent Lab does not estimate monetary charges. A timeout is a time limit,
not a spending limit. Choose an effort supported by your model.

The adapter was exercised with Codex CLI `0.155.0-alpha.9.2`. CLI options and event
formats can change. The `doctor` command checks availability and login; it does
not prove that the environment will permit the agent's tools. If execution is
blocked, the run is recorded as `execution_blocked`, without a task-quality score.

All commands and options are listed with:

```sh
node bin/agent-lab.mjs --help
```

## The first task

An asynchronous event inbox receives duplicate notifications. Its implementation
incorrectly treats failed deliveries as complete, confuses events from different
tenants, and does not wait for an in-progress duplicate delivery.

The agent receives the behavioral contract, broken module, and a basic smoke
test. It must repair a single self-contained JavaScript module. The seven
independent checks cover sequential duplicates, tenant and event identity,
delimiter collisions, retries, concurrent success and failure, separate inboxes,
and immutable inputs.

The `with-skill` condition also receives an original debugging `SKILL.md` and an
explicit instruction to use it. The `baseline` condition receives no additional
experimental skill. Both use the same model, effort, timeout, task, and shared
instructions, on fresh workspace copies. Pair order alternates on later repeats.

## What happens during a run

1. Check that the original implementation fails and the reference repair passes.
2. Create a new output directory and record the task and settings fingerprints.
3. Copy a clean task workspace for each attempt and run Codex with JSONL output.
4. Capture the edited module and verify a copy in a separate temporary directory.
5. Save the outcome and regenerate the JSON manifest and Markdown report.

The grader does not use agent-edited tests. A completed agent turn is graded only
after execution and trace checks pass. Timeouts, malformed traces, output limits,
execution errors, and cancellation remain visible as separate outcomes.

```text
runs/pilot/
  experiment.json               Structured results and settings
  report.md                     Readable comparison
  attempts/01-baseline/
    workspace/                  Fresh editable task copy
    prompt.txt                  Exact task prompt
    trace.jsonl                 Raw Codex event stream
    stderr.log                  Process diagnostics
    before.mjs / after.mjs      Implementation snapshots
    changes.diff                Captured diff, when Git is available
  attempts/02-with-skill/
    ...
```

An existing output directory is never overwritten. Every new output directory
contains its own ignore rule; `runs/` is also ignored by the repository. Review
and redact artifacts before explicitly sharing them. They can contain local
paths, inherited instructions, prompts, and other private context. The CLI sends
the task to your configured Codex service during live runs; it does not publish
results or upload them to GitHub.

## Reading the results

- `passed` means all seven independent checks passed, not that every possible
  behavior has been proven correct.
- `failed` means the agent finished and its captured module failed checks.
- `execution_blocked` and other execution errors are not evidence that a skill
  made the agent worse. Keep them in the record and diagnose them separately.
- Unknown or incomplete token usage stays unknown, rather than becoming zero.
  Reported input tokens can include cached tokens; they are not a bill.
- Skill-read evidence is a command heuristic. It does not prove that the agent
  followed the instructions.
- One task and one pair are a pilot, not a general benchmark. Repeat runs, retain
  unsuccessful attempts, and broaden tasks before making broader claims.

## Boundaries

The task is intentionally small. There is no task marketplace, multi-agent
orchestration, dashboard, login system, or hosted service.

The agent runs with Codex's `workspace-write` sandbox and `--ignore-user-config`.
User/system skills and instructions may still be visible. This is a local
comparison of an **additional** skill, not a claim of a completely skill-free or
hermetically isolated baseline. The verifier is outside the editable workspace
and uses Node's filesystem permission controls with a small environment, but
this setup is not a security sandbox for malicious agents or arbitrary code.
Use the bundled task and inspect changes.

An interrupted run preserves its current manifest. There is no resume command;
start a new run directory. Ctrl+C requests process-tree cancellation. A forced
process kill or OS shutdown can leave an unfinished attempt in the manifest.

## Project map

| Location | Responsibility |
| --- | --- |
| `bin/agent-lab.mjs` | Command-line interface |
| `src/runner.mjs` | Fresh workspaces, Codex calls, snapshots and checkpoints |
| `src/process.mjs` | Bounded subprocesses and cancellation |
| `src/trace.mjs` | JSONL parsing and nullable usage accounting |
| `src/verify.mjs` | Independent verification of a captured module |
| `src/report.mjs` | Manifest validation and Markdown output |
| `tasks/duplicate-events/` | Task, broken implementation, reference repair and skill |
| `tests/` | Offline unit and integration tests with an explicit agent double |

The test double exercises file edits, workspace separation, capture, verification,
and reporting without calling a model. Its outcomes are synthetic and are always
labeled `test-double` in manifests and reports. GitHub Actions runs the offline
suite and self-check on Windows and Linux with Node.js 22.

## Method references

- [OpenAI: Evaluating skills](https://developers.openai.com/blog/eval-skills)
- [Promptfoo: Testing agent skills](https://www.promptfoo.dev/docs/guides/test-agent-skills/)

This project uses Codex as its execution engine. The small task, verifier,
debugging instructions, and report format are included in this repository.

MIT license. Contributions should keep result claims proportional to the evidence.
