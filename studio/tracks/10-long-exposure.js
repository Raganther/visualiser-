// Long Exposure: the sparest, dub techno: one chord (A minor 7) as a stab on the off-beat, deep in the echo, its filter
// opening and closing over 16 bars, its rhythm shifting every four. The glass bass's single note, the grooving hats, a rim
// and a shaker; nearly nothing else. The movement is all in the echo and the filters.
import { buses, kick, kits, synth, chord, voice, each, hits, bar16, kickBar, hatBar } from '../lib/palette.js';
export const meta = {title: 'Long Exposure', bpm: 123, bars: 128, swing: .06, seed: 111, version: 1, key: 'A minor, one chord',
  words: 'The sparest: dub techno, one chord (A minor 7) as a stab deep in the echo, its filter opening and closing over 16 bars, its rhythm shifting every four. The glass bass on one note, hats, a rim and a shaker.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Deeper', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d, {delay: {div: 3, fb: .58, tone: 1400}, reverb: {size: .88, damp: .7}, chords: {a: 1, b: -2, filter: {cut: 700, q: 1.2}}});
  const K = kick(d, 'low'), {hats, perc} = kits(d), v = x => x*(.92 + d.rand()*.16);
  const Am = chord('A:m7');
  const stab = synth(d, 'chords', 'dubStab'), bass = synth(d, 'bass', 'glassLong');

  each([[0, 72], [88, 124]], bar => kickBar(d, K, bar));
  each([[16, 72], [88, 120]], bar => hatBar(d, hats, bar, .85));
  each([[32, 72], [88, 116]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .45));
  each([[40, 72], [92, 112]], bar => bar16(d, perc, 'rim', bar, bar % 4 === 3 ? '...x.....x....x.' : '..........x.....', .5));

  // the stab: the minor 7's upper tones, rhythms shifting every four bars
  const R = ['..x.............', '..x.......x.....', '..x....x........', '..x.......x..x..', '......x...x.....', '..x...x.......x.'];
  each([[4, 124]], bar => { const p = R[Math.floor(bar/4) % R.length]; if (bar >= 72 && bar < 88 && bar % 2) return;
    for (const s of hits(p)) d.chord(stab, voice(Am, 57), bar, s, 1, v(.62)); });
  { const pts = [[4, 400]]; for (let bar = 8; bar <= 124; bar += 8) pts.push([bar, (bar/8) % 2 ? 1800 + bar*12 : 450]); d.ramp(d.buses.chords.filter.frequency, pts, {exp: true}); }

  // the glass bass: the root on the off-beat, now and then its octave
  each([[16, 72], [88, 124]], bar => { d.note(bass, Am.root + 12, bar, 2, 2, v(.85)); d.note(bass, Am.root + 12, bar, 10, 1.5, v(.65)); if (bar % 4 === 3) d.note(bass, Am.root + 24, bar, 14, 1, v(.6)); });
  each([[72, 88]], (bar, k) => { if (k % 2 === 0) d.note(bass, Am.root + 12, bar, 0, 4, .55); });
  d.noise('fx', 72, 88, {f0: 200, f1: 1800, q: 2, peak: -16});
}
