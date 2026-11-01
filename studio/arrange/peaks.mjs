// Measures each library sound's peak as the DAW plays it (a phrase for its part: the bass a note, the chords a
// four-note chord, a lead a note, a drum sound each of its pads) and writes peaks.js, from which the desk sets each
// track's input gain and fader (desk.js). Run it after the library changes. Usage: node studio/arrange/peaks.mjs
import fs from 'node:fs';
import path from 'node:path';
import { nativeSet, X0 } from '../jam/model.js';
import { NATIVE } from '../lib/native/index.js';
import { kitHit } from '../lib/native/kit.js';
import { NativePoly, PRESETS, DEF as NPDEF } from '../lib/native/npoly.js';
import { synthRender } from '../lib/native/asynth.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
const here = path.dirname(new URL(import.meta.url).pathname), sr = 44100, V = .85, sd = 60/120/4;
const lib = JSON.parse(fs.readFileSync(path.join(here, '../listen/packs/library.json'), 'utf8')).sounds;
const pk = (...bs) => { let m = 0; for (const b of bs) for (const x of [b.L, b.R]) for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; };
// buffers laid over one another from the start (a chord's notes)
const sum = bs => { const n = Math.max(...bs.map(b => b.L.length)), L = new Float32Array(n), R = new Float32Array(n); for (const b of bs) for (let i = 0; i < b.L.length; i++) { L[i] += b.L[i]; R[i] += b.R[i]; } return {L, R}; };
const scale = (b, g) => ({L: b.L.map(x => x*g), R: b.R.map(x => x*g)});
const NOTES = {bass: [45], chords: [57, 60, 64, 67], lead: [69]};
function peakOf(s){ const set = {x: X0(s.role), length: 1};
  if (s.voices) return Math.max(...Object.entries(s.voices).map(([v, m]) => m.native
    ? pk(scale(NATIVE[m.native].make(sr, m.n ?? 60, V, {...nativeSet(set, m.native, m.set || {}), ...m.knobs}), (NATIVE[m.native].gain ?? .5)*(.4 + .6*V)))
    : pk(kitHit(sr, m.kit, m.voice || v, V, m.over || {}, 1.5))));
  const src = s.src, notes = NOTES[s.role] || NOTES.lead, secs = s.role === 'chords' ? 1.5 : .6;
  if (src.asynth) return pk(synthRender(sr, src.asynth, notes.map(n => ({t: 0, n, len: secs, vel: V})), secs + 2));
  if (src.palette && !NATIVE_OF[src.palette]) { const [p, ps] = PAL[src.palette], S = new NativePoly(sr); S.load({...NPDEF, ...PRESETS[p], chord: 0, ...ps, ...src.poly, period: 4*sd});
    const n = Math.ceil((secs + 2)*sr), L = new Float32Array(n), R = new Float32Array(n); notes.forEach((x, i) => S.on(i, x, V));
    for (let a = 0; a < n; a += 128) { if (a >= secs*sr && a - 128 < secs*sr) notes.forEach((x, i) => S.off(i)); S.render(L, R, a, Math.min(n, a + 128)); } return pk({L, R}); }
  const name = src.native || NATIVE_OF[src.palette], shift = (src.shift || 0) + (src.palette ? 12*(PAL[src.palette][1].oct || 0) : 0), I = NATIVE[name];
  const o = {...nativeSet(set, name, src.set || {}), ...src.knobs, ...(I.held ? {len: secs} : {})};
  return pk(scale(sum(notes.map(n => I.make(sr, n + shift, V, o))), (I.gain ?? .5)*(.4 + .6*V))); }
const out = {}; let t0 = Date.now();
for (const s of lib) { try { out[s.id] = +(20*Math.log10(Math.max(1e-6, peakOf(s)))).toFixed(1); } catch (e) { console.log('skipped', s.id, e.message); } }
fs.writeFileSync(path.join(here, 'peaks.js'), `// Each library sound's peak in dBFS as the DAW plays it, measured by peaks.mjs (generated: run it again rather than editing)\nexport const PEAKS = ${JSON.stringify(out)};\n`);
console.log(Object.keys(out).length, 'sounds in', ((Date.now() - t0)/1000).toFixed(0), 's;', Object.entries(out).slice(0, 12).map(([k, v]) => k + ' ' + v).join(', '));
