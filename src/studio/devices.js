// The Studio mixer's own devices, on any audio context: a parametric EQ, a mid/side EQ, a dynamic EQ, a compressor (parallel
// too), a multiband compressor with drive in each band, a transient shaper, tape and console saturation, a sidechain (ducking
// on another track's notes, or following its audio), a limiter, a gain, a mono maker. Any effect in the audio registry works in a
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
// a run of bands from `from`, in series; returns where it ends and each band's filters
function bandRun(ctx, from, list){
  let n = from; const bands = [];
  for (const b of list) {
    const type = BAND[b.type] || 'peaking', cut = b.type === 'hp' || b.type === 'lp', qs = cut ? (BUTTER[b.slope || 24] || BUTTER[24]) : [0], fs = [];
    for (const q of qs) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = b.f || 1000;
      if (cut) f.Q.value = q + (b.q ? 20*Math.log10(b.q/.7071) : 0); else { f.Q.value = b.q || (b.type === 'notch' ? 4 : 1); f.gain.value = b.g || 0; }
      n.connect(f); n = f; fs.push(f); }
    bands.push({b, fs});
  }
  return {end: n, bands};
}
// a band's parameter ('2.f', '0.g', '1.q') among these bands
function bandParam(bands, k){
  const [i, f] = String(k).split('.'), B = bands[+i]; if (!B || !B.fs.length) return null;
  if (f === 'f') return {ps: B.fs.map(x => x.frequency), map: v => v, B, f};
  if (f === 'g' && B.fs[0].type !== 'highpass' && B.fs[0].type !== 'lowpass') return {ps: [B.fs[0].gain], map: v => v, B, f};
  if (f === 'q' && /peaking|notch/.test(B.fs[0].type)) return {ps: [B.fs[0].Q], map: v => v, B, f};
  return null;
}
// the response of these bands at these frequencies (dB), for drawing the curve
function bandCurve(bands, freqs){
  const F = new Float32Array(freqs), mag = new Float32Array(F.length), ph = new Float32Array(F.length), tot = new Float32Array(F.length);
  for (const B of bands) for (const f of B.fs) { f.getFrequencyResponse(F, mag, ph); for (let i = 0; i < F.length; i++) tot[i] += 20*Math.log10(Math.max(1e-6, mag[i])); }
  return tot;
}
function eqDevice(ctx, d){
  const input = gainNode(ctx), output = gainNode(ctx), {end, bands} = bandRun(ctx, input, d.bands || []);
  end.connect(output);
  return {input, output, bands,
    param(k){ return bandParam(bands, k); },
    set(k, v){ const q = bandParam(bands, k); if (!q) return; q.B.b[q.f] = v; for (const p of q.ps) ease(ctx, p, q.map(v)); },
    curve: freqs => bandCurve(bands, freqs)};
}

/* ---------- mid/side EQ: the middle and the sides each their own bands ---------- */
// (the sides' low end cut keeps the bass mono; a lift of the sides' highs widens the air without touching the middle)
function msDevice(ctx, d){
  const input = ctx.createGain(); input.channelCount = 2; input.channelCountMode = 'explicit'; input.channelInterpretation = 'speakers';
  const sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2), output = gainNode(ctx);
  const mono = () => { const g = ctx.createGain(); g.channelCount = 1; g.channelCountMode = 'explicit'; return g; };
  const mid = mono(), side = mono(), sideG = gainNode(ctx, db(d.side || 0)), negS = mono(); negS.gain.value = -1;
  input.connect(sp); sp.connect(mid, 0); sp.connect(mid, 1); sp.connect(side, 0);
  const negR = mono(); negR.gain.value = -1; sp.connect(negR, 1); negR.connect(side);
  mid.gain.value = side.gain.value = .5;
  const all = d.bands || [], idx = ch => all.map((b, i) => [b, i]).filter(([b]) => (b.ch || 'mid') === ch);
  const M = bandRun(ctx, mid, idx('mid').map(x => x[0])), Sd = bandRun(ctx, side, idx('side').map(x => x[0]));
  // (each band in the song's order, wherever it went)
  const bands = []; idx('mid').forEach(([, i], j) => bands[i] = M.bands[j]); idx('side').forEach(([, i], j) => bands[i] = Sd.bands[j]);
  Sd.end.connect(sideG); sideG.connect(negS);
  M.end.connect(mg, 0, 0); M.end.connect(mg, 0, 1); sideG.connect(mg, 0, 0); negS.connect(mg, 0, 1); mg.connect(output);
  return {input, output, bands,
    param(k){ if (k === 'side') return {ps: [sideG.gain], map: db}; return bandParam(bands, k); },
    set(k, v){ if (k === 'side') { d.side = v; return ease(ctx, sideG.gain, db(v)); } const q = bandParam(bands, k); if (!q) return; q.B.b[q.f] = v; for (const p of q.ps) ease(ctx, p, q.map(v)); },
    curves: freqs => ({mid: bandCurve(M.bands, freqs), side: bandCurve(Sd.bands, freqs).map(v => v + (d.side || 0))})};
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
    // (a source 'drums:kick' is the kick pad of the rack called drums)
    off = desk.onNote((id, e) => { if ((id === P.src && (!P.voice || e.voice === P.voice)) || id + ':' + e.voice === P.src) duck(e.t); });
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

