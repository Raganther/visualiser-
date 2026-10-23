// The native voices as streams: each instrument is a voice that computes its next samples on demand (run), hears its key
// let go (off) and says when it's finished (done, end). The live engine (voices.worklet.js) runs them as they play; a note
// computed ahead is the same voice run from start to end here, so what's heard live and what's computed ahead are one
// piece of code. A voice: new V(sr, f0, P, vel, len?) (P its settings, read as it runs, so a knob turned is heard at once;
// len the note's length where it's known, for the few voices whose shape depends on it), run(L, R, a, b) adding into
// L and R from a to b, off(t) (t its release, in seconds from the start: the key let go), done, end (its last sample, once
// known).
export function render(V, sr, f0, P, held){
  const v = new V(sr, f0, P, P.vel, held ? P.len : undefined); if (held) v.off(P.len);
  const n = v.end, L = new Float32Array(n), R = new Float32Array(n);
  for (let a = 0; a < n && !v.done; a += 4096) v.run(L, R, a, Math.min(n, a + 4096));
  return {L, R};
}
// the end of a voice: its last `f` samples faded out (as each computed-ahead note's tail was)
export const fadeAt = (j, end, f) => j >= end - f ? (end - 1 - j)/f : 1;
