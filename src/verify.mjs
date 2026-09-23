import { mkdtemp, copyFile, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from './process.mjs';

const verifier = fileURLToPath(new URL('../tasks/duplicate-events/verifier.mjs',import.meta.url));
const fail = reason => ({status:'verification_error',passed:0,total:0,checks:[],reason});

export async function verifyCandidate(candidatePath,{timeoutMs=5000}={}) {
  let temporary;
  try {
    const stat = await lstat(candidatePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128*1024) {
      return fail('Candidate must be a regular module below 128 KiB.');
    }
    temporary = await mkdtemp(path.join(tmpdir(),'agentlab-verify-'));
    await copyFile(candidatePath,path.join(temporary,'candidate.mjs'));
    await copyFile(verifier,path.join(temporary,'verifier.mjs'));
    const env = Object.fromEntries(['SystemRoot','WINDIR','PATH','Path','TEMP','TMP','TMPDIR']
      .filter(key => process.env[key] !== undefined).map(key => [key,process.env[key]]));
    const result = await runProcess(process.execPath,
      ['--experimental-permission',`--allow-fs-read=${temporary}`,path.join(temporary,'verifier.mjs')],
      {cwd:temporary,timeoutMs,env,maxBytes:1024*1024});
    if (result.timedOut) return fail('Verifier timed out.');
    if (result.exitCode !== 0 || result.spawnError || result.outputLimited) {
      return fail('Verifier could not complete. Candidate may be invalid or violate the execution boundary.');
    }
    const lastLine = result.stdout.trim().split(/\r?\n/).at(-1);
    const {checks} = JSON.parse(lastLine);
    if (!Array.isArray(checks) || checks.length !== 7 ||
        checks.some(check => typeof check.name !== 'string' || typeof check.passed !== 'boolean')) {
      return fail('Unexpected verifier output.');
    }
    const passed = checks.filter(check => check.passed).length;
    return {status:passed === checks.length ? 'passed':'failed',passed,total:checks.length,checks};
  } catch (error) { return fail(`Unable to verify candidate (${error.code ?? error.name}).`); }
  finally {
    if (temporary && path.dirname(path.resolve(temporary)) === path.resolve(tmpdir()) &&
        path.basename(temporary).startsWith('agentlab-verify-')) {
      await rm(temporary,{recursive:true,force:true});
    }
  }
}
