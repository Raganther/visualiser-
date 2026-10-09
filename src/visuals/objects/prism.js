// The prism: a faceted gem that grows and sheds facets, morphs from shape to shape, and lights its facets in patterns, each
// part of the music its own (render/facet.js draws it). The user loved watching the symmetrical faceted objects, the way
// their facets light up, and asked for one that moves, adds facets and morphs, its facets lighting in combinations with
// different parts of the music changing them in different ways:
// - its shape blends between two of nine (ball, octahedron, cube, gem, star, flower, disc, pill, a wobbling blob), a new
//   one coming in on each phrase line; a breakdown rounds it, a drop snaps it to a star for a couple of bars;
// - its facets: 20 to 1,280, more as the music builds; a change of detail sweeps across it as a front of new facets;
// - the kick sends a ring of light (and a ripple that lifts the facets) out from a new point each time, or seeds a
//   cascade that spreads from facet to facet until it meets itself; stabs step lit wedges round it, or flip a checker;
//   the hi-hats light a new random handful each 16th; the melody turns a spiral; the bass breathes it;
// - the layers come in as a section runs (sequenced: the kick's from the start, the stabs' after 4 bars, the hats' after 8,
//   a life-like pattern after 12, facets pushing out after 16), and a returning section brings its own back;
// - sequences in the music trigger more: 16 kicks in a row add a level of facets and send a wave of light pole to pole,
//   a burst of stabs spins the wedges, the hats coming in scatter sparks; in a drop's run-up it fills with light from the
//   bottom up as the drop nears; the drop shatters it into its facets, which fly back together.
// Look: the objects' style setting (glass, solid, outline, hologram). Tuning in TUNE.prism.
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { hsv2rgb } from '../../util.js';
import { DANCE } from '../../scene/dance.js';
import { SIG } from '../../scene/signals.js';
import { L } from '../../audio/listen.js';
import { facetGeo, facetPlace, facetGL, facet2d, facetPath2d } from '../../render/facet.js';

const G = facetGeo(3), AL = 2;   // the automata (cascades, life) run on the 320 facets of level 2
const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0)/4294967296; };
// its own random numbers (Journey's draws stay untouched)
let seed = 1; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
const pick = a => a[Math.floor(rnd()*a.length)];
const tids = new WeakMap(); let tidN = 0; const tid = t => t == null ? 0 : tids.get(t) || (tids.set(t, ++tidN), tidN);   // a section type's own number (types are objects)

const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x*x*(3 - 2*x);
const ICO = (() => { const t = (1 + Math.sqrt(5))/2, l = Math.hypot(1, t); return [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => p.map(x => x/l)); })();

// the shapes: a radius for each direction (about 1 on average)
export const SHAPES = {
  ball: () => 1,
  octa: (x, y, z) => 1.25/(Math.abs(x) + Math.abs(y) + Math.abs(z)),
  cube: (x, y, z) => .8/Math.max(Math.abs(x), Math.abs(y), Math.abs(z)),
  gem: (x, y, z) => { const r = Math.hypot(x, z); return Math.min(1.05/(r*.8 + Math.abs(y)*.95), y > 0 ? .55/y : 9); },
  star: (x, y, z) => { let m = 0; for (const a of ICO) m = Math.max(m, a[0]*x + a[1]*y + a[2]*z); return .78 + .95*Math.pow(m, 28); },
  flower: (x, y, z) => .85 + .3*Math.cos(5*Math.atan2(z, x))*(1 - Math.abs(y)) + .12*y,
  disc: (x, y, z) => 1/Math.hypot(x*.95, z*.95, y*2),
  pill: (x, y, z) => .8/Math.hypot(x, z, y*.55),
  blob: (x, y, z, t) => 1 + .2*Math.sin(3*x + t)*Math.sin(3*y + t*1.3)*Math.sin(3*z + t*.7),
};
const NAMES = Object.keys(SHAPES), CALM = ['ball', 'pill', 'disc', 'blob', 'flower'], SHARP = ['octa', 'cube', 'gem', 'star'];
const MODES = {kick: ['ripple', 'cascade', 'pulse'], stab: ['sectors', 'checker', 'bands']};

