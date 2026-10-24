// The analog drum machine: thirteen voices built the way analog drum circuits behave, not copied from the browser's kit.
// Pitches sag with how hard a drum rings (louder is sharper, settling as it dies, as an 808's bridged-T and a real skin
// do); envelopes fall on capacitor curves; a kick's tail can boom on past its punch; snare wires buzz with the shell
// that drives them (and faintly with the kick); claps are bursts whose timing breathes from hit to hit; hats are the 808's
// six clashing squares through resonant bands, closed by the open one's pedal; every hit differs a little, as a circuit's
// parts drift (Variation); velocity changes the tone, not only the level. Saturation is computed without the harsh
// aliasing a plain curve makes (its antiderivative, ADAA), each voice's own and the machine's bus: tape-like drive, low-end
// weight, a glue compressor, width. new AnalogKit(sr) → load(kit, over), set(voice, key, v), on(voice, vel, lock),
// render(L, R, a, b) adding into L and R, stop(); the same as the native copy of the browser's kit (kit.js).
import { VOICES, PARAMS } from '../../../src/audio/engine/inst/drums.js';
import { rng } from '../rng.js';

// every voice's settings: the browser kit's seven (tune, decay, tone, drive, level, pan, character) and three of its own
export const APARAMS = [...PARAMS, {key: 'snap', label: 'Snap', min: 0, max: 1, def: .5, unit: '%'}, {key: 'body', label: 'Body', min: 0, max: 1, def: .5, unit: '%'},
  {key: 'vary', label: 'Variation', min: 0, max: 1, def: .3, unit: '%'}];
