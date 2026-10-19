// The bells, metal and wood lab: tuned percussion and bell-like leads (the user likes bells, natural and metallic sounds),
// playing the motifs they liked in the lead lab (the marimba pattern, the rising arpeggio, the one-note line, the Detroit
// fifths) and polyrhythms against the four. Over the drums, the dotted plucked bass and the warm pad.
import { BPM, BARS, W, SWING, SAW, SQUARE, TRI, SINE, synth, bars, deg, labScore } from './kit.js';
export const meta = {title: 'Bells, metal, wood', part: 'lead', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 61, over: 'drums, the plucked dotted bass and the warm pad'};

// the sounds: two oscillators, the second at a bell's (or a clashing, metallic) interval, quick decays
const S = {
  kalimba: ['Pluck', {w1: SINE, w2: TRI, semi: 12, mix2: .3, noise: .04, cut: 5000, res: 0, fenv: .2, fd: .05, aa: .001, ad: .35, as: 0, ar: .3, chorus: .2, width: .5, level: .7}],
  vibes: ['Glass bell', {w1: SINE, w2: SINE, semi: 24, mix2: .15, oct: 0, aa: .002, ad: 1.4, as: 0, ar: 1.2, ldest: 2, lsync: 0, lrate: 5.5, lamt: .3, chorus: .3, width: .7, level: .65}],
  musicbox: ['Glass bell', {w1: SINE, w2: TRI, semi: 24, mix2: .2, oct: 1, aa: .001, ad: .6, as: 0, ar: .6, chorus: .2, width: .6, level: .55}],
  tubular: ['Glass bell', {w1: SINE, w2: SINE, semi: 19, fine: 22, mix2: .55, oct: 0, aa: .001, ad: 2.5, as: 0, ar: 2.5, chorus: .3, width: .7, level: .55}],
  harmonica: ['Glass bell', {w1: SINE, w2: SINE, semi: 12, fine: 6, mix2: .4, oct: 0, aa: .15, ad: 1.5, as: .5, ar: 1.2, chorus: .7, width: .9, level: .55}],
  steel: ['Pluck', {w1: SINE, w2: TRI, semi: 12, fine: 30, mix2: .45, cut: 2600, res: .3, fenv: .3, fd: .2, aa: .001, ad: .45, as: 0, ar: .35, chorus: .3, width: .6, level: .65}],
  gamelan: ['Glass bell', {w1: SINE, w2: SINE, semi: 18, fine: 40, mix2: .6, oct: 0, aa: .001, ad: 1.3, as: 0, ar: 1.2, chorus: .45, width: .8, level: .55}],
  metal: ['Pluck', {w1: SQUARE, w2: SQUARE, semi: 6, fine: 12, mix2: .5, ft: 2, cut: 2400, res: .5, fenv: .3, fd: .08, aa: .001, ad: .25, as: 0, ar: .2, chorus: .2, width: .6, level: .55}],
  wood: ['Pluck', {w1: TRI, w2: SINE, semi: 19, mix2: .2, noise: .08, cut: 3500, res: .1, fenv: .2, fd: .03, aa: .001, ad: .09, as: 0, ar: .06, chorus: 0, width: .4, level: .75}],
  marimba: ['Pluck', {w1: TRI, w2: SINE, semi: 12, mix2: .3, cut: 3000, fenv: .2, fd: .08, as: 0, ad: .18, ar: .12, chorus: .2, width: .6, level: .6}],
  drops: ['Sub bass', {w1: SINE, w2: SINE, semi: 12, mix2: .2, sub: 0, cut: 6000, res: 0, fenv: 0, aa: .001, ad: .18, as: 0, ar: .1, mode: 2, glide: .04, oct: 1, chorus: .3, width: .7, level: .6}],
};
// the motifs: per bar, n(note, step, len16, vel), from the chord (r its root in the lead's octave, t its tones) and k the bar
const M = {
  marimba: (n, r, t, k) => { for (const [s, dg] of [[0, 0], [2, 7], [4, 4], [7, 9], [10, 7], [12, 4], [14, 2]]) n(deg(dg + (k % 4 === 3 ? 2 : 0), 69), s, 1, s % 4 ? .5 : .65); },
  arp: (n, r, t, k) => { for (let s = 0; s < 16; s++) n(r + t[s % 5] + (s >= 10 ? 12 : 0), s, 1, .4 + .1*(k % 4)); },
  onenote: (n, r, t, k) => { for (const [s, i] of ['..x..x....x..x..', '..x..x...x....x.'][k % 2].split('').map((c, i) => [i, c]).filter(([, c]) => c === 'x')) n(69, s, .7, .7); },
  fifths: (n, r, t, k) => { for (const s of [0, 3, 6, 10, 13]) { n(r, s, 1.5, s ? .5 : .65); n(r + 7, s, 1.5, s ? .4 : .55); } },
  three: (n, r, t, k) => { const w = [0, 2, 4, 1, 3]; for (let g = Math.ceil(k*16/3)*3; g < (k + 1)*16; g += 3) n(r + 12 + t[w[(g/3) % 5]] - 12, g - k*16, 1.5, (g/3) % 4 === 0 ? .7 : .5); },
  // two parts interlocking, as gamelan's kotekan: one on the beats' 16ths 0 and 2, the other on 1 and 3, a five-note cycle
  kotekan: (n, r, t, k) => { const w = [0, 1, 2, 4, 3]; for (let s = 0; s < 16; s++) { const j = k*16 + s; n(r + 12 + t[w[j % 5]] - 12, s, 1, s % 2 ? .45 : .6); } },
  slow: (n, r, t, k) => { const w = [4, 2, 3, 1]; for (let g = Math.ceil(k*16/6)*6; g < (k + 1)*16; g += 6) n(r + t[w[(g/6) % 4]], g - k*16, 5, .55); },
  drops: (n, r, t, k) => { const at = [[1, 2], [6, 4], [9, 1], [13, 3]][k % 4]; n(r + 24 + t[at[1]], at[0], .25, .3); n(r + 12 + t[at[1]], at[0] + .25, 1.5, .6); },
  sparse: (n, r, t, k) => { if (k % 2 === 0) n(r + t[0], 0, 8, .7); else n(r + t[2], 6, 8, .55); },
};
const idea = (id, name, words, sound, motif, {base = 57, echo} = {}) => ({id, name, words, build(d){
  const [preset, set] = S[sound], s = synth(d, 'lead', preset, set);
  if (echo != null) d.buses.lead.a.gain.value = Math.pow(10, echo/20);
  bars((bar, k, c, r, t) => M[motif]((note, st, l, v) => d.note(s, note, bar, st, l, v), base + (r - 33), t, k)); }});

