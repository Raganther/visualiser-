// Live native voices: every native instrument (studio/lib/native/index.js: the FM, the Resonator, the analog voice, the
// pads, the bowed bodies, the skins, strings, hats and nature sounds), the native poly synth (npoly.js), the analog synth
// (asynth.js) and the native drum machine (kit.js), computed sample by sample as they play, in the audio engine's own thread (an AudioWorklet).
// Each instrument is a voice (stream.js) whose code is the note computed ahead's, so a setting turned while a note
// sounds is heard in it, a key held holds the note, and nothing waits to be computed. One node per track: a pitched
// track's instrument is its slot '', a drum track's pads are a slot each (a native instrument, or a voice of a drum
// machine: the copy of the browser's, or the analog one, analogkit.js). A drum rack's node has an output a pad (`outs`), each
// pad's drum machine its own, so each pad reaches its own strip on the desk. Notes arrive on its port with their audio-clock times and start on their exact sample.
import { NATIVE } from '../lib/native/index.js';
import { grainSource } from '../lib/native/tone.js';
import { NativePoly } from '../lib/native/npoly.js';
import { NativeKit } from '../lib/native/kit.js';
import { AnalogKit, ANALOG_KITS } from '../lib/native/analogkit.js';
import { AnalogSynth } from '../lib/native/asynth.js';

const hz = n => 440*Math.pow(2, (n - 69)/12), CHOKE = Math.exp(-1/(.012*sampleRate)), STOP = .004*sampleRate;
// a slot's settings: the instrument's own, then the track's (kept as one object, which its voices read as they play)
const fresh = (P, name, params) => { for (const k in P) delete P[k]; return Object.assign(P, NATIVE[name]?.D || {}, params); };

