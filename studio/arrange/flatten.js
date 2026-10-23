// A song from Studio Jam (its sections, each a scene of looping parts that read the chords) written out for the DAW as it
// plays: every part a track, every section's part a clip of real notes (the chords resolved through the voice leading,
// Life's improvising and each rhythm's feel played through and fixed in place). From here a note is a pitch and a time,
// and changing the chords no longer moves it. A leaf of the arrangement page; the tests run it in node.
import { notesAt, chordOf, vlChain, STYLES, FEELS, feelAt } from '../jam/model.js';
import { improvise, PLAYS } from '../jam/play.js';
import { join, isDrum } from '../jam/part.js';
import { rng } from '../lib/rng.js';

export const NAMES = ['Kick', 'Hats', 'Percussion', 'Bass', 'Chords', 'Lead', 'Lead 2'];
// the settings a clip carries onto its track's channel when it starts (a section's own tone, space, motion, ramp)
const SET = ['sound', 'x', 'y', 'motion', 'length', 'echo', 'verb', 'ramp'];
const hashOf = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// the notes one part plays over one section (bars long, its harmony H), in 16ths from the section's start:
// [{s, p, l, v}] (s may fall between 16ths: the feel, the swing, Life's timing)
export function partNotes(c, H, bars, {swing = .06, smooth = true, voicing = 0, seed = 1, lane = 0} = {}){
  const clip = c.clip?.steps ? c.clip : c.rhythm ? join(c.role, c.rhythm, c.notes) : null; if (!clip || !clip.steps.length) return [];
  const full = {...clip, role: c.role}, drum = isDrum(c.role), ch = smooth ? vlChain(H, STYLES[voicing]) : null, out = [], mem = {}, R = rng(seed);
  const loop = c.loop && c.loop[1] <= clip.len && c.loop[1] > c.loop[0] ? c.loop : null, f = FEELS[c.rhythm?.feel ?? c.feel ?? 0] || FEELS[0], a = PLAYS[c.play || 0]?.a || 0;
  for (let step = 0; step < bars*16; step++) {
    const span = loop ? loop[1] - loop[0] : clip.len, pos = (loop ? loop[0] : 0) + step % span, bar = Math.floor(step/16), hb = bar % H.bars.length;
    const opts = {vl: ch && ch[hb], inv: c.inv || 0, walk: c.walk ? Math.floor(step/clip.len) % 4 : 0}, chd = chordOf(H, bar);
    const sw = step % 2 ? (f.swing ?? swing) : 0, fe = feelAt(f, step, R), off = sw + fe.dt;
    const notes = a && c.role !== 'chords'
      ? improvise({role: c.role, clip: full, pos, step, bar, lane, a, mem, seed}).flatMap(ev => notesAt({...full, steps: [ev.s]}, pos, chd, opts).map(([n, l, v]) => [n, l, v, ev.dt, ev.fv]))
      : notesAt(full, pos, chd, opts);
    for (const [n, l, v, dt = 0, pv = 1] of notes) out.push({s: +Math.max(0, step + off + dt).toFixed(3), p: drum ? n : n + 12*(c.oct || 0), l: drum ? 1 : +l.toFixed(3), v: +Math.max(.05, Math.min(1, v*fe.v*pv)).toFixed(3)}); }
  return out; }

// the whole song: its sections as markers, the chords bar by bar, and a track for each of the jam's seven parts
export function flatten(song, {swing = .06} = {}){
  const S = song.sections, tracks = [], marks = [], chords = [], seed = hashOf(song.id || song.name || 'song'); let at = 0;
  const first = S[0];
  first.cols.forEach((c, i) => tracks.push({id: 't' + i, role: c.role, name: NAMES[i] || c.role, sound: c.sound, mix: {vol: 0, pan: 0, duck: 0, lo: 0, mid: 0, hi: 0, ...c.mix, solo: false},
    set: {x: c.x, y: c.y, motion: c.motion || 0, length: c.length ?? 1, echo: !!c.echo, verb: !!c.verb}, mute: false, clips: []}));
  for (const [si, x] of S.entries()) { const H = {id: x.harmony, name: x.harmonyName, bars: x.harmonyBars}, bars = x.bars, voicing = x.cols.find(c => c.role === 'chords')?.voicing || 0;
    marks.push({id: x.id, name: (x.name || '').split(': ').slice(1).join(': ') || x.name, at, bars, why: x.why || '', harmony: H.name});
    for (let b = 0; b < bars; b++) chords.push(H.bars[b % H.bars.length]);
    x.cols.forEach((c, i) => { const T = tracks[i]; if (!T || c.mute || !(c.clip || c.rhythm)) return;
      const notes = partNotes(c, H, bars, {swing: x.swing ?? swing, smooth: x.smooth !== false, voicing, seed: seed + si*101 + i, lane: c.role === 'lead' && i > 5 ? 1 : 0});
      if (!notes.length) return;
      // what this section sets differently from the track (its sound, tone, space, motion, a ramp, its level and duck)
      const set = {}; for (const k of SET) if (c[k] !== undefined && JSON.stringify(c[k]) !== JSON.stringify(k === 'sound' ? T.sound : T.set[k])) set[k] = c[k];
      if (set.ramp) set.ramp = {...set.ramp, bars};
      if ((c.mix?.vol ?? 0) !== T.mix.vol) set.vol = +((c.mix?.vol ?? 0) - T.mix.vol).toFixed(2); if ((c.mix?.duck ?? 0) !== T.mix.duck) set.duck = c.mix?.duck ?? 0;
      T.clips.push({id: `c${si}.${i}`, start: at, len: bars*16, name: [c.rhythm?.name, c.role === 'chords' || isDrum(c.role) ? null : c.notes?.name].filter((v, j, a) => v && a.indexOf(v) === j).join(' · ') || NAMES[i], set, notes}); });
    at += bars; }
  return {v: 1, song: song.id, name: song.name, round: song.round, why: song.why || '', bpm: song.bpm || first.bpm || 120, bars: at, pack: first.pack, mx: first.mx || {}, echoDiv: first.echoDiv || 0,
    marks, chords, tracks}; }
