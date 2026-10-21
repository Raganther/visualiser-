// Journey: a plan for the whole track, made from what was read ahead (audio/foresee.js). The user asked for smarter, more
// creative choices; Journey chose one section at a time, so the best things could all come in the first minute and never
// again. Now, for a track read ahead, it plans like a VJ (TUNE.plan): it opens sparse (no centrepiece, no kaleidoscope,
// little on screen) until the first drop; the opening's lead becomes the set's motif; a headline set piece (the fractal
// depths, the cosmos, the growing branches, the nested dive …) is held back for the biggest drop and lands with it; and
// near the end it winds down and brings the motif back. Read by cast.js, worlds.js and extras.js as bonuses and holds;
// steering by hand always wins. Without a track read ahead (live input, the groovebox), there's no plan.
import { TUNE } from '../tuning.js';
import { F } from '../audio/foresee.js';
import { S } from '../state.js';
import { banned, pinned } from './steer.js';
import { byKey } from '../visuals/registry.js';

export const PLAN = {on: false, id: -1, sig: '', phase: '', open: 0, close: 0, peak: null, head: null, spent: false, motif: null, kalHead: null};
const NAME = {14: 'the nested dive', 11: 'the Droste spiral', 10: 'the hyperbolic kaleidoscope'};
const mmss = t => Math.floor(t/60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
// a piece of the plan can be had: its switch on, not left out on this device, not banned
const can = p => p.w ? byKey[p.w] && !S.skipW.has(p.w) && !banned(p.w) && (p.w !== 'kifs' || S.explore.kifs)
  : p.o ? byKey[p.o] && !banned(p.o) && (p.o !== 'branches' || S.explore.grow)
  : p.k != null ? !banned('kal') && (p.k !== 14 || S.explore.nest) : false;
export const headName = h => !h ? '' : h.w || h.o ? (byKey[h.w || h.o] || {}).label || h.w || h.o : NAME[h.k] || 'a kaleidoscope';
function build(){
  const P = TUNE.plan, dur = F.dur;
  PLAN.id = F.id; PLAN.spent = false; PLAN.motif = null; PLAN.phase = '';
  PLAN.on = !!P.on && F.ready && dur > P.minSecs;
  if (!PLAN.on) return;
  const drops = F.drops.filter(d => d.t >= 8 && d.t < dur - 10);
  PLAN.peak = drops.length ? drops.reduce((a, b) => (b.depth || 0)*(b.jump ? .6 : 1) > (a.depth || 0)*(a.jump ? .6 : 1) ? b : a) : null;
  PLAN.open = Math.min(drops.length ? drops[0].t : dur*P.openShare, dur*P.openShare, P.openMax);
  PLAN.close = dur*(1 - P.closeShare);
  // the headline: the same track always gets the same one (its length is its seed), from those that can be had
  const pool = P.pieces.filter(can); let r = ((Math.sin(Math.round(dur*10)*12.9898) * 43758.5453) % 1 + 1) % 1;
  const tot = pool.reduce((s, p) => s + p.wt, 0); r *= tot;
  PLAN.head = PLAN.peak && pool.length ? pool.find(p => (r -= p.wt) <= 0) || pool[0] : null;
}
// each frame (journey/director.js): where in the track we are, and the plan's phase; returns the new phase when it changes
export function planStep(){
  const sig = F.id + (F.ready ? 'r' : ''); if (sig !== PLAN.sig) { PLAN.sig = sig; build(); }   // (a new track, or the one read ahead now ready)
  if (!PLAN.on || !F.at) { PLAN.phase = ''; return null; }
  const t = F.at(), pk = PLAN.peak, P = TUNE.plan;
  const ph = t < PLAN.open ? 'open' : pk && t >= pk.t - 1 && t < pk.t + P.peakSecs ? 'peak' : t >= PLAN.close ? 'close' : pk && t < pk.t ? 'build' : 'develop';
  if (pk && t >= pk.t + P.peakSecs) PLAN.spent = true;
  if (ph === PLAN.phase) return null;
  PLAN.phase = ph; return ph;
}
const isHead = k => { const h = PLAN.head; return !!h && (h.w === k || h.o === k); };
// a world, layer or object's bonus from the plan: the headline held back until the peak, and brought in with it; in the
// closing phase the motif comes back
export function planBonus(k){
  if (!PLAN.on || pinned(k)) return 0;
  const P = TUNE.plan;
  if (isHead(k) && !PLAN.spent) return PLAN.phase === 'peak' ? P.headBonus : -P.hold;
  if (PLAN.phase === 'close' && PLAN.motif && (PLAN.motif.lead === k || PLAN.motif.world === k)) return P.motif;
  return 0;
}
// how much a centrepiece's and a kaleidoscope's chance is scaled (sparse at the opening, winding down at the close)
export const planChance = () => !PLAN.on ? 1 : PLAN.phase === 'open' ? TUNE.plan.openChance : PLAN.phase === 'close' ? TUNE.plan.closeChance : 1;
// how much less room the picture has (sparser): at the opening and the close
export const planRoom = () => !PLAN.on ? 0 : PLAN.phase === 'open' ? TUNE.plan.openRoom : PLAN.phase === 'close' ? TUNE.plan.closeRoom : 0;
// the headline as a centrepiece or a kaleidoscope, at the peak (cast.js, extras.js)
export const headObject = () => PLAN.on && PLAN.phase === 'peak' && !PLAN.spent && PLAN.head && PLAN.head.o && can(PLAN.head) ? PLAN.head.o : null;
export const headKal = () => PLAN.on && PLAN.phase === 'peak' && !PLAN.spent && PLAN.head && PLAN.head.k != null && can(PLAN.head) ? PLAN.head.k : null;
export const kalHeld = mode => PLAN.on && !PLAN.spent && PLAN.phase !== 'peak' && PLAN.head && PLAN.head.k === mode;
// the plan in words, for the panel
export function planWords(){
  if (!PLAN.on) return '';
  const h = headName(PLAN.head), pk = PLAN.peak, P = PLAN.phase;
  const save = h && pk && !PLAN.spent && P !== 'peak' ? `saving ${h} for the drop at ${mmss(pk.t)}` : '';
  const motif = PLAN.motif && PLAN.motif.lead ? (byKey[PLAN.motif.lead] || {}).label || PLAN.motif.lead : '';
  return 'Plan: ' + [P === 'open' ? 'opening sparse' : P === 'peak' ? (h ? `the big moment: ${h}` : 'the big moment') : P === 'close' ? (motif ? `winding down, bringing back the ${motif.toLowerCase()}` : 'winding down') : P === 'build' ? 'building' : 'developing', save].filter(Boolean).join('; ');
}
