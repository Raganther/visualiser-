// The sound lab's rounds (ROUND the one on the page). Round 1: thirty analog sounds for the user to like or not, twenty from the analog synth
// (studio/lib/native/asynth.js, its settings over the defaults) and ten from the analog drum machine
// (studio/lib/native/analogkit.js, a kit and its changes). Each is heard three ways: alone (a note, a chord or two hits),
// in a phrase written for its role, and in that phrase over a quiet groove. All in A at 122 BPM, so only the sound changes.
// A wide spread on purpose, leaning to what studio/taste.md says they like (round, plucked, struck, moving) and leaving
// out what they've said no to (Reese, wobble, acid, hoover, plain sub, gritty or driven kicks, long held leads).
import { midiOf } from '../lib/names.js';

export const ROUND = 3, BPM = 122, BARS = 2;
const chord = (at, len, names, vel = .75) => names.split(' ').map(n => [at, len, n, vel]);
const N = list => list.map(([s, l, n, v = .8]) => ({s, l, n: midiOf(n), v}));

// the phrases, two bars of 16ths: [step, length in steps, note, velocity]
const P = {
  // the bass on the and, as the motif they liked, answered in the second bar
  pluckBass: N([[2, 2, 'A1', .9], [6, 1, 'A1', .6], [10, 2, 'G1', .8], [14, 1, 'C2', .65], [18, 2, 'A1', .9], [22, 1, 'E2', .6], [26, 2, 'D2', .8], [30, 1, 'C2', .6]]),
  longBass: N([[0, 6, 'A1', .85], [8, 4, 'A1', .7], [12, 2, 'C2', .6], [16, 6, 'F1', .85], [24, 6, 'G1', .8]]),
  // suspended chords, stabbed in fives (the polyrhythm they liked), and gated in 16ths
  stabs: N([...chord(2, 1.5, 'A2 E3 B3 E4', .8), ...chord(7, 1.5, 'A2 E3 B3 E4', .55), ...chord(12, 1.5, 'A2 E3 B3 E4', .6),
    ...chord(18, 1.5, 'F2 C3 G3 C4', .8), ...chord(23, 1.5, 'F2 C3 G3 C4', .55), ...chord(28, 1.5, 'F2 C3 G3 C4', .6)]),
  gated: N(Array.from({length: 32}, (_, i) => chord(i, .8, i < 16 ? 'A2 E3 G3 B3 C4' : 'F2 C3 E3 G3 A3', i % 4 === 2 ? .7 : .42)).flat()),
  pads: N([...chord(0, 15, 'A2 E3 B3 E4', .7), ...chord(16, 15, 'F2 C3 G3 C4', .7)]),
  // a bell's phrase: a few notes, answered
  bell: N([[0, 3, 'E5', .8], [6, 2, 'D5', .6], [12, 3, 'A4', .7], [20, 2, 'C5', .7], [24, 4, 'B4', .75]]),
  // a pluck every three 16ths against the four: the line comes round in a different place each beat
  threes: N([[0, .8, 'A4', .85], [3, .8, 'E5', .6], [6, .8, 'C5', .7], [9, .8, 'G4', .6], [12, .8, 'A4', .8], [15, .8, 'D5', .6],
    [18, .8, 'B4', .7], [21, .8, 'E5', .6], [24, .8, 'A4', .8], [27, .8, 'C5', .6], [30, .8, 'G4', .6]]),
  blips: N([[0, .5, 'A5', .8], [3, .5, 'E6', .55], [7, .5, 'C6', .6], [11, .5, 'A5', .5], [16, .5, 'A5', .8], [19, .5, 'G5', .55], [22, .5, 'E6', .6], [27, .5, 'D6', .5]]),
  air: N([[0, 31, 'A3', .7]]),
};
// alone: one note or chord of each kind
const A = {bass: N([[0, 6, 'A1', .9]]), chord: N(chord(0, 6, 'A2 E3 B3 E4', .8)), lead: N([[0, 4, 'A4', .85]]), high: N([[0, 2, 'A5', .85]]), air: N([[0, 16, 'A3', .7]])};

