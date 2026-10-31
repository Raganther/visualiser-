// A sequencer row, the same wherever a part is shown as a line of steps (the DAW's Clip tab, the whole scene, the Scene
// view; any page that has parts): its name, ‹ › through the library's rhythms, up to 64 steps (a click a hit, Shift-click
// an accent), its length, and on a wide row Vary, Life and Feel; then mute and take out. It only draws and reports:
// what a click does is the page's (`on`), so the row plugs into any model. Its styles come with it (rowStyles).
import { h } from '../dom.js';
import { partName, PART_NAMES } from '../names.js';

// a line of steps: len steps of a rhythm, in a grid W wide (so rows of different lengths line up), lit by hit and accent
export function stepCells(R, W, onStep, title = ''){ const hits = new Map(R.hits.map(x => [x[0], x]));
  const cells = h('div', {class: 'pcells', style: `grid-template-columns: repeat(${W}, 1fr)`, title, onclick: onStep ? e => { const s = e.target.dataset?.s; if (s != null) onStep(+s, e.shiftKey); } : null});
  for (let s = 0; s < R.len; s++) { const x = hits.get(s); cells.append(h('i', {'data-s': s, 'data-on': x ? (x[2] > .8 ? '2' : '1') : '', 'data-beat': s % 4 === 0 ? '1' : ''})); }
  return cells; }
// one part's row. o: {W, sel, wide, track (data-t), index (data-j), canRemove, life, feel (names of the part's settings),
// on: {pick, step(s, accent), lib(d), vary, life, feel, mute, remove}}
export function seqRow(q, o){ const on = o.on || {}, nm = partName(q), kind = PART_NAMES[q.role] || q.role;
  const row = h('div', {class: o.wide ? 'prow wide' : 'prow', 'data-t': o.track, 'data-j': o.index, 'data-sel': o.sel ? '1' : '', 'data-mute': q.mute ? '1' : ''});
  row.append(h('button', {class: 'pname', title: `Choose ${nm}: its notes and tools below`, onclick: on.pick}, nm),
    h('button', {class: 'pv', 'aria-label': 'The library’s rhythm before', title: `The library’s ${kind} rhythms`, onclick: () => on.lib?.(-1)}, '‹'),
    h('button', {class: 'pv', 'aria-label': 'The library’s next rhythm', title: `The library’s ${kind} rhythms`, onclick: () => on.lib?.(1)}, '›'),
    stepCells(q.R, o.W, on.step, `${nm}: click a step for a hit, Shift-click an accent`), h('span', {class: 'plen small muted', title: 'Its length in steps'}, String(q.R.len)),
    ...(o.wide ? [h('button', {class: 'pq', title: 'Vary its rhythm (V)', onclick: on.vary}, 'Vary'),
      h('button', {class: 'pq', title: 'Life: how much it improvises each time round (P cycles)', 'data-on': q.play ? '1' : '', onclick: on.life}, `Life · ${o.life}`),
      h('button', {class: 'pq', title: 'Feel: how it sits in the groove (F cycles)', 'data-on': q.R.feel ? '1' : '', onclick: on.feel}, o.feel)] : []),
    h('button', {class: 'pm', 'aria-pressed': String(!!q.mute), title: q.mute ? 'Unmute this part' : 'Mute this part', onclick: on.mute}, 'M'),
    o.canRemove ? h('button', {class: 'px', title: `Take ${nm} out of the clip`, onclick: on.remove}, '✕') : h('span'));
  return row; }
// a row that isn't a part (a notes clip's hits, an empty slot): a name button, then whatever it shows
export const plainRow = (o, ...kids) => h('div', {class: (o.wide ? 'prow wide' : 'prow') + (o.empty ? ' empty' : ''), 'data-t': o.track, 'data-sel': o.sel ? '1' : ''}, ...kids);
// the playhead on a row: the step heard lit (-1: none)
export function lightRow(row, s){ row.querySelectorAll('.pcells [data-s]').forEach(x => { const on = +x.dataset.s === s ? '1' : ''; if (x.dataset.now !== on) x.dataset.now = on; }); }

// the row's styles, added to the page once (its colours from the page's --acc and --mono)
export const ROW_CSS = `.prow{display:grid; grid-template-columns:104px 22px 22px 1fr 26px 26px 24px; gap:6px; align-items:center; border-radius:6px; padding:2px 4px}
.prow[data-sel="1"]{background:#2a2f37; box-shadow:inset 3px 0 0 var(--acc)} .prow[data-mute="1"] .pcells{opacity:.3}
.prow .pname{min-height:26px; padding:0 8px; text-align:left; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis} .prow[data-sel="1"] .pname{color:var(--acc); border-color:var(--acc)}
.prow .pv{min-height:24px; min-width:22px; padding:0; font-size:13px} .prow .pm,.prow .px{min-height:24px; min-width:24px; padding:0; font-size:11px} .prow .pm[aria-pressed="true"]{background:#3b82c4; border-color:#3b82c4; color:#fff}
.pcells{display:grid; gap:2px; cursor:pointer} .pcells i{height:22px; border-radius:3px; background:#15171b} .pcells i[data-beat="1"]{background:#20242b} .pcells i:hover{outline:1px solid #5a606b}
.pcells i[data-on="1"]{background:var(--acc); opacity:.7} .pcells i[data-on="2"]{background:var(--acc)} .pcells i[data-now="1"]{box-shadow:inset 0 0 0 2px #fff} .pcells i[data-now="1"][data-on]:not([data-on=""]){background:#fff; opacity:1}
.plen{text-align:right; font-family:var(--mono)} .prow.empty .pname{color:var(--mute)}
.prow.wide{grid-template-columns:104px 22px 22px 1fr 26px 50px 92px 96px 26px 24px} .prow .pq{min-height:24px; padding:0 6px; font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis} .prow .pq[data-on="1"]{color:var(--acc); border-color:#5a4a2a}`;
export function rowStyles(doc = document){ if (doc.getElementById('seq-row-css')) return; doc.head.append(Object.assign(doc.createElement('style'), {id: 'seq-row-css', textContent: ROW_CSS})); }
