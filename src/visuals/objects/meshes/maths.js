// Mathematical shapes for the mesh engine, worked out here rather than generated: a geodesic sphere, a torus, a torus knot,
// a dodecahedron and a spiky star. Each is {pieces: [{pos, tri, part}], hinge}, about .9 across, every pane facing out.
// Parts (1-6) band the panes so they take different colours.

// collects triangles, each turned to face away from its own inside point
function builder(){
  const pos = [], tri = [], part = [];
  const v = p => (pos.push(...p), pos.length/3 - 1);
  const add = (a, b, c, inside, pt) => {
    const A = pos.slice(a*3, a*3 + 3), B = pos.slice(b*3, b*3 + 3), C = pos.slice(c*3, c*3 + 3);
    const u = B.map((x, k) => x - A[k]), w = C.map((x, k) => x - A[k]);
    const n = [u[1]*w[2] - u[2]*w[1], u[2]*w[0] - u[0]*w[2], u[0]*w[1] - u[1]*w[0]];
    const out = (A[0] + B[0] + C[0])/3 - inside[0], out1 = (A[1] + B[1] + C[1])/3 - inside[1], out2 = (A[2] + B[2] + C[2])/3 - inside[2];
    tri.push(...(n[0]*out + n[1]*out1 + n[2]*out2 < 0 ? [a, c, b] : [a, b, c])); part.push(pt);
  };
  return {v, add, done: () => ({pieces: [{pos, tri, part}], hinge: [0, 0, 0]})};
}
const O = [0, 0, 0], norm = (p, r = 1) => { const l = Math.hypot(...p); return p.map(x => x/l*r); };
const band = (y, n = 6) => 1 + Math.min(n - 1, Math.floor((y*.5/.45 + .5)*n));   // a part by height, bottom to top

// the icosahedron's corners, on a sphere of radius r
function icosa(r){
  const t = (1 + Math.sqrt(5))/2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => norm(p, r));
  const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return {V, F};
}

// a geodesic sphere: the icosahedron's faces split twice and pushed out onto the sphere (320 panes)
export function sphere(r = .45, levels = 2){
  let {V, F} = icosa(r);
  for (let l = 0; l < levels; l++) {
    const mid = new Map(), m = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a;
      if (!mid.has(k)) { V.push(norm(V[a].map((x, i) => (x + V[b][i])/2), r)); mid.set(k, V.length - 1); } return mid.get(k); };
    F = F.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  }
  const B = builder(), id = V.map(p => B.v(p));
  for (const [a, b, c] of F) B.add(id[a], id[b], id[c], O, band((V[a][1] + V[b][1] + V[c][1])/3));
  return B.done();
}

// a tube round a closed curve: the torus and the torus knot (the part runs round the curve, in six stretches)
function tube(curve, n, m, rt){
  const B = builder(), ring = [], centres = [];
  for (let i = 0; i < n; i++) {
    const t = i/n*Math.PI*2, c = curve(t), d = norm(curve(t + 1e-3).map((x, k) => x - c[k]));
    // a frame round the curve: the normal points away from the curve's axis, the binormal completes it
    let nn = norm([c[0], 0, c[2]]); const dot = nn[0]*d[0] + nn[1]*d[1] + nn[2]*d[2];
    nn = norm(nn.map((x, k) => x - d[k]*dot)); const bn = [d[1]*nn[2] - d[2]*nn[1], d[2]*nn[0] - d[0]*nn[2], d[0]*nn[1] - d[1]*nn[0]];
    ring.push(Array.from({length: m}, (_, j) => { const a = j/m*Math.PI*2; return B.v(c.map((x, k) => x + (nn[k]*Math.cos(a) + bn[k]*Math.sin(a))*rt)); }));
    centres.push(c);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const i2 = (i + 1) % n, j2 = (j + 1) % m, inside = centres[i].map((x, k) => (x + centres[i2][k])/2), pt = 1 + Math.floor(i/n*6);
    B.add(ring[i][j], ring[i2][j], ring[i2][j2], inside, pt); B.add(ring[i][j], ring[i2][j2], ring[i][j2], inside, pt);
  }
  return B.done();
}
export const torus = () => tube(t => [Math.cos(t)*.32, 0, Math.sin(t)*.32], 32, 12, .12);                    // 768 panes
// the (2,3) torus knot: round the ring twice while winding through it three times
export const knot = () => tube(t => { const r = .27 + .1*Math.cos(3*t); return [Math.cos(2*t)*r, -.1*Math.sin(3*t)*1.4, Math.sin(2*t)*r]; }, 120, 7, .055);   // 1680 panes

// the dodecahedron: twelve pentagons, each fanned from its centre (60 panes)
export function dodeca(r = .45){
  const {V: I, F} = icosa(1), B = builder();
  const C = F.map(f => norm([0, 1, 2].map(k => (I[f[0]][k] + I[f[1]][k] + I[f[2]][k])/3), r));   // its corners sit over the icosahedron's faces
  I.forEach((p, vi) => {
    const ring = F.map((f, i) => f.includes(vi) ? i : -1).filter(i => i >= 0);
    // order the five corners round this face
    const n = norm(p), a0 = C[ring[0]], ref = norm(a0.map((x, k) => x - n[k]*(a0[0]*n[0] + a0[1]*n[1] + a0[2]*n[2])));
    const sd = [n[1]*ref[2] - n[2]*ref[1], n[2]*ref[0] - n[0]*ref[2], n[0]*ref[1] - n[1]*ref[0]];
    ring.sort((x, y) => Math.atan2(C[x].reduce((s, v, k) => s + v*sd[k], 0), C[x].reduce((s, v, k) => s + v*ref[k], 0))
      - Math.atan2(C[y].reduce((s, v, k) => s + v*sd[k], 0), C[y].reduce((s, v, k) => s + v*ref[k], 0)));
    const mid = [0, 1, 2].map(k => ring.reduce((s, i) => s + C[i][k], 0)/5), c = B.v(mid), ids = ring.map(i => B.v(C[i]));
    for (let i = 0; i < 5; i++) B.add(c, ids[i], ids[(i + 1) % 5], O, 1 + vi % 6);
  });
  return B.done();
}

// a spiky star: each face of an icosahedron raised into a pyramid (60 panes)
export function star(r = .26, spike = .47){
  const {V, F} = icosa(r), B = builder(), id = V.map(p => B.v(p));
  F.forEach(([a, b, c], fi) => {
    const tip = B.v(norm([0, 1, 2].map(k => V[a][k] + V[b][k] + V[c][k]), spike));
    for (const [x, y] of [[a, b], [b, c], [c, a]]) B.add(id[x], id[y], tip, O, 1 + fi % 6);
  });
  return B.done();
}
