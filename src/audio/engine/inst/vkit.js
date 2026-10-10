// Pieces the Studio's instruments share: pitches, envelopes, shared modulation buses, LFOs in any shape and time, and saturation curves.
import { DIVS, beatsOf } from '../fx/kit.js';

export const hz = n => 440*Math.pow(2, (n - 69)/12);
export const SHAPES = ['Sine', 'Triangle', 'Square', 'Saw up', 'Saw down', 'Random'];
export const RATES = ['Free', ...DIVS.map(d => d[0])];
// an LFO's rate in Hz: free, or a division of the beat (index into RATES, or its name)
export const lfoHz = (sync, free, period) => { const s = typeof sync === 'string' ? RATES.indexOf(sync) : Math.round(sync); return s > 0 ? 1/(period*beatsOf(s - 1)) : free; };
// a parameter held where it is at t (a release or a new note starting from wherever the last left it)
export const hold = (p, t) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); };
// attack, decay and sustain on a parameter: from base up to base + peak, then down to base + peak·s
export function adsr(p, t, a, d, s, peak = 1, base = 0){
  p.setValueAtTime(base, t); p.linearRampToValueAtTime(base + peak, t + a); p.setTargetAtTime(base + peak*s, t + a, Math.max(.001, d/3));
}
// a shared bus: a constant (the knob's value) that every voice reads and that modulation and automation move smoothly
export function bus(ctx, v, t0 = 0){ const c = ctx.createConstantSource(); c.offset.value = v; c.start(t0); return c; }
// a gain node fixed at g
export function gain(ctx, g = 1){ const n = ctx.createGain(); n.gain.value = g; return n; }

// an LFO from t0 (the song's first bar, so one in time keeps its phase to the bar): -1..1 out of `out`. Random steps
// to a new value each cycle (a looping buffer of steps, played at the rate)
export function makeLfo(ctx, shape, hzv, t0){
  const out = gain(ctx, 1), sh = typeof shape === 'string' ? Math.max(0, SHAPES.indexOf(shape)) : Math.round(shape);
  let src;
  if (sh === 5) {
    const N = 64, per = 128, b = ctx.createBuffer(1, N*per, ctx.sampleRate), d = b.getChannelData(0); let s = 4242;
    for (let k = 0; k < N; k++) { s = (s*1664525 + 1013904223) >>> 0; d.fill(s/2147483648 - 1, k*per, (k + 1)*per); }
    src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = hzv*per/ctx.sampleRate;
    src.connect(out);
  } else {
    src = ctx.createOscillator(); src.type = ['sine', 'triangle', 'square', 'sawtooth', 'sawtooth'][sh]; src.frequency.value = hzv;
    if (sh === 4) { const inv = gain(ctx, -1); src.connect(inv); inv.connect(out); } else src.connect(out);
  }
  src.start(Math.max(t0, 0));
  return {out, src, rate(h, t){ if (sh === 5) src.playbackRate.setValueAtTime(h*128/ctx.sampleRate, t); else src.frequency.setValueAtTime(h, t); }, stop(t){ try { src.stop(t); } catch (e) {} }};
}
// saturation: tanh, harder with the amount, normalised so a full-scale peak stays full scale
export function satCurve(a){ const n = 2048, c = new Float32Array(n), K = 1 + a*10, m = Math.tanh(K); for (let i = 0; i < n; i++) { const x = i/(n - 1)*2 - 1; c[i] = Math.tanh(x*K)/m; } return c; }
// white noise, a second of it, seeded (so renders repeat)
export function noiseBuf(ctx, seed = 9876){ const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); let s = seed;
  for (let i = 0; i < d.length; i++) { s = (s*1664525 + 1013904223) >>> 0; d[i] = s/2147483648 - 1; } return b; }
// a seeded random number source
export const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0)/4294967296; }; };
// a preset's settings over the defaults, with names (a wave, a shape) turned into their place in the list
export function resolve(params, p){ const o = {}; for (const q of params) { let v = p[q.key] != null ? p[q.key] : q.def; if (q.list && typeof v === 'string') v = Math.max(0, q.list.indexOf(v)); o[q.key] = v; } return o; }
