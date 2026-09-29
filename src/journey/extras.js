// Journey's extras: the settings beyond the roles (the kaleidoscope, the film grain, each layer's own speed and size), chosen
// per section with its cast and kept with it, so Journey reaches every setting, in any combination with the rest.
import { J, jState } from './core.js';
import { byKey } from '../visuals/registry.js';
import { knobs } from '../scene/tweaks.js';
import { TUNE } from '../tuning.js';
import { STEER } from './steer.js';

const lerp = ([a, b], f) => a + (b - a)*f, rnd = r => lerp(r, Math.random());
const pickW = w => { let r = Math.random()*w.reduce((a, b) => a + b, 0); const i = w.findIndex(x => (r -= x) <= 0); return i < 0 ? 0 : i; };

// the kaleidoscope: a recipe that has one brings it; otherwise some sections, more of them when intense. What it folds
// suits the cast: round a centrepiece mostly inside it, over a world mostly the world, on the black mostly the glow
export function chooseKal(force){
  const K = TUNE.extras.kal, T = J.tension, R = J.recipe;
  J.kal = null;
  if (STEER.pin.kal || STEER.ban.kal) { steerKal(); return; }
  if (!force && R && R.kal) { if (Math.random() < K.recipe) J.kal = {...R.kal}; return; }
  const chance = (K.chance + K.intense*(T - .5))*(J.world === 'cosmos' ? K.cosmos : 1);
  if (!force && Math.random() >= chance) return;
  J.kal = {n: Math.round(lerp(K.n, Math.min(1, T*.7 + Math.random()*.3))), where: whereFor(), turn: +((Math.random()*2 - 1)*K.turn).toFixed(3)};
}
const whereFor = () => { const W = TUNE.extras.kal.where; return pickW(J.centre ? W.centre : J.world && J.world !== 'none' ? W.world : W.plain); };
// steered from the keyboard (ui/keys.js, K while Journey runs): kept at n mirrors (STEER.pin.kal = n, folding STEER.kalWhere
// if one was picked), or never (STEER.ban.kal)
export function steerKal(){
  if (STEER.ban.kal) J.kal = null;
  else if (STEER.pin.kal) J.kal = {where: whereFor(), turn: .03, ...(J.kal || {}), n: STEER.pin.kal, ...(STEER.kalWhere != null ? {where: STEER.kalWhere} : {})};
}
// the film grain, now and then
export function chooseGrain(){ const G = TUNE.extras.grain; J.grain = Math.random() < G.chance ? +rnd(G.amt).toFixed(2) : 0; }
// the lead's and the accent's own speed and size: a layer staying in the cast keeps what it had (no jump mid-phrase)
export function chooseTw(){
  const W = TUNE.extras.tw, old = J.tw || {}, tw = {};
  for (const k of [J.lead, J.accent]) {
    if (!k || !byKey[k]) continue;
    if (old[k]) { tw[k] = old[k]; continue; }
    if (Math.random() >= W.chance) continue;
    const kn = knobs(byKey[k]), t = {};
    if (kn.includes('speed')) t.speed = +rnd(W.speed).toFixed(2);
    if (kn.includes('size')) t.size = +rnd(W.size).toFixed(2);
    if (Object.keys(t).length) tw[k] = t;
  }
  J.tw = tw; applyTw();
}
// Journey's own tweaks go on its state marked as its own (j), never over one set by hand, which it leaves be
export function applyTw(){
  const a = jState.tw || (jState.tw = {});
  for (const k in a) if (a[k].j) delete a[k];
  for (const k in J.tw || {}) if (!a[k]) a[k] = {...J.tw[k], j: 1};
}
// a progression step: the kaleidoscope comes in, changes its count, or goes
export function shiftKal(){
  if (!J.kal) { if (Math.random() < .5) chooseKal(true); }
  else if (Math.random() < .3) J.kal = null;
  else J.kal = {...J.kal, n: Math.max(2, Math.min(12, J.kal.n + [-2, -1, 1, 2][Math.floor(Math.random()*4)]))};
  steerKal();
}
export const KAL_WORDS = ['everything', 'the world', 'the glow', 'inside the centrepiece'];
