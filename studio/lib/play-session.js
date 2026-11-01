// A session (lib/capture.js's data: the song as ops, tracks and notes) played back onto a desk: the buses, returns, sends,
// instruments, automation, swells, textures and every note, so a session renders exactly as the score it came from (or as
// the user edited it in the DAW).
import { synth, nativeToms, cloud, rainAt } from './palette.js';

export function playSession(d, s){
  const tracks = new Map(s.tracks.map(t => [t.id, t])), made = new Map(), sends = [];
  const param = tg => !tg ? null : tg.send != null ? sends[tg.send] : (b => b && ({cut: b.filter.frequency, q: b.filter.Q, level: b.lvl.gain, a: b.a.gain, b: b.b.gain, pan: b.pan.pan, trim: b.in.gain, hp: b.hp?.frequency, eqLo: b.eqLo?.gain, eqMid: b.eqMid?.gain, eqHi: b.eqHi?.gain})[tg.p])(d.buses[tg.bus]);
  const make = t => t.engine === 'poly' ? d.synth(t.bus, t.preset, t.set) : t.engine === 'native' ? d.native(t.bus, t.name, t.set)
    : t.engine === 'palette' ? synth(d, t.bus, t.name, t.over) : (k => { if (t.side) k.side = true; if (t.skins) nativeToms(d, k); return k; })(d.kit(t.bus, t.kit, t.over));
  for (const op of s.ops) { const [k, ...a] = op;
    if (k === 'returns') d.returns(a[0]);
    else if (k === 'bus') d.bus(a[0], a[1]);
    else if (k === 'master') d.masterSet(a[0]);
    else if (k === 'addReturn') d.addReturn(...a);
    else if (k === 'send') sends[a[0]] = d.send(a[1], a[2], a[3]);
    else if (k === 'inst') { const t = tracks.get(a[0]); if (t && (t.notes.length || t.morph.length)) made.set(t.id, make(t)); }
    else if (k === 'ramp') { const p = param(a[0]); if (p) d.ramp(p, a[1], a[2]); }
    else if (k === 'lfo') { const p = param(a[0]); if (p) d.lfo(p, a[1]); }
    else if (k === 'noise') d.noise(...a);
    else if (k === 'texture') { const t = a[0]; (t.kind === 'cloud' ? cloud : rainAt)(d, t.bus, t.bar, t.bars, t.opts); }
  }
  for (const [k, v] of Object.entries(s.trims || {})) if (d.buses[k]) d.buses[k].in.gain.value = Math.pow(10, v/20);
  // the user's mix from the DAW: each bus's fader in dB, on top of the piece's trims
  for (const [k, v] of Object.entries(s.mix || {})) if (d.buses[k]) d.buses[k].in.gain.value *= Math.pow(10, v/20);
  // the tracks the DAW added, or whose instrument it changed, that the ops don't make
  for (const t of s.tracks) if (!made.has(t.id) && (t.notes.length || t.morph.length) && d.buses[t.bus]) made.set(t.id, make(t));
  for (const t of s.tracks) { const syn = made.get(t.id); if (!syn || t.mute) continue;
    for (const [key, pts, every] of t.morph) d.morph(syn, key, pts, every);
    if (t.engine === 'kit') for (const [bar, step, voice, vel, lock] of t.notes) d.hit(syn, voice, bar, step, vel, lock || null);
    else for (const [bar, step, n, len, vel] of t.notes) d.note(syn, n, bar, step, len, vel); }
}
