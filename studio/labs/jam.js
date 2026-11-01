// The jam: the user's liked (and maybe) ideas from every lab as clips in rows (kick, drums, bass, pad, lead, bells), each
// rendered alone in time with the same 16-bar loop, so the jam page plays one clip per row together and swaps any of them
// live. The kick is rendered once per kick pattern (four to the floor, or the broken beat's), so a drum groove brings its own
// kick pattern in whichever kick sound is picked.
import { BPM, BARS, W, SWING, LOOP, GOOD_KICK, setup, synth, bars, BUSES } from './kit.js';
import * as BASS1 from './bass.js';
import * as BASS2 from './bass2.js';
import * as PADS from './pads.js';
import * as LEADS from './leads.js';
import * as BELLS from './bells.js';
import * as DRUMS2 from './drums2.js';
export const meta = {title: 'Jam', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 71, chords: ['Am9', 'Fmaj9', 'Dm9', 'Em7']};

// the kick sounds (over the liked kick's settings), and the patterns they're rendered in
const KICKS = {
  round: ['Roundest', 'Your pick: no drive, a darker tone, round and clean.', {drive: 0, tone: .3}],
  low: ['Lower', 'Two semitones lower: darker, weightier.', {tune: -3}],
  short: ['Shorter', 'A shorter tail: tight, more room for the bass.', {decay: .55}],
  soft: ['Softer punch', 'Less attack: a rounder, gentler thud.', {x: .28}],
  808: ['Round 808', "The 808's long, round kick, tamed.", {decay: 1.6, x: .3, drive: 0, tone: .38, tune: -2}, '808'],
  click: ['With a click', 'A brighter tone, the beater click coming through.', {tone: .68, x: .6}, 'Minimal', 1],
  punch: ['More punch', 'More of the pitch drop at the front.', {x: .75}, 'Minimal', 1],
};
export const KICK_PATS = {four: 'X...x...x...x...', broken: 'X.....x...x..x..'};

// a clip from a lab's idea: its id in the jam, the lab and idea it came from, whether it was a maybe, its kick pattern
const from = (row, mod, id, maybe = 0, kick) => { const i = mod.IDEAS.find(x => x.id === id); return {row, id: `${row}-${id}`, name: i.name, words: i.words, maybe, kick, idea: i}; };
// the first bass lab's ideas are a sound and a motif (not a build): wrapped onto the bass bus
const bass1 = id => { const c = from('bass', BASS1, id); const i = c.idea;
  c.idea = {build(d){ const s = synth(d, 'bass', i.preset, i.sound); if (i.echo != null) d.buses.bass.a.gain.value = Math.pow(10, i.echo/20);
    bars((bar, k, ch, r, t) => i.play((n, st, l, v) => d.note(s, n, bar, st, l, v), r, t, k)); }};
  return c; };

export const ROWS = [
  {key: 'kick', label: 'Kick', clips: ['round', 'low', 'short', 'soft', '808', 'click', 'punch'].map(id => { const [name, words, , , maybe] = KICKS[id]; return {row: 'kick', id: `kick-${id}`, name, words, maybe: maybe || 0}; })},
  {key: 'drums', label: 'Drums', note: 'without their kick: the kick row plays it in their pattern', clips: [
    from('drums', DRUMS2, 'groove'), from('drums', DRUMS2, 'bellgroove'), from('drums', DRUMS2, 'metal5'), from('drums', DRUMS2, 'toms'),
    from('drums', DRUMS2, 'toms3'), from('drums', DRUMS2, 'lofi'), from('drums', DRUMS2, 'lofishuffle'),
    from('drums', DRUMS2, 'broken', 0, 'broken'), from('drums', DRUMS2, 'brokentoms', 0, 'broken')]},
  {key: 'bass', label: 'Bass', clips: [
    from('bass', BASS2, 'berlin-glass'), from('bass', BASS2, 'berlin-clean'), from('bass', BASS2, 'berlin-leap'), from('bass', BASS2, 'detroit-clean'),
    bass1('berlin'), bass1('detroit'), bass1('octfunk'), bass1('walk9'), bass1('bell'), bass1('dub'),
    from('bass', BASS2, 'octfunk-clean', 1), from('bass', BASS2, 'octfunk-pluck', 1), from('bass', BASS2, 'walk9-oct', 1)]},
  {key: 'pad', label: 'Pad', clips: ['warm', 'glass', 'gated', 'dotted', 'dub', 'sweep'].map(id => from('pad', PADS, id))},
  {key: 'lead', label: 'Lead', clips: [...['arp', 'fifths', 'marimba', 'onenote'].map(id => from('lead', LEADS, id)), ...['bell', 'dubstab', 'hook'].map(id => from('lead', LEADS, id, 1))]},
  {key: 'bells', label: 'Bells, metal, wood', clips: [...['kalimba', 'vibes', 'musicbox', 'steel', 'wood', 'marimba-arp'].map(id => from('bells', BELLS, id)), ...['metal', 'tubular'].map(id => from('bells', BELLS, id, 1))]},
];
// the bus each row plays on (bells share the lead's bus: rendered apart, so they never meet there)
const BUS = {kick: ['kick'], drums: ['hats', 'drums', 'perc'], bass: ['bass'], pad: ['pad'], lead: ['lead'], bells: ['lead']};
// every stem to render: each clip, the kicks once per pattern
export const STEMS = ROWS.flatMap(r => r.key === 'kick' ? r.clips.flatMap(c => Object.keys(KICK_PATS).map(p => `${c.id}~${p}`)) : r.clips.map(c => c.id));

export function score(d){
  setup(d);
  const [id, pat] = d.variant.split('~'), row = id.split('-')[0];
  if (row === 'kick') {
    const [, , over, kit = 'Minimal'] = KICKS[id.slice(5)], k = d.kit('kick', kit, {kick: {...GOOD_KICK, ...over}}), p = KICK_PATS[pat];
    for (const bar of LOOP) for (let s = 0; s < 16; s++) if (p[s] !== '.') d.hit(k, 'kick', bar, s, p[s] === 'X' ? 1 : .92);
  } else ROWS.find(r => r.key === row).clips.find(c => c.id === id).idea.build(d);
  d.solo(BUS[row]);
}
