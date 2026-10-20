// Builds Studio Jam into one page (studio/listen/jam-live.html: the app and the native worker bundled from the same code
// the renders use), with its packs beside it (studio/listen/packs/). Usage: node studio/jam/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const here = path.dirname(new URL(import.meta.url).pathname), listen = path.join(here, '../listen');
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worker] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, '../live/worker.js'))]);
fs.writeFileSync(path.join(listen, 'jam-live.html'), fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*WORKER*/', () => worker).replace('/*APP*/', () => app));
fs.mkdirSync(path.join(listen, 'packs'), {recursive: true});
for (const f of fs.readdirSync(path.join(here, 'packs'))) fs.copyFileSync(path.join(here, 'packs', f), path.join(listen, 'packs', f));
console.log('jam-live.html', (fs.statSync(path.join(listen, 'jam-live.html')).size/1024).toFixed(0), 'KB');
