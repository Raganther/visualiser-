// Analog circuits computed sample by sample: a subtractive voice (band-limited saws and squares, detuned in unison, through
// a resonant state-variable filter with its own envelope: the gated chord, dub chords, stabs, pads, basses and blips, all
// native), an analog kick (a resonator whose pitch falls on two time constants, a click and a drive), a rumble (the
// low end ringing on after the kick, as a techno rumble's reverb does), a formant pad (saws through a mouth's three
// resonances drifting from vowel to vowel) and the 808's six clashing squares for hats.
import { rng } from '../rng.js';
import { render, fadeAt } from './stream.js';

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
// the amp: a d s r over the note's len; drive; drift (slow wandering of each voice's pitch, in cents). Live, the filter,
// envelopes, drive, sub and noise follow their knobs while the note sounds; the oscillators are set at its start.
export const VA_D = {vel: .8, wave: 'saw', wave2: null, mix2: .5, semi2: 0, voices: 1, detune: .1, width: .6, sub: 0, noise: 0,
  cut: 1200, res: .2, fenv: 1, fa: .002, fd: .25, keytrack: .4, mode: 'lp', a: .004, d: .3, s: .6, r: .2, len: .4, drive: 0, drift: 3, tone: .5, stretch: 1, seed: 1};
export class VaV {
  constructor(sr, f0, P, vel = P.vel){ Object.assign(this, {sr, f0, P, vel, i: 0, rel: Infinity, end: Infinity, done: false, subPh: 0});
    const R = this.R = rng(P.seed), V = this.V = [], n = P.voices;
    const add = (w, ratio, lvl) => { for (let v = 0; v < n; v++) { const sp = n > 1 ? v/(n - 1)*2 - 1 : 0;
      V.push({w, f: f0*ratio*Math.pow(2, sp*P.detune/12), lvl: lvl/Math.sqrt(n), pan: sp*P.width, ph: R(), dph: R()*6.28, drate: .1 + .3*R(), tri: 0}); } };
    add(P.wave, 1, P.wave2 ? 1 - P.mix2*.5 : 1); if (P.wave2) add(P.wave2, Math.pow(2, P.semi2/12), P.mix2);
    this.fL = svf(); this.fR = svf(); this.kt = Math.pow(f0/261.6, P.keytrack); this.iv = .5 + .5*vel; }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.r*this.P.stretch*1.4 + .02)*this.sr); this.fo = Math.min(this.end, Math.round(.015*this.sr)); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, V = this.V, R = this.R, vel = this.vel, st = P.stretch, cut = P.cut*Math.pow(2, (P.tone - .5)*3), d = P.d*st, r = P.r*st, fd = P.fd*st,
      k = 2 - 1.9*Math.min(.98, P.res), dk = 1 + P.drive*6, dn = Math.tanh(dk), sub = P.sub, noise = P.noise, drift = P.drift, bp = P.mode === 'bp';
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr;
      if (i % 16 === 0) { const fe = t < P.fa ? t/P.fa : Math.exp(-(t - P.fa)/fd), fc = Math.min(sr*.45, cut*this.kt*Math.pow(2, P.fenv*fe*this.iv)), g = Math.tan(Math.PI*fc/sr); this.fL.set(g, k); this.fR.set(g, k); }
      let L = 0, Rr = 0;
      for (const v of V) { const f = v.f*(1 + drift/1200*Math.sin(v.dph + 2*Math.PI*v.drate*t)), dt = f/sr; v.ph += dt; v.ph -= Math.floor(v.ph);
        let x; if (v.w === 'tri') { v.tri = .999*v.tri + 4*dt*square(v.ph, dt); x = v.tri; } else x = WAVES[v.w](v.ph, dt);
        x *= v.lvl; L += x*(1 - v.pan)*.5; Rr += x*(1 + v.pan)*.5; }
      if (sub) { this.subPh += this.f0*.5/sr; this.subPh -= Math.floor(this.subPh); const s0 = Math.sin(2*Math.PI*this.subPh)*sub*.5; L += s0; Rr += s0; }
      if (noise) { const nz = (R()*2 - 1)*noise*.3; L += nz; Rr += nz; }
      let yl = this.fL.run(L), yr = this.fR.run(Rr); if (bp) { yl = this.fL.bp; yr = this.fR.bp; }
      let e = adsr(t, P.a, d, P.s, this.rel, r)*vel; if (P.drive) { yl = Math.tanh(dk*yl)/dn; yr = Math.tanh(dk*yr)/dn; }
      if (this.fo) e *= fadeAt(i, this.end, this.fo);
      oL[j] += yl*e; oR[j] += yr*e; this.i++; } }
}
export const va = (sr, f0, o = {}) => render(VaV, sr, f0, {...VA_D, ...o}, true);
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
export const AKICK_D = {vel: .9, start: 4, t1: .005, t2: .04, decay: .38, boom: 0, boomDecay: 1.2, click: .25, tone: .5, drive: .3, seed: 1};
export class AkickV {
  constructor(sr, f0, P, vel = P.vel){ const T = Math.max(P.decay*4, P.boom ? P.boomDecay*3 : 0) + .05; Object.assign(this, {sr, f0, P: {...P}, vel, i: 0, end: Math.ceil(T*sr), done: false, R: rng(P.seed), ph: 0, lp: 0, hp: 0});
    this.fo = Math.min(this.end, Math.round(.02*sr)); }
  off(){}
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, f0 = this.f0, dk = 1 + P.drive*5, dn = Math.tanh(dk);
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr, f = f0*(1 + (P.start - 1)*(.45*Math.exp(-t/P.t1) + .55*Math.exp(-t/P.t2)));
      this.ph += 2*Math.PI*f/sr; const e = (t < .0006 ? t/.0006 : 1)*((1 - P.boom)*Math.exp(-t/P.decay) + P.boom*Math.exp(-t/P.boomDecay));
      let x = Math.sin(this.ph)*e;
      if (P.click && t < .012) { const nz = this.R()*2 - 1; this.lp += (.15 + .7*P.tone)*(nz - this.lp); const h = this.lp - this.hp; this.hp += .05*(this.lp - this.hp); x += h*P.click*Math.exp(-t/.0018)*1.5; }
      x = Math.tanh(dk*x)/dn*this.vel*fadeAt(i, this.end, this.fo); oL[j] += x; oR[j] += x; this.i++; } }
}
export const akick = (sr, f0, o = {}) => render(AkickV, sr, f0, {...AKICK_D, ...o});
export const KICKS = {
  kround: {start: 3.6, t2: .035, decay: .32, click: .2, tone: .35, drive: .25},
  kdub: {start: 3, t2: .05, decay: .3, boom: .45, boomDecay: .9, click: .1, tone: .25, drive: .15},
  ktight: {start: 5, t1: .003, t2: .022, decay: .18, click: .4, tone: .7, drive: .45},
  kdeep: {start: 3.2, t2: .06, decay: .5, boom: .25, boomDecay: 1.4, click: .12, tone: .3, drive: .2},
};

