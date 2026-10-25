// The drum rack: one track whose kit is every drum at once (a leaf of the arrangement page; the tests run it in node).
// A rack's sound is a drum sound with a pad for each drum (`voices`), each pad saying which sound it came from (`from`):
// pack 6's analog kits, or the song's own kick, hats and percussion put together (`rackSound`). On the desk each pad has
// its own strip, into the rack's strip, into the drum bus (studio/arrange/desk.js); the track's instrument node has an
// output a pad (engine.js). Studio Jam's songs come with a kick, a hats and a percussion track: `combineDrums` makes them
// one rack track, their notes in one clip a section, each part's level, pan, tone, space and processors kept on its pads.
export const PADS = ['kick', 'snare', 'clap', 'chh', 'ohh', 'ride', 'crash', 'tomL', 'tomH', 'log', 'logH', 'wood', 'rim', 'clave', 'cow', 'shaker', 'metal', 'bowl', 'gong'];
export const PART_ROLES = ['kick', 'hats', 'perc'];
export const isRack = T => T?.role === 'drums';
const HAT = new Set(['chh', 'ohh', 'ride', 'crash']);
const clone = x => JSON.parse(JSON.stringify(x));
// a pad's role (its processors and gain staging): its sound's, else by the drum
export const padRole = (pad, m, SND) => { const r = SND?.[m?.from]?.role; return PART_ROLES.includes(r) ? r : pad === 'kick' ? 'kick' : HAT.has(pad) ? 'hats' : 'perc'; };
const order = list => [...PADS.filter(v => list.has(v)), ...[...list].filter(v => !PADS.includes(v))];
// a rack track's pads: every drum, and any other its sounds or notes have (the same whatever kit it's on, so changing
// the kit keeps each pad's strip)
export function padsOf(T, SND){ const have = new Set(PADS);
  for (const id of [T.sound, ...T.clips.map(c => c.set?.sound).filter(Boolean)]) for (const v of Object.keys(SND[id]?.voices || {})) have.add(v);
  for (const c of T.clips) for (const n of c.notes) if (typeof n.p === 'string') have.add(n.p);
  return order(have); }
// the desk node's inputs: a track one, a rack a pad each ([{base, pads}])
export function inputsOf(P, SND){ let at = 0; return P.tracks.map(T => { const pads = isRack(T) ? padsOf(T, SND) : null, io = {base: at, pads}; at += pads ? pads.length : 1; return io; }); }
export const inputCount = io => io.reduce((n, x) => n + (x.pads ? x.pads.length : 1), 0);

// drum sounds put together as one rack (registered in SND under an id made of theirs, so a project names it and it
// comes back): each sound's pads, a pad another already has renamed (`crash2`); ren: each sound's pads as renamed
export function rackSound(ids, SND){ const id = 'rack:' + ids.join('+'), ren = ids.map(() => ({}));
  if (!SND[id]) { const voices = {};
    ids.forEach((sid, i) => { for (const [v, m] of Object.entries(SND[sid]?.voices || {})) { let k = v, n = 2; while (voices[k]) k = v + n++; voices[k] = {...m, from: m.from || sid}; } });
    SND[id] = {id, role: 'drums', rack: true, voices, name: ids.map(s => SND[s]?.name || s).join(' + '), words: 'The song’s own drums as one rack: ' + ids.map(s => SND[s]?.name || s).join(', ') + ', each drum on its own pad.'}; }
  // (the renames, worked out the same way each time)
  const seen = new Set(); ids.forEach((sid, i) => { for (const v of Object.keys(SND[sid]?.voices || {})) { let k = v, n = 2; while (seen.has(k)) k = v + n++; seen.add(k); if (k !== v) ren[i][v] = k; } });
  return {id, ren}; }
// the racks a project names, made again (a saved song's, or one of your copies' base)
export function ensureRacks(P, SND){ const want = id => { if (id?.startsWith('rack:') && !SND[id]) rackSound(id.slice(5).split('+'), SND); };
  for (const T of P.tracks) { want(T.sound); for (const c of T.clips) want(c.set?.sound); }
  for (const s of Object.values(P.sounds || {})) want(s.base); }

// the kick, hats and percussion tracks as one drum rack track, where the rack track goes: the first of them. Each part's
// notes in the clips that share a place (a section's), its level, pan, tone and sends as its pads', its processors
// (if you'd changed them) as its pads' too. A project already racked, or with fewer than two drum tracks, is left be.
export function combineDrums(P, SND){ const D = P.tracks.filter(T => PART_ROLES.includes(T.role));
  if (D.length < 2 || P.tracks.some(isRack)) return P;
  const {id: sound, ren} = rackSound(D.map(T => T.sound), SND), pads = {}, dpads = {};
  D.forEach((T, i) => { for (const v of Object.keys(SND[T.sound]?.voices || {})) { const k = ren[i][v] || v;
    pads[k] = {vol: T.mix.vol || 0, pan: T.mix.pan || 0, x: T.set.x, y: T.set.y, echo: !!T.set.echo, verb: !!T.set.verb, ...(T.mute ? {mute: true} : {}), ...(T.mix.solo ? {solo: true} : {})};
    if (T.desk) dpads[k] = clone(T.desk); } });
  // the clips, gathered by where they are
  const at = new Map(), name = new Map(); D.forEach((T, i) => { for (const c of T.clips) { const k = c.start + '|' + c.len; if (!at.has(k)) at.set(k, []); at.get(k).push([i, c]); } });
  const clips = [...at.values()].map(list => { const [, c0] = list[0], ids = D.map(T => T.sound), own = list.some(([i, c]) => c.set?.sound && c.set.sound !== D[i].sound);
    for (const [i, c] of list) if (c.set?.sound) ids[i] = c.set.sound;
    const r = own ? rackSound(ids, SND) : null, set = {}; if (r) set.sound = r.id;
    const notes = list.flatMap(([i, c]) => c.notes.map(n => ({...n, p: (r ? r.ren : ren)[i][n.p] || n.p}))).sort((a, b) => a.s - b.s);
    return {id: c0.id + 'd', start: c0.start, len: c0.len, name: [...new Set(list.map(([, c]) => c.name).filter(Boolean))].join(' · ') || 'Drums', set, notes}; });
  clips.sort((a, b) => a.start - b.start);
  const T = {id: 'rack', role: 'drums', name: 'Drums', sound, mix: {vol: 0, pan: 0, duck: 0, lo: 0, mid: 0, hi: 0, solo: false}, set: {x: 1, y: .3, motion: 0, length: 1, echo: false, verb: false},
    pads, ...(Object.keys(dpads).length ? {desk: {pads: dpads}} : {}), mute: false, clips};
  const first = P.tracks.indexOf(D[0]), tracks = P.tracks.filter(x => !D.includes(x)); tracks.splice(first, 0, T);
  return {...P, tracks}; }
