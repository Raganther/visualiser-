// Pack 1 for Studio Jam: sounds, clips and harmonies from everything the user has liked so far (the labs, the songs, the
// native lab), written as data. Clips follow the harmony (see model.js); each gets a couple of variations. Usage:
// node studio/jam/pack1.mjs → studio/jam/packs/pack-1.json
import fs from 'node:fs';
import path from 'node:path';
import { mutate } from './model.js';
import { GOOD_KICK } from '../lib/palette.js';
import { rng } from '../lib/rng.js';

/* ---------- sounds: each a role, a name and how it's made; drums map their voices to instruments ---------- */
const kit = (k, over = {}) => ({kit: k, over});
const SOUNDS = [
  {id: 'k-round', role: 'kick', name: 'Round kick', words: 'The one you saved: no drive, dark, round.', voices: {kick: kit('Minimal', {kick: {...GOOD_KICK, drive: 0, tone: .3}})}},
  {id: 'k-low', role: 'kick', name: 'Low round kick', words: 'Two semitones lower: weightier.', voices: {kick: kit('Minimal', {kick: {...GOOD_KICK, tune: -3, drive: 0, tone: .32}})}},
  {id: 'k-skin', role: 'kick', name: 'Struck skin kick', words: 'Native: a big drum skin struck, its pitch falling.', voices: {kick: {native: 'kick', n: 33}}},
  {id: 'k-808', role: 'kick', name: 'Round 808', words: 'The 808’s long round kick, tamed.', voices: {kick: kit('808', {kick: {...GOOD_KICK, decay: 1.6, x: .3, drive: 0, tone: .38, tune: -2}})}},
  {id: 'h-minimal', role: 'hats', name: 'Soft hats', words: 'Slow Bloom’s hats: rounded, grooving.', voices: Object.fromEntries(['chh', 'ohh', 'ride'].map(v => [v, kit('Minimal', {chh: {tone: .62, level: 1.1, decay: .7, x: .3, pan: .2}, ohh: {tone: .58, level: .85, decay: .8, pan: -.2}, ride: {tone: .5, level: .4}})]))},
  {id: 'h-native', role: 'hats', name: 'Native hats', words: 'Native: noise and high metal, computed.', voices: {chh: {native: 'hat', n: 60, set: {decay: .045, tone: .6}}, ohh: {native: 'hat', n: 60, set: {decay: .2, tone: .55}}, ride: {native: 'plate', n: 88, set: {hard: .6, ring: .5}}}},
  {id: 'h-lofi', role: 'hats', name: 'Dusty hats', words: 'The lo-fi kit’s hats.', voices: Object.fromEntries(['chh', 'ohh', 'ride'].map(v => [v, kit('Lo-fi')]))},
  {id: 'p-skins', role: 'perc', name: 'Skins and wood', words: 'Native toms and woodblock, the kit’s rim, shaker and clave.', voices: {
    tomL: {native: 'tom', n: 43}, tomH: {native: 'tom', n: 50}, wood: {native: 'wood', n: 76}, metal: kit('909', {chh: {x: 1, tone: .82, level: .6, decay: .45, pan: -.35}}),
    rim: kit('Minimal', {rim: {level: .45, tone: .55, pan: .35}}), shaker: kit('Minimal', {shaker: {level: .5, tone: .5, pan: -.2}}), clave: kit('Minimal', {clave: {level: .35, tone: .6, pan: -.4}})}},
  {id: 'p-hands', role: 'perc', name: 'Hand drums', words: 'Native: hand drums and a plate instead of the kit.', voices: {
    tomL: {native: 'hand', n: 50}, tomH: {native: 'hand', n: 57}, wood: {native: 'wood', n: 81}, metal: {native: 'plate', n: 84, set: {ring: .4}},
    rim: {native: 'hand', n: 64, set: {decay: .15}}, shaker: kit('Minimal', {shaker: {level: .5, tone: .5}}), clave: {native: 'wood', n: 88}}},
  // pitched: a palette sound (the native stand-ins included) or a native instrument
  ...[['glass', 'Glass bass', 'The glass sequence’s sound, your saved bass.'], ['clean', 'Round bass', 'Sine and triangle, round.'], ['pluck', 'Detroit pluck', 'A square and a saw through a closing filter.']]
    .map(([p, name, words]) => ({id: 'b-' + p, role: 'bass', name, words, src: {palette: p}})),
  {id: 'b-string', role: 'bass', name: 'Plucked string', words: 'Native: a plucked string.', src: {native: 'pluck'}},
  {id: 'b-fmglass', role: 'bass', name: 'FM glass bass', words: 'Native FM: glassy and struck.', src: {native: 'fmglass', shift: -12}},
  {id: 'b-fmround', role: 'bass', name: 'FM round bass', words: 'Native FM at 1:1: a soft, woody thump.', src: {native: 'fmround'}},
  {id: 'b-fmpluck', role: 'bass', name: 'FM pluck bass', words: 'Native FM with feedback: snappy and wiry.', src: {native: 'fmpluck'}},
  ...[['gated', 'Gated chord', 'The 16th chord you loved in Glasshouse.'], ['dotted', 'Dotted chords', 'Short, plucked chords.'], ['dubStab', 'Dub stab', 'Dub chords, short, for the echo.'],
    ['fifths', 'Detroit stabs', 'A string-machine stab.'], ['warm', 'Warm pad', 'Two saws, a slow wobble.'], ['glassPad', 'Glass pad', 'A swelling glassy pad.']]
    .map(([p, name, words]) => ({id: 'c-' + p, role: 'chords', name, words, src: {palette: p}})),
  {id: 'c-bloom', role: 'chords', name: 'Bloom pad', words: 'Native additive: each partial opening on its own.', src: {native: 'addpad'}},
  {id: 'c-breath', role: 'chords', name: 'Breath pad', words: 'Native: air through resonances.', src: {native: 'breath'}},
  {id: 'c-grain', role: 'chords', name: 'Grain pad', words: 'Native: a held cloud of vibraphone grains.', src: {native: 'grainpad'}},
  {id: 'c-fmbell', role: 'chords', name: 'FM bell chord', words: 'Native FM: a glassy bell chord.', src: {native: 'fmbell'}},
  ...[['kalimba', 'Kalimba'], ['marimba', 'Marimba'], ['steel', 'Steel drum'], ['musicbox', 'Music box'], ['vibes', 'Vibraphone'], ['tubular', 'Tubular bells'], ['metal', 'Metal plate'], ['wood', 'Woodblock'], ['ping', 'Ping']]
    .map(([p, name]) => ({id: 'l-' + p, role: 'lead', name, words: p === 'kalimba' || p === 'ping' ? 'As you liked it (the synth).' : 'Native, as you preferred it in the lab.', src: {palette: p}})),
  {id: 'l-bell', role: 'lead', name: 'Church bell', words: 'Native: a bell’s ringers’ partials.', src: {native: 'bell', shift: -12}},
];