// the synth's sounds: [id, role, name, what makes it, patch, alone, phrase]
// round 1 (rated 2026-11-01: studio/taste.md), kept so round 2 can grow from it
const SYNTH = [
  // basses
  ['round', 'bass', 'Round pluck', 'A saw and a pulse an octave down through the 24 dB ladder, plucked open by a quick envelope. Warm, a little driven.',
    {w1: 0, w2: 1, oct2: -1, fine2: 4, l1: .8, l2: .6, lsub: .3, drive: .3, ftype: 0, cut: 260, res: .3, fenv: .45, fkey: .4, fvel: .5, fa: .002, fd: .22, fs: .1, fr: .12,
      aa: .002, ad: .35, as: .6, ar: .1, mode: 1, glide: .02, slop: .35, vdrive: .2, level: .7}, A.bass, P.pluckBass],
  ['felt', 'bass', 'Felt bass', 'A triangle over a sine an octave down, through the soft 12 dB ladder: rounded, woody at the front, no buzz.',
    {w1: 2, w2: 3, oct2: -1, l1: .8, l2: .5, lsub: .15, drive: .25, ftype: 1, cut: 520, res: .1, fenv: .2, fd: .3, fs: .4, aa: .004, ad: .5, as: .7, ar: .15, mode: 1, slop: .3, vdrive: .3, level: .75}, A.bass, P.pluckBass],
  ['hollow', 'bass', 'Hollow pulse', 'Two narrow pulses a few cents apart, the filter resonating as it closes: a hollow, nasal knock.',
    {w1: 1, pw1: .18, w2: 1, pw2: .3, fine2: -6, l1: .8, l2: .4, ftype: 1, cut: 380, res: .45, fenv: .5, fd: .16, fs: 0, fr: .1, aa: .002, ad: .25, as: .3, ar: .08, mode: 1, slop: .3, level: .7}, A.bass, P.pluckBass],
  ['woodfm', 'bass', 'Wooden FM', 'A sine whose pitch the second oscillator shakes (cross mod), a fifth up: the knock of the FM pluck you liked, made on the analog synth.',
    {w1: 3, w2: 3, oct2: 1, semi2: 7, xmod: .45, l1: .9, l2: 0, ftype: 0, cut: 1100, res: .15, fenv: .35, fd: .12, fs: 0, aa: .001, ad: .28, as: 0, ar: .12, mode: 1, drive: .2, slop: .25, level: .75}, A.bass, P.pluckBass],
  ['syncknock', 'bass', 'Sync knock', 'Oscillator 2 hard-synced to 1, its pitch swept down by the envelope at each note: a bright, talking attack that closes fast.',
    {w1: 0, l1: .2, w2: 0, sync: 1, semi2: 5, l2: .8, epitch: 7, etgt: 1, ftype: 0, cut: 700, res: .2, fenv: .4, fd: .12, fs: 0, aa: .001, ad: .2, as: .2, ar: .08, mode: 1, slop: .3, level: .6}, A.bass, P.pluckBass],
  ['dubbass', 'bass', 'Dub bass', 'A saw low-passed near its fundamental and driven, so harmonics come through; gliding between long notes.',
    {w1: 0, w2: 3, oct2: -1, l1: .7, l2: .5, drive: .5, ftype: 0, cut: 200, res: .25, fenv: .25, fd: .6, fs: .3, aa: .005, ad: .8, as: .8, ar: .2, mode: 2, glide: .08, slop: .4, vdrive: .35, level: .7}, A.bass, P.longBass],
  // chords
  ['gatedwarm', 'chords', 'Gated warm', 'A pulse whose width the LFO sweeps beside a detuned saw, chorused, cut into 16ths: the gated chord, warm.',
    {w1: 1, pw1: .5, lpwm: .25, lrate: .6, w2: 0, fine2: -6, l1: .8, l2: .5, ftype: 0, cut: 1100, res: .2, fenv: .3, fd: .15, fs: .2, aa: .002, ad: .15, as: .4, ar: .08, hpf: 150, chorus: 2, mode: 0, slop: .5, level: .5}, A.chord, P.gated],
  ['glassstab', 'chords', 'Glass stab', 'A narrow pulse and a saw an octave up through the state-variable filter, plucked shut, thrown into a dotted echo.',
    {w1: 1, pw1: .35, w2: 0, oct2: 1, l1: .7, l2: .3, ftype: 2, cut: 1800, res: .3, fenv: .4, fd: .18, fs: 0, aa: .001, ad: .25, as: 0, ar: .25, hpf: 300, emix: .35, etime: 1, efb: .45, chorus: 1, mode: 0, level: .6}, A.chord, P.stabs],
  ['dubopen', 'chords', 'Dub chord, open', 'The dub techno chord, but brighter: two saws plucked shut, the low end cut, a long echo that keeps its top.',
    {w1: 0, w2: 0, fine2: 8, l1: .8, l2: .7, ftype: 0, cut: 1100, res: .35, fenv: .3, fkey: .3, fa: .001, fd: .2, fs: 0, fr: .2, aa: .001, ad: .3, as: 0, ar: .25, hpf: 250, emix: .4, etime: 3, efb: .55, etone: .55, chorus: 1, mode: 0, slop: .4, level: .7}, A.chord, P.stabs],
  ['pulsebrass', 'chords', 'Pulse brass', 'Two saws a few cents apart over a quiet sub, the filter speaking a little late as brass does, swelling on every beat.',
    {w1: 0, w2: 0, fine2: 9, l1: .75, l2: .65, lsub: .3, subo: 0, drive: .12, ftype: 1, cut: 880, res: .12, fenv: .28, fkey: .45, fvel: .2, fa: .09, fd: .8, fs: .5, fr: .6, aa: .035, ad: .6, as: .88, ar: .7,
      epitch: .12, lshape: 6, lsync: 3, lcut: .7, lamp: .28, lwide: .12, air: .25, airTone: 6500, mode: 0, slop: .5, spread: .85, chorus: 2, emix: .1, etime: 1, vdrive: .08, level: .5}, A.chord, P.pads],
  ['breathing', 'chords', 'Breathing pad', 'A saw and a pulse through the soft ladder, its level and brightness swelling on every beat: a chord that pulses, never sits still.',
    {w1: 0, w2: 1, pw2: .4, fine2: -8, l1: .7, l2: .6, ftype: 1, cut: 900, res: .15, fenv: .1, fa: .3, fd: 1, fs: .7, aa: .25, ad: 1, as: .9, ar: 1.2, lshape: 6, lsync: 3, lamp: .5, lcut: .8,
      hpf: 180, chorus: 2, mode: 0, slop: .5, emix: .15, etime: 3, efb: .3, level: .5}, A.chord, P.pads],
  ['suspluck', 'chords', 'Sus pluck', 'A triangle with a saw an octave up, plucked: a chord that rings away like a harp, a short echo behind it.',
    {w1: 2, w2: 0, oct2: 1, l1: .8, l2: .35, ftype: 0, cut: 900, res: .2, fenv: .55, fd: .25, fs: 0, aa: .001, ad: .6, as: 0, ar: .4, mode: 0, chorus: 1, emix: .2, etime: 1, efb: .3, level: .6}, A.chord, P.stabs],
  // plucks, bells and leads
  ['ringbell', 'lead', 'Ring bell', 'A triangle ring-modulated by a sine at an odd ratio: partials no harmonic series has, ringing away like struck metal.',
    {w1: 2, w2: 3, oct2: 1, semi2: 3, fine2: -32, l1: .2, l2: 0, lring: 1, ftype: 0, cut: 6000, res: 0, fenv: .2, fa: .001, fd: 1.5, fs: 0, fr: 1.5, aa: .001, ad: 2.5, as: 0, ar: 2.5,
      emix: .3, etime: 0, efb: .4, chorus: 1, slop: .2, mode: 0, level: .7}, A.lead, P.bell],
  ['mallet', 'lead', 'Soft mallet', 'A triangle and a sine an octave up, struck and dying away: the analog synth\'s marimba.',
    {w1: 2, w2: 3, oct2: 1, l1: .8, l2: .3, ftype: 0, cut: 2400, res: .1, fenv: .2, fd: .3, fs: 0, aa: .001, ad: .5, as: 0, ar: .4, mode: 0, chorus: 1, slop: .2, level: .7}, A.lead, P.threes],
  ['tine', 'lead', 'Tine', 'A sine with a touch of ring modulation two octaves up and a fourth: a kalimba-like tine, very short.',
    {w1: 3, w2: 3, oct2: 2, semi2: 5, l1: .8, l2: 0, lring: .35, ftype: 0, cut: 5000, fenv: 0, aa: .001, ad: .45, as: 0, ar: .35, mode: 0, emix: .15, etime: 1, efb: .25, slop: .2, level: .75}, A.lead, P.threes],
  ['pulsepluck', 'lead', 'Pulse pluck', 'A narrow pulse with a saw an octave up, plucked shut by a fast envelope, the echo answering on the dotted eighth.',
    {w1: 1, pw1: .3, w2: 0, oct2: 1, l1: .8, l2: .35, ftype: 0, cut: 600, res: .45, fenv: .5, fkey: .6, fd: .16, fs: 0, fr: .2, aa: .001, ad: .3, as: 0, ar: .3, mode: 0, emix: .35, etime: 1, efb: .45, chorus: 1, slop: .4, level: .7}, A.lead, P.threes],
  ['glassfm', 'lead', 'Glass FM bell', 'A sine shaken by another a fifth and an octave up (cross mod), ringing long, chorused, a slow echo.',
    {w1: 3, w2: 3, oct2: 1, semi2: 7, xmod: .3, l1: .9, l2: 0, ftype: 0, cut: 7000, aa: .001, ad: 1.6, as: 0, ar: 1.4, mode: 0, chorus: 2, emix: .25, etime: 3, efb: .4, slop: .2, level: .6}, A.lead, P.bell],
  ['blip', 'lead', 'Blip', 'A high sine, its pitch dropping an octave in a few milliseconds: a droplet or a blip, in an echo.',
    {w1: 3, l1: .9, l2: 0, epitch: 12, fa: .001, fd: .03, fs: 0, ftype: 0, cut: 8000, fenv: 0, aa: .001, ad: .09, as: 0, ar: .06, mode: 0, emix: .3, etime: 1, efb: .4, slop: .2, level: .7}, A.high, P.blips],
  ['woodpluck', 'lead', 'Wood pluck', 'Noise and a triangle through a resonant band-pass, very short: a struck piece of wood, tuned.',
    {w1: 2, l1: .8, lnoise: .3, l2: 0, ftype: 3, cut: 1400, res: .72, fenv: .3, fkey: 1, fd: .06, fs: 0, aa: .001, ad: .16, as: 0, ar: .1, mode: 0, slop: .2, level: .8}, A.lead, P.threes],
  // a texture
  ['air', 'texture', 'Air swell', 'Noise through a resonant band-pass that a slow random LFO wanders, fading in and out: wind, not a note.',
    {w1: 0, l1: .2, lnoise: .7, l2: 0, ftype: 3, cut: 2200, res: .5, lcut: 1.5, lshape: 5, lrate: .4, fenv: 0, aa: 1.2, ad: 1, as: 1, ar: 2, hpf: 400, chorus: 2, emix: .3, etime: 3, efb: .5, mode: 0, slop: .4, level: .5}, A.air, P.air],
];

