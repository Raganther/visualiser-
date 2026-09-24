// Journey: choosing a world for each section.
import { FEATS, J, WORLDS } from './core.js';
import { relFeat } from './sections.js';

// each section can open into a world: calm, melodic, kickless parts suit the landscape or the aurora;
// bright, intense parts suit space; steady driving parts suit the city
export function chooseWorld(random){
  const ty = J.type; if (!ty) return;
  if (!ty.worldBias) ty.worldBias = {};
  WORLDS.forEach(k => { if (ty.worldBias[k] === undefined) ty.worldBias[k] = (Math.random() - .5)*.6; });
  const rf = {}; FEATS.forEach(f => rf[f] = relFeat(f)); const T = J.tension - .5;
  const sc = {none: .15 + (random ? Math.random()*.4 : 0),
    land: -rf.perc*.9 + rf.mid*.4 - T*.3 + ty.worldBias.land + (random ? Math.random()*.4 : 0),
    space: rf.bright*.5 + T*.4 + rf.busy*.2 + ty.worldBias.space + (random ? Math.random()*.4 : 0),
    // aurora: airy, melodic, without much bass; city: steady kicks and bass at a middling intensity
    aurora: -rf.perc*.6 + rf.mid*.5 - rf.low*.3 - T*.4 + ty.worldBias.aurora + (random ? Math.random()*.4 : 0),
    city: rf.perc*.6 + rf.low*.3 - Math.abs(T)*.5 + .05 + ty.worldBias.city + (random ? Math.random()*.4 : 0)};
  J.world = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0]; J.worldTime = 0;
}
