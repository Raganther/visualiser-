// How the cosmos's camera moves with the music. The track's shape leads:
//   a build pulls the camera in towards a body (closer as it grows, the view narrowing, the stars starting to stretch);
//   the drop releases it (a hyperspace jump, or a sudden pull back to the whole system);
//   the quiet (no kick for a while) drifts or circles wide and slow;
//   a new section goes to the system on the galaxy arm that matches its mood, and a returning one goes back to its own;
//   otherwise a new shot every few bars, calm music floating and circling, intense music swooping close.
// The camera's own movement is handed on (motion) as wind and zoom for the trails, so the glow streams past as it flies.
import { S } from '../../../state.js';
import { SHOTS, V, follow, frame, makeCamera, project } from '../../../scene/camera.js';
import { TUNE } from '../../../tuning.js';
import { ARM_WORDS, armFor, hashStr, makeSystem, nameOf, place, rng, sysIndex } from './system.js';

const {add, sub, mul, dot, len, norm} = V;
export const C = {on: false, sys: null, cam: makeCamera(), T: 0, kind: null, subj: null, st: 0, shot: null, bars: 0,
  warp: 0, warpDir: 0, jumpTo: 0, lastJump: -1e9, lastType: null, lastDrop: undefined, pendingType: null, caption: '',
  light: {hue: .1, sat: .3, x: -.6, y: .4}, motion: {x: 0, y: 0, z: 0}, prevZ: [0, 0, 1], r: rng(4242),
  track: null, galaxy: 0, armNext: [0, 1, 0], since: 0,
  tf: 0, ts: 0, build: 0, building: false, prog: 0, fizzle: 0, stretch: 0, fovKick: 0, calm: false};
const WORDS = {orbit: 'Orbiting', approach: 'Approaching', flyby: 'Passing', eclipse: 'The star behind', reveal: 'Pulling back from',
  drift: 'Drifting through', push: 'Drawn towards'};
const subjOf = b => b ? {p: b.p, r: b.r, axis: b.axis} : {p: C.sys.sun.p, r: C.sys.sun.r, axis: [0, 1, 0]};
const ctx = () => ({cam: C.cam, subj: subjOf(C.subj), sys: {p: [0, 0, 0], R: C.sys.R}, sun: C.sys.sun.p, prog: C.prog});
const planets = () => C.sys.bodies.filter(b => !b.moon);

