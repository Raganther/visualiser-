// Songs for the groovebox: whole pieces of lush minimal techno to watch the visualiser with (the bench, the phone view):
// each a tempo, a kit softened (hats rounded off, nothing harsh), a creamy bass, one synth sound (pads, dub stabs, strings or
// plucks), up to eight one-bar patterns and the order they play in, and the mix: the synth pumping on the kick (the
// sidechain), widened and chorused, sent to the echo and the reverb. playSong() loads one into the groovebox and its mixer
// channels (it replaces their effects chains and the synth's sound).
import { GB, bind, fit, setKit, setVoice, levels } from './groove.js';
import { loadSynthPreset, setSynth, synth } from './keys.js';
import { channel, STRIPS, addInsert, removeInsert, setStrip, setParam } from './engine/mixer.js';
import { ensureAudio } from './player.js';

const on = (str, a = 1) => [...str].map(c => c === 'x' ? a : c === 'X' ? 2 : 0);   // 'x' a hit, 'X' accented, '.' none
// the bass: each digit a note of the groovebox's scale (0 D3, 1 C3, 2 A2, 3 G2, 4 E2, 5 D2, 6 C2, 7 A1), accents and slides
const line = (notes, acc = '', sl = '') => [...notes].map((c, i) => c === '.' ? {on: 0, n: 7, a: 0, s: 0} : {on: 1, n: +c, a: acc[i] === 'x' ? 1 : 0, s: sl[i] === 'x' ? 1 : 0});
// chords in A minor, voiced without the root (the bass has it) and close, so pads stay soft and inside the synth's eight voices
const CH = {Am9: [60, 64, 67, 71], Dm9: [53, 57, 60, 64], Cmaj9: [59, 62, 64, 67], Em7: [55, 59, 62, 64], Fmaj7: [57, 60, 64, 65]};
const chord = (c, s = 0, l = 16, v = .62) => CH[c].map(n => ({s, n, l, v}));
const stabs = (c, at, l = 2, v = .55) => at.flatMap(s => chord(c, s, l, v));
// a pluck arpeggio over a chord: its notes in turn, a 16th each, up an octave on the way back
const arp = (c, v = .5) => { const n = CH[c], seq = [...n, ...n.map(x => x + 12).reverse()]; return Array.from({length: 16}, (_, s) => ({s, n: seq[s % seq.length], l: 1, v: v*(s % 4 ? .8 : 1)})); };
const rep = (a, n) => Array.from({length: n}, () => a).flat();

// the kits softened: hats darker and quieter, the clap and rim set back, the shaker wide
const SOFT = {chh: {tone: .5, level: .55, decay: .7}, ohh: {tone: .5, level: .45}, clap: {level: .55, tone: .7}, rim: {level: .5, tone: .65}, shaker: {level: .5, tone: .6, pan: -.35},
  ride: {tone: .55, level: .45}, clave: {level: .45, tone: .7, pan: .3}, snare: {level: .6, tone: .65}, kick: {drive: .15}};
// the synth's channel: pumping on the kick, chorused, wide; the drums and bass: a little width (the bass kept mono below 150 Hz)
const PUMP = (depth = .65, rel = .5) => ['pump', {src: 0, depth, rel}];
const LUSH = [['chorus', {rate: .35, depth: .55, mix: .45}], ['width', {w: 1.45, mono: 160}]];

