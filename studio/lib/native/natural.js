// Natural sounds computed from how they happen: a water drop (the bubble it traps ringing and rising as it closes:
// Minnaert), a twig snapping (a crackle of tiny fractures through the wood's short resonances), two stones knocked
// together, leaves rustling (grains of noise swelling and dying), an insect's run of clicks, a click alone, and a bird's
// chirp (a sweep up to its note, with a quick warble), which can play a melody.
import { rng } from '../rng.js';
import { render, fadeAt } from './stream.js';

// a band-pass resonator (two poles), as the wood's and stone's modes ring
const reson = (sr, f, q) => { const w = 2*Math.PI*f/sr, al = Math.sin(w)/(2*q), a0 = 1 + al, b0 = al/a0, a1 = -2*Math.cos(w)/a0, a2 = (1 - al)/a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0*x - b0*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; };

// each natural sound a voice (stream.js), struck once: its shape drawn at the strike, its samples as they're heard
class Hit { off(){} run(oL, oR, a, b){ for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const f = fadeAt(i, this.end, this.fo), [l, r] = this.at(i); oL[j] += l*f; oR[j] += r*f; this.i++; } }
  init(sr, n, ms){ Object.assign(this, {sr, i: 0, end: n, done: false, fo: Math.min(n, Math.round(ms/1000*sr))}); } }

