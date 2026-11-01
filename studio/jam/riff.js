// Studio Jam's riff tools: new riffs, and a clip's riff answered, sequenced, developed, thinned, filled, in half or double
// time, made longer or shorter. A clip's steps as model.js has them: a line [step, rung, len16, vel, octave?] (rungs are
// chord tones, so a riff follows the harmony), a chord hit [step, 'chord', len16, vel, base?], a drum hit [step, voice, vel].
// Each returns {len, steps} (a new variant), or null when it can't (a clip longer than MAX can't double).

export const MAX = 64;   // four bars
const DRUMS = ['kick', 'hats', 'perc'];
const sorted = steps => steps.sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1])));
const isLine = s => typeof s[1] === 'number';
const velAt = s => isLine(s) || s[1] === 'chord' ? 3 : 2;
const at = (s, p) => { const t = s.slice(); t[0] = p; return t; };
// k hits spread as evenly as they go over n steps (a euclidean rhythm), turned by r
export const euclid = (k, n, r = 0) => [...new Set(Array.from({length: k}, (_, i) => (Math.floor(i*n/k) + r) % n))].sort((a, b) => a - b);
const common = steps => { const n = {}; for (const s of steps) n[s[1]] = (n[s[1]] || 0) + 1; return Object.keys(n).sort((a, b) => n[b] - n[a])[0]; };

// a new riff for a part: an even rhythm turned somewhere, and for a line a walk through the chord's tones from home
export function newRiff(role, len = 16, R = Math.random, voices = ['chh']){
  const beat = p => p % 4 === 0, v = p => beat(p) ? .8 : .55, bars = len/16, steps = [];
  if (role === 'kick') { for (const p of euclid(Math.max(1, Math.round(len/4) - (R() < .3 ? 1 : 0)), len)) steps.push([p, 'kick', beat(p) ? .9 : .6]); }
  else if (DRUMS.includes(role)) { const k = Math.max(2, Math.round(len*(role === 'hats' ? .35 + .4*R() : .2 + .25*R()))), r = Math.floor(R()*4);
    for (const p of euclid(k, len, r)) steps.push([p, voices[Math.floor(R()*Math.min(voices.length, role === 'hats' ? 1 : 3))], v(p)]); }
  else if (role === 'chords') { for (const p of euclid(Math.max(1, Math.round(bars*(2 + 3*R()))), len, Math.floor(R()*3))) steps.push([p, 'chord', 2 + Math.floor(R()*3), v(p)]); }
  else { const bass = role === 'bass', k = Math.max(2, Math.round(bars*(bass ? 3 + 3*R() : 3 + 4*R()))), ps = euclid(k, len, Math.floor(R()*(bass ? 3 : 4)));
    let r = bass ? 0 : 2 + Math.floor(R()*3);
    ps.forEach((p, i) => { const next = ps[i + 1] ?? len + ps[0], room = next - p, l = Math.max(1, Math.min(room, bass ? 1 + Math.floor(R()*2) : 1 + Math.floor(R()*3)));
      steps.push([p, r, l, v(p)]); r = Math.max(0, Math.min(bass ? 4 : 7, r + [-2, -1, -1, 1, 1, 2, 0][Math.floor(R()*7)])); });
    if (!bass) steps.at(-1)[1] = steps[0][1]; }   // a lead's riff comes home at its end
  return {len, steps: sorted(steps)};
}

// the second half answers the first: the same rhythm, its line turned over and coming home at the end
export function answer(clip){ const L = clip.len; if (2*L > MAX) return null;
  const line = clip.steps.filter(isLine), last = line.at(-1)?.[1] ?? 0, home = line[0]?.[1] ?? 0, out = clip.steps.map(s => s.slice());
  const second = clip.steps.map(s => isLine(s) ? (t => (t[1] = Math.max(0, 2*last - s[1]), t))(at(s, s[0] + L)) : at(s, s[0] + L));
  const lastLine = second.filter(isLine).at(-1); if (lastLine) lastLine[1] = home;
  if (!line.length) { const fill = clip.steps.length && common(clip.steps); for (const p of [L + L - 3, L + L - 1]) if (fill && !second.some(s => s[0] === p)) second.push([p, fill, .5]); }
  return {len: 2*L, steps: sorted([...out, ...second])}; }
// the riff again a chord tone higher each time round (up to four times, within four bars), back home the last time
export function sequence(clip){ const L = clip.len, reps = Math.min(4, Math.floor(MAX/L)); if (reps < 2 || !clip.steps.some(isLine)) return null;
  const shift = [0, 1, 2, 0].slice(0, reps);
  return {len: L*reps, steps: sorted(shift.flatMap((d, i) => clip.steps.map(s => { const t = at(s, s[0] + i*L); if (isLine(t)) t[1] += d; return t; })))}; }