/* ---------- clips ---------- */
const P = (str, voice) => [...str].map((c, i) => c === '.' ? null : [i, c === 'X' || c === 'O' ? voice : voice, c === 'X' ? 1 : c === 'o' ? .45 : .8]).filter(Boolean);
const every = (len, n, o, f) => { const out = []; for (let s = o, j = 0; s < len; s += n, j++) out.push(f(s, j)); return out; };
const clip = (id, role, name, len, steps, more = {}) => ({id, role, name, len, steps: steps.sort((a, b) => a[0] - b[0]), ...more});
const CLIPS = [
  // kick
  clip('kick-four', 'kick', 'Four to the floor', 16, P('X...x...x...x...', 'kick')),
  clip('kick-ghost', 'kick', 'Four, a ghost in', 32, [...P('X...x...x...x...', 'kick'), ...P('X...x...x...x..o', 'kick').map(s => [s[0] + 16, s[1], s[2]])]),
  clip('kick-broken', 'kick', 'Broken', 16, P('X.....x...x..x..', 'kick')),
  clip('kick-half', 'kick', 'Half time', 16, P('X.......x.......', 'kick')),
  // hats
  clip('hats-off', 'hats', 'Off-beats', 16, P('..x...x...x...x.', 'chh')),
  clip('hats-groove', 'hats', 'Grooving', 32, [...every(32, 4, 2, s => [s, 'chh', .95]), ...[1, 3, 5, 9, 11, 13, 15, 17, 19, 21, 25, 27, 29, 31].map((s, j) => [s, 'chh', .25 + .2*Math.sin(j)]), ...[0, 8, 16, 24].map(s => [s, 'chh', .4])]),
  clip('hats-shuffle', 'hats', 'Shuffle', 16, P('x.oxx.oxx.oxx.ox', 'chh')),
  clip('hats-open', 'hats', 'Open off-beats', 16, P('..x...x...x...x.', 'ohh')),
  clip('hats-ride', 'hats', 'Ride 8ths', 16, P('x.x.x.x.x.x.x.x.', 'ride')),
  // percussion: polyrhythms
  clip('perc-toms3', 'perc', 'Toms in threes', 6, [[0, 'tomH', .5], [3, 'tomL', .7]]),
  clip('perc-shaker', 'perc', 'Shaker', 16, P('o.x.o.xoo.x.o.xo', 'shaker')),
  clip('perc-metal5', 'perc', 'Metal in fives', 5, [[2, 'metal', .6]]),
  clip('perc-wood7', 'perc', 'Woodblocks in sevens', 7, [[0, 'wood', .7], [3, 'wood', .4]]),
  clip('perc-rim', 'perc', 'Rim round the beat', 32, [...P('...x..x....x..x.', 'rim'), ...P('...x.....x..x...', 'rim').map(s => [s[0] + 16, s[1], s[2]])]),
  clip('perc-clave', 'perc', 'Clave 3-3-2', 16, P('x..x..x...x..x..', 'clave')),
  clip('perc-tomsbroken', 'perc', 'Rolling toms', 16, [[2, 'tomH', .45], [4, 'tomL', .55], [10, 'tomH', .45], [13, 'tomL', .55]]),
  // bass: [step, rung, len, vel, octave]
  clip('bass-berlin', 'bass', 'Berlin sequence', 16, [0, 3, 2, 5, 1, 3, 0, 4, 0, 3, 2, 5, 1, 3, 0, 4].map((k, s) => [s, k, .9, s % 4 ? .55 : .75])),
  clip('bass-detroit', 'bass', 'Detroit figure', 16, [[0, 0, 1, .85], [3, 0, 1, .8], [6, 3, 1, .8], [10, 0, 1, .8], [13, 3, 1, .75]]),
  clip('bass-octfunk', 'bass', 'Octave funk', 16, [[0, 0, .9, .9], [2, 0, .9, .55, 1], [3, 0, .9, .9, 1], [5, 0, .9, .55, 1], [8, 0, .9, .9], [10, 0, .9, .55, 1], [11, 0, .9, .9, 1], [14, 0, .9, .55, 1]]),
  clip('bass-walk', 'bass', 'Dotted walk', 48, every(48, 6, 0, (s, j) => [s, [0, 2, 4, 1, 3, 2, 0, 4][j], 2.5, .85])),
  clip('bass-dub', 'bass', 'One note, off the beat', 32, [[2, 0, 3, .9], [18, 0, 3, .9], [26, 3, 2, .6]]),
  clip('bass-intro', 'bass', 'Two notes', 16, [[0, 0, 1, .8], [4, 4, 1, .6], [8, 0, 1, .8], [12, 2, 1, .6]]),
  // chords: [step, 'chord', len, vel]
  clip('chords-gated', 'chords', 'Gated 16ths', 16, every(16, 1, 0, s => [s, 'chord', .8, s % 4 === 2 ? .52 : .3]), {sound: 'c-gated'}),
  clip('chords-held', 'chords', 'Held, four bars', 64, [[0, 'chord', 63, .55]], {sound: 'c-bloom'}),
  clip('chords-dotted', 'chords', 'Dotted', 48, every(48, 3, 0, s => [s, 'chord', 1.5, .45]), {sound: 'c-dotted'}),
  clip('chords-dub', 'chords', 'Dub swells', 16, [[2, 'chord', 4, .55], [10, 'chord', 4, .55]], {sound: 'c-dubStab'}),
  clip('chords-stabs', 'chords', 'Detroit stabs', 16, [0, 3, 6, 10, 13].map(s => [s, 'chord', 1.5, s ? .5 : .62]), {sound: 'c-fifths'}),
  clip('chords-two', 'chords', 'Held, two bars', 32, [[0, 'chord', 31, .55]], {sound: 'c-breath'}),
  // leads and bells: [step, rung, len, vel, octave]
  clip('lead-marimba', 'lead', 'Marimba pattern', 16, [[0, 5, 1, .65], [2, 7, 1, .5], [4, 6, 1, .5], [7, 8, 1, .5], [10, 7, 1, .5], [12, 6, 1, .65], [14, 4, 1, .5]], {sound: 'l-marimba'}),
  clip('lead-arp', 'lead', 'Rising arpeggio', 16, every(16, 1, 0, s => [s, s % 5, 1, .45, s >= 10 ? 1 : 0]), {sound: 'l-musicbox'}),
  clip('lead-threes', 'lead', 'In threes', 15, every(15, 3, 0, (s, j) => [s, [0, 2, 4, 1, 3][j], 1.5, j ? .5 : .7]), {sound: 'l-steel'}),
  clip('lead-one', 'lead', 'One note', 32, [...[2, 5, 10, 13].map(s => [s, 5, .7, .7]), ...[18, 21, 25, 30].map(s => [s, 5, .7, .7])], {sound: 'l-ping'}),
  clip('lead-phaseA', 'lead', 'Phase loop of 12', 12, [[0, 0, 1.5, .7], [2, 2, 1.5, .55], [4, 3, 1.5, .55], [5, 1, 1.5, .55], [7, 4, 1.5, .55], [9, 2, 1.5, .55], [10, 3, 1.5, .55]], {sound: 'l-kalimba'}),
  clip('lead-phaseB', 'lead', 'Phase loop of 13', 13, [[0, 4, 1.5, .55], [3, 3, 1.5, .45], [5, 1, 1.5, .45], [8, 2, 1.5, .45], [10, 0, 1.5, .45, 1], [11, 5, 1.5, .45]], {sound: 'l-kalimba'}),
  clip('lead-sparse', 'lead', 'Sparse bells', 32, [[0, 0, 8, .7], [22, 3, 8, .55]], {sound: 'l-tubular'}),
  clip('lead-answer', 'lead', 'Rising answer', 64, [[2, 5, 1, .7], [5, 5, 1, .7], [10, 5, 1, .7], [13, 5, 1, .7], [18, 5, 1, .7], [21, 6, 1, .7], [26, 5, 1, .7], [29, 8, 1, .7], [34, 5, 1, .7], [37, 6, 1, .7], [42, 7, 1, .7], [45, 8, 1, .7], [50, 9, 1, .7], [53, 8, 1, .7], [56, 7, 1, .7], [58, 6, 1, .7], [61, 5, 1, .7]], {sound: 'l-metal'}),
  clip('lead-fifths', 'lead', 'Fifths figure', 16, [0, 3, 6, 10, 13].flatMap(s => [[s, 0, 1.5, s ? .5 : .65], [s, 3, 1.5, s ? .42 : .55]]), {sound: 'l-vibes'}),
];
// two variations of each, by small mutations (seeded, so the pack is the same every build)
const R = rng(7);
for (const c of CLIPS) { c.variations = []; let v = c; for (let i = 0; i < 2; i++) { v = mutate(mutate(v, R), R); c.variations.push(v.steps); } }

