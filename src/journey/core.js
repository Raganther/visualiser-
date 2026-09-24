// Journey: element lists, what each element suits, and the director's state (J, jState).
import { SPEC, curP } from '../presets.js';

/* ---------- Journey: one continuously evolving composition ---------- */
// layers, hits and worlds, and what Journey knows about each, come from the visual registry
import { ELEMS, HITS, OPT_IN, SUITS, WORLDS } from '../visuals/registry.js';
export { ELEMS, HITS, SUITS, WORLDS };
export const worldOn = () => J.world !== 'none' && !!J.world;
// everything that switches in and out, so it can either fade or cut in on the bar line
export const TKEYS = [...ELEMS, ...WORLDS, 'sym', 'mirror', ...OPT_IN];
export const SNAP = new Set([...TKEYS, ...HITS]);
export const FEATS = ['perc','busy','bright','low','mid','lvl'];
export const OPENING = {seed:{ring:0, scope:0, plasma:0, burst:0, comets:0, flow:0, ribbons:0, horizon:0}, hue:.6, zoomBias:0, spin:1, lens:null, recipeSeed:{},
  cut:0, hitSeed:{none:.3, star:0, shock:0}, starN:5, starOut:'snap', starScatter:false};
export const FWEIGHT = {perc:1.2, busy:.6, bright:1, low:.8, mid:.8, lvl:.8};
export const J = {on:true, bias:.5, speed:1, clock:0, tension:.15, hi:.3, lo:.2, intro:1, bar:0, pos:0, upos:0, beats:0, phraseAnchor:0, novBar:0, progBeats:0, spinDir:1,
  eS:0, eM:0, eL:.2, peak:.3, tmin:.3, lastDrop:-1e9, phase:0, ringR:.2, ringSq:0, zoomFlip:0, dropGlow:0,
  fat:{}, wFat:{}, userMods:{}, kr:0, hr:0, fF:{}, fS:{}, fMin:{}, fMax:{}, M:null, secAge:0, identified:false, novAvg:.05, nov:0,
  pending:false, pendingSince:0, types:[], type:null, hueOff:0, ribAng:0, ribPh:0, horScroll:0, horY:.05,
  style:'fade', goal:{}, held:{}, cutSince:0, cutNow:false, phraseNow:false, wipe:0, hit:null};
ELEMS.forEach(k => J.fat[k] = 0);
FEATS.forEach(f => { J.fF[f] = J.fS[f] = .5; J.fMin[f] = .4; J.fMax[f] = .6; });
export const jState = {name:'Journey', mods:{}};
SPEC.forEach(s => jState[s.k] = curP[s.k]);
