// The arrangement's sound: the jam's channels (EQ, the tone filter and its motion, pan, the kick's duck, Claude's mix, the
// echo and reverb sends), its master, and its instruments (the poly synth, the drum kits, native notes computed by a
// worker and cached), playing the project's notes from a scheduler on the audio clock: a 16th at a time, a little ahead,
// round the loop when the cycle is on. Each clip, as it starts, sets its track's tone, space and motion as its section did.
import { nativeSet, cutOf, LEN, ECHO } from '../jam/model.js';
import { isDrum } from '../jam/part.js';
import { retChain, RET, glide, duckAt } from '../jam/mixeng.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { NATIVE } from '../lib/native/index.js';
import { kitHit } from '../lib/native/kit.js';
import { kitFallback, ANALOG_KITS } from '../lib/native/analogkit.js';
import { DEF as NPDEF } from '../lib/native/npoly.js';
import { makePoly, PRESETS } from '../../src/audio/engine/inst/poly.js';
import { makeDrums } from '../../src/audio/engine/inst/drums.js';
import { synthRender } from '../lib/native/asynth.js';
import { makeInstruments, liveEngine, keyOf, q, polyOf } from '../lib/play/inst.js';
import { makeMaster, setMaster, makeStrip, DUCKS as DUCKP } from '../lib/play/master.js';
import { deskOf, faderOf, gainOf, sectionStrip, padFader, rackChain } from './desk.js';
import { isRack, inputsOf, inputCount, padRole } from './rack.js';

export const DUCKS = DUCKP.map(d => d[1]);

export { liveEngine };

