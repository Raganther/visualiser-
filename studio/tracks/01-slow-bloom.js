// Slow Bloom: six minutes of lush minimal techno in A minor, 123 BPM. A slow LFO pad under the whole track, a Moog-style
// bass rolling on dotted quarters through each minor 9, the groove assembling a piece at a time, dub chords opening, a dark
// filtered stab for a lead, a breakdown on the full progression, the drop, then a slow taking apart.
// v2, from the user's notes on v1: the pad kept playing and wider; the bass a Moog sound, creamier, on dotted quarters; the
// lead darker and more minimal (the pluck arpeggio was cheesy); no cowbell; the hats grooving (accents, timing, decay, echo).
export const meta = {title: 'Slow Bloom', bpm: 123, bars: 186, swing: .06, seed: 7, version: 2};

// the sections, in bars [from, to)
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 80], ['Breakdown', 80, 96], ['Build', 96, 104],
  ['Peak', 104, 152], ['Taking apart', 152, 170], ['Outro', 170, 186]];

// the chords, voiced close and without the root (the bass has it); the progression four bars a chord
const CH = {Am9: [60, 64, 67, 71], Fmaj9: [57, 60, 64, 67], Dm9: [57, 60, 64, 65], Em7: [55, 59, 62, 67], Cmaj9: [59, 62, 64, 67]};
const ROOT = {Am9: 33, Fmaj9: 29, Dm9: 26, Em7: 28, Cmaj9: 36};
const PROG = ['Am9', 'Fmaj9', 'Dm9', 'Em7'];
const chordAt = bar => PROG[Math.floor(bar/4) % 4];

