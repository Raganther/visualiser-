// The drum machine computed natively: the browser kit's thirteen voices and five kits (src/audio/engine/inst/drums.js)
// rebuilt sample by sample, so it plays in the live engine (studio/arrange/voices.worklet.js) with the rest. Each hit is
// what the browser kit wires up for it, done here: its oscillators (sine, triangle, band-limited square, the 808's six
// clashing squares) and noise (the same noise table, looped from a random place), each through the same filters (the
// Web Audio biquads' own formulas) and the same gain shapes (set, linear and exponential ramps, as an AudioParam moves);
// then each voice's channel (tone, drive, level, pan) and the kit's bus (tone, drive), as the browser kit's nodes were.
// A closed hat chokes the open one. new NativeKit(sr) → load(kit, over), set(voice, key, v), on(voice, vel, lock),
// render(L, R, a, b) adding into L and R, stop().
import { VOICES, KITS, kitParams } from '../../../src/audio/engine/inst/drums.js';
import { rng } from '../rng.js';

const st = n => Math.pow(2, n/12), toneHz = t => 1000*Math.pow(22, t);
// the noise the browser kit loops: two seconds of the same numbers
let NOISE = null;
const noiseOf = sr => { if (NOISE?.sr === sr) return NOISE.d; const d = new Float32Array(sr*2); let s = 22222; for (let i = 0; i < d.length; i++) { s = (s*1664525 + 1013904223) >>> 0; d[i] = s/2147483648 - 1; } NOISE = {sr, d}; return d; };
// band-limited square (PolyBLEP: its steps smoothed over a sample either side), and the browser's square's level: its
// table is normalised to the Gibbs overshoot's peak, so its plateau sits below 1
const blep = (t, dt) => t < dt ? (t /= dt, t + t - t*t - 1) : t > 1 - dt ? (t = (t - 1)/dt, t*t + t + t + 1) : 0;
const SQ = .855, square = (t, dt) => ((t < .5 ? 1 : -1) + blep(t, dt) - blep((t + .5) % 1, dt))*SQ;
// (PolyBLEP softens the top octave a little more than the browser's tables do: its squares are lifted there, 2 to 3 dB
// at 10 to 14 kHz, by a three-tap filter)
const LIFT = .12;
const tri = t => t < .25 ? 4*t : t < .75 ? 2 - 4*t : 4*t - 4;
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
// the soft saturation the browser kit's shapers hold (tanh, full scale kept), read as their curve is: clamped at ±1
const sat = (x, K, m) => Math.tanh((x > 1 ? 1 : x < -1 ? -1 : x)*K)/m;

// a biquad as the Web Audio spec computes one (the low- and high-pass's Q in dB, the band-pass's as a plain Q)
function biquad(type, f, q, sr){ const nyq = sr/2, w = 2*Math.PI*Math.min(f, nyq)/sr, c = Math.cos(w), s = Math.sin(w);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass' && f >= nyq) { b0 = 1; b1 = b2 = a1 = a2 = 0; a0 = 1; }
  else if (type === 'lowpass' || type === 'highpass') { const al = s/(2*Math.pow(10, q/20)); a0 = 1 + al; a1 = -2*c; a2 = 1 - al;
    if (type === 'lowpass') { b0 = b2 = (1 - c)/2; b1 = 1 - c; } else { b0 = b2 = (1 + c)/2; b1 = -(1 + c); } }
  else { const al = s/(2*q); b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2*c; a2 = 1 - al; }
  const B0 = b0/a0, B1 = b1/a0, B2 = b2/a0, A1 = a1/a0, A2 = a2/a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = B0*x + B1*x1 + B2*x2 - A1*y1 - A2*y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; }
