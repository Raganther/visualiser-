// One visual alone, in both renderers: solos it (as the panel's Solo button does), steps the page on its test clock with the
// built-in groove, and saves a still of each. For checking how something looks without anything else over it.
// Usage: node tools/look.mjs <key> [--mode both|gl|2d] [--frames 300] [--size 960x540] [--out dir] [--eval "js run before stepping"]
import fs from 'fs';
import path from 'path';
import { serve, launch, openPage } from '../tests/lib.mjs';

const args = process.argv.slice(2), key = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
if (!key) { console.log('usage: node tools/look.mjs <key> [--mode both|gl|2d] [--frames 300] [--size 960x540] [--out dir] [--eval js]'); process.exit(1); }
const modes = opt('mode', 'both') === 'both' ? ['gl', '2d'] : [opt('mode')], frames = +opt('frames', 300), out = opt('out', 'look');
const [width, height] = opt('size', '960x540').split('x').map(Number);
fs.mkdirSync(out, {recursive: true});
const {srv, url} = await serve();
for (const mode of modes) {
  const b = await launch(mode), page = await openPage(b, url, {width, height});
  const r = await page.evaluate(async ([key, frames, js]) => {
    document.querySelector('#welcome').style.display = 'none'; document.body.classList.add('clean');
    const {byKey} = await import('/src/visuals/registry.js');
    if (!byKey[key]) return {err: `no visual "${key}"; try one of ${Object.keys(byKey).join(', ')}`};
    const {solo} = await import('/src/ui/presets.js'); solo(key);
    if (js) await (0, eval)(`(async () => { ${js} })()`);
    for (let i = 0; i < frames; i += 30) __step(Math.min(30, frames - i));
    return {png: document.querySelector('canvas').toDataURL('image/png'), now: document.querySelector('#onNow').textContent,
      caption: document.querySelector('#caption').textContent};
  }, [key, frames, opt('eval', '')]);
  if (r.err) { console.log(r.err); await b.close(); break; }
  const f = path.join(out, `${key}-${mode}.png`);
  fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
  console.log(`${mode}: ${f}\n  on screen: ${r.now}` + (r.caption ? `\n  caption: ${r.caption}` : '') + `\n  errors: ${JSON.stringify(await page.errors())}`);
  await b.close();
}
srv.close();
