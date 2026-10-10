// The analog synth: the Studio's virtual-analogue instrument for basses, plucks, stabs, leads and moving pads. Two oscillators
// (saw, square, pulse, triangle, sine), each up to seven unison voices detuned and spread across the stereo, a sub and noise;
// a driven 12 or 24 dB filter (low, high or band) with its own envelope, key tracking and velocity; an amp envelope; a third
// envelope and two LFOs (six shapes, free or in time) routed through a modulation matrix to cutoff, resonance, pitch, osc 2,
// pulse width, volume, pan or the filter envelope's depth. Poly, mono or legato (sliding without a new attack).
// The knobs that matter while a note sounds (cutoff, resonance, envelope depth, osc 2, pulse width, level, pan) are shared
// buses every voice reads, so automation and LFOs move held notes smoothly; the rest apply from the next note.
import { RATES, SHAPES, adsr, bus, gain, hold, hz, lfoHz, makeLfo, noiseBuf, resolve, rng, satCurve } from './vkit.js';

const WAVES = ['Saw', 'Square', 'Pulse', 'Triangle', 'Sine'], OT = ['sawtooth', 'square', 'sawtooth', 'triangle', 'sine'];
// what the matrix can move, and how far an amount of 1 moves it (cents, dB, gain, pan)
export const DESTS = {cut: ['Cutoff', 4800], res: ['Resonance', 18], pitch: ['Pitch', 1200], p2: ['Osc 2 pitch', 1200], pw: ['Pulse width', .45],
  amp: ['Volume', 1], pan: ['Pan', 1], mix2: ['Osc 2 level', 1], fenv: ['Filter env', 7200]};
export const SOURCES = {lfo1: 'LFO 1', lfo2: 'LFO 2', menv: 'Mod env', vel: 'Velocity', key: 'Key'};
const S = (key, label, min, max, def, unit, x = {}) => ({key, label, min, max, def, unit, ...x});
const L = (key, label, list, def) => ({key, label, list, def});
export const GROUPS = [
  ['Oscillators', [L('w1', 'Wave 1', WAVES, 0), L('w2', 'Wave 2', WAVES, 0), S('semi', 'Osc 2 pitch', -24, 24, 0, 'st', {step: 1}), S('fine', 'Osc 2 detune', 0, 50, 7, 'ct'),
    S('mix2', 'Osc 2', 0, 1, 0, '%'), S('uni', 'Unison', 1, 7, 1, '', {step: 1}), S('det', 'Detune', 0, 60, 14, 'ct'), S('spread', 'Spread', 0, 1, .6, '%'),
    S('pw', 'Pulse width', .05, .95, .5, '%'), S('sub', 'Sub', 0, 1, 0, '%'), L('subw', 'Sub wave', ['Sine', 'Square'], 0), L('subo', 'Sub octave', ['-1', '-2'], 0),
    S('noise', 'Noise', 0, 1, 0, '%'), S('drift', 'Drift', 0, 1, .3, '%'), S('tune', 'Tune', -24, 24, 0, 'st')]],
  ['Filter', [L('ft', 'Type', ['Low', 'High', 'Band'], 0), L('slope', 'Slope', ['12 dB', '24 dB'], 1), S('cut', 'Cutoff', 20, 20000, 2000, 'Hz', {log: true}),
    S('res', 'Resonance', 0, 1, .15, '%'), S('drive', 'Drive', 0, 1, 0, '%'), S('fenv', 'Env amount', -1, 1, .3, '%'), S('track', 'Key track', 0, 1, .5, '%'),
    S('fvel', 'Env velocity', 0, 1, .3, '%'), S('fa', 'Attack', .001, 8, .002, 's', {log: true}), S('fd', 'Decay', .005, 8, .3, 's', {log: true}),
    S('fs', 'Sustain', 0, 1, .2, '%'), S('fr', 'Release', .005, 10, .3, 's', {log: true})]],
  ['Amp', [S('aa', 'Attack', .001, 8, .002, 's', {log: true}), S('ad', 'Decay', .005, 8, .3, 's', {log: true}), S('as', 'Sustain', 0, 1, .8, '%'),
    S('ar', 'Release', .005, 10, .2, 's', {log: true}), S('vel', 'Velocity', 0, 1, .6, '%')]],
  ['Mod env', [S('ma', 'Attack', .001, 8, .002, 's', {log: true}), S('md', 'Decay', .005, 8, .4, 's', {log: true}), S('ms', 'Sustain', 0, 1, 0, '%'),
    S('mr', 'Release', .005, 10, .3, 's', {log: true})]],
  ['LFO 1', [L('l1', 'Shape', SHAPES, 0), L('l1t', 'Time', RATES, 0), S('l1r', 'Rate', .02, 30, 1, 'Hz', {log: true})]],
  ['LFO 2', [L('l2', 'Shape', SHAPES, 1), L('l2t', 'Time', RATES, 0), S('l2r', 'Rate', .02, 30, .3, 'Hz', {log: true})]],
  ['Play', [L('mode', 'Voices', ['Poly', 'Mono', 'Legato'], 0), S('voices', 'Polyphony', 1, 12, 8, '', {step: 1}), S('glide', 'Glide', 0, 1, .05, 's'),
    S('oct', 'Octave', -3, 3, 0, 'oct', {step: 1})]],
  ['Output', [S('level', 'Level', 0, 2, .8, '×'), S('pan', 'Pan', -1, 1, 0, 'pan')]]];
