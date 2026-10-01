// The choreographer: every layer and object on screen dances. Every few bars it picks each dancer's next move from a
// vocabulary to suit the music: bigger as the tension rises, still in a breakdown, a burst on the drop. The moves are
// symmetric and stay centred (turns, breaths, pulses, nods, approaches, rises: the user found side-to-side drifts and
// jiggles "janky", and wants symmetry to drive the composition), and springs near critical damping ease into each pose
// rather than yo-yo past it. A section's routine is remembered, so a
// returning part dances the same way with variations, and the lead and the accent answer each other. Moves drive springs,
// so everything overshoots and settles like a body with weight. It keeps its own random numbers (Journey's are untouched).
// A leaf module: main.js steps it (stepDance) and the beat grid calls danceBeat; layers read DANCE.layer[key] (a turn,
// an offset and a scale, applied in both renderers), objects DANCE.obj[key], the comets DANCE.comets (a shape to trace).
import { S } from '../state.js';
import { SIG } from './signals.js';
import { TUNE } from '../tuning.js';
import { L } from '../audio/listen.js';

let seed = 0x9e3779b9;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
export const reseedDance = s => { seed = s | 0; };
const pick = w => { let s = 0; for (const k in w) s += Math.max(0, w[k]); let r = rnd()*s; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return Object.keys(w)[0]; };
const TAU = Math.PI*2;

// ---- the vocabularies: which moves exist, and how much each suits calm (c), intense (i) and breakdowns (b) ----
// layers move in the picture's plane: turn (radians), offset (x, y), scale
// layers move in the picture's plane round its centre: turn (radians) and scale, never off it
export const LAYER_MOVES = {
  still: {c: .8, i: .2, b: 3},  rock:  {c: 1.2, i: .6, b: .2},  turns: {c: .5, i: 1.4, b: 0},  breathe: {c: 1.4, i: .4, b: .8},
  spin:  {c: .6, i: 1, b: 0},   push:  {c: .2, i: 1.2, b: 0},   pulse: {c: .3, i: 1.4, b: 0},  bloom:   {c: 1, i: .8, b: .1},
};
// objects move in 3D: yaw, pitch, roll, position, size, squash, and one part lifting off
// objects move in 3D, centred: yaw, pitch, size, squash, height, and one part lifting off
export const OBJ_MOVES = {
  still: {c: .6, i: .1, b: 1.6},   bang:   {c: .2, i: 1.6, b: 0},  groove:   {c: .6, i: 1.2, b: 0},  face:  {c: .8, i: 1.2, b: .3},
  look:  {c: .5, i: .4, b: .2},    pulse:  {c: .2, i: 1.2, b: 0},  float:    {c: 1.2, i: .2, b: 2},  spin:  {c: .4, i: .9, b: 0},
  lift:  {c: .5, i: .7, b: .2},    approach: {c: 1.3, i: .8, b: .6}, rise:   {c: 1, i: .7, b: .8},
};
// the comets' shapes, traced by their trails: mostly symmetric and concentric (the user wants geometry, "pretty lines"),
// now and then free. lissa, braid and wings are mirrored: two comets draw each other's reflection, the third the spine
export const SHAPES = {free: {c: .25, i: .25, b: .4}, rose: {c: 1.2, i: 1, b: .5}, lissa: {c: 1, i: 1, b: .4}, star: {c: .5, i: 1.3, b: 0},
  spiral: {c: .6, i: 1.2, b: 0}, chase: {c: .6, i: .6, b: .6}, braid: {c: .7, i: 1, b: .2},
  vortex: {c: 1.2, i: .9, b: .6}, funnel: {c: .8, i: 1.2, b: .2}, wings: {c: .9, i: .9, b: .3}};
const MIRRORED = new Set(['lissa', 'braid', 'wings']);
// the flow field's particles (fx/particles.js): drifting on the field, or in mirrored pairs converging from both sides to
// the middle, swirling round it, or blooming out of it
export const FLOWS = {field: {c: .6, i: .5, b: 1}, converge: {c: 1, i: 1.2, b: .3}, vortex: {c: 1, i: .8, b: .5}, bloom: {c: .7, i: 1, b: .2}};

