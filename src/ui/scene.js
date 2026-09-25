// The scene editor in the Adjust panel: the stack, bottom to top, one row per entry, each saying what it is, where it
// sits (move it up or down, mask it, fill an object's glass) and what drives it (its weight can follow any signal).
// In Journey it shows the scene Journey is composing; by hand you can compose from a template or edit the stack.
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { DEFAULT_SCENE } from '../scene/graph.js';
import { SIGNALS } from '../scene/signals.js';
import { TEMPLATES, fits } from '../scene/templates.js';
import { curP } from '../presets.js';
import { LAYER_VISUALS, OBJECT_VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { toast } from './toast.js';
import { $ } from '../util.js';

const WORDS = {plain: 'Plain: everything in its usual place', between: 'Between: the glow behind the world\'s front',
  split: 'Split: one layer behind the world\'s front, one in front', among: 'Among: an object between the world\'s planes',
  reflect: 'Reflect: the world in an object\'s glass', inside: 'Inside: a kaleidoscope in an object, the glow kept out',
  window: 'Window: the glow seen only through an object', glass: 'Glass: one layer seen only in an object\'s glass'};
const DRIVES = SIGNALS.filter(([k]) => k !== 'drift' && k !== 'jump');   // drift and jump belong to the movers
const FOLDED = ['plasma', 'ring', 'burst', 'scope'];
const FILLS = {none: 'Glass: its own', kaleido: 'Glass: a kaleidoscope', world: 'Glass: the world', tunnel: 'Glass: the mirror tunnel',
  eyes: 'Glass: the tunnel in its eyes', comets: 'Glass: comets, seen only there'};
const fillOf = k => ({kaleido: {layers: FOLDED, fold: 6}, world: {world: true}, tunnel: {layers: ['tunnel'], fold: 1},
  eyes: {layers: ['tunnel'], part: 7, zoom: 1.5}, comets: {trails: 'inner', layers: ['comets']}})[k];
const fillKey = f => !f ? 'none' : f.world ? 'world' : f.trails ? 'comets' : f.part ? 'eyes' : f.layers && f.layers.includes('tunnel') ? 'tunnel' : 'kaleido';
const opt = (v, l, sel) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`;
const name = k => (byKey[k] && byKey[k].label) || k;

// what the hand-made look has on screen: its strongest world, layers and object
function castNow(){
  const top = (list, min) => list.map(v => v.key).filter(k => curP[k] > min).sort((a, b) => curP[b] - curP[a]);
  const ls = top(LAYER_VISUALS.filter(v => !v.optIn), .05);
  return {world: top(WORLD_VISUALS, .3)[0] || 'none', lead: ls[0] || null, accent: ls[1] || null, centre: top(OBJECT_VISUALS, .3)[0] || null, label: name};
}
function label(e){
  if (e.world) return e.world === 'front' ? 'The world\'s front' : 'The world';
  if (e.trails) return e.trails === 'main' ? 'Trails' : `Trails: ${(e.layers || []).map(name).join(', ') || 'none'}`;
  if (e.hits) return 'Hits';
  if (e.objects) return 'Objects';
  return name(e.object);
}
const cur = () => S.scene || DEFAULT_SCENE;
function set(scene){ S.scene = scene; if (S.active) S.active.scene = scene; render(); }   // a new array each edit, so its plan is rebuilt
function edit(i, fn){ const sc = cur().map(e => ({...e})); fn(sc, sc[i]); set(sc); }

let shown = null, shownOn = null;
// redraw when the scene changes (Journey's, or a preset's); main.js calls this now and then while the panel is open
export function refreshScene(){ const sc = J.on ? J.sceneLive || DEFAULT_SCENE : cur(); if (sc !== shown || J.on !== shownOn) render(); }
export function render(){
  const el = $('#scStack'); if (!el) return;
  const live = J.on, sc = live ? J.sceneLive || DEFAULT_SCENE : cur();
  shown = sc; shownOn = live;
  $('#scTpl').disabled = live; $('#scAdd').disabled = live;
  $('#scNote').textContent = live ? 'Journey is composing the scene (below, bottom to top). Leave Journey (A) to edit it by hand.'
    : 'Top to bottom. Move entries to put things behind or in front; mask the trails with a shape; fill an object\'s glass.';
  const objs = OBJECT_VISUALS.map(v => v.key).filter(k => (live ? J.centre === k : curP[k] > .01) || sc.some(e => e.object === k));   // the objects in play
  el.innerHTML = sc.map((e, i) => {
    let extra = '';
    if (e.trails) {
      const m = e.mask ? (e.mask.world ? 'front' : e.mask.object) + ':' + (e.mask.keep || 'inside') : 'none';
      extra += `<select data-k="mask" aria-label="Mask">${opt('none', 'Shown: everywhere', m)}${['inside', 'outside'].map(k =>
        opt('front:' + k, `Shown: ${k === 'inside' ? 'only on' : 'not on'} the world's front`, m)
        + objs.map(o => opt(o + ':' + k, `Shown: only ${k} the ${name(o).toLowerCase()}`, m)).join('')).join('')}</select>`;
      if (e.trails !== 'main') extra += `<select data-k="layer" aria-label="Layer">${LAYER_VISUALS.filter(v => !v.optIn).map(v => opt(v.key, 'Holds: ' + v.label.toLowerCase(), (e.layers || [])[0])).join('')}</select>`;
    }
    if (e.object) extra += `<select data-k="fill" aria-label="Its glass">${Object.entries(FILLS).map(([k, l]) => opt(k, l, fillKey(e.fill))).join('')}</select>`;
    if (e.trails || e.world) extra += `<select data-k="drive" aria-label="Driven by">${opt('none', 'Weight: steady', e.drive ? e.drive.src : 'none')}${DRIVES.map(([k, l]) => opt(k, 'Weight: ' + l.toLowerCase(), e.drive && e.drive.src)).join('')}</select>`;
    return `<li data-i="${i}"><span>${label(e)}</span>${live ? '' : `<span class="acts"><button data-a="up" aria-label="Move up">↑</button><button data-a="down" aria-label="Move down">↓</button><button data-a="del" aria-label="Remove">✕</button></span>`}${extra}</li>`;
  }).reverse().join('');   // listed top first
  el.querySelectorAll('select').forEach(s => s.disabled = live);
}
function init(){
  if (!$('#scStack')) return;
  $('#scTpl').innerHTML = TEMPLATES.map(t => opt(t.key, WORDS[t.key] || t.key)).join('');
  $('#scAdd').innerHTML = opt('', 'Add to the top…') + opt('world', 'The world') + opt('front', 'The world\'s front') + opt('trails', 'Trails')
    + opt('group', 'A second trail group') + opt('hits', 'Hits') + OBJECT_VISUALS.map(v => opt('o:' + v.key, v.label)).join('');
  // compose from a template, using what's on screen; a template that needs a world or an object brings one in
  $('#scTpl').addEventListener('change', e => {
    const t = TEMPLATES.find(x => x.key === e.target.value); let c = castNow();
    if (t.needs.world && c.world === 'none') { S.active.city = 1; c = {...c, world: 'city'}; }
    if (t.needs.centre && !c.centre) { S.active.skull = 1; c = {...c, centre: 'skull'}; }
    if (t.needs.accent && !c.accent) { const a = c.lead === 'comets' ? 'ring' : 'comets'; S.active[a] = .8; c = {...c, accent: a}; }
    if (!fits(t, c)) { toast('That needs no world: the world is set to none'); WORLD_VISUALS.forEach(v => S.active[v.key] = 0); c = {...c, world: 'none'}; }
    set(t.build(c) || DEFAULT_SCENE.map(x => ({...x})));
  });
  $('#scAdd').addEventListener('change', e => {
    const v = e.target.value; e.target.value = ''; if (!v) return;
    const add = v === 'world' ? {world: 'all'} : v === 'front' ? {world: 'front'} : v === 'trails' ? {trails: 'main'} : v === 'group' ? {trails: 'back', layers: ['comets']}
      : v === 'hits' ? {hits: true} : {object: v.slice(2)};
    if (add.object) S.active[add.object] = Math.max(S.active[add.object] || 0, 1);
    set([...cur().filter(x => !(add.object && x.object === add.object)), add]);
  });
  $('#scStack').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.closest('li').dataset.i, a = b.dataset.a;
    edit(i, sc => {
      if (a === 'del') sc.splice(i, 1);
      else { const j = a === 'up' ? i + 1 : i - 1; if (j >= 0 && j < sc.length) [sc[i], sc[j]] = [sc[j], sc[i]]; }   // up is nearer the top
    });
  });
  $('#scStack').addEventListener('change', e => {
    const s = e.target, i = +s.closest('li').dataset.i, k = s.dataset.k, v = s.value;
    edit(i, (sc, en) => {
      if (k === 'mask') { if (v === 'none') delete en.mask; else { const [o, keep] = v.split(':'); en.mask = o === 'front' ? {world: 'front', keep} : {object: o, keep}; } }
      if (k === 'layer') en.layers = [v];
      if (k === 'fill') { if (v === 'none') delete en.fill; else en.fill = fillOf(v); }
      if (k === 'drive') { if (v === 'none') delete en.drive; else en.drive = {src: v, amt: .7}; }
    });
  });
  render();
}
init();
