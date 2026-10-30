// The arrangement's sound: the jam's channels (EQ, the tone filter and its motion, pan, the kick's duck, Claude's mix, the
// echo and reverb sends), its master, and its instruments (the poly synth, the drum kits, native notes computed by a
// worker and cached), playing the project's notes from a scheduler on the audio clock: a 16th at a time, a little ahead,
// round the loop when the cycle is on. Each clip, as it starts, sets its track's tone, space and motion as its section did.
import { nativeSet, cutOf, LEN, ECHO } from '../jam/model.js';
import { isDrum } from '../jam/part.js';
import { engOf, engChain, retChain, RET, glide, duckAt } from '../jam/mixeng.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { NATIVE } from '../lib/native/index.js';
import { kitHit } from '../lib/native/kit.js';
import { kitFallback, ANALOG_KITS } from '../lib/native/analogkit.js';
import { DEF as NPDEF } from '../lib/native/npoly.js';
import { makePoly, PRESETS } from '../../src/audio/engine/inst/poly.js';
import { makeDrums } from '../../src/audio/engine/inst/drums.js';
import widthFx from '../../src/audio/engine/fx/width.js';
import { synthRender } from '../lib/native/asynth.js';
import { deskOf, faderOf, gainOf, sectionStrip, padFader, rackChain } from './desk.js';
import { isRack, inputsOf, inputCount, padRole } from './rack.js';

