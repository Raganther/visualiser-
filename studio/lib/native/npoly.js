// The native poly synth: the browser-built polysynth (src/audio/engine/inst/poly.js) rebuilt from the ground up, computed
// sample by sample, played live in the DAW's AudioWorklet. The same settings and presets, so every sound made on it keeps
// its meaning, with an analog circuit's character where the browser's parts were clean: band-limited oscillators that
// start where they happen to be and drift a little (`drift`), and a ladder filter (four one-pole stages in a loop, the
// resonance the loop's feedback, saturating as it's driven: `fdrive`) in place of two textbook filters. Then drive, a
// chorus, the LFO's tremolo or pan, and the level, as before. A leaf module: plain maths, no audio nodes.
import { PARAMS as BASE, PRESETS, CHORDS } from '../../../src/audio/engine/inst/poly.js';
import { DIVS } from '../../../src/audio/engine/fx/kit.js';

// its settings: the polysynth's, and the analog character's two
export const PARAMS = BASE.map(([g, ps]) => [g, g === 'Oscillators' ? [...ps, {key: 'drift', label: 'Drift', min: 0, max: 1, def: .3, unit: '%'}]
  : g === 'Filter' ? [...ps, {key: 'fdrive', label: 'Filter drive', min: 0, max: 1, def: .3, unit: '%'}] : ps]);
export const DEF = Object.fromEntries(PARAMS.flatMap(g => g[1]).map(p => [p.key, p.def]));
export { PRESETS };

const TAU = 2*Math.PI, hz = n => 440*Math.pow(2, (n - 69)/12), C = (v, a, b) => v < a ? a : v > b ? b : v;
const th = x => x < -3 ? -1 : x > 3 ? 1 : x*(27 + x*x)/(27 + 9*x*x);   // (tanh, near enough and cheap)
const blep = (t, dt) => { if (t < dt) { t /= dt; return t + t - t*t - 1; } if (t > 1 - dt) { t = (t - 1)/dt; return t*t + t + t + 1; } return 0; };
// one oscillator's sample at phase t (0..1) stepping dt a sample: saw, square, triangle, sine, band-limited (polyBLEP)
const wave = (w, t, dt) => w === 0 ? 2*t - 1 - blep(t, dt) : w === 1 ? (t < .5 ? 1 : -1) + blep(t, dt) - blep((t + .5) % 1, dt) : w === 2 ? 4*Math.abs(t - .5) - 1 : Math.sin(TAU*t);
const BLOCK = 16, LADDER = 2.2;   // (the filter's and the pitch's settings worked out every 16 samples)

// the ladder's response at f (Hz) for a cutoff and resonance, as drawn by the DAW's filter graph: four one-pole stages
// in a loop, the feedback k, the loss in the passband made up; (the analog prototype of what the voice computes)
export function ladderMag(f, cut, res){ const fl = cut*(1 + (LADDER - 1)*(1 - Math.min(1, res*2.2))), k = res*3.4, w = f/fl;
  let re = 1, im = 0; for (let i = 0; i < 4; i++) { const r = re - im*w, m = im + re*w; re = r; im = m; }   // (1 + jw)^4
  const dr = re + k, di = im; return (1 + k)/Math.sqrt(dr*dr + di*di); }

export class NativePoly {
  constructor(sr, seed = 9876){ this.sr = sr; this.P = {...DEF}; this.v = []; this.last = null; this.lph = 0; this.seed = seed; this.period = .5;
    const n = Math.ceil(.1*sr); this.dl = [new Float32Array(n), new Float32Array(n)]; this.dw = 0; this.cph = 0; this.k = 0; }
  rand(){ this.seed = (this.seed*1664525 + 1013904223) >>> 0; return this.seed/4294967296; }
  load(p){ this.P = {...DEF, ...p}; }
  set(p){ Object.assign(this.P, p); }
  notes(n){ const P = this.P; return (CHORDS[Object.keys(CHORDS)[Math.round(P.chord)]] || [0]).map(x => n + x + 12*Math.round(P.oct)); }

