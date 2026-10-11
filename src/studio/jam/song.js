// The jam's song: six parts, each a lane of its own (a track in the Studio's format), so any part can come in, drop out or
// change on its own. The kit is split three ways (kick and snare, hats, percussion) because adding and taking away the
// hats or the percussion is most of what makes a groove move. Every lane sends to a hall and an echo (off until a
// Space macro opens them), and the bass and chords duck under the kick.
const HATS_EQ = {type: 'eq', bands: [{type: 'hp', f: 400, slope: 24}]};
const sends = (verb = -40, echo = -40) => ({verb, echo});

// the parts in the order the faces show them: key, label, the instrument to make its ideas with, its colour
export const PARTS = [
  {key: 'drums', label: 'Kick & snare', kind: 'drums', gen: 'drums', hue: 18},
  {key: 'hats', label: 'Hats', kind: 'drums', gen: 'hats', hue: 48},
  {key: 'perc', label: 'Percussion', kind: 'drums', gen: 'perc', hue: 88},
  {key: 'bass', label: 'Bass', kind: 'notes', gen: 'bass', hue: 200, low: true},
  {key: 'chords', label: 'Chords', kind: 'notes', gen: 'chords', hue: 265},
  {key: 'hook', label: 'Hook', kind: 'notes', gen: 'hook', hue: 320}];
export const part = k => PARTS.find(p => p.key === k);
// the voices each drum lane owns (its pads, in the order its pad grid shows them)
export const VOICES = {drums: ['kick', 'snare', 'clap', 'tomL'], hats: ['chh', 'ohh', 'ride', 'crash'], perc: ['rim', 'clave', 'shaker', 'cow']};

export function jamSong({bpm = 126, key = 'A minor', title = 'Jam'} = {}){
  const pad = (mix, o = {}) => ({...o, mix});
  return {
    title, bpm, swing: .06, seed: 4242, key,
    tracks: [
      {id: 'drums', name: 'Kick & snare', inst: {type: 'drums', kit: '909'},
        pads: {
          kick: pad({vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 28, slope: 24}, {type: 'bell', f: 320, g: -4, q: 1.3}]}]}, {voice: {tune: -1, decay: .8, x: .55, drive: .3, tone: .5}}),
          snare: pad({vol: -9, chain: [{type: 'eq', bands: [{type: 'hp', f: 160, slope: 24}]}], sends: sends(-14)}, {kit: 'Minimal'}),
          clap: pad({vol: -8, chain: [{type: 'eq', bands: [{type: 'hp', f: 180, slope: 24}]}], sends: sends(-12)}),
          tomL: pad({vol: -12, sends: sends(-18)}, {name: 'Low tom', kit: 'Minimal'})},
        clips: {}, mix: {sends: sends()}},
      {id: 'hats', name: 'Hats', inst: {type: 'drums', kit: 'Minimal'},
        pads: {
          chh: pad({vol: -10, chain: [HATS_EQ], sends: sends(-26)}, {name: 'Closed hat', swing: .12, voice: {pan: -.2}}),
          ohh: pad({vol: -11, chain: [HATS_EQ], sends: sends(-26)}, {name: 'Open hat', swing: .12, voice: {pan: .2}}),
          ride: pad({vol: -16, chain: [HATS_EQ], sends: sends(-22)}, {kit: '909', voice: {pan: -.3}}),
          crash: pad({vol: -16, chain: [HATS_EQ], sends: sends(-18)}, {kit: '909'})},
        clips: {}, mix: {sends: sends()}},
      {id: 'perc', name: 'Percussion', inst: {type: 'drums', kit: 'Minimal'},
        pads: {
          rim: pad({vol: -13, sends: sends(-20, -14)}, {voice: {pan: .3}}),
          clave: pad({vol: -14, sends: sends(-40, -14)}, {voice: {pan: -.35}}),
          shaker: pad({vol: -16, chain: [HATS_EQ]}, {kit: '909', voice: {pan: .4}}),
          cow: pad({vol: -17, sends: sends(-22, -16)}, {voice: {pan: -.15}})},
        clips: {}, mix: {sends: sends()}},
      {id: 'bass', name: 'Bass', inst: {type: 'moog', preset: 'Rubber bass'}, clips: {},
        mix: {vol: -7, chain: [{type: 'eq', bands: [{type: 'hp', f: 32, slope: 24}, {type: 'bell', f: 240, g: -2, q: 1.2}]}, {type: 'sc', src: 'drums:kick', depth: 9, rel: .15}], sends: sends()}},
      {id: 'chords', name: 'Chords', inst: {type: 'analog', preset: 'Dub chord'}, clips: {},
        mix: {vol: -13, chain: [{type: 'eq', bands: [{type: 'hp', f: 180, slope: 24}]}, {type: 'sc', src: 'drums:kick', depth: 6, rel: .25}], sends: sends(-12, -10)}},
      {id: 'hook', name: 'Hook', inst: {type: 'fm', preset: 'Wood blip'}, clips: {},
        mix: {vol: -12, pan: .15, chain: [{type: 'eq', bands: [{type: 'hp', f: 250, slope: 24}]}], sends: sends(-16, -8)}}],
    returns: [
      {id: 'verb', name: 'Hall', chain: [{type: 'reverb', p: {kind: 'Hall', size: .45, damp: .55, pre: .025, low: 300, mix: 1}}]},
      {id: 'echo', name: 'Echo', chain: [{type: 'delay', p: {div: '1/8·', fb: .45, tone: 2600, ping: 1, mix: 1}}, {type: 'eq', bands: [{type: 'hp', f: 300, slope: 12}]}]}],
    master: {chain: [{type: 'eq', bands: [{type: 'hp', f: 24, slope: 24}]}, {type: 'comp', id: 'glue', thr: -12, ratio: 2, knee: 6, att: .02, rel: .15}, {type: 'limiter', gain: 3, ceil: -1}]},
    scenes: [{id: 'jam', clips: {}}],
    arrange: [['jam', 8]],
    // the jam's own state: each lane's takes in the order they were made, the one it plays, whether it's muted
    jam: {style: 'minimal', energy: .5, expr: .6, lanes: {}},
  };
}
