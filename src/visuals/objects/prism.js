// The Prism: one sheet of facets that becomes any shape (render/facet.js draws it). The prism and the Fold made one
// (docs/prism-plan.md, stage 2): the user loved the faceted gem and the way its facets light up, and asked for it to open
// into a sheet that wraps round and rejoins, rises into mountains, folds back into any shape and opens up again.
// - Its body is the gem cut along its edges into five gores (gemSheetGeo): closed, it's the gem, its shape blending
//   between two of ten (ball, octahedron, cube, gem, star, flower, disc, pill, a wobbling blob, and the superformula's
//   stars, flowers and urchins); opening, it bends out like a flower (each petal a gore, flattening as the ball's curve
//   goes out of it) into a flat five-pointed star, which rises into mountains or runs with waves.
// - Tubes, rings and twists stretch a star too far, so for those it flies apart and gathers again as the square sheet
//   (sheetGeo), which rolls, bends and twists, and flies back the same way.
// - Its facets: 20 to 1,280 on the gem, 8 to 2,048 on the square, more as the music builds, blooming out from the middle.
// - One brain for both: a section's program (its forms in turn, one each phrase line, its shapes, its symmetry, which
//   pattern each part of the music plays) comes back with it; the kick's rings (from the middle, or on the closed gem from
//   a new point each time), a cascade from facet to facet, or a pulse; the stabs' wedges, checker or rings stepping out;
//   the hats' sparks; the melody's spiral; once a section has run a while, life on the facets or a symmetric figure that
//   improvises a new shape each bar; sequences (16 kicks in a row, three stabs in a bar, the hats coming in) add facets,
//   spin it, scatter sparks; a drop's run-up fills it with light; a drop shatters it and opens a closed form into
//   mountains or snaps an open one shut into a star; a breakdown lays it down calm, with fewer facets.
// Patterns are worked out on the ball each body folds from (the square's is its octahedral fold), so they're the same
// open or closed: a ring round the middle of the star is a ring round the front of the gem. Look: the objects' style
// setting (glass, solid, outline, hologram). Tuning in TUNE.prism.
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { hsv2rgb } from '../../util.js';
import { DANCE } from '../../scene/dance.js';
import { SIG } from '../../scene/signals.js';
import { L } from '../../audio/listen.js';
import { gemSheetGeo, sheetGeo, facetPlaceP, facetGL, facet2d, facetPath2d } from '../../render/facet.js';

const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0)/4294967296; };
let seed = 1; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;   // its own random numbers (Journey's draws stay untouched)
const pick = a => a[Math.floor(rnd()*a.length)];
const tids = new WeakMap(); let tidN = 0; const tid = t => t == null ? 0 : tids.get(t) || (tids.set(t, ++tidN), tidN);   // a section type's own number (types are objects)
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x*x*(3 - 2*x);
const h2 = (i, j) => { const x = Math.sin(i*127.1 + j*311.7)*43758.5453; return x - Math.floor(x); };
function vn(x, y){ const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy);
  return (h2(i, j)*(1 - u) + h2(i + 1, j)*u)*(1 - v) + (h2(i, j + 1)*(1 - u) + h2(i + 1, j + 1)*u)*v; }
const ICO = (() => { const t = (1 + Math.sqrt(5))/2, l = Math.hypot(1, t); return [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => p.map(x => x/l)); })();

// the closed shapes: a radius for each direction (about 1 on average); 'super' is the superformula's, its points round the front
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
  super: (x, y, z) => superR(Math.atan2(y, x), Math.asin(Math.max(-1, Math.min(1, z)))),
};
const NAMES = Object.keys(SHAPES), CALM = ['ball', 'pill', 'disc', 'blob', 'flower', 'super'], SHARP = ['octa', 'cube', 'gem', 'star', 'super'];
// the superformula (Gielis'): m points, then its three exponents; two blended
const SF = {round: [0, 1, 2, 2], star: [5, .3, .3, .3], flower: [5, 1, 1, 8], cushion: [4, 12, 15, 15], gem: [5, 2, 4, 4], urchin: [10, .4, .6, .6], shell: [3, 4.5, 10, 10]};
const sfr = (t, p) => { const m = p[0]/4; return Math.pow(Math.pow(Math.abs(Math.cos(m*t)), p[2]) + Math.pow(Math.abs(Math.sin(m*t)), p[3]), -1/p[1]); };
const sfMax = p => { let mx = 0; for (let i = 0; i < 96; i++) mx = Math.max(mx, sfr(i/96*Math.PI*2 - Math.PI, p)); return mx || 1; };
function superR(th, ph){ const m = smooth(st.sfMix), a = sfr(th, st.sfA)/st.sfMx[0]*sfr(ph, st.sfA)/st.sfMx[0], b = sfr(th, st.sfB)/st.sfMx[1]*sfr(ph, st.sfB)/st.sfMx[1];
  return .6 + .55*(a*(1 - m) + b*m); }

// the forms. On the gem (g): k how closed (1 the gem, 0 the flat star). On the square (s): a rolled (1 a closed tube), b bent
// round (1 the ends meet: a ring), tw twist, wd its width. Both: h mountains, wv waves, pitch how it's tipped (negative: its
// face up, seen from above), yw how much it turns about its upright (the rest round its face), det its least detail.
const DEF = {body: 'g', k: 0, wd: 1, a: 0, b: 0, tw: 0, h: 0, wv: 0, pitch: 0, yw: 0, det: 0};
export const FORMS = Object.fromEntries(Object.entries({
  gem: {k: 1, pitch: .25, yw: 1},
  bloom: {k: .45, h: .06, pitch: -.2, yw: .3, det: 1},
  star: {h: .3, pitch: -.55, det: 2},
  peaks: {h: 1, pitch: -1.05, det: 3},
  waves: {h: .15, wv: 1, pitch: -.85, det: 3},
  sheet: {body: 's', h: .35, pitch: -.6, det: 2},
  tube: {body: 's', a: 1, h: .15, pitch: .2, yw: 1, det: 2},
  ring: {body: 's', a: 1, b: 1, h: .12, pitch: .45, yw: .4, det: 2},
  halo: {body: 's', wd: .45, b: 1, h: .25, pitch: -.3, det: 2},
  twist: {body: 's', a: .3, tw: 2.4, h: .08, pitch: .1, yw: 1, det: 2},
}).map(([k, v]) => [k, {...DEF, ...v}]));
const PARAMS = ['k', 'wd', 'a', 'b', 'tw', 'h', 'wv', 'pitch', 'yw'];

