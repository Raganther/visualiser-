// The music side of the sound lab: musical parts to like or not, as the sounds were: drum grooves, bass lines, chord
// progressions and riffs, and ideas (the parts together, a few bars of a piece). Every part plays on the user's own
// palette sounds (their liked sounds with their edits), so only the music changes; each is heard alone or with the band
// (the same plain backing every time, so a part is judged in context). All in A; the page's tempo sets the speed.
// A part: {slot, sound (a lab sound id), notes ([{s, v, vel}] a drum's, [{s, l, n, v}] a synth's), len (16ths), from
// (the bar it comes in), swing (0..1 of a 16th: the off 16ths late)}.
import { midiOf } from '../lib/names.js';
import { rows } from './sounds.js';

export const MROUND = 1;
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
const item = (id, kind, x, own, withBand) => ({id: 'm1-' + id, kind: 'music', mkind: kind, round: 'm1', role: kind, name: x.name, words: x.words, bars: x.bars || Math.max(...own.map(p => p.len))/16, own, band: withBand});
export const MUSIC = [
  ...Object.entries(G).map(([k, g]) => item('g-' + k, 'groove', g, grooveParts(g), band.groove())),
  ...Object.entries(B).map(([k, b]) => item('b-' + k, 'bass', b, [part('bass', b.notes, b.len)], band.bass())),
  ...Object.entries(C).map(([k, c]) => item('c-' + k, 'chords', {...c, bars: 8}, [part('chords', prog(c.list).notes, 128)], band.chords())),
  ...Object.entries(R).map(([k, r]) => item('r-' + k, 'riff', r, [part(r.slot, r.notes, r.len)], band.riff())),
  ...Object.entries(IDEAS).map(([k, x]) => item('i-' + k, 'idea', x, x.parts, [])),
];
export const MGROUPS = [['idea', 'Ideas: the parts together'], ['groove', 'Drum grooves'], ['bass', 'Bass lines'], ['chords', 'Chord progressions'], ['riff', 'Riffs']];