class Voices extends AudioWorkletProcessor {
  constructor(o){ super(); this.v = []; this.ev = []; this.S = {}; this.K = {}; this.warm = []; this.eng = null; this.tL = new Float32Array(128); this.tR = new Float32Array(128);
    this.port.onmessage = e => this.msg(e.data); for (const m of o?.processorOptions?.init || []) this.msg(m); }
  msg(m){
    if (m.type === 'stop' && m.close) this.closed = true;
    if (m.type === 'clock') { this.clk = m; if (this.poly) this.poly.t0 = m.t0; return; }   // (where the song's beats are: an LFO in time follows it)
    if (this.poly) { if (m.type === 'set' && m.t == null) { this.poly.set(m.params); if (m.params.period) this.poly.period = m.params.period; return; } if (m.type === 'stop') { this.ev = []; this.poly.stop(); return; } }
    // a synth played whole (the native poly synth, or the analog synth): one instrument, its own voices
    if (m.type === 'load' && (m.engine === 'poly' || m.engine === 'asynth')) { this.eng = m.engine; this.poly = m.engine === 'asynth' ? new AnalogSynth(sampleRate) : new NativePoly(sampleRate); if (this.clk) this.poly.t0 = this.clk.t0;
      this.poly.load(m.params); if (m.params.period) this.poly.period = m.params.period; return; }
    if (m.type === 'load') { this.eng = 'nat'; if (m.outs) this.outs = m.outs; const slots = m.slots || {'': {name: m.name, gain: m.gain, params: m.params}};
      for (const [g, k] of Object.entries(m.kits || {})) { const C = ANALOG_KITS[k.kit] ? AnalogKit : NativeKit, K = this.K[g] instanceof C ? this.K[g] : new C(sampleRate, C === AnalogKit ? 11 : 7); K.load(k.kit, k.over || {}); K.dry = !!k.dry; this.K[g] = K; }
      for (const [s, d] of Object.entries(slots)) this.S[s] = {...d, P: d.kit ? null : fresh(this.S[s]?.name === d.name ? this.S[s].P : {}, d.name, d.params || {})};
      for (const s of Object.keys(this.S)) if (!slots[s]) delete this.S[s]; }
    else if (m.type === 'set' && m.t == null) this.set(m);
    else if (m.type === 'on' || m.type === 'off' || m.type === 'set') { this.ev.push(m); this.ev.sort((a, b) => a.t - b.t); }
    // the notes it will play, so a grain pad's struck bar is ready before they come
    else if (m.type === 'warm') for (const n of m.notes) this.warm.push(n);
    // stopped: what's queued is dropped, what sounds fades in a few milliseconds (and closed, `close`, once it has, the
    // node stops running for good)
    else if (m.type === 'stop') { this.ev = []; for (const v of this.v) v.kill = 1; for (const K of Object.values(this.K)) K.stop(); }
  }
  // settings: a slot's (all of them, `all`, or some), each slot's of a drum track (`slots`), a drum machine voice's (`kit`)
  set(m){ if (this.poly) { this.poly.set(m.params); if (m.params.period) this.poly.period = m.params.period; return; }
    if (m.kit) { const s = this.S[m.slot]; if (s?.kit) this.K[s.kit]?.set(s.voice, m.key, m.v); return; }
    const one = (slot, params, all) => { const s = this.S[slot]; if (!s || s.kit) return; if (all) fresh(s.P, s.name, params); else Object.assign(s.P, params); };
    if (m.slots) for (const [k, p] of Object.entries(m.slots)) one(k, p, m.all); else one(m.slot ?? '', m.params, m.all); }
  on(m){ const s = this.S[m.slot ?? '']; if (!s) return;
    if (s.kit) { this.K[s.kit]?.on(s.voice, m.gv ?? m.vel); return; }
    const I = NATIVE[s.name]; if (!I) return;
    // a closed or open hat stops an open one ringing (as a real pair's pedal does)
    if (s.chokes) for (const v of this.v) if (v.choke === s.chokes && !v.kill) v.kill = 2;
    this.v.push({id: m.id, slot: m.slot ?? '', voice: new I.V(sampleRate, hz(m.n), s.P, m.vel, m.len), g: s.gain*(.4 + .6*(m.gv ?? m.vel)), choke: s.choke, k: 1});
    const live = this.v.filter(v => !v.kill); if (live.length > 32) live[0].kill = 1; }
  /* ---------- a block: the events at their own samples, every voice run between them ---------- */
  process(_, outputs){ const out = outputs[0], L = out[0], R = out[1] || out[0], N = L.length, t0 = currentTime; for (const o of outputs) for (const ch of o) ch.fill(0);
    if (this.closed && !this.v.length && !(this.poly && (this.poly.v ? this.poly.v.length : this.poly.V.some(v => v.ae.st))) && Object.values(this.K).every(K => !K.hits.length)) return false;
    if (!this.eng) return true;
    if (N > this.tL.length) { this.tL = new Float32Array(N); this.tR = new Float32Array(N); }
    if (this.warm.length) { const n = this.warm.shift(); for (const s of Object.values(this.S)) if (s.P?.src && s.name === 'grainpad') grainSource(sampleRate, hz(n), s.P.src); }
    let a = 0;
    while (a < N) { let b = N; const e = this.ev[0]; if (e) { const f = Math.round((e.t - t0)*sampleRate); b = Math.max(a, Math.min(N, f)); }
      if (b > a) { if (this.poly) { this.poly.now = t0 + a/sampleRate; this.poly.render(L, R, a, b); }
        // a drum rack: each pad into its own output (its voices, its machine)
        else if (this.outs) this.outs.forEach((pad, i) => { const o = outputs[i]; if (!o?.length) return; const l = o[0], r = o[1] || o[0];
          for (const v of this.v) if (v.slot === pad) this.run(v, l, r, a, b); this.K[pad]?.render(l, r, a, b); });
        else { for (const v of this.v) this.run(v, L, R, a, b); for (const K of Object.values(this.K)) K.render(L, R, a, b); } }
      if (b >= N) break; a = b;
      while (this.ev.length && Math.round((this.ev[0].t - t0)*sampleRate) <= a) { const m = this.ev.shift();
        if (this.poly) { if (m.type === 'on') this.poly.on(m.id, m.n, m.gv ?? m.vel); else if (m.type === 'off') this.poly.off(m.id); else if (m.type === 'set') { this.poly.set(m.params); if (m.params.period) this.poly.period = m.params.period; } continue; }
        if (m.type === 'on') this.on(m); else if (m.type === 'set') this.set(m); else for (const v of this.v) if (v.id === m.id) v.voice.off(); } }
    this.v = this.v.filter(v => !v.done); return true; }
  // one voice from a to b, at its gain (and fading, when it's stopped or choked)
  run(v, L, R, a, b){ if (v.done) return; const tL = this.tL, tR = this.tR; tL.fill(0, a, b); tR.fill(0, a, b); v.voice.run(tL, tR, a, b);
    for (let j = a; j < b; j++) { let g = v.g;
      if (v.kill === 1) { g *= v.k; v.k -= 1/STOP; if (v.k <= 0) { v.done = true; break; } }
      else if (v.kill === 2) { g *= v.k; v.k *= CHOKE; if (v.k < 1e-4) { v.done = true; break; } }
      L[j] += tL[j]*g; R[j] += tR[j]*g; }
    if (v.voice.done) v.done = true; }
}
registerProcessor('native-voices', Voices);
