// The music side of the sound lab: musical parts to like or not, as the sounds were: drum grooves, bass lines, chord
// progressions and riffs, and ideas (the parts together, a few bars of a piece). Every part plays on the user's own
// palette sounds (their liked sounds with their edits), so only the music changes; each is heard alone or with the band
// (the same plain backing every time, so a part is judged in context). All in A; the page's tempo sets the speed.
// A part: {slot, sound (a lab sound id), notes ([{s, v, vel}] a drum's, [{s, l, n, v}] a synth's), len (16ths), from
// (the bar it comes in), swing (0..1 of a 16th: the off 16ths late)}.
import { midiOf } from '../lib/names.js';
import { rows, ALL } from './sounds.js';

export const MROUND = 2;
// the palette the music plays on: the user's (their kit with real hats, the real hat pair, the dry hands, FM round, the
// evolving pad, the FM marimba), and the glass stab and the softer ring bell for some riffs
export const KIT = {kick: 'kitmine', hats: 'realpair', perc: 'tomsdry', snare: 'ghost2', bass: 'fmround', chords: 'lfopad', lead: 'fmmarimba', glass: 'glasstamed', bell: 'bellsoft'};
// each slot's level in the mix (the parts together), as the palette's
export const LEVELS = {kick: 1, hats: .8, perc: .7, snare: .6, bass: .9, chords: .7, lead: .8, glass: .6, bell: .65};

// notes: [step, length in 16ths, note, velocity]
const T = list => list.map(([s, l, n, v = .8]) => ({s, l, n: typeof n === 'number' ? n : midiOf(n), v}));
// drums written as rows, a voice each, over any number of bars
const D = r => rows(r);
const part = (slot, notes, len, more = {}) => ({slot, sound: KIT[slot], notes, len, ...more});

/* ---------- chords: voicings, and a progression as chords held each its bars ---------- */
const V = {Am9: 'A2 E3 G3 B3 C4', Am11: 'A2 E3 G3 C4 D4', D9: 'D3 F#3 A3 C4 E4', Gmaj9: 'G2 D3 F#3 A3 B3', Asus2: 'A2 E3 A3 B3 E4', Csus2: 'C3 G3 C4 D4 G4',
  Dsus2: 'D3 A3 D4 E4 A4', Fsus2: 'F2 C3 F3 G3 C4', Fmaj7: 'F2 C3 E3 A3 C4', Em9: 'E2 B2 D3 F#3 G3', Cmaj9: 'C3 G3 B3 D4 E4'};
const ROOT = {Am9: 0, Am11: 0, Asus2: 0, D9: 5, Dsus2: 5, Gmaj9: -2, Csus2: 3, Fsus2: -4, Fmaj7: -4, Em9: -5, Cmaj9: 3};
// a progression: [chord, bars] in turn, each held (re-struck every `every` bars, so the pad's LFO carries it)
function prog(list, every = 2){ const notes = []; let bar = 0;
  for (const [c, bars] of list) { for (let b = 0; b < bars; b += every) for (const n of V[c].split(' ')) notes.push({s: (bar + b)*16, l: Math.min(every, bars - b)*16 - 1, n: midiOf(n), v: .7}); bar += bars; }
  return {notes, len: bar*16, roots: list.flatMap(([c, bars]) => Array(bars).fill(ROOT[c]))}; }
// a bass line following the chords' roots bar by bar (written over A, moved to each bar's root)
const follow = (notes, len, roots) => { const out = [], total = roots.length*16; for (let o = 0; o < total; o += len) for (const x of notes) { const s = o + x.s; if (s < total) out.push({...x, s, n: x.n + roots[Math.floor(s/16)]}); } return out; };

/* ---------- drum grooves (two bars unless said) ---------- */
const G = {
  straight: {name: 'Straight four', words: 'The kick on every beat, open hats on the off-beats, the shaker in 16ths: the plainest minimal groove.',
    rows: {kick: 'X...x...x...x...X...x...x...x...', chh: 'g.o.g.o.g.o.g.o.g.o.g.o.g.o.g.o.', ohh: '..x...x...x...x...x...x...x...x.', shaker: 'gogogogogogogogogogogogogogogogo'}},
  ghosts: {name: 'Four with ghosts', words: 'Four on the floor, the hats in 16ths with a drummer\'s accents and ghosts, a ghost kick leading into the bar.',
    rows: {kick: 'X...x...x...x...X...x...x...x..g', chh: 'g.x.g.X.g.x.gox.g.x.g.X.g.xog.x.', ohh: '..............x...............x.', tomH: '.......o...........o............'}},
  broken: {name: 'Broken kick', words: 'The kick broken up (a beat moved a 16th early, one left out), the hats steady over it.',
    rows: {kick: 'X...x...x..x....X.....x.x...x...', chh: 'g.x.g.x.g.x.g.x.g.x.g.x.g.x.g.x.', rim: '...x......x.......x.......x.....'}},
  skip: {name: 'Skipping', words: 'Four bars: four on the floor, the third bar\'s kick left out but its hats and hands kept: the groove breathes.', bars: 4,
    rows: {kick: 'X...x...x...x...X...x...x...x...................X...x...x...x..g', chh: '..x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x.',
      tomH: '..x....x.....x....x....o.....x....x....x.....x....x....o.....x..', tomL: '...x......x.......x.......x....x...x......x.......x.......x....x'}},
  threes: {name: 'Toms in threes', words: 'Four on the floor, the toms rolling every three 16ths against it: a polyrhythm that comes round in a new place each beat.',
    rows: {kick: 'X...x...x...x...X...x...x...x...', chh: '..o...o...o...o...o...o...o...o.', tomH: 'x..o..x..o..x..o..x..o..x..o..x.', tomL: '..........x..............x......'}},
  dub: {name: 'Sparse dub', words: 'The kick on one and three, an open hat on the and of two, a rim answering: lots of space.',
    rows: {kick: 'X.......x.......X.......x.....g.', ohh: '......x...............x.........', chh: '..g.......g...g...g.......g...g.', rim: '...........x...............x....'}},
  shuffle: {name: 'Shuffled 16ths', words: 'Four on the floor with the 16ths swung (the off 16ths late), hats and shaker shuffling.', swing: .32,
    rows: {kick: 'X...x...x...x...X...x...x...x...', chh: 'gxgxgXgxgxgxgXgxgxgxgXgxgxgxgXgx', ohh: '..............x...............x.', shaker: 'g.o.g.o.g.o.g.o.g.o.g.o.g.o.g.o.'}},
  fives: {name: 'Rim in fives', words: 'Four on the floor, a rim every five 16ths over it, the hats plain: a pattern that takes five bars to come home.', bars: 5,
    rows: {kick: 'X...x...x...x...'.repeat(5), chh: '..x...x...x...x.'.repeat(5), rim: 'x....'.repeat(16)}},
  ghostsnare: {name: 'Snare ghosts', words: 'Four on the floor, the snare only as soft ghosts between the beats (never on 2 and 4), the hats light.',
    rows: {kick: 'X...x...x...x...X...x...x...x...', chh: '..o...o...o...o...o...o...o...o.', snare: '.g...g.o..g...o..g...g.o..g..go.'}},
  half: {name: 'Half time', words: 'The kick on one and the and of three, the open hats on the beat between: slow and heavy at the same tempo.',
    rows: {kick: 'X.........x.....X.........x.....', ohh: '....x.......x.......x.......x...', chh: '..g...g...g...g...g...g...g...g.', tomL: '..............x...............x.'}},
};
// a groove's parts: each row onto its slot's sound (the hats' rows on the hats, the toms and shaker on the hands)
const SLOT_OF = {kick: 'kick', rim: 'kick', chh: 'hats', ohh: 'hats', ride: 'hats', tomH: 'perc', tomL: 'perc', shaker: 'perc', snare: 'snare'};
function grooveParts(g){ const len = (g.bars || 2)*16, by = {};
  for (const [v, row] of Object.entries(g.rows)) (by[SLOT_OF[v]] ||= {})[v] = row;
  return Object.entries(by).map(([slot, r]) => part(slot, D(r), len, g.swing ? {swing: g.swing} : {})); }

