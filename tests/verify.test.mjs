import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { verifyCandidate } from '../src/verify.mjs';

const fixture = name => fileURLToPath(new URL(`../tasks/duplicate-events/${name}/inbox.mjs`,import.meta.url));

test('independent checks catch the seeded bug and accept the known repair', async () => {
  const original = await verifyCandidate(fixture('workspace/src'));
  const oracle = await verifyCandidate(fixture('oracle'));
  assert.equal(original.status,'failed');
  assert.ok(original.passed < original.total);
  assert.equal(oracle.status,'passed');
  assert.equal(oracle.passed,7);
  assert.equal(oracle.total,7);
});

test('missing implementation is a verification error, never a failed solution', async () => {
  const result = await verifyCandidate(fixture('missing'));
  assert.equal(result.status,'verification_error');
});
