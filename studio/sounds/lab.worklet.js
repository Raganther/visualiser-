// The sound lab's sound, in the audio engine's own thread (an AudioWorklet): the analog synth (asynth.js) for a synth
// sound, the analog drum machine (analogkit.js) for a drum sound, and a second drum machine for the quiet groove under
// "In a loop". Notes and hits arrive with their audio-clock times and start on their exact sample.
import { AnalogSynth } from '../lib/native/asynth.js';
import { AnalogKit } from '../lib/native/analogkit.js';

const soft = x => { const a = Math.abs(x); return a < .85 ? x : Math.sign(x)*(.85 + .15*Math.tanh((a - .85)/.15)); };

class Lab extends AudioWorkletProcessor {
  constructor(){ super(); this.S = new AnalogSynth(sampleRate); this.A = new AnalogKit(sampleRate, 11); this.B = new AnalogKit(sampleRate, 23); this.B.load('Analog Deep');
    this.g = {synth: 1, drum: 1, groove: .35}; this.ev = []; this.on = new Set(); this.b = [new Float32Array(128), new Float32Array(128), new Float32Array(128), new Float32Array(128)];
    this.port.onmessage = e => this.msg(e.data); }
  msg(m){
    if (m.period) this.S.period = m.period;
    if (m.type === 'clock') { this.S.t0 = m.t0; return; }
    if (m.type === 'synth') { this.S.load(m.params); this.g.synth = m.gain; }
    else if (m.type === 'kit') { this.A.load(m.kit, m.over || {}); this.g.drum = m.gain; }
    // stopped: what's waiting dropped, what sounds let go (the synth's release and the drums' tails die away)
    else if (m.type === 'stop') { this.ev = []; for (const id of this.on) this.S.off(id); this.on.clear(); this.A.stop(); this.B.stop(); }
    else { this.ev.push(m); this.ev.sort((a, b) => a.t - b.t); } }
  run(m){ if (m.type === 'on') { this.on.add(m.id); this.S.on(m.id, m.n, m.vel); } else if (m.type === 'off') { this.on.delete(m.id); this.S.off(m.id); }
    else if (m.type === 'hit') (m.groove ? this.B : this.A).on(m.v, m.vel); }
  process(_, outs){ const L = outs[0][0], R = outs[0][1] || outs[0][0], n = L.length, t0 = currentTime;
    if (this.b[0].length < n) this.b = [0, 1, 2, 3].map(() => new Float32Array(n));
    const [sL, sR, dL, dR] = this.b; for (const x of this.b) x.fill(0, 0, n); let a = 0;
    const upTo = j => { if (j > a) { this.S.now = t0 + a/sampleRate; this.S.render(sL, sR, a, j); this.A.render(dL, dR, a, j); this.B.render(L, R, a, j); a = j; } };
    while (this.ev.length && this.ev[0].t < t0 + n/sampleRate) { const m = this.ev.shift(); upTo(Math.max(a, Math.min(n, Math.round((m.t - t0)*sampleRate)))); this.run(m); }
    upTo(n);
    const {synth, drum, groove} = this.g;
    for (let j = 0; j < n; j++) { L[j] = soft(L[j]*groove + sL[j]*synth + dL[j]*drum); if (R !== L) R[j] = soft(R[j]*groove + sR[j]*synth + dR[j]*drum); }
    return true; }
}
registerProcessor('sound-lab', Lab);
