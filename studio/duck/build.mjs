// Builds the ducking playground into one page (studio/listen/duck-lab.html: the app, the shell's styles and the
// parts host's worklet bundled in). Usage: node studio/duck/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { CSS } from '../lib/parts/shell.js';
const here = path.dirname(new URL(import.meta.url).pathname);
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worklet] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, '../lib/parts/host.worklet.js'))]);
const out = path.join(here, '../listen/duck-lab.html');
fs.writeFileSync(out, fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*SHELLCSS*/', () => CSS).replace('/*WORKLET*/', () => worklet).replace('/*APP*/', () => app));
console.log('duck-lab.html', (fs.statSync(out).size/1024).toFixed(0), 'KB');