// ---- the two bodies: each its geometry, its own frame of facets, and where every corner and facet sits on its ball ----
function octa(x, y){ let nx = x, ny = y; const nz = 1 - Math.abs(x) - Math.abs(y);
  if (nz < 0) { nx = (1 - Math.abs(y))*(x < 0 ? -1 : 1); ny = (1 - Math.abs(x))*(y < 0 ? -1 : 1); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx/l, ny/l, nz/l]; }
function makeBody(kind, G, AL){
  const {nv, nf, F} = G, b = {kind, G, AL, F, nv, nf, VD: new Float32Array(nv*3), VR: new Float32Array(nv), SX: new Float32Array(nv), SY: new Float32Array(nv), ED: new Float32Array(nv),
    S3: new Float32Array(nv*3), NR: new Float32Array(nv*3), D: new Float32Array(nv), X: {}, FD: [], FR: [], FZ: []};
  for (let v = 0; v < nv; v++) {
    let d;
    if (kind === 'g') { d = [G.DIR[v*3], G.DIR[v*3 + 1], G.DIR[v*3 + 2]]; const th = G.TH[v], ps = G.GC[v] + G.PS[v]*(th < 1e-4 ? 1 : Math.sin(th)/th), r = th/Math.PI;
      b.SX[v] = r*Math.cos(ps); b.SY[v] = r*Math.sin(ps); b.ED[v] = r; }   // (where it lies on the flat star, its points at 1)
    else { const x = G.UV[v*2], y = G.UV[v*2 + 1]; d = octa(x, y); b.SX[v] = x; b.SY[v] = y; b.ED[v] = Math.max(Math.abs(x), Math.abs(y)); }
    b.VD.set(d, v*3); b.VR[v] = Math.acos(Math.max(-1, Math.min(1, d[2])))/Math.PI;
  }
  // each facet, at every level: its place on the ball, how far from the front (0) to the back (1), its angle round
  for (let l = 0; l <= F; l++) { const C = G.CEN[l], n = G.NF[l], fd = new Float32Array(n*3), fr = new Float32Array(n), fz = new Float32Array(n);
    for (let g = 0; g < n; g++) { const d = kind === 'g' ? [C[g*3], C[g*3 + 1], C[g*3 + 2]] : octa(C[g*3], C[g*3 + 1]); fd.set(d, g*3);
      fr[g] = Math.acos(Math.max(-1, Math.min(1, d[2])))/Math.PI; fz[g] = Math.atan2(d[1], d[0]); }
    b.FD.push(fd); b.FR.push(fr); b.FZ.push(fz); }
  const X = b.X; X.fill = new Float32Array(nf*4); X.edge = new Float32Array(nf*3); X.eA = new Float32Array(nf*3); X.off = new Float32Array(nf*3);
  // the automata on the facets of level AL: a cascade (a lit facet lights its neighbours next 16th, then rests) and life
  const NA = G.NF[AL], ADJ = G.ADJ[AL]; b.NA = NA; b.ADJ = ADJ; b.age = new Float32Array(NA).fill(99); b.casc = new Float32Array(NA); b.life = new Uint8Array(NA);
  b.N2 = []; for (let c = 0; c < NA; c++) { const s = new Set(); for (let j = 0; j < 3; j++) { const n = ADJ[c*3 + j]; if (n < 0) continue; s.add(n); for (let k = 0; k < 3; k++) if (ADJ[n*3 + k] >= 0) s.add(ADJ[n*3 + k]); } s.delete(c); b.N2.push([...s]); }
  b.lv = []; b.lv2 = []; for (let l = 0; l <= F; l++) { b.lv.push(new Float32Array(G.NF[l])); b.lv2.push(new Float32Array(G.NF[l])); }
  b.tint = kind === 'g' ? f => G.FA[0][f] % 3 : f => (G.CH[1][G.FA[1][f]] + (G.FA[0][f] < 4 ? 0 : 1)) % 3;
  return b;
}
const BODY = {g: makeBody('g', gemSheetGeo(3), 2), s: makeBody('s', sheetGeo(4), 3)};   // the automata: 320 facets on the gem, 512 on the square

const st = {body: 'g', form: 'gem', f: {...FORMS.gem}, sA: 'ball', sB: 'octa', mix: 0, mixT: 0, sfA: SF.round, sfB: SF.round, sfMx: [1, 1], sfMix: 1, sfSecs: 1,
  dFrom: 1, dTo: 1, wipe: 1, ex: 0, exT: 0, off: true, hue: 0, swap: null, hold: null,
  rip: [], sec: 0, secT: -9, chk: 0, chkT: -9, s16: -1, t: 0, bars: 0, secBars: 0, type: null, prog: null, progs: {}, fi: 0, phr: -1,
  run: 0, kicks: 0, lastBeatT: 0, stabs: [], spinT: -9, hatWas: 0, burstT: -9, waveT: -9, dropT: -9, lastDrop: null, lastHit: 0, glow: 0, kickT: -9, spin: 0, brk: false, act: .2};
