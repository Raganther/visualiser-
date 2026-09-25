// Journey: casting the lead, accent and hit for each section.
import { ELEMS, FEATS, J, OPENING, SUITS, worldOn } from './core.js';
import { pickRecipe, recipeMods, setLens } from './recipes.js';
import { relFeat } from './sections.js';
import { updateSectionUI } from '../ui/panel.js';
import { ACCENT, ALT_TRIG, HIT_VISUALS, NAMES, OBJECT_VISUALS, OVER_WORLD } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { MEDIA } from '../media/source.js';
import { TEMPLATES, byTemplate, fits, pickTemplate } from '../scene/templates.js';
export { NAMES, OVER_WORLD };

export const ACC_WORDS = {bar:'on the downbeat', hit:'on stabs and hits', mid:'when the melody swells', peak:'at the start of loud phrases'};
export const HIT_WORDS = Object.fromEntries(HIT_VISUALS.map(v => [v.key, v.words]));
export const OBJECT_WORDS = Object.fromEntries(OBJECT_VISUALS.map(v => [v.key, v.words]));
// how well each element fits right now: the recipe, the music, the world, and how long it has been on screen lately
function scoreElems(ty, rf, fresh){
  const R = J.recipe || {}, wOn = worldOn();
  return ELEMS.map(k => {
    let v = ty.seed[k] + (fresh ? (Math.random() - .5)*.5 : 0);
    if (k === R.lead) v += 1; else if (k === R.accent) v += .5;   // the recipe's ingredients come first
    for (const f in SUITS[k]) v += SUITS[k][f]*rf[f];
    if (wOn) v += OVER_WORLD[k] || 0;
    v -= J.fat[k]*TUNE.fatigueWeight;                         // tired elements step back
    return {k, v};
  }).sort((a, b) => b.v - a.v);
}
// the accent should contrast with the lead: a different kind of trigger where possible
function chooseAccent(scored, avoid){
  const leadTrig = ACCENT[J.lead];
  const pool = scored.filter(r => r.k !== J.lead && r.k !== avoid);
  let pick = null, trig = null;
  for (const r of pool) {
    const opts = [ACCENT[r.k], ALT_TRIG[r.k]].filter(t => t && t !== leadTrig);
    if (opts.length) { pick = r.k; trig = opts[Math.floor(Math.random()*opts.length)]; break; }
  }
  if (!pick) { pick = pool[0].k; trig = ACCENT[pick]; }
  J.accent = pick; J.accTrig = trig; J.accEnv = 0;
}
function chooseHit(ty, rf, fresh, avoid){
  const wOn = worldOn(), R = J.recipe || {};
  // a star suits steady kicks and intensity, shockwaves suit busy stabs. stars stay crisp over a world
  const hs = ty.hitSeed || OPENING.hitSeed, jit = () => fresh ? (Math.random() - .5)*.3 : 0;
  // star: intense downbeats. outline: steady, bassy grooves. shockwaves: busy, driving. sparkles: bright and stabby
  const hsc = {none: TUNE.hitNone + hs.none + jit()};
  for (const v of HIT_VISUALS) hsc[v.key] = v.suits(rf, wOn, hs[v.key] || 0) + jit();   // each hit's module says what suits it
  if (R.hit) hsc[R.hit] += .5; else hsc.none += TUNE.hitNoneNoRecipe;
  if (avoid !== undefined) hsc[avoid || 'none'] -= 5;
  const hk = Object.keys(hsc).sort((a, b) => hsc[b] - hsc[a])[0];
  J.hit = hk === 'none' ? null : hk;
}
// a 3D centrepiece in some sections (TUNE.scene.centreChance), the least tired object; an object's own chance above 0
// (a lab's, say) takes over the draw
function chooseCentre(){
  J.centre = null;
  const own = OBJECT_VISUALS.filter(v => ((TUNE[v.key] || {}).chance || 0) > 0);
  if (own.length) { for (const v of own) if (Math.random() < TUNE[v.key].chance) { J.centre = v.key; break; } return; }
  if (Math.random() >= TUNE.scene.centreChance) return;
  const pool = OBJECT_VISUALS.map(v => ({k: v.key, v: Math.random() - (J.oFat[v.key] || 0)})).sort((a, b) => b.v - a.v);
  J.centre = pool[0].k;
}
// how the section is composed: a scene template that fits its cast and suits the music
const castOf = () => ({world: J.world, lead: J.lead, accent: J.accent, centre: MEDIA.on ? null : J.centre, label: k => NAMES[k] || k});
function chooseScene(rf, fresh, avoid){ J.sceneKey = pickTemplate(castOf(), rf, J.tension - .5, J.sFat, fresh, avoid).key; }
const built = new Map();
// the scene the section wants right now (the same object each time for the same cast, so its draw plan is kept)
export function sceneNow(){
  const c = castOf(), t = byTemplate[J.sceneKey] || TEMPLATES[0];
  if (MEDIA.on || !fits(t, c) || t.key === 'plain') return null;   // with media the mirror tunnel fills the screen as it is
  const sig = [t.key, c.world, c.lead, c.accent, c.centre].join('|');
  if (!built.has(sig)) built.set(sig, t.build(c));
  return built.get(sig);
}
export const sceneWords = () => { const c = castOf(), t = byTemplate[J.sceneKey]; return t && fits(t, c) ? t.words(c) : ''; };
const relFeats = () => { const rf = {}; FEATS.forEach(f => rf[f] = relFeat(f)); rf.T = J.tension - .5; return rf; };
function saveCast(){ const ty = J.type || OPENING; ty.casts = ty.casts || {};
  ty.casts[J.world] = {...(ty.casts[J.world] || {}), lead: J.lead, accent: J.accent, accTrig: J.accTrig, hit: J.hit, recipe: J.recipe, centre: J.centre, sceneKey: J.sceneKey}; }
// a small variation: a different accent, or a different hit
export function varySmall(){
  const ty = J.type || OPENING, rf = relFeats();
  const r = Math.random();
  if (r < .45) chooseAccent(scoreElems(ty, rf, true), J.accent); else if (r < .75) chooseHit(ty, rf, true, J.hit); else chooseScene(rf, true, J.sceneKey);
  saveCast();
}
export function recast(fresh){
  const ty = J.type || OPENING, key = J.world;
  ty.casts = ty.casts || {};
  J.recast = false;
  const cast = ty.casts[key];
  if (!fresh && cast) {                                           // a returning part looks the same...
    ({lead: J.lead, accent: J.accent, hit: J.hit, recipe: J.recipe} = cast);
    J.accTrig = cast.accTrig || ACCENT[J.accent]; J.accEnv = 0; J.centre = cast.centre || null; J.sceneKey = cast.sceneKey || 'plain';
    setLens();
    if (ty.visits >= 3 && cast.variedAt !== ty.visits) { varySmall(); ty.casts[key].variedAt = ty.visits; }   // ...but not identical forever
    recipeMods(); updateSectionUI(); return;
  }
  const rf = relFeats();
  J.recipe = pickRecipe(ty, rf, fresh);
  setLens();
  const prevLead = J.lead, scored = scoreElems(ty, rf, fresh);
  if (fresh && prevLead) scored.forEach(r => { if (r.k === prevLead) r.v -= 1; });   // a refresh should actually change something
  scored.sort((a, b) => b.v - a.v);
  J.lead = scored[0].k;
  chooseAccent(scored);
  chooseHit(ty, rf, fresh);
  chooseCentre();
  chooseScene(rf, fresh);
  saveCast();
  recipeMods(); updateSectionUI();
}
