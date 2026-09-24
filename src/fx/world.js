// Animation state for the worlds: loudness history for the mountains, stars, planet and moons.
import { S } from '../state.js';
import { sBass } from '../audio/analysis.js';
import { J } from '../journey/core.js';
import { PACE } from '../journey/pace.js';
import { HIST } from '../state.js';

/* ---------- worlds: landscape and space ---------- */
export const WORLD = {citySeed:0, histT:0, starPh:0, lightAng:0, moonAng:0, moonTarget:0, landY:-.05};
export function stepWorld(dt, react, now){
  const t = now/1000;
  WORLD.histT += dt;
  while (WORLD.histT >= .12) {                        // record loudness for the mountains
    WORLD.histT -= .12; HIST.copyWithin(0, 1);
    const lvl = (J.eM - J.lo)/Math.max(.06, J.hi - J.lo);
    HIST[255] = Math.round(Math.min(1, Math.max(0, lvl*.7 + sBass*.4))*255);
  }
  WORLD.starPh += dt*PACE.ts*(.03 + J.tension*.25 + S.beat*.25);
  WORLD.lightAng += dt*.05;
  WORLD.moonAng += (WORLD.moonTarget - WORLD.moonAng)*Math.min(1, dt*5);
  const R = .2 + sBass*react*.03, px = innerWidth/innerHeight*.18 + Math.sin(t*.05)*.05, py = .06 + Math.sin(t*.037)*.03;
  WORLD.planet = [px, py, R];
  const m = new Float32Array(8);
  [[WORLD.moonAng, 2.6, .032], [WORLD.moonAng*.6 + 2, 3.3, .022]].forEach(([a, orbit, mr], i) => {
    m[i*4] = px + Math.cos(a)*R*orbit; m[i*4 + 1] = py + Math.sin(a)*R*orbit*.3; m[i*4 + 2] = mr; m[i*4 + 3] = Math.sin(a) < 0 ? 1 : 0;
  });
  WORLD.moons = m;
}
