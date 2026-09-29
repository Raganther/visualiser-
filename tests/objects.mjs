// Objects test: every mesh object (the wire skull, the unicorn, the maths shapes, the manta) draws and shatters in both
// renderers, a model with a shape key (the manta) plays it with the beat, and each style draws differently;
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
      // a model with a shape key (the manta's wingbeat) plays it both ways over two beats: its weight each frame
      let flap = null;
      if (v.mesh.pieces.some(p => p.morph)) { const pr = v.params, ws = [];
        v.params = (P, x) => { pr.call(v, P, x); ws.push(P.m[v.key].morph); }; __step(70); v.params = pr;
        flap = [Math.min(...ws), Math.max(...ws)]; }
      v.breakApart(); __step(14);
      const apart = ${THUMB};
      set(v.key, 0); __step(40);
      out[v.key] = {on, apart, flap};
    }
    // the skull in each style (render/mesh.js): solid, outline, hologram and points each draw it differently from glass wire
    set('skull', 1); const styles = [];
    for (let n = 0; n < 5; n++) { set('objStyle', n); __step(${mode === 'gl' ? 30 : 45}); styles.push(${THUMB}); }
    set('objStyle', 0); set('skull', 0); __step(40);
    out.styles = styles;
    return {off, out};
  })()`);
  let errors = await page.errors(); await page.close();
  const st = res.out.styles; delete res.out.styles;
  const sd = st.slice(1).map(x => diff(st[0], x)), sok = sd.every(d => d > .3) && !errors.length; if (!sok) failed = true;
  console.log(`${mode}: ${sok ? 'ok' : 'FAILED'}  each style draws the skull its own way (solid, outline, hologram, points against glass: ${sd.map(d => d.toFixed(1)).join(', ')})`);
  for (const [k, {on, apart, flap}] of Object.entries(res.out)) {
    const shown = diff(res.off, on), broke = diff(on, apart), flaps = !flap || (flap[0] < -.3 && flap[1] > .3);
    const ok = shown > .6 && broke > .5 && flaps && !errors.length;   // few-edged shapes (the dodecahedron) change the least
    console.log(`${mode}: ${ok ? 'ok' : 'FAILED'}  ${k} drawn (change ${shown.toFixed(1)}), shatters (change ${broke.toFixed(1)})` +
      (flap ? `, beats its wings (${flap[0].toFixed(2)} to ${flap[1].toFixed(2)})` : ''), errors.length ? errors : '');
    if (!ok) failed = true;
  }
  // Journey with the skull lab: it becomes a centrepiece, with no lens over it (simple mode only; WebGL is too slow to run sections)
  if (mode === '2d') {
    page = await openPage(browser, url, {query: '?lab=skull', noDraw: true});
    const j = await page.evaluate(async () => {
      const {J} = await import('/src/journey/core.js'), {TUNE} = await import('/src/tuning.js');
      for (let i = 0; i < 50 && !TUNE.skull.chance; i++) await new Promise(r => setTimeout(r, 50));   // the lab loads before the first frame
      let seen = 0, lensOver = 0, frames = 0;
      // (each new cast draws it at .5, so it can miss a few in a row: up to 420 s, and a minute more once it's been seen)
      for (let s = 0, until = 420; s < until; s++) { __step(60); const d = __jdbg(); if (J.centre === 'skull' && d.skull > .5) { frames++; if (!seen) until = Math.min(until, s + 60); seen = 1; if (d.sym > 1.05) lensOver++; } }
      return {seen, frames, lensOver, sec: document.querySelector('#jSection').textContent};
    });
    errors = await page.errors(); await page.close();
    const ok = j.seen && !j.lensOver && !errors.length;
    console.log(`journey: ${ok ? 'ok' : 'FAILED'}  skull as centrepiece for ${j.frames} s, under a lens ${j.lensOver} s`, errors.length ? errors : '');
    if (!ok) failed = true;
  }
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
