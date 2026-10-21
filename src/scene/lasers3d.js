// The lasers in 3D (docs/space-plan.md, stage 5, first form): beams in the centrepiece's space (scene/space.js), from
// emitters round it, traced against it (a sphere as big as it is) and, by the genome's material, stopping where they strike
// (stone, neon: a flare there), bending through it and leaving split into a rainbow (glass), or glancing off it (metal). Where
// a beam strikes it is a light, so the object lights there. On screen each piece is a segment: behind the object it's
// hidden where the object covers it, in front it's drawn over it (render/front.js draws them all after the objects). The
// show comes from the conductor when it leads (scene/conductor.js: COND.las), else from the genome's motif and the beat:
// a ring of emitters round it (a rose), a fan from below (a pointed arch), two banks crossing (a hexagon), or a star
// bursting out of it (a star).
import { TUNE } from '../tuning.js';
import { SPACE, CAM, spaceProj, spaceScale, spaceLight, spaceFront } from './space.js';

const MAXB = 48;
export const BEAMS = {n: 0, seg: Array.from({length: MAXB}, () => new Float32Array(9))};   // on screen: x0 y0 x1 y1, width, r g b, alpha
const add3 = (a, b, k = 1) => [a[0] + b[0]*k, a[1] + b[1]*k, a[2] + b[2]*k];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const refract = (d, n, eta) => { const c = -dot(d, n), k = 1 - eta*eta*(1 - c*c); return k < 0 ? null : norm(add3(d.map(v => v*eta), n, eta*c - Math.sqrt(k))); };
const reflect = (d, n) => add3(d, n, -2*dot(d, n));
// where a ray meets the sphere of radius r round the middle: [in, out] along it, or null
function hit(o, d, r){ const b = dot(o, d), c = dot(o, o) - r*r, h = b*b - c; if (h < 0) return null; const s = Math.sqrt(h); return -b - s > 1e-4 ? [-b - s, -b + s] : null; }

// a 3D piece onto the screen: clipped before the camera; behind the object, the part it covers left out
function piece(a, b, rgb, k, w){
  const zc = CAM - .35; if (a[2] > zc && b[2] > zc) return;
  if (a[2] > zc) a = add3(b, add3(a, b, -1), (zc - b[2])/(a[2] - b[2])); else if (b[2] > zc) b = add3(a, add3(b, a, -1), (zc - a[2])/(b[2] - a[2]));
  const A = spaceProj(a), B = spaceProj(b), ka = Math.min(1, k);
  if (a[2] >= 0 && b[2] >= 0) return seg(A, B, rgb, ka, w);
  // behind (wholly or partly): cut out where the object's circle on screen covers it, behind its middle
  const R = SPACE.rad*spaceScale()*.95, cx = SPACE.pos[0], cy = SPACE.pos[1], dx = B[0] - A[0], dy = B[1] - A[1], fx = A[0] - cx, fy = A[1] - cy;
  const qa = dx*dx + dy*dy, qb = 2*(fx*dx + fy*dy), qc = fx*fx + fy*fy - R*R, D = qb*qb - 4*qa*qc;
  if (D <= 0 || qa < 1e-9) return seg(A, B, rgb, ka, w);
  const s1 = Math.max(0, (-qb - Math.sqrt(D))/(2*qa)), s2 = Math.min(1, (-qb + Math.sqrt(D))/(2*qa));
  // (only the part behind the middle is hidden: the depth along the piece where it crosses)
  const z1 = a[2] + (b[2] - a[2])*s1, z2 = a[2] + (b[2] - a[2])*s2;
  if (s1 >= s2 || (z1 > 0 && z2 > 0)) return seg(A, B, rgb, ka, w);
  if (s1 > 0) seg(A, [A[0] + dx*s1, A[1] + dy*s1, 1], rgb, ka, w);
  if (s2 < 1) seg([A[0] + dx*s2, A[1] + dy*s2, 1], B, rgb, ka, w);
}
function seg(A, B, rgb, a, w){ if (BEAMS.n >= MAXB || a < .01) return; BEAMS.seg[BEAMS.n++].set([A[0], A[1], B[0], B[1], w, rgb[0], rgb[1], rgb[2], a]); }