/* ---------- bass lines (over A; with the band they follow the chords' roots) ---------- */
const B = {
  andTwo: {name: 'Two notes on the and', words: 'The motif you liked: just two notes off the beat, in the pocket.', notes: T([[2, 3, 'A1', .85], [18, 2, 'A1', .78], [26, 2, 'C2', .62]]), len: 32},
  rolling: {name: 'Rolling threes', words: 'A note every three 16ths, the root with a fifth now and then: a rolling line against the four.', notes: T([[0, 2, 'A1', .85], [3, 2, 'A1', .6], [6, 2, 'E2', .65], [9, 2, 'A1', .6], [12, 2, 'A1', .7], [15, 1, 'G1', .55]]), len: 16},
  offbeat: {name: 'Off-beat 8ths', words: 'The classic minimal bass: every off-beat, the root, a fifth to turn the bar round.', notes: T([[2, 2, 'A1', .8], [6, 2, 'A1', .7], [10, 2, 'A1', .75], [14, 2, 'E2', .7], [18, 2, 'A1', .8], [22, 2, 'A1', .7], [26, 2, 'G1', .72], [30, 2, 'C2', .65]]), len: 32},
  tresillo: {name: 'Tresillo and a fifth', words: 'Three-three-two across the bar, the third note up a fifth.', notes: T([[0, 2, 'A1', .85], [3, 2, 'A1', .62], [6, 2, 'E2', .7], [16, 2, 'A1', .85], [19, 2, 'A1', .62], [22, 2, 'G1', .7], [28, 1, 'C2', .5]]), len: 32},
  walk: {name: 'Walking up', words: 'Up the minor scale a note a beat, then back down: a line that moves.', notes: T([[0, 3, 'A1'], [4, 3, 'C2', .7], [8, 3, 'D2', .72], [12, 3, 'E2', .75], [16, 3, 'G2', .78], [20, 3, 'E2', .7], [24, 3, 'D2', .68], [28, 3, 'C2', .66]]), len: 32},
  synco: {name: 'Syncopated', words: 'Short notes pushed off the grid (the and of one, the e of three): a bass that pulls against the kick.', notes: T([[2, 1, 'A1', .85], [5, 1, 'A1', .6], [9, 2, 'C2', .7], [11, 1, 'A1', .55], [14, 1, 'E2', .66], [18, 1, 'A1', .85], [21, 1, 'G1', .62], [25, 2, 'A1', .7], [29, 1, 'C2', .58]]), len: 32},
  octave: {name: 'Octave bounce', words: 'The root and its octave in a broken 16th pattern, with gaps: a bouncing line.', notes: T([[0, 1, 'A1', .85], [3, 1, 'A2', .6], [4, 1, 'A1', .7], [7, 1, 'A2', .55], [10, 1, 'A1', .7], [11, 1, 'A2', .5], [14, 1, 'A1', .65]]), len: 16},
  long: {name: 'Long and low', words: 'Long notes on the and, the fifth answering: almost a drone, moving slowly.', notes: T([[2, 12, 'A1', .78], [18, 6, 'E1', .65], [26, 5, 'G1', .6]]), len: 32},
};

