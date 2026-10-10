// Facets: a polyhedron that gains and loses facets, morphs between shapes, and lights each facet on its own. A leaf module
// (no engine imports), drawn in both renderers; the musical brain is visuals/objects/prism.js.
// Geometry: an icosahedron subdivided F times (20, 80, 320, 1280 facets). Every vertex of the finest mesh knows, for each
// level, the coarser facet it lies in and where in it (barycentric weights), so its place at any level of detail is that
// facet's corners blended: at a whole level the fine panes lie flat on the coarse facets, between two levels they part
// along the new edges. Detail can differ over the surface (a wave of new facets sweeping across), and since every place
// is worked out per vertex, neighbours always meet. Each fine edge knows the coarsest level whose facets it bounds, so it
// shows only once the detail reaches that level, fading in.
// It's drawn one frame at a time from what the brain hands over: per vertex its radius (the shape) and detail; per fine
// face (sorted far to near here) its fill colour and alpha, its edge colour, and how far it's pushed out.
import { mark } from './stalls.js';

const CAM = 3.2, FOCAL = 2.6;   // the same camera as render/mesh.js, so facets and wire objects stand in one space
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

// ---- the geometry, built once ----
const GEOS = {};
export function facetGeo(F = 3){
  if (GEOS[F]) return GEOS[F];
  const t = (1 + Math.sqrt(5))/2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const ek = (a, b) => a < b ? a*65536 + b : b*65536 + a, elev = new Map();
  for (const [a, b, c] of faces) for (const [p, q] of [[a, b], [b, c], [c, a]]) elev.set(ek(p, q), 0);
  const LV = [faces], PAR = [null], CH = [new Uint8Array(20).fill(3)], NV = [12];
  for (let L = 0; L < F; L++) {
    const mid = new Map(), nf = [], par = [], ch = [];
    const m = (a, b) => { const k = ek(a, b); let i = mid.get(k); if (i === undefined) { i = V.length; V.push(norm([(V[a][0] + V[b][0])/2, (V[a][1] + V[b][1])/2, (V[a][2] + V[b][2])/2])); mid.set(k, i);
      const l = elev.get(k); elev.set(ek(a, i), l); elev.set(ek(i, b), l); } return i; };
    faces.forEach(([a, b, c], f) => {
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      for (const [p, q] of [[ab, bc], [bc, ca], [ca, ab]]) elev.set(ek(p, q), L + 1);
      nf.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); par.push(f, f, f, f); ch.push(0, 1, 2, 3);
    });
    faces = nf; LV.push(nf); PAR.push(Int32Array.from(par)); CH.push(Uint8Array.from(ch)); NV.push(V.length);
  }
  const nv = V.length, nf = faces.length;
  // each fine face's ancestor at every level
  const FA = []; for (let L = 0; L <= F; L++) FA.push(new Int32Array(nf));
  for (let f = 0; f < nf; f++) { let g = f; for (let L = F; L >= 0; L--) { FA[L][f] = g; if (L) g = PAR[L][g]; } }
  // each vertex, at every level: the coarse facet it lies in (its corners) and its barycentric weights there
  const AI = new Int32Array(nv*(F + 1)*3), AW = new Float32Array(nv*(F + 1)*3);
  for (let L = 0; L <= F; L++) {
    const fl = LV[L], done = new Uint8Array(nv);
    // a vertex of a fine face lies in that face's level-L ancestor
    for (let f = 0; f < nf; f++) for (const v of faces[f]) {
      if (done[v]) continue; done[v] = 1;
      const [a, b, c] = fl[FA[L][f]], d = V[v], n = cross(sub(V[b], V[a]), sub(V[c], V[a])), k = dot(n, V[a])/dot(n, d), X = [d[0]*k, d[1]*k, d[2]*k];
      const ar = x => dot(n, cross(sub(V[x[1]], V[x[0]]), sub(X, V[x[0]])));
      const tot = dot(n, n), wa = ar([b, c])/tot, wb = ar([c, a])/tot, wc = 1 - wa - wb, o = (v*(F + 1) + L)*3;
      AI[o] = a; AI[o + 1] = b; AI[o + 2] = c; AW[o] = wa; AW[o + 1] = wb; AW[o + 2] = wc;
    }
  }
  // each fine face's edges (the one opposite each corner): the coarsest level whose facets it bounds
  const EL = new Uint8Array(nf*3), TRI = new Uint16Array(nf*3);
  faces.forEach(([a, b, c], f) => { TRI.set([a, b, c], f*3); EL[f*3] = elev.get(ek(b, c)); EL[f*3 + 1] = elev.get(ek(c, a)); EL[f*3 + 2] = elev.get(ek(a, b)); });
  // at every level: each facet's centre (on the sphere), its three neighbours (sharing an edge), which child of its parent it is
  const CEN = [], ADJ = [];
  for (let L = 0; L <= F; L++) {
    const fl = LV[L], cen = new Float32Array(fl.length*3), adj = new Int32Array(fl.length*3).fill(-1), byEdge = new Map();
    fl.forEach(([a, b, c], f) => { cen.set(norm([V[a][0] + V[b][0] + V[c][0], V[a][1] + V[b][1] + V[c][1], V[a][2] + V[b][2] + V[c][2]]), f*3);
      [[a, b], [b, c], [c, a]].forEach(([p, q], j) => { const k = ek(p, q), o = byEdge.get(k); if (o) { adj[f*3 + j] = o[0]; adj[o[0]*3 + o[1]] = f; } else byEdge.set(k, [f, j]); }); });
    CEN.push(cen); ADJ.push(adj);
  }
  const DIR = new Float32Array(nv*3); V.forEach((d, i) => DIR.set(d, i*3));
  return GEOS[F] = {F, nv, nf, NV, NF: LV.map(l => l.length), DIR, TRI, EL, FA, CH, CEN, ADJ, AI, AW};
}

