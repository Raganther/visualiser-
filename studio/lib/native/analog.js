// Analog circuits computed sample by sample: a subtractive voice (band-limited saws and squares, detuned in unison, through
// a resonant state-variable filter with its own envelope: the gated chord, dub chords, stabs, pads, basses and blips, all
// native), an analog kick (a resonator whose pitch falls on two time constants, a click and a drive), a rumble (the
// low end ringing on after the kick, as a techno rumble's reverb does), a formant pad (saws through a mouth's three
// resonances drifting from vowel to vowel) and the 808's six clashing squares for hats.
import { rng } from '../rng.js';

const out = n => ({L: new Float32Array(n), R: new Float32Array(n)});
const fadeEnd = (o, sr, ms = 15) => { const n = o.L.length, f = Math.min(n, Math.round(ms/1000*sr)); for (let i = 0; i < f; i++) { const g = i/f; o.L[n - 1 - i] *= g; o.R[n - 1 - i] *= g; } return o; };
// PolyBLEP: the step in a saw or square smoothed over one sample either side, so the edges don't alias
const blep = (t, dt) => t < dt ? (t /= dt, t + t - t*t - 1) : t > 1 - dt ? (t = (t - 1)/dt, t*t + t + t + 1) : 0;
const saw = (t, dt) => 2*t - 1 - blep(t, dt);
const square = (t, dt) => (t < .5 ? 1 : -1) + blep(t, dt) - blep((t + .5) % 1, dt);
const WAVES = {saw, square, tri: null};
// a state-variable filter (the trapezoidal form: stable however fast its cutoff moves)
function svf(){ let s1 = 0, s2 = 0, a1 = 0, a2 = 0, a3 = 0;
  return {set(g, k){ a1 = 1/(1 + g*(g + k)); a2 = g*a1; a3 = g*a2; this.k = k; },
    run(x){ const v3 = x - s2, v1 = a1*s1 + a2*v3, v2 = s2 + a2*s1 + a3*v3; s1 = 2*v1 - s1; s2 = 2*v2 - s2; this.bp = v1; return v2; }}; }
const adsr = (t, a, d, s, len, r) => { const at = t < a ? t/a : s + (1 - s)*Math.exp(-(t - a)/Math.max(.001, d)); if (t < len) return at;
  const atLen = len < a ? len/a : s + (1 - s)*Math.exp(-(len - a)/Math.max(.001, d)); return atLen*Math.exp(-6.9*(t - len)/r); };

