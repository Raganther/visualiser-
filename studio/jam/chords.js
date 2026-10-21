// Studio Jam's chord library: keys and modes, the chords that fit them (the matrix: a row a degree, a column a kind),
// how smoothly one chord moves to another (shared notes held, the rest by the nearest step), chord names, and a library
// of progressions grouped by feel, written in A and moved to any key. Everything here is voice-led when it plays (vlChain
// in model.js), so any chord follows any other smoothly.
import { Q } from '../lib/palette.js';

export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// a note named as the key spells it: sharps in the sharp keys (counting from the mode's own), flats in the rest
const BRIGHT = ['major', 'lydian', 'mixolydian'];
export const spell = (pc, key = 'A', mode = 'minor') => { const k = PC[key] ?? 9, rel = BRIGHT.includes(mode) ? k : (k + 3) % 12;   // (a minor-ish key spells as its relative major)
  return ([0, 7, 2, 9, 4, 11, 6, 1].includes(rel) ? SHARP : FLAT)[((pc % 12) + 12) % 12]; };
const PC = Object.fromEntries([...KEYS.map((k, i) => [k, i]), ['Db', 1], ['D#', 3], ['Gb', 6], ['G#', 8], ['A#', 10]]);
export const MODES = {minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10]};
export const MODE_WORDS = {minor: 'dark, at home', dorian: 'minor with a lift', phrygian: 'dark, Spanish, tense', major: 'bright', lydian: 'floating, dreamy', mixolydian: 'major, laid back'};
// the matrix's columns: each the first of its qualities that fits the degree
export const COLS = [['7th', ['m7', 'maj7']], ['9th', ['m9', 'maj9', 'dom9']], ['add 9', ['madd9', 'add9']], ['colour', ['m11', 'lyd', '69', 'm6', '13']],
  ['sus2', ['sus2']], ['sus4', ['sus4', '7sus']], ['open', ['q', 'five']], ['ø', ['m7b5', 'dim']]];
const QN = {m9: 'minor 9', m7: 'minor 7', m11: 'minor 11', madd9: 'minor add 9', m6: 'minor 6', maj9: 'major 9', maj7: 'major 7', '69': '6/9', add9: 'add 9',
  lyd: 'lydian', dom9: '9', '13': '13', sus2: 'sus2', sus4: 'sus4', '7sus': '7sus4', q: 'in fourths', five: 'open fifths', dim: 'half-diminished 9', m7b5: 'half-diminished'};
const QS = {m9: 'm9', m7: 'm7', m11: 'm11', madd9: 'm(add9)', m6: 'm6', maj9: 'maj9', maj7: 'maj7', '69': '6/9', add9: 'add9', lyd: 'maj7♯11', dom9: '9', '13': '13',
  sus2: 'sus2', sus4: 'sus4', '7sus': '7sus4', q: '⁴', five: '⁵', dim: 'ø9', m7b5: 'ø'};

const parse = sym => { const [n, q] = sym.split(':'); return {pc: PC[n], q}; };
// a chord's notes as pitch classes
export const pcs = sym => { const {pc, q} = parse(sym); return [...new Set(Q[q].map(t => (pc + t) % 12))]; };
export const nameOf = sym => { const [n, q] = sym.split(':'); return `${n.replace('#', '♯').replace(/b$/, '♭')} ${QN[q] || q}`; };
export const shortOf = sym => { const [n, q] = sym.split(':'); return n.replace('#', '♯').replace(/b$/, '♭') + (QS[q] ?? q); };
// how far one chord moves to the next: each note to the nearest of the other's (both ways), on average, in semitones;
// 0 the same notes, under 1 smooth (shared notes held, the rest a step), past 2 a leap
export function distance(a, b){ const A = pcs(a), B = pcs(b), d = (x, y) => Math.min(...y.map(p => { const k = Math.abs(x - p) % 12; return Math.min(k, 12 - k); }));
  return (A.reduce((s, x) => s + d(x, B), 0) + B.reduce((s, x) => s + d(x, A), 0))/(A.length + B.length); }
export const shared = (a, b) => { const B = pcs(b); return pcs(a).filter(p => B.includes(p)).length; };

// the matrix for a key and mode: a row a degree (its numeral and root), a cell a column's chord that fits the scale
export function matrix(key, mode){ const k = PC[key] ?? 9, sc = MODES[mode].map(i => (k + i) % 12);
  return MODES[mode].map((iv, d) => { const root = (k + iv) % 12, name = spell(root, key, mode), third = (MODES[mode][(d + 2) % 7] - iv + 12) % 12;
    const num = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'][d], fits = q => Q[q].every(t => sc.includes((root + t) % 12));
    return {d, root, numeral: third === 4 ? num.toUpperCase() : num, cells: COLS.map(([, qs]) => { const q = qs.find(fits); return q ? `${name}:${q}` : null; })}; }); }
// a chord moved by semitones (the key's spelling)
export const transpose = (sym, n, key, mode) => { const {pc, q} = parse(sym); return `${spell(pc + n + 12, key, mode)}:${q}`; };
export const keyOf = sym => KEYS[parse(sym).pc];

