// The processors: sound in, sound out, computed sample by sample (a leaf module: plain maths, no audio nodes). Each is
// a plug: it describes its own settings, so any page can build its knobs, and any host can string them in any order.
// A processor is `make(sr)` → {set(params), process(L, R, a, b, env)}: it works on L and R in place from a to b; env
// carries what the host knows (the beat's length: `period`). Some keep a meter (`gr`: the compressor's reduction in dB).
// They came out of the instruments (the analog drum machine's bus, the analog synth's effects), which now use them.
import { TAU, th, toneHz, adaaT, svf, fromDb } from './dsp.js';

const C = (v, a, b) => v < a ? a : v > b ? b : v;

/* ---------- tone and weight ---------- */
// a low shelf (RBJ, a slope of 1) at `freq`, `db` up or down: the low end's weight
class Weight { constructor(sr){ this.sr = sr; this.z = [[0, 0, 0, 0], [0, 0, 0, 0]]; this.set({}); }
  set(p){ this.p = {db: 2, freq: 70, ...this.p, ...p}; const {db, freq} = this.p, sr = this.sr, A = Math.pow(10, db/40), w0 = TAU*freq/sr, c = Math.cos(w0), s = Math.sin(w0), al = s/2*Math.SQRT2, sq = 2*Math.sqrt(A)*al;
    const a0 = (A + 1) + (A - 1)*c + sq; this.c = [A*((A + 1) - (A - 1)*c + sq)/a0, 2*A*((A - 1) - (A + 1)*c)/a0, A*((A + 1) - (A - 1)*c - sq)/a0, -2*((A - 1) + (A + 1)*c)/a0, ((A + 1) + (A - 1)*c - sq)/a0]; }
  process(L, R, a, b){ const [s0, s1, s2, s3, s4] = this.c;
    for (let k = 0; k < 2; k++) { const z = this.z[k], X = k ? R : L; for (let j = a; j < b; j++) { const x = X[j], y = s0*x + s1*z[0] + s2*z[1] - s3*z[2] - s4*z[3]; z[1] = z[0]; z[0] = x; z[3] = z[2]; z[2] = y; X[j] = y; } } } }
// a gentle low-pass (two poles): the highs softened, the way a desk or tape takes them
class Tone { constructor(sr){ this.sr = sr; this.set({}); }
  set(p){ this.p = {tone: 1, ...this.p, ...p}; this.open = this.p.tone >= .995; this.lp = [svf(toneHz(this.p.tone), .6, this.sr), svf(toneHz(this.p.tone), .6, this.sr)]; }
  process(L, R, a, b){ if (this.open) return; const [f, g] = this.lp; for (let j = a; j < b; j++) { L[j] = f(L[j]).lp; R[j] = g(R[j]).lp; } } }
// a high-pass (two poles): the low end taken out below `freq`
class Cut { constructor(sr){ this.sr = sr; this.set({}); }
  set(p){ this.p = {freq: 30, ...this.p, ...p}; this.hp = [svf(this.p.freq, .707, this.sr), svf(this.p.freq, .707, this.sr)]; }
  process(L, R, a, b){ const [f, g] = this.hp; for (let j = a; j < b; j++) { L[j] = f(L[j]).hp; R[j] = g(R[j]).hp; } } }

/* ---------- colour ---------- */
// tape: driven with a little bias (an asymmetry: its even harmonics' warmth), quiet signals at their own level, peaks
// rounded over (the harder it's driven, the more); its output lifted back to where it went in, on average
class Tape { constructor(sr){ this.sat = [adaaT(), adaaT()]; this.set({}); }
  set(p){ this.p = {drive: .3, ...this.p, ...p}; const dr = this.p.drive; this.on = dr > .01; this.k = dr*3; this.bias = .08*dr; this.tb = Math.tanh(this.bias); this.norm = 1/((this.k || 1)*(1 - this.tb*this.tb)); this.out = 1 + .8*dr; }
  process(L, R, a, b){ const [f, g] = this.sat, {k, bias, tb, norm, out} = this;
    if (!this.on) { if (out !== 1) for (let j = a; j < b; j++) { L[j] *= out; R[j] *= out; } return; }
    for (let j = a; j < b; j++) { L[j] = (f(k*L[j] + bias) - tb)*norm*out; R[j] = (g(k*R[j] + bias) - tb)*norm*out; } } }
