// The cosmos lab (?lab=cosmos): the camera's shots change with the bars, a section change moves on, a jump reaches another
// system, the camera never goes inside a body, and both renderers draw it with no errors.
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('cosmos: skipped for', ENTRY); process.exit(0); }   // reads the modules
const {srv, url} = await serve();
let failed = false;
const check = (ok, msg) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

for (const mode of ['2d', 'gl']) {
  const gl = mode === 'gl', browser = await launch(mode), page = await openPage(browser, url, {width: gl ? 240 : 480, height: gl ? 135 : 270, query: '?lab=cosmos'});
  await page.waitForFunction(() => document.querySelector('#cosmosCap'), null, {timeout: 20000, polling: 100});
  const r = await page.evaluate(async ({gl, thumb}) => {
    const {byKey} = await import('/src/visuals/registry.js'), {J} = await import('/src/journey/core.js'), cz = byKey.cosmos;
    const shots = new Set(), systems = new Set();
    let clear = 99; const look = () => { const i = cz.info(); shots.add(i.shot); systems.add(i.system); clear = Math.min(clear, i.clear); };
    const secs = gl ? 40 : 120;
    for (let s = 0; s < secs; s++) { __step(60); look(); }
    cz.jump(); __step(60*4); look();
    return {shots: [...shots], systems: [...systems], clear, lit: eval(thumb).filter(v => v > 12).length, w: J.worldHold};
  }, {gl, thumb: THUMB});
  const errors = await page.errors();
  check(!errors.length && r.lit > 20, `${mode}: draws the cosmos (${r.lit}/576 tiles lit)${errors.length ? ' ' + errors : ''}`);
  check(r.shots.length >= (gl ? 2 : 3) && r.systems.length >= 2, `${mode}: the shots change with the music and a jump reaches another system (shots ${r.shots.join(', ')}; systems ${r.systems.join(', ')})`);
  check(r.clear >= 1.2, `${mode}: the camera never goes inside a body (nearest ${r.clear.toFixed(2)} radii)`);
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
