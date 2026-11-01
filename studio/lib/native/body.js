// Drums, strings, shakers and textures computed from their physics: a struck membrane (kick, toms, hand drums), a plucked
// string (Karplus and Strong: a burst of noise round a tuned loop that loses its highs each time round), a shaker as beads
// colliding (Cook's PhISEM), a cloud of grains, and rain as droplets.
import { rng } from '../rng.js';
import { render, fadeAt } from './stream.js';

const LN1000 = Math.log(1000), out = n => ({L: new Float32Array(n), R: new Float32Array(n)});
const fade = (o, sr, ms = 15) => { const n = o.L.length, f = Math.min(n, Math.round(ms/1000*sr)); for (let i = 0; i < f; i++) { const g = i/f; o.L[n - 1 - i] *= g; o.R[n - 1 - i] *= g; } return o; };

// a circular membrane's modes (Bessel zeros over the first): the struck skin's pitch drops as the strike's tension eases
const MEMB = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501];
export const MEMB_D = {vel: .8, decay: .5, drop: .3, dropT: .03, hard: .5, pos: .3, beater: .3, body: 0, seed: 1, width: .2, drive: 0};
export class MembraneV {
  constructor(sr, f0, P, vel = P.vel){ P = {...P}; const R = rng(P.seed), b = P.hard*(.5 + .5*vel);
    Object.assign(this, {sr, f0, P, vel, R, i: 0, end: Math.ceil((P.decay*1.4 + .05)*sr), done: false, ba: .25 + .7*b, cn: P.beater > 0 ? Math.round(.006*sr) : 0, lp: 0, bph: 0, benv: P.body*vel, bdec: Math.exp(-LN1000/(P.decay*1.2*sr))});
    this.fo = Math.min(this.end, Math.round(.015*sr));
    this.modes = MEMB.map((ratio, k) => { const w = (k ? .55*Math.pow(ratio, -2.2*(1 - b))*Math.abs(Math.sin(Math.PI*(k + 1)*P.pos)) : 1)*(.6 + .4*vel), t60 = P.decay/(1 + k*.9), pan = k ? (R() - .5)*P.width : 0;
      return {ratio, env: w, dec: Math.exp(-LN1000/(t60*sr)), gl: (1 - pan)*.5, gr: (1 + pan)*.5, ph: 0, on: true}; }); }
  off(){}
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, W = 2*Math.PI*this.f0/sr, dk = 1 + P.drive*4, dn = Math.tanh(dk);
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } let l = 0, r = 0; const dp = P.drop*Math.exp(-i/(P.dropT*sr));
      for (const m of this.modes) { if (!m.on) continue; m.ph += W*m.ratio*(1 + dp); const s = Math.sin(m.ph)*m.env; l += s*m.gl; r += s*m.gr; m.env *= m.dec; if (m.env < 1e-6) m.on = false; }
      // the beater's click: noise through a quick decay, brighter for a hard beater
      if (i < this.cn) { this.lp += this.ba*((this.R()*2 - 1) - this.lp); const g = P.beater*this.vel*Math.exp(-i/(.0012*sr)); l += this.lp*g; r += this.lp*g; }
      // a shell's resonance: a low sine under it all (a kick's body)
      if (P.body > 0) { this.bph += W*.5*(1 + P.drop*.6*Math.exp(-i/(P.dropT*1.5*sr))); const s = Math.sin(this.bph)*this.benv; l += s; r += s; this.benv *= this.bdec; }
      // a soft drive: the skin's body thickened, its peaks rounded (the level kept)
      if (P.drive > 0) { l = Math.tanh(dk*l)/dn; r = Math.tanh(dk*r)/dn; }
      const f = fadeAt(i, this.end, this.fo); oL[j] += l*f; oR[j] += r*f; this.i++; } }
}
export const membrane = (sr, f0, o = {}) => render(MembraneV, sr, f0, {...MEMB_D, ...o});

