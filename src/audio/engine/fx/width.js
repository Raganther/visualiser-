// Width: the stereo image narrowed to mono or spread wider than it was (the sides against the middle), the low end kept centred.
import { bq, ease, two } from './kit.js';

export default {key: 'width', label: 'Width', words: 'a wider image',
  params: [{key: 'w', label: 'Width', min: 0, max: 2, def: 1.4, unit: '%'}, {key: 'mono', label: 'Bass mono', min: 20, max: 300, def: 120, unit: 'Hz', log: true}],
  make(ctx){
    // L' = M + wS, R' = M - wS (M the middle, S the sides), the sides high-passed so the bass stays in the middle
    const input = two(ctx), output = ctx.createGain(), sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2);
    const m = ctx.createGain(), sd = ctx.createGain(), hp = bq(ctx, 'highpass', 120, .7), w = ctx.createGain(), wn = ctx.createGain();
    const l2 = ctx.createGain(), r2 = ctx.createGain(), nr = ctx.createGain(); m.gain.value = .5; sd.gain.value = .5; nr.gain.value = -1;
    input.connect(sp); sp.connect(m, 0); sp.connect(m, 1); sp.connect(sd, 0); sp.connect(nr, 1); nr.connect(sd);
    sd.connect(hp); hp.connect(w); w.connect(l2); w.connect(wn); wn.gain.value = -1; wn.connect(r2);
    // the sides below the bass cut, at their own width (1: untouched)
    const lowS = bq(ctx, 'lowpass', 120, .7); sd.connect(lowS); lowS.connect(l2); const lowN = ctx.createGain(); lowN.gain.value = -1; lowS.connect(lowN); lowN.connect(r2);
    m.connect(l2); m.connect(r2); l2.connect(mg, 0, 0); r2.connect(mg, 0, 1); mg.connect(output);
    return {input, output,
      set(k, v){ if (k === 'w') ease(ctx, w.gain, v); else if (k === 'mono') { ease(ctx, hp.frequency, v); ease(ctx, lowS.frequency, v); } }};
  }};
