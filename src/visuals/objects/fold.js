// The Fold: a sheet of facets that becomes any surface (render/facet.js draws it, as the prism's facets). The user asked
// for the prism to open into a sheet that wraps round and rejoins, rises into mountains, folds back into a shape and opens
// again, its facets lighting in symmetric patterns that improvise. One square of facets, laid out as:
// - flat, a landscape of mountains (ranges arranged round the centre, symmetric), waves running out from the middle;
// - rolled into a tube, the tube bent round into a ring, the flat sheet bent into a flat ring, a twisted band;
// - folded into a ball (the square's corners meet behind, as an octahedron folds from paper), its shape one of thousands
//   from one formula (Gielis' superformula: stars, flowers, cushions, urchins), the stabs adding points;
// every change eased, so it rolls, bends and folds from one to the next. A new form on each phrase line, from the section's
// program; a drop opens a closed form out into mountains, or snaps an open one shut into a spiky ball; a breakdown lays it
// flat and calm. Its facets: 8 to 2,048, blooming out from the centre as the music builds. The light, each part of the
// music its own and symmetric round the centre: the kick's rings running out (and lifting the surface), or a cascade from
// facet to facet; the stabs' wedges, checker or diamonds; the hats' sparks; the melody's spiral; once a section has run
// a while a symmetric pattern that improvises a new figure each bar; in a drop's run-up it lights from the rim inwards.
// Look: the objects' style setting (glass, solid, outline, hologram). Tuning in TUNE.fold.
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { hsv2rgb } from '../../util.js';
import { DANCE } from '../../scene/dance.js';
import { SIG } from '../../scene/signals.js';
import { L } from '../../audio/listen.js';
import { sheetGeo, facetPlaceP, facetGL, facet2d, facetPath2d } from '../../render/facet.js';

const G = sheetGeo(4), FMAX = 4, AL = 3;   // the cascade runs on the 512 facets of level 3
const nv = G.nv, nf = G.nf, UV = G.UV, side = G.side;
const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0)/4294967296; };
let seed = 1; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;   // its own random numbers (Journey's draws stay untouched)
const pick = a => a[Math.floor(rnd()*a.length)];
const tids = new WeakMap(); let tidN = 0; const tid = t => t == null ? 0 : tids.get(t) || (tids.set(t, ++tidN), tidN);
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x*x*(3 - 2*x);
// value noise on the plane, for the mountains
const h2 = (i, j) => { const x = Math.sin(i*127.1 + j*311.7)*43758.5453; return x - Math.floor(x); };
function vn(x, y){ const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy);
  return (h2(i, j)*(1 - u) + h2(i + 1, j)*u)*(1 - v) + (h2(i, j + 1)*(1 - u) + h2(i + 1, j + 1)*u)*v; }

// the forms: a: rolled (0 flat, 1 a closed tube), b: bent round (1 the ends meet: a ring), s: folded into the ball, tw: twist,
// h: mountains, wv: waves, pitch: how it's tipped (negative: its face up, a landscape seen from above), yw: how much it turns
// about its own upright (the rest of its turn is round its face, the way a flat or symmetric form shows best), det: least detail
export const FORMS = {
  sheet: {wd: 1, a: 0, b: 0, s: 0, tw: 0, h: .35, wv: 0, pitch: -.6, yw: 0, det: 2},
  peaks: {wd: 1, a: 0, b: 0, s: 0, tw: 0, h: 1, wv: 0, pitch: -1.05, yw: 0, det: 3},
  waves: {wd: 1, a: 0, b: 0, s: 0, tw: 0, h: .15, wv: 1, pitch: -.85, yw: 0, det: 3},
  tube: {wd: 1, a: 1, b: 0, s: 0, tw: 0, h: .15, wv: 0, pitch: .2, yw: 1, det: 2},
  ring: {wd: 1, a: 1, b: 1, s: 0, tw: 0, h: .12, wv: 0, pitch: .45, yw: .4, det: 2},
  halo: {wd: .45, a: 0, b: 1, s: 0, tw: 0, h: .25, wv: 0, pitch: -.3, yw: 0, det: 2},
  twist: {wd: 1, a: .3, b: 0, s: 0, tw: 2.4, h: .08, wv: 0, pitch: .1, yw: 1, det: 2},
  ball: {wd: 1, a: 0, b: 0, s: 1, tw: 0, h: .1, wv: 0, pitch: .2, yw: .5, det: 1},
};
const OPEN = ['sheet', 'peaks', 'waves', 'halo'], CLOSED = ['tube', 'ring', 'twist', 'ball'], CALM = ['sheet', 'waves', 'halo', 'ball'], LIVE = ['peaks', 'ring', 'tube', 'twist', 'ball'];
const PARAMS = ['wd', 'a', 'b', 's', 'tw', 'h', 'wv', 'pitch', 'yw'];
// the ball's shapes: the superformula round its face (m points) and from front to back
const SF = {round: [0, 1, 2, 2], star: [5, .3, .3, .3], flower: [6, 1, 1, 8], cushion: [4, 12, 15, 15], gem: [6, 2, 4, 4], urchin: [12, .4, .6, .6], shell: [3, 4.5, 10, 10]};
const SFN = Object.keys(SF);
const sfr = (t, p) => { const m = p[0]/4; return Math.pow(Math.pow(Math.abs(Math.cos(m*t)), p[2]) + Math.pow(Math.abs(Math.sin(m*t)), p[3]), -1/p[1]); };
const sfMax = p => { let mx = 0; for (let i = 0; i < 96; i++) mx = Math.max(mx, sfr(i/96*Math.PI*2 - Math.PI, p)); return mx || 1; };

