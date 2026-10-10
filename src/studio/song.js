// The Studio's song format: plain data a person or a model writes (docs/studio-format.md), and its reading here: note names,
// drum rows written as strings, note clips, scenes and the arrangement, read into events in sixteenths, with checks that
// say plainly what's wrong.
import { INSTRUMENTS, EFFECTS, instrument } from '../audio/engine/registry.js';
import { DEVICES } from './devices.js';

const NAMES = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
// a pitch: a MIDI number, or a name ('A1', 'F#3', 'Bb2'; C4 is 60), or a drum voice's key ('kick')
export function noteNum(p){
  if (typeof p === 'number') return p;
  const m = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(String(p).trim());
  if (!m) return String(p);
  return 12*(+m[3] + 1) + NAMES[m[1].toUpperCase()] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0);
}
export const noteName = n => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((n % 12) + 12) % 12] + (Math.floor(n/12) - 1);

// a drum row: one character a sixteenth. '.' or '-' rest; 'x' a hit, 'X' an accent, 'o' a soft hit, '1'–'9' a velocity in
// ninths, '?' a soft hit half the time, 'r' a ratchet (two quick hits); spaces and '|' are ignored (for reading in bars)
const HIT = {x: .85, X: 1, o: .55, '?': .6, r: .7};
export function hitRow(str){
  const s = String(str).replace(/[\s|]/g, ''), ev = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]; if (c === '.' || c === '-') continue;
    const v = /[1-9]/.test(c) ? +c/9 : HIT[c]; if (v == null) continue;
    if (c === 'r') { ev.push({s: i, v, p: 1}, {s: i + .5, v: v*.8, p: 1}); continue; }
    ev.push({s: i, v, p: c === '?' ? .5 : 1});
  }
  return {len: s.length, ev};
}

// a clip read into {len (sixteenths), ev: [{s, n, l, v, p, slide}] sorted, auto: {target: [[step, value], …]}}
const CACHE = new WeakMap();
export function readClip(c){
  if (!c) return null; if (CACHE.has(c)) return CACHE.get(c);
  const ev = []; let len = c.steps || (c.bars ? c.bars*16 : 0), rowLen = 0;
  for (const [voice, row] of Object.entries(c.hits || {})) {
    const r = hitRow(typeof row === 'string' ? row : row.p), p = typeof row === 'object' && row.prob != null ? row.prob : 1;
    rowLen = Math.max(rowLen, r.len);
    for (const e of r.ev) ev.push({s: e.s, n: voice, l: .5, v: e.v, p: e.p*p});
  }
  for (const x of c.notes || []) {
    const [s, pitch, l = 1, v = .8, o = {}] = Array.isArray(x) ? x : [x.t, x.n, x.l, x.v, x];
    for (const q of [].concat(pitch)) ev.push({s, n: noteNum(q), l, v, p: o.p != null ? o.p : (o.prob != null ? o.prob : 1), slide: !!o.slide});
  }
  if (!len) len = rowLen || Math.max(16, Math.ceil(Math.max(0, ...ev.map(e => e.s + 1))/16)*16);
  ev.sort((a, b) => a.s - b.s);
  // a slide holds the note until the next one starts (and a hair past it), so a legato synth glides there
  for (let i = 0; i < ev.length; i++) if (ev[i].slide) { const nx = ev.slice(i + 1).find(e => e.s > ev[i].s) || (ev[0] && {s: ev[0].s + len}); if (nx) ev[i].l = nx.s - ev[i].s + .15; }
  const out = {len, ev, auto: c.auto || {}};
  CACHE.set(c, out); return out;
}
export const forget = c => CACHE.delete(c);

// the arrangement as [{scene, bars, at (its first bar)}], and how long it is
export function arrangement(song){
  let at = 0; const A = (song.arrange || []).map(x => { const [scene, bars] = Array.isArray(x) ? x : [x.scene, x.bars]; const r = {scene, bars, at}; at += bars; return r; });
  return {parts: A, bars: at};
}
export const scene = (song, id) => (song.scenes || []).find(s => s.id === id);
// every strip: tracks, groups, returns, the master
export function stripsOf(song){
  return [...(song.tracks || []).map(t => ({...t.mix, id: t.id, name: t.name || t.id, kind: 'track'})), ...(song.groups || []).map(g => ({...g, kind: 'group'})),
    ...(song.returns || []).map(r => ({...r, kind: 'return'})), {...(song.master || {}), id: 'master', name: 'Master', kind: 'master'}];
}

// what's wrong with a song, in plain words (an empty list: nothing)
export function check(song){
  const bad = [], ids = new Set(), strip = new Set(['master']);
  if (!(song.bpm > 30 && song.bpm < 300)) bad.push(`bpm ${song.bpm} isn't a tempo`);
  for (const t of song.tracks || []) {
    if (ids.has(t.id)) bad.push(`two tracks are called ${t.id}`); ids.add(t.id); strip.add(t.id);
    const I = t.inst && instrument(t.inst.type);
    if (!I) { bad.push(`${t.id}: no instrument "${t.inst && t.inst.type}" (there are ${INSTRUMENTS.map(i => i.key).join(', ')})`); continue; }
    if (t.inst.preset && I.presets && !I.presets[t.inst.preset]) bad.push(`${t.id}: ${I.key} has no preset "${t.inst.preset}" (it has ${Object.keys(I.presets).join(', ')})`);
    if (I.key === 'drums' && t.inst.kit && !I.presets[t.inst.kit]) bad.push(`${t.id}: no kit "${t.inst.kit}"`);
    for (const [k, c] of Object.entries(t.clips || {})) {
      const r = readClip(c);
      for (const e of r.ev) if (I.key === 'drums' ? !I.voices.some(v => v.key === e.n || v.note === e.n) : typeof e.n !== 'number') { bad.push(`${t.id}.${k}: "${e.n}" isn't a ${I.key === 'drums' ? 'drum voice' : 'note'}`); break; }
    }
  }
  for (const g of [...(song.groups || []), ...(song.returns || [])]) strip.add(g.id);
  for (const s of stripsOf(song)) {
    if (s.to && !strip.has(s.to)) bad.push(`${s.id} goes to "${s.to}", which isn't a group`);
    for (const r in s.sends || {}) if (!(song.returns || []).some(x => x.id === r)) bad.push(`${s.id} sends to "${r}", which isn't a return`);
    for (const d of s.chain || []) {
      if (!DEVICES[d.type] && !EFFECTS.some(e => e.key === d.type)) bad.push(`${s.id}: no device "${d.type}"`);
      if (d.type === 'sc' && !ids.has(d.src || 'kick')) bad.push(`${s.id}: the sidechain listens to "${d.src || 'kick'}", which isn't a track`);
    }
  }
  const sc = new Set((song.scenes || []).map(s => s.id));
  for (const s of song.scenes || []) for (const [t, c] of Object.entries(s.clips || {})) {
    const T = (song.tracks || []).find(x => x.id === t);
    if (!T) bad.push(`scene ${s.id}: no track "${t}"`); else if (c && !(T.clips || {})[c]) bad.push(`scene ${s.id}: ${t} has no clip "${c}"`);
  }
  for (const p of arrangement(song).parts) if (!sc.has(p.scene)) bad.push(`the arrangement plays "${p.scene}", which isn't a scene`);
  for (const a of song.auto || []) if (!strip.has(a.target.split('.')[0])) bad.push(`automation: "${a.target}" isn't on a track`);
  return bad;
}
