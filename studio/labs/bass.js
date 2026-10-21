// The bass lab: sixteen basslines over one 16-bar loop of Slow Bloom's groove (the four chords once round), each rendered
// as its own stem in time with the loop, so the loop lab page can swap them under it while it plays. Each idea is a sound
// (the polysynth's settings over a preset) and a motif (notes placed per bar from the chord's root and tones).
export const meta = {title: 'Bass lab', part: 'bass', bpm: 123, bars: 16, warm: 1, swing: .06, seed: 11};

const CH = {Am9: [60, 64, 67, 71], Fmaj9: [57, 60, 64, 67], Dm9: [57, 60, 64, 65], Em7: [55, 59, 62, 67]};
const ROOT = {Am9: 33, Fmaj9: 29, Dm9: 26, Em7: 28};
// each chord's 9th chord from the root: root, third, fifth, seventh, ninth
const TONES = {Am9: [0, 3, 7, 10, 14], Fmaj9: [0, 4, 7, 11, 14], Dm9: [0, 3, 7, 10, 14], Em7: [0, 3, 7, 10, 14]};
const PROG = ['Am9', 'Fmaj9', 'Dm9', 'Em7'];
const W = meta.warm, chordAt = bar => PROG[Math.floor(Math.max(0, bar - W)/4) % 4];
const SAW = 0, SQUARE = 1, TRI = 2, SINE = 3;

