// Flow-field particles.
import { S, viewAsp } from '../state.js';
import { sMid } from '../audio/analysis.js';
import { shocks } from './effects.js';
import { J } from '../journey/core.js';
import { CTX } from '../scene/context.js';
import { TUNE } from '../tuning.js';
import { DANCE } from '../scene/dance.js';

/* ---------- flow field particles ---------- */
export const NP = 600, parts = new Float32Array(NP*3);
function seedPart(i, asp){ parts[i*3] = (Math.random() - .5)*asp; parts[i*3+1] = Math.random() - .5; parts[i*3+2] = .3 + Math.random()*.7; }
export function seedParticles(){ for (let i = 0; i < NP; i++) seedPart(i, 16/9); }
export function stepParts(dt, react, now){
  const asp = viewAsp(), t = now/1000, hx = asp/2;
  const speed = .06 + sMid*react*.35 + S.beat*.5 + J.tension*.1, drift = J.clock*.05;
  // the dance's way of moving (scene/dance.js): the field, or converging from both sides, swirling, blooming out of the middle.
  // Those go in mirrored pairs (each odd particle the reflection of the one before), so the picture is symmetric
  const F = DANCE.flow, m = F.mode === 'field' ? 0 : F.amt, sp = speed*1.3, pair = m > .01;
  for (let i = 0; i < NP; i++) {
    let x = parts[i*3], y = parts[i*3+1];
    if (pair && i & 1) {   // the reflection of its partner, eased there as the mode comes in
      const k = m > .95 ? 1 : Math.min(1, dt*3*m);
      parts[i*3] = x + (-parts[i*3 - 3] - x)*k; parts[i*3+1] = y + (parts[i*3 - 2] - y)*k; continue;
    }
    const a = Math.sin(x*2.3 + t*.21 + drift)*1.8 + Math.cos(y*2.9 - t*.17)*1.8 + Math.sin((x + y)*1.3 + t*.1)*.9;
    let vx = Math.cos(a)*speed + CTX.wind.x*TUNE.ctx.windFlow*(1 - m), vy = Math.sin(a)*speed + CTX.wind.y*TUNE.ctx.windFlow*(1 - m);   // blown by the wind
    if (m > 0) {
      const r = Math.hypot(x, y) + 1e-4, wv = Math.sin(r*9 - t*1.3)*.25;
      let mx = 0, my = 0;
      if (F.mode === 'converge') { mx = -Math.sign(x)*sp; my = -y*sp*1.6 + wv*sp*.3; }             // from both sides to the middle
      else if (F.mode === 'vortex') { mx = (-y/r*1.1 - x/r*.25)*sp; my = (x/r*1.1 - y/r*.25)*sp; }   // round the middle, slowly in
      else { mx = (x/r + -y/r*.4)*sp; my = (y/r + x/r*.4)*sp; }                                     // blooming out, turning
      vx += (mx - vx)*m; vy += (my - vy)*m;
    }
    for (const h of shocks) {            // shockwaves shove the particles as they pass
      if (h.s < .05) continue;
      const dx = x - h.x, dy = y - h.y, l = Math.hypot(dx, dy) + 1e-4, q = (l - h.r)/.06, push = h.s*Math.exp(-q*q)*.8;
      vx += dx/l*push; vy += dy/l*push;
    }
    x += vx*dt; y += vy*dt;
    if (m > .5) {   // arriving at the middle (or leaving the picture), a particle starts again where the mode begins
      const r = Math.hypot(x, y);
      if (F.mode === 'converge' && Math.abs(x) < .015) { x = (Math.random() < .5 ? -1 : 1)*hx*(.8 + Math.random()*.2); y = (Math.random() - .5)*.9; }
      else if (F.mode === 'vortex' && r < .03) { const q = Math.random()*Math.PI*2, R = .35 + Math.random()*.3; x = Math.cos(q)*R*asp*.6; y = Math.sin(q)*R; }
      else if (F.mode === 'bloom' && (Math.abs(x) > hx || Math.abs(y) > .5)) { const q = Math.random()*Math.PI*2; x = Math.cos(q)*.02; y = Math.sin(q)*.02; }
    }
    if (x < -hx) x += asp; else if (x > hx) x -= asp;
    if (y < -.5) y += 1; else if (y > .5) y -= 1;
    parts[i*3] = x; parts[i*3+1] = y;
    if (Math.random() < dt*.05) seedPart(i, asp);
  }
}
