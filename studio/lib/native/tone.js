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

// a rubbed or bowed body: a bow's excitation (the stick and slip of the hair, a sawtooth at the note whose period wavers,
// and the hair's own noise) driving the body's resonances (modes: [[ratio, level, T60], …]) as narrow resonators, swelling
// in as the bow catches and dying away as it's lifted; `bright` mixes the saw over the noise (a string sings, a rubbed
// glass or bowl rings from the noise alone), `rough` the bow's waver; a doublet beats where `beat` > 0
export function rubbed(sr, f0, modes, {vel = .7, a = .4, len = 2, r = .9, bright = .5, rough = .3, beat = 0, width = .5, seed = 1} = {}){
  const n = Math.ceil((len + r*1.4 + .02)*sr), o = out(n), R0 = rng(seed), list = [];
  modes.forEach(([ratio, lvl, t60], k) => { const f = f0*ratio; if (f >= sr*.42 || f < 20) return; const pan = k ? (R0() - .5)*width : 0;
    list.push({f, lvl, t60, pan}); if (beat > 0 && k < 4) list.push({f: f*(1 + beat*(.7 + .6*R0())), lvl: lvl*.6, t60, pan: -pan}); });
  for (const [y, sd, side] of [[o.L, seed, -1], [o.R, seed + 13, 1]]) {
    const R = rng(sd), x = new Float32Array(n); let ph = 0, w = 0, lp = 0;
    for (let i = 0; i < n; i++) { w += .002*((R()*2 - 1) - w); ph += f0*(1 + rough*.006*w*30)/sr; ph -= Math.floor(ph); const saw = 2*ph - 1; lp += .3*((R()*2 - 1) - lp);
      x[i] = (saw*bright + lp*(1 - bright)*1.6)*env(i, sr, a, len, r*.6); }
    for (const m of list) { const g = (1 - side*m.pan)*.5, wn = 2*Math.PI*m.f/sr, rr = Math.exp(-6.9/(Math.max(.05, m.t60)*sr)), c1 = 2*rr*Math.cos(wn), c2 = rr*rr, norm = (1 - rr)*m.lvl*g*2;
      let y1 = 0, y2 = 0; for (let i = 0; i < n; i++) { const v = x[i] + c1*y1 - c2*y2; y2 = y1; y1 = v; y[i] += v*norm; } } }
  let pk = 1e-9; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(o.L[i]), Math.abs(o.R[i]));
  const k = .5*vel/pk, fo = Math.min(n, Math.round(.03*sr)); for (let i = 0; i < n; i++) { const g = i >= n - fo ? (n - 1 - i)/fo : 1; o.L[i] *= k*g; o.R[i] *= k*g; }
  return o;
}
// the bowed bodies: a low string (harmonic, the saw singing through it), bowed metal (a plate's crowded modes), a glass
// harmonica (pure, nearly one partial, rubbed) and a singing bowl rubbed round its rim (its modes beating)
export const RUBBED = {
  bowed: {modes: Array.from({length: 14}, (_, k) => [k + 1, Math.pow(k + 1, -.7)*(k % 2 ? .8 : 1), 1.2]), bright: .75, rough: .35, a: .35, width: .3},
  bowmetal: {modes: [[1, 1, 2.5], [1.52, .7, 2], [2.0, .5, 1.8], [2.65, .45, 1.4], [3.4, .3, 1.1], [4.06, .2, .9], [5.2, .1, .6]], bright: .15, rough: .5, beat: .004, a: .9, width: .6},
  glassharm: {modes: [[1, 1, 2.5], [2.0, .12, 1.4], [3.0, .03, .8]], bright: .05, rough: .2, beat: .0015, a: .25, width: .35},
  rubbowl: {modes: [[1, 1, 6], [2.71, .45, 4], [5.06, .2, 2.5], [7.9, .08, 1.5]], bright: .05, rough: .4, beat: .003, a: 1.2, width: .5},
};

// a deep sub: a sine whose pitch falls from above to its note as it starts, held, saturated softly (drive) for its
// harmonics so it's heard on small speakers, a little of its octave below the knee
export function sub808(sr, f0, {vel = .8, drop = 1, dropT = .03, drive = .4, dec = 1.2, sus = .6, len = .5, r = .12} = {}){
  const n = Math.ceil((len + r*1.5 + .02)*sr), o = out(n), k = 1 + drive*5, nk = Math.tanh(k); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i/sr; ph += 2*Math.PI*f0*(1 + drop*Math.exp(-t/dropT))/sr;
    const e = t < .004 ? t/.004 : t < len ? sus + (1 - sus)*Math.exp(-t/dec) : (sus + (1 - sus)*Math.exp(-len/dec))*Math.exp(-6.9*(t - len)/r);
    const s = Math.tanh(k*Math.sin(ph))/nk*e*vel; o.L[i] = s; o.R[i] = s; }
  return o;
}