/* ---------- pieces for the dynamic devices ---------- */
// a wave shaper over -1..1 from a function (n points)
const shaper = (ctx, fn, os, n = 4096) => { const w = ctx.createWaveShaper(), c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = fn(i/(n - 1)*2 - 1); w.curve = c; if (os) w.oversample = os; return w; };
// smoothing over about `secs` (a gentle low-pass: the envelope of a rectified signal)
const smooth = (ctx, secs) => { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(ctx.sampleRate/4, 1/(2*Math.PI*Math.max(.0005, secs))); f.Q.value = -3.01; return f; };
// Linkwitz-Riley crossovers (two Butterworths in a row): the low and high halves sum flat, phase-shifted like an all-pass
const lr4 = (ctx, type, f) => { const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(); for (const x of [a, b]) { x.type = type; x.frequency.value = f; x.Q.value = -3.01; } a.connect(b); return {input: a, output: b, fs: [a, b]}; };
const rectify = ctx => shaper(ctx, Math.abs);
// a soft saturation with its small-signal gain kept: drive (dB) bends the loud parts only, near enough level at -12 dBFS
function satCurve(drive, bias = 0){
  if (drive <= 0 && !bias) return u => u*2;
  const g = db(drive), t0 = Math.tanh(bias), sl = 1 - t0*t0, f = x => (Math.tanh(x*g + bias) - t0)/(sl*g), k = .25/f(.25);
  return u => f(u*2)*k;
}

// Chromium's compressor adds make-up of its own (0.6 of what it takes off a full-scale sound): taken back out, so a band's
// compressor only turns it down, and its own gain is the only make-up
const unMakeup = (thr, ratio) => ratio > 1 ? .6*thr*(1 - 1/ratio) : 0;

