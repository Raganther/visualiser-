// Comets and shockwaves, and what stabs do.
import { S, viewAsp } from '../state.js';
import { sBass, sMid, sTreb } from '../audio/analysis.js';
import { J, OPENING } from '../journey/core.js';
import { PACE } from '../journey/pace.js';
import { eff } from '../presets.js';
import { HIT_VISUALS } from '../visuals/registry.js';
import { CTX } from '../scene/context.js';
import { TUNE } from '../tuning.js';
import { TW, speedOf } from '../scene/tweaks.js';
import { DANCE, cometTarget } from '../scene/dance.js';
import { SUBJ, subjTouch } from '../scene/subject.js';
import { SPACE, spaceProj, spaceScale } from '../scene/space.js';

/* comets and shockwaves */
export const comets = [0,1,2].map(i => ({x:(i-1)*.4, y:i%2 ? .15 : -.15, dx:Math.cos(i*2.1), dy:Math.sin(i*2.1), turn:i%2 ? 1 : -1, kick:0, z:0}));
export const shocks = Array.from({length:8}, () => ({x:0, y:0, r:0, s:0}));
// stabs, snares and other hits: a small ripple somewhere, comets flinch, colour nudges
export function onHitFX(){
  if (J.on && J.accTrig === 'hit') J.accEnv = 1;
  for (const h of HIT_VISUALS) if (h.trigger === 'stab' && eff[h.key] > .02) h.fire({J, ty: J.on ? J.type || OPENING : OPENING});
  J.hr += .5;
  const asp = viewAsp();
  if (eff.shock > .2) {
    const sh = shocks[S.shockN++ % 8];
    sh.x = (Math.random() - .5)*asp*.85; sh.y = (Math.random() - .5)*.85; sh.r = .005; sh.s = .7;
  }
  comets.forEach(c => c.kick = Math.max(c.kick, .5));
  S.hueKick += .025;
}
// a comet's place in its figure, tilted into the space round the subject: the figure's plane turned about an axis that
// slowly turns, kept clear of the object's surface; its point in the subject's frame on the comet (c.p3), and on screen
function comet3d(c, tg, t){
  let T = TUNE.space, k = spaceScale(), u = (tg[0] - SPACE.pos[0])/k, v = (tg[1] - SPACE.pos[1])/k, ph = t*T.axis, ca = Math.cos(ph), sa = Math.sin(ph);
  const m0 = Math.hypot(u, v), mx = SPACE.rad*TUNE.space.reach; if (m0 > mx) { u *= mx/m0; v *= mx/m0; }   // (no wider than reach of its radii, nor past the camera)
  const ua = u*ca + v*sa, w = -u*sa + v*ca, th = T.tilt + T.sway*Math.sin(t*.13), wy = w*Math.cos(th);
  const p = [ua*ca - wy*sa, ua*sa + wy*ca, w*Math.sin(th)], l = Math.hypot(p[0], p[1], p[2]), m = SPACE.rad*T.skim;
  if (l < m) { const f = l > 1e-4 ? m/l : 0; if (f) { p[0] *= f; p[1] *= f; p[2] *= f; } else p[2] = m; }   // (skimming its surface, not through it)
  c.p3 = p; const s = spaceProj(p), on = SPACE.on;
  return [tg[0] + (s[0] - tg[0])*on, tg[1] + (s[1] - tg[1])*on];
}
export function stepFX(dt, react, now){
  const tt = now/1000, rdt = dt; dt *= PACE.ts;             // now is motion time; hits still age in real time
  for (const h of HIT_VISUALS) if (h.step) h.step(rdt);
  J.wipe *= Math.pow(.02, rdt); S.wipe *= Math.pow(.05, rdt);
  const asp = viewAsp(), xm = asp/2*.92, ym = .46, tc = TW.comets, bands = tc && tc.band !== null ? [tc.band*2, tc.band*2, tc.band*2] : [sBass*1.3, sMid*2, sTreb*4];
  const cdt = dt*speedOf('comets');   // the comets at their own speed
  comets.forEach((c, i) => {
    const e = bands[i]*react;
    const a = Math.atan2(c.dy, c.dx) + c.turn*(.5 + sMid*react*2)*cdt;
    c.dx = Math.cos(a); c.dy = Math.sin(a);
    const bend = eff.plasma*Math.sin(c.x*3 + tt)*Math.cos(c.y*3 - tt*.7)*2.5*cdt;
    const a2 = Math.atan2(c.dy, c.dx) + bend; c.dx = Math.cos(a2); c.dy = Math.sin(a2);
    const sp = (.12 + e*.5)*(1 + c.kick*2.5)*(.7 + J.tension*.6); c.kick *= Math.pow(.02, rdt);
    c.x += (c.dx*sp + CTX.wind.x*TUNE.ctx.windComets)*cdt; c.y += (c.dy*sp + CTX.wind.y*TUNE.ctx.windComets)*cdt;   // the wind carries them
    if (Math.abs(c.x) > xm) { c.x = Math.sign(c.x)*xm; c.dx *= -1; }
    if (Math.abs(c.y) > ym) { c.y = Math.sign(c.y)*ym; c.dy *= -1; }
    // dancing (scene/dance.js): they fly into the choreographer's shape, tracing it with their trails, and back to roaming
    // round the centrepiece when there is one (scene/subject.js): its middle, and wide enough to circle it
    const so = SUBJ.on, R = TUNE.dance.cometR + Math.max(0, SUBJ.r*TUNE.subject.cometR - TUNE.dance.cometR)*so;
    let tg = DANCE.comets.amt > .001 && cometTarget(i, comets.length, [SUBJ.x*so, SUBJ.y*so], R);
    c.p3 = null;
    if (tg && SPACE.on > .02) tg = comet3d(c, tg, tt);   // in the space: the figure tilted into depth round the object, passing behind it and in front (scene/space.js)
    if (tg) {
      const k = Math.min(1, dt*10*speedOf('comets'))*DANCE.comets.amt, nx = c.x + (tg[0] - c.x)*k, ny = c.y + (tg[1] - c.y)*k;
      const mx = nx - c.x, my = ny - c.y, ml = Math.hypot(mx, my);
      if (ml > 1e-5) { c.dx = mx/ml; c.dy = my/ml; }   // (so they carry on the same way when they're let go)
      c.x = nx; c.y = ny;
    }
    c.z = .5 + Math.min(1.5, e);
    if (c.p3) c.z *= 1 + .3*SPACE.on*Math.max(-1, Math.min(1, c.p3[2]/(SPACE.rad*1.5)));   // (nearer brighter, farther dimmer)
    if (so > .05) { const d = Math.hypot(c.x - SUBJ.x, c.y - SUBJ.y); if (d < SUBJ.r*1.25) subjTouch(c.x, c.y, so*(1 - d/(SUBJ.r*1.25))); }   // (passing close, it lights the facets on that side)
  });
  shocks.forEach(h => {
    if (h.s <= 0) return;
    h.r += dt*(.45 + sBass*react*.8); h.s *= Math.pow(.3, dt);
    if (h.r > 1.6 || h.s < .01) h.s = 0;
  });
}
