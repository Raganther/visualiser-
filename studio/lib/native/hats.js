// A hi-hat as a real one is: two cymbals clashing: many inharmonic partials (the higher the sooner gone), the rattle of the two plates as noise whose loudness flutters as they chatter, the stick's tick at the
// start and a felt body round 3 kHz that gives it weight. `open` lets the pair ring and wash (0 a tight chick, 1 wide
// open), and how hard it's hit decides how bright, long and wide it is, so accents open up and ghost notes stay tight.
// `foot`: the pedal closing it (the chick, no stick). Both ears hear the same pair, and a second, quieter pair heard a
// little apart in each (`width`) spreads it without the hollow sound of two unrelated sides.
import { rng } from '../rng.js';
import { render } from './stream.js';

// a state-variable filter (the trapezoidal form)
function svf(f, q, sr){ let s1 = 0, s2 = 0; const g = Math.tan(Math.PI*Math.min(f, sr*.45)/sr), k = 1/q, a1 = 1/(1 + g*(g + k)), a2 = g*a1, a3 = g*a2;
  return x => { const v3 = x - s2, v1 = a1*s1 + a2*v3, v2 = s2 + a2*s1 + a3*v3; s1 = 2*v1 - s1; s2 = 2*v2 - s2; return {lp: v2, bp: v1, hp: x - k*v1 - v2}; }; }

export const HIHAT_D = {vel: .8, open: 0, tone: .5, body: .5, width: .6, seed: 1, foot: 0};
const WIN = .02;   // (its loudness is set from its first 20 ms, where its peak always falls)
export class HihatV {
  constructor(sr, f0, P, vel = P.vel){ const hard = Math.max(.1, Math.min(1, vel)), foot = P.foot, op = Math.max(0, Math.min(1, P.open + .12*(hard - .6)*(1 - foot)));
    // the ring's time (to 1/e) and the first chick's
    const dec = (.016 + .3*op*op)*(.8 + .45*hard), chick = .007 + .015*op, n = Math.ceil((dec*4.5 + .04)*sr);
    Object.assign(this, {sr, i: 0, end: n, done: false, hard, op, dec, chick, foot, body: P.body, width: P.width}); this.fo = Math.min(n, Math.round(.008*sr));
    this.pairs = [0, 1].map(ci => { const R = rng(P.seed*13 + ci*7 + 1), spread = ci*.008;
      // the plates' partials, log-spaced from 3 to 15 kHz with a little jitter, the lower ones louder and longer
      const parts = Array.from({length: 20}, (_, k) => { const f = 3000*Math.pow(15000/3000, (k + .8*R())/20)*(1 + spread*(1 + R())), d = dec*(.55 + .9*R())*Math.pow(3000/f, .45);
        const w = 2*Math.PI*f/sr, ph = R()*6.28, a = (.55 + .45*R())/Math.sqrt(1 + .3*k);
        // (each turned a sample at a time and shrunk by its decay: a decaying sine without computing one)
        return {re: a*Math.cos(ph), im: a*Math.sin(ph), cw: Math.cos(w), sw: Math.sin(w), m: Math.exp(-1/(Math.max(.004, d)*sr))}; });
      // the brightness: a one-pole low-pass that opens the harder it's hit
      return {R, parts, hiss: svf(5200 + 4200*P.tone, .55, sr), bod: svf(3400 + 600*P.tone, 1.4, sr), tick: svf(9000, .7, sr), lc: Math.exp(-2*Math.PI*Math.min(sr*.45, 6500 + 10500*hard*(.6 + .6*P.tone))/sr), lp: 0, flut: 1, fv: 0}; });
    // its first moments computed now, to set its loudness: the peak to the velocity
    const w = Math.min(n, Math.round(WIN*sr)); this.head = [new Float64Array(w), new Float64Array(w)]; let pk = 1e-9;
    for (let i = 0; i < w; i++) { const [l, r] = this.sample(i); this.head[0][i] = l; this.head[1][i] = r; pk = Math.max(pk, Math.abs(l), Math.abs(r)); }
    this.g = .9*hard/pk; }
  // one sample of the pair in the middle, the second pair's difference to the sides
  sample(i){ const sr = this.sr, t = i/sr, op = this.op, foot = this.foot, hard = this.hard, ys = [0, 0];
    const eRing = Math.exp(-t/this.dec), eChick = Math.exp(-t/this.chick), eStick = Math.exp(-t/.0016), eBod = Math.exp(-t/(this.chick*(1.4 + foot)));
    for (let ci = 0; ci < 2; ci++) { const p = this.pairs[ci], R = p.R;
      let ring = 0; for (const q of p.parts) { const re = q.re*q.cw - q.im*q.sw, im = q.re*q.sw + q.im*q.cw; ring += im; q.re = re*q.m; q.im = im*q.m; }
      // the plates chattering: a wobble in the rattle's loudness, more the more open
      if (i % 64 === 0) { p.fv = p.fv*.6 + (R() - .5)*.8; p.flut = 1 + p.fv*(.25 + .6*op); }
      const x = R()*2 - 1, h = p.hiss(x), b = p.bod(x), tk = p.tick(x);
      const s = ring*.09*(.35*eChick + .65*eRing)*(1 - .5*foot)
        + h.bp*(.55*eChick + .45*eRing*p.flut)*(.9 + .3*op)
        + b.bp*this.body*(.55 + .6*foot)*eBod*(1.3 - .4*hard)
        + tk.hp*eStick*hard*.9*(1 - foot);
      p.lp = s + (p.lp - s)*p.lc; ys[ci] = p.lp*Math.min(1, i/(sr*.0004 + 1)); }
    const d = (ys[1] - ys[0])*.5*this.width; return [ys[0] + d, ys[0] - d]; }
  off(){}
  run(oL, oR, a, b){ const n = this.end, w = this.head[0].length, f = this.fo;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= n) { this.done = true; return; }
      const [l, r] = i < w ? [this.head[0][i], this.head[1][i]] : this.sample(i), e = this.g*(i > n - f ? (n - i)/f : 1); oL[j] += l*e; oR[j] += r*e; this.i++; } }
}
export const hihat = (sr, o = {}) => render(HihatV, sr, 0, {...HIHAT_D, ...o});
