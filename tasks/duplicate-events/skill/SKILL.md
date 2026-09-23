---
name: debugging
description: Investigate a reported defect, reproduce the failing behavior, and verify a focused repair against the stated contract.
---

# Debugging experiment v1

Before editing, reproduce a contract violation with a focused test. Distinguish
the visible symptom from the state transition that caused it.

For asynchronous stateful code, trace when state is published, which callers
share it, and what happens on rejection. Inspect identity boundaries as well as
the happy path. Use the task's contract rather than adding unrelated behavior.

Make a focused repair. Run the reproducer and relevant regression tests after
the edit. Report the commands actually executed and any remaining limitations.
