// The analog synth: a polyphonic synthesizer built from the ground up, the way analog circuits behave, computed sample by
// sample (a leaf module: plain maths, no audio nodes, so it runs in an AudioWorklet, offline and in node alike).
// Each of its eight voices is a "voice card": two oscillators (saw, pulse, triangle, sine; band-limited, the corners and
// jumps smoothed by polyBLEP and polyBLAMP, a hard sync and cross-modulation between them), a sub-oscillator an octave or
// two down, noise and a ring modulator, mixed and driven into the filter (a four-pole ladder whose loop saturates as it
// resonates, self-oscillating at the top; or a state-variable filter, low, band, high or notch, run at twice the rate),
// envelopes that charge and discharge like capacitors (the attack aims past full, the decay and release fall
// exponentially), and the VCA. Each voice card is a little different from the others and drifts as it plays (Analog).
// One LFO for all (with a delay before it comes in on each note), glide, poly, mono, legato and unison; then a chorus
// in the manner of a bucket-brigade one, a tape echo and a gentle ceiling.
// new AnalogSynth(sr) → load(params), set(params), on(id, note, vel), off(id), bend(v), wheel(v), stop(),
// render(L, R, a, b) adding into L and R. A note sounds in the voice it was given until it's let go.

import { Chain, CHORUS, ECHO, ECHO_BEATS } from '../parts/procs.js';

const TAU = 2*Math.PI, C = (v, a, b) => v < a ? a : v > b ? b : v, hz = n => 440*Math.pow(2, (n - 69)/12);
const th = x => x < -3 ? -1 : x > 3 ? 1 : x*(27 + x*x)/(27 + 9*x*x);   // (tanh, near enough and cheap)

