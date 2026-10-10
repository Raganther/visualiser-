// Facets test: the faceted objects and facet light. The geometry (render/facet.js): an icosahedron split three times, every
// fine pane lying flat on its coarse facet at a whole level of detail and on the sphere at the finest, each edge shown from
// its own level; the gem cut into five gores, which close into the ball exactly. The Prism (objects/prism.js) draws in both
// renderers and changes as the music plays, a drop gives it every facet, a section's program is its own (a returning
// section gets the same one back), it opens into a flat star whose petals part, its square forms close at their seams, it
// flies from the gem to the square and back, and a drop opens a closed form out. The gem orbit draws all five gems.
// The wire objects' panes light with the kick (scene/facets.js), and not with facet light off. The rose window and the
// Lattice draw in both renderers. Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';
import { facetGeo, facetPlace, sheetGeo, gemSheetGeo, facetPlaceP } from '../src/render/facet.js';

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

// the gem cut open: five gores of 256 facets, each corner on a cut one per gore, all of a gore's coarse corners its own
{
  const G = gemSheetGeo(3), B = facetGeo(3), per = [0, 1, 2, 3, 4].map(g => G.gore.filter(x => x === g).length);
  let own = 0; for (let v = 0; v < G.nv; v++) for (let j = 0; j < 12; j++) if (G.GO[G.AI[v*12 + j]] !== G.GO[v]) own++;
  check('the gem cut into five gores, each corner on a cut one per gore', per.every(n => n === 256) && G.nv > B.nv && own === 0, `${per.join(', ')}; ${B.nv} corners → ${G.nv}; ${own} from another gore`);
}

// the sheet: 8 to 2,048 facets on a square, every vertex on its grid, lying flat it all faces one way
{
  const G = sheetGeo(4), S3 = new Float32Array(G.nv*3), D = new Float32Array(G.nv).fill(4), X = {};
  for (let v = 0; v < G.nv; v++) { S3[v*3] = G.UV[v*2]; S3[v*3 + 1] = G.UV[v*2 + 1]; }
  facetPlaceP(G, S3, D, X); let nz = 1; for (let f = 0; f < G.nf; f++) nz = Math.min(nz, X.fn[f*3 + 2]);
  check('the sheet: 8, 32, 128, 512 and 2,048 facets on a 33 × 33 grid, flat and facing one way', G.NF.join() === '8,32,128,512,2048' && G.nv === 33*33 && [...G.VI].every(i => i >= 0) && nz > .999, `${G.NF.join()}, ${G.nv} corners, least facing ${nz.toFixed(3)}`);
}

