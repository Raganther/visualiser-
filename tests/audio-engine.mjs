// The audio core (audio/engine/): the decks and the groovebox each have a channel in the mixer; the groovebox announces
// every note before it sounds (the note bus), matching its pattern; on its own it runs on the internal clock, carrying its
// bar on without a jump when its tempo changes; and once taps have set the clock it runs at their tempo, Sync on or off.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('audio-engine: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 800, height: 500, groove: false, noDraw: true});
const run = f => page.evaluate(f);
await run(async () => {
  window.__g = await import('/src/audio/groove.js'); window.__c = await import('/src/audio/engine/clock.js');
  window.__e = await import('/src/audio/engine/events.js'); window.__m = await import('/src/audio/engine/mixer.js');
  window.__dj = await import('/src/audio/dj.js'); (await import('/src/audio/player.js')).ensureAudio();
  window.__ev = []; __e.onNote(e => __ev.push(e));
  __g.loadPreset('Four to the floor'); Object.assign(__g.GB, {sync: true, swing: 0, bpm: 128}); __g.grooveToggle();
});
await wait(2500);
const a = await run(() => {
  const L = __g.LOG.slice(), ev = __ev.slice(), byT = new Map();
  for (const e of ev) { const k = e.t.toFixed(5); byT.set(k, [...(byT.get(k) || []), e.ch]); }
  // each scheduled step's notes against the pattern
  let ok = 0; for (const s of L) { const want = __g.VOICES.map(v => v[0]).filter(v => __g.GB[v][s.i]); if (__g.GB.bass[s.i].on) want.push('bass');
    const got = (byT.get(s.t.toFixed(5)) || []).slice().sort().join(); if (got === want.sort().join()) ok++; }
  __dj.djBus();
  return {steps: L.length, ok, kicks: ev.filter(e => e.ch === 'kick' && e.note === 36).length, ch: [...__m.CHANNELS.keys()].sort().join(),
    gaps: L.slice(1).map((s, k) => s.t - L[k].t)};
});
check('the decks and the groovebox each have a channel in the mixer', a.ch === 'deckA,deckB,groove', a.ch);
check('every step\'s notes go on the note bus before they sound, matching the pattern', a.steps >= 16 && a.ok === a.steps && a.kicks >= 4, `${a.ok}/${a.steps} steps, ${a.kicks} kicks`);
check('on its own it runs on the internal clock at its tempo', a.gaps.every(g => Math.abs(g - 60/128/4) < 1e-6), `${(a.gaps.reduce((x, y) => x + y, 0)/a.gaps.length*1000).toFixed(2)} ms a 16th`);

// a tempo change carries the bar on: the steps scheduled after it keep counting from where they were
const b = await run(async () => { const n0 = __g.LOG.length, last = __g.LOG[__g.LOG.length - 1]; __g.setBpm(100);
  await new Promise(r => setTimeout(r, 1500)); const L = __g.LOG, after = L.filter(s => s.t > last.t + 1e-6);
  return {first: after[0] && after[0].i, want: (last.i + 1) % 16, gap: after.length > 2 ? after[2].t - after[1].t : 0, jump: after[0] ? after[0].t - last.t : 0}; });
check('its tempo changes without a jump in the bar', b.first === b.want && Math.abs(b.gap - .15) < 1e-6 && b.jump < .2, `step ${b.first} after ${b.want - 1}, then ${(b.gap*1000).toFixed(1)} ms a 16th`);

// taps set the one clock: with Sync off too, it runs at the taps' tempo, step 1 on their 1
const c = await run(async () => { const {actx} = await import('/src/audio/player.js'), P = 60/132, t0 = actx.currentTime;
  __g.GB.sync = false; for (let k = 0; k < 8; k++) __dj.djTap(t0 - (7 - k)*P);
  await new Promise(r => setTimeout(r, 1500)); const L = __g.LOG.filter(s => s.t > t0 + .4);
  return {n: L.length, ok: L.every(s => { const k = (s.t - __c.INT.a)/__c.INT.P*4; return Math.abs(k - Math.round(k)) < 1e-3 && ((Math.round(k) % 16) + 16) % 16 === s.i; }),
    bpm: __g.tempo(), tapped: __c.INT.tapped}; });
check('taps set its clock, Sync off too: their tempo, step 1 on their 1', c.tapped && c.n >= 8 && c.ok && Math.abs(c.bpm - 132) < .01, `${c.n} steps on the taps' grid: ${c.ok}, ${c.bpm.toFixed(2)} BPM`);
await run(() => __g.grooveToggle());

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
