// DJ mode (audio/dj.js, ui/dj.js), with real audio on two synthetic tracks (124 and 128 BPM): the panel opens under the
// picture (which is drawn that much shorter) and closes again; each deck's beats are read; sync matches the tempo and
// lines up the bars, and they stay in phase; the crossfader hands the beat grid to the other deck; the EQ and filter move; cue goes back, set moves it; a loop goes round.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('dj: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// the panel and the picture's size, in both renderers
for (const mode of ['gl', '2d']) {
  const browser = await launch(mode), page = await openPage(browser, url, {width: 1000, height: 700, groove: false, noDraw: true});
  const r = await page.evaluate(async () => {
    const {S} = await import('/src/state.js'), c = () => document.querySelector('#gl');
    const h0 = [c().clientHeight, c().height]; document.querySelector('#djBtn').click(); __step(2);
    const open = [S.djH, c().clientHeight, c().height, !document.querySelector('#dj').hidden];
    document.querySelector('#dj .djx').click(); __step(2);
    return {h0, open, closed: [S.djH, c().clientHeight, c().height, document.querySelector('#dj').hidden]};
  });
  const errors = await page.errors();
  check(`${mode}: the panel opens under the picture, which is drawn that much shorter, and closes again`,
    r.open[0] > 100 && r.open[3] && r.open[1] === r.h0[0] - r.open[0] && r.open[2] < r.h0[1] && r.closed[0] === 0 && r.closed[3] && r.closed[1] === r.h0[0] && r.closed[2] === r.h0[1] && !errors.length,
    `picture ${r.h0[0]} px high, ${r.open[1]} with the panel (${r.open[0]} px), ${r.closed[1]} closed; drawn ${r.h0[1]} → ${r.open[2]} → ${r.closed[2]}${errors.length ? '; ' + errors : ''}`);
  await browser.close();
}

// the decks, with real audio
const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 1000, height: 700, groove: false, noDraw: true});
const step = n => page.evaluate(n => __step(n), n);
const run = f => page.evaluate(f);
await run(async () => {
  const dj = await import('/src/audio/dj.js'), pl = await import('/src/audio/player.js');
  pl.ensureAudio(); window.__dj = dj;
  // kicks (a falling sine), a louder one on each 1, and an off-beat hat
  const mk = (bpm, secs) => { const sr = pl.actx.sampleRate, buf = pl.actx.createBuffer(2, sr*secs, sr), P = 60/bpm;
    for (let c = 0; c < 2; c++) { const a = buf.getChannelData(c);
      for (let k = 0; k*P < secs - .3; k++) { const s0 = Math.round(k*P*sr), f = k % 4 === 0 ? 1 : .75;
        for (let j = 0; j < sr*.18 && s0 + j < a.length; j++) { const t = j/sr; a[s0 + j] += f*.9*Math.sin(2*Math.PI*(50 + 120*Math.exp(-t*30))*t)*Math.exp(-t*12); }
        const h = Math.round((k*P + P/2)*sr); for (let j = 0; j < sr*.03 && h + j < a.length; j++) a[h + j] += (Math.random()*2 - 1)*.15*Math.exp(-j/sr*90); } }
    return buf; };
  document.querySelector('#djBtn').click();
  await dj.djLoad(0, mk(124, 60), 'A'); await dj.djLoad(1, mk(128, 60), 'B');
});
const bpms = await run(() => __dj.DJ.decks.map(d => d.ana && d.ana.map ? d.ana.map.bpm : null));
check('each deck\'s beats are read ahead', Math.abs(bpms[0] - 124) < .2 && Math.abs(bpms[1] - 128) < .2, `${bpms.map(b => b && b.toFixed(2)).join(' and ')} BPM`);

await run(() => __dj.djPlay(0)); await wait(1200); await step(3);
const a = await run(async () => { const {F} = await import('/src/audio/foresee.js'), D = __dj.DJ.decks; return {lead: __dj.DJ.lead && __dj.DJ.lead.i, map: F.map === D[0].ana.map, at: F.at(), pos: __dj.pos(D[0])}; });
check('the playing deck leads: the beat grid keeps its map and its time', a.lead === 0 && a.map && Math.abs(a.at - a.pos) < .3, `lead ${a.lead}, grid at ${a.at.toFixed(2)} s, deck at ${a.pos.toFixed(2)} s`);

