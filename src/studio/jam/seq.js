// The jam's sequencers: one part's loop, shown and changed while it plays. A loop bar on top (the whole clip as a strip
// of steps, the loop's span lit, the step being heard lit as it moves; 1–4 bars at a touch, the start and end moved a
// step at a time or dragged, for odd meters), then the loop in one of three editors, to find which feels right:
//  - steps: a grid to tap (a drum: on, louder, off; a note: on or off);
//  - draw: the same grid, painted with a finger (a drum's row as you drag along it; a melody as you drag up and down);
//  - euclid: hits spread as evenly as they go over a length of steps, turned round; a ring a drum (each its own length,
//    so they turn against each other), or for a synth one rhythm and the notes it walks through in turn.
// Every change goes into the playing take at once, so the groove carries on. mountSeq(box, core, ctl) → {refresh, frame}.
import { h, btn, vname, baseOf, degNote } from './kit.js';
import { VOICES, part } from './song.js';
import { keyOf, euclid } from '../improv.js';
import { noteName } from '../song.js';

const MODES = [['steps', 'Steps', 'Tap a step on or off'], ['draw', 'Draw', 'Paint with a finger'], ['euclid', 'Euclid', 'Hits spread evenly round a ring']];
const LS = 'afterglow.jam.seq';
const PAGE = 32;
const rowStr = r => (typeof r === 'string' ? r : r ? r.p : '').replace(/[\s|]/g, '');
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (x) {} };
// a time signature for a loop of n sixteenths: whole beats as n/4 over 4, the rest over 16 (7 → 7/16, 12 → 3/4, 20 → 5/4)
const meter = n => n % 4 === 0 ? `${n/4}/4` : n % 2 === 0 ? `${n/2}/8` : `${n}/16`;

