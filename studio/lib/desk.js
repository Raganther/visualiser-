// The studio's desk: a whole track built ahead on an OfflineAudioContext from the visualiser's own engine (the drum kit, the
// polysynth, the echo, the reverb, chorus and width), with buses, sends, sidechain pumping, automation and a master chain.
// A score (studio/tracks/*.js) gets one desk and places every note on it in bars and 16ths; render.mjs renders it.
import { makeDrums } from '../../src/audio/engine/inst/drums.js';
import { makePoly, PRESETS } from '../../src/audio/engine/inst/poly.js';
import delayFx from '../../src/audio/engine/fx/delay.js';
import reverbFx from '../../src/audio/engine/fx/reverb.js';
import chorusFx from '../../src/audio/engine/fx/chorus.js';
import widthFx from '../../src/audio/engine/fx/width.js';
import { bq, two } from '../../src/audio/engine/fx/kit.js';
import { NATIVE, noteBuffers } from './native/index.js';

const db = v => Math.pow(10, v/20);
// a seeded random (lib/rng.js; the kit's own variation reads Math.random, which render.mjs seeds too)
import { rng } from './rng.js';
export { rng };

// live (the DAW): t0 offsets every time (bar 0 at t0 on the audio clock), meters off, and native notes from a cache
// (nativeBuf(name, n, vel, settings) → an AudioBuffer, or null while it's still being computed)
export function desk(ctx, {bpm, swing = 0, seed = 1, raw = false, t0 = 0, meters = true, nativeBuf = null}){
  const beat = 60/bpm, six = beat/4, env = {period: () => beat};
  const d = {ctx, bpm, beat, rand: rng(seed), buses: {}, kicks: [], notes: []};
  // where a bar and 16th fall, in seconds (odd 16ths late by the swing)
  d.t = (bar, step = 0) => t0 + (bar*16 + step)*six + (Math.floor(step) % 2 ? swing*six : 0);
  d.bars = secs => secs/(beat*4);

  /* ---------- the master: glue, then a limiter ---------- */
  const sum = two(ctx), glue = ctx.createDynamicsCompressor(), trim = ctx.createGain(), lim = ctx.createDynamicsCompressor(), out = ctx.createGain();
  glue.threshold.value = -16; glue.ratio.value = 2; glue.knee.value = 8; glue.attack.value = .03; glue.release.value = .25;
  lim.threshold.value = -2; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = .001; lim.release.value = .08;
  // raw: no glue or limiter, so stems rendered apart sum to the mix exactly (the loop labs)
  if (raw) sum.connect(out); else { sum.connect(glue); glue.connect(trim); trim.connect(lim); lim.connect(out); }
  out.connect(ctx.destination); d.outNode = out;
  // meters: each bus's left and right (after its level), and the master's, read at every pause of the render, so the
  // report can say how loud and wide each part is in each section
  const meter = node => { if (!meters) return null; const sp = ctx.createChannelSplitter(2), m = [ctx.createAnalyser(), ctx.createAnalyser()];
    m.forEach((an, i) => { an.fftSize = 32768; sp.connect(an, i); }); node.connect(sp); return m; };
  d.meters = {master: meter(out)}; d.reads = [];

  d.master = {in: sum, trim: trim.gain, out: out.gain};
  // the master as a jam's mixer set it: shelves, width before the glue, the glue's setting, the volume after the limiter
  d.masterSet = (o = {}) => { if (raw) return; sum.disconnect(); let at = sum; const link = n => { at.connect(n.input || n); at = n.output || n; };
    if (o.lo) { const f = bq(ctx, 'lowshelf', 110, .7); f.gain.value = o.lo; link(f); } if (o.hi) { const f = bq(ctx, 'highshelf', 7000, .7); f.gain.value = o.hi; link(f); }
    if (o.width != null && o.width !== 1) { const w = widthFx.make(ctx); w.set('w', o.width); w.set('mono', 150); link(w); }
    link(glue); if (o.glue === null) { glue.threshold.value = 0; glue.ratio.value = 1; } else if (o.glue) { glue.threshold.value = o.glue.thr; glue.ratio.value = o.glue.ratio; glue.attack.value = o.glue.att; glue.release.value = o.glue.rel; }
    if (o.vol) out.gain.value = Math.pow(10, o.vol/20); };

  /* ---------- the returns: an echo and a reverb, each a bus of its own (so they can pump too) ---------- */
  const ret = (name, fx, set) => { const f = fx.make(ctx, env); for (const [k, v] of Object.entries(set)) f.set(k, v); f.tick?.(0); f.now?.(); return f; };
  d.returns = (o = {}) => {
    const dl = ret('delay', delayFx, {mix: 1, div: 6, fb: .42, tone: 2400, ping: 1, ...o.delay}), rv = ret('reverb', reverbFx, {mix: 1, kind: 0, size: .7, damp: .6, low: 220, pre: .02, ...o.reverb});
    const A = d.bus('echo', {level: o.echoDb ?? -6, pump: o.echoPump}), B = d.bus('verb', {level: o.verbDb ?? -6, pump: o.verbPump, width: o.verbWidth});
    A.fxIn = dl.input; dl.output.connect(A.in); B.fxIn = rv.input; rv.output.connect(B.in);
    d.sendA = dl.input; d.sendB = rv.input; return d;
  };

  // another return of its own (a long dotted echo for washes, a second reverb for throws), fed by d.send
  d.addReturn = (name, kind, set = {}, o = {}) => { const f = ret(name, kind === 'delay' ? delayFx : reverbFx, {mix: 1, ...(kind === 'delay' ? {ping: 1} : {kind: 0}), ...set});
    const R = d.bus(name, o); f.output.connect(R.in); R.fxIn = f.input; R.fx = f; return R; };
  // a send from a bus's level to a return, in dB (its gain, for ramps)
  d.send = (from, to, dB = -60) => { const g = ctx.createGain(); g.gain.value = dB <= -60 ? 0 : db(dB); d.buses[from].lvl.connect(g); g.connect(d.buses[to].fxIn); return g.gain; };

  /* ---------- a bus: filter → chorus → width → pan → pump → level → master, its level feeding the two sends ---------- */
  d.bus = (name, o = {}) => {
    const b = {name, in: two(ctx)}; let at = b.in;
    const link = n => { at.connect(n.input || n); at = n.output || n; };
    b.filter = bq(ctx, o.filter?.type || 'lowpass', o.filter?.cut ?? 20000, o.filter?.q ?? .7); link(b.filter);
    if (o.hp) { b.hp = bq(ctx, 'highpass', o.hp, .7); link(b.hp); }
    // a three-band EQ (a jam's mixer): low shelf, a bell in the middle, high shelf, each in dB
    if (o.eq) { b.eqLo = bq(ctx, 'lowshelf', 120, .7); b.eqMid = bq(ctx, 'peaking', 1000, .8); b.eqHi = bq(ctx, 'highshelf', 6000, .7);
      b.eqLo.gain.value = o.eq.lo || 0; b.eqMid.gain.value = o.eq.mid || 0; b.eqHi.gain.value = o.eq.hi || 0; link(b.eqLo); link(b.eqMid); link(b.eqHi); }
    if (o.chorus) { const c = chorusFx.make(ctx, env); for (const [k, v] of Object.entries({rate: .35, depth: .5, mix: .4, ...o.chorus})) c.set(k, v); link(c); }
    if (o.width != null) { const w = widthFx.make(ctx); w.set('w', o.width); w.set('mono', o.mono ?? 150); link(w); }
    b.pan = ctx.createStereoPanner(); b.pan.pan.value = o.pan || 0; link(b.pan);
    b.duck = ctx.createGain(); link(b.duck); b.pump = o.pump || null;
    b.lvl = ctx.createGain(); b.lvl.gain.value = db(o.level ?? 0); link(b.lvl); b.lvl.connect(sum);
    d.meters[name] = meter(b.lvl);
    b.level = b.lvl.gain;
    // (the sends: dB, or none; they need d.returns() first)
    b.a = ctx.createGain(); b.a.gain.value = o.a != null ? db(o.a) : 0; b.lvl.connect(b.a); if (o.a != null && d.sendA) b.a.connect(d.sendA);
    b.b = ctx.createGain(); b.b.gain.value = o.b != null ? db(o.b) : 0; b.lvl.connect(b.b); if (o.b != null && d.sendB) b.b.connect(d.sendB);
    d.buses[name] = b; return b;
  };

  /* ---------- instruments, each into its bus ---------- */
  d.kit = (bus, kitName = 'Minimal', over = {}) => { const k = makeDrums(ctx, d.buses[bus].in); k.load(kitName, over); k.bus = bus; return k; };
  d.synth = (bus, preset, set = {}) => { const s = makePoly(ctx, d.buses[bus].in, env); s.load({...(PRESETS[preset] || {}), ...set}); s.bus = bus; return s; };
  // a native instrument (lib/native): each note computed from its physics into a buffer, played like a synth's note; its
  // settings (hard, pos, decay, …) can move with d.morph, so the sound changes from note to note
  const bufs = new WeakMap();
  d.native = (bus, name, set = {}) => { const P = {...set}, g = NATIVE[name].gain*(P.gain ?? 1); delete P.gain;
    return {bus, P, set(k, v){ P[k] = v; }, play(n, t, len, vel){
      const set = NATIVE[name].held ? {...P, len} : P; let ab;
      if (nativeBuf) { ab = nativeBuf(name, n, vel, set); if (!ab) return; }
      else { const o = noteBuffers(ctx.sampleRate, name, n, vel, set); ab = bufs.get(o); if (!ab) { ab = ctx.createBuffer(2, o.L.length, ctx.sampleRate); ab.copyToChannel(o.L, 0); ab.copyToChannel(o.R, 1); bufs.set(o, ab); } }
      const src = ctx.createBufferSource(), gn = ctx.createGain(); src.buffer = ab; gn.gain.value = g*(.4 + .6*vel);
      src.connect(gn); gn.connect(d.buses[bus].in); src.start(t); src.onended = () => gn.disconnect(); }}; };

  /* ---------- placing notes ---------- */
  // a hit; on the kick kit's kick it's also what the sidechain ducks to
  d.hit = (kit, voice, bar, step, vel = 1, lock = null) => { const t = d.t(bar, step); d.later(t, () => kit.play(voice, t, vel, lock)); if (voice === 'kick' && kit.side) d.kicks.push(t); d.notes.push({t, src: kit.bus, voice, vel}); };
  // a pattern every bar from bar a to b (not including b): 'x' a hit, 'X' an accent, 'o' a ghost, '.' none; prob thins it, at shifts it
  d.pattern = (kit, voice, str, a, b, {vel = .8, prob = 1, every = 1, skip} = {}) => {
    const n = str.length;
    for (let bar = a; bar < b; bar += every) {
      if (skip && skip(bar)) continue;
      for (let s = 0; s < n; s++) { const c = str[s]; if (c === '.' || d.rand() > prob) continue;
        const v = (c === 'X' ? 1.2 : c === 'o' ? .4 : 1)*vel*(.92 + d.rand()*.16);
        d.hit(kit, voice, bar + Math.floor(s/16), s % 16, Math.min(1.4, v)); }
    }
  };
  // a note: midi, at bar and 16th, length in 16ths
  d.note = (syn, n, bar, step, len = 1, vel = .8) => { const t = d.t(bar, step); d.later(t, () => syn.play(n, t, len*six, vel)); d.notes.push({t, src: syn.bus, n, vel, len: len*six}); };
  d.chord = (syn, ns, bar, step, len, vel = .7) => ns.forEach((n, i) => d.note(syn, n, bar, step + i*.02, len, vel*(1 - i*.04)));

  /* ---------- automation: points [bar, value], ramps between them ---------- */
  d.ramp = (param, pts, {exp = false} = {}) => {
    const [b0, v0] = pts[0]; param.setValueAtTime(v0, d.t(b0));
    for (const [bb, v] of pts.slice(1)) exp && v > 0 ? param.exponentialRampToValueAtTime(v, d.t(bb)) : param.linearRampToValueAtTime(v, d.t(bb));
  };
  d.dbRamp = (param, pts) => d.ramp(param, pts.map(([b, v]) => [b, v <= -60 ? 0 : db(v)]));
  // an LFO on any parameter: its period in beats (ramped with `beats` points), its depth ramped in the parameter's own units
  d.lfo = (param, {beats = 8, rate, depth = [[0, 0]], type = 'sine'} = {}) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = 1/(beats*beat); g.gain.value = 0;
    o.connect(g); g.connect(param); o.start(0); d.ramp(g.gain, depth); if (rate) d.ramp(o.frequency, rate.map(([b, bt]) => [b, 1/(bt*beat)]), {exp: true});
    return {osc: o, gain: g}; };
  // a synth's own setting moving over bars ([bar, value] points, eased between them, set at each bar line before its notes)
  d.morph = (syn, key, pts, every = 1) => { for (let i = 0; i < pts.length - 1; i++) { const [b0, v0] = pts[i], [b1, v1] = pts[i + 1];
    for (let bar = b0; bar < b1; bar += every) { const x = (bar - b0)/(b1 - b0), v = v0 + (v1 - v0)*(.5 - .5*Math.cos(Math.PI*x)); d.later(d.t(bar) - .001, () => syn.set(key, v)); } }
    const [bl, vl] = pts[pts.length - 1]; d.later(d.t(bl) - .001, () => syn.set(key, vl)); };

  // a noise swell, band-passed and rising, into a bus (a riser before a drop, a wash in a breakdown)
  d.noise = (bus, a, b, {f0 = 300, f1 = 6000, q = 1.4, peak = -12, fade = 'in'} = {}) => d.later(d.t(a) - .1, () => {
    const t0 = d.t(a), t1 = d.t(b), n = ctx.createBuffer(2, ctx.sampleRate*2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const x = n.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = d.rand()*2 - 1; }
    const src = ctx.createBufferSource(), f = bq(ctx, 'bandpass', f0, q), g = ctx.createGain(); src.buffer = n; src.loop = true;
    src.connect(f); f.connect(g); g.connect(d.buses[bus].in);
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t1);
    g.gain.setValueAtTime(fade === 'in' ? 0 : db(peak), t0); g.gain.linearRampToValueAtTime(fade === 'in' ? db(peak) : 0, t1); g.gain.linearRampToValueAtTime(0, t1 + .02);
    src.start(t0); src.stop(t1 + .05);
  });

  /* ---------- lazy scheduling: a node waiting to start still costs every block, so each note is made only a few
     seconds before it plays (the render suspends every couple of seconds to make the next ones) ---------- */
  const queue = [];
  d.later = (t, fn) => queue.push({t, fn});
  // live: sort what's queued, then feed it up to a time on the audio clock as the music plays (what's already past is skipped)
  let li = 0; d.start = (from = -Infinity) => { queue.sort((a, b) => a.t - b.t); li = 0; while (li < queue.length && queue[li].t < from) li++; };
  d.feedTo = until => { while (li < queue.length && queue[li].t < until) { const q = queue[li++]; try { q.fn(); } catch (e) { console.error(`a note at ${q.t.toFixed(2)} s: ${e.message}`); } } return li < queue.length; };
  d.render = (AHEAD = 3, STEP = 2) => {
    queue.sort((a, b) => a.t - b.t); let i = 0; const sr = ctx.sampleRate, end = ctx.length/sr;
    const buf = new Float32Array(32768), read = at => { const r = {t: at, wall: performance.now()};
      for (const [k, [l, rr]] of Object.entries(d.meters)) { l.getFloatTimeDomainData(buf); const L = buf.slice(); rr.getFloatTimeDomainData(buf);
        let m = 0, sd = 0; for (let j = 0; j < buf.length; j++) { const a = (L[j] + buf[j])/2, b = (L[j] - buf[j])/2; m += a*a; sd += b*b; } r[k] = [m/buf.length, sd/buf.length]; }
      d.reads.push(r); };
    const feed = until => { while (i < queue.length && queue[i].t < until) { const q = queue[i++]; try { q.fn(); } catch (e) { console.error(`a note at ${q.t.toFixed(2)} s: ${e.message}`); } } };
    feed(AHEAD);
    for (let s = STEP; s < end - .1; s += STEP) { const at = Math.round(s*sr/128)*128/sr; ctx.suspend(at).then(() => { try { read(at); feed(at + AHEAD); } catch (e) { console.error(`at ${at.toFixed(1)} s: ${e.message}`); } finally { ctx.resume(); } }); }   // (always resume: an error must not stall the render)
    return ctx.startRendering();
  };

  /* ---------- the end: the sidechain ducked to every kick, on each bus that pumps ---------- */
  // only these buses heard (with the returns, which then carry only their sends): a stem
  d.solo = names => { for (const [k, b] of Object.entries(d.buses)) if (!names.includes(k) && k !== 'echo' && k !== 'verb') b.lvl.disconnect(); };
  d.finish = () => {
    const ks = [...d.kicks].sort((a, b) => a - b);
    for (const b of Object.values(d.buses)) { if (!b.pump) continue; const p = b.duck.gain, depth = b.pump.depth ?? .6, rel = (b.pump.rel ?? .5)*beat;
      p.setValueAtTime(1, 0);
      for (const t of ks) { p.setTargetAtTime(1 - depth, t, .004); p.setTargetAtTime(1, t + .02, rel/3); } }
  };
  return d;
}
export { PRESETS };
