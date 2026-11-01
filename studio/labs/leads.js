// The lead lab: twelve leads and melodies, different motifs and sounds, over the drums, the dotted plucked bass and the
// warm pad. Melodies are in A minor, following the chords (Am9, Fmaj9, Dm9, Em7, four bars each).
import { BPM, BARS, W, SWING, CH, SAW, SQUARE, TRI, SINE, SUPER, synth, bars, deg, labScore } from './kit.js';
export const meta = {title: 'Lead lab', part: 'lead', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 31, over: 'drums, the plucked dotted bass and the warm pad'};

// a phrase over the 16 bars: [bar, 16th, note, length in 16ths, velocity?]
const phrase = (preset, set, notes) => d => { const s = synth(d, 'lead', preset, set); for (const [b, st, n, l, v = .7] of notes) d.note(s, n, W + b, st, l, v); };
// per bar, from the chord: fn(n, r, t, k) with r the root an octave and a half up
const perBar = (preset, set, fn, base = 57) => d => { const s = synth(d, 'lead', preset, set);
  bars((bar, k, c, r, t) => fn((note, st, l, v = .7) => d.note(s, note, bar, st, l, v), base + (r - 33), t, k)); };
const echo = (d, db) => { d.buses.lead.a.gain.value = Math.pow(10, db/20); };

// Slow Bloom's melody A (long tones, a call and an answer every four bars)
const LONG = [[0, 0, 76, 12], [0, 14, 74, 2], [1, 0, 72, 14], [2, 8, 71, 4], [2, 12, 72, 4], [3, 0, 76, 10],
  [4, 0, 72, 12], [4, 14, 69, 2], [5, 0, 67, 14], [6, 8, 69, 4], [6, 12, 72, 4], [7, 0, 76, 10],
  [8, 0, 77, 12], [8, 14, 76, 2], [9, 0, 74, 14], [10, 8, 72, 4], [10, 12, 69, 4], [11, 0, 76, 10],
  [12, 0, 79, 12], [12, 14, 74, 2], [13, 0, 71, 14], [14, 8, 74, 4], [14, 12, 76, 4], [15, 0, 76, 14]];
// a descending counter-melody, one note a bar, the chord's colour tones
const COUNTER = [[0, 0, 79, 14], [1, 0, 76, 14], [2, 0, 74, 14], [3, 0, 72, 12], [4, 0, 76, 14], [5, 0, 72, 14], [6, 0, 71, 14], [7, 0, 69, 12],
  [8, 0, 77, 14], [9, 0, 76, 14], [10, 0, 74, 14], [11, 0, 72, 12], [12, 0, 74, 14], [13, 0, 71, 14], [14, 0, 67, 14], [15, 0, 69, 14]];

