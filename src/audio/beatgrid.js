// The beat grid: tempo, a steady clock, the downbeat, and the per-beat hook.
import { S } from '../state.js';
import { firePulse } from '../fx/pulse.js';
import { J, OPENING } from '../journey/core.js';
import { PACE } from '../journey/pace.js';
import { progress } from '../journey/progression.js';
import { newSection } from '../journey/sections.js';
import { eff } from '../presets.js';
import { HIT_VISUALS, VISUALS } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { L, listenBar } from './listen.js';
import { danceBeat } from '../scene/dance.js';
import { STEER } from '../journey/steer.js';
import { F } from './foresee.js';

export function onBeatFX(){
  J.kr += .5;
  if (!G.locked) { J.upos = (J.upos + 1) % 4; gridBeat(J.upos); }   // no beat grid yet: count the kicks themselves
}
// one beat of the bar (pos 0 is the downbeat), from the beat grid, or from the kicks until the grid locks
function gridBeat(pos){
  J.beats++; J.pos = pos;
  if (pos % PACE.div === 0) firePulse(G.map ? TUNE.foresee.map.softPulse + (1 - TUNE.foresee.map.softPulse)*G.kick : 1);   // (read ahead: as hard as the kick there is)
  for (const v of VISUALS) if (v.onBeat) v.onBeat(pos, J.beats);   // visuals that move with the beat (moons, city windows)
  danceBeat(pos, J);   // the dancers: a kick, and on the downbeat perhaps a new move (scene/dance.js)
  const down = pos === 0;
  if (down) { J.bar++; listenBar(); }   // the bar's summary, compared with the bars before (audio/listen.js)
  const barIn = J.bar - J.phraseAnchor, phrase = down && barIn % 4 === 0;
  if (down) for (const h of HIT_VISUALS) if (h.trigger === 'downbeat' && eff[h.key] > .02) h.fire({J, ty: J.on ? J.type || OPENING : OPENING});
  if (!J.on) return;
  if (down) J.cutNow = true;                             // held switches land on the bar line
  if (phrase) J.phraseNow = true;
  if (J.pending && down && !J.foreHold) newSection(J.pendStrength);   // (a known drop is near: it brings the change)
  if (down && J.accTrig === 'bar') J.accEnv = 1;
  if (phrase && J.accTrig === 'peak' && J.fS.lvl > .55) J.accEnv = 1;   // start of each loud phrase
  // progression: about every 16 bars (scaled by Evolution speed) without a change in the music, on a 4-bar line
  J.progBeats++;
  // (sooner when the same loop has run a long while: audio/listen.js)
  const pb = Math.max(16, Math.round(TUNE.progressBeats/J.speed/16)*16)*(L.loop >= TUNE.listen.loopBars ? .5 : 1);
  if (phrase && J.type && J.progBeats >= pb && !STEER.hold && !J.foreHold) progress();   // (not while held by hand)
  if (phrase) J.spinDir *= -1;                            // spin reverses every 4 bars
  if (down && barIn % 8 === 0 && Math.random() < .4) J.zoomFlip = -.03;   // occasional pull-back
}
/* ---------- beat grid: tempo from the kicks, a clock that keeps time through missed kicks and breakdowns,
   and the downbeat found from where claps and snares fall (2 and 4) and where crashes and changes land (the 1) ---------- */
export const G = {period:0, next:0, n:0, down:0, locked:false, conf:0, miss:0, fit:0, prevKick:0, kicks:[], alt:0, altN:0,
  bb:[0,0,0,0], mid:[0,0,0,0], ev:0, win:null, cand:-1, candN:0, lastT:0,
  lead:0,   // seconds to tick ahead of the kicks as detected, so the beat is seen as it's heard
  acP:0, acConf:0, onAt:0, offN:0,
  map:false, mi:0, mapX:0, mapT:0, kick:1};   // keeping time from the beat map (audio/foresee.js): the next beat's index, where the track and the clock were, the kick on this beat   // the low end's own pulse (autocorrelation) and how sure; the last kick on the grid; kicks off it since
