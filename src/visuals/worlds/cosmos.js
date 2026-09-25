// Cosmos: space as a 3D place. Star systems grow from a seed, a camera explores them in shots (scene/camera.js), and only
// the nearest few bodies are drawn, so a big universe costs no more than a small one. The music picks the shots: a new one
// every few bars, a new destination each section (a returning section goes back to its own), a hyperspace jump on a drop.
// Opt-in: ?lab=cosmos puts it on screen in Journey (and adds keys to fly it by hand).
import { S } from '../../state.js';
import { hc, hsv2rgb } from '../../util.js';
import { SHOTS, V, around, follow, frame, makeCamera, project } from '../../scene/camera.js';
import { TUNE } from '../../tuning.js';

const {add, sub, mul, dot, len, norm} = V;
// seeded numbers (mulberry32), so a system is the same every time it's visited and the page's own random draws are untouched
const rng = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0)/4294967296; };
const KIND = {rock: 0, gas: 1, ice: 2, lava: 3};
// a star system: a star, three to six planets (hot and rocky inside, giants and ice outside), their rings and moons
function makeSystem(idx){
  const r = rng(idx*7919 + 104729), bodies = [], pick = a => a[Math.floor(r()*a.length)];
  const sun = {kind: 'sun', r: 3 + r()*3, p: [0, 0, 0], slot: Math.floor(r()*3), off: (r() - .5)*.1, sat: .12 + r()*.5};
  const n = 3 + Math.floor(r()*4); let orbit = 18 + r()*8;
  for (let i = 0; i < n; i++) {
    const out = i/(n - 1), kind = out < .3 ? pick(['lava', 'rock']) : out > .6 ? (r() < .65 ? 'gas' : 'ice') : pick(['rock', 'gas', 'ice']);
    const rad = kind === 'gas' ? 1.6 + r()*1.6 : kind === 'ice' ? .7 + r()*.7 : .45 + r()*.6, tilt = (r() - .5)*.8, ta = r()*6.28;
    const ring = kind === 'gas' ? (r() < .6 ? 2.1 + r()*.5 : 0) : kind === 'ice' && r() < .25 ? 1.9 + r()*.4 : 0;
    const pl = {kind, r: rad, orbit, ph: r()*6.28, w: .6/Math.pow(orbit, 1.5)*(.7 + r()*.6), inc: (r() - .5)*.08, p: [0, 0, 0],
      axis: norm([Math.sin(ta)*tilt, 1, Math.cos(ta)*tilt]), ring, slot: Math.floor(r()*3), off: (r() - .5)*.12, seed: r(), spin: (.03 + r()*.08)*(r() < .5 ? -1 : 1)};
    bodies.push(pl);
    const moons = kind === 'gas' ? Math.floor(r()*3) : r() < .35 ? 1 : 0;
    for (let m = 0; m < moons; m++) bodies.push({kind: r() < .5 ? 'rock' : 'ice', moon: true, parent: pl, r: rad*(.16 + r()*.14),
      dist: rad*((ring || 1.6) + 1.2 + m*1.3 + r()*.6), ph: r()*6.28, w: .12 + r()*.12, p: [0, 0, 0], axis: pl.axis, ring: 0,
      slot: Math.floor(r()*3), off: (r() - .5)*.12, seed: r(), spin: .05});
    orbit += 16 + r()*16 + rad*3;
  }
  return {idx, sun, bodies, R: orbit};
}
function place(sys, T){
  for (const b of sys.bodies) {
    if (b.moon) continue;
    const a = b.ph + T*b.w; b.p = [Math.cos(a)*b.orbit, Math.sin(a)*b.orbit*b.inc, Math.sin(a)*b.orbit];
  }
  for (const b of sys.bodies) if (b.moon) {
    const [u, v] = around(b.axis), a = b.ph + T*b.w;
    b.p = add(b.parent.p, add(mul(u, Math.cos(a)*b.dist), mul(v, Math.sin(a)*b.dist)));
  }
}
const nameOf = b => !b ? 'the star' : b.moon ? (b.kind === 'ice' ? 'an icy moon' : 'a small moon')
  : {rock: 'a rocky world', gas: b.ring ? 'a ringed gas giant' : 'a gas giant', ice: b.ring ? 'a ringed ice world' : 'an ice world', lava: 'a lava world'}[b.kind];
