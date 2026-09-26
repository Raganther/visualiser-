// Smoke test: the page loads in both renderers, draws something, reacts to the beat, and logs no errors; the panel says what's on screen, a like records the moment, and Solo and the Cosmos preset show one thing alone.
import { serve, launch, openPage, THUMB } from './lib.mjs';

const {srv, url} = await serve();
let failed = false;
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), page = await openPage(browser, url, {groove: false});
  const r = await page.evaluate(`(() => { __step(mode === 'gl' ? 300 : 900); const px = ${THUMB};
    return {lit: px.filter(v => v > 20).length, grid: __jdbg().grid.locked, gl: !!(document.querySelector('canvas').getContext('webgl2') || document.querySelector('canvas').getContext('webgl'))}; })()`.replace('mode', `'${mode}'`));
  const errors = await page.errors();
  const ok = !errors.length && r.lit > 20 && r.grid && r.gl === (mode === 'gl');
  if (!ok) failed = true;
  console.log(`${mode}: ${ok ? 'ok' : 'FAILED'}  (renderer ${r.gl ? 'webgl' : '2d'}, ${r.lit}/576 tiles lit, beat grid ${r.grid ? 'locked' : 'not locked'})`, errors.length ? errors : '');
  await browser.close();
}
// the panel: "On screen" names what's drawn and what set it; Solo leaves one visual alone at once; the Cosmos preset is the cosmos alone
{
  const browser = await launch('2d'), page = await openPage(browser, url);
  const r = await page.evaluate(() => {
    const now = () => document.querySelector('#onNow').textContent;
    __step(300); const journey = now(), dots = document.querySelectorAll('#sliders .row.on').length;
    document.querySelector('#likeBtn').click(); __step(2);   // a like records the moment, with a thumbnail, in this browser (no Artifact database here)
    const m = JSON.parse(localStorage.getItem('afterglow.moments') || '[]').pop() || {};
    const liked = m.v === 1 && m.journey === true && !!m.lead && m.onScreen === journey && /^data:image\/jpeg/.test(m.thumb) && m.thumb.length > 1000;
    document.querySelector('.solo[aria-label="Show Comets alone"]').click(); __step(40); const solo = now();
    const auto = document.querySelector('#autoBtn').getAttribute('aria-pressed');
    for (let i = 0; i < 40 && document.querySelector('#pName').textContent !== 'Cosmos'; i++) document.querySelector('#nextP').click();
    __step(400); return {journey, dots, liked, solo, auto, cosmos: now()};
  });
  const ok = /Set by Journey, from the .+ recipe\.$/.test(r.journey) && r.dots > 0 && r.liked && r.solo === 'no world; layers Comets. Set by the Comets alone preset.'
    && r.auto === 'false' && r.cosmos === 'Cosmos; no layers. Set by the Cosmos preset.' && !(await page.errors()).length;
  if (!ok) failed = true;
  console.log(`panel: ${ok ? 'ok' : 'FAILED'}`, ok ? '' : r);
  await browser.close();
}
// the experiment hooks: ?lab= and ?tune= must reach TUNE before the first frame (modules only)
if (process.env.AFTERGLOW_ENTRY === undefined || process.env.AFTERGLOW_ENTRY.endsWith('index.html')) {
  const browser = await launch('2d'), page = await openPage(browser, url, {groove: false, query: '?lab=example&tune=pace.divBar=.25&tune=worldSecs=40'});
  const t = await page.evaluate(async () => {
    const {TUNE} = await import('/src/tuning.js');
    for (let i = 0; i < 50 && TUNE.cutThreshold !== .7; i++) await new Promise(r => setTimeout(r, 100));   // labs load asynchronously
    __step(30); return [TUNE.cutThreshold, TUNE.hitNone, TUNE.pace.divBar, TUNE.worldSecs]; });
  const ok = JSON.stringify(t) === JSON.stringify([.7, .1, .25, 40]) && !(await page.errors()).length;
  if (!ok) failed = true;
  console.log(`lab/tune: ${ok ? 'ok' : 'FAILED'}  (${t.join(', ')})`);
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
