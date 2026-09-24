// WebGL renderer: context, framebuffers, the feedback and display passes, and the choice between WebGL and simple mode.
import { NP, parts } from '../fx/particles.js';
import { make2D } from './canvas2d.js';
import { UNIT, composeFeedback, composeSegment } from './compose.js';
import { PFRAG, PVERT, VERT } from './shaders.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
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
export let fbProg = null, fbos = [], cur = 0, W = 1, H = 1, dataTex = null, r2d = null;
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
  fbProg = program(composeFeedback()); segProgs.clear(); pProg = program(PFRAG, PVERT);
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
// a display segment's program, compiled the first time a scene needs that run of items and kept
const segProgs = new Map();
function segProg(seg, plan){
  let p = segProgs.get(seg.key);
  if (!p) segProgs.set(seg.key, p = program(composeSegment(seg, plan)));
  return p;
}
// render targets, made when a scene first needs them: half-size fills and masks, extra trail groups' buffer pairs,
// and full-size compose surfaces (with depth, for objects) when an object sits between two segments
let fills = {}, masks = [], groups = {}, surfs = [];
function target(w, h, depth){
  const tex = makeTex(w, h), fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  let rb = null;
  if (depth) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return {tex, fb, w, h, rb};
}
const halfTarget = () => target(Math.max(1, W >> 1), Math.max(1, H >> 1));
const drop = t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); if (t.rb) gl.deleteRenderbuffer(t.rb); } };
function glResize(){
  [...Object.values(fills), ...masks, ...surfs, ...Object.values(groups).flatMap(g => g.fbos), ...fbos].forEach(drop);
  fills = {}; masks = []; groups = {}; surfs = [];
  fbos = [0, 1].map(() => target(W, H));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
// a trail group's buffer pair: main is the page's own, others are made on first use
const pairOf = g => g === 'main' ? {fbos, get cur(){ return cur; }, set cur(v){ cur = v; }} : groups[g] || (groups[g] = {fbos: [target(W, H), target(W, H)], cur: 0});
// one feedback pass for a trail group: the last frame moved and faded, and the group's own layers drawn on top
function trailPass(now, P, g, first){
  const sc = P.sc, pr = pairOf(g), src = pr.fbos[pr.cur], dst = pr.fbos[1 - pr.cur], inG = k => sc.groupOf(k) === g;
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0,0,W,H);
  gl.useProgram(fbProg.p); const u = fbProg.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(u.uPrev, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dataTex);
  if (first) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, dataArr);
  gl.uniform1i(u.uData, 1);
  gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uCenter, P.cx, P.cy);
  gl.uniform1f(u.uTime, now/1000);
  gl.uniform1f(u.uZoom, P.zoom); gl.uniform1f(u.uRot, P.rot); gl.uniform1f(u.uWarp, P.warp);
  gl.uniform1f(u.uDecay, P.decay);
  gl.uniform1f(u.uSym, P.sym); gl.uniform1f(u.uMirror, P.mirror);
  gl.uniform1f(u.uHue, P.hue); gl.uniform1f(u.uHueShift, P.hueShift);
  gl.uniform1f(u.uBass, P.bass); gl.uniform1f(u.uMid, P.mid); gl.uniform1f(u.uTreb, P.treb);
  gl.uniform1f(u.uBeat, P.beat); gl.uniform1f(u.uReact, P.react); gl.uniform1f(u.uHit, P.hit); gl.uniform1f(u.uFillMode, 0);
  // only this group's layers (and hits drawn in the trails) show in it
  const Pg = {...P};
  for (const h of HIT_VISUALS) if (h.inTrails && !inG(h.key)) Pg[h.trailWeight] = 0;
  for (const l of LAYER_VISUALS) if (l.feedback) gl.uniform1f(u['uL_' + l.key], inG(l.key) ? P.l[l.key] : 0);
  for (const vis of VISUALS) if (vis.fbUniforms) vis.fbUniforms(gl, u, Pg);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (P.l.flow > .01 && inG('flow')) {   // flow-field particles, drawn into the trails so they leave streaks (kept here: they need their own program)
    gl.useProgram(pProg.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, parts);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(pProg.u.uScale, 2/(W/H), 2); gl.uniform1f(pProg.u.uSize, Math.max(2, H/320));
    gl.uniform3fv(pProg.u.uCol, P.flowCol);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, 0, NP); gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  for (const o of OBJECT_VISUALS) if (o.drawGL && P.o[o.key] > .003 && inG(o.key)) o.drawGL(gl, P, W, H, 'trails');   // objects leave ghosts
  pr.cur = 1 - pr.cur;
  return dst;
}
// the objects a mesh step draws: one placed object, or every object on screen that no entry places
const meshesOf = (P, step) => OBJECT_VISUALS.filter(o => o.drawGL && P.o[o.key] > .003 && (step.mesh === '*' ? !P.sc.placed.has(o.key) : o.key === step.mesh));
export function drawGL(now, P){
  const sc = P.sc, out = {};
  Object.keys(sc.groups).forEach((g, i) => out[g] = trailPass(now, P, g, i === 0));
  const u = fbProg.u;
  // the scene's fills: the chosen layers alone, through the kaleidoscope, drawn by the trails' own shader in fill mode
  for (const key in sc.fills) if (P.o[key] > .003) {
    const f = sc.fills[key], t = fills[key] || (fills[key] = halfTarget());
    gl.useProgram(fbProg.p); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h);
    gl.uniform1f(u.uFillMode, 1); gl.uniform1f(u.uFillGain, TUNE.scene.fillGain); gl.uniform1f(u.uFillZoom, f.zoom || TUNE.scene.fillZoom); gl.uniform1f(u.uSym, f.fold); gl.uniform1f(u.uMirror, 0);
    for (const l of LAYER_VISUALS) if (l.feedback) gl.uniform1f(u['uL_' + l.key], f.layers.includes(l.key) ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.uniform1f(u.uFillMode, 0);
    P.m[key].fillTex = t.tex; P.m[key].fillAmt = TUNE.scene.fillAmt;
  }
  // the scene's masks: objects' silhouettes, which trails are shown inside (or outside) of
  const maskOn = sc.masks.map((key, i) => {
    const on = byKey[key] && P.o[key] > .003;
    if (on) {
      const m = masks[i] || (masks[i] = halfTarget());
      gl.bindFramebuffer(gl.FRAMEBUFFER, m.fb); gl.viewport(0, 0, m.w, m.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      byKey[key].drawGL(gl, P, W, H, 'cover');
    }
    return on;
  });
  // the stack, bottom to top: each segment is one full-screen pass over the picture so far; objects draw between them.
  // Everything goes straight to the screen unless something has to be drawn over later, then it's built on a surface
  let surf = null, si = 0;
  const onSurf = () => { if (!surf) { surf = surfs[si] || (surfs[si] = target(W, H, true)); gl.bindFramebuffer(gl.FRAMEBUFFER, surf.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } };
  sc.steps.forEach((st, i) => {
    if (st.mesh) {
      if (i === 0) onSurf();
      if (surf) gl.bindFramebuffer(gl.FRAMEBUFFER, surf.fb); else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      for (const o of meshesOf(P, st)) o.drawGL(gl, P, W, H, 'screen');
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      return;
    }
    const under = surf, later = sc.steps.slice(i + 1).some(s => s.seg);   // a later segment draws over this one: build on a surface
    let dst = null;
    if (later) { si = under && under === surfs[0] ? 1 : 0; dst = surfs[si] || (surfs[si] = target(W, H, true)); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null); gl.viewport(0, 0, W, H);
    const pr = segProg(st, sc), v = pr.u;
    gl.useProgram(pr.p);
    gl.uniform2f(v.uRes, W, H);
    for (const g in out) { gl.activeTexture(gl.TEXTURE0 + (g === 'main' ? UNIT.main : UNIT.group)); gl.bindTexture(gl.TEXTURE_2D, out[g].tex); gl.uniform1i(v['uT_' + g], g === 'main' ? UNIT.main : UNIT.group); }
    if (under) { gl.activeTexture(gl.TEXTURE0 + UNIT.under); gl.bindTexture(gl.TEXTURE_2D, under.tex); gl.uniform1i(v.uUnder, UNIT.under); }
    sc.masks.forEach((k, j) => { if (maskOn[j]) { gl.activeTexture(gl.TEXTURE0 + UNIT.mask[j]); gl.bindTexture(gl.TEXTURE_2D, masks[j].tex); gl.uniform1i(v['uMask' + j], UNIT.mask[j]); } });
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, histTex);
    if (!drawGL.histAt || drawGL.histAt !== now) { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, HIST); drawGL.histAt = now; }
    gl.uniform1i(v.uHist, 1);
    gl.uniform1f(v.uTime, now/1000); gl.uniform1f(v.uHue, P.hue); gl.uniform1f(v.uBass, P.bass); gl.uniform1f(v.uMid, P.mid);
    gl.uniform1f(v.uBeat, P.beat); gl.uniform1f(v.uReact, P.react);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dataTex); gl.uniform1i(v.uData, 2);
    for (const w of WORLD_VISUALS) gl.uniform1f(v['uW_' + w.key], P.w[w.key]);
    for (const vis of VISUALS) if (vis.uniforms) vis.uniforms(gl, v, P);
    // a mask whose object isn't on screen shows everything (it applies only while the object is there)
    st.seg.forEach(it => { if (it.mask && it.mask.object && !maskOn[sc.masks.indexOf(it.mask.object)]) {
      const j = sc.masks.indexOf(it.mask.object); gl.activeTexture(gl.TEXTURE0 + UNIT.mask[j]); gl.bindTexture(gl.TEXTURE_2D, blankTex(it.mask.inside)); gl.uniform1i(v['uMask' + j], UNIT.mask[j]); } });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    surf = dst;
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
// a 1x1 texture that lets a mask show everything: white when keeping inside, black when keeping outside
const blanks = {};
function blankTex(inside){
  const k = inside ? 1 : 0;
  if (!blanks[k]) { blanks[k] = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blanks[k]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(inside ? [255, 255, 255, 255] : [0, 0, 0, 255])); }
  return blanks[k];
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
