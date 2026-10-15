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
import { gemSheetGeo, sheetGeo, facetPlaceP, facetGL, facet2d, facetPath2d, FOCAL, CAM, beamsGL, beams2d } from '../../render/facet.js';
import { traceBeams, beamOut } from './beams.js';
const OV = 480;   // the most beams, flares and outline pieces drawn over the Prism
import { STAGE, MAXSPOTS } from '../../scene/stage.js';
import SKULL from './meshes/skull.js';
import UNICORN from './meshes/unicorn.js';
import MANTA from './meshes/manta.js';
import { RULES, makeCells, stepCells, touch, clear, syncAll, scatter } from './cells.js';

const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0)/4294967296; };
let seed = 1; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;   // its own random numbers (Journey's draws stay untouched)
const pick = a => a[Math.floor(rnd()*a.length)];
const tids = new WeakMap(); let tidN = 0; const tid = t => t == null ? 0 : tids.get(t) || (tids.set(t, ++tidN), tidN);   // a section type's own number (types are objects)
const salt = () => window.__step ? 0 : st.salt ??= Date.now() % 100003;   // (a visit's own shapes; fixed under the tests' clock)
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
  // wrapped onto the other objects (stage 11): the closed sheet shrunk onto the skull, the unicorn or the manta
  skull: (x, y, z) => radial('skull')(x, y, z), unicorn: (x, y, z) => radial('unicorn')(x, y, z), manta: (x, y, z) => radial('manta')(x, y, z),
};
// ---- the other objects as shapes (docs/prism-plan.md, stage 11): each mesh's distance from its middle in every direction
// (a grid of directions, the farthest of its corners and panes in each, gaps filled from their neighbours), so the closed
// sheet can wrap onto it; and its panes' middles, where the swarm's shards fly to ----
const MESHES = {skull: [SKULL.skull, SKULL.jaw], unicorn: [UNICORN.body, UNICORN.head], manta: [MANTA]}, WRAP = Object.keys(MESHES);
const RAD = {}, PANES = {}, NT = 24, NP = 48;
function meshPts(k){ const pts = []; for (const pc of MESHES[k]) { const P = pc.pos, T = pc.tri;
  for (let i = 0; i < P.length; i += 3) pts.push([P[i], P[i + 1], P[i + 2]]);
  for (let i = 0; i < T.length; i += 3) { const a = T[i]*3, b = T[i + 1]*3, c = T[i + 2]*3; pts.push([(P[a] + P[b] + P[c])/3, (P[a + 1] + P[b + 1] + P[c + 1])/3, (P[a + 2] + P[b + 2] + P[c + 2])/3, 1]); } }
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  const c = lo.map((v, i) => (v + hi[i])/2); return pts.map(p => [p[0] - c[0], p[1] - c[1], p[2] - c[2], p[3] || 0]); }
function radial(k){
  if (RAD[k]) return RAD[k];
  const g = new Float32Array(NT*NP), pts = meshPts(k), r0 = TUNE.prism.r;
  for (const [x, y, z] of pts) { const d = Math.hypot(x, y, z) || 1e-6, i = Math.min(NT - 1, Math.floor(Math.acos(Math.max(-1, Math.min(1, y/d)))/Math.PI*NT)), j = Math.floor(((Math.atan2(z, x)/(Math.PI*2)) + 1) % 1*NP) % NP;
    g[i*NP + j] = Math.max(g[i*NP + j], d/r0); }
  for (let it = 0; it < 30; it++) for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) if (!g[i*NP + j]) { let s = 0, n = 0;
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || a >= NT) continue; const v = g[a*NP + (b + NP) % NP]; if (v) { s += v; n++; } } if (n) g[i*NP + j] = s/n; }
  const m = g.slice(); for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) m[i*NP + j] = (2*g[i*NP + j] + g[i*NP + (j + 1) % NP] + g[i*NP + (j + NP - 1) % NP] + g[Math.max(0, i - 1)*NP + j] + g[Math.min(NT - 1, i + 1)*NP + j])/6;   // (softened a little)
  return RAD[k] = (x, y, z) => { const a = Math.acos(Math.max(-1, Math.min(1, y)))/Math.PI*NT - .5, b = ((Math.atan2(z, x)/(Math.PI*2)) + 1) % 1*NP - .5, i = Math.floor(a), j = Math.floor(b), fa = a - i, fb = b - j;
    const at = (ii, jj) => m[Math.max(0, Math.min(NT - 1, ii))*NP + ((jj % NP) + NP) % NP];
    return (at(i, j)*(1 - fb) + at(i, j + 1)*fb)*(1 - fa) + (at(i + 1, j)*(1 - fb) + at(i + 1, j + 1)*fb)*fa; };
}
const panes = k => PANES[k] || (PANES[k] = meshPts(k).filter(p => p[3]));
const NAMES = Object.keys(SHAPES), FREE = NAMES.filter(n => !WRAP.includes(n)), CALM = ['ball', 'pill', 'disc', 'blob', 'flower', 'super'], SHARP = ['octa', 'cube', 'gem', 'star', 'super'];
// the superformula (Gielis'): m points, then its three exponents; two blended
const SF = {round: [0, 1, 2, 2], star: [5, .3, .3, .3], flower: [5, 1, 1, 8], cushion: [4, 12, 15, 15], gem: [5, 2, 4, 4], urchin: [10, .4, .6, .6], shell: [3, 4.5, 10, 10]};
const sfr = (t, p) => { const m = p[0]/4; return Math.pow(Math.pow(Math.abs(Math.cos(m*t)), p[2]) + Math.pow(Math.abs(Math.sin(m*t)), p[3]), -1/p[1]); };
const sfMax = p => { let mx = 0; for (let i = 0; i < 96; i++) mx = Math.max(mx, sfr(i/96*Math.PI*2 - Math.PI, p)); return mx || 1; };
function superR(th, ph){ const m = smooth(st.sfMix), a = sfr(th, st.sfA)/st.sfMx[0]*sfr(ph, st.sfA)/st.sfMx[0], b = sfr(th, st.sfB)/st.sfMx[1]*sfr(ph, st.sfB)/st.sfMx[1];
  return .6 + .55*(a*(1 - m) + b*m); }

// the forms. On the gem (g): k how closed (1 the gem, 0 the flat star). On the square (s): a rolled (1 a closed tube), b bent
// round (1 the ends meet: a ring), tw twist, wd its width. Both: h mountains, wv waves, pitch how it's tipped (negative: its
// face up, seen from above), yw how much it turns about its upright (the rest round its face), det its least detail. The
// closed gem's own genes (stage 4): sqx, sqy, sqz squash and stretch it, twy twists it about its upright, la and lf turn it
// like a lathe (rings of bulges, la how deep, lf how many); its shape's weights and superformula are kept beside them (w, sf).
const DEF = {body: 'g', k: 0, wd: 1, a: 0, b: 0, tw: 0, h: 0, wv: 0, pitch: 0, yw: 0, det: 0, sqx: 1, sqy: 1, sqz: 1, twy: 0, la: 0, lf: 4};
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
const PARAMS = ['k', 'wd', 'a', 'b', 'tw', 'h', 'wv', 'pitch', 'yw', 'sqx', 'sqy', 'sqz', 'twy', 'la', 'lf'];

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
  b.C = makeCells(NA, ADJ, rnd);   // the facets as cells (stage 5)
  b.lv = []; b.lv2 = []; for (let l = 0; l <= F; l++) { b.lv.push(new Float32Array(G.NF[l])); b.lv2.push(new Float32Array(G.NF[l])); }
  b.tint = kind === 'g' ? f => G.FA[0][f] % 3 : f => (G.CH[1][G.FA[1][f]] + (G.FA[0][f] < 4 ? 0 : 1)) % 3;
  return b;
}
const BODY = {g: makeBody('g', gemSheetGeo(3), 2), s: makeBody('s', sheetGeo(4), 3)};   // the automata: 320 facets on the gem, 512 on the square

const st = {body: 'g', form: 'gem', f: {...FORMS.gem}, g: fromForm('gem'), w: Object.fromEntries(NAMES.map(k => [k, k === 'ball' ? 1 : 0])), arch: [], seen: {}, sfA: SF.round, sfB: SF.round, sfMx: [1, 1], sfMix: 1, sfSecs: 1,
  dFrom: 1, dTo: 1, wipe: 1, ex: 0, exT: 0, off: true, hue: 0, swap: null, hold: null,
  rip: [], sec: 0, secT: -9, chk: 0, chkT: -9, s16: -1, t: 0, bars: 0, secBars: 0, type: null, prog: null, progs: {}, phr: -1,
  run: 0, kicks: 0, lastBeatT: 0, stabs: [], spinT: -9, hatWas: 0, burstT: -9, waveT: -9, dropT: -9, lastDrop: null, lastHit: 0, glow: 0, kickT: -9, spin: 0, brk: false, act: .2};
// a section's program: its theme (a shape), its symmetry, which pattern each part of the music plays
function programFor(type, T){
  const id = tid(type); if (id && st.progs[id]) return st.progs[id];
  seed = 1 + Math.floor(hashStr('p' + id + ':' + salt())*2147483000);   // (each visit its own: it always began on the same shape)
  const live = T > .5;
  // its theme: the shape it starts from and comes back to with variations (the closed gem most of the time: the flat star is a
  // moment, not home)
  const p = {theme: archetype(pickArch(live ? .65 : .3, true)), visits: 0,
    det: live ? 1.6 + rnd()*1.2 : .6 + rnd()*1.3, n: {g: pick([5, 5, 10]), s: pick([4, 6, 8])},
    kick: pick(['ripple', 'ripple', 'cascade', 'pulse']), stab: pick(['sectors', 'checker', 'rings']), spiral: [pick([1, 2, 3, 5]), pick([2, 3, 5])],
    figure: pick(live ? ['improv', 'life', 'swell', 'fireflies', 'fireflies', 'frost'] : ['spots', 'stripes', 'frost', 'spots', 'improv', 'life']), brk: rnd() < .35 ? 'star' : 'gem', extrude: .5 + rnd()*.8, seed: rnd()*1000,
    rest: pick(['figure', 'sectors', 'spiral', 'ripple']), rings: pick(['out', 'out', 'in']), tex: pickTex(live), room: pickRoom()};   // (figure: life, the improvised one, or the facets as cells; rest: the one pattern it plays when calm; rings: the kick's run out from the middle or close in from the rim)
  if (id) st.progs[id] = p;
  return p;
}
// for tests and stills: its state, a section's program, and holding a form (null lets the music choose again)
export const prismState = () => { const b = BODY[st.body]; return {act: st.act, asym: st.asym, form: st.form, body: st.body, f: st.f, g: st.swap ? st.swap.g : st.g, w: st.w, det: st.dTo, shapes: topShapes(st.w), X: b.X, D: b.D, G: b.G, prog: st.prog, swapping: !!st.swap, arch: st.arch.length, tex: st.tex ? st.tex.to : 'glass', beams: OVER.n, inGlass: Array.from({length: BO.n}, (_, i) => BO.segs[i*10 + 9]).filter(v => v > .5).length, split: BO.n, sw: st.sw || 0, flat: st.flat || 0, ex: st.ex, spin: st.spin, imgs: st.nImg || 0, style: STAGE.style, refl: STAGE.refl || 0, caus: STAGE.nCaus || 0}; };
export const prismClear = v => { st.testClear = v; };   // (tests: play as if the beat were this steady; undefined lets Journey say)
export const prismTex = k => { setTex(k); };
export const prismShape = name => { st.hold = name; const g = archetype(name); goGenome(g, true); };   // (tests and stills: one of the named shapes, held; prismForm(null) lets go)   // (tests and stills: sweep to this texture)
export const prismProgram = (type, T) => programFor(type, T);
export const prismForm = (k, now) => { st.hold = k; if (k) { const g = fromForm(k, st.g); goGenome(g, now); if (now) { snapTo(g); } } };
export const prismImprovise = (size = .5) => improvise(size, 0);   // (tests: one step of the improviser now)
export const prismSection = ty => { st.testType = ty; };
export const prismRunUp = a => { st.testRunUp = a; };
// the Prism lab (src/lab/prism.js): each holds one thing (undefined lets the music say again)
export const prismBrk = v => { st.testBrk = v; };
export const prismTension = v => { st.testTen = v; };
export const prismCam = k => { st.testCam = k; };   // 'far', 'mid', 'near', 'inside' or 'low'
export const prismLasers = (on, show) => { st.testLasers = on; st.testShow = show; };   // show: 'fan', 'cross', 'star' or 'scan'
export const prismFigure = k => { if (st.prog) st.prog.figure = k; };   // RULES, 'life' or 'improv'
export const prismDetail = n => { setDetail(n); };
export const prismShapes = () => Object.keys(ARCH);
export const prismTexs = () => Object.keys(TEXCODE);
export const laserShows = () => SHOWS;

