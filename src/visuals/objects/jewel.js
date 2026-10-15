// The Prism as the user chose it in the WebGL test (native/prism-web.html, its Layers sheet at 8: everything but the room):
// a glass gem of 20 to 1,280 facets lit per pixel by three lamps, the glint split into a rainbow, its edges glowing. It tours
// named shapes a phrase at a time, gains facets with the groove, opens into a star, mountains or waves and folds back, wears
// stained glass, LED panels, metal, ice, mirror or iridescence, carries life on its facets (spots, stripes, swells, frost,
// fireflies), and lights in patterns with the music: the kick's rings, the stabs' wedge, the hats' sparks, a drop's run-up
// filling it from the bottom; it shatters on the drop. Each layer can be switched off (TUNE.jewel.on). The older, fuller
// Prism (objects/prism.js, with the room, lasers and the square sheet) stays beside it as "Prism (full)".
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { SIG } from '../../scene/signals.js';
import { L } from '../../audio/listen.js';
import { gemSheetGeo, FOCAL, CAM } from '../../render/facet.js';
import { makeCells, stepCells, touch } from './cells.js';

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x*x*(3 - 2*x);
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
function hash(a, b){ let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0)/4294967296; }
function hsv(h, s, v){ const hh = (h - Math.floor(h))*6; return [Math.abs(hh - 3) - 1, 2 - Math.abs(hh - 2), 2 - Math.abs(hh - 4)].map(k => v*((1 - s) + s*clamp(k, 0, 1))); }
const h2 = (i, j) => { const x = Math.sin(i*127.1 + j*311.7)*43758.5453; return x - Math.floor(x); };
function vn(x, y){ const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy);
  return (h2(i, j)*(1 - u) + h2(i + 1, j)*u)*(1 - v) + (h2(i, j + 1)*(1 - u) + h2(i + 1, j + 1)*u)*v; }
const ICO = (() => { const t = (1 + Math.sqrt(5))/2; return [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm); })();
const m3 = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i*3 + j] = A[i*3]*B[j] + A[i*3 + 1]*B[3 + j] + A[i*3 + 2]*B[6 + j]; return C; };
const mul = (M, x, y, z) => [M[0]*x + M[1]*y + M[2]*z, M[3]*x + M[4]*y + M[5]*z, M[6]*x + M[7]*y + M[8]*z];
const mulT = (M, v) => [M[0]*v[0] + M[3]*v[1] + M[6]*v[2], M[1]*v[0] + M[4]*v[1] + M[7]*v[2], M[2]*v[0] + M[5]*v[1] + M[8]*v[2]];

// ---- the shapes it tours, and its open forms ----
const LOOKS = [
  {name: 'ball', kind: 'ball'}, {name: 'cube', kind: 'cube', sharp: true}, {name: 'octahedron', kind: 'octa', sharp: true}, {name: 'diamond', kind: 'gem', sharp: true},
  {name: 'star', kind: 'star', sharp: true}, {name: 'disc', kind: 'disc'}, {name: 'pill', kind: 'pill'}, {name: 'flower', kind: 'flower'},
  {name: 'starfish', kind: 'superf', sf: [5, .3, .3, .3], sharp: true}, {name: 'urchin', kind: 'superf', sf: [10, .4, .6, .6], sharp: true},
  {name: 'shell', kind: 'superf', sf: [3, 4.5, 10, 10]}, {name: 'cushion', kind: 'superf', sf: [4, 12, 15, 15]}, {name: 'jewel', kind: 'superf', sf: [5, 2, 4, 4], sharp: true},
  {name: 'lantern', kind: 'ball', lathe: .22, lf: 4}, {name: 'spindle', kind: 'pill', sq: [.7, 1.5, .7]}, {name: 'twisted cube', kind: 'cube', twist: 1.4, sharp: true},
].map(Lk => ({sf: [0, 1, 2, 2], sq: [1, 1, 1], twist: 0, lathe: 0, lf: 4, sharp: false, ...Lk}));
const sfr = (t, p) => { const m = p[0]/4; return Math.pow(Math.pow(Math.abs(Math.cos(m*t)), p[2]) + Math.pow(Math.abs(Math.sin(m*t)), p[3]), -1/p[1]); };
for (const Lk of LOOKS) if (Lk.kind === 'superf') { let mx = 0; for (let i = 0; i < 96; i++) mx = Math.max(mx, sfr(i/96*2*Math.PI - Math.PI, Lk.sf)); Lk.mx = Math.max(mx, 1e-3); }
function radius(Lk, x, y, z){
  switch (Lk.kind) {
    case 'octa': return 1.25/(Math.abs(x) + Math.abs(y) + Math.abs(z));
    case 'cube': return .8/Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
    case 'gem': { const r = Math.sqrt(x*x + z*z); return Math.min(1.05/(r*.8 + Math.abs(y)*.95), y > 0 ? .55/y : 9); }
    case 'star': { let m = 0; for (const a of ICO) m = Math.max(m, a[0]*x + a[1]*y + a[2]*z); return .78 + .95*Math.pow(m, 28); }
    case 'flower': return .85 + .3*Math.cos(5*Math.atan2(z, x))*(1 - Math.abs(y)) + .12*y;
    case 'disc': return 1/Math.sqrt(x*x*.9025 + z*z*.9025 + y*y*4);
    case 'pill': return .8/Math.sqrt(x*x + z*z + y*y*.3025);
    case 'superf': { const th = Math.atan2(y, x), ph = Math.asin(clamp(z, -1, 1)); return .6 + .55*(sfr(th, Lk.sf)/Lk.mx)*(sfr(ph, Lk.sf)/Lk.mx); }
  }
  return 1;
}
function shaped(Lk, x, y, z, out){
  let R = radius(Lk, x, y, z);
  if (Lk.lathe > 0) R *= 1 + Lk.lathe*Math.sin(Lk.lf*Math.asin(clamp(y, -1, 1))*2);
  let px = x*R*Lk.sq[0], py = y*R*Lk.sq[1], pz = z*R*Lk.sq[2];
  if (Lk.twist) { const a = Lk.twist*py, c = Math.cos(a), s = Math.sin(a), x2 = c*px - s*pz; pz = s*px + c*pz; px = x2; }
  out[0] = px; out[1] = py; out[2] = pz;
}
const FORMS = {gem: {k: 1, h: 0, wv: 0, pitch: .25, yw: 1, det: 0}, bloom: {k: .45, h: .06, wv: 0, pitch: -.2, yw: .3, det: 1},
  star: {k: 0, h: .3, wv: 0, pitch: -.55, yw: 0, det: 2}, peaks: {k: 0, h: 1, wv: 0, pitch: -1.05, yw: 0, det: 3}, waves: {k: 0, h: .15, wv: 1, pitch: -.85, yw: 0, det: 3}};
