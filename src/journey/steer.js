// Steering Journey while it runs: pin (keep it) or ban (never use it) any layer, world, hit, object or scene template, and
// hold the look as it is. Journey honours these as it composes each section; everything else keeps evolving. Set from the
// keyboard's groups while Journey is on (ui/keys.js); read by the casting (cast.js, worlds.js, scene/templates.js).
export const STEER = {pin: {}, ban: {}, hold: false};
export const pinned = k => !!STEER.pin[k];
export const banned = k => !!STEER.ban[k];
// the next state for k: free → pinned → banned → free. one: the others in its group (a world, an object, a scene: only
// one can be pinned at a time)
export function cycleSteer(k, one){
  if (STEER.pin[k]) { delete STEER.pin[k]; STEER.ban[k] = true; return 'ban'; }
  if (STEER.ban[k]) { delete STEER.ban[k]; return 'free'; }
  if (one) for (const o of one) delete STEER.pin[o];
  STEER.pin[k] = true; return 'pin';
}
export function clearSteer(keys){ for (const k of keys) { delete STEER.pin[k]; delete STEER.ban[k]; } }
export const anySteer = () => STEER.hold || Object.keys(STEER.pin).length > 0 || Object.keys(STEER.ban).length > 0;