export default {
  key: 'prism', kind: 'object', label: 'Prism (full)', words: 'A prism of facets opens into a star, rises into mountains and folds back into shapes with the music', optIn: true,
  dance: {moves: {face: 2.5, spin: 1.2, float: 1, rise: .7, approach: 1.1, pulse: 1, still: .6, groove: .4, bang: .2, look: .3}, sym: 5, liftPart: 1},
  // (a plain mesh of the closed gem's finest facets, for the tests and the Asset Viewer)
  get mesh(){ const G = BODY.g.G, pos = Array.from(G.DIR, x => x*.45); return this._m || (this._m = {pieces: [{pos, tri: Array.from(G.TRI), part: Array.from({length: G.nf}, (_, f) => 1 + G.FA[0][f] % 6)}], hinge: [0, 0, 0]}); },
  stats: '20 to 2,048 facets: a gem in ten shapes that opens into a star, mountains, waves, a tube, a ring, a twist',
  onBeat(pos){
    st.run++; st.beat = pos;
    if (pos === 0 && st.prog && RULES.includes(st.prog.figure)) { const b = BODY[st.body], ru = st.prog.figure; if (ru !== 'fireflies' && ru !== 'swell') touch(b.C, ru, symCells(b, st.bars), .7); }   // (the bar seeds the cells, at n points round the middle)
    if (pos === 0) { st.bars++; st.secBars++; st.glow = 1; st.barT = st.t; if (st.prog && st.prog.figure === 'life' && (st.secBars >= TUNE.prism.layerBars.life || st.prog.rest === 'figure')) stepLife(BODY[st.body]); }
  },
  breakApart(){ st.exT = 1; },
  params(P, x){
    const T = TUNE.prism, J = x.J, dt = x.dt, w = P.o.prism || 0, ten = st.testTen ?? (J ? J.tension || 0 : .5);
    st.t += dt;
    // how steady the beat is: music played freely (no dance pulse) gets swells, not drops, and its own slow time (TUNE.prism.free)
    const steady = st.clear = st.testClear ?? (J && J.on && J.beatClear != null ? J.beatClear : 1), free = 1 - steady, FR = T.free;
    // the section: a new program, its layers sequenced in again
    const type = st.testType !== undefined ? st.testType : J && J.on ? J.type : null;
    if (type !== st.type || !st.prog) { st.type = type; st.prog = programFor(type, ten); st.secBars = 0; st.climb0 = 0;
      if (!st.hold) { const pr = st.prog; goGenome(pr.visits++ ? mutate(pr.theme, TUNE.prism.imp.vary, want()) : pr.theme); } setDetail(detFor()); setTex(st.prog.tex); }
    const pr = st.prog;
    // a drop: it shatters, gains every facet, and a closed form opens out into mountains or an open one snaps shut into a star
    if (J && st.lastDrop !== null && J.lastDrop !== st.lastDrop && st.prog) { const C = BODY[st.body].C; if (st.prog.figure === 'fireflies') syncAll(C); else if (st.prog.figure === 'frost') C.f.fill(1); else if (st.prog.figure === 'swell') touch(C, 'swell', [...C.out.keys()].filter((_, i) => i % 7 === 0), 1); }
    if (J && st.lastDrop !== null && J.lastDrop !== st.lastDrop) { st.dropT = st.t; st.asymT = st.t; st.asymAx = dirAt(.35 + .3*hash(st.run*.3), hash(st.run*.9)*Math.PI*2); st.climb0 = st.secBars + T.act.dropBars; setTex(pick(['iris', 'stained', 'led', 'mirror'])); st.dropK = steady; st.exT = Math.max(st.exT, (J.on ? 1 : .6)*steady*steady*T.on.shatter); setDetail(BODY[st.body].F, steady < .5 ? 0 : 1);   // (without a steady beat: a swell, not a shatter)
      if (!st.hold) { if (closed() > .5 && !(P.w.room > .5)) goGenome(fromForm('peaks', st.g)); else goGenome(spiky(st.g)); } }   // (in the room it always snaps shut, round the camera diving in)
    st.lastDrop = J ? J.lastDrop : null;
    // how much may move (docs/prism-plan.md, stage 3): the tension, lifted through a drop's run-up and by the drop itself, held
    // low in a breakdown, eased (quicker down than up). Calm, it holds its shape, turns slowly and glints, with one quiet pattern
    // Not the tension's level (steady full-on techno sits high all the time, and kept it busy), but the music moving: a slow
    // climb through a section, the tension rising above its own recent level, the run-up to a drop and the drop
    const TA = T.act, anticip = runUp(J), dropLen = TA.dropBars*4*S.beatPeriod, since = st.t - st.dropT;
    st.tFast = (st.tFast ?? ten) + (ten - (st.tFast ?? ten))*Math.min(1, dt/TA.fastSecs); st.tSlow = (st.tSlow ?? ten) + (ten - (st.tSlow ?? ten))*Math.min(1, dt/TA.slowSecs);
    // the arc (stage 6): the climb starts again after a drop's release, so a long calm follows each drop
    const climbBars = Math.max(0, st.secBars - Math.max(0, st.climb0 || 0));
    const afterDrop = since < dropLen + T.arc.calmBars*4*S.beatPeriod;   // (the drop's release and the calm after it: high tension then isn't a build)
    let goal = Math.min(TA.cap, TA.base + TA.climb*smooth(climbBars/TA.climbBars)*(.4 + .6*ten) + (afterDrop ? 0 : TA.rising*Math.max(0, st.tFast - st.tSlow)));
    if (anticip > .02) goal = Math.max(goal, TA.runUp + (1 - TA.runUp)*anticip);
    if (since < dropLen) goal = Math.max(goal, (1 - since/dropLen)*(FR.dropFloor + (1 - FR.dropFloor)*(st.dropK ?? 1)));
    if (brkNow()) goal *= TA.brk;
    goal *= 1 - free*FR.actCut;
    st.act += (goal - st.act)*Math.min(1, dt/((goal > st.act ? TA.rise : TA.fall)*(1 + free*FR.slower)));   // (freely played music: rising and settling slowly)
    if (w < .003) { st.off = true; return; }
    if (st.off) { st.off = false; st.ex = st.exT = 1; if (st.swap) { const g = st.swap.g; st.swap = null; setBody(g.body); goGenome(g); } }   // arriving: it gathers out of its facets
    st.exT *= Math.exp(-dt/T.explodeSecs); st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
    // flying from one body to the other: once its facets are out, it gathers again as the other
    if (st.swap && st.t - st.swap.t > T.swapSecs) { const g = st.swap.g; st.swap = null; setBody(g.body); goGenome(g); }
    // the 16ths (on the beat grid's bar ramp; without a lock, the beats alone)
    const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : (st.run*4) % 16;
    if (s16 !== st.s16) { st.s16 = s16; step16(BODY[st.body]); }
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; if (st.act >= TA.at.everyKick || st.beat === 0) kick(ten); }   // (calm: the kick's light only on the 1)
    // stabs: the wedges step on, the checker flips, the superformula gains points; three in a bar spin the wedges for a bar
    if (x.hit > .8 && st.lastHit <= .8) { st.sec++; st.secT = st.t; st.chk ^= 1; st.chkT = st.t; st.hue += .1;
      if (RULES.includes(pr.figure)) { const bb = BODY[st.body]; if (pr.figure === 'frost') clear(bb.C, wedgeCells(bb, st.sec)); else if (pr.figure !== 'fireflies') touch(bb.C, pr.figure, symCells(bb, st.sec*3 + 1), .5); }
      const b = SF[st.g.sf]; setSf([b[0] + 2*(st.sec % 3), b[1], b[2], b[3]], T.stabSfSecs);
      st.stabs = st.stabs.filter(t => st.t - t < 4*S.beatPeriod); st.stabs.push(st.t); if (st.stabs.length >= 3) { st.spinT = st.t; st.spinV = Math.max(st.spinV || 0, T.spinBurst*at('spin')*steady*steady); } }
    st.lastHit = x.hit;
    // the hats coming in scatter sparks and add a level of facets
    if (SIG.hat > .45 && st.hatWas < .2 && st.secBars >= 2 && at('grow') > .5) { st.burstT = st.t; setDetail(st.dTo + 1); }
    st.hatWas = SIG.hat > .45 ? SIG.hat : Math.min(st.hatWas, SIG.hat);
    // no bars coming (nothing for the beat grid to lock to: pads, a beatless intro, paused): it keeps its own slow time
    if (st.t - (st.barT ?? st.t) > T.imp.noBarSecs) { st.barT = st.t; st.bars++; st.secBars++; }
    st.barT ??= st.t;
    // a phrase line: the improviser takes a step from where it is (bigger as the music builds, now and then a leap); every other one when calm
    const phrase = steady > .5 ? st.secBars > 0 && st.secBars % (st.act < TA.at.form ? 8 : 4) === 0 && st.phr !== st.bars
      : st.t - (st.phrT ?? st.t - 1) >= FR.phraseSecs*(st.act < TA.at.form ? 2 : 1);   // (no steady bars: its own unhurried phrases)
    if (phrase) { st.phr = st.bars; st.phrT = st.t;
      if (!st.hold && st.t - st.dropT > 8*S.beatPeriod) { const an = runUp(J);   // (a drop's run-up: bigger steps and leaps as it nears)
        const sk = 1 - free*FR.stepCut;   // (freely played: smaller steps, more often a variation than a new shape)
        improvise((brkNow() && an < .05 ? T.imp.step*.6 : T.imp.step + st.act*T.imp.stepAct + an*T.arc.stepBuild)*sk, (brkNow() && an < .05 ? 0 : T.imp.leap + st.act*T.imp.leapAct + an*T.arc.leapBuild)*sk, sk); } }   // (a breakdown: small, calm steps)
    // a breakdown lays it down calm with fewer facets; after it, and a while after a drop, back to the section's own
    if (brkNow() && !st.brk) { if (!st.hold) goGenome(P.w.room > .5 ? fromForm('peaks', st.g) : pr.brk === 'star' ? fromForm('star', st.g) : calmer()); setDetail(1 + rnd()*.8); }   // (in the room: unrolled into land, ranges rising out of it)
    if (!brkNow() && st.brk) setDetail(detFor());
    st.brk = brkNow();
    // a drop's run-up climbs in facets as it nears (whole levels: the front blooms out at each)
    { const an = runUp(J); if (an > .05 && st.t - st.dropT > 2) { const want = Math.round(detFor() + an*T.arc.detBuild); if (want > st.dTo) setDetail(want); } }
    st.asym = st.asymT ? Math.max(0, 1 - (st.t - st.asymT)/(T.arc.asymBars*4*S.beatPeriod)) : 0;   // (symmetry broken at the drop, found again over these bars)
    if (st.t - st.dropT > 8*S.beatPeriod && st.t - st.dropT < 8*S.beatPeriod + dt*1.5) setDetail(detFor());
    // the form eases towards its own; the shapes blend; the detail's front blooms out from the middle
    const slow = (1.6 - .6*st.act)*(1 + free*FR.slower), tg = st.g, k = Math.min(1, dt/(T.morphSecs*slow)*2.2), kw = Math.min(1, dt/(T.morphSecs*slow)*2.5);   // (calm: slower)
    for (const p of PARAMS) st.f[p] += (tg[p] - st.f[p])*k;
    for (const n of NAMES) st.w[n] += ((tg.w[n] || 0) - st.w[n])*kw;
    st.sfMix = Math.min(1, st.sfMix + dt/st.sfSecs);
    st.wipe = Math.min(1, st.wipe + dt/(T.wipeBeats*S.beatPeriod));
    st.glow *= Math.exp(-dt*3);
    { const SW = T.swarm; st.sw = (st.sw || 0) + ((st.g.swarm ? 1 : 0) - (st.sw || 0))*Math.min(1, dt/SW.secs); if (st.g.swarm) st.swK = st.g.swarm;   // the swarm: shards flying to another object's panes
      st.flat = (st.flat || 0) + ((st.swap ? 1 : 0) - (st.flat || 0))*Math.min(1, dt/(st.swap ? T.swapSecs*.6 : SW.gather)); }   // changing body: its facets swirl into a disc, and out of it as the other
    st.spinV = (st.spinV || 0)*Math.exp(-dt/T.spinBurstSecs);   // (a burst eases out: it used to stop dead and snap back)
    st.spin += dt*(T.spin*(1 - .6*TUNE.dance.amount)*(TA.spinCalm + (1 - TA.spinCalm)*st.act)*(1 - free*FR.spinCut) + st.spinV);
    const b = BODY[st.body];
    if (b.kind === 'g') shapeGem(b, P, x); else shapeSheet(b, P, x);
    if (RULES.includes(pr.figure)) stepCells(b.C, pr.figure, dt, T.cells, S.beatPeriod, flyK(J), rnd);
    light(b, P, x);
    // where it stands and how it turns (its dance on top): a flat form turns about its face, never edge-on
    const An = P.anchor, d = DANCE.obj.prism, f = st.f, burst = 0, sway = .4 + .6*st.act;
    const U = P.m = P.m || {};
    const u = U.prism = {rot: st.spin*f.yw + burst + Math.sin(x.t*.11)*.15*(1 - f.yw)*sway, pitch: f.pitch + Math.sin(x.t*.19)*.08*sway, roll: st.spin*(1 - f.yw)*.5,
      size: (An && An.size || T.size)*(1 + (P.bass || 0)*x.react*.03*st.act), pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, (f.pitch < 0 ? -.04 : .02) + P.wind.y*TUNE.ctx.windObject],
      line: TUNE.mesh.line, w: An && An.hide ? 0 : Math.min(1, w*1.2), X: b.X, body: st.body};
    if (d) { const dm = (TA.danceCalm + (1 - TA.danceCalm)*at('dance'))*T.on.dance;   // (its dance, small when calm)
      u.rot += d.yaw*f.yw*dm; u.roll += d.yaw*(1 - f.yw)*dm;
      u.pitch += d.pitch*(f.pitch < 0 ? .3 : 1)*dm; u.roll += d.roll*dm; u.pos = [u.pos[0] + d.dx*dm, u.pos[1] + d.dy*dm]; u.size *= 1 + (d.s - 1)*dm; u.sq = d.sq*(f.pitch < 0 ? .3 : 1)*dm; }
    const Vw = S.view; if (Vw && Vw.key === 'prism') { u.rot = Vw.yaw + (d ? d.yaw : 0); u.pitch += Vw.pitch; u.size *= Vw.zoom; }
    if (JAM.on || JAM.pulls.length || Math.abs(JAM.yaw) + Math.abs(JAM.tilt) > 1e-4) { jamStep(dt); u.rot += JAM.yaw; u.pitch += JAM.tilt; }   // your hand on it (the Prism lab's Jam)
    const rw = Math.min(1, P.w.room || 0); if (rw > .01) room(u, P, x, rw); else STAGE.on = 0;
    colour(b, P, x, u, w);
    lasers(b, u, P, x, rw); show3d(u, P, x, rw); st.lastU = u;
  },
  drawGL(gl, P, W, H, stage){ if (stage === 'trails') return;
    const u = P.m.prism, b = BODY[u.body]; if (this._gen !== S.glGen) { this._gl = {}; this._gen = S.glGen; }
    const dr = this._gl[u.body] = this._gl[u.body] || facetGL(gl, b.G);
    if (stage === 'screen' && u.images) for (const im of u.images) dr(b.X, {...u, dim: im.dim}, W, H, stage, im.M);   // its images in the mirror chamber, farthest first
    if (stage === 'screen' && u.mirror) dr(b.X, {...u, dim: u.refl}, W, H, stage, u.mirror);   // its reflection in the floor
    dr(b.X, u, W, H, stage);
    if (stage === 'screen' && OVER.n) (this._gl.beams = this._gl.beams || beamsGL(gl))(overPx(W, H), OVER.n, W, H); },
  draw2d(o, P){ const u = P.m.prism; if (u.images) for (const im of u.images.slice(-TUNE.prism.chamber.max2d)) { o.save(); o.globalAlpha = im.dim; facet2d(o, BODY[u.body].G, BODY[u.body].X, u, im.M); o.restore(); }
    if (u.mirror) { o.save(); o.globalAlpha = u.refl; facet2d(o, BODY[u.body].G, BODY[u.body].X, u, u.mirror); o.restore(); } facet2d(o, BODY[u.body].G, BODY[u.body].X, u); if (OVER.n) beams2d(o, overPx(o.canvas.width, o.canvas.height), OVER.n); },
  path2d(o, P){ const u = P.m.prism; facetPath2d(o, BODY[u.body].G, BODY[u.body].X, u); },
};

