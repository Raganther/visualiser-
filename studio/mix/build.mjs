// Builds the mix playground into one page (studio/listen/mix-lab.html: the app, round 4's three songs and their sounds, the shell's
// styles and the parts host's worklet bundled in). Usage: node studio/mix/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { CSS } from '../lib/parts/shell.js';
import { songOf } from './song.mjs';
const here = path.dirname(new URL(import.meta.url).pathname);
const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020'})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [app, worklet] = await Promise.all([bundle(path.join(here, 'app.js')), bundle(path.join(here, '../lib/parts/host.worklet.js'))]);
const song = JSON.stringify(['r4-1', 'r4-2', 'r4-3'].map(songOf)).replace(/<\//g, '<\\/');
const out = path.join(here, '../listen/mix-lab.html');
fs.writeFileSync(out, fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*SHELLCSS*/', () => CSS).replace('/*SONG*/', () => song).replace('/*WORKLET*/', () => worklet).replace('/*APP*/', () => app));
console.log('mix-lab.html', (fs.statSync(out).size/1024).toFixed(0), 'KB');
