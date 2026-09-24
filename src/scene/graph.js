// Scenes: how the pictures are put together, as plain data. A scene is a stack, bottom to top, of entries that can relate
// to each other: a world's near parts in front of the trails, the trails only inside (or outside) an object, an object's
// glass filled with layers seen through a kaleidoscope. A leaf module; presets carry scenes, the renderers read resolveScene().
//
// This round the stack's order is fixed (the world behind, the trails, the world's front, the hits, the objects on top);
// what a scene chooses is how its entries relate:
//   {world: {between: true}}                                   the world's front plane (buildings, ridge, treeline, planet)
//                                                               comes in front of the trails
//   {trails: {mask: {object: 'skull', keep: 'inside'}}}        the trails only inside (or 'outside') an object's silhouette
//   {object: 'skull', fill: {layers: ['plasma'], kaleido: 6, zoom?}}  an object's glass filled with those layers, folded n
//                                                               ways (zoom: how much smaller the pattern is; TUNE.scene.fillZoom)
export const DEFAULT_SCENE = [{world: {}}, {trails: {}}, {hits: {}}, {objects: {}}];   // what the page has always drawn

const cache = new WeakMap();
// everything the renderers need from a scene, worked out once per scene
export function resolveScene(scene){
  scene = scene || DEFAULT_SCENE;
  if (cache.has(scene)) return cache.get(scene);
  const r = {between: false, mask: null, fills: {}};
  for (const e of scene) {
    if (e.world && e.world.between) r.between = true;
    if (e.trails && e.trails.mask) r.mask = {object: e.trails.mask.object, inside: e.trails.mask.keep !== 'outside'};
    if (e.object && e.fill) r.fills[e.object] = {layers: e.fill.layers || [], kaleido: e.fill.kaleido || 1, zoom: e.fill.zoom};
  }
  r.anyFill = Object.keys(r.fills).length > 0;
  cache.set(scene, r);
  return r;
}
