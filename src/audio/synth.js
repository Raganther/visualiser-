// The built-in beat used when no track is loaded (tests can swap in their own).
import { freq, wave } from '../state.js';

// returns true when it filled freqDb too (a test giving the unclipped spectrum); otherwise it's worked out from the bytes
export function synth(t, freqDb){
  if (window.__synth) { const r = window.__synth(t, freq, wave, freqDb); if (r) return r === 'db'; }   // tests can feed their own groove
  const s = t/1000, ph = (s*2) % 1, kick = Math.exp(-ph*8);
  for (let i = 0; i < 2048; i++) { const x = i/2048;
    wave[i] = 128 + (Math.sin(x*Math.PI*6 + s*2)*30 + Math.sin(x*Math.PI*22 - s*3)*12) * (.5 + kick*.6); }
  for (let i = 0; i < 1024; i++) { const f = i/1024;
    freq[i] = Math.max(0, Math.min(255, 210*Math.exp(-f*6)*(.55+kick*.55) + 40*Math.sin(f*40+s*3)*Math.exp(-f*3))); }
}
