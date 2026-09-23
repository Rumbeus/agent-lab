// Executable test double. Real workspaces and the real verifier are still used.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
const [mode, oracle] = process.argv.slice(2);
let input = '';
for await (const chunk of process.stdin) input += chunk;
if (mode === 'timeout') { setInterval(() => {},1000); }
else if (mode === 'crash') { process.exit(3); }
else if (mode === 'malformed') { console.log('{bad'); }
else if (mode === 'policy') {
  console.error('ERROR codex_core::tools::router: error=exec_command failed: CreateProcess { message: Rejected: blocked by policy }');
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:4}}));
}
else {
  const before = await readFile('src/inbox.mjs','utf8');
  if (!before.includes('const seen = new Set')) process.exit(12);
  if (input.includes('$debugging')) await copyFile(oracle,'src/inbox.mjs');
  await writeFile('smoke.test.mjs','process.exit(0);');
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:4,cached_input_tokens:0}}));
}