// a plucked string: a noise burst, filtered by how bright the pluck is, round a loop of one period with a damping filter.
// Live, its sustain (the loop's damping) and body follow their knobs while it rings
export const STRING_D = {vel: .8, bright: .5, damp: .996, decay: 2, body: .5, seed: 1, detune: .0015};
export class StringV {
  constructor(sr, f0, P, vel = P.vel){ Object.assign(this, {sr, P, vel, i: 0, end: Math.ceil(P.decay*sr), done: false}); this.fo = Math.min(this.end, Math.round(.03*sr));
    this.ch = [[1 - P.detune, P.seed], [1 + P.detune, P.seed + 7]].map(([det, sd]) => {
      const R = rng(sd), Pp = sr/(f0*det) - .5, N = Math.floor(Pp), frac = Pp - N, buf = new Float32Array(N);   // (the average of two neighbours delays half a sample; the all-pass the rest)
      let lp = 0; const a = .1 + .85*P.bright*(.6 + .4*vel);
      for (let i = 0; i < N; i++) { lp += a*((R()*2 - 1) - lp); buf[i] = lp*vel; }
      return {buf, N, idx: 0, ap: 0, apIn: 0, c: (1 - frac)/(1 + frac), b: 0}; }); }
  off(){}
  run(oL, oR, a, b){ const damp = this.P.damp, ba = 1 - this.P.body*.7;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const f = fadeAt(i, this.end, this.fo);
      for (let k = 0; k < 2; k++) { const C = this.ch[k], buf = C.buf, j0 = C.idx % C.N, s = buf[j0];
        // the loop: an average of two neighbours (it loses its highs), the damping, an all-pass for the fractional period
        const avg = damp*(.5*(s + buf[(C.idx + 1) % C.N])), apo = C.c*avg + C.apIn - C.c*C.ap; C.apIn = avg; C.ap = apo; buf[j0] = apo; C.idx++;
        // the body: a gentle low-pass, as the instrument's wood takes the edge off
        C.b += ba*(s - C.b); if (k) oR[j] += C.b*f; else oL[j] += C.b*f; }
      this.i++; } }
}
export const string = (sr, f0, o = {}) => render(StringV, sr, f0, {...STRING_D, ...o});

// a biquad band-pass applied in place (for the beads' and droplets' resonances)
const band = (x, sr, f, q) => { const w = 2*Math.PI*f/sr, al = Math.sin(w)/(2*q), a0 = 1 + al, b0 = al/a0, b2 = -al/a0, a1 = -2*Math.cos(w)/a0, a2 = (1 - al)/a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { const v = b0*x[i] + b2*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };

// a shaker: beads colliding while the shake's energy lasts, each collision a click through the shell's resonances
export const SHAKER_D = {vel: .8, secs: .12, beads: 40, res: [3200, 5600, 8200], q: 7, seed: 1};
export class ShakerV {
  constructor(sr, f0, P, vel = P.vel){ const n = Math.ceil((P.secs + .08)*sr); Object.assign(this, {sr, vel, i: 0, end: n, done: false}); this.fo = Math.min(n, Math.round(.01*sr));
    // the collisions are drawn at the strike (their resonances' tuning after them)
    this.ch = [P.seed, P.seed + 3].map(sd => { const R = rng(sd), x = new Float32Array(n), dec = Math.exp(-LN1000/(P.secs*sr)); let energy = 1;
      for (let i = 0; i < n; i++) { if (R() < P.beads*energy/sr*6) x[i] = (R()*2 - 1)*energy; energy *= dec; }
      return {x, bands: P.res.map(f => { const w = 2*Math.PI*f*(.97 + .06*R())/sr, al = Math.sin(w)/(2*P.q), a0 = 1 + al; return {b0: al/a0, a1: -2*Math.cos(w)/a0, a2: (1 - al)/a0, x1: 0, x2: 0, y1: 0, y2: 0}; })}; }); }
  off(){}
  run(oL, oR, a, b){
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const f = fadeAt(i, this.end, this.fo)*this.vel*.9;
      for (let k = 0; k < 2; k++) { const C = this.ch[k], x = C.x[i]; let y = 0;
        for (const q of C.bands) { const v = q.b0*x - q.b0*q.x2 - q.a1*q.y1 - q.a2*q.y2; q.x2 = q.x1; q.x1 = x; q.y2 = q.y1; q.y1 = v; y += v; }
        if (k) oR[j] += y*f; else oL[j] += y*f; }
      this.i++; } }
}
export const shaker = (sr, o = {}) => render(ShakerV, sr, 0, {...SHAKER_D, ...o});

