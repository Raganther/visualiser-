// Compressor: evens out the loud and the quiet (glue), with make-up gain after.
import { ease, shell } from './kit.js';

export default {key: 'comp', label: 'Compressor', words: 'glue',
  params: [{key: 'thr', label: 'Threshold', min: -48, max: 0, def: -18, unit: 'dB'}, {key: 'ratio', label: 'Ratio', min: 1, max: 20, def: 4, unit: ':1', log: true},
    {key: 'att', label: 'Attack', min: .001, max: .1, def: .01, unit: 'ms', log: true}, {key: 'rel', label: 'Release', min: .03, max: 1, def: .2, unit: 'ms', log: true},
    {key: 'gain', label: 'Make-up', min: 0, max: 18, def: 4, unit: 'dB'}],
  make(ctx){
    const s = shell(ctx), c = ctx.createDynamicsCompressor(), g = ctx.createGain();
    s.input.disconnect(); s.dry.gain.value = 0; s.input.connect(c); c.connect(g); g.connect(s.output); c.knee.value = 6;
    return {input: s.input, output: s.output, node: c,
      set(k, v){ if (k === 'gain') ease(ctx, g.gain, Math.pow(10, v/20)); else { const p = {thr: c.threshold, ratio: c.ratio, att: c.attack, rel: c.release}[k]; if (p) p.value = v; } }};
  }};
