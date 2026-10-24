// A song mixed the traditional way, with every sound and every processor native (computed sample by sample by the parts
// host): a channel a part, the drums and the music each into a bus, an echo and a room on sends, the kick keying a
// sidechain compressor on the bass, the chords, the leads and the room, and the master bus. This module turns a song
// written out for the DAW (studio/arrange/flatten.js) and its sounds into the host's description (sources, strips) and
// its timed messages; the page plays them and lets you change the mix.
import { nativeSet, cutOf, LEN } from '../jam/model.js';
import { NATIVE } from '../lib/native/index.js';
import { NATIVE_OF } from '../lib/palette.js';

const db = g => 20*Math.log10(Math.max(1e-9, g)), q = (v, s) => Math.round(v/s)*s;
// the kick: the analog drum machine's (deep, round, no drive, darker: as the one you saved was)
export const KICK = {kit: 'Analog Deep', over: {kick: {drive: 0, tone: .3, x: .25}}};

// each channel's id from its track (the second lead is lead2)
export const chanOf = (P, i) => { const T = P.tracks[i], same = P.tracks.slice(0, i).filter(x => x.role === T.role).length; return T.role + (same ? same + 1 : ''); };

// a part's instrument: the drum machine's kick, a drum sound's pads as native slots, or a pitched sound's native instrument
export function sourceOf(T, SND, s = T.set){ const S = SND[T.sound];
  if (T.role === 'kick') return {kind: 'kit', ...KICK};
  if (S.voices) return {kind: 'native', slots: padSlots(S, s)};
  const name = S.src.native || NATIVE_OF[S.src.palette]; return {kind: 'native', slots: {'': {name, gain: NATIVE[name].gain, params: {...nativeSet(s, name, S.src.set || {}), ...S.src.knobs}}}}; }
const padSlots = (S, s) => Object.fromEntries(Object.entries(S.voices).filter(([, m]) => m.native).map(([v, m]) => [v, {name: m.native, gain: NATIVE[m.native]?.gain ?? .5,
  params: {...nativeSet(s, m.native, m.set || {}), ...m.knobs}, choke: v === 'ohh' ? 'hat' : null, chokes: v === 'chh' || v === 'ohh' ? 'hat' : null}]));
const shiftOf = S => S.src?.shift || 0;

/* ---------- the mix: each strip's processors, fader, pan, sends ---------- */
const pr = (key, params = {}, label) => ({id: key, key, params, on: true, ...(label ? {label} : {})});
// how each part is treated, by its role (the channels' own processors: a cut, an EQ, a compressor, the sidechain)
const CH = {
  kick: () => [pr('eq', {lo: 2, loF: 55, mid: -3, midF: 320, q: 1.2, hi: 1.5, hiF: 4000}), pr('glue', {thr: -16, ratio: 3, att: 12, rel: 90, makeup: 1})],
  hats: () => [pr('cut', {freq: 350}), pr('eq', {mid: -2, midF: 2500, q: 1, hi: 1.5, hiF: 10000}), pr('glue', {thr: -22, ratio: 2, att: 2, rel: 60})],
  perc: () => [pr('cut', {freq: 100}), pr('eq', {mid: -2.5, midF: 500, q: 1, hi: 1, hiF: 8000}), pr('glue', {thr: -20, ratio: 2.5, att: 5, rel: 100}), pr('width', {width: 1.25})],
  bass: () => [pr('cut', {freq: 32}), pr('eq', {lo: 1.5, loF: 80, mid: -3, midF: 250, q: 1, hi: 1, hiF: 2500}), pr('glue', {thr: -20, ratio: 4, att: 15, rel: 140, makeup: 2}),
    pr('saturate', {amount: .12}), pr('sidechain', {key: 'kick', thr: -30, ratio: 8, att: .5, rel: 140, range: 9}), pr('width', {width: 0})],
  chords: () => [pr('cut', {freq: 160}), pr('eq', {mid: -2, midF: 400, q: 1, hi: 1.5, hiF: 9000}), pr('glue', {thr: -22, ratio: 2, att: 20, rel: 200}),
    pr('sidechain', {key: 'kick', thr: -30, ratio: 6, att: 1, rel: 260, range: 7}), pr('width', {width: 1.3})],
  lead: () => [pr('cut', {freq: 180}), pr('eq', {mid: -2, midF: 450, q: 1, hi: 1, hiF: 7000}), pr('glue', {thr: -18, ratio: 2, att: 8, rel: 120}),
    pr('sidechain', {key: 'kick', thr: -30, ratio: 4, att: 1, rel: 180, range: 3})],
};
// the buses and returns
const BUS = {
  drums: () => [pr('glue', {thr: -16, ratio: 2.5, att: 10, rel: 120, makeup: 1, mix: .7}), pr('tape', {drive: .2})],
  music: () => [pr('glue', {thr: -22, ratio: 1.8, att: 25, rel: 200})],
  echo: () => [pr('echo', {time: 1, mix: 1, fb: .45, tone: .35, dry: 0}), pr('cut', {freq: 180})],
  room: () => [pr('room', {size: 1.1, decay: 2.2, damp: .5, pre: 15, cut: 220, mix: 1, dry: 0}), pr('sidechain', {key: 'kick', thr: -32, ratio: 6, att: 1, rel: 220, range: 6})],
  bus: () => [pr('trim', {gain: 4}), pr('eq', {lo: .5, loF: 40, hi: 1, hiF: 12000}), pr('glue', {thr: -14, ratio: 2, att: 30, rel: 180}), pr('width', {width: 1.1}), pr('ceiling', {knee: .89})],
};
// gain staging: each channel's input gain, so its peaks reach the processors near -9 dBFS (measured offline over the song)
export const GAIN = {kick: -5.8, hats: 7.5, perc: -3, bass: -3.6, chords: 10.8, lead: 5.2, lead2: 6.9};
// how much louder each channel's processors leave it, measured over the song (so the fader can take it back off and the
// song's own balance between its parts stays as it was written)
export const CAL = {kick: 1.6, hats: -.8, perc: -.9, bass: -2.9, chords: -9.6, lead: -5, lead2: -4};
// then the balance: the kick, now the analog drum machine's, set against the bass; the others as the song had them
export const TRIM = {kick: -2, hats: 0, perc: 0, bass: 0, chords: 0, lead: 0, lead2: 0};
export const faderOf = (id, vol) => +(db(.85) + (vol || 0) - (GAIN[id] ?? 0) - (CAL[id] ?? 0) + (TRIM[id] ?? 0)).toFixed(1);

