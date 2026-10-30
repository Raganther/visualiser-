// The native instruments by name: each note computed from the instrument's physics (modal.js, body.js …), cached by its
// pitch, velocity and settings so a repeated note is computed once. play() places it on the desk as a buffer. Each is
// also a voice (stream.js: V, its settings D) that the live engine (studio/arrange/voices.worklet.js) runs as it plays:
// the same code as the note computed ahead (the Resonator's live voice is its own, matching it closely).
import { modal, MODAL, MODAL_D, ModalV } from './modal.js';
import { membrane, string, shaker, hat, MembraneV, MEMB_D, StringV, STRING_D, ShakerV, SHAKER_D, HatV, HAT_D } from './body.js';
import { fm, additive, breath, grainPad, rubbed, RUBBED, sub808, FmV, FM_D, AdditiveV, ADD_D, BreathV, BREATH_D, GrainV, GRAIN_D, RubbedV, RUB_D, Sub808V, SUB_D } from './tone.js';
import { va, VA, akick, KICKS, rumble, formant, hat808, VaV, VA_D, AkickV, AKICK_D, RumbleV, RUMBLE_D, FormantV, FORMANT_D, Hat808V, HAT808_D } from './analog.js';
import { drop, twig, stone, leaf, insect, click, bird, DropV, DROP_D, TwigV, TWIG_D, StoneV, STONE_D, LeafV, LEAF_D, InsectV, INSECT_D, ClickV, CLICK_D, BirdV, BIRD_D } from './natural.js';
import { hihat, HihatV, HIHAT_D } from './hats.js';

const hz = n => 440*Math.pow(2, (n - 69)/12);
export { FMP } from './fmp.js';
import { FMP } from './fmp.js';
// an instrument from its voice: how a note is computed ahead (make), and its voice and settings for the live engine
const inst = (V, D, gain, held, f) => ({V, D, gain, held, make: f || ((sr, n, vel, o) => {
  const P = {...D, ...o, vel}, v = new V(sr, hz(n), P, vel, held ? P.len : undefined); if (held) v.off(P.len);
  const L = new Float32Array(v.end), R = new Float32Array(v.end); for (let a = 0; a < v.end && !v.done; a += 4096) v.run(L, R, a, Math.min(v.end, a + 4096)); return {L, R}; })});
// the instruments: how a note is made, and its gain to sit near the poly synth's level (held: the note's length in
// seconds reaches them as o.len)
export const NATIVE = {
  ...Object.fromEntries(Object.entries(MODAL).map(([k, p]) => [k, inst(ModalV, {...MODAL_D, ...p}, p.gain ?? .5, 0, (sr, n, vel, o) => modal(sr, hz(n), p.modes, {...p, ...o, vel}))])),
  kick: inst(MembraneV, {...MEMB_D, decay: .45, drop: 1.6, dropT: .035, hard: .45, beater: .25, body: .5, drive: .3}, .9),
  tom: inst(MembraneV, {...MEMB_D, decay: .55, drop: .25, dropT: .04, hard: .5, beater: .15, pos: .35}, 1.7),
  hand: inst(MembraneV, {...MEMB_D, decay: .3, drop: .08, dropT: .02, hard: .7, beater: .4, pos: .45}, .7),
  pluck: inst(StringV, {...STRING_D, bright: .45, damp: .993, decay: 1.2, body: .55}, 1.1),
  shaker: inst(ShakerV, SHAKER_D, 2),
  hat: inst(HatV, HAT_D, .45),
  fmglass: inst(FmV, {...FM_D, ...FMP.fmglass}, .55, 1), fmround: inst(FmV, {...FM_D, ...FMP.fmround}, .7, 1),
  fmpluck: inst(FmV, {...FM_D, ...FMP.fmpluck}, .6, 1), fmbell: inst(FmV, {...FM_D, ...FMP.fmbell}, .3, 1),
  addpad: inst(AdditiveV, ADD_D, .55, 1),
  breath: inst(BreathV, BREATH_D, 2.6, 1),
  grainpad: inst(GrainV, GRAIN_D, 4, 1),
  ...Object.fromEntries(Object.entries(RUBBED).map(([k, p]) => [k, inst(RubbedV, {...RUB_D, ...p}, .7, 1)])),
  // the analog circuits: the subtractive voice's presets (held), the analog kicks, the rumble, the formant pad, 808 hats
  ...Object.fromEntries(Object.entries(VA).map(([k, p]) => [k, inst(VaV, {...VA_D, ...p}, k === 'vapluck' ? .9 : .5, 1)])),
  ...Object.fromEntries(Object.entries(KICKS).map(([k, p]) => [k, inst(AkickV, {...AKICK_D, ...p}, .45)])),
  rumble: inst(RumbleV, RUMBLE_D, .5, 1),
  formant: inst(FormantV, FORMANT_D, 3, 1),
  hat808: inst(Hat808V, HAT808_D, 1.2),
  // the hi-hat as two cymbals clashing (hats.js): open from a chick to a wash, brighter and longer the harder it's hit
  hihat: inst(HihatV, HIHAT_D, .18),
  // nature
  drop: inst(DropV, DROP_D, .8), twig: inst(TwigV, TWIG_D, 2.5), stone: inst(StoneV, STONE_D, .5), leaf: inst(LeafV, LEAF_D, .8),
  insect: inst(InsectV, INSECT_D, 3), click: inst(ClickV, CLICK_D, 6), bird: inst(BirdV, BIRD_D, .5, 1),
  sub808: inst(Sub808V, SUB_D, .35, 1),
};

const cache = new Map(), q = (v, s) => Math.round(v/s)*s;
export function noteBuffers(sr, name, n, vel, o = {}){
  const key = `${name}|${n}|${q(vel, .1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;
  let b = cache.get(key); if (!b) { b = NATIVE[name].make(sr, n, q(vel, .1), o); cache.set(key, b); } return b;
}