// each frame from the lasers layer while there's a subject: show (0 ring, 1 fan, 2 crossing, 3 star), n beams, phase (their
// turn), sweep (how far they swing across it), bright, mat (the genome's material: 0 stone, 1 glass, 2 neon, 3 metal),
// t (motion time), cols (each beam's colour), w (the layer's weight)
export function lasers3d(o){
  BEAMS.n = 0; if (!(SPACE.on > .02) || o.w < .01) return;
  const T = TUNE.lasers3d, r = SPACE.rad*.95, R = SPACE.rad*T.reach, L = SPACE.rad*T.len, n = Math.max(1, Math.min(12, o.n | 0)), wid = T.width*(1 - .4*(o.narrow || 0));
  for (let i = 0; i < n; i++) {
    const a = o.phase + i*Math.PI*2/n, sw = o.sweep*Math.sin(o.t*T.sweepRate + i*2.1), rgb = o.cols[i % o.cols.length], k = o.bright*o.w;
    let src, aim;
    if (o.show === 3) {   // a star: from inside it outwards, in the plane facing us, leaving through its surface
      const d = [Math.cos(a + sw*.3), Math.sin(a + sw*.3), .35];
      src = [0, 0, 0]; aim = norm(d);
      const ex = add3(src, aim, r); trace(ex, aim, rgb, k, wid, o.mat, L, true); continue;
    }
    if (o.show === 1) {   // a fan from below in front, aimed up through it
      const f = n > 1 ? i/(n - 1) - .5 : 0; src = [f*R*1.4, -R*.9, R*.6]; aim = [Math.sin(sw)*r*1.5 + f*r*.8, r*.4, 0];
    } else if (o.show === 2) {   // two banks crossing from left and right
      const side = i % 2 ? 1 : -1, j = Math.floor(i/2), m = Math.ceil(n/2), f = m > 1 ? j/(m - 1) - .5 : 0;
      src = [side*R, f*R*.8, R*.3*Math.cos(a)]; aim = [0, -f*r*1.2 + Math.sin(sw)*r, 0];
    } else {   // a ring of emitters round it, in a tilted plane, aimed in across it
      const tl = T.tilt; src = [Math.cos(a)*R, Math.sin(a)*R*Math.cos(tl), Math.sin(a)*R*Math.sin(tl)]; aim = [-Math.sin(a)*sw*r*2, Math.cos(a)*sw*r*2, 0];
    }
    trace(src, norm(add3(aim, src, -1)), rgb, k, wid, o.mat, L, false);
  }
}
// a beam from o along d: to where it strikes the object, then by its material
function trace(o, d, rgb, k, w, mat, L, inside){
  const T = TUNE.lasers3d, r = SPACE.rad*.95;
  const h = inside ? null : hit(o, d, r);
  if (!h) { piece(o, add3(o, d, L), rgb, k, w); return; }
  const p = add3(o, d, h[0]), nrm = norm(p);
  piece(o, p, rgb, k, w);
  // where it strikes: a light there (the object lights), and a flare if that side faces us
  spaceLight(add3(p, nrm, .08*SPACE.rad), rgb, k*T.light); spaceFront(add3(p, nrm, .02), .02, rgb, Math.min(1, k)*T.flare);
  if (mat === 1) {   // glass: into it and out the far side, split into a rainbow
    const din = refract(d, nrm, 1/T.index); if (!din) return;
    const h2 = hit(add3(p, din, -1e-3), din, r), q = h2 ? add3(p, din, h2[1]) : add3(p, din, r);
    const n2 = norm(q).map(v => -v);
    [[1, .2, .2, T.index - .02], [.2, 1, .3, T.index], [.4, .3, 1, T.index + .03]].forEach(([cr, cg, cb, ix]) => {
      const dout = refract(din, n2, ix); if (dout) piece(q, add3(q, dout, L*.7), [cr, cg, cb], k*.55, w*.8); });
  } else if (mat === 3) {   // metal: glancing off
    piece(p, add3(p, reflect(d, nrm), L*.8), rgb, k*.8, w);
  }
  // stone and neon: it stops there (neon brighter where it strikes)
  if (mat === 2) spaceLight(add3(p, nrm, .1*SPACE.rad), rgb, k*T.light*.8);
}
