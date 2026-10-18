// Journey: casting the lead, accent and hit for each section.
import { ELEMS, FEATS, HITS, J, OPENING, SUITS, WORLDS, worldOn } from './core.js';
import { pickRecipe, recipeMods, setLens } from './recipes.js';
import { relFeat, resetProgress } from './sections.js';
import { updateSectionUI } from '../ui/panel.js';
import { ACCENT, ALT_TRIG, HIT_VISUALS, NAMES, OBJECT_VISUALS, OVER_WORLD, byKey } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { MEDIA } from '../media/source.js';
import { S } from '../state.js';
import { TEMPLATES, byTemplate, fits, pickTemplate } from '../scene/templates.js';
import { STEER, banned, pinned } from './steer.js';
import { chooseWorld } from './worlds.js';
import { applyTw, chooseGrain, chooseKal, chooseFrac, chooseMand, chooseTw, steerKal, genKalApply } from './extras.js';
import { crowd, fit } from './combos.js';
import { PLAN, headObject, planBonus, planChance } from './plan.js';
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
    v += TUNE.combos.weight*(fit(k, [J.world]) - crowd({world: J.world, lead: k}, J.tension)) + planBonus(k);   // goes with the world, doesn't crowd it (journey/combos.js); the track's plan (journey/plan.js)
    if (pinned(k)) v += 6; if (banned(k)) v -= 99;            // steered by hand (journey/steer.js)
    return {k, v};
  }).sort((a, b) => b.v - a.v);
}
// the accent should contrast with the lead: a different kind of trigger where possible
function chooseAccent(scored, avoid){
  const leadTrig = ACCENT[J.lead];
  const W = TUNE.combos.weight, c0 = crowd({world: J.world, lead: J.lead}, J.tension);   // (and goes with the world and the lead, without crowding them)
  const pool = scored.filter(r => r.k !== J.lead && r.k !== avoid).map(r => ({k: r.k, v: r.v + W*(fit(r.k, [J.world, J.lead]) - (crowd({world: J.world, lead: J.lead, accent: r.k}, J.tension) - c0))})).sort((a, b) => b.v - a.v);
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
  const seen = J.hitSeen || (J.hitSeen = {});   // a hit not seen yet this visit gets a nudge, so the rare ones get their turn
  for (const v of HIT_VISUALS) if (!seen[v.key]) hsc[v.key] += TUNE.combos.unseen;
  const hk = Object.keys(hsc).sort((a, b) => hsc[b] - hsc[a])[0];
  J.hit = hk === 'none' ? null : hk; if (J.hit) seen[J.hit] = 1;
}
// a 3D centrepiece in some sections (TUNE.scene.centreChance), the least tired object; an object's own chance above 0
// (a lab's, say) takes over the draw
// how a centrepiece is drawn: glass wire and holograms suit calm music, solid, outlines and points intense (TUNE.objStyles)
function chooseStyle(){ const w = TUNE.objStyles.calm.map((c, i) => c + (TUNE.objStyles.intense[i] - c)*J.tension); let r = Math.random()*w.reduce((a, b) => a + b, 0);
  J.objStyle = w.findIndex(x => (r -= x) <= 0); if (J.objStyle < 0) J.objStyle = 0; }
function chooseCentre(){ pickCentre(); J.litLook = byKey[J.centre] && byKey[J.centre].lit ? pickLook() : 0;
  J.stage = !!J.centre && J.centre !== 'jewel' && !(byKey[J.centre] || {}).noRoom && !!byKey.room && roomRnd() < (J.centre === 'prism' ? TUNE.prism.room.chance : TUNE.prism.room.others);   // the centrepiece, sometimes in the room (worlds/room.js): the Prism most
  if (J.stage) { const w = TUNE.prism.styles, ks = Object.keys(w).filter(k => J.centre === 'prism' || k !== 'mirror'); let r = roomRnd()*ks.reduce((a, k) => a + w[k], 0); J.stageStyle = ks.find(k => (r -= w[k]) < 0) || 'cove'; } }