// ---- 3D lasers (docs/prism-plan.md, stage 9): the 2D lasers' shows (a fan, a crossing, a star, a scan) aimed at the Prism from
// the room's walls, traced through it (objects/beams.js): bouncing off, bending in, split into a rainbow or trapped inside, flaring
// where they touch and leaving a fading trace on the facets they meet. One beam when calm, more as it builds, all through it on
// the drop. Those inside the glass or in front of it are drawn over it; the rest the room draws behind it ----
const BO = beamOut(160), VV = new Float32Array(3000*3), FNV = new Float32Array(2048*3), OVER = {list: new Float32Array(OV*10), n: 0}, PX = new Float32Array(OV*10);
// the shows: from the Prism itself (a burst of rays from its heart, out through its facets in its own symmetry, each splitting into
// a rainbow; a sheet of light cutting through it, drawing its outline where it cuts) or from the walls (a fan, a crossing, a star,
// a scan), weighted by TUNE.prism.lasers.shows
const SHOWS = ['burst', 'sheet', 'fan', 'cross', 'star', 'scan'];
function pickShow(k){ const w = TUNE.prism.lasers.shows, tot = SHOWS.reduce((a, s) => a + (w[s] || 0), 0); let r = hash(k)*tot;
  for (const s of SHOWS) if ((r -= (w[s] || 0)) < 0) return s; return 'burst'; }
// a segment over the Prism, in screen heights: x0 y0 x1 y1, width, colour, kind (0 a beam, 1 a flare), where a pulse runs along it (-1 none)
const over = (a) => { if (OVER.n < OV) { OVER.list.set(a, OVER.n*10); OVER.n++; } };
function lasers(b, u, P, x, rw){
  OVER.n = 0; STAGE.nBeams = 0; STAGE.nCaus = 0; const LT = TUNE.prism.lasers;
  const lz = b.lz || (b.lz = new Float32Array(b.nf)); for (let f = 0; f < b.nf; f++) lz[f] *= Math.exp(-x.dt/LT.traceSecs);
  if (rw < .01 || u.inside || st.testLasers === false || !TUNE.prism.on.lasers && !st.testShow) return;
  const an = runUp(x.J), dropLen = LT.dropBars*4*S.beatPeriod, since = st.t - st.dropT, drop = since < dropLen;
  const lv = Math.min(1, Math.max(st.act/TUNE.prism.act.cap*LT.calmShare, an, drop ? 1 : 0)), nOn = drop ? LT.max : Math.min(LT.max, 1 + Math.round(lv*(LT.max - 2)));
  const show = st.testShow || (drop ? 'burst' : pickShow(Math.floor(st.bars/LT.showBars) + (st.prog ? st.prog.seed : 0)));
  const h = (P.hue || 0) + st.hue, pal = P.pal || [0, .33, .67], t = st.t, br = (LT.calm + (1 - LT.calm)*lv)*rw, emit = [];
  const col = i => hsv2rgb(h + pal[i % 3], .85, 1).map(v => v*br);
  const aim = (p, q, i) => { const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(...d) || 1; emit.push({p, d: d.map(v => v/l), c: col(i)}); };
  // the Prism in view space (as the facet engine turns it)
  const X = b.X, Pp = X.pos, cr = Math.cos(u.rot), sr = Math.sin(u.rot), cp = Math.cos(u.pitch), sp = Math.sin(u.pitch), co = Math.cos(u.roll || 0), so = Math.sin(u.roll || 0);
  const turn = (x0, y0, z0, o, k) => { const x1 = cr*x0 + sr*z0, z1 = -sr*x0 + cr*z0, y2 = cp*y0 - sp*z1; o[k + 2] = sp*y0 + cp*z1; o[k] = co*x1 - so*y2; o[k + 1] = so*x1 + co*y2; };
  let rmax = 0; for (let v = 0; v < b.nv; v++) { turn(Pp[v*3], Pp[v*3 + 1], Pp[v*3 + 2], VV, v*3); rmax = Math.max(rmax, Math.hypot(VV[v*3], VV[v*3 + 1], VV[v*3 + 2])); }
  const cl = closed() > .5, TRI = b.G.TRI, n = st.prog ? st.prog.n[b.kind] : 5, D3 = [0, 0, 0];
  for (let f = 0; f < b.nf; f++) { turn(X.fn[f*3], X.fn[f*3 + 1], X.fn[f*3 + 2], FNV, f*3);
    if (cl) { const a = TRI[f*3]*3, cx = VV[a], cy = VV[a + 1], cz = VV[a + 2]; if (cx*FNV[f*3] + cy*FNV[f*3 + 1] + cz*FNV[f*3 + 2] < 0) for (let i = 0; i < 3; i++) FNV[f*3 + i] *= -1; } }
  let sheet = null;
  if (show === 'burst') {   // rays from its heart, out in its own symmetry (turning with it), leaving through the facets as rainbows
    const k = drop ? Math.min(12, n*2) : Math.max(n, Math.min(nOn, 10)), r0 = .35 + .2*Math.sin(t*.13);
    for (let i = 0; i < k; i++) { const d0 = dirAt(i % 2 && k > n ? r0 + .25 : r0, i/k*Math.PI*2 + t*.05); turn(d0[0], d0[1], d0[2], D3, 0);
      emit.push({p: [0, 0, 0], d: [...D3], c: col(i).map(v => v*1.3), inside: cl}); } }
  else if (show === 'sheet') {   // a plane of light, tipped towards the camera (its outline reads as a ring), turning slowly, sweeping through it over a few bars
    const a = t*.11, nrm = [Math.sin(a)*.55, .75, .65 + .25*Math.cos(a*.7)], nl = Math.hypot(...nrm), sw = Math.sin(t*Math.PI*2/(LT.sheetBars*4*Math.max(.25, S.beatPeriod)));
    sheet = {n: nrm.map(v => v/nl), d: sw*rmax*.8, c: col(1).map(v => v*2.6)}; }
  else for (let i = 0; i < nOn; i++) { const s = nOn > 1 ? i/(nOn - 1) - .5 : 0;
    if (show === 'fan') aim([0, 2.2, -2.4], [s*.9 + .3*Math.sin(t*.6), -.1, 0], i);
    else if (show === 'cross') { const sd = i % 2 ? 1 : -1; aim([2.6*sd, .4, -1.2], [-.3*sd + .25*Math.sin(t*.8 + i), .15*Math.cos(t*1.1 + i), 0], i); }
    else if (show === 'star') { const a = i/nOn*Math.PI*2 + t*.2; aim([2.8*Math.cos(a), 1.7*Math.sin(a), -1.4], [.08*Math.sin(t + i), .08*Math.cos(t*1.3 + i), 0], i); }
    else aim([0, -.4, -2.9], [.4*Math.sin(t*.9 + i*1.7), .3*Math.sin(t*1.3 + i*2.1), 0], i); }
  traceBeams(VV, TRI, FNV, b.nf, emit, {closed: cl, rmax: rmax + .02, walls: TUNE.prism.room.walls, floor: STAGE.n && TUNE.prism.on.floor ? [STAGE.n[0], STAGE.n[1], STAGE.n[2], STAGE.floor] : null,
    n: LT.index, maxSegs: 160, maxDepth: LT.depth, splits: show === 'burst' ? 12 : LT.splits}, BO);
  for (const [f, v] of BO.lit) lz[f] = Math.max(lz[f], v);
  // to the screen (in screen heights from the middle), each segment cut at the camera's near plane; a pulse runs out along each
  // beam on the kick (from the Prism: outwards)
  const cam = u.cam || CAM, fo = u.size*FOCAL, pos = u.pos, zc = cam - .15, Z = STAGE.beams, pulse = st.t - st.kickT < LT.pulseSecs ? (st.t - st.kickT)/LT.pulseSecs : -1; let nb = 0;
  const pr = (x0, y0, z0) => { const dz = cam - z0; return [pos[0] + x0*fo/dz, pos[1] + y0*fo/dz]; };
  const clip = (a, c) => { if (a[2] > zc && c[2] > zc) return null;
    if (a[2] > zc || c[2] > zc) { const k = (zc - a[2])/(c[2] - a[2]), m = [a[0] + (c[0] - a[0])*k, a[1] + (c[1] - a[1])*k, zc]; if (a[2] > zc) a = m; else c = m; } return [a, c]; };
  for (let i = 0; i < BO.n; i++) { const g = BO.segs.subarray(i*10, i*10 + 10), cc = clip([g[0], g[1], g[2]], [g[3], g[4], g[5]]); if (!cc) continue;
    const [a, c] = cc, A = pr(...a), B = pr(...c), ov = g[9] > .5 || (a[2] + c[2])/2 > -.1, w = LT.width*(g[9] > .5 ? .8 : 1);
    if (ov) over([A[0], A[1], B[0], B[1], w, g[6], g[7], g[8], 0, pulse]);
    else if (nb < STAGE.MAXB) { Z.set([A[0], A[1], B[0], B[1]], nb*4); STAGE.beamC.set([g[6], g[7], g[8], w], nb*4); nb++; } }
  for (let i = 0; i < BO.nFl; i++) { const q = BO.flares.subarray(i*4, i*4 + 4), dz = cam - q[2]; if (dz < .2) continue; const A = pr(q[0], q[1], q[2]);
    over([A[0], A[1], 0, 0, LT.flare*(.5 + q[3])*fo/dz, q[3], q[3]*.9, q[3]*.8, 1, -1]); }
  // caustics: the light that's been through the glass landing on the floor and walls, a rainbow smear (the room draws them)
  for (let i = 0; i < BO.nL && i < 8 && TUNE.prism.on.caustics && (TUNE.prism.on.floor || TUNE.prism.on.walls); i++) { const q = BO.land.subarray(i*6, i*6 + 6), dz = cam - q[2]; if (dz < .3) continue; const A = pr(q[0], q[1], q[2]);
    STAGE.caus.set([A[0], A[1], LT.caustic*fo/dz, 1], i*4); STAGE.causC.set([q[3], q[4], q[5]], i*3); STAGE.nCaus = i + 1; }
  STAGE.caus.fill(0, STAGE.nCaus*4);
  // the sheet: its outline round the Prism where it cuts each facet, the facets it crosses lit, and the sheet itself a fan in the haze
  if (sheet) { const {n: N, d, c} = sheet, cut = [];
    for (let f = 0; f < b.nf; f++) { if (X.vis && !X.vis[f]) continue; const ia = TRI[f*3]*3, ib = TRI[f*3 + 1]*3, ic = TRI[f*3 + 2]*3, P3 = [ia, ib, ic];
      const s3 = P3.map(k => VV[k]*N[0] + VV[k + 1]*N[1] + VV[k + 2]*N[2] - d); if ((s3[0] > 0) === (s3[1] > 0) && (s3[1] > 0) === (s3[2] > 0)) continue;
      const pts = []; for (let j = 0; j < 3; j++) { const k0 = j, k1 = (j + 1) % 3; if ((s3[k0] > 0) !== (s3[k1] > 0)) { const q = s3[k0]/(s3[k0] - s3[k1]), A = P3[k0], B = P3[k1];
        pts.push([VV[A] + (VV[B] - VV[A])*q, VV[A + 1] + (VV[B + 1] - VV[A + 1])*q, VV[A + 2] + (VV[B + 2] - VV[A + 2])*q]); } }
      if (pts.length === 2) { cut.push(pts); lz[f] = Math.max(lz[f], .8); } }
    for (const [a0, c0] of cut) { const cc = clip(a0, c0); if (!cc) continue; const A = pr(...cc[0]), B = pr(...cc[1]); over([A[0], A[1], B[0], B[1], LT.width*1.2, c[0], c[1], c[2], 0, -1]); }
    // the fan: rays in the plane from a point on the wall behind, through the cut, faint
    const e1 = Math.abs(N[1]) < .9 ? [0, 1, 0] : [1, 0, 0], u1 = norm3(cross3(N, e1)), v1 = cross3(N, u1), src = [N[0]*d - v1[0]*3, N[1]*d - v1[1]*3, N[2]*d - v1[2]*3];
    for (let i = 0; i < 9; i++) { const s2 = (i/8 - .5)*1.2, q = [N[0]*d + u1[0]*s2*2.5 + v1[0]*2, N[1]*d + u1[1]*s2*2.5 + v1[1]*2, N[2]*d + u1[2]*s2*2.5 + v1[2]*2], cc = clip(src, q); if (!cc) continue;
      const A = pr(...cc[0]), B = pr(...cc[1]); if (nb < STAGE.MAXB) { Z.set([A[0], A[1], B[0], B[1]], nb*4); STAGE.beamC.set([c[0]*.08, c[1]*.08, c[2]*.08, LT.width*1.5], nb*4); nb++; } } }
  STAGE.nBeams = nb; Z.fill(0, nb*4);
}
const cross3 = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v/l); };
// the beams over it, in pixels
function overPx(W, H){ for (let i = 0; i < OVER.n; i++) { const k = i*10, L = OVER.list;
  PX[k] = W/2 + L[k]*H; PX[k + 1] = H/2 - L[k + 1]*H; PX[k + 2] = W/2 + L[k + 2]*H; PX[k + 3] = H/2 - L[k + 3]*H; PX[k + 4] = L[k + 4]*H; for (let j = 5; j < 10; j++) PX[k + j] = L[k + j]; }
  return PX; }

