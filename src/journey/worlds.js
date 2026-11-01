// Journey: choosing a world for each section.
import { S } from '../state.js';
import { FEATS, J, WORLDS } from './core.js';
import { WORLD_VISUALS } from '../visuals/registry.js';
import { relFeat } from './sections.js';
import { TUNE } from '../tuning.js';
import { STEER } from './steer.js';
import { crowd, density, fit } from './combos.js';
import { PLAN, planBonus } from './plan.js';

// each section can open into a world: calm, melodic, kickless parts suit the landscape or the aurora;
// bright, intense parts suit space; steady driving parts suit the city
export function chooseWorld(random){
  const ty = J.type; if (!ty) return;
  if (!ty.worldBias) ty.worldBias = {};
  WORLDS.forEach(k => { if (ty.worldBias[k] === undefined) ty.worldBias[k] = (Math.random() - .5)*.6; });
  const rf = {}; FEATS.forEach(f => rf[f] = relFeat(f)); const T = J.tension - .5;
  // each world says what music suits it (its module's suits()); the section's own taste and a little chance are added
  const sc = {none: .15 + (random ? Math.random()*.4 : 0)};
  for (const v of WORLD_VISUALS) if (!v.optIn) sc[v.key] = v.suits(rf, T) + ty.worldBias[v.key] + (random ? Math.random()*.4 : 0);
  // tired worlds (and a long black) step back, so a steady track doesn't get the same world turn after turn
  for (const k in sc) sc[k] -= (J.wFat[k] || 0)*TUNE.worldFatigueWeight;
  // goes with the layers and object already there (journey/combos.js); the track's plan (journey/plan.js): the headline held
  // for its drop, the motif back at the close, and sparse worlds at the opening
  for (const k in sc) sc[k] += TUNE.combos.weight*(fit(k, [J.lead, J.centre]) - crowd({world: k, lead: J.lead, centre: J.centre}, J.tension)) + planBonus(k) - (PLAN.on && PLAN.phase === 'open' ? density(k)*TUNE.plan.openRoom*2 : 0);
  for (const k in sc) sc[k] += (STEER.pin[k] ? 99 : 0) - (STEER.ban[k] ? 99 : 0);   // steered by hand (journey/steer.js)
  for (const k in sc) if (S.skipW.has(k) && !STEER.pin[k]) sc[k] -= 99;
  if (!S.explore.kifs && !STEER.pin.kifs && sc.kifs !== undefined) sc.kifs -= 99;   // (the fractal depths only while their switch is on)   // left out on this device (the panel's "3D worlds in Journey": for speed)
  J.world = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0]; J.worldTime = 0;
}
