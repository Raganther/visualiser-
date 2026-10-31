// Singing a part in: a recording of a voice (sung, hummed or beatboxed) read into notes and hits on the jam's grid. The
// pitch is tracked frame by frame (YIN, on a copy brought down to about 11 kHz), the voiced frames gathered into notes
// (a new one where the pitch moves a step or the voice starts again), the hits found as sudden rises in loudness and told
// apart by where their energy lies (low a kick, high a hat, between a snare or a hand drum). Then everything is placed on
// the 16ths, the whole take nudged so it sits on the grid (the singer's and the speakers' delays). A leaf module: the page
// turns what it hears into a part's rhythm and notes (app.js), the tests feed it made-up voices.
import { noteName } from '../lib/names.js';

// the voice brought down to about 11 kHz (averaged, so what's above that doesn't fold back), as mono
function down(x, sr){ const d = Math.max(1, Math.floor(sr/11025)), n = Math.floor(x.length/d), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < d; j++) s += x[i*d + j]; y[i] = s/d; } return {y, sr: sr/d}; }

// the pitch every hop: {t, f (Hz, 0 when there's none), clar (YIN's dip: lower is clearer), rms}
export function track(x, sr, {hop = .01, win = .04, fmin = 55, fmax = 1000, thr = .15} = {}){
  const {y, sr: s2} = down(x, sr), W = Math.round(win*s2), H = Math.round(hop*s2), tMax = Math.min(W - 1, Math.ceil(s2/fmin)), tMin = Math.max(2, Math.floor(s2/fmax)), d = new Float32Array(tMax + 1), out = [];
  for (let at = 0; at + W + tMax < y.length; at += H) {
    let e = 0; for (let i = 0; i < W; i++) e += y[at + i]*y[at + i]; const rms = Math.sqrt(e/W);
    // the difference function, then each lag over the mean of those before it (YIN's normalisation)
    let run = 0; d[0] = 1;
    for (let tau = 1; tau <= tMax; tau++) { let s = 0; for (let i = 0; i < W; i++) { const v = y[at + i] - y[at + i + tau]; s += v*v; } run += s; d[tau] = run ? s*tau/run : 1; }
    let tau = -1; for (let k = tMin; k <= tMax; k++) if (d[k] < thr) { while (k + 1 <= tMax && d[k + 1] < d[k]) k++; tau = k; break; }
    if (tau < 0) { out.push({t: (at + W/2)/s2, f: 0, clar: 1, rms}); continue; }
    // between the lags, where the dip really is
    const a = d[tau - 1], b = d[tau], c = d[tau + 1] ?? b, den = a - 2*b + c, sh = den ? .5*(a - c)/den : 0;
    out.push({t: (at + W/2)/s2, f: s2/(tau + Math.max(-1, Math.min(1, sh))), clar: b, rms}); }
  return out; }

const midiOf = f => 69 + 12*Math.log2(f/440), med = a => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
// the voiced frames gathered into notes: {t, dur, midi (rounded), cents (how far off), rms}
export function notesOf(fr, {minDur = .07, quiet = .12, jump = .75, hold = 4} = {}){
  const peak = Math.max(1e-6, ...fr.map(f => f.rms)), notes = []; let cur = null, off = 0;
  const end = () => { if (cur && cur.p.length*cur.hop >= minDur) { const m = med(cur.p); notes.push({t: cur.t, dur: cur.p.length*cur.hop, midi: Math.round(m), cents: Math.round((m - Math.round(m))*100), rms: Math.max(...cur.r)}); } cur = null; };
  for (let i = 0; i < fr.length; i++) { const f = fr[i], hop = i ? fr[i].t - fr[i - 1].t : .01, voiced = f.f > 0 && f.rms > quiet*peak;
    if (!voiced) { if (cur && ++off > 2) end(); continue; } off = 0; const m = midiOf(f.f);
    // a new note: after a gap, where the pitch has moved a step and stayed there, or where the voice starts again (louder at once)
    const prevRms = i > 2 ? Math.min(fr[i - 1].rms, fr[i - 2].rms, fr[i - 3].rms) : 0, again = cur && f.rms > 2.2*prevRms && prevRms < .5*peak;
    if (cur) { const mm = med(cur.p.slice(-8)); if (Math.abs(m - mm) > jump) cur.away = (cur.away || 0) + 1; else cur.away = 0;
      if (cur.away >= hold || again) { const back = again ? 0 : hold - 1, keep = cur.p.slice(0, cur.p.length - back), kr = cur.r.slice(0, cur.r.length - back), moved = cur.p.slice(cur.p.length - back), mr = cur.r.slice(cur.r.length - back);
        cur.p = keep; cur.r = kr; const t = f.t - back*hop; end(); cur = {t, hop, p: [...moved], r: [...mr]}; } }
    if (!cur) cur = {t: f.t, hop, p: [], r: []};
    cur.p.push(m); cur.r.push(f.rms); }
  end(); return notes; }

