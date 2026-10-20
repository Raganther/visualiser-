// The native lab: each sound the user liked, playing the same motif twice, as it is now (the poly synth and the drum kit,
// approximations from two oscillators or filtered noise) and native (computed from the instrument's physics in
// lib/native: struck bars, tines and bells as their real modes, a skin, a string, beads), side by side to flag; then a few
// sounds only the native engine makes. Over an A pedal: the round kick, the liked hats, a quiet gated suspended chord.
import { buses, kick, kits, synth, each, every, hits, hatBar, ohhBar } from '../lib/palette.js';
import { grains, rain } from '../lib/native/body.js';
import { modal, MODAL } from '../lib/native/modal.js';
export const meta = {title: 'Now vs native', part: 'sound', bpm: 124, bars: 16, warm: 1, swing: .06, seed: 91,
  over: 'the round kick, the hats and a quiet suspended gated chord over an A'};

const W = 1, LOOP = Array.from({length: 16}, (_, i) => W + i);
// the notes over the A: A B D E G (inside every suspended voicing)
const SUSP = [45, 47, 50, 52, 55, 57, 59, 62, 64, 67, 69, 71, 74, 76, 79, 81, 83, 86, 88];
const at = k => SUSP[Math.max(0, Math.min(SUSP.length - 1, k))];
const SUS = [[64, 69, 71, 74], [65, 67, 72, 76], [62, 67, 69, 74], [64, 66, 69, 71]];

// the motifs, per bar k: n(note, step, len16, vel)
const M = {
  marimba: (n, k, o = 10) => { for (const [s, i] of [[0, 0], [2, 2], [4, 1], [7, 3], [10, 2], [12, 1], [14, -1]]) n(at(o + i + (k % 4 === 3 ? 1 : 0)), s, 1, s % 4 ? .5 : .65); },
  fifths: (n, k) => { const r = k % 4 < 2 ? 69 : 67; for (const s of [0, 3, 6, 10, 13]) { n(r, s, 1.5, s ? .5 : .65); n(r + 7, s, 1.5, s ? .42 : .55); } },
  arp: (n, k) => { for (let s = 0; s < 16; s++) n(at(10 + s % 5 + (s >= 10 ? 5 : 0)), s, 1, .4 + .08*(k % 4)); },
  sparse: (n, k) => { if (k % 2 === 0) n(57, 0, 8, .7); else n(64, 6, 8, .55); },
  onenote: (n, k) => { for (const s of hits(['..x..x....x..x..', '..x..x...x....x.'][k % 2])) n(69, s, .7, .7); },
  berlin: (n, k) => { const seq = [0, 2, 3, 4, 1, 2, 0, 3], t = [0, 3, 7, 10, 14]; for (let s = 0; s < 16; s++) n(45 + t[seq[s % 8]], s, .9, .55 + .1*(k % 4)/3 + (s % 4 ? 0 : .15)); },
  detroit: (n) => { for (const [s, i] of [[0, 0], [3, 0], [6, 7], [10, 0], [13, 7]]) n(45 + i, s, 1, .8); },
};
// a motif in threes: every three 16ths across the loop, walking the notes
const threes = (o, walk = [0, 2, 4, 1, 3]) => (d, play) => every(W, W + 16, 3, 0, (bar, s, j) => play(at(o + walk[j % walk.length]), bar, s, 1.5, j % 4 === 0 ? .7 : .5));
const perBar = motif => (d, play) => LOOP.forEach((bar, k) => motif((note, s, l, v) => play(note, bar, s, l, v), k));

// a pair of ideas: the same part now (a poly synth sound from the palette) and native (a lib/native instrument)
const pair = (id, name, part, now, nat, words) => [
  {id: `${id}-now`, name: `${name} · now`, words: `As it is now: ${words.now}`, bus: 'bells', build(d){ const s = synth(d, 'bells', now.sound, {...now.set, poly: 1}); part(d, (n, bar, st, l, v) => d.note(s, n + (now.shift || 0), bar, st, l, v*(.92 + d.rand()*.16))); }},
  {id: `${id}-native`, name: `${name} · native`, words: `Native: ${words.nat}`, bus: 'bells', build(d){ const s = d.native('bells', nat.name, nat.set); part(d, (n, bar, st, l, v) => d.note(s, n + (nat.shift || 0), bar, st, l, v*(.92 + d.rand()*.16))); }}];

