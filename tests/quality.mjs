// Speed: the resolution follows the frame rate (render/quality.js), and the trails' shader built from just the visuals
// drawing matches the full one pixel for pixel.
import { serve, launch, openPage, THUMB } from './lib.mjs';

const {srv, url} = await serve();
let failed = false;
const check = (ok, msg) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

// the whole controller in simple mode; WebGL (slow in software) just a drop and a recovery, with the waits shortened
for (const mode of ['2d', 'gl']) {
  const gl = mode === 'gl', browser = await launch(mode);
  const page = await openPage(browser, url, {groove: false, width: gl ? 160 : 480, height: gl ? 90 : 270,
    query: gl ? '?tune=render.auto.graceMs=500&tune=render.auto.upMs=1500&tune=render.auto.settleMs=500' : ''});
  const r = await page.evaluate(async gl => {
    const {Q} = await import('/src/render/quality.js');
    const w = () => document.querySelector('canvas').width, out = {};
    __step(60*(gl ? 1 : 6)); out.steady = [Q.scale, w()];
    __step(25*(gl ? 4 : 12), 40); out.slow = [Q.scale, w()];   // 25 fps: steps down
    __step(25*(gl ? 4 : 20), 40); out.floor = Q.scale;          // and no further than the floor
    __step(60*(gl ? 20 : 90)); out.back = [Q.scale, w()];       // steady again: back up, a step at a time
    return out;
  }, gl);
  const errors = await page.errors();
  check(!errors.length && r.steady[0] === 1 && r.slow[0] < 1 && r.slow[1] < r.steady[1] && r.floor >= .5 && r.back[0] === 1 && r.back[1] === r.steady[1],
    `${mode}: resolution follows the frame rate (60 fps ${r.steady[0]}, 25 fps ${r.slow[0]} then ${r.floor}, back to ${r.back[0]}; width ${r.steady[1]} → ${r.slow[1]} → ${r.back[1]})${errors.length ? ' ' + errors : ''}`);
  if (gl) { await browser.close(); continue; }
  // a step up that makes it slow again: it goes back down and stays under that step for a while
  const p = await page.evaluate(async () => {
    const {Q} = await import('/src/render/quality.js');
    __step(25*12, 40); const low = Q.scale; let t = 0;
    while (Q.scale === low && t++ < 60*30) __step(1);          // steady until it tries a step up
    const tried = Q.scale; __step(25*4, 40); const after = Q.scale;
    __step(60*40); return {low, tried, after, held: Q.scale};
  });
  check(p.tried > p.low && p.after < p.tried && p.held < p.tried, `${mode}: a step up that's too much is taken back and not retried at once (${p.low} → ${p.tried} → ${p.after}, ${p.held} 40 s later)`);
  await browser.close();
}

// the trails' shader built from the visuals drawing draws exactly what the full one does, over Journey's changes
const runs = {};
for (const q of ['?tune=render.fbCache=0', '']) {
  const browser = await launch('gl'), page = await openPage(browser, url, {width: 160, height: 90, query: q + (q ? '&' : '?') + 'tune=render.auto.on=0'});
  runs[q || 'built'] = await page.evaluate(async thumb => {
    const {fbInfo} = await import('/src/render/gl.js'); const out = [];
    for (let i = 0; i < 6; i++) { __step(60*3); out.push({px: eval(thumb), fb: fbInfo()}); }
    return out;
  }, THUMB);
  if ((await page.errors()).length) { failed = true; console.log(await page.errors()); }
  await browser.close();
}
const full = runs['?tune=render.fbCache=0'], built = runs.built;
const diff = Math.max(...built.map((f, i) => Math.max(...f.px.map((v, j) => Math.abs(v - full[i].px[j])))));
const smaller = built.filter(f => !f.fb.startsWith('all')).length;
check(diff <= 1 && smaller >= 4, `gl: the built trails shader matches the full one (largest difference ${diff}/255; smaller shader in ${smaller} of 6 checks: ${[...new Set(built.map(f => f.fb))].join(' | ')})`);
srv.close();
process.exit(failed ? 1 : 0);
