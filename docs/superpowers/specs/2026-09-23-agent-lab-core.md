# Agent Lab core v0.1

Build a local, inspectable experiment: does an additional debugging skill help
an agent repair duplicate event handling? The website is deferred. JSON and
Markdown reports are the stable interface for a future viewer.

## Approved scope

- One deliberately faulty JavaScript task, one original debugging skill.
- Two conditions: baseline and with-skill, identical model/settings/task.
- Fresh workspace per attempt; repeated attempts alternate condition order.
- Independent verification after the agent exits; never grade its self-report.
- Save source changes, process outcomes, timing and reported token usage.
- Separate failed solutions from failed/unfinished agent processes.
- Local Node.js 22+, no runtime package dependencies, Codex CLI adapter.
- No website, accounts, billing, hosted execution, automatic publication of logs.
- English public artifacts; credentials and local raw runs remain untracked.

## Task and verifier

The task is an in-memory notification inbox. Events have tenantId, id and payload.
Successful delivery is deduplicated per tenant/id. Concurrent duplicates share
one delivery. Failed delivery can be retried. Different tenants and event IDs
remain independent. The agent edits src/inbox.mjs in a disposable task copy.

The grader runs trusted checks against a copy of that candidate module in a
separate directory. It verifies sequential and concurrent duplicates, retry after
failure, independent identities and the delivery return contract. The included
oracle demonstrates that the checks are satisfiable; it is never part of the
agent workspace. The grader is an integrity boundary, not a hardened container.
Only the bundled educational task is supported in this version.

## Components

1. Task package: instructions, buggy workspace, skill, oracle, verifier.
2. Trace parser: consume Codex JSONL; capture completion/failure and usage.
3. Runner: fresh copies, bounded subprocesses, shared settings and fingerprints.
4. Report: versioned JSON plus Markdown; no automatic claims of superiority.
5. CLI: doctor, self-check, run, report.

## Method and limits

Use an explicit model and fixed reasoning effort. Disable user config loading
for the child Codex process; do not change the user's configuration or auth.
User/system skills and higher-priority instructions may still be visible: record
this limitation. Baseline means no additional experimental skill. This is a
local pilot, not a hermetic benchmark or evidence about all agents and tasks.
Token counts are reported usage, not dollar charges. Unavailable counts are null.
Runs use the existing Codex login and consume its usage allowance. No top-ups.
Bound every subprocess and retain failures; do not silently rerun bad outcomes.
An offline self-check must catch the original bug and accept the oracle before
any live experiment. An experiment may show no advantage; publish all attempts
in its aggregate. Raw logs need separate inspection before any sharing.

## Acceptance

- Offline self-check: original fails, oracle passes.
- Automated tests catch result-status, missing-usage, timeout, malformed trace,
  fingerprint mismatch and verifier-integrity regressions.
- One real baseline/with-skill pilot, if local Codex permissions allow it.
- Report clearly distinguishes live attempts from test doubles/self-checks.
- README reproduces commands and discloses local-isolation limitations.

## Reuse

Use Codex's existing JSONL automation rather than reimplementing an agent loop.
Promptfoo was considered; a small adapter avoids pulling a full evaluation stack
into the first bundled fixture/verifier experiment. Results retain simple JSON
boundaries so an integration can be added without changing the task.

Sources: https://developers.openai.com/blog/eval-skills ;
https://learn.chatgpt.com/docs/non-interactive-mode ;
https://www.promptfoo.dev/docs/guides/test-agent-skills/
