// Mesh objects: a 3D mesh drawn as glowing wire edges over faint glass panes, where every pane can move on its own
// (fly apart and back, light up in sweeps, sparkle, vanish). A leaf module: no engine imports, so visuals can use it.
// A mesh is {pieces: [{pos, tri, part, hinge?, morph?}]}; each piece's panes can hinge together (a jaw), and a morph (each
// vertex's move to another pose, a Blender shape key) is played by a weight, U.morph (-1..1: the pose both ways).
// U, the per-frame settings: rot, pitch, size, pos [x,y], asp, jaw, ex (0 whole .. 1 scattered), gone (0..1 of panes
// vanished), fill, dark (how much the glass darkens what's behind it), xray (how bright the far side's edges show through),
// line (px), hue, partHue, sweep (0..1 down the object) and sweepAmt, spark and sparkSeed, glow, trail, w (overall), morph;
// and its dance (scene/dance.js): roll (a lean), sq (squash and stretch), lift and liftPart (one part lifting off); and
// style: 0 glass wire, 1 solid (lit facets), 2 outline (a black silhouette with a neon rim), 3 hologram, 4 points, 5 shaded
// (smooth, lit like skin: each corner's normal averaged over the panes round it, lit per pixel, the wire faint over it).

const CAM = 3.2, FOCAL = 2.6;   // the camera sits this far out on z; FOCAL sets how strong the perspective is
// a small, fixed random number per pane, the same in both renderers
const seedOf = i => { const x = Math.sin(i*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };

// per-pane data, shared by both renderers: corners, centre, normal, part, piece (1 = hinged), seed; with a morph, how
// each corner, the centre and the normal move to the morph's pose (dv, dc, dn)
const unit = (v, u, w) => { const a = u.map((x, k) => x - v[k]), b = w.map((x, k) => x - v[k]);
  const n = [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], l = Math.hypot(...n) || 1; return n.map(x => x/l); };
// each vertex's normal: the panes round it, weighted by their size (for the shaded style); of the morph's pose too
function vertexNormals(pos, tri){
  const vn = new Float32Array(pos.length);
  for (let t = 0; t < tri.length; t += 3) {
    const [a, b, c] = [tri[t]*3, tri[t + 1]*3, tri[t + 2]*3], u = [0, 1, 2].map(k => pos[b + k] - pos[a + k]), w = [0, 1, 2].map(k => pos[c + k] - pos[a + k]);
    const n = [u[1]*w[2] - u[2]*w[1], u[2]*w[0] - u[0]*w[2], u[0]*w[1] - u[1]*w[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) vn[i + k] += n[k];
  }
  for (let i = 0; i < vn.length; i += 3) { const l = Math.hypot(vn[i], vn[i + 1], vn[i + 2]) || 1; vn[i] /= l; vn[i + 1] /= l; vn[i + 2] /= l; }
  return vn;
}
export function panesOf(mesh){
  const panes = [];
  for (const pc of mesh.pieces) {
  const VN = vertexNormals(pc.pos, pc.tri), VNM = pc.morph ? vertexNormals(pc.pos.map((x, i) => x + pc.morph[i]), pc.tri) : null;
  for (let t = 0; t < pc.tri.length; t += 3) {
    const v = [0, 1, 2].map(k => { const i = pc.tri[t + k]*3; return [pc.pos[i], pc.pos[i + 1], pc.pos[i + 2]]; });
    const c = [0, 1, 2].map(k => (v[0][k] + v[1][k] + v[2][k])/3), n = unit(...v);
    const q = {v, c, n, part: pc.part[t/3], hinged: pc.hinge ? 1 : 0, seed: seedOf(panes.length)};
    if (pc.morph) {
      q.dv = [0, 1, 2].map(k => { const i = pc.tri[t + k]*3; return [pc.morph[i], pc.morph[i + 1], pc.morph[i + 2]]; });
      q.dc = [0, 1, 2].map(k => (q.dv[0][k] + q.dv[1][k] + q.dv[2][k])/3);
      q.dn = unit(...v.map((p, i) => p.map((x, k) => x + q.dv[i][k]))).map((x, k) => x - n[k]);
    }
    q.sn = [0, 1, 2].map(k => { const i = pc.tri[t + k]*3; return [VN[i], VN[i + 1], VN[i + 2]]; });
    if (VNM) q.dsn = [0, 1, 2].map(k => { const i = pc.tri[t + k]*3; return [VNM[i] - VN[i], VNM[i + 1] - VN[i + 1], VNM[i + 2] - VN[i + 2]]; });
    panes.push(q);
  }
  }
  return panes;
}

// ---- WebGL ----
const VS = `
attribute vec3 aPos, aOth, aCen, aNrm; attribute vec4 aInfo;   // info: part, hinged, seed, side (0 for panes, +-1 for edges)
attribute vec3 aPosD, aOthD, aCenD, aNrmD;                      // the morph: how each moves to its pose
attribute vec3 aSN, aSND;                                       // the corner's smooth normal, and its move to the pose (for the shaded style)
uniform float uStyle,uRoll,uSq,uLift,uLiftPart,uMorph,uRot,uPitch,uSize,uAsp,uJaw,uEx,uGone,uFill,uDark,uHue,uPartHue,uSweep,uSweepAmt,uSpark,uSparkSeed,uGlow,uLine,uH,uEdge,uBright,uFillPart;
uniform vec2 uPos, uLightDir; uniform vec3 uHinge, uPal, uLight;   // uLight: the world's light (hue offset, saturation, strength)
varying vec4 vCol; varying float vSide; varying vec2 vScr; varying float vFillW; varying vec3 vN, vLC; varying float vEmit, vWL;
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
vec3 rx(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z); }
vec3 ry(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z); }
vec3 rz(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z); }
// a point of a pane, after the jaw's hinge, the pane's own flight and spin, then the whole object's turn
vec3 mC, mN;   // the pane's centre and normal, morphed
vec3 place(vec3 p){
  vec3 c=mC, n=mN;
  if(aInfo.y>0.5){ p=rx(p-uHinge,uJaw)+uHinge; c=rx(c-uHinge,uJaw)+uHinge; n=rx(n,uJaw); }
  float s=aInfo.z, e=uEx*(0.5+s);
  vec3 dir=normalize(n+normalize(c+vec3(0.0,0.0,0.001))*0.8);
  p=c+ry(rx(p-c,e*(s*9.0-4.5)),e*(s*7.0-3.5))*(1.0-0.3*e)+dir*e*0.9;   // spins about its own centre as it flies
  if(uLift>0.0&&abs(aInfo.x-uLiftPart)<0.5) p+=vec3(0.0,0.24,0.1)*uLift;   // one part lifts off, whole, and comes back
  p*=vec3(1.0+uSq*0.5,1.0-uSq,1.0+uSq*0.5);                            // squash and stretch
  return rz(rx(ry(p,uRot),uPitch),uRoll);
}
vec2 screen(vec3 p){ return uPos+p.xy*uSize*${FOCAL.toFixed(1)}/(${CAM.toFixed(1)}-p.z); }
void main(){
  mC=aCen+aCenD*uMorph; mN=normalize(aNrm+aNrmD*uMorph);
  vec3 p0=aPos+aPosD*uMorph; if(uStyle>3.5&&uStyle<4.5) p0=mC+(p0-mC)*0.2;   // points: each pane shrunk to a dot at its centre
  vec3 p=place(p0); vec2 s=screen(p);
  if(aInfo.w!=0.0){                                     // an edge: widened sideways on screen into a band
    vec2 o=screen(place(aOth+aOthD*uMorph)), d=normalize(vec2(o.x-s.x,o.y-s.y)+vec2(0.00001,0.0));
    s+=vec2(-d.y,d.x)*aInfo.w*uLine/uH;
  }
  vSide=aInfo.w;
  float gone=step(aInfo.z,uGone);                         // vanished panes collapse to nothing
  vec3 nw=rz(rx(ry(mN,uRot),uPitch),uRoll);
  float face=0.5+0.5*nw.z;                               // facing us (1) or away (0): the far side is dimmer
  float sweep=uSweepAmt*exp(-pow((aCen.y-(0.55-uSweep*1.1))*7.0,2.0));   // a band of light running down the object
  float spark=uSpark*step(0.88,fract(aInfo.z*91.7+uSparkSeed));          // a few panes flash on stabs
  float pk=mod(aInfo.x,3.0);                             // parts take the palette's hues in turn
  vec3 col=hsv(uHue+uPartHue+(pk<0.5 ? uPal.x : pk<1.5 ? uPal.y : uPal.z)+floor(aInfo.x/3.0)*0.04,0.75,1.0);
  float lit=max(dot(nw,normalize(vec3(uLightDir,0.6))),0.0)*uLight.z;   // the world's light on the side facing it
  col=mix(col,hsv(uHue+uLight.x,uLight.y,1.0),lit*0.6);
  float a=uEdge>0.5 ? (0.35+0.65*face)*(0.8+uGlow*0.8)+sweep*1.5+spark*1.2
                    : (uFill*(0.3+0.7*face)*(0.4+0.6*max(dot(nw,normalize(vec3(-0.4,0.6,0.7))),0.0))+sweep*0.5+spark*0.9+lit*0.25);
  if(aInfo.x>6.5){                                        // the holes (eye sockets, nose): dark, faint edges; the sockets glow on the downbeat
    col=hsv(uHue+uPartHue+uPal.z+0.5,0.9,1.0); a=uEdge>0.5 ? a*0.2 : (aInfo.x<7.5 ? uGlow*1.4 : 0.0);
  }
  vec3 rgb=mix(col,vec3(1.0),min(0.6,sweep*0.5+spark*0.4))*a; float al=uEdge>0.5 ? 1.0 : uDark;
  if(uStyle>0.5&&uStyle<1.5){                             // solid: lit facets, the edges faint
    float lam=0.3+0.7*max(dot(nw,normalize(vec3(-0.4,0.6,0.7))),0.0)+lit*0.3;
    if(uEdge>0.5) rgb*=0.15; else if(aInfo.x<6.5){ rgb=col*lam*(0.55+0.45*uGlow+0.3)+vec3(sweep+spark)*0.4; al=1.0; }
  } else if(uStyle>1.5&&uStyle<2.5){                      // outline: black, rimmed where it turns away from us
    float rim=1.0-smoothstep(0.1,0.4,abs(nw.z));
    if(uEdge>0.5) rgb=col*rim*(1.4+uGlow)+vec3(sweep+spark)*rim; else { rgb=vec3(0.0); al=1.0; }
  } else if(uStyle>2.5&&uStyle<3.5){                      // hologram: see-through, tinted, bright edges (scan lines in the fragments)
    rgb=hsv(uHue+uPal.y+0.5,0.8,1.0)*max(rgb.r,max(rgb.g,rgb.b))*(uEdge>0.5 ? 0.6 : 0.035); al=0.0;
  } else if(uStyle>3.5&&uStyle<4.5){                      // points: the dots glow, no edges
    rgb=uEdge>0.5 ? vec3(0.0) : col*(1.1+uGlow+spark*2.0+sweep*1.5); al=0.0;
  } else if(uStyle>4.5){                                  // shaded: the pane's own colour, lit per pixel (below); the wire faint over it
    if(uEdge>0.5) rgb=col*0.05*(1.0+uGlow+sweep*2.0+spark*2.0);
    else { rgb=aInfo.x>6.5 ? col*(aInfo.x<7.5 ? 0.15+uGlow*1.6 : 0.02) : hsv(uHue+uPartHue+(pk<0.5 ? uPal.x : pk<1.5 ? uPal.y : uPal.z)+floor(aInfo.x/3.0)*0.04,0.42,0.85)+vec3(sweep+spark)*0.5; al=1.0; }
  }
  vec3 sn=normalize(aSN+aSND*uMorph+vec3(0.0,0.0,1e-5)); if(aInfo.y>0.5) sn=rx(sn,uJaw);
  vN=rz(rx(ry(sn,uRot),uPitch),uRoll); vLC=hsv(uHue+uLight.x,uLight.y,1.0)*uLight.z; vEmit=aInfo.x>6.5 ? 1.0 : 0.0; vWL=max(dot(vN,normalize(vec3(uLightDir,0.4))),0.0);
  vCol=vec4(rgb*uBright*(1.0-gone),al*uBright*(1.0-gone));
  vScr=vec2(s.x/uAsp,s.y)+0.5;                           // where on screen, for a fill
  vFillW=(uFillPart>0.5 ? step(abs(aInfo.x-uFillPart),0.5) : aInfo.x>6.5 ? 0.0 : 1.0)*uBright*(1.0-gone);   // a fill shows through the glass (or one part), not in the holes
  gl_Position=vec4(s.x*2.0/uAsp,s.y*2.0,-p.z/3.0,1.0);   // nearer is smaller depth, for hiding the far side
}`;
const FS = `precision mediump float; varying vec4 vCol; varying float vSide; varying vec2 vScr; varying float vFillW; varying vec3 vN, vLC; varying float vEmit, vWL;
uniform sampler2D uFillTex; uniform float uFillAmt, uCover, uHolo, uScan, uShade;
void main(){
  if(uCover>0.5){ gl_FragColor=vec4(vec3(step(0.001,vFillW)),1.0); return; }   // the silhouette, for masks
  float f=vSide==0.0 ? 1.0 : 1.0-vSide*vSide; vec3 c=vCol.rgb*f;
  if(uShade>0.5&&vSide==0.0&&vEmit<0.5){   // shaded: skin-like light from the smooth normal (a warm key light wrapping round, a
    // cool sky from above, light glowing through the thin edges, a soft highlight, and the world's light as a rim)
    vec3 n=normalize(vN), L=normalize(vec3(-0.45,0.55,0.7)), H=normalize(L+vec3(0.0,0.0,1.0));
    float ndl=dot(n,L), wrap=max((ndl+0.4)/1.4,0.0), fres=pow(1.0-max(n.z,0.0),2.5), sky=0.5+0.5*n.y;
    vec3 base=vCol.rgb;
    c=base*(vec3(1.0,0.93,0.85)*wrap*0.95+vec3(0.35,0.45,0.6)*sky*0.25)
      +base*vec3(1.0,0.45,0.35)*pow(max(0.35-ndl,0.0),1.5)*0.45                  // light through the thin edges (ears)
      +vec3(1.0,0.95,0.9)*pow(max(dot(n,H),0.0),40.0)*0.35
      +(vLC*0.9+base*0.25)*fres*0.9+vLC*vWL*0.3;
  }
  if(vSide==0.0 && uFillAmt>0.0) c+=texture2D(uFillTex,vScr).rgb*uFillAmt*vFillW;   // a fill seen through the glass
  if(uHolo>0.5) c*=0.6+0.4*step(0.5,fract(vScr.y*uScan));   // a hologram's scan lines
  gl_FragColor=vec4(c,vCol.a*f);
}`;

// One program serves every mesh, started early (meshWarm, at idle) and linked on first use: compiling it, or building a
// mesh's vertex data, the moment a centrepiece first appears would stall that frame
const ATT = ['aPos', 'aOth', 'aCen', 'aNrm', 'aInfo', 'aPosD', 'aOthD', 'aCenD', 'aNrmD', 'aSN', 'aSND'], NF = 34, PROGS = new WeakMap(), DATA = new WeakMap();
function meshStart(gl){
  let s = PROGS.get(gl);
  if (s && gl.isProgram(s.p)) return s;   // (a lost context's programs are gone: start again)
  const p = gl.createProgram(), sh = [[gl.VERTEX_SHADER, 'precision highp float;' + VS], [gl.FRAGMENT_SHADER, FS]].map(([t, src]) => {
    const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(p, x); return x; });
  ATT.forEach((a, i) => gl.bindAttribLocation(p, i + 1, a));   // attribute 0 stays the engine's full-screen quad
  gl.linkProgram(p); PROGS.set(gl, s = {p, sh, u: null}); return s;
}
function meshProg(gl){
  const s = meshStart(gl);
  if (!s.u) {
    if (!gl.getProgramParameter(s.p, gl.LINK_STATUS)) throw new Error(s.sh.map(x => gl.getShaderInfoLog(x)).join('') || gl.getProgramInfoLog(s.p));
    const u = {}; for (let i = 0, n = gl.getProgramParameter(s.p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(s.p, i); u[a.name] = gl.getUniformLocation(s.p, a.name); }
    s.u = u;
  }
  return s;
}
// one interleaved array each for the panes and the edges: pos, other end, centre, normal (3 each), info (4), then the
// morph's moves of pos, other end, centre and normal (3 each, 0 without one), the corner's smooth normal and its move; worked out once a mesh
export function meshData(mesh){
  let d = DATA.get(mesh); if (d) return d;
  const panes = panesOf(mesh), fill = new Float32Array(panes.length*3*NF), edge = new Float32Array(panes.length*18*NF), Z = [0, 0, 0];
  const put = (arr, o, k, j, q, side) => {   // corner k, its edge's other end j
    arr.set(q.v[k], o); arr.set(q.v[j], o + 3); arr.set(q.c, o + 6); arr.set(q.n, o + 9); arr[o + 12] = q.part; arr[o + 13] = q.hinged; arr[o + 14] = q.seed; arr[o + 15] = side;
    if (q.dv) { arr.set(q.dv[k], o + 16); arr.set(q.dv[j], o + 19); arr.set(q.dc, o + 22); arr.set(q.dn, o + 25); } else for (let i = 16; i < 28; i += 3) arr.set(Z, o + i);
    arr.set(q.sn[k], o + 28); arr.set(q.dsn ? q.dsn[k] : Z, o + 31);   // the corner's smooth normal, and its move to the pose
    return o + NF; };
  let fo = 0, eo = 0;
  for (const q of panes) {
    for (let k = 0; k < 3; k++) fo = put(fill, fo, k, k, q, 0);
    for (let k = 0; k < 3; k++) { const a = k, b = (k + 1) % 3;   // each edge as two triangles across its width
      eo = put(edge, eo, a, b, q, 1); eo = put(edge, eo, a, b, q, -1); eo = put(edge, eo, b, a, q, -1); eo = put(edge, eo, a, b, q, 1); eo = put(edge, eo, b, a, q, -1); eo = put(edge, eo, b, a, q, 1); }
  }
  DATA.set(mesh, d = {fill, edge}); return d;
}
export const meshWarm = gl => { meshStart(gl); };
export function meshGL(gl, mesh){
  const {p, u} = meshProg(gl), D = meshData(mesh);
  const buf = data => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return {b, n: data.length/NF}; };
  const B = {fill: buf(D.fill), edge: buf(D.edge)};
  let blank = null;
  // on screen: the far side's edges show faintly through, then the glass panes (darkening what's behind them and
  // hiding the far side, and holding a fill if it has one: U.fillTex, U.fillAmt), then the near edges in full.
  // Into the trails (no depth there): the edges only, dimmer. 'cover': the panes flat white, for a mask.
  return function draw(U, W, H, stage){
    gl.useProgram(p);
    const sty = U.style || 0; gl.uniform1f(u.uStyle, sty); gl.uniform1f(u.uHolo, sty === 3 ? 1 : 0); gl.uniform1f(u.uShade, sty === 5 ? 1 : 0); gl.uniform1f(u.uScan, H/5);
    gl.uniform1f(u.uMorph, U.morph || 0); gl.uniform1f(u.uRoll, U.roll || 0); gl.uniform1f(u.uSq, U.sq || 0); gl.uniform1f(u.uLift, U.lift || 0); gl.uniform1f(u.uLiftPart, U.liftPart || 1); gl.uniform1f(u.uRot, U.rot); gl.uniform1f(u.uPitch, U.pitch); gl.uniform1f(u.uSize, U.size); gl.uniform1f(u.uAsp, W/H);
    gl.uniform2f(u.uPos, U.pos[0], U.pos[1]); gl.uniform3fv(u.uHinge, mesh.hinge); gl.uniform1f(u.uJaw, U.jaw);
    gl.uniform1f(u.uEx, U.ex); gl.uniform1f(u.uGone, U.gone); gl.uniform1f(u.uFill, U.fill); gl.uniform1f(u.uDark, U.dark); gl.uniform1f(u.uHue, U.hue);
    gl.uniform1f(u.uPartHue, U.partHue); gl.uniform3fv(u.uPal, U.pal || [0, .33, .67]);
    const L = U.light || {amt: 0}; gl.uniform3f(u.uLight, L.hue || 0, L.sat || 0, L.amt); gl.uniform2f(u.uLightDir, L.x || 0, L.y || 0); gl.uniform1f(u.uSweep, U.sweep); gl.uniform1f(u.uSweepAmt, U.sweepAmt);
    gl.uniform1f(u.uSpark, U.spark); gl.uniform1f(u.uSparkSeed, U.sparkSeed); gl.uniform1f(u.uGlow, U.glow);
    gl.uniform1f(u.uLine, Math.max(1, U.line*H/720)); gl.uniform1f(u.uH, H*2);   // U.line px wide on a 720-line screen, scaled
    if (!blank) { blank = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, blank); gl.uniform1i(u.uFillTex, 4);   // never the texture being drawn into
    gl.uniform1f(u.uCover, stage === 'cover' ? 1 : 0); gl.uniform1f(u.uFillAmt, 0); gl.uniform1f(u.uFillPart, stage === 'cover' ? 0 : U.fillPart || 0);
    gl.disableVertexAttribArray(0); ATT.forEach((a, i) => gl.enableVertexAttribArray(i + 1));
    const pass = (k, bright) => {
      const b = B[k]; gl.uniform1f(u.uEdge, k === 'edge' ? 1 : 0); gl.uniform1f(u.uBright, bright*U.w);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.b);
      for (let i = 0; i < ATT.length; i++) gl.vertexAttribPointer(i + 1, i === 4 ? 4 : 3, gl.FLOAT, false, NF*4, i < 5 ? i*12 : 64 + (i - 5)*12);   // pos, other end, centre, normal, info, then the morph's
      gl.drawArrays(gl.TRIANGLES, 0, b.n);
    };
    if (stage === 'cover') pass('fill', 1);
    else if (stage === 'trails') { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); pass(sty === 4 ? 'fill' : 'edge', U.trail*(sty === 4 ? 2 : sty === 3 ? .3 : sty === 5 ? .15 : 1)); }   // (points leave their dots; a hologram and the shaded hardly any ghosts)
    else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE); if (sty !== 2 && sty !== 4 && sty !== 5) pass('edge', U.xray);   // the far side (a hologram shows it clearly; an outline, points and the shaded don't)
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);          // panes sit just behind their own edges
      // the fill, if it has one (otherwise the blank bound above)
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, U.fillTex || blank); gl.uniform1i(u.uFillTex, 4);
      if (U.fillTex) gl.uniform1f(u.uFillAmt, U.fillAmt);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); pass('fill', 1);
      gl.uniform1f(u.uFillAmt, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      gl.blendFunc(gl.ONE, gl.ONE); if (sty !== 4) pass('edge', 1);
      gl.depthMask(true); gl.disable(gl.DEPTH_TEST);
    }
    ATT.forEach((a, i) => gl.disableVertexAttribArray(i + 1)); gl.enableVertexAttribArray(0);
    gl.disable(gl.BLEND);
  };
}


