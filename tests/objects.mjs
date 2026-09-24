// Objects test: the skull draws in both renderers and breaks apart; with ?lab=skull, Journey casts it as a centrepiece
// (never under a lens). Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('objects: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)/a.length;
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode);
  // by hand: everything off but the skull, then compare with it off, and mid-break
  let page = await openPage(browser, url, {groove: false});
  const r = await page.evaluate(`(async () => {
    document.querySelector('#autoBtn').click();
    const set = (k, v) => { const s = document.querySelector('#s_' + k); s.value = v; s.dispatchEvent(new Event('input')); };
    for (const s of document.querySelectorAll('input[id^=s_]')) if (!/decay|zoom|colorSpeed/.test(s.id)) set(s.id.slice(2), 0);
    set('sym', 1); __step(60);
    const off = ${THUMB};
    set('skull', 1); __step(60);
    const on = ${THUMB};
    (await import('/src/visuals/objects/skull.js')).default.breakApart(); __step(14);
    const apart = ${THUMB};
    return {off, on, apart};
  })()`);
  const shown = diff(r.off, r.on), broke = diff(r.on, r.apart);
  let errors = await page.errors(); await page.close();
  let ok = shown > 3 && broke > 1.5 && !errors.length;
  console.log(`${mode}: ${ok ? 'ok' : 'FAILED'}  skull drawn (change ${shown.toFixed(1)}), breaks apart (change ${broke.toFixed(1)})`, errors.length ? errors : '');
  if (!ok) failed = true;
  // Journey with the skull lab: it becomes a centrepiece, with no lens over it (simple mode only; WebGL is too slow to run sections)
  if (mode === '2d') {
    page = await openPage(browser, url, {query: '?lab=skull'});
    const j = await page.evaluate(async () => {
      const {J} = await import('/src/journey/core.js'), {TUNE} = await import('/src/tuning.js');
      for (let i = 0; i < 50 && !TUNE.skull.chance; i++) await new Promise(r => setTimeout(r, 50));   // the lab loads before the first frame
      let seen = 0, lensOver = 0, frames = 0;
      for (let s = 0; s < 240; s++) { __step(60); const d = __jdbg(); if (J.centre === 'skull' && d.skull > .5) { frames++; seen = 1; if (d.sym > 1.05) lensOver++; } }
      return {seen, frames, lensOver, sec: document.querySelector('#jSection').textContent};
    });
    errors = await page.errors(); await page.close();
    ok = j.seen && !j.lensOver && !errors.length;
    console.log(`journey: ${ok ? 'ok' : 'FAILED'}  skull as centrepiece for ${j.frames} of 240 s, under a lens ${j.lensOver} s`, errors.length ? errors : '');
    if (!ok) failed = true;
  }
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
