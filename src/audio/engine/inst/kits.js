// The drum kit and the polysynth as registry instruments (one shape for the Studio's tracks): a note is a voice's key or its General MIDI number.
import { makeDrums, VOICES, PARAMS as DP, KITS } from './drums.js';
import { makePoly, PRESETS as PP, PARAMS as PG } from './poly.js';

const voiceOf = n => typeof n === 'string' ? n : (VOICES.find(v => v.note === n) || {}).key;
export const drums = {key: 'drums', label: 'Drums', words: 'thirteen synthesised voices in five kits', params: DP, voices: VOICES, presets: KITS,
  make(ctx, out){
    const kit = makeDrums(ctx, out);
    return {kit, P: kit.P,
      // a hit: the voice, at its settings or a step's own (lock)
      play(n, t, len, vel = 1, lock = null){ const k = voiceOf(n); if (k) kit.play(k, t, vel, lock); },
      // a voice's setting, as 'kick.tune'
      set(k, v){ const [vk, pk] = k.split('.'); if (pk) kit.set(vk, pk, v); }, param: () => null,
      load(p = {}){ kit.load(p.kit || '909', p.voices || {}); }, start(){}, allOff(){}};
  }};
export const poly = {key: 'poly', label: 'Polysynth', words: 'the groovebox\'s synth', groups: PG, params: PG.flatMap(g => g[1]), presets: PP,
  make(ctx, out, env){
    const s = makePoly(ctx, out, env);
    return {synth: s, P: s.P, play: (n, t, len, vel) => s.play(n, t, len, vel), noteOn: s.noteOn, noteOff: s.noteOff, allOff: s.allOff,
      set: (k, v) => s.set(k, v), param: () => null, load(p = {}){ s.load({...(PP[p.preset] || {}), ...p}); }, start(){}};
  }};
