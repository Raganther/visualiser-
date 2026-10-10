// Echo Chamber: dub techno, 118 BPM in C minor. One chord (Cm9, now and then Fm9) stabbed on the offbeat into a dark
// dotted-quarter echo whose repeats are swept by a filter and washed into a long reverb; a deep, soft kick and a sub
// bass; swung hats, a rim thrown into the echo, and a hiss like a worn record. A breakdown where the chord's echo swells
// alone, and the kick back under it.
const Cm9 = ['C3', 'G3', 'A#3', 'D#4', 'D4'], Fm9 = ['F3', 'G#3', 'C4', 'D#4', 'G4'];
export default {
  title: 'Echo Chamber', bpm: 118, swing: .08, seed: 5, key: 'C minor',
  tracks: [
    {id: 'kick', name: 'Kick', inst: {type: 'drums', kit: '808', voices: {kick: {tune: -1, decay: .55, x: .35, drive: .25, tone: .4}}},
      clips: {four: {hits: {kick: 'x...|x...|x...|x...'}}},
      mix: {vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 30, slope: 24}, {type: 'bell', f: 55, g: 1.5, q: 1.1}, {type: 'bell', f: 260, g: -4, q: 1.2}, {type: 'lp', f: 6000, slope: 12}]}]}},
    {id: 'sub', name: 'Sub', inst: {type: 'analog', preset: 'Sub bass', p: {ar: .12}},
      clips: {a: {bars: 2, notes: [[2, 'C2', 1.5, .9], [6, 'C2', 1.5, .8], [10, 'C2', 1.5, .9], [13, 'D#2', 1.5, .7], [18, 'C2', 1.5, .9], [22, 'C2', 1.5, .8], [26, 'C2', 1.5, .9], [29, 'G1', 2, .75]]}},
      mix: {vol: -5, chain: [{type: 'eq', bands: [{type: 'hp', f: 32, slope: 24}, {type: 'lp', f: 1200, slope: 24}]}, {type: 'sc', src: 'kick', depth: 9, att: .003, hold: .03, rel: .16}]}},
    {id: 'hats', name: 'Hats', inst: {type: 'drums', kit: 'Minimal', voices: {chh: {decay: .9, tone: .8, pan: .3}, ohh: {decay: .8, tone: .8, x: .2, pan: -.25}}}, swing: .18,
      clips: {thin: {hits: {chh: '..5.|..5.|..5.|..5.'}}, full: {hits: {chh: '4.6?|4.6.|4.6?|4.66', ohh: '..o.|..o.|..o.|..o.'}}},
      mix: {vol: -9, pan: -.1, to: 'drums', chain: [{type: 'eq', bands: [{type: 'hp', f: 500, slope: 24}, {type: 'lp', f: 11000, slope: 12}]}], sends: {echo: -24, verb: -22}}},
    {id: 'rim', name: 'Rim', inst: {type: 'drums', kit: 'Minimal', voices: {rim: {tune: -1, pan: .25}, clap: {decay: 1.3, x: .7, tone: .7}}},
      clips: {a: {bars: 2, hits: {rim: '....|..x.|....|....|....|....|..x.|..?.', clap: '....|x...|....|x...|....|x...|....|x...'}},
        clap: {hits: {clap: '....|x...|....|x...'}}},
      mix: {vol: -14, to: 'drums', chain: [{type: 'eq', bands: [{type: 'hp', f: 300, slope: 24}, {type: 'lp', f: 7000, slope: 12}]}], sends: {echo: -9, verb: -14}}},
    {id: 'chord', name: 'Dub chord', inst: {type: 'analog', preset: 'Dub chord', p: {cut: 600, res: .3, fd: .14}},
      clips: {a: {bars: 4, notes: [[2, Cm9, 1, .8], [18, Cm9, 1, .75], [34, Cm9, 1, .8], [42, Cm9, .8, .5, {p: .5}], [50, Fm9, 1, .75]]},
        sparse: {bars: 4, notes: [[2, Cm9, 1, .8], [34, Cm9, 1, .7]]}},
      mix: {vol: -6, chain: [{type: 'eq', bands: [{type: 'hp', f: 150, slope: 24}, {type: 'bell', f: 500, g: -2, q: 1}, {type: 'lp', f: 6000, slope: 12}]},
        {type: 'sc', src: 'kick', depth: 3, rel: .2}], sends: {echo: -2, verb: -14}}},
    {id: 'drone', name: 'Drone', inst: {type: 'analog', preset: 'Warm pad', p: {cut: 420, level: .7}},
      clips: {a: {bars: 8, notes: [[0, ['C3', 'G3', 'D4'], 62, .5], [64, ['C#3', 'G#3', 'D#4'], 62, .45]]}},
      mix: {vol: -14, chain: [{type: 'eq', bands: [{type: 'hp', f: 160, slope: 24}]}, {type: 'sc', src: 'kick', depth: 5, rel: .35}], sends: {verb: -6}}},
    {id: 'hiss', name: 'Hiss', inst: {type: 'analog', preset: 'Noise riser', p: {cut: 5000, res: 0, aa: 2, ar: 2}},
      clips: {a: {bars: 8, notes: [[0, 'C4', 128, .6]]}},
      mix: {vol: -32, pan: .1, chain: [{type: 'eq', bands: [{type: 'hp', f: 2500, slope: 12}]}, {type: 'autopan', p: {div: '2 bars', depth: .5}}]}},
  ],
  groups: [{id: 'drums', name: 'Drums', chain: [{type: 'comp', thr: -18, ratio: 2, att: .015, rel: .15, gain: 1}]}],
  returns: [
    // the echo: dotted quarters, dark, swept by a band of filter over four bars, then into the reverb too
    {id: 'echo', name: 'Dub echo', chain: [{type: 'delay', p: {div: '1/4·', fb: .62, tone: 1700, ping: .7, mix: 1}}, {type: 'filter', p: {kind: 'Low', cut: 1800, res: .25, lfo: .5, div: '4 bars', mix: 1}},
      {type: 'eq', bands: [{type: 'hp', f: 220, slope: 24}]}, {type: 'width', p: {w: 1.7}}], sends: {verb: -10}, vol: -1},
    {id: 'verb', name: 'Hall', chain: [{type: 'reverb', p: {kind: 'Hall', size: .85, damp: .7, pre: .04, low: 250, mix: 1}}, {type: 'eq', bands: [{type: 'lp', f: 6000, slope: 12}]}], vol: -2}],
  master: {chain: [{type: 'eq', bands: [{type: 'hp', f: 24, slope: 24}, {type: 'hs', f: 12000, g: -1}]}, {type: 'comp', id: 'glue', thr: -14, ratio: 2, knee: 8, att: .03, rel: .2},
    {type: 'limiter', gain: 4, ceil: -1}]},
  scenes: [
    {id: 'intro', clips: {chord: 'sparse', hiss: 'a', drone: 'a'}},
    {id: 'pulse', clips: {kick: 'four', chord: 'a', hiss: 'a', hats: 'thin', drone: 'a'}},
    {id: 'groove', clips: {kick: 'four', sub: 'a', chord: 'a', hiss: 'a', hats: 'full', rim: 'a', drone: 'a'}},
    {id: 'deep', clips: {chord: 'a', hiss: 'a', drone: 'a', hats: 'thin', rim: 'clap'}},
    {id: 'return', clips: {kick: 'four', sub: 'a', chord: 'a', hiss: 'a', hats: 'full', rim: 'a', drone: 'a'}},
    {id: 'outro', clips: {kick: 'four', chord: 'sparse', hiss: 'a', hats: 'thin'}},
  ],
  arrange: [['intro', 8], ['pulse', 8], ['groove', 16], ['deep', 8], ['return', 16], ['outro', 8]],
  auto: [
    // the chord's filter: closed in the intro, breathing open through the groove, wide open in the deep part
    {target: 'chord.inst.cut', points: [[0, 380], [8, 480], [16, 600], [28, 900], [32, 700], [36, 1300], [40, 1500], [44, 800], [56, 1100], [64, 500]]},
    // the echo's feedback: up in the deep part, so the stabs pile up
    {target: 'echo.delay.fb', points: [[0, .55], [32, .62], [36, .74], [40, .62], [64, .7]]},
    {target: 'chord.send.echo', points: [[0, -4], [32, -2], [36, 0], [40, -2]]},
    {target: 'drone.vol', points: [[0, -20], [8, -14], [32, -10], [40, -16], [64, -22]]},
  ],
  mods: [{target: 'chord.inst.res', shape: 'Sine', rate: '8 bars', depth: .1, center: .32}],
};