// ---- a frame: every vertex placed (its shape's radius and its detail), the faces' normals and visible levels ----
// R: radius per vertex; D: detail per vertex (0..F); out: {pos, fn (face normals), fl (visible level per face)}
export function facetPlace(G, R, D, out){
  const {nv, nf, F, DIR, AI, AW, TRI} = G;
  out.pos = out.pos || new Float32Array(nv*3); out.fn = out.fn || new Float32Array(nf*3); out.fc = out.fc || new Float32Array(nf*3); out.fl = out.fl || new Uint8Array(nf); out.fd = out.fd || new Float32Array(nf);
  const P = out.pos;
  for (let v = 0; v < nv; v++) {
    const d = Math.max(0, Math.min(F, D[v])), L0 = Math.min(F - 1, Math.floor(d)), fr = d - L0;
    let x = 0, y = 0, z = 0;
    for (let s = 0; s < 2; s++) {
      const L = L0 + s, k = s ? fr : 1 - fr; if (k < 1e-4) continue;
      const o = (v*(F + 1) + L)*3;
      for (let j = 0; j < 3; j++) { const i = AI[o + j], w = AW[o + j]*k*R[i]; x += DIR[i*3]*w; y += DIR[i*3 + 1]*w; z += DIR[i*3 + 2]*w; }
    }
    P[v*3] = x; P[v*3 + 1] = y; P[v*3 + 2] = z;
  }
  return faceFrame(G, D, out);
}

// each face's normal, centre and visible level, from the placed corners
function faceFrame(G, D, out){
  const {nf, F, TRI} = G, P = out.pos;
  for (let f = 0; f < nf; f++) {
    const a = TRI[f*3]*3, b = TRI[f*3 + 1]*3, c = TRI[f*3 + 2]*3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    let nx = uy*wz - uz*wy, ny = uz*wx - ux*wz, nz = ux*wy - uy*wx; const l = Math.hypot(nx, ny, nz) || 1;
    out.fn[f*3] = nx/l; out.fn[f*3 + 1] = ny/l; out.fn[f*3 + 2] = nz/l;
    out.fc[f*3] = (P[a] + P[b] + P[c])/3; out.fc[f*3 + 1] = (P[a + 1] + P[b + 1] + P[c + 1])/3; out.fc[f*3 + 2] = (P[a + 2] + P[b + 2] + P[c + 2])/3;
    const dd = (D[TRI[f*3]] + D[TRI[f*3 + 1]] + D[TRI[f*3 + 2]])/3; out.fd[f] = dd;
    out.fl[f] = Math.max(0, Math.min(F, Math.floor(dd + .5)));
  }
  return out;
}