const {srv, url} = await serve();
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), page = await openPage(browser, url, {width: 320, height: 180});
  const r = await page.evaluate(`(async () => {
    const {S} = await import('/src/state.js'), {curP} = await import('/src/presets.js'), {J} = await import('/src/journey/core.js');
    const {prismState, prismProgram} = await import('/src/visuals/objects/prism.js'), {TUNE} = await import('/src/tuning.js');
    (await import('/src/render/facet.js')).FACET.wait = 3;   // (as on a real graphics card, its program isn't ready at first: the prism once never drew there)
    document.querySelector('#autoBtn').click();
    const set = (k, v) => { S.active[k] = v; curP[k] = v; };
    for (const s of document.querySelectorAll('input[id^=s_]')) if (!/decay|zoom|colorSpeed/.test(s.id)) set(s.id.slice(2), 0);
    set('sym', 1); S.active.mods = {}; __step(30);
    const off = ${THUMB}, out = {};
    // the prism: drawn, changing with the music, every facet on a drop
    set('prism', 1); __step(${mode === 'gl' ? 60 : 120});
    const a = ${THUMB}; __step(${mode === 'gl' ? 40 : 80}); const b = ${THUMB};
    const det0 = prismState().det; J.lastDrop = performance.now() + 1; __step(10);
    out.prism = {shown: 0, moving: 0, det0, det1: prismState().det, F: prismState().G.F, a, b};
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
    // the Prism's forms: open, the star's petals part (a corner on a cut in two places); closed, the gem, its gores meeting
    // again; the square's tube, ring and twist close at their seams; it draws, a ring isn't mountains, and it flies from the
    // gem to the square and back; a drop opens a closed form out
    set('prism', 1); const pm = await import('/src/visuals/objects/prism.js'), FG = await import('/src/render/facet.js'), SG = FG.sheetGeo(4), GG = FG.gemSheetGeo(3);
    const at = (x, y) => SG.VI[Math.round((x + 1)*16)*33 + Math.round((y + 1)*16)], gap = (p, a, b) => Math.hypot(p[a*3] - p[b*3], p[a*3 + 1] - p[b*3 + 1], p[a*3 + 2] - p[b*3 + 2]);
    const twin = []; { const seen = new Map(); for (let v = 0; v < GG.nv; v++) { const k = GG.DIR.slice(v*3, v*3 + 3).map(x => x.toFixed(4)).join(); if (seen.has(k) && GG.TH[v] > .3 && GG.TH[v] < 2.8) twin.push([seen.get(k), v]); else seen.set(k, v); } }
    const twins = p => Math.max(...twin.map(([a, b]) => gap(p, a, b)));
    const seams = {}, mtn = TUNE.prism.mtn, rl = [TUNE.prism.ripLift, TUNE.prism.ripLiftClosed]; TUNE.prism.mtn = 0; TUNE.prism.ripLift = TUNE.prism.ripLiftClosed = 0;
    pm.prismForm('star', true); __step(2); const open = twins(pm.prismState().X.pos);
    pm.prismForm('gem', true); __step(2); seams.gem = twins(pm.prismState().X.pos);
    for (const f of ['tube', 'ring']) { pm.prismForm(f, true); __step(2); const p = pm.prismState().X.pos;
      seams[f] = f === 'tube' ? gap(p, at(1, .5), at(-1, .5)) : Math.max(gap(p, at(1, .5), at(-1, .5)), gap(p, at(.5, 1), at(.5, -1))); }
    TUNE.prism.mtn = mtn; [TUNE.prism.ripLift, TUNE.prism.ripLiftClosed] = rl;
    pm.prismForm('peaks', true); __step(${mode === 'gl' ? 40 : 80}); const fa = ${THUMB};
    pm.prismForm('ring', true); __step(${mode === 'gl' ? 40 : 80}); const fb = ${THUMB};
    // flying across: from the ring (the square) to the star (the gem), its facets out a moment, then the other body
    pm.prismForm('star'); const sw = [pm.prismState().body, pm.prismState().swapping]; __step(${mode === 'gl' ? 60 : 90}); sw.push(pm.prismState().body, pm.prismState().form);
    pm.prismForm(null); pm.prismForm('gem', true); pm.prismForm(null); J.lastDrop = performance.now() + 2; __step(5);
    // the improviser: twelve steps make (nearly) twelve different shapes, not a loop
    const opened = pm.prismState().form; pm.prismForm(null); const sig = g => g.name + ':' + Object.keys(g.w).sort().join('+') + ':' + g.sf + ':' + [g.sqx, g.sqy, g.twy, g.la].map(v => v.toFixed(1)).join(',');
    const seen = new Set(); for (let i = 0; i < 12; i++) { pm.prismImprovise(.5); __step(3); seen.add(sig(pm.prismState().g)); }
    out.fold = {open, seams, fa, fb, sw, opened, kinds: seen.size};
    set('prism', 0); __step(30);
    // the rose window and the Lattice
  for (const k of ['rosette', 'lattice']) { set(k, 1); __step(${mode === 'gl' ? 50 : 100}); out[k] = ${THUMB}; set(k, 0); __step(30); }
    return {off, out};
  })()`);
  const errors = await page.errors();
  const p = r.out.prism, sh = diff(r.off, p.a), mv = diff(p.a, p.b);
  check(`${mode}: the prism draws and changes as the music plays`, sh > .6 && mv > .2, `shown ${sh.toFixed(1)}, moving ${mv.toFixed(1)}`);
  check(`${mode}: a drop gives it every facet`, p.det1 === p.F && p.det0 < p.F, `${p.det0.toFixed(1)} → ${p.det1} of ${p.F}`);
  check(`${mode}: a section's program is its own, and comes back with it`, r.out.prog.same && r.out.prog.differ, JSON.stringify(r.out.prog));
  check(`${mode}: the gem orbit draws all five`, r.out.gems.on === 5 && diff(r.off, r.out.gems.pic) > .4, `${r.out.gems.on} on, change ${diff(r.off, r.out.gems.pic).toFixed(1)}`);
  check(`${mode}: the wire sphere's panes light with the kick, and not with facet light off`, r.out.fx.rings > 5 && r.out.fx.none && diff(r.out.fx.lit, r.out.fx.plain) > .05, `rings in ${r.out.fx.rings} of 40 frames, off: ${r.out.fx.none}, change ${diff(r.out.fx.lit, r.out.fx.plain).toFixed(2)}`);
    const fo = r.out.fold, fsh = diff(r.off, fo.fa), fmv = diff(fo.fa, fo.fb), worst = Math.max(...Object.values(fo.seams));
  check(`${mode}: the Prism opens into a star whose petals part`, fo.open > .05, `cut corners ${fo.open.toFixed(2)} apart`);
  check(`${mode}: its closed forms close (the gem's gores, the tube's sides, the ring's ends meet)`, worst < 1e-3, Object.entries(fo.seams).map(([k, v]) => `${k} ${v.toExponential(1)}`).join(', '));
  check(`${mode}: its mountains draw, and a ring isn't mountains`, fsh > .5 && fmv > .3, `shown ${fsh.toFixed(1)}, changed ${fmv.toFixed(1)}`);
  check(`${mode}: it flies from the square to the gem (apart first, then gathered as the other)`, fo.sw.join() === 's,true,g,star', fo.sw.join());
  check(`${mode}: a drop opens a closed form out`, fo.opened === 'peaks', fo.opened);
  check(`${mode}: the improviser makes new shapes rather than looping`, fo.kinds >= 9, `${fo.kinds} different in 12 steps`);
  for (const k of ['rosette', 'lattice']) { const d = diff(r.off, r.out[k]); check(`${mode}: the ${k === 'rosette' ? 'rose window' : 'Lattice'} draws`, d > .4, `change ${d.toFixed(1)}`); }
  check(`${mode}: no page errors`, !errors.length, errors.join('; '));
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
