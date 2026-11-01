// Small pieces of signal processing the native instruments and the processors share (a leaf module: plain maths).

export const TAU = 2*Math.PI;
// tanh, near enough and cheap
export const th = x => x < -3 ? -1 : x > 3 ? 1 : x*(27 + x*x)/(27 + 9*x*x);
// a tone setting (0..1) as a cutoff: 1 kHz to 22 kHz on a curve
export const toneHz = t => 1000*Math.pow(22, t);
// a soft clip (the cubic curve: rounding over to 2/3 at full drive) without its aliasing: first-order antiderivative
// anti-aliasing, the step between samples averaged over the curve, so a hard drive stays smooth
export const clip = u => u > 1 ? 2/3 : u < -1 ? -2/3 : u - u*u*u/3, clipF = u => { const a = Math.abs(u); return a > 1 ? 2/3*a - .25 : u*u/2 - u*u*u*u/12; };
export function adaa(){ let x1 = 0, F1 = 0; return x => { const F = clipF(x), d = x - x1, y = Math.abs(d) < 1e-4 ? clip((x + x1)/2) : (F - F1)/d; x1 = x; F1 = F; return y; }; }
// the same for tanh (tape's gentler curve): its antiderivative is log cosh
const lcosh = x => { const a = Math.abs(x); return a > 15 ? a - Math.LN2 : Math.log(Math.cosh(x)); };
export function adaaT(){ let x1 = 0, F1 = 0; return x => { const F = lcosh(x), d = x - x1, y = Math.abs(d) < 1e-4 ? Math.tanh((x + x1)/2) : (F - F1)/d; x1 = x; F1 = F; return y; }; }
// a state-variable filter (the trapezoidal form), its low, band and high outputs
export function svf(f, q, sr){ const g = Math.tan(Math.PI*Math.min(f, sr*.45)/sr), k = 1/q, a1 = 1/(1 + g*(g + k)), a2 = g*a1, a3 = g*a2; let s1 = 0, s2 = 0;
  const o = {lp: 0, bp: 0, hp: 0}; return x => { const v3 = x - s2, v1 = a1*s1 + a2*v3, v2 = s2 + a2*s1 + a3*v3; s1 = 2*v1 - s1; s2 = 2*v2 - s2; o.lp = v2; o.bp = v1; o.hp = x - k*v1 - v2; return o; }; }
export const dB = x => 20*Math.log10(Math.max(1e-9, x)), fromDb = d => Math.pow(10, d/20);
