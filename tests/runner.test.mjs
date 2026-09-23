import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess } from '../src/process.mjs';
import { runExperiment } from '../src/runner.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const fakeAgent = fileURLToPath(new URL('./helpers/fake-agent.mjs',import.meta.url));
const oracle = fileURLToPath(new URL('../tasks/duplicate-events/oracle/inbox.mjs',import.meta.url));
async function options(t,mode='normal',repeats=1) {
  const root = await mkdtemp(path.join(tmpdir(),'agentlab-test-'));
  t.after(async () => { if (path.dirname(root) === path.resolve(tmpdir()) && path.basename(root).startsWith('agentlab-test-')) await rm(root,{recursive:true,force:true}); });
  return {outputDir:path.join(root,'run'),model:'test-model',reasoning:'medium',repeats,
    timeoutMs:mode === 'timeout' ? 200:3000,
    testAdapter:{command:process.execPath,args:[fakeAgent,mode,oracle]}};
}

test('runs a subprocess without a shell and preserves failure exit status', async () => {
  const result = await runProcess(process.execPath,['-e','process.stdout.write("hello");process.exit(7)']);
  assert.equal(result.stdout,'hello');
  assert.equal(result.exitCode,7);
  assert.equal(result.timedOut,false);
});

test('stops a hanging subprocess', async () => {
  const result = await runProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:150});
  assert.equal(result.timedOut,true);
  assert.ok(result.durationMs < 10000);
});

test('preserves UTF-8 characters split across process output chunks', async () => {
  const code = "const b=Buffer.from('🎯');process.stdout.write(b.subarray(0,2));setTimeout(()=>process.stdout.write(b.subarray(2)),30)";
  assert.equal((await runProcess(process.execPath,['-e',code])).stdout,'🎯');
});

test('supports cancellation without waiting for the full timeout', async () => {
  const controller = new AbortController();
  const run = runProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:5000,signal:controller.signal});
  setTimeout(() => controller.abort(),100);
  const result = await run;
  assert.equal(result.cancelled,true);
  assert.equal(result.timedOut,false);
});

test('fresh attempts are graded independently even when the agent replaces its own tests', async t => {
  const opts = await options(t,'normal',2);
  await runProcess('git',['init','--quiet'],{cwd:path.dirname(opts.outputDir)});
  const result = await runExperiment(opts);
  assert.deepEqual(result.attempts.map(item => item.condition),['baseline','with-skill','with-skill','baseline']);
  assert.deepEqual(result.attempts.map(item => item.status),['failed','passed','passed','failed']);
  assert.equal(result.kind,'test-double');
  assert.equal(result.complete,true);
  const saved = JSON.parse(await readFile(path.join(opts.outputDir,'experiment.json'),'utf8'));
  assert.equal(saved.attempts.length,4);
  const ignored = await runProcess('git',['check-ignore','--no-index','--','run/experiment.json','run/attempts/01-baseline/prompt.txt'],{cwd:path.dirname(opts.outputDir)});
  assert.deepEqual(ignored.stdout.trim().split(/\r?\n/),['run/experiment.json','run/attempts/01-baseline/prompt.txt']);
  await assert.rejects(runExperiment(opts),/exist/i);
});

test('timeout also stops a grandchild holding stdout open', async () => {
  const code = "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});setInterval(()=>{},1000)";
  const result = await runProcess(process.execPath,['-e',code],{timeoutMs:200});
  assert.equal(result.timedOut,true);
  assert.ok(result.durationMs < 10000);
});

for (const [mode,status] of [['crash','agent_error'],['malformed','invalid_trace'],['timeout','timeout'],['policy','execution_blocked']]) {
  test(`retains ${mode} as an execution outcome, never a passing solution`, async t => {
    const result = await runExperiment(await options(t,mode));
    assert.deepEqual(result.attempts.map(item => item.status),[status,status]);
  });
}
