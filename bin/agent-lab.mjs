#!/usr/bin/env node
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { doctor, selfCheck, runExperiment } from '../src/runner.mjs';
import { renderMarkdown } from '../src/report.mjs';

const help = `Agent Lab — local skill experiments

  node bin/agent-lab.mjs doctor
  node bin/agent-lab.mjs self-check
  node bin/agent-lab.mjs run --model MODEL_ID [--repeats 1] [--out runs/pilot]
  node bin/agent-lab.mjs report runs/pilot/experiment.json

Run options:
  --model ID           Required, identical in both conditions
  --reasoning LEVEL    low, medium, high or xhigh (default: medium)
  --repeats N          1–20 attempts per condition (default: 1)
  --timeout-seconds N  Per-agent timeout, 1–1800 (default: 180)
  --out DIRECTORY     Must not exist; defaults to a new timestamped runs folder
  --codex-path PATH    Codex executable (default: codex)

self-check is offline. run uses your Codex login and usage allowance.
Reports are local. Nothing is uploaded by this program.
`;

try {
  const [command,...argv] = process.argv.slice(2);
  if (!command || ['help','--help','-h'].includes(command)) process.stdout.write(help);
  else if (command === 'doctor') {
    if (argv.length) throw new Error('doctor takes no arguments.');
    const result = await doctor();
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if (!result.codexAvailable || !result.authenticated) process.exitCode = 1;
  } else if (command === 'self-check') {
    if (argv.length) throw new Error('self-check takes no arguments.');
    const result = await selfCheck();
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if (!result.ok) process.exitCode = 1;
  } else if (command === 'report') {
    if (argv.length !== 1) throw new Error('report needs exactly one experiment.json path.');
    process.stdout.write(renderMarkdown(JSON.parse(await readFile(argv[0],'utf8'))));
  } else if (command === 'run') {
    const {values} = parseArgs({args:argv,strict:true,allowPositionals:false,options:{
      model:{type:'string'},reasoning:{type:'string',default:'medium'},
      repeats:{type:'string',default:'1'},out:{type:'string'},
      'timeout-seconds':{type:'string',default:'180'},'codex-path':{type:'string',default:'codex'}}});
    if (!values.model) throw new Error('run requires --model MODEL_ID.');
    const seconds = Number(values['timeout-seconds']);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 1800) throw new Error('Timeout must be 1–1800 seconds.');
    const outputDir = values.out ?? path.join('runs',new Date().toISOString().replace(/[:.]/g,'-'));
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGINT',stop);
    let experiment;
    try {
      experiment = await runExperiment({outputDir,model:values.model,reasoning:values.reasoning,
        repeats:Number(values.repeats),timeoutMs:seconds*1000,codexPath:values['codex-path'],
        signal:controller.signal,onProgress:message => process.stderr.write(message+'\n')});
    } finally { process.removeListener('SIGINT',stop); }
    process.stdout.write(renderMarkdown(experiment));
    process.stderr.write(`Saved: ${path.resolve(outputDir,'experiment.json')}\n`);
    if (experiment.attempts.some(item => !['passed','failed'].includes(item.status))) process.exitCode = 2;
    if (controller.signal.aborted) process.exitCode = 130;
  } else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  process.stderr.write(`Agent Lab: ${error.message}\n`);
  process.exitCode = 1;
}
