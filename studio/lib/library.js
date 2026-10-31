// The library, the same for every page: the packs' parts read as rhythms and notes, the even rhythms, and your own
// (saved from a card), as one list of items; each kind of part's rhythms in turn, for ‹ › on a part. Pure: the jam
// (its Library panel) and the DAW (‹ › on a sequencer row) read it, the tests run it in node.
import { split, fresh, spread } from '../jam/part.js';

// the even rhythms: [name, hits, length, rotation]
export const EVEN = [['Four on the floor', 4, 16], ['Off-beats', 4, 16, 2], ['Tresillo', 3, 8], ['Cinquillo', 5, 8], ['Five of sixteen', 5, 16], ['Seven of sixteen', 7, 16, 1], ['Nine of sixteen', 9, 16], ['Three of seven', 3, 7], ['Five of twelve', 5, 12], ['Four of eleven', 4, 11], ['Two of five', 2, 5], ['Seven of twelve', 7, 12]];
// a pack as the library reads it: {id, name, data} (the jam's fetched packs), or the pack itself (a bundled one)
const asPack = p => p.data ? p : {id: p.id, name: p.name, data: p};
const short = name => (name || '').split(':')[0];
// every item: {id, kind: rhythm | notes | part, role, name, from, R?, N?, words?}; yours first
export function libItems(packs, mine = []){ const out = [];
  for (const [name, k, n, r = 0] of EVEN) out.push({id: 'even:' + name, kind: 'rhythm', role: null, name, from: 'Even rhythms', R: fresh(spread('lead', k, n, r), name)});
  for (const p of packs.map(asPack)) for (const cl of p.data.clips || []) { const s = split(cl.role, cl, cl.name);
    out.push({id: `${p.id}:${cl.id}`, kind: 'part', role: cl.role, name: cl.name, from: short(p.name), R: s.rhythm, N: cl.role === 'chords' ? null : s.notes, words: cl.words || ''}); }
  return [...mine.map(x => ({...x, mine: true, from: 'Yours'})), ...out]; }
// each kind of part's rhythms from the packs, each once (the same steps in two packs counted once): {role: [{id, name, R}]}
export function rhythmsByRole(packs){ const by = {}, seen = new Set();
  for (const p of packs.map(asPack)) for (const cl of p.data.clips || []) { if (!cl.steps?.length) continue; const key = cl.role + JSON.stringify(cl.steps); if (seen.has(key)) continue; seen.add(key);
    (by[cl.role] ||= []).push({id: `${p.id}:${cl.id}`, name: cl.name, from: short(p.name), R: split(cl.role, cl, cl.name).rhythm}); }
  return by; }
// the item d steps on from the one with id `at` (round the list; from outside it, the first or the last): {item, i}
export function stepIn(list, at, d){ if (!list?.length) return null; const k = list.findIndex(x => x.id === at), i = ((k < 0 ? (d > 0 ? -1 : 0) : k) + d + list.length) % list.length; return {item: list[i], i}; }
