// Distance-field objects (a leaf module): shapes that flow, merge and split, ray-marched per pixel inside a square round
// each one on screen, in the mesh objects' camera (CAM, FOCAL from render/facet.js). Each object gives its own GLSL
// (map(p): the distance to it in its own frame; shade(...): its colour), built on a shared prelude: the ray, a march,
// normals, noise, a smooth union, three lamps and a studio reflected in the palette's colours. Simple mode marches the same
// shape on the CPU (each object has its map in JS too) at a few dozen rays across, laid over the picture smoothed.
import { CAM, FOCAL } from './facet.js';
import { SPACE_GLSL, spaceUniforms, spaceAt } from '../scene/space.js';

const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vS;
uniform vec4 uO;            // its centre on screen (px), the scale, the camera's distance
uniform mat3 uRi, uR;       // the view into its frame, and back
uniform vec4 uM1, uM2, uM3; // (t, kick, bass, hat), (stab, the drop's age, tension, run-up), (shatter, breakdown, weight, cover)
uniform vec4 uK, uK2;       // its own
uniform vec3 uC0, uC1, uC2, uLd;
uniform vec4 uBd[12];       // beads: centre, radius (0: none)
uniform vec4 uD[32];        // directions, each with a weight
uniform float uBR;          // its bounding sphere
${SPACE_GLSL}
uniform vec4 uQ;            // (the most march steps, ambient occlusion 0..1, its look: 0 own, 1 chrome, 2 glass, 3 neon, 4 iridescent, 5 toon; the look's strength)
#define TIME uM1.x
#define KICK uM1.y
#define BASS uM1.z
#define HAT uM1.w
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)))*43758.5453); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float beads(vec3 p, float k, int from, int to){ float d = 1e3;
  for (int i = 0; i < 12; i++) { if (i < from || i >= to) continue; vec4 b = uBd[i]; if (b.w > 0.0) d = smin(d, length(p - b.xyz) - b.w, k); }
  return d; }
// the studio, in view space: a dark floor, a horizon in the palette's colours, a bright sky, the key light as a strip
vec3 env(vec3 r){
  float y = r.y; vec3 c = y > 0.0 ? mix(uC1*0.35 + 0.05, vec3(0.75, 0.8, 0.9), smoothstep(0.15, 0.9, y)) : mix(vec3(0.015), uC0*0.25, exp(y*5.0));
  c += (uC1*0.8 + 0.2)*exp(-abs(y)*12.0)*0.8;
  c += smoothstep(0.93, 0.99, abs(sin(atan(r.x, r.z)*2.0 + TIME*0.05)))*smoothstep(0.25, 0.6, y)*0.7;
  c += vec3(1.5, 1.4, 1.2)*pow(max(dot(r, uLd), 0.0), 60.0)*2.0;
  return c; }
vec3 lamp(vec3 N, vec3 V, vec3 base, vec3 L, vec3 col, float spec, float shin){
  float d = max(dot(N, L), 0.0); float s = pow(max(dot(reflect(-L, N), V), 0.0), shin);
  return col*(base*d + spec*s); }
vec3 fillC(){ return uC2*(0.25 + 0.9*KICK); }
// lit: three lamps and the studio reflected (refl: how much; it rises at grazing angles)
vec3 lit(vec3 n, vec3 rd, vec3 base, float spec, float shin, float refl){
  vec3 N = normalize(uR*n), V = -normalize(uR*rd); float ndv = max(dot(N, V), 0.0), fr = 0.04 + 0.96*pow(1.0 - ndv, 5.0);
  vec3 c = base*(0.14 + 0.1*N.y);
  c += lamp(N, V, base, uLd, vec3(1.4, 1.3, 1.15), spec, shin) + lamp(N, V, base, normalize(vec3(-0.4, 0.5, -0.8)), vec3(0.6, 0.75, 1.1), spec, shin)
     + lamp(N, V, base, normalize(vec3(0.2, -0.8, 0.5)), fillC(), spec*0.5, shin);
  return c + env(reflect(-V, N))*refl*mix(0.25, 1.0, fr); }