// the drum machine's sounds: [id, role, name, what makes it, kit, changes, alone (hits), the pattern (a row a voice, 16ths, two bars)]
// in a row: '.' rest, 'g' ghost, 'o' soft, 'x' normal, 'X' accent
const DRUM = [
  ['deepkick', 'kick', 'Deep kick', 'The Deep kit\'s kick: a long round sub, little click, its tail booming on.', 'Analog Deep', {}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}],
  ['warmkick', 'kick', 'Warm kick', 'Through warm tape: rounder at the front, a little compressed, each hit drifting a little.', 'Analog Warm', {}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}],
  ['boomkick', 'kick', '808 boom', 'The 808 as its circuit behaves: a sine falling into its note, its pitch sagging, the tail long.', 'Analog 808', {}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}],
  ['shortkick', 'kick', 'Short round kick', 'The Deep kick made short and soft at the front: a round thump that stops before the next.', 'Analog Deep',
    {kick: {decay: .7, body: .4, snap: .1, x: .35, tune: -2}}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}],
  ['softhats', 'hats', 'Soft hats', 'The Deep kit\'s hats: the 808\'s six squares, darkened and short, played like a drummer (ghosts, accents, an open hat).', 'Analog Deep', {},
    [['chh', .9], ['ohh', .8]], {chh: 'g.x.g.X.g.x.g.x.g.x.g.X.g.xog.x.', ohh: '..............x...............x.'}],
  ['brighthats', 'hats', 'Bright hats', 'The 808\'s hats as they are: six clashing squares through resonant bands, crisp and long.', 'Analog 808', {},
    [['chh', .9], ['ohh', .8]], {chh: 'g.x.g.X.g.x.g.x.g.x.g.X.g.xog.x.', ohh: '..............x...............x.'}],
  ['handtoms', 'perc', 'Hand toms', 'The Warm kit\'s toms tuned up and short, played as hand drums: the groove you\'ve kept in every scene.', 'Analog Warm',
    {tomH: {tune: 4, decay: .6}, tomL: {tune: 2, decay: .7}}, [['tomH', .8], ['tomL', .8]], {tomH: '..x....x.....x....x....o.....x..', tomL: '...x......x.......x.......x....x'}],
  ['rimclave', 'perc', 'Rim and clave', 'The Deep kit\'s rim in threes and its clave in fives, round the beats, never on the backbeat.', 'Analog Deep', {},
    [['rim', .8], ['clave', .8]], {rim: '..x..x..x..x..x..x..x..x..x..x..', clave: '.x....x....x....x....x....x....'}],
  ['shaker', 'perc', 'Shaker', 'The Warm kit\'s shaker in 16ths, the accents on the off-beats, every hit a little different.', 'Analog Warm', {},
    [['shaker', .9]], {shaker: 'gox.gox.goxggox.gox.gox.goxggoxo'}],
  ['woodlogs', 'perc', 'Wood and logs', 'The clave tuned down into a woodblock and the low tom into a log drum: wood and stone, analog.', 'Analog Warm',
    {clave: {tune: -7}, tomL: {tune: -5, decay: .8}}, [['clave', .8], ['tomL', .8]], {clave: 'x..x..x...x..x..x..x..x...x.x...', tomL: '....x.......x.......x.....x.....'}],
];

