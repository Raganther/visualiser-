// The transport: one master sets the tempo and where the beats and bars are, for everything that follows it (the sequencer, a synced deck, the visuals' beat grid).
import { TUNE } from '../../tuning.js';

// A clock: {kind, label, beat(t): beats from its bar's 1 at audio-clock time t (fractional), period(t): seconds a beat there,
// bpm()}. The internal clock is the sequencer's own time and the taps' (one clock: the user found two confusing): beat 0,
// the bar's 1, at a, then a beat every P seconds; tapped once taps have set it, so in Auto it can lead
export const INT = {P: 60/128, a: 0, tapped: false, run: [], k0: 0, rev: 0};
export const internal = {kind: 'internal', tap: true, label: 'taps', beat: t => (t - INT.a)/INT.P, period: () => INT.P, bpm: () => 60/INT.P};
export const CLOCK = {mode: 'auto'};   // auto: the music heard leads; tap: the internal clock leads, whatever plays
const sources = [], holds = [], follows = [], subs = new Set();
// things that can be the master, in order (a playing deck: audio/dj.js), each () => a clock or null; and things that,
// while true, keep the taps from leading in Auto (the main player playing a track: its beat map leads the visuals)
export const addSource = fn => sources.push(fn);
export const addHold = fn => holds.push(fn);
export const onClock = fn => subs.add(fn);
// what the visuals follow when nothing is the master: the sequencer playing on its own clock (audio/groove.js), unless a
// hold says the main player's track leads them
export const addFollow = fn => follows.push(fn);
export function leader(){ const m = master(); if (m || holds.some(h => h())) return m; for (const f of follows) { const c = f(); if (c) return c; } return null; }
// what the sequencer knows is coming, on the audio clock as heard: its section changes ({t, nov}) and its drops ({t, brk}:
// the kick back after a breakdown that began at brk). Journey reads them as it reads a track's (audio/foresee.js)
export const PLAN = {changes: [], drops: [], rev: 0};
const changed = () => subs.forEach(fn => fn());

export function master(){
  if (CLOCK.mode === 'tap' && INT.tapped) return internal;
  for (const s of sources) { const c = s(); if (c) return c; }
  return INT.tapped && !holds.some(h => h()) ? internal : null;
}
export function setMode(m){ CLOCK.mode = m; changed(); }

// the internal clock's tempo, changed without a jump: the beat it's on now stays where it is
export function setTempo(bpm, now){
  const k = (now - INT.a)/INT.P; INT.P = 60/bpm; INT.a = now - k*INT.P; INT.rev++;
}
// start its bar at t (the sequencer starting on its own, when no taps have placed the beats)
export function startAt(t){ INT.a = t; INT.rev++; }
// a tap in time with the beat as heard: from tapMin of them the tempo is the middle of the last gaps (one sloppy tap
// doesn't throw it), and the beats fall where the taps do (the line through them at that spacing), the run's first tap the
// bar's 1; a pause of tapGap starts a new run. Returns the taps in this run
export function tap(t){
  const T = TUNE.dj, R = INT.run;
  if (R.length && t - R[R.length - 1] > T.tapGap) { R.length = 0; INT.k0 = 0; }
  R.push(t); if (R.length > 32) { R.shift(); INT.k0++; }
  if (R.length >= T.tapMin) {
    const g = R.slice(1).map((x, k) => x - R[k]).slice(-8).sort((a, b) => a - b), P = g[g.length >> 1];
    if (P >= 60/T.tapMax && P <= 60/T.tapMin_bpm) { INT.P = P; INT.a = R.reduce((s, x, k) => s + x - (INT.k0 + k)*P, 0)/R.length; INT.tapped = true; INT.rev++; }
  }
  changed(); return R.length;
}
// the next 16th after audio-clock time `now` on a clock: when, which step of the bar (0..15), its count from the clock's
// bar 1 (s), and how long a 16th lasts there
export function next16(c, now){
  const k = c.beat(now), P = c.period(now), s = Math.floor(k*4 + 1e-6) + 1;
  return {t: now + (s/4 - k)*P, i: ((s % 16) + 16) % 16, s, dur: P/4};
}
// the clock as a beat map, for the beat grid (audio/beatgrid.js reads F.map against F.at: here the audio clock as heard)
export function clockMap(){
  const n = 20000, B = Array.from({length: n}, (_, j) => INT.a + (j - 8)*INT.P);
  return {bpm: 60/INT.P, period: INT.P, beats: B, kick: new Float32Array(n).fill(1), down: 8, dsure: 1, phrase: 0, changes: [], conf: 1, src: 'internal', a: INT.a, P: INT.P};
}
