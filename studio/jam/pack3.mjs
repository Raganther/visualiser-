// Pack 3 for Studio Jam: minimal techno, every sound native. Analog kicks (a resonator falling in pitch, a click, a
// drive; the dub kick the user saved, computed), 808 metal hats, ticks and seeds, a rumble, analog stabs and pads
// (the gated chord and the dub chord computed, not played on the browser's synth), a formant pad, and nature: drops,
// twigs, stones, bamboo, leaves, insects and a bird. Odd-length parts, F minor add 9 first (the user chose it twice).
// Usage: node studio/jam/pack3.mjs
import fs from 'node:fs';
import path from 'node:path';
import { mutate } from './model.js';
import { rng } from '../lib/rng.js';

/* ---------- sounds ---------- */
const N = (native, n, set) => ({native, n, ...(set ? {set} : {})});
const PERC = m => ({tomL: N('tom', 43), tomH: N('tom', 50), wood: N('wood', 76), metal: N('click', 98), rim: N('rim', 85), shaker: N('shaker', 60), clave: N('click', 90),
  bowl: N('bowl', 76), gong: N('gong', 45, {hard: .3}), log: N('logdrum', 45), logH: N('logdrum', 52), ...m});
const SOUNDS = [
  {id: 'k3-dub', role: 'kick', name: 'Dub kick (native)', words: 'The dub kick you saved, computed: round, with a boom under it.', voices: {kick: N('kdub', 33)}},
  {id: 'k3-round', role: 'kick', name: 'Round analog kick', words: 'A resonator falling into its note, a soft click.', voices: {kick: N('kround', 33)}},
  {id: 'k3-tight', role: 'kick', name: 'Tight analog kick', words: 'Short, punchy, driven: leaves room for a rumble.', voices: {kick: N('ktight', 36)}},
  {id: 'k3-deep', role: 'kick', name: 'Deep analog kick', words: 'Low and long, a long boom.', voices: {kick: N('kdeep', 31)}},
  {id: 'k3-skin', role: 'kick', name: 'Struck skin, driven', words: 'The struck skin, now with a soft drive.', voices: {kick: N('kick', 33)}},
  {id: 'h3-808', role: 'hats', name: '808 metal hats', words: 'Six clashing squares: closed, open and a long ride.', voices: {chh: N('hat808', 60, {decay: .045}), ohh: N('hat808', 60, {decay: .22, tone: .45}), ride: N('hat808', 60, {decay: .5, tone: .8, sizzle: .1})}},
  {id: 'h3-ticks', role: 'hats', name: 'Ticks', words: 'Minimal ticks: clicks, a short hat, a stone.', voices: {chh: N('click', 100), ohh: N('hat', 60, {decay: .1, tone: .5}), ride: N('stone', 96)}},
  {id: 'h3-seeds', role: 'hats', name: 'Seeds and leaves', words: 'A seed pod for the closed hat, leaves for the open.', voices: {chh: N('shaker', 60), ohh: N('leaf', 60, {secs: .14}), ride: N('hat', 60, {decay: .3, tone: .4})}},
  {id: 'h3-soft', role: 'hats', name: 'Soft native hats', words: 'Noise and metal, rounded.', voices: {chh: N('hat', 60, {decay: .035, tone: .55}), ohh: N('hat', 60, {decay: .16, tone: .5}), ride: N('hat808', 60, {decay: .35, tone: .3})}},
  {id: 'p3-forest', role: 'perc', name: 'Forest floor', words: 'Bamboo, twigs, stones, drops, leaves, insects.', voices: PERC({tomL: N('bamboo', 52), tomH: N('bamboo', 59), wood: N('twig', 60), metal: N('stone', 90), rim: N('drop', 79),
    shaker: N('leaf', 60, {secs: .12}), clave: N('insect', 60), bowl: N('drop', 86), gong: N('leaf', 60, {secs: .5}), log: N('bamboo', 45), logH: N('stone', 84)})},
  {id: 'p3-hands', role: 'perc', name: 'Hands and rims', words: 'Hand drums, rim shots and clicks.', voices: PERC({tomL: N('hand', 48), tomH: N('hand', 55), wood: N('rim', 82), rim: N('rim', 85), bowl: N('hand', 62), gong: N('tom', 43), log: N('hand', 43, {decay: .5}), logH: N('hand', 60)})},
  {id: 'p3-woodstone', role: 'perc', name: 'Wood and stone', words: 'Log drums, woodblocks, stones, a bowl.', voices: PERC({tomL: N('logdrum', 50), tomH: N('logdrum', 57), metal: N('stone', 93), rim: N('rim', 88), shaker: N('leaf', 60, {secs: .1}), clave: N('wood', 88), logH: N('bamboo', 66)})},
  {id: 'b3-fm', role: 'bass', name: 'Dark FM 2', words: 'The Dark FM you kept, its growl falling slower.', src: {native: 'fmround', set: {ratio: 2, indexEnd: .6, indexT: .25}}},
  {id: 'b3-rumble', role: 'bass', name: 'Rumble', words: 'Techno’s rumble: the low end ringing on, dark and gritty. Tone is the grit.', src: {native: 'rumble'}},
  {id: 'b3-sub', role: 'bass', name: 'Round sub (analog)', words: 'A saw and a sub through a low filter: round, with harmonics.', src: {native: 'vasub'}},
  {id: 'b3-pluck', role: 'bass', name: 'Minimal pluck (analog)', words: 'A square through a resonant filter snapping shut.', src: {native: 'vapluck'}},
  {id: 'b3-bamboo', role: 'bass', name: 'Bamboo bass', words: 'A big bamboo tube, pitched low.', src: {native: 'bamboo', shift: -12}},
  {id: 'c3-dub', role: 'chords', name: 'Dub chord (native)', words: 'A saw and a square, resonant, rounder than the dark stab.', src: {native: 'vadub'}},
  {id: 'c3-gate', role: 'chords', name: 'Gated chord (native)', words: 'The gated chord you loved, computed.', src: {native: 'vagate'}},
  {id: 'c3-stab', role: 'chords', name: 'Minimal stab', words: 'A square snapping shut: short and dry.', src: {native: 'vastab'}},
  {id: 'c3-pad', role: 'chords', name: 'Warm pad (analog)', words: 'Five saws, a slow filter.', src: {native: 'vapad'}},
  {id: 'c3-strings', role: 'chords', name: 'Ensemble (analog)', words: 'Seven saws drifting: a string machine.', src: {native: 'vastrings'}},
  {id: 'c3-formant', role: 'chords', name: 'Formant pad', words: 'Saws through a mouth’s resonances, drifting from vowel to vowel. Tone focuses it.', src: {native: 'formant'}},
  {id: 'c3-bloom', role: 'chords', name: 'Bloom pad', words: 'Additive, each partial opening on its own (now wavering gently).', src: {native: 'addpad'}},
  {id: 'l3-drops', role: 'lead', name: 'Water drops', words: 'Drops falling into water, tuned to the chord.', src: {native: 'drop', shift: 12}},
  {id: 'l3-bird', role: 'lead', name: 'Bird', words: 'A chirp sweeping up to each note.', src: {native: 'bird', shift: 24}},
  {id: 'l3-bamboo', role: 'lead', name: 'Bamboo', words: 'A struck bamboo tube, hollow.', src: {native: 'bamboo'}},
  {id: 'l3-blip', role: 'lead', name: 'Blip (analog)', words: 'A square and a triangle, a quick filter.', src: {native: 'vablip', shift: 12}},
  {id: 'l3-glass', role: 'lead', name: 'Glass harmonica', words: 'Wet glass, rubbed (you kept it).', src: {native: 'glassharm'}},
];

