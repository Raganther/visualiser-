// The Moog: a Minimoog-style instrument for fat basses, leads, brass and smooth pads. Each voice is one AudioWorklet node
// running at twice the sample rate: three band-limited oscillators (triangle, saw, square, wide and narrow pulse) with their
// own footage and detune and a slow analog drift, noise, a mixer driven hot into a four-pole ladder filter (zero-delay
// feedback, tanh saturation, resonance up to self-oscillation, a little of the bass the ladder loses given back), RC-curved
// contours for the filter and the amp, glide, vibrato and an LFO on the cutoff; then an ensemble chorus for width. Every knob is
// an audio parameter, so automation and the Studio's modulators move it smoothly. Where worklets aren't allowed it falls back
// to the analog synth with the nearest settings.
import { SHAPES, RATES, gain, hz, lfoHz, resolve } from './vkit.js';
import { makeAnalog } from './analog.js';
import chorusFx from '../fx/chorus.js';

const WAVES = ['Triangle', 'Saw', 'Square', 'Wide pulse', 'Narrow pulse'];
const S = (key, label, min, max, def, unit, x = {}) => ({key, label, min, max, def, unit, ...x});
const L = (key, label, list, def) => ({key, label, list, def});
export const GROUPS = [
  ['Oscillators', [L('w1', 'Osc 1', WAVES, 1), S('o1', 'Osc 1 range', -24, 24, 0, 'st', {step: 12}), S('l1', 'Osc 1 level', 0, 1, 1, '%'),
    L('w2', 'Osc 2', WAVES, 1), S('o2', 'Osc 2 range', -24, 24, 0, 'st', {step: 1}), S('d2', 'Osc 2 detune', -50, 50, 6, 'ct'), S('l2', 'Osc 2 level', 0, 1, .8, '%'),
    L('w3', 'Osc 3', WAVES, 2), S('o3', 'Osc 3 range', -24, 24, -12, 'st', {step: 1}), S('d3', 'Osc 3 detune', -50, 50, -4, 'ct'), S('l3', 'Osc 3 level', 0, 1, .5, '%'),
    S('noise', 'Noise', 0, 1, 0, '%'), S('drift', 'Drift', 0, 1, .35, '%')]],
  ['Filter', [S('cut', 'Cutoff', 30, 18000, 900, 'Hz', {log: true}), S('res', 'Emphasis', 0, 1.1, .25, '%'), S('drive', 'Mixer drive', 0, 1, .45, '%'),
    S('cenv', 'Contour', 0, 6, 2.5, 'oct'), S('kbd', 'Key track', 0, 1, .4, '%'), S('vfilt', 'Velocity', 0, 1, .5, '%'),
    S('fa', 'Attack', .001, 6, .004, 's', {log: true}), S('fd', 'Decay', .005, 8, .35, 's', {log: true}), S('fs', 'Sustain', 0, 1, .25, '%'), S('fr', 'Release', .005, 8, .2, 's', {log: true})]],
  ['Loudness', [S('aa', 'Attack', .001, 6, .003, 's', {log: true}), S('ad', 'Decay', .005, 8, .5, 's', {log: true}), S('as', 'Sustain', 0, 1, .85, '%'),
    S('ar', 'Release', .005, 8, .15, 's', {log: true}), S('vamp', 'Velocity', 0, 1, .4, '%')]],
  ['Modulation', [S('glide', 'Glide', 0, 1, 0, 's'), L('lshape', 'LFO', SHAPES.slice(0, 2), 1), L('lsync', 'LFO time', RATES, 0), S('lrate', 'LFO rate', .05, 20, 5, 'Hz', {log: true}),
    S('vib', 'Vibrato', 0, 50, 0, 'ct'), S('lcut', 'LFO to cutoff', 0, 2, 0, 'oct')]],
  ['Output', [L('voices', 'Voices', ['Mono', '2', '3', '4', '6'], 0), S('ens', 'Ensemble', 0, 1, .15, '%'), S('level', 'Level', 0, 2, .8, '×'), S('tune', 'Tune', -24, 24, 0, 'st')]]];
export const PARAMS = GROUPS.flatMap(g => g[1]);
const NVOICES = [1, 2, 3, 4, 6];

