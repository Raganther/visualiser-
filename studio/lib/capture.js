// Capture: a score turned into a session (plain data a DAW can show, edit and play). It wraps a desk: the score runs as
// it always does, and every call that shapes the song is logged in order (buses, returns, sends, instruments, automation,
// noise swells, textures) with the notes kept per instrument, so play-session.js can rebuild exactly the same song.
// a kit's name in the DAW, from the bus it plays on
const kitLabel = k => k.engine === 'kit' && ({kick: 'Kick', hats: 'Hats', drums: 'Claps and crash', perc: k.kit === '909' && k.over?.ride ? 'Ride and metal' : 'Percussion'}[k.bus] || k.bus);
export function capture(d){
  const ops = [], insts = [], params = new Map(); let inner = 0, sends = 0;
  const wrap = (name, fn) => { const orig = d[name]; d[name] = (...a) => fn(orig, ...a); };
  const inst = obj => insts.find(x => x.obj === obj);
  // a bus's parameters, named, so automation on them can be written down
  const nameParams = (name, b) => { const P = {cut: b.filter.frequency, q: b.filter.Q, level: b.lvl.gain, a: b.a.gain, b: b.b.gain, pan: b.pan.pan, trim: b.in.gain, hp: b.hp?.frequency};
    for (const [p, ap] of Object.entries(P)) if (ap) params.set(ap, {bus: name, p}); };
  wrap('returns', (o, set = {}) => { inner++; const r = o(set); inner--; ops.push(['returns', set]); for (const k of ['echo', 'verb']) nameParams(k, d.buses[k]); return r; });
  wrap('addReturn', (o, name, kind, set = {}, bo = {}) => { inner++; const r = o(name, kind, set, bo); inner--; ops.push(['addReturn', name, kind, set, bo]); nameParams(name, r); return r; });
  wrap('bus', (o, name, bo = {}) => { const b = o(name, bo); if (!inner) ops.push(['bus', name, bo]); nameParams(name, b); return b; });
  wrap('send', (o, from, to, dB = -60) => { const g = o(from, to, dB), id = sends++; ops.push(['send', id, from, to, dB]); params.set(g, {send: id}); return g; });
  // instruments: each one made becomes a track (the palette's stand-ins register themselves with d.onInst)
  const add = (obj, desc) => { const x = {obj, desc, id: 't' + insts.length, notes: [], morph: []}; insts.push(x); ops.push(['inst', x.id]); return obj; };
  d.onInst = (obj, desc) => add(obj, desc);
  wrap('synth', (o, bus, preset, set = {}) => add(o(bus, preset, set), {engine: 'poly', bus, preset, set}));
  wrap('native', (o, bus, name, set = {}) => add(o(bus, name, set), {engine: 'native', bus, name, set}));
  wrap('kit', (o, bus, kit = 'Minimal', over = {}) => add(o(bus, kit, over), {engine: 'kit', bus, kit, over}));
  // notes: kept with their instrument (a chord and a pattern arrive here as their single notes and hits)
  wrap('note', (o, syn, n, bar, step, len = 1, vel = .8) => { inst(syn)?.notes.push([bar, step, n, len, vel]); return o(syn, n, bar, step, len, vel); });
  wrap('hit', (o, kit, voice, bar, step, vel = 1, lock = null) => { inst(kit)?.notes.push(lock ? [bar, step, voice, vel, lock] : [bar, step, voice, vel]); return o(kit, voice, bar, step, vel, lock); });
  // automation, swells and textures, in order
  const target = ap => params.get(ap) || null;
  wrap('ramp', (o, ap, pts, opts = {}) => { ops.push(['ramp', target(ap), pts, opts]); return o(ap, pts, opts); });
  wrap('lfo', (o, ap, opts = {}) => { ops.push(['lfo', target(ap), opts]); return o(ap, opts); });
  wrap('morph', (o, syn, key, pts, every = 1) => { inst(syn)?.morph.push([key, pts, every]); return o(syn, key, pts, every); });
  wrap('noise', (o, bus, a, b, opts = {}) => { ops.push(['noise', bus, a, b, opts]); return o(bus, a, b, opts); });
  d.onTexture = t => ops.push(['texture', t]);
  // the session: the ops, then each instrument's description (with what was set on it after it was made) and its notes
  d.session = (meta, sections) => {
    const trims = {}; for (const [k, b] of Object.entries(d.buses)) { const g = b.in.gain.value; if (Math.abs(g - 1) > 1e-6) trims[k] = +(20*Math.log10(g)).toFixed(2); }
    return {format: 'studio-session', v: 1, meta, sections, ops, trims, tracks: insts.map(x => ({id: x.id, label: x.obj.label || kitLabel(x.desc) || x.desc.preset || x.desc.name, ...x.desc,
      ...(x.obj.side ? {side: true} : {}), ...(x.obj.skins ? {skins: true} : {}), notes: x.notes, morph: x.morph}))};
  };
  return d;
}