/* ---------- clips ---------- */
const P = (str, voice) => [...str].map((c, i) => c === '.' ? null : [i, voice, c === 'X' ? 1 : c === 'o' ? .45 : .8]).filter(Boolean);
const every = (len, n, o, f) => { const out = []; for (let s = o, j = 0; s < len; s += n, j++) out.push(f(s, j)); return out; };
const clip = (id, role, name, len, steps, more = {}) => ({id, role, name, len, steps: steps.sort((a, b) => a[0] - b[0]), ...more});
const bars = (strs, voice) => strs.flatMap((s, b) => P(s, voice).map(x => [x[0] + 16*b, x[1], x[2]]));
const CLIPS = [
  clip('k3-four', 'kick', 'Four', 16, P('X...x...x...x...', 'kick')),
  clip('k3-ghost', 'kick', 'Four, a ghost', 32, bars(['X...x...x...x...', 'X...x...x...x..o'], 'kick')),
  clip('k3-skip', 'kick', 'Skip every third bar', 48, bars(['X...x...x...x...', 'X...x...x...x...', 'X...x...x.......'], 'kick')),
  clip('k3-broken', 'kick', 'Broken four', 16, P('X...x...x..ox...', 'kick')),
  clip('k3-sparse', 'kick', 'One and three', 16, P('X.......x.......', 'kick')),
  clip('h3-off', 'hats', 'Off-beats', 16, P('..x...x...x...x.', 'chh')),
  clip('h3-16', 'hats', '16ths', 16, P('xoxoxoxoxoxoxoxo', 'chh')),
  clip('h3-gaps', 'hats', '16ths with gaps', 16, P('x.ox.x.oxx.o.x.o', 'chh')),
  clip('h3-open', 'hats', 'Open off-beats, ticks between', 16, [...P('..X...X...X...X.', 'ohh'), ...P('o..o.o..o..o.o..', 'chh')]),
  clip('h3-three', 'hats', 'In threes', 3, [[0, 'chh', .8], [2, 'chh', .4]]),
  clip('h3-ride', 'hats', 'Ride 8ths', 16, P('x.o.x.o.x.o.x.o.', 'ride')),
  clip('p3-three', 'perc', 'Rim in threes', 3, [[0, 'rim', .7]]),
  clip('p3-clicks', 'perc', 'Clicks with gaps', 16, P('.o.x..o..x.o...o', 'clave')),
  clip('p3-five', 'perc', 'Fives', 5, [[0, 'metal', .7], [3, 'metal', .35]]),
  clip('p3-seven', 'perc', 'Sevens', 7, [[0, 'rim', .75], [4, 'wood', .45]]),
  clip('p3-nine', 'perc', 'Nines', 9, [[0, 'wood', .7], [5, 'tomH', .45]]),
  clip('p3-shake', 'perc', 'Shaker 16ths', 16, P('oxoxoxoxoxoxoxox', 'shaker')),
  clip('p3-hands', 'perc', 'Hand groove', 16, [[2, 'tomH', .5], [3, 'tomL', .7], [7, 'tomH', .45], [10, 'tomL', .6], [13, 'tomH', .5], [14, 'logH', .4]]),
  clip('p3-rolling', 'perc', 'Rolling low', 32, [...every(32, 6, 0, (s, j) => [s, j % 2 ? 'logH' : 'log', j ? .5 : .75])]),
  clip('p3-air', 'perc', 'A swell every 4 bars', 64, [[0, 'gong', .6], [40, 'bowl', .5]]),
  clip('b3-off', 'bass', 'Off-beat 8ths', 16, every(16, 4, 2, (s, j) => [s, 0, 1.5, j % 2 ? .65 : .85])),
  clip('b3-rumble', 'bass', 'Rumbling 16ths', 16, every(16, 1, 0, s => s % 4 === 0 ? null : [s, 0, .9, s % 4 === 2 ? .85 : .5]).filter(Boolean)),
  clip('b3-three', 'bass', 'Three-step stab', 3, [[0, 0, .8, .85]]),
  clip('b3-seven', 'bass', 'Seven-step line', 7, [[0, 0, 1, .85], [2, 0, 1, .55], [3, 2, 1, .6], [5, 1, 1, .6]]),
  clip('b3-roll', 'bass', 'Rolling threes', 16, every(16, 3, 1, (s, j) => [s, j === 3 ? 2 : 0, 1.2, j ? .6 : .85])),
  clip('b3-and', 'bass', 'On the and, long', 32, [[6, 0, 6, .85], [22, 0, 4, .8], [28, 2, 2, .6]]),
  clip('c3-and', 'chords', 'Stab on the and', 16, [[2, 'chord', 1.2, .6], [10, 'chord', 1.2, .5]], {sound: 'c3-dub'}),
  clip('c3-threes', 'chords', 'Stabs in threes', 48, every(48, 3, 0, (s, j) => [s, 'chord', 1, j % 4 ? .38 : .55]), {sound: 'c3-stab'}),
  clip('c3-fives', 'chords', 'Stabs in fives', 80, every(80, 5, 2, (s, j) => [s, 'chord', 1.5, j % 4 ? .4 : .58]), {sound: 'c3-dub'}),
  clip('c3-swell', 'chords', 'Dub swells', 32, [[3, 'chord', 4, .55], [19, 'chord', 4, .5], [27, 'chord', 2, .35]], {sound: 'c3-dub'}),
  clip('c3-gated', 'chords', 'Gated 16ths', 16, every(16, 1, 0, s => [s, 'chord', .8, s % 4 === 2 ? .52 : .3]), {sound: 'c3-gate'}),
  clip('c3-phrase', 'chords', 'One chord a phrase', 64, [[0, 'chord', 60, .5]], {sound: 'c3-formant'}),
  clip('l3-drops', 'lead', 'Drops', 16, [[0, 4, 1, .7], [3, 2, 1, .5], [6, 5, 1, .55], [11, 3, 1, .5]], {sound: 'l3-drops'}),
  clip('l3-seven', 'lead', 'Blip in seven', 7, [[0, 2, .8, .6], [3, 4, .8, .45]], {sound: 'l3-blip'}),
  clip('l3-birds', 'lead', 'Bird calls', 64, [[6, 5, 3, .6], [9, 6, 2, .5], [38, 4, 3, .6], [41, 5, 2, .5], [44, 7, 2, .45]], {sound: 'l3-bird'}),
  clip('l3-answer', 'lead', 'Bamboo answer', 32, [[2, 0, 2, .7], [5, 2, 2, .55], [18, 3, 2, .6], [21, 1, 2, .55], [26, 0, 2, .5]], {sound: 'l3-bamboo'}),
  clip('l3-drone', 'lead', 'One note, held', 64, [[0, 4, 62, .5]], {sound: 'l3-glass'}),
];
const R = rng(13);
for (const c of CLIPS) { c.variations = []; let v = c; for (let i = 0; i < 2; i++) { v = mutate(mutate(v, R), R); c.variations.push(v.steps); } }