export function mountSeq(box, core, ctl){
  const st = {mode: (() => { try { return localStorage.getItem(LS) || 'steps'; } catch (e) { return 'steps'; } })(), page: 0, follow: true, drag: null};
  const K = () => ctl.lane, drums = () => part(K()).kind === 'drums';

  function draw(){
    if (st.drag || st.edge) { st.stale = true; return; }   // (not under a finger that's painting or dragging the loop: after it lifts)
    box.innerHTML = '';
    box.append(loopBar(), modeBar());
    box.appendChild(st.mode === 'euclid' ? (drums() ? euDrums() : euNotes()) : grid());
  }

  /* ---------- the loop bar ---------- */
  function loopBar(){
    const k = K(), L = core.loopOf(k), wrap = h('div', 'sqloop');
    const ctrl = h('div', 'sqlc');
    const bars = h('div', 'jseg sqbars'); for (const n of [1, 2, 3, 4]) bars.appendChild(btn(n + (n === 1 ? ' bar' : ' bars'), L.len === n*16 && !L.start ? 'cur' : '', () => core.setLoop(k, 0, n*16), `Loop ${n} bar${n > 1 ? 's' : ''}`));
    const nudge = (label, fn, title) => btn(label, 'sqn', fn, title);
    ctrl.append(bars,
      h('span', 'jlab', 'Start'), nudge('◂', () => core.setLoop(k, L.start - 1, L.len + (L.start > 0 ? 1 : 0)), 'Start a step earlier'), nudge('▸', () => L.len > 1 && core.setLoop(k, L.start + 1, L.len - 1), 'Start a step later'),
      h('span', 'jlab', 'End'), nudge('◂', () => L.len > 1 && core.setLoop(k, L.start, L.len - 1), 'End a step earlier'), nudge('▸', () => core.setLoop(k, L.start, L.len + 1), 'End a step later'),
      h('span', 'sqmeter', `${L.len % 16 ? `${L.len} steps · ${meter(L.len)}` : `${L.len/16} bar${L.len > 16 ? 's' : ''}`}${L.start ? ` · from ${L.start + 1}` : ''}`),
      btn('Follow', 'sqfollow' + (st.follow ? ' on' : ''), () => { st.follow = !st.follow; draw(); }, 'Turn the page with the playhead'));
    // the strip: the whole clip, a cell a step, the span lit; drag its ends to move them, tap elsewhere to see that page
    const cv = h('canvas', 'sqstrip'); cv.height = 40;
    const geom = () => { const w = cv.clientWidth || 600, n = Math.max(L.total, L.start + L.len) + 4; return {w, n, cw: w/n}; };
    const paint = (ph = -1) => {
      const {w, n, cw} = geom(); if (cv.width !== Math.round(w*devicePixelRatio)) { cv.width = Math.round(w*devicePixelRatio); }
      const g = cv.getContext('2d'), sx = cv.width/w; g.setTransform(sx, 0, 0, cv.height/40, 0, 0); g.clearRect(0, 0, w, 40);
      const css = getComputedStyle(box), c = css.getPropertyValue('--c').trim() || '#5cf';
      for (let i = 0; i < n; i++) { const inL = i >= L.start && i < L.start + L.len, pg = Math.floor(i/PAGE) === st.page;
        g.fillStyle = i === ph ? '#fff' : inL ? c : '#1a2230'; g.globalAlpha = i === ph ? 1 : inL ? (i % 4 === 0 ? .75 : .45) : (i % 4 === 0 ? .9 : .6);
        g.fillRect(i*cw + 1, pg ? 8 : 12, Math.max(1, cw - 2), pg ? 24 : 16); }
      g.globalAlpha = 1; g.fillStyle = '#fff';
      for (const x of [L.start*cw, (L.start + L.len)*cw]) { g.fillRect(x - 2, 2, 4, 36); }
      for (let b = 0; b*16 < n; b++) { g.fillStyle = '#8794a6'; g.font = '10px system-ui'; g.fillText(String(b + 1), b*16*cw + 3, 10); }
    };
    cv.paintPh = paint;
    cv.onpointerdown = e => { e.preventDefault(); const r = cv.getBoundingClientRect(), {cw} = geom(), x = e.clientX - r.left, i = Math.round(x/cw);
      const end = L.start + L.len, near = Math.abs(x - end*cw) < 18 ? 'end' : Math.abs(x - L.start*cw) < 18 ? 'start' : null;
      if (!near) { st.page = Math.floor(Math.floor(x/cw)/PAGE); st.follow = false; draw(); return; }
      capture(cv, e); st.edge = {which: near, i};
      cv.onpointermove = ev => { const j = Math.max(0, Math.round((ev.clientX - r.left)/cw)), L2 = core.loopOf(k);
        if (st.edge.which === 'end' && j > L2.start && j !== L2.start + L2.len) core.setLoop(k, L2.start, j - L2.start);
        if (st.edge.which === 'start' && j < L2.start + L2.len && j !== L2.start) core.setLoop(k, j, L2.start + L2.len - j); };
      cv.onpointerup = cv.onpointercancel = () => { cv.onpointermove = null; st.edge = null; if (st.stale) { st.stale = false; draw(); } }; };
    requestAnimationFrame(() => paint());
    wrap.append(ctrl, cv); return wrap;
  }
  function modeBar(){
    const m = h('div', 'sqmodes'), seg = h('div', 'jseg');
    for (const [v, label, title] of MODES) seg.appendChild(btn(label, v === st.mode ? 'cur' : '', () => { st.mode = v; try { localStorage.setItem(LS, v); } catch (e) {} draw(); }, title));
    m.append(h('span', 'jlab', 'Sequencer'), seg, h('span', 'sqhint', st.mode === 'steps' ? (drums() ? 'Tap: on, louder, off.' : 'Tap a note on or off.') : st.mode === 'draw' ? (drums() ? 'Drag along a row to paint hits; start on a hit to erase.' : 'Drag across: the note under your finger at each step; start on a note to erase.') : (drums() ? 'Each drum a ring: hits, steps, turn. Different steps turn against each other.' : 'One rhythm, and the notes it walks through in turn.')));
    return m;
  }

  /* ---------- steps and draw: the grid ---------- */
  function grid(){
    const k = K(), c = core.clip(k), L = core.loopOf(k), total = Math.max(L.total, L.start + L.len), pages = Math.ceil(total/PAGE);
    st.page = Math.max(0, Math.min(st.page, pages - 1));
    const from = st.page*PAGE, n = Math.min(PAGE, Math.max(16, total - from)), wrap = h('div', 'fsteps' + (st.mode === 'draw' ? ' drawing' : '')); wrap.style.setProperty('--n', n);
    wrap.dataset.from = from;
    const out = i => i < L.start || i >= L.start + L.len;
    const cell = (i, cls, on, v) => { const b = h('button', 'fst' + cls + (i % 4 === 0 ? ' beat' : '') + (out(i) ? ' out' : '')); if (on) b.style.setProperty('--v', v); b.dataset.s = i; return b; };
    if (drums()) for (const v of VOICES[k]) {
      const s = c && c.hits ? rowStr(c.hits[v]) : '', row = h('div', 'frow'); row.dataset.voice = v;
      row.appendChild(h('span', 'flab', vname(v) + (s && s.length !== L.len ? `<small> ${s.length}</small>` : '')));
      for (let i = from; i < from + n; i++) { const ch = s ? s[i % s.length] : '.', on = ch && ch !== '.' && ch !== '-', vv = /[1-9]/.test(ch) ? +ch/9 : ch === 'X' ? 1 : .8;
        const b = cell(i, on ? ' on' : '', on, vv); if (st.mode === 'steps') b.onclick = () => { core.toggleStep(k, i, v); draw(); }; row.appendChild(b); }
      wrap.appendChild(row);
    }
    else {
      const K0 = keyOf(core.song.key), base = baseOf(core, k, ctl.oct), notes = (c && c.notes) || [];
      const degOf = p => { for (let d = -14; d < 28; d++) if (degNote(K0, base, d) === p) return d; return null; };
      const ds = notes.flatMap(e => [].concat(e[1])).map(degOf).filter(d => d != null), lo = Math.min(0, ...ds.map(d => d - 1)), hi = Math.max(lo + 9, ...ds.map(d => d + 1));
      for (let d = hi; d >= lo; d--) {
        const p = degNote(K0, base, d), row = h('div', 'frow' + (((d % 7) + 7) % 7 === 0 ? ' root' : '')); row.dataset.p = p;
        row.appendChild(h('span', 'flab', noteName(p)));
        for (let i = from; i < from + n; i++) {
          const e = notes.find(x => [].concat(x[1]).includes(p) && i >= Math.floor(x[0]) && i < x[0] + Math.max(1, x[2] || 1)), start = e && Math.floor(e[0]) === i;
          const b = cell(i, e ? start ? ' on' : ' held' : '', !!e, e ? e[3] ?? .8 : 0);
          if (st.mode === 'steps') b.onclick = () => { core.toggleNote(k, e ? Math.floor(e[0]) : i, p); draw(); };
          row.appendChild(b);
        }
        wrap.appendChild(row);
      }
    }
    if (st.mode === 'draw') paintable(wrap);
    return wrap;
  }
  // draw: a finger down on a cell starts painting (or erasing, if it starts on something); each cell it passes is changed
  // in the playing loop at once, and only that cell redrawn until it lifts
  function paintable(wrap){
    const k = K(), at = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest && el.closest('.fst'); };
    const apply = b => {
      if (!b || st.drag.done.has(b)) return; st.drag.done.add(b);
      const i = +b.dataset.s, row = b.parentNode, c = core.clip(k);
      // (a row keeps its own length, so a polyrhythm stays one: a step past its end lands where the row goes round to)
      if (drums()) { const v = row.dataset.voice, L = core.loopOf(k), a = [...((c && c.hits ? rowStr(c.hits[v]) : '') || '.'.repeat(L.start + L.len))];
        a[i % a.length] = st.drag.erase ? '.' : '7'; core.setRow(k, v, a.join('')); b.classList.toggle('on', !st.drag.erase); b.style.setProperty('--v', .78);
        if (!st.drag.erase && !core.rec.on) core.hit(k, v, .7); return; }
      // a note: one at each step (the one under the finger), or none where erasing
      const p = +row.dataset.p, keep = ((c && c.notes) || []).filter(x => Math.floor(x[0]) !== i);
      core.setNotes(k, st.drag.erase ? keep : [...keep, [i, p, 1, .8]]);
      wrap.querySelectorAll(`.fst[data-s="${i}"]`).forEach(x => x.classList.remove('on', 'held')); if (!st.drag.erase) { b.classList.add('on'); b.style.setProperty('--v', .8); }
      // (heard as it's drawn, unless recording, which would write it twice)
      if (!st.drag.erase && !core.rec.on) core.noteOn(k, p, .7, 'draw').then(() => setTimeout(() => core.noteOff(k, 'draw'), 120));
    };
    wrap.onpointerdown = e => { const b = at(e); if (!b) return; e.preventDefault(); capture(wrap, e); st.drag = {erase: b.classList.contains('on'), done: new Set()}; apply(b); };
    wrap.onpointermove = e => { if (st.drag) apply(at(e)); };
    wrap.onpointerup = wrap.onpointercancel = () => { if (!st.drag) return; st.drag = null; if (st.stale) { st.stale = false; draw(); } };
  }

  /* ---------- euclid ---------- */
  // a ring of n steps with k hits turned by r, as a drum row: the first hit and those on the beat louder
  const euRow = (k, n, r) => euclid(k, n, r).map((x, i) => x ? (i === 0 || i % 4 === 0 ? '8' : '6') : '.').join('');
  // what a drum row is as a ring (from the editor's own settings if it made it, else its hits counted)
  function ringOf(v){ const k = K(), m = core.meta(k), eu = (m.eu || {})[v], s = rowStr(((core.clip(k) || {}).hits || {})[v]);
    if (eu && s === euRow(eu.k, eu.n, eu.r)) return eu;
    return {k: s ? [...s].filter(x => x !== '.' && x !== '-').length : 0, n: s ? s.length : 16, r: 0}; }
  function ring(eu, size = 64){
    const cv = h('canvas', 'euring'); cv.width = cv.height = size*2; cv.style.width = cv.style.height = size + 'px'; cv.eu = eu;
    cv.paintRing = (ph = -1) => { const g = cv.getContext('2d'), R = size*.8, c = getComputedStyle(box).getPropertyValue('--c').trim() || '#5cf', pat = euclid(eu.k, eu.n, eu.r);
      g.clearRect(0, 0, size*2, size*2); g.strokeStyle = '#1e2733'; g.lineWidth = 2; g.beginPath(); g.arc(size, size, R, 0, 2*Math.PI); g.stroke();
      pat.forEach((x, i) => { const a = -Math.PI/2 + 2*Math.PI*i/eu.n, px = size + R*Math.cos(a), py = size + R*Math.sin(a);
        g.fillStyle = i === ph ? '#fff' : x ? c : '#2a3443'; g.beginPath(); g.arc(px, py, i === ph ? 9 : x ? 8 : 4, 0, 2*Math.PI); g.fill(); }); };
    cv.paintRing(); return cv;
  }
  const stepper = (label, val, dn, up) => { const s = h('div', 'eust'); s.append(h('span', 'jlab', label), btn('−', 'sqn', dn), h('b', null, String(val)), btn('+', 'sqn', up)); return s; };
  function euDrums(){
    const k = K(), wrap = h('div', 'eu');
    for (const v of VOICES[k]) {
      const eu = ringOf(v), row = h('div', 'eurow'), put = x => { const m = core.meta(k); (m.eu = m.eu || {})[v] = x; core.setRow(k, v, x.k ? euRow(x.k, x.n, x.r) : ''); draw(); };
      const rg = ring(eu); rg.dataset.voice = v;
      row.append(h('b', 'eunm', vname(v)), rg,
        stepper('Hits', eu.k, () => put({...eu, k: Math.max(0, eu.k - 1)}), () => put({...eu, k: Math.min(eu.n, eu.k + 1)})),
        stepper('Steps', eu.n, () => put({...eu, n: Math.max(2, eu.n - 1), k: Math.min(eu.k, eu.n - 1)}), () => put({...eu, n: Math.min(32, eu.n + 1)})),
        stepper('Turn', eu.r, () => put({...eu, r: (eu.r - 1 + eu.n) % eu.n}), () => put({...eu, r: (eu.r + 1) % eu.n})));
      wrap.appendChild(row);
    }
    return wrap;
  }
  // a synth: one ring, and the notes it walks through (degrees of the key, in the order picked), up, down or as picked
  function euNotes(){
    const k = K(), m = core.meta(k), eu = m.eun || (m.eun = {k: 5, n: 16, r: 0, deg: [0, 4, 2], walk: 'picked', len: 1}), wrap = h('div', 'eu');
    const K0 = keyOf(core.song.key), base = baseOf(core, k, ctl.oct);
    const write = () => { const pat = euclid(eu.k, eu.n, eu.r), hits = pat.map((x, i) => x ? i : -1).filter(i => i >= 0);
      const order = eu.walk === 'up' ? [...eu.deg].sort((a, b) => a - b) : eu.walk === 'down' ? [...eu.deg].sort((a, b) => b - a) : eu.deg;
      const notes = hits.map((s, j) => { const gap = (hits[j + 1] ?? hits[0] + eu.n) - s; return [s, degNote(K0, base, order.length ? order[j % order.length] : 0), eu.len ? Math.max(1, gap - .2) : .5, s % 4 === 0 ? .9 : .7]; });
      core.setNotes(k, notes, eu.n); draw(); };
    const set = x => { Object.assign(eu, x); write(); };
    const row = h('div', 'eurow'), rg = ring(eu, 80); rg.dataset.voice = '*';
    row.append(rg, stepper('Hits', eu.k, () => set({k: Math.max(1, eu.k - 1)}), () => set({k: Math.min(eu.n, eu.k + 1)})),
      stepper('Steps', eu.n, () => set({n: Math.max(2, eu.n - 1), k: Math.min(eu.k, eu.n - 1)}), () => set({n: Math.min(32, eu.n + 1)})),
      stepper('Turn', eu.r, () => set({r: (eu.r - 1 + eu.n) % eu.n}), () => set({r: (eu.r + 1) % eu.n})));
    wrap.appendChild(row);
    // the notes: a chip a degree; a tap adds it to the walk (again: takes it out); their order is the walk's
    const chips = h('div', 'eudeg'); chips.appendChild(h('span', 'jlab', 'Notes'));
    for (let d = 0; d < 15; d++) { const i = eu.deg.indexOf(d), b = btn(`${noteName(degNote(K0, base, d))}${i >= 0 ? `<small>${i + 1}</small>` : ''}`, i >= 0 ? 'on' : '', () => set({deg: i >= 0 ? eu.deg.filter(x => x !== d) : [...eu.deg, d]}));
      if (d % 7 === 0) b.classList.add('root'); chips.appendChild(b); }
    const walk = h('div', 'jseg'); for (const [v, l] of [['picked', 'As picked'], ['up', 'Up'], ['down', 'Down']]) walk.appendChild(btn(l, eu.walk === v ? 'cur' : '', () => set({walk: v})));
    const lens = h('div', 'jseg'); for (const [v, l] of [[0, 'Short'], [1, 'Held']]) lens.appendChild(btn(l, eu.len === v ? 'cur' : '', () => set({len: v})));
    const opts = h('div', 'euopts'); opts.append(h('span', 'jlab', 'Walk'), walk, h('span', 'jlab', 'Notes'), lens, btn('Write it', 'sqn wide', write, 'Put this rhythm and these notes into the loop'));
    wrap.append(chips, opts);
    return wrap;
  }

  /* ---------- the playhead ---------- */
  let last = null;
  function frame(){
    const k = K(), x = core.lanePos(k), L = core.loopOf(k), abs = x ? L.start + x.s : -1;
    if (abs === last) return; last = abs;
    if (abs >= 0 && st.follow && st.mode !== 'euclid' && !st.drag) { const pg = Math.floor(abs/PAGE); if (pg !== st.page) { st.page = pg; draw(); } }
    const strip = box.querySelector('.sqstrip'); if (strip && strip.paintPh) strip.paintPh(abs);
    const g = box.querySelector('.fsteps');
    if (g) { g.querySelectorAll('.fst.ph').forEach(b => b.classList.remove('ph')); if (abs >= 0) g.querySelectorAll(`.fst[data-s="${abs}"]`).forEach(b => b.classList.add('ph')); }
    // the rings: each its own place (a drum ring of n steps going round inside the loop)
    box.querySelectorAll('.euring').forEach(cv => { const n = cv.eu.n; cv.paintRing(abs >= 0 ? abs % n : -1); });
  }
  return {refresh: () => { last = null; draw(); }, frame};
}
