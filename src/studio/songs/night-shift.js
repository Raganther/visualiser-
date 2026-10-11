// Night Shift: minimal techno, 127 BPM in A minor. A rolling offbeat bass ducking under a dry, deep kick; shuffled hats;
// a wooden FM blip and a dub chord thrown into a dotted-eighth echo; a filtered build, a break with a pad and a riser, and
// a drop with everything.
const Am9 = ['A3', 'C4', 'E4', 'G4', 'B4'], Am7 = ['A3', 'C4', 'E4', 'G4'];
// the drum rack's rows, put together into each part's clip
const FOUR = {kick: 'x...|x...|x...|x...'}, THIN = {ohh: '..x.|..x.|..x.|..x.'}, FULL = {chh: '6..4|6..4|6..4|6.43', ohh: '..x.|..x.|..x.|..x.'},
  BUSY = {chh: '6343|6343|6343|6353', ohh: '..x.|..x.|..x.|..X.'}, TWO = {clap: '....|x...|....|x...'}, GHOST = {clap: '....|x...|....|x..?'},
  PERC_A = {rim: '...x..x..x..'}, PERC_B = {rim: {p: '...x..x....x..x....x..x..x.?..x.', prob: .9}, clave: '......x...............x.........', tomL: '..............x...............x.'};
