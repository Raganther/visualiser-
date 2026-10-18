// Explore test (moving into the picture, S.explore): the nested kaleidoscope dive draws its own picture (not the plain
// dive's) in both renderers, each band born from the one outside it; the growing branches draw in both renderers and dive
// on with no jump as a level is shed; the fractal depths fly on; the objects come near on a drop and ease back, and stay
// as they were with the switch off; and with each switch off Journey never uses it, with it on it does.
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('explore: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)/a.length;
const lit = t => t.filter((v, i) => i % 3 === 0 && v + t[i + 1] + t[i + 2] > 40).length;

// in both renderers: the nested dive, the branches, the depths
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), page = await openPage(browser, url, {width: 320, height: 180});
  const f = mode === 'gl' ? 30 : 60;
  const r = await page.evaluate(`(async () => {
    const {solo} = await import('/src/ui/presets.js'), {S} = await import('/src/state.js'), reg = await import('/src/visuals/registry.js');
    solo('land'); S.active.ring = .7; S.active.kal = 6; S.active.kalWhere = 0; S.active.kalMode = 2; __step(${f}); const dive = ${THUMB};
    S.active.kalMode = 14; __step(${f}); const nest = ${THUMB};
    solo('branches'); __step(${f}); const br = ${THUMB}; const u0 = reg.byKey.branches.state().u;
    solo('kifs'); const {kifsAt} = await import('/src/visuals/worlds/kifs.js'); __step(${f}); const kf = ${THUMB};
    const cv = document.querySelector('canvas');
    return {dive, nest, br, kf, gl: !!(cv.getContext('webgl2') || cv.getContext('webgl'))};
  })()`);
  check(`${mode}: still in its own renderer`, r.gl === (mode === 'gl'));
  check(`${mode}: the nested dive draws its own picture, not the plain dive's`, lit(r.nest) > 20 && diff(r.dive, r.nest) > 2, `${lit(r.nest)} lit, change ${diff(r.dive, r.nest).toFixed(1)}`);
  check(`${mode}: the growing branches draw`, lit(r.br) > 20, `${lit(r.br)} lit`);
  check(`${mode}: the fractal depths draw`, lit(r.kf) > 20, `${lit(r.kf)} lit`);
  const errors = await page.errors(); check(`${mode}: no page errors`, !errors.length, errors.join(' '));
  await browser.close();
}
// simple mode: the branches dive on with no jump as a level is shed (the frame's change at the moment no bigger than usual)
{
  const browser = await launch('2d'), page = await openPage(browser, url, {width: 320, height: 180});
  const r = await page.evaluate(`(async () => {
    const {solo} = await import('/src/ui/presets.js'), reg = await import('/src/visuals/registry.js'), {TUNE} = await import('/src/tuning.js');
    solo('branches'); TUNE.dance.amount = 0; TUNE.sdf.spin = 0; const st = reg.byKey.branches.state(); __step(60);
    const out = []; let prev = ${THUMB}, pu = st.u, wraps = 0;
    for (let i = 0; i < 200; i++) { __step(2); const t = ${THUMB}; let d = 0; for (let j = 0; j < t.length; j++) d += Math.abs(t[j] - prev[j]);
      out.push({d: d/t.length, wrap: st.u < pu}); prev = t; pu = st.u; }
    return out; })()`);
  const w = r.filter(x => x.wrap), n = r.filter(x => !x.wrap).map(x => x.d).sort((a, b) => a - b), med = n[n.length >> 1];
  check('the branches shed a level as they dive', w.length >= 1, `${w.length} levels shed`);
  check('with no jump: each shedding changes the picture no more than an ordinary frame does', w.every(x => x.d < Math.max(3, med*4)), `at the shedding ${w.map(x => x.d.toFixed(2)).join(', ')}, usually ${med.toFixed(2)}`);
  const errors = await page.errors(); check('no page errors (the dive)', !errors.length, errors.join(' '));
  await browser.close();
}
// the objects coming to you, and the switches
{
  const browser = await launch('2d'), page = await openPage(browser, url, {noDraw: true});
  const r = await page.evaluate(async () => {
    const {J} = await import('/src/journey/core.js'), {DANCE} = await import('/src/scene/dance.js'), st = await import('/src/journey/steer.js'), {applySteer} = await import('/src/journey/cast.js');
    const {S} = await import('/src/state.js'), {TUNE} = await import('/src/tuning.js'), {chooseWorld} = await import('/src/journey/worlds.js');
    __step(60*10); st.STEER.pin.skull = true; applySteer('skull', 'pin'); __step(60*2);
    const calm = DANCE.near; J.lastDrop = performance.now(); __step(30); const drop = DANCE.near; __step(60*12); const after = DANCE.near;
    S.explore.near = 0; J.lastDrop = performance.now(); __step(60*3); const off = DANCE.near; S.explore.near = 1;
    st.clearSteer(['skull']);
    // over many sections: with each switch off Journey never uses it; on (favoured, so a run this long finds them), it does
    const run = n => { const c = {nest: 0, grow: 0, kifs: 0};
      for (let i = 0; i < n; i++) { for (const f in J.fS) { J.fS[f] = Math.random(); J.fMin[f] = 0; J.fMax[f] = 1; }
        J.tension = Math.random(); Object.assign(J.type, {worldBias: null, hitSeed: null, recipeSeed: {}, casts: {}});
        chooseWorld(true); J.recast = 'fresh'; __step(1);
        if (J.kal && J.kal.mode === 14) c.nest++; if (J.centre === 'branches') c.grow++; if (J.world === 'kifs') c.kifs++; }
      return c; };
    TUNE.extras.kal.mode[14] = 6; TUNE.branches.journey = 8; TUNE.extras.kal.chance = .6;
    Object.assign(S.explore, {nest: 0, grow: 0, kifs: 0}); const offRun = run(200);
    Object.assign(S.explore, {nest: 1, grow: 1, kifs: 1}); const onRun = run(200);
    return {calm, drop, after, off, offRun, onRun};
  });
  check('an object hangs back at first, and fills the screen on a drop', r.calm < 1.5 && r.drop > 2.5, `size ${r.calm.toFixed(2)}, then ${r.drop.toFixed(2)}`);
  check('then eases back over a few bars', r.after < r.drop - .8, `${r.after.toFixed(2)}`);
  check('with its switch off it stays as it was', Math.abs(r.off - 1) < .1, `${r.off.toFixed(2)}`);
  check('with the switches off Journey never uses them', r.offRun.nest + r.offRun.grow + r.offRun.kifs === 0, JSON.stringify(r.offRun));
  check('with them on it does', r.onRun.nest > 0 && r.onRun.grow > 0 && r.onRun.kifs > 0, JSON.stringify(r.onRun));
  const errors = await page.errors(); check('no page errors (Journey)', !errors.length, errors.join(' '));
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
