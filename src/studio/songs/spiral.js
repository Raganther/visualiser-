// Spiral: hypnotic techno at 126 BPM in D minor, made of loops of different lengths turning against each other. Under a
// four-to-the-floor kick: hats on a 12-step row with their own velocity groove, a shaker going round every 7 steps, a
// ghostly rim every 5 and a ride every 6 at the peak; a Moog bass riff 12 steps long (so it lands somewhere new in each of
// three bars); a 7-note FM sequence into a dotted echo, its filter breathing over eight bars; a Dm9 stab on a 10-step
// cycle; and a drone underneath that swells with each part. Nothing changes much: the pattern is the pull.
const HAT12 = 'x6x9|4x7x|3x8x', SHAKE7 = '4635274', RIM5 = '..3.5', RIDE6 = '7.4.5.';
const D = 'x...|x...|x...|x...';
// (an 8-bar drum clip: the 12, 7, 5 and 6 rows go round inside it, meeting again only at its top)
const drums = (rows, bars = 8) => ({bars, hits: rows});
// the bass: 12 sixteenths, an octave jump and a slide, its accents leaning on the off-beats
const BASS = [[0, 'D1', .6, .95], [2, 'D1', .45, .6], [3, 'D2', .4, .75], [5, 'D1', .55, .9], [7, 'F1', .45, .65], [8, 'D1', .6, .95, {slide: true}],
  [9, 'C2', .45, .7], [11, 'A1', .4, .6]];
