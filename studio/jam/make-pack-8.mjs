// Pack 8, the sound lab's music round 2 sounds: the moving sounds written for it (sounds/music.js, MSOUNDS), as library
// sounds the DAW and the jam play: the pulsing, delayed, sweeping and sample-and-hold basses, the dub bass echoing, the
// dark arp, the muted keys, the throbbing chord, the low drone, the dark dub stab. The sketchbook (ideas.mjs round 8)
// plays on them beside pack 7's. Usage: node studio/jam/make-pack-8.mjs
import fs from 'node:fs';
import { MSOUNDS } from '../sounds/music.js';
const here = new URL('packs/', import.meta.url).pathname, p7 = JSON.parse(fs.readFileSync(here + 'pack-7.json', 'utf8'));
// each: its lab id, its library role, and the palette sound that stands in where the analog synth can't play
const MAP = [['m2pulse', 'l8-pulse', 'bass', 'clean'], ['m2echo', 'l8-echo', 'bass', 'clean'], ['m2sweep', 'l8-sweep', 'bass', 'clean'], ['m2random', 'l8-random', 'bass', 'clean'],
  ['m2dubbass', 'l8-dubbass', 'bass', 'clean'], ['m2arp', 'l8-arp', 'lead', 'pluck'], ['m2keys', 'l8-keys', 'chords', 'warm'], ['m2throb', 'l8-throb', 'chords', 'warm'],
  ['m2drone', 'l8-drone', 'chords', 'warm'], ['m2dub', 'l8-dub', 'chords', 'dub']];
const sounds = MAP.map(([lab, id, role, palette]) => { const s = MSOUNDS.find(x => x.id === lab); if (!s) throw new Error('no lab sound ' + lab);
  return {id, role, name: s.name, words: s.words + ' (From the sound lab\'s music round 2.)', src: {asynth: s.patch, palette}}; });
const pack = {...p7, id: 'pack-8', name: 'Pack 8: sounds that move', words: 'The sound lab\'s music round 2 sounds, each moving by itself: a pulsing bass, a delayed bass, a slow sweep, sample and hold, the dub bass echoing, a dark arp, muted keys, a throbbing chord, a low drone, a dark dub stab.',
  sounds, columns: p7.columns.map(c => ({...c, sound: {bass: 'l8-pulse', chords: 'l8-keys', lead: 'l8-arp'}[c.role] || c.sound}))};
fs.writeFileSync(here + 'pack-8.json', JSON.stringify(pack, null, 1));
console.log('pack-8:', sounds.length, 'sounds');
