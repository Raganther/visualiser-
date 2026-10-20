// Lit objects: a model baked in Blender (tools/blender/lit_kit.py or goblin_hd.py bake, packed by lit_export.py) drawn as
// a solid, textured thing under moving lights, like a game character: its colour and an object-space normal map (the
// sculpt's wrinkles, warts and pores) from textures, lit per pixel by three lights, the first casting a real shadow (a depth
// map from the light: the nose's shadow sweeps across the face as the light moves), light glowing through the thin parts
// from behind, a highlight on the wet eyes, and the eyes' own glow. A leaf module: no engine imports, so visuals can use it.
// It shares render/mesh.js's camera, so lit and wire objects stand in one space (the cosmos's monument, scenes, masks).
// Its looks (U.look): 0 real, 1 toon (flat bands of light, inked edges), 2 neon (black, contour lines and a rim in the
// palette's colours), 3 chrome (a studio reflected in it), 4 marble (a white stone statue, veined).
// A model can bend along its height (a spine: the tentacle writhing): nine joints up it, each turning what's above it.
// U, the per-frame settings: rot, pitch, roll, size, pos [x,y], asp, sq (squash), morph (the shape key's weight), w,
// lights: [{p: [x,y,z], c: [r,g,b]} x3] (in the object's space before its turn: the camera looks down -z from z 3.2;
// the object fits a sphere of about .6), amb [r,g,b], glow (the eyes), trans (light through the thin parts), trail, look,
// neon [[r,g,b] x2], and bend: {z: [9 angles], x: [9 angles]} (radians, at each joint, about z and about x).
import { mark } from './stalls.js';

const CAM = 3.2, FOCAL = 2.6, SHADOW = 1024, EXT = .78, NJ = 9;   // (the camera as in render/mesh.js); the shadow map's size and reach; the spine's joints

// ---- the asset, decoded once: typed arrays, the textures' images (loading), the spine ----
const DEC = new WeakMap();
const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
// the spine's joints: evenly up its height, each at the middle of the model's slice there (x, y, z, half the blend's width)
function spineOf(pos, stride){
  let y0 = 1e9, y1 = -1e9; for (let i = 1; i < pos.length; i += stride) { y0 = Math.min(y0, pos[i]); y1 = Math.max(y1, pos[i]); }
  const h = (y1 - y0)/(NJ + 1), J = new Float32Array(NJ*4);
  for (let j = 0; j < NJ; j++) {
    const y = y0 + (j + 1)*h; let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < pos.length; i += stride) if (Math.abs(pos[i + 1] - y) < h*.5) { sx += pos[i]; sz += pos[i + 2]; n++; }
    J.set([n ? sx/n : 0, y, n ? sz/n : 0, h*.6], j*4);
  }
  return J;
}
export function litData(A, bend){
  let d = DEC.get(A); if (d) return d;
  const i16 = s => new Int16Array(bytes(s).buffer), u16 = s => new Uint16Array(bytes(s).buffer), u8 = s => bytes(s);
  const P = i16(A.pos), M = i16(A.morph), UV = u16(A.uv), TH = u8(A.thick), PA = u8(A.part);
  const n = A.n, v = new Float32Array(n*10);   // per corner: pos 3, morph 3, uv 2, thickness, part
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) { v[i*10 + k] = P[i*3 + k]/32767*A.ps; v[i*10 + 3 + k] = M[i*3 + k]/32767*A.ms; }
    v[i*10 + 6] = UV[i*2]/65535; v[i*10 + 7] = 1 - UV[i*2 + 1]/65535; v[i*10 + 8] = TH[i]/255*.12; v[i*10 + 9] = PA[i];
  }
  const img = src => { const im = new Image(); im.src = src; return im; };
  d = {v, tri: u16(A.tri), img: {col: img(A.color), nrm: img(A.normal), em: img(A.emit)}, spine: bend ? spineOf(v, 10) : null};
  DEC.set(A, d); return d;
}

