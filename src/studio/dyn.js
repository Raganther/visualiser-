// The Studio's own compressor, an AudioWorklet with no look-ahead: Chromium's DynamicsCompressorNode holds the sound back
// 6 ms to look ahead, and a played note passed three or four of them (its track, the drum bus, the master's glue and
// limiter), 16–22 ms in all, which the user heard as a delay between a pad and its sound. This one acts on the sample it
// hears: a soft-knee curve, the gain smoothed in dB (attack and release), the left and right linked; `auto` adds the make-up
// Chromium's adds (0.6 of what it takes off a full-scale sound), so the songs mixed on that one sound the same.
// Without worklets (or before prepare()), makeComp gives Chromium's own, with the same settings.
const DSP = `
class Dyn extends AudioWorkletProcessor {
  static get parameterDescriptors(){ return [
    {name: 'thr', defaultValue: -24, automationRate: 'k-rate'}, {name: 'ratio', defaultValue: 4, minValue: 1, automationRate: 'k-rate'},
    {name: 'knee', defaultValue: 6, minValue: 0, automationRate: 'k-rate'}, {name: 'att', defaultValue: .003, minValue: 0, automationRate: 'k-rate'},
    {name: 'rel', defaultValue: .25, minValue: .001, automationRate: 'k-rate'}, {name: 'auto', defaultValue: 1, automationRate: 'k-rate'}]; }
  // look (seconds, set once): the sound held back that long while the gain eases down ahead of each peak (the limiter's
  // 1.5 ms: a gain dropped on one sample makes an edge that rings past the ceiling between the samples)
  constructor(o){ super(); this.gr = 0; this.n = 0; const L = Math.round(((o.processorOptions || {}).look || 0)*sampleRate);
    this.L = L; if (L) { this.buf = [new Float32Array(L), new Float32Array(L)]; this.want = new Float32Array(L); this.w = 0; this.qi = new Float64Array(L + 2); this.qv = new Float32Array(L + 2); this.qh = this.qt = 0; this.n2 = 0; } }
  process(ins, outs, P){
    const inp = ins[0], out = outs[0]; if (!inp || !inp.length) { this.gr = 0; return true; }
    const T = P.thr[0], R = Math.max(1, P.ratio[0]), W = P.knee[0], aA = P.att[0] > 0 ? Math.exp(-1/(P.att[0]*sampleRate)) : 0, aR = Math.exp(-1/(P.rel[0]*sampleRate));
    // (the curve's output at full scale: what the make-up gives back, as Chromium's does)
    const curve = x => { const d = x - T; if (2*d < -W) return x; if (2*Math.abs(d) <= W && W > 0) { const q = d + W/2; return x + (1/R - 1)*q*q/(2*W); } return T + d/R; };
    const mk = P.auto[0] > .5 ? -.6*(curve(0) - 0) : 0, L = inp[0], Rr = inp[1] || inp[0], n = L.length;
    let gr = this.gr, top = 0;
    const LA = this.L, la = LA ? Math.exp(-3/LA) : 0;
    // (cheap where nothing happens: under the knee a sample needs no logarithm, and with no reduction the gain is the
    // make-up alone; an iPad's audio thread crackled with a logarithm and a power every sample in every compressor)
    const quietA = Math.pow(10, (T - W/2)/20), g0 = Math.pow(10, mk/20), gain = gr => gr < 1e-6 ? g0 : Math.pow(10, (mk - gr)/20);
    for (let i = 0; i < n; i++) {
      const a = Math.max(Math.abs(L[i]), Math.abs(Rr[i]));
      let want = 0; if (a > quietA) { const x = 20*Math.log10(a); want = x - curve(x); }
      if (LA) {
        // (the most any sample in the window ahead needs, reached by the time it comes out: the gain eases down over the window)
        // (the window holds what's coming; the sample leaving it now gets at least the reduction it needs itself)
        // (the window's most, kept as a falling queue of the samples that could still be it: no search of the window)
        const w = this.w, leaving = this.want[w], c = this.n2++, Q = this.qi, QV = this.qv, M = LA + 2; this.want[w] = want;
        while (this.qh !== this.qt && QV[(this.qt - 1 + M) % M] <= want) this.qt = (this.qt - 1 + M) % M;
        QV[this.qt] = want; Q[this.qt] = c; this.qt = (this.qt + 1) % M;
        while (Q[this.qh] <= c - LA) this.qh = (this.qh + 1) % M;
        const m = Math.max(0, QV[this.qh]);
        gr = m > gr ? la*gr + (1 - la)*m : aR*gr + (1 - aR)*m; if (gr < leaving) gr = leaving;
        const g = gain(gr), o0 = this.buf[0][w], o1 = this.buf[1][w];
        this.buf[0][w] = L[i]; this.buf[1][w] = Rr[i]; this.w = (w + 1) % LA;
        out[0][i] = o0*g; if (out[1]) out[1][i] = o1*g;
      } else {
        gr = want > gr ? aA*gr + (1 - aA)*want : aR*gr + (1 - aR)*want;
        const g = gain(gr);
        for (let c = 0; c < out.length; c++) out[c][i] = (inp[c] || inp[0])[i]*g;
      }
      if (gr > top) top = gr;
    }
    this.gr = gr;
    // (how far it's turning down, for the meters: a few times a second is plenty)
    if ((this.n += n) >= 2048) { this.n = 0; this.port.postMessage(top); }
    return true;
  }
}
registerProcessor('ag-dyn', Dyn);`;