// a cloud of grains: short windowed pieces of a source (any rendered sound), scattered in time, pitch and space;
// density and spread can grow over the cloud's length (a bloom)
export function grains(sr, src, secs, {density = [4, 30], len = [.04, .14], pitches = [1], spread = .02, pan = .8, seed = 1} = {}){
  const R = rng(seed), n = Math.ceil(secs*sr), o = out(n), S = src.L, sn = S.length;
  for (let t = 0; t < secs;) {
    const x = t/secs, dens = density[0] + (density[1] - density[0])*x, g = Math.round((len[0] + (len[1] - len[0])*R())*sr);
    const p = pitches[Math.floor(R()*pitches.length)]*(1 + (R() - .5)*spread), off = Math.floor(R()*Math.max(1, sn*.6)), at = Math.floor(t*sr), pn = (R() - .5)*pan, amp = .4 + .6*R();
    for (let i = 0; i < g && at + i < n; i++) { const j = off + i*p, j0 = Math.floor(j); if (j0 + 1 >= sn) break;
      const s = (S[j0] + (S[j0 + 1] - S[j0])*(j - j0))*(.5 - .5*Math.cos(2*Math.PI*i/g))*amp; o.L[at + i] += s*(1 - pn)*.5; o.R[at + i] += s*(1 + pn)*.5; }
    t += -Math.log(1 - R())/dens; }
  return fade(o, sr, 200);
}

// rain: droplets, each a small bubble ringing and rising in pitch as it closes, over a soft hiss of distant rain
export function rain(sr, secs, {rate = [20, 60], hiss = .04, seed = 1} = {}){
  const R = rng(seed), n = Math.ceil(secs*sr), o = out(n);
  for (let t = 0; t < secs;) {
    const x = t/secs, f = 900 + 3200*Math.pow(R(), 1.6), d = .006 + .02*R(), at = Math.floor(t*sr), a = .15 + .5*Math.pow(R(), 2), pn = (R() - .5)*1.6;
    let ph = 0; const m = Math.ceil(d*5*sr);
    for (let i = 0; i < m && at + i < n; i++) { ph += 2*Math.PI*f*(1 + 2.2*i/(d*5*sr))/sr; const s = Math.sin(ph)*a*Math.exp(-i/(d*sr)); o.L[at + i] += s*(1 - pn)*.5; o.R[at + i] += s*(1 + pn)*.5; }
    t += -Math.log(1 - R())/(rate[0] + (rate[1] - rate[0])*(.5 + .5*Math.sin(x*Math.PI*3))); }
  // the hiss: noise through two low-passes, a little different each side
  for (const ch of ['L', 'R']) { let a = 0, b = 0; for (let i = 0; i < n; i++) { a += .08*((R()*2 - 1) - a); b += .3*(a - b); o[ch][i] += b*hiss*8; } }
  return fade(o, sr, 400);
}

// a hi-hat: noise high-passed twice (the sizzle) over a few short metal modes up high (the ring), dying fast
const HAT_M = [[5400, .12], [7100, .09], [8900, .07], [11300, .05]];
export const HAT_D = {vel: .8, decay: .06, tone: .6, seed: 1};
export class HatV {
  constructor(sr, f0, P, vel = P.vel){ const n = Math.ceil((P.decay*3 + .02)*sr); Object.assign(this, {sr, P: {...P}, vel, i: 0, end: n, done: false});
    // (each side's noise is drawn at the strike, its ring's phases after it)
    this.ch = [P.seed, P.seed + 5].map(sd => { const R = rng(sd), x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = R()*2 - 1;
      return {x, p1: 0, p2: 0, h1: 0, ph: HAT_M.map(() => R()*6.28)}; }); }
  off(){}
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, vel = this.vel, t = P.tone;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const e1 = Math.exp(-i/(P.decay*sr))*vel*.35, e2 = vel*Math.exp(-i/(P.decay*.7*sr));
      for (let k = 0; k < 2; k++) { const C = this.ch[k], x = C.x[i], d1 = x - C.p1; C.p1 = x; const d2 = d1 - C.p2; C.p2 = d1; C.h1 = d2*(.5 + .5*t) + C.h1*(.5 - .5*t);
        let y = C.h1*e1; for (let q = 0; q < 4; q++) { C.ph[q] += 2*Math.PI*HAT_M[q][0]*(.5 + t)/sr; y += Math.sin(C.ph[q])*HAT_M[q][1]*e2; }
        if (k) oR[j] += y; else oL[j] += y; }
      this.i++; } }
}
export const hat = (sr, o = {}) => render(HatV, sr, 0, {...HAT_D, ...o});
