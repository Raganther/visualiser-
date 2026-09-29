// Every visual alone: each world, layer and hit (and the film grain finish) shown by itself in both renderers draws
// something (the picture isn't black) and raises no errors. A quick guard for new visuals; the looks are checked by eye.
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('visuals: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), page = await openPage(browser, url, {groove: true, width: 240, height: 136});
  const r = await page.evaluate(async (mode) => {
    const {VISUALS, byKey} = await import('/src/visuals/registry.js'), {solo} = await import('/src/ui/presets.js');
    const out = [];
    for (const v of VISUALS.filter(v => ['world', 'layer', 'hit'].includes(v.kind))) {
      solo(v.key);
      __step(mode === 'gl' ? 40 : 60);
      if (v.kind === 'hit' && v.fire) { for (let i = 0; i < 30; i++) v.fire({J: (await import('/src/journey/core.js')).J, ty: {}}); __step(2); }
      const c = document.querySelector('canvas'), s = document.createElement('canvas'); s.width = 48; s.height = 27;
      const x = s.getContext('2d'); x.drawImage(c, 0, 0, 48, 27); const d = x.getImageData(0, 0, 48, 27).data;
      let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
      out.push([v.key, v.kind, lit]);
    }
    return out;
  }, mode);
  const errors = await page.errors();
  // a hit alone over black can be small (a bolt, a glint), and the glitch draws nothing itself: they need only not error
  const dark = r.filter(([k, kind, lit]) => kind !== 'hit' && lit < 3);
  const ok = !dark.length && !errors.length;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${mode}: ${r.length} visuals drawn alone${dark.length ? `; dark: ${dark.map(d => d[0]).join(', ')}` : ''}`, errors.length ? errors : '');
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