// the ideas: id, name, what it is, the sound, its echo send (dB), and play(n, bar, k): n(note, step, len16, vel) per bar
// (k counts bars from the loop's start, r is the chord's root, t its tones)
export const IDEAS = [
  {id: 'sub-off', name: 'Sub on the off-beats', words: 'A pure sine sub on every off-beat 8th: deep house weight, nothing on the kick.',
    preset: 'Sub bass', sound: {w1: SINE, sub: 0, ad: .25, as: .6, ar: .06, drive: .15, oct: 0},
    play: (n, r) => { for (const s of [2, 6, 10, 14]) n(r, s, 1.6, .9); }},
  {id: 'roll16', name: 'Rolling 16ths', words: 'Saw and sub rolling on every 16th between the kicks, the octave flicked up at the end of the bar.',
    preset: 'Deep bass', sound: {cut: 260, res: .2, fenv: .4, fd: .1, fs: .1, ad: .1, as: .3, ar: .04, oct: 0, mode: 1},
    play: (n, r) => { for (let s = 0; s < 16; s++) if (s % 4) n(r + (s === 15 ? 12 : 0), s, .8, s % 2 ? .6 : .85); }},
  {id: 'acid', name: 'Acid line', words: 'A 303-style square through a screaming resonant filter, accents and slides across the chord tones.',
    preset: 'Acid poly', sound: {cut: 260, res: .78, fenv: .8, fd: .18, oct: 0, glide: .07, mode: 2, drive: .5},
    play: (n, r, t, k) => { const p = [[0, 0, 1, 1], [3, 2, 1, .7], [6, 4, 2, .9], [8, 0, 1, .6], [10, 3, 1, .8], [11, 1, 1.5, 1], [14, 2, 1, .7]];
      for (const [s, i, l, v] of p) n(r + t[i] + (k % 2 && s === 10 ? 12 : 0), s, l, v); }},
  {id: 'reese', name: 'Reese drone', words: 'Two detuned saws held for the whole chord, the filter breathing slowly: dark and wide-bodied.',
    preset: 'Reese bass', sound: {cut: 500, res: .25, fenv: .1, oct: 0, ldest: 1, lsync: 9, lamt: .35, drive: .35, width: .2},
    play: (n, r, t, k) => { if (k % 4 === 0) n(r, 0, 63, .8); }},
  {id: 'rubber', name: 'Rubber bounce', words: 'A round triangle note that drops an octave into each hit: bouncy, syncopated, playful.',
    preset: 'Sub bass', sound: {w1: TRI, w2: SINE, mix2: .5, sub: .2, cut: 900, fenv: .2, ad: .2, as: .4, ar: .06, oct: 0, mode: 2, glide: .045, drive: .2},
    play: (n, r) => { for (const s of [3, 6, 11, 14]) { n(r + 12, s - .15, .15, .8); n(r, s, 1.4, .9); } }},
  {id: 'octfunk', name: 'Octave funk', words: 'A square bass jumping between the root and its octave on syncopated 16ths.',
    preset: 'Deep bass', sound: {w1: SQUARE, w2: SAW, mix2: .3, cut: 500, res: .3, fenv: .5, fd: .1, as: .2, ar: .05, oct: 0, mode: 1},
    play: (n, r) => { const p = 'x.oX.o..x.oX..o.'; for (let s = 0; s < 16; s++) if (p[s] !== '.') n(r + (p[s] === 'X' || p[s] === 'o' ? 12 : 0), s, .9, p[s] === 'o' ? .55 : .9); }},
  {id: 'berlin', name: 'Berlin sequence', words: 'A saw arpeggio up the minor 9 on every 16th, its filter opening across the four bars of each chord.',
    preset: 'Pluck', sound: {semi: 0, mix2: .2, cut: 300, res: .35, fenv: .6, fd: .12, as: 0, ar: .08, chorus: 0, width: .2, oct: 0},
    play: (n, r, t, k) => { const seq = [0, 2, 3, 4, 1, 2, 0, 3]; for (let s = 0; s < 16; s++) n(r + 12 + t[seq[(s + k*16) % 8]], s, .9, .55 + .1*(k % 4) + (s % 4 ? 0 : .15)); }},
  {id: 'halftime', name: 'Half-time call', words: 'One long root, then an answer falling from the seventh to the fifth: sparse and patient.',
    preset: 'Deep bass', sound: {w2: SINE, cut: 350, res: .15, fenv: .3, fd: .4, as: .7, ar: .2, oct: 0, mode: 1},
    play: (n, r, t, k) => { if (k % 2 === 0) n(r, 0, 10, .9); else { n(r + t[3], 4, 3, .75); n(r + t[2], 10, 5, .8); } }},
  {id: 'triplet', name: 'Triplet roll', words: '8th-note triplets against the straight kick: three against two, a hypnotic tumble.',
    preset: 'Deep bass', sound: {cut: 380, res: .2, fenv: .45, fd: .1, as: .3, ar: .05, oct: 0, mode: 1},
    play: (n, r, t) => { const tr = 16/6; for (let i = 0; i < 6; i++) n(r + [0, 0, 12, 0, t[2], 0][i], i*tr, 1.2, i % 3 ? .65 : .9); }},
  {id: 'dub', name: 'Dub sub with echo', words: 'One deep sine note a bar on the first off-beat, thrown into a long echo: space and weight.',
    preset: 'Sub bass', sound: {w1: SINE, sub: 0, ad: .6, as: .3, ar: .2, oct: 0, drive: .25}, echo: -4,
    play: (n, r, t, k) => { n(r + (k % 4 === 3 ? t[2] : 0), 2, 3, .9); }},
  {id: 'detroit', name: 'Detroit pluck', words: 'A plucked square on the root and fifth, a classic Detroit figure with a bright filter blip.',
    preset: 'Pluck', sound: {w1: SQUARE, w2: SAW, semi: 0, mix2: .4, cut: 420, res: .4, fenv: .7, fd: .1, as: 0, ar: .06, chorus: 0, width: .1, oct: 0},
    play: (n, r, t) => { const p = [[0, 0], [3, 0], [6, 2], [10, 0], [13, 2]]; for (const [s, i] of p) n(r + 12 + t[i], s, 1, .8); }},
  {id: 'grit', name: 'Gritty fifths', words: 'Short distorted saw stabs of root and fifth on the off-beats: raw and industrial.',
    preset: 'Deep bass', sound: {w2: SAW, mix2: .7, cut: 600, res: .3, fenv: .5, fd: .08, as: .1, ar: .04, drive: .85, oct: 0, mode: 0},
    play: (n, r, t) => { for (const s of [2, 6, 10, 14]) { n(r, s, 1, .85); n(r + 7, s, 1, .6); } }},
  {id: 'walk9', name: 'Dotted minor 9 (clean)', words: "The v2 line, dotted quarters walking the minor 9, on a clean round sine-and-triangle sound instead of the Moog.",
    preset: 'Sub bass', sound: {w1: SINE, w2: TRI, mix2: .4, sub: 0, cut: 1200, ad: .3, as: .5, ar: .08, oct: 0, mode: 1, glide: .02},
    play: (n, r, t, k) => { const WALK = [0, 2, 4, 1, 3, 2, 0, 4]; for (let g = Math.ceil(k*16/6)*6; g < (k + 1)*16; g += 6) n(r + t[WALK[(g/6) % 8]], g - k*16, 2.5, .85); }},
  {id: 'pulse8', name: 'Pumping 8ths', words: 'A steady 8th-note sub pulse, the sidechain carving it into a pump: driving and simple.',
    preset: 'Sub bass', sound: {w1: SINE, w2: SAW, mix2: .15, sub: 0, cut: 600, ad: .2, as: .6, ar: .05, oct: 0, mode: 1, drive: .3},
    play: (n, r) => { for (let s = 0; s < 16; s += 2) n(r, s, 1.7, s % 4 ? .9 : .6); }},
  {id: 'bell', name: 'Glass bass', words: 'A sine with a glassy overtone an octave and a fifth up, short: a bell-like bass, more melody than weight.',
    preset: 'Glass bell', sound: {mix2: .3, ad: .5, ar: .3, chorus: .2, width: .2, oct: -1, level: .8},
    play: (n, r, t, k) => { const p = [[0, 0], [3, 2], [7, 4], [10, 3], [12, 2]]; for (const [s, i] of p) n(r + 12 + t[i], s, 2, k % 2 && s > 9 ? .5 : .75); }},
  {id: 'click', name: 'Minimal click', words: 'Tiny, very short notes with a click of filter, scattered like Villalobos: more texture than tone.',
    preset: 'Deep bass', sound: {w1: SQUARE, w2: SINE, mix2: .5, cut: 900, res: .5, fenv: .8, fd: .03, fs: 0, ad: .05, as: 0, ar: .02, oct: 0, mode: 0},
    play: (n, r, t, k) => { const p = ['..x..x.x...x..x.', '.x...x..x.x...x.'][k % 2]; for (let s = 0; s < 16; s++) if (p[s] === 'x') n(r + (s % 3 === 0 ? 12 : 0), s, .5, .8); }},
];

