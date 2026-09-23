import assert from 'node:assert/strict';
import { createInbox } from './candidate.mjs';

const checks = [];
const event = (tenantId='team-a', id='event-1') => ({tenantId,id,payload:{text:'hello'}});
const check = async (name, action) => {
  try { await action(); checks.push({name,passed:true}); }
  catch (error) { checks.push({name,passed:false,detail:error.message.slice(0,600)}); }
};

await check('sequential duplicates and delivery contract', async () => {
  const sent = [];
  const handle = createInbox(async value => sent.push(value));
  const first = event();
  assert.deepEqual(await handle(first), {status:'delivered'});
  assert.deepEqual(await handle({...first,payload:{text:'changed'}}), {status:'duplicate'});
  assert.equal(sent.length,1);
  assert.deepEqual(sent[0],first);
});

await check('different tenants are independent', async () => {
  const sent = [];
  const handle = createInbox(async value => sent.push(value.tenantId));
  assert.deepEqual(await handle(event('a')), {status:'delivered'});
  assert.deepEqual(await handle(event('b')), {status:'delivered'});
  assert.deepEqual(sent,['a','b']);
});

await check('different event IDs and delimiter boundaries', async () => {
  const sent = [];
  const handle = createInbox(async value => sent.push([value.tenantId,value.id]));
  for (const value of [event('a','1'), event('a','2'), event('a:b','c'), event('a','b:c')]) {
    assert.deepEqual(await handle(value), {status:'delivered'});
  }
  assert.equal(sent.length,4);
});

await check('failed delivery is retryable', async () => {
  let calls = 0;
  const problem = new Error('temporary failure');
  const handle = createInbox(async () => { if (++calls === 1) throw problem; });
  await assert.rejects(handle(event()), error => error === problem);
  assert.deepEqual(await handle(event()), {status:'delivered'});
  assert.deepEqual(await handle(event()), {status:'duplicate'});
  assert.equal(calls,2);
});

await check('concurrent duplicate waits for successful delivery', async () => {
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const handle = createInbox(async () => { calls++; await gate; });
  const first = handle(event());
  let duplicateSettled = false;
  const second = handle(event()).then(value => { duplicateSettled = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  const settledBeforeRelease = duplicateSettled;
  release();
  const answers = await Promise.all([first,second]);
  assert.equal(settledBeforeRelease,false);
  assert.equal(calls,1);
  assert.deepEqual(answers,[{status:'delivered'},{status:'duplicate'}]);
});

await check('concurrent callers share failure and can retry', async () => {
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const handle = createInbox(async () => { if (++calls === 1) { await gate; throw new Error('retry'); } });
  const pair = Promise.allSettled([handle(event()),handle(event())]);
  await new Promise(resolve => setImmediate(resolve));
  release();
  assert.deepEqual((await pair).map(value => value.status),['rejected','rejected']);
  assert.deepEqual(await handle(event()), {status:'delivered'});
  assert.equal(calls,2);
});

await check('instances are independent and inputs remain intact', async () => {
  let calls = 0;
  const deliver = async () => { calls++; };
  const value = Object.freeze({...event(),payload:Object.freeze({text:'hello'})});
  const first = createInbox(deliver);
  const second = createInbox(deliver);
  await first(value);
  await second(value);
  assert.equal(calls,2);
  assert.deepEqual(value,event());
});

console.log(JSON.stringify({checks}));