// the subtractive voice. wave and wave2 (saw, square or tri), detune in semitones spread over `voices`, sub an octave down,
// noise; the filter: cut (Hz), res 0..1, fenv (octaves the envelope opens it by), fa fd its attack and fall, keytrack;
// the amp: a d s r over the note's len; drive; drift (slow wandering of each voice's pitch, in cents)
export function va(sr, f0, {vel = .8, wave = 'saw', wave2 = null, mix2 = .5, semi2 = 0, voices = 1, detune = .1, width = .6, sub = 0, noise = 0,
  cut = 1200, res = .2, fenv = 1, fa = .002, fd = .25, keytrack = .4, mode = 'lp', a = .004, d = .3, s = .6, r = .2, len = .4, drive = 0, drift = 3, tone = .5, stretch = 1, seed = 1} = {}){
  cut *= Math.pow(2, (tone - .5)*3); d *= stretch; r *= stretch; fd *= stretch;   // (tone: the filter darker or brighter; stretch: every fall longer)
  const n = Math.ceil((len + r*1.4 + .02)*sr), o = out(n), R = rng(seed), V = [];
  const add = (w, ratio, lvl) => { for (let v = 0; v < voices; v++) { const sp = voices > 1 ? v/(voices - 1)*2 - 1 : 0;
    V.push({w, f: f0*ratio*Math.pow(2, sp*detune/12), lvl: lvl/Math.sqrt(voices), pan: sp*width, ph: R(), dph: R()*6.28, drate: .1 + .3*R(), tri: 0}); } };
  add(wave, 1, wave2 ? 1 - mix2*.5 : 1); if (wave2) add(wave2, Math.pow(2, semi2/12), mix2);
  const fL = svf(), fR = svf(), k = 2 - 1.9*Math.min(.98, res), kt = Math.pow(f0/261.6, keytrack), dk = 1 + drive*6, dn = Math.tanh(dk), iv = .5 + .5*vel;
  let subPh = 0, nz = 0;
  for (let i = 0; i < n; i++) { const t = i/sr;
    if (i % 16 === 0) { const fe = t < fa ? t/fa : Math.exp(-(t - fa)/fd), fc = Math.min(sr*.45, cut*kt*Math.pow(2, fenv*fe*iv)), g = Math.tan(Math.PI*fc/sr); fL.set(g, k); fR.set(g, k); }
    let L = 0, Rr = 0;
    for (const v of V) { const f = v.f*(1 + drift/1200*Math.sin(v.dph + 2*Math.PI*v.drate*t)), dt = f/sr; v.ph += dt; v.ph -= Math.floor(v.ph);
      let x; if (v.w === 'tri') { v.tri = .999*v.tri + 4*dt*square(v.ph, dt); x = v.tri; } else x = WAVES[v.w](v.ph, dt);
      x *= v.lvl; L += x*(1 - v.pan)*.5; Rr += x*(1 + v.pan)*.5; }
    if (sub) { subPh += f0*.5/sr; subPh -= Math.floor(subPh); const s0 = Math.sin(2*Math.PI*subPh)*sub*.5; L += s0; Rr += s0; }
    if (noise) { nz = (R()*2 - 1)*noise*.3; L += nz; Rr += nz; }
    let yl = fL.run(L), yr = fR.run(Rr); if (mode === 'bp') { yl = fL.bp; yr = fR.bp; }
    const e = adsr(t, a, d, s, len, r)*vel; if (drive) { yl = Math.tanh(dk*yl)/dn; yr = Math.tanh(dk*yr)/dn; }
    o.L[i] = yl*e; o.R[i] = yr*e; }
  return fadeEnd(o, sr);
}
// the voices the jam and the songs play: native versions of the poly synth's sounds the user liked, and new ones
export const VA = {
  vagate: {wave: 'saw', voices: 2, detune: .1, width: .8, cut: 1500, res: .15, fenv: 1.2, fd: .09, a: .004, d: .11, s: 0, r: .06},
  vadub: {wave: 'saw', wave2: 'square', mix2: .5, voices: 2, detune: .08, width: .7, cut: 650, res: .4, fenv: 1.8, fd: .13, keytrack: .3, a: .003, d: .25, s: .05, r: .22},
  vastab: {wave: 'square', voices: 1, cut: 800, res: .5, fenv: 2.4, fd: .06, a: .002, d: .13, s: 0, r: .08, drive: .15},
  vapad: {wave: 'saw', voices: 5, detune: .14, width: 1, cut: 800, res: .1, fenv: .8, fa: 1.2, fd: 2.5, a: 1.1, d: 2, s: .85, r: 2.2, drift: 6},
  vastrings: {wave: 'saw', voices: 7, detune: .22, width: 1, cut: 2100, res: 0, fenv: .3, fa: .8, fd: 3, keytrack: .6, a: .6, d: 1.5, s: .9, r: 1.6, drift: 8},
  vasub: {wave: 'saw', voices: 1, sub: .9, cut: 380, res: .25, fenv: 1.1, fd: .15, keytrack: .5, a: .003, d: .3, s: .55, r: .07, drive: .3},
  vapluck: {wave: 'square', voices: 1, sub: .4, cut: 260, res: .55, fenv: 2.6, fd: .08, keytrack: .5, a: .002, d: .16, s: 0, r: .06},
  vablip: {wave: 'square', wave2: 'tri', mix2: .5, semi2: 12, voices: 1, cut: 2000, res: .3, fenv: 1.4, fd: .035, a: .002, d: .09, s: 0, r: .05},
};