export const PRESETS = {
  // the classic: two saws a few cents apart and a square an octave down, the mixer pushed, the contour snapping shut
  'Fat bass': {w1: 'Saw', w2: 'Saw', d2: 7, w3: 'Square', o3: -12, l3: .6, cut: 320, res: .28, drive: .6, cenv: 3.2, fd: .22, fs: .15, kbd: .3, aa: .002, ad: .4, as: .8, ar: .07, level: 1},
  // a round sub under everything: triangle and a soft saw, the filter low, no squelch
  'Taurus sub': {w1: 'Triangle', w2: 'Saw', o2: -12, l2: .35, d2: 3, l3: 0, cut: 220, res: .1, drive: .3, cenv: 1.2, fd: .4, fs: .4, kbd: .2, aa: .004, as: 1, ar: .12, level: 1.3},
  // a rubbery plucked bass for rolling lines: square and saw, short contour, a little emphasis
  'Rubber bass': {w1: 'Square', w2: 'Saw', d2: -5, l2: .7, w3: 'Triangle', o3: -12, l3: .5, cut: 260, res: .45, drive: .5, cenv: 3.8, fd: .14, fs: 0, vfilt: .7, aa: .002, ad: .3, as: .5, ar: .06, level: 1},
  // the lead: three saws, the third an octave up, glide, vibrato, the emphasis singing
  'Lead': {w1: 'Saw', w2: 'Saw', d2: 6, w3: 'Saw', o3: 12, d3: -5, l3: .45, cut: 1500, res: .4, drive: .55, cenv: 2.2, fd: .6, fs: .5, kbd: .6, glide: .07, vib: 7, lrate: 5.5, aa: .01, as: .9, ar: .3, level: .8},
  // brass: the contour's attack is slower than the amp's, so each note blooms open
  'Brass': {w1: 'Saw', w2: 'Saw', d2: 9, w3: 'Wide pulse', l3: .4, cut: 700, res: .15, drive: .5, cenv: 2.8, fa: .09, fd: .7, fs: .55, aa: .03, ad: .8, as: .85, ar: .25, vfilt: .6, voices: '4', ens: .35, level: .75},
  // a smooth pad: four voices, detuned saws and a triangle, slow in and out, the ensemble wide, the LFO breathing the cutoff
  'Velvet pad': {w1: 'Saw', w2: 'Saw', d2: 11, w3: 'Triangle', o3: 12, l3: .4, cut: 900, res: .18, drive: .25, cenv: 1, fa: 1.5, fd: 2.5, fs: .7, fr: 2, aa: 1.1, ad: 2, as: .9, ar: 2.2,
    lshape: 'Triangle', lsync: '4 bars', lcut: .5, voices: '4', ens: .8, drift: .6, level: .7},
  // a textured drone: saws over noise through a ringing filter, slowly swept
  'Texture': {w1: 'Saw', w2: 'Narrow pulse', o2: 7, d2: 4, l2: .5, w3: 'Saw', o3: -12, l3: .5, noise: .35, cut: 600, res: .72, drive: .7, cenv: .8, fa: 2, fd: 3, fs: .6, aa: 1.5, as: 1, ar: 2.5,
    lshape: 'Triangle', lsync: '2 bars', lcut: .9, voices: '3', ens: .6, drift: .8, level: .65},
  // the emphasis near self-oscillation: a whistling, squelching sweep for acid-like lines
  'Squelch': {w1: 'Saw', w2: 'Square', o2: -12, l2: .5, l3: 0, cut: 240, res: .92, drive: .65, cenv: 4.2, fd: .18, fs: .05, vfilt: .9, kbd: .3, glide: .05, aa: .002, ad: .3, as: .7, ar: .05, level: .75},
};