// the hits: sudden rises in loudness, each with where its energy lies (lo, mid, hi) and how long it rings
export function hitsOf(x, sr, {hop = .005, rise = 1.8, floor = .12, gap = .08} = {}){
  const H = Math.max(1, Math.round(hop*sr)), n = Math.floor(x.length/H), env = new Float32Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let i = k*H; i < (k + 1)*H; i++) s += x[i]*x[i]; env[k] = Math.sqrt(s/H); }
  // the low and the high of it (one-pole filters), for each hit's colour
  const lo = new Float32Array(x.length), hi = new Float32Array(x.length), al = Math.exp(-2*Math.PI*220/sr), ah = Math.exp(-2*Math.PI*3000/sr); let sl = 0, sh = 0;
  for (let i = 0; i < x.length; i++) { sl = (1 - al)*x[i] + al*sl; lo[i] = sl; sh = (1 - ah)*x[i] + ah*sh; hi[i] = x[i] - sh; }
  const peak = Math.max(1e-6, ...env), out = []; let last = -1e9;
  for (let k = 2; k < n; k++) { const base = Math.min(...env.slice(Math.max(0, k - 10), k)), t = k*H/sr;
    if (env[k] < floor*peak || env[k] < rise*base || t - last < gap) continue;
    let top = k; while (top + 1 < n && env[top + 1] > env[top]) top++; last = t;
    const a = k*H, b = Math.min(x.length, a + Math.round(.04*sr)); let E = 0, L = 0, Hh = 0; for (let i = a; i < b; i++) { E += x[i]*x[i]; L += lo[i]*lo[i]; Hh += hi[i]*hi[i]; }
    let j = top; while (j < n && env[j] > .25*env[top]) j++;
    out.push({t, rms: env[top], dur: (j - k)*H/sr, lo: L/(E || 1), hi: Hh/(E || 1), kind: L/(E || 1) > .45 ? 'lo' : Hh/(E || 1) > .3 ? 'hi' : 'mid'}); }
  return out; }

// onto the 16ths: the take nudged so it sits on the grid (by its hits' or notes' average place within a 16th, at most half
// a 16th either way), then each to its 16th from t0, its length in 16ths. Returns the events with step and len, and the nudge
export function grid(ev, {six, t0, steps}){
  let sx = 0, sy = 0; for (const e of ev) { const r = (e.t - t0)/six, w = e.rms || 1; sx += w*Math.cos(2*Math.PI*r); sy += w*Math.sin(2*Math.PI*r); }
  const nudge = ev.length ? Math.atan2(sy, sx)/(2*Math.PI)*six : 0, out = [], seen = new Map();
  for (const e of ev) { const step = Math.round((e.t - t0 - nudge)/six); if (step < 0 || step >= steps) continue;
    const len = Math.max(1, Math.min(steps - step, Math.round((e.dur || six)/six))), x = {...e, step, len}, was = seen.get(step);
    if (was) { if ((e.rms || 0) > (was.rms || 0)) out[out.indexOf(was)] = x, seen.set(step, x); continue; }
    seen.set(step, x); out.push(x); }
  return {ev: out.sort((a, b) => a.step - b.step), nudge}; }

// how many bars a take fills, rounded up to 1, 2, 4, 8 or 16
export const barsFor = (secs, bar) => [1, 2, 4, 8, 16].find(b => b*bar >= secs - .05) || 16;
export { noteName };