// a rumble: the low end after a kick ringing on, as a techno rumble's dark reverb does: low noise through a resonant
// low-pass at the note and a sine under it, swelling a moment after the hit and dying over the note, driven a little
export const RUMBLE_D = {vel: .8, len: .4, decay: .5, res: .8, grit: .35, drive: .5, seed: 1};
export class RumbleV {
  constructor(sr, f0, P, vel = P.vel){ Object.assign(this, {sr, f0, P, vel, i: 0, rel: Infinity, end: Infinity, done: false, g: Math.tan(Math.PI*Math.min(sr*.45, f0*2.2)/sr)});
    this.ch = [P.seed, P.seed + 9].map(sd => ({R: rng(sd), f: svf(), ph: 0})); }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.decay*2 + .05)*this.sr); this.fo = Math.min(this.end, Math.round(.03*this.sr)); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, dk = 1 + P.drive*5, dn = Math.tanh(dk), len = this.rel, dc = P.decay*1.6, w = 2*Math.PI*this.f0/sr;
    for (const c of this.ch) c.f.set(this.g, 2 - 1.9*P.res);
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr;
      // (held, it dies away by itself: past -120 dB it's finished)
      if (len === Infinity && t > dc*14) { this.done = true; return; }
      const sw = (1 - Math.exp(-t/.012))*(t < len ? Math.exp(-t/dc) : Math.exp(-len/dc)*Math.exp(-(t - len)/(P.decay*.6))), fe = this.fo ? fadeAt(i, this.end, this.fo) : 1;
      for (let k = 0; k < 2; k++) { const c = this.ch[k]; c.ph += w; const x = c.f.run((c.R()*2 - 1)*P.grit) + Math.sin(c.ph)*.6, y = Math.tanh(dk*x*sw)/dn*this.vel*fe; if (k) oR[j] += y; else oL[j] += y; }
      this.i++; } }
}
export const rumble = (sr, f0, o = {}) => render(RumbleV, sr, f0, {...RUMBLE_D, ...o}, true);