  /* ---------- voices: a key down, a key up ---------- */
  on(id, n, vel){ const P = this.P, mode = Math.round(P.mode);
    if (mode > 0) { const n0 = this.notes(n)[0], live = this.v.find(v => !v.rel);
      // legato: the voice sounding glides on to the new note without a new attack
      if (live && mode === 2) { live.target = n0; live.id = id; live.rel = 0; this.last = n0; return; }
      for (const v of this.v) this.release(v, true); this.v.push(this.voice(id, n0, vel)); this.last = n0; return; }
    for (const nn of this.notes(n)) { const live = this.v.filter(v => !v.rel); if (live.length >= 8) this.release(live[0], true); this.v.push(this.voice(id, nn, vel)); this.last = nn; } }
  off(id){ for (const v of this.v) if (v.id === id && !v.rel) this.release(v); }
  stop(){ for (const v of this.v) this.release(v, true); }
  release(v, fast){ if (v.rel) { if (fast) v.ar = .01; return; } v.rel = 1; v.ta = 0; v.a0 = v.amp; v.f0r = v.fc; v.ar = fast ? .01 : this.P.ar; v.fr = fast ? .01 : this.P.fr; }
  voice(id, n, vel){ const P = this.P, k = 1 - P.vel + P.vel*vel, R = () => this.rand();
    const v = {id, note: P.glide > 0 && this.last != null ? this.last : n, target: n, k, pk: .25 + .75*k, t: 0, rel: 0, amp: 0, fc: 0,
      // each oscillator starts where it happens to be, a little out of tune, and drifts slowly (an analog voice)
      ph: Array.from({length: 11}, () => R()), dr: Array.from({length: 11}, () => [(R() - .5)*2, .1 + .3*R(), R()*TAU]),
      s: [[0, 0, 0, 0], [0, 0, 0, 0]], sv: [[0, 0, 0, 0], [0, 0, 0, 0]], nz: 0};
    return v; }

  /* ---------- a stretch of samples, added into L and R ---------- */
  render(L, R, a, b){ const P = this.P, sr = this.sr;
    // the LFO: free, or a division of the beat
    const sync = Math.round(P.lsync), rate = sync > 0 ? 1/(this.period*DIVS[C(sync - 1, 0, DIVS.length - 1)][1]) : P.lrate, dest = Math.round(P.ldest), la = P.lamt;
    const w1 = Math.round(P.w1), w2 = Math.round(P.w2), m1 = 1 - P.mix2*.5, fine = P.fine, semi = Math.pow(2, Math.round(P.semi)/12), ft = Math.round(P.ft);
    const vb = this.vb ??= [new Float32Array(BLOCK), new Float32Array(BLOCK)];
    for (let j0 = a; j0 < b; j0 += BLOCK) { const j1 = Math.min(b, j0 + BLOCK), n = j1 - j0, lfo = Math.sin(this.lph); this.lph = (this.lph + TAU*rate*n/sr) % TAU;
      const pitchC = dest === 0 ? lfo*la*100 : 0, cutC = dest === 1 ? lfo*la*3600 : 0;
      for (const v of this.v) { if (v.done) continue; vb[0].fill(0, 0, n); vb[1].fill(0, 0, n); this.voiceBlock(v, vb, n, pitchC, cutC, w1, w2, m1, fine, semi, ft);
        for (let i = 0; i < n; i++) { L[j0 + i] += vb[0][i]; R[j0 + i] += vb[1][i]; } }
      this.out(L, R, j0, j1, dest === 2 ? lfo*la : null, dest === 3 ? lfo*la : null); }
    this.v = this.v.filter(v => !v.done); }

