// Natural sounds computed from how they happen: a water drop (the bubble it traps ringing and rising as it closes:
// Minnaert), a twig snapping (a crackle of tiny fractures through the wood's short resonances), two stones knocked
// together, leaves rustling (grains of noise swelling and dying), an insect's run of clicks, a click alone, and a bird's
// chirp (a sweep up to its note, with a quick warble), which can play a melody.
import { rng } from '../rng.js';

const out = n => ({L: new Float32Array(n), R: new Float32Array(n)});
const fade = (o, sr, ms = 10) => { const n = o.L.length, f = Math.min(n, Math.round(ms/1000*sr)); for (let i = 0; i < f; i++) { const g = i/f; o.L[n - 1 - i] *= g; o.R[n - 1 - i] *= g; } return o; };
// a band-pass resonator (two poles), as the wood's and stone's modes ring
const reson = (sr, f, q) => { const w = 2*Math.PI*f/sr, al = Math.sin(w)/(2*q), a0 = 1 + al, b0 = al/a0, a1 = -2*Math.cos(w)/a0, a2 = (1 - al)/a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0*x - b0*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; };

// a water drop: a sine at the bubble's note rising as it shrinks (rise: how far, in octaves), dying in a few hundredths
// of a second, a soft tick where the drop lands
export function drop(sr, f0, {vel = .8, rise = .8, decay = .035, tick = .2, pan = 0, seed = 1} = {}){
  const n = Math.ceil((decay*6 + .01)*sr), o = out(n), R = rng(seed); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i/sr, f = f0*Math.pow(2, rise*(1 - Math.exp(-t/(decay*1.5))));
    ph += 2*Math.PI*f/sr; let x = Math.sin(ph)*Math.exp(-t/decay)*(t < .001 ? t/.001 : 1);
    if (t < .002) x += (R()*2 - 1)*tick*(1 - t/.002); x *= vel; o.L[i] = x*(1 - pan)*.5*2; o.R[i] = x*(1 + pan)*.5*2; }
  return fade(o, sr, 5);
}
// a twig: a few fractures over a few milliseconds, each a click through the wood's resonances
export function twig(sr, {vel = .8, cracks = 5, spread = .014, res = [1300, 2600, 4400], q = 9, decay = .02, seed = 1} = {}){
  const n = Math.ceil((spread + decay*6)*sr), o = out(n);
  for (const [y, sd] of [[o.L, seed], [o.R, seed + 4]]) { const R = rng(sd), x = new Float32Array(n);
    for (let c = 0; c < cracks; c++) { const at = Math.floor(R()*R()*spread*sr), a = (.4 + .6*R())*(c ? .7 : 1); x[at] += (R() < .5 ? -1 : 1)*a; }
    const rs = res.map(f => reson(sr, f*(.9 + .2*R()), q)), dec = Math.exp(-1/(decay*sr)); let e = 1;
    for (let i = 0; i < n; i++) { let v = 0; for (const r of rs) v += r(x[i]); y[i] = v*e*vel*3; if (i > spread*sr) e *= dec; } }
  return fade(o, sr, 5);
}
// two stones knocked together: two bright, short knocks a few milliseconds apart (the second softer), high modes
export function stone(sr, f0, {vel = .8, gap = .006, decay = .018, seed = 1} = {}){
  const n = Math.ceil((gap + decay*6)*sr), o = out(n), R = rng(seed), modes = [[1, 1], [1.62, .6], [2.37, .45], [3.1, .25]];
  for (const [y, side] of [[o.L, -1], [o.R, 1]]) for (const [at, a] of [[0, 1], [gap*(1 + .2*side), .55]]) { const i0 = Math.floor(at*sr);
    for (const [r, l] of modes) { const f = f0*r*(1 + (R() - .5)*.03); let ph = R()*6; for (let i = i0; i < n; i++) { const t = (i - i0)/sr; ph += 2*Math.PI*f/sr; y[i] += Math.sin(ph)*l*a*vel*Math.exp(-t/(decay/r**.5))*.5; } } }
  return fade(o, sr, 5);
}
// leaves: grains of noise, each a millisecond or two through a high band, their density swelling and dying over `secs`
export function leaf(sr, {vel = .7, secs = .25, density = 900, tone = .5, seed = 1} = {}){
  const n = Math.ceil((secs + .03)*sr), o = out(n);
  for (const [y, sd] of [[o.L, seed], [o.R, seed + 6]]) { const R = rng(sd), b1 = reson(sr, 2600 + 2400*tone, 2.5), b2 = reson(sr, 5200 + 3000*tone, 3);
    let g = 0, gl = 0; for (let i = 0; i < n; i++) { const t = i/sr, sw = Math.sin(Math.PI*Math.min(1, t/secs))**1.5;
      if (gl <= 0 && R() < density*sw/sr) { gl = Math.floor((.0006 + .002*R())*sr); g = (.3 + .7*R()); }
      const x = gl-- > 0 ? (R()*2 - 1)*g : 0; y[i] = (b1(x) + b2(x)*.7)*vel*1.4; } }
  return fade(o, sr, 10);
}
// an insect: a run of tiny clicks (count, at rate a second), each through a narrow high resonance, rising then falling
export function insect(sr, {vel = .7, count = 9, rate = 55, f = 6200, q = 12, seed = 1} = {}){
  const n = Math.ceil((count/rate + .02)*sr), o = out(n);
  for (const [y, sd, fk] of [[o.L, seed, 1], [o.R, seed + 2, 1.03]]) { const R = rng(sd), b = reson(sr, f*fk, q);
    let last = -1; for (let i = 0; i < n; i++) { const k = Math.floor(i/sr*rate), hit = k !== last && k < count; last = k;
      y[i] = b(hit ? Math.sin(Math.PI*(k + .5)/count)*(.6 + .4*R()) : 0)*vel*4; } }
  return fade(o, sr, 5);
}
// a click: an impulse through one resonance at the note, very short (minimal techno's ticks)
export function click(sr, f0, {vel = .8, q = 6, decay = .006, seed = 1} = {}){
  const n = Math.ceil((decay*8 + .005)*sr), o = out(n), b = reson(sr, Math.min(sr*.45, f0), q);
  for (let i = 0; i < n; i++) { const x = b(i === 0 ? 1 : i === 1 ? -.6 : 0)*vel*Math.exp(-i/(decay*sr))*3; o.L[i] = x; o.R[i] = x; }
  return fade(o, sr, 3);
}
// a bird's chirp: from below its note up past it and settling (a quick FM warble on top), a little of its octave; the
// note's length sets how long it sings (up to `max`)
export function bird(sr, f0, {vel = .7, len = .15, max = .28, from = .7, over = 1.15, warble = .03, wrate = 38, seed = 1} = {}){
  const d = Math.min(max, Math.max(.06, len)), n = Math.ceil((d + .03)*sr), o = out(n), R = rng(seed), pan = (R() - .5)*.6; let ph = 0;
  for (let i = 0; i < n; i++) { const t = i/sr, x = Math.min(1, t/d), sweep = x < .35 ? from + (over - from)*x/.35 : over + (1 - over)*(x - .35)/.65;
    const f = f0*sweep*(1 + warble*Math.sin(2*Math.PI*wrate*t)); ph += 2*Math.PI*f/sr;
    const e = Math.sin(Math.PI*Math.min(1, t/(d + .02)))**.7*vel, s = (Math.sin(ph) + .15*Math.sin(2*ph))*e*.8; o.L[i] = s*(1 - pan); o.R[i] = s*(1 + pan); }
  return fade(o, sr, 8);
}
