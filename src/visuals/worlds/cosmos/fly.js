// How the cosmos's camera moves with the music. The track's shape leads:
//   a build pulls the camera in towards a body (closer as it grows, the view narrowing, the stars starting to stretch);
//   the drop releases it (a hyperspace jump, or a sudden pull back to the whole system);
//   the quiet (no kick for a while) drifts or circles wide and slow;
//   a new section goes to the system on the galaxy arm that matches its mood, and a returning one goes back to its own;
//   otherwise a new shot every few bars, calm music floating and circling, intense music swooping close.
// The camera's own movement is handed on (motion) as wind and zoom for the trails, so the glow streams past as it flies.
import { S } from '../../../state.js';
import { SHOTS, V, around, follow, frame, makeCamera, project } from '../../../scene/camera.js';
import { TUNE } from '../../../tuning.js';
import { ARM_WORDS, KIND, armFor, galPos, hashStr, makeSystem, nameOf, place, rng, starName, sysIndex } from './system.js';
import { SF, sfPath } from './surface.js';

const {add, sub, mul, dot, len, norm, cross} = V;
export const C = {on: false, sys: null, cam: makeCamera(), T: 0, kind: null, subj: null, st: 0, shot: null, bars: 0,
  warp: 0, warpDir: 0, jumpTo: 0, lastJump: -1e9, lastType: null, lastDrop: undefined, pendingType: null, caption: '',
  light: {hue: .1, sat: .3, x: -.6, y: .4}, motion: {x: 0, y: 0, z: 0}, prevZ: [0, 0, 1], r: rng(4242),
  track: null, galaxy: 0, armNext: [0, 1, 0], since: 0,
  tf: 0, ts: 0, build: 0, building: false, prog: 0, fizzle: 0, stretch: 0, fovKick: 0, calm: false, beatPh: 0, monOn: false, holdUntil: -1,
  fold: {amt: 0, n: 6, local: false, bars: 0, hand: 0}, afterUp: null,
  // the subject dressed in layers: a wire cage turning a notch each beat with a band of light running down it each bar,
  // and a ring of motes flaring on stabs; a drop bursts the cage outwards before it re-forms. Per section, or by hand
  dress: {cage: 0, motes: 0, want: {cage: 0, motes: 0}, hand: null, spin: 0, spinTo: 0, burst: 0, bar: 0}};
// a section's dress, kept with it so it comes back the same: sometimes a cage, the motes more when it's intense
function dressFor(ty, T){
  if (!ty.cosmos) ty.cosmos = {idx: C.sys.idx};
  if (!ty.cosmos.dress) { const D = TUNE.cosmos.dress, on = C.r() < D.chance;
    ty.cosmos.dress = {cage: on && C.r() < D.cage ? 1 : 0, motes: on && C.r() < D.motes + T*.3 ? 1 : 0}; }
  C.dress.want = ty.cosmos.dress;
}   // the view folded into a kaleidoscope: how far, how many ways, round the subject only; by hand
// a drop can fold the view for a few bars: more ways the more intense the music, sometimes only round the subject
export function openFold(){
  const f = C.fold, CZ = TUNE.cosmos.fold, ns = CZ.n;
  f.n = ns[Math.min(ns.length - 1, Math.floor((C.lastT ?? .5)*ns.length*.999 + C.r()*.8))]; f.local = C.r() < CZ.localChance; f.bars = CZ.bars;
}
// a shot picked by hand holds the camera for a while: the music doesn't take it straight back
export const hold = secs => { C.holdUntil = C.T + secs; };
const held = () => C.T < C.holdUntil;
const WORDS = {orbit: 'Orbiting', approach: 'Approaching', flyby: 'Passing', eclipse: 'The star behind', sunrise: 'Sunrise over', reveal: 'Pulling back from',
  drift: 'Drifting through', push: 'Drawn towards'};
