// Journey: choosing a world for each section.
import { FEATS, J, WORLDS } from './core.js';
import { WORLD_VISUALS } from '../visuals/registry.js';
import { relFeat } from './sections.js';
import { TUNE } from '../tuning.js';

// each section can open into a world: calm, melodic, kickless parts suit the landscape or the aurora;
// bright, intense parts suit space; steady driving parts suit the city
export function chooseWorld(random){
  const ty = J.type; if (!ty) return;
  if (!ty.worldBias) ty.worldBias = {};
  WORLDS.forEach(k => { if (ty.worldBias[k] === undefined) ty.worldBias[k] = (Math.random() - .5)*.6; });
  const rf = {}; FEATS.forEach(f => rf[f] = relFeat(f)); const T = J.tension - .5;
  // each world says what music suits it (its module's suits()); the section's own taste and a little chance are added
  const sc = {none: .15 + (random ? Math.random()*.4 : 0)};
  for (const v of WORLD_VISUALS) sc[v.key] = v.suits(rf, T) + ty.worldBias[v.key] + (random ? Math.random()*.4 : 0);
  // tired worlds (and a long black) step back, so a steady track doesn't get the same world turn after turn
  for (const k in sc) sc[k] -= (J.wFat[k] || 0)*TUNE.worldFatigueWeight;
  J.world = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0]; J.worldTime = 0;
}
