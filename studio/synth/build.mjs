// Builds the synth playground into one page (studio/listen/synth-lab.html: the app and its worklet bundled in).
// Usage: node studio/synth/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { EXAMPLES } from './examples.js';
import { PLIST } from '../lib/native/asynth.js';
const here = path.dirname(new URL(import.meta.url).pathname), keys = new Set(PLIST.map(p => p.key));
for (const e of EXAMPLES) { for (const k of Object.keys(e.patch)) if (!keys.has(k)) throw new Error(`${e.id}: no setting ${k}`);
  for (const p of PLIST) { const v = e.patch[p.key]; if (v != null && (v < p.min || v > p.max)) throw new Error(`${e.id}: ${p.key} ${v} outside ${p.min}..${p.max}`); }
  for (const x of e.notes) if (!(x.n >= 12 && x.n <= 108) || x.s < 0 || x.s >= e.bars*16) throw new Error(`${e.id}: a note out of place`); }
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worklet] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, 'synth.worklet.js'))]);
const out = path.join(here, '../listen/synth-lab.html');
fs.writeFileSync(out, fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*WORKLET*/', () => worklet).replace('/*APP*/', () => app));
console.log('synth-lab.html', (fs.statSync(out).size/1024).toFixed(0), 'KB,', EXAMPLES.length, 'examples');
