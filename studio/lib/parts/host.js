// The host: parts strung together as a mixer is, computed sample by sample (a leaf module, run in an AudioWorklet by
// host.worklet.js, or offline by `offline()`). A description says what's wired to what, so a playground is a
// description, not new plumbing:
//   sources: {id: {kind: 'kit', kit, over} | {kind: 'synth', params}}: the instruments, played by events;
//   strips:  [{id, input: {src, pad?} | null, chain: [{key, params, on}], level (dB), pan, mute, solo, out, sends: {id: dB},
//             bypass, match}]: a channel (its input an instrument, or one of a kit's pads) or a bus (input null: what
//             the strips sent to it), its processors, its fader, then out to another strip or to 'master'.
// A strip's bypass hears it dry; with match on, the dry signal is turned to the loudness the chain gives it, so
// switching it in and out compares the sound, not the level. Each strip keeps a meter (peak, loudness, the compressors'
// reduction) that the page reads.
import { AnalogSynth } from '../native/asynth.js';
import { AnalogKit } from '../native/analogkit.js';
import { Chain, PROCS } from './procs.js';
import { fromDb } from './dsp.js';

export const INSTS = {
  kit: {label: 'Analog drum machine', make: (sr, d) => { const K = new AnalogKit(sr, 11); K.load(d.kit || 'Analog 808', d.over || {}); return K; }},
  synth: {label: 'Analog synth', make: (sr, d) => { const S = new AnalogSynth(sr); S.load(d.params || {}); return S; }},
};