// a section's program: its forms in turn, its shapes, its symmetry, which pattern each part of the music plays
function programFor(type, T){
  const id = tid(type); if (id && st.progs[id]) return st.progs[id];
  seed = 1 + Math.floor(hashStr('p' + id)*2147483000);
  const live = T > .5;
  // the closed gem most of the time (a new shape each time it comes round), now and then a tube, a ring or a twist; laid open
  // only sometimes (the flat star is a moment, not home: docs/prism-plan.md)
  const forms = [pick(['gem', 'gem', 'gem', live ? 'twist' : 'bloom']), rnd() < TUNE.prism.openChance ? pick(['star', 'peaks', 'waves', 'bloom', 'halo']) : pick(['gem', 'gem', 'tube', 'ring', 'twist']), 'gem'];
  const p = {forms, shapes: [pick(live ? SHARP : CALM), pick(NAMES)], sf: pick(live ? ['star', 'urchin', 'gem', 'shell'] : ['round', 'flower', 'cushion', 'gem']),
    det: live ? 1.6 + rnd()*1.2 : .6 + rnd()*1.3, n: {g: pick([5, 5, 10]), s: pick([4, 6, 8])},
    kick: pick(['ripple', 'ripple', 'cascade', 'pulse']), stab: pick(['sectors', 'checker', 'rings']), spiral: [pick([1, 2, 3, 5]), pick([2, 3, 5])],
    figure: rnd() < .5 ? 'life' : 'improv', brk: rnd() < .35 ? 'star' : 'gem', extrude: .5 + rnd()*.8, seed: rnd()*1000,
    rest: pick(['figure', 'sectors', 'spiral', 'ripple']), rings: pick(['out', 'out', 'in'])};   // (rest: the one pattern it plays when calm; rings: the kick's run out from the middle or close in from the rim)
  if (id) st.progs[id] = p;
  return p;
}
// for tests and stills: its state, a section's program, and holding a form (null lets the music choose again)
export const prismState = () => { const b = BODY[st.body]; return {act: st.act, form: st.form, body: st.body, f: st.f, det: st.dTo, shapes: [st.sA, st.sB], mix: st.mix, X: b.X, D: b.D, G: b.G, prog: st.prog, swapping: !!st.swap}; };
export const prismProgram = (type, T) => programFor(type, T);
export const prismForm = (k, now) => { st.hold = k; if (k) { goForm(k, now); if (now) Object.assign(st.f, FORMS[k]); } };