const nv = G.nv, nf = G.nf;
const R = new Float32Array(nv), D = new Float32Array(nv), X = {};
X.fill = new Float32Array(nf*4); X.edge = new Float32Array(nf*3); X.eA = new Float32Array(nf*3); X.off = new Float32Array(nf*3);
// the level-2 automata: a cascade (an excitable medium: a lit facet lights its neighbours next 16th, then rests) and life
const NA = G.NF[AL], ADJ = G.ADJ[AL], age = new Float32Array(NA).fill(99), life = new Uint8Array(NA);
const N2 = []; for (let c = 0; c < NA; c++) { const s = new Set(); for (let j = 0; j < 3; j++) { const n = ADJ[c*3 + j]; s.add(n); for (let k = 0; k < 3; k++) s.add(ADJ[n*3 + k]); } s.delete(c); N2.push([...s]); }
const casc = new Float32Array(NA), lifeL = new Float32Array(NA), lv = [new Float32Array(G.NF[0]), new Float32Array(G.NF[1])], lv2 = [new Float32Array(G.NF[0]), new Float32Array(G.NF[1])];
// a level-2 value seen at another level: averaged over a coarse facet's descendants (children of g are 4g..4g+3)
function down(src, o0, o1){ for (let g = 0; g < G.NF[1]; g++) o1[g] = (src[g*4] + src[g*4 + 1] + src[g*4 + 2] + src[g*4 + 3])/4; for (let g = 0; g < G.NF[0]; g++) o0[g] = (o1[g*4] + o1[g*4 + 1] + o1[g*4 + 2] + o1[g*4 + 3])/4; }
const nearestCell = (d) => { let b = 0, bd = -2; const C = G.CEN[AL]; for (let c = 0; c < NA; c++) { const v = C[c*3]*d[0] + C[c*3 + 1]*d[1] + C[c*3 + 2]*d[2]; if (v > bd) { bd = v; b = c; } } return b; };
const randDir = () => { const z = rnd()*2 - 1, a = rnd()*Math.PI*2, r = Math.sqrt(1 - z*z); return [r*Math.cos(a), z, r*Math.sin(a)]; };

const st = {sA: 'ball', sB: 'octa', mix: 0, mixT: 0, det: 1, dFrom: 1, dTo: 1, wipe: 1, wAx: [0, 1, 0], ex: 0, exT: 0, off: true, hue: 0,
  rip: [], sec: 0, secT: -9, chk: 0, chkT: -9, band: 0, s16: -1, t: 0, bars: 0, secBars: 0, type: null, prog: null, progs: {},
  run: 0, lastBeatT: 0, stabs: [], spinT: -9, hatWas: 0, burstT: -9, waveT: -9, dropT: -9, lastDrop: null, lastHit: 0, glow: 0, jOn: false, kickT: -9};
// a section's program: its shapes, how many facets, which pattern each part of the music plays, the axis its wedges turn on
function programFor(type, T){
  const id = tid(type); if (id && st.progs[id]) return st.progs[id];
  seed = 1 + Math.floor(hashStr('t' + id)*2147483000);
  const sharp = T > .5, pool = sharp ? SHARP.concat(['blob']) : CALM.concat(['octa', 'gem']);
  const p = {shapes: [pick(pool), pick(NAMES)], det: sharp ? 1.6 + rnd()*1.2 : .6 + rnd()*1.3, kick: pick(MODES.kick), stab: pick(MODES.stab), axis: randDir(),
    n: pick([3, 4, 5, 6, 8]), spiral: [pick([1, 2, 3]), pick([2, 3, 5])], life: rnd() < .6, extrude: .5 + rnd()*.8, seed: rnd()*1000};
  if (id) st.progs[id] = p;
  return p;
}
const shapeAt = (k, x, y, z, t) => SHAPES[k](x, y, z, t);
// for tests: its state and a section's program
export const prismState = () => ({det: st.dTo, wipe: st.wipe, shapes: [st.sA, st.sB], mix: st.mix, X, D, prog: st.prog});
export const prismProgram = (type, T) => programFor(type, T);

