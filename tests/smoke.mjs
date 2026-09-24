// Smoke test: the page loads in both renderers, draws something, reacts to the beat, and logs no errors.
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
srv.close();
process.exit(failed ? 1 : 0);