/* ---------- chord progressions (eight bars, on the evolving pad) ---------- */
const C = {
  deep: {name: 'One chord, deep', words: 'A minor 9 for eight bars: all the movement in the pad itself.', list: [['Am9', 8]]},
  colour: {name: 'Pedal, the colour moving', words: 'The same A underneath, the top opening from 9 to 11 and back.', list: [['Am9', 2], ['Am11', 2], ['Am9', 2], ['Am11', 2]]},
  dorian: {name: 'Dorian lift', words: 'A minor 9 and D 9: the minor home and the bright IV, the deep-house lift.', list: [['Am9', 2], ['D9', 2], ['Am9', 2], ['D9', 2]]},
  sus: {name: 'Suspended drift', words: 'Sus2 chords stepping up and back (A, C, D, F): open, never landing.', list: [['Asus2', 2], ['Csus2', 2], ['Dsus2', 2], ['Fsus2', 2]]},
  tone: {name: 'Down a tone', words: 'A minor 9 to G major 9 and back: gentle, endless.', list: [['Am9', 2], ['Gmaj9', 2], ['Am9', 2], ['Gmaj9', 2]]},
  elevens: {name: 'Eleven and six', words: 'A minor 11 then F major 7, four bars each: heavy and wide.', list: [['Am11', 4], ['Fmaj7', 4]]},
};

/* ---------- riffs (on the FM marimba, the glass stab or the bell) ---------- */
const R = {
  seven: {name: 'Seven against four', words: 'A three-note figure every seven 16ths: it lands somewhere new each bar.', slot: 'lead', notes: T([[0, 1, 'C5', .62], [3, 1, 'E5', .5], [5, 1, 'D5', .55]]), len: 7},
  answer: {name: 'Call and answer', words: 'A short phrase in the first bar, answered in the second.', slot: 'lead', notes: T([[0, 1, 'E5', .65], [3, 1, 'G5', .5], [6, 2, 'A5', .6], [16, 1, 'G5', .55], [19, 1, 'E5', .5], [22, 2, 'C5', .6]]), len: 32},
  fives: {name: 'Fives', words: 'A two-note figure every five 16ths: a polyrhythm that takes five bars to come home.', slot: 'lead', notes: T([[0, 1, 'A4', .6], [2, 1, 'E5', .48]]), len: 5},
  arp: {name: 'Rising arpeggio', words: 'The chord\'s notes rising in 8ths, a different top note each bar.', slot: 'lead', notes: T([[0, 1, 'A4', .6], [2, 1, 'C5', .5], [4, 1, 'E5', .55], [6, 1, 'G5', .5], [16, 1, 'A4', .6], [18, 1, 'C5', .5], [20, 1, 'E5', .55], [22, 1, 'B5', .5]]), len: 32},
  ostinato: {name: 'Two-note ostinato', words: 'Two notes repeating on the off 16ths: a hypnotic tick.', slot: 'lead', notes: T([[2, 1, 'E5', .55], [7, 1, 'A5', .45], [10, 1, 'E5', .5], [15, 1, 'A5', .42]]), len: 16},
  stabs: {name: 'Glass stabs', words: 'The glass stab on the and, high and sparse, its echo filling the gaps.', slot: 'glass', notes: T([[2, 1, 'E4', .6], [14, 1, 'G4', .45], [26, 1, 'A4', .55]]), len: 32},
  bell: {name: 'Bell phrase', words: 'The ring bell: a few notes, answered, with space round them.', slot: 'bell', notes: T([[0, 3, 'E5', .7], [6, 2, 'D5', .55], [12, 3, 'A4', .6], [20, 2, 'C5', .6], [24, 4, 'B4', .62]]), len: 32},
  dotted: {name: 'Dotted echo', words: 'Notes three 16ths apart in pairs, like a dotted-eighth echo played by hand.', slot: 'lead', notes: T([[0, 1, 'A5', .6], [3, 1, 'A5', .4], [8, 1, 'G5', .55], [11, 1, 'G5', .38], [16, 1, 'E5', .58], [19, 1, 'E5', .38], [24, 1, 'C5', .55], [27, 1, 'C5', .36]]), len: 32},
};

/* ---------- the band: the same plain backing under each kind of part ---------- */
const PLAIN = {kick: 'X...x...x...x...', chh: '..o...o...o...o.'};
const band = {
  // under a groove: the bass's two notes and the pad on A minor 9
  groove: () => [part('bass', B.andTwo.notes, 32), part('chords', prog(C.deep.list).notes, 128)],
  // under a bass line: the kick and a quiet pad
  bass: () => [part('kick', D({kick: PLAIN.kick}), 16), part('chords', prog(C.deep.list).notes, 128, {level: .7})],
  // under a progression: the plain groove (kick and hats)
  chords: () => [part('kick', D({kick: PLAIN.kick}), 16), part('hats', D({chh: PLAIN.chh}), 16)],
  // under a riff: the plain groove, the bass's two notes and the pad
  riff: () => [part('kick', D({kick: PLAIN.kick}), 16), part('hats', D({chh: PLAIN.chh}), 16), part('bass', B.andTwo.notes, 32), part('chords', prog(C.deep.list).notes, 128)],
};

/* ---------- ideas: the parts together, eight bars, each part coming in at its bar ---------- */
const idea = (name, words, g, b, c, r, from = {}) => { const P = prog(C[c].list), parts = [...grooveParts(G[g]).map(x => ({...x, from: from.drums || 0})),
    part('bass', follow(B[b].notes, B[b].len, P.roots), P.len, {from: from.bass || 0}), part('chords', P.notes, P.len, {from: from.chords || 0}),
    r ? part(R[r].slot, R[r].notes, R[r].len, {from: from.riff || 0}) : null].filter(Boolean);
  return {name, words, parts, bars: 8, uses: {groove: g, bass: b, chords: c, riff: r}}; };
const IDEAS = {
  still: idea('Deep and still', 'Four with ghosts, the two-note bass, A minor 9 held, the seven-step marimba: minimal, nothing changes but the groove.', 'ghosts', 'andTwo', 'deep', 'seven'),
  lift: idea('Dorian lift', 'The straight four, the off-beat bass following A minor 9 and D 9, a call and answer on top.', 'straight', 'offbeat', 'dorian', 'answer'),
  drift: idea('Suspended drift', 'The sparse dub groove, long low bass notes under the suspended chords, the bell phrase.', 'dub', 'long', 'sus', 'bell'),
  rolling: idea('Rolling', 'Toms in threes, the rolling bass, the colour moving on the pedal, the fives figure: polyrhythms everywhere.', 'threes', 'rolling', 'colour', 'fives'),
  broken: idea('Broken', 'The broken kick, the syncopated bass, down a tone and back, the two-note ostinato.', 'broken', 'synco', 'tone', 'ostinato'),
  build: idea('Building', 'Eight bars that grow: the pad alone, the drums at bar 3, the bass at bar 5, the glass stabs at bar 7.', 'ghosts', 'andTwo', 'elevens', 'stabs', {drums: 2, bass: 4, riff: 6, chords: 0}),
};

