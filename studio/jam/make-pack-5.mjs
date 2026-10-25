// Pack 5, the analog synth (studio/lib/native/asynth.js): the Synth Lab's fourteen patches and the Mix Lab's four, each a
// sound for the part it suits, over pack 4's grooves and drums. In the DAW they play live on the synth itself; Studio
// Jam, which plays the browser's sounds, hears the nearest palette sound instead (`palette`). Usage: node studio/jam/make-pack-5.mjs
import fs from 'node:fs';
import { EXAMPLES } from '../synth/examples.js';
import { ANALOG } from '../mix/mix.js';
const here = new URL('packs/', import.meta.url).pathname, p4 = JSON.parse(fs.readFileSync(here + 'pack-4.json', 'utf8'));
// each example's part and its stand-in in the browser
const PART = {round: ['bass', 'dubSub'], acid: ['bass', 'dubSub'], reese: ['bass', 'reese'], wobble: ['bass', 'reese'], juno: ['chords', 'warm'], brass: ['chords', 'dubStab'],
  strings: ['chords', 'glassPad'], dub: ['chords', 'dub'], pulse: ['chords', 'dubStab'], drone: ['chords', 'sweep'], sync: ['lead', 'pluck'], arp: ['lead', 'arp'], hoover: ['lead', 'pluck'], bell: ['lead', 'glass'], lead: ['lead', 'pluck']};
const sounds = EXAMPLES.map(x => ({id: `a5-${x.id}`, role: PART[x.id][0], name: x.name, words: `The analog synth: ${x.words.replace(/^./, c => c.toLowerCase())}`, src: {asynth: x.patch, palette: PART[x.id][1]}}));
for (const [k, role, pal] of [['bass', 'bass', 'dubSub'], ['chords', 'chords', 'warm'], ['lead', 'lead', 'pluck'], ['lead2', 'lead', 'marimba']]) { const a = ANALOG[k];
  sounds.push({id: `a5-mix-${k}`, role, name: `${a.name} · Mix Lab`, words: `${a.words} As the Mix Lab's analog set plays it.`, src: {asynth: a.src.params, palette: pal}}); }
const pick = {bass: 'a5-mix-bass', chords: 'a5-mix-chords', lead: 'a5-mix-lead'};
const pack = {...p4, id: 'pack-5', name: 'Pack 5: the analog synth', words: 'The analog synth’s patches (basses, pads, strings, brass, leads, plucks, bells) on pack 4’s grooves and drums; in the DAW they play live on the synth, here the browser’s nearest sound stands in.',
  sounds, columns: p4.columns.map(c => pick[c.role] && !c.mute ? {...c, sound: pick[c.role]} : c)};
fs.writeFileSync(here + 'pack-5.json', JSON.stringify(pack, null, 1));
console.log('pack-5:', sounds.length, 'sounds');