/* ---------- harmonies: one chord, or barely moving ---------- */
const H = (id, name, words, ...parts) => ({id, name, words, bars: parts.flatMap(([s, n]) => Array(n).fill(s))});
const HARMONIES = [
  H('f-madd9-3', 'F minor add 9', 'One chord, low and heavy (you chose it twice).', ['F:madd9', 1]),
  H('a-m7-3', 'A minor 7', 'One plain chord: the movement all in the rhythm.', ['A:m7', 1]),
  H('d-m9-3', 'D minor 9', 'One chord, a little brighter.', ['D:m9', 1]),
  H('g-m7-3', 'G minor 7', 'Dub techno’s chord.', ['G:m7', 1]),
  H('cs-m11-3', 'C♯ minor 11', 'One chord, wide and dark.', ['C#:m11', 1]),
  H('e-q-3', 'Fourths on E', 'Stacked fourths: floating, unresolved.', ['E:q', 1]),
  H('a-pedal-3', 'A pedal, the top moving', 'A minor 7, sus4, minor 9 over the same A.', ['A:m7', 4], ['A:sus4', 2], ['A:m9', 2]),
  H('d-m7m9', 'D minor 7 ↔ 9', 'One root, the ninth coming and going.', ['D:m7', 4], ['D:m9', 4]),
  H('phryg-3', 'A semitone up and back', 'E minor 7, then F major 7, 8 bars each.', ['E:m7', 8], ['F:maj7', 8]),
  H('sus-3', 'Sus2 drift', 'C sus2 and D sus2, 4 bars each.', ['C:sus2', 4], ['D:sus2', 4]),
];

