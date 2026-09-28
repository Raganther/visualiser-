// Audio analysis: levels, and onsets for kicks and stabs.
import { S } from '../state.js';
import { G, gridFrame, gridKick, onBeatFX } from './beatgrid.js';
import { actx, analyser, buffer, stereo } from './player.js';
import { listenFrame, listenReset } from './listen.js';
import { synth } from './synth.js';
import { onHitFX } from '../fx/effects.js';
import { PACE } from '../journey/pace.js';
import { dataArr, freq, freqDb, scopeLR, wave, waveS } from '../state.js';
import { reduceMotion } from '../util.js';
import { MEDIA } from '../media/source.js';
import { TUNE } from '../tuning.js';

const intervals = [], stL = new Float32Array(512), stR = new Float32Array(512);
/* ---------- analysis ---------- */
export let sBass = 0, sMid = 0, sTreb = 0, lastBeat = 0, hit = 0, lastHit = 0;
const fkHist = [], LF = new Float32Array(1024), prevLF = new Float32Array(1024), prevDb = new Float32Array(32), loFlux = [], hiFlux = [], kickFlux = [];
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
export function resetOnsets(){ listenReset(); kickFl.length = hitFl.length = intervals.length = kickFlux.length = loFlux.length = hiFlux.length = 0; pend = null; }
export function analyse(now){
  // a track, or a video's own sound; otherwise the built-in beat
  const real = (buffer || MEDIA.audio) && analyser;
  if (real) { analyser.getByteFrequencyData(freq); analyser.getFloatFrequencyData(freqDb); analyser.getByteTimeDomainData(wave); }
  else if (!synth(now, freqDb)) for (let i = 0; i < 1024; i++) freqDb[i] = freq[i]/255*70 - 100;   // (a test that fed bytes only)
  // actual loudness per bin (1 at -30 dB, the bytes' ceiling, and above it on loud masters), for the onsets below
  for (let i = 1; i < 520; i++) LF[i] = Math.pow(10, (Math.max(-100, freqDb[i]) + 30)/20);
  // kicks are detected about half an analysis window late, and the frame reaches the screen later still, while the sound
  // reaches the speakers later than the analyser hears it; the grid ticks early or late by the difference
  G.lead = real ? analyser.fftSize/2/actx.sampleRate + TUNE.sync.displayMs/1000 - (actx.outputLatency || actx.baseLatency || 0) - S.syncMs/1000 : 0;
  // stereo width: the side (L-R) against the whole, from the channel pair (a test can give its own)
  let width = window.__width ?? null;
  if (real && stereo) { stereo[0].getFloatTimeDomainData(stL); stereo[1].getFloatTimeDomainData(stR);
    let m = 0, s = 0; for (let i = 0; i < 512; i++) { const a = stL[i], b = stR[i]; m += (a + b)**2; s += (a - b)**2; } width = s/(m + s + 1e-9);
    for (let i = 0; i < 64; i++) { scopeLR[i*2] = stL[i*4]; scopeLR[i*2 + 1] = stR[i*4]; } }
  else for (let i = 0; i < 64; i++) { scopeLR[i*2] = (wave[i*16] - 128)/128; scopeLR[i*2 + 1] = (wave[(i*16 + 40) % 2048] - 128)/128*(1 - (window.__width ?? .1)); }   // (no stereo: the mono wave against itself a moment later)
  listenFrame(now, Math.min(.1, Math.max(0, (now - (analyse.last || now))/1000)), width); analyse.last = now;
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
  for (let i = 1; i < 7; i++) { const d = LF[i] - prevLF[i]; if (d > 0) fl += d; }
  // the kick's own flux, leaning on the sub-bass; sub1 is the lowest bin's part of it
  let fk = 0; const KW = TUNE.kick.weights;
  for (let i = 1; i < 7; i++) { const d = LF[i] - prevLF[i]; if (d > 0) fk += d*KW[i - 1]; }
  const sub1 = Math.max(0, LF[1] - prevLF[1])*KW[0];
  fk /= 6;
  for (let i = 12; i < 120; i++) { const d = LF[i] - prevLF[i]; if (d > 0) fh += d; }
  let ft = 0; for (let i = 200; i < 500; i++) { const d = LF[i] - prevLF[i]; if (d > 0) ft += d; }
  // the rises from 20 to 650 Hz in decibels (all rises alike, as the ear hears them), for the grid's pulse. In actual
  // loudness, or in the sub-bass alone, a rolling bassline's notes outweigh the kick and the pulse came out at the
  // bassline's pattern; the kick is the one that rises across the whole low end at once (its body and click)
  let fd = 0; for (let i = 1; i < 31; i++) { const v = Math.max(-100, freqDb[i]), d = v - prevDb[i]; if (d > 0) fd += d; prevDb[i] = v; }
  prevLF.set(LF); fl /= 6; fh /= 108; ft /= 300;
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
  // (timed from where its rise began: in the unclipped spectrum a loud kick keeps rising for a few frames, so it passes the
  // threshold a frame or three after it starts; the frames just before that it was already rising count as its start)
  fkHist.push([now, fk]); if (fkHist.length > 4) fkHist.shift();
  if (!pend && fk > Math.max(.03, kq*2.5, kT) && bass > .25 && now - lastBeat > 200) {
    let t0 = now; for (let i = fkHist.length - 2; i >= 0 && fkHist[i][1] > fk*TUNE.kick.startShare && now - fkHist[i][0] < 60; i--) t0 = fkHist[i][0];
    pend = {t: t0, fk, sub: 0, all: 0};
  }
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
  gridFrame(now/1000, fl, fh, ft, fd);
  S.beat *= .93 - .09*PACE.v; hit *= .82;               // calm pulses swell and fade; frantic ones snap
}
