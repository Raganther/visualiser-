// Looking ahead: the whole track is read the moment it's decoded, before it plays, for its breakdowns and drops, so Journey
// can build towards a drop and land it on the beat instead of noticing it half a second after. The same rules as the live
// listening (audio/listen.js: the bass well under its loudest a while is a breakdown, its return the drop), run over the
// low end's loudness in 10 ms steps, and each drop timed from the first kick back (the sharpest rise), not from when the
// rule is sure. A leaf module: what it finds is in F. The user asked for Journey to "read the mp3 before it plays".
import { TUNE } from '../tuning.js';

// ready: the scan is done; drops: [{t (seconds into the track), brk (when its breakdown began), depth (dB the bass fell)}]
export const F = {ready: false, drops: [], brks: [], dur: 0, id: 0};
const HOP = .01;
// a two-pole low-pass (Butterworth), as a function that filters a sample at a time
function lowpass(fc, sr){
  const w = Math.tan(Math.PI*fc/sr), q = Math.SQRT1_2, n = 1/(1 + w/q + w*w);
  const b0 = w*w*n, b1 = 2*b0, a1 = 2*(w*w - 1)*n, a2 = (1 - w/q + w*w)*n;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0*x + b1*x1 + b0*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
// the low end's loudness (20-150 Hz, in dB) every 10 ms, from the track's channels (a few seconds of audio at a time, so
// a long track doesn't hold up a frame)
async function bassEnvelope(chans, sr, alive){
  const n = chans[0].length, hop = Math.round(sr*HOP), out = new Float32Array(Math.floor(n/hop)), f1 = lowpass(150, sr), f2 = lowpass(150, sr);
  let acc = 0, k = 0, j = 0;
  for (let i0 = 0; i0 < n; i0 += sr*4) {
    const i1 = Math.min(n, i0 + sr*4);
    for (let i = i0; i < i1; i++) {
      let x = 0; for (const c of chans) x += c[i]; x /= chans.length;
      const y = f2(f1(x)); acc += y*y;
      if (++k === hop) { if (j < out.length) out[j++] = 10*Math.log10(acc/hop + 1e-12); acc = 0; k = 0; }
    }
    await new Promise(r => setTimeout(r, 0));
    if (!alive()) return null;
  }
  out.dt = hop/sr;   // (the step as it came out: a whole number of samples)
  return out;
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
// read a decoded track (an AudioBuffer); a newer track starts a new read and this one gives up
export async function foresee(buffer){
  const id = ++F.id; F.ready = false; F.drops = []; F.brks = []; F.dur = buffer ? buffer.duration : 0;
  if (!buffer || !TUNE.foresee.on) return F;
  const chans = Array.from({length: Math.min(2, buffer.numberOfChannels)}, (_, c) => buffer.getChannelData(c));
  const env = await bassEnvelope(chans, buffer.sampleRate, () => id === F.id);
  if (!env) return F;
  Object.assign(F, findDrops(env), {ready: true});
  return F;
}
