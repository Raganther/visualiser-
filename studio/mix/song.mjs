// The song to mix and its sounds, read from the files (node: for the build and the tests): a round 4 song written out
// for the DAW (flatten.js), and the library's definition of each sound it plays.
import fs from 'node:fs';
import path from 'node:path';
import { flatten } from '../arrange/flatten.js';
const here = path.dirname(new URL(import.meta.url).pathname);
export function songOf(id = 'r4-3'){
  const L = JSON.parse(fs.readFileSync(path.join(here, '../arrange/songs/round4.json'), 'utf8')), songs = Array.isArray(L) ? L : L.songs || Object.values(L);
  const P = flatten(songs.find(s => s.id === id)), lib = JSON.parse(fs.readFileSync(path.join(here, '../listen/packs/library.json'), 'utf8')).sounds;
  const SND = {}; for (const T of P.tracks) for (const s of [T.sound, ...T.clips.map(c => c.set.sound).filter(Boolean)]) SND[s] = lib.find(x => x.id === s);
  return {P, SND}; }
