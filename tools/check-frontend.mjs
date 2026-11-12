import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { term } from '../frontend/web/js/terminology.js';
const files = await readdir('web', { recursive: true });
let checked = 0;
for (const relative of files.filter(file => /\.(js|css|html|json)$/.test(file))) {
  const file = path.join('web', relative);
  const bytes = await readFile(file);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw Error(`BOM: ${file}`);
  if (text.includes('\uFFFD')) throw Error(`Replacement character: ${file}`);
  for (const [, key] of text.matchAll(/\{\{([a-zA-Z][\w.-]*)\}\}/g)) term(key);
  if (/xray[-_]|xrayLoupe|btnToggleXray/i.test(text)) throw Error(`Ghost component: ${file}`);
  if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status) throw Error(result.stderr);
  }
  checked++;
}
for (const file of ['server.js', 'scripts/log-source.mjs', 'scripts/recycle-bin.mjs']) {
  const text = await readFile(file, 'utf8');
  for (const [, key] of text.matchAll(/\{\{([a-zA-Z][\w.-]*)\}\}/g)) term(key);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status) throw Error(result.stderr);
}
console.log(`PASS: ${checked} frontend files: strict UTF-8, no BOM/replacement characters/loupe, JavaScript syntax valid.`);
