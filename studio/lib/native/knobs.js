// The native instruments' knobs: for each instrument the page and the DAW offer, which of its physics a knob moves (the
// setting's key, its label, its range and step), and a sensible starting value for each.
const MODAL_K = [['hard', 'Hardness', .1, 1, .01], ['pos', 'Strike point', .05, .5, .01], ['ring', 'Ring', .3, 3, .05]];
export const INST = {
  kick: {label: 'Kick (struck skin)', knobs: [['drop', 'Pitch drop', .3, 3, .05], ['decay', 'Decay', .2, 1.2, .02], ['body', 'Body', 0, 1, .02], ['hard', 'Beater', .1, 1, .02]]},
  hat: {label: 'Hats (noise and metal)', knobs: [['decay', 'Decay', .02, .3, .005], ['tone', 'Tone', 0, 1, .02]]},
  tom: {label: 'Toms (struck skins)', knobs: [['decay', 'Decay', .2, 1.2, .02], ['drop', 'Pitch drop', 0, .6, .01], ['hard', 'Hardness', .1, 1, .02], ['pos', 'Strike point', .1, .5, .01]]},
  hand: {label: 'Hand drum', knobs: [['decay', 'Decay', .1, .8, .02], ['drop', 'Pitch drop', 0, .4, .01], ['hard', 'Hardness', .1, 1, .02]]},
  marimba: {label: 'Marimba', knobs: MODAL_K}, kalimba: {label: 'Kalimba', knobs: MODAL_K}, steel: {label: 'Steel drum', knobs: MODAL_K},
  musicbox: {label: 'Music box', knobs: MODAL_K}, vibes: {label: 'Vibraphone', knobs: [...MODAL_K, ['trem', 'Tremolo', 0, .9, .02]]},
  wood: {label: 'Woodblock', knobs: MODAL_K}, tubular: {label: 'Tubular bell', knobs: MODAL_K}, bell: {label: 'Church bell', knobs: MODAL_K},
  plate: {label: 'Metal plate', knobs: MODAL_K}, glass: {label: 'Glass bar', knobs: MODAL_K},
  fmglass: {label: 'FM glass bass', held: 1, knobs: [['index', 'Bend', .2, 6, .05], ['ratio', 'Ratio', .5, 7, .05], ['dec', 'Decay', .05, .8, .01], ['sus', 'Sustain', 0, 1, .02]]},
  fmround: {label: 'FM round bass', held: 1, knobs: [['index', 'Bend', .2, 4, .05], ['ratio', 'Ratio', .5, 4, .05], ['dec', 'Decay', .05, .8, .01], ['sus', 'Sustain', 0, 1, .02]]},
  fmpluck: {label: 'FM pluck bass', held: 1, knobs: [['index', 'Bend', .2, 6, .05], ['ratio', 'Ratio', .5, 7, .05], ['dec', 'Decay', .03, .5, .01], ['fb', 'Feedback', 0, 1, .02]]},
  pluck: {label: 'Plucked string', knobs: [['bright', 'Brightness', .05, 1, .02], ['damp', 'Sustain', .98, .999, .0005], ['body', 'Body', 0, 1, .02]]},
  fmbell: {label: 'FM bell', held: 1, knobs: [['index', 'Bend', .2, 5, .05], ['ratio', 'Ratio', .5, 7, .05], ['r', 'Release', .1, 2.5, .05]]},
  addpad: {label: 'Bloom pad (additive)', held: 1, knobs: [['bloom', 'Bloom', 0, 10, .1], ['wob', 'Sway', 0, .8, .02], ['tilt', 'Darkness', .6, 2.4, .02], ['a', 'Attack', .05, 3, .05]]},
  breath: {label: 'Breath pad', held: 1, knobs: [['q', 'Focus', 15, 160, 1], ['air', 'Air', 0, .3, .01], ['a', 'Attack', .05, 3, .05]]},
  grainpad: {label: 'Grain pad', held: 1, knobs: [['density', 'Density', 4, 60, 1], ['a', 'Attack', .05, 3, .05]]},
};
export function defaultOf(inst, k, lo, hi){ const D = {hard: .5, pos: .27, ring: 1, drop: inst === 'kick' ? 1.6 : .25, decay: inst === 'kick' ? .45 : inst === 'hat' ? .06 : .55, body: inst === 'pluck' ? .55 : .5, tone: .6, trem: .45,
  index: 2, ratio: inst === 'fmglass' ? 3.5 : inst === 'fmpluck' ? 2 : inst === 'fmbell' ? 1.4 : 1, dec: .25, sus: .2, fb: .3, bright: .45, damp: .993, r: .8, bloom: 3, wob: .35, tilt: 1.3, a: inst === 'addpad' ? 1.2 : .8, q: 70, air: .04, density: 26};
  return D[k] ?? (lo + hi)/2; }
