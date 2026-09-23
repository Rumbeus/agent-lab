import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, renderMarkdown } from '../src/report.mjs';

export const experiment = () => ({schemaVersion:1,taskId:'duplicate-events',taskHash:'task',
  settings:{model:'test-model',reasoning:'medium',timeoutMs:1000},settingsHash:'settings',
  skillHash:'skill',kind:'test',attempts:[
    {condition:'baseline',status:'failed',taskHash:'task',settingsHash:'settings',
      durationMs:200,verification:{passed:3,total:7},trace:{usage:null}},
    {condition:'baseline',status:'timeout',taskHash:'task',settingsHash:'settings',durationMs:1000},
    {condition:'with-skill',status:'passed',taskHash:'task',settingsHash:'settings',
      durationMs:300,verification:{passed:7,total:7},trace:{usage:{inputTokens:200,outputTokens:50,cachedInputTokens:0}}}
  ]});

test('keeps execution errors in attempted-run counts without treating them as graded failures', () => {
  const rows = summarize(experiment());
  assert.deepEqual(rows.map(row => [row.condition,row.attempted,row.passed,row.failed,row.errors]),
    [['baseline',2,0,1,1],['with-skill',1,1,0,0]]);
  assert.equal(rows[0].inputTokens,null);
  assert.equal(rows[1].inputTokens,200);
});

test('refuses to compare runs from different tasks or settings', () => {
  const invalid = experiment();
  invalid.attempts[1].settingsHash = 'different';
  assert.throws(() => summarize(invalid),/mismatch/i);
});

test('markdown distinguishes unknown usage and labels limited sample', () => {
  const text = renderMarkdown(experiment());
  assert.match(text,/unknown/i);
  assert.match(text,/pilot/i);
  assert.doesNotMatch(text,/\$[0-9]/);
});
