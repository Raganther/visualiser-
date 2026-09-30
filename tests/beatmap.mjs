// Beat map test (audio/foresee.js beatMap, and the beat grid running from it in audio/beatgrid.js): a synthetic 124 BPM
// track (a kick on every beat from 0.137 s, claps on 2 and 4, hats coming in at bar 16, a breakdown with no kick from bar 24,
// the drop at bar 32) is read ahead. The map must find the tempo, every beat within a few milliseconds (through the
// breakdown too), the 1, the drop on its beat, where the kick is and isn't, and a change on a phrase line. Then, playing
// it on the test's clock, the grid must be locked from the first beat, tick each beat on time with the 1 in the right
// place, pulse softly where there's no kick, and a new section start on the map's change. Reads the modules.
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('beatmap: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve(), browser = await launch('2d');
const page = await openPage(browser, url, {groove: 'texture', noDraw: true});
const BPM = 124, T0 = .137, P = 60/BPM, BARS = 44;
const r = await page.evaluate(async ([BPM, T0, BARS]) => {
  const P = 60/BPM, sr = 22050, dur = T0 + BARS*4*P + 1, n = Math.floor(sr*dur);
  const buf = new AudioBuffer({length: n, sampleRate: sr, numberOfChannels: 1}), x = buf.getChannelData(0);
  let seed = 11; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647 - .5;
  for (let i = 0; i < n; i++) {
    const t = i/sr - T0; if (t < 0) continue;
    const k = Math.floor(t/P), b = t - k*P, bar = Math.floor(k/4), beat = k % 4; let v = 0;
    if (bar < 24 || bar >= 32) v += Math.sin(2*Math.PI*(45 + 90*Math.exp(-b*30))*b)*Math.exp(-b*8)*.8;   // the kick
    if (beat % 2 === 1) v += rnd()*Math.exp(-b*25)*.25;                                                  // claps on 2 and 4
    if (bar >= 16) { const h = (t + P/2) % P; v += rnd()*Math.exp(-h*80)*.12; }                            // off-beat hats from bar 16
    x[i] = v;
  }
  const {foresee} = await import('/src/audio/foresee.js'), F = await foresee(buf), M = F.map;
  if (!M) return {none: true};
  return {bpm: M.bpm, conf: M.conf, beats: Array.from(M.beats), kick: Array.from(M.kick), down: M.down, phrase: M.phrase, changes: M.changes, drops: F.drops};
}, [BPM, T0, BARS]);
if (r.none) { console.log('FAIL no beat map'); await browser.close(); srv.close(); process.exit(1); }
// the true beats, and which of the map's is which
const truth = k => T0 + k*P, idx = r.beats.map(t => Math.round((t - T0)/P)), err = r.beats.map((t, i) => Math.abs(t - truth(idx[i])));
const brkErr = err.filter((_, i) => idx[i] >= 96 && idx[i] < 128), kickIn = r.kick.filter((_, i) => idx[i] < 96 || idx[i] >= 128), kickOut = r.kick.filter((_, i) => idx[i] >= 97 && idx[i] < 128);
const downOk = ((idx[r.down] % 4) + 4) % 4 === 0, dropBeat = r.drops.find(d => Math.abs(d.t - truth(128)) < .3);
// 2. playing it: the grid from the map on the test's clock (F.at), Journey on
const live = await page.evaluate(async () => {
  const {F} = await import('/src/audio/foresee.js'), {J} = await import('/src/journey/core.js'), {G} = await import('/src/audio/beatgrid.js'), {S} = await import('/src/state.js');
  window.__ft = 0; F.at = () => window.__ft;
  const ticks = [], secs = []; let beats = J.beats, age = J.secAge;
  for (let f = 1; f <= 60*85; f++) {
    window.__ft = f/60; __step(1);
    if (J.beats !== beats) { beats = J.beats; ticks.push({t: window.__ft, pos: J.pos, locked: G.locked, map: G.map, beat: S.beat, kick: G.kick}); }
    if (J.secAge < age) secs.push(window.__ft); age = J.secAge;
  }
  return {ticks, secs};
});
const errors = await page.errors();
const tk = live.ticks, firstTick = tk[0], onTime = tk.map(x => { const k = Math.round((x.t - T0)/P); return {k, e: x.t - truth(k), pos: x.pos}; });
const late = onTime.filter(x => x.e < -.01 || x.e > 1/60 + .01).length, posOk = onTime.filter(x => ((x.k % 4) + 4) % 4 === x.pos).length;
const soft = tk.filter(x => { const k = Math.round((x.t - T0)/P); return k >= 97 && k < 128; }), hard = tk.filter(x => { const k = Math.round((x.t - T0)/P); return k > 8 && k < 96; });
const avg = a => a.reduce((s, v) => s + v, 0)/Math.max(1, a.length);
const changeT = r.changes.map(c => c.t), secAtChange = changeT.filter(c => live.secs.some(s => s >= c - .05 && s < c + P*.6));
const fx = v => typeof v === 'number' ? +v.toFixed(4) : v;
const checks = [
  ['the tempo found', [r.bpm], ([b]) => Math.abs(b - BPM) < .02],
  ['every beat within 5 ms of where it is (worst)', [Math.max(...err)*1000], ([e]) => e < 5],
  ['...through the breakdown with no kick too (worst)', [Math.max(...brkErr)*1000, brkErr.length], ([e, n]) => e < 5 && n >= 30],
  ['none missed or doubled', [r.beats.length, new Set(idx).size], ([a, b]) => a === b && a >= BARS*4 - 1],
  ['the 1 found', [downOk, r.down], ([ok]) => ok],
  ['the kick where it is, and none in the breakdown', [avg(kickIn), Math.max(...kickOut)], ([a, b]) => a > .7 && b < .2],
  ['the drop found on its beat (bar 32)', [dropBeat && dropBeat.t, truth(128)], ([t, w]) => t !== undefined && Math.abs(t - w) < .005],
  ['a change on a phrase line (bars 16, 24 or 32)', [r.changes.map(c => Math.round((c.t - T0)/P/4))], ([b]) => b.some(x => [16, 24, 32].includes(x)) && b.every(x => x % 4 === 0)],
  ['playing: locked from the first beat', [firstTick && firstTick.t, firstTick && firstTick.map], ([t, m]) => m && t < T0 + .05],
  ['...each beat ticked on time (within a frame)', [late, tk.length], ([l, n]) => l === 0 && n > 150],
  ['...with the 1 where it is', [posOk, tk.length], ([a, b]) => a === b],
  ['...a soft pulse where there is no kick', [avg(soft.map(x => x.kick)), avg(hard.map(x => x.kick))], ([s, h]) => s < .2 && h > .7],
  ['...and a new section on the map\'s change', [secAtChange.map(fx), changeT.map(fx), live.secs.map(fx)], ([a]) => a.length >= 1],
  ['no page errors', [errors.length], ([n]) => n === 0],
];
let failed = false;
for (const [name, v, ok] of checks) { const pass = ok(v); failed ||= !pass; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(v.map(fx))}`); }
if (errors.length) console.log(errors);
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
