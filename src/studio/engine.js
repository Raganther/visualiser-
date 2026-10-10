// The Studio's engine: a song (src/studio/song.js) built into a graph on any audio context, and the scheduler that plays it.
// The scheduler walks the song a sixteenth at a time ("windows"): the clips each track plays there (from the arrangement,
// or the scenes launched by hand), their notes with swing and chance, the automation lanes and modulators. Live, the page's
// clock drives it a little ahead of time; offline, it runs between the context's suspends, so a render is the song as played.
import { instrument } from '../audio/engine/registry.js';
import { SHAPES, lfoHz } from '../audio/engine/inst/vkit.js';
import { makeDesk } from './desk.js';
import { arrangement, readClip, scene } from './song.js';
import { TUNE } from '../tuning.js';

// a number in 0..1 from anything, the same every time (chance, so a render and a live play roll the same dice)
const hash = (...xs) => { let h = 2166136261; for (const x of xs) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 47; h = Math.imul(h, 16777619); } return (h >>> 0)/4294967296; };
// a lane's value at x: straight lines between its points, held before the first and after the last
function laneAt(pts, x){
  if (!pts.length) return null; if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return b === a ? vb : va + (vb - va)*(x - a)/(b - a); }
  return pts[pts.length - 1][1];
}
const wave = (shape, ph) => { const f = ph - Math.floor(ph), s = typeof shape === 'string' ? SHAPES.indexOf(shape) : shape;
  return [Math.sin(2*Math.PI*f), 1 - 4*Math.abs(f - .5), f < .5 ? 1 : -1, 2*f - 1, 1 - 2*f, hash('r', Math.floor(ph))*2 - 1][Math.max(0, s)]; };