// the galaxy trip: out of the system to the whole galaxy, a look across it, and a dive into another system on its arm
export const G = {cam: makeCamera(), on: 0, phase: null, t: 0, from: [0, 0, 0], to: [0, 0, 0], target: 0};
const SOLID = b => b.kind !== 'gas';   // what the camera can skim over (and land on)
// landing: in on the world, down through its air and cloud, out low over its ground; taking off, the other way
export function land(b){
  if (!C.sys || C.warpDir || G.phase) return;
  if (!(b && C.sys.bodies.includes(b) && SOLID(b) && !b.moon)) b = C.sys.bodies.filter(o => SOLID(o) && !o.moon).sort((p, q) => q.r - p.r)[0];
  if (!b) return;
  if (SF.phase && SF.body === b) return;
  SF.body = b; SF.phase = 'down'; C.building = false; startShot('skim', b); C.caption = `Descending to ${nameOf(b, C.sys)}`;
}
export function takeoff(then){
  if (!SF.phase) return then != null && jump(then);
  C.afterUp = then; if (SF.phase === 'down') { SF.phase = null; SF.body = null; return then != null && jump(then); }
  SF.phase = 'up'; SF.altTo = 520; C.caption = `Climbing out of ${nameOf(SF.body, C.sys)}`;
}
// the camera on the ground: along the river's valley (its floor is flat, so it's safe) or soaring over the peaks, the
// sun's height following the music (calm: dusk and night, intense: day); a build climbs for the view, a drop dives back
function surface(dt, x){
  const L = TUNE.cosmos.land, b = SF.body, cam = C.cam;
  if (SF.phase === 'down' && b && len(sub(cam.pos, b.p))/b.r < L.enterR) {
    SF.phase = 'land'; SF.want = 1; SF.alt = 520; SF.altTo = L.valley; SF.mode = 'valley'; SF.z = 0; SF.t = 0; SF.hold = 8;
    SF.seed = (b.seed*10) % 6.28; SF.kind = KIND[b.kind]; C.caption = `Down through the air of ${nameOf(b, C.sys)}`;
  }
  if (SF.phase === 'up' && SF.alt > L.exitAlt) SF.want = 0;
  SF.amt = Math.max(0, Math.min(1, SF.amt + (SF.want ? 1 : -1)*dt/L.fadeSecs));
  if (SF.phase === 'up' && SF.amt <= 0) {   // back in space, just above the world, pulling back
    const n = norm(sub(cam.pos, b.p)); cam.pos = add(b.p, mul(n, b.r*1.6)); cam.vel = mul(n, b.r*.3); cam.look = [...b.p]; frame(cam);
    SF.phase = null; SF.body = null; startShot('reveal'); if (C.afterUp != null) { const to = C.afterUp; C.afterUp = null; jump(to); }
    return;
  }
  if (!SF.amt) return;
  const T = x.J.tension || 0, mdt = dt*x.ts;
  if (SF.phase === 'land') {
    if (SF.t > SF.hold) { if (C.build > .45) SF.mode = 'soar'; else if (SF.mode === 'soar' && C.build < .1 && SF.t > 12) SF.mode = 'valley'; }   // (a dive holds the valley a while)
    SF.altTo = SF.mode === 'soar' ? L.soar : L.valley;
  }
  SF.t += dt; SF.alt += (SF.altTo - SF.alt)*Math.min(1, dt*(SF.phase === 'up' ? .45 : SF.alt > 200 ? .5 : .6));
  SF.z += mdt*L.speed*(SF.mode === 'soar' ? 1.8 : 1)*(1 + SF.dive*2);
  SF.dive *= Math.exp(-dt/1.2);
  const hi = SF.alt > 60, px = sfPath(SF.z, SF.seed) + Math.sin(SF.t*.4)*1.5, ah = SF.z + (hi ? 140 : 34);
  SF.pos = [px, SF.alt + (hi ? 0 : Math.sin(SF.t*.7)*.8), SF.z];
  SF.look = [sfPath(ah, SF.seed), SF.alt - (hi ? 55 : 1.2), ah];
  const Z = norm(sub(SF.look, SF.pos)), X = norm(cross([0, 1, 0], Z)); SF.Z = Z; SF.X = X; SF.Y = cross(Z, X);
  SF.fov = L.fov - 1.5*S.beat*x.react;
  SF.sunTo = L.sunLow + (L.sunHigh - L.sunLow)*T; SF.sun += (SF.sunTo - SF.sun)*Math.min(1, dt/L.sunSecs);
  const fw = norm([Z[0], 0, Z[2]]), a = L.sunAz, fx = fw[0]*Math.cos(a) - fw[2]*Math.sin(a), fz = fw[0]*Math.sin(a) + fw[2]*Math.cos(a);
  SF.sunDir = norm([fx*Math.cos(SF.sun), Math.sin(SF.sun), fz*Math.cos(SF.sun)]);
  SF.haze = Math.max(1 - Math.abs(2*SF.amt - 1), sstep(L.exitAlt - 140, L.exitAlt, SF.alt)*.9);
  C.caption = SF.phase === 'up' ? C.caption : `${SF.mode === 'soar' ? 'Soaring over the peaks of' : 'Low along a valley of'} ${nameOf(b, C.sys)}`;
}
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a)/(b - a))); return t*t*(3 - 2*t); };
// the monument (where a centrepiece stands, in orbit round the first planet), as a subject for the shots
const monBody = () => ({kind: 'monument', get p(){ return C.sys.mon.p; }, r: C.sys.mon.r, axis: [0, 1, 0]});
// a black hole is circled on a tilted orbit, so its disk opens up instead of showing edge on
const subjOf = b => b ? {p: b.p, r: b.r, axis: b.axis} : C.sys.sun.type === 'hole'
  ? {p: C.sys.sun.p, r: C.sys.sun.r*2.5, axis: norm(add(C.sys.sun.axis, mul(around(C.sys.sun.axis)[0], 1.4)))} : {p: C.sys.sun.p, r: C.sys.sun.r, axis: C.sys.sun.axis};
