// Low Orbit: deep, smooth techno at 123 BPM in F minor, made to show the Moog. A rolling Moog bass sliding between its
// notes under a deep kick; a velvet Moog pad on Fm9, D♭maj7, E♭sus2 and Cm7, breathing under the kick; a textured Moog
// drone ringing through its emphasis; a plucked arpeggio into a dotted echo; and a singing Moog lead that comes in over
// the break and carries the drop.
const CH = [['F3', 'G#3', 'C4', 'D#4', 'G4'], ['C#3', 'F3', 'G#3', 'C4'], ['D#3', 'F3', 'A#3', 'D#4'], ['C3', 'D#3', 'G3', 'A#3']];
const ROOT = ['F1', 'C#2', 'D#2', 'C2'], UP = ['F2', 'C#3', 'D#3', 'C3'];
const bass = ROOT.flatMap((r, b) => [[b*16 + 2, r, 1.2, .95], [b*16 + 3, r, .6, .55], [b*16 + 6, r, 1.2, .9], [b*16 + 8, UP[b], .6, .6], [b*16 + 10, r, 1.2, .95],
  [b*16 + 12, r, .6, .5, {p: .6}], [b*16 + 14, r, 1, .9, {slide: true}], [b*16 + 15, UP[b], .8, .7]]);
const ARP = [['F4', 'G#4', 'C5', 'D#5'], ['F4', 'G#4', 'C5', 'C#5'], ['F4', 'A#4', 'D#5', 'F5'], ['D#4', 'G4', 'A#4', 'C5']];
const arp = ARP.flatMap((ch, b) => [0, 3, 6, 8, 10, 13].map((s, k) => [b*16 + s, ch[k % 4], 1, k ? .6 : .85, {p: k ? .75 : 1}]));
const LEAD = [[0, 'C5', 3], [3, 'G#4', 1], [4, 'A#4', 2], [6, 'C5', 6], [16, 'D#5', 3], [19, 'C#5', 2], [21, 'C5', 9], [32, 'A#4', 3], [35, 'C5', 2], [37, 'G#4', 7],
  [48, 'G4', 6], [56, 'F4', 8]];
const FOUR = {kick: 'x...|x...|x...|x...'}, HATS = {chh: '..x.|..x.|..x.|..x.', shaker: '3434|3434|3434|3445'}, OPEN = {ohh: '..x.|..x.|..x.|..x.'},
  PERC = {rim: '...x|..x.|....|x..?|...x|..x.|..x.|....', clap: '....|x...|....|x...|....|x...|....|x..?'};
