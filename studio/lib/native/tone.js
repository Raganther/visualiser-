// Pads and basses computed sample by sample, each held for the note's length: FM (one sine wobbling another's phase, the
// wobble's depth falling after the strike: glassy, round or plucked), additive (a sound built partial by partial, each
// with its own bloom and slow movement), a breath pad (noise through a bank of narrow resonances on the harmonics, as air
// in a tube or a bowed string) and a grain pad (a cloud of grains from a struck bar, held as a chord).
import { rng } from '../rng.js';
import { modal, MODAL } from './modal.js';
import { render, fadeAt } from './stream.js';


// two-operator FM: the carrier at f0, the modulator at ratio×f0, its index (how much it bends the carrier) falling from
// `index` to `indexEnd` over `indexT`; an amplitude ADSR; the two sides a few cents apart. Live, every setting is heard
// as it turns (the bend, the ratio, the decay and sustain, the feedback, the release)
export const FM_D = {vel: .8, ratio: 1, index: 2, indexEnd: .4, indexT: .15, a: .003, dec: .3, sus: .3, r: .12, len: .3, det: .002, fb: 0};
export class FmV {
  constructor(sr, f0, P, vel = P.vel){ Object.assign(this, {sr, f0, P, vel, i: 0, rel: Infinity, end: Infinity, done: false, pc: [0, 0], pm: [0, 0], last: [0, 0]}); }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.r*1.5 + .02)*this.sr); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, f0 = this.f0, vel = this.vel, iv = .55 + .45*vel, len = this.rel, A = P.a, sus = P.sus, dec = P.dec;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr, I = (P.indexEnd + (P.index - P.indexEnd)*Math.exp(-t/P.indexT))*iv;
      const e = t < A ? t/A : t < len ? sus + (1 - sus)*Math.exp(-(t - A)/dec) : (sus + (1 - sus)*Math.exp(-(len - A)/dec))*Math.exp(-6.9*(t - len)/P.r);
      for (let c = 0; c < 2; c++) { const k = c ? 1 + P.det : 1 - P.det; this.pm[c] += 2*Math.PI*f0*P.ratio*k/sr; this.pc[c] += 2*Math.PI*f0*k/sr;
        const m = Math.sin(this.pm[c] + P.fb*this.last[c]); this.last[c] = m; const y = Math.sin(this.pc[c] + I*m)*e*vel; if (c) oR[j] += y; else oL[j] += y; }
      this.i++; } }
}
export const fm = (sr, f0, o = {}) => render(FmV, sr, f0, {...FM_D, ...o}, true);

// additive: partials 1..N, each k^-tilt loud, slightly out of tune with the next (spread), arriving one by one (bloom: the
// higher ones later), each swelling and fading on its own slow cycle (wob), alternating sides. Live, the bloom, darkness,
// sway and envelope follow their knobs as it sounds
export const ADD_D = {vel: .7, N: 18, tilt: 1.3, odd: 1, a: 1.2, bloom: 3, len: 4, r: 2, wob: .35, spread: .0025, vib: .0012, seed: 1};
export class AdditiveV {
  constructor(sr, f0, P, vel = P.vel){ const R = rng(P.seed), N = P.N; Object.assign(this, {sr, P, vel, i: 0, rel: Infinity, end: Infinity, done: false, parts: []});
    for (let k = 1; k <= N; k++) {
      const f = f0*k*(1 + (R() - .5)*P.spread*Math.sqrt(k)); if (f > sr*.42) break;
      const u = R(), lr = .04 + .22*R(), lp = R()*6.28, pan = k === 1 ? 0 : (k % 2 ? -1 : 1)*(.25 + .5*R()), ph = R()*6.28, vr = .15 + .35*R(), vp = R()*6.28;
      this.parts.push({k, f, u, lr, lp, gl: (1 - pan)*.5, gr: (1 + pan)*.5, ph, vr, vp, vd: P.vib*Math.sqrt(k)}); } }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.r*1.2)*this.sr); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, len = this.rel, r = P.r, N = P.N, W = 2*Math.PI/sr;
    if (this.i >= this.end) { this.done = true; return; }
    const m = Math.min(b, a + this.end - this.i);
    for (const p of this.parts) { const amp = Math.pow(p.k, -P.tilt)*(p.k % 2 ? 1 : P.odd)*this.vel, pa = P.a + P.bloom*p.u*(p.k - 1)/N;
      // (the vibrato's and the sway's slow cycles turned a sample at a time, set exactly at each block's start)
      const i0 = this.i, av = W*p.vr, aw = W*p.lr, cv = Math.cos(av), sv = Math.sin(av), cw = Math.cos(aw), sw = Math.sin(aw);
      let vs = Math.sin(p.vp + av*i0), vc = Math.cos(p.vp + av*i0), ws = Math.sin(aw*i0 + p.lp), wc = Math.cos(aw*i0 + p.lp);
      for (let j = a, i = i0; j < m; j++, i++) { p.ph += W*p.f*(1 + p.vd*vs); const t = i/sr;
        const e = t < pa ? .5 - .5*Math.cos(Math.PI*t/pa) : t < len ? 1 : Math.exp(-6.9*(t - len)/r), s = Math.sin(p.ph)*amp*e*(1 - P.wob*(.5 - .5*wc));
        oL[j] += s*p.gl; oR[j] += s*p.gr;
        let x = vs*cv + vc*sv; vc = vc*cv - vs*sv; vs = x; x = ws*cw + wc*sw; wc = wc*cw - ws*sw; ws = x; } }
    this.i += m - a; if (this.i >= this.end) this.done = true; }
}
export const additive = (sr, f0, o = {}) => render(AdditiveV, sr, f0, {...ADD_D, ...o}, true);

