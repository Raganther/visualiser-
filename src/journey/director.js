// Journey: the per-frame director, drops, fresh starts, nudges and debug state.
import { S } from '../state.js';
import { lastBeat, sBass, sMid, sTreb } from '../audio/analysis.js';
import { G } from '../audio/beatgrid.js';
import { comets, shocks } from '../fx/effects.js';
import { STAR } from '../visuals/hits/star.js';
import { OBJECT_VISUALS, OPT_IN, byKey } from '../visuals/registry.js';
import { recast } from './cast.js';
import { ELEMS, FEATS, HITS, J, OPENING, TKEYS, WORLDS, jState, worldOn } from './core.js';
import { PACE, paceName, pickPace } from './pace.js';
import { progress } from './progression.js';
import { MOTION, recipeMods, setLens } from './recipes.js';
import { enterType, fdist, features, matchType, newSection, newType, recipeSeeds, relFeat, resetProgress, stillness } from './sections.js';
import { chooseWorld } from './worlds.js';
import { eff } from '../presets.js';
import { toast } from '../ui/toast.js';
import { $, jn, reduceMotion } from '../util.js';
import { TUNE } from '../tuning.js';
import { MEDIA } from '../media/source.js';

export function stepJourney(now, dt){
  // energy at three timescales: right now, the last few seconds, the last ~20 seconds
  const e = sBass*.5 + sMid*.35 + sTreb*.3;
  J.eS += (e - J.eS)*Math.min(1, dt*6);
  J.eM += (e - J.eM)*Math.min(1, dt/2.5);
  J.eL += (e - J.eL)*Math.min(1, dt/20);
  J.peak = Math.max(J.eM, J.peak - dt*.004, .05);
  J.hi = Math.max(J.eM, J.hi - dt*.004); J.lo = Math.min(J.eM, J.lo + dt*.004);
  const span = Math.max(.06, J.hi - J.lo);
  const lvl = (J.eM - J.lo)/span, rise = (J.eM - J.eL)/span;
  J.intro = Math.max(0, J.intro - dt/25);
  const targetT = Math.min(1, Math.max(0, (lvl*.8 + rise*.5 + (J.bias - .5)*.8)*(1 - .5*J.intro)));
  J.tension += (targetT - J.tension)*Math.min(1, dt/2);
  J.tmin = Math.min(J.tension, J.tmin + dt*.06);
  J.dropGlow *= Math.pow(.35, dt);
  J.zoomFlip *= Math.pow(.25, dt);
  features(dt);
  if (!J.on) return;
  if (J.eS > J.eL*1.4 + .03 && J.tmin < .45 && lvl > .6 && J.intro < .5 && now - J.lastDrop > 15000) { J.lastDrop = now; dropFX(); }

  // ---- sections: notice when the music's character changes, and recognise parts that return
  J.secAge += dt;
  if (!J.M) J.M = {...J.fF};
  for (const f of FEATS) J.M[f] += (J.fF[f] - J.M[f])*Math.min(1, dt/Math.min(8, Math.max(2, J.secAge)));
  if (!J.type && J.secAge > 8) { enterType(newType(J.M)); J.identified = 2; }   // let the song settle before naming its first part
  J.nov = fdist(J.fF, J.M);
  J.novAvg += (J.nov - J.novAvg)*Math.min(1, dt/20);
  const still = stillness();
  const wasHold = J.novHold;
  J.novHold = J.type && J.nov > Math.max(TUNE.novelty*(1 - .5*still), J.novAvg*(TUNE.noveltyVsAvg - .5*still)) ? (J.novHold || 0) + dt : 0;
  if (!wasHold && J.novHold) J.novBar = J.bar + (J.pos >= 2 ? 1 : 0);   // the downbeat nearest to where the change began   // the change has to last, not just be a blip
  if (!J.pending && J.secAge > TUNE.sectionMinAge && J.novHold > TUNE.noveltyHold) { J.pending = true; J.pendingSince = now; J.pendStrength = J.nov*6; }
  if (J.pending && now - J.pendingSince > 1600) newSection(J.pendStrength);   // no bar line came: change anyway
  // once it has settled, ask: is this a part we've heard before? (checked twice, in case of a slow transition)
  if (J.type && (J.identified < 1 && J.secAge > 6 || J.identified < 2 && J.secAge > 14)) {
    J.identified = J.secAge > 14 ? 2 : 1;
    const prev = J.type; enterType(matchType(J.M));
    if (prev !== J.type && prev.visits <= 1 && J.types[J.types.length - 1] === prev && J.type !== prev) { J.types.pop(); }
  }
  if (J.type && J.secAge > 6) for (const f of FEATS) J.type.F[f] += (J.M[f] - J.type.F[f])*Math.min(1, dt*.05);

  const T = J.tension, sp = J.speed, ty = J.type || OPENING;
  J.clock += dt*sp*(.5 + T*.9);
  J.phase += dt/(S.beatPeriod*32);            // one breath every 8 bars
  const breath = Math.sin(J.phase*Math.PI*2);
  const c = J.clock, n01 = (k, f) => .5 + .5*jn(c*f, k);
  const tgt = {};
  // worlds get a turn and then rest, so no scene lasts forever even in a one-section track
  J.worldTime = (J.worldTime || 0) + dt;
  const wLimit = J.world === 'none' ? TUNE.worldRestSecs : TUNE.worldSecs;
  if (J.worldTime > wLimit && (J.phraseNow || J.worldTime > wLimit + TUNE.worldWaitSecs)) {   // wait for a phrase line (or give up if no beat comes)
    if (J.world === 'none') chooseWorld(true); else { J.world = 'none'; J.worldTime = 0; }
    J.recast = 'keep'; J.style = 'fade';
  }
  const wOn = worldOn();
  WORLDS.forEach(k => tgt[k] = J.world === k ? 1 : 0);
  // world fatigue, like the layers': builds while a world (or the black) is on screen, recovers while it isn't
  for (const k of [...WORLDS, 'none']) J.wFat[k] = (J.wFat[k] || 0)*Math.exp(-dt/TUNE.fatigueRecoverSecs) + (J.world === k ? dt/TUNE.fatigueBuildSecs : 0);

  // one lead element, chosen when the section changes; one accent that only appears when the music triggers it
  // fatigue: builds while an element is on screen, recovers while it rests
  ELEMS.forEach(k => J.fat[k] = J.fat[k]*Math.exp(-dt/TUNE.fatigueRecoverSecs) + dt*Math.min(1, jState[k])/TUNE.fatigueBuildSecs);
  J.stillT = (J.stillT || 0) + dt; J.progT = (J.progT || 0) + dt;
  if (J.type && now - lastBeat > TUNE.noKickMs && J.progT > TUNE.progressNoKickSecs/J.speed) progress();   // no kick to count: go by time
  if (!J.lead || J.recast) recast(J.recast === 'fresh');
  ELEMS.forEach(k => tgt[k] = 0);
  tgt[J.lead] = wOn ? .75 : .9;
  HITS.forEach(k => tgt[k] = 0);
  if (J.hit) tgt[J.hit] = byKey[J.hit].level;
  // with a video, image or camera loaded, the mirror tunnel takes over as the lead and worlds rest (it fills the screen)
  if (byKey.tunnel) {
    tgt.tunnel = MEDIA.on ? TUNE.tunnel.level : 0;
    if (MEDIA.on) { tgt[J.lead] = 0; WORLDS.forEach(k => tgt[k] = 0); }
  }
  // a centrepiece object stands in front; the lead steps back a little so it isn't crowded (the tunnel wins while media is on)
  for (const v of OBJECT_VISUALS) tgt[v.key] = J.centre === v.key && !MEDIA.on ? TUNE.mesh.level : 0;
  if (J.centre && !MEDIA.on) tgt[J.lead] *= .7;
  const trig = J.accTrig;
  if (trig === 'mid') J.accGate = relFeat('mid') > .15 && sMid > .15;
  if (trig === 'mid') J.accEnv += ((J.accGate ? 1 : 0) - J.accEnv)*Math.min(1, dt*(J.accGate ? 6 : 1.2));
  else J.accEnv *= Math.pow(trig === 'peak' ? .45 : .2, dt);
  J.accEnv = Math.max(0, Math.min(1, J.accEnv));

  // each section has its own colour family and way of moving
  let dh = ty.hue - (((J.hueOff % 1) + 1) % 1); if (dh > .5) dh -= 1; if (dh < -.5) dh += 1;
  J.hueOff += dh*Math.min(1, dt*.5);
  J.ringR = .1 + .22*n01(370, .25); J.ringSq = jn(c*.2, 380)*.3;
  J.ribAng = jn(c*.08, 390)*.6; J.horY = .02 + .12*n01(400, .15);
  // the lens comes in when the music builds and goes when it calms, decided on bar lines so it never flaps
  if (J.lens === undefined) setLens();
  if (J.lens && wOn) { setLens(); recipeMods(); }
  if (J.cutNow || now - lastBeat > 3000) {
    const want = !!J.lens && (J.lensOn ? T > TUNE.lensOff : T > TUNE.lensOn);
    if (want !== !!J.lensOn) { J.lensOn = want; recipeMods(); }
  }
  // on intense phrase lines the kaleidoscope changes its fold count
  if (J.phraseNow && J.lensOn && J.lens.n > 2) J.lensShift = T > .55 && Math.random() < .6 ? [-1, 1, 2][Math.floor(Math.random()*3)] : 0;
  tgt.sym = J.lensOn ? Math.max(2, J.lens.n + J.lensShift) : 1;
  tgt.mirror = J.lensOn ? J.lens.mirror : 0;
  if (J.centre) { tgt.sym = 1; tgt.mirror = 0; }   // never a lens over a centrepiece: the copies would crowd it
  tgt.decay = .955 - T*.05 + jn(c*.4, 320)*.012;
  tgt.zoom = 1.0 + T*.018 + ty.zoomBias + jn(c*.3, 360)*.01 + breath*.008 + J.zoomFlip;
  tgt.rot = (.35 + .65*Math.abs(jn(c*.35, 330)))*.03*(.4 + T)*J.spinDir*ty.spin;
  tgt.warp = .1 + (1.3 - T)*1.1*n01(340, .5);
  tgt.wander = .08 + (1 - T*.6)*.3*n01(350, .3);
  tgt.colorSpeed = .015 + T*.05;
  tgt.hueDrift = .004 + T*.02;
  // pace: the section's own character, lifted by intensity and the calm-to-intense slider; glides over a few seconds
  if (ty.pace === undefined) ty.pace = pickPace();
  const paceT = Math.min(1, Math.max(.03, ty.pace*.65 + T*.35 + (J.bias - .5)*.3 + breath*.04));
  J.pace = J.pace === undefined ? paceT : J.pace + (paceT - J.pace)*Math.min(1, dt/3);
  // the recipe's way of moving, half and half with Journey's own reading of the music
  if (J.recipe) for (const k of MOTION) tgt[k] += (J.recipe.p[k] - tgt[k])*.5;
  const rate = Math.min(1, dt*.4*sp);
  if (wOn) { tgt.zoom = 1 + (tgt.zoom - 1)*.4; tgt.decay -= .04; }   // keep the glow gentle over a world
  const swap = Math.min(1, dt*1.6);          // element changes happen over about a bar, not a long slide
  // a switch (something arriving or leaving) either fades, or in a cut section waits for the bar line and snaps
  for (const k of TKEYS) {
    const was = k in J.goal ? J.goal[k] : jState[k];
    if (tgt[k] === undefined) continue;
    if (Math.abs(tgt[k] - was) > .3 && J.style === 'cut') { J.held[k] = true; if (!J.cutSince) J.cutSince = now; }
    J.goal[k] = tgt[k];
  }
  const cutNow = J.cutNow || (J.cutSince && now - J.cutSince > 2500);   // no bar line came: cut anyway
  let snapped = false, cleared = false;
  for (const k in tgt) {
    if (J.held[k]) {
      if (!cutNow) continue;
      if (ELEMS.includes(k) && tgt[k] < jState[k] - .3) cleared = true;
      J.held[k] = false; jState[k] = tgt[k]; snapped = true; continue;
    }
    jState[k] += (tgt[k] - jState[k])*(HITS.includes(k) ? 1 : k === 'zoom' ? Math.min(1, dt*2) : WORLDS.includes(k) ? rate*.6 : (ELEMS.includes(k) || OPT_IN.includes(k)) ? swap : rate);
  }
  // the cut lands like a kick, and an outgoing layer's trails are wiped so the new scene starts clean
  if (snapped) { J.cutSince = 0; S.beat = Math.max(S.beat, reduceMotion ? .5 : 1); if (cleared) J.wipe = 1; }
  J.cutNow = false; J.phraseNow = false;
  if (J.accent !== J.lead) jState[J.accent] = Math.max(jState[J.accent], J.accEnv*(wOn ? .7 : .85));
}
function dropFX(){
  const asp = innerWidth/innerHeight;
  for (let i = 0; i < 6; i++) {
    const from = i < 3 ? comets[i] : {x:(Math.random() - .5)*asp*.6, y:(Math.random() - .5)*.6};
    const sh = shocks[S.shockN++ % 8]; sh.x = from.x; sh.y = from.y; sh.r = .01 + i*.03; sh.s = 1;
  }
  S.beat = 1.3; S.hueKick += .35; J.zoomFlip = -.06; J.dropGlow = 1; J.clock += 4; J.accEnv = 1; J.style = 'cut';
}
export function freshJourney(){
  J.intro = 1; J.hi = J.lo = J.eM; J.tension = Math.min(J.tension, .15);
  ELEMS.forEach(k => { jState[k] *= .15; J.fat[k] = 0; }); J.wFat = {}; jState.sym = 1; jState.mirror = 0;
  OPENING.casts = {};
  J.world = 'none'; J.worldTime = 0; J.lead = null; J.accent = null; J.accEnv = 0; J.hit = null;
  J.style = 'fade'; J.goal = {}; J.held = {}; J.cutSince = 0; resetProgress(); J.phraseAnchor = J.bar;
  J.recipe = null; J.lens = null; J.lensOn = false; J.lensShift = 0; J.centre = null; jState.mods = {};
  J.types = []; J.type = null; J.M = null; J.pending = false; J.secAge = 0; J.identified = 0; J.kr = J.hr = 0;
  FEATS.forEach(f => { J.fMin[f] = J.fS[f] - .1; J.fMax[f] = J.fS[f] + .1; });
  const el = $('#jSection'); if (el) el.textContent = 'Listening for sections';
}
window.__jdbg = () => ({pace: {v: PACE.v, name: paceName(PACE.v), div: PACE.div, ts: PACE.ts, punch: PACE.punch}, grid: {bpm: G.period && 60/G.period, locked: G.locked, conf: G.conf, down: G.down, pos: J.pos, bar: J.bar, ev: G.ev, dsure: G.dsure}, accTrig: J.accTrig, progStep: J.progStep, progBeats: J.progBeats, stillT: J.stillT, fat: {...J.fat}, recipe: J.recipe && J.recipe.name, lens: J.lens, lensOn: J.lensOn, mods: Object.keys(jState.mods).join(','), lead: J.lead, accent: J.accent, hit: J.hit, style: J.style, held: Object.keys(J.held).filter(k => J.held[k]), starAge: STAR.age, accEnv: J.accEnv, world: J.world, land: eff.land, space: eff.space, ringsVisible: shocks.filter(h => h.s > .05).length*Math.max(eff.shock, J.dropGlow), ...jState, T: J.tension, sec: J.type && J.type.label, types: J.types.length, nov: J.nov, novAvg: J.novAvg, feats: {...J.fS}});
export function nudge(){ J.clock += 6 + Math.random()*10; chooseWorld(true); J.recast = 'fresh'; J.style = 'cut'; J.cutNow = true; if (J.type) { ELEMS.forEach(k => J.type.seed[k] = (Math.random() - .5)*.7); J.type.recipeSeed = recipeSeeds(); } toast('Heading somewhere new'); }
