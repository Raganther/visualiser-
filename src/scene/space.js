// The space (a leaf module; docs/space-plan.md): one 3D stage the layers and the centrepiece share. Every object is drawn
// in the same frame (render/mesh.js's camera: object-centred, after its turn, the camera at z = CAM looking down -z, on
// screen pos + p.xy·size·FOCAL/(CAM − p.z)), so a layer that places something in it lights the object from where it is,
// and passes behind it or in front of it for real. The comets and the orbits' flares are lights circling the subject
// (fx/effects.js, layers/orbit.js); every kind of object adds the lights to its own (U.space, set in its params when it's
// the subject); what's in front of it is drawn over it after the objects (FRONT: render/gl.js and render/canvas2d.js).
import { TUNE } from '../tuning.js';
export const CAM = 3.2, FOCAL = 2.6, NL = 6;
export const SPACE = {
  on: 0, key: null, pos: [0, 0], size: 1, rad: .45,       // how much it's on (eased with the subject), the subject, where and how big on screen, its radius in its frame
  L: new Float32Array(NL*4), C: new Float32Array(NL*3), n: 0,   // the lights: where (x, y, z) and how bright; their colours
  front: [], nFront: 0,                                   // what's in front of the subject, drawn over it: [screen x, y, radius, r, g, b, alpha]
  hold: [],                                               // lights held in place each frame, for tests: {p, c, k}
  own: 1,                                                 // how much of each object's own lamps stays (the rig leading: 0)
  // the light rig (the bench, src/lab/bench.js; docs/space-plan.md): a key, a rim and a fill round the subject, each where it
  // stands (azimuth round it from the front, elevation, distance in its radii), its colour and how bright it is at the
  // object (its falloff made up for), on or off; own: how much of the object's own lamps stays while the rig is on
  rig: {on: 0, own: 0, n: 0, lights: [
    {name: 'key', on: 1, az: -.7, el: .45, dist: 3, c: [1, .9, .78], k: .9},
    {name: 'rim', on: 1, az: 2.6, el: .35, dist: 3, c: [.7, .82, 1], k: .8},
    {name: 'fill', on: 1, az: 1.1, el: -.25, dist: 3.5, c: [.85, .85, 1], k: .25}]},
};
// a rig light's place in the subject's frame
export const rigPos = (l, rad = SPACE.rad) => { const r = l.dist*rad, ce = Math.cos(l.el); return [r*ce*Math.sin(l.az), r*Math.sin(l.el), r*ce*Math.cos(l.az)]; };
// where the rig's lights stand, by name (the bench's buttons): az, el for the key, rim and fill
export const RIG_PRESETS = {
  'Three-point': [[-.7, .45], [2.6, .35], [1.1, -.25]],
  'Front': [[0, .15], [Math.PI, .3], [0, -.6]],
  'Side': [[-1.5, .1], [1.75, .2], [1.5, -.1]],
  'Back': [[3.0, .3], [-2.6, .35], [0, -.3]],
  'Below': [[-.3, -1.1], [2.8, .2], [.6, .5]],
  'Overhead': [[0, 1.4], [3.1, .5], [1.2, -.4]],
};
export function rigPreset(name){ const p = RIG_PRESETS[name]; if (!p) return; SPACE.rig.lights.forEach((l, i) => { l.az = p[i][0]; l.el = p[i][1]; }); }
// each frame, before the layers: from the subject (scene/subject.js), the lights cleared for the layers to place again
export function spaceBegin(sub, on){
  SPACE.on = on ? sub.on : 0; SPACE.key = SPACE.on > .02 ? sub.key : null;
  SPACE.pos[0] = sub.x; SPACE.pos[1] = sub.y; SPACE.size = sub.size || 1; SPACE.rad = sub.rad || .45;
  SPACE.L.fill(0); SPACE.C.fill(0); SPACE.n = 0; SPACE.nFront = 0;
  const R = SPACE.rig; SPACE.own = R.on ? R.own : 1; R.n = 0;
  if (R.on) for (const l of R.lights) if (l.on && l.k > 0) {   // the rig first (its lights always kept): as bright as asked at the object
    const p = rigPos(l), d = Math.hypot(p[0], p[1], p[2]) - SPACE.rad; spaceLight(p, l.c, l.k*(1 + d*d*TUNE.space.fall)/TUNE.space.light, true); R.n = SPACE.n; }
  for (const h of SPACE.hold) spaceLight(h.p, h.c, h.k);
}
// a point in the subject's frame, on screen: [x, y, how much nearer than the subject's middle (the perspective)]
export function spaceProj(p){ const dz = Math.max(.2, CAM - p[2]), k = SPACE.size*FOCAL/dz; return [SPACE.pos[0] + p[0]*k, SPACE.pos[1] + p[1]*k, CAM/dz]; }
// how many screen heights one unit of the frame is, at the subject's depth
export const spaceScale = () => SPACE.size*FOCAL/CAM;
// a light at p (the frame), colour c (rgb), brightness k; a layer's light only once the space is on. The brightest win
export function spaceLight(p, c, k, rig){
  k *= SPACE.on*TUNE.space.light; if (k < .01) return;
  let i = SPACE.n;
  if (i >= NL) { let lo = -1; for (let j = SPACE.rig.n; j < NL; j++) if (lo < 0 || SPACE.L[j*4 + 3] < SPACE.L[lo*4 + 3]) lo = j; if (lo < 0 || SPACE.L[lo*4 + 3] >= k) return; if (SPACE.L[lo*4 + 3] >= k) return; i = lo; } else SPACE.n++;
  SPACE.L.set([p[0], p[1], p[2], k], i*4); SPACE.C.set(c, i*3);
}
// something in front of the subject (z past its surface, inside its circle on screen), to draw over it: a glowing point
export function spaceFront(p, rad, c, a){
  if (!(SPACE.on > .02) || p[2] < 0) return;
  const s = spaceProj(p), R = SPACE.rad*spaceScale()*1.15;
  if (Math.hypot(s[0] - SPACE.pos[0], s[1] - SPACE.pos[1]) > R + rad) return;   // (off the object: the trails already show it)
  if (SPACE.nFront >= 24) return;
  const f = SPACE.front[SPACE.nFront] || (SPACE.front[SPACE.nFront] = new Float32Array(7));
  f.set([s[0], s[1], rad*s[2], c[0], c[1], c[2], a*SPACE.on]); SPACE.nFront++;
}
// is the frame's point p hidden by the subject (behind it, within its circle on screen)?
export function spaceHidden(p){
  if (!(SPACE.on > .02) || p[2] > 0) return 0;
  const s = spaceProj(p), R = SPACE.rad*spaceScale(), d = Math.hypot(s[0] - SPACE.pos[0], s[1] - SPACE.pos[1]);
  return Math.max(0, Math.min(1, (R*1.05 - d)/(R*.12)))*SPACE.on;
}
// the lights for an object's shader or its simple mode, when it's the subject (U.space); none otherwise
export const spaceFor = key => SPACE.on > .02 && SPACE.key === key && SPACE.n > 0 ? 1 : 0;
// the light falling on a point p with normal n in the frame (simple mode), into out [r, g, b]; with sh (a shininess), the
// highlight too, seen from the camera; skip: the first lights left out (the rig's, when an object takes them as its own)
export function spaceAt(p, n, out, sh = 0, spec = 1, skip = 0){
  out[0] = out[1] = out[2] = 0; const fall = TUNE.space.fall;
  let vx = -p[0], vy = -p[1], vz = CAM - p[2]; const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
  for (let i = skip; i < SPACE.n; i++) { const k = SPACE.L[i*4 + 3]; if (k <= 0) continue;
    let dx = SPACE.L[i*4] - p[0], dy = SPACE.L[i*4 + 1] - p[1], dz = SPACE.L[i*4 + 2] - p[2]; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const a = k/(1 + l*l*fall), nd = n[0]*dx + n[1]*dy + n[2]*dz; let d = Math.max(0, nd)*a;
    if (sh > 0 && nd > 0) { const hx = dx + vx, hy = dy + vy, hz = dz + vz, hl = Math.hypot(hx, hy, hz) || 1; d += Math.pow(Math.max(0, (n[0]*hx + n[1]*hy + n[2]*hz)/hl), sh)*a*spec; }
    out[0] += SPACE.C[i*3]*d; out[1] += SPACE.C[i*3 + 1]*d; out[2] += SPACE.C[i*3 + 2]*d; }
  return out;
}
// the same in GLSL, for the objects' shaders: uSL[6] (where, how bright), uSC[6] (colour), uSF (the falloff; 0: none)
// spaceSpec: the highlights the lights make, seen from the camera (sh: the shininess); uSO: how much of the object's own lamps
// stays (the rig leading: less); uSK: the first lights left out (the rig's, when the object took them as its own)
export const SPACE_GLSL = `uniform vec4 uSL[${NL}]; uniform vec3 uSC[${NL}]; uniform float uSF, uSO, uSK;
vec3 spaceAt(vec3 p, vec3 n){ vec3 c = vec3(0.0); if (uSF <= 0.0) return c;
  for (int i = 0; i < ${NL}; i++) { vec4 l = uSL[i]; if (l.w <= 0.0 || float(i) < uSK) continue; vec3 d = l.xyz - p; float dl = length(d);
    c += uSC[i]*l.w*max(dot(n, d/dl), 0.0)/(1.0 + dl*dl*uSF); }
  return c; }
vec3 spaceSpec(vec3 p, vec3 n, vec3 v, float sh){ vec3 c = vec3(0.0); if (uSF <= 0.0) return c;
  for (int i = 0; i < ${NL}; i++) { vec4 l = uSL[i]; if (l.w <= 0.0 || float(i) < uSK) continue; vec3 d = l.xyz - p; float dl = length(d); d /= dl;
    if (dot(n, d) <= 0.0) continue; c += uSC[i]*l.w*pow(max(dot(n, normalize(d + v)), 0.0), sh)/(1.0 + dl*dl*uSF); }
  return c; }`;
export function spaceUniforms(gl, u, on, skip = 0){
  if (u.uSO) gl.uniform1f(u.uSO, SPACE.own);
  if (u.uSK) gl.uniform1f(u.uSK, skip);
  if (!u.uSF) return;
  gl.uniform1f(u.uSF, on ? TUNE.space.fall : 0);
  if (on) { gl.uniform4fv(u['uSL[0]'] || u.uSL, SPACE.L); gl.uniform3fv(u['uSC[0]'] || u.uSC, SPACE.C); }
}
// the rig's lights as an object's own three (a lit object takes them, with its shadow from the key): [{p, c}], or null
export function rigLights(key){
  const R = SPACE.rig; if (!R.on || SPACE.key !== key || !(SPACE.on > .02)) return null;
  return R.lights.map(l => ({p: rigPos(l), c: l.c.map(v => v*(l.on ? l.k : 0)*2.2*SPACE.on)}));
}