const ctx = () => ({cam: C.cam, subj: subjOf(C.subj), sys: {p: [0, 0, 0], R: C.sys.R, belt: C.sys.belt}, sun: C.sys.sun.p, prog: C.prog});
const planets = () => C.sys.bodies.filter(b => !b.moon);

export function startShot(kind, subj){
  if (subj === undefined) {   // a body: planets more than moons, not the last one
    const pool = C.sys.bodies.filter(b => b !== C.subj && (kind === 'eclipse' || kind === 'push' || kind === 'sunrise' ? !b.moon : true));
    const pl = pool.filter(b => !b.moon), list = C.r() < .75 && pl.length ? pl : pool;
    subj = C.monOn && kind !== 'eclipse' && C.r() < .25 ? monBody() : list[Math.floor(C.r()*list.length)];
  }
  if (kind === 'belt' && !C.sys.belt) kind = 'drift';
  if (kind === 'skim' && !(subj && SOLID(subj))) {   // a solid world to skim over (a gas giant has no surface)
    const solid = C.sys.bodies.filter(b => SOLID(b) && b !== C.subj); if (solid.length) subj = solid[Math.floor(C.r()*solid.length)]; else kind = 'approach';
  }
  C.kind = kind; C.subj = kind === 'reveal' || kind === 'drift' || kind === 'belt' ? null : subj; C.st = 0; C.bars = 0;
  C.shot = SHOTS[kind].start(ctx(), [C.r(), C.r(), C.r()]);
  C.caption = kind === 'reveal' ? `Pulling back: ${planets().length} worlds round ${starName(C.sys)}`
    : kind === 'drift' ? (C.calm ? 'Drifting in the quiet' : 'Drifting between the worlds') : kind === 'belt' ? 'Through the asteroid belt'
    : kind === 'skim' ? `Skimming low over ${nameOf(C.subj, C.sys)}`
    : `${WORDS[kind]} ${nameOf(C.subj, C.sys)}`;
}
export function nextShot(T){
  const belt = C.sys.belt ? 1 : 0;   // a belt to fly through: more likely when it's intense (the rocks rush past)
  const calm = {orbit: 3, drift: 2, eclipse: 2, sunrise: 1.2, reveal: 1.5, approach: 1, flyby: .5, belt: .6*belt, skim: .6}, hot = {flyby: 3, approach: 2.5, orbit: 1.5, eclipse: 1, sunrise: .6, reveal: .5, drift: .3, belt: 2*belt, skim: 1.3};
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
  const special = C.sys.sun.type !== 'star';   // twin stars, a pulsar or a black hole: circle it first
  if (ty && ty.cosmos.subj !== undefined) startShot('approach', C.sys.bodies[ty.cosmos.subj]);
  else if (special) startShot('orbit', null);
  else startShot(C.r() < .5 ? 'reveal' : 'approach');
  if (ty) ty.cosmos.subj = C.sys.bodies.indexOf(C.subj);
  C.caption = `Arriving at ${starName(C.sys)}: ` + C.caption.charAt(0).toLowerCase() + C.caption.slice(1);
}
// a new section goes to the system on the arm that suits it (sometimes staying, if it already does); a returning one goes back
function onSection(ty, T){
  const arm = armFor(T, ty.pace ?? .5);
  if (held()) { if (!ty.cosmos) ty.cosmos = {idx: C.sys.idx}; return; }
  if (!ty.cosmos) {
    const stay = arm === C.sys.arm && C.r() > TUNE.cosmos.newSystem;
    ty.cosmos = {idx: stay ? C.sys.idx : C.warpDir ? C.jumpTo : sysIndex(C.galaxy, arm, C.armNext[arm]++)};
  }
  if (ty.cosmos.land === undefined) {   // some sections land on one of the system's worlds (and a returning one lands there again)
    const solid = C.sys.bodies.filter(b => SOLID(b) && !b.moon);
    ty.cosmos.land = ty.cosmos.idx === C.sys.idx && solid.length && C.r() < TUNE.cosmos.land.chance ? C.sys.bodies.indexOf(solid[Math.floor(C.r()*solid.length)]) : -1;
  }
  if (ty.cosmos.idx !== C.sys.idx) { C.pendingType = ty; if (SF.phase) takeoff(ty.cosmos.idx); else if (!C.warpDir) jump(ty.cosmos.idx); return; }
  if (ty.cosmos.land >= 0) return land(C.sys.bodies[ty.cosmos.land]);
  if (SF.phase) return takeoff();
  if (C.building) return;   // mid-build: the build keeps the camera
  const back = ty.cosmos.subj !== undefined ? C.sys.bodies[ty.cosmos.subj] : undefined;
  // a section opens on its shot (kept, so it comes back the same): some on a set piece, an eclipse or a sunrise
  if (!ty.cosmos.shot) ty.cosmos.shot = C.r() < TUNE.cosmos.showpiece ? (C.r() < .5 ? 'eclipse' : 'sunrise') : T > .5 ? 'approach' : 'orbit';
  startShot(ty.cosmos.shot, back);
  ty.cosmos.subj = C.sys.bodies.indexOf(C.subj);
}
// the drop: out of the build with a jump, or a sudden pull back to the whole system
function release(T){
  C.dress.burst = 1;   // a dressed subject's cage bursts outwards (even while the camera's held)
  if (SF.phase === 'land') { SF.mode = 'valley'; SF.altTo = TUNE.cosmos.land.valley; SF.dive = 1; SF.t = 0; SF.hold = TUNE.cosmos.land.diveSecs; return; }   // on the ground: a dive back into the valley, racing along it
  if (held()) return;
  const CZ = TUNE.cosmos, full = C.prog > .85;   // the biggest drops (after a full build) go out to the galaxy, or to a black hole
  C.building = false; C.prog = 0; C.calm = false;
  if (C.r() < CZ.fold.dropChance) openFold();   // and some fold the view into a kaleidoscope for a couple of bars
  if (full && C.T - C.lastJump > CZ.jumpGapSecs && C.r() < CZ.galaxyChance) return galaxyTrip(sysIndex(C.galaxy, 2, C.armNext[2]++));
  if (C.T - C.lastJump > CZ.jumpGapSecs && (full || C.r() < CZ.dropJump)) {
    let k = C.armNext[2];
    if (full) for (let i = 0; i < 40; i++) if (makeSystem(sysIndex(C.galaxy, 2, k + i)).sun.type === 'hole') { k += i; break; }
    C.armNext[2] = k + 1; return jump(sysIndex(C.galaxy, 2, k));
  }
  if (C.r() < CZ.dropShowpiece) { startShot(C.r() < .5 ? 'eclipse' : 'sunrise'); C.fovKick = CZ.dropWiden*.6; return; }   // or straight to a set piece
  startShot('reveal'); C.fovKick = CZ.dropWiden; C.caption = 'Released: ' + C.caption.charAt(0).toLowerCase() + C.caption.slice(1);
}
// never through a body: pushed back out to just above it, losing the speed that took it in
function clear(){
  const cam = C.cam;
  const tw = C.sys.sun.twin, ex = [C.sys.sun, ...C.sys.bodies, ...(tw ? [{kind: 'sun', p: tw.p, r: tw.r}] : []), ...(C.monOn ? [{p: C.sys.mon.p, r: C.sys.mon.r}] : [])];
  for (const b of ex) {
    const d = sub(cam.pos, b.p), l = len(d) || 1e-6, m = b.r*(b.kind === 'sun' ? (C.sys.sun.type === 'hole' && b === C.sys.sun ? 5 : 2) : (C.kind === 'skim' || C.kind === 'sunrise') && b === C.subj ? 1.03 : 1.25);
    if (l < m) { const nrm = mul(d, 1/l); cam.pos = add(b.p, mul(nrm, m)); cam.vel = sub(cam.vel, mul(nrm, Math.min(0, dot(cam.vel, nrm)))); }
  }
}
function init(){
  C.sys = makeSystem(sysIndex(C.galaxy, 1, 0)); place(C.sys, C.T);
  const R = C.sys.R; Object.assign(C.cam, {pos: [R*.9, R*.35, -R*1.3], look: [0, 0, 0], vel: [0, 0, 0], lvel: [0, 0, 0]}); frame(C.cam);
  startShot('reveal');
}
// out to the galaxy: the system falls away to a point on its arm, the camera takes in the whole spiral, then dives to
// the next system's point and arrives there
export function galaxyTrip(to){
  if (C.warpDir || G.phase || !C.sys) return;
  C.building = false; C.prog = 0; C.lastJump = C.T; C.calm = false;
  G.target = to; G.from = galPos(C.sys.idx); G.to = galPos(to); G.phase = 'out'; G.t = 0;
  Object.assign(G.cam, {pos: add(G.from, [0, .5, -1.2]), look: [...G.from], vel: [0, 0, 0], lvel: [0, 0, 0], fov: C.cam.fov}); frame(G.cam);
  C.caption = 'Out to the galaxy';
}
function galaxy(dt){
  const CZ = TUNE.cosmos, mid = mul(add(G.from, G.to), .5); G.t += dt;
  if (G.phase === 'out') {   // pulling out, then looking across it from above
    G.on = Math.min(1, G.on + dt/CZ.galFade);
    follow(G.cam, {pos: add(mul(mid, .6), [0, 38, -52]), look: mul(mid, .6), fov: 60}, dt, .55, .9);
    if (G.t > CZ.galHoldSecs) { G.phase = 'in'; G.t = 0; C.caption = `Diving into the ${ARM_WORDS[Math.floor((((G.target % 1000) + 1000) % 1000)/300) % 3]} arm`; }
  } else if (G.phase === 'in') {   // diving to the next system's point
    follow(G.cam, {pos: add(G.to, [0, .4, -1]), look: G.to, fov: 55}, dt, .8, 1.4);
    if (len(sub(G.cam.pos, G.to)) < 2.5 || G.t > 9) { C.jumpTo = G.target; arrive(); C.warp = 0; C.warpDir = 0; G.phase = 'back'; }
  } else if ((G.on -= dt/CZ.galFade) <= 0) { G.on = 0; G.phase = null; }   // back into the system
  C.motion.z += ((G.phase === 'in' ? 1.5 : G.phase === 'out' ? -.5 : 0) - C.motion.z)*Math.min(1, dt*2);
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
  C.beatPh += dt/Math.max(.25, S.beatPeriod || .5);   // a pulsar's beams go round once a beat
  if (G.phase && G.phase !== 'back') { galaxy(dt); return; }   // out in the galaxy: the system waits
  surface(dt, x);
  if (G.phase) galaxy(dt);
  // the track's shape: tension climbing faster than its slow average is a build
  const T = J.tension || 0;
  C.tf += (T - C.tf)*Math.min(1, dt/CZ.buildFast); C.ts += (T - C.ts)*Math.min(1, dt/CZ.buildSlow);
  const b = C.tf > CZ.buildFloor ? Math.max(0, Math.min(1, (C.tf - C.ts)/CZ.buildSpan)) : 0;
  C.build += (b - C.build)*Math.min(1, dt*.8);
  if (J.on && J.type && J.type !== C.lastType) {   // the first section owns where the camera already is
    const was = C.lastType; C.lastType = J.type;
    if (was) onSection(J.type, T); else if (!J.type.cosmos) J.type.cosmos = {idx: C.sys.idx};
    dressFor(J.type, T);
  }
  const dr = C.dress, dw = dr.hand || dr.want, de = Math.min(1, dt*1.5);
  dr.cage += (dw.cage - dr.cage)*de; dr.motes += (dw.motes - dr.motes)*de;
  dr.spin += (dr.spinTo - dr.spin)*Math.min(1, dt*10); dr.burst *= Math.exp(-dt/.5);
  if (C.lastDrop === undefined) C.lastDrop = J.lastDrop;
  if (J.lastDrop !== C.lastDrop) { C.lastDrop = J.lastDrop; release(T); }
  if (!C.building && !C.warpDir && !held() && !SF.phase && C.build > CZ.buildStart && C.since > CZ.buildGrace) {   // (not while a track settles in)   // a build begins: drawn towards the biggest world near by
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
  if (quiet && !C.calm && !C.building && !C.warpDir && !held() && !SF.phase) { C.calm = true; startShot(C.r() < .5 ? 'drift' : 'orbit'); if (C.kind === 'orbit') C.caption = 'Circling in the quiet'; }
  if (C.calm && x.kickAgo < 400) { C.calm = false; C.bars = CZ.shotBars - 1; }
  if (!C.warpDir && !C.building && !held() && !SF.phase && C.st > CZ.maxShotSecs) nextShot(T);
  if (C.warpDir === 1) {   // into the jump: speeding straight ahead, the view widening
    C.warp = Math.min(1, C.warp + dt/CZ.warpUp);
    cam.vel = add(cam.vel, mul(cam.Z, dt*C.sys.R*.8*C.warp)); cam.pos = add(cam.pos, mul(cam.vel, dt)); cam.look = add(cam.pos, mul(cam.Z, 10));
    cam.fov += (CZ.fov + 40*C.warp - cam.fov)*Math.min(1, dt*4); clear(); frame(cam); motion(dt);
    if (C.warp >= 1) arrive();
    return;
  }
  if (C.warpDir === -1 && (C.warp -= dt/CZ.warpDown) <= 0) { C.warp = 0; C.warpDir = 0; }
  C.fovKick *= Math.exp(-dt*1.2);
  const f = C.fold, fo = f.hand ? 1 : f.bars > 0 && !G.phase ? 1 : 0; f.amt += (fo - f.amt)*Math.min(1, dt*TUNE.cosmos.fold.ease);
  const g = SHOTS[C.kind].goal(ctx(), C.shot, C.st), k = CZ.k[C.kind]*(.6 + .8*x.ts)*(C.calm ? CZ.quietSlow : 1);
  g.fov = (g.fov/55)*CZ.fov*(1 - CZ.pushNarrow*C.stretch) + 40*C.warp + C.fovKick - CZ.kick*(1 + C.build)*S.beat*x.react;   // the kick nudges the view in, harder in a build
  follow(cam, g, mdt, k, k*CZ.lookK);
  clear(); frame(cam); motion(dt);
}
export function flyBeat(pos){
  C.beatPh = 0;
  if (pos === 0 && C.fold.bars > 0) C.fold.bars--;   // a fold from a drop closes after its bars
  C.dress.spinTo += Math.PI/16; C.dress.bar = pos;   // the cage turns a notch each beat; its band runs down it once a bar
  if (!C.on || !C.sys || pos !== 0 || C.building || C.calm || held() || SF.phase) return;
  if (++C.bars >= TUNE.cosmos.shotBars && !C.warpDir) nextShot(C.lastT ?? .5);
}
// a centrepiece coming in stands as a monument in orbit, and the camera goes to circle it
export function monument(on){
  if (on && !C.monOn && C.sys && !C.warpDir && !C.building && !(held() && C.kind !== 'orbit')) { C.monOn = true; startShot('orbit', monBody()); C.caption = 'Circling the monument'; }
  C.monOn = on;
}
// the star's direction on screen, for the objects' light
export function lightFrom(P){
  const sun = C.sys.sun, s = project(C.cam, sun.p), d = s.z > 0 ? [s.x, s.y] : [-s.x, -s.y], l = Math.hypot(d[0], d[1]) || 1;
  C.light = {hue: P.pal[sun.slot] + sun.off, sat: .3 + sun.sat*.5, x: d[0]/l, y: d[1]/l};
}