// the settings, in the panel's groups: {key, label, min, max, def, unit, log?, list?}
const L = (key, label, list, def = 0) => ({key, label, min: 0, max: list.length - 1, def, list});
export const WAVES = ['Saw', 'Pulse', 'Triangle', 'Sine'];
export const FILTERS = ['Ladder 24 dB', 'Ladder 12 dB', 'State variable low', 'State variable band', 'State variable high', 'Notch'];
export const LFO_SHAPES = ['Triangle', 'Sine', 'Saw down', 'Square', 'Sample and hold', 'Smooth random'];
export const SYNCS = ['Free', '1 bar', '1/2', '1/4', '1/8', '1/16', '1/4 dotted', '1/8 triplet'];
export const SYNC_BEATS = [0, 4, 2, 1, .5, .25, 1.5, 1/3];
export const MODES = ['Poly', 'Mono', 'Legato', 'Unison'];
export { CHORUS, ECHO, ECHO_BEATS };
export const PARAMS = [
  ['Oscillator 1', [L('w1', 'Wave', WAVES), {key: 'oct1', label: 'Octave', min: -2, max: 2, def: 0, unit: 'oct'}, {key: 'pw1', label: 'Pulse width', min: .05, max: .95, def: .5, unit: '%'}]],
  ['Oscillator 2', [L('w2', 'Wave', WAVES), {key: 'oct2', label: 'Octave', min: -2, max: 2, def: 0, unit: 'oct'}, {key: 'semi2', label: 'Semitones', min: -12, max: 12, def: 0, unit: 'st'},
    {key: 'fine2', label: 'Detune', min: -50, max: 50, def: 7, unit: 'ct'}, {key: 'pw2', label: 'Pulse width', min: .05, max: .95, def: .5, unit: '%'},
    L('sync', 'Hard sync', ['Off', 'On']), {key: 'xmod', label: 'Cross mod', min: 0, max: 1, def: 0, unit: '%'}]],
  ['Mixer', [{key: 'l1', label: 'Osc 1', min: 0, max: 1, def: .8, unit: '%'}, {key: 'l2', label: 'Osc 2', min: 0, max: 1, def: .6, unit: '%'},
    {key: 'lsub', label: 'Sub', min: 0, max: 1, def: 0, unit: '%'}, L('subo', 'Sub octave', ['−1', '−2']), {key: 'lnoise', label: 'Noise', min: 0, max: 1, def: 0, unit: '%'},
    {key: 'lring', label: 'Ring mod', min: 0, max: 1, def: 0, unit: '%'}, {key: 'drive', label: 'Drive', min: 0, max: 1, def: .2, unit: '%'}]],
  ['Filter', [L('ftype', 'Type', FILTERS), {key: 'cut', label: 'Cutoff', min: 30, max: 18000, def: 1800, unit: 'Hz', log: true}, {key: 'res', label: 'Resonance', min: 0, max: 1, def: .2, unit: '%'},
    {key: 'fenv', label: 'Envelope', min: -1, max: 1, def: .4, unit: '±'}, {key: 'fkey', label: 'Key track', min: 0, max: 1, def: .5, unit: '%'},
    {key: 'fvel', label: 'Velocity', min: 0, max: 1, def: .3, unit: '%'}, {key: 'hpf', label: 'High-pass', min: 10, max: 2000, def: 10, unit: 'Hz', log: true}]],
  ['Filter envelope', [{key: 'fa', label: 'Attack', min: .001, max: 8, def: .005, unit: 's', log: true}, {key: 'fd', label: 'Decay', min: .005, max: 10, def: .4, unit: 's', log: true},
    {key: 'fs', label: 'Sustain', min: 0, max: 1, def: .3, unit: '%'}, {key: 'fr', label: 'Release', min: .005, max: 12, def: .4, unit: 's', log: true}]],
  ['Amp envelope', [{key: 'aa', label: 'Attack', min: .001, max: 8, def: .003, unit: 's', log: true}, {key: 'ad', label: 'Decay', min: .005, max: 10, def: .5, unit: 's', log: true},
    {key: 'as', label: 'Sustain', min: 0, max: 1, def: .8, unit: '%'}, {key: 'ar', label: 'Release', min: .005, max: 12, def: .35, unit: 's', log: true},
    {key: 'avel', label: 'Velocity', min: 0, max: 1, def: .5, unit: '%'}]],
  ['Modulation', [L('lshape', 'LFO shape', LFO_SHAPES), {key: 'lrate', label: 'LFO rate', min: .05, max: 30, def: 4, unit: 'Hz', log: true}, L('lsync', 'LFO sync', SYNCS),
    {key: 'ldelay', label: 'LFO delay', min: 0, max: 4, def: 0, unit: 's'}, {key: 'lpitch', label: 'LFO → pitch', min: 0, max: 12, def: 0, unit: 'st', pow: 3},
    {key: 'lpwm', label: 'LFO → pulse width', min: 0, max: .45, def: 0, unit: '%'}, {key: 'lcut', label: 'LFO → cutoff', min: 0, max: 4, def: 0, unit: 'oct'},
    {key: 'lamp', label: 'LFO → volume', min: 0, max: 1, def: 0, unit: '%'}, {key: 'epitch', label: 'Filter env → pitch', min: -24, max: 24, def: 0, unit: 'st'},
    L('etgt', 'Pitch env to', ['Both oscillators', 'Oscillator 2'])]],
  ['Voices', [L('mode', 'Mode', MODES), {key: 'uni', label: 'Unison voices', min: 2, max: 8, def: 4, unit: '#'}, {key: 'udet', label: 'Unison detune', min: 0, max: 1, def: .3, unit: '%'},
    {key: 'glide', label: 'Glide', min: 0, max: 1.5, def: 0, unit: 's', pow: 2}, {key: 'spread', label: 'Stereo spread', min: 0, max: 1, def: .4, unit: '%'},
    {key: 'slop', label: 'Analog', min: 0, max: 1, def: .4, unit: '%'}, {key: 'oct', label: 'Octave', min: -2, max: 2, def: 0, unit: 'oct'}, {key: 'brange', label: 'Bend range', min: 1, max: 12, def: 2, unit: 'st'}]],
  ['Output', [L('chorus', 'Chorus', CHORUS), L('etime', 'Echo time', ECHO, 1), {key: 'emix', label: 'Echo', min: 0, max: 1, def: 0, unit: '%'}, {key: 'efb', label: 'Echo feedback', min: 0, max: .92, def: .4, unit: '%'},
    {key: 'etone', label: 'Echo tone', min: 0, max: 1, def: .5, unit: '%'}, {key: 'vdrive', label: 'Saturation', min: 0, max: 1, def: .15, unit: '%'}, {key: 'level', label: 'Level', min: 0, max: 1, def: .6, unit: '%'}]],
];
export const PLIST = PARAMS.flatMap(g => g[1]);
export const DEF = Object.fromEntries(PLIST.map(p => [p.key, p.def]));