// a water drop: a sine at the bubble's note rising as it shrinks (rise: how far, in octaves), dying in a few hundredths
// of a second, a soft tick where the drop lands
export const DROP_D = {vel: .8, rise: .8, decay: .035, tick: .2, pan: 0, seed: 1};
export class DropV extends Hit {
  constructor(sr, f0, P, vel = P.vel){ super(); this.init(sr, Math.ceil((P.decay*6 + .01)*sr), 5); Object.assign(this, {f0, P: {...P}, vel, R: rng(P.seed), ph: 0}); }
  at(i){ const P = this.P, sr = this.sr, t = i/sr, f = this.f0*Math.pow(2, P.rise*(1 - Math.exp(-t/(P.decay*1.5))));
    this.ph += 2*Math.PI*f/sr; let x = Math.sin(this.ph)*Math.exp(-t/P.decay)*(t < .001 ? t/.001 : 1);
    if (t < .002) x += (this.R()*2 - 1)*P.tick*(1 - t/.002); x *= this.vel; return [x*(1 - P.pan)*.5*2, x*(1 + P.pan)*.5*2]; }
}
export const drop = (sr, f0, o = {}) => render(DropV, sr, f0, {...DROP_D, ...o});
// a twig: a few fractures over a few milliseconds, each a click through the wood's resonances
export const TWIG_D = {vel: .8, cracks: 5, spread: .014, res: [1300, 2600, 4400], q: 9, decay: .02, seed: 1};
export class TwigV extends Hit {
  constructor(sr, f0, P, vel = P.vel){ super(); const n = Math.ceil((P.spread + P.decay*6)*sr); this.init(sr, n, 5); Object.assign(this, {vel, sp: P.spread*sr, dec: Math.exp(-1/(P.decay*sr))});
    this.ch = [P.seed, P.seed + 4].map(sd => { const R = rng(sd), x = new Float32Array(n);
      for (let c = 0; c < P.cracks; c++) { const at = Math.floor(R()*R()*P.spread*sr), a = (.4 + .6*R())*(c ? .7 : 1); x[at] += (R() < .5 ? -1 : 1)*a; }
      return {x, rs: P.res.map(f => reson(sr, f*(.9 + .2*R()), P.q)), e: 1}; }); }
  at(i){ return this.ch.map(C => { let v = 0; for (const r of C.rs) v += r(C.x[i]); const y = v*C.e*this.vel*3; if (i > this.sp) C.e *= this.dec; return y; }); }
}
export const twig = (sr, o = {}) => render(TwigV, sr, 0, {...TWIG_D, ...o});
// two stones knocked together: two bright, short knocks a few milliseconds apart (the second softer), high modes
const STONE_M = [[1, 1], [1.62, .6], [2.37, .45], [3.1, .25]];
export const STONE_D = {vel: .8, gap: .006, decay: .018, seed: 1};
export class StoneV extends Hit {
  constructor(sr, f0, P, vel = P.vel){ super(); this.init(sr, Math.ceil((P.gap + P.decay*6)*sr), 5); const R = rng(P.seed); this.O = [];
    for (const side of [-1, 1]) for (const [at, a] of [[0, 1], [P.gap*(1 + .2*side), .55]]) for (const [r, l] of STONE_M) {
      const f = f0*r*(1 + (R() - .5)*.03); this.O.push({side, i0: Math.floor(at*sr), w: 2*Math.PI*f/sr, ph: R()*6, amp: l*a*vel*.5, tau: P.decay/r**.5}); } }
  at(i){ const o = [0, 0]; for (const q of this.O) { if (i < q.i0) continue; q.ph += q.w; o[q.side > 0 ? 1 : 0] += Math.sin(q.ph)*q.amp*Math.exp(-(i - q.i0)/this.sr/q.tau); } return o; }
}
export const stone = (sr, f0, o = {}) => render(StoneV, sr, f0, {...STONE_D, ...o});
// leaves: grains of noise, each a millisecond or two through a high band, their density swelling and dying over `secs`
export const LEAF_D = {vel: .7, secs: .25, density: 900, tone: .5, seed: 1};
export class LeafV extends Hit {
  constructor(sr, f0, P, vel = P.vel){ super(); this.init(sr, Math.ceil((P.secs + .03)*sr), 10); Object.assign(this, {vel, P: {...P}});
    this.ch = [P.seed, P.seed + 6].map(sd => ({R: rng(sd), b1: reson(sr, 2600 + 2400*P.tone, 2.5), b2: reson(sr, 5200 + 3000*P.tone, 3), g: 0, gl: 0})); }
  at(i){ const P = this.P, sr = this.sr, t = i/sr, sw = Math.sin(Math.PI*Math.min(1, t/P.secs))**1.5;
    return this.ch.map(C => { if (C.gl <= 0 && C.R() < P.density*sw/sr) { C.gl = Math.floor((.0006 + .002*C.R())*sr); C.g = (.3 + .7*C.R()); }
      const x = C.gl-- > 0 ? (C.R()*2 - 1)*C.g : 0; return (C.b1(x) + C.b2(x)*.7)*this.vel*1.4; }); }
}
export const leaf = (sr, o = {}) => render(LeafV, sr, 0, {...LEAF_D, ...o});
// an insect: a run of tiny clicks (count, at rate a second), each through a narrow high resonance, rising then falling
export const INSECT_D = {vel: .7, count: 9, rate: 55, f: 6200, q: 12, seed: 1};
export class InsectV extends Hit {
  constructor(sr, f0, P, vel = P.vel){ super(); this.init(sr, Math.ceil((P.count/P.rate + .02)*sr), 5); Object.assign(this, {vel, P: {...P}});
    this.ch = [[P.seed, 1], [P.seed + 2, 1.03]].map(([sd, fk]) => ({R: rng(sd), b: reson(sr, P.f*fk, P.q), last: -1})); }
  at(i){ const P = this.P, k = Math.floor(i/this.sr*P.rate);
    return this.ch.map(C => { const hit = k !== C.last && k < P.count; C.last = k; return C.b(hit ? Math.sin(Math.PI*(k + .5)/P.count)*(.6 + .4*C.R()) : 0)*this.vel*4; }); }
}
export const insect = (sr, o = {}) => render(InsectV, sr, 0, {...INSECT_D, ...o});
// a click: an impulse through one resonance at the note, very short (minimal techno's ticks)
export const CLICK_D = {vel: .8, q: 6, decay: .006, seed: 1};
export class ClickV extends Hit {
  constructor(sr, f0, P, vel = P.vel){ super(); this.init(sr, Math.ceil((P.decay*8 + .005)*sr), 3); Object.assign(this, {vel, decay: P.decay, b: reson(sr, Math.min(sr*.45, f0), P.q)}); }
  at(i){ const x = this.b(i === 0 ? 1 : i === 1 ? -.6 : 0)*this.vel*Math.exp(-i/(this.decay*this.sr))*3; return [x, x]; }
}
export const click = (sr, f0, o = {}) => render(ClickV, sr, f0, {...CLICK_D, ...o});
// a bird's chirp: from below its note up past it and settling (a quick FM warble on top), a little of its octave; the
// note's length sets how long it sings (up to `max`): as the song plays it, or `len`
export const BIRD_D = {vel: .7, len: .15, max: .28, from: .7, over: 1.15, warble: .03, wrate: 38, seed: 1};
export class BirdV extends Hit {
  constructor(sr, f0, P, vel = P.vel, len = P.len){ super(); const d = Math.min(P.max, Math.max(.06, len ?? P.len)); this.init(sr, Math.ceil((d + .03)*sr), 8);
    Object.assign(this, {f0, vel, d, P: {...P}, pan: (rng(P.seed)() - .5)*.6, ph: 0}); }
  at(i){ const P = this.P, d = this.d, t = i/this.sr, x = Math.min(1, t/d), sweep = x < .35 ? P.from + (P.over - P.from)*x/.35 : P.over + (1 - P.over)*(x - .35)/.65;
    const f = this.f0*sweep*(1 + P.warble*Math.sin(2*Math.PI*P.wrate*t)); this.ph += 2*Math.PI*f/this.sr;
    const e = Math.sin(Math.PI*Math.min(1, t/(d + .02)))**.7*this.vel, s = (Math.sin(this.ph) + .15*Math.sin(2*this.ph))*e*.8; return [s*(1 - this.pan), s*(1 + this.pan)]; }
}
export const bird = (sr, f0, o = {}) => render(BirdV, sr, f0, {...BIRD_D, ...o});
