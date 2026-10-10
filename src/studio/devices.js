// The Studio mixer's own devices, on any audio context: a parametric EQ, a compressor (parallel too), a sidechain (ducking on
// another track's notes, or following its audio), a limiter, a gain, a mono maker. Any effect in the audio registry works in a
// chain as well. A device: {input, output, set(k, v), param(k) → {p, map} for smooth automation, gr() → dB it's turning down}.
import { effect, defaults } from '../audio/engine/registry.js';
import { TUNE } from '../tuning.js';

const db = v => Math.pow(10, v/20);
const gainNode = (ctx, g = 1) => { const n = ctx.createGain(); n.gain.value = g; return n; };
const ease = (ctx, p, v) => p.setTargetAtTime(v, ctx.currentTime, .01);
// a parameter held where it is at t
const hold = (p, t) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); };

/* ---------- EQ: any number of bands, each high-cut, low-cut, shelf, bell or notch ---------- */
// Q for 12, 24 and 48 dB Butterworth cuts, each stage's in dB (the Web Audio low- and high-pass read their Q as dB)
const BUTTER = {12: [-3.01], 24: [-5.33, 2.32], 48: [-5.85, -4.42, -.92, 8.17]};
const BAND = {hp: 'highpass', lp: 'lowpass', ls: 'lowshelf', hs: 'highshelf', bell: 'peaking', notch: 'notch'};
function eqDevice(ctx, d){
  const input = gainNode(ctx), output = gainNode(ctx), bands = [];
  let n = input;
  (d.bands || []).forEach((b, i) => {
    const type = BAND[b.type] || 'peaking', cut = b.type === 'hp' || b.type === 'lp', qs = cut ? (BUTTER[b.slope || 24] || BUTTER[24]) : [0], fs = [];
    for (const q of qs) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = b.f || 1000;
      if (cut) f.Q.value = q + (b.q ? 20*Math.log10(b.q/.7071) : 0); else { f.Q.value = b.q || (b.type === 'notch' ? 4 : 1); f.gain.value = b.g || 0; }
      n.connect(f); n = f; fs.push(f); }
    bands.push({b, fs});
  });
  n.connect(output);
  const at = k => { const [i, f] = String(k).split('.'), B = bands[+i]; return B && {B, f}; };
  return {input, output,
    param(k){ const a = at(k); if (!a) return null; const {B, f} = a;
      if (f === 'f') return {ps: B.fs.map(x => x.frequency), map: v => v};
      if (f === 'g' && B.fs[0].type !== 'highpass' && B.fs[0].type !== 'lowpass') return {ps: [B.fs[0].gain], map: v => v};
      if (f === 'q' && /peaking|notch/.test(B.fs[0].type)) return {ps: [B.fs[0].Q], map: v => v};
      return null; },
    set(k, v){ const q = this.param(k); if (!q) return; const a = at(k); a.B.b[a.f] = v; for (const p of q.ps) ease(ctx, p, q.map(v)); },
    // the response at these frequencies (dB), for drawing the curve
    curve(freqs){ const F = new Float32Array(freqs), mag = new Float32Array(F.length), ph = new Float32Array(F.length), tot = new Float32Array(F.length);
      for (const B of bands) for (const f of B.fs) { f.getFrequencyResponse(F, mag, ph); for (let i = 0; i < F.length; i++) tot[i] += 20*Math.log10(Math.max(1e-6, mag[i])); }
      return tot; },
    bands};
}

