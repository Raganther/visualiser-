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
const packs = fs.readdirSync(path.join(here, 'packs')).filter(f => /^pack-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5))).map(f => { const p = JSON.parse(fs.readFileSync(path.join(here, 'packs', f), 'utf8')); return {id: p.id, name: p.name, words: p.words || ''}; });
fs.writeFileSync(path.join(listen, 'packs', 'index.json'), JSON.stringify({packs}));
// the library: every pack's sounds in one place, so any column can take a sound from any pack; a drum sound missing a
// voice another pack's clips use plays the nearest one it has
const FILL = {bowl: 'metal', gong: 'tomL', log: 'tomL', logH: 'tomH', tomL: 'tomH', tomH: 'tomL', metal: 'wood', clave: 'wood', shaker: 'metal', rim: 'wood', wood: 'clave'};
const lib = [], seen = new Set(), all = packs.map(p => JSON.parse(fs.readFileSync(path.join(here, 'packs', p.id + '.json'), 'utf8')));
const VOICES = {}; for (const p of all) for (const c of p.clips) if (['kick', 'hats', 'perc'].includes(c.role)) for (const s of c.steps) (VOICES[c.role] ??= new Set()).add(s[1]);
for (const p of all) for (const s of p.sounds) { if (seen.has(s.id)) throw new Error('sound id used twice: ' + s.id); seen.add(s.id); const x = {...s, pack: p.id};
  if (s.voices) { x.voices = {...s.voices}; for (const v of VOICES[s.role] || []) { let f = v, k = 0; while (!x.voices[f] && k++ < 6) f = FILL[f]; if (!x.voices[v] && x.voices[f]) x.voices[v] = x.voices[f]; if (!x.voices[v]) throw new Error(`${s.id}: no voice for ${v}`); } }
  lib.push(x); }
fs.writeFileSync(path.join(listen, 'packs', 'library.json'), JSON.stringify({sounds: lib}));
console.log('library', lib.length, 'sounds;', 'jam-live.html', (fs.statSync(path.join(listen, 'jam-live.html')).size/1024).toFixed(0), 'KB');