/* ---------- multiband: three bands, each its own drive and compressor ---------- */
// lo and hi are the crossovers (Hz); bands [{thr, ratio, gain, drive}] low, mid, high; att and rel for all three; mix for
// parallel. With every ratio 1 and no drive the bands sum back flat (the low band passes an all-pass to match the others)
function multiDevice(ctx, d){
  const P = {lo: 200, hi: 2500, att: .01, rel: .15, mix: 1, knee: 6, ...d}, B = [0, 1, 2].map(i => ({thr: 0, ratio: 1, gain: 0, drive: 0, ...((d.bands || [])[i] || {})}));
  const input = gainNode(ctx), output = gainNode(ctx), wet = gainNode(ctx), dry = gainNode(ctx), dl = ctx.createDelay(.05);
  dl.delayTime.value = TUNE.studio.compLook; input.connect(dl); dl.connect(dry); dry.connect(output); wet.connect(output);
  const lowLp = lr4(ctx, 'lowpass', P.lo), restHp = lr4(ctx, 'highpass', P.lo), midLp = lr4(ctx, 'lowpass', P.hi), hiHp = lr4(ctx, 'highpass', P.hi), ap = ctx.createBiquadFilter();
  ap.type = 'allpass'; ap.frequency.value = P.hi; ap.Q.value = Math.SQRT1_2;
  input.connect(lowLp.input); input.connect(restHp.input); lowLp.output.connect(ap); restHp.output.connect(midLp.input); restHp.output.connect(hiHp.input);
  const ends = [ap, midLp.output, hiHp.output];
  const st = ends.map((from, i) => {
    const pre = gainNode(ctx, .5), sh = shaper(ctx, satCurve(B[i].drive), '2x'), c = ctx.createDynamicsCompressor(), mk = gainNode(ctx);
    from.connect(pre); pre.connect(sh); sh.connect(c); c.connect(mk); mk.connect(wet); return {sh, c, mk};
  });
  const apply = () => { st.forEach((x, i) => { const b = B[i]; x.c.threshold.value = b.thr; x.c.ratio.value = Math.max(1, b.ratio); x.c.knee.value = P.knee; x.c.attack.value = P.att; x.c.release.value = P.rel;
      x.mk.gain.value = db(b.gain + unMakeup(b.thr, b.ratio)); });
    wet.gain.value = P.mix; dry.gain.value = 1 - P.mix; };
  apply();
  const xo = () => { for (const f of [...lowLp.fs, ...restHp.fs]) ease(ctx, f.frequency, P.lo); for (const f of [...midLp.fs, ...hiHp.fs, ap]) ease(ctx, f.frequency, P.hi); };
  return {input, output,
    param(k){ const [i, f] = String(k).split('.'); if (f === 'gain' && st[+i]) return {ps: [st[+i].mk.gain], map: db}; return null; },
    set(k, v){ const [i, f] = String(k).split('.');
      if (f && B[+i]) { B[+i][f] = v; if (d.bands && d.bands[+i]) d.bands[+i][f] = v; if (f === 'drive') st[+i].sh.curve = shaper(ctx, satCurve(v)).curve; else apply(); return; }
      P[k] = v; if (k === 'lo' || k === 'hi') xo(); else apply(); },
    gr: () => Math.max(...st.map(x => -x.c.reduction)), grs: () => st.map(x => -x.c.reduction)};
}

/* ---------- dynamic EQ: bands that move only when their part of the sound is loud ---------- */
// each band [{type: bell | ls | hs, f, q, thr, range, ratio, g}]: listens to its own frequencies (before any band acts),
// and past its threshold (dB) moves by up to range dB (a cut below 0, a lift above), by the ratio; g is a static gain too.
// The low-mids building up only when the pad and bass play together are cut then, and left alone the rest of the time
function dynEqDevice(ctx, d){
  const P = {speed: .03, ...d}, input = gainNode(ctx), output = gainNode(ctx), bands = [];
  let n = input;
  const map = b => { const thr = b.thr ?? -30, range = b.range ?? -6, ratio = Math.max(1.01, b.ratio || 3);
    return u => { const e = Math.max(1e-6, u*2), over = 20*Math.log10(e/.9) - thr; return over <= 0 ? 0 : Math.sign(range)*Math.min(Math.abs(range), over*(1 - 1/ratio)); }; };
  for (const b of d.bands || []) {
    const f = ctx.createBiquadFilter(); f.type = {ls: 'lowshelf', hs: 'highshelf'}[b.type] || 'peaking'; f.frequency.value = b.f || 300; f.Q.value = b.q || 1.4; f.gain.value = b.g || 0;
    const det = ctx.createBiquadFilter(); det.type = {ls: 'lowpass', hs: 'highpass'}[b.type] || 'bandpass'; det.frequency.value = b.f || 300; det.Q.value = b.type === 'ls' || b.type === 'hs' ? 0 : (b.q || 1.4);
    const pre = gainNode(ctx, .5), r = rectify(ctx), sm = smooth(ctx, P.speed), m = shaper(ctx, map(b)), an = ctx.createAnalyser(); an.fftSize = 32;
    input.connect(det); det.connect(pre); pre.connect(r); r.connect(sm); sm.connect(m); m.connect(f.gain); m.connect(an);
    n.connect(f); n = f; bands.push({b, f, det, m, an, buf: new Float32Array(32)});
  }
  n.connect(output);
  return {input, output, bands,
    param: () => null,
    set(k, v){ const [i, key] = String(k).split('.'), B = bands[+i]; if (!B) { P[k] = v; return; } B.b[key] = v;
      if (key === 'f') { ease(ctx, B.f.frequency, v); ease(ctx, B.det.frequency, v); } else if (key === 'q') { ease(ctx, B.f.Q, v); if (B.det.type === 'bandpass') ease(ctx, B.det.Q, v); }
      else if (key === 'g') ease(ctx, B.f.gain, v); else B.m.curve = shaper(ctx, map(B.b)).curve; },
    // how far each band is moving now (dB), and the most any is cutting
    moves: () => bands.map(B => { B.an.getFloatTimeDomainData(B.buf); return B.buf[31]; }),
    gr(){ return Math.max(0, ...this.moves().map(v => -v)); },
    curve(freqs){ const F = new Float32Array(freqs), mag = new Float32Array(F.length), ph = new Float32Array(F.length), tot = new Float32Array(F.length);
      for (const B of bands) { B.f.getFrequencyResponse(F, mag, ph); for (let i = 0; i < F.length; i++) tot[i] += 20*Math.log10(Math.max(1e-6, mag[i])); } return tot; }};
}