const sy = await run(() => { const ok = __dj.djSync(1), D = __dj.DJ.decks; return {ok, a: __dj.bpm(D[0]), b: __dj.bpm(D[1])}; });
check('sync matches the tempo', sy.ok === true && Math.abs(sy.a - sy.b) < .05, `${sy.a.toFixed(2)} and ${sy.b.toFixed(2)} BPM`);
await run(() => __dj.djPlay(1));   // started on A's next 1
await wait(3500);
let worst = 0;
for (let k = 0; k < 12; k++) {   // kept in phase while both play
  await step(2); await wait(250);
  const e = await run(() => { const D = __dj.DJ.decks; return D[1].playing ? __dj.barBeat(D[0]) - __dj.barBeat(D[1]) : NaN; });
  worst = Math.max(worst, Math.abs(((e % 4) + 6) % 4 - 2));
}
check('started on the other\'s 1 and kept in phase (bars lined up)', worst < .06, `worst ${(worst*60000/124).toFixed(1)} ms out (${worst.toFixed(3)} beats)`);

await run(() => __dj.djXf(1)); await step(3);
const x = await run(async () => { const {F} = await import('/src/audio/foresee.js'), D = __dj.DJ.decks; return {lead: __dj.DJ.lead && __dj.DJ.lead.i, map: F.map === D[1].ana.map, rate: F.rate, r1: D[1].rate}; });
check('the crossfader hands the beat grid to the other deck', x.lead === 1 && x.map && Math.abs(x.rate - x.r1) < 1e-9, `lead ${x.lead}, grid's tempo ×${x.rate.toFixed(4)}`);

await run(() => { __dj.djEq(0, 'low', -26); __dj.djFilter(1, -.6); }); await wait(300);
const eq = await run(() => { const D = __dj.DJ.decks; return {low: D[0].n.low.gain.value, type: D[1].n.filt.type, f: D[1].n.filt.frequency.value}; });
check('the EQ kills the bass, and the filter closes down', eq.low < -20 && eq.type === 'lowpass' && eq.f < 2000, `low ${eq.low.toFixed(1)} dB, ${eq.type} at ${Math.round(eq.f)} Hz`);

// cue: always back to the cue point, stopped; set: the cue point here, on a beat
const cue = await run(() => { const d = __dj.DJ.decks[0], c0 = d.cue; __dj.djSeek(0, 20); __dj.djCue(0); const back = [d.playing, d.off, c0];
  __dj.djSeek(0, 10.3); __dj.djSetCue(0); const set = d.cue, k = __dj.beatAt(d, set); __dj.djSeek(0, 30); __dj.djCue(0); return {back, set, k, again: d.off}; });
check('cue goes back to the cue point, stopped; set puts it on the nearest beat',
  cue.back[0] === false && Math.abs(cue.back[1] - cue.back[2]) < 1e-6 && Math.abs(cue.set - 10.3) < .3 && Math.abs(cue.k - Math.round(cue.k)) < 1e-3 && Math.abs(cue.again - cue.set) < 1e-6,
  `back to ${cue.back[1].toFixed(3)} s; set at ${cue.set.toFixed(3)} s (beat ${cue.k.toFixed(3)}), back there from 30 s`);

// a loop of 4 beats: it stays inside it, going round, and leaving it plays on
await run(() => { __dj.djXf(.5); __dj.djPlay(0); }); await wait(600);
const lp = await run(() => { __dj.djLoop(0, 4); const L = __dj.DJ.decks[0].loop; return {a: L.a, b: L.b, beats: __dj.beatAt(__dj.DJ.decks[0], L.b) - __dj.beatAt(__dj.DJ.decks[0], L.a)}; });
const xs = [];
for (let k = 0; k < 16; k++) { await wait(250); xs.push(await run(() => __dj.pos(__dj.DJ.decks[0]))); }
const inside = xs.every(x => x >= lp.a - .01 && x < lp.b + .01), wraps = xs.filter((x, k) => k && x < xs[k - 1]).length;
await run(() => __dj.djLoop(0, 4)); await wait(2500);
const out = await run(() => ({x: __dj.pos(__dj.DJ.decks[0]), loop: __dj.DJ.decks[0].loop}));
check('a 4-beat loop stays inside itself, going round, and leaving it plays on', Math.abs(lp.beats - 4) < .01 && inside && wraps >= 1 && !out.loop && out.x > lp.b,
  `loop ${lp.a.toFixed(2)}–${lp.b.toFixed(2)} s (${lp.beats.toFixed(2)} beats), round it ${wraps} times in 4 s, then on to ${out.x.toFixed(2)} s`);

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
