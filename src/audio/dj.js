// DJ mode: two decks and a mixer, mixed into the visualiser's analyser (so it follows the mix), its beat grid following the lead deck.
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { F, readAhead } from './foresee.js';
import { actx, analyser, ensureAudio, playing as playerPlaying, togglePlay } from './player.js';

// a deck: its track (buf), what was read ahead of it (ana: beats, bars, phrases, drops), its waveform (peaks), and where it
// is: off (the track's time) at t0 (the audio clock's), playing at rate (its tempo, base, with a nudge, bend, and a synced
// deck's pull back into phase, lock); cue, sync, a loop ({a, b, n}: its start and end in the track, n beats long), and the
// mixer's settings for it
const deck = i => ({i, name: '', buf: null, ana: null, peaks: null, src: null, playing: false, off: 0, t0: 0, rate: 1, base: 1, bend: 0, lock: 0,
  cue: 0, sync: false, loop: null, eq: {low: 0, mid: 0, high: 0}, filt: 0, fader: 1, n: null, token: 0, reading: false});
export const DJ = {decks: [deck(0), deck(1)], xf: .5, lead: null, open: false};
const D = DJ.decks, listeners = new Set();
export const onDJ = fn => listeners.add(fn);
const changed = () => listeners.forEach(fn => fn());
let master = null;

// the mixer: each deck through its three EQ bands, its filter, its channel fader and its side of the crossfader, into the
// master (a limiter, so two loud tracks together don't clip) and the analyser the visualiser listens to
function mixer(){
  if (master) return;
  ensureAudio();
  master = actx.createGain();
  const lim = actx.createDynamicsCompressor();
  lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .003; lim.release.value = .1;
  master.connect(lim); lim.connect(analyser);
  const T = TUNE.dj;
  for (const d of D) {
    const bq = (type, f, q) => { const b = actx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    const n = d.n = {low: bq('lowshelf', T.eqLow), mid: bq('peaking', T.eqMid, .7), high: bq('highshelf', T.eqHigh), filt: bq('lowpass', 22050, .7),
      ch: actx.createGain(), xf: actx.createGain()};
    n.low.connect(n.mid); n.mid.connect(n.high); n.high.connect(n.filt); n.filt.connect(n.ch); n.ch.connect(n.xf); n.xf.connect(master);
    applyEq(d); applyFilter(d); applyGain();
  }
}
const ease = (p, v) => p.setTargetAtTime(v, actx.currentTime, .012);   // (a short glide: no zipper noise as a knob turns)
function applyEq(d){ if (!d.n) return; for (const b of ['low', 'mid', 'high']) ease(d.n[b].gain, d.eq[b]); }
// the filter knob: centre off, left a low-pass closing down, right a high-pass opening up
function applyFilter(d){
  if (!d.n) return;
  const T = TUNE.dj, v = d.filt, f = d.n.filt;
  if (Math.abs(v) < .02) { f.type = 'lowpass'; ease(f.frequency, 22050); ease(f.Q, .7); return; }
  f.type = v < 0 ? 'lowpass' : 'highpass';
  ease(f.frequency, v < 0 ? 20000*Math.pow(T.filterLo/20000, -v) : 20*Math.pow(T.filterHi/20, v)); ease(f.Q, T.filterQ);
}
// the crossfader: each side full up to the middle, then easing out (a DJ mixer's usual curve)
export const xfGain = (i, x = DJ.xf) => i === 0 ? (x <= .5 ? 1 : Math.cos((x - .5)*Math.PI)) : (x >= .5 ? 1 : Math.cos((.5 - x)*Math.PI));
function applyGain(){ for (const d of D) if (d.n) { ease(d.n.ch.gain, d.fader*d.fader); ease(d.n.xf.gain, xfGain(d.i)); } }
const level = d => d.playing ? d.fader*d.fader*xfGain(d.i) : 0;

/* ---------- where a deck is ---------- */
// the track's time at audio-clock time `at` (before a scheduled start: where it will start)
export function pos(d, at = actx ? actx.currentTime : 0){
  if (!d.buf) return 0;
  if (!d.playing || at < d.t0) return d.off;
  const x = d.off + (at - d.t0)*d.rate, L = d.loop;
  if (L && x >= L.b) return L.a + (x - L.a) % (L.b - L.a);   // (round the loop, as the source plays it)
  return Math.min(d.buf.duration, x);
}
const heard = d => pos(d, actx.currentTime - (actx.outputLatency || actx.baseLatency || 0));   // at the speakers now
const mapOf = d => d.ana && d.ana.map;
export const bpm = d => mapOf(d) ? mapOf(d).bpm*d.rate : null;
// the beat a track's time falls on, fractional (beyond the map's ends, on at its tempo), and back
export function beatAt(d, x){
  const M = mapOf(d), B = M.beats, n = B.length;
  if (x <= B[0]) return (x - B[0])/M.period;
  if (x >= B[n - 1]) return n - 1 + (x - B[n - 1])/M.period;
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= x) lo = m; else hi = m; }
  return lo + (x - B[lo])/(B[lo + 1] - B[lo]);
}
export function timeOfBeat(d, k){
  const M = mapOf(d), B = M.beats, n = B.length;
  if (k <= 0) return B[0] + k*M.period;
  if (k >= n - 1) return B[n - 1] + (k - n + 1)*M.period;
  const i = Math.floor(k); return B[i] + (k - i)*(B[i + 1] - B[i]);
}
const mod = (a, n) => ((a % n) + n) % n;
export const barBeat = (d, x = pos(d)) => mod(beatAt(d, x) - mapOf(d).down, 4);   // 0..4: where in the bar