// ---- a dancer: its current move, when it started, its springs ----
const spring = () => ({x: 0, v: 0});
function springTo(s, target, dt, k){   // (in small steps, so a slow frame can't make it fly off)
  const w = Math.sqrt(k), n = Math.max(1, Math.ceil(dt*120)), h = dt/n, z = TUNE.dance.damp;
  for (let j = 0; j < n; j++) { const a = -k*(s.x - target) - 2*z*w*s.v; s.v += a*h; s.x += s.v*h; }
  return s.x; }
// a turn by whole turns looks the same: a new move starts from the nearest, so a spin never unwinds backwards
const wrap = d => { for (const k of ['rot', 'yaw']) { const s = d.s[k], n = Math.round(s.x/TAU); s.x -= n*TAU; } d.turn -= Math.round(d.turn/TAU)*TAU; };
const dancer = () => ({move: 'still', bar: 0, sign: 1, n: 3, turn: 0, flip: 0, kick: 0, stab: 0, burst: 0,
  s: {rot: spring(), dx: spring(), dy: spring(), sc: spring(), yaw: spring(), pitch: spring(), roll: spring(), sq: spring(), lift: spring()}});
const D = {};                                     // dancers by key
export const DANCE = {layer: {}, obj: {}, comets: {shape: 'free', p: [0, 0, 0], amt: 0, n: 3}, flow: {mode: 'field', amt: 0}, energy: 0};
const F = {mode: 'field', move: 'field', amt: 0};
const C = {shape: 'free', t: 0, amt: 0, from: 'free', k: 3, a: 3, b: 2, turn: 0, since: 0};
let bar = 0, drops = -1, lastType = null, mood = {c: 1, i: 0, b: 0}, energy = 0;

// the music's mood now: how calm, how intense, how much a breakdown
function moodNow(J){
  const T = Math.min(1, Math.max(0, SIG.tension || (J ? J.tension : .4))), brk = L.brk ? 1 : 0;
  return {c: (1 - T)*(1 - brk), i: T*(1 - brk), b: brk};
}
const score = (w, m) => w.c*m.c + w.i*m.i + w.b*m.b + .02;
// choose a move for a dancer: suited to the mood, not the one it just did, its character's taste, and the section's memory
function choose(d, key, menu, J, character){
  const ty = J && J.type, mem = ty && (ty.dance || (ty.dance = {}));
  if (mem && mem[key] && rnd() < TUNE.dance.remember && mem[key] !== d.move) return mem[key];   // the section's own move comes back
  const w = {};
  for (const k in menu) w[k] = score(menu[k], mood)*((character && character[k]) ?? 1)*(k === d.move ? .25 : 1);
  const m = pick(w);
  if (mem && !mem[key]) mem[key] = m;
  return m;
}

