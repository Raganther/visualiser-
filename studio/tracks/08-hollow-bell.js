// Hollow Bell: minimal, one chord (G minor 9), built by addition: a marimba figure that starts as two notes and gains one
// every eight bars until it's a full sixteen-step pattern, then sheds them again at the end. Ride bells in threes against it,
// woodblocks answering, the glass bass's Detroit figure.
import { buses, kick, kits, synth, chord, voice, scale, each, every, bar16, kickBar, hatBar, ohhBar } from '../lib/palette.js';
export const meta = {title: 'Hollow Bell', bpm: 124, bars: 128, swing: .06, seed: 88, version: 2, key: 'G minor, one chord',
  words: 'v2: the marimba and woodblocks are now native (a rosewood bar with its tube, a block\'s modes); otherwise as v1. Minimal, one chord (G minor 9), built by addition: a marimba figure starts as two notes and gains one every eight bars, then sheds them at the end. Ride bells in threes, woodblocks answering, the glass bass.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d);
  const K = kick(d, 'round'), {hats, drums, perc, bell} = kits(d), v = x => x*(.92 + d.rand()*.16);
  const Gm = chord('G:m9'), pen = scale(67, 'penta');
  const mar = synth(d, 'lead', 'marimba'), wood = synth(d, 'bells', 'wood'), bass = synth(d, 'bass', 'glass'), pad = synth(d, 'pad', 'warm');

  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[8, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .7 : 1));
  each([[40, 72], [88, 116]], bar => ohhBar(d, hats, bar, .85));
  each([[24, 72], [88, 116]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .65));
  // ride bells every three 16ths in the lift and the peak
  every(48, 72, 3, 0, (bar, s) => d.hit(bell, 'ride', bar, s, v(.5))); every(88, 116, 3, 0, (bar, s) => d.hit(bell, 'ride', bar, s, v(.5)));
  d.hit(drums, 'crash', 88, 0, .55);

  // the marimba, by addition: steps in the order they join, each with its degree of the scale
  const ORDER = [[0, 0], [10, 2], [6, 4], [3, 1], [13, 3], [8, 5], [14, 2], [4, 3], [11, 6], [1, 4], [7, 1], [15, 5]];
  const count = bar => bar < 112 ? Math.min(ORDER.length, 2 + Math.floor(Math.max(0, bar - 8)/8)) : Math.max(2, ORDER.length - Math.floor((bar - 112)/2));
  each([[8, 128]], bar => { const n = bar >= 72 && bar < 88 ? 4 : count(bar);
    for (const [s, dg] of ORDER.slice(0, n)) d.note(mar, pen(dg + (bar % 8 === 7 && s > 11 ? 1 : 0)), bar, s, 1, v(s % 4 ? .5 : .65)); });
  // woodblocks answering every five 16ths in the peak
  every(92, 116, 5, 2, (bar, s, j) => d.note(wood, pen(5 + [0, 2, 1, 3][j % 4]), bar, s, 1, v(.45)));

  // the glass bass: the Detroit figure on root and fifth
  each([[16, 72], [88, 124]], bar => { for (const [s, i] of [[0, 0], [3, 0], [6, 2], [10, 0], [13, bar % 4 === 3 ? 3 : 2]]) d.note(bass, Gm.root + 12 + Gm.tones[i], bar, s, 1.5, v(.8)); });
  each([[72, 88]], (bar, k) => { for (const s of [0, 6, 12]) d.note(bass, Gm.root + 12, bar, s, 2, .5); });

  for (let bar = 0; bar < 128; bar += 8) d.chord(pad, voice(Gm, 58), bar, 0, 8*16 - 2, .5);
  d.ramp(d.buses.pad.level, [[0, .4], [16, .25], [72, .25], [74, .8], [88, .3], [128, 0]]);
  d.ramp(d.buses.lead.filter.frequency, [[8, 2000], [48, 8000], [72, 3000], [88, 8000], [128, 2500]], {exp: true});
  d.noise('fx', 80, 88, {f0: 300, f1: 6500, peak: -8});
}
