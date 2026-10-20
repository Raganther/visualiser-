// Pack 2 for Studio Jam, the contrast pack: what pack 1 doesn't have. Deeper, darker basses (a sub, a bowed string, a
// Reese), percussion going round in fives, sevens, nines and elevens, the new native bodies (bowed metal, a glass
// harmonica, singing bowls, a gong, log drums), and harmonies that hardly move. Usage: node studio/jam/pack2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { mutate } from './model.js';
import { GOOD_KICK } from '../lib/palette.js';
import { rng } from '../lib/rng.js';

/* ---------- sounds ---------- */
const kit = (k, over = {}) => ({kit: k, over});
// every percussion sound maps all the percussion voices, so any clip plays on any of them
const PERC = (m) => ({tomL: {native: 'tom', n: 41}, tomH: {native: 'tom', n: 48}, wood: {native: 'wood', n: 74}, metal: {native: 'plate', n: 86, set: {ring: .4}},
  rim: kit('Minimal', {rim: {level: .4, tone: .5, pan: .35}}), shaker: {native: 'shaker', n: 60}, clave: {native: 'wood', n: 86},
  bowl: {native: 'bowl', n: 69}, gong: {native: 'gong', n: 45, set: {hard: .3}}, log: {native: 'logdrum', n: 50}, logH: {native: 'logdrum', n: 57}, ...m});
const SOUNDS = [
  {id: 'k2-deep', role: 'kick', name: 'Deep skin', words: 'Native: a big skin, lower and longer than pack 1’s.', voices: {kick: {native: 'kick', n: 29, set: {decay: .6, body: .7, hard: .35}}}},
  {id: 'k2-dub', role: 'kick', name: 'Dub kick', words: 'Round, with a long boom under it.', voices: {kick: kit('Minimal', {kick: {...GOOD_KICK, tune: -4, decay: 1.5, drive: 0, tone: .25}})}},
  {id: 'k2-tight', role: 'kick', name: 'Tight kick', words: 'Native: short and dry, leaves room for the sub.', voices: {kick: {native: 'kick', n: 36, set: {decay: .22, drop: 2.2, hard: .6, body: .3}}}},
  {id: 'h2-tight', role: 'hats', name: 'Tight native hats', words: 'Native: very short ticks.', voices: {chh: {native: 'hat', n: 60, set: {decay: .035, tone: .7}}, ohh: {native: 'hat', n: 60, set: {decay: .12, tone: .5}}, ride: {native: 'bowl', n: 96, set: {hard: .75, ring: .4}}}},
  {id: 'h2-shake', role: 'hats', name: 'Shaker hats', words: 'Native shakers playing the hats’ part, a bowl’s ping for the ride.', voices: {chh: {native: 'shaker', n: 60}, ohh: {native: 'shaker', n: 62}, ride: {native: 'glass', n: 93, set: {hard: .5}}}},
  {id: 'p2-bowls', role: 'perc', name: 'Bowls and logs', words: 'Native: toms, log drums, struck bowls and a gong.', voices: PERC({})},
  {id: 'p2-hands', role: 'perc', name: 'Hands and metal', words: 'Native: hand drums, the plate, bowls higher.', voices: PERC({tomL: {native: 'hand', n: 48}, tomH: {native: 'hand', n: 55}, log: {native: 'hand', n: 43, set: {decay: .5}}, logH: {native: 'hand', n: 60}, bowl: {native: 'bowl', n: 76}})},
  {id: 'p2-iron', role: 'perc', name: 'Iron', words: 'Native: everything metal: plates, gongs, bowls.', voices: PERC({tomL: {native: 'gong', n: 52, set: {ring: .3}}, tomH: {native: 'plate', n: 64}, wood: {native: 'plate', n: 79, set: {ring: .3}}, log: {native: 'bowl', n: 57, set: {ring: .4}}, logH: {native: 'bowl', n: 64, set: {ring: .4}}})},
  {id: 'b2-sub', role: 'bass', name: 'Deep sub', words: 'Native: a sine dropping into its note, warmed by drive. Tone is the drive.', src: {native: 'sub808', shift: -12}},
  {id: 'b2-bowed', role: 'bass', name: 'Bowed low string', words: 'Native: a bow on a low string, rough and woody.', src: {native: 'bowed', shift: -12}},
  {id: 'b2-reese', role: 'bass', name: 'Dark Reese', words: 'Two saws beating against each other, filtered dark.', src: {palette: 'reese'}},
  {id: 'b2-fmdark', role: 'bass', name: 'Dark FM', words: 'Native FM, soft and long.', src: {native: 'fmround', shift: -12}},
  {id: 'b2-log', role: 'bass', name: 'Log bass', words: 'Native: a big log drum, pitched.', src: {native: 'logdrum', shift: -12}},
  {id: 'c2-bowmetal', role: 'chords', name: 'Bowed metal', words: 'Native: a plate bowed, its modes beating. Dark and shimmering.', src: {native: 'bowmetal'}},
  {id: 'c2-glass', role: 'chords', name: 'Glass harmonica', words: 'Native: wet glass rubbed, nearly pure.', src: {native: 'glassharm'}},
  {id: 'c2-strings', role: 'chords', name: 'Bowed strings', words: 'Native: bowed strings, a section of them.', src: {native: 'bowed'}},
  {id: 'c2-dark', role: 'chords', name: 'Dark stab', words: 'A dub chord filtered low, for the echo.', src: {palette: 'darkStab'}},
  {id: 'c2-bowlpad', role: 'chords', name: 'Rubbed bowls', words: 'Native: singing bowls rubbed round the rim, beating slowly.', src: {native: 'rubbowl'}},
  {id: 'l2-glass', role: 'lead', name: 'Glass harmonica', words: 'Native: one glass, rubbed.', src: {native: 'glassharm'}},
  {id: 'l2-bowl', role: 'lead', name: 'Singing bowl', words: 'Native: struck, rings for ever.', src: {native: 'bowl'}},
  {id: 'l2-gong', role: 'lead', name: 'Gong', words: 'Native: its upper modes swelling in after the strike.', src: {native: 'gong', shift: -12}},
  {id: 'l2-bowmetal', role: 'lead', name: 'Bowed metal', words: 'Native: one bowed plate.', src: {native: 'bowmetal'}},
  {id: 'l2-log', role: 'lead', name: 'Log drum', words: 'Native: a slit drum, hollow.', src: {native: 'logdrum'}},
  {id: 'l2-fmbell', role: 'lead', name: 'FM bell', words: 'Native FM: a glassy bell.', src: {native: 'fmbell'}},
];

