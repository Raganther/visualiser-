// Import a 3D model from Blender (a .glb, glTF binary) as a mesh object's mesh: src/visuals/objects/meshes/<name>.js.
// Usage: node tools/import-glb.mjs model.glb name [--panes 1500] [--size .6] [--morph Flap]
// - Each material becomes a part, numbered by the digits its name starts with ("3_belly" is part 3), otherwise in order.
//   Parts take the palette's colours in turn; parts 7 and up are dark holes (7 glows on the downbeat, like eyes).
// - One shape key (a glTF morph target: --morph names it, or the first) comes along as the mesh's morph: each vertex's
//   move to that pose, which the object plays by a weight (-1..1).
// - Every node's transform is applied; glTF's axes (Y up, the model facing +Z) are the visualiser's, so a model facing
//   Blender's front view faces the camera. It's centred and scaled to fit a sphere of --size (the skull's is about .6).
// - With --panes, each part is simplified (meshoptimizer, its edges kept) until the whole is about that many panes: the
//   wire-and-glass look wants low-poly, and simple mode draws every pane.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [file, name] = args;
if (!file || !name || name.startsWith('--')) { console.log('usage: node tools/import-glb.mjs model.glb name [--panes 1500] [--size .6] [--morph Flap]'); process.exit(1); }

// ---- read the glb: a JSON chunk and a binary chunk ----
const buf = fs.readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a .glb (binary glTF) file');
let off = 12, json = null, bin = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), data = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8')); else if (type === 0x004e4942) bin = data;
  off += 8 + len;
}
const G = json;
const COMP = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const SIZE = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
function accessor(i){
  const a = G.accessors[i], T = COMP[a.componentType], n = SIZE[a.type], out = new Float64Array(a.count*n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const RD = {5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32'};
  const read = (view, byteOff, T, ct, count, n, into) => {   // count elements of n components from a buffer view
    const v = G.bufferViews[view], stride = v.byteStride || T.BYTES_PER_ELEMENT*n, base = (v.byteOffset || 0) + (byteOff || 0);
    for (let k = 0; k < count; k++) for (let c = 0; c < n; c++) into(k, c, dv[RD[ct]](base + k*stride + c*T.BYTES_PER_ELEMENT, true));
  };
  if (a.bufferView !== undefined) read(a.bufferView, a.byteOffset, T, a.componentType, a.count, n, (k, c, v) => { out[k*n + c] = v; });
  if (a.sparse) {   // (a shape key is often stored sparse: only the vertices that move)
    const S = a.sparse, at = new Array(S.count);
    read(S.indices.bufferView, S.indices.byteOffset, COMP[S.indices.componentType], S.indices.componentType, S.count, 1, (k, c, v) => { at[k] = v; });
    read(S.values.bufferView, S.values.byteOffset, T, a.componentType, S.count, n, (k, c, v) => { out[at[k]*n + c] = v; });
  }
  return out;
}
// ---- node transforms (matrix, or translation / rotation / scale), composed down the tree ----
const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c*4 + r] += a[k*4 + r]*b[c*4 + k]; return o; };
function local(nd){
  if (nd.matrix) return nd.matrix;
  const [x, y, z, w] = nd.rotation || [0, 0, 0, 1], [sx, sy, sz] = nd.scale || [1, 1, 1], [tx, ty, tz] = nd.translation || [0, 0, 0];
  return [(1 - 2*(y*y + z*z))*sx, 2*(x*y + z*w)*sx, 2*(x*z - y*w)*sx, 0, 2*(x*y - z*w)*sy, (1 - 2*(x*x + z*z))*sy, 2*(y*z + x*w)*sy, 0,
    2*(x*z + y*w)*sz, 2*(y*z - x*w)*sz, (1 - 2*(x*x + y*y))*sz, 0, tx, ty, tz, 1];
}
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const place = (m, x, y, z, w = 1) => [m[0]*x + m[4]*y + m[8]*z + m[12]*w, m[1]*x + m[5]*y + m[9]*z + m[13]*w, m[2]*x + m[6]*y + m[10]*z + m[14]*w];

