// Journey: pace, from floating to frantic.
import { J } from './core.js';
import { TUNE } from '../tuning.js';

/* pace: how fast everything moves, how hard the kick lands, and how often the visuals pulse.
   0 is floating (slow, soft, once a bar), 1 is frantic (full speed, every beat). each section has its own */
export const PACE = {v:1, ts:1, punch:1, div:1, k:1};
const PACE_NAMES = [[.3, 'floating'], [.55, 'steady'], [.8, 'driving'], [2, 'frantic']];
export const paceName = v => PACE_NAMES.find(([lim]) => v < lim)[1];
export const paceDiv = v => v < TUNE.pace.divBar ? 4 : v < TUNE.pace.divHalf ? 2 : 1;   // pulse once a bar, every other beat, or every beat
export function setPace(v){
  const T = TUNE.pace;
  PACE.v = v; PACE.ts = T.speed[0] + T.speed[1]*v; PACE.punch = T.punch[0] + T.punch[1]*v; PACE.k = T.follow[0] + T.follow[1]*v;
  PACE.div = paceDiv(v);
}
// a new pace that contrasts with the current one, so the piece doesn't sit at one speed
export function pickPace(){
  const cur = J.pace === undefined ? .5 : J.pace; let p = Math.random();
  for (let i = 0; i < 12 && Math.abs(p - cur) < .3; i++) p = Math.random();
  return p;
}