/* ---------- the oscillators: a phase, band-limited by correcting the sample before and the sample after each corner ---------- */
// (the output runs a sample late, so a jump between two samples can smooth both: polyBLEP for jumps, polyBLAMP for kinks)
const val = (w, t, pw) => w === 0 ? 2*t - 1 : w === 1 ? (t < pw ? 1 : -1) : w === 2 ? (t < .5 ? 4*t - 1 : 3 - 4*t) : Math.sin(TAU*t);
// a jump of h, d samples before the sample being made: the residuals for the last sample and this one
const jump = (o, h, d) => { o.prev += h*.5*d*d; o.cur -= h*.5*(1 - d)*(1 - d); };
const kink = (o, m, d) => { o.prev += m*d*d*d/6; o.cur += m*(1 - d)*(1 - d)*(1 - d)/6; };
// the corners a wave passes between phase a and b (b may be past 1): each with its jump or kink, d samples before the end
function corners(o, w, a, b, dt, pw, stop = 1){
  const ev = [];
  if (w === 0) { if (b >= 1 && stop >= 1) ev.push([1, 'j', -2]); }
  else if (w === 1) { if (a < pw && b >= pw) ev.push([pw, 'j', -2]); if (b >= 1 && stop >= 1) ev.push([1, 'j', 2]); if (b >= 1 + pw && stop >= 1) ev.push([1 + pw, 'j', -2]); }
  else if (w === 2) { if (a < .5 && b >= .5) ev.push([.5, 'k', -8*dt]); if (b >= 1 && stop >= 1) ev.push([1, 'k', 8*dt]); if (b >= 1.5 && stop >= 1) ev.push([1.5, 'k', -8*dt]); }
  for (const [p, k, h] of ev) { const d = (b - p)/dt; k === 'j' ? jump(o, h, d) : kink(o, h, d); }
}
const osc = () => ({t: 0, prev: 0, cur: 0});
// one sample of an oscillator stepping dt, its last sample out; sync: the fraction of the sample since the master wrapped
function step(o, w, dt, pw, sync = -1){
  const a = o.t; let b = a + dt;
  o.cur = 0;
  if (sync >= 0) {
    // a hard reset part way through the sample: the corners before it, then the jump back to the start
    const e = a + dt*(1 - sync); corners(o, w, a, e, dt, pw); const pe = e % 1, before = val(w, pe, pw);
    o.t = sync*dt; const after = val(w, 0, pw); jump(o, after - before, sync);
    if (w === 2) kink(o, 4*dt - (pe < .5 ? 4*dt : -4*dt), sync);
    o.cur += val(w, o.t, pw);
  } else { corners(o, w, a, b, dt, pw); o.t = b % 1; o.cur += val(w, o.t, pw); }
  const out = o.prev; o.prev = o.cur; return out;
}

/* ---------- the filters: a ladder with its loop saturating, or a state-variable filter; each run twice a sample ---------- */
function ladder(f, x, g, k, two){ const G = g/(1 + g), s = f.s, G2 = G*G, G4 = G2*G2;
  for (let r = 0; r < 2; r++) {
    // the loop solved for its input with the stages as they are (zero delay), then saturated as a real loop is
    const S = G2*G*s[0]*(1 - G) + G2*s[1]*(1 - G) + G*s[2]*(1 - G) + s[3]*(1 - G);
    const kk = two ? k*.5 : k, Gl = two ? G2 : G4, Sl = two ? G*s[0]*(1 - G) + s[1]*(1 - G) : S;
    const u = th((x*(1 + kk*.45) - kk*Sl)/(1 + kk*Gl));
    let y = u; for (let i = 0; i < 4; i++) { const v = (y - s[i])*G, o = v + s[i]; s[i] = o + v; y = o; if (two && i === 1) { f.y2 = o; } }
    f.o[r] = two ? f.y2 : y; }
  return (f.o[0] + f.o[1])*.5; }
