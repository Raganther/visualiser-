// The jam's controls, made for fingers: macro bars (drag anywhere on one, sideways), drum pads (hit harder at the top),
// an in-key keyboard (Push's layout: each row a fourth above the last, so every chord shape is the same everywhere and
// no note is wrong), the takes strip and the synth's full face behind More. Every face builds from these, so they all
// feel alike.
import { keyOf } from '../improv.js';
import { noteName } from '../song.js';
import { VOICES, part } from './song.js';

export const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const btn = (label, cls, fn, title) => { const b = h('button', cls, label); if (title) b.title = title; b.onclick = e => { e.preventDefault(); fn(e); }; return b; };
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (x) {} };
const VNAME = {kick: 'Kick', snare: 'Snare', clap: 'Clap', tomL: 'Tom', chh: 'Closed', ohh: 'Open', ride: 'Ride', crash: 'Crash', rim: 'Rim', clave: 'Clave', shaker: 'Shaker', cow: 'Cowbell'};
export const vname = v => VNAME[v] || v;
export const hue = k => `hsl(${part(k).hue} 80% 60%)`;

// a bar to drag: value 0..1, its label and value inside; a drag moves it from where it was (not a jump to the finger)
export function bar(label, get, set, {fmt = x => Math.round(x*100) + '%', cls = ''} = {}){
  const el = h('div', 'mbar ' + cls), fill = h('i'), txt = h('span', null, label), val = h('b');
  el.append(fill, txt, val);
  const show = () => { const x = get(); fill.style.width = (x*100).toFixed(1) + '%'; val.textContent = fmt(x); };
  let from = null;
  el.onpointerdown = e => { e.preventDefault(); capture(el, e); from = {x: e.clientX, v: get()}; el.classList.add('on'); };
  el.onpointermove = e => { if (!from) return; const w = el.getBoundingClientRect().width; set(Math.max(0, Math.min(1, from.v + (e.clientX - from.x)/w))); show(); };
  el.onpointerup = el.onpointercancel = () => { from = null; el.classList.remove('on'); };
  el.ondblclick = () => {};
  el.show = show; show(); return el;
}

// the macros of a lane: its few knobs, as bars
export function macroRow(core, k){
  const row = h('div', 'macros');
  core.macros(k).forEach((m, i) => { const b = bar(m.label, () => core.macro(k, i), x => core.setMacro(k, i, x)); b.title = m.words; row.appendChild(b); });
  row.refresh = () => row.querySelectorAll('.mbar').forEach(b => b.show());
  return row;
}

// the drum pads of a lane: hit harder at the top of a pad
export function pads(core, k, {big = false} = {}){
  const box = h('div', 'jpads' + (big ? ' big' : ''));
  for (const v of VOICES[k]) {
    const p = h('button', 'jpad', `<span>${vname(v)}</span>`); p.dataset.v = v;
    p.onpointerdown = e => { e.preventDefault(); const r = p.getBoundingClientRect(), vel = Math.max(.3, Math.min(1, 1.15 - (e.clientY - r.top)/r.height*.8));
      p.classList.add('hit'); setTimeout(() => p.classList.remove('hit'), 110); core.hit(k, v, vel); };
    box.appendChild(p);
  }
  return box;
}

// where a lane's notes sit: the bass low, the chords in the middle, the hook above
export const baseOf = (core, k, oct = 0) => { const K = keyOf(core.song.key); return (part(k).low ? 24 : k === 'chords' ? 48 : 60) + K.root + (part(k).low && K.root < 2 ? 12 : 0) + 12*oct; };
export const degNote = (K, base, d) => base + K.scale[((d % 7) + 7) % 7] + 12*Math.floor(d/7);

