// Scenes: how the pictures are put together, as plain data, compiled into a draw plan both renderers run.
// A scene is a stack, bottom to top, in any order. Its entries:
//   {world: 'all'}                          every world on screen, whole (behind whatever comes after)
//   {world: 'front'}                        the worlds' front planes (near buildings, ridge, treeline, planet) repainted
//                                            over what's below, so what's below sits between the world's planes
//   {trails: 'main', mask?}                 a trail group: a feedback buffer of layers. 'main' holds every layer no other
//   {trails: 'back', layers: ['comets']}    group claims; another group names its layers (at most TUNE.scene.maxGroups)
//     mask: {object: 'skull', keep: 'inside' | 'outside'} or {world: 'front', keep}: shown only inside (outside) that shape
//   {hits: true}                            the one-shot hits (star, outline, sparkles)
//   {objects: true}                         every 3D object on screen that isn't placed by its own entry
//   drive: {src: 'kick', amt: .7}           on a world or trails entry: its weight follows a signal (scene/signals.js)
//   {object: 'skull', fill?}                one object here, its glass filled with another image:
//     fill: {layers: ['plasma', 'tunnel'], fold: 6, zoom?}   those layers alone (any layer, the media tunnel too), folded
//           {trails: 'inner', layers: ['comets']}           a trail group seen only through the glass
//           {world: true, zoom?}                            the worlds, shrunk into the glass
//     and part: 7 fills only that part (7 is the eyes of the skull and unicorn)
// Presets (and Journey) carry scenes, the renderers run resolveScene()'s plan. Imports only the tuning file.
import { TUNE } from '../tuning.js';

export const DEFAULT_SCENE = [{world: 'all'}, {trails: 'main'}, {hits: true}, {objects: true}];   // what the page has always drawn

const cache = new WeakMap();
// a trail group for the scene, within the budget (null: over it)
function group(r, g, layers){
  if (!(g in r.groups) && Object.keys(r.groups).length >= TUNE.scene.maxGroups) return null;
  if (!(g in r.groups)) r.groups[g] = g === 'main' ? null : layers || [];
  return g;
}
function fillOf(f, r){
  const part = f.part || 0;
  if (f.trails && group(r, f.trails, f.layers)) return {src: 'trails', g: f.trails, zoom: f.zoom || TUNE.scene.fillZoom, part};
  if (f.world) return {src: 'world', zoom: f.zoom || TUNE.scene.worldFillZoom, part};
  return {src: 'layers', layers: f.layers || [], fold: f.fold || 1, zoom: f.zoom, part};
}
// the plan: groups {name: layers or null for "the rest"}, steps (segments of full-screen items, and object draws),
// fills {object: spec}, masks (objects whose silhouettes are needed), front (whether any world plane is used)
export function resolveScene(scene){
  scene = scene || DEFAULT_SCENE;
  if (cache.has(scene)) return cache.get(scene);
  const r = {groups: {}, steps: [], fills: {}, masks: [], front: false, placed: new Set(), driven: []};
  let seg = null;
  const item = (it, e) => { if (e.drive) { it.drive = e.drive; it.i = r.driven.length; r.driven.push(it); } if (!seg) r.steps.push(seg = {seg: []}); seg.seg.push(it); };
  for (const e of scene) {
    if (e.world) { item({t: e.world === 'front' ? 'front' : 'world'}, e); if (e.world === 'front') r.front = true; }
    else if (e.trails) {
      const g = group(r, typeof e.trails === 'string' ? e.trails : 'main', e.layers) || group(r, 'main') || 'main';   // over budget: into main
      const m = e.mask && {object: e.mask.object, world: e.mask.world, inside: e.mask.keep !== 'outside'};
      if (m && m.object && !r.masks.includes(m.object)) r.masks.push(m.object);
      if (m && m.world) r.front = true;
      item({t: 'trails', g, mask: m}, e);
    }
    else if (e.hits) item({t: 'hits'}, e);
    else if (e.objects || e.object) {
      if (e.object) { r.placed.add(e.object); if (e.fill) r.fills[e.object] = fillOf(e.fill, r); }
      r.steps.push({mesh: e.object || '*'}); seg = null;
    }
  }
  // which group each trail layer draws into (anything unclaimed goes to main)
  r.groupOf = key => { for (const g in r.groups) if (r.groups[g] && r.groups[g].includes(key)) return g; return 'main'; };
  const segs = r.steps.filter(s => s.seg);
  segs.forEach((s, i) => { s.first = r.steps[0] === s; s.last = i === segs.length - 1;
    s.key = (s.first ? '' : 'u:') + s.seg.map(it => it.t + (it.g ? ':' + it.g : '') + (!it.mask ? '' : ':m' + (it.mask.world ? 'w' : r.masks.indexOf(it.mask.object)) + (it.mask.inside ? 'i' : 'o')) + (it.drive ? ':k' + it.i : '')).join('|') + (s.last ? ':end' : ''); });
  r.anyFill = Object.keys(r.fills).length > 0;
  cache.set(scene, r);
  return r;
}