/* ---------- compressor: threshold, ratio, knee, attack, release, make-up; mix below 1 is parallel compression ---------- */
// (Chromium's compressor looks ahead 6 ms: the dry path is delayed to match, so a parallel mix doesn't comb)
function compDevice(ctx, d){
  const input = gainNode(ctx), output = gainNode(ctx), c = ctx.createDynamicsCompressor(), mk = gainNode(ctx), wet = gainNode(ctx), dry = gainNode(ctx), dl = ctx.createDelay(.05);
  dl.delayTime.value = TUNE.studio.compLook;
  input.connect(c); c.connect(mk); mk.connect(wet); wet.connect(output); input.connect(dl); dl.connect(dry); dry.connect(output);
  const P = {thr: -18, ratio: 3, knee: 6, att: .01, rel: .15, gain: 0, mix: 1, ...d};
  const apply = () => { c.threshold.value = P.thr; c.ratio.value = P.ratio; c.knee.value = P.knee; c.attack.value = P.att; c.release.value = P.rel;
    mk.gain.value = db(P.gain); wet.gain.value = P.mix; dry.gain.value = 1 - P.mix; };
  apply();
  return {input, output, node: c,
    param(k){ if (k === 'gain') return {ps: [mk.gain], map: db}; if (k === 'thr') return {ps: [c.threshold], map: v => v}; return null; },
    set(k, v){ P[k] = v; apply(); }, gr: () => -c.reduction};
}

/* ---------- sidechain: duck when another track plays ---------- */
// by note (default): each note of the source (or only its `voice`) dips the gain by `depth` dB over `att`, holds `hold`,
// and comes back over `rel` (seconds; a curve shaped like a compressor's release). Known ahead, so it lands on the
// kick's first sample. By audio (`mode: 'audio'`): the source's sound, rectified and smoothed, drives a gain computer
// (threshold, ratio, range): a real sidechain compressor, a few milliseconds late as followers are
function scDevice(ctx, d, desk){
  const input = gainNode(ctx), output = gainNode(ctx), g = gainNode(ctx, 1);
  input.connect(g); g.connect(output);
  const P = {src: 'kick', voice: null, mode: 'note', depth: 8, att: .004, hold: .03, rel: .18, thr: -24, ratio: 4, range: 18, ...d};
  const hits = [];   // (when the last ducks start, to say how far it's ducking now)
  let off = null;
  if (P.mode === 'audio') {
    // |x| → two smoothing stages → a curve from level to gain (1 at quiet, falling past the threshold by the ratio, at most range dB)
    const rect = ctx.createWaveShaper(), n = 4096, rc = new Float32Array(n); for (let i = 0; i < n; i++) rc[i] = Math.abs(i/(n - 1)*2 - 1); rect.curve = rc;
    const sm = ctx.createBiquadFilter(); sm.type = 'lowpass'; sm.frequency.value = 1/(2*Math.PI*Math.max(.003, P.att*1.5)); sm.Q.value = -3;
    const gc = ctx.createWaveShaper(), gcv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = Math.max(1e-6, (i/(n - 1))*2 - 1), lv = 20*Math.log10(x*1.4142), over = lv - P.thr;   // (a sine's peak is √2 its mean)
      const red = over <= 0 ? 0 : Math.min(P.range, over*(1 - 1/P.ratio)); gcv[i] = x <= 0 ? 0 : db(-red) - 1; }
    gc.curve = gcv; g.gain.value = 1;
    const tap = desk.tap(P.src); tap.connect(rect); rect.connect(sm); sm.connect(gc); gc.connect(g.gain);
  } else {
    const duck = t => {
      const p = g.gain, lo = db(-P.depth); hold(p, t);
      p.linearRampToValueAtTime(lo, t + P.att); p.setValueAtTime(lo, t + P.att + P.hold); p.setTargetAtTime(1, t + P.att + P.hold, Math.max(.005, P.rel/3));
      hits.push(t); if (hits.length > 8) hits.shift();
    };
    off = desk.onNote((id, e) => { if (id === P.src && (!P.voice || e.voice === P.voice)) duck(e.t); });
  }
  return {input, output,
    set(k, v){ P[k] = v; }, param: () => null,
    // how far it's ducking at audio-clock time t (dB, positive), worked out from its last ducks
    gr(t = ctx.currentTime){ if (P.mode === 'audio') return 0; let h = -1; for (const x of hits) if (x <= t) h = x; if (h < 0) return 0;
      const dt = t - h, s = P.att + P.hold; return dt < P.att ? P.depth*dt/P.att : dt < s ? P.depth : P.depth*Math.exp(-(dt - s)/Math.max(.005, P.rel/3)); },
    dispose(){ if (off) off(); }};
}

