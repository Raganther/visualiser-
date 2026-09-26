// The signal bus: everything that changes with the music or with time, by name, so any setting can follow any of it.
// A leaf module: main.js feeds it once a frame (updateSignals) and the movers read it (sig). Values run 0..1.
export const SIG = {bass: 0, mid: 0, treb: 0, pulse: 0, kick: 0, stab: 0, level: 0, beatPhase: 0, barPhase: 0, tension: 0, section: 0};
// the choices under every slider, in order: [key, label, follows the music (so scaled by Reactivity)].
// drift and jump are worked out by the movers themselves (drift is per setting, jump is re-rolled on each pulse).
export const SIGNALS = [['drift', 'Slow drift'], ['bass', 'Follows bass', 1], ['mid', 'Follows mids', 1], ['treb', 'Follows treble', 1],
  ['pulse', 'Pulses on beat'], ['jump', 'Jumps on beat'],
  ['kick', 'Every kick', 1], ['stab', 'Stabs', 1], ['level', 'Loudness', 1], ['beatPhase', 'Beat ramp'], ['barPhase', 'Bar ramp'],
  ['tension', 'Energy'], ['section', 'Section change']];
const MUSICAL = new Set(SIGNALS.filter(s => s[2]).map(s => s[0]));
// a signal's value as a mover sees it; the band followers keep their original arithmetic ((band*react)*amount)
export const sig = (k, react) => MUSICAL.has(k) ? SIG[k]*react : SIG[k];

const last = {beats: 0, type: null};
// x: bands {bass, mid, treb}, beat (the pulse), hit (stabs), beats (grid beats so far), pos (beat of the bar), t (seconds),
// next and period (the grid's next beat and beat length, while locked), locked, tension, level, type (the section), dt
export function updateSignals(x){
  SIG.bass = x.bands.bass; SIG.mid = x.bands.mid; SIG.treb = x.bands.treb;
  SIG.pulse = x.beat; SIG.stab = x.hit; SIG.tension = x.tension; SIG.level = x.level;
  SIG.kick = x.beats !== last.beats ? 1 : SIG.kick*Math.exp(-x.dt*9);   // every beat, sharp, whatever the pace's division
  last.beats = x.beats;
  SIG.section = x.type !== last.type && last.type !== null ? 1 : SIG.section*Math.exp(-x.dt*1.5);   // a swell as a new section starts
  last.type = x.type;
  SIG.beatPhase = x.locked && x.period ? Math.min(1, Math.max(0, 1 - (x.next - x.t)/x.period)) : 0;
  SIG.barPhase = x.locked ? ((x.pos || 0) + SIG.beatPhase)/4 : 0;
}
