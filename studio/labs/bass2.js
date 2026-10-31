// Bass lab 2: the user's likes from the first round (Berlin sequence, Detroit pluck, octave funk, the dotted minor 9,
// glass bass, dub sub) crossed: each liked motif on other liked sounds, and a few variations of each.
import { BPM, BARS, W, SWING, SAW, SQUARE, TRI, SINE, synth, bars, labScore } from './kit.js';
export const meta = {title: 'Bass lab 2', part: 'bass', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 12, over: 'drums and the warm pad'};

// the liked sounds
const S = {
  pluck: ['Pluck', {w1: SQUARE, w2: SAW, semi: 0, mix2: .4, cut: 420, res: .4, fenv: .7, fd: .1, as: 0, ar: .06, chorus: 0, width: .1, oct: 0}],
  saw: ['Pluck', {semi: 0, mix2: .2, cut: 300, res: .35, fenv: .6, fd: .12, as: 0, ar: .08, chorus: 0, width: .2, oct: 0}],
  square: ['Deep bass', {w1: SQUARE, w2: SAW, mix2: .3, cut: 500, res: .3, fenv: .5, fd: .1, as: .2, ar: .05, oct: 0, mode: 1}],
  clean: ['Sub bass', {w1: SINE, w2: TRI, mix2: .4, sub: 0, cut: 1200, ad: .3, as: .5, ar: .08, oct: 0, mode: 1, glide: .02}],
  glass: ['Glass bell', {mix2: .3, ad: .5, ar: .3, chorus: .2, width: .2, oct: -1, level: .8}],
  dub: ['Sub bass', {w1: SINE, sub: 0, ad: .6, as: .3, ar: .2, oct: 0, drive: .25}],
};
// the liked motifs: n(note, step, len, vel) for one bar (k bars into the loop, r the root, t the chord's tones)
const M = {
  berlin: (n, r, t, k) => { const seq = [0, 2, 3, 4, 1, 2, 0, 3]; for (let s = 0; s < 16; s++) n(r + 12 + t[seq[(s + k*16) % 8]], s, .9, .55 + .1*(k % 4) + (s % 4 ? 0 : .15)); },
  detroit: (n, r, t) => { for (const [s, i] of [[0, 0], [3, 0], [6, 2], [10, 0], [13, 2]]) n(r + 12 + t[i], s, 1, .8); },
  octfunk: (n, r) => { const p = 'x.oX.o..x.oX..o.'; for (let s = 0; s < 16; s++) if (p[s] !== '.') n(r + (p[s] === 'X' || p[s] === 'o' ? 12 : 0), s, .9, p[s] === 'o' ? .55 : .9); },
  walk9: (n, r, t, k) => { const WALK = [0, 2, 4, 1, 3, 2, 0, 4]; for (let g = Math.ceil(k*16/6)*6; g < (k + 1)*16; g += 6) n(r + 12 + t[WALK[(g/6) % 8]], g - k*16, 2.5, .85); },
  bell: (n, r, t, k) => { for (const [s, i] of [[0, 0], [3, 2], [7, 4], [10, 3], [12, 2]]) n(r + 12 + t[i], s, 2, k % 2 && s > 9 ? .5 : .75); },
  dub: (n, r, t, k) => n(r + 12 + (k % 4 === 3 ? t[2] : 0), 2, 3, .9),
};
const idea = (id, name, words, sound, motif, {echo, set} = {}) => ({id, name, words, build(d){
  const [preset, s] = S[sound], syn = synth(d, 'bass', preset, {...s, ...set});
  if (echo != null) d.buses.bass.b && (d.buses.bass.a.gain.value = Math.pow(10, echo/20));
  bars((bar, k, c, r, t) => (typeof motif === 'function' ? motif : M[motif])((note, st, l, v) => d.note(syn, note, bar, st, l, v), r, t, k)); }});

export const IDEAS = [
  idea('walk9-pluck', 'Dotted walk, plucked', 'The dotted minor 9 walk on the Detroit pluck: bright, short, bouncing across the bar.', 'pluck', 'walk9'),
  idea('walk9-glass', 'Dotted walk, glass', 'The dotted minor 9 walk on the glass bass: bell-like, more melody than weight.', 'glass', 'walk9'),
  idea('berlin-glass', 'Glass sequence', 'The Berlin 16th sequence on the glass sound: a shimmering, hypnotic run.', 'glass', 'berlin', {set: {ad: .25, ar: .15}}),
  idea('berlin-clean', 'Soft sequence', 'The Berlin sequence on the clean sine-and-triangle sound: round and gentle.', 'clean', 'berlin', {set: {ad: .15, as: .2, ar: .05}}),
  idea('berlin-8', 'Berlin in 8ths, darker', 'Half the notes of the Berlin sequence, the saw darker: more space, same motion.', 'saw',
    (n, r, t, k) => { const seq = [0, 2, 3, 4, 1, 2, 0, 3]; for (let s = 0; s < 16; s += 2) n(r + 12 + t[seq[(s/2 + k*8) % 8]], s, 1.6, .7 + (s % 4 ? 0 : .15)); }, {set: {cut: 220, fd: .16}}),
  idea('detroit-clean', 'Detroit, round', 'The Detroit root-and-fifth figure on the clean round sound.', 'clean', 'detroit'),
  idea('detroit-saw', 'Detroit, saw', 'The Detroit figure on the saw pluck, its filter a little brighter each bar of four.', 'saw', 'detroit', {set: {cut: 380, fenv: .7}}),
  idea('octfunk-clean', 'Octave funk, round', 'The octave-jumping funk line on the clean sound: bouncy without the buzz.', 'clean', 'octfunk', {set: {ad: .18, as: .3}}),
  idea('octfunk-pluck', 'Octave funk, plucked', 'The octave funk line on the Detroit pluck: snappy and bright.', 'pluck', 'octfunk'),
  idea('bell-pluck', 'Bell figure, plucked', "The glass bass's five-note figure on the Detroit pluck.", 'pluck', 'bell'),
  idea('dub-glass', 'Dub glass with echo', 'One glassy note a bar on the first off-beat into a long echo.', 'glass', 'dub', {echo: -4}),
  idea('walk9-oct', 'Dotted walk with octave pops', 'The dotted walk on the square bass, every third note popping up an octave.', 'square',
    (n, r, t, k) => { const WALK = [0, 2, 4, 1, 3, 2, 0, 4]; for (let g = Math.ceil(k*16/6)*6; g < (k + 1)*16; g += 6) { const j = g/6; n(r + (j % 3 === 2 ? 24 : 12) + t[WALK[j % 8]], g - k*16, 2, j % 3 === 2 ? .7 : .85); } }),
  idea('berlin-leap', 'Berlin with leaps', 'The Berlin sequence on the Detroit pluck, leaping an octave on the last beat of each bar.', 'pluck',
    (n, r, t, k) => { const seq = [0, 2, 3, 4, 1, 2, 0, 3]; for (let s = 0; s < 16; s++) n(r + (s >= 12 ? 24 : 12) + t[seq[(s + k*16) % 8]], s, .9, .6 + (s % 4 ? 0 : .2)); }),
  idea('detroit-fill', 'Detroit with a run', 'The Detroit figure for three beats, then a run of 16ths up the chord into the next bar.', 'pluck',
    (n, r, t, k) => { for (const [s, i] of [[0, 0], [3, 0], [6, 2], [10, 0]]) n(r + 12 + t[i], s, 1, .8); [0, 1, 2, 3].forEach(i => n(r + 12 + t[i + (k % 2)], 12 + i, .8, .65 + i*.08)); }),
];
export const score = labScore('bass', IDEAS);