const HATS_EQ = {type: 'eq', bands: [{type: 'hp', f: 450, slope: 24}, {type: 'hs', f: 10000, g: -1.5}]};
export default {
  title: 'Low Orbit', bpm: 123, swing: .07, seed: 23, key: 'F minor',
  tracks: [
    {id: 'drums', name: 'Drums', inst: {type: 'drums', kit: '909'},
      pads: {
        kick: {voice: {tune: -3, decay: .95, x: .45, drive: .25, tone: .45}, mix: {vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 28, slope: 24}, {type: 'bell', f: 50, g: 1.5, q: 1}, {type: 'bell', f: 300, g: -4.5, q: 1.3}, {type: 'hs', f: 6000, g: -2}]}]}},
        chh: {name: 'Closed hat', kit: 'Minimal', swing: .12, voice: {tone: .85, decay: .8, pan: -.28}, mix: {vol: -10, to: 'bus', chain: [HATS_EQ], sends: {verb: -24}}},
        ohh: {name: 'Open hat', kit: 'Minimal', swing: .12, voice: {decay: .6, x: .25, pan: .28}, mix: {vol: -11, to: 'bus', chain: [HATS_EQ], sends: {verb: -24}}},
        shaker: {swing: .12, voice: {level: .8, pan: .4}, mix: {vol: -15, to: 'bus', chain: [HATS_EQ]}},
        rim: {kit: 'Minimal', voice: {tune: -1, pan: .3}, mix: {vol: -14, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 300, slope: 24}]}], sends: {echo: -10, verb: -18}}},
        clap: {voice: {decay: 1.1, x: .7, tone: .8}, mix: {vol: -10, to: 'bus', chain: [{type: 'eq', bands: [{type: 'hp', f: 200, slope: 24}]}], sends: {verb: -11}}}},
      clips: {
        hats: {hits: HATS},
        groove: {bars: 2, hits: {...FOUR, ...HATS, rim: PERC.rim}},
        lift: {bars: 2, hits: {...FOUR, ...HATS, ...OPEN, ...PERC}},
        break: {hits: {shaker: HATS.shaker}},
        drop: {bars: 2, hits: {...FOUR, ...HATS, ...OPEN, ...PERC}}}},
    {id: 'bass', name: 'Moog bass', inst: {type: 'moog', preset: 'Fat bass', p: {glide: .04, cut: 260, res: .32}},
      clips: {a: {bars: 4, notes: bass}},
      mix: {vol: -7, chain: [{type: 'eq', bands: [{type: 'hp', f: 34, slope: 24}, {type: 'bell', f: 230, g: -2.5, q: 1.2}, {type: 'lp', f: 5000, slope: 12}]},
        {type: 'sc', src: 'drums:kick', depth: 9, att: .003, hold: .02, rel: .15}, {type: 'comp', thr: -16, ratio: 3, att: .005, rel: .08, gain: 2}]}},
    {id: 'pad', name: 'Velvet pad', inst: {type: 'moog', preset: 'Velvet pad', p: {cut: 800}},
      clips: {a: {bars: 4, notes: CH.map((c, b) => [b*16, c, 15.5, .65])}},
      mix: {vol: -11, chain: [{type: 'eq', bands: [{type: 'hp', f: 170, slope: 24}, {type: 'bell', f: 420, g: -3, q: .9}]}, {type: 'sc', src: 'drums:kick', depth: 7, att: .01, rel: .3}], sends: {verb: -8}}},
    {id: 'drone', name: 'Texture', inst: {type: 'moog', preset: 'Texture'},
      clips: {a: {bars: 8, notes: [[0, ['F2', 'C3'], 126, .6]]}},
      mix: {vol: -13, pan: -.1, chain: [{type: 'eq', bands: [{type: 'hp', f: 200, slope: 24}]}, {type: 'sc', src: 'drums:kick', depth: 4, rel: .3}], sends: {verb: -6}}},
    {id: 'arp', name: 'Pluck arp', inst: {type: 'analog', preset: 'Pluck', p: {cut: 900}},
      clips: {a: {bars: 4, notes: arp}},
      mix: {vol: -9, pan: .2, chain: [{type: 'eq', bands: [{type: 'hp', f: 300, slope: 24}]}, {type: 'sc', src: 'drums:kick', depth: 4, rel: .2}], sends: {echo: -6, verb: -14}}},
    {id: 'lead', name: 'Moog lead', inst: {type: 'moog', preset: 'Lead', p: {cut: 1300}},
      clips: {a: {bars: 4, notes: LEAD.map(([s, n, l]) => [s, n, l, .85])}},
      mix: {vol: -11, chain: [{type: 'eq', bands: [{type: 'hp', f: 200, slope: 24}, {type: 'bell', f: 2800, g: -2, q: 1}]}], sends: {echo: -9, verb: -10}}},
  ],
  groups: [{id: 'bus', name: 'Drum bus', to: 'drums', chain: [{type: 'comp', thr: -18, ratio: 2.5, att: .01, rel: .12, gain: 1}]}],
  returns: [
    {id: 'verb', name: 'Hall', chain: [{type: 'reverb', p: {kind: 'Hall', size: .7, damp: .55, pre: .03, low: 300, mix: 1}}, {type: 'eq', bands: [{type: 'lp', f: 7500, slope: 12}]}]},
    {id: 'echo', name: 'Echo', chain: [{type: 'delay', p: {div: '1/8·', fb: .45, tone: 2600, ping: 1, mix: 1}}, {type: 'eq', bands: [{type: 'hp', f: 300, slope: 12}]}, {type: 'width', p: {w: 1.5}}], vol: -1}],
  master: {chain: [{type: 'eq', bands: [{type: 'hp', f: 24, slope: 24}]}, {type: 'comp', id: 'glue', thr: -12, ratio: 2, knee: 6, att: .02, rel: .15},
    {type: 'limiter', gain: 3.5, ceil: -1}]},
  scenes: [
    {id: 'intro', clips: {drums: 'hats', pad: 'a', drone: 'a'}},
    {id: 'groove', clips: {drums: 'groove', bass: 'a', pad: 'a', drone: 'a'}},
    {id: 'lift', clips: {drums: 'lift', bass: 'a', pad: 'a', arp: 'a', drone: 'a'}},
    {id: 'break', clips: {drums: 'break', pad: 'a', lead: 'a', drone: 'a', arp: 'a'}},
    {id: 'drop', clips: {drums: 'drop', bass: 'a', pad: 'a', lead: 'a', arp: 'a', drone: 'a'}},
    {id: 'outro', clips: {drums: 'groove', bass: 'a', pad: 'a'}},
  ],
  arrange: [['intro', 8], ['groove', 16], ['lift', 8], ['break', 8], ['drop', 16], ['outro', 8]],
  auto: [
    // the bass opening as the groove settles, more contour into the lift, closed for the break's return, wide in the drop
    {target: 'bass.inst.cut', points: [[8, 170], [24, 300], [32, 380], [48, 260], [56, 420], [64, 300], [72, 180]]},
    {target: 'bass.inst.cenv', points: [[8, 2.6], [24, 3.2], [32, 3.6], [48, 3], [56, 3.8], [64, 3]]},
    {target: 'pad.inst.cut', points: [[0, 400], [8, 700], [24, 900], [32, 1400], [40, 1700], [48, 1100], [64, 1200], [72, 500]]},
    {target: 'lead.vol', points: [[32, -22], [34, -11]]},
    {target: 'arp.inst.cut', points: [[24, 500], [32, 1300], [40, 900], [56, 1600], [64, 800]]},
    {target: 'drone.vol', points: [[0, -16], [8, -13], [32, -10], [40, -14], [72, -20]]},
  ],
  mods: [{target: 'lead.inst.cut', shape: 'Sine', rate: '8 bars', depth: 500, center: 1500}, {target: 'arp.pan', shape: 'Sine', rate: '4 bars', depth: .35, center: .1}],
};
