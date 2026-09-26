// Cosmos: space as a 3D place. Star systems grow from seeds on the track's own galaxy (system.js), a camera explores them
// with the music leading (fly.js), and only the nearest few bodies are drawn (look.js in WebGL, draw2d.js in simple mode),
// so a big universe costs no more than a small one. The camera's movement becomes the trails' wind and zoom, the star is
// the light the objects catch, and a centrepiece stands in the space as a monument (P.anchor, read by the mesh objects).
import { hsv2rgb } from '../../../util.js';
import { SHOTS, V, around } from '../../../scene/camera.js';
import { C, G, flyBeat, fly, galaxyTrip, hold, jump, lightFrom, monument, startShot } from './fly.js';
import { TUNE } from '../../../tuning.js';
import { KIND, STAR, makeSystem, nameOf, sysIndex } from './system.js';
import { GLSL } from './look.js';
import { draw2d } from './draw2d.js';

const {add, sub, mul, dot, len} = V;
const N = 6;   // bodies drawn at once (the shader's arrays)

export default {
  key: 'cosmos', kind: 'world', label: 'Cosmos',
  light: null, motion: null,   // set once it's on screen (below): the star's light, the camera's movement
  // spacious, driving, building music: bright, intense, not too busy
  suits: (rf, T) => rf.bright*.3 + T*.35 + rf.perc*.15 - rf.busy*.15,
  // flying it by hand (the lab's keys), and what it's doing, for the caption and the tests
  // (by hand, so it holds the camera for handSecs: the music doesn't take it straight back)
  shot(kind){ if (C.sys && SHOTS[kind] && !C.warpDir) { C.building = false; C.calm = false; startShot(kind, kind === 'orbit' && C.sys.sun.type !== 'star' ? null : undefined); hold(TUNE.cosmos.handSecs); } },
  hold(secs){ hold(secs); },
  jump(to){ jump(to); },
  galaxy(){ if (C.sys) galaxyTrip(sysIndex(C.galaxy, C.sys.arm, C.armNext[C.sys.arm]++)); },
  // jump to the next system (on this track's galaxy) that has one: 'hole', 'pulsar', 'binary', 'belt' or 'halo'
  visit(what){
    if (!C.sys) return;
    const has = s => what === 'belt' ? s.belt : what === 'halo' ? s.halo : s.sun.type === what;
    for (let k = 0; k < 300; k++) for (let a = 2; a >= 0; a--) {
      const i = sysIndex(C.galaxy, a, 150 + k); if (i !== C.sys.idx && has(makeSystem(i))) return jump(i);
    }
  },
  caption: () => C.caption,
  info: () => ({shot: C.kind, system: C.sys && C.sys.idx, arm: C.sys && C.sys.arm, star: C.sys && C.sys.sun.type, belt: !!(C.sys && C.sys.belt),
    halo: !!(C.sys && C.sys.halo), subject: nameOf(C.subj, C.sys), caption: C.caption, warp: C.warp, building: C.building, prog: C.prog,
    calm: C.calm, mon: C.monOn, motion: {...C.motion}, galaxy: G.on, galPhase: G.phase,
    near: C.subj ? len(sub(C.cam.pos, C.subj.p))/C.subj.r : 99, eyeR: Math.hypot(C.cam.pos[0], C.cam.pos[2]), eyeY: C.cam.pos[1], beltR: C.sys && C.sys.belt ? C.sys.belt.R : 0,
    clear: C.sys ? Math.min(...[C.sys.sun, ...C.sys.bodies].map(b => len(sub(C.cam.pos, b.p))/b.r)) : 99}),   // how near a body the camera is (in its radii)
  step(dt, x){ if (C.on) fly(dt, x); },
  onBeat(pos){ flyBeat(pos); },
  params(P, x){
    C.on = P.w.cosmos > .003; C.lastT = x.J.tension;
    if (!C.on || !C.sys) { P.cz = null; this.light = this.motion = null; return; }
    const cam = C.cam, sys = C.sys, sun = sys.sun, k2 = 1/(2*Math.tan(cam.fov*Math.PI/360));
    // the nearest few bodies, by how big they look
    const vis = sys.bodies.map(b => { const rel = sub(b.p, cam.pos); return {b, rel, a: b.r/Math.max(len(rel), 1e-3), z: dot(rel, cam.Z)}; })
      .filter(o => o.z > -o.b.r*3).sort((a, b) => b.a - a.a).slice(0, N);
    const B = new Float32Array(N*4), K = new Float32Array(N*4), A = new Float32Array(N*4), E = new Float32Array(N*4);
    vis.forEach(({b, rel}, i) => {
      B.set([...rel, b.r], i*4); K.set([KIND[b.kind], P.pal[b.slot] + b.off, b.seed*10, b.spin], i*4); A.set([...b.axis, b.ring], i*4);
      E.set([b.city, b.aurora, b.storm, b.cloud], i*4);
    });
    const hue = P.hue + P.pal[sun.slot] + sun.off, sRel = sub(sun.p, cam.pos);
    const sunC = (sun.type === 'hole' ? hsv2rgb(hue + .05, .55, 1) : hsv2rgb(hue, sun.sat, 1)).map(v => v*1.6*(1 + x.sBass*x.react*.3));
    // a pulsar's beams sweep round its axis once a beat; a hole's disk lies across its axis
    let axis = sun.axis;
    if (sun.type === 'pulsar') { const [u, v] = around(sun.axis), a = C.beatPh*Math.PI*2;
      axis = add(mul(sun.axis, Math.cos(sun.tilt)), mul(add(mul(u, Math.cos(a)), mul(v, Math.sin(a))), Math.sin(sun.tilt))); }
    const tw = sun.twin, belt = sys.belt, halo = sys.halo, eye = cam.pos;
    const near = belt && Math.abs(Math.hypot(eye[0], eye[2]) - belt.R) < belt.W + 30 && Math.abs(eye[1]) < belt.H + 30;
    P.cz = {X: cam.X, Y: cam.Y, Z: cam.Z, eye, tan: Math.tan(cam.fov*Math.PI/360), B, K, A, E, sun: [...sRel, sun.r], sunC, axis,
      star: [STAR[sun.type], 0, 0, 0], twin: tw ? [...sub(tw.p, cam.pos), tw.r] : [0, 0, 0, 0],
      twinC: tw ? hsv2rgb(P.hue + P.pal[tw.slot], .35, 1).map(v => v*1.3) : [0, 0, 0],
      belt: belt ? [belt.R, belt.W, belt.H, near ? 1 : 0] : [0, 0, 0, 0], halo: halo ? [halo.R, halo.H, 1, P.pal[halo.slot]] : [0, 0, 0, 0],
      fx: [x.sTreb*x.react, Math.min(1, P.hit)],
      warp: Math.max(C.warp, C.stretch*.3),   // a build starts the stars stretching
      seed: (sys.idx*1.37) % 10, vis, sRel, sunR: sun.r, type: sun.type, sys, k2,
      gal: G.on, galCam: G.cam, galTan: Math.tan(G.cam.fov*Math.PI/360), galA: G.from, galB: G.to};
    lightFrom(P); this.light = C.light; this.motion = C.motion;
    // a centrepiece stands in the space as a vast monument (the mesh objects read P.anchor): where and how big it looks
    monument(P.w.cosmos > .5 && Object.values(P.o).some(w => w > .01));
    if (C.monOn) {
      const rel = sub(sys.mon.p, cam.pos), z = dot(rel, cam.Z);
      P.anchor = z < sys.mon.r*.6 ? {hide: true} : {pos: [dot(rel, cam.X)*k2/z, dot(rel, cam.Y)*k2/z], size: Math.min(1.6, sys.mon.r*k2/z/.81)};
    }
  },
  glsl: {...GLSL, fn: 'cosmos'},
  uniforms(gl, u, P){
    const c = P.cz; if (!c || !u.uCosX) return;
    gl.uniform3fv(u.uCosX, c.X); gl.uniform3fv(u.uCosY, c.Y); gl.uniform3fv(u.uCosZ, c.Z); gl.uniform3fv(u.uCosEye, c.eye);
    gl.uniform1f(u.uCosTan, c.tan); gl.uniform1f(u.uCosWarp, c.warp); gl.uniform1f(u.uCosSeed, c.seed);
    gl.uniform4fv(u.uCosSun, c.sun); gl.uniform3fv(u.uCosSunC, c.sunC); gl.uniform3fv(u.uCosAxis, c.axis); gl.uniform4fv(u.uCosStar, c.star);
    gl.uniform4fv(u.uCosTwin, c.twin); gl.uniform3fv(u.uCosTwinC, c.twinC); gl.uniform4fv(u.uCosBelt, c.belt); gl.uniform4fv(u.uCosHalo, c.halo);
    gl.uniform4fv(u['uCosB[0]'], c.B); gl.uniform4fv(u['uCosK[0]'], c.K); gl.uniform4fv(u['uCosA[0]'], c.A); gl.uniform4fv(u['uCosE[0]'], c.E);
    gl.uniform2fv(u.uCosFx, c.fx);
    gl.uniform1f(u.uGal, c.gal);
    if (c.gal > 0) { const g = c.galCam; gl.uniform3fv(u.uGalX, g.X); gl.uniform3fv(u.uGalY, g.Y); gl.uniform3fv(u.uGalZ, g.Z); gl.uniform3fv(u.uGalEye, g.pos);
      gl.uniform1f(u.uGalTan, c.galTan); gl.uniform3fv(u.uGalA, c.galA); gl.uniform3fv(u.uGalB, c.galB); }
  },
  draw2d,
};
