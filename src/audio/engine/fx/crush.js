// Bitcrush: the sound stepped down to fewer levels (fewer bits), the grit of old samplers, with a tone control after it.
import { bq, ease, shell } from './kit.js';

const steps = bits => { const n = 8192, c = new Float32Array(n), L = Math.pow(2, bits - 1);
  for (let i = 0; i < n; i++) { const x = i/(n - 1)*2 - 1; c[i] = Math.round(x*L)/L; } return c; };
export default {key: 'crush', label: 'Bitcrush', words: 'the grit of old samplers',
  params: [{key: 'bits', label: 'Bits', min: 1, max: 12, def: 6, unit: '', step: 1}, {key: 'tone', label: 'Tone', min: 500, max: 18000, def: 9000, unit: 'Hz', log: true},
    {key: 'mix', label: 'Mix', min: 0, max: 1, def: .7, unit: '%'}],
  make(ctx){
    const s = shell(ctx), ws = ctx.createWaveShaper(), lp = bq(ctx, 'lowpass', 9000, .5);
    s.input.connect(ws); ws.connect(lp); lp.connect(s.wet); ws.curve = steps(6);
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'tone') ease(ctx, lp.frequency, v); else if (k === 'bits') ws.curve = steps(Math.round(v)); }};
  }};