/* ---------- the items: each kind's parts as cards, its own part and its band ---------- */
const item = (id, kind, x, own, withBand, rd = 'm1') => ({id: rd + '-' + id, kind: 'music', mkind: kind, round: rd, role: kind, name: x.name, words: x.words, bars: x.bars || Math.max(...own.map(p => p.len))/16, own, band: withBand});
const MUSIC1 = [
  ...Object.entries(G).map(([k, g]) => item('g-' + k, 'groove', g, grooveParts(g), band.groove())),
  ...Object.entries(B).map(([k, b]) => item('b-' + k, 'bass', b, [part('bass', b.notes, b.len)], band.bass())),
  ...Object.entries(C).map(([k, c]) => item('c-' + k, 'chords', {...c, bars: 8}, [part('chords', prog(c.list).notes, 128)], band.chords())),
  ...Object.entries(R).map(([k, r]) => item('r-' + k, 'riff', r, [part(r.slot, r.notes, r.len)], band.riff())),
  ...Object.entries(IDEAS).map(([k, x]) => item('i-' + k, 'idea', x, x.parts, [])),
];

/* ================= round 2: darker and more minimal, each part on its own sound, sounds that move ================= */
// From the round 1 ratings: every part had played on the same pad and bass, so nothing could be judged; the grooves
// liked were the broken, the sparse dub, half time and the straight four, but "very happy electronica" and "bouncing
// along on the beat", not the darker minimal wanted; the basses all alike, and asked for: arps, delayed basses, LFOs,
// pulsing and movement in the sounds. So round 2: darker (minor, a flat sixth and second, nothing bright like the 13),
// fewer open hats on the off-beat (the bounce), more space, and new sounds that move by themselves (MSOUNDS below).
const P0 = id => ALL.find(x => x.id === id).patch;
const ms = (id, role, name, words, patch, x = {}) => ({id, kind: 'synth', engine: x.engine || 'asynth', role, name, words, patch, room: x.room || 0, round: 'm2', music: true,
  alone: [{s: 0, l: role === 'bass' ? 14 : 12, n: midiOf(role === 'bass' ? 'A1' : role === 'chords' ? 'A3' : 'A4'), v: .8}, ...(role === 'chords' ? ['C4', 'E4', 'G4'].map(n => ({s: 0, l: 12, n: midiOf(n), v: .7})) : [])],
  phrase: x.phrase});