export default {
  key: 'prism', kind: 'object', label: 'Prism', words: 'A faceted prism morphs and lights its facets with the music', optIn: true,
  dance: {moves: {face: 2.5, spin: 1.3, float: 1, rise: .8, approach: 1, pulse: 1, still: .5, groove: .5, bang: .3, look: .3}, sym: 5, liftPart: 1},
  // (a plain mesh of its finest facets, for the tests and the Asset Viewer)
  get mesh(){ const pos = Array.from(G.DIR, x => x*.45); return this._m || (this._m = {pieces: [{pos, tri: Array.from(G.TRI), part: Array.from({length: nf}, (_, f) => 1 + G.FA[0][f] % 6)}], hinge: [0, 0, 0]}); },
  stats: '20 to 1,280 facets, nine shapes',
  onBeat(pos){
    st.beat = pos; st.run++;
    if (pos === 0) { st.bars++; st.secBars++; st.glow = 1; }
    if (st.prog && st.prog.life && st.secBars >= 12) stepLife();
  },
  breakApart(){ st.exT = 1; },
  params(P, x){
    const T = TUNE.prism, J = x.J, dt = x.dt, w = P.o.prism || 0, ten = J ? J.tension || 0 : .5;
    st.t += dt;
    // the section: a new program, its layers sequenced in again
    const type = J && J.on ? J.type : null;
    if (type !== st.type || !st.prog) { st.type = type; st.prog = programFor(type, ten); st.secBars = 0;
      flipTo(st.prog.shapes[0]);
      setDetail(st.prog.det + ten*T.detTension); }
    const pr = st.prog;
    // a drop: shatter, a star for a while, every facet
    if (J && st.lastDrop !== null && J.lastDrop !== st.lastDrop) { if (J.on) st.exT = 1; st.dropT = st.t; setDetail(3, 1); flipTo('star'); }
    st.lastDrop = J ? J.lastDrop : null;
    if (w < .003) { st.off = true; return; }
    if (st.off) { st.off = false; st.ex = st.exT = 1; }   // arriving: it assembles out of its facets
    st.exT *= Math.exp(-dt/T.explodeSecs); st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
    // the 16ths (on the beat grid's bar ramp; without a lock, the beats alone)
    const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : (st.run*4) % 16;
    if (s16 !== st.s16) { st.s16 = s16; step16(s16, x, ten); }
    // the kick
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; kick(ten); }
    // stabs: a step of the wedges or a flip of the checker; three in a bar spin the wedges for a bar
    if (x.hit > .8 && st.lastHit <= .8) { st.sec++; st.secT = st.t; st.chk ^= 1; st.chkT = st.t; st.hue += .11;
      st.stabs = st.stabs.filter(t => st.t - t < 4*S.beatPeriod); st.stabs.push(st.t); if (st.stabs.length >= 3) st.spinT = st.t; }
    st.lastHit = x.hit;
    // the hats coming in scatter sparks and add a level of facets
    if (SIG.hat > .45 && st.hatWas < .2 && st.secBars >= 2) { st.burstT = st.t; setDetail(st.det + 1); }
    st.hatWas = SIG.hat > .45 ? SIG.hat : Math.min(st.hatWas, SIG.hat);
    // a phrase line (every 4 bars of the section): the next shape comes in
    if (st.secBars > 0 && st.secBars % 4 === 0 && st.phr !== st.bars) { st.phr = st.bars; if (!L.brk) flipTo(pick(ten > .5 ? SHARP.concat(NAMES) : CALM.concat(NAMES))); }
    // a breakdown rounds it and sheds facets; after a drop, back to the section's own
    if (L.brk && !st.brk) { flipTo(pick(CALM)); setDetail(.3 + rnd()*.6); }
    if (!L.brk && st.brk) setDetail(pr.det + ten*T.detTension);
    st.brk = L.brk;
    if (st.t - st.dropT > 8*S.beatPeriod && st.t - st.dropT < 8*S.beatPeriod + dt*1.5) setDetail(pr.det + ten*T.detTension);
    st.mix += (st.mixT - st.mix)*Math.min(1, dt/T.morphSecs*2.5);
    st.wipe = Math.min(1, st.wipe + dt/(T.wipeBeats*S.beatPeriod));
    st.glow *= Math.exp(-dt*3);
    shape(P, x, ten);
    light(P, x, ten);
    // where it stands and how it turns (its dance on top), as the mesh objects do
    const An = P.anchor, d = DANCE.obj.prism;
    const U = P.m = P.m || {};
    const u = U.prism = {rot: x.t*T.spin*(1 - .6*TUNE.dance.amount) + (st.t - st.spinT < 4*S.beatPeriod ? (st.t - st.spinT)*2 : 0), pitch: .25 + Math.sin(x.t*.23)*.15, roll: 0,
      size: (An && An.size || T.size)*(1 + (P.bass || 0)*x.react*.04), pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, .02 + P.wind.y*TUNE.ctx.windObject],
      line: TUNE.mesh.line, w: An && An.hide ? 0 : Math.min(1, w*1.2), X};
    if (d) { u.rot += d.yaw; u.pitch += d.pitch; u.roll = d.roll; u.pos = [u.pos[0] + d.dx, u.pos[1] + d.dy]; u.size *= d.s; u.sq = d.sq; }
    const Vw = S.view; if (Vw && Vw.key === 'prism') { u.rot = Vw.yaw + (d ? d.yaw : 0); u.pitch += Vw.pitch; u.size *= Vw.zoom; }
    colour(P, x, u, w);
  },
  drawGL(gl, P, W, H, stage){ if (stage === 'trails') return;
    if (!this._gl || this._gen !== S.glGen) { this._gl = facetGL(gl, G); this._gen = S.glGen; } this._gl(X, P.m.prism, W, H, stage); },
  draw2d(o, P){ facet2d(o, G, X, P.m.prism); },
  path2d(o, P){ facetPath2d(o, G, X, P.m.prism); },
};

