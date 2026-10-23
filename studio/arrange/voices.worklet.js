// Live native voices: the FM, the Resonator (modal) and the native poly synth (npoly.js) computed sample by sample as they play, in the audio
// engine's own thread (an AudioWorklet), with the same maths as the notes computed ahead (studio/lib/native/tone.js,
// modal.js). So a setting turned while a note sounds is heard in it (the FM's bend, ratio, decay, sustain, feedback,
// release; a resonator's ring and tremolo), a key held holds the note, and nothing waits to be computed. A strike's
// hardness and strike point shape the next strike, as a mallet's would. One node per track: notes arrive on its port
// with their audio-clock times and start on their exact sample.
import { rng } from '../lib/rng.js';
import { MODAL } from '../lib/native/modal.js';
import { FMP } from '../lib/native/fmp.js';
import { NativePoly } from '../lib/native/npoly.js';

const LN1000 = Math.log(1000), TAU = 2*Math.PI, hz = n => 440*Math.pow(2, (n - 69)/12), FM_D = {ratio: 1, index: 2, indexEnd: .4, indexT: .15, a: .003, dec: .3, sus: .3, r: .12, det: .002, fb: 0};
const MD_D = {hard: .5, pos: .27, beat: 0, width: .35, glide: 0, glideT: .05, click: 0, seed: 1, trem: 0, tremHz: 5.5, ring: 1};

