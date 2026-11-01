// Paint with light: hold the button and move; while it's held, notes follow the pointer on the 16ths (across picks the note in the scale, up opens the sound), trailing light behind it.
// Scroll for faster or slower notes; hold Shift for chords; let go and it stops.
const RATES = [[1, '16ths'], [2, '8ths'], [3, 'dotted 8ths'], [4, 'quarters']];
let A = null, p = null, held = false, chord = false, rate = 0, trail = [], last = null;
const deg = x => Math.round(x/A.W()*(A.scaleLen()*3 - 1));          // three octaves of the scale across the screen
const tone = y => 1 - Math.max(0, Math.min(1, y/A.H()));              // up the screen: brighter, louder
export default {
  key: 'paint', label: 'Paint with light', preset: 'Pluck', synth: {fs: .25, fd: .3, ar: .35},
  how: 'Hold the button and move: across picks the note, up opens the sound · scroll: faster or slower · hold Shift: chords',
  init(api){ A = api; },
  stop(){ held = false; },
  step({t, s, dur}){
    if (!held || !p) return;
    const r = RATES[rate][0]; if (((s % r) + r) % r) return;
    const d = deg(p.x), k = tone(p.y), ds = chord ? [d, d + 2, d + 4] : [d];
    for (const x of ds) A.play(A.deg(x, 45), t, dur*r*.85, .45 + .5*k);
    A.spark(p.x, p.y, t, `hsl(${200 + d*12},90%,65%)`, chord ? 1.6 : 1); last = {x: p.x, y: p.y};
  },
  down(e){ held = true; p = e; chord = e.shift; A.set('cut', 260*Math.pow(2, tone(e.y)*5.6)); },
  move(e){ p = e; chord = e.shift || (e.b === 2); trail.push({x: e.x, y: e.y, t: performance.now(), on: held}); if (trail.length > 120) trail.shift();
    if (held) A.set('cut', 260*Math.pow(2, tone(e.y)*5.6)); },
  up(){ held = false; },
  wheel(e){ rate = Math.max(0, Math.min(RATES.length - 1, rate + e.d)); A.hint(`Notes in ${RATES[rate][1]} · hold the button and move · Shift: chords`); },
  keys(e, down){ if (e.key === 'Shift') { chord = down; return true; } return false; },
  draw(g, W, H){
    // the scale's notes as faint columns, the roots brighter, so you can aim
    const n = A.scaleLen()*3;
    for (let i = 0; i < n; i++) { const x = (i + .5)/n*W; g.fillStyle = i % A.scaleLen() ? 'rgba(255,255,255,.04)' : 'rgba(90,209,255,.10)'; g.fillRect(x - 1, 0, 2, H); }
    // the trail: bright where it played, a ghost where the pointer only passed
    const now = performance.now(); g.lineCap = 'round'; g.globalCompositeOperation = 'lighter';
    for (let i = 1; i < trail.length; i++) { const a = trail[i - 1], b = trail[i], age = (now - b.t)/1200; if (age > 1) continue;
      g.strokeStyle = b.on ? `hsla(${200 + deg(b.x)*12},90%,65%,${(1 - age)*.8})` : `rgba(255,255,255,${(1 - age)*.12})`; g.lineWidth = b.on ? 6*(1 - age) + 1 : 1;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    if (p) { g.strokeStyle = held ? '#fff' : 'rgba(255,255,255,.4)'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, held ? 14 : 9, 0, 7); g.stroke(); }
  },
};
