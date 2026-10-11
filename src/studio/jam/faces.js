// Three ways to play the same jam, to find which feels right on an iPad. Each is mount(root, core, ctl) → {frame, refresh}:
// ctl.lane is the lane being played (the keys and pads below follow it), ctl.player(root) draws the playing area for it.
//  - grid: a launchpad. A row a part, a cell a take; the last cells New and Vary. Tap a cell to launch it on the bar.
//  - strips: a mixer of ideas. A tall strip a part: mute, New, Vary, its takes, its macros, its loop drawn.
//  - focus: one part big. Its loop as a grid of steps to tap, its pads or keys, its sound, its takes; the parts as tabs.
import { h, btn, hue, macroRow, takes, ideaButtons, mini, vname } from './kit.js';
import { VOICES, part } from './song.js';
import { mountSeq } from './seq.js';

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
      s.appendChild(macroRow(core, k, 6));
      box.appendChild(s);
    }
  }
  draw();
  return {refresh: draw, frame(){
    for (const p of core.PARTS) { const cv = cvs[p.key], x = core.lanePos(p.key); if (!cv) continue; cv.parentNode.style.setProperty('--ph', x ? (x.s/x.len*100).toFixed(1) + '%' : '-10%'); }
  }};
}

/* ---------- focus ---------- */
// one part big: its tabs, its takes and ideas, then its loop in the sequencer (jam/seq.js: the loop bar, steps, draw, euclid)
export function focus(root, core, ctl){
  const box = h('div', 'face-focus'); root.appendChild(box);
  const head = h('div'), body = h('div', 'fseq'); box.append(head, body);
  const seq = mountSeq(body, core, ctl);
  function draw(){
    head.innerHTML = '';
    const tabs = h('div', 'ftabs');
    for (const p of core.PARTS) { const l = core.lane(p.key), b = btn(`${p.label}${l.mute ? ' <small>muted</small>' : ''}`, 'ftab' + (p.key === ctl.lane ? ' cur' : '') + (l.mute ? ' muted' : ''), () => ctl.select(p.key));
      b.style.setProperty('--c', hue(p.key)); tabs.appendChild(b); }
    const k = ctl.lane, l = core.lane(k); box.style.setProperty('--c', hue(k));
    const top = h('div', 'ftop');
    top.append(btn(l.mute ? 'Muted' : 'Playing', 'smute' + (l.mute ? '' : ' on'), () => core.mute(k)), btn('Solo', 'ssolo', () => core.solo(k)), ideaButtons(core, k), takes(core, k));
    head.append(tabs, top);
    seq.refresh();
  }
  draw();
  return {refresh: draw, frame: seq.frame};
}

export const FACES = {grid: {label: 'Grid', words: 'a launchpad: a row a part, a cell an idea', mount: grid},
  strips: {label: 'Strips', words: 'a strip a part, with its knobs', mount: strips},
  focus: {label: 'Focus', words: 'one part big: its steps, pads or keys', mount: focus}};