// saturation: a VCA or an amplifier pushed (symmetric, so odd harmonics), its level kept
class Saturate { constructor(){ this.set({}); }
  set(p){ this.p = {amount: .2, ...this.p, ...p}; }
  process(L, R, a, b){ const s = this.p.amount; if (!(s > 0)) return; const K = 1 + s*3, m = 1 + s*.6; for (let j = a; j < b; j++) { L[j] = th(L[j]*K)/K*m; R[j] = th(R[j]*K)/K*m; } } }

/* ---------- dynamics ---------- */
// glue: a compressor on both sides together (so the picture doesn't wander), its detector a peak follower (a fast
// attack, a slower release), its gain worked out every 8 samples; `mix` below 1 blends the dry signal back (parallel)
class Glue { constructor(sr){ this.sr = sr; this.env = 0; this.g = null; this.gr = 0; this.set({}); }
  set(p){ this.p = {thr: -12, ratio: 2, att: 4, rel: 120, makeup: 0, mix: 1, ...this.p, ...p}; const q = this.p, sr = this.sr;
    this.thr = fromDb(q.thr); this.exp = 1/q.ratio - 1; this.mk = fromDb(q.makeup); this.att = Math.exp(-1/(q.att/1000*sr)); this.rel = Math.exp(-1/(q.rel/1000*sr)); if (this.g == null) this.g = this.mk; }
  process(L, R, a, b){ const {thr, exp, mk, att, rel} = this, mix = this.p.mix; let env = this.env, g = this.g, low = 1;
    for (let j = a; j < b; j++) { const l = L[j], r = R[j], pk = Math.max(Math.abs(l), Math.abs(r)); env = pk > env ? pk + (env - pk)*att : pk + (env - pk)*rel;
      if (((j - a) & 7) === 0) { g = (env > thr ? Math.pow(env/thr, exp) : 1)*mk; if (g/mk < low) low = g/mk; }
      if (mix >= 1) { L[j] = l*g; R[j] = r*g; } else { L[j] = l*g*mix + l*(1 - mix); R[j] = r*g*mix + r*(1 - mix); } }
    // (the meter holds the deepest reduction and falls back at 20 dB a second, so a page can read it)
    this.env = env; this.g = g; this.gr = Math.max(-20*Math.log10(low), this.gr - 20*(b - a)/this.sr); } }
// the ceiling: untouched below the knee, rounded over above it, never past full scale (`fast`: the cheap tanh)
class Ceiling { constructor(sr, o = {}){ this.fast = !!o.fast; this.set({}); }
  set(p){ this.p = {knee: .89, ...this.p, ...p}; }
  process(L, R, a, b){ const k = this.p.knee, w = 1 - k, T = this.fast ? th : Math.tanh;
    for (let j = a; j < b; j++) { let y = L[j], m = Math.abs(y); if (m >= k) L[j] = Math.sign(y)*(k + w*T((m - k)/w)); y = R[j]; m = Math.abs(y); if (m >= k) R[j] = Math.sign(y)*(k + w*T((m - k)/w)); } } }
// the DC kept out (a one-pole high-pass a few hertz up)
class DCBlock { constructor(){ this.z = [0, 0, 0, 0]; } set(){}
  process(L, R, a, b){ const z = this.z; for (let j = a; j < b; j++) { const l = L[j], r = R[j], hl = l - z[0] + .9995*z[1]; z[0] = l; z[1] = hl; const hr = r - z[2] + .9995*z[3]; z[2] = r; z[3] = hr; L[j] = hl; R[j] = hr; } } }

/* ---------- ducking: one part making room for another ---------- */
// a Linkwitz-Riley split at f (each side two two-pole filters in a row: 24 dB an octave), so a part can be ducked below
// a frequency only: y = highs + lows·g; the two halves sum flat (an all-pass), so nothing ducked sounds as it was
function split(sr, f){ const mk = () => [svf(f, .707, sr), svf(f, .707, sr), svf(f, .707, sr), svf(f, .707, sr)];
  return [mk(), mk()].map(([a, b, c, d]) => x => { const lo = b(a(x).lp).lp, hi = d(c(x).hp).hp; return [lo, hi]; }); }
