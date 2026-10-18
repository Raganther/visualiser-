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
};
// each frame, before the layers: from the subject (scene/subject.js), the lights cleared for the layers to place again
export function spaceBegin(sub, on){
  SPACE.on = on ? sub.on : 0; SPACE.key = SPACE.on > .02 ? sub.key : null;
  SPACE.pos[0] = sub.x; SPACE.pos[1] = sub.y; SPACE.size = sub.size || 1; SPACE.rad = sub.rad || .45;
  SPACE.L.fill(0); SPACE.C.fill(0); SPACE.n = 0; SPACE.nFront = 0;
  for (const h of SPACE.hold) spaceLight(h.p, h.c, h.k);
}
// a point in the subject's frame, on screen: [x, y, how much nearer than the subject's middle (the perspective)]
export function spaceProj(p){ const dz = Math.max(.2, CAM - p[2]), k = SPACE.size*FOCAL/dz; return [SPACE.pos[0] + p[0]*k, SPACE.pos[1] + p[1]*k, CAM/dz]; }
// how many screen heights one unit of the frame is, at the subject's depth
export const spaceScale = () => SPACE.size*FOCAL/CAM;
// a light at p (the frame), colour c (rgb), brightness k; a layer's light only once the space is on. The brightest win
export function spaceLight(p, c, k){
  k *= SPACE.on*TUNE.space.light; if (k < .01) return;
  let i = SPACE.n;
  if (i >= NL) { let lo = 0; for (let j = 1; j < NL; j++) if (SPACE.L[j*4 + 3] < SPACE.L[lo*4 + 3]) lo = j; if (SPACE.L[lo*4 + 3] >= k) return; i = lo; } else SPACE.n++;
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
// the light falling on a point p with normal n in the frame (simple mode), into out [r, g, b]
export function spaceAt(p, n, out){
  out[0] = out[1] = out[2] = 0; const fall = TUNE.space.fall;
  for (let i = 0; i < SPACE.n; i++) { const k = SPACE.L[i*4 + 3]; if (k <= 0) continue;
    const dx = SPACE.L[i*4] - p[0], dy = SPACE.L[i*4 + 1] - p[1], dz = SPACE.L[i*4 + 2] - p[2], l = Math.hypot(dx, dy, dz) || 1;
    const d = Math.max(0, (n[0]*dx + n[1]*dy + n[2]*dz)/l)*k/(1 + l*l*fall);
    out[0] += SPACE.C[i*3]*d; out[1] += SPACE.C[i*3 + 1]*d; out[2] += SPACE.C[i*3 + 2]*d; }
  return out;
}
// the same in GLSL, for the objects' shaders: uSL[6] (where, how bright), uSC[6] (colour), uSF (the falloff; 0: none)
export const SPACE_GLSL = `uniform vec4 uSL[${NL}]; uniform vec3 uSC[${NL}]; uniform float uSF;
vec3 spaceAt(vec3 p, vec3 n){ vec3 c = vec3(0.0); if (uSF <= 0.0) return c;
  for (int i = 0; i < ${NL}; i++) { vec4 l = uSL[i]; if (l.w <= 0.0) continue; vec3 d = l.xyz - p; float dl = length(d);
    c += uSC[i]*l.w*max(dot(n, d/dl), 0.0)/(1.0 + dl*dl*uSF); }
  return c; }`;
export function spaceUniforms(gl, u, on){
  if (!u.uSF && u.uSF !== 0) return;
  gl.uniform1f(u.uSF, on ? TUNE.space.fall : 0);
  if (on) { gl.uniform4fv(u['uSL[0]'] || u.uSL, SPACE.L); gl.uniform3fv(u['uSC[0]'] || u.uSC, SPACE.C); }
}