// round 2: grown from round 1's ratings (studio/taste.md, 2026-11-01). The basses round and clean, harmonics without the
// filter's buzz, most of them FM that falls away into a plain tone (the Wooden FM they liked, "clearer"); the chords they
// all liked, a little warmer or tamed in the mids; the leads they liked but found nasal or piercing, with the new tone
// stage cutting that band; kicks short, dry and lower; hats from the new warm cymbal; the shaker wet (the lab's room).
// Each says what it grew from. [id, role, name, what it is, patch, alone, phrase, {from, room}]
const R1 = Object.fromEntries(SYNTH.map(x => [x[0], x[4]]));
const SYNTH2 = [
  ['fmround', 'bass', 'FM round', 'A sine shaken by a second an octave up, evenly (linear cross mod), the shaking falling away fast: a soft knock settling into a round, plain note.',
    {w1: 3, w2: 3, oct2: 1, xmod: .55, xtype: 1, xenv: .85, xdec: .14, l1: .9, l2: 0, ftype: 1, cut: 2400, res: 0, fenv: 0, aa: .002, ad: .5, as: .7, ar: .12, mode: 1, slop: .2, vdrive: .25, level: .75},
    A.bass, P.pluckBass, {from: 'Wooden FM'}],
  ['fmwood', 'bass', 'FM wood', 'Wooden FM with the shaking made even, so the note stays in tune, and falling away a little slower: the knock you liked, clearer still.',
    {...R1.woodfm, xtype: 1, xmod: .6, xenv: .6, xdec: .25, tilt: -.2}, A.bass, P.pluckBass, {from: 'Wooden FM'}],
  ['fmdeep', 'bass', 'FM deep', 'A sine shaken by one at the same pitch, gently: warmth and a little growl in the low mids, no buzz, long and round.',
    {w1: 3, w2: 3, xmod: .35, xtype: 1, xenv: .5, xdec: .4, l1: .9, l2: 0, lsub: .1, ftype: 1, cut: 1400, res: 0, fenv: 0, aa: .004, ad: .8, as: .8, ar: .15, mode: 2, glide: .04, slop: .25, vdrive: .3, level: .75},
    A.bass, P.longBass, {from: 'Dub bass, less sub'}],
  ['trisub', 'bass', 'Triangle pluck', 'A triangle over a quiet sine sub, the soft ladder opened a touch and closing without resonance: round, its harmonics gentle.',
    {w1: 2, w2: 3, oct2: -1, l1: .85, l2: .35, ftype: 1, cut: 700, res: 0, fenv: .25, fd: .25, fs: .3, aa: .002, ad: .4, as: .7, ar: .12, mode: 1, drive: .2, slop: .3, vdrive: .25, tilt: -.3, level: .75},
    A.bass, P.pluckBass, {from: 'Felt bass, without the buzz'}],
  ['roundclean', 'bass', 'Round pluck, clean', 'Round pluck with the resonance gone and the filter sweep halved, the mids cut: the sub you liked, without the farty edge.',
    {...R1.round, res: .05, fenv: .22, drive: .15, mids: -5, midf: 900, tilt: -.25}, A.bass, P.pluckBass, {from: 'Round pluck'}],
  ['dubround', 'bass', 'Dub round', 'Dub bass a little higher up the spectrum: a triangle and a soft saw, open enough to hear the note, gliding, less sub.',
    {w1: 2, w2: 0, l1: .8, l2: .25, drive: .35, ftype: 1, cut: 480, res: .05, fenv: .15, fd: .5, fs: .5, aa: .005, ad: .8, as: .8, ar: .2, mode: 2, glide: .08, slop: .4, vdrive: .3, mids: -3, midf: 800, level: .7},
    A.bass, P.longBass, {from: 'Dub bass'}],
  // chords: the ones they liked, warmer, or with the mids they worried about taken down
  ['gatedsoft', 'chords', 'Gated warm, softer', 'Gated warm as you liked it, a little warmer and its upper mids eased.', {...R1.gatedwarm, tilt: -.25, mids: -3, midf: 2200}, A.chord, P.gated, {from: 'Gated warm', room: .1}],
  ['glasstamed', 'chords', 'Glass stab, tamed', 'Glass stab with its mids cut where they crowd a mix, its echo kept.', {...R1.glassstab, mids: -7, midf: 1600}, A.chord, P.stabs, {from: 'Glass stab'}],
  ['pulsegated', 'chords', 'Pulse brass, gated', 'The pulse brass you liked cut into 16ths, like the gated chord.', {...R1.pulsebrass, ad: .15, as: .5, ar: .08, lamp: .1}, A.chord, P.gated, {from: 'Pulse brass and Gated warm'}],
  ['breathwide', 'chords', 'Breathing pad, wide', 'Breathing pad with both choruses, spread wider, a little warmer.', {...R1.breathing, chorus: 3, spread: .9, tilt: -.2}, A.chord, P.pads, {from: 'Breathing pad', room: .15}],
  ['suswarm', 'chords', 'Sus pluck, warm', 'Sus pluck a little warmer, ringing a little longer, in a small room.', {...R1.suspluck, tilt: -.3, ad: .8, ar: .6}, A.chord, P.stabs, {from: 'Sus pluck', room: .2}],
  ['dubroom', 'chords', 'Dub chord, in a room', 'Dub chord (open) as you liked it, with a room behind the echo.', {...R1.dubopen, mids: -2}, A.chord, P.stabs, {from: 'Dub chord, open', room: .25}],
  // plucks, bells and leads: the liked ones, their nasal or piercing band cut
  ['belltamed', 'lead', 'Ring bell, tamed', 'Ring bell with its nasal band cut and a little warmer.', {...R1.ringbell, mids: -8, midf: 2000, tilt: -.2}, A.lead, P.bell, {from: 'Ring bell', room: .2}],
  ['tinetamed', 'lead', 'Tine, tamed', 'Tine with the sharpness at 3 kHz taken out.', {...R1.tine, mids: -8, midf: 3000, tilt: -.15}, A.lead, P.threes, {from: 'Tine'}],
  ['malletsoft', 'lead', 'Soft mallet, softer', 'Soft mallet with the piercing band cut and a warmer top.', {...R1.mallet, mids: -7, midf: 2600, tilt: -.3}, A.lead, P.threes, {from: 'Soft mallet'}],
  ['fmbell', 'lead', 'FM bell, pure', 'Glass FM bell made with even shaking, which keeps its pitch true, the shimmer falling away into a pure ring.', {...R1.glassfm, xtype: 1, xmod: .5, xenv: .7, xdec: .5}, A.lead, P.bell, {from: 'Glass FM bell', room: .2}],
  ['fmkalimba', 'lead', 'FM kalimba', 'A sine shaken by one two octaves and a fourth up, falling away in a moment: a tine like the one you liked, without the ring mod\'s edge.',
    {w1: 3, w2: 3, oct2: 2, semi2: 5, xmod: .5, xtype: 1, xenv: 1, xdec: .05, l1: .9, l2: 0, ftype: 0, cut: 6000, fenv: 0, aa: .001, ad: .5, as: 0, ar: .4, mode: 0, emix: .15, etime: 1, efb: .25, slop: .15, level: .75}, A.lead, P.threes, {from: 'Tine'}],
  ['blipround', 'lead', 'Blip, rounder', 'Blip with a triangle under the sine and a warmer top.', {...R1.blip, w1: 2, tilt: -.3}, A.high, P.blips, {from: 'Blip'}],
  ['woodlow', 'lead', 'Wood pluck, lower', 'Wood pluck an octave lower and ringing a little longer: a struck log.', {...R1.woodpluck, oct: -1, ad: .22, res: .78}, A.lead, P.threes, {from: 'Wood pluck'}],
  ['pluckwarm', 'lead', 'Pulse pluck, warm', 'Pulse pluck with its upper mids eased and a warmer top.', {...R1.pulsepluck, mids: -4, midf: 2400, tilt: -.25}, A.lead, P.threes, {from: 'Pulse pluck'}],
  ['airdark', 'texture', 'Air swell, darker', 'Air swell lower down and darker, more wind than hiss.', {...R1.air, cut: 1300, tilt: -.3}, A.air, P.air, {from: 'Air swell', room: .2}],
];
const DRUM2 = [
  ['kicklow', 'kick', 'Short kick, lower', 'The short round kick you found closer, tuned well down, its tail kept short and dry.', 'Analog Deep',
    {kick: {decay: .6, body: .3, snap: .1, x: .35, tune: -7}}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}, {from: 'Short round kick'}],
  ['kickdeeper', 'kick', 'Short kick, deeper', 'Lower still and a touch longer, a softer front: a round thump with weight.', 'Analog Deep',
    {kick: {decay: .72, body: .35, snap: .06, x: .3, tune: -9}}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}, {from: 'Short round kick'}],
  ['kicktight', 'kick', 'Tight warm kick', 'The Warm kit\'s kick made short and dry, tuned down: tape-rounded, no boom.', 'Analog Warm',
    {kick: {decay: .55, body: .25, tune: -5, snap: .3}}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}, {from: 'Warm kick, drier'}],
  ['warmhats', 'hats', 'Warm hats', 'The new warm cymbal: shimmering partials from 4 kHz up, rounded at the top, nothing tinny below.', 'Analog Deep',
    {chh: {warm: .85, mids: -3}, ohh: {warm: .85, mids: -3}}, [['chh', .9], ['ohh', .8]], {chh: 'g.x.g.X.g.x.g.x.g.x.g.X.g.xog.x.', ohh: '..............x...............x.'}, {from: 'Soft hats'}],
  ['warmbright', 'hats', 'Warm hats, brighter', 'Half the 808\'s metal, half the warm cymbal: crisper, still rounded.', 'Analog 808',
    {chh: {warm: .55, mids: -4}, ohh: {warm: .55, mids: -4}}, [['chh', .9], ['ohh', .8]], {chh: 'g.x.g.X.g.x.g.x.g.x.g.X.g.xog.x.', ohh: '..............x...............x.'}, {from: 'Bright hats'}],
  ['warmshimmer', 'hats', 'Warm hats, open', 'The warm cymbal opening more, longer: the shimmer comes forward.', 'Analog Deep',
    {chh: {warm: 1, decay: 1.2}, ohh: {warm: 1, decay: 1.4}}, [['chh', .9], ['ohh', .85]], {chh: 'g.x.g.x.g.x.g.x.g.x.g.x.g.x.g.x.', ohh: '......x.......x.......x.......x.'}, {from: 'Soft hats', room: .1}],
  ['tomstamed', 'perc', 'Hand toms, tamed', 'Hand toms with the crowded mids cut.', 'Analog Warm',
    {tomH: {tune: 4, decay: .6, mids: -6}, tomL: {tune: 2, decay: .7, mids: -6}}, [['tomH', .8], ['tomL', .8]], {tomH: '..x....x.....x....x....o.....x..', tomL: '...x......x.......x.......x....x'}, {from: 'Hand toms', room: .1}],
  ['shakerwet', 'perc', 'Shaker, wet', 'The shaker you liked, sent into the room.', 'Analog Warm', {}, [['shaker', .9]], {shaker: 'gox.gox.goxggox.gox.gox.goxggoxo'}, {from: 'Shaker', room: .45}],
  ['rimroom', 'perc', 'Rim and clave, roomy', 'Rim and clave as you liked them, a little room round them.', 'Analog Deep', {}, [['rim', .8], ['clave', .8]],
    {rim: '..x..x..x..x..x..x..x..x..x..x..', clave: '.x....x....x....x....x....x....'}, {from: 'Rim and clave', room: .2}],
];
// round 3: from round 2's ratings (studio/taste.md). The bass family is FM that stays in tune and falls away (FM round and
// FM wood liked; same-pitch FM and anything from a saw or pulse "farty"): variations on its ratio, fall and length. The
// leads they liked but still found harsh (Blip, FM kalimba, Pulse pluck) cut higher up, where they're harsh (4–6 kHz),
// and started a few milliseconds softer. The hats get the new Attack (no click) and a low body, played in pairs, the
// closed hat choking the open one or the open left to ring. The shaker in half the room; rim and clave softened.
const R2 = Object.fromEntries(SYNTH2.map(x => [x[0], x[4]]));
const FMB = {w1: 3, w2: 3, xtype: 1, l1: .9, l2: 0, ftype: 1, cut: 2400, res: 0, fenv: 0, aa: .002, ad: .5, as: .7, ar: .12, mode: 1, slop: .2, vdrive: .25, level: .75};
const SYNTH3 = [
  ['fmshort', 'bass', 'FM round, short', 'FM round played short and plucky: the knock and a little note, gone before the next.', {...R2.fmround, ad: .22, as: .15, ar: .08}, A.bass, P.pluckBass, {from: 'FM round'}],
  ['fmslow', 'bass', 'FM round, slow fall', 'FM round with its shaking falling away over a quarter of a second: more of the knock\'s colour in each note.', {...R2.fmround, xdec: .26, xenv: .75}, A.bass, P.pluckBass, {from: 'FM round'}],
  ['fmglide', 'bass', 'FM round, gliding', 'FM round played legato, each note sliding into the next: a rubbery line without the buzz.', {...R2.fmround, mode: 2, glide: .06, as: .8}, A.bass, P.longBass, {from: 'FM round'}],
  ['fmfifth', 'bass', 'FM wood, a fifth', 'The FM shaking a fifth above the octave, falling fast: wood with a hollow ring.', {...FMB, oct2: 1, semi2: 7, xmod: .5, xenv: .9, xdec: .1, cut: 2000}, A.bass, P.pluckBass, {from: 'FM wood'}],
  ['fmtwo', 'bass', 'FM round, two octaves', 'Shaken by a sine two octaves up, falling away: a brighter knock, still round underneath.', {...FMB, oct2: 2, xmod: .4, xenv: .9, xdec: .09, cut: 2600}, A.bass, P.pluckBass, {from: 'FM round'}],
  ['fmtri', 'bass', 'FM round on a triangle', 'FM round with a quiet triangle under it, a little more body in the low mids, no buzz.', {...R2.fmround, w2: 2, oct2: 0, l2: .25, xmod: .5}, A.bass, P.pluckBass, {from: 'FM round and Triangle pluck'}],
  ['fmwoodlong', 'bass', 'FM wood, long', 'FM wood held longer and softer at the front, a note that sings out a little.', {...R2.fmwood, aa: .004, as: .75, ad: .8, xdec: .3}, A.bass, P.longBass, {from: 'FM wood'}],
  // leads: the harshness cut higher, a softer start
  ['blipsoft', 'lead', 'Blip, soft', 'Blip with the band at 5 kHz cut, a warmer top, and a few milliseconds softer at the start.', {...R2.blipround, mids: -8, midf: 5000, tilt: -.45, aa: .004}, A.high, P.blips, {from: 'Blip, rounder'}],
  ['kalimbasoft', 'lead', 'FM kalimba, soft', 'FM kalimba with its shaking less bright, the 4 kHz band cut and a softer start.', {...R2.fmkalimba, xmod: .35, mids: -8, midf: 4200, tilt: -.35, aa: .003}, A.lead, P.threes, {from: 'FM kalimba'}],
  ['plucksoft', 'lead', 'Pulse pluck, soft', 'Pulse pluck through a lower filter, the 4 kHz band cut, the echo darker.', {...R2.pluckwarm, cut: 420, mids: -7, midf: 4000, tilt: -.4, etone: .3, aa: .003}, A.lead, P.threes, {from: 'Pulse pluck, warm'}],
  ['fmmarimba', 'lead', 'FM marimba', 'A sine shaken by one two octaves up, falling away in an instant: a mallet on wood, rounder than the Soft mallet.', {...FMB, oct2: 2, xmod: .45, xenv: 1, xdec: .03, mode: 0, ad: .45, as: 0, ar: .35, cut: 5000, tilt: -.2, level: .75}, A.lead, P.threes, {from: 'Soft mallet, softer'}],
  ['fmglass', 'lead', 'FM glass', 'Shaken at an odd ratio (an octave and a major sixth), falling away slowly: a glassy bell, its partials not a harmonic series.', {...FMB, oct2: 1, semi2: 9, xmod: .35, xenv: .6, xdec: .6, mode: 0, ad: 1.6, as: 0, ar: 1.4, cut: 6000, chorus: 1, emix: .2, etime: 3, efb: .35, mids: -4, midf: 3500, level: .65}, A.lead, P.bell, {from: 'FM bell, pure', room: .15}],
  ['bellsoft', 'lead', 'Ring bell, softer', 'Ring bell tamed as you liked it, with a softer start and warmer still.', {...R2.belltamed, aa: .004, tilt: -.35}, A.lead, P.bell, {from: 'Ring bell, tamed', room: .2}],
  ['woodwarm', 'lead', 'Wood pluck, warm', 'Wood pluck lower, its resonance a little wider: a log drum, warmer.', {...R2.woodlow, res: .7, tilt: -.3, mids: -4, midf: 3000}, A.lead, P.threes, {from: 'Wood pluck, lower'}],
  // chords: they liked them all; a few new ones in the same direction
  ['fmkeys', 'chords', 'FM keys', 'Chords on a sine shaken an octave up, gently, falling away: an electric piano\'s bell and body, played as stabs.', {...FMB, oct2: 1, xmod: .3, xenv: .7, xdec: .35, mode: 0, ad: 1, as: .2, ar: .4, cut: 4000, chorus: 1, tilt: -.2, level: .55}, A.chord, P.stabs, {from: 'Sus pluck and FM bell', room: .15}],
  ['fmgated', 'chords', 'FM keys, gated', 'The FM keys cut into 16ths, like the gated chord you liked.', {...FMB, oct2: 1, xmod: .3, xenv: .5, xdec: .08, mode: 0, ad: .15, as: .4, ar: .06, cut: 4000, chorus: 2, tilt: -.2, level: .5}, A.chord, P.gated, {from: 'Gated warm, softer'}],
  ['brasssoft', 'chords', 'Pulse brass, softer', 'Pulse brass speaking a little later and softer, warmer.', {...R1.pulsebrass, aa: .06, fa: .14, tilt: -.25}, A.chord, P.pads, {from: 'Pulse brass', room: .1}],
  ['susroom', 'chords', 'Sus pluck, in a room', 'Sus pluck, warm, as you liked it, a little more room.', {...R2.suswarm}, A.chord, P.stabs, {from: 'Sus pluck, warm', room: .3}],
];
const HPAT = {chh: 'g.x.g.X.g.x.g.x.g.x.g.X.g.xog.x.', ohh: '..............x...............x.'};
const DRUM3 = [
  // hats: the new Attack, the body, and pairs
  ['hatsoft', 'hats', 'Warm hats, soft attack', 'The warm cymbal with its click taken off: each hit fades in over 3 ms.', 'Analog Deep',
    {chh: {warm: .9, atk: 3, mids: -3}, ohh: {warm: .9, atk: 4, mids: -3}}, [['chh', .9], ['ohh', .8]], HPAT, {from: 'Warm hats'}],
  ['hatbody', 'hats', 'Warm hats with body', 'The soft-attack warm cymbal with a little bronze body under it: less thin.', 'Analog Deep',
    {chh: {warm: .9, atk: 3, body: .9, mids: -3}, ohh: {warm: .9, atk: 4, body: .8, mids: -3}}, [['chh', .9], ['ohh', .8]], HPAT, {from: 'Warm hats'}],
  ['hatdark', 'hats', 'Warm hats, darker', 'Softer still at the top and the start, the open one longer: a hush more than a tick.', 'Analog Deep',
    {chh: {warm: 1, atk: 5, tone: .6, mids: -4}, ohh: {warm: 1, atk: 6, tone: .6, decay: 1.3, mids: -4}}, [['chh', .9], ['ohh', .8]], HPAT, {from: 'Warm hats, open'}],
  ['hatchoke', 'hats', 'Hat pair, choked', 'A closed and an open hat as a pair: each open hat cut short by the closed one a 16th after it, as a drummer\'s foot closes it.', 'Analog Deep',
    {chh: {warm: .9, atk: 3, body: .8, mids: -3}, ohh: {warm: .9, atk: 4, body: .7, decay: 1.4, mids: -3}}, [['ohh', .85], ['chh', .8]],
    {chh: 'x.g.x..xx.g.x..xx.g.x..xx.g.x..x', ohh: '......x.......x.......x.......x.'}, {from: 'your question: the choke'}],
  ['hatring', 'hats', 'Hat pair, ringing', 'The same pair, the open hats left to ring out over a few soft closed ones.', 'Analog Deep',
    {chh: {warm: .9, atk: 3, body: .8, mids: -3}, ohh: {warm: .9, atk: 4, body: .7, decay: 1.4, mids: -3}}, [['ohh', .85], ['chh', .8]],
    {chh: 'x...g...x...g...x...g...x...g...', ohh: '..x.......x.......x.......x.....'}, {from: 'your question: no choke', room: .1}],
  ['hat808soft', 'hats', '808 hats, softened', 'The 808\'s own metal, a third warm cymbal, its click taken off and the mids cut.', 'Analog 808',
    {chh: {warm: .35, atk: 3, mids: -6, tone: .75}, ohh: {warm: .35, atk: 4, mids: -6, tone: .75}}, [['chh', .9], ['ohh', .8]], HPAT, {from: 'Warm hats, brighter'}],
  // percussion
  ['shakerhalf', 'perc', 'Shaker, half wet', 'The shaker in half the room it had.', 'Analog Warm', {}, [['shaker', .9]], {shaker: 'gox.gox.goxggox.gox.gox.goxggoxo'}, {from: 'Shaker, wet', room: .22}],
  ['rimsoft', 'perc', 'Rim and clave, softened', 'Rim and clave with their 2.5 kHz ring cut, darker and a touch softer at the start.', 'Analog Deep',
    {rim: {mids: -7, tone: .55, atk: 1}, clave: {mids: -7, tune: -3, atk: 1}}, [['rim', .8], ['clave', .8]], {rim: '..x..x..x..x..x..x..x..x..x..x..', clave: '.x....x....x....x....x....x....'}, {from: 'Rim and clave, roomy', room: .15}],
  ['shakertoms', 'perc', 'Toms and shaker', 'The tamed hand toms with the shaker under them, in a little room.', 'Analog Warm',
    {tomH: {tune: 4, decay: .6, mids: -6}, tomL: {tune: 2, decay: .7, mids: -6}}, [['tomH', .8], ['shaker', .8]],
    {tomH: '..x....x.....x....x....o.....x..', tomL: '...x......x.......x.......x....x', shaker: 'g.o.g.o.g.o.g.o.g.o.g.o.g.o.g.o.'}, {from: 'Hand toms, tamed', room: .15}],
  // a kick: the liked low one, its click rounder
  ['kickround', 'kick', 'Short kick, rounder', 'Short kick, lower, with less click at the front.', 'Analog Deep', {kick: {decay: .62, body: .32, snap: .02, x: .25, tune: -7, atk: .6}}, [['kick', 1]], {kick: 'X...x...x...x...X...x...x...x..g'}, {from: 'Short kick, lower'}],
];
const LEVEL = {g: .25, o: .45, x: .75, X: 1};
const rows = r => Object.entries(r).flatMap(([v, row]) => [...row].map((c, s) => c === '.' ? null : {s, v, vel: LEVEL[c]}).filter(Boolean));
const synths = list => list.map(([id, role, name, words, patch, alone, phrase, x = {}]) => ({id, kind: 'synth', role, name, words, patch, alone, phrase, from: x.from, room: x.room || 0}));
const drums = list => list.map(([id, role, name, words, kit, over, alone, pattern, x = {}]) => ({id, kind: 'drum', role, name, words, kit, over, alone: alone.map(([v, vel], i) => ({s: i*4, v, vel})), phrase: rows(pattern), from: x.from, room: x.room || 0}));
export const ROUNDS = {1: [...synths(SYNTH), ...drums(DRUM)], 2: [...synths(SYNTH2), ...drums(DRUM2)], 3: [...synths(SYNTH3), ...drums(DRUM3)]};
for (const [r, list] of Object.entries(ROUNDS)) for (const x of list) x.round = +r;
export const SOUNDS = ROUNDS[ROUND], ALL = Object.values(ROUNDS).flat();
// each sound's parents: the sound (or sounds) it grew from, the first its main line; none for a new design. From these
// the families build themselves: a family is a first sound and everything grown from it, round by round, branching
// where one sound had several children, ending where a sound had none
export const PARENTS = {
  fmround: ['woodfm'], fmwood: ['woodfm'], fmdeep: ['dubbass'], trisub: ['felt'], roundclean: ['round'], dubround: ['dubbass'],
  gatedsoft: ['gatedwarm'], glasstamed: ['glassstab'], pulsegated: ['pulsebrass', 'gatedwarm'], breathwide: ['breathing'], suswarm: ['suspluck'], dubroom: ['dubopen'],
  belltamed: ['ringbell'], tinetamed: ['tine'], malletsoft: ['mallet'], fmbell: ['glassfm'], fmkalimba: ['tine'], blipround: ['blip'], woodlow: ['woodpluck'], pluckwarm: ['pulsepluck'], airdark: ['air'],
  kicklow: ['shortkick'], kickdeeper: ['shortkick'], kicktight: ['warmkick'], warmhats: ['softhats'], warmbright: ['brighthats'], warmshimmer: ['softhats'], tomstamed: ['handtoms'], shakerwet: ['shaker'], rimroom: ['rimclave'],
  fmshort: ['fmround'], fmslow: ['fmround'], fmglide: ['fmround'], fmfifth: ['fmwood'], fmtwo: ['fmround'], fmtri: ['fmround', 'trisub'], fmwoodlong: ['fmwood'],
  blipsoft: ['blipround'], kalimbasoft: ['fmkalimba'], plucksoft: ['pluckwarm'], fmmarimba: ['malletsoft'], fmglass: ['fmbell'], bellsoft: ['belltamed'], woodwarm: ['woodlow'],
  fmgated: ['gatedsoft', 'fmkeys'], brasssoft: ['pulsebrass'], susroom: ['suswarm'],
  hatsoft: ['warmhats'], hatbody: ['warmhats'], hatdark: ['warmshimmer'], hatring: ['hatchoke'], hat808soft: ['warmbright'], shakerhalf: ['shakerwet'], rimsoft: ['rimroom'], shakertoms: ['tomstamed'], kickround: ['kicklow'],
};
const BYID = Object.fromEntries(ALL.map(x => [x.id, x]));
for (const x of ALL) { x.parents = PARENTS[x.id] || []; if (x.parents.length) x.from = x.parents.map(p => BYID[p].name + (BYID[p].round !== x.round - 1 ? ` (round ${BYID[p].round})` : '')).join(' and '); }
// the families: each sound's root (its main line followed back), the members in order of round, and its roles
const rootOf = x => { let r = x; while (r.parents.length) r = BYID[r.parents[0]]; return r.id; };
for (const x of ALL) x.family = rootOf(x);
export const FAMILIES = [...new Set(ALL.map(x => x.family))].map(root => { const members = ALL.filter(x => x.family === root).sort((a, b) => a.round - b.round);
  const last = members.at(-1); return {root, members, rounds: [...new Set(members.map(x => x.round))], last, role: last.role, ended: last.round < ROUND}; });