export default {
  key: 'prism', kind: 'object', label: 'Prism', words: 'A prism of facets opens into a star, rises into mountains and folds back into shapes with the music', optIn: true,
  dance: {moves: {face: 2.5, spin: 1.2, float: 1, rise: .7, approach: 1.1, pulse: 1, still: .6, groove: .4, bang: .2, look: .3}, sym: 5, liftPart: 1},
  // (a plain mesh of the closed gem's finest facets, for the tests and the Asset Viewer)
  get mesh(){ const G = BODY.g.G, pos = Array.from(G.DIR, x => x*.45); return this._m || (this._m = {pieces: [{pos, tri: Array.from(G.TRI), part: Array.from({length: G.nf}, (_, f) => 1 + G.FA[0][f] % 6)}], hinge: [0, 0, 0]}); },
  stats: '20 to 2,048 facets: a gem in ten shapes that opens into a star, mountains, waves, a tube, a ring, a twist',
  onBeat(pos){
    st.run++;
    if (pos === 0) { st.bars++; st.secBars++; st.glow = 1; if (st.prog && st.prog.figure === 'life' && (st.secBars >= TUNE.prism.layerBars.life || st.prog.rest === 'figure')) stepLife(BODY[st.body]); }
  },
  breakApart(){ st.exT = 1; },
  params(P, x){
    const T = TUNE.prism, J = x.J, dt = x.dt, w = P.o.prism || 0, ten = J ? J.tension || 0 : .5;
    st.t += dt;
    // the section: a new program, its layers sequenced in again
    const type = J && J.on ? J.type : null;
    if (type !== st.type || !st.prog) { st.type = type; st.prog = programFor(type, ten); st.secBars = 0; st.fi = 0;
      if (!st.hold) goForm(st.prog.forms[0]); setSf(SF[st.prog.sf]); setDetail(detFor(ten)); }
    const pr = st.prog;
    // a drop: it shatters, gains every facet, and a closed form opens out into mountains or an open one snaps shut into a star
    if (J && st.lastDrop !== null && J.lastDrop !== st.lastDrop) { st.dropT = st.t; st.exT = Math.max(st.exT, J.on ? 1 : .6); setDetail(BODY[st.body].F, 1);
      if (!st.hold) { if (closed() > .5) goForm('peaks'); else { goForm('gem'); flipTo('star'); } } }
    st.lastDrop = J ? J.lastDrop : null;
    // how much may move (docs/prism-plan.md, stage 3): the tension, lifted through a drop's run-up and by the drop itself, held
    // low in a breakdown, eased (quicker down than up). Calm, it holds its shape, turns slowly and glints, with one quiet pattern
    const TA = T.act, anticip = (J && J.anticip) || 0, dropLen = TA.dropBars*4*S.beatPeriod, since = st.t - st.dropT;
    let want = smooth((ten - TA.calm)/(TA.full - TA.calm));
    if (anticip > .02) want = Math.max(want, TA.runUp + (1 - TA.runUp)*anticip);
    if (since < dropLen) want = Math.max(want, 1 - since/dropLen);
    if (L.brk) want *= TA.brk;
    st.act += (want - st.act)*Math.min(1, dt/(want > st.act ? TA.rise : TA.fall));
    if (w < .003) { st.off = true; return; }
    if (st.off) { st.off = false; st.ex = st.exT = 1; if (st.swap) { setBody(FORMS[st.swap.to].body); st.form = st.swap.to; st.swap = null; } }   // arriving: it gathers out of its facets
    st.exT *= Math.exp(-dt/T.explodeSecs); st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
    // flying from one body to the other: once its facets are out, it gathers again as the other
    if (st.swap && st.t - st.swap.t > T.swapSecs) { const to = st.swap.to; st.swap = null; setBody(FORMS[to].body); goForm(to); }
    // the 16ths (on the beat grid's bar ramp; without a lock, the beats alone)
    const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : (st.run*4) % 16;
    if (s16 !== st.s16) { st.s16 = s16; step16(BODY[st.body]); }
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; kick(ten); }
    // stabs: the wedges step on, the checker flips, the superformula gains points; three in a bar spin the wedges for a bar
    if (x.hit > .8 && st.lastHit <= .8) { st.sec++; st.secT = st.t; st.chk ^= 1; st.chkT = st.t; st.hue += .1;
      const b = SF[pr.sf]; setSf([b[0] + 2*(st.sec % 3), b[1], b[2], b[3]], T.stabSfSecs);
      st.stabs = st.stabs.filter(t => st.t - t < 4*S.beatPeriod); st.stabs.push(st.t); if (st.stabs.length >= 3) st.spinT = st.t; }
    st.lastHit = x.hit;
    // the hats coming in scatter sparks and add a level of facets
    if (SIG.hat > .45 && st.hatWas < .2 && st.secBars >= 2 && at('grow') > .5) { st.burstT = st.t; setDetail(st.dTo + 1); }
    st.hatWas = SIG.hat > .45 ? SIG.hat : Math.min(st.hatWas, SIG.hat);
    // a phrase line: the next form of the section's program (the gem coming round again in a new shape); every other one when calm
    if (st.secBars > 0 && st.secBars % (st.act < TA.at.form ? 8 : 4) === 0 && st.phr !== st.bars) { st.phr = st.bars;
      if (!L.brk && !st.hold && st.t - st.dropT > 8*S.beatPeriod) { st.fi = (st.fi + 1) % pr.forms.length; const k = pr.forms[st.fi]; if (k === st.form && k === 'gem') newShape(ten); else goForm(k); } }
    // a breakdown lays it down calm with fewer facets; after it, and a while after a drop, back to the section's own
    if (L.brk && !st.brk) { if (!st.hold) goForm(pr.brk); if (pr.brk === 'gem') flipTo(pick(CALM)); setDetail(1 + rnd()*.8); }
    if (!L.brk && st.brk) setDetail(detFor(ten));
    st.brk = L.brk;
    if (st.t - st.dropT > 8*S.beatPeriod && st.t - st.dropT < 8*S.beatPeriod + dt*1.5) setDetail(detFor(ten));
    // the form eases towards its own; the shapes blend; the detail's front blooms out from the middle
    const slow = 1.6 - .6*st.act, tg = FORMS[st.form], k = Math.min(1, dt/(T.morphSecs*slow)*2.2);   // (calm: slower)
    for (const p of PARAMS) st.f[p] += (tg[p] - st.f[p])*k;
    st.mix += (st.mixT - st.mix)*Math.min(1, dt/(T.morphSecs*slow)*2.5);
    st.sfMix = Math.min(1, st.sfMix + dt/st.sfSecs);
    st.wipe = Math.min(1, st.wipe + dt/(T.wipeBeats*S.beatPeriod));
    st.glow *= Math.exp(-dt*3);
    st.spin += dt*T.spin*(1 - .6*TUNE.dance.amount)*(TA.spinCalm + (1 - TA.spinCalm)*st.act);
    const b = BODY[st.body];
    if (b.kind === 'g') shapeGem(b, P, x); else shapeSheet(b, P, x);
    light(b, P, x);
    // where it stands and how it turns (its dance on top): a flat form turns about its face, never edge-on
    const An = P.anchor, d = DANCE.obj.prism, f = st.f, burst = st.t - st.spinT < 4*S.beatPeriod ? (st.t - st.spinT)*2*at('spin') : 0, sway = .4 + .6*st.act;
    const U = P.m = P.m || {};
    const u = U.prism = {rot: st.spin*f.yw + burst + Math.sin(x.t*.11)*.15*(1 - f.yw)*sway, pitch: f.pitch + Math.sin(x.t*.19)*.08*sway, roll: st.spin*(1 - f.yw)*.5,
      size: (An && An.size || T.size)*(1 + (P.bass || 0)*x.react*.03*st.act), pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, (f.pitch < 0 ? -.04 : .02) + P.wind.y*TUNE.ctx.windObject],
      line: TUNE.mesh.line, w: An && An.hide ? 0 : Math.min(1, w*1.2), X: b.X, body: st.body};
    if (d) { const dm = TA.danceCalm + (1 - TA.danceCalm)*at('dance');   // (its dance, small when calm)
      u.rot += d.yaw*f.yw*dm; u.roll += d.yaw*(1 - f.yw)*dm;
      u.pitch += d.pitch*(f.pitch < 0 ? .3 : 1)*dm; u.roll += d.roll*dm; u.pos = [u.pos[0] + d.dx*dm, u.pos[1] + d.dy*dm]; u.size *= 1 + (d.s - 1)*dm; u.sq = d.sq*(f.pitch < 0 ? .3 : 1)*dm; }
    const Vw = S.view; if (Vw && Vw.key === 'prism') { u.rot = Vw.yaw + (d ? d.yaw : 0); u.pitch += Vw.pitch; u.size *= Vw.zoom; }
    colour(b, P, x, u, w);
  },
  drawGL(gl, P, W, H, stage){ if (stage === 'trails') return;
    const u = P.m.prism, b = BODY[u.body]; if (this._gen !== S.glGen) { this._gl = {}; this._gen = S.glGen; }
    (this._gl[u.body] = this._gl[u.body] || facetGL(gl, b.G))(b.X, u, W, H, stage); },
  draw2d(o, P){ const u = P.m.prism; facet2d(o, BODY[u.body].G, BODY[u.body].X, u); },
  path2d(o, P){ const u = P.m.prism; facetPath2d(o, BODY[u.body].G, BODY[u.body].X, u); },
};

