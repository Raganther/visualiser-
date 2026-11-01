// Builds Studio Live into one page (studio/listen/live.html): the app and its worker bundled by esbuild from the same
// native engine the offline renders use, inlined into live/page.html. Usage: node studio/live/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const here = path.dirname(new URL(import.meta.url).pathname), out = path.join(here, '../listen/live.html');
const bundle = async entry => (await build({entryPoints: [path.join(here, entry)], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worker] = await Promise.all([bundle('app.js'), bundle('worker.js')]);
const html = fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*WORKER*/', () => worker).replace('/*APP*/', () => app);
fs.writeFileSync(out, html); console.log(`${out}: ${(html.length/1024).toFixed(0)} KB`);
