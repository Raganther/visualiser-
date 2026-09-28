// Flying the cosmos by hand: the C group's keys (ui/keys.js), whenever it's on screen (by its slider, a preset, Journey or
// the lab). Each one holds the camera a while, so the music doesn't take it straight back.
//   1 orbit  2 approach  3 fly by  4 pull back  5 eclipse  6 drift  7 through the belt  J jump to another star system
//   8 to a black hole  9 to a pulsar  0 to twin stars  B to an asteroid belt and through it  S skim a surface  U a sunrise
//   G out to the galaxy and into another system  K the kaleidoscope: whole view, round the subject, back to the music's
//   W the subject's layers: a wire cage, the cage and a ring of motes, the motes, back to the music's
//   L land on the world being filmed (or the biggest solid one) and fly its valleys  T take off again
import { TUNE } from '../tuning.js';
import { eff } from '../presets.js';
import { byKey } from '../visuals/registry.js';

const SHOT = {1: 'orbit', 2: 'approach', 3: 'flyby', 4: 'reveal', 5: 'eclipse', 6: 'drift', 7: 'belt', s: 'skim', u: 'sunrise'}, VISIT = {8: 'hole', 9: 'pulsar', 0: 'binary'};
let fold = 0, dress = 0;
export const FLY = [['1', 'orbit'], ['2', 'approach'], ['3', 'fly by'], ['4', 'pull back'], ['5', 'eclipse'], ['6', 'drift'], ['7', 'belt'],
  ['8', 'black hole'], ['9', 'pulsar'], ['0', 'twin stars'], ['S', 'skim'], ['U', 'sunrise'], ['J', 'jump'], ['G', 'galaxy'], ['B', 'to a belt'],
  ['K', 'fold'], ['W', 'cage'], ['L', 'land'], ['T', 'take off']];
export function flyKey(k){   // true when the key did something
  const cz = byKey.cosmos;
  if (!cz || !(eff.cosmos > .05)) return false;
  if (SHOT[k]) cz.shot(SHOT[k]);   // (a shot by hand holds the camera a while)
  else if (k === 'k') { fold = (fold + 1) % 3; cz.fold(fold); }
  else if (k === 'w') { dress = (dress + 1) % 4; cz.dress(dress); }
  else if (k === 'l') { cz.land(); cz.hold(TUNE.cosmos.handSecs*4); }
  else if (k === 't') { cz.takeoff(); cz.hold(TUNE.cosmos.handSecs); }
  else if (k === 'b') {   // to the next system with a belt (unless this one has one), then through it once the jump has landed
    const from = cz.info().system; if (!cz.info().belt) cz.visit('belt');
    const t0 = Date.now(), wait = setInterval(() => { const i = cz.info();
      if (i.belt && !i.warp && (i.system !== from || Date.now() - t0 > 500)) { clearInterval(wait); cz.shot('belt'); }
      else if (Date.now() - t0 > 20000) clearInterval(wait); }, 250);
  }
  else if (VISIT[k] || k === 'j' || k === 'g') { if (VISIT[k]) cz.visit(VISIT[k]); else if (k === 'j') cz.jump(); else cz.galaxy(); cz.hold(TUNE.cosmos.handSecs); }
  else return false;
  return true;
}
