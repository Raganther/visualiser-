// The play lab (src/play/), with real audio: the bar's Play button opens it over the picture; each toy, used as a person
// would with the mouse and keys, plays its notes on the master's 16ths (the mandala's rings, painting, a drawn loop, a
// planet dropped on an orbit, the keyboard pads and their loop); ← → switch toys, Esc closes it and the page's keys work again.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('playlab: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 1280, height: 800, groove: false, noDraw: true});
const live = ms => page.evaluate(async ms => { for (let k = 0; k < ms/50; k++) { await new Promise(r => setTimeout(r, 50)); __step(3); } }, ms);
const M = page.mouse, kb = page.keyboard;
await page.evaluate(async () => { window.__ev = (await import('/src/audio/engine/events.js')).RECENT; window.__P = await import('/src/play/host.js');
  window.__C = await import('/src/audio/engine/clock.js'); document.querySelector('#playLabBtn').click(); });
// the notes the lab played since the last look: how many of each, and whether every one fell on a 16th of the clock
const notes = () => page.evaluate(() => { const c = {}; let on = true; for (const e of __ev) if (e.src === 'play') { c[e.ch] = (c[e.ch] || 0) + 1;
  const q = (__C.master() || __C.internal).beat(e.t)*4; if (Math.abs(q - Math.round(q)) > 1e-3) on = false; } __ev.length = 0; return {c, on}; });
const open = await page.evaluate(() => ({on: __P.PLAY.on, cv: !document.querySelector('#playCv').hidden, toy: __P.PLAY.toy}));
check('the Play button opens the lab over the picture', open.on && open.cv, JSON.stringify(open));

const geo = (k, n) => page.evaluate(([k, n]) => { const W = innerWidth, H = innerHeight, top = 90, bot = H - 120, R = Math.max(60, Math.min(W*k, (bot - top)/2));
  return {cx: W/2, cy: (top + bot)/2, r: Array.from({length: n}, (_, i) => R*((k === .42 ? .3 : .22) + (k === .42 ? .7 : .78)*i/(n - 1)))}; }, [k, n]);
await page.evaluate(() => { __P.PLAY.toy = 0; }); await kb.press('ArrowRight'); await kb.press('ArrowLeft');
// the mandala: the open hat's ring scrolled up to three hits, then they play
const G = await geo(.42, 5); await M.move(G.cx, G.cy); await M.move(G.cx + G.r[3], G.cy); await live(100);
for (let i = 0; i < 3; i++) { await M.wheel(0, -100); await live(100); }
await live(300); await notes(); await live(2400); const a = await notes();
check('mandala rings: scrolling a ring adds its hits, and the rings play on the 16ths', a.c.ohh >= 2 && a.c.kick >= 3 && a.on, JSON.stringify(a));
// paint: the button held and moved plays notes; let go, it stops
await kb.press('ArrowRight'); await live(200); await notes(); await M.move(300, 500); await M.down();
for (let i = 0; i < 16; i++) { await M.move(300 + i*40, 500 - i*15); await live(60); } await M.up(); const b = await notes(); await live(600); const b2 = await notes();
check('paint with light: held and moved it plays on the 16ths, and stops when let go', b.c.synth >= 6 && b.on && !b2.c.synth, `${b.c.synth} notes, then ${b2.c.synth || 0}`);
// draw: a line becomes a loop that keeps playing
await kb.press('ArrowRight'); await live(200); await M.move(20, 500); await M.down(); for (let i = 0; i <= 40; i++) await M.move(20 + i*31, 500 - 200*Math.sin(i/6)); await M.up();
await notes(); await live(2600); const c = await notes();
check('draw a loop: a line drawn across becomes a melody that repeats', c.c.synth >= 8 && c.on, JSON.stringify(c));
// orbits: planets dropped on two rings play as they pass the top
await kb.press('ArrowRight'); await live(200); const O = await geo(.43, 6); await page.keyboard.press('Backspace');
await M.click(O.cx + O.r[3], O.cy); await M.click(O.cx - O.r[5], O.cy); await notes(); await live(2600); const d = await notes();
check('orbits: planets dropped on rings play each time round', d.c.synth >= 2 && d.c.chh >= 2 && !d.c.kick && d.on, JSON.stringify(d));
// pads: keys play at once (snapped), and a recorded loop plays them back
await kb.press('ArrowRight'); await live(200); await notes(); await kb.press(' ');
for (const k of ['1', 'q', '4', 'z']) { await kb.down(k); await live(120); await kb.up(k); }
await kb.press(' '); const e1 = await notes(); await live(4300); const e2 = await notes();   // (the loop is two bars: 3.75 s at 128)
check('keyboard pads: the keys play drums, notes and chords on the 16ths', e1.c.kick >= 1 && e1.c.chh >= 1 && e1.c.synth >= 4 && e1.on, JSON.stringify(e1));
check('keyboard pads: a recorded loop plays back', e2.c.kick >= 1 && e2.c.synth >= 4, JSON.stringify(e2));
// Esc closes it, and the page's own keys work again (H hides the panel and bar)
await kb.press('Escape'); const shut = await page.evaluate(() => ({on: __P.PLAY.on, cv: document.querySelector('#playCv').hidden}));
await kb.press('h'); const clean = await page.evaluate(() => document.body.classList.contains('clean'));
check('Esc closes the lab, and the page\'s keys work again', !shut.on && shut.cv && clean, JSON.stringify({...shut, clean}));

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