// how far the activity has let something in (TUNE.prism.act.at: each its own level, eased over .15)
const at = k => smooth((st.act - TUNE.prism.act.at[k])/.15 + .5);
// how closed it is: 1 the gem, a tube or a ring; 0 laid open
const closed = () => st.body === 'g' ? st.f.k : Math.max(st.f.a, st.f.b);
const detFor = ten => Math.max(FORMS[st.form].det, st.prog.det + ten*TUNE.prism.detTension + (st.body === 's' ? 1 : 0));
function goForm(k, now){
  const F = FORMS[k]; if (!F) return;
  if (F.body !== st.body) {   // the other body: fly apart first (or at once, while it's off screen)
    if (now || st.off) setBody(F.body);
    else { if (!st.swap) { st.swap = {to: k, t: st.t}; st.exT = Math.max(st.exT, TUNE.prism.swapEx); } else st.swap.to = k; return; }
  }
  if (k === 'gem' && st.form !== 'gem') newShape();
  st.form = k; if (F.det > st.dTo) setDetail(F.det);
}
// to the other body: it gathers laid flat (the star, or the square), then folds into its form
function setBody(k){
  if (st.body === k) return; st.body = k;
  Object.assign(st.f, k === 'g' ? {k: 0} : {a: 0, b: 0, tw: 0, wd: 1});
  const d = Math.max(0, Math.min(BODY[k].F, st.dTo + (k === 's' ? 1 : -1))); st.dFrom = st.dTo = d; st.wipe = 1;
}
function newShape(ten){ const pr = st.prog; flipTo(pr && rnd() < .5 ? pick(pr.shapes) : pick((ten ?? .5) > .5 ? SHARP.concat(NAMES) : CALM.concat(NAMES))); }
function flipTo(k){ if (st.mixT > .5) { st.sA = k; st.mixT = 0; } else { st.sB = k; st.mixT = 1; } }
function setSf(p, secs){ st.sfA = st.sfMix >= 1 ? st.sfB : st.sfA; st.sfMx[0] = st.sfMx[1]; st.sfB = p; st.sfMx[1] = sfMax(p); st.sfMix = 0; st.sfSecs = secs || TUNE.prism.morphSecs; }
function setDetail(d, now){ d = Math.max(0, Math.min(BODY[st.body].F, d)); if (Math.abs(d - st.dTo) < .05) return;
  st.dFrom = now ? d : st.dFrom + (st.dTo - st.dFrom)*Math.min(1, st.wipe); st.dTo = d; st.wipe = now ? 1 : 0; }