float fres(vec3 n, vec3 rd){ return pow(1.0 - abs(dot(normalize(n), normalize(rd))), 3.0); }
float map(vec3 p);
vec4 shade(vec3 p, vec3 n, vec3 rd, float t);
float march(vec3 ro, vec3 rd, float t0, float t1){ float t = t0;
  for (int i = 0; i < STEPS; i++) { if (float(i) >= uQ.x) break; float d = map(ro + rd*t); if (d < 0.0012*t) return t; t += d*STEPK; if (t > t1) break; }
  return -1.0; }
// ambient occlusion: how much of the shape lies just off the surface, along its normal
float occl(vec3 p, vec3 n){ float o = 0.0, s = 1.0;
  for (int i = 1; i <= 4; i++) { float h = 0.035*float(i); o += (h - map(p + n*h))*s; s *= 0.6; }
  return clamp(1.0 - o*3.0, 0.0, 1.0); }
vec3 hue3(float h){ return 0.5 + 0.5*cos(6.2831*(h + vec3(0.0, 0.33, 0.67))); }
// the looks any solid one can wear over its own: chrome, glass, neon, iridescent, toon
vec4 look(vec4 own, vec3 p, vec3 n, vec3 rd){
  int k = int(uQ.z + 0.5); if (k == 0) return own;
  vec3 N = normalize(uR*n), V = -normalize(uR*rd); float ndv = max(dot(N, V), 0.0), f = pow(1.0 - ndv, 3.0); vec4 c = own;
  if (k == 1) c = vec4(lit(n, rd, vec3(0.05), 2.2, 160.0, 1.3)*mix(vec3(1.0), uC0*0.6 + 0.5, 0.3), 1.0);
  else if (k == 2) { vec3 r = env(reflect(-V, N))*(0.3 + 0.7*f) + uC1*(0.18 + 0.7*f) + own.rgb*0.25 + vec3(1.4, 1.3, 1.15)*pow(max(dot(reflect(-uLd, N), V), 0.0), 90.0)*1.5;
    c = vec4(r, 0.22 + 0.7*f); }
  else if (k == 3) { float ln = abs(fract(length(p)*9.0 - TIME*0.4) - 0.5), band = smoothstep(0.06, 0.0, ln - 0.02);
    c = vec4(vec3(0.008) + uC0*pow(f, 1.5)*2.2 + uC1*band*(0.5 + 1.2*KICK)*(0.35 + 0.65*ndv), 1.0); }
  else if (k == 4) { vec3 ir = hue3(ndv*1.4 + p.y*0.35 + TIME*0.04 + uC0.r*0.2); c = vec4(lit(n, rd, ir*0.45, 1.5, 90.0, 0.6) + ir*f*0.8, 1.0); }
  else if (k == 5) { float l = max(dot(N, uLd), 0.0); float band = l > 0.6 ? 1.0 : l > 0.2 ? 0.62 : 0.3;
    vec3 base = own.rgb/max(max(own.r, max(own.g, own.b)), 0.08);
    c = vec4(base*band*0.85 + vec3(1.0)*step(0.94, pow(max(dot(reflect(-uLd, N), V), 0.0), 8.0))*0.8, 1.0); c.rgb *= step(ndv, 0.28) > 0.5 ? 0.04 : 1.0; }
  return mix(own, c, uQ.w);
}
vec3 nrm(vec3 p){ vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy*map(p + e.xyy) + e.yyx*map(p + e.yyx) + e.yxy*map(p + e.yxy) + e.xxx*map(p + e.xxx)); }
`;
const MAIN = `
void main(){
  vec3 rdv = normalize(vec3((vS.x - uO.x)/uO.z, (uO.y - vS.y)/uO.z, -1.0)), ro = uRi*vec3(0.0, 0.0, uO.w), rd = uRi*rdv;
  float b = dot(ro, rd), c = dot(ro, ro) - uBR*uBR, h = b*b - c;
  if (h < 0.0) discard;
  h = sqrt(h);
  vec4 col = obj(ro, rd, max(-b - h, 0.0), -b + h);
  if (col.a < 0.003) discard;
  gl_FragColor = uM3.w > 0.5 ? vec4(1.0) : col*uM3.z;
}`;
const DEF_OBJ = `vec4 obj(vec3 ro, vec3 rd, float t0, float t1){ float t = march(ro, rd, t0, t1); if (t < 0.0) return vec4(0.0);
  vec3 p = ro + rd*t, n = nrm(p); vec4 c = look(shade(p, n, rd, t), p, n, rd);
  if (uQ.y > 0.01) c.rgb *= mix(1.0, occl(p, n), uQ.y);
  c.rgb += (c.rgb*0.8 + 0.1*c.a)*spaceAt(uR*p, normalize(uR*n))*1.3;   // the space's lights: a comet or a flare passing lights it (scene/space.js)
  return c; }`;
// (uBox: the square drawn into, in px: the screen, or a smaller picture of its own that's then laid over it)
const VS = `attribute vec2 aQ; uniform vec4 uBox; varying vec2 vS;
void main(){ vS = aQ; gl_Position = vec4((aQ.x - uBox.x)/uBox.z*2.0 - 1.0, 1.0 - (aQ.y - uBox.y)/uBox.w*2.0, 0.0, 1.0); }`;
const LAYVS = `attribute vec2 aQ; uniform vec4 uScr; varying vec2 vS;
void main(){ vS = aQ; gl_Position = vec4(aQ.x/uScr.z*2.0 - 1.0, 1.0 - aQ.y/uScr.w*2.0, 0.0, 1.0); }`;
// laying it over: its own picture, kept at half brightness so highlights past white survive for the glow
const LAY = `precision mediump float; varying vec2 vS; uniform vec4 uBox, uUV; uniform sampler2D uT;
void main(){ vec2 q = vec2((vS.x - uBox.x)/uBox.z, (vS.y - uBox.y)/uBox.w)*uUV.xy; gl_FragColor = texture2D(uT, vec2(q.x, 1.0 - q.y))*2.0; }`;
export const sdfSource = (o) => `#define STEPS ${o.steps || 80}\n#define STEPK ${(o.stepK || .8).toFixed(2)}\n` + HEAD + o.glsl + (o.custom ? '' : DEF_OBJ) + MAIN;

