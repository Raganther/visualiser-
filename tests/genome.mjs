// Genome test (scene/genome.js in Journey): off, Journey's choices are its own; on, every section's kaleidoscope follows its
// genome (its mirrors, the kind for its motif, what it folds, or none), a returning section brings its own genome back, a new
// one grows the next generation, and the pieces read it (the stargate's sides, the comets' petals, the objects' style); in
// both renderers the stargate draws differently with another symmetry, and the phone page (?lab=genome) runs with no errors.
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('genome: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
// a page's controls (ui/mobile.js) are built a couple of frames after its lab loads, which is after the page's first frames
const built = (page, id) => page.waitForFunction(id => { __step(2); return !!document.querySelector(`#glab button[data-id="${id}"]`); }, id, {timeout: 30000, polling: 200});
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
{
  const browser = await launch('2d'), page = await openPage(browser, url, {noDraw: true});
  const r = await page.evaluate(async () => {
    const {J} = await import('/src/journey/core.js'), {GEN} = await import('/src/scene/genome.js'), {setGenome} = await import('/src/ui/keys.js');
    const {newType, enterType} = await import('/src/journey/sections.js'), {KAL_OF} = await import('/src/journey/extras.js'), {DANCE} = await import('/src/scene/dance.js');
    const {jState} = await import('/src/journey/core.js');
    __step(60*8);
    const types = [0, 1, 2, 3].map(i => newType({...J.fF, lvl: i*.25}));
    const go = t => { enterType(t); __step(2); };
    const fits = () => GEN.fold === 4 ? J.kal === null : !!J.kal && J.kal.n === GEN.n && J.kal.mode === KAL_OF[GEN.motif] && J.kal.where === (GEN.fold === 3 && !J.centre ? 0 : GEN.fold);
    let offFits = 0; for (let i = 0; i < 20; i++) { go(types[i % 4]); J.recast = 'fresh'; __step(2); if (J.kal && J.kal.n === GEN.n && J.kal.mode === KAL_OF[GEN.motif]) offFits++; }
    setGenome('on', true, true);
    let ok = 0, gens = new Set(), back = 0, n = 0, folds = new Set();
    const seen = new Map();
    for (let i = 0; i < 40; i++) { const t = i < 4 ? types[i] : types[i % 4]; if (i === 4) types.forEach(t => t.visits = 1);
      go(t); n++; if (fits()) ok++; gens.add(GEN.id); folds.add(GEN.fold);
      const g = JSON.stringify([GEN.n, GEN.motif, GEN.mat, GEN.fold]); if (seen.has(t) && seen.get(t) === g) back++; seen.set(t, g); }
    // a new section grows the next generation
    const t5 = newType({...J.fF, lvl: .9}), before = GEN.id; go(t5); const grown = GEN.id === before + 1;
    // the pieces read it
    J.lead = 'comets'; J.accent = 'comets'; GEN.n = 7; GEN.geo = true; __step(30); const petals7 = DANCE.comets.k;
    GEN.n = 8; __step(30); const petals8 = DANCE.comets.k;
    GEN.col = true; GEN.mat = 2; J.centre = 'skull'; __step(3); const neonStyle = jState.objStyle; GEN.mat = 0; __step(3); const stoneStyle = jState.objStyle;
    setGenome('on', false, true); __step(3); const offStyle = jState.objStyle === (J.objStyle || 0);
    return {offFits, ok, n, gens: gens.size, back, folds: [...folds], grown, petals7, petals8, neonStyle, stoneStyle, offStyle};
  });
  check('off: the kaleidoscope is Journey\'s own', r.offFits < 10, `${r.offFits} of 20 matched a genome`);
  check('on: every section\'s kaleidoscope follows its genome', r.ok === r.n, `${r.ok} of ${r.n}`);
  check('a returning section brings its own genome back', r.back === 36, `${r.back} of 36 returns`);
  check('a new section grows the next generation', r.grown && r.gens >= 4, `${r.gens} generations`);
  check('the genome folds in more than one way', r.folds.length >= 2, r.folds.join(','));
  check('the comets trace its symmetry', r.petals7 === 7 && r.petals8 === 4, `${r.petals7}, ${r.petals8} (a rose of 8 petals is k 4)`);
  check('the object\'s style follows its material', r.neonStyle === 3 && r.stoneStyle === 1 && r.offStyle, `neon ${r.neonStyle}, stone ${r.stoneStyle}`);
  const errors = await page.errors(); check('no page errors (2d)', !errors.length, errors.join(' '));
  await browser.close();
}
// in both renderers: the stargate with a 3-fold genome draws differently from its own hexagons
for (const mode of ['gl', '2d']) {
  const browser = await launch(mode), page = await openPage(browser, url, {width: 320, height: 180});
  const r = await page.evaluate(async () => {
    const {solo} = await import('/src/ui/presets.js'), {GEN} = await import('/src/scene/genome.js');
    solo('stargate'); __step(90);
    const grab = () => { const c = document.querySelector('canvas'), x = document.createElement('canvas'); x.width = 64; x.height = 36; x.getContext('2d').drawImage(c, 0, 0, 64, 36); return x.getContext('2d').getImageData(0, 0, 64, 36).data; };
    const seq = () => { const out = []; for (let i = 0; i < 6; i++) { __step(6); out.push(grab()); } return out; };
    const a = seq(); GEN.on = true; GEN.geo = true; GEN.n = 3; const b = seq(); GEN.on = false;
    let d = 0, lit = 0; for (let i = 0; i < a.length; i++) for (let j = 0; j < a[i].length; j += 4) { d += Math.abs(a[i][j] - b[i][j]) + Math.abs(a[i][j+1] - b[i][j+1]); lit += a[i][j] + a[i][j+1]; }
    return {d, lit, gl: !!document.querySelector('canvas').getContext && !window.__simple};
  });
  check(`${mode}: the stargate's rings take the genome's sides`, r.lit > 0 && r.d > r.lit*.05, `difference ${r.d} against ${r.lit} lit`);
  const errors = await page.errors(); check(`no page errors (${mode})`, !errors.length, errors.join(' '));
  await browser.close();
}
// the phone page runs: Journey on, the genome on, its controls drawn and the keys working
{
  const browser = await launch('2d'), page = await openPage(browser, url, {query: '?lab=genome', width: 400, height: 760, noDraw: true});
  await built(page, 'next');
  const before = await page.evaluate(() => document.querySelector('#glab .st').textContent);
  await page.keyboard.press('n'); await page.evaluate(() => __step(30));
  const after = await page.evaluate(() => document.querySelector('#glab .st').textContent);
  check('the phone page shows the genome and N grows the next generation', /Together/.test(before) && before !== after, `${before} → ${after}`);
  const errors = await page.errors(); check('no page errors (phone page)', !errors.length, errors.join(' '));
  await browser.close();
}
// the phone view of the whole visualiser: its controls, Journey free to use everything, a like kept, Full controls back
{
  const browser = await launch('2d'), page = await openPage(browser, url, {query: '?lab=phone', width: 390, height: 800});   // (drawn: a like is kept at the end of a drawn frame)
  await built(page, 'like');
  const r = await page.evaluate(async () => {
    const {J} = await import('/src/journey/core.js'), {STEER} = await import('/src/journey/steer.js'), {S} = await import('/src/state.js');
    const before = JSON.parse(localStorage.getItem('afterglow.moments') || '[]').length;
    document.querySelector('#glab button[data-id="like"]').click(); __step(5); await new Promise(r => setTimeout(r, 300));   // (saved just after the frame)
    const after = JSON.parse(localStorage.getItem('afterglow.moments') || '[]').length;
    return {on: J.on, bans: Object.keys(STEER.ban).length, pins: Object.keys(STEER.pin).length, skip: S.skipW.size, liked: after - before,
      bar: getComputedStyle(document.querySelector('#bar')).display, st: document.querySelector('#glab .st').textContent};
  });
  check('the phone view runs Journey over everything, its own bar hidden', r.on && !r.bans && !r.pins && r.bar === 'none', `${r.st}; bans ${r.bans}, pins ${r.pins}, 3D worlds left out ${r.skip}`);
  check('a 👍 in the phone view keeps the moment', r.liked === 1, `${r.liked}`);
  await Promise.all([page.waitForNavigation(), page.click('#glab [data-id="leave"]')]); await page.waitForTimeout(1500);
  const back = await page.evaluate(() => [localStorage.getItem('afterglow.phone'), !!document.querySelector('#glab')]);
  check('Full controls goes back to the whole interface, and stays there', back[0] === '0' && !back[1], JSON.stringify(back));
  const errors = await page.errors(); check('no page errors (phone view)', !errors.length, errors.join(' '));
  await browser.close();
}
// on a phone it comes on by itself
{
  const browser = await launch('2d'), page = await browser.newPage({viewport: {width: 390, height: 800}, isMobile: true, hasTouch: true});
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(url + ENTRY); await page.waitForSelector('#glab button[data-id="like"]', {timeout: 30000}).catch(() => {});
  check('on a phone the phone view comes on by itself', await page.evaluate(() => !!document.querySelector('#glab button[data-id="like"]')));
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