// ---- once a beat (from the beat grid): kicks, the bar, new moves on the downbeat ----
export function danceBeat(pos, J){
  for (const k in D) { D[k].kick = 1; if (pos === 1 || pos === 3) D[k].flip ^= 1; }
  if (pos !== 0) return;
  bar++;
  if (drops < 0 && J) drops = J.drops;   // (the first beat heard isn't a drop)
  const drop = J && J.drops !== drops; drops = J ? J.drops : drops;
  mood = moodNow(J);
  const phrase = bar % TUNE.dance.barsPerMove === 0, section = J && J.type !== lastType; lastType = J && J.type;
  for (const k in D) {
    const d = D[k];
    d.turn += d.move === 'face' ? d.sign*TAU/(d.n || 4) : d.move === 'turns' ? d.sign*TAU/12 : 0;   // snap turns step round on the bar (a layer by a notch)
    if (drop) { wrap(d); d.bar = bar; if (d.reach) d.move = 'reach'; else { d.burst = 1; d.move = 'spin'; } continue; }   // a reacher reaches out at us instead of spinning
    if ((phrase || section || d.move === 'still' && mood.b < .5) && !(d.move === 'reach' && bar - d.bar < 3)) {   // (a reach plays out)
      wrap(d);
      d.move = choose(d, k, k.startsWith('o:') ? OBJ_MOVES : LAYER_MOVES, J, d.character); d.bar = bar;
      d.sign = rnd() < .5 ? -1 : 1;
    }
  }
  // the comets: a new shape on a phrase line or a section, a burst outward on a drop
  if (drop) { C.from = C.shape; C.shape = 'spiral'; C.since = 0; C.a = 3 + Math.floor(rnd()*4); F.mode = F.move = 'bloom'; F.amt = 0; }
  else if (phrase && (bar % (TUNE.dance.barsPerMove*2) === 0 || section)) {
    C.from = C.shape; C.move = C.shape; C.shape = choose(C, 'comets', SHAPES, J); C.since = 0;
    C.k = [2, 3, 4, 5, 7][Math.floor(rnd()*5)]; C.a = 1 + Math.floor(rnd()*4); C.b = C.a + 1 + Math.floor(rnd()*2);
    const f = choose(F, 'flow', FLOWS, J); if (f !== F.mode) { F.mode = F.move = f; F.amt = 0; }
  }
}

