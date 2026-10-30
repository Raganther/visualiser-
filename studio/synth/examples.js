// The playground's examples: a patch for the analog synth (studio/lib/native/asynth.js, its settings over the defaults)
// and a phrase written for it, in 16ths: [step, length in steps, note, velocity]. A note held past the next one's start
// slides into it in Legato (the acid line, the leads). Each says its tempo and the drums it sits on (any can be changed).
const NAMES = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};
export const midi = s => { const m = /^([A-G][#b]?)(-?\d)$/.exec(s); return 12*(+m[2] + 1) + NAMES[m[1]]; };
export const NOTE = n => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12] + (Math.floor(n/12) - 1);
const chord = (at, len, names, vel = .75) => names.split(' ').map(s => [at, len, s, vel]);
// an arpeggio: the chord's notes up and back each bar, in 16ths, the downbeats a little harder
const arp = (bar, names, order = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3]) => { const ns = names.split(' ');
  return order.map((k, i) => [bar*16 + i, .9, ns[k % ns.length], i % 4 ? .62 : .9]); };

export const EXAMPLES = [
  {id: 'round', name: 'Round bass', style: 'Mono bass', words: 'A saw and a pulse an octave down through the ladder, its envelope plucking it open. The bass of a hundred records.',
    bpm: 126, bars: 2, drums: 'four', patch: {w1: 0, w2: 1, oct2: -1, fine2: 4, l1: .8, l2: .6, lsub: .3, drive: .35, ftype: 0, cut: 240, res: .35, fenv: .42, fkey: .4, fvel: .5,
      fa: .002, fd: .26, fs: .12, fr: .12, aa: .002, ad: .4, as: .85, ar: .09, mode: 1, glide: .02, slop: .35, vdrive: .25, level: .7},
    notes: [[0, 2, 'A1', 1], [3, 1, 'A1', .7], [6, 1, 'A2', .8], [8, 2, 'A1', 1], [11, 1, 'C2', .7], [12, 1, 'A1', .9], [14, 2, 'E2', .8],
      [16, 2, 'A1', 1], [19, 1, 'A1', .7], [22, 1, 'A2', .8], [24, 2, 'G1', 1], [27, 1, 'G1', .7], [28, 2, 'C2', .9], [30, 2, 'D2', .8]]},
  {id: 'acid', name: 'Acid line', style: 'Acid house', words: 'One saw, the ladder near screaming, a short envelope; accents open it, held notes slide into the next.',
    bpm: 128, bars: 2, drums: 'four', patch: {w1: 0, l1: 1, l2: 0, ftype: 0, cut: 330, res: .82, fenv: .55, fkey: .3, fvel: .8, fa: .002, fd: .2, fs: 0, fr: .08,
      aa: .002, ad: .3, as: 1, ar: .04, avel: .5, mode: 2, glide: .05, drive: .45, slop: .25, vdrive: .3, emix: .18, etime: 1, efb: .35, level: .62},
    notes: [[0, 1, 'A1', 1], [1, 1, 'A1', .55], [2, 1, 'A2', .55], [3, 2, 'C2', 1], [5, 1, 'A1', .55], [6, 1, 'E2', 1], [7, 1.6, 'D2', .55], [8, 1, 'A1', .55],
      [10, 1, 'G2', 1], [11, 1, 'A2', .55], [12, 1, 'A1', .55], [13, 1.6, 'C2', 1], [14.5, 1.5, 'D2', .55],
      [16, 1, 'A1', 1], [17, 1, 'A1', .55], [18, 1.6, 'A2', 1], [19.5, 1, 'G2', .55], [21, 1, 'E2', .55], [22, 1, 'A1', 1], [24, 1, 'C2', .55],
      [25, 1.6, 'D#2', 1], [26.5, 1, 'E2', .55], [28, 1, 'A1', .55], [29, 1, 'A2', 1], [30, 1.6, 'G2', .55]]},
  {id: 'juno', name: 'Warm pad', style: 'Polysynth pad', words: 'A pulse whose width the LFO sweeps, beside a detuned saw, through a lazy ladder; the bucket-brigade chorus and a little echo.',
    bpm: 118, bars: 4, drums: null, patch: {w1: 1, pw1: .5, lpwm: .3, lshape: 0, lrate: .6, w2: 0, fine2: -6, l1: .8, l2: .5, ftype: 0, cut: 1300, res: .15, fenv: .2, fkey: .5,
      fa: 1.2, fd: 2, fs: .6, fr: 2, aa: .9, ad: 2, as: .9, ar: 2.5, hpf: 140, chorus: 2, mode: 0, slop: .5, emix: .15, etime: 3, efb: .3, level: .55},
    notes: [...chord(0, 16, 'A2 E3 G3 B3 C4'), ...chord(16, 16, 'F2 C3 E3 A3'), ...chord(32, 16, 'C3 E3 G3 B3'), ...chord(48, 16, 'G2 D3 E3 B3')]},
  {id: 'brass', name: 'Brass stabs', style: 'Polysynth brass', words: 'Two saws a little apart through the state-variable filter, its envelope swelling a beat late, the way brass speaks.',
    bpm: 110, bars: 2, drums: 'four', patch: {w1: 0, w2: 0, fine2: 9, l1: .8, l2: .8, ftype: 2, cut: 520, res: .22, fenv: .5, fkey: .5, fa: .07, fd: .6, fs: .45, fr: .3,
      aa: .03, ad: .5, as: .9, ar: .28, epitch: .25, mode: 0, slop: .5, chorus: 1, level: .5},
    notes: [...chord(0, 5, 'D3 F3 A3', .9), ...chord(6, 2, 'C3 E3 G3', .7), ...chord(8, 6, 'A#2 D3 F3', .85), ...chord(14, 2, 'C3 E3 G3', .7),
      ...chord(16, 5, 'D3 F3 A3', .9), ...chord(22, 2, 'F3 A3 C4', .7), ...chord(24, 8, 'C3 E3 G3', .85)]},
  {id: 'sync', name: 'Sync lead', style: 'Lead', words: 'Oscillator 2 hard-synced to 1, the filter envelope sweeping its pitch: the tearing lead. Vibrato comes in after the note starts.',
    bpm: 124, bars: 4, drums: 'minimal', patch: {w1: 0, l1: .25, w2: 0, sync: 1, semi2: 7, l2: .9, epitch: 14, etgt: 1, ftype: 0, cut: 3200, res: .2, fenv: .2, fkey: .3,
      fa: .002, fd: .6, fs: .2, fr: .3, aa: .002, ad: .5, as: .9, ar: .25, mode: 2, glide: .05, lpitch: .15, ldelay: .6, lrate: 5.5, emix: .25, etime: 1, efb: .35, level: .62},
    notes: [[0, 4.2, 'A4', .9], [4, 2.2, 'C5', .8], [6, 2.2, 'E5', .8], [8, 6.2, 'D5', .9], [14, 2.2, 'C5', .8], [16, 4.2, 'B4', .9], [20, 4, 'G4', .8], [24, 7, 'A4', .9],
      [32, 4.2, 'E5', .9], [36, 2.2, 'G5', .8], [38, 2.2, 'E5', .8], [40, 6.2, 'D5', .9], [46, 2.2, 'C5', .8], [48, 4.2, 'D5', .9], [52, 4, 'B4', .8], [56, 7, 'A4', .9]]},
  {id: 'strings', name: 'String machine', style: 'Ensemble strings', words: 'Two saws, a slow swell, the high-pass taking the weight off, and the fast chorus that makes one voice an ensemble.',
    bpm: 100, bars: 4, drums: null, patch: {w1: 0, w2: 0, fine2: 12, l1: .8, l2: .7, ftype: 0, cut: 2600, res: .05, fenv: .1, fa: .4, fd: 1, fs: .8, fr: 1.2,
      aa: .5, ad: 1, as: 1, ar: 1.2, hpf: 220, chorus: 3, lpitch: .06, lrate: 5, ldelay: .3, slop: .6, mode: 0, level: .5},
    notes: [...chord(0, 16, 'A2 E3 A3 C4 E4', .7), ...chord(16, 16, 'F2 C3 F3 A3 C4', .7), ...chord(32, 16, 'C3 G3 C4 E4', .7), ...chord(48, 16, 'E2 B2 E3 G#3 B3', .7)]},
  {id: 'pulse', name: 'Pulse brass', style: 'Pulsing brass pad', words: 'Two saws a few cents apart over a quiet sub, through the soft 12 dB ladder, the filter speaking a little late as brass does; a swell on every beat (the LFO in time, to the cutoff and the volume, the right side a touch behind the left), a breath of air beside it, chorus II for width.',
    bpm: 120, bars: 4, drums: 'minimal', patch: {w1: 0, w2: 0, fine2: 9, l1: .75, l2: .65, lsub: .3, subo: 0, drive: .12, ftype: 1, cut: 880, res: .12, fenv: .28, fkey: .45, fvel: .2,
      fa: .09, fd: .8, fs: .5, fr: .6, aa: .035, ad: .6, as: .88, ar: .7, epitch: .12, lshape: 6, lsync: 3, lcut: .7, lamp: .28, lwide: .12, air: .25, airTone: 6500,
      mode: 0, slop: .5, spread: .85, chorus: 2, emix: .1, etime: 1, vdrive: .08, level: .5},
    notes: [...chord(0, 15, 'F2 D3 E3 A3 C4', .8), ...chord(16, 15, 'D2 C3 F3 A3 E4', .8), ...chord(32, 15, 'A2 E3 G3 C4', .8), ...chord(48, 15, 'C3 E3 G3 B3 D4', .8)]},
  {id: 'reese', name: 'Reese bass', style: 'Unison bass', words: 'Six voices stacked on one note and detuned, spread wide, the filter breathing slowly: a bass that moves inside itself.',
    bpm: 126, bars: 4, drums: 'minimal', patch: {mode: 3, uni: 6, udet: .45, spread: .8, w1: 0, w2: 0, fine2: -14, l1: .7, l2: .7, ftype: 0, cut: 480, res: .25, fenv: .12,
      lcut: .6, lrate: .25, lshape: 1, aa: .01, ad: .5, as: 1, ar: .25, fa: .01, fs: .5, drive: .5, vdrive: .35, slop: .5, level: .5},
    notes: [[0, 6, 'A1'], [8, 6, 'A1'], [16, 6, 'G1'], [24, 6, 'G1'], [32, 6, 'F1'], [40, 6, 'F1'], [48, 8, 'E1'], [56, 6, 'G1']].map(x => [...x, .8])},
  {id: 'arp', name: 'Plucked arpeggio', style: 'Arpeggio', words: 'A narrow pulse with a saw an octave up, plucked shut by a fast envelope, the echo answering on the dotted eighth.',
    bpm: 122, bars: 4, drums: 'four', patch: {w1: 1, pw1: .3, w2: 0, oct2: 1, l1: .8, l2: .35, ftype: 0, cut: 480, res: .45, fenv: .55, fkey: .6, fvel: .5, fa: .001, fd: .18, fs: 0, fr: .2,
      aa: .001, ad: .35, as: 0, ar: .3, mode: 0, emix: .35, etime: 1, efb: .45, chorus: 1, slop: .4, level: .7},
    notes: [...arp(0, 'A3 C4 E4 A4'), ...arp(1, 'F3 A3 C4 F4'), ...arp(2, 'C4 E4 G4 C5'), ...arp(3, 'G3 B3 D4 G4')]},
  {id: 'hoover', name: 'Hoover', style: 'Rave lead', words: 'Eight voices in unison, pulses whose widths swim, a saw an octave down, sliding between notes: the rave classic.',
    bpm: 136, bars: 2, drums: 'four', patch: {mode: 3, uni: 8, udet: .7, spread: 1, w1: 1, pw1: .2, lpwm: .25, lrate: 3, w2: 0, oct2: -1, l1: .8, l2: .6, ftype: 0, cut: 1800, res: .1,
      fenv: .1, epitch: 3, fa: .06, fd: .4, fs: 0, aa: .01, as: 1, ar: .3, glide: .12, chorus: 2, slop: .5, level: .42},
    notes: [[0, 3.5, 'E3', .9], [3, 3.5, 'G3', .8], [6, 2.5, 'A3', .8], [8, 6.5, 'E3', .9], [14, 2, 'D3', .8], [16, 3.5, 'E3', .9], [19, 3.5, 'G3', .8], [22, 2.5, 'B3', .8], [24, 7, 'A3', .9]]},
  {id: 'wobble', name: 'Wobble', style: 'Bass with a synced LFO', words: 'The cutoff swung by the LFO in eighths, the bass and sub under a saw, driven: the filter does the rhythm.',
    bpm: 140, bars: 2, drums: 'minimal', patch: {mode: 1, w1: 0, w2: 1, oct2: -1, l1: .8, l2: .7, lsub: .4, ftype: 0, cut: 170, res: .55, lcut: 3.5, lshape: 1, lsync: 4, fenv: 0,
      drive: .6, vdrive: .4, aa: .005, as: 1, ar: .1, slop: .3, level: .62},
    notes: [[0, 8, 'E1', .9], [8, 4, 'E1', .8], [12, 4, 'G1', .8], [16, 8, 'C2', .9], [24, 6, 'B1', .8], [30, 2, 'D2', .8]]},
  {id: 'bell', name: 'Ring bell', style: 'Ring modulation', words: 'A triangle ring-modulated by a sine at an odd ratio: partials no harmonic series has, ringing away like struck metal.',
    bpm: 96, bars: 4, drums: null, patch: {w1: 2, w2: 3, oct2: 1, semi2: 3, fine2: -32, l1: .2, l2: 0, lring: 1, ftype: 0, cut: 6000, res: 0, fenv: .2, fa: .001, fd: 1.5, fs: 0, fr: 1.5,
      aa: .001, ad: 2.5, as: 0, ar: 2.5, emix: .3, etime: 0, efb: .4, chorus: 1, slop: .2, mode: 0, level: .7},
    notes: [[0, 4, 'A4'], [4, 2, 'C5'], [6, 2, 'D5'], [8, 4, 'E5'], [12, 4, 'G5'], [16, 6, 'E5'], [22, 2, 'D5'], [24, 8, 'A4'],
      [32, 4, 'C5'], [36, 4, 'D5'], [40, 2, 'E5'], [42, 2, 'D5'], [44, 4, 'C5'], [48, 4, 'A4'], [52, 4, 'G4'], [56, 8, 'A4']].map(x => [...x, .8])},
  {id: 'dub', name: 'Dub chord', style: 'Dub techno', words: 'A minor-seventh stab plucked shut, the low end cut, thrown into a long dark echo: minimal techno\'s chord.',
    bpm: 122, bars: 2, drums: 'minimal', patch: {w1: 0, w2: 0, fine2: 8, l1: .8, l2: .7, ftype: 0, cut: 650, res: .5, fenv: .35, fkey: .3, fa: .001, fd: .2, fs: 0, fr: .2,
      aa: .001, ad: .3, as: 0, ar: .25, hpf: 250, emix: .5, etime: 3, efb: .65, etone: .35, chorus: 1, mode: 0, slop: .4, level: .75},
    notes: [...chord(3, 1, 'A2 C3 E3 G3', .85), ...chord(10, 1, 'A2 C3 E3 G3', .7), ...chord(19, 1, 'A2 C3 E3 G3', .85), ...chord(26, 1, 'D3 F3 A3 C4', .75), ...chord(30, 1, 'A2 C3 E3 G3', .6)]},
  {id: 'drone', name: 'Noise drone', style: 'Ambient', words: 'Two low saws and noise through a resonant band-pass that a slow random LFO wanders, held, into a long feedback echo.',
    bpm: 90, bars: 4, drums: null, patch: {w1: 0, oct1: -1, w2: 0, fine2: 20, l1: .6, l2: .6, lnoise: .35, ftype: 3, cut: 600, res: .75, lcut: 2, lshape: 5, lrate: .2, fenv: 0,
      aa: 2, ad: 1, as: 1, ar: 4, chorus: 2, emix: .3, efb: .6, etime: 3, slop: .7, mode: 0, level: .55},
    notes: [[0, 62, 'A2', .8], [0, 62, 'E3', .7], [32, 30, 'C4', .6]]},
  {id: 'lead', name: 'Vintage lead', style: 'Lead', words: 'Two saws and the sub through the ladder, gliding between held notes; push the mod wheel for vibrato.',
    bpm: 120, bars: 4, drums: 'minimal', patch: {w1: 0, w2: 0, fine2: -5, l1: .8, l2: .8, lsub: .2, ftype: 0, cut: 1100, res: .3, fenv: .5, fkey: .5, fa: .01, fd: .5, fs: .5, fr: .25,
      aa: .005, ad: .4, as: .9, ar: .2, mode: 2, glide: .08, lrate: 5.2, drive: .4, emix: .2, etime: 1, efb: .3, slop: .4, level: .62},
    notes: [[0, 2.3, 'E4', .8], [2, 2.3, 'G4', .8], [4, 4, 'A4', .9], [8, 2.3, 'G4', .8], [10, 2.3, 'E4', .8], [12, 4, 'D4', .9], [16, 6.3, 'E4', .9], [22, 2.3, 'C4', .8], [24, 7, 'A3', .9],
      [32, 2.3, 'A4', .8], [34, 2.3, 'C5', .8], [36, 4, 'D5', .9], [40, 2.3, 'E5', .8], [42, 2.3, 'D5', .8], [44, 4, 'C5', .9], [48, 4, 'A4', .8], [52, 4, 'G4', .8], [56, 7, 'A4', .9]]},
];
for (const e of EXAMPLES) e.notes = e.notes.map(([s, l, n, v = .8]) => ({s, l, n: typeof n === 'number' ? n : midi(n), v}));
// the drums under them (the analog drum machine's Deep kit): one bar of 16ths a row
export const DRUMS = {
  four: {name: 'Four to the floor', rows: {kick: 'X...x...x...x...', chh: '..x...x...x...x.', clap: '....x.......x...'}},
  minimal: {name: 'Minimal', rows: {kick: 'X...x...x...x...', chh: '..x...x...x..ox.', rim: '.......o......o.', shaker: 'o.o.o.o.o.o.o.o.'}},
};