// a breath pad: noise through narrow band-passes on the first N harmonics (each k^-1 loud), swelling in and out: the sound
// of air in a tube, or a bow on a string, held. Live, its focus, air and attack follow their knobs
export const BREATH_D = {vel: .7, N: 8, q: 70, a: .9, len: 4, r: 1.6, seed: 1, air: .04};
export class BreathV {
  constructor(sr, f0, P, vel = P.vel){ Object.assign(this, {sr, P, vel, i: 0, rel: Infinity, end: Infinity, done: false, q: -1});
    this.ks = []; for (let k = 1; k <= P.N; k++) { if (f0*k > sr*.42) break; this.ks.push({k, w: 2*Math.PI*f0*k/sr}); }
    this.ch = [P.seed, P.seed + 11].map(sd => ({R: rng(sd), st: this.ks.map(() => [0, 0, 0, 0])})); }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.r*1.2)*this.sr); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, len = this.rel, ks = this.ks;
    if (P.q !== this.q) { this.q = P.q; for (const s of ks) { const al = Math.sin(s.w)/(2*P.q), a0 = 1 + al; s.b0 = al/a0; s.a1 = -2*Math.cos(s.w)/a0; s.a2 = (1 - al)/a0; s.g = Math.sqrt(P.q)*.5/s.k; } }
    const op = ks.map(s => P.a*(.25 + .2*s.k)*sr);
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr, env = (t < P.a ? .5 - .5*Math.cos(Math.PI*t/P.a) : t < len ? 1 : Math.exp(-6.9*(t - len)/P.r))*this.vel;
      for (let c = 0; c < 2; c++) { const C = this.ch[c], x = C.R()*2 - 1; let y = 0;
        for (let q = 0; q < ks.length; q++) { const s = ks[q], z = C.st[q], v = s.b0*x - s.b0*z[1] - s.a1*z[2] - s.a2*z[3]; z[1] = z[0]; z[0] = x; z[3] = z[2]; z[2] = v; y += v*s.g*(1 - Math.exp(-i/op[q])); }
        const o = (y + x*P.air)*env; if (c) oR[j] += o; else oL[j] += o; }
      this.i++; } }
}
export const breath = (sr, f0, o = {}) => render(BreathV, sr, f0, {...BREATH_D, ...o}, true);

// a grain pad: a cloud of grains taken from a struck bar (vibes by default) at the note, steady, held, faded in and out.
// The bar is struck once per pitch (kept: the live engine warms them before they're needed); grains are scattered as
// the note sounds, so the density follows its knob
const SRCS = new Map();
export const grainSource = (sr, f0, src) => { const k = sr + '|' + f0 + '|' + src; let s = SRCS.get(k);
  if (!s) { const p = MODAL[src]; s = modal(sr, f0, p.modes, {...p, trem: 0, vel: .7, len: 1.5}).L; if (SRCS.size > 96) SRCS.delete(SRCS.keys().next().value); SRCS.set(k, s); } return s; };
