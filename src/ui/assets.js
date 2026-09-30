// The Asset Viewer: every world, layer, hit and object in one place, to look at on its own (V, the panel's Assets button, or
// ?assets). The user asked for an asset manager as the assets grow; everything comes from the registry, so a new visual
// shows up here by itself. Picking one solos it (Journey off). An object can be turned by dragging, zoomed with the wheel,
// drawn in each style, held at any point of its shape key, stilled or left dancing, and shattered; the panel
// says how many panes and parts it has, where it came from, and the frame rate. "Thumbnails" steps through them all and
// keeps a small picture of each (in this browser).
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { solo } from './presets.js';
import { syncSliders } from './panel.js';
import { curP } from '../presets.js';
import { $ } from '../util.js';

const GROUPS = [['Objects', OBJECT_VISUALS], ['Worlds', WORLD_VISUALS], ['Layers', LAYER_VISUALS], ['Hits', HIT_VISUALS]];
// where each object came from (the rest are one module each, under src/visuals/)
const SOURCES = {skull: 'tools/skull-mesh.mjs (distance functions, meshed)', unicorn: 'tools/unicorn-mesh.mjs', manta: 'tools/blender/manta.py (Blender)',
  lotus: 'tools/blender/lotus.py (Blender)', jelly: 'tools/blender/jelly.py (Blender)', goblin: 'tools/blender/goblin.py (Blender, sculpted from metaballs)', goblinLit: 'tools/blender/goblin_hd.py (Blender: sculpted, baked into textures)', geosphere: 'meshes/maths.js', torus: 'meshes/maths.js', knot: 'meshes/maths.js',
  dodeca: 'meshes/maths.js', spikes: 'meshes/maths.js', crystal: 'meshes/maths.js'};
const STYLES = ['Glass wire', 'Solid', 'Outline', 'Hologram', 'Points', 'Shaded'];
let el = null, cur = null, thumbs = {}, fps = {n: 0, t: 0, v: 0}, keepDance = null;
try { thumbs = JSON.parse(localStorage.getItem('afterglow.thumbs') || '{}'); } catch (e) {}

