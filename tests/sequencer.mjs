// The sequencer (audio/groove.js), with real audio: a pattern queued while playing starts on the next bar line; the song
// alternates its patterns a bar each; a row of its own length repeats at that length (polymeter); a 1:2 step plays every
// other time round, a Fill step only while Fill is held, a step at no chance never; a ratchet plays three in a step, a
// nudge moves a hit later, solo leaves one row; a euclidean row spreads its hits; the piano roll's notes play on the synth;
// recording lands a drum and a synth key on the steps heard; a step's lock changes the voice's tune; copy and paste; and a
// groovebox saved before patterns comes back as pattern A.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('sequencer: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 1000, height: 700, groove: false, noDraw: true});
const run = f => page.evaluate(f);
await run(async () => {
  window.__g = await import('/src/audio/groove.js'); window.__k = await import('/src/audio/keys.js'); (await import('/src/audio/player.js')).ensureAudio();
  const ev = await import('/src/audio/engine/events.js'); window.__n = []; ev.onNote(e => __n.push(e));
  window.__wait = ms => new Promise(r => setTimeout(r, ms));
  // a fresh start: 180 BPM on its own clock, every pattern empty
  window.__fresh = () => { if (__g.GB.playing) __g.grooveToggle(); Object.assign(__g.GB, {sync: false, bpm: 180, swing: 0, mute: {}, solo: null, songOn: false, song: [], fill: false, rec: false, next: null});
    for (let i = 0; i < 8; i++) { __g.GB.pat = i; __g.clearPattern(); } __g.GB.pat = 0; __g.bind(); __n.length = 0; };
  window.__dur = 60/180/4;
});

// patterns: B queued while A plays starts on a bar line
const p1 = await run(async () => { __fresh(); __g.GB.kick[0] = 1; __g.GB.pat = 1; __g.bind(); __g.GB.clap[0] = 1; __g.GB.pat = 0; __g.bind();
  __g.grooveToggle(); await __wait(900); __g.pickPattern(1); const queued = __g.GB.next; await __wait(2200); __g.grooveToggle();
  const first = __n.find(e => e.ch === 'clap'), at = __g.LOG.find(l => Math.abs(l.t - first.t) < 1e-6);
  return {queued, kicksBefore: __n.filter(e => e.ch === 'kick' && e.t < first.t).length, kicksAfter: __n.filter(e => e.ch === 'kick' && e.t > first.t).length, i: at && at.i, pat: __g.GB.pat}; });
check('a pattern picked while playing starts on the next bar line', p1.queued === 1 && p1.i === 0 && p1.kicksBefore >= 1 && p1.kicksAfter === 0 && p1.pat === 1, JSON.stringify(p1));

// the song: A, B, A, B, a bar each
const p2 = await run(async () => { __fresh(); __g.GB.kick[0] = 1; __g.GB.pat = 1; __g.bind(); __g.GB.clap[0] = 1; __g.GB.pat = 0; __g.bind();
  Object.assign(__g.GB, {song: [0, 1], songOn: true}); __g.grooveToggle(); await __wait(5600); __g.grooveToggle();
  return __n.filter(e => e.ch === 'kick' || e.ch === 'clap').map(e => e.ch[0]).join(''); });
check('the song plays its patterns a bar each, in turn', /^(kc){2,}k?$/.test(p2), p2);

// polymeter: a clave row 3 steps long against the 16
const p3 = await run(async () => { __fresh(); __g.setLen('clave', 3); __g.GB.clave[0] = 1; __g.GB.kick[0] = 1; __g.grooveToggle(); await __wait(1700); __g.grooveToggle();
  const t = __n.filter(e => e.ch === 'clave').map(e => e.t); return t.slice(1).map((x, k) => Math.round((x - t[k])/__dur*100)/100); });
check('a row of its own length repeats at that length (polymeter)', p3.length >= 5 && p3.every(d => d === 3), p3.join(','));

// conditions, chance and fill
const p4 = await run(async () => { __fresh(); __g.GB.kick[0] = 1; __g.setStepX('kick', 0, 'cond', '1:2'); __g.GB.rim[4] = 1; __g.setStepX('rim', 4, 'chance', 0);
  __g.GB.clap[8] = 1; __g.setStepX('clap', 8, 'cond', 'Fill'); __g.GB.chh[0] = 1;
  __g.grooveToggle(); await __wait(2900); __g.GB.fill = true; await __wait(1400); __g.GB.fill = false; __g.grooveToggle();
  const bars = __g.LOG.filter(l => l.i === 0).length; return {bars: __n.filter(e => e.ch === 'chh').length, kicks: __n.filter(e => e.ch === 'kick').length, rims: __n.filter(e => e.ch === 'rim').length, claps: __n.filter(e => e.ch === 'clap').length}; });
check('a 1:2 step plays every other bar, a step at no chance never, a Fill step only while Fill is held', p4.kicks === Math.ceil(p4.bars/2) && p4.rims === 0 && p4.claps >= 1 && p4.claps <= 2, JSON.stringify(p4));