// ---- WebGL ----
const VS = `
attribute vec3 aPos, aMorph; attribute vec2 aUV, aInfo;   // info: thickness, part (1 organic, 2 hard and glossy, 3 eyes, 4 metal)
uniform float uMorph, uRot, uPitch, uRoll, uSq, uSize, uAsp, uStage, uBend; uniform vec2 uPos; uniform vec3 uLx, uLy, uLz;
uniform vec4 uJ[${NJ}]; uniform vec2 uBA[${NJ}];
varying vec2 vUV; varying vec3 vW, vSh, vO, vB0, vB1, vB2; varying float vThick, vPart;
vec3 rx(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z); }
vec3 ry(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z); }
vec3 rz(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z); }
mat3 mz(float a){ float c=cos(a),s=sin(a); return mat3(c,s,0.0,-s,c,0.0,0.0,0.0,1.0); }
mat3 mx(float a){ float c=cos(a),s=sin(a); return mat3(1.0,0.0,0.0,0.0,c,s,0.0,-s,c); }
void main(){
  vec3 p=aPos+aMorph*uMorph; mat3 B=mat3(1.0);
  if(uBend>0.5){   // the spine, top joint first: each turns what's above it about its own pivot (blended across the joint)
    for(int j=${NJ - 1};j>=0;j--){
      float w=smoothstep(uJ[j].y-uJ[j].w,uJ[j].y+uJ[j].w,aPos.y);
      if(w>0.0){ vec3 pv=uJ[j].xyz; mat3 R=mz(uBA[j].x*w)*mx(uBA[j].y*w); p=pv+R*(p-pv); B=R*B; }
    }
  }
  vO=p; vB0=B[0]; vB1=B[1]; vB2=B[2];
  p*=vec3(1.0+uSq*0.5,1.0-uSq,1.0+uSq*0.5);
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
uniform vec3 uLp[3], uLc[3], uAmb, uNeon[2]; uniform float uGlow, uW, uStage, uShOn, uTrans, uLook;
varying vec2 vUV; varying vec3 vW, vSh, vO, vB0, vB1, vB2; varying float vThick, vPart;
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
  vec3 nb=texture2D(uNrm,vUV,uLook>2.5&&uLook<3.5 ? 2.5 : 0.0).rgb*2.0-1.0;   // (chrome reads the normals blurred: skin's fine bumps scatter a mirror)
  vec3 n=normalize(uR*(mat3(vB0,vB1,vB2)*vec3(nb.x,nb.z,-nb.y)));   // (baked in Blender's axes, z up: turned to ours, then bent and turned)
  vec3 V=normalize(vec3(0.0,0.0,${CAM.toFixed(1)})-vW);
  bool skin=vPart<1.5, hard=vPart>1.5&&vPart<2.5, eye=vPart>2.5&&vPart<3.5, metal=vPart>3.5;
  float wrap=skin ? 0.35 : hard ? 0.15 : 0.0, gloss=skin ? 28.0 : hard ? 70.0 : eye ? 900.0 : 120.0, ks=skin ? 0.22 : hard ? 0.35 : eye ? 2.5 : 1.4;
  float thin=skin ? 1.0-smoothstep(0.012,0.07,vThick) : 0.0;
  float ed=max(dot(n,V),0.0), fres=pow(1.0-ed,3.0);
  vec3 c=vec3(0.0), lsum=vec3(0.0);
  if(uLook<0.5||uLook>3.5){   // real, or marble
    float mb=0.0;
    if(uLook>3.5){   // marble: white stone with winding grey veins, glossy, a little light passing into it
      float v=sin(vO.x*14.0+sin(vO.y*9.0+vO.z*6.0)*2.4+sin(vO.z*17.0+vO.x*5.0)*1.3), v2=sin(vO.y*13.0+sin(vO.x*11.0)*1.5);
      float v3=sin(vO.x*31.0+vO.y*23.0+sin(vO.z*27.0+vO.y*9.0)*2.2);
      mb=max(1.0-smoothstep(0.0,0.12,abs(v)),(1.0-smoothstep(0.0,0.07,abs(v3)))*0.55); alb=mix(vec3(0.36,0.35,0.335),vec3(0.06,0.06,0.07),mb*0.9)*(0.9+0.1*v2);
      wrap=0.5; gloss=90.0; ks=0.45; thin*=0.3; metal=false;
    }
    c=alb*uAmb*(0.55+0.45*n.y)*(metal ? 0.3 : 1.0);
    for(int i=0;i<3;i++){
      vec3 L=uLp[i]-vW; float d=length(L); L/=d;
      vec3 lc=uLc[i]/(1.0+d*d*0.12);
      float ndl=dot(n,L), sh=(i==0&&uShOn>0.5) ? shadow(vSh) : 1.0;
      float dif=max((ndl+wrap)/(1.0+wrap),0.0);
      float sp=pow(max(dot(n,normalize(L+V)),0.0),gloss)*ks*step(0.0,ndl);
      c+=lc*sh*((metal ? alb*0.08 : alb)*dif+(metal ? alb*sp*2.0 : vec3(sp)));
      c+=lc*thin*uTrans*vec3(1.0,0.35,0.18)*(0.08+alb*1.5)*(pow(max(dot(V,-L),0.0),3.0)*1.6+max(-ndl,0.0)*0.35);   // through thin parts, from behind
    }
    c+=(skin ? alb*0.8 : vec3(0.0))*uAmb*fres;   // a soft rim of the world's light
    if(metal) c+=alb*(0.25+uAmb*3.0)*(0.4+0.6*pow(1.0-ed,2.0));   // metal: a stand-in for what it reflects
    if(eye&&uLook<0.5) c+=pow(texture2D(uEm,vUV).rgb,vec3(2.2))*uGlow*4.0;   // the eyes' glow
  } else if(uLook<1.5){   // toon: its colours, brighter and flatter, in two bands of light; hard highlights; inked where it turns away
    vec3 tc=pow(texture2D(uCol,vUV).rgb,vec3(1.4))*1.5; if(metal) tc=vec3(1.0,0.75,0.3);
    c=tc*uAmb*1.5;
    for(int i=0;i<3;i++){
      vec3 L=uLp[i]-vW; float d=length(L); L/=d; vec3 lc=uLc[i]/(1.0+d*d*0.12);
      float ndl=dot(n,L), sh=(i==0&&uShOn>0.5) ? step(0.5,shadow(vSh)) : 1.0;
      float band=smoothstep(0.02,0.06,ndl)*0.55+smoothstep(0.5,0.54,ndl)*0.45;
      c+=lc*sh*(tc*band*0.6+vec3(smoothstep(0.93,0.95,dot(n,normalize(L+V))))*0.35);
    }
    c*=smoothstep(0.16,0.3,ed);   // the ink line
    if(eye) c+=pow(texture2D(uEm,vUV).rgb,vec3(2.2))*uGlow*3.0;
  } else if(uLook<2.5){   // neon: black, contour lines up it and a rim, in the palette's colours, brighter where the lights fall
    float lum=0.25;
    for(int i=0;i<3;i++){ vec3 L=uLp[i]-vW; float d=length(L); L/=d; lum+=max(dot(n,L),0.0)*length(uLc[i])/(1.0+d*d*0.12)*0.25; }
    float h=vO.y*26.0+vO.x*2.0+vO.z*1.5, f=fract(h), line=1.0-smoothstep(0.03,0.1,min(f,1.0-f));
    c=alb*0.02+uNeon[0]*line*min(lum,2.0)*1.2+uNeon[1]*pow(1.0-ed,5.0)*1.3;
    if(eye) c+=uNeon[1]*uGlow*2.0;
  } else {   // chrome: a studio reflected in it (dark floor, a coloured horizon, a bright sky, the lights as strips)
    vec3 r=reflect(-V,n);
    vec3 env=mix(vec3(0.05,0.05,0.06)+uNeon[1]*0.04,mix(uNeon[1]*0.35,vec3(0.8,0.82,0.86),smoothstep(0.05,0.8,r.y)),smoothstep(-0.12,0.1,r.y));
    env+=uNeon[0]*pow(max(0.0,1.0-abs(r.y-0.02)*7.0),3.0)*0.9;
    for(int i=0;i<3;i++){ vec3 L=normalize(uLp[i]-vW); env+=uLc[i]*pow(max(dot(r,L),0.0),60.0)*0.6; }
    c=env*(metal ? vec3(1.0,0.75,0.4) : vec3(0.92,0.94,1.0))*(0.25+0.75*smoothstep(0.02,0.25,dot(alb,vec3(0.3,0.6,0.1))*3.0));
  }
  c=pow(max(c,vec3(0.0)),vec3(1.0/2.2));
  gl_FragColor=vec4(c*uW,uW);
}`;

