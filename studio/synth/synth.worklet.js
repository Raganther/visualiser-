// The synth playground's sound, in the audio engine's own thread (an AudioWorklet): the analog synth (asynth.js) and,
// under it, the analog drum machine (analogkit.js). Notes and hits arrive on the port with their audio-clock times and
// start on their exact sample; a setting with no time is heard at once, in the notes already sounding.
import { AnalogSynth } from '../lib/native/asynth.js';
import { AnalogKit } from '../lib/native/analogkit.js';

// (the drums set back under the synth: the kit's own level is made to stand alone)
const DRUMS = .5;
const soft = x => { const a = Math.abs(x); return a < .8 ? x : Math.sign(x)*(.8 + .2*Math.tanh((a - .8)/.2)); };

class Synth extends AudioWorkletProcessor {
  constructor(){ super(); this.S = new AnalogSynth(sampleRate); this.K = new AnalogKit(sampleRate, 11); this.K.load('Analog Deep'); this.ev = []; this.seqOn = new Set(); this.tL = new Float32Array(128); this.tR = new Float32Array(128); this.port.onmessage = e => this.msg(e.data); }
  msg(m){
    if (m.period) this.S.period = m.period;
    if (m.type === 'clock') { this.S.t0 = m.t0; return; }   // (the phrase's first beat: an LFO in time follows it)
    if (m.type === 'load') this.S.load(m.params);
    else if (m.type === 'set') this.S.set(m.params || {});
    else if (m.type === 'kit') this.K.load(m.kit);
    // the phrase stopped: its notes waiting dropped and its notes sounding let go (the keys you hold play on)
    else if (m.type === 'stop') { this.ev = this.ev.filter(e => !e.seq); for (const id of this.seqOn) this.S.off(id); this.seqOn.clear(); this.K.stop(); }
    else if (m.type === 'panic') { this.ev = []; this.seqOn.clear(); this.S.stop(); this.K.stop(); }
    else if (m.t == null) this.run(m);
    else { this.ev.push(m); this.ev.sort((a, b) => a.t - b.t); } }
  run(m){ if (m.seq) m.type === 'on' ? this.seqOn.add(m.id) : this.seqOn.delete(m.id);
    if (m.type === 'on') this.S.on(m.id, m.n, m.vel); else if (m.type === 'off') this.S.off(m.id); else if (m.type === 'bend') this.S.bend(m.v); else if (m.type === 'wheel') this.S.wheel(m.v);
    else if (m.type === 'drum') this.K.on(m.v, m.vel); }
  process(_, outs){ const L = outs[0][0], R = outs[0][1] || outs[0][0], n = L.length, t0 = currentTime, tL = this.tL, tR = this.tR; let a = 0;
    if (tL.length < n) { this.tL = new Float32Array(n); this.tR = new Float32Array(n); return this.process(_, outs); }
    tL.fill(0); tR.fill(0);
    // each stretch up to the next event's sample, then the event (the synth apart, its effects its own; the drums dry)
    const upTo = j => { if (j > a) { this.K.render(L, R, a, j); this.S.now = t0 + a/sampleRate; this.S.render(tL, tR, a, j); a = j; } };
    while (this.ev.length && this.ev[0].t < t0 + n/sampleRate) { const m = this.ev.shift(); upTo(Math.max(a, Math.min(n, Math.round((m.t - t0)*sampleRate)))); this.run(m); }
    upTo(n);
    // the two together, rounded off at full scale
    for (let j = 0; j < n; j++) { L[j] = soft(L[j]*DRUMS + tL[j]); if (R !== L) R[j] = soft(R[j]*DRUMS + tR[j]); }
    return true; }
}
registerProcessor('analog-synth', Synth);
