// A clip, the same in the Session and the Arrangement: live (`parts`: the jam's rhythm and notes, its feel and Life,
// played over the chords wherever it is) or notes (fixed pitches). A live clip in the Arrangement keeps its notes
// worked out from the song's chords at its place (`liveNotes`), so the timeline, the engine and the piano roll read it as
// any clip; `off` is how far into its loop it starts. Freeze makes a live clip notes; Make live reads notes back into a
// rhythm and chord tones (close, not exact). Pure: the page (app.js, session.js) and the tests use it.
import { partNotes } from './flatten.js';
import { join, isDrum, fresh } from '../jam/part.js';
import { chordOf, ladder, REGISTER } from '../jam/model.js';

const clone = x => JSON.parse(JSON.stringify(x));
export const isLive = cl => !!cl?.parts?.length;
// a clip's loop length in 16ths: its first part's (as the grid shows it), or its own length
export const loopLen = cl => { const p = cl?.parts?.[0], c = p && join(p.role, p.R, p.N); return c?.len || cl?.len || 16; };
// a part's notes for one bar from `k` (16ths), over the chords H at bar hb: [{s, p, l, v}] (s from the bar's start)
export function barNotes(part, H, hb, k, start, seed, lane = 0){ const clip = join(part.role, part.R, part.N); if (!clip?.steps.length) return [];
  const lp = part.loop && part.loop[1] <= clip.len && part.loop[1] > part.loop[0] ? part.loop : null, span = lp ? lp[1] - lp[0] : clip.len, n = H.bars.length, b = ((hb % n) + n) % n;
  const c = {role: part.role, rhythm: part.R, notes: part.N, play: part.play, oct: part.oct, inv: part.inv, walk: part.walk, loop: part.loop, phase: (((k - start) % span) + span) % span};
  return partNotes(c, {...H, bars: [...H.bars.slice(b), ...H.bars.slice(0, b)]}, 1, {voicing: part.voicing || 0, seed, lane}); }
// a live clip's notes over `bars` bars from bar `at0` of the chords (a song's chord lane, one a bar), starting `off`
// 16ths into its loop; a drum part's voices onto its track's pads (`ren`)
export function liveNotes(cl, chords, at0, bars, {ren = null, lane = 0, salt = 0} = {}){ const H = {id: 'lane', bars: chords.length ? chords : ['A:m9']}, out = [], len = bars*16, k0 = Math.round(at0*16);
  for (let b = 0; b < bars; b++) { const k = k0 + b*16, start = k0 - (cl.off || 0);   // (a clip may start between bar lines: each bar of it reads the chord it starts in)
    cl.parts.forEach((part, j) => { for (const n of barNotes(part, H, Math.floor(k/16), k, start, (Math.floor(k/16)*7919 + j*101 + salt) >>> 0, lane)) {
      const s = +(b*16 + n.s).toFixed(3); if (s >= len) continue; out.push({s, p: isDrum(part.role) ? ren?.[part.k]?.[n.p] || n.p : n.p, l: n.l, v: n.v}); } }); }
  return out.sort((a, b) => a.s - b.s); }
// a fingerprint of what a clip plays (to tell a copy that's been changed)
export const sigOf = cl => { const s = JSON.stringify(isLive(cl) ? cl.parts : [cl.len, cl.notes]); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
// a live clip frozen: its notes kept, its parts let go
export function freeze(cl){ delete cl.parts; delete cl.off; delete cl._k; return cl; }
// notes read back into a live part: the hits where notes start (within a 64-step loop), each note as the chord tone
// nearest it over the chord at its bar; drums by their pads, a rack's notes by pad role
export function makeLive(cl, role, chords, at0 = 0, padRole = null){ const len = Math.min(64, cl.len || 16), notes = cl.notes.filter(n => n.s < len).sort((a, b) => a.s - b.s);
  const byRole = new Map(); for (const n of notes) { const r = role === 'drums' ? padRole?.(n.p) || 'perc' : role; if (!byRole.has(r)) byRole.set(r, []); byRole.get(r).push(n); }
  const parts = [...byRole.entries()].map(([r, ns]) => { const hits = [], seq = [];
    for (const n of ns) { const st = Math.floor(n.s); if (hits.some(h => h[0] === st)) continue; hits.push([st, Math.max(1, Math.round(n.l || 1)), +Math.min(1, n.v || .8).toFixed(2)]);
      if (r === 'chords') continue; if (isDrum(r)) { seq.push(n.p); continue; }
      const c = chordOf({bars: chords.length ? chords : ['A:m9']}, at0 + Math.floor(st/16)), base = REGISTER[r === 'bass' ? 'bass' : 'lead'](c);
      let best = 0, bd = 1e9; for (let k = -14; k <= 21; k++) { const d = Math.abs(ladder(c, base, k) - n.p); if (d < bd) { bd = d; best = k; } } seq.push([best, 0]); }
    return {role: r, k: 0, R: fresh({len, hits, feel: 0}, cl.name || 'Made live'), N: fresh({seq}, cl.name || 'Made live'), play: 0, oct: 0, inv: 0, walk: false, loop: null, voicing: 0}; });
  return parts.filter(p => p.R.hits.length); }
// a range of bars [a, b) cleared on a track: clips inside go, clips across an edge are trimmed (a live one's phase kept)
export function cutRange(T, a, b){ const out = [];
  for (const c of T.clips) { const s = c.start, e = c.start + c.len/16;
    if (e <= a || s >= b) { out.push(c); continue; }
    if (s < a) { const keep = (a - s)*16; out.push({...c, len: keep, notes: c.notes.filter(n => n.s < keep), _k: undefined}); }
    if (e > b) { const skip = (b - s)*16; out.push({...c, id: c.id + 'r' + Math.round(b), start: b, len: c.len - skip, off: isLive(c) ? (c.off || 0) + skip : c.off,
      notes: c.notes.filter(n => n.s >= skip).map(n => ({...n, s: +(n.s - skip).toFixed(3)})), _k: undefined}); } }
  T.clips = out.sort((x, y) => x.start - y.start); return T; }
// what a track plays over bars [a, b) as one clip (for the Session): a single live clip covering it stays live (its
// phase kept); anything else becomes notes
export function sliceTrack(T, a, b){ const over = T.clips.filter(c => c.start < b && c.start + c.len/16 > a); if (!over.length) return null;
  const one = over.length === 1 && isLive(over[0]) ? over[0] : null;
  if (one) return {parts: clone(one.parts), off: (one.off || 0) + Math.round((a - one.start)*16), len: (b - a)*16, name: one.name, notes: []};
  const notes = []; for (const c of over) for (const n of c.notes) { const s = +(n.s + (c.start - a)*16).toFixed(3); if (s >= 0 && s < (b - a)*16 && n.s < c.len) notes.push({...n, s}); }
  return {len: (b - a)*16, notes: notes.sort((x, y) => x.s - y.s), name: [...new Set(over.map(c => c.name).filter(Boolean))].join(' · ')}; }
// a Session clip laid on a track over bars [a, b) (its notes going round as it loops)
export function layClip(cell, a, b, id){ const len = (b - a)*16;
  if (isLive(cell)) return {id, start: a, len, name: cell.name, parts: clone(cell.parts), off: cell.off || 0, notes: [], set: {}};
  const L = cell.len || 16, notes = []; for (let o = 0; o < len; o += L) for (const n of cell.notes) { const s = o + n.s; if (s < len && n.s < L) notes.push({...n, s: +s.toFixed(3)}); }
  return {id, start: a, len, name: cell.name, notes, set: {}}; }
