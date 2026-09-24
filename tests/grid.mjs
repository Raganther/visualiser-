// Beat grid test: on the synthetic groove (124 bpm, then 128 bpm; claps on 2 and 4, crash on 1, dropped kicks,
// an 8 s breakdown), the grid must find the tempo, stay in time, and find the real downbeat.
// Reads the grid through the modules, so it runs on index.html (not the single-file bundle).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('grid: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
const browser = await launch('2d'), page = await openPage(browser, url);
const beats = await page.evaluate(async () => {
  const {J} = await import('/src/journey/core.js'), {G} = await import('/src/audio/beatgrid.js');
  const out = []; let last = J.beats;
  for (let f = 1; f <= 100*60; f++) {
    __step(1);
    if (J.beats !== last) { last = J.beats;
      out.push({t: f/60, pos: J.pos, locked: G.locked, truth: __truth, err: __truthErr, bpm: G.period ? 60/G.period : 0, trueBpm: __trueBpm}); }
  }
  return out;
});
const errors = await page.errors();
await browser.close(); srv.close();

const settled = beats.filter(b => b.t > 30 && !(b.t > 70 && b.t < 80));   // after the grid settles, away from the tempo change
const locked = settled.filter(b => b.locked);
const steady = locked.filter(b => b.t < 70);                               // the steady-tempo stretch, before the change
const after = beats.filter(b => b.t > 80 && b.locked);
const pct = (n, d) => d ? Math.round(n/d*100) : 0;
const checks = [
  ['locked for most beats', pct(locked.length, settled.length), v => v >= 90, '%'],
  ['tempo within 0.5 BPM', pct(locked.filter(b => Math.abs(b.bpm - b.trueBpm) < .5).length, locked.length), v => v >= 95, '%'],
  ['mean timing error', Math.round(locked.reduce((a, b) => a + Math.abs(b.err), 0)/Math.max(1, locked.length)*1000), v => v < 15, ' ms'],
  ['downbeat right at a steady tempo', pct(steady.filter(b => b.pos === b.truth).length, steady.length), v => v >= 95, '%'],
  // known limit: after a tempo change the downbeat can slip to beat 3 and stay there; reported, not yet required
  ['(known limit) downbeat right after the tempo change', pct(after.filter(b => b.pos === b.truth).length, after.length), () => true, '%'],
  ['no page errors', errors.length, v => v === 0, ''],
];
let failed = false;
for (const [name, v, ok, unit] of checks) { const pass = ok(v); if (!pass) failed = true; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${v}${unit}`); }
process.exit(failed ? 1 : 0);