/* ---------- the voice: DSP on the audio thread ---------- */
const DSP = `
const th = x => x > 3 ? 1 : x < -3 ? -1 : x*(27 + x*x)/(27 + 9*x*x);   // (tanh, close enough and quick)
const blep = (t, dt) => { if (t < dt) { t /= dt; return t + t - t*t - 1; } if (t > 1 - dt) { t = (t - 1)/dt; return t*t + t + t + 1; } return 0; };
const K = ['w1','o1','l1','w2','o2','d2','l2','w3','o3','d3','l3','noise','drift','res','drive','cenv','kbd','vfilt','fa','fd','fs','fr','aa','ad','as','ar','vamp','glide','lshape','lrate','vib','lcut','level','tune'];
const HB = [-0.0322, 0, 0.2822, 0.5, 0.2822, 0, -0.0322];
class Moog extends AudioWorkletProcessor {
  static get parameterDescriptors(){
    return [{name: 'gate', defaultValue: 0}, {name: 'trig', defaultValue: 0}, {name: 'note', defaultValue: 48}, {name: 'vel', defaultValue: .8},
      {name: 'cut', defaultValue: 900, minValue: 10, maxValue: 22000}, ...K.map(n => ({name: n, defaultValue: 0, automationRate: 'k-rate'}))];
  }
  constructor(){
    super(); this.ph = [Math.random(), Math.random(), Math.random()]; this.dr = [0, 0, 0]; this.pc = -1; this.fe = 0; this.ae = 0; this.st = 0; this.lt = 0; this.lg = 0;
    this.s = [0, 0, 0, 0]; this.lp = 0; this.hb = new Float32Array(7); this.fx = new Float64Array(3); this.x1 = 0; this.y1 = 0; this.seed = (Math.random()*4294967296) >>> 0; this.idle = 0;
  }
  rnd(){ this.seed = (this.seed*1664525 + 1013904223) >>> 0; return this.seed/2147483648 - 1; }
  process(ins, outs, P){
    const out = outs[0][0], fs = sampleRate, F = 2*fs, n = out.length, v = k => P[k][0], a = (k, i) => P[k].length > 1 ? P[k][i] : P[k][0];
    const W = [v('w1'), v('w2'), v('w3')].map(Math.round), O = [v('o1'), v('o2'), v('o3')], D = [0, v('d2'), v('d3')], LV = [v('l1'), v('l2'), v('l3')];
    const tc = t => 1 - Math.exp(-1/(Math.max(.0005, t)*fs)), atk = tc(v('aa')/2.2), dec = tc(v('ad')/4.6), rel = tc(v('ar')/4.6), fat = tc(v('fa')/2.2), fdc = tc(v('fd')/4.6), frl = tc(v('fr')/4.6);
    const sus = v('as'), fsus = v('fs'), res = v('res'), k4 = res*4.1, drive = .6 + v('drive')*3.4, cenv = v('cenv'), kbd = v('kbd'), noise = v('noise'), level = v('level');
    const glide = v('glide'), gc = glide > 0 ? 1 - Math.exp(-1/(glide*fs/3)) : 1, lr = v('lrate'), vib = v('vib'), lcut = v('lcut'), tune = v('tune'), tri = Math.round(v('lshape')) === 1;
    // (each oscillator drifts slowly, a random walk a few cents wide)
    const dm = v('drift')*7; for (let j = 0; j < 3; j++) this.dr[j] = this.dr[j]*.995 + this.rnd()*dm*.06;
    const quiet = this.ae < 1e-5 && P.gate.length === 1 && P.gate[0] < .5 && P.trig.length === 1 && P.trig[0] === this.lt;
    if (quiet) { out.fill(0); this.lg = P.gate[0]; return true; }   // (a voice at rest costs nothing)
    for (let i = 0; i < n; i++) {
      const g = a('gate', i), tr = a('trig', i), note = a('note', i), vel = a('vel', i);
      // the contours: struck again on a new trigger or a rising gate (from where they are, so no click), let go on a falling gate
      if ((g > .5 && this.lg <= .5) || (g > .5 && tr !== this.lt)) this.st = 1; else if (g <= .5 && this.lg > .5) this.st = 3;
      this.lg = g; this.lt = tr;
      if (this.st === 1) { this.ae += (1.3 - this.ae)*atk; this.fe += (1.3 - this.fe)*fat; if (this.ae >= 1) { this.ae = 1; this.st = 2; } }
      else if (this.st === 2) { this.ae += (sus - this.ae)*dec; this.fe += (fsus - this.fe)*fdc; }
      else { this.ae -= this.ae*rel; this.fe -= this.fe*frl; }
      if (this.st === 1 && this.fe > 1) this.fe = 1;
      // the pitch, gliding in semitones; the LFO
      if (this.pc < 0) this.pc = note; this.pc += (note - this.pc)*gc;
      this.lp = (this.lp + lr/fs) % 1; const lfo = tri ? 1 - 4*Math.abs(this.lp - .5) : Math.sin(2*Math.PI*this.lp);
      const semi = this.pc + tune + vib*lfo/100 - 69, fsx = this.fx;
      for (let j = 0; j < 3; j++) fsx[j] = (440*Math.pow(2, (semi + O[j] + (D[j] + this.dr[j])/100)/12));
      // the cutoff: the knob, the key, the contour (by velocity), the LFO; its coefficients once a sample
      const vf = 1 - v('vfilt') + v('vfilt')*vel, fc = Math.min(F*.45, Math.max(15, a('cut', i)*Math.pow(2, kbd*(this.pc - 60)/12 + cenv*this.fe*vf + lcut*lfo)));
      const gg = Math.tan(Math.PI*fc/F), G = gg/(1 + gg), B = 1/(1 + gg), G2 = G*G, G3 = G2*G, G4 = G3*G;
      let o = 0;
      for (let ov = 0; ov < 2; ov++) {
        // three band-limited oscillators and noise, mixed hot
        let m = 0;
        for (let j = 0; j < 3; j++) { if (LV[j] <= 0) continue; const dt = fsx[j]/F; let p = this.ph[j] += dt; if (p >= 1) p = this.ph[j] -= 1; let s;
          const w = W[j];
          if (w === 0) s = 1 - 4*Math.abs(p - .5);
          else if (w === 1) s = 2*p - 1 - blep(p, dt);
          else { const pw = w === 2 ? .5 : w === 3 ? .3 : .12; s = p < pw ? 1 : -1; s += blep(p, dt) - blep((p - pw + 1) % 1, dt); }
          m += s*LV[j]; }
        if (noise > 0) m += this.rnd()*noise;
        const x = m*drive*.35;
        // the ladder: four one-pole stages solved together with their feedback (zero delay), the input saturating
        const S = G3*B*this.s[0] + G2*B*this.s[1] + G*B*this.s[2] + B*this.s[3];
        const y4 = (G4*x + S)/(1 + k4*G4);
        let u = th(x - k4*y4);
        for (let j = 0; j < 4; j++) { const vv = (u - this.s[j])*G, y = vv + this.s[j]; this.s[j] = y + vv; u = j === 0 ? th(y) : y; }
        const y = u*(1 + res*.6);   // (the bass a ladder loses as the emphasis rises, given back in part)
        // halfband down to the sample rate
        const hb = this.hb; hb.copyWithin(0, 1); hb[6] = y;
        if (ov === 1) for (let t = 0; t < 7; t++) o += HB[t]*hb[t];
      }
      // (DC out: pulse waves and the saturation's lean leave an offset that would only spend headroom)
      const dc = o - this.x1 + .9986*this.y1; this.x1 = o; this.y1 = dc;
      out[i] = dc*this.ae*(1 - v('vamp') + v('vamp')*vel)*level*.5;
    }
    return true;
  }
}
registerProcessor('ag-moog', Moog);`;