const OPEN = ['bloom', 'star', 'peaks', 'waves'];
export const TEX = ['glass', 'stained glass', 'LED panels', 'brushed metal', 'ice', 'mirror', 'iridescent'];
const RULES = ['spots', 'stripes', 'swell', 'frost', 'fireflies'];

// ---- the geometry: the gem cut into five gores (render/facet.js), so it can open; where each corner lies on the flat star ----
const G = gemSheetGeo(3), NV = G.nv, NF = G.nf, NA = G.NF[2];
const SX = new Float32Array(NV), SY = new Float32Array(NV), AF = new Float32Array(NV);
for (let v = 0; v < NV; v++) { const th = G.TH[v], sc = th < 1e-4 ? 1 : Math.sin(th)/th, ps = G.GC[v] + G.PS[v]*sc; SX[v] = th*Math.cos(ps); SY[v] = th*Math.sin(ps); AF[v] = th/Math.PI; }
const cen = (L, i) => [G.CEN[L][i*3], G.CEN[L][i*3 + 1], G.CEN[L][i*3 + 2]];
const S3 = new Float32Array(NV*3), P3 = new Float32Array(NV*3), D = new Float32Array(NV).fill(1);
// per face, as drawn: view-space corners and normal, the face's tint, how lit, its texture, its edges' alphas
const FV = new Float32Array(NF*9), FN = new Float32Array(NF*3), FC = new Float32Array(NF*4), FT = new Uint8Array(NF), FE = new Float32Array(NF*3);

let rng = 99;
const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return (rng >>> 8)/16777216; };
const st = {lookA: LOOKS[0], lookB: LOOKS[0], morph: 1, recent: ['ball'], dPrev: 1, dNext: 1, wave: 1, act: .2, ex: 0, exHold: 0,
  rings: [], wedge: 0, wedgeLit: 0, hatSeed: 0, hatLit: 0, kickFlash: 0, h0: .62, palSpread: .08, t: 0,
  pos: 0, bars: 0, kicks: 0, kickT: -9, lastPhraseT: 0, lastDrop: undefined, lastDropAt: -100, lastHit: 0, s16: -1, type: undefined,
  tension: 0, bassLv: 0, anticip: 0, inBreak: false, wasBreak: false, steady: true, period: .5,
  yaw: 0, pitch: .25, roll: 0, off: true, form: 'gem', f: {...FORMS.gem}, seed: 3.7,
  tex: {cur: 0, prev: 0, o: [0, 0, 1], t0: -100, dur: 4}, rule: 'spots', cells: makeCells(NA, G.ADJ[2], rand)};
const on = k => !!TUNE.jewel.on[k];
const curDetail = () => st.dPrev + (st.dNext - st.dPrev)*sm(st.wave);
const isOpen = () => st.form !== 'gem';
const rot = () => { const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch), cr = Math.cos(st.roll), sr = Math.sin(st.roll);
  return m3(m3([1, 0, 0, 0, cp, -sp, 0, sp, cp], [cy, 0, sy, 0, 1, 0, -sy, 0, cy]), [cr, -sr, 0, sr, cr, 0, 0, 0, 1]); };
const front = () => mulT(rot(), [0, 0, 1]);
const ring = (dir, b) => { st.rings.push({dir, t0: st.t, bright: b}); if (st.rings.length > 6) st.rings.shift(); };
const nearCell = d => { let best = -2, bc = 0; for (let c = 0; c < NA; c++) { const x = G.CEN[2][c*3]*d[0] + G.CEN[2][c*3 + 1]*d[1] + G.CEN[2][c*3 + 2]*d[2]; if (x > best) { best = x; bc = c; } } return bc; };
const symCells = (el, a0) => [0, 1, 2, 3, 4].map(i => { const a = a0 + i*2*Math.PI/5, ce = Math.cos(el); return nearCell([ce*Math.cos(a), ce*Math.sin(a), Math.sin(el)]); });