// the in-key keyboard: cols × rows of the scale, each row three degrees (a fourth) above the one below, the roots lit;
// a finger held plays, sliding moves the note; chord: each pad plays a triad on its degree
export function keys(core, k, st){
  const K = keyOf(core.song.key), base = baseOf(core, k, st.oct), cols = st.cols || 8, rows = st.rows || 4;
  const box = h('div', 'keys'); box.style.setProperty('--cols', cols);
  for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < cols; c++) {
    const d = r*3 + c, n = degNote(K, base, d), b = h('button', 'key' + (((d % 7) + 7) % 7 === 0 ? ' root' : ''), `<span>${noteName(n)}</span>`);
    b.dataset.d = d; box.appendChild(b);
  }
  const held = new Map();
  const at = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest && el.closest('.key'); };
  const notes = d => st.chord ? [0, 2, 4].map(i => degNote(K, base, d + i)) : [degNote(K, base, d)];
  const vel = (el, e) => { const r = el.getBoundingClientRect(); return Math.max(.35, Math.min(1, 1.1 - (e.clientY - r.top)/r.height*.6)); };
  const press = (id, el, e) => { const ns = notes(+el.dataset.d), v = vel(el, e); el.classList.add('hit'); held.set(id, {el, ns}); ns.forEach((n, i) => core.noteOn(k, n, v, id + ':' + i)); };
  const lift = id => { const x = held.get(id); if (!x) return; held.delete(id); x.el.classList.remove('hit'); x.ns.forEach((n, i) => core.noteOff(k, id + ':' + i)); };
  box.onpointerdown = e => { const el = at(e); if (!el) return; e.preventDefault(); capture(box, e); press(e.pointerId, el, e); };
  box.onpointermove = e => { const x = held.get(e.pointerId); if (!x) return; const el = at(e); if (el && el !== x.el) { lift(e.pointerId); press(e.pointerId, el, e); } };
  box.onpointerup = box.onpointercancel = e => lift(e.pointerId);
  return box;
}

// the takes: every idea the lane has had, the one playing lit; Undo goes to the one before
export function takes(core, k){
  const box = h('div', 'takes'), l = core.lane(k);
  box.appendChild(btn('↶', 'undo', () => core.step(k, -1), 'The take before'));
  const strip = h('div', 'tk');
  l.takes.forEach((id, i) => { const b = btn(String(i + 1), id === l.take ? 'cur' : '', () => core.pick(k, id)); b.dataset.id = id; strip.appendChild(b); });
  if (!l.takes.length) strip.appendChild(h('span', 'none', 'no takes yet'));
  box.appendChild(strip); box.appendChild(btn('↷', 'redo', () => core.step(k, 1), 'The take after'));
  requestAnimationFrame(() => { const c = strip.querySelector('.cur'); if (c) strip.scrollLeft = c.offsetLeft - strip.clientWidth/2; });
  return box;
}

