# Duplicate events: first completed live pair

Both captured implementations passed **7/7 independent checks**. One attempt per
condition is an integration pilot, not a result about which approach is better.
Both agents also read inherited debugging and testing skills. The experimental
difference was one additional local debugging skill and its invocation prompt.

## Results

| Observed metric | Baseline | With additional skill |
| --- | ---: | ---: |
| Completed attempts | 1 | 1 |
| Independent checks passed | 7/7 | 7/7 |
| Agent process duration | 105.317 s | 106.594 s |
| Reported input tokens | 154,608 | 159,191 |
| Reported cached input tokens | 127,744 | 135,680 |
| Reported output tokens | 2,126 | 2,397 |
| Completed shell commands | 6 | 8 |
| Shell commands with nonzero exit codes | 1 | 2 |

The generated [report](report.md) and [structured manifest](experiment.json)
contain the recorded values. Input counts include the reported cached portion;
these columns must not be added together. No dollar cost was inferred. Timing
includes startup, model responses, tools, and other latency. The approximately
one-second difference is not evidence of a meaningful performance difference.

The baseline used nested maps for tenant and event identity. The additional-skill
attempt used a map keyed by a JSON-encoded tenant/event pair. Both stored an
in-progress promise before delivery, waited for concurrent duplicates, and
removed failed attempts so a retry could succeed.

## Check the captured code yourself

From the repository root, with Node.js 22 or later:

```sh
node examples/2026-09-25-duplicate-events/verify.mjs
node bin/agent-lab.mjs report examples/2026-09-25-duplicate-events/experiment.json
```

The first command checks the published snapshot hashes and executes the same
independent verifier on [baseline.mjs](baseline.mjs) and
[with-skill.mjs](with-skill.mjs). It requires no model, login, or network access.

This rechecks the code outcome. It does not independently prove the reported
token counts, timing, or the complete execution history: raw traces remain local
because they contain private paths and inherited context. The JSON export keeps
the original task, settings, skill, and candidate fingerprints, and adds hashes
of the published LF-normalized snapshots.

## Conditions

- Model: `gpt-6-astra`; reasoning: `medium`.
- Codex CLI: `0.155.0-alpha.16.4`; Node.js: `v22.22.2`; native Windows.
- One repeat, baseline first, then with-skill; fresh workspaces.
- Timeout: 180 seconds per agent process.
- Same task, model, shared instructions, and permissions in both conditions.
- `workspace-write`, user config loading disabled, native Windows sandbox
  explicitly selected as `elevated`; adapter version 3.

Reproduction command (consumes Codex usage and may produce different results):

```sh
node bin/agent-lab.mjs run --model gpt-6-astra --reasoning medium --repeats 1 --timeout-seconds 180 --out runs/new-pilot
```

Use an available model ID if this model is unavailable to your account. That
would be a different experiment and must be reported as such.

## Process evidence and limitations

Both traces show reads of inherited `using-superpowers`, `systematic-debugging`,
`test-driven-development`, and `verification-before-completion` skills. This is
concrete evidence that the baseline was not skill-free. Both attempts wrote
regression tests, saw failures before the repair, and reran tests afterward.
The final independent grader used neither agent's test suite.

The additional experimental skill's complete text appeared in command output.
However, that compound command also ran a file search and ended with exit code
1. The current success-only command heuristic therefore reports skill reading
as **not observed**. [process-evidence.json](process-evidence.json) preserves the
matching skill-text excerpt and this discrepancy. Reading instructions is not
proof of following them. Nonzero command counts include deliberately failing
pre-repair tests and are not final solution failures.

The task is public and has a reference repair in the repository. The editable
workspace excluded the oracle and verifier, and the inspected trace did not show
the agent reading them. This local setup is not a hermetic anti-cheating boundary.
There is one pair and no estimate of run-to-run variability. No causal claim
about the skill, general coding quality, or economic benefit is supported.

## What happened before this pair

On 2026-09-23, both attempted runs were blocked before reading the task. They
remain classified as `execution_blocked`, with no task-quality score.

On 2026-09-25, a minimal read/write/execute probe reproduced the denial with the
original arguments. A fresh probe adding only the already configured native
Windows sandbox selection completed all three commands and produced the correct
file. Those probes checked the execution environment and were not skill trials.

The adapter's `--ignore-user-config` had omitted the host's `windows.sandbox`
setting. The fix explicitly passes `windows.sandbox="elevated"` on Windows,
records it in the settings fingerprint, and retains `workspace-write` and policy
rules. No global configuration was edited. See the official
[Windows sandbox documentation](https://learn.chatgpt.com/docs/windows/windows-sandbox).

After the probe, one fresh pair was run. Both attempts from that pair are included
here; neither was silently rerun or discarded. The infrastructure correction was
necessary to obtain the pair and is not an improvement attributable to the skill.
