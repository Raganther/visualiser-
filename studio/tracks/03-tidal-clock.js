// Tidal Clock: minimal, one chord (D minor 11), built on phasing: two kalimbas play the same notes in loops of 12 and 13
// sixteenths, so they drift apart and back over the track (as in Reich's phase pieces) and the pattern is never quite the
// same twice. Toms in threes, woodblocks in fives at the peak, the dotted walk on the clean bass.
// v2, from the user's notes on v1: the clap on 2 and 4 is gone (a toms and rim groove off the downbeats instead); the
// kalimbas' loops vary a little every few phrases (a note moved, an octave flipped, a step added) and each has its own
// filter, opening and closing on an LFO that speeds up, with resonance, decay and echo washes moving; no pad at all: the
// breakdown is a new polyrhythm (woodblocks in sevens) in echoes and reverb, then the hats build it back up.
import { buses, kick, kits, synth, chord, scale, each, every, bar16, kickBar, ohhBar } from '../lib/palette.js';
export const meta = {title: 'Tidal Clock', bpm: 122, bars: 128, swing: .05, seed: 33, version: 2, key: 'D minor, one chord (no pad)',
  words: 'v2, from your notes: no clap (toms and rim off the downbeats instead); the two kalimba loops vary a little every few phrases, each with its own filter opening and closing on an LFO that speeds up, resonance and echo washes; no pad: the breakdown is woodblocks in sevens in echoes and reverb, then the hats build it back up.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  const kalBus = {level: 7, width: 1.3, pump: {depth: .35, rel: .45}, a: -5, b: -6, hp: 200, filter: {cut: 2000, q: 1.5}};
  buses(d, {bells: {...kalBus, pan: -.2}, lead: {filter: {cut: 3000, q: 1}}});
  d.bus('bellsB', {...kalBus, pan: .2});
  const wash = d.addReturn('wash', 'delay', {div: 3, fb: .66, tone: 2400}, {level: -3, width: 1.7, pump: {depth: .5, rel: .6}, hp: 250});
  const toWash = {a: d.send('bells', 'wash'), b: d.send('bellsB', 'wash'), wood: d.send('lead', 'wash')};
  const K = kick(d, 'round'), {hats, drums, perc} = kits(d, {perc: {tomL: {level: .9, decay: 1.1}, tomH: {level: .75, decay: .95, pan: .35}, rim: {level: .4, tone: .5, pan: -.3}}}), v = x => x*(.92 + d.rand()*.16);
  const Dm = chord('D:m11'), pen = scale(62, 'penta'), B = d.buses;
  const kalA = synth(d, 'bells', 'kalimba', {width: .3}), kalB = synth(d, 'bellsB', 'kalimba', {width: .3, fine: 4}), wood = synth(d, 'lead', 'wood');
  const bass = synth(d, 'bass', 'clean', {ad: .2, as: .3});

  /* ---------- the drums: no clap; toms in threes, a rim and a high tom off the downbeats ---------- */
  each([[0, 72], [88, 124]], bar => kickBar(d, K, bar));
  each([[8, 72], [88, 120]], bar => bar16(d, hats, 'chh', bar, bar < 16 ? '..x...x...x...x.' : '..x...x...x...xo', .7));
  each([[16, 72], [88, 120]], bar => bar16(d, perc, 'shaker', bar, 'oxoxoxoxoxoxoxox', .42));
  each([[48, 72], [92, 116]], bar => ohhBar(d, hats, bar, .8));
  for (const [a, b] of [[24, 72], [88, 120]]) { every(a, b, 6, 3, (bar, s) => d.hit(perc, 'tomL', bar, s, v(.62))); every(a, b, 6, 0, (bar, s) => s % 4 && d.hit(perc, 'tomH', bar, s, v(.48))); }
  // the backbeat's replacement: a rim on the 16ths around the beats, never on them, a two-bar figure
  each([[32, 72], [88, 112]], bar => bar16(d, perc, 'rim', bar, bar % 2 ? '...x.....x....x.' : '.......x..x...x.', .55));
  // woodblocks in fives at the peak, up the scale
  every(88, 112, 5, 1, (bar, s, j) => d.note(wood, pen(5 + [0, 2, 1, 3, 4][j % 5]), bar, s, 1, v(.5)));

  /* ---------- the two kalimbas, varying: every 16 bars one of them changes a little ---------- */
  const A = [
    [[0, 0], [2, 2], [4, 3], [5, 1], [7, 4], [9, 2], [10, 3]],              // as v1
    [[0, 0], [2, 2], [4, 3], [5, 1], [7, 4], [9, 2], [10, 5]],              // its last note up an octave
    [[0, 0], [2, 2], [4, 3], [5, 1], [7, 4], [8, 3], [9, 2], [10, 3]],      // a step added
    [[0, 0], [2, 3], [4, 2], [5, 1], [7, 4], [9, 2], [10, 3]],              // two notes swapped
    [[0, 0], [2, 2], [4, 3], [5, 6], [7, 4], [9, 2], [11, 3]],              // a leap, its last moved later
    [[0, 0], [2, 2], [4, 3], [5, 1], [7, 4], [9, 2], [10, 3]]];             // home
  const Bv = [
    [[0, 4], [3, 3], [5, 1], [8, 2], [10, 0], [11, 5]],
    [[0, 4], [3, 3], [5, 1], [8, 2], [10, 0], [11, 5]],
    [[0, 4], [3, 3], [5, 2], [8, 1], [10, 0], [11, 5]],
    [[0, 4], [3, 3], [5, 1], [7, 3], [8, 2], [10, 0], [11, 6]],
    [[0, 5], [3, 3], [5, 1], [8, 2], [10, 0], [12, 4]],
    [[0, 4], [3, 3], [5, 1], [8, 2], [10, 0], [11, 5]]];
  const loop = (syn, vars, len, a, b, lift, vel, skip) => { for (let g = a*16; g < b*16; g++) { const bar = Math.floor(g/16); if (skip && skip(bar)) continue;
    const cyc = vars[Math.min(vars.length - 1, Math.floor(bar/16) - 1)] || vars[0], at = cyc.find(([s]) => s === (g - a*16) % len);
    if (at) d.note(syn, pen(at[1] + lift), bar, g % 16, 1.5, v(at[0] === 0 ? vel : vel*.78)); } };
  loop(kalA, A, 12, 16, 112, 0, .7, bar => bar >= 76 && bar < 80);
  loop(kalB, Bv, 13, 40, 120, 5, .55, bar => bar >= 72 && bar < 82);
  // each its own filter, opening and closing on an LFO that speeds up through the lift and the peak, out of step with the other
  d.ramp(B.bells.filter.frequency, [[16, 1200], [32, 2600], [48, 3200], [71, 6000], [72, 900], [86, 4000], [88, 3000], [108, 7000], [120, 1500]], {exp: true});
  d.ramp(B.bellsB.filter.frequency, [[40, 900], [56, 2400], [71, 4500], [82, 700], [88, 2600], [104, 5500], [120, 1200]], {exp: true});
  d.lfo(B.bells.filter.frequency, {beats: 16, depth: [[16, 0], [32, 600], [48, 900], [72, 400], [88, 1200], [120, 0]], rate: [[16, 16], [48, 8], [64, 4], [71, 2], [72, 16], [88, 8], [100, 4], [108, 2], [112, 8]]});
  d.lfo(B.bellsB.filter.frequency, {beats: 12, depth: [[40, 0], [56, 700], [72, 300], [88, 1000], [120, 0]], rate: [[40, 12], [60, 6], [71, 3], [72, 12], [96, 6], [108, 3], [112, 12]]});
  d.ramp(B.bells.filter.Q, [[16, 1.5], [48, 3], [71, 4.5], [72, 2], [108, 4.5], [120, 1.5]]);
  d.ramp(B.bellsB.filter.Q, [[40, 2], [70, 4], [72, 2], [104, 4], [120, 1.5]]);
  d.morph(kalA, 'ad', [[16, .3], [48, .5], [72, .9], [88, .35], [108, .6], [112, .35]], 2);
  d.morph(kalB, 'ad', [[40, .3], [60, .55], [88, .3], [104, .6], [120, .35]], 2);
  d.morph(kalA, 'fenv', [[16, .15], [64, .45], [88, .2], [108, .5]], 2);
  // echo washes at the end of each eight bars, more of them as it builds
  { const pa = [[16, 0]], pb = [[40, 0]]; for (let bar = 24; bar <= 120; bar += 8) { const amt = bar > 88 ? .5 : .3; pa.push([bar - 1, .02], [bar - .25, amt], [bar + .5, .02]); if (bar > 44) pb.push([bar - 1, .02], [bar - .25, amt*.8], [bar + .5, .02]); }
    d.ramp(toWash.a, pa); d.ramp(toWash.b, pb); }

  /* ---------- the breakdown: no chord, no kick; woodblocks in sevens against the kalimba's twelve, deep in the echo and
     reverb, then the hats coming back in, 8ths to 16ths, to build it up ---------- */
  every(72, 88, 7, 0, (bar, s, j) => d.note(wood, pen([3, 5, 4, 7, 5, 6, 4][j % 7]), bar, s, 1, v(.55)));
  d.ramp(toWash.wood, [[72, .15], [80, .4], [87, .6], [88, 0], [112, 0]]);
  d.ramp(B.lead.b.gain, [[72, 1], [86, 1.6], [88, .5]]);
  d.ramp(B.lead.filter.frequency, [[72, 1500], [80, 4000], [87, 8000], [88, 3000]], {exp: true});
  each([[80, 88]], (bar, k) => bar16(d, hats, 'chh', bar, k < 4 ? '..x...x...x...x.' : k < 6 ? '..x.x.x.x.x.x.x.' : 'xxxxxxxxxxxxxxxx', .35 + k*.06));

  /* ---------- the dotted walk: every six 16ths through the chord's tones; in the breakdown, long roots from bar 80 ---------- */
  const WALK = [0, 2, 4, 1, 3, 2, 0, 4];
  for (const [a, b] of [[16, 72], [88, 124]]) for (let g = Math.ceil(a*16/6)*6; g < b*16; g += 6) { const j = g/6;
    d.note(bass, Dm.root + 12 + Dm.tones[WALK[j % 8]] - (Dm.tones[WALK[j % 8]] > 12 ? 12 : 0), Math.floor(g/16), g % 16, 2.5, v(a === 16 && g < 24*16 ? .7 : .85)); }
  for (let bar = 80; bar < 88; bar += 4) d.note(bass, Dm.root + 12, bar, 0, 60, .5);
  d.ramp(B.bass.filter.frequency, [[16, 1200], [48, 2400], [71, 3000], [80, 600], [88, 2400], [124, 900]], {exp: true});

  d.noise('fx', 82, 88, {f0: 300, f1: 6000, peak: -8});
  d.hit(drums, 'crash', 88, 0, .55);
}
