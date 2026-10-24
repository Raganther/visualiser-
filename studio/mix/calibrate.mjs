// Measures each round 4 song's gain staging offline and writes it to levels.js: each channel's input gain (its peaks to
// -9 dBFS before its processors) and how much louder its processors leave it (taken back off by its fader).
// Usage: node studio/mix/calibrate.mjs [song ids …] (all three by default; a minute or so each)
import fs from 'node:fs';
import path from 'node:path';
import { songOf } from './song.mjs';
import { mixOf, eventsOf } from './mix.js';
import { LEVELS } from './levels.js';
import { Host } from '../lib/parts/host.js';
const here = path.dirname(new URL(import.meta.url).pathname), sr = 44100, db = x => 20*Math.log10(Math.max(1e-12, x));
// the song played through the host: each channel strip's signal handed to look(id, L, R, n) before (in) or after its processors
function run(P, SND, D, look){ const H = new Host(sr); H.build(D); for (const e of eventsOf(P, SND, 0)) H.msg({...e.m, t: e.t});
  for (const s of H.st) if (s.input) { const go = s.chain.run.bind(s.chain); s.chain.run = (L, R, a, b, env) => { look(s.id, 'in', L, R, a, b); go(L, R, a, b, env); look(s.id, 'out', L, R, a, b); }; }
  const n = Math.ceil((P.bars*2 + 2)*sr), L = new Float64Array(128), R = new Float64Array(128); for (let a = 0; a < n; a += 128) { L.fill(0); R.fill(0); H.process(L, R, 128, a/sr); } }
const out = {...LEVELS};
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ['r4-1', 'r4-2', 'r4-3']) {
  const {P, SND} = songOf(id); out[id] = {gain: {}, cal: {}};
  // its peaks, nothing in the way
  let D = mixOf({...P, song: '-'}, SND); const pk = {}; for (const s of D.strips) if (s.input) s.chain = [];
  run(P, SND, D, (k, w, L, R, a, b) => { if (w !== 'in') return; for (let j = a; j < b; j++) pk[k] = Math.max(pk[k] || 0, Math.abs(L[j]), Math.abs(R[j])); });
  for (const [k, v] of Object.entries(pk)) out[id].gain[k] = +(-9 - db(v)).toFixed(1);
  // then through its processors with that gain: how much louder they leave it (the gain itself aside)
  LEVELS[id] = {gain: out[id].gain, cal: {}}; D = mixOf(P, SND); const e = {};
  run(P, SND, D, (k, w, L, R, a, b) => { const o = e[k] ||= {in: 0, out: 0}; for (let j = a; j < b; j++) o[w] += L[j]*L[j] + R[j]*R[j]; });
  for (const [k, o] of Object.entries(e)) out[id].cal[k] = +(10*Math.log10(o.out/o.in) - out[id].gain[k]).toFixed(1);
  console.log(id, JSON.stringify(out[id])); }
fs.writeFileSync(path.join(here, 'levels.js'), `// Each round 4 song's gain staging, measured offline by calibrate.mjs (generated: run it again rather than editing)\nexport const LEVELS = ${JSON.stringify(out, null, 1).replace(/\n\s*/g, ' ')};\n`);
