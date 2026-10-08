// Reverb: a space round the sound (a hall, a room or a plate), from an impulse response made here: noise dying away, darker as it goes.
import { bq, ease, shell } from './kit.js';

const KINDS = ['Hall', 'Room', 'Plate'];
// the impulse: stereo noise falling 60 dB over its length, each channel its own (so it's wide), its highs dying first
// (damping), a room's first reflections as clear taps, a plate dense and bright from the start
function impulse(ctx, kind, size, damp){
  const sr = ctx.sampleRate, secs = [.8 + size*5.2, .25 + size*1.6, .6 + size*3.4][kind], n = Math.max(64, Math.round(sr*secs)), b = ctx.createBuffer(2, n, sr);
  const build = [.04, .004, .002][kind]*sr;   // (a hall swells in over its first moments)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0, seed = 1234567 + c*7654321;
    const rnd = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/2147483648 - 1; };
    for (let i = 0; i < n; i++) {
      const x = i/n, a = Math.min(.985, damp*(kind === 2 ? .5 : 1)*Math.sqrt(x)*.98);
      lp = a*lp + (1 - a)*rnd();
      d[i] = lp*Math.exp(-6.9*x)*(i < build ? i/build : 1);
    }
    if (kind === 1) for (let k = 0; k < 9; k++) { const at = Math.round(sr*(.004 + k*.007 + .003*Math.abs(rnd()))); if (at < n) d[at] += (.9 - k*.08)*(rnd() > 0 ? 1 : -1); }
  }
  return b;
}
export default {key: 'reverb', label: 'Reverb', words: 'a space round the sound',
  params: [{key: 'kind', label: 'Space', list: KINDS, def: 0}, {key: 'size', label: 'Size', min: 0, max: 1, def: .55, unit: '%'},
    {key: 'damp', label: 'Damping', min: 0, max: 1, def: .5, unit: '%'}, {key: 'pre', label: 'Pre-delay', min: 0, max: .12, def: .02, unit: 'ms'},
    {key: 'low', label: 'Low cut', min: 20, max: 800, def: 180, unit: 'Hz', log: true}, {key: 'mix', label: 'Mix', min: 0, max: 1, def: .3, unit: '%'}],
  make(ctx){
    const s = shell(ctx), P = {kind: 0, size: .55, damp: .5}, pre = ctx.createDelay(1), hp = bq(ctx, 'highpass', 180), cv = ctx.createConvolver();
    s.input.connect(hp); hp.connect(pre); pre.connect(cv); cv.connect(s.wet);
    let timer = 0, made = '';
    const remake = now => { const key = [P.kind, P.size.toFixed(2), P.damp.toFixed(2)].join(); if (key === made) return; made = key; cv.buffer = impulse(ctx, Math.round(P.kind), P.size, P.damp); };
    remake();
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'pre') ease(ctx, pre.delayTime, v); else if (k === 'low') ease(ctx, hp.frequency, v);
        else { P[k] = v; clearTimeout(timer); timer = setTimeout(remake, 120); } },   // (a new impulse once the knob rests)
      now(){ clearTimeout(timer); remake(); }};
  }};
