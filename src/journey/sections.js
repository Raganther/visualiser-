// Journey: listening to the music, detecting sections and recognising ones that return.
import { S } from '../state.js';
import { LIN } from '../audio/analysis.js';
import { shocks } from '../fx/effects.js';
import { ELEMS, FEATS, FWEIGHT, HITS, J } from './core.js';
import { pickStyle } from './transitions.js';
import { chooseWorld } from './worlds.js';
import { eff, presets } from '../presets.js';
import { freq } from '../state.js';
import { updateSectionUI } from '../ui/panel.js';
import { sstep } from '../util.js';
import { TUNE } from '../tuning.js';

export function fdist(A, B){ let d = 0; for (const f of FEATS) d += FWEIGHT[f]*Math.abs(A[f] - B[f]); return d/FEATS.length; }
export function newType(F){
  const used = J.types.map(t => t.hue);
  let hue = Math.random();
  for (let tries = 0; tries < 12 && used.some(h => Math.min(Math.abs(h - hue), 1 - Math.abs(h - hue)) < .15); tries++) hue = Math.random();
  const seed = {}; ELEMS.forEach(k => seed[k] = (Math.random() - .5)*.7);
  const t = {label: String.fromCharCode(65 + J.types.length % 26), F: {...F}, seed, hue, visits: 0,
    zoomBias: (Math.random() - .3)*.015, spin: .3 + Math.random()*1.2, lens: randomLens(), recipeSeed: recipeSeeds(),
    cut: Math.random(), hitSeed: hitSeeds(),
    outN: [3, 4, 4, 6][Math.floor(Math.random()*4)],
    starN: [4, 5, 5, 6, 8][Math.floor(Math.random()*5)], starOut: Math.random() < .5 ? 'snap' : 'flicker', starScatter: Math.random() < .5};
  J.types.push(t); return t;
}
// how much a section likes each hit (and having none), drawn once when the section is first heard
function hitSeeds(){
  const o = {none: (Math.random() - .3)*.5};
  for (const k of HITS) o[k] = (Math.random() - .5)*.6;
  return o;
}
// a section's own lens, used when its recipe has none: most have none, a few mirror or fold
export function randomLens(){
  const r = Math.random();
  return r < .06 ? {n:2, mirror:1} : r < .15 ? {n:3 + Math.floor(Math.random()*4), mirror:.8} : null;
}
export function recipeSeeds(){ const o = {}; presets.filter(p => p.journey !== false).forEach(p => o[p.name] = (Math.random() - .5)*.7); return o; }
export function matchType(F){
  let best = null, bd = 1e9;
  for (const t of J.types) { const d = fdist(F, t.F); if (d < bd) { bd = d; best = t; } }
  return bd < TUNE.sameType*(1 - .4*stillness()) ? best : newType(F);
}
export function enterType(t){ if (J.type !== t) { t.visits++; J.type = t; chooseWorld(); J.recast = true; resetProgress(); updateSectionUI(); } }
// 0 when the music has just changed, rising to 1 after about two minutes of sameness
export function stillness(){ return sstep(TUNE.stillFrom, TUNE.stillTo, J.stillT || 0); }
export function resetProgress(){ J.stillT = 0; J.progBeats = 0; J.progT = 0; J.progStep = 0; }
export function newSection(strength){
  J.pending = false; J.secAge = 0; J.identified = 0; J.novHold = 0; J.M = {...J.fF};
  J.phraseAnchor = J.novBar <= J.bar && J.bar - J.novBar < 8 ? J.novBar : J.bar;   // phrases count from the new section's first bar
  enterType(matchType(J.fF));
  pickStyle(strength);
  // a flourish on the bar line to mark the change
  if (eff.shock > .2) {
    const asp = innerWidth/innerHeight, n = 2 + Math.round(Math.min(1, strength)*3);
    for (let i = 0; i < n; i++) { const sh = shocks[S.shockN++ % 8];
      sh.x = (Math.random() - .5)*asp*.7; sh.y = (Math.random() - .5)*.7; sh.r = .01 + i*.04; sh.s = .9; }
  } else { S.beat = Math.max(S.beat, 1); J.zoomFlip = Math.random() < .5 ? -.03 : .03; S.hueKick += .1; }
  J.clock += 2;
}
export function features(dt){
  // spectral shape (independent of volume), brightness, rhythm density
  let sub = 0, lowB = 0, lmid = 0, mid = 0, hmid = 0, hi = 0, cw = 0, cs = 0;
  for (let i = 1; i < 700; i++) {
    const v = freq[i]/255;
    if (i < 9) lowB += v; else if (i < 23) lmid += v; else if (i < 93) mid += v; else if (i < 280) hmid += v; else hi += v;
    const l = LIN[freq[i]]; cw += l*i; cs += l;
  }
  lowB /= 8; lmid /= 14; mid /= 70; hmid /= 187; hi /= 420;
  const tot = lowB + lmid + mid + hmid + hi + 1e-4;
  J.kr *= Math.exp(-dt/2); J.hr *= Math.exp(-dt/2);
  const raw = {
    perc: Math.min(1, J.kr/2.2),
    busy: Math.min(1, J.hr/2.5),
    bright: cs > 0 ? Math.min(1, Math.log(1 + cw/cs)/Math.log(300)) : 0,
    low: lowB/tot, mid: (lmid + mid)/tot,
    lvl: energyLevel(),
  };
  for (const f of FEATS) {
    J.fF[f] += (raw[f] - J.fF[f])*Math.min(1, dt/1.2);
    J.fS[f] += (raw[f] - J.fS[f])*Math.min(1, dt/3);
    J.fMax[f] = Math.max(J.fS[f], J.fMax[f] - dt*.003); J.fMin[f] = Math.min(J.fS[f], J.fMin[f] + dt*.003);
  }
}
// each feature relative to this song's own range, centred on zero
// how loud it is now, 0..1: against the loudest it's been lately, over a range that can't shrink below minSpan (so a steady
// track at full tilt reads as loud, not as quiet, and tiny wobbles don't swing it end to end), blended with an absolute scale
export function energySpan(){ return Math.max(TUNE.energy.minSpan, J.hi - J.lo); }
export function energyLevel(){
  const E = TUNE.energy, span = energySpan(), rel = (J.eM - (J.hi - span))/span, abs = (J.eM - E.quiet)/(E.loud - E.quiet);
  return Math.min(1, Math.max(0, rel*(1 - E.absMix) + Math.min(1, Math.max(0, abs))*E.absMix));
}
export function relFeat(f){ return (J.fS[f] - J.fMin[f])/Math.max(.05, J.fMax[f] - J.fMin[f]) - .5; }