export const GRAIN_D = {vel: .7, src: 'vibes', density: 26, a: .7, len: 4, r: 1.5, seed: 1};
const PITCHES = [1, 1, 1, 2, .5];
export class GrainV {
  constructor(sr, f0, P, vel = P.vel){ Object.assign(this, {sr, P, vel, i: 0, rel: Infinity, end: Infinity, secs: Infinity, done: false, R: rng(P.seed), S: grainSource(sr, f0, P.src), next: 0, G: []}); }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.secs = t + this.P.r; this.end = Math.ceil(this.secs*this.sr); this.fo = Math.min(this.end, Math.round(.2*this.sr)); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, R = this.R, S = this.S, sn = S.length, len = this.rel;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; }
      // the grains starting now: each its length, pitch, place in the bar, side and level, then the wait for the next
      while (this.next < this.secs && Math.floor(this.next*sr) <= i) { const g = Math.round((.08 + .18*R())*sr), p = PITCHES[Math.floor(R()*5)]*(1 + (R() - .5)*.012), off = Math.floor(R()*Math.max(1, sn*.6)), at = Math.floor(this.next*sr), pn = (R() - .5)*.9, amp = .4 + .6*R();
        this.G.push({at, g, p, off, gl: (1 - pn)*.5, gr: (1 + pn)*.5, amp}); this.next += -Math.log(1 - R())/P.density; }
      let l = 0, r = 0;
      for (let q = 0; q < this.G.length; q++) { const G = this.G[q], k = i - G.at, jj = G.off + k*G.p, j0 = Math.floor(jj);
        if (k >= G.g || j0 + 1 >= sn) { this.G.splice(q--, 1); continue; }
        const s = (S[j0] + (S[j0 + 1] - S[j0])*(jj - j0))*(.5 - .5*Math.cos(2*Math.PI*k/G.g))*G.amp; l += s*G.gl; r += s*G.gr; }
      const t = i/sr, e = (t < P.a ? .5 - .5*Math.cos(Math.PI*t/P.a) : t < len ? 1 : Math.exp(-6.9*(t - len)/P.r))*this.vel*(this.fo ? fadeAt(i, this.end, this.fo) : 1);
      oL[j] += l*e; oR[j] += r*e; this.i++; } }
}
export const grainPad = (sr, f0, o = {}) => render(GrainV, sr, f0, {...GRAIN_D, ...o}, true);

// a rubbed or bowed body: a bow's excitation (the stick and slip of the hair, a sawtooth at the note whose period wavers,
// and the hair's own noise) driving the body's resonances (modes: [[ratio, level, T60], …]) as narrow resonators, swelling
// in as the bow catches and dying away as it's lifted; `bright` mixes the saw over the noise (a string sings, a rubbed
// glass or bowl rings from the noise alone), `rough` the bow's waver; a doublet beats where `beat` > 0. Its loudness is
// set from what the bow and body would sound held (each side's harmonics through the resonances, and the noise's share),
// so turning the bow while it plays changes its colour, not its level
// (noise peaks further over its power than the bow's saw does: its share counted that much louder)
const NOISE_PK = 5;
export const RUB_D = {vel: .7, a: .4, len: 2, r: .9, bright: .5, rough: .3, beat: 0, width: .5, crest: 1.7, seed: 1};
export class RubbedV {
  constructor(sr, f0, P, vel = P.vel){ const R0 = rng(P.seed), list = [];
    P.modes.forEach(([ratio, lvl, t60], k) => { const f = f0*ratio; if (f >= sr*.42 || f < 20) return; const pan = k ? (R0() - .5)*P.width : 0;
      list.push({f, lvl, t60, pan}); if (P.beat > 0 && k < 4) list.push({f: f*(1 + P.beat*(.7 + .6*R0())), lvl: lvl*.6, t60, pan: -pan}); });
    Object.assign(this, {sr, f0, P, vel, i: 0, rel: Infinity, end: Infinity, done: false});
    this.ch = [[P.seed, -1], [P.seed + 13, 1]].map(([sd, side]) => ({R: rng(sd), ph: 0, w: 0, lp: 0,
      m: list.map(m => { const wn = 2*Math.PI*m.f/sr, rr = Math.exp(-6.9/(Math.max(.05, m.t60)*sr)); return {c1: 2*rr*Math.cos(wn), c2: rr*rr, norm: (1 - rr)*m.lvl*(1 - side*m.pan)*.5*2, y1: 0, y2: 0}; })}));
    this.pow = rubPower(sr, f0, this.ch); }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.r*1.4 + .02)*this.sr); this.fo = Math.min(this.end, Math.round(.03*this.sr)); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, len = this.rel, br = P.bright, nb = (1 - br)*1.6, f0 = this.f0, rr = P.r*.6, A = P.a,
      g = .5*this.vel/(P.crest*Math.sqrt(Math.max(1e-12, br*br*this.pow.saw + nb*nb*this.pow.noise*NOISE_PK)));
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr, env = t < A ? .5 - .5*Math.cos(Math.PI*t/A) : t < len ? 1 : Math.exp(-6.9*(t - len)/rr), fe = g*(this.fo ? fadeAt(i, this.end, this.fo) : 1);
      for (let c = 0; c < 2; c++) { const C = this.ch[c], R = C.R;
        C.w += .002*((R()*2 - 1) - C.w); C.ph += f0*(1 + P.rough*.006*C.w*30)/sr; C.ph -= Math.floor(C.ph); C.lp += .3*((R()*2 - 1) - C.lp);
        const x = ((2*C.ph - 1)*br + C.lp*nb)*env; let y = 0;
        for (const m of C.m) { const v = x + m.c1*m.y1 - m.c2*m.y2; m.y2 = m.y1; m.y1 = v; y += v*m.norm; }
        if (c) oR[j] += y*fe; else oL[j] += y*fe; }
      this.i++; } }
}
// a bowed body's power held, on its louder side: the saw's harmonics (2/πh) through the resonances, and the hair's noise
// (a one-pole low-pass of white noise) through each resonance's own noise gain at its frequency
function rubPower(sr, f0, ch){ let saw = 0, noise = 0;
  for (const C of ch) { let ps = 0, pn = 0;
    for (let h = 1; h*f0 < sr*.45; h++) { const w = 2*Math.PI*h*f0/sr, cw = Math.cos(w), sw = Math.sin(w), c2w = Math.cos(2*w), s2w = Math.sin(2*w); let re = 0, im = 0;
      for (const m of C.m) { const dr = 1 - m.c1*cw + m.c2*c2w, di = m.c1*sw - m.c2*s2w, d = dr*dr + di*di; re += m.norm*dr/d; im -= m.norm*di/d; }
      ps += (re*re + im*im)*Math.pow(2/(Math.PI*h), 2)/2; }
    for (const m of C.m) { const r = Math.sqrt(m.c2), th = Math.acos(Math.max(-1, Math.min(1, m.c1/(2*r)))), gain = (1 + r*r)/((1 - r*r)*(1 - 2*r*r*Math.cos(2*th) + r*r*r*r)), lpS = .09/(1 - 1.4*Math.cos(th) + .49);
      pn += m.norm*m.norm*gain*lpS/3; }
    saw = Math.max(saw, ps); noise = Math.max(noise, pn); }
  return {saw, noise}; }