// an analog kick: a resonator ringing at the note, its pitch falling from `start` times it on a fast and a slow time
// constant; its body dying over `decay` with a longer `boom` under it; a click at the strike; a drive
export function akick(sr, f0, {vel = .9, start = 4, t1 = .005, t2 = .04, decay = .38, boom = 0, boomDecay = 1.2, click = .25, tone = .5, drive = .3, seed = 1} = {}){
  const T = Math.max(decay*4, boom ? boomDecay*3 : 0) + .05, n = Math.ceil(T*sr), o = out(n), R = rng(seed), dk = 1 + drive*5, dn = Math.tanh(dk);
  let ph = 0, lp = 0, hp = 0;
  for (let i = 0; i < n; i++) { const t = i/sr, f = f0*(1 + (start - 1)*(.45*Math.exp(-t/t1) + .55*Math.exp(-t/t2)));
    ph += 2*Math.PI*f/sr; const e = (t < .0006 ? t/.0006 : 1)*((1 - boom)*Math.exp(-t/decay) + boom*Math.exp(-t/boomDecay));
    let x = Math.sin(ph)*e;
    if (click && t < .012) { const nz = R()*2 - 1; lp += (.15 + .7*tone)*(nz - lp); const h = lp - hp; hp += .05*(lp - hp); x += h*click*Math.exp(-t/.0018)*1.5; }
    x = Math.tanh(dk*x)/dn*vel; o.L[i] = x; o.R[i] = x; }
  return fadeEnd(o, sr, 20);
}
export const KICKS = {
  kround: {start: 3.6, t2: .035, decay: .32, click: .2, tone: .35, drive: .25},
  kdub: {start: 3, t2: .05, decay: .3, boom: .45, boomDecay: .9, click: .1, tone: .25, drive: .15},
  ktight: {start: 5, t1: .003, t2: .022, decay: .18, click: .4, tone: .7, drive: .45},
  kdeep: {start: 3.2, t2: .06, decay: .5, boom: .25, boomDecay: 1.4, click: .12, tone: .3, drive: .2},
};

// a rumble: the low end after a kick ringing on, as a techno rumble's dark reverb does: low noise through a resonant
// low-pass at the note and a sine under it, swelling a moment after the hit and dying over the note, driven a little
export function rumble(sr, f0, {vel = .8, len = .4, decay = .5, res = .8, grit = .35, drive = .5, seed = 1} = {}){
  const n = Math.ceil((len + decay*2 + .05)*sr), o = out(n), dk = 1 + drive*5, dn = Math.tanh(dk);
  for (const [y, sd] of [[o.L, seed], [o.R, seed + 9]]) { const R = rng(sd), f = svf(), g = Math.tan(Math.PI*Math.min(sr*.45, f0*2.2)/sr); f.set(g, 2 - 1.9*res); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i/sr, sw = (1 - Math.exp(-t/.012))*(t < len ? Math.exp(-t/(decay*1.6)) : Math.exp(-len/(decay*1.6))*Math.exp(-(t - len)/(decay*.6)));
      ph += 2*Math.PI*f0/sr; const x = f.run((R()*2 - 1)*grit) + Math.sin(ph)*.6; y[i] = Math.tanh(dk*x*sw)/dn*vel; } }
  return fadeEnd(o, sr, 30);
}