function svf(f, x, g, R, type){ const k = 2 - 1.96*R, a1 = 1/(1 + g*(g + k)), a2 = g*a1, a3 = g*a2; let acc = 0;
  for (let r = 0; r < 2; r++) { const v3 = x - f.s[1], v1 = a1*f.s[0] + a2*v3, v2 = f.s[1] + a2*f.s[0] + a3*v3;
    f.s[0] = th(2*v1 - f.s[0]); f.s[1] = 2*v2 - f.s[1];   // (the band's state saturating: an analog SVF's character)
    acc += type === 3 ? v1 : type === 4 ? x - k*v1 - v2 : type === 5 ? x - k*v1 : v2; }
  return acc*.5; }

/* ---------- the envelopes: capacitors charging towards past full, and falling towards where they're going ---------- */
// (A, D and R are the times to reach full, and to fall within a thousandth of where they're going)
const OVER = 1.3, ATK = Math.log(OVER/(OVER - 1)), FALL = Math.log(1/.001);
const rates = (A, D, R, sr) => [1 - Math.exp(-ATK/(A*sr)), Math.exp(-FALL/(D*sr)), Math.exp(-FALL/(R*sr))];
function env(e, c, S){
  if (e.st === 1) { e.v += (OVER - e.v)*c[0]; if (e.v >= 1) { e.v = 1; e.st = 2; } }
  else if (e.st === 2) e.v = S + (e.v - S)*c[1];
  else if (e.st === 3) { e.v *= c[2]; if (e.v < 1e-5) { e.v = 0; e.st = 0; } }
  return e.v; }

export class AnalogSynth {
  constructor(sr, seed = 2024){ this.sr = sr; this.P = {...DEF}; this.seed = seed >>> 0 || 1; this.period = .5; this.bendV = 0; this.wheelV = 0;
    // eight voice cards, each its own: a little out of tune, its filter a little off, its envelopes a little slower or faster
    this.V = Array.from({length: 8}, (_, i) => this.card(i)); this.rr = 0; this.stack = []; this.clock = 0;
    this.lph = 0; this.lfoV = 0; this.lsh = 0; this.lsm = 0; this.lsm0 = 0; this.lsm1 = 0;
    this.out = new Chain(sr, OUT_CHAIN); }
  rand(){ this.seed = (this.seed*1664525 + 1013904223) >>> 0; return this.seed/4294967296; }
  card(i){ const R = () => this.rand() - .5;
    return {i, o1: osc(), o2: osc(), sub: osc(), ld: {s: [0, 0, 0, 0], o: [0, 0], y2: 0}, sv: {s: [0, 0]}, ae: {v: 0, st: 0}, fe: {v: 0, st: 0},
      tune: R()*2, cutK: R(), envK: 1 + R()*.24, dr: [0, 0], drv: [0, 0], note: 60, from: 60, pitch: 60, id: null, vel: 1, age: 0, held: false, pan: 0, det: 0, nz: 0, hp: 0, hpx: 0, born: 0, lfoIn: 0, ws: 0}; }
  load(p){ this.P = {...DEF, ...p}; }
  set(p){ Object.assign(this.P, p); }
  bend(v){ this.bendV = C(v, -1, 1); }
  wheel(v){ this.wheelV = C(v, 0, 1); }

