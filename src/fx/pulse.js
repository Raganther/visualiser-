// The visual pulse: fired on the pace's division of the beat.
import { S } from '../state.js';
import { sBass } from '../audio/analysis.js';
import { comets, shocks } from './effects.js';
import { PACE } from '../journey/pace.js';
import { eff, jumpVal } from '../presets.js';
import { reduceMotion } from '../util.js';

// the visual pulse: on the section's division of the beat, as hard as its pace allows
export function firePulse(){
  const asp = innerWidth/innerHeight, k = PACE.punch;
  S.beat = Math.max(S.beat, (reduceMotion ? .5 : 1)*k); S.hueKick += .07*k;
  comets.forEach(c => {
    const a = Math.atan2(c.dy, c.dx) + (Math.random() < .5 ? -1 : 1)*(.6 + Math.random()*1.5)*(.4 + .6*k);
    c.dx = Math.cos(a); c.dy = Math.sin(a); if (Math.random() < .4) c.turn *= -1; c.kick = k;
  });
  if (eff.shock > .25) {
    const from = eff.comets > .05 ? comets[S.shockN % 3] : {x:(Math.random() - .5)*asp*.8, y:(Math.random() - .5)*.8};
    const sh = shocks[S.shockN++ % 8]; sh.x = from.x; sh.y = from.y; sh.r = .01; sh.s = Math.min(1, .5 + sBass);
  }
  for (const m in S.active.mods) if (S.active.mods[m].src === 'jump') jumpVal[m] = Math.random()*2 - 1;
}
