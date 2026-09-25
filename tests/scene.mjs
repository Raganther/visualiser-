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
async function run(browser, settings, scene, frames){
  const page = await openPage(browser, url, {groove: false, query: '?tune=mesh.spin=0'});
  const t = await page.evaluate(`(async () => {
    const {S} = await import('/src/state.js'), {curP} = await import('/src/presets.js'), {setJourney} = await import('/src/ui/controls.js');
    setJourney(false);
    const set = (k, v) => { S.active[k] = v; curP[k] = v; };
    for (const s of document.querySelectorAll('input[id^=s_]')) if (!/decay|zoom|colorSpeed/.test(s.id)) set(s.id.slice(2), 0);
    set('sym', 1); S.active.mods = {};
    for (const [k, v] of Object.entries(${JSON.stringify(settings)})) set(k, v);
    S.scene = ${JSON.stringify(scene)};
    __step(${frames}); return ${THUMB};
  })()`);
  const errors = await page.errors(); await page.close();
  if (errors.length) { failed = true; console.log('errors', errors); }
  return t;
}

for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), n = mode === 'gl' ? 90 : 200;
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
  let over = 0, under = 0;
  for (const f of mode === 'gl' ? [150, 210] : [300, 420, 540, 660]) {
    const settings = {city: 1, comets: 1, decay: .96}, bare = await run(browser, {city: 1, decay: .96}, null, f);
    over += diff(bare, await run(browser, settings, null, f), BAND);
    under += diff(bare, await run(browser, settings, [{world: 'all'}, {trails: 'main'}, {world: 'front'}, {hits: true}, {objects: true}], f), BAND);
  }
  report(over > 1 && under < over*.6, `${mode}: comets over the buildings' band: ${over.toFixed(1)} in front, ${under.toFixed(1)} between (the near buildings cover them)`);
  // an object between the world's planes: the near buildings hide the skull's lower half, which shows on top by default
  const LOW = []; for (let ty = 11; ty <= 13; ty++) for (let tx = 12; tx <= 19; tx++) LOW.push(ty*32 + tx);   // below the skull's middle
  const city = await run(browser, {city: 1, decay: .9}, null, n);
  const onTop = diff(city, await run(browser, {city: 1, skull: 1, decay: .9}, null, n), LOW);
  const among = diff(await run(browser, {city: 1, decay: .9}, AMONG, n), await run(browser, {city: 1, skull: 1, decay: .9}, AMONG, n), LOW);
  report(onTop > 2 && among < onTop*.6, `${mode}: the skull's lower half: ${onTop.toFixed(1)} on top, ${among.toFixed(1)} among the buildings`);
  // trail groups: comets in a group behind the buildings, the ring in main in front of them
  let cB = 0, cF = 0, rB = 0;
  for (const f of mode === 'gl' ? [150, 210] : [300, 420, 540, 660]) {
    const bare = await run(browser, {city: 1, decay: .96}, GROUPS, f);
    cF += diff(bare, await run(browser, {city: 1, comets: 1, decay: .96}, null, f), BAND);
    cB += diff(bare, await run(browser, {city: 1, comets: 1, decay: .96}, GROUPS, f), BAND);
    rB += diff(bare, await run(browser, {city: 1, ring: 1, decay: .96}, GROUPS, f), BAND);
  }
  report(cF > 1 && cB < cF*.6 && rB > cB, `${mode}: groups: comets ${cF.toFixed(1)} alone, ${cB.toFixed(1)} in the back group; the ring in front ${rB.toFixed(1)}`);
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