  /* ---------- keys: voices given out in turn (as an analog polysynth does), the newest note in mono ---------- */
  on(id, n, vel = .8){ const P = this.P, mode = Math.round(P.mode); n += 12*Math.round(P.oct); this.clock++;
    if (mode === 0) { // poly: the next free card in turn, else the one released longest ago, else the oldest held
      let v = null; for (let k = 0; k < 8; k++) { const c = this.V[(this.rr + k) % 8]; if (c.ae.st === 0) { v = c; this.rr = (c.i + 1) % 8; break; } }
      if (!v) v = this.V.filter(c => !c.held).sort((a, b) => a.age - b.age)[0] || this.V.slice().sort((a, b) => a.age - b.age)[0];
      this.start(v, id, n, vel, P.glide > 0 && this.last != null ? this.last : n, true); this.last = n; return; }
    // mono, legato and unison: the key stack, the newest note sounding
    const legato = this.stack.length > 0; this.stack = this.stack.filter(s => s.id !== id); this.stack.push({id, n, vel});
    this.mono(n, vel, mode === 1 || !legato, legato || P.glide > 0); }
  off(id){ const P = this.P, mode = Math.round(P.mode);
    if (mode === 0) { for (const v of this.V) if (v.id === id && v.held) this.release(v); return; }
    const top = this.stack[this.stack.length - 1]; this.stack = this.stack.filter(s => s.id !== id);
    if (!this.stack.length) { for (const v of this.V) if (v.held) this.release(v); return; }
    // the key sounding let go: back to the last one still held (last-note priority), gliding there without a new attack
    if (top && top.id === id) { const s = this.stack[this.stack.length - 1]; this.mono(s.n, s.vel, mode === 1, true); } }
  mono(n, vel, trig, glide){ const P = this.P, uni = Math.round(P.mode) === 3 ? Math.round(C(P.uni, 2, 8)) : 1;
    for (let k = 0; k < 8; k++) { const v = this.V[k];
      if (k >= uni) { if (v.held) this.release(v); continue; }
      const from = glide && v.ae.st ? v.pitch : (glide && this.last != null ? this.last : n);
      v.det = uni > 1 ? (k/(uni - 1) - .5)*2 : 0; v.pan = uni > 1 ? v.det : 0;
      if (trig || !v.ae.st) this.start(v, 'mono', n, vel, from, trig || !v.ae.st); else { v.note = n; v.held = true; v.id = 'mono'; } }
    this.last = n; }
  start(v, id, n, vel, from, trig){ const P = this.P;
    v.id = id; v.note = n; v.held = true; v.vel = vel; v.age = this.clock; v.pitch = from;
    if (Math.round(P.mode) === 0) v.pan = 0, v.det = 0;
    if (trig) { v.ae.st = 1; v.fe.st = 1; v.born = 0; }   // (an envelope retriggered starts from where it is: no click)
    if (!v.ae.v) { v.o1.t = this.rand(); v.o2.t = this.rand(); v.sub.t = v.o1.t*.5; v.ld.s.fill(0); v.sv.s.fill(0); } }
  release(v){ v.held = false; if (v.ae.st) v.ae.st = 3; if (v.fe.st) v.fe.st = 3; }
  stop(){ this.stack = []; for (const v of this.V) this.release(v); }
  get sounding(){ return this.V.filter(v => v.ae.st).length; }

