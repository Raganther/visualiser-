// Mandala rings: a euclidean drum machine drawn as rings, the kick at the heart and the hats outside; a ring's hits spread evenly round it, and a beam sweeps each one.
// Scroll on a ring for more or fewer hits, Shift+scroll for its length, drag round it to rotate, click a dot to switch it, right-click to clear.
const VOICE = [['kick', 'Kick', '#ff5a6e'], ['clap', 'Clap', '#ffb000'], ['chh', 'Hat', '#5ad1ff'], ['ohh', 'Open hat', '#7cff9a'], ['clave', 'Clave', '#b48cff']];
const START = [[16, 4, 0], [16, 2, 4], [16, 8, 2], [16, 0, 0], [12, 0, 0]];   // each ring's length, hits and turn to begin with
// k hits spread as evenly as they go over n steps, turned by rot
const euclid = (n, k, rot) => Array.from({length: n}, (_, j) => { const i = ((j - rot) % n + n) % n; return k > 0 && Math.floor(i*k/n) !== Math.floor((i - 1)*k/n) ? 1 : 0; });
let A = null, rings = [], drag = null, hover = -1;
const geo = () => { const W = A.W(), H = A.H(), top = 90, bot = H - 120, R = Math.max(60, Math.min(W*.42, (bot - top)/2)); return {cx: W/2, cy: (top + bot)/2, r: i => R*(.3 + .7*i/(rings.length - 1)), band: R*.7/(rings.length - 1)/2}; };
// which ring a point is on (or -1), and how far round from the top (0..1, clockwise)
function hit(p){ const G = geo(), dx = p.x - G.cx, dy = p.y - G.cy, d = Math.hypot(dx, dy); let best = -1;
  rings.forEach((r, i) => { if (Math.abs(d - G.r(i)) < G.band) best = i; });
  return {i: best, a: ((Math.atan2(dx, -dy)/(2*Math.PI)) + 1) % 1}; }
export default {
  key: 'mandala', label: 'Mandala rings', preset: 'Pluck',
  how: 'Scroll on a ring: more or fewer hits · Shift+scroll: its length · drag round: rotate · click a dot: on or off · right-click: clear the ring',
  init(api){ A = api; rings = VOICE.map(([v, label, col], i) => { const [n, k, rot] = START[i]; return {v, label, col, n, k, rot, pat: euclid(n, k, rot), fl: {}}; }); },
  step({t, s}){ for (const r of rings) { const j = ((s % r.n) + r.n) % r.n; if (r.pat[j]) { A.hit(r.v, t, j === 0 ? 1 : .8); r.fl[j] = t; } } },
  wheel(p){ const {i} = hit(p); if (i < 0) return; const r = rings[i];
    if (p.shift) { r.n = Math.max(2, Math.min(16, r.n - p.d)); r.k = Math.min(r.k, r.n); r.rot %= r.n; }
    else r.k = Math.max(0, Math.min(r.n, r.k - p.d));
    r.pat = euclid(r.n, r.k, r.rot); r.fl = {}; },
  down(p){ const {i, a} = hit(p); if (i < 0) return; const r = rings[i];
    if (p.b === 2) { r.k = 0; r.pat = euclid(r.n, 0, 0); return; }
    // on a dot: switch it; between dots: start turning the ring
    const j = Math.round(a*r.n) % r.n, G = geo(), da = Math.abs(a*r.n - Math.round(a*r.n))/r.n*2*Math.PI*G.r(i);
    if (da < 10) { r.pat[j] ^= 1; r.k = r.pat.reduce((x, y) => x + y, 0); drag = {i, a, moved: true, toggled: true}; }
    else drag = {i, a, pat: r.pat.slice(), rot: r.rot}; },
  move(p, held){ hover = hit(p).i; if (!drag || drag.toggled || !held) return; const r = rings[drag.i], {a} = hit(p);
    let d = a - drag.a; d -= Math.round(d); const st = Math.round(d*r.n);   // (turning by whole steps)
    r.pat = drag.pat.map((_, j) => drag.pat[((j - st) % r.n + r.n) % r.n]); r.rot = ((drag.rot + st) % r.n + r.n) % r.n; },
  up(){ drag = null; },
  keys(e, down){ if (down && e.key === 'Backspace') { for (const r of rings) { r.k = 0; r.pat = euclid(r.n, 0, 0); } return true; } return false; },
  draw(g, W, H, h){
    const G = geo(), sh = A.stepAt(h);
    g.lineCap = 'round';
    rings.forEach((r, i) => {
      const R = G.r(i), at = j => -Math.PI/2 + 2*Math.PI*j/r.n;
      g.strokeStyle = r.col; g.globalAlpha = i === hover ? .45 : .18; g.lineWidth = i === hover ? 2 : 1; g.beginPath(); g.arc(G.cx, G.cy, R, 0, 7); g.stroke();
      // the beam: where this ring's playhead is (each ring goes round at its own length)
      const pos = ((sh % r.n) + r.n) % r.n, pa = -Math.PI/2 + 2*Math.PI*pos/r.n;
      g.globalAlpha = .9; g.lineWidth = 3; g.beginPath(); g.arc(G.cx, G.cy, R, pa - .25, pa); g.stroke();
      // the steps: dim when off, bright when on, flaring as they're heard
      for (let j = 0; j < r.n; j++) {
        const x = G.cx + R*Math.cos(at(j)), y = G.cy + R*Math.sin(at(j)), f = r.fl[j] != null ? Math.max(0, 1 - (h - r.fl[j])/.35) : 0, live = h >= (r.fl[j] ?? 1e9);
        g.globalAlpha = r.pat[j] ? .95 : .35; g.fillStyle = r.pat[j] ? r.col : '#555';
        g.beginPath(); g.arc(x, y, (r.pat[j] ? 6 : 3) + (live ? f*9 : 0), 0, 7); g.fill();
      }
      g.globalAlpha = .85; g.fillStyle = r.col; g.font = '13px Chakra Petch, sans-serif'; g.textAlign = 'left';   // (a legend: from the heart outwards)
      g.fillText(`${['●', '●', '●', '●', '●'][i]} ${r.label}  ${r.k} of ${r.n}`, 18, H*.3 + i*20);
    });
    g.globalAlpha = 1;
  },
};
