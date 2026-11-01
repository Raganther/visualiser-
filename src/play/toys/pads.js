// Keyboard pads: the laptop's keys as a grid of pads, no aiming: the number row drums, two rows of notes in the scale, the bottom row chords; Space records a two-bar loop over them.
// Space starts and stops recording (each pass adds to the loop); Backspace clears the loop; Tab switches snapping to the 16ths on or off.
const ROWS = [['1234567890', 'drum'], ['qwertyuiop', 'low'], ['asdfghjkl;', 'high'], ['zxcvbnm,./', 'chord']];
const DRUMS = [['kick', 'Kick'], ['snare', 'Snare'], ['clap', 'Clap'], ['chh', 'Hat'], ['ohh', 'Open'], ['rim', 'Rim'], ['clave', 'Clave'], ['tomL', 'Tom'], ['tomH', 'Tom'], ['crash', 'Crash']];
const COL = {drum: '#ff5a6e', low: '#5ad1ff', high: '#7cff9a', chord: '#b48cff'};
let A = null, snap = true, rec = false, loop = [], lit = {}, held = {};
const LOOP = 32;   // two bars of 16ths
// a pad's sound: [the notes, or a drum], by row and column
const notesOf = (kind, c) => kind === 'low' ? [A.deg(c, 45)] : kind === 'high' ? [A.deg(c + A.scaleLen()*2, 45)] : kind === 'chord' ? [0, 2, 4].map(x => A.deg(c + x, 45)) : [];
const padOf = k => { for (const [keys, kind] of ROWS) { const c = keys.indexOf(k); if (c >= 0) return {kind, c}; } return null; };
function sound(pad, t, len){ if (pad.kind === 'drum') A.hit(DRUMS[pad.c][0], t, .95); else for (const n of notesOf(pad.kind, pad.c)) A.play(n, t, len, .8); lit[pad.kind + pad.c] = t; }
export default {
  key: 'pads', label: 'Keyboard pads', preset: 'Pluck', synth: {fs: .4, ar: .3},
  how: 'Number row: drums · Q to P and A to ; notes in the scale · Z to /: chords · Space: record a two-bar loop (again to stop) · Backspace: clear it · Tab: snap to the beat on or off',
  init(api){ A = api; },
  stop(){ rec = false; },
  step({t, s, dur}){ const j = ((s % LOOP) + LOOP) % LOOP; for (const e of loop) if (e.j === j) sound(e.pad, t, e.l*dur); },
  keys(e, down){
    const k = e.key.toLowerCase();
    if (down && k === ' ') { rec = !rec; A.hint(rec ? 'Recording: play, and it loops every two bars (Space to stop)' : this.how); return true; }
    if (down && k === 'backspace') { loop = []; return true; }
    if (down && k === 'tab') { snap = !snap; A.hint(`Snap to the 16ths: ${snap ? 'on' : 'off'}`); return true; }
    const pad = padOf(k); if (!pad) return false;
    if (down) { if (e.repeat || held[k]) return true;
      const q = snap ? A.next16() : {t: A.now() + .005, s: Math.round(A.stepAt(A.now())), dur: A.dur()}, t = q.t;
      held[k] = {t, s: q.s, pad}; if (pad.kind === 'drum') sound(pad, t); else { for (const n of notesOf(pad.kind, pad.c)) A.on(n, t, .8); lit[pad.kind + pad.c] = t; } }
    else { const h = held[k]; if (!h) return true; delete held[k];
      const len = Math.max(1, Math.round((A.now() - h.t)/A.dur()));
      if (pad.kind !== 'drum') for (const n of notesOf(pad.kind, pad.c)) A.off(n, Math.max(A.now(), h.t + .05));
      if (rec) { const j = ((h.s % LOOP) + LOOP) % LOOP; loop = loop.filter(x => !(x.j === j && x.pad.kind === pad.kind && x.pad.c === pad.c)); loop.push({j, pad, l: pad.kind === 'drum' ? 1 : len}); } }
    return true;
  },
  draw(g, W, H, h){
    // the pads as the keyboard lies, lit as they're heard
    const pw = Math.min(70, (W - 80)/10.8), ph = pw*.8, x0 = (W - pw*10.6)/2, y0 = H*.5 - ph*2.4;
    ROWS.forEach(([keys, kind], r) => [...keys].forEach((k, c) => {
      const x = x0 + c*pw*1.04 + r*pw*.28, y = y0 + r*ph*1.15, t = lit[kind + c], f = t != null && h >= t ? Math.max(0, 1 - (h - t)/.3) : 0;
      g.globalAlpha = .25 + .75*f; g.fillStyle = COL[kind]; g.fillRect(x, y, pw*.94, ph);
      g.globalAlpha = .9; g.fillStyle = f > .5 ? '#000' : '#fff'; g.font = '13px Chakra Petch, sans-serif'; g.textAlign = 'center';
      g.fillText(k.toUpperCase(), x + pw*.47, y + ph*.45);
      g.font = '10px Chakra Petch, sans-serif'; g.fillText(kind === 'drum' ? DRUMS[c][1] : kind === 'chord' ? 'chord' : '', x + pw*.47, y + ph*.8);
    }));
    // the loop: two bars, its hits as ticks, the playhead
    const ly = y0 + ph*4.9, lw = pw*10.6, sh = A.stepAt(h), j = ((sh % LOOP) + LOOP) % LOOP;
    g.globalAlpha = .25; g.fillStyle = '#fff'; g.fillRect(x0, ly, lw, 2);
    for (const e of loop) { g.globalAlpha = .9; g.fillStyle = COL[e.pad.kind]; g.fillRect(x0 + e.j/LOOP*lw, ly - 6 - (e.pad.kind === 'drum' ? 0 : 6), Math.max(2, e.l/LOOP*lw - 1), 4); }
    g.globalAlpha = 1; g.fillStyle = rec ? '#ff3d3d' : '#fff'; g.fillRect(x0 + j/LOOP*lw - 1, ly - 14, 2, 18);
    g.font = '13px Chakra Petch, sans-serif'; g.textAlign = 'left'; g.fillText(rec ? '● Recording' : loop.length ? `Loop: ${loop.length} hits` : 'Space to record a loop', x0, ly + 22);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(`Snap: ${snap ? '16ths' : 'off'} (Tab)`, x0 + lw, ly + 22);
  },
};