// the new sounds, each written for a part here; measured to the same loudness as the lab's sounds when the page is built
export const MSOUNDS = [
  ms('m2pulse', 'bass', 'Pulsing bass', 'A saw and a pulse with a sub under them through the ladder, nearly shut; the LFO opens it on every 16th, so a held note pulses by itself.',
    {w1: 0, w2: 1, pw2: .4, fine2: -5, l1: .6, l2: .4, lsub: .5, ftype: 0, cut: 200, res: .15, fenv: .12, fd: .3, fs: .4, fkey: .3, aa: .004, ad: .6, as: .9, ar: .15, lshape: 0, lsync: 5, lcut: 1.3,
      mode: 1, slop: .3, mids: -6, midf: 1200, tilt: -.3, vdrive: .2, level: .6}, {phrase: T([[0, 14, 'A1', .8], [16, 10, 'A1', .75], [28, 3, 'C2', .6]])}),
  ms('m2echo', 'bass', 'Echo bass', 'FM round made short, into a dark dotted-8th echo: you play one note, the echo answers it twice.',
    {...P0('fmround'), ad: .3, as: .2, ar: .1, emix: .32, etime: 1, efb: .45, etone: .2}, {phrase: T([[2, 2, 'A1', .85], [18, 2, 'A1', .8], [27, 2, 'G1', .6]])}),
  ms('m2sweep', 'bass', 'Slow sweep bass', 'A saw and a sub, the filter swept open and shut by a slow LFO over a bar; notes glide into each other.',
    {w1: 0, w2: 0, fine2: 6, l1: .55, l2: .35, lsub: .6, ftype: 0, cut: 150, res: .25, fenv: .1, fkey: .3, aa: .01, ad: 1, as: 1, ar: .2, lshape: 1, lsync: 1, lcut: 1.6, mode: 2, glide: .07,
      slop: .3, mids: -6, midf: 1100, tilt: -.3, vdrive: .2, level: .6}, {phrase: T([[0, 24, 'A1', .8], [24, 8, 'C2', .7]])}),
  ms('m2random', 'bass', 'Sample-and-hold bass', 'The pulsing bass with its LFO jumping to a new place each 16th: a held note that keeps changing colour, never the same twice.',
    {w1: 0, w2: 1, pw2: .4, fine2: -5, l1: .6, l2: .4, lsub: .45, ftype: 0, cut: 240, res: .28, fenv: .1, fkey: .3, aa: .004, ad: .6, as: .9, ar: .15, lshape: 4, lsync: 5, lcut: 1.4,
      mode: 1, slop: .3, mids: -7, midf: 1200, tilt: -.3, vdrive: .2, level: .58}, {phrase: T([[0, 6, 'A1', .8], [8, 6, 'A1', .7], [16, 6, 'A1', .8], [24, 4, 'G1', .7], [28, 4, 'A1', .6]])}),
  ms('m2dubbass', 'bass', 'Dub bass, echoing', 'The round dub bass you rated, its tail sent into a dark dotted echo.',
    {...P0('dubround'), emix: .25, etime: 1, efb: .4, etone: .2}, {phrase: T([[0, 6, 'A1', .85], [12, 2, 'A1', .6], [16, 6, 'A1', .8], [26, 3, 'F1', .7]])}),
  ms('m2arp', 'lead', 'Dark arp', 'A narrow pulse and a detuned saw, plucked shut low down, into a dotted echo: written to be played as an arpeggio in 16ths.',
    {w1: 1, pw1: .3, w2: 0, fine2: 8, l1: .7, l2: .3, ftype: 1, cut: 480, res: .22, fenv: .5, fd: .12, fs: 0, fkey: .5, aa: .001, ad: .2, as: 0, ar: .15, emix: .3, etime: 1, efb: .5, etone: .3,
      chorus: 1, mids: -7, midf: 1600, tilt: -.3, mode: 0, level: .55}, {room: .1, phrase: T([[0, 1, 'A3', .7], [1, 1, 'C4', .45], [2, 1, 'E4', .5], [3, 1, 'A3', .6], [4, 1, 'C4', .45], [5, 1, 'E4', .5], [6, 1, 'A3', .6], [7, 1, 'C4', .45], [8, 1, 'G4', .5], [16, 1, 'A3', .7], [17, 1, 'C4', .45], [18, 1, 'E4', .5]])}),
  ms('m2keys', 'chords', 'Muted keys', 'A triangle and a sine an octave up, struck and fading, a slow tremolo across the stereo: a muffled electric piano.',
    {w1: 2, w2: 3, oct2: 1, l1: .8, l2: .25, ftype: 1, cut: 1300, res: 0, fenv: .2, fd: .5, fs: .2, aa: .003, ad: 1.4, as: .15, ar: .5, lshape: 1, lrate: 4.5, lamp: .15, lwide: .3,
      chorus: 1, tilt: -.3, mids: -4, midf: 2200, mode: 0, level: .5}, {room: .15}),
  ms('m2throb', 'chords', 'Throbbing chord', 'Two saws, dark, the volume throbbing in 8ths on the LFO: a held chord that pulses with the tempo.',
    {w1: 0, w2: 0, fine2: -8, l1: .6, l2: .5, ftype: 1, cut: 650, res: .1, fenv: .1, fa: .3, fs: .6, aa: .2, ad: 1, as: .9, ar: 1, lshape: 1, lsync: 4, lamp: .8, hpf: 180, chorus: 2, spread: .8,
      mids: -5, midf: 2000, tilt: -.3, mode: 0, level: .45}),
  ms('m2drone', 'chords', 'Low drone', 'A pulse whose width and cutoff wander on a slow random LFO, fading in and out: a dark bed, never the same.',
    {w1: 1, pw1: .5, lpwm: .25, w2: 0, fine2: -5, l1: .6, l2: .35, ftype: 1, cut: 500, res: .1, fenv: 0, lshape: 5, lrate: .15, lcut: .8, aa: 1.5, ad: 1, as: 1, ar: 2.5, hpf: 120, chorus: 2,
      mids: -6, midf: 2000, tilt: -.4, emix: .15, etime: 3, efb: .4, etone: .3, mode: 0, level: .45}, {room: .15}),
  ms('m2dub', 'chords', 'Dub stab, dark', 'A saw and a pulse plucked shut, into a long dark dotted echo: the dub-techno stab.',
    {w1: 0, w2: 1, fine2: -9, l1: .6, l2: .4, ftype: 1, cut: 700, res: .2, fenv: .35, fd: .15, fs: 0, aa: .002, ad: .2, as: 0, ar: .2, hpf: 220, emix: .45, etime: 1, efb: .6, etone: .25,
      chorus: 1, mids: -7, midf: 1400, tilt: -.2, mode: 0, level: .55}, {room: .2}),
];
for (const x of MSOUNDS) { x.phrase ||= x.alone; x.family = x.id; x.parents = []; }
const byS = id => MSOUNDS.find(x => x.id === id) || ALL.find(x => x.id === id);

// a part on any sound (its slot sets its level in the mix)
const p2 = (slot, sound, notes, len, more = {}) => { if (!byS(sound)) throw new Error('no sound ' + sound); return {slot, sound, notes, len, ...more}; };
// darker voicings (no 9ths or 13ths on the minor home; a flat sixth and a flat second for the shadow) and their roots from A
const V2 = {Am: 'A2 E3 A3 C4', Am7: 'A2 G3 C4 E4', Em7: 'E2 D3 G3 B3', G: 'G2 D3 G3 B3', Bbmaj7: 'A#2 F3 A3 D4', Dm7: 'D3 A3 C4 F4', Fadd9: 'F2 C3 G3 A3',
  AmE: 'E2 A2 C3 E3', CE: 'E2 G2 C3 E3', FE: 'E2 F2 A2 C3', Em: 'E2 B2 E3 G3'};
const R2 = {Am: 0, Am7: 0, Em7: -5, Em: -5, G: -2, Bbmaj7: 1, Dm7: 5, Fadd9: -4, AmE: -5, CE: -5, FE: -5};
// a progression struck on `hits` (steps in each bar, `l` long), or held (no hits) and re-struck each chord
function prog2(list, hits, l = 2){ const notes = []; let bar = 0;
  for (const [c, bars] of list) { const ns = V2[c].split(' ').map(midiOf);
    if (!hits) for (const n of ns) notes.push({s: bar*16, l: bars*16 - 1, n, v: .7});
    else for (let b = 0; b < bars; b++) for (const h of hits) for (const n of ns) notes.push({s: (bar + b)*16 + h, l, n, v: .62});
    bar += bars; }
  return {notes, len: bar*16, roots: list.flatMap(([c, bars]) => Array(bars).fill(R2[c]))}; }

