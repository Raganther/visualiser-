// Studio Jam's parts, each made of modules that mix and match. A part's rhythm is when it plays: hits [step, len16, vel]
// over its own length, with a feel. Its notes are what it plays, in order, one a hit, going round: a line's chord-tone
// rungs [rung, octave] (so they follow the harmony), a drum part's voices; chords have none (they play the harmony). Its
// sound and space are settings on the part. join() makes the clip model.js and play.js play ([step, rung, len, vel, oct]
// …), split() takes a clip apart, so a rhythm from the hats can carry the bass's notes, and notes 7 long over 5 hits keep
// shifting against them. Every tool here returns a new module (or null when it can't), never changing the one it's given.
import { TOOLS, euclid, MAX } from './riff.js';
import { FEELS } from './model.js';

export const DRUMS = ['kick', 'hats', 'perc', 'drums'];
export const isDrum = role => DRUMS.includes(role);
export const family = role => isDrum(role) ? 'drums' : role === 'chords' ? 'chords' : 'line';
export const VOICE0 = {kick: 'kick', hats: 'chh', perc: 'wood'};
// the longest a joined clip runs before the notes and the hits line up again (16 bars)
export const JOIN_MAX = 256;
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const clone = x => JSON.parse(JSON.stringify(x));

/* ---------- a clip apart and together ---------- */
// (the hits keep the clip's order, so a drum clip's voices on one step come back in the same order)
export function split(role, clip, name = ''){ const steps = [...clip.steps].sort((a, b) => a[0] - b[0]), nm = {name, base: name, ops: []};
  if (isDrum(role)) return {rhythm: {len: clip.len, hits: steps.map(s => [s[0], 1, s[2]]), feel: 0, ...nm}, notes: {seq: steps.map(s => s[1]), ...nm}};
  return {rhythm: {len: clip.len, hits: steps.map(s => [s[0], s[2], s[3]]), feel: 0, ...nm}, notes: {seq: role === 'chords' ? [] : steps.map(s => [s[1], s[4] || 0]), ...nm}}; }
// linked: one note for each hit, so tools that move hits carry their notes with them
export const linked = (R, N) => !!R && !!N && N.seq.length === R.hits.length;
// how many times round the rhythm before the notes start again on its first hit
export function cycles(R, N){ const h = R.hits.length, n = N?.seq.length || 0; if (!h || !n) return 1; const c = n/gcd(h, n); return Math.max(1, Math.min(c, Math.floor(JOIN_MAX/R.len) || 1)); }
// the clip: the rhythm round as many times as the notes need, each hit taking the next note
export function join(role, R, N){ if (!R) return null; const k = cycles(R, N), seq = N?.seq || [], steps = [], seen = new Set(); let i = 0;
  for (let c = 0; c < k; c++) for (const h of R.hits) { const p = h[0] + c*R.len, n = seq.length ? seq[i++ % seq.length] : null;
    if (isDrum(role)) { const v = n ?? VOICE0[role], key = p + '|' + v; if (seen.has(key)) continue; seen.add(key); steps.push([p, v, h[2]]); }
    else if (role === 'chords') steps.push([p, 'chord', h[1], h[2]]);
    else { const [r, o] = n || [0, 0]; steps.push(o ? [p, r, h[1], h[2], o] : [p, r, h[1], h[2]]); } }
  return {role, len: R.len*k, steps}; }

/* ---------- names: each module keeps the name it grew from and the last two things done to it ---------- */
export function named(prev, x, op){ if (op === null) return x; const base = prev?.base || prev?.name || 'Untitled', ops = [...(prev?.ops || []), op].slice(-2);
  return {...x, base, ops, name: `${base}, ${ops.join(', ')}`}; }
export const fresh = (x, name) => ({...x, name, base: name, ops: []});

/* ---------- rhythm tools ---------- */
const beatVel = p => p % 4 === 0 ? .85 : .6;
// a rhythm made of a whole clip (a tool from riff.js that moves hits): with linked notes the notes come along
function viaClip(role, R, N, f){ const L = linked(R, N), clip = join(role, R, L ? N : {seq: isDrum(role) ? [VOICE0[role]] : role === 'chords' ? [] : [[0, 0]]});
  const out = f({...clip, len: R.len}); if (!out || !out.steps.length) return null;
  const s = split(role, {len: out.len, steps: out.steps}); return {rhythm: {...R, len: out.len, hits: s.rhythm.hits}, notes: L ? {...N, seq: s.notes.seq} : null}; }
// k hits as even as they go over n steps, turned by r (the accents on the beat; a line's notes as long as the gap allows)
export function spread(role, k, n, r = 0, R = {}){ const ps = euclid(Math.max(1, Math.min(k, n)), n, r);
  const hits = ps.map((p, i) => { const gap = (ps[i + 1] ?? ps[0] + n) - p; return [p, isDrum(role) ? 1 : role === 'chords' ? Math.max(1, Math.min(4, gap)) : Math.max(1, Math.min(2, gap)), beatVel(p)]; });
  return {...R, len: n, hits, spread: [k, n, r], feel: R.feel || 0}; }
