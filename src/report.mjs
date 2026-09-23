const conditions = ['baseline','with-skill'];
const outcomes = new Set(['not_run','running','passed','failed','agent_error','timeout',
  'invalid_trace','output_limit','verification_error','execution_blocked','cancelled']);

export function summarize(experiment) {
  if (experiment?.schemaVersion !== 1 || !Array.isArray(experiment.attempts) ||
      !experiment.settings || !experiment.taskHash || !experiment.settingsHash) {
    throw new Error('Invalid experiment schema.');
  }
  for (const attempt of experiment.attempts) {
    if (!conditions.includes(attempt.condition) || !outcomes.has(attempt.status)) {
      throw new Error('Unknown condition or outcome.');
    }
    if (attempt.taskHash !== experiment.taskHash || attempt.settingsHash !== experiment.settingsHash) {
      throw new Error('Task/settings fingerprint mismatch; these attempts cannot be compared.');
    }
  }
  return conditions.map(condition => {
    const attempts = experiment.attempts.filter(item => item.condition === condition);
    const count = status => attempts.filter(item => item.status === status).length;
    const attempted = attempts.filter(item => !['not_run','running'].includes(item.status)).length;
    const sumUsage = field => attempts.length && attempts.every(item => Number.isSafeInteger(item.trace?.usage?.[field]))
      ? attempts.reduce((sum,item) => sum + item.trace.usage[field],0) : null;
    return {condition,attempted,passed:count('passed'),failed:count('failed'),
      errors:attempted-count('passed')-count('failed'),pending:count('not_run')+count('running'),
      inputTokens:sumUsage('inputTokens'),outputTokens:sumUsage('outputTokens')};
  });
}

const cell = value => String(value ?? 'unknown').replace(/[\r\n]+/g,' ').replace(/\|/g,'\\|');

export function renderMarkdown(experiment) {
  const rows = summarize(experiment);
  const lines = ['# Agent Lab — local pilot','',
    `Task: ${cell(experiment.taskId)} · Model: ${cell(experiment.settings.model)}`,
    `Data source: ${cell(experiment.kind)} · Finished: ${experiment.complete === true ? 'yes':'no'}`,'',
    '| Condition | Attempts finished | Passed | Failed checks | Execution errors | Pending | Input tokens | Output tokens |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const row of rows) lines.push(`| ${[row.condition,row.attempted,row.passed,row.failed,row.errors,row.pending,row.inputTokens,row.outputTokens].map(cell).join(' | ')} |`);
  lines.push('','## Attempts','',
    '| Attempt | Condition | Outcome | Checks passed | Agent time (s) | Skill read observed |',
    '| --- | --- | --- | --- | ---: | --- |');
  for (const [index,item] of experiment.attempts.entries()) {
    lines.push(`| ${[item.id ?? index+1,item.condition,item.status,
      item.verification ? `${item.verification.passed}/${item.verification.total}`:'not graded',
      typeof item.durationMs === 'number' ? (item.durationMs/1000).toFixed(2):null,
      item.trace?.skillReadObserved ? 'yes (command heuristic)':'not observed'].map(cell).join(' | ')} |`);
  }
  lines.push('','## Interpretation','',
    '- A passed result means the bundled independent checks passed; it is not a claim about all possible inputs.',
    '- This small, single-task pilot does not establish a general skill advantage. Keep every attempt.',
    '- Unknown usage is not zero. Token counts are reported usage, not monetary charges.',
    '- Timing includes agent/tool latency. It is not a pure measure of model computation.',
    '- Baseline means no additional experimental skill. User/system skills and instructions may still be visible.',
    '- A successful SKILL.md command is only evidence of a file reference, not proof the instructions were followed.',
    '- The verifier is separate from the editable workspace, but this local setup is not a hermetic security sandbox.',
    '- Raw traces, prompts and local paths remain in the local run directory. Inspect them before sharing.','');
  return lines.join('\n');
}