// ---- jamming (the Prism lab's Jam): your hand on it while the music plays, the picture only. Dragging turns and tips it (it
// spins on when let go, then settles face on to its own symmetry within a beat); pressing on it and dragging outward pulls out
// a spike, inward or holding pushes a dent, at each of its symmetric copies, springing back when let go and bouncing at the
// beat's own speed; a tap sends a ring of light out from that point, brighter the nearer the beat. TUNE.prism.jam ----
export const JAM = {on: false, drag: false, yaw: 0, yawV: 0, tilt: 0, tiltV: 0, pulls: []};
// the point on it under a point on the screen (screen heights from the middle), as a direction on its ball, or null off it
export function prismPick(sx, sy){
  const u = st.lastU; if (!u) return null;
  const cam = u.cam || CAM, f = u.size*FOCAL, dx = (sx - u.pos[0])/f, dy = (sy - u.pos[1])/f, dl = Math.hypot(dx, dy, 1), d = [dx/dl, dy/dl, -1/dl], o = [0, 0, cam];
  const R = TUNE.prism.r*1.05, b = o[0]*d[0] + o[1]*d[1] + o[2]*d[2], c = o[2]*o[2] - R*R, disc = b*b - c, hit = disc > 0;
  const t = hit ? -b - Math.sqrt(disc) : -b, p = [d[0]*t, d[1]*t, cam + d[2]*t];
  const cr = Math.cos(u.rot), sr = Math.sin(u.rot), cp = Math.cos(u.pitch), sp = Math.sin(u.pitch), co = Math.cos(u.roll || 0), so = Math.sin(u.roll || 0);
  const x1 = co*p[0] + so*p[1], y2 = -so*p[0] + co*p[1], z2 = p[2], y = cp*y2 + sp*z2, z1 = -sp*y2 + cp*z2, x = cr*x1 - sr*z1, z = sr*x1 + cr*z1, l = Math.hypot(x, y, z) || 1;
  return {dir: [x/l, y/l, z/l], hit, c: u.pos};
}
// a new pull at a point (its symmetric copies about the front axis, the gem's own); the lab moves it with jamPull
export function jamGrab(dir){ const n = st.prog ? st.prog.n[st.body] : 5, cs = [];
  for (let i = 0; i < n; i++) { const a = i/n*Math.PI*2, c = Math.cos(a), s2 = Math.sin(a); cs.push(c*dir[0] - s2*dir[1], s2*dir[0] + c*dir[1], dir[2]); }
  const q = {cs, amt: 0, v: 0, target: 0, held: true}; JAM.pulls.push(q); if (JAM.pulls.length > TUNE.prism.jam.max) JAM.pulls.shift(); return q; }
// a tap: a ring of light from there, brighter the nearer the beat
export function jamTap(dir){ const ph = SIG.beatPhase || 0, off = Math.min(ph, 1 - ph), acc = Math.max(0, 1 - off*4);
  st.rip.push({o: dir, t: st.t, k: .5 + acc*TUNE.prism.jam.tapBright, inv: false}); if (st.rip.length > 6) st.rip.shift(); return acc; }
function jamStep(dt){
  const J2 = TUNE.prism.jam, bp = Math.max(.25, S.beatPeriod || .5), w = Math.PI*2/bp*J2.bounce, z = J2.damp, n = st.prog ? st.prog.n[st.body] : 5, sym = Math.PI*2/n;
  for (const q of JAM.pulls) { if (q.held) { q.amt += (q.target - q.amt)*Math.min(1, dt*12); q.v = 0; continue; }
    for (let k = 0; k < 4; k++) { const h = dt/4, a = -w*w*q.amt - 2*z*w*q.v; q.v += a*h; q.amt += q.v*h; } }
  JAM.pulls = JAM.pulls.filter(q => q.held || Math.abs(q.amt) + Math.abs(q.v)*.05 > .002);
  if (!JAM.drag) {   // let go: it spins on, slowing, then settles face on to its symmetry within a beat; its tilt springs back
    JAM.yawV *= Math.exp(-dt*J2.friction); JAM.yaw += JAM.yawV*dt;
    if (Math.abs(JAM.yawV) < .4) { const tg = Math.round(JAM.yaw/sym)*sym; JAM.yaw += (tg - JAM.yaw)*Math.min(1, dt/(bp*.5)); }
    for (let k = 0; k < 4; k++) { const h = dt/4, a = -w*w*JAM.tilt - 2*z*w*JAM.tiltV; JAM.tiltV += a*h; JAM.tilt += JAM.tiltV*h; } }
}

// ---- the room's style: the soft studio cove or the mirror chamber (and those step 4 adds), a section's own ----
function pickRoom(){ const w = TUNE.prism.styles, ks = Object.keys(w), tot = ks.reduce((a, k) => a + w[k], 0); let r = rnd()*tot;
  for (const k of ks) if ((r -= w[k]) < 0) return k; return ks[0]; }
export const roomStyles = () => Object.keys(TUNE.prism.styles);
export const prismStyle = k => { st.testStyle = k; };   // (the lab and tests: hold a style; undefined lets the section say)
// the mirror chamber's images of the Prism: its reflections across the walls (a regular polygon of mirrors standing round it on
// the floor), and theirs, a few deep, each a 3×4 matrix in view space for the facet engine, farthest first
function chamber(cam, e, w){
  const CH = TUNE.prism.chamber, N = CH.N, A = CH.apothem, rot = Math.PI/2 + (st.chRot || 0), cq = cam*Math.cos(e);
  // (looked into from its open end, as a kaleidoscope is: the walls between the camera and the Prism aren't there)
  const ms = Array.from({length: N}, (_, i) => [Math.cos(rot + i*2*Math.PI/N), Math.sin(rot + i*2*Math.PI/N)]).filter(m => m[1]*cq <= A);
  const seen = new Set(['0,0,10,0']), all = []; let front = [{K: [1, 0, 0, 1], t: [0, 0], d: 0}];
  for (let dp = 1; dp <= CH.depth; dp++) { const next = [];
    for (const im of front) for (const m of ms) { const R = [1 - 2*m[0]*m[0], -2*m[0]*m[1], -2*m[0]*m[1], 1 - 2*m[1]*m[1]];
      const K = [R[0]*im.K[0] + R[1]*im.K[2], R[0]*im.K[1] + R[1]*im.K[3], R[2]*im.K[0] + R[3]*im.K[2], R[2]*im.K[1] + R[3]*im.K[3]];
      const t = [R[0]*im.t[0] + R[1]*im.t[1] + 2*A*m[0], R[2]*im.t[0] + R[3]*im.t[1] + 2*A*m[1]], key = [t[0], t[1], K[0], K[1]].map(v => Math.round(v*10)).join();
      if (seen.has(key)) continue; seen.add(key); const im2 = {K, t, d: dp}; next.push(im2); all.push(im2); }
    front = next; }
  const ce = Math.cos(e), se = Math.sin(e), out = [];
  for (const im of all) { const ap = p => { const f0 = p[0], f1 = ce*p[1] + se*p[2], f2 = -se*p[1] + ce*p[2], g0 = im.K[0]*f0 + im.K[1]*f2 + im.t[0], g2 = im.K[2]*f0 + im.K[3]*f2 + im.t[1];
      return [g0, ce*f1 - se*g2, se*f1 + ce*g2]; };
    const o = ap([0, 0, 0]), X1 = ap([1, 0, 0]), Y1 = ap([0, 1, 0]), Z1 = ap([0, 0, 1]); if (o[2] > cam - .4) continue;
    out.push({M: [X1[0] - o[0], Y1[0] - o[0], Z1[0] - o[0], o[0], X1[1] - o[1], Y1[1] - o[1], Z1[1] - o[1], o[1], X1[2] - o[2], Y1[2] - o[2], Z1[2] - o[2], o[2]],
      dim: Math.pow(CH.fade, im.d)*w, dist: cam - o[2] + Math.hypot(o[0], o[1])*.2}); }
  out.sort((a, b) => a.dist - b.dist); out.length = Math.min(out.length, CH.max); out.reverse();
  STAGE.ch = [N, A, rot, w];
  return out;
}

