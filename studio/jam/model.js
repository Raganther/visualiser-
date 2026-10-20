// Studio Jam's model: clips that follow the harmony. A pitched clip doesn't store notes: it stores a rhythm and a contour
// through the chord (each step a rung of the chord's ladder: its tones in order up the octaves), so the same clip plays over
// any chord and any progression. A drum clip stores which voice hits on each step. A clip has its own length in 16ths
// (6, 12, 13 … so clips go round against each other) and a few variations. A harmony is a list of chord symbols, one a bar.
import { chord, voice } from '../lib/palette.js';

// a chord's ladder: its tones as pitch classes in order (root first), repeating up the octaves; rung k from base
export const ladder = (c, base, k) => { const pcs = [...new Set(c.tones.map(t => t % 12))].sort((a, b) => a - b), n = pcs.length;
  return base + pcs[((k % n) + n) % n] + 12*Math.floor(k/n); };
// each role's register: where its rung 0 sits (the bass an octave over the chord's root, the lead two)
export const REGISTER = {bass: c => c.root + 12, lead: c => c.root + 24, chords: () => 57};
// the notes a clip plays at one of its steps over a chord: [[midi or voice, len16, vel], …]
export function notesAt(clip, step, c){
  const out = [];
  for (const s of clip.steps) { if (s[0] !== step) continue;
    if (clip.role === 'kick' || clip.role === 'hats' || clip.role === 'perc') out.push([s[1], 1, s[2]]);
    else if (s[1] === 'chord') for (const n of voice(c, s[4] ?? 57)) out.push([n, s[2], s[3]]);
    else out.push([ladder(c, REGISTER[clip.role](c), s[1]) + 12*(s[4] || 0), s[2], s[3]]); }
  return out;
}
export const chordOf = (h, bar) => chord(h.bars[((bar % h.bars.length) + h.bars.length) % h.bars.length]);
export const ROLES = ['kick', 'hats', 'perc', 'bass', 'chords', 'lead'];
export const ROLE_NAMES = {kick: 'Kick', hats: 'Hats', perc: 'Percussion', bass: 'Bass', chords: 'Chords', lead: 'Bells and leads'};
// a small random change to a clip (Mutate): a step moved a 16th, a rung up or down, a step added or dropped, an accent moved
export function mutate(clip, rnd = Math.random){
  const steps = clip.steps.map(s => s.slice()), pitched = !['kick', 'hats', 'perc'].includes(clip.role), i = Math.floor(rnd()*steps.length), s = steps[i], r = rnd();
  if (!s) return {...clip, steps};
  if (r < .3 && pitched && s[1] !== 'chord') s[1] += rnd() < .5 ? 1 : -1;
  else if (r < .55) { const to = (s[0] + (rnd() < .5 ? 1 : -1) + clip.len) % clip.len; if (!steps.some(x => x[0] === to)) s[0] = to; }
  else if (r < .75 && steps.length > 2) steps.splice(i, 1);
  else if (r < .9) { const at = Math.floor(rnd()*clip.len); if (!steps.some(x => x[0] === at)) { const c = s.slice(); c[0] = at; steps.push(c); } }
  else { const vi = pitched ? 3 : 2; s[vi] = s[vi] > .85 ? .6 : 1; }
  return {...clip, steps: steps.sort((a, b) => a[0] - b[0])};
}

// the macros, shared by the page and the render of a jam: tone → the channel's filter; length → the decay (LEN times)
export const cutOf = x => 260*Math.pow(2, x*6.2);
export const LEN = [.45, 1, 2.2];
// a native note's settings now: the mallet from tone, the ring from length
export function nativeSet(c, name, base = {}){ const o = {...base};
  if (['marimba', 'kalimba', 'steel', 'musicbox', 'vibes', 'wood', 'tubular', 'bell', 'plate', 'glass'].includes(name)) { o.hard = Math.round((.2 + .75*c.x)*4)/4; o.ring = LEN[c.length]; }
  else if (['kick', 'tom', 'hand'].includes(name)) { o.decay = (o.decay ?? (name === 'kick' ? .45 : .5))*LEN[c.length]; o.hard = Math.round((.2 + .7*c.x)*4)/4; }
  else if (name === 'hat') o.decay = (o.decay ?? .06)*LEN[c.length];
  else if (name.startsWith('fm')) { o.index = Math.round((.4 + 3.2*c.x)*4)/4; o.dec = .25*LEN[c.length]; }
  else if (name === 'pluck') { o.bright = Math.round((.15 + .8*c.x)*4)/4; o.damp = [.985, .993, .997][c.length]; }
  return o; }