export function makeEngine({SND, workerSrc, workletSrc, onBusy = () => {}, onTick = () => {}}){
  const E = {ctx: null, P: null, playing: false, cycle: false, loop: [0, 4], eng: true, slot: 0, nextT: 0, timer: 0, when: [], ch: [], by: [], starts: [], at: []};
  let master, mstr, delay, verb, rets, B;
  const sd = () => 60/E.P.bpm/4;
  // the instruments (lib/play/inst.js, the jam's too): a track's channel is c, its input c.x.in, its settings c.s; on the
  // desk a drum rack's pads each into their own strip
  const I = makeInstruments({SND, sd, ctx: () => E.ctx, ok: () => E.liveOK, inOf: c => c.x.in, setOf: c => c.s || {}, padsOf: c => c.io?.pads,
    padOut: (n, j, c) => n.connect(E.deskNode || c.x.in, j, E.deskNode ? c.io.base + j : 0), t0: () => E.t0, pitches: c => c.T.clips.flatMap(cl => cl.notes.map(n => n.p)), onBusy});
  const {cache, pending, build, need, want, drop, clock, warm, liveParams, liveSet} = I;
  E.busy = () => pending.size;
  E.init = () => { if (E.ctx) return E.ctx; const ctx = E.ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'});
    ({master, mstr, delay, verb, rets} = B = makeMaster(ctx)); E.out = B.out;
    // the live voices: once the audio engine has them, the tracks on those instruments play live (until then, and where a
    // browser can't, their notes are computed ahead as before)
    if (workletSrc && ctx.audioWorklet) ctx.audioWorklet.addModule(E.wurl = URL.createObjectURL(new Blob([workletSrc], {type: 'text/javascript'})))
      .then(() => { E.liveOK = true; if (E.P) { E.load(E.P); E.kb = null; if (E.playing) E.from = E.slot; } onBusy(pending.size); E.onLive?.(); }).catch(e => { E.liveErr = String(e?.message || e); });
    I.attach(workerSrc);
    if (E.P) E.load(E.P); return ctx; };

  /* ---------- a channel per track, its instrument, its settings ---------- */
  function chan(T, i){ const ctx = E.ctx, lane = E.P.tracks.slice(0, i).filter(x => x.role === T.role).length;
    // on the native desk a track's instrument goes into its strip's input (studio/arrange/desk.js), and the desk does the
    // rest (a drum rack's pads each into their own: io)
    if (E.deskNode) { const io = E.IO[i] || {base: i}, x = {in: ctx.createGain(), desk: true}; if (!io.pads) x.in.connect(E.deskNode, 0, io.base); return {T, i, io, x, s: {...T.set}, sound: null, inst: null, open: null, rampAt: null, ramp: null, clip: null}; }
    const x = makeStrip(ctx, B, T.role, lane, E.eng, {clip: true});
    return {T, x, s: {...T.set}, sound: null, inst: null, open: null, rampAt: null, ramp: null, clip: null}; }
  // a clip's settings onto its track's channel (the section's tone, space, motion, ramp; its level and duck)
  function settle(c, clip, t = E.ctx.currentTime){ const s = c.s = {...c.T.set, ...(clip?.set || {})}, snd = s.sound || c.T.sound;
    if (snd !== c.sound) { build(c, snd);
      // (on the desk a new sound brings its own input gain and fader, so the balance holds)
      if (c.x.desk && E.ch.includes(c)) for (const st of E.D?.strips.filter(x => x.id === c.T.id || x.rack === c.T.id) || []) { const tr = st.chain.find(p => p.key === 'trim'); if (!tr) continue;
        if (st.pad) { if (!c.T.desk?.pads?.[st.pad]?.gainSet) { const m = SND[snd]?.voices?.[st.pad]; dk({type: 'proc', id: st.id, pid: tr.id, params: {gain: gainOf(m?.from || snd, padRole(st.pad, m, SND), SND)}}, t); } }
        else if (!c.T.desk?.gainSet) dk({type: 'proc', id: st.id, pid: tr.id, params: {gain: gainOf(snd, c.T.role, SND)}}, t); }
      // (a drum rack's own strip: the new kit's bus, unless you've set its effects yourself)
      if (c.x.desk && E.ch.includes(c) && isRack(c.T) && !c.T.desk?.chain) { const st = E.D?.strips.find(x => x.id === c.T.id); if (st) { st.chain = rackChain(c.T.id, SND[snd]); dk({type: 'chain', id: st.id, chain: st.chain}, t); } } }
    if (c.x.desk) { c.ramp = s.ramp || null; c.rampAt = null; c.clip = clip; if (E.ch.includes(c)) { dk({type: 'strip', id: c.T.id, set: sectionStrip(c.T, s)}, t); macros(c, t); } liveSet(c, t); return; }
    c.ramp = s.ramp || null; c.rampAt = null; c.clip = clip; I.lengthTo(c, LEN[s.length ?? 1]);
    glide(c.x.clip.gain, Math.pow(10, (s.vol || 0)/20), t, .02); macros(c, t); liveSet(c, t); }
  function macros(c, t = E.ctx.currentTime){ const x = c.x, s = c.s, M = c.T.mix, solo = E.P.tracks.some(y => y.mix.solo);
    // (on the desk: the track's fader, pan, mute and solo on its strip; a channel for trying a sound has none of its own)
    if (x.desk) { if (!E.ch.includes(c)) return;
      // (a drum rack: its own strip's fader, pan and mute; each pad's, its solo the rack's too)
      if (isRack(c.T)) { dk({type: 'strip', id: c.T.id, set: {level: M.vol || 0, pan: M.pan || 0, mute: !!c.T.mute}});
        for (const p of c.io?.pads || []) { const d = c.T.pads?.[p] || {}; dk({type: 'strip', id: c.T.id + '/' + p, set: {level: padFader(c.T, p, SND, s?.sound || c.T.sound), pan: d.pan || 0, mute: !!d.mute, solo: !!(d.solo || M.solo)}}); }
        return; }
      dk({type: 'strip', id: c.T.id, set: {level: faderOf(c.T, SND, s?.sound || c.T.sound), pan: M.pan || 0, mute: !!c.T.mute, solo: !!M.solo}}); return; }
    glide(x.f.frequency, cutOf(s.x ?? .62), t, c.ramp ? 15*sd()/3 : .05); glide(x.echo.gain, s.echo ? (s.y ?? .3)*.5 : 0, t, .05); glide(x.verb.gain, s.verb ? (s.y ?? .3)*.75 : 0, t, .05);
    glide(x.out.gain, c.T.mute || solo && !M.solo ? 0 : .85*Math.pow(10, (M.vol || 0)/20), t, .02); glide(x.pan.pan, M.pan || 0, t, .02);
    glide(x.lo.gain, M.lo || 0, t, .02); glide(x.mid.gain, M.mid || 0, t, .02); glide(x.hi.gain, M.hi || 0, t, .02); }
  E.mix = () => { if (!E.ctx) return; for (const c of E.ch) macros(c); };
  E.setEng = v => { E.eng = v; if (!E.ctx) return; if (E.deskNode) return straight(); for (const c of E.ch) c.x.eng.on(v); for (const r of Object.values(rets)) r.on(v); };
  function masterMix(){ setMaster(B, {glue: 2, width: 3, lo: 0, hi: 0, vol: 0, ...E.P.mx}, E.ctx); glide(delay.d.delayTime, ECHO[E.P.echoDiv || 0][1]*4*sd(), E.ctx.currentTime, .05); }

  /* ---------- the notes: each track's by 16th (where they fall between 16ths kept), each clip's start ---------- */
  E.compile = () => { const P = E.P; E.by = P.tracks.map(() => new Map()); E.starts = P.tracks.map(() => new Map()); E.at = P.tracks.map(() => []);
    P.tracks.forEach((T, i) => { for (const cl of T.clips) { const a = Math.round(cl.start*16); E.starts[i].set(a, cl); E.at[i].push([a, a + cl.len, cl]);
      for (const n of cl.notes) { if (n.s < 0 || n.s >= cl.len) continue; const abs = a + n.s, k = Math.floor(abs + 1e-6); if (!E.by[i].has(k)) E.by[i].set(k, []); E.by[i].get(k).push({off: abs - k, n}); } } });
    E.end = P.bars*16; };
  // the clip a track is in at a 16th (the later one where two overlap)
  const clipAt = (i, k) => { let c = null; for (const [a, b, cl] of E.at[i]) if (k >= a && k < b && (!c || a >= c[0])) c = [a, b, cl]; return c; };
  E.load = P => { E.P = P; E.IO = inputsOf(P, SND); E.compile(); if (!E.ctx) return; for (const c of E.ch) { unplug(c); drop(c.inst); } E.kb = null;
    if (E.liveOK) deskBuild(); E.ch = P.tracks.map((T, i) => { const c = chan(T, i); build(c, T.sound); return c; }); masterMix(); for (const c of E.ch) settle(c, null); E.prewarm(); };
  const unplug = c => { try { (c.x.out || c.x.in).disconnect(); } catch {} };

  /* ---------- the native desk (the parts host: a strip per track, the buses, the returns, the master bus) ---------- */
  // built afresh with the tracks (one input per track); the one before told to stop for good
  function deskBuild(){ const ctx = E.ctx, old = E.deskNode;
    if (old) { old.port.postMessage({type: 'close'}); setTimeout(() => { try { old.disconnect(); } catch {} }, 60); }
    const node = E.deskNode = new AudioWorkletNode(ctx, 'parts-host', {numberOfInputs: Math.max(1, inputCount(E.IO)), outputChannelCount: [2]});
    node.connect(E.out); node.port.onmessage = e => { if (e.data.type === 'meters') E.meters = e.data.m; };
    E.D = deskOf(E.P, SND); dk({type: 'build', ...E.D}); straight(); }
  // a message to the desk (now, or at an audio-clock time t: dropped if playback stops before it)
  const dk = (m, t) => E.deskNode?.port.postMessage({...m, period: 60/E.P.bpm, ...(t != null ? {t, seq: 1} : {})});
  E.desk = dk;
  // Straight: every channel's and bus's processors out, each heard at the loudness they gave it; the returns' sidechain off
  function straight(){ if (!E.D) return; const v = !E.eng;
    for (const s of E.D.strips) { if (s.id === 'master') continue;
      if (s.ret) { for (const c of s.chain) if (c.key === 'sidechain') dk({type: 'proc', id: s.id, pid: c.id, on: !v && c.on !== false}); }
      else dk({type: 'strip', id: s.id, set: {bypass: v, match: true}}); } }
  // the desk's description again from the project (a processor chain changed, a bus edited): rebuilt, its state kept
  // a track's section settings sent again (its sends moved by hand: heard at once)
  E.resection = i => { const c = E.ch[i]; if (c?.x.desk) dk({type: 'strip', id: c.T.id, set: sectionStrip(c.T, c.s)}); };
  E.deskRefresh = () => { if (!E.deskNode) return; E.D = deskOf(E.P, SND); dk({type: 'build', ...E.D}); straight(); E.mix(); };
  // every native note the song needs, computed ahead (each note at its clip's tone and length, a ramp's at each bar's)
  E.prewarm = () => { if (!E.ctx) return; E.P.tracks.forEach((T, i) => { const c = E.ch[i];
    for (const cl of T.clips) { const s = {...T.set, ...cl.set}, sound = SND[s.sound || T.sound]; if (!sound) continue;
      for (const n of cl.notes) { if (n.s < 0 || n.s >= cl.len) continue; const bar = Math.floor(n.s/16), r = s.ramp, xx = r?.x ? r.x[0] + (r.x[1] - r.x[0])*Math.min(1, bar/Math.max(1, (r.bars || 8) - 1)) : s.x, st = {...s, x: xx};
        if (sound.voices) { const v = sound.voices[n.p]; if (v?.native && !E.liveOK) { const o = {...nativeSet(st, v.native, v.set || {}), ...v.knobs}; want(keyOf(v.native, v.n, n.v, o), v.native, v.n, n.v, o); } }
        else { const name = sound.src.native || NATIVE_OF[sound.src.palette]; if (!name || E.liveOK && liveEngine(name)) continue; const shift = (sound.src.shift || 0) + (sound.src.palette ? 12*(PAL[sound.src.palette][1].oct || 0) : 0);
          const o = {...nativeSet(st, name, sound.src.set || {}), ...sound.src.knobs}, set = NATIVE[name].held ? {...o, len: Math.round(n.l*sd()*20)/20} : o; want(keyOf(name, n.p + shift, n.v, set), name, n.p + shift, n.v, set); } } } }); onBusy(pending.size); };
  // one note on a track's instrument at time t (on the browser's mix, a kick ducks the other channels and the returns)
  function play(c, p, l, v, t){ if (I.play(c, p, l, v, t) !== 'drums' || c.T.role !== 'kick' || c.x.desk) return;
    for (const o of E.ch) { if (o === c) continue; const d = DUCKS[o.s.duck ?? o.T.mix.duck ?? 0]; if (d) duckAt(o.x.duck.gain, d, t); }
    if (E.eng) for (const [k, r] of Object.entries(rets)) duckAt(r.duck.gain, RET[k].duck, t); }
  // a sound tried on a track before it's chosen (or after it's changed): its own channel with the track's settings, the
  // phrase's native notes computed first (a second or two at most), then played. notes: [{s (16ths), p, l, v}]
  E.preview = async (i, id, notes) => { const ctx = E.init(); ctx.resume(); const T = E.P.tracks[i]; if (!T) return;
    if (E.pv) { unplug(E.pv); drop(E.pv.inst); }
    const c = E.pv = chan(T, i); c.s = {...T.set}; build(c, id); macros(c); if (c.x.out) glide(c.x.out.gain, .85*Math.pow(10, (T.mix.vol || 0)/20), ctx.currentTime, .01);
    const keys = notes.flatMap(n => need(c, n.p, n.l, n.v)); onBusy(pending.size);
    for (let w = 0; w < 80 && keys.some(k => !cache.has(k)); w++) await new Promise(r => setTimeout(r, 50));
    if (E.pv !== c) return; const t0 = ctx.currentTime + .05; for (const n of notes) play(c, n.p, n.l, n.v, t0 + n.s*sd());
    const end = Math.max(0, ...notes.map(n => n.s + n.l))*sd() + 2.5; setTimeout(() => { if (E.pv === c) { unplug(c); drop(c.inst); E.pv = null; } }, end*1000); };
  // a setting heard at once while it's turned (the poly synth's own, a drum machine voice's), on the track and the keys
  E.live = (i, w, v) => { for (const c of [E.ch[i], E.kb?.i === i ? E.kb.c : null, E.pv]) { const inst = c?.inst; if (!inst || c.T !== E.P.tracks[i]) continue;
      if (w.native && inst.live) inst.live.port.postMessage({type: 'set', slot: w.slot ?? '', params: {[w.native]: v}});
      if (w.kit && inst.live) inst.live.port.postMessage({type: 'set', kit: true, slot: w.kit, key: w.key, v});
      if (w.asynth && inst.live && inst.engine === 'asynth') { inst.full[w.asynth] = v; inst.live.port.postMessage({type: 'set', params: {[w.asynth]: v}}); }
      if (w.poly && inst.poly) inst.poly.set(w.poly, v); if (w.poly && inst.live && inst.engine === 'poly') { inst.full[w.poly] = v; inst.live.port.postMessage({type: 'set', params: {[w.poly]: v}}); } if (w.kit && inst.voices?.[w.kit]?.kit) inst.voices[w.kit].kit.set(w.kit, w.key, v); } };
  // the keyboard: a channel of its own with the track's settings and the sound being shaped, notes held as long as the key
  function kbChan(i, id){ if (E.kb && E.kb.i === i && E.kb.id === id && E.kb.gen === E.gen) return E.kb.c;
    if (E.kb && E.kb.i === i && E.kb.c.inst?.live) { const c = E.kb.c; c.s = {...E.P.tracks[i].set}; build(c, id); Object.assign(E.kb, {id, gen: E.gen}); if (c.inst.live) return c; }
    if (E.kb) { const o = E.kb.c; setTimeout(() => { unplug(o); drop(o.inst); }, 3000); }
    const T = E.P.tracks[i], c = chan(T, i); c.s = {...T.set}; build(c, id); macros(c); if (c.x.out) glide(c.x.out.gain, .85*Math.pow(10, (T.mix.vol || 0)/20), E.ctx.currentTime, .01); E.kb = {i, id, c, gen: E.gen, held: new Map()}; return c; }
  E.kbOn = (i, id, p, v = .8) => { const ctx = E.init(); ctx.resume(); const c = kbChan(i, id), t = ctx.currentTime + .005, inst = c.inst;
    // (a kit first: a drum rack is live too, but its pads are voices, not pitches)
    if (inst.kind === 'drums') { play(c, p, 1, v, t); return; }
    if (inst.poly) { inst.poly.noteOn(p, v, t); E.kb.held.set(p, t); return; }
    if (inst.live) { inst.live.port.postMessage({type: 'on', id: 'k' + p, n: p + inst.shift, vel: q(v, .1), gv: v, t}); return; }
    // a native note is computed (held sounds at a beat's length): heard at once when it's ready, else as soon as it is
    const keys = need(c, p, 4, v); if (keys.every(k => cache.has(k))) { play(c, p, 4, v, t); return; }
    const t0 = performance.now(), wait = () => { if (keys.every(k => cache.has(k))) { if (performance.now() - t0 < 1500) play(c, p, 4, v, E.ctx.currentTime + .005); } else if (performance.now() - t0 < 4000) setTimeout(wait, 30); }; wait(); };
  E.kbOff = (i, p) => { const c = E.kb?.c; if (!c || c.inst?.kind === 'drums') return; if (c.inst?.poly) { c.inst.poly.noteOff(p, E.ctx.currentTime + .005); E.kb.held.delete(p); } if (c.inst?.live) c.inst.live.port.postMessage({type: 'off', id: 'k' + p, t: E.ctx.currentTime + .005}); };
  // every note on the keys silenced at once (a panic: Stop, the window left, Esc)
  E.kbAllOff = () => { const c = E.kb?.c; if (!c || !E.ctx) return; if (c.inst?.poly) for (const p of E.kb.held.keys()) c.inst.poly.noteOff(p, E.ctx.currentTime); c.inst?.live?.port.postMessage({type: 'stop'}); E.kb.held?.clear(); };
  // the keys' notes computed ahead, so the first press is heard at once
  E.kbWarm = (i, id, ps, v = .8) => { const ctx = E.init(); const c = kbChan(i, id); if (c.inst.native) for (const p of ps) need(c, p, 4, v); onBusy(pending.size); };
  // one note as the sound makes it, for drawing: a native note from the worker (as played), the poly synth or a drum
  // machine rendered offline. Resolves an AudioBuffer (or null)
  E.render = async (i, id, p, v = .85, l = 4) => { E.init(); const T = E.P.tracks[i], snd = SND[id]; if (!snd) return null; const secs = l*sd(); let inst = null;
    if (snd.src?.asynth) { const h = synthRender(E.ctx.sampleRate, {...snd.src.asynth, ...snd.src.knobs}, [{t: .02, n: p + (snd.src.shift || 0), len: secs, vel: v}], secs + 2.5), b = E.ctx.createBuffer(2, h.L.length, E.ctx.sampleRate);
      b.copyToChannel(h.L, 0); b.copyToChannel(h.R, 1); return b; }
    if (snd.voices) { const m = snd.voices[p]; if (!m) return null; if (m.native) inst = {kind: 'drums', voices: {[p]: {native: m.native, n: m.n, set: m.set || {}, knobs: m.knobs || {}}}}; }
    else { const name = snd.src.native || NATIVE_OF[snd.src.palette]; if (name) inst = {native: name, shift: (snd.src.shift || 0) + (snd.src.palette ? 12*(PAL[snd.src.palette][1].oct || 0) : 0), set: snd.src.set || {}, knobs: snd.src.knobs || {}}; }
    if (inst) { const keys = need({T, s: {...T.set}, inst}, p, l, v); onBusy(pending.size);
      for (let w = 0; w < 160 && keys.some(k => !cache.has(k)); w++) await new Promise(r => setTimeout(r, 50)); return keys.length ? cache.get(keys[0]) || null : null; }
    const sr = 22050, off = new OfflineAudioContext(2, Math.ceil(sr*(secs + 2.5)), sr), g = off.createGain(); g.connect(off.destination);
    if (snd.voices) { const m = snd.voices[p]; if (!m?.kit) return null;
      if (E.liveOK) { const h = kitHit(E.ctx.sampleRate, m.kit, m.voice || p, v, m.over || {}, 2.5), b = E.ctx.createBuffer(2, h.L.length, E.ctx.sampleRate); b.copyToChannel(h.L, 0); b.copyToChannel(h.R, 1); return b; }
      const kit = makeDrums(off, g); kit.load(kitFallback(m.kit), m.over || {}); kit.play(m.voice || p, .02, v, null); }
    else if (E.liveOK && E.wurl) { await off.audioWorklet.addModule(E.wurl);
      const n = new AudioWorkletNode(off, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init: [{type: 'load', engine: 'poly', params: {...polyOf(snd.src).full, period: 4*sd()}}, {type: 'on', id: 1, n: p, vel: v, gv: v, t: .02}, {type: 'off', id: 1, t: .02 + secs}]}}); n.connect(g); }
    else { const {preset, base} = polyOf(snd.src), syn = makePoly(off, g, {period: () => 4*sd()}); syn.load({...PRESETS[preset], chord: 0, ...base}); syn.play(p, .02, secs, v); }
    return off.startRendering(); };
  E.gen = 0;
  // whether a track's instrument plays live now
  E.isLive = i => !!E.ch[i]?.inst?.live;
  // a sound's definition changed (the designer): every channel builds its instrument again, and its notes are computed
  E.refresh = () => { E.gen++; if (!E.ctx) return;
    // (a drum rack whose pads changed with its kit: the desk and the tracks built again)
    if (E.IO && JSON.stringify(inputsOf(E.P, SND)) !== JSON.stringify(E.IO)) { E.load(E.P); return; }
    for (const c of E.ch) { c.sound = null; settle(c, c.clip || null); } E.prewarm(); };
  // a note heard now (clicking in the piano roll)
  E.audition = (i, p, v = .8, l = 2) => { if (!E.ctx) E.init(); E.ctx.resume(); const c = E.ch[i]; if (c) play(c, p, l, v, E.ctx.currentTime + .02); };

  /* ---------- the transport ---------- */
  function slotAt(k, t){ const P = E.P;
    // a bar line: each track's clip there sets its channel; a ramp steps on
    // (the Session: its clips, from E.session, on the tracks it owns (all of them while it plays alone; those a clip was
    // launched on while the Arrangement plays); the timeline's clips on the rest)
    const SE = E.session, own = i => !!SE && SE.owns(i);
    if (SE && k % 16 === 0) SE.bar(k, t);   // (bar lines only: a restart mid-bar, the live voices arriving, keeps what the Session has)
    if (k % 16 === 0 || k === E.from) E.ch.forEach((c, i) => { const hit = own(i) ? null : clipAt(i, k), cl = hit?.[2] || null;
      if (cl !== c.clip || k === E.from) { settle(c, cl, t); if (cl && c.ramp) c.rampAt = Math.floor((k - hit[0])/16) - 1; }
      if (c.ramp?.x && k % 16 === 0) { c.rampAt = (c.rampAt ?? -1) + 1; const [a, b] = c.ramp.x, n = Math.max(1, (c.ramp.bars || 8) - 1); c.s.x = a + (b - a)*Math.min(1, c.rampAt/n);
        if (c.x.desk) dk({type: 'strip', id: c.T.id, set: {lp: cutOf(c.s.x), lpGlide: 5*sd()}}, t); else macros(c, t); liveSet(c, t); } });
    // the pulse: a part's filter opening on every beat
    if (k % 4 === 0) for (const c of E.ch) if (c.s.motion === 3 && c.x.desk) { const lo = cutOf(c.s.x), b = 4*sd(), go = (lp, g, at) => dk({type: 'strip', id: c.T.id, set: {lp, lpGlide: g}}, at);
      go(Math.min(18000, lo*3.2), .006, t); go(Math.min(18000, lo*1.6), .12*b, t + .05*b); go(lo, .2*b, t + .4*b); }
    else if (c.s.motion === 3) { const f = c.x.f.frequency, lo = cutOf(c.s.x), b = 4*sd(); glide(f, Math.min(18000, lo*3.2), t, .006); f.linearRampToValueAtTime(Math.min(18000, lo*1.6), t + .35*b); f.linearRampToValueAtTime(lo, t + .9*b); }
    if (SE) for (const [i, list] of SE.at(k)) { const c = E.ch[i]; if (c && own(i)) for (const n of list) play(c, n.p, n.l, n.v, Math.max(E.ctx.currentTime, t + n.off*sd())); }
    E.by.forEach((m, i) => { const list = m.get(k), c = E.ch[i]; if (!list || !c || own(i)) return; for (const {off, n} of list) play(c, n.p, n.l, n.v, Math.max(E.ctx.currentTime, t + off*sd())); });
    E.when.push([t, k]); if (E.when.length > 64) E.when.splice(0, 32); }
  function tick(){ const ctx = E.ctx; while (E.nextT < ctx.currentTime + .15) { slotAt(E.slot, E.nextT); E.slot++; E.nextT += sd();
      if (E.session?.endless()) continue;   // (the Session alone plays on until it's stopped)
      if (E.cycle && E.slot >= E.loop[1]*16) { E.slot = Math.round(E.loop[0]*16); E.from = E.slot; }
      else if (E.slot >= E.end) { if (E.cycle) { E.slot = Math.round(E.loop[0]*16); E.from = E.slot; } else { E.stopAt = E.nextT + 2; break; } } }
    if (E.stopAt && ctx.currentTime > E.stopAt) E.stop(); onTick(); }
  E.play = fromBar => { const ctx = E.init(); ctx.resume(); if (E.playing) E.stop(); E.playing = true; E.stopAt = 0;
    E.slot = E.from = Math.max(0, Math.round(fromBar*16)); E.nextT = ctx.currentTime + .1; E.when = []; for (const c of E.ch) { c.clip = undefined; c.open = null; }
    E.t0 = E.nextT - (E.from % 4)*sd(); for (const c of [...E.ch, E.kb?.c]) clock(c);   // (where the beats fall: an LFO in time follows them)
    tick(); E.timer = setInterval(tick, 25); };
  E.stop = () => { E.playing = false; clearInterval(E.timer); E.stopAt = 0; dk({type: 'stop'}); E.kbAllOff();
    for (const c of E.ch) { c.inst?.live?.port.postMessage({type: 'stop'}); if (c.x.out) { glide(c.x.out.gain, 0, E.ctx.currentTime, .03); setTimeout(() => macros(c), 200); } } onTick(); };
  // where the song is as heard: the 16th scheduled for now and how far through it
  E.pos = () => { if (!E.playing || !E.when.length) return null; const now = E.ctx.currentTime; let best = null; for (const w of E.when) if (w[0] <= now) best = w;
    return best ? best[1] + Math.min(1, (now - best[0])/sd()) : E.when[0][1]; };
  return E; }
export { isDrum };
