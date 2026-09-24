// Shockwaves: rings that ripple out on the pulse and push everything they pass through.
// They live in the trails, so their drawing stays in the feedback shader and fx/effects.js; this module
// gives Journey what it needs to choose them.
export default {
  key: 'shock', kind: 'hit', label: 'Shockwaves', trigger: 'pulse', level: .8, inTrails: true,
  words: 'Shockwaves ripple out on the kicks',
  // busy, driving music; less suited to a world
  suits: (rf, wOn, seed) => rf.busy*.4 + rf.low*.3 + rf.T*.2 + seed - (wOn ? .2 : 0),
};
