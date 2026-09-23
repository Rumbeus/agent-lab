import test from 'node:test';
import assert from 'node:assert/strict';
import { createInbox } from './src/inbox.mjs';

test('a delivered event is not sent twice', async () => {
  const delivered = [];
  const handle = createInbox(async event => delivered.push(event.id));
  const event = {tenantId:'team-a', id:'event-1', payload:{text:'hello'}};
  assert.deepEqual(await handle(event), {status:'delivered'});
  assert.deepEqual(await handle(event), {status:'duplicate'});
  assert.deepEqual(delivered, ['event-1']);
});
