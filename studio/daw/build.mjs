// Builds Studio DAW into one page (studio/listen/daw.html: the app and the native worker bundled from the same code the
// renders use) and lays the sessions beside it (studio/listen/sessions/: a copy of studio/sessions with an index), the
// files the page fetches. Usage: node studio/daw/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const here = path.dirname(new URL(import.meta.url).pathname), listen = path.join(here, '../listen'), src = path.join(here, '../sessions'), dst = path.join(listen, 'sessions');
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worker] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, '../live/worker.js'))]);
const html = fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*WORKER*/', () => worker).replace('/*APP*/', () => app);
fs.writeFileSync(path.join(listen, 'daw.html'), html);
fs.mkdirSync(dst, {recursive: true}); const index = [];
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.json')).sort()) { const s = JSON.parse(fs.readFileSync(path.join(src, f)));
  fs.copyFileSync(path.join(src, f), path.join(dst, f)); index.push({file: f, title: s.meta.title, version: s.meta.version, bpm: s.meta.bpm, key: s.meta.key}); }
fs.writeFileSync(path.join(dst, 'index.json'), JSON.stringify(index));
console.log(`daw.html ${(html.length/1024).toFixed(0)} KB, ${index.length} sessions`);