// a value moved as an AudioParam's events move it: [[kind, value, time]], kind 'set', 'lin' or 'exp' (times from the hit)
function param(E){ let k = 0; const n = E.length;
  return t => { while (k < n - 1 && t >= E[k + 1][2]) k++; const [, v0, t0] = E[k]; if (k === n - 1) return v0; const [kind, v1, t1] = E[k + 1];
    if (kind === 'set' || t < t0) return v0; const x = (t - t0)/(t1 - t0); return kind === 'lin' ? v0 + (v1 - v0)*x : v0*Math.pow(v1/v0, x); }; }
// a gain shaped as a hit: up in `a` seconds, held, then falling to silence over `d` (the browser kit's amp())
const amp = (at, peak, a, d, hold = 0) => [['set', 0, at], ['lin', peak, at + a], ...(hold ? [['set', peak, at + a + hold]] : []), ['exp', peak*1e-4 + 1e-6, at + a + hold + d], ['lin', 0, at + a + hold + d + .005]];

/* ---------- a hit: its pieces, each sources through filters and a gain shape, into its voice's channel ---------- */
// a piece: {from, to (seconds), parts: [{src: 'sine'|'tri'|'square'|'noise'|'metal', f (Hz or events), mul, pre: filters, g}], post: filters, env: events, pan}
function voiceHit(key, v, p, sr, R){
  const F = (type, f, q = .7) => biquad(type, f, q, sr), N = () => ({src: 'noise', off: Math.floor(R()*1.5*sr)}), out = [], m = st(p.tune);
  const piece = (from, to, parts, post, env, pan = null) => out.push({from, to, parts, post, env, pan});
  const tom = base => { const f = base*m, d = .38*p.decay, end = d + .1;
    piece(0, end, [{src: 'sine', f: [['set', f*1.7, 0], ['exp', f, .07]]}], [], amp(0, v*.8, .001, d, .01));
    piece(0, end, [{src: 'tri', f: f*1.52}], [], amp(0, v*.12, .001, d*.5));
    piece(0, .06, [N()], [F('bandpass', 420*m, 1)], amp(0, v*(.1 + p.x*.4), .0008, .03)); };
  const hat = d => { const end = d + .08;
    piece(0, end, [{src: 'metal', mul: m*1.6, g: .16*(.25 + p.x*.9)}, {...N(), pre: [F('highpass', 8000*m)], g: (1 - p.x)*.7 + .08}], [F('bandpass', 10500*m, .9), F('highpass', 7200*m)], amp(0, v*.55, .0008, d)); };
  ({
    // a sine dropping fast from a click-like high to its note (the punch), held a moment, then booming away; a short
    // filtered noise for the beater's click on top
    kick(){ const f = 49*m, d = .42*p.decay, end = d + .12;
      piece(0, end, [{src: 'sine', f: [['set', f*(3 + p.x*7), 0], ['exp', f*1.5, .014], ['exp', f, .1]]}], [], amp(0, v, .0015, d, .025));
      piece(0, .03, [N()], [F('bandpass', 3800, .8)], amp(0, v*(.15 + p.x*.45), .0005, .012)); },
    // two tuned shells dropping slightly in pitch, and the wires: bright noise, longer, louder the snappier
    snare(){ const d = .2*p.decay, end = d*1.5 + .1;
      for (const [f, l] of [[185, .5], [330, .3]]) piece(0, end, [{src: 'tri', f: [['set', f*m*1.25, 0], ['exp', f*m, .03]]}], [], amp(0, v*l*(1 - p.x*.45), .001, d*.6));
      piece(0, end, [N()], [F('highpass', 1500), F('lowpass', 9000)], amp(0, v*(.3 + p.x*.6), .001, d*1.3)); },
    // hands: four quick bursts of band-passed noise a few milliseconds apart (spread across the stereo), then the room's tail
    clap(){ const f = 1150*m, end = .4*p.decay + .2;
      [0, .0095, .019, .029].forEach((dt, i) => piece(dt, dt + .04, [N()], [F('bandpass', f, 1.3)], amp(dt, v*.95, .0008, .014), (i % 2 ? 1 : -1)*p.x*.5));
      piece(.029, end, [N()], [F('bandpass', f, 1.1)], amp(.029, v*.65, .002, .28*p.decay)); },
    // a short wooden knock: a high triangle and a band of noise
    rim(){ piece(0, .12, [{src: 'tri', f: 1720*m}], [], amp(0, v*.5, .0005, .03 + p.x*.04));
      piece(0, .12, [N()], [F('bandpass', 2600*m, 3)], amp(0, v*.35, .0005, .015));
      piece(0, .12, [{src: 'sine', f: 480*m}], [], amp(0, v*.25, .0005, .02)); },
    // a resonant wood block: a pure high tone with a little of its overtone, ringing as long as the character says
    clave(){ const f = 2450*m, d = (.04 + p.x*.08)*p.decay, end = d + .05;
      piece(0, end, [{src: 'sine', f}], [], amp(0, v*.6, .0005, d)); piece(0, end, [{src: 'sine', f: f*2.76}], [], amp(0, v*.12, .0005, d*.4)); },
    // hats: the metal (or noise, the less metallic) through a high band; a closed hat chokes an open one
    chh(){ hat(.055*p.decay); }, ohh(){ hat(.5*p.decay); },
    // the ride: the metal higher and longer, with its bell (two clear partials) as much as the character says (the
    // browser kit's metal reaches the ride's high-pass straight, its band-pass left unconnected: so here too)
    ride(){ const d = 1.6*p.decay, end = d + .1;
      piece(0, end, [{src: 'metal', mul: 1.48*m, g: .16}], [F('highpass', 3200)], amp(0, v*.6, .001, d));
      for (const [f, l] of [[2860, .25], [4150, .12]]) piece(0, end, [{src: 'sine', f: f*m}], [], amp(0, v*l*p.x, .001, d*.6)); },
    // the crash: noise and metal, high-passed, a slight swell in, then a long wash
    crash(){ const d = 2*p.decay, end = d + .1;
      piece(0, end, [{...N(), pre: [F('highpass', 5000)]}, {src: 'metal', mul: 1.9*m, g: .16*p.x*1.4}], [F('highpass', 3800)], amp(0, v*.55, .006, d)); },
    // toms: a sine sliding down to its note, a skin's ring, and a felt thump
    tomL(){ tom(92); }, tomH(){ tom(148); },
    // the cowbell: two squares a clashing interval apart, through a band, a sharp hit then a ring
    cow(){ const d = .3*p.decay, end = d + .1;
      piece(0, end, [{src: 'square', f: 587*m, g: .5}, {src: 'square', f: 845*m, g: .5}], [F('bandpass', 2400*m, 1.2)],
        [['set', 0, 0], ['lin', v*.55, .001], ['exp', v*.2, .035], ['exp', v*.2*(1e-3 + (1 - p.x)*.01) + 1e-6, d], ['lin', 0, d + .01]]); },
    // the shaker: high noise swelling in (more with the character) and out
    shaker(){ const a = .006 + p.x*.03, d = .08*p.decay; piece(0, a + d + .05, [N()], [F('highpass', 6200)], amp(0, v*.45, a, d)); },
  })[key]();
  // each piece made ready to run: its sources' phases and pitch movements, its gain shape
  for (const pc of out) { pc.env = param(pc.env); pc.gl = 1; pc.gr = 1;
    // (a panner fed one channel: equal power, half of each side in the middle)
    if (pc.pan != null) { const x = (pc.pan + 1)/2*Math.PI/2; pc.gl = Math.cos(x); pc.gr = Math.sin(x); }
    for (const q of pc.parts) { q.ph = 0; q.x1 = q.x2 = 0; q.phs = q.src === 'metal' ? METAL.map(() => 0) : null; q.fv = Array.isArray(q.f) ? param(q.f) : null; q.pre = q.pre || []; q.g ??= 1; } }
  return out; }

