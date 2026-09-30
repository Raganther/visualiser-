// Lit objects: a model baked in Blender (tools/blender/goblin_hd.py bake, packed by lit_export.py) drawn as a solid, textured
// thing under moving lights, like a game character: its colour and an object-space normal map (the sculpt's wrinkles, warts
// and pores) from textures, lit per pixel by three lights, the first casting a real shadow (a depth map from the light:
// the nose's shadow sweeps across the face as the light moves), light glowing through the thin parts (the ears) from
// behind, a highlight on the wet eyes, and the eyes' own glow. A leaf module: no engine imports, so visuals can use it.
// It shares render/mesh.js's camera, so lit and wire objects stand in one space (the cosmos's monument, scenes, masks).
// U, the per-frame settings: rot, pitch, roll, size, pos [x,y], asp, sq (squash), morph (the shape key's weight), w,
// lights: [{p: [x,y,z], c: [r,g,b]} x3] (in the object's space before its turn: the camera looks down -z from z 3.2;
// the object fits a sphere of about .6), amb [r,g,b], glow (the eyes), trans (light through the thin parts), trail.

const CAM = 3.2, FOCAL = 2.6, SHADOW = 1024, EXT = .78;   // (the camera as in render/mesh.js); the shadow map's size and reach

// ---- the asset, decoded once: typed arrays, the textures' images (loading), and simple mode's faces ----
const DEC = new WeakMap();
const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
export function litData(A){
  let d = DEC.get(A); if (d) return d;
  const i16 = s => new Int16Array(bytes(s).buffer), u16 = s => new Uint16Array(bytes(s).buffer), u8 = s => bytes(s);
  const P = i16(A.pos), M = i16(A.morph), UV = u16(A.uv), TH = u8(A.thick), PA = u8(A.part);
  const n = A.n, v = new Float32Array(n*10);   // per corner: pos 3, morph 3, uv 2, thickness, part
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) { v[i*10 + k] = P[i*3 + k]/32767*A.ps; v[i*10 + 3 + k] = M[i*3 + k]/32767*A.ms; }
    v[i*10 + 6] = UV[i*2]/65535; v[i*10 + 7] = 1 - UV[i*2 + 1]/65535; v[i*10 + 8] = TH[i]/255*.12; v[i*10 + 9] = PA[i];
  }
  const img = src => { const im = new Image(); im.src = src; return im; };
  d = {v, tri: u16(A.tri), img: {col: img(A.color), nrm: img(A.normal), em: img(A.emit)}};
  DEC.set(A, d); return d;
}