export class Host {
  constructor(sr, block = 128){ this.sr = sr; this.B = block; this.src = {}; this.st = []; this.by = {}; this.ev = []; this.period = .5; this.meterAt = 0; this.build({sources: {}, strips: []}); }
  buf(){ return [new Float64Array(this.B), new Float64Array(this.B)]; }
  build(d){ if (d.period) this.period = d.period;
    for (const [id, s] of Object.entries(d.sources || {})) this.src[id] = {...s, obj: INSTS[s.kind].make(this.sr, s)};
    const old = this.by; this.by = {}; this.st = [];
    for (const s of [...(d.strips || []), ...(d.strips?.some(x => x.id === 'master') ? [] : [{id: 'master', input: null, chain: [], out: null}])]) {
      // a strip rebuilt keeps its processors' state when they're the same (the same id)
      const o = old[s.id], x = {level: 0, pan: 0, sends: {}, out: 'master', ...s, inp: this.buf(), dry: this.buf(), ein: 0, eout: 0, ratio: 1, pk: 0, ms: 0};
      if (x.id === 'master') x.out = null;
      x.chain = new Chain(this.sr, []); x.chain.list = (s.chain || []).map(c => { const keep = o?.chain.find(c.id); if (keep && keep.key === c.key) { keep.set(c.params || {}); keep.on = c.on !== false; return keep; } return x.chain.make(c); });
      this.by[x.id] = x; this.st.push(x); }
    this.order(); }
  // strips in an order where each comes after everything feeding it
  order(){ const into = {}; for (const s of this.st) { for (const t of [s.out, ...Object.keys(s.sends || {})]) if (t && this.by[t]) (into[t] ||= []).push(s.id); }
    const done = new Set(), out = [], visit = id => { if (done.has(id)) return; done.add(id); for (const f of into[id] || []) visit(f); out.push(this.by[id]); };
    for (const s of this.st) visit(s.id); this.run_ = out; }
  // a message from the page (or a test): the description changed, a strip set, a processor turned, a note
  msg(m){
    if (m.period) this.period = m.period;
    switch (m.type) {
      case 'build': return this.build(m);
      case 'strip': { const s = this.by[m.id]; if (s) { Object.assign(s, m.set); if ('out' in m.set || 'sends' in m.set) this.order(); } return; }
      // a strip's processors changed (added, taken out, moved): those kept keep their state
      case 'chain': { const s = this.by[m.id]; if (s) s.chain.list = m.chain.map(c => { const keep = s.chain.find(c.id); if (keep && keep.key === c.key) { keep.set(c.params || {}); keep.on = c.on !== false; return keep; } return s.chain.make(c); }); return; }
      case 'proc': { const p = this.by[m.id]?.chain.find(m.pid); if (p) { if (m.params) p.set(m.params); if ('on' in m) p.on = m.on; } return; }
      case 'voice': return this.src[m.src]?.obj.set(m.voice, m.key, m.v);
      case 'kit': { const s = this.src[m.src]; if (s) { s.kit = m.kit; s.over = m.over || {}; s.obj.load(m.kit, m.over || {}); } return; }
      case 'synth': return this.src[m.src]?.obj.set(m.params);
      case 'stop': { this.ev = this.ev.filter(e => !e.seq); for (const s of Object.values(this.src)) s.obj.stop(); return; }
    }
    if (m.t == null) this.play(m); else { this.ev.push(m); this.ev.sort((a, b) => a.t - b.t); } }
  play(m){ const o = this.src[m.src]?.obj; if (!o) return;
    if (m.type === 'hit') o.on(m.voice, m.vel); else if (m.type === 'on') o.on(m.id, m.n, m.vel); else if (m.type === 'off') o.off(m.id); }
  // a block: the events at their samples, the graph between them
  process(L, R, n, now){ let a = 0; const sr = this.sr;
    while (this.ev.length && this.ev[0].t < now + n/sr) { const m = this.ev.shift(), j = Math.max(a, Math.min(n, Math.round((m.t - now)*sr))); if (j > a) { this.graph(L, R, a, j); a = j; } this.play(m); }
    if (a < n) this.graph(L, R, a, n); }
  graph(L, R, a, b){ const n = b - a, env = {period: this.period};
    for (const s of this.st) { s.inp[0].fill(0, 0, n); s.inp[1].fill(0, 0, n); }
    // the instruments: a kit's pads each into its strip, anything else whole into its strip
    for (const [id, src] of Object.entries(this.src)) { const o = src.obj, mine = this.st.filter(s => s.input?.src === id);
      if (!mine.length) continue;
      if (mine.some(s => s.input.pad)) { if (o.hits.length || o.tail) o.tail = o.voices(n) ? 16 : Math.max(0, (o.tail || 0) - 1); else o.live = [];
        for (const c of o.live) for (const s of mine) if (s.input.pad === c.key) { const [l, r] = s.inp, [ol, or] = c.out; for (let j = 0; j < n; j++) { l[j] += ol[j]; r[j] += or[j]; } } }
      else o.render(mine[0].inp[0], mine[0].inp[1], 0, n); }
    const solo = this.st.some(s => s.solo && s.input);
    for (const s of this.run_) { const [l, r] = s.inp;
      // the chain (or, bypassed, the dry signal at the chain's loudness), measured each block
      let ein = 0, eout = 0; for (let j = 0; j < n; j++) ein += l[j]*l[j] + r[j]*r[j];
      if (s.bypass) { const [dl, dr] = s.dry; dl.set(l.subarray(0, n)); dr.set(r.subarray(0, n)); s.chain.run(dl, dr, 0, n, env); for (let j = 0; j < n; j++) eout += dl[j]*dl[j] + dr[j]*dr[j];
        const g = s.match ? s.ratio : 1; if (g !== 1) for (let j = 0; j < n; j++) { l[j] *= g; r[j] *= g; } }
      else { s.chain.run(l, r, 0, n, env); for (let j = 0; j < n; j++) eout += l[j]*l[j] + r[j]*r[j]; }
      // the loudness the chain adds, followed over a few seconds (while there's something to hear)
      const k = Math.exp(-n/(3*this.sr)); s.ein = s.ein*k + ein; s.eout = s.eout*k + eout; if (s.ein > 1e-6) s.ratio = Math.sqrt(s.eout/s.ein);
      // the fader and pan (a balance: the far side turned down), mute and solo; then out, and the sends after the fader
      const off = s.mute || (solo && s.input && !s.solo), g = off ? 0 : fromDb(s.level ?? 0), gl = g*Math.min(1, 1 - (s.pan || 0)), gr = g*Math.min(1, 1 + (s.pan || 0));
      let pk = 0, ms = 0; for (let j = 0; j < n; j++) { const x = l[j]*gl, y = r[j]*gr; l[j] = x; r[j] = y; const m = Math.max(Math.abs(x), Math.abs(y)); if (m > pk) pk = m; ms += x*x + y*y; }
      s.pk = Math.max(pk, s.pk*Math.exp(-n/(.3*this.sr))); s.ms = s.ms*.9 + .1*ms/(2*n);
      const to = s.out ? this.by[s.out] : null; if (to) { const [tl, tr] = to.inp; for (let j = 0; j < n; j++) { tl[j] += l[j]; tr[j] += r[j]; } }
      for (const [t, db] of Object.entries(s.sends || {})) { const T = this.by[t], sg = off ? 0 : fromDb(db); if (!T || !(sg > 1e-4)) continue; const [tl, tr] = T.inp; for (let j = 0; j < n; j++) { tl[j] += l[j]*sg; tr[j] += r[j]*sg; } }
      if (s.id === 'master') for (let j = 0; j < n; j++) { L[a + j] += l[j]; R[a + j] += r[j]; } } }
  // what the meters read: each strip's peak and loudness, and each compressor's reduction
  meters(){ const o = {}; for (const s of this.st) o[s.id] = {pk: s.pk, rms: Math.sqrt(s.ms), ratio: s.ratio, gr: Object.fromEntries(s.chain.list.filter(p => PROCS[p.key].meter).map(p => [p.id, p.on ? p.gr || 0 : 0]))}; return o; }
}

// a description rendered offline: the events [{t, …}] (seconds), for tests and drawings
export function offline(sr, desc, events, secs){ const H = new Host(sr); H.build(desc); for (const e of events) H.msg({...e});
  const n = Math.ceil(secs*sr), L = new Float32Array(n), R = new Float32Array(n), tl = new Float64Array(128), tr = new Float64Array(128);
  for (let a = 0; a < n; a += 128) { const m = Math.min(128, n - a); tl.fill(0); tr.fill(0); H.process(tl, tr, m, a/sr); for (let j = 0; j < m; j++) { L[a + j] = tl[j]; R[a + j] = tr[j]; } }
  return {L, R, H}; }