export function buildSong(ctx, song, {out = ctx.destination, meters = false, onNote = null} = {}){
  const P = 60/song.bpm, S16 = P/4;
  const env = {period: () => P, t0: 0, clock: {beat: t => (t - env.t0)/P, period: () => P, bpm: () => song.bpm},
    onNote: fn => desk.onNote((id, e) => fn({...e, ch: e.voice || id}))};
  const desk = makeDesk(ctx, song, {out, env, meters});
  const tracks = song.tracks.map((t, i) => {
    const I = instrument(t.inst.type), inst = I.make(ctx, desk.strips.get(t.id).input, env);
    inst.load(I.key === 'drums' ? t.inst : {...((I.presets || {})[t.inst.preset] || {}), ...(t.inst.p || {})});
    return {t, i, I, inst};
  });
  const T = id => tracks.find(x => x.t.id === id);
  const E = {song, ctx, desk, tracks, env, P, S16, t0: 0, n: 0, mode: 'arrange', session: {scene: null, at: 0, next: null}, over: {}, on: false};
  const A = arrangement(song);
  E.bars = A.bars; E.parts = A.parts;

  /* ---------- where a parameter lives, by its path: '<track>.inst.<knob>' or '<strip>.<vol | pan | send.x | device.setting>' ---------- */
  E.target = path => {
    const [id, ...r] = path.split('.'), rest = r.join('.'), tr = T(id);
    if (tr && r[0] === 'inst') {
      const k = r.slice(1).join('.'), q = tr.inst.param(k), ip = tr.t.inst;
      const get = () => tr.I.key === 'drums' ? (tr.inst.P[r[1]] || {})[r[2]] : tr.inst.P[k];
      const put = v => { if (tr.I.key === 'drums') { const vo = ip.voices = ip.voices || {}; (vo[r[1]] = vo[r[1]] || {})[r[2]] = v; } else (ip.p = ip.p || {})[k] = v; };
      return q ? {ps: [q.p], map: q.map, get, put, inst: tr.inst, k} : {set: v => tr.inst.set(k, v), get, put, inst: tr.inst, k};
    }
    return desk.target(id, rest);
  };
  // a change by hand: heard at once and written into the song
  E.set = (path, v) => {
    const [id, ...r] = path.split('.'), tr = T(id);
    if (tr && r[0] === 'inst') { const q = E.target(path); tr.inst.set(q.k, v); q.put(v); }
    else desk.set(id, r.join('.'), v);
  };

  /* ---------- automation lanes and modulators, resolved once ---------- */
  const lanes = (song.auto || []).map(a => ({path: a.target, q: E.target(a.target), pts: (a.points || []).map(([b, v]) => [b*16, v]).sort((x, y) => x[0] - y[0])})).filter(l => l.q);
  const mods = (song.mods || []).map(m => ({...m, q: E.target(m.target)})).filter(m => m.q);
  const base = (path, q, x) => { const l = lanes.find(l => l.path === path); return l ? laneAt(l.pts, x) : q.get(); };
  // the sixteenth n's time (swing delays the off ones), and the grid's own (for automation, which doesn't swing)
  E.grid = x => E.t0 + x*S16;
  E.time = (n, f = 0, sw = song.swing || 0) => E.t0 + (n + f)*S16 + (n % 2 ? sw*S16 : 0);
  const started = new Set();
  // a value along a param: set once at the start, then ramps from window to window (a modulator's in quarters of one)
  function drive(q, key, n, val){
    if (q.ps) {
      const steps = mods.some(m => m.target === key) ? 4 : 1;
      for (const p of q.ps) {
        if (!started.has(p)) { started.add(p); p.cancelScheduledValues(E.grid(n)); p.setValueAtTime(q.map(val(n)), E.grid(n)); }
        for (let k = 1; k <= steps; k++) p.linearRampToValueAtTime(q.map(val(n + k/steps)), E.grid(n + k/steps));
      }
    } else { const v = val(n); if (q.last !== v) { q.last = v; q.set(v); } }
  }

  /* ---------- what plays ---------- */
  // the clip a track plays at sixteenth n, and the sixteenth its run began
  function clipAt(tr, n){
    const o = E.over[tr.t.id]; if (o && n >= o.at) return o.clip ? {id: o.clip, at: o.at} : null;
    if (E.mode === 'session') { const sc = scene(song, E.session.scene); const c = sc && (sc.clips || {})[tr.t.id]; return c ? {id: c, at: E.session.at} : null; }
    const bar = Math.floor(n/16), i = A.parts.findIndex(p => bar >= p.at && bar < p.at + p.bars); if (i < 0) return null;
    // (a run of parts playing the same clip carries on rather than starting it again)
    const c = ((scene(song, A.parts[i].scene) || {}).clips || {})[tr.t.id]; if (!c) return null;
    let j = i; while (j > 0 && (((scene(song, A.parts[j - 1].scene) || {}).clips || {})[tr.t.id]) === c) j--;
    return {id: c, at: A.parts[j].at*16};
  }
  // the clip a track plays at sixteenth n (for the page's grid)
  E.clipRun = (id, n) => { const tr = T(id); return (tr && clipAt(tr, n)) || null; };
  E.clipOf = (id, n) => { const c = E.clipRun(id, n); return c ? c.id : null; };
  E.sceneAt = n => E.mode === 'session' ? E.session.scene : ((A.parts.find(p => Math.floor(n/16) >= p.at && Math.floor(n/16) < p.at + p.bars) || {}).scene || null);
  // one sixteenth: launch what's queued on the bar, then every track's notes in it, then the automation
  E.window = n => {
    if (n % 16 === 0) {
      const s = E.session; if (s.next) { s.scene = s.next; s.at = n; s.next = null; E.over = {}; }
      for (const [id, o] of Object.entries(E.over)) if (o.next !== undefined) { o.clip = o.next; o.at = n; delete o.next; }
    }
    for (const tr of tracks) {
      const c = clipAt(tr, n); if (!c) continue;
      const clip = (tr.t.clips || {})[c.id], r = readClip(clip); if (!r) continue;
      const rel = n - c.at, pos = ((rel % r.len) + r.len) % r.len, loop = Math.floor(rel/r.len), sw = tr.t.swing != null ? tr.t.swing : song.swing || 0;
      r.ev.forEach((e, k) => {
        if (Math.floor(e.s) !== pos) return;
        if (e.p < 1 && hash(song.seed || 1, tr.t.id, c.id, loop, k) >= e.p) return;
        const t = E.time(n, e.s - pos, sw), len = e.l*S16, ev = {t, note: e.n, voice: typeof e.n === 'string' ? e.n : null, vel: e.v, len, track: tr.t.id};
        tr.inst.play(e.n, t, len, e.v);
        desk.note(tr.t.id, ev); if (onNote) onNote(ev);
      });
      // clip envelopes: '<path within the track>': [[step, value], …], going round with the clip
      for (const [k, pts] of Object.entries(r.auto)) {
        const key = tr.t.id + '.' + k, q = E.target(key); if (!q) continue;
        drive(q, key, n, x => laneAt(pts, ((((x - c.at) % r.len) + r.len) % r.len)));
      }
    }
    if (E.mode === 'arrange') for (const l of lanes) if (!mods.some(m => m.target === l.path)) drive(l.q, l.path, n, x => laneAt(l.pts, x));
    for (const m of mods) {
      const hz = typeof m.rate === 'number' ? m.rate : lfoHz(m.rate, 1, P), d = m.depth || 0;
      drive(m.q, m.target, n, x => { const b = m.center != null ? m.center : base(m.target, m.q, x); return b + d*wave(m.shape || 'Sine', hz*(E.grid(x) - E.t0)); });
    }
    desk.tick(E.grid(n));
  };
  // the song from sixteenth n at time t (the first window's time): the instruments' LFOs start on the song's bar 1
  E.startAt = (t, n = 0) => { E.t0 = t - n*S16; env.t0 = E.t0; started.clear(); for (const tr of tracks) if (tr.inst.start) tr.inst.start(Math.max(ctx.currentTime, E.t0)); E.n = n; };
  E.silence = (t = ctx.currentTime) => { for (const tr of tracks) if (tr.inst.allOff) tr.inst.allOff(t); for (const p of started) { p.cancelScheduledValues(t); } started.clear(); };
  E.dispose = () => { E.silence(); desk.dispose(); };
  return E;
}