const D = Object.fromEntries(APARAMS.map(p => [p.key, p.def]));
// the kits: each voice's settings over the defaults, the bus (drive: tape saturation, tone, glue: the compressor, weight:
// dB of low end, width, buzz: the snare wires answering the kick), and the browser kit standing in where nothing native plays
export const ANALOG_KITS = {
  'Analog 808': {fallback: '808', words: 'The 808 as its circuits behave: a long booming kick, a snare of two ringing shells and buzzing wires, six-square metal hats, a cowbell, toms that sag in pitch.',
    bus: {drive: .18, tone: 1, glue: .3, weight: 2, width: 1, buzz: .35},
    v: {kick: {tune: -2, decay: 1.4, x: .1, snap: .25, body: .75, drive: .12, tone: .5}, snare: {tune: 1, x: .35, body: .6}, clap: {x: .45, body: .5}, chh: {x: .9, level: 1.5}, ohh: {x: .9, decay: 1.3, level: 1.5}, ride: {x: .8},
      tomL: {decay: 1.3, x: .6}, tomH: {decay: 1.25, x: .6, pan: .25}, cow: {pan: .2}, rim: {pan: .15}, clave: {pan: -.2}, shaker: {pan: -.25, level: .7}}},
  'Analog 909': {fallback: '909', words: 'The 909 as its circuits behave: a punchy kick with a click on top, a bright snappy snare, a wide clap, crisp hats, a ride and crash.',
    bus: {drive: .25, tone: 1, glue: .45, weight: 1.5, width: 1.1, buzz: .2},
    v: {kick: {decay: 1, x: .75, snap: .6, body: .4, drive: .3}, snare: {x: .62, tone: .95, snap: .6}, clap: {x: .55}, chh: {x: .35}, ohh: {x: .35}, ride: {x: .5}, crash: {x: .4},
      tomL: {pan: -.3}, tomH: {pan: .3}, rim: {pan: .15}, clave: {pan: -.2}, cow: {pan: .2}, shaker: {pan: -.25, level: .7}}},
  'Analog Deep': {fallback: 'Minimal', words: 'Deep and round for minimal techno: a long sub kick with little click, a dark snare, soft hats, the low end weighted.',
    bus: {drive: .2, tone: .9, glue: .35, weight: 3, width: 1, buzz: .25},
    v: {kick: {tune: -4, decay: 1.4, x: .3, snap: .15, body: .9, tone: .4, level: 2.2}, snare: {tone: .6, x: .45, decay: .8, level: 1.2}, clap: {tone: .7, decay: .9}, chh: {tone: .8, level: 1, x: .6, decay: .8}, ohh: {tone: .8, level: .95, x: .6},
      ride: {tone: .75, level: 1.2}, crash: {tone: .7, level: 1.1}, tomL: {tune: -3, decay: 1.3}, tomH: {tune: -2, decay: 1.2, pan: .3}, cow: {tune: -5, level: 1.2}, rim: {tone: .7, pan: .2}, clave: {tune: -2, pan: -.25}, shaker: {tone: .8, level: .6, pan: -.3}}},
  'Analog Warm': {fallback: 'Minimal', words: 'Through warm tape: rounded, a little compressed, the highs softened, every hit drifting a little more.',
    bus: {drive: .5, tone: .82, glue: .5, weight: 2, width: .9, buzz: .3},
    v: {kick: {x: .5, decay: 1.3, body: .6, snap: .35, vary: .5, level: 1.9}, snare: {x: .5, vary: .5}, clap: {vary: .6}, chh: {x: .7, vary: .5, level: 1.2}, ohh: {x: .7, vary: .5, level: 1.2}, ride: {vary: .5}, tomL: {decay: 1.3, vary: .5}, tomH: {decay: 1.2, vary: .5, pan: .25},
      cow: {pan: .2}, rim: {pan: .15}, clave: {pan: -.2}, shaker: {pan: -.25, level: .7}}},
  'Analog Grit': {fallback: 'Industrial', words: 'Driven hard: a distorted kick and snare, gritty metal, the bus pushed into saturation.',
    bus: {drive: .75, tone: .9, glue: .6, weight: 1.5, width: 1.2, buzz: .5},
    v: {kick: {tune: -1, x: .85, drive: .6, snap: .7, decay: 1.2}, snare: {drive: .5, x: .7}, clap: {drive: .4, x: .8}, rim: {drive: .5}, chh: {x: 1, drive: .3, level: .8}, ohh: {x: 1, drive: .3, level: .8},
      crash: {drive: .3, level: .7}, tomL: {drive: .4, tune: -2}, tomH: {drive: .4}, cow: {drive: .5, tune: -4}, shaker: {level: .7}}},
};
export const ANALOG_NAMES = Object.keys(ANALOG_KITS);
export const analogParams = name => { const K = ANALOG_KITS[name] || ANALOG_KITS['Analog 808']; return Object.fromEntries(VOICES.map(v => [v.key, {...D, ...(K.v[v.key] || {})}])); };
// the browser kit that stands in for an analog one where the live engine can't play
export const kitFallback = name => ANALOG_KITS[name]?.fallback || name;

const T = 6.91, st = n => Math.pow(2, n/12), toneHz = t => 1000*Math.pow(22, t), TAU = 2*Math.PI, METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
// a soft clip (the cubic curve: rounding over to 2/3 at full drive) without its aliasing: first-order antiderivative
// anti-aliasing, the step between samples averaged over the curve, so a hard drive stays smooth (and costs a few
// multiplies, no sine or logarithm)
const clip = u => u > 1 ? 2/3 : u < -1 ? -2/3 : u - u*u*u/3, clipF = u => { const a = Math.abs(u); return a > 1 ? 2/3*a - .25 : u*u/2 - u*u*u*u/12; };
function adaa(){ let x1 = 0, F1 = 0; return x => { const F = clipF(x), d = x - x1, y = Math.abs(d) < 1e-4 ? clip((x + x1)/2) : (F - F1)/d; x1 = x; F1 = F; return y; }; }
// the same for tanh (the tape's gentler curve): its antiderivative is log cosh
const lcosh = x => { const a = Math.abs(x); return a > 15 ? a - Math.LN2 : Math.log(Math.cosh(x)); };
function adaaT(){ let x1 = 0, F1 = 0; return x => { const F = lcosh(x), d = x - x1, y = Math.abs(d) < 1e-4 ? Math.tanh((x + x1)/2) : (F - F1)/d; x1 = x; F1 = F; return y; }; }
// a state-variable filter (the trapezoidal form), its low, band and high outputs
function svf(f, q, sr){ const g = Math.tan(Math.PI*Math.min(f, sr*.45)/sr), k = 1/q, a1 = 1/(1 + g*(g + k)), a2 = g*a1, a3 = g*a2; let s1 = 0, s2 = 0;
  const o = {lp: 0, bp: 0, hp: 0}; return x => { const v3 = x - s2, v1 = a1*s1 + a2*v3, v2 = s2 + a2*s1 + a3*v3; s1 = 2*v1 - s1; s2 = 2*v2 - s2; o.lp = v2; o.bp = v1; o.hp = x - k*v1 - v2; return o; }; }
