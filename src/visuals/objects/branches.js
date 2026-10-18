// Growing branches: a tree of light growing towards you for ever (the user asked for "a tree growing out towards you…
// different patterns, all emanating from a pattern that came before", and to move into the image as more unfurls). A trunk,
// and at each node a leader carrying straight on and a ring of branches splaying out, each a smaller copy of the whole.
// The view dives for ever into the point the leader's nodes close in on: each time it has come one level nearer, the
// outermost level has thinned away and a new one has grown in at the tips. Every level is born with its own branches,
// splay, twist and lean from the music of that moment (TUNE.branches): few and gentle when calm, many and wide when
// intense, leaning unevenly for a while after a drop (symmetry breaking and finding itself again). The kick sends light
// out along it level by level, the hats glint at the tips, a drop surges the dive. Ray-marched (render/sdf.js); simple
// mode marches the same tree on the CPU.
import { TUNE } from '../../tuning.js';
import { sdfObject } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';
import { CAM, FOCAL } from '../../render/facet.js';

const LV = 7, ARM = 1.7, T_ARM = ARM.toFixed(2);   // levels drawn (the shader's loop); a ring's arms against the spine's step
const glsl = `
float gL;
vec2 bRot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
float bSeg(vec3 q, float L, float r){ float h = clamp(q.z, 0.0, L); return length(vec3(q.xy, q.z - h)) - r*(1.0 - 0.45*h/max(L, 1e-3)); }
// a ring's arm, with its twigs: a pair halfway out and a fan of three at its end (A: the level; B.w its lean)
float bArm(vec3 q, vec4 A, vec4 B, float r){
  float sec = 6.2831853/A.x, a = atan(q.y, q.x), id = floor(a/sec + 0.5); a -= id*sec;
  q.xy = length(q.xy)*vec2(cos(a), sin(a));
  float sp = A.y*(1.0 + B.w*sin(id*2.4 + 1.0)), c = cos(sp), s = sin(sp), BL = A.w*${T_ARM};
  q.xz = vec2(q.x*c - q.z*s, q.x*s + q.z*c);   // (along the arm: splayed out from the spine, towards you)
  float d = bSeg(q, BL, r*0.75);
  vec3 w = q - vec3(0.0, 0.0, BL*0.5); w.y = abs(w.y); w.yz = vec2(w.y*0.6 - w.z*0.8, w.y*0.8 + w.z*0.6);
  d = min(d, bSeg(w, BL*0.42, r*0.45));
  vec3 e = q - vec3(0.0, 0.0, BL); float s3 = 2.0943951, a3 = atan(e.y, e.x); a3 -= floor(a3/s3 + 0.5)*s3;
  e.xy = length(e.xy)*vec2(cos(a3), sin(a3)); e.xz = vec2(e.x*0.7 - e.z*0.71, e.x*0.71 + e.z*0.7);
  return min(d, bSeg(e, BL*0.3, r*0.35));
}
float map(vec3 p){
  float s = uK.y, zi = 1.0/(1.0 - s), k = uK2.y, su = pow(s, uK.x);
  vec3 t = vec3(p.xy, p.z - uK2.x)*su/k; t.z += zi; t.xy = bRot(t.xy, uK2.z);   // (into the spine's own units, zoomed about where its nodes close in)
  float f = k/su, d = 1e3; gL = 0.0;
  for (int i = 0; i < ${LV}; i++) {
    vec4 A = uD[i], B = uD[16 + i]; float L = A.w; if (L < 0.001) break;
    float fd = i == 0 ? B.y : 1.0;   // (the outermost level thinning away as the next comes in)
    if (fd > 0.01) {
      float sg = bSeg(t, L, B.x*fd)*f; if (sg < d) { d = sg; gL = float(i) + clamp(t.z/L, 0.0, 1.0)*0.5; }
      vec3 q = t - vec3(0.0, 0.0, L); q.xy = bRot(q.xy, A.z);
      float am = bArm(q, A, B, B.x*fd)*f; if (am < d) { d = am; gL = float(i) + 0.5 + min(0.5, length(q)*0.25); }
    }
    t.z -= L; t.xy = bRot(t.xy, A.z); t /= s; f *= s;
  }
  return d;
}
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){
  map(p); float lv = clamp((gL - uK.x)/${LV - 2}.0, 0.0, 1.0);   // (its place in the dive, not its index: no jump as a level is shed)
  vec3 base = mix(mix(uC0, uC1, smoothstep(0.0, 0.6, lv)), uC2, smoothstep(0.5, 1.0, lv))*0.45 + 0.04;
  float wave = exp(-pow((gL - uK.z)*1.6, 2.0))*uK.w;
  vec3 c = lit(n, rd, base, 0.9, 50.0, 0.3) + uC1*wave*1.3 + base*pow(lv, 3.0)*0.35;
  c += vec3(0.8)*step(0.98, h31(floor(p*22.0) + floor(TIME*8.0)))*HAT*smoothstep(0.4, 1.0, lv);
  if (gL < 1.0) c *= uD[16].y;   // (the outermost level dims as it thins away)
  return vec4(c*smoothstep(uBR, uBR*0.7, length(p)), 1.0);   // (fading out before the edge of its sphere, so no hard circle)
}`;
// the same tree in JS, for simple mode's masks and tests (it draws lines: draw2d)
const seg3 = (x, y, z, L, r) => { const h = Math.max(0, Math.min(L, z)); return Math.hypot(x, y, z - h) - r*(1 - .45*h/Math.max(L, 1e-3)); };
const rot2 = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [c*x - s*y, s*x + c*y]; };
function arm2d(x, y, z, D, i, r){
  const n = D[i*4], sec = 2*Math.PI/n; let a = Math.atan2(y, x); const id = Math.floor(a/sec + .5); a -= id*sec; const rr = Math.hypot(x, y); x = rr*Math.cos(a); y = rr*Math.sin(a);
  const sp = D[i*4 + 1]*(1 + D[(16 + i)*4 + 3]*Math.sin(id*2.4 + 1)), BL = D[i*4 + 3]*ARM; [x, z] = [x*Math.cos(sp) - z*Math.sin(sp), x*Math.sin(sp) + z*Math.cos(sp)];
  return seg3(x, y, z, BL, r*.75);
}
function map2d(x, y, z, st){
  const s = st.K[1], zi = 1/(1 - s), k = st.K2[1], su = s**st.K[0], D = st.D;
  let [tx, ty] = rot2(x*su/k, y*su/k, st.K2[2]), tz = (z - st.K2[0])*su/k + zi, f = k/su, d = 1e3; st.gL = 0;
  for (let i = 0; i < LV; i++) {
    const L = D[i*4 + 3]; if (L < .001) break; const fd = i === 0 ? D[(16 + i)*4 + 1] : 1;
    if (fd > .01) { const sg = seg3(tx, ty, tz, L, D[(16 + i)*4]*fd)*f; if (sg < d) { d = sg; st.gL = i; }
      const [qx, qy] = rot2(tx, ty, D[i*4 + 2]), am = arm2d(qx, qy, tz - L, D, i, D[(16 + i)*4]*fd)*f; if (am < d) { d = am; st.gL = i + .5; } }
    tz -= L; [tx, ty] = rot2(tx, ty, D[i*4 + 2]); tx /= s; ty /= s; tz /= s; f *= s;
  }
  return d;
}
const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const ss = (a, b, x) => { const q = Math.max(0, Math.min(1, (x - a)/(b - a))); return q*q*(3 - 2*q); };
const m3 = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i*3 + j] = A[i*3]*B[j] + A[i*3 + 1]*B[3 + j] + A[i*3 + 2]*B[6 + j]; return C; };

