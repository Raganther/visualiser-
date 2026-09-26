// Objects test: every mesh object (the wire skull, the unicorn, the maths shapes) draws and shatters in both renderers;
// with ?lab=skull, Journey casts the skull as a centrepiece (never under a lens). Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('objects: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)/a.length;
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode);
  // by hand, each object alone: compare with nothing on, then mid-shatter
  let page = await openPage(browser, url, {groove: false});
  const res = await page.evaluate(`(async () => {
    const {S} = await import('/src/state.js'), {curP} = await import('/src/presets.js'), {OBJECT_VISUALS} = await import('/src/visuals/registry.js');
    document.querySelector('#autoBtn').click();
    const set = (k, v) => { S.active[k] = v; curP[k] = v; };   // at once, instead of easing there
    for (const s of document.querySelectorAll('input[id^=s_]')) if (!/decay|zoom|colorSpeed/.test(s.id)) set(s.id.slice(2), 0);
    set('sym', 1); S.active.mods = {}; __step(60);
    const off = ${THUMB}, out = {};
    for (const v of OBJECT_VISUALS) {
      set(v.key, 1); __step(${mode === 'gl' ? 50 : 90});
      const on = ${THUMB};
      v.breakApart(); __step(14);
      const apart = ${THUMB};
      set(v.key, 0); __step(40);
      out[v.key] = {on, apart};
    }
    return {off, out};
  })()`);
  let errors = await page.errors(); await page.close();
  for (const [k, {on, apart}] of Object.entries(res.out)) {
    const shown = diff(res.off, on), broke = diff(on, apart), ok = shown > .6 && broke > .5 && !errors.length;   // few-edged shapes (the dodecahedron) change the least
    console.log(`${mode}: ${ok ? 'ok' : 'FAILED'}  ${k} drawn (change ${shown.toFixed(1)}), shatters (change ${broke.toFixed(1)})`, errors.length ? errors : '');
    if (!ok) failed = true;
  }
  // Journey with the skull lab: it becomes a centrepiece, with no lens over it (simple mode only; WebGL is too slow to run sections)
  if (mode === '2d') {
    page = await openPage(browser, url, {query: '?lab=skull', noDraw: true});
    const j = await page.evaluate(async () => {
      const {J} = await import('/src/journey/core.js'), {TUNE} = await import('/src/tuning.js');
      for (let i = 0; i < 50 && !TUNE.skull.chance; i++) await new Promise(r => setTimeout(r, 50));   // the lab loads before the first frame
      let seen = 0, lensOver = 0, frames = 0;
      for (let s = 0; s < 240; s++) { __step(60); const d = __jdbg(); if (J.centre === 'skull' && d.skull > .5) { frames++; seen = 1; if (d.sym > 1.05) lensOver++; } }
      return {seen, frames, lensOver, sec: document.querySelector('#jSection').textContent};
    });
    errors = await page.errors(); await page.close();
    const ok = j.seen && !j.lensOver && !errors.length;
    console.log(`journey: ${ok ? 'ok' : 'FAILED'}  skull as centrepiece for ${j.frames} of 240 s, under a lens ${j.lensOver} s`, errors.length ? errors : '');
    if (!ok) failed = true;
  }
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
