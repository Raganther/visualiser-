// WebGL renderer: context, framebuffers, the feedback and display passes, and the choice between WebGL and simple mode.
import { NP, parts } from '../fx/particles.js';
import { make2D } from './canvas2d.js';
import { UNIT, composeFeedback, composeSegment } from './compose.js';
import { resolveScene } from '../scene/graph.js';
import { BLUR, BRIGHT, FINISH, PFRAG, PVERT, VERT } from './shaders.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { HIST, S, dataArr } from '../state.js';
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
let pProg = null, pBuf = null, quadBuf = null, histTex = null, post = null, hdr = null;
let fbProg = null, fbos = [], cur = 0, dataTex = null;
export let W = 1, H = 1, r2d = null;
// half-float colour where the device can render to it: smooth trail tails, no banding, and brightness above 1 kept for
// the finish to roll off (null: plain 8-bit)
function detectHdr(){
  const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  let f = null;
  if (isGL2 && gl.getExtension('EXT_color_buffer_float')) f = {internal: gl.RGBA16F, type: gl.HALF_FLOAT};
  else if (!isGL2) { const h = gl.getExtension('OES_texture_half_float');
    if (h && gl.getExtension('EXT_color_buffer_half_float') && gl.getExtension('OES_texture_half_float_linear')) f = {internal: gl.RGBA, type: h.HALF_FLOAT_OES}; }
  if (!f) return null;
  const t = makeTex(4, 4, f), fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(t);
  return ok ? f : null;
}
function makeTex(w, h, f){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, f ? f.internal : gl.RGBA, w, h, 0, gl.RGBA, f ? f.type : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function setupGL(){
  fbProg = program(composeFeedback()); segProgs.clear(); pProg = program(PFRAG, PVERT);
  post = {bright: program(BRIGHT), blur: program(BLUR), finish: program(FINISH)}; hdr = detectHdr();
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
// compile the segment shaders these scenes will need, one at a time while the page is idle, so a scene's first bar line
// doesn't stall on a shader compile
export function warmScenes(scenes){
  if (!gl) return;
  const todo = [];
  for (const sc of scenes) { const plan = resolveScene(sc); for (const st of plan.steps) if (st.seg) todo.push([st, plan]); }
  const idle = window.requestIdleCallback || (f => setTimeout(f, 50));
  const next = () => { if (!todo.length || lost) return; const [st, plan] = todo.shift(); try { segProg(st, plan); } catch (e) {} idle(next); };
  idle(next);
}
// render targets, made when a scene first needs them: half-size fills and masks, extra trail groups' buffer pairs,
// and full-size compose surfaces (with depth, for objects) when an object sits between two segments
let fills = {}, masks = [], groups = {}, surfs = [], blooms = [], TW = 2, TH = 2;   // TW, TH: the trails' size
function target(w, h, depth, f){
  const tex = makeTex(w, h, f), fb = gl.createFramebuffer();
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
  [...Object.values(fills), ...masks, ...surfs, ...blooms, ...Object.values(groups).flatMap(g => g.fbos), ...fbos].forEach(drop);
  fills = {}; masks = []; groups = {}; surfs = [];
  TW = Math.max(2, Math.round(W*TUNE.render.trailScale)); TH = Math.max(2, Math.round(H*TUNE.render.trailScale));
  fbos = [0, 1].map(() => target(TW, TH, false, hdr));
  blooms = [0, 1].map(() => target(Math.max(1, W >> 2), Math.max(1, H >> 2), false, hdr));   // the glow, at quarter size
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
// a trail group's buffer pair: main is the page's own, others are made on first use
const pairOf = g => g === 'main' ? {fbos, get cur(){ return cur; }, set cur(v){ cur = v; }} : groups[g] || (groups[g] = {fbos: [target(TW, TH, false, hdr), target(TW, TH, false, hdr)], cur: 0});
// one feedback pass for a trail group: the last frame moved and faded, and the group's own layers drawn on top
// the trails' shader settings every pass shares (trail groups and fills), and this frame's audio data: once a frame
function fbShared(now, P){
  gl.useProgram(fbProg.p); const u = fbProg.u;
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dataTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, dataArr);
  gl.uniform1i(u.uData, 1);
  gl.uniform2f(u.uRes, TW, TH); gl.uniform2f(u.uCenter, P.cx, P.cy);
  gl.uniform1f(u.uTime, now/1000);
  gl.uniform1f(u.uZoom, P.zoom); gl.uniform1f(u.uRot, P.rot); gl.uniform1f(u.uWarp, P.warp);
  gl.uniform1f(u.uDecay, P.decay);
  gl.uniform1f(u.uSym, P.sym); gl.uniform1f(u.uMirror, P.mirror);
  gl.uniform1f(u.uHue, P.hue); gl.uniform1f(u.uHueShift, P.hueShift);
  gl.uniform1f(u.uBass, P.bass); gl.uniform1f(u.uMid, P.mid); gl.uniform1f(u.uTreb, P.treb);
  gl.uniform1f(u.uBeat, P.beat); gl.uniform1f(u.uReact, P.react); gl.uniform1f(u.uHit, P.hit); gl.uniform1f(u.uFillMode, 0);
  gl.uniform3fv(u.uPal, P.pal); gl.uniform2f(u.uDrift, P.drift[0], P.drift[1]);
  const R = TUNE.render; gl.uniform2f(u.uSoft, R.trailSoft*.5/TW, R.trailSoft*.5/TH); gl.uniform1f(u.uFloor, hdr ? R.trailFloor : .004);
}
function trailPass(now, P, g){
  const sc = P.sc, pr = pairOf(g), src = pr.fbos[pr.cur], dst = pr.fbos[1 - pr.cur], inG = k => sc.groupOf(k) === g;
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0,0,TW,TH);
  gl.useProgram(fbProg.p); const u = fbProg.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(u.uPrev, 0);
  gl.uniform1f(u.uSym, P.sym); gl.uniform1f(u.uMirror, P.mirror);
  // only this group's layers (and hits drawn in the trails) show in it
  const Pg = {...P, l: {}};
  for (const k in P.l) Pg.l[k] = inG(k) ? P.l[k] : 0;
  for (const h of HIT_VISUALS) if (h.inTrails && !inG(h.key)) Pg[h.trailWeight] = 0;
  for (const l of LAYER_VISUALS) if (l.feedback) gl.uniform1f(u['uL_' + l.key], inG(l.key) ? P.l[l.key] : 0);
  for (const vis of VISUALS) if (vis.fbUniforms) vis.fbUniforms(gl, u, Pg);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (P.l.flow > .01 && inG('flow')) {   // flow-field particles, drawn into the trails so they leave streaks (kept here: they need their own program)
    gl.useProgram(pProg.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, parts);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(pProg.u.uScale, 2/(W/H), 2); gl.uniform1f(pProg.u.uSize, Math.max(2, TH/320));
    gl.uniform3fv(pProg.u.uCol, P.flowCol);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, 0, NP); gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  for (const o of OBJECT_VISUALS) if (o.drawGL && P.o[o.key] > .003 && inG(o.key)) o.drawGL(gl, P, TW, TH, 'trails');   // objects leave ghosts
  pr.cur = 1 - pr.cur;
  return dst;
}
// the objects a mesh step draws: one placed object, or every object on screen that no entry places
const meshesOf = (P, step) => OBJECT_VISUALS.filter(o => o.drawGL && P.o[o.key] > .003 && (step.mesh === '*' ? !P.sc.placed.has(o.key) : o.key === step.mesh));
export function drawGL(now, P){
  if (lost) return;
  const sc = P.sc, out = {};
  for (const g in groups) if (!(g in sc.groups)) { groups[g].fbos.forEach(drop); delete groups[g]; }   // a group this scene doesn't use: gone (no stale frames later)
  fbShared(now, P);
  for (const g in sc.groups) out[g] = trailPass(now, P, g);
  const u = fbProg.u;
  // the scene's fills: another image seen through an object's glass. A trail group is already a picture; layers are drawn
  // alone by the trails' own shader in fill mode; worlds by a display segment, shrunk
  for (const key in sc.fills) if (P.o[key] > .003) {
    const f = sc.fills[key];
    P.m[key].fillAmt = TUNE.scene.fillAmt*(f.part ? TUNE.scene.partFillAmt : 1); P.m[key].fillPart = f.part;
    const t = fills[key] || (fills[key] = halfTarget());
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h);
    if (f.src !== 'layers') {   // a world or a trail group, shrunk into the glass by a display segment
      drawSeg(now, P, f.src === 'world' ? WORLD_FILL : trailFill(f.g), null, f.zoom, out, [], f.src === 'world' ? TUNE.scene.worldFillGain : 1);
      P.m[key].fillTex = t.tex; continue;
    }
    gl.useProgram(fbProg.p);
    const Pf = {...P, l: {}};
    for (const k in P.l) Pf.l[k] = f.layers.includes(k) ? 1 : 0;
    for (const h of HIT_VISUALS) if (h.inTrails && !f.layers.includes(h.key)) Pf[h.trailWeight] = 0;
    for (const vis of VISUALS) if (vis.fbUniforms) vis.fbUniforms(gl, u, Pf);
    gl.uniform1f(u.uFillMode, 1); gl.uniform1f(u.uFillGain, TUNE.scene.fillGain); gl.uniform1f(u.uFillZoom, f.zoom || TUNE.scene.fillZoom); gl.uniform1f(u.uSym, f.fold); gl.uniform1f(u.uMirror, 0);
    for (const l of LAYER_VISUALS) if (l.feedback) gl.uniform1f(u['uL_' + l.key], Pf.l[l.key] || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.uniform1f(u.uFillMode, 0);
    P.m[key].fillTex = t.tex;
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
  const onSurf = () => { if (!surf) { surf = surfs[si] || (surfs[si] = target(W, H, true, hdr)); gl.bindFramebuffer(gl.FRAMEBUFFER, surf.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } };
  sc.steps.forEach((st, i) => {
    if (st.mesh) {
      if (i === 0) onSurf();
      if (surf) gl.bindFramebuffer(gl.FRAMEBUFFER, surf.fb); else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      for (const o of meshesOf(P, st)) o.drawGL(gl, P, W, H, 'screen');
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      return;
    }
    const under = surf;   // everything is built on a surface, for the finish; a later segment reads this one back
    si = under && under === surfs[0] ? 1 : 0;
    const dst = surfs[si] || (surfs[si] = target(W, H, true, hdr));
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null); gl.viewport(0, 0, W, H);
    drawSeg(now, P, st, under, 1, out, maskOn);
    surf = dst;
  });
  finish(surf);
}
// the finish: the bright parts glow onto their surroundings, bright colours roll off instead of clipping, and a dither
function finish(surf){
  const R = TUNE.render, run = (pr, dst, w, h, fn) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.viewport(0, 0, w, h); gl.useProgram(pr.p); fn(pr.u); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const tex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  if (!surf) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  const [a, b] = blooms, bw = a.w, bh = a.h;
  if (R.bloom > 0) {
    run(post.bright, a.fb, bw, bh, u => { tex(0, surf.tex, u.uTex); gl.uniform2f(u.uPx, 1/W, 1/H); gl.uniform1f(u.uThresh, R.bloomThresh); });
    run(post.blur, b.fb, bw, bh, u => { tex(0, a.tex, u.uTex); gl.uniform2f(u.uDir, R.bloomRadius/bw, 0); });
    run(post.blur, a.fb, bw, bh, u => { tex(0, b.tex, u.uTex); gl.uniform2f(u.uDir, 0, R.bloomRadius/bh); });
  }
  run(post.finish, null, W, H, u => { tex(0, surf.tex, u.uTex); tex(1, a.tex, u.uBloom); gl.uniform1f(u.uAmt, R.bloom); gl.uniform1f(u.uKnee, R.knee); });
}
// the worlds alone, for a world filling an object
const WORLD_FILL = {seg: [{t: 'world'}], first: true, last: false, fill: true, key: 'world-fill'};
const trailFills = {}, trailFill = g => trailFills[g] || (trailFills[g] = {seg: [{t: 'trails', g}], first: true, last: false, fill: true, key: 'trail-fill:' + g});
// one display segment over the picture so far (under), into whatever is bound
function drawSeg(now, P, st, under, zoom, out = {}, maskOn = [], gain = 1){
  const sc = P.sc, pr = segProg(st, sc), v = pr.u;
  gl.useProgram(pr.p);
  gl.uniform2f(v.uRes, W, H);
  gl.uniform1f(v.uSpZ, zoom); gl.uniform1f(v.uGain, gain); gl.uniform3fv(v.uPal, P.pal);
  for (const it of st.seg) if (it.drive) gl.uniform1f(v['uK' + it.i], P.kw[it.i]);
  for (const g in out) { const unit = g === 'main' ? UNIT.main : UNIT.group[sc.extra.indexOf(g)];
    if (unit === undefined) continue;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, out[g].tex); gl.uniform1i(v['uT_' + g], unit); }
  if (under) { gl.activeTexture(gl.TEXTURE0 + UNIT.under); gl.bindTexture(gl.TEXTURE_2D, under.tex); gl.uniform1i(v.uUnder, UNIT.under); }
  sc.masks.forEach((k, j) => {   // a mask whose object isn't on screen shows everything (uMaskOn 0)
    gl.activeTexture(gl.TEXTURE0 + UNIT.mask[j]); gl.bindTexture(gl.TEXTURE_2D, maskOn[j] ? masks[j].tex : blankTex(true));
    gl.uniform1i(v['uMask' + j], UNIT.mask[j]); gl.uniform1f(v['uMaskOn' + j], maskOn[j] ? 1 : 0); });
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, histTex);
  if (!drawGL.histAt || drawGL.histAt !== now) { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, HIST); drawGL.histAt = now; }
  gl.uniform1i(v.uHist, 1);
  gl.uniform1f(v.uTime, now/1000); gl.uniform1f(v.uHue, P.hue); gl.uniform1f(v.uBass, P.bass); gl.uniform1f(v.uMid, P.mid);
  gl.uniform1f(v.uBeat, P.beat); gl.uniform1f(v.uReact, P.react);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dataTex); gl.uniform1i(v.uData, 2);
  for (const w of WORLD_VISUALS) gl.uniform1f(v['uW_' + w.key], P.w[w.key]);
  for (const vis of VISUALS) if (vis.uniforms) vis.uniforms(gl, v, P);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    try { gl = canvas.getContext(type, {antialias:false, alpha:false, premultipliedAlpha:false, depth:false}); } catch(e) {}   // objects draw on surfaces with their own depth
    if (gl) break;
  }
  if (gl) { try { setupGL(); } catch(e) { console.warn(e); gl = null; } }
  if (!gl) {
    const fresh = canvas.cloneNode(); canvas.replaceWith(fresh); canvas = fresh;
    r2d = make2D(canvas);
    setTimeout(() => toast('Simple mode: WebGL isn’t available'), 400);
  }
  if (gl) {
    // a lost context (a phone backgrounding the tab, a GPU reset): stop drawing, and rebuild everything when it comes back
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
    canvas.addEventListener('webglcontextrestored', () => {
      try { setupGL(); for (const k in blanks) delete blanks[k]; fills = {}; masks = []; groups = {}; surfs = []; fbos = []; blooms = [];
        S.glGen++; glResize(); lost = false; }
      catch (e) { console.warn(e); toast('The picture was lost: reload the page'); }
    });
  }
  // debounced, and only when the size really changed (phones fire resize as the address bar moves, which wiped the trails)
  let pending = 0;
  addEventListener('resize', () => { clearTimeout(pending); pending = setTimeout(resize, 150); }); resize();
}
let lost = false;
function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, gl ? 1.5 : 1);
  const w = Math.max(2, Math.floor(innerWidth * dpr)), h = Math.max(2, Math.floor(innerHeight * dpr));
  if (w === W && h === H && (!gl || fbos.length)) return;
  W = w; H = h; canvas.width = W; canvas.height = H;
  if (gl) glResize(); else r2d.resize(W, H);
}
