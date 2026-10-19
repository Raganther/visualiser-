// The pad lab: twelve pads, from held washes to rhythmic chords, over the drums and the dotted plucked bass.
import { BPM, BARS, W, SWING, CH, SAW, SQUARE, TRI, SINE, SUPER, synth, bars, labScore } from './kit.js';
export const meta = {title: 'Pad lab', part: 'pad', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 21, over: 'drums and the plucked dotted bass'};

// a held pad: the chord for four bars (or two, a little moved)
const held = (preset, set, {voicing = 0, every = 4, vel = .55} = {}) => d => {
  const s = synth(d, 'pad', preset, set); bars((bar, k, c) => { if (k % every === 0) d.chord(s, CH[c].map(n => n + voicing), bar, 0, every*16 - 1, vel); }); };
// a rhythmic pad: the chord on the given 16ths, each len long
const rhythm = (preset, set, steps, len, {vel = .6, voicing = 0} = {}) => d => {
  const s = synth(d, 'pad', preset, set); bars((bar, k, c) => { for (const st of (typeof steps === 'function' ? steps(k) : steps)) d.chord(s, CH[c].map(n => n + voicing), bar, st, len, vel); }); };

export const IDEAS = [
  {id: 'warm', name: 'Warm LFO pad', words: 'The one you liked in Slow Bloom: two saws, soft filter, a slow wobble, held four bars.',
    build: held('Warm pad', {aa: 1.2, ad: 2, as: .85, ar: 2.6, cut: 1300, res: .06, fenv: .15, lamt: .12, chorus: .2, width: 1, level: .55})},
  {id: 'strings', name: 'String ensemble', words: 'A detuned supersaw section, slow bow, a little vibrato: lush and cinematic.',
    build: held('Strings', {aa: .9, ar: 2.2, cut: 2200, level: .55})},
  {id: 'glass', name: 'Glass pad', words: 'Sine and triangle with a bell overtone, slowly swelling: crystalline and still.',
    build: held('Glass bell', {aa: 1.4, ad: 3, as: .7, ar: 3, oct: 0, chorus: .6, width: 1, level: .5})},
  {id: 'dark', name: 'Dark low pad', words: 'The chord an octave down through a nearly closed filter: a deep, warm shadow.',
    build: held('Warm pad', {aa: 1.5, ad: 2, as: .9, ar: 3, cut: 500, res: .1, fenv: .1, lamt: .1, chorus: .3, width: 1, level: .7}, {voicing: -12})},
  {id: 'air', name: 'Airy breath', words: 'A thin pad with breathy noise in it, the filter open: air and shimmer above the groove.',
    build: held('Warm pad', {noise: .35, aa: 1.6, ad: 2, as: .8, ar: 3, cut: 4500, res: .05, fenv: 0, chorus: .6, width: 1, level: .45}, {voicing: 12})},
  {id: 'gated', name: 'Gated 16ths', words: 'The warm pad chopped into 16ths, accents on the off-beats: a rhythmic shimmer.',
    build: rhythm('Warm pad', {aa: .005, ad: .12, as: 0, ar: .06, cut: 1800, fenv: .2, fd: .1, lamt: 0, chorus: .3, width: 1, level: .5},
      Array.from({length: 16}, (_, i) => i), .8, {vel: .45})},
  {id: 'dub', name: 'Dub chord swells', words: 'Dub chords on the off-beat swelling in slowly and fading into the echo.',
    build: rhythm('Dub chord', {chord: 0, aa: .08, ad: .6, as: .2, ar: .5, cut: 900, res: .3, chorus: .3, width: .8, level: .55}, [2, 10], 4)},
  {id: 'organ', name: 'Soft organ', words: 'Square and sub, no filter movement, held: a warm, steady, slightly retro body.',
    build: held('Warm pad', {w1: SQUARE, w2: SINE, semi: 12, mix2: .3, sub: .3, aa: .3, ad: 1, as: .9, ar: 1, cut: 2200, res: 0, fenv: 0, lamt: 0, chorus: .4, width: .8, level: .4})},
  {id: 'wash', name: 'Supersaw wash', words: 'A wide supersaw chord, filtered: big and bright, euphoric without being harsh.',
    build: held('Supersaw lead', {chord: 0, spread: .6, aa: 1, ad: 2, as: .8, ar: 2.5, cut: 2400, res: .05, fenv: .1, chorus: .6, width: 1, mode: 0, level: .4})},
  {id: 'shimmer', name: 'Octave shimmer', words: 'The warm pad with a second oscillator an octave up, heavy chorus: glistening.',
    build: held('Warm pad', {semi: 12, mix2: .5, aa: 1.3, ad: 2, as: .85, ar: 3, cut: 2600, fenv: .15, chorus: .9, width: 1, level: .5})},
  {id: 'dotted', name: 'Dotted chord pulse', words: 'Short chords on dotted 8ths (every three 16ths), rolling over the bar like the bass.',
    build: rhythm('Stab chord', {chord: 0, aa: .004, ad: .25, as: .05, ar: .2, cut: 1100, res: .25, fenv: .4, fd: .15, chorus: .4, width: .9, level: .5},
      k => { const out = []; for (let g = Math.ceil(k*16/3)*3; g < (k + 1)*16; g += 3) out.push(g - k*16); return out; }, 1.5, {vel: .5})},
  {id: 'sweep', name: 'Slow filter sweep', words: 'The warm pad with its filter swept open and closed by a two-bar LFO: breathing.',
    build: held('Warm pad', {aa: 1, ad: 2, as: .85, ar: 2.6, cut: 900, res: .25, fenv: 0, ldest: 1, lsync: 9, lamt: .7, chorus: .3, width: 1, level: .6})},
];
export const score = labScore('pad', IDEAS);
