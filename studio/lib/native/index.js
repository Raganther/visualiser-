// The native instruments by name: each note computed from the instrument's physics (modal.js, body.js), cached by its
// pitch, velocity and settings so a repeated note is computed once. play() places it on the desk as a buffer.
import { modal, MODAL } from './modal.js';
import { membrane, string, shaker } from './body.js';
import { fm, additive, breath, grainPad } from './tone.js';

const hz = n => 440*Math.pow(2, (n - 69)/12);
// the instruments: how a note is made, and its gain to sit near the poly synth's level
export const NATIVE = {
  ...Object.fromEntries(Object.entries(MODAL).map(([k, p]) => [k, {make: (sr, n, vel, o) => modal(sr, hz(n), p.modes, {...p, ...o, vel}), gain: .5}])),
  kick: {make: (sr, n, vel, o) => membrane(sr, hz(n), {decay: .45, drop: 1.6, dropT: .035, hard: .45, beater: .25, body: .5, ...o, vel}), gain: .9},
  tom: {make: (sr, n, vel, o) => membrane(sr, hz(n), {decay: .55, drop: .25, dropT: .04, hard: .5, beater: .15, pos: .35, ...o, vel}), gain: .7},
  hand: {make: (sr, n, vel, o) => membrane(sr, hz(n), {decay: .3, drop: .08, dropT: .02, hard: .7, beater: .4, pos: .45, ...o, vel}), gain: .7},
  pluck: {make: (sr, n, vel, o) => string(sr, hz(n), {bright: .45, damp: .993, decay: 1.2, body: .55, ...o, vel}), gain: 1.1},
  shaker: {make: (sr, n, vel, o) => shaker(sr, {...o, vel}), gain: 2},
  // held sounds (`held`: the note's length in seconds reaches them as o.len)
  fmglass: {held: 1, make: (sr, n, vel, o) => fm(sr, hz(n), {ratio: 3.5, index: 2.2, indexEnd: .25, indexT: .09, dec: .25, sus: .15, r: .12, ...o, vel}), gain: .55},
  fmround: {held: 1, make: (sr, n, vel, o) => fm(sr, hz(n), {ratio: 1, index: 1.3, indexEnd: .15, indexT: .06, dec: .2, sus: .45, r: .07, ...o, vel}), gain: .7},
  fmpluck: {held: 1, make: (sr, n, vel, o) => fm(sr, hz(n), {ratio: 2, index: 3.2, indexEnd: .1, indexT: .05, dec: .14, sus: 0, r: .06, fb: .3, ...o, vel}), gain: .6},
  fmbell: {held: 1, make: (sr, n, vel, o) => fm(sr, hz(n), {ratio: 1.4, index: 1.6, indexEnd: .5, indexT: .4, a: .004, dec: .6, sus: .2, r: .8, ...o, vel}), gain: .3},
  addpad: {held: 1, make: (sr, n, vel, o) => additive(sr, hz(n), {...o, vel}), gain: .55},
  breath: {held: 1, make: (sr, n, vel, o) => breath(sr, hz(n), {...o, vel}), gain: 2.6},
  grainpad: {held: 1, make: (sr, n, vel, o) => grainPad(sr, hz(n), {...o, vel}), gain: 4},
};

const cache = new Map(), q = (v, s) => Math.round(v/s)*s;
export function noteBuffers(sr, name, n, vel, o = {}){
  const key = `${name}|${n}|${q(vel, .1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;
  let b = cache.get(key); if (!b) { b = NATIVE[name].make(sr, n, q(vel, .1), o); cache.set(key, b); } return b;
}
