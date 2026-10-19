// Copper Wire: minimal, one chord. The glass sequence the user saved runs the whole way on A minor 9, one of its eight steps
// changing every 24 bars, so it grows without the harmony moving; metal hats in fives turn over against the four, a steel
// drum in threes walks the chord, a one-note ping comes in at the peak. The movement is the filters and the parts arriving.
import { buses, kick, kits, synth, chord, voice, each, every, hits, bar16, kickBar, hatBar, ohhBar } from '../lib/palette.js';
export const meta = {title: 'Copper Wire', bpm: 125, bars: 128, swing: .06, seed: 21, version: 1, key: 'A minor, one chord',
  words: 'Minimal: one chord all the way (A minor 9). Your glass sequence on the round kick, a step of it changing every 24 bars; metal hats in fives, a steel drum in threes, a one-note ping at the peak.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d);
  const K = kick(d, 'round'), {hats, drums, perc, bell} = kits(d), v = x => x*(.92 + d.rand()*.16);
  const Am = chord('A:m9');
  const bass = synth(d, 'bass', 'glass'), steel = synth(d, 'bells', 'steel'), ping = synth(d, 'lead', 'ping'), pad = synth(d, 'pad', 'warm');

  // the drums
  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[4, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .65 : 1));
  each([[24, 70], [92, 116]], bar => ohhBar(d, hats, bar));
  each([[16, 72], [88, 112]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .7));
  each([[32, 72], [88, 120]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .5));
  each([[40, 72], [96, 112]], bar => bar16(d, perc, 'rim', bar, bar % 2 ? '...x..x....x..x.' : '...x.....x..x...', .6));
  every(32, 72, 5, 2, (bar, s) => d.hit(bell, 'chh', bar, s, v(.55)));
  every(90, 118, 5, 2, (bar, s) => d.hit(bell, 'chh', bar, s, v(.55)));
  d.hit(drums, 'crash', 88, 0, .6);
  d.ramp(d.buses.hats.filter.frequency, [[0, 2500], [16, 20000], [116, 20000], [124, 3000]], {exp: true});

  // the glass sequence, a 16th each on the chord's tones (8ths in the intro); one step changes every 24 bars
  const SEQS = [[0, 2, 3, 4, 1, 2, 0, 3], [0, 2, 3, 4, 1, 2, 0, 4], [0, 3, 2, 4, 1, 3, 0, 4], [0, 2, 4, 3, 1, 4, 0, 3], [0, 2, 3, 4, 2, 4, 1, 3], [0, 2, 3, 4, 1, 2, 0, 3]];
  each([[8, 126]], bar => { const seq = SEQS[Math.floor(bar/24)];
    for (let s = 0; s < 16; s++) { if (bar < 16 && s % 2) continue; if (bar >= 72 && bar < 84 && s % 4 === 3) continue;
      d.note(bass, Am.root + 12 + Am.tones[seq[s % 8]], bar, s, .9, v(.55 + .1*(bar % 4)/3 + (s % 4 ? 0 : .15))); } });
  d.ramp(d.buses.bass.filter.frequency, [[8, 500], [16, 1300], [48, 2600], [72, 800], [86, 3200], [88, 2600], [112, 1800], [126, 400]], {exp: true});

  // a steel drum on every three 16ths, walking the chord: three against four
  const W = [0, 2, 4, 1, 3];
  for (const [a, b] of [[48, 72], [76, 88], [96, 116]]) every(a, b, 3, 0, (bar, s, j) => d.note(steel, 57 + Am.tones[W[j % 5]], bar, s, 1.5, v(j % 4 === 0 ? .7 : .5)));
  d.dbRamp(d.buses.bells.level, [[48, -12], [56, -1], [72, -1], [76, -6], [88, -1], [116, -8]]);

  // the one-note ping in the peak, its filter opening and closing over 8 bars
  each([[96, 116]], bar => { for (const s of hits(['..x..x....x..x..', '..x..x...x....x.'][bar % 2])) d.note(ping, 69, bar, s, .7, v(.65)); });
  { const pts = []; for (let bar = 96; bar <= 116; bar += 4) pts.push([bar, (bar/4) % 2 ? 4000 : 900]); d.ramp(d.buses.lead.filter.frequency, pts, {exp: true}); }

  // the pad, held eight bars at a time, under it all; up in the breakdown
  for (let bar = 0; bar < 128; bar += 8) d.chord(pad, voice(Am, 57), bar, 0, 8*16 - 2, .5);
  d.ramp(d.buses.pad.level, [[0, .3], [16, .25], [72, .25], [74, .7], [88, .3], [120, .3], [128, 0]]);
  d.ramp(d.buses.pad.filter.frequency, [[0, 900], [72, 1200], [86, 4000], [88, 1800], [128, 900]], {exp: true});

  d.noise('fx', 80, 88, {f0: 250, f1: 7000, peak: -7});
  d.noise('fx', 72, 75, {f0: 4000, f1: 400, peak: -12, fade: 'out'});
}
