// Builds the sound lab into one page (studio/listen/sound-lab.html: the app and its worklet bundled in). Every sound's
// phrase is first rendered here, offline, and measured, so each plays at the same loudness: a sound shouldn't be liked
// for being louder. Fails if a patch has a setting the synth hasn't got (or out of its range), a pattern isn't two bars,
// or a sound comes out silent, broken or past full scale.
// Usage: node studio/sounds/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { ALL as SOUNDS, BPM, BARS } from './sounds.js';
import { PLIST, DEF, synthRender } from '../lib/native/asynth.js';
import { AnalogKit } from '../lib/native/analogkit.js';

const here = path.dirname(new URL(import.meta.url).pathname), keys = new Set(PLIST.map(p => p.key)), sr = 48000, sd = 60/BPM/4, secs = BARS*16*sd;
// the loudness each phrase is brought to (RMS over its two bars, dBFS), and the most it may be raised
const TARGET = -21, MAXUP = 18;
const dB = x => 20*Math.log10(Math.max(1e-9, x));
function measure(L, R){ let s = 0, pk = 0; for (let i = 0; i < L.length; i++) { s += L[i]*L[i] + R[i]*R[i]; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); if (!Number.isFinite(L[i])) return {bad: true}; }
  return {rms: Math.sqrt(s/(2*L.length)), pk}; }
function drums(s){ const K = new AnalogKit(sr, 11); K.load(s.kit, s.over); const n = Math.ceil((secs + .5)*sr), L = new Float32Array(n), R = new Float32Array(n), hits = [...s.phrase].sort((a, b) => a.s - b.s); let h = 0;
  for (let j = 0; j < n; j += 128) { while (h < hits.length && hits[h].s*sd*sr < j + 128) { K.on(hits[h].v, hits[h].vel); h++; } K.render(L, R, j, Math.min(n, j + 128)); }
  return {L, R}; }
const gains = {}, report = [], seen = new Set();
for (const s of SOUNDS) {
  if (seen.has(s.id)) throw new Error(`${s.id}: in two rounds`); seen.add(s.id);
  if (s.kind === 'synth') { for (const [k, v] of Object.entries(s.patch)) { const p = PLIST.find(q => q.key === k); if (!p) throw new Error(`${s.id}: no setting ${k}`); if (v < p.min || v > p.max) throw new Error(`${s.id}: ${k} ${v} outside ${p.min}..${p.max}`); } }
  else for (const x of s.phrase) if (x.s >= BARS*16) throw new Error(`${s.id}: a hit past two bars`);
  const out = s.kind === 'synth' ? synthRender(sr, {...DEF, ...s.patch, period: 60/BPM}, s.phrase.map(x => ({t: x.s*sd, len: x.l*sd, n: x.n, vel: x.v})), secs + .5) : drums(s);
  const m = measure(out.L, out.R); if (m.bad) throw new Error(`${s.id}: not a number in its sound`); if (m.rms < 1e-4) throw new Error(`${s.id}: silent`);
  const g = Math.min(Math.pow(10, MAXUP/20), Math.pow(10, (TARGET - dB(m.rms))/20), .95/m.pk);
  gains[s.id] = +g.toFixed(4); report.push(`${s.id.padEnd(12)} rms ${dB(m.rms).toFixed(1).padStart(6)} peak ${dB(m.pk).toFixed(1).padStart(6)}  → ×${g.toFixed(2)} (${dB(m.rms*g).toFixed(1)} dB, peak ${dB(m.pk*g).toFixed(1)})`); }
console.log(report.join('\n'));
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', define: {__GAINS__: JSON.stringify(gains)}})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worklet] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, 'lab.worklet.js'))]);
const out = path.join(here, '../listen/sound-lab.html');
fs.writeFileSync(out, fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*WORKLET*/', () => worklet).replace('/*APP*/', () => app));
console.log('sound-lab.html', (fs.statSync(out).size/1024).toFixed(0), 'KB,', SOUNDS.length, 'sounds');
