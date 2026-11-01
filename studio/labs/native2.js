// The native pads and basses lab: the pads and basses as they are now (the poly synth: subtractive, two oscillators into a
// filter) against native ones computed sample by sample with other recipes: additive (a pad built partial by partial, each
// blooming on its own), granular (a pad from grains of a struck bar), a breath pad (noise through resonances on the
// harmonics, like air in a tube), FM (one sine bending another: glassy, round, plucked basses and a bell chord), side by
// side on the same parts over an A pedal; and a drone that opens like a flower over the 16 bars.
import { buses, kick, kits, synth, hits, hatBar } from '../lib/palette.js';
export const meta = {title: 'Pads and basses: now vs native', part: 'sound', bpm: 123, bars: 16, warm: 1, swing: .06, seed: 92,
  over: 'the round kick, the hats and a shaker over an A'};

const W = 1, LOOP = Array.from({length: 16}, (_, i) => W + i);
// the suspended voicings over the A (Copper Wire v2's), four bars each
const SUS = [[64, 69, 71, 74], [65, 67, 72, 76], [62, 67, 69, 74], [64, 66, 69, 71]];
const v = d => .92 + d.rand()*.16;

// the parts, played on any instrument: the pad held four bars a chord; the gated chord on 16ths; three bass lines on A
const PART = {
  pad: (d, s) => LOOP.forEach((bar, k) => { if (k % 4 === 0) d.chord(s, SUS[k/4], bar, 0, 63, .55); }),
  gated: (d, s) => { const acc = '..x...x...x...x.'; LOOP.forEach((bar, k) => { for (let st = 0; st < 16; st++) d.chord(s, SUS[Math.floor(k/4)], bar, st, .8, (acc[st] === 'x' ? .52 : .3)*v(d)); }); },
  berlin: (d, s) => { const seq = [0, 2, 3, 4, 1, 2, 0, 3], t = [0, 3, 7, 10, 14]; LOOP.forEach((bar, k) => { for (let st = 0; st < 16; st++) d.note(s, 33 + 12 + t[seq[st % 8]], bar, st, .9, (.55 + .1*(k % 4)/3 + (st % 4 ? 0 : .15))*v(d)); }); },
  detroit: (d, s) => LOOP.forEach(bar => { for (const [st, i] of [[0, 0], [3, 0], [6, 7], [10, 0], [13, bar % 2 ? 10 : 7]]) d.note(s, 45 + i, bar, st, 1, .8*v(d)); }),
  octfunk: (d, s) => LOOP.forEach(bar => { const p = 'x.oX.o..x.oX..o.'; for (const st of hits(p)) d.note(s, 45 + (p[st] === 'X' || p[st] === 'o' ? 12 : 0), bar, st, .9, (p[st] === 'o' ? .55 : .9)*v(d)); }),
};
// a pair: the same part now (a palette sound on the poly synth) and native (a lib/native instrument)
const pair = (id, part, bus, [nowName, nowSound, nowWords], [natName, nat, natWords, natSet, shift = 0]) => [
  {id: `${id}-now`, name: `${nowName} · now`, words: `As it is now (subtractive: two oscillators into a filter): ${nowWords}`, bus, build(d){ PART[part](d, synth(d, bus, nowSound, {poly: 1})); }},
  {id: `${id}-native`, name: `${natName} · native`, words: `Native: ${natWords}`, bus, build(d){ const s = d.native(bus, nat, natSet); PART[part](d, shift ? {play: (n, t, l, vv) => s.play(n + shift, t, l, vv)} : s); }}];

export const IDEAS = [
  ...pair('warm', 'pad', 'pad', ['Warm pad', 'warm', 'two saws, a soft filter, a slow wobble.'],
    ['Bloom pad', 'addpad', 'additive: each chord built partial by partial, every partial arriving at its own moment and swelling on its own slow cycle, so it opens like a flower.']),
  ...pair('glass', 'pad', 'pad', ['Glass pad', 'glassPad', 'a sine and a triangle with a bell overtone, swelling.'],
    ['Grain pad', 'grainpad', 'granular: a held cloud of tiny grains taken from a struck vibraphone bar on each note of the chord.']),
  ...pair('sweep', 'pad', 'pad', ['Sweeping pad', 'sweep', 'the warm pad, its filter swept by a two-bar LFO.'],
    ['Breath pad', 'breath', 'noise through narrow resonances on each note\'s harmonics: air in a tube, a bow on a string.']),
  ...pair('gated', 'gated', 'chords', ['Gated chord', 'gated', 'the 16th-note chord you loved in Glasshouse.'],
    ['FM bell chord', 'fmbell', 'FM: the same 16ths, each note a sine bent by another at 1.4 times its pitch, a glassy bell chord.']),
  ...pair('glassbass', 'berlin', 'bass', ['Glass bass sequence', 'glass', 'your saved glass sequence.'],
    ['FM glass bass', 'fmglass', 'FM: a sine bent by another at 3.5 times its pitch, the bend falling fast after each note: glassy, struck.', {}, -12]),
  ...pair('roundbass', 'detroit', 'bass', ['Round Detroit bass', 'clean', 'a sine and a triangle, round.'],
    ['FM round bass', 'fmround', 'FM at 1:1, a quick bend into each note then round: a soft, woody thump.']),
  ...pair('funkbass', 'octfunk', 'bass', ['Octave funk, plucked', 'pluck', 'a square and a saw through a closing filter.'],
    ['FM pluck bass', 'fmpluck', 'FM at 2:1 with feedback, its bend dying fast: a snappy, wiry pluck.']),
  {id: 'flower', name: 'Flower drone · native', words: 'Native only: one A held the whole 16 bars, additive, its thirty partials opening one by one over the loop and swaying on their own: the sound itself evolving.', bus: 'pad', build(d){
    const s = d.native('pad', 'addpad', {N: 30, tilt: 1.05, a: 2, bloom: 26, wob: .55, spread: .004, r: 3});
    d.note(s, 45, W, 0, 16*16 - 4, .7); d.note(s, 57, W, 0, 16*16 - 4, .45); }},
];

export function score(d){
  buses(d, {pad: {filter: {cut: 6000}}, chords: {filter: {cut: 5000}}, bass: {filter: {cut: 5000}}});
  for (const bar of LOOP) for (let b = 0; b < 4; b++) d.kicks.push(d.t(bar, b*4));   // (every stem pumps alike)
  const idea = IDEAS.find(i => i.id === d.variant);
  if (idea) { idea.build(d); d.solo([idea.bus]); return; }
  const K = kick(d, 'round'); K.side = false; const {hats, perc} = kits(d);
  LOOP.forEach(bar => { for (let b = 0; b < 4; b++) d.hit(K, 'kick', bar, b*4, b ? .92 : 1); hatBar(d, hats, bar);
    for (const st of hits('o.x.o.xoo.x.o.xo')) d.hit(perc, 'shaker', bar, st, st % 4 === 2 ? .55 : .25); });
  d.solo(['kick', 'hats', 'perc']);
}