/* ---------- the kit: each voice's channel, the bus ---------- */
export class NativeKit {
  constructor(sr, seed = 1){ this.sr = sr; this.R = rng(seed); this.noise = noiseOf(sr); this.P = {}; this.hits = []; this.B = {};
    this.ch = Object.fromEntries(VOICES.map(v => [v.key, {key: v.key}])); this.bus = {}; this.load('909'); }
  // a voice's channel from its settings: its tone (a low-pass), drive, level and pan, as the browser kit's nodes
  apply(key){ const p = this.P[key], c = this.ch[key], sr = this.sr; c.lp = [biquad('lowpass', toneHz(p.tone), .5, sr), biquad('lowpass', toneHz(p.tone), .5, sr)];
    c.K = p.drive > .01 ? 1 + p.drive*12 : 0; c.m = c.K ? Math.tanh(c.K) : 1; c.lv = p.level*(1 - p.drive*.5); const x = ((p.pan <= 0 ? p.pan + 1 : p.pan))*Math.PI/2; c.left = p.pan <= 0; c.cg = Math.cos(x); c.sg = Math.sin(x);
    const xm = (p.pan + 1)/2*Math.PI/2; c.ml = Math.cos(xm); c.mr = Math.sin(xm); }
  busSet(b){ const sr = this.sr; this.bus = {lp: [biquad('lowpass', toneHz(b.tone), .5, sr), biquad('lowpass', toneHz(b.tone), .5, sr)], K: b.drive > .01 ? 1 + b.drive*.6*12 : 0, g: 1 - b.drive*.25}; this.bus.m = this.bus.K ? Math.tanh(this.bus.K) : 1; }
  load(name, over = {}){ const K = KITS[name] || KITS['909'], kp = kitParams(name); for (const v of VOICES) { this.P[v.key] = {...kp[v.key], ...(over[v.key] || {})}; this.apply(v.key); } this.busSet(K.bus); }
  set(key, k, v){ if (!this.P[key]) return; this.P[key][k] = v; this.apply(key); }
  // a hit now: the voice at its settings (or a step's own: lock), a touch of variation in level each time (as a hand would)
  on(key, vel = 1, lock = null){ if (!this.ch[key]) return; const p = lock ? {...this.P[key], ...lock} : this.P[key], R = this.R;
    if (key === 'chh') for (const h of this.hits) if (h.key === 'ohh' && !h.choke) h.choke = 1;
    this.hits.push({key, i: 0, pieces: voiceHit(key, vel*(.97 + R()*.06), p, this.sr, R)}); }
  stop(){ for (const h of this.hits) h.choke ||= 1; }
  render(L, R, a, b){ const n = b - a, sr = this.sr, nz = this.noise, NZ = nz.length;
    if (!this.hits.length && !this.tail) return;
    if (!this.buf || this.buf[0].length < n) this.buf = [new Float32Array(Math.max(n, 128)), new Float32Array(Math.max(n, 128))];
    const used = new Set();
    for (const h of this.hits) { const c = this.ch[h.key]; if (!c.in || c.in[0].length < n) c.in = [new Float32Array(Math.max(n, 128)), new Float32Array(Math.max(n, 128))];
      if (!used.has(c)) { c.in[0].fill(0, 0, n); c.in[1].fill(0, 0, n); used.add(c); c.st = false; }
      // (a channel carries two channels only while a panned piece feeds it: the browser kit's clap, whose bursts are panned,
      // falls back to one channel once they and their filters have finished, its tail then panned as one, 3 dB down)
      for (const pc of h.pieces) if (pc.pan != null && h.i/sr < pc.to + .015) c.st = true;
      let alive = false, ck = null;
      // a choked hit fades as the browser kit's did (to 0 with a 6 ms time constant)
      if (h.choke) { ck = new Float32Array(n); const d = Math.exp(-1/(.006*sr)); for (let j = 0; j < n; j++) { ck[j] = h.choke; h.choke *= d; } }
      for (const pc of h.pieces) { if ((h.i)/sr >= pc.to) continue; alive = true;
        for (let j = 0; j < n; j++) { const t = (h.i + j)/sr; if (t < pc.from || t >= pc.to) continue; const k = h.i + j - Math.round(pc.from*sr);
          let x = 0;
          for (const q of pc.parts) { let y;
            if (q.src === 'noise') y = nz[(q.off + k) % NZ];
            else if (q.src === 'metal') { y = 0; for (let u = 0; u < 6; u++) { const dt = METAL[u]*q.mul/sr; y += square(q.phs[u], dt); q.phs[u] += dt; q.phs[u] -= Math.floor(q.phs[u]); } }
            else { const f = q.fv ? q.fv(t) : q.f, dt = f/sr; y = q.src === 'sine' ? Math.sin(2*Math.PI*q.ph) : q.src === 'tri' ? tri(q.ph) : square(q.ph, dt); q.ph += dt; q.ph -= Math.floor(q.ph); }
            if (q.src === 'metal' || q.src === 'square') { const z = -LIFT*y + (1 + 2*LIFT)*q.x1 - LIFT*q.x2; q.x2 = q.x1; q.x1 = y; y = z; }
            for (const F of q.pre) y = F(y); x += y*q.g; }
          for (const F of pc.post) x = F(x);
          x *= pc.env(t); if (ck) x *= ck[j];
          if (pc.pan == null) { c.in[0][j] += x; c.in[1][j] += x; } else { c.in[0][j] += x*pc.gl; c.in[1][j] += x*pc.gr; } }
      }
      if (ck && ck[n - 1] < 1e-4) alive = false;
      h.i += n; h.done = !alive; }
    this.hits = this.hits.filter(h => !h.done);
    // each voice's channel (its tone, drive, level, pan) into the bus; the bus (tone, drive) out. A channel's filters ring
    // on a moment after its last hit
    const bl = this.buf[0], br = this.buf[1]; bl.fill(0, 0, n); br.fill(0, 0, n); let any = false;
    for (const c of Object.values(this.ch)) { if (!used.has(c)) { if (!c.ring) continue; c.ring--; c.st = false; c.in[0].fill(0, 0, n); c.in[1].fill(0, 0, n); } else c.ring = 8; any = true;
      // (two channels are panned as a pair; one is panned equal power)
      if (!c.st) for (let j = 0; j < n; j++) { let x = c.lp[0](c.in[0][j]); if (c.K) x = sat(x, c.K, c.m); x *= c.lv; bl[j] += x*c.ml; br[j] += x*c.mr; }
      else for (let j = 0; j < n; j++) { let l = c.lp[0](c.in[0][j]), r = c.lp[1](c.in[1][j]); if (c.K) { l = sat(l, c.K, c.m); r = sat(r, c.K, c.m); } l *= c.lv; r *= c.lv;
        if (c.left) { bl[j] += l + r*c.cg; br[j] += r*c.sg; } else { bl[j] += l*c.cg; br[j] += r + l*c.sg; } } }
    this.tail = any ? 16 : Math.max(0, (this.tail || 0) - 1);
    const B = this.bus;
    for (let j = 0; j < n; j++) { let l = B.lp[0](bl[j]), r = B.lp[1](br[j]); if (B.K) { l = sat(l, B.K, B.m); r = sat(r, B.K, B.m); } L[a + j] += l*B.g; R[a + j] += r*B.g; } }
}
// one hit of a kit's voice computed ahead (for drawing it, and the tests): {L, R}
export function kitHit(sr, name, key, vel = 1, over = {}, secs){ const K = new NativeKit(sr); K.load(name, over); K.on(key, vel);
  const n = Math.ceil((secs ?? 3)*sr), L = new Float32Array(n), R = new Float32Array(n); for (let a = 0; a < n; a += 128) K.render(L, R, a, Math.min(n, a + 128)); return {L, R}; }