// ---- the shape: each vertex's radius (two shapes blended, the bass breathing, the kick's ripples lifting it) and detail ----
function shape(P, x, ten){
  const T = TUNE.prism, Dr = G.DIR, m = smooth(st.mix), t = x.t, br = 1 + (P.bass || 0)*x.react*T.breath, wa = st.wAx, wf = -1.3 + st.wipe*2.6;
  for (let v = 0; v < nv; v++) {
    const dx = Dr[v*3], dy = Dr[v*3 + 1], dz = Dr[v*3 + 2];
    let r = shapeAt(st.sA, dx, dy, dz, t)*(1 - m) + shapeAt(st.sB, dx, dy, dz, t)*m;
    for (const q of st.rip) { const th = Math.acos(Math.max(-1, Math.min(1, dx*q.o[0] + dy*q.o[1] + dz*q.o[2]))), a = st.t - q.t, rr = a*T.ripSpeed;
      r *= 1 + T.ripLift*q.k*Math.exp(-(((th - rr)/.22)**2))*Math.max(0, 1 - a/T.ripSecs); }
    R[v] = r*br*.45;
    // detail: the old level, a front of the new one sweeping across along the wipe's axis
    const s = smooth((dx*wa[0] + dy*wa[1] + dz*wa[2] - wf)/-.5 + .5);
    D[v] = st.dFrom + (st.dTo - st.dFrom)*(1 - s);
  }
  facetPlace(G, R, D, X);
  st.det = st.dTo;
}
function setDetail(d, now){ d = Math.max(0, Math.min(3, d)); if (Math.abs(d - st.dTo) < .05) return;
  st.dFrom = now ? d : st.dFrom + (st.dTo - st.dFrom)*Math.min(1, st.wipe); st.dTo = d; st.wipe = now ? 1 : 0; st.wAx = randDir(); }