// ratchet, nudge, solo
const p5 = await run(async () => { __fresh(); __g.GB.kick[0] = 1; __g.setStepX('kick', 0, 'rat', 3); __g.GB.snare[4] = 1; __g.setStepX('snare', 4, 'nudge', .25); __g.GB.chh[2] = 1;
  __g.grooveToggle(); await __wait(1500); __g.GB.solo = 'snare'; __n.length = 0; await __wait(1500); __g.grooveToggle();
  return {soloOnly: __n.every(e => e.ch === 'snare') && __n.length > 0}; });
const p5b = await run(async () => { __fresh(); __g.GB.kick[0] = 1; __g.setStepX('kick', 0, 'rat', 3); __g.GB.snare[4] = 1; __g.setStepX('snare', 4, 'nudge', .25);
  __g.grooveToggle(); await __wait(1500); __g.grooveToggle();
  const k = __n.filter(e => e.ch === 'kick').slice(0, 3).map(e => e.t), s = __n.find(e => e.ch === 'snare'), st = __g.LOG.find(l => l.i === 4 && Math.abs(s.t - l.t) < __dur);
  return {rat: k.slice(1).map((x, i) => Math.round((x - k[i])/__dur*100)/100), nudge: Math.round((s.t - st.t)/__dur*100)/100}; });
check('a ratchet plays three in its step, a nudge moves a hit later, and solo leaves one row', p5b.rat.join() === '0.33,0.33' && p5b.nudge === .25 && p5.soloOnly, JSON.stringify({...p5, ...p5b}));

// euclid, copy and paste
const p6 = await run(async () => { __fresh(); __g.euclid('rim', 5); const hits = __g.GB.rim.slice(0, 16).map((h, j) => h ? j : -1).filter(j => j >= 0);
  __g.copyPattern(); __g.pickPattern(3); __g.pastePattern(); const pasted = __g.GB.rim.slice(0, 16).join(''); return {hits, gaps: hits.map((j, i) => ((hits[(i + 1) % hits.length] - j) + 16) % 16), same: pasted === __g.GB.pats[0].rim.slice(0, 16).join('') && __g.GB.pat === 3}; });
check('a euclidean row spreads its hits, and a pattern copies into another', p6.hits.length === 5 && p6.gaps.every(g => g === 3 || g === 4) && p6.same, JSON.stringify(p6));

// the piano roll on the synth, and recording
const p7 = await run(async () => { __fresh(); __g.toggleNote(0, 60, 2); __g.toggleNote(8, 67, 4); __g.grooveToggle(); await __wait(1500);
  const syn = __n.filter(e => e.ch === 'synth').slice(0, 2).map(e => [e.note, Math.round(e.len/__dur*100)/100]);
  __g.GB.rec = true; __g.recHit('rim'); __k.keyDown(72); await __wait(300); __k.keyUp(72); await __wait(100); __g.GB.rec = false; __g.grooveToggle();
  const n72 = __g.pat().synth.find(o => o.n === 72); return {syn, rim: __g.GB.rim.filter(Boolean).length, n72: n72 && n72.l}; });
check('the piano roll\'s notes play on the synth, at their lengths', JSON.stringify(p7.syn) === '[[60,1.84],[67,3.68]]', JSON.stringify(p7.syn));
check('recording lands a drum and a held synth key on the steps heard', p7.rim === 1 && p7.n72 >= 2 && p7.n72 <= 6, `rim hits ${p7.rim}, the key held ${p7.n72} steps`);

// a step's lock: the kick a full octave up on that step (rendered offline)
const p8 = await run(async () => { const {makeDrums} = await import('/src/audio/engine/inst/drums.js'), SR = 44100, c = new OfflineAudioContext(1, SR, SR), k = makeDrums(c, c.destination);
  k.play('kick', .05, 1, {tune: 12}); const d = (await c.startRendering()).getChannelData(0);
  const tone = f => { const w = 2*Math.PI*f/SR; let a = 0, b = 0; for (let i = SR*.15; i < SR*.4; i++) { const s = d[i] + 2*Math.cos(w)*a - b; b = a; a = s; } return Math.hypot(a - Math.cos(w)*b, Math.sin(w)*b); };
  return tone(98)/tone(49); });
check('a step\'s lock plays its voice with its own tune', p8 > 3, p8.toFixed(1));

// a groovebox saved before patterns comes back with its pattern as A
await run(() => { localStorage.setItem('afterglow.groove', JSON.stringify({kit: '808', kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1], clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], bass: [{on: 1, n: 3, a: 0, s: 0}]})); });
await page.reload(); await page.waitForFunction(() => window.__step);
const p9 = await run(async () => { const g = await import('/src/audio/groove.js'); return {kick: g.GB.kick.slice(0, 16).join(''), pats: g.GB.pats.length, bass: g.GB.bass[0].on, kit: g.GB.kit}; });
check('a groovebox saved before patterns comes back as pattern A', p9.kick === '1000100010001001' && p9.pats === 8 && p9.bass === 1 && p9.kit === '808', JSON.stringify(p9));

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