function nextLook(sharp){
  const pool = LOOKS.filter(Lk => Lk.name !== st.lookB.name && !st.recent.includes(Lk.name)), want = pool.filter(Lk => Lk.sharp === sharp);
  const from = want.length && rand() < .7 ? want : pool; if (!from.length) return;
  const Lk = from[Math.min(from.length - 1, Math.floor(rand()*from.length))];
  st.lookA = st.morph >= 1 ? st.lookB : (st.morph < .5 ? st.lookA : st.lookB); st.lookB = Lk; st.morph = 0;
  st.recent.push(Lk.name); if (st.recent.length > 5) st.recent.shift();
}
const setDetail = d => { if (Math.abs(d - st.dNext) < .01) return; st.dPrev = curDetail(); st.dNext = d; st.wave = 0; };
function newTex(vivid){
  const T = TUNE.jewel.tex, w = vivid ? [0, 1.5, 1.5, .5, 0, .5, 1.5] : st.act > .5 ? T.live : T.calm;
  let tot = 0; for (let i = 0; i < w.length; i++) if (i !== st.tex.cur) tot += w[i];
  let r = rand()*tot, k = 0; for (let i = 0; i < w.length; i++) { if (i === st.tex.cur) continue; r -= w[i]; if (r <= 0) { k = i; break; } }
  st.tex = {prev: st.tex.cur, cur: k, o: ICO[Math.floor(rand()*12)], t0: st.t, dur: Math.max(2, st.period*T.sweepBeats)};
}
function newRule(){ const w = st.act < .45 ? [1.4, 1.2, .6, 1.2, .6] : [.6, .6, 1.4, .8, 1.4]; let r = rand()*w.reduce((a, b) => a + b);
  st.rule = RULES[w.findIndex(x => (r -= x) <= 0)] || 'spots'; }
function onPhrase(){
  st.lastPhraseT = st.t;
  if (on('open')) { if (isOpen()) st.form = rand() < .6 ? 'gem' : OPEN[Math.floor(rand()*OPEN.length)]; else if (rand() < TUNE.jewel.openChance) st.form = OPEN[Math.floor(rand()*OPEN.length)]; }
  if (on('shapes') && (st.act > .3 || st.bars % 8 === 0)) nextLook(st.act > .6);
  if (on('surfaces') && rand() < TUNE.jewel.tex.change) newTex(false);
  if (on('life') && rand() < .5) newRule();
  if (rand() < .5) st.h0 += .06 + rand()*.12;
  st.palSpread = st.act > .5 ? .33 : .08;
}
function kick(){
  st.kicks++;
  const calm = st.act < .35;
  if (on('pulse') && (!calm || st.pos === 0)) {
    const dir = st.kicks % 8 === 0 ? front() : ICO[Math.floor(rand()*12)];
    ring(dir, (.45 + .55*Math.min(1, SIG.kick))*(calm ? TUNE.jewel.kickCalm : 1)); st.kickFlash = 1;
    if (on('life') && st.rule === 'swell') touch(st.cells, 'swell', [nearCell(dir)], 1.5);
  }
}
function drop(free){
  if (free || !on('drops')) { st.act = Math.max(st.act, .25); if (on('pulse')) ring(front(), .6); return; }
  st.ex = 1; st.exHold = .25; if (on('shapes')) nextLook(true); st.h0 += .33;
  for (const d of ICO.slice(0, 6)) ring(d, .8);
  st.act = 1; st.lastDropAt = st.t;
  if (on('open')) st.form = isOpen() ? 'gem' : 'peaks';
  if (on('surfaces')) newTex(true);
  if (on('life')) { const C = st.cells; if (st.rule === 'fireflies') C.ph.fill(0); else if (st.rule === 'frost') C.f.fill(1); else for (let i = 0; i < 40; i++) touch(C, st.rule, [Math.floor(rand()*NA)], 1.2); }
}
// the mountains and waves on an open form: ridged noise folded into five wedges, lower towards the rim
function height(v){
  const T = TUNE.jewel, f = st.f, x = SX[v], y = SY[v], r = Math.hypot(x, y), wedge = Math.PI*2/T.wedges;
  let a = Math.atan2(y, x); a = Math.abs(((a % wedge) + wedge) % wedge - wedge/2);
  const u = r*Math.cos(a)*T.mtnScale, w = r*Math.sin(a)*T.mtnScale, s = st.seed;
  let hgt = 0, amp = 1, fr = 1;
  for (let i = 0; i < 3; i++) { const q = 1 - Math.abs(2*vn(u*fr + s, w*fr + s*.7) - 1); hgt += q*q*amp; amp *= .5; fr *= 2.1; }
  hgt = (hgt - .45)*f.h*(1 + st.bassLv*T.mtnBreath*st.act*(on('pulse') ? 1 : 0)) + f.wv*Math.sin(r*T.waveK - st.t*T.waveSpeed)*.6;
  return hgt*T.mtn*(1 - .85*sm((AF[v] - .7)/.3));
}

