import { mkdir, readFile, writeFile, copyFile, cp, lstat, realpath, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runProcess } from './process.mjs';
import { parseTrace } from './trace.mjs';
import { verifyCandidate } from './verify.mjs';
import { renderMarkdown } from './report.mjs';

export const taskRoot = fileURLToPath(new URL('../tasks/duplicate-events/',import.meta.url));
const sha = text => createHash('sha256').update(text).digest('hex');
const isoNow = () => new Date().toISOString();
const sharedInstructions = 'Work only on the repair described in TASK.md. Keep the implementation self-contained. Do not inspect parent directories. You are authorized to implement and test this bounded repair. Do not wait for another design approval.\n';

async function save(experiment, directory) {
  const target = path.join(directory,'experiment.json');
  await writeFile(`${target}.tmp`,JSON.stringify(experiment,null,2)+'\n');
  await rename(`${target}.tmp`,target);
  await writeFile(path.join(directory,'report.md'),renderMarkdown(experiment));
}

export async function selfCheck() {
  const original = await verifyCandidate(path.join(taskRoot,'workspace/src/inbox.mjs'));
  const oracle = await verifyCandidate(path.join(taskRoot,'oracle/inbox.mjs'));
  return {ok:original.status === 'failed' && oracle.status === 'passed',original,oracle};
}

export async function doctor(codexPath='codex') {
  const version = await runProcess(codexPath,['--version'],{timeoutMs:10000});
  const login = await runProcess(codexPath,['login','status'],{timeoutMs:10000});
  return {nodeVersion:process.version,codexAvailable:version.exitCode === 0,
    codexVersion:version.exitCode === 0 ? version.stdout.trim():'unavailable',
    authenticated:login.exitCode === 0};
}