/* ---------- harmonies: a chord symbol a bar ---------- */
const H = (id, name, words, ...parts) => ({id, name, words, bars: parts.flatMap(([s, n]) => Array(n).fill(s))});
const HARMONIES = [
  H('a-m9', 'A minor 9', 'One chord: minimal, the movement all in the rhythm.', ['A:m9', 1]),
  H('d-m11', 'D minor 11', 'One chord, darker and wider.', ['D:m11', 1]),
  H('g-m9', 'G minor 9', 'One chord, lower.', ['G:m9', 1]),
  H('a-m7', 'A minor 7', 'One plain chord: dub techno.', ['A:m7', 1]),
  H('sus-drift', 'Suspended drift', 'Suspended chords that never settle, two bars each.', ['A:sus4', 2], ['F:sus2', 2], ['G:sus2', 2], ['A:sus2', 2]),
  H('dorian', 'Dorian vamp', 'E minor 9 and a floating C major 7♯11 (Lantern).', ['E:m9', 2], ['C:lyd', 2]),
  H('phrygian', 'Phrygian', 'E minor 7, F major 9, E minor 7, D minor 9 (Low Sun).', ['E:m7', 4], ['F:maj9', 4], ['E:m7', 4], ['D:m9', 4]),
  H('lydian', 'Lydian lift', 'F major 9, G add 9, A minor 7, C add 9 (Sundial).', ['F:maj9', 2], ['G:add9', 2], ['A:m7', 2], ['C:add9', 2]),
  H('ferry', 'Never settles', 'D sus2, B♭ Lydian, F sus2, C add9 (Night Ferry).', ['D:sus2', 4], ['Bb:lyd', 4], ['F:sus2', 4], ['C:add9', 4]),
  H('glasshouse', 'Bright four', 'C major 9, A minor 9, F major 9, G 6/9 (Glasshouse).', ['C:maj9', 4], ['A:m9', 4], ['F:maj9', 4], ['G:69', 4]),
  H('rust', 'Two chords, mostly one', 'F♯ minor 11 for six bars, E 6/9 for two (Rust Garden).', ['F#:m11', 6], ['E:69', 2]),
  H('hanging', 'Hanging on E', 'F Lydian, G sus2, D sus2, E 7sus: Copper Wire’s breakdown, waiting to resolve.', ['F:lyd', 4], ['G:sus2', 4], ['D:sus2', 4], ['E:7sus', 4]),
];

