// Objects test: every object (the wire skull, the unicorn, the maths shapes, the manta, the lit and faceted ones, the
// morphing ones) draws and shatters in both renderers, a model with a shape key (the manta) plays it with the beat, each
// style draws differently, and so does each kind of the Prism's own kaleidoscope and each look of the morphing ones;
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
      // a model with a shape key plays it over two beats (the manta's wingbeat both ways): its weight each frame
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
    // the Prism's own kaleidoscope (objects/jewel.js): the skin, the mirrors and the tunnel each draw it differently from none
    set('jewel', 1); const inner = [];
    for (let n = 0; n < 4; n++) { S.jewelInner = n; __step(${mode === 'gl' ? 40 : 60}); inner.push(${THUMB}); }
    S.jewelInner = null; set('jewel', 0); __step(40);
    out.inner = inner;
    // the morphing objects' looks (render/sdf.js): chrome, glass, neon, iridescent and toon each draw the ferrofluid differently from its own
    const {TUNE} = await import('/src/tuning.js'); set('ferro', 1); const looks = [];
    for (let n = 0; n < 6; n++) { TUNE.sdf.look = n; __step(${mode === 'gl' ? 30 : 40}); looks.push(${THUMB}); }
    TUNE.sdf.look = -1; set('ferro', 0); __step(40);
    out.looks = looks;
    // the Adjust panel's sliders reach their settings (ui/morph.js)
    const sl = document.querySelector('#mt_ferro_spike'), was = TUNE.ferro.spike; sl.value = .5; sl.dispatchEvent(new Event('input'));
    // under a kaleidoscope that folds it, a morphing one wanders off the centre; without one it stays there
    const fe = (await import('/src/visuals/objects/ferro.js')).default; set('ferro', 1); __step(200); const alone = fe.state().wan;
    TUNE.sdf.wander.on = 1; set('kal', 6); set('kalWhere', 0); __step(${mode === "gl" ? 220 : 400}); const folded = fe.state().wan; set('kalWhere', 3); __step(260); const inside = fe.state().wan; TUNE.sdf.wander.on = 0; set('kal', 0); set('ferro', 0); __step(30);
    out.wander = alone < .05 && folded > .6 && inside < .3;   // (turned on: it wanders only while everything is folded)
    out.panel = TUNE.ferro.spike === .5 && document.querySelectorAll('#morphTune input[type=range]').length > 30; TUNE.ferro.spike = was; localStorage.removeItem('afterglow.morph');
    return {off, out};
  })()`);
  let errors = await page.errors(); await page.close();
  const st = res.out.styles; delete res.out.styles;
  const inn = res.out.inner; delete res.out.inner;
  const lk = res.out.looks, pan = res.out.panel, wan = res.out.wander; delete res.out.looks; delete res.out.panel; delete res.out.wander;
  const ldf = lk.slice(1).map(x => diff(lk[0], x)), lok = ldf.every(d => d > .3) && pan && wan && !errors.length; if (!lok) failed = true;
  console.log(`${mode}: ${lok ? 'ok' : 'FAILED'}  each look draws the ferrofluid its own way (chrome, glass, neon, iridescent, toon against its own: ${ldf.map(d => d.toFixed(1)).join(', ')}); the panel's sliders reach their settings: ${pan}; turned on, it wanders off the centre while a kaleidoscope folds everything and stays in it alone or folded inside: ${wan}`);
  const idf = inn.slice(1).map(x => diff(inn[0], x)), iok = idf.every(d => d > .3) && !errors.length; if (!iok) failed = true;
  console.log(`${mode}: ${iok ? 'ok' : 'FAILED'}  the Prism's own kaleidoscope draws it its own way (skin, mirrors, tunnel against none: ${idf.map(d => d.toFixed(1)).join(', ')})`);
  const sd = st.slice(1).map(x => diff(st[0], x)), sok = sd.every(d => d > .3) && !errors.length; if (!sok) failed = true;
  console.log(`${mode}: ${sok ? 'ok' : 'FAILED'}  each style draws the skull its own way (solid, outline, hologram, points against glass: ${sd.map(d => d.toFixed(1)).join(', ')})`);
  for (const [k, {on, apart, flap}] of Object.entries(res.out)) {
    const shown = diff(res.off, on), broke = diff(on, apart), flaps = !flap || (k === 'manta' ? flap[0] < -.3 && flap[1] > .3 : flap[1] - flap[0] > .2);   // the manta's wings both ways; a bloom, snarl or grip one way
    const ok = shown > .6 && broke > .5 && flaps && !errors.length;   // few-edged shapes (the dodecahedron) change the least
    console.log(`${mode}: ${ok ? 'ok' : 'FAILED'}  ${k} drawn (change ${shown.toFixed(1)}), shatters (change ${broke.toFixed(1)})` +
      (flap ? `, plays its shape key (${flap[0].toFixed(2)} to ${flap[1].toFixed(2)})` : ''), errors.length ? errors : '');
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