/* ---------- playing ---------- */
function stopSrc(d){ if (d.src) { d.src.onended = null; try { d.src.stop(); } catch (e) {} d.src.disconnect(); d.src = null; } }
function start(d, x, when = 0){
  mixer(); stopSrc(d);
  if (playerPlaying) togglePlay();   // (the main player stops: the decks take over)
  const s = actx.createBufferSource(), now = actx.currentTime;
  s.buffer = d.buf; s.playbackRate.value = d.rate; s.connect(d.n.low);
  if (d.loop && (x < d.loop.a - .01 || x >= d.loop.b)) d.loop = null;   // (moved out of the loop: it's left)
  if (d.loop) { s.loop = true; s.loopStart = d.loop.a; s.loopEnd = d.loop.b; }
  s.onended = () => { if (d.src !== s) return; d.src = null; d.playing = false; d.off = d.buf.duration; changed(); };
  x = Math.max(0, Math.min(x, d.buf.duration - .01));
  s.start(Math.max(now, when), x);
  d.src = s; d.off = x; d.t0 = Math.max(now, when); d.playing = true; changed();
}
function stop(d){ d.off = pos(d); stopSrc(d); d.playing = false; changed(); }
function setRate(d){
  const r = d.base*(1 + d.bend)*(1 + d.lock), now = actx ? actx.currentTime : 0;
  if (Math.abs(r - d.rate) < 1e-6) return;
  if (d.playing && now >= d.t0) { d.off = pos(d, now); d.t0 = now; }
  d.rate = r;
  if (d.src) d.src.playbackRate.setValueAtTime(r, Math.max(now, d.t0));
}

