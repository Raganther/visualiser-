// The DAW's desk: the project's tracks as the parts host's channel strips (studio/lib/parts/desk.js), each fed by its
// track's own instrument node (the strip's `{ext: i}` input), its processors by its role unless you've changed them
// (`T.desk.chain`), its fader the track's level, its sends the section's space moved by as much as you've moved yours;
// the buses, the returns and the master bus as the song left them (`P.desk`). The gain staging comes from each sound's
// measured peak (peaks.js, written by peaks.mjs): its input gain brings the peaks near -9 dBFS before the processors, and
// its fader takes off what they add, so a track sounds as loud as it did before the desk and a new sound keeps the balance.
import { channel, buses, ids, sendsOf, ROLE_CAL, db, pr } from '../lib/parts/desk.js';
import { cutOf, ECHO } from '../jam/model.js';
import { PEAKS } from './peaks.js';

const clone = x => JSON.parse(JSON.stringify(x));
// a role's typical peak where a sound hasn't been measured (your own copies take their original's)
const ROLE_PK = {kick: -3.3, hats: -16, perc: -7, bass: -5.5, chords: -11.5, lead: -14};
export const kickOf = P => P.tracks.find(T => T.role === 'kick')?.id || '';
const peakOf = (sound, role, SND) => PEAKS[sound] ?? PEAKS[SND?.[sound]?.base] ?? ROLE_PK[role] ?? -10;
export const gainOf = (sound, role, SND) => +(-9 - peakOf(sound, role, SND)).toFixed(1);
// the track's fader on the desk: its level as the song set it, less what its gain and processors add (the analog
// drum machine's kick a little under the bass)
export const faderOf = (T, SND, sound = T.sound) => +(db(.85) + (T.mix.vol || 0) - gainOf(sound, T.role, SND) - (ROLE_CAL[T.role] ?? -3) + (T.role === 'kick' ? -2 : 0)).toFixed(1);
// a send as the section has it, moved as you've moved it: yours where the song had it off, off where the section
// turns it off, else the section's moved by your change
export function ownSend(mine, base, v){ return mine == null || mine === base ? v : v <= -59.5 ? -60 : base <= -59.5 ? mine : Math.max(-60, Math.min(0, mine + v - base)); }
// the echo's time on the beat as the song set it (Studio Jam's divisions to the echo's own)
const ECHO_TIME = [1, 2, 0, 3];

// the processors a track starts with: its role's, with the old desk's settings carried over (a song saved before the
// native desk: its three-band EQ, and the kick's duck as the sidechain's depth, 0 none)
function startChain(T, key, gain){ const ch = channel({id: T.id, role: T.role, key, gain}).chain, M = T.mix || {};
  if (M.lo || M.mid || M.hi) ch.splice(1, 0, {...pr('eq', {lo: M.lo || 0, loF: 120, mid: M.mid || 0, midF: 1000, q: .8, hi: M.hi || 0, hiF: 6000}), id: 'eq0'});
  const sc = ch.find(c => c.key === 'sidechain'); if (sc && M.duck === 0) sc.on = false;
  return ch; }
export function deskOf(P, SND){ const key = kickOf(P);
  const strips = P.tracks.map((T, i) => { const d = T.desk || {}, base = sendsOf(T.set), gain = gainOf(T.sound, T.role, SND);
    const s = channel({id: T.id, label: T.name, role: T.role, input: {ext: i}, key, level: faderOf(T, SND), pan: T.mix.pan || 0, lp: cutOf(T.set.x ?? .62),
      mute: !!T.mute, solo: !!T.mix.solo, sends: {echo: d.sends?.echo ?? base.echo, room: d.sends?.room ?? base.room}});
    s.chain = d.chain ? clone(d.chain) : startChain(T, key, gain);
    // (the sidechain always listens to the song's kick, and the input gain follows the sound)
    for (const c of s.chain) { if (c.key === 'sidechain') c.params = {...c.params, key}; if (c.key === 'trim' && !d.gainSet) c.params = {...c.params, gain}; }
    return s; });
  const bs = buses(key), M = {glue: 2, width: 3, lo: 0, hi: 0, vol: 0, ...P.mx};
  for (const b of bs) { const d = P.desk?.[b.id];
    if (b.id === 'echo') b.chain[0].params.time = ECHO_TIME[P.echoDiv || 0] ?? 1;
    if (b.id === 'bus') { b.level += M.vol || 0; if (M.lo || M.hi) { const eq = b.chain.find(c => c.key === 'eq'); eq.params.lo += M.lo; eq.params.hi += M.hi; } }
    if (d?.chain) b.chain = clone(d.chain); if (d?.level != null) b.level = d.level; if (d?.mute) b.mute = true;
    for (const c of b.chain) if (c.key === 'sidechain') c.params = {...c.params, key}; }
  return {period: 60/P.bpm, sources: {}, strips: ids([...strips, ...bs])}; }
// a section's settings for a track's strip: its space (moved as you've moved it), its tone, its own level
export function sectionStrip(T, s, glide){ const base = sendsOf(T.set), sec = sendsOf(s), mine = T.desk?.sends || {};
  return {sends: {echo: ownSend(mine.echo, base.echo, sec.echo), room: ownSend(mine.room, base.room, sec.room)}, lp: cutOf(s.x ?? .62), lpGlide: glide ?? .05, clip: s.vol || 0}; }