// ---- a sheet: the same, from a flat square instead of a ball (visuals/objects/fold.js lays it out as any surface) ----
// The square [-1,1]² cut into the octahedron's eight faces (its inner diamond and four corner triangles), so it folds into
// an even ball with no pinched poles, like folding an octahedron from paper, and lies flat, rolls into a tube or a ring
// just as well. Split F times (8, 32, 128, 512, 2,048 facets at F = 4); every vertex sits on a grid of 2^F a unit (GI: its
// place in the grid, UV: its place on the sheet), and knows its coarse facets and weights at every level, as the ball does
export function sheetGeo(F = 4){
  const key = 's' + F; if (GEOS[key]) return GEOS[key];
  const V = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  let faces = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [1, 5, 2], [2, 6, 3], [3, 7, 4], [4, 8, 1]];
  const ek = (a, b) => a < b ? a*65536 + b : b*65536 + a, elev = new Map();
  for (const [a, b, c] of faces) for (const [p, q] of [[a, b], [b, c], [c, a]]) elev.set(ek(p, q), 0);
  const LV = [faces], PAR = [null], CH = [new Uint8Array(8).fill(3)];
  for (let L = 0; L < F; L++) {
    const mid = new Map(), nf = [], par = [], ch = [];
    const m = (a, b) => { const k = ek(a, b); let i = mid.get(k); if (i === undefined) { i = V.length; V.push([(V[a][0] + V[b][0])/2, (V[a][1] + V[b][1])/2]); mid.set(k, i);
      const l = elev.get(k); elev.set(ek(a, i), l); elev.set(ek(i, b), l); } return i; };
    faces.forEach(([a, b, c], f) => {
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      for (const [p, q] of [[ab, bc], [bc, ca], [ca, ab]]) elev.set(ek(p, q), L + 1);
      nf.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); par.push(f, f, f, f); ch.push(0, 1, 2, 3);
    });
    faces = nf; LV.push(nf); PAR.push(Int32Array.from(par)); CH.push(Uint8Array.from(ch));
  }
  const nv = V.length, nf = faces.length;
  const FA = []; for (let L = 0; L <= F; L++) FA.push(new Int32Array(nf));
  for (let f = 0; f < nf; f++) { let g = f; for (let L = F; L >= 0; L--) { FA[L][f] = g; if (L) g = PAR[L][g]; } }
  const AI = new Int32Array(nv*(F + 1)*3), AW = new Float32Array(nv*(F + 1)*3);
  for (let L = 0; L <= F; L++) {
    const fl = LV[L], done = new Uint8Array(nv);
    for (let f = 0; f < nf; f++) for (const v of faces[f]) {
      if (done[v]) continue; done[v] = 1;
      const [a, b, c] = fl[FA[L][f]], [px, py] = V[v];
      const ar = (p, q, r) => (V[q][0] - V[p][0])*(r[1] - V[p][1]) - (V[q][1] - V[p][1])*(r[0] - V[p][0]), tot = ar(a, b, V[c]);
      const wa = ar(b, c, [px, py])/tot, wb = ar(c, a, [px, py])/tot, o = (v*(F + 1) + L)*3;
      AI[o] = a; AI[o + 1] = b; AI[o + 2] = c; AW[o] = wa; AW[o + 1] = wb; AW[o + 2] = 1 - wa - wb;
    }
  }
  const EL = new Uint8Array(nf*3), TRI = new Uint16Array(nf*3);
  faces.forEach(([a, b, c], f) => { TRI.set([a, b, c], f*3); EL[f*3] = elev.get(ek(b, c)); EL[f*3 + 1] = elev.get(ek(c, a)); EL[f*3 + 2] = elev.get(ek(a, b)); });
  const CEN = [], ADJ = [];
  for (let L = 0; L <= F; L++) {
    const fl = LV[L], cen = new Float32Array(fl.length*3), adj = new Int32Array(fl.length*3).fill(-1), byEdge = new Map();
    fl.forEach(([a, b, c], f) => { cen.set([(V[a][0] + V[b][0] + V[c][0])/3, (V[a][1] + V[b][1] + V[c][1])/3, 0], f*3);
      [[a, b], [b, c], [c, a]].forEach(([p, q], j) => { const k = ek(p, q), o = byEdge.get(k); if (o) { adj[f*3 + j] = o[0]; adj[o[0]*3 + o[1]] = f; } else byEdge.set(k, [f, j]); }); });
    CEN.push(cen); ADJ.push(adj);
  }
  const n = 1 << F, UV = new Float32Array(nv*2), GI = new Int32Array(nv), VI = new Int32Array((2*n + 1)**2).fill(-1);
  V.forEach(([x, y], i) => { UV[i*2] = x; UV[i*2 + 1] = y; const g = Math.round((x + 1)*n)*(2*n + 1) + Math.round((y + 1)*n); GI[i] = g; VI[g] = i; });
  return GEOS[key] = {F, nv, nf, NF: LV.map(l => l.length), TRI, EL, FA, CH, CEN, ADJ, AI, AW, UV, GI, VI, side: 2*n + 1};
}
// a frame of a sheet (or any of these geometries): every vertex placed from its corners' places (S3: xyz per vertex, worked
// out at the finest level) blended at its detail, so at a coarse detail the fine panes lie flat on the coarse facets
export function facetPlaceP(G, S3, D, out){
  const {nv, F, AI, AW} = G;
  out.pos = out.pos || new Float32Array(nv*3); out.fn = out.fn || new Float32Array(G.nf*3); out.fc = out.fc || new Float32Array(G.nf*3); out.fl = out.fl || new Uint8Array(G.nf); out.fd = out.fd || new Float32Array(G.nf);
  const P = out.pos;
  for (let v = 0; v < nv; v++) {
    const d = Math.max(0, Math.min(F, D[v])), L0 = Math.min(F - 1, Math.floor(d)), fr = d - L0;
    let x = 0, y = 0, z = 0;
    for (let s = 0; s < 2; s++) {
      const L = L0 + s, k = s ? fr : 1 - fr; if (k < 1e-4) continue;
      const o = (v*(F + 1) + L)*3;
      for (let j = 0; j < 3; j++) { const i = AI[o + j]*3, w = AW[o + j]*k; x += S3[i]*w; y += S3[i + 1]*w; z += S3[i + 2]*w; }
    }
    P[v*3] = x; P[v*3 + 1] = y; P[v*3 + 2] = z;
  }
  return faceFrame(G, D, out);
}

