import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrace } from '../src/trace.mjs';

const jsonl = (...events) => events.map(JSON.stringify).join('\n');

test('captures completion and reported usage without inventing prices', () => {
  const trace = parseTrace(jsonl(
    {type:'thread.started', thread_id:'example'},
    {type:'item.completed', item:{type:'command_execution', command:'node smoke.test.mjs', exit_code:0}},
    {type:'turn.completed', usage:{input_tokens:120, cached_input_tokens:50, output_tokens:30}}
  ));
  assert.equal(trace.completed, true);
  assert.deepEqual(trace.usage, {inputTokens:120, cachedInputTokens:50, outputTokens:30});
  assert.equal(trace.commands, 1);
});

test('missing usage stays unknown and a failed turn is not a completed turn', () => {
  const trace = parseTrace(jsonl({type:'turn.failed', error:{message:'quota exhausted'}}));
  assert.equal(trace.failed, true);
  assert.equal(trace.completed, false);
  assert.equal(trace.usage, null);
});

test('malformed or incomplete traces are not silently accepted', () => {
  assert.equal(parseTrace('{broken').malformedLines, 1);
  assert.equal(parseTrace('').completed, false);
});

test('skill evidence needs a successful actual command, not an agent claim', () => {
  const claim = {type:'item.completed',item:{type:'agent_message',text:'I read SKILL.md'}};
  assert.equal(parseTrace(jsonl(claim)).skillReadObserved, false);
  const read = {type:'item.completed', item:{type:'command_execution',command:'cat .agents/skills/debugging/SKILL.md',exit_code:0}};
  assert.equal(parseTrace(jsonl(read)).skillReadObserved, true);
});

test('one unreported completed turn makes total usage unknown in either order', () => {
  const known = {type:'turn.completed',usage:{input_tokens:120,output_tokens:30}};
  const missing = {type:'turn.completed'};
  assert.equal(parseTrace(jsonl(known,missing)).usage,null);
  assert.equal(parseTrace(jsonl(missing,known)).usage,null);
});