// what each round set out to do, for the page
export const INTROS = {
  1: 'Thirty sounds from the two analog instruments: the analog synth and the analog drum machine, a wide spread to find out what you like.',
  2: 'Grown from your round 1 ratings: round, clean basses without the buzz; the chords you liked, a little warmer; the leads with their nasal, piercing band cut; short, dry, lower kicks; the new warm hats; some sounds in a room.',
  3: 'Grown from your round 2 ratings: more basses in the FM family you liked, the leads you still found harsh cut higher up and started softer, warm hats with their click taken off and a little body, played as choked and ringing pairs, the shaker in half the room, rim and clave softened.',
};
export const GROUPS = [['bass', 'Basses'], ['chords', 'Chords'], ['lead', 'Plucks, bells and leads'], ['texture', 'Texture'], ['kick', 'Kicks'], ['hats', 'Hats'], ['perc', 'Percussion']];
// the quiet groove under a phrase in "In a loop": the Deep kit, set back. A kick sound gets the hats and shaker alone;
// hats get the kick alone; the rest get the kick, a few closed hats and the shaker
export const GROOVE = {
  kick: rows({chh: '..o...o...o...o...o...o...o...o.', shaker: 'g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.'}),
  hats: rows({kick: 'x...x...x...x...x...x...x...x...'}),
  rest: rows({kick: 'x...x...x...x...x...x...x...x...', chh: '..o...o...o...o...o...o...o...o.', shaker: 'g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.g.'}),
};
export const grooveFor = s => s.role === 'kick' ? GROOVE.kick : s.role === 'hats' ? GROOVE.hats : GROOVE.rest;