/* ---------- grooves: each on its own kit ---------- */
const G2 = {
  deepfour: {name: 'Deep four, dark hats', words: 'The kick on every beat, but no open hat on the off-beat (the bounce): soft closed 16ths leaning on the last of each beat, a rim far apart. On the deep kit, the darker real hats.',
    kit: {kick: 'kitdeep2', hats: 'realsoft', perc: 'rimdry'}, rows: {kick: 'X...x...x...x...X...x...x...x...', chh: 'g.go'.repeat(8), rim: '..........x...............x..g..'}},
  brokendub: {name: 'Broken dub', words: 'Your two liked ones together: the broken kick with the dub\'s space, the rim off the backbeat, one open hat in two bars.',
    kit: {kick: 'kitdeep2', hats: 'realpair', perc: 'rimdry'}, rows: {kick: 'X.....x...x.....X.......x..x....', chh: '..g...g...g...g...g...g...g...g.', ohh: '......................o.........', rim: '.......x.......o.......x......o.'}},
  halfdark: {name: 'Half time, heavy', words: 'Half time again, with a soft snare on the 3 (the half-time backbeat), hats in quiet 16ths, a low tom ghosting.',
    kit: {kick: 'kitmine', hats: 'realsoft', perc: 'tomsdry', snare: 'ghost2'}, rows: {kick: 'X.........x.....X.......x.x.....', snare: '........x...............x.......', chh: 'g.o.'.repeat(8), tomL: '.............g...............g..'}},
  stutter: {name: 'Stutter', words: 'Radiohead\'s electronic side: a kick that stumbles, hats in uneven clusters, rim clicks where you don\'t expect them, a ghost snare.',
    kit: {kick: 'kitdeep2', hats: 'realshort', perc: 'rimdry', snare: 'ghost2'}, rows: {kick: 'X..x....x.x.....X...x..x..x.....', chh: 'x..g.x..g..x.g...x..g.x...g.x..g', rim: 'o......x.....o.....x......o.....', snare: '............o...............x...'}},
  straightdark: {name: 'Straight four, no bounce', words: 'The straight four you liked, on its own: the hats short and soft, the shaker in quiet 16ths, a low tom rolling into the next bar.',
    kit: {kick: 'kitmine', hats: 'realshort', perc: 'tomsdry'}, rows: {kick: 'X...x...x...x...X...x...x...x...', chh: '..o...o...o...o...o...o...o...o.', shaker: 'g.gog.gog.gog.go'.repeat(2), tomL: '..........................g.o.x.'}},
  ghostdark: {name: 'Ghosts, darker', words: 'Four with ghosts, which you liked but found happy: the hats\' accents moved off the and (where the bounce is) onto the e, quieter, the toms gone, the deep kit.',
    kit: {kick: 'kitdeep2', hats: 'realpair'}, rows: {kick: 'X...x...x...x...X...x...x...x..g', chh: 'gogggogggogggoggg.ogg.ogggogg.og'}},
  space: {name: 'Kick and space', words: 'Four bars, mostly space: the kick on the 1 and the and of 2, a rim answering in the gap, the hats only in the fourth bar.', bars: 4,
    kit: {kick: 'kitdeep2', hats: 'realsoft', perc: 'rimdry'}, rows: {kick: 'X.....x.........X.....x.........X.....x.........X.....x.....g...', rim: '...........o...............o...............o..........x....o....', chh: '................................................g.o.g.o.g.o.g.o.'}},
  tomsslow: {name: 'Toms, slow roll', words: 'Four on the floor under low toms every three 16ths, soft: the polyrhythm of round 1\'s toms, lower and calmer, no hats on the off-beat.',
    kit: {kick: 'kitdeep2', hats: 'realsoft', perc: 'tomsdry'}, rows: {kick: 'X...x...x...x...X...x...x...x...', tomL: 'o..g..o..g..o..g..o..g..o..g..o.', chh: 'g...g...g...g...g...g...g...g...'}},
};
function grooveParts2(g){ const len = (g.bars || 2)*16, by = {};
  for (const [v, row] of Object.entries(g.rows)) (by[SLOT_OF[v]] ||= {})[v] = row;
  return Object.entries(by).map(([slot, r]) => p2(slot, g.kit[slot] || g.kit.kick, D(r), len)); }