// ---- textures (docs/prism-plan.md, stage 8): glass, frosted ice, mirror, stained glass, iridescent, LED panels, brushed metal;
// a new one sweeps across from a point, facet by facet. The shader draws their detail (render/facet.js: TEXCODE) ----
const TEXCODE = {glass: 0, stained: 1, led: 2, metal: 3, ice: 4, mirror: 0, iris: 0};
function pickTex(live){ const w = TUNE.prism.tex[live ? 'live' : 'calm'], ks = Object.keys(w), t = ks.reduce((a, k) => a + w[k], 0); let r = rnd()*t;
  for (const k of ks) if ((r -= w[k]) < 0) return k; return 'glass'; }
function setTex(k){ const cur = st.tex ? st.tex.to : 'glass'; if (k === cur) return;
  st.tex = {from: st.tex && st.t - st.tex.t0 < texSecs() ? st.tex.from : cur, to: k, t0: st.t, o: dirAt(Math.acos(1 - 2*rnd())/Math.PI, rnd()*Math.PI*2)}; }
const texSecs = () => TUNE.prism.tex.sweepBeats*Math.max(.25, S.beatPeriod);
// a facet's texture: the new one once the sweep's front has passed it
function texAt(dx, dy, dz){ const x = st.tex; if (!x) return 'glass'; const p = (st.t - x.t0)/texSecs(); if (p >= 1.2) return x.to;
  return Math.acos(Math.max(-1, Math.min(1, dx*x.o[0] + dy*x.o[1] + dz*x.o[2])))/Math.PI < p ? x.to : x.from; }
// the environment a mirror facet reflects: a floor, a bright band at the horizon in the palette's colour, a dim sky
function envAt(rx, ry, h, pal, out){ const band = Math.exp(-(((ry - .05)/.18)**2)), c = hsv2rgb(h + pal[1] + rx*.15, .6, 1), sky = ry > 0 ? .05 + .1*ry : .015;
  for (let i = 0; i < 3; i++) out[i] = c[i]*band*.55 + sky; return out; }
const ENV = [0, 0, 0];

// ---- the room (docs/prism-plan.md, stage 7): the camera's arc, the lamps, the shadow, for worlds/room.js to draw ----
// The camera follows the arc: far off a jewel when calm, drawn in through a build until facets fill the screen, diving through
// a facet on the drop to look round from inside, pulling out again; low over the land in a breakdown (the Prism unrolled into
// mountains). The lamps sweep round it: a key light, a rim light from behind, a low one the kick flashes once things build
function room(u, P, x, rw){
  const R = TUNE.prism.room, TA = TUNE.prism.act, dt = x.dt, an = runUp(x.J), dropLen = TA.dropBars*4*S.beatPeriod, since = st.t - st.dropT, kc = closed();
  let goal = R.far - (R.far - R.mid)*smooth(st.act/TA.cap), tilt = R.tilt, dive = false;
  if (an > .02) goal += (R.near - goal)*smooth(an);
  if (since < dropLen) { const q = since/dropLen; if (q < R.insideFrac) { goal = R.inside; dive = true; } else goal = R.near + (goal - R.near)*smooth((q - R.insideFrac)/(1 - R.insideFrac)); }
  else if (brkNow() && an < .05) { goal = R.brk; tilt = R.tiltLow; }
  else if (kc < .5) { goal = Math.min(goal, R.low + .8); tilt = R.tiltLow + (R.tilt - R.tiltLow)*.3; }   // (open land: low over it)
  if (!TUNE.prism.on.camera && !st.testCam) { goal = R.mid; tilt = R.tilt; dive = false; }   // (its moves with the music switched off: it holds)
  if (st.testCam) { goal = st.testCam === 'low' ? R.brk : R[st.testCam]; tilt = st.testCam === 'low' ? R.tiltLow : R.tilt; dive = st.testCam === 'inside'; }   // (the Prism lab: the camera held)
  const style = st.testStyle || (st.prog && st.prog.room) || 'cove'; STAGE.style = style;
  st.chW = (st.chW || 0) + ((style === 'mirror' ? 1 : 0) - (st.chW || 0))*Math.min(1, dt/1.5);   // the mirror chamber standing up round it, or folding away
  if (st.chW > .01) goal = Math.min(goal, TUNE.prism.chamber.camMax + (1 - st.chW)*3);   // (the camera kept near its open end)
  st.chRot = (st.chRot || 0) + dt*.02*TUNE.prism.light.move;
  st.cam ??= goal; st.tilt ??= tilt;
  st.cam += (goal - st.cam)*Math.min(1, dt/(dive || goal < st.cam - 1.5 ? R.dive : R.ease)); st.tilt += (tilt - st.tilt)*Math.min(1, dt/R.ease);
  const cam = CAM + (st.cam - CAM)*rw, e = st.tilt*rw, near = smooth((2.6 - cam)/1.4);
  u.cam = cam; u.pitch += e + (-1.35 - st.f.pitch)*(1 - kc)*near*rw;
  if (st.chW > .01 && rw > .5 && cam > .5) u.images = chamber(cam, e, st.chW*rw); else STAGE.ch = [0, 0, 0, 0];
  st.nImg = u.images ? u.images.length : 0;
  { const LT = TUNE.prism.light; if (LT.refl > .01 && TUNE.prism.on.refl && TUNE.prism.on.floor && rw > .5 && cam > .5) { u.mirror = [0, Math.cos(e), Math.sin(e), R.floor]; u.refl = LT.refl*rw; } }   // (the floor's a dark mirror: the Prism drawn reflected in it) u.pos = [u.pos[0]*(1 - rw), u.pos[1]*(1 - rw)]; u.inside = cam < .4;
  // the lamps (view space, the Prism round the origin)
  const h = (P.hue || 0) + st.hue, pal = P.pal || [0, .33, .67], ph = st.t/(16*Math.max(.25, S.beatPeriod))*Math.PI*2;
  const lift = Math.min(1, Math.max(st.act/TA.cap*.6, an, since < dropLen ? 1 - since/dropLen : 0)), k = (R.lampCalm + (1 - R.lampCalm)*lift)*rw;
  const f = u.size*FOCAL, Ls = STAGE.lamps, LS = TUNE.prism.show;
  // the light show (stage 10): the kick strobes the lamps once things build, stabs swing the key light round, a build turns every
  // lamp onto it (their cones narrowing), a breakdown leaves one soft light
  if (SIG.kick > .99 && st.t - (st.strobeT ?? -9) > .12) { st.strobeT = st.t; if (at('kick') > .5 || since < dropLen) st.strobe = 1; }
  st.strobe = (st.strobe || 0)*Math.exp(-dt*LS.strobeDecay); st.swing = (st.swing || 0) + (st.sec*LS.swing - (st.swing || 0))*Math.min(1, dt*4);
  const brk = brkNow() && an < .05, flash = 1 + st.strobe*LS.strobe*TUNE.prism.on.strobe*x.dim, LT = TUNE.prism.light, wob = (1 - an)*LT.aim/.22;
  const set = (i, p, c, kk, cone, ai) => { const l = Ls[i], ax = .22*wob*Math.sin(st.t*.7 + ai) - p[0], ay = .18*wob*Math.cos(st.t*.5 + ai*1.3) - p[1], az = -p[2], al = Math.hypot(ax, ay, az) || 1, dz = cam - p[2];
    l.p = p; l.c = c; l.k = kk; l.a = [ax/al, ay/al, az/al]; l.cone = cone; l.s = dz > .05 ? [u.pos[0] + p[0]*f/dz, u.pos[1] + p[1]*f/dz] : [0, 0]; l.vis = smooth((dz - .2)/.5); };
  // the rig: a key light in front and to one side, at the height asked (TUNE.prism.light), drifting slowly and stepping round a
  // little on each phrase line; a rim light behind it; a low fill from the other side, which the kick flashes once things build.
  // Their colours warm and cool white, the palette's as asked (a pink light on a green facet came out muddy)
  if (st.phrT !== st.rigPhr) { st.rigPhr = st.phrT; st.azT = (st.azT ?? 0) + (rnd() < .5 ? -1 : 1)*.9*LT.move; st.azT = Math.max(-1.3, Math.min(1.3, st.azT)); }
  st.az = (st.az ?? 0) + ((st.azT ?? 0) - (st.az ?? 0))*Math.min(1, dt/4);
  const az = .6 + st.az + .35*Math.sin(st.t*.05*LT.move) + st.swing, el = -.35 + 1.45*LT.height, ce = Math.cos(el), RR = 2.6;
  const tint = (w, i, sat) => { const p2 = hsv2rgb(h + pal[i], sat, 1); return w.map((v, j) => v + (p2[j] - v)*LT.colour); };
  const narrow = 1 - LS.narrow*an;
  set(0, [RR*ce*Math.sin(az), RR*Math.sin(el), RR*ce*Math.cos(az)], tint([1, .88, .74], 0, .45), k*flash*(brk ? LS.brkKey : 1), R.cone*narrow*(brk ? LS.brkCone : 1), 0);
  const er = Math.min(1.2, el*.6 + .45);
  set(1, [-RR*Math.cos(er)*Math.sin(az)*.8, RR*Math.sin(er), -RR*Math.cos(er)], tint([.72, .84, 1], 1, .6), brk ? 0 : k*.8*flash, R.rimCone*narrow, 2);
  set(2, [-RR*.8*Math.sin(az - .4), -.45, RR*.6*Math.cos(az - .4)], tint([.88, .9, 1], 2, .6), brk ? 0 : (LT.fill + (1 - LT.fill)*SIG.kick*at('kick')*TUNE.prism.on.strobe)*k*flash, .55*narrow, 4);
  // the layers in 3D: orbits and comets as lights circling it (lighting it as they pass)
  const wO = w3(P, 'orbit', 'comets')*TUNE.prism.on.layers3d;
  for (let i = 0; i < 3; i++) { const a = st.t*LS.orbSpeed*(1 + i*.3) + i*2.1, tl = .5 + i*.6, r = LS.orbR*(1 + .15*i), p = [r*Math.cos(a), r*Math.sin(a)*Math.sin(tl), r*Math.sin(a)*Math.cos(tl)];
    set(3 + i, p, hsv2rgb(h + pal[i], .8, 1), wO*LS.orb*rw, 9, 0); Ls[3 + i].orb = [a, tl, r]; }
  // the shadow: the key lamp's, through the middle onto the floor
  const n = [0, Math.cos(e), Math.sin(e)], fv = [0, -Math.sin(e), Math.cos(e)], Lp = Ls[0].p, ll = Math.hypot(...Lp), d = Lp.map(v => -v/ll), dn = n[1]*d[1] + n[2]*d[2];
  if (dn < -.05) { const t = (-R.floor - (n[1]*Lp[1] + n[2]*Lp[2]))/dn, q = Lp.map((v, i) => v + d[i]*t); STAGE.shadow = [q[0], q[1]*fv[1] + q[2]*fv[2], (.6*Ls[0].k*(1 - st.ex*.7)*TUNE.prism.on.shadow*TUNE.prism.on.floor), .5*t/ll]; } else STAGE.shadow = [0, 0, 0, 1];
  const ac = tint([.55, .6, .72], 1, .4); STAGE.plinth = [0, 0, 0];
  STAGE.amb = ac.map(v => v*LT.ambient*rw); STAGE.refl = LT.refl*rw;
  Object.assign(STAGE, {on: rw, cam, f, pos: u.pos, tilt: e, floor: R.floor, walls: R.walls, haze: R.haze*(.6 + .4*lift)*rw*(1 + st.strobe*.5*TUNE.prism.on.strobe)*TUNE.prism.on.haze, hue: h + pal[1], n, fv, rain: w3(P, 'rain')*rw, t: st.t});
}
// a layer's 3D version in the room: as strong as the layer (Journey turns the flat one down while the room is on: TUNE.prism.show.flat)
const w3 = (P, ...ks) => Math.min(1, Math.max(...ks.map(k => P.l[k] || 0))/(P.w.room > .5 ? TUNE.prism.show.flat*.8 : .8));
// the layers drawn in 3D over the room: the orbiting lights and their tails, fireflies as motes in the haze, the stargate's rings
// rushing past the camera
function show3d(u, P, x, rw){
  if (rw < .01 || !TUNE.prism.on.layers3d) return;
  const LS = TUNE.prism.show, cam = u.cam || CAM, fo = u.size*FOCAL, pos = u.pos, L = OVER.list, h = (P.hue || 0) + st.hue, pal = P.pal || [0, .33, .67];
  const pr = (p) => { const dz = cam - p[2]; return dz > .15 ? [pos[0] + p[0]*fo/dz, pos[1] + p[1]*fo/dz, dz] : null; };
  const add = (a) => over([...a, -1]);
  const behind = p => p[2] < 0 && Math.hypot(p[0], p[1]) < .5 ? .25 : 1;   // (behind the glass: dimmed by it)
  for (let i = 3; i < 6; i++) { const l = STAGE.lamps[i]; if (!l.orb || l.k < .01) continue; const [a, tl, r] = l.orb, A = pr(l.p); if (!A) continue; const b = l.k*behind(l.p)/LS.orb;
    add([A[0], A[1], 0, 0, .02*fo/A[2], l.c[0]*b, l.c[1]*b, l.c[2]*b, 1]);
    let q = A; for (let j = 1; j <= 6; j++) { const aa = a - j*.12, p = [r*Math.cos(aa), r*Math.sin(aa)*Math.sin(tl), r*Math.sin(aa)*Math.cos(tl)], B = pr(p); if (!B) break; const fade = b*(1 - j/7)*.6;
      add([q[0], q[1], B[0], B[1], .004, l.c[0]*fade, l.c[1]*fade, l.c[2]*fade, 0]); q = B; } }
  const wF = w3(P, 'fireflies')*rw;
  if (wF > .01) for (let i = 0; i < LS.motes; i++) { const t = st.t*.15, p = [Math.sin(i*2.3 + t*(.5 + hash(i)))*1.6, Math.sin(i*1.7 + t*.7)*.9 + .1, Math.cos(i*3.1 + t*.4)*1.6], A = pr(p); if (!A) continue;
    const blink = .3 + .7*Math.max(0, Math.sin(st.t*(1.5 + hash(i*.7)*2) + i))**4*(.5 + SIG.hat), b = wF*blink*behind(p)*.8, c = hsv2rgb(h + pal[i % 3] + .1, .5, 1);
    add([A[0], A[1], 0, 0, .012*fo/A[2], c[0]*b, c[1]*b, c[2]*b, 1]); }
  const wG = w3(P, 'stargate')*rw;
  if (wG > .01) { const bp = Math.max(.25, S.beatPeriod), tr = st.t/bp*LS.ringStep, n = LS.rings;
    for (let i = 0; i < n; i++) { const z = -3 + ((i*LS.ringStep + tr) % (n*LS.ringStep)), R = LS.ringR, rot = z*.4, c = hsv2rgb(h + pal[i % 3], .7, 1), b = wG*smooth((z + 3)/1.5)*smooth((cam - .3 - z)/.6)*.7;
      if (b < .01) continue; let q = null;
      for (let j = 0; j <= 6; j++) { const a = j/6*Math.PI*2 + rot, A = pr([R*Math.cos(a), R*Math.sin(a), z]); if (!A) { q = null; continue; } if (q) add([q[0], q[1], A[0], A[1], .004, c[0]*b, c[1]*b, c[2]*b, 0]); q = A; } } }
}

