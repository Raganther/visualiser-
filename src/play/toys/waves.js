// Shockwaves: click anywhere on the picture and a shockwave goes out from there through Journey's own trails, landing on the next 16th; where you click picks the sound.
// Low down: kick and toms; the middle: clap, snare, rim; high up: the hats. Shift+click loops it from there every bar; drag to send a stream of them; right-click a loop to take it away.
import { shocks } from '../../fx/effects.js';
import { S } from '../../state.js';
const ZONES = [['chh', 'ohh', 'ride'], ['clap', 'snare', 'rim'], ['kick', 'tomL', 'tomH']], STRENGTH = [.55, .8, 1.1], COL = ['#5ad1ff', '#ffb000', '#ff5a6e'];
let A = null, seeds = [], held = null, lastS = -9;
const zoneOf = p => { const z = Math.min(2, Math.floor(p.y/A.H()*3)), c = Math.min(2, Math.floor(p.x/A.W()*3)); return {z, v: ZONES[z][c]}; };
// a ring from that point, at the moment it's heard
function wave(p, t, z, v){
  A.hit(v, t, z === 2 ? 1 : .85);
  const q = A.toPic(p.x, p.y);
  A.at(t, () => { const sh = shocks[S.shockN++ % 8]; sh.x = q.x; sh.y = q.y; sh.r = .005; sh.s = STRENGTH[z]; });
  A.spark(p.x, p.y, t, COL[z], .8 + z*.3);
}
export default {
  key: 'waves', label: 'Shockwaves in the picture', preset: 'Pluck',
  how: 'Click anywhere: a shockwave through the picture (low: kick and toms · middle: claps · high: hats) · Shift+click: loop it every bar · drag: a stream · right-click a loop: remove it',
  init(api){ A = api; },
  start(){ S.shockOn = 1; },
  stop(){ S.shockOn = 0; held = null; },
  step({t, s}){
    const j = ((s % 16) + 16) % 16;
    for (const sd of seeds) if (sd.j === j) { wave(sd, t, sd.z, sd.v); sd.t = t; }
    if (held && held.moved && s - lastS >= 2) { const {z, v} = zoneOf(held); wave(held, t, z, v); lastS = s; }   // (dragging: one every 8th)
  },
  down(e){
    if (e.b === 2) { const i = seeds.findIndex(sd => Math.hypot(sd.x - e.x, sd.y - e.y) < 22); if (i >= 0) seeds.splice(i, 1); return; }
    const {z, v} = zoneOf(e), n = A.next16();
    if (e.shift) seeds.push({x: e.x, y: e.y, z, v, j: ((n.s % 16) + 16) % 16, t: -1});
    wave(e, n.t, z, v); held = {x: e.x, y: e.y, x0: e.x, y0: e.y, moved: false}; lastS = n.s;
  },
  move(e, down){ if (!held || !down) return; held.x = e.x; held.y = e.y; if (Math.hypot(e.x - held.x0, e.y - held.y0) > 14) held.moved = true; },
  up(){ held = null; },
  keys(e, down){ if (down && e.key === 'Backspace') { seeds = []; return true; } return false; },
  draw(g, W, H, h){
    // only a whisper of the zones, at the left edge, and where the loops come from
    g.font = '12px Chakra Petch, sans-serif'; g.textAlign = 'left';
    ['hats', 'claps', 'kick and toms'].forEach((l, i) => { g.fillStyle = COL[i]; g.globalAlpha = .45; g.fillText(l, 12, (i + .5)*H/3); });
    for (const sd of seeds) { const f = sd.t > 0 && h >= sd.t ? Math.max(0, 1 - (h - sd.t)/.4) : 0;
      g.globalAlpha = .5 + .5*f; g.strokeStyle = COL[sd.z]; g.lineWidth = 2; g.beginPath(); g.arc(sd.x, sd.y, 6 + 6*f, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
  },
};
