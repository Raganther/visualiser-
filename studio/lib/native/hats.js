// A hi-hat as a real one is: two cymbals clashing: many inharmonic partials (the higher the sooner gone), the rattle of the two plates as noise whose loudness flutters as they chatter, the stick's tick at the
// start and a felt body round 3 kHz that gives it weight. `open` lets the pair ring and wash (0 a tight chick, 1 wide
// open), and how hard it's hit decides how bright, long and wide it is, so accents open up and ghost notes stay tight.
// `foot`: the pedal closing it (the chick, no stick). Both ears hear the same pair, and a second, quieter pair heard a
// little apart in each (`width`) spreads it without the hollow sound of two unrelated sides.
import { rng } from '../rng.js';

const out = n => ({L: new Float32Array(n), R: new Float32Array(n)});
// a state-variable filter (the trapezoidal form)
function svf(f, q, sr){ let s1 = 0, s2 = 0; const g = Math.tan(Math.PI*Math.min(f, sr*.45)/sr), k = 1/q, a1 = 1/(1 + g*(g + k)), a2 = g*a1, a3 = g*a2;
  return x => { const v3 = x - s2, v1 = a1*s1 + a2*v3, v2 = s2 + a2*s1 + a3*v3; s1 = 2*v1 - s1; s2 = 2*v2 - s2; return {lp: v2, bp: v1, hp: x - k*v1 - v2}; }; }

export function hihat(sr, {vel = .8, open = 0, tone = .5, body = .5, width = .6, seed = 1, foot = 0} = {}){
  const hard = Math.max(.1, Math.min(1, vel)), op = Math.max(0, Math.min(1, open + .12*(hard - .6)*(1 - foot)));
  // the ring's time (to 1/e) and the first chick's
  const dec = (.016 + .3*op*op)*(.8 + .45*hard), chick = .007 + .015*op, n = Math.ceil((dec*4.5 + .04)*sr), o = out(n), ys = [new Float32Array(n), new Float32Array(n)];
  for (const ci of [0, 1]) { const R = rng(seed*13 + ci*7 + 1), y = ys[ci], spread = ci*.008;
    // the plates' partials, log-spaced from 3 to 15 kHz with a little jitter, the lower ones louder and longer
    const P = Array.from({length: 20}, (_, k) => { const f = 3000*Math.pow(15000/3000, (k + .8*R())/20)*(1 + spread*(1 + R())), d = dec*(.55 + .9*R())*Math.pow(3000/f, .45);
      return {w: 2*Math.PI*f/sr, ph: R()*6.28, a: (.55 + .45*R())/Math.sqrt(1 + .3*k), m: Math.exp(-1/(Math.max(.004, d)*sr))}; });
    const hiss = svf(5200 + 4200*tone, .55, sr), bod = svf(3400 + 600*tone, 1.4, sr), tick = svf(9000, .7, sr);
    // the brightness: a one-pole low-pass that opens the harder it's hit
    const lc = Math.exp(-2*Math.PI*Math.min(sr*.45, 6500 + 10500*hard*(.6 + .6*tone))/sr);
    let lp = 0, flut = 1, fv = 0;
    for (let i = 0; i < n; i++) { const t = i/sr;
      let ring = 0; for (const p of P) { p.ph += p.w; ring += Math.sin(p.ph)*p.a; p.a *= p.m; }
      // the plates chattering: a wobble in the rattle's loudness, more the more open
      if (i % 64 === 0) { fv = fv*.6 + (R() - .5)*.8; flut = 1 + fv*(.25 + .6*op); }
      const x = R()*2 - 1, h = hiss(x), b = bod(x), tk = tick(x);
      const eRing = Math.exp(-t/dec), eChick = Math.exp(-t/chick), eStick = Math.exp(-t/.0016);
      let s = ring*.09*(.35*eChick + .65*eRing)*(1 - .5*foot)
        + h.bp*(.55*eChick + .45*eRing*flut)*(.9 + .3*op)
        + b.bp*body*(.55 + .6*foot)*Math.exp(-t/(chick*(1.4 + foot)))*(1.3 - .4*hard)
        + tk.hp*eStick*hard*.9*(1 - foot);
      lp = s + (lp - s)*lc; y[i] = lp*Math.min(1, i/(sr*.0004 + 1)); } }
  // the pair in the middle, the second pair's difference to the sides
  for (let i = 0; i < n; i++) { const m = ys[0][i], d = (ys[1][i] - ys[0][i])*.5*width; o.L[i] = m + d; o.R[i] = m - d; }
  // to its loudness: the peak to the velocity, a short fade at the end
  let pk = 1e-9; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(o.L[i]), Math.abs(o.R[i]));
  const g = .9*hard/pk, f = Math.min(n, Math.round(.008*sr)); for (let i = 0; i < n; i++) { const e = i > n - f ? (n - i)/f : 1; o.L[i] *= g*e; o.R[i] *= g*e; }
  return o;
}
