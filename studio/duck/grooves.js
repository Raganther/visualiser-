// The ducking playground's grooves: four bars each of drums (a bar of 16ths a row, repeated), and a bass, a pad and a
// lead ([step, length in 16ths, note, velocity] over the four bars), written so the parts collide where ducking matters:
// held bass under every kick, pads under the kick and under the lead. Each says which pairs it's meant to show.
import { midiOf } from '../lib/names.js';

const midi = midiOf;
const chord = (at, len, names, vel = .7) => names.split(' ').map(n => [at, len, n, vel]);
const N = list => list.map(([s, l, n, v = .8]) => ({s, l, n: midi(n), v}));

// the sounds: a round bass held long, a warm pad, a plucked lead (the analog synth's settings over its defaults)
const BASS = {w1: 0, w2: 1, oct2: -1, fine2: 4, l1: .7, l2: .6, lsub: .5, drive: .3, ftype: 0, cut: 260, res: .2, fenv: .2, fkey: .4, fa: .002, fd: .4, fs: .5, fr: .15,
  aa: .003, ad: .5, as: .95, ar: .12, mode: 1, glide: .02, slop: .3, vdrive: .2, level: .75};
const SUB = {...BASS, w1: 3, w2: 2, l1: .9, l2: .3, lsub: 0, cut: 180, fenv: 0, drive: .15};
const PAD = {w1: 1, pw1: .5, lpwm: .3, lshape: 0, lrate: .6, w2: 0, fine2: -6, l1: .8, l2: .5, ftype: 0, cut: 1600, res: .15, fenv: .15, fkey: .5,
  fa: .5, fd: 2, fs: .7, fr: 1.2, aa: .4, ad: 2, as: .95, ar: 1.4, hpf: 120, chorus: 2, mode: 0, slop: .5, level: .55};
const LEAD = {w1: 0, w2: 0, fine2: -5, l1: .8, l2: .7, ftype: 0, cut: 1400, res: .3, fenv: .45, fkey: .5, fa: .005, fd: .4, fs: .5, fr: .25,
  aa: .005, ad: .4, as: .85, ar: .25, mode: 2, glide: .05, lrate: 5.2, emix: .2, etime: 1, efb: .3, slop: .4, level: .5};

export const GROOVES = [
  {id: 'held', name: 'Held bass', style: 'Minimal techno', bpm: 124, kit: 'Analog Deep', pairs: {kb: true, lp: true, kp: false},
    words: 'A bass held right through every kick: the clash ducking was made for. The pad sits under a slow lead.',
    drums: {kick: 'X...x...x...x...', chh: '..x...x...x...x.', clap: '....x.......x...', rim: '.......o.....o..'},
    bass: {patch: BASS, notes: N([[0, 15, 'A1', .9], [16, 15, 'A1', .85], [32, 15, 'F1', .9], [48, 8, 'G1', .85], [56, 7, 'E1', .8]])},
    pad: {patch: PAD, notes: N([...chord(0, 32, 'A2 E3 G3 C4'), ...chord(32, 16, 'F2 C3 E3 A3'), ...chord(48, 16, 'G2 D3 F3 B3')])},
    lead: {patch: LEAD, notes: N([[8, 6, 'E4'], [14, 2, 'G4'], [16, 8, 'A4'], [28, 4, 'G4'], [40, 6, 'C5'], [46, 2, 'B4'], [48, 10, 'A4'], [60, 4, 'E4']])}},
  {id: 'pump', name: 'Pumping chords', style: 'House', bpm: 122, kit: 'Analog 909', pairs: {kb: true, lp: false, kp: true},
    words: 'Chords held under a four-to-the-floor kick, pumping round it; the bass on the off-beats, between the kicks.',
    drums: {kick: 'X...x...x...x...', ohh: '..x...x...x...x.', clap: '....x.......x...', shaker: 'oxoxoxoxoxoxoxox'},
    bass: {patch: {...BASS, as: .6, fs: .2, level: .7}, notes: N([2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62].map((s, i) => [s, 1.6, i < 8 ? 'A1' : i < 12 ? 'F1' : 'G1', .8]))},
    pad: {patch: {...PAD, level: .65}, notes: N([...chord(0, 32, 'A2 C3 E3 G3', .75), ...chord(32, 16, 'F2 A2 C3 E3', .75), ...chord(48, 16, 'G2 B2 D3 F3', .75)])},
    lead: {patch: LEAD, notes: N([[36, 4, 'C5'], [40, 4, 'B4'], [44, 8, 'A4']])}},
  {id: 'sub', name: 'Deep sub', style: 'Deep techno', bpm: 126, kit: 'Analog Deep', pairs: {kb: true, lp: true, kp: false},
    words: 'A sine sub held for bars under a long, deep kick: both in the same octave, so without ducking they fight.',
    drums: {kick: 'X...x...x...x...', chh: 'o.x.o.x.o.x.o.x.', ohh: '..............x.', rim: '...o......o.....'},
    bass: {patch: SUB, notes: N([[0, 31, 'A1', .9], [32, 31, 'G1', .9]])},
    pad: {patch: {...PAD, cut: 1100, level: .5}, notes: N([...chord(0, 64, 'A2 E3 C4', .6)])},
    lead: {patch: {...LEAD, emix: .35}, notes: N([[6, 3, 'E5', .7], [22, 3, 'D5', .7], [38, 3, 'C5', .7], [54, 6, 'A4', .7]])}},
];
// the pairs: who makes room for whom; the key is the strip a sidechain compressor listens to, `from` what the ducker reads
export const PAIRS = [
  {id: 'kb', name: 'Kick → bass', target: 'bass', key: 'kick', from: 'k:kick', words: 'The bass gets out of the kick\'s way.',
    comp: {thr: -16, ratio: 6, att: 3, rel: 140, range: 12, band: 0}, notes: {depth: 12, pre: 4, hold: 8, len: .4, shape: 0, vel: .5, band: 0}},
  {id: 'lp', name: 'Lead → pad', target: 'pad', key: 'lead', from: 'l', words: 'The pad steps back while the lead plays.',
    comp: {thr: -26, ratio: 3, att: 15, rel: 300, range: 6, band: 0}, notes: {depth: 5, pre: 25, hold: 0, len: .5, shape: 0, vel: .3, band: 0}},
  {id: 'kp', name: 'Kick → pad', target: 'pad', key: 'kick', from: 'k:kick', words: 'The pad pumps round the kick, as house chords do.',
    comp: {thr: -16, ratio: 10, att: 3, rel: 250, range: 9, band: 0}, notes: {depth: 9, pre: 3, hold: 5, len: .8, shape: 2, vel: .3, band: 0}},
];