// A A′ A B: the riff, a variation (its last notes moved a tone), the riff, and an answer; or A B when it's too long for four
export function develop(clip, R = Math.random){ const L = clip.len; if (2*L > MAX) return null;
  const vary = steps => { const t = steps.map(s => s.slice()), line = t.filter(isLine), tail = line.slice(-Math.max(1, Math.ceil(line.length/3)));
    if (tail.length) for (const s of tail) s[1] = Math.max(0, s[1] + (R() < .5 ? 1 : -1));
    else { const p = Math.floor(R()*L); if (!t.some(s => s[0] === p) && t.length) t.push(at(t[0], p)); }   // drums: one more hit
    return t; };
  const B = answer(clip).steps.filter(s => s[0] >= L).map(s => at(s, s[0] - L));
  const parts = 4*L <= MAX ? [clip.steps, vary(clip.steps), clip.steps, B] : [clip.steps, B];
  return {len: parts.length*L, steps: sorted(parts.flatMap((p, i) => p.map(s => at(s, s[0] + i*L))))}; }
// fewer notes: the softest and those off the beat go first; the first note always stays
export function thin(clip, R = Math.random){ const keep = [], first = Math.min(...clip.steps.map(s => s[0]));
  const scored = clip.steps.map(s => [s, (s[0] === first ? 9 : 0) + s[velAt(s)] + (s[0] % 4 === 0 ? .5 : 0) + .3*R()]).sort((a, b) => b[1] - a[1]);
  const n = Math.max(Math.min(2, clip.steps.length), Math.round(clip.steps.length*.62)); for (const [s] of scored.slice(0, n)) keep.push(s.slice());
  return {len: clip.len, steps: sorted(keep)}; }
// more notes: one soft note in each gap of two steps or more, a line's a tone from the note before, a drum the part's own
export function fill(clip, R = Math.random){ const out = clip.steps.map(s => s.slice()), taken = new Set(), L = clip.len;
  for (const s of clip.steps) { const l = isLine(s) || s[1] === 'chord' ? Math.max(1, Math.round(s[2])) : 1; for (let i = 0; i < l; i++) taken.add((s[0] + i) % L); }
  const voice = common(clip.steps), byPos = [...clip.steps].sort((a, b) => a[0] - b[0]);
  for (let p = 0; p < L; p++) { if (taken.has(p) || !taken.has((p - 1 + L) % L) || taken.has((p + 1) % L)) continue;
    const prev = [...byPos].reverse().find(s => s[0] < p) || byPos.at(-1); if (!prev) continue;
    if (isLine(prev)) out.push([p, Math.max(0, prev[1] + (R() < .5 ? 1 : -1)), 1, .45, prev[4] || 0]);
    else if (prev[1] === 'chord') continue; else out.push([p, voice, .4]); }
  return {len: L, steps: sorted(out)}; }
// half time: everything twice as long and twice as far apart
export function halfTime(clip){ if (2*clip.len > MAX) return null;
  return {len: 2*clip.len, steps: clip.steps.map(s => { const t = at(s, 2*s[0]); if (isLine(t) || t[1] === 'chord') t[2] = 2*t[2]; return t; })}; }
// double time: the riff twice as fast, played twice in the same length
export function doubleTime(clip){ const L = clip.len; if (L % 2) return null; const seen = new Set(), half = [];
  for (const s of clip.steps) { const p = Math.floor(s[0]/2), k = p + '|' + s[1]; if (seen.has(k)) continue; seen.add(k); const t = at(s, p); if (isLine(t) || t[1] === 'chord') t[2] = Math.max(.5, t[2]/2); half.push(t); }
  return {len: L, steps: sorted([...half, ...half.map(s => at(s, s[0] + L/2))])}; }
// longer (the clip twice) or shorter (its first half)
export const longer = clip => 2*clip.len > MAX ? null : {len: 2*clip.len, steps: sorted([...clip.steps.map(s => s.slice()), ...clip.steps.map(s => at(s, s[0] + clip.len))])};
export const shorter = clip => clip.len < 2 || clip.len % 2 ? null : {len: clip.len/2, steps: clip.steps.filter(s => s[0] < clip.len/2).map(s => s.slice())};

export const TOOLS = {riff: newRiff, answer, sequence, develop, thin, fill, half: halfTime, double: doubleTime, longer, shorter};
export const TNAMES = {riff: 'New riff', answer: 'Answer', sequence: 'Sequence', develop: 'Develop', thin: 'Thin', fill: 'Fill', half: '½ time', double: '2× time', longer: '×2 length', shorter: '÷2 length'};