/* ---------- the grid: columns (a role each) and scenes (a clip per column, or none) ---------- */
const COLUMNS = [['kick', 'k-round'], ['hats', 'h-minimal'], ['perc', 'p-skins'], ['bass', 'b-glass'], ['chords', 'c-gated'], ['lead', 'l-marimba'], ['lead', 'l-kalimba']].map(([role, sound], i) => ({id: 'col' + i, role, sound}));
const SCENES = [
  ['Intro', ['kick-four', 'hats-off', 'perc-shaker', 'bass-intro', 'chords-held', null, null]],
  ['Groove', ['kick-ghost', 'hats-groove', 'perc-toms3', 'bass-berlin', 'chords-gated', 'lead-marimba', null]],
  ['Phase', ['kick-four', 'hats-shuffle', 'perc-metal5', 'bass-detroit', 'chords-dub', 'lead-phaseA', 'lead-phaseB']],
  ['Broken', ['kick-broken', 'hats-ride', 'perc-tomsbroken', 'bass-octfunk', 'chords-stabs', 'lead-threes', 'lead-sparse']],
  ['Lift', ['kick-four', 'hats-open', 'perc-wood7', 'bass-walk', 'chords-dotted', 'lead-arp', 'lead-answer']],
  ['Breakdown', [null, null, 'perc-wood7', null, 'chords-two', 'lead-sparse', null]],
  ['Peak', ['kick-ghost', 'hats-groove', 'perc-rim', 'bass-berlin', 'chords-gated', 'lead-fifths', 'lead-one']],
  ['Half time', ['kick-half', 'hats-off', 'perc-clave', 'bass-dub', 'chords-two', 'lead-one', null]],
];

const pack = {format: 'studio-jam-pack', id: 'pack-1', name: 'Pack 1: what you liked so far', bpm: 124, swing: .06, sounds: SOUNDS, clips: CLIPS, harmonies: HARMONIES, columns: COLUMNS,
  scenes: SCENES.map(([name, ids]) => ({name, clips: ids}))};
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'packs'); fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'pack-1.json'), JSON.stringify(pack));
console.log(`pack-1: ${SOUNDS.length} sounds, ${CLIPS.length} clips, ${HARMONIES.length} harmonies, ${SCENES.length} scenes`);
