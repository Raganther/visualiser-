// Builds the Studio page (studio/listen/studio.html): Studio Jam (the Session view) and the Studio DAW (the Arrangement
// view) each built first, then laid into the shell (page.html) as base64. Its packs are the jam's (studio/listen/packs/,
// published beside it). Usage: node studio/studio/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname), listen = path.join(here, '../listen');
for (const b of ['../jam/build.mjs', '../arrange/build.mjs']) execFileSync(process.execPath, [path.join(here, b)], {stdio: ['ignore', 'ignore', 'inherit']});
import { buildSync } from 'esbuild';
const SETTINGS = buildSync({entryPoints: [path.join(here, 'settings.js')], bundle: true, format: 'iife', globalName: '__studioSettings', write: false, minify: true}).outputFiles[0].text;
const b64 = f => fs.readFileSync(path.join(listen, f)).toString('base64');
fs.writeFileSync(path.join(listen, 'studio.html'), fs.readFileSync(path.join(here, 'page.html'), 'utf8').replace('/*SETTINGS*/', () => SETTINGS.replace(/<\/script/g, '<\\/script')).replace('/*SESSION*/', () => b64('jam-live.html')).replace('/*ARRANGE*/', () => b64('studio-daw.html')));
console.log('studio.html', (fs.statSync(path.join(listen, 'studio.html')).size/1024).toFixed(0), 'KB');