// ---- projection, shared by both renderers ----
// U: rot, pitch, roll, sq, size, pos [x, y]; the frame X: pos, fn, off (per face, a push in object space), and from the
// brain fill (rgba per face), edge (rgb per face), eA (per face edge, 0..1). Out: screen points (px), each face's depth and
// facing, sorted far to near.
function project(G, X, U, W, H){
  const {nv, nf, TRI} = G, P = X.pos;
  const cr = Math.cos(U.rot), sr = Math.sin(U.rot), cp = Math.cos(U.pitch), sp = Math.sin(U.pitch), co = Math.cos(U.roll || 0), so = Math.sin(U.roll || 0);
  const sq = U.sq || 0, sqx = 1 + sq*.5, sqy = 1 - sq, sc = H*U.size*FOCAL, ox = W/2 + U.pos[0]*H, oy = H/2 - U.pos[1]*H;
  const turn = (x, y, z, o, k) => { x *= sqx; y *= sqy; z *= sqx; const x1 = cr*x + sr*z, z1 = -sr*x + cr*z, y2 = cp*y - sp*z1, z2 = sp*y + cp*z1; o[k] = co*x1 - so*y2; o[k + 1] = so*x1 + co*y2; o[k + 2] = z2; };
  const S = X.scr = X.scr || new Float32Array(nf*9), Z = X.z = X.z || new Float32Array(nf), FZ = X.face = X.face || new Float32Array(nf), T = X.tmp = X.tmp || new Float32Array(3);
  const off = X.off;
  for (let f = 0; f < nf; f++) {
    const ex = off ? off[f*3] : 0, ey = off ? off[f*3 + 1] : 0, ez = off ? off[f*3 + 2] : 0;
    let zs = 0;
    for (let k = 0; k < 3; k++) {
      const v = TRI[f*3 + k]*3; turn(P[v] + ex, P[v + 1] + ey, P[v + 2] + ez, T, 0);
      const w = sc/(CAM - T[2]); S[f*9 + k*3] = ox + T[0]*w; S[f*9 + k*3 + 1] = oy - T[1]*w; S[f*9 + k*3 + 2] = T[2]; zs += T[2];
    }
    turn(X.fn[f*3], X.fn[f*3 + 1], X.fn[f*3 + 2], T, 0); FZ[f] = T[2]/(sqx || 1);
    Z[f] = zs/3;
  }
  // far to near by visible facet (each facet's panes are coplanar, so they sort together and simple mode fills them as one)
  const GZ = X.gz = X.gz || new Float32Array(nf), GN = X.gn = X.gn || new Float32Array(nf), K = X.gk = X.gk || new Int32Array(nf), FA = G.FA;
  const acc = X.acc || (X.acc = new Map()); acc.clear();
  for (let f = 0; f < nf; f++) { const k = X.fl[f]*100000 + FA[X.fl[f]][f]; K[f] = k; const a = acc.get(k); if (a) { a[0] += Z[f]; a[1]++; } else acc.set(k, [Z[f], 1]); }
  for (let f = 0; f < nf; f++) { const a = acc.get(K[f]); GZ[f] = a[0]/a[1]; GN[f] = K[f]; }
  const O = X.order = X.order && X.order.length === nf ? X.order : Uint16Array.from({length: nf}, (_, i) => i);
  O.sort((a, b) => GZ[a] - GZ[b] || GN[a] - GN[b]);
  return X;
}

