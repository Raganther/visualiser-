// Resolution that follows the frame rate: drawn smaller when frames run slow, back up when they've been steady a while.
import { TUNE } from '../tuning.js';

// scale: the share of the screen's resolution drawn (the canvas is stretched to fit); fps: the last measured rate.
// world: the share a heavy world is drawn at (the cosmos's ground: render/gl.js lowPass), stepped first, since it's the cost
// and the glow, hits and objects over it stay sharp; heavy: whether one is on screen (set as it's drawn)
export const Q = {scale: 1, fps: 0, world: 1, heavy: false, pending: false};
// the graphics level (the panel's Graphics, or Q), remembered on this device: auto follows the frame rate as below, starting
// from what it settled on last time (so it needn't step down again every visit); the others are fixed and never switch (the
// user found the picture "switching every time", most when the cosmos came in). TUNE.render.gfx holds each fixed level
export const GFX = [['auto', 'Auto'], ['best', 'Best'], ['balanced', 'Balanced'], ['fast', 'Fast'], ['fastest', 'Fastest']];
const store = {get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }};
let level = GFX.some(g => g[0] === store.get('afterglow.gfx')) ? store.get('afterglow.gfx') : 'auto';
const trailBase = TUNE.render.trailScale;
export const gfxLevel = () => level;
export function setGfx(l){ level = l; store.set('afterglow.gfx', l); applyGfx(); Q.pending = true; }   // (the next frame resizes)
function applyGfx(){
  const L = TUNE.render.gfx[level];
  if (L) { Q.scale = L.scale; Q.world = L.world; TUNE.render.trailScale = L.trail; return; }
  TUNE.render.trailScale = trailBase;   // auto: from where it settled last time on this device
  let m = null; try { m = JSON.parse(store.get('afterglow.gfxAuto') || 'null'); } catch {}
  Q.scale = m && m.scale >= TUNE.render.auto.min ? m.scale : 1; Q.world = m && m.world >= TUNE.render.auto.worldMin ? m.world : 1;
}
applyGfx();
const remember = () => { if (level === 'auto') store.set('afterglow.gfxAuto', JSON.stringify({scale: Q.scale, world: Q.world})); };
let t0 = 0, n = 0, slow = 0, prev = 0, start = 0, calm = 0, changed = 0, raisedAt = -1e9, raisedFrom = 1, ceil = 1, ceilUntil = 0;
// once a drawn frame (performance.now); true when the scale changed and the canvas should be resized
export function qualityTick(now){
  if (Q.pending) { Q.pending = false; return true; }
  const A = TUNE.render.auto;
  if (!start) start = now;
  if (prev && now - prev > A.stallMs) { t0 = 0; calm = 0; }   // a hidden tab or a one-off stall isn't the steady rate
  prev = now;
  if (!t0) { t0 = now; n = 0; return false; }
  n++;
  if (now - t0 < A.windowMs) return false;
  Q.fps = n*1000/(now - t0); t0 = now; n = 0;
  if (!A.on || level !== 'auto' || now - start < A.graceMs || now - changed < A.settleMs) return false;   // shaders compile at first; a change takes a moment to show
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
  Q.world = v > .99 ? 1 : Math.round(v*100)/100; changed = now; calm = 0; slow = 0; remember();
  return false;
}
function set(v, now){
  v = Math.round(v*100)/100;
  if (v === Q.scale) return false;
  Q.scale = v; changed = now; calm = 0; slow = 0; remember();
  return true;
}
