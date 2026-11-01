// Delay: echoes in time with the music (its length a division of the master's beat), ping-ponging left and right, each repeat darker.
import { DIVS, beatsOf, bq, ease, shell } from './kit.js';

export default {key: 'delay', label: 'Delay', words: 'echoes in time',
  params: [{key: 'div', label: 'Time', list: DIVS.map(d => d[0]), def: 4}, {key: 'fb', label: 'Feedback', min: 0, max: .95, def: .45, unit: '%'},
    {key: 'tone', label: 'Tone', min: 300, max: 14000, def: 3500, unit: 'Hz', log: true}, {key: 'ping', label: 'Ping-pong', min: 0, max: 1, def: 1, unit: '%'},
    {key: 'mix', label: 'Mix', min: 0, max: 1, def: .35, unit: '%'}],
  make(ctx, env){
    const s = shell(ctx), P = {div: 4, fb: .45, ping: 1};
    // the input summed to mono feeds the left line (and the right, as ping-pong lessens); each line feeds itself and the other
    const mono = ctx.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    const inR = ctx.createGain(), dl = [ctx.createDelay(6), ctx.createDelay(6)], lp = [bq(ctx, 'lowpass', 3500, .5), bq(ctx, 'lowpass', 3500, .5)];
    const hp = [bq(ctx, 'highpass', 120), bq(ctx, 'highpass', 120)], self = [ctx.createGain(), ctx.createGain()], cross = [ctx.createGain(), ctx.createGain()];
    const mg = ctx.createChannelMerger(2);
    s.input.connect(mono); mono.connect(dl[0]); mono.connect(inR); inR.connect(dl[1]);
    for (const c of [0, 1]) { dl[c].connect(lp[c]); lp[c].connect(hp[c]); hp[c].connect(self[c]); self[c].connect(dl[c]); hp[c].connect(cross[c]); cross[c].connect(dl[1 - c]); hp[c].connect(mg, 0, c); }
    mg.connect(s.wet);
    const gains = () => { ease(ctx, inR.gain, 1 - P.ping); for (const c of [0, 1]) { ease(ctx, self[c].gain, P.fb*(1 - P.ping)); ease(ctx, cross[c].gain, P.fb*P.ping); } };
    let len = 0;
    const time = (now, glide) => { const T = Math.min(6, env.period()*beatsOf(P.div)); if (Math.abs(T - len) < 1e-4) return; len = T;
      for (const d of dl) glide ? d.delayTime.setTargetAtTime(T, now, .08) : d.delayTime.setValueAtTime(T, now); };
    return {input: s.input, output: s.output,
      set(k, v){ if (k === 'mix') s.mix(v); else if (k === 'tone') lp.forEach(f => ease(ctx, f.frequency, v)); else { P[k] = v; if (k === 'div') time(ctx.currentTime, len > 0); else gains(); } },
      tick(now){ time(now, len > 0); }};
  }};
