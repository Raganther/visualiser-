// Media test: an image and the (fake) camera go through the mirror tunnel in both renderers; with media loaded,
// Journey hands the lead to the tunnel. Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY, THUMB, FAKE_CAMERA } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('media: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode, FAKE_CAMERA), page = await openPage(browser, url, {groove: false});
  const r = await page.evaluate(`(async (mode) => {
    const {setMediaElement, clearMedia, startCamera, MEDIA} = await import('/src/media/source.js');
    const paint = (g, t) => { g.fillStyle = '#ffcc33'; g.fillRect(0, 0, 320, 180); g.fillStyle = '#2255ff'; g.beginPath(); g.arc(80 + t, 90, 50, 0, 7); g.fill(); };
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; paint(c.getContext('2d'), 0);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    __step(mode === 'gl' ? 120 : 400);
    const before = __jdbg().tunnel;
    setMediaElement(img); __step(mode === 'gl' ? 90 : 180);
    const lit = (${THUMB}).filter(v => v > 40).length, tunnel = __jdbg().tunnel;
    // the camera (Chromium's fake one: a moving test pattern)
    await startCamera(); for (let i = 0; i < 40 && !MEDIA.ready; i++) await new Promise(r => setTimeout(r, 100));
    __step(30); const camLit = (${THUMB}).filter(v => v > 40).length, liveOk = MEDIA.ready && camLit > 30;
    clearMedia(); __step(mode === 'gl' ? 90 : 240);
    return {before, tunnel, lit, liveOk, after: __jdbg().tunnel, sec: document.querySelector('#jSection').textContent};
  })('${mode}')`);
  const errors = await page.errors();
  const ok = r.before < .01 && r.tunnel > .3 && r.lit > 100 && r.liveOk && r.after < r.tunnel && !errors.length;
  if (!ok) failed = true;
  console.log(`${mode}: ${ok ? 'ok' : 'FAILED'}  (tunnel ${r.before.toFixed(2)} → ${r.tunnel.toFixed(2)} with an image → ${r.after.toFixed(2)} after; ${r.lit}/576 tiles lit; camera ${r.liveOk ? 'shows' : 'MISSING'})`, errors.length ? errors : '');
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
