// Audio analysis: levels, and onsets for kicks and stabs.
import { S } from '../state.js';
import { G, gridFrame, gridKick, onBeatFX } from './beatgrid.js';
import { actx, analyser, buffer } from './player.js';
import { synth } from './synth.js';
import { onHitFX } from '../fx/effects.js';
import { PACE } from '../journey/pace.js';
import { dataArr, freq, wave, waveS } from '../state.js';
import { reduceMotion } from '../util.js';
import { MEDIA } from '../media/source.js';
import { TUNE } from '../tuning.js';

const intervals = [];
/* ---------- analysis ---------- */
export let sBass = 0, sMid = 0, sTreb = 0, lastBeat = 0, hit = 0, lastHit = 0;
const prevSpec = new Uint8Array(1024), loFlux = [], hiFlux = [], kickFlux = [];
const kickFl = [], hitFl = [];
let pend = null;                                        // a low-end hit waiting to show it's a kick (see below)
// analyser bytes are decibels; onsets are judged on actual loudness so faint noise can't pass for a kick
export const LIN = Float32Array.from({length:256}, (_, b) => Math.pow(10, (b/255*70 - 70)/20));
// each band's own rhythm, 0..1 against its recent quiet and loud, for the "follows" movers: bass pumps with the kick,
// mids with claps, stabs and chords, treble with the hats (the raw levels mostly just sit high and barely move)
export const bands = {bass: 0, mid: 0, treb: 0};
const bandRange = {bass: [0, .01], mid: [0, .01], treb: [0, .01]};
function followBand(k, v){
  const r = bandRange[k];
  r[0] += (v - r[0])*(v < r[0] ? .3 : .004); r[1] += (v - r[1])*(v > r[1] ? .3 : .004);   // the quiet and loud ends drift in slowly
  bands[k] = Math.max(Math.min(1, Math.max(0, (v - r[0])/Math.max(.03, r[1] - r[0]))), bands[k]*.8);
}
function upper(a, q){ if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.floor((b.length - 1)*q)]; }
// a new track: nothing learnt from the last one carries over
export function resetOnsets(){ kickFl.length = hitFl.length = intervals.length = kickFlux.length = loFlux.length = hiFlux.length = 0; pend = null; }
export function analyse(now){
  // a track, or a video's own sound; otherwise the built-in beat
  const real = (buffer || MEDIA.audio) && analyser;
  if (real) { analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(wave); }
  else synth(now);
  // kicks are detected about half an analysis window late, and the frame reaches the screen later still, while the sound
  // reaches the speakers later than the analyser hears it; the grid ticks early or late by the difference
  G.lead = real ? analyser.fftSize/2/actx.sampleRate + TUNE.sync.displayMs/1000 - (actx.outputLatency || actx.baseLatency || 0) - S.syncMs/1000 : 0;
  for (let i = 0; i < 256; i++) {
    dataArr[i] = wave[i*8];
    dataArr[256+i] = freq[Math.min(1023, 1 + Math.floor(Math.pow(i/255, 2) * 700))];
  }
  for (let i = 0; i < 512; i++) { waveS[i] += (dataArr[i] - waveS[i])*PACE.k; dataArr[i] = waveS[i]; }
  const avg = (a,b) => { let s = 0; for (let i = a; i < b; i++) s += freq[i]; return s / ((b-a)*255); };
  const bass = avg(1,9), mid = avg(9,90), treb = avg(90,400);
  sBass += (bass - sBass)*.3; sMid += (mid - sMid)*.2; sTreb += (treb - sTreb)*.25;
  followBand('bass', bass); followBand('mid', mid); followBand('treb', treb);
  // onsets: how much the spectrum jumped since the last frame (spectral flux)
  let fl = 0, fh = 0;
  for (let i = 1; i < 7; i++) { const d = LIN[freq[i]] - LIN[prevSpec[i]]; if (d > 0) fl += d; }
  // the kick's own flux, leaning on the sub-bass; sub1 is the lowest bin's part of it
  let fk = 0; const KW = TUNE.kick.weights;
  for (let i = 1; i < 7; i++) { const d = LIN[freq[i]] - LIN[prevSpec[i]]; if (d > 0) fk += d*KW[i - 1]; }
  const sub1 = Math.max(0, LIN[freq[1]] - LIN[prevSpec[1]])*KW[0];
  fk /= 6;
  for (let i = 12; i < 120; i++) { const d = LIN[freq[i]] - LIN[prevSpec[i]]; if (d > 0) fh += d; }
  let ft = 0; for (let i = 200; i < 500; i++) { const d = LIN[freq[i]] - LIN[prevSpec[i]]; if (d > 0) ft += d; }
  prevSpec.set(freq); fl /= 6; fh /= 108; ft /= 300;
  const lq = upper(loFlux, .6), hq = upper(hiFlux, .75);
  // compare against the typical strength of recent kicks/hits, so quieter bleed doesn't count
  // the floors learnt from recent kicks and stabs are forgotten after a quiet spell, so a quieter track (or a breakdown's
  // softer kick) isn't locked out by a louder one before it
  if (now - lastBeat > TUNE.kick.forgetMs) kickFl.length = 0;
  if (now - lastHit > TUNE.kick.forgetMs*2) hitFl.length = 0;
  const K = TUNE.kick, kq = upper(kickFlux, .6), kT = kickFl.length > 2 ? upper(kickFl, .5)*.4 : 0, hT = hitFl.length > 2 ? upper(hitFl, .5)*.4 : 0;
  loFlux.push(fl); if (loFlux.length > 50) loFlux.shift();
  kickFlux.push(fk); if (kickFlux.length > 50) kickFlux.shift();
  hiFlux.push(fh); if (hiFlux.length > 50) hiFlux.shift();
  if (fh > Math.max(.004, hq*3.5, hT) && fh > ft*1.6 && fl < fh*.8 && now - lastHit > 160 && now - lastBeat > 90) {
    hitFl.push(fh); if (hitFl.length > 8) hitFl.shift();
    hit = reduceMotion ? .5 : 1; lastHit = now; onHitFX();
  }
  // kicks, not bass notes: minimal techno puts bass notes between the kicks that rise in the same low band at about half the
  // kick's strength. What sets a kick apart is its sub-bass, which often arrives a frame or two after the hit starts, so a
  // low-end hit waits a moment (K.windowMs) and counts as a kick only if enough of its rise came in the sub. It's timed
  // from its start, so the beat grid gets no extra lag.
  if (!pend && fk > Math.max(.03, kq*2.5, kT) && bass > .25 && now - lastBeat > 200) pend = {t: now, fk, sub: 0, all: 0};
  if (pend) {
    pend.sub += sub1; pend.all += fk*6;
    if (now - pend.t >= K.windowMs) {
      if (pend.sub/Math.max(1e-6, pend.all) >= K.subShare) {
        const t = pend.t, iv = (t - lastBeat)/1000;
        kickFl.push(pend.fk); if (kickFl.length > 8) kickFl.shift();
        if (iv > .25 && iv < 1.1) { intervals.push(iv); if (intervals.length > 8) intervals.shift();
          S.beatPeriod = [...intervals].sort((x, y) => x - y)[intervals.length >> 1]; }
        lastBeat = t; gridKick(t/1000); onBeatFX();
      }
      pend = null;
    }
  }
  gridFrame(now/1000, fl, fh, ft);
  S.beat *= .93 - .09*PACE.v; hit *= .82;               // calm pulses swell and fade; frantic ones snap
}
