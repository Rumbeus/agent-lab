import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyCandidate } from '../../src/verify.mjs';

const experiment = JSON.parse(await readFile(new URL('./experiment.json',import.meta.url),'utf8'));
for (const condition of ['baseline','with-skill']) {
  const file = new URL(`./${condition}.mjs`,import.meta.url);
  const source = (await readFile(file,'utf8')).replace(/\r\n/g,'\n');
  const recorded = experiment.publication.snapshots.find(item => item.condition === condition);
  assert.equal(createHash('sha256').update(source).digest('hex'),recorded.sha256Lf,
    `${condition}: published snapshot has changed`);
  const result = await verifyCandidate(fileURLToPath(file));
  console.log(`${condition}: ${result.passed}/${result.total} (${result.status})`);
  assert.equal(result.status,'passed',`${condition}: independent checks failed`);
}