// ---- the surface ----
// the mountains, waves and the kick's rings: a height along each point's normal. The ranges are symmetric round the middle
// (folded into the section's n wedges: even on the square, so its tube's, ring's seams meet), lower towards the edges
function height(b, v, t, bass, f){
  const T = TUNE.prism, n = st.prog ? st.prog.n[b.kind] : 6, x = b.SX[v], y = b.SY[v], r = Math.hypot(x, y), wedge = Math.PI*2/n;
  let hgt = 0;
  if (f.h > .005 || f.wv > .005) {
    let a = Math.atan2(y, x); a = Math.abs(((a % wedge) + wedge) % wedge - wedge/2);
    const u = r*Math.cos(a)*T.mtnScale, w = r*Math.sin(a)*T.mtnScale, s = st.prog ? st.prog.seed : 0;
    let amp = 1, fr = 1;
    for (let i = 0; i < 3; i++) { const q = 1 - Math.abs(2*vn(u*fr + s, w*fr + s*.7) - 1); hgt += q*q*amp; amp *= .5; fr *= 2.1; }
    hgt = (hgt - .45)*f.h*(1 + bass*T.mtnBreath*st.act) + f.wv*Math.sin(r*T.waveK - t*T.waveSpeed)*.6;
    hgt *= T.mtn*(1 - .85*smooth((b.ED[v] - .7)/.3));   // (an island of ranges)
  }
  // the kick's rings, from where each landed (on the ball: the middle, or on the closed gem a new point)
  const lift = (T.ripLift + (T.ripLiftClosed - T.ripLift)*closed())*(T.act.liftCalm + (1 - T.act.liftCalm)*at('lift')), dx = b.VD[v*3], dy = b.VD[v*3 + 1], dz = b.VD[v*3 + 2];
  for (const q of st.rip) { const g = st.t - q.t, r0 = Math.acos(Math.max(-1, Math.min(1, dx*q.o[0] + dy*q.o[1] + dz*q.o[2])))/Math.PI, rr = q.inv ? 1 - r0 : r0;
    hgt += lift*q.k*Math.exp(-(((rr - g*T.ripSpeed)/.08)**2))*Math.max(0, 1 - g/T.ripSecs); }
  return hgt;
}
// the detail: a front of new facets blooming out from the middle
function detail(b){ const wf = st.wipe*1.25; for (let v = 0; v < b.nv; v++) b.D[v] = st.dTo + (st.dFrom - st.dTo)*smooth((b.VR[v] - wf)/.12 + .5); }
// the gem: each gore bent on a sphere of curvature k (its arc lengths kept), so the ball opens like a flower into a flat star;
// the petals narrow as they flatten, as an orange peel's do. Closed, each corner is on the ball, then given its shape's radius
function shapeGem(b, P, x){
  const T = TUNE.prism, G = b.G, f = st.f, kk = Math.max(f.k, 1e-3), kc = f.k*f.k*f.k, m = smooth(st.mix), t = x.t, bass = (P.bass || 0)*x.react;
  const mid = (1 - Math.cos(kk*Math.PI))/(2*kk), sc0 = T.r*(T.star + (1 - T.star)*f.k)*(1 + bass*T.breath*f.k*st.act);
  const anticip = (x.J && x.J.anticip) || 0, fh = {...f, h: f.h*(1 + anticip*.8)}, S3 = b.S3;
  for (let v = 0; v < b.nv; v++) {
    const th = G.TH[v], s = Math.sin(kk*th), c = Math.cos(kk*th), sc = th < 1e-4 || s < 1e-6 ? 1 : Math.sin(th)*kk/s, ps = G.GC[v] + G.PS[v]*sc;
    const cp = Math.cos(ps), sp = Math.sin(ps);
    let px = s/kk*cp, py = s/kk*sp, pz = (c - 1)/kk + mid;
    if (kc > .001) { const dx = b.VD[v*3], dy = b.VD[v*3 + 1], dz = b.VD[v*3 + 2], R = SHAPES[st.sA](dx, dy, dz, t)*(1 - m) + SHAPES[st.sB](dx, dy, dz, t)*m, q = 1 + (R - 1)*kc;
      px *= q; py *= q; pz *= q; }
    const hh = height(b, v, t, bass, fh)/sc0;   // (heights in the object's own units, whatever the star's size)
    const nx = s*cp, ny = s*sp, nz = c;
    S3[v*3] = (px + nx*hh)*sc0; S3[v*3 + 1] = (py + ny*hh)*sc0; S3[v*3 + 2] = (pz + nz*hh)*sc0;
  }
  detail(b); facetPlaceP(G, S3, b.D, b.X);
}
// the square: rolled, bent and twisted, as the Fold was; the heights along each point's normal
const tmp = [0, 0, 0], q1 = [0, 0, 0], q2 = [0, 0, 0];
function surf(x, y, f, o){
  const T = TUNE.prism, Wd = T.half;
  let X = x*Wd*f.wd, Y = y*Wd, Z = 0;
  const A = f.a*Math.PI;   // rolled: curled round its upright (closing into a tube), and centred
  if (A > 1e-3) { const r = Wd*f.wd/A, th = A*x; X = r*Math.sin(th); Z = r*(Math.cos(th) - 1) + r*(1 - Math.cos(A))/2; }
  if (f.tw) { const c = Math.cos(f.tw*y), s = Math.sin(f.tw*y), x2 = c*X - s*Z; Z = s*X + c*Z; X = x2; }
  const B = f.b*Math.PI;   // bent: the length curved round in its own plane (the ends meeting: a ring, or the flat sheet a flat ring)
  if (B > 1e-3) { const r2 = Wd/B + T.ringR, ph = B*y, rr = r2 + X; X = rr*Math.cos(ph) - r2 + r2*(1 - Math.cos(B))/2; Y = rr*Math.sin(ph); }
  o[0] = X; o[1] = Y; o[2] = Z; return o;
}
function shapeSheet(b, P, x){
  const G = b.G, f = st.f, UV = G.UV, side = G.side, VI = G.VI, P3 = b.S3, NR = b.NR, e = 2/(side - 1), bass = (P.bass || 0)*x.react;
  const anticip = (x.J && x.J.anticip) || 0, fh = {...f, h: f.h*(1 + anticip*.8)};
  for (let v = 0; v < b.nv; v++) { surf(UV[v*2], UV[v*2 + 1], f, tmp); P3[v*3] = tmp[0]; P3[v*3 + 1] = tmp[1]; P3[v*3 + 2] = tmp[2]; }
  // each point's normal (from its neighbours on the grid; at the edges, from the surface just past them, so seams meet)
  for (let v = 0; v < b.nv; v++) {
    const g = G.GI[v], gi = Math.floor(g/side), gj = g % side;
    let ux, uy, uz, wx, wy, wz;
    if (gi > 0 && gi < side - 1 && gj > 0 && gj < side - 1) {
      const a = VI[g + side]*3, bb = VI[g - side]*3, c = VI[g + 1]*3, d = VI[g - 1]*3;
      ux = P3[a] - P3[bb]; uy = P3[a + 1] - P3[bb + 1]; uz = P3[a + 2] - P3[bb + 2]; wx = P3[c] - P3[d]; wy = P3[c + 1] - P3[d + 1]; wz = P3[c + 2] - P3[d + 2];
    } else {
      const x0 = UV[v*2], y0 = UV[v*2 + 1];
      surf(x0 + e, y0, f, q1); surf(x0 - e, y0, f, q2); ux = q1[0] - q2[0]; uy = q1[1] - q2[1]; uz = q1[2] - q2[2];
      surf(x0, y0 + e, f, q1); surf(x0, y0 - e, f, q2); wx = q1[0] - q2[0]; wy = q1[1] - q2[1]; wz = q1[2] - q2[2];
    }
    let nx = uy*wz - uz*wy, ny = uz*wx - ux*wz, nz = ux*wy - uy*wx; const l = Math.hypot(nx, ny, nz) || 1;
    NR[v*3] = nx/l; NR[v*3 + 1] = ny/l; NR[v*3 + 2] = nz/l;
  }
  for (let v = 0; v < b.nv; v++) { const hh = height(b, v, x.t, bass, fh); for (let i = 0; i < 3; i++) P3[v*3 + i] += NR[v*3 + i]*hh; }
  detail(b); facetPlaceP(G, P3, b.D, b.X);
}