export const SONGS = [
  {name: 'Velvet Drift', bpm: 122, kit: 'Minimal', swing: .08,
    bass: {cut: .18, res: .2, env: .22, decay: .55, wave: 'sawtooth', oct: 0},
    synth: {preset: 'Warm pad', set: {chord: 0, aa: .35, ad: 1.2, as: .8, ar: 1.3, cut: 1050, res: .08, fenv: .2, lamt: .15, chorus: 0, width: 1, level: .62}},
    mix: {synth: {ins: [PUMP(.7, .55), ...LUSH], A: -20, B: -9}, groove: {ins: [['width', {w: 1.25, mono: 150}]], A: -30, B: -22}, reverb: {size: .62, damp: .6, mix: 1}, delay: {div: 5, fb: .4, tone: 2600}},
    pats: [
      {kick: on('x...x...x...x...'), shaker: on('..x...x...x...x.'), synth: chord('Am9')},
      {kick: on('X...x...X...x...'), rim: on('...x..x....x..x.'), chh: on('..x...x...x...x.'), clap: on('............x...'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('7..7...7..2..7..', 'x.....x.........'), synth: chord('Am9')},
      {kick: on('X...x...X...x...'), rim: on('...x..x....x..x.'), chh: on('..x...x...x...x.'), clap: on('............x...'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('5..5...5..0..5..', 'x.....x.........'), synth: chord('Dm9')},
      {kick: on('X...x...X...x...'), rim: on('...x..x....x..x.'), chh: on('..x...x...x...x.'), clap: on('............x...'), ohh: on('..x.......x.....'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('6..6...6..1..6..', 'x.....x.........'), synth: chord('Cmaj9')},
      {kick: on('X...x...X...x...'), rim: on('...x..x....x..x.'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), ohh: on('..x...x...x...x.'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('4..4...4..4.3.4.', 'x.....x.........', '..........x.....'), synth: chord('Em7')},
      {shaker: on('..x...x...x...x.'), rim: on('.......x.......x'), clave: on('...x.......x....'), synth: chord('Am9', 0, 16, .7)},
      {shaker: on('..x...x...x...x.'), clave: on('...x.......x....'), synth: chord('Dm9', 0, 16, .7)},
      {kick: on('x...x...x...x...'), snare: on('........x.x.xxxx'), chh: on('xxxxxxxxxxxxxxxx'), synth: chord('Em7', 0, 16, .7)}],
    order: [...rep([0], 8), ...rep([1, 1, 2, 2, 3, 3, 4, 4], 2), 5, 5, 6, 6, 5, 5, 6, 7, ...rep([1, 1, 2, 2, 3, 3, 4, 4], 2)]},

  {name: 'Silk Pulse', bpm: 124, kit: '909', swing: .1,
    bass: {cut: .14, res: .15, env: .18, decay: .5, wave: 'square', oct: 0},
    synth: {preset: 'Dub chord', set: {chord: 0, cut: 950, res: .3, fenv: .3, ad: .3, ar: .35, chorus: 0, width: .9, level: .6}},
    mix: {synth: {ins: [PUMP(.6, .45), ...LUSH], A: -8, B: -10}, groove: {ins: [['width', {w: 1.2, mono: 150}]], A: -30, B: -24}, reverb: {size: .65, damp: .55, mix: 1}, delay: {div: 4, fb: .55, tone: 2200}},
    pats: [
      {kick: on('x...x...x...x...'), chh: on('..x...x...x...x.'), synth: stabs('Am9', [2, 10])},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), ride: on('x.x.x.x.x.x.x.x.'), bass: line('..7...7...7...7.'), synth: stabs('Am9', [2, 10])},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), ride: on('x.x.x.x.x.x.x.x.'), bass: line('..7...7...7..62.'), synth: stabs('Am9', [2, 7, 10])},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), ride: on('x.x.x.x.x.x.x.x.'), bass: line('..5...5...5...5.'), synth: stabs('Dm9', [2, 10])},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), ohh: on('..x...x...x...x.'), ride: on('x.x.x.x.x.x.x.x.'), bass: line('..4...4...4..34.'), synth: stabs('Em7', [2, 10, 14])},
      {rim: on('x......x..x.....'), shaker: on('..x...x...x...x.'), synth: stabs('Am9', [2, 10], 4, .6)},
      {rim: on('x......x..x.....'), shaker: on('..x...x...x...x.'), synth: stabs('Dm9', [2, 10], 4, .6)},
      {kick: on('x...x...x...x...'), snare: on('....x...x.x.xxxx'), chh: on('x.x.x.x.x.x.x.x.'), synth: stabs('Em7', [2, 6, 10, 14])}],
    order: [...rep([0], 8), ...rep([1, 2, 1, 2, 3, 3, 4, 4], 2), 5, 5, 6, 6, 5, 5, 6, 7, ...rep([1, 2, 1, 2, 3, 3, 4, 4], 2)]},

  {name: 'Lagoon', bpm: 120, kit: 'Minimal', swing: .12,
    bass: {cut: .2, res: .1, env: .15, decay: .6, wave: 'sawtooth', oct: 0},
    synth: {preset: 'Strings', set: {w1: 0, fine: 12, mix2: .6, w2: 0, chord: 0, cut: 1700, aa: .5, ad: 1.2, as: .85, ar: 1.5, chorus: 0, width: 1, level: .6}},
    mix: {synth: {ins: [PUMP(.55, .6), ...LUSH], A: -24, B: -8}, groove: {ins: [['width', {w: 1.3, mono: 150}]], A: -26, B: -20}, reverb: {size: .65, damp: .65, mix: 1}, delay: {div: 6, fb: .35, tone: 2000}},
    pats: [
      {kick: on('x...x...x...x...'), shaker: on('.xxx.xxx.xxx.xxx'), synth: chord('Cmaj9')},
      {kick: on('X...x...X...x...'), shaker: on('.xxx.xxx.xxx.xxx'), clave: on('...x..x....x....'), chh: on('..x...x...x...x.'), bass: line('6...6..6...6.6..', 'x...........x...'), synth: chord('Cmaj9')},
      {kick: on('X...x...X...x...'), shaker: on('.xxx.xxx.xxx.xxx'), clave: on('...x..x....x....'), chh: on('..x...x...x...x.'), bass: line('7...7..7...7.2..', 'x...........x...'), synth: chord('Am9')},
      {kick: on('X...x...X...x...'), shaker: on('.xxx.xxx.xxx.xxx'), rim: on('..x.....x.x.....'), chh: on('..x...x...x...x.'), ride: on('x...x...x...x...'), bass: line('4...4..4...4.4..', 'x...........x...'), synth: chord('Em7')},
      {kick: on('X...x...X...x...'), shaker: on('.xxx.xxx.xxx.xxx'), rim: on('..x.....x.x.....'), chh: on('..x...x...x...x.'), ride: on('x...x...x...x...'), clap: on('............x...'), bass: line('5...5..5...5.3..', 'x...........x...'), synth: chord('Dm9')},
      {shaker: on('..x...x...x...x.'), synth: chord('Am9', 0, 16, .65)},
      {shaker: on('..x...x...x...x.'), clave: on('...x.......x....'), synth: chord('Fmaj7', 0, 16, .65)},
      {kick: on('x.......x.......'), snare: on('............xxxx'), shaker: on('xxxxxxxxxxxxxxxx'), synth: chord('Em7', 0, 16, .65)}],
    order: [...rep([0], 8), ...rep([1, 2, 3, 4], 4), 5, 6, 5, 6, 5, 6, 5, 7, ...rep([1, 2, 3, 4], 4)]},

  {name: 'Afterglow', bpm: 126, kit: '909', swing: .06,
    bass: {cut: .22, res: .25, env: .3, decay: .4, wave: 'sawtooth', oct: 0},
    synth: {preset: 'Pluck', set: {chord: 0, cut: 650, res: .25, fenv: .55, fd: .25, ar: .45, chorus: 0, width: 1, level: .9}},
    mix: {synth: {ins: [PUMP(.6, .4), ...LUSH], A: -11, B: -10}, groove: {ins: [['width', {w: 1.2, mono: 150}]], A: -30, B: -22}, reverb: {size: .65, damp: .55, mix: 1}, delay: {div: 4, fb: .5, tone: 2800}},
    pats: [
      {kick: on('x...x...x...x...'), chh: on('..x...x...x...x.'), synth: arp('Am9', .4)},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('7.77..7.7.77..2.', 'x.......x.......', '.x.......x......'), synth: arp('Am9')},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('6.66..6.6.66..1.', 'x.......x.......', '.x.......x......'), synth: arp('Cmaj9')},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), ohh: on('..x...x...x...x.'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('5.55..5.5.55..0.', 'x.......x.......', '.x.......x......'), synth: arp('Dm9')},
      {kick: on('X...x...X...x...'), chh: on('..x...x...x...x.'), clap: on('....x.......x...'), ohh: on('..x...x...x...x.'), ride: on('x.x.x.x.x.x.x.x.'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('4.44..4.4.43..3.', 'x.......x.......', '.x.......x......'), synth: arp('Em7')},
      {shaker: on('..x...x...x...x.'), synth: arp('Am9', .35)},
      {shaker: on('..x...x...x...x.'), rim: on('x......x..x.....'), synth: arp('Dm9', .35)},
      {kick: on('x...x...x...x...'), snare: on('x.x.x.x.xxxxxxxx'), synth: arp('Em7', .45)}],
    order: [...rep([0], 8), ...rep([1, 1, 2, 2, 3, 3, 4, 4], 2), 5, 5, 6, 6, 5, 5, 6, 7, ...rep([1, 1, 2, 2, 3, 3, 4, 4], 2)]},
];

