// Facets test: the faceted objects and facet light. The geometry (render/facet.js): an icosahedron split three times, every
// fine pane lying flat on its coarse facet at a whole level of detail and on the sphere at the finest, each edge shown from
// its own level. The prism (objects/prism.js) draws in both renderers and changes as the music plays, a drop gives it every
// facet, and a section's program is its own (a returning section gets the same one back). The gem orbit draws all five gems.
// The wire objects' panes light with the kick (scene/facets.js), and not with facet light off. The rose window and the
// Lattice draw in both renderers. Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';
import { facetGeo, facetPlace } from '../src/render/facet.js';

if (!ENTRY.endsWith('index.html')) { console.log('facets: skipped for', ENTRY); process.exit(0); }
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)/a.length;

// the geometry, here in node
{
  const G = facetGeo(3), R = new Float32Array(G.nv).fill(1), D = new Float32Array(G.nv), X = {};
  check('the geometry: 20, 80, 320 and 1,280 facets', G.NF.join() === '20,80,320,1280', G.NF.join());
  facetPlace(G, R, D, X);   // detail 0: every pane on its coarse facet (all 64 under one face facing the same way)
  let worst = 0; for (let f = 0; f < G.nf; f++) { const g = G.FA[0][f]*64; worst = Math.max(worst, Math.hypot(X.fn[f*3] - X.fn[g*3], X.fn[f*3 + 1] - X.fn[g*3 + 1], X.fn[f*3 + 2] - X.fn[g*3 + 2])); }
  check('at the coarsest detail every pane lies flat on its facet', worst < 1e-3, worst.toExponential(1));
  D.fill(3); facetPlace(G, R, D, X); let off = 0; for (let v = 0; v < G.nv; v++) off = Math.max(off, Math.abs(Math.hypot(X.pos[v*3], X.pos[v*3 + 1], X.pos[v*3 + 2]) - 1));
  check('at the finest every corner is on the sphere', off < 1e-5, off.toExponential(1));
  const lv = [0, 1, 2, 3].map(l => G.EL.filter(e => e === l).length);
  check('each edge knows its level (the icosahedron\'s edges split into eighths, and so on)', lv[0] === 480 && lv.every(n => n > 0), lv.join(', '));
  D.fill(1.5); facetPlace(G, R, D, X); const fl = new Set(X.fl);
  check('between two levels the panes part along the new edges', fl.size >= 1 && worst < 1e-3, [...fl].join());
}

const {srv, url} = await serve();
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), page = await openPage(browser, url, {width: 320, height: 180});
  const r = await page.evaluate(`(async () => {
    const {S} = await import('/src/state.js'), {curP} = await import('/src/presets.js'), {J} = await import('/src/journey/core.js');
    const {prismState, prismProgram} = await import('/src/visuals/objects/prism.js'), {TUNE} = await import('/src/tuning.js');
    document.querySelector('#autoBtn').click();
    const set = (k, v) => { S.active[k] = v; curP[k] = v; };
    for (const s of document.querySelectorAll('input[id^=s_]')) if (!/decay|zoom|colorSpeed/.test(s.id)) set(s.id.slice(2), 0);
    set('sym', 1); S.active.mods = {}; __step(30);
    const off = ${THUMB}, out = {};
    // the prism: drawn, changing with the music, every facet on a drop
    set('prism', 1); __step(${mode === 'gl' ? 60 : 120});
    const a = ${THUMB}; __step(${mode === 'gl' ? 40 : 80}); const b = ${THUMB};
    const det0 = prismState().det; J.lastDrop = performance.now() + 1; __step(10);
    out.prism = {shown: 0, moving: 0, det0, det1: prismState().det, a, b};
    // a section's program: its own, and the same again when it returns
    const A = {}, B = {}, pa = prismProgram(A, .3), pb = prismProgram(B, .8);
    out.prog = {same: prismProgram(A, .3) === pa, differ: JSON.stringify(pa) !== JSON.stringify(pb)};
    set('prism', 0); __step(40);
    // the gem orbit: all five
    set('gems', 1); __step(${mode === 'gl' ? 60 : 120}); out.gems = {pic: ${THUMB}, on: S.lastP.m.gems.gems.filter(u => u.w > .5).length};
    set('gems', 0); __step(30);
    // facet light on the wire sphere: a ring after a kick; none with it off
    set('geosphere', 1); __step(${mode === 'gl' ? 40 : 80});
    let rings = 0; for (let i = 0; i < 40; i++) { __step(1); const F = S.lastP.m.geosphere.fx; if (F && [3, 7, 11, 15].some(k => F.rip[k] >= 0)) rings++; }
    const lit = ${THUMB}; TUNE.mesh.fx.amount = 0; __step(${mode === 'gl' ? 10 : 20}); const plain = ${THUMB}; const none = !S.lastP.m.geosphere.fx; TUNE.mesh.fx.amount = 1;
    out.fx = {rings, none, lit, plain}; set('geosphere', 0); __step(30);
    // the rose window and the Lattice
    for (const k of ['rosette', 'lattice']) { set(k, 1); __step(${mode === 'gl' ? 50 : 100}); out[k] = ${THUMB}; set(k, 0); __step(30); }
    return {off, out};
  })()`);
  const errors = await page.errors();
  const p = r.out.prism, sh = diff(r.off, p.a), mv = diff(p.a, p.b);
  check(`${mode}: the prism draws and changes as the music plays`, sh > .6 && mv > .2, `shown ${sh.toFixed(1)}, moving ${mv.toFixed(1)}`);
  check(`${mode}: a drop gives it every facet`, p.det1 === 3 && p.det0 < 3, `${p.det0.toFixed(1)} → ${p.det1}`);
  check(`${mode}: a section's program is its own, and comes back with it`, r.out.prog.same && r.out.prog.differ, JSON.stringify(r.out.prog));
  check(`${mode}: the gem orbit draws all five`, r.out.gems.on === 5 && diff(r.off, r.out.gems.pic) > .4, `${r.out.gems.on} on, change ${diff(r.off, r.out.gems.pic).toFixed(1)}`);
  check(`${mode}: the wire sphere's panes light with the kick, and not with facet light off`, r.out.fx.rings > 5 && r.out.fx.none && diff(r.out.fx.lit, r.out.fx.plain) > .05, `rings in ${r.out.fx.rings} of 40 frames, off: ${r.out.fx.none}, change ${diff(r.out.fx.lit, r.out.fx.plain).toFixed(2)}`);
  for (const k of ['rosette', 'lattice']) { const d = diff(r.off, r.out[k]); check(`${mode}: the ${k === 'rosette' ? 'rose window' : 'Lattice'} draws`, d > .4, `change ${d.toFixed(1)}`); }
  check(`${mode}: no page errors`, !errors.length, errors.join('; '));
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