/* ---------- limiter: drive in, a fast compressor, then a soft clipper at the ceiling, oversampled ---------- */
function limDevice(ctx, d){
  const P = {gain: 0, ceil: -.3, rel: .06, ...d};
  const input = gainNode(ctx), drive = gainNode(ctx, db(P.gain)), c = ctx.createDynamicsCompressor(), clip = ctx.createWaveShaper(), output = gainNode(ctx);
  // the clipper: straight up to 80% of the ceiling, then bending smoothly into it (never past). It aims a little under:
  // oversampling's filters ring past a clipped drum's edge, so the true peak lands at the ceiling, not over it
  const curve = () => { const n = 8192, cv = new Float32Array(n), C = db(P.ceil - TUNE.studio.tpMargin), k = .8*C;
    for (let i = 0; i < n; i++) { const x = (i/(n - 1)*2 - 1)*2, a = Math.abs(x), y = a <= k ? a : k + (C - k)*Math.tanh((a - k)/(C - k)); cv[i] = Math.sign(x)*y; } return cv; };
  // (a wave shaper reads -1..1: halved first, the curve covers ±2, so a peak up to +6 dB over full scale is still shaped, not cut flat)
  const pre = gainNode(ctx, .5), post = gainNode(ctx, 1);
  const apply = () => { c.threshold.value = P.ceil - 1.5; c.knee.value = 1; c.ratio.value = 20; c.attack.value = .001; c.release.value = P.rel; clip.curve = curve(); };
  clip.oversample = '4x'; apply();
  input.connect(drive); drive.connect(c); c.connect(pre); pre.connect(clip); clip.connect(post); post.connect(output);
  return {input, output, node: c,
    param(k){ return k === 'gain' ? {ps: [drive.gain], map: db} : null; },
    set(k, v){ P[k] = v; if (k === 'gain') ease(ctx, drive.gain, db(v)); else apply(); }, gr: () => -c.reduction};
}

/* ---------- small ones ---------- */
function gainDevice(ctx, d){ const g = gainNode(ctx, db(d.db || 0)); return {input: g, output: g, param: k => k === 'db' ? {ps: [g.gain], map: db} : null, set(k, v){ if (k === 'db') ease(ctx, g.gain, db(v)); }}; }
// the low end summed to mono below a frequency (a kick and bass that stay centred), the rest untouched
function monoDevice(ctx, d){
  const input = ctx.createGain(); input.channelCount = 2; input.channelCountMode = 'explicit';
  const output = gainNode(ctx), lo = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter(), m = ctx.createGain(), f = d.f || 120;
  lo.type = 'lowpass'; hi.type = 'highpass'; lo.frequency.value = hi.frequency.value = f; lo.Q.value = hi.Q.value = -3;   // (a Linkwitz-like pair: the two halves sum flat)
  m.channelCount = 1; m.channelCountMode = 'explicit'; m.channelInterpretation = 'speakers';
  input.connect(lo); lo.connect(m); m.connect(output); input.connect(hi); hi.connect(output);
  return {input, output, set(){}, param: () => null};
}

export const DEVICES = {eq: eqDevice, comp: compDevice, sc: scDevice, limiter: limDevice, gain: gainDevice, mono: monoDevice};
// a device from its description ({type, ...settings}); a registry effect's settings are in p
export function makeDevice(ctx, d, desk, env){
  if (DEVICES[d.type]) return DEVICES[d.type](ctx, d, desk);
  const E = effect(d.type); if (!E) throw new Error(`studio: no device or effect "${d.type}"`);
  const fx = E.make(ctx, env), p = {...defaults(E), ...(d.p || {})};
  for (const q of E.params) if (q.list && typeof p[q.key] === 'string') p[q.key] = Math.max(0, q.list.indexOf(p[q.key]));
  for (const k in p) fx.set(k, p[k]);
  if (fx.now) fx.now();   // (the reverb's impulse made at once, not once a knob rests)
  return {input: fx.input, output: fx.output, fx, set(k, v){ const q = E.params.find(x => x.key === k); if (q && q.list && typeof v === 'string') v = Math.max(0, q.list.indexOf(v)); p[k] = v; fx.set(k, v); },
    param: () => null, tick: fx.tick && (t => fx.tick(t)), dispose: fx.dispose};
}