// a formant pad: saws (and a breath of noise) through a mouth's three resonances, drifting from vowel to vowel over the
// note: dark vowels by default (o, u, a), so it's airy and human without being sweet. Its vowels move over the note's
// length when it's known (as the song plays it), over three seconds when it isn't (a key held)
const VOWELS = {a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2700], e: [400, 1600, 2700], i: [300, 1900, 2800]};
export const FORMANT_D = {vel: .7, len: 3, a: .8, r: 1.6, path: 'oua', drift: .5, q: 9, breathy: .15, voices: 3, detune: .12, seed: 1};
export class FormantV {
  constructor(sr, f0, P, vel = P.vel, len){ const R = rng(P.seed), n = P.voices;
    Object.assign(this, {sr, P, vel, R, i: 0, rel: Infinity, end: Infinity, done: false, span: Math.max(1, len ?? 3), path: [...P.path].map(v => VOWELS[v])});
    this.V = Array.from({length: n}, (_, v) => ({f: f0*Math.pow(2, (n > 1 ? v/(n - 1)*2 - 1 : 0)*P.detune/12), ph: R(), pan: n > 1 ? (v/(n - 1)*2 - 1)*.7 : 0}));
    this.bands = [0, 1, 2].map(() => ({L: svf(), R: svf()})); }
  off(t = this.i/this.sr){ if (this.rel !== Infinity) return; this.rel = t; this.end = Math.ceil((t + this.P.r*1.3)*this.sr); this.fo = Math.min(this.end, Math.round(.03*this.sr)); }
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, Pth = this.path, V = this.V, q = P.q, gains = [1, .55, .3], nv = Math.sqrt(V.length), len = this.rel;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; } const t = i/sr;
      if (i % 32 === 0) { const x = (t*P.drift/this.span)*(Pth.length - 1) % Math.max(1, Pth.length - 1), k0 = Math.floor(x), w = x - k0, A = Pth[k0], B = Pth[Math.min(Pth.length - 1, k0 + 1)];
        this.bands.forEach((bd, k) => { const fc = A[k] + (B[k] - A[k])*(.5 - .5*Math.cos(Math.PI*w)), g = Math.tan(Math.PI*Math.min(sr*.45, fc)/sr), kk = 1/q; bd.L.set(g, kk); bd.R.set(g, kk); }); }
      let L = 0, Rr = 0; for (const v of V) { const dt = v.f/sr; v.ph += dt; v.ph -= Math.floor(v.ph); const x = saw(v.ph, dt)/nv; L += x*(1 - v.pan)*.5; Rr += x*(1 + v.pan)*.5; }
      const nz = (this.R()*2 - 1)*P.breathy; L += nz; Rr += nz;
      let yl = 0, yr = 0; for (let k = 0; k < 3; k++) { const bd = this.bands[k]; bd.L.run(L); bd.R.run(Rr); yl += bd.L.bp*gains[k]/q; yr += bd.R.bp*gains[k]/q; }   // (a band-pass rings q times over at its peak)
      const env = t < P.a ? .5 - .5*Math.cos(Math.PI*t/P.a) : t < len ? 1 : Math.exp(-6.9*(t - len)/P.r), e = env*this.vel*.9*(this.fo ? fadeAt(i, this.end, this.fo) : 1);
      oL[j] += yl*e; oR[j] += yr*e; this.i++; } }
}
export const formant = (sr, f0, o = {}) => render(FormantV, sr, f0, {...FORMANT_D, ...o}, true);

// the 808's hats: six square oscillators at clashing frequencies, through a band-pass and a high-pass, dying over decay;
// tone tunes the metal; a breath of noise for the sizzle
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
export const HAT808_D = {vel: .8, decay: .05, tone: .5, sizzle: .25, seed: 1};
export class Hat808V {
  constructor(sr, f0, P, vel = P.vel){ const R = rng(P.seed), fc = 7400 + 3000*P.tone;
    Object.assign(this, {sr, P: {...P}, vel, R, i: 0, end: Math.ceil((P.decay*5 + .02)*sr), done: false, k: .75 + .7*P.tone, ph: METAL.map(() => R()), bpL: svf(), bpR: svf(), pl: 0, pr: 0});
    this.fo = Math.min(this.end, Math.round(.005*sr)); this.bpL.set(Math.tan(Math.PI*Math.min(sr*.45, fc)/sr), .9); this.bpR.set(Math.tan(Math.PI*Math.min(sr*.45, fc*1.04)/sr), .9); }
  off(){}
  run(oL, oR, a, b){ const P = this.P, sr = this.sr, ph = this.ph, k = this.k;
    for (let j = a; j < b; j++) { const i = this.i; if (i >= this.end) { this.done = true; return; }
      let m = 0; for (let q = 0; q < 6; q++) { ph[q] += METAL[q]*k/sr; ph[q] -= Math.floor(ph[q]); m += ph[q] < .5 ? 1 : -1; } m /= 6;
      const nz = (this.R()*2 - 1)*P.sizzle, e = Math.exp(-i/(P.decay*sr))*(i < 24 ? i/24 : 1)*this.vel*fadeAt(i, this.end, this.fo);
      this.bpL.run(m + nz); this.bpR.run(m - nz*.5); const xl = this.bpL.bp, xr = this.bpR.bp;
      // a high-pass by differencing, twice gentler on the right for a little width
      const hl = xl - this.pl; this.pl = xl; const hr = xr - this.pr; this.pr = xr; oL[j] += (xl*.4 + hl*.9)*e; oR[j] += (xr*.4 + hr*.8)*e; this.i++; } }
}
export const hat808 = (sr, o = {}) => render(Hat808V, sr, 0, {...HAT808_D, ...o});