// the bus's last stage: above -1 dB it rounds over, so nothing leaves the machine past full scale
const ceil = y => { const a = Math.abs(y); return a < .89 ? y : Math.sign(y)*(.89 + .11*Math.tanh((a - .89)/.11)); };
const blep = (t, dt) => t < dt ? (t /= dt, t + t - t*t - 1) : t > 1 - dt ? (t = (t - 1)/dt, t*t + t + t + 1) : 0;
const square = (t, dt) => (t < .5 ? 1 : -1) + blep(t, dt) - blep((t + .5) % 1, dt);

/* ---------- the voices: each a hit, f(t) → [l, r] a sample at a time, and how long it lasts ---------- */
// p: the voice's settings for this hit, v: how hard (0..1), R: the kit's random numbers, sr
const VOICE = {
  // the kick: a sine falling into its note (a fast sweep for the punch, a slower one under it), its pitch sagging with its
  // own loudness (an 808's boom), a tail that rings on past the punch (Body), a click on top (Snap); Character from the
  // 808's long boom (0) to the 909's punch (1)
  kick(p, v, R, sr, w){ const x = p.x, f0 = 50*st(p.tune)*w.f, dec = (.75 - .4*x)*p.decay*w.d, hold = .012*x, b = p.body*.35,
      P1 = (1 + 6*x)*(.55 + .45*v), t1 = .0035 + .004*(1 - x), P2 = .2 + .5*x, t2 = .028 + .025*(1 - x), sag = .1*(1 - x)*v, end = hold + dec*(b ? 1.8 : 1)*1.1 + .02,
      ck = svf(1800 + 3600*p.tone*(.6 + .4*v), .9, sr), cn = p.snap*v*(.35 + .35*x); let ph = 0;
    return {end, f: t => { const a = t < .0008 ? t/.0008 : t < hold ? 1 : (1 - b)*Math.exp(-T*(t - hold)/dec) + b*Math.exp(-T*(t - hold)/(dec*1.8));
      ph += TAU*f0*(1 + P1*Math.exp(-t/t1) + P2*Math.exp(-t/t2))*(1 + sag*a*a)/sr; let y = Math.sin(ph)*a*v;
      // the click: the beater's crack, a short burst through a band (brighter the harder), and a blip of the oscillator's top
      if (t < .012) { const e = Math.exp(-t/.0016); y += (ck(R()*2 - 1).bp*1.6 + Math.sin(TAU*1650*t)*.5)*e*cn; }
      return y; }}; },
  // the snare: two shells ringing (their pitch dropping into place and sagging with their ring), the wires' noise driven by
  // the shells (louder and brighter the harder it's hit), a crack at the strike; Character: how snappy, the wires over the shells
  snare(p, v, R, sr, w){ const m = st(p.tune)*w.f, f1 = 185*m, f2 = f1*1.72, db = .2*p.decay*w.d*(1 + .5*p.body), dw = .32*p.decay*w.d, x = p.x,
      hp = svf(1500, .7, sr), bp = svf((3800 + 3400*p.tone)*(.8 + .3*v), .8, sr), hpR = svf(1500, .7, sr), bpR = svf((3800 + 3400*p.tone)*(.8 + .3*v), .8, sr), gb = 1 - .45*x, gw = (.45 + .9*x)*(.7 + .45*v);
    let p1 = 0, p2 = 0;
    return {end: Math.max(db, dw)*1.1 + .02, f: t => { const eb = Math.exp(-T*t/db), sw = 1 + .25*Math.exp(-t/.012) + .1*v*eb*eb;
      p1 += TAU*f1*sw/sr; p2 += TAU*f2*sw/sr; const body = (Math.sin(p1)*.7 + Math.sin(p2)*.45)*eb*gb*v;
      const ew = (.55*Math.exp(-T*t/(db*.8)) + .45*Math.exp(-T*t/dw))*gw*v*(t < .0006 ? t/.0006 : 1), n1 = R()*2 - 1, n2 = R()*2 - 1, crack = t < .004 ? Math.exp(-t/.0008)*p.snap*v*.8 : 0;
      const l = body + bp(hp(n1).hp).bp*ew*1.9 + n1*crack, r = body + bpR(hpR(.75*n1 + .25*n2).hp).bp*ew*1.9 + n1*crack; return [l, r]; }}; },
  // hands clapping: bursts a few milliseconds apart whose spacing breathes from hit to hit, through one band (as the 808's
  // one noise and one filter), then the room's tail (Body: more room); Character: how wide the hands are spread
  clap(p, v, R, sr, w){ const f = 1150*st(p.tune)*w.f, n = 4, gaps = [0]; for (let i = 1; i < n; i++) gaps.push(gaps[i - 1] + (.0085 + .003*R())*(1 + .6*w.j));
      const last = gaps[n - 1], dt = .3*p.decay*w.d*(1 + .5*p.body), bL = svf(f*(.9 + .2*p.tone), 1.3, sr), bR = svf(f*(.9 + .2*p.tone)*1.03, 1.3, sr), spread = p.x*.6;
    return {end: last + dt*1.1 + .03, f: t => { let eb = 0, side = 0;
      for (let i = 0; i < n; i++) { const u = t - gaps[i]; if (u >= 0 && u < .03) { const e = (u < .0006 ? u/.0006 : 1)*Math.exp(-u/.0055); eb += e; side += (i % 2 ? 1 : -1)*e; } }
      const u = t - last, et = u > 0 ? Math.exp(-T*u/dt)*(u < .002 ? u/.002 : 1)*.55 : 0, n1 = R()*2 - 1, n2 = R()*2 - 1;
      const xl = n1*(eb + et) - n2*side*spread*.5, xr = (.6*n1 + .4*n2)*(eb + et) + n2*side*spread*.5; return [bL(xl).bp*v*2.6, bR(xr).bp*v*2.6]; }}; },
  // the rim: a short ring and a crack, a little driven (as the 808's pinged circuit clips)
  rim(p, v, R, sr, w){ const m = st(p.tune)*w.f, d = (.05 + .07*p.x)*p.decay*w.d, b = svf(2600*m, 3, sr), k = 1.5 + 2*v;
    return {end: d*1.5 + .02, f: t => { const y = Math.sin(TAU*1720*m*t)*Math.exp(-T*t/d)*.7 + Math.sin(TAU*480*m*t)*Math.exp(-T*t/(d*1.4))*.35 + b(R()*2 - 1).bp*Math.exp(-t/.003)*.6*p.snap*2;
      return Math.tanh(k*y*v)/Math.tanh(k); }}; },
  // the clave: a wood block's pure high ring, as long as its Character says
  clave(p, v, R, sr, w){ const f = 2450*st(p.tune)*w.f, d = (.1 + .2*p.x)*p.decay*w.d;
    return {end: d*1.1 + .02, f: t => (Math.sin(TAU*f*t) + .15*Math.sin(TAU*f*2.76*t)*Math.exp(-T*t/(d*.4)))*Math.exp(-T*t/d)*(t < .0004 ? t/.0004 : 1)*.75*v}; },
  chh(p, v, R, sr, w){ return hat(p, v, R, sr, w, .08, false); },
  ohh(p, v, R, sr, w){ return hat(p, v, R, sr, w, .65, true); },
  // the ride: the metal pitched higher and longer, and its bell: three clear partials (Character: how much bell)
  ride(p, v, R, sr, w){ const m = st(p.tune)*w.f, d = 2.4*p.decay*w.d, mt = metal(m*1.48, sr), mt2 = metal(m*1.48*1.007, sr), hL = svf(2600, .7, sr), hR = svf(2600, .7, sr), bL = svf(5200*(.7 + .5*p.tone), .6, sr), bR = svf(5400*(.7 + .5*p.tone), .6, sr);
    const bell = [[2860, .22], [4150, .12], [5910, .06]].map(([f, a]) => [TAU*f*m, a*p.x]);
    return {end: d*1.1, f: t => { const e = Math.exp(-T*t/d)*(t < .001 ? t/.001 : 1)*v, eb = Math.exp(-T*t/(d*.45))*v; let bl = 0; for (const [wf, a] of bell) bl += Math.sin(wf*t)*a;
      const ml = mt(), mr = mt2(); return [(bL(hL(ml).hp).bp*1.6)*e*.55 + bl*eb, (bR(hR(mr).hp).bp*1.6)*e*.55 + bl*eb*.95]; }}; },
  // the crash: noise and metal, high-passed, a slight swell in, then a long wash, a little different on each side
  crash(p, v, R, sr, w){ const m = st(p.tune)*w.f, d = 2.8*p.decay*w.d, mt = metal(m*1.9, sr), hL = svf(4200*(.8 + .3*p.tone), .7, sr), hR = svf(4400*(.8 + .3*p.tone), .7, sr), mx = .4 + p.x*.9;
    return {end: d*1.1, f: t => { const e = (1 - Math.exp(-t/.004))*Math.exp(-T*t/d)*v*.6, mm = mt()*mx, n1 = R()*2 - 1, n2 = R()*2 - 1; return [hL(n1*.8 + mm).hp*e, hR(n2*.8 + mm).hp*e]; }}; },
  // toms: a skin whose pitch starts high and sags with its ring (harder: further), a second mode a fifth up, a felt thump
  // (Character: more ring, less thump; Body: longer)
  tomL(p, v, R, sr, w){ return tom(p, v, R, sr, w, 92); },
  tomH(p, v, R, sr, w){ return tom(p, v, R, sr, w, 148); },
  // the cowbell: two squares a clashing interval apart through a band, a sharp hit then a ring (Character: how long it rings)
  cow(p, v, R, sr, w){ const m = st(p.tune)*w.f, d = .45*p.decay*w.d*(.6 + .8*p.x), b = svf(2400*m, 2, sr); let a = 0, c = 0;
    return {end: d*1.1 + .05, f: t => { a += 587*m/sr; a -= Math.floor(a); c += 845*m/sr; c -= Math.floor(c); const e = (t < .001 ? t/.001 : 1)*(.65*Math.exp(-t/.012) + .35*Math.exp(-T*t/d));
      return b(square(a, 587*m/sr) + square(c, 845*m/sr)).bp*e*v*.75; }}; },
  // the shaker: beads (noise in grains) high up, swelling in (Character) and out
  shaker(p, v, R, sr, w){ const a = .006 + p.x*.03, d = .16*p.decay*w.d, hL = svf(6200*(.8 + .3*p.tone), .7, sr), hR = svf(6400*(.8 + .3*p.tone), .7, sr); let g = 0;
    return {end: a + d*1.1 + .02, f: t => { const e = t < a ? t/a : Math.exp(-T*(t - a)/d); if (R() < .3) g = R(); const n1 = (R()*2 - 1)*(.4 + g), n2 = (R()*2 - 1)*(.4 + g); return [hL(n1).hp*e*v*.55, hR(n2).hp*e*v*.55]; }}; },
};
// the 808's metal: six squares at clashing pitches, summed (band-limited)
function metal(mul, sr){ const ph = METAL.map((_, i) => i*.137 % 1), dt = METAL.map(f => f*mul/sr); return () => { let y = 0; for (let i = 0; i < 6; i++) { y += square(ph[i], dt[i]); ph[i] += dt[i]; ph[i] -= Math.floor(ph[i]); } return y/6; }; }
// hats: the metal (or noise, the less metallic) through two resonant bands and a high-pass, brighter and longer the harder
// they're hit; the open one falls fast then rings on (its two stages, as the 808's)
function hat(p, v, R, sr, w, base, open){ const m = st(p.tune)*w.f, d = base*p.decay*w.d*(.8 + .4*v), up = .85 + .3*v + .2*(p.tone - .5), mt = metal(m*1.6, sr), mx = .25 + p.x*.9, nx = (1 - p.x)*.7 + .08;
  const b1 = svf(7400*up, 1.6, sr), b2 = svf(10200*up, 1.2, sr), h = svf(6800*up, .7, sr), b1R = svf(7550*up, 1.6, sr), b2R = svf(10400*up, 1.2, sr), hR = svf(6900*up, .7, sr);
  return {end: d*1.1 + .02, open, f: t => { const e = (t < .0004 ? t/.0004 : 1)*(open ? .55*Math.exp(-T*t/(d*.22)) + .45*Math.exp(-T*t/d) : Math.exp(-T*t/d))*v, mm = mt()*mx, n1 = R()*2 - 1, n2 = R()*2 - 1;
    const xl = mm + n1*nx, xr = mm + n2*nx, l = h(b1(xl).bp*.8 + b2(xl).bp).hp, r = hR(b1R(xr).bp*.8 + b2R(xr).bp).hp; return [l*e*1.5, r*e*1.5]; }}; }