// load a song into the groovebox and the mixer (call from a press: it may start the audio); start it with grooveToggle()
export function playSong(name){
  const S = SONGS.find(s => s.name === name); if (!S) return false;
  ensureAudio(); synth();   // (the synth's channel exists once the synth does)
  setKit(S.kit); for (const v in SOFT) for (const k in SOFT[v]) setVoice(v, k, SOFT[v][k]);
  Object.assign(GB, S.bass, {bassEng: 'acid', bpm: S.bpm, swing: S.swing || 0, level: .8, drums: .85, synth: .55, preset: S.name});
  GB.pats = Array.from({length: 8}, (_, i) => fit(JSON.parse(JSON.stringify(S.pats[i] || {}))));
  GB.pat = S.order[0]; GB.song = S.order.slice(); GB.songOn = true; GB.next = null; bind(); levels();
  loadSynthPreset(S.synth.preset); for (const k in S.synth.set) setSynth(k, S.synth.set[k]);
  channel('groove', 'Groovebox');
  for (const key of ['synth', 'groove']) { const m = S.mix[key], s = STRIPS.get(key); if (!s || !m) continue;
    while (s.ins.length) removeInsert(key, 0);
    for (const [k, p] of m.ins) addInsert(key, k, {p});
    setStrip(key, 'A', m.A); setStrip(key, 'B', m.B); }
  const send = (key, p) => { const s = STRIPS.get(key); if (s && s.ins[0] && p) for (const k in p) setParam(key, 0, k, p[k]); };
  send('sendB', S.mix.reverb); send('sendA', S.mix.delay);
  return true;
}