/* ---------- the grid ---------- */
// each column's starting sound, and its own feel and sends
const COLUMNS = [{role: 'kick', sound: 'k3-dub'}, {role: 'hats', sound: 'h3-808', feel: 1}, {role: 'perc', sound: 'p3-forest', feel: 9}, {role: 'bass', sound: 'b3-fm'},
  {role: 'chords', sound: 'c3-dub', voicing: 1}, {role: 'lead', sound: 'l3-drops'}, {role: 'lead', sound: 'l3-glass', echo: true}].map((c, i) => ({id: 'col' + i, ...c}));
const SCENES = [
  ['Warm up', ['k3-four', 'h3-off', 'p3-three', 'b3-off', null, null, null]],
  ['Groove', ['k3-ghost', 'h3-gaps', 'p3-seven', 'b3-roll', 'c3-and', 'l3-drops', null]],
  ['Rumble', ['k3-four', 'h3-16', 'p3-clicks', 'b3-rumble', 'c3-threes', null, null]],
  ['Dub', ['k3-four', 'h3-open', 'p3-air', 'b3-and', 'c3-swell', null, 'l3-drone']],
  ['Forest', ['k3-sparse', 'h3-three', 'p3-nine', 'b3-seven', 'c3-phrase', 'l3-birds', 'l3-answer']],
  ['Peak', ['k3-skip', 'h3-16', 'p3-hands', 'b3-roll', 'c3-fives', 'l3-seven', 'l3-drops']],
  ['Break', [null, 'h3-ride', 'p3-air', null, 'c3-phrase', 'l3-birds', 'l3-drone']],
  ['Hypnotic', ['k3-four', 'h3-gaps', 'p3-five', 'b3-three', 'c3-gated', 'l3-seven', null]],
];
const pack = {format: 'studio-jam-pack', id: 'pack-3', name: 'Pack 3: minimal techno', words: 'Every sound native: analog kicks, 808 metal, a rumble, analog stabs and pads, a formant pad, and nature.', bpm: 126, swing: .08,
  sounds: SOUNDS, clips: CLIPS, harmonies: HARMONIES, columns: COLUMNS, scenes: SCENES.map(([name, ids]) => ({name, clips: ids}))};
for (const c of CLIPS) if (['kick', 'hats', 'perc'].includes(c.role)) for (const s of SOUNDS.filter(s => s.role === c.role)) for (const st of c.steps) if (!s.voices[st[1]]) throw new Error(`${s.id} lacks ${st[1]} for ${c.id}`);
for (const [n, ids] of SCENES) for (const id of ids) if (id && !CLIPS.some(c => c.id === id)) throw new Error(`${n}: no clip ${id}`);
const { NATIVE } = await import('../lib/native/index.js');
for (const s of SOUNDS) for (const nm of s.voices ? Object.values(s.voices).map(v => v.native) : [s.src.native]) if (!NATIVE[nm]) throw new Error(`${s.id}: no native ${nm}`);
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'packs'); fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'pack-3.json'), JSON.stringify(pack));
console.log(`pack-3: ${SOUNDS.length} sounds (all native), ${CLIPS.length} clips, ${HARMONIES.length} harmonies, ${SCENES.length} scenes`);