// ---- simple mode: the same motion worked out here, panes filled back to front, edges stroked in light ----
// hue, saturation, value (0..1) to rgb (0..1), for simple mode's glass
const hsvRgb = (h, sa, v) => [0, 2/3, 1/3].map(o => { const p = Math.abs(((h + o) % 1 + 1) % 1*6 - 3); return v*(1 - sa + sa*Math.min(1, Math.max(0, p - 1))); });
const hsl = (h, l, a) => `hsla(${((h % 1) + 1) % 1*360},75%,${l}%,${Math.max(0, Math.min(1, a)).toFixed(3)})`;
// every visible pane, placed and projected onto the canvas, back to front
function project2d(o, panes, hinge, U){
  const Wc = o.canvas.width, Hc = o.canvas.height, sc = Hc*U.size*FOCAL, key = Wc + 'x' + Hc;
  if (U.proj && U.proj.key === key) return U.proj.L;   // once a frame: a mask and the drawing share it
  // plain arithmetic, no arrays per vertex: this runs for every pane every frame
  const cr = Math.cos(U.rot), sr = Math.sin(U.rot), cp = Math.cos(U.pitch), spi = Math.sin(U.pitch), cj = Math.cos(U.jaw), sj = Math.sin(U.jaw);
  const co = Math.cos(U.roll || 0), so = Math.sin(U.roll || 0), sq = U.sq || 0, sqx = 1 + sq*.5, sqy = 1 - sq, lift = U.lift || 0, lp = U.liftPart || 1;
  const [hx, hy, hz] = hinge || [0, 0, 0], Lt = U.light || {amt: 0}, lx = Lt.x || 0, ly = Lt.y || 0, ll = Math.hypot(lx, ly, .6);
  const out = [0, 0, 0];
  // a point after the hinge, the pane's own flight and spin (e), then the whole object's turn, into out
  let lx0 = 0, ly0 = 0, lz0 = 0;   // this pane's lift, if its part is lifting off
  const place = (x, y, z, hinged, cx, cy, cz, e, ca, sa, cb, sb, dx, dy, dz) => {
    if (hinged) { const y0 = y - hy, z0 = z - hz; y = cj*y0 - sj*z0 + hy; z = sj*y0 + cj*z0 + hz; }
    if (e > 1e-5) {
      let px = x - cx, py = y - cy, pz = z - cz;
      const py2 = ca*py - sa*pz, pz2 = sa*py + ca*pz; py = py2; pz = pz2;             // rx
      const px3 = cb*px + sb*pz, pz3 = -sb*px + cb*pz; px = px3; pz = pz3;            // ry
      const k = 1 - .3*e; x = cx + px*k + dx; y = cy + py*k + dy; z = cz + pz*k + dz;
    }
    x = (x + lx0)*sqx; y = (y + ly0)*sqy; z = (z + lz0)*sqx;                              // a lifted part, squash and stretch
    const x1 = cr*x + sr*z, z1 = -sr*x + cr*z;                                          // ry(rot)
    const y2 = cp*y - spi*z1; out[2] = spi*y + cp*z1;                                   // rx(pitch)
    out[0] = co*x1 - so*y2; out[1] = so*x1 + co*y2;                                     // rz(roll)
  };
  const L = [];
  const mw = U.morph || 0;
  for (const q0 of panes) {
    if (q0.seed < U.gone) continue;
    // with a morph, the pane moved towards its pose (a copy, as this frame sees it)
    const q = q0.dv && mw ? {...q0, v: q0.v.map((p, i) => p.map((x, k) => x + q0.dv[i][k]*mw)), c: q0.c.map((x, k) => x + q0.dc[k]*mw),
      n: (n => { const l = Math.hypot(...n) || 1; return n.map(x => x/l); })(q0.n.map((x, k) => x + q0.dn[k]*mw))} : q0;
    let [cx, cy, cz] = q.c, [nx, ny, nz] = q.n;
    if (q.hinged) { const y0 = cy - hy, z0 = cz - hz; cy = cj*y0 - sj*z0 + hy; cz = sj*y0 + cj*z0 + hz; const ny2 = cj*ny - sj*nz; nz = sj*ny + cj*nz; ny = ny2; }
    const e = U.ex*(.5 + q.seed);
    let ca = 1, sa = 0, cb = 1, sb = 0, dx = 0, dy = 0, dz = 0;
    if (e > 1e-5) {
      ca = Math.cos(e*(q.seed*9 - 4.5)); sa = Math.sin(e*(q.seed*9 - 4.5)); cb = Math.cos(e*(q.seed*7 - 3.5)); sb = Math.sin(e*(q.seed*7 - 3.5));
      const cl = Math.hypot(cx, cy, cz) || 1, ex = nx + cx/cl*.8, ey = ny + cy/cl*.8, ez = nz + cz/cl*.8, dl = Math.hypot(ex, ey, ez), f = e*.9/dl;
      dx = ex*f; dy = ey*f; dz = ez*f;
    }
    if (lift > 0 && q.part === lp) { lx0 = 0; ly0 = .24*lift; lz0 = .1*lift; } else lx0 = ly0 = lz0 = 0;
    const s = [], v = q.v; let zs = 0;
    for (let i = 0; i < 3; i++) {
      place(v[i][0], v[i][1], v[i][2], q.hinged, cx, cy, cz, e, ca, sa, cb, sb, dx, dy, dz);
      const w = sc/(CAM - out[2]); zs += out[2];
      s.push([Wc/2 + U.pos[0]*Hc + out[0]*w, Hc/2 - U.pos[1]*Hc - out[1]*w]);
    }
    const n0 = q.n, nx1 = cr*n0[0] + sr*n0[2], nz1 = -sr*n0[0] + cr*n0[2], nwy0 = cp*n0[1] - spi*nz1, nwz = spi*n0[1] + cp*nz1, nwy = so*nx1 + co*nwy0;   // the pane's facing
    // the smooth normal (the corners' averaged, for the shaded style), turned the same way
    let ax = 0, ay = 0, az = 0; for (let i = 0; i < 3; i++) { const a = q0.sn[i], d = q0.dsn && mw ? q0.dsn[i] : null; ax += a[0] + (d ? d[0]*mw : 0); ay += a[1] + (d ? d[1]*mw : 0); az += a[2] + (d ? d[2]*mw : 0); }
    if (q.hinged) { const ay2 = cj*ay - sj*az; az = sj*ay + cj*az; ay = ay2; }
    const al = Math.hypot(ax, ay, az) || 1, sx1 = (cr*ax + sr*az)/al, sz1 = (-sr*ax + cr*az)/al, sy0 = (cp*ay/al - spi*sz1), snz = spi*ay/al + cp*sz1;
    L.push({q, s, z: zs/3, face: .5 + .5*nwz, lit: Math.max(0, (nx1*lx + nwy*ly + nwz*.6)/ll)*Lt.amt, sn: [co*sx1 - so*sy0, so*sx1 + co*sy0, snz]});
  }
  L.sort((a, b) => a.z - b.z);
  U.proj = {key, L};
  return L;
}
const tri = (o, s) => { o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath(); };
// the object's silhouette as a path (for masks): every visible pane, holes included
export function meshPath2d(o, panes, hinge, U){ o.beginPath(); for (const {s} of project2d(o, panes, hinge, U)) tri(o, s); }
// U.fillImg (a canvas) and U.fillAmt: a fill seen through the glass of the near panes, the holes left dark (or through one part, U.fillPart)
export function meshDraw2d(o, panes, hinge, U){
  const Hc = o.canvas.height, L = project2d(o, panes, hinge, U);
  o.lineJoin = 'round'; o.lineWidth = Math.max(1, U.line*Hc/720*.8);   // back to front: dark glass over what's behind, then light
  const pal = U.pal || [0, .33, .67], ph = part => pal[part % 3] + Math.floor(part/3)*.04;   // parts take the palette's hues in turn
  // glass first, back to front; then the edges, gathered by colour into a few paths (stroking panes one by one was the
  // cost). The far side's edges show faintly through the near glass, as WebGL's x-ray pass does
  o.globalCompositeOperation = 'source-over';
  const edges = new Map(), lh = ((U.hue + (U.light ? U.light.hue : 0)) % 1 + 1) % 1*360, sty = U.style || 0;
  if (sty === 4) {   // points: a glowing dot at each pane's centre, no glass and no edges
    o.globalCompositeOperation = 'lighter';
    const r = Math.max(1.2, Hc*.0035);
    for (const {q, s, face} of L) { const h = U.hue + U.partHue + ph(q.part), spark = U.spark*(((q.seed*91.7 + U.sparkSeed) % 1) >= .88 ? 1 : 0);
      o.fillStyle = hsl(h, 60 + 25*spark, Math.min(1, (.35 + .5*face + U.glow*.4 + spark)*U.w)); o.fillRect((s[0][0] + s[1][0] + s[2][0])/3 - r/2, (s[0][1] + s[1][1] + s[2][1])/3 - r/2, r, r); }
    o.globalCompositeOperation = 'source-over'; return;
  }
  for (const L2 of L) { const {q, s, face, lit} = L2;
    const sweep = U.sweepAmt*Math.exp(-(((q.c[1] - (.55 - U.sweep*1.1))*7)**2)), spark = U.spark*(((q.seed*91.7 + U.sparkSeed) % 1) >= .88 ? 1 : 0);
    const hole = q.part >= 7, h = hole ? U.hue + U.partHue + pal[2] + .5 : U.hue + U.partHue + ph(q.part), w = U.w;   // eye sockets and nose: dark holes
    const fa = hole ? (q.part === 7 ? U.glow*1.4 : 0) : U.fill*(.3 + .7*face) + sweep*.5 + spark*.9;
    const back = face < .45 && !sweep && !spark;   // the far side: edges only (the near glass covers it)
    const rim = 1 - Math.min(1, Math.max(0, (Math.abs(face - .5)*2 - .1)/.3));   // (an outline's rim: panes turned side-on)
    if (sty === 5 && !back && !hole) {   // shaded: lit like skin from the smooth normal, as in WebGL
      const [snx, sny, snz] = L2.sn, ndl = snx*-.45/.99 + sny*.55/.99 + snz*.7/.99, wrap = Math.max(0, (ndl + .4)/1.4), fres = Math.pow(1 - Math.max(0, snz), 2.5), sky = .5 + .5*sny;
      const hx2 = -.45/.99, hy2 = .55/.99, hz2 = .7/.99 + 1, hl = Math.hypot(hx2, hy2, hz2), spec = Math.pow(Math.max(0, (snx*hx2 + sny*hy2 + snz*hz2)/hl), 40)*.35;
      const base = hsvRgb(h, .42, .85), lc = hsvRgb(lh/360, U.light ? U.light.sat : 0, 1).map(x => x*(U.light ? U.light.amt : 0)), thin = Math.pow(Math.max(0, .35 - ndl), 1.5)*.45;
      const warm = [1, .93, .85], cool = [.35, .45, .6], through = [1, .45, .35];
      const c = [0, 1, 2].map(k => Math.min(255, Math.round((base[k]*(warm[k]*wrap*.95 + cool[k]*sky*.25) + base[k]*through[k]*thin + spec + (lc[k]*.9 + base[k]*.25)*fres*.9 + lc[k]*L2.lit*.3 + (sweep + spark)*.5)*w*255)));
      o.beginPath(); o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath(); o.fillStyle = `rgb(${c})`; o.fill(); o.strokeStyle = o.fillStyle; o.lineWidth = .8; o.stroke();   // (its own colour round the edge: no seams between panes)
    } else if (sty === 5 && hole && !back) {   // the eyes glow, other holes dark
      const g = hsvRgb(h, .9, q.part === 7 ? Math.min(1, .15 + U.glow*1.6) : .02).map(x => Math.round(x*255*w));
      o.beginPath(); o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath(); o.fillStyle = `rgb(${g})`; o.fill();
    } else if (sty === 1 && !back && !hole) {   // solid: lit facets
      const lam = .3 + .7*Math.max(0, face*1.2 - .2) + lit*.3, c = hsvRgb(h, .6, Math.min(1, lam*(.55 + .45*U.glow + .3)*w)).map(x => Math.round(x*255));
      o.beginPath(); o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath(); o.fillStyle = `rgb(${c})`; o.fill();
    } else if (sty === 2 && !back) {   // outline: black
      o.beginPath(); o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath(); o.fillStyle = '#000'; o.fill();
    } else if (sty === 3) {}   // hologram: no glass
    else if (!back) {   // one fill: the dark glass over what's behind, with its own glow and the world's light mixed in
      const d = Math.max(.05, U.dark*w), g = hsvRgb(h, .55, Math.min(1, fa*w*.5)), l = hole ? [0, 0, 0] : hsvRgb(lh/360, U.light ? U.light.sat : 0, lit*.3*w);
      const c = k => Math.min(255, Math.round((g[k] + l[k])/d*255));
      o.beginPath(); o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath();
      o.fillStyle = `rgba(${c(0)},${c(1)},${c(2)},${d.toFixed(3)})`; o.fill();
    }
    let a = ((.35 + .65*face)*(.8 + U.glow*.8) + sweep*1.5 + spark*1.2)*w*.45*(hole ? .2 : 1)*(back ? .6 : 1);
    if (sty === 1) a *= .15; else if (sty === 5) a *= .06; else if (sty === 2) a = back ? 0 : a*rim*2.2; else if (sty === 3) a *= back ? 1.4 : 1.2;
    if (a < .01) continue;
    const hk = Math.round((((h % 1) + 1) % 1)*72), lk = Math.round((55 + 30*Math.min(1, sweep + spark))/5)*5, ak = Math.min(25, Math.round(a*25));
    const key = hk*10000 + lk*100 + ak;
    let e = edges.get(key); if (!e) edges.set(key, e = {h: hk/72, l: lk, a: ak/25, p: new Path2D()});
    e.p.moveTo(s[0][0], s[0][1]); e.p.lineTo(s[1][0], s[1][1]); e.p.lineTo(s[2][0], s[2][1]); e.p.closePath();
  }
  o.globalCompositeOperation = 'lighter';
  for (const e of edges.values()) { o.strokeStyle = hsl(e.h, e.l, e.a); o.stroke(e.p); }
  if (U.fillImg) {                                      // the fill, clipped to the near glass, then its edges again on top
    const near = U.fillPart ? L.filter(p => p.q.part === U.fillPart) : L.filter(p => p.face > .5 && p.q.part < 7);
    o.save(); o.beginPath(); for (const {s} of near) tri(o, s); o.clip();
    o.globalCompositeOperation = 'lighter'; o.globalAlpha = Math.min(1, U.fillAmt*U.w); o.drawImage(U.fillImg, 0, 0, o.canvas.width, Hc);
    o.restore();
    o.globalCompositeOperation = 'lighter';
    for (const {q, s} of near) { o.beginPath(); tri(o, s); o.strokeStyle = hsl(U.hue + U.partHue + ph(q.part), 60, .5*U.w); o.stroke(); }
  }
  o.globalCompositeOperation = 'source-over';
}