// the worklet's module, once per context (a Blob URL: the page has no other files to load it from); OK says whether it loaded
const READY = new WeakMap(), OK = new WeakMap();
export function prepare(ctx){
  if (!READY.has(ctx)) READY.set(ctx, (async () => {
    let ok = false;
    try { if (ctx.audioWorklet) { const url = URL.createObjectURL(new Blob([DSP], {type: 'text/javascript'})); await ctx.audioWorklet.addModule(url); URL.revokeObjectURL(url); ok = true; } } catch (e) {}
    OK.set(ctx, ok); return ok;
  })());
  return READY.get(ctx);
}

export default {key: 'moog', label: 'Moog', words: 'three oscillators into a saturating ladder filter: fat basses, leads, brass, pads',
  groups: GROUPS, params: PARAMS, presets: PRESETS, prepare,
  make: (ctx, out, env) => OK.get(ctx) ? makeMoog(ctx, out, env) : fallback(ctx, out, env)};

export function makeMoog(ctx, out, env = {period: () => .5, t0: 0}){
  const P = resolve(PARAMS, {});
  const sum = gain(ctx, 1), cho = chorusFx.make(ctx, env), lvl = gain(ctx, 1);
  sum.connect(cho.input); cho.output.connect(lvl); lvl.connect(out); cho.set('rate', .5); cho.set('depth', .7);
  let nodes = [], pool = [], trig = 0;
  const now = () => ctx.currentTime;
  const make = () => { const n = new AudioWorkletNode(ctx, 'ag-moog', {numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1]}); n.connect(sum); return {n, end: -1, t0: -1, note: null}; };
  const prm = (k, i) => nodes[i].n.parameters.get(k);
  const apply = (t = now()) => {
    for (let i = 0; i < nodes.length; i++) for (const q of PARAMS) { if (q.key === 'voices' || q.key === 'ens' || q.key === 'lsync') continue; const p = prm(q.key, i); if (p) p.setValueAtTime(q.key === 'lrate' ? lfoRate() : P[q.key], t); }
    cho.set('mix', P.ens*.8);
  };
  const lfoRate = () => lfoHz(P.lsync, P.lrate, env.period());
  const voices = () => { const want = NVOICES[Math.round(P.voices)] || 1; while (nodes.length < want) nodes.push(make()); pool = nodes.slice(0, want); };
  const synth = {
    P, voices: nodes,
    play(note, t, len, vel = .8){
      t = Math.max(t, now()); note += 0;
      voices();
      // mono: one voice, legato when the last note still holds (a slide); poly: a free voice, or the one that started first
      let V = pool.length === 1 ? pool[0] : pool.find(x => x.end <= t) || pool.reduce((a, b) => a.t0 < b.t0 ? a : b);
      const i = nodes.indexOf(V), gate = prm('gate', i), legato = pool.length === 1 && V.end > t;
      gate.cancelScheduledValues(t); gate.setValueAtTime(1, t);
      prm('note', i).setValueAtTime(note, t); prm('vel', i).setValueAtTime(vel, t);
      if (!legato) prm('trig', i).setValueAtTime(++trig, t);
      gate.setValueAtTime(0, t + len); V.end = t + len; V.t0 = t; V.note = note;
    },
    noteOn(n, vel = .8, t = now()){ synth.play(n, t, 3600, vel); },
    noteOff(n, t = now()){ for (let i = 0; i < nodes.length; i++) if (nodes[i].note === n && nodes[i].end > t) { const g = prm('gate', i); g.cancelScheduledValues(t); g.setValueAtTime(0, t); nodes[i].end = t; } },
    allOff(t = now()){ for (let i = 0; i < nodes.length; i++) { const g = prm('gate', i); g.cancelScheduledValues(t); g.setValueAtTime(0, t); nodes[i].end = t; } },
    // every knob is an audio parameter on every voice
    param(k){ if (!PARAMS.some(q => q.key === k) || ['voices', 'ens', 'lsync', 'lshape'].includes(k)) return null; voices(); return {ps: nodes.map((_, i) => prm(k, i)), map: v => v}; },
    set(k, v){ const q = PARAMS.find(x => x.key === k); if (q && q.list && typeof v === 'string') v = Math.max(0, q.list.indexOf(v)); P[k] = v; voices(); apply(); },
    load(p = {}){ Object.assign(P, resolve(PARAMS, p)); voices(); apply(0); },
    start(){},
  };
  synth.load({});
  return synth;
}

