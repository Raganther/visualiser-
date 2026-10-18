// What's in front of the centrepiece, drawn over it (a leaf module; scene/space.js): the comets' heads and the orbits'
// flares passing in front of it. The trails draw them too, but the object is drawn over the trails, so without this
// everything would pass behind it. Glowing points, added, after the objects in both renderers.
import { SPACE } from '../scene/space.js';

const VS = `attribute vec2 aQ; uniform vec4 uC; uniform float uAsp; varying vec2 vQ;
void main(){ vQ = aQ; vec2 p = uC.xy + aQ*uC.z; gl_Position = vec4(p.x*2.0/uAsp, p.y*2.0, 0.0, 1.0); }`;
const FS = `precision mediump float; varying vec2 vQ; uniform vec4 uK;
void main(){ float d = length(vQ); if (d > 1.0) discard; gl_FragColor = vec4(uK.rgb*uK.a*(exp(-d*d*28.0)*1.4 + exp(-d*d*5.0)*0.35)*(1.0 - d), 1.0); }`;
const PROGS = new WeakMap(), SQ = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
function prog(gl){
  let s = PROGS.get(gl); if (s && gl.isProgram(s.p)) return s;
  const p = gl.createProgram();
  for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(p, x); }
  gl.bindAttribLocation(p, 0, 'aQ'); gl.linkProgram(p);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, SQ, gl.STATIC_DRAW);
  PROGS.set(gl, s = {p, b, u: {c: gl.getUniformLocation(p, 'uC'), k: gl.getUniformLocation(p, 'uK'), asp: gl.getUniformLocation(p, 'uAsp')}});
  return s;
}
// WebGL: after the objects (the caller rebinds its own quad after)
export function frontGL(gl, W, H){
  if (!SPACE.nFront) return;
  const s = prog(gl); if (!gl.getProgramParameter(s.p, gl.LINK_STATUS)) return;
  gl.useProgram(s.p); gl.bindBuffer(gl.ARRAY_BUFFER, s.b); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(s.u.asp, W/H); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = 0; i < SPACE.nFront; i++) { const f = SPACE.front[i]; gl.uniform4f(s.u.c, f[0], f[1], f[2]*2.2, 0); gl.uniform4f(s.u.k, f[3], f[4], f[5], f[6]); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  gl.disable(gl.BLEND);
}
// simple mode
export function front2d(o){
  if (!SPACE.nFront) return;
  const W = o.canvas.width, H = o.canvas.height;
  o.save(); o.globalCompositeOperation = 'lighter';
  for (let i = 0; i < SPACE.nFront; i++) { const f = SPACE.front[i], x = W/2 + f[0]*H, y = H/2 - f[1]*H, r = f[2]*2.2*H, a = Math.min(1, f[6]);
    const c = [f[3], f[4], f[5]].map(v => Math.round(Math.min(1, v*.6 + .4)*255)).join(','), g = o.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(.25, `rgba(${c},${a*.35})`); g.addColorStop(1, `rgba(${c},0)`);
    o.fillStyle = g; o.fillRect(x - r, y - r, 2*r, 2*r); }
  o.restore();
}
