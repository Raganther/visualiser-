// Journey's speed gears: the movement (the motion clock: turning, zooming, the kaleidoscope, the layers, the objects' spin,
// the colours' drift) at half time, normal or double time, changing on phrase lines with the music's shape. The pulse, the
// flashes and the facets' light stay on the beat whatever the gear: only how fast things travel changes.
// The user found it always moving at one fast speed once a track kicked in (the tension pinned near 1 sets nearly everything).
import { J } from './core.js';
import { TUNE } from '../tuning.js';
import { L } from '../audio/listen.js';
import { STEER } from './steer.js';
import { S } from '../state.js';

export const GEARS = [{v: .5, name: 'half time'}, {v: 1, name: 'normal speed'}, {v: 1.6, name: 'double time'}];
let seed = 23; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;   // (its own numbers: Journey's draws are untouched)
const pick = w => { let r = rnd()*w.reduce((a, b) => a + b, 0); const i = w.findIndex(x => (r -= x) <= 0); return i < 0 ? 1 : i; };
function set(g){ if (g !== J.gear) { J.gear = g; J.gearAt = J.bar; } }

// on each phrase line (from the beat grid): perhaps a new gear
export function gearPhrase(){
  const T = TUNE.gear;
  if (STEER.gear != null) return set(STEER.gear);   // held by hand
  if (J.grooveE < T.floatBelow) return set(0);       // no groove (a breakdown, an ambient stretch): it floats
  if (J.anticip > 0) return set(J.gear === 2 || rnd() < T.buildDouble ? 2 : 1);   // a drop coming: picking up speed into it
  const since = J.bar - (J.gearAt ?? -99), sinceDrop = J.bar - (J.gearDrop ?? -99);
  if (sinceDrop < T.dropBars) return;                // the drop's own speed plays out
  if (sinceDrop < T.dropBars + 4 && J.gear !== 0 && rnd() < T.afterDrop) return set(0);   // then it often settles into half time
  if (since < T.minBars || rnd() > T.change) return;
  const w = [...T.weights]; if (L.loop >= TUNE.listen.loopBars) w[0] *= T.loopHalf;   // a long loop: half time more often
  w[J.gear ?? 1] = 0; set(pick(w));                  // (always another one: it alternates)
}
// a drop: at least normal speed, at once (it lands with weight), and its own bars before the gears move on
export function gearDrop(){ J.gearDrop = J.bar; if (STEER.gear == null && (J.gear ?? 1) < 1) set(1); if (J.gear >= 1) J.gearE = Math.max(J.gearE, 1); }
// each frame: the gear eased in over a bar or two (never a jolt); S.speed is what the movement runs at (1 with Journey off)
export function gearFrame(dt){
  const T = TUNE.gear, bp = S.beatPeriod > .2 ? S.beatPeriod : .5;
  if (J.gear == null) { J.gear = 1; J.gearE = 1; }
  if (STEER.gear != null && J.gear !== STEER.gear) set(STEER.gear);
  const want = STEER.gear != null ? GEARS[STEER.gear].v : J.on ? GEARS[J.gear].v : 1;   // (a gear held by hand holds with Journey off too)
  J.gearE += (want - J.gearE)*Math.min(1, dt/(T.easeBars*4*bp));
  S.speed = J.gearE*T.scale;
}
