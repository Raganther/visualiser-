// A real track through the visualiser, offline: the page's own analyser read 60 times a second, fed to the page on its test
// clock, recording the beat grid, sections and Journey each second, with a still every 30 s. The track stays outside the repo.
// Usage: node tools/track-run.mjs <track file> [--mode 2d|gl] [--seed 1] [--out dir]
import fs from 'fs';
import path from 'path';
import { serve, launch, openPage } from '../tests/lib.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const track = args[0], mode = opt('mode', '2d'), seed = +opt('seed', 1), OUT = opt('out', 'track-run');
if (!track || !fs.existsSync(track)) { console.log('usage: node tools/track-run.mjs <track file> [--mode 2d|gl] [--seed 1] [--out dir]'); process.exit(1); }
fs.mkdirSync(OUT, {recursive: true});
const {srv, url} = await serve(); const b = await launch(mode);
const page = await openPage(b, url, {groove: false, seed, width: 640, height: 360});
await page.route('**/__track', r => r.fulfill({body: fs.readFileSync(track), contentType: 'application/octet-stream'}));
const res = await page.evaluate(async (mode) => {
  document.querySelector('#welcome').style.display = 'none'; document.body.classList.add('clean');
  // 1. the page's analyser settings, read at 60 fps offline
  const ab = await (await fetch('/__track')).arrayBuffer();
  const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(ab);
  const N = Math.floor(buf.duration*60), oc = new OfflineAudioContext(2, buf.length, 44100);
  const src = oc.createBufferSource(); src.buffer = buf;
  const an = oc.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = .2;
  src.connect(an); an.connect(oc.destination); src.start(0);
  const F = new Uint8Array(N*1024), FD = new Float32Array(N*700), WV = new Uint8Array(N*256), tf = new Uint8Array(1024), td = new Float32Array(1024), tw = new Uint8Array(2048);
  for (let k = 1; k < N; k++) oc.suspend(k/60).then(() => { an.getByteFrequencyData(tf); F.set(tf, k*1024); an.getFloatFrequencyData(td); FD.set(td.subarray(0, 700), k*700); an.getByteTimeDomainData(tw);
    for (let i = 0; i < 256; i++) WV[k*256 + i] = tw[i*8]; oc.resume(); });
  await oc.startRendering();
  // stereo width per frame (the side against the whole), as the page's channel pair would hear it
  const WD = new Float32Array(N), cL = buf.getChannelData(0), cR = buf.numberOfChannels > 1 ? buf.getChannelData(1) : cL;
  for (let k = 0; k < N; k++) { const o = Math.floor(k*buf.sampleRate/60); let m = 0, sd = 0;
    for (let i = 0; i < 512 && o + i < cL.length; i++) { const a = cL[o + i], b = cR[o + i]; m += (a + b)**2; sd += (a - b)**2; } WD[k] = sd/(m + sd + 1e-9); }
  // 2. fed to the page in place of the built-in beat
  window.__synth = (t, freq, wave, db) => { const k = Math.min(N - 1, Math.round(t*60/1000));
    freq.set(F.subarray(k*1024, k*1024 + 1024)); db.set(FD.subarray(k*700, k*700 + 700)); for (let i = 700; i < 1024; i++) db[i] = freq[i]/255*70 - 100; for (let i = 0; i < 256; i++) wave[i*8] = WV[k*256 + i]; window.__width = WD[k]; return 'db'; };
  // 3. step through, recording
  const an2 = await import('/src/audio/analysis.js'), {J} = await import('/src/journey/core.js'), {L} = await import('/src/audio/listen.js');
  const r2 = x => +x.toFixed(2);
  const secs = [], shots = []; let lb = an2.lastBeat, kicks = 0, stabs = 0, lastHit = 0;
  for (let f = 0; f < N; f++) {
    __step(1);
    if (an2.lastBeat !== lb) { kicks++; lb = an2.lastBeat; }
    if (an2.hit > .8 && lastHit <= .8) stabs++; lastHit = an2.hit;
    if (f % 60 === 59) {
      const d = __jdbg();
      secs.push({s: (f + 1)/60, bpm: d.grid.bpm && +d.grid.bpm.toFixed(1), locked: d.grid.locked, dsure: d.grid.dsure && +d.grid.dsure.toFixed(2),
        sec: d.sec, types: d.types, recipe: d.recipe, lead: d.lead, accent: d.accent, hit: d.hit, world: d.world, scene: d.scene, centre: d.centre, pal: J.type && J.type.pal, lens: d.lensOn ? (d.lens && d.lens.n) : 0,
        pace: d.pace.name, div: d.pace.div, T: +d.T.toFixed(2), eM: +J.eM.toFixed(3), hi: +J.hi.toFixed(3), lo: +J.lo.toFixed(3), nov: +(d.nov || 0).toFixed(3), prog: d.progStep, kicks, stabs, drop: J.lastDrop, L: {hat: r2(L.hat), noise: r2(L.noise), bass: r2(L.bass), cut: r2(L.cut), width: r2(L.width), full: r2(L.full), harm: r2(L.harm), nov: r2(L.nov), loop: L.loop, brk: L.brk, drops: L.drops, key: L.key}, feats: Object.fromEntries(Object.entries(d.feats).map(([k, v]) => [k, +v.toFixed(2)]))});
      kicks = 0; stabs = 0;
    }
    if (f % 1800 === 900) shots.push({s: f/60, png: document.querySelector('canvas').toDataURL('image/jpeg', .8)});
  }
  // an independent tempo estimate: autocorrelation of the low band's rises
  const env = new Float32Array(N); for (let k = 1; k < N; k++) { let s = 0; for (let i = 1; i < 7; i++) s += Math.max(0, F[k*1024 + i] - F[(k - 1)*1024 + i]); env[k] = s; }
  let best = 0, bl = 0; for (let lag = 20; lag <= 45; lag++) { let s = 0; for (let k = lag; k < N; k++) s += env[k]*env[k - lag]; if (s > best) { best = s; bl = lag; } }
  return {dur: buf.duration, N, secs, shots, acBpm: 3600/bl};
}, mode);
const name = path.basename(track).replace(/\.[^.]+$/, '');
fs.writeFileSync(path.join(OUT, `${name}-${mode}-${seed}.json`), JSON.stringify({...res, shots: undefined}));
res.shots.forEach(s => fs.writeFileSync(path.join(OUT, `${name}-${mode}-${Math.round(s.s)}s.jpg`), Buffer.from(s.png.split(',')[1], 'base64')));
// the summary: how well the grid held, and what Journey chose
const S = res.secs, locked = S.filter(s => s.locked), bpms = locked.map(s => s.bpm).filter(Boolean).sort((a, b) => a - b);
const count = k => Object.entries(S.reduce((o, s) => (o[s[k] || 'none'] = (o[s[k] || 'none'] || 0) + 1, o), {})).map(([v, n]) => `${v} ${n}s`).join(', ');
console.log(`${res.dur.toFixed(0)} s; grid locked ${locked.length} s, median ${bpms[bpms.length >> 1] || '?'} BPM (autocorrelation says ${res.acBpm.toFixed(1)})`);
console.log(`sections: ${new Set(S.map(s => s.sec)).size}; section changes: ${S.filter((s, i) => i && s.sec !== S[i - 1].sec).length}`);
for (const k of ['world', 'recipe', 'lead', 'scene', 'hit', 'centre', 'pace']) console.log(`${k}: ${count(k)}`);
console.log(`written to ${OUT}/; errors ${JSON.stringify(await page.errors())}`);
await b.close(); srv.close();
