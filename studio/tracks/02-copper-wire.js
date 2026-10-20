// Copper Wire: minimal over an A pedal. The glass sequence the user saved, metal hats in fives, a steel drum in threes, a
// one-note ping at the peak. v2, from the user's notes on v1: the pad pumps and moves (a deep sidechain, a slow filter LFO,
// gated off-beat chords) and drifts through suspended voicings over the A that never resolve; the breakdown leaves the A
// for a progression that hangs on a suspended E, which the drop resolves; the bass grows from the intro's notes into the
// riff a few 16ths at a time, and evolves (its filter, resonance, decay and echo moving all the way); the steel drum and the
// ping bloom under automation (filters, resonance, LFOs speeding up, echo washes, reverb throws) and the ping's one note
// grows into a phrase over the peak.
import { buses, kick, kits, synth, chord, cycle, each, every, hits, bar16, kickBar, hatBar, ohhBar, cloud } from '../lib/palette.js';
export const meta = {title: 'Copper Wire', bpm: 125, bars: 128, swing: .06, seed: 21, version: 3, key: 'A pedal, suspended; breakdown Fmaj7#11, Gsus2, Dsus2, E7sus',
  words: 'v3: the steel drum is now the native one (a pan\'s note computed from its physics), and a bell cloud blooms through the breakdown; otherwise as v2. v2, from your notes: the pad pumps and moves, drifting through suspended chords over the A that never resolve; the breakdown leaves the A for a progression that hangs on a suspended E until the drop; the bass grows from the intro\'s notes into the riff a few at a time and keeps evolving; the steel drum and the ping bloom under automation (filters, resonance, speeding LFOs, echo washes, reverb throws), and the ping grows from one note into a phrase.'};
export const SECTIONS = [['Intro', 0, 16], ['Groove', 16, 48], ['Lift', 48, 72], ['Breakdown', 72, 88], ['Peak', 88, 112], ['Outro', 112, 128]];

// the pad's voicings over the A pedal: suspended, each four bars, never landing on a plain A minor
const SUS = [[64, 69, 71, 74], [65, 67, 72, 76], [62, 67, 69, 74], [64, 66, 69, 71], [64, 69, 71, 76], [62, 65, 67, 72], [62, 64, 69, 74], [64, 67, 71, 74]];
// the breakdown: away from the A, a suspended E at the end that the drop resolves (bass root, voicing)
const BRK = [[29, [64, 67, 69, 71]], [31, [62, 69, 71, 74]], [26, [64, 66, 69, 71]], [28, [62, 64, 69, 71]]];
// the notes over the A that the steel drum and the ping use: A B D E G (they sit inside every suspended voicing)
const SUSP = [57, 59, 62, 64, 67, 69, 71, 74, 76, 79];

