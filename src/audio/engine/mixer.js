// The mixer: channels (each deck, each instrument), each panned and levelled, into the master, then a limiter and the analyser the visuals listen to.
import { actx, analyser, ensureAudio } from '../player.js';

let master = null;
export const CHANNELS = new Map();   // key → {key, label, input, pan, out}
// the master (made on first use): a limiter, so two loud sources together don't clip, then the analyser
export function mixMaster(){
  if (master) return master;
  ensureAudio();
  master = actx.createGain();
  const lim = actx.createDynamicsCompressor();
  lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .003; lim.release.value = .1;
  master.connect(lim); lim.connect(analyser);
  return master;
}
// a channel into the master: what plugs in connects to its input. Panned centre and at level 1 it passes its sound unchanged
export function channel(key, label = key){
  let c = CHANNELS.get(key);
  if (c) return c;
  const m = mixMaster(), input = actx.createGain(), pan = actx.createStereoPanner(), out = actx.createGain();
  input.connect(pan); pan.connect(out); out.connect(m);
  CHANNELS.set(key, c = {key, label, input, pan, out});
  return c;
}
