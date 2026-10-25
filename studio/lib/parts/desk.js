// The desk: a mix laid out the traditional way, as the parts host's description (a leaf of the parts). A channel a part,
// its processors by its role (an input gain for gain staging, a low cut, an EQ, a compressor; the bass, chords and leads
// with a sidechain compressor the kick keys), the drums and the music each into a bus, an echo and a room on sends (the
// room ducked by the kick too), the master bus (EQ, glue, width, a ceiling) and a safety ceiling after it. The Mix Lab
// (studio/mix/mix.js) and the Studio DAW (studio/arrange/engine.js) both build theirs from it.
export const db = g => 20*Math.log10(Math.max(1e-9, g));
export const pr = (key, params = {}) => ({id: key, key, params, on: true});
export const DRUMS = ['kick', 'hats', 'perc', 'drums'];
// each role's processors (key: the strip the sidechain listens to, the kick's)
export const CH = {
  kick: () => [pr('eq', {lo: 2, loF: 55, mid: -3, midF: 320, q: 1.2, hi: 1.5, hiF: 4000}), pr('glue', {thr: -16, ratio: 3, att: 12, rel: 90, makeup: 1})],
  hats: () => [pr('cut', {freq: 350}), pr('eq', {mid: -2, midF: 2500, q: 1, hi: 1.5, hiF: 10000}), pr('glue', {thr: -22, ratio: 2, att: 2, rel: 60})],
  perc: () => [pr('cut', {freq: 100}), pr('eq', {mid: -2.5, midF: 500, q: 1, hi: 1, hiF: 8000}), pr('glue', {thr: -20, ratio: 2.5, att: 5, rel: 100}), pr('width', {width: 1.25})],
  bass: key => [pr('cut', {freq: 32}), pr('eq', {lo: 1.5, loF: 80, mid: -3, midF: 250, q: 1, hi: 1, hiF: 2500}), pr('glue', {thr: -20, ratio: 4, att: 15, rel: 140, makeup: 2}),
    pr('saturate', {amount: .12}), pr('sidechain', {key, thr: -30, ratio: 8, att: .5, rel: 140, range: 9}), pr('width', {width: 0})],
  chords: key => [pr('cut', {freq: 160}), pr('eq', {mid: -2, midF: 400, q: 1, hi: 1.5, hiF: 9000}), pr('glue', {thr: -22, ratio: 2, att: 20, rel: 200}),
    pr('sidechain', {key, thr: -30, ratio: 6, att: 1, rel: 260, range: 7}), pr('width', {width: 1.3})],
  lead: key => [pr('cut', {freq: 180}), pr('eq', {mid: -2, midF: 450, q: 1, hi: 1, hiF: 7000}), pr('glue', {thr: -18, ratio: 2, att: 8, rel: 120}),
    pr('sidechain', {key, thr: -30, ratio: 4, att: 1, rel: 180, range: 3})],
};
// how much louder a role's processors leave it, as measured over round 4's songs (studio/mix/levels.js): where a sound
// hasn't been measured in its song, its fader takes this back off
export const ROLE_CAL = {kick: 1.6, hats: -1, perc: -1.5, bass: -5, chords: -7, lead: -4.3};
// the buses, the returns, the master bus and the out
export const BUS = {
  drums: () => [pr('glue', {thr: -16, ratio: 2.5, att: 10, rel: 120, makeup: 1, mix: .7}), pr('tape', {drive: .2})],
  music: () => [pr('glue', {thr: -22, ratio: 1.8, att: 25, rel: 200})],
  echo: () => [pr('echo', {time: 1, mix: 1, fb: .45, tone: .35, dry: 0}), pr('cut', {freq: 180})],
  room: key => [pr('room', {size: 1.1, decay: 2.2, damp: .5, pre: 15, cut: 220, mix: 1, dry: 0}), pr('sidechain', {key, thr: -32, ratio: 6, att: 1, rel: 220, range: 6})],
  bus: () => [pr('trim', {gain: 4}), pr('eq', {lo: .5, loF: 40, hi: 1, hiF: 12000}), pr('glue', {thr: -14, ratio: 2, att: 30, rel: 180}), pr('width', {width: 1.1}), pr('ceiling', {knee: .89})],
};
// a part's sends as its section sets them: the echo and the room, by its space, after the fader
export const sendsOf = s => ({echo: s.echo ? +db((s.y ?? .3)*.5).toFixed(1) : -60, room: s.verb ? +db((s.y ?? .3)*.75).toFixed(1) : -60});
// a channel strip for a part: its role's processors after its input gain
export function channel({id, label, role, input, key = 'kick', gain = 0, level = 0, pan = 0, sends = {}, ...x}){
  return {id, label, role, input, chain: [pr('trim', {gain}), ...(CH[role] || CH.lead)(key)], level, pan, out: DRUMS.includes(role) ? 'drums' : 'music', sends, ...x}; }
// the buses, returns, master bus and out
export const buses = key => [
  {id: 'drums', label: 'Drum bus', bus: true, input: null, chain: BUS.drums(), level: 0, out: 'bus'},
  {id: 'music', label: 'Music bus', bus: true, input: null, chain: BUS.music(), level: 0, out: 'bus'},
  {id: 'echo', label: 'Echo', ret: true, input: null, chain: BUS.echo(), level: -2, out: 'bus'},
  {id: 'room', label: 'Room', ret: true, input: null, chain: BUS.room(key), level: -1, out: 'bus'},
  {id: 'bus', label: 'Master bus', bus: true, input: null, chain: BUS.bus(), level: -1, out: 'master'},
  {id: 'master', label: 'Out', input: null, chain: [pr('ceiling', {knee: .97})], out: null}];
// each processor's id its strip's and its own (so the meters and changes are told apart)
export const ids = strips => { for (const x of strips) for (const c of x.chain) if (!c.id.startsWith(x.id + '-')) c.id = x.id + '-' + c.id; return strips; };
