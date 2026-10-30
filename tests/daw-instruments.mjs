// The Studio DAW's instruments (studio/listen/studio-daw.html) played as a person would, with real audio measured at the
// output: in every song, every track's Instrument tab after switching between it and Notes; the drum rack's every pad
// (twice: a pad pressed again must sound again) and its computer keys; a synth's on-screen keys and computer keys; the
// keys going from a drum track to a synth and back; and pads heard over the song playing. (The drum rack was silent from
// its pads and keys: being a live instrument too, its voices were sent as pitches.)
import { serve, launch } from './lib.mjs';

const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
// (these tests work the Arrangement view, the timeline: every page opens on it, not the Session's clip grid)
const viewFirst = async p => { await p.addInitScript(() => { try { localStorage.setItem('studio.daw.view', 'arrange'); } catch {} }); return p; };
{ const np = browser.newPage.bind(browser), nc = browser.newContext.bind(browser); browser.newPage = async o => viewFirst(await np(o));
  browser.newContext = async o => { const c = await nc(o), cp = c.newPage.bind(c); c.newPage = async () => viewFirst(await cp()); return c; }; }
const page = await browser.newPage({viewport: {width: 1400, height: 900}});
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(url + 'studio/listen/studio-daw.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(2000);
// the loudest the output got since the last read, sampled every 10 ms
await page.evaluate(() => { const {E} = window.__daw; E.init(); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.out.connect(a); window.__peak = 0;
  setInterval(() => { const x = new Float32Array(a.fftSize); a.getFloatTimeDomainData(x); let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); window.__peak = Math.max(window.__peak, m); }, 10); });
const wait = ms => page.waitForTimeout(ms), peak = async fn => { await page.evaluate(() => window.__peak = 0); await fn(); await wait(450); return page.evaluate(() => window.__peak); };
const press = async el => { const b = await el.boundingBox(); await page.mouse.move(b.x + b.width/2, b.y + b.height*.7); await page.mouse.down(); await wait(120); await page.mouse.up(); };
const type = async k => { await page.keyboard.down(k); await wait(120); await page.keyboard.up(k); };
const track = async i => { await page.locator('.trk').nth(i).click(); await wait(200); for (const t of ['#tabNotes', '#tabInst', '#tabNotes', '#tabInst']) { await page.click(t); await wait(100); } await wait(1200); };
const songs = await page.$$eval('#songSel option', os => os.map(o => o.value)), silent = {pad: [], typed: [], key: []};
let drumI = -1, synthI = -1;
for (const id of songs.slice(0, 3)) { await page.selectOption('#songSel', id); await wait(1500);
  const roles = await page.evaluate(() => window.__daw.ST.P.tracks.map(T => T.role));
  for (const [i, role] of roles.entries()) { await track(i);
    const pads = await page.$$eval('#iKeys .pad', ps => ps.map(p => p.dataset.p));
    if (pads.length) { drumI = i; for (const v of pads) for (const n of [1, 2]) if (await peak(() => press(page.locator(`#iKeys .pad[data-p="${v}"]`))) < .005) silent.pad.push(`${id} ${v}#${n}`);
      for (const k of 'asdfghjk'.slice(0, pads.length)) if (await peak(() => type(k)) < .005) silent.typed.push(`${id} ${role} ${k}`); }
    else { synthI = i; const ks = await page.locator('#iKeys .wk').all(); for (const [j, k] of ks.slice(0, 5).entries()) if (await peak(() => press(k)) < .005) silent.key.push(`${id} ${role} ${j}`);
      for (const k of 'asdf') if (await peak(() => type(k)) < .005) silent.typed.push(`${id} ${role} ${k}`); } } }
check(`the drum rack's every pad sounds, pressed twice (${songs.slice(0, 3).length} songs, after switching tabs)`, !silent.pad.length, silent.pad.slice(0, 8).join(', '));
check('every synth track\'s on-screen keys sound', !silent.key.length, silent.key.join(', '));
check('every track plays from the computer\'s keys, drums by voice and synths by note', !silent.typed.length, silent.typed.slice(0, 8).join(', '));

// the keys from a drum track to a synth and back
let back = [];
if (drumI >= 0 && synthI >= 0) for (const i of [drumI, synthI, drumI, synthI, drumI]) { await page.locator('.trk').nth(i).click(); await wait(600); if (await peak(() => type('a')) < .005) back.push(i); }
check('the keys follow the track picked, from drums to a synth and back', drumI >= 0 && synthI >= 0 && !back.length, back.join(' '));

// pads over the song playing: louder than the song alone
if (drumI >= 0) { await page.locator('.trk').nth(drumI).click(); await page.click('#tabInst'); await wait(400); await page.keyboard.press(' '); await wait(1500);
  const alone = await peak(() => wait(600)); const withPad = await peak(() => press(page.locator('#iKeys .pad').first())); await page.keyboard.press(' ');
  check('a pad is heard over the song playing', withPad >= alone*.9 && withPad > .005, `song ${alone.toFixed(3)}, with the pad ${withPad.toFixed(3)}`); }
check('no page errors', !errs.length, errs.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
