// Journey: reading presets as recipes, the lens, and the recipe's movers.
import { OVER_WORLD } from './cast.js';
import { ELEMS, HITS, J, OPENING, SUITS, WORLDS, jState, worldOn } from './core.js';
import { presets } from '../presets.js';
import { syncSliders } from '../ui/panel.js';
import { TUNE } from '../tuning.js';

/* recipes: each preset is read as ingredients (a lead, an accent, a hit, a lens, a world, a way of moving and its movers).
   Journey picks one per section and builds on it, so the presets (including any hand edits) steer the piece */
export const MOTION = ['decay','zoom','rot','warp','wander','colorSpeed','hueDrift'], LENS = ['sym','mirror'];
function recipeOf(p){
  const ls = ELEMS.filter(k => p[k] > .05).sort((a, b) => p[b] - p[a]);
  return {name: p.name, p, lead: ls[0] || null, accent: ls[1] || null,
    hit: HITS.filter(k => p[k] > .05).sort((a, b) => p[b] - p[a])[0] || null,
    lens: p.sym >= 2 ? {n: Math.round(p.sym), mirror: p.mirror} : null,
    world: WORLDS.find(k => p[k] > .5) || 'none',
    T: Math.min(1, (p.colorSpeed*3 + Math.max(0, p.zoom - 1)*10 + (1 - p.decay)*5)/1.6)};
}
export function pickRecipe(ty, rf, fresh){
  const wOn = worldOn();
  const rs = presets.filter(p => p.journey !== false).map(p => {
    const r = recipeOf(p);
    let v = ((ty.recipeSeed || {})[r.name] || 0) + (fresh ? (Math.random() - .5)*.4 : 0);
    if (r.lead) for (const f in SUITS[r.lead]) v += SUITS[r.lead][f]*rf[f]*.6;
    v -= Math.abs(r.T - J.tension)*1.2;                      // intense recipes for intense music
    if (r.lead) v -= J.fat[r.lead]*TUNE.fatigueRecipeWeight;                         // and not the element that has been on all night
    if (r.world !== 'none') v += r.world === J.world ? .25 : -.6;
    if (wOn) v += (r.lens ? -.6 : 0) + (OVER_WORLD[r.lead] || 0)*.8;   // over a world: no lens, and leads that suit it
    if (J.recipe && r.name === J.recipe.name) v -= fresh ? 1 : .4;   // move on from the last one
    return {r, v};
  }).sort((a, b) => b.v - a.v);
  return rs[0].r;
}
// the recipe's lens, or the section's own; never over a world
export function setLens(){
  const ty = J.type || OPENING, wOn = worldOn();
  J.lens = wOn ? null : (J.recipe && J.recipe.lens) || ty.lens || null;
  if (!J.lens) J.lensOn = false;
  J.lensShift = 0;
}
// the recipe's movers come along: motion always, the lens ones only while the lens is in
export function recipeMods(){
  const m = {}, src = J.recipe ? J.recipe.p.mods : {};
  for (const k in src) if (MOTION.includes(k) || (LENS.includes(k) && J.lensOn)) m[k] = {...src[k]};
  for (const k in J.userMods) if (J.userMods[k]) m[k] = {...J.userMods[k]}; else delete m[k];   // movers you set by hand stay
  jState.mods = m;
  syncSliders();
}
