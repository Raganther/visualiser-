// The notes played (audio/engine/events.js: the sequencer's, the synth's) as signals, each at the moment it's heard: the kick, the snare and clap (and a stab), the hats, the rest of the percussion, the synth's notes and how high they are.
// A leaf module apart from the note bus: main.js feeds it once a frame with the audio clock as heard (noteFrame).
import { RECENT } from '../audio/engine/events.js';
import { SIG } from './signals.js';

const CH = {kick: 'nKick', snare: 'nSnare', clap: 'nSnare', rim: 'nPerc', clave: 'nPerc', chh: 'nHat', ohh: 'nHat', ride: 'nHat', crash: 'nHat', shaker: 'nHat',
  tomL: 'nPerc', tomH: 'nPerc', cow: 'nPerc', bass: 'nSynth', synth: 'nSynth', poly: 'nSynth'};
const FADE = {nKick: 9, nSnare: 7, nHat: 14, nPerc: 9, nSynth: 3};
for (const k in FADE) SIG[k] = 0; SIG.nPitch = 0;
let last = -1;
// heard: the audio clock as heard at the speakers; stab: called for a snare or clap heard (the stab hits fire)
export function noteFrame(heard, dt, stab){
  for (const k in FADE) SIG[k] *= Math.exp(-dt*FADE[k]);
  if (heard == null) return;
  if (heard < last || heard - last > 1) last = heard - dt;   // (a jump: the clock restarted, or the page slept)
  let stabbed = false;
  for (const e of RECENT) {
    if (e.t <= last || e.t > heard) continue;
    const k = CH[e.ch]; if (!k) continue;
    SIG[k] = Math.max(SIG[k], e.vel);
    if (k === 'nSynth') SIG.nPitch = Math.max(0, Math.min(1, (e.note - 28)/56));   // (E1 to C6, low to high)
    if (k === 'nSnare' && !stabbed) { stabbed = true; stab(); }
  }
  last = heard;
}