// how far the activity has let something in (TUNE.prism.act.at: each its own level, eased over .15)
const at = k => smooth((st.act - TUNE.prism.act.at[k])/.15 + .5);
// how closed it is: 1 the gem, a tube or a ring; 0 laid open
const closed = () => st.body === 'g' ? st.f.k : Math.max(st.f.a, st.f.b);
const detFor = () => Math.max(st.g.det, Math.min(st.prog.det, TUNE.prism.detCalm) + st.act*TUNE.prism.detTension + (st.body === 's' ? 1 : 0));   // (calm: fewer, bigger facets; the finest only as it builds)
// to a new shape: on the other body, fly apart first (or at once, while it's off screen)
function goGenome(g, now){
  if (g.body !== st.body) {
    if (now || st.off) setBody(g.body);
    else { if (!st.swap) { st.swap = {g, t: st.t}; st.exT = Math.max(st.exT, TUNE.prism.swapEx*TUNE.prism.swarm.swapEx); } else st.swap.g = g; return; }   // (the swarm carries its facets across: a little shatter only)
  }
  st.swap = null;   // (a newer shape on this body replaces one waiting to fly across)
  st.g = g; st.form = g.name; if (g.swarm && st.dTo < 2) setDetail(2); if (g.sf !== (st.sfName || '')) { st.sfName = g.sf; setSf(SF[g.sf]); }
  if (g.det > st.dTo) setDetail(g.det);
  st.arch.push(g); if (st.arch.length > TUNE.prism.imp.memory) st.arch.shift();
}
function snapTo(g){ for (const p of PARAMS) st.f[p] = g[p]; for (const n of NAMES) st.w[n] = g.w[n] || 0; }
// to the other body: it gathers laid flat (the star, or the square), then folds into its form
function setBody(k){
  if (st.body === k) return; st.body = k;
  Object.assign(st.f, k === 'g' ? {k: 0} : {a: 0, b: 0, tw: 0, wd: 1});
  const d = Math.max(0, Math.min(BODY[k].F, st.dTo + (k === 's' ? 1 : -1))); st.dFrom = st.dTo = d; st.wipe = 1;
}
function setSf(p, secs){ st.sfA = st.sfMix >= 1 ? st.sfB : st.sfA; st.sfMx[0] = st.sfMx[1]; st.sfB = p; st.sfMx[1] = sfMax(p); st.sfMix = 0; st.sfSecs = secs || TUNE.prism.morphSecs; }
function setDetail(d, now){ d = Math.max(0, Math.min(BODY[st.body].F, Math.round(d)));   // (whole levels: between two the panes part along the new edges, which read as shattered) if (Math.abs(d - st.dTo) < .05) return;
  st.dFrom = now ? d : st.dFrom + (st.dTo - st.dFrom)*Math.min(1, st.wipe); st.dTo = d; st.wipe = now ? 1 : 0; }

// ---- shape genes and the improviser (docs/prism-plan.md, stage 4) ----
// A shape is a short recipe: which form it takes (the gem, opened, or the square rolled into a tube, a ring, a twist), the
// weights of the ten closed shapes it blends, its superformula, how it's squashed, twisted and turned on a lathe. The improviser
// walks from the shape it has: a handful of mutations, scored by how far each is from every shape it's made lately (so it
// doesn't loop), how close the step is to the size the music wants, and how sharp it is against how intense the music is
const SHARP_OF = {ball: 0, pill: .1, disc: .2, blob: .25, flower: .4, super: .5, gem: .7, octa: .8, cube: .8, star: 1, skull: .7, unicorn: .6, manta: .5};
const SF_CALM = ['round', 'flower', 'cushion', 'gem'], SF_SHARP = ['star', 'urchin', 'gem', 'shell'];
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2)*1.2;
const want = () => .2 + .6*st.act;   // how sharp a shape suits the music now
const sharpOf = g => { let s = 0, t = 0; for (const n in g.w) { s += g.w[n]*SHARP_OF[n]; t += g.w[n]; } return t ? s/t : 0; };
const topShapes = w => Object.keys(w).filter(n => w[n] > .05).sort((a, b) => w[b] - w[a]).slice(0, 3);
// a shape from one of the named forms (its numbers), keeping the closed shape's genes of g (or fresh ones)
function fromForm(name, g){ const F = FORMS[name], o = {...F, name, w: g ? {...g.w} : {ball: 1}, sf: g ? g.sf : 'round'};
  if (g) for (const k of ['sqx', 'sqy', 'sqz', 'twy', 'la', 'lf']) o[k] = g[k]; return o; }
// weights for a fresh shape: one or two shapes near the sharpness wanted
function freshW(sh){ const ranked = FREE.filter(n => n !== 'blob' || rnd() < .15).sort((a, b) => Math.abs(SHARP_OF[a] - sh) - Math.abs(SHARP_OF[b] - sh) + (rnd() - .5)*.5);
  const w = {[ranked[0]]: 1}; if (rnd() < .4) w[ranked[1 + Math.floor(rnd()*2)]] = .15 + rnd()*.25; return w; }
// one clear shape with at most a hint of another (three averaged together read as a lumpy blob)
function crisp(w){ const top = topShapes(w).slice(0, 2), o = {}; let t = 0; for (const n of top) t += (o[n] = Math.pow(w[n], 2));
  for (const n of top) o[n] /= t || 1; if (top.length > 1 && o[top[1]] > .35) { o[top[1]] = .35; o[top[0]] = .65; } return o; }
