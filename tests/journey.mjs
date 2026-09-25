// Journey choice test: over many simulated sections with random music, every world, hit, scene template and (nearly)
// every recipe gets chosen, and hits and centrepieces appear in a sensible share of sections. Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('journey: skipped for', ENTRY); process.exit(0); }
const N = 400;
const {srv, url} = await serve();
const browser = await launch('2d'), page = await openPage(browser, url, {groove: false});
const r = await page.evaluate(async (N) => {
  const {J} = await import('/src/journey/core.js'), {chooseWorld} = await import('/src/journey/worlds.js');
  const {presets} = await import('/src/presets.js'), reg = await import('/src/visuals/registry.js'), {TEMPLATES} = await import('/src/scene/templates.js');
  __step(60*12);                                       // let the first section form
  const worlds = {}, hits = {}, recipes = {}, scenes = {};
  let centres = 0;
  for (let i = 0; i < N; i++) {
    for (const f in J.fS) { J.fS[f] = Math.random(); J.fMin[f] = 0; J.fMax[f] = 1; }
    J.tension = Math.random();
    Object.assign(J.type, {worldBias: null, hitSeed: null, recipeSeed: {}, casts: {}});
    for (const k in J.fat) J.fat[k] = 0;
    J.sFat = {}; J.oFat = {};
    chooseWorld(); J.recast = 'fresh'; __step(1);
    worlds[J.world] = (worlds[J.world] || 0) + 1; hits[J.hit || 'none'] = (hits[J.hit || 'none'] || 0) + 1;
    recipes[J.recipe.name] = (recipes[J.recipe.name] || 0) + 1;
    scenes[J.sceneKey] = (scenes[J.sceneKey] || 0) + 1; if (J.centre) centres++;
  }
  return {worlds, hits, recipes, scenes, centres, allScenes: TEMPLATES.map(t => t.key), allWorlds: ['none', ...reg.WORLDS], allHits: reg.HITS, allRecipes: presets.filter(p => p.journey !== false).map(p => p.name)};
}, N);
const errors = await page.errors();
await browser.close(); srv.close();

const missing = (all, got) => all.filter(k => !got[k]);
const hitRate = Math.round((N - (r.hits.none || 0))/N*100);
const checks = [
  ['every world chosen', missing(r.allWorlds, r.worlds), v => !v.length],
  ['every hit chosen', missing(r.allHits, r.hits), v => !v.length],
  ['nearly every recipe chosen (all but 2 at most)', missing(r.allRecipes, r.recipes), v => v.length <= 2],
  ['hits in 15-40% of sections', hitRate + '%', v => parseInt(v) >= 15 && parseInt(v) <= 40],
  ['every scene template chosen', missing(r.allScenes, r.scenes), v => !v.length],
  ['a centrepiece in 15-45% of sections', Math.round(r.centres/N*100) + '%', v => parseInt(v) >= 15 && parseInt(v) <= 45],
  ['no page errors', errors, v => !v.length],
];
let failed = false;
for (const [name, v, ok] of checks) { const pass = ok(v); if (!pass) failed = true;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${Array.isArray(v) ? (v.length ? 'missing ' + v.join(', ') : 'yes') : v}`); }
console.log('     worlds', JSON.stringify(r.worlds), '\n     hits', JSON.stringify(r.hits), '\n     scenes', JSON.stringify(r.scenes));
process.exit(failed ? 1 : 0);