  /* ---------- a stretch of samples, added into L and R ---------- */
  render(Lo, Ro, a, b){ const P = this.P, sr = this.sr, inv = 1/sr;
    const w1 = Math.round(P.w1), w2 = Math.round(P.w2), sync = Math.round(P.sync), ft = Math.round(P.ftype), mode = Math.round(P.mode), subd = Math.round(P.subo) ? 4 : 2;
    const sy = Math.round(P.lsync), rate = sy > 0 ? 1/(this.period*SYNC_BEATS[sy]) : P.lrate, shape = Math.round(P.lshape), etgt = Math.round(P.etgt);
    const k = 4.3*P.res*P.res*(3 - 2*P.res), drive = 1 + P.drive*5, dnorm = 1/Math.sqrt(drive), slop = P.slop, glideK = P.glide > 0 ? 1 : 0, glideK4 = P.glide > 0 ? Math.exp(-4/(P.glide*.33*sr)) : 0;
    const bend = this.bendV*P.brange, vib = this.wheelV*.6, hpg = Math.tan(Math.PI*Math.min(P.hpf, sr*.45)/sr), hpG = hpg/(1 + hpg);
    const o1 = 12*Math.round(P.oct1), o2 = 12*Math.round(P.oct2) + Math.round(P.semi2) + P.fine2/100, two = ft === 1, sv = ft >= 2, uniDet = P.udet*.35, spread = P.spread, lv = P.level*.8;
    for (const v of this.V) { if (!v.ae.st) continue;
      const ek = 1 + (v.envK - 1)*slop, fc3 = rates(P.fa*ek, P.fd*ek, P.fr*ek, sr), ac3 = rates(P.aa*ek, P.ad*ek, P.ar*ek, sr);
      const vk = 1 - P.avel + P.avel*v.vel, pan = v.pan*spread + (mode === 0 ? (v.i/7 - .5)*spread*.5 : 0), gl = Math.cos((pan + 1)*Math.PI/4), gr = Math.sin((pan + 1)*Math.PI/4);
      const keyOct = (v.note - 60)/12, fvel = P.fvel*(v.vel - .7)*2.5, cutB = Math.log2(P.cut) + keyOct*P.fkey + v.cutK*.12*slop + fvel;
      // the drift: two slow random walks a voice (cents), worked out every 32 samples
      for (let j = a; j < b; j++) {
        if ((j & 31) === 0) for (let q = 0; q < 2; q++) { v.drv[q] += (this.rand() - .5)*.6 - v.drv[q]*.0005; v.dr[q] += (v.drv[q] - v.dr[q])*.01; }
        // the LFO, one for all, worked out here per voice so its delay comes in from the note's start
        const ae = env(v.ae, ac3, P.as), fe = env(v.fe, fc3, P.fs); if (!v.ae.st) break;
        v.born += inv; const lin = P.ldelay > 0 ? C(v.born/P.ldelay, 0, 1) : 1, lfo = this.lfoV*lin;
        // the pitches, pulse widths and cutoff, worked out every 4 samples (a control rate far above hearing)
        if ((j & 3) === 0 || !v.g) {
          if (glideK) v.pitch = v.note + (v.pitch - v.note)*glideK4; else v.pitch = v.note;
          const drift = (v.tune*3 + v.dr[0]*.3)*slop/100, ep = P.epitch*fe, lp = lfo*(P.lpitch + vib);
          const p1 = v.pitch + bend + drift + o1 + lp + (etgt ? 0 : ep) + v.det*uniDet;
          const p2 = v.pitch + bend + (v.dr[1]*.3 + v.tune)*slop/100 + o2 + lp + ep - v.det*uniDet;
          v.pw1 = C(P.pw1 + lfo*P.lpwm, .03, .97); v.pw2 = C(P.pw2 + lfo*P.lpwm, .03, .97);
          v.dt1 = Math.min(.45, hz(p1)*inv); v.dt2 = Math.min(.45, hz(p2)*inv);
          // the cutoff: its base, the envelope (as much as 7 octaves), the LFO; tan prewarped for the filter's doubled rate
          const fc = C(Math.pow(2, cutB + fe*P.fenv*7*(1 + .08*(v.vel - .7)) + lfo*P.lcut), 20, sr*.9); v.g = Math.tan(Math.PI*fc/(2*sr)); }
        let dt1 = v.dt1; const dt2 = v.dt2, pw1 = v.pw1, pw2 = v.pw2, g = v.g;
        if (P.xmod > 0) dt1 = Math.min(.45, dt1*Math.pow(2, P.xmod*3*v.o2.prev));
        // oscillator 1 (the master), the sub following it down, then oscillator 2 (reset as 1 wraps when synced)
        const wrap = v.o1.t + dt1 >= 1 ? (v.o1.t + dt1 - 1)/dt1 : -1;
        const s1 = step(v.o1, w1, dt1, pw1), s2 = step(v.o2, w2, dt2, pw2, sync && wrap >= 0 ? wrap : -1), ss = step(v.sub, 1, dt1/subd, .5);
        v.nz = this.rand()*2 - 1;
        let x = s1*P.l1 + s2*P.l2 + ss*P.lsub + v.nz*P.lnoise*.7 + s1*s2*P.lring;
        // the high-pass before the filter (one pole), then the drive into it
        const hv = (x - v.hp)*hpG, hl = hv + v.hp; v.hp = hl + hv; x -= hl;
        x = th(x*drive*.5)*2*dnorm;
        let y = sv ? svf(v.sv, x*.7, g, P.res, ft) : ladder(v.ld, x*.5, g, two ? k*1.2 : k, two)*1.8;
        y *= ae*vk*(1 - P.lamp*(.5 - .5*lfo));
        Lo[j] += y*gl*lv; Ro[j] += y*gr*lv; } }
    // the LFO advances once for the block (its value read by every voice above)
    this.lfo(b - a, rate, shape);
    this.fx(Lo, Ro, a, b); }
  lfo(n, rate, shape){ const ph0 = this.lph; this.lph += rate*n/this.sr;
    if (Math.floor(this.lph) !== Math.floor(ph0)) { this.lsm0 = this.lsm1; this.lsm1 = this.rand()*2 - 1; this.lsh = this.rand()*2 - 1; }
    this.lph %= 1; const t = this.lph;
    this.lfoV = shape === 0 ? 1 - 4*Math.abs(t - .5) : shape === 1 ? Math.sin(TAU*t) : shape === 2 ? 1 - 2*t : shape === 3 ? (t < .5 ? 1 : -1) : shape === 4 ? this.lsh : this.lsm0 + (this.lsm1 - this.lsm0)*(.5 - .5*Math.cos(Math.PI*t)); }