  voiceBlock(v, out, n, pitchC, cutC, w1, w2, m1, fine, semi, ft){ const P = this.P, sr = this.sr, dtS = n/sr;
    // the pitch: gliding to its note, the LFO, each oscillator's own drift
    if (v.note !== v.target) { const g = P.glide > 0 ? 1 - Math.exp(-dtS/(P.glide/3)) : 1; v.note += (v.target - v.note)*g; if (Math.abs(v.target - v.note) < 1e-3) v.note = v.target; }
    const f0 = hz(v.note)*Math.pow(2, pitchC/1200), drift = P.drift*3, tt = v.t/sr, dc = i => Math.pow(2, drift*(v.dr[i][0]*.6 + .4*Math.sin(v.dr[i][2] + TAU*v.dr[i][1]*tt))/1200);
    // the filter's cutoff: the key's place, its envelope, the LFO
    const base = Math.min(18000, P.cut*Math.pow(2, P.track*(v.target - 60)/12)), span = P.fenv*6*(.5 + .5*v.k), fv = x => C(base*Math.pow(2, x), 20, 20000);
    let fc; if (!v.rel) { if (tt < P.fa) fc = fv(span*tt/Math.max(1e-4, P.fa)); else { const pk = fv(span), tg = fv(span*P.fs); fc = tg + (pk - tg)*Math.exp(-(tt - P.fa)/Math.max(1e-4, P.fd/3)); } }
    else { const tg = fv(0); fc = tg + (v.f0r - tg)*Math.exp(-v.ta/sr/Math.max(1e-4, v.fr/3)); }
    v.fc = fc; fc = C(fc*Math.pow(2, cutC/1200), 20, Math.min(20000, sr*.45));
    // (a ladder's four poles fall away sooner than the browser's two filters did: its own cutoff set higher, so a setting is as bright as it was; less so as it resonates, so its peak stays where the setting puts it)
    const gl = Math.tan(Math.PI*Math.min(fc*(1 + (LADDER - 1)*(1 - Math.min(1, P.res*2.2))), sr*.45)/sr), G = gl/(1 + gl), G4 = G*G*G*G, kres = P.res*3.4, fd = (.35 + 1.3*P.fdrive)*.5, comp = 1 + kres, g = Math.tan(Math.PI*fc/sr);
    const Q1 = .707 + P.res*6, Q2 = .6 + P.res*1.5, h1 = 1/(1 + g/Q1 + g*g), h2 = 1/(1 + g/Q2 + g*g);
    // the oscillators: their pans as the browser-built synth had them (equal power), their levels the same
    const pw = P.width, sup = w1 === 4, osc = [];
    if (sup) for (let i = 0; i < 7; i++) { const x = (i - 3)/3; osc.push([0, 1, m1*(i === 3 ? .5 : .32), Math.pow(2, (x*P.spread*45 + (i % 2 ? 3 : -3)*P.spread)/1200), i === 3 ? null : (i % 2 ? 1 : -1)*pw*(.4 + .6*Math.abs(x))]); }
    else osc.push([w1, 1, m1, Math.pow(2, (pw > 0 && P.mix2 > 0 ? -fine/2 : 0)/1200), P.mix2 > 0 ? -pw*.5 : null]);
    if (P.mix2 > 0) osc.push([w2, semi, P.mix2*.9, Math.pow(2, fine/2/1200), pw*.5]);
    if (P.sub > 0) osc.push([1, .5, P.sub*.7, 1, null]);
    const pans = osc.map(o => o[4] == null ? [1, 1] : [Math.cos((o[4] + 1)*Math.PI/4), Math.sin((o[4] + 1)*Math.PI/4)]);
    const steps = osc.map((o, i) => f0*o[1]*o[3]*dc(i)/sr), nz = P.noise*.5, aa = Math.max(1e-4, P.aa), ad = Math.max(1e-4, P.ad/3), as = P.as, pk = v.pk;
    for (let i = 0; i < n; i++) { let l = 0, r = 0;
      for (let k = 0; k < osc.length; k++) { const o = osc[k], dt = steps[k]; let t = v.ph[k] + dt; if (t >= 1) t -= 1; v.ph[k] = t; const s = wave(sup && k < 7 ? 0 : o[0], t, dt)*o[2]; l += s*pans[k][0]; r += s*pans[k][1]; }
      if (nz > 0) { const x = (this.rand()*2 - 1)*nz; l += x; r += x; }
      // the amp's envelope
      const t = v.t/sr; let e; if (!v.rel) e = t < aa ? pk*t/aa : pk*as + (pk - pk*as)*Math.exp(-(t - aa)/ad); else e = v.a0*Math.exp(-v.ta/sr/Math.max(1e-4, v.ar/4));
      v.amp = e;
      // the filter, each side: the ladder (low), or two state-variable stages (high, band)
      for (let c = 0; c < 2; c++) { let x = c ? r : l, y;
        if (ft === 0) { const s = v.s[c], S = (G*G*G*s[0] + G*G*s[1] + G*s[2] + s[3])/(1 + gl);
          let u = (x - kres*S)/(1 + kres*G4); u = th(u*fd)/fd;
          for (let st = 0; st < 4; st++) { const vv = (u - s[st])*G, yy = vv + s[st]; s[st] = yy + vv; u = yy; } y = u*comp; }
        else { const s = v.sv[c]; let z = x;
          for (const [h, Q, o] of [[h1, Q1, 0], [h2, Q2, 2]]) { const hp = (z - (1/Q + g)*s[o] - s[o + 1])*h, bp = g*hp + s[o]; s[o] = g*hp + bp; const lp = g*bp + s[o + 1]; s[o + 1] = g*bp + lp; z = ft === 1 ? hp : bp; }
          y = z; }
        out[c][i] = y*e; }
      v.t++; if (v.rel) { v.ta++; if (v.ta/sr > v.ar*1.6 + .05) { v.done = true; break; } } } }