// ---- WebGL: one pass of the faces far to near, each its glass and its own glowing edges (worked out in pixels per vertex, so
// no derivatives are needed); the edges of the far side show through the near glass, dimmed by it ----
const VS = `attribute vec2 aP; attribute vec3 aD, aE, aL; attribute vec4 aF; uniform vec2 uWH;
varying vec3 vD, vE, vL; varying vec4 vF; varying vec2 vS;
void main(){ vD=aD; vE=aE; vL=aL; vF=aF; vS=aP/uWH; gl_Position=vec4(aP.x/uWH.x*2.0-1.0,1.0-aP.y/uWH.y*2.0,0.0,1.0); }`;
const FS = `precision mediump float; varying vec3 vD, vE, vL; varying vec4 vF; varying vec2 vS; uniform float uLw, uCover, uFillAmt; uniform sampler2D uFillTex;
void main(){
  if(uCover>0.5){ gl_FragColor=vec4(1.0); return; }
  vec3 core=vec3(1.0)-smoothstep(vec3(uLw*0.35),vec3(uLw*1.1),vD), glow=exp(-vD/(uLw*2.5))*0.3;
  float e=max(max(vE.x*(core.x+glow.x),vE.y*(core.y+glow.y)),vE.z*(core.z+glow.z));
  vec3 c=vF.rgb+vL*e;
  if(uFillAmt>0.0) c+=texture2D(uFillTex,vec2(vS.x,1.0-vS.y)).rgb*uFillAmt*vF.a;   // a fill seen through the glass
  gl_FragColor=vec4(c,vF.a);
}`;
const NA = 15, PROGS = new WeakMap();
export const FACET = {wait: 0};   // (tests: report the program still building this many more times, as a real driver building it in the background does)
function prog(gl){
  let s = PROGS.get(gl); if (s && s.u && gl.isProgram(s.p)) return s;
  if (!s || !gl.isProgram(s.p)) {   // (started once; while the driver builds it in the background, asked again each frame)
    const p = gl.createProgram(), sh = [[gl.VERTEX_SHADER, 'precision highp float;' + VS], [gl.FRAGMENT_SHADER, FS]].map(([t, src]) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); gl.attachShader(p, x); return x; });
    ['aP', 'aD', 'aE', 'aL', 'aF'].forEach((a, i) => gl.bindAttribLocation(p, i + 1, a));   // attribute 0 stays the engine's full-screen quad
    gl.linkProgram(p); PROGS.set(gl, s = {p, sh, u: null}); mark('shader started: facets');
  }
  if (FACET.wait > 0) { FACET.wait--; return null; }
  const x = gl.getExtension('KHR_parallel_shader_compile'); if (x && !gl.getProgramParameter(s.p, x.COMPLETION_STATUS_KHR)) return null;   // (still building: shown once it is)
  if (!gl.getProgramParameter(s.p, gl.LINK_STATUS)) throw new Error(s.sh.map(x => gl.getShaderInfoLog(x)).join('') || gl.getProgramInfoLog(s.p));
  mark('shader linked: facets'); s.u = {}; for (const k of ['uWH', 'uLw', 'uCover', 'uFillAmt', 'uFillTex']) s.u[k] = gl.getUniformLocation(s.p, k);
  return s;
}
export const facetWarm = gl => { try { prog(gl); } catch (e) {} };
export function facetGL(gl, G){
  const buf = gl.createBuffer(), arr = new Float32Array(G.nf*3*NA);
  let blank = null;
  return function draw(X, U, W, H, stage){
    const s = prog(gl); if (!s) return;
    project(G, X, U, W, H);
    const {TRI} = G, Sc = X.scr, O = X.order, lw = Math.max(.8, (U.line || 2.2)*H/720);
    let o = 0;
    for (let n = 0; n < O.length; n++) {
      const f = O[n];
      const ax = Sc[f*9], ay = Sc[f*9 + 1], bx = Sc[f*9 + 3], by = Sc[f*9 + 4], cx = Sc[f*9 + 6], cy = Sc[f*9 + 7];
      const a2 = Math.abs((bx - ax)*(cy - ay) - (by - ay)*(cx - ax));
      const h = [a2/(Math.hypot(cx - bx, cy - by) || 1), a2/(Math.hypot(ax - cx, ay - cy) || 1), a2/(Math.hypot(bx - ax, by - ay) || 1)];   // each corner's height over the edge opposite
      for (let k = 0; k < 3; k++) {
        arr[o] = Sc[f*9 + k*3]; arr[o + 1] = Sc[f*9 + k*3 + 1];
        arr[o + 2] = k === 0 ? h[0] : 0; arr[o + 3] = k === 1 ? h[1] : 0; arr[o + 4] = k === 2 ? h[2] : 0;
        arr[o + 5] = X.eA[f*3]; arr[o + 6] = X.eA[f*3 + 1]; arr[o + 7] = X.eA[f*3 + 2];
        arr[o + 8] = X.edge[f*3]; arr[o + 9] = X.edge[f*3 + 1]; arr[o + 10] = X.edge[f*3 + 2];
        arr[o + 11] = X.fill[f*4]; arr[o + 12] = X.fill[f*4 + 1]; arr[o + 13] = X.fill[f*4 + 2]; arr[o + 14] = X.fill[f*4 + 3];
        o += NA;
      }
    }
    gl.useProgram(s.p); const u = s.u;
    gl.uniform2f(u.uWH, W, H); gl.uniform1f(u.uLw, lw); gl.uniform1f(u.uCover, stage === 'cover' ? 1 : 0);
    if (!blank) { blank = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, stage === 'screen' && U.fillTex || blank); gl.uniform1i(u.uFillTex, 4); gl.activeTexture(gl.TEXTURE0);   // (never the surface being drawn into)
    gl.uniform1f(u.uFillAmt, stage === 'screen' && U.fillTex ? U.fillAmt || 0 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    gl.disableVertexAttribArray(0);
    [[2, 0], [3, 2], [3, 5], [3, 8], [4, 11]].forEach(([n, at], i) => { gl.enableVertexAttribArray(i + 1); gl.vertexAttribPointer(i + 1, n, gl.FLOAT, false, NA*4, at*4); });
    gl.enable(gl.BLEND); if (stage === 'cover') gl.blendFunc(gl.ONE, gl.ZERO); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, G.nf*3);
    for (let i = 1; i <= 5; i++) gl.disableVertexAttribArray(i); gl.enableVertexAttribArray(0);
    gl.disable(gl.BLEND);
  };
}

