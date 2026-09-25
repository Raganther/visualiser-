// Cosmos: space as a 3D place. Star systems grow from seeds on the track's own galaxy (system.js), a camera explores them
// with the music leading (fly.js), and only the nearest few bodies are drawn (look.js in WebGL, draw2d.js in simple mode),
// so a big universe costs no more than a small one. The camera's movement becomes the trails' wind and zoom, and the star
// is the light the objects catch.
import { hsv2rgb } from '../../../util.js';
import { SHOTS, V } from '../../../scene/camera.js';
import { C, flyBeat, fly, jump, lightFrom, startShot } from './fly.js';
import { KIND, nameOf } from './system.js';
import { GLSL } from './look.js';
import { draw2d } from './draw2d.js';

const {sub, dot, len} = V;
const N = 6;   // bodies drawn at once (the shader's arrays)

export default {
  key: 'cosmos', kind: 'world', label: 'Cosmos',
  light: null, motion: null,   // set once it's on screen (below): the star's light, the camera's movement
  // spacious, driving, building music: bright, intense, not too busy
  suits: (rf, T) => rf.bright*.3 + T*.35 + rf.perc*.15 - rf.busy*.15,
  // flying it by hand (the lab's keys), and what it's doing, for the caption and the tests
  shot(kind){ if (C.sys && SHOTS[kind] && !C.warpDir) startShot(kind); },
  jump(){ jump(); },
  caption: () => C.caption,
  info: () => ({shot: C.kind, system: C.sys && C.sys.idx, arm: C.sys && C.sys.arm, subject: nameOf(C.subj), caption: C.caption, warp: C.warp,
    building: C.building, prog: C.prog, calm: C.calm, motion: {...C.motion},
    clear: C.sys ? Math.min(...[C.sys.sun, ...C.sys.bodies].map(b => len(sub(C.cam.pos, b.p))/b.r)) : 99}),   // how near a body the camera is (in its radii)
  step(dt, x){ if (C.on) fly(dt, x); },
  onBeat(pos){ flyBeat(pos); },
  params(P, x){
    C.on = P.w.cosmos > .003; C.lastT = x.J.tension;
    if (!C.on || !C.sys) { P.cz = null; this.light = this.motion = null; return; }
    const cam = C.cam, sun = C.sys.sun;
    // the nearest few bodies, by how big they look
    const vis = C.sys.bodies.map(b => { const rel = sub(b.p, cam.pos); return {b, rel, a: b.r/Math.max(len(rel), 1e-3), z: dot(rel, cam.Z)}; })
      .filter(o => o.z > -o.b.r*3).sort((a, b) => b.a - a.a).slice(0, N);
    const B = new Float32Array(N*4), K = new Float32Array(N*4), A = new Float32Array(N*4);
    vis.forEach(({b, rel}, i) => {
      B.set([...rel, b.r], i*4); K.set([KIND[b.kind], P.pal[b.slot] + b.off, b.seed*10, b.spin], i*4); A.set([...b.axis, b.ring], i*4);
    });
    const sRel = sub(sun.p, cam.pos), sunC = hsv2rgb(P.hue + P.pal[sun.slot] + sun.off, sun.sat, 1).map(v => v*1.6*(1 + x.sBass*x.react*.3));
    P.cz = {X: cam.X, Y: cam.Y, Z: cam.Z, tan: Math.tan(cam.fov*Math.PI/360), B, K, A, sun: [...sRel, sun.r], sunC,
      warp: Math.max(C.warp, C.stretch*.3),   // a build starts the stars stretching
      seed: (C.sys.idx*1.37) % 10, vis, sRel, sunR: sun.r};
    lightFrom(P); this.light = C.light; this.motion = C.motion;
  },
  glsl: {...GLSL, fn: 'cosmos'},
  uniforms(gl, u, P){
    const c = P.cz; if (!c || !u.uCosX) return;
    gl.uniform3fv(u.uCosX, c.X); gl.uniform3fv(u.uCosY, c.Y); gl.uniform3fv(u.uCosZ, c.Z);
    gl.uniform1f(u.uCosTan, c.tan); gl.uniform1f(u.uCosWarp, c.warp); gl.uniform1f(u.uCosSeed, c.seed);
    gl.uniform4fv(u.uCosSun, c.sun); gl.uniform3fv(u.uCosSunC, c.sunC);
    gl.uniform4fv(u['uCosB[0]'], c.B); gl.uniform4fv(u['uCosK[0]'], c.K); gl.uniform4fv(u['uCosA[0]'], c.A);
  },
  draw2d,
};
