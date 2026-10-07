// Looking ahead: the whole track is read the moment it's decoded, before it plays, so Journey knows what's coming. Two
// things come out of it. The drops: the same rules as the live listening (audio/listen.js: the bass well under its loudest
// a while is a breakdown, its return the drop), run over the low end's loudness in 10 ms steps, each drop timed from the
// first kick back, so Journey can build towards it and land it on the beat. And the beat map: the tempo fitted to every
// kick in the track at once (to a fraction of a millisecond), each beat through breakdowns and all, how hard the kick is on
// it, where the bars and four-bar phrases start, and where the track changes; the beat grid (audio/beatgrid.js) runs from
// it instead of listening for kicks. A leaf module: what it finds is in F. The user asked for Journey to "read the mp3
// before it plays", and for anything else that makes it keep time with the music.
import { TUNE } from '../tuning.js';

// ready: the scan is done; drops: [{t (seconds into the track), brk (when its breakdown began), depth (dB the bass fell)}];
// map: the beat map (below), or null when the track has no steady beat to map (a band playing freely, a beatless piece)
export const F = {ready: false, drops: [], brks: [], map: null, dur: 0, id: 0, rate: 1};   // rate: how fast the track plays (a DJ deck's tempo)
const HOP = .01;
// a two-pole low-pass (Butterworth), as a function that filters a sample at a time
function lowpass(fc, sr){
  const w = Math.tan(Math.PI*fc/sr), q = Math.SQRT1_2, n = 1/(1 + w/q + w*w);
  const b0 = w*w*n, b1 = 2*b0, a1 = 2*(w*w - 1)*n, a2 = (1 - w/q + w*w)*n;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0*x + b1*x1 + b0*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
// every 10 ms: the low end's loudness (20-150 Hz, in dB), and its energy and the rest's (for the kicks, and the claps and
// hats), from the track's channels (a few seconds of audio at a time, so a long track doesn't hold up a frame)
async function envelopes(chans, sr, alive){
  const n = chans[0].length, hop = Math.round(sr*HOP), m = Math.floor(n/hop), f1 = lowpass(150, sr), f2 = lowpass(150, sr);
  const db = new Float32Array(m), eL = new Float32Array(m), eH = new Float32Array(m);
  let aL = 0, aH = 0, k = 0, j = 0;
  for (let i0 = 0; i0 < n; i0 += sr*4) {
    const i1 = Math.min(n, i0 + sr*4);
    for (let i = i0; i < i1; i++) {
      let x = 0; for (const c of chans) x += c[i]; x /= chans.length;
      const y = f2(f1(x)), h = x - y; aL += y*y; aH += h*h;
      if (++k === hop) { if (j < m) { eL[j] = aL/hop; eH[j] = aH/hop; db[j++] = 10*Math.log10(aL/hop + 1e-12); } aL = aH = 0; k = 0; }
    }
    await new Promise(r => setTimeout(r, 0));
    if (!alive()) return null;
  }
  db.dt = hop/sr;   // (the step as it came out: a whole number of samples)
  return {db, eL, eH, dt: hop/sr};
}
// the breakdowns and drops in an envelope, by the live listening's rules (TUNE.listen), dt seconds a step
export function findDrops(env, dt = env.dt || HOP){
  const T = TUNE.listen, drops = [], brks = [];
  let s = env[0] || -120, max = s, bass = 1, brk = false, brkT = 0, upT = 0, brkAt = 0, low = 0;
  for (let i = 0; i < env.length; i++) {
    s += (env[i] - s)*Math.min(1, dt*2);
    max = Math.max(s, max - dt*T.bassForget);
    bass += (Math.max(0, Math.min(1, 1 - (max - s)/T.bassDb)) - bass)*Math.min(1, dt*3);
    if (!brk) {
      brkT = bass < T.brkBelow ? brkT + dt : Math.max(0, brkT - dt*4);
      if (brkT > T.brkSecs) { brk = true; brkAt = i*dt - brkT; low = max - s; brks.push(brkAt); }
    } else {
      low = Math.max(low, max - s);
      if (bass > T.dropAbove) { upT += dt; if (upT > T.dropHold) {
        // the drop itself: the sharpest rise in the low end in the second and a half before the rule was sure
        let best = i, rise = -1e9; for (let j = Math.max(3, i - Math.round((T.dropHold + 1.5)/dt)); j <= i; j++) { const r = env[j] - env[j - 3]; if (r > rise) { rise = r; best = j - 2; } }
        drops.push({t: +(best*dt).toFixed(3), brk: +brkAt.toFixed(2), depth: +low.toFixed(1)});
        brk = false; brkT = 0; upT = 0;
      } } else { upT = 0; brkT += dt; }
    }
  }
  // and the low end arriving (the kick and bass coming in after a beatless intro, a band after an organ): the next two
  // seconds far louder than the eight before, with no breakdown's drop near
  const J = TUNE.foresee, sum = new Float64Array(env.length + 1); for (let i = 0; i < env.length; i++) sum[i + 1] = sum[i] + env[i];
  const avg = (a, b) => (sum[b] - sum[a])/(b - a), W0 = Math.round(8/dt), W1 = Math.round(2/dt);
  for (let i = W0; i + W1 < env.length; i += 5) {
    if (avg(i, i + W1) - avg(i - W0, i) < J.jumpDb || drops.some(d => Math.abs(d.t - i*dt) < J.jumpGap)) continue;
    let best = i, rise = -1e9; for (let j = Math.max(3, i - 50); j < Math.min(env.length, i + 100); j++) { const r = env[j] - env[j - 3]; if (r > rise) { rise = r; best = j - 2; } }
    drops.push({t: +(best*dt).toFixed(3), brk: +Math.max(0, best*dt - 8).toFixed(2), depth: +(avg(i, i + W1) - avg(i - W0, i)).toFixed(1), jump: true});
  }
  drops.sort((a, b) => a.t - b.t);
  return {drops, brks};
}
// the beat map, from the envelopes (and the drops, which land on bar lines): {bpm, period, beats (seconds), kick (how hard
// the kick is on each beat, 0..1), down (the first downbeat's beat), dsure, phrase (the bar a four-bar phrase starts on),
// changes ([{t, bar}]: where the track moves on, on phrase lines), conf (how steadily the kicks keep the tempo)} or null
export function beatMap(E, drops = [], dur = E.eL.length*E.dt){
  const {eL, eH, dt} = E, n = eL.length, B = TUNE.foresee.map;
  if (n < 20/dt) return null;
  // onsets: rises in the low end's energy (the kicks), and a little of the rest's (claps, hats), each against its loud end
  const rise = e => { const r = new Float32Array(n); for (let i = 1; i < n; i++) r[i] = Math.max(0, e[i] - e[i - 1]); return r; };
  const top = (a, q) => { const s = a.filter(v => v > 0).sort(); return s[Math.floor(s.length*q)] || 1e-12; };
  const rL = rise(eL), rH = rise(eH), nL = top(rL, .98), nH = top(rH, .98), o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = Math.min(1.5, rL[i]/nL) + B.highW*Math.min(1.5, rH[i]/nH);
  // the tempo, roughly: the onsets' autocorrelation over the whole track, a beat repeating at its length, twice it and
  // four times it, leaning gently to dance tempos (as the live grid's pulse does, but over everything at once)
  let mean = 0; for (let i = 0; i < n; i++) mean += o[i]; mean /= n;
  const x = Float32Array.from(o, v => v - mean); let v0 = 0; for (let i = 0; i < n; i++) v0 += x[i]*x[i];
  const L0 = Math.floor(.3/dt), L1 = Math.ceil(.82/dt), ac = new Float32Array(4*L1 + 2);
  for (let L = 1; L < ac.length; L++) { let s = 0; for (let i = L; i < n; i++) s += x[i]*x[i - L]; ac[L] = s/v0; }
  const sc = L => (ac[L] + .5*ac[2*L] + .25*ac[4*L])*Math.exp(-Math.pow(Math.log2(L*dt/.47), 2)*1.5);
  let bL = L0; for (let L = L0; L <= L1; L++) if (sc(L) > sc(bL)) bL = L;
  const a = ac[bL - 1], b = ac[bL], c = ac[bL + 1], P0 = (bL + Math.max(-.5, Math.min(.5, (a - c)/(2*(a - 2*b + c) || 1))))*dt;
  // the onsets themselves, each timed within its 10 ms step by how its rise splits across two steps
  const pk = [];
  for (let i = 2; i < n - 1; i++) if (o[i] > B.peak && o[i] > o[i - 1] && o[i] >= o[i + 1]) {
    const back = rL[i - 1] > rL[i + 1], p = back ? rL[i]/(rL[i - 1] + rL[i] + 1e-12) : rL[i + 1]/(rL[i] + rL[i + 1] + 1e-12);
    pk.push([(back ? i - 1 + p : i + p)*dt - B.delay, o[i]]);
  }
  if (pk.length < 32) return null;
  // the tempo exactly, and where the beats fall: the period at which the onsets line up best, all at once
  let best = 0, P = P0, re0 = 0, im0 = 0, W = 0; for (const [, w] of pk) W += w;
  for (let q = P0*(1 - B.search); q <= P0*(1 + B.search); q += P0*B.step) {
    let re = 0, im = 0; for (const [t, w] of pk) { const ph = 2*Math.PI*t/q; re += w*Math.cos(ph); im += w*Math.sin(ph); }
    const m = Math.hypot(re, im); if (m > best) { best = m; P = q; re0 = re; im0 = im; }
  }
  const conf = best/W;
  if (conf < B.sure) return null;   // no steady beat: the live grid listens instead
  let t0 = ((Math.atan2(im0, re0)/(2*Math.PI))*P % P + P) % P;
  // every beat of the track, each nudged to where the kicks near it actually fall (a slow drift), within a little
  const K = Math.floor((dur - t0)/P) + 1, beats = new Float64Array(K), sw = new Float64Array(K), se = new Float64Array(K);
  for (const [t, w] of pk) { const k = Math.round((t - t0)/P); if (k < 0 || k >= K) continue; const e = t - (t0 + k*P); if (Math.abs(e) < P*.12) { sw[k] += w; se[k] += w*e; } }
  for (let k = 0; k < K; k++) {
    let w = 0, e = 0; for (let j = Math.max(0, k - 16); j <= Math.min(K - 1, k + 16); j++) { const g = Math.exp(-(((j - k)/8)**2)); w += sw[j]*g; e += se[j]*g; }
    beats[k] = t0 + k*P + (w > 2 ? Math.max(-B.drift, Math.min(B.drift, e/w)) : 0);
  }
  // the kick's low end swells a little after its attack (the click, the top of its sweep): the beats go where the attacks
  // are, by how far the whole spectrum's rise comes before the low end's, over the strong kicks (the middle of them all)
  { const eA = Float32Array.from(eL, (v, i) => v + eH[i]), rA = rise(eA), offs = [];
    for (let k = 0; k < K; k++) { const i = Math.round(beats[k]/dt); if (i < 6 || i > n - 3 || rL[i]/nL < .5 && rL[i + 1]/nL < .5) continue;
      let m = 0; for (let j = i - 4; j <= i + 1; j++) m = Math.max(m, rA[j]);
      for (let j = i - 4; j <= i + 1; j++) if (rA[j] > m*B.attack) { const f = rA[j - 1] > 0 ? 0 : .5; offs.push((j + f)*dt - B.delay - beats[k]); break; } }
    if (offs.length > 16) { offs.sort((a, b) => a - b); const sh = Math.max(-.04, Math.min(.005, offs[offs.length >> 1])); for (let k = 0; k < K; k++) beats[k] += sh; } }
  // how hard the kick is on each beat (none in a breakdown), and each beat's loudness low and high
  const kick = new Float32Array(K), bl = new Float32Array(K), bh = new Float32Array(K), dB = v => 10*Math.log10(v + 1e-12);
  for (let k = 0; k < K; k++) {
    const i = Math.round(beats[k]/dt), i1 = Math.min(n, Math.round((beats[k] + P)/dt)); let m = 0;
    for (let j = Math.max(1, i - 2); j <= Math.min(n - 1, i + 3); j++) m = Math.max(m, rL[j]/nL);
    kick[k] = Math.min(1, m/B.kickFull);
    let l = 0, h = 0, c2 = 0; for (let j = Math.max(0, i); j < i1; j++) { l += eL[j]; h += eH[j]; c2++; }
    bl[k] = dB(l/Math.max(1, c2)); bh[k] = dB(h/Math.max(1, c2));
  }
  const near = t => Math.max(0, Math.min(K - 1, Math.round((t - t0)/P)));
  // the downbeat: changes land on the 1 (a new part, a breakdown, the drops), and claps fall on 2 and 4
  const dsc = [0, 1, 2, 3].map(d => {
    let chg = 0, cn = 0, clap = 0, votes = 0;
    for (let k = 1; k < K; k++) { const ch = Math.abs(bl[k] - bl[k - 1]) + Math.abs(bh[k] - bh[k - 1]); if ((k - d) % 4 === 0) { chg += ch; cn++; } }
    let all = 0; for (let k = 1; k < K; k++) all += Math.abs(bl[k] - bl[k - 1]) + Math.abs(bh[k] - bh[k - 1]); all /= K - 1;
    for (let k = 0; k < K; k++) { const i = Math.round(beats[k]/dt); let h = 0; for (let j = Math.max(1, i - 2); j <= Math.min(n - 1, i + 3); j++) h = Math.max(h, rH[j]/nH);
      const r = (((k - d) % 4) + 4) % 4; clap += r % 2 ? h : -h; }
    for (const t of [...drops.map(x => x.t), ...drops.filter(x => !x.jump).map(x => x.brk)]) if (((near(t) - d) % 4 + 4) % 4 === 0) votes++;
    return (cn ? chg/cn/(all || 1) : 0) + B.clapW*clap/K + B.dropW*votes/Math.max(1, drops.length);
  });
  const down = dsc.indexOf(Math.max(...dsc)), dsure = Math.max(0, Math.min(1, (dsc[down] - Math.max(...dsc.filter((_, i) => i !== down)))/B.downMargin));
  // bars (from the first downbeat), and which of every four starts a phrase: again where the changes and drops land
  const NB = Math.floor((K - down)/4), feat = [];
  for (let m = 0; m < NB; m++) { let l = 0, h = 0, kk = 0; for (let j = 0; j < 4; j++) { const k = down + m*4 + j; l += bl[k]; h += bh[k]; kk += kick[k]; } feat.push([l/4, h/4, kk/4]); }
  const barOf = t => Math.round((near(t) - down)/4);
  const psc = [0, 1, 2, 3].map(p => { let s = 0, c3 = 0; for (let m = p || 4; m < NB; m += 4) { s += feat[m].reduce((a, v, i) => a + Math.abs(v - feat[m - 1][i]), 0); c3++; }
    for (const d of drops) if (((barOf(d.t) - p) % 4 + 4) % 4 === 0) s += B.dropW*c3/Math.max(1, drops.length);
    return c3 ? s/c3 : 0; });
  const phrase = psc.indexOf(Math.max(...psc));
  // where the track moves on: on phrase lines, the four bars after unlike the four before (against how much bars vary)
  const sd = [0, 1, 2].map(i => { const v = feat.map(f => f[i]), m = v.reduce((a, b) => a + b, 0)/Math.max(1, v.length); return Math.sqrt(v.reduce((a, b) => a + (b - m)**2, 0)/Math.max(1, v.length)) || 1; });
  const nov = m => { let s = 0; for (let i = 0; i < 3; i++) { let a = 0, b2 = 0; for (let j = 0; j < 4; j++) { a += feat[m + j][i]; b2 += feat[m - 4 + j][i]; } s += ((a - b2)/4/sd[i])**2; } return Math.sqrt(s); };
  const changes = [];
  for (let m = phrase + 4; m + 4 <= NB; m += 4) { const v = nov(m); if (v > B.change && (m < 8 || v >= nov(m - 4)) && (m + 8 > NB || v >= nov(m + 4))) changes.push({t: +beats[down + m*4].toFixed(4), bar: m, nov: +v.toFixed(2)}); }
  // the drops land on the beat they fall nearest
  for (const d of drops) { const k = near(d.t); if (Math.abs(beats[k] - d.t) < P*B.snap) { d.t = +beats[k].toFixed(4); d.beat = k; } }
  return {bpm: +(60/P).toFixed(3), period: P, beats, kick, down, dsure: +dsure.toFixed(2), phrase, changes, conf: +conf.toFixed(3)};
}
// read a decoded track (an AudioBuffer); a newer track starts a new read and this one gives up
export async function foresee(buffer){
  const id = ++F.id; F.ready = false; F.drops = []; F.brks = []; F.map = null; F.dur = buffer ? buffer.duration : 0;
  const r = await readAhead(buffer, () => id === F.id);
  if (r) Object.assign(F, r);
  return F;
}
// the same reading for a track that isn't the one playing (a DJ deck's: audio/dj.js), into its own result, leaving F alone;
// null when there's nothing to read or it was given up (alive() false)
export async function readAhead(buffer, alive = () => true){
  if (!buffer || !TUNE.foresee.on) return null;
  const chans = Array.from({length: Math.min(2, buffer.numberOfChannels)}, (_, c) => buffer.getChannelData(c));
  const E = await envelopes(chans, buffer.sampleRate, alive);
  if (!E) return null;
  const D = findDrops(E.db);
  return {...D, map: TUNE.foresee.map.on ? beatMap(E, D.drops, buffer.duration) : null, dur: buffer.duration, ready: true};
}