function tom(p, v, R, sr, w, base){ const f = base*st(p.tune)*w.f, d = .55*p.decay*w.d*(1 + .4*p.body), sag = (.35 + .4*p.snap)*v, th = svf(420*st(p.tune), 1, sr), ring = .6 + .4*p.x; let a = 0, b = 0;
  return {end: d*1.1 + .03, f: t => { const e = (t < .001 ? t/.001 : 1)*Math.exp(-T*t/d), ff = f*(1 + sag*e*e + .3*Math.exp(-t/.01)); a += TAU*ff/sr; b += TAU*ff*1.52/sr;
    const y = (Math.sin(a) + .14*Math.sin(b)*Math.exp(-T*t/(d*.4)))*e*ring + th(R()*2 - 1).bp*Math.exp(-t/.02)*(.9 - .7*p.x)*.8; return y*v*.85; }}; }

// each voice's level into the machine, measured so that, through the bus, each sits where a drum machine's does (the
// kick near full scale, the hats well under it)
export const CAL = {kick: .287, snare: .437, clap: .258, rim: .452, clave: .553, chh: .631, ohh: .536, ride: .991, crash: .987, tomL: .778, tomH: .69, cow: .236, shaker: 1.007};

/* ---------- the machine: hits into each voice's channel (tone, drive, level, pan), the channels into the bus ---------- */
export class AnalogKit {
  constructor(sr, seed = 11){ this.sr = sr; this.R = rng(seed); this.P = {}; this.hits = []; this.B = {}; this.ch = Object.fromEntries(VOICES.map(v => [v.key, {key: v.key}])); this.load('Analog 808'); }
  apply(key){ const p = this.P[key], c = this.ch[key], sr = this.sr; c.lp = [svf(toneHz(p.tone), .6, sr), svf(toneHz(p.tone), .6, sr)]; c.open = p.tone >= .995;
    c.K = 1 + p.drive*4; c.sat = p.drive > .01 ? [adaa(), adaa()] : null; c.kn = clip(c.K); c.lv = p.level*(1 - p.drive*.3);
    const x = (p.pan + 1)/2*Math.PI/2; c.gl = Math.cos(x)*Math.SQRT2; c.gr = Math.sin(x)*Math.SQRT2; }
  busSet(b){ const sr = this.sr, B = this.B = {...b};
    // the low end's weight: a low shelf (RBJ) at 70 Hz, `weight` dB
    const A = Math.pow(10, (b.weight || 0)/40), w0 = TAU*70/sr, c = Math.cos(w0), s = Math.sin(w0), al = s/2*Math.SQRT2, sq = 2*Math.sqrt(A)*al;
    const a0 = (A + 1) + (A - 1)*c + sq; B.sh = [A*((A + 1) - (A - 1)*c + sq)/a0, 2*A*((A - 1) - (A + 1)*c)/a0, A*((A + 1) - (A - 1)*c - sq)/a0, -2*((A - 1) + (A + 1)*c)/a0, ((A + 1) + (A - 1)*c - sq)/a0];
    B.z = [[0, 0, 0, 0], [0, 0, 0, 0]]; B.lp = [svf(toneHz(b.tone ?? 1), .6, sr), svf(toneHz(b.tone ?? 1), .6, sr)]; B.open = (b.tone ?? 1) >= .995;
    // tape: driven with a little bias (an asymmetry: its even harmonics' warmth); quiet signals pass at their own level,
    // peaks round over (the harder it's driven, the more), and the glue's makeup brings the level back
    const dr = b.drive || 0; B.on = dr > .01; B.k = dr*3; B.bias = .08*dr; B.tb = Math.tanh(B.bias); B.norm = 1/((B.k || 1)*(1 - B.tb*B.tb)); B.sat = [adaaT(), adaaT()];
    // glue: a gentle compressor on both sides together, its makeup restoring what it took on average
    B.thr = Math.pow(10, -(8 + 10*(b.glue || 0))/20); B.ratio = 1 + 3*(b.glue || 0); B.env = 0; B.att = Math.exp(-1/(.004*sr)); B.rel = Math.exp(-1/(.12*sr)); B.mk = (1 + .25*(b.glue || 0))*(1 + .8*dr); B.g = B.mk; B.width = b.width ?? 1; }
  load(name, over = {}){ const K = ANALOG_KITS[name] || ANALOG_KITS['Analog 808'], kp = analogParams(name); this.name = name;
    for (const v of VOICES) { this.P[v.key] = {...kp[v.key], ...(over[v.key] || {})}; this.apply(v.key); } this.busSet(K.bus); }
  set(key, k, v){ if (!this.P[key]) return; this.P[key][k] = v; this.apply(key); }
  // a hit now: the voice at its settings (or a step's own: lock), its parts drifting a little each time (Variation)
  on(key, vel = 1, lock = null){ const mk = VOICE[key]; if (!mk) return; const p = lock ? {...this.P[key], ...lock} : this.P[key], R = this.R, vy = p.vary, v = Math.max(.05, Math.min(1.2, vel))*(1 + vy*.08*(R() - .5));
    const w = {f: 1 + vy*.012*(R() - .5), d: 1 + vy*.12*(R() - .5), j: vy*(R() - .5)*2};
    // a closed hat (or the next open one) closes the open one as its pedal would
    if (key === 'chh' || key === 'ohh') for (const h of this.hits) if (h.key === 'ohh' && !h.choke) h.choke = 1;
    const h = mk(p, v, R, this.sr, w), f = h.f, c = CAL[key]; h.f = t => { const y = f(t); return typeof y === 'number' ? y*c : [y[0]*c, y[1]*c]; };
    this.hits.push({key, i: 0, ...h});
    // the snare's wires answer the kick a little (Buzz), as they do in a kit
    if (key === 'kick' && this.B.buzz > 0) { const sp = this.P.snare, a = this.B.buzz*.045*v, hp = svf(3000, .7, this.sr), d = .04;
      this.hits.push({key: 'snare', i: 0, end: .3, f: t => { const x = hp(R()*2 - 1).hp*a*Math.exp(-t/d)*(1 - Math.exp(-t/.006)); return x*(sp.level ?? 1); }}); } }
  stop(){ for (const h of this.hits) h.choke ||= 1; }
  render(L, R, a, b){ const n = b - a, sr = this.sr;
    if (!this.hits.length && !this.tail) return;
    const used = new Set(), cd = Math.exp(-1/(.01*sr));
    for (const h of this.hits) { const c = this.ch[h.key]; if (!c.in || c.in[0].length < n) c.in = [new Float32Array(Math.max(n, 128)), new Float32Array(Math.max(n, 128))];
      if (!used.has(c)) { c.in[0].fill(0, 0, n); c.in[1].fill(0, 0, n); used.add(c); }
      for (let j = 0; j < n; j++) { const t = (h.i + j)/sr; if (t >= h.end) { h.done = true; break; }
        let y = h.f(t), l, r; if (typeof y === 'number') l = r = y; else [l, r] = y;
        if (h.choke) { l *= h.choke; r *= h.choke; h.choke *= cd; if (h.choke < 1e-4) { h.done = true; break; } }
        c.in[0][j] += l; c.in[1][j] += r; }
      h.i += n; }
    this.hits = this.hits.filter(h => !h.done);
    if (!this.buf || this.buf[0].length < n) this.buf = [new Float32Array(Math.max(n, 128)), new Float32Array(Math.max(n, 128))];
    const bl = this.buf[0], br = this.buf[1]; bl.fill(0, 0, n); br.fill(0, 0, n); let any = false;
    for (const c of Object.values(this.ch)) { if (!used.has(c)) { if (!c.ring) continue; c.ring--; c.in[0].fill(0, 0, n); c.in[1].fill(0, 0, n); } else c.ring = 8; any = true;
      for (let j = 0; j < n; j++) { let l = c.in[0][j], r = c.in[1][j]; if (!c.open) { l = c.lp[0](l).lp; r = c.lp[1](r).lp; }
        if (c.sat) { l = c.sat[0](c.K*l)/c.kn; r = c.sat[1](c.K*r)/c.kn; } bl[j] += l*c.lv*c.gl; br[j] += r*c.lv*c.gr; } }
    this.tail = any ? 16 : Math.max(0, (this.tail || 0) - 1);
    // the bus: weight, tape, tone, glue, width
    const B = this.B, [s0, s1, s2, s3, s4] = B.sh;
    for (let j = 0; j < n; j++) { let l = bl[j], r = br[j];
      for (let k = 0; k < 2; k++) { const z = B.z[k], x = k ? r : l, y = s0*x + s1*z[0] + s2*z[1] - s3*z[2] - s4*z[3]; z[1] = z[0]; z[0] = x; z[3] = z[2]; z[2] = y; if (k) r = y; else l = y; }
      if (B.on) { l = (B.sat[0](B.k*l + B.bias) - B.tb)*B.norm; r = (B.sat[1](B.k*r + B.bias) - B.tb)*B.norm; }
      if (!B.open) { l = B.lp[0](l).lp; r = B.lp[1](r).lp; }
      const pk = Math.max(Math.abs(l), Math.abs(r)); B.env = pk > B.env ? pk + (B.env - pk)*B.att : pk + (B.env - pk)*B.rel;
      if ((j & 7) === 0) B.g = (B.env > B.thr ? Math.pow(B.env/B.thr, 1/B.ratio - 1) : 1)*B.mk; const g = B.g, m = (l + r)/2, sd = (l - r)/2*B.width;
      L[a + j] += ceil((m + sd)*g); R[a + j] += ceil((m - sd)*g); } }
}
// one hit of an analog kit's voice computed ahead (for drawing it, and the tests): {L, R}
export function analogHit(sr, name, key, vel = 1, over = {}, secs = 3, seed){ const K = new AnalogKit(sr, seed); K.load(name, over); K.on(key, vel);
  const n = Math.ceil(secs*sr), L = new Float32Array(n), R = new Float32Array(n); for (let a = 0; a < n; a += 128) K.render(L, R, a, Math.min(n, a + 128)); return {L, R}; }
