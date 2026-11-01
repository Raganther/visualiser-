// Pack 6, the drum racks: each of the analog drum machine's five kits as one sound with a pad for every drum (the kick,
// the hats and cymbals, and the full kit's snare, clap, toms, logs, wood, rim, clave, cowbell, metal, shaker, bowl and
// gong), each pad saying which of pack 4's sounds it is (`from`: so the DAW's desk stages its gain as that sound's).
// In the DAW a drum rack track plays one, each pad on its own strip. Usage: node studio/jam/make-pack-6.mjs
import fs from 'node:fs';
const here = new URL('packs/', import.meta.url).pathname, p4 = JSON.parse(fs.readFileSync(here + 'pack-4.json', 'utf8')), S = Object.fromEntries(p4.sounds.map(s => [s.id, s]));
const KITS = [['808', 'Analog 808', 'the 808 as its circuits behave'], ['909', 'Analog 909', 'the 909 as its circuits behave'], ['deep', 'Analog Deep', 'deep and round'], ['warm', 'Analog Warm', 'through warm tape'], ['grit', 'Analog Grit', 'driven hard']];
const sounds = KITS.map(([k, kit, how]) => { const voices = {};
  for (const id of [`k4-${k}`, `h4-${k}`, `p4-${k}`]) for (const [v, m] of Object.entries(S[id].voices)) if (!voices[v]) voices[v] = {...m, from: id};
  return {id: `r6-${k}`, role: 'drums', rack: true, name: `${kit} rack`, words: `The analog drum machine ${how}, every drum on its own pad: kick, hats and cymbals, snare, clap, toms and logs, wood, rim, clave, cowbell, shaker.`, voices}; });
const pack = {...p4, id: 'pack-6', name: 'Pack 6: drum racks', words: 'The analog drum machine’s five kits each as one drum rack, every drum on its own pad (for the DAW’s drum rack tracks); pack 4’s grooves.', sounds: sounds.concat([])};
fs.writeFileSync(here + 'pack-6.json', JSON.stringify(pack, null, 1));
console.log('pack-6:', sounds.length, 'sounds,', Object.keys(sounds[0].voices).length, 'pads each');