export const PARAMS = GROUPS.flatMap(g => g[1]);

// the presets: a few settings over the defaults, and a matrix of [source, destination, amount]
export const PRESETS = {
  // minimal techno's bass: a short saw and sub, the filter snapping shut, a touch of drive
  'Rolling bass': {w1: 'Saw', sub: .7, cut: 260, res: .25, fenv: .38, fd: .14, fs: 0, track: .4, drive: .35, aa: .002, ad: .22, as: .55, ar: .06, mode: 'Mono', glide: 0, level: 1.2},
  // a round, deep sub with a little growl on top
  'Sub bass': {w1: 'Sine', w2: 'Triangle', mix2: .25, semi: 12, sub: .3, cut: 900, fenv: 0, aa: .003, as: 1, ar: .08, mode: 'Mono', drive: .15, level: 1.2},
  // two detuned saws beating against each other, the filter breathing on an LFO in time
  'Reese': {w1: 'Saw', w2: 'Saw', mix2: 1, fine: 26, uni: 2, det: 9, spread: .25, sub: .5, cut: 520, res: .2, fenv: .1, drive: .3, mode: 'Legato', glide: .06,
    l1: 'Sine', l1t: '2 bars', matrix: [['lfo1', 'cut', .18]], level: .9},
  // the 303: one square, high resonance, the envelope's depth and accents doing the talking, slides in legato
  'Acid': {w1: 'Square', cut: 240, res: .74, fenv: .55, fd: .2, fs: 0, track: .25, fvel: .7, drive: .45, aa: .002, ad: .3, as: .7, ar: .05,
    mode: 'Legato', glide: .07, vel: .5, level: .9},
  // a short, bright pluck with a hint of pitch from the mod envelope
  'Pluck': {w1: 'Saw', w2: 'Pulse', mix2: .5, semi: 12, pw: .3, uni: 3, det: 10, cut: 700, res: .3, fenv: .6, fd: .16, fs: 0, fvel: .5, aa: .002, ad: .35, as: 0, ar: .25,
    ma: .001, md: .03, matrix: [['menv', 'pitch', .02]], level: .9},
  // a dub techno chord: filtered saws and a square, plucked short; made for a long delay and reverb
  'Dub chord': {w1: 'Saw', w2: 'Square', mix2: .6, fine: 9, uni: 2, det: 8, cut: 520, res: .35, fenv: .42, fd: .11, fs: 0, track: .3, aa: .003, ad: .22, as: 0, ar: .18,
    l1: 'Triangle', l1t: '4 bars', matrix: [['lfo1', 'cut', .12]], level: .9},
  // a stab: brighter and punchier, with velocity opening it
  'Stab': {w1: 'Saw', w2: 'Saw', mix2: .8, fine: 12, uni: 3, det: 12, cut: 1100, res: .25, fenv: .45, fd: .14, fs: .05, fvel: .8, aa: .002, ad: .2, as: .1, ar: .15, drive: .2, level: .85},
  // the supersaw pad: seven saws a side, slow in and out, the filter swelling over two bars and the PWM'd osc 2 shimmering
  'Supersaw pad': {w1: 'Saw', w2: 'Pulse', mix2: .35, semi: 12, uni: 7, det: 22, spread: 1, cut: 1400, res: .1, fenv: .12, fa: 1.5, fd: 2, fs: .6, fr: 2,
    aa: 1.2, ad: 1.5, as: .85, ar: 2.5, l1: 'Sine', l1t: '2 bars', l2: 'Triangle', l2r: .21, matrix: [['lfo1', 'cut', .14], ['lfo2', 'pw', .6]], level: .55},
  // a warm, darker pad: triangle and saw, slow sweep, gentle drift
  'Warm pad': {w1: 'Saw', w2: 'Triangle', mix2: .7, semi: -12, uni: 4, det: 16, spread: .9, cut: 800, res: .12, fenv: .15, fa: 2, fd: 3, fs: .5, fr: 3,
    aa: 1.8, ad: 2, as: .9, ar: 3, drift: .6, l1: 'Triangle', l1t: '4 bars', matrix: [['lfo1', 'cut', .2], ['lfo1', 'pan', .2]], level: .6},
  // a lead: saw and a fifth above, mono with glide, vibrato coming in from the mod envelope
  'Lead': {w1: 'Saw', w2: 'Square', mix2: .4, semi: 7, uni: 3, det: 12, cut: 2600, res: .2, fenv: .3, fd: .4, fs: .5, aa: .005, as: .9, ar: .3, mode: 'Legato', glide: .08,
    l1: 'Sine', l1r: 5.5, ma: .6, md: .5, ms: 1, matrix: [['lfo1', 'pitch', .012]], level: .7},
  // an arp's voice: square and saw, plucky, stereo
  'Arp': {w1: 'Pulse', w2: 'Saw', mix2: .5, pw: .35, fine: 10, uni: 2, det: 9, spread: .7, cut: 1200, res: .3, fenv: .45, fd: .12, fs: .1, fvel: .6, aa: .002, ad: .2, as: .2, ar: .2, level: 2},
  // noise swept up through a band: the riser before a drop (automate its cutoff)
  'Noise riser': {w1: 'Saw', noise: 1, sub: 0, mix2: 0, ft: 'Band', cut: 400, res: .2, fenv: 0, aa: .5, as: 1, ar: 1, level: 2},
};