export function score(d){
  buses(d, {pad: {pump: {depth: .9, rel: .75}, filter: {cut: 1600, q: 1.2}}, bells: {filter: {cut: 2500, q: 2}}, lead: {filter: {cut: 1200, q: 3}}, bass: {filter: {cut: 900, q: 1.5}}});
  const wash = d.addReturn('wash', 'delay', {div: 3, fb: .68, tone: 2600}, {level: -2, width: 1.6, pump: {depth: .5, rel: .6}, hp: 250});
  const toWash = {bells: d.send('bells', 'wash'), lead: d.send('lead', 'wash'), bass: d.send('bass', 'wash')};
  const K = kick(d, 'round'), {hats, drums, perc, bell} = kits(d), v = x => x*(.92 + d.rand()*.16);
  const Am = chord('A:m9');
  const bass = synth(d, 'bass', 'glass'), steel = synth(d, 'bells', 'steel'), ping = synth(d, 'lead', 'ping'), pad = synth(d, 'pad', 'warm', {aa: .6, lamt: .25});
  const gate = synth(d, 'pad', 'gated', {level: .32});
  const brk = bar => bar >= 72 && bar < 88, B = d.buses;

  /* ---------- the drums, as v1 (the hats the user liked) ---------- */
  each([[0, 72], [88, 124]], bar => { kickBar(d, K, bar); if (bar % 8 === 7 && bar > 16) d.hit(K, 'kick', bar, 15, .35); });
  each([[4, 72], [88, 120]], bar => hatBar(d, hats, bar, bar < 16 ? .65 : 1));
  each([[24, 70], [92, 116]], bar => ohhBar(d, hats, bar));
  each([[16, 72], [88, 112]], bar => bar16(d, drums, 'clap', bar, '....x.......x...', .7));
  each([[32, 72], [88, 120]], bar => bar16(d, perc, 'shaker', bar, 'o.x.o.xoo.x.o.xo', .5));
  each([[40, 72], [96, 112]], bar => bar16(d, perc, 'rim', bar, bar % 2 ? '...x..x....x..x.' : '...x.....x..x...', .6));
  every(32, 72, 5, 2, (bar, s) => d.hit(bell, 'chh', bar, s, v(.55)));
  every(90, 118, 5, 2, (bar, s) => d.hit(bell, 'chh', bar, s, v(.55)));
  d.hit(drums, 'crash', 88, 0, .6);
  d.ramp(B.hats.filter.frequency, [[0, 2500], [16, 20000], [116, 20000], [124, 3000]], {exp: true});

  /* ---------- the bass: the intro's 8ths gain two more 16ths every four bars until it's the riff (from bar 32); one step of
     its eight changing every 24 bars; in the breakdown it walks the progression's chords ---------- */
  const SEQS = [[0, 2, 3, 4, 1, 2, 0, 3], [0, 2, 3, 4, 1, 2, 0, 4], [0, 3, 2, 4, 1, 3, 0, 4], [0, 2, 4, 3, 1, 4, 0, 3], [0, 2, 3, 4, 2, 4, 1, 3], [0, 2, 3, 4, 1, 2, 0, 3]];
  const ADD = [15, 7, 11, 3, 13, 5, 9, 1];   // (the odd 16ths, in the order they join)
  const on = (bar, s) => s % 2 === 0 || ADD.indexOf(s) < 2*Math.max(0, Math.floor((bar - 12)/4));
  each([[8, 126]], bar => { const seq = SEQS[Math.floor(bar/24)], c = brk(bar) ? BRK[Math.floor((bar - 72)/4)] : null;
    for (let s = 0; s < 16; s++) { if (!on(bar, s) || (brk(bar) && bar < 84 && s % 4 === 3)) continue;
      const n = c ? c[0] + 12 + [0, 7, 12, 14, 7, 10, 0, 12][(seq[s % 8] + s) % 8] : Am.root + 12 + Am.tones[seq[s % 8]];
      d.note(bass, n, bar, s, .9, v(.55 + .1*(bar % 4)/3 + (s % 4 ? 0 : .15))); } });
  // its sound evolving: the filter breathing (an LFO deepening over the track), resonance, a longer decay, into the echo
  d.ramp(B.bass.filter.frequency, [[8, 450], [16, 900], [32, 1300], [48, 1800], [72, 700], [86, 3000], [88, 1800], [104, 2600], [112, 1500], [126, 400]], {exp: true});
  d.lfo(B.bass.filter.frequency, {beats: 16, depth: [[16, 0], [32, 250], [48, 500], [72, 300], [88, 600], [112, 500], [124, 0]], rate: [[16, 16], [72, 16], [86, 4], [88, 16], [104, 8], [124, 16]]});
  d.ramp(B.bass.filter.Q, [[8, 1], [48, 2], [72, 3], [86, 5], [88, 2], [104, 3.5], [126, 1]]);
  d.morph(bass, 'ad', [[8, .2], [48, .3], [72, .45], [88, .25], [104, .4], [126, .2]], 2);
  d.ramp(toWash.bass, [[8, 0], [70, 0], [74, .18], [86, .3], [88, 0], [126, 0]]);

  /* ---------- the pad: suspended voicings over the A, pumping hard, its filter breathing; gated chords on the off-beats ---------- */
  const padAt = bar => brk(bar) ? BRK[Math.floor((bar - 72)/4)][1] : SUS[Math.floor(bar/4) % SUS.length];
  for (let bar = 0; bar < 128; bar += 4) d.chord(pad, padAt(bar), bar, 0, 4*16 - 1, brk(bar) ? .65 : .5);
  for (const [bar, ] of [[72], [76], [80], [84]]) d.note(pad, BRK[(bar - 72)/4][0] + 24, bar, 0, 63, .5);   // (the breakdown's roots under it)
  each([[16, 72], [88, 116]], bar => { for (const s of [2, 6, 10, 14]) d.chord(gate, padAt(bar), bar, s, 1, v(s === 14 ? .5 : .38)); });
  d.ramp(B.pad.level, [[0, .45], [16, .32], [72, .3], [74, .8], [88, .35], [120, .35], [128, 0]]);
  d.ramp(B.pad.filter.frequency, [[0, 700], [16, 1400], [48, 2000], [72, 1100], [86, 4500], [88, 2000], [112, 2400], [128, 700]], {exp: true});
  d.lfo(B.pad.filter.frequency, {beats: 8, depth: [[0, 300], [16, 500], [72, 700], [88, 600], [128, 200]]});

  /* ---------- the steel drum: in threes, on the notes over the A; its sound blooming: brighter, more resonant, a filter
     LFO speeding up, the echo wash swelling at the end of each eight bars ---------- */
  const W = [0, 2, 4, 1, 3], W7 = [0, 2, 4, 1, 3, 5, 2];
  for (const [a, b] of [[48, 72], [76, 88], [96, 116]]) every(a, b, 3, 0, (bar, s, j) => {
    const w = bar >= 100 ? W7 : W, top = bar >= 104 && j % 7 === 6 ? 2 : 0;
    d.note(steel, SUSP[w[j % w.length] + top + (bar >= 60 && bar < 72 ? 1 : 0)], bar, s, 1.5, v(j % 4 === 0 ? .7 : .5)); });
  d.dbRamp(B.bells.level, [[48, -12], [56, -1], [72, -1], [76, -6], [88, -1], [116, -8]]);
  d.ramp(B.bells.filter.frequency, [[48, 900], [60, 2600], [71, 5500], [76, 1400], [88, 2200], [104, 6000], [116, 1200]], {exp: true});
  d.lfo(B.bells.filter.frequency, {beats: 8, depth: [[48, 200], [64, 800], [72, 500], [96, 700], [112, 1400], [116, 0]], rate: [[48, 8], [64, 4], [71, 1], [76, 8], [96, 4], [108, 1], [112, .5], [116, 4]]});
  d.ramp(B.bells.filter.Q, [[48, 1.5], [70, 4.5], [76, 2], [108, 5], [116, 2]]);
  d.morph(steel, 'ad', [[48, .35], [64, .6], [76, .9], [96, .4], [112, .8]]);
  d.morph(steel, 'fenv', [[48, .2], [70, .6], [96, .3], [112, .7]]);
  { const pts = [[48, 0]]; for (let bar = 52; bar <= 116; bar += 8) pts.push([bar - 1, 0], [bar, .45], [bar + 1, .05]); pts.push([117, 0]); d.ramp(toWash.bells, pts); }
  d.ramp(B.bells.b.gain, [[48, .3], [70, .5], [72, 1.6], [76, .8], [88, .4], [111, .4], [112, 1.6], [114, .4]]);

  /* ---------- the ping: from one note into a phrase over the peak (on the notes over the A), and the sound opening,
     its resonance rising, its LFO speeding into a whoosh, echo washes, a reverb throw at the top ---------- */
  const PH = [
    [[2, 69], [5, 69], [10, 69], [13, 69]],                      // 96: the one note
    [[2, 69], [5, 69], [10, 69], [13, 76]],                      // 100: a second answers it
    [[2, 69], [5, 71], [10, 69], [13, 74], [15, 76]],            // 104: a third, the line rising
    [[2, 76], [5, 74], [8, 71], [10, 69], [13, 67], [14, 69]],   // 108: a phrase falling back to the A
    [[2, 81], [5, 79], [8, 76], [10, 74], [13, 76], [15, 79]],   // 112: lifted an octave as it goes
  ];
  each([[96, 116]], bar => { const p = PH[Math.min(4, Math.floor((bar - 96)/4))], alt = bar % 2 && bar < 104;
    for (const [s, n] of p) d.note(ping, n, bar, alt && s === 10 ? 9 : s, .7 + (bar >= 108 ? .5 : 0), v(.65)); });
  d.ramp(B.lead.filter.frequency, [[96, 700], [100, 1500], [104, 2600], [108, 4200], [112, 6500], [115, 9000], [116, 1500]], {exp: true});
  d.lfo(B.lead.filter.frequency, {beats: 8, depth: [[96, 200], [104, 900], [112, 2500], [116, 0]], rate: [[96, 8], [104, 2], [110, .5], [113, .25], [116, 4]]});
  d.ramp(B.lead.filter.Q, [[96, 2], [104, 4], [112, 6], [116, 3]]);
  d.lfo(B.lead.pan.pan, {beats: 6, depth: [[96, 0], [104, .35], [116, .6]]});
  d.morph(ping, 'res', [[96, .5], [108, .7], [116, .6]]);
  d.morph(ping, 'ad', [[96, .08], [104, .14], [112, .3]]);
  d.morph(ping, 'fenv', [[96, .5], [112, .9]]);
  d.ramp(toWash.lead, [[96, 0], [103, 0], [104, .2], [108, .35], [111, .6], [112, .3], [116, .8], [118, 0]]);
  d.ramp(B.lead.b.gain, [[96, .5], [111.5, .5], [112, 2], [113, .6], [115, .8], [116, 2.4], [118, .5]]);

  // v3: a bell cloud (grains of a struck bar on A, D and E) blooming through the breakdown
  cloud(d, 'fx', 72, 16, {f0: 440});
  d.noise('fx', 80, 88, {f0: 250, f1: 7000, peak: -7});
  d.noise('fx', 72, 75, {f0: 4000, f1: 400, peak: -12, fade: 'out'});
  d.noise('fx', 112, 116, {f0: 600, f1: 9000, peak: -14});
}
