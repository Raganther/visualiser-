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
export const DJ = {decks: [deck(0), deck(1)], xf: .5, lead: null, open: false, mode: 'auto', master: null};   // lead: the deck the faders favour; master: what sets the beat (below)
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
// where another source joins the mix (the groovebox: audio/groove.js): the master, before the limiter
export const djBus = () => { mixer(); return master; };
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
// the audio clock as heard at the speakers now, smooth: from its own timestamp of what the output is playing (counting the
// output's delay) and the time since; the bare clock moves in steps (coarse on Windows: the user saw the waveforms jerk
// and lag the music). Never backwards, and the bare clock less the delay where the timestamp is missing or far off
let lastHeard = 0;
export function heardNow(){
  if (!actx) return 0;
  const est = actx.currentTime - (actx.outputLatency || actx.baseLatency || 0), ts = actx.getOutputTimestamp && actx.getOutputTimestamp();
  let h = est;
  if (ts && ts.contextTime > 0 && ts.performanceTime > 0) { const x = ts.contextTime + (performance.now() - ts.performanceTime)/1000; if (Math.abs(x - est) < .3) h = x; }
  if (h < lastHeard && lastHeard - h < .1) h = lastHeard;
  return lastHeard = h;
}
export const heard = d => pos(d, heardNow());   // a deck's track as heard now
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
  const tg = target(d);
  if (d.sync && mapOf(d) && (tg === 'tap' || (tg && tg.playing))) {   // started on the next 1 of what it follows, from its own nearest 1
    const now = actx.currentTime, M = mapOf(d), kd = M.down + 4*Math.round((beatAt(d, d.off) - M.down)/4);
    let when;
    if (tg === 'tap') { let k = Math.ceil(tapBeat(now) + .05); while (mod(k, 4)) k++; when = TAP.a + k*TAP.P; }
    else { const xo = pos(tg, now), Mo = mapOf(tg); let k = Math.ceil(beatAt(tg, xo) + .05); while (mod(k - Mo.down, 4)) k++; when = now + (timeOfBeat(tg, k) - xo)/tg.rate; }
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
// scrubbing (a waveform dragged): the deck goes quiet and follows the drag, and plays on from there when it's let go (a
// restart at every move of the mouse stuttered)
export function djScrub(i, phase, x){
  const d = D[i]; if (!d.buf) return;
  if (phase === 'start') { d.scrub = d.playing; if (d.playing) stop(d); return; }
  if (x != null) { d.off = Math.max(0, Math.min(x, d.buf.duration - .01)); if (d.loop && (d.off < d.loop.a || d.off >= d.loop.b)) d.loop = null; }
  if (phase === 'end') { if (d.scrub) start(d, d.off); d.scrub = false; changed(); }
}
export function djTempo(i, v){ const d = D[i]; d.sync = false; d.lock = 0; d.base = 1 + Math.max(-1, Math.min(1, v))*TUNE.dj.tempoRange; setRate(d); changed(); }
export function djBend(i, dir){ const d = D[i]; d.bend = dir*TUNE.dj.bend; setRate(d); }
// sync: this deck's tempo to the other's, and (both playing) its bars lined up with the other's; it then follows the
// other's tempo and is kept in phase (djFrame). Again: off
export function djSync(i){
  const d = D[i], tg = target(d);
  if (d.sync) { d.sync = false; d.lock = 0; setRate(d); changed(); return false; }
  if (!mapOf(d) || !tg) return null;   // (no steady beat read in it, or nothing to follow)
  d.sync = true; d.lock = 0;
  if (tg !== 'tap') { tg.sync = false; tg.lock = 0; setRate(tg); }   // (two decks don't follow each other)
  d.base = (tg === 'tap' ? 60/TAP.P : mapOf(tg).bpm*tg.rate)/mapOf(d).bpm; setRate(d);
  const now = actx.currentTime;
  if (d.playing && now >= d.t0 && (tg === 'tap' || tg.playing)) {
    let e = (tg === 'tap' ? mod(tapBeat(now), 4) : barBeat(tg)) - barBeat(d); e = mod(e + 2, 4) - 2;
    start(d, timeOfBeat(d, beatAt(d, pos(d)) + e));
  }
  changed(); return true;
}
// what a synced deck follows: the tap clock while it's the master by choice (Master: Tap), otherwise the other deck
const target = d => DJ.mode === 'tap' && TAP.P ? 'tap' : mapOf(D[1 - d.i]) ? D[1 - d.i] : null;

/* ---------- tap tempo, and the master clock ---------- */
// the tap clock: taps in time with the beat (as heard), at least tapMin of them, a pause of tapGap starting a new run; the
// tempo is the middle of the last gaps (one sloppy tap doesn't throw it), and the beats fall where the taps do (the line
// through them at that spacing), the run's first tap the bar's 1
export const TAP = {run: [], k0: 0, P: 0, a: 0, rev: 0};
export function djTap(t = heardNow()){
  mixer(); const T = TUNE.dj, R = TAP.run;
  if (R.length && t - R[R.length - 1] > T.tapGap) { R.length = 0; TAP.k0 = 0; }
  R.push(t); if (R.length > 32) { R.shift(); TAP.k0++; }
  if (R.length < T.tapMin) { changed(); return R.length; }
  const g = R.slice(1).map((x, k) => x - R[k]).slice(-8).sort((a, b) => a - b), P = g[g.length >> 1];
  if (P < 60/T.tapMax || P > 60/T.tapMin_bpm) { changed(); return R.length; }
  TAP.P = P; TAP.a = R.reduce((s, x, k) => s + x - (TAP.k0 + k)*P, 0)/R.length; TAP.rev++;
  changed(); return R.length;
}
export const tapBeat = t => (t - TAP.a)/TAP.P;   // the tap clock's beat at audio-clock time t (0: the bar's 1)
export function djMasterMode(m){
  DJ.mode = m;
  for (const d of D) if (d.sync) { d.sync = false; d.lock = 0; setRate(d); }   // (what a synced deck follows changes: synced again by hand)
  changed();
}
// the master: what sets the tempo and the beat for everything else (the groovebox, a synced deck, the visuals' beat grid).
// Auto: the music that's heard wins, the lead deck while it plays (with its beats read), else the taps (unless the main
// player is playing); Tap: the taps, whatever plays
export function djMaster(){
  const L = DJ.lead && DJ.lead.playing && mapOf(DJ.lead) ? DJ.lead : null, tap = TAP.P > 0;
  if (DJ.mode === 'tap' && tap) return {tap: true};
  if (L) return {d: L};
  return tap && !playerPlaying ? {tap: true} : null;
}
export const masterBeat = (m, t) => m.tap ? tapBeat(t) : beatAt(m.d, pos(m.d, t)) - mapOf(m.d).down;   // from its bar's 1
export function masterPeriod(m, t){ if (m.tap) return TAP.P; const d = m.d, b = Math.floor(beatAt(d, pos(d, t))); return (timeOfBeat(d, b + 1) - timeOfBeat(d, b))/d.rate; }
export const masterBpm = m => m.tap ? 60/TAP.P : bpm(m.d);
// the taps as a beat map, for the beat grid (audio/beatgrid.js reads F.map against F.at: here the audio clock as heard)
function tapMap(){
  const n = 4000, B = Array.from({length: n}, (_, j) => TAP.a + (j - 8)*TAP.P);
  return {bpm: 60/TAP.P, period: TAP.P, beats: B, kick: new Float32Array(n).fill(1), down: 8, dsure: 1, phrase: 0, changes: [], conf: 1};
}
export function djEq(i, band, db){ const d = D[i]; d.eq[band] = db; applyEq(d); }
export function djFilter(i, v){ const d = D[i]; d.filt = v; applyFilter(d); }
export function djFader(i, v){ D[i].fader = v; applyGain(); }
export function djXf(v){ DJ.xf = v; applyGain(); }

/* ---------- each frame (main.js) ---------- */
// the lead deck (the one the faders favour) gives the beat grid its map and its time (F: audio/foresee.js), and a synced
// deck follows the other's tempo, nudged back into phase when it drifts
export function djFrame(){
  if (!D[0].buf && !D[1].buf && !TAP.P) return;
  const T = TUNE.dj, now = actx ? actx.currentTime : 0;
  for (const d of D) {
    const tg = target(d);
    if (!d.sync || !mapOf(d) || !tg) continue;
    d.base = (tg === 'tap' ? 60/TAP.P : mapOf(tg).bpm*tg.rate)/mapOf(d).bpm;
    if (d.playing && (tg === 'tap' || tg.playing) && !d.bend && now >= d.t0) {
      let e = (tg === 'tap' ? tapBeat(now) : beatAt(tg, pos(tg))) - beatAt(d, pos(d)); e = mod(e + .5, 1) - .5;   // beats out of phase
      d.lock = Math.max(-T.lockMax, Math.min(T.lockMax, e*T.lock*4));
    } else d.lock = 0;
    setRate(d);
  }
  const lv = D.map(level), L = lv[0] > .001 || lv[1] > .001 ? D[lv[1] > lv[0] + (DJ.lead === D[0] ? .05 : -.05) ? 1 : 0] : null;
  if (L !== DJ.lead) { DJ.lead = L; changed(); }
  // the master gives the beat grid its beats, breakdowns and drops (F: audio/foresee.js), and its tempo
  const m = djMaster(), key = m ? (m.tap ? 'tap' + TAP.rev : m.d) : null;
  if (key !== DJ.mkey || (m && m.d && F.map !== mapOf(m.d))) {
    DJ.mkey = key; DJ.master = m;
    if (m && m.tap) { F.id++; Object.assign(F, {ready: true, drops: [], brks: [], map: tapMap(), dur: 1e9}); }
    else if (m) { const a = m.d.ana; F.id++; Object.assign(F, {ready: true, drops: a.drops, brks: a.brks, map: mapOf(m.d), dur: m.d.buf.duration}); }
    changed();
  }
  DJ.master = m; F.rate = m && m.d ? m.d.rate : 1;
}
// while there's a master, the grid keeps time from it: a deck's track as heard (or the tap clock's audio clock as heard),
// as the frame will reach the screen, by the Sync slider (as the player does); otherwise the player's
const playerAt = F.at;
F.at = () => { const m = DJ.master, ahead = (TUNE.sync.displayMs - S.syncMs)/1000;
  return m ? (m.tap ? heardNow() + ahead : heard(m.d) + ahead*m.d.rate) : playerAt ? playerAt() : null; };

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
