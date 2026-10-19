// Drum lab 2: the user's liked grooves (the Slow Bloom groove, broken beat, dusty lo-fi, tribal toms) all on the liked kick,
// and polyrhythms again (they like them; the clave-and-rim one wasn't it), made of metal and bells: ride bells, metallic
// hats, toms in threes.
import { BPM, BARS, W, SWING, LOOP, GOOD_KICK, pat, labScore, DEFAULT } from './kit.js';
export const meta = {title: 'Drum lab 2', part: 'drums', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 42, over: 'the plucked dotted bass and the warm pad'};

// the kits, every one with the liked kick
const kits = (d, name, over = {}) => { const o = {...over, kick: {...GOOD_KICK, ...(over.kick || {})}};
  return {kick: d.kit('kick', 'Minimal', {kick: o.kick}), hats: d.kit('hats', name, o), kit: d.kit('drums', name, o), perc: d.kit('perc', name, o)}; };
const four = (d, k, vel = 1) => pat(d, k.kick, 'kick', 'X...x...x...x...', vel);
// every n 16ths across the whole loop, from offset o: a cycle that runs against the bar
const every = (d, kit, voice, n, o, vel, lock) => LOOP.forEach((bar, j) => { for (let g = j*16; g < (j + 1)*16; g++) if ((g - o) % n === 0 && g >= o) d.hit(kit, voice, bar, g % 16, vel*(.9 + d.rand()*.15), lock); });

export const IDEAS = [
  {id: 'groove', name: 'Slow Bloom groove', words: 'The groove you liked, kick as it was: the reference.', build(d){ DEFAULT.drums.build(d); }},
  {id: 'broken', name: 'Broken beat, round kick', words: 'The broken beat you liked, the aggressive 909 kick swapped for the round one.',
    build(d){ const k = kits(d, '909', {snare: {level: .7, tone: .7}, chh: {tone: .6, level: .8}}); pat(d, k.kick, 'kick', 'X.....x...x..x..', 1);
      pat(d, k.kit, 'snare', '........X.....o.', .7); pat(d, k.kit, 'snare', '...o......o.....', .35); pat(d, k.hats, 'chh', 'x.xox.xox.xox.xo', .5); }},
  {id: 'toms', name: 'Tribal toms, round kick', words: 'The tribal toms you liked, without the squelchy kick.',
    build(d){ const k = kits(d, 'Minimal', {tomL: {level: .9, decay: 1.1}, tomH: {level: .8, decay: 1}}); four(d, k);
      pat(d, k.perc, 'tomL', '...x.....x....x.', .7); pat(d, k.perc, 'tomH', '......x.....x...', .6); pat(d, k.perc, 'shaker', 'oxoxoxoxoxoxoxox', .45); pat(d, k.hats, 'ohh', '..x...x...x...x.', .55); }},
  {id: 'lofi', name: 'Dusty lo-fi, round kick', words: 'The lo-fi kit you liked with the round kick in front.',
    build(d){ const k = kits(d, 'Lo-fi'); four(d, k, .95); pat(d, k.hats, 'chh', '..x...x...x...x.', .7); pat(d, k.perc, 'rim', '....x.......x..o', .7); pat(d, k.perc, 'shaker', 'o.x.o.x.o.x.o.xo', .5); }},
  {id: 'bell3', name: 'Ride bells in threes', words: 'The groove with a ride bell every three 16ths: a ringing metal cycle against the four.',
    build(d){ DEFAULT.drums.build(d); const r = d.kit('perc', '909', {ride: {x: .95, level: .5, tone: .65, decay: .7, pan: .3}}); every(d, r, 'ride', 3, 0, .55); }},
  {id: 'metal5', name: 'Metal in fives', words: 'Bright metallic hats every five 16ths over the groove: a shimmer that turns over every five bars.',
    build(d){ DEFAULT.drums.build(d); const m = d.kit('perc', '808', {chh: {x: 1, tone: .8, level: .7, decay: .5, pan: -.35}}); every(d, m, 'chh', 5, 2, .6); }},
  {id: 'bells35', name: 'Bells, three against five', words: 'Kick and hats with two bells: a ride bell in threes and a metal tick in fives, crossing over.',
    build(d){ const k = kits(d, 'Minimal', {chh: {tone: .6, level: .8}}); four(d, k); pat(d, k.hats, 'chh', '..x...x...x...x.', .6); pat(d, k.kit, 'clap', '....x.......x...', .6);
      const r = d.kit('perc', '909', {ride: {x: .95, level: .5, tone: .65, decay: .6, pan: .35}, chh: {x: 1, tone: .85, level: .55, decay: .35, pan: -.35}});
      every(d, r, 'ride', 3, 0, .55); every(d, r, 'chh', 5, 1, .5); }},
  {id: 'toms3', name: 'Toms in threes', words: 'The tribal toms recast as a three-against-four pattern, low and high answering.',
    build(d){ const k = kits(d, 'Minimal', {tomL: {level: .9, decay: 1}, tomH: {level: .75, decay: .9}}); four(d, k); pat(d, k.hats, 'ohh', '..x...x...x...x.', .5);
      every(d, k.perc, 'tomL', 6, 3, .65); every(d, k.perc, 'tomH', 6, 0, .5); pat(d, k.perc, 'shaker', 'o.o.o.o.o.o.o.o.', .4); }},
  {id: 'brokentoms', name: 'Broken with toms', words: 'The broken beat with toms filling the gaps: rolling and loose.',
    build(d){ const k = kits(d, '909', {snare: {level: .65, tone: .7}, tomL: {level: .7}, tomH: {level: .6}}); pat(d, k.kick, 'kick', 'X.....x...x..x..', 1);
      pat(d, k.kit, 'snare', '........X.......', .7); pat(d, k.perc, 'tomL', '....x........x..', .55); pat(d, k.perc, 'tomH', '..x.......x.....', .45); pat(d, k.hats, 'chh', 'x.x.x.x.x.x.x.x.', .45); }},
  {id: 'lofishuffle', name: 'Lo-fi shuffle', words: 'The lo-fi kit with swung hats and a rim on the off-beats: lazy and dusty.',
    build(d){ const k = kits(d, 'Lo-fi'); four(d, k, .95); pat(d, k.hats, 'chh', 'x.oxx.oxx.oxx.ox', .55, {nudge: .3}); pat(d, k.perc, 'rim', '..x...x...x...x.', .5); }},
  {id: 'bellgroove', name: 'Groove with bell accents', words: 'The Slow Bloom groove with a ride bell on the last 16th of each beat: a light metal lift.',
    build(d){ DEFAULT.drums.build(d); const r = d.kit('perc', '909', {ride: {x: .9, level: .45, tone: .6, decay: .5, pan: .25}}); pat(d, r, 'ride', '...x...x...x...x', .5); }},
  {id: 'hatpoly', name: 'Hats in sevens', words: 'Closed hats accented every seven 16ths over steady 8ths: an off-kilter metallic lilt.',
    build(d){ const k = kits(d, 'Minimal', {chh: {tone: .65, level: 1, x: .7}}); four(d, k); pat(d, k.kit, 'clap', '....x.......x...', .65);
      pat(d, k.hats, 'chh', 'x.x.x.x.x.x.x.x.', .35); every(d, k.hats, 'chh', 7, 3, .85, {decay: 1.2}); }},
];
export const score = labScore('drums', IDEAS, ['bass', 'pad']);