// ---- each frame: placed, lit and turned, in the view space of the mesh objects' camera (render/facet.js's CAM, FOCAL) ----
const pa = [0, 0, 0], pb = [0, 0, 0];
function build(R){
  const T = TUNE.jewel, F = G.F, m = sm(st.morph), f = st.f, kk = Math.max(f.k, 1e-3), kc = f.k*f.k*f.k, mid = (1 - Math.cos(kk*Math.PI))/(2*kk);
  const sc0 = T.r*(T.star + (1 - T.star)*f.k)*(1 + (on('pulse') ? T.breath*st.bassLv*st.act*f.k : 0)), hills = f.h > .005 || f.wv > .005;
  for (let v = 0; v < NV; v++) {
    const th = G.TH[v], s = Math.sin(kk*th), c = Math.cos(kk*th), sc = th < 1e-4 || s < 1e-6 ? 1 : Math.sin(th)*kk/s, ps = G.GC[v] + G.PS[v]*sc, cp = Math.cos(ps), spn = Math.sin(ps);
    let px = s/kk*cp, py = s/kk*spn, pz = (c - 1)/kk + mid;
    if (kc > .001) { const dx = G.DIR[v*3], dy = G.DIR[v*3 + 1], dz = G.DIR[v*3 + 2]; shaped(st.lookB, dx, dy, dz, pb);
      if (m < 1) { shaped(st.lookA, dx, dy, dz, pa); for (let k = 0; k < 3; k++) pb[k] = pa[k] + (pb[k] - pa[k])*m; }
      px += (pb[0] - px)*kc; py += (pb[1] - py)*kc; pz += (pb[2] - pz)*kc; }
    const hh = hills ? height(v)/sc0 : 0;
    S3[v*3] = (px + s*cp*hh)*sc0; S3[v*3 + 1] = (py + s*spn*hh)*sc0; S3[v*3 + 2] = (pz + c*hh)*sc0;
    D[v] = st.wave >= 1 ? st.dNext : st.dPrev + (st.dNext - st.dPrev)*sm((st.wave*1.5 - AF[v])/.5);
  }
  for (let v = 0; v < NV; v++) {
    const dd = clamp(D[v], 0, F), L0 = Math.min(F - 1, Math.floor(dd)), fr = dd - L0;
    let x = 0, y = 0, z = 0;
    for (let s = 0; s < 2; s++) { const k = s ? fr : 1 - fr; if (k < 1e-4) continue; const o = (v*(F + 1) + L0 + s)*3;
      for (let j = 0; j < 3; j++) { const i = G.AI[o + j]*3, w = G.AW[o + j]*k; x += S3[i]*w; y += S3[i + 1]*w; z += S3[i + 2]*w; } }
    P3[v*3] = x; P3[v*3 + 1] = y; P3[v*3 + 2] = z;
  }
  const runLvl = -1.2 + 2.6*st.anticip, palOff = [0, st.palSpread, -st.palSpread*.8], cells = on('life') ? st.cells.out : null;
  const tx = st.tex, txP = on('surfaces') ? (st.t - tx.t0)/tx.dur : 0;
  for (let f = 0; f < NF; f++) {
    const a = G.TRI[f*3]*3, b = G.TRI[f*3 + 1]*3, c = G.TRI[f*3 + 2]*3;
    const ux = P3[b] - P3[a], uy = P3[b + 1] - P3[a + 1], uz = P3[b + 2] - P3[a + 2], wx = P3[c] - P3[a], wy = P3[c + 1] - P3[a + 1], wz = P3[c + 2] - P3[a + 2];
    let nx = uy*wz - uz*wy, ny = uz*wx - ux*wz, nz = ux*wy - uy*wx; const ln = Math.hypot(nx, ny, nz); if (ln > 1e-9) { nx /= ln; ny /= ln; nz /= ln; } else { nx = 0; ny = 0; nz = 1; }
    const fd = (D[a/3] + D[b/3] + D[c/3])/3, fl = clamp(Math.floor(fd + .5), 0, F), anc = G.FA[fl][f], cd = cen(fl, anc);
    let lit = 0;
    for (const r of st.rings) { const age = st.t - r.t0; if (age >= T.ripSecs) continue;
      const ang = Math.acos(clamp(dot(cd, r.dir), -1, 1)), x = (ang - age*Math.PI*T.ripSpeed)/T.ripW; lit += r.bright*Math.exp(-x*x)*(1 - age/T.ripSecs); }
    if (on('patterns')) {
      if (st.wedgeLit > .01) { const az = Math.atan2(cd[2], cd[0])/(2*Math.PI) + .5; if (Math.floor(az*5) % 5 === st.wedge) lit += .55*st.wedgeLit; }
      if (st.hatLit > .01 && hash(anc + fl*4096, st.hatSeed) < T.hatShare*(.4 + st.tension)) lit += .7*st.hatLit;
      if (st.anticip > 0) lit += .6*st.anticip*sm((runLvl - cd[1])/.3);
    }
    if (cells) lit += cells[G.FA[2][f]]*T.cellLit;
    lit = Math.min(lit, 1.6);
    const hp = hash(anc + fl*4096, 3), tint = hsv(st.h0 + palOff[hp < .6 ? 0 : hp < .85 ? 1 : 2] + .03*(hash(anc, 9) - .5), .6, .32);
    const off = T.explode*st.ex*st.ex*(.4 + .6*hash(anc + fl*4096, 21))*T.r + lit*.035*T.r;
    for (let j = 0; j < 3; j++) { const lv = G.EL[f*3 + j]; FE[f*3 + j] = lv === 0 ? 1 : clamp(fd - lv + 1, 0, 1); }
    FT[f] = on('surfaces') ? (Math.acos(clamp(dot(cd, tx.o), -1, 1))/Math.PI < txP ? tx.cur : tx.prev) : 0;
    FC[f*4] = tint[0]; FC[f*4 + 1] = tint[1]; FC[f*4 + 2] = tint[2]; FC[f*4 + 3] = lit;
    const nw = mul(R, nx, ny, nz); FN[f*3] = nw[0]; FN[f*3 + 1] = nw[1]; FN[f*3 + 2] = nw[2];
    for (const [k, i] of [[0, a], [1, b], [2, c]]) { const w = mul(R, P3[i] + nx*off, P3[i + 1] + ny*off, P3[i + 2] + nz*off); FV[f*9 + k*3] = w[0]; FV[f*9 + k*3 + 1] = w[1]; FV[f*9 + k*3 + 2] = w[2]; }
  }
}
// the three lamps (view space): a warm key light drifting in front, a cool rim behind, a low fill in the palette's colour
function lights(){
  const az = .55 + .6*Math.sin(st.t*.07) + .25*(st.bars/4 % 4 | 0), el = .45, key = [Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el)];
  return [key, [1.5, 1.395, 1.23], norm([-.4, .5, -.8]), [.605, .77, 1.1], norm([.2, -.8, .5]), hsv(st.h0 + st.palSpread, .7, .35 + (on('pulse') ? .8*st.kickFlash*st.act : 0))];
}