/* ---------- the controls ---------- */
// load a file (or an AudioBuffer, for tests) into a deck, and read it ahead for its beats; the deck stops first
export async function djLoad(i, src, name){
  mixer(); const d = D[i], token = ++d.token;
  if (d.playing) stop(d);
  d.name = name || (src && src.name ? src.name.replace(/\.[^.]+$/, '') : 'Track'); d.reading = true; changed();
  let buf = src;
  if (!(src instanceof AudioBuffer)) { try { buf = await actx.decodeAudioData(await src.arrayBuffer()); } catch (e) { if (token === d.token) { d.reading = false; d.name = ''; changed(); } throw e; } }
  if (token !== d.token) return;
  Object.assign(d, {buf, ana: null, peaks: null, off: 0, cue: 0, sync: false, bend: 0, lock: 0, loop: null}); d.base = 1; setRate(d); changed();
  peaksOf(buf).then(p => { if (token === d.token) { d.peaks = p; changed(); } });
  const ana = await readAhead(buf, () => token === d.token);
  if (token !== d.token) return;
  d.ana = ana; d.reading = false;
  const M = mapOf(d); if (M) d.cue = d.off = Math.max(0, M.beats[M.down]);   // cued on the first 1
  if (DJ.lead === d) DJ.lead = null;   // (the grid picks up its map)
  changed();
}
// play or pause; a synced deck, started while the other plays, starts on the other's next 1 from its own nearest 1
export function djPlay(i){
  const d = D[i], o = D[1 - i]; if (!d.buf) return;
  if (d.playing) return stop(d);
  mixer();
  if (d.sync && o.playing && mapOf(d) && mapOf(o)) {
    const now = actx.currentTime, xo = pos(o, now), Mo = mapOf(o);
    let k = Math.ceil(beatAt(o, xo) + .05); while (mod(k - Mo.down, 4)) k++;
    const when = now + (timeOfBeat(o, k) - xo)/o.rate, M = mapOf(d);
    const kd = M.down + 4*Math.round((beatAt(d, d.off) - M.down)/4);
    return start(d, Math.max(0, timeOfBeat(d, kd)), when);
  }
  start(d, d.off);
}
// cue: back to the cue point, stopped (a club player's cue also set it when pressed while stopped, which with a mouse moved
// it by surprise: the user found it erratic); set: the cue point here, on the nearest beat
export function djCue(i){
  const d = D[i]; if (!d.buf) return;
  if (d.playing) stop(d);
  d.loop = null; d.off = d.cue; changed();
}
export function djSetCue(i){
  const d = D[i]; if (!d.buf) return;
  const x = pos(d); d.cue = mapOf(d) ? Math.max(0, timeOfBeat(d, Math.round(beatAt(d, x)))) : x; changed();
}
// a loop of n beats from the beat it's on (the same n again: out of it, playing on); another n changes its length. The
// source loops it itself (seamless), and pos() follows it round
export function djLoop(i, n){
  const d = D[i]; if (!d.buf || !mapOf(d)) return;
  const now = actx ? actx.currentTime : 0;
  if (d.playing && now >= d.t0) { d.off = pos(d, now); d.t0 = now; }   // (counted from here, whatever the loop was)
  if (d.loop && d.loop.n === n) { d.loop = null; if (d.src) d.src.loop = false; changed(); return; }
  const a = d.loop ? d.loop.a : Math.max(0, timeOfBeat(d, Math.floor(beatAt(d, d.off) + 1e-3)));
  d.loop = {a, b: Math.min(d.buf.duration, timeOfBeat(d, beatAt(d, a) + n)), n};
  const past = d.off >= d.loop.b;   // (a shorter loop than where it is: round it, and the source started again there, as it would jump to the start)
  if (past) d.off = d.loop.a + (d.off - d.loop.a) % (d.loop.b - d.loop.a);
  if (d.src) { if (past && d.playing && now >= d.t0) return start(d, d.off); d.src.loopStart = d.loop.a; d.src.loopEnd = d.loop.b; d.src.loop = true; }
  changed();
}
export function djSeek(i, x){ const d = D[i]; if (!d.buf) return; if (d.loop && (x < d.loop.a || x >= d.loop.b)) d.loop = null; if (d.playing) start(d, x); else { d.off = Math.max(0, Math.min(x, d.buf.duration)); changed(); } }
export function djTempo(i, v){ const d = D[i]; d.sync = false; d.lock = 0; d.base = 1 + Math.max(-1, Math.min(1, v))*TUNE.dj.tempoRange; setRate(d); changed(); }
export function djBend(i, dir){ const d = D[i]; d.bend = dir*TUNE.dj.bend; setRate(d); }
// sync: this deck's tempo to the other's, and (both playing) its bars lined up with the other's; it then follows the
// other's tempo and is kept in phase (djFrame). Again: off
export function djSync(i){
  const d = D[i], o = D[1 - i];
  if (d.sync) { d.sync = false; d.lock = 0; setRate(d); changed(); return false; }
  if (!mapOf(d) || !mapOf(o)) return null;   // (no steady beat read in one of them)
  d.sync = true; o.sync = false; o.lock = 0; setRate(o);
  d.lock = 0; d.base = mapOf(o).bpm*o.rate/mapOf(d).bpm; setRate(d);
  if (d.playing && o.playing && actx.currentTime >= d.t0) {
    let e = barBeat(o) - barBeat(d); e = mod(e + 2, 4) - 2;
    start(d, timeOfBeat(d, beatAt(d, pos(d)) + e));
  }
  changed(); return true;
}
export function djEq(i, band, db){ const d = D[i]; d.eq[band] = db; applyEq(d); }
export function djFilter(i, v){ const d = D[i]; d.filt = v; applyFilter(d); }
export function djFader(i, v){ D[i].fader = v; applyGain(); }
export function djXf(v){ DJ.xf = v; applyGain(); }