// every vertex's place on the ball (the octahedral fold of the square): its direction, and its angles round the face and back
const BD = new Float32Array(nv*3), TH = new Float32Array(nv), PH = new Float32Array(nv);
for (let v = 0; v < nv; v++) { const d = octa(UV[v*2], UV[v*2 + 1]); BD.set(d, v*3); TH[v] = Math.atan2(d[1], d[0]); PH[v] = Math.asin(Math.max(-1, Math.min(1, d[2]))); }
function octa(x, y){ let nx = x, ny = y; const nz = 1 - Math.abs(x) - Math.abs(y);
  if (nz < 0) { nx = (1 - Math.abs(y))*(x < 0 ? -1 : 1); ny = (1 - Math.abs(x))*(y < 0 ? -1 : 1); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx/l, ny/l, nz/l]; }

const S3 = new Float32Array(nv*3), NR = new Float32Array(nv*3), D = new Float32Array(nv), X = {};
X.fill = new Float32Array(nf*4); X.edge = new Float32Array(nf*3); X.eA = new Float32Array(nf*3); X.off = new Float32Array(nf*3);
const NA = G.NF[AL], ADJ = G.ADJ[AL], age = new Float32Array(NA).fill(99), casc = new Float32Array(NA);

const st = {f: {...FORMS.sheet}, form: 'sheet', sfA: SF.round, sfB: SF.round, sfMx: [1, 1], sfMix: 1, sfSecs: 1, det: 2, dFrom: 2, dTo: 2, wipe: 1, ex: 0, exT: 0, off: true, hue: 0,
  rip: [], sec: 0, secT: -9, chk: 0, chkT: -9, s16: -1, t: 0, bars: 0, secBars: 0, type: null, prog: null, progs: {}, fi: 0, phr: -1,
  run: 0, lastDrop: null, lastHit: 0, glow: 0, kickT: -9, spin: 0, brk: false, hold: null, dropT: -9};
// a section's program: its forms in turn, its ball's shape, its symmetry, which pattern each part of the music plays
function programFor(type, T){
  const id = tid(type); if (id && st.progs[id]) return st.progs[id];
  seed = 1 + Math.floor(hashStr('f' + id)*2147483000);
  const live = T > .5, forms = [pick(live ? LIVE : CALM), pick(OPEN), pick(CLOSED)];
  const p = {forms, sf: pick(live ? ['star', 'urchin', 'gem', 'shell'] : ['round', 'flower', 'cushion', 'gem']), n: pick([4, 6, 8]), det: live ? 3 + rnd() : 2 + rnd()*1.5,
    kick: pick(['ripple', 'ripple', 'cascade', 'pulse']), stab: pick(['sectors', 'checker', 'diamonds']), spiral: [pick([2, 3, 4]), pick([3, 5, 8])], seed: rnd()*1000};
  if (id) st.progs[id] = p;
  return p;
}
// for tests and stills: its state, a section's program, and holding a form (null lets the music choose again)
export const foldState = () => ({form: st.form, f: st.f, det: st.dTo, X, D, prog: st.prog});
export const foldProgram = (type, T) => programFor(type, T);
export const foldForm = (k, now) => { st.hold = k; if (k) { goForm(k); if (now) Object.assign(st.f, FORMS[k]); } };

