// Plan and combinations test (journey/plan.js, journey/combos.js): for a track read ahead, the opening is sparse (no
// centrepiece, no kaleidoscope, sparse worlds), the headline set piece is held back until the biggest drop and lands with
// it, and the close brings the opening's lead (the motif) back; with no track read ahead there's no plan. And over many
// sections the combinations make the picture less crowded than without them, and the pairs that clash come together less.
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('plan: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const browser = await launch('2d'), page = await openPage(browser, url, {groove: false, noDraw: true});
const r = await page.evaluate(async () => {
  const {J} = await import('/src/journey/core.js'), {TUNE} = await import('/src/tuning.js'), {chooseWorld} = await import('/src/journey/worlds.js');
  const {F} = await import('/src/audio/foresee.js'), {PLAN, planStep, planWords} = await import('/src/journey/plan.js'), {crowd, pair} = await import('/src/journey/combos.js');
  __step(60*12);
  const shuffle = () => { for (const f in J.fS) { J.fS[f] = Math.random(); J.fMin[f] = 0; J.fMax[f] = 1; } J.tension = Math.random();
    Object.assign(J.type, {worldBias: null, hitSeed: null, recipeSeed: {}, casts: {}}); for (const k in J.fat) J.fat[k] = 0; J.sFat = {}; J.oFat = {}; J.wFat = {}; };
  const section = () => { shuffle(); chooseWorld(true); J.recast = 'fresh'; __step(1); };
  // a five-minute track read ahead: drops at 1:00 (small) and 3:00 (the biggest)
  let T = 0; F.dur = 300; F.drops = [{t: 60, brk: 50, depth: 5}, {t: 180, brk: 165, depth: 12}]; F.brks = []; F.map = null; F.id++; F.ready = true; F.at = () => T;
  T = 10; __step(2); const built = {on: PLAN.on, open: PLAN.open, close: PLAN.close, peak: PLAN.peak && PLAN.peak.t};
  PLAN.head = {w: 'kifs', wt: 1};
  const count = n => { const c = {centre: 0, kal: 0, dense: 0, head: 0}; for (let i = 0; i < n; i++) { section();
    if (J.centre) c.centre++; if (J.kal) c.kal++; if (['city', 'cosmos', 'hollow', 'cathedral', 'geode', 'vessel', 'kifs', 'forest', 'deep'].includes(J.world)) c.dense++; if (J.world === 'kifs') c.head++; } return c; };
  T = 20; planStep(); const openPh = PLAN.phase, open = count(80), openWords = planWords();
  T = 100; planStep(); const devPh = PLAN.phase, dev = count(120), devWords = planWords();
  // the peak: just before the drop, then over it, frame by frame
  T = 179.3; __step(2); const peakPh = PLAN.phase; T = 180.7; __step(3); const peakWorld = J.world, peakWords = planWords();
  // the close: the motif (the opening's lead) comes back
  PLAN.motif = {lead: 'fireflies', world: 'none'}; T = 285; __step(3); for (let i = 0; i < 4; i++) { shuffle(); J.recast = 'lead'; __step(1); }
  const closePh = PLAN.phase, closeLead = J.lead;
  // no track read ahead: no plan
  F.ready = false; F.dur = 0; F.id++; __step(2); const noPlan = !PLAN.on;
  // the combinations: how crowded the casts are, and how often a clashing pair comes together, with and without them
  const res = [{cr: 0, clash: 0, good: 0}, {cr: 0, clash: 0, good: 0}];   // (alternating, so both see the same spread of music)
  for (let i = 0; i < 400; i++) { const w = i % 2; TUNE.combos.weight = w; section(); const o = res[w];
    o.cr += crowd({world: J.world, lead: J.lead, accent: J.accent, centre: J.centre, kal: J.kal}, J.tension)/200; if (pair(J.world, J.lead) < -.3 || pair(J.lead, J.accent) < -.3) o.clash++;
    if ([[J.world, J.lead], [J.world, J.centre], [J.lead, J.accent], [J.centre, J.kal && 'kal' + J.kal.mode]].some(([a, b]) => pair(a, b) > .25)) o.good++; }
  TUNE.combos.weight = 1; const [off, on] = res;
  return {built, openPh, open, openWords, devPh, dev, devWords, peakPh, peakWorld, peakWords, closePh, closeLead, noPlan, off, on};
});
check('a five-minute track gets a plan: the opening until the first drop, the peak at the biggest', r.built.on && Math.abs(r.built.open - 60) < 1 && r.built.peak === 180, JSON.stringify(r.built));
check('the opening is sparse: hardly a centrepiece or kaleidoscope, few dense worlds', r.openPh === 'open' && r.open.centre <= 8 && r.open.kal <= 8 && r.open.dense < r.dev.dense, `${JSON.stringify(r.open)} against later ${JSON.stringify(r.dev)}`);
check('the headline is held back before its drop', r.devPh === 'build' && r.open.head + r.dev.head === 0, r.devWords);
check('and lands with the drop', r.peakPh === 'peak' && r.peakWorld === 'kifs', `${r.peakWorld}; ${r.peakWords}`);
check('the close brings the motif back', r.closePh === 'close' && r.closeLead === 'fireflies', r.closeLead);
check('no track read ahead: no plan', r.noPlan);
check('the combinations make the picture less crowded', r.on.cr < r.off.cr*.85, `${r.off.cr.toFixed(3)} without, ${r.on.cr.toFixed(3)} with`);
check('pairs that clash come together no more often', r.on.clash <= r.off.clash, `${r.off.clash} without, ${r.on.clash} with`);
check('and pairs that work come together more often', r.on.good > r.off.good*1.3, `${r.off.good} without, ${r.on.good} with (of 200)`);
const errors = await page.errors(); check('no page errors', !errors.length, errors.join(' '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
