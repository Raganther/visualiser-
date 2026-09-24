// Shared by the mesh tools: a small kit of distance functions, and mesh(), which turns a shape into a surface and
// simplifies it to glass panes, each facing out and tagged with its part. Dev only (isosurface and meshoptimizer).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import isosurface from 'isosurface';
import { MeshoptSimplifier } from 'meshoptimizer';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- distance-function kit (x right, y up, z out of the face) ----
export const len = (x, y, z) => Math.sqrt(x*x + y*y + z*z);
export const ell = (p, c, r) => {                                  // ellipsoid (a close bound, good enough for meshing)
  const x = (p[0] - c[0])/r[0], y = (p[1] - c[1])/r[1], z = (p[2] - c[2])/r[2], k0 = len(x, y, z);
  const k1 = len(x/r[0], y/r[1], z/r[2]); return k0*(k0 - 1)/k1;
};
export const cap = (p, a, b, r) => {                               // capsule from a to b
  const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const h = Math.max(0, Math.min(1, (pa[0]*ba[0] + pa[1]*ba[1] + pa[2]*ba[2])/(ba[0]*ba[0] + ba[1]*ba[1] + ba[2]*ba[2])));
  return len(pa[0] - ba[0]*h, pa[1] - ba[1]*h, pa[2] - ba[2]*h) - r;
};
export const rbox = (p, c, b, r) => {                              // rounded box
  const q = [Math.abs(p[0] - c[0]) - b[0], Math.abs(p[1] - c[1]) - b[1], Math.abs(p[2] - c[2]) - b[2]];
  return len(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], q[1], q[2]), 0) - r;
};
export const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, .5 + .5*(b - a)/k)); return b + (a - b)*h - k*h*(1 - h); };
export const smax = (a, b, k) => -smin(-a, -b, k);
export const mx = p => [Math.abs(p[0]), p[1], p[2]];              // mirror: model the right side, get both

// ---- surface, simplified ----
await MeshoptSimplifier.ready;
export function mesh(fn, target, lo, hi, res){
  const dims = [0, 1, 2].map(i => Math.round((hi[i] - lo[i])*res));
  const m = isosurface.surfaceNets(dims, (x, y, z) => fn([x, y, z]).d, [lo, hi]);
  const pos = new Float32Array(m.positions.flat()), idx = new Uint32Array(m.cells.flat());
  const [out] = MeshoptSimplifier.simplify(idx, pos, 3, target*3, 1, ['LockBorder']);
  // drop unused vertices, and turn each pane to face out (checked against the shape's own gradient)
  const map = new Map(), P = [], I = [];
  const vid = i => { if (!map.has(i)) { map.set(i, P.length/3); P.push(pos[i*3], pos[i*3 + 1], pos[i*3 + 2]); } return map.get(i); };
  for (let t = 0; t < out.length; t += 3) {
    const [a, b, c] = [out[t], out[t + 1], out[t + 2]], A = pos.subarray(a*3, a*3 + 3), B = pos.subarray(b*3, b*3 + 3), C = pos.subarray(c*3, c*3 + 3);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
    const m3 = [(A[0] + B[0] + C[0])/3, (A[1] + B[1] + C[1])/3, (A[2] + B[2] + C[2])/3], e = .004;
    const g = [0, 1, 2].map(k => { const p1 = [...m3], p2 = [...m3]; p1[k] += e; p2[k] -= e; return fn(p1).d - fn(p2).d; });
    const flip = n[0]*g[0] + n[1]*g[1] + n[2]*g[2] < 0;
    I.push(vid(a), vid(flip ? c : b), vid(flip ? b : c));
  }
  // each pane's part: whichever part's surface the pane's centre is nearest (carved parts are the insides of the holes)
  const part = [];
  for (let t = 0; t < I.length; t += 3) {
    const c = [0, 1, 2].map(k => (P[I[t]*3 + k] + P[I[t + 1]*3 + k] + P[I[t + 2]*3 + k])/3), ps = fn(c).parts.map(Math.abs);
    part.push(1 + ps.indexOf(Math.min(...ps)));
  }
  return {P, I, part, full: idx.length/3};
}

// a mesh file for src/visuals/objects/meshes/, positions to the nearest thousandth
const r = a => a.map(v => Math.round(v*1000)/1000);
export const piece = m => `{pos: [${r(m.P)}], tri: [${m.I}], part: [${m.part}]}`;
export function writeMesh(name, text){
  fs.mkdirSync(path.join(ROOT, 'src/visuals/objects/meshes'), {recursive: true});
  fs.writeFileSync(path.join(ROOT, 'src/visuals/objects/meshes', name), text);
  return (text.length/1024).toFixed(1) + ' KB';
}