function stats(v){
  if (v.stats) return v.stats;
  if (v.kind !== 'object') return `${v.kind}` + (v.optIn ? ' (by hand only)' : '');
  const pieces = v.mesh.pieces, panes = pieces.reduce((s, p) => s + p.tri.length/3, 0), parts = new Set(pieces.flatMap(p => [...p.part])).size;
  return `${panes.toLocaleString()} panes · ${parts} parts${pieces.some(p => p.morph) ? ' · a shape key' : ''}`;
}
const source = v => SOURCES[v.key] || `src/visuals/${v.kind === 'hit' ? 'hits' : v.kind + 's'}/${v.key}.js`;
function build(){
  el = document.createElement('div'); el.id = 'assets'; el.hidden = true;
  el.innerHTML = `<div class="aside"><div class="head"><b>Assets</b><button id="aThumbs" title="Step through them all and keep a picture of each">Thumbnails</button><button id="aClose" aria-label="Close">✕</button></div><div class="list"></div></div>
    <div class="stage" hidden><div class="info"></div><div class="obj">
      <div class="arow">${STYLES.map((s, i) => `<button data-style="${i}">${s}</button>`).join('')}</div>
      <div class="arow"><label><input type="checkbox" id="aMusic" checked> shape key from the music</label><input type="range" id="aMorph" min="-1" max="1" step=".01" value="0" disabled></div>
      <div class="arow"><label><input type="checkbox" id="aDance" checked> dancing</label><button id="aShatter">Shatter</button><button id="aReset">Face on</button><span class="tip">drag to turn · wheel to zoom</span></div>
    </div></div>`;
  document.body.append(el);
  const list = el.querySelector('.list');
  for (const [name, vs] of GROUPS) {
    const h = document.createElement('h3'); h.textContent = name; list.append(h);
    for (const v of vs) {
      const b = document.createElement('button'); b.className = 'item'; b.dataset.key = v.key;
      b.innerHTML = `<span class="th">${thumbs[v.key] ? `<img src="${thumbs[v.key]}" alt="">` : ''}</span><span class="nm">${v.label}<small>${stats(v)}</small></span>`;
      b.onclick = () => pick(v.key); list.append(b);
    }
  }
  el.querySelector('#aClose').onclick = () => open(false);
  el.querySelector('#aThumbs').onclick = contactSheet;
  el.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { S.active.objStyle = +b.dataset.style; syncSliders(); mark(); });
  const music = el.querySelector('#aMusic'), morph = el.querySelector('#aMorph');
  music.onchange = () => { morph.disabled = music.checked; if (S.view) S.view.morph = music.checked ? null : +morph.value; };
  morph.oninput = () => { if (S.view) S.view.morph = +morph.value; };
  el.querySelector('#aDance').onchange = e => { TUNE.dance.amount = e.target.checked ? (keepDance ?? 1) : 0; };
  el.querySelector('#aShatter').onclick = () => cur && byKey[cur].breakApart && byKey[cur].breakApart();
  el.querySelector('#aReset').onclick = () => { if (S.view) Object.assign(S.view, {yaw: 0, pitch: 0, zoom: .75}); };
  // turning and zooming the object: drags and the wheel on the picture (not on the list)
  let drag = null;
  addEventListener('pointerdown', e => { if (!isOpen() || !S.view || e.target.closest('#assets .aside, #assets .stage, #bar, #panel')) return; drag = {x: e.clientX, y: e.clientY}; });
  addEventListener('pointermove', e => { if (!drag || !S.view) return; S.view.yaw += (e.clientX - drag.x)*.01; S.view.pitch += (e.clientY - drag.y)*.01; drag = {x: e.clientX, y: e.clientY}; });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('wheel', e => { if (!isOpen() || !S.view || e.target.closest('#assets .aside')) return; S.view.zoom = Math.max(.3, Math.min(3, S.view.zoom*Math.exp(-e.deltaY*.001))); }, {passive: true});
  const tick = t => { fps.n++; if (t - fps.t > 1000) { fps.v = fps.n*1000/(t - fps.t); fps.n = 0; fps.t = t; if (isOpen()) info(); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
const isOpen = () => el && !el.hidden;
function info(){
  if (!cur) return; const v = byKey[cur], i = el.querySelector('.info');
  i.innerHTML = `<b>${v.label}</b> <small>${v.kind}</small><br><small>${stats(v)}<br>from ${source(v)}<br>${fps.v.toFixed(0)} frames a second</small>`;
}
function mark(){
  el.querySelectorAll('.item').forEach(b => b.classList.toggle('on', b.dataset.key === cur));
  el.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('on', +b.dataset.style === Math.round(S.active.objStyle || 0)));
}
function pick(key){
  cur = key; solo(key);
  const stage = {decay: .8, zoom: 1, rot: 0, warp: 0, wander: 0}; Object.assign(S.active, stage); Object.assign(curP, stage);   // a still stage, at once: short trails, no zoom or spin, so the thing itself shows
  syncSliders();
  const v = byKey[key], isObj = v.kind === 'object';
  S.view = isObj ? {key, yaw: 0, pitch: 0, zoom: .75, morph: el.querySelector('#aMusic').checked ? null : +el.querySelector('#aMorph').value} : null;
  el.querySelector('.stage').hidden = false; el.querySelector('.obj').hidden = !isObj;
  info(); mark();
}
// every asset alone for a moment, a small picture of each kept (in this browser)
async function contactSheet(){
  const all = GROUPS.flatMap(([, vs]) => vs), can = document.createElement('canvas'); can.width = 128; can.height = 72;
  const frames = n => new Promise(r => { let k = 0; const f = () => ++k >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); });
  for (const v of all) {
    pick(v.key); await frames(45);
    can.getContext('2d').drawImage(document.querySelector('canvas'), 0, 0, 128, 72);
    thumbs[v.key] = can.toDataURL('image/jpeg', .7);
    const img = el.querySelector(`.item[data-key="${v.key}"] .th`); if (img) img.innerHTML = `<img src="${thumbs[v.key]}" alt="">`;
  }
  try { localStorage.setItem('afterglow.thumbs', JSON.stringify(thumbs)); } catch (e) {}
}
export function open(on = !isOpen()){
  if (!el) build();
  el.hidden = !on; document.body.classList.toggle('assets', on);
  if (on) { keepDance = TUNE.dance.amount; if (!cur) { pick(OBJECT_VISUALS[0].key); S.active.objStyle = 0; mark(); } }
  else { S.view = null; if (keepDance !== null) TUNE.dance.amount = keepDance; }
}
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'v' && !document.querySelector('#keyHud.on')) { open(); e.stopImmediatePropagation(); }
  else if (k === 'escape' && isOpen()) open(false);
});
const btn = $('#assetsBtn'); if (btn) btn.onclick = () => open(true);
if (/[?&]assets\b/.test(location.search)) setTimeout(() => open(true), 300);
