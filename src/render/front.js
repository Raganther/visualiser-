// What's in front of the centrepiece, drawn over it (a leaf module; scene/space.js): the comets' heads and the orbits'
// flares passing in front of it. The trails draw them too, but the object is drawn over the trails, so without this
// everything would pass behind it. Glowing points, added, after the objects in both renderers.
import { SPACE } from '../scene/space.js';
import { BEAMS } from '../scene/lasers3d.js';

const VS = `attribute vec2 aQ; uniform vec4 uC; uniform float uAsp; varying vec2 vQ;
void main(){ vQ = aQ; vec2 p = uC.xy + aQ*uC.z; gl_Position = vec4(p.x*2.0/uAsp, p.y*2.0, 0.0, 1.0); }`;
const FS = `precision mediump float; varying vec2 vQ; uniform vec4 uK;
void main(){ float d = length(vQ); if (d > 1.0) discard; gl_FragColor = vec4(uK.rgb*uK.a*(exp(-d*d*28.0)*1.4 + exp(-d*d*5.0)*0.35)*(1.0 - d), 1.0); }`;
// a beam: a band along the segment (uA: its ends), its width uW; bright at its core, a glow either side, fading out along it
const LVS = `attribute vec2 aQ; uniform vec4 uA; uniform float uW, uAsp; varying vec2 vQ;
void main(){ vQ = aQ; vec2 a = uA.xy, b = uA.zw, d = normalize(b - a + vec2(1e-6, 0.0)), nn = vec2(-d.y, d.x); vec2 p = mix(a, b, aQ.x*0.5 + 0.5) + nn*aQ.y*uW;
  gl_Position = vec4(p.x*2.0/uAsp, p.y*2.0, 0.0, 1.0); }`;
const LFS = `precision mediump float; varying vec2 vQ; uniform vec4 uK;
void main(){ float y = abs(vQ.y); gl_FragColor = vec4(uK.rgb*uK.a*(exp(-y*y*400.0)*1.6 + exp(-y*y*12.0)*0.3)*(1.0 - 0.45*(vQ.x*0.5 + 0.5)), 1.0); }`;
const PROGS = new WeakMap(), SQ = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
function prog(gl){
  let s = PROGS.get(gl); if (s && gl.isProgram(s.p)) return s;
  const p = gl.createProgram();
  for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(p, x); }
  gl.bindAttribLocation(p, 0, 'aQ'); gl.linkProgram(p);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, SQ, gl.STATIC_DRAW);
  const lp = gl.createProgram();
  for (const [t, src] of [[gl.VERTEX_SHADER, LVS], [gl.FRAGMENT_SHADER, LFS]]) { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(lp, x); }
  gl.bindAttribLocation(lp, 0, 'aQ'); gl.linkProgram(lp);
  PROGS.set(gl, s = {p, b, u: {c: gl.getUniformLocation(p, 'uC'), k: gl.getUniformLocation(p, 'uK'), asp: gl.getUniformLocation(p, 'uAsp')},
    lp, lu: {a: gl.getUniformLocation(lp, 'uA'), w: gl.getUniformLocation(lp, 'uW'), k: gl.getUniformLocation(lp, 'uK'), asp: gl.getUniformLocation(lp, 'uAsp')}});
  return s;
}
// WebGL: after the objects (the caller rebinds its own quad after)
export function frontGL(gl, W, H){
  if (!SPACE.nFront && !BEAMS.n) return;
  const s = prog(gl); if (!gl.getProgramParameter(s.p, gl.LINK_STATUS)) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, s.b); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  if (BEAMS.n && gl.getProgramParameter(s.lp, gl.LINK_STATUS)) {   // the 3D lasers (scene/lasers3d.js)
    gl.useProgram(s.lp); gl.uniform1f(s.lu.asp, W/H);
    for (let i = 0; i < BEAMS.n; i++) { const b = BEAMS.seg[i]; gl.uniform4f(s.lu.a, b[0], b[1], b[2], b[3]); gl.uniform1f(s.lu.w, b[4]*6); gl.uniform4f(s.lu.k, b[5], b[6], b[7], b[8]); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  }
  gl.useProgram(s.p); gl.uniform1f(s.u.asp, W/H);
  for (let i = 0; i < SPACE.nFront; i++) { const f = SPACE.front[i]; gl.uniform4f(s.u.c, f[0], f[1], f[2]*2.2, 0); gl.uniform4f(s.u.k, f[3], f[4], f[5], f[6]); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  gl.disable(gl.BLEND);
}
// simple mode
export function front2d(o){
  if (!SPACE.nFront && !BEAMS.n) return;
  const W = o.canvas.width, H = o.canvas.height;
  o.save(); o.globalCompositeOperation = 'lighter'; o.lineCap = 'round';
  for (let i = 0; i < BEAMS.n; i++) { const b = BEAMS.seg[i], c = [b[5], b[6], b[7]].map(v => Math.round(Math.min(1, v*.7 + .3)*255)).join(','), a = Math.min(1, b[8]);   // the 3D lasers
    o.beginPath(); o.moveTo(W/2 + b[0]*H, H/2 - b[1]*H); o.lineTo(W/2 + b[2]*H, H/2 - b[3]*H);
    o.strokeStyle = `rgba(${c},${(a*.18).toFixed(3)})`; o.lineWidth = b[4]*H*6; o.stroke(); o.strokeStyle = `rgba(${c},${a.toFixed(3)})`; o.lineWidth = Math.max(1, b[4]*H); o.stroke(); }
  for (let i = 0; i < SPACE.nFront; i++) { const f = SPACE.front[i], x = W/2 + f[0]*H, y = H/2 - f[1]*H, r = f[2]*2.2*H, a = Math.min(1, f[6]);
    const c = [f[3], f[4], f[5]].map(v => Math.round(Math.min(1, v*.6 + .4)*255)).join(','), g = o.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(.25, `rgba(${c},${a*.35})`); g.addColorStop(1, `rgba(${c},0)`);
    o.fillStyle = g; o.fillRect(x - r, y - r, 2*r, 2*r); }
  o.restore();
}