// the library: progressions in A, each chord with its bars, grouped by feel
const P = (id, feel, name, words, list, mode = 'minor') => ({id: 'lib-' + id, feel, name, words, mode, bars: list.flatMap(([s, n]) => Array(n).fill(s))});
export const FEELS = [['still', 'Still'], ['drift', 'Drifting'], ['lift', 'Lifting'], ['dark', 'Dark'], ['tense', 'Tense and back']];
export const LIB = [
  P('deep', 'still', 'One chord, deep', 'A minor 9 for eight bars: all the movement in the rhythm.', [['A:m9', 8]]),
  P('colour', 'still', 'Pedal, the colour moving', 'The same A underneath, the top opening from 9 to 11.', [['A:m9', 2], ['A:m11', 2]], 'dorian'),
  P('susbreath', 'still', 'Sus breath', 'Suspended on A, the 2 and the 4 taking turns: no third, nothing settles.', [['A:sus2', 2], ['A:sus4', 2]]),
  P('open', 'still', 'Open fifths to fourths', 'Bare and hypnotic: open fifths, then the same root in stacked fourths.', [['A:five', 4], ['A:q', 4]]),
  P('twomin', 'drift', 'Two minors', 'A minor 9 and E minor 9 rocking: a fifth apart, sharing two notes.', [['A:m9', 2], ['E:m9', 2]], 'dorian'),
  P('dorswing', 'drift', 'Dorian swing', 'The minor home and the bright IV of dorian: the classic deep-house lift.', [['A:m9', 2], ['D:dom9', 2]], 'dorian'),
  P('downtone', 'drift', 'Down a tone', 'A minor 9 to G major 9 and back: gentle, endless.', [['A:m9', 2], ['G:maj9', 2]], 'dorian'),
  P('aeolian', 'drift', 'Aeolian loop', 'i, VI, III, VII: the minor loop half of electronic music rides on, in ninths.', [['A:m9', 2], ['F:maj9', 2], ['C:add9', 2], ['G:add9', 2]]),
  P('lowslow', 'drift', 'Low and slow', 'Home and the VI: a soft fall and back.', [['A:m9', 2], ['F:maj7', 2]]),
  P('picardy', 'lift', 'Minor to major', 'The same root turning bright: A minor 9 opens into A add 9.', [['A:m9', 2], ['A:add9', 2]]),
  P('lydian', 'lift', 'Lydian float', 'A major 9 into its raised 4th: hanging in the air.', [['A:maj9', 2], ['A:lyd', 2]], 'lydian'),
  P('rise', 'lift', 'The rise', 'Climbing the scale a chord a bar, then home: a build in harmony.', [['A:m7', 1], ['C:maj7', 1], ['D:m9', 1], ['E:m7', 1], ['F:maj9', 2], ['G:add9', 2]]),
  P('susrise', 'lift', 'Suspended rise', 'Sus2 chords stepping up: open and hopeful, never quite landing.', [['A:sus2', 2], ['C:sus2', 2], ['D:sus2', 2], ['F:sus2', 2]]),
  P('mixo', 'lift', 'Mixolydian sun', 'A 6/9 and G add 9: bright but laid back.', [['A:69', 2], ['G:add9', 2]], 'mixolydian'),
  P('phryg', 'dark', 'Phrygian shadow', 'Three bars home, one on the flat II: the shadow that makes minimal techno tense.', [['A:m7', 3], ['Bb:maj7', 1]], 'phrygian'),
  P('halfdim', 'dark', 'Diminished breath', 'A minor 9 and the half-diminished II: a sigh, then home.', [['A:m9', 2], ['B:m7b5', 2]]),
  P('elevens', 'dark', 'Eleven and six', 'A minor 11 and F major 7, long: heavy and wide.', [['A:m11', 4], ['F:maj7', 4]]),
  P('fourths', 'dark', 'Fourths down', 'Stacked fourths on A, then on E: hollow and modern.', [['A:q', 2], ['E:q', 2]]),
  P('shimmer', 'tense', 'Whole-step shimmer', 'Up a tone to B minor 9 and back: a lift that wants home.', [['A:m9', 2], ['B:m9', 2]], 'dorian'),
  P('semi', 'tense', 'A semitone up and back', 'A minor 9 to B♭ major 7: the flat II as a jolt, then home.', [['A:m9', 3], ['Bb:maj7', 1]]),
  P('outhome', 'tense', 'Out and home', 'A step outside to C 9 (borrowed), then back: tension and release in four bars.', [['A:m9', 2], ['C:dom9', 1], ['A:m9', 1]]),
  P('tritone', 'tense', 'Tritone visit', 'The farthest place from home, E♭ major 7, for one bar.', [['A:m9', 3], ['Eb:maj7', 1]]),
  P('fifth', 'tense', 'The V comes back', 'Minor home and the E 7sus4 pulling back to it.', [['A:m9', 3], ['E:7sus', 1]]),
];
// a progression moved to a key (its own written in A)
export const inKey = (H, key) => { const n = ((PC[key] ?? 9) - 9 + 12) % 12; return n ? {...H, id: `${H.id}@${key}`, bars: H.bars.map(s => transpose(s, n, key, H.mode)), key} : {...H, key: 'A'}; };
