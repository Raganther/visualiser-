// Builds the Studio DAW into one page (studio/listen/studio-daw.html: the app, the native worker and the songs bundled),
// after Studio Jam's build, whose sound library it plays. Usage: node studio/arrange/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const here = path.dirname(new URL(import.meta.url).pathname), listen = path.join(here, '../listen');
execFileSync(process.execPath, [path.join(here, '../jam/build.mjs')], {stdio: 'inherit'});
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worker] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, '../live/worker.js'))]);
const out = path.join(listen, 'studio-daw.html');
fs.writeFileSync(out, fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*WORKER*/', () => worker).replace('/*APP*/', () => app));
console.log('studio-daw.html', (fs.statSync(out).size/1024).toFixed(0), 'KB');
