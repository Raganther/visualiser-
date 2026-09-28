// Cosmos: space as a 3D place. Star systems grow from seeds on the track's own galaxy (system.js), a camera explores them
// with the music leading (fly.js), and only the nearest few bodies are drawn (look.js in WebGL, draw2d.js in simple mode),
// so a big universe costs no more than a small one. The camera's movement becomes the trails' wind and zoom, the star is
// the light the objects catch, and a centrepiece stands in the space as a monument (P.anchor, read by the mesh objects).
import { hsv2rgb } from '../../../util.js';
import { SHOTS, V, around } from '../../../scene/camera.js';
import { C, G, flyBeat, fly, galaxyTrip, hold, jump, land, lightFrom, monument, startShot, takeoff } from './fly.js';
import { TUNE } from '../../../tuning.js';
import { KIND, STAR, makeSystem, nameOf, sysIndex } from './system.js';
import { GLSL } from './look.js';
import { GLSL as SURF, SF } from './surface.js';
import { draw2d } from './draw2d.js';
const WAYS = {3: 'three ways', 4: 'four ways', 6: 'six ways', 8: 'eight ways'};
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };

const {add, sub, mul, dot, len} = V;
const N = 6;   // bodies drawn at once (the shader's arrays)

export default {
  key: 'cosmos', kind: 'world', label: 'Cosmos',
  light: null, motion: null,   // set once it's on screen (below): the star's light, the camera's movement
  lowRes: () => SF.amt > .001 ? TUNE.cosmos.landScale : TUNE.cosmos.scale,   // how big to draw it (render/gl.js lowPass)
  heavy: () => SF.amt > .001,   // landed, the ground is the costliest thing drawn: a slow device draws it smaller first (render/quality.js)
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
  caption: () => C.caption + (C.fold.amt > .5 ? `, folded ${WAYS[C.fold.n] || C.fold.n + ' ways'}` : ''),
  // the lab's K: the kaleidoscope by hand, off (the music's), whole view, round the subject
  fold(mode){ const f = C.fold; f.hand = mode; if (mode) { f.local = mode === 2; if (!f.n) f.n = 6; } },
  // the lab's W: the subject's layers by hand: the music's, the cage, the cage and motes, the motes
  // landing on a world (the subject, if solid, or the biggest solid one) and taking off again (the lab's L and T)
  land(){ land(C.subj); }, takeoff(){ takeoff(); },
  dress(mode){ C.dress.hand = [null, {cage: 1, motes: 0}, {cage: 1, motes: 1}, {cage: 0, motes: 1}][mode] || null; },
  info: () => ({shot: C.kind, system: C.sys && C.sys.idx, arm: C.sys && C.sys.arm, star: C.sys && C.sys.sun.type, belt: !!(C.sys && C.sys.belt),
    halo: !!(C.sys && C.sys.halo), subject: nameOf(C.subj, C.sys), caption: C.caption, warp: C.warp, building: C.building, prog: C.prog,
    calm: C.calm, mon: C.monOn, fold: C.fold.amt, surf: SF.amt, sfPhase: SF.phase, sfAlt: SF.alt, sfMode: SF.mode, cage: C.dress.cage, motes: C.dress.motes, burst: C.dress.burst, motion: {...C.motion}, galaxy: G.on, galPhase: G.phase,
    near: C.subj ? len(sub(C.cam.pos, C.subj.p))/C.subj.r : 99, eyeR: Math.hypot(C.cam.pos[0], C.cam.pos[2]), eyeY: C.cam.pos[1], beltR: C.sys && C.sys.belt ? C.sys.belt.R : 0,
    clear: C.sys ? Math.min(...[C.sys.sun, ...C.sys.bodies].map(b => len(sub(C.cam.pos, b.p))/b.r)) : 99}),   // how near a body the camera is (in its radii)
  step(dt, x){ if (C.on) fly(dt, x); },
  onBeat(pos){ flyBeat(pos); },
  params(P, x){
    C.on = P.w.cosmos > .003; C.lastT = x.J.tension;
    if (!C.on || !C.sys) { P.cz = null; this.light = this.motion = this.focus = null; return; }
    const cam = C.cam, sys = C.sys, sun = sys.sun, k2 = 1/(2*Math.tan(cam.fov*Math.PI/360));
    // the nearest few bodies, by how big they look
    const vis = sys.bodies.map(b => { const rel = sub(b.p, cam.pos); return {b, rel, a: b.r/Math.max(len(rel), 1e-3), z: dot(rel, cam.Z)}; })
      .filter(o => o.z > -o.b.r*3).sort((a, b) => b.a - a.a).slice(0, N);
    const B = new Float32Array(N*4), K = new Float32Array(N*4), A = new Float32Array(N*4), E = new Float32Array(N*4), T = new Float32Array(N*4);
    vis.forEach(({b, rel}, i) => {
      B.set([...rel, b.r], i*4); K.set([KIND[b.kind], P.pal[b.slot] + b.off, b.seed*10, b.spin], i*4); A.set([...b.axis, b.ring], i*4);
      E.set([b.city, b.aurora, b.storm, b.cloud], i*4);
      if (!b.moon && TUNE.cosmos.atmo[b.kind]) T.set(TUNE.cosmos.atmo[b.kind], i*4);   // moons have no air
    });
    const hue = P.hue + P.pal[sun.slot] + sun.off, sRel = sub(sun.p, cam.pos);
    const sunC = (sun.type === 'hole' ? hsv2rgb(hue + .05, .55, 1) : hsv2rgb(hue, sun.sat, 1)).map(v => v*1.6*(1 + x.sBass*x.react*.3));
    // a pulsar's beams sweep round its axis once a beat; a hole's disk lies across its axis
    let axis = sun.axis;
    if (sun.type === 'pulsar') { const [u, v] = around(sun.axis), a = C.beatPh*Math.PI*2;
      axis = add(mul(sun.axis, Math.cos(sun.tilt)), mul(add(mul(u, Math.cos(a)), mul(v, Math.sin(a))), Math.sin(sun.tilt))); }
    const tw = sun.twin, belt = sys.belt, halo = sys.halo, eye = cam.pos;
    const near = belt && Math.abs(Math.hypot(eye[0], eye[2]) - belt.R) < belt.W + 30 && Math.abs(eye[1]) < belt.H + 30;
    P.cz = {X: cam.X, Y: cam.Y, Z: cam.Z, eye, tan: Math.tan(cam.fov*Math.PI/360), B, K, A, E, T, sun: [...sRel, sun.r], sunC, axis,
      star: [STAR[sun.type], 0, 0, 0], twin: tw ? [...sub(tw.p, cam.pos), tw.r] : [0, 0, 0, 0],
      twinC: tw ? hsv2rgb(P.hue + P.pal[tw.slot], .35, 1).map(v => v*1.3) : [0, 0, 0],
      belt: belt ? [belt.R, belt.W, belt.H, near ? 1 : 0] : [0, 0, 0, 0], halo: halo ? [halo.R, halo.H, 1, P.pal[halo.slot]] : [0, 0, 0, 0],
      fx: [x.sTreb*x.react, Math.min(1, P.hit)],
      warp: Math.max(C.warp, C.stretch*.3),   // a build starts the stars stretching
      seed: (sys.idx*1.37) % 10, vis, sRel, sunR: sun.r, type: sun.type, sys, k2,
      gal: G.on, galCam: G.cam, galTan: Math.tan(G.cam.fov*Math.PI/360), galA: G.from, galB: G.to};
    lightFrom(P); this.light = C.light; this.motion = C.motion;
    // its subject on screen (the planet or star it's filming), for the trails to centre on; none while it's behind or off screen
    const sj = C.subj || sun, srel = sub(sj.p, cam.pos), sz = dot(srel, cam.Z), asp = x.asp || 16/9;
    const fx = sz > sj.r ? dot(srel, cam.X)*k2/sz : 0, fy = sz > sj.r ? dot(srel, cam.Y)*k2/sz : 0;
    this.focus = sz > sj.r && Math.abs(fx) < asp*.45 && Math.abs(fy) < .45 && !G.on ? {x: fx, y: fy, r: sj.r*k2/sz} : null;
    // the kaleidoscope: centred on the subject (or the middle), the star in the middle of the mirrored wedge, so it repeats
    // round the subject as a crown (or, filming the star, the wedge on its axis), turning slowly
    const f = C.fold, fc = this.focus || {x: 0, y: 0, r: .1}, sz2 = dot(sRel, cam.Z), h = Math.PI/f.n;
    const toStar = sj !== sun && sz2 > sun.r ? Math.atan2(dot(sRel, cam.Y)*k2/sz2 - fc.y, dot(sRel, cam.X)*k2/sz2 - fc.x)
      : Math.atan2(dot(sun.axis || [0, 1, 0], cam.Y), dot(sun.axis || [0, 1, 0], cam.X));
    P.cz.fold = [fc.x, fc.y, f.n, f.amt];
    // the subject's layers (a body among the drawn ones, not the star)
    // on the ground: its camera, the sun, the world's kind and weather; the trails centre on the sun while it's in view
    if (SF.amt > 0) {
      const b = SF.body || {}, d = SF.sunDir, sz3 = dot(d, SF.Z), hue = P.pal[b.slot || 0] + (b.off || 0);
      P.cz.sf = {amt: SF.amt, haze: SF.haze, eye: SF.pos, X: SF.X, Y: SF.Y, Z: SF.Z, tan: Math.tan(SF.fov*Math.PI/360), sun: d,
        K: [SF.kind, SF.seed, hue, SF.kind === 4 ? 3 : -100], E: [b.city || 0, b.aurora || 0, .3 + (b.cloud || 0)*.5, 1 - sstep(-.12, .08, SF.sun)]};
      if (SF.amt > .5) this.focus = sz3 > .3 ? {x: dot(d, SF.X)*k2/sz3, y: dot(d, SF.Y)*k2/sz3, r: .04} : null;
    }
    const dr = C.dress, di = vis.findIndex(o => o.b === C.subj);
    P.cz.cage = [di >= 0 && (dr.cage > .01 || dr.motes > .01) ? di : -1, dr.cage, dr.motes, dr.burst];
    P.cz.cage2 = [dr.spin, ((dr.bar + Math.min(1, C.beatPh))/4) % 1];
    P.cz.fold2 = [toStar - h/2 + x.t*TUNE.cosmos.fold.turn, f.local ? Math.max(.08, fc.r*TUNE.cosmos.fold.localR) : 0];
    // a centrepiece stands in the space as a vast monument (the mesh objects read P.anchor): where and how big it looks
    monument(P.w.cosmos > .5 && Object.values(P.o).some(w => w > .01));
    if (C.monOn) {
      const rel = sub(sys.mon.p, cam.pos), z = dot(rel, cam.Z);
      P.anchor = z < sys.mon.r*.6 ? {hide: true} : {pos: [dot(rel, cam.X)*k2/z, dot(rel, cam.Y)*k2/z], size: Math.min(1.6, sys.mon.r*k2/z/.81)};
    }
  },
  glsl: {uniforms: GLSL.uniforms + '\n' + SURF.uniforms, functions: GLSL.functions + '\n' + SURF.functions, fn: 'cosmos'},
  // its front plane, for scenes: the planets' discs (not the star), so the glow can pass behind them or be held inside them
  front: {
    fn: 'czFront',
    glsl: `
float czFront(vec2 sp){
  if(uGal>0.5||uSurf>0.5) return 0.0;
  sp=czFoldSp(sp);
  vec3 d=normalize(uCosZ+(uCosX*sp.x+uCosY*sp.y)*2.0*uCosTan); float fc=0.0;
  for(int i=0;i<6;i++){ vec4 B=uCosB[i]; float b=dot(B.xyz,d); if(B.w<=0.0||b<=0.0) continue;
    fc=max(fc,smoothstep(B.w*1.01,B.w*0.97,length(B.xyz-d*b))); }
  return fc; }`,
    path2d(o, P){
      const c = P.cz; if (!c || c.gal > .5) return;
      const W = o.canvas.width, H = o.canvas.height;
      for (const {rel, b} of c.vis) { const z = dot(rel, c.Z); if (z <= b.r) continue;
        const k = c.k2/z*H; o.moveTo(W/2 + dot(rel, c.X)*k + b.r*k, H/2 - dot(rel, c.Y)*k); o.arc(W/2 + dot(rel, c.X)*k, H/2 - dot(rel, c.Y)*k, b.r*k, 0, 7); }
    },
  },
  uniforms(gl, u, P){
    const c = P.cz; if (!c || !u.uCosX) return;
    gl.uniform3fv(u.uCosX, c.X); gl.uniform3fv(u.uCosY, c.Y); gl.uniform3fv(u.uCosZ, c.Z); gl.uniform3fv(u.uCosEye, c.eye);
    gl.uniform1f(u.uCosTan, c.tan); gl.uniform1f(u.uCosWarp, c.warp); gl.uniform1f(u.uCosSeed, c.seed);
    gl.uniform4fv(u.uCosSun, c.sun); gl.uniform3fv(u.uCosSunC, c.sunC); gl.uniform3fv(u.uCosAxis, c.axis); gl.uniform4fv(u.uCosStar, c.star);
    gl.uniform4fv(u.uCosTwin, c.twin); gl.uniform3fv(u.uCosTwinC, c.twinC); gl.uniform4fv(u.uCosBelt, c.belt); gl.uniform4fv(u.uCosHalo, c.halo);
    gl.uniform4fv(u['uCosB[0]'], c.B); gl.uniform4fv(u['uCosK[0]'], c.K); gl.uniform4fv(u['uCosA[0]'], c.A); gl.uniform4fv(u['uCosE[0]'], c.E); gl.uniform4fv(u['uCosT[0]'], c.T);
    gl.uniform4fv(u.uCzFold, c.fold); gl.uniform2fv(u.uCzFold2, c.fold2);
    gl.uniform4fv(u.uCzCage, c.cage); gl.uniform2fv(u.uCzCage2, c.cage2);
    const sf = c.sf; gl.uniform1f(u.uSurf, sf ? sf.amt : 0);
    if (sf) { gl.uniform1f(u.uSfHaze, sf.haze); gl.uniform3fv(u.uSfEye, sf.eye); gl.uniform3fv(u.uSfX, sf.X); gl.uniform3fv(u.uSfY, sf.Y); gl.uniform3fv(u.uSfZ, sf.Z);
      gl.uniform1f(u.uSfTan, sf.tan); gl.uniform3fv(u.uSfSun, sf.sun); gl.uniform4fv(u.uSfK, sf.K); gl.uniform4fv(u.uSfE, sf.E); }
    gl.uniform2fv(u.uCosFx, c.fx);
    gl.uniform1f(u.uGal, c.gal);
    if (c.gal > 0) { const g = c.galCam; gl.uniform3fv(u.uGalX, g.X); gl.uniform3fv(u.uGalY, g.Y); gl.uniform3fv(u.uGalZ, g.Z); gl.uniform3fv(u.uGalEye, g.pos);
      gl.uniform1f(u.uGalTan, c.galTan); gl.uniform3fv(u.uGalA, c.galA); gl.uniform3fv(u.uGalB, c.galB); }
  },
  draw2d,
};
