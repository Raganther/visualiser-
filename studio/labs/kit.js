// The labs' shared groove: Slow Bloom's 16-bar loop (the four chords once round) split into parts (drums, bass, pad, lead),
// each a list of ideas. A lab renders the other parts' defaults as its backing and each of its own part's ideas as a stem.
// An idea is {id, name, words, build(d, x)}: it makes its instruments on its part's buses and places the loop's notes.
export const BPM = 123, BARS = 16, W = 1, SWING = .06;
export const CH = {Am9: [60, 64, 67, 71], Fmaj9: [57, 60, 64, 67], Dm9: [57, 60, 64, 65], Em7: [55, 59, 62, 67]};
export const ROOT = {Am9: 33, Fmaj9: 29, Dm9: 26, Em7: 28};
// each chord's 9th chord from the root: root, third, fifth, seventh, ninth
export const TONES = {Am9: [0, 3, 7, 10, 14], Fmaj9: [0, 4, 7, 11, 14], Dm9: [0, 3, 7, 10, 14], Em7: [0, 3, 7, 10, 14]};
export const PROG = ['Am9', 'Fmaj9', 'Dm9', 'Em7'];
export const chordAt = bar => PROG[Math.floor(Math.max(0, bar - W)/4) % 4];
export const SAW = 0, SQUARE = 1, TRI = 2, SINE = 3, SUPER = 4;
// the loop's bars, and the A minor scale by degree (0 = A3), for melodies
export const LOOP = Array.from({length: BARS}, (_, i) => W + i);
const SCALE = [0, 2, 3, 5, 7, 8, 10];
export const deg = (k, base = 57) => base + 12*Math.floor(k/7) + SCALE[((k % 7) + 7) % 7];

// which buses each part plays on (a stem is these alone)
export const BUSES = {drums: ['kick', 'hats', 'drums', 'perc'], bass: ['bass'], pad: ['pad'], lead: ['lead']};

export function setup(d){
  d.returns({delay: {div: 4, fb: .42, tone: 2000}, reverb: {size: .78, damp: .65, low: 240}, echoDb: -1, verbDb: 2, echoPump: {depth: .35, rel: .6}, verbPump: {depth: .45, rel: .7}, verbWidth: 1.3});
  d.bus('kick', {level: -1.5, hp: 28});
  d.bus('hats', {level: 12, width: 1.25, pump: {depth: .2, rel: .35}, a: -13, b: -20, hp: 300});
  d.bus('drums', {level: 12, width: 1.1, pump: {depth: .2, rel: .35}, b: -18});
  d.bus('perc', {level: 5, width: 1.35, pump: {depth: .25, rel: .4}, a: -16, b: -12});
  d.bus('bass', {level: 0, pump: {depth: .45, rel: .4}, a: -12});
  d.bus('pad', {level: -5, width: 1.9, mono: 200, chorus: {rate: .23, depth: .7, mix: .45}, pump: {depth: .7, rel: .6}, b: -3, hp: 140, filter: {cut: 3000}});
  d.bus('lead', {level: 0, width: 1.3, pump: {depth: .4, rel: .45}, a: -6, b: -5, hp: 180});
  // the sidechain follows a steady four to the floor whatever the drums play, so every stem pumps alike
  for (const bar of LOOP) for (let b = 0; b < 4; b++) d.kicks.push(d.t(bar, b*4));
}
// a pattern string on every bar of the loop ('x' a hit, 'X' an accent, 'o' a ghost); fn(bar) may vary it
export const pat = (d, kit, voice, str, vel = .8, {every = 1, nudge = 0, lock} = {}) => LOOP.forEach((bar, k) => { if (k % every) return;
  for (let s = 0; s < str.length; s++) { const c = str[s]; if (c === '.') continue;
    d.hit(kit, voice, bar + Math.floor(s/16), s % 16 + (s % 2 ? nudge : 0), (c === 'X' ? 1.2 : c === 'o' ? .4 : 1)*vel*(.92 + d.rand()*.16), lock); } });
// a synth on a part's bus, and the loop's bars with their chord
export const synth = (d, bus, preset, set) => d.synth(bus, preset, {chord: 0, ...set});
export const bars = fn => LOOP.forEach((bar, k) => { const c = chordAt(bar); fn(bar, k, c, ROOT[c], TONES[c]); });

