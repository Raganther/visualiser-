// Auto-pan and tremolo: the sound swung side to side, or pulsed louder and softer, in time with the music.
import { DIVS, beatsOf, ease, lfo, shell } from './kit.js';

export default {key: 'autopan', label: 'Auto-pan', words: 'swinging side to side',
  params: [{key: 'mode', label: 'Mode', list: ['Pan', 'Tremolo'], def: 0}, {key: 'div', label: 'Time', list: DIVS.map(d => d[0]), def: 7},
    {key: 'depth', label: 'Depth', min: 0, max: 1, def: .7, unit: '%'}],
  make(ctx, env){
    const s = shell(ctx), P = {mode: 0, div: 7, depth: .7}, L = lfo(ctx, 1), pan = ctx.createStereoPanner(), trem = ctx.createGain(), dp = ctx.createGain(), dt = ctx.createGain();
    s.input.disconnect(); s.dry.gain.value = 0; s.input.connect(trem); trem.connect(pan); pan.connect(s.output);
    L.out.gain.value = 1; L.out.connect(dp); dp.connect(pan.pan); L.out.connect(dt); dt.connect(trem.gain);
    const apply = () => { const t = Math.round(P.mode) === 1; ease(ctx, dp.gain, t ? 0 : P.depth); ease(ctx, dt.gain, t ? P.depth/2 : 0); ease(ctx, trem.gain, t ? 1 - P.depth/2 : 1); };
    let hz = 0; const rate = now => { const r = 1/(env.period()*beatsOf(P.div)); if (Math.abs(r - hz) > 1e-5) { hz = r; L.osc.frequency.setTargetAtTime(r, now, .05); } };
    return {input: s.input, output: s.output, set(k, v){ P[k] = v; if (k === 'div') rate(ctx.currentTime); else apply(); }, tick(now){ rate(now); }};
  }};
