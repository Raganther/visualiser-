// Measures each round 4 song's gain staging offline, on its own sounds and on the analog set, and writes it to levels.js:
// each channel's input gain (its peaks to -9 dBFS before its processors), how much louder its processors leave it (taken
// back off by its fader) and its loudness while it plays (the analog set's parts turned to the song's own).
// Usage: node studio/mix/calibrate.mjs [song ids …] (all three by default; a couple of minutes each)
import fs from 'node:fs';
import path from 'node:path';
import { songOf } from './song.mjs';
import { mixOf, eventsOf } from './mix.js';
import { LEVELS } from './levels.js';
import { Host } from '../lib/parts/host.js';
const here = path.dirname(new URL(import.meta.url).pathname), sr = 44100, db = x => 20*Math.log10(Math.max(1e-12, x));
// the song played through the host: each channel strip's signal handed to look(id, L, R, n) before (in) or after its processors
function run(P, SND, D, look){ const H = new Host(sr); H.build(D); for (const e of eventsOf(P, SND, 0, D.set)) H.msg({...e.m, t: e.t});
  for (const s of H.st) if (s.input) { const go = s.chain.run.bind(s.chain); s.chain.run = (L, R, a, b, env) => { look(s.id, 'in', L, R, a, b); go(L, R, a, b, env); look(s.id, 'out', L, R, a, b); }; }
  const n = Math.ceil((P.bars*2 + 2)*sr), L = new Float64Array(128), R = new Float64Array(128); for (let a = 0; a < n; a += 128) { L.fill(0); R.fill(0); H.process(L, R, 128, a/sr); } }
const out = {...LEVELS};
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ['r4-1', 'r4-2', 'r4-3']) for (const set of ['song', 'analog']) {
  const {P, SND} = songOf(id), key = id + (set === 'analog' ? ':analog' : ''); out[key] = {gain: {}, cal: {}, rms: {}};
  // its peaks, nothing in the way
  let D = mixOf({...P, song: '-'}, SND, set); const pk = {}; for (const s of D.strips) if (s.input) s.chain = [];
  // (and its loudness while it plays, so the analog set's faders can keep each part where the song's own sound sat)
  const en = {}; run(P, SND, D, (k, w, L, R, a, b) => { if (w !== 'in') return; let e = 0; for (let j = a; j < b; j++) { pk[k] = Math.max(pk[k] || 0, Math.abs(L[j]), Math.abs(R[j])); e += L[j]*L[j] + R[j]*R[j]; }
    if (e > 1e-7) { const o = en[k] ||= {e: 0, n: 0}; o.e += e; o.n += 2*(b - a); } });
  for (const [k, v] of Object.entries(pk)) { out[key].gain[k] = +(-9 - db(v)).toFixed(1); out[key].rms[k] = +(10*Math.log10(en[k].e/en[k].n)).toFixed(1); }
  // then through its processors with that gain: how much louder they leave it (the gain itself aside)
  LEVELS[key] = {...out[key], cal: {}}; D = mixOf(P, SND, set); const e = {};
  run(P, SND, D, (k, w, L, R, a, b) => { const o = e[k] ||= {in: 0, out: 0}; for (let j = a; j < b; j++) o[w] += L[j]*L[j] + R[j]*R[j]; });
  for (const [k, o] of Object.entries(e)) out[key].cal[k] = +(10*Math.log10(o.out/o.in) - out[key].gain[k]).toFixed(1);
  console.log(key, JSON.stringify(out[key])); }
fs.writeFileSync(path.join(here, 'levels.js'), `// Each round 4 song's gain staging, measured offline by calibrate.mjs (generated: run it again rather than editing)\nexport const LEVELS = ${JSON.stringify(out, null, 1).replace(/\n\s*/g, ' ')};\n`);
