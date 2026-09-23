import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runProcess } from '../src/process.mjs';
const cli = fileURLToPath(new URL('../bin/agent-lab.mjs',import.meta.url));

test('self-check works without an API key and does not claim agent results', async () => {
  const result = await runProcess(process.execPath,[cli,'self-check']);
  assert.equal(result.exitCode,0);
  const data = JSON.parse(result.stdout);
  assert.equal(data.ok,true);
  assert.equal(data.original.status,'failed');
  assert.equal(data.oracle.status,'passed');
});

test('run rejects missing model before starting any agent', async () => {
  const result = await runProcess(process.execPath,[cli,'run']);
  assert.equal(result.exitCode,1);
  assert.match(result.stderr,/model/i);
});

test('unknown options fail loudly', async () => {
  const result = await runProcess(process.execPath,[cli,'run','--modle','foo']);
  assert.equal(result.exitCode,1);
  assert.match(result.stderr,/unknown/i);
});