// without worklets: the analog synth, set as near as it can be (two of the three oscillators, its 24 dB filter, its drive)
function fallback(ctx, out, env){
  const A = makeAnalog(ctx, out, env), P = resolve(PARAMS, {}), W2 = ['Triangle', 'Saw', 'Square', 'Pulse', 'Pulse'];
  const map = () => ({w1: W2[Math.round(P.w1)], w2: W2[Math.round(P.w2)], semi: P.o2 - P.o1, fine: Math.abs(P.d2), mix2: P.l2, sub: P.l3 > 0 && P.o3 <= -12 ? P.l3*.8 : 0,
    noise: P.noise, cut: P.cut, res: Math.min(.95, P.res*.8), drive: P.drive, fenv: Math.min(1, P.cenv/6), track: P.kbd, fvel: P.vfilt, fa: P.fa, fd: P.fd, fs: P.fs, fr: P.fr,
    aa: P.aa, ad: P.ad, as: P.as, ar: P.ar, vel: P.vamp, glide: P.glide, mode: Math.round(P.voices) ? 'Poly' : 'Legato', para: Math.round(P.voices) ? 'Shared' : 'Each voice',
    oct: Math.round(P.o1/12), level: P.level*1.2, l1: 'Triangle', l1t: P.lsync, l1r: P.lrate, matrix: [...(P.vib ? [['lfo1', 'pitch', P.vib/1200]] : []), ...(P.lcut ? [['lfo1', 'cut', P.lcut/4]] : [])]});
  return {...A, P, fallback: true, param: k => k === 'cut' ? A.param('cut') : k === 'level' ? A.param('level') : null,
    set(k, v){ const q = PARAMS.find(x => x.key === k); if (q && q.list && typeof v === 'string') v = Math.max(0, q.list.indexOf(v)); P[k] = v; A.load(map()); },
    load(p = {}){ Object.assign(P, resolve(PARAMS, p)); A.load(map()); }};
}
