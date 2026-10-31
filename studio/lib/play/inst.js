// A part's instrument, the same in the jam and the DAW: a sound (the library's: a drum kit or rack, the analog synth, the
// poly synth, a native instrument) built on a channel's input and a note played on it. Live where the audio engine has
// the voices (studio/arrange/voices.worklet.js: every native instrument, the native poly synth, the drum machines, the
// analog synth), else the browser-built poly synth and kit, and native notes computed ahead by the worker and cached.
// The page says how its channels are made (`o`): where a channel's sound goes, its settings (a section's tone and length,
// read by nativeSet), a drum rack's pads and where each goes, the beat's time, the pitches a grain pad will need.
import { nativeSet, LEN } from '../../jam/model.js';
import { SOUNDS as PAL, NATIVE_OF } from '../palette.js';
import { NATIVE } from '../native/index.js';
import { kitFallback, ANALOG_KITS } from '../native/analogkit.js';
import { DEF as NPDEF } from '../native/npoly.js';
import { makePoly, PRESETS } from '../../../src/audio/engine/inst/poly.js';
import { makeDrums } from '../../../src/audio/engine/inst/drums.js';

export const q = (v, s) => Math.round(v/s)*s;
// a palette sound on the poly synth: its preset, your changes over it (base), and every setting the native one plays (full)
export const polyOf = src => { const [preset, set] = PAL[src.palette]; return {preset, base: {...set, ...src.poly}, full: {...NPDEF, ...PRESETS[preset], chord: 0, ...set, ...src.poly}}; };
// a computed note's key in the cache: the instrument, pitch, velocity and settings (rounded, so near ones share)
export const keyOf = (name, n, vel, o) => `${name}|${n}|${q(vel, .1).toFixed(1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;
// the instruments played live, sample by sample as they sound: every native instrument (and, by the build below, the
// native poly synth in place of the browser-built one and the native drum machine in place of the browser's)
export const liveEngine = name => NATIVE[name] ? 'nat' : null;
// a drum sound's pads as the live engine's slots: a native instrument each (a hat choking the open one), or a voice of a
// drum machine (each kit and its changes one machine; a pad may play another of its voices, `voice`; in a drum rack each
// pad its own machine, so each has its own output). set: the channel's settings
export const drumSlots = (s, set, rack) => { const slots = {}, kits = {};
  for (const [v, m] of Object.entries(s.voices)) { if (m.native) { slots[v] = {name: m.native, gain: NATIVE[m.native]?.gain ?? .5, params: {...nativeSet(set || {}, m.native, m.set || {}), ...m.knobs}, choke: v === 'ohh' ? 'hat' : null, chokes: v === 'chh' || v === 'ohh' ? 'hat' : null}; continue; }
    const g = rack ? v : m.kit + JSON.stringify(m.over || {}); kits[g] = {kit: m.kit, over: m.over || {}, dry: rack && !!ANALOG_KITS[m.kit]}; slots[v] = {kit: g, voice: m.voice || v}; }
  return {slots, kits}; };

// o: {SND, sd() (a 16th in seconds), ctx(), ok() (the live voices loaded), inOf(c), setOf(c), padsOf(c), padOut(node, j, c),
// t0() (where the beats fall), pitches(c), onBusy(n)}
export function makeInstruments(o){ const {SND, sd} = o, CX = o.ctx, ok = o.ok, inOf = o.inOf || (c => c.x.in), setOf = o.setOf || (c => c.s || {}),
    padsOf = o.padsOf || (() => null), padOut = o.padOut || ((n, j, c) => n.connect(inOf(c), j, 0)), t0 = o.t0 || (() => null), pitches = o.pitches || (() => []), onBusy = o.onBusy || (() => {});
  const cache = new Map(), pending = new Set(); let worker = null;
  const I = {cache, pending, nid: 0};
  // the worker that computes native notes ahead (where they don't play live)
  I.attach = src => { const ctx = CX(); worker = new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})));
    worker.onmessage = e => { const {key, L, R, error} = e.data; pending.delete(key); if (!error) { const b = ctx.createBuffer(2, L.length, ctx.sampleRate); b.copyToChannel(L, 0); b.copyToChannel(R, 1); cache.set(key, b); } onBusy(pending.size); }; };
  function build(c, id){ const ctx = CX(), s = SND[id], prev = c.inst; c.sound = id; c.inst = {kind: 'pitched'}; if (!s) { drop(prev); return; }
    if (s.voices && ok()) { const pads = padsOf(c), {slots, kits} = drumSlots(s, setOf(c), !!pads); c.inst = {kind: 'drums', voices: {}, engine: 'drums', sound: s, rack: !!pads};
      for (const [v, m] of Object.entries(s.voices)) c.inst.voices[v] = m.native ? {native: m.native, n: m.n, set: m.set || {}, knobs: m.knobs || {}} : {kit: true};
      // a drum rack: an output a pad, each into its pad's strip on the desk
      if (pads) { if (prev?.live && prev.rack && prev.pads === pads) c.inst.live = prev.live;
        else { drop(prev); const n = c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, numberOfOutputs: pads.length, outputChannelCount: pads.map(() => 2)});
          pads.forEach((p, j) => padOut(n, j, c)); }
        c.inst.pads = pads; c.inst.live.port.postMessage({type: 'load', slots, kits, outs: pads}); return; }
      // (a drum track again: the same node, its pads and machines set anew, what's ringing rings on)
      if (prev?.live && prev.engine === 'drums') c.inst.live = prev.live;
      else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(inOf(c)); }
      c.inst.live.port.postMessage({type: 'load', slots, kits}); return; }
    if (s.voices) { drop(prev); const kits = {}; c.inst = {kind: 'drums', voices: {}};
      for (const [v, m] of Object.entries(s.voices)) { if (m.native) { c.inst.voices[v] = {native: m.native, n: m.n, set: m.set || {}, knobs: m.knobs || {}}; continue; }
        const key = m.kit + JSON.stringify(m.over || {}); if (!kits[key]) { kits[key] = makeDrums(ctx, inOf(c)); kits[key].load(kitFallback(m.kit), m.over || {}); } c.inst.voices[v] = {kit: kits[key], voice: m.voice}; } return; }
    const src = s.src;
    // the analog synth (asynth.js): one instrument a track, its patch and your knobs over it (where no worklet runs,
    // its stand-in from the palette plays below)
    if (src.asynth && ok()) { Object.assign(c.inst, {engine: 'asynth', shift: src.shift || 0, full: {...src.asynth, ...src.knobs}});
      if (prev?.live && prev.engine === 'asynth') c.inst.live = prev.live;
      else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(inOf(c)); c.inst.live.port.postMessage({type: 'load', engine: 'asynth', params: liveParams(c)}); clock(c); }
      liveSet(c); return; }
    if (src.palette && !NATIVE_OF[src.palette] && ok()) { Object.assign(c.inst, {engine: 'poly', shift: 0, ...polyOf(src)});
      if (prev?.live && prev.engine === 'poly') c.inst.live = prev.live;
      else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(inOf(c)); c.inst.live.port.postMessage({type: 'load', engine: 'poly', params: liveParams(c)}); clock(c); }
      liveSet(c); return; }
    if (src.palette && !NATIVE_OF[src.palette]) { const {preset, base} = polyOf(src), syn = makePoly(ctx, inOf(c), {period: () => 4*sd()}); syn.load({...PRESETS[preset], chord: 0, ...base}); c.inst.poly = syn; c.inst.base = base; }
    else { const name = src.native || NATIVE_OF[src.palette], oct = src.palette ? 12*(PAL[src.palette][1].oct || 0) : 0; c.inst.native = name; c.inst.shift = (src.shift || 0) + oct; c.inst.set = src.set || {}; c.inst.knobs = src.knobs || {};
      const le = ok() && liveEngine(name);
      if (le) { if (prev?.live && prev.native === name) c.inst.live = prev.live;   // (the same instrument: its voices ring on, with the new settings)
        else { drop(prev); c.inst.live = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); c.inst.live.connect(inOf(c)); c.inst.live.port.postMessage({type: 'load', engine: le, name, gain: NATIVE[name].gain, params: liveParams(c)}); }
        c.inst.engine = le; liveSet(c); if (name === 'grainpad') warm(c); return; } }
    if (prev?.live && prev.live !== c.inst.live) drop(prev); }
  // the song's beats told to a live synth (the time of one: its LFO in time follows them)
  const clock = c => { if (t0() != null && c?.inst?.live && (c.inst.engine === 'asynth' || c.inst.engine === 'poly')) c.inst.live.port.postMessage({type: 'clock', t0: t0()}); };
  // an instrument let go: its node told to fade and stop for good (so it no longer runs), then taken off the channel
  const drop = inst => { if (inst?.live) { inst.live.port.postMessage({type: 'stop', close: true}); const n = inst.live; setTimeout(() => { try { n.disconnect(); } catch {} }, 100); } };
  // a grain pad's struck bar for each pitch the track plays, made ready before its notes come
  const warm = c => { const ps = new Set(); for (const p of pitches(c)) ps.add(p + c.inst.shift); c.inst.live.port.postMessage({type: 'warm', notes: [...ps]}); };
  // what a live instrument plays with now: the section's tone and length as the instrument's settings, your knobs over them
  const liveParams = c => { const I = c.inst; if (I.engine === 'drums') return drumSlots(I.sound, setOf(c), I.rack).slots; if (I.engine === 'asynth') return {...I.full, period: 4*sd()}; if (I.engine !== 'poly') return {...nativeSet(setOf(c), I.native, I.set), ...I.knobs};
    // the poly synth: all its settings, the section's Length stretching its decay and release (as the browser-built one did)
    const L = LEN[setOf(c).length ?? 1]; return {...I.full, ad: (I.base.ad ?? .3)*L, ar: (I.base.ar ?? .2)*L, period: 4*sd()}; };
  const liveSet = (c, t) => { const I = c.inst; if (!I?.live) return;
    if (I.engine === 'drums') { const slots = {}; for (const [k, d] of Object.entries(liveParams(c))) if (d.name) slots[k] = d.params; I.live.port.postMessage({type: 'set', slots, all: true, t}); }
    else I.live.port.postMessage({type: 'set', params: liveParams(c), all: I.engine !== 'poly' && I.engine !== 'asynth', t}); };
  function want(k, name, n, vel, set){ if (cache.has(k) || pending.has(k) || !worker) return; pending.add(k); worker.postMessage({key: k, name, n, vel: q(vel, .1), o: set, sr: CX().sampleRate}); }
  function nativeNote(c, name, n, vel, o, t, lenSec, fv = 1){ const set = NATIVE[name].held ? {...o, len: Math.round(lenSec*20)/20} : o, k = keyOf(name, n, vel, set), b = cache.get(k);
    if (!b) { want(k, name, n, vel, set); return null; }
    const s = CX().createBufferSource(), g = CX().createGain(); s.buffer = b; g.gain.value = NATIVE[name].gain*(.4 + .6*vel)*fv; s.connect(g); g.connect(inOf(c)); s.start(t); s.onended = () => g.disconnect(); return {g, t}; }
  // one note on a channel's instrument at time t: p a pitch (or a drum voice), l its length in 16ths, v its velocity; fv the
  // feel's loudness over it (a computed note is played louder or softer, so the feel never waits on a new one). Returns
  // 'drums' for a drum hit (the page ducks on its kick)
  function play(c, p, l, v, t, fv = 1){ const inst = c.inst; if (!inst) return; const gv = Math.max(.05, Math.min(1, v*fv));
    if (inst.kind === 'drums') { const vv = inst.voices[p]; if (!vv) return; if (inst.live) inst.live.port.postMessage({type: 'on', id: ++I.nid, slot: p, n: vv.n ?? 60, vel: q(gv, .1), gv, t}); else if (vv.kit) vv.kit.play(vv.voice || p, t, gv, null); else {
        if ((p === 'chh' || p === 'ohh') && c.open && t > c.open.t) { c.open.g.gain.setTargetAtTime(0, t, .012); c.open = null; }
        const h = nativeNote(c, vv.native, vv.n, v, {...nativeSet(setOf(c), vv.native, vv.set), ...vv.knobs}, t, .5, fv); if (p === 'ohh' && h) c.open = h; }
      return 'drums'; }
    if (inst.live) { const id = ++I.nid, n = p + inst.shift, len = Math.round(l*sd()*20)/20; inst.live.port.postMessage({type: 'on', id, n, vel: q(gv, .1), gv, t, len}); inst.live.port.postMessage({type: 'off', id, t: t + l*sd()}); return; }
    if (inst.poly) inst.poly.play(p, t, l*sd(), gv); else nativeNote(c, inst.native, p + inst.shift, v, {...nativeSet(setOf(c), inst.native, inst.set), ...inst.knobs}, t, l*sd(), fv); }
  // the native buffers a note needs on a channel, asked for now: their keys
  function need(c, p, l, v){ const inst = c.inst; if (!inst || inst.live) return [];
    const one = (name, n, o, lenSec) => { const set = NATIVE[name].held ? {...o, len: Math.round(lenSec*20)/20} : o, k = keyOf(name, n, v, set); want(k, name, n, v, set); return [k]; };
    if (inst.kind === 'drums') { const vv = inst.voices[p]; return vv?.native ? one(vv.native, vv.n, {...nativeSet(setOf(c), vv.native, vv.set), ...vv.knobs}, .5) : []; }
    return inst.native ? one(inst.native, p + inst.shift, {...nativeSet(setOf(c), inst.native, inst.set), ...inst.knobs}, l*sd()) : []; }
  // a poly synth's decay and release stretched by Length (the browser-built one; the live one reads it in liveParams)
  const lengthTo = (c, L) => { const P = c.inst?.poly; if (!P) return; const b = c.inst.base; P.set('ad', (b.ad ?? .3)*L); P.set('ar', (b.ar ?? .2)*L); };
  Object.assign(I, {build, play, need, want, drop, clock, warm, liveParams, liveSet, lengthTo, nativeNote});
  return I; }
