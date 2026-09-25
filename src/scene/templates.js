// Scene templates: the ways Journey composes a section, as scenes built from its cast (world, lead, accent, centrepiece).
// Each says what it needs, what music suits it, and how to narrate it. Journey scores them like its other choices
// (base weight, the music, fatigue, a little chance) and keeps "few things at once": a template adds relations between
// the things already on screen, never more things. Each ends with the objects no entry places, so an outgoing centrepiece
// still winks out, and an incoming one assembles, while the scene waits for its bar line. A leaf module (it reads TUNE only).
import { TUNE } from '../tuning.js';

const FOLDED = ['plasma', 'ring', 'burst', 'scope'];   // layers drawn inside the kaleidoscope fold, which fill glass well
const FRONT = {city: 'near buildings', land: 'nearest ridge', aurora: 'treeline', space: 'planet'};
// c: {world, lead, accent, centre, label(key)}; rf: the music's features (centred on 0), T: intensity (centred on 0)
export const TEMPLATES = [
  {key: 'plain', needs: {}, suits: () => 0,
    build: () => null, words: () => ''},
  {key: 'between', needs: {world: true}, suits: (rf, T) => .2 - T*.3,
    build: () => [{world: 'all'}, {trails: 'main'}, {world: 'front'}, {hits: true}, {objects: true}],
    words: c => `The glow flies behind the ${FRONT[c.world] || 'world'}.`},
  {key: 'split', needs: {world: true, accent: true}, suits: (rf, T) => rf.busy*.3 + T*.2,
    build: c => [{world: 'all'}, {trails: 'back', layers: [c.accent]}, {world: 'front'}, {trails: 'main'}, {hits: true}, {objects: true}],
    words: c => `${c.label(c.accent)} behind the ${FRONT[c.world] || 'world'}, ${c.label(c.lead).toLowerCase()} in front.`},
  {key: 'among', needs: {world: true, centre: true}, suits: (rf, T) => rf.low*.3,
    build: c => [{world: 'all'}, {trails: 'main'}, {object: c.centre}, {world: 'front'}, {hits: true}, {objects: true}],
    words: c => `It stands among the ${FRONT[c.world] || 'world'}.`},
  {key: 'reflect', needs: {world: true, centre: true}, suits: (rf, T) => rf.mid*.3 - T*.2,
    build: c => [{world: 'all'}, {trails: 'main'}, {object: c.centre, fill: {world: true}}, {hits: true}, {objects: true}],
    words: () => 'The world shows in its glass.'},
  {key: 'inside', needs: {centre: true, noWorld: true}, suits: (rf, T) => T*.3 + rf.perc*.2,
    build: c => [{world: 'all'}, {trails: 'main', mask: {object: c.centre, keep: 'outside'}}, {hits: true},
      {object: c.centre, fill: {layers: FOLDED.includes(c.lead) ? [c.lead, 'ring'] : ['plasma', 'ring'], fold: 6}}, {objects: true}],
    words: () => 'A kaleidoscope turns inside it, and the glow keeps out.'},
  {key: 'window', needs: {centre: true}, suits: (rf, T) => -T*.2 + rf.mid*.2,
    build: c => [{world: 'all'}, {trails: 'main', mask: {object: c.centre, keep: 'inside'}}, {hits: true}, {object: c.centre}, {objects: true}],
    words: () => 'The glow is only seen through it.'},
  {key: 'glass', needs: {centre: true, accent: true}, suits: (rf, T) => rf.busy*.2 + rf.bright*.2,
    build: c => [{world: 'all'}, {trails: 'main'}, {object: c.centre, fill: {trails: 'inner', layers: [c.accent]}}, {hits: true}, {objects: true}],
    words: c => `${c.label(c.accent)} only in its glass.`},
];
export const byTemplate = Object.fromEntries(TEMPLATES.map(t => [t.key, t]));
// can this template compose this cast?
export function fits(t, c){
  const n = t.needs;
  return (!n.world || (c.world && c.world !== 'none')) && (!n.noWorld || !c.world || c.world === 'none')
    && (!n.centre || !!c.centre) && (!n.accent || (!!c.accent && c.accent !== c.lead));
}
// the best template for this cast and music: its weight, how it suits the music, how tired it is, a little chance
export function pickTemplate(c, rf, T, fat, fresh, avoid){
  let best = null, bv = -1e9;
  for (const t of TEMPLATES) {
    if (!fits(t, c)) continue;
    let v = (TUNE.sceneTemplates[t.key] || 0) + t.suits(rf, T) - (fat[t.key] || 0)*TUNE.sceneFatigueWeight + (fresh ? (Math.random() - .5)*.6 : 0);
    if (t.key === avoid) v -= 1;
    if (v > bv) { bv = v; best = t; }
  }
  return best || TEMPLATES[0];
}
