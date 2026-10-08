// Orbits: rings of different lengths (a bar, three beats, five 8ths…), each with its sound; drop planets on them and each plays as it passes the top, so a few make shifting polyrhythms you can watch.
// Click a ring to drop a planet where you click; drag a planet to another ring, or off them all to remove it; right-click removes one.
const RINGS = [{n: 16, label: '1 bar', drum: 'kick', col: '#ff5a6e'}, {n: 12, label: '3 beats', drum: 'rim', col: '#ffb000'}, {n: 10, label: '5 eighths', d: 0, col: '#5ad1ff'},
  {n: 7, label: '7 sixteenths', d: 2, col: '#7cff9a'}, {n: 6, label: '3 eighths', d: 4, col: '#b48cff'}, {n: 9, label: '9 sixteenths', drum: 'chh', col: '#ffffff'}];
let A = null, planets = [], drag = null, hover = -1;
const geo = () => { const W = A.W(), H = A.H(), top = 90, bot = H - 120, R = Math.max(60, Math.min(W*.43, (bot - top)/2)); return {cx: W/2, cy: (top + bot)/2, r: i => R*(.22 + .78*i/(RINGS.length - 1)), band: R*.78/(RINGS.length - 1)/2}; };
const ringAt = p => { const G = geo(), d = Math.hypot(p.x - G.cx, p.y - G.cy); let b = -1; RINGS.forEach((_, i) => { if (Math.abs(d - G.r(i)) < G.band) b = i; }); return b; };
const turn = p => { const G = geo(); return ((Math.atan2(p.x - G.cx, -(p.y - G.cy))/(2*Math.PI)) + 1) % 1; };   // clockwise from the top, 0..1
// a planet's offset in steps, so that it's at turn a now; and where it is on its ring at a time
const offsetFor = (n, a) => ((Math.round(A.stepAt(A.heard()) - a*n) % n) + n) % n;
const where = (pl, sh) => { const G = geo(), n = RINGS[pl.ring].n, a = (((sh - pl.o) % n) + n) % n/n*2*Math.PI - Math.PI/2, R = G.r(pl.ring); return {x: G.cx + R*Math.cos(a), y: G.cy + R*Math.sin(a)}; };
function pick(p){ const sh = A.stepAt(A.heard()); let best = null, bd = 18; for (const pl of planets) { const q = where(pl, sh), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = pl; } } return best; }
export default {
  key: 'orbits', label: 'Orbits', preset: 'Glass bell', synth: {ad: .7, ar: .7},
  how: 'Click a ring to drop a planet: it plays each time it passes the top · drag a planet to another ring, or off them to remove it · right-click removes one · Backspace clears',
  init(api){ A = api; planets = [{ring: 0, o: 0}, {ring: 0, o: 8}, {ring: 2, o: 0}]; },
  step({t, s}){
    const G = geo();
    for (const pl of planets) { const R = RINGS[pl.ring]; if ((((s - pl.o) % R.n) + R.n) % R.n) continue;
      const k = planets.filter(q => q.ring === pl.ring).indexOf(pl);   // (planets sharing a ring climb the scale)
      if (R.drum) A.hit(R.drum, t, .9); else A.play(A.deg(R.d + 2*k, 57), t, .25, .7);
      A.spark(G.cx, G.cy - G.r(pl.ring), t, R.col, 1.4); }
  },
  down(e){ const pl = pick(e);
    if (pl) { if (e.b === 2) planets.splice(planets.indexOf(pl), 1); else drag = pl; return; }
    const i = ringAt(e); if (i >= 0 && e.b !== 2) { const p = {ring: i, o: offsetFor(RINGS[i].n, turn(e))}; planets.push(p); drag = p; } },
  move(e, held){ hover = ringAt(e); if (!drag || !held) return; const i = ringAt(e); if (i >= 0) { drag.ring = i; drag.o = offsetFor(RINGS[i].n, turn(e)); drag.off = false; } else drag.off = true; },
  up(){ if (drag && drag.off) planets.splice(planets.indexOf(drag), 1); drag = null; },
  keys(e, down){ if (down && e.key === 'Backspace') { planets = []; return true; } return false; },
  draw(g, W, H, h){
    const G = geo(), sh = A.stepAt(h);
    // the line at the top where each planet plays
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(G.cx, G.cy - G.r(RINGS.length - 1) - 16); g.lineTo(G.cx, G.cy - G.r(0) + 10); g.stroke();
    RINGS.forEach((R, i) => { g.strokeStyle = R.col; g.globalAlpha = i === hover ? .5 : .2; g.lineWidth = i === hover ? 2 : 1; g.beginPath(); g.arc(G.cx, G.cy, G.r(i), 0, 7); g.stroke();
      for (let j = 0; j < R.n; j++) { const a = j/R.n*2*Math.PI - Math.PI/2; g.globalAlpha = .25; g.fillStyle = R.col; g.beginPath(); g.arc(G.cx + G.r(i)*Math.cos(a), G.cy + G.r(i)*Math.sin(a), 1.5, 0, 7); g.fill(); }
      g.globalAlpha = .8; g.fillStyle = R.col; g.font = '13px Chakra Petch, sans-serif'; g.textAlign = 'left';
      g.fillText(`● ${R.label}: ${R.drum ? {kick: 'kick', rim: 'rim', chh: 'hat'}[R.drum] : 'notes'}`, 18, H*.28 + i*20); });
    g.globalCompositeOperation = 'lighter';
    for (const pl of planets) { const q = where(pl, sh), R = RINGS[pl.ring], gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, 16);
      gr.addColorStop(0, R.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = pl.off ? .3 : 1; g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, 16, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, 4, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
};