export default {
  key: 'fold', kind: 'object', label: 'The Fold', words: 'A sheet of facets folds into mountains, rings and shapes with the music', optIn: true,
  dance: {moves: {face: 2, spin: 1, float: 1, rise: .6, approach: 1.2, pulse: 1, still: .7, groove: .3, bang: .2, look: .3}, sym: 4, liftPart: 1},
  get mesh(){ const pos = []; for (let v = 0; v < nv; v++) pos.push(UV[v*2]*.6, UV[v*2 + 1]*.6, 0);
    return this._m || (this._m = {pieces: [{pos, tri: Array.from(G.TRI), part: Array.from({length: nf}, (_, f) => 1 + G.FA[0][f] % 6)}], hinge: [0, 0, 0]}); },
  stats: '8 to 2,048 facets, a sheet that folds into eight forms',
  onBeat(pos){ st.run++; if (pos === 0) { st.bars++; st.secBars++; st.glow = 1; } },
  breakApart(){ st.exT = 1; },
  params(P, x){
    const T = TUNE.fold, J = x.J, dt = x.dt, w = P.o.fold || 0, ten = J ? J.tension || 0 : .5;
    st.t += dt;
    const type = J && J.on ? J.type : null;
    if (type !== st.type || !st.prog) { st.type = type; st.prog = programFor(type, ten); st.secBars = 0; st.fi = 0;
      if (!st.hold) goForm(st.prog.forms[0]); setSf(SF[st.prog.sf]); setDetail(Math.max(FORMS[st.form].det, st.prog.det + ten*T.detTension)); }
    const pr = st.prog;
    // a drop: a closed form opens out into mountains, an open one snaps shut into a spiky ball; every facet
    if (J && st.lastDrop !== null && J.lastDrop !== st.lastDrop) { st.dropT = st.t; setDetail(FMAX, 1);
      if (!st.hold) { const closed = st.f.s > .5 || st.f.a > .5 || st.f.b > .5; if (closed) { st.exT = .6; goForm('peaks'); } else { goForm('ball'); setSf(SF.urchin); } } }
    st.lastDrop = J ? J.lastDrop : null;
    if (w < .003) { st.off = true; return; }
    if (st.off) { st.off = false; st.ex = st.exT = 1; }   // arriving: it gathers out of its facets
    st.exT *= Math.exp(-dt/T.explodeSecs); st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
    const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : (st.run*4) % 16;
    if (s16 !== st.s16) { st.s16 = s16; step16(); }
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; kick(ten); }
    // stabs: the wedges step on, the checker flips, the ball gains points
    if (x.hit > .8 && st.lastHit <= .8) { st.sec++; st.secT = st.t; st.chk ^= 1; st.chkT = st.t; st.hue += .09;
      const b = SF[pr.sf]; setSf([b[0] + 2*(st.sec % 3), b[1], b[2], b[3]], T.stabSfSecs); }
    st.lastHit = x.hit;
    // a phrase line: the next form of the section's program
    if (st.secBars > 0 && st.secBars % 4 === 0 && st.phr !== st.bars) { st.phr = st.bars;
      if (!L.brk && !st.hold && st.t - st.dropT > 8*S.beatPeriod) { st.fi = (st.fi + 1) % pr.forms.length; goForm(pr.forms[st.fi]); } }
    // a breakdown lays it flat and calm with fewer facets; after, back to the section's own
    if (L.brk && !st.brk) { if (!st.hold) goForm('sheet'); setDetail(1.5 + rnd()); }
    if (!L.brk && st.brk) setDetail(Math.max(FORMS[st.form].det, pr.det + ten*T.detTension));
    st.brk = L.brk;
    // the form eases towards its target; the detail's front blooms out from the centre
    const tg = FORMS[st.form], k = Math.min(1, dt/T.morphSecs*2.2);
    for (const p of PARAMS) st.f[p] += (tg[p] - st.f[p])*k;
    st.sfMix = Math.min(1, st.sfMix + dt/st.sfSecs);
    st.wipe = Math.min(1, st.wipe + dt/(T.wipeBeats*S.beatPeriod));
    st.glow *= Math.exp(-dt*3);
    st.spin += dt*T.spin*(1 - .6*TUNE.dance.amount)*(.5 + ten);
    shape(P, x, ten);
    light(P, x);
    const An = P.anchor, d = DANCE.obj.fold, f = st.f;
    const U = P.m = P.m || {};
    const u = U.fold = {rot: st.spin*f.yw + Math.sin(x.t*.11)*.15*(1 - f.yw), pitch: f.pitch + Math.sin(x.t*.19)*.08, roll: st.spin*(1 - f.yw)*.5,
      size: (An && An.size || T.size)*(1 + (P.bass || 0)*x.react*.03), pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, (f.pitch < 0 ? -.04 : .02) + P.wind.y*TUNE.ctx.windObject],
      line: TUNE.mesh.line, w: An && An.hide ? 0 : Math.min(1, w*1.2), X};
    if (d) { u.rot += d.yaw*f.yw; u.roll += d.yaw*(1 - f.yw);   // (a flat form turns round its face, never edge-on)
      u.pitch += d.pitch*(f.pitch < 0 ? .3 : 1); u.roll += d.roll; u.pos = [u.pos[0] + d.dx, u.pos[1] + d.dy]; u.size *= d.s; u.sq = d.sq*(f.pitch < 0 ? .3 : 1); }
    const Vw = S.view; if (Vw && Vw.key === 'fold') { u.rot = Vw.yaw + (d ? d.yaw : 0); u.pitch += Vw.pitch; u.size *= Vw.zoom; }
    colour(P, x, u, w);
  },
  drawGL(gl, P, W, H, stage){ if (stage === 'trails') return;
    if (!this._gl || this._gen !== S.glGen) { this._gl = facetGL(gl, G); this._gen = S.glGen; } this._gl(X, P.m.fold, W, H, stage); },
  draw2d(o, P){ facet2d(o, G, X, P.m.fold); },
  path2d(o, P){ facetPath2d(o, G, X, P.m.fold); },
};