export function score(d){
  const id = d.variant || 'backing', idea = IDEAS.find(i => i.id === id);
  d.returns({delay: {div: 4, fb: .42, tone: 2000}, reverb: {size: .78, damp: .65, low: 240}, echoDb: -1, verbDb: 2, echoPump: {depth: .35, rel: .6}, verbPump: {depth: .45, rel: .7}, verbWidth: 1.3});
  d.bus('kick', {level: -1.5, hp: 28});
  d.bus('hats', {level: 12, width: 1.25, pump: {depth: .2, rel: .35}, a: -13, b: -20, hp: 300});
  d.bus('drums', {level: 12, width: 1.1, pump: {depth: .2, rel: .35}, b: -18});
  d.bus('perc', {level: 5, width: 1.35, pump: {depth: .25, rel: .4}, a: -16, b: -12});
  d.bus('pad', {level: -5, width: 1.9, mono: 200, chorus: {rate: .23, depth: .7, mix: .45}, pump: {depth: .7, rel: .6}, b: -3, hp: 140, filter: {cut: 3000}});
  d.bus('stab', {level: 3, width: 1.4, pump: {depth: .6, rel: .5}, a: 0, b: -4, hp: 160, filter: {cut: 1800, q: 1.1}});
  d.bus('bass', {level: 0, pump: {depth: .45, rel: .4}, a: idea?.echo ?? -12});

  const kick = d.kit('kick', 'Minimal', {kick: {decay: .85, x: .5, drive: .12, tone: .42, tune: -1}}); kick.side = true;
  const hats = d.kit('hats', 'Minimal', {chh: {tone: .62, level: 1.1, decay: .7, x: .3, pan: .2}, ohh: {tone: .58, level: .85, decay: .8, pan: -.2}});
  const kit = d.kit('drums', 'Minimal', {clap: {level: .2, tone: .6, decay: 1.2}});
  const perc = d.kit('perc', 'Minimal', {rim: {level: .45, tone: .55, pan: .35}, shaker: {level: .5, tone: .5, pan: -.2}});
  const pad = d.synth('pad', 'Warm pad', {chord: 0, aa: 1.2, ad: 2, as: .85, ar: 2.6, cut: 1300, res: .06, fenv: .15, lamt: .12, chorus: .2, width: 1, level: .55});
  const stab = d.synth('stab', 'Dub chord', {chord: 0, cut: 700, res: .32, fenv: .4, fd: .14, ad: .22, ar: .2, chorus: .15, width: .8, level: .55});

  // the loop is bars W..W+16; what rings on past its end is folded back onto its start by lab.mjs, so it wraps seamlessly
  const end = W + meta.bars;
  for (let bar = W; bar < end; bar++) {
    for (let b = 0; b < 4; b++) d.hit(kick, 'kick', bar, b*4, b ? .92 : 1);
    for (let s = 0; s < 16; s++) { const off = s % 4 === 2, on = s % 4 === 0, sw = .5 + .5*Math.sin((bar % 2*16 + s)/32*Math.PI*2);
      if (!off && d.rand() < (on ? .25 : .18)) continue;
      d.hit(hats, 'chh', bar, s + (s % 2 ? .1 : off ? -.04 : 0), (off ? .95 : on ? .42 : .26 + .22*sw)*(.9 + d.rand()*.2), {decay: off ? .85 : .45 + .25*sw}); }
    for (const s of [2, 6, 10, 14]) d.hit(hats, 'ohh', bar, s - .04, .72, {decay: [.55, .7, .9, 1.25][bar % 4]});
    for (const s of [4, 12]) d.hit(kit, 'clap', bar, s, .75);
    'o.x.o.xoo.x.o.xo'.split('').forEach((c, s) => c !== '.' && d.hit(perc, 'shaker', bar, s, c === 'x' ? .55 : .25));
    if (bar % 2 === 0) for (const s of [3, 6, 11, 14]) d.hit(perc, 'rim', bar, s, .6); else for (const s of [3, 9]) d.hit(perc, 'rim', bar, s, .6);
    ['..x.......x.....', '..x.......x...x.', '..x....x..x.....', '..x.......x..x..'][bar % 4].split('').forEach((c, s) => c === 'x' && d.chord(stab, CH[chordAt(bar)], bar, s, 1.5, .62));
  }
  for (let bar = W; bar < end; bar += 4) d.chord(pad, CH[chordAt(bar)], bar, 0, 4*16 - 1, .55);

  if (idea) {
    const bass = d.synth('bass', idea.preset, {chord: 0, ...idea.sound});
    for (let bar = W; bar < end; bar++) { const c = chordAt(bar), k = bar - W;
      idea.play((note, s, l, v) => d.note(bass, note, bar, s, l, v), ROOT[c], TONES[c], k); }
    d.solo(['bass']);
  } else d.solo(['kick', 'hats', 'drums', 'perc', 'pad', 'stab']);
}
