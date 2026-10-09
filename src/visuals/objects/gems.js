// The gem orbit: five small faceted gems circling the centre on a tilted ring, each played by one part of the music (the
// user asked for different aspects of the music to change the facets in different ways; here each part has its own gem):
// - the kick's gem swells on each kick, a ring of light running round it;
// - the stabs' gem turns a notch on each stab, its checker of facets flipping;
// - the hats' gem lights a new random handful of facets each 16th;
// - the bass's gem breathes with the bass, its facets pushing out;
// - the melody's gem turns a spiral of light, and changes shape when the notes change.
// They join one at a time as a section runs (every 2 bars), a breakdown dims all but the bass's and the melody's, and a
// drop pulls them into the middle and flings them out wide, shattered, before they settle back. Each gem is the prism's
// geometry (render/facet.js) at up to 320 facets, its detail and shape its own. Tuning in TUNE.gems.
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { hsv2rgb } from '../../util.js';
import { DANCE } from '../../scene/dance.js';
import { SIG } from '../../scene/signals.js';
import { L } from '../../audio/listen.js';
import { facetGeo, facetPlace, facetGL, facet2d, facetPath2d } from '../../render/facet.js';
import { SHAPES } from './prism.js';

const G = facetGeo(2), NG = 5, nv = G.nv, nf = G.nf;
const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x*x*(3 - 2*x);
const VOICE = ['kick', 'stab', 'hat', 'bass', 'melody'];
const START = [['octa', 'cube'], ['cube', 'gem'], ['star', 'ball'], ['ball', 'blob'], ['gem', 'flower']];
const NEXT = [['octa', 'cube', 'star'], ['cube', 'gem', 'octa'], ['star', 'ball', 'octa'], ['ball', 'blob', 'pill'], ['gem', 'flower', 'disc', 'star']];
const gems = Array.from({length: NG}, (_, i) => ({i, sA: START[i][0], sB: START[i][1], mix: 0, mixT: 0, det: [1.2, 1, 2, 1.4, 1.6][i], pop: 0, rot: i, chk: 0, flash: 0, n: 0, ex: 0, exT: 0, on: 0, rip: [],
  R: new Float32Array(nv), D: new Float32Array(nv), X: {fill: new Float32Array(nf*4), edge: new Float32Array(nf*3), eA: new Float32Array(nf*3), off: new Float32Array(nf*3)}, U: null}));
const st = {t: 0, bars: 0, secBars: 0, type: undefined, s16: -1, lastHit: 0, kickT: -9, harmT: -9, drop: null, dropT: -99, orbit: 0, order: [0, 1, 2, 3, 4]};
const tids = new WeakMap(); let tidN = 0; const tid = t => t == null ? 0 : tids.get(t) || (tids.set(t, ++tidN), tidN);
let drawers = null, gen = -1;