export function mixOf(P, SND){ const strips = [], sources = {};
  P.tracks.forEach((T, i) => { const id = chanOf(P, i); sources[id] = sourceOf(T, SND);
    const drum = ['kick', 'hats', 'perc'].includes(T.role), s = T.set;
    strips.push({id, label: T.name, role: T.role, input: T.role === 'kick' ? {src: id, pad: 'kick'} : {src: id}, chain: [pr('trim', {gain: GAIN[id] ?? 0}), ...CH[T.role]()], lp: cutOf(s.x ?? .62),
      level: faderOf(id, T.mix.vol), pan: T.mix.pan || 0, out: drum ? 'drums' : 'music', sends: sendsOf(s)}); });
  strips.push({id: 'drums', label: 'Drum bus', bus: true, input: null, chain: BUS.drums(), level: 0, out: 'bus'},
    {id: 'music', label: 'Music bus', bus: true, input: null, chain: BUS.music(), level: 0, out: 'bus'},
    {id: 'echo', label: 'Echo', ret: true, input: null, chain: BUS.echo(), level: -2, out: 'bus'},
    {id: 'room', label: 'Room', ret: true, input: null, chain: BUS.room(), level: -1, out: 'bus'},
    {id: 'bus', label: 'Master bus', bus: true, input: null, chain: BUS.bus(), level: -1, out: 'master'},
    {id: 'master', label: 'Out', input: null, chain: [pr('ceiling', {knee: .97})], out: null});
  // each processor's id its strip's and its own (so the meters and your changes are told apart)
  for (const x of strips) for (const c of x.chain) c.id = x.id + '-' + c.id;
  return {period: 60/P.bpm, sources, strips}; }
// a part's sends as its song set them (the echo and the room, by its space, after the fader)
const sendsOf = s => ({echo: s.echo ? +db((s.y ?? .3)*.5).toFixed(1) : -60, room: s.verb ? +db((s.y ?? .3)*.75).toFixed(1) : -60});

/* ---------- the song as timed messages ---------- */
// every message from bar `from` on, each at its time in seconds from there: a clip's settings as it starts (its
// instrument's settings, its level, its sends, its tone), then its notes. The first clip each part is in is set at 0.
export function eventsOf(P, SND, from = 0){ const sd = 60/P.bpm/4, out = [], f16 = from*16; let id = 0;
  P.tracks.forEach((T, i) => { const ch = chanOf(P, i), S = SND[T.sound];
    for (const cl of T.clips) { const a = cl.start*16, b = a + cl.len; if (b <= f16) continue;
      const s = {...T.set, ...cl.set}, t0 = Math.max(0, (a - f16)*sd);
      // the clip's settings, a moment before its first note
      if (T.role !== 'kick') { const lv = Math.pow(10, (s.vol || 0)/20), slots = S.voices ? padSlots(S, s) : sourceOf(T, SND, s).slots;
        out.push({t: t0, m: {type: 'set', src: ch, all: true, slots: Object.fromEntries(Object.entries(slots).map(([k, d]) => [k, {...d.params, lv}]))}}); }
      out.push({t: t0, m: {type: 'strip', id: ch, set: {sends: sendsOf(s), lp: cutOf(s.x ?? .62)}}});
      for (const n of cl.notes) { if (n.s < 0 || n.s >= cl.len) continue; const at = a + n.s; if (at < f16) continue; const t = (at - f16)*sd;
        if (T.role === 'kick') out.push({t, m: {type: 'hit', src: ch, voice: 'kick', vel: n.v}});
        else if (S.voices) { const v = S.voices[n.p]; if (v?.native) out.push({t, m: {type: 'on', src: ch, slot: n.p, id: ++id, n: v.n ?? 60, vel: q(n.v, .1), gv: n.v}}); }
        else { const len = Math.round(n.l*sd*20)/20, k = ++id; out.push({t, m: {type: 'on', src: ch, id: k, n: n.p + shiftOf(S), vel: q(n.v, .1), gv: n.v, len}}, {t: t + n.l*sd, m: {type: 'off', src: ch, id: k}}); } } } });
  return out.sort((x, y) => x.t - y.t); }
export { LEN };
