// Sundial: Lydian and open, two bars a chord: F major 9, G add 9, A minor 7, C add 9 (the G major chord over F's scale
// gives it the Lydian brightness). A kalimba arpeggio, the vibraphone on long notes, the round Detroit bass, the glass pad,
// the groove with ride-bell accents and a shaker.
import { buses, kick, kits, synth, chord, cycle, voice, scale, each, bar16, kickBar, hatBar, ohhBar } from '../lib/palette.js';
export const meta = {title: 'Sundial', bpm: 124, bars: 128, swing: .06, seed: 121, version: 2, key: 'F Lydian: Fmaj9, Gadd9, Am7, Cadd9',
  words: 'v2: the vibraphone is now native (an aluminium bar and its tremolo); otherwise as v1. Lydian, open and bright: F major 9, G add 9, A minor 7, C add 9, two bars each. A kalimba arpeggio, the vibraphone on long notes, the round Detroit bass, the glass pad, ride-bell accents.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d);
  const K = kick(d, 'round'), {hats, drums, perc, bell} = kits(d), v = x => x*(.92 + d.rand()*.16);
  const H = cycle([['F:maj9', 2], ['G:add9', 2], ['A:m7', 2], ['C:add9', 2]]), lyd = scale(65, 'lydian');
  const kal = synth(d, 'bells', 'kalimba'), vibes = synth(d, 'lead', 'vibes'), bass = synth(d, 'bass', 'clean'), pad = synth(d, 'pad', 'glassPad');

  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[4, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .7 : 1));
  each([[32, 72], [88, 116]], bar => ohhBar(d, hats, bar));
  each([[16, 72], [88, 116]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .65));
  each([[24, 72], [88, 120]], bar => bar16(d, bell, 'ride', bar, '...x...x...x...x', .45));
  each([[16, 72], [88, 124]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .5));
  d.hit(drums, 'crash', 88, 0, .6);

  // the Detroit bass on each chord
  each([[16, 72], [88, 124]], bar => { const c = H(bar); for (const [s, i] of [[0, 0], [3, 0], [6, 2], [10, 0], [13, 2]]) d.note(bass, c.root + 12 + c.tones[i] - (c.root > 33 ? 12 : 0), bar, s, 1, v(.8)); });
  each([[72, 88]], (bar, k) => { if (k % 2 === 0) d.note(bass, H(bar).root + 12 - (H(bar).root > 33 ? 12 : 0), bar, 0, 30, .5); });

  // the kalimba arpeggio: up the chord on 16ths, the top an octave up
  each([[32, 72], [72, 88], [88, 120]], (bar, k) => { const c = H(bar), n = c.tones.length; for (let s = 0; s < 16; s++) {
    if (bar >= 72 && bar < 88 && s % 2) continue; d.note(kal, c.root + 24 + c.tones[s % n] + (s >= 10 ? 12 : 0) - (c.root > 33 ? 12 : 0), bar, s, 1, v(.38 + .1*(bar % 2))); } });
  // the vibraphone: one long note a chord, rising through the scale, answered each eight bars
  const TOP = [6, 7, 4, 5, 6, 8, 7, 4];
  each([[48, 72], [96, 120]], bar => { if (bar % 2 === 0) d.note(vibes, lyd(TOP[(bar/2) % 8]), bar, 0, 12, v(.55)); if (bar % 8 === 7) d.note(vibes, lyd(9), bar, 8, 6, v(.45)); });

  each([[0, 128]], bar => { if (bar % 2 === 0) d.chord(pad, voice(H(bar), 57), bar, 0, 31, .5); });
  d.ramp(d.buses.pad.level, [[0, .6], [16, .3], [72, .3], [74, .9], [88, .35], [120, .4], [128, 0]]);
  d.noise('fx', 80, 88, {f0: 300, f1: 7000, peak: -8});
}
