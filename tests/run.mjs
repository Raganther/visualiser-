// Runs every browser test in turn. Usage: node tests/run.mjs   (set AFTERGLOW_ENTRY to test another entry page)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const t of ['smoke.mjs', 'media.mjs', 'objects.mjs', 'grid.mjs', 'journey.mjs', 'golden.mjs']) {
  console.log(`\n== ${t}`);
  const r = spawnSync(process.execPath, [path.join(dir, t)], {stdio: 'inherit'});
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} test file(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
