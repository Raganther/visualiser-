// Switching, stepping and randomizing presets.
import { S } from '../state.js';
import { ELEMS, HITS, J, WORLDS } from '../journey/core.js';
import { byKey } from '../visuals/registry.js';
import { nudge } from '../journey/director.js';
import { presets } from '../presets.js';
import { setJourney } from './controls.js';
import { syncSliders } from './panel.js';
import { toast } from './toast.js';
import { $ } from '../util.js';

export function setPreset(p, label){
  S.active = p; S.scene = p.scene || null; S.beatsInPreset = 0; S.presetSince = performance.now();
  $('#pName').textContent = label || p.name; toast(label || p.name); syncSliders();
}
export function nextPreset(dir){ if (J.on) setJourney(false); S.pIndex = (S.pIndex + dir + presets.length) % presets.length; setPreset(presets[S.pIndex]); }
export function randomize(){
  if (J.on) { nudge(); return; }
  const r = (a,b) => a + Math.random()*(b-a), pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const p = {name:'Random', decay:r(.88,.985), zoom:r(.995,1.07), rot:r(-.03,.03), warp:r(0,1.5), wander:Math.random()<.5 ? r(.05,.3) : 0,
    sym:Math.floor(r(1,9)), mirror:Math.random()<.4?1:0, colorSpeed:r(.03,.25), hueDrift:r(0,.035), mods:{}};
  const layers = [...ELEMS, ...HITS.filter(k => byKey[k].inTrails)];   // every layer, plus shockwaves (they live in the trails)
  WORLDS.forEach(k => p[k] = 0); if (Math.random() < .5) p[pick(WORLDS)] = 1;
  layers.forEach(l => p[l] = Math.random()<.3 ? r(.2,.7) : 0);
  const hits = HITS.filter(k => byKey[k].trigger !== 'pulse');   // shockwaves are handled with the layers above
  hits.forEach(k => p[k] = 0); if (Math.random() < .5) p[pick(hits)] = r(.6, 1);
  p[pick(layers)] = 1;
  const targets = ['rot','zoom','warp','sym','decay','hueDrift','mirror','wander'].sort(() => Math.random() - .5);
  const n = 2 + Math.floor(Math.random()*3);
  for (const k of targets.slice(0, n)) p.mods[k] = {src:pick(['drift','drift','bass','mid','treb','pulse','jump']), amt:+r(.1,.4).toFixed(2)};
  setPreset(p);
}
