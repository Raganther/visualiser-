// WebGL renderer: context, framebuffers, the feedback and display passes, and the choice between WebGL and simple mode.
import { NP, parts } from '../fx/particles.js';
import { make2D } from './canvas2d.js';
import { FB_VISUALS, UNIT, composeFeedback, composeSegment } from './compose.js';
import { resolveScene } from '../scene/graph.js';
import { meshData, meshWarm } from './mesh.js';
import { litWarm } from './lit.js';
import { facetWarm } from './facet.js';
import { STALL, mark } from './stalls.js';
import { BLUR, BRIGHT, FINISH, PFRAG, PVERT, VERT } from './shaders.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { Q } from './quality.js';
import { HIST, S, dataArr, viewH } from '../state.js';
import { TW as TWEAK } from '../scene/tweaks.js';
import { DANCE } from '../scene/dance.js';
import { toast } from '../ui/toast.js';
import { $ } from '../util.js';

let canvas = $('#gl');
export let gl = null;
function compile(type, src){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
// start compiling and linking a program; linked() waits for it (and reads its uniforms), so a driver that compiles in the
// background (KHR_parallel_shader_compile) can be left to finish while frames go on
function startProgram(fs, vs, label){   // (label: what it's for, in the stall log)
  const p = gl.createProgram(), sh = [gl.createShader(gl.VERTEX_SHADER), gl.createShader(gl.FRAGMENT_SHADER)];
  [vs || VERT, fs].forEach((src, i) => { gl.shaderSource(sh[i], src); gl.compileShader(sh[i]); gl.attachShader(p, sh[i]); });
  gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
  if (label) mark(`shader started: ${label} (${Math.round(fs.length/1024)} KB)`);
  return {p, sh, label};
}
function linked(job){
  const t0 = performance.now(), r = linkedNow(job);
  if (job.label) { r.label = job.label; mark(`shader linked: ${job.label} (${Math.round(performance.now() - t0)} ms)`); }
  return r;
}
// the first time a program draws, for the stall log (a driver may still build part of it then)
const firstUse = pr => { if (pr && !pr.used) { pr.used = 1; if (pr.label) mark('first draw: ' + pr.label); } };
function linkedNow({p, sh}){
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = sh.map(x => gl.getShaderInfoLog(x)).join('') || gl.getProgramInfoLog(p);
    sh.forEach(x => gl.deleteShader(x)); gl.deleteProgram(p); throw new Error(log);
  }
  sh.forEach(x => gl.deleteShader(x));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return {p, u};
}
const program = (fs, vs) => linked(startProgram(fs, vs));
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
// The trails' shader is built from just the visuals drawing in it: every visual added to the registry would otherwise make
// it bigger for every pixel of every frame, drawing or not. The full one (every visual) is always there, used while a
// smaller one compiles in the background; a visual counts as drawing for fbLinger after it last had weight, so an accent
// that comes and goes doesn't swap programs each time
const FB = {all: null, progs: new Map(), seen: {}, par: null, key: '*'};
function fbPick(P){
  // 0: always the full shader. And where the driver can't build in the background, too: each new combination of layers
  // froze the picture while it built (0.2-0.7 s each, on the user's Chromebook)
  if (!TUNE.render.fbCache || (!FB.par && !TUNE.render.fbSerial)) { fbProg = FB.all; FB.key = '*'; return; }
  const t = performance.now(), sc = P.sc, L = TUNE.render.fbLinger;
  for (const v of FB_VISUALS) {
    const w = v.kind === 'layer' ? P.l[v.key] : P[v.trailWeight];
    let on = w > 0;
    for (const k in sc.fills) if (P.o[k] > .003 && sc.fills[k].src === 'layers' && sc.fills[k].layers.includes(v.key)) on = true;
    if (on) FB.seen[v.key] = t;
  }
  const keys = FB_VISUALS.filter(v => t - (FB.seen[v.key] ?? -1e9) < L).map(v => v.key), key = keys.join(',');
  let e = FB.progs.get(key);
  if (!e) {   // a ready one that covers this set and isn't much bigger serves: each new one froze the picture 0.2-0.5 s at its first draw (a Mac's stall log)
    let cov = null; for (const c of FB.progs.values()) if (c.prog && c.keys.size - keys.length <= TUNE.render.fbSlack && keys.every(k => c.keys.has(k)) && (!cov || c.keys.size < cov.keys.size)) cov = c;
    if (cov) { cov.used = t; FB.key = [...cov.keys].join(', ') || 'none'; fbProg = cov.prog; return; }
  }
  if (!e) {   // start it compiling; until it's ready a bigger one that covers it does
    if (FB.progs.size >= TUNE.render.fbCache) {   // forget the one used longest ago
      let old = null; for (const [k, c] of FB.progs) if (!c.job && (!old || c.used < old[1].used)) old = [k, c];
      if (old) { if (old[1].prog) gl.deleteProgram(old[1].prog.p); FB.progs.delete(old[0]); }
    }
    e = {keys: new Set(keys), job: null, prog: null, used: t, at: t};
    try { e.job = startProgram(composeFeedback(e.keys), null, 'trails: ' + (keys.join(', ') || 'none')); } catch (err) { e.failed = true; }
    FB.progs.set(key, e);
  }
  // ready: the driver says so, or (without that extension) a moment has passed, since browsers mostly compile off the page's thread
  if (e && e.job && (FB.par ? gl.getProgramParameter(e.job.p, FB.par.COMPLETION_STATUS_KHR) : t - e.at > TUNE.render.fbWait)) {
    try { e.prog = linked(e.job); } catch (err) { console.warn(err); e.failed = true; }
    e.job = null;
  }
  let best = e && e.prog ? e : null;
  if (!best) for (const c of FB.progs.values())
    if (c.prog && keys.every(k => c.keys.has(k)) && (!best || c.keys.size < best.keys.size)) best = c;
  if (best) best.used = t;
  FB.key = best ? [...best.keys].join(', ') || 'none' : '*';
  fbProg = best ? best.prog : FB.all;
}
// what the trails' shader holds now, for the frame-rate readout
export const fbInfo = () => FB.key === '*' ? `all ${FB_VISUALS.length} visuals` : FB.key;
function setupGL(){
  for (const e of FB.progs.values()) if (e.prog) gl.deleteProgram(e.prog.p);
  FB.progs.clear(); FB.par = gl.getExtension('KHR_parallel_shader_compile'); lastSc = null; canWait = true; primeT = null;
  try { const d = gl.getExtension('WEBGL_debug_renderer_info'); STALL.gpu = `${d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}; shaders built in the background: ${FB.par ? 'yes' : 'no'}`; } catch (e) {}
  fbProg = FB.all = program(composeFeedback()); segProgs.clear(); pProg = program(PFRAG, PVERT);
  post = {bright: program(BRIGHT), blur: program(BLUR), finish: program(FINISH)}; hdr = detectHdr();
  const units = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  slots.forEach(s => { s.t = null; s.on = false; }); lowOk = units > UNIT.low; allOwn = !!TUNE.render.worldsOwn && units > UNIT.low2;
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
// A display segment's program, one for each run of items. It holds no world when it draws no world, front or world mask;
// otherwise every world, except one whose code is far bigger than the rest (lowRes marks it: the cosmos, with space and
// the ground), which is in only while it's drawing (or lately: fbLinger): every segment compiled with it was slow. So a
// run has two programs, with it and without it, both compiled while the page is idle (warmScenes)
const segProgs = new Map(), wSeen = {};
const segHasW = seg => seg.seg.some(it => it.t === 'world' || it.t === 'front' || (it.mask && it.mask.world));
function segWorlds(seg, P){
  if (seg.only) return [seg.only];   // one world alone (drawn at its own resolution)
  if (!segHasW(seg)) return [];
  if (allOwn && !seg.fill) return ['@'];   // every world drawn in its own pass, only read here (a fill shrinks the worlds: it traces them)
  const t = performance.now(); for (const v of WORLD_VISUALS) if (P && P.w[v.key] > .003) wSeen[v.key] = t;
  // only the worlds drawing (or lately): with every flat world in each segment its shader was 50 KB, and a Chromebook's
  // graphics chip took seconds to build each one, the picture frozen meanwhile (the user's stall log, 2026-10-09). A heavy
  // world drawn in its own pass (lowPass) is only read back ('~'), without its code: on a Mac the cosmos in a new run froze
  // the picture for 5 s at its first draw. Its code goes in only where a front needs it, or where it isn't drawn on its own
  const front = seg.fill || seg.seg.some(it => it.t === 'front' || (it.mask && it.mask.world));
  const own = lowOk && TUNE.render.heavyOwn;   // (heavy worlds always in their own pass: never their code here, even before that pass is ready)
  return WORLD_VISUALS.flatMap(v => t - (wSeen[v.key] ?? -1e9) < TUNE.render.fbLinger ? [v.key + (own && v.heavy && !front ? '~' : '')] : []);
}
const segKey = (seg, wk) => seg.key + '|' + (wk.length === WORLD_VISUALS.length ? '*' : wk.join(','));
// Each is started compiling and left to the driver (in the background, where it can: KHR_parallel_shader_compile), and
// linked once it's done. Until then the run with every world in it ('*', drawing exactly the same picture: a world without
// weight draws nothing) stands in if it's ready, so a world leaving doesn't stall a frame
const segJob = (key, seg, plan, wk) => { const e = {job: startProgram(composeSegment(seg, plan, wk), null, 'segment ' + key.slice(0, 90)), at: performance.now(), p: null}; segProgs.set(key, e); return e; };
const segDone = e => !!e.job && (FB.par ? gl.getProgramParameter(e.job.p, FB.par.COMPLETION_STATUS_KHR) : performance.now() - e.at > TUNE.render.fbWait);
function segLink(e){ const j = e.job; e.job = null; try { e.p = linked(j); } catch (err) { e.failed = err; } if (e.failed) throw e.failed; return e.p; }
// Never waited for once a scene has drawn: on some drivers (Direct3D's compiler, under Chrome on Windows) a big shader
// takes seconds to build, one at a time, and waiting froze the picture for up to 30 s at a scene change. A ready program
// for the same run stands in, the one holding the most of these worlds (a world coming in shows once its own is built);
// with none, null, and drawGL keeps drawing the last scene that could draw
let canWait = true;   // only before anything has drawn (the first frame, or after a lost context)
function segProg(seg, plan, P){
  const wk = segWorlds(seg, P), key = segKey(seg, wk);
  const e = segProgs.get(key) || segJob(key, seg, plan, wk);
  if (e.p) return e.p;
  if (e.failed) throw e.failed;
  if (segDone(e)) return segLink(e);
  let best = null, bn = -1;
  for (const [k, c] of segProgs) {
    if (!k.startsWith(seg.key + '|')) continue;
    if (FB.par && !c.p && !c.failed && segDone(c)) try { segLink(c); } catch (err) {}   // (without the extension a link may wait: only those already linked)
    if (!c.p) continue;
    const ws = k.slice(seg.key.length + 1), n = ws === '*' ? wk.length : wk.filter(w => ws.split(',').includes(w)).length;
    if (n > bn) { best = c; bn = n; }
  }
  return best ? best.p : canWait ? segLink(e) : null;
}
// A program drawn once, a pixel into each kind of surface it draws into, while the page is idle: a driver may build part of a
// shader only when it first draws (Direct3D under Chrome: for each kind of surface), and that build froze the picture at
// the transition that first needed it. (Its uniforms are left as they are: the pixel is thrown away.)
let primeT = null;
function prime(pr){
  try {
    if (!primeT) primeT = [target(1, 1, false, null), ...(hdr ? [target(1, 1, false, hdr)] : [])];
    const fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT);
    gl.useProgram(pr.p); gl.disable(gl.BLEND);
    for (const t of primeT) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, 1, 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb0); gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    if (pr.label) mark('drawn once while idle: ' + pr.label);
  } catch (e) {}
}
export const segInfo = () => [...segProgs].map(([k, e]) => k + (e.p ? '' : e.failed ? ' (failed)' : ' (compiling)'));   // for tests and tools
// compile the segment shaders these scenes will need while the page is idle, so a scene's first bar line has them ready:
// each run without the big worlds, and the big worlds drawn at their own size
export function warmScenes(scenes){
  if (!gl) return;
  const todo = [], seen = new Set(), add = (st, plan, wk) => { const k = segKey(st, wk); if (!seen.has(k)) { seen.add(k); todo.push([k, st, plan, wk]); } };
  // each run without any world: a world coming in is built when it's first drawn (small: that world alone), and the run
  // stands in meanwhile. (Warming each with every flat world queued dozens of 50 KB shaders; where the driver can't build
  // in the background, the picture froze for seconds at a time while it did)
  const both = (st, plan) => add(st, plan, allOwn && segHasW(st) && !st.fill ? ['@'] : []);
  for (const sc of scenes) { const plan = resolveScene(sc); for (const st of plan.steps) if (st.seg) both(st, plan); }
  if (todo.length) { const plan = todo[0][2]; for (const v of WORLD_VISUALS) if ((allOwn || v.lowRes) && !S.skipW.has(v.key)) add(lowSeg(v.key), plan, [v.key]);   // each world's own pass (not one Journey leaves out)
    both(WORLD_FILL, plan); }
  const idle = window.requestIdleCallback || (f => setTimeout(f, 50)), started = [];
  try { meshWarm(gl); } catch (e) {}   // the objects' program, and each one's vertex data, one a turn
  for (const o of OBJECT_VISUALS) if (o.mesh) todo.push(['mesh', o.mesh]);
  todo.push(['lit'], ['facet']);   // the lit objects' program (render/lit.js), the faceted objects' (render/facet.js)
  const next = () => {
    if (lost) return;
    if (todo.length && todo[0][0] === 'lit') { todo.shift(); litWarm(gl); idle(next); return; }
    if (todo.length && todo[0][0] === 'facet') { todo.shift(); facetWarm(gl); idle(next); return; }
    if (todo.length && todo[0][0] === 'mesh') { try { meshData(todo.shift()[1]); } catch (e) {} idle(next); return; }
    for (const e of started) if (!e.p && !e.failed && segDone(e)) try { segLink(e); prime(e.p); } catch (err) {}   // link what's finished, and draw it once out of sight
    if (todo.length) { const [k, st, plan, wk] = todo.shift(); if (!segProgs.has(k)) try { started.push(segJob(k, st, plan, wk)); } catch (err) {} }
    if (todo.length || started.some(e => !e.p && !e.failed)) idle(next);
  };
  idle(next);
}
// render targets, made when a scene first needs them: half-size fills and masks, extra trail groups' buffer pairs,
// and full-size compose surfaces (with depth, for objects) when an object sits between two segments
let fills = {}, masks = [], groups = {}, surfs = [], blooms = [], TW = 2, TH = 2;   // TW, TH: the trails' size
let kal = {on: false}, kalM = null, kalMT = null, fin = {gl: [0, 0], grain: 0, t: 0, hush: 0};   // the kaleidoscope this frame, and its objects' silhouettes (kalPrep)
// the worlds drawn in their own passes this frame: two slots (the strongest two), each its picture, its world and whether it's
// drawn; with only one texture unit spare (lowOk, not allOwn), just a world drawn at its own lower resolution (lowRes), in the first
const slots = [{t: null, k: null, on: false}, {t: null, k: null, on: false}];
let lowOk = false, allOwn = false;
function target(w, h, depth, f){
  mark(`surface made: ${w}×${h}${depth ? ' with depth' : ''}`);
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
  const old = fbos[cur];   // the main trails, carried over so a change of resolution doesn't wipe them
  [...Object.values(fills), ...masks, ...surfs, ...blooms, ...slots.map(sl => sl.t), kalMT, ...Object.values(groups).flatMap(g => g.fbos), ...fbos.filter(t => t !== old)].forEach(drop);
  fills = {}; masks = []; groups = {}; surfs = []; slots.forEach(sl => { sl.t = null; sl.on = false; }); kalMT = null;
  TW = Math.max(2, Math.round(W*TUNE.render.trailScale)); TH = Math.max(2, Math.round(H*TUNE.render.trailScale));
  fbos = [0, 1].map(() => target(TW, TH, false, hdr));
  if (old) {   // copied with the blur's program, blurring nothing
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[cur].fb); gl.viewport(0, 0, TW, TH); gl.useProgram(post.blur.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, old.tex); gl.uniform1i(post.blur.u.uTex, 0); gl.uniform2f(post.blur.u.uDir, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); drop(old);
  }
  blooms = [0, 1].map(() => target(Math.max(1, W >> 2), Math.max(1, H >> 2), false, hdr));   // the glow, at quarter size
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
// a trail group's buffer pair: main is the page's own, others are made on first use
const pairOf = g => g === 'main' ? {fbos, get cur(){ return cur; }, set cur(v){ cur = v; }} : groups[g] || (groups[g] = {fbos: [target(TW, TH, false, hdr), target(TW, TH, false, hdr)], cur: 0});
// one feedback pass for a trail group: the last frame moved and faded, and the group's own layers drawn on top
// the trails' shader settings every pass shares (trail groups and fills), and this frame's audio data: once a frame
function fbShared(now, P){
  gl.useProgram(fbProg.p); firstUse(fbProg); const u = fbProg.u;
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
  for (const l of LAYER_VISUALS) if (l.feedback) {   // each layer's own clock, levels and size (scene/tweaks.js); a shader leaves out what a layer's code doesn't read
    const t = TWEAK[l.key], b = t && t.band !== null ? t.band : null;
    if (u['uTw_' + l.key]) gl.uniform4f(u['uTw_' + l.key], now/1000 + (t ? t.off : 0), b ?? P.bass, b ?? P.mid, b ?? P.treb);
    const dn = DANCE.layer[l.key];   // its dance (scene/dance.js): a turn, a shift, a scale
    if (u['uSz_' + l.key]) gl.uniform1f(u['uSz_' + l.key], (t ? t.size : 1)*(dn ? dn.s : 1));
    if (u['uDn_' + l.key]) gl.uniform3f(u['uDn_' + l.key], dn ? dn.rot : 0, dn ? dn.dx : 0, dn ? dn.dy : 0);
  }
  const R = TUNE.render; gl.uniform2f(u.uSoft, R.trailSoft*.5/TW, R.trailSoft*.5/TH); gl.uniform1f(u.uFloor, hdr ? R.trailFloor : .004);
}
function trailPass(now, P, g){
  const sc = P.sc, pr = pairOf(g), src = pr.fbos[pr.cur], dst = pr.fbos[1 - pr.cur], inG = k => sc.groupOf(k) === g;
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0,0,TW,TH);
  gl.useProgram(fbProg.p); firstUse(fbProg); const u = fbProg.u;
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
    gl.uniform2f(pProg.u.uScale, 2/(W/H), 2); gl.uniform1f(pProg.u.uSize, Math.max(3, TH/190));   // big enough to read on its own
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
let lastSc = null;   // the last scene drawn: kept on screen while a new one's shaders are still being built
export function drawGL(now, P){
  if (lost) return;
  if (lastSc && P.sc !== lastSc && !P.sc.steps.every(st => !st.seg || segProg(st, P.sc, P))) P = {...P, sc: lastSc};
  const sc = P.sc, out = {};
  lastSc = sc; canWait = false;
  for (const g in groups) if (!(g in sc.groups)) { groups[g].fbos.forEach(drop); delete groups[g]; }   // a group this scene doesn't use: gone (no stale frames later)
  fbPick(P);
  fbShared(now, P);
  for (const g in sc.groups) out[g] = trailPass(now, P, g);
  lowPass(now, P, out);
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
    gl.useProgram(fbProg.p); firstUse(fbProg);
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
  kalPrep(P);
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
    drawSeg(now, P, st, under, 1, out, maskOn, 1, !allOwn && slots[0].on);
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
  run(post.finish, null, W, H, u => { tex(0, surf.tex, u.uTex); tex(1, a.tex, u.uBloom); gl.uniform1f(u.uAmt, R.bloom); gl.uniform1f(u.uKnee, R.knee);
    const k = kal.on && (kal.where === 0 || kal.where === 3 && kalM) ? (kal.where === 3 ? 2 : 1) : 0;
    gl.uniform1f(u.uKalOn, k); gl.uniform4fv(u.uKal, kal.v); gl.uniform4fv(u.uKal2, kal.v2 || [0, 0, 0, 1]); gl.uniform2f(u.uKalC, kal.c[0], kal.c[1]); gl.uniform2f(u.uAsp, W/H, 1);
    tex(2, k === 2 ? kalM.tex : blankTex(true), u.uKalM);
    gl.uniform2f(u.uGl, fin.gl[0], fin.gl[1]); gl.uniform1f(u.uGrain, fin.grain); gl.uniform1f(u.uT, fin.t); gl.uniform1f(u.uHush, fin.hush); });
}
// the kaleidoscope this frame (P.kal: see main.js): on, where it folds (0 everything, 1 the world, 2 the glow, 3 inside the
// objects), [mirrors, share of one more, how far folded, turn], and its centre. Inside the objects: their silhouettes, at half size
function kalPrep(P){
  fin = {gl: P.glitch || [0, 0], grain: P.grain || 0, t: P.t2 || 0, hush: P.hush || 0};   // the glitch and the film grain, for the finish
  kal = P.kal || {on: false}; kalM = null;
  if (!kal.on || kal.where !== 3) return;
  const obs = OBJECT_VISUALS.filter(o => o.drawGL && P.o[o.key] > .003);
  if (!obs.length) return;
  kalM = kalMT || (kalMT = halfTarget());
  gl.bindFramebuffer(gl.FRAMEBUFFER, kalM.fb); gl.viewport(0, 0, kalM.w, kalM.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  for (const o of obs) o.drawGL(gl, P, W, H, 'cover');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
// the worlds alone, for a world filling an object
const WORLD_FILL = {seg: [{t: 'world'}], first: true, last: false, fill: true, key: 'world-fill'};
// A world that costs much more per pixel than the rest (the cosmos's ground, ray-marched) says how much smaller to draw
// it (lowRes(P) < 1). It's drawn once, alone, at that size, and every segment reads it back, stretched; the glow, hits and
// objects over it stay at full size. It also saves the world being traced twice when an object sits between its planes
const lowSegs = {}, lowSeg = k => lowSegs[k] || (lowSegs[k] = {seg: [{t: 'world'}], first: true, last: false, key: 'world-low:' + k, only: k});
function lowPass(now, P, out){
  for (const sl of slots) sl.on = false;
  const ws = !lowOk ? [] : WORLD_VISUALS.filter(v => (allOwn || v.lowRes) && P.w[v.key] > .003).sort((a, b) => P.w[b.key] - P.w[a.key]).slice(0, allOwn ? 2 : 1);   // (more crossing: the strongest)
  const hv = ws.find(w => w.heavy);
  Q.heavy = !!(hv && hv.heavy(P));   // a slow device draws a heavy world smaller before the whole picture (render/quality.js)
  ws.forEach((w, i) => {
    const s = w.lowRes ? Math.min(1, w.lowRes(P), Q.heavy && w === hv ? Q.world : 1) : 1, sl = slots[i];
    // a heavy world always has its own pass, at full size too (TUNE.render.heavyOwn), so no other shader holds its code
    if (!allOwn && !(s < .999 || (TUNE.render.heavyOwn && w.heavy))) return;
    if (!segProg(lowSeg(w.key), P.sc, P)) return;   // (not built yet: without allOwn the segment traces it meanwhile; with it, it shows once built)
    const lw = Math.max(2, Math.round(W*s)), lh = Math.max(2, Math.round(H*s));
    if (!sl.t || sl.t.w !== lw || sl.t.h !== lh) { drop(sl.t); sl.t = target(lw, lh, false, hdr); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, sl.t.fb); gl.viewport(0, 0, lw, lh); gl.disable(gl.BLEND);
    drawSeg(now, P, lowSeg(w.key), null, 1, out);   // (with the trails, for the glow on its walls)
    sl.on = true; sl.k = w.key;
  });
}
const trailFills = {}, trailFill = g => trailFills[g] || (trailFills[g] = {seg: [{t: 'trails', g}], first: true, last: false, fill: true, key: 'trail-fill:' + g});
// one display segment over the picture so far (under), into whatever is bound
function drawSeg(now, P, st, under, zoom, out = {}, maskOn = [], gain = 1, useLow = false){
  const sc = P.sc, pr = segProg(st, sc, P);
  if (!pr) return;   // (a fill whose shader isn't built yet: it shows next time)
  const v = pr.u;
  gl.useProgram(pr.p); firstUse(pr);
  if (v.uLow) { gl.uniform1f(v.uLow, useLow ? 1 : 0);   // read the world drawn smaller (lowPass), or trace it here
    if (useLow) { gl.activeTexture(gl.TEXTURE0 + UNIT.low); gl.bindTexture(gl.TEXTURE_2D, slots[0].t.tex); gl.uniform1i(v.uLowT, UNIT.low); } }
  if (v.uWa) slots.forEach((sl, i) => {   // the worlds drawn in their own passes (a slot not drawn: weight 0, and a blank picture)
    const unit = i ? UNIT.low2 : UNIT.low; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, sl.on ? sl.t.tex : blankTex(false));
    gl.uniform1i(i ? v.uWtB : v.uWtA, unit); gl.uniform1f(i ? v.uWb : v.uWa, sl.on ? P.w[sl.k] : 0); });
  gl.uniform2f(v.uRes, W, H);
  gl.uniform1f(v.uSpZ, zoom); gl.uniform1f(v.uGain, gain); gl.uniform3fv(v.uPal, P.pal);
  if (v.uFit) { gl.uniform3fv(v.uFit, P.fit); gl.uniform2f(v.uFitSrc, P.cx, P.cy); }
  if (v.uFrontOn) gl.uniform1f(v.uFrontOn, P.frontOn);
  if (v.uKal) { const f = kal.on && zoom === 1 && !st.only;   // the world or the glow folded (not in a fill, nor the world drawn alone)
    gl.uniform4fv(v.uKal, kal.v || [2, 0, 0, 0]); if (v.uKal2) gl.uniform4fv(v.uKal2, kal.v2 || [0, 0, 0, 1]); gl.uniform2f(v.uKalC, (kal.c || [0, 0])[0], (kal.c || [0, 0])[1]);
    gl.uniform1f(v.uKalW, f && kal.where === 1 ? 1 : 0); gl.uniform1f(v.uKalT, f && kal.where === 2 ? 1 : 0); }
  for (const it of st.seg) if (it.drive) gl.uniform1f(v['uK' + it.i], P.kw[it.i] ?? 1);   // (?? : the last scene kept on screen)
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
  for (const w of WORLD_VISUALS) gl.uniform1f(v['uW_' + w.key], st.only ? +(w.key === st.only) : P.w[w.key]);   // (drawn alone: at full weight, faded where it's read)
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
      try { setupGL(); for (const k in blanks) delete blanks[k]; fills = {}; masks = []; groups = {}; surfs = []; fbos = []; blooms = []; kalMT = null;
        S.glGen++; glResize(); lost = false; }
      catch (e) { console.warn(e); toast('The picture was lost: reload the page'); }
    });
  }
  // debounced, and only when the size really changed (phones fire resize as the address bar moves, which wiped the trails)
  let pending = 0;
  addEventListener('resize', () => { clearTimeout(pending); pending = setTimeout(resize, 150); }); resize();
}
let lost = false;
export function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, gl ? 1.5 : 1)*Q.scale;   // Q.scale: drawn smaller while frames run slow
  const w = Math.max(2, Math.floor(innerWidth * dpr)), h = Math.max(2, Math.floor(viewH() * dpr));   // (viewH: less the DJ panel under the picture)
  if (w === W && h === H && (!gl || fbos.length)) return;
  W = w; H = h; canvas.width = W; canvas.height = H;
  if (gl) glResize(); else r2d.resize(W, H);
}