/* ---------- transient shaper: the attack and the sustain, whatever the level ---------- */
// a fast and a slow envelope, compared in dB: where the fast one leads it's an attack (lifted or softened by attack dB),
// where it trails it's the ring (by sustain dB). The sound is held back 2 ms so the lift lands on the hit's first edge
function transDevice(ctx, d){
  const P = {attack: 0, sustain: 0, fast: .0015, slow: .05, ...d};
  const input = gainNode(ctx), output = gainNode(ctx), dl = ctx.createDelay(.02), vca = gainNode(ctx, 0);
  dl.delayTime.value = .002; input.connect(dl); dl.connect(vca); vca.connect(output);
  const r = rectify(ctx), fast = smooth(ctx, P.fast), slow = smooth(ctx, P.slow), log = () => shaper(ctx, u => Math.max(-1, 20*Math.log10(Math.max(1e-6, u))/96));
  const lf = log(), ls = log(), neg = gainNode(ctx, -1), sum = gainNode(ctx);
  const map = () => u => { const dd = u*96; return db(dd > 0 ? P.attack*Math.min(1, dd/12) : P.sustain*Math.min(1, -dd/12)); };
  const m = shaper(ctx, map());
  input.connect(r); r.connect(fast); r.connect(slow); fast.connect(lf); slow.connect(ls); ls.connect(neg); lf.connect(sum); neg.connect(sum); sum.connect(m); m.connect(vca.gain);
  return {input, output, param: () => null,
    set(k, v){ P[k] = v; if (k === 'attack' || k === 'sustain') m.curve = shaper(ctx, map()).curve; }};
}

/* ---------- tape and console: saturation that glues ---------- */
// tape: driven into a lopsided curve (even harmonics, warm), the head bump lifting the low end, the highs rolled off;
// console: a gentle, even curve and nothing else. Both keep quiet sounds at their level: drive only bends the loud parts
function satDevice(ctx, d, kind){
  const P = kind === 'tape' ? {drive: 6, bump: 1.5, hf: 15000, bias: .2, ...d} : {drive: 3, ...d};
  const input = gainNode(ctx), output = gainNode(ctx), pre = gainNode(ctx, .5), sh = shaper(ctx, satCurve(P.drive, P.bias || 0), '4x', 8192), dc = ctx.createBiquadFilter();
  dc.type = 'highpass'; dc.frequency.value = 12; dc.Q.value = -3.01;
  input.connect(pre); pre.connect(sh); sh.connect(dc);
  let bump = null, hf = null;
  if (kind === 'tape') { bump = ctx.createBiquadFilter(); bump.type = 'peaking'; bump.frequency.value = 70; bump.Q.value = .8; bump.gain.value = P.bump;
    hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = P.hf; hf.Q.value = -3.01; dc.connect(bump); bump.connect(hf); hf.connect(output); }
  else dc.connect(output);
  return {input, output, param: () => null,
    set(k, v){ P[k] = v; if (k === 'drive' || k === 'bias') sh.curve = shaper(ctx, satCurve(P.drive, P.bias || 0), null, 8192).curve; else if (k === 'bump' && bump) ease(ctx, bump.gain, v); else if (k === 'hf' && hf) ease(ctx, hf.frequency, v); }};
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

export const DEVICES = {eq: eqDevice, comp: compDevice, sc: scDevice, limiter: limDevice, gain: gainDevice, mono: monoDevice,
  multiband: multiDevice, dyneq: dynEqDevice, transient: transDevice, mseq: msDevice, tape: (ctx, d) => satDevice(ctx, d, 'tape'), console: (ctx, d) => satDevice(ctx, d, 'console')};
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
