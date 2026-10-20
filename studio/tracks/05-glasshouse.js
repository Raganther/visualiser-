// Glasshouse: the brightest of the set, a progression in C major (Cmaj9, Am9, Fmaj9, G6/9, four bars each). The glass
// sequence the user saved on every chord, a music box arpeggio, gated 16th chords, tubular bells in the breakdown.
// v2, from the user's notes on v1: no clap; no pad: the gated 16th chord they loved ("transcending into a higher
// dimension, the openness") carries the harmony instead, from the intro, closed at first and opening, an LFO on its filter,
// its accents and voicings moving every eight bars; the glass bass line runs the whole song.
import { buses, kick, kits, synth, chord, cycle, voice, each, bar16, kickBar, hatBar, ohhBar, cloud } from '../lib/palette.js';
export const meta = {title: 'Glasshouse', bpm: 124, bars: 128, swing: .06, seed: 55, version: 3, key: 'C major: Cmaj9, Am9, Fmaj9, G6/9',
  words: 'v3: the music box and tubular bells are now native (struck bars and tubes computed from their physics), and a bell cloud blooms through the breakdown; otherwise as v2. v2, from your notes: no clap and no pad. The gated 16th chord you loved carries the harmony from the intro, closed at first and opening, an LFO on its filter, its accents and voicings moving every eight bars; your glass bass line runs the whole song; a rim and shaker groove off the beats.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

export function score(d){
  buses(d, {chords: {level: 6, width: 1.7, filter: {cut: 900, q: 1.4}, a: -6, b: -6}});
  const wash = d.addReturn('wash', 'delay', {div: 3, fb: .62, tone: 3000}, {level: -4, width: 1.7, pump: {depth: .5, rel: .6}, hp: 300});
  const toWash = d.send('chords', 'wash');
  const K = kick(d, 'round'), {hats, drums, perc} = kits(d), v = x => x*(.92 + d.rand()*.16), B = d.buses;
  const H = cycle([['C:maj9', 4], ['A:m9', 4], ['F:maj9', 4], ['G:69', 4]]), home = cycle([['C:maj9', 8], ['A:m9', 8]]);
  const chordAt = bar => bar >= 32 && bar < 120 ? H(bar) : home(bar);
  const bass = synth(d, 'bass', 'glass'), box = synth(d, 'bells', 'musicbox'), gate = synth(d, 'chords', 'gated'), tub = synth(d, 'lead', 'tubular');

  /* ---------- drums: no clap; a rim and shaker groove off the beats ---------- */
  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[4, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .7 : 1));
  each([[32, 70], [88, 116]], bar => ohhBar(d, hats, bar));
  each([[96, 116]], bar => bar16(d, hats, 'ride', bar, 'x.x.x.x.x.x.x.x.', .38));
  each([[24, 72], [88, 120]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .5));
  each([[40, 72], [92, 116]], bar => bar16(d, perc, 'rim', bar, bar % 2 ? '...x......x..x..' : '......x..x....x.', .55));
  d.hit(drums, 'crash', 88, 0, .6); d.hit(drums, 'crash', 104, 0, .4);

  /* ---------- the glass sequence on each chord's tones, the whole song (8ths in the first bars) ---------- */
  const seq = [0, 2, 3, 4, 1, 2, 0, 3];
  each([[0, 126]], bar => { const c = chordAt(bar); for (let s = 0; s < 16; s++) { if (bar < 12 && s % 2) continue; if (bar >= 72 && bar < 80 && s % 4 === 3) continue;
    d.note(bass, c.root + 12 + c.tones[seq[s % 8]] - (c.root > 33 ? 12 : 0), bar, s, .9, v(.55 + .1*(bar % 4)/3 + (s % 4 ? 0 : .15))); } });
  d.ramp(B.bass.filter.frequency, [[0, 500], [16, 1500], [48, 2600], [72, 900], [86, 2800], [88, 2600], [124, 500]], {exp: true});
  d.lfo(B.bass.filter.frequency, {beats: 16, depth: [[16, 0], [48, 500], [72, 300], [88, 600], [124, 0]]});

  /* ---------- the gated chord: every 16th, from the intro, its accents and voicing moving every eight bars ---------- */
  const ACC = ['..x...x...x...x.', '..x..x...x..x...', 'x..x..x..x..x..x', '..x...x..x.x..x.'];
  const LO = [60, 60, 62, 64, 62, 60, 57, 60, 62, 64, 64, 62, 60, 60, 57, 57];
  each([[0, 128]], bar => { const ns = voice(chordAt(bar), LO[Math.floor(bar/8) % LO.length]), acc = ACC[Math.floor(bar/8) % ACC.length], brk = bar >= 72 && bar < 88;
    for (let s = 0; s < 16; s++) { if (bar < 8 && s % 2) continue; if (brk && s % 2) continue;
      d.chord(gate, ns, bar, s, brk ? 1.6 : .8, v(acc[s] === 'x' ? .52 : .3)); } });
  d.ramp(B.chords.filter.frequency, [[0, 400], [16, 900], [32, 1400], [48, 2200], [71, 4000], [72, 1200], [86, 5000], [88, 2200], [112, 4500], [124, 700]], {exp: true});
  d.lfo(B.chords.filter.frequency, {beats: 16, depth: [[0, 100], [16, 400], [48, 900], [72, 500], [88, 1200], [124, 100]], rate: [[0, 16], [48, 8], [64, 4], [72, 16], [96, 8], [108, 4], [116, 16]]});
  d.ramp(B.chords.filter.Q, [[0, 1.2], [48, 2.5], [71, 4], [72, 1.5], [108, 4], [124, 1.2]]);
  d.morph(gate, 'ad', [[0, .1], [48, .14], [72, .3], [88, .12], [108, .2], [124, .1]], 2);
  d.ramp(toWash, [[0, 0], [64, 0], [72, .35], [86, .5], [88, .05], [104, .05], [112, .25], [124, 0]]);

  /* ---------- the music box: up the chord on 16ths, an octave higher from the tenth step ---------- */
  each([[48, 72], [96, 120]], bar => { const c = chordAt(bar); for (let s = 0; s < 16; s++) d.note(box, c.root + 36 + c.tones[s % 5] + (s >= 10 ? 12 : 0) - (c.root > 33 ? 12 : 0), bar, s, 1, v(.32 + .08*(bar % 4))); });
  d.ramp(B.bells.filter.frequency, [[48, 2500], [70, 9000], [96, 3000], [118, 9000]], {exp: true});
  // the breakdown: tubular bells on root and fifth over the gated chord
  each([[72, 88]], (bar, k) => { const c = H(bar); if (k % 2 === 0) d.note(tub, c.root + 36, bar, 0, 8, .6); else d.note(tub, c.root + 43, bar, 6, 8, .5); });
  // v3: a bell cloud on C, D and G blooming through the breakdown
  cloud(d, 'fx', 72, 16, {f0: 523.25, pitches: [1, 1.125, 1.5, 2]});
  d.noise('fx', 80, 88, {f0: 300, f1: 7000, peak: -7});
}
