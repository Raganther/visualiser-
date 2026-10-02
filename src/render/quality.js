// Resolution that follows the frame rate: drawn smaller when frames run slow, back up when they've been steady a while.
import { TUNE } from '../tuning.js';

// scale: the share of the screen's resolution drawn (the canvas is stretched to fit); fps: the last measured rate.
// world: the share a heavy world is drawn at (the cosmos's ground: render/gl.js lowPass), stepped first, since it's the cost
// and the glow, hits and objects over it stay sharp; heavy: whether one is on screen (set as it's drawn)
// fixed: a resolution chosen by hand (the panel's "Resolution"), held with no stepping; 0 follows the frame rate
export const Q = {scale: 1, fps: 0, world: 1, heavy: false, fixed: 0};
let pend = false;
export function setResolution(v){   // 0: automatic; otherwise the share of the screen to draw, held
  Q.fixed = +v || 0; Q.world = 1; slow = calm = 0; ceil = 1; ceilUntil = 0; changed = prev || 0;
  const s = Q.fixed || 1;   // automatic starts again from full size
  if (s !== Q.scale) { Q.scale = s; pend = true; }
}
let t0 = 0, n = 0, slow = 0, prev = 0, start = 0, calm = 0, changed = 0, raisedAt = -1e9, raisedFrom = 1, ceil = 1, ceilUntil = 0;
// once a drawn frame (performance.now); true when the scale changed and the canvas should be resized
export function qualityTick(now){
  const A = TUNE.render.auto;
  if (pend) { pend = false; return true; }
  if (!start) start = now;
  if (prev && now - prev > A.stallMs) { t0 = 0; calm = 0; }   // a hidden tab or a one-off stall isn't the steady rate
  prev = now;
  if (!t0) { t0 = now; n = 0; return false; }
  n++;
  if (now - t0 < A.windowMs) return false;
  Q.fps = n*1000/(now - t0); t0 = now; n = 0;
  if (!A.on || Q.fixed || now - start < A.graceMs || now - changed < A.settleMs) return false;   // shaders compile at first; a change takes a moment to show
  if (now > ceilUntil) ceil = 1;
  const top = Math.min(1, ceil);
  slow = Q.fps < A.low ? slow + 1 : 0;   // slow for slowN measures running: one hitch (a shader compiling) isn't enough
  if (slow >= A.slowN && Q.heavy && Q.world > A.worldMin) return setWorld(Math.max(A.worldMin, Q.world*A.step), now);   // the heavy world first
  if (slow >= A.slowN && Q.scale > A.min) {
    if (now - raisedAt < A.probeMs) { ceil = raisedFrom; ceilUntil = now + A.ceilMs; }   // the last step up was too much: stay under it a while
    return set(Math.max(A.min, Q.scale*A.step), now);
  }
  const worldUp = Q.scale >= top && Q.heavy && Q.world < 1;   // back up: the whole picture first, then the heavy world
  if (Q.fps >= A.high && (Q.scale < top || worldUp)) {
    if (!calm) calm = now;
    if (now - calm >= A.upMs) {
      if (worldUp) return setWorld(Math.min(1, Q.world/A.step), now);
      raisedAt = now; raisedFrom = Q.scale; return set(Math.min(top, Q.scale/A.step), now);
    }
  } else calm = 0;
  return false;
}
function setWorld(v, now){   // (no resize: the world's own picture follows on the next frame)
  Q.world = v > .99 ? 1 : Math.round(v*100)/100; changed = now; calm = 0; slow = 0;
  return false;
}
function set(v, now){
  v = Math.round(v*100)/100;
  if (v === Q.scale) return false;
  Q.scale = v; changed = now; calm = 0; slow = 0;
  return true;
}