/* ---------- bass lines: each on its own sound ---------- */
const B2 = {
  pulse: {name: 'Pulsing root', words: 'Hardly a line: the root held through the bar, the sound pulsing in 16ths by itself, a step up to C at the end.', sound: 'm2pulse', notes: T([[0, 14, 'A1', .8], [16, 10, 'A1', .75], [28, 3, 'C2', .6]]), len: 32},
  echo: {name: 'Delayed bass', words: 'Three notes, the dotted-8th echo answering each: the rhythm comes from the delay.', sound: 'm2echo', notes: T([[2, 2, 'A1', .85], [18, 2, 'A1', .8], [27, 2, 'G1', .6]]), len: 32},
  sweep: {name: 'Slow sweep', words: 'One long note gliding up to C, its filter opening and closing over the bar.', sound: 'm2sweep', notes: T([[0, 24, 'A1', .8], [24, 8, 'C2', .7]]), len: 32},
  random: {name: 'Sample and hold', words: 'Held notes whose colour jumps each 16th, never the same twice.', sound: 'm2random', notes: T([[0, 6, 'A1', .8], [8, 6, 'A1', .7], [16, 6, 'A1', .8], [24, 4, 'G1', .7], [28, 4, 'A1', .6]]), len: 32},
  arp: {name: 'Arpeggiated bass', words: 'The minor chord broken into 16ths with gaps, low and short, on the FM round: an arp in the bass.', sound: 'fmshort',
    notes: T([[0, 1, 'A1', .85], [2, 1, 'E2', .55], [3, 1, 'A1', .6], [5, 1, 'C2', .6], [7, 1, 'E2', .5], [8, 1, 'A1', .75], [10, 1, 'G2', .5], [11, 1, 'A1', .55], [13, 1, 'C2', .6], [14, 1, 'E2', .5]]), len: 16},
  dub: {name: 'Dub, falling to F', words: 'The dub bass you rated, echoing, falling to the flat sixth at the end of the phrase: darker.', sound: 'm2dubbass', notes: T([[0, 6, 'A1', .85], [12, 2, 'A1', .6], [16, 6, 'A1', .8], [26, 3, 'F1', .7]]), len: 32},
  phryg: {name: 'Phrygian', words: 'The root and the note a semitone above it (B flat): the darkest step in the scale.', sound: 'fmround', notes: T([[2, 3, 'A1', .85], [8, 2, 'A1', .6], [14, 2, 'A#1', .65], [18, 3, 'A1', .85], [24, 2, 'A1', .6], [30, 2, 'G1', .6]]), len: 32},
  walkdown: {name: 'Walking down', words: 'You liked walking up: this walks down, A, G, F, E, two beats each, on the FM wood.', sound: 'fmwood',
    notes: T([[0, 3, 'A1'], [4, 3, 'A1', .6], [8, 3, 'G1', .72], [12, 3, 'G1', .6], [16, 3, 'F1', .75], [20, 3, 'F1', .6], [24, 3, 'E1', .72], [28, 3, 'G1', .6]]), len: 32},
};
/* ---------- progressions: each on its own sound, eight bars ---------- */
const C2 = {
  fall: {name: 'Falling', words: 'A minor 7, G, F: down the scale, struck off the beat on the muted keys.', sound: 'm2keys', list: [['Am7', 2], ['G', 2], ['Fadd9', 4]], hits: [0, 6, 10], l: 3},
  phryg: {name: 'Phrygian shadow', words: 'A minor and B flat major 7, a semitone above: the darkest move there is, on the low drone.', sound: 'm2drone', list: [['Am', 2], ['Bbmaj7', 2], ['Am', 2], ['Bbmaj7', 2]]},
  throb: {name: 'Throbbing minor', words: 'A minor 7 for four bars, E minor 7 for four, held, the chord throbbing in 8ths by itself.', sound: 'm2throb', list: [['Am7', 4], ['Em7', 4]]},
  dub: {name: 'Dub stabs, i and iv', words: 'A minor 7 and D minor 7 as dub stabs on the off-beat, the echo filling the space.', sound: 'm2dub', list: [['Am7', 2], ['Dm7', 2], ['Am7', 2], ['Dm7', 2]], hits: [2, 11], l: 1},
  minorv: {name: 'Minor four, minor five', words: 'D minor 7, E minor 7, home to A minor 7: minor all the way, on the poly synth\'s pulsing pad.', sound: 'nppad', list: [['Dm7', 2], ['Em7', 2], ['Am7', 4]]},
  pedal: {name: 'Shadow pedal', words: 'E held in the bass under A minor, C and F above it (the F rubbing against the E), on the softer gated pad.', sound: 'gatedsoft', list: [['AmE', 2], ['CE', 2], ['FE', 2], ['AmE', 2]]},
};
const cp = c => prog2(c.list, c.hits, c.l);
/* ---------- riffs: each on its own sound ---------- */
const R2R = {
  arp16: {name: 'Dark arp', words: 'The minor chord in 16ths, three notes against four, the top note moving once a bar; its echo doubling it.', sound: 'm2arp',
    notes: T([[0, 1, 'A3', .7], [1, 1, 'C4', .45], [2, 1, 'E4', .5], [3, 1, 'A3', .6], [4, 1, 'C4', .45], [5, 1, 'E4', .5], [6, 1, 'A3', .6], [7, 1, 'C4', .45], [8, 1, 'E4', .5], [9, 1, 'A3', .6], [10, 1, 'C4', .45], [11, 1, 'G4', .5], [12, 1, 'A3', .6], [13, 1, 'C4', .45], [14, 1, 'E4', .5], [15, 1, 'C4', .4]]), len: 16},
  arpup: {name: 'Rising arp, two bars', words: 'Up and down A minor 7 in 8ths, then F major 7 over the same A: two bars that turn darker.', sound: 'm2arp',
    notes: T([[0, 1, 'A3', .7], [2, 1, 'C4', .5], [4, 1, 'E4', .55], [6, 1, 'G4', .5], [8, 1, 'A4', .6], [10, 1, 'G4', .45], [12, 1, 'E4', .5], [14, 1, 'C4', .45], [16, 1, 'F3', .7], [18, 1, 'A3', .5], [20, 1, 'C4', .55], [22, 1, 'E4', .5], [24, 1, 'F4', .6], [26, 1, 'E4', .45], [28, 1, 'C4', .5], [30, 1, 'A3', .45]]), len: 32},
  keys: {name: 'One note, pulsing', words: 'The muted keys on one note in 8ths, the note under it moving: the top stays, the shadow changes.', sound: 'm2keys',
    notes: T([[0, 2, 'C4', .55], [0, 2, 'E3', .45], [4, 2, 'C4', .45], [8, 2, 'C4', .5], [8, 2, 'F3', .45], [12, 2, 'C4', .42], [16, 2, 'C4', .55], [16, 2, 'G3', .45], [20, 2, 'C4', .45], [24, 2, 'C4', .5], [24, 2, 'E3', .42], [28, 2, 'B3', .45]]), len: 32},
  bell: {name: 'Bell, sparse', words: 'Three notes of the shorter poly bell over two bars, falling, with a lot of space.', sound: 'npbell2', notes: T([[0, 2, 'E5', .6], [11, 2, 'D5', .5], [22, 3, 'A4', .55]]), len: 32},
  blips: {name: 'Blips off the grid', words: 'Soft blips on the odd 16ths, never on a beat, high and few.', sound: 'blipsoft', notes: T([[3, 1, 'A5', .5], [6, 1, 'E5', .4], [13, 1, 'G5', .45], [19, 1, 'A5', .5], [25, 1, 'C6', .4], [30, 1, 'E5', .35]]), len: 32},
  marimba: {name: 'Marimba, low', words: 'The FM marimba you chose, an octave lower and darker: five notes a bar round the low A.', sound: 'fmmarimba', notes: T([[0, 1, 'A3', .7], [3, 1, 'C4', .5], [6, 1, 'E3', .55], [10, 1, 'A3', .6], [14, 1, 'G3', .5]]), len: 16},
  stab: {name: 'One stab, echoing', words: 'A single dub stab of A minor 7 a bar, on the and of one, the echo doing the rest.', sound: 'm2dub', notes: T([[2, 1, 'A3', .6], [2, 1, 'C4', .55], [2, 1, 'E4', .55], [2, 1, 'G4', .5]]), len: 16},
  pluck: {name: 'Dark pluck', words: 'The darker poly pluck: a short figure that leaves the bar\'s end empty.', sound: 'nppluck2', notes: T([[0, 1, 'A4', .6], [2, 1, 'A4', .4], [5, 1, 'C5', .5], [8, 1, 'E4', .5], [11, 1, 'G4', .45]]), len: 16},
};
/* ---------- the band, round 2: plain and dark, never the pad ---------- */
const K2 = {kick: D({kick: 'X...x...x...x...'}), hats: D({chh: '..g...g...g...g.'})};
const kick2 = () => p2('kick', 'kitdeep2', K2.kick, 16), hats2 = () => p2('hats', 'realsoft', K2.hats, 16);
const band2 = {
  // under a groove: the pulsing bass alone (no chord)
  groove: () => [p2('bass', 'm2pulse', B2.pulse.notes, 32, {level: .85})],
  // under a bass line: the kick and soft hats
  bass: () => [kick2(), hats2()],
  // under a progression: kick, hats and the roots on a short bass
  chords: c => [kick2(), hats2(), p2('bass', 'fmshort', follow(T([[0, 6, 'A1', .8], [10, 2, 'A1', .55]]), 16, cp(c).roots), 128)],
  // under a riff: kick, hats, the pulsing bass and the drone low in the mix
  riff: () => [kick2(), hats2(), p2('bass', 'm2pulse', B2.pulse.notes, 32, {level: .8}), p2('chords', 'm2drone', prog2([['Am', 8]]).notes, 128, {level: .55})],
};
/* ---------- ideas, round 2: each its own sounds ---------- */
// {g: groove, b: bass line (follows the chords' roots unless `stay`), c: progression, r: riff, from: {drums, bass, chords, riff} bars}
function idea2(name, words, {g, b, c, r, stay, from = {}, lv = {}}){ const P = cp(C2[c]), parts = [...grooveParts2(G2[g]).map(x => ({...x, from: from.drums || 0})),
    p2('bass', B2[b].sound, stay ? B2[b].notes : follow(B2[b].notes, B2[b].len, P.roots), stay ? B2[b].len : P.len, {from: from.bass || 0, level: lv.bass}),
    p2('chords', C2[c].sound, P.notes, P.len, {from: from.chords || 0, level: lv.chords ?? .8}),
    r ? p2('lead', R2R[r].sound, R2R[r].notes, R2R[r].len, {from: from.riff || 0, level: lv.riff}) : null].filter(Boolean);
  return {name, words, parts, bars: 8}; }