export function gridReset(keepTempo){
  G.locked = false; G.conf = 0; G.miss = 0; G.fit = 0; G.prevKick = 0; G.kicks.length = 0; G.win = null;
  G.bb.fill(0); G.mid.fill(0); G.ev = 0; G.candN = 0; G.offN = 0; if (!keepTempo) { G.period = 0; G.acP = 0; G.acConf = 0; ENV.fill(0); }
}
// the beat length that best explains the gaps between recent kicks (each gap should be a whole number of beats)
function estimatePeriod(ts){
  let best = 0, bp = 0;
  const near = G.acP && G.acConf > TUNE.grid.acSure;   // a clear pulse: only tempos near it are considered
  for (let P = .33; P <= .8; P += .003) {
    if (near && Math.abs(P/G.acP - 1) > TUNE.grid.acNear) continue;
    let sc = 0;
    for (let i = 1; i < ts.length; i++) for (let j = Math.max(0, i - 6); j < i; j++) {
      const r = (ts[i] - ts[j])/P, k = Math.round(r); if (k < 1 || k > 8) continue;
      const e = (r - k)*P; sc += Math.exp(-e*e/.00045)/k;
    }
    sc *= Math.exp(-Math.pow(Math.log2(P/.47), 2)*1.5);   // a gentle preference for dance tempos
    // and towards the low end's own pulse, when it's clear: a rolling bassline puts onsets between the kicks that
    // can pass for kicks, but the rhythm of the whole low end still repeats at the beat
    if (G.acP) sc *= 1 - TUNE.grid.acPull*G.acConf + TUNE.grid.acPull*G.acConf*Math.exp(-Math.pow((P/G.acP - 1)/TUNE.grid.acWidth, 2));
    if (sc > best) { best = sc; bp = P; }
  }
  return bp;
}
export function gridKick(t){
  if (G.map) return;   // the beat map keeps time (below): the kicks as heard aren't needed
  G.kicks.push(t); if (G.kicks.length > 24) G.kicks.shift();
  if (G.kicks.length >= 6) {
    const est = estimatePeriod(G.kicks);
    if (est && (!G.period || !G.locked)) G.period = est;     // not locked: take the latest reading as it comes
    else if (est && Math.abs(est/G.period - 1) < .04) { G.period += (est - G.period)*.15; G.altN = 0; }
    else if (est) {                                       // a different tempo: believe it once it keeps coming back
      if (Math.abs(est/(G.alt || 1) - 1) < .04) G.altN++; else { G.alt = est; G.altN = 1; }
      if (G.altN >= 4) { G.period = est; G.altN = 0; G.locked = false; G.fit = 0; }
    }
  }
  if (!G.period) return;
  const P = G.period;
  if (G.locked) {                                         // nudge the clock toward the kick, if it's on the grid
    const e1 = t - (G.next - P), e2 = t - G.next, e = Math.abs(e1) < Math.abs(e2) ? e1 : e2;
    if (Math.abs(e) < TUNE.grid.onGrid*P) { G.next += e*.3; G.period = Math.min(.85, Math.max(.3, P + e*.05)); G.conf = Math.min(1, G.conf + .15); G.miss = 0; G.onAt = t; G.offN = 0; }
    // a kick off the grid (a bass note, a fill) is let be; only two bars of kicks with none on the grid lose it (a seek, a new rhythm)
    else if (++G.offN >= 6 && t - G.onAt > 8*P) { G.locked = false; G.fit = 0; G.offN = 0; }
    return;
  }
  // not locked: three kicks in a row on the grid and it locks, starting with this kick
  // (a kick between the beats of the chain so far is let be, rather than starting it again, unless the chain is old)
  if (G.prevKick) { const r = (t - G.prevKick)/P, k = Math.round(r), on = k >= 1 && k <= 4 && Math.abs(r - k) < TUNE.grid.lockFit;
    if (on) { G.fit++; G.prevKick = t; } else if (r > 4.5) { G.fit = 1; G.prevKick = t; } }
  else { G.fit = 1; G.prevKick = t; }
  // (and only when the low end has a clear pulse, once there's enough heard to say: a slow song's drums otherwise lock a
  // false dance tempo)
  if (G.fit >= 3 && (envN < 240 || G.acConf > TUNE.grid.acLock)) {
    G.locked = true; G.conf = .5; G.miss = 0; G.next = t;
    G.n = J.upos; G.down = 0;                            // carry on counting from where the kicks had got to
    G.bb.fill(0); G.mid.fill(0); G.ev = 0; G.candN = 0; G.win = null;
  }
}
// the beat map (audio/foresee.js), when the track was read ahead: every beat known before it plays, so the grid is locked
// from the first beat, keeps exact time through breakdowns, and knows the 1 and the phrases. Where the track is comes from
// the player (F.at: as heard, as the frame will reach the screen, by the Sync slider). Returns whether it's keeping time
function mapFrame(t){
  const M = F.map, x = M && F.at ? F.at() : null;
  if (x == null) { if (G.map) { G.map = false; G.locked = false; G.fit = 0; } return false; }
  const B = M.beats, fresh = !G.map || Math.abs((x - G.mapX) - (t - G.mapT)) > .25;   // starting, or a seek: no burst of beats
  if (fresh) {
    let lo = 0, hi = B.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (B[mid] <= x + .008) lo = mid + 1; else hi = mid; }
    G.mi = lo; G.map = true; G.locked = true;
    const bar = Math.floor((lo - M.down)/4);   // the bars counted as the map counts them, and phrases on its phrase lines
    J.bar = bar; J.mapPhrase = M.phrase; J.phraseAnchor = bar - (((bar - M.phrase) % 4) + 4) % 4;
  }
  G.mapX = x; G.mapT = t;
  while (G.mi < B.length && B[G.mi] <= x + .008) {   // half a frame early, so ticks land on the beat not after it
    const i = G.mi++, pos = (((i - M.down) % 4) + 4) % 4;
    G.n = i; G.kick = M.kick[i]; J.upos = pos;
    if (pos === 0) J.bar = Math.floor((i - M.down)/4) - 1;   // (gridBeat counts it on)
    gridBeat(pos);
  }
  const i = Math.min(B.length - 1, G.mi);
  G.period = i > 0 ? B[i] - B[i - 1] : M.period; G.next = t + (B[i] - x); G.conf = 1; G.down = 0; G.dsure = M.dsure; G.ev = 99;
  S.beatPeriod = G.period;
  return true;
}
function gridTick(t){
  if (G.win) {                                            // what happened just after the last beat
    const w = G.win, a = .15; G.bb[w.slot] += (w.bb - G.bb[w.slot])*a; G.mid[w.slot] += (w.mid - G.mid[w.slot])*a; G.ev++;
  }
  G.n++;
  G.win = {slot: G.n % 4, bb: 0, mid: 0, until: t + .2*G.period};
  if (G.ev >= TUNE.grid.downMinBeats) {                                       // enough bars heard to judge where the 1 is
    const mb = (G.bb[0] + G.bb[1] + G.bb[2] + G.bb[3])/4 + 1e-9, mm = (G.mid[0] + G.mid[1] + G.mid[2] + G.mid[3])/4 + 1e-9;
    const S = [0, 1, 2, 3].map(d => G.bb[d]/mb + TUNE.grid.clapWeight*(G.mid[(d + 1) % 4] + G.mid[(d + 3) % 4] - G.mid[d] - G.mid[(d + 2) % 4])/mm);
    const best = S.indexOf(Math.max(...S));
    if (best !== G.down && S[best] > S[G.down] + TUNE.grid.downMargin) {   // move the 1 only when the evidence holds for two bars
      if (G.cand === best) G.candN++; else { G.cand = best; G.candN = 1; }
      if (G.candN >= TUNE.grid.downHoldBeats) { G.down = best; G.candN = 0; }
    } else G.candN = 0;
    G.dsure = Math.max(0, Math.min(1, (S[G.down] - Math.max(...S.filter((v, i) => i !== G.down)))/.5));
  }
  const pos = (((G.n - G.down) % 4) + 4) % 4;
  J.upos = pos;
  gridBeat(pos);
}
// the low end's own pulse: its rises in decibels (fd) at 60 a second over the last 8 s, autocorrelated every half second; the beat
// length it repeats at most strongly (G.acP), and how clearly (G.acConf, 0..1)
const ENV = new Float32Array(512);
let envBin = -1, envN = 0;
function pulse(t, fd){
  const k = Math.floor(t*60);
  if (k !== envBin) { if (envBin >= 0) for (let j = envBin + 1; j < k && j < envBin + 60; j++) ENV[j % 512] = 0; envBin = k; ENV[k % 512] = 0; envN++; }
  ENV[k % 512] = Math.max(ENV[k % 512], fd);
  if (envN % 30 || envN < 240) return;
  const n = Math.min(480, envN), x = new Float32Array(n);
  let m = 0; for (let i = 0; i < n; i++) { x[i] = ENV[(k - i + 512*4) % 512]; m += x[i]; } m /= n;
  let v = 0; for (let i = 0; i < n; i++) { x[i] -= m; v += x[i]*x[i]; }
  if (v < 1e-9) { G.acConf *= .8; return; }
  const ac = []; for (let L = 17; L <= 200; L++) { let s = 0; for (let i = L; i < n; i++) s += x[i]*x[i - L]; ac[L] = s/v; }
  // a beat repeats at its own length, at twice it (half a bar) and at four times it (a bar); a bassline's pattern (three
  // sixteenths, say) repeats at its own length but not in step with the bar. And the grid's gentle leaning to dance tempos
  const sc = L => (ac[L] + .5*ac[2*L] + .25*ac[4*L])*Math.exp(-Math.pow(Math.log2(L/60/.47), 2)*1.5);
  let best = 20; for (let L = 20; L <= 49; L++) if (sc(L) > sc(best)) best = L;
  const a = ac[best - 1], b = ac[best], c = ac[best + 1], off = (a - c)/(2*(a - 2*b + c) || 1);   // between frames: the parabola's top
  const acP = (best + Math.max(-.5, Math.min(.5, off)))/60, conf = Math.max(0, Math.min(1, b/TUNE.grid.acClear));
  G.acP = G.acP && Math.abs(acP/G.acP - 1) < .03 ? G.acP + (acP - G.acP)*.3 : acP; G.acConf = conf;
}
// run every frame: collect evidence, keep the clock ticking, let confidence fade when the kicks stop
export function gridFrame(t, fl, fh, ft, fd = fl){
  const gap = t - (G.lastT || t), dt = Math.min(.1, gap); G.lastT = t;
  pulse(t, fd);
  if (mapFrame(t)) return;
  if (!G.locked) return;
  G.conf -= (gap > 1 ? gap : dt)/TUNE.grid.holdSecs;       // a long gap (a hidden tab) counts in full
  if (G.conf <= 0) { G.locked = false; G.fit = 0; return; }
  // missed whole bars are skipped, not ticked all at once (that fired a burst of beats, sections and shatters in one frame)
  const behind = t + .008 + G.lead - G.next, bar = 4*G.period;
  if (behind > bar) G.next += Math.floor(behind/bar)*bar;
  while (t + .008 + G.lead >= G.next) { gridTick(G.next); G.next += G.period; }   // half a frame early, so ticks land on the beat not after it
  if (G.win && t < G.win.until) { G.win.bb = Math.max(G.win.bb, fl + ft*2 + fh*.5); G.win.mid = Math.max(G.win.mid, fh); }
  S.beatPeriod = G.period;
}