export const IDEAS = [
  {id: 'long', name: 'Long tones', words: "Slow Bloom's melody A: held notes, a call and an answer every four bars, on a soft gliding saw.",
    build: phrase('Supersaw lead', {w1: SAW, w2: TRI, fine: 6, mix2: .5, cut: 1500, res: .12, fenv: .25, fa: .08, fd: .6, fs: .5, aa: .06, ad: .8, as: .7, ar: .9, chorus: .5, width: .9, glide: .06, mode: 2, level: .5}, LONG)},
  {id: 'hook', name: 'Syncopated hook', words: 'Short plucked notes on the off-16ths from the chord, the second bar answering the first.',
    build: perBar('Supersaw lead', {w1: SQUARE, w2: SAW, fine: 5, mix2: .4, cut: 900, res: .3, fenv: .55, fd: .14, fs: .05, aa: .002, ad: .2, as: .1, ar: .15, chorus: .3, width: .8, mode: 0, level: .55},
      (n, r, t, k) => { for (const [s, i] of [[[3, 2], [6, 0], [10, 4], [13, 2]], [[3, 2], [7, 3], [11, 1], [14, 0]]][k % 2]) n(r + 12 + t[i] - (r + 12 > 72 ? 12 : 0), s, 1.5, .65); })},
  {id: 'bell', name: 'Bell motif', words: 'High, sparse bells on dotted 8ths walking up the chord and back.',
    build: perBar('Glass bell', {oct: 0, ad: 1.1, ar: 1.2, chorus: .4, width: .8, level: .55},
      (n, r, t, k) => { const w = [0, 2, 4, 3, 1, 2, 4, 0]; for (let j = 0; j < 5; j++) { const s = j*3 + (k % 2 ? 2 : 0); if (s < 16) n(r + 24 + t[w[(j + k) % 8]] - (r > 60 ? 12 : 0), s, 2, j ? .45 : .55); } })},
  {id: 'flute', name: 'Breathy flute', words: 'A sine with breath noise, slow legato phrases: soft and human.',
    build: phrase('Sub bass', {w1: SINE, w2: TRI, mix2: .2, sub: 0, noise: .12, cut: 5000, res: 0, fenv: 0, aa: .09, ad: .5, as: .8, ar: .5, mode: 2, glide: .08, ldest: 0, lrate: 5, lamt: .04, chorus: .3, width: .5, oct: 1, level: .6},
      LONG.map(([b, s, n, l]) => [b, s, n - 12, l]))},
  {id: 'dubstab', name: 'Dub stabs', words: 'Minor triad stabs on the off-beat, deep into the echo: Basic Channel space.',
    build: d => { echo(d, 2); const s = synth(d, 'lead', 'Dub chord', {chord: 0, cut: 900, res: .4, fenv: .4, fd: .12, ad: .2, as: 0, ar: .15, chorus: .3, width: .8, level: .55});
      bars((bar, k, c) => { if (k % 2 === 0) d.chord(s, CH[c].slice(0, 3), bar, 6, 1, .65); else d.chord(s, CH[c].slice(0, 3), bar, 2, 1, .5); }); }},
  {id: 'fifths', name: 'Detroit fifths', words: 'Root-and-fifth chord stabs, syncopated, a Detroit string-machine colour.',
    build: perBar('Stab chord', {chord: 6, cut: 1600, res: .2, fenv: .4, fd: .2, ad: .3, as: .1, ar: .3, chorus: .6, width: .9, level: .5},
      (n, r, t, k) => { for (const s of [0, 3, 6, 10, 13]) n(r + 12, s, 1.5, s ? .5 : .65); })},
  {id: 'arp', name: 'Rising arpeggio', words: 'A bright arpeggio up the chord on every 16th, opening over the four bars.',
    build: perBar('Pluck', {semi: 12, mix2: .3, cut: 700, res: .3, fenv: .6, fd: .14, as: 0, ar: .2, chorus: .4, width: .8, level: .5},
      (n, r, t, k) => { for (let s = 0; s < 16; s++) n(r + 12 + t[s % 5] + (s >= 10 ? 12 : 0) - 12, s, 1, .4 + .1*(k % 4)); })},
  {id: 'callresp', name: 'Call and response', words: 'A four-note call for two bars, then two bars of silence for the answer to hang in the echo.',
    build: d => { echo(d, 0); const s = synth(d, 'lead', 'Pluck', {w1: TRI, w2: SAW, semi: 12, mix2: .2, cut: 1400, fenv: .4, fd: .2, as: 0, ar: .3, chorus: .3, width: .8, level: .55});
      bars((bar, k, c, r, t) => { if (k % 4 === 0) [[0, 4], [3, 3], [6, 2], [10, 0]].forEach(([st, i]) => d.note(s, 69 + (r - 33) + t[i] - (r > 33 ? 12 : 0), bar, st, 2, .7));
        if (k % 4 === 1) [[0, 2], [3, 1]].forEach(([st, i]) => d.note(s, 69 + (r - 33) + t[i] - (r > 33 ? 12 : 0), bar, st, 3, .6)); }); }},
  {id: 'onenote', name: 'One-note minimal', words: 'A single note pinging in a syncopated rhythm, its filter slowly opening: pure minimal.',
    build: d => { const s = synth(d, 'lead', 'Pluck', {w1: SQUARE, semi: 0, mix2: 0, cut: 400, res: .55, fenv: .6, fd: .08, as: 0, ar: .08, chorus: .2, width: .6, level: .6});
      d.ramp(d.buses.lead.filter.frequency, [[W, 1200], [W + 8, 6000], [W + 16, 1200]], {exp: true});
      bars((bar, k) => { for (const st of ['..x..x....x..x..', '..x..x...x....x.'][k % 2].split('').map((c, i) => c === 'x' ? i : -1).filter(i => i >= 0)) d.note(s, 69, bar, st, .7, .7); }); }},
  {id: 'glide', name: 'Gliding square', words: 'A square lead sliding between notes, a slow melody with an acid-lite edge.',
    build: phrase('Acid poly', {cut: 900, res: .45, fenv: .4, fd: .3, as: .6, ar: .2, glide: .12, mode: 2, drive: .2, oct: 0, level: .5},
      [[0, 0, 69, 6], [0, 6, 72, 4], [0, 10, 76, 6], [2, 0, 74, 8], [2, 8, 72, 8], [4, 0, 72, 6], [4, 6, 69, 4], [4, 10, 67, 6], [6, 0, 69, 16],
        [8, 0, 74, 6], [8, 6, 77, 4], [8, 10, 76, 6], [10, 0, 74, 8], [10, 8, 72, 8], [12, 0, 71, 6], [12, 6, 74, 4], [12, 10, 76, 6], [14, 0, 76, 16]])},
  {id: 'marimba', name: 'Marimba pattern', words: 'A short wooden-sounding triangle pluck in a pentatonic pattern: playful and percussive.',
    build: perBar('Pluck', {w1: TRI, w2: SINE, semi: 12, mix2: .3, cut: 3000, fenv: .2, fd: .08, as: 0, ad: .18, ar: .12, chorus: .2, width: .6, level: .6},
      (n, r, t, k) => { const p = [[0, 0], [2, 7], [4, 4], [7, 9], [10, 7], [12, 4], [14, 2]]; for (const [s, dg] of p) n(deg(dg + (k % 4 === 3 ? 2 : 0), 69), s, 1, s % 4 ? .5 : .65); })},
  {id: 'counter', name: 'Soft brass counter-line', words: 'A slow-attack saw, one note a bar falling through the chords: a warm counter-melody.',
    build: phrase('Strings', {w1: SAW, spread: .2, aa: .25, ad: 1, as: .8, ar: .8, cut: 1600, res: .1, fenv: .3, fa: .3, fd: .8, fs: .5, chorus: .4, width: .7, level: .55}, COUNTER)},
];
export const score = labScore('lead', IDEAS);
