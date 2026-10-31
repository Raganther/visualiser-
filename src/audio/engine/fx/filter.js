// Filter: a resonant low-pass, high-pass or band-pass (two stages, steep), its cutoff swept by an LFO in time with the music.
import { DIVS, beatsOf, bq, ease, lfo, shell } from './kit.js';

const KINDS = ['Low', 'High', 'Band'], TYPE = ['lowpass', 'highpass', 'bandpass'];
export default {key: 'filter', label: 'Filter', words: 'a resonant sweep',
  params: [{key: 'kind', label: 'Kind', list: KINDS, def: 0}, {key: 'cut', label: 'Cutoff', min: 40, max: 18000, def: 2000, unit: 'Hz', log: true},
    {key: 'res', label: 'Resonance', min: 0, max: 1, def: .3, unit: '%'}, {key: 'lfo', label: 'Sweep', min: 0, max: 1, def: 0, unit: '%'},
    {key: 'div', label: 'Sweep time', list: DIVS.map(d => d[0]), def: 8}, {key: 'mix', label: 'Mix', min: 0, max: 1, def: 1, unit: '%'}],
  make(ctx, env){
    const s = shell(ctx), P = {div: 8}, f = [bq(ctx, 'lowpass', 2000, .7), bq(ctx, 'lowpass', 2000, .7)], L = lfo(ctx, .5);
    s.input.connect(f[0]); f[0].connect(f[1]); f[1].connect(s.wet);
    for (const b of f) L.out.connect(b.detune);
    let hz = 0; const rate = now => { const r = 1/(env.period()*beatsOf(P.div)); if (Math.abs(r - hz) > 1e-5) { hz = r; L.osc.frequency.setTargetAtTime(r, now, .05); } };
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'kind') f.forEach(b => b.type = TYPE[Math.round(v)] || 'lowpass');
        else if (k === 'cut') f.forEach(b => ease(ctx, b.frequency, v)); else if (k === 'res') { ease(ctx, f[0].Q, .7 + v*12); ease(ctx, f[1].Q, .7 + v*3); }
        else if (k === 'lfo') ease(ctx, L.out.gain, v*3600); else if (k === 'div') { P.div = v; rate(ctx.currentTime); } },
      tick(now){ rate(now); }};
  }};