function goForm(k){ if (!FORMS[k]) return; st.form = k; if (FORMS[k].det > st.dTo) setDetail(FORMS[k].det); }
function setSf(p, secs){ st.sfA = sfNow(); st.sfMx[0] = st.sfMx[1]; st.sfB = p; st.sfMx[1] = sfMax(p); st.sfMix = 0; st.sfSecs = secs || TUNE.fold.morphSecs; }
const sfNow = () => st.sfMix >= 1 ? st.sfB : st.sfA;   // (a change mid-blend starts from where it was going)
function setDetail(d, now){ d = Math.max(0, Math.min(FMAX, d)); if (Math.abs(d - st.dTo) < .05) return;
  st.dFrom = now ? d : st.dFrom + (st.dTo - st.dFrom)*Math.min(1, st.wipe); st.dTo = d; st.wipe = now ? 1 : 0; }

// ---- the surface: where each point of the sheet (x, y in -1..1) is, for the form as it is now ----
const tmp = [0, 0, 0];
function surf(x, y, v, f, o){
  const T = TUNE.fold, Wd = T.half;
  let X = x*Wd*f.wd, Y = y*Wd, Z = 0;
  // rolled: the sheet curled round its upright (closing into a tube), and centred
  const A = f.a*Math.PI;
  if (A > 1e-3) { const r = Wd*f.wd/A, th = A*x; X = r*Math.sin(th); Z = r*(Math.cos(th) - 1) + r*(1 - Math.cos(A))/2; }
  if (f.tw) { const c = Math.cos(f.tw*y), s = Math.sin(f.tw*y), x2 = c*X - s*Z; Z = s*X + c*Z; X = x2; }
  // bent: the length curved round in its own plane (the ends meeting: a ring, or the flat sheet a flat ring)
  const B = f.b*Math.PI;
  if (B > 1e-3) { const r2 = Wd/B + T.ringR, ph = B*y, rr = r2 + X; X = rr*Math.cos(ph) - r2 + r2*(1 - Math.cos(B))/2; Y = rr*Math.sin(ph); }
  // folded into the ball: the octahedral fold, its radius the superformula's (two shapes blending)
  if (f.s > 1e-3) {
    let th, ph;
    if (v >= 0) { th = TH[v]; ph = PH[v]; o[0] = BD[v*3]; o[1] = BD[v*3 + 1]; o[2] = BD[v*3 + 2]; }
    else { const d = octa(x, y); o[0] = d[0]; o[1] = d[1]; o[2] = d[2]; th = Math.atan2(d[1], d[0]); ph = Math.asin(Math.max(-1, Math.min(1, d[2]))); }
    const m = smooth(st.sfMix), ra = sfr(th, st.sfA)/st.sfMx[0]*sfr(ph, st.sfA)/st.sfMx[0], rb = sfr(th, st.sfB)/st.sfMx[1]*sfr(ph, st.sfB)/st.sfMx[1], r = ra*(1 - m) + rb*m;
    const R = T.ballR*(.55 + .45*r), s = smooth(f.s);
    X += (o[0]*R - X)*s; Y += (o[1]*R - Y)*s; Z += (o[2]*R - Z)*s;
  }
  o[0] = X; o[1] = Y; o[2] = Z; return o;
}
// the mountains and waves: a height over the sheet, symmetric round its centre (folded into the section's n wedges)
function height(x, y, f, t, bass){
  const T = TUNE.fold, n = st.prog ? st.prog.n : 6, r = Math.hypot(x, y), wedge = Math.PI*2/n;
  let a = Math.atan2(y, x); a = Math.abs(((a % wedge) + wedge) % wedge - wedge/2);
  const u = r*Math.cos(a)*T.mtnScale, w = r*Math.sin(a)*T.mtnScale, s = st.prog ? st.prog.seed : 0;
  let hgt = 0, amp = 1, fr = 1;
  for (let i = 0; i < 3; i++) { const q = 1 - Math.abs(2*vn(u*fr + s, w*fr + s*.7) - 1); hgt += q*q*amp; amp *= .5; fr *= 2.1; }
  hgt = (hgt - .45)*f.h*(1 + bass*T.breath) + f.wv*Math.sin(r*T.waveK - t*T.waveSpeed)*.6;
  for (const q of st.rip) { const g = st.t - q.t; hgt += T.ripLift*q.k*Math.exp(-(((r - g*T.ripSpeed)/.12)**2))*Math.max(0, 1 - g/T.ripSecs); }
  return hgt*T.mtn*(1 - .85*smooth((Math.max(Math.abs(x), Math.abs(y)) - .7)/.3));   // (lower towards the edges: an island of ranges)
}
const P3 = new Float32Array(nv*3);
function shape(P, x, ten){
  const T = TUNE.fold, f = st.f, bass = (P.bass || 0)*x.react, anticip = (x.J && x.J.anticip) || 0, fh = {...f, h: f.h*(1 + anticip*.8)};
  for (let v = 0; v < nv; v++) { surf(UV[v*2], UV[v*2 + 1], v, f, tmp); P3[v*3] = tmp[0]; P3[v*3 + 1] = tmp[1]; P3[v*3 + 2] = tmp[2]; }
  // each point's normal (from its neighbours on the grid; at the edges, from the surface just past them, so seams meet)
  const VI = G.VI, e = 2/(side - 1), q = [0, 0, 0], q2 = [0, 0, 0];
  for (let v = 0; v < nv; v++) {
    const g = G.GI[v], gi = Math.floor(g/side), gj = g % side;
    let ux, uy, uz, wx, wy, wz;
    if (gi > 0 && gi < side - 1 && gj > 0 && gj < side - 1) {
      const a = VI[g + side]*3, b = VI[g - side]*3, c = VI[g + 1]*3, d = VI[g - 1]*3;
      ux = P3[a] - P3[b]; uy = P3[a + 1] - P3[b + 1]; uz = P3[a + 2] - P3[b + 2]; wx = P3[c] - P3[d]; wy = P3[c + 1] - P3[d + 1]; wz = P3[c + 2] - P3[d + 2];
    } else {
      const x0 = UV[v*2], y0 = UV[v*2 + 1];
      surf(x0 + e, y0, -1, f, q); surf(x0 - e, y0, -1, f, q2); ux = q[0] - q2[0]; uy = q[1] - q2[1]; uz = q[2] - q2[2];
      surf(x0, y0 + e, -1, f, q); surf(x0, y0 - e, -1, f, q2); wx = q[0] - q2[0]; wy = q[1] - q2[1]; wz = q[2] - q2[2];
    }
    let nx = uy*wz - uz*wy, ny = uz*wx - ux*wz, nz = ux*wy - uy*wx; const l = Math.hypot(nx, ny, nz) || 1;
    NR[v*3] = nx/l; NR[v*3 + 1] = ny/l; NR[v*3 + 2] = nz/l;
  }
  // the mountains, waves and kick's ripples along the normal; the detail's front
  const wf = st.wipe*1.25;
  for (let v = 0; v < nv; v++) {
    const x0 = UV[v*2], y0 = UV[v*2 + 1], hh = height(x0, y0, fh, x.t, bass);
    S3[v*3] = P3[v*3] + NR[v*3]*hh; S3[v*3 + 1] = P3[v*3 + 1] + NR[v*3 + 1]*hh; S3[v*3 + 2] = P3[v*3 + 2] + NR[v*3 + 2]*hh;
    const s = smooth(((Math.abs(x0) + Math.abs(y0))/2 - wf)/.12 + .5);
    D[v] = st.dTo + (st.dFrom - st.dTo)*s;
  }
  facetPlaceP(G, S3, D, X);
}