const ATT = ['aPos', 'aMorph', 'aUV', 'aInfo'], PROGS = new WeakMap();
// started at idle (litWarm) and read once the driver has built it; null until then, where the driver can say
// (KHR_parallel_shader_compile): waiting for it froze the picture
function prog(gl){
  let s = PROGS.get(gl);
  if (!s || !gl.isProgram(s.p)) {
    const p = gl.createProgram(), sh = [[gl.VERTEX_SHADER, 'precision highp float;' + VS], [gl.FRAGMENT_SHADER, FS]].map(([t, src]) => {
      const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(p, x); return x; });
    ATT.forEach((a, i) => gl.bindAttribLocation(p, i + 1, a));   // attribute 0 stays the engine's full-screen quad
    gl.linkProgram(p); PROGS.set(gl, s = {p, sh, u: null}); mark('shader started: lit objects');
  }
  if (!s.u) {
    const x = gl.getExtension('KHR_parallel_shader_compile');
    if (x && !gl.getProgramParameter(s.p, x.COMPLETION_STATUS_KHR)) return null;
    if (!gl.getProgramParameter(s.p, gl.LINK_STATUS)) throw new Error(s.sh.map(x => gl.getShaderInfoLog(x)).join('') || gl.getProgramInfoLog(s.p));
    const u = {}; for (let i = 0, n = gl.getProgramParameter(s.p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(s.p, i); u[a.name.replace('[0]', '')] = gl.getUniformLocation(s.p, a.name); }
    s.u = u; mark('shader linked: lit objects');
  }
  return s;
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
const ZERO = new Float32Array(NJ*2);
export const litWarm = gl => { try { prog(gl); } catch (e) {} };
export function litGL(gl, A, bend){   // null while the program is still being built: the object shows once it is
  const pr = prog(gl); if (!pr) return null;
  const D = litData(A, bend), {p, u} = pr;
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
  const BA = new Float32Array(NJ*2);

  const bind = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.disableVertexAttribArray(0);
    [[3, 0], [3, 12], [2, 24], [2, 32]].forEach(([n, o], i) => { gl.enableVertexAttribArray(i + 1); gl.vertexAttribPointer(i + 1, n, gl.FLOAT, false, 40, o); });
  };
  const unbind = () => { ATT.forEach((a, i) => gl.disableVertexAttribArray(i + 1)); gl.enableVertexAttribArray(0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); };
  const draw = () => gl.drawElements(gl.TRIANGLES, D.tri.length, gl.UNSIGNED_SHORT, 0);
  // 'screen': its depth map from the key light, then lit on the picture (depth-tested against itself); 'trails': lit,
  // dim and added (its ghosts); 'cover': flat white, for a mask
  const texs = shm => { [[5, tex.col || null, u.uCol], [6, tex.nrm || null, u.uNrm], [7, tex.em || null, u.uEm], [4, shm, u.uShMap]].forEach(([k, t, loc]) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, k); });
    gl.activeTexture(gl.TEXTURE0); };
  return function drawLit(U, W, H, stage){
    if (stage !== 'cover' && !ready()) return;   // (the textures are still decoding: a frame or two after the page loads)
    gl.useProgram(p); bind();
    gl.uniform1f(u.uMorph, U.morph || 0); gl.uniform1f(u.uRot, U.rot); gl.uniform1f(u.uPitch, U.pitch); gl.uniform1f(u.uRoll, U.roll || 0);
    gl.uniform1f(u.uSq, U.sq || 0); gl.uniform1f(u.uSize, U.size); gl.uniform1f(u.uAsp, W/H); gl.uniform2f(u.uPos, U.pos[0], U.pos[1]);
    const bent = !!(D.spine && U.bend); gl.uniform1f(u.uBend, bent ? 1 : 0);
    if (bent) { for (let j = 0; j < NJ; j++) { BA[j*2] = U.bend.z[j] || 0; BA[j*2 + 1] = U.bend.x[j] || 0; } gl.uniform4fv(u.uJ, D.spine); gl.uniform2fv(u.uBA, BA); }
    else gl.uniform2fv(u.uBA, ZERO);
    const [lx, ly, lz] = lightBasis(U.lights[0].p); gl.uniform3fv(u.uLx, lx); gl.uniform3fv(u.uLy, ly); gl.uniform3fv(u.uLz, lz);
    // its own textures on its samplers' units before any draw: a unit still holding the surface being drawn into (the
    // shadow map in its own pass, a mask drawn on 4 or 5) is a feedback loop, and the browser refuses the draw
    texs(null);
    if (stage === 'cover') { gl.uniform1f(u.uStage, 2); draw(); unbind(); return; }
    const shadows = stage === 'screen' && shOk && U.shadow !== false && U.look !== 2 && U.look !== 3;   // (neon and chrome cast none)
    if (shadows) {   // the depth map, seen from the key light
      const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, SHADOW, SHADOW);
      gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
      gl.uniform1f(u.uStage, 3); draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb); gl.viewport(vp[0], vp[1], vp[2], vp[3]); gl.disable(gl.DEPTH_TEST);
    }
    gl.uniform1f(u.uStage, 0); gl.uniform1f(u.uShOn, shadows ? 1 : 0); gl.uniform1f(u.uLook, U.look || 0);
    gl.uniformMatrix3fv(u.uR, false, turn(U));
    gl.uniform3fv(u.uLp, U.lights.flatMap(l => l.p)); gl.uniform3fv(u.uLc, U.lights.flatMap(l => l.c)); gl.uniform3fv(u.uAmb, U.amb);
    gl.uniform3fv(u.uNeon, (U.neon || [[0, 1, 1], [1, 0, 1]]).flat());
    gl.uniform1f(u.uGlow, U.glow); gl.uniform1f(u.uTrans, U.trans);
    texs(sm);
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
export function litLod(A, bend){
  const L = A.lod, nf = L.tri.length/3, col = new Float32Array(nf*3);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) { let s = 0; for (let j = 0; j < 3; j++) s += (L.col[L.tri[f*3 + j]*3 + k]/255)**2.2; col[f*3 + k] = s/3; }
  return {pos: L.pos, tri: L.tri, part: L.part, morph: L.morph, col, spine: bend ? litData(A, bend).spine : null};
}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
function project(o, M, U){
  const Wc = o.canvas.width, Hc = o.canvas.height, key = Wc + 'x' + Hc;
  if (U.proj && U.proj.key === key) return U.proj;   // once a frame: a mask and the drawing share it
  const cy = Math.cos(U.rot), sy = Math.sin(U.rot), cx = Math.cos(U.pitch), sx = Math.sin(U.pitch), cz = Math.cos(U.roll || 0), sz = Math.sin(U.roll || 0);
  const sq = U.sq || 0, m = U.morph || 0, n = M.pos.length/3, P = new Float32Array(n*3), S2 = new Float32Array(n*2), sc = Hc*U.size*FOCAL;
  const J = M.spine && U.bend ? M.spine : null;
  for (let i = 0; i < n; i++) {
    let x = M.pos[i*3] + M.morph[i*3]*m, y = M.pos[i*3 + 1] + M.morph[i*3 + 1]*m, z = M.pos[i*3 + 2] + M.morph[i*3 + 2]*m;
    if (J) { const y0 = M.pos[i*3 + 1];   // the spine, as in WebGL: top joint first, each turning what's above it
      for (let j = NJ - 1; j >= 0; j--) {
        const w = sst(J[j*4 + 1] - J[j*4 + 3], J[j*4 + 1] + J[j*4 + 3], y0); if (w <= 0) continue;
        const px = J[j*4], py = J[j*4 + 1], pz = J[j*4 + 2], ax = (U.bend.x[j] || 0)*w, az = (U.bend.z[j] || 0)*w;
        let dx = x - px, dy = y - py, dz = z - pz;
        const c1 = Math.cos(ax), s1 = Math.sin(ax), dy1 = c1*dy - s1*dz, dz1 = s1*dy + c1*dz; dy = dy1; dz = dz1;   // about x
        const c2 = Math.cos(az), s2 = Math.sin(az), dx2 = c2*dx - s2*dy, dy2 = s2*dx + c2*dy; dx = dx2; dy = dy2;   // then about z
        x = px + dx; y = py + dy; z = pz + dz;
      }
    }
    x *= 1 + sq*.5; y *= 1 - sq; z *= 1 + sq*.5;
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
    faces.push({f: f/3, a: M.tri[f], b: M.tri[f + 1], c: M.tri[f + 2], n: [nx, ny, nz], z: zc, w: [(P[a] + P[b] + P[c])/3, (P[a + 1] + P[b + 1] + P[c + 1])/3, zc], o: [M.pos[a], M.pos[a + 1], M.pos[a + 2]]});
  }
  faces.sort((p, q) => p.z - q.z);
  return (U.proj = {key, S2, faces});
}
export function litPath2d(o, M, U){
  const {S2, faces} = project(o, M, U); o.beginPath();
  for (const F of faces) { o.moveTo(S2[F.a*2], S2[F.a*2 + 1]); o.lineTo(S2[F.b*2], S2[F.b*2 + 1]); o.lineTo(S2[F.c*2], S2[F.c*2 + 1]); o.closePath(); }
}
// simple mode's looks, plainer: toon in two bands with a dark edge, neon as lines where contours cross, chrome as a
// reflected sky, marble as veined stone
export function lit2d(o, M, U){
  const {S2, faces} = project(o, M, U), look = U.look || 0, ne = U.neon || [[0, 1, 1], [1, 0, 1]];
  o.globalCompositeOperation = 'source-over'; o.globalAlpha = Math.min(1, U.w);
  for (const F of faces) {
    const [nx, ny, nz] = F.n, pt = M.part[F.f], skin = pt === 1, eye = pt === 3;
    const vx = -F.w[0], vy = -F.w[1], vz = CAM - F.w[2], vl = Math.hypot(vx, vy, vz), ed = (nx*vx + ny*vy + nz*vz)/vl;
    if (ed < -.05) continue;   // facing away
    let al = [M.col[F.f*3], M.col[F.f*3 + 1], M.col[F.f*3 + 2]];
    if (look === 4) { const v = Math.sin(F.o[0]*14 + Math.sin(F.o[1]*9 + F.o[2]*6)*2.4), mb = 1 - sst(0, .16, Math.abs(v)); al = [.36, .35, .335].map((x, k) => x + ([.06, .06, .07][k] - x)*mb*.9); }
    let c;
    if (look === 2) {   // neon
      const f = ((F.o[1]*26 + F.o[0]*2) % 1 + 1) % 1, line = 1 - sst(.03, .12, Math.min(f, 1 - f)), fr = Math.pow(1 - Math.max(0, ed), 3);
      c = [0, 1, 2].map(k => ne[0][k]*line*.9 + ne[1][k]*fr*1.4);
    } else if (look === 3) {   // chrome
      const ry = 2*ed*ny - vy/vl, env = ry < 0 ? .02 : .3 + .6*sst(.05, .8, ry);
      c = [0, 1, 2].map(k => env*(k === 2 ? 1 : .94) + ne[0][k]*Math.max(0, 1 - Math.abs(ry)*7)**3*.9);
    } else {
      c = al.map((x, k) => x*U.amb[k]*(.55 + .45*ny));
      for (const Lt of U.lights) {
        let lx = Lt.p[0] - F.w[0], ly = Lt.p[1] - F.w[1], lz = Lt.p[2] - F.w[2]; const d = Math.hypot(lx, ly, lz); lx /= d; ly /= d; lz /= d;
        const ndl = nx*lx + ny*ly + nz*lz, wrap = skin ? .35 : 0, att = 1/(1 + d*d*.12);
        const dif = look === 1 ? sst(.02, .06, ndl)*.55 + sst(.5, .54, ndl)*.45 : Math.max(0, (ndl + wrap)/(1 + wrap));
        const hx = lx + vx/vl, hy = ly + vy/vl, hz = lz + vz/vl, hl = Math.hypot(hx, hy, hz), sp = ndl > 0 ? Math.pow(Math.max(0, (nx*hx + ny*hy + nz*hz)/hl), eye ? 200 : 28)*(eye ? 1.5 : .2) : 0;
        for (let k = 0; k < 3; k++) c[k] += Lt.c[k]*att*(al[k]*dif*(look === 1 ? 1.2 : 1) + sp);
      }
      if (look === 1 && ed < .3) c = c.map(x => x*.1);   // the ink line
      if (eye && look < 2) { c[0] += U.glow*.6; c[1] += U.glow*.3; }
    }
    const rgb = c.map(x => Math.min(255, Math.round(Math.pow(Math.max(0, x), 1/2.2)*255)));
    o.beginPath(); o.moveTo(S2[F.a*2], S2[F.a*2 + 1]); o.lineTo(S2[F.b*2], S2[F.b*2 + 1]); o.lineTo(S2[F.c*2], S2[F.c*2 + 1]); o.closePath();
    o.fillStyle = `rgb(${rgb})`; o.fill(); o.strokeStyle = o.fillStyle; o.lineWidth = .8; o.stroke();   // (its own colour round the edge: no seams)
  }
  o.globalAlpha = 1;
}
