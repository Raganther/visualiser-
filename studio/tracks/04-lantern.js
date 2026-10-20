// Lantern: a two-chord Dorian vamp, two bars each, the Detroit fifths stabs, the round Detroit bass, the groove with
// ride-bell accents.
// v2, from the user's notes on v1 (the vibes over the A13 sounded cheesy; the bass is OK): the A13 is gone for a
// Cmaj7#11, less sweet, floating; no vibes: a steel drum in threes on the E minor pentatonic in its place, short and
// percussive, a note of it changing every eight bars; no clap and no pad: the stabs carry the chords, their filter
// opening and closing on an LFO, into echo washes.
import { buses, kick, kits, synth, cycle, voice, scale, each, every, bar16, kickBar, hatBar, ohhBar, hits } from '../lib/palette.js';
export const meta = {title: 'Lantern', bpm: 122, bars: 128, swing: .07, seed: 44, version: 2, key: 'E Dorian: Em9, Cmaj7#11',
  words: 'v2, from your notes: the A13 is gone for a floating Cmaj7#11; no vibes: a steel drum in threes in their place, short and percussive, a note changing every eight bars; no clap and no pad: the stabs carry the chords, their filter opening and closing on an LFO into echo washes; the bass as it was.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d, {chords: {filter: {cut: 1400, q: 1.2}, a: -5}, bells: {filter: {cut: 3000, q: 1.5}}});
  const wash = d.addReturn('wash', 'delay', {div: 3, fb: .6, tone: 2600}, {level: -4, width: 1.7, pump: {depth: .5, rel: .6}, hp: 300});
  const toWash = {chords: d.send('chords', 'wash'), bells: d.send('bells', 'wash')};
  const K = kick(d, 'round'), {hats, drums, perc, bell} = kits(d), v = x => x*(.92 + d.rand()*.16), B = d.buses;
  const H = cycle([['E:m9', 2], ['C:lyd', 2]]), pen = scale(64, 'penta');
  const stab = synth(d, 'chords', 'fifths'), steel = synth(d, 'bells', 'steel'), bass = synth(d, 'bass', 'clean');

  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[4, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .7 : 1));
  each([[32, 72], [88, 116]], bar => ohhBar(d, hats, bar));
  each([[24, 72], [88, 120]], bar => bar16(d, bell, 'ride', bar, '...x...x...x...x', .5));
  each([[40, 72], [96, 112]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .5));
  each([[32, 72], [92, 116]], bar => bar16(d, perc, 'rim', bar, bar % 2 ? '...x.....x..x...' : '......x....x..x.', .5));
  d.hit(drums, 'crash', 88, 0, .6);

  // the Detroit bass: root and fifth, syncopated (as v1)
  each([[16, 72], [88, 124]], bar => { const c = H(bar); for (const [s, i] of [[0, 0], [3, 0], [6, 2], [10, 0], [13, bar % 2 ? 3 : 2]]) d.note(bass, c.root + 12 + c.tones[i] - (c.root > 33 ? 12 : 0), bar, s, 1, v(.8)); });
  each([[72, 88]], (bar, k) => { if (k % 2 === 0) d.note(bass, H(bar).root + 12 - (H(bar).root > 33 ? 12 : 0), bar, 0, 30, .5); });

  // the stabs carry the chords (from the intro, filtered), the filter opening and closing on an LFO, into echo washes
  each([[0, 72], [72, 88], [88, 124]], bar => { const c = H(bar), ns = voice(c, bar >= 48 && bar < 72 ? 62 : 60).slice(0, 4), brk = bar >= 72 && bar < 88;
    for (const s of hits(brk ? 'x.....x.........' : bar % 2 ? 'x..x..x...x..x..' : 'x..x..x...x.....')) d.chord(stab, ns, bar, s, brk ? 3 : 1.5, v(s ? .5 : .62)); });
  d.ramp(B.chords.filter.frequency, [[0, 450], [16, 800], [24, 1000], [48, 1500], [71, 3000], [72, 700], [86, 2500], [88, 1600], [104, 3400], [124, 600]], {exp: true});
  d.lfo(B.chords.filter.frequency, {beats: 8, depth: [[0, 100], [24, 300], [48, 600], [72, 300], [88, 500], [104, 1000], [124, 100]], rate: [[0, 8], [56, 4], [70, 2], [72, 8], [100, 4], [110, 2], [116, 8]]});
  d.ramp(B.chords.filter.Q, [[0, 1.2], [48, 2.5], [71, 3.5], [72, 1.5], [104, 3.5], [124, 1.2]]);
  d.ramp(toWash.chords, [[0, 0], [70, 0], [72, .35], [87, .5], [88, 0], [112, 0], [116, .3], [124, 0]]);

  // the steel drum in threes on the E minor pentatonic, a note of its five changing every eight bars
  const WALKS = [[0, 2, 4, 1, 3], [0, 2, 4, 1, 5], [0, 3, 4, 1, 5], [0, 3, 5, 2, 4], [0, 2, 5, 1, 3], [0, 2, 4, 1, 3]];
  for (const [a, b] of [[48, 72], [76, 88], [96, 120]]) every(a, b, 3, 0, (bar, s, j) => { const w = WALKS[Math.floor((bar - 48)/8) % WALKS.length];
    d.note(steel, pen(w[j % 5] + (bar >= 108 && j % 5 === 2 ? 5 : 0)), bar, s, 1.5, v(j % 4 === 0 ? .65 : .48)); });
  d.ramp(B.bells.filter.frequency, [[48, 1200], [64, 3000], [71, 5000], [76, 1500], [88, 2500], [108, 6000], [120, 1500]], {exp: true});
  d.lfo(B.bells.filter.frequency, {beats: 6, depth: [[48, 200], [64, 700], [72, 400], [96, 600], [112, 1300], [120, 0]], rate: [[48, 6], [66, 3], [76, 6], [100, 3], [110, 1.5], [116, 6]]});
  d.morph(steel, 'ad', [[48, .35], [64, .55], [76, .8], [96, .4], [112, .7]], 2);
  { const p = [[48, 0]]; for (let bar = 56; bar <= 120; bar += 8) p.push([bar - 1, .02], [bar - .25, .4], [bar + .5, .02]); d.ramp(toWash.bells, p); }
  d.noise('fx', 80, 88, {f0: 250, f1: 6500, peak: -8});
}
