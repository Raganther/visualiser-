// Captures scores as sessions (studio/sessions/<track>.json): each score run on a desk that writes down everything it
// does (lib/capture.js), the data the DAW shows and plays and render.mjs --session renders. Usage: node studio/session.mjs 02-copper-wire [...]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, ROOT } from '../tests/lib.mjs';
const names = process.argv.slice(2).filter(a => !a.startsWith('--')), out = path.join(ROOT, 'studio/sessions'); fs.mkdirSync(out, {recursive: true});
const {srv, url} = await serve(), browser = await launch('2d'), page = await browser.newPage();
page.on('pageerror', e => console.log('page error:', e.message));
await page.goto(url + 'studio/');
for (const name of names) {
  const s = await page.evaluate(async name => {
    let r = 99991; Math.random = () => { r = (r*1664525 + 1013904223) >>> 0; return r/4294967296; };
    const {desk} = await import('/studio/lib/desk.js'), {capture} = await import('/studio/lib/capture.js'), T = await import(`/studio/tracks/${name}.js`), m = T.meta;
    const ctx = new OfflineAudioContext(2, 44100, 44100), d = capture(desk(ctx, {bpm: m.bpm, swing: m.swing || 0, seed: m.seed || 1}));
    d.meta = m; T.score(d);
    return d.session({...m, from: name}, T.SECTIONS);
  }, name);
  const f = path.join(out, name + '.json'); fs.writeFileSync(f, JSON.stringify(s));
  console.log(`${name}: ${s.tracks.filter(t => t.notes.length).length} tracks, ${s.tracks.reduce((a, t) => a + t.notes.length, 0)} notes, ${s.ops.length} ops, ${(fs.statSync(f).size/1024).toFixed(0)} KB`);
}
await browser.close(); srv.close();