// the sequence: 7 notes of D dorian, the first leaning, the rest breathing in and out
const SEQ = [['D4', .9], ['A4', .55], ['F4', .7], ['C5', .5], ['E4', .75], ['A4', .45], ['G4', .65]].map(([n, v], i) => [i, n, .8, v]);
const STAB = [[0, ['D3', 'F3', 'A3', 'C4', 'E4'], 1.5, .85], [6, ['D3', 'F3', 'A3', 'C4', 'E4'], .5, .45]];
const HATS_EQ = {type: 'eq', bands: [{type: 'hp', f: 450, slope: 24}, {type: 'hs', f: 8000, g: -3}]};
export default {
  title: 'Spiral', bpm: 126, swing: .05, seed: 31, key: 'D minor',
  tracks: [
    {id: 'drums', name: 'Drums', inst: {type: 'drums', kit: '909'},
      pads: {
        kick: {voice: {tune: -2, decay: .65, x: .5, drive: .2, tone: .4}, mix: {vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 28, slope: 24}, {type: 'bell', f: 55, g: 1.5, q: 1}, {type: 'bell', f: 320, g: -4.5, q: 1.3}, {type: 'hs', f: 6000, g: -2}]}]}},
        chh: {name: 'Closed hat', kit: 'Minimal', swing: .1, voice: {tone: .65, decay: .7, pan: -.25}, mix: {vol: -10.5, to: 'bus', chain: [HATS_EQ], sends: {verb: -24}}},
        shaker: {swing: .1, voice: {level: .8, pan: .35}, mix: {vol: -14, to: 'bus', chain: [HATS_EQ]}},
        rim: {kit: 'Minimal', voice: {tune: 2, pan: .3}, mix: {vol: -13, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 300, slope: 24}]}], sends: {echo: -9, verb: -18}}},
        ride: {voice: {decay: .8, pan: -.3}, mix: {vol: -16, to: 'bus', chain: [HATS_EQ], sends: {verb: -20}}},
        ohh: {name: 'Open hat', kit: 'Minimal', swing: .1, voice: {decay: .5, x: .25, pan: .25}, mix: {vol: -12, to: 'bus', chain: [HATS_EQ], sends: {verb: -24}}},
        clap: {voice: {decay: 1.1, x: .7, tone: .8}, mix: {vol: -11, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 200, slope: 24}]}], sends: {verb: -10}}}},
      clips: {
        intro: drums({kick: D, chh: HAT12}),
        lock: drums({kick: D, chh: HAT12, shaker: SHAKE7}),
        seq: drums({kick: D, chh: HAT12, shaker: SHAKE7, rim: RIM5}),
        deep: drums({kick: D, chh: HAT12, shaker: SHAKE7, rim: RIM5, ride: RIDE6}),
        break: drums({chh: HAT12, shaker: SHAKE7}),
        peak: drums({kick: D, chh: HAT12, shaker: SHAKE7, rim: RIM5, ride: RIDE6, ohh: '..6.|..8.|..6.|..9.', clap: '....|x...|....|x...'})}},
    {id: 'bass', name: 'Moog bass', inst: {type: 'moog', preset: 'Rubber bass', p: {glide: .03, cut: 300, res: .35}},
      clips: {a: {steps: 12, notes: BASS}},
      mix: {vol: -7, chain: [{type: 'eq', bands: [{type: 'hp', f: 34, slope: 24}, {type: 'bell', f: 240, g: -2.5, q: 1.2}, {type: 'lp', f: 5000, slope: 12}]},
        {type: 'sc', src: 'drums:kick', depth: 14, att: .003, hold: .05, rel: .16}, {type: 'comp', thr: -16, ratio: 3, att: .005, rel: .08, gain: 2}]}},
    {id: 'seq', name: 'Blip sequence', inst: {type: 'fm', preset: 'Wood blip'},
      clips: {a: {steps: 7, notes: SEQ}},
      mix: {vol: -9, pan: -.15, chain: [{type: 'eq', bands: [{type: 'hp', f: 280, slope: 24}, {type: 'bell', f: 1700, g: -2, q: 1.2}]}, {type: 'sc', src: 'drums:kick', depth: 4, rel: .2}], sends: {echo: -5, verb: -14}}},
    {id: 'stab', name: 'Dm9 stab', inst: {type: 'analog', preset: 'Stab', p: {cut: 1400}},
      clips: {a: {steps: 10, notes: STAB}},
      mix: {vol: -12, pan: .15, chain: [{type: 'eq', bands: [{type: 'hp', f: 220, slope: 24}, {type: 'bell', f: 450, g: -2.5, q: 1}, {type: 'bell', f: 1700, g: -2.5, q: 1.2}]}, {type: 'sc', src: 'drums:kick', depth: 6, rel: .2}], sends: {echo: -7, verb: -9}}},
    {id: 'drone', name: 'Drone', inst: {type: 'moog', preset: 'Texture'},
      // (its own swell, drawn as a volume envelope over the clip's eight bars)
      clips: {a: {bars: 8, notes: [[0, ['D2', 'A2'], 127, .6]], auto: {vol: [[0, -18], [64, -12], [112, -10], [127, -14]]}}},
      mix: {vol: -13, pan: -.1, chain: [{type: 'eq', bands: [{type: 'hp', f: 180, slope: 24}]}, {type: 'sc', src: 'drums:kick', depth: 4, rel: .3}], sends: {verb: -6}}},
  ],
  groups: [{id: 'bus', name: 'Drum bus', to: 'drums', chain: [{type: 'comp', thr: -18, ratio: 2.5, att: .01, rel: .12, gain: 1}]}],
  returns: [
    {id: 'verb', name: 'Hall', chain: [{type: 'reverb', p: {kind: 'Hall', size: .65, damp: .55, pre: .03, low: 300, mix: 1}}, {type: 'eq', bands: [{type: 'lp', f: 7500, slope: 12}]}]},
    {id: 'echo', name: 'Echo', chain: [{type: 'delay', p: {div: '1/8·', fb: .5, tone: 2400, ping: 1, mix: 1}}, {type: 'eq', bands: [{type: 'hp', f: 300, slope: 12}]}, {type: 'width', p: {w: 1.5}}], vol: -1}],
  master: {chain: [{type: 'eq', bands: [{type: 'hp', f: 24, slope: 24}]}, {type: 'comp', id: 'glue', thr: -12, ratio: 2, knee: 6, att: .02, rel: .15},
    {type: 'limiter', gain: 5.6, ceil: -1}]},
  scenes: [
    {id: 'intro', clips: {drums: 'intro', drone: 'a'}},
    {id: 'lock', clips: {drums: 'lock', bass: 'a', drone: 'a'}},
    {id: 'seq', clips: {drums: 'seq', bass: 'a', seq: 'a', drone: 'a'}},
    {id: 'deep', clips: {drums: 'deep', bass: 'a', seq: 'a', stab: 'a', drone: 'a'}},
    {id: 'break', clips: {drums: 'break', seq: 'a', stab: 'a', drone: 'a'}},
    {id: 'peak', clips: {drums: 'peak', bass: 'a', seq: 'a', stab: 'a', drone: 'a'}},
    {id: 'outro', clips: {drums: 'lock', bass: 'a', drone: 'a'}},
  ],
  arrange: [['intro', 8], ['lock', 16], ['seq', 16], ['deep', 16], ['break', 8], ['peak', 16], ['outro', 8]],
  auto: [
    // the bass opening over the lock and the deep part, closed for the break's return, wide at the peak
    {target: 'bass.inst.cut', points: [[8, 200], [24, 330], [40, 300], [56, 420], [64, 250], [72, 480], [88, 200]]},
    {target: 'seq.vol', points: [[24, -20], [28, -9]]},
    {target: 'stab.inst.cut', points: [[40, 600], [56, 1300], [64, 800], [72, 1600], [88, 700]]},
  ],
  // the sequence's brightness and place breathing slowly, out of step with the bars
  mods: [{target: 'seq.inst.cut', shape: 'Sine', rate: '8 bars', depth: 900, center: 1500}, {target: 'seq.pan', shape: 'Sine', rate: '4 bars', depth: .4, center: -.1}],
};
