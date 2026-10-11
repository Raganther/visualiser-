// Three ways to play the same jam, to find which feels right on an iPad. Each is mount(root, core, ctl) → {frame, refresh}:
// ctl.lane is the lane being played (the keys and pads below follow it), ctl.player(root) draws the playing area for it.
//  - grid: a launchpad. A row a part, a cell a take; the last cells New and Vary. Tap a cell to launch it on the bar.
//  - strips: a mixer of ideas. A tall strip a part: mute, New, Vary, its takes, its macros, its loop drawn.
//  - focus: one part big. Its loop as a grid of steps to tap, its pads or keys, its sound, its takes; the parts as tabs.
import { h, btn, hue, macroRow, takes, ideaButtons, mini, vname } from './kit.js';
import { VOICES, part } from './song.js';
import { keyOf } from '../improv.js';
import { noteName, readClip } from '../song.js';
import { baseOf, degNote } from './kit.js';

/* ---------- grid ---------- */
const COLS = 8;
export function grid(root, core, ctl){
  const box = h('div', 'face-grid'); root.appendChild(box);
  function draw(){
    box.innerHTML = '';
    for (const p of core.PARTS) {
      const k = p.key, l = core.lane(k), row = h('div', 'grow' + (ctl.lane === k ? ' sel' : '') + (l.mute ? ' muted' : '')); row.style.setProperty('--c', hue(k));
      const head = btn(`<b>${p.label}</b><small>${l.mute ? 'muted' : l.take ? 'take ' + (l.takes.indexOf(l.take) + 1) : 'empty'}</small>`, 'ghead', () => { ctl.select(k); });
      const m = btn(l.mute ? 'Off' : 'On', 'gmute' + (l.mute ? '' : ' on'), () => core.mute(k), 'Mute or bring back');
      row.append(m, head);
      // the latest takes, newest at the right, as far as the row holds
      const shown = l.takes.slice(-COLS + 2), cells = h('div', 'gcells');
      for (let i = 0; i < COLS - 2; i++) {
        const id = shown[i];
        if (!id) { cells.appendChild(h('div', 'gcell blank')); continue; }
        const c = h('button', 'gcell' + (id === l.take ? ' cur' : '')), cv = h('canvas'); cv.width = 120; cv.height = 48; c.appendChild(cv); c.dataset.id = id;
        c.appendChild(h('small', null, String(l.takes.indexOf(id) + 1)));
        c.onclick = () => { ctl.select(k, false); if (id === l.take && !l.mute) core.mute(k, true); else { if (l.mute) core.mute(k, false); core.pick(k, id); } };
        cells.appendChild(c); mini(core, k, core.song.tracks.find(t => t.id === k).clips[id], cv);
      }
      cells.append(btn('＋<small>New</small>', 'gcell gen', () => { ctl.select(k, false); core.fresh(k); }), btn('≈<small>Vary</small>', 'gcell gen', () => { ctl.select(k, false); core.vary(k); }));
      row.appendChild(cells); box.appendChild(row);
    }
  }
  draw();
  return {refresh: draw, frame(){
    for (const row of box.children) { const k = core.PARTS[[...box.children].indexOf(row)].key, p = core.lanePos(k), cur = row.querySelector('.gcell.cur');
      if (cur) cur.style.setProperty('--ph', p ? (p.s/p.len*100).toFixed(1) + '%' : '-10%'); }
  }};
}

/* ---------- strips ---------- */
export function strips(root, core, ctl){
  const box = h('div', 'face-strips'); root.appendChild(box);
  const cvs = {};
  function draw(){
    box.innerHTML = '';
    for (const p of core.PARTS) {
      const k = p.key, l = core.lane(k), s = h('div', 'jstrip' + (ctl.lane === k ? ' sel' : '') + (l.mute ? ' muted' : '')); s.style.setProperty('--c', hue(k));
      s.appendChild(btn(`<b>${p.label}</b>`, 'shead', () => ctl.select(k)));
      const cv = h('canvas', 'sloop'), slw = h('div', 'slw'); cv.width = 200; cv.height = 60; slw.appendChild(cv); s.appendChild(slw); cvs[k] = cv; mini(core, k, core.clip(k), cv);
      const ms = h('div', 'ideas'); ms.append(btn(l.mute ? 'Muted' : 'Playing', 'smute' + (l.mute ? '' : ' on'), () => core.mute(k)), btn('Solo', 'ssolo', () => core.solo(k))); s.appendChild(ms);
      s.appendChild(ideaButtons(core, k));
      s.appendChild(takes(core, k));
      s.appendChild(macroRow(core, k));
      box.appendChild(s);
    }
  }
  draw();
  return {refresh: draw, frame(){
    for (const p of core.PARTS) { const cv = cvs[p.key], x = core.lanePos(p.key); if (!cv) continue; cv.parentNode.style.setProperty('--ph', x ? (x.s/x.len*100).toFixed(1) + '%' : '-10%'); }
  }};
}

