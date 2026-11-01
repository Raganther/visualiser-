// Low Sun: Phrygian, dark and a little mysterious: E minor 7, F major 9 (the half-step above, the Phrygian colour), back to
// E minor 7, then D minor 9, four bars each. Tribal toms and shaker, a kalimba pattern, a steel drum in threes at the peak,
// the soft sequence on the round bass, dotted chords.
import { buses, kick, kits, synth, chord, cycle, voice, scale, each, every, bar16, kickBar, ohhBar } from '../lib/palette.js';
export const meta = {title: 'Low Sun', bpm: 126, bars: 128, swing: .05, seed: 99, version: 2, key: 'E Phrygian: Em7, Fmaj9, Em7, Dm9',
  words: 'v2: the steel drum and the toms are now native; otherwise as v1. Phrygian, dark and a little mysterious: E minor 7, F major 9 (the half-step above), E minor 7, D minor 9. Tribal toms and shaker, a kalimba pattern, a steel drum in threes, the soft sequence on the round bass, dotted chords.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d, {chords: {filter: {cut: 1100, q: .9}}});
  const K = kick(d, 'round'), {hats, drums, perc} = kits(d, {perc: {tomL: {level: .9, decay: 1.1}, tomH: {level: .8, decay: 1, pan: .35}}}), v = x => x*(.92 + d.rand()*.16);
  const H = cycle([['E:m7', 4], ['F:maj9', 4], ['E:m7', 4], ['D:m9', 4]]), phr = scale(64, 'phrygian');
  const kal = synth(d, 'bells', 'kalimba'), steel = synth(d, 'lead', 'steel'), bass = synth(d, 'bass', 'clean'), dot = synth(d, 'chords', 'dotted'), pad = synth(d, 'pad', 'warm', {cut: 1000});

  each([[0, 72], [88, 124]], bar => kickBar(d, K, bar));
  each([[8, 72], [88, 120]], bar => bar16(d, perc, 'shaker', bar, 'oxoxoxoxoxoxoxox', .45));
  each([[16, 72], [88, 120]], bar => { bar16(d, perc, 'tomL', bar, '...x.....x....x.', .65); bar16(d, perc, 'tomH', bar, bar % 2 ? '......x.....x...' : '......x.....x..x', .55); });
  each([[24, 72], [88, 116]], bar => ohhBar(d, hats, bar, .8));
  each([[32, 72], [88, 112]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .6));
  d.hit(drums, 'crash', 88, 0, .5);

  // the soft sequence: each chord's tones on 16ths, the clean round sound
  const seq = [0, 2, 3, 1, 2, 3, 0, 2];
  each([[16, 72], [88, 124]], bar => { const c = H(bar); for (let s = 0; s < 16; s++) d.note(bass, c.root + 12 + c.tones[seq[s % 8] % c.tones.length], bar, s, .9, v(.5 + (s % 4 ? 0 : .2))); });
  each([[72, 88]], (bar, k) => { if (k % 4 === 0) d.note(bass, H(bar).root + 12, bar, 0, 60, .5); });

  // the kalimba: the marimba pattern on the Phrygian scale, its top note leaning on the F
  const P = [[0, 0], [2, 4], [4, 2], [7, 5], [10, 4], [12, 2], [14, 1]];
  each([[32, 72], [72, 88], [88, 120]], bar => { for (const [s, dg] of P) d.note(kal, phr(dg + (bar % 4 === 3 ? 2 : 0)), bar, s, 1, v(s % 4 ? .5 : .65)); });
  // the steel drum in threes, from the chord
  every(92, 116, 3, 0, (bar, s, j) => { const c = H(bar); d.note(steel, c.root + 24 + c.tones[[0, 2, 1, 3][j % 4]], bar, s, 1.5, v(j % 4 === 0 ? .65 : .48)); });
  // dotted chords from the lift
  each([[48, 72], [88, 120]], bar => { const ns = voice(H(bar), 57); for (let g = Math.ceil(bar*16/3)*3; g < (bar + 1)*16; g += 3) d.chord(dot, ns, bar, g % 16, 1.5, v(.42)); });
  d.ramp(d.buses.chords.filter.frequency, [[48, 700], [72, 1800], [88, 1100], [112, 2600], [120, 700]], {exp: true});

  each([[0, 128]], bar => { if (bar % 4 === 0) d.chord(pad, voice(H(bar), 55), bar, 0, 63, .5); });
  d.ramp(d.buses.pad.level, [[0, .6], [16, .3], [72, .3], [74, .9], [88, .35], [120, .4], [128, 0]]);
  d.noise('fx', 80, 88, {f0: 250, f1: 6000, peak: -8});
}
