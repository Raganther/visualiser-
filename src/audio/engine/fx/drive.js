// Drive: saturation, from warm to torn (a soft curve, a hard clip, a valve's lopsided one, or folding back on itself), then a tone control.
import { bq, ease, shell } from './kit.js';

const KINDS = ['Warm', 'Hard', 'Valve', 'Fold'];
const curve = (kind, amt) => { const n = 2048, c = new Float32Array(n), K = 1 + amt*24;
  const f = [x => Math.tanh(x), x => Math.max(-1, Math.min(1, x)), x => x >= 0 ? Math.tanh(x) : Math.tanh(x*.6)/.6*.8, x => Math.sin(x*Math.PI/2)][kind];
  const norm = Math.abs(f(K)) || 1;
  for (let i = 0; i < n; i++) { const x = i/(n - 1)*2 - 1; c[i] = kind === 3 ? f(x*K*.5 + x) : f(x*K)/norm; }
  return c; };
export default {key: 'drive', label: 'Drive', words: 'saturation, warm to torn',
  params: [{key: 'kind', label: 'Kind', list: KINDS, def: 0}, {key: 'amt', label: 'Drive', min: 0, max: 1, def: .35, unit: '%'},
    {key: 'tone', label: 'Tone', min: 500, max: 18000, def: 7000, unit: 'Hz', log: true}, {key: 'out', label: 'Level', min: 0, max: 1.5, def: .8, unit: 'x'},
    {key: 'mix', label: 'Mix', min: 0, max: 1, def: 1, unit: '%'}],
  make(ctx){
    const s = shell(ctx), P = {kind: 0, amt: .35}, ws = ctx.createWaveShaper(), lp = bq(ctx, 'lowpass', 7000, .5), lvl = ctx.createGain();
    ws.oversample = '4x'; s.input.connect(ws); ws.connect(lp); lp.connect(lvl); lvl.connect(s.wet);
    const remake = () => { ws.curve = curve(Math.round(P.kind), P.amt); }; remake();
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'tone') ease(ctx, lp.frequency, v); else if (k === 'out') ease(ctx, lvl.gain, v); else { P[k] = v; remake(); } }};
  }};
