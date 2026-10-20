// Sidechain pump: the sound ducks on each kick (from the note bus) or on every beat of the master (so a deck can pump too), and swells back.
import { ease, shell } from './kit.js';

export default {key: 'pump', label: 'Sidechain', words: 'pumping on the kick',
  params: [{key: 'src', label: 'Duck on', list: ['Kick', 'Beat'], def: 1}, {key: 'depth', label: 'Depth', min: 0, max: 1, def: .6, unit: '%'},
    {key: 'rel', label: 'Release', min: .1, max: 1, def: .45, unit: '%'}],
  make(ctx, env){
    const s = shell(ctx), g = ctx.createGain(), P = {src: 1, depth: .6, rel: .45};
    s.input.disconnect(); s.dry.gain.value = 0; s.input.connect(g); g.connect(s.output);
    let last = -1;
    // down to 1 - depth in a couple of milliseconds, then back up over the release (a share of the beat)
    const duck = t => { if (t < last + .03) return; last = t; const p = g.gain;
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
      p.setTargetAtTime(1 - P.depth, t, .003); p.setTargetAtTime(1, t + .012, Math.max(.01, env.period()*P.rel/3)); };
    const off = env.onNote(e => { if (Math.round(P.src) === 0 && e.ch === 'kick') duck(e.t); });
    return {input: s.input, output: s.output, duck,
      set(k, v){ P[k] = v; if (k === 'depth' && v === 0) ease(ctx, g.gain, 1); },
      // every beat: the master's beats over the next moment, each ducked once
      tick(now){ if (Math.round(P.src) !== 1 || P.depth <= 0) return; const c = env.clock(), k = c.beat(now), T = c.period(now);
        for (let j = Math.ceil(k); ; j++) { const t = now + (j - k)*T; if (t > now + .2) break; if (t > last + T*.5) duck(t); } },
      dispose: off};
  }};
