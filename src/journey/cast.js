// Journey: casting the lead, accent and hit for each section.
import { ELEMS, FEATS, J, OPENING, SUITS, worldOn } from './core.js';
import { pickRecipe, recipeMods, setLens } from './recipes.js';
import { relFeat } from './sections.js';
import { updateSectionUI } from '../ui/panel.js';
import { ACCENT, ALT_TRIG, HIT_VISUALS, NAMES, OBJECT_VISUALS, OVER_WORLD, byKey } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { MEDIA } from '../media/source.js';
import { TEMPLATES, byTemplate, fits, pickTemplate } from '../scene/templates.js';
import { STEER, banned, pinned } from './steer.js';
import { chooseWorld } from './worlds.js';
import { applyTw, chooseGrain, chooseKal, chooseFrac, chooseMand, chooseTw, steerKal } from './extras.js';
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
    if (pinned(k)) v += 6; if (banned(k)) v -= 99;            // steered by hand (journey/steer.js)
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
  for (const v of HIT_VISUALS) hsc[v.key] = v.suits(rf, wOn, hs[v.key] || 0) + jit() + (pinned(v.key) ? 99 : 0) - (banned(v.key) ? 99 : 0);   // each hit's module says what suits it (and steering)
  if (R.hit) hsc[R.hit] += .5; else hsc.none += TUNE.hitNoneNoRecipe;
  if (avoid !== undefined) hsc[avoid || 'none'] -= 5;
  const hk = Object.keys(hsc).sort((a, b) => hsc[b] - hsc[a])[0];
  J.hit = hk === 'none' ? null : hk;
}
// a 3D centrepiece in some sections (TUNE.scene.centreChance), the least tired object; an object's own chance above 0
// (a lab's, say) takes over the draw
// how a centrepiece is drawn: glass wire and holograms suit calm music, solid, outlines and points intense (TUNE.objStyles)
function chooseStyle(){ const w = TUNE.objStyles.calm.map((c, i) => c + (TUNE.objStyles.intense[i] - c)*J.tension); let r = Math.random()*w.reduce((a, b) => a + b, 0);
  J.objStyle = w.findIndex(x => (r -= x) <= 0); if (J.objStyle < 0) J.objStyle = 0; }
function chooseCentre(){
  J.centre = null; chooseStyle();
  const pin = OBJECT_VISUALS.find(v => pinned(v.key)); if (pin) { J.centre = pin.key; return; }   // steered: always this one
  const R = J.recipe;   // a liked look brings its centrepiece along, most of the time
  if (R && R.liked && R.centre && byKey[R.centre] && !banned(R.centre) && !MEDIA.on && Math.random() < TUNE.liked.centre) { J.centre = R.centre; return; }
  const own = OBJECT_VISUALS.filter(v => ((TUNE[v.key] || {}).chance || 0) > 0 && !banned(v.key));
  if (own.length) { for (const v of own) if (Math.random() < TUNE[v.key].chance) { J.centre = v.key; break; } return; }
  if (Math.random() >= TUNE.scene.centreChance) return;
  const pool = OBJECT_VISUALS.filter(v => !banned(v.key)).map(v => ({k: v.key, v: Math.random() - (J.oFat[v.key] || 0)})).sort((a, b) => b.v - a.v);
  J.centre = pool.length ? pool[0].k : null;
}
// how the section is composed: a scene template that fits its cast and suits the music
const castOf = () => ({world: J.world, lead: J.lead, accent: J.accent, centre: MEDIA.on ? null : J.centre, label: k => NAMES[k] || k});
function chooseScene(rf, fresh, avoid){   // (a liked look's own template, favoured when it fits)
  const R = J.recipe;
  J.sceneKey = pickTemplate(castOf(), rf, J.tension - .5, J.sFat, fresh, avoid, R && R.liked ? R.sceneKey : null).key;
}
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
  ty.casts[J.world] = {...(ty.casts[J.world] || {}), lead: J.lead, accent: J.accent, accTrig: J.accTrig, hit: J.hit, recipe: J.recipe, centre: J.centre, objStyle: J.objStyle, sceneKey: J.sceneKey,
    kal: J.kal, grain: J.grain, tw: J.tw, mand: J.mand, fracV: J.fracV}; }
