// Pads and basses computed sample by sample, each held for the note's length: FM (one sine wobbling another's phase, the
// wobble's depth falling after the strike: glassy, round or plucked), additive (a sound built partial by partial, each
// with its own bloom and slow movement), a breath pad (noise through a bank of narrow resonances on the harmonics, as air
// in a tube or a bowed string) and a grain pad (a cloud of grains from a struck bar, held as a chord).
import { rng } from '../rng.js';
import { modal, MODAL } from './modal.js';
import { grains } from './body.js';

const out = n => ({L: new Float32Array(n), R: new Float32Array(n)});
// an envelope: rises over `a`, holds until `len`, then falls away over `r` (exponentially, to silence)
const env = (i, sr, a, len, r) => { const t = i/sr; if (t < a) return .5 - .5*Math.cos(Math.PI*t/a); if (t < len) return 1; return Math.exp(-6.9*(t - len)/r); };

// two-operator FM: the carrier at f0, the modulator at ratio×f0, its index (how much it bends the carrier) falling from
// `index` to `indexEnd` over `indexT`; an amplitude ADSR; the two sides a few cents apart
export function fm(sr, f0, {vel = .8, ratio = 1, index = 2, indexEnd = .4, indexT = .15, a = .003, dec = .3, sus = .3, r = .12, len = .3, det = .002, fb = 0} = {}){
  const n = Math.ceil((len + r*1.5 + .02)*sr), o = out(n), iv = .55 + .45*vel;
  for (const [y, k] of [[o.L, 1 - det], [o.R, 1 + det]]) {
    let pc = 0, pm = 0, last = 0;
    for (let i = 0; i < n; i++) { const t = i/sr, I = (indexEnd + (index - indexEnd)*Math.exp(-t/indexT))*iv;
      pm += 2*Math.PI*f0*ratio*k/sr; pc += 2*Math.PI*f0*k/sr;
      const m = Math.sin(pm + fb*last); last = m;
      const e = t < a ? t/a : t < len ? sus + (1 - sus)*Math.exp(-(t - a)/dec) : (sus + (1 - sus)*Math.exp(-(len - a)/dec))*Math.exp(-6.9*(t - len)/r);
      y[i] = Math.sin(pc + I*m)*e*vel; } }
  return o;
}

// additive: partials 1..N, each k^-tilt loud, slightly out of tune with the next (spread), arriving one by one (bloom: the
// higher ones later), each swelling and fading on its own slow cycle (wob), alternating sides
export function additive(sr, f0, {vel = .7, N = 18, tilt = 1.3, odd = 1, a = 1.2, bloom = 3, len = 4, r = 2, wob = .35, spread = .0025, seed = 1} = {}){
  const R = rng(seed), n = Math.ceil((len + r*1.2)*sr), o = out(n);
  for (let k = 1; k <= N; k++) {
    const f = f0*k*(1 + (R() - .5)*spread*Math.sqrt(k)); if (f > sr*.42) break;
    const amp = Math.pow(k, -tilt)*(k % 2 ? 1 : odd)*vel, pa = a + bloom*R()*(k - 1)/N, lr = .04 + .22*R(), lp = R()*6.28, pan = k === 1 ? 0 : (k % 2 ? -1 : 1)*(.25 + .5*R());
    let ph = R()*6.28; const gl = (1 - pan)*.5, gr = (1 + pan)*.5;
    for (let i = 0; i < n; i++) { ph += 2*Math.PI*f/sr; const t = i/sr, s = Math.sin(ph)*amp*env(i, sr, pa, len, r)*(1 - wob*(.5 - .5*Math.cos(2*Math.PI*lr*t + lp))); o.L[i] += s*gl; o.R[i] += s*gr; }
  }
  return o;
}

// a breath pad: noise through narrow band-passes on the first N harmonics (each k^-1 loud), swelling in and out: the sound
// of air in a tube, or a bow on a string, held
export function breath(sr, f0, {vel = .7, N = 8, q = 70, a = .9, len = 4, r = 1.6, seed = 1, air = .04} = {}){
  const n = Math.ceil((len + r*1.2)*sr), o = out(n);
  for (const [y, sd] of [[o.L, seed], [o.R, seed + 11]]) {
    const R = rng(sd), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = R()*2 - 1;
    for (let k = 1; k <= N; k++) { const f = f0*k; if (f > sr*.42) break; const w = 2*Math.PI*f/sr, al = Math.sin(w)/(2*q), a0 = 1 + al, b0 = al/a0, a1 = -2*Math.cos(w)/a0, a2 = (1 - al)/a0, g = Math.pow(k, -1)*Math.sqrt(q)*.5;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < n; i++) { const v = b0*x[i] - b0*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] += v*g; } }
    for (let i = 0; i < n; i++) y[i] = (y[i] + x[i]*air)*env(i, sr, a, len, r)*vel; }
  return o;
}

// a grain pad: a cloud of grains taken from a struck bar (vibes by default) at the note, steady, held, faded in and out
export function grainPad(sr, f0, {vel = .7, src = 'vibes', density = 26, a = .7, len = 4, r = 1.5, seed = 1} = {}){
  const p = MODAL[src], s = modal(sr, f0, p.modes, {...p, trem: 0, vel: .7, len: 1.5});
  const o = grains(sr, s, len + r, {density: [density, density], len: [.08, .26], pitches: [1, 1, 2, 1.5], spread: .006, pan: .9, seed});
  for (let i = 0; i < o.L.length; i++) { const e = env(i, sr, a, len, r)*vel; o.L[i] *= e; o.R[i] *= e; }
  return o;
}