// the room's own random numbers, so putting a centrepiece in it leaves Journey's other draws as they were
let roomSeed = 7; const roomRnd = () => (roomSeed = (roomSeed*16807) % 2147483647)/2147483647;
// which object comes in has its own too, so adding an object leaves Journey's other choices as they were
let centreSeed = 11; const centreRnd = () => (centreSeed = (centreSeed*16807) % 2147483647)/2147483647;
// a lit object's look (real, toon, neon, chrome, marble): the user loves the neon (TUNE.lit.looks)
function pickLook(){ const w = TUNE.lit.looks; let r = Math.random()*w.reduce((a, b) => a + b, 0); const i = w.findIndex(x => (r -= x) <= 0); return i < 0 ? 0 : i; }
function pickCentre(){
  J.centre = null; chooseStyle();
  const pin = OBJECT_VISUALS.find(v => pinned(v.key)); if (pin) { J.centre = pin.key; return; }   // steered: always this one
  const R = J.recipe;   // a liked look brings its centrepiece along, most of the time
  if (R && R.liked && R.centre && byKey[R.centre] && !banned(R.centre) && !MEDIA.on && Math.random() < TUNE.liked.centre) { J.centre = R.centre; return; }
  const own = OBJECT_VISUALS.filter(v => ((TUNE[v.key] || {}).chance || 0) > 0 && !banned(v.key));
  if (own.length) { for (const v of own) if (Math.random() < TUNE[v.key].chance) { J.centre = v.key; break; } return; }
  const head = headObject(); if (head) { J.centre = head; return; }   // the track's big moment (journey/plan.js)
  const cast = {world: J.world, lead: J.lead, accent: J.accent}, full = crowd({...cast, centre: 1}, J.tension) - crowd(cast, J.tension);
  if (Math.random() >= TUNE.scene.centreChance*planChance()*Math.exp(-full*TUNE.combos.kalCrowd*TUNE.combos.weight)) return;   // (fewer at a track's opening and close, and when the picture is already full)
  const pool = OBJECT_VISUALS.filter(v => !banned(v.key) && !(v.key === 'branches' && !S.explore.grow) && (pinned(v.key) || (TUNE[v.key] || {}).journey !== 0)).map(v => ({k: v.key, v: centreRnd()**(1/(v.lit ? TUNE.lit.journey : (TUNE[v.key] || {}).journey || 1)) - (J.oFat[v.key] || 0) + TUNE.combos.weight*fit(v.key, [J.world, J.lead, J.accent]) + planBonus(v.key)})).sort((a, b) => b.v - a.v);   // (the growing branches only while their switch is on)
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
const castSig = c => [c.world, c.lead, c.accent, c.centre].join('|');
export function sceneNow(){
  const c = castOf(), t = byTemplate[J.sceneKey] || TEMPLATES[0];
  if (J.handScene && !MEDIA.on && J.handScene.sig === castSig(c) && J.sceneKey === 'plain') return J.handScene.sc;   // the scene made by hand, while its cast lasts
  J.handScene = null;
  if (MEDIA.on || !fits(t, c) || t.key === 'plain') return null;   // with media the mirror tunnel fills the screen as it is
  const sig = [t.key, castSig(c)].join('|');
  if (!built.has(sig)) built.set(sig, t.build(c));
  return built.get(sig);
}
export const sceneWords = () => { const c = castOf(), t = byTemplate[J.sceneKey]; return t && fits(t, c) ? t.words(c) : ''; };
const relFeats = () => { const rf = {}; FEATS.forEach(f => rf[f] = relFeat(f)); rf.T = J.tension - .5; return rf; };
function saveCast(){ const ty = J.type || OPENING; ty.casts = ty.casts || {};
  ty.casts[J.world] = {...(ty.casts[J.world] || {}), lead: J.lead, accent: J.accent, accTrig: J.accTrig, hit: J.hit, recipe: J.recipe, centre: J.centre, objStyle: J.objStyle, litLook: J.litLook, stage: J.stage, stageStyle: J.stageStyle, sceneKey: J.sceneKey,
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
  if (state === 'out') {   // taken out by hand: it leaves now, and Journey may bring it back later (not banned)
    if (kind === 'layer' && J.lead === k) { J.lead = scoreElems(ty, rf, true).sort((a, b) => b.v - a.v).find(r => r.k !== k && r.k !== J.accent)?.k || J.lead; }
    if (kind === 'layer' && J.accent === k) { J.accent = J.lead; J.accTrig = ACCENT[J.lead]; }
    if (kind === 'world' && J.world === k) { J.world = 'none'; J.worldTime = 0; }
    if (kind === 'hit' && J.hit === k) J.hit = null;
    if (kind === 'object' && J.centre === k) J.centre = null;
    if (kind === 'scene' && J.sceneKey === k) J.sceneKey = 'plain';
  }
  saveCast(); updateSectionUI();
}
// Journey turned back on from a look made by hand (ui/controls.js): what's on screen becomes the section's cast (its world,
// its strongest layers as the lead and accent, its hit, its object, its kaleidoscope), so Journey carries on from it and
// develops it a step at a time, instead of fading back to the cast it had before. s: the settings as set by hand
export function adoptLook(s, scene){
  const top = keys => keys.filter(k => (s[k] || 0) > .15).sort((a, b) => s[b] - s[a]);
  const worlds = top(WORLDS), layers = top(ELEMS), hits = top(HITS), objs = top(OBJECT_VISUALS.map(v => v.key));
  J.world = worlds[0] || 'none'; J.worldTime = 0;
  if (layers[0]) J.lead = layers[0];
  else { const sc = scoreElems(J.type || OPENING, relFeats(), false).sort((a, b) => b.v - a.v); J.lead = sc[0].k; }   // (Journey always has a lead: it fades in)
  J.accent = layers[1] || J.lead; J.accTrig = ACCENT[J.accent]; J.accEnv = 0;
  J.hit = hits[0] || null; J.centre = objs[0] || null; J.objStyle = s.objStyle || 0; J.litLook = s.litLook || 0; J.stage = false;
  J.kal = (s.kal || 0) >= 2 ? {n: Math.round(s.kal), where: s.kalWhere || 0, turn: s.kalTurn || 0, mode: s.kalMode || 0} : null;
  J.lens = !J.kal && (s.sym || 1) >= 2 ? {n: Math.round(s.sym), mirror: s.mirror > .5 ? 1 : 0} : null; J.lensOn = !!J.lens; J.lensShift = 0;
  J.grain = s.grain || 0; J.mand = s.mandDetail ?? .5; J.fracV = s.fracVortex || 0; J.tw = {};
  J.recipe = null; J.sceneKey = 'plain'; J.handScene = scene ? {sc: scene, sig: castSig(castOf())} : null;
  J.recast = false; J.adopt = true;   // the next section grows out of it (recast below) rather than replacing it
  resetProgress(); saveCast(); updateSectionUI();
}
export function recast(fresh, keep){
  const ty = J.type || OPENING, key = J.world;
  ty.casts = ty.casts || {};
  J.recast = false;
  // a world coming in or going to rest changes only the world: the layers, the hit and the object carry on, and the scene
  // is chosen again to relate them to it (it used to bring a whole other cast at once: lead, object and kaleidoscope)
  if (keep === true && J.lead) { J.adopt = false; setLens(); chooseScene(relFeats(), false); saveCast(); recipeMods(); updateSectionUI(); return; }
  // a progression step through steady music (progression.js): a new recipe and lead (and its accent), the object, the hit
  // and the kaleidoscope carrying on, so it moves on one part at a time
  if (keep === 'lead' && J.lead) {
    J.adopt = false; const rf = relFeats(), prev = J.lead; J.recipe = pickRecipe(ty, rf, true); setLens();
    const sc = scoreElems(ty, rf, true); sc.forEach(r => { if (r.k === prev) r.v -= 1; }); sc.sort((a, b) => b.v - a.v);
    J.lead = sc[0].k; chooseAccent(sc); chooseScene(rf, true); chooseTw(); saveCast(); recipeMods(); updateSectionUI(); return;
  }
  // the first new section after a look handed back changes one thing about it, as a progression step would
  if (J.adopt && !fresh) { J.adopt = false; varySmall(); updateSectionUI(); return; }   // (the look's own movers stay)
  J.adopt = false;
  const cast = ty.casts[key];
  const steered = c => c && (banned(c.lead) || banned(c.accent) || (c.hit && banned(c.hit)) || (c.centre && banned(c.centre)) || banned(c.sceneKey)
    || Object.keys(STEER.pin).some(k => byKey[k] && byKey[k].kind === 'layer' && c.lead !== k && c.accent !== k));
  if (!fresh && cast && !steered(cast)) {                         // a returning part looks the same (unless steering says otherwise)...
    ({lead: J.lead, accent: J.accent, hit: J.hit, recipe: J.recipe} = cast);
    J.accTrig = cast.accTrig || ACCENT[J.accent]; J.accEnv = 0; J.centre = cast.centre || null; J.objStyle = cast.objStyle || 0; J.litLook = cast.litLook || 0; J.stage = !!cast.stage; J.stageStyle = cast.stageStyle; J.sceneKey = cast.sceneKey || 'plain';
    J.kal = cast.kal || null; genKalApply(); J.grain = cast.grain || 0; J.tw = cast.tw || {}; applyTw(); J.mand = cast.mand ?? .5; J.fracV = cast.fracV || 0;
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
