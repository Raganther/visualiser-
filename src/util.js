// Small helpers shared everywhere: DOM lookup, maths, colour and noise.

export const $ = s => document.querySelector(s);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clone = o => JSON.parse(JSON.stringify(o));
export function hsv2rgb(h, s, v){
  h = ((h % 1) + 1) % 1; const f = (n) => { const k = (n + h*6) % 6; return v - v*s*Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
export const hc = (h, s, l, a) => `hsla(${((((h)%1)+1)%1*360).toFixed(1)},${s}%,${l}%,${a})`;
// a copy of a canvas's rows down to y, for simple mode's reflections: they read the picture above the water strip by strip
// while drawing below it, and a canvas drawn onto itself is copied whole on every call (the rows read are never drawn over)
let rowsCan = null;
export function rowsAbove(src, y){
  const W = src.width, h = Math.min(src.height, Math.max(1, Math.ceil(y) + 2));
  if (!rowsCan) rowsCan = document.createElement('canvas');
  if (rowsCan.width !== W || rowsCan.height !== src.height) { rowsCan.width = W; rowsCan.height = src.height; }
  const x = rowsCan.getContext('2d'); x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0, W, h, 0, 0, W, h);
  return rowsCan;
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
// a painted world's own layout per section (the city's district, the dunes' ridges): a new section brings a new one, a
// returning section its old one (kept on the section type under key). m = {D0, D1, tr, ty, n}: the layout going and the one
// coming, and how far the change has got (0..1); off screen it changes at once. secs: how long a change takes
export function sectionLayout(m, key, J, on, dt, secs){
  const ty = J && J.type;
  if (ty && ty !== m.ty) {
    m.ty = ty; if (ty[key] === undefined) ty[key] = ++m.n;
    if (ty[key] !== m.D1) { m.D0 = m.tr < .5 ? m.D0 : m.D1; m.D1 = ty[key]; m.tr = 0; }
  }
  if (!on) { m.D0 = m.D1; m.tr = 1; }
  m.tr = Math.min(1, m.tr + dt/secs);
  return m;
}
