// Slow Bloom: six minutes of lush minimal techno in A minor, 123 BPM. A kick and a breath of pad, the groove assembling a
// piece at a time, dub chords opening over 56 bars, a pluck arpeggio, a breakdown on the full progression, the drop, then a
// slow taking apart. The pads, chords and arp pump on the kick; the drums stay narrow, everything else wide.
export const meta = {title: 'Slow Bloom', bpm: 123, bars: 186, swing: .06, seed: 7, version: 1};

// the sections, in bars [from, to)
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 80], ['Breakdown', 80, 96], ['Build', 96, 104],
  ['Peak', 104, 152], ['Taking apart', 152, 170], ['Outro', 170, 186]];

// the chords, voiced close and without the root (the bass has it); the progression four bars a chord
const CH = {Am9: [60, 64, 67, 71], Fmaj9: [57, 60, 64, 67], Dm9: [57, 60, 64, 65], Em7: [55, 59, 62, 67], Cmaj9: [59, 62, 64, 67]};
const ROOT = {Am9: 33, Fmaj9: 29, Dm9: 26, Em7: 28, Cmaj9: 36};
const PROG = ['Am9', 'Fmaj9', 'Dm9', 'Em7'];
const chordAt = bar => PROG[Math.floor(bar/4) % 4];

