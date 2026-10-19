// The drum lab: twelve grooves over the dotted plucked bass and the warm pad. Each its own kit and feel; no cowbell.
import { BPM, BARS, W, SWING, LOOP, pat, labScore, DEFAULT } from './kit.js';
export const meta = {title: 'Drum lab', part: 'drums', bpm: BPM, bars: BARS, warm: W, swing: SWING, seed: 41, over: 'the plucked dotted bass and the warm pad'};

// the kits on the drum buses, each kit's voices softened where the first tracks found them harsh
const kits = (d, name, over = {}) => ({kick: d.kit('kick', name, over), hats: d.kit('hats', name, over), kit: d.kit('drums', name, over), perc: d.kit('perc', name, over)});
const four = (d, k, vel = 1) => pat(d, k.kick, 'kick', 'X...x...x...x...', vel);

export const IDEAS = [
  {id: 'groove', name: 'Slow Bloom groove', words: 'The drums you heard in v3: accented, swinging hats, an opening hat, clap, shaker, rim.',
    build(d){ DEFAULT.drums.build(d); }},
  {id: '909', name: '909 drive', words: 'A 909 four to the floor, 16th closed hats, open hats on the off-beats, a ride, claps: classic techno.',
    build(d){ const k = kits(d, '909', {chh: {tone: .6, level: .9}, ohh: {tone: .55, level: .7}, ride: {level: .4, tone: .55}, clap: {level: .4}}); four(d, k);
      pat(d, k.hats, 'chh', 'xoxoxoxoxoxoxoxo', .55); pat(d, k.hats, 'ohh', '..x...x...x...x.', .7); pat(d, k.kit, 'clap', '....x.......x...', .8); pat(d, k.hats, 'ride', 'x.x.x.x.x.x.x.x.', .4); }},
  {id: 'tick', name: 'Minimal tick', words: 'Kick, a ticking rim and a few soft hats, no clap: dry, sparse and clicky.',
    build(d){ const k = kits(d, 'Minimal', {chh: {tone: .55, level: .9, decay: .4}, rim: {level: .6, tone: .7}}); four(d, k);
      pat(d, k.hats, 'chh', '..x...x...x...xo', .6); pat(d, k.perc, 'rim', '...x..x..x....x....x..x...x..x..', .65, {every: 2}); pat(d, k.perc, 'shaker', 'o.o.o.o.o.o.o.o.', .4); }},
  {id: 'broken', name: 'Broken beat', words: 'The kick off the grid, a snare on 3, ghost snares between: a broken, rolling feel.',
    build(d){ const k = kits(d, '909', {snare: {level: .7, tone: .7}, chh: {tone: .6, level: .8}}); pat(d, k.kick, 'kick', 'X.....x...x..x..', 1);
      pat(d, k.kit, 'snare', '........X.....o.', .7); pat(d, k.kit, 'snare', '...o......o.....', .35); pat(d, k.hats, 'chh', 'x.xox.xox.xox.xo', .5); }},
  {id: '808', name: '808 bounce', words: 'A long, round 808 kick with a skip, snappy clap, hats with swing: bouncy and warm.',
    build(d){ const k = kits(d, '808', {chh: {level: .8}, clap: {level: .6}}); pat(d, k.kick, 'kick', 'X...x...x.....x.', 1);
      pat(d, k.kit, 'clap', '....x.......x...', .8); pat(d, k.hats, 'chh', 'x.xxx.xxx.xxx.xx', .5, {nudge: .25}); pat(d, k.hats, 'ohh', '..............x.', .6, {every: 2}); }},
  {id: 'toms', name: 'Tribal toms', words: 'Four to the floor with low and high toms rolling around it, shaker on 16ths: tribal techno.',
    build(d){ const k = kits(d, 'Minimal', {tomL: {level: .9, decay: 1.1}, tomH: {level: .8, decay: 1}}); four(d, k);
      pat(d, k.perc, 'tomL', '...x.....x....x.', .7); pat(d, k.perc, 'tomH', '......x.....x...', .6); pat(d, k.perc, 'shaker', 'oxoxoxoxoxoxoxox', .45); pat(d, k.hats, 'ohh', '..x...x...x...x.', .55); }},
  {id: 'shuffle', name: 'Shuffled hats', words: 'Heavy swing on the off-16ths, a ride on the off-beats: a loose, shuffling groove.',
    build(d){ const k = kits(d, 'Minimal', {chh: {tone: .6, level: 1, decay: .6}, ride: {level: .45, tone: .5}, clap: {level: .3}}); four(d, k);
      pat(d, k.hats, 'chh', 'x.oxx.oxx.oxx.ox', .55, {nudge: .33}); pat(d, k.hats, 'ride', '..x...x...x...x.', .45); pat(d, k.kit, 'clap', '....x.......x...', .7); }},
  {id: 'lofi', name: 'Dusty lo-fi', words: 'The lo-fi kit, darker and saturated: a dusty, sampled feel with rim and shaker.',
    build(d){ const k = kits(d, 'Lo-fi'); four(d, k, .95); pat(d, k.hats, 'chh', '..x...x...x...x.', .7); pat(d, k.perc, 'rim', '....x.......x..o', .7); pat(d, k.perc, 'shaker', 'o.x.o.x.o.x.o.xo', .5); }},
  {id: 'ride', name: 'Ride drive', words: 'Kick, a ride on every 8th and open hats: driving and bright, no clap.',
    build(d){ const k = kits(d, '909', {ride: {level: .55, tone: .6}, ohh: {level: .6, tone: .55}}); four(d, k);
      pat(d, k.hats, 'ride', 'x.x.x.x.x.x.x.x.', .5); pat(d, k.hats, 'ohh', '..x...x...x...x.', .6); pat(d, k.perc, 'rim', '.......x.......x', .5); }},
  {id: 'sparse', name: 'Deep and sparse', words: 'Just the kick, a soft clap on 2 and 4 and one shaker figure: maximum space.',
    build(d){ const k = kits(d, 'Minimal', {clap: {level: .35, decay: 1.4}}); four(d, k); pat(d, k.kit, 'clap', '....x.......x...', .7); pat(d, k.perc, 'shaker', '..x.......x...x.', .45); }},
  {id: 'poly', name: 'Polyrhythm percussion', words: 'Clave every three 16ths and rim every five against the four: shifting, hypnotic.',
    build(d){ const k = kits(d, 'Minimal', {clave: {level: .45, tone: .6}, rim: {level: .5, tone: .6}}); four(d, k); pat(d, k.hats, 'chh', '..x...x...x...x.', .6);
      LOOP.forEach((bar, j) => { for (let g = j*16; g < (j + 1)*16; g++) { if (g % 3 === 0) d.hit(k.perc, 'clave', bar, g % 16, .5); if (g % 5 === 2) d.hit(k.perc, 'rim', bar, g % 16, .45); } }); }},
  {id: 'drive16', name: 'Straight 16ths', words: 'Straight closed hats on every 16th, accents on the off-beats, clap: tight, driving techno.',
    build(d){ const k = kits(d, 'Minimal', {chh: {tone: .6, level: 1, decay: .5}, clap: {level: .3}}); four(d, k);
      pat(d, k.hats, 'chh', 'oxXxoxXxoxXxoxXx', .5); pat(d, k.kit, 'clap', '....x.......x...', .75); }},
];
export const score = labScore('drums', IDEAS, ['bass', 'pad']);