const IDEAS0 = [
  ...pair('kalimba', 'Kalimba', perBar(M.marimba), {sound: 'kalimba'}, {name: 'kalimba'},
    {now: 'a sine and a triangle an octave apart, plucked.', nat: "a tine's real bending modes, far apart, with the thumb's soft click."}),
  ...pair('vibes', 'Vibraphone', perBar(M.fifths), {sound: 'vibes'}, {name: 'vibes'},
    {now: 'two sines two octaves apart with a tremolo.', nat: 'an aluminium bar (overtones at 4 and 10 times), its long ring and the turning discs’ tremolo.'}),
  ...pair('musicbox', 'Music box', perBar(M.arp), {sound: 'musicbox', shift: -12}, {name: 'musicbox'},
    {now: 'a sine and a triangle two octaves apart.', nat: "a free steel bar's modes (2.76 and 5.40 times): a glockenspiel-like comb."}),
  ...pair('steel', 'Steel drum in threes', threes(7), {sound: 'steel'}, {name: 'steel'},
    {now: 'a sine and a detuned triangle through a filter.', nat: "a pan's note tuned to its octave and twelfth, the octave blooming a moment after the strike."}),
  ...pair('marimba', 'Marimba', (d, play) => perBar((n, k) => M.marimba(n, k, 5))(d, play), {sound: 'marimba'}, {name: 'marimba'},
    {now: 'a triangle with a sine an octave up.', nat: 'a rosewood bar (overtones tuned to 4 and 10 times) with its tube lengthening the low note.'}),
  ...pair('wood', 'Woodblocks in threes', threes(10, [0, 2, 1, 3, 2]), {sound: 'wood'}, {name: 'wood'},
    {now: 'a triangle and a sine with a little noise, very short.', nat: "a block's few short modes and its hollow's ring, with the stick's click."}),
  ...pair('tubular', 'Tubular bells', perBar(M.sparse), {sound: 'tubular'}, {name: 'tubular'},
    {now: 'two sines a twelfth apart, slightly detuned.', nat: "a tube's partials, each pair beating slowly as a real bell's do."}),
  ...pair('ping', 'Metallic ping', perBar(M.onenote), {sound: 'metal'}, {name: 'plate'},
    {now: 'two squares a tritone apart through a resonant filter.', nat: "a struck metal plate's crowded, beating modes."}),
  ...pair('glassbass', 'Glass bass sequence', perBar(M.berlin), {sound: 'glass'}, {name: 'glass', set: {hard: .3}, shift: -12},
    {now: 'your saved glass sequence (a glass-bell preset an octave down).', nat: 'the same line on a struck glass bar, softly, low.'}),
  ...pair('pluckbass', 'Plucked bass', perBar(M.detroit), {sound: 'pluck'}, {name: 'pluck'},
    {now: 'the Detroit pluck: a square and a saw through a closing filter.', nat: 'a plucked string (a burst of noise round a tuned loop that loses its highs each time round).'}),
];
// the drums: toms in threes and the shaker, the kit's against the computed skin and beads
IDEAS0.push(
  {id: 'toms-now', name: 'Toms in threes · now', words: "As it is now: the kit's toms (a falling sine and noise).", bus: 'perc', build(d){ const {perc} = kits(d, {skins: false});
    every(W, W + 16, 6, 3, (bar, s) => d.hit(perc, 'tomL', bar, s, .65)); every(W, W + 16, 6, 0, (bar, s) => d.hit(perc, 'tomH', bar, s, .5)); }},
  {id: 'toms-native', name: 'Toms in threes · native', words: "Native: a struck skin's modes (a drum's real overtones), its pitch dropping as the strike's tension eases.", bus: 'perc', build(d){
    const t = d.native('perc', 'tom'); every(W, W + 16, 6, 3, (bar, s) => d.note(t, 43, bar, s, 1, .65)); every(W, W + 16, 6, 0, (bar, s) => d.note(t, 50, bar, s, 1, .5)); }},
  {id: 'shaker-now', name: 'Shaker · now', words: "As it is now: the kit's shaker (filtered noise).", bus: 'perc', build(d){ const {perc} = kits(d);
    LOOP.forEach(bar => { const p = 'o.x.o.xoo.x.o.xo'; for (const s of hits(p)) d.hit(perc, 'shaker', bar, s, p[s] === 'x' ? .55 : .25); }); }},
  {id: 'shaker-native', name: 'Shaker · native', words: 'Native: beads colliding inside a shell while the shake lasts, each collision through the shell’s resonances.', bus: 'perc', build(d){
    const big = d.native('perc', 'shaker', {secs: .13}), small = d.native('perc', 'shaker', {secs: .07, seed: 4});
    LOOP.forEach(bar => { const p = 'o.x.o.xoo.x.o.xo'; for (const s of hits(p)) d.note(p[s] === 'x' ? big : small, 60 + (s % 3), bar, s, 1, p[s] === 'x' ? .8 : .45); }); }},
);
// sounds only the native engine makes
const oneBuf = (d, bus, o, bar, gain = 1) => d.later(d.t(bar) - .01, () => { const ab = d.ctx.createBuffer(2, o.L.length, d.ctx.sampleRate); ab.copyToChannel(o.L, 0); ab.copyToChannel(o.R, 1);
  const s = d.ctx.createBufferSource(), g = d.ctx.createGain(); s.buffer = ab; g.gain.value = gain; s.connect(g); g.connect(d.buses[bus].in); s.start(d.t(bar)); });
