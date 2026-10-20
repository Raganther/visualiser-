// Drums, strings, shakers and textures computed from their physics: a struck membrane (kick, toms, hand drums), a plucked
// string (Karplus and Strong: a burst of noise round a tuned loop that loses its highs each time round), a shaker as beads
// colliding (Cook's PhISEM), a cloud of grains, and rain as droplets.
import { rng } from '../rng.js';

const LN1000 = Math.log(1000), out = n => ({L: new Float32Array(n), R: new Float32Array(n)});
const fade = (o, sr, ms = 15) => { const n = o.L.length, f = Math.min(n, Math.round(ms/1000*sr)); for (let i = 0; i < f; i++) { const g = i/f; o.L[n - 1 - i] *= g; o.R[n - 1 - i] *= g; } return o; };

// a circular membrane's modes (Bessel zeros over the first): the struck skin's pitch drops as the strike's tension eases
const MEMB = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501];
export function membrane(sr, f0, {vel = .8, decay = .5, drop = .3, dropT = .03, hard = .5, pos = .3, beater = .3, body = 0, seed = 1, width = .2} = {}){
  const R = rng(seed), T = decay*1.4 + .05, n = Math.ceil(T*sr), o = out(n), b = hard*(.5 + .5*vel);
  MEMB.forEach((ratio, k) => {
    const w = (k ? .55*Math.pow(ratio, -2.2*(1 - b))*Math.abs(Math.sin(Math.PI*(k + 1)*pos)) : 1)*(.6 + .4*vel), t60 = decay/(1 + k*.9);
    const dec = Math.exp(-LN1000/(t60*sr)), pan = k ? (R() - .5)*width : 0; let env = w, ph = 0;
    for (let i = 0; i < n; i++) { ph += 2*Math.PI*f0*ratio*(1 + drop*Math.exp(-i/(dropT*sr)))/sr; const s = Math.sin(ph)*env; o.L[i] += s*(1 - pan)*.5; o.R[i] += s*(1 + pan)*.5; env *= dec; if (env < 1e-6) break; }
  });
  // the beater's click: noise through a quick decay, brighter for a hard beater
  if (beater > 0) { const cn = Math.round(.006*sr); let lp = 0; const a = .25 + .7*b; for (let i = 0; i < cn; i++) { lp += a*((R()*2 - 1) - lp); const g = beater*vel*Math.exp(-i/(.0012*sr)); o.L[i] += lp*g; o.R[i] += lp*g; } }
  // a shell's resonance: a low sine under it all (a kick's body)
  if (body > 0) { const dec = Math.exp(-LN1000/(decay*1.2*sr)); let env = body*vel, ph = 0; for (let i = 0; i < n; i++) { ph += 2*Math.PI*f0*.5*(1 + drop*.6*Math.exp(-i/(dropT*1.5*sr)))/sr; const s = Math.sin(ph)*env; o.L[i] += s; o.R[i] += s; env *= dec; } }
  return fade(o, sr);
}

// a plucked string: a noise burst, filtered by how bright the pluck is, round a loop of one period with a damping filter
export function string(sr, f0, {vel = .8, bright = .5, damp = .996, decay = 2, body = .5, seed = 1, detune = .0015} = {}){
  const n = Math.ceil(decay*sr), o = out(n);
  for (const [ch, det, sd] of [['L', 1 - detune, seed], ['R', 1 + detune, seed + 7]]) {
    const R = rng(sd), P = sr/(f0*det) - .5, N = Math.floor(P), frac = P - N, buf = new Float32Array(N);   // (the average of two neighbours delays half a sample; the all-pass the rest)
    let lp = 0; const a = .1 + .85*bright*(.6 + .4*vel);
    for (let i = 0; i < buf.length; i++) { lp += a*((R()*2 - 1) - lp); buf[i] = lp*vel; }
    const y = o[ch]; let idx = 0, prev = 0, ap = 0, apIn = 0; const c = (1 - frac)/(1 + frac);
    for (let i = 0; i < n; i++) {
      const j0 = idx % buf.length, j1 = (idx + 1) % buf.length, s = buf[j0];
      // the loop: an average of two neighbours (it loses its highs), the damping, an all-pass for the fractional period
      const avg = damp*(.5*(s + buf[j1])), apo = c*avg + apIn - c*ap; apIn = avg; ap = apo;
      buf[j0] = apo; y[i] = s; idx++; }
    // the body: a gentle low-pass, as the instrument's wood takes the edge off
    let b = 0; const ba = 1 - body*.7; for (let i = 0; i < n; i++) { b += ba*(y[i] - b); y[i] = b; }
  }
  return fade(o, sr, 30);
}