// ---- every frame: each dancer's pose from its move, through its springs ----
// on: the keys drawing now (layers by key, objects as 'o:'+key); chars: each object's character (move weights, symmetry)
export function stepDance(dt, x, layers, objects, chars){
  const T = TUNE.dance, J = x.J, amt = T.amount*(x.dim ?? 1);
  energy += ((SIG.tension || 0) - energy)*Math.min(1, dt*.5); DANCE.energy = energy;
  const bp = SIG.barPhase || 0, beat = SIG.beatPhase || 0, kick = SIG.kick || 0, hat = L.hat || 0, big = .5 + energy;
  const want = new Set([...layers, ...objects.map(k => 'o:' + k)]);
  for (const k of want) if (!D[k]) { D[k] = dancer(); D[k].move = choose(D[k], k, k.startsWith('o:') ? OBJ_MOVES : LAYER_MOVES, J, null); }
  for (const k in D) if (!want.has(k)) delete D[k];
  let i = 0;
  for (const k of layers) {
    const d = D[k], t = (bar - d.bar + bp), s = d.s, g = d.sign, a = T.layer, lead = i++ % 2 ? -1 : 1;   // the second layer answers the first
    d.kick *= Math.exp(-dt*6); d.burst *= Math.exp(-dt*1.2);
    let rot = 0, dx = 0, dy = 0, sc = 1;   // (no offsets: every layer move keeps its centre)
    switch (d.move) {
      case 'rock': rot = g*lead*a.rock*Math.sin(t*Math.PI*.25)*big; break;                     // turning slowly one way and back, over four bars
      case 'turns': rot = d.turn; break;                                                       // a notch on each bar
      case 'breathe': sc = 1 + a.breathe*Math.sin(t*Math.PI*.25); break;
      case 'spin': rot = g*lead*t*a.spin; break;                                               // turning steadily (the second layer the other way)
      case 'push': sc = 1 + a.push*Math.min(1, t/4)*big; break;                                // growing through a build
      case 'pulse': sc = 1 + a.pulse*d.kick*big; break;                                        // swelling on the kick
      case 'bloom': sc = 1 + a.bloom*((t/4) % 1); break;                                       // opening out over four bars, then again
    }
    rot += d.burst*g*TAU*.25; sc += d.burst*.25;
    const k2 = T.stiff;
    DANCE.layer[k] = {rot: springTo(s.rot, rot*amt, dt, k2), dx: springTo(s.dx, dx*amt, dt, k2), dy: springTo(s.dy, dy*amt, dt, k2),
      s: springTo(s.sc, 1 + (sc - 1)*amt, dt, k2*1.6)};
  }
  for (const k in DANCE.layer) if (!D[k]) delete DANCE.layer[k];
  for (const key of objects) {
    const k = 'o:' + key, d = D[k], ch = chars[key] || {};
    d.character = ch.moves; d.n = ch.sym || 4; d.reach = ch.reach;
    const t = (bar - d.bar + bp), s = d.s, g = d.sign, a = T.obj;
    d.kick *= Math.exp(-dt*7); d.burst *= Math.exp(-dt*1.2);
    if ((SIG.stab || 0) > .8) d.stab = 1; d.stab *= Math.exp(-dt*5);
    let yaw = 0, pitch = 0, roll = 0, dx = 0, dy = 0, sz = 1, sq = 0, lift = 0;   // (centred: nothing steps sideways or rolls)
    const arc = f => Math.sin(Math.min(1, Math.max(0, f))*Math.PI);                        // out and back, once
    switch (d.move) {
      case 'bang': pitch = a.bang*d.kick*big; break;                                         // a nod on the kick
      case 'groove': dy = a.bounce*(d.kick - .3)*big; sq = a.squash*d.kick*big; break;       // a bounce with squash and stretch
      case 'face': yaw = d.turn; break;                                                      // snap turns round its own symmetry
      case 'look': yaw = a.look*Math.sin(t*Math.PI*.5)*big; break;                           // turning to one side and the other, evenly
      case 'pulse': sz = 1 + a.pulse*Math.max(d.kick*.6, d.stab)*big; break;                 // swelling on the kick and stabs
      case 'float': dy = a.float*Math.sin(t*Math.PI*.25); break;                             // rising and sinking slowly
      case 'spin': yaw = g*TAU*Math.min(1, t/4)**2*(3 - 2*Math.min(1, t/4)); break;          // one full turn over four bars, ending face on
      case 'lift': lift = arc(t/2)*big; break;
      case 'approach': sz = 1 + (ch.approach ?? a.approach)*arc(t/8); break;                 // coming slowly towards us over eight bars, and back
      case 'rise': pitch = -(ch.rise ?? a.rise)*arc(t/8); sz = 1 + .1*arc(t/8); break;       // tipping back to show its underside, and down again
      case 'reach': { const e = Math.min(1, t/a.reachIn)*Math.max(0, Math.min(1, 1 - (t - a.reachHold)/a.reachOut));   // (a drop) lunging at us, holding, easing back
        yaw = 0; pitch = a.reachTip*e*e*(3 - 2*e); sz = 1 + (ch.reachSize ?? a.reach)*e*e*(3 - 2*e); break; }   // face on, tipping its top towards us, coming close
    }
    yaw += d.burst*g*TAU; sz += d.burst*.15;
    const k2 = T.stiff*T.objStiff;
    DANCE.obj[key] = {yaw: springTo(s.yaw, yaw*amt, dt, k2*.7), pitch: springTo(s.pitch, pitch*amt, dt, k2*2), roll: springTo(s.roll, roll*amt, dt, k2),
      dx: springTo(s.dx, dx*amt, dt, k2), dy: springTo(s.dy, dy*amt, dt, k2*2), s: springTo(s.sc, 1 + (sz - 1)*amt, dt, k2*2),
      sq: springTo(s.sq, sq*amt, dt, k2*2.5), lift: springTo(s.lift, lift*amt, dt, k2), part: ch.liftPart || 1};
  }
  for (const k in DANCE.obj) if (!D['o:' + k]) delete DANCE.obj[k];
  // the comets' shape, easing in over a bar or two
  // in step with the bar: half a shape a bar, a little faster as the energy rises, so the three together draw it whole
  C.since += dt; C.amt = Math.min(1, C.since/T.shapeIn); C.t += dt*TAU*T.cometTurns/(4*Math.max(.25, S.beatPeriod || .5))*(1 + energy*.4);
  F.amt = Math.min(1, F.amt + dt/T.flowIn); DANCE.flow = {mode: F.mode, amt: F.amt*Math.min(1, amt)};
  DANCE.comets = {shape: C.shape, amt: C.shape === 'free' ? 0 : C.amt*amt, t: C.t, k: C.k, a: C.a, b: C.b, kick, beat};
}

