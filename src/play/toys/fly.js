// Fly through the score: the Corridor becomes a step sequencer you fly through, a frame passing on every 8th; click a frame ahead to light it and it plays as it passes you.
// The bottom of a frame: the kick; its sides: the clap; its top: the hat. Right-click a frame to clear it; Backspace clears them all. Brings in the Corridor.
import { CSEQ, corridorFrames } from '../../visuals/worlds/corridor.js';
const LANES = ['kick', 'clap', 'chh'], COL = ['#ff5a6e', '#ffb000', '#5ad1ff'];
let A = null, lanes = [0, 0, 0], over = null;
// sixteen frames (two bars of 8ths) as bits: the kick on every beat, the clap on 2 and 4, the hats on the off-beats
const START = [[0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14], [1, 3, 5, 7, 9, 11, 13, 15]];
const bits = a => a.reduce((m, i) => m | (1 << i), 0);
const sync = () => { CSEQ.lit = lanes[0] | lanes[1] | lanes[2]; CSEQ.lanes = lanes.slice(); };
// the frame under a point, and which part of it: the nearest outline to it, near frames first
function frameAt(e){
  const W = A.W(), H = A.H(), px = q => [W/2 + q[0]*H, H/2 - q[1]*H]; let best = null;
  for (const f of corridorFrames(14)) {
    const c = px(f.c), R = f.pts.reduce((m, q) => { const p = px(q); return Math.max(m, Math.hypot(p[0] - c[0], p[1] - c[1])); }, 0)*.85;
    const d = Math.abs(Math.hypot(e.x - c[0], e.y - c[1]) - R), tol = Math.max(10, R*.22);
    if (d < tol && (!best || d/tol < best.err)) best = {k: f.k, err: d/tol, c, R};
  }
  if (!best) return null;
  const a = Math.atan2(e.y - best.c[1], e.x - best.c[0]);   // below the middle: the kick; above: the hat; the sides: the clap
  best.lane = a > Math.PI/4 && a < 3*Math.PI/4 ? 0 : a < -Math.PI/4 && a > -3*Math.PI/4 ? 2 : 1;
  return best;
}
export default {
  key: 'fly', label: 'Fly through the score', preset: 'Pluck',
  how: 'The Corridor plays as you fly: a frame passes every 8th · click a frame ahead: its bottom the kick, its sides the clap, its top the hat · right-click: clear a frame · Backspace: clear all',
  init(api){ A = api; lanes = START.map(bits); },
  start(){ A.bring('corridor'); CSEQ.frames = () => A.stepAt(A.heard())/2; CSEQ.on = true; sync(); },
  stop(){ CSEQ.on = false; },
  step({t, s}){ if (s % 2) return; const m = (((s/2) % 16) + 16) % 16; LANES.forEach((v, i) => { if (lanes[i] >> m & 1) A.hit(v, t, i === 0 ? 1 : .8); }); },
  down(e){ const f = frameAt(e); if (!f) return; const m = ((f.k % 16) + 16) % 16;
    if (e.b === 2) lanes = lanes.map(l => l & ~(1 << m)); else lanes[f.lane] ^= 1 << m; sync(); },
  move(e){ over = frameAt(e); },
  keys(e, down){ if (down && e.key === 'Backspace') { lanes = [0, 0, 0]; sync(); return true; } return false; },
  draw(g, W, H){
    if (!CSEQ.on) return;
    const px = q => [W/2 + q[0]*H, H/2 - q[1]*H];
    // on each frame ahead, a dot for each sound it plays (the kick at its foot, the clap at its sides, the hat at its top)
    for (const f of corridorFrames(14)) { const m = ((f.k % 16) + 16) % 16, c = px(f.c), R = Math.max(...f.pts.map(q => { const p = px(q); return Math.hypot(p[0] - c[0], p[1] - c[1]); }))*.85, s = Math.max(2, Math.min(8, R*.06));
      LANES.forEach((_, i) => { if (!(lanes[i] >> m & 1)) return; g.fillStyle = COL[i]; g.globalAlpha = Math.min(1, .3 + R/200);
        const spots = i === 0 ? [[0, R]] : i === 1 ? [[-R, 0], [R, 0]] : [[0, -R]];
        for (const [dx, dy] of spots) { g.beginPath(); g.arc(c[0] + dx, c[1] + dy, s, 0, 7); g.fill(); } }); }
    if (over) { g.globalAlpha = .7; g.strokeStyle = COL[over.lane]; g.lineWidth = 2; g.beginPath(); g.arc(over.c[0], over.c[1], over.R, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
  },
};
