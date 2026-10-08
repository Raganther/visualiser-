// The polysynth: a virtual-analogue synth for basses, leads, pads and chords: two oscillators (or a seven-saw supersaw), a sub and noise, a steep resonant filter with its own envelope, an amp envelope, an LFO, glide, chords, and drive and chorus on its output.
// Eight voices (the oldest let go when a ninth comes), or one (mono, or legato: gliding without a new attack).
import { DIVS, beatsOf } from '../fx/kit.js';
import chorusFx from '../fx/chorus.js';

const WAVES = ['Saw', 'Square', 'Triangle', 'Sine', 'Supersaw'], TYPE = ['sawtooth', 'square', 'triangle', 'sine', 'sawtooth'];
export const CHORDS = {Off: [0], Major: [0, 4, 7], Minor: [0, 3, 7], 'Major 7': [0, 4, 7, 11], 'Minor 7': [0, 3, 7, 10], 'Sus 4': [0, 5, 7], 'Fifth': [0, 7], 'Octave': [0, 12], 'Minor 9': [0, 3, 7, 10, 14]};
// its settings: every knob, with its range and default, in the groups the panel shows
export const PARAMS = [
  ['Oscillators', [{key: 'w1', label: 'Wave 1', list: WAVES, def: 0}, {key: 'w2', label: 'Wave 2', list: WAVES.slice(0, 4), def: 0},
    {key: 'semi', label: 'Osc 2 pitch', min: -24, max: 24, def: 0, unit: 'st', step: 1}, {key: 'fine', label: 'Detune', min: 0, max: 50, def: 8, unit: 'ct'},
    {key: 'mix2', label: 'Osc 2', min: 0, max: 1, def: .5, unit: '%'}, {key: 'sub', label: 'Sub', min: 0, max: 1, def: 0, unit: '%'},
    {key: 'noise', label: 'Noise', min: 0, max: 1, def: 0, unit: '%'}, {key: 'spread', label: 'Spread', min: 0, max: 1, def: .4, unit: '%'}]],
  ['Filter', [{key: 'ft', label: 'Type', list: ['Low', 'High', 'Band'], def: 0}, {key: 'cut', label: 'Cutoff', min: 30, max: 18000, def: 1800, unit: 'Hz', log: true},
    {key: 'res', label: 'Resonance', min: 0, max: 1, def: .2, unit: '%'}, {key: 'fenv', label: 'Env', min: -1, max: 1, def: .4, unit: '%'},
    {key: 'track', label: 'Key track', min: 0, max: 1, def: .5, unit: '%'}, {key: 'fa', label: 'Attack', min: .001, max: 4, def: .005, unit: 's', log: true},
    {key: 'fd', label: 'Decay', min: .01, max: 4, def: .35, unit: 's', log: true}, {key: 'fs', label: 'Sustain', min: 0, max: 1, def: .3, unit: '%'},
    {key: 'fr', label: 'Release', min: .01, max: 6, def: .3, unit: 's', log: true}]],
  ['Amp', [{key: 'aa', label: 'Attack', min: .001, max: 4, def: .004, unit: 's', log: true}, {key: 'ad', label: 'Decay', min: .01, max: 4, def: .4, unit: 's', log: true},
    {key: 'as', label: 'Sustain', min: 0, max: 1, def: .75, unit: '%'}, {key: 'ar', label: 'Release', min: .01, max: 8, def: .35, unit: 's', log: true},
    {key: 'vel', label: 'Velocity', min: 0, max: 1, def: .5, unit: '%'}]],
  ['LFO', [{key: 'ldest', label: 'Moves', list: ['Pitch', 'Cutoff', 'Volume', 'Pan'], def: 1}, {key: 'lsync', label: 'Time', list: ['Free', ...DIVS.map(d => d[0])], def: 0},
    {key: 'lrate', label: 'Rate', min: .05, max: 20, def: 2, unit: 'Hz', log: true}, {key: 'lamt', label: 'Amount', min: 0, max: 1, def: 0, unit: '%'}]],
  ['Play', [{key: 'mode', label: 'Voices', list: ['Poly', 'Mono', 'Legato'], def: 0}, {key: 'glide', label: 'Glide', min: 0, max: 1, def: 0, unit: 's'},
    {key: 'chord', label: 'Chord', list: Object.keys(CHORDS), def: 0}, {key: 'oct', label: 'Octave', min: -2, max: 2, def: 0, unit: 'oct', step: 1}]],
  ['Output', [{key: 'drive', label: 'Drive', min: 0, max: 1, def: 0, unit: '%'}, {key: 'chorus', label: 'Chorus', min: 0, max: 1, def: .25, unit: '%'},
    {key: 'width', label: 'Width', min: 0, max: 1, def: .6, unit: '%'}, {key: 'level', label: 'Level', min: 0, max: 1.5, def: .8, unit: '×'}]]];
