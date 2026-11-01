// Night Ferry: dub, suspended harmony that never settles: Dsus2, Bb maj7#11 (Lydian), Fsus2, Cadd9, four bars each.
// Lazy lo-fi drums, dub chord swells into a long echo, tubular bells far off, the dub sub one note a bar, the sweeping pad.
import { buses, kick, kits, synth, chord, cycle, voice, each, bar16, kickBar } from '../lib/palette.js';
export const meta = {title: 'Night Ferry', bpm: 118, bars: 120, swing: .1, seed: 77, version: 2, key: 'D, suspended: Dsus2, Bbmaj7#11, Fsus2, Cadd9',
  words: 'v2: the tubular bells are now native (a tube\'s beating partials); otherwise as v1. Dub, with suspended chords that never settle (Dsus2, B flat Lydian, Fsus2, Cadd9, four bars each). Lazy lo-fi drums, dub chord swells into a long echo, tubular bells far off, a dub sub, the sweeping pad.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Drift', 88, 112], ['Outro', 112, 120]];

export function score(d){
  buses(d, {delay: {div: 6, fb: .55, tone: 1600}, chords: {a: 0, b: -3, filter: {cut: 1200, q: 1}}, bells: {a: -3, b: -2}});
  const K = kick(d, 'round', {decay: 1}), {hats, perc} = kits(d, {kit: 'Lo-fi'}), v = x => x*(.92 + d.rand()*.16);
  const H = cycle([['D:sus2', 4], ['Bb:lyd', 4], ['F:sus2', 4], ['C:add9', 4]]);
  const bass = synth(d, 'bass', 'dubSub', {drive: .15}), dub = synth(d, 'chords', 'dub'), tub = synth(d, 'bells', 'tubular'), pad = synth(d, 'pad', 'sweep');

  each([[0, 72], [88, 116]], bar => kickBar(d, K, bar, bar % 4 === 3 ? 'X...x...x...x.x.' : 'X...x...x...x...', .95));
  each([[8, 72], [88, 116]], bar => bar16(d, hats, 'chh', bar, 'x.oxx.oxx.oxx.ox', .5));
  each([[16, 72], [92, 112]], bar => bar16(d, perc, 'rim', bar, bar % 2 ? '..x...x...x...x.' : '..x...x...x..xx.', .45));
  each([[24, 72], [88, 112]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.x.o.x.o.xo', .45));

  // the dub sub: on the first off-beat, the fifth now and then
  each([[16, 72], [88, 116]], bar => { const c = H(bar); d.note(bass, c.root + 12, bar, 2, 3, v(.9)); if (bar % 2) d.note(bass, c.root + 19, bar, 10, 2, v(.65)); });
  each([[72, 88]], (bar, k) => { if (k % 4 === 0) d.note(bass, H(bar).root + 12, bar, 0, 60, .5); });

  // dub chord swells on the off-beats, into the long echo; a third one creeps in each fourth bar
  each([[8, 72], [80, 116]], bar => { const ns = voice(H(bar), 57); for (const s of bar % 4 === 3 ? [2, 10, 14] : [2, 10]) d.chord(dub, ns, bar, s, 4, v(.55)); });
  d.ramp(d.buses.chords.filter.frequency, [[8, 500], [32, 1200], [64, 2200], [72, 900], [88, 1400], [104, 2600], [116, 600]], {exp: true});

  // tubular bells, far off: the chord's root, its ninth an answer
  each([[32, 72], [72, 112]], (bar, k) => { const c = H(bar); if (bar % 4 === 0) d.note(tub, c.root + 36, bar, 0, 10, .55); if (bar % 4 === 2) d.note(tub, c.root + 38, bar, 8, 10, .45); });
  each([[0, 120]], bar => { if (bar % 4 === 0) d.chord(pad, voice(H(bar), 52), bar, 0, 63, .55); });
  d.ramp(d.buses.pad.level, [[0, .8], [16, .45], [72, .45], [74, 1], [88, .5], [112, .6], [120, 0]]);
  d.noise('fx', 84, 88, {f0: 400, f1: 4000, peak: -12});
}