const WORDS = {orbit: 'Orbiting', approach: 'Approaching', flyby: 'Passing', eclipse: 'The star behind', reveal: 'Pulling back from', drift: 'Drifting through'};

const C = {on: false, sys: null, cam: makeCamera(), T: 0, kind: null, subj: null, st: 0, shot: null, bars: 0, warp: 0, warpDir: 0,
  jumpTo: 0, lastJump: -1e9, lastType: null, dropWas: 0, caption: '', light: {hue: .1, sat: .3, x: -.6, y: .4}, r: rng(4242)};
const subjOf = b => b ? {p: b.p, r: b.r, axis: b.axis} : {p: C.sys.sun.p, r: C.sys.sun.r, axis: [0, 1, 0]};
const ctx = () => ({cam: C.cam, subj: subjOf(C.subj), sys: {p: [0, 0, 0], R: C.sys.R}, sun: C.sys.sun.p});
function startShot(kind, subj){
  if (subj === undefined) {   // a body: planets more than moons, not the last one
    const pool = C.sys.bodies.filter(b => b !== C.subj && (kind === 'eclipse' ? !b.moon : true));
    const planets = pool.filter(b => !b.moon), list = C.r() < .75 && planets.length ? planets : pool;
    subj = list[Math.floor(C.r()*list.length)];
  }
  C.kind = kind; C.subj = kind === 'reveal' || kind === 'drift' ? null : subj; C.st = 0; C.bars = 0;
  C.shot = SHOTS[kind].start(ctx(), [C.r(), C.r(), C.r()]);
  C.caption = kind === 'reveal' ? `Pulling back: ${C.sys.bodies.filter(b => !b.moon).length} worlds round the star`
    : kind === 'drift' ? 'Drifting between the worlds' : `${WORDS[kind]} ${nameOf(C.subj)}`;
}
// calm music floats and circles; intense music swoops close
function nextShot(T){
  const calm = {orbit: 3, drift: 2, eclipse: 2, reveal: 1.5, approach: 1, flyby: .5}, hot = {flyby: 3, approach: 2.5, orbit: 1.5, eclipse: 1, reveal: .5, drift: .3};
  const w = Object.keys(calm).map(k => [k, k === C.kind ? 0 : calm[k]*(1 - T) + hot[k]*T]), sum = w.reduce((s, [, v]) => s + v, 0);
  let x = C.r()*sum; for (const [k, v] of w) if ((x -= v) <= 0) return startShot(k);
  startShot('orbit');
}
function jump(to){
  if (C.warpDir || !C.sys) return;
  C.warpDir = 1; C.jumpTo = to ?? C.sys.idx + 1; C.lastJump = C.T; C.caption = 'Jumping to hyperspace';
}
function arrive(){   // out of the jump, on the edge of the next system, still moving in
  C.sys = makeSystem(C.jumpTo); place(C.sys, C.T);
  const a = C.r()*6.28, R = C.sys.R, cam = C.cam;
  cam.pos = [Math.cos(a)*R*1.6, R*.3, Math.sin(a)*R*1.6]; cam.look = [0, 0, 0]; cam.lvel = [0, 0, 0];
  cam.vel = mul(norm(sub([0, 0, 0], cam.pos)), R*.25); frame(cam);
  C.warpDir = -1; C.subj = null;
  const ty = C.pendingType; C.pendingType = null;
  if (ty && ty.cosmos.subj !== undefined) startShot('approach', C.sys.bodies[ty.cosmos.subj]);
  else startShot(C.r() < .5 ? 'reveal' : 'approach');
  if (ty) ty.cosmos.subj = C.sys.bodies.indexOf(C.subj);
}
// a new section goes somewhere new (sometimes a new system); a section that comes back returns to its own place
function onSection(ty, T){
  if (!ty.cosmos) ty.cosmos = {idx: C.r() < TUNE.cosmos.newSystem ? C.sys.idx + 1 + Math.floor(C.r()*3) : C.sys.idx};
  if (ty.cosmos.idx !== C.sys.idx) { C.pendingType = ty; return jump(ty.cosmos.idx); }
  const back = ty.cosmos.subj !== undefined ? C.sys.bodies[ty.cosmos.subj] : undefined;
  startShot(T > .5 ? 'approach' : 'orbit', back);
  ty.cosmos.subj = C.sys.bodies.indexOf(C.subj);
}
// never through a body: pushed back out to just above it, losing the speed that took it in
function clear(){
  const cam = C.cam;
  for (const b of [C.sys.sun, ...C.sys.bodies]) {
    const d = sub(cam.pos, b.p), l = len(d) || 1e-6, m = b.r*(b.kind === 'sun' ? 2 : 1.25);
    if (l < m) { const nrm = mul(d, 1/l); cam.pos = add(b.p, mul(nrm, m)); cam.vel = sub(cam.vel, mul(nrm, Math.min(0, dot(cam.vel, nrm)))); }
  }
}
function init(){
  C.sys = makeSystem(0); place(C.sys, 0);
  const R = C.sys.R; Object.assign(C.cam, {pos: [R*.9, R*.35, -R*1.3], look: [0, 0, 0], vel: [0, 0, 0], lvel: [0, 0, 0]}); frame(C.cam);
  startShot('reveal');
}