  /* ---------- the output: drive, the chorus, the LFO's tremolo or pan, the level ---------- */
  out(L, R, a, b, trem, pan){ const P = this.P, sr = this.sr, drive = P.drive, K = 1 + drive*8, mK = Math.tanh(K), mix = P.chorus*.7, dry = Math.cos(mix*Math.PI/2), wet = Math.sin(mix*Math.PI/2);
    const lvl = P.level*(1 - drive*.3), N = this.dl[0].length, dep = .6*.006, cr = TAU*.45/sr;
    for (let j = a; j < b; j++) { let l = L[j]*.32, r = R[j]*.32;
      if (drive > .01) { l = Math.tanh(C(l, -1, 1)*K)/mK; r = Math.tanh(C(r, -1, 1)*K)/mK; }
      if (mix > 0) { const m = Math.sin(this.cph); this.cph += cr; if (this.cph > TAU) this.cph -= TAU; const w = this.dw;
        this.dl[0][w] = l; this.dl[1][w] = r; const rd = (d, buf) => { const p = w - d*sr, i0 = Math.floor(p), f = p - i0, x0 = buf[(i0 + N) % N], x1 = buf[(i0 + 1 + N) % N]; return x0 + (x1 - x0)*f; };
        const cl = rd(.014 + dep*m, this.dl[0]), crr = rd(.014 - dep*m, this.dl[1]); this.dw = (w + 1) % N; l = l*dry + cl*wet; r = r*dry + crr*wet; }
      let g = lvl; if (trem != null) g *= 1 - Math.abs(P.lamt)*.5 + trem*.5;
      if (pan != null) { const p = C(pan, -1, 1); if (p <= 0) { const x = (p + 1)*Math.PI/2; [l, r] = [l + r*Math.cos(x), r*Math.sin(x)]; } else { const x = p*Math.PI/2; [l, r] = [l*Math.cos(x), r + l*Math.sin(x)]; } }
      L[j] = l*g; R[j] = r*g; } }
}
