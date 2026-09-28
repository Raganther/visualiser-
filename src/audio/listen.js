// Listening for texture, not just loudness: hi-hats, noise against tone, whether the bass is there, the filter's cutoff,
// the notes, stereo width, and a memory of recent bars (something new, or the same loop again). Compressed techno barely
// changes in loudness from start to end; its parts are told apart by these. Fed each frame from the analyser's spectrum
// (freq, bytes in decibels) and once a bar (listenBar, from the beat grid). A leaf module: everything it learns is in L.
import { freq, freqDb } from '../state.js';
import { TUNE } from '../tuning.js';

// what it hears, each 0..1 unless said:
// hat: hi-hats and other top-end ticking; noise: noisy (1) or tonal (0); bass: the bass there, against its recent loudest;
// cut: where the brightness rolls off (the filter); width: stereo spread (from the analyser pair, or a test); full: how
// much is going on (hats, noise and bass together); chroma: the notes this bar (12, C first); harm: how far the notes
// moved from the bars before; nov: how unlike the recent bars this one is (something new); loop: bars the loop has run
// much the same; brk: in a breakdown (the bass gone a while); drops: the bass coming back after one (counts up); hats: the
// hats in or out (with a margin between), and events: the big moves in the texture (hats in or out, a breakdown starting)
export const L = {hat: 0, noise: 0, bass: 1, cut: 0, width: 0, full: 0, chroma: new Float32Array(12), harm: 0, nov: 0, loop: 0,
  brk: false, brkT: 0, drops: 0, bars: 0, key: -1, hats: false, hatT: 0, events: 0};
const LN = new Float32Array(1024), prev = new Float32Array(1024);   // this frame's and the last's actual loudness per bin (from freqDb, unclipped)
let hatS = 0, hatMax = 0, bassS = 0, bassMax = 0, lastBar = 0, lastNow = 0;
// this bar's running sums: 16 bands (dB), the notes, and the frame measures
const NB = 16, EDGE = Array.from({length: NB + 1}, (_, i) => Math.round(1 + 699*Math.pow(i/NB, 2.2)));
const acc = {band: new Float32Array(NB), chroma: new Float32Array(12), hat: 0, noise: 0, n: 0};
const hist = [];   // recent bars' summaries, newest last
// the note each bin's centre falls on (bins 16..140: about 350 Hz to 3 kHz, where one bin is under a semitone)
const PC = Int8Array.from({length: 1024}, (_, i) => i < 16 || i > 140 ? -1 : ((Math.round(12*Math.log2(i*44100/2048/440)) + 69) % 12 + 12) % 12);