export const ALL = PARAMS.flatMap(g => g[1]);
export const DEF = Object.fromEntries(ALL.map(p => [p.key, p.def]));
const W = Object.fromEntries(WAVES.map((w, i) => [w, i]));
// the presets: each a few settings over the defaults
export const PRESETS = {
  'Supersaw lead': {w1: W.Supersaw, spread: .55, mix2: .35, w2: W.Square, semi: 12, cut: 4200, res: .15, fenv: .3, fd: .5, fs: .55, aa: .01, as: .85, ar: .4, chorus: .3, width: .9, glide: .05, mode: 2},
  'Warm pad': {w1: W.Saw, w2: W.Saw, fine: 14, mix2: .8, cut: 900, res: .1, fenv: .25, fa: 1.2, fd: 2, fs: .6, fr: 2.5, aa: 1.4, ad: 1.5, as: .85, ar: 3, ldest: 1, lsync: 10, lamt: .3, chorus: .7, width: 1, level: .7, chord: 4},
  'Deep bass': {w1: W.Saw, w2: W.Square, semi: -12, mix2: .45, sub: .6, cut: 420, res: .25, fenv: .45, track: .3, fd: .25, fs: .15, aa: .002, ad: .3, as: .8, ar: .12, chorus: 0, width: 0, mode: 1, oct: -1, level: .9},
  'Reese bass': {w1: W.Saw, w2: W.Saw, fine: 22, mix2: 1, sub: .4, cut: 650, res: .2, fenv: .15, fs: .5, aa: .004, as: .9, ar: .2, ldest: 1, lsync: 9, lamt: .25, chorus: 0, width: .3, mode: 2, glide: .06, oct: -1, drive: .3},
  'Pluck': {w1: W.Saw, w2: W.Square, semi: 12, mix2: .3, cut: 500, res: .35, fenv: .75, fd: .18, fs: 0, fr: .2, aa: .002, ad: .35, as: 0, ar: .3, chorus: .4, width: .8, vel: .7},
  'Stab chord': {w1: W.Saw, w2: W.Saw, fine: 10, mix2: .7, cut: 1200, res: .3, fenv: .55, fd: .22, fs: .1, aa: .002, ad: .25, as: .1, ar: .25, chord: 4, chorus: .5, width: .9, drive: .15},
  'Acid poly': {w1: W.Square, mix2: 0, cut: 300, res: .75, fenv: .8, track: .2, fd: .2, fs: 0, aa: .002, ad: .3, as: .6, ar: .1, mode: 2, glide: .08, drive: .45, chorus: 0, width: .2, oct: -1},
  'Strings': {w1: W.Supersaw, spread: .3, mix2: 0, cut: 2600, res: .05, fenv: .1, fa: .6, fs: .8, aa: .7, ad: 1, as: .9, ar: 1.6, ldest: 0, lrate: 5, lamt: .08, chorus: .8, width: 1, level: .65},
  'Sub bass': {w1: W.Sine, mix2: 0, sub: .3, cut: 300, res: 0, fenv: 0, aa: .003, as: 1, ar: .1, chorus: 0, width: 0, mode: 1, oct: -1, drive: .2, level: 1},
  'Glass bell': {w1: W.Sine, w2: W.Triangle, semi: 19, mix2: .45, fine: 3, cut: 9000, fenv: 0, aa: .001, ad: 1.6, as: 0, ar: 1.6, chorus: .5, width: .8, oct: 1, level: .7},
  'Dub chord': {w1: W.Saw, w2: W.Square, fine: 6, mix2: .5, cut: 800, res: .4, fenv: .35, fd: .12, fs: 0, aa: .002, ad: .2, as: 0, ar: .15, chord: 5, chorus: .3, width: .7},
};

const hz = n => 440*Math.pow(2, (n - 69)/12);
const sat = a => { const n = 1024, c = new Float32Array(n), K = 1 + a*8, m = Math.tanh(K); for (let i = 0; i < n; i++) { const x = i/(n - 1)*2 - 1; c[i] = Math.tanh(x*K)/m; } return c; };