export default {
  title: 'Night Shift', bpm: 127, swing: .06, seed: 7, key: 'A minor',
  tracks: [
    // the drum rack: one track, a pad a voice, each pad its own strip (the kick straight into the rack, the rest through a glue bus)
    {id: 'drums', name: 'Drums', inst: {type: 'drums', kit: '909'},
      pads: {
        kick: {voice: {tune: 0, decay: .75, x: .55, drive: .3, tone: .5}, mix: {vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 28, slope: 24}, {type: 'bell', f: 55, g: 1.5, q: 1}, {type: 'bell', f: 330, g: -4, q: 1.4}, {type: 'hs', f: 7000, g: -2}]}]}},
        chh: {name: 'Closed hat', kit: 'Minimal', swing: .14, voice: {tone: .85, decay: .7, pan: -.3}, mix: {vol: -9, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 400, slope: 24}, {type: 'hs', f: 9000, g: -1.5}]}], sends: {verb: -24}}},
        ohh: {name: 'Open hat', kit: 'Minimal', swing: .14, voice: {decay: .55, x: .25, pan: .3}, mix: {vol: -9, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 400, slope: 24}, {type: 'hs', f: 9000, g: -1.5}]}], sends: {verb: -24}}},
        clap: {voice: {decay: .9, x: .6, tone: .85}, mix: {vol: -8, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 180, slope: 24}, {type: 'bell', f: 1100, g: 2, q: .9}]}], sends: {verb: -11}}},
        snare: {voice: {tune: 2, decay: .6, x: .8}, mix: {vol: -8, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 180, slope: 24}]}], sends: {verb: -11}}},
        rim: {kit: 'Minimal', voice: {tune: 1, pan: -.3}, mix: {vol: -14, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 250, slope: 12}]}], sends: {echo: -16, verb: -22}}},
        clave: {kit: 'Minimal', voice: {pan: .35, level: .7}, mix: {vol: -14, to: 'bus', sends: {echo: -16, verb: -22}}},
        tomL: {name: 'Low tom', kit: 'Minimal', voice: {tune: -2, pan: -.15}, mix: {vol: -14, to: 'bus', sends: {echo: -16, verb: -22}}},
        crash: {voice: {decay: 1.2, tone: .8}, mix: {vol: -22, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 500, slope: 24}]}], sends: {verb: -14}}}},
      clips: {
        intro: {bars: 3, hits: {...FOUR, ...THIN, ...PERC_A}},
        groove: {bars: 3, hits: {...FOUR, ...FULL, ...TWO, ...PERC_A}},
        dub: {bars: 2, hits: {...FOUR, ...FULL, ...TWO, ...PERC_B}},
        build: {bars: 2, hits: {...FOUR, ...BUSY, ...GHOST, ...PERC_B}},
        roll: {bars: 1, hits: {kick: 'x...|x...|x...|x.x.', ...BUSY, snare: '3.4.|5.5.|6767|889X', ...PERC_B}},
        hats: {bars: 1, hits: THIN},
        drop: {bars: 8, hits: {...FOUR, ...BUSY, ...GHOST, ...PERC_B, crash: 'X' + '.'.repeat(127)}}}},
    {id: 'bass', name: 'Bass', inst: {type: 'analog', preset: 'Rolling bass', p: {cut: 240}},
      clips: {
        a: {notes: [[2, 'A1', 1.2, .95], [3, 'A1', .7, .6], [6, 'A1', 1.2, .95], [7, 'A1', .7, .6], [10, 'A1', 1.2, .95], [11, 'C2', .7, .7], [14, 'A1', 1.2, .95], [15, 'G1', .7, .6]]},
        b: {bars: 2, notes: [[2, 'A1', 1.2, .95], [3, 'A1', .7, .6], [6, 'A1', 1.2, .95], [7, 'C2', .7, .7], [10, 'A1', 1.2, .95], [11, 'A1', .7, .6], [14, 'E2', 1.2, .9], [15, 'D2', .7, .6],
          [18, 'A1', 1.2, .95], [19, 'A1', .7, .6], [22, 'A1', 1.2, .95], [23, 'G1', .7, .7], [26, 'A1', 1.2, .95], [27, 'C2', .7, .6], [30, 'G1', 1.2, .9], [31, 'E1', .7, .7]]}},
      mix: {vol: -6.5, chain: [{type: 'eq', bands: [{type: 'hp', f: 36, slope: 24}, {type: 'bell', f: 220, g: -2.5, q: 1.2}, {type: 'lp', f: 4500, slope: 12}]},
        {type: 'sc', src: 'drums:kick', depth: 8, att: .003, hold: .025, rel: .14}, {type: 'comp', thr: -16, ratio: 3, att: .005, rel: .08, gain: 2}]}},
    {id: 'blip', name: 'Blip', inst: {type: 'fm', preset: 'Wood blip', p: {i2: 3.4}},
      clips: {a: {bars: 2, notes: [[3, 'E4', 1, .8], [7, 'A4', 1, .55, {p: .5}], [10, 'E4', 1, .7], [19, 'G4', 1, .8], [22, 'E4', 1, .6, {p: .6}], [26, 'C5', 1, .7], [29, 'A4', 1, .5, {p: .5}]]}},
      mix: {vol: -10, pan: .25, chain: [{type: 'eq', bands: [{type: 'hp', f: 300, slope: 24}]}], sends: {echo: -5, verb: -16}}},
    {id: 'chord', name: 'Dub chord', inst: {type: 'analog', preset: 'Dub chord', p: {uni: 3, det: 14, spread: .9}},
      clips: {a: {bars: 2, notes: [[3, Am9, 1, .8], [14, Am7, .75, .6, {p: .7}], [22, Am9, 1, .75]]}, b: {notes: [[3, Am9, 1, .8], [10, Am7, .75, .6], [14, Am9, .75, .55, {p: .5}]]}},
      mix: {vol: -10, chain: [{type: 'eq', bands: [{type: 'hp', f: 220, slope: 24}, {type: 'bell', f: 700, g: -2, q: 1}]}, {type: 'sc', src: 'drums:kick', depth: 4, rel: .2}],
        sends: {echo: -4, verb: -10}}},
    {id: 'pad', name: 'Pad', inst: {type: 'analog', preset: 'Warm pad', p: {cut: 650}},
      clips: {a: {bars: 4, notes: [[0, ['A2', 'E3', 'G3', 'B3', 'C4'], 62, .6]]}},
      mix: {vol: -14, chain: [{type: 'eq', bands: [{type: 'hp', f: 150, slope: 24}]}, {type: 'sc', src: 'drums:kick', depth: 6, rel: .3}], sends: {verb: -8}}},
    {id: 'riser', name: 'Riser', inst: {type: 'analog', preset: 'Noise riser'},
      clips: {a: {bars: 8, notes: [[0, 'A3', 126, .8]]}},
      mix: {vol: -18, chain: [{type: 'eq', bands: [{type: 'hp', f: 200, slope: 12}]}], sends: {verb: -6, echo: -12}}},
  ],
  groups: [{id: 'bus', name: 'Drum bus', to: 'drums', chain: [{type: 'comp', thr: -20, ratio: 2.5, knee: 6, att: .008, rel: .12, gain: 1}]}],
  returns: [
    {id: 'verb', name: 'Hall', chain: [{type: 'reverb', p: {kind: 'Hall', size: .55, damp: .6, pre: .025, low: 380, mix: 1}}, {type: 'eq', bands: [{type: 'lp', f: 7000, slope: 12}]}]},
    {id: 'echo', name: 'Echo', chain: [{type: 'delay', p: {div: '1/8·', fb: .45, tone: 2600, ping: 1, mix: 1}}, {type: 'eq', bands: [{type: 'hp', f: 300, slope: 12}]}, {type: 'width', p: {w: 1.6}}], vol: -1}],
  master: {chain: [{type: 'eq', bands: [{type: 'hp', f: 24, slope: 24}]}, {type: 'comp', id: 'glue', thr: -12, ratio: 2, knee: 6, att: .02, rel: .15},
    {type: 'limiter', gain: 4, ceil: -.5}]},
  scenes: [
    {id: 'intro', clips: {drums: 'intro'}},
    {id: 'groove', clips: {drums: 'groove', bass: 'a'}},
    {id: 'dub', clips: {drums: 'dub', bass: 'a', blip: 'a', chord: 'a'}},
    {id: 'build', clips: {drums: 'build', bass: 'b', blip: 'a', chord: 'b', riser: 'a'}},
    {id: 'roll', clips: {drums: 'roll', bass: 'b', blip: 'a', chord: 'b', riser: 'a'}},
    {id: 'break', clips: {drums: 'hats', blip: 'a', chord: 'a', pad: 'a', riser: 'a'}},
    {id: 'drop', clips: {drums: 'drop', bass: 'b', blip: 'a', chord: 'a'}},
    {id: 'outro', clips: {drums: 'intro', bass: 'a'}},
  ],
  arrange: [['intro', 8], ['groove', 8], ['dub', 8], ['build', 7], ['roll', 1], ['break', 8], ['drop', 16], ['outro', 8]],
  auto: [
    // the bass opening through the groove and build, closing for the drop's first bars, then opening again
    {target: 'bass.inst.cut', points: [[8, 170], [16, 240], [24, 300], [32, 620], [40, 260], [44, 380], [52, 520], [56, 300], [64, 160]]},
    {target: 'bass.inst.fenv', points: [[24, .38], [32, .55], [40, .4], [52, .5], [56, .38]]},
    // the chord's filter: dark in the dub, opening through the break, bright in the drop
    {target: 'chord.inst.cut', points: [[16, 380], [24, 520], [32, 300], [40, 900], [48, 650], [56, 1100], [64, 700]]},
    {target: 'riser.inst.cut', points: [[24, 250], [31.9, 9000], [32, 250], [34, 250], [39.9, 7000]]},
    {target: 'riser.vol', points: [[24, -30], [31.9, -14], [32, -40], [34, -40], [39.9, -16], [40, -60]]},
    {target: 'pad.vol', points: [[32, -26], [36, -14], [40, -14]]},
    {target: 'bass.vol', points: [[56, -6.5], [64, -16]]},
  ],
  mods: [{target: 'blip.pan', shape: 'Sine', rate: '4 bars', depth: .45, center: .1}, {target: 'chord.inst.pan', shape: 'Triangle', rate: '2 bars', depth: .3}],
};
