// Flanger: a very short moving echo fed back on itself: the jet-plane sweep.
import { ease, lfo, shell, stereo } from './kit.js';

export default {key: 'flanger', label: 'Flanger', words: 'a jet-plane sweep',
  params: [{key: 'rate', label: 'Rate', min: .02, max: 4, def: .25, unit: 'Hz', log: true}, {key: 'depth', label: 'Depth', min: 0, max: 1, def: .7, unit: '%'},
    {key: 'fb', label: 'Feedback', min: -.9, max: .9, def: .6, unit: '%'}, {key: 'mix', label: 'Mix', min: 0, max: 1, def: .5, unit: '%'}],
  make(ctx){
    const s = shell(ctx), L = lfo(ctx, .25), inv = ctx.createGain(); inv.gain.value = -1; L.out.connect(inv);
    const fbs = [];
    stereo(ctx, s.input, c => { const sum = ctx.createGain(), d = ctx.createDelay(.05), fb = ctx.createGain(); d.delayTime.value = .0035;
      (c ? inv : L.out).connect(d.delayTime); sum.connect(d); d.connect(fb); fb.connect(sum); fbs.push(fb); return [sum, d]; }).connect(s.wet);
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'rate') ease(ctx, L.osc.frequency, v); else if (k === 'depth') ease(ctx, L.out.gain, v*.003); else if (k === 'fb') fbs.forEach(f => ease(ctx, f.gain, v)); }};
  }};