// ---- what the music does on its beats ----
function kick(ten){
  st.rip.push({t: st.t, k: .6 + ten*.6}); if (st.rip.length > 4) st.rip.shift();
  if (st.prog && st.prog.kick === 'cascade') {   // seeded at n points round the centre, so its rings run out symmetric
    const n = st.prog.n, r = .25 + .5*hash(st.run*.71), a0 = hash(st.run*1.3)*Math.PI*2, C = G.CEN[AL];
    for (let i = 0; i < n; i++) { const a = a0 + i/n*Math.PI*2, px = r*Math.cos(a), py = r*Math.sin(a); let b = 0, bd = 9;
      for (let c = 0; c < NA; c++) { const dd = (C[c*3] - px)**2 + (C[c*3 + 1] - py)**2; if (dd < bd) { bd = dd; b = c; } } age[b] = 0; }
  }
}
function step16(){
  for (let c = 0; c < NA; c++) casc[c] = age[c];
  for (let c = 0; c < NA; c++) { if (casc[c] < 4) { age[c] = casc[c] + 1; continue; }
    let lit = false; for (let j = 0; j < 3; j++) { const n = ADJ[c*3 + j]; if (n >= 0 && casc[n] === 0) lit = true; }
    age[c] = lit ? 0 : Math.min(99, casc[c] + 1); }
}