export default {
  key: 'gems', kind: 'object', label: 'Gem orbit', words: 'Five gems circle, each played by its own part of the music', optIn: true,
  dance: {moves: {still: 1, spin: 1, float: 1, rise: 1.2, approach: .8, pulse: .8, face: .6}, sym: 5, liftPart: 1},
  get mesh(){ const pos = Array.from(G.DIR, x => x*.45); return this._m || (this._m = {pieces: [{pos, tri: Array.from(G.TRI), part: Array.from({length: nf}, (_, f) => 1 + G.FA[0][f] % 6)}], hinge: [0, 0, 0]}); },
  stats: 'five gems of up to 320 facets, one for each part of the music',
  onBeat(pos){ if (pos === 0) { st.bars++; st.secBars++; } },
  breakApart(){ for (const g of gems) g.exT = 1; st.dropT = st.t; },
  params(P, x){
    const T = TUNE.gems, J = x.J, dt = x.dt, w = P.o.gems || 0, ten = J ? J.tension || 0 : .5, bp = Math.max(.25, S.beatPeriod);
    st.t += dt;
    const ty = J && J.on ? tid(J.type) : -1;
    if (ty !== st.type) { st.type = ty; st.secBars = 0; }
    if (J && st.drop !== null && J.lastDrop !== st.drop && J.on) { st.dropT = st.t; for (const g of gems) g.exT = 1; }
    st.drop = J ? J.lastDrop : null;
    if (w < .003) { for (const g of gems) g.on = 0; return; }
    // what each part of the music does to its gem
    const kick = SIG.kick > .99 && st.t - st.kickT > .12, stab = x.hit > .8 && st.lastHit <= .8;
    if (kick) st.kickT = st.t; st.lastHit = x.hit;
    const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : Math.floor(st.t/(bp/4)) % 16, new16 = s16 !== st.s16; st.s16 = s16;
    const harm = (SIG.harm || 0) > .5 && st.t - st.harmT > 4*bp; if (harm) st.harmT = st.t;
    const k0 = gems[0], k1 = gems[1], k4 = gems[4];
    if (kick) { k0.pop = 1; k0.rip.push({o: [hash(st.t)*2 - 1, hash(st.t + 1)*2 - 1, hash(st.t + 2)*2 - 1], t: st.t}); if (k0.rip.length > 3) k0.rip.shift(); }
    if (stab) { k1.rot += Math.PI*2/5; k1.chk ^= 1; k1.flash = 1; }
    if (harm) flip(k4);
    for (const g of gems) if (st.secBars > 0 && st.secBars % 8 === 0 && st.phr !== st.bars && g.i !== 4) flip(g);   // a new shape every 8 bars
    if (st.secBars % 8 === 0) st.phr = st.bars;
    // the orbit: slow, wider and slower in a breakdown; a drop pulls them in, then flings them out
    const sd = st.t - st.dropT, pull = sd < bp ? smooth(sd/bp) : 0, fling = sd >= bp && sd < 5*bp ? Math.exp(-(sd - bp)*1.2) : 0;
    st.orbit += dt*T.orbit*(.4 + ten)*(L.brk ? .5 : 1)*(1 + fling*4);
    const rad = T.ring*(L.brk ? 1.15 : 1)*(1 - .85*pull + fling*.8), An = P.anchor, d = DANCE.obj.gems;
    const base = {pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, .02 + P.wind.y*TUNE.ctx.windObject], size: (An && An.size || T.size)*(d ? d.s : 1)};
    const tilt = .38 + (d ? d.pitch : 0), spin = d ? d.yaw : 0, zs = [];
    for (const g of gems) {
      // they join one at a time as the section runs
      const want = !J || !J.on || st.secBars >= g.i*T.joinBars ? 1 : 0, dim = L.brk && g.i < 3 ? .35 : 1;
      g.on += (want*dim - g.on)*Math.min(1, dt*2);
      g.exT *= Math.exp(-dt/1.2); g.ex += (g.exT - g.ex)*Math.min(1, dt*(g.exT > g.ex ? 10 : 2.5));
      g.pop *= Math.exp(-dt*6); g.flash *= Math.exp(-dt*3);
      g.mix += (g.mixT - g.mix)*Math.min(1, dt*.8);
      const a = st.orbit + g.i*Math.PI*2/NG + spin, ox = Math.cos(a)*rad, oz0 = Math.sin(a)*rad, oy = -oz0*Math.sin(tilt), oz = oz0*Math.cos(tilt);
      const persp = 3.2/(3.2 - oz*base.size*2.2);
      g.U = {rot: x.t*(.35 + g.i*.07) + g.rot, pitch: .3 + Math.sin(x.t*.3 + g.i)*.25, roll: 0, sq: 0, line: TUNE.mesh.line*.8,
        size: base.size*T.gem*(1 + g.pop*.22 + (g.i === 3 ? (P.bass || 0)*x.react*.18 : 0))*persp,
        pos: [base.pos[0] + ox*base.size*2.2*persp, base.pos[1] + oy*base.size*2.2*persp], w: (An && An.hide ? 0 : Math.min(1, w*1.2))*g.on};
      zs.push(oz);
      shape(g, P, x, new16);
      colour(g, P, x);
    }
    st.order = [0, 1, 2, 3, 4].sort((a, b) => zs[a] - zs[b]);   // far to near
    (P.m = P.m || {}).gems = {gems: gems.map(g => g.U)};
  },
  drawGL(gl, P, W, H, stage){ if (stage === 'trails') return;
    if (!drawers || gen !== S.glGen) { drawers = gems.map(() => facetGL(gl, G)); gen = S.glGen; }
    for (const i of st.order) if (gems[i].U && gems[i].U.w > .01) drawers[i](gems[i].X, gems[i].U, W, H, stage); },
  draw2d(o, P){ for (const i of st.order) if (gems[i].U && gems[i].U.w > .01) facet2d(o, G, gems[i].X, gems[i].U); },
  path2d(o, P){ let add = false; o.beginPath(); for (const g of gems) if (g.U && g.U.w > .01) { facetPath2d(o, G, g.X, g.U, add); add = true; } },
};
function flip(g){ const n = NEXT[g.i][(g.n++) % NEXT[g.i].length]; if (g.mixT > .5) { g.sA = n; g.mixT = 0; } else { g.sB = n; g.mixT = 1; } }
function shape(g, P, x, new16){
  const Dr = G.DIR, m = smooth(g.mix), t = x.t;
  for (let v = 0; v < nv; v++) {
    const dx = Dr[v*3], dy = Dr[v*3 + 1], dz = Dr[v*3 + 2];
    let r = SHAPES[g.sA](dx, dy, dz, t)*(1 - m) + SHAPES[g.sB](dx, dy, dz, t)*m;
    for (const q of g.rip) { const l = Math.hypot(...q.o) || 1, th = Math.acos(Math.max(-1, Math.min(1, (dx*q.o[0] + dy*q.o[1] + dz*q.o[2])/l))), a = st.t - q.t; r *= 1 + .12*Math.exp(-(((th - a*3)/.3)**2))*Math.max(0, 1 - a); }
    g.R[v] = r*.45; g.D[v] = g.det + (g.i === 2 ? Math.min(.8, SIG.hat) : 0);
  }
  facetPlace(G, g.R, g.D, g.X);
  if (new16 && g.i === 2) g.n16 = (g.n16 || 0) + 1;
}
function colour(g, P, x){
  const pal = P.pal || [0, .33, .67], h = (P.hue || 0) + pal[g.i % 3] + g.i*.07, tint = hsv2rgb(h, .65, 1), lc = hsv2rgb(h + .08, .8, 1), white = hsv2rgb(h, .2, 1);
  const U = g.U, cr = Math.cos(U.rot), sr = Math.sin(U.rot), cp = Math.cos(U.pitch), sp = Math.sin(U.pitch), X = g.X, ex = g.ex*g.ex, dim = x.dim;
  const sty = Math.round((x.eff && x.eff.objStyle) || 0) % 6, solid = sty === 1 || sty === 5, holo = sty === 3, outline = sty === 2;
  for (let f = 0; f < nf; f++) {
    const L0 = X.fl[f], gi = G.FA[L0][f], key = L0*100000 + gi, sd = hash(key*.731 + g.i), C = G.CEN[L0], cx = C[gi*3], cy = C[gi*3 + 1], cz = C[gi*3 + 2];
    const nx = X.fn[f*3], ny = X.fn[f*3 + 1], nz = X.fn[f*3 + 2], x1 = cr*nx + sr*nz, z1 = -sr*nx + cr*nz, vy = cp*ny - sp*z1, vz = sp*ny + cp*z1;
    const face = .5 + .5*vz, spec = Math.pow(Math.max(0, (x1*-.25 + vy*.35 + vz*1.5)/1.56), 90)*.6, lam = Math.max(0, x1*-.4 + vy*.6 + vz*.7);
    // its part of the music
    let l = 0;
    if (g.i === 0) { l = g.pop*.6; for (const q of g.rip) { const ll = Math.hypot(...q.o) || 1, th = Math.acos(Math.max(-1, Math.min(1, (cx*q.o[0] + cy*q.o[1] + cz*q.o[2])/ll))), a = st.t - q.t; l = Math.max(l, Math.exp(-(((th - a*3)/.3)**2))*Math.max(0, 1 - a)); } }
    else if (g.i === 1) l = (G.CH[L0][gi] === 3) === !!g.chk ? .25 + .75*g.flash : 0;
    else if (g.i === 2) l = hash(key*1.37 + (g.n16 || 0)*17.1) < Math.min(1, SIG.hat*1.4)*.25 ? 1 : 0;
    else if (g.i === 3) l = Math.min(1, (P.bass || 0)*x.react)*(.3 + .7*hash(key*.3));
    else l = Math.max(0, Math.cos(Math.atan2(cz, cx)*2 + Math.asin(Math.max(-1, Math.min(1, cy)))*4 - x.t*(.6 + (P.mid || 0)*2)))**8*Math.min(1, .3 + (SIG.harm || 0) + (P.mid || 0)*x.react*.6);
    l *= dim;
    const lit = g.i === 2 ? white : lc, al = U.w;
    let fr, fa;
    if (solid) { fa = 1; fr = [0, 1, 2].map(i => tint[i]*(.12 + .55*lam) + lit[i]*l*.75 + spec); }
    else if (outline) { fa = 1; fr = lit.map(c => c*l*.18); }
    else if (holo) { fa = 0; fr = [0, 1, 2].map(i => tint[i]*.03 + lit[i]*l*.25); }
    else { fa = .72; fr = [0, 1, 2].map(i => tint[i]*.14*(.3 + .7*face) + lit[i]*l*.45 + spec*.8); }
    for (let i = 0; i < 3; i++) X.fill[f*4 + i] = fr[i]*al; X.fill[f*4 + 3] = fa*al;
    const eb = ((outline ? 1 - Math.min(1, Math.abs(vz)*2.5) : .35 + .65*face)*.8 + l*.9)*(solid ? .35 : holo ? 1.2 : 1);
    for (let i = 0; i < 3; i++) X.edge[f*3 + i] = (tint[i]*.9 + lit[i]*l*.6 + .05)*eb*al;
    const a0 = G.TRI[f*3], a1 = G.TRI[f*3 + 1], a2 = G.TRI[f*3 + 2];
    for (let j = 0; j < 3; j++) { const p0 = j === 0 ? a1 : a0, p1 = j === 2 ? a1 : a2, dd = (g.D[p0] + g.D[p1])/2; X.eA[f*3 + j] = Math.max(0, Math.min(1, dd - G.EL[f*3 + j] + 1)); }
    const push = ((g.i === 3 ? l*.25 : g.i === 0 ? l*.12 : 0) + ex*(.4 + sd))*.45;
    X.off[f*3] = cx*push; X.off[f*3 + 1] = cy*push; X.off[f*3 + 2] = cz*push;
  }
}