export function listenReset(){ hatS = hatMax = bassS = bassMax = 0; L.hats = false; L.hatT = 0; hist.length = 0; L.brk = false; L.loop = 0; L.nov = L.harm = 0; resetAcc(); }
function resetAcc(){ acc.band.fill(0); acc.chroma.fill(0); acc.hat = acc.noise = acc.n = 0; }
// each frame: now in ms, dt in seconds, width from the stereo pair (or null)
export function listenFrame(now, dt, width){
  const T = TUNE.listen;
  for (let i = 1; i < 700; i++) LN[i] = Math.pow(10, (Math.max(-100, freqDb[i]) + 30)/20);
  // hi-hats: how much the top octaves (5-14 kHz) keep rising, frame to frame, in actual loudness (so faint flicker in the
  // background doesn't count, only real ticks)
  let hf = 0; for (let i = 233; i < 650; i++) { const d = LN[i] - prev[i]; if (d > 0) hf += d; }
  hf /= 417;
  hatS += (hf - hatS)*Math.min(1, dt);   // over a second or so, so eighth-note ticks read as a steady amount
  hatMax = Math.max(hatS, hatMax - dt*T.forget*hatMax, T.hatFloor);
  L.hat += (Math.min(1, hatS/(hatMax*T.hatFull)) - L.hat)*Math.min(1, dt*2);
  // noise against tone in the mids (300 Hz to 3 kHz), where chords and stabs make peaks and washes, claps and noise
  // sweeps are smooth: spectral flatness (geometric over arithmetic mean)
  let lg = 0, ar = 0; for (let i = 14; i < 140; i++) { const v = LN[i] + 1e-5; lg += Math.log(v); ar += v; }
  const flat = Math.exp(lg/126)/(ar/126);
  L.noise += (Math.min(1, flat/T.flatFull) - L.noise)*Math.min(1, dt*1.5);
  // the bass (20-150 Hz, in decibels, over half a second so the kick's pumping evens out) against its loudest lately:
  // well under it for a while is a breakdown, and its return the drop
  let b = 0; for (let i = 1; i < 7; i++) b += Math.max(-100, freqDb[i]); b = b/6 + 100;
  bassS += (b - bassS)*Math.min(1, dt*2);
  bassMax = Math.max(bassS, bassMax - dt*T.bassForget);
  L.bass += (Math.max(0, Math.min(1, 1 - (bassMax - bassS)/T.bassDb)) - L.bass)*Math.min(1, dt*3);
  // (brkT: how long the bass has been low, counted from when it first went; a flicker of it mid-breakdown doesn't end it)
  if (!L.brk) { L.brkT = L.bass < T.brkBelow ? L.brkT + dt : Math.max(0, L.brkT - dt*4); if (L.brkT > T.brkSecs) { L.brk = true; L.events++; } }
  else if (L.bass > T.dropAbove) { L.upT = (L.upT || 0) + dt; if (L.upT > T.dropHold) { L.drops++; L.brk = false; L.brkT = 0; L.upT = 0; } }
  else { L.upT = 0; L.brkT += dt; }
  // the filter: where 85% of the energy lies below, on a log scale from 100 Hz to 15 kHz
  let tot = 0; for (let i = 3; i < 700; i++) tot += LN[i]**2;
  let c = 0, ri = 3; for (; ri < 700; ri++) { c += LN[ri]**2; if (c > tot*.85) break; }
  L.cut += (Math.log(ri/5)/Math.log(700/5) - L.cut)*Math.min(1, dt*2);
  if (width !== null && width !== undefined) L.width += (width - L.width)*Math.min(1, dt*2);
  L.full = Math.min(1, (L.hat + L.noise + L.bass)/3*1.2);
  // the hats in or out: a move past the margin that holds for a moment, after a few steady seconds, is an event
  L.hatT += dt;
  if (L.hats ? L.hat < T.hatOut : L.hat > T.hatIn) { if (L.hatT > T.eventGap) L.events++; L.hats = !L.hats; L.hatT = 0; }
  // this bar so far
  for (let k = 0; k < NB; k++) { let s = 0; for (let i = EDGE[k]; i < EDGE[k + 1]; i++) s += freq[i]; acc.band[k] += s/(255*(EDGE[k + 1] - EDGE[k])); }
  for (let i = 17; i < 140; i++) if (freq[i] > freq[i - 1] && freq[i] >= freq[i + 1] && freq[i] > 90) acc.chroma[PC[i]] += LN[i];   // peaks only
  acc.hat += L.hat; acc.noise += L.noise; acc.n++;
  prev.set(LN); lastNow = now;
  // no beat grid (music without a steady kick): a bar every two seconds instead
  if (now - lastBar > T.noGridBarMs) listenBar(now);
}
// once a bar: close its summary and compare it with the bars before
export function listenBar(now = lastNow){
  lastBar = now;
  if (acc.n < 10) return;
  const T = TUNE.listen, n = acc.n;
  const cn = Math.hypot(...acc.chroma) || 1, v = [...Array.from(acc.band, x => x/n*T.wBand), ...Array.from(acc.chroma, x => x/cn*T.wNotes),
    acc.hat/n*T.wHat, acc.noise/n*T.wNoise];
  hist.push(v); if (hist.length > 48) hist.shift();
  L.chroma.set(Array.from(acc.chroma, x => x/cn));
  let best = 0; for (let k = 1; k < 12; k++) if (L.chroma[k] > L.chroma[best]) best = k; L.key = cn > 1 ? best : -1;   // (no notes heard: no key)
  resetAcc(); L.bars++;
  const H = hist.length, d = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i])**2; return Math.sqrt(s); };
  const mean = (i0, i1) => { const m = new Array(v.length).fill(0); for (let i = i0; i < i1; i++) for (let j = 0; j < v.length; j++) m[j] += hist[i][j]/(i1 - i0); return m; };
  if (H >= 6) {
    // something new: the last two bars against the eight before them, over how much bars usually differ from each other
    const a = mean(H - 2, H), b = mean(Math.max(0, H - 10), H - 2);
    let spread = 0; for (let i = Math.max(1, H - 10); i < H - 2; i++) spread += d(hist[i], hist[i - 1]); spread /= Math.max(1, Math.min(8, H - 3));
    L.nov = Math.min(1, Math.max(0, d(a, b)/(spread*T.novOver + T.novFloor) - 1));
    // the notes: how far this bar's moved from the four before
    const ch = i => hist[i].slice(NB, NB + 12);
    let cs = 0; const c0 = ch(H - 1), c1 = mean(H - 5, H - 1).slice(NB, NB + 12);
    for (let k = 0; k < 12; k++) cs += c0[k]*c1[k]; const nn = Math.hypot(...c0)*Math.hypot(...c1) || 1;
    L.harm = Math.max(0, 1 - cs/nn);
  }
  // the loop: bars in a row that sound like the bar four or eight before
  if (H >= 9) { const same = Math.min(d(hist[H - 1], hist[H - 5]), d(hist[H - 1], hist[H - 9])) < T.loopSame; L.loop = same ? L.loop + 1 : 0; }
}