// the shapes a dip can come back in, over its length (x from 0 to 1): eased, as a compressor lets go (fast, then slow),
// or pumping (held down, then swelling back late)
export const DUCK_SHAPES = ['Smooth', 'Like a compressor', 'Pumping'];
const back = [x => .5 - .5*Math.cos(Math.PI*x), x => (1 - Math.exp(-4*x))/(1 - Math.exp(-4)), x => Math.pow(x, 2.5)];
const apply = (o, L, R, j, g) => { if (o.lo) { const [l, h] = o.lo[0](L[j]), [r, k] = o.lo[1](R[j]); L[j] = h + l*g; R[j] = k + r*g; } else { L[j] *= g; R[j] *= g; } };
// the ducker that reads the score: the notes and hits the host has been given (env.tl), past and to come. Following a
// drum's hits (`from` 'kit:kick'), each dips the sound from `pre` before it lands (it knows it's coming), holds,
// then comes back over `len` beats in its shape, as deep as its velocity says; following an instrument's notes
// (`from` 'lead'), it dips while each note sounds and comes back after it ends. `band` above 0 ducks only below it.
class Duck { constructor(sr){ this.sr = sr; this.gr = 0; this.set({}); }
  set(p){ this.p = {from: '', depth: 10, pre: 4, hold: 10, len: .45, shape: 0, vel: .5, band: 0, ...this.p, ...p}; const b = this.p.band; if (b !== this.band) { this.band = b; this.lo = b >= 20 ? split(this.sr, b) : null; } }
  process(L, R, a, b, env = {}){ const q = this.p, [src, voice] = q.from.split(':'), T = env.tl?.[src], sr = env.sr || this.sr, t0 = env.now ?? 0;
    let lo = 1; const per = env.period || .5, pre = q.pre/1000, hold = voice ? q.hold/1000 : 0, len = Math.max(.005, q.len*per), shape = back[Math.round(q.shape)] || back[0], t1 = t0 + (b - a)/sr;
    // what can touch this block: hits (start and end the same) or notes (start to end)
    const spans = []; if (T) for (const x of voice ? T.hits : T.notes) { if (voice && x.voice !== voice) continue; const e = voice ? x.t : x.off;
      if (x.t - pre <= t1 && e + hold + len >= t0) spans.push([x.t, e, 1 - q.vel + q.vel*x.vel]); }
    if (!spans.length && !this.lo) { this.trace?.push(...new Array(b - a).fill(1)); this.gr = Math.max(0, this.gr - 20*(b - a)/sr); return; }
    for (let j = a; j < b; j++) { const t = t0 + (j - a)/sr; let dip = 0;
      for (const [s, e, v] of spans) { let d; if (t < s - pre) continue; if (t < s) d = pre > 0 ? .5 - .5*Math.cos(Math.PI*(t - s + pre)/pre) : 1; else if (t <= e + hold) d = 1; else { const y = (t - e - hold)/len; if (y >= 1) continue; d = 1 - shape(y); }
        if (d*v > dip) dip = d*v; }
      const g = dip > 0 ? Math.pow(10, -q.depth*dip/20) : 1; if (g < lo) lo = g; this.trace?.push(g); apply(this, L, R, j, g); }
    this.gr = Math.max(-20*Math.log10(lo), this.gr - 20*(b - a)/sr); } }
// the classic sidechain compressor: it listens to another strip (`key`, its sound before its fader: env.keys) and turns
// this one down by how far that goes over the threshold, after its attack, letting go over its release. It hears the kick
// only as it happens, so its dip comes a little after it; `band` above 0 ducks only below it.
class Sidechain { constructor(sr){ this.sr = sr; this.env = 0; this.gr = 0; this.set({}); }
  set(p){ this.p = {key: '', thr: -24, ratio: 6, att: 5, rel: 180, range: 24, band: 0, ...this.p, ...p}; const q = this.p, sr = this.sr;
    this.att = Math.exp(-1/(Math.max(.05, q.att)/1000*sr)); this.rel = Math.exp(-1/(q.rel/1000*sr)); const b = q.band; if (b !== this.band) { this.band = b; this.lo = b >= 20 ? split(sr, b) : null; } }
  process(L, R, a, b, env = {}){ const q = this.p, K = env.keys?.[q.key], k1 = 1 - 1/q.ratio; let e = this.env, lo = 1;
    for (let j = a; j < b; j++) { const x = K ? Math.max(Math.abs(K[0][j - a]), Math.abs(K[1][j - a])) : 0; e = x > e ? x + (e - x)*this.att : x + (e - x)*this.rel;
      const over = e > 1e-6 ? 20*Math.log10(e) - q.thr : -1, red = over > 0 ? Math.min(q.range, over*k1) : 0, g = red > 0 ? Math.pow(10, -red/20) : 1;
      if (g < lo) lo = g; this.trace?.push(g); apply(this, L, R, j, g); }
    this.env = e; this.gr = Math.max(-20*Math.log10(lo), this.gr - 20*(b - a)/this.sr); } }