// the synth on an audio context (the page's, or an offline one for the tests), into `out`; env gives it the beat's length
// (for an LFO in time) and is optional
export function makePoly(ctx, out, env = {period: () => .5}){
  const P = {...DEF};
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = noise.getChannelData(0); let sd = 9876;
  for (let i = 0; i < nd.length; i++) { sd = (sd*1664525 + 1013904223) >>> 0; nd[i] = sd/2147483648 - 1; }
  // the output: voices → drive → chorus → tremolo → pan → level
  const bus = ctx.createGain(), drv = ctx.createWaveShaper(), cho = chorusFx.make(ctx, env), trem = ctx.createGain(), pan = ctx.createStereoPanner(), lvl = ctx.createGain();
  bus.gain.value = .32; bus.connect(drv); drv.connect(cho.input); cho.output.connect(trem); trem.connect(pan); pan.connect(lvl); lvl.connect(out);
  cho.set('rate', .45); cho.set('depth', .6);
  // the LFO, shared: into each voice's pitch or cutoff (in cents), or the output's volume or pan
  const lfo = ctx.createOscillator(), lp = ctx.createGain(), lc = ctx.createGain(), la = ctx.createGain(), lpan = ctx.createGain();
  lfo.connect(lp); lfo.connect(lc); lfo.connect(la); lfo.connect(lpan); la.connect(trem.gain); lpan.connect(pan.pan); lfo.start();
  const voices = [];
  let last = null;   // the last note's pitch (where a glide starts)
  const now = () => ctx.currentTime;

  function applyOut(){
    const t = now(); drv.curve = P.drive > .01 ? sat(P.drive) : null;
    cho.set('mix', P.chorus*.7); lvl.gain.setTargetAtTime(P.level*(1 - P.drive*.3), t, .02);
    const a = P.lamt, d = Math.round(P.ldest);
    lp.gain.setTargetAtTime(d === 0 ? a*100 : 0, t, .02); lc.gain.setTargetAtTime(d === 1 ? a*3600 : 0, t, .02);
    la.gain.setTargetAtTime(d === 2 ? a*.5 : 0, t, .02); trem.gain.setTargetAtTime(d === 2 ? 1 - a*.5 : 1, t, .02); lpan.gain.setTargetAtTime(d === 3 ? a : 0, t, .02);
    lfoRate(t);
  }
  let rate = 0;
  function lfoRate(t){ const s = Math.round(P.lsync), r = s > 0 ? 1/(env.period()*beatsOf(s - 1)) : P.lrate; if (Math.abs(r - rate) > 1e-5) { rate = r; lfo.frequency.setTargetAtTime(r, t, .03); } }

  // one voice: its oscillators into a mixer, two filter stages (24 dB), the amp, its place in the stereo
  function voice(note, vel, t){
    const v = {note, t0: t, end: Infinity, osc: [], nodes: []}, f = hz(note), k = 1 - P.vel + P.vel*vel;
    const mix = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), vca = ctx.createGain(), vp = ctx.createGain();
    const type = ['lowpass', 'highpass', 'bandpass'][Math.round(P.ft)] || 'lowpass';
    f1.type = f2.type = type; f1.Q.value = P.res*14; f2.Q.value = P.res*4;   // (the resonance in the first stage: a ladder's peak, not two)
    mix.connect(f1); f1.connect(f2); f2.connect(vca); vca.connect(bus);
    lp.connect(vp); lc.connect(f1.detune); lc.connect(f2.detune);
    v.lfoOff = () => { try { lp.disconnect(vp); lc.disconnect(f1.detune); lc.disconnect(f2.detune); } catch (e) {} };
    const add = (type, mul, gain, detune = 0, panTo = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f*mul, t); o.detune.value = detune; g.gain.value = gain;
      vp.connect(o.detune); o.connect(g);
      if (panTo) { const pn = ctx.createStereoPanner(); pn.pan.value = panTo; g.connect(pn); pn.connect(mix); } else g.connect(mix);
      o.start(t); v.osc.push({o, mul}); return o; };
    const w1 = Math.round(P.w1), m1 = 1 - P.mix2*.5;
    if (w1 === 4) { for (let i = 0; i < 7; i++) { const x = (i - 3)/3; add('sawtooth', 1, m1*(i === 3 ? .5 : .32), x*P.spread*45 + (i % 2 ? 3 : -3)*P.spread, i === 3 ? 0 : (i % 2 ? 1 : -1)*P.width*(.4 + .6*Math.abs(x))); } }
    else add(TYPE[w1], 1, m1, P.width > 0 && P.mix2 > 0 ? -P.fine/2 : 0, P.mix2 > 0 ? -P.width*.5 : 0);
    if (P.mix2 > 0) add(TYPE[Math.round(P.w2)], Math.pow(2, Math.round(P.semi)/12), P.mix2*.9, P.fine/2, P.width*.5);
    if (P.sub > 0) add('square', .5, P.sub*.7);
    if (P.noise > 0) { const n = ctx.createBufferSource(), g = ctx.createGain(); n.buffer = noise; n.loop = true; g.gain.value = P.noise*.5; n.connect(g); g.connect(mix); n.start(t, Math.random()*.9); v.osc.push({o: n}); }
    // glide: from the last note's pitch to this one
    if (P.glide > 0 && last) for (const {o, mul} of v.osc) if (mul) { o.frequency.setValueAtTime(hz(last)*mul, t); o.frequency.setTargetAtTime(f*mul, t, P.glide/3); }
    // the filter's envelope: from its cutoff (following the key) up by the envelope, down to the sustain
    const base = Math.min(18000, P.cut*Math.pow(2, P.track*(note - 60)/12)), span = P.fenv*6*(.5 + .5*k);
    const fv = x => Math.max(20, Math.min(20000, base*Math.pow(2, x)));
    for (const fl of [f1, f2]) { const q = fl.frequency; q.setValueAtTime(fv(0), t); q.exponentialRampToValueAtTime(fv(span), t + P.fa); q.setTargetAtTime(fv(span*P.fs), t + P.fa, P.fd/3); }
    const g = vca.gain, pk = .25 + .75*k; g.setValueAtTime(0, t); g.linearRampToValueAtTime(pk, t + P.aa); g.setTargetAtTime(pk*P.as, t + P.aa, P.ad/3);
    Object.assign(v, {f1, f2, vca, fv, span, pk, mix, vp});
    v.retune = (n, at) => { for (const {o, mul} of v.osc) if (mul) P.glide > 0 ? o.frequency.setTargetAtTime(hz(n)*mul, at, P.glide/3) : o.frequency.setValueAtTime(hz(n)*mul, at); v.note = n; };
    return v;
  }
  // let a voice go: its amp and filter to their releases, the oscillators stopped once it's silent
  function release(v, t, fast){
    if (v.end <= t) return; if (v.end < Infinity) unrelease(v);   // (let go sooner than it was going to be: a mono note cut short)
    v.end = t; const r = fast ? .01 : P.ar, hold = p => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); };
    hold(v.vca.gain); v.vca.gain.setTargetAtTime(0, t, r/4);
    for (const fl of [v.f1, v.f2]) { hold(fl.frequency); fl.frequency.setTargetAtTime(v.fv(0), t, (fast ? .01 : P.fr)/3); }
    const stop = t + r*1.6 + .05; for (const {o} of v.osc) o.stop(stop);
    v.osc[0].o.onended = () => { v.lfoOff(); const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); };
  }
  function unrelease(v){ const at = v.end; for (const p of [v.vca.gain, v.f1.frequency, v.f2.frequency]) p.cancelScheduledValues(at); v.end = Infinity; for (const {o} of v.osc) o.stop(at + 3600); }
  const notes = n => (CHORDS[Object.keys(CHORDS)[Math.round(P.chord)]] || [0]).map(x => n + x + 12*Math.round(P.oct));
  const synth = {
    P,
    // a key down at time t (each note of the chord, if chords are on)
    noteOn(n, vel = .8, t = now()){
      t = Math.max(t, now()); const mode = Math.round(P.mode);
      if (mode > 0) {
        const n0 = notes(n)[0], live = voices.find(v => v.end === Infinity || v.end > t);
        // legato: the same voice glides on, without a new attack (a note scheduled to overlap the last, a slide, takes back its release)
        if (live && mode === 2) { if (live.end !== Infinity) unrelease(live); live.retune(n0, t); last = n0; live.key = n; return; }
        for (const v of voices) release(v, t, true);
        const v = voice(n0, vel, t); v.key = n; voices.push(v); last = n0; return;
      }
      for (const nn of notes(n)) {
        const live = voices.filter(v => v.end > t); if (live.length >= 8) release(live[0], t, true);   // (eight voices sounding at t: the oldest goes)
        const v = voice(nn, vel, t); v.key = n; voices.push(v); last = nn;
      }
    },
    // a key up: its voices let go (in legato, only if it's the key that's sounding)
    noteOff(n, t = now()){ t = Math.max(t, now()); for (const v of voices) if (v.key === n && v.end === Infinity) release(v, t); },
    // a note of a set length (the sequencer's, the groovebox's)
    play(n, t, len, vel = .8){ synth.noteOn(n, vel, t); synth.noteOff(n, t + len); },
    allOff(t = now()){ for (const v of voices) release(v, t, true); },
    set(k, v){ P[k] = v; applyOut(); },
    load(p){ Object.assign(P, DEF, p); applyOut(); },
    tick(t){ lfoRate(t); },
    voices,
  };
  applyOut();
  return synth;
}
