// Journey: element lists, what each element suits, and the director's state (J, jState).
import { SPEC, curP } from '../presets.js';

/* ---------- Journey: one continuously evolving composition ---------- */
export const ELEMS = ['ring','scope','plasma','burst','comets','flow','ribbons','horizon'];
// hits: one-off shapes fired by the music, drawn crisp rather than into the trails
import { HITS, WORLDS } from '../visuals/registry.js';
export { HITS, WORLDS };
export const worldOn = () => J.world !== 'none' && !!J.world;
// everything that switches in and out, so it can either fade or cut in on the bar line
export const TKEYS = [...ELEMS, ...WORLDS, 'sym', 'mirror'];
export const SNAP = new Set([...TKEYS, ...HITS]);
// what each element suits. perc: steady kicks. busy: lots of stabs and hits. bright: treble-heavy.
// low: bass-heavy. mid: melodic middle. T: overall intensity. (features run 0..1, centred on .5)
export const SUITS = {
  ring:    {perc:.8, low:.4},
  burst:   {bright:.9, T:.5},
  scope:   {mid:.7, busy:.3},
  plasma:  {perc:-.6, T:-.5, low:.3},
  comets:  {busy:.4, T:-.2},
  flow:    {perc:-.5, T:-.4, mid:.3},
  ribbons: {mid:.6, perc:-.3, bright:.3},
  horizon: {perc:.7, low:.4, T:.3},
};
export const FEATS = ['perc','busy','bright','low','mid','lvl'];
export const OPENING = {seed:{ring:0, scope:0, plasma:0, burst:0, comets:0, flow:0, ribbons:0, horizon:0}, hue:.6, zoomBias:0, spin:1, lens:null, recipeSeed:{},
  cut:0, hitSeed:{none:.3, star:0, shock:0}, starN:5, starOut:'snap', starScatter:false};
export const FWEIGHT = {perc:1.2, busy:.6, bright:1, low:.8, mid:.8, lvl:.8};
export const J = {on:true, bias:.5, speed:1, clock:0, tension:.15, hi:.3, lo:.2, intro:1, bar:0, pos:0, upos:0, beats:0, phraseAnchor:0, novBar:0, progBeats:0, spinDir:1,
  eS:0, eM:0, eL:.2, peak:.3, tmin:.3, lastDrop:-1e9, phase:0, ringR:.2, ringSq:0, zoomFlip:0, dropGlow:0,
  fat:{}, kr:0, hr:0, fF:{}, fS:{}, fMin:{}, fMax:{}, M:null, secAge:0, identified:false, novAvg:.05, nov:0,
  pending:false, pendingSince:0, types:[], type:null, hueOff:0, ribAng:0, ribPh:0, horScroll:0, horY:.05,
  style:'fade', goal:{}, held:{}, cutSince:0, cutNow:false, phraseNow:false, wipe:0, hit:null};
ELEMS.forEach(k => J.fat[k] = 0);
FEATS.forEach(f => { J.fF[f] = J.fS[f] = .5; J.fMin[f] = .4; J.fMax[f] = .6; });
export const jState = {name:'Journey', mods:{}};
SPEC.forEach(s => jState[s.k] = curP[s.k]);
