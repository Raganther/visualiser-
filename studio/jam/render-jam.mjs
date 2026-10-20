// A jam kept in Studio Jam (its `jams` row, saved as JSON) turned into a session (the DAW's format) for render.mjs: each
// column a bus whose filter and sends follow the XY pad as it moved, mutes as level, each sound a track (a native sound
// split by its settings at the time, so the mallet and ring follow the pad and Length as they did). Usage:
// node studio/jam/render-jam.mjs jam.json [name] → studio/sessions/jam-<name>.json, then node studio/render.mjs jam-<name> --session studio/sessions/jam-<name>.json
import fs from 'node:fs';
import path from 'node:path';
import { nativeSet, cutOf, LEN, X0 } from './model.js';
import { NATIVE_OF, SOUNDS as PAL } from '../lib/palette.js';

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), J = raw.data || raw;
const slug = (process.argv[3] || J.name || 'jam').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), SND = Object.fromEntries(J.sounds.map(s => [s.id, s]));
const role = Object.fromEntries(J.columns.map(c => [c.id, c.role]));
// each column's state through the jam, from its macro log
const state = Object.fromEntries(J.columns.map(c => [c.id, {x: X0(c.role), y: .3, motion: 0, length: 1, mute: 0}])), events = [...J.macros].sort((a, b) => a[0] - b[0]);
const auto = Object.fromEntries(J.columns.map(c => [c.id, {cut: [[0, cutOf(X0(c.role))]], a: [[0, .3*.5]], b: [[0, .3*.75]], level: [[0, .85]]}]));
const push = (pts, bar, v) => { const last = pts[pts.length - 1]; if (Math.abs(last[1] - v) < 1e-6) return; if (bar > last[0]) pts.push([bar - .002, last[1]]); pts.push([bar, v]); };
const tracks = new Map(), track = (key, t) => { if (!tracks.has(key)) tracks.set(key, {id: 't' + tracks.size, notes: [], morph: [], ...t}); return tracks.get(key); };
let ei = 0;
for (const [step, col, sid, n, len, vel] of J.notes) {
  while (ei < events.length && events[ei][0] <= step) { const [es, ec, k, v] = events[ei++], s = state[ec]; if (!s || String(k).startsWith('sound:')) continue; s[k] = v; const bar = es/16, A = auto[ec];
    if (k === 'x') push(A.cut, bar, cutOf(v)); if (k === 'y') { push(A.a, bar, v*.5); push(A.b, bar, v*.75); } if (k === 'mute') push(A.level, bar, v ? 0 : .85); }
  const S = SND[sid], st = state[col], bar = Math.floor(step/16), s16 = step % 16; if (!S) continue;
  if (S.voices) { const m = S.voices[n]; if (!m) continue;
    if (m.native) { const set = nativeSet(st, m.native, m.set || {}); track(`${col}|${m.native}|${m.n}|${JSON.stringify(set)}`, {label: `${S.name} (${n})`, engine: 'native', bus: col, name: m.native, set}).notes.push([bar, s16, m.n, 1, vel]); }
    else track(`${col}|${m.kit}|${JSON.stringify(m.over || {})}`, {label: S.name, engine: 'kit', bus: col, kit: m.kit, over: m.over || {}, ...(role[col] === 'kick' ? {side: true} : {})}).notes.push([bar, s16, n, vel]);
    continue; }
  const pal = S.src.palette, nat = S.src.native || NATIVE_OF[pal];
  if (nat) { const set = nativeSet(st, nat, S.src.set || {}), shift = (S.src.shift || 0) + (pal ? 12*(PAL[pal][1].oct || 0) : 0);
    track(`${col}|${nat}|${JSON.stringify(set)}`, {label: S.name, engine: 'native', bus: col, name: nat, set}).notes.push([bar, s16, n + shift, len, vel]); }
  else { const b = PAL[pal][1], over = {poly: 1, ad: (b.ad ?? .3)*LEN[st.length], ar: (b.ar ?? .2)*LEN[st.length]};
    track(`${col}|${pal}|${st.length}`, {label: S.name, engine: 'palette', bus: col, name: pal, over}).notes.push([bar, s16, n, len, vel]); }
}
const bars = (J.bars || Math.ceil((J.notes.at(-1)?.[0] || 0)/16)) + 2;
const ops = [['returns', {delay: {div: 4, fb: .45, tone: 2400}, reverb: {size: .78, damp: .65, low: 240}, echoDb: -1, verbDb: 2}]];
for (const c of J.columns) { const r = c.role;
  ops.push(['bus', c.id, {level: 0, filter: {cut: cutOf(X0(r)), q: 1.2}, a: -6, b: -4, ...(r === 'kick' ? {} : {pump: {depth: r === 'chords' ? .65 : .4, rel: .4}}), ...(['chords', 'lead'].includes(r) ? {width: 1.3} : {})}]);
  const A = auto[c.id]; for (const [p, pts] of Object.entries(A)) if (pts.length > 1 || p !== 'cut') ops.push(['ramp', {bus: c.id, p}, pts, p === 'cut' ? {exp: true} : {}]); }
for (const t of tracks.values()) ops.push(['inst', t.id]);
const session = {format: 'studio-session', v: 1, meta: {title: J.name || 'Jam', bpm: J.bpm, bars, swing: J.swing || 0, seed: 1, version: 1, key: 'a jam', words: `A jam from Studio Jam${J.note ? `: “${J.note}”` : ''}.`, from: 'jam'},
  sections: [['Jam', 0, bars]], ops, trims: {}, tracks: [...tracks.values()]};
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '../sessions', `jam-${slug}.json`);
fs.writeFileSync(out, JSON.stringify(session)); console.log(`${out}: ${bars} bars, ${tracks.size} tracks, ${J.notes.length} notes\nnode studio/render.mjs jam-${slug} --session studio/sessions/jam-${slug}.json`);
