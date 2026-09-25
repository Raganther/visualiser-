// Runs every browser test, two files at a time (each prints when it's done, with its time). Usage: node tests/run.mjs
// (set AFTERGLOW_ENTRY to test another entry page; TEST_JOBS=1 to run them one at a time)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
// heaviest first, so the two lanes finish together: WebGL-heavy and simple-mode-heavy files alternate
const FILES = ['scene.mjs', 'golden.mjs', 'objects.mjs', 'sync.mjs', 'grid.mjs', 'media.mjs', 'journey.mjs', 'smoke.mjs'];
const jobs = +(process.env.TEST_JOBS || 2), queue = [...FILES], results = [];
const one = t => new Promise(done => {
  const t0 = Date.now(), p = spawn(process.execPath, [path.join(dir, t)]); let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => { console.log(`\n== ${t} (${((Date.now() - t0)/1000).toFixed(0)} s)\n${out.trimEnd()}`); results.push({t, ok: code === 0}); done(); });
});
await Promise.all(Array.from({length: jobs}, async () => { while (queue.length) await one(queue.shift()); }));
const failed = results.filter(r => !r.ok);
console.log(failed.length ? `\n${failed.length} test file(s) failed: ${failed.map(r => r.t).join(', ')}` : '\nall tests passed');
process.exit(failed.length ? 1 : 0);
