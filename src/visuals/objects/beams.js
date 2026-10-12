// 3D lasers (docs/prism-plan.md, stage 9): rays traced each frame against the Prism's facets, in the facet engine's view
// space. A ray meeting the glass bounces off at the true angle and enters it, bending (Snell's law); inside, it meets the
// far side and leaves, split into a rainbow as a real prism splits light (red bends least, violet most), or, past the
// critical angle, is reflected back in and trapped, drawing a web through the gem. An open sheet is a mirror. A leaf module.
const R3 = new Float32Array(3);
// the nearest facet a ray meets past t0 (Möller and Trumbore's test), or -1
function hit(V, TRI, nf, ox, oy, oz, dx, dy, dz, skip, out){
  let best = 1e9, bf = -1;
  for (let f = 0; f < nf; f++) { if (f === skip) continue;
    const a = TRI[f*3]*3, b = TRI[f*3 + 1]*3, c = TRI[f*3 + 2]*3;
    const e1x = V[b] - V[a], e1y = V[b + 1] - V[a + 1], e1z = V[b + 2] - V[a + 2], e2x = V[c] - V[a], e2y = V[c + 1] - V[a + 1], e2z = V[c + 2] - V[a + 2];
    const px = dy*e2z - dz*e2y, py = dz*e2x - dx*e2z, pz = dx*e2y - dy*e2x, det = e1x*px + e1y*py + e1z*pz; if (Math.abs(det) < 1e-9) continue;
    const inv = 1/det, tx = ox - V[a], ty = oy - V[a + 1], tz = oz - V[a + 2], u = (tx*px + ty*py + tz*pz)*inv; if (u < 0 || u > 1) continue;
    const qx = ty*e1z - tz*e1y, qy = tz*e1x - tx*e1z, qz = tx*e1y - ty*e1x, v = (dx*qx + dy*qy + dz*qz)*inv; if (v < 0 || u + v > 1) continue;
    const t = (e2x*qx + e2y*qy + e2z*qz)*inv; if (t > 1e-4 && t < best) { best = t; bf = f; }
  }
  out[0] = best; return bf;
}
// refraction from index ratio eta (incoming/outgoing), n facing the ray; null past the critical angle
function refract(dx, dy, dz, nx, ny, nz, eta){ const c = -(dx*nx + dy*ny + dz*nz), k = 1 - eta*eta*(1 - c*c); if (k < 0) return null;
  const s = eta*c - Math.sqrt(k); return [eta*dx + s*nx, eta*dy + s*ny, eta*dz + s*nz]; }
const SPECTRUM = [[1.47, [1, .12, .08]], [1.5, [.25, 1, .2]], [1.53, [.45, .3, 1]]];   // red, green, violet: each bent by its own index
// emit: [{p: [x, y, z], d: [x, y, z], c: [r, g, b]}]; o: {closed, rmax, walls, n (index), maxSegs, maxDepth}
// out: segs (x0 y0 z0 x1 y1 z1 r g b inside), flares (x y z bright), the facets lit (and how brightly)
export function traceBeams(V, TRI, FN, nf, emit, o, out){
  out.n = 0; out.nFl = 0; out.nL = 0; out.lit.clear();
  const seg = (a, b, c, inside) => { if (out.n >= o.maxSegs) return; out.segs.set([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], inside ? 1 : 0], out.n*10); out.n++; };
  const toWalls = (p, d) => { const bb = p[0]*d[0] + p[1]*d[1] + p[2]*d[2], cc = p[0]*p[0] + p[1]*p[1] + p[2]*p[2] - o.walls*o.walls; return -bb + Math.sqrt(Math.max(0, bb*bb - cc)); };
  let split = 0;
  const go = (p, d, c, depth, inside, skip) => {
    if (out.n >= o.maxSegs || Math.max(c[0], c[1], c[2]) < .03) return;
    // the bounding sphere first: a ray passing wide of it meets no facet
    const bb = p[0]*d[0] + p[1]*d[1] + p[2]*d[2], cc = p[0]*p[0] + p[1]*p[1] + p[2]*p[2] - o.rmax*o.rmax, f = inside || bb*bb - cc > 0 && -bb + Math.sqrt(Math.max(0, bb*bb - cc)) > 0 ? hit(V, TRI, nf, p[0], p[1], p[2], d[0], d[1], d[2], skip, R3) : -1;
    if (f < 0) { let t = toWalls(p, d); const F = o.floor;   // out into the room: to the walls, or the floor first
      if (F) { const dn = F[0]*d[0] + F[1]*d[1] + F[2]*d[2]; if (dn < -1e-4) { const tf = (-F[3] - (F[0]*p[0] + F[1]*p[1] + F[2]*p[2]))/dn; if (tf > 0 && tf < t) t = tf; } }
      const q = [p[0] + d[0]*t, p[1] + d[1]*t, p[2] + d[2]*t]; seg(p, q, c, inside);
      if (depth > 0 && out.nL < 16) { out.land.set([q[0], q[1], q[2], c[0], c[1], c[2]], out.nL*6); out.nL++; }   // where light that's been through the glass lands: a caustic
      return; }
    const t = R3[0], q = [p[0] + d[0]*t, p[1] + d[1]*t, p[2] + d[2]*t];
    seg(p, q, c, inside);
    const br = Math.max(c[0], c[1], c[2]); if (out.nFl < 32) { out.flares.set([q[0], q[1], q[2], br], out.nFl*4); out.nFl++; }
    out.lit.set(f, Math.max(out.lit.get(f) || 0, br));
    if (depth >= o.maxDepth) return;
    // the facet's normal, turned to face the ray
    let nx = FN[f*3], ny = FN[f*3 + 1], nz = FN[f*3 + 2]; const dn = d[0]*nx + d[1]*ny + d[2]*nz; if (dn > 0) { nx = -nx; ny = -ny; nz = -nz; }
    const cos = Math.abs(dn), rd = [d[0] + 2*cos*nx, d[1] + 2*cos*ny, d[2] + 2*cos*nz];
    if (!o.closed) { go(q, rd, c.map(v => v*.7), depth + 1, false, f); return; }   // an open sheet: a mirror
    if (!inside) {   // meeting the glass: a little bounces off, the rest goes in, bending
      go(q, rd, c.map(v => v*.3), depth + 1, false, f);
      const r = refract(d[0], d[1], d[2], nx, ny, nz, 1/o.n); if (r) go(q, r, c.map(v => v*.85), depth + 1, true, f);
    } else {   // leaving it: out into the room split into a rainbow, or past the critical angle trapped inside
      const r = refract(d[0], d[1], d[2], nx, ny, nz, o.n);
      if (!r) { go(q, rd, c.map(v => v*.9), depth + 1, true, f); return; }
      if (split++ < o.splits) for (const [k, col] of SPECTRUM) { const s = refract(d[0], d[1], d[2], nx, ny, nz, k); if (s) go(q, s, [c[0]*col[0], c[1]*col[1], c[2]*col[2]].map(v => v*1.2), depth + 1, false, f); }
      else go(q, r, c.map(v => v*.8), depth + 1, false, f);
    }
  };
  for (const e of emit) go(e.p, e.d, e.c, 0, !!e.inside, -1);
  return out;
}
export const beamOut = (maxSegs = 96) => ({segs: new Float32Array(maxSegs*10), flares: new Float32Array(32*4), land: new Float32Array(16*6), lit: new Map(), n: 0, nFl: 0, nL: 0});