// ---- simple mode: the faces far to near, each visible facet filled as one shape (no seams between its panes), then the
// edges gathered by colour into a few paths ----
const rgba = (r, g, b, a) => `rgba(${Math.min(255, r*255|0)},${Math.min(255, g*255|0)},${Math.min(255, b*255|0)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
export function facet2d(o, G, X, U){
  const W = o.canvas.width, H = o.canvas.height; project(G, X, U, W, H);
  const Sc = X.scr, O = X.order;
  o.save(); o.lineJoin = 'round';
  // facets: consecutive panes of the same visible facet share one path (they're coplanar, so they sort together)
  let key = -1, path = null, f0 = -1;
  const flush = () => { if (!path) return; const a = X.fill[f0*4 + 3]; if (a > .004) { o.fillStyle = rgba(X.fill[f0*4]/(a || 1), X.fill[f0*4 + 1]/(a || 1), X.fill[f0*4 + 2]/(a || 1), a); o.fill(path); } path = null; };
  const edges = new Map();
  for (let n = 0; n < O.length; n++) {
    const f = O[n], k = X.gk[f];
    if (k !== key) { flush(); key = k; f0 = f; path = new Path2D(); }
    path.moveTo(Sc[f*9], Sc[f*9 + 1]); path.lineTo(Sc[f*9 + 3], Sc[f*9 + 4]); path.lineTo(Sc[f*9 + 6], Sc[f*9 + 7]); path.closePath();
    // its edges (opposite each corner), by colour and brightness
    for (let j = 0; j < 3; j++) {
      const a = X.eA[f*3 + j]; if (a < .05) continue;
      const r = X.edge[f*3]*a, g = X.edge[f*3 + 1]*a, b = X.edge[f*3 + 2]*a, m = Math.max(r, g, b); if (m < .03) continue;
      const q = 5, ck = Math.round(r/m*q)*10000 + Math.round(g/m*q)*100 + Math.round(b/m*q), bk = Math.min(12, Math.round(m*6)), kk = ck*16 + bk;
      let e = edges.get(kk); if (!e) edges.set(kk, e = {c: [Math.round(r/m*q)/q, Math.round(g/m*q)/q, Math.round(b/m*q)/q], a: bk/6, p: new Path2D()});
      const p = (j + 1) % 3, q2 = (j + 2) % 3; e.p.moveTo(Sc[f*9 + p*3], Sc[f*9 + p*3 + 1]); e.p.lineTo(Sc[f*9 + q2*3], Sc[f*9 + q2*3 + 1]);
    }
  }
  flush();
  o.globalCompositeOperation = 'lighter'; o.lineWidth = Math.max(1, (U.line || 2.2)*H/720*.8);
  for (const e of edges.values()) { const k = Math.min(1, e.a); o.strokeStyle = rgba(e.c[0]*Math.min(1, e.a), e.c[1]*Math.min(1, e.a), e.c[2]*Math.min(1, e.a), Math.min(1, k + .2)); o.stroke(e.p); }
  o.restore();
}
export function facetPath2d(o, G, X, U, add){   // (add: onto the path already begun)
  const W = o.canvas.width, H = o.canvas.height; project(G, X, U, W, H); const Sc = X.scr;
  if (!add) o.beginPath(); for (let f = 0; f < G.nf; f++) { o.moveTo(Sc[f*9], Sc[f*9 + 1]); o.lineTo(Sc[f*9 + 3], Sc[f*9 + 4]); o.lineTo(Sc[f*9 + 6], Sc[f*9 + 7]); o.closePath(); }
}
