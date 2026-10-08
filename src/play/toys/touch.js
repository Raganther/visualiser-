// Touch the centrepiece: Journey's 3D object is the instrument; click a part and it plays (the skull's jaw a snare, its eyes a hat, its cranium a kick) and that part lifts off and flares as it's heard.
// Drag it to turn it, a note for every notch it turns, like a music box; Shift+click loops a part every bar; right-click clears the loops. Brings in the skull if there's no centrepiece.
const VOICES = ['kick', 'kick', 'tomL', 'tomH', 'snare', 'rim', 'clap', 'chh', 'cow'];
const NAMES = {skull: ['', 'Cranium', 'Face', 'Cheekbones', 'Jaw', 'Teeth', 'Brow', 'Eye sockets', 'Nose']};
let A = null, drag = null, seeds = [], over = null, notch = 0, deg = 0;
const obj = () => A.objects()[0] || null;
const voiceOf = part => VOICES[((part || 1) % VOICES.length + VOICES.length) % VOICES.length] || 'kick';
const nameOf = (o, part) => (NAMES[o.key] && NAMES[o.key][part]) || `Part ${part}`;
function pickAt(e){ const o = obj(), P = A.P(); if (!o || !P) return null; const part = o.pick(P, A.W(), A.H(), e.x, e.y); return part == null ? null : {o, part}; }
function play(o, part, t, x, y){ const v = voiceOf(part); A.hit(v, t, .95); A.at(t, () => o.poke(part)); if (x != null) A.spark(x, y, t, '#fff', 1.2); }
export default {
  key: 'touch', label: 'Touch the centrepiece', preset: 'Glass bell', synth: {ad: .6, ar: .5},
  how: 'Click a part of the object: it plays and moves · drag it: turn it, a note each notch · Shift+click: loop that part every bar · right-click: clear the loops',
  init(api){ A = api; },
  start(){ if (!obj()) A.bring('skull'); },
  stop(){ const o = obj(); if (o) o.letGo(); drag = null; },
  step({t, s}){ const j = ((s % 16) + 16) % 16; for (const sd of seeds) if (sd.j === j) { const o = A.objects().find(x => x.key === sd.key); if (o) play(o, sd.part, t); } },
  down(e){
    if (e.b === 2) { seeds = []; return; }
    const hit = pickAt(e), n = A.next16();
    if (hit) { play(hit.o, hit.part, n.t, e.x, e.y); if (e.shift) seeds.push({key: hit.o.key, part: hit.part, j: ((n.s % 16) + 16) % 16}); }
    drag = {x: e.x, y: e.y, moved: false};
  },
  move(e, down){
    if (!drag || !down) { const h = pickAt(e); over = h ? {x: e.x, y: e.y, label: `${nameOf(h.o, h.part)}: ${voiceOf(h.part)}`} : null; return; }
    const o = obj(); if (!o) return;
    const dx = e.x - drag.x, dy = e.y - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true;
    o.turn(dx*.012, dy*.006); drag.x = e.x; drag.y = e.y;
    // a music box: a note each time it turns another notch, up the scale one way, down the other
    notch += dx*.012; while (Math.abs(notch) > Math.PI/8) { const dir = Math.sign(notch); notch -= dir*Math.PI/8; deg += dir;
      const n = A.next16(); A.play(A.deg(((deg % 15) + 15) % 15, 57), n.t, .3, .7); A.at(n.t, () => o.poke(1 + ((deg % 8) + 8) % 8, .5)); }
  },
  up(){ const o = obj(); if (o) o.letGo(); drag = null; },
  keys(e, down){ if (down && e.key === 'Backspace') { seeds = []; return true; } return false; },
  draw(g, W, H){
    const o = obj();
    g.font = '13px Chakra Petch, sans-serif'; g.textAlign = 'center';
    if (!o) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(A.journeyOn() ? 'Bringing in the skull…' : 'Turn Journey on, or bring in an object (O, then a number)', W/2, H - 140); return; }
    if (over) { g.fillStyle = 'rgba(0,0,0,.6)'; const w = g.measureText(over.label).width + 12; g.fillRect(over.x + 14, over.y - 22, w, 18); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(over.label, over.x + 20, over.y - 9); }
    if (seeds.length) { g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(`Looping: ${seeds.map(sd => nameOf(o, sd.part)).join(', ')}`, 12, H - 130); }
  },
};
