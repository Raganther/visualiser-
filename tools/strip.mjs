// A motion strip and measures of feel: frames across a few bars laid out as one picture (so movement, arrival and rhythm
// can be judged, not just one still), and numbers for what the user says in words: how bright, how much of the screen is
// lit, how busy (detail), how fast it moves, how often it flashes, and how many things are on screen at once.
// Usage: node tools/strip.mjs [--preset NAME | --solo KEY] [--query "?lab=cosmos"] [--eval "js"] [--mode 2d|gl]
//                             [--secs 8] [--frames 8] [--size 480x270] [--warm 4] [--out dir] [--name strip]
import fs from 'fs';
import path from 'path';
import { serve, launch, openPage } from '../tests/lib.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const mode = opt('mode', '2d'), secs = +opt('secs', 8), frames = +opt('frames', 8), warm = +opt('warm', 4), out = opt('out', 'strip');
const [width, height] = opt('size', '480x270').split('x').map(Number), name = opt('name', 'strip');
fs.mkdirSync(out, {recursive: true});
const {srv, url} = await serve(), b = await launch(mode), page = await openPage(b, url, {width, height, query: opt('query', '')});
const r = await page.evaluate(async ([o, secs, frames, warm]) => {
  document.querySelector('#welcome').style.display = 'none'; document.body.classList.add('clean');
  if (o.preset || o.solo) { const {setJourney} = await import('/src/ui/controls.js'); setJourney(false); }
  if (o.preset) { const {presets} = await import('/src/presets.js'), {setPreset} = await import('/src/ui/presets.js');
    const p = presets.find(p => p.name.toLowerCase() === o.preset.toLowerCase()); if (!p) return {err: 'no preset ' + o.preset}; setPreset(p); }
  if (o.solo) { const {solo} = await import('/src/ui/presets.js'); solo(o.solo); }
  if (o.eval) await (0, eval)(`(async () => { ${o.eval} })()`);
  for (let i = 0; i < warm*60; i += 30) __step(30);
  const cv = document.querySelector('canvas'), S = document.createElement('canvas'), s = S.getContext('2d', {willReadFrequently: true});
  S.width = 64; S.height = 36;
  const cols = Math.min(4, frames), rows = Math.ceil(frames/cols), tw = 240, th = Math.round(240*cv.height/cv.width);
  const G = document.createElement('canvas'); G.width = cols*tw + (cols - 1)*4; G.height = rows*th + (rows - 1)*4; const g = G.getContext('2d');
  g.fillStyle = '#222'; g.fillRect(0, 0, G.width, G.height);
  const lumas = [], diffs = [], lit = [], detail = [], now = new Set(); let prev = null, k = 0;
  const N = secs*60, every = Math.max(1, Math.floor(N/frames));
  for (let f = 0; f < N; f++) {
    __step(1);
    s.drawImage(cv, 0, 0, 64, 36); const d = s.getImageData(0, 0, 64, 36).data, L = new Float32Array(64*36);
    let sum = 0, on = 0, ed = 0;
    for (let i = 0; i < L.length; i++) { L[i] = (d[i*4]*.2126 + d[i*4 + 1]*.7152 + d[i*4 + 2]*.0722)/255; sum += L[i]; if (L[i] > .2) on++; }
    for (let y = 0; y < 35; y++) for (let x = 0; x < 63; x++) { const i = y*64 + x; ed += Math.abs(L[i] - L[i + 1]) + Math.abs(L[i] - L[i + 64]); }
    lumas.push(sum/L.length); lit.push(on/L.length); detail.push(ed/(63*35));
    if (prev) { let dd = 0; for (let i = 0; i < L.length; i++) dd += Math.abs(L[i] - prev[i]); diffs.push(dd/L.length); }
    prev = L;
    if (f % every === every - 1 && k < frames) { g.drawImage(cv, (k % cols)*(tw + 4), Math.floor(k/cols)*(th + 4), tw, th); k++;
      const t = document.querySelector('#onNow'); if (t) now.add(t.textContent.split('. Set by')[0]); }
  }
  let flashes = 0;   // a jump of a quarter or more in brightness within two frames (the kick's flash, a hit)
  for (let i = 2; i < lumas.length; i++) { const lo = Math.min(lumas[i - 1], lumas[i - 2]); if (lumas[i] - lo > Math.max(.012, lo*.25)) { flashes++; i += 6; } }
  const mean = a => a.reduce((x, y) => x + y, 0)/Math.max(1, a.length);
  return {png: G.toDataURL('image/png'), m: {brightness: mean(lumas), lit: mean(lit), detail: mean(detail), motionPerSec: mean(diffs)*60, flashesPerSec: flashes/secs,
    onScreen: [...now]}};
}, [{preset: opt('preset'), solo: opt('solo'), eval: opt('eval')}, secs, frames, warm]);
if (r.err) { console.log(r.err); process.exit(1); }
const f = path.join(out, `${name}-${mode}.png`); fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
const m = r.m, n = s => s.split(/[;,]/).map(x => x.trim()).filter(x => x && !x.startsWith('no ')).length;
fs.writeFileSync(path.join(out, `${name}-${mode}.json`), JSON.stringify(m, null, 1));
console.log(`${f}
brightness ${m.brightness.toFixed(2)} (0 black .. 1 white); lit ${(m.lit*100).toFixed(0)}% of the screen; detail ${m.detail.toFixed(3)}
motion ${m.motionPerSec.toFixed(2)} a second (the picture's average change); flashes ${m.flashesPerSec.toFixed(2)} a second
on screen: ${m.onScreen.map(s => `${s} (${n(s)} things)`).join(' | ')}
errors ${JSON.stringify(await page.errors())}`);
await b.close(); srv.close();
