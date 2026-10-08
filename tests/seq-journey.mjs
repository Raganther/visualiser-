// Journey following the sequencer (audio/groove.js's plan, the clock's leader, scene/notes.js), with real audio: while the
// sequencer plays on its own it gives the beat grid its beats at its tempo, each beat's pulse as strong as its kick, and
// when it stops the grid goes back; the song's kick returning after a breakdown is known ahead, so Journey runs up to it
// and the drop lands on the moment; a pattern picked starts a section at the bar line; a kick unmuted after bars of
// silence is a drop; the notes reach the signal bus as they're heard.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('seq-journey: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 800, height: 500, groove: false, noDraw: true});
const run = f => page.evaluate(f);
await run(async () => {
  window.__g = await import('/src/audio/groove.js'); window.__J = (await import('/src/journey/core.js')).J; window.__F = (await import('/src/audio/foresee.js')).F;
  window.__G = (await import('/src/audio/beatgrid.js')).G; window.__C = await import('/src/audio/engine/clock.js'); window.__S = (await import('/src/scene/signals.js')).SIG;
  (await import('/src/audio/player.js')).ensureAudio();
  // frames at about the real rate while the audio plays in real time; watch(fn) is called after each
  window.__live = async (ms, watch) => { for (let k = 0; k < ms/50; k++) { await new Promise(r => setTimeout(r, 50)); __step(3); if (watch) watch(); } };
  window.__fresh = () => { if (__g.GB.playing) __g.grooveToggle(); Object.assign(__g.GB, {sync: false, bpm: 180, swing: 0, mute: {}, solo: null, songOn: false, song: [], next: null});
    for (let i = 0; i < 8; i++) { __g.GB.pat = i; __g.clearPattern(); } __g.GB.pat = 0; __g.bind(); };
  __step(720);   // (Journey settles into its first section)
});

// the sequencer leads the beat grid while it plays, and lets go when it stops
const a = await run(async () => { __fresh(); [0, 4, 8, 12].forEach(j => __g.GB.kick[j] = j ? 0 : 1); __g.GB.kick[0] = 2; __g.GB.chh.fill(1, 0, 16);
  __g.grooveToggle(); const kicks = new Set(); await __live(2500, () => kicks.add(__G.kick));
  const r = {src: __F.map && __F.map.src, locked: __G.locked, map: !!__G.map, bpm: __G.period && 60/__G.period, kicks: [...kicks].map(k => +(+k).toFixed(2)).sort()};
  __g.grooveToggle(); await __live(300); r.after = __F.map ? __F.map.src || 'track' : 'none'; return r; });
check('playing on its own, the sequencer gives the beat grid its beats at its tempo', a.src === 'internal' && a.map && Math.abs(a.bpm - 180) < .5, JSON.stringify(a));
check('each beat\'s pulse is as strong as the kick on it (none on the beats without one)', a.kicks.includes(0) && a.kicks.some(k => k >= .99), a.kicks.join(', '));
check('stopped, the beat grid goes back to listening', a.after !== 'internal', a.after);

// the song: the kick out for two bars and back: known ahead, run up to, landing on the moment
const b = await run(async () => { __fresh(); __g.GB.kick.fill(1, 0, 16); __g.GB.kick.fill(0, 1, 16); [0, 4, 8, 12].forEach(j => __g.GB.kick[j] = 1); __g.GB.chh.fill(1, 0, 16);
  __g.copyPattern(); __g.pickPattern(1); __g.pastePattern(); __g.GB.kick.fill(0); __g.pickPattern(0);
  Object.assign(__g.GB, {song: [0, 1, 1, 0], songOn: true}); const d0 = __J.lastDrop; let planned = null, anticip = 0, at = null, coming = 0;
  __g.grooveToggle();
  await __live(7000, () => { const p = __C.PLAN.drops.find(d => d.plan); if (p && !planned) planned = {...p}; anticip = Math.max(anticip, __J.anticip); coming = Math.max(coming, __S.coming || 0);
    if (at == null && __J.lastDrop !== d0) at = __F.at(); });
  __g.grooveToggle(); return {planned: planned && {t: planned.t, brk: planned.brk}, anticip, at, err: planned && at != null ? at - planned.t : null}; });
check('the song\'s drop is known ahead: the kick back after the breakdown, with where the breakdown began', b.planned && b.planned.t - b.planned.brk > 2.5, JSON.stringify(b.planned));
check('Journey runs up to it, and the drop lands on the moment', b.anticip > .5 && b.err != null && Math.abs(b.err) < .1, `run-up ${b.anticip.toFixed(2)}, landed ${b.err == null ? 'never' : (b.err*1000).toFixed(0) + ' ms from the kick'}`);

// a pattern picked while playing: a section starts at the bar line
const c = await run(async () => { __fresh(); [0, 4, 8, 12].forEach(j => __g.GB.kick[j] = 1); __g.pickPattern(1); [0, 4, 8, 12].forEach(j => __g.GB.kick[j] = 1); __g.GB.clap[4] = 1; __g.pickPattern(0);
  __g.grooveToggle(); await __live(1500); __J.secAge = 30; const type = __J.type; __g.pickPattern(1); const ch = __C.PLAN.changes.slice(-1)[0];
  let started = null; await __live(3000, () => { if (started == null && __J.secAge < 1 && __J.type) started = __F.at(); }); __g.grooveToggle();
  return {change: ch && ch.t, started, err: ch && started != null ? started - ch.t : null, newType: __J.type !== type}; });
check('a pattern picked while playing starts a section at the bar line', c.err != null && c.err > -.2 && c.err < .6, `section ${c.err == null ? 'never' : (c.err*1000).toFixed(0) + ' ms from the bar line'}`);

// the kick muted for bars, then back: a drop; and the notes on the signal bus as they're heard
const d = await run(async () => { __fresh(); [0, 4, 8, 12].forEach(j => __g.GB.kick[j] = 1); __g.GB.snare[4] = __g.GB.snare[12] = 1; __g.GB.chh.fill(1, 0, 16);
  __g.grooveToggle(); let nk = 0, ns = 0, nh = 0; await __live(1500, () => { nk = Math.max(nk, __S.nKick); ns = Math.max(ns, __S.nSnare); nh = Math.max(nh, __S.nHat); });
  __g.setMute('kick', true); const d0 = __J.lastDrop; __J.lastDrop -= 20000; const d1 = __J.lastDrop; await __live(3000); __g.setMute('kick', false);
  let dropped = false; await __live(1200, () => { if (__J.lastDrop !== d1) dropped = true; }); __g.grooveToggle();
  return {nk, ns, nh, dropped, live: __C.PLAN.drops.filter(x => !x.plan).length}; });
check('a kick unmuted after bars of silence is a drop', d.dropped && d.live >= 1, JSON.stringify({dropped: d.dropped, live: d.live}));
check('the sequencer\'s notes reach the signal bus as they\'re heard', d.nk > .3 && d.ns > .3 && d.nh > .3, `kick ${d.nk.toFixed(2)}, snare ${d.ns.toFixed(2)}, hats ${d.nh.toFixed(2)}`);

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
