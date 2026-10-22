// A jam kept in Studio Jam (its `jams` row, saved as JSON) turned into a session (the DAW's format) for render.mjs: each
// column a bus whose filter and sends follow the XY pad as it moved, mutes as level, each sound a track (a native sound
// split by its settings at the time, so the mallet and ring follow the pad and Length as they did). Usage:
// node studio/jam/render-jam.mjs jam.json [name] → studio/sessions/jam-<name>.json, then node studio/render.mjs jam-<name> --session studio/sessions/jam-<name>.json
import fs from 'node:fs';
import path from 'node:path';
import { nativeSet, cutOf, LEN, X0, ECHO } from './model.js';
import { engOf, RET } from './mixeng.js';
// the jam's mixer (as app.js has them): how far the kick ducks each part, the master's glue and width
const DUCKS = [0, .25, .4, .65], GLUE = [null, {thr: -14, ratio: 1.8, att: .03, rel: .25}, {thr: -20, ratio: 3, att: .01, rel: .2}, {thr: -24, ratio: 4, att: .03, rel: .12}], WIDTHS = [0, .6, 1, 1.35, 1.7];
import { NATIVE_OF, SOUNDS as PAL } from '../lib/palette.js';

// the jam as a session (exported for the tests)
export function jamSession(J){
  const SND = Object.fromEntries(J.sounds.map(s => [s.id, s]));
  const role = Object.fromEntries(J.columns.map(c => [c.id, c.role]));
  // each column's state through the jam, from its macro log
  const MIX0 = (c, i) => ({vol: 0, pan: [0, .15, -.2, 0, 0, -.3, .3][i] || 0, lo: 0, mid: 0, hi: 0, duck: c.role === 'kick' ? 0 : c.role === 'chords' ? 3 : 2, solo: false, ...(J.mix?.[i] || {})});
  const state = Object.fromEntries(J.columns.map((c, i) => { const m = MIX0(c, i); return [c.id, {x: X0(c.role), y: .3, motion: 0, length: 1, mute: m.mute ? 1 : 0, echo: 1, verb: 1, throw: 0, mix: m}]; })), events = [...J.macros].sort((a, b) => a[0] - b[0]);
  const MX = {vol: 0, lo: 0, hi: 0, glue: 1, width: 2, ...(J.mx || {})}, MXat = [], DUCKat = Object.fromEntries(J.columns.map(c => [c.id, []]));
  // a master setting as the desk takes it (the glue and width are chosen from lists)
  const masterVal = (k, v) => k === 'glue' ? GLUE[v] : k === 'width' ? WIDTHS[v] : v;
  // a part's fader: silent when muted, or when another part is soloed and it isn't
  const gainOf = s => s.mute || Object.values(state).some(o => o.mix.solo) && !s.mix.solo ? 0 : .85*Math.pow(10, s.mix.vol/20);
  const auto = Object.fromEntries(J.columns.map(c => { const s = state[c.id]; return [c.id, {cut: [[0, cutOf(X0(c.role))]], a: [[0, .3*.5]], b: [[0, .3*.75]], level: [[0, gainOf(s)]], pan: [[0, s.mix.pan]], eqLo: [[0, s.mix.lo]], eqMid: [[0, s.mix.mid]], eqHi: [[0, s.mix.hi]]}]; }));
  const push = (pts, bar, v) => { const last = pts[pts.length - 1]; if (Math.abs(last[1] - v) < 1e-6) return; if (bar > last[0]) pts.push([bar - .002, last[1]]); pts.push([bar, v]); };
  const tracks = new Map(), track = (key, t) => { if (!tracks.has(key)) tracks.set(key, {id: 't' + tracks.size, notes: [], morph: [], ...t}); return tracks.get(key); };
  let ei = 0;
  // the macro log up to a step: the state, and the automation from each change
  const until = step => { while (ei < events.length && events[ei][0] <= step) { const [es, ec, k, v] = events[ei++], s = state[ec];
      if (ec === '*' && String(k).startsWith('master.')) { const mk = k.slice(7); MXat.push([es/16, {[mk]: masterVal(mk, v)}]); continue; }
      if (!s || String(k).startsWith('sound:')) continue; const bar = es/16, A = auto[ec];
      if (k === 'mix.duck') DUCKat[ec].push([bar, DUCKS[v] || 0]);
      // the mixer: a fader, mute or solo moves the levels (a solo every part's), pan and EQ their own params
      if (String(k).startsWith('mix.')) { const mk = k.slice(4); s.mix[mk] = mk === 'solo' ? !!v : v;
        if (mk === 'vol' || mk === 'solo') for (const [id, o] of Object.entries(state)) push(auto[id].level, bar, gainOf(o));
        if (mk === 'pan') push(A.pan, bar, v); if (mk === 'lo') push(A.eqLo, bar, v); if (mk === 'mid') push(A.eqMid, bar, v); if (mk === 'hi') push(A.eqHi, bar, v); continue; }
      s[k] = v;
      if (k === 'x') push(A.cut, bar, cutOf(v)); if (k === 'mute') for (const [id, o] of Object.entries(state)) push(auto[id].level, bar, gainOf(o));
      // the sends: space sets how much, Echo and Reverb switch them, a throw sends everything to the echo while held
      if (['y', 'echo', 'verb', 'throw'].includes(k)) { push(A.a, bar, s.throw ? .95 : s.echo ? s.y*.5 : 0); push(A.b, bar, s.verb ? s.y*.75 : 0); } } };
  for (const [step, col, sid, n, len, vel, off = 0] of J.notes) { until(step);
    const S = SND[sid], st = state[col], sw = J.swing || 0, x0 = step + off, x = step + off + (step % 2 ? sw : 0) - (Math.floor(x0) % 2 ? sw : 0), at = Math.max(0, x), bar = Math.floor(at/16), s16 = +(at - bar*16).toFixed(4); if (!S) continue;
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
  until(Infinity);   // the changes after the last note too
  const bars = (J.bars || Math.ceil((J.notes.at(-1)?.[0] || 0)/16)) + 2;
  // Claude's mix, if the take was made with it on (mixeng.js): each part's chain, the returns filtered and ducked a little
  const E = J.eng === true, ops = [['returns', {delay: {div: ECHO[J.echoDiv || 0][2], fb: .45, tone: 2400}, reverb: {size: .78, damp: .65, low: 240}, echoDb: -1, verbDb: 2,
    ...(E ? {eng: RET, echoPump: {depth: RET.echo.duck, rel: .6}, verbPump: {depth: RET.verb.duck, rel: .6}} : {})}]];
  ops.push(['master', {lo: MX.lo, hi: MX.hi, width: WIDTHS[MX.width], glue: GLUE[MX.glue], vol: MX.vol, at: MXat}]);
  for (const c of J.columns) { const r = c.role, m = MIX0(c, J.columns.indexOf(c)), depth = r === 'kick' ? 0 : DUCKS[m.duck], dat = r === 'kick' ? [] : DUCKat[c.id];
    const lane = J.columns.filter(x => x.role === r).indexOf(c);
    ops.push(['bus', c.id, {level: 0, ...(E ? {eng: engOf(r, lane)} : {}), filter: {cut: cutOf(X0(r)), q: 1.2}, eq: {lo: m.lo, mid: m.mid, hi: m.hi}, a: -6, b: -4, ...(depth || dat.some(([, v]) => v) ? {pump: {depth, rel: .4, ...(dat.length ? {at: dat} : {})}} : {}), ...(['chords', 'lead'].includes(r) ? {width: 1.3} : {})}]);
    const A = auto[c.id]; for (const [p, pts] of Object.entries(A)) if (pts.length > 1 || p !== 'cut') ops.push(['ramp', {bus: c.id, p}, pts, p === 'cut' ? {exp: true} : {}]); }
  for (const t of tracks.values()) ops.push(['inst', t.id]);
  return {format: 'studio-session', v: 1, meta: {title: J.name || 'Jam', bpm: J.bpm, bars, swing: J.swing || 0, seed: 1, version: 1, key: 'a jam', words: `A jam from Studio Jam${J.note ? `: “${J.note}”` : ''}.`, from: 'jam'},
    sections: [['Jam', 0, bars]], ops, trims: {}, tracks: [...tracks.values()]};
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), J = raw.data || raw, session = jamSession(J), tracks = session.tracks;
  const slug = (process.argv[3] || J.name || 'jam').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), bars = session.meta.bars;
  const out = path.join(path.dirname(new URL(import.meta.url).pathname), '../sessions', `jam-${slug}.json`);
  fs.writeFileSync(out, JSON.stringify(session)); console.log(`${out}: ${bars} bars, ${tracks.length} tracks, ${J.notes.length} notes\nnode studio/render.mjs jam-${slug} --session studio/sessions/jam-${slug}.json`);
}
