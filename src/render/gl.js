// WebGL renderer: context, framebuffers, the feedback and display passes, and the choice between WebGL and simple mode.
import { NP, parts } from '../fx/particles.js';
import { make2D } from './canvas2d.js';
import { composeDisplay, composeFeedback } from './compose.js';
import { PFRAG, PVERT, VERT } from './shaders.js';
import { LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { HIST, dataArr } from '../state.js';
import { toast } from '../ui/toast.js';
import { $ } from '../util.js';

let canvas = $('#gl');
export let gl = null;
function compile(type, src){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(fs, vs){
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs || VERT));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return {p, u};
}
let pProg = null, pBuf = null, quadBuf = null, histTex = null;
export let fbProg = null, dispProg = null, fbos = [], cur = 0, W = 1, H = 1, dataTex = null, r2d = null;
function makeTex(w, h){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function setupGL(){
  fbProg = program(composeFeedback()); dispProg = program(composeDisplay()); pProg = program(PFRAG, PVERT);
  pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, 600*3*4, gl.DYNAMIC_DRAW);
  const quad = quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  histTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, histTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  dataTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, dataTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 512, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, dataArr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL setup error');
}
// half-size targets for a scene's fills and masks, made when a scene first needs them
let fills = {}, mask = null;
function halfTarget(){
  const w = Math.max(1, W >> 1), h = Math.max(1, H >> 1), tex = makeTex(w, h), fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return {tex, fb, w, h};
}
function glResize(){
  [...Object.values(fills), mask].forEach(t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }); fills = {}; mask = null;
  fbos.forEach(f => { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); });
  fbos = [0,1].map(() => {
    const tex = makeTex(W, H), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
    return {tex, fb};
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
export function drawGL(now, P){
  const src = fbos[cur], dst = fbos[1-cur];
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0,0,W,H);
  gl.useProgram(fbProg.p); const u = fbProg.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(u.uPrev, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dataTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, dataArr);
  gl.uniform1i(u.uData, 1);
  gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uCenter, P.cx, P.cy);
  gl.uniform1f(u.uTime, now/1000);
  gl.uniform1f(u.uZoom, P.zoom); gl.uniform1f(u.uRot, P.rot); gl.uniform1f(u.uWarp, P.warp);
  gl.uniform1f(u.uDecay, P.decay);
  gl.uniform1f(u.uSym, P.sym); gl.uniform1f(u.uMirror, P.mirror);
  gl.uniform1f(u.uHue, P.hue); gl.uniform1f(u.uHueShift, P.hueShift);
  gl.uniform1f(u.uBass, P.bass); gl.uniform1f(u.uMid, P.mid); gl.uniform1f(u.uTreb, P.treb);
  gl.uniform1f(u.uBeat, P.beat); gl.uniform1f(u.uReact, P.react); gl.uniform1f(u.uHit, P.hit); gl.uniform1f(u.uFillMode, 0);
  for (const l of LAYER_VISUALS) if (l.feedback) gl.uniform1f(u['uL_' + l.key], P.l[l.key]);
  for (const vis of VISUALS) if (vis.fbUniforms) vis.fbUniforms(gl, u, P);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (P.l.flow > .01) {   // flow-field particles, drawn into the trails so they leave streaks (kept here: they need their own program)
    gl.useProgram(pProg.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, parts);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(pProg.u.uScale, 2/(W/H), 2); gl.uniform1f(pProg.u.uSize, Math.max(2, H/320));
    gl.uniform3fv(pProg.u.uCol, P.flowCol);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, 0, NP); gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  const meshes = OBJECT_VISUALS.filter(o => o.drawGL && P.o[o.key] > .003);   // mesh objects (their own programs)
  for (const o of meshes) o.drawGL(gl, P, W, H, 'trails');
  // the scene's fills: the chosen layers alone, through the kaleidoscope, drawn by the trails' own shader in fill mode
  const sc = P.sc;
  for (const key in sc.fills) if (P.o[key] > .003) {
    const f = sc.fills[key], t = fills[key] || (fills[key] = halfTarget());
    gl.useProgram(fbProg.p); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h);
    gl.uniform1f(u.uFillMode, 1); gl.uniform1f(u.uFillGain, TUNE.scene.fillGain); gl.uniform1f(u.uFillZoom, f.zoom || TUNE.scene.fillZoom); gl.uniform1f(u.uSym, f.kaleido); gl.uniform1f(u.uMirror, 0);
    for (const l of LAYER_VISUALS) if (l.feedback) gl.uniform1f(u['uL_' + l.key], f.layers.includes(l.key) ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.uniform1f(u.uFillMode, 0);
    P.m[key].fillTex = t.tex; P.m[key].fillAmt = TUNE.scene.fillAmt;
  }
  // the scene's mask: an object's silhouette, which the trails are shown inside (or outside) of
  const masked = sc.mask && byKey[sc.mask.object] && P.o[sc.mask.object] > .003;
  if (masked) {
    mask = mask || halfTarget();
    gl.bindFramebuffer(gl.FRAMEBUFFER, mask.fb); gl.viewport(0, 0, mask.w, mask.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    byKey[sc.mask.object].drawGL(gl, P, W, H, 'cover');
  }
  cur = 1 - cur;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0,0,W,H);
  gl.useProgram(dispProg.p); const v = dispProg.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dst.tex);
  gl.uniform1i(v.uTex, 0); gl.uniform2f(v.uRes, W, H);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, histTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, HIST);
  gl.uniform1i(v.uHist, 1);
  gl.uniform1f(v.uTime, now/1000); gl.uniform1f(v.uHue, P.hue); gl.uniform1f(v.uBass, P.bass); gl.uniform1f(v.uMid, P.mid);
  gl.uniform1f(v.uBeat, P.beat); gl.uniform1f(v.uReact, P.react);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dataTex); gl.uniform1i(v.uData, 2);
  for (const w of WORLD_VISUALS) gl.uniform1f(v['uW_' + w.key], P.w[w.key]);
  for (const o of OBJECT_VISUALS) if (o.glsl) gl.uniform1f(v['uO_' + o.key], P.o[o.key]);
  for (const vis of VISUALS) if (vis.uniforms) vis.uniforms(gl, v, P);
  gl.uniform1f(v.uMaskOn, masked ? 1 : 0); gl.uniform1f(v.uBetween, sc.between ? 1 : 0);
  if (masked) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, mask.tex); gl.uniform1i(v.uMask, 5); gl.uniform1f(v.uMaskIn, sc.mask.inside ? 1 : 0); }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  for (const o of meshes) o.drawGL(gl, P, W, H, 'screen');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
// pick WebGL if it works, otherwise the simple 2D renderer
export function initRenderer(){
  for (const type of ['webgl2', 'webgl', 'experimental-webgl']) {
    try { gl = canvas.getContext(type, {antialias:false, alpha:false, premultipliedAlpha:false, depth:true}); } catch(e) {}
    if (gl) break;
  }
  if (gl) { try { setupGL(); } catch(e) { console.warn(e); gl = null; } }
  if (!gl) {
    const fresh = canvas.cloneNode(); canvas.replaceWith(fresh); canvas = fresh;
    r2d = make2D(canvas);
    setTimeout(() => toast('Simple mode: WebGL isn’t available'), 400);
  }
  addEventListener('resize', resize); resize();
}
function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, gl ? 1.5 : 1);
  W = Math.max(2, Math.floor(innerWidth * dpr)); H = Math.max(2, Math.floor(innerHeight * dpr));
  canvas.width = W; canvas.height = H;
  if (gl) glResize(); else r2d.resize(W, H);
}