// a small change to when it plays: a hit moved a 16th, one added or dropped, an accent moved
function varyRhythm(R, rnd){ const hits = clone(R.hits), i = Math.floor(rnd()*hits.length), h = hits[i], x = rnd(), at = p => hits.some(q => q[0] === p);
  if (!h) return {...R, hits: [[0, 1, .8]]};
  if (x < .4) { const to = (h[0] + (rnd() < .5 ? 1 : -1) + R.len) % R.len; if (!at(to)) h[0] = to; }
  else if (x < .6 && hits.length > 2) hits.splice(i, 1);
  else if (x < .85) { const p = Math.floor(rnd()*R.len); if (!at(p)) hits.push([p, h[1], .6]); }
  else h[2] = h[2] > .8 ? .55 : .95;
  return {...R, hits: hits.sort((a, b) => a[0] - b[0])}; }
export const RHYTHM_TOOLS = {new: 'New', vary: 'Vary', develop: 'Develop', thin: 'Thin', fill: 'Fill', half: '½ time', double: '2× time', longer: '×2 length', shorter: '÷2 length', rotate: 'Rotate →', reverse: 'Reverse'};
const RPHRASE = {new: null, vary: 'varied', develop: 'developed', thin: 'thinned', fill: 'filled', half: 'half time', double: 'double time', longer: 'doubled', shorter: 'halved', rotate: 'turned', reverse: 'reversed'};
// a rhythm tool: {rhythm, notes?} (notes only when they came along), or null
export function rhythmTool(k, role, R, N, rnd = Math.random, voices){ let out;
  if (k === 'new') { const len = Math.max(16, Math.min(MAX, R ? R.len - R.len % 16 || 16 : 16)), c = TOOLS.riff(role, len, rnd, voices || [VOICE0[role]]);
    return {rhythm: fresh({len: c.len, hits: split(role, c).rhythm.hits, feel: R?.feel || 0}, `New ${role === 'lead' ? 'lead' : role} rhythm`)}; }
  if (!R) return null;
  if (k === 'vary') out = {rhythm: varyRhythm(R, rnd)};
  else if (k === 'rotate') out = {rhythm: {...R, hits: R.hits.map(h => [(h[0] + 1) % R.len, h[1], h[2]]).sort((a, b) => a[0] - b[0])}, notes: linked(R, N) ? rotateLinked(R, N) : null};
  else if (k === 'reverse') { const hits = R.hits.map((h, i) => [((R.len - h[0] - Math.max(1, Math.round(h[1]))) % R.len + R.len) % R.len, h[1], h[2], i]).sort((a, b) => a[0] - b[0]);
    out = {rhythm: {...R, hits: hits.map(h => h.slice(0, 3))}, notes: linked(R, N) ? {...N, seq: hits.map(h => N.seq[h[3]])} : null}; }
  else { const f = {develop: TOOLS.develop, thin: TOOLS.thin, fill: TOOLS.fill, half: TOOLS.half, double: TOOLS.double, longer: TOOLS.longer, shorter: TOOLS.shorter}[k];
    out = f && viaClip(role, R, N, c => f(c, rnd)); }
  if (!out) return null; out.rhythm = named(R, out.rhythm, RPHRASE[k]); delete out.rhythm.spread; if (out.notes) out.notes = named(N, out.notes, RPHRASE[k]); else delete out.notes; return out; }
// (rotating a linked part: the hit that wraps round to the start takes its note with it)
function rotateLinked(R, N){ const idx = R.hits.map((h, i) => [(h[0] + 1) % R.len, i]).sort((a, b) => a[0] - b[0]); return {...N, seq: idx.map(([, i]) => N.seq[i])}; }
export const feelName = R => FEELS[R?.feel || 0].name;

