// The camera: a point of view moving through a 3D place, and the shots it knows. It follows each shot's goal on springs,
// so any change of shot eases in and out with no cuts to plan. A leaf module: any place (space now, the land or the
// city later) hands it a subject and gets a camera path back.

export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
  dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
  cross: (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; },
};
const {add, sub, mul, dot, cross, norm} = V;
const ease = x => { x = Math.min(1, Math.max(0, x)); return x*x*(3 - 2*x); };

export const makeCamera = () => ({pos: [0, 0, -30], vel: [0, 0, 0], look: [0, 0, 0], lvel: [0, 0, 0], fov: 55, X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1]});
// critically damped springs toward the goal ({pos, look, fov}); k: how quickly (per second), the look a little quicker
export function follow(cam, goal, dt, k, kLook){
  spring(cam.pos, cam.vel, goal.pos, k, dt); spring(cam.look, cam.lvel, goal.look, kLook, dt);
  cam.fov += (goal.fov - cam.fov)*Math.min(1, dt*1.5);
  frame(cam);
}
function spring(x, v, g, k, dt){
  const n = Math.max(1, Math.ceil(dt*k/.15)), h = dt/n;   // small steps, so a stiff spring stays stable
  for (let s = 0; s < n; s++) for (let i = 0; i < 3; i++) { v[i] += (k*k*(g[i] - x[i]) - 2*k*v[i])*h; x[i] += v[i]*h; }
}
// the camera's own axes: Z where it looks, X to its right, Y up
export function frame(cam){
  const Z = norm(sub(cam.look, cam.pos)); let X = cross([0, 1, 0], Z);
  if (V.len(X) < 1e-3) X = cross([0, 0, 1], Z);
  cam.Z = Z; cam.X = norm(X); cam.Y = cross(Z, cam.X);
}
// a point on screen, in the shaders' units (the screen is 1 high, 0 in the middle, y up), and how big a unit looks there
export function project(cam, p){
  const r = sub(p, cam.pos), z = dot(r, cam.Z), k = 1/(2*Math.tan(cam.fov*Math.PI/360)*Math.max(z, 1e-4));
  return {x: dot(r, cam.X)*k, y: dot(r, cam.Y)*k, z, s: k};
}
// two axes square to a (for circling round it)
export const around = a => { const u = norm(cross(Math.abs(a[1]) < .9 ? [0, 1, 0] : [1, 0, 0], a)); return [u, cross(a, u)]; };

// The shots. Each is set up once (start: its fixed choices, from where the camera is now) and then gives a goal each
// moment (t: seconds of motion time into it). A subject is {p, r, axis} (a body, moving); sys is {p, R} (the whole place);
// sun is the light's position. s: the shot's own random numbers, 0..1
export const SHOTS = {
  // circle the subject, a little above its equator
  orbit: {
    start: (c, s) => { const [u, v] = around(c.subj.axis), d = sub(c.cam.pos, c.subj.p);   // from where the camera already is
      return {a0: Math.atan2(dot(d, v), dot(d, u)), dist: 3 + s[0]*2, h: .3 + s[1]*.6, dir: s[2] < .5 ? -1 : 1}; },
    goal: (c, st, t) => {
      const {p, r, axis} = c.subj, [u, v] = around(axis), a = st.a0 + t*.1*st.dir;
      return {pos: add(p, add(add(mul(u, Math.cos(a)*r*st.dist), mul(v, Math.sin(a)*r*st.dist)), mul(axis, r*st.h))), look: p, fov: 50};
    },
  },
  // come in on the subject from where the camera is, until it fills much of the view, set a little off centre
  approach: {
    start: (c, s) => ({dir: norm(sub(c.cam.pos, c.subj.p)), side: s[0] < .5 ? -1 : 1, dur: 14 + s[1]*10}),
    goal: (c, st, t) => {
      const {p, r} = c.subj, d = r*(10 - 7.6*ease(t/st.dur)), side = norm(cross(st.dir, [0, 1, 0]));
      return {pos: add(p, add(mul(st.dir, d), mul([0, 1, 0], r*.6))), look: add(p, mul(side, r*.7*st.side)), fov: 48};
    },
  },
  // pass close by the subject, turning to follow it
  flyby: {
    start: (c, s) => { const d = norm(sub(c.subj.p, c.cam.pos)); return {d, side: norm(cross(d, [0, s[0] < .5 ? 1 : -1, 0])), dur: 10 + s[1]*6}; },
    goal: (c, st, t) => {
      const {p, r} = c.subj, x = (t/st.dur - .5)*2;
      return {pos: add(p, add(mul(st.side, r*2.6), mul(st.d, r*14*x))), look: p, fov: 58};
    },
  },
  // pull back to take in the whole system
  reveal: {
    start: (c, s) => ({a: s[0]*Math.PI*2, h: .18 + s[1]*.22}),
    goal: (c, st, t) => {
      const {p, R} = c.sys, a = st.a + t*.015;
      return {pos: add(p, [Math.cos(a)*R*.8, R*st.h, Math.sin(a)*R*.8]), look: p, fov: 60};
    },
  },
  // the subject between the camera and the star, its edge lit and the star's glow round it
  eclipse: {
    start: (c, s) => ({dist: 5 + s[0]*3, lift: (s[1] - .5)*.8, a: (s[2] - .5)*.3}),
    goal: (c, st, t) => {
      const {p, r} = c.subj, away = norm(sub(p, c.sun)), side = norm(cross(away, [0, 1, 0])), w = st.a + t*.01;
      const dir = norm(add(mul(away, Math.cos(w)), mul(side, Math.sin(w))));
      return {pos: add(p, add(mul(dir, r*st.dist), [0, r*st.lift, 0])), look: p, fov: 50};
    },
  },
  // float through the system along its plane, looking ahead
  drift: {
    start: (c, s) => { const f = c.cam.Z, d = Math.hypot(f[0], f[2]) > .05 ? norm([f[0], 0, f[2]]) : [1, 0, 0]; return {from: [...c.cam.pos], d, turn: (s[0] - .5)*.04}; },
    goal: (c, st, t) => {
      const a = st.turn*t, d = [st.d[0]*Math.cos(a) - st.d[2]*Math.sin(a), 0, st.d[0]*Math.sin(a) + st.d[2]*Math.cos(a)];
      const pos = add(st.from, mul(d, c.sys.R*.012*t));
      return {pos, look: add(pos, add(mul(d, 20), [0, -1.5, 0])), fov: 60};
    },
  },
};
