// The kick lab: twelve kicks around the one the user liked (the Slow Bloom kick, "round, punchy"), each alone as a stem over
// everything else (the groove's hats, clap and percussion, the dotted plucked bass, the warm pad): shorter and longer, lower
// and higher, more and less punch, rounder, warmer, a click, an 808, a sub under it.
import { BPM, BARS, W, SWING, LOOP, GOOD_KICK, setup, DEFAULT, SINE } from './kit.js';
export const meta = {title: 'Kick lab', part: 'kick', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 51, over: 'the groove without its kick, the plucked bass and the warm pad'};

const kick = (id, name, words, over = {}, {kit = 'Minimal', sub} = {}) => ({id, name, words, build(d){
  const k = d.kit('kick', kit, {kick: {...GOOD_KICK, ...over}});
  for (const bar of LOOP) for (let b = 0; b < 4; b++) d.hit(k, 'kick', bar, b*4, b ? .92 : 1);
  // a sine sub under it: a short low A on every beat
  if (sub) { const s = d.synth('kick', 'Sub bass', {chord: 0, w1: SINE, sub: 0, aa: .002, ad: .22, as: 0, ar: .05, oct: 0, mode: 0, drive: .1, level: sub});
    for (const bar of LOOP) for (let b = 0; b < 4; b++) d.note(s, 33, bar, b*4, 1.5, .9); } }});

export const IDEAS = [
  kick('ref', 'The one you liked', 'The Slow Bloom kick as it is: round, punchy, tuned down a little.'),
  kick('short', 'Shorter', 'The same kick with a shorter tail: tighter, more room for the bass.', {decay: .55}),
  kick('long', 'Longer boom', 'A longer tail: more boom between the beats, deeper.', {decay: 1.3}),
  kick('low', 'Lower', 'Tuned two semitones lower: darker, weightier.', {tune: -3}),
  kick('high', 'Higher', 'Tuned two semitones higher: tighter, more knock.', {tune: 1}),
  kick('punch', 'More punch', 'More of the fast pitch drop at the front: harder attack, same body.', {x: .75}),
  kick('soft', 'Softer punch', 'Less of the attack: a rounder, gentler thud.', {x: .28}),
  kick('round', 'Roundest', 'No drive and a darker tone: as round and clean as it gets.', {drive: 0, tone: .3}),
  kick('warm', 'Warm saturation', 'A little more drive with a darker tone: warm and thick, not squelchy.', {drive: .28, tone: .34}),
  kick('click', 'With a click', 'A brighter tone so the beater click comes through: defined on small speakers.', {tone: .68, x: .6}),
  kick('808', 'Round 808', "The 808's long, round kick, tamed: deep and soft.", {decay: 1.6, x: .3, drive: 0, tone: .38, tune: -2}, {kit: '808'}),
  kick('sub', 'With a sub under it', 'The kick you liked with a short sine sub layered under each beat: more weight below.', {}, {sub: .55}),
];

export function score(d){
  setup(d);
  const idea = IDEAS.find(i => i.id === d.variant);
  if (idea) { idea.build(d); d.solo(['kick']); }
  else { DEFAULT.drums.build(d, {noKick: true}); DEFAULT.bass.build(d); DEFAULT.pad.build(d); d.solo(['hats', 'drums', 'perc', 'bass', 'pad']); }
}