class Voices extends AudioWorkletProcessor {
  constructor(o){ super(); this.v = []; this.ev = []; this.P = {}; this.eng = null; this.gain = .5; this.n = 0;
    this.port.onmessage = e => this.msg(e.data); for (const m of o?.processorOptions?.init || []) this.msg(m); }
  msg(m){
    if (this.poly) { if (m.type === 'set' && m.t == null) { this.poly.set(m.params); if (m.params.period) this.poly.period = m.params.period; return; } if (m.type === 'stop') { this.ev = []; this.poly.stop(); return; } }
    if (m.type === 'load' && m.engine === 'poly') { this.eng = 'poly'; this.poly = new NativePoly(sampleRate); this.poly.load(m.params); if (m.params.period) this.poly.period = m.params.period; return; }
    if (m.type === 'load') { this.eng = m.engine; this.name = m.name; this.gain = m.gain; this.P = {...(m.engine === 'fm' ? {...FM_D, ...FMP[m.name]} : {...MD_D, ...MODAL[m.name]}), ...m.params}; }
    else if (m.type === 'set' && m.t == null) Object.assign(this.P, m.params);
    else if (m.type === 'on' || m.type === 'off' || m.type === 'set') { this.ev.push(m); this.ev.sort((a, b) => a.t - b.t); }
    // stopped: what's queued is dropped, what sounds fades in a few milliseconds
    else if (m.type === 'stop') { this.ev = []; for (const v of this.v) v.kill = .004*sampleRate; }
  }
  /* ---------- FM: the carrier at f0, the modulator at ratio×f0, its index falling from index to indexEnd ---------- */
  fmOn(m){ return {id: m.id, kind: 'fm', f0: hz(m.n), vel: m.vel, i: 0, off: -1, eOff: 0, pc: [0, 0], pm: [0, 0], last: [0, 0], g: this.gain*(.4 + .6*(m.gv ?? m.vel))}; }
  fmRun(v, L, R, a, b){ const P = this.P, sr = sampleRate, iv = .55 + .45*v.vel, aa = Math.max(1e-4, P.a), dec = Math.max(1e-4, P.dec), rr = Math.max(1e-3, P.r);
    for (let j = a; j < b; j++) { const t = v.i/sr; let e;
      if (v.off < 0) e = t < aa ? t/aa : P.sus + (1 - P.sus)*Math.exp(-(t - aa)/dec);
      else { const u = (v.i - v.off)/sr; e = v.eOff*Math.exp(-6.9*u/rr); if (u > rr*1.5 + .02) { v.done = true; break; } }
      if (v.kill != null) { e *= Math.max(0, v.kill)/(.004*sr); if (--v.kill <= 0) { v.done = true; break; } }
      const I = (P.indexEnd + (P.index - P.indexEnd)*Math.exp(-t/Math.max(1e-4, P.indexT)))*iv;
      for (let c = 0; c < 2; c++) { const k = c ? 1 + P.det : 1 - P.det; v.pm[c] += TAU*v.f0*P.ratio*k/sr; v.pc[c] += TAU*v.f0*k/sr;
        const mm = Math.sin(v.pm[c] + P.fb*v.last[c]); v.last[c] = mm; const y = Math.sin(v.pc[c] + I*mm)*e*v.vel*v.g; if (c) R[j] += y; else L[j] += y; }
      if (v.off < 0) v.eLast = e; v.i++; }
    if (v.pc[0] > 1e6) for (let c = 0; c < 2; c++) { v.pc[c] %= TAU; v.pm[c] %= TAU; } }
  fmOff(v){ if (v.off >= 0) return; v.off = v.i; v.eOff = v.eLast ?? 0; }
  /* ---------- the Resonator: each mode a decaying sinusoid, the mallet's hardness and place set at the strike ---------- */
  mdOn(m){ const P = this.P, sr = sampleRate, f0 = hz(m.n), R = rng(P.seed), b = Math.min(1, P.hard*(.55 + .45*m.vel)), tc = .0004 + (1 - b)*.004, list = [];
    (P.modes || []).forEach(([ratio, lvl, t60, att = 0], k) => { const f = f0*ratio; if (f >= sr*.45 || f < 15) return;
      const w = lvl*Math.pow(ratio, -1.6*(1 - b))*(.35 + .65*Math.abs(Math.sin(Math.PI*(k + 1)*P.pos)))/(1 + Math.pow(f*tc*.9, 2)), pan = (R() - .5)*P.width*(k ? 1 : .3);
      list.push({f, w, t60, at: Math.max(tc, att)*sr, gl: (1 - pan)*.5, gr: (1 + pan)*.5, ph: R()*.2*TAU, env: w});
      if (P.beat > 0 && k > 0) list.push({f: f*(1 + P.beat*(.6 + .8*R())), w: w*.45, t60: t60*.9, at: Math.max(tc, att)*sr, gl: (1 + pan)*.5, gr: (1 - pan)*.5, ph: R()*TAU, env: w*.45}); });
    const click = []; if (P.click > 0) { const cn = Math.round(.0015*sr); let p = 0; for (let i = 0; i < cn; i++) { const x = R()*2 - 1; click.push((x - p)*P.click*b*(1 - i/cn)); p = x; } }
    return {id: m.id, kind: 'md', modes: list, click, i: 0, g: this.gain*(.4 + .6*(m.gv ?? m.vel))}; }
  mdRun(v, L, R, a, b){ const P = this.P, sr = sampleRate, ring = Math.max(.05, P.ring), trem = P.trem || 0, glide = P.glide;
    // each mode turns by its frequency and shrinks by its decay every sample (a rotation, so no sine is needed); the decay
    // is from its T60 as the ring is now: turning Ring lengthens or shortens what's already sounding
    let alive = false;
    for (const m of v.modes) { if (m.re === undefined) { m.re = m.env*Math.cos(m.ph); m.im = m.env*Math.sin(m.ph); }
      const d = Math.exp(-LN1000/(m.t60*ring*sr)), w = TAU*m.f/sr; m.cr = d*Math.cos(w); m.ci = d*Math.sin(w); m.d = d; }
    for (let j = a; j < b; j++) { const i = v.i; let l = 0, r = 0;
      for (let k = 0; k < v.modes.length; k++) { const m = v.modes[k]; if (m.env < 1e-6) continue; alive = true;
        if (glide) { const w = TAU*m.f*(1 + glide*Math.exp(-i/(P.glideT*sr)))/sr; m.cr = m.d*Math.cos(w); m.ci = m.d*Math.sin(w); }
        const re = m.re*m.cr - m.im*m.ci, im = m.re*m.ci + m.im*m.cr; m.re = re; m.im = im; m.env *= m.d;
        const s = i < m.at ? im*(.5 - .5*Math.cos(Math.PI*i/m.at)) : im; l += s*m.gl; r += s*m.gr; }
      if (i < v.click.length) { l += v.click[i]; r += v.click[i]*.9; alive = true; }
      let g = v.g; if (trem) g *= 1 - trem*(.5 - .5*Math.cos(TAU*P.tremHz*i/sr));
      if (v.kill != null) { g *= Math.max(0, v.kill)/(.004*sr); if (--v.kill <= 0) { v.done = true; break; } }
      if (i > 8*sr) { const f = 1 - (i - 8*sr)/(.02*sr); if (f <= 0) { v.done = true; break; } g *= f; }   // (at most 8 s, as computed ahead)
      L[j] += l*g; R[j] += r*g; v.i++; }
    if (!alive) v.done = true; }
  /* ---------- a block: the events at their own samples, every voice run between them ---------- */
  process(_, outputs){ const out = outputs[0], L = out[0], R = out[1] || out[0], N = L.length, t0 = currentTime; L.fill(0); if (R !== L) R.fill(0); if (!this.eng) return true;
    let a = 0;
    while (a < N) { let b = N; const e = this.ev[0]; if (e) { const f = Math.round((e.t - t0)*sampleRate); b = Math.max(a, Math.min(N, f)); }
      if (this.poly) { if (b > a) this.poly.render(L, R, a, b); } else for (const v of this.v) this.run(v, L, R, a, b);
      if (b >= N) break; a = b;
      while (this.ev.length && Math.round((this.ev[0].t - t0)*sampleRate) <= a) { const m = this.ev.shift();
        if (this.poly) { if (m.type === 'on') this.poly.on(m.id, m.n, m.gv ?? m.vel); else if (m.type === 'off') this.poly.off(m.id); else if (m.type === 'set') { this.poly.set(m.params); if (m.params.period) this.poly.period = m.params.period; } continue; }
        if (m.type === 'on') { this.v.push(this.eng === 'fm' ? this.fmOn(m) : this.mdOn(m)); const live = this.v.filter(v => v.kill == null); if (live.length > 24) live[0].kill = .004*sampleRate; }
        else if (m.type === 'set') Object.assign(this.P, m.params);
        else for (const v of this.v) if (v.id === m.id && v.kind === 'fm') this.fmOff(v); } }
    this.v = this.v.filter(v => !v.done); return true; }
  run(v, L, R, a, b){ if (v.done || a >= b) return; v.kind === 'fm' ? this.fmRun(v, L, R, a, b) : this.mdRun(v, L, R, a, b); }
}
registerProcessor('native-voices', Voices);