// ---- gather every primitive's triangles, by part ----
await MeshoptSimplifier.ready;
const want = opt('morph'), prims = [];
const matPart = (mi, k) => { const nm = mi !== undefined ? (G.materials[mi].name || '') : ''; const d = nm.match(/^\d+/); return d ? +d[0] : k + 1; };
(function walk(list, parent){
  for (const ni of list || []) {
    const nd = G.nodes[ni], m = mul(parent, local(nd));
    if (nd.mesh !== undefined) {
      const mesh = G.meshes[nd.mesh], names = (mesh.extras && mesh.extras.targetNames) || [];
      const ti = want ? Math.max(0, names.indexOf(want)) : 0;
      mesh.primitives.forEach((p, k) => {
        if ((p.mode ?? 4) !== 4) return;   // triangles only
        const P = accessor(p.attributes.POSITION), n = P.length/3;
        const idx = p.indices !== undefined ? Array.from(accessor(p.indices)) : Array.from({length: n}, (_, i) => i);
        const D = p.targets && p.targets[ti] && p.targets[ti].POSITION !== undefined ? accessor(p.targets[ti].POSITION) : null;
        const pos = [], dlt = [];
        for (let i = 0; i < n; i++) {
          pos.push(...place(m, P[i*3], P[i*3 + 1], P[i*3 + 2]));
          dlt.push(...(D ? place(m, D[i*3], D[i*3 + 1], D[i*3 + 2], 0) : [0, 0, 0]));
        }
        prims.push({part: matPart(p.material, prims.length), pos, dlt, idx, morph: !!D});
      });
    }
    walk(nd.children, m);
  }
})(G.scenes[G.scene || 0].nodes, I4);
if (!prims.length) throw new Error('no triangle meshes in ' + file);

// ---- simplify each part towards the pane budget, keeping its edges where it meets the others ----
const total = prims.reduce((s, p) => s + p.idx.length/3, 0), budget = +opt('panes', 0);
if (budget && total > budget) for (const p of prims) {
  const target = Math.max(3, Math.floor(p.idx.length*budget/total/3)*3);
  const [out] = MeshoptSimplifier.simplify(new Uint32Array(p.idx), new Float32Array(p.pos), 3, target, .05, ['LockBorder']);
  p.idx = Array.from(out);
}
// ---- weld the corners the exporter split (same place, same move), centre and scale ----
const pos = [], dlt = [], tri = [], part = [], seen = new Map();
for (const p of prims) {
  const vid = i => { const k = [0, 1, 2].map(c => Math.round(p.pos[i*3 + c]*1e4)).join() + '|' + [0, 1, 2].map(c => Math.round(p.dlt[i*3 + c]*1e4)).join();
    if (!seen.has(k)) { seen.set(k, pos.length/3); pos.push(p.pos[i*3], p.pos[i*3 + 1], p.pos[i*3 + 2]); dlt.push(p.dlt[i*3], p.dlt[i*3 + 1], p.dlt[i*3 + 2]); }
    return seen.get(k); };
  for (let t = 0; t < p.idx.length; t += 3) {
    const a = vid(p.idx[t]), b = vid(p.idx[t + 1]), c = vid(p.idx[t + 2]);
    if (a === b || b === c || a === c) continue;
    tri.push(a, b, c); part.push(p.part);
  }
}
const lo = [0, 1, 2].map(c => Math.min(...pos.filter((_, i) => i % 3 === c))), hi = [0, 1, 2].map(c => Math.max(...pos.filter((_, i) => i % 3 === c)));
const mid = lo.map((v, c) => (v + hi[c])/2);
let rad = 0; for (let i = 0; i < pos.length; i += 3) rad = Math.max(rad, Math.hypot(pos[i] - mid[0], pos[i + 1] - mid[1], pos[i + 2] - mid[2]));
const sc = +opt('size', .6)/rad;
const r3 = v => Math.round(v*1000)/1000;
const P = pos.map((v, i) => r3((v - mid[i % 3])*sc)), M = dlt.map(v => r3(v*sc));
const hasMorph = prims.some(p => p.morph);
const text = `// ${name}'s mesh, imported from ${path.basename(file)} by tools/import-glb.mjs (don't edit by hand: change the model and import it again).
// Positions (x right, y up, z towards the viewer), triangles (the panes), each pane's part${hasMorph ? ", and the morph: each vertex's move to the shape key's pose" : ''}.
export default {pos: [${P}], tri: [${tri}], part: [${part}]${hasMorph ? `, morph: [${M}]` : ''}};
`;
const out = path.join(ROOT, 'src/visuals/objects/meshes', name + '.js');
fs.writeFileSync(out, text);
const parts = {}; part.forEach(p => parts[p] = (parts[p] || 0) + 1);
console.log(`${name}: ${tri.length/3} panes (of ${total}), ${pos.length/3} vertices, parts ${JSON.stringify(parts)}${hasMorph ? ', with a morph' : ''} -> ${path.relative(ROOT, out)} (${(text.length/1024).toFixed(1)} KB)`);
