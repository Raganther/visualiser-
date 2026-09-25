// Scene test: composition features in both renderers, each against the same run without it (same seed and steps, so the
// only difference is the scene). A fill shows inside the skull and not around it; a mask keeps the trails to one side of its
// silhouette; a world's front plane (between) covers the comets where its near buildings are; an object can stand among
// a world's planes; trail groups put one layer behind the buildings and another in front. Runs on index.html.
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('scene: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const report = (ok, msg) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
// the thumbnail's middle (where the skull is) and its outer edge
const MID = [], EDGE = [];
for (let ty = 0; ty < 18; ty++) for (let tx = 0; tx < 32; tx++) {
  if (ty >= 6 && ty <= 11 && tx >= 13 && tx <= 18) MID.push(ty*32 + tx);
  if (ty < 2 || ty > 15 || tx < 4 || tx > 27) EDGE.push(ty*32 + tx);
}
const mean = (t, idx) => idx.reduce((s, i) => s + t[i], 0)/idx.length;
const diff = (a, b, idx) => idx.reduce((s, i) => s + Math.abs(a[i] - b[i]), 0)/idx.length;

const AMONG = [{world: 'all'}, {trails: 'main'}, {object: 'skull'}, {world: 'front'}, {hits: true}];
const GROUPS = [{world: 'all'}, {trails: 'back', layers: ['comets']}, {world: 'front'}, {trails: 'main'}, {hits: true}, {objects: true}];
const WORLD_IN = [{trails: 'main'}, {object: 'skull', fill: {world: true}}, {hits: true}];
const COMETS_IN = [{world: 'all'}, {trails: 'main'}, {object: 'skull', fill: {trails: 'inner', layers: ['comets']}}, {hits: true}];
// thumbnails of one run (settings and scene) at each of several frame counts. Runs are deterministic, so one page load
// gives every snapshot a separate run would, and a repeated run comes from the cache
let cache = new Map();
async function runs(browser, settings, scene, frames){
  const key = JSON.stringify([settings, scene, frames]);
  if (cache.has(key)) return cache.get(key);
  const page = await openPage(browser, url, {groove: false, query: '?tune=mesh.spin=0&tune=render.bloom=0'});   // the glow off: this is about what covers what
  const t = await page.evaluate(`(async () => {
    const {S} = await import('/src/state.js'), {curP} = await import('/src/presets.js'), {setJourney} = await import('/src/ui/controls.js');
    setJourney(false);
    const set = (k, v) => { S.active[k] = v; curP[k] = v; };
    for (const s of document.querySelectorAll('input[id^=s_]')) if (!/decay|zoom|colorSpeed/.test(s.id)) set(s.id.slice(2), 0);
    set('sym', 1); S.active.mods = {};
    for (const [k, v] of Object.entries(${JSON.stringify(settings)})) set(k, v);
    S.scene = ${JSON.stringify(scene)};
    const out = []; let done = 0;
    for (const f of ${JSON.stringify(frames)}) { __step(f - done); done = f; out.push(${THUMB}); }
    return out;
  })()`);
  const errors = await page.errors(); await page.close();
  if (errors.length) { failed = true; console.log('errors', errors); }
  cache.set(key, t);
  return t;
}
const run = async (browser, settings, scene, f) => (await runs(browser, settings, scene, [f]))[0];
const sum = (a, b, idx) => a.reduce((s, t, i) => s + diff(t, b[i], idx), 0);

for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), n = mode === 'gl' ? 90 : 200, F = mode === 'gl' ? [150, 210] : [300, 420, 540, 660];
  cache = new Map();
  // fill: the skull's glass holds a kaleidoscope of the folded layers
  const plain = await run(browser, {skull: 1}, null, n);
  const filled = await run(browser, {skull: 1}, [{world: 'all'}, {trails: 'main'}, {hits: true}, {object: 'skull', fill: {layers: ['plasma', 'ring', 'burst', 'scope'], fold: 6}}], n);
  const inD = diff(plain, filled, MID), outD = diff(plain, filled, EDGE);
  report(inD > 2 && inD > outD*4, `${mode}: a fill shows inside the skull (change ${inD.toFixed(1)}) and not around it (${outD.toFixed(1)})`);
  // mask: comets' trails only inside the skull, so the screen's edges go dark
  const trails = await run(browser, {skull: 1, comets: 1, decay: .95}, null, n);
  const masked = await run(browser, {skull: 1, comets: 1, decay: .95}, [{world: 'all'}, {trails: 'main', mask: {object: 'skull', keep: 'inside'}}, {hits: true}, {objects: true}], n);
  report(mean(trails, EDGE) > 1 && mean(masked, EDGE) < mean(trails, EDGE)*.5,
    `${mode}: masked to inside the skull, the trails at the edges fall from ${mean(trails, EDGE).toFixed(1)} to ${mean(masked, EDGE).toFixed(1)}`);
  // between: the city's near buildings come in front of the comets. Comets move about, so compare their light over the
  // buildings' band summed over several moments, with and without
  const BAND = []; for (let ty = 11; ty <= 13; ty++) for (let tx = 0; tx < 32; tx++) BAND.push(ty*32 + tx);   // the near rooftops and walls
  const comets = {city: 1, comets: 1, decay: .96}, bare = await runs(browser, {city: 1, decay: .96}, null, F);
  const over = sum(bare, await runs(browser, comets, null, F), BAND);
  const under = sum(bare, await runs(browser, comets, [{world: 'all'}, {trails: 'main'}, {world: 'front'}, {hits: true}, {objects: true}], F), BAND);
  report(over > 1 && under < over*.6, `${mode}: comets over the buildings' band: ${over.toFixed(1)} in front, ${under.toFixed(1)} between (the near buildings cover them)`);
  // an object between the world's planes: the near buildings hide the skull's lower half, which shows on top by default
  const LOW = []; for (let ty = 11; ty <= 13; ty++) for (let tx = 12; tx <= 19; tx++) LOW.push(ty*32 + tx);   // below the skull's middle
  const city = await run(browser, {city: 1, decay: .9}, null, n);
  const onTop = diff(city, await run(browser, {city: 1, skull: 1, decay: .9}, null, n), LOW);
  const among = diff(await run(browser, {city: 1, decay: .9}, AMONG, n), await run(browser, {city: 1, skull: 1, decay: .9}, AMONG, n), LOW);
  // .7: the skull shows through the gaps between the near buildings, which vary with the city's layout
  report(onTop > 2 && among < onTop*.7, `${mode}: the skull's lower half: ${onTop.toFixed(1)} on top, ${among.toFixed(1)} among the buildings`);
  // trail groups: comets in a group behind the buildings, the ring in main in front of them
  const bareG = await runs(browser, {city: 1, decay: .96}, GROUPS, F);
  const cF = sum(bareG, await runs(browser, comets, null, F), BAND), cB = sum(bareG, await runs(browser, comets, GROUPS, F), BAND);
  const rB = sum(bareG, await runs(browser, {city: 1, ring: 1, decay: .96}, GROUPS, F), BAND);
  report(cF > 1 && cB < cF*.6 && rB > cB, `${mode}: groups: comets ${cF.toFixed(1)} alone, ${cB.toFixed(1)} in the back group; the ring in front ${rB.toFixed(1)}`);
  // fills from any image: a world only inside the skull; a trail group seen only through its glass
  const skullOnly = await run(browser, {skull: 1}, WORLD_IN, n), cityIn = await run(browser, {skull: 1, city: 1}, WORLD_IN, n);
  const wIn = diff(skullOnly, cityIn, MID), wOut = diff(skullOnly, cityIn, EDGE);
  report(wIn > 2 && wOut < .5, `${mode}: the city fills the skull (change ${wIn.toFixed(1)}) and nowhere else (${wOut.toFixed(1)})`);
  const F3 = F.slice(0, 3), bareS = await runs(browser, {skull: 1, decay: .96}, COMETS_IN, F3);
  const open = sum(bareS, await runs(browser, {skull: 1, comets: 1, decay: .96}, null, F3), EDGE);
  const glass = sum(bareS, await runs(browser, {skull: 1, comets: 1, decay: .96}, COMETS_IN, F3), EDGE);
  report(open > 1 && glass < open*.2, `${mode}: comets at the screen's edges: ${open.toFixed(1)} as usual, ${glass.toFixed(1)} when they're only in the skull's glass`);
  // robustness: scenes the editor can make that used to break. More groups than the budget (simple mode crashed every
  // frame with no main group left), three masked objects (a shader compile error), and no trails at all (the skull sampled
  // the surface it was drawing into, and vanished in WebGL)
  const errs0 = failed;
  await run(browser, {skull: 1, comets: 1, ring: 1, city: 1}, [{world: 'all'}, {trails: 'back', layers: ['comets']}, {trails: 'b2', layers: ['ring']},
    {object: 'skull', fill: {trails: 'inner', layers: ['plasma']}}, {hits: true}], n);
  await run(browser, {skull: 1, knot: 1, torus: 1, comets: 1}, [{world: 'all'}, {trails: 'main', mask: {object: 'skull', keep: 'inside'}},
    {trails: 'x', layers: ['comets'], mask: {object: 'knot', keep: 'outside'}}, {trails: 'main', mask: {object: 'torus', keep: 'inside'}}, {objects: true}], n);
  const noTrails = [{world: 'all'}, {hits: true}, {objects: true}];
  const bareN = await run(browser, {}, noTrails, n), skullN = await run(browser, {skull: 1}, noTrails, n);
  report(!failed && errs0 === failed && diff(bareN, skullN, MID) > 2, `${mode}: over-budget groups, three masks and no trails draw without errors; the skull shows with no trails (${diff(bareN, skullN, MID).toFixed(1)})`);
  await browser.close();
}
// the scene editor: compose from a template by hand, move an entry, drive a weight by a signal
{
  const browser = await launch('2d'), page = await openPage(browser, url, {groove: true});
  const r = await page.evaluate(`(async () => {
    const {S} = await import('/src/state.js'), {setJourney} = await import('/src/ui/controls.js');
    setJourney(false);
    const pick = (sel, v) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('change', {bubbles: true})); };
    pick('#scTpl', 'among');
    const among = JSON.stringify(S.scene), rows = document.querySelectorAll('#scStack li').length;
    const top = S.scene[S.scene.length - 1];
    document.querySelector('#scStack li [data-a=down]').click();   // the top row moves down one
    const moved = S.scene[S.scene.length - 2] === top || JSON.stringify(S.scene[S.scene.length - 2]) === JSON.stringify(top);
    const li = [...document.querySelectorAll('#scStack li')].find(l => l.textContent.startsWith('Trails'));
    const d = li.querySelector('[data-k=drive]'); d.value = 'kick'; d.dispatchEvent(new Event('change', {bubbles: true}));
    __step(120);
    return {among, rows, moved, driven: S.scene.some(e => e.trails && e.drive && e.drive.src === 'kick'), skull: S.active.skull, city: S.active.city};
  })()`);
  const errors = await page.errors(); await browser.close();
  report(r.rows >= 4 && /"object":"skull"/.test(r.among) && r.skull === 1 && r.city === 1, `editor: "among" composes the skull among the city's buildings (${r.rows} rows)`);
  report(r.moved && r.driven && !errors.length, `editor: an entry moves, and the trails' weight follows every kick${errors.length ? ' ' + errors : ''}`);
}
srv.close();
process.exit(failed ? 1 : 0);