/* ---------- clips ---------- */
const P = (str, voice) => [...str].map((c, i) => c === '.' ? null : [i, voice, c === 'X' ? 1 : c === 'o' ? .45 : .8]).filter(Boolean);
const every = (len, n, o, f) => { const out = []; for (let s = o, j = 0; s < len; s += n, j++) out.push(f(s, j)); return out; };
const clip = (id, role, name, len, steps, more = {}) => ({id, role, name, len, steps: steps.sort((a, b) => a[0] - b[0]), ...more});
const bars = (strs, voice) => strs.flatMap((s, b) => P(s, voice).map(x => [x[0] + 16*b, x[1], x[2]]));
const CLIPS = [
  // kick
  clip('k2-four', 'kick', 'Four, one missing', 64, bars(['X...x...x...x...', 'X...x...x...x...', 'X...x...x...x...', 'X...x.......x...'], 'kick')),
  clip('k2-332', 'kick', '3 + 3 + 2', 16, P('X..x..x.X..x..x.', 'kick')),
  clip('k2-sparse', 'kick', 'Sparse', 32, bars(['X.........x.....', '......x.........'], 'kick')),
  clip('k2-dubtail', 'kick', 'One and the and', 16, P('X.......X.x.....', 'kick')),
  clip('k2-pulse', 'kick', 'Plain four', 16, P('X...x...x...x...', 'kick')),
  // hats
  clip('h2-fives', 'hats', 'In fives', 5, [[0, 'chh', .8], [3, 'chh', .4]]),
  clip('h2-sevens', 'hats', 'In sevens', 7, [[0, 'chh', .85], [2, 'chh', .35], [4, 'chh', .5]]),
  clip('h2-gaps', 'hats', '16ths with gaps', 16, P('x.ox.x.oxx.o.x.o', 'chh')),
  clip('h2-offopen', 'hats', 'Open, every other bar', 32, bars(['..x...x...x...x.', '..x...x...x...X.'], 'ohh')),
  clip('h2-ride', 'hats', 'Ride in threes', 12, [[0, 'ride', .7], [3, 'ride', .45], [6, 'ride', .45], [9, 'ride', .45]]),
  // percussion: cycles of odd lengths
  clip('p2-five', 'perc', 'Logs in five', 5, [[0, 'log', .75], [2, 'logH', .45]]),
  clip('p2-seven', 'perc', 'Toms in seven', 7, [[0, 'tomL', .7], [3, 'tomH', .45], [5, 'tomH', .35]]),
  clip('p2-nine', 'perc', 'Wood in nine', 9, [[0, 'wood', .65], [4, 'wood', .4], [6, 'clave', .35]]),
  clip('p2-eleven', 'perc', 'Metal in eleven', 11, [[0, 'metal', .55], [5, 'metal', .35], [8, 'rim', .5]]),
  clip('p2-5v4', 'perc', 'Five against four', 80, [...every(80, 16, 0, s => [s, 'log', .7]), ...every(80, 20, 10, s => [s, 'logH', .55])]),
  clip('p2-bowl7', 'perc', 'A bowl every seven beats', 28, [[0, 'bowl', .6]]),
  clip('p2-gong', 'perc', 'A gong every four bars', 64, [[0, 'gong', .7]]),
  clip('p2-shake', 'perc', 'Shaker in sevens', 14, [[0, 'shaker', .7], [2, 'shaker', .35], [4, 'shaker', .5], [7, 'shaker', .7], [9, 'shaker', .35], [11, 'shaker', .5], [13, 'shaker', .3]]),
  // bass: [step, rung, len16, vel, octave]
  clip('b2-pulse', 'bass', 'One note, pulsing', 16, every(16, 4, 2, (s, j) => [s, 0, 1.5, j % 2 ? .6 : .8])),
  clip('b2-pedal', 'bass', 'Pedal, octave jumps', 32, [[0, 0, 6, .85], [8, 0, 2, .6, 1], [14, 0, 2, .6], [16, 0, 6, .85], [26, 0, 2, .7, 1], [30, 3, 2, .55]]),
  clip('b2-seven', 'bass', 'Seven-step sequence', 7, [[0, 0, 1, .85], [2, 0, 1, .55], [3, 2, 1, .6], [5, 1, 1, .6]]),
  clip('b2-swell', 'bass', 'Two notes, slow', 64, [[0, 0, 30, .8], [32, 3, 14, .7], [48, 0, 14, .7]]),
  clip('b2-roll', 'bass', 'Rolling threes', 16, every(16, 3, 1, (s, j) => [s, j === 3 ? 2 : 0, 1.2, j ? .6 : .85])),
  clip('b2-root', 'bass', 'Root on the one', 16, [[0, 0, 8, .85]]),
  // chords: [step, 'chord', len16, vel]
  clip('c2-swell', 'chords', 'Long swells', 64, [[0, 'chord', 28, .5], [32, 'chord', 28, .45]], {sound: 'c2-bowmetal'}),
  clip('c2-wash', 'chords', 'Glass wash', 32, [[0, 'chord', 30, .5]], {sound: 'c2-glass'}),
  clip('c2-fives', 'chords', 'Stabs in fives', 80, every(80, 5, 2, (s, j) => [s, 'chord', 1.5, j % 4 ? .38 : .55]), {sound: 'c2-dark'}),
  clip('c2-phrase', 'chords', 'One chord a phrase', 64, [[0, 'chord', 60, .5]], {sound: 'c2-strings'}),
  clip('c2-offbeat', 'chords', 'Off the beat, dub', 32, [[3, 'chord', 2, .5], [19, 'chord', 2, .5], [27, 'chord', 1.5, .35]], {sound: 'c2-dark'}),
  clip('c2-bowls', 'chords', 'Bowls, breathing', 32, [[0, 'chord', 14, .5], [16, 'chord', 14, .45]], {sound: 'c2-bowlpad'}),
  // leads: [step, rung, len16, vel, octave]
  clip('l2-five', 'lead', 'Motif of five', 5, [[0, 2, 2, .6], [2, 4, 2, .45], [3, 1, 2, .45]], {sound: 'l2-log'}),
  clip('l2-seven', 'lead', 'Motif of seven', 7, [[0, 4, 2, .55], [3, 3, 2, .45], [5, 0, 2, .45, 1]], {sound: 'l2-bowl'}),
  clip('l2-eleven', 'lead', 'Bells on eleven', 44, [[0, 4, 6, .6], [11, 2, 6, .5], [22, 5, 6, .5], [33, 3, 6, .45]], {sound: 'l2-fmbell'}),
  clip('l2-drone', 'lead', 'One note, held', 64, [[0, 4, 62, .5]], {sound: 'l2-glass'}),
  clip('l2-gong', 'lead', 'Gong on the phrase', 64, [[0, 0, 16, .65]], {sound: 'l2-gong'}),
  clip('l2-bowed', 'lead', 'Bowed calls', 64, [[4, 5, 10, .55], [36, 6, 10, .55], [52, 4, 8, .45]], {sound: 'l2-bowmetal'}),
  clip('l2-rise', 'lead', 'Slow rise in seven', 28, [[0, 0, 3, .5], [7, 1, 3, .5], [14, 2, 3, .5], [21, 4, 3, .55]], {sound: 'l2-glass'}),
];
const R = rng(11);
for (const c of CLIPS) { c.variations = []; let v = c; for (let i = 0; i < 2; i++) { v = mutate(mutate(v, R), R); c.variations.push(v.steps); } }

