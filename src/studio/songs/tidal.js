// Tidal: melodic progressive house, 122 BPM in D minor (Dm9, B♭maj7, Fmaj7, Csus2). A wide supersaw pad and a sixteenth
// arpeggio through a ping-pong echo, both breathing under the kick; a rolling bass on the roots; an FM bell melody in the
// break that returns over the drop with the ride and everything else.
const C = [['D3', 'A3', 'C4', 'E4', 'F4'], ['A#2', 'F3', 'A3', 'D4'], ['F3', 'A3', 'C4', 'E4'], ['C3', 'G3', 'D4', 'E4']];
const ROOT = ['D2', 'A#1', 'F1', 'C2'];
// the arpeggio: each bar's chord tones over two octaves, up and back
const ARP = [['D4', 'F4', 'A4', 'C5', 'E5', 'A5'], ['D4', 'F4', 'A4', 'A#4', 'D5', 'F5'], ['C4', 'E4', 'F4', 'A4', 'C5', 'E5'], ['C4', 'D4', 'E4', 'G4', 'C5', 'D5']];
const ORDER = [0, 1, 2, 3, 4, 5, 4, 3, 1, 2, 3, 4, 5, 3, 2, 1];
const arp = ARP.flatMap((ch, b) => ORDER.map((i, k) => [b*16 + k, ch[i], .8, k % 4 === 0 ? .9 : k % 2 ? .55 : .7]));
const bass = ROOT.flatMap((r, b) => [[b*16 + 2, r, 1.2, .95], [b*16 + 3, r, .7, .6], [b*16 + 6, r, 1.2, .95], [b*16 + 7, r, .7, .6], [b*16 + 10, r, 1.2, .95],
  [b*16 + 11, r, .7, .65], [b*16 + 14, r, 1.2, .9], [b*16 + 15, b === 3 ? 'D2' : r, .7, .7]]);
// the melody: four bars, answering itself
const MEL = [[0, 'A4', 3], [3, 'F4', 1], [4, 'G4', 2], [6, 'A4', 4], [16, 'D5', 3], [19, 'C5', 1], [20, 'A4', 6], [32, 'C5', 3], [35, 'A4', 1], [36, 'G4', 2], [38, 'F4', 4],
  [48, 'E4', 3], [51, 'G4', 1], [52, 'E4', 2], [54, 'D4', 6]];