// a step from g: its weights drift (a shape now and then joining), its squash, twist and lathe wander back towards plain, its
// mountains and waves change if it's open; s from 0 (the same) to 1 (far)
function mutate(g, s, sh){
  const o = {...g, w: {}};
  for (const n in g.w) { const v = g.w[n]*Math.exp(gauss()*s*1.4); if (v > .04) o.w[n] = v; }
  if (rnd() < s*.8 || !Object.keys(o.w).length) { const n = freshW(rnd()); for (const k in n) o.w[k] = (o.w[k] || 0) + n[k]*s*1.5; }   // (a new shape coming in, sometimes taking over)
  o.w = crisp(o.w);
  const toward = (v, home, lo, hi, amt) => Math.max(lo, Math.min(hi, v + (home - v)*.15 + gauss()*amt*s));
  o.sqy = toward(g.sqy, 1, .65, 1.4, .25); o.sqx = toward(g.sqx, 1, .7, 1.35, .15); o.sqz = toward(g.sqz, 1, .7, 1.35, .15);
  o.twy = toward(g.twy, 0, -1.2, 1.2, .6); o.la = toward(g.la, 0, 0, .22, .1); if (rnd() < s*.4) o.lf = pick([2, 3, 4, 5, 6]);
  if (rnd() < s*.5) o.sf = pick(sh > .5 ? SF_SHARP : SF_CALM);
  if (g.body === 'g' && g.k < .9) { o.h = toward(g.h, g.h, 0, 1.2, .4); o.wv = toward(g.wv, g.wv, 0, 1, .3); if (g.name === 'bloom') o.k = toward(g.k, .45, .25, .7, .2); }
  if (g.name === 'twist') o.tw = toward(g.tw, 2.4, 1, 3.5, .8);
  if (g.body === 's') { o.h = toward(g.h, g.h, 0, .5, .3); if (g.name !== 'ring' && g.name !== 'tube') o.wd = toward(g.wd, g.wd, .4, 1, .3); }
  return o;
}
// how far apart two shapes are
function dist(a, b){
  let d = a.name === b.name ? 0 : a.body === b.body ? 1 : 1.6;
  if (a.body === 'g' && b.body === 'g') { const ns = new Set([...Object.keys(a.w), ...Object.keys(b.w)]); for (const n of ns) d += Math.abs((a.w[n] || 0) - (b.w[n] || 0))*.8; }   // (the closed shape's genes show only on the gem)
  else d += Math.abs(a.tw - b.tw)*.4 + Math.abs(a.wd - b.wd);
  d += (Math.abs(a.sqx - b.sqx) + Math.abs(a.sqy - b.sqy) + Math.abs(a.sqz - b.sqz))*1.5 + Math.abs(a.twy - b.twy)*.5 + Math.abs(a.la - b.la)*3 + (a.sf !== b.sf ? .25 : 0) + Math.abs(a.h - b.h)*.4 + Math.abs(a.wv - b.wv)*.3;
  return d;
}
// one step of the improviser: a handful of candidates, the best by novelty, step size and the music's sharpness; a leap may
// change form (to the square, or open, as seldom as their chances say); now and then it comes home to the section's theme
// the shapes it knows by name: the closed gem's (polyhedra, the superformula's, a lantern, a spindle, a twisted cube), the
// square's (a donut, a tube, a ribbon, a flat ring) and the open ones (a bloom, the star, mountains, waves). The improviser
// tours them, the least seen first, and varies each; how calm the music is sets how slowly, not how round (calm once meant
// round, so it kept to the flower, the disc and the ball: the user saw three or four shapes)
const ARCH = {
  ball: {w: {ball: 1}, sh: 0}, cube: {w: {cube: 1}, sh: .8}, octahedron: {w: {octa: 1}, sh: .8}, diamond: {w: {gem: 1}, sh: .7}, star: {w: {star: 1}, sh: 1},
  disc: {w: {disc: 1}, sh: .2}, pill: {w: {pill: 1}, sh: .1}, flower: {w: {flower: 1}, sh: .4},
  starfish: {w: {super: 1}, sf: 'star', sh: .9}, urchin: {w: {super: 1}, sf: 'urchin', sh: 1}, shell: {w: {super: 1}, sf: 'shell', sh: .6},
  cushion: {w: {super: 1}, sf: 'cushion', sh: .3}, jewel: {w: {super: 1}, sf: 'gem', sh: .6},
  lantern: {w: {ball: 1}, la: .16, lf: 4, sh: .3}, spindle: {w: {octa: .7, pill: .3}, sqy: 1.35, sqx: .8, sqz: .8, sh: .7}, twisted: {w: {cube: 1}, twy: 1, sh: .8},
  donut: {form: 'ring', sh: .3}, tube: {form: 'tube', sh: .4}, ribbon: {form: 'twist', sh: .5}, halo: {form: 'halo', sh: .3},
  skullWrap: {w: {skull: 1}, sh: .7}, unicornWrap: {w: {unicorn: 1}, sh: .6}, mantaWrap: {w: {manta: 1}, sh: .5},
  skullSwarm: {swarm: 'skull', w: {ball: 1}, sh: .8}, unicornSwarm: {swarm: 'unicorn', w: {ball: 1}, sh: .7}, mantaSwarm: {swarm: 'manta', w: {ball: 1}, sh: .6},
  bloom: {form: 'bloom', w: {flower: 1}, sh: .4}, open: {form: 'star', sh: .5}, mountains: {form: 'peaks', sh: .8}, waves: {form: 'waves', sh: .3},
};
const kindOf = a => { const f = ARCH[a].form; if (ARCH[a].swarm) return 'swarm'; return !f ? 'closed' : FORMS[f].body === 's' ? 'square' : 'open'; };
function archetype(name){
  const A = ARCH[name], g = fromForm(A.form || 'gem');
  Object.assign(g, {w: {...(A.w || {ball: 1})}, sf: A.sf || 'round', sqx: A.sqx || 1, sqy: A.sqy || 1, sqz: A.sqz || 1, twy: A.twy || 0, la: A.la || 0, lf: A.lf || 4, arch: name, swarm: A.swarm || null});
  return g;
}
// the next shape to visit: the least seen lately, not one of the last few, its kind as often as its weight says, a little
// nearer the music's sharpness
function pickArch(sh, theme){
  const T = TUNE.prism.imp, recent = st.recent || [], cur = st.g && st.g.arch;
  // the kind first, by its share (closed has many more shapes than the others, so choosing among all at once never left it)
  const ks = Object.entries(T.kinds).map(([k, w]) => [k, w*(theme && k !== 'closed' ? .5 : 1)]), tot = ks.reduce((a, [, w]) => a + w, 0);
  let r = rnd()*tot, kind = 'closed'; for (const [k, w] of ks) { if ((r -= w) < 0) { kind = k; break; } }
  let best = null, bs = -1e9;
  for (const a in ARCH) {
    if (kindOf(a) !== kind || a === cur || recent.includes(a) && rnd() < .9) continue;
    const sc = -(st.seen[a] || 0)*T.seenWeight - Math.abs(ARCH[a].sh - sh)*T.suit + rnd()*T.chance;
    if (sc > bs) { bs = sc; best = a; }
  }
  return best || 'cube';
}
function visit(name){ st.seen[name] = (st.seen[name] || 0) + 1; st.recent = [...(st.recent || []), name].slice(-T_recent()); }
const T_recent = () => TUNE.prism.imp.recent;
// one step: now and then home to the section's theme; often on to the next shape on the tour (sooner from the square or the
// open star, which are excursions); otherwise a variation of this one
function improvise(s, leapP, sk = 1){
  const T = TUNE.prism.imp, g = st.swap ? st.swap.g : st.g, sh = want();   // (from the shape it's heading to, if it's flying across to the other body)
  if (st.prog && rnd() < T.home) { goGenome(mutate(st.prog.theme, T.vary, sh)); return; }
  let pNew = T.next*sk + leapP;
  if (g.body === 's') pNew = Math.max(pNew, T.squareStay); else if (g.k < .9) pNew = Math.max(pNew, T.openStay);
  if (g.swarm) pNew = Math.max(pNew, T.squareStay);   // (the swarm too is an excursion)
  if (rnd() < pNew) { const a = pickArch(sh); visit(a); goGenome(mutate(archetype(a), T.fresh, sh)); if (rnd() < TUNE.prism.tex.change) setTex(pickTex(st.act > .3)); return; }
  const cands = []; for (let i = 0; i < T.cands; i++) cands.push(mutate(g, s, sh));
  let best = null, bs = -1e9;
  for (const c of cands) { const nov = st.arch.length ? Math.min(...st.arch.map(a => dist(a, c))) : 1, sc = nov*T.novelty - Math.abs(dist(g, c) - s*T.stepScale); if (sc > bs) { bs = sc; best = c; } }
  best.arch = g.arch; goGenome(best);
}
// the drop's snap shut: closed, spiky, sharp
function spiky(g){ const o = fromForm('gem', g); o.w = {star: .6, ...Object.fromEntries(topShapes(g.w).slice(0, 1).map(n => [n, .4]))}; o.sf = 'urchin'; return o; }
// a breakdown's calm: closed and rounder, plainer
function calmer(){ const a = pickArch(.2); visit(a); return archetype(kindOf(a) === 'square' ? 'ball' : a); }