/* ---------- notes tools ---------- */
const rungs = N => N.seq.map(n => n[0]);
const lineOf = (N, f) => ({...N, seq: N.seq.map((n, i) => [f(n[0], i), n[1]])});
const walk = (n, rnd, bass, start = bass ? 0 : 2) => { let r = start; return Array.from({length: n}, (_, i) => { const x = [r, 0]; r = Math.max(0, Math.min(bass ? 4 : 7, r + [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd()*7)])); if (i === n - 2 && !bass) r = start; return x; }); };
export const NOTE_TOOLS = {new: 'New', vary: 'Vary', develop: 'Develop', up: '▲ Up', down: '▼ Down', flip: 'Flip', wide: 'Wide', narrow: 'Narrow', reverse: 'Reverse', rotate: 'Rotate →', answer: 'Answer', sequence: 'Sequence', longer: 'One more', shorter: 'One fewer'};
const DRUM_NOTE_TOOLS = ['new', 'vary', 'reverse', 'rotate', 'longer', 'shorter'];
export const noteTools = role => role === 'chords' ? [] : isDrum(role) ? DRUM_NOTE_TOOLS : Object.keys(NOTE_TOOLS);
const NPHRASE = {vary: 'varied', develop: 'developed', up: 'up a step', down: 'down a step', flip: 'flipped', wide: 'wider', narrow: 'narrower', reverse: 'reversed', rotate: 'turned', answer: 'answered', sequence: 'sequenced', longer: 'one more', shorter: 'one fewer'};
// a notes tool: new notes, or null. n: how many a new set has (the hits, so it stays linked); voices: a drum sound's
export function notesTool(k, role, N, rnd = Math.random, {n = 8, voices} = {}){ if (role === 'chords') return null; const drum = isDrum(role), bass = role === 'bass'; let seq;
  if (k === 'new') { if (drum) { const vs = voices?.length ? voices : [VOICE0[role]], main = vs.includes(VOICE0[role]) ? VOICE0[role] : vs[0];
      seq = Array.from({length: n}, () => rnd() < .7 ? main : vs[Math.floor(rnd()*vs.length)]); }
    else seq = walk(n, rnd, bass);
    return fresh({seq}, `New ${bass ? 'bass' : drum ? role : role === 'lead' ? 'lead' : role} notes`); }
  if (!N?.seq.length) return null; seq = clone(N.seq);
  if (k === 'vary') { const i = Math.floor(rnd()*seq.length);
    if (drum) { const vs = voices?.length ? voices : [...new Set(seq)]; seq[i] = vs[Math.floor(rnd()*vs.length)]; } else seq[i][0] = Math.max(-2, seq[i][0] + (rnd() < .5 ? 1 : -1)); }
  else if (k === 'reverse') seq.reverse();
  else if (k === 'rotate') seq.push(seq.shift());
  else if (k === 'longer') seq.push(clone(seq[seq.length - 1 - Math.floor(rnd()*Math.min(3, seq.length))]));
  else if (k === 'shorter') { if (seq.length < 2) return null; seq.pop(); }
  else if (drum) return null;
  else { const r = rungs(N), lo = Math.min(...r), hi = Math.max(...r), last = r.at(-1), home = r[0];
    if (k === 'up') seq = lineOf(N, x => x + 1).seq; else if (k === 'down') seq = lineOf(N, x => x - 1).seq;
    else if (k === 'flip') seq = lineOf(N, x => lo + hi - x).seq; else if (k === 'wide') seq = lineOf(N, x => lo + (x - lo)*2).seq;
    else if (k === 'narrow') seq = lineOf(N, x => lo + Math.round((x - lo)/2)).seq;
    // the answer: the notes again turned over round the last, coming home at the end
    else if (k === 'answer') { const b = seq.map(([x, o]) => [Math.max(-2, 2*last - x), o]); b[b.length - 1] = [home, seq[0][1]]; seq = [...seq, ...b]; }
    // the notes again a chord tone higher each time round, back home the last time
    else if (k === 'sequence') seq = [0, 1, 2, 0].flatMap(d => seq.map(([x, o]) => [x + d, o]));
    // A A′ A B: the notes, their tail moved a step, the notes, the answer
    else if (k === 'develop') { const a2 = clone(seq), t = Math.max(1, Math.ceil(seq.length/3)); for (const x of a2.slice(-t)) x[0] = Math.max(-2, x[0] + (rnd() < .5 ? 1 : -1));
      const b = seq.map(([x, o]) => [Math.max(-2, 2*last - x), o]); b[b.length - 1] = [home, seq[0][1]]; seq = [...clone(seq), ...a2, ...clone(seq), ...b]; }
    else return null; }
  if (seq.length > 64) return null;
  return named(N, {...N, seq}, NPHRASE[k]); }

/* ---------- a part handed between parts: notes made to suit a part of another kind ---------- */
// drum voices the sound hasn't got become its main voice; a line's notes onto drums (or drums onto a line) can't go
export function fitNotes(role, N, voices){ if (!N || role === 'chords') return role === 'chords' ? {seq: [], name: N?.name || '', base: N?.base || '', ops: []} : null;
  const drum = isDrum(role), isDrumSeq = N.seq.every(x => typeof x === 'string'); if (N.seq.length && drum !== isDrumSeq) return null;
  if (!drum || !voices?.length) return N; const main = voices.includes(VOICE0[role]) ? VOICE0[role] : voices[0];
  return {...N, seq: N.seq.map(v => voices.includes(v) ? v : main)}; }
// a short picture of a rhythm, for its label: x on a hit, · between (the first bar)
export const sketch = R => R ? Array.from({length: Math.min(16, R.len)}, (_, p) => R.hits.some(h => h[0] === p) ? (R.hits.find(h => h[0] === p)[2] > .8 ? '●' : '•') : '·').join('') : '';
