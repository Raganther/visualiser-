// Glasshouse: the brightest of the set, a progression in C major (Cmaj9, Am9, Fmaj9, G6/9, four bars each). The glass
// sequence the user saved on every chord, a music box arpeggio, gated 16th chords, tubular bells in the breakdown.
import { buses, kick, kits, synth, chord, cycle, voice, each, bar16, kickBar, hatBar, ohhBar } from '../lib/palette.js';
export const meta = {title: 'Glasshouse', bpm: 124, bars: 128, swing: .06, seed: 55, version: 1, key: 'C major: Cmaj9, Am9, Fmaj9, G6/9',
  words: 'The brightest: a progression in C major (Cmaj9, Am9, Fmaj9, G6/9, four bars each). Your glass sequence through every chord, a music box arpeggio, gated 16th chords, tubular bells in the breakdown.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d);
  const K = kick(d, 'round'), {hats, drums, perc} = kits(d), v = x => x*(.92 + d.rand()*.16);
  const H = cycle([['C:maj9', 4], ['A:m9', 4], ['F:maj9', 4], ['G:69', 4]]), home = cycle([['C:maj9', 8], ['A:m9', 8]]);
  const chordAt = bar => bar >= 32 && bar < 120 ? H(bar) : home(bar);
  const bass = synth(d, 'bass', 'glass'), box = synth(d, 'bells', 'musicbox'), gate = synth(d, 'chords', 'gated'), tub = synth(d, 'lead', 'tubular'), pad = synth(d, 'pad', 'glassPad');

  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[4, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .7 : 1));
  each([[32, 70], [88, 116]], bar => ohhBar(d, hats, bar));
  each([[16, 72], [88, 116]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .7));
  each([[96, 116]], bar => bar16(d, hats, 'ride', bar, 'x.x.x.x.x.x.x.x.', .38));
  each([[40, 72], [88, 120]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .5));
  d.hit(drums, 'crash', 88, 0, .6); d.hit(drums, 'crash', 104, 0, .4);

  // the glass sequence on each chord's tones
  const seq = [0, 2, 3, 4, 1, 2, 0, 3];
  each([[8, 72], [84, 124]], bar => { const c = chordAt(bar); for (let s = 0; s < 16; s++) { if (bar < 16 && s % 2) continue;
    d.note(bass, c.root + 12 + c.tones[seq[s % 8]] - (c.root > 33 ? 12 : 0), bar, s, .9, v(.55 + .1*(bar % 4)/3 + (s % 4 ? 0 : .15))); } });
  d.ramp(d.buses.bass.filter.frequency, [[8, 600], [16, 1500], [48, 2600], [72, 2600], [84, 900], [88, 2600], [124, 500]], {exp: true});

  // the music box: up the chord on 16ths, an octave higher from the tenth step
  each([[48, 72], [96, 120]], bar => { const c = chordAt(bar); for (let s = 0; s < 16; s++) d.note(box, c.root + 36 + c.tones[s % 5] + (s >= 10 ? 12 : 0) - (c.root > 33 ? 12 : 0), bar, s, 1, v(.32 + .08*(bar % 4))); });
  // gated chords, every 16th, quiet: a shimmer under the groove
  each([[32, 72], [88, 120]], bar => { const ns = voice(chordAt(bar), 60); for (let s = 0; s < 16; s++) d.chord(gate, ns, bar, s, .8, v(s % 4 === 2 ? .5 : .32)); });
  d.ramp(d.buses.chords.filter.frequency, [[32, 900], [72, 2600], [88, 1500], [120, 3000], [124, 800]], {exp: true});

  // the breakdown: the progression on the glass pad, tubular bells on root and fifth
  each([[72, 88]], (bar, k) => { const c = H(bar); if (k % 4 === 0) d.chord(pad, voice(c, 60), bar, 0, 63, .65);
    if (k % 2 === 0) d.note(tub, c.root + 36, bar, 0, 8, .6); else d.note(tub, c.root + 43, bar, 6, 8, .5); });
  each([[0, 72], [88, 128]], bar => { if (bar % 4 === 0) d.chord(pad, voice(chordAt(bar), 60), bar, 0, 63, .45); });
  d.ramp(d.buses.pad.level, [[0, .6], [16, .3], [72, .9], [88, .3], [120, .45], [128, 0]]);
  d.noise('fx', 80, 88, {f0: 300, f1: 7000, peak: -7});
}
