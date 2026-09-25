# Agent Lab — local pilot

Task: duplicate-events · Model: gpt-6-astra
Data source: live · Finished: yes

| Condition | Attempts finished | Passed | Failed checks | Execution errors | Pending | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 1 | 1 | 0 | 0 | 0 | 154608 | 2126 |
| with-skill | 1 | 1 | 0 | 0 | 0 | 159191 | 2397 |

## Attempts

| Attempt | Condition | Outcome | Checks passed | Agent time (s) | Skill read observed |
| --- | --- | --- | --- | ---: | --- |
| 01-baseline | baseline | passed | 7/7 | 105.32 | not observed |
| 02-with-skill | with-skill | passed | 7/7 | 106.59 | not observed |

## Interpretation

- A passed result means the bundled independent checks passed; it is not a claim about all possible inputs.
- This small, single-task pilot does not establish a general skill advantage. Keep every attempt.
- Unknown usage is not zero. Token counts are reported usage, not monetary charges.
- Timing includes agent/tool latency. It is not a pure measure of model computation.
- Baseline means no additional experimental skill. User/system skills and instructions may still be visible.
- A successful SKILL.md command is only evidence of a file reference, not proof the instructions were followed.
- The verifier is separate from the editable workspace, but this local setup is not a hermetic security sandbox.
- Raw traces, prompts and local paths remain in the local run directory. Inspect them before sharing.