/* ---------- space ---------- */
// width: mid and sides, the sides turned up or down (0 mono, 1 as it is)
class Width { constructor(){ this.set({}); }
  set(p){ this.p = {width: 1, ...this.p, ...p}; }
  process(L, R, a, b){ const w = this.p.width; if (w === 1) return; for (let j = a; j < b; j++) { const m = (L[j] + R[j])/2, s = (L[j] - R[j])/2*w; L[j] = m + s; R[j] = m - s; } } }
// a chorus in the manner of a bucket brigade's: a delay line swept by a triangle, the two sides in opposition, the wet
// a little darker; I slow, II faster and deeper, I + II a quick shallow shimmer
export const CHORUS = ['Off', 'I', 'II', 'I + II'];
class Chorus { constructor(sr){ this.sr = sr; const n = Math.ceil(.03*sr); this.d = [new Float32Array(n), new Float32Array(n)]; this.w = 0; this.ph = 0; this.lp = [0, 0]; this.set({}); }
  set(p){ this.p = {mode: 1, ...this.p, ...p}; }
  process(L, R, a, b){ const ch = Math.round(this.p.mode); if (!ch) return; const sr = this.sr, cd = this.d, cn = cd[0].length;
    const rate = ch === 1 ? .513 : ch === 2 ? .863 : 9.75, dep = ch === 3 ? .0004 : ch === 2 ? .0019 : .0016, mid = .0035;
    for (let j = a; j < b; j++) { const l = L[j], r = R[j]; cd[0][this.w] = l; cd[1][this.w] = r; this.ph = (this.ph + rate/sr) % 1; const tri = 1 - 4*Math.abs(this.ph - .5);
      let p = (this.w - (mid + dep*tri)*sr + cn) % cn, i = Math.floor(p), f = p - i; const wl = cd[0][i]*(1 - f) + cd[0][(i + 1) % cn]*f;
      p = (this.w - (mid - dep*tri)*sr + cn) % cn; i = Math.floor(p); f = p - i; const wr = cd[1][i]*(1 - f) + cd[1][(i + 1) % cn]*f;
      this.lp[0] += (wl - this.lp[0])*.45; this.lp[1] += (wr - this.lp[1])*.45;
      this.w = (this.w + 1) % cn; L[j] = (l + this.lp[0])*.75; R[j] = (r + this.lp[1])*.75; } } }
// a tape echo in time: ping-pong (each side's repeat fed into the other), the repeats darker and gently saturated, the
// tape wavering a little; its time a division of the beat (env.period), easing to a new one as tape would
export const ECHO = ['1/4', '1/8 dotted', '1/8', '1/4 dotted', '1/16', '1/8 triplet'], ECHO_BEATS = [1, .75, .5, 1.5, .25, 1/3];
class Echo { constructor(sr){ this.sr = sr; const n = Math.ceil(2.2*sr); this.d = [new Float32Array(n), new Float32Array(n)]; this.w = 0; this.lp = [0, 0]; this.t = .375; this.wow = 0; this.set({}); }
  set(p){ this.p = {time: 1, mix: .3, fb: .4, tone: .5, dry: 1, ...this.p, ...p}; }
  process(L, R, a, b, env = {}){ const {mix, fb, dry} = this.p; if (!(mix > 0)) { if (dry !== 1) for (let j = a; j < b; j++) { L[j] *= dry; R[j] *= dry; } return; }
    const sr = this.sr, ed = this.d, en = ed[0].length, tone = .08 + .5*this.p.tone*this.p.tone, et = C(ECHO_BEATS[Math.round(this.p.time)]*(env.period || .5), .02, 2);
    for (let j = a; j < b; j++) { const l = L[j], r = R[j]; this.t += (et - this.t)*.0004; this.wow += 1/sr;
      const d = (this.t + .0006*Math.sin(TAU*.6*this.wow))*sr, p = (this.w - d + en) % en, i = Math.floor(p), f = p - i;
      const el = ed[0][i]*(1 - f) + ed[0][(i + 1) % en]*f, er = ed[1][i]*(1 - f) + ed[1][(i + 1) % en]*f;
      this.lp[0] += (el - this.lp[0])*tone; this.lp[1] += (er - this.lp[1])*tone;
      ed[0][this.w] = th(l*.7 + this.lp[1]*fb); ed[1][this.w] = th(r*.3 + this.lp[0]*fb); this.w = (this.w + 1) % en;
      L[j] = (dry === 1 ? l : l*dry) + this.lp[0]*mix; R[j] = (dry === 1 ? r : r*dry) + this.lp[1]*mix; } } }
