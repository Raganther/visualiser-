// Mesh objects: a 3D mesh drawn as glowing wire edges over faint glass panes, where every pane can move on its own
// (fly apart and back, light up in sweeps, sparkle, vanish). A leaf module: no engine imports, so visuals can use it.
// A mesh is {pieces: [{pos, tri, part, hinge?}]}; each piece's panes can hinge together (a jaw).
// U, the per-frame settings: rot, pitch, size, pos [x,y], asp, jaw, ex (0 whole .. 1 scattered), gone (0..1 of panes
// vanished), fill, dark (how much the glass darkens what's behind it), xray (how bright the far side's edges show through),
// line (px), hue, partHue, sweep (0..1 down the object) and sweepAmt, spark and sparkSeed, glow, trail, w (overall).

const CAM = 3.2, FOCAL = 2.6;   // the camera sits this far out on z; FOCAL sets how strong the perspective is
// a small, fixed random number per pane, the same in both renderers
const seedOf = i => { const x = Math.sin(i*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };

// per-pane data, shared by both renderers: corners, centre, normal, part, piece (1 = hinged), seed
export function panesOf(mesh){
  const panes = [];
  for (const pc of mesh.pieces) for (let t = 0; t < pc.tri.length; t += 3) {
    const v = [0, 1, 2].map(k => { const i = pc.tri[t + k]*3; return [pc.pos[i], pc.pos[i + 1], pc.pos[i + 2]]; });
    const c = [0, 1, 2].map(k => (v[0][k] + v[1][k] + v[2][k])/3);
    const u = v[1].map((x, k) => x - v[0][k]), w = v[2].map((x, k) => x - v[0][k]);
    let n = [u[1]*w[2] - u[2]*w[1], u[2]*w[0] - u[0]*w[2], u[0]*w[1] - u[1]*w[0]]; const l = Math.hypot(...n) || 1; n = n.map(x => x/l);
    panes.push({v, c, n, part: pc.part[t/3], hinged: pc.hinge ? 1 : 0, seed: seedOf(panes.length)});
  }
  return panes;
}

// ---- WebGL ----
const VS = `
attribute vec3 aPos, aOth, aCen, aNrm; attribute vec4 aInfo;   // info: part, hinged, seed, side (0 for panes, +-1 for edges)
uniform float uRot,uPitch,uSize,uAsp,uJaw,uEx,uGone,uFill,uDark,uHue,uPartHue,uSweep,uSweepAmt,uSpark,uSparkSeed,uGlow,uLine,uH,uEdge,uBright,uFillPart;
uniform vec2 uPos, uLightDir; uniform vec3 uHinge, uPal, uLight;   // uLight: the world's light (hue offset, saturation, strength)
varying vec4 vCol; varying float vSide; varying vec2 vScr; varying float vFillW;
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
vec3 rx(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z); }
vec3 ry(vec3 p,float a){ float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z); }
// a point of a pane, after the jaw's hinge, the pane's own flight and spin, then the whole object's turn
vec3 place(vec3 p){
  vec3 c=aCen, n=aNrm;
  if(aInfo.y>0.5){ p=rx(p-uHinge,uJaw)+uHinge; c=rx(c-uHinge,uJaw)+uHinge; n=rx(n,uJaw); }
  float s=aInfo.z, e=uEx*(0.5+s);
  vec3 dir=normalize(n+normalize(c+vec3(0.0,0.0,0.001))*0.8);
  p=c+ry(rx(p-c,e*(s*9.0-4.5)),e*(s*7.0-3.5))*(1.0-0.3*e)+dir*e*0.9;   // spins about its own centre as it flies
  return rx(ry(p,uRot),uPitch);
}
vec2 screen(vec3 p){ return uPos+p.xy*uSize*${FOCAL.toFixed(1)}/(${CAM.toFixed(1)}-p.z); }
void main(){
  vec3 p=place(aPos); vec2 s=screen(p);
  if(aInfo.w!=0.0){                                     // an edge: widened sideways on screen into a band
    vec2 o=screen(place(aOth)), d=normalize(vec2(o.x-s.x,o.y-s.y)+vec2(0.00001,0.0));
    s+=vec2(-d.y,d.x)*aInfo.w*uLine/uH;
  }
  vSide=aInfo.w;
  float gone=step(aInfo.z,uGone);                         // vanished panes collapse to nothing
  vec3 nw=rx(ry(aNrm,uRot),uPitch);
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
  vCol=vec4(mix(col,vec3(1.0),min(0.6,sweep*0.5+spark*0.4))*a*uBright*(1.0-gone),uEdge>0.5 ? 1.0 : uDark*uBright*(1.0-gone));
  vScr=vec2(s.x/uAsp,s.y)+0.5;                           // where on screen, for a fill
  vFillW=(uFillPart>0.5 ? step(abs(aInfo.x-uFillPart),0.5) : aInfo.x>6.5 ? 0.0 : 1.0)*uBright*(1.0-gone);   // a fill shows through the glass (or one part), not in the holes
  gl_Position=vec4(s.x*2.0/uAsp,s.y*2.0,-p.z/3.0,1.0);   // nearer is smaller depth, for hiding the far side
}`;
const FS = `precision mediump float; varying vec4 vCol; varying float vSide; varying vec2 vScr; varying float vFillW;
uniform sampler2D uFillTex; uniform float uFillAmt, uCover;
void main(){
  if(uCover>0.5){ gl_FragColor=vec4(vec3(step(0.001,vFillW)),1.0); return; }   // the silhouette, for masks
  float f=vSide==0.0 ? 1.0 : 1.0-vSide*vSide; vec3 c=vCol.rgb*f;
  if(vSide==0.0 && uFillAmt>0.0) c+=texture2D(uFillTex,vScr).rgb*uFillAmt*vFillW;   // a fill seen through the glass
  gl_FragColor=vec4(c,vCol.a*f);
}`;

export function meshGL(gl, mesh){
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, 'precision highp float;' + VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
  const ATT = ['aPos', 'aOth', 'aCen', 'aNrm', 'aInfo'];
  ATT.forEach((a, i) => gl.bindAttribLocation(p, i + 1, a));   // attribute 0 stays the engine's full-screen quad
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  // one interleaved buffer each for the panes and the edges: pos, other end, centre, normal (3 each), info (4)
  const panes = panesOf(mesh), fill = [], edge = [];
  const put = (arr, pos, oth, q, side) => arr.push(...pos, ...oth, ...q.c, ...q.n, q.part, q.hinged, q.seed, side);
  for (const q of panes) {
    for (const v of q.v) put(fill, v, v, q, 0);
    for (let k = 0; k < 3; k++) { const a = q.v[k], b = q.v[(k + 1) % 3];   // each edge as two triangles across its width
      put(edge, a, b, q, 1); put(edge, a, b, q, -1); put(edge, b, a, q, -1); put(edge, a, b, q, 1); put(edge, b, a, q, -1); put(edge, b, a, q, 1); }
  }
  const buf = data => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); return {b, n: data.length/16}; };
  const B = {fill: buf(fill), edge: buf(edge)};
  let blank = null;
  // on screen: the far side's edges show faintly through, then the glass panes (darkening what's behind them and
  // hiding the far side, and holding a fill if it has one: U.fillTex, U.fillAmt), then the near edges in full.
  // Into the trails (no depth there): the edges only, dimmer. 'cover': the panes flat white, for a mask.
  return function draw(U, W, H, stage){
    gl.useProgram(p);
    gl.uniform1f(u.uRot, U.rot); gl.uniform1f(u.uPitch, U.pitch); gl.uniform1f(u.uSize, U.size); gl.uniform1f(u.uAsp, W/H);
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
      [3, 3, 3, 3, 4].reduce((off, n, i) => { gl.vertexAttribPointer(i + 1, n, gl.FLOAT, false, 64, off*4); return off + n; }, 0);
      gl.drawArrays(gl.TRIANGLES, 0, b.n);
    };
    if (stage === 'cover') pass('fill', 1);
    else if (stage === 'trails') { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); pass('edge', U.trail); }
    else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE); pass('edge', U.xray);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);          // panes sit just behind their own edges
      // the fill, if it has one (otherwise the blank bound above)
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, U.fillTex || blank); gl.uniform1i(u.uFillTex, 4);
      if (U.fillTex) gl.uniform1f(u.uFillAmt, U.fillAmt);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); pass('fill', 1);
      gl.uniform1f(u.uFillAmt, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      gl.blendFunc(gl.ONE, gl.ONE); pass('edge', 1);
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
  const [hx, hy, hz] = hinge || [0, 0, 0], Lt = U.light || {amt: 0}, lx = Lt.x || 0, ly = Lt.y || 0, ll = Math.hypot(lx, ly, .6);
  const out = [0, 0, 0];
  // a point after the hinge, the pane's own flight and spin (e), then the whole object's turn, into out
  const place = (x, y, z, hinged, cx, cy, cz, e, ca, sa, cb, sb, dx, dy, dz) => {
    if (hinged) { const y0 = y - hy, z0 = z - hz; y = cj*y0 - sj*z0 + hy; z = sj*y0 + cj*z0 + hz; }
    if (e > 1e-5) {
      let px = x - cx, py = y - cy, pz = z - cz;
      const py2 = ca*py - sa*pz, pz2 = sa*py + ca*pz; py = py2; pz = pz2;             // rx
      const px3 = cb*px + sb*pz, pz3 = -sb*px + cb*pz; px = px3; pz = pz3;            // ry
      const k = 1 - .3*e; x = cx + px*k + dx; y = cy + py*k + dy; z = cz + pz*k + dz;
    }
    const x1 = cr*x + sr*z, z1 = -sr*x + cr*z;                                          // ry(rot)
    out[0] = x1; out[1] = cp*y - spi*z1; out[2] = spi*y + cp*z1;                        // rx(pitch)
  };
  const L = [];
  for (const q of panes) {
    if (q.seed < U.gone) continue;
    let [cx, cy, cz] = q.c, [nx, ny, nz] = q.n;
    if (q.hinged) { const y0 = cy - hy, z0 = cz - hz; cy = cj*y0 - sj*z0 + hy; cz = sj*y0 + cj*z0 + hz; const ny2 = cj*ny - sj*nz; nz = sj*ny + cj*nz; ny = ny2; }
    const e = U.ex*(.5 + q.seed);
    let ca = 1, sa = 0, cb = 1, sb = 0, dx = 0, dy = 0, dz = 0;
    if (e > 1e-5) {
      ca = Math.cos(e*(q.seed*9 - 4.5)); sa = Math.sin(e*(q.seed*9 - 4.5)); cb = Math.cos(e*(q.seed*7 - 3.5)); sb = Math.sin(e*(q.seed*7 - 3.5));
      const cl = Math.hypot(cx, cy, cz) || 1, ex = nx + cx/cl*.8, ey = ny + cy/cl*.8, ez = nz + cz/cl*.8, dl = Math.hypot(ex, ey, ez), f = e*.9/dl;
      dx = ex*f; dy = ey*f; dz = ez*f;
    }
    const s = [], v = q.v; let zs = 0;
    for (let i = 0; i < 3; i++) {
      place(v[i][0], v[i][1], v[i][2], q.hinged, cx, cy, cz, e, ca, sa, cb, sb, dx, dy, dz);
      const w = sc/(CAM - out[2]); zs += out[2];
      s.push([Wc/2 + U.pos[0]*Hc + out[0]*w, Hc/2 - U.pos[1]*Hc - out[1]*w]);
    }
    const n0 = q.n, nx1 = cr*n0[0] + sr*n0[2], nz1 = -sr*n0[0] + cr*n0[2], nwy = cp*n0[1] - spi*nz1, nwz = spi*n0[1] + cp*nz1;   // the pane's facing
    L.push({q, s, z: zs/3, face: .5 + .5*nwz, lit: Math.max(0, (nx1*lx + nwy*ly + nwz*.6)/ll)*Lt.amt});
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
  const edges = new Map(), lh = ((U.hue + (U.light ? U.light.hue : 0)) % 1 + 1) % 1*360;
  for (const {q, s, face, lit} of L) {
    const sweep = U.sweepAmt*Math.exp(-(((q.c[1] - (.55 - U.sweep*1.1))*7)**2)), spark = U.spark*(((q.seed*91.7 + U.sparkSeed) % 1) >= .88 ? 1 : 0);
    const hole = q.part >= 7, h = hole ? U.hue + U.partHue + pal[2] + .5 : U.hue + U.partHue + ph(q.part), w = U.w;   // eye sockets and nose: dark holes
    const fa = hole ? (q.part === 7 ? U.glow*1.4 : 0) : U.fill*(.3 + .7*face) + sweep*.5 + spark*.9;
    const back = face < .45 && !sweep && !spark;   // the far side: edges only (the near glass covers it)
    if (!back) {   // one fill: the dark glass over what's behind, with its own glow and the world's light mixed in
      const d = Math.max(.05, U.dark*w), g = hsvRgb(h, .55, Math.min(1, fa*w*.5)), l = hole ? [0, 0, 0] : hsvRgb(lh/360, U.light ? U.light.sat : 0, lit*.3*w);
      const c = k => Math.min(255, Math.round((g[k] + l[k])/d*255));
      o.beginPath(); o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath();
      o.fillStyle = `rgba(${c(0)},${c(1)},${c(2)},${d.toFixed(3)})`; o.fill();
    }
    const a = ((.35 + .65*face)*(.8 + U.glow*.8) + sweep*1.5 + spark*1.2)*w*.45*(hole ? .2 : 1)*(back ? .6 : 1);
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