// simple mode's stars: fixed directions, turned with the camera
const STARS = (() => { const r = rng(99), a = []; for (let i = 0; i < 500; i++) a.push(norm([r()*2 - 1, r()*2 - 1, r()*2 - 1]), r()); return a; })();
const N = 6;   // bodies drawn at once (the shader's arrays)

export default {
  key: 'cosmos', kind: 'world', label: 'Cosmos', optIn: true,
  get light(){ return C.light; },                       // from the star, wherever it is on screen (for objects: scene/context.js)
  suits: (rf, T) => rf.bright*.5 + T*.4,
  // flying it by hand (the lab's keys)
  shot(kind){ if (C.sys && SHOTS[kind] && !C.warpDir) startShot(kind); },
  jump(){ jump(); },
  info: () => ({shot: C.kind, system: C.sys && C.sys.idx, subject: nameOf(C.subj), caption: C.caption, warp: C.warp,
    clear: C.sys ? Math.min(...[C.sys.sun, ...C.sys.bodies].map(b => len(sub(C.cam.pos, b.p))/b.r)) : 99}),   // how near a body the camera is (in its radii)
  step(dt, x){
    if (!C.on || !C.sys) return;
    const mdt = dt*x.ts, cam = C.cam, CZ = TUNE.cosmos, J = x.J;
    C.T += mdt; C.st += mdt; place(C.sys, C.T);
    // the music's say: a section change moves on, a drop jumps (not too often), a shot that's run its course ends
    if (J.on && J.type && J.type !== C.lastType) { const was = C.lastType; C.lastType = J.type; if (was) onSection(J.type, J.tension); }
    if (J.dropGlow > .6 && C.dropWas <= .6 && C.T - C.lastJump > CZ.jumpGapSecs) jump();
    C.dropWas = J.dropGlow;
    if (!C.warpDir && C.st > CZ.maxShotSecs) nextShot(J.tension);
    if (C.warpDir === 1) {   // into the jump: speeding straight ahead, the view widening
      C.warp = Math.min(1, C.warp + dt/CZ.warpUp);
      cam.vel = add(cam.vel, mul(cam.Z, dt*C.sys.R*.8*C.warp)); cam.pos = add(cam.pos, mul(cam.vel, dt)); cam.look = add(cam.pos, mul(cam.Z, 10));
      cam.fov += (CZ.fov + 40*C.warp - cam.fov)*Math.min(1, dt*4); clear(); frame(cam);
      if (C.warp >= 1) arrive();
      return;
    }
    if (C.warpDir === -1 && (C.warp -= dt/CZ.warpDown) <= 0) { C.warp = 0; C.warpDir = 0; }
    const g = SHOTS[C.kind].goal(ctx(), C.shot, C.st), k = CZ.k[C.kind]*(.6 + .8*x.ts);
    g.fov = (g.fov/55)*CZ.fov + 40*C.warp - CZ.kick*S.beat*x.react;   // the kick nudges the view in
    follow(cam, g, mdt, k, k*CZ.lookK);
    clear(); frame(cam);
  },
  onBeat(pos){
    if (!C.on || !C.sys || pos !== 0) return;
    if (++C.bars >= TUNE.cosmos.shotBars && !C.warpDir) nextShot(C.lastT ?? .5);
  },
  params(P, x){
    C.on = P.w.cosmos > .003; C.lastT = x.J.tension;
    if (!C.on) { P.cz = null; return; }
    if (!C.sys) init();
    const cam = C.cam, sun = C.sys.sun;
    // the nearest few bodies, by how big they look
    const vis = C.sys.bodies.map(b => { const rel = sub(b.p, cam.pos); return {b, rel, a: b.r/Math.max(len(rel), 1e-3), z: dot(rel, cam.Z)}; })
      .filter(o => o.z > -o.b.r*3).sort((a, b) => b.a - a.a).slice(0, N);
    const B = new Float32Array(N*4), K = new Float32Array(N*4), A = new Float32Array(N*4);
    vis.forEach(({b, rel}, i) => {
      B.set([...rel, b.r], i*4); K.set([KIND[b.kind], P.pal[b.slot] + b.off, b.seed*10, b.spin], i*4); A.set([...b.axis, b.ring], i*4);
    });
    const sRel = sub(sun.p, cam.pos), sunC = hsv2rgb(P.hue + P.pal[sun.slot] + sun.off, sun.sat, 1).map(v => v*1.6*(1 + x.sBass*x.react*.3));
    P.cz = {X: cam.X, Y: cam.Y, Z: cam.Z, tan: Math.tan(cam.fov*Math.PI/360), B, K, A, sun: [...sRel, sun.r], sunC, warp: C.warp,
      seed: (C.sys.idx*1.37) % 10, vis, sRel, sunR: sun.r};
    const s = project(cam, sun.p), d = s.z > 0 ? [s.x, s.y] : [-s.x, -s.y], l = Math.hypot(d[0], d[1]) || 1;
    C.light = {hue: P.pal[sun.slot] + sun.off, sat: .3 + sun.sat*.5, x: d[0]/l, y: d[1]/l};
  },
  glsl: {
    uniforms: `uniform vec3 uCosX,uCosY,uCosZ; uniform float uCosTan,uCosWarp,uCosSeed;   // the camera's axes, its field of view, the jump
uniform vec4 uCosSun; uniform vec3 uCosSunC;          // the star: where (from the camera) and how big, its colour
uniform vec4 uCosB[6], uCosK[6], uCosA[6];           // the nearest bodies: where and how big (0: none); kind, hue, seed, spin; axis, ring size`,
    functions: `
float czH(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float czN(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(czH(i),czH(i+vec3(1.0,0.0,0.0)),f.x),mix(czH(i+vec3(0.0,1.0,0.0)),czH(i+vec3(1.0,1.0,0.0)),f.x),f.y),
             mix(mix(czH(i+vec3(0.0,0.0,1.0)),czH(i+vec3(1.0,0.0,1.0)),f.x),mix(czH(i+vec3(0.0,1.0,1.0)),czH(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z); }
float czF(vec3 p){ return czN(p)*0.5+czN(p*2.03)*0.25+czN(p*4.01)*0.125; }
// how far along d a sphere (centre c from the eye, radius r) is hit, or -1
float czHit(vec3 d,vec3 c,float r){ float b=dot(c,d), h=b*b-dot(c,c)+r*r; if(h<0.0) return -1.0; float t=b-sqrt(h); return t>0.0?t:-1.0; }
// far away: two clouds of gas and the stars, which streak towards the middle of the view in a jump
vec3 czSky(vec3 d){
  vec3 c=hsv(uHue+0.68,0.6,0.03);
  float n=czF(d*2.2+uCosSeed); c+=hsv(uHue+0.72+n*0.2,0.6,0.16)*smoothstep(0.35,0.75,n);
  float n2=czF(d*3.7-uCosSeed); c+=hsv(uHue+0.95,0.55,0.08)*smoothstep(0.45,0.8,n2);
  float s=0.0;
  for(int k=0;k<6;k++){
    vec3 dk=normalize(d-uCosZ*float(k)*uCosWarp*0.05);
    vec3 g=dk*120.0, id=floor(g), f=fract(g)-0.5; float h=czH(id);
    s+=step(0.965,h)*smoothstep(0.35,0.0,length(f))*(0.55+0.45*sin(uTime*2.0+h*50.0))*(k==0?1.0:0.5);
    if(uCosWarp<0.01) break;
  }
  return c+vec3(0.85,0.9,1.0)*s*(1.0+uBeat*0.3)+vec3(0.5,0.6,1.0)*uCosWarp*uCosWarp*0.25;
}
// a body's surface where the view hits it: rock, banded gas, pale cracked ice, or lava glowing through its cracks
vec3 czBody(vec3 d,float t,vec3 c,float r,vec4 K,vec4 A){
  vec3 p=d*t, n=normalize(p-c), L=normalize(uCosSun.xyz-p), ax=A.xyz;
  float diff=max(dot(n,L),0.0), sp=uTime*K.w, lat=dot(n,ax), hue=uHue+K.y, atm=0.0;
  vec3 q=n*cos(sp)+cross(ax,n)*sin(sp)+ax*dot(ax,n)*(1.0-cos(sp)), qs=q*2.0+K.z, base, emit=vec3(0.0);
  if(K.x<0.5){ base=hsv(hue+0.05,0.35,0.3+0.6*czF(qs*1.6))*(0.75+0.25*smoothstep(0.3,0.5,czN(qs*5.0))); }
  else if(K.x<1.5){ float b=sin(lat*14.0+czF(q*0.9+K.z)*6.0); base=mix(hsv(hue,0.55,0.7),hsv(hue+0.08,0.35,0.95),0.5+0.5*b); atm=0.7; }
  else if(K.x<2.5){ base=hsv(hue+0.5,0.18,0.72+0.25*czF(qs*1.3))*(0.8+0.2*smoothstep(0.0,0.05,abs(czN(qs*4.0)-0.5))); atm=0.45; }
  else { base=hsv(hue+0.02,0.5,0.1+0.1*czF(qs*1.8)); emit=hsv(hue+0.03,0.9,1.0)*smoothstep(0.06,0.0,abs(czN(qs*3.5)-0.5))*(0.7+0.5*uBass*uReact); }
  vec3 col=base*(0.03+0.97*diff)+emit;
  col+=hsv(hue+0.55,0.5,1.0)*pow(1.0-max(dot(n,-d),0.0),3.0)*atm*(0.25+0.75*diff)*(0.85+uBeat*0.3);   // its atmosphere at the edge
  return col;
}
// a body's ring where the view crosses it in front of what's already hit (premultiplied colour, cover)
vec4 czRing(vec3 d,vec3 c,float r,vec4 A,float hue,float tmax){
  float den=dot(d,A.xyz); if(A.w<=0.0||abs(den)<1e-4) return vec4(0.0);
  float t=dot(c,A.xyz)/den; if(t<=0.0||t>tmax) return vec4(0.0);
  vec3 p=d*t; float rr=length(p-c)/r, inner=A.w*0.62; if(rr<inner||rr>A.w) return vec4(0.0);
  float x=(rr-inner)/(A.w-inner), band=0.5+0.5*sin(x*40.0)*sin(x*13.0+1.3), gap=smoothstep(0.04,0.0,abs(x-0.55));
  float a=smoothstep(0.0,0.05,x)*smoothstep(1.0,0.9,x)*(0.35+0.65*band)*(1.0-0.85*gap)*0.8;
  float sh=czHit(normalize(uCosSun.xyz-p),c-p,r)>0.0?0.15:1.0;   // the planet's shadow across it
  return vec4(mix(hsv(hue+0.08,0.3,0.9),hsv(hue+0.55,0.4,0.75),x)*sh*(0.6+uMid*uReact*0.6)*a,a);
}
vec3 cosmos(vec2 sp){
  vec3 d=normalize(uCosZ+(uCosX*sp.x+uCosY*sp.y)*2.0*uCosTan), col=czSky(d);
  float tMin=1e9, ts=czHit(d,uCosSun.xyz,uCosSun.w);
  if(ts>0.0){ tMin=ts; vec3 n=normalize(d*ts-uCosSun.xyz); col=uCosSunC*(1.2+0.8*max(dot(n,-d),0.0))*(0.85+0.3*czF(n*9.0+uTime*0.1)); }
  int hit=-1;
  for(int i=0;i<6;i++){ vec4 B=uCosB[i]; if(B.w<=0.0) continue; float t=czHit(d,B.xyz,B.w); if(t>0.0&&t<tMin){ tMin=t; hit=i; } }
  for(int i=0;i<6;i++) if(i==hit) col=czBody(d,tMin,uCosB[i].xyz,uCosB[i].w,uCosK[i],uCosA[i]);
  // the star's glow, where nothing nearer covers it (so it rims a planet in front of it)
  float sb=dot(uCosSun.xyz,d);
  if(sb>0.0&&(hit<0||tMin>sb)){ float h=length(uCosSun.xyz-d*sb), R=uCosSun.w; col+=uCosSunC*R*R/(h*h+R*R*0.3)*0.22*(1.0+uBass*uReact*0.5); }
  for(int i=0;i<6;i++){
    vec4 B=uCosB[i]; if(B.w<=0.0) continue;
    float b=dot(B.xyz,d), k=uCosK[i].x, atm=k>0.5&&k<1.5?0.7:(k>1.5&&k<2.5?0.45:0.0);
    if(b>0.0&&b<tMin&&atm>0.0){   // an atmosphere's glow just past its edge, brighter on the sunlit side
      vec3 q=d*b; float h=length(B.xyz-q);
      if(h>B.w) col+=hsv(uHue+uCosK[i].y+0.55,0.5,1.0)*exp(-(h-B.w)/(B.w*0.08))*atm*0.35*(0.3+0.7*max(dot(normalize(q-B.xyz),normalize(uCosSun.xyz-q)),0.0));
    }
    vec4 rg=czRing(d,B.xyz,B.w,uCosA[i],uHue+uCosK[i].y,tMin); col=col*(1.0-rg.a)+rg.rgb;
  }
  return col;
}`,
    fn: 'cosmos',
  },
  uniforms(gl, u, P){
    const c = P.cz; if (!c || !u.uCosX) return;
    gl.uniform3fv(u.uCosX, c.X); gl.uniform3fv(u.uCosY, c.Y); gl.uniform3fv(u.uCosZ, c.Z);
    gl.uniform1f(u.uCosTan, c.tan); gl.uniform1f(u.uCosWarp, c.warp); gl.uniform1f(u.uCosSeed, c.seed);
    gl.uniform4fv(u.uCosSun, c.sun); gl.uniform3fv(u.uCosSunC, c.sunC);
    gl.uniform4fv(u['uCosB[0]'], c.B); gl.uniform4fv(u['uCosK[0]'], c.K); gl.uniform4fv(u['uCosA[0]'], c.A);
  },
  // simple mode: the same camera and bodies, far to near, as shaded discs with rings split round them
  draw2d(o, P){
    const c = P.cz; if (!c) return;
    const W = o.canvas.width, H = o.canvas.height, u = H, cx = W/2, cy = H/2, asp = W/H, k2 = 1/(2*c.tan);
    o.globalAlpha = Math.min(1, P.w.cosmos);
    o.fillStyle = hc(P.hue + .68, 60, 3, 1); o.fillRect(0, 0, W, H);
    o.strokeStyle = 'rgba(220,230,255,.85)'; o.fillStyle = 'rgba(220,230,255,.85)'; o.lineWidth = Math.max(1, u/500); o.beginPath();
    for (let i = 0; i < STARS.length; i += 2) {
      const d = STARS[i], z = dot(d, c.Z); if (z <= .05) continue;
      const x = dot(d, c.X)/z*k2, y = dot(d, c.Y)/z*k2; if (Math.abs(x) > asp/2 || Math.abs(y) > .5) continue;
      if (c.warp > .02) { o.moveTo(cx + x*u, cy - y*u); o.lineTo(cx + x*u*(1 - c.warp*.35), cy - y*u*(1 - c.warp*.35)); }
      else { const s = (.6 + STARS[i + 1])*Math.max(1, u/500); o.rect(cx + x*u, cy - y*u, s, s); }
    }
    if (c.warp > .02) o.stroke(); else o.fill();
    const scr = rel => { const z = dot(rel, c.Z), k = k2/z; return {x: cx + dot(rel, c.X)*k*u, y: cy - dot(rel, c.Y)*k*u, z, k: k*u}; };
    const items = [{sun: true, rel: c.sRel, r: c.sunR}, ...c.vis.map(v => ({b: v.b, rel: v.rel, r: v.b.r}))].map(it => ({...it, ...scr(it.rel)}))
      .filter(it => it.z > it.r*.3).sort((a, b) => b.z - a.z);
    const sunCol = c.sunC.map(v => Math.round(Math.min(1, v)*255)).join(',');
    for (const it of items) {
      const R = it.r*it.k; if (it.x < -R*4 || it.x > W + R*4 || it.y < -R*4 || it.y > H + R*4) continue;
      if (it.sun) {
        o.globalCompositeOperation = 'lighter';
        const g = o.createRadialGradient(it.x, it.y, 0, it.x, it.y, R*5);
        g.addColorStop(0, `rgba(${sunCol},.9)`); g.addColorStop(.2, `rgba(${sunCol},.35)`); g.addColorStop(1, `rgba(${sunCol},0)`);
        o.fillStyle = g; o.fillRect(it.x - R*5, it.y - R*5, R*10, R*10);
        o.globalCompositeOperation = 'source-over'; o.fillStyle = `rgb(${sunCol})`; o.beginPath(); o.arc(it.x, it.y, Math.max(1, R), 0, 7); o.fill();
        continue;
      }
      const b = it.b, hue = P.hue + P.pal[b.slot] + b.off, L = norm(sub(c.sRel, it.rel));
      const lx = dot(L, c.X), ly = dot(L, c.Y), lit = Math.max(.08, 1 - Math.max(0, dot(L, c.Z))*.9);
      const ring = half => {   // the half of the ring behind (or in front of) the planet
        if (!b.ring) return;
        const [ua, va] = around(b.axis); o.lineWidth = Math.max(1, b.r*b.ring*.38*it.k); o.strokeStyle = hc(hue + .08, 30, 70, .55); o.beginPath();
        for (let j = 0; j <= 48; j++) {
          const a = j/48*Math.PI*2, pt = add(it.rel, add(mul(ua, Math.cos(a)*b.r*b.ring*.81), mul(va, Math.sin(a)*b.r*b.ring*.81)));
          const s = scr(pt), back = s.z > it.z; if (s.z <= .01 || back !== half) { o.stroke(); o.beginPath(); continue; }
          o.lineTo(s.x, s.y);
        }
        o.stroke();
      };
      ring(true);
      const base = {rock: [hue + .05, 30, 45], gas: [hue, 50, 60], ice: [hue + .5, 18, 80], lava: [hue + .02, 55, 18]}[b.kind];
      o.save(); o.beginPath(); o.arc(it.x, it.y, Math.max(.8, R), 0, 7); o.clip();
      o.fillStyle = hc(base[0], base[1], base[2], 1); o.fillRect(it.x - R, it.y - R, R*2, R*2);
      if (b.kind === 'gas' && R > 3) {   // bands, square to its axis
        o.translate(it.x, it.y); o.rotate(-Math.atan2(dot(b.axis, c.Y), dot(b.axis, c.X)) + Math.PI/2);
        for (let j = -4; j <= 4; j++) { o.fillStyle = hc(hue + (j & 1 ? .08 : 0), 40, j & 1 ? 72 : 50, .5); o.fillRect(-R, j*R/4.5, R*2, R/9); }
        o.setTransform(1, 0, 0, 1, 0, 0);
      }
      if (b.kind === 'lava') { o.strokeStyle = hc(hue + .03, 90, 55, .7); o.lineWidth = Math.max(1, R/25); o.beginPath();   // glowing cracks
        const r = rng(Math.floor(b.seed*1e6)); for (let j = 0; j < 7; j++) { o.moveTo(it.x + (r() - .5)*R*2, it.y + (r() - .5)*R*2); o.lineTo(it.x + (r() - .5)*R*2, it.y + (r() - .5)*R*2); } o.stroke(); }
      const sx = it.x + lx*R*.55, sy = it.y - ly*R*.55, sh = o.createRadialGradient(sx, sy, R*.1, sx, sy, R*2.1);   // lit towards the star
      sh.addColorStop(0, `rgba(0,0,0,${1 - lit})`); sh.addColorStop(.45, `rgba(0,0,0,${Math.min(.95, 1.1 - lit*.6)})`); sh.addColorStop(1, 'rgba(0,0,0,.97)');
      o.fillStyle = sh; o.fillRect(it.x - R, it.y - R, R*2, R*2);
      o.restore();
      if (b.kind === 'gas' || b.kind === 'ice') { o.strokeStyle = hc(hue + .55, 50, 70, .35); o.lineWidth = Math.max(1, R*.08); o.beginPath(); o.arc(it.x, it.y, R*1.03, 0, 7); o.stroke(); }
      ring(false);
    }
    if (c.warp > .02) { o.fillStyle = `rgba(130,150,255,${c.warp*c.warp*.2})`; o.fillRect(0, 0, W, H); }
    o.globalAlpha = 1;
  },
};