IDEAS0.push(
  {id: 'gong', name: 'Gong swells', words: 'Native only: a gong on the A every four bars, its upper modes blooming in after the strike, beating.', bus: 'bells', build(d){
    const g = d.native('bells', 'gong', {hard: .35}); LOOP.forEach((bar, k) => { if (k % 4 === 0) d.note(g, 45, bar, 0, 16, .7); }); }},
  {id: 'church', name: 'Church bell answer', words: "Native only: a bell's ringers' partials (hum, prime, tierce, quint, nominal), A answered by E.", bus: 'bells', build(d){
    const b = d.native('bells', 'bell'); LOOP.forEach((bar, k) => { if (k % 4 === 0) d.note(b, 57, bar, 0, 16, .7); if (k % 4 === 2) d.note(b, 64, bar, 8, 16, .55); }); }},
  {id: 'cloud', name: 'Bell cloud, blooming', words: 'Native only: a cloud of tiny grains of a struck bell on A, D and E, thin at first and thickening over the 16 bars.', bus: 'bells', build(d){
    const sr = d.ctx.sampleRate, src = modal(sr, 440, MODAL.musicbox.modes, {...MODAL.musicbox, vel: .7, len: 1.4});
    oneBuf(d, 'bells', grains(sr, src, 16*4*d.beat + 2, {density: [3, 45], len: [.05, .18], pitches: [1, 1.335, 1.5, 2, .667], seed: 5}), W, .9); }},
  {id: 'rain', name: 'Rain', words: 'Native only: droplets (tiny bubbles ringing and rising in pitch as they close) over a soft hiss, coming in waves.', bus: 'perc', build(d){
    oneBuf(d, 'perc', rain(d.ctx.sampleRate, 16*4*d.beat + 2, {seed: 9}), W, .7); }},
);
export const IDEAS = IDEAS0;

export function score(d){
  buses(d, {bells: {filter: {cut: 12000}}});
  for (const bar of LOOP) for (let b = 0; b < 4; b++) d.kicks.push(d.t(bar, b*4));   // (every stem pumps alike)
  const idea = IDEAS.find(i => i.id === d.variant);
  if (idea) { idea.build(d); d.solo([idea.bus]); return; }
  // the backing: the round kick, the hats, a quiet gated suspended chord
  const K = kick(d, 'round'); K.side = false; const {hats} = kits(d), gate = synth(d, 'chords', 'gated', {level: .3});
  LOOP.forEach((bar, k) => { for (let b = 0; b < 4; b++) d.hit(K, 'kick', bar, b*4, b ? .92 : 1); hatBar(d, hats, bar); ohhBar(d, hats, bar, .8);
    for (const s of [2, 6, 10, 14]) d.chord(gate, SUS[Math.floor(k/4) % 4], bar, s, 1, .4); });
  d.solo(['kick', 'hats', 'chords']);
}
