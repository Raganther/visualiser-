// EQ: a low shelf, a sweepable middle, a high shelf, and a low cut.
import { bq, ease, shell } from './kit.js';

export default {key: 'eq', label: 'EQ', words: 'tone shaping',
  params: [{key: 'cut', label: 'Low cut', min: 20, max: 600, def: 20, unit: 'Hz', log: true}, {key: 'low', label: 'Low', min: -18, max: 12, def: 0, unit: 'dB'},
    {key: 'mid', label: 'Mid', min: -18, max: 12, def: 0, unit: 'dB'}, {key: 'freq', label: 'Mid freq', min: 150, max: 8000, def: 1000, unit: 'Hz', log: true},
    {key: 'high', label: 'High', min: -18, max: 12, def: 0, unit: 'dB'}],
  make(ctx){
    const s = shell(ctx), hp = bq(ctx, 'highpass', 20, .7), lo = bq(ctx, 'lowshelf', 120), mid = bq(ctx, 'peaking', 1000, .9), hi = bq(ctx, 'highshelf', 6000);
    s.input.disconnect(); s.dry.gain.value = 0; s.input.connect(hp); hp.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(s.output);
    return {input: s.input, output: s.output,
      set(k, v){ const n = {cut: hp.frequency, low: lo.gain, mid: mid.gain, freq: mid.frequency, high: hi.gain}[k]; if (n) ease(ctx, n, v); }};
  }};