const IDEAS2 = {
  eraser: idea2('Eraser', 'What Thom Yorke might write: the stuttering drums, the pulsing bass under A minor and B flat, the drone, blips off the grid from bar 3.', {g: 'stutter', b: 'pulse', c: 'phryg', r: 'blips', from: {riff: 2}}),
  deepdub: idea2('Deep dub', 'The broken dub groove, the dub bass echoing, dub stabs of A minor and D minor 7 on the off-beat, the bell coming in at bar 5.', {g: 'brokendub', b: 'dub', c: 'dub', r: 'bell', from: {riff: 4}}),
  shadow: idea2('Pulse and shadow', 'The deep four, the pulsing bass, the throbbing chord from A minor to E minor, the dark arp at bar 5: everything moving by itself.', {g: 'deepfour', b: 'pulse', c: 'throb', r: 'arp16', from: {riff: 4}, lv: {riff: .8}}),
  halflight: idea2('Half light', 'Half time, heavy, the slow sweep bass following the muted keys falling A minor, G, F, the dark pluck from bar 3.', {g: 'halfdark', b: 'sweep', c: 'fall', r: 'pluck', from: {riff: 2}}),
  build: idea2('Building, no bounce', 'Grows over eight bars: the pulsing pad first, the straight four at bar 3, the delayed bass at bar 5, the low marimba at bar 7.', {g: 'straightdark', b: 'echo', c: 'minorv', r: 'marimba', from: {drums: 2, bass: 4, riff: 6}}),
  night: idea2('Night drive', 'The darker ghosts, the arpeggiated bass through A minor 7 and E minor 7, the throbbing chord, one dub stab a bar from bar 3.', {g: 'ghostdark', b: 'arp', c: 'throb', r: 'stab', from: {riff: 2}, lv: {chords: .6}}),
};
const MUSIC2 = [
  ...Object.entries(IDEAS2).map(([k, x]) => item('i-' + k, 'idea', x, x.parts, [], 'm2')),
  ...Object.entries(G2).map(([k, g]) => item('g-' + k, 'groove', g, grooveParts2(g), band2.groove(), 'm2')),
  ...Object.entries(B2).map(([k, b]) => item('b-' + k, 'bass', b, [p2('bass', b.sound, b.notes, b.len)], band2.bass(), 'm2')),
  ...Object.entries(C2).map(([k, c]) => item('c-' + k, 'chords', {...c, bars: 8}, [p2('chords', c.sound, cp(c).notes, 128)], band2.chords(c), 'm2')),
  ...Object.entries(R2R).map(([k, r]) => item('r-' + k, 'riff', r, [p2('lead', r.sound, r.notes, r.len)], band2.riff(), 'm2')),
];
export const MUSIC = [...MUSIC1, ...MUSIC2], MROUNDS = {m1: MUSIC1, m2: MUSIC2};

export const MGROUPS = [['idea', 'Ideas: the parts together'], ['groove', 'Drum grooves'], ['bass', 'Bass lines'], ['chords', 'Chord progressions'], ['riff', 'Riffs']];
