// Movers: settings that drift or follow the music by themselves.
import { S } from '../state.js';
import { sBass, sMid, sTreb } from '../audio/analysis.js';
import { SPEC, curP, eff, jumpVal, modSm } from '../presets.js';
import { noise } from '../util.js';

export function applyMods(now, react){
  const t = now/1000;
  SPEC.forEach((s, idx) => {
    const m = S.active.mods[s.k]; let target = 0;
    if (m) {
      const a = m.amt*(s.max - s.min);
      if (m.src === 'drift') target = noise(t, idx + 1)*a;
      else if (m.src === 'bass') target = sBass*react*1.8*a;
      else if (m.src === 'mid') target = sMid*react*3*a;
      else if (m.src === 'treb') target = sTreb*react*5*a;
      else if (m.src === 'pulse') target = S.beat*a;          // the pace's pulse, not every kick
      else if (m.src === 'jump') target = (jumpVal[s.k] || 0)*a;
    }
    const rate = m && (m.src === 'pulse' || m.src === 'jump') ? .5 : .12;
    modSm[s.k] = (modSm[s.k] || 0) + (target - (modSm[s.k] || 0))*rate;
    eff[s.k] = Math.min(s.max, Math.max(s.min, curP[s.k] + modSm[s.k]));
  });
}