// ---- light: each facet's from each part of the music (by where it is on the sheet: patterns symmetric round the centre) ----
const LK = new Float32Array(nf), LS = new Float32Array(nf), LH = new Float32Array(nf), LM = new Float32Array(nf), LI = new Float32Array(nf), LP = new Float32Array(nf);
const lv = []; for (let l = 0; l <= FMAX; l++) lv.push(new Float32Array(G.NF[l]));
function light(P, x){
  const T = TUNE.fold, pr = st.prog, sb = st.secBars, C = G.CEN, FA = G.FA, fl = X.fl, n = pr.n, wedge = Math.PI*2/n;
  // the cascade seen at every level (a coarse facet: the most lit of its level-3 facets' share)
  for (let c = 0; c < NA; c++) lv[AL][c] = age[c] < 99 ? Math.exp(-age[c]*.7) : 0;
  for (let c = 0; c < G.NF[FMAX]; c++) lv[FMAX][c] = lv[AL][c >> 2];
  for (let l = AL - 1; l >= 0; l--) for (let g = 0; g < G.NF[l]; g++) lv[l][g] = (lv[l + 1][g*4] + lv[l + 1][g*4 + 1] + lv[l + 1][g*4 + 2] + lv[l + 1][g*4 + 3])/4;
  const hats = Math.min(1, SIG.hat*1.4), on = k => sb >= T.layerBars[k], anticip = (x.J && x.J.anticip) || 0;
  const fade = Math.exp(-(st.t - st.secT)*2.5), cfade = Math.exp(-(st.t - st.chkT)*2.5), mel = Math.min(1, (SIG.harm || 0)*1.2 + (P.mid || 0)*x.react*.6);
  const imp = on('improv') ? 1 : 0, bar = st.bars, ph = SIG.barPhase || 0;
  for (let f = 0; f < nf; f++) {
    const L0 = fl[f], g = FA[L0][f], cx = C[L0][g*3], cy = C[L0][g*3 + 1], key = L0*100000 + g, r = Math.hypot(cx, cy), an = Math.atan2(cy, cx);
    // the kick: rings out from the centre, a cascade, or everything pulsing
    let k = pr.kick === 'pulse' ? SIG.kick*(.5 + .5*hash(key + st.run)) : 0;
    for (const q of st.rip) { const a = st.t - q.t; k = Math.max(k, q.k*Math.exp(-(((r - a*T.ripSpeed)/.1)**2))*Math.max(0, 1 - a/T.ripSecs)*(pr.kick === 'cascade' ? .4 : 1)); }
    if (pr.kick === 'cascade') k = Math.max(k, lv[L0][g]);
    LK[f] = k;
    // stabs: a wedge stepping round, a checker flipping, or a diamond ring stepping out
    let s = 0;
    if (on('stab')) {
      if (pr.stab === 'sectors') { const i = Math.floor(((an/wedge) % n + n) % n); s = i === st.sec % n ? .4 + .6*fade : 0; }
      else if (pr.stab === 'checker') s = (G.CH[L0][g] === 3) === !!st.chk ? .25 + .75*cfade : 0;
      else { const b = Math.floor((Math.abs(cx) + Math.abs(cy))*3); s = b === st.sec % 6 ? .5 + .5*fade : 0; }
    }
    LS[f] = s;
    LH[f] = on('hat') ? (hash(key*1.37 + st.s16*17.1 + bar*3.3) < hats*T.hatShare ? 1 : 0) : 0;
    // the melody: a spiral turning with the mids
    LM[f] = Math.max(0, Math.cos(an*pr.spiral[0] + r*pr.spiral[1]*2 - x.t*(.5 + (P.mid || 0)*2)))**10*mel;
    // the improvising pattern: a symmetric figure (folded into the n wedges, mirrored), a new one each bar, easing in
    if (imp) { let a = Math.abs(((an % wedge) + wedge) % wedge - wedge/2); const u = r*Math.cos(a)*4, w = r*Math.sin(a)*4;
      const va = vn(u + bar*7.31, w + pr.seed), vb = vn(u + (bar - 1)*7.31, w + pr.seed), e = smooth(ph*4);
      LI[f] = smooth(((va*e + vb*(1 - e)) - .62)/.08); } else LI[f] = 0;
    // a drop's run-up: from the rim inwards as the drop nears
    LP[f] = anticip > .02 ? smooth(((r + (Math.abs(cx) + Math.abs(cy))*.3) - (1 - anticip)*1.5)/.15) : 0;
  }
}
function colour(P, x, u, w){
  const T = TUNE.fold, h = (P.hue || 0) + st.hue, pal = P.pal || [0, .33, .67], sty = Math.round((x.eff && x.eff.objStyle) || 0) % 6;
  const cK = hsv2rgb(h + pal[0], .75, 1), cS = hsv2rgb(h + pal[1], .8, 1), cH = hsv2rgb(h + pal[2], .25, 1), cM = hsv2rgb(h + pal[2], .9, 1), cI = hsv2rgb(h + pal[1] + .5, .7, 1), cP = hsv2rgb(h + pal[0] + .08, .55, 1);
  const tints = [0, 1, 2].map(i => hsv2rgb(h + pal[i], .5, 1)), Lt = P.light || {amt: 0}, lc = hsv2rgb(h + (Lt.hue || 0), Lt.sat || 0, 1);
  const cr = Math.cos(u.rot), sr = Math.sin(u.rot), cp = Math.cos(u.pitch), sp = Math.sin(u.pitch), co = Math.cos(u.roll), so = Math.sin(u.roll);
  const Hx = -.25, Hy = .35, Hz = 1.5, hl = Math.hypot(Hx, Hy, Hz);
  const ext = sty === 2 ? .5 : 1, ex = st.ex*st.ex*T.explode, gone = Math.max(0, 1 - w/.6), dim = x.dim, fill = T.fill*(.6 + (P.beat || 0)*.8);
  const solid = sty === 1 || sty === 5, outline = sty === 2, holo = sty === 3;
  for (let f = 0; f < nf; f++) {
    const L0 = X.fl[f], g = G.FA[L0][f], key = L0*100000 + g, sd = hash(key*.731);
    const nx = X.fn[f*3], ny = X.fn[f*3 + 1], nz = X.fn[f*3 + 2], x1 = cr*nx + sr*nz, z1 = -sr*nx + cr*nz, vy0 = cp*ny - sp*z1, vz = sp*ny + cp*z1;
    const vx = co*x1 - so*vy0, vy = so*x1 + co*vy0, sg = vz < 0 ? -1 : 1;   // (a sheet has two faces: lit as whichever faces us)
    const face = .5 + .5*Math.abs(vz), spec = Math.pow(Math.max(0, sg*(vx*Hx + vy*Hy + vz*Hz)/hl), T.gloss)*T.glint, lam = Math.max(0, sg*(vx*-.4 + vy*.6 + vz*.7));
    const k = LK[f], s = LS[f], hh = LH[f]*dim, m = LM[f], im = LI[f], p = LP[f];
    const tn = tints[(G.CH[1][G.FA[1][f]] + (G.FA[0][f] < 4 ? 0 : 1)) % 3];
    const lit = [0, 1, 2].map(i => (cK[i]*k + cS[i]*s + cH[i]*hh + cM[i]*m*.7 + cI[i]*im*.45 + cP[i]*p)*T.lit);
    const lsum = (k + s + hh + m*.7 + im*.45 + p)*T.lit, alpha = (sd < gone ? 0 : 1)*u.w;
    let fr, fa;
    if (solid) { fa = 1; fr = [0, 1, 2].map(i => tn[i]*(.12 + .55*lam)*(.6 + st.glow*.3) + lit[i]*.75 + spec + lc[i]*(Lt.amt || 0)*lam*.15); }
    else if (outline) { fa = 1; fr = lit.map(c => c*.18); }
    else if (holo) { fa = 0; fr = [0, 1, 2].map(i => (tn[i]*.03 + lit[i]*.25)); }
    else { fa = T.dark; fr = [0, 1, 2].map(i => tn[i]*fill*(.3 + .7*face) + lit[i]*.6*fa + spec*.8 + lc[i]*(Lt.amt || 0)*lam*.08); }
    for (let i = 0; i < 3; i++) X.fill[f*4 + i] = fr[i]*alpha; X.fill[f*4 + 3] = fa*alpha;
    const eb = ((outline ? 1 - Math.min(1, Math.abs(vz)*2.5) : .35 + .65*face)*(.75 + st.glow*.6) + lsum*.9)*(solid ? .35 : holo ? 1.2 : 1);
    for (let i = 0; i < 3; i++) X.edge[f*3 + i] = (tn[i]*.9 + lit[i]*.6 + .05)*eb*alpha;
    const a0 = G.TRI[f*3], a1 = G.TRI[f*3 + 1], a2 = G.TRI[f*3 + 2];
    for (let j = 0; j < 3; j++) { const p0 = j === 0 ? a1 : a0, p1 = j === 2 ? a1 : a2, dd = (D[p0] + D[p1])/2; X.eA[f*3 + j] = Math.max(0, Math.min(1, dd - G.EL[f*3 + j] + 1)); }
    // lit facets lift off the surface, and all fly apart when it shatters
    const push = (T.extrude*(k*.8 + hh*.3) + ex*(.4 + sd))*.45*ext;   // (the kick's ring and the hats lift facets; the wider patterns only light them, or the surface looked cracked)
    X.off[f*3] = nx*push; X.off[f*3 + 1] = ny*push; X.off[f*3 + 2] = nz*push;
  }
}