// More: the instrument's whole face in its groups (each collapsible), and its presets (a drum lane: its kit and voices)
export function more(core, k){
  const box = h('details', 'more'), sum = h('summary', null, 'More sound…'); box.appendChild(sum);
  const body = h('div', 'face'); box.appendChild(body);
  box.ontoggle = () => { if (box.open && !body.childElementCount) fill(); };
  function fill(){
    const ps = core.presets(k), sel = h('select', 'preset'); for (const p of ps) { const o = h('option', null, p); o.value = p; o.selected = p === core.presetOf(k); sel.appendChild(o); }
    sel.onchange = () => core.preset(k, sel.value).then(() => { body.innerHTML = ''; fill(); });
    const top = h('label', 'pl', core.song.tracks.find(t => t.id === k).inst.type === 'drums' ? 'Kit ' : 'Preset '); top.appendChild(sel); body.appendChild(top);
    body.appendChild(bar('Volume', () => (core.vol(k) + 40)/46, x => core.setVol(k, Math.round((x*46 - 40)*2)/2), {fmt: x => (x*46 - 40).toFixed(1) + ' dB', cls: 'vol'}));
    if (VOICES[k]) { for (const v of VOICES[k]) body.appendChild(group(vname(v), [{key: v + '.tune', label: 'Tune', min: -12, max: 12, unit: 'st'}, {key: v + '.decay', label: 'Decay', min: .25, max: 4, log: true, unit: '×'},
      {key: v + '.tone', label: 'Tone', min: 0, max: 1, unit: '%'}, {key: v + '.level', label: 'Level', min: 0, max: 1.5, unit: '×'}])); return; }
    for (const [name, list] of core.groups(k)) body.appendChild(group(name, list));
  }
  function group(name, list){
    const d = h('details', 'grp'), s = h('summary', null, name), g = h('div', 'grid'); d.append(s, g);
    for (const p of list) {
      if (p.list) { const sel = h('select'), v = core.get(k, p.key); p.list.forEach((x, i) => { const o = h('option', null, x); o.value = i; o.selected = v === i || v === x; sel.appendChild(o); });
        sel.onchange = () => core.set(k, p.key, +sel.value); const l = h('label', 'sw', p.label + ' '); l.appendChild(sel); g.appendChild(l); continue; }
      const to = x => p.log ? p.min*Math.pow(p.max/p.min, x) : p.min + (p.max - p.min)*x, fro = v => v == null ? .5 : p.log ? Math.log(v/p.min)/Math.log(p.max/p.min) : (v - p.min)/(p.max - p.min);
      const fmt = x => { const v = to(x); return p.unit === '%' ? Math.round(v*100) + '%' : p.unit === 'Hz' ? (v >= 1000 ? (v/1000).toFixed(1) + 'k' : Math.round(v)) + ' Hz' : (Math.abs(v) < 10 ? v.toFixed(2) : Math.round(v)) + (p.unit && p.unit !== '%' ? ' ' + p.unit : ''); };
      g.appendChild(bar(p.label, () => Math.max(0, Math.min(1, fro(core.get(k, p.key)))), x => core.set(k, p.key, p.step ? Math.round(to(x)/p.step)*p.step : to(x)), {fmt}));
    }
    return d;
  }
  return box;
}

// what a lane's idea buttons do, the same in every face
export function ideaButtons(core, k){
  const row = h('div', 'ideas');
  row.append(btn('New', 'new', () => core.fresh(k), 'A new idea for this part, fitted to the rest'),
    btn('Vary', 'vary', () => core.vary(k), 'A variation on this take'),
    btn('×2', 'dbl', () => core.length(k, 2), 'The loop twice as long, to change its second half'),
    btn('Clear', 'clr', () => core.clear(k), 'An empty take (the last one stays in the takes)'));
  return row;
}

// a lane's loop as a small picture: its hits or notes over its length, the playhead drawn by the face
export function mini(core, k, clip, cv){
  const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H); if (!clip) return;
  const ev = [];
  const len = clip.steps || (clip.bars || 1)*16;
  for (const [v, r] of Object.entries(clip.hits || {})) { const s = (typeof r === 'string' ? r : r.p).replace(/[\s|]/g, ''), vi = (VOICES[k] || []).indexOf(v);
    for (let o = 0; o < len; o += s.length || len) for (let i = 0; i < s.length && o + i < len; i++) if (/[^.\-]/.test(s[i])) ev.push({s: o + i, y: (vi + .5)/4, a: /[1-9]/.test(s[i]) ? +s[i]/9 : .8, w: 1}); }
  const ns = (clip.notes || []).flatMap(e => [].concat(e[1]).map(p => ({s: e[0], p: typeof p === 'number' ? p : 60, l: e[2] || 1, v: e[3] ?? .8})));
  if (ns.length) { const lo = Math.min(...ns.map(n => n.p)) - 1, hi = Math.max(...ns.map(n => n.p)) + 1; for (const n of ns) ev.push({s: n.s, y: 1 - (n.p - lo)/(hi - lo), a: n.v, w: n.l}); }
  g.fillStyle = hue(k);
  for (const e of ev) { g.globalAlpha = .35 + .65*e.a; g.fillRect(e.s/len*W, e.y*H - 3, Math.max(2, e.w/len*W - 1), 6); }
  g.globalAlpha = 1;
}