// ---- WebGL: the faces as glass, far side then near, lit per pixel; each corner's pixel height over its opposite edge gives
// the edges (no derivatives needed) ----
const VS = `attribute vec2 aS; attribute vec3 aP, aN, aD, aE; attribute vec4 aC; attribute float aT; uniform vec2 uWH;
varying vec3 vP, vN, vD, vE; varying vec4 vC; varying float vT;
void main(){ vP = aP; vN = aN; vD = aD; vE = aE; vC = aC; vT = aT; gl_Position = vec4(aS.x/uWH.x*2.0 - 1.0, 1.0 - aS.y/uWH.y*2.0, 0.0, 1.0); }`;
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vP, vN, vD, vE; varying vec4 vC; varying float vT;
uniform vec4 uCam, uL0d, uL0c, uL1d, uL1c, uL2d, uL2c, uP, uP2;
float fH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
vec3 lamp(vec3 n, vec3 V, vec3 tint, vec4 ld, vec4 lc, float fire, float sh, float kd){
  vec3 L = normalize(ld.xyz); float diff = max(dot(n, L), 0.0); vec3 R = reflect(-L, n);
  vec3 side = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
  float sr = pow(max(dot(R, normalize(V + side*fire*0.07)), 0.0), sh), sg = pow(max(dot(R, V), 0.0), sh), sb = pow(max(dot(R, normalize(V - side*fire*0.07)), 0.0), sh);
  vec3 spec = fire > 0.0 ? vec3(sr, sg, sb) : vec3(sg);
  return lc.rgb*(tint*diff*kd + spec*1.7);
}
void main(){
  if (uCam.w > 0.5) { gl_FragColor = vec4(1.0); return; }
  vec3 N = normalize(vN), V = normalize(vec3(0.0, 0.0, uCam.z) - vP); float facing = dot(N, V); bool isFar = facing < 0.0;
  if (uP2.w < 1.5 && isFar != (uP2.w < 0.5)) discard;
  vec3 n = isFar ? -N : N; float ndv = abs(facing), fres = pow(1.0 - ndv, 3.0);
  vec3 tint = vC.rgb; float lit = vC.a, lw = uP2.z, fire = uP.x, sh = 70.0, kd = 0.45, alphaAdd = 0.0;
  vec3 d = vD; float md = min(min(d.x, d.y), d.z); int k = int(vT + 0.5);
  if (k == 1) tint = tint*1.9 + 0.03;
  else if (k == 2) { vec2 g = fract(d.xy/(lw*4.5)) - 0.5; tint *= 0.15 + (1.7 + 2.0*lit)*smoothstep(0.32, 0.12, length(g)); }
  else if (k == 3) { tint = mix(tint, vec3(0.32), 0.5)*(0.75 + 0.5*fH(vec2(floor(d.x/(lw*0.5)), floor(d.y/(lw*14.0))))); sh = 18.0; kd = 1.1; fire = 0.0; }
  else if (k == 4) { tint = mix(tint, vec3(0.45, 0.55, 0.65), 0.45) + vec3(0.06, 0.08, 0.1)*step(0.86, fH(floor(d.xy/(lw*0.8)))); alphaAdd = 0.2; }
  else if (k == 5) { vec3 r = reflect(-V, n); tint = mix(vec3(0.015, 0.016, 0.02), vec3(0.32, 0.36, 0.45), smoothstep(-0.15, 0.5, r.y)) + vec3(0.25, 0.2, 0.15)*exp(-abs(r.y)*12.0); alphaAdd = 0.25; }
  else if (k == 6) tint = (0.5 + 0.5*cos(6.2831*(ndv*1.4 + vec3(0.0, 0.33, 0.67) + tint.r)))*0.4;
  vec3 c = tint*(uP2.x*(0.55 + 0.45*n.y) + lit*1.3);
  c += lamp(n, V, tint, uL0d, uL0c, fire, sh, kd) + lamp(n, V, tint, uL1d, uL1c, fire, sh, kd) + lamp(n, V, tint, uL2d, uL2c, 0.0, sh, kd);
  c += (tint*1.5 + 0.1)*fres*uP2.y;
  if (k == 1) c *= mix(0.04, 1.0, smoothstep(lw*1.2, lw*3.0, md));
  vec3 line = (1.0 - smoothstep(vec3(0.5), vec3(1.6), d))*vE, glow = exp(-d/5.0)*0.3*vE;
  float e = max(max(line.x + glow.x, line.y + glow.y), line.z + glow.z);
  c += mix(vC.rgb*2.2, vec3(1.0), vec3(0.3))*(0.7 + 2.2*lit)*uP.y*e;
  float a = clamp(uP.z + fres*0.45 + lit*0.25 + alphaAdd, 0.0, 1.0);
  if (isFar) { c *= uP.w; a *= 0.6; }
  gl_FragColor = vec4(c*uCam.y, a*min(1.0, uCam.y));
}`;
const NA_ = 20, ATTRS = [['aS', 2, 0], ['aP', 3, 2], ['aN', 3, 5], ['aD', 3, 8], ['aE', 3, 11], ['aC', 4, 14], ['aT', 1, 18]];
const SC = new Float32Array(NF*9), ZF = new Float32Array(NF), NEAR = new Uint8Array(NF);   // (NEAR: a face at or behind the camera, left out)
// each corner on screen (px) and its depth; the faces sorted far to near
function project(U, W, H){
  const sc = H*U.size*FOCAL, ox = W/2 + U.pos[0]*H, oy = H/2 - U.pos[1]*H, cam = CAM;
  for (let f = 0; f < NF; f++) { let z = 0; NEAR[f] = 0;
    for (let k = 0; k < 3; k++) { const i = f*9 + k*3; if (cam - FV[i + 2] < .15/Math.max(.2, U.size*2)) NEAR[f] = 1; const dz = Math.max(.06, cam - FV[i + 2]), w = sc/dz; SC[i] = ox + FV[i]*w; SC[i + 1] = oy - FV[i + 1]*w; SC[i + 2] = FV[i + 2]; z += FV[i + 2]; }
    ZF[f] = z/3; }
}
function glDrawer(gl){
  const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error('jewel: ' + gl.getShaderInfoLog(x)); return x; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS));
  ATTRS.forEach(([n], i) => gl.bindAttribLocation(p, i + 1, n));   // (attribute 0 stays the engine's full-screen quad)
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('jewel: ' + gl.getProgramInfoLog(p));
  const u = {}; for (const k of ['uWH', 'uCam', 'uL0d', 'uL0c', 'uL1d', 'uL1c', 'uL2d', 'uL2c', 'uP', 'uP2']) u[k] = gl.getUniformLocation(p, k);
  const buf = gl.createBuffer(), arr = new Float32Array(NF*3*NA_);
  return (U, W, H, stage) => {
    project(U, W, H);
    let o = 0;
    for (let f = 0; f < NF; f++) {
      if (NEAR[f]) { arr.fill(0, o, o + 3*NA_); o += 3*NA_; continue; }
      const ax = SC[f*9], ay = SC[f*9 + 1], bx = SC[f*9 + 3], by = SC[f*9 + 4], cx = SC[f*9 + 6], cy = SC[f*9 + 7];
      const a2 = Math.abs((bx - ax)*(cy - ay) - (by - ay)*(cx - ax)), h = [a2/(Math.hypot(cx - bx, cy - by) || 1), a2/(Math.hypot(ax - cx, ay - cy) || 1), a2/(Math.hypot(bx - ax, by - ay) || 1)];
      for (let k = 0; k < 3; k++) { const i = f*9 + k*3;
        arr[o] = SC[i]; arr[o + 1] = SC[i + 1]; arr[o + 2] = FV[i]; arr[o + 3] = FV[i + 1]; arr[o + 4] = FV[i + 2];
        arr[o + 5] = FN[f*3]; arr[o + 6] = FN[f*3 + 1]; arr[o + 7] = FN[f*3 + 2];
        arr[o + 8] = k === 0 ? h[0] : 0; arr[o + 9] = k === 1 ? h[1] : 0; arr[o + 10] = k === 2 ? h[2] : 0;
        arr[o + 11] = FE[f*3]; arr[o + 12] = FE[f*3 + 1]; arr[o + 13] = FE[f*3 + 2];
        arr[o + 14] = FC[f*4]; arr[o + 15] = FC[f*4 + 1]; arr[o + 16] = FC[f*4 + 2]; arr[o + 17] = FC[f*4 + 3]; arr[o + 18] = FT[f];
        o += NA_; }
    }
    gl.useProgram(p);
    const Lt = U.lights, T = TUNE.jewel;
    gl.uniform2f(u.uWH, W, H); gl.uniform4f(u.uCam, 0, U.w*T.gain, CAM, stage === 'cover' ? 1 : 0);
    ['uL0d', 'uL0c', 'uL1d', 'uL1c', 'uL2d', 'uL2c'].forEach((k, i) => gl.uniform4f(u[k], Lt[i][0], Lt[i][1], Lt[i][2], 0));
    gl.uniform4f(u.uP, T.fire, 1, .2, .45);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    gl.disableVertexAttribArray(0);
    ATTRS.forEach(([, n, at], i) => { gl.enableVertexAttribArray(i + 1); gl.vertexAttribPointer(i + 1, n, gl.FLOAT, false, NA_*4, at*4); });
    gl.enable(gl.BLEND);
    if (stage === 'cover') { gl.blendFunc(gl.ONE, gl.ZERO); gl.uniform4f(u.uP2, .45, .6, T.line*H/720, 2); gl.drawArrays(gl.TRIANGLES, 0, NF*3); }
    else { gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); for (let side = 0; side < 2; side++) { gl.uniform4f(u.uP2, .45, .6, T.line*H/720, side); gl.drawArrays(gl.TRIANGLES, 0, NF*3); } }
    ATTRS.forEach((_, i) => gl.disableVertexAttribArray(i + 1)); gl.enableVertexAttribArray(0);
    gl.disable(gl.BLEND);
  };
}
// simple mode: the faces far to near, each lit flat by the same lamps, then its edges
const ORD = Uint16Array.from({length: NF}, (_, i) => i);
const rgba = (r, g, b, a) => `rgba(${Math.min(255, r*255 | 0)},${Math.min(255, g*255 | 0)},${Math.min(255, b*255 | 0)},${clamp(a, 0, 1).toFixed(3)})`;
function draw2d(o, U){
  const W = o.canvas.width, H = o.canvas.height; project(U, W, H);
  ORD.sort((a, b) => ZF[a] - ZF[b]);
  const Lt = U.lights, T = TUNE.jewel, w = U.w*T.gain;
  o.save(); o.lineJoin = 'round'; o.lineWidth = Math.max(1, T.line*H/720*.7);
  for (let n = 0; n < NF; n++) {
    const f = ORD[n]; if (NEAR[f]) continue;
    const nx = FN[f*3], ny = FN[f*3 + 1], nz = FN[f*3 + 2], far = nz < 0, s = far ? -1 : 1, lit = FC[f*4 + 3];
    let r = 0, g = 0, b = 0; const amb = .45*(.55 + .45*ny*s);
    for (let i = 0; i < 3; i++) { const l = Lt[i*2], c = Lt[i*2 + 1], d = Math.max(0, (nx*l[0] + ny*l[1] + nz*l[2])*s)*.45; r += c[0]*d; g += c[1]*d; b += c[2]*d; }
    const k = (1 - Math.abs(nz))**3*.6, m = far ? .45 : 1;
    const cr = (FC[f*4]*(amb + lit*1.3 + r + 1.5*k) + .1*k)*m*w, cg = (FC[f*4 + 1]*(amb + lit*1.3 + g + 1.5*k) + .1*k)*m*w, cb = (FC[f*4 + 2]*(amb + lit*1.3 + b + 1.5*k) + .1*k)*m*w;
    const a = (.2 + .45*k + lit*.25)*(far ? .6 : 1)*w;
    o.beginPath(); o.moveTo(SC[f*9], SC[f*9 + 1]); o.lineTo(SC[f*9 + 3], SC[f*9 + 4]); o.lineTo(SC[f*9 + 6], SC[f*9 + 7]); o.closePath();
    o.fillStyle = rgba(cr/Math.max(a, .05), cg/Math.max(a, .05), cb/Math.max(a, .05), a); o.fill();
    for (let j = 0; j < 3; j++) { const e = FE[f*3 + j]; if (e < .05) continue;   // (each edge as strong as its level allows)
      const q = (.7 + 2.2*lit)*m*w*e*.5, p0 = f*9 + ((j + 1) % 3)*3, p1 = f*9 + ((j + 2) % 3)*3;
      o.strokeStyle = rgba(Math.min(1, FC[f*4]*2.2*.7 + .3)*q, Math.min(1, FC[f*4 + 1]*2.2*.7 + .3)*q, Math.min(1, FC[f*4 + 2]*2.2*.7 + .3)*q, Math.min(1, q + .15));
      o.beginPath(); o.moveTo(SC[p0], SC[p0 + 1]); o.lineTo(SC[p1], SC[p1 + 1]); o.stroke(); }
  }
  o.restore();
}

export default {
  key: 'jewel', kind: 'object', label: 'Prism', optIn: true,
  words: 'A glass prism tours its shapes, opens into a star and mountains, and lights in patterns with the music',
  stats: '20 to 1,280 facets, sixteen shapes, four open forms, seven surfaces, five kinds of life on its facets',
  // (a plain mesh of the closed gem's finest facets, for the tests and the Asset Viewer)
  get mesh(){ const pos = Array.from(G.DIR, x => x*.45); return this._m || (this._m = {pieces: [{pos, tri: Array.from(G.TRI), part: Array.from({length: NF}, (_, f) => 1 + G.FA[0][f] % 6)}], hinge: [0, 0, 0]}); },
  onBeat(pos){ st.pos = pos; if (pos === 0) { st.bars++;
    if (on('life')) touch(st.cells, st.rule, symCells(.3*Math.sin(st.bars*.7), st.bars*1.6), .8);   // (the bar seeds the life at five points round it)
    if (st.steady && st.bars % 4 === 0) onPhrase(); } },
  breakApart(){ st.ex = 1; st.exHold = .25; },
  layers: () => TUNE.jewel.on,
  state: () => st,   // (tests)
  params(P, x){
    const T = TUNE.jewel, J = x.J, dt = x.dt, w = P.o.jewel || 0;
    st.t += dt;
    st.steady = (J && J.on && J.beatClear != null ? J.beatClear : 1) > .5;
    st.period = S.beatPeriod > .2 ? S.beatPeriod : .5;
    st.tension = J ? J.tension || 0 : .3;
    st.anticip = (J && J.anticip) || 0;
    st.inBreak = !!L.brk;
    st.bassLv = clamp((P.bass || 0)*(x.react ?? 1), 0, 1);
    if (w < .003) { st.off = true; st.lastDrop = J ? J.lastDrop : null; return; }
    if (st.off) { st.off = false; st.ex = 1; st.exHold = 0; }   // arriving: it gathers out of its facets
    // the music's moments
    if (J && st.lastDrop !== undefined && J.lastDrop !== st.lastDrop && J.lastDrop != null) drop(!st.steady);
    st.lastDrop = J ? J.lastDrop : null;
    if (J && J.on && J.type !== st.type) { st.type = J.type; if (on('surfaces') && rand() < .5) newTex(false); if (on('life')) newRule(); }
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; if (st.steady) kick(); }
    if (x.hit > .8 && st.lastHit <= .8) {   // stabs: the wedge steps on; spots and stripes seeded at five points
      if (on('patterns') && st.act > .25) { st.wedge = (st.wedge + 1) % 5; st.wedgeLit = 1; }
      if (on('life') && (st.rule === 'spots' || st.rule === 'stripes')) touch(st.cells, st.rule, symCells(-.4, st.wedge*1.257), .6);
      if (!st.steady && on('pulse')) ring(rand() < .5 ? front() : ICO[Math.floor(rand()*12)], .35); }
    st.lastHit = x.hit;
    const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : -1;
    if (s16 !== st.s16) { st.s16 = s16; if (SIG.hat > .35) { st.hatSeed++; st.hatLit = Math.min(1, SIG.hat*1.3); } }
    if ((!st.steady && st.t - st.lastPhraseT > 16) || st.t - st.lastPhraseT > 40) onPhrase();   // (music played freely, or no bars: its own unhurried phrases)
    if (st.inBreak && !st.wasBreak && on('open')) st.form = 'star';   // (a breakdown lays it down as a star)
    st.wasBreak = st.inBreak;
    if (!on('open')) st.form = 'gem';
    // how much may move
    const sinceDrop = st.t - st.lastDropAt, dropBoost = Math.max(0, 1 - sinceDrop/Math.max(8, st.period*32))*.6;
    let goal = T.actBase + .35*st.tension + .5*st.anticip + dropBoost;
    if (st.inBreak) goal *= T.actBrk; if (!st.steady) goal *= T.actFree;
    goal = clamp(goal, 0, 1);
    st.act += (goal - st.act)*Math.min(1, dt*(goal > st.act ? .6 : .25));
    const fa = 1 - Math.exp(-dt/(T.morphSecs*(st.steady ? .35 : .5))), FT0 = FORMS[st.form];
    for (const k of ['k', 'h', 'wv', 'pitch', 'yw']) st.f[k] += (FT0[k] - st.f[k])*fa;
    let d = 1;
    if (on('detail')) { if (st.steady && st.kicks >= 32) d = 2; if (st.act > .65 || st.anticip > .5) d = 3; if (dropBoost > .3) d = 3; if (st.inBreak || !st.steady) d = 1; }
    if (on('open')) d = Math.max(d, FT0.det);
    setDetail(d);
    if (st.t - st.kickT > 4) st.kicks = 0;
    st.wave = Math.min(1, st.wave + dt/Math.max(1.5, st.period*4));
    st.morph = Math.min(1, st.morph + dt/(T.morphSecs*(st.steady ? 1 : 1.5)));
    if (st.exHold > 0) st.exHold -= dt; else st.ex = Math.max(0, st.ex - dt/T.explodeSecs);
    st.wedgeLit *= Math.exp(-dt/.5); st.hatLit *= Math.exp(-dt/.2); st.kickFlash *= Math.exp(-dt/.12);
    st.h0 += dt*.004;
    if (on('life')) { const C = TUNE.prism.cells; stepCells(st.cells, st.rule, dt, C, st.period, C.flyK + (C.flyKBuild - C.flyK)*st.anticip, rand); }
    // its turn: a slow spin (an open form round its face), tipped as its form asks
    const sp = T.spin*(.4 + st.act)*(st.steady ? 1 : .5);
    st.yaw += dt*sp*st.f.yw; st.roll += dt*sp*(1 - st.f.yw)*.6;
    st.pitch += (st.f.pitch - st.pitch)*Math.min(1, dt*1.5);
    const Vw = S.view; if (Vw && Vw.key === 'jewel') { st.yaw = Vw.yaw; st.pitch = st.f.pitch + Vw.pitch; }   // (turned by hand in the Asset Viewer)
    build(rot());
    const An = P.anchor;
    P.m = P.m || {};
    P.m.jewel = {w: An && An.hide ? 0 : Math.min(1, w*1.2)*(x.dim ?? 1), size: (An && An.size || T.size)*(Vw && Vw.key === 'jewel' ? Vw.zoom : 1),
      pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, (st.f.pitch < 0 ? -.04 : .02) + P.wind.y*TUNE.ctx.windObject], lights: lights()};
  },
  drawGL(gl, P, W, H, stage){ if (stage === 'trails') return;
    const U = P.m.jewel; if (!U || U.w < .003) return;
    if (!this._dr || this._gen !== S.glGen) { this._dr = glDrawer(gl); this._gen = S.glGen; }
    this._dr(U, W, H, stage); },
  draw2d(o, P){ const U = P.m.jewel; if (U && U.w > .003) draw2d(o, U); },
  path2d(o, P){ const U = P.m.jewel; if (!U) return; project(U, o.canvas.width, o.canvas.height); o.beginPath();
    for (let f = 0; f < NF; f++) { o.moveTo(SC[f*9], SC[f*9 + 1]); o.lineTo(SC[f*9 + 3], SC[f*9 + 4]); o.lineTo(SC[f*9 + 6], SC[f*9 + 7]); o.closePath(); } },
};
