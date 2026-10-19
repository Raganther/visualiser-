// Lantern: a two-chord Dorian vamp, E minor 9 to A 13, two bars each: warm and soulful, the A13's sharp sixth lifting it.
// Detroit fifths stabs, a vibraphone answering, the round Detroit bass, the warm pad, the groove with ride-bell accents.
import { buses, kick, kits, synth, chord, cycle, voice, scale, each, bar16, kickBar, hatBar, ohhBar, hits } from '../lib/palette.js';
export const meta = {title: 'Lantern', bpm: 122, bars: 128, swing: .07, seed: 44, version: 1, key: 'E Dorian: Em9, A13',
  words: 'Two chords, Dorian: E minor 9 to A 13, two bars each (warm, a little soulful). Detroit fifths stabs, a vibraphone answering, the round Detroit bass, the warm pad, the groove with ride-bell accents.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d, {chords: {filter: {cut: 1400, q: .9}}});
  const K = kick(d, 'round'), {hats, drums, perc, bell} = kits(d), v = x => x*(.92 + d.rand()*.16);
  const H = cycle([['E:m9', 2], ['A:13', 2]]), dor = scale(64, 'dorian');
  const stab = synth(d, 'chords', 'fifths'), vibes = synth(d, 'bells', 'vibes'), bass = synth(d, 'bass', 'clean'), pad = synth(d, 'pad', 'warm');

  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[4, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .7 : 1));
  each([[32, 72], [88, 116]], bar => ohhBar(d, hats, bar));
  each([[16, 72], [88, 116]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .7));
  each([[24, 72], [88, 120]], bar => bar16(d, bell, 'ride', bar, '...x...x...x...x', .5));
  each([[40, 72], [96, 112]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .5));
  d.hit(drums, 'crash', 88, 0, .6);

  // the Detroit bass: root and fifth, syncopated
  each([[16, 72], [88, 124]], bar => { const c = H(bar); for (const [s, i] of [[0, 0], [3, 0], [6, 2], [10, 0], [13, bar % 2 ? 3 : 2]]) d.note(bass, c.root + 12 + c.tones[i], bar, s, 1, v(.8)); });
  each([[72, 88]], (bar, k) => { if (k % 2 === 0) d.note(bass, H(bar).root + 12, bar, 0, 30, .5); });

  // the fifths stabs: the chord's upper tones, syncopated, the filter opening over the Lift
  each([[24, 72], [88, 120]], bar => { const c = H(bar), ns = voice(c, 60).slice(0, 4); for (const s of hits(bar % 2 ? 'x..x..x...x..x..' : 'x..x..x...x.....')) d.chord(stab, ns, bar, s, 1.5, v(s ? .5 : .62)); });
  d.ramp(d.buses.chords.filter.frequency, [[24, 600], [48, 1400], [71, 2800], [72, 700], [88, 1600], [104, 3200], [120, 800]], {exp: true});

  // the vibraphone: a four-bar answer, high, through the Dorian scale (the C# of the A13 bright on top)
  const VIB = [[0, 6, 4, 3], [0, 10, 2, 3], [1, 0, 4, 6], [2, 6, 5, 3], [2, 10, 6, 3], [3, 0, 5, 8], [3, 10, 4, 4]];
  each([[48, 72], [76, 88], [96, 120]], (bar, k) => { for (const [b, s, dg, l] of VIB) if (b === k % 4) d.note(vibes, dor(dg + 7) - 12, bar, s, l, v(s === 0 ? .6 : .5)); });

  // the pad: each chord held
  each([[0, 128]], bar => { if (bar % 2 === 0) d.chord(pad, voice(H(bar), 55), bar, 0, 31, .5); });
  d.ramp(d.buses.pad.level, [[0, .6], [16, .35], [72, .35], [74, .9], [88, .4], [120, .4], [128, 0]]);
  d.noise('fx', 80, 88, {f0: 250, f1: 6500, peak: -8});
}
