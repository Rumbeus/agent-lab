import { spawn, execFile } from 'node:child_process';

export function runProcess(command, args, {cwd, input='', timeoutMs=120000,
  maxBytes=8 * 1024 * 1024, env=process.env, signal} = {}) {
  return new Promise(resolve => {
    const started = performance.now();
    let stdout = '', stderr = '', bytes = 0, timedOut = false, outputLimited = false;
    let spawnError = null, killed = false, cancelled = false;
    const child = spawn(command,args,{cwd,env,shell:false,windowsHide:true,
      detached:process.platform !== 'win32',stdio:['pipe','pipe','pipe']});
    const stop = () => {
      if (killed || !child.pid) return;
      killed = true;
      if (process.platform === 'win32') {
        execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},() => child.kill());
      } else { try { process.kill(-child.pid,'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    };
    const timer = setTimeout(() => { timedOut = true; stop(); },timeoutMs);
    const collect = channel => data => {
      bytes += Buffer.byteLength(data);
      if (bytes > maxBytes) { outputLimited = true; stop(); return; }
      if (channel === 'stdout') stdout += data.toString(); else stderr += data.toString();
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data',collect('stdout'));
    child.stderr.on('data',collect('stderr'));
    child.stdin.on('error',() => {});
    child.on('error',error => { spawnError = error.code ?? error.message; });
    child.on('close',exitCode => {
      clearTimeout(timer);
      signal?.removeEventListener('abort',onAbort);
      resolve({stdout,stderr,exitCode,timedOut,outputLimited,spawnError,cancelled,
        durationMs:Math.round(performance.now()-started)});
    });
    const onAbort = () => { cancelled = true; stop(); };
    signal?.addEventListener('abort',onAbort,{once:true});
    if (signal?.aborted) onAbort();
    child.stdin.end(input);
  });
}