export const DUCKS = [0, .25, .4, .65];
const GLUE = [null, {thr: -14, ratio: 1.8, att: .03, rel: .25}, {thr: -20, ratio: 3, att: .01, rel: .2}, {thr: -24, ratio: 4, att: .03, rel: .12}], WIDTHS = [0, .6, 1, 1.35, 1.7];
const q = (v, s) => Math.round(v/s)*s;
const keyOf = (name, n, vel, o) => `${name}|${n}|${q(vel, .1).toFixed(1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;

// the instruments played live, sample by sample as they sound (voices.worklet.js): every native instrument, the native
// poly synth (npoly.js) in place of the browser-built one, and the native drum machine (kit.js) in place of the browser's
export const liveEngine = name => NATIVE[name] ? 'nat' : null;
// a drum track's pads as the live engine's slots: a native instrument each (a hat choking the open one), or a voice of a
// drum machine (each kit and its changes one machine, kits; a pad may play another of its voices, `voice`; in a drum
// rack each pad its own machine, so each has its own output)
const drumSlots = (s, c, rack) => { const slots = {}, kits = {};
  for (const [v, m] of Object.entries(s.voices)) { if (m.native) { slots[v] = {name: m.native, gain: NATIVE[m.native]?.gain ?? .5, params: {...nativeSet(c.s || {}, m.native, m.set || {}), ...m.knobs}, choke: v === 'ohh' ? 'hat' : null, chokes: v === 'chh' || v === 'ohh' ? 'hat' : null}; continue; }
    const g = rack ? v : m.kit + JSON.stringify(m.over || {}); kits[g] = {kit: m.kit, over: m.over || {}, dry: rack && !!ANALOG_KITS[m.kit]}; slots[v] = {kit: g, voice: m.voice || v}; }
  return {slots, kits}; };

export function makeEngine({SND, workerSrc, workletSrc, onBusy = () => {}, onTick = () => {}}){
  const E = {ctx: null, P: null, playing: false, cycle: false, loop: [0, 4], eng: true, slot: 0, nextT: 0, timer: 0, when: [], ch: [], by: [], starts: [], at: []};
  const cache = new Map(), pending = new Set(); let master, mstr, delay, verb, rets, worker;
  const sd = () => 60/E.P.bpm/4;
  E.busy = () => pending.size;
  E.init = () => { if (E.ctx) return E.ctx; const ctx = E.ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'});
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .12;
    master = ctx.createGain(); master.gain.value = .85;
    mstr = {lo: ctx.createBiquadFilter(), hi: ctx.createBiquadFilter(), width: widthFx.make(ctx), glue: ctx.createDynamicsCompressor(), vol: ctx.createGain(), lim};
    mstr.lo.type = 'lowshelf'; mstr.lo.frequency.value = 110; mstr.hi.type = 'highshelf'; mstr.hi.frequency.value = 7000; mstr.width.set('mono', 150);
    master.connect(mstr.lo); mstr.lo.connect(mstr.hi); mstr.hi.connect(mstr.width.input); mstr.width.output.connect(mstr.glue); mstr.glue.connect(lim); lim.connect(mstr.vol); E.out = ctx.createGain(); mstr.vol.connect(E.out); E.out.connect(ctx.destination);
    delay = {in: ctx.createGain(), d: ctx.createDelay(2), fb: ctx.createGain(), lp: ctx.createBiquadFilter()};
    delay.lp.frequency.value = 2400; delay.fb.gain.value = .45; delay.in.connect(delay.d); delay.d.connect(delay.lp); delay.lp.connect(delay.fb); delay.fb.connect(delay.d);
    verb = ctx.createConvolver(); const L = 2.8*ctx.sampleRate, ir = ctx.createBuffer(2, L, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); let lp = 0; for (let i = 0; i < L; i++) { lp += (.3 - .25*i/L)*((Math.random()*2 - 1) - lp); x[i] = lp*Math.pow(1 - i/L, 2.2); } }
    verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .8; verb.connect(vg);
    rets = Object.fromEntries([['echo', delay.lp], ['verb', vg]].map(([k, from]) => { const r = retChain(ctx, RET[k]), d = ctx.createGain(); from.connect(r.input); r.output.connect(d); d.connect(master); return [k, {...r, duck: d}]; }));
    // the live voices: once the audio engine has them, the tracks on those instruments play live (until then, and where a
    // browser can't, their notes are computed ahead as before)
    if (workletSrc && ctx.audioWorklet) ctx.audioWorklet.addModule(E.wurl = URL.createObjectURL(new Blob([workletSrc], {type: 'text/javascript'})))
      .then(() => { E.liveOK = true; if (E.P) { E.load(E.P); E.kb = null; if (E.playing) E.from = E.slot; } onBusy(pending.size); E.onLive?.(); }).catch(e => { E.liveErr = String(e?.message || e); });
    worker = new Worker(URL.createObjectURL(new Blob([workerSrc], {type: 'text/javascript'})));
    worker.onmessage = e => { const {key, L, R, error} = e.data; pending.delete(key); if (!error) { const b = ctx.createBuffer(2, L.length, ctx.sampleRate); b.copyToChannel(L, 0); b.copyToChannel(R, 1); cache.set(key, b); } onBusy(pending.size); };
    if (E.P) E.load(E.P); return ctx; };

  /* ---------- a channel per track, its instrument, its settings ---------- */
  function chan(T, i){ const ctx = E.ctx, lane = E.P.tracks.slice(0, i).filter(x => x.role === T.role).length;
    // on the native desk a track's instrument goes into its strip's input (studio/arrange/desk.js), and the desk does the
    // rest (a drum rack's pads each into their own: io)
    if (E.deskNode) { const io = E.IO[i] || {base: i}, x = {in: ctx.createGain(), desk: true}; if (!io.pads) x.in.connect(E.deskNode, 0, io.base); return {T, i, io, x, s: {...T.set}, sound: null, inst: null, open: null, rampAt: null, ramp: null, clip: null}; }
    const x = {in: ctx.createGain(), lo: ctx.createBiquadFilter(), mid: ctx.createBiquadFilter(), hi: ctx.createBiquadFilter(), f: ctx.createBiquadFilter(), pan: ctx.createStereoPanner(), duck: ctx.createGain(), clip: ctx.createGain(), out: ctx.createGain(), echo: ctx.createGain(), verb: ctx.createGain()};
    x.lo.type = 'lowshelf'; x.lo.frequency.value = 120; x.mid.type = 'peaking'; x.mid.frequency.value = 1000; x.mid.Q.value = .8; x.hi.type = 'highshelf'; x.hi.frequency.value = 6000; x.f.Q.value = 1.2;
    x.eng = engChain(ctx, engOf(T.role, lane)); x.in.connect(x.eng.input); x.eng.output.connect(x.lo); x.lo.connect(x.mid); x.mid.connect(x.hi); x.hi.connect(x.f); x.f.connect(x.pan); x.pan.connect(x.duck); x.duck.connect(x.clip); x.clip.connect(x.out);
    x.out.connect(master); x.out.connect(x.echo); x.out.connect(x.verb); x.echo.connect(delay.in); x.verb.connect(verb); x.eng.on(E.eng);
    return {T, x, s: {...T.set}, sound: null, inst: null, open: null, rampAt: null, ramp: null, clip: null}; }
  function build(c, id){ const ctx = E.ctx, s = SND[id], prev = c.inst; c.sound = id; c.inst = {kind: 'pitched'}; if (!s) { drop(prev); return; }
    if (s.voices && E.liveOK) { const pads = c.io?.pads, {slots, kits} = drumSlots(s, c, !!pads); c.inst = {kind: 'drums', voices: {}, engine: 'drums', sound: s, rack: !!pads};
      for (const [v, m] of Object.entries(s.voices)) c.inst.voices[v] = m.native ? {native: m.native, n: m.n, set: m.set || {}, knobs: m.knobs || {}} : {kit: true};
      // a drum rack: an output a pad, each into its pad's strip on the desk
      if (pads) { if (prev?.live && prev.rack && prev.pads === pads) c.inst.live = prev.live;
        else { drop(prev); const n = c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, numberOfOutputs: pads.length, outputChannelCount: pads.map(() => 2)});
          pads.forEach((p, j) => n.connect(E.deskNode || c.x.in, j, E.deskNode ? c.io.base + j : 0)); }
        c.inst.pads = pads; c.inst.live.port.postMessage({type: 'load', slots, kits, outs: pads}); return; }
      // (a drum track again: the same node, its pads and machines set anew, what's ringing rings on)
      if (prev?.live && prev.engine === 'drums') c.inst.live = prev.live;
      else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(c.x.in); }
      c.inst.live.port.postMessage({type: 'load', slots, kits}); return; }
    if (s.voices) { drop(prev); const kits = {}; c.inst = {kind: 'drums', voices: {}};
      for (const [v, m] of Object.entries(s.voices)) { if (m.native) { c.inst.voices[v] = {native: m.native, n: m.n, set: m.set || {}, knobs: m.knobs || {}}; continue; }
        const key = m.kit + JSON.stringify(m.over || {}); if (!kits[key]) { kits[key] = makeDrums(ctx, c.x.in); kits[key].load(kitFallback(m.kit), m.over || {}); } c.inst.voices[v] = {kit: kits[key], voice: m.voice}; } return; }
    const src = s.src;
    // the analog synth (asynth.js): one instrument a track, its patch and your knobs over it (where no worklet runs,
    // its stand-in from the palette plays below)
    if (src.asynth && E.liveOK) { Object.assign(c.inst, {engine: 'asynth', shift: src.shift || 0, full: {...src.asynth, ...src.knobs}});
      if (prev?.live && prev.engine === 'asynth') c.inst.live = prev.live;
      else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(c.x.in); c.inst.live.port.postMessage({type: 'load', engine: 'asynth', params: liveParams(c)}); clock(c); }
      liveSet(c); return; }
    if (src.palette && !NATIVE_OF[src.palette] && E.liveOK) { const [p, set] = PAL[src.palette]; Object.assign(c.inst, {engine: 'poly', shift: 0, preset: p, base: {...set, ...src.poly}, full: {...NPDEF, ...PRESETS[p], chord: 0, ...set, ...src.poly}});
      if (prev?.live && prev.engine === 'poly') c.inst.live = prev.live;
      else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(c.x.in); c.inst.live.port.postMessage({type: 'load', engine: 'poly', params: liveParams(c)}); clock(c); }
      liveSet(c); return; }
    if (src.palette && !NATIVE_OF[src.palette]) { const [p, set] = PAL[src.palette], syn = makePoly(ctx, c.x.in, {period: () => 4*sd()}); syn.load({...PRESETS[p], chord: 0, ...set, ...src.poly}); c.inst.poly = syn; c.inst.base = {...set, ...src.poly}; }
    else { const name = src.native || NATIVE_OF[src.palette], oct = src.palette ? 12*(PAL[src.palette][1].oct || 0) : 0; c.inst.native = name; c.inst.shift = (src.shift || 0) + oct; c.inst.set = src.set || {}; c.inst.knobs = src.knobs || {};
      const le = E.liveOK && liveEngine(name);
      if (le) { if (prev?.live && prev.native === name) c.inst.live = prev.live;   // (the same instrument: its voices ring on, with the new settings)
        else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(c.x.in); c.inst.live.port.postMessage({type: 'load', engine: le, name, gain: NATIVE[name].gain, params: liveParams(c)}); }
        c.inst.engine = le; liveSet(c); if (name === 'grainpad') warm(c); return; } }
    if (prev?.live && prev.live !== c.inst.live) drop(prev); }
  // the song's beats told to a live synth (the time of one: its LFO in time follows them)
  const clock = c => { if (E.t0 != null && c?.inst?.live && (c.inst.engine === 'asynth' || c.inst.engine === 'poly')) c.inst.live.port.postMessage({type: 'clock', t0: E.t0}); };
  // an instrument let go: its node told to fade and stop for good (so it no longer runs), then taken off the channel
  const drop = inst => { if (inst?.live) { inst.live.port.postMessage({type: 'stop', close: true}); const n = inst.live; setTimeout(() => { try { n.disconnect(); } catch {} }, 100); } };
  // a grain pad's struck bar for each pitch the track plays, made ready before its notes come
  const warm = c => { const ps = new Set(); for (const cl of c.T.clips) for (const n of cl.notes) ps.add(n.p + c.inst.shift); c.inst.live.port.postMessage({type: 'warm', notes: [...ps]}); };
  // what a live instrument plays with now: the section's tone and length as the instrument's settings, your knobs over them
  const liveParams = c => { const I = c.inst; if (I.engine === 'drums') return drumSlots(I.sound, c, I.rack).slots; if (I.engine === 'asynth') return {...I.full, period: 4*sd()}; if (I.engine !== 'poly') return {...nativeSet(c.s || {}, I.native, I.set), ...I.knobs};
    // the poly synth: all its settings, the section's Length stretching its decay and release (as the browser-built one did)
    const L = LEN[c.s?.length ?? 1]; return {...I.full, ad: (I.base.ad ?? .3)*L, ar: (I.base.ar ?? .2)*L, period: 4*sd()}; };
  const liveSet = (c, t) => { const I = c.inst; if (!I?.live) return;
    if (I.engine === 'drums') { const slots = {}; for (const [k, d] of Object.entries(liveParams(c))) if (d.name) slots[k] = d.params; I.live.port.postMessage({type: 'set', slots, all: true, t}); }
    else I.live.port.postMessage({type: 'set', params: liveParams(c), all: I.engine !== 'poly' && I.engine !== 'asynth', t}); };
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
    c.ramp = s.ramp || null; c.rampAt = null; c.clip = clip; if (c.inst?.poly) { const b = c.inst.base; c.inst.poly.set('ad', (b.ad ?? .3)*LEN[s.length ?? 1]); c.inst.poly.set('ar', (b.ar ?? .2)*LEN[s.length ?? 1]); }
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
  function masterMix(){ const M = {glue: 2, width: 3, lo: 0, hi: 0, vol: 0, ...E.P.mx}, g = GLUE[M.glue], now = E.ctx.currentTime;
    glide(mstr.lo.gain, M.lo, now); glide(mstr.hi.gain, M.hi, now); mstr.width.set('w', WIDTHS[M.width]); glide(mstr.vol.gain, Math.pow(10, M.vol/20), now);
    const C = mstr.glue; if (g) { C.threshold.value = g.thr; C.ratio.value = g.ratio; C.attack.value = g.att; C.release.value = g.rel; C.knee.value = 8; } else { C.threshold.value = 0; C.ratio.value = 1; }
    glide(delay.d.delayTime, ECHO[E.P.echoDiv || 0][1]*4*sd(), now, .05); }

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
  function want(k, name, n, vel, set){ if (cache.has(k) || pending.has(k) || !worker) return; pending.add(k); worker.postMessage({key: k, name, n, vel: q(vel, .1), o: set, sr: E.ctx.sampleRate}); }
  function nativeNote(c, name, n, vel, o, t, lenSec){ const set = NATIVE[name].held ? {...o, len: Math.round(lenSec*20)/20} : o, k = keyOf(name, n, vel, set), b = cache.get(k);
    if (!b) { want(k, name, n, vel, set); return null; }
    const s = E.ctx.createBufferSource(), g = E.ctx.createGain(); s.buffer = b; g.gain.value = NATIVE[name].gain*(.4 + .6*vel); s.connect(g); g.connect(c.x.in); s.start(t); s.onended = () => g.disconnect(); return {g, t}; }
  // one note on a track's instrument at time t
  function play(c, p, l, v, t){ const inst = c.inst; if (!inst) return;
    if (inst.kind === 'drums') { const vv = inst.voices[p]; if (!vv) return; if (inst.live) inst.live.port.postMessage({type: 'on', id: ++E.nid, slot: p, n: vv.n ?? 60, vel: q(v, .1), gv: v, t}); else if (vv.kit) vv.kit.play(vv.voice || p, t, v, null); else {
        if ((p === 'chh' || p === 'ohh') && c.open && t > c.open.t) { c.open.g.gain.setTargetAtTime(0, t, .012); c.open = null; }
        const h = nativeNote(c, vv.native, vv.n, v, {...nativeSet(c.s, vv.native, vv.set), ...vv.knobs}, t, .5); if (p === 'ohh' && h) c.open = h; }
      if (c.T.role === 'kick' && !c.x.desk) for (const o of E.ch) { if (o === c) continue; const d = DUCKS[o.s.duck ?? o.T.mix.duck ?? 0]; if (d) duckAt(o.x.duck.gain, d, t); }
      if (c.T.role === 'kick' && E.eng && !c.x.desk) for (const [k, r] of Object.entries(rets)) duckAt(r.duck.gain, RET[k].duck, t);
      return; }
    if (inst.live) { const id = ++E.nid, n = p + inst.shift, len = Math.round(l*sd()*20)/20; inst.live.port.postMessage({type: 'on', id, n, vel: q(v, .1), gv: v, t, len}); inst.live.port.postMessage({type: 'off', id, t: t + l*sd()}); return; }
    if (inst.poly) inst.poly.play(p, t, l*sd(), v); else nativeNote(c, inst.native, p + inst.shift, v, {...nativeSet(c.s, inst.native, inst.set), ...inst.knobs}, t, l*sd()); }
  // the native buffers a note needs on a channel, asked for now: their keys
  function need(c, p, l, v){ const inst = c.inst; if (!inst || inst.live) return [];
    const one = (name, n, o, lenSec) => { const set = NATIVE[name].held ? {...o, len: Math.round(lenSec*20)/20} : o, k = keyOf(name, n, v, set); want(k, name, n, v, set); return [k]; };
    if (inst.kind === 'drums') { const vv = inst.voices[p]; return vv?.native ? one(vv.native, vv.n, {...nativeSet(c.s, vv.native, vv.set), ...vv.knobs}, .5) : []; }
    return inst.native ? one(inst.native, p + inst.shift, {...nativeSet(c.s, inst.native, inst.set), ...inst.knobs}, l*sd()) : []; }
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
    else if (E.liveOK && E.wurl) { const src = snd.src, [pp, set] = PAL[src.palette]; await off.audioWorklet.addModule(E.wurl);
      const n = new AudioWorkletNode(off, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init: [{type: 'load', engine: 'poly', params: {...NPDEF, ...PRESETS[pp], chord: 0, ...set, ...src.poly, period: 4*sd()}}, {type: 'on', id: 1, n: p, vel: v, gv: v, t: .02}, {type: 'off', id: 1, t: .02 + secs}]}}); n.connect(g); }
    else { const src = snd.src, [pp, set] = PAL[src.palette], syn = makePoly(off, g, {period: () => 4*sd()}); syn.load({...PRESETS[pp], chord: 0, ...set, ...src.poly}); syn.play(p, .02, secs, v); }
    return off.startRendering(); };
  E.gen = 0; E.nid = 0;
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