export function startShot(kind, subj){
  if (subj === undefined) {   // a body: planets more than moons, not the last one
    const pool = C.sys.bodies.filter(b => b !== C.subj && (kind === 'eclipse' || kind === 'push' ? !b.moon : true));
    const pl = pool.filter(b => !b.moon), list = C.r() < .75 && pl.length ? pl : pool;
    subj = list[Math.floor(C.r()*list.length)];
  }
  C.kind = kind; C.subj = kind === 'reveal' || kind === 'drift' ? null : subj; C.st = 0; C.bars = 0;
  C.shot = SHOTS[kind].start(ctx(), [C.r(), C.r(), C.r()]);
  C.caption = kind === 'reveal' ? `Pulling back: ${planets().length} worlds round a ${ARM_WORDS[C.sys.arm]} star`
    : kind === 'drift' ? (C.calm ? 'Drifting in the quiet' : 'Drifting between the worlds') : `${WORDS[kind]} ${nameOf(C.subj)}`;
}
export function nextShot(T){
  const calm = {orbit: 3, drift: 2, eclipse: 2, reveal: 1.5, approach: 1, flyby: .5}, hot = {flyby: 3, approach: 2.5, orbit: 1.5, eclipse: 1, reveal: .5, drift: .3};
  const w = Object.keys(calm).map(k => [k, k === C.kind ? 0 : calm[k]*(1 - T) + hot[k]*T]), sum = w.reduce((s, [, v]) => s + v, 0);
  let x = C.r()*sum; for (const [k, v] of w) if ((x -= v) <= 0) return startShot(k);
  startShot('orbit');
}
export function jump(to){
  if (C.warpDir || !C.sys) return;
  C.building = false; C.prog = 0;
  C.warpDir = 1; C.jumpTo = to ?? sysIndex(C.galaxy, C.sys.arm, C.armNext[C.sys.arm]++); C.lastJump = C.T;
  C.caption = 'Jumping to hyperspace';
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
  C.caption = `Arriving at a ${ARM_WORDS[C.sys.arm]} star: ` + C.caption.charAt(0).toLowerCase() + C.caption.slice(1);
}
// a new section goes to the system on the arm that suits it (sometimes staying, if it already does); a returning one goes back
function onSection(ty, T){
  const arm = armFor(T, ty.pace ?? .5);
  if (!ty.cosmos) {
    const stay = arm === C.sys.arm && C.r() > TUNE.cosmos.newSystem;
    ty.cosmos = {idx: stay ? C.sys.idx : C.warpDir ? C.jumpTo : sysIndex(C.galaxy, arm, C.armNext[arm]++)};
  }
  if (ty.cosmos.idx !== C.sys.idx) { C.pendingType = ty; if (!C.warpDir) jump(ty.cosmos.idx); return; }
  if (C.building) return;   // mid-build: the build keeps the camera
  const back = ty.cosmos.subj !== undefined ? C.sys.bodies[ty.cosmos.subj] : undefined;
  startShot(T > .5 ? 'approach' : 'orbit', back);
  ty.cosmos.subj = C.sys.bodies.indexOf(C.subj);
}
// the drop: out of the build with a jump, or a sudden pull back to the whole system
function release(T){
  const CZ = TUNE.cosmos; C.building = false; C.prog = 0; C.calm = false;
  if (C.T - C.lastJump > CZ.jumpGapSecs && C.r() < CZ.dropJump) return jump(sysIndex(C.galaxy, 2, C.armNext[2]++));
  startShot('reveal'); C.fovKick = CZ.dropWiden; C.caption = 'Released: ' + C.caption.charAt(0).toLowerCase() + C.caption.slice(1);
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
  C.sys = makeSystem(sysIndex(C.galaxy, 1, 0)); place(C.sys, C.T);
  const R = C.sys.R; Object.assign(C.cam, {pos: [R*.9, R*.35, -R*1.3], look: [0, 0, 0], vel: [0, 0, 0], lvel: [0, 0, 0]}); frame(C.cam);
  startShot('reveal');
}
// how the far view slides across the screen and how fast the camera closes on what it looks at, handed on as wind and zoom
function motion(dt){
  const cam = C.cam, m = C.motion, k2 = 1/(2*Math.tan(cam.fov*Math.PI/360)), dZ = sub(cam.Z, C.prevZ), idt = 1/Math.max(dt, 1e-3);
  C.prevZ = [...cam.Z];
  const near = C.subj ? Math.max(len(sub(C.subj.p, cam.pos)) - C.subj.r, 1) : C.sys.R*.5;
  const tx = Math.max(-2, Math.min(2, -dot(dZ, cam.X)*k2*idt)), ty = Math.max(-2, Math.min(2, -dot(dZ, cam.Y)*k2*idt));
  const tz = Math.max(-1, Math.min(3, dot(cam.vel, cam.Z)/near + C.warp*3));
  const e = Math.min(1, dt*3); m.x += (tx - m.x)*e; m.y += (ty - m.y)*e; m.z += (tz - m.z)*e;
}

