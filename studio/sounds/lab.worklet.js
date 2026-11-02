// The sound lab's sound, in the audio engine's own thread (an AudioWorklet): the analog synth (asynth.js) for a synth
// sound, the analog drum machine (analogkit.js) for a drum sound, and a second drum machine for the quiet groove under
// "In a loop". Notes and hits arrive with their audio-clock times and start on their exact sample.
import { AnalogSynth } from '../lib/native/asynth.js';
import { AnalogKit } from '../lib/native/analogkit.js';
import { NativePoly } from '../lib/native/npoly.js';
import { Chain } from '../lib/parts/procs.js';

// the palette's parts summed, set back so several at once keep clear of the ceiling
const PAL = .6;
const soft = x => { const a = Math.abs(x); return a < .85 ? x : Math.sign(x)*(.85 + .15*Math.tanh((a - .85)/.15)); };

class Lab extends AudioWorkletProcessor {
  constructor(){ super(); this.AS = new AnalogSynth(sampleRate); this.NP = new NativePoly(sampleRate); this.S = this.AS; this.A = new AnalogKit(sampleRate, 11); this.B = new AnalogKit(sampleRate, 23); this.B.load('Analog Deep');
    this.g = {synth: 1, drum: 1, groove: .35, send: 0, room: 1};
    // the room: a send from the sound (each its own amount, all of them scaled by the page's Room), the reverb alone
    this.room = new Chain(sampleRate, [{key: 'room', params: {size: 1.1, decay: 1.8, damp: .55, pre: 14, cut: 220, mix: 1, dry: 0}}]); this.ev = []; this.on = new Set(); this.b = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(128));
    // the palette: several instruments at once, a slot each (a synth of either engine, or a drum machine), each into its
    // own buffer (they run their effects over it), at its own level and room
    this.slots = {};
    this.port.onmessage = e => this.msg(e.data); }
  slot(m){ if (m.inst == null) { delete this.slots[m.slot]; return; } let x = this.slots[m.slot];
    const want = m.inst === 'kit' ? 'kit' : m.inst === 'npoly' ? 'npoly' : 'asynth';
    if (!x || x.kind !== want) { x?.inst.stop?.(); x = this.slots[m.slot] = {kind: want, inst: want === 'kit' ? new AnalogKit(sampleRate, 31 + Object.keys(this.slots).length) : want === 'npoly' ? new NativePoly(sampleRate) : new AnalogSynth(sampleRate), L: new Float32Array(128), R: new Float32Array(128), on: new Set()}; }
    if (want === 'kit') x.inst.load(m.kit, m.over || {}); else { x.inst.period = this.AS.period; x.inst.load(m.params); }
    Object.assign(x, {gain: m.gain, level: m.level ?? 1, send: m.room || 0, mute: !!m.mute}); }
  msg(m){
    if (m.period) { this.S.period = this.AS.period = this.NP.period = m.period; for (const x of Object.values(this.slots)) x.inst.period = m.period; }
    if (m.type === 'clock') { this.S.t0 = m.t0; return; }
    if (m.type === 'slot') { this.slot(m); return; }
    if (m.type === 'mix') { const x = this.slots[m.slot]; if (x) { if (m.level != null) x.level = m.level; if (m.mute != null) x.mute = m.mute; } return; }
    // a synth sound: the analog synth, or the native poly synth (`engine`), the other let go
    if (m.type === 'synth') { const next = m.engine === 'npoly' ? this.NP : this.AS; if (next !== this.S) { this.S.stop(); this.on.clear(); } this.S = next; this.S.period = this.AS.period; this.S.load(m.params); this.g.synth = m.gain; this.g.send = m.room || 0; }
    else if (m.type === 'kit') { this.A.load(m.kit, m.over || {}); this.g.drum = m.gain; this.g.send = m.room || 0; }
    else if (m.type === 'room') this.g.room = m.v;
    // a setting turned in the editor: heard at once, in the notes already sounding (the synth) or on the next hit (a drum)
    else if (m.type === 'set') this.S.set(m.params);
    else if (m.type === 'voice') this.A.set(m.v, m.key, m.val);
    // stopped: what's waiting dropped, what sounds let go (the synth's release and the drums' tails die away)
    else if (m.type === 'stop') { this.ev = []; for (const id of this.on) this.S.off(id); this.on.clear(); this.A.stop(); this.B.stop();
      for (const x of Object.values(this.slots)) { if (x.kind === 'kit') x.inst.stop(); else { for (const id of x.on) x.inst.off(id); x.on.clear(); } } }
    // the keys and pads: played now
    else if (m.t == null) this.run(m);
    else { this.ev.push(m); this.ev.sort((a, b) => a.t - b.t); } }
  run(m){ if (m.slot != null) { const x = this.slots[m.slot]; if (!x) return;
      if (m.type === 'hit') x.inst.on(m.v, m.vel); else if (m.type === 'on') { x.on.add(m.id); x.inst.on(m.id, m.n, m.vel); } else if (m.type === 'off') { x.on.delete(m.id); x.inst.off(m.id); } return; }
    if (m.type === 'on') { this.on.add(m.id); this.S.on(m.id, m.n, m.vel); } else if (m.type === 'off') { this.on.delete(m.id); this.S.off(m.id); }
    else if (m.type === 'hit') (m.groove ? this.B : this.A).on(m.v, m.vel); }
  process(_, outs){ const L = outs[0][0], R = outs[0][1] || outs[0][0], n = L.length, t0 = currentTime;
    if (this.b[0].length < n || this.b.length < 6) this.b = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(Math.max(n, 128)));
    if (!this.r) this.r = [new Float64Array(128), new Float64Array(128)]; if (this.r[0].length < n) this.r = [new Float64Array(n), new Float64Array(n)];
    // (each synth into its own buffer: each runs its effects over the buffer it's given, so they must not share one)
    const [sL, sR, dL, dR, nL, nR] = this.b; for (const x of this.b) x.fill(0, 0, n); let a = 0;
    const SL = Object.values(this.slots); for (const x of SL) { if (x.L.length < n) { x.L = new Float32Array(n); x.R = new Float32Array(n); } x.L.fill(0, 0, n); x.R.fill(0, 0, n); }
    const upTo = j => { if (j > a) { for (const x of SL) { x.inst.now = t0 + a/sampleRate; x.inst.render(x.L, x.R, a, j); } this.S.now = t0 + a/sampleRate; this.AS.now = this.S.now; this.AS.render(sL, sR, a, j); this.NP.render(nL, nR, a, j); this.A.render(dL, dR, a, j); this.B.render(L, R, a, j); a = j; } };
    while (this.ev.length && this.ev[0].t < t0 + n/sampleRate) { const m = this.ev.shift(); upTo(Math.max(a, Math.min(n, Math.round((m.t - t0)*sampleRate)))); this.run(m); }
    upTo(n);
    for (let j = 0; j < n; j++) { sL[j] += nL[j]; sR[j] += nR[j]; }
    // the palette's slots, each at its level (mute: none of it), into the sound and the room's send
    if (!this.p || this.p[0].length < n) this.p = [new Float32Array(Math.max(n, 128)), new Float32Array(Math.max(n, 128))]; const [pL, pR] = this.p; pL.fill(0, 0, n); pR.fill(0, 0, n);
    for (const x of SL) { if (x.mute) continue; const g = x.gain*x.level*PAL; for (let j = 0; j < n; j++) { pL[j] += x.L[j]*g; pR[j] += x.R[j]*g; } }
    const {synth, drum, groove} = this.g, send = this.g.send*this.g.room, [rL, rR] = this.r;
    for (let j = 0; j < n; j++) { rL[j] = (sL[j]*synth + dL[j]*drum)*send; rR[j] = (sR[j]*synth + dR[j]*drum)*send; }
    // (each slot sends into the room by its own amount)
    for (const x of SL) { if (x.mute || !x.send) continue; const g = x.gain*x.level*PAL*x.send*this.g.room; for (let j = 0; j < n; j++) { rL[j] += x.L[j]*g; rR[j] += x.R[j]*g; } }
    this.room.run(rL, rR, 0, n, {period: this.S.period});
    for (let j = 0; j < n; j++) { L[j] = soft(L[j]*groove + sL[j]*synth + dL[j]*drum + pL[j] + rL[j]); if (R !== L) R[j] = soft(R[j]*groove + sR[j]*synth + dR[j]*drum + pR[j] + rR[j]); }
    return true; }
}
registerProcessor('sound-lab', Lab);
