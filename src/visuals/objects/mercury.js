// Liquid metal: a bead of mercury, chrome, the studio reflected in it in the palette's colours. Each kick pulls a droplet
// out of it that snaps back, the bass wobbles it, and a drop splashes it into beads that run back together.
import { TUNE } from '../../tuning.js';
import { sdfObject, setBead, beads, fib } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';

const SPL = fib(8);
const glsl = `
float map(vec3 p){
  return beads(p, uK.x, 0, 12) + uK.y*sin(p.x*6.0 + TIME*2.3)*sin(p.y*5.0 - TIME*1.9)*sin(p.z*5.5 + TIME*1.6);
}
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){
  vec3 c = lit(n, rd, vec3(0.05), 2.2, 160.0, 1.3)*mix(vec3(1.0), uC0*0.6 + 0.5, 0.3);
  return vec4(c, 1.0);
}`;
const map2d = (x, y, z, st) => beads(st, x, y, z, st.K[0], 0, 12) + st.K[1]*Math.sin(x*6 + st.t*2.3)*Math.sin(y*5 - st.t*1.9)*Math.sin(z*5.5 + st.t*1.6);
export default sdfObject({key: 'mercury', label: 'Liquid metal', words: 'A bead of mercury pulls out a droplet on each kick and splashes apart on the drop',
  stats: 'a ray-marched chrome liquid: a body, a kick droplet, eight splash beads', glsl, steps: 80,
  dance: {moves: {still: 1, groove: 1.2, pulse: 1.2, float: 1, approach: .8, look: .6}, sym: 1},
  step(st, M, dt){
    const T = TUNE.mercury;
    if (!st.dir) { st.dir = [0, 1, 0]; st.dx = 0; st.dv = 0; st.spl = SPL; }
    if (M.newKick) { st.dv += T.pull*(M.steady ? 1 : .4); const a = st.rand()*6.283, y = st.rand()*1.4 - .7, r = Math.sqrt(1 - y*y); st.dir = [Math.cos(a)*r, y, Math.sin(a)*r]; }
    st.dv += (-90*st.dx - 9*st.dv)*dt; st.dx += st.dv*dt;
    const ex = M.ex, body = .5*(1 - .45*ex), dd = .25 + .6*Math.max(0, st.dx);
    setBead(st, 0, 0, 0, 0, body);
    setBead(st, 1, st.dir[0]*dd, st.dir[1]*dd, st.dir[2]*dd, .14);
    for (let i = 0; i < 8; i++) { const d = st.spl[i], r = .25 + T.splash*ex*(.8 + .3*((i*.37) % 1));
      setBead(st, 2 + i, d[0]*r, d[1]*r - .3*ex*ex, d[2]*r, ex > .02 ? .07 + .04*((i*.61) % 1) : 0); }
    st.K[0] = .22 - .16*ex; st.K[1] = .012 + .045*M.bass + .02*M.kick;
    st.br = Math.max(.75, dd + .2, .45 + T.splash*ex*1.15);
  },
  burst(st){ st.spl = SPL.map(d => { const j = [d[0] + (st.rand() - .5)*.6, d[1] + (st.rand() - .5)*.6, d[2] + (st.rand() - .5)*.6], l = Math.hypot(...j); return j.map(v => v/l); }); },
  map2d, rad: () => .6,
  tint2d(p, n, rd, t, st, U){ const c = lit2d(n, rd, [.05, .05, .05], 2.2, 160, 1.3, U); return [c[0]*(.7 + .3*(U.C0[0]*.6 + .5)), c[1]*(.7 + .3*(U.C0[1]*.6 + .5)), c[2]*(.7 + .3*(U.C0[2]*.6 + .5)), 1]; },
});