// ---- WebGL: one program an object, started at idle (sdfWarm) and used once the driver has built it ----
const UN = ['uBox', 'uQ', 'uO', 'uRi', 'uR', 'uM1', 'uM2', 'uM3', 'uK', 'uK2', 'uC0', 'uC1', 'uC2', 'uLd', 'uBd', 'uD', 'uBR', 'uSF', 'uSL', 'uSC'];
const OBJS = new Map(), progs = new Map();
let progGen = -1, quad = null, lay = null, off = null;
export const sdfRegister = o => OBJS.set(o.key, o);
function start(gl, o){
  const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
  const p = gl.createProgram(), vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, sdfSource(o));
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 1, 'aQ'); gl.linkProgram(p);   // (attribute 0 stays the engine's quad)
  const e = {p, vs, fs, u: null, failed: false}; progs.set(o.key, e); return e;
}
function ready(gl, e){
  if (e.u) return true; if (e.failed) return false;
  const x = gl.getExtension('KHR_parallel_shader_compile');
  if (x && !gl.getProgramParameter(e.p, x.COMPLETION_STATUS_KHR)) return false;   // (still building: waiting froze the picture)
  if (!gl.getProgramParameter(e.p, gl.LINK_STATUS)) { e.failed = true; console.error('sdf:', gl.getShaderInfoLog(e.fs) || gl.getProgramInfoLog(e.p)); return false; }
  e.u = {}; for (const k of UN) e.u[k] = gl.getUniformLocation(e.p, k); return true;
}
const fresh = (gl, gen) => { if (gen !== progGen) { progs.clear(); quad = lay = off = null; progGen = gen; } };
export function sdfWarm(gl, gen){ fresh(gl, gen); for (const o of OBJS.values()) if (!progs.has(o.key)) start(gl, o); }
// U: {w, size, pos, R (object → view, row-major 3×3), M1, M2, M3, K, K2, C0, C1, C2, Ld, Bd (12×4), D (32×4), br, Q (steps, ao, look, its strength), res (the share of its pixels marched)}
export function sdfDraw(gl, gen, o, U, W, H, stage){
  fresh(gl, gen);
  const e = progs.get(o.key) || start(gl, o); if (!ready(gl, e)) return;
  const sc = H*U.size*FOCAL, ox = W/2 + U.pos[0]*H, oy = H/2 - U.pos[1]*H, r = U.br*sc/Math.sqrt(Math.max(.1, CAM*CAM - U.br*U.br))*1.04;
  const x0 = ox - r, y0 = oy - r, sz = 2*r, res = stage === 'cover' ? 1 : Math.max(.25, Math.min(1, U.res || 1));
  if (!quad) quad = gl.createBuffer();
  const box = new Float32Array([x0, y0, x0 + sz, y0, x0, y0 + sz, x0, y0 + sz, x0 + sz, y0, x0 + sz, y0 + sz]);
  // smaller than the screen: marched into a picture of its own, a share of its pixels across, then laid over smoothed
  const small = res < .99 && sz > 8 && offscreen(gl, Math.ceil(sz*res));
  let fb0, vp0;
  if (small) { fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING); vp0 = gl.getParameter(gl.VIEWPORT); const cc = gl.getParameter(gl.COLOR_CLEAR_VALUE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, off.fb); gl.viewport(0, 0, off.n, off.n); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.clearColor(cc[0], cc[1], cc[2], cc[3]); }
  gl.useProgram(e.p); const u = e.u, n = small ? Math.ceil(sz*res) : 0;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, box, gl.DYNAMIC_DRAW);
  // (into its own picture the box fills the part of it in use, n of off.n pixels: the rest stays clear)
  if (small) gl.uniform4f(u.uBox, x0, y0, sz*off.n/n, sz*off.n/n); else gl.uniform4f(u.uBox, 0, 0, W, H);
  gl.uniform4f(u.uO, ox, oy, sc, CAM); gl.uniform4fv(u.uQ, U.Q || [80, 0, 0, 1]);
  gl.uniformMatrix3fv(u.uRi, false, U.R); gl.uniformMatrix3fv(u.uR, false, tr(U.R));   // (column-major: a row-major R reads as its transpose)
  gl.uniform4fv(u.uM1, U.M1); gl.uniform4fv(u.uM2, U.M2); gl.uniform4f(u.uM3, U.M3[0], U.M3[1], U.w*(small ? .5 : 1), stage === 'cover' ? 1 : 0);
  gl.uniform4fv(u.uK, U.K); gl.uniform4fv(u.uK2, U.K2); gl.uniform3fv(u.uC0, U.C0); gl.uniform3fv(u.uC1, U.C1); gl.uniform3fv(u.uC2, U.C2); gl.uniform3fv(u.uLd, U.Ld); spaceUniforms(gl, u, U.space);
  if (u.uBd) gl.uniform4fv(u.uBd, U.Bd); if (u.uD) gl.uniform4fv(u.uD, U.D); gl.uniform1f(u.uBR, U.br);
  gl.disableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  if (small) gl.blendFunc(gl.ONE, gl.ZERO); else if (stage === 'cover') gl.blendFunc(gl.ONE, gl.ZERO); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  if (small) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb0); gl.viewport(vp0[0], vp0[1], vp0[2], vp0[3]);
    gl.useProgram(lay.p); gl.uniform4f(lay.uBox, x0, y0, sz, sz); gl.uniform4f(lay.uBox2, 0, 0, W, H); gl.uniform4f(lay.uUV, n/off.n, n/off.n, 0, 0);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, off.tex); gl.uniform1i(lay.uT, 4); gl.activeTexture(gl.TEXTURE0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.disableVertexAttribArray(1); gl.enableVertexAttribArray(0); gl.disable(gl.BLEND);
}
// its own picture (one, grown as needed), and the program that lays it over the screen
function offscreen(gl, need){
  if (!lay) { const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, LAYVS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, LAY)); gl.bindAttribLocation(p, 1, 'aQ'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { lay = {failed: true}; return false; }
    lay = {p, uBox: gl.getUniformLocation(p, 'uBox'), uBox2: gl.getUniformLocation(p, 'uScr'), uUV: gl.getUniformLocation(p, 'uUV'), uT: gl.getUniformLocation(p, 'uT')}; }
  if (lay.failed) return false;
  if (!off || off.n < need) {
    const n = Math.min(2048, Math.ceil(need/64)*64), tex = off ? off.tex : gl.createTexture(), fb = off ? off.fb : gl.createFramebuffer();
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.activeTexture(gl.TEXTURE0);
    const fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const okFb = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, fb0);
    off = {tex, fb, n}; if (!okFb) { lay = {failed: true}; return false; } }
  return need <= off.n;
}
const tr = R => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];

