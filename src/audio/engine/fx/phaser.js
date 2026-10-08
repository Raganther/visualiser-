// Phaser: six all-pass stages sweeping up and down, notches moving through the sound, the two sides sweeping opposite ways.
import { bq, ease, lfo, shell, stereo } from './kit.js';

const BASE = [200, 400, 800, 1600, 3200, 6400];
export default {key: 'phaser', label: 'Phaser', words: 'notches sweeping through',
  params: [{key: 'rate', label: 'Rate', min: .02, max: 4, def: .3, unit: 'Hz', log: true}, {key: 'depth', label: 'Depth', min: 0, max: 1, def: .7, unit: '%'},
    {key: 'fb', label: 'Feedback', min: 0, max: .85, def: .4, unit: '%'}, {key: 'mix', label: 'Mix', min: 0, max: 1, def: .5, unit: '%'}],
  make(ctx){
    const s = shell(ctx), L = lfo(ctx, .3), inv = ctx.createGain(); inv.gain.value = -1; L.out.connect(inv);
    const fbs = [];
    // the LFO moves every stage by the same number of cents (detune), so the notches keep their spacing as they sweep
    stereo(ctx, s.input, c => { const sum = ctx.createGain(), fb = ctx.createGain(); let n = sum;
      for (const f of BASE) { const a = bq(ctx, 'allpass', f, .6); (c ? inv : L.out).connect(a.detune); n.connect(a); n = a; }
      n.connect(fb); fb.connect(sum); fbs.push(fb); return [sum, n]; }).connect(s.wet);
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'rate') ease(ctx, L.osc.frequency, v); else if (k === 'depth') ease(ctx, L.out.gain, v*1800); else if (k === 'fb') fbs.forEach(f => ease(ctx, f.gain, v)); }};
  }};
