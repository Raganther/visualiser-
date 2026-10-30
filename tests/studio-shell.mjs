// The Studio page (studio/listen/studio.html): the Studio DAW's Session (the clip grid) and Arrangement views, and Studio
// Jam v2 as a third tab, with real audio. The Session opens first and Tab flips to the Arrangement; a jam in v2 recorded
// "Into the arrangement" (a scene, then another) arrives in the Arrangement as a song of two sections whose notes are the
// ones the jam played (each drum hit and bass note on its 16th, the parts' places in their loops kept across the change);
// one transport plays at a time; and on a phone the switch is in reach with nothing wider than the screen.
import { serve, launch } from './lib.mjs';

const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
async function open(ctx){ const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  // the published page gets its skeleton (charset, viewport) from the host; served bare, it's given them here
  await p.route('**/studio.html', async r => { const res = await r.fetch(); r.fulfill({response: res, headers: {...res.headers(), 'content-type': 'text/html; charset=utf-8'}, body: '<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">' + await res.text()}); });
  await p.goto(url + 'studio/listen/studio.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => document.getElementById('fDaw').contentWindow?.__studioView, null, {timeout: 30000}); await wait(1500); return {p, errs}; }
const J = p => p.frameLocator('#fJam'), D = p => p.frameLocator('#fDaw');
const inJam = (p, fn, a) => p.evaluate(([f, a]) => (0, eval)(f)(document.getElementById('fJam').contentWindow, a), [fn.toString(), a]);
const inDaw = (p, fn, a) => p.evaluate(([f, a]) => (0, eval)(f)(document.getElementById('fDaw').contentWindow, a), [fn.toString(), a]);

{ const ctx = await browser.newContext({viewport: {width: 1400, height: 900}}), {p, errs} = await open(ctx);
  await p.waitForFunction(() => document.getElementById('fDaw').contentWindow?.__daw?.ST?.P, null, {timeout: 30000}); await wait(500);
  const first = await inDaw(p, w => ({view: w.__daw.ST.view, grid: w.document.querySelectorAll('#sessWrap .slot[data-has="1"]').length, shown: !w.frameElement.hidden, own: w.document.getElementById('views').hidden}));
  check('the Session (the clip grid) opens first, the DAW\'s own switch giving way to the Studio\'s', first.view === 'session' && first.grid > 0 && first.shown && first.own && await p.evaluate(() => document.getElementById('vSession').getAttribute('aria-pressed') === 'true'), JSON.stringify(first));
  await p.locator('#fDaw').focus(); await p.evaluate(() => { const w = document.getElementById('fDaw').contentWindow; w.document.activeElement?.blur(); w.focus(); });
  await p.keyboard.press('Tab'); await wait(400); const daw = await inDaw(p, w => ({view: w.__daw.ST.view, tracks: w.__daw.ST.P.tracks.length})); const tabbed = await p.evaluate(() => window.__studio.view());
  check('Tab flips to the Arrangement (the same DAW, its timeline)', daw.view === 'arrange' && tabbed === 'arrange', JSON.stringify({...daw, tabbed}));
  await p.click('#vJam'); await p.waitForFunction(() => document.getElementById('fJam').contentWindow?.__studioView, null, {timeout: 30000}); await wait(1500);

  // a jam into the arrangement: scene 1 for a while, then scene 2, recorded with the jam's own take beside it
  await J(p).locator('.scene').nth(0).click(); await J(p).locator('#bpmUp').click({clickCount: 10}); await wait(200);
  const bpm = +(await J(p).locator('#bpmOut').textContent()), bar = 4*60/bpm*1000;
  await J(p).locator('#play').click(); await wait(bar*.5); await J(p).locator('#take').click(); await J(p).locator('#rec').click();
  await wait(bar*3.2); await J(p).locator('.scene').nth(1).click(); await wait(bar*3.2);
  await J(p).locator('#rec').click(); await J(p).locator('#take').click(); await J(p).locator('#play').click().catch(() => {});
  await p.waitForFunction(() => window.__studio.view() === 'arrange' && String(document.getElementById('fDaw').contentWindow.__daw.ST.id).startsWith('take-'), null, {timeout: 20000}).catch(() => {});
  const song = await inJam(p, w => w.__jamSong()), take = await inJam(p, w => w.__jamTake());
  const P = await inDaw(p, w => { const P = w.__daw.ST.P; return {id: w.__daw.ST.id, bars: P.bars, marks: P.marks.map(m => m.name + ':' + m.bars), tracks: P.tracks.map(T => ({role: T.role, notes: T.clips.flatMap(c => c.notes.map(n => [Math.round(c.start*16 + n.s), n.p]))}))}; });
  check('the take arrives in the Arrangement as a song of two sections', P.id?.startsWith('take-') && P.marks.length === 2 && song?.sections.length === 2, JSON.stringify({id: P.id, marks: P.marks}));
  // the notes: the jam's own recording against the arrangement's, hit for hit, over the bars both cover (the take starts on
  // the same bar line as the recording)
  const cols = take.columns, roleOf = id => cols.find(c => c.id === id)?.role, drum = r => ['kick', 'hats', 'perc', 'drums'].includes(r), upto = Math.min(take.bars, P.bars)*16 - 16;
  const jamSet = role => new Set(take.notes.filter(n => n[0] < upto && (role === 'drums' ? drum(roleOf(n[1])) : roleOf(n[1]) === role)).map(n => `${n[0]}:${n[3]}`));
  const dawSet = role => new Set(P.tracks.filter(T => role === 'drums' ? drum(T.role) : T.role === role).flatMap(T => T.notes).filter(([s]) => s < upto).map(([s, p]) => `${s}:${p}`));
  for (const role of ['drums', 'bass']) { const a = jamSet(role), b = dawSet(role), miss = [...a].filter(x => !b.has(x)), extra = [...b].filter(x => !a.has(x));
    check(`the arrangement's ${role} are the notes the jam played (${a.size} over ${upto/16} bars)`, a.size > 4 && miss.length <= a.size*.03 && extra.length <= a.size*.03, `missing ${miss.length} ${miss.slice(0, 5)}, extra ${extra.length} ${extra.slice(0, 5)}`); }

  // one transport: the arrangement playing stops the jam, and the jam playing stops the arrangement
  await inDaw(p, w => w.document.getElementById('play').click()); await wait(800);
  await p.click('#vJam'); await J(p).locator('#play').click(); await wait(800);
  const t = await p.evaluate(() => ({daw: document.getElementById('fDaw').contentWindow.__daw.E.playing, jam: document.getElementById('fJam').contentWindow.document.getElementById('play').getAttribute('aria-pressed')}));
  await J(p).locator('#play').click();
  check('one transport at a time: the jam starting stops the arrangement', !t.daw && t.jam === 'true', JSON.stringify(t));
  // kept: the take is in the arrangement's song list after a reload
  await p.reload(); await p.waitForFunction(() => document.getElementById('fDaw').contentWindow?.__studioView, null, {timeout: 30000}); await p.click('#vArrange');
  await p.waitForFunction(() => document.getElementById('fDaw').contentWindow?.__daw?.ST?.P, null, {timeout: 30000});
  const kept = await inDaw(p, (w, id) => [...w.document.querySelectorAll('#songSel option')].some(o => o.value === id), P.id);
  check('the take is kept in the arrangement\'s songs after a reload', kept);
  // the analog synth in Jam v2: an analog sound on the bass plays on the live voices (the DAW's worklet), and is heard
  await p.click('#vJam'); await p.waitForFunction(() => document.getElementById('fJam').contentWindow?.__jamAudio, null, {timeout: 30000}); await J(p).locator('#play').click(); await wait(800);
  const an = await inJam(p, async w => { const A = w.__jamAudio(), bi = A.cols.findIndex(c => c.role === 'bass'), was = A.cols.map(c => c.mute);
    A.cols.forEach((c, i) => { c.mute = i !== bi; }); w.__jamSound(bi, 'a5-round'); await new Promise(r => setTimeout(r, 800));
    const a = A.ctx.createAnalyser(); A.out.connect(a); let m = 0; for (let k = 0; k < 40; k++) { await new Promise(r => setTimeout(r, 50)); const x = new Float32Array(2048); a.getFloatTimeDomainData(x); for (const v of x) m = Math.max(m, Math.abs(v)); }
    A.cols.forEach((c, i) => { c.mute = was[i]; }); w.document.getElementById('play').click(); return {live: !!A.cols[bi].inst?.live, peak: +m.toFixed(3)}; });
  check('in Jam v2 the analog synth plays live (as in the DAW), and is heard', an.live && an.peak > .02, JSON.stringify(an));
  const kit = await inJam(p, async w => { const A = w.__jamAudio(), ki = A.cols.findIndex(c => c.role === 'kick'), was = A.cols.map(c => c.mute); w.__jamSound(ki, 'k4-808');
    A.cols.forEach((c, i) => { c.mute = i !== ki; }); w.document.getElementById('play').click(); await new Promise(r => setTimeout(r, 900));
    const a = A.ctx.createAnalyser(); A.out.connect(a); let m = 0; for (let k = 0; k < 30; k++) { await new Promise(r => setTimeout(r, 50)); const x = new Float32Array(2048); a.getFloatTimeDomainData(x); for (const v of x) m = Math.max(m, Math.abs(v)); }
    A.cols.forEach((c, i) => { c.mute = was[i]; }); w.document.getElementById('play').click(); return {live: !!A.cols[ki].inst?.live && !!A.cols[ki].inst.voices.kick?.live, peak: +m.toFixed(3)}; });
  check('and the analog drum machine (the 808 kick) plays live, and is heard', kit.live && kit.peak > .02, JSON.stringify(kit));
  check('no page errors (computer)', !errs.length, errs.join('; '));
  await ctx.close(); }

{ const ctx = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}), {p, errs} = await open(ctx);
  const r = await p.evaluate(() => { const b = [...document.querySelectorAll('.views button')].map(x => x.getBoundingClientRect()); return {sw: document.documentElement.scrollWidth, w: innerWidth, small: b.filter(x => x.height < 34 || x.width < 80).length}; });
  await p.tap('#vArrange'); await wait(500); const v = await p.evaluate(() => window.__studio.view());
  check('on a phone the switch is in reach and nothing is wider than the screen', r.sw <= r.w && !r.small && v === 'arrange', JSON.stringify({...r, v}));
  check('no page errors (phone)', !errs.length, errs.join('; '));
  await ctx.close(); }
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