// a formant pad: saws (and a breath of noise) through a mouth's three resonances, drifting from vowel to vowel over the
// note: dark vowels by default (o, u, a), so it's airy and human without being sweet
const VOWELS = {a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2700], e: [400, 1600, 2700], i: [300, 1900, 2800]};
export function formant(sr, f0, {vel = .7, len = 3, a = .8, r = 1.6, path = 'oua', drift = .5, q = 9, breathy = .15, voices = 3, detune = .12, seed = 1} = {}){
  const n = Math.ceil((len + r*1.3)*sr), o = out(n), R = rng(seed), P = [...path].map(v => VOWELS[v]), env = t => t < a ? .5 - .5*Math.cos(Math.PI*t/a) : t < len ? 1 : Math.exp(-6.9*(t - len)/r);
  const V = Array.from({length: voices}, (_, v) => ({f: f0*Math.pow(2, (voices > 1 ? v/(voices - 1)*2 - 1 : 0)*detune/12), ph: R(), pan: voices > 1 ? (v/(voices - 1)*2 - 1)*.7 : 0}));
  const bands = [0, 1, 2].map(() => ({L: svf(), R: svf()})), gains = [1, .55, .3];
  for (let i = 0; i < n; i++) { const t = i/sr;
    if (i % 32 === 0) { const x = (t*drift/Math.max(1, len))*(P.length - 1) % Math.max(1, P.length - 1), j = Math.floor(x), w = x - j, A = P[j], B = P[Math.min(P.length - 1, j + 1)];
      bands.forEach((b, k) => { const fc = A[k] + (B[k] - A[k])*(.5 - .5*Math.cos(Math.PI*w)), g = Math.tan(Math.PI*Math.min(sr*.45, fc)/sr), kk = 1/q; b.L.set(g, kk); b.R.set(g, kk); }); }
    let L = 0, Rr = 0; for (const v of V) { const dt = v.f/sr; v.ph += dt; v.ph -= Math.floor(v.ph); const x = saw(v.ph, dt)/Math.sqrt(voices); L += x*(1 - v.pan)*.5; Rr += x*(1 + v.pan)*.5; }
    const nz = (R()*2 - 1)*breathy; L += nz; Rr += nz;
    let yl = 0, yr = 0; bands.forEach((b, k) => { b.L.run(L); b.R.run(Rr); yl += b.L.bp*gains[k]/q; yr += b.R.bp*gains[k]/q; });   // (a band-pass rings q times over at its peak)
    const e = env(t)*vel*.9; o.L[i] = yl*e; o.R[i] = yr*e; }
  return fadeEnd(o, sr, 30);
}

// the 808's hats: six square oscillators at clashing frequencies, through a band-pass and a high-pass, dying over decay;
// tone tunes the metal; a breath of noise for the sizzle
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
export function hat808(sr, {vel = .8, decay = .05, tone = .5, sizzle = .25, seed = 1} = {}){
  const n = Math.ceil((decay*5 + .02)*sr), o = out(n), R = rng(seed), k = .75 + .7*tone, ph = METAL.map(() => R());
  const bpL = svf(), bpR = svf(), fc = 7400 + 3000*tone; bpL.set(Math.tan(Math.PI*Math.min(sr*.45, fc)/sr), .9); bpR.set(Math.tan(Math.PI*Math.min(sr*.45, fc*1.04)/sr), .9);
  let hl = 0, hr = 0, pl = 0, pr = 0;
  for (let i = 0; i < n; i++) { let m = 0; METAL.forEach((f, j) => { ph[j] += f*k/sr; ph[j] -= Math.floor(ph[j]); m += ph[j] < .5 ? 1 : -1; }); m /= 6;
    const nz = (R()*2 - 1)*sizzle, e = Math.exp(-i/(decay*sr))*(i < 24 ? i/24 : 1)*vel;
    bpL.run(m + nz); bpR.run(m - nz*.5); const xl = bpL.bp, xr = bpR.bp;
    // a high-pass by differencing, twice gentler on the right for a little width
    hl = xl - pl; pl = xl; hr = xr - pr; pr = xr; o.L[i] = (xl*.4 + hl*.9)*e; o.R[i] = (xr*.4 + hr*.8)*e; }
  return fadeEnd(o, sr, 5);
}