// where comet i of n should be on the current shape (in the picture's units round centre c), or null to roam freely
export function cometTarget(i, n, c, R){
  const S = DANCE.comets;
  if (MIRRORED.has(S.shape)) {   // a pair drawing each other's reflection across the middle; the odd one out on the middle line
    const pair = i < n - (n % 2), p = shapePoint(S.shape, pair ? i >> 1 : 0, n, c, R, S);
    if (!p) return null;
    return pair ? [c[0] + (i % 2 ? -1 : 1)*(p[0] - c[0]), p[1]] : [c[0], c[1] + (p[1] - c[1])*1.2];
  }
  return shapePoint(S.shape, i, n, c, R, S);
}
function shapePoint(shape, i, n, c, R, S){
  const t = S.t, ph = i/n*TAU, r = R*(.85 + .15*(S.kick || 0));
  switch (shape) {
    case 'rose': { const a = t*.4 + ph/S.k; const rr = r*Math.cos(S.k*a); return [c[0] + rr*Math.cos(a), c[1] + rr*Math.sin(a)]; }   // a flower of k petals
    case 'lissa': { const a = t*.8 + ph; return [c[0] + r*1.3*Math.sin(S.a*a + Math.PI/2), c[1] + r*Math.sin(S.b*a)]; }       // a Lissajous knot
    case 'star': { const m = 5 + (S.k % 3)*2, q = Math.floor(m/2), f = (t*.15 + i/n)*m % m, k0 = Math.floor(f), u = f - k0;   // a star polygon {m/q}
      const p = j => [Math.cos(j*q*TAU/m + Math.PI/2), Math.sin(j*q*TAU/m + Math.PI/2)], A = p(k0), B = p(k0 + 1);
      return [c[0] + r*(A[0] + (B[0] - A[0])*u), c[1] + r*(A[1] + (B[1] - A[1])*u)]; }
    case 'spiral': { const f = (t*.25 + i/n) % 1, rr = r*(.1 + 1.1*f); return [c[0] + rr*Math.cos(t*3 + ph + f*TAU*S.a*.5), c[1] + rr*Math.sin(t*3 + ph + f*TAU*S.a*.5)]; }
    case 'chase': { const a = t*1.2 - ph*.35; return [c[0] + r*1.2*Math.cos(a), c[1] + r*.75*Math.sin(a)]; }                    // one after another round a loop
    case 'braid': { const a = t; return [c[0] + r*1.3*Math.sin(a*.7), c[1] + r*.45*Math.sin(a*2.1 + ph)]; }                    // plaited across the middle
    // circling together, the ring slowly opening and closing: concentric rings, a swirl
    case 'vortex': { const a = t*1.1 + ph, rr = r*(.25 + .95*(.5 + .5*Math.cos(t*.12))); return [c[0] + rr*Math.cos(a), c[1] + rr*Math.sin(a)]; }
    // spiralling in to the middle and out again (a funnel), evenly spaced round it
    case 'funnel': { const f = Math.abs(((t*.06) % 2) - 1), a = t*1.6 + ph, rr = r*(.08 + 1.1*f); return [c[0] + rr*Math.cos(a), c[1] + rr*Math.sin(a)]; }
    // a butterfly's wing (mirrored into a pair by cometTarget)
    case 'wings': { const a = t*.5; return [c[0] + r*1.2*Math.abs(Math.sin(a))*Math.cos(a*S.a*.5)*1.1, c[1] + r*Math.sin(a*2)*.8]; }
  }
  return null;
}
// for tests and labs: hold the comets in a shape, or a dancer in a move (key: a layer, or 'o:' + an object)
export function danceShape(shape, k = 5){ C.from = C.shape; C.shape = shape; C.k = k; C.a = 3; C.b = 4; C.since = TUNE.dance.shapeIn; }
export function danceFlow(mode){ F.mode = F.move = mode; F.amt = 1; }
export function danceMove(key, move){ if (D[key]) { D[key].move = move; D[key].bar = bar; } }