export function score(d){
  d.returns({delay: {div: 6, fb: .45, tone: 2200}, reverb: {size: .78, damp: .65, low: 240}, echoDb: -1, verbDb: 2, echoPump: {depth: .35, rel: .6}, verbPump: {depth: .45, rel: .7}, verbWidth: 1.3});
  // the buses
  d.bus('kick', {level: -1.5, hp: 28});
  d.bus('drums', {level: 12, width: 1.1, pump: {depth: .2, rel: .35}, b: -18, filter: {cut: 20000}});
  d.bus('perc', {level: 5, width: 1.35, pump: {depth: .25, rel: .4}, a: -16, b: -12});
  d.bus('bass', {level: -1, pump: {depth: .55, rel: .45}, filter: {cut: 900, q: .6}});
  d.bus('pad', {level: -5, width: 1.5, mono: 180, pump: {depth: .7, rel: .6}, b: -6, hp: 140, filter: {cut: 3000}});
  d.bus('stab', {level: 3, width: 1.4, pump: {depth: .6, rel: .5}, a: 0, b: -4, hp: 160, filter: {cut: 600, q: 1.1}});
  d.bus('arp', {level: 5, width: 1.5, pump: {depth: .5, rel: .45}, a: -7, b: -8, hp: 220, filter: {cut: 900, q: .9}});
  d.bus('fx', {level: -3, width: 1.5, pump: {depth: .4, rel: .5}, b: -6, hp: 300});

  // the instruments: the drums softened (hats rounded off), the synths creamy
  const kick = d.kit('kick', 'Minimal', {kick: {decay: .85, x: .5, drive: .12, tone: .42, tune: -1}}); kick.side = true;
  const kit = d.kit('drums', 'Minimal', {chh: {tone: .65, level: 1.1, decay: .65, x: .3, pan: .22}, ohh: {tone: .6, level: .9, decay: .8, pan: -.22}, clap: {level: .2, tone: .6, decay: 1.2}, ride: {tone: .5, level: .4}, crash: {tone: .45, level: .35, decay: 1.6}});
  const perc = d.kit('perc', 'Minimal', {rim: {level: .45, tone: .55, pan: .35}, clave: {level: .4, tone: .6, pan: -.4, tune: -3}, shaker: {level: .5, tone: .5, pan: -.2}, cow: {level: .25, tone: .4, tune: -7, pan: .45}, tomH: {level: .4, tone: .4, pan: .4}});
  const bass = d.synth('bass', 'Deep bass', {w1: 0, w2: 3, mix2: .25, sub: .55, cut: 260, res: .12, fenv: .3, fd: .18, fs: .1, ad: .25, as: .7, ar: .08, oct: 0, mode: 1, drive: .1, level: .85});
  const pad = d.synth('pad', 'Warm pad', {chord: 0, aa: 1.2, ad: 2, as: .85, ar: 2.6, cut: 1300, res: .06, fenv: .15, lamt: .12, chorus: .2, width: 1, level: .55});
  const stab = d.synth('stab', 'Dub chord', {chord: 0, cut: 700, res: .32, fenv: .4, fd: .14, ad: .22, ar: .2, chorus: .15, width: .8, level: .55});
  const arp = d.synth('arp', 'Pluck', {cut: 650, res: .28, fenv: .6, fd: .16, ad: .3, ar: .35, chorus: .25, width: .9, level: .5, vel: .6});

  /* ---------- the kick: four to the floor, out for the breakdown and build ---------- */
  const kickOn = bar => bar < 80 || (bar >= 104 && bar < 184);
  for (let bar = 0; bar < 186; bar++) { if (!kickOn(bar)) continue;
    for (let b = 0; b < 4; b++) d.hit(kick, 'kick', bar, b*4, b === 0 ? 1 : .92);
    if (bar % 8 === 7 && bar >= 24 && bar < 150) d.hit(kick, 'kick', bar, 15, .35); }   // (a ghost into each eighth bar)
  // the drop's last beat held: the kick drops out for one beat before 104
  // the drums' bus opens from muffled over the intro, and closes again at the end
  d.ramp(d.buses.drums.filter.frequency, [[0, 700], [14, 9000], [16, 20000], [176, 20000], [186, 600]], {exp: true});
  d.ramp(d.buses.kick.level, [[0, .55], [8, .8], [16, .84], [180, .84], [186, .3]]);

  /* ---------- hats, claps, shaker, ride ---------- */
  d.pattern(kit, 'chh', 'o.x.o.x.o.x.o.xo', 4, 80, {vel: .55, prob: .96});
  d.pattern(kit, 'chh', 'o.x.o.x.o.x.o.xo', 104, 180, {vel: .6, prob: .96});
  d.pattern(kit, 'ohh', '..x...x...x...x.', 24, 78, {vel: .7});
  d.pattern(kit, 'ohh', '..x...x...x...x.', 104, 172, {vel: .75});
  d.pattern(kit, 'clap', '....x.......x...', 48, 80, {vel: .7});
  d.pattern(kit, 'clap', '....x.......x...', 104, 166, {vel: .75});
  d.pattern(kit, 'clap', '..............o.', 56, 80, {vel: .6, every: 2});
  d.pattern(kit, 'ride', 'x.x.x.x.x.x.x.x.', 112, 152, {vel: .45});
  d.hit(kit, 'crash', 104, 0, .7); d.hit(kit, 'crash', 136, 0, .45);
  d.pattern(perc, 'shaker', 'o.x.o.xoo.x.o.xo', 32, 80, {vel: .5});
  d.pattern(perc, 'shaker', 'o.x.o.xoo.x.o.xo', 108, 170, {vel: .55});
  // the percussion's syncopation, a two-bar figure, one more voice every eight bars
  d.pattern(perc, 'rim', '...x..x....x..x....x.....x..x...', 40, 80, {vel: .7, every: 2});
  d.pattern(perc, 'clave', '..........x.......x.....x.......', 64, 80, {vel: .6, every: 2});
  d.pattern(perc, 'rim', '...x..x....x..x....x.....x..x...', 112, 160, {vel: .7, every: 2});
  d.pattern(perc, 'clave', '..........x.......x.....x.......', 120, 160, {vel: .6, every: 2});
  d.pattern(perc, 'cow', '.......x...............x........', 128, 152, {vel: .5, every: 2});
  d.pattern(perc, 'tomH', '.............................o.x', 120, 152, {vel: .5, every: 8});

  /* ---------- the bass: the root on the off-beats, rolling later; following the chords from the Lift ---------- */
  const bassBar = (bar, figure) => { const r = bar >= 48 && bar < 152 ? ROOT[chordAt(bar)] : 33;
    for (let s = 0; s < 16; s++) { const c = figure[s]; if (c === '.') continue;
      const n = r + (c === '5' ? 7 : c === '8' ? 12 : 0); d.note(bass, n, bar, s, c === '-' ? 3 : 1.6, c === 'o' ? .45 : .8); } };
  const A = '..x...x...x...x.', A2 = '..x...x...x..ox5', R = '..xo..xo..xo..x8';
  for (let bar = 16; bar < 80; bar++) bassBar(bar, bar < 32 ? A : bar % 4 === 3 ? A2 : bar >= 56 ? R : A);
  for (let bar = 104; bar < 176; bar++) bassBar(bar, bar >= 152 ? (bar % 4 === 3 ? A2 : A) : bar % 4 === 3 ? A2 : R);
  // in the breakdown: long low notes under the pads, the progression's roots
  for (let bar = 84; bar < 104; bar += 4) d.note(bass, ROOT[chordAt(bar)], bar, 0, 60, .55);
  // the bass's filter breathes open over the Lift and the Peak
  d.ramp(d.buses.bass.filter.frequency, [[16, 500], [48, 800], [80, 1100], [104, 900], [140, 1400], [176, 600]], {exp: true});

  /* ---------- the pad: a breath in the intro, the progression in the breakdown, a bed under the peak ---------- */
  for (let bar = 0; bar < 16; bar += 8) d.chord(pad, CH.Am9, bar, 0, 8*16 - 2, .55);
  for (let bar = 80; bar < 104; bar += 4) d.chord(pad, CH[chordAt(bar)], bar, 0, 4*16 - 1, .7);
  for (let bar = 112; bar < 152; bar += 4) d.chord(pad, CH[chordAt(bar)], bar, 0, 4*16 - 1, .45);
  for (let bar = 170; bar < 186; bar += 8) d.chord(pad, CH.Am9, bar, 0, 8*16 - 2, .5);
  d.ramp(d.buses.pad.level, [[0, .9], [16, .3], [80, 0], [81, .7], [96, 1], [104, .5], [112, .7], [152, .65], [170, .6], [186, 0]]);
  d.ramp(d.buses.pad.filter.frequency, [[0, 900], [16, 1800], [80, 1200], [96, 5000], [104, 2500], [186, 1500]], {exp: true});

  /* ---------- the dub chords: syncopated stabs into the echo, opening slowly ---------- */
  const stabAt = ['..x.......x.....', '..x.......x...x.', '..x....x..x.....', '..x.......x..x..'];
  const stabBar = bar => { const c = bar >= 48 ? chordAt(bar) : 'Am9', p = stabAt[bar % 4];
    for (let s = 0; s < 16; s++) if (p[s] === 'x') d.chord(stab, CH[c], bar, s, 1.5, .62 + d.rand()*.1); };
  for (let bar = 24; bar < 80; bar++) stabBar(bar);
  for (let bar = 104; bar < 160; bar++) stabBar(bar);
  d.ramp(d.buses.stab.filter.frequency, [[24, 800], [48, 1200], [79, 2600], [80, 600], [104, 1200], [136, 3200], [160, 700]], {exp: true});

  /* ---------- the pluck arpeggio: from the Lift, alone in the breakdown, brightest at the peak ---------- */
  const arpBar = (bar, v) => { const n = CH[chordAt(bar)], seq = [n[0], n[2], n[1] + 12, n[3], n[0] + 12, n[2], n[3] + 12, n[1]];
    for (let s = 0; s < 16; s++) { if ((s + bar) % 7 === 6) continue; d.note(arp, seq[(s + bar*3) % 8], bar, s, 1.2, v*(s % 4 === 0 ? 1 : .75)); } };
  for (let bar = 56; bar < 80; bar++) arpBar(bar, .6);
  for (let bar = 84; bar < 104; bar++) arpBar(bar, .55);
  for (let bar = 112; bar < 156; bar++) arpBar(bar, .65);
  d.ramp(d.buses.arp.filter.frequency, [[56, 500], [79, 1800], [84, 700], [103, 4500], [112, 1500], [148, 4200], [156, 800]], {exp: true});
  d.ramp(d.buses.arp.level, [[56, 0], [64, 1.6], [80, 1.6], [84, 2], [104, 1.4], [112, 1.7], [156, .9]]);

  /* ---------- the moments: a riser into the drop, a reverse wash out of the breakdown, a sweep before the outro ---------- */
  d.noise('fx', 96, 104, {f0: 250, f1: 7000, peak: -6});
  d.noise('fx', 80, 84, {f0: 4000, f1: 400, peak: -10, fade: 'out'});
  d.noise('fx', 166, 170, {f0: 300, f1: 3000, peak: -14});
  // the kick's absence before the drop: the last beat of 103 silent (the pad and the riser carry it)
  d.dbRamp(d.buses.fx.level, [[0, -3], [103.75, -3], [104, -40], [160, -40], [162, -3]]);
}
