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
uniform float uRot,uPitch,uSize,uAsp,uJaw,uEx,uGone,uFill,uDark,uHue,uPartHue,uSweep,uSweepAmt,uSpark,uSparkSeed,uGlow,uLine,uH,uEdge,uBright;
uniform vec2 uPos; uniform vec3 uHinge;
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
  vec3 col=hsv(uHue+uPartHue+aInfo.x*0.11,0.75,1.0);
  float a=uEdge>0.5 ? (0.35+0.65*face)*(0.8+uGlow*0.8)+sweep*1.5+spark*1.2
                    : (uFill*(0.3+0.7*face)*(0.4+0.6*max(dot(nw,normalize(vec3(-0.4,0.6,0.7))),0.0))+sweep*0.5+spark*0.9);
  if(aInfo.x>6.5){                                        // the holes (eye sockets, nose): dark, faint edges; the sockets glow on the downbeat
    col=hsv(uHue+uPartHue+0.5,0.9,1.0); a=uEdge>0.5 ? a*0.2 : (aInfo.x<7.5 ? uGlow*1.4 : 0.0);
  }
  vCol=vec4(mix(col,vec3(1.0),min(0.6,sweep*0.5+spark*0.4))*a*uBright*(1.0-gone),uEdge>0.5 ? 1.0 : uDark*uBright*(1.0-gone));
  vScr=vec2(s.x/uAsp,s.y)+0.5;                           // where on screen, for a fill
  vFillW=(aInfo.x>6.5 ? 0.0 : 1.0)*uBright*(1.0-gone);   // a fill shows through the glass, not in the holes
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
  // on screen: the far side's edges show faintly through, then the glass panes (darkening what's behind them and
  // hiding the far side, and holding a fill if it has one: U.fillTex, U.fillAmt), then the near edges in full.
  // Into the trails (no depth there): the edges only, dimmer. 'cover': the panes flat white, for a mask.
  return function draw(U, W, H, stage){
    gl.useProgram(p);
    gl.uniform1f(u.uRot, U.rot); gl.uniform1f(u.uPitch, U.pitch); gl.uniform1f(u.uSize, U.size); gl.uniform1f(u.uAsp, W/H);
    gl.uniform2f(u.uPos, U.pos[0], U.pos[1]); gl.uniform3fv(u.uHinge, mesh.hinge); gl.uniform1f(u.uJaw, U.jaw);
    gl.uniform1f(u.uEx, U.ex); gl.uniform1f(u.uGone, U.gone); gl.uniform1f(u.uFill, U.fill); gl.uniform1f(u.uDark, U.dark); gl.uniform1f(u.uHue, U.hue);
    gl.uniform1f(u.uPartHue, U.partHue); gl.uniform1f(u.uSweep, U.sweep); gl.uniform1f(u.uSweepAmt, U.sweepAmt);
    gl.uniform1f(u.uSpark, U.spark); gl.uniform1f(u.uSparkSeed, U.sparkSeed); gl.uniform1f(u.uGlow, U.glow);
    gl.uniform1f(u.uLine, Math.max(1, U.line*H/720)); gl.uniform1f(u.uH, H*2);   // U.line px wide on a 720-line screen, scaled
    gl.uniform1f(u.uCover, stage === 'cover' ? 1 : 0); gl.uniform1f(u.uFillAmt, 0);
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
      if (U.fillTex) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, U.fillTex); gl.uniform1i(u.uFillTex, 4); gl.uniform1f(u.uFillAmt, U.fillAmt); }
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
const rx = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], c*p[1] - s*p[2], s*p[1] + c*p[2]]; };
const ry = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [c*p[0] + s*p[2], p[1], -s*p[0] + c*p[2]]; };
const hsl = (h, l, a) => `hsla(${((h % 1) + 1) % 1*360},75%,${l}%,${Math.max(0, Math.min(1, a)).toFixed(3)})`;
// every visible pane, placed and projected onto the canvas, back to front
function project2d(o, panes, hinge, U){
  const Wc = o.canvas.width, Hc = o.canvas.height, sc = Hc*U.size*FOCAL;
  const place = (q, p) => {
    let c = q.c, n = q.n;
    if (q.hinged) { const h = v => rx(v.map((x, k) => x - hinge[k]), U.jaw).map((x, k) => x + hinge[k]); p = h(p); c = h(c); n = rx(n, U.jaw); }
    const e = U.ex*(.5 + q.seed), cl = Math.hypot(...c) || 1, d0 = n.map((x, k) => x + c[k]/cl*.8), dl = Math.hypot(...d0);
    const r = ry(rx(p.map((x, k) => x - c[k]), e*(q.seed*9 - 4.5)), e*(q.seed*7 - 3.5));
    p = r.map((x, k) => c[k] + x*(1 - .3*e) + d0[k]/dl*e*.9);
    return rx(ry(p, U.rot), U.pitch);
  };
  const proj = p => [Wc/2 + (U.pos[0] + p[0]*sc/(CAM - p[2])/Hc)*Hc, Hc/2 - (U.pos[1] + p[1]*sc/(CAM - p[2])/Hc)*Hc];
  const L = [];
  for (const q of panes) {
    if (q.seed < U.gone) continue;
    const pts = q.v.map(v => place(q, v)), nw = rx(ry(q.n, U.rot), U.pitch);
    L.push({q, s: pts.map(proj), z: (pts[0][2] + pts[1][2] + pts[2][2])/3, face: .5 + .5*nw[2]});
  }
  return L.sort((a, b) => a.z - b.z);
}
const tri = (o, s) => { o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath(); };
// the object's silhouette as a path (for masks): every visible pane, holes included
export function meshPath2d(o, panes, hinge, U){ o.beginPath(); for (const {s} of project2d(o, panes, hinge, U)) tri(o, s); }
// U.fillImg (a canvas) and U.fillAmt: a fill seen through the glass of the near panes, the holes left dark
export function meshDraw2d(o, panes, hinge, U){
  const Hc = o.canvas.height, L = project2d(o, panes, hinge, U);
  o.lineJoin = 'round'; o.lineWidth = Math.max(1, U.line*Hc/720*.8);   // back to front: dark glass over what's behind, then light
  for (const {q, s, face} of L) {
    const sweep = U.sweepAmt*Math.exp(-(((q.c[1] - (.55 - U.sweep*1.1))*7)**2)), spark = U.spark*(((q.seed*91.7 + U.sparkSeed) % 1) >= .88 ? 1 : 0);
    const hole = q.part >= 7, h = hole ? U.hue + U.partHue + .5 : U.hue + U.partHue + q.part*.11, w = U.w;   // eye sockets and nose: dark holes
    o.beginPath(); o.moveTo(s[0][0], s[0][1]); o.lineTo(s[1][0], s[1][1]); o.lineTo(s[2][0], s[2][1]); o.closePath();
    const fa = hole ? (q.part === 7 ? U.glow*1.4 : 0) : U.fill*(.3 + .7*face) + sweep*.5 + spark*.9;
    o.globalCompositeOperation = 'source-over'; o.fillStyle = `rgba(0,0,0,${(U.dark*w).toFixed(3)})`; o.fill();
    o.globalCompositeOperation = 'lighter';
    if (fa > .01) { o.fillStyle = hsl(h, 55, fa*w*.5); o.fill(); }
    o.strokeStyle = hsl(h, 55 + 30*Math.min(1, sweep + spark), ((.35 + .65*face)*(.8 + U.glow*.8) + sweep*1.5 + spark*1.2)*w*.45*(hole ? .2 : 1)); o.stroke();
  }
  if (U.fillImg) {                                      // the fill, clipped to the near glass, then its edges again on top
    const near = L.filter(p => p.face > .5 && p.q.part < 7);
    o.save(); o.beginPath(); for (const {s} of near) tri(o, s); o.clip();
    o.globalCompositeOperation = 'lighter'; o.globalAlpha = Math.min(1, U.fillAmt*U.w); o.drawImage(U.fillImg, 0, 0, o.canvas.width, Hc);
    o.restore();
    o.globalCompositeOperation = 'lighter';
    for (const {q, s} of near) { o.beginPath(); tri(o, s); o.strokeStyle = hsl(U.hue + U.partHue + q.part*.11, 60, .5*U.w); o.stroke(); }
  }
  o.globalCompositeOperation = 'source-over';
}
