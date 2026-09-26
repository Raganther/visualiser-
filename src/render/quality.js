// Resolution that follows the frame rate: drawn smaller when frames run slow, back up when they've been steady a while.
import { TUNE } from '../tuning.js';

// scale: the share of the screen's resolution drawn (the canvas is stretched to fit); fps: the last measured rate
export const Q = {scale: 1, fps: 0};
let t0 = 0, n = 0, slow = 0, prev = 0, start = 0, calm = 0, changed = 0, raisedAt = -1e9, raisedFrom = 1, ceil = 1, ceilUntil = 0;
// once a drawn frame (performance.now); true when the scale changed and the canvas should be resized
export function qualityTick(now){
  const A = TUNE.render.auto;
  if (!start) start = now;
  if (prev && now - prev > A.stallMs) { t0 = 0; calm = 0; }   // a hidden tab or a one-off stall isn't the steady rate
  prev = now;
  if (!t0) { t0 = now; n = 0; return false; }
  n++;
  if (now - t0 < A.windowMs) return false;
  Q.fps = n*1000/(now - t0); t0 = now; n = 0;
  if (!A.on || now - start < A.graceMs || now - changed < A.settleMs) return false;   // shaders compile at first; a change takes a moment to show
  if (now > ceilUntil) ceil = 1;
  const top = Math.min(1, ceil);
  slow = Q.fps < A.low ? slow + 1 : 0;   // slow for slowN measures running: one hitch (a shader compiling) isn't enough
  if (slow >= A.slowN && Q.scale > A.min) {
    if (now - raisedAt < A.probeMs) { ceil = raisedFrom; ceilUntil = now + A.ceilMs; }   // the last step up was too much: stay under it a while
    return set(Math.max(A.min, Q.scale*A.step), now);
  }
  if (Q.fps >= A.high && Q.scale < top) {
    if (!calm) calm = now;
    if (now - calm >= A.upMs) { raisedAt = now; raisedFrom = Q.scale; return set(Math.min(top, Q.scale/A.step), now); }
  } else calm = 0;
  return false;
}
function set(v, now){
  v = Math.round(v*100)/100;
  if (v === Q.scale) return false;
  Q.scale = v; changed = now; calm = 0; slow = 0;
  return true;
}
