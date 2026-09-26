// Flow-field particles.
import { S } from '../state.js';
import { sMid } from '../audio/analysis.js';
import { shocks } from './effects.js';
import { J } from '../journey/core.js';
import { CTX } from '../scene/context.js';
import { TUNE } from '../tuning.js';

/* ---------- flow field particles ---------- */
export const NP = 600, parts = new Float32Array(NP*3);
function seedPart(i, asp){ parts[i*3] = (Math.random() - .5)*asp; parts[i*3+1] = Math.random() - .5; parts[i*3+2] = .3 + Math.random()*.7; }
export function seedParticles(){ for (let i = 0; i < NP; i++) seedPart(i, 16/9); }
export function stepParts(dt, react, now){
  const asp = innerWidth/innerHeight, t = now/1000, hx = asp/2;
  const speed = .06 + sMid*react*.35 + S.beat*.5 + J.tension*.1, drift = J.clock*.05;
  for (let i = 0; i < NP; i++) {
    let x = parts[i*3], y = parts[i*3+1];
    const a = Math.sin(x*2.3 + t*.21 + drift)*1.8 + Math.cos(y*2.9 - t*.17)*1.8 + Math.sin((x + y)*1.3 + t*.1)*.9;
    let vx = Math.cos(a)*speed + CTX.wind.x*TUNE.ctx.windFlow, vy = Math.sin(a)*speed + CTX.wind.y*TUNE.ctx.windFlow;   // blown by the wind
    for (const h of shocks) {            // shockwaves shove the particles as they pass
      if (h.s < .05) continue;
      const dx = x - h.x, dy = y - h.y, l = Math.hypot(dx, dy) + 1e-4, q = (l - h.r)/.06, push = h.s*Math.exp(-q*q)*.8;
      vx += dx/l*push; vy += dy/l*push;
    }
    x += vx*dt; y += vy*dt;
    if (x < -hx) x += asp; else if (x > hx) x -= asp;
    if (y < -.5) y += 1; else if (y > .5) y -= 1;
    parts[i*3] = x; parts[i*3+1] = y;
    if (Math.random() < dt*.05) seedPart(i, asp);
  }
}