export const rubbed = (sr, f0, modes, o = {}) => render(RubbedV, sr, f0, {...RUB_D, ...o, modes}, true);
// the bowed bodies (crest: how far each one's peak stands over its power, measured, so each is as loud as it was): a low string (harmonic, the saw singing through it), bowed metal (a plate's crowded modes), a glass
// harmonica (pure, nearly one partial, rubbed) and a singing bowl rubbed round its rim (its modes beating)
export const RUBBED = {
  bowed: {modes: Array.from({length: 14}, (_, k) => [k + 1, Math.pow(k + 1, -.7)*(k % 2 ? .8 : 1), 1.2]), bright: .75, rough: .35, a: .35, width: .3, crest: 1.74},
  bowmetal: {modes: [[1, 1, 2.5], [1.52, .7, 2], [2.0, .5, 1.8], [2.65, .45, 1.4], [3.4, .3, 1.1], [4.06, .2, .9], [5.2, .1, .6]], bright: .15, rough: .5, beat: .004, a: .9, width: .6, crest: 1.77},
  glassharm: {modes: [[1, 1, 2.5], [2.0, .12, 1.4], [3.0, .03, .8]], bright: .05, rough: .2, beat: .0015, a: .25, width: .35, crest: 1.73},
  rubbowl: {modes: [[1, 1, 6], [2.71, .45, 4], [5.06, .2, 2.5], [7.9, .08, 1.5]], bright: .05, rough: .4, beat: .003, a: 1.2, width: .5, crest: 1.38},
};

// a deep sub: a sine whose pitch falls from above to its note as it starts, held, saturated softly (drive) for its
// harmonics so it's heard on small speakers, a little of its octave below the knee
export const SUB_D = {vel: .8, drop: 1, dropT: .03, drive: .4, dec: 1.2, sus: .6, len: .5, r: .12};
export class Sub808V {
  constructor(sr, f0, P, vel = P.vel){ Object.assign(this, {sr, f0, P, vel, i: 0, rel: Infinity, end: Infinity, done: false, ph: 0}); }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.r*1.5 + .02)*this.sr); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, len = this.rel, k = 1 + P.drive*5, nk = Math.tanh(k), sus = P.sus, dec = P.dec;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr; this.ph += 2*Math.PI*this.f0*(1 + P.drop*Math.exp(-t/P.dropT))/sr;
      const e = t < .004 ? t/.004 : t < len ? sus + (1 - sus)*Math.exp(-t/dec) : (sus + (1 - sus)*Math.exp(-len/dec))*Math.exp(-6.9*(t - len)/P.r);
      const s = Math.tanh(k*Math.sin(this.ph))/nk*e*this.vel; oL[j] += s; oR[j] += s; this.i++; } }
}
export const sub808 = (sr, f0, o = {}) => render(Sub808V, sr, f0, {...SUB_D, ...o}, true);