export const IDEAS = [
  idea('kalimba', 'Kalimba', "A thumb piano playing the marimba pattern you liked: soft, woody, a little click on each note.", 'kalimba', 'marimba'),
  idea('vibes', 'Vibraphone fifths', 'A vibraphone with its tremolo, on the Detroit fifths figure you liked.', 'vibes', 'fifths'),
  idea('musicbox', 'Music box arpeggio', 'The rising arpeggio you liked, an octave up on a music box: delicate and bright.', 'musicbox', 'arp'),
  idea('tubular', 'Tubular bells', 'Long tubular bells, root and fifth answering every other bar: big, slow, ringing.', 'tubular', 'sparse'),
  idea('harmonica', 'Glass harmonica', 'A soft glass tone on dotted quarters through the chord: shimmering, slow, rolling.', 'harmonica', 'slow'),
  idea('steel', 'Steel drum in threes', 'A steel drum on every three 16ths, walking the chord: three against four, bright and natural.', 'steel', 'three'),
  idea('gamelan', 'Gamelan interlock', 'Inharmonic bronze bells in a five-note cycle on every 16th, two parts interlocking: metallic, hypnotic.', 'gamelan', 'kotekan'),
  idea('metal', 'Metallic ping', 'A clashing metallic pluck on the one-note rhythm you liked: industrial but clean.', 'metal', 'onenote', {base: 69}),
  idea('wood', 'Woodblocks in threes', 'Tuned woodblocks on dotted 8ths: dry, natural, tumbling against the beat.', 'wood', 'three', {base: 69}),
  idea('drops', 'Water drops', 'A drop of pitch into each note, sparse, into the echo: like water in a cave.', 'drops', 'drops', {echo: 0}),
  idea('bellarp', 'Bell arpeggio', 'The rising arpeggio on tubular bells: ringing tones overlapping into a cloud.', 'tubular', 'arp'),
  idea('marimba-arp', 'Marimba arpeggio', 'The marimba sound you liked, playing the rising arpeggio you liked.', 'marimba', 'arp'),
];
export const score = labScore('lead', IDEAS);