// ---- WebGL ----
const VS = `
attribute vec3 aPos, aMorph; attribute vec2 aUV, aInfo;   // info: thickness, part (1 skin, 2 teeth, 3 eyes, 4 brass)
uniform float uMorph, uRot, uPitch, uRoll, uSq, uSize, uAsp, uStage; uniform vec2 uPos; uniform vec3 uLx, uLy, uLz;
varying vec2 vUV; varying vec3 vW, vSh; varying float vThick, vPart;
vec3 rx(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z); }
vec3 ry(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z); }
vec3 rz(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z); }
void main(){
  vec3 p=(aPos+aMorph*uMorph)*vec3(1.0+uSq*0.5,1.0-uSq,1.0+uSq*0.5);
  p=rz(rx(ry(p,uRot),uPitch),uRoll);
  vW=p; vUV=aUV; vThick=aInfo.x; vPart=aInfo.y;
  vSh=vec3(dot(p,uLx),dot(p,uLy),-dot(p,uLz))/${EXT.toFixed(2)}*0.5+0.5;          // where it falls in the key light's depth map
  if(uStage>2.5){ gl_Position=vec4(vSh*2.0-1.0,1.0); return; }                   // drawing that depth map: seen from the light
  float w=${CAM.toFixed(1)}-p.z, k=uSize*${FOCAL.toFixed(1)};                    // the camera's perspective, kept in w so the
  gl_Position=vec4((uPos.x*w+p.x*k)*2.0/uAsp,(uPos.y*w+p.y*k)*2.0,-p.z/3.0*w,w); // textures don't swim (as render/mesh.js places it)
}`;
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uCol, uNrm, uEm, uShMap; uniform mat3 uR;
uniform vec3 uLp[3], uLc[3], uAmb; uniform float uGlow, uW, uStage, uShOn, uTrans;
varying vec2 vUV; varying vec3 vW, vSh; varying float vThick, vPart;
vec4 pack(float d){ vec4 e=fract(d*vec4(1.0,255.0,65025.0,16581375.0)); return e-e.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0); }
float unpack(vec4 c){ return dot(c,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0)); }
float shadow(vec3 s){   // the key light's shadow, softened over nine taps
  if(s.x<0.0||s.x>1.0||s.y<0.0||s.y>1.0) return 1.0;
  float sum=0.0;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) sum+=step(s.z-0.006,unpack(texture2D(uShMap,s.xy+vec2(float(i),float(j))*${(1.6/SHADOW).toFixed(5)})));
  return sum/9.0;
}
void main(){
  if(uStage>2.5){ gl_FragColor=pack(gl_FragCoord.z); return; }   // the depth map
  if(uStage>1.5){ gl_FragColor=vec4(1.0); return; }              // its silhouette, for masks
  vec3 alb=pow(texture2D(uCol,vUV).rgb,vec3(2.2));
  if(vPart>3.5) alb=vec3(0.8,0.52,0.2);   // (metal bakes no diffuse colour: brass is its own)
  vec3 nb=texture2D(uNrm,vUV).rgb*2.0-1.0, n=normalize(uR*vec3(nb.x,nb.z,-nb.y));   // (baked in Blender's axes, z up: turned to ours)
  vec3 V=normalize(vec3(0.0,0.0,${CAM.toFixed(1)})-vW);
  bool skin=vPart<1.5, teeth=vPart>1.5&&vPart<2.5, eye=vPart>2.5&&vPart<3.5, brass=vPart>3.5;
  float wrap=skin ? 0.35 : teeth ? 0.15 : 0.0, gloss=skin ? 28.0 : teeth ? 70.0 : eye ? 900.0 : 120.0, ks=skin ? 0.22 : teeth ? 0.35 : eye ? 2.5 : 1.4;
  float thin=skin ? 1.0-smoothstep(0.012,0.07,vThick) : 0.0;
  vec3 c=alb*uAmb*(0.55+0.45*n.y)*(brass ? 0.3 : 1.0);
  for(int i=0;i<3;i++){
    vec3 L=uLp[i]-vW; float d=length(L); L/=d;
    vec3 lc=uLc[i]/(1.0+d*d*0.12);
    float ndl=dot(n,L), sh=(i==0&&uShOn>0.5) ? shadow(vSh) : 1.0;
    float dif=max((ndl+wrap)/(1.0+wrap),0.0);
    float sp=pow(max(dot(n,normalize(L+V)),0.0),gloss)*ks*step(0.0,ndl);
    c+=lc*sh*((brass ? alb*0.08 : alb)*dif+(brass ? alb*sp*2.0 : vec3(sp)));
    c+=lc*thin*uTrans*vec3(1.0,0.35,0.18)*(0.08+alb*1.5)*(pow(max(dot(V,-L),0.0),3.0)*1.6+max(-ndl,0.0)*0.35);   // through the ears, from behind
  }
  c+=(skin ? alb*0.8 : vec3(0.0))*uAmb*pow(1.0-max(dot(n,V),0.0),3.0);   // a soft rim of the world's light
  if(brass) c+=alb*(0.25+uAmb*3.0)*(0.4+0.6*pow(1.0-max(dot(n,V),0.0),2.0));   // metal: a stand-in for what it reflects
  if(eye) c+=pow(texture2D(uEm,vUV).rgb,vec3(2.2))*uGlow*4.0;             // the eyes' glow
  c=pow(c,vec3(1.0/2.2));
  gl_FragColor=vec4(c*uW,uW);
}`;

const ATT = ['aPos', 'aMorph', 'aUV', 'aInfo'], PROGS = new WeakMap();
function prog(gl){
  let s = PROGS.get(gl);
  if (s && gl.isProgram(s.p)) return s;
  const p = gl.createProgram(), sh = [[gl.VERTEX_SHADER, 'precision highp float;' + VS], [gl.FRAGMENT_SHADER, FS]].map(([t, src]) => {
    const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(p, x); return x; });
  ATT.forEach((a, i) => gl.bindAttribLocation(p, i + 1, a));   // attribute 0 stays the engine's full-screen quad
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(sh.map(x => gl.getShaderInfoLog(x)).join('') || gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace('[0]', '')] = gl.getUniformLocation(p, a.name); }
  PROGS.set(gl, s = {p, u}); return s;
}
// the rotation of a normal: the same turns as the corners (ry, then rx, then rz), as a column-major mat3
function turn(U){
  const cy = Math.cos(U.rot), sy = Math.sin(U.rot), cx = Math.cos(U.pitch), sx = Math.sin(U.pitch), cz = Math.cos(U.roll || 0), sz = Math.sin(U.roll || 0);
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0]*B[0][j] + r[1]*B[1][j] + r[2]*B[2][j]));
  const R = mul(Rz, mul(Rx, Ry)); return new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
}
// the key light's view: a basis looking from the light at the object
function lightBasis(p){
  const l = Math.hypot(...p) || 1, z = p.map(x => x/l), up = Math.abs(z[1]) > .95 ? [1, 0, 0] : [0, 1, 0];
  const x = [up[1]*z[2] - up[2]*z[1], up[2]*z[0] - up[0]*z[2], up[0]*z[1] - up[1]*z[0]], xl = Math.hypot(...x); for (let k = 0; k < 3; k++) x[k] /= xl;
  return [x, [z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0]], z];
}
export const litWarm = gl => { try { prog(gl); } catch (e) {} };
export function litGL(gl, A){
  const D = litData(A), {p, u} = prog(gl);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, D.v, gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, D.tri, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  const tex = {}, ready = () => ['col', 'nrm', 'em'].every(k => tex[k] || (D.img[k].complete && D.img[k].naturalWidth && (tex[k] = upload(D.img[k]))));
  function upload(im){
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // the key light's depth map: its own small surface with depth
  const sm = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, sm);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW, SHADOW, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW, SHADOW);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sm, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  const shOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const bind = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.disableVertexAttribArray(0);
    [[3, 0], [3, 12], [2, 24], [2, 32]].forEach(([n, o], i) => { gl.enableVertexAttribArray(i + 1); gl.vertexAttribPointer(i + 1, n, gl.FLOAT, false, 40, o); });
  };
  const unbind = () => { ATT.forEach((a, i) => gl.disableVertexAttribArray(i + 1)); gl.enableVertexAttribArray(0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); };
  const draw = () => gl.drawElements(gl.TRIANGLES, D.tri.length, gl.UNSIGNED_SHORT, 0);
  // 'screen': its depth map from the key light, then lit on the picture (depth-tested against itself); 'trails': lit,
  // dim and added (its ghosts); 'cover': flat white, for a mask
  return function drawLit(U, W, H, stage){
    if (stage !== 'cover' && !ready()) return;   // (the textures are still decoding: a frame or two after the page loads)
    gl.useProgram(p); bind();
    gl.uniform1f(u.uMorph, U.morph || 0); gl.uniform1f(u.uRot, U.rot); gl.uniform1f(u.uPitch, U.pitch); gl.uniform1f(u.uRoll, U.roll || 0);
    gl.uniform1f(u.uSq, U.sq || 0); gl.uniform1f(u.uSize, U.size); gl.uniform1f(u.uAsp, W/H); gl.uniform2f(u.uPos, U.pos[0], U.pos[1]);
    const [lx, ly, lz] = lightBasis(U.lights[0].p); gl.uniform3fv(u.uLx, lx); gl.uniform3fv(u.uLy, ly); gl.uniform3fv(u.uLz, lz);
    if (stage === 'cover') { gl.uniform1f(u.uStage, 2); draw(); unbind(); return; }
    const shadows = stage === 'screen' && shOk && U.shadow !== false;
    if (shadows) {   // the depth map, seen from the key light
      const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, SHADOW, SHADOW);
      gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
      gl.uniform1f(u.uStage, 3); draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb); gl.viewport(vp[0], vp[1], vp[2], vp[3]); gl.disable(gl.DEPTH_TEST);
    }
    gl.uniform1f(u.uStage, 0); gl.uniform1f(u.uShOn, shadows ? 1 : 0);
    gl.uniformMatrix3fv(u.uR, false, turn(U));
    gl.uniform3fv(u.uLp, U.lights.flatMap(l => l.p)); gl.uniform3fv(u.uLc, U.lights.flatMap(l => l.c)); gl.uniform3fv(u.uAmb, U.amb);
    gl.uniform1f(u.uGlow, U.glow); gl.uniform1f(u.uTrans, U.trans);
    [[5, tex.col, u.uCol], [6, tex.nrm, u.uNrm], [7, tex.em, u.uEm], [4, sm, u.uShMap]].forEach(([k, t, loc]) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, k); });
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    if (stage === 'trails') {   // no depth in the trails: the near side only, dim, added
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.blendFunc(gl.ONE, gl.ONE); gl.uniform1f(u.uW, U.w*U.trail); draw(); gl.disable(gl.CULL_FACE);
    } else {
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(u.uW, U.w); draw();
      gl.disable(gl.DEPTH_TEST);
    }
    gl.disable(gl.BLEND); unbind();
  };
}

// ---- simple mode: the far lower mesh, each face its baked colour, lit by the same lights (flat, no shadow) ----
export function litLod(A){
  const L = A.lod, nf = L.tri.length/3, col = new Float32Array(nf*3);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) { let s = 0; for (let j = 0; j < 3; j++) s += (L.col[L.tri[f*3 + j]*3 + k]/255)**2.2; col[f*3 + k] = s/3; }
  return {pos: L.pos, tri: L.tri, part: L.part, morph: L.morph, col};
}
function project(o, M, U){
  const Wc = o.canvas.width, Hc = o.canvas.height, key = Wc + 'x' + Hc;
  if (U.proj && U.proj.key === key) return U.proj;   // once a frame: a mask and the drawing share it
  const cy = Math.cos(U.rot), sy = Math.sin(U.rot), cx = Math.cos(U.pitch), sx = Math.sin(U.pitch), cz = Math.cos(U.roll || 0), sz = Math.sin(U.roll || 0);
  const sq = U.sq || 0, m = U.morph || 0, n = M.pos.length/3, P = new Float32Array(n*3), S2 = new Float32Array(n*2), sc = Hc*U.size*FOCAL;
  for (let i = 0; i < n; i++) {
    let x = (M.pos[i*3] + M.morph[i*3]*m)*(1 + sq*.5), y = (M.pos[i*3 + 1] + M.morph[i*3 + 1]*m)*(1 - sq), z = (M.pos[i*3 + 2] + M.morph[i*3 + 2]*m)*(1 + sq*.5);
    const x1 = cy*x + sy*z, z1 = -sy*x + cy*z, y2 = cx*y - sx*z1, z2 = sx*y + cx*z1;
    x = cz*x1 - sz*y2; y = sz*x1 + cz*y2; z = z2;
    P[i*3] = x; P[i*3 + 1] = y; P[i*3 + 2] = z;
    const w = sc/(CAM - z); S2[i*2] = Wc/2 + U.pos[0]*Hc + x*w; S2[i*2 + 1] = Hc/2 - U.pos[1]*Hc - y*w;
  }
  const faces = [];
  for (let f = 0; f < M.tri.length; f += 3) {
    const a = M.tri[f]*3, b = M.tri[f + 1]*3, c = M.tri[f + 2]*3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const zc = (P[a + 2] + P[b + 2] + P[c + 2])/3;
    faces.push({f: f/3, a: M.tri[f], b: M.tri[f + 1], c: M.tri[f + 2], n: [nx, ny, nz], z: zc, w: [(P[a] + P[b] + P[c])/3, (P[a + 1] + P[b + 1] + P[c + 1])/3, zc]});
  }
  faces.sort((p, q) => p.z - q.z);
  return (U.proj = {key, S2, faces});
}
export function litPath2d(o, M, U){
  const {S2, faces} = project(o, M, U); o.beginPath();
  for (const F of faces) { o.moveTo(S2[F.a*2], S2[F.a*2 + 1]); o.lineTo(S2[F.b*2], S2[F.b*2 + 1]); o.lineTo(S2[F.c*2], S2[F.c*2 + 1]); o.closePath(); }
}
export function lit2d(o, M, U){
  const {S2, faces} = project(o, M, U);
  o.globalCompositeOperation = 'source-over'; o.globalAlpha = Math.min(1, U.w);
  for (const F of faces) {
    const [nx, ny, nz] = F.n, pt = M.part[F.f], skin = pt === 1, eye = pt === 3;
    const vx = -F.w[0], vy = -F.w[1], vz = CAM - F.w[2], vl = Math.hypot(vx, vy, vz);
    if ((nx*vx + ny*vy + nz*vz)/vl < -.05) continue;   // facing away
    const al = [M.col[F.f*3], M.col[F.f*3 + 1], M.col[F.f*3 + 2]], c = al.map((x, k) => x*U.amb[k]*(.55 + .45*ny));
    for (const Lt of U.lights) {
      let lx = Lt.p[0] - F.w[0], ly = Lt.p[1] - F.w[1], lz = Lt.p[2] - F.w[2]; const d = Math.hypot(lx, ly, lz); lx /= d; ly /= d; lz /= d;
      const ndl = nx*lx + ny*ly + nz*lz, wrap = skin ? .35 : 0, dif = Math.max(0, (ndl + wrap)/(1 + wrap)), att = 1/(1 + d*d*.12);
      const hx = lx + vx/vl, hy = ly + vy/vl, hz = lz + vz/vl, hl = Math.hypot(hx, hy, hz), sp = ndl > 0 ? Math.pow(Math.max(0, (nx*hx + ny*hy + nz*hz)/hl), eye ? 200 : 28)*(eye ? 1.5 : .2) : 0;
      for (let k = 0; k < 3; k++) c[k] += Lt.c[k]*att*(al[k]*dif + sp);
    }
    if (eye) { c[0] += U.glow*.6; c[1] += U.glow*.3; }
    const rgb = c.map(x => Math.min(255, Math.round(Math.pow(Math.max(0, x), 1/2.2)*255)));
    o.beginPath(); o.moveTo(S2[F.a*2], S2[F.a*2 + 1]); o.lineTo(S2[F.b*2], S2[F.b*2 + 1]); o.lineTo(S2[F.c*2], S2[F.c*2 + 1]); o.closePath();
    o.fillStyle = `rgb(${rgb})`; o.fill(); o.strokeStyle = o.fillStyle; o.lineWidth = .8; o.stroke();   // (its own colour round the edge: no seams)
  }
  o.globalAlpha = 1;
}
