// Audio analysis: levels, and onsets for kicks and stabs.
import { S } from '../state.js';
import { gridFrame, gridKick, onBeatFX } from './beatgrid.js';
import { analyser, buffer } from './player.js';
import { synth } from './synth.js';
import { onHitFX } from '../fx/effects.js';
import { PACE } from '../journey/pace.js';
import { dataArr, freq, wave, waveS } from '../state.js';
import { reduceMotion } from '../util.js';

const intervals = [];
/* ---------- analysis ---------- */
export let sBass = 0, sMid = 0, sTreb = 0, lastBeat = 0, hit = 0, lastHit = 0;
const prevSpec = new Uint8Array(1024), loFlux = [], hiFlux = [];
const kickFl = [], hitFl = [];
// analyser bytes are decibels; onsets are judged on actual loudness so faint noise can't pass for a kick
export const LIN = Float32Array.from({length:256}, (_, b) => Math.pow(10, (b/255*70 - 70)/20));
function upper(a, q){ if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.floor((b.length - 1)*q)]; }
export function analyse(now){
  if (buffer && analyser) { analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(wave); }
  else synth(now);
  for (let i = 0; i < 256; i++) {
    dataArr[i] = wave[i*8];
    dataArr[256+i] = freq[Math.min(1023, 1 + Math.floor(Math.pow(i/255, 2) * 700))];
  }
  for (let i = 0; i < 512; i++) { waveS[i] += (dataArr[i] - waveS[i])*PACE.k; dataArr[i] = waveS[i]; }
  const avg = (a,b) => { let s = 0; for (let i = a; i < b; i++) s += freq[i]; return s / ((b-a)*255); };
  const bass = avg(1,9), mid = avg(9,90), treb = avg(90,400);
  sBass += (bass - sBass)*.3; sMid += (mid - sMid)*.2; sTreb += (treb - sTreb)*.25;
  // onsets: how much the spectrum jumped since the last frame (spectral flux)
  let fl = 0, fh = 0;
  for (let i = 1; i < 7; i++) { const d = LIN[freq[i]] - LIN[prevSpec[i]]; if (d > 0) fl += d; }
  for (let i = 12; i < 120; i++) { const d = LIN[freq[i]] - LIN[prevSpec[i]]; if (d > 0) fh += d; }
  let ft = 0; for (let i = 200; i < 500; i++) { const d = LIN[freq[i]] - LIN[prevSpec[i]]; if (d > 0) ft += d; }
  prevSpec.set(freq); fl /= 6; fh /= 108; ft /= 300;
  const lq = upper(loFlux, .6), hq = upper(hiFlux, .75);
  // compare against the typical strength of recent kicks/hits, so quieter bleed doesn't count
  const kT = kickFl.length > 2 ? upper(kickFl, .5)*.4 : 0, hT = hitFl.length > 2 ? upper(hitFl, .5)*.4 : 0;
  loFlux.push(fl); if (loFlux.length > 50) loFlux.shift();
  hiFlux.push(fh); if (hiFlux.length > 50) hiFlux.shift();
  if (fh > Math.max(.004, hq*3.5, hT) && fh > ft*1.6 && fl < fh*.8 && now - lastHit > 160 && now - lastBeat > 90) {
    hitFl.push(fh); if (hitFl.length > 8) hitFl.shift();
    hit = reduceMotion ? .5 : 1; lastHit = now; onHitFX();
  }
  if (fl > Math.max(.03, lq*2.5, kT) && bass > .25 && now - lastBeat > 200) {
    kickFl.push(fl); if (kickFl.length > 8) kickFl.shift();
    const iv = (now - lastBeat)/1000;
    if (iv > .25 && iv < 1.1) { intervals.push(iv); if (intervals.length > 8) intervals.shift();
      S.beatPeriod = [...intervals].sort((x, y) => x - y)[intervals.length >> 1]; }
    lastBeat = now; gridKick(now/1000); onBeatFX();
  }
  gridFrame(now/1000, fl, fh, ft);
  S.beat *= .93 - .09*PACE.v; hit *= .82;               // calm pulses swell and fade; frantic ones snap
}