export async function runExperiment({outputDir,model,reasoning='medium',repeats=1,
  timeoutMs=180000,codexPath='codex',testAdapter,onProgress=()=>{},signal}) {
  if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(model)) throw new Error('An explicit valid model ID is required.');
  if (!['low','medium','high','xhigh'].includes(reasoning)) throw new Error('Unsupported reasoning effort.');
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error('Repeats must be 1–20.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 1800000) throw new Error('Timeout must be 100–1800000 milliseconds.');
  if (typeof outputDir !== 'string' || !outputDir) throw new Error('An output directory is required.');
  const health = await selfCheck();
  if (!health.ok) throw new Error('Task self-check failed. No agent was run.');
  const setup = testAdapter ? {codexVersion:'test-double',authenticated:true,codexAvailable:true} : await doctor(codexPath);
  if (!setup.codexAvailable || !setup.authenticated) throw new Error('Codex is unavailable or not logged in. Run doctor first.');
  const directory = path.resolve(outputDir);
  await mkdir(path.dirname(directory),{recursive:true});
  await mkdir(directory); // Exclusive: never overwrite an earlier experiment.
  await writeFile(path.join(directory,'.gitignore'),'*\n');
  const files = ['TASK.md','workspace/src/inbox.mjs','workspace/smoke.test.mjs','verifier.mjs'];
  const source = await readFile(path.join(taskRoot,'workspace/src/inbox.mjs'),'utf8');
  const skill = await readFile(path.join(taskRoot,'skill/SKILL.md'),'utf8');
  const taskHash = sha(JSON.stringify(await Promise.all(files.map(async name => [name,await readFile(path.join(taskRoot,name),'utf8')]))));
  const settings = {model,reasoning,timeoutMs,nodeVersion:process.version,
    codexVersion:setup.codexVersion,sandbox:'workspace-write',ignoreUserConfig:true,
    windowsSandbox:process.platform === 'win32' ? 'elevated':null,
    sharedInstructionsHash:sha(sharedInstructions),adapterVersion:3};
  const settingsHash = sha(JSON.stringify(settings));
  const experiment = {schemaVersion:1,kind:testAdapter ? 'test-double':'live',
    taskId:'duplicate-events',createdAt:isoNow(),complete:false,taskHash,skillHash:sha(skill),
    settings,settingsHash,attempts:[]};
  for (let repeat=1; repeat<=repeats; repeat++) {
    const order = repeat % 2 ? ['baseline','with-skill']:['with-skill','baseline'];
    for (const condition of order) experiment.attempts.push({
      id:`${String(experiment.attempts.length+1).padStart(2,'0')}-${condition}`,repeat,condition,
      status:'not_run',taskHash,settingsHash,durationMs:null,verification:null,trace:null});
  }
  await save(experiment,directory);
  for (const attempt of experiment.attempts) {
    if (signal?.aborted) break;
    const attemptDir = path.join(directory,'attempts',attempt.id);
    const workspace = path.join(attemptDir,'workspace');
    await mkdir(attemptDir,{recursive:true});
    await cp(path.join(taskRoot,'workspace'),workspace,{recursive:true,errorOnExist:true,force:false});
    await copyFile(path.join(taskRoot,'TASK.md'),path.join(workspace,'TASK.md'));
    await writeFile(path.join(workspace,'AGENTS.md'),sharedInstructions);
    await writeFile(path.join(attemptDir,'before.mjs'),source);
    if (attempt.condition === 'with-skill') {
      const skillDir = path.join(workspace,'.agents/skills/debugging');
      await mkdir(skillDir,{recursive:true});
      await writeFile(path.join(skillDir,'SKILL.md'),skill);
    }
    const prompt = sharedInstructions + (attempt.condition === 'with-skill'
      ? 'Use the $debugging skill at .agents/skills/debugging/SKILL.md.\n':'');
    await writeFile(path.join(attemptDir,'prompt.txt'),prompt);
    attempt.status = 'running'; attempt.startedAt = isoNow();
    await save(experiment,directory);
    onProgress(`${attempt.id}: starting`);
    const args = ['exec','--json','--ephemeral','--color','never','--sandbox','workspace-write',
      '--ignore-user-config','--skip-git-repo-check','--model',model,
      '-c',`model_reasoning_effort=${JSON.stringify(reasoning)}`,
      ...(settings.windowsSandbox ? ['-c',`windows.sandbox=${JSON.stringify(settings.windowsSandbox)}`]:[]),
      '-C',workspace,'-'];
    const result = await runProcess(testAdapter?.command ?? codexPath,
      testAdapter ? [...testAdapter.args,...args]:args,{cwd:workspace,input:prompt,timeoutMs,signal});
    await writeFile(path.join(attemptDir,'trace.jsonl'),result.stdout);
    await writeFile(path.join(attemptDir,'stderr.log'),result.stderr);
    attempt.durationMs = result.durationMs;
    attempt.exitCode = result.exitCode;
    attempt.trace = parseTrace(result.stdout);
    attempt.finishedAt = isoNow();
    let snapshot = null;
    try {
      const candidate = path.join(workspace,'src/inbox.mjs');
      const [stat, resolved, root] = await Promise.all([lstat(candidate),realpath(candidate),realpath(workspace)]);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128*1024 || !resolved.startsWith(root+path.sep)) {
        throw new Error('Invalid candidate path');
      }
      snapshot = path.join(attemptDir,'after.mjs');
      await copyFile(candidate,snapshot);
      attempt.candidateHash = sha(await readFile(snapshot));
      const diff = await runProcess('git',['diff','--no-index','--','before.mjs','after.mjs'],{cwd:attemptDir,timeoutMs:10000});
      if ([0,1].includes(diff.exitCode)) await writeFile(path.join(attemptDir,'changes.diff'),diff.stdout);
    } catch { attempt.snapshotError = 'Candidate snapshot unavailable or outside its workspace.'; }
    if (result.cancelled) attempt.status = 'cancelled';
    else if (result.timedOut) attempt.status = 'timeout';
    else if (result.outputLimited) attempt.status = 'output_limit';
    else if (executionBlocked(result.stderr)) {
      attempt.status = 'execution_blocked';
      attempt.diagnostic = 'Codex tool execution was rejected by local policy; this is not a task-quality result.';
    }
    else if (result.spawnError || result.exitCode !== 0 || attempt.trace.failed) attempt.status = 'agent_error';
    else if (attempt.trace.malformedLines || !attempt.trace.completed) attempt.status = 'invalid_trace';
    else {
      attempt.verification = snapshot ? await verifyCandidate(snapshot) :
        {status:'verification_error',passed:0,total:0,checks:[],reason:attempt.snapshotError};
      attempt.status = attempt.verification.status;
    }
    await save(experiment,directory);
    onProgress(`${attempt.id}: ${attempt.status}`);
  }
  experiment.complete = experiment.attempts.every(item => !['not_run','running','cancelled'].includes(item.status));
  experiment.finishedAt = isoNow();
  await save(experiment,directory);
  return experiment;
}

export function executionBlocked(stderr) {
  return stderr.split(/\r?\n/).some(line => line.includes('codex_core::tools::router') &&
    /rejected.*blocked by policy/i.test(line));
}
