// The signal bus: everything that changes with the music or with time, by name, so any setting can follow any of it.
// A leaf module: main.js feeds it once a frame (updateSignals) and the movers read it (sig). Values run 0..1.
export const SIG = {bass: 0, mid: 0, treb: 0, pulse: 0, kick: 0, stab: 0, level: 0, beatPhase: 0, barPhase: 0, tension: 0, section: 0,
  hat: 0, noise: 0, full: 0, width: 0, harm: 0, fresh: 0, coming: 0};   // (these from audio/listen.js)
// the choices under every slider, in order: [key, label, follows the music (so scaled by Reactivity)].
// drift and jump are worked out by the movers themselves (drift is per setting, jump is re-rolled on each pulse).
export const SIGNALS = [['drift', 'Slow drift'], ['bass', 'Follows bass', 1], ['mid', 'Follows mids', 1], ['treb', 'Follows treble', 1],
  ['pulse', 'Pulses on beat'], ['jump', 'Jumps on beat'],
  ['kick', 'Every kick', 1], ['stab', 'Stabs', 1], ['level', 'Loudness', 1], ['beatPhase', 'Beat ramp'], ['barPhase', 'Bar ramp'],
  ['tension', 'Energy'], ['section', 'Section change'],
  ['hat', 'Hi-hats', 1], ['noise', 'Noisy against tonal'], ['full', 'Fullness'], ['width', 'Stereo width', 1], ['harm', 'The notes change'], ['fresh', 'Something new'], ['coming', 'The drop is coming'],
  ['nKick', 'Sequencer kick', 1], ['nSnare', 'Sequencer snare and clap', 1], ['nHat', 'Sequencer hats and cymbals', 1], ['nPerc', 'Sequencer percussion', 1],
  ['nSynth', 'Synth and bass notes', 1], ['nPitch', 'How high the synth plays']];   // (scene/notes.js: the notes played, as heard)
const MUSICAL = new Set(SIGNALS.filter(s => s[2]).map(s => s[0]));
// a signal's value as a mover sees it; the band followers keep their original arithmetic ((band*react)*amount)
export const sig = (k, react) => MUSICAL.has(k) ? SIG[k]*react : SIG[k];

const last = {beats: 0, type: null, bars: 0};
// x: bands {bass, mid, treb}, beat (the pulse), hit (stabs), beats (grid beats so far), pos (beat of the bar), t (seconds),
// next and period (the grid's next beat and beat length, while locked), locked, tension, level, type (the section), dt
export function updateSignals(x){
  SIG.bass = x.bands.bass; SIG.mid = x.bands.mid; SIG.treb = x.bands.treb;
  SIG.pulse = x.beat; SIG.stab = x.hit; SIG.tension = x.tension; SIG.level = x.level; SIG.coming = x.coming || 0;   // (a drop read ahead: its run-up, 0..1)
  SIG.kick = x.beats !== last.beats ? 1 : SIG.kick*Math.exp(-x.dt*9);   // every beat, sharp, whatever the pace's division
  last.beats = x.beats;
  SIG.section = x.type !== last.type && last.type !== null ? 1 : SIG.section*Math.exp(-x.dt*1.5);   // a swell as a new section starts
  last.type = x.type;
  SIG.beatPhase = x.locked && x.period ? Math.min(1, Math.max(0, 1 - (x.next - x.t)/x.period)) : 0;
  SIG.barPhase = x.locked ? ((x.pos || 0) + SIG.beatPhase)/4 : 0;
  // what the listening hears (x.L: audio/listen.js); the bar-by-bar ones swell when they come and fade over a couple of seconds
  if (x.L) { SIG.hat = x.L.hat; SIG.noise = x.L.noise; SIG.full = x.L.full; SIG.width = Math.min(1, x.L.width*2.5);
    SIG.harm = x.L.bars !== last.bars ? Math.max(SIG.harm, Math.min(1, x.L.harm*2)) : SIG.harm*Math.exp(-x.dt*.8);
    SIG.fresh = x.L.bars !== last.bars ? Math.max(SIG.fresh, x.L.nov) : SIG.fresh*Math.exp(-x.dt*.8); last.bars = x.L.bars; }
}
