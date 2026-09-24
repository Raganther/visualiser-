// The beat grid: tempo, a steady clock, the downbeat, and the per-beat hook.
import { S } from '../state.js';
import { firePulse } from '../fx/pulse.js';
import { J, OPENING } from '../journey/core.js';
import { PACE } from '../journey/pace.js';
import { progress } from '../journey/progression.js';
import { newSection } from '../journey/sections.js';
import { eff } from '../presets.js';
import { HIT_VISUALS, VISUALS } from '../visuals/registry.js';

export function onBeatFX(){
  J.kr += .5;
  if (!G.locked) { J.upos = (J.upos + 1) % 4; gridBeat(J.upos); }   // no beat grid yet: count the kicks themselves
}
// one beat of the bar (pos 0 is the downbeat), from the beat grid, or from the kicks until the grid locks
function gridBeat(pos){
  J.beats++; J.pos = pos;
  if (pos % PACE.div === 0) firePulse();
  for (const v of VISUALS) if (v.onBeat) v.onBeat(pos, J.beats);   // visuals that move with the beat (moons, city windows)
  const down = pos === 0;
  if (down) J.bar++;
  const barIn = J.bar - J.phraseAnchor, phrase = down && barIn % 4 === 0;
  if (down) for (const h of HIT_VISUALS) if (h.trigger === 'downbeat' && eff[h.key] > .02) h.fire({J, ty: J.on ? J.type || OPENING : OPENING});
  if (!J.on) return;
  if (down) J.cutNow = true;                             // held switches land on the bar line
  if (phrase) J.phraseNow = true;
  if (J.pending && down) newSection(J.pendStrength);
  if (down && J.accTrig === 'bar') J.accEnv = 1;
  if (phrase && J.accTrig === 'peak' && J.fS.lvl > .55) J.accEnv = 1;   // start of each loud phrase
  // progression: about every 16 bars (scaled by Evolution speed) without a change in the music, on a 4-bar line
  J.progBeats++;
  if (phrase && J.type && J.progBeats >= Math.max(16, Math.round(64/J.speed/16)*16)) progress();
  if (phrase) J.spinDir *= -1;                            // spin reverses every 4 bars
  if (down && barIn % 8 === 0 && Math.random() < .4) J.zoomFlip = -.03;   // occasional pull-back
}
/* ---------- beat grid: tempo from the kicks, a clock that keeps time through missed kicks and breakdowns,
   and the downbeat found from where claps and snares fall (2 and 4) and where crashes and changes land (the 1) ---------- */
export const G = {period:0, next:0, n:0, down:0, locked:false, conf:0, miss:0, fit:0, prevKick:0, kicks:[], alt:0, altN:0,
  bb:[0,0,0,0], mid:[0,0,0,0], ev:0, win:null, cand:-1, candN:0, lastT:0};
export function gridReset(keepTempo){
  G.locked = false; G.conf = 0; G.miss = 0; G.fit = 0; G.prevKick = 0; G.kicks.length = 0; G.win = null;
  G.bb.fill(0); G.mid.fill(0); G.ev = 0; G.candN = 0; if (!keepTempo) G.period = 0;
}
// the beat length that best explains the gaps between recent kicks (each gap should be a whole number of beats)
function estimatePeriod(ts){
  let best = 0, bp = 0;
  for (let P = .33; P <= .8; P += .003) {
    let sc = 0;
    for (let i = 1; i < ts.length; i++) for (let j = Math.max(0, i - 6); j < i; j++) {
      const r = (ts[i] - ts[j])/P, k = Math.round(r); if (k < 1 || k > 8) continue;
      const e = (r - k)*P; sc += Math.exp(-e*e/.00045)/k;
    }
    sc *= Math.exp(-Math.pow(Math.log2(P/.47), 2)*1.5);   // a gentle preference for dance tempos
    if (sc > best) { best = sc; bp = P; }
  }
  return bp;
}
export function gridKick(t){
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
    if (Math.abs(e) < .12*P) { G.next += e*.3; G.period = Math.min(.85, Math.max(.3, P + e*.05)); G.conf = Math.min(1, G.conf + .15); G.miss = 0; }
    else if (++G.miss >= 4) { G.locked = false; G.fit = 0; }   // lost it (a seek, a new rhythm): find the beat again
    return;
  }
  // not locked: three kicks in a row on the grid and it locks, starting with this kick
  if (G.prevKick) { const r = (t - G.prevKick)/P, k = Math.round(r); G.fit = k >= 1 && k <= 4 && Math.abs(r - k) < .08 ? G.fit + 1 : 1; }
  else G.fit = 1;
  G.prevKick = t;
  if (G.fit >= 3) {
    G.locked = true; G.conf = .5; G.miss = 0; G.next = t;
    G.n = J.upos; G.down = 0;                            // carry on counting from where the kicks had got to
    G.bb.fill(0); G.mid.fill(0); G.ev = 0; G.candN = 0; G.win = null;
  }
}
function gridTick(t){
  if (G.win) {                                            // what happened just after the last beat
    const w = G.win, a = .15; G.bb[w.slot] += (w.bb - G.bb[w.slot])*a; G.mid[w.slot] += (w.mid - G.mid[w.slot])*a; G.ev++;
  }
  G.n++;
  G.win = {slot: G.n % 4, bb: 0, mid: 0, until: t + .2*G.period};
  if (G.ev >= 16) {                                       // enough bars heard to judge where the 1 is
    const mb = (G.bb[0] + G.bb[1] + G.bb[2] + G.bb[3])/4 + 1e-9, mm = (G.mid[0] + G.mid[1] + G.mid[2] + G.mid[3])/4 + 1e-9;
    const S = [0, 1, 2, 3].map(d => G.bb[d]/mb + .7*(G.mid[(d + 1) % 4] + G.mid[(d + 3) % 4] - G.mid[d] - G.mid[(d + 2) % 4])/mm);
    const best = S.indexOf(Math.max(...S));
    if (best !== G.down && S[best] > S[G.down] + .12) {   // move the 1 only when the evidence holds for two bars
      if (G.cand === best) G.candN++; else { G.cand = best; G.candN = 1; }
      if (G.candN >= 8) { G.down = best; G.candN = 0; }
    } else G.candN = 0;
    G.dsure = Math.max(0, Math.min(1, (S[G.down] - Math.max(...S.filter((v, i) => i !== G.down)))/.5));
  }
  const pos = (((G.n - G.down) % 4) + 4) % 4;
  J.upos = pos;
  gridBeat(pos);
}
// run every frame: collect evidence, keep the clock ticking, let confidence fade when the kicks stop
export function gridFrame(t, fl, fh, ft){
  const dt = Math.min(.1, t - (G.lastT || t)); G.lastT = t;
  if (!G.locked) return;
  G.conf -= dt/30;
  if (G.conf <= 0) { G.locked = false; G.fit = 0; return; }
  while (t + .008 >= G.next) { gridTick(G.next); G.next += G.period; }   // half a frame early, so ticks land on the beat not after it
  if (G.win && t < G.win.until) { G.win.bb = Math.max(G.win.bb, fl + ft*2 + fh*.5); G.win.mid = Math.max(G.win.mid, fh); }
  S.beatPeriod = G.period;
}