// ---- what the music does on its beats ----
const dirAt = (r, a) => [Math.sin(r*Math.PI)*Math.cos(a), Math.sin(r*Math.PI)*Math.sin(a), Math.cos(r*Math.PI)];
function nearestCell(b, d){ const C = b.FD[b.AL]; let best = 0, bd = -2; for (let c = 0; c < b.NA; c++) { const v = C[c*3]*d[0] + C[c*3 + 1]*d[1] + C[c*3 + 2]*d[2]; if (v > bd) { bd = v; best = c; } } return best; }
function kick(ten){
  const pr = st.prog; if (!pr) return;
  // its ring: from the middle, or on the closed gem from a new point each time
  const o = st.body === 'g' && st.f.k > .6 ? dirAt(Math.acos(1 - 2*hash(st.run*.37))/Math.PI, hash(st.run*.91)*Math.PI*2) : [0, 0, 1];
  st.rip.push({o, t: st.t, k: .6 + ten*.6, inv: pr.rings === 'in'}); if (st.rip.length > 4) st.rip.shift();
  if (pr.kick === 'cascade') {   // seeded at n points round the middle, so its rings run out symmetric
    const b = BODY[st.body], n = pr.n[b.kind], r = .15 + .45*hash(st.run*.71), a0 = hash(st.run*1.3)*Math.PI*2;
    for (let i = 0; i < n; i++) b.age[nearestCell(b, dirAt(r, a0 + i/n*Math.PI*2))] = 0;
  }
  // a run of kicks: every 16 in a row adds facets and sends a wave of light out from the middle
  if (st.t - st.lastBeatT > 2.5*S.beatPeriod + .2) st.kicks = 0;
  st.kicks++; st.lastBeatT = st.t;
  if (st.kicks % 16 === 0 && at('grow') > .5) { st.waveT = st.t; setDetail(st.dTo + .7); }
}
function step16(b){
  const {age, casc, ADJ, NA} = b;
  for (let c = 0; c < NA; c++) casc[c] = age[c];
  for (let c = 0; c < NA; c++) { if (casc[c] < 4) { age[c] = casc[c] + 1; continue; }
    let lit = false; for (let j = 0; j < 3; j++) { const n = ADJ[c*3 + j]; if (n >= 0 && casc[n] === 0) lit = true; }
    age[c] = lit ? 0 : Math.min(99, casc[c] + 1); }
}
// life on the facets (each counts the dozen or so round it): born with 3 or 4 alive, lives with 2 to 4; reseeded by stabs
function stepLife(b){
  const {life, N2, NA} = b; let alive = 0; const nx = new Uint8Array(NA);
  for (let c = 0; c < NA; c++) { let n = 0; for (const k of N2[c]) n += life[k]; nx[c] = life[c] ? (n >= 2 && n <= 4 ? 1 : 0) : (n === 3 || n === 4 ? 1 : 0); alive += nx[c]; }
  life.set(nx);
  if (alive < 8 || st.t - st.secT < .05) for (let i = 0; i < 40; i++) life[Math.floor(hash(st.run*7.3 + i)*NA)] = 1;
}

// ---- light: each facet's from each part of the music, by where it is on its ball ----
const NFM = 2048, LK = new Float32Array(NFM), LS = new Float32Array(NFM), LH = new Float32Array(NFM), LM = new Float32Array(NFM), LI = new Float32Array(NFM), LP = new Float32Array(NFM);
// a value on the automata's facets seen at every level (a coarse facet: the mean of its children; a finer one: its parent's)
function levels(b, src, out){ const {AL, F, G} = b; out[AL].set(src);
  for (let l = AL + 1; l <= F; l++) for (let c = 0; c < G.NF[l]; c++) out[l][c] = out[l - 1][c >> 2];
  for (let l = AL - 1; l >= 0; l--) for (let g = 0; g < G.NF[l]; g++) out[l][g] = (out[l + 1][g*4] + out[l + 1][g*4 + 1] + out[l + 1][g*4 + 2] + out[l + 1][g*4 + 3])/4; }