function flipTo(k){ if (st.mixT > .5) { st.sA = k; st.mixT = 0; } else { st.sB = k; st.mixT = 1; } }

// ---- what the music does on its beats ----
function kick(ten){
  const pr = st.prog; if (!pr) return;
  const o = randDir();
  if (pr.kick === 'cascade' && st.secBars >= 0) { const c = nearestCell(o); age[c] = 0; }
  st.rip.push({o, t: st.t, k: .6 + ten*.6}); if (st.rip.length > 4) st.rip.shift();
  // a run of kicks: every 16 in a row adds facets and sends a wave of light from pole to pole
  if (st.t - st.lastBeatT > 2.5*S.beatPeriod + .2) st.kicks = 0;
  st.kicks = (st.kicks || 0) + 1; st.lastBeatT = st.t;
  if (st.kicks % 16 === 0) { st.waveT = st.t; setDetail(st.det + .7); }
}
function step16(s16, x, ten){
  // the cascade: lit facets light their neighbours, then rest a while (so rings run out and meet)
  for (let c = 0; c < NA; c++) casc[c] = age[c];
  for (let c = 0; c < NA; c++) { if (casc[c] < 4) { age[c] = casc[c] + 1; continue; }
    let lit = false; for (let j = 0; j < 3; j++) if (casc[ADJ[c*3 + j]] === 0) lit = true;
    age[c] = lit ? 0 : Math.min(99, casc[c] + 1); }
  if (s16 % 4 === 0) st.band++;
}
// life on the facets (each counts the dozen or so round it): born with 3 or 4 alive, lives with 2 to 4; reseeded by stabs
function stepLife(){
  let alive = 0; const nx = new Uint8Array(NA);
  for (let c = 0; c < NA; c++) { let n = 0; for (const k of N2[c]) n += life[k]; nx[c] = life[c] ? (n >= 2 && n <= 4 ? 1 : 0) : (n === 3 || n === 4 ? 1 : 0); alive += nx[c]; }
  life.set(nx);
  if (alive < 8 || st.t - st.secT < .05) for (let i = 0; i < 40; i++) life[Math.floor(hash(st.run*7.3 + i)*NA)] = 1;
}

