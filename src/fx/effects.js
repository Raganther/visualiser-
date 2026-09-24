// Comets and shockwaves, and what stabs do.
import { S } from '../state.js';
import { sBass, sMid, sTreb } from '../audio/analysis.js';
import { J, OPENING } from '../journey/core.js';
import { PACE } from '../journey/pace.js';
import { eff } from '../presets.js';
import { HIT_VISUALS } from '../visuals/registry.js';

/* comets and shockwaves */
export const comets = [0,1,2].map(i => ({x:(i-1)*.4, y:i%2 ? .15 : -.15, dx:Math.cos(i*2.1), dy:Math.sin(i*2.1), turn:i%2 ? 1 : -1, kick:0, z:0}));
export const shocks = Array.from({length:8}, () => ({x:0, y:0, r:0, s:0}));
// stabs, snares and other hits: a small ripple somewhere, comets flinch, colour nudges
export function onHitFX(){
  if (J.on && J.accTrig === 'hit') J.accEnv = 1;
  for (const h of HIT_VISUALS) if (h.trigger === 'stab' && eff[h.key] > .02) h.fire({J, ty: J.on ? J.type || OPENING : OPENING});
  J.hr += .5;
  const asp = innerWidth/innerHeight;
  if (eff.shock > .2) {
    const sh = shocks[S.shockN++ % 8];
    sh.x = (Math.random() - .5)*asp*.85; sh.y = (Math.random() - .5)*.85; sh.r = .005; sh.s = .7;
  }
  comets.forEach(c => c.kick = Math.max(c.kick, .5));
  S.hueKick += .025;
}
export function stepFX(dt, react, now){
  const tt = now/1000, rdt = dt; dt *= PACE.ts;             // now is motion time; hits still age in real time
  for (const h of HIT_VISUALS) if (h.step) h.step(rdt);
  J.wipe *= Math.pow(.02, rdt);
  const asp = innerWidth/innerHeight, xm = asp/2*.92, ym = .46, bands = [sBass*1.3, sMid*2, sTreb*4];
  comets.forEach((c, i) => {
    const e = bands[i]*react;
    const a = Math.atan2(c.dy, c.dx) + c.turn*(.5 + sMid*react*2)*dt;
    c.dx = Math.cos(a); c.dy = Math.sin(a);
    const bend = eff.plasma*Math.sin(c.x*3 + tt)*Math.cos(c.y*3 - tt*.7)*2.5*dt;
    const a2 = Math.atan2(c.dy, c.dx) + bend; c.dx = Math.cos(a2); c.dy = Math.sin(a2);
    const sp = (.12 + e*.5)*(1 + c.kick*2.5)*(.7 + J.tension*.6); c.kick *= Math.pow(.02, rdt);
    c.x += c.dx*sp*dt; c.y += c.dy*sp*dt;
    if (Math.abs(c.x) > xm) { c.x = Math.sign(c.x)*xm; c.dx *= -1; }
    if (Math.abs(c.y) > ym) { c.y = Math.sign(c.y)*ym; c.dy *= -1; }
    c.z = .5 + Math.min(1.5, e);
  });
  shocks.forEach(h => {
    if (h.s <= 0) return;
    h.r += dt*(.45 + sBass*react*.8); h.s *= Math.pow(.3, dt);
    if (h.r > 1.6 || h.s < .01) h.s = 0;
  });
}
