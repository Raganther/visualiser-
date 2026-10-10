// The FM synth: bells, metallic plucks, glassy keys, wooden blips and growling basses from three sine operators.
// Operator 2 and 3 each have a ratio to the note, a depth (the modulation index) with its own envelope and velocity, and the
// algorithm says who modulates whom: a stack (3 → 2 → 1), both into the carrier (2 + 3 → 1), 2 into 1 with 3 a second carrier
// (bells' extra partial), or 3 into both. A shared index bus scales every depth (an LFO or automation makes it growl or
// open), then a low-pass, drive, level and pan. Poly, mono or legato with glide.
import { RATES, SHAPES, adsr, bus, gain, hold, hz, lfoHz, makeLfo, resolve, rng, satCurve } from './vkit.js';

export const ALGOS = ['Stack 3→2→1', '2+3→1', '2→1, 3 alone', '3→2 and 3→1'];
export const DESTS = {index: ['FM depth', 1], cut: ['Cutoff', 4800], pitch: ['Pitch', 1200], amp: ['Volume', 1], pan: ['Pan', 1]};
export const SOURCES = {lfo1: 'LFO', vel: 'Velocity', key: 'Key'};
const S = (key, label, min, max, def, unit, x = {}) => ({key, label, min, max, def, unit, ...x});
const L = (key, label, list, def) => ({key, label, list, def});
export const GROUPS = [
  ['Operators', [L('algo', 'Algorithm', ALGOS, 0), S('r1', 'Carrier ratio', .5, 8, 1, '×'), S('r2', 'Op 2 ratio', .25, 16, 2, '×'), S('d2', 'Op 2 detune', -50, 50, 0, 'ct'),
    S('i2', 'Op 2 depth', 0, 12, 2, ''), S('r3', 'Op 3 ratio', .25, 16, 3.5, '×'), S('i3', 'Op 3 depth', 0, 12, 0, ''), S('fb', 'Op 3 level', 0, 1, .3, '%')]],
  ['Op envelopes', [S('ma', 'Attack', .001, 4, .001, 's', {log: true}), S('m2d', 'Op 2 decay', .005, 8, .4, 's', {log: true}), S('m2s', 'Op 2 sustain', 0, 1, .2, '%'),
    S('m3d', 'Op 3 decay', .005, 8, .15, 's', {log: true}), S('m3s', 'Op 3 sustain', 0, 1, 0, '%'), S('ivel', 'Depth velocity', 0, 1, .6, '%'), S('ikey', 'Depth key', -1, 1, -.3, '%')]],
  ['Amp', [S('aa', 'Attack', .001, 8, .001, 's', {log: true}), S('ad', 'Decay', .005, 8, .8, 's', {log: true}), S('as', 'Sustain', 0, 1, 0, '%'),
    S('ar', 'Release', .005, 10, .4, 's', {log: true}), S('vel', 'Velocity', 0, 1, .6, '%')]],
  ['Tone', [S('cut', 'Cutoff', 100, 20000, 12000, 'Hz', {log: true}), S('res', 'Resonance', 0, 1, .05, '%'), S('drive', 'Drive', 0, 1, 0, '%')]],
  ['LFO', [L('l1', 'Shape', SHAPES, 0), L('l1t', 'Time', RATES, 0), S('l1r', 'Rate', .02, 30, 4, 'Hz', {log: true})]],
  ['Play', [L('mode', 'Voices', ['Poly', 'Mono', 'Legato'], 0), S('voices', 'Polyphony', 1, 12, 8, '', {step: 1}), S('glide', 'Glide', 0, 1, .04, 's'),
    S('oct', 'Octave', -3, 3, 0, 'oct', {step: 1}), S('tune', 'Tune', -24, 24, 0, 'st'), S('index', 'Depth', 0, 2, 1, '×')]],
  ['Output', [S('level', 'Level', 0, 2, .8, '×'), S('pan', 'Pan', -1, 1, 0, 'pan')]]];
export const PARAMS = GROUPS.flatMap(g => g[1]);