const READY = new WeakMap(), OK = new WeakMap();
// the worklet's module, once per context (a Blob URL, as the Moog's)
export function prepare(ctx){
  if (!READY.has(ctx)) READY.set(ctx, (async () => {
    let ok = false;
    try { if (ctx.audioWorklet) { const url = URL.createObjectURL(new Blob([DSP], {type: 'text/javascript'})); await ctx.audioWorklet.addModule(url); URL.revokeObjectURL(url); ok = true; } } catch (e) {}
    OK.set(ctx, ok); return ok;
  })());
  return READY.get(ctx);
}
export const ready = ctx => !!OK.get(ctx);

// a compressor: {input, output, set({thr, ratio, knee, att, rel}), reduction() → dB it's turning down, look: the seconds it
// holds the sound back (ahead: 0 for a compressor, the limiter's 1.5 ms; Chromium's 6 ms when it falls back to that)}.
// auto: Chromium's own make-up (false: none)
export function makeComp(ctx, P, auto = true, ahead = 0){
  if (OK.get(ctx)) {
    const n = new AudioWorkletNode(ctx, 'ag-dyn', {numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: {look: ahead}}); let red = 0;
    n.port.onmessage = e => { red = e.data; };
    const set = Q => { for (const k of ['thr', 'ratio', 'knee', 'att', 'rel']) if (Q[k] != null) n.parameters.get(k).value = Q[k]; n.parameters.get('auto').value = auto ? 1 : 0; };
    set(P); return {input: n, output: n, set, reduction: () => red, look: ahead, param: k => k === 'thr' ? n.parameters.get('thr') : null};
  }
  const c = ctx.createDynamicsCompressor(), mk = ctx.createGain(); c.connect(mk);
  const set = Q => { if (Q.thr != null) c.threshold.value = Q.thr; if (Q.ratio != null) c.ratio.value = Math.max(1, Q.ratio); if (Q.knee != null) c.knee.value = Q.knee;
    if (Q.att != null) c.attack.value = Q.att; if (Q.rel != null) c.release.value = Q.rel;
    // (without auto, Chromium's make-up taken back out)
    mk.gain.value = auto ? 1 : Math.pow(10, (c.ratio.value > 1 ? .6*c.threshold.value*(1 - 1/c.ratio.value) : 0)/20); };
  set(P); return {input: c, output: mk, set, reduction: () => -c.reduction, look: .006, param: k => k === 'thr' ? c.threshold : null};
}
