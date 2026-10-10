// The Studio's mixer on any audio context (the page's, or an offline one to render): a strip for every track, group and
// return and the master. A strip: input → its chain of devices (EQ, compressor, sidechain, limiter, any registry effect) →
// pan → volume → mute (and solo) → out to a group or the master; sends after the volume to the returns. Meters on every
// strip while it plays live; each device that turns the sound down says by how much.
import { DEVICES, makeDevice } from './devices.js';
import { stripsOf } from './song.js';

const db = v => v <= -80 ? 0 : Math.pow(10, v/20);
const gainNode = (ctx, g = 1) => { const n = ctx.createGain(); n.gain.value = g; return n; };

export function makeDesk(ctx, song, {out = ctx.destination, env, meters = false} = {}){
  const S = new Map(), subs = new Set();
  const desk = {ctx, song, strips: S,
    // notes as they're scheduled (a sidechain ducks on its source's)
    onNote(fn){ subs.add(fn); return () => subs.delete(fn); },
    note(id, e){ for (const f of subs) f(id, e); },
    // a strip's sound after its chain, before its volume (what a sidechain follows)
    tap: id => S.get(id) && S.get(id).post};
  // every strip's nodes first (a sidechain may listen to any of them), then their chains, then where they go
  const defs = stripsOf(song);
  for (const d of defs) {
    const s = {id: d.id, name: d.name, kind: d.kind, def: d, src: d.kind === 'track' ? song.tracks.find(t => t.id === d.id) : d.kind === 'master' ? song.master : (song.groups || []).concat(song.returns || []).find(x => x.id === d.id),
      input: gainNode(ctx), post: gainNode(ctx), pan: ctx.createStereoPanner(), fader: gainNode(ctx), mute: gainNode(ctx), out: gainNode(ctx), sends: {}, dev: []};
    s.post.connect(s.pan); s.pan.connect(s.fader); s.fader.connect(s.mute); s.mute.connect(s.out);
    S.set(d.id, s);
  }
  for (const s of S.values()) {
    const d = s.def; let n = s.input;
    for (const x of d.chain || []) { const dv = makeDevice(ctx, x, desk, env); dv.d = x; n.connect(dv.input); n = dv.output; s.dev.push(dv); }
    n.connect(s.post);
    s.pan.pan.value = d.pan || 0; s.fader.gain.value = db(d.vol || 0);
  }
  for (const s of S.values()) {
    const d = s.def;
    if (s.kind === 'master') s.out.connect(out);
    else s.out.connect(S.get(d.to && S.has(d.to) ? d.to : 'master').input);
    for (const [r, v] of Object.entries(d.sends || {})) if (S.has(r)) { const g = gainNode(ctx, db(v)); (d.pre ? s.post : s.mute).connect(g); g.connect(S.get(r).input); s.sends[r] = g; }
    if (meters) { s.an = ctx.createAnalyser(); s.an.fftSize = 1024; s.an.smoothingTimeConstant = 0; s.out.connect(s.an); s.buf = new Float32Array(1024); s.pk = -90; }
  }
  // mute and solo: a soloed track (or group) leaves only what's soloed, and the groups and returns it needs
  function mutes(){
    const solo = [...S.values()].filter(s => s.def.solo && (s.kind === 'track' || s.kind === 'group'));
    // (kept: what's soloed, the groups it goes through, and what goes into a soloed group)
    const keep = new Set(); for (const s of solo) { keep.add(s.id); let t = s.def.to; while (t && S.has(t)) { keep.add(t); t = S.get(t).def.to; } }
    const inSolo = s => { let t = s.def.to; while (t && S.has(t)) { if (S.get(t).def.solo) return true; t = S.get(t).def.to; } return false; };
    for (const s of S.values()) {
      const off = s.def.mute || (solo.length && (s.kind === 'track' || s.kind === 'group') && !keep.has(s.id) && !inSolo(s));
      s.mute.gain.setTargetAtTime(off ? 0 : 1, ctx.currentTime, .005);
    }
  }
  mutes();
  // where the song's description of a strip lives (a tweak writes back there, so the song as heard can be copied out)
  const home = s => s.kind === 'track' ? (s.src.mix = s.src.mix || {}) : s.src || (song.master = song.master || {});
  const devOf = (s, id) => s.dev.find(v => v.d.id === id) || s.dev.find(v => v.d.type === id) || (/^\d+$/.test(id) ? s.dev[+id] : null);
  // a parameter by its path within a strip: 'vol', 'pan', 'send.verb', '<device id or type or index>.<setting>'
  desk.target = (id, path) => {
    const s = S.get(id); if (!s) return null;
    const [a, ...r] = path.split('.'), k = r.join('.');
    if (a === 'vol') return {ps: [s.fader.gain], map: db, get: () => s.def.vol || 0, put: v => { s.def.vol = v; home(s).vol = v; }};
    if (a === 'pan') return {ps: [s.pan.pan], map: v => v, get: () => s.def.pan || 0, put: v => { s.def.pan = v; home(s).pan = v; }};
    if (a === 'send') { const g = s.sends[k]; return g && {ps: [g.gain], map: db, get: () => s.def.sends[k], put: v => { s.def.sends[k] = v; home(s).sends = s.def.sends; }}; }
    const dv = devOf(s, a); if (!dv) return null;
    const native = !!DEVICES[dv.d.type], [bi, bf] = k.split('.');
    const get = () => dv.d.bands && bf ? (dv.d.bands[+bi] || {})[bf] : native ? dv.d[k] : (dv.d.p || {})[k];
    const put = v => { if (dv.d.bands && bf) { if (dv.d.bands[+bi]) dv.d.bands[+bi][bf] = v; } else if (native) dv.d[k] = v; else (dv.d.p = dv.d.p || {})[k] = v; };
    return {...(dv.param(k) || {}), set: v => dv.set(k, v), dev: dv, k, get, put};
  };
  // a change by hand (or the UI): heard at once, and written into the song
  desk.set = (id, path, v) => {
    const s = S.get(id); if (!s) return;
    if (path === 'mute' || path === 'solo') { s.def[path] = v; home(s)[path] = v; mutes(); return; }
    const T = desk.target(id, path); if (!T) return;
    if (T.dev) T.dev.set(T.k, v); else for (const p of T.ps) p.setTargetAtTime(T.map(v), ctx.currentTime, .01);
    T.put(v);
  };
  // tempo-following effects keep their time; called by the scheduler
  desk.tick = t => { for (const s of S.values()) for (const dv of s.dev) if (dv.tick) dv.tick(t); };
  // the meters: each strip's peak (falling back slowly) and level, and how far its devices are turning it down
  desk.meter = (id, dt = 1/60, fall = 18) => {
    const s = S.get(id); if (!s || !s.an) return null;
    s.an.getFloatTimeDomainData(s.buf); let pk = 0, ms = 0; for (const x of s.buf) { const a = Math.abs(x); if (a > pk) pk = a; ms += x*x; }
    const p = 20*Math.log10(pk + 1e-9), rms = 10*Math.log10(ms/s.buf.length + 1e-12);
    s.pk = Math.max(p, s.pk - fall*dt);
    return {peak: s.pk, now: p, rms, gr: s.dev.map(dv => dv.gr ? Math.max(0, dv.gr()) : 0)};
  };
  desk.dispose = () => { for (const s of S.values()) for (const dv of s.dev) if (dv.dispose) dv.dispose(); subs.clear(); S.get('master').out.disconnect(); };
  return desk;
}