// ---- light: every facet's from each part of the music, then its colours ----
const LK = new Float32Array(nf), LS = new Float32Array(nf), LH = new Float32Array(nf), LM = new Float32Array(nf), LL = new Float32Array(nf), LP = new Float32Array(nf);
function light(P, x, ten){
  const T = TUNE.prism, pr = st.prog, sb = st.secBars, bp = S.beatPeriod, C = G.CEN, FA = G.FA, fl = X.fl;
  for (let c = 0; c < NA; c++) { casc[c] = age[c] < 99 ? Math.exp(-age[c]*.7) : 0; lifeL[c] = life[c]; }
  down(casc, lv[0], lv[1]); down(lifeL, lv2[0], lv2[1]);
  const ax = pr.axis, n = pr.n, spinning = st.t - st.spinT < 4*bp, hats = Math.min(1, SIG.hat*1.4), on = k => sb >= T.layerBars[k];
  const anticip = (x.J && x.J.anticip) || 0, meterOn = anticip > .02, wave = Math.max(0, 1 - (st.t - st.waveT)/(4*bp)), burst = Math.max(0, 1 - (st.t - st.burstT)/(2*bp));
  for (let f = 0; f < nf; f++) {
    const L0 = fl[f], g = FA[L0][f], cx = C[L0][g*3], cy = C[L0][g*3 + 1], cz = C[L0][g*3 + 2], key = L0*100000 + g;
    // the kick: rings of light, a cascade, or the whole thing pulsing
    let k = 0;
    if (pr.kick === 'pulse') k = SIG.kick*(.5 + .5*hash(key + st.run));
    for (const q of st.rip) { const th = Math.acos(Math.max(-1, Math.min(1, cx*q.o[0] + cy*q.o[1] + cz*q.o[2]))), a = st.t - q.t; k = Math.max(k, q.k*Math.exp(-(((th - a*T.ripSpeed)/.25)**2))*Math.max(0, 1 - a/T.ripSecs)*(pr.kick === 'cascade' ? .4 : 1)); }
    if (pr.kick === 'cascade') k = Math.max(k, L0 >= AL ? casc[FA[AL][f]] : lv[L0][g]);
    LK[f] = k;
    // stabs: wedges round the axis stepping on, or a checker flipping (the centre facets against the corners), or a band
    let s = 0;
    if (on('stab')) {
      const fade = Math.exp(-(st.t - (pr.stab === 'checker' ? st.chkT : st.secT))*2.5);
      if (pr.stab === 'sectors' || spinning) { const ux = ax[1]*cz - ax[2]*cy, uy = ax[2]*cx - ax[0]*cz; const a = (Math.atan2(uy, ux)/(2*Math.PI) + 1)*n + (spinning ? (st.t - st.spinT)*6 : 0); s = Math.floor(a % n) === st.sec % n ? .4 + .6*fade : 0; }
      else if (pr.stab === 'checker') s = (G.CH[L0][g] === 3) === !!st.chk ? .25 + .75*fade : 0;
      else { const b = Math.floor(((cx*ax[0] + cy*ax[1] + cz*ax[2]) + 1)/2*6); s = b === st.band % 6 ? .7 : 0; }
    }
    LS[f] = s;
    // the hats: a new random handful each 16th, and a burst of sparks as they come in
    LH[f] = on('hat') || burst ? (hash(key*1.37 + st.s16*17.1 + st.bars*3.3) < hats*T.hatShare + burst*.4 ? 1 : 0) : 0;
    // the melody: a spiral turning with the mids; the pole-to-pole wave after a run of kicks
    const az = Math.atan2(cz, cx), lat = Math.asin(Math.max(-1, Math.min(1, cy)));
    LM[f] = Math.max(0, Math.cos(az*pr.spiral[0] + lat*pr.spiral[1]*2 - x.t*(.5 + (P.mid || 0)*2)))**10*Math.min(1, (SIG.harm || 0)*1.2 + (P.mid || 0)*x.react*.6)
      + wave*Math.exp(-((((cy + 1)/2 - (1 - wave))/.12)**2));
    // life, once the section's run a while
    LL[f] = pr.life && on('life') ? (L0 >= AL ? lifeL[FA[AL][f]] : lv2[L0][g]) : 0;
    // a drop's run-up: it fills with light from the bottom up as the drop nears
    LP[f] = meterOn ? smooth(((anticip*2.2 - (cy + 1))/.15)) : 0;
  }
}
function colour(P, x, u, w){
  const T = TUNE.prism, pr = st.prog, h = (P.hue || 0) + st.hue, pal = P.pal || [0, .33, .67], sty = Math.round((x.eff && x.eff.objStyle) || 0) % 6;
  const cK = hsv2rgb(h + pal[0], .75, 1), cS = hsv2rgb(h + pal[1], .8, 1), cH = hsv2rgb(h + pal[2], .25, 1), cM = hsv2rgb(h + pal[2], .9, 1), cL = hsv2rgb(h + pal[1] + .5, .7, 1), cP = hsv2rgb(h + pal[0] + .08, .55, 1);
  const tints = [0, 1, 2].map(i => hsv2rgb(h + pal[i], .65, 1)), Lt = P.light || {amt: 0}, lc = hsv2rgb(h + (Lt.hue || 0), Lt.sat || 0, 1);
  const cr = Math.cos(u.rot), sr = Math.sin(u.rot), cp = Math.cos(u.pitch), sp = Math.sin(u.pitch);
  const Hx = -.25, Hy = .35, Hz = 1.5, hl = Math.hypot(Hx, Hy, Hz);   // the highlight's half-way vector (a light up and to the left, towards us)
  const ext = sty === 2 ? .5 : 1, ex = st.ex*st.ex*T.explode, gone = Math.max(0, 1 - w/.6), dim = x.dim, fill = T.fill*(.6 + (P.beat || 0)*.8);
  const solid = sty === 1 || sty === 5, outline = sty === 2, holo = sty === 3, extr = st.secBars >= T.layerBars.extrude ? pr.extrude*T.extrude : T.extrude*.3;
  for (let f = 0; f < nf; f++) {
    const L0 = X.fl[f], g = G.FA[L0][f], key = L0*100000 + g, sd = hash(key*.731);
    const nx = X.fn[f*3], ny = X.fn[f*3 + 1], nz = X.fn[f*3 + 2], x1 = cr*nx + sr*nz, z1 = -sr*nx + cr*nz, vy = cp*ny - sp*z1, vz = sp*ny + cp*z1;
    const face = .5 + .5*vz, spec = Math.pow(Math.max(0, (x1*Hx + vy*Hy + vz*Hz)/hl), T.gloss)*T.glint, lam = Math.max(0, (x1*-.4 + vy*.6 + vz*.7)/1.0);
    const k = LK[f], s = LS[f], hh = LH[f]*dim, m = LM[f], li = LL[f], p = LP[f];
    const tn = tints[G.FA[0][f] % 3], lit = [0, 1, 2].map(i => cK[i]*k + cS[i]*s + cH[i]*hh + cM[i]*m*.7 + cL[i]*li*.7 + cP[i]*p);
    const lsum = k + s + hh + m*.7 + li*.7 + p, alpha = (sd < gone ? 0 : 1)*u.w;
    let fr, fa;
    if (solid) { fa = 1; fr = [0, 1, 2].map(i => tn[i]*(.12 + .55*lam)*(.6 + st.glow*.3) + lit[i]*.75 + spec + lc[i]*(Lt.amt || 0)*lam*.15); }
    else if (outline) { fa = 1; fr = lit.map(c => c*.18); }
    else if (holo) { fa = 0; fr = [0, 1, 2].map(i => (tn[i]*.03 + lit[i]*.25)); }
    else { fa = T.dark; fr = [0, 1, 2].map(i => tn[i]*fill*(.3 + .7*face) + lit[i]*.6*fa + spec*.8 + lc[i]*(Lt.amt || 0)*lam*.08); }
    for (let i = 0; i < 3; i++) X.fill[f*4 + i] = fr[i]*alpha; X.fill[f*4 + 3] = fa*alpha;
    const eb = ((outline ? 1 - Math.min(1, Math.abs(vz)*2.5) : .35 + .65*face)*(.75 + st.glow*.6) + lsum*.9)*(solid ? .35 : holo ? 1.2 : 1);
    for (let i = 0; i < 3; i++) X.edge[f*3 + i] = (tn[i]*.9 + lit[i]*.6 + .05)*eb*alpha;
    // each edge fades in as the detail reaches its level
    const a0 = G.TRI[f*3], a1 = G.TRI[f*3 + 1], a2 = G.TRI[f*3 + 2];
    for (let j = 0; j < 3; j++) { const p0 = j === 0 ? a1 : a0, p1 = j === 2 ? a1 : a2, dd = (D[p0] + D[p1])/2; X.eA[f*3 + j] = Math.max(0, Math.min(1, dd - G.EL[f*3 + j] + 1)); }
    // facets pushed out: lit ones lift (the kick's ring passing, sparks popping), and all fly apart when it shatters
    const cx = G.CEN[L0][g*3], cy = G.CEN[L0][g*3 + 1], cz = G.CEN[L0][g*3 + 2], push = (extr*(k*.8 + hh*.5 + s*.3) + ex*(.4 + sd))*.45*ext;
    X.off[f*3] = cx*push; X.off[f*3 + 1] = cy*push; X.off[f*3 + 2] = cz*push;
  }
}