// the kick the user liked in the drum lab ("in the right direction, round, punchy"): the Minimal kit's, tuned down, shorter,
// less driven, darker than the kit's own (which they found squelchy) or the 909's (aggressive)
export const GOOD_KICK = {decay: .85, x: .5, drive: .12, tone: .42, tune: -1};

/* ---------- the defaults: what plays behind another part's lab ---------- */
export const DEFAULT = {
  // the Slow Bloom drums: accented, grooving hats, the open hat opening over four bars, clap, shaker, rim
  drums: {id: 'groove', build(d, o = {}){
    const kick = d.kit('kick', o.kit || 'Minimal', {kick: {...GOOD_KICK, ...o.kick}});
    const hats = d.kit('hats', 'Minimal', {chh: {tone: .62, level: 1.1, decay: .7, x: .3, pan: .2}, ohh: {tone: .58, level: .85, decay: .8, pan: -.2}});
    const kit = d.kit('drums', 'Minimal', {clap: {level: .2, tone: .6, decay: 1.2}});
    const perc = d.kit('perc', 'Minimal', {rim: {level: .45, tone: .55, pan: .35}, shaker: {level: .5, tone: .5, pan: -.2}});
    for (const bar of LOOP) {
      if (!o.noKick) for (let b = 0; b < 4; b++) d.hit(kick, 'kick', bar, b*4, b ? .92 : 1);
      for (let s = 0; s < 16; s++) { const off = s % 4 === 2, on = s % 4 === 0, sw = .5 + .5*Math.sin((bar % 2*16 + s)/32*Math.PI*2);
        if (!off && d.rand() < (on ? .25 : .18)) continue;
        d.hit(hats, 'chh', bar, s + (s % 2 ? .1 : off ? -.04 : 0), (off ? .95 : on ? .42 : .26 + .22*sw)*(.9 + d.rand()*.2), {decay: off ? .85 : .45 + .25*sw}); }
      for (const s of [2, 6, 10, 14]) d.hit(hats, 'ohh', bar, s - .04, .72, {decay: [.55, .7, .9, 1.25][bar % 4]});
      for (const s of [4, 12]) d.hit(kit, 'clap', bar, s, .75);
      'o.x.o.xoo.x.o.xo'.split('').forEach((c, s) => c !== '.' && d.hit(perc, 'shaker', bar, s, c === 'x' ? .55 : .25));
      for (const s of bar % 2 ? [3, 9] : [3, 6, 11, 14]) d.hit(perc, 'rim', bar, s, .6);
    } }},
  // the dotted minor 9 walk, on the Detroit pluck's sound (both liked in the first bass lab)
  bass: {id: 'walk9-pluck', build(d){
    const s = synth(d, 'bass', 'Pluck', {w1: SQUARE, w2: SAW, semi: 0, mix2: .4, cut: 420, res: .4, fenv: .7, fd: .1, as: 0, ar: .06, chorus: 0, width: .1, oct: 0});
    const WALK = [0, 2, 4, 1, 3, 2, 0, 4];
    bars((bar, k, c, r, t) => { for (let g = Math.ceil(k*16/6)*6; g < (k + 1)*16; g += 6) d.note(s, r + 12 + t[WALK[(g/6) % 8]], bar, g - k*16, 2, .8); }); }},
  // the warm LFO pad, the chord held four bars
  pad: {id: 'warm', build(d){
    const s = synth(d, 'pad', 'Warm pad', {aa: 1.2, ad: 2, as: .85, ar: 2.6, cut: 1300, res: .06, fenv: .15, lamt: .12, chorus: .2, width: 1, level: .55});
    bars((bar, k, c) => { if (k % 4 === 0) d.chord(s, CH[c], bar, 0, 63, .55); }); }},
  lead: null,
};

// a lab: its part's ideas as stems over the other parts' defaults (with: which others play; a missing one is left out)
export function labScore(part, ideas, with_ = ['drums', 'bass', 'pad']){
  return function score(d){
    setup(d);
    const idea = ideas.find(i => i.id === d.variant);
    if (idea) { idea.build(d); d.solo(BUSES[part]); }
    else { for (const p of with_) if (p !== part && DEFAULT[p]) DEFAULT[p].build(d); d.solo(with_.filter(p => p !== part).flatMap(p => BUSES[p])); }
  };
}