// ---- simple mode: the same shape marched on the CPU, N rays across its square ----
const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const nz = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const ROT = (R, v) => [R[0]*v[0] + R[1]*v[1] + R[2]*v[2], R[3]*v[0] + R[4]*v[1] + R[5]*v[2], R[6]*v[0] + R[7]*v[1] + R[8]*v[2]];
const ROTT = (R, v) => [R[0]*v[0] + R[3]*v[1] + R[6]*v[2], R[1]*v[0] + R[4]*v[1] + R[7]*v[2], R[2]*v[0] + R[5]*v[1] + R[8]*v[2]];
// the studio and lamps, as in the shader (N, V in view space)
export function env2d(r, U){
  const y = r[1], c = [0, 0, 0];
  for (let i = 0; i < 3; i++) { c[i] = y > 0 ? (U.C1[i]*.35 + .05)*(1 - Math.min(1, y*1.3)) + [.75, .8, .9][i]*Math.min(1, y*1.3) : .015 + (U.C0[i]*.25 - .015)*Math.exp(y*5);
    c[i] += (U.C1[i]*.8 + .2)*Math.exp(-Math.abs(y)*12)*.8 + [1.5, 1.4, 1.2][i]*Math.max(0, r[0]*U.Ld[0] + r[1]*U.Ld[1] + r[2]*U.Ld[2])**60*2; }
  return c;
}
const LR = nz([-.4, .5, -.8]), LF = nz([.2, -.8, .5]);
export function lit2d(n, rd, base, spec, shin, refl, U){
  const N = nz(ROT(U.R, n)), V = ROT(U.R, rd).map(v => -v), ndv = Math.max(0, N[0]*V[0] + N[1]*V[1] + N[2]*V[2]), fr = .04 + .96*(1 - ndv)**5;
  const kick = U.M1[1], c = base.map(b => b*(.14 + .1*N[1]));
  const lamp = (L, col) => { const d = Math.max(0, N[0]*L[0] + N[1]*L[1] + N[2]*L[2]), rl = [2*d*N[0] - L[0], 2*d*N[1] - L[1], 2*d*N[2] - L[2]];
    const s = Math.max(0, rl[0]*V[0] + rl[1]*V[1] + rl[2]*V[2])**shin; for (let i = 0; i < 3; i++) c[i] += col[i]*(base[i]*d + spec*s); };
  lamp(U.Ld, [1.4, 1.3, 1.15]); lamp(LR, [.6, .75, 1.1]); lamp(LF, U.C2.map(v => v*(.25 + .9*kick)));
  const dv = 2*ndv, R = [dv*N[0] - V[0], dv*N[1] - V[1], dv*N[2] - V[2]], e = env2d(R, U), k = refl*(.25 + .75*fr);
  return [c[0] + e[0]*k, c[1] + e[1]*k, c[2] + e[2]*k];
}
const SPO = [0, 0, 0];
export const fres2d = (n, rd) => (1 - Math.abs(n[0]*rd[0] + n[1]*rd[1] + n[2]*rd[2]))**3;
// o: the canvas; map(x, y, z): the distance; tint(p, n, rd, t): [r, g, b, a], premultiplied
export function sdf2d(o, U, map, tint, N = 44){
  const W = o.canvas.width, H = o.canvas.height, sc = H*U.size*FOCAL, ox = W/2 + U.pos[0]*H, oy = H/2 - U.pos[1]*H;
  const r = U.br*sc/Math.sqrt(Math.max(.1, CAM*CAM - U.br*U.br))*1.04, br2 = U.br*U.br;
  if (cv.width !== N) { cv.width = cv.height = N; }
  const pw = 2*r/N/sc*.9, g = cv.getContext('2d'), img = g.createImageData(N, N), D = img.data, ro = ROTT(U.R, [0, 0, CAM]);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const px = ox - r + (i + .5)/N*2*r, py = oy - r + (j + .5)/N*2*r, rd = ROTT(U.R, nz([(px - ox)/sc, (oy - py)/sc, -1]));
    const b = ro[0]*rd[0] + ro[1]*rd[1] + ro[2]*rd[2], h = b*b - (ro[0]*ro[0] + ro[1]*ro[1] + ro[2]*ro[2] - br2);
    if (h < 0) continue;
    const t1 = -b + Math.sqrt(h); let t = Math.max(0, -b - Math.sqrt(h)), hit = false, md = 9, mt = t;
    for (let k = 0; k < 40; k++) { const d = map(ro[0] + rd[0]*t, ro[1] + rd[1]*t, ro[2] + rd[2]*t); if (d < .004*t) { hit = true; break; } if (d < md) { md = d; mt = t; } t += d*.85; if (t > t1) break; }
    let cov = 1;   // (a ray passing close by gives a soft edge: its share of the cell)
    if (!hit) { cov = 1 - md/(pw*mt); if (cov <= 0) continue; t = mt; }
    const x = ro[0] + rd[0]*t, y = ro[1] + rd[1]*t, z = ro[2] + rd[2]*t, e = .01;
    const n = nz([map(x + e, y, z) - map(x - e, y, z), map(x, y + e, z) - map(x, y - e, z), map(x, y, z + e) - map(x, y, z - e)]);
    const c = tint([x, y, z], n, rd, t), a = Math.min(1, c[3]*U.w*cov), q = (j*N + i)*4;
    if (U.space) { spaceAt(ROT(U.R, [x, y, z]), ROT(U.R, n), SPO); for (let k = 0; k < 3; k++) c[k] += (c[k]*.8 + .1*c[3])*SPO[k]*1.3; }   // the space's lights
    if (a < .004) continue;
    const m = U.w*cov/a*255; D[q] = Math.min(255, c[0]*m); D[q + 1] = Math.min(255, c[1]*m); D[q + 2] = Math.min(255, c[2]*m); D[q + 3] = a*255;
  }
  g.putImageData(img, 0, 0);
  o.save(); o.imageSmoothingEnabled = true; o.drawImage(cv, ox - r, oy - r, 2*r, 2*r); o.restore();
}
// its outline for masks (a circle as big as it is now)
export function sdfPath2d(o, U, rad){
  const H = o.canvas.height, W = o.canvas.width, sc = H*U.size*FOCAL, ox = W/2 + U.pos[0]*H, oy = H/2 - U.pos[1]*H;
  o.beginPath(); o.arc(ox, oy, rad*sc/Math.sqrt(Math.max(.1, CAM*CAM - rad*rad)), 0, Math.PI*2);
}
// the looks in simple mode, plainer (k: 1 chrome, 2 glass, 3 neon, 4 iridescent, 5 toon)
export function look2d(c, p, n, rd, U, k){
  if (!k) return c;
  const N = nz(ROT(U.R, n)), V = ROT(U.R, rd).map(v => -v), ndv = Math.max(0, N[0]*V[0] + N[1]*V[1] + N[2]*V[2]), f = (1 - ndv)**3, hue = h => [0, .33, .67].map(o => .5 + .5*Math.cos(6.2831*(h + o)));
  if (k === 1) { const l = lit2d(n, rd, [.05, .05, .05], 2.2, 160, 1.3, U); return [l[0]*(.7 + .3*(U.C0[0]*.6 + .5)), l[1]*(.7 + .3*(U.C0[1]*.6 + .5)), l[2]*(.7 + .3*(U.C0[2]*.6 + .5)), 1]; }
  if (k === 2) { const l = lit2d(n, rd, [0, 0, 0], 1.5, 90, 1, U); return [0, 1, 2].map(i => l[i]*(.15 + .85*f) + U.C1[i]*(.08 + .5*f)).concat(.22 + .7*f); }
  if (k === 3) { const ln = Math.abs(((Math.hypot(...p)*9 - U.M1[0]*.4) % 1 + 1) % 1 - .5), band = Math.max(0, 1 - Math.max(0, ln - .02)/.06)*(.5 + 1.2*U.M1[1])*(.35 + .65*ndv);
    return [0, 1, 2].map(i => .008 + U.C0[i]*f**(1/2)*1.6 + U.C1[i]*band).concat(1); }
  if (k === 4) { const ir = hue(ndv*1.4 + p[1]*.35 + U.M1[0]*.04), l = lit2d(n, rd, ir.map(v => v*.45), 1.5, 90, .6, U); return [0, 1, 2].map(i => l[i] + ir[i]*f*.8).concat(1); }
  if (k === 5) { const l = Math.max(0, N[0]*U.Ld[0] + N[1]*U.Ld[1] + N[2]*U.Ld[2]), band = ndv < .28 ? .04 : l > .6 ? 1 : l > .2 ? .62 : .3, m = Math.max(c[0], c[1], c[2], .08);
    return [c[0]/m*band*.85, c[1]/m*band*.85, c[2]/m*band*.85, 1]; }
  return c;
}
