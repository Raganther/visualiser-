// A blank song to make your own in: a drum rack, a Moog bass, a pad and a pluck, each with one empty clip (and a kick to
// play against), sends to a hall and an echo, the bass and pad ducking under the kick, and a mastered output.
const HATS_EQ = {type: 'eq', bands: [{type: 'hp', f: 400, slope: 24}]};
export function blankSong(n = 1, {bpm = 124, key = 'A minor'} = {}){
  return {
    title: `My song ${n}`, bpm, swing: .06, seed: 1000 + n, key,
    tracks: [
      {id: 'drums', name: 'Drums', inst: {type: 'drums', kit: '909'},
        pads: {
          kick: {voice: {tune: -1, decay: .8, x: .55, drive: .3, tone: .5}, mix: {vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 28, slope: 24}, {type: 'bell', f: 320, g: -4, q: 1.3}]}]}},
          clap: {mix: {vol: -8, chain: [{type: 'eq', bands: [{type: 'hp', f: 180, slope: 24}]}], sends: {verb: -12}}},
          chh: {name: 'Closed hat', kit: 'Minimal', swing: .12, voice: {pan: -.25}, mix: {vol: -10, chain: [HATS_EQ], sends: {verb: -26}}},
          ohh: {name: 'Open hat', kit: 'Minimal', swing: .12, voice: {pan: .25}, mix: {vol: -10, chain: [HATS_EQ], sends: {verb: -26}}},
          rim: {kit: 'Minimal', voice: {pan: .3}, mix: {vol: -14, sends: {echo: -14, verb: -20}}},
          clave: {kit: 'Minimal', voice: {pan: -.35}, mix: {vol: -14, sends: {echo: -14}}},
          tomL: {name: 'Low tom', kit: 'Minimal', mix: {vol: -12, sends: {verb: -18}}},
          shaker: {kit: '909', voice: {pan: .4}, mix: {vol: -16, chain: [HATS_EQ]}}},
        clips: {a: {hits: {kick: 'x...x...x...x...'}}}},
      {id: 'bass', name: 'Moog bass', inst: {type: 'moog', preset: 'Fat bass'}, clips: {a: {notes: []}},
        mix: {vol: -7, chain: [{type: 'eq', bands: [{type: 'hp', f: 32, slope: 24}, {type: 'bell', f: 240, g: -2, q: 1.2}]}, {type: 'sc', src: 'drums:kick', depth: 8, rel: .15}]}},
      {id: 'pad', name: 'Pad', inst: {type: 'moog', preset: 'Velvet pad'}, clips: {a: {bars: 2, notes: []}},
        mix: {vol: -12, chain: [{type: 'eq', bands: [{type: 'hp', f: 160, slope: 24}]}, {type: 'sc', src: 'drums:kick', depth: 6, rel: .28}], sends: {verb: -8}}},
      {id: 'pluck', name: 'Pluck', inst: {type: 'fm', preset: 'Wood blip'}, clips: {a: {notes: []}},
        mix: {vol: -12, pan: .2, chain: [{type: 'eq', bands: [{type: 'hp', f: 250, slope: 24}]}], sends: {echo: -8, verb: -16}}},
    ],
    returns: [
      {id: 'verb', name: 'Hall', chain: [{type: 'reverb', p: {kind: 'Hall', size: .6, damp: .55, pre: .025, low: 300, mix: 1}}]},
      {id: 'echo', name: 'Echo', chain: [{type: 'delay', p: {div: '1/8·', fb: .42, tone: 2800, ping: 1, mix: 1}}, {type: 'eq', bands: [{type: 'hp', f: 300, slope: 12}]}]}],
    master: {chain: [{type: 'eq', bands: [{type: 'hp', f: 24, slope: 24}]}, {type: 'comp', id: 'glue', thr: -12, ratio: 2, knee: 6, att: .02, rel: .15}, {type: 'limiter', gain: 3, ceil: -1}]},
    scenes: [{id: 'jam', clips: {drums: 'a', bass: 'a', pad: 'a', pluck: 'a'}}],
    arrange: [['jam', 16]],
  };
}
