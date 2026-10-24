// The host in the audio engine's own thread: a page posts it a description (what's wired to what) and events with their
// audio-clock times; it posts back the meters twenty times a second. The parts are computed sample by sample here.
import { Host } from './host.js';

class PartsHost extends AudioWorkletProcessor {
  constructor(){ super(); this.H = new Host(sampleRate); this.tl = new Float64Array(128); this.tr = new Float64Array(128); this.next = 0; this.port.onmessage = e => this.H.msg(e.data); }
  process(_, outs){ const L = outs[0][0], R = outs[0][1] || L, n = L.length, { tl, tr } = this;
    for (let a = 0; a < n; a += 128) { const m = Math.min(128, n - a); tl.fill(0); tr.fill(0); this.H.process(tl, tr, m, currentTime + a/sampleRate);
      for (let j = 0; j < m; j++) { L[a + j] = tl[j]; if (R !== L) R[a + j] = tr[j]; } }
    if (currentTime >= this.next) { this.next = currentTime + .05; this.port.postMessage({type: 'meters', m: this.H.meters()}); }
    return true; }
}
registerProcessor('parts-host', PartsHost);