// a biquad band-pass applied in place (for the beads' and droplets' resonances)
const band = (x, sr, f, q) => { const w = 2*Math.PI*f/sr, al = Math.sin(w)/(2*q), a0 = 1 + al, b0 = al/a0, b2 = -al/a0, a1 = -2*Math.cos(w)/a0, a2 = (1 - al)/a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { const v = b0*x[i] + b2*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };

// a shaker: beads colliding while the shake's energy lasts, each collision a click through the shell's resonances
export function shaker(sr, {vel = .8, secs = .12, beads = 40, res = [3200, 5600, 8200], q = 7, seed = 1} = {}){
  const n = Math.ceil((secs + .08)*sr), o = out(n);
  for (const [ch, sd] of [['L', seed], ['R', seed + 3]]) {
    const R = rng(sd), x = new Float32Array(n); let energy = 1;
    const dec = Math.exp(-LN1000/(secs*sr));
    for (let i = 0; i < n; i++) { if (R() < beads*energy/sr*6) x[i] = (R()*2 - 1)*energy; energy *= dec; }
    let y = new Float32Array(n); for (const f of res) { const b = band(x, sr, f*(.97 + .06*R()), q); for (let i = 0; i < n; i++) y[i] += b[i]; }
    for (let i = 0; i < n; i++) o[ch][i] = y[i]*vel*.9; }
  return fade(o, sr, 10);
}

// a cloud of grains: short windowed pieces of a source (any rendered sound), scattered in time, pitch and space;
// density and spread can grow over the cloud's length (a bloom)
export function grains(sr, src, secs, {density = [4, 30], len = [.04, .14], pitches = [1], spread = .02, pan = .8, seed = 1} = {}){
  const R = rng(seed), n = Math.ceil(secs*sr), o = out(n), S = src.L, sn = S.length;
  for (let t = 0; t < secs;) {
    const x = t/secs, dens = density[0] + (density[1] - density[0])*x, g = Math.round((len[0] + (len[1] - len[0])*R())*sr);
    const p = pitches[Math.floor(R()*pitches.length)]*(1 + (R() - .5)*spread), off = Math.floor(R()*Math.max(1, sn*.6)), at = Math.floor(t*sr), pn = (R() - .5)*pan, amp = .4 + .6*R();
    for (let i = 0; i < g && at + i < n; i++) { const j = off + i*p, j0 = Math.floor(j); if (j0 + 1 >= sn) break;
      const s = (S[j0] + (S[j0 + 1] - S[j0])*(j - j0))*(.5 - .5*Math.cos(2*Math.PI*i/g))*amp; o.L[at + i] += s*(1 - pn)*.5; o.R[at + i] += s*(1 + pn)*.5; }
    t += -Math.log(1 - R())/dens; }
  return fade(o, sr, 200);
}

// rain: droplets, each a small bubble ringing and rising in pitch as it closes, over a soft hiss of distant rain
export function rain(sr, secs, {rate = [20, 60], hiss = .04, seed = 1} = {}){
  const R = rng(seed), n = Math.ceil(secs*sr), o = out(n);
  for (let t = 0; t < secs;) {
    const x = t/secs, f = 900 + 3200*Math.pow(R(), 1.6), d = .006 + .02*R(), at = Math.floor(t*sr), a = .15 + .5*Math.pow(R(), 2), pn = (R() - .5)*1.6;
    let ph = 0; const m = Math.ceil(d*5*sr);
    for (let i = 0; i < m && at + i < n; i++) { ph += 2*Math.PI*f*(1 + 2.2*i/(d*5*sr))/sr; const s = Math.sin(ph)*a*Math.exp(-i/(d*sr)); o.L[at + i] += s*(1 - pn)*.5; o.R[at + i] += s*(1 + pn)*.5; }
    t += -Math.log(1 - R())/(rate[0] + (rate[1] - rate[0])*(.5 + .5*Math.sin(x*Math.PI*3))); }
  // the hiss: noise through two low-passes, a little different each side
  for (const ch of ['L', 'R']) { let a = 0, b = 0; for (let i = 0; i < n; i++) { a += .08*((R()*2 - 1) - a); b += .3*(a - b); o[ch][i] += b*hiss*8; } }
  return fade(o, sr, 400);
}

// a hi-hat: noise high-passed twice (the sizzle) over a few short metal modes up high (the ring), dying fast
export function hat(sr, {vel = .8, decay = .06, tone = .6, seed = 1} = {}){
  const n = Math.ceil((decay*3 + .02)*sr), o = out(n);
  for (const [ch, sd] of [['L', seed], ['R', seed + 5]]) { const R = rng(sd), y = o[ch]; let p1 = 0, p2 = 0, h1 = 0;
    for (let i = 0; i < n; i++) { const x = R()*2 - 1, d1 = x - p1; p1 = x; const d2 = d1 - p2; p2 = d1; h1 = d2*(.5 + .5*tone) + h1*(.5 - .5*tone); y[i] = h1*Math.exp(-i/(decay*sr))*vel*.35; }
    for (const [f, a] of [[5400, .12], [7100, .09], [8900, .07], [11300, .05]]) { let ph = R()*6.28; for (let i = 0; i < n; i++) { ph += 2*Math.PI*f*(.5 + tone)/sr; y[i] += Math.sin(ph)*a*vel*Math.exp(-i/(decay*.7*sr)); } } }
  return o;
}
