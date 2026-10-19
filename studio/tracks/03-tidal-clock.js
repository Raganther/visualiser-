// Tidal Clock: minimal, one chord (D minor 11), built on phasing: two kalimbas play the same notes in loops of 12 and 13
// sixteenths, so they drift apart and back over the track (as in Reich's phase pieces) and the pattern is never quite the
// same twice. Toms in threes, woodblocks in fives at the peak, the dotted walk on the clean bass.
import { buses, kick, kits, synth, chord, voice, scale, each, every, bar16, kickBar, hatBar, ohhBar } from '../lib/palette.js';
export const meta = {title: 'Tidal Clock', bpm: 122, bars: 128, swing: .05, seed: 33, version: 1, key: 'D minor, one chord',
  words: 'Minimal and rhythmic: one chord (D minor 11). Two kalimbas on the same notes in loops of 12 and 13 sixteenths, drifting apart and back; toms in threes, woodblocks in fives, the dotted walk on the round bass.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d, {bells: {a: -5}});
  const K = kick(d, 'round'), {hats, drums, perc} = kits(d, {perc: {tomL: {level: .9, decay: 1.1}, tomH: {level: .75, decay: .95, pan: .35}}}), v = x => x*(.92 + d.rand()*.16);
  const Dm = chord('D:m11'), pen = scale(62, 'penta');
  const kalA = synth(d, 'bells', 'kalimba', {width: .3}), kalB = synth(d, 'bells', 'kalimba', {width: .3, fine: 4}), wood = synth(d, 'lead', 'wood');
  const bass = synth(d, 'bass', 'clean', {ad: .2, as: .3}), pad = synth(d, 'pad', 'glassPad');
  kalA.bus = kalB.bus = 'bells';

  each([[0, 72], [88, 124]], bar => kickBar(d, K, bar));
  each([[8, 72], [88, 120]], bar => bar16(d, hats, 'chh', bar, bar < 16 ? '..x...x...x...x.' : '..x...x...x...xo', .7));
  each([[16, 72], [88, 120]], bar => bar16(d, perc, 'shaker', bar, 'oxoxoxoxoxoxoxox', .42));
  each([[48, 72], [92, 116]], bar => ohhBar(d, hats, bar, .8));
  each([[32, 72], [88, 112]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .55));
  // toms in threes: low and high answering every six 16ths
  for (const [a, b] of [[24, 72], [88, 120]]) { every(a, b, 6, 3, (bar, s) => d.hit(perc, 'tomL', bar, s, v(.62))); every(a, b, 6, 0, (bar, s) => d.hit(perc, 'tomH', bar, s, v(.48))); }
  // woodblocks in fives at the peak, up the scale
  every(88, 112, 5, 1, (bar, s, j) => d.note(wood, pen(5 + [0, 2, 1, 3, 4][j % 5]), bar, s, 1, v(.5)));

  // the two kalimbas: the same seven notes, one going round every 12 16ths, the other every 13
  const A12 = [[0, 0], [2, 2], [4, 3], [5, 1], [7, 4], [9, 2], [10, 3]], B13 = [[0, 4], [3, 3], [5, 1], [8, 2], [10, 0], [11, 5]];
  const loop = (syn, cyc, len, a, b, lift, vel) => { for (let g = a*16; g < b*16; g++) { const at = cyc.find(([s]) => s === (g - a*16) % len); if (at) d.note(syn, pen(at[1] + lift), Math.floor(g/16), g % 16, 1.5, v(at[0] === 0 ? vel : vel*.78)); } };
  loop(kalA, A12, 12, 16, 112, 0, .7);
  loop(kalB, B13, 13, 40, 120, 5, .55);
  d.ramp(d.buses.bells.filter.frequency, [[16, 2000], [40, 9000], [72, 9000], [80, 3500], [88, 9000], [120, 2000]], {exp: true});

  // the dotted walk: every six 16ths through the chord's tones, rolling across the bar
  const WALK = [0, 2, 4, 1, 3, 2, 0, 4];
  for (const [a, b] of [[16, 72], [88, 124]]) for (let g = Math.ceil(a*16/6)*6; g < b*16; g += 6) { const j = g/6;
    d.note(bass, Dm.root + 12 + Dm.tones[WALK[j % 8]] - (Dm.tones[WALK[j % 8]] > 12 ? 12 : 0), Math.floor(g/16), g % 16, 2.5, v(a === 16 && g < 24*16 ? .7 : .85)); }
  for (let bar = 72; bar < 88; bar += 4) d.note(bass, Dm.root + 12, bar, 0, 60, .5);

  // the glass pad: quiet under the groove, the chord's colour in the breakdown
  for (let bar = 0; bar < 128; bar += 8) d.chord(pad, voice(Dm, 60), bar, 0, 8*16 - 2, .5);
  d.ramp(d.buses.pad.level, [[0, .5], [16, .3], [72, .3], [74, .9], [88, .35], [120, .4], [128, 0]]);
  d.noise('fx', 80, 88, {f0: 300, f1: 6000, peak: -8});
  d.hit(drums, 'crash', 88, 0, .55);
}
