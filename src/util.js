// Small helpers shared everywhere: DOM lookup, maths, colour and noise.

export const $ = s => document.querySelector(s);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clone = o => JSON.parse(JSON.stringify(o));
export function hsv2rgb(h, s, v){
  h = ((h % 1) + 1) % 1; const f = (n) => { const k = (n + h*6) % 6; return v - v*s*Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
// Journey's own slow noise: each seed gets its own gentle rhythm
export function jn(t, seed){
  const f1 = .9 + ((seed*.618) % 1)*.6, f2 = 2.1 + ((seed*.377) % 1)*.9;
  return Math.sin(t*f1 + seed*1.7)*.65 + Math.sin(t*f2 + seed*4.1)*.35;
}
export function noise(t, seed){ return Math.sin(t*(.11 + seed*.037) + seed*1.7)*.6 + Math.sin(t*(.27 + seed*.051) + seed*4.1)*.4; }
/* ---------- UI ---------- */
export const fmt = s => { s = Math.max(0, s|0); return `${(s/60)|0}:${String(s%60).padStart(2,'0')}`; };