// a new level, born from the one before it and the music now: its branches, splay, twist and lean
function born(st, M){
  const T = TUNE.branches, prev = st.lv[st.lv.length - 1], ten = M ? M.ten : .4;
  const want = T.calm + (T.intense - T.calm)*ten, n0 = prev ? prev.n : Math.round(want);
  const n = Math.max(2, Math.min(9, n0 + Math.max(-1, Math.min(1, Math.round(want - n0 + (st.rand() - .5)*1.5)))));
  const sp = T.splay[0] + (T.splay[1] - T.splay[0])*Math.min(1, ten*.7 + (M ? M.bass : 0)*.5) + (st.rand() - .5)*.12;
  return {n, sp, tw: (st.rand() - .5)*2*T.twist + (st.lean > .05 ? (st.rand() - .5)*.6*st.lean : 0), asym: st.lean*T.lean*(.5 + st.rand()*.5)};
}
export default sdfObject({key: 'branches', label: 'Growing branches', words: 'A tree of light grows towards you for ever, each branch born from the one before',
  stats: 'a ray-marched branching tree, six levels, diving for ever', glsl, steps: 100, stepK: .7,
  dance: {moves: {still: 1, spin: 1, pulse: .7, breathe: .6}, sym: 5},
  onBeat(st, pos){ if (pos === 0) st.barN = (st.barN || 0) + 1; },
  // pointing at you: it turns about the view (its dance's turn a roll), tipping only a little
  orient(st, d){ return m3(m3(rx(.08*Math.sin(st.t*.21) + (d ? d.pitch*.3 : 0)), ry(.1*Math.sin(st.t*.17))), rz(st.yaw + (d ? d.yaw : 0))); },
  step(st, M, dt){
    const T = TUNE.branches, K = st.K, K2 = st.K2;
    if (!st.lv) { st.lean = 0; st.lv = []; for (let i = 0; i < LV; i++) st.lv.push(born(st, null)); st.u = 0; st.acc = 0; st.wave = 9; }
    if (M.drop) { st.lean = 1; st.u += T.dropSurge; }   // a drop: a surge in, and its symmetry broken for a while
    st.lean *= Math.exp(-dt/(T.leanBars*4*M.bp));
    st.u += dt*T.speed*(.35 + .9*M.ten + .6*M.anticip)*(M.brk ? .5 : 1)*(M.steady ? 1 : .6);
    while (st.u >= 1) { st.u -= 1; st.acc += st.lv[0].tw; st.lv.shift(); st.lv.push(born(st, M)); st.wave -= 1; }   // one level nearer: the outermost gone, a new one at the tips
    if (M.newKick) st.wave = 0; st.wave += dt/Math.max(.25, M.bp*.35);   // the kick's light running out along it, a level a sixteenth or so
    for (let i = 0; i < LV; i++) { const l = st.lv[i];
      st.D.set([l.n, l.sp, l.tw, i === LV - 1 ? Math.max(.001, st.u) : 1], i*4);   // (the newest level growing in)
      st.D.set([T.radius*(1 + .25*M.bass), i === 0 ? 1 - ss(.1, .8, st.u) : 1, 0, l.asym], (16 + i)*4); }   // (the outermost level gone well before the dive passes it)
    K[0] = st.u; K[1] = T.ratio; K[2] = st.wave; K[3] = Math.max(0, 1 - st.wave/(LV + 1))*(.4 + .6*M.kick);
    K2[0] = T.focus; K2[1] = (T.focus + T.base)*(1 - T.ratio); K2[2] = st.acc;
    st.br = T.reach;
  },
  // simple mode: the same tree as lines of light (marched at a few dozen rays across, its branches were too thin to see),
  // each level's branches built from the one before as the shader folds them, projected through the same camera
  draw2d(c, U, st){
    if (!st.lv) return;
    const W = c.canvas.width, H = c.canvas.height, sc = H*U.size*FOCAL, ox = W/2 + U.pos[0]*H, oy = H/2 - U.pos[1]*H, R = U.R, D = st.D;
    const s = st.K[1], zi = 1/(1 - s), k = st.K2[1], su = s**st.K[0], f0 = k/su, a0 = -st.K2[2], br = st.br;
    // the spine's units → the object's frame (the map's step in reverse), then the view, then the screen
    const toScr = (x, y, z) => { const ca = Math.cos(a0), sa = Math.sin(a0), X = (ca*x - sa*y)*f0, Y = (sa*x + ca*y)*f0, Z = (z - zi)*f0 + st.K2[0];
      if (Math.hypot(X, Y, Z) > br) return null; const vx = R[0]*X + R[1]*Y + R[2]*Z, vy = R[3]*X + R[4]*Y + R[5]*Z, vz = R[6]*X + R[7]*Y + R[8]*Z, w = sc/Math.max(.1, CAM - vz);
      return [ox + vx*w, oy - vy*w, w]; };
    const paths = Array.from({length: LV}, () => []), lw = new Array(LV).fill(0);
    const add = (i, P0, P1, r) => { const A = toScr(...P0), B = toScr(...P1); if (!A || !B || Math.hypot(B[0] - A[0], B[1] - A[1]) < .6) return;
      paths[i].push(A[0], A[1], B[0], B[1]); lw[i] = Math.max(lw[i], r*A[2]*f0); };
    const turn = (v, a) => [v[0]*Math.cos(a) - v[1]*Math.sin(a), v[0]*Math.sin(a) + v[1]*Math.cos(a), v[2]];   // (about the spine)
    const along = (o, d, l) => [o[0] + d[0]*l, o[1] + d[1]*l, o[2] + d[2]*l];
    let o = [0, 0, 0], sc0 = 1, ang = 0;   // each node: where it is, its scale, its turn (in the first level's frame)
    for (let i = 0; i < LV; i++) {
      const L = D[i*4 + 3]; if (L < .001) break; const r = D[(16 + i)*4]*sc0*(i === 0 ? D[16*4 + 1] : 1);
      const node = [0, 0, o[2] + L*sc0]; add(i, o, node, r);
      ang -= D[i*4 + 2];   // (the shader turns the point by the twist: the arms turn the other way)
      const n = Math.round(D[i*4]), sec = 2*Math.PI/n, BL = L*ARM*sc0;
      for (let j = 0; j < n; j++) { const id = j > n/2 ? j - n : j, sp = D[i*4 + 1]*(1 + D[(16 + i)*4 + 3]*Math.sin(id*2.4 + 1)), az = ang + id*sec;
        const dir = turn([Math.sin(sp), 0, Math.cos(sp)], az), side = turn([0, 1, 0], az), tip = along(node, dir, BL), mid = along(node, dir, BL*.5);
        add(i, node, tip, r*.75);
        for (const sg of [1, -1]) add(i, mid, along(mid, [dir[0]*.6 + side[0]*.8*sg, dir[1]*.6 + side[1]*.8*sg, dir[2]*.6], BL*.42), r*.45);   // (the twigs: a pair halfway out)
        const bx = [Math.cos(sp), 0, -Math.sin(sp)], bxt = turn(bx, az);   // (and a fan of three at its end)
        for (let m = 0; m < 3; m++) { const a3 = m*2*Math.PI/3, ox3 = Math.cos(a3), oy3 = Math.sin(a3), sd = [bxt[0]*ox3 + side[0]*oy3, bxt[1]*ox3 + side[1]*oy3, bxt[2]*ox3 + side[2]*oy3];
          add(i, tip, along(tip, [dir[0]*.7 + sd[0]*.71, dir[1]*.7 + sd[1]*.71, dir[2]*.7 + sd[2]*.71], BL*.3), r*.35); }
      }
      o = node; sc0 *= s;
    }
    const ss2 = (a, b, x) => { const q = Math.max(0, Math.min(1, (x - a)/(b - a))); return q*q*(3 - 2*q); };
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 0; i < LV; i++) { const p = paths[i]; if (!p.length) continue; const lv = Math.max(0, Math.min(1, (i + .5 - st.K[0])/(LV - 2))), m1 = ss2(0, .6, lv), m2 = ss2(.5, 1, lv);
      const col = U.C0.map((v, m) => (v + (U.C1[m] - v)*m1)*(1 - m2) + U.C2[m]*m2), fd = i === 0 ? D[16*4 + 1] : 1;   // (its colour by its place in the dive, as in the shader)
      const wave = Math.exp(-(((i + .5 - st.K[2])*1.6)**2))*st.K[3], g = U.w*(.55 + .45*lv + wave)*fd;
      c.strokeStyle = `rgba(${col.map(v => Math.min(255, v*255*g)|0).join(',')},1)`; c.lineWidth = Math.max(.7, Math.min(7, lw[i]*.9));
      c.beginPath(); for (let q = 0; q < p.length; q += 4) { c.moveTo(p[q], p[q + 1]); c.lineTo(p[q + 2], p[q + 3]); } c.stroke(); }
    c.restore();
  },
  map2d, rad: () => TUNE.branches.reach*.8,
  tint2d(p, n, rd, t, st, U){
    map2d(p[0], p[1], p[2], st); const lv = Math.max(0, Math.min(1, (st.gL - st.K[0])/(LV - 2))), c3 = (a, b, m) => a.map((v, i) => v + (b[i] - v)*m), ss = (a, b, x) => { const q = Math.max(0, Math.min(1, (x - a)/(b - a))); return q*q*(3 - 2*q); };
    const base = c3(c3(U.C0, U.C1, ss(0, .6, lv)), U.C2, ss(.5, 1, lv)).map(v => v*.45 + .04), wave = Math.exp(-(((st.gL - st.K[2])*1.6)**2))*st.K[3];
    const c = lit2d(n, rd, base, .9, 50, .3, U), e = ss(st.br, st.br*.7, Math.hypot(p[0], p[1], p[2]));
    return [0, 1, 2].map(i => (c[i] + U.C1[i]*wave*1.3 + base[i]*lv**3*.35)*e).concat(1);
  },
});
