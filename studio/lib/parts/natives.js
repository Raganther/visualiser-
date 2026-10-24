// The native instruments as one of the host's sources (a leaf of the parts): a set of slots, each a native instrument
// (studio/lib/native/index.js) with its settings, played as voices sample by sample, as the DAW's live engine plays them
// (voices.worklet.js). A pitched part is one slot (''); a drum part's pads are a slot each, a closed or open hat stopping
// an open one ringing. A slot's settings are one object its voices read as they play, so a change is heard at once.
import { NATIVE } from '../native/index.js';

const hz = n => 440*Math.pow(2, (n - 69)/12);

export class Natives {
  constructor(sr){ this.sr = sr; this.S = {}; this.v = []; this.tL = new Float64Array(128); this.tR = new Float64Array(128);
    this.choke = Math.exp(-1/(.012*sr)); this.stopN = .004*sr; }
  // slots: {slot: {name, gain, params, choke, chokes}}
  load(slots = {}){ for (const [s, d] of Object.entries(slots)) { const P = this.S[s]?.name === d.name ? this.S[s].P : {}; for (const k in P) delete P[k];
      this.S[s] = {gain: NATIVE[d.name]?.gain ?? .5, ...d, P: Object.assign(P, NATIVE[d.name]?.D || {}, d.params || {}), lv: d.lv ?? 1}; }
    for (const s of Object.keys(this.S)) if (!slots[s]) delete this.S[s]; }
  // a message's settings: {slots: {slot: params}} (or one slot's: slot, params), all replacing them; lv a slot's level
  set(m){ const one = (slot, p) => { const s = this.S[slot]; if (!s) return; if (p.lv != null) s.lv = p.lv; const q = {...p}; delete q.lv;
      if (m.all) { for (const k in s.P) delete s.P[k]; Object.assign(s.P, NATIVE[s.name]?.D || {}, q); } else Object.assign(s.P, q); };
    if (m.slots) for (const [k, p] of Object.entries(m.slots)) one(k, p); else if (m.params) one(m.slot ?? '', m.params); }
  on(id, n, vel, m = {}){ const s = this.S[m.slot ?? '']; if (!s) return; const I = NATIVE[s.name]; if (!I) return;
    if (s.chokes) for (const v of this.v) if (v.choke === s.chokes && !v.kill) v.kill = 2;
    this.v.push({id, voice: new I.V(this.sr, hz(n), s.P, vel, m.len), g: s.gain*s.lv*(.4 + .6*(m.gv ?? vel)), choke: s.choke, k: 1});
    const live = this.v.filter(v => !v.kill); if (live.length > 48) live[0].kill = 1; }
  off(id){ for (const v of this.v) if (v.id === id) v.voice.off(); }
  stop(){ for (const v of this.v) v.kill = 1; }
  render(L, R, a, b){ if (b - a > this.tL.length) { this.tL = new Float64Array(b - a); this.tR = new Float64Array(b - a); }
    for (const v of this.v) this.run(v, L, R, a, b); this.v = this.v.filter(v => !v.done); }
  run(v, L, R, a, b){ if (v.done) return; const tL = this.tL, tR = this.tR, n = b - a; tL.fill(0, 0, n); tR.fill(0, 0, n); v.voice.run(tL, tR, 0, n);
    for (let j = 0; j < n; j++) { let g = v.g;
      if (v.kill === 1) { g *= v.k; v.k -= 1/this.stopN; if (v.k <= 0) { v.done = true; break; } }
      else if (v.kill === 2) { g *= v.k; v.k *= this.choke; if (v.k < 1e-4) { v.done = true; break; } }
      L[a + j] += tL[j]*g; R[a + j] += tR[j]*g; }
    if (v.voice.done) v.done = true; }
}