function light(b, P, x){
  const T = TUNE.prism, pr = st.prog, sb = st.secBars, bp = S.beatPeriod, G = b.G, FA = G.FA, fl = b.X.fl, n = pr.n[b.kind], wedge = Math.PI*2/n;
  for (let c = 0; c < b.NA; c++) b.casc[c] = b.age[c] < 99 ? Math.exp(-b.age[c]*.7) : 0;
  levels(b, b.casc, b.lv);
  if (pr.figure === 'life') { const lf = new Float32Array(b.NA); for (let c = 0; c < b.NA; c++) lf[c] = b.life[c]; levels(b, lf, b.lv2); }
  const hats = Math.min(1, SIG.hat*1.4), on = k => sb >= T.layerBars[k], anticip = (x.J && x.J.anticip) || 0, kc = closed();
  const fade = Math.exp(-(st.t - st.secT)*2.5), cfade = Math.exp(-(st.t - st.chkT)*2.5), mel = Math.min(1, (SIG.harm || 0)*1.2 + (P.mid || 0)*x.react*.6);
  const spinning = st.t - st.spinT < 4*bp, wave = Math.max(0, 1 - (st.t - st.waveT)/(4*bp)), burst = Math.max(0, 1 - (st.t - st.burstT)/(2*bp));
  const rest = pr.rest, gate = k => rest === k ? 1 : at(k);   // (the section's calm pattern plays whatever the activity; the rest come in as it rises)
  const gK = rest === 'ripple' ? 1 : T.act.kickCalm + (1 - T.act.kickCalm)*at('kick'), gS = gate('sectors'), gM = gate('spiral'), gF = gate('figure'), gH = at('hat'), gW = at('grow');
  const fig = rest === 'figure' || on(pr.figure) ? pr.figure : null, bar = st.bars, ph = SIG.barPhase || 0, e = smooth(ph*4), meter = st.body === 'g' && kc > .5;
  for (let f = 0; f < b.nf; f++) {
    const L0 = fl[f], g = FA[L0][f], D = b.FD[L0], dx = D[g*3], dy = D[g*3 + 1], dz = D[g*3 + 2], r = b.FR[L0][g], an = b.FZ[L0][g], key = L0*100000 + g;
    // the kick: rings out from where it landed, a cascade, or everything pulsing
    let k = pr.kick === 'pulse' ? SIG.kick*(.5 + .5*hash(key + st.run)) : 0;
    for (const q of st.rip) { const a = st.t - q.t, r0 = Math.acos(Math.max(-1, Math.min(1, dx*q.o[0] + dy*q.o[1] + dz*q.o[2])))/Math.PI, rr = q.inv ? 1 - r0 : r0;
      k = Math.max(k, q.k*Math.exp(-(((rr - a*T.ripSpeed)/.075)**2))*Math.max(0, 1 - a/T.ripSecs)*(pr.kick === 'cascade' ? .4 : 1)); }
    if (pr.kick === 'cascade') k = Math.max(k, b.lv[L0][g]);
    LK[f] = k*gK;
    // stabs: a wedge stepping round (spinning after three in a bar), a checker flipping, or a ring stepping out
    let s = 0;
    if ((on('stab') || rest === 'sectors') && gS > .01 || spinning && at('spin') > .01) {
      if (pr.stab === 'sectors' || spinning) { const i = Math.floor(((an/wedge + (spinning ? (st.t - st.spinT)*6 : 0)) % n + n) % n); s = i === st.sec % n ? .4 + .6*fade : 0; }
      else if (pr.stab === 'checker') s = (G.CH[L0][g] === 3) === !!st.chk ? .25 + .75*cfade : 0;
      else s = Math.floor(r*6) === st.sec % 6 ? .5 + .5*fade : 0;
    }
    LS[f] = s*Math.max(gS, spinning ? at('spin') : 0);
    // the hats: a new random handful each 16th, and a burst of sparks as they come in
    LH[f] = (on('hat') || burst) && gH > .01 ? gH* (hash(key*1.37 + st.s16*17.1 + bar*3.3) < hats*T.hatShare + burst*.4 ? 1 : 0) : 0;
    // the melody: a spiral turning with the mids; and after a run of kicks, a wave out from the middle
    LM[f] = Math.max(0, Math.cos(an*pr.spiral[0] + r*pr.spiral[1]*4 - x.t*(.5 + (P.mid || 0)*2)))**10*mel*gM + wave*gW*Math.exp(-(((r - (1 - wave))/.1)**2));
    // once the section's run a while: life on the facets, or a symmetric figure (folded into the n wedges, mirrored) that improvises a new shape each bar
    if (fig === 'life') LI[f] = b.lv2[L0][g]*.8*gF;
    else if (fig === 'improv') { const a = Math.abs(((an % wedge) + wedge) % wedge - wedge/2), u = r*Math.cos(a)*4, w = r*Math.sin(a)*4;
      const va = vn(u + bar*7.31, w + pr.seed), vb = vn(u + (bar - 1)*7.31, w + pr.seed); LI[f] = smooth(((va*e + vb*(1 - e)) - .62)/.08)*gF; }
    else LI[f] = 0;
    // a drop's run-up: the closed gem fills from the bottom up, an open one from its rim in
    LP[f] = anticip > .02 ? (meter ? smooth((anticip*2.2 - (dy + 1))/.15) : smooth((r - (1 - anticip)*1.1)/.12)) : 0;
  }
}
function colour(b, P, x, u, w){
  const T = TUNE.prism, G = b.G, X = b.X, D = b.D, pr = st.prog, h = (P.hue || 0) + st.hue, pal = P.pal || [0, .33, .67], sty = Math.round((x.eff && x.eff.objStyle) || 0) % 6;
  const cK = hsv2rgb(h + pal[0], .75, 1), cS = hsv2rgb(h + pal[1], .8, 1), cH = hsv2rgb(h + pal[2], .25, 1), cM = hsv2rgb(h + pal[2], .9, 1), cI = hsv2rgb(h + pal[1] + .5, .7, 1), cP = hsv2rgb(h + pal[0] + .08, .55, 1);
  const tints = [0, 1, 2].map(i => hsv2rgb(h + pal[i], .6, 1)), Lt = P.light || {amt: 0}, lc = hsv2rgb(h + (Lt.hue || 0), Lt.sat || 0, 1);
  const cr = Math.cos(u.rot), sr = Math.sin(u.rot), cp = Math.cos(u.pitch), sp = Math.sin(u.pitch), co = Math.cos(u.roll), so = Math.sin(u.roll);
  const Hx = -.25, Hy = .35, Hz = 1.5, hl = Math.hypot(Hx, Hy, Hz);   // the highlight's half-way vector (a light up and to the left, towards us)
  const ext = sty === 2 ? .5 : 1, ex = st.ex*st.ex*T.explode, gone = Math.max(0, 1 - w/.6), dim = x.dim, fill = T.fill*(.6 + (P.beat || 0)*.8);
  const solid = sty === 1 || sty === 5, outline = sty === 2, holo = sty === 3, kc = closed();
  const extr = T.extrude*(st.secBars >= T.layerBars.extrude ? pr.extrude : .5)*(T.act.liftCalm + (1 - T.act.liftCalm)*at('lift'));
  for (let f = 0; f < b.nf; f++) {
    const L0 = X.fl[f], g = G.FA[L0][f], key = L0*100000 + g, sd = hash(key*.731);
    const nx = X.fn[f*3], ny = X.fn[f*3 + 1], nz = X.fn[f*3 + 2], x1 = cr*nx + sr*nz, z1 = -sr*nx + cr*nz, vy0 = cp*ny - sp*z1, vz = sp*ny + cp*z1;
    const vx = co*x1 - so*vy0, vy = so*x1 + co*vy0, sg = vz < 0 && kc < .5 ? -1 : 1;   // (an open sheet has two faces: lit as whichever faces us)
    const face = .5 + .5*(sg*vz), spec = Math.pow(Math.max(0, sg*(vx*Hx + vy*Hy + vz*Hz)/hl), T.gloss)*T.glint, lam = Math.max(0, sg*(vx*-.4 + vy*.6 + vz*.7));
    const k = LK[f], s = LS[f], hh = LH[f]*dim, m = LM[f], im = LI[f], p = LP[f];
    const tn = tints[b.tint(f)];
    const lit = [0, 1, 2].map(i => (cK[i]*k + cS[i]*s + cH[i]*hh + cM[i]*m*.7 + cI[i]*im*.5 + cP[i]*p)*T.lit);
    const lsum = (k + s + hh + m*.7 + im*.5 + p)*T.lit, alpha = (sd < gone ? 0 : 1)*u.w;
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
    // facets pushed out: the kick's ring and the hats lift them (the stabs' too on a closed form: an open sheet looked cracked), and all fly apart when it shatters
    const push = (extr*(k*.8 + hh*.3 + s*.3*kc) + ex*(.4 + sd))*.45*ext;
    X.off[f*3] = nx*push; X.off[f*3 + 1] = ny*push; X.off[f*3 + 2] = nz*push;
  }
}