export const PRESETS = {
  // a struck bell: an inharmonic ratio decaying slowly, and a bright partial dying fast
  'Bell': {algo: 1, r2: 3.5, i2: 3, m2d: 2.5, m2s: 0, r3: 7.1, i3: 2, m3d: .25, ad: 3, as: 0, ar: 2.5, level: .55},
  // a metallic pluck: a short, bright strike, made for a dub delay
  'Metal pluck': {algo: 1, r2: 1.41, i2: 5, m2d: .12, m2s: 0, r3: 4.7, i3: 2.5, m3d: .05, ad: .3, as: 0, ar: .25, cut: 9000, level: .6},
  // a wooden blip: minimal techno's percussion-melody, short and round
  'Wood blip': {algo: 0, r2: 2, i2: 4, m2d: .06, m2s: 0, r3: 5, i3: 1.5, m3d: .03, ad: .12, as: 0, ar: .1, cut: 6000, level: .7},
  // the e-piano: a tine's clang over a soft body
  'E-piano': {algo: 2, r2: 1, i2: 1.6, m2d: 1.4, m2s: .15, r3: 14, fb: .12, i3: 0, aa: .002, ad: 2.2, as: .25, ar: .5, ivel: .8, level: .55},
  // the FM bass: a growl that closes as it decays, mono
  'FM bass': {algo: 0, r2: 1, i2: 3.2, m2d: .25, m2s: .25, r3: 2, i3: 1.2, m3d: .1, aa: .002, ad: .5, as: .8, ar: .06, cut: 2400, drive: .3, mode: 'Mono', level: .9},
  // glass: high ratios, slow attack, shimmering
  'Glass': {algo: 1, r2: 4, i2: 1.2, m2d: 3, m2s: .5, r3: 9, i3: .4, m3d: 2, aa: .08, ad: 3, as: .5, ar: 2, l1: 'Sine', l1r: .3, level: .45},
  // a clang: inharmonic and harsh, for industrial hits
  'Clang': {algo: 0, r2: 1.414, i2: 8, m2d: .2, m2s: 0, r3: 3.33, i3: 5, m3d: .08, ad: .4, as: 0, ar: .3, drive: .4, level: .5},
};

export default {key: 'fm', label: 'FM', words: 'three operators: bells, plucks, blips, keys and basses', groups: GROUPS, params: PARAMS, presets: PRESETS,
  make: (ctx, out, env) => makeFm(ctx, out, env)};