export default {
  title: 'Tidal', bpm: 122, swing: .04, seed: 11, key: 'D minor',
  tracks: [
    {id: 'kick', name: 'Kick', inst: {type: 'drums', kit: '909', voices: {kick: {tune: -1, decay: .85, x: .5, drive: .2, tone: .55}}},
      clips: {four: {hits: {kick: 'x...|x...|x...|x...'}}},
      mix: {vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 30, slope: 24}, {type: 'bell', f: 62, g: 1, q: 1}, {type: 'bell', f: 300, g: -4, q: 1.3}]}]}},
    {id: 'bass', name: 'Bass', inst: {type: 'analog', preset: 'Rolling bass', p: {cut: 300, fenv: .42}},
      clips: {a: {bars: 4, notes: bass}},
      mix: {vol: -6, chain: [{type: 'eq', bands: [{type: 'hp', f: 34, slope: 24}, {type: 'bell', f: 240, g: -2.5, q: 1.2}, {type: 'lp', f: 5000, slope: 12}]},
        {type: 'sc', src: 'kick', depth: 8, att: .003, hold: .02, rel: .15}, {type: 'comp', thr: -16, ratio: 3, att: .005, rel: .08, gain: 2}]}},
    {id: 'hats', name: 'Hats', inst: {type: 'drums', kit: '909', voices: {chh: {decay: .8, tone: .9, level: .9, pan: .25}, ohh: {decay: .7, pan: -.2}, shaker: {level: .8, pan: -.4}}}, swing: .1,
      clips: {thin: {hits: {chh: '..x.|..x.|..x.|..x.'}}, full: {hits: {chh: '5.7.|5.7.|5.7.|5.77', ohh: '..x.|..x.|..x.|..x.', shaker: '3535|3535|3535|3535'}}},
      mix: {vol: -11, pan: .1, to: 'drums', chain: [{type: 'eq', bands: [{type: 'hp', f: 450, slope: 24}]}], sends: {verb: -26}}},
    {id: 'clap', name: 'Clap', inst: {type: 'drums', kit: '909', voices: {clap: {decay: 1.1, x: .7}, snare: {tune: 3, decay: .55, x: .8}}},
      clips: {two: {hits: {clap: '....|x...|....|x...'}}, roll: {bars: 1, hits: {snare: '3.3.|4.4.|5555|6789'}}},
      mix: {vol: -9, to: 'drums', chain: [{type: 'eq', bands: [{type: 'hp', f: 200, slope: 24}]}], sends: {verb: -12}}},
    {id: 'ride', name: 'Ride', inst: {type: 'drums', kit: '909', voices: {ride: {decay: .8, x: .35, pan: .3}, crash: {decay: 1.2}}},
      clips: {a: {hits: {ride: 'x.o.|x.o.|x.o.|x.oo'}}, crash: {bars: 16, hits: {crash: 'X'}}},
      mix: {vol: -16, to: 'drums', chain: [{type: 'eq', bands: [{type: 'hp', f: 600, slope: 24}]}], sends: {verb: -18}}},
    {id: 'pad', name: 'Pad', inst: {type: 'analog', preset: 'Supersaw pad', p: {cut: 1200}},
      clips: {a: {bars: 4, notes: C.map((ch, b) => [b*16, ch, 15.5, .65])}},
      mix: {vol: -10, chain: [{type: 'eq', bands: [{type: 'hp', f: 180, slope: 24}, {type: 'bell', f: 450, g: -3, q: .9}, {type: 'hs', f: 9000, g: -2}]},
        {type: 'sc', src: 'kick', depth: 7, att: .01, hold: .02, rel: .28}], sends: {verb: -9}}},
    {id: 'arp', name: 'Arp', inst: {type: 'analog', preset: 'Arp', p: {cut: 900}},
      clips: {a: {bars: 4, notes: arp}},
      mix: {vol: -13, pan: -.12, chain: [{type: 'eq', bands: [{type: 'hp', f: 250, slope: 24}]}, {type: 'sc', src: 'kick', depth: 4, rel: .2}], sends: {echo: -8, verb: -16}}},
    {id: 'bell', name: 'Bell', inst: {type: 'fm', preset: 'Bell', p: {ad: 1.6, ar: 1.2}},
      clips: {a: {bars: 4, notes: MEL.map(([s, n, l]) => [s, n, l, .8])}},
      mix: {vol: -11, pan: .15, chain: [{type: 'eq', bands: [{type: 'hp', f: 300, slope: 24}, {type: 'bell', f: 3000, g: -2, q: 1}]}], sends: {echo: -10, verb: -8}}},
    {id: 'riser', name: 'Riser', inst: {type: 'analog', preset: 'Noise riser'},
      clips: {a: {bars: 8, notes: [[0, 'A3', 126, .8]]}},
      mix: {vol: -18, sends: {verb: -8}}},
  ],
  groups: [{id: 'drums', name: 'Drums', chain: [{type: 'comp', thr: -18, ratio: 2.5, att: .01, rel: .12, gain: 1}]}],
  returns: [
    {id: 'verb', name: 'Hall', chain: [{type: 'reverb', p: {kind: 'Hall', size: .75, damp: .5, pre: .03, low: 300, mix: 1}}, {type: 'eq', bands: [{type: 'lp', f: 8000, slope: 12}]}]},
    {id: 'echo', name: 'Echo', chain: [{type: 'delay', p: {div: '1/8·', fb: .4, tone: 3200, ping: 1, mix: 1}}, {type: 'eq', bands: [{type: 'hp', f: 300, slope: 12}]}], vol: -1}],
  master: {chain: [{type: 'eq', bands: [{type: 'hp', f: 24, slope: 24}]}, {type: 'comp', id: 'glue', thr: -12, ratio: 2, knee: 6, att: .02, rel: .15},
    {type: 'limiter', gain: 3.5, ceil: -1}]},
  scenes: [
    {id: 'intro', clips: {pad: 'a', hats: 'thin', arp: 'a'}},
    {id: 'build', clips: {kick: 'four', bass: 'a', pad: 'a', hats: 'thin', arp: 'a'}},
    {id: 'main', clips: {kick: 'four', bass: 'a', pad: 'a', hats: 'full', clap: 'two', arp: 'a'}},
    {id: 'break', clips: {pad: 'a', arp: 'a', bell: 'a', riser: 'a'}},
    {id: 'roll', clips: {pad: 'a', arp: 'a', bell: 'a', riser: 'a', clap: 'roll'}},
    {id: 'drop', clips: {kick: 'four', bass: 'a', pad: 'a', hats: 'full', clap: 'two', arp: 'a', bell: 'a', ride: 'a'}},
    {id: 'crash', clips: {kick: 'four', bass: 'a', pad: 'a', hats: 'full', clap: 'two', arp: 'a', bell: 'a', ride: 'crash'}},
    {id: 'outro', clips: {kick: 'four', pad: 'a', hats: 'thin', arp: 'a'}},
  ],
  arrange: [['intro', 8], ['build', 8], ['main', 8], ['break', 7], ['roll', 1], ['crash', 1], ['drop', 15], ['outro', 8]],
  auto: [
    // the arpeggio's filter opening from the intro to the drop, and closing again after the break
    {target: 'arp.inst.cut', points: [[0, 350], [8, 700], [16, 1100], [24, 800], [31.9, 2200], [32, 1600], [48, 1800], [56, 500]]},
    {target: 'pad.inst.cut', points: [[0, 500], [8, 900], [16, 1200], [24, 1600], [32, 1400], [48, 1300], [56, 600]]},
    {target: 'riser.inst.cut', points: [[24, 300], [31.9, 8000]]},
    {target: 'riser.vol', points: [[24, -36], [31.9, -14], [32, -60]]},
    {target: 'bass.inst.cut', points: [[8, 180], [16, 300], [24, 300], [32, 420], [48, 420]]},
    {target: 'kick.vol', points: [[48, -1], [55, -4]]},
  ],
  mods: [{target: 'arp.pan', shape: 'Sine', rate: '4 bars', depth: .35, center: -.05}, {target: 'bell.inst.index', shape: 'Triangle', rate: '8 bars', depth: .35, center: 1}],
};