/* ---------- each frame (main.js) ---------- */
// the lead deck (the one the faders favour) gives the beat grid its map and its time (F: audio/foresee.js), and a synced
// deck follows the other's tempo, nudged back into phase when it drifts
export function djFrame(){
  if (!D[0].buf && !D[1].buf) return;
  const T = TUNE.dj;
  for (const d of D) {
    const o = D[1 - d.i];
    if (!d.sync || !mapOf(d) || !mapOf(o)) continue;
    d.base = mapOf(o).bpm*o.rate/mapOf(d).bpm;
    if (d.playing && o.playing && !d.bend && actx.currentTime >= d.t0) {
      let e = beatAt(o, pos(o)) - beatAt(d, pos(d)); e = mod(e + .5, 1) - .5;   // beats out of phase
      d.lock = Math.max(-T.lockMax, Math.min(T.lockMax, e*T.lock*4));
    } else d.lock = 0;
    setRate(d);
  }
  const lv = D.map(level), L = lv[0] > .001 || lv[1] > .001 ? D[lv[1] > lv[0] + (DJ.lead === D[0] ? .05 : -.05) ? 1 : 0] : null;
  if (L !== DJ.lead || (L && F.map !== (mapOf(L) || null))) {
    DJ.lead = L;
    if (L) { F.id++; Object.assign(F, {ready: !!L.ana, drops: L.ana ? L.ana.drops : [], brks: L.ana ? L.ana.brks : [], map: mapOf(L) || null, dur: L.buf.duration}); }
    changed();
  }
  F.rate = L ? L.rate : 1;
}
// while a deck leads, the grid keeps time from it: its track's time as heard, as the frame will reach the screen, by the
// Sync slider (as the player does); otherwise the player's
const playerAt = F.at;
F.at = () => DJ.lead ? heard(DJ.lead) + (TUNE.sync.displayMs - S.syncMs)/1000*DJ.lead.rate : playerAt ? playerAt() : null;

// a waveform: the loudest sample in each 1/150 s, worked out in pieces so loading doesn't stall a frame
export const PEAK_HZ = 150;
async function peaksOf(buf){
  const ch = Array.from({length: Math.min(2, buf.numberOfChannels)}, (_, c) => buf.getChannelData(c)), hop = Math.max(1, Math.round(buf.sampleRate/PEAK_HZ));
  const n = Math.ceil(ch[0].length/hop), out = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let m = 0; const e = Math.min(ch[0].length, (b + 1)*hop);
    for (const c of ch) for (let j = b*hop; j < e; j += 2) { const v = Math.abs(c[j]); if (v > m) m = v; }
    out[b] = m;
    if (b % 20000 === 19999) await new Promise(r => setTimeout(r, 0));
  }
  return out;
}
