// Rust Garden: broken beat, nearly one chord: F# minor 11 for six bars, a lift to E 6/9 for two. The broken kick (the round
// one), toms rolling through the gaps, the octave funk on the round bass, woodblocks in threes, a metallic ping, dotted
// chords coming in late.
import { buses, kick, kits, synth, chord, cycle, voice, scale, each, every, hits, bar16, kickBar } from '../lib/palette.js';
export const meta = {title: 'Rust Garden', bpm: 120, bars: 128, swing: .08, seed: 66, version: 2, key: 'F# minor: F#m11, E6/9',
  words: 'v2: the woodblocks, the metallic ping (now a struck plate) and the toms are now the native ones you preferred in the lab; otherwise as v1. Broken beat, nearly one chord: F# minor 11 for six bars, E 6/9 for two. The broken kick and toms rolling through the gaps, the octave funk on the round bass, woodblocks in threes, a metallic ping, dotted chords late.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d, {drums: {level: 13}});
  const K = kick(d, 'round'), {hats, drums, perc} = kits(d, {kit: '909', hats: {chh: {tone: .6, level: .8, decay: .6, pan: .2}}, drums: {snare: {level: .65, tone: .7}}, perc: {tomL: {level: .7, decay: 1}, tomH: {level: .6, decay: .9, pan: .35}}});
  const v = x => x*(.92 + d.rand()*.16), H = cycle([['F#:m11', 6], ['E:69', 2]]), pen = scale(66, 'penta');
  const bass = synth(d, 'bass', 'clean', {ad: .18, as: .3}), wood = synth(d, 'bells', 'wood'), metal = synth(d, 'lead', 'metal'), dot = synth(d, 'chords', 'dotted');

  // the broken beat, its kick doubled a bar in eight
  each([[0, 72], [88, 124]], bar => kickBar(d, K, bar, bar % 8 === 7 ? 'X.....x...x.x.x.' : 'X.....x...x..x..'));
  each([[8, 72], [88, 120]], bar => bar16(d, hats, 'chh', bar, bar < 16 ? 'x.x.x.x.x.x.x.x.' : 'x.xox.xox.xox.xo', .5));
  each([[16, 72], [88, 116]], bar => { bar16(d, drums, 'snare', bar, '........X.....o.', .7); bar16(d, drums, 'snare', bar, '...o......o.....', .3); });
  each([[32, 72], [88, 120]], bar => { bar16(d, perc, 'tomL', bar, '....x........x..', .55); bar16(d, perc, 'tomH', bar, bar % 2 ? '..x.......x.....' : '..x.....x...x...', .45); });
  each([[48, 72], [92, 116]], bar => bar16(d, hats, 'ohh', bar, '..............x.', .5));
  d.hit(drums, 'crash', 88, 0, .5);

  // the octave funk: the root and its octave on syncopated 16ths
  each([[16, 72], [88, 124]], bar => { const r = H(bar).root + 12, p = 'x.oX.o..x.oX..o.'; for (const s of hits(p)) d.note(bass, r + (p[s] === 'X' || p[s] === 'o' ? 12 : 0), bar, s, .9, v(p[s] === 'o' ? .55 : .9)); });
  each([[72, 88]], (bar, k) => { if (k % 2 === 0) d.note(bass, H(bar).root + 12, bar, 0, 24, .5); });

  // woodblocks in threes, tumbling up and down the scale
  const W = [0, 2, 1, 3, 2, 4, 3, 1];
  for (const [a, b] of [[24, 72], [76, 88], [88, 120]]) every(a, b, 3, 1, (bar, s, j) => d.note(wood, pen(W[j % 8] + 2), bar, s, 1, v(j % 4 === 0 ? .7 : .5)));
  // the metallic ping on the one-note rhythm
  each([[56, 72], [96, 116]], bar => { for (const s of hits(['..x..x....x..x..', '..x..x...x....x.'][bar % 2])) d.note(metal, 66 + (bar % 8 === 7 ? 4 : 0), bar, s, .7, v(.6)); });
  // dotted chords late, on every three 16ths, quiet
  each([[64, 72], [88, 120]], (bar, k) => { const ns = voice(H(bar), 57); for (let g = Math.ceil(bar*16/3)*3; g < (bar + 1)*16; g += 3) d.chord(dot, ns, bar, g % 16, 1.5, v(.42)); });
  each([[72, 88]], (bar, k) => { if (k % 2 === 0) d.chord(dot, voice(H(bar), 57), bar, 2, 1.5, .5); });
  d.ramp(d.buses.chords.filter.frequency, [[64, 700], [72, 1600], [88, 1100], [112, 2800], [120, 700]], {exp: true});
  d.noise('fx', 82, 88, {f0: 300, f1: 6000, peak: -9});
}