/* ---------- harmonies: mostly still ---------- */
const H = (id, name, words, ...parts) => ({id, name, words, bars: parts.flatMap(([s, n]) => Array(n).fill(s))});
const HARMONIES = [
  H('e-m11', 'E minor 11', 'One chord, low and open.', ['E:m11', 1]),
  H('cs-m9', 'C♯ minor 9', 'One chord, darker.', ['C#:m9', 1]),
  H('bb-sus2', 'B♭ sus2', 'One chord, neither major nor minor.', ['Bb:sus2', 1]),
  H('f-madd9', 'F minor add 9', 'One chord, low and heavy.', ['F:madd9', 1]),
  H('d-five', 'Open fifths on D', 'No third at all: hollow, ancient.', ['D:five', 1]),
  H('a-q', 'Fourths on A', 'A chord stacked in fourths: floating, unresolved.', ['A:q', 1]),
  H('a-pedal', 'A pedal, the top moving', 'The bass stays on A; above it m9, sus4, m11.', ['A:m9', 4], ['A:sus4', 2], ['A:m11', 2]),
  H('phryg', 'A semitone up and back', 'E minor 7 for 8 bars, F major 7 for 8: the darkest move.', ['E:m7', 8], ['F:maj7', 8]),
  H('whole', 'Whole-step drift', 'Sus2 chords a whole step apart, drifting.', ['D:sus2', 4], ['E:sus2', 4], ['D:sus2', 4], ['C:sus2', 4]),
  H('locrian', 'Diminished and back', 'F♯ diminished, G major 7: uneasy.', ['F#:dim', 4], ['G:maj7', 4]),
  H('slow4', 'Slow four, 8 bars each', 'G minor 9, E♭ major 9, C minor 11, D 7sus.', ['G:m9', 8], ['Eb:maj9', 8], ['C:m11', 8], ['D:7sus', 8]),
];

