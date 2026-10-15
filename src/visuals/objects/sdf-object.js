// The morphing objects' shared body (render/sdf.js draws them): the music gathered once for each (the kick's flash, the
// bass, the hats, a stab, the tension, a drop's run-up and its age, a breakdown, the beat), its place (P.anchor when the
// world carries objects, else the centre, swaying a little in the wind), its turn and its dance, its palette and its key
// light; the object's own step(st, M, dt) moves its beads and directions. A drop, or breakApart(), starts its splash (st.ex).
import { S, viewAsp } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { hsv2rgb } from '../../util.js';
import { DANCE } from '../../scene/dance.js';
import { SIG } from '../../scene/signals.js';
import { L } from '../../audio/listen.js';
import { facetGeo } from '../../render/facet.js';
import { sdfRegister, sdfDraw, sdf2d, sdfPath2d, look2d } from '../../render/sdf.js';

const G1 = facetGeo(1);
const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const m3 = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i*3 + j] = A[i*3]*B[j] + A[i*3 + 1]*B[3 + j] + A[i*3 + 2]*B[6 + j]; return C; };

// o: {key, label, words, stats, glsl, custom?, steps?, stepK?, dance, step(st, M, dt, x, P), map2d(x, y, z, st), tint2d(p, n, rd, t, st, U), rad(st), burst?(st)}
export function sdfObject(o){
  sdfRegister(o);
  const st = {t: 0, bars: 0, wan: 0, wph: 0, ex: 0, exHold: 0, kick: 0, kickT: -9, lastHit: 0, stab: 0, dropAt: -99, lastDrop: undefined, off: true, yaw: 0, bass: 0, hat: 0, ten: 0, hue: 0,
    Bd: new Float32Array(48), D: new Float32Array(128), K: [0, 0, 0, 0], K2: [0, 0, 0, 0], br: 1, rnd: 1};
  st.rand = () => (st.rnd = (st.rnd*16807) % 2147483647)/2147483647;   // (its own numbers: Journey's draws are untouched)
  st.rnd = 1 + [...o.key].reduce((a, c) => a*31 + c.charCodeAt(0), 7) % 99991;
  const map = (x, y, z) => o.map2d(x, y, z, st), tint = (p, n, rd, t) => look2d(o.tint2d(p, n, rd, t, st, P2.U), p, n, rd, P2.U, P2.U.Q[2]);
  const P2 = {U: null};
  return {
    key: o.key, kind: 'object', label: o.label, words: o.words, stats: o.stats, optIn: true, sdf: true, noRoom: true, dance: o.dance,
    get mesh(){ return this._m || (this._m = {pieces: [{pos: Array.from(G1.DIR, v => v*.45), tri: Array.from(G1.TRI), part: Array.from({length: G1.nf}, (_, f) => 1 + f % 6)}], hinge: [0, 0, 0]}); },
    onBeat(pos){ if (pos === 0) st.bars++; if (o.onBeat) o.onBeat(st, pos); },
    breakApart(){ st.ex = 1; st.exHold = .35; st.dropAt = st.t; if (o.burst) o.burst(st); },
    state: () => st,   // (tests)
    params(P, x){
      const T = TUNE.sdf, J = x.J, dt = x.dt, w = P.o[o.key] || 0;
      st.t += dt;
      const drop = J && st.lastDrop !== undefined && J.lastDrop !== st.lastDrop && J.lastDrop != null && J.on; st.lastDrop = J ? J.lastDrop : null;
      if (w < .003) { st.off = true; return; }
      st.off = false;
      const steady = (J && J.on && J.beatClear != null ? J.beatClear : 1) > .5, bp = S.beatPeriod > .2 ? S.beatPeriod : .5;
      const newKick = SIG.kick > .99 && st.t - st.kickT > .12, newStab = x.hit > .8 && st.lastHit <= .8;
      if (newKick) { st.kickT = st.t; st.kick = 1; } st.lastHit = x.hit;
      if (newStab) { st.stab = 1; st.hue += T.stabHue; }
      if (drop) { st.ex = steady ? 1 : .4; st.exHold = .2; st.dropAt = st.t; if (o.burst) o.burst(st); }
      st.kick *= Math.exp(-dt/.15); st.stab *= Math.exp(-dt/.4);
      if (st.exHold > 0) st.exHold -= dt; else st.ex = Math.max(0, st.ex - dt/T.exSecs);
      st.bass += (Math.min(1, (P.bass || 0)*(x.react ?? 1)) - st.bass)*Math.min(1, dt*10);
      st.hat += ((SIG.hat || 0) - st.hat)*Math.min(1, dt*8);
      st.ten += ((J ? J.tension || 0 : .4) - st.ten)*Math.min(1, dt*.5);
      const M = {t: st.t, dt, bp, steady, kick: st.kick, newKick, newStab, drop, bass: st.bass, hat: st.hat, stab: st.stab, ten: st.ten,
        anticip: (J && J.anticip) || 0, brk: L.brk ? 1 : 0, ex: st.ex, dropAge: st.t - st.dropAt, phase: SIG.barPhase || 0};
      o.step(st, M, dt, x, P);
      // its look (own, chrome, glass, neon, iridescent, toon): held (TUNE.sdf.look, or its own TUNE[key].look), or a section's own
      if (J && J.on && J.type !== st.type) { st.type = J.type; const w = T.looks; let r = st.rand()*w.reduce((a, b) => a + b); st.look = Math.max(0, w.findIndex(v => (r -= v) <= 0)); }
      const own = (TUNE[o.key] || {}).look, lk = own != null && own >= 0 ? own : T.look >= 0 ? T.look : st.look || 0;
      // its turn: slow, slower without a steady beat, the dance on top
      st.yaw += dt*T.spin*(.4 + st.ten)*(steady ? 1 : .5);
      // when asked (TUNE.sdf.wander.on: K then D, or the panel), under a kaleidoscope that folds everything it wanders slowly
      // round the screen, so its mirrored copies make new patterns; otherwise it stays in the centre (eased over a few seconds).
      // (Not with the fold inside the object: there it isn't mirrored, so it only drifted away)
      const Wn = T.wander, kf = Wn.on && P.kal && P.kal.on && P.kal.where === 0 && !P.anchor;
      st.wan += ((kf ? 1 : 0) - st.wan)*Math.min(1, dt*Wn.ease);
      if (drop) st.wph += Wn.dropJump;
      st.wph += dt*Wn.speed*(.6 + .8*st.ten)*(steady ? 1 : .6);
      const wx = st.wan*Wn.amount*viewAsp()*.5*(.75*Math.sin(st.wph*.7 + 1.3) + .25*Math.sin(st.wph*1.9)), wy = st.wan*Wn.amount*.42*(.7*Math.sin(st.wph*1.1) + .3*Math.cos(st.wph*2.3 + .5));
      const d = DANCE.obj[o.key], An = P.anchor, Vw = S.view && S.view.key === o.key ? S.view : null;
      const yaw = Vw ? Vw.yaw : st.yaw + (d ? d.yaw : 0), pitch = .18 + Math.sin(st.t*.23)*.08 + (d ? d.pitch : 0) + (Vw ? Vw.pitch : 0), roll = d ? d.roll : 0;
      const R = m3(m3(rx(pitch), ry(yaw)), rz(roll)), h = P.hue + st.hue, pal = P.pal || [0, .33, .67];
      const az = .55 + .5*Math.sin(st.t*.07), el = .5, dim = x.dim ?? 1;
      P.m = P.m || {};
      P2.U = P.m[o.key] = {w: An && An.hide ? 0 : Math.min(1, w*1.2), R, br: st.br,
        size: (An && An.size || (TUNE[o.key] || {}).size || T.size)*(d ? d.s : 1)*(Vw ? Vw.zoom : 1),
        pos: An && An.pos ? An.pos : [wx + P.wind.x*TUNE.ctx.windObject + (d ? d.dx : 0), wy + .02 + P.wind.y*TUNE.ctx.windObject + (d ? d.dy : 0)],
        M1: [st.t, st.kick*dim, st.bass, st.hat], M2: [st.stab*dim, Math.min(99, M.dropAge), st.ten, M.anticip], M3: [st.ex, M.brk],
        K: st.K, K2: st.K2, Bd: st.Bd, D: st.D, res: T.res, Q: [(o.steps || 80)*T.steps, T.ao, o.custom ? 0 : lk, 1],
        C0: hsv2rgb(h + pal[0], .75, 1), C1: hsv2rgb(h + pal[1], .7, 1), C2: hsv2rgb(h + pal[2], .6, 1), Ld: [Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el)]};
    },
    drawGL(gl, P, W, H, stage){ if (stage === 'trails') return; const U = P.m && P.m[o.key]; if (U && U.w > .003) sdfDraw(gl, S.glGen, o, U, W, H, stage); },
    draw2d(c, P){ const U = P.m && P.m[o.key]; if (U && U.w > .003) sdf2d(c, U, map, tint, TUNE.sdf.res2d); },
    path2d(c, P){ const U = P.m && P.m[o.key]; if (U) sdfPath2d(c, U, o.rad(st)); else c.beginPath(); },
  };
}
// helpers the objects share
export const fib = n => Array.from({length: n}, (_, i) => { const y = 1 - (i + .5)/n*2, r = Math.sqrt(1 - y*y), a = i*2.39996323; return [Math.cos(a)*r, y, Math.sin(a)*r]; });
export const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, .5 + .5*(b - a)/k)); return b + (a - b)*h - k*h*(1 - h); };
export const setBead = (st, i, x, y, z, r) => { const B = st.Bd; B[i*4] = x; B[i*4 + 1] = y; B[i*4 + 2] = z; B[i*4 + 3] = r; };
export function beads(st, x, y, z, k, from, to){ let d = 1e3; const B = st.Bd;
  for (let i = from; i < to; i++) { const r = B[i*4 + 3]; if (r > 0) d = smin(d, Math.hypot(x - B[i*4], y - B[i*4 + 1], z - B[i*4 + 2]) - r, k); }
  return d; }
export function vnoise(x, y, z){
  const h = (a, b, c) => { const s = Math.sin(a*127.1 + b*311.7 + c*74.7)*43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z); let fx = x - i, fy = y - j, fz = z - k;
  fx = fx*fx*(3 - 2*fx); fy = fy*fy*(3 - 2*fy); fz = fz*fz*(3 - 2*fz);
  const L = (a, b, t) => a + (b - a)*t;
  return L(L(L(h(i, j, k), h(i + 1, j, k), fx), L(h(i, j + 1, k), h(i + 1, j + 1, k), fx), fy), L(L(h(i, j, k + 1), h(i + 1, j, k + 1), fx), L(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), fx), fy), fz);
}
