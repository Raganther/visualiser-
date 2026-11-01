// Draw a loop: draw a line across the screen and it becomes a melody a bar long that repeats (across is time, height is the note), drawn as a glowing path with a playhead.
// Shift+draw adds a line (up to three, each an octave apart); right-click takes the last away; Backspace clears.
const COL = ['#5ad1ff', '#ff7ab8', '#ffb000'];
let A = null, lines = [], cur = null;
// a stroke as notes: sixteen columns across the screen, each the stroke's average height there (a run of the same note is one long note)
function notes(pts){
  const W = A.W(), H = A.H(), out = [], top = A.scaleLen()*2 + 2;
  for (let c = 0; c < 16; c++) {
    const ys = pts.filter(p => p.x >= c*W/16 && p.x < (c + 1)*W/16).map(p => p.y); if (!ys.length) continue;
    const y = ys.reduce((a, b) => a + b, 0)/ys.length, d = Math.round((1 - y/H)*top), prev = out[out.length - 1];
    if (prev && prev.d === d && prev.s + prev.l === c) prev.l++; else out.push({s: c, l: 1, d, y});
  }
  return out;
}
export default {
  key: 'draw', label: 'Draw a loop', preset: 'Glass bell', synth: {ad: .9, ar: .6},
  how: 'Draw a line across the screen: it plays as a one-bar loop · Shift+draw: add a line · right-click: take the last away · Backspace: clear',
  init(api){ A = api; },
  rescale(){ for (const L of lines) L.notes = notes(L.pts); },
  step({t, s, dur}){
    const c = ((s % 16) + 16) % 16;
    lines.forEach((L, i) => { for (const n of L.notes) if (n.s === c) { const base = 57 - 12*i;
      A.play(A.deg(n.d, base), t, n.l*dur*.95, .75); A.spark((c + .5)/16*A.W(), n.y, t, COL[i], 1.3); } });
  },
  down(e){ if (e.b === 2) { lines.pop(); return; } cur = {pts: [{x: e.x, y: e.y}], add: e.shift}; },
  move(e, held){ if (cur && held) cur.pts.push({x: e.x, y: e.y}); },
  up(){ if (!cur) return; if (cur.pts.length > 2) { if (!cur.add) lines = []; if (lines.length >= 3) lines.shift(); lines.push({pts: cur.pts, notes: notes(cur.pts)}); } cur = null; },
  keys(e, down){ if (down && e.key === 'Backspace') { lines = []; return true; } return false; },
  draw(g, W, H, h){
    const sh = A.stepAt(h), x = (((sh % 16) + 16) % 16)/16*W;
    // the bar's sixteen columns, each beat's line brighter
    for (let c = 0; c <= 16; c++) { g.fillStyle = c % 4 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.1)'; g.fillRect(c/16*W, 0, 1, H); }
    g.lineCap = g.lineJoin = 'round'; g.globalCompositeOperation = 'lighter';
    lines.forEach((L, i) => {
      g.strokeStyle = COL[i]; g.globalAlpha = .35; g.lineWidth = 3; g.beginPath(); L.pts.forEach((p, k) => k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
      // the notes it became: bars where they sit, the one playing lit
      for (const n of L.notes) { const on = x >= n.s/16*W && x < (n.s + n.l)/16*W; g.globalAlpha = on ? 1 : .55; g.fillStyle = COL[i];
        g.fillRect(n.s/16*W + 2, n.y - 3, n.l/16*W - 4, on ? 7 : 5); }
    });
    if (cur) { g.globalAlpha = .9; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); cur.pts.forEach((p, k) => k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); }
    g.globalAlpha = .7; g.fillStyle = '#fff'; g.fillRect(x - 1, 0, 2, H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (!lines.length && !cur) { g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '16px Chakra Petch, sans-serif'; g.textAlign = 'center'; g.fillText('Draw a line from left to right', W/2, H/2); }
  },
};