/* ---------- the grid ---------- */
const COLUMNS = [['kick', 'k2-deep'], ['hats', 'h2-tight'], ['perc', 'p2-bowls'], ['bass', 'b2-sub'], ['chords', 'c2-bowmetal'], ['lead', 'l2-log'], ['lead', 'l2-glass']].map(([role, sound], i) => ({id: 'col' + i, role, sound}));
const SCENES = [
  ['Drone', [null, null, 'p2-gong', 'b2-swell', 'c2-swell', 'l2-drone', null]],
  ['Sub', ['k2-pulse', 'h2-gaps', null, 'b2-pulse', null, null, 'l2-drone']],
  ['Fives', ['k2-four', 'h2-fives', 'p2-five', 'b2-pulse', 'c2-fives', 'l2-five', null]],
  ['Sevens', ['k2-four', 'h2-sevens', 'p2-seven', 'b2-seven', 'c2-offbeat', 'l2-seven', 'l2-rise']],
  ['Gongs', ['k2-sparse', 'h2-ride', 'p2-gong', 'b2-pedal', 'c2-bowls', 'l2-gong', 'l2-eleven']],
  ['Bowed', ['k2-dubtail', 'h2-offopen', 'p2-bowl7', 'b2-root', 'c2-phrase', 'l2-bowed', null]],
  ['Rolling', ['k2-332', 'h2-gaps', 'p2-5v4', 'b2-roll', 'c2-fives', 'l2-five', 'l2-eleven']],
  ['Void', [null, null, 'p2-bowl7', null, 'c2-wash', null, 'l2-rise']],
];
const pack = {format: 'studio-jam-pack', id: 'pack-2', name: 'Pack 2: contrast', words: 'Deeper basses, odd cycles, bowed and rubbed bodies, harmony that hardly moves.', bpm: 120, swing: .04,
  sounds: SOUNDS, clips: CLIPS, harmonies: HARMONIES, columns: COLUMNS, scenes: SCENES.map(([name, ids]) => ({name, clips: ids}))};
// check every clip's voices are mapped by every sound of its role, and every scene's clips exist
for (const c of CLIPS) if (['kick', 'hats', 'perc'].includes(c.role)) for (const s of SOUNDS.filter(s => s.role === c.role)) for (const st of c.steps) if (!s.voices[st[1]]) throw new Error(`${s.id} lacks ${st[1]} for ${c.id}`);
for (const [n, ids] of SCENES) for (const id of ids) if (id && !CLIPS.some(c => c.id === id)) throw new Error(`${n}: no clip ${id}`);
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'packs'); fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'pack-2.json'), JSON.stringify(pack));
console.log(`pack-2: ${SOUNDS.length} sounds, ${CLIPS.length} clips, ${HARMONIES.length} harmonies, ${SCENES.length} scenes`);
