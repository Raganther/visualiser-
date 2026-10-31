// Builds the drum playground into one page (studio/listen/drum-lab.html: the app and the DAW's live worklet bundled in).
// Usage: node studio/drums/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { BEATS } from './beats.js';
const here = path.dirname(new URL(import.meta.url).pathname);
for (const b of BEATS) for (const [v, r] of Object.entries(b.rows)) if (r.length !== 32 || /[^.oxXr]/.test(r)) throw new Error(`${b.id} ${v}: ${r.length} steps`);
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worklet] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, '../arrange/voices.worklet.js'))]);
const out = path.join(here, '../listen/drum-lab.html');
fs.writeFileSync(out, fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*WORKLET*/', () => worklet).replace('/*APP*/', () => app));
console.log('drum-lab.html', (fs.statSync(out).size/1024).toFixed(0), 'KB,', BEATS.length, 'beats');