// a room: eight delay lines feeding one another through a mixing matrix (a feedback delay network), each a little
// darker each time round, so the tail is dense, smooth and dies at the rate asked; a pre-delay, the low end kept out
const LINES = [29.7, 37.1, 41.1, 43.7, 53.9, 59.3, 67.1, 73.3];
class Room { constructor(sr){ this.sr = sr; const n = Math.ceil(.0733*2*sr) + 2; this.d = LINES.map(() => new Float32Array(n)); this.pos = new Int32Array(8); this.s = new Float64Array(8);
    this.pd = new Float32Array(Math.ceil(.1*sr) + 2); this.pw = 0; this.hp = [0, 0]; this.set({}); }
  set(p){ this.p = {size: 1, decay: 1.8, damp: .5, pre: 12, cut: 150, mix: .3, dry: 1, ...this.p, ...p}; const q = this.p, sr = this.sr;
    this.len = LINES.map(ms => Math.max(8, Math.round(ms*q.size*sr/1000))); for (let i = 0; i < 8; i++) this.pos[i] %= this.len[i];
    this.g = this.len.map(n => Math.pow(10, -3*n/(q.decay*sr))); this.dc = 1 - q.damp*.35; this.pn = Math.round(q.pre/1000*sr); this.hc = Math.exp(-TAU*q.cut/sr); }
  process(L, R, a, b){ const {d, pos, s, len, g, dc, pd, pn, hc} = this, {mix, dry} = this.p, pl = pd.length;
    for (let j = a; j < b; j++) { const l = L[j], r = R[j];
      // in: both sides together, the low end taken out (one pole), then the pre-delay
      let x = (l + r)*.5; this.hp[0] = hc*(this.hp[0] + x - this.hp[1]); this.hp[1] = x; x = this.hp[0];
      pd[this.pw] = x; const xi = pd[(this.pw - pn + pl) % pl]; this.pw = (this.pw + 1) % pl;
      let sum = 0; for (let i = 0; i < 8; i++) { s[i] += (d[i][pos[i]] - s[i])*dc; sum += s[i]; }
      const h = sum*.25; let ol = 0, or = 0;
      for (let i = 0; i < 8; i++) { const v = s[i]; d[i][pos[i]] = (i & 1 ? -xi : xi) + g[i]*(v - h); pos[i] = (pos[i] + 1) % len[i]; if (i & 1) or += v; else ol += v; }
      L[j] = l*dry + ol*.3*mix; R[j] = r*dry + or*.3*mix; } } }