// ---- the surface ----
// the mountains, waves and the kick's rings: a height along each point's normal. The ranges are symmetric round the middle
// (folded into the section's n wedges: even on the square, so its tube's, ring's seams meet), lower towards the edges
function height(b, v, t, bass, f){
  const asy = st.asym > .001 ? st.asym*st.asym*TUNE.prism.arc.asymAmt*.4*Math.max(0, b.VD[v*3]*st.asymAx[0] + b.VD[v*3 + 1]*st.asymAx[1] + b.VD[v*3 + 2]*st.asymAx[2]) : 0;
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
  if (JAM.pulls.length) { const dx = b.VD[v*3], dy = b.VD[v*3 + 1], dz = b.VD[v*3 + 2];   // pulled out or pushed in by hand, at each of its symmetric copies
    for (const q of JAM.pulls) for (let i = 0; i < q.cs.length; i += 3) { const d = dx*q.cs[i] + dy*q.cs[i + 1] + dz*q.cs[i + 2]; if (d > .8) hgt += q.amt*Math.exp(-(1 - d)/TUNE.prism.jam.width); } }
  return hgt + asy;
}
// the detail: a front of new facets blooming out from the middle
function detail(b){ const wf = st.wipe*1.25; for (let v = 0; v < b.nv; v++) b.D[v] = st.dTo + (st.dFrom - st.dTo)*smooth((b.VR[v] - wf)/.12 + .5); }
// the gem: each gore bent on a sphere of curvature k (its arc lengths kept), so the ball opens like a flower into a flat star;
// the petals narrow as they flatten, as an orange peel's do. Closed, each corner is on the ball, then given its shape's radius
function shapeGem(b, P, x){
  const T = TUNE.prism, G = b.G, f = st.f, kk = Math.max(f.k, 1e-3), kc = f.k*f.k*f.k, t = x.t, bass = (P.bass || 0)*x.react;
  const WS = NAMES.filter(n => st.w[n] > .01), ws = WS.reduce((a, n) => a + st.w[n], 0) || 1, la = f.la*kc, tw = f.twy*kc;
  const sx = 1 + (f.sqx - 1)*kc, sy = 1 + (f.sqy - 1)*kc, sz = 1 + (f.sqz - 1)*kc;
  const mid = (1 - Math.cos(kk*Math.PI))/(2*kk), sc0 = T.r*(T.star + (1 - T.star)*f.k)*(1 + bass*T.breath*f.k*st.act);
  const anticip = runUp(x.J), fh = {...f, h: f.h*(1 + anticip*.8)}, S3 = b.S3;
  for (let v = 0; v < b.nv; v++) {
    const th = G.TH[v], s = Math.sin(kk*th), c = Math.cos(kk*th), sc = th < 1e-4 || s < 1e-6 ? 1 : Math.sin(th)*kk/s, ps = G.GC[v] + G.PS[v]*sc;
    const cp = Math.cos(ps), sp = Math.sin(ps);
    let px = s/kk*cp, py = s/kk*sp, pz = (c - 1)/kk + mid;
    if (kc > .001) {   // closing: its shapes' radii blended by their weights, turned on a lathe, squashed or stretched, twisted
      const dx = b.VD[v*3], dy = b.VD[v*3 + 1], dz = b.VD[v*3 + 2];
      let R = 0; for (const n of WS) R += SHAPES[n](dx, dy, dz, t)*st.w[n]; R /= ws;
      if (la > .001) R *= 1 + la*Math.sin(f.lf*Math.asin(Math.max(-1, Math.min(1, dy)))*2);
      if (st.asym > .001) { const a = st.asymAx, d = dx*a[0] + dy*a[1] + dz*a[2]; R *= 1 + st.asym*st.asym*TUNE.prism.arc.asymAmt*Math.max(0, d)**2; }   // (one side swollen out after the drop)
      const q = 1 + (R - 1)*kc; px *= q*sx; py *= q*sy; pz *= q*sz;
      if (Math.abs(tw) > .001) { const a = tw*py, c = Math.cos(a), s2 = Math.sin(a), x2 = c*px - s2*pz; pz = s2*px + c*pz; px = x2; } }
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
  const anticip = runUp(x.J), fh = {...f, h: f.h*(1 + anticip*.8)};
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
// n facets round the middle at a distance and turn chosen by k (the section's symmetry), and the facets of one wedge
function symCells(b, k){ const n = st.prog.n[b.kind], r = .12 + .55*hash(k*.71 + 3), a0 = hash(k*1.3 + 5)*Math.PI*2, out = [];
  for (let i = 0; i < n; i++) out.push(nearestCell(b, dirAt(r, a0 + i/n*Math.PI*2))); return out; }
function wedgeCells(b, k){ const n = st.prog.n[b.kind], w = Math.PI*2/n, i0 = k % n, Z = b.FZ[b.AL], out = [];
  for (let c = 0; c < b.NA; c++) if (Math.floor(((Z[c]/w) % n + n) % n) === i0) out.push(c); return out; }
// how strongly the fireflies are coupled: loose when calm, in step through a drop's run-up (stage 6 plans it)
// how far into a drop's run-up the music is (Journey's read-ahead; a test can hold it)
const runUp = J => st.testRunUp ?? ((J && J.anticip) || 0);
const brkNow = () => st.testBrk ?? L.brk;
const flyK = J => { const T = TUNE.prism.cells, a = runUp(J); return T.flyK + (T.flyKBuild - T.flyK)*Math.max(a, (st.act - .4)/.6); };
function kick(ten){
  const pr = st.prog; if (!pr) return;
  // its ring: from the middle, or on the closed gem from a new point each time
  const o = st.body === 'g' && st.f.k > .6 ? dirAt(Math.acos(1 - 2*hash(st.run*.37))/Math.PI, hash(st.run*.91)*Math.PI*2) : [0, 0, 1];
  st.rip.push({o, t: st.t, k: .6 + ten*.6, inv: pr.rings === 'in'}); if (st.rip.length > 4) st.rip.shift();
  if (pr.figure === 'swell') touch(BODY[st.body].C, 'swell', symCells(BODY[st.body], st.run), .8);
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
  else if (RULES.includes(pr.figure)) levels(b, b.C.out, b.lv2);
  const hats = Math.min(1, SIG.hat*1.4), on = k => sb >= (T.layerBars[k] ?? T.layerBars.cells), anticip = runUp(x.J), kc = closed();
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
    if (fig === 'life' || RULES.includes(fig)) LI[f] = b.lv2[L0][g]*(fig === 'life' ? .8 : 1)*gF;
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
  const solid = sty === 1 || sty === 5, outline = sty === 2, holo = sty === 3, kc = closed(), litAmt = T.lit*(T.act.litCalm + (1 - T.act.litCalm)*st.act)*T.on.patterns;   // (calm: the patterns glow softer)
  const extr = T.extrude*(st.secBars >= T.layerBars.extrude ? pr.extrude : .5)*(T.act.liftCalm + (1 - T.act.liftCalm)*at('lift'));
  const hop = at('spin');
  const room = STAGE.on > .01, R = TUNE.prism.room, Ls = STAGE.lamps, cam = u.cam || CAM, Pp = X.pos, stride = Math.max(1, Math.ceil(b.nf/120)), fo = STAGE.f;
  const cones = Ls.map(l => l.cone > 3 ? [-2, -1] : [Math.cos(l.cone*1.3), Math.cos(l.cone*.5)]); let nc = 0;
  for (let f = 0; f < b.nf; f++) {
    const L0 = X.fl[f], g = G.FA[L0][f], key = L0*100000 + g, sd = hash(key*.731);
    const nx = X.fn[f*3], ny = X.fn[f*3 + 1], nz = X.fn[f*3 + 2], x1 = cr*nx + sr*nz, z1 = -sr*nx + cr*nz, vy0 = cp*ny - sp*z1, vz = sp*ny + cp*z1;
    const vx = co*x1 - so*vy0, vy = so*x1 + co*vy0, sg = u.inside ? -1 : vz < 0 && kc < .5 ? -1 : 1;   // (an open sheet has two faces: lit as whichever faces us; from inside, the inner faces)
    const face = .5 + .5*(sg*vz), spec = Math.pow(Math.max(0, sg*(vx*Hx + vy*Hy + vz*Hz)/hl), T.gloss)*T.glint, lam = Math.max(0, sg*(vx*-.4 + vy*.6 + vz*.7));
    const k = LK[f], s = LS[f], hh = LH[f]*dim, m = LM[f], im = LI[f], p = LP[f];
    const tn = tints[b.tint(f)];
    const lit = [0, 1, 2].map(i => (cK[i]*k + cS[i]*s + cH[i]*hh + cM[i]*m*.7 + cI[i]*im*.5 + cP[i]*p)*litAmt);
    const zl = b.lz ? b.lz[f]*TUNE.prism.lasers.trace : 0; if (zl > .01) for (let i = 0; i < 3; i++) lit[i] += (cS[i]*.5 + .5)*zl;   // a laser's trace
    const lsum = (k + s + hh + m*.7 + im*.5 + p)*litAmt + zl, alpha = (sd < gone ? 0 : 1)*u.w;
    let fr, fa;
    if (solid) { fa = 1; fr = [0, 1, 2].map(i => tn[i]*(.12 + .55*lam)*(.6 + st.glow*.3) + lit[i]*.75 + spec + lc[i]*(Lt.amt || 0)*lam*.15); }
    else if (outline) { fa = 1; fr = lit.map(c => c*.18); }
    else if (holo) { fa = 0; fr = [0, 1, 2].map(i => (tn[i]*.03 + lit[i]*.25)); }
    else { fa = T.dark; fr = [0, 1, 2].map(i => tn[i]*fill*(.3 + .7*face) + lit[i]*.6*fa + spec*.8 + lc[i]*(Lt.amt || 0)*lam*.08); }
    // its texture (stage 8; glass and solid only) and the fire: the white glint split into a rainbow
    const tx = sty <= 1 || sty === 5 ? texAt(b.FD[L0][g*3], b.FD[L0][g*3 + 1], b.FD[L0][g*3 + 2]) : 'glass'; let ef = 1;
    if (tx !== 'glass') {
      if (tx === 'ice') { fa = .88; fr = [0, 1, 2].map(i => [.3, .4, .5][i]*(.2 + .5*face) + tn[i]*.05 + lit[i]*.5 + spec); ef = .7; }
      else if (tx === 'mirror') { const rz = 2*sg*vz, ex2 = envAt(rz*vx, rz*vy, h, pal, ENV); fa = .95; fr = [0, 1, 2].map(i => ex2[i]*(.6 + .4*face) + lit[i]*.4 + spec*1.3); ef = .45; }
      else if (tx === 'stained') { const c = hsv2rgb(h + pal[b.tint(f)] + (sd - .5)*.12, .95, 1); fa = .93; fr = [0, 1, 2].map(i => c[i]*(.12 + .4*face) + lit[i]*.7 + spec*.5); ef = .25; }
      else if (tx === 'iris') { const c = hsv2rgb(h + face*1.6 + vx*.6 + vy*.3, .75, 1); fa = .8; fr = [0, 1, 2].map(i => c[i]*(.08 + .3*face) + lit[i]*.5 + spec); }
      else if (tx === 'led') { fa = 1; fr = [0, 1, 2].map(i => .015 + tn[i]*.02 + lit[i]*1.3); ef = .5; }
      else if (tx === 'metal') { const sh = Math.pow(Math.max(0, sg*(vx*Hx + vy*Hy + vz*Hz)/hl), T.gloss*.08); fa = 1; fr = [0, 1, 2].map(i => (.08 + .25*lam)*(.7 + .3*tn[i]) + sh*.35 + lit[i]*.45 + spec*.6); ef = .55; }
    }
    if (tx === 'glass' || tx === 'ice' || tx === 'iris' || tx === 'mirror') { const FT = T.tex, fs = FT.fireSpread, gl2 = T.gloss*FT.fireGloss;
      for (let i = 0; i < 3; i++) { const ox = (i - 1)*fs, oy = (1 - i)*fs*.6, hx = Hx + ox, hy = Hy + oy, hn = Math.hypot(hx, hy, Hz);
        fr[i] += Math.pow(Math.max(0, sg*(vx*hx + vy*hy + vz*Hz)/hn), gl2)*T.glint*FT.fire*T.on.fire; } }
    if (!X.tex) X.tex = new Float32Array(b.nf); X.tex[f] = TEXCODE[tx];
    let gw = 0;
    if (room) {   // the lamps: each lights the facets turned to it inside its cone, and glints off those turned between it and the camera
      const a0 = G.TRI[f*3]*3, a1 = G.TRI[f*3 + 1]*3, a2 = G.TRI[f*3 + 2]*3, px = (Pp[a0] + Pp[a1] + Pp[a2])/3, py = (Pp[a0 + 1] + Pp[a1 + 1] + Pp[a2 + 1])/3, pz = (Pp[a0 + 2] + Pp[a1 + 2] + Pp[a2 + 2])/3;
      const c1 = cr*px + sr*pz, cz1 = -sr*px + cr*pz, cy0 = cp*py - sp*cz1, Cz = sp*py + cp*cz1, Cx = co*c1 - so*cy0, Cy = so*c1 + co*cy0;
      const vl = Math.hypot(Cx, Cy, cam - Cz) || 1, Vx = -Cx/vl, Vy = -Cy/vl, Vz = (cam - Cz)/vl, nX = sg*vx, nY = sg*vy, nZ = sg*vz;
      const am = STAGE.amb, hemi = .3 + .35*(1 + nY);   // ambient light, more from above than below
      for (let j = 0; j < 3; j++) fr[j] += am[j]*hemi*(.55 + .45*tn[j])*R.diff*(solid ? 1.4 : .8);
      for (let i = 0; i < Ls.length; i++) { const l = Ls[i]; if (l.k < .01) continue;
        let lx = l.p[0] - Cx, ly = l.p[1] - Cy, lz = l.p[2] - Cz; const ld = Math.hypot(lx, ly, lz) || 1; lx /= ld; ly /= ld; lz /= ld;
        const nd = nX*lx + nY*ly + nZ*lz; if (nd <= 0) continue;
        const ca = -(lx*l.a[0] + ly*l.a[1] + lz*l.a[2]), spot = smooth((ca - cones[i][0])/(cones[i][1] - cones[i][0])); if (spot < .01) continue;
        let hx = lx + Vx, hy = ly + Vy, hz = lz + Vz; const hn = Math.hypot(hx, hy, hz) || 1, gl = Math.pow(Math.max(0, (nX*hx + nY*hy + nZ*hz)/hn), R.gloss);
        const amt = l.k*spot, dfa = nd*amt*R.diff*(solid ? 1.6 : 1), gla = gl*amt*R.glint; gw += gla;
        for (let j = 0; j < 3; j++) fr[j] += l.c[j]*(dfa*(.75 + .25*tn[j]) + gla);   // (the light's own colour on the glass, a little tinted by it; the glint the light's)
        // a mirror ball: the key lamp thrown off every few facets onto the floor or the walls
        if (i === 0 && f % stride === 0 && !u.inside && nc < SPC && TUNE.prism.on.spots) { const rx = 2*nd*nX - lx, ry = 2*nd*nY - ly, rz = 2*nd*nZ - lz, n = STAGE.n;
          const dn = n[1]*ry + n[2]*rz, tf = dn < -1e-3 ? (-STAGE.floor - (n[1]*Cy + n[2]*Cz))/dn : 1e9, bb = Cx*rx + Cy*ry + Cz*rz, cc = Cx*Cx + Cy*Cy + Cz*Cz - STAGE.walls**2, tw = -bb + Math.sqrt(Math.max(0, bb*bb - cc));
          const t = tf > 0 && tf < tw ? tf : tw, Qx = Cx + rx*t, Qy = Cy + ry*t, Qz = Cz + rz*t, dz = cam - Qz;
          if (dz > .3) { SPX[nc*4] = STAGE.pos[0] + Qx*fo/dz; SPX[nc*4 + 1] = STAGE.pos[1] + Qy*fo/dz; SPX[nc*4 + 2] = (.05 + t*.035)*fo/dz; SPX[nc*4 + 3] = amt*nd*R.spotBright*alpha; nc++; } }
      }
    }
    for (let i = 0; i < 3; i++) X.fill[f*4 + i] = fr[i]*alpha; X.fill[f*4 + 3] = fa*alpha;
    const eb = ((outline ? 1 - Math.min(1, Math.abs(vz)*2.5) : .35 + .65*face)*(.75 + st.glow*.6) + lsum*.9)*(solid ? .35 : holo ? 1.2 : 1)*ef;
    for (let i = 0; i < 3; i++) X.edge[f*3 + i] = (tn[i]*.9 + lit[i]*.6 + .05)*eb*alpha + gw*.5*alpha;
    // each edge fades in as the detail reaches its level
    const a0 = G.TRI[f*3], a1 = G.TRI[f*3 + 1], a2 = G.TRI[f*3 + 2];
    for (let j = 0; j < 3; j++) { const p0 = j === 0 ? a1 : a0, p1 = j === 2 ? a1 : a2, dd = (D[p0] + D[p1])/2; X.eA[f*3 + j] = Math.max(0, Math.min(1, dd - G.EL[f*3 + j] + 1)); }
    // facets pushed out: the kick's ring and the hats lift them (the stabs' too on a closed form: an open sheet looked cracked), and all fly apart when it shatters
    const push = (extr*(k*.8 + (hh*.3 + s*.3*kc)*hop) + ex*(.4 + sd))*.45*ext;   // (the hats and stabs only light it until things build: their pushing read as shattered fuzz)
    let ox = 0, oy = 0, oz = 0;
    if (st.sw > .002 || st.flat > .002) {   // the swarm (stage 11): each facet a shard, flying on a curve to its place
      const a0 = G.TRI[f*3]*3, a1 = G.TRI[f*3 + 1]*3, a2 = G.TRI[f*3 + 2]*3, Pq = X.pos, cx = (Pq[a0] + Pq[a1] + Pq[a2])/3, cy = (Pq[a0 + 1] + Pq[a1 + 1] + Pq[a2 + 1])/3, cz = (Pq[a0 + 2] + Pq[a1 + 2] + Pq[a2 + 2])/3;
      if (st.sw > .002 && st.swK) { const pn = panes(st.swK), q = pn[(f*7919 + 13) % pn.length], p = smooth(st.sw), sw = Math.sin(Math.PI*p)*TUNE.prism.swarm.swirl, fl = Math.sin(st.t*1.3 + sd*9)*.015*p;
        ox += (q[0] - cx)*p - cz*sw; oy += (q[1] - cy)*p + fl; oz += (q[2] - cz)*p + cx*sw; }
      if (st.flat > .002) { const d = b.FD[L0], dx = d[g*3], dy = d[g*3 + 1], p = smooth(st.flat), a = p*1.6 + Math.atan2(dy, dx), r = .55*Math.hypot(dx, dy) + .05*sd;
        ox += (r*Math.cos(a) - cx)*p; oy += (r*Math.sin(a) - cy)*p; oz += (-cz + (sd - .5)*.06)*p; } }
    X.off[f*3] = nx*push + ox; X.off[f*3 + 1] = ny*push + oy; X.off[f*3 + 2] = nz*push + oz;
  }
  if (room) {   // the brightest spots, for the room to draw (in the key lamp's colour)
    const ix = Array.from({length: nc}, (_, i) => i).sort((a, b) => SPX[b*4 + 3] - SPX[a*4 + 3]), m = Math.min(MAXSPOTS, nc), c = Ls[0].c;
    for (let j = 0; j < m; j++) { STAGE.spots.set(SPX.subarray(ix[j]*4, ix[j]*4 + 4), j*4); STAGE.spotC.set(c, j*3); }
    STAGE.spots.fill(0, m*4); STAGE.nSpots = m;
  }
}
const SPC = 160, SPX = new Float32Array(SPC*4);