export default {key: 'analog', label: 'Analog', words: 'subtractive synth with unison, a driven filter and a mod matrix', groups: GROUPS, params: PARAMS, presets: PRESETS,
  make: (ctx, out, env) => makeAnalog(ctx, out, env)};

// the synth on an audio context (the page's or an offline one) into `out`; env: {period() seconds a beat, t0 the song's start}
export function makeAnalog(ctx, out, env = {period: () => .5, t0: 0}){
  const P = resolve(PARAMS, {}); P.matrix = [];
  const R = rng(1234), NB = noiseBuf(ctx, 777);
  const B = {cut: bus(ctx, 0), res: bus(ctx, 0), pitch: bus(ctx, 0), p2: bus(ctx, 0), pw: bus(ctx, .5), mix2: bus(ctx, 0), fenv: bus(ctx, 0), amp: bus(ctx, 1), pan: bus(ctx, 0)};
  const sum = gain(ctx, 0), pan = ctx.createStereoPanner(), lvl = gain(ctx, P.level);
  B.amp.connect(sum.gain); B.pan.connect(pan.pan); sum.connect(pan); pan.connect(lvl); lvl.connect(out);
  const voices = []; let last = null, lfos = [], routes = [];
  const now = () => ctx.currentTime;
  const resDb = r => -5.3 + r*24;
  // the shared knobs: each a bus, and how a setting maps onto it
  const MAP = {cut: [B.cut.offset, v => 1200*Math.log2(Math.max(10, v)/1000)], res: [B.res.offset, resDb], pw: [B.pw.offset, v => v], mix2: [B.mix2.offset, v => v],
    fenv: [B.fenv.offset, v => v*7200], semi: [B.p2.offset, v => v*100 + P.fine/2], fine: [B.p2.offset, v => P.semi*100 + v/2], tune: [B.pitch.offset, v => v*100],
    level: [lvl.gain, v => v], pan: [B.pan.offset, v => v]};
  const param = k => MAP[k] ? {p: MAP[k][0], map: MAP[k][1]} : null;
  const setAll = () => { for (const k in MAP) MAP[k][0].value = MAP[k][1](P[k]); };

  // the LFOs, from the song's start, and the matrix's shared routes: LFO → depth → bus
  function lfoStart(t0){
    for (const l of lfos) l.stop(now()); for (const r of routes) r.disconnect();
    lfos = [1, 2].map(i => makeLfo(ctx, P['l' + i], lfoHz(P[`l${i}t`], P[`l${i}r`], env.period()), t0 == null ? now() : t0));
    routes = [];
    for (const [src, d, a] of P.matrix) { const i = src === 'lfo1' ? 0 : src === 'lfo2' ? 1 : -1; if (i < 0 || !DESTS[d]) continue;
      const g = gain(ctx, a*DESTS[d][1]); lfos[i].out.connect(g); g.connect(B[d].offset); routes.push(g); }
  }

  // one voice: oscillators → (drive) → filter → amp → the shared output
  function voice(note, vel, t){
    const f = hz(note), T = 1/f, k = 1 - P.vel + P.vel*vel, kf = 1 - P.fvel + P.fvel*vel, links = [], srcs = [];
    const link = (a, b) => { a.connect(b); links.push([a, b]); };
    const v = {note, t0: t, end: Infinity, osc: [], links, srcs};
    const mix = ctx.createGain(), pitchIn = gain(ctx, 1), det2 = gain(ctx, 1), pwIn = gain(ctx, T), m2In = gain(ctx, 1), cutIn = gain(ctx, 1);
    link(B.pitch, pitchIn); pitchIn.connect(det2); link(B.p2, det2); link(B.pw, pwIn); link(B.mix2, m2In);
    const early = () => Math.max(now(), t - R()*T);   // (each oscillator starts a random part of a cycle early: unison saws don't line up)
    const group = (w, dest, detIn, x0) => {
      const n = Math.max(1, Math.round(P.uni)), lv = .5/Math.sqrt(n);
      for (let i = 0; i < n; i++) {
        const x = n > 1 ? i/(n - 1)*2 - 1 : 0, o = ctx.createOscillator(); o.type = OT[w]; o.frequency.value = f;
        o.detune.value = x0 + x*P.det + (R() - .5)*P.drift*10; detIn.connect(o.detune);
        let src = o;
        if (w === 2) {   // pulse: the saw less itself a pulse-width later (the width a share of the cycle, so it can move)
          const d = ctx.createDelay(.2), inv = gain(ctx, -.5), s = gain(ctx, .5); pwIn.connect(d.delayTime); o.connect(d); d.connect(inv); o.connect(s); inv.connect(s); src = s; }
        const g = gain(ctx, lv); src.connect(g);
        const pn = n > 1 && P.spread > 0 ? ctx.createStereoPanner() : null;
        if (pn) { pn.pan.value = (i % 2 ? -1 : 1)*Math.abs(x)*P.spread; g.connect(pn); pn.connect(dest); } else g.connect(dest);
        o.start(early()); v.osc.push({o, mul: 1});
      }
    };
    group(Math.round(P.w1), mix, pitchIn, P.mix2 > 0 ? -P.fine/2 : 0);
    if (P.mix2 > 0 || P.matrix.some(m => m[1] === 'mix2')) { const g2 = gain(ctx, 0); m2In.connect(g2.gain); group(Math.round(P.w2), g2, det2, 0); g2.connect(mix); }
    if (P.sub > 0) { const mul = Math.round(P.subo) ? .25 : .5, o = ctx.createOscillator(); o.type = Math.round(P.subw) ? 'square' : 'sine'; o.frequency.value = f*mul;
      pitchIn.connect(o.detune); const g = gain(ctx, P.sub*(Math.round(P.subw) ? .35 : .6)); o.connect(g); g.connect(mix); o.start(early()); v.osc.push({o, mul}); }
    if (P.noise > 0) { const n = ctx.createBufferSource(); n.buffer = NB; n.loop = true; const g = gain(ctx, P.noise*.35); n.connect(g); g.connect(mix); n.start(t, R()*.9); v.osc.push({o: n}); }
    // glide: from the last note's pitch
    if (P.glide > 0 && last != null && last !== note) for (const {o, mul} of v.osc) if (mul) { o.frequency.setValueAtTime(hz(last)*mul, t); o.frequency.setTargetAtTime(f*mul, t, P.glide/3); }
    // drive into the filter
    let pre = mix;
    if (P.drive > .01) { const ws = ctx.createWaveShaper(), g = gain(ctx, 1 - P.drive*.4); ws.curve = satCurve(P.drive); ws.oversample = '2x'; mix.connect(ws); ws.connect(g); pre = g; }
    const ft = Math.round(P.ft), type = ['lowpass', 'highpass', 'bandpass'][ft], two = Math.round(P.slope) === 1, fl = [ctx.createBiquadFilter()];
    if (two) fl.push(ctx.createBiquadFilter());
    const kt = Math.pow(2, P.track*(note - 60)/12);
    fl.forEach((b, i) => { b.type = type; b.frequency.value = 1000*kt; cutIn.connect(b.detune);
      if (ft === 2) b.Q.value = .7 + P.res*(i ? 2 : 8); else if (i === 0) { b.Q.value = two ? 0 : 2.3; link(B.res, b.Q); } else b.Q.value = 2.3; });
    link(B.cut, cutIn);
    pre.connect(fl[0]); if (two) fl[0].connect(fl[1]);
    // the filter's envelope, its depth a shared bus (so automating the envelope works on held notes)
    const fe = ctx.createConstantSource(), fg = gain(ctx, 0); fe.offset.value = 0; adsr(fe.offset, t, P.fa, P.fd, P.fs, kf); fe.start(t); srcs.push(fe);
    link(B.fenv, fg.gain); fe.connect(fg); fg.connect(cutIn);
    const vca = gain(ctx, 0), pk = (.25 + .75*k)*.35; fl[fl.length - 1].connect(vca); adsr(vca.gain, t, P.aa, P.ad, P.as, pk);
    let tail = vca;
    // the matrix's per-voice sources: the mod envelope, velocity and key
    const dest = {cut: cutIn, res: fl[0].Q, pitch: pitchIn, p2: det2, pw: pwIn, mix2: m2In, fenv: fg.gain};
    const per = P.matrix.filter(m => (m[0] === 'menv' || m[0] === 'vel' || m[0] === 'key') && DESTS[m[1]]);
    if (per.some(m => m[1] === 'amp')) { const g = gain(ctx, 1); tail.connect(g); tail = g; dest.amp = g.gain; }
    if (per.some(m => m[1] === 'pan')) { const p = ctx.createStereoPanner(); tail.connect(p); tail = p; dest.pan = p.pan; }
    let me = null;
    for (const [src, d, a] of per) {
      let s;
      if (src === 'menv') { if (!me) { me = ctx.createConstantSource(); me.offset.value = 0; adsr(me.offset, t, P.ma, P.md, P.ms, 1); me.start(t); srcs.push(me); } s = me; }
      else { s = ctx.createConstantSource(); s.offset.value = src === 'vel' ? vel : (note - 60)/24; s.start(t); srcs.push(s); }
      const g = gain(ctx, a*DESTS[d][1]); s.connect(g); g.connect(dest[d]);
    }
    tail.connect(sum);
    Object.assign(v, {vca, fe, me, fl, kt, tail});
    v.retune = (n, at) => { for (const {o, mul} of v.osc) if (mul) P.glide > 0 ? o.frequency.setTargetAtTime(hz(n)*mul, at, P.glide/3) : o.frequency.setValueAtTime(hz(n)*mul, at); v.note = n; };
    return v;
  }
  // let a voice go: the envelopes to their releases, the sources stopped once it's silent and its links to the buses undone
  function release(v, t, fast){
    if (v.end <= t) return; if (v.end < Infinity) unrelease(v);
    v.end = t; const r = fast ? .008 : P.ar;
    hold(v.vca.gain, t); v.vca.gain.setTargetAtTime(0, t, r/4);
    hold(v.fe.offset, t); v.fe.offset.setTargetAtTime(0, t, (fast ? .008 : P.fr)/4);
    if (v.me) { hold(v.me.offset, t); v.me.offset.setTargetAtTime(0, t, (fast ? .008 : P.mr)/4); }
    const stop = t + r*2.2 + .03; for (const {o} of v.osc) o.stop(stop); for (const s of v.srcs) s.stop(stop);
    v.osc[0].o.onended = () => { for (const [a, b] of v.links) try { a.disconnect(b); } catch (e) {} v.tail.disconnect(); const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); };
  }
  function unrelease(v){ const at = v.end; for (const p of [v.vca.gain, v.fe.offset, v.me && v.me.offset]) if (p) p.cancelScheduledValues(at); v.end = Infinity; for (const {o} of v.osc) o.stop(at + 3600); for (const s of v.srcs) s.stop(at + 3600); }
  const synth = {
    P, voices,
    noteOn(n, vel = .8, t = now()){
      t = Math.max(t, now()); n += 12*Math.round(P.oct); const mode = Math.round(P.mode);
      if (mode > 0) {
        const live = voices.find(v => v.end === Infinity || v.end > t);
        // legato: an overlapping note slides the voice on, without a new attack
        if (live && mode === 2) { if (live.end !== Infinity) unrelease(live); live.retune(n, t); last = n; live.key = n; return; }
        for (const v of voices) release(v, t, true);
        const v = voice(n, vel, t); v.key = n; voices.push(v); last = n; return;
      }
      const live = voices.filter(v => v.end > t); if (live.length >= Math.round(P.voices)) release(live[0], t, true);
      const v = voice(n, vel, t); v.key = n; voices.push(v); last = n;
    },
    noteOff(n, t = now()){ t = Math.max(t, now()); n += 12*Math.round(P.oct); for (const v of voices) if (v.key === n && v.end === Infinity) release(v, t); },
    play(n, t, len, vel = .8){ synth.noteOn(n, vel, t); synth.noteOff(n, t + len); },
    allOff(t = now()){ for (const v of voices) release(v, t, true); },
    param,
    set(k, v){ const q = PARAMS.find(x => x.key === k); if (q && q.list && typeof v === 'string') v = Math.max(0, q.list.indexOf(v)); P[k] = v;
      const m = MAP[k]; if (m) m[0].setTargetAtTime(m[1](v), now(), .01);
      if (/^l[12]|^matrix$/.test(k)) lfoStart(); },
    load(p = {}){ Object.assign(P, resolve(PARAMS, p)); P.matrix = (p.matrix || []).map(m => [...m]); setAll(); lfoStart(env.t0); },
    // the song starting at t0: the LFOs restart there, so ones in time keep their phase to the bar
    start(t0){ lfoStart(t0); },
  };
  synth.load({});
  return synth;
}