/* ---------- the registry ---------- */
// units: dB, Hz (Hz0: 0 is everything), ms, s, beat, % (0..1), × (a multiple), knee (a level shown in dB), list (a name each)
const P = (key, label, min, max, def, unit, x = {}) => ({key, label, min, max, def, unit, ...x});
export const PROCS = {
  weight: {label: 'Weight', words: 'A low shelf: the low end\'s weight, up or down.', make: sr => new Weight(sr),
    params: [P('db', 'Weight', -6, 9, 2, 'dB'), P('freq', 'Below', 30, 200, 70, 'Hz', {log: true})]},
  cut: {label: 'Low cut', words: 'A high-pass: the low end taken out.', make: sr => new Cut(sr), params: [P('freq', 'Below', 20, 800, 30, 'Hz', {log: true})]},
  tone: {label: 'Tone', words: 'The highs softened, as a desk or tape takes them.', make: sr => new Tone(sr), params: [P('tone', 'Tone', 0, 1, 1, '%')]},
  tape: {label: 'Tape', words: 'Driven with a little bias: warmth from even harmonics, the peaks rounded over.', make: sr => new Tape(sr), params: [P('drive', 'Drive', 0, 1, .3, '%')]},
  saturate: {label: 'Saturation', words: 'An amplifier pushed: odd harmonics, a harder edge.', make: sr => new Saturate(sr), params: [P('amount', 'Amount', 0, 1, .2, '%')]},
  glue: {label: 'Glue', words: 'A compressor on both sides together: holds the parts together; below 100% mix it\'s parallel compression.', make: sr => new Glue(sr), meter: 'gr',
    params: [P('thr', 'Threshold', -36, 0, -12, 'dB'), P('ratio', 'Ratio', 1, 10, 2, ':1', {log: true}), P('att', 'Attack', .1, 50, 4, 'ms', {log: true}),
      P('rel', 'Release', 10, 1000, 120, 'ms', {log: true}), P('makeup', 'Makeup', 0, 18, 0, 'dB'), P('mix', 'Mix', 0, 1, 1, '%')]},
  width: {label: 'Width', words: 'Mid and sides: 0 is mono, 100% as it is, more is wider.', make: sr => new Width(sr), params: [P('width', 'Width', 0, 2, 1, '%')]},
  chorus: {label: 'Chorus', words: 'A bucket-brigade chorus: I slow, II deeper, I + II a shimmer.', make: sr => new Chorus(sr), params: [P('mode', 'Mode', 0, 3, 1, 'list', {list: CHORUS})]},
  echo: {label: 'Echo', words: 'A tape echo in time, ping-pong, its repeats darker.', make: sr => new Echo(sr),
    params: [P('time', 'Time', 0, 5, 1, 'list', {list: ECHO}), P('mix', 'Echo', 0, 1, .3, '%'), P('fb', 'Feedback', 0, .92, .4, '%'), P('tone', 'Tone', 0, 1, .5, '%'), P('dry', 'Dry', 0, 1, 1, '%')]},
  room: {label: 'Room', words: 'A reverb: eight delay lines feeding one another, a dense tail that dies at the rate asked.', make: sr => new Room(sr),
    params: [P('size', 'Size', .3, 2, 1, '×'), P('decay', 'Decay', .2, 8, 1.8, 's', {log: true}), P('damp', 'Damping', 0, 1, .5, '%'), P('pre', 'Pre-delay', 0, 90, 12, 'ms'),
      P('cut', 'Low cut', 20, 800, 150, 'Hz', {log: true}), P('mix', 'Room', 0, 1, .3, '%'), P('dry', 'Dry', 0, 1, 1, '%')]},
  duck: {label: 'Duck from the notes', words: 'Makes room for a part it follows in the score: it knows when each hit or note comes, so it moves before it lands, as deep as the note is hard.', make: sr => new Duck(sr), meter: 'gr',
    params: [P('depth', 'Depth', 0, 36, 10, 'dB'), P('pre', 'Ahead', 0, 30, 4, 'ms'), P('hold', 'Hold', 0, 120, 10, 'ms'), P('len', 'Comes back over', .05, 1, .45, 'beat'),
      P('shape', 'Shape', 0, 2, 0, 'list', {list: DUCK_SHAPES}), P('vel', 'Velocity', 0, 1, .5, '%'), P('band', 'Only below', 0, 400, 0, 'Hz0')]},
  sidechain: {label: 'Sidechain compressor', words: 'The classic: listens to another part and turns this one down when that one goes over the threshold, after its attack.', make: sr => new Sidechain(sr), meter: 'gr',
    params: [P('thr', 'Threshold', -48, 0, -24, 'dB'), P('ratio', 'Ratio', 1, 20, 6, ':1', {log: true}), P('att', 'Attack', .1, 50, 5, 'ms', {log: true}),
      P('rel', 'Release', 20, 1000, 180, 'ms', {log: true}), P('range', 'Range', 0, 36, 24, 'dB'), P('band', 'Only below', 0, 400, 0, 'Hz0')]},
  ceiling: {label: 'Ceiling', words: 'Untouched below the knee, rounded above it, never past full scale.', make: (sr, o) => new Ceiling(sr, o), params: [P('knee', 'Knee', .5, .98, .89, 'knee')]},
  dc: {label: 'DC block', words: 'Keeps the signal centred (a high-pass a few hertz up).', make: () => new DCBlock(), params: []},
};
export const defaults = key => Object.fromEntries(PROCS[key].params.map(p => [p.key, p.def]));
// a processor made and set: make('glue', sr, {thr: -18})
export const make = (key, sr, params = {}, o) => { const x = PROCS[key].make(sr, o); x.set({...defaults(key), ...params}); x.key = key; return x; };

let ids = 0;
// a chain: processors in order, each on or off; run(L, R, a, b, env) works in place
export class Chain {
  constructor(sr, list = []){ this.sr = sr; this.list = list.map(s => this.make(s)); }
  make(s){ const x = make(s.key, this.sr, s.params, s.o); x.on = s.on !== false; x.id = s.id ?? 'p' + (++ids); return x; }
  run(L, R, a, b, env){ for (const x of this.list) if (x.on) x.process(L, R, a, b, env); }
  find(id){ return this.list.find(x => x.id === id); }
}