/* ---------- offline: the song rendered to an AudioBuffer ---------- */
// opts: bars (default: the whole arrangement), solo (track ids: everything else muted, for stems), sr
export async function renderSong(song, {bars, from = 0, solo, sr = TUNE.studio.sr, tail = TUNE.studio.tail, onProgress, onNote, chunk = 4} = {}){
  song = structuredClone(song);
  if (solo) for (const t of song.tracks) { t.mix = t.mix || {}; t.mix.solo = [].concat(solo).includes(t.id); }
  const S16 = 60/song.bpm/4, n0 = from*16, N = (bars || arrangement(song).bars - from)*16, ctx = new OfflineAudioContext(2, Math.ceil((N*S16 + tail)*sr), sr);
  const E = buildSong(ctx, song, {onNote});
  // (the windows a beat at a time, a beat ahead: suspending every sixteenth cost more than the music)
  const C = chunk; E.startAt(0, n0); for (let n = 0; n < Math.min(N, 2*C); n++) E.window(n0 + n);
  for (let k = 1; k*C < N; k++) ctx.suspend(k*C*S16).then(() => { for (let n = (k + 1)*C; n < Math.min(N, (k + 2)*C); n++) E.window(n0 + n); if (onProgress) onProgress(k*C/N); ctx.resume(); });
  const buf = await ctx.startRendering();
  E.desk.dispose();
  return buf;
}

/* ---------- live: the song on the page's clock ---------- */
export function makePlayer(ctx, song, opts = {}){
  let E = buildSong(ctx, song, {meters: true, ...opts}), timer = 0;
  const pl = {get E(){ return E; }, playing: false,
    // play from a bar: the arrangement, or a scene looped (session)
    play({bar = 0, scene: sc = null} = {}){
      pl.stop(); E.mode = sc ? 'session' : 'arrange'; E.session = {scene: sc, at: bar*16, next: null}; E.over = {};
      E.startAt(ctx.currentTime + .08, bar*16); pl.playing = true;
      const tick = () => { while (E.grid(E.n) < ctx.currentTime + TUNE.studio.ahead) { if (E.mode === 'arrange' && E.n >= E.bars*16) { pl.end = true; break; } E.window(E.n); E.n++; } };
      tick(); timer = setInterval(tick, TUNE.studio.tickMs);
    },
    stop(){ clearInterval(timer); if (pl.playing) E.silence(); pl.playing = false; pl.end = false; },
    // a scene from the next bar (switching to session mode, carrying on from where it is)
    launch(sc){ if (!pl.playing) return pl.play({scene: sc}); if (E.mode !== 'session') { E.session = {scene: E.sceneAt(E.n), at: E.session.at, next: null}; E.mode = 'session'; } E.session.next = sc; },
    // one track's clip from the next bar (null stops it)
    launchClip(id, clip){ E.over[id] = {...(E.over[id] || {clip: null, at: Infinity}), next: clip}; if (E.over[id].at === Infinity) E.over[id].at = Math.ceil(E.n/16)*16; },
    // where it is: the sixteenth being heard
    pos(){ return Math.max(0, (ctx.currentTime - E.t0)/E.S16); },
    // the song changed in a way the graph can't follow (a new device, a new instrument): built again, playing on
    rebuild(){ const was = pl.playing, at = Math.ceil(pl.pos()/16), mode = E.mode, sess = E.session; pl.stop(); E.dispose(); E = buildSong(ctx, song, {meters: true, ...opts}); if (was) mode === 'session' ? pl.play({scene: sess.scene}) : pl.play({bar: at}); },
    dispose(){ pl.stop(); E.dispose(); }};
  return pl;
}