  /* ---------- the effects: chorus, echo, saturation, the DC kept out, a ceiling (processors: ../parts/procs.js) ---------- */
  fx(Lo, Ro, a, b){ const P = this.P, n = b - a, [c, e, s] = this.out.list;
    c.p.mode = Math.round(P.chorus); Object.assign(e.p, {time: Math.round(P.etime), mix: P.emix, fb: P.efb, tone: P.etone}); s.p.amount = P.vdrive;
    // (worked in double precision, then written back once)
    if (!this.xb || this.xb[0].length < n) this.xb = [new Float64Array(Math.max(n, 128)), new Float64Array(Math.max(n, 128))];
    const [xl, xr] = this.xb; for (let j = 0; j < n; j++) { xl[j] = Lo[a + j]; xr[j] = Ro[a + j]; }
    this.out.run(xl, xr, 0, n, {period: this.period}); for (let j = 0; j < n; j++) { Lo[a + j] = xl[j]; Ro[a + j] = xr[j]; } }
}
// the synth's output chain: the chorus, the tape echo, saturation, a DC blocker and a ceiling at -3 dB
export const OUT_CHAIN = [{key: 'chorus', params: {mode: 0}}, {key: 'echo', params: {mix: 0}}, {key: 'saturate', params: {amount: 0}}, {key: 'dc'}, {key: 'ceiling', params: {knee: .7}, o: {fast: true}}];
// a stretch of notes rendered offline: [{t, len, n, vel}] (seconds), with the settings; for tests and the page's drawings
export function synthRender(sr, P, notes, secs, seed){ const S = new AnalogSynth(sr, seed); S.load(P); const n = Math.ceil(secs*sr), Lb = new Float32Array(n), Rb = new Float32Array(n);
  const ev = notes.flatMap((x, i) => [{t: x.t, on: 1, i, x}, {t: x.t + x.len, on: 0, i}]).sort((a, b) => a.t - b.t || a.on - b.on); let e = 0;
  for (let j = 0; j < n; j += 128) { const end = Math.min(n, j + 128);
    while (e < ev.length && ev[e].t*sr < end) { const q = ev[e++]; if (q.on) S.on(q.i, q.x.n, q.x.vel ?? .8); else S.off(q.i); }
    S.render(Lb, Rb, j, end); }
  return {L: Lb, R: Rb}; }
