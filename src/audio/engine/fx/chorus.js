// Chorus: two slightly moving copies, one each side, swaying against each other: wide and lush.
import { ease, lfo, shell, stereo } from './kit.js';

export default {key: 'chorus', label: 'Chorus', words: 'wide and lush',
  params: [{key: 'rate', label: 'Rate', min: .05, max: 5, def: .6, unit: 'Hz', log: true}, {key: 'depth', label: 'Depth', min: 0, max: 1, def: .5, unit: '%'},
    {key: 'mix', label: 'Mix', min: 0, max: 1, def: .5, unit: '%'}],
  make(ctx){
    const s = shell(ctx), L = lfo(ctx, .6), inv = ctx.createGain(); inv.gain.value = -1; L.out.connect(inv);
    const dl = [];
    stereo(ctx, s.input, c => { const d = ctx.createDelay(.1); d.delayTime.value = .014; (c ? inv : L.out).connect(d.delayTime); dl.push(d); return [d, d]; }).connect(s.wet);
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'rate') ease(ctx, L.osc.frequency, v); else if (k === 'depth') ease(ctx, L.out.gain, v*.006); }};
  }};