export function makeFm(ctx, out, env = {period: () => .5, t0: 0}){
  const P = resolve(PARAMS, {}); P.matrix = [];
  const R = rng(4321);
  const B = {index: bus(ctx, 1), cut: bus(ctx, 0), pitch: bus(ctx, 0), amp: bus(ctx, 1), pan: bus(ctx, 0)};
  const sum = gain(ctx, 0), lp = ctx.createBiquadFilter(), ws = ctx.createWaveShaper(), dg = gain(ctx, 1), pan = ctx.createStereoPanner(), lvl = gain(ctx, P.level);
  lp.type = 'lowpass'; lp.frequency.value = 1000; B.cut.connect(lp.detune);
  B.amp.connect(sum.gain); B.pan.connect(pan.pan); sum.connect(lp); lp.connect(ws); ws.connect(dg); dg.connect(pan); pan.connect(lvl); lvl.connect(out);
  const voices = []; let last = null, lfo = null, routes = [];
  const now = () => ctx.currentTime;
  const MAP = {index: [B.index.offset, v => v], cut: [B.cut.offset, v => 1200*Math.log2(v/1000)], res: [lp.Q, r => -3 + r*20], tune: [B.pitch.offset, v => v*100],
    level: [lvl.gain, v => v], pan: [B.pan.offset, v => v]};
  const param = k => MAP[k] ? {p: MAP[k][0], map: MAP[k][1]} : null;
  const tone = () => { ws.curve = P.drive > .01 ? satCurve(P.drive) : null; dg.gain.value = 1 - P.drive*.35; };
  function lfoStart(t0){
    if (lfo) lfo.stop(now()); for (const r of routes) r.disconnect(); routes = [];
    lfo = makeLfo(ctx, P.l1, lfoHz(P.l1t, P.l1r, env.period()), t0 == null ? now() : t0);
    for (const [src, d, a] of P.matrix) if (src === 'lfo1' && DESTS[d]) { const g = gain(ctx, a*DESTS[d][1]); lfo.out.connect(g); g.connect(B[d].offset); routes.push(g); }
  }
  function voice(note, vel, t){
    const f = hz(note), k = 1 - P.vel + P.vel*vel, links = [], srcs = [], v = {note, t0: t, end: Infinity, osc: [], links, srcs};
    const link = (a, b) => { a.connect(b); links.push([a, b]); };
    const pitchIn = gain(ctx, 1); link(B.pitch, pitchIn);
    const iv = (1 - P.ivel + P.ivel*vel)*Math.pow(2, P.ikey*(note - 60)/24);   // (the depth by velocity, and less up the keyboard: bells stay clean high up)
    const op = (ratio, det = 0) => { const o = ctx.createOscillator(); o.frequency.value = f*ratio; o.detune.value = det; pitchIn.connect(o.detune); o.start(Math.max(now(), t - R()*.002)); v.osc.push({o, mul: ratio}); return o; };
    // a modulator: its sine × its envelope × its depth (in Hz: index × its frequency) × the shared index bus
    const mod = (o, ratio, idx, d, s) => {
      const e = ctx.createConstantSource(); e.offset.value = 0; adsr(e.offset, t, P.ma, d, s, 1); e.start(t); srcs.push(e);
      const depth = gain(ctx, 0), sc = gain(ctx, idx*iv*f*ratio), m = gain(ctx, 0);
      link(B.index, sc); sc.connect(depth.gain); e.connect(depth); depth.connect(m.gain); o.connect(m); return {m, e};
    };
    const c = op(P.r1), o2 = op(P.r2, P.d2), o3 = op(P.r3);
    const A = Math.round(P.algo), m2 = mod(o2, P.r2, P.i2, P.m2d, P.m2s), m3 = mod(o3, P.r3, P.i3, P.m3d, P.m3s);
    v.envs = [m2.e, m3.e];
    m2.m.connect(c.frequency);
    if (A === 0) m3.m.connect(o2.frequency); else if (A === 1) m3.m.connect(c.frequency); else if (A === 3) { m3.m.connect(o2.frequency); m3.m.connect(c.frequency); }
    const vca = gain(ctx, 0), pk = (.25 + .75*k)*.4; c.connect(vca);
    if (A === 2) { const g = gain(ctx, P.fb*.6); o3.connect(g); g.connect(vca); }
    adsr(vca.gain, t, P.aa, P.ad, P.as, pk); vca.connect(sum);
    v.vca = vca;
    if (P.glide > 0 && last != null && last !== note) for (const {o, mul} of v.osc) { o.frequency.setValueAtTime(hz(last)*mul, t); o.frequency.setTargetAtTime(f*mul, t, P.glide/3); }
    v.retune = (n, at) => { for (const {o, mul} of v.osc) P.glide > 0 ? o.frequency.setTargetAtTime(hz(n)*mul, at, P.glide/3) : o.frequency.setValueAtTime(hz(n)*mul, at); v.note = n; };
    return v;
  }
  function release(v, t, fast){
    if (v.end <= t) return; if (v.end < Infinity) unrelease(v);
    v.end = t; const r = fast ? .008 : P.ar;
    hold(v.vca.gain, t); v.vca.gain.setTargetAtTime(0, t, r/4);
    const stop = t + r*2.2 + .03; for (const {o} of v.osc) o.stop(stop); for (const s of v.srcs) s.stop(stop);
    v.osc[0].o.onended = () => { for (const [a, b] of v.links) try { a.disconnect(b); } catch (e) {} v.vca.disconnect(); const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); };
  }
  function unrelease(v){ v.vca.gain.cancelScheduledValues(v.end); v.end = Infinity; for (const {o} of v.osc) o.stop(v.t0 + 3600); for (const s of v.srcs) s.stop(v.t0 + 3600); }
  const synth = {
    P, voices, param,
    noteOn(n, vel = .8, t = now()){
      t = Math.max(t, now()); n += 12*Math.round(P.oct); const mode = Math.round(P.mode);
      if (mode > 0) {
        const live = voices.find(v => v.end === Infinity || v.end > t);
        if (live && mode === 2) { if (live.end !== Infinity) unrelease(live); live.retune(n, t); last = n; live.key = n; return; }
        for (const v of voices) release(v, t, true);
      } else { const live = voices.filter(v => v.end > t); if (live.length >= Math.round(P.voices)) release(live[0], t, true); }
      const v = voice(n, vel, t); v.key = n; voices.push(v); last = n;
    },
    noteOff(n, t = now()){ t = Math.max(t, now()); n += 12*Math.round(P.oct); for (const v of voices) if (v.key === n && v.end === Infinity) release(v, t); },
    play(n, t, len, vel = .8){ synth.noteOn(n, vel, t); synth.noteOff(n, t + len); },
    allOff(t = now()){ for (const v of voices) release(v, t, true); },
    set(k, v){ const q = PARAMS.find(x => x.key === k); if (q && q.list && typeof v === 'string') v = Math.max(0, q.list.indexOf(v)); P[k] = v;
      const m = MAP[k]; if (m) m[0].setTargetAtTime(m[1](v), now(), .01); if (k === 'drive') tone(); if (/^l1|^matrix$/.test(k)) lfoStart(); },
    load(p = {}){ Object.assign(P, resolve(PARAMS, p)); P.matrix = (p.matrix || []).map(m => [...m]); for (const k in MAP) MAP[k][0].value = MAP[k][1](P[k]); tone(); lfoStart(env.t0); },
    start(t0){ lfoStart(t0); },
  };
  synth.load({});
  return synth;
}