/* ---------- focus ---------- */
export function focus(root, core, ctl){
  const box = h('div', 'face-focus'); root.appendChild(box);
  let page = 0;
  function draw(){
    box.innerHTML = '';
    const tabs = h('div', 'ftabs');
    for (const p of core.PARTS) { const l = core.lane(p.key), b = btn(`${p.label}${l.mute ? ' <small>muted</small>' : ''}`, 'ftab' + (p.key === ctl.lane ? ' cur' : '') + (l.mute ? ' muted' : ''), () => { ctl.select(p.key); page = 0; });
      b.style.setProperty('--c', hue(p.key)); tabs.appendChild(b); }
    box.appendChild(tabs);
    const k = ctl.lane, l = core.lane(k); box.style.setProperty('--c', hue(k));
    const top = h('div', 'ftop');
    top.append(btn(l.mute ? 'Muted' : 'Playing', 'smute' + (l.mute ? '' : ' on'), () => core.mute(k)), btn('Solo', 'ssolo', () => core.solo(k)), ideaButtons(core, k), takes(core, k));
    box.appendChild(top);
    box.appendChild(stepGrid(k));
  }
  // the loop as steps: a row a drum (tap: on, louder, off), or a row a note of the scale (tap: on or off); 32 at a time
  function stepGrid(k){
    const c = core.clip(k), len = c ? readClip(c).len : 32, pages = Math.ceil(len/32); page = Math.min(page, pages - 1);
    const from = page*32, n = Math.min(32, len - from), wrap = h('div', 'fsteps'); wrap.style.setProperty('--n', n);
    if (pages > 1) { const pg = h('div', 'fpage'); for (let i = 0; i < pages; i++) pg.appendChild(btn(`${i*32 + 1}–${Math.min(len, i*32 + 32)}`, i === page ? 'cur' : '', () => { page = i; draw(); })); wrap.appendChild(pg); }
    const drums = part(k).kind === 'drums';
    if (drums) for (const v of VOICES[k]) {
      const r = c && c.hits && c.hits[v], s = r ? (typeof r === 'string' ? r : r.p).replace(/[\s|]/g, '') : '', row = h('div', 'frow');
      row.appendChild(h('span', 'flab', vname(v)));
      for (let i = from; i < from + n; i++) { const ch = s ? s[i % s.length] : '.', on = ch && ch !== '.' && ch !== '-', vv = /[1-9]/.test(ch) ? +ch/9 : ch === 'X' ? 1 : .8;
        const b = h('button', 'fst' + (on ? ' on' : '') + (i % 4 === 0 ? ' beat' : '')); if (on) b.style.setProperty('--v', vv); b.dataset.s = i;
        b.onclick = () => { core.toggleStep(k, i, v); draw(); }; row.appendChild(b); }
      wrap.appendChild(row);
    }
    else {
      const K = keyOf(core.song.key), base = baseOf(core, k, ctl.oct), notes = (c && c.notes) || [];
      // (the rows: the scale's notes round the ones the loop plays, ten at least, the root of the keys at the bottom)
      const degOf = p => { for (let d = -14; d < 28; d++) if (degNote(K, base, d) === p) return d; return null; };
      const ds = notes.flatMap(e => [].concat(e[1])).map(degOf).filter(d => d != null), lo = Math.min(0, ...ds.map(d => d - 1)), hi = Math.max(lo + 9, ...ds.map(d => d + 1));
      for (let d = hi; d >= lo; d--) {
        const p = degNote(K, base, d), row = h('div', 'frow' + (((d % 7) + 7) % 7 === 0 ? ' root' : ''));
        row.appendChild(h('span', 'flab', noteName(p)));
        for (let i = from; i < from + n; i++) {
          const e = notes.find(x => [].concat(x[1]).includes(p) && i >= Math.floor(x[0]) && i < x[0] + Math.max(1, x[2] || 1)), start = e && Math.floor(e[0]) === i;
          const b = h('button', 'fst' + (e ? start ? ' on' : ' held' : '') + (i % 4 === 0 ? ' beat' : '')); if (e) b.style.setProperty('--v', e[3] ?? .8); b.dataset.s = i;
          b.onclick = () => { core.toggleNote(k, e ? Math.floor(e[0]) : i, p); draw(); }; row.appendChild(b);
        }
        wrap.appendChild(row);
      }
    }
    wrap.dataset.from = from;
    return wrap;
  }
  draw();
  let last = -1;
  return {refresh: draw, frame(){
    const x = core.lanePos(ctl.lane), g = box.querySelector('.fsteps'); if (!g) return;
    const s = x ? x.s - +g.dataset.from : -1; if (s === last) return; last = s;
    g.querySelectorAll('.fst.ph').forEach(b => b.classList.remove('ph'));
    if (s >= 0) g.querySelectorAll(`.fst[data-s="${x.s}"]`).forEach(b => b.classList.add('ph'));
  }};
}

export const FACES = {grid: {label: 'Grid', words: 'a launchpad: a row a part, a cell an idea', mount: grid},
  strips: {label: 'Strips', words: 'a strip a part, with its knobs', mount: strips},
  focus: {label: 'Focus', words: 'one part big: its steps, pads or keys', mount: focus}};