export function score(d){
  d.returns({delay: {div: 4, fb: .42, tone: 2000}, reverb: {size: .78, damp: .65, low: 240}, echoDb: -1, verbDb: 2, echoPump: {depth: .35, rel: .6}, verbPump: {depth: .45, rel: .7}, verbWidth: 1.3});
  // the buses
  d.bus('kick', {level: -1.5, hp: 28});
  d.bus('hats', {level: 12, width: 1.25, pump: {depth: .2, rel: .35}, a: -13, b: -20, hp: 300});
  d.bus('drums', {level: 12, width: 1.1, pump: {depth: .2, rel: .35}, b: -18, filter: {cut: 20000}});
  d.bus('perc', {level: 5, width: 1.35, pump: {depth: .25, rel: .4}, a: -16, b: -12});
  d.bus('bass', {level: -1, pump: {depth: .5, rel: .45}, filter: {cut: 1400, q: .5}});
  d.bus('pad', {level: -5, width: 1.9, mono: 200, chorus: {rate: .23, depth: .7, mix: .45}, pump: {depth: .7, rel: .6}, b: -3, hp: 140, filter: {cut: 3000}});
  d.bus('stab', {level: 3, width: 1.4, pump: {depth: .6, rel: .5}, a: 0, b: -4, hp: 160, filter: {cut: 600, q: 1.1}});
  d.bus('arp', {level: 5, width: 1.3, pump: {depth: .5, rel: .45}, a: -5, b: -8, hp: 120, filter: {cut: 700, q: 1.2}});
  d.bus('fx', {level: -3, width: 1.5, pump: {depth: .4, rel: .5}, b: -6, hp: 300});

  // the instruments: the drums softened (hats rounded off), the synths creamy
  const kick = d.kit('kick', 'Minimal', {kick: {decay: .85, x: .5, drive: .12, tone: .42, tune: -1}}); kick.side = true;
  const hats = d.kit('hats', 'Minimal', {chh: {tone: .62, level: 1.1, decay: .7, x: .3, pan: .2}, ohh: {tone: .58, level: .85, decay: .8, pan: -.2}, ride: {tone: .5, level: .4}});
  const kit = d.kit('drums', 'Minimal', {chh: {tone: .65, level: 1.1, decay: .65, x: .3, pan: .22}, ohh: {tone: .6, level: .9, decay: .8, pan: -.22}, clap: {level: .2, tone: .6, decay: 1.2}, ride: {tone: .5, level: .4}, crash: {tone: .45, level: .35, decay: 1.6}});
  const perc = d.kit('perc', 'Minimal', {rim: {level: .45, tone: .55, pan: .35}, clave: {level: .4, tone: .6, pan: -.4, tune: -3}, shaker: {level: .5, tone: .5, pan: -.2}, tomH: {level: .4, tone: .4, pan: .4}});
  // the bass a Moog's: two saws a few cents apart and a sub, a 24 dB low-pass with some resonance opened by an envelope on
  // every note, a little drive, gliding between notes
  const bass = d.synth('bass', 'Deep bass', {w1: 0, w2: 0, fine: 9, mix2: .85, sub: .5, cut: 210, res: .32, fenv: .55, track: .35, fa: .004, fd: .26, fs: .18, fr: .12, aa: .003, ad: .3, as: .75, ar: .1, oct: 0, mode: 1, glide: .035, drive: .28, chorus: 0, width: 0, level: .8});
  const pad = d.synth('pad', 'Warm pad', {chord: 0, aa: 1.2, ad: 2, as: .85, ar: 2.6, cut: 1300, res: .06, fenv: .15, lamt: .12, chorus: .2, width: 1, level: .55});
  const stab = d.synth('stab', 'Dub chord', {chord: 0, cut: 700, res: .32, fenv: .4, fd: .14, ad: .22, ar: .2, chorus: .15, width: .8, level: .55});
  // the lead: a dark, low stab, two saws and a square through a resonant filter that barely opens
  const arp = d.synth('arp', 'Dub chord', {chord: 0, w1: 0, w2: 1, fine: 7, mix2: .45, cut: 380, res: .45, fenv: .32, fd: .16, fs: 0, aa: .003, ad: .28, as: 0, ar: .25, chorus: .2, width: .8, level: .6, vel: .5});

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
  // the hats grooving: the off-beat 8ths accented, the 16ths between them ghosted with a slow swell over two bars, the odd
  // 16ths a little late and the off-beats a touch early, each hit's decay following its accent; the open hat opening a
  // little more each bar of four; a dotted-8th echo on the hats alone
  const hatBar = (bar, amt) => { for (let s = 0; s < 16; s++) {
    const off = s % 4 === 2, on = s % 4 === 0, sw = .5 + .5*Math.sin((bar % 2*16 + s)/32*Math.PI*2);
    if (!off && d.rand() < (on ? .25 : .18)) continue;
    const v = (off ? .95 : on ? .42 : .26 + .22*sw)*amt*(.9 + d.rand()*.2), at = s + (s % 2 ? .1 : off ? -.04 : 0);
    d.hit(hats, 'chh', bar, at, v, {decay: off ? .85 : .45 + .25*sw}); } };
  for (let bar = 4; bar < 80; bar++) hatBar(bar, bar < 16 ? .7 : 1);
  for (let bar = 104; bar < 180; bar++) hatBar(bar, 1);
  const ohhBar = bar => { const open = [.55, .7, .9, 1.25][bar % 4]; for (const s of [2, 6, 10, 14]) d.hit(hats, 'ohh', bar, s - .04, .72*(.9 + d.rand()*.15), {decay: open}); };
  for (let bar = 24; bar < 78; bar++) ohhBar(bar);
  for (let bar = 104; bar < 172; bar++) ohhBar(bar);
  d.pattern(kit, 'clap', '....x.......x...', 48, 80, {vel: .7});
  d.pattern(kit, 'clap', '....x.......x...', 104, 166, {vel: .75});
  d.pattern(kit, 'clap', '..............o.', 56, 80, {vel: .6, every: 2});
  d.pattern(hats, 'ride', 'x.x.x.x.x.x.x.x.', 112, 152, {vel: .4});
  d.hit(kit, 'crash', 104, 0, .7); d.hit(kit, 'crash', 136, 0, .45);
  d.pattern(perc, 'shaker', 'o.x.o.xoo.x.o.xo', 32, 80, {vel: .5});
  d.pattern(perc, 'shaker', 'o.x.o.xoo.x.o.xo', 108, 170, {vel: .55});
  // the percussion's syncopation, a two-bar figure, one more voice every eight bars
  d.pattern(perc, 'rim', '...x..x....x..x....x.....x..x...', 40, 80, {vel: .7, every: 2});
  d.pattern(perc, 'clave', '..........x.......x.....x.......', 64, 80, {vel: .6, every: 2});
  d.pattern(perc, 'rim', '...x..x....x..x....x.....x..x...', 112, 160, {vel: .7, every: 2});
  d.pattern(perc, 'clave', '..........x.......x.....x.......', 120, 160, {vel: .6, every: 2});
  d.pattern(perc, 'tomH', '.............................o.x', 120, 152, {vel: .5, every: 8});

  /* ---------- the bass: a Moog line on dotted quarters (every three 8ths, rolling across the bar against the kick),
     walking the chord's 9th chord: root, third, fifth, seventh, ninth; the root alone at first, the whole walk from bar 24 ---------- */
  const TONES = {Am9: [0, 3, 7, 10, 14], Fmaj9: [0, 4, 7, 11, 14], Dm9: [0, 3, 7, 10, 14], Em7: [0, 3, 7, 10, 14]};
  const WALK = [0, 2, 4, 1, 3, 2, 0, 4, 2, 1, 3, 0, 4, 2, 0, 3];   // (which of the chord's tones, note by note)
  const bassLine = (a, b, mode) => { for (let g = a*16; g < b*16; g += 6) { const bar = Math.floor(g/16), s = g % 16, k = g/6;
    const c = bar >= 48 && bar < 152 ? chordAt(bar) : 'Am9', r = ROOT[c], tn = TONES[c];
    const off = mode === 'root' ? (k % 4 === 3 ? 12 : 0) : mode === 'fifth' ? [0, 7, 12, 7][k % 4] : tn[WALK[k % WALK.length]];
    d.note(bass, r + off, bar, s, 5, (k % 4 === 0 ? .9 : .7)*(.94 + d.rand()*.12)); } };
  bassLine(16, 24, 'root'); bassLine(24, 80, 'walk'); bassLine(104, 152, 'walk'); bassLine(152, 176, 'fifth');
  // in the breakdown: long low notes under the pads, the progression's roots
  for (let bar = 84; bar < 104; bar += 4) d.note(bass, ROOT[chordAt(bar)], bar, 0, 60, .55);
  // the bass's filter breathes open over the Lift and the Peak
  d.ramp(d.buses.bass.filter.frequency, [[16, 900], [48, 1300], [80, 1600], [104, 1300], [140, 2200], [176, 800]], {exp: true});

  /* ---------- the pad: under the whole track, slowly modulated; the progression from the Lift ---------- */
  const padChord = bar => bar >= 48 && bar < 152 ? chordAt(bar) : 'Am9';
  for (let bar = 0; bar < 48; bar += 8) d.chord(pad, CH.Am9, bar, 0, 8*16 - 2, .55);
  for (let bar = 48; bar < 152; bar += 4) d.chord(pad, CH[padChord(bar)], bar, 0, 4*16 - 1, bar >= 80 && bar < 104 ? .7 : .5);
  for (let bar = 152; bar < 186; bar += 8) d.chord(pad, CH.Am9, bar, 0, 8*16 - 2, .5);
  d.ramp(d.buses.pad.level, [[0, .9], [16, .55], [48, .6], [80, .5], [81, .7], [96, 1], [104, .5], [112, .65], [152, .6], [170, .6], [186, 0]]);
  d.ramp(d.buses.pad.filter.frequency, [[0, 900], [16, 1800], [80, 1200], [96, 5000], [104, 2500], [186, 1500]], {exp: true});

  /* ---------- the dub chords: syncopated stabs into the echo, opening slowly ---------- */
  const stabAt = ['..x.......x.....', '..x.......x...x.', '..x....x..x.....', '..x.......x..x..'];
  const stabBar = bar => { const c = bar >= 48 ? chordAt(bar) : 'Am9', p = stabAt[bar % 4];
    for (let s = 0; s < 16; s++) if (p[s] === 'x') d.chord(stab, CH[c], bar, s, 1.5, .62 + d.rand()*.1); };
  for (let bar = 24; bar < 80; bar++) stabBar(bar);
  for (let bar = 104; bar < 160; bar++) stabBar(bar);
  d.ramp(d.buses.stab.filter.frequency, [[24, 800], [48, 1200], [79, 2600], [80, 600], [104, 1200], [136, 3200], [160, 700]], {exp: true});

  /* ---------- the lead: a dark, low stab, a two-bar figure of few notes (the root with its fifth, now and then the minor
     third), into the echo; its filter opening and closing slowly over eight bars ---------- */
  const FIG = [[3, [0, 7], .9], [10, [0], .6], [19, [3], .7], [27, [0, 7], .8]];   // (16ths into the two bars, notes, weight)
  const leadBar = (bar, sparse) => { const c = bar >= 48 && bar < 152 ? chordAt(bar) : 'Am9', r = ROOT[c] + 24;
    for (const [at, ns, w] of FIG) { if (Math.floor(at/16) !== bar % 2 || (sparse && ns.length < 2)) continue;
      ns.forEach(o => d.note(arp, r + o, bar, at % 16, 2, w*(.9 + d.rand()*.15))); } };
  for (let bar = 56; bar < 80; bar++) leadBar(bar);
  for (let bar = 84; bar < 104; bar++) leadBar(bar, true);
  for (let bar = 112; bar < 156; bar++) leadBar(bar);
  { const pts = []; for (let bar = 56; bar <= 156; bar += 4) pts.push([bar, (bar/4) % 2 ? 900 : 380]); d.ramp(d.buses.arp.filter.frequency, pts, {exp: true}); }
  d.ramp(d.buses.arp.level, [[56, 0], [64, 1.4], [80, 1.4], [84, 1.6], [104, 1.2], [112, 1.5], [156, .8]]);

  /* ---------- the moments: a riser into the drop, a reverse wash out of the breakdown, a sweep before the outro ---------- */
  d.noise('fx', 96, 104, {f0: 250, f1: 7000, peak: -6});
  d.noise('fx', 80, 84, {f0: 4000, f1: 400, peak: -10, fade: 'out'});
  d.noise('fx', 166, 170, {f0: 300, f1: 3000, peak: -14});
  // the kick's absence before the drop: the last beat of 103 silent (the pad and the riser carry it)
  d.dbRamp(d.buses.fx.level, [[0, -3], [103.75, -3], [104, -40], [160, -40], [162, -3]]);
}
