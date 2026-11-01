// The note-event bus: every note an instrument is about to play, known before it sounds (for the visuals, a recorder, MIDI out).
// An event: {t: audio-clock time it sounds, src: who made it ('groove', …), ch: the voice or instrument ('kick', 'bass', …),
// note: MIDI note number, vel: 0..1, len: seconds}. Producers call note(); consumers subscribe with onNote()
const subs = new Set();
export const RECENT = [];   // the last events, oldest first
export const onNote = fn => { subs.add(fn); return () => subs.delete(fn); };
export function note(ev){
  RECENT.push(ev); if (RECENT.length > 256) RECENT.shift();
  for (const fn of subs) fn(ev);
}
// the events heard between two audio-clock times (as heard: pass the clock at the speakers)
export const heardBetween = (a, b) => RECENT.filter(e => e.t > a && e.t <= b);