// a small variation: a different accent, or a different hit
export function varySmall(){
  const ty = J.type || OPENING, rf = relFeats();
  const r = Math.random();
  if (r < .4) { chooseAccent(scoreElems(ty, rf, true), J.accent); chooseTw(); } else if (r < .65) chooseHit(ty, rf, true, J.hit); else if (r < .85) chooseScene(rf, true, J.sceneKey); else chooseKal(!J.kal);
  saveCast();
}
// a change of steering, applied at once (ui/keys.js): a pinned layer becomes the lead (or the accent, when the lead is
// pinned too), a banned one leaves its role; a pinned world, hit, object or scene comes in, a banned one goes
export function applySteer(k, state){
  const v = byKey[k] || byTemplate[k], kind = byTemplate[k] ? 'scene' : v && v.kind, ty = J.type || OPENING, rf = relFeats();
  if (kind === 'layer') {
    if (state === 'pin' && J.lead !== k && J.accent !== k) { if (pinned(J.lead)) { J.accent = k; J.accTrig = ACCENT[k]; } else J.lead = k; }
    if (state === 'ban' && (J.lead === k || J.accent === k)) { const sc = scoreElems(ty, rf, true); if (J.lead === k) J.lead = sc.find(r => r.k !== J.accent).k; chooseAccent(scoreElems(ty, rf, true)); }
  } else if (kind === 'world') {
    if (state === 'pin') { J.world = k; J.worldTime = 0; } else if (state === 'ban' && J.world === k) chooseWorld(true);
  } else if (kind === 'hit') {
    if (state === 'pin') J.hit = k; else if (state === 'ban' && J.hit === k) chooseHit(ty, rf, true);
  } else if (kind === 'object') {
    if (state === 'pin') J.centre = k; else if (state === 'ban' && J.centre === k) chooseCentre();
  } else if (kind === 'scene') {
    if (state === 'pin' && fits(byTemplate[k], castOf())) J.sceneKey = k; else if (state === 'ban' && J.sceneKey === k) chooseScene(rf, true);
  }
  saveCast(); updateSectionUI();
}
export function recast(fresh){
  const ty = J.type || OPENING, key = J.world;
  ty.casts = ty.casts || {};
  J.recast = false;
  const cast = ty.casts[key];
  const steered = c => c && (banned(c.lead) || banned(c.accent) || (c.hit && banned(c.hit)) || (c.centre && banned(c.centre)) || banned(c.sceneKey)
    || Object.keys(STEER.pin).some(k => byKey[k] && byKey[k].kind === 'layer' && c.lead !== k && c.accent !== k));
  if (!fresh && cast && !steered(cast)) {                         // a returning part looks the same (unless steering says otherwise)...
    ({lead: J.lead, accent: J.accent, hit: J.hit, recipe: J.recipe} = cast);
    J.accTrig = cast.accTrig || ACCENT[J.accent]; J.accEnv = 0; J.centre = cast.centre || null; J.objStyle = cast.objStyle || 0; J.sceneKey = cast.sceneKey || 'plain';
    J.kal = cast.kal || null; steerKal(); J.grain = cast.grain || 0; J.tw = cast.tw || {}; applyTw(); J.mand = cast.mand ?? .5; J.fracV = cast.fracV || 0;
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
  const pins = scored.filter(r => pinned(r.k)).map(r => r.k);   // two layers pinned: the lead and the accent
  if (pins.length > 1 && J.accent !== pins[1] && J.lead === pins[0]) { J.accent = pins[1]; J.accTrig = ACCENT[pins[1]]; }
  chooseHit(ty, rf, fresh);
  chooseCentre();
  chooseScene(rf, fresh);
  chooseKal(); chooseGrain(); chooseTw(); chooseMand(); chooseFrac();   // the extras (journey/extras.js): the kaleidoscope, the grain, the layers' own speed and size
  saveCast();
  recipeMods(); updateSectionUI();
}