// once a frame, when on screen: x carries J, ts (the pace's time scale), react, kickAgo (ms since the last kick), track
export function fly(dt, x){
  const mdt = dt*x.ts, cam = C.cam, CZ = TUNE.cosmos, J = x.J;
  if ((x.track || '') !== C.track) {   // a new track is a new galaxy (the same track, the same one)
    const had = !!C.sys; C.track = x.track || ''; C.galaxy = hashStr(C.track || 'built-in'); C.armNext = [0, 1, 0];
    C.tf = C.ts = J.tension || 0; C.build = 0; C.since = 0;   // the averages start level: arriving isn't a build
    if (!had) init(); else jump(sysIndex(C.galaxy, 1, 0));
  }
  C.T += mdt; C.st += mdt; C.since += dt; place(C.sys, C.T);
  // the track's shape: tension climbing faster than its slow average is a build
  const T = J.tension || 0;
  C.tf += (T - C.tf)*Math.min(1, dt/CZ.buildFast); C.ts += (T - C.ts)*Math.min(1, dt/CZ.buildSlow);
  const b = C.tf > CZ.buildFloor ? Math.max(0, Math.min(1, (C.tf - C.ts)/CZ.buildSpan)) : 0;
  C.build += (b - C.build)*Math.min(1, dt*.8);
  if (J.on && J.type && J.type !== C.lastType) {   // the first section owns where the camera already is
    const was = C.lastType; C.lastType = J.type;
    if (was) onSection(J.type, T); else if (!J.type.cosmos) J.type.cosmos = {idx: C.sys.idx};
  }
  if (C.lastDrop === undefined) C.lastDrop = J.lastDrop;
  if (J.lastDrop !== C.lastDrop) { C.lastDrop = J.lastDrop; release(T); }
  if (!C.building && !C.warpDir && C.build > CZ.buildStart && C.since > CZ.buildGrace) {   // (not while a track settles in)   // a build begins: drawn towards the biggest world near by
    const pl = planets().sort((a, b) => b.r/len(sub(b.p, cam.pos)) - a.r/len(sub(a.p, cam.pos)));
    C.building = true; C.prog = 0; C.fizzle = 0; C.calm = false; startShot('push', pl[0]);
  }
  if (C.building) {
    C.prog = Math.min(1, C.prog + dt*(CZ.pushMin + C.build*CZ.pushRate));
    C.fizzle = C.build < .12 ? C.fizzle + dt : 0;
    if (C.fizzle > CZ.fizzleSecs) { C.building = false; C.prog = 0; nextShot(T); }   // it came to nothing: carry on
  }
  C.stretch += ((C.building ? C.build*C.prog : 0) - C.stretch)*Math.min(1, dt*2);
  // the quiet: no kick for a while drifts or circles wide; the kick coming back moves on at the next bar
  const quiet = x.kickAgo > CZ.quietSecs*1000;
  if (quiet && !C.calm && !C.building && !C.warpDir) { C.calm = true; startShot(C.r() < .5 ? 'drift' : 'orbit'); if (C.kind === 'orbit') C.caption = 'Circling in the quiet'; }
  if (C.calm && x.kickAgo < 400) { C.calm = false; C.bars = CZ.shotBars - 1; }
  if (!C.warpDir && !C.building && C.st > CZ.maxShotSecs) nextShot(T);
  if (C.warpDir === 1) {   // into the jump: speeding straight ahead, the view widening
    C.warp = Math.min(1, C.warp + dt/CZ.warpUp);
    cam.vel = add(cam.vel, mul(cam.Z, dt*C.sys.R*.8*C.warp)); cam.pos = add(cam.pos, mul(cam.vel, dt)); cam.look = add(cam.pos, mul(cam.Z, 10));
    cam.fov += (CZ.fov + 40*C.warp - cam.fov)*Math.min(1, dt*4); clear(); frame(cam); motion(dt);
    if (C.warp >= 1) arrive();
    return;
  }
  if (C.warpDir === -1 && (C.warp -= dt/CZ.warpDown) <= 0) { C.warp = 0; C.warpDir = 0; }
  C.fovKick *= Math.exp(-dt*1.2);
  const g = SHOTS[C.kind].goal(ctx(), C.shot, C.st), k = CZ.k[C.kind]*(.6 + .8*x.ts)*(C.calm ? CZ.quietSlow : 1);
  g.fov = (g.fov/55)*CZ.fov*(1 - CZ.pushNarrow*C.stretch) + 40*C.warp + C.fovKick - CZ.kick*(1 + C.build)*S.beat*x.react;   // the kick nudges the view in, harder in a build
  follow(cam, g, mdt, k, k*CZ.lookK);
  clear(); frame(cam); motion(dt);
}
export function flyBeat(pos){
  if (!C.on || !C.sys || pos !== 0 || C.building || C.calm) return;
  if (++C.bars >= TUNE.cosmos.shotBars && !C.warpDir) nextShot(C.lastT ?? .5);
}
// the star's direction on screen, for the objects' light
export function lightFrom(P){
  const sun = C.sys.sun, s = project(C.cam, sun.p), d = s.z > 0 ? [s.x, s.y] : [-s.x, -s.y], l = Math.hypot(d[0], d[1]) || 1;
  C.light = {hue: P.pal[sun.slot] + sun.off, sat: .3 + sun.sat*.5, x: d[0]/l, y: d[1]/l};
}
