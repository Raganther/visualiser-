// Studio Jam v2: parts made of modules that mix and match. Each part (kick, hats, percussion, bass, chords, two leads) is
// a rhythm (when), notes (what, in order, one a hit, going round), a sound (how) and its space (where), and every one of
// them has the same verbs: New, Vary, Develop, the module's own tools, Undo, Save to the library, 👍. Life plays each part
// as a player would. Underneath them all the ground (the harmony, every line reading its chords); above them the form
// (scenes, your saved scenes, a song of scenes). Changes land on the next bar. Record writes down what plays for Claude.
import { improvise, reach, keep, PLAYS } from './play.js';
import { split, join, linked, cycles, rhythmTool, notesTool, noteTools, spread, fitNotes, sketch, fresh, named, isDrum, family, VOICE0, RHYTHM_TOOLS, NOTE_TOOLS } from './part.js';
import { KEYS, MODES, MODE_WORDS, COLS, FEELS as HFEELS, LIB as PROGS, matrix, distance, shared, nameOf, shortOf, keyOf as chordKey, inKey } from './chords.js';
import { notesAt, chordOf, REGISTER, ROLE_NAMES, nativeSet, cutOf, LEN, X0, vlChain, invert, STYLES, FEELS, feelAt, ARPS, ECHO } from './model.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { NATIVE } from '../lib/native/index.js';
import { makePoly, PRESETS } from '../../src/audio/engine/inst/poly.js';
import { makeDrums } from '../../src/audio/engine/inst/drums.js';
import { kitFallback, ANALOG_KITS } from '../lib/native/analogkit.js';
import widthFx from '../../src/audio/engine/fx/width.js';
import { engOf, engChain, retChain, RET, glide, duckAt } from './mixeng.js';
import { track, notesOf, hitsOf, grid, barsFor, noteName } from './sing.js';

const $ = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v != null) e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };
const clone = x => JSON.parse(JSON.stringify(x));
let PACK = null, SND = {}, CLIP = {}, LIB = [], ALLPACKS = [];
const st = {eng: (() => { try { return localStorage.getItem('studio.jam.eng') !== '0'; } catch { return true; } })(), smooth: (() => { try { return localStorage.getItem('studio.jam.smooth') !== '0'; } catch { return true; } })(), echoDiv: 0, bar: 0, bpm: 124, swing: .06, harmony: null, hNext: null, hStart: 0, cols: [], sel: 0, tab: 'rhythm', playing: false, step: 0, rec: null, build: null, drop: null, rep: null};

// singing a part in (below): the take's length, what it said, what it heard
const SG = {bars: 2, busy: false, msg: '', heard: '', open: false};

/* ---------- audio: a channel per part (EQ, the tone filter with an LFO, pan, the kick's duck, echo and reverb sends) ---------- */
let ctx, master, hp, delay, verb, worker, nextT = 0, timer = 0, mstr = null, rets = null, liveOK = false, nid = 0;
const cache = new Map(), pending = new Set();
function initAudio(){ if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'});
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .12;
  hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 18; master = ctx.createGain(); master.gain.value = .85;
  // the master: EQ (low and high shelves), width (mid and side, the bass kept mono), the glue compressor, then the build's
  // high-pass, the limiter, the master volume and its meter
  mstr = {lo: ctx.createBiquadFilter(), hi: ctx.createBiquadFilter(), width: widthFx.make(ctx), glue: ctx.createDynamicsCompressor(), vol: ctx.createGain(), meter: ctx.createAnalyser(), lim};
  mstr.lo.type = 'lowshelf'; mstr.lo.frequency.value = 110; mstr.hi.type = 'highshelf'; mstr.hi.frequency.value = 7000; mstr.width.set('mono', 150); mstr.meter.fftSize = 1024;
  master.connect(mstr.lo); mstr.lo.connect(mstr.hi); mstr.hi.connect(mstr.width.input); mstr.width.output.connect(mstr.glue); mstr.glue.connect(hp); hp.connect(lim); lim.connect(mstr.vol); mstr.vol.connect(ctx.destination); mstr.vol.connect(mstr.meter);
  delay = {in: ctx.createGain(), d: ctx.createDelay(2), fb: ctx.createGain(), lp: ctx.createBiquadFilter()};
  delay.lp.frequency.value = 2400; delay.fb.gain.value = .45; delay.in.connect(delay.d); delay.d.connect(delay.lp); delay.lp.connect(delay.fb); delay.fb.connect(delay.d); 
  verb = ctx.createConvolver(); const L = 2.8*ctx.sampleRate, ir = ctx.createBuffer(2, L, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); let lp = 0; for (let i = 0; i < L; i++) { lp += (.3 - .25*i/L)*((Math.random()*2 - 1) - lp); x[i] = lp*Math.pow(1 - i/L, 2.2); } }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .8; verb.connect(vg);
  // the returns through Claude's mix (out of the low end, ducked a little by the kick) into the master
  rets = Object.fromEntries([['echo', delay.lp], ['verb', vg]].map(([k, from]) => { const r = retChain(ctx, RET[k]), d = ctx.createGain(); from.connect(r.input); r.output.connect(d); d.connect(master); return [k, {...r, duck: d}]; }));
  worker = new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent], {type: 'text/javascript'})));
  worker.onmessage = e => { const {key, L, R, error} = e.data; pending.delete(key); if (!error) { const b = ctx.createBuffer(2, L.length, ctx.sampleRate); b.copyToChannel(L, 0); b.copyToChannel(R, 1); cache.set(key, b); } busy(); };
  for (const c of st.cols) { makeChan(c); buildSound(c); } engSet(st.eng, true); tempo(); masterMix(); renderMix();
  // the live voices (the DAW's worklet): once loaded, the analog synth's sounds are played on it, not the poly synth standing in
  const wl = $('worklet-src')?.textContent; if (wl && ctx.audioWorklet) ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([wl], {type: 'text/javascript'})))
    .then(() => { liveOK = true; for (const c of st.cols) if (usesLive(SND[c.sound])) buildSound(c); }).catch(() => {});
}
// Claude's mix on or off (mixeng.js): every channel's chain and the returns, eased over a moment, so you can A/B it as it plays
function engSet(v, quiet){ st.eng = v; try { localStorage.setItem('studio.jam.eng', v ? '1' : '0'); } catch {} const b = $('engAB'); if (b) { b.setAttribute('aria-pressed', String(v)); b.textContent = v ? 'Mix: Claude’s' : 'Mix: plain'; }
  if (ctx) { for (const c of st.cols) c.ch?.eng.on(v); for (const r of Object.values(rets || {})) r.on(v); } if (st.rec) st.rec.eng = v; if (!quiet) flash(v ? 'Claude’s mix: each part carved and enriched' : 'Plain mix: as it was'); }
function makeChan(c){ const x = {in: ctx.createGain(), lo: ctx.createBiquadFilter(), mid: ctx.createBiquadFilter(), hi: ctx.createBiquadFilter(), f: ctx.createBiquadFilter(), pan: ctx.createStereoPanner(), duck: ctx.createGain(), out: ctx.createGain(), echo: ctx.createGain(), verb: ctx.createGain(), lfo: ctx.createOscillator(), lfoG: ctx.createGain(), meter: ctx.createAnalyser()};
  x.lo.type = 'lowshelf'; x.lo.frequency.value = 120; x.mid.type = 'peaking'; x.mid.frequency.value = 1000; x.mid.Q.value = .8; x.hi.type = 'highshelf'; x.hi.frequency.value = 6000; x.meter.fftSize = 512;
  x.eng = engChain(ctx, engOf(c.role, laneOf(c))); x.in.connect(x.eng.input); x.eng.output.connect(x.lo); x.lo.connect(x.mid); x.mid.connect(x.hi); x.hi.connect(x.f); x.f.connect(x.pan); x.out.connect(x.meter); x.pan.connect(x.duck); x.duck.connect(x.out); x.out.connect(master); x.out.connect(x.echo); x.out.connect(x.verb); x.echo.connect(delay.in); x.verb.connect(verb);
  x.lfo.connect(x.lfoG); x.lfo.start(); x.f.Q.value = 1.2; x.eng.on(st.eng); c.ch = x; macros(c); }
// a part's settings onto its channel: tone (the filter, and a native sound's mallet), space (echo and reverb), motion (the
// LFO), its level, pan and EQ
function macros(c){ if (!c.ch) return; const x = c.ch, now = ctx.currentTime, s = .05;
  // (every move glides and then stops: see glide in mixeng.js)
  glide(x.f.frequency, cutOf(c.x), now, s); glide(x.echo.gain, c.throw ? .95 : c.echo ? c.y*.5 : 0, now, c.throw ? .005 : s); glide(x.verb.gain, c.verb ? c.y*.75 : 0, now, s);
  const M = c.mix, solo = st.cols.some(y => y.mix.solo); glide(x.out.gain, c.mute || solo && !M.solo ? 0 : c.level*Math.pow(10, M.vol/20), now, .02);
  glide(x.pan.pan, M.pan, now, .02); glide(x.lo.gain, M.lo, now, .02); glide(x.mid.gain, M.mid, now, .02); glide(x.hi.gain, M.hi, now, .02);
  // the LFO on the tone filter only while there's motion (a connected modulator makes the filter work every sample)
  const rate = [0, 1/(8*60/st.bpm), 1/(.5*60/st.bpm), 0][c.motion]; glide(x.lfo.frequency, rate || .1, now, s); glide(x.lfoG.gain, [0, .45, .35, 0][c.motion]*cutOf(c.x), now, s);
  const lfo = c.motion === 1 || c.motion === 2; if (lfo !== !!x.lfoOn) { x.lfoOn = lfo; if (x.lfoOn) x.lfoG.connect(x.f.frequency); else x.lfoG.disconnect(); }
  // a ramp across a section (ramp.x: the tone from one value to another over its bars) glides the filter over a bar
  if (c.ramp && c.rampAt != null) glide(x.f.frequency, cutOf(c.x), now, 15*sd()/3); }
function tempo(){ if (!ctx) return; glide(delay.d.delayTime, ECHO[st.echoDiv][1]*60/st.bpm, ctx.currentTime, .05); for (const c of st.cols) { macros(c); c.inst?.live?.port.postMessage({type: 'set', params: {period: 4*sd()}}); } }

/* ---------- sounds: a part's sound built on its channel (poly synth, drum kits, native instruments) ---------- */
const env = {period: () => 60/st.bpm};
function buildSound(c){ if (!ctx) return; const s = SND[c.sound]; dropLive(c); c.inst = {kind: 'pitched'};
  // the analog synth, live (its voices in the worklet, as in the DAW); without worklets, its palette's poly synth stands in
  if (s.src?.asynth && liveOK) { const n = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); n.connect(c.ch.in);
    n.port.postMessage({type: 'load', engine: 'asynth', params: {...s.src.asynth, ...s.src.knobs, period: 4*sd()}}); c.inst.live = n; c.inst.shift = s.src.shift || 0; return; }
  if (s.voices) { const kits = {}; c.inst = {kind: 'drums', voices: {}};
    // the analog drum machine's voices, live (the DAW's worklet: one machine a kit, a slot a voice); without it the
    // browser-built kit nearest it stands in
    const ak = liveOK ? Object.entries(s.voices).filter(([, m]) => m.kit && ANALOG_KITS[m.kit]) : [];
    if (ak.length) { const n = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}), slots = {}, lk = {}; n.connect(c.ch.in);
      for (const [v, m] of ak) { const g = m.kit + JSON.stringify(m.over || {}); lk[g] = {kit: m.kit, over: m.over || {}}; slots[v] = {kit: g, voice: m.voice || v}; c.inst.voices[v] = {live: true}; }
      n.port.postMessage({type: 'load', slots, kits: lk}); c.inst.live = n; }
    for (const [v, m] of Object.entries(s.voices)) { if (c.inst.voices[v]) continue; if (m.native) { c.inst.voices[v] = {native: m.native, n: m.n, set: m.set || {}}; continue; }
      const key = m.kit + JSON.stringify(m.over || {}); if (!kits[key]) { kits[key] = makeDrums(ctx, c.ch.in); kits[key].load(kitFallback(m.kit), m.over || {}); } c.inst.voices[v] = {kit: kits[key], voice: m.voice}; } return; }
  const src = s.src; if (src.palette && !NATIVE_OF[src.palette]) { const [p, set] = PAL[src.palette], syn = makePoly(ctx, c.ch.in, env); syn.load({...PRESETS[p], chord: 0, ...set}); c.inst.poly = syn; c.inst.base = set; }
  else { const name = src.native || NATIVE_OF[src.palette], oct = src.palette ? 12*(PAL[src.palette][1].oct || 0) : 0; c.inst.native = name; c.inst.shift = (src.shift || 0) + oct; c.inst.set = src.set || {}; }
  lengthTo(c); }
const usesLive = s => !!(s?.src?.asynth || s?.voices && Object.values(s.voices).some(m => m.kit && ANALOG_KITS[m.kit]));
// a live instrument let go: what sounds fades, then the node closes
function dropLive(c){ const n = c.inst?.live; if (!n) return; n.port.postMessage({type: 'stop', close: true}); setTimeout(() => n.disconnect(), 400); }
// length: a synth's decay and release stretch (a native sound's ring: nativeSet in model.js)
function lengthTo(c){ if (c.inst?.poly) { const b = c.inst.base; c.inst.poly.set('ad', (b.ad ?? .3)*LEN[c.length]); c.inst.poly.set('ar', (b.ar ?? .2)*LEN[c.length]); } }
const q = (v, s) => Math.round(v/s)*s;
const keyOf = (name, n, vel, o) => `${name}|${n}|${q(vel, .1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;
function nativeNote(c, name, n, vel, o, t, lenSec, fv = 1){ const set = NATIVE[name].held ? {...o, len: Math.round(lenSec*20)/20} : o, k = keyOf(name, n, vel, set), b = cache.get(k);
  if (!b) { want(k, name, n, vel, set); return; }
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = NATIVE[name].gain*(.4 + .6*vel)*fv; s.connect(g); g.connect(c.ch.in); s.start(t); s.onended = () => g.disconnect(); return {g, t}; }
function want(k, name, n, vel, set){ if (cache.has(k) || pending.has(k) || !worker) return; pending.add(k); worker.postMessage({key: k, name, n, vel: q(vel, .1), o: set, sr: ctx.sampleRate}); busy(); }
// the ground's voice-leading chain (smooth), in the chords part's voicing; a part's notes at a step and bar
const chordsCol = () => st.cols.find(c => c.role === 'chords');
const chainOf = H => st.smooth ? vlChain(H, STYLES[chordsCol()?.voicing || 0]) : null;
function partNotes(c, clip, pos, H, bar){ const ch = chainOf(H), i = ((bar % H.bars.length) + H.bars.length) % H.bars.length;
  return notesAt(clip, pos, chordOf(H, bar), {vl: ch && ch[i], inv: c.inv || 0, walk: c.walk ? walkOf(c) : 0}); }
// the two leads' lanes, so Life has them take turns resting
const laneOf = c => st.cols.filter(x => x.role === c.role).indexOf(c);
// where a part is in its clip at the jam's 16th: round its loop when one is set ([from, to) in steps), else the whole clip
const loopOf = c => c.clip && c.loop && c.loop[1] <= c.clip.len && c.loop[1] > c.loop[0] ? c.loop : null;
function posOf(c, s){ const lp = loopOf(c), n = lp ? lp[1] - lp[0] : c.clip.len; return (lp ? lp[0] : 0) + (((s - c.start) % n) + n) % n; }
const walkOf = c => c.clip ? Math.floor(Math.max(0, st.step - c.start)/c.clip.len) % 4 : 0;
// every native note a part will need over the whole ground, computed ahead (and those Life may reach)
function prewarm(c, clip = c.next ? c.next.clip : c.clip, also = true){ if (!ctx || !clip || !c.inst) return; if (also && c.play) for (const x of reach(c.role, clip)) prewarm(c, x, false); const H = st.hNext || st.harmony, sd = 60/st.bpm/4, ch = chainOf(H), arp = c.role === 'chords' && c.arp;
  for (let bar = 0; bar < H.bars.length; bar++) for (const w of c.walk ? [0, 1, 2, 3] : [0]) for (const p of new Set(clip.steps.map(s => s[0])))
    for (const [n, len, vel] of notesAt(clip, p, chordOf(H, bar), {vl: ch && ch[bar], inv: c.inv || 0, walk: w})) {
      if (c.inst.kind === 'drums') { const v = c.inst.voices[n]; if (v?.native) { const o = nativeSet(c, v.native, v.set); want(keyOf(v.native, v.n, vel, o), v.native, v.n, vel, o); } }
      else if (c.inst.native) { const nm = c.inst.native, o = nativeSet(c, nm, c.inst.set), set = NATIVE[nm].held ? {...o, len: Math.round((arp ? .9 : len)*sd*20)/20} : o, m = n + c.inst.shift + 12*(c.oct || 0);
        want(keyOf(nm, m, vel, set), nm, m, vel, set); } } }
function busy(){ const n = pending.size; $('busy').textContent = !ctx ? 'Press Play' : n ? `Computing ${n} sound${n > 1 ? 's' : ''}…` : st.playing ? 'Playing' : 'Ready'; $('busy').dataset.on = n ? '1' : ''; }

/* ---------- the clock: steps scheduled ahead; parts, the ground and moves change on the next bar ---------- */
const sd = () => 60/st.bpm/4;
function tick(){ while (nextT < ctx.currentTime + .12) { playStep(st.step, nextT); st.step++; nextT += sd(); } }
// one 16th: each part's notes, grooved by its rhythm's feel (loudness, swing, ahead or behind), played with Life; a chords
// part with an arp plays its chord's voices one a 16th for as long as the chord is held
function playStep(step, t0){
  if (step % 16 === 0) barLine(step);
  const H = st.harmony, bar = Math.floor((step - st.hStart)/16), dropped = st.drop && step >= st.drop.at && step < st.drop.at + 16;
  // a part with the pulse: its filter opens on every beat and falls back (a quarter-note pulse, locked to the bar)
  if (step % 4 === 0) for (const c of st.cols) if (c.motion === 3 && c.ch) { const f = c.ch.f.frequency, lo = cutOf(c.x), b = 4*sd(); glide(f, Math.min(18000, lo*3.2), t0, .006); f.linearRampToValueAtTime(Math.min(18000, lo*1.6), t0 + .35*b); f.linearRampToValueAtTime(lo, t0 + .9*b); }
  for (const c of st.cols) { if (!c.clip || c.mute || dropped && c.role !== 'chords') continue;
    const eff = st.rep ? st.rep.at + ((step - st.rep.at) % st.rep.len) : step, pos = posOf(c, eff);
    const f = FEELS[c.R?.feel || 0], sw = step % 2 ? (f.swing ?? st.swing) : 0, fe = feelAt(f, step), off = sw + fe.dt, t = Math.max(ctx.currentTime, t0 + off*sd());
    const recOff = off - (step % 2 ? st.swing : 0), drum = c.inst.kind === 'drums';
    let notes = c.play && c.role !== 'chords' ? improvise({role: c.role, clip: c.clip, pos, step, bar, lane: laneOf(c), a: PLAYS[c.play].a, mem: c.pm ??= {}, seed: st.pseed})
      .flatMap(ev => { (c.heard ??= []).push({step, ...ev}); return partNotes(c, {...c.clip, steps: [ev.s]}, pos, H, bar).map(([n, len, vel]) => [n, len, vel, ev.dt, ev.fv]); })
      : partNotes(c, c.clip, pos, H, bar);
    if (c.role === 'chords' && c.arp) { if (notes.length) c.arpSt = {until: step + Math.max(1, Math.round(notes[0][1])), vel: notes[0][2], i: c.arpSt?.i ?? 0};
      notes = []; const a = c.arpSt; if (a && step < a.until) { const ch = chainOf(H), bi = ((bar % H.bars.length) + H.bars.length) % H.bars.length;
        const v = invert(ch ? ch[bi].voicing : notesAt({role: 'chords', steps: [[0, 'chord', 1, 1]]}, 0, chordOf(H, bar)).map(x => x[0]), c.inv || 0), m = v.length, k = a.i++;
        const j = {up: k % m, down: m - 1 - k % m, 'up and down': m < 2 ? 0 : [...Array(m).keys(), ...[...Array(m).keys()].slice(1, -1).reverse()][k % (2*m - 2)], random: Math.floor(Math.random()*m)}[ARPS[c.arp]];
        notes = [[v[j], .9, a.vel]]; } }
    if (c.heard?.length > 600) c.heard.splice(0, c.heard.length - 400);
    for (const [n0, len, vel, dt = 0, pv = 1] of notes) { const n = drum ? n0 : n0 + 12*(c.oct || 0); play(c, n, len, vel, Math.max(ctx.currentTime, t + dt*sd()), fe.v*pv);
      if (st.rec && step >= st.rec.from) st.rec.notes.push([step - st.rec.from, c.id, c.sound, n, len, +Math.min(1, vel*fe.v*pv).toFixed(2), +(recOff + dt).toFixed(3)]); } }
  const s = step; setTimeout(() => light(s), Math.max(0, (t0 - ctx.currentTime)*1000));
}
// fv: the feel's loudness (a native note is computed at its own loudness and played louder or softer, so the feel never
// waits on a new note being computed)
function play(c, n, len, vel, t, fv = 1){ const v2 = Math.max(.05, Math.min(1, vel*fv));
  if (c.inst.kind === 'drums') { const v = c.inst.voices[n]; if (!v) return; if (v.live) c.inst.live.port.postMessage({type: 'on', id: ++nid, slot: n, n: 60, vel: q(v2, .1), gv: v2, t}); else if (v.kit) v.kit.play(v.voice || n, t, v2, null); else {
      // a hat closed (or hit again) while the open one rings stops it, as a real pair of cymbals does
      if ((n === 'chh' || n === 'ohh') && c.open && t > c.open.t) { c.open.g.gain.setTargetAtTime(0, t, .012); c.open = null; }
      const h = nativeNote(c, v.native, v.n, vel, nativeSet(c, v.native, v.set), t, .5, fv); if (n === 'ohh' && h) c.open = h; }
    if (c.role === 'kick') duck(t); return; }
  if (c.inst.live) { const id = ++nid; c.inst.live.port.postMessage({type: 'on', id, n: n + c.inst.shift, vel: q(v2, .1), gv: v2, t, len: Math.round(len*sd()*20)/20}); c.inst.live.port.postMessage({type: 'off', id, t: t + len*sd()}); return; }
  if (c.inst.poly) c.inst.poly.play(n, t, len*sd(), v2); else nativeNote(c, c.inst.native, n + c.inst.shift, vel, nativeSet(c, c.inst.native, c.inst.set), t, len*sd(), fv); }
function duck(t){ if (st.eng && rets) for (const [k, r] of Object.entries(rets)) { duckAt(r.duck.gain, RET[k].duck, t); }
  for (const c of st.cols) { if (c.role === 'kick' || !c.ch) continue; const d = DUCKS[c.mix.duck][1]; if (!d) continue; duckAt(c.ch.duck.gain, d, t); } }
function barLine(step){
  for (const c of st.cols) if (c.ramp?.x) { c.rampAt = (c.rampAt ?? -1) + 1; const [a, b] = c.ramp.x, n = Math.max(1, (c.ramp.bars || 8) - 1); c.x = a + (b - a)*Math.min(1, c.rampAt/n); macros(c); }
  for (const c of st.cols) if (c.loopNext !== undefined) { c.loop = c.loopNext; delete c.loopNext; }
  if (st.hNext) { st.harmony = st.hNext; st.hNext = null; st.hStart = step; renderHarmony(); }
  let changed = false; for (const c of st.cols) if (c.next) { applyNext(c, step); changed = true; }
  arrBar(step);
  if (st.build) { const b = st.build; if (step >= b.at + b.bars*16) { glide(hp.frequency, 18, ctx.currentTime, .02); st.build = null; $('m-build').dataset.on = ''; } }
  if (st.drop && step >= st.drop.at + 16) { st.drop = null; $('m-drop').dataset.on = ''; }
  const bar = Math.floor((step - st.hStart)/16); st.bar = bar; $('chordNow').textContent = shortOf(st.harmony.bars[bar % st.harmony.bars.length]); $('barNow').textContent = `bar ${bar % st.harmony.bars.length + 1} of ${st.harmony.bars.length}`;
  if (st.take) takeBar(step);
  renderGround(); if (HV.tab === 'chords' && HV.open) renderMatrix(); if (changed) { renderParts(); renderCard(); } else renderPartGround(); }
async function start(){ initAudio(); await ctx.resume(); if (st.playing) return; st.playing = true; studio()?.playing?.('session'); st.step = 0; st.hStart = 0; st.pseed = Math.floor(Math.random()*1e9); for (const c of st.cols) { c.pm = {}; c.heard = []; } nextT = ctx.currentTime + .1;
  for (const c of st.cols) { if (c.next) applyNext(c, 0); c.start = 0; } timer = setInterval(tick, 25); tick(); $('play').textContent = 'Stop'; $('play').setAttribute('aria-pressed', 'true'); busy(); }
function stop(){ if (st.take) takeEnd(); st.playing = false; if (st.arr) { st.arr = null; renderArr(); } clearInterval(timer); $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); light(-1); if (st.rec) record(); busy(); }

/* ---------- a part's modules changing: now (stopped, or edited by hand) or on the next bar, keeping its place ---------- */
// what a part will be from the next bar (or is now): the tools build on this, so two quick taps add up
const shown = c => c.next || {R: c.R, N: c.N};
const voicesOf = c => isDrum(c.role) ? Object.keys(SND[c.sound]?.voices || {}) : [];
// a pack clip as a part's rhythm and notes (named after it, with its column's own feel)
function fromClip(c, clip, name){ const s = split(c.role, clip, name); s.rhythm.feel = c.feel0 || 0; return {R: s.rhythm, N: s.notes}; }
// a change: R or N left out keeps what's there; keep: the part carries on from where it is in its loop (else it starts
// again on the bar); now: heard straight away (an edit)
function setPart(c, ch, {keep = true, now = false, undo = true, preset, start} = {}){ const cur = shown(c), R = ch.R === undefined ? cur.R : ch.R, N = ch.N === undefined ? cur.N : ch.N;
  if (undo) pushUndo(c); if (preset !== undefined) c.preset = preset;
  c.next = {R, N, keep, start, clip: R ? join(c.role, R, N) : null}; prewarm(c);
  if (!st.playing || now) applyNext(c, st.playing ? null : 0); storeParts(); renderParts(); renderCard(); }
function applyNext(c, step){ const x = c.next; if (!x) return; delete c.next; c.R = x.R; c.N = x.N; c.clip = x.clip; c.pm = {};
  if (x.start != null) c.start = x.start; else if (!x.keep) c.start = step ?? Math.floor(st.step/16)*16; }
// undo: the modules as they were before the last change
function pushUndo(c){ const s = shown(c); (c.undo ??= []).push({R: s.R, N: s.N, preset: c.preset}); if (c.undo.length > 40) c.undo.shift(); }
function undo(){ const c = selCol(), u = c?.undo?.pop(); if (!u) { flash('Nothing to undo'); return; } c.preset = u.preset; setPart(c, {R: u.R, N: u.N}, {undo: false, now: !!st.edit}); flash('Undone'); }
const selCol = () => st.cols[st.sel];
const PART = c => ROLE_NAMES[c.role].replace('Bells and leads', 'Lead') + (c.role === 'lead' && st.cols.indexOf(c) > 5 ? ' 2' : '');

/* ---------- the pack's parts for each role (‹ › and ↑ ↓), its scenes ---------- */
function presetsOf(c){ const i = st.cols.indexOf(c), ids = [...new Set([...PACK.scenes.map(s => s.clips[i]), ...PACK.clips.filter(k => k.role === c.role).map(k => k.id)].filter(Boolean))]; return ids; }
function preset(c, id){ if (!id) { setPart(c, {R: null, N: null}, {keep: false, preset: null}); flash(`${PART(c)}: resting`); return; }
  const cl = CLIP[id]; if (cl.sound && !c.locked && SND[cl.sound]?.role === SND[c.sound].role && c.sound !== cl.sound) setSound(c, cl.sound);
  setPart(c, fromClip(c, cl, cl.name), {keep: false, preset: id}); flash(`${PART(c)}: ${cl.name}${st.playing ? ', next bar' : ''}`); }
function stepPreset(c, d){ const ids = [...presetsOf(c), null], i = ids.indexOf(c.preset === undefined ? null : c.preset); preset(c, ids[(i + d + ids.length) % ids.length]); }
function scene(i){ const sc = PACK.scenes[i]; if (!sc) return; if (st.cur) { keepEdit(); st.cur = null; renderSongBar(); } st.cols.forEach((c, j) => { const id = sc.clips[j] || null;
    if (!id) { setPart(c, {R: null, N: null}, {keep: false, preset: null}); return; } const cl = CLIP[id]; if (cl.sound && !c.locked && SND[cl.sound]?.role === SND[c.sound].role && c.sound !== cl.sound) setSound(c, cl.sound);
    setPart(c, fromClip(c, cl, cl.name), {keep: false, preset: id}); }); st.scene = i; renderScenes(); flash('Scene: ' + sc.name + (st.playing ? ', next bar' : '')); }
function setSound(c, id){ c.sound = id; if (ctx) { buildSound(c); prewarm(c); } renderParts(); if (c === selCol()) renderCard(); }

/* ---------- the tools: every module's verbs ---------- */
function rTool(k){ const c = selCol(), s = shown(c); if (c.role === 'chords' && !['new', 'vary', 'thin', 'half', 'double', 'longer', 'shorter', 'rotate', 'reverse'].includes(k)) return;
  const out = rhythmTool(k, c.role, s.R, s.N, Math.random, voicesOf(c));
  if (!out) { flash(!s.R ? 'Resting: New makes a rhythm' : k === 'double' ? '2× time needs an even length' : k === 'shorter' ? 'Too short to halve' : 'Four bars at most'); return; }
  let N = out.notes; if (!N && !s.N) N = defaultNotes(c, out.rhythm);   // (a resting part given a rhythm gets notes to play)
  setPart(c, {R: out.rhythm, ...(N ? {N} : {})}, {now: !!st.edit}); flash(`Rhythm: ${out.rhythm.name}${st.playing && !st.edit ? ', next bar' : ''}`); }
function nTool(k){ const c = selCol(), s = shown(c); if (c.role === 'chords') return;
  const out = notesTool(k, c.role, s.N, Math.random, {n: s.R?.hits.length || 8, voices: voicesOf(c)});
  if (!out) { flash(s.N ? 'Can’t do that to these notes' : 'New makes some notes'); return; }
  setPart(c, {N: out, ...(s.R ? {} : {R: defaultRhythm(c)})}, {now: !!st.edit}); flash(`Notes: ${out.name}${st.playing && !st.edit ? ', next bar' : ''}`); }
const defaultRhythm = c => fresh(spread(c.role, {kick: 4, hats: 8, perc: 5, bass: 5, chords: 2, lead: 5}[c.role], 16), 'Even rhythm');
const defaultNotes = (c, R) => c.role === 'chords' ? fresh({seq: []}, 'The ground') : notesTool('new', c.role, null, Math.random, {n: R.hits.length, voices: voicesOf(c)});
// even rhythms: hits − + and steps − + spread them again as evenly as they go
function spreadBy(dk, dn){ const c = selCol(), R = shown(c).R || defaultRhythm(c), [k, n, r] = R.spread || [R.hits.length, R.len, 0];
  const K = Math.max(1, Math.min(32, k + dk)), Nn = Math.max(2, Math.min(64, n + dn)), nR = fresh(spread(c.role, Math.min(K, Nn), Nn, r, R), `${Math.min(K, Nn)} over ${Nn}`);
  setPart(c, {R: nR, ...(shown(c).N ? {} : {N: defaultNotes(c, nR)})}, {now: !!st.edit}); flash(`Rhythm: ${Math.min(K, Nn)} hits spread over ${Nn} steps`); }
function nextFeel(){ const c = selCol(), R = shown(c).R; if (!R) return; setPart(c, {R: {...R, feel: ((R.feel || 0) + 1) % FEELS.length}}, {now: true}); logMacro(c, 'feel', c.R.feel); flash(`${PART(c)} feel: ${FEELS[c.R.feel].name}`); }
// Life: how much the part is played on (off, light, loose, wild); the chords hold the ground as they are
function setLife(c, v){ if (c.role === 'chords') return; c.play = v; c.pm = {}; c.lifeFrom = st.step; logMacro(c, 'play', c.play); prewarm(c); storeParts(); renderCard(); renderParts(); flash(`${PART(c)}: ${c.play ? 'played ' + PLAYS[c.play].name.toLowerCase() : 'as written'}`); }
// Keep that: what Life played over the last two bars or so, as the part's rhythm and notes
function keepPlayed(){ const c = selCol(); if (!c.clip || !c.play || !st.playing) { flash(c?.play ? 'Play it first' : 'Turn Life on first (P)'); return; }
  const lp = loopOf(c), L = lp ? lp[1] - lp[0] : c.clip.len, k = L >= 32 ? 1 : Math.max(1, Math.min(Math.floor(64/L), Math.ceil(32/L))), cyc = Math.floor((st.step - c.start)/L);
  const from = c.start + (cyc - k)*L; if (cyc < k || from < (c.lifeFrom ?? 0)) { flash('Let it play a little longer'); return; }
  const steps = keep(c.heard || [], from, L*k); if (!steps.length) { flash('Nothing played to keep'); return; }
  const s = split(c.role, {len: L*k, steps}); setPart(c, {R: named(c.R, {...s.rhythm, feel: c.R.feel}, 'as played'), N: c.role === 'chords' ? c.N : named(c.N, s.notes, 'as played')}, {now: true}); c.play = 0; logMacro(c, 'play', 0); renderCard(); flash('Kept what was played'); }
// a module named by hand: the name sticks, and what's made of it is named after it
function rename(k){ const c = selCol(), m = shown(c)[k]; if (!m) return; const name = prompt(`Name this ${k === 'R' ? 'rhythm' : 'set of notes'}`, m.name)?.trim(); if (!name) return;
  setPart(c, {[k]: fresh({...m}, name.slice(0, 40))}, {now: true}); }

/* ---------- singing a part in (sing.js): the microphone on the bar while the jam plays, or a voice memo ---------- */
// The take starts on a bar line after a beat's count-in and lasts the bars chosen; the part being sung is muted meanwhile.
// A pitched part's notes become rungs of the chords under each bar (so they follow the harmony, as every part does), moved
// by octaves into the part's register; a drum part's hits become its voices by where their energy lies. Undo takes it back.
function singOpen(v = !SG.open){ SG.open = v; renderSing(); }
function renderSing(){ const box = $('singBar'), c = selCol(); if (!box) return; box.hidden = !SG.open || !c; $('singB').setAttribute('aria-pressed', String(SG.open)); if (box.hidden) return; box.innerHTML = '';
  const drum = isDrum(c.role), what = c.role === 'chords' ? null : drum ? 'Beatbox it: “boom” low, “tss” high, “ka” in between' : 'Sing or hum it: one note at a time';
  if (!what) { box.append(h('span', {class: 'muted'}, 'The chords part plays the ground’s chords: sing into the bass or a lead.')); return; }
  box.append(h('div', {class: 'singrow'}, h('b', {}, '🎤 ' + PART(c)), h('span', {class: 'muted'}, what)),
    h('div', {class: 'singrow'}, h('span', {class: 'lab'}, 'Bars'), ...[1, 2, 4, 8].map(b => h('button', {class: 'seg', 'aria-pressed': String(SG.bars === b), onclick: () => { SG.bars = b; renderSing(); }}, String(b))),
      h('button', {class: 'tool sing', disabled: SG.busy ? '' : null, onclick: singMic}, SG.rec ? '● Singing…' : '● Sing on the next bar'),
      h('label', {class: 'tool'}, 'Voice memo…', h('input', {type: 'file', accept: 'audio/*', hidden: '', onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) singFile(f); }})),
      SG.rec ? h('button', {class: 'mini', onclick: () => singStop(true)}, 'Cancel') : ''),
    h('div', {class: 'words', id: 'singMsg'}, SG.msg || 'Headphones help: the jam keeps playing while you sing, and the microphone should hear only you.'),
    SG.heard ? h('div', {class: 'words singheard'}, SG.heard) : ''); }
const singSay = m => { SG.msg = m; const e = $('singMsg'); if (e) e.textContent = m; };
async function singMic(){ const c = selCol(); if (SG.rec || !c || c.role === 'chords') return; initAudio(); await ctx.resume();
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: false, autoGainControl: false}}); }
  catch (e) { singSay(`The microphone isn’t allowed here (${e.name === 'NotAllowedError' ? 'inside claude.ai a page never gets it' : e.message}). Record a voice memo on your phone, in time with the jam, and load it with Voice memo….`); return; }
  if (!st.playing) await start();
  // the bar it starts on: after at least a beat of count-in; the scheduler's nextT is when its step st.step plays
  const B = Math.ceil((st.step + 4)/16)*16, barT = nextT + (B - st.step)*sd(), dur = SG.bars*16*sd(), tr = stream.getAudioTracks()[0], inLat = tr.getSettings?.().latency ?? .02;
  const lat = (ctx.outputLatency || ctx.baseLatency || 0) + inLat, src = ctx.createMediaStreamSource(stream), sp = ctx.createScriptProcessor(2048, 1, 1), sink = ctx.createGain(); sink.gain.value = 0;
  const chunks = []; sp.onaudioprocess = e => chunks.push({t: e.playbackTime - 2048/ctx.sampleRate, x: e.inputBuffer.getChannelData(0).slice()});
  src.connect(sp); sp.connect(sink); sink.connect(ctx.destination);
  const wasMute = c.mute; c.mute = true; macros(c); renderParts();
  SG.rec = {c, stream, src, sp, sink, wasMute, B, barT, dur, lat, chunks}; renderSing();
  const tick = () => { if (!SG.rec) return; const now = ctx.currentTime, beat = 4*sd();
    if (now < barT) singSay(`Sing in ${Math.max(1, Math.ceil((barT - now)/beat))}…`); else if (now < barT + dur) singSay(`● Singing: bar ${Math.floor((now - barT)/(16*sd())) + 1} of ${SG.bars}`);
    else if (now > barT + dur + lat + .3) { singStop(false); return; } SG.rec.tm = setTimeout(tick, 60); }; tick(); }
function singStop(cancel){ const R = SG.rec; if (!R) return; SG.rec = null; clearTimeout(R.tm); try { R.sp.disconnect(); R.src.disconnect(); R.sink.disconnect(); } catch {} R.stream.getTracks().forEach(t => t.stop());
  R.c.mute = R.wasMute; macros(R.c); renderParts();
  if (cancel) { singSay('Cancelled'); renderSing(); return; }
  // the take from a little before its bar to a little after, as heard by the singer (the speakers' and the microphone's delay)
  const sr = ctx.sampleRate, from = R.barT + R.lat - .1, n = Math.ceil((R.dur + .35)*sr), x = new Float32Array(n);
  for (const k of R.chunks) { const o = Math.round((k.t - from)*sr); for (let i = 0; i < k.x.length; i++) { const j = o + i; if (j >= 0 && j < n) x[j] = k.x[i]; } }
  singRead(R.c, x, sr, {t0: .1, bars: SG.bars, B: R.B}); }
async function singFile(f){ const c = selCol(); if (!c || c.role === 'chords') return; initAudio(); singSay('Reading the memo…');
  try { const ab = await ctx.decodeAudioData(await f.arrayBuffer()), x = new Float32Array(ab.length);
    for (let ch = 0; ch < ab.numberOfChannels; ch++) { const y = ab.getChannelData(ch); for (let i = 0; i < x.length; i++) x[i] += y[i]/ab.numberOfChannels; }
    singRead(c, x, ab.sampleRate, {}); }
  catch (e) { singSay('Couldn’t read that file (' + e.message + ')'); } }
// what was heard, into the part: a memo starts on its first note and fills whole bars; a take from the microphone is placed
// on the bar it was sung over, so its notes meet the chords they were sung against
function singRead(c, x, sr, {t0, bars, B}){ const six = sd(), drum = isDrum(c.role);
  let ev = drum ? hitsOf(x, sr) : notesOf(track(x, sr));
  if (!ev.length) { singSay(drum ? 'No hits heard: nearer the microphone, and sharper (“boom”, “tss”, “ka”)' : 'No notes heard: sing or hum a little louder, one note at a time'); return; }
  if (t0 == null) { t0 = ev[0].t; bars = Math.min(16, barsFor(Math.max(...ev.map(e => e.t + (e.dur || 0))) - t0, 16*six)); }
  const steps = bars*16, g = grid(ev, {six, t0, steps}); ev = g.ev; if (!ev.length) { singSay('Nothing landed inside the bars'); return; }
  if (B == null) B = st.playing ? Math.ceil(st.step/16)*16 : 0;
  const top = Math.max(...ev.map(e => e.rms)), vel = e => +(.4 + .6*e.rms/top).toFixed(2), R = {len: steps, hits: ev.map(e => [e.step, drum ? 1 : e.len, vel(e)]), feel: 0, name: drum ? 'Beatboxed' : 'Sung', base: drum ? 'Beatboxed' : 'Sung', ops: []};
  let seq, heard;
  if (drum) { seq = ev.map(e => drumVoice(c, e)); const n = k => ev.filter(e => e.kind === k).length; heard = `Heard ${ev.length} hits: ${n('lo')} low, ${n('mid')} middle, ${n('hi')} high`; }
  else { const H = st.harmony, hb = j => Math.floor((B - st.hStart)/16) + j;
    // the whole line moved by octaves to sit where the part plays (round its rung 2), then each note to its nearest rung
    const ms = ev.map(e => e.midi).sort((a, b) => a - b), mid = ms[ms.length >> 1], c0 = chordOf(H, hb(0)), want = REGISTER[c.role](c0) + 4 + 12*(c.oct || 0), shift = 12*Math.round((want - mid)/12);
    seq = ev.map(e => [rungFor(c, e.midi + shift - 12*(c.oct || 0), hb(Math.floor(e.step/16))), 0]);
    const off = ev.filter(e => Math.abs(e.cents) > 35).length;
    heard = `Heard ${ev.length} notes: ${ev.map(e => noteName(e.midi)).join(' ')}${shift ? `, moved ${Math.abs(shift/12)} octave${Math.abs(shift) > 12 ? 's' : ''} ${shift > 0 ? 'up' : 'down'}` : ''}; each snapped to the nearest chord tone under it${off ? ` (${off} sung between two notes)` : ''}`; }
  const N = {seq, name: R.name, base: R.name, ops: []};
  setPart(c, {R, N}, {start: B, now: !st.playing}); SG.heard = heard + ` · ${bars} bar${bars > 1 ? 's' : ''}, nudged ${Math.round(g.nudge*1000)} ms onto the 16ths. Undo (Z) takes it back.`;
  singSay(st.playing ? 'In from the next bar' : 'Done: press Play to hear it'); renderSing(); flash(drum ? 'Beatboxed in' : 'Sung in'); }
// the rung whose note, over this bar's chord as the part plays it, is nearest the sung one
function rungFor(c, midi, bar){ const H = st.harmony, ch = chainOf(H), i = ((bar % H.bars.length) + H.bars.length) % H.bars.length, chd = chordOf(H, bar); let best = 0, bd = 1e9;
  for (let k = -12; k <= 24; k++) { const n = notesAt({role: c.role, steps: [[0, k, 1, 1]]}, 0, chd, {vl: ch && ch[i], inv: c.inv || 0, walk: 0})[0]?.[0]; if (n == null) continue; const dd = Math.abs(n - midi) + (k < 0 ? .01 : 0); if (dd < bd) { bd = dd; best = k; } }
  return best; }
// a hit's voice in a drum part: the kick's kick, the hats' closed or (rung long) open hat, the percussion's lowest, middle or
// highest voice by where the hit's energy lay
const PITCH = {gong: 0, tomL: 1, log: 1, bowl: 2, tomH: 3, logH: 3, hand: 3, wood: 4, rim: 4, clave: 5, metal: 6, shaker: 7};
function drumVoice(c, e){ const vs = Object.keys(SND[c.sound]?.voices || {});
  if (c.role === 'kick') return 'kick';
  if (c.role === 'hats') return e.dur > .14 && vs.includes('ohh') ? 'ohh' : 'chh';
  const ord = vs.filter(v => v in PITCH).sort((a, b) => PITCH[a] - PITCH[b]); if (!ord.length) return VOICE0.perc;
  return e.kind === 'lo' ? ord[0] : e.kind === 'hi' ? ord[ord.length - 1] : ord[Math.floor((ord.length - 1)/2)]; }

/* ---------- moves ---------- */
const MOVES = {
  build(){ if (!st.playing || st.build) return; const at = Math.ceil(st.step/16)*16, bars = 4, t = ctx.currentTime + (at - st.step)*sd();
    hp.frequency.setValueAtTime(18, t); hp.frequency.exponentialRampToValueAtTime(1400, t + bars*16*sd()); st.build = {at, bars}; riser(t, bars*16*sd()); $('m-build').dataset.on = '1'; flash('Building for 4 bars'); },
  drop(){ if (!st.playing) return; st.drop = {at: Math.ceil(st.step/16)*16}; $('m-drop').dataset.on = '1'; flash('Drop: a bar of air, then back'); },
  harmony(){ const hs = PACK.harmonies, i = hs.indexOf(st.hNext || st.harmony); setHarmony(hs[(i + 1) % hs.length].id); },
};
function riser(t, dur){ const n = ctx.createBuffer(2, ctx.sampleRate*2, ctx.sampleRate); for (let c = 0; c < 2; c++) { const x = n.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = Math.random()*2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = n; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.4; s.connect(f); f.connect(g); g.connect(master);
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .03); s.start(t); s.stop(t + dur + .05); }
function repeat(on){ if (on && st.playing && !st.rep) { st.rep = {at: Math.floor(st.step/4)*4, len: 4}; $('m-rep').dataset.on = '1'; } if (!on && st.rep) { st.rep = null; $('m-rep').dataset.on = ''; } }

/* ---------- recording: what plays, written down for Claude to render ---------- */
function record(){ if (!st.rec) { if (!st.playing) start(); st.rec = {from: Math.ceil(st.step/16)*16, notes: [], macros: [], bpm: st.bpm, swing: st.swing, echoDiv: st.echoDiv, mix: st.cols.map(c => ({...c.mix, mute: !!c.mute})), mx: {...st.mx}, eng: st.eng, harmonies: []}; $('rec').setAttribute('aria-pressed', 'true'); flash('Recording from the next bar'); return; }
  const r = st.rec; st.rec = null; $('rec').setAttribute('aria-pressed', 'false'); r.bars = Math.ceil((st.step - r.from)/16); lastTake = r; $('keepJam').disabled = !db || !r.notes.length;
  $('takeNote').textContent = r.notes.length ? `Take: ${r.bars} bars, ${r.notes.length} notes. Keep it for Claude to render, or record again.` : 'Nothing was recorded.'; }
/* ---------- into the arrangement: what plays written down as a song, a section each time it changes (a scene, a part, the
   ground), and handed to the Studio DAW, the Studio page's other view, as notes to edit ---------- */
const studio = () => { try { return parent !== window ? parent.__studio : null; } catch { return null; } };
// the scene as it is on this bar line: its ground turned to start on this bar's chord, and each part's place in its loop
function takeSection(step){ const x = capture(), G = st.harmony, n = G.bars.length, hb = ((Math.floor((step - st.hStart)/16) % n) + n) % n;
  x.harmonyBars = [...G.bars.slice(hb), ...G.bars.slice(0, hb)];
  x.cols.forEach((v, i) => { const c = st.cols[i]; if (!c?.clip) return; const lp = loopOf(c), span = lp ? lp[1] - lp[0] : c.clip.len; v.phase = (((step - c.start) % span) + span) % span; });
  return x; }
const takeSig = x => JSON.stringify([x.cols.map(({phase, ...v}) => v), x.harmony, x.bpm]);
function takeBar(step){ const T = st.take, x = takeSection(step), sig = takeSig(x), last = T.secs[T.secs.length - 1];
  if (last && last.sig === sig) { last.bars++; return; }
  const name = st.scene != null && PACK.scenes[st.scene] ? PACK.scenes[st.scene].name : SNAPS.find(y => y.id === snapOn)?.name || `Part ${T.secs.length + 1}`;
  T.secs.push({...x, bars: 1, sig, name}); }
function takeToggle(){ if (st.take) { takeEnd(); return; } st.take = {secs: []}; if (!st.playing) start(); $('take').setAttribute('aria-pressed', 'true'); flash('Into the arrangement from the next bar'); }
function takeEnd(){ const T = st.take; st.take = null; $('take').setAttribute('aria-pressed', 'false'); if (!T.secs.length) { flash('Nothing yet: it starts on a bar line'); return; }
  const d = new Date(), name = `Jam ${d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} ${d.toTimeString().slice(0, 5)}`;
  toArrangement(T.secs, name); }
// sections ({…a scene, bars, name}) as one of the DAW's songs
function toArrangement(secs, name){ const id = 'take-' + Date.now().toString(36);
  const song = {id, kind: 'take', name, bpm: st.bpm, pack: PACK.id, at: new Date().toISOString(),
    sections: secs.map(({sig, ...x}, i) => ({...x, id: `${id}.${i + 1}`, name: `${name}: ${x.name}`, bars: x.bars}))};
  lastSong = song; const S = studio(); if (S?.toArrangement) { S.toArrangement(song); return song; }
  try { const all = JSON.parse(localStorage.getItem('studio.takes') || '[]'); all.unshift(song); localStorage.setItem('studio.takes', JSON.stringify(all.slice(0, 40))); } catch {}
  if (db) db.collection('takes').doc(id).set(JSON.parse(JSON.stringify(song))).catch(() => {});
  flash(`Kept ${name}: open the Studio’s arrangement to edit it`); return song; }
let lastSong = null; window.__jamSong = () => lastSong;   // (for tests)
$('take').onclick = () => takeToggle();
// your song (the scenes in order) into the arrangement
$('arrDaw').onclick = () => { const secs = ARR.map(e => { const x = byRef(e.ref); return x?.cols && {...JSON.parse(JSON.stringify(x)), bars: e.bars, name: x.name || 'Scene'}; }).filter(Boolean);
  if (!secs.length) { flash('Put scenes in the song first (＋ Song)'); return; } toArrangement(secs, 'Your song ' + new Date().toTimeString().slice(0, 5)); };
window.__studioView = {stop: () => { if (st.playing) stop(); }, name: 'session'};
let lastTake = null; window.__jamTake = () => lastTake && {...lastTake, columns: st.cols.map(c => ({id: c.id, role: c.role}))};   // (for tests)
const logMacro = (c, k, v) => st.rec?.macros.push([Math.max(0, st.step - st.rec.from), c.id, k, +(+v).toFixed(3)]);
const logMaster = (k, v) => st.rec?.macros.push([Math.max(0, st.step - st.rec.from), '*', 'master.' + k, v]);
let flashT = 0; function flash(t){ $('flash').textContent = t; clearTimeout(flashT); flashT = setTimeout(() => $('flash').textContent = '', 1800); }

/* ---------- the parts: a row each (its rhythm at a glance, its sound, the pack's parts with ‹ ›), the chosen one lit ---------- */
function renderParts(){ const box = $('parts'); if (!box || !st.cols.length) return; box.innerHTML = '';
  st.cols.forEach((c, i) => { const s = shown(c), pend = !!c.next;
    const row = h('div', {class: 'prow', 'data-sel': i === st.sel ? '1' : '', 'data-rest': s.R ? '' : '1', 'data-mute': c.mute ? '1' : '', 'data-next': pend ? '1' : '', 'data-part': c.id});
    let held = null, long = false; const pick = h('button', {class: 'pname', title: 'Choose this part (hold to mute)'}, h('span', {class: 'pk'}, h('kbd', {}, 'QWERTYU'[i]), ' ', h('b', {}, PART(c)), c.play ? h('span', {class: 'life'}, ' ♪') : ''),
      h('span', {class: 'psk'}, s.R ? sketch(s.R) : 'resting'), h('span', {class: 'psub'}, (c.mute ? 'muted · ' : '') + (SND[c.sound]?.name || '')));
    pick.addEventListener('pointerdown', () => { long = false; held = setTimeout(() => { long = true; c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderParts(); renderCard(); flash(`${PART(c)} ${c.mute ? 'muted' : 'back in'}`); navigator.vibrate?.(15); }, 450); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) pick.addEventListener(ev, () => clearTimeout(held));
    pick.onclick = () => { if (long) return; st.sel = i; renderParts(); renderCard(); };
    row.append(pick, h('span', {class: 'pnav'}, h('button', {class: 'mini', 'aria-label': 'The pack’s part before', title: 'The pack’s parts for this role', onclick: () => { st.sel = i; stepPreset(c, -1); }}, '‹'),
      h('button', {class: 'mini', 'aria-label': 'The pack’s next part', title: 'The pack’s parts for this role', onclick: () => { st.sel = i; stepPreset(c, 1); }}, '›'),
      h('button', {class: 'mini mbtn', 'aria-pressed': String(!!c.mute), 'aria-label': 'Mute ' + PART(c), onclick: () => { c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderParts(); renderCard(); }}, 'M')),
      h('i', {class: 'ph'})); box.append(row); }); }

/* ---------- the card: the chosen part, its four modules on tabs, Life ---------- */
const TABS4 = [['rhythm', 'Rhythm', 'when'], ['notes', 'Notes', 'what'], ['sound', 'Sound', 'how'], ['space', 'Space', 'where']];
function renderCard(){ const c = selCol(); if (!c) return; const s = shown(c);
  $('cardPart').textContent = `Part · key ${'QWERTYU'[st.sel]}`; $('cardName').textContent = PART(c);
  $('cardSub').textContent = !s.R ? 'Resting: New makes it a rhythm, or take one from the library' : [s.R.name, c.role === 'chords' ? 'the ground’s chords' : s.N?.name, SND[c.sound]?.name].filter(Boolean).join(' · ') + (c.next ? ' · from the next bar' : '');
  $('cardMute').textContent = c.mute ? 'Muted' : 'Mute'; $('cardMute').setAttribute('aria-pressed', String(!!c.mute)); $('savePart').disabled = !s.R;
  const L = $('life'); L.innerHTML = ''; L.hidden = c.role === 'chords'; $('keepB').hidden = c.role === 'chords';
  L.append(h('span', {class: 'lab'}, 'Life'), ...PLAYS.map((p, v) => h('button', {class: 'seg', 'aria-pressed': String((c.play || 0) === v), title: v ? `Played ${p.name.toLowerCase()}: notes left out, ghost notes, fills, the loudness moving (P)` : 'As written', onclick: () => setLife(c, v)}, p.name)));
  $('keepB').disabled = !c.play;
  const T = $('ctabs'); T.innerHTML = ''; for (const [k, lab, w] of TABS4) T.append(h('button', {role: 'tab', 'aria-selected': String(st.tab === k), onclick: () => { st.tab = k; try { localStorage.setItem('studio.jam.ctab', k); } catch {} renderCard(); }},
    h('b', {}, lab), h('small', {}, k === 'rhythm' ? s.R ? `${s.R.hits.length} hits · ${lenWords(s.R.len)}` : 'resting' : k === 'notes' ? c.role === 'chords' ? 'the ground' : s.N ? `${s.N.seq.length} notes` : '—' : k === 'sound' ? SND[c.sound]?.name || '' : w)));
  for (const [k] of TABS4) $('p-' + k).hidden = st.tab !== k;
  renderPartGround();
  renderPartLikes(); renderSing();
  if (st.tab === 'rhythm') renderRhythm(c); else if (st.tab === 'notes') renderNotes(c); else if (st.tab === 'sound') renderSound(c); else renderSpace(c); }
const lenWords = n => n % 16 ? n + ' steps' : n/16 + (n > 16 ? ' bars' : ' bar');
const btn = (lab, fn, o = {}) => h('button', {class: 'tool' + (o.cls ? ' ' + o.cls : ''), title: o.title || '', 'data-on': o.on ? '1' : '', ...(o.disabled ? {disabled: ''} : {}), onclick: fn}, lab, o.key ? h('small', {}, o.key) : '');
const RT = {new: 'A new rhythm for this part (N)', vary: 'A small change: a hit moved, added or dropped (V)', develop: 'A A′ A B: the rhythm, a variation, the rhythm, an answer', thin: 'Fewer hits', fill: 'A soft hit in the gaps', half: 'Everything twice as long', double: 'Twice as fast, played twice', longer: 'Twice as long, to change the second half', shorter: 'Only its first half', rotate: 'Every hit a 16th later', reverse: 'Back to front'};
function nameRow(box, m, k, it){ box.append(h('div', {class: 'mhead'}, h('b', {class: 'mname'}, m ? m.name : '—'), m ? h('button', {class: 'mini', title: 'Name it', onclick: () => rename(k)}, '✎') : '',
  m ? h('button', {class: 'mini', title: 'Into your library', onclick: () => saveModule(k)}, '＋ Library') : '', h('span', {class: 'spacer'}), it ? likeBar(it) : '')); }
function renderRhythm(c){ const box = $('rTools'), s = shown(c), R = s.R; $('rHead').innerHTML = ''; nameRow($('rHead'), R, 'R', R && rhythmItem(c.role, R)); box.innerHTML = '';
  const tools = c.role === 'chords' ? ['new', 'vary', 'thin', 'half', 'double', 'longer', 'shorter', 'rotate', 'reverse'] : Object.keys(RHYTHM_TOOLS);
  for (const k of tools) box.append(btn(RHYTHM_TOOLS[k], () => rTool(k), {title: RT[k], key: {new: 'N', vary: 'V'}[k]}));
  const [k0, n0] = R?.spread || [R?.hits.length || 0, R?.len || 16];
  $('rInfo').innerHTML = ''; $('rInfo').append(h('div', {class: 'stepper'}, h('span', {class: 'lab'}, 'Hits'), h('button', {class: 'mini', 'aria-label': 'Fewer hits', onclick: () => spreadBy(-1, 0)}, '−'), h('b', {}, String(k0)), h('button', {class: 'mini', 'aria-label': 'More hits', onclick: () => spreadBy(1, 0)}, '+')),
    h('div', {class: 'stepper'}, h('span', {class: 'lab'}, 'Steps'), h('button', {class: 'mini', 'aria-label': 'Fewer steps', onclick: () => spreadBy(0, -1)}, '−'), h('b', {}, String(n0)), h('button', {class: 'mini', 'aria-label': 'More steps', onclick: () => spreadBy(0, 1)}, '+')),
    btn('Feel: ' + FEELS[R?.feel || 0].name, nextFeel, {key: 'F', title: 'How it grooves: accents, swing, ahead or behind (F)', disabled: !R}),
    btn(st.edit ? '✎ Editing' : '✎ Edit', () => toggleEdit(), {on: st.edit, title: 'Tap to add or take away, drag to move, drag the end for length, hold for loudness'}),
    btn('↶ Undo', undo, {key: 'Z'}));
  $('rWords').textContent = R ? `${R.hits.length} hits over ${lenWords(R.len)}${R.spread ? ', spread evenly' : ''}${c.next ? ' · from the next bar' : ''}` : 'Resting. New makes a rhythm; Hits + spreads some evenly.';
  drawRhythm(); renderLoop(); }
function renderNotes(c){ const box = $('nTools'), s = shown(c), N = s.N; $('nHead').innerHTML = ''; box.innerHTML = ''; $('nInfo').innerHTML = '';
  if (c.role === 'chords') { $('nHead').append(h('div', {class: 'mhead'}, h('b', {class: 'mname'}, 'The ground’s chords'), h('span', {class: 'muted'}, ' · the chords part plays the harmony; its rhythm says when')));
    box.append(btn('Voicing: ' + STYLES[c.voicing || 0], () => { c.voicing = ((c.voicing || 0) + 1) % STYLES.length; logMacro(c, 'voicing', c.voicing); for (const x of st.cols) prewarm(x); renderCard(); flash('Voicing: ' + STYLES[c.voicing]); }),
      btn('▲ Inversion', () => inv(c, 1)), btn('▼ Inversion', () => inv(c, -1)),
      btn('Arp: ' + (ARPS[c.arp || 0] || 'off'), () => { c.arp = ((c.arp || 0) + 1) % ARPS.length; c.arpSt = null; logMacro(c, 'arp', c.arp); prewarm(c); renderCard(); flash('Arp: ' + (ARPS[c.arp] || 'off')); }, {on: c.arp}),
      octBtns(c), btn(st.smooth ? 'Smooth voice leading' : 'Each chord on its own', toggleSmooth, {on: st.smooth}));
    $('nWords').textContent = `${STYLES[c.voicing || 0]} voicing${c.inv ? `, inversion ${c.inv > 0 ? '+' : ''}${c.inv}` : ''}${c.arp ? ', arpeggiated ' + ARPS[c.arp] : ''}${st.smooth ? ', voice-led' : ''}`; drawNotes(); return; }
  nameRow($('nHead'), N, 'N', N && notesItem(c.role, N));
  for (const k of noteTools(c.role)) box.append(btn(NOTE_TOOLS[k], () => nTool(k), {key: {new: 'Shift N', vary: 'Shift V'}[k]}));
  if (!isDrum(c.role)) $('nInfo').append(octBtns(c), btn('Walk' + (c.walk ? ': on' : ''), () => { c.walk = !c.walk; logMacro(c, 'walk', c.walk ? 1 : 0); prewarm(c); renderCard(); flash(c.walk ? 'Walk: climbing a chord tone each time round' : 'Walk off'); }, {on: c.walk, title: 'Climb a chord tone each time round'}));
  $('nInfo').append(btn(st.edit ? '✎ Editing' : '✎ Edit', () => toggleEdit(), {on: st.edit, title: 'Tap a cell to set that note, hold a note to lift it an octave'}), btn('↶ Undo', undo, {key: 'Z'}));
  const R = s.R; $('nWords').textContent = !N ? 'No notes yet: New makes some.' : !R ? `${N.seq.length} notes, waiting for a rhythm` : linked(R, N) ? `${N.seq.length} notes, one for each hit` :
    `${N.seq.length} notes over ${R.hits.length} hits: round ${cycles(R, N)} times (${lenWords(R.len*cycles(R, N))}) before they line up again`;
  drawNotes(); }
const octBtns = c => h('span', {class: 'stepper'}, h('span', {class: 'lab'}, 'Octave'), h('button', {class: 'mini', 'aria-label': 'Octave down', onclick: () => octave(-1)}, '−'), h('b', {}, (c.oct > 0 ? '+' : '') + (c.oct || 0)), h('button', {class: 'mini', 'aria-label': 'Octave up', onclick: () => octave(1)}, '+'));
function inv(c, d){ c.inv = Math.max(-3, Math.min(3, (c.inv || 0) + d)); logMacro(c, 'inv', c.inv); prewarm(c); renderCard(); flash(`Inversion ${c.inv > 0 ? '+' : ''}${c.inv}`); }
const octave = d => { const c = selCol(); if (isDrum(c.role)) return; c.oct = Math.max(-2, Math.min(2, (c.oct || 0) + d)); logMacro(c, 'oct', c.oct); prewarm(c); storeParts(); renderCard(); flash(`Octave ${c.oct > 0 ? '+' : ''}${c.oct}`); };
function toggleSmooth(){ st.smooth = !st.smooth; try { localStorage.setItem('studio.jam.smooth', st.smooth ? '1' : '0'); } catch {} for (const c of st.cols) { c.arpSt = null; prewarm(c); } renderCard(); renderHarmony(); flash(st.smooth ? 'Smooth voice leading: every part glides between chords' : 'Free: each chord voiced on its own'); }
function toggleEdit(){ st.edit = !st.edit; const c = selCol(); if (st.edit && c.next) applyNext(c, null); c.edRange = null; renderCard(); flash(st.edit ? (st.tab === 'notes' ? 'Tap a cell to set a note; hold a note for an octave up' : 'Tap to add or take away, drag to move, drag the end for length, hold for loudness') : 'Editing off'); }

// the ground under the chosen part: the chord each of its bars lands on, and when its loop is shorter than the ground,
// each time round (now, next …) till the chords line up again, the bar playing lit
const gcd2 = (a, b) => b ? gcd2(b, a % b) : a;
function renderPartGround(){ const box = $('partGround'), c = selCol(); if (!box || !c || !st.harmony) return; box.innerHTML = '';
  const H = st.hNext || st.harmony, G = H.bars.length, clip = c.next?.clip || c.clip, live = st.playing && c.clip && !c.next;
  const lab = h('span', {class: 'lab'}, 'Chords under it'); if (!clip) { box.append(lab, h('span', {class: 'muted'}, 'Resting.')); return; }
  const cell = (sym, on, w = 1) => h('span', {class: 'pgc', 'data-on': on ? '1' : '', style: `flex:${w}`, title: nameOf(sym)}, shortOf(sym));
  if (clip.len % 16) { const gb = ((Math.floor(((st.playing ? st.step : 0) - st.hStart)/16) % G) + G) % G;
    box.append(h('div', {class: 'pghead'}, lab, h('span', {class: 'muted'}, `${lenWords(clip.len)}: not whole bars, so it drifts across the chords, meeting each one at a new place every time round`)),
      h('div', {class: 'pgrow'}, h('span', {class: 'pgr'}, ''), ...H.bars.map((sym, i) => cell(sym, st.playing && i === gb)))); return; }
  const B = clip.len/16, rounds = Math.min(4, B*G/gcd2(B, G)/B), pos = live ? posOf(c, st.step) : 0, start = (st.playing ? st.step : 0) - pos;
  const gb0 = Math.floor((start - st.hStart)/16), cur = Math.floor(pos/16), at = k => H.bars[((gb0 + k) % G + G) % G];
  box.append(h('div', {class: 'pghead'}, lab, h('span', {class: 'muted'}, G === 1 ? `one chord, ${shortOf(H.bars[0])}, under all of it` : rounds === 1 ? `its ${B} bar${B > 1 ? 's' : ''} meet the same chords every time round` :
    `its ${B}-bar loop over the ground's ${G} bars: the same notes meet new chords, ${rounds} times round before they line up again${B*G/gcd2(B, G)/B > 4 ? ' (the first 4 shown)' : ''}`)));
  // (a loop of a bar or two goes round too often for rows: one row across the ground, a mark where it starts again)
  if (B <= 2 && rounds > 1) { const L = Math.min(16, B*G/gcd2(B, G)), k0 = live ? Math.floor(pos/16) : -1;
    box.lastChild.lastChild.textContent = `its ${B}-bar loop goes round across the ground's ${G} bars, meeting a new chord each time`;
    box.append(h('div', {class: 'pgrow'}, h('span', {class: 'pgr'}, st.playing ? 'from now' : ''), ...Array.from({length: L}, (_, k) => { const e = cell(at(k), live && k === k0); if (k && k % B === 0) e.dataset.loop = '1'; return e; }))); return; }
  for (let r = 0; r < rounds; r++) box.append(h('div', {class: 'pgrow', 'data-now': r === 0 && st.playing ? '1' : ''}, h('span', {class: 'pgr'}, rounds === 1 ? '' : r === 0 ? (st.playing ? 'now' : '1st') : r === 1 ? (st.playing ? 'next' : '2nd') : ['', '', '3rd', '4th'][r]),
    ...Array.from({length: B}, (_, b) => cell(at(r*B + b), live && r === 0 && b === cur)))); }
// sound: the library's sounds for this role, and its tone, length and motion
function renderSound(c){ const box = $('soundList'); box.innerHTML = ''; $('sHead').innerHTML = ''; nameRow($('sHead'), {name: SND[c.sound]?.name}, null, soundItem(c.sound)); $('sHead').querySelectorAll('.mini').forEach(b => b.remove());
  const mine = LIB.filter(s => s.role === c.role), groups = [PACK.id, ...new Set(mine.map(s => s.pack).filter(p => p !== PACK.id))];
  for (const g of groups) { const list = mine.filter(s => s.pack === g); if (!list.length) continue; box.append(h('div', {class: 'lab sndgroup'}, (ALLPACKS.find(p => p.id === g)?.name.split(':')[0] || g) + (g === PACK.id ? ' (this pack)' : '')));
    for (const s of list) box.append(h('button', {class: 'snd', 'data-on': s.id === c.sound ? '1' : '', title: s.words || '', onclick: () => { c.locked = true; setSound(c, s.id); saveSounds(); logMacro(c, 'sound:' + s.id, 1); flash('Sound: ' + s.name); }}, h('b', {}, s.name), h('span', {class: 'muted'}, s.words || ''))); }
  const S = $('sKnobs'); S.innerHTML = ''; S.append(slider('Tone', c.x, 0, 1, .01, v => { c.x = v; macros(c); logMacro(c, 'x', v); clearTimeout(slider.t); slider.t = setTimeout(() => prewarm(c), 150); storeParts(); }, ['dark', 'bright']),
    seg('Length', ['short', 'normal', 'long'], c.length, v => { c.length = v; lengthTo(c); logMacro(c, 'length', v); prewarm(c); storeParts(); renderCard(); }),
    seg('Motion', ['still', 'slow', 'fast', 'pulse'], c.motion, v => { c.motion = v; macros(c); logMacro(c, 'motion', v); storeParts(); renderCard(); }),
    btn('Pack sounds', packSounds, {title: 'Put this pack’s own sounds back on every part'})); }
// space: how loud, where across, how near or far; the echo and reverb; throw; how hard the kick ducks it
function renderSpace(c){ const S = $('spKnobs'), M = c.mix; S.innerHTML = '';
  S.append(slider('Level', M.vol, -30, 6, .5, v => mixSet(c, 'vol', v, true), ['−30 dB', '+6'], fmtDb), slider('Pan', M.pan, -1, 1, .05, v => mixSet(c, 'pan', v, true), ['left', 'right'], fmtPan),
    slider('Near ↔ far', c.y, 0, 1, .01, v => { c.y = v; macros(c); logMacro(c, 'y', v); storeParts(); }, ['dry, close', 'wet, far']),
    h('div', {class: 'toolrow'}, btn('Echo: ' + (c.echo ? 'on' : 'off'), () => sendTog('echo'), {on: c.echo, key: 'G'}), btn('Reverb: ' + (c.verb ? 'on' : 'off'), () => sendTog('verb'), {on: c.verb, key: 'K'}),
      throwBtn(), btn('Echo time: ' + ECHO[st.echoDiv][0], echoTime, {title: 'The echo’s time, for every part'})),
    c.role === 'kick' ? h('span', {class: 'muted'}, 'The kick drives the duck on the other parts.') : seg('Duck', DUCKS.map(d => d[0].toLowerCase()), M.duck, v => mixSet(c, 'duck', v), 'How far the kick pushes it down (sidechain)')); }
function slider(lab, v, min, max, stepV, set, ends, fmt){ const out = h('b', {class: 'sval'}, fmt ? fmt(v) : ''), r = h('input', {type: 'range', min, max, step: stepV, value: v, 'aria-label': lab});
  r.oninput = () => { set(+r.value); if (fmt) out.textContent = fmt(+r.value); }; r.ondblclick = () => { if (lab === 'Level' || lab === 'Pan') { r.value = 0; r.oninput(); } };
  return h('label', {class: 'slider'}, h('span', {class: 'lab'}, lab), r, h('span', {class: 'ends'}, h('small', {}, ends[0]), out, h('small', {}, ends[1]))); }
function seg(lab, names, v, set, title){ return h('div', {class: 'segs', title: title || ''}, h('span', {class: 'lab'}, lab), ...names.map((n, i) => h('button', {class: 'seg', 'aria-pressed': String(v === i), onclick: () => set(i)}, n))); }
function throwBtn(){ const b = btn('Throw (hold)', () => {}, {key: 'J', title: 'Hold: everything this part plays goes into the echo; let go and it rings on'}); b.addEventListener('pointerdown', e => { e.preventDefault(); throwTo(true); b.dataset.on = '1'; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { throwTo(false); b.dataset.on = ''; }); b.style.touchAction = 'none'; return b; }
const sendTog = k => { const c = selCol(); c[k] = !c[k]; macros(c); logMacro(c, k, c[k] ? 1 : 0); storeParts(); renderCard(); flash(`${PART(c)} ${k === 'echo' ? 'echo' : 'reverb'} ${c[k] ? 'on' : 'off'}`); };
const throwTo = on => { const c = selCol(); if (!!c.throw === on) return; c.throw = on; macros(c); logMacro(c, 'throw', on ? 1 : 0); };
function echoTime(){ st.echoDiv = (st.echoDiv + 1) % ECHO.length; tempo(); if (st.rec) st.rec.macros.push([Math.max(0, st.step - st.rec.from), '*', 'echoDiv', st.echoDiv]); renderCard(); flash('Echo time: ' + ECHO[st.echoDiv][0]); }

/* ---------- the rhythm grid: one cycle of the rhythm, each hit as long as it's held and as tall as it's loud, labelled
   with the note it plays; editing: tap a gap to add a hit, tap a hit to take it away, drag it, drag its end, hold it ---------- */
const NN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], nname = n => NN[n % 12] + (Math.floor(n/12) - 1);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function canvas(id){ const cv = $(id), r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1, W = r.width, Ht = r.height; if (!W) return null;
  if (cv.width !== Math.round(W*dpr) || cv.height !== Math.round(Ht*dpr)) { cv.width = W*dpr; cv.height = Ht*dpr; } const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Ht);
  g.font = '11px "IBM Plex Mono", monospace'; g.textBaseline = 'middle'; return {g, W, Ht}; }
const GL = 8;
function rGrid(R, W){ const cw = (W - 2*GL)/R.len; return {cw, at: x => Math.floor((x - GL)/cw)}; }
// the note each hit plays (its first time round), for the labels
function hitLabels(c, R, N){ if (!N || !R) return []; const H = st.hNext || st.harmony, bar = st.playing ? st.bar : 0;
  return R.hits.map((hh, i) => { const n = N.seq.length ? N.seq[i % N.seq.length] : null; if (n == null) return '';
    if (isDrum(c.role)) return String(n).slice(0, 3); const x = partNotes(c, {role: c.role, len: R.len, steps: [[0, n[0], 1, .7, n[1]]]}, 0, H, bar)[0]; return x ? nname(x[0] + 12*(c.oct || 0)).replace(/-?\d+$/, '') : ''; }); }
function drawRhythm(step){ const D = canvas('rgrid'), c = selCol(); if (!D) return; const {g, W, Ht} = D, s = shown(c), R = s.R;
  if (!R) { g.fillStyle = css('--mute'); g.fillText('Resting. New makes a rhythm.', 12, Ht/2); return; }
  const G = rGrid(R, W), top = 16, bh = Ht - top - 8;
  for (let p = 0; p < R.len; p++) { g.fillStyle = css(p % 4 === 0 ? '--band' : '--well'); g.fillRect(GL + p*G.cw + 1, top, G.cw - 2, bh); if (p % 4 === 0) { g.fillStyle = css('--mute'); g.fillText(String(p/4 + 1), GL + p*G.cw + 3, 7); } }
  const labs = hitLabels(c, R, s.N), pos = step != null && st.playing && c.clip && !c.next ? posOf(c, step) % R.len : -1;
  R.hits.forEach((hh, i) => { const l = isDrum(c.role) ? 1 : Math.max(.5, Math.min(hh[1], R.len - hh[0])), y = top + bh*(1 - hh[2])*.6, x = GL + hh[0]*G.cw;
    g.fillStyle = css(hh[0] === pos ? '--on' : '--ink'); g.globalAlpha = .45 + .55*hh[2]; g.fillRect(x + 1, y, Math.max(3, l*G.cw - 2), top + bh - y); g.globalAlpha = 1;
    if (labs[i] && G.cw > 14) { g.fillStyle = css('--bg'); g.fillText(labs[i], x + 3, top + bh - 9); } });
  if (pos >= 0) { g.fillStyle = css('--acc'); g.globalAlpha = .3; g.fillRect(GL + pos*G.cw, top, Math.max(2, G.cw), bh); g.globalAlpha = 1; }
  if (st.edit) { g.strokeStyle = css('--acc'); g.setLineDash([4, 3]); g.strokeRect(1, top - 1, W - 2, bh + 2); g.setLineDash([]); } }
let drag = null;
const hitAt = (R, p) => R.hits.findIndex(hh => hh[0] <= p && p < hh[0] + Math.max(1, Math.ceil(isDrum(selCol().role) ? 1 : hh[1])));
// a hit added or taken away: with linked notes its note comes or goes with it (so the others keep theirs). base: the part
// as the gesture began (a drag edits from there, since each edit sorts the hits again); the first edit of a gesture can be undone
const edName = (m, x) => m.ops?.at(-1) === 'edited' ? {...x, name: m.name, base: m.base, ops: m.ops} : named(m, x, 'edited');
function editHits(c, f, base = shown(c), undoIt = true){ const {R, N} = base, L = linked(R, N), out = f(R.hits.map((hh, i) => [...hh, i])).sort((a, b) => a[0] - b[0]);
  const nR = edName(R, {...R, hits: out.map(x => x.slice(0, 3))}); delete nR.spread; let nN = N;
  if (L) nN = edName(N, {...N, seq: out.map((x, j) => x[3] != null ? N.seq[x[3]] : clone(N.seq[out[j - 1]?.[3] ?? 0] ?? N.seq[0] ?? (isDrum(c.role) ? VOICE0[c.role] : [0, 0])))});
  setPart(c, {R: nR, N: nN}, {now: true, undo: undoIt}); }
$('rgrid').addEventListener('pointerdown', e => { const c = selCol(), R = shown(c).R; if (!st.edit || !R) return; const r = $('rgrid').getBoundingClientRect(), G = rGrid(R, r.width), x = e.clientX - r.left, p = G.at(x);
  if (p < 0 || p >= R.len) return; e.preventDefault(); $('rgrid').setPointerCapture(e.pointerId); const i = hitAt(R, p);
  if (i < 0) { editHits(c, t => [...t, [p, c.role === 'chords' ? 2 : 1, .7, null]]); drag = {added: true}; return; }
  const hh = R.hits[i], edge = !isDrum(c.role) && x > GL + (hh[0] + Math.max(1, Math.ceil(hh[1])))*G.cw - Math.min(10, G.cw*.4);
  drag = {i, x, p0: hh[0], l0: hh[1], edge, moved: false, G, base: shown(c), held: setTimeout(() => { if (drag && !drag.moved) { drag.accent = true; accentHit(c, drag.i); } }, 450)}; });
$('rgrid').addEventListener('pointermove', e => { const c = selCol(); if (!drag || drag.added || drag.loop || drag.i == null) return; const r = $('rgrid').getBoundingClientRect(), x = e.clientX - r.left, R = drag.base.R;
  if (!drag.moved && Math.abs(x - drag.x) < 6) return; if (!drag.moved) { drag.moved = true; clearTimeout(drag.held); }
  const d = Math.round((x - drag.x)/drag.G.cw), key = d + (drag.edge ? 'e' : ''); if (key === drag.last) return; drag.last = key;
  editHits(c, t => { const hh = t[drag.i];
    if (drag.edge) hh[1] = Math.max(1, Math.min(R.len - hh[0], drag.l0 + d)); else { const to = Math.max(0, Math.min(R.len - 1, drag.p0 + d)); if (!t.some(y => y !== hh && y[0] === to)) hh[0] = to; } return t; }, drag.base, !drag.pushed); drag.pushed = true; });
$('rgrid').addEventListener('pointerup', () => { const c = selCol(), d = drag; drag = null; if (!d || d.added || d.loop || d.i == null) return; clearTimeout(d.held); if (d.moved || d.accent) return; editHits(c, t => t.filter((y, j) => j !== d.i)); });
$('rgrid').addEventListener('pointercancel', () => { if (drag?.held) clearTimeout(drag.held); drag = null; });
const VELS = [.45, .7, 1];
function accentHit(c, i){ editHits(c, t => { const hh = t[i]; if (hh) hh[2] = VELS[(VELS.findIndex(v => v >= hh[2] - .05) + 1) % VELS.length]; return t; }); flash(['Soft', 'Normal', 'Loud'][VELS.indexOf(shown(c).R.hits[i]?.[2])] || ''); }

/* ---------- the notes: in the order they play, one a hit; a line's rows are chord tones (named over the chord now),
   a drum part's its voices; the one playing lit. Editing: tap a cell to set that note, hold a note for an octave up ---------- */
function nGrid(c, N, W, Ht){ let rows; if (isDrum(c.role)) rows = [...new Set([...voicesOf(c), ...N.seq])];
  else { const rs = N.seq.map(n => n[0]), base = c.role === 'bass' ? [-2, 6] : [-1, 9], E = c.edRange ??= [...base]; E[0] = Math.min(E[0], ...rs); E[1] = Math.max(E[1], ...rs); rows = []; for (let r = E[1]; r >= E[0]; r--) rows.push(r); }
  const L = 46, n = Math.max(N.seq.length, 1), cw = Math.min(40, (W - L - 8)/n), rh = (Ht - 10)/rows.length;
  return {L, cw, rows, rh, col: x => Math.floor((x - L)/cw), row: y => rows[Math.max(0, Math.min(rows.length - 1, Math.floor((y - 5)/rh)))]}; }
// which note is playing: the joined clip's step at the part's place, counted
function noteIndex(c, step){ if (step == null || !st.playing || !c.clip || c.next || !c.N?.seq.length) return -1; const p = posOf(c, step), k = c.clip.steps.filter(s => s[0] <= p).length - 1; return k < 0 ? -1 : k % c.N.seq.length; }
function drawNotes(step){ const D = canvas('ngrid'), c = selCol(); if (!D) return; const {g, W, Ht} = D, s = shown(c), H = st.hNext || st.harmony;
  if (c.role === 'chords') { const ch = chainOf(H), nb = Math.min(H.bars.length, 16), vs = [...Array(nb).keys()].map(b => invert(ch ? ch[b].voicing : notesAt({role: 'chords', steps: [[0, 'chord', 1, 1]]}, 0, chordOf(H, b)).map(x => x[0]), c.inv || 0)).map(v => v.map(n => n + 12*(c.oct || 0)));
    const all = vs.flat(), lo = Math.min(...all) - 2, hi = Math.max(...all) + 2, y = n => 8 + (hi - n)/(hi - lo)*(Ht - 30), L = 46, bw = (W - L - 8)/nb, cur = ((st.bar % H.bars.length) + H.bars.length) % H.bars.length;
    for (let n = lo; n <= hi; n++) if ([0, 5, 7].includes(n % 12) || all.includes(n)) { g.fillStyle = css(all.includes(n) ? '--ink' : '--mute'); g.globalAlpha = all.includes(n) ? .8 : .35; g.fillText(nname(n), 4, y(n)); } g.globalAlpha = 1;
    vs.forEach((v, b) => { const x0 = L + b*bw; if (b === cur && st.playing) { g.fillStyle = css('--on-soft'); g.fillRect(x0, 4, bw, Ht - 26); }
      g.fillStyle = css('--mute'); g.fillText(shortOf(H.bars[b]), x0 + 4, Ht - 10); v.forEach(n => { g.fillStyle = css(b === cur && st.playing ? '--on' : '--ink'); g.fillRect(x0 + 6, y(n) - 3, bw - 12, 6); }); }); return; }
  const N = s.N; if (!N?.seq.length) { g.fillStyle = css('--mute'); g.fillText('No notes yet. New makes some.', 12, Ht/2); return; }
  const G = nGrid(c, N, W, Ht), bar = st.playing ? st.bar : 0, cur = noteIndex(c, step);
  G.rows.forEach((r, i) => { const y = 5 + i*G.rh; g.fillStyle = css('--mute');
    const nm = isDrum(c.role) ? r : (x => x ? nname(x[0] + 12*(c.oct || 0)) : '')(partNotes(c, {role: c.role, len: 1, steps: [[0, r, 1, .7]]}, 0, H, bar)[0]); g.fillText(nm, 4, y + G.rh/2);
    g.fillStyle = css('--line'); g.globalAlpha = .4; g.fillRect(G.L, y + G.rh - .5, G.cw*N.seq.length, .5); g.globalAlpha = 1; });
  N.seq.forEach((n, i) => { const r = isDrum(c.role) ? n : n[0], ri = G.rows.indexOf(r); if (ri < 0) return; const x = G.L + i*G.cw, y = 5 + ri*G.rh;
    if (i === cur) { g.fillStyle = css('--acc'); g.globalAlpha = .25; g.fillRect(x, 0, G.cw, Ht); g.globalAlpha = 1; }
    g.fillStyle = css(i === cur ? '--on' : '--ink'); g.fillRect(x + 2, y + 2, G.cw - 4, G.rh - 4);
    if (!isDrum(c.role) && n[1]) { g.fillStyle = css('--bg'); g.fillText(n[1] > 0 ? '↑' : '↓', x + 4, y + G.rh/2); } });
  if (st.edit) { g.strokeStyle = css('--acc'); g.setLineDash([4, 3]); g.strokeRect(G.L - 2, 2, G.cw*N.seq.length + 4, Ht - 4); g.setLineDash([]); } }
function setNote(c, i, f){ const s = shown(c), seq = clone(s.N.seq); if (i < 0 || i >= seq.length) return; seq[i] = f(seq[i]); const first = !drag?.pushed; if (drag) drag.pushed = true;
  setPart(c, {N: edName(s.N, {...s.N, seq})}, {now: true, undo: first}); }
$('ngrid').addEventListener('pointerdown', e => { const c = selCol(), N = shown(c).N; if (!st.edit || !N?.seq.length || c.role === 'chords') return; const r = $('ngrid').getBoundingClientRect(), G = nGrid(c, N, r.width, r.height);
  const i = G.col(e.clientX - r.left); if (i < 0 || i >= N.seq.length) return; e.preventDefault(); $('ngrid').setPointerCapture(e.pointerId); const row = G.row(e.clientY - r.top);
  const same = isDrum(c.role) ? N.seq[i] === row : N.seq[i][0] === row;
  drag = {note: i, G, held: same && !isDrum(c.role) ? setTimeout(() => { if (drag) { drag.oct = true; setNote(c, i, n => [n[0], n[1] ? 0 : 1]); flash('Octave up: ' + (shown(c).N.seq[i][1] ? 'on' : 'off')); } }, 450) : null};
  if (!same) setNote(c, i, n => isDrum(c.role) ? row : [row, n[1]]); });
$('ngrid').addEventListener('pointermove', e => { const c = selCol(); if (drag?.note == null) return; const r = $('ngrid').getBoundingClientRect(), row = drag.G.row(e.clientY - r.top), i = drag.note, cur = shown(c).N.seq[i];
  if ((isDrum(c.role) ? cur : cur[0]) === row) return; clearTimeout(drag.held); setNote(c, i, n => isDrum(c.role) ? row : [row, n[1]]); });
for (const ev of ['pointerup', 'pointercancel']) $('ngrid').addEventListener(ev, () => { if (drag?.held) clearTimeout(drag.held); if (drag?.note != null) drag = null; });

/* ---------- the loop strip: drag across the part's bars (to the beat) to loop that stretch, tap a bar to loop it alone, tap
   the loop again (or Loop off) for the whole part; Crop to loop keeps just that stretch ---------- */
const LOOP_L = 46;
function loopGrid(c, W){ const len = c.clip.len, cw = (W - LOOP_L - 8)/len, snap = len % 4 ? 1 : 4, bar = len % 16 ? snap : 16;
  return {len, cw, snap, bar, at: x => Math.max(0, Math.min(len - 1, Math.floor((x - LOOP_L)/cw)))}; }
function renderLoop(step){ const c = selCol(), on = !!c?.clip && !c.next && st.tab === 'rhythm'; $('loopRow').hidden = !on; if (!on) return; const D = canvas('loopBar'); if (!D) return; const {g, W, Ht} = D;
  const G = loopGrid(c, W), lp = c.loopNext !== undefined ? c.loopNext : loopOf(c), pend = c.loopNext !== undefined, sel = drag?.loop;
  g.fillStyle = css('--mute'); g.fillText('Loop', 4, Ht/2);
  for (let p = 0; p < G.len; p += G.bar) { g.fillStyle = css('--well'); g.fillRect(LOOP_L + p*G.cw + 1, 2, G.bar*G.cw - 2, Ht - 4); g.fillStyle = css('--mute'); if (G.bar === 16 && G.cw*16 > 14) g.fillText(String(p/16 + 1), LOOP_L + p*G.cw + 5, Ht/2); }
  g.fillStyle = css('--line'); for (let p = G.snap; p < G.len; p += G.snap) if (p % G.bar) g.fillRect(LOOP_L + p*G.cw, Ht - 7, 1, 5);
  const span = sel ? [Math.min(sel[0], sel[1]), Math.max(sel[0], sel[1]) + G.snap] : lp;
  if (span) { g.fillStyle = css('--acc'); g.globalAlpha = pend || sel ? .35 : .55; g.fillRect(LOOP_L + span[0]*G.cw + 1, 2, (span[1] - span[0])*G.cw - 2, Ht - 4); g.globalAlpha = 1; g.strokeStyle = css('--acc'); g.lineWidth = 2; g.strokeRect(LOOP_L + span[0]*G.cw + 1, 2, (span[1] - span[0])*G.cw - 2, Ht - 4); g.lineWidth = 1; }
  if (step != null && st.playing) { const p = posOf(c, step); g.fillStyle = css('--on'); g.fillRect(LOOP_L + p*G.cw, 0, Math.max(2, G.cw), Ht); }
  $('loopNow').textContent = !lp ? (G.len > 16 ? `the whole ${lenWords(G.len)}${G.len !== c.R.len ? ' (the notes going round)' : ''}: drag across to loop some` : 'drag across to loop a stretch') : `${pend ? 'next bar: ' : ''}looping ${loopWords(lp, G)}`;
  $('loopOff').disabled = $('loopCrop').disabled = !lp; }
const loopWords = (lp, G) => G.bar === 16 ? (lp[0] % 16 || lp[1] % 16 ? `beats ${lp[0]/4 + 1}–${lp[1]/4}` : lp[1] - lp[0] === 16 ? `bar ${lp[0]/16 + 1}` : `bars ${lp[0]/16 + 1}–${lp[1]/16}`) : `steps ${lp[0] + 1}–${lp[1]}`;
function setLoop(c, lp){ if (lp && (lp[0] <= 0 && lp[1] >= c.clip.len)) lp = null; if (st.playing) c.loopNext = lp; else { c.loop = lp; delete c.loopNext; }
  renderLoop(); flash(lp ? `Looping ${loopWords(lp, loopGrid(c, $('loopBar').getBoundingClientRect().width || 400))}` : 'The whole part again'); }
$('loopBar').addEventListener('pointerdown', e => { const c = selCol(); if (!c?.clip) return; const r = $('loopBar').getBoundingClientRect(), G = loopGrid(c, r.width), x = e.clientX - r.left; if (x < LOOP_L) return;
  e.preventDefault(); $('loopBar').setPointerCapture(e.pointerId); const p = Math.floor(G.at(x)/G.snap)*G.snap; drag = {loop: [p, p], x, G}; renderLoop(); });
$('loopBar').addEventListener('pointermove', e => { if (!drag?.loop) return; const r = $('loopBar').getBoundingClientRect(), x = e.clientX - r.left; if (!drag.moved && Math.abs(x - drag.x) < 6) return; drag.moved = true; drag.loop[1] = Math.floor(drag.G.at(x)/drag.G.snap)*drag.G.snap; renderLoop(); });
$('loopBar').addEventListener('pointerup', () => { const c = selCol(), d = drag; if (!d?.loop || !c?.clip) { drag = null; return; } drag = null; const G = d.G;
  if (!d.moved) { const b = Math.floor(d.loop[0]/G.bar)*G.bar, bar = [b, Math.min(G.len, b + G.bar)], cur = c.loopNext !== undefined ? c.loopNext : loopOf(c); setLoop(c, cur && cur[0] <= d.loop[0] && d.loop[0] < cur[1] ? null : bar); return; }
  setLoop(c, [Math.min(...d.loop), Math.max(...d.loop) + G.snap]); });
$('loopOff').onclick = () => { const c = selCol(); if (c?.clip) setLoop(c, null); };
$('loopCrop').onclick = () => { const c = selCol(), lp = c && (c.loopNext !== undefined ? c.loopNext : loopOf(c)); if (!lp) return;
  const steps = c.clip.steps.filter(s => s[0] >= lp[0] && s[0] < lp[1]).map(s => { const t = s.slice(); t[0] -= lp[0]; return t; }); if (!steps.length) { flash('Nothing in the loop'); return; }
  const words = loopWords(lp, loopGrid(c, $('loopBar').getBoundingClientRect().width || 400)), sp = split(c.role, {len: lp[1] - lp[0], steps}); c.loop = null; delete c.loopNext;
  setPart(c, {R: named(c.R, {...sp.rhythm, feel: c.R.feel}, words), ...(c.role === 'chords' ? {} : {N: named(c.N, sp.notes, words)})}, {now: true}); };

/* ---------- the live view: what's playing lit in the parts and on the card ---------- */
function light(s){ document.querySelectorAll('#parts .prow').forEach(row => { const c = st.cols.find(x => x.id === row.dataset.part), ph = row.querySelector('.ph');
    ph.style.width = s >= 0 && c?.clip ? ((posOf(c, s) + 1)/c.clip.len)*100 + '%' : '0'; });
  if (s >= 0 && s % 2 === 0) { if (st.tab === 'rhythm') { drawRhythm(s); renderLoop(s); } else if (st.tab === 'notes') drawNotes(s); } }

/* ---------- the ground: this pack's progressions, the library (by feel, in any key), the chord matrix (the smooth moves
   from the chord playing lit; tap to hold one, or write them into a progression) and yours; its bars shown along the top ---------- */
const HV = (() => { const d = {tab: 'pack', key: 'A', mode: 'minor', feel: 'all', write: false, mine: [], saved: [], open: true}; try { return {...d, ...JSON.parse(localStorage.getItem('studio.jam.harm') || '{}')}; } catch { return d; } })();
const storeHV = () => { try { localStorage.setItem('studio.jam.harm', JSON.stringify(HV)); } catch {} };
const HTABS = [['pack', 'This pack'], ['lib', 'Library'], ['chords', 'Chords'], ['yours', 'Yours']];
const nowChord = () => { const H = st.hNext || st.harmony; return H.bars[((st.bar % H.bars.length) + H.bars.length) % H.bars.length]; };
const chordLine = bars => bars.filter((b, i) => b !== bars[i - 1]).map(shortOf).join(' → ');
const isOn = H => (st.harmony?.id === H.id), isNext = H => st.hNext?.id === H.id;
const HREG = {}, regH = H => (HREG[H.id] = H);
function setHarmony(x){ const H = typeof x === 'string' ? HREG[x] || PACK.harmonies.find(y => y.id === x) : x; if (!H) return; regH(H);
  if (!st.playing) { st.harmony = H; st.hStart = 0; } else st.hNext = H; for (const c of st.cols) prewarm(c); renderHarmony(); flash('Ground: ' + H.name + (st.playing ? ', next bar' : '')); }
function otherPacks(){ return ALLPACKS.filter(p => p.id !== PACK.id).flatMap(p => p.data.harmonies.map(H => ({...H, from: p.name.split(':')[0]}))); }
function hTab(t){ HV.tab = t; storeHV(); renderHarmony(); }
function keyRow(box){ const sel = h('select', {'aria-label': 'Key', onchange: e => { HV.key = e.target.value; storeHV(); renderHarmony(); }}, ...KEYS.map(k => h('option', {value: k, ...(k === HV.key ? {selected: ''} : {})}, k.replace('#', '♯').replace(/b$/, '♭'))));
  box.append(h('div', {class: 'hkey'}, h('span', {class: 'lab'}, 'Key'), sel, ...Object.keys(MODES).map(m => h('button', {class: 'mode', 'data-on': m === HV.mode ? '1' : '', title: MODE_WORDS[m], onclick: () => { HV.mode = m; storeHV(); renderHarmony(); }}, m)),
    h('button', {class: 'mode', title: 'The key of the chord playing now', onclick: () => { HV.key = chordKey(nowChord()); storeHV(); renderHarmony(); }}, '◎ Key of now'))); }
const libItem = H => h('button', {class: 'libitem', 'data-on': isOn(H) ? '1' : '', 'data-next': isNext(H) ? '1' : '', title: H.words || '', onclick: () => setHarmony(H)}, h('b', {}, H.name), h('span', {}, chordLine(H.bars) + ` · ${H.bars.length} bar${H.bars.length > 1 ? 's' : ''}`));
function renderLib(){ const box = $('hLib'); box.innerHTML = ''; keyRow(box);
  box.append(h('div', {class: 'feels'}, ...[['all', 'All'], ...HFEELS].map(([k, lab]) => h('button', {class: 'hchip', 'data-on': HV.feel === k ? '1' : '', onclick: () => { HV.feel = k; storeHV(); renderLib(); }}, lab))));
  const g = h('div', {class: 'libgrid'}); for (const H of PROGS.filter(x => HV.feel === 'all' || x.feel === HV.feel)) g.append(libItem(regH(inKey(H, HV.key)))); box.append(g);
  const other = otherPacks(); if (other.length && HV.feel === 'all') { box.append(h('div', {class: 'lab libhead'}, 'From the other packs (as written)')); const g2 = h('div', {class: 'libgrid'}); for (const H of other) g2.append(libItem(regH(H))); box.append(g2); } }
function renderMatrix(){ const box = $('hMat'); box.innerHTML = ''; keyRow(box); const M = matrix(HV.key, HV.mode), from = HV.write && HV.mine.length ? HV.mine.at(-1)[0] : nowChord(), next = st.hNext?.bars.length === 1 ? st.hNext.bars[0] : null;
  const g = h('div', {class: 'mat'}, h('span', {}), ...COLS.map(([lab]) => h('span', {class: 'mh'}, lab)));
  for (const r of M) { g.append(h('span', {class: 'mr'}, r.numeral));
    for (const sym of r.cells) { if (!sym) { g.append(h('span', {class: 'mcell empty'})); continue; } const d = distance(from, sym), near = sym === from ? 0 : d < .35 ? 3 : d < .7 ? 2 : d < 1.1 ? 1 : 0;
      g.append(h('button', {class: 'mcell', 'data-near': String(near), 'data-on': sym === nowChord() ? '1' : '', 'data-next': sym === next ? '1' : '', title: `${nameOf(sym)} · shares ${shared(from, sym)} notes with ${shortOf(from)}`, onclick: () => pickChord(sym)}, shortOf(sym))); } }
  box.append(g, h('div', {class: 'mwrite'}, h('button', {class: 'tog', 'aria-pressed': String(HV.write), onclick: () => { HV.write = !HV.write; storeHV(); renderHarmony(); }}, HV.write ? '✎ Writing: taps add chords' : '✎ Write a progression'),
    h('span', {class: 'muted'}, HV.write ? 'Tap chords to add them, a bar each; tap one in your row for longer.' : `Lit: smooth moves from ${shortOf(from)}. Tap a chord to hold it from the next bar.`))); }
function pickChord(sym){ if (HV.write) { HV.mine.push([sym, 1]); storeHV(); renderHarmony(); return; } setHarmony({id: 'chord:' + sym, name: nameOf(sym), words: 'Held from the matrix: tap another chord to move.', bars: [sym]}); }
const mineBars = () => HV.mine.flatMap(([s, n]) => Array(n).fill(s));
function renderMine(){ const box = $('hMine'); box.innerHTML = ''; box.hidden = !(HV.open && (HV.tab === 'chords' && HV.write || HV.tab === 'yours')); if (box.hidden) return;
  const row = h('div', {class: 'mine'}, h('span', {class: 'lab'}, 'Your progression'));
  HV.mine.forEach((m, i) => row.append(h('button', {class: 'mchord', title: 'Tap: longer (1, 2, 4 bars)', onclick: () => { m[1] = {1: 2, 2: 4, 4: 1}[m[1]] || 1; storeHV(); renderMine(); }},
    shortOf(m[0]), h('small', {}, `×${m[1]}`), h('span', {class: 'x', role: 'button', 'aria-label': 'Take it out', onclick: e => { e.stopPropagation(); HV.mine.splice(i, 1); storeHV(); renderHarmony(); }}, '✕'))));
  if (!HV.mine.length) row.append(h('span', {class: 'muted'}, HV.tab === 'yours' ? 'Write one in Chords (✎ Write a progression).' : 'Nothing yet: tap chords above.'));
  const mine = () => ({id: 'mine:' + mineBars().join(','), name: 'Your progression', words: 'Written in the matrix.', bars: mineBars()});
  row.append(h('button', {class: 'mini', disabled: !HV.mine.length || undefined, onclick: () => setHarmony(mine())}, '▶ Play it'),
    h('button', {class: 'mini', disabled: !HV.mine.length || undefined, onclick: () => { const name = prompt('Name this progression', 'My progression')?.trim(); if (!name) return;
      HV.saved.push({id: 'yours-' + Date.now().toString(36), name: name.slice(0, 40), words: 'Yours, written in the matrix.', bars: mineBars()}); storeHV(); hTab('yours'); flash('Saved: ' + name); }}, 'Save'),
    h('button', {class: 'mini', disabled: !HV.mine.length || undefined, onclick: () => { HV.mine = []; storeHV(); renderHarmony(); }}, 'Clear'));
  box.append(row); }
function renderYours(){ const box = $('hYours'); box.innerHTML = '';
  if (!HV.saved.length) { box.append(h('p', {class: 'muted'}, 'Nothing saved yet. Write one in Chords, then Save.')); return; }
  const g = h('div', {class: 'libgrid'}); for (const H of HV.saved) { const b = libItem(regH(H)); b.append(h('span', {role: 'button', 'aria-label': 'Delete', onclick: e => { e.stopPropagation(); if (!confirm(`Delete “${H.name}”?`)) return; HV.saved = HV.saved.filter(x => x !== H); storeHV(); renderYours(); }}, '✕ delete')); g.append(b); }
  box.append(g); }
function renderHarmony(){ if (!PACK) return; const T = $('hTabs'); T.innerHTML = ''; for (const [k, lab] of HTABS) T.append(h('button', {role: 'tab', 'aria-selected': String(HV.open && HV.tab === k), onclick: () => { if (HV.open && HV.tab === k) { HV.open = false; storeHV(); renderHarmony(); } else { HV.open = true; hTab(k); } }}, lab));
  $('harmonies').hidden = !HV.open || HV.tab !== 'pack'; $('hLib').hidden = !HV.open || HV.tab !== 'lib'; $('hMat').hidden = !HV.open || HV.tab !== 'chords'; $('hYours').hidden = !HV.open || HV.tab !== 'yours';
  if (HV.open) { if (HV.tab === 'lib') renderLib(); if (HV.tab === 'chords') renderMatrix(); if (HV.tab === 'yours') renderYours(); } renderMine();
  const box = $('harmonies'); box.innerHTML = '';
  for (const H of PACK.harmonies) box.append(h('button', {class: 'hchip', 'data-liked': liked(harmonyItem(H)) ? '1' : '', 'data-on': H === st.harmony ? '1' : '', 'data-next': H === st.hNext ? '1' : '', title: H.words, onclick: () => setHarmony(H.id)}, H.name));
  const G = st.hNext || st.harmony; $('hWords').textContent = (st.hNext ? 'Next bar: ' : '') + G.name + (G.words ? ' — ' + G.words : ''); const hl = $('harmLikes'); hl.innerHTML = ''; hl.append(likeBar(harmonyItem(G)));
  $('smooth').setAttribute('aria-pressed', String(st.smooth)); renderGround(); }
// the ground's bars along the top: each chord as long as it's held, the one playing lit
function renderGround(){ const box = $('groundBars'); if (!box || !st.harmony) return; const H = st.harmony, cur = ((st.bar % H.bars.length) + H.bars.length) % H.bars.length; box.innerHTML = '';
  let i = 0; while (i < H.bars.length) { let n = 1; while (i + n < H.bars.length && H.bars[i + n] === H.bars[i]) n++; const on = st.playing && cur >= i && cur < i + n;
    box.append(h('span', {class: 'gbar', 'data-on': on ? '1' : '', style: `flex:${n}`, title: nameOf(H.bars[i])}, shortOf(H.bars[i]), n > 1 ? h('small', {}, ` ×${n}`) : '')); i += n; } }
$('smooth').onclick = toggleSmooth;

/* ---------- the form: the pack's scenes, your scenes (snapshots: everything as it is, back on the next bar), Claude's
   ideas, and a song of scenes in an order ---------- */
function renderScenes(){ const box = $('scenes'); if (!box || !PACK) return; box.innerHTML = '';
  PACK.scenes.forEach((x, r) => box.append(h('button', {class: 'scene', 'data-on': st.scene === r ? '1' : '', title: `Launch ${x.name} (key ${r + 1})`, onclick: () => scene(r)}, h('b', {}, String(r + 1)), ' ', x.name))); }
let SNAPS = [], snapOn = null, snapDel = null;
const SNAP_FIELDS = ['loop', 'ramp', 'play', 'echo', 'verb', 'voicing', 'inv', 'arp', 'walk', 'mix'], SNAP_KEY = 'studio.jam.snaps';
const storeSnaps = () => { try { localStorage.setItem(SNAP_KEY, JSON.stringify(SNAPS)); } catch {} };
function capture(){ const n = SNAPS.reduce((m, x) => Math.max(m, +(/^Scene (\d+)$/.exec(x.name)?.[1] || /^Snap (\d+)$/.exec(x.name)?.[1] || 0)), 0) + 1, G = st.hNext || st.harmony;
  return {id: 's' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36), v: 2, name: `Scene ${n}`, pack: PACK.id, bpm: st.bpm, smooth: st.smooth, echoDiv: st.echoDiv, mx: {...st.mx}, harmony: G.id, harmonyName: G.name, harmonyBars: G.bars, at: new Date().toISOString(),
    cols: st.cols.map(c => { const s = shown(c), clip = s.R ? join(c.role, s.R, s.N) : null;
      return {role: c.role, sound: c.sound, locked: !!c.locked, x: +c.x.toFixed(3), y: +c.y.toFixed(3), motion: c.motion, length: c.length, oct: c.oct || 0, mute: !!c.mute, ...Object.fromEntries(SNAP_FIELDS.map(k => [k, c[k]])), mix: {...c.mix, solo: false},
        loop: c.loopNext !== undefined ? c.loopNext : c.loop || null, feel: s.R?.feel || 0, rhythm: s.R, notes: s.N, preset: c.preset ?? null, clip: clip && {id: c.preset || 'part', var: 0, len: clip.len, steps: clip.steps}}; })}; }
async function saveSnap(){ if (!PACK) return; const x = capture(); SNAPS.push(x); storeSnaps(); snapOn = x.id; renderSnaps(); flash('Saved ' + x.name);
  if (db) try { await db.collection('snaps').doc(x.id).set(x); } catch (err) { flash('Saved here only (' + (err.code || err.message) + ')'); } }
// sounds and settings change at once (so their notes are computed in time); the parts and the ground on the next bar. A
// scene saved before parts had modules (or one of Claude's ideas) brings its clips back taken apart
async function recall(x, o = {}){ if (!o.keepCur && st.cur) { keepEdit(); st.cur = null; renderSongBar(); }
  st.recalling = true; try { await recallNow(x); } finally { st.recalling = false; } }
async function recallNow(x){ if (x.pack !== PACK.id) { if (!ALLPACKS.some(p => p.id === x.pack)) { flash('That pack is gone'); return; } await loadPack(x.pack); }
  if (x.mx) { st.mx = {...st.mx, ...x.mx}; masterMix(); } snapOn = x.id; st.bpm = x.bpm; if (x.smooth !== undefined) st.smooth = x.smooth; if (x.echoDiv !== undefined) st.echoDiv = x.echoDiv; $('bpmOut').textContent = st.bpm; tempo();
  x.cols.forEach((v, i) => { const c = st.cols[i]; if (!c || c.role !== v.role) return;
    if (SND[v.sound] && v.sound !== c.sound) { setSound(c, v.sound); logMacro(c, 'sound:' + v.sound, 1); } c.locked = v.locked;
    v = {play: 0, loop: null, ramp: null, ...v}; c.rampAt = null;
    for (const k of ['x', 'y', 'motion', 'length', 'oct', ...SNAP_FIELDS]) if (v[k] !== undefined && c[k] !== v[k]) { if (k === 'loop') { if (st.playing) c.loopNext = v.loop; else { c.loop = v.loop; delete c.loopNext; } continue; }
      if (k === 'mix') { c.mix = {...c.mix, ...v.mix}; for (const [mk, mv] of Object.entries(v.mix)) logMacro(c, 'mix.' + mk, typeof mv === 'boolean' ? +mv : mv); continue; } c[k] = v[k]; logMacro(c, k, typeof v[k] === 'boolean' ? +v[k] : v[k]); }
    c.arpSt = null; if (c.mute !== v.mute) { c.mute = v.mute; logMacro(c, 'mute', c.mute ? 1 : 0); } lengthTo(c); macros(c);
    let m = v.rhythm ? {R: clone(v.rhythm), N: v.notes ? clone(v.notes) : null} : v.clip ? fromClip(c, v.clip, CLIP[v.clip.id]?.name || 'Saved part') : {R: null, N: null};
    if (m.R) m.R.feel = v.rhythm?.feel ?? v.feel ?? c.feel0 ?? 0;
    setPart(c, m, {keep: false, preset: v.preset !== undefined ? v.preset : CLIP[v.clip?.id] ? v.clip.id : null}); });
  { const H = HREG[x.harmony] || PACK.harmonies.find(y => y.id === x.harmony) || (x.harmonyBars && {id: x.harmony, name: x.harmonyName || 'Saved ground', words: '', bars: x.harmonyBars}); if (H) setHarmony(H); }
  st.scene = null; saveSounds(); storeMix(); renderMix(); renderScenes(); renderSnaps(); renderIdeas(); renderParts(); renderCard(); flash((st.playing ? 'Next bar: ' : '') + x.name); }
async function renameSnap(x){ const name = prompt('Name this scene', x.name)?.trim(); if (!name || name === x.name) return; x.name = name.slice(0, 40); storeSnaps(); renderSnaps();
  if (db) try { await db.collection('snaps').doc(x.id).update({name: x.name}); } catch {} }
async function deleteSnap(x){ if (snapDel !== x.id) { snapDel = x.id; renderSnaps(); flash('Press ✕ again to delete ' + x.name); setTimeout(() => { if (snapDel === x.id) { snapDel = null; renderSnaps(); } }, 3000); return; }
  SNAPS = SNAPS.filter(y => y !== x); snapDel = null; storeSnaps(); renderSnaps(); flash('Deleted ' + x.name); if (db) try { await db.collection('snaps').doc(x.id).delete(); } catch {} }
function renderSnaps(){ const box = $('snaps'); if (!box) return; box.innerHTML = '';
  box.append(h('button', {class: 'snap save', onclick: saveSnap, title: 'Save everything as it is now (S)'}, h('b', {}, '＋ Save scene'), h('span', {class: 'muted'}, 'everything as it is now')));
  const list = [...SNAPS.filter(x => x.pack === PACK?.id), ...SNAPS.filter(x => x.pack !== PACK?.id)];
  list.forEach(x => { const k = SNAPS.indexOf(x), pk = ALLPACKS.find(p => p.id === x.pack);
    box.append(h('div', {class: 'snap', 'data-on': x.id === snapOn ? '1' : '', 'data-del': x.id === snapDel ? '1' : ''},
      h('button', {class: 'go', onclick: () => recall(x), title: k < 9 ? `Recall (Shift+${k + 1})` : 'Recall'}, h('b', {}, (k < 9 ? k + 1 + ' · ' : '') + x.name), h('span', {class: 'muted'}, x.pack === PACK?.id ? x.harmonyName || ' ' : (pk?.name.split(':')[0] || x.pack))),
      h('span', {class: 'snapbtns'}, likeBar({kind: 'snap', key: x.id, name: x.name, data: {id: x.id}}, {noDown: true}), h('button', {class: 'mini', title: 'Into the song', onclick: () => arrAdd(x.id)}, '＋ Song'), h('button', {class: 'mini', title: 'Rename', onclick: () => renameSnap(x)}, '✎'), h('button', {class: 'mini', title: 'Delete', onclick: () => deleteSnap(x)}, '✕')))); }); }

/* ---------- the library: rhythms, notes and parts to take from, the pack's (every pack's parts, and even rhythms) and
   yours (saved from the card); a rhythm onto any part, notes onto a part of their kind, or both ---------- */
let MYLIB = []; const MYLIB_KEY = 'studio.jam.library';
try { MYLIB = JSON.parse(localStorage.getItem(MYLIB_KEY) || '[]'); } catch {}
const storeLib = () => { try { localStorage.setItem(MYLIB_KEY, JSON.stringify(MYLIB)); } catch {} };
const LV = (() => { const d = {kind: 'all', role: 'this', q: ''}; try { return {...d, ...JSON.parse(localStorage.getItem('studio.jam.libview') || '{}')}; } catch { return d; } })();
const storeLV = () => { try { localStorage.setItem('studio.jam.libview', JSON.stringify(LV)); } catch {} };
const EVEN = [['Four on the floor', 4, 16], ['Off-beats', 4, 16, 2], ['Tresillo', 3, 8], ['Cinquillo', 5, 8], ['Five of sixteen', 5, 16], ['Seven of sixteen', 7, 16, 1], ['Nine of sixteen', 9, 16], ['Three of seven', 3, 7], ['Five of twelve', 5, 12], ['Four of eleven', 4, 11], ['Two of five', 2, 5], ['Seven of twelve', 7, 12]];
// every item: {id, kind: rhythm | notes | part, role, name, from, R?, N?}
function libItems(){ const out = [];
  for (const [name, k, n, r = 0] of EVEN) { const R = fresh(spread('lead', k, n, r), name); out.push({id: 'even:' + name, kind: 'rhythm', role: null, name, from: 'Even rhythms', R}); }
  for (const p of ALLPACKS) for (const cl of p.data.clips) { const s = split(cl.role, cl, cl.name); out.push({id: `${p.id}:${cl.id}`, kind: 'part', role: cl.role, name: cl.name, from: p.name.split(':')[0], R: s.rhythm, N: cl.role === 'chords' ? null : s.notes, words: cl.words || ''}); }
  return [...MYLIB.map(x => ({...x, mine: true, from: 'Yours'})), ...out]; }
const fits = (c, x) => !x.role || family(x.role) === family(c.role);
function useLib(x, what){ const c = selCol(); let R, N;
  if (what !== 'notes' && x.R) R = {...clone(x.R), feel: x.R.feel ?? shown(c).R?.feel ?? 0};
  if (what !== 'rhythm' && x.N) { N = fitNotes(c.role, clone(x.N), voicesOf(c)); if (!N) { flash('Those notes are for another kind of part'); return; } }
  const cur = shown(c); if (R && !N && !cur.N) N = defaultNotes(c, R); if (N && !R && !cur.R) R = defaultRhythm(c);
  setPart(c, {...(R ? {R} : {}), ...(N ? {N} : {})}, {keep: !!cur.R}); flash(`${PART(c)}: ${what === 'both' ? '' : what + ' from '}${x.name}${st.playing ? ', next bar' : ''}`); }
function saveModule(k){ const c = selCol(), s = shown(c); if (!s.R) return;
  const kind = k === 'R' ? 'rhythm' : k === 'N' ? 'notes' : 'part', def = kind === 'rhythm' ? s.R.name : kind === 'notes' ? s.N?.name : `${PART(c)}: ${s.R.name}`, name = prompt(`Name it for your library`, def)?.trim(); if (!name) return;
  const x = {id: 'my-' + Date.now().toString(36) + Math.floor(Math.random()*1e3).toString(36), kind, role: kind === 'rhythm' ? null : c.role, name: name.slice(0, 40), at: new Date().toISOString(),
    ...(kind !== 'notes' ? {R: fresh(clone(s.R), name)} : {}), ...(kind !== 'rhythm' && s.N ? {N: fresh(clone(s.N), name)} : {}), ...(kind === 'part' ? {sound: c.sound} : {})};
  MYLIB.unshift(x); storeLib(); renderLibrary(); flash('Into your library: ' + x.name); if (db) db.collection('library').doc(x.id).set(x).catch(() => {}); }
function delLib(x){ if (!confirm(`Take “${x.name}” out of your library?`)) return; MYLIB = MYLIB.filter(y => y.id !== x.id); storeLib(); renderLibrary(); if (db) db.collection('library').doc(x.id).delete().catch(() => {}); }
const LKINDS = [['all', 'All'], ['rhythm', 'Rhythms'], ['notes', 'Notes'], ['part', 'Parts'], ['mine', 'Yours']];
function renderLibrary(){ const box = $('libList'), F = $('libFilters'); if (!box || !PACK) return; const c = selCol(); F.innerHTML = ''; box.innerHTML = '';
  F.append(...LKINDS.map(([k, lab]) => h('button', {class: 'lchip', 'data-on': LV.kind === k ? '1' : '', onclick: () => { LV.kind = k; storeLV(); renderLibrary(); }}, lab)),
    h('button', {class: 'lchip', 'data-on': LV.role === 'all' ? '1' : '', title: 'Every part’s rhythms and notes, not only this kind of part’s: the hats’ rhythm on the bass', onclick: () => { LV.role = LV.role === 'this' ? 'all' : 'this'; storeLV(); renderLibrary(); }}, 'From every part'));
  $('libFor').textContent = `Taking into: ${PART(c)}`;
  const qq = LV.q.toLowerCase(), items = libItems().filter(x => (LV.kind === 'all' || (LV.kind === 'mine' ? x.mine : x.kind === LV.kind)) && (LV.role === 'all' || !x.role || x.role === c.role || family(x.role) === 'line' && family(c.role) === 'line') && (!qq || (x.name + ' ' + (x.role || '') + ' ' + x.from).toLowerCase().includes(qq)));
  const groups = [...new Set(items.map(x => x.from))];
  if (!items.length) box.append(h('p', {class: 'muted'}, LV.kind === 'mine' ? 'Nothing saved yet: ＋ Library on a rhythm or notes, or Save part on the card.' : 'Nothing here.'));
  for (const g of groups) { box.append(h('div', {class: 'lab libhead'}, g)); const grid = h('div', {class: 'libgrid'});
    const all = items.filter(y => y.from === g), more = !LV.q && !libOpen.has(g) && all.length > 12;
    for (const x of more ? all.slice(0, 12) : all.slice(0, 120)) { const nOk = x.N && fits(c, x) && c.role !== 'chords';
      grid.append(h('div', {class: 'libcard'}, h('span', {class: 'kind'}, (x.kind === 'part' ? (ROLE_NAMES[x.role] || '').replace('Bells and leads', 'Lead') : x.kind === 'notes' ? `${(ROLE_NAMES[x.role] || '').replace('Bells and leads', 'lead')} notes` : 'rhythm')), h('b', {}, x.name),
        h('span', {class: 'sk'}, x.R ? sketch(x.R) + (x.R.len > 16 ? ` · ${lenWords(x.R.len)}` : x.R.len !== 16 ? ` · ${x.R.len} steps` : '') : `${x.N?.seq.length || 0} notes`),
        h('span', {class: 'row'}, x.R ? h('button', {class: 'use', title: 'Its rhythm onto the chosen part', onclick: () => useLib(x, 'rhythm')}, 'Rhythm') : '',
          nOk ? h('button', {class: 'use', title: 'Its notes onto the chosen part', onclick: () => useLib(x, 'notes')}, 'Notes') : '',
          x.R && nOk ? h('button', {class: 'use', title: 'All of it onto the chosen part', onclick: () => useLib(x, 'both')}, 'Both') : x.kind === 'part' && c.role === 'chords' && x.role === 'chords' ? '' : '',
          x.mine ? h('button', {class: 'mini', title: 'Take it out of your library', onclick: () => delLib(x)}, '✕') : ''))); }
    box.append(grid); if (more) box.append(h('button', {class: 'ghost libmore', onclick: () => { libOpen.add(g); renderLibrary(); }}, `Show all ${all.length}`)); } }
const libOpen = new Set();
$('libSearch').oninput = e => { LV.q = e.target.value; renderLibrary(); };

/* ---------- the mixer: each part's fader, pan, mute and solo, EQ and duck; the master's volume, EQ, width and glue ---------- */
const DUCKS = [['Off', 0], ['Light', .25], ['Medium', .4], ['Heavy', .65]];
const GLUE = [['Off', null], ['Gentle', {thr: -14, ratio: 1.8, att: .03, rel: .25}], ['Glue', {thr: -20, ratio: 3, att: .01, rel: .2}], ['Punch', {thr: -24, ratio: 4, att: .03, rel: .12}]];
const WIDTHS = [['Mono', 0], ['Narrow', .6], ['Normal', 1], ['Wide', 1.35], ['Wider', 1.7]];
const MASTER0 = {vol: 0, lo: 0, hi: 0, glue: 1, width: 2}, PAN0 = [0, .15, -.2, 0, 0, -.3, .3];
const mixKey = () => 'studio.jam.mix.' + PACK.id, savedMix = () => { try { return JSON.parse(localStorage.getItem(mixKey()) || '{}'); } catch { return {}; } };
function mixOf(c, i){ const saved = savedMix().cols?.[i]; return {vol: 0, pan: PAN0[i] || 0, lo: 0, mid: 0, hi: 0, duck: c.role === 'kick' ? 0 : c.role === 'chords' ? 3 : 2, solo: false, ...(saved || {}), ...(c.mix || {})}; }
const storeMix = () => { try { localStorage.setItem(mixKey(), JSON.stringify({cols: st.cols.map(c => ({...c.mix, solo: false})), master: st.mx})); } catch {} };
function masterMix(){ if (!mstr) return; const M = st.mx, now = ctx.currentTime, g = GLUE[M.glue][1];
  glide(mstr.lo.gain, M.lo, now, .02); glide(mstr.hi.gain, M.hi, now, .02); mstr.width.set('w', WIDTHS[M.width][1]); glide(mstr.vol.gain, Math.pow(10, M.vol/20), now, .02);
  const C = mstr.glue; if (g) { C.threshold.value = g.thr; C.ratio.value = g.ratio; C.attack.value = g.att; C.release.value = g.rel; C.knee.value = 8; } else { C.threshold.value = 0; C.ratio.value = 1; } }
const fmtDb = v => v <= -40 ? '−∞' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' dB';
const fmtPan = v => Math.abs(v) < .01 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100);
// a change from the mixer or the Space tab: applied, remembered, recorded (master changes on the '*' column); quiet: no
// redraw (a slider being dragged)
function mixSet(c, k, v, quiet){ if (c) { c.mix[k] = v; if (k === 'solo') st.cols.forEach(macros); else macros(c); logMacro(c, 'mix.' + k, typeof v === 'boolean' ? +v : v); }
  else { st.mx[k] = v; masterMix(); logMaster(k, v); }
  storeMix(); if (!quiet) { renderMix(); if (c === selCol() && st.tab === 'space') renderCard(); } else clearTimeout(mixSet.t), mixSet.t = setTimeout(renderMix, 300); }
const faderPos = v => v <= -40 ? 0 : Math.pow((v + 40)/46, 1.6), faderVal = p => p <= .01 ? -40 : Math.round((Math.pow(p, 1/1.6)*46 - 40)*2)/2;
function fader(val, set){ const track = h('div', {class: 'ftrack', role: 'slider', 'aria-valuemin': '-40', 'aria-valuemax': '6', 'aria-valuenow': String(val), 'aria-label': 'Volume', tabindex: '0'}),
    cap = h('div', {class: 'fcap'}), fill = h('div', {class: 'ffill'}), meter = h('div', {class: 'fmeter'}, h('i'));
  track.append(meter, fill, cap); const place = v => { const p = faderPos(v); cap.style.bottom = `calc(${p*100}% - ${p*22}px)`; fill.style.height = p*100 + '%'; }; place(val);
  let drag = false, last = 0; const at = e => { const r = track.getBoundingClientRect(); return faderVal(Math.max(0, Math.min(1, (r.bottom - e.clientY)/r.height))); };
  track.addEventListener('pointerdown', e => { const now = Date.now(); if (now - last < 300) { set(0); return; } last = now; drag = true; track.setPointerCapture(e.pointerId); const v = at(e); place(v); set(v, true); });
  track.addEventListener('pointermove', e => { if (!drag) return; const v = at(e); place(v); set(v, true); });
  track.addEventListener('pointerup', () => { if (drag) { drag = false; set(+track.getAttribute('aria-valuenow'), false, true); } });
  track.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); set(Math.max(-40, Math.min(6, val + (e.key === 'ArrowUp' ? 1.5 : -1.5)))); } });
  track.meter = meter.firstChild; return track; }
const stepper = (lab, txt, dn, up) => h('div', {class: 'mstep'}, h('span', {class: 'lab'}, lab), h('button', {class: 'mini', 'aria-label': lab + ' down', onclick: dn}, '−'), h('b', {}, txt), h('button', {class: 'mini', 'aria-label': lab + ' up', onclick: up}, '+'));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let meters = [];
function renderMix(){ const box = $('mixer'); if (!box || !st.cols.length) return; const fi = [...box.querySelectorAll('.ftrack')].indexOf(document.activeElement); box.innerHTML = ''; meters = [];
  st.cols.forEach((c, i) => { const M = c.mix, f = fader(M.vol, (v, live, end) => { if (live) { c.mix.vol = v; macros(c); f.setAttribute('aria-valuenow', String(v)); f.parentNode.querySelector('.fval').textContent = fmtDb(v); } else { if (end) logMacro(c, 'mix.vol', c.mix.vol); if (!end) mixSet(c, 'vol', v); else { storeMix(); } } });
    meters.push([c.ch?.meter, f.meter]);
    box.append(h('div', {class: 'mstrip', 'data-sel': i === st.sel ? '1' : ''},
      h('button', {class: 'sname', onclick: () => { st.sel = i; renderParts(); renderCard(); renderMix(); }}, h('b', {}, PART(c)), h('span', {}, SND[c.sound]?.name || '')),
      f, h('span', {class: 'fval'}, fmtDb(M.vol)),
      h('div', {class: 'mrow'}, h('button', {class: 'mini', 'aria-label': 'Quieter', onclick: () => mixSet(c, 'vol', clamp(M.vol - 1.5, -40, 6))}, '−'), h('button', {class: 'mini', 'aria-label': 'Louder', onclick: () => mixSet(c, 'vol', clamp(M.vol + 1.5, -40, 6))}, '+')),
      h('div', {class: 'mrow'}, h('button', {class: 'mini ms', 'aria-pressed': String(!!c.mute), onclick: () => { c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderParts(); renderMix(); }}, 'M'),
        h('button', {class: 'mini ms solo', 'aria-pressed': String(!!M.solo), onclick: () => mixSet(c, 'solo', !M.solo)}, 'S')),
      stepper('Pan', fmtPan(M.pan), () => mixSet(c, 'pan', clamp(Math.round((M.pan - .25)*4)/4, -1, 1)), () => mixSet(c, 'pan', clamp(Math.round((M.pan + .25)*4)/4, -1, 1))),
      ...[['lo', 'Low'], ['mid', 'Mid'], ['hi', 'High']].map(([k, lab]) => stepper(lab, (M[k] > 0 ? '+' : '') + M[k], () => mixSet(c, k, clamp(M[k] - 1.5, -15, 9)), () => mixSet(c, k, clamp(M[k] + 1.5, -15, 9)))),
      c.role === 'kick' ? h('span', {class: 'muted sidenote'}, 'drives the duck') : h('button', {class: 'mini duckb', title: 'How far the kick ducks this part (sidechain)', onclick: () => mixSet(c, 'duck', (M.duck + 1) % DUCKS.length)}, 'Duck: ' + DUCKS[M.duck][0]))); });
  const X = st.mx, mf = fader(X.vol, (v, live, end) => { if (live) { st.mx.vol = v; masterMix(); mf.setAttribute('aria-valuenow', String(v)); mf.parentNode.querySelector('.fval').textContent = fmtDb(v); } else if (!end) mixSet(null, 'vol', v); else { logMaster('vol', st.mx.vol); storeMix(); } });
  meters.push([mstr?.meter, mf.meter]);
  box.append(h('div', {class: 'mstrip master'}, h('div', {class: 'sname'}, h('b', {}, 'Master'), h('span', {}, 'limiter always on')), mf, h('span', {class: 'fval'}, fmtDb(X.vol)),
    h('div', {class: 'mrow'}, h('button', {class: 'mini', onclick: () => mixSet(null, 'vol', clamp(X.vol - 1.5, -40, 6))}, '−'), h('button', {class: 'mini', onclick: () => mixSet(null, 'vol', clamp(X.vol + 1.5, -40, 6))}, '+')),
    h('button', {class: 'mini duckb', title: 'The glue compressor on the whole mix', onclick: () => mixSet(null, 'glue', (X.glue + 1) % GLUE.length)}, 'Glue: ' + GLUE[X.glue][0]),
    h('button', {class: 'mini duckb', title: 'Stereo width (the bass stays mono)', onclick: () => mixSet(null, 'width', (X.width + 1) % WIDTHS.length)}, 'Width: ' + WIDTHS[X.width][0]),
    ...[['lo', 'Low'], ['hi', 'High']].map(([k, lab]) => stepper(lab, (X[k] > 0 ? '+' : '') + X[k], () => mixSet(null, k, clamp(X[k] - 1.5, -12, 6)), () => mixSet(null, k, clamp(X[k] + 1.5, -12, 6)))),
    h('button', {class: 'mini duckb', onclick: () => { st.cols.forEach((c, i) => { c.mix = {vol: 0, pan: PAN0[i] || 0, lo: 0, mid: 0, hi: 0, duck: c.role === 'kick' ? 0 : c.role === 'chords' ? 3 : 2, solo: false}; macros(c); }); st.mx = {...MASTER0}; masterMix(); storeMix(); renderMix(); flash('Mix reset'); }}, 'Reset mix')));
  if (fi >= 0) box.querySelectorAll('.ftrack')[fi]?.focus(); }
const buf = new Float32Array(1024);
(function meterLoop(){ requestAnimationFrame(meterLoop); if (!ctx || !st.playing || !meters.length || (phoneMQ.matches && document.body.dataset.tab !== 'mix')) return;
  for (const [an, el] of meters) { if (!an || !el) continue; an.getFloatTimeDomainData(buf.subarray(0, an.fftSize)); let pk = 0; for (let i = 0; i < an.fftSize; i++) pk = Math.max(pk, Math.abs(buf[i]));
    const dB = 20*Math.log10(pk || 1e-6), p = Math.max(0, Math.min(1, (dB + 48)/48)), held = Math.max(p, (+el.dataset.p || 0) - .02); el.dataset.p = held; el.style.height = held*100 + '%'; el.dataset.hot = dB > -1 ? '1' : ''; } })();

/* ---------- likes: one per thing (a rhythm, a set of notes, a part, a sound, a ground, an idea, a scene), each 👍, 👎 or
   neither, with a note; they stay lit, live in the page's database (and this device), and gather on the Likes page ---------- */
let LIKES = {}, likeFilter = 'all', noteFor = null;
const LIKE_KEY = 'studio.jam.likes';
try { LIKES = JSON.parse(localStorage.getItem(LIKE_KEY) || '{}'); } catch {}
const storeLikes = () => { try { localStorage.setItem(LIKE_KEY, JSON.stringify(LIKES)); } catch {} };
const hashOf = v => { let x = 2166136261; for (const ch of JSON.stringify(v)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
const likeId = it => `${it.kind}:${it.key}`.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 190);
const liked = it => LIKES[likeId(it)]?.rating === 1;
const soundItem = id => ({kind: 'sound', key: id, name: SND[id]?.name || id, sum: `${ROLE_NAMES[SND[id]?.role] || ''} · ${ALLPACKS.find(p => p.id === SND[id]?.pack)?.name.split(':')[0] || ''}`, data: {sound: id, role: SND[id]?.role, pack: SND[id]?.pack}});
const rhythmItem = (role, R) => ({kind: 'rhythm', key: `${R.len}:${hashOf(R.hits)}`, name: R.name, sum: `${R.hits.length} hits over ${lenWords(R.len)} · ${FEELS[R.feel || 0].name} · on ${ROLE_NAMES[role]}`, data: {role, R}});
const notesItem = (role, N) => ({kind: 'notes', key: `${family(role)}:${hashOf(N.seq)}`, name: N.name, sum: `${N.seq.length} notes · ${ROLE_NAMES[role]}`, data: {role, N}});
function patternItem(c){ const s = shown(c), cl = join(c.role, s.R, s.N), nm = c.role === 'chords' ? s.R.name : `${s.R.name} + ${s.N?.name}`;
  return {kind: 'pattern', key: `${c.role}:${c.preset || 'part'}:${hashOf(cl.steps)}`, name: `${nm} on ${SND[c.sound]?.name}`, sum: `${ROLE_NAMES[c.role]} · ${cl.len} steps · over ${(st.hNext || st.harmony).name}`,
    data: {role: c.role, col: c.id, clipId: c.preset || null, len: cl.len, steps: cl.steps, R: s.R, N: s.N, sound: c.sound, harmony: (st.hNext || st.harmony).id, pack: PACK.id}}; }
const harmonyItem = H => ({kind: 'harmony', key: H.id, name: H.name, sum: H.bars.filter((b, i, a) => b !== a[i - 1]).map(b => b.replace(':', ' ')).join(' → '), data: {id: H.id, name: H.name, words: H.words, bars: H.bars, pack: PACK.id}});
function likeBar(it, o = {}){ const id = likeId(it), box = h('span', {class: 'likebar', 'data-like': id});
  const up = h('button', {class: 'up', title: 'I like this', 'aria-label': 'Like ' + it.name, onclick: e => { e.stopPropagation(); setLike(it, 1); }}, o.label ? o.label + '👍' : '👍');
  const dn = h('button', {class: 'dn', title: 'Not for me', 'aria-label': 'Dislike ' + it.name, onclick: e => { e.stopPropagation(); setLike(it, -1); }}, '👎');
  const nt = h('button', {class: 'nt', title: 'A note on it', 'aria-label': 'Note on ' + it.name, onclick: e => { e.stopPropagation(); openNote(it); }}, '💬');
  box.append(up); if (o.only !== 'up') { if (!o.noDown) box.append(dn); box.append(nt); } paintLike(box); return box; }
function paintLike(box){ const L = LIKES[box.dataset.like]; box.querySelector('.up')?.setAttribute('aria-pressed', String(L?.rating === 1)); box.querySelector('.dn')?.setAttribute('aria-pressed', String(L?.rating === -1));
  const nt = box.querySelector('.nt'); if (nt) nt.dataset.has = L?.note ? '1' : ''; }
function likesChanged(id){ document.querySelectorAll('.likebar').forEach(b => b.dataset.like === id && paintLike(b)); renderHarmony(); if (document.body.dataset.tab === 'more' || !phoneMQ.matches) renderLikes(); }
// a cleared like stays as a marker (`cleared`, with its time), so an older copy elsewhere doesn't bring it back
async function saveLike(id, L){ LIKES[id] = L || {cleared: true, at: new Date().toISOString()}; storeLikes(); likesChanged(id);
  if (db) try { await db.collection('likes').doc(id).set(LIKES[id]); } catch (err) { flash('Kept on this device only (' + (err.code || err.message) + ')'); } }
function setLike(it, r){ const id = likeId(it), cur = LIKES[id], rating = cur?.rating === r ? 0 : r;
  if (!rating && !cur?.note) saveLike(id, null); else saveLike(id, {kind: it.kind, key: it.key, name: it.name, sum: it.sum || '', data: it.data || {}, rating, note: cur?.note || '', at: new Date().toISOString()});
  flash(rating === 1 ? `👍 ${it.name}` : rating === -1 ? `👎 ${it.name}` : `Cleared: ${it.name}`); }
function openNote(it){ noteFor = it; $('noteWhat').textContent = `${KIND_NAMES[it.kind]}: ${it.name}`; $('noteText').value = LIKES[likeId(it)]?.note || ''; $('noteSheet').hidden = false; $('noteText').focus(); }
function closeNote(){ $('noteSheet').hidden = true; noteFor = null; }
$('noteCancel').onclick = closeNote;
$('noteSave').onclick = () => { const it = noteFor; if (!it) return; const id = likeId(it), cur = LIKES[id], note = $('noteText').value.trim();
  if (!note && !cur?.rating) saveLike(id, null); else saveLike(id, {kind: it.kind, key: it.key, name: it.name, sum: it.sum || '', data: it.data || {}, rating: cur?.rating || 0, note, at: new Date().toISOString()}); closeNote(); flash('Note saved'); };
$('noteDel').onclick = () => { const it = noteFor; if (!it) return; const id = likeId(it), cur = LIKES[id]; if (cur) saveLike(id, cur.rating ? {...cur, note: '', at: new Date().toISOString()} : null); closeNote(); };
// the part's likes: the whole part as it sounds (its rhythm, notes and sound together)
function renderPartLikes(){ const box = $('partLikes'), c = selCol(); if (!box || !c) return; box.innerHTML = ''; if (shown(c).R) box.append(h('span', {class: 'lab'}, 'This part '), likeBar(patternItem(c))); }
const KIND_NAMES = {sound: 'Sound', pattern: 'Part', rhythm: 'Rhythm', notes: 'Notes', settings: 'Settings', harmony: 'Ground', idea: 'Idea', snap: 'Scene', section: 'Song part'};
const FILTERS = [['all', 'All'], ['pattern', 'Parts'], ['rhythm', 'Rhythms'], ['notes', 'Notes'], ['sound', 'Sounds'], ['harmony', 'Grounds'], ['snaps', 'Songs, ideas & scenes'], ['notesOn', 'With a note'], ['down', '👎']];
const inFilter = (L, f) => f === 'all' ? L.rating >= 0 : f === 'down' ? L.rating === -1 : f === 'notesOn' ? !!L.note : f === 'snaps' ? (L.kind === 'idea' || L.kind === 'snap' || L.kind === 'section') && L.rating >= 0 : L.kind === f && L.rating >= 0;
function renderLikes(){ const fl = $('likeFilters'), list = $('likeList'); if (!fl) return; const all = Object.entries(LIKES).filter(([, L]) => !L.cleared), q2 = $('likeSearch').value.trim().toLowerCase();
  fl.innerHTML = ''; for (const [k, lab] of FILTERS) { const n = all.filter(([, L]) => inFilter(L, k)).length; fl.append(h('button', {class: 'lchip', 'data-on': likeFilter === k ? '1' : '', onclick: () => { likeFilter = k; renderLikes(); }}, lab, h('small', {}, String(n)))); }
  list.innerHTML = ''; const items = all.filter(([, L]) => inFilter(L, likeFilter) && (!q2 || (L.name + ' ' + (L.note || '') + ' ' + (L.sum || '')).toLowerCase().includes(q2))).sort((a, b) => a[1].at < b[1].at ? 1 : -1);
  if (!items.length) list.append(h('span', {class: 'muted'}, all.length ? 'Nothing here yet.' : 'Nothing liked yet. Tap 👍 on a part, a rhythm, notes, a sound or a ground as you play, and it gathers here.'));
  for (const [id, L] of items) { const it = {kind: L.kind, key: L.key, name: L.name, sum: L.sum, data: L.data};
    list.append(h('div', {class: 'likecard'}, h('span', {class: 'kind'}, KIND_NAMES[L.kind] || L.kind), h('b', {}, L.name), L.sum ? h('span', {class: 'sum'}, L.sum) : '', L.note ? h('span', {class: 'note'}, L.note) : '',
      h('div', {class: 'row'}, canUse(L) ? h('button', {class: 'use', onclick: () => useLike(L)}, 'Use') : '', likeBar(it), h('button', {class: 'mini', title: 'Forget it', onclick: () => saveLike(id, null)}, '✕')))); } }
$('likeSearch').oninput = () => renderLikes();
const canUse = L => L.kind === 'sound' ? !!SND[L.key] : L.kind === 'rhythm' ? !!L.data?.R : L.kind === 'notes' ? !!L.data?.N : L.kind === 'pattern' || L.kind === 'settings' ? !!SND[L.data?.sound] : L.kind === 'harmony' ? !!L.data?.bars : !!byRef(L.key);
const partFor = role => { const c = selCol(); return c.role === role || role && family(c.role) === family(role) && !['kick', 'chords'].includes(role) ? c : st.cols.find(x => x.role === role); };
function useLike(L){ const d = L.data || {};
  if (L.kind === 'sound') { const c = partFor(d.role); if (!c) return; c.locked = true; setSound(c, L.key); saveSounds(); st.sel = st.cols.indexOf(c); renderParts(); renderCard(); flash(`${PART(c)}: ${L.name}`); return; }
  if (L.kind === 'harmony') { if (!PACK.harmonies.some(H => H.id === d.id)) PACK.harmonies.push({id: d.id, name: d.name, words: d.words || '', bars: d.bars}); setHarmony(d.id); return; }
  if (L.kind === 'section') { const x = songOf(L.key); if (x) goSection(x, x.sections.findIndex(y => y.id === L.key)); return; }
  if (L.kind === 'idea' || L.kind === 'snap') { const x = byRef(L.key); if (x) recall(x); return; }
  if (L.kind === 'rhythm') { useLib({name: L.name, R: d.R}, 'rhythm'); return; }
  if (L.kind === 'notes') { const c = partFor(d.role); if (c) { st.sel = st.cols.indexOf(c); renderParts(); } useLib({name: L.name, N: d.N, role: d.role}, 'notes'); return; }
  const c = st.cols.find(x => x.id === d.col && x.role === d.role) || partFor(d.role); if (!c) return; st.sel = st.cols.indexOf(c);
  if (d.sound && SND[d.sound] && c.sound !== d.sound) { c.locked = true; setSound(c, d.sound); saveSounds(); }
  if (L.kind === 'settings') { for (const k of ['x', 'y', 'motion', 'length', 'oct', 'play', 'voicing', 'inv', 'arp', 'echo', 'verb']) if (d.set?.[k] !== undefined) c[k] = d.set[k]; c.arpSt = null; macros(c); lengthTo(c); prewarm(c); renderParts(); renderCard(); flash('Settings: ' + L.name); return; }
  setPart(c, d.R ? {R: clone(d.R), N: d.N ? clone(d.N) : null} : fromClip(c, {len: d.len, steps: d.steps}, CLIP[d.clipId]?.name || 'Liked part'), {keep: false, preset: d.clipId || null}); flash((st.playing ? 'Next bar: ' : '') + L.name); }
async function loadLikes(){ if (!db) return;
  try { const q2 = await db.collection('likes').get(), there = {};
    for (const d of q2.docs) { const L = d.data(); if (!L) continue; there[d.id] = L.at; if (!LIKES[d.id] || LIKES[d.id].at <= L.at) LIKES[d.id] = L; }
    for (const [id, L] of Object.entries(LIKES)) if (!there[id] || there[id] < L.at) try { await db.collection('likes').doc(id).set(L); } catch {}
    storeLikes(); document.querySelectorAll('.likebar').forEach(paintLike); renderHarmony(); renderLikes(); } catch {} }

/* ---------- Claude's ideas (written into the page's database by Claude), and the song: scenes and ideas in an order,
   played as a sketch and sent to Claude, who makes the next round from it ---------- */
let IDEAS = [], ARR = [];
const ARR_KEY = 'studio.jam.arr', BARS = [4, 8, 16, 32], byRef = id => SNAPS.find(x => x.id === id) || IDEAS.find(x => x.id === id) || secNow(id);
try { ARR = JSON.parse(localStorage.getItem(ARR_KEY) || '[]'); } catch {}
const storeArr = () => { try { localStorage.setItem(ARR_KEY, JSON.stringify(ARR)); } catch {} };
function renderIdeas(){ const box = $('ideas'); if (!box) return; box.innerHTML = ''; box.hidden = !IDEAS.length; if (!IDEAS.length) return;
  const rounds = [...new Set(IDEAS.map(x => x.round || 1))].sort((a, b) => b - a);
  for (const r of rounds) { box.append(h('div', {class: 'lab ideahead'}, `Claude’s ideas · round ${r}`)); const g = h('div', {class: 'snapgrid'}); box.append(g);
    for (const x of IDEAS.filter(y => (y.round || 1) === r).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) if (x.sections) g.append(songCard(x)); else
      g.append(h('div', {class: 'snap idea', 'data-on': x.id === snapOn ? '1' : ''},
        h('button', {class: 'go', onclick: () => recall(x)}, h('span', {class: 'kind'}, x.kind || 'idea'), h('b', {}, x.name), h('span', {class: 'muted why'}, x.why || '')),
        h('span', {class: 'ideabtns'}, h('button', {class: 'mini', title: 'Into the song', onclick: () => arrAdd(x.id)}, '＋ Song'), h('button', {class: 'mini', title: 'Keep it in your scenes', onclick: () => keepIdea(x)}, 'Keep'), likeBar({kind: 'idea', key: x.id, name: x.name, data: {id: x.id, round: x.round}})))); } }
/* ---------- Claude's songs: sections in order, each a scene held for its bars. You move to any section (playing, the song
   carries on from there), and what you change while you're on a section is kept as your version of it: the sections
   you've changed are marked, each says what changed against Claude's, the original can be heard again, and a section or
   the whole song reverts. Your versions live on this device and in the page's database (`songs`, one per song), so
   Claude reads them for the next round ---------- */
let EDITS = {}; const EDITS_KEY = 'studio.jam.songedits';
try { EDITS = JSON.parse(localStorage.getItem(EDITS_KEY) || '{}'); } catch {}
const storeEdits = () => { try { localStorage.setItem(EDITS_KEY, JSON.stringify(EDITS)); } catch {} };
const songOf = id => IDEAS.find(x => x.sections?.some(y => y.id === id) || x.id === id);
const origSec = id => IDEAS.flatMap(x => x.sections || []).find(y => y.id === id);
const secNow = id => EDITS[id]?.scene || origSec(id);
const shortName = y => y.name.split(': ').slice(1).join(': ') || y.name;
// what a section as you have it changes against Claude's: [[part, [what, …]], …]
const COLNAME = (i, role) => role === 'lead' && i > 5 ? 'Lead 2' : (ROLE_NAMES[role] || role).replace('Bells and leads', 'Lead');
const sig = m => m ? JSON.stringify([m.len, m.hits || m.seq, m.feel || 0]) : '';
function changes(a, b){ const out = [], near = (x, y, d) => Math.abs((x ?? 0) - (y ?? 0)) <= d;
  if ((a.harmony !== b.harmony)) out.push(['Ground', [`${a.harmonyName || a.harmony} → ${b.harmonyName || b.harmony}`]]);
  if (a.bpm !== b.bpm) out.push(['Tempo', [`${a.bpm} → ${b.bpm} BPM`]]);
  a.cols.forEach((ca, i) => { const cb = b.cols[i]; if (!cb) return; const w = [], on = !!ca.rhythm, on2 = !!cb.rhythm;
    if (on !== on2) w.push(on2 ? 'comes in' : 'rests');
    if (ca.sound !== cb.sound) w.push(`sound: ${SND[cb.sound]?.name || cb.sound}`);
    if (on && on2) { if (sig(ca.rhythm) !== sig(cb.rhythm)) w.push(`rhythm: ${cb.rhythm.name}`); if (sig(ca.notes) !== sig(cb.notes) && ca.role !== 'chords') w.push(`notes: ${cb.notes?.name || '—'}`); }
    if ((ca.play || 0) !== (cb.play || 0)) w.push(`life: ${PLAYS[cb.play || 0].name.toLowerCase()}`);
    if (!!ca.mute !== !!cb.mute) w.push(cb.mute ? 'muted' : 'unmuted');
    const ma = ca.mix || {}, mb = cb.mix || {}; if (!near(ma.vol, mb.vol, .4)) w.push(`level ${fmtDb(mb.vol ?? 0)}`); if (!near(ma.pan, mb.pan, .04)) w.push(`pan ${fmtPan(mb.pan ?? 0)}`);
    if (['lo', 'mid', 'hi'].some(k => !near(ma[k], mb[k], .4))) w.push('EQ'); if ((ma.duck ?? 0) !== (mb.duck ?? 0)) w.push(`duck ${DUCKS[mb.duck ?? 0][0].toLowerCase()}`);
    if (!near(ca.x, cb.x, .03)) w.push(cb.x > ca.x ? 'brighter' : 'darker'); if (!near(ca.y, cb.y, .03)) w.push(cb.y > ca.y ? 'further' : 'nearer');
    if (ca.length !== cb.length) w.push(['short', 'normal', 'long'][cb.length] + ' notes'); if ((ca.motion || 0) !== (cb.motion || 0)) w.push('motion ' + ['still', 'slow', 'fast', 'pulse'][cb.motion]);
    if ((ca.oct || 0) !== (cb.oct || 0)) w.push(`octave ${cb.oct > 0 ? '+' : ''}${cb.oct}`); if (!!ca.echo !== !!cb.echo) w.push(cb.echo ? 'echo on' : 'echo off'); if (!!ca.verb !== !!cb.verb) w.push(cb.verb ? 'reverb on' : 'reverb off');
    if ((ca.voicing || 0) !== (cb.voicing || 0) || (ca.inv || 0) !== (cb.inv || 0) || (ca.arp || 0) !== (cb.arp || 0)) w.push('voicing');
    if (w.length) out.push([COLNAME(i, ca.role), w]); });
  return out; }
// the section you're on, kept as your version when it differs from Claude's (and forgotten again when it's back as it was);
// not while you're hearing the original
function keepEdit(){ const c = st.cur; if (!c || c.orig || !PACK || st.recalling) return; const y = origSec(c.sec); if (!y || y.pack !== PACK.id) return;
  const now = capture(), sc = {...clone(y), harmony: now.harmony, harmonyName: now.harmonyName, harmonyBars: now.harmonyBars, bpm: now.bpm, smooth: now.smooth, echoDiv: now.echoDiv, mx: now.mx, cols: now.cols};
  const had = EDITS[c.sec], diff = changes(y, sc).length;
  if (!diff) { if (had) { delete EDITS[c.sec]; editsChanged(c.sec); } return; }
  if (had && !changes(had.scene, sc).length) return;
  EDITS[c.sec] = {scene: sc, at: new Date().toISOString()}; editsChanged(c.sec); }
setInterval(keepEdit, 1500); addEventListener('visibilitychange', () => document.hidden && keepEdit());
function editsChanged(secId){ storeEdits(); renderIdeas(); renderSongBar(); const x = songOf(secId); if (!x || !db) return; clearTimeout(editsChanged.t[x.id]);
  editsChanged.t[x.id] = setTimeout(() => db.collection('songs').doc(x.id).set({song: x.id, name: x.name, round: x.round, edits: Object.fromEntries(x.sections.filter(y => EDITS[y.id]).map(y => [y.id, EDITS[y.id]])), at: new Date().toISOString()}).catch(() => {}), 2000); }
editsChanged.t = {};
async function loadEdits(){ if (!db) return; try { const q2 = await db.collection('songs').get();
  for (const d of q2.docs) { const r = d.data(); for (const [id, e] of Object.entries(r?.edits || {})) if (!EDITS[id] || EDITS[id].at < e.at) EDITS[id] = e; }
  storeEdits(); renderIdeas(); renderSongBar(); } catch {} }
// to a section: heard from the next bar; while its song plays, the song carries on from there
function goSection(x, i, o = {}){ const y = x.sections[i]; if (!y) return; keepEdit(); st.cur = {song: x.id, sec: y.id, orig: !!o.orig};
  recall(o.orig ? y : secNow(y.id), {keepCur: true});
  if (st.arr?.song === x.id) { st.arr.i = i; st.arr.next = (st.playing ? Math.ceil(st.step/16)*16 : 0) + y.bars*16; delete st.arr.p; }
  renderIdeas(); renderSongBar(); }
const curIn = x => st.cur && songOf(st.cur.sec)?.id === x.id ? x.sections.findIndex(y => y.id === st.cur.sec) : -1;
// (the part you're on is left first, so what's playing isn't kept again as your version)
function revertSec(id){ const here = st.cur?.sec === id; if (here) st.cur = null; delete EDITS[id]; editsChanged(id); const x = songOf(id), i = x.sections.findIndex(y => y.id === id); if (here) goSection(x, i); flash('Back to Claude’s version'); }
function revertSong(x){ if (!confirm(`Put every part of “${x.name}” back as Claude wrote it?`)) return; const i = curIn(x); if (i >= 0) st.cur = null; for (const y of x.sections) delete EDITS[y.id]; storeEdits(); editsChanged(x.sections[0].id);
  if (i >= 0) goSection(x, i); flash(x.name + ': back to Claude’s version'); }
const secItem = (x, y) => ({kind: 'section', key: y.id, name: y.name, sum: `${x.name} · ${y.bars} bars${EDITS[y.id] ? ' · changed by you' : ''}`, data: {song: x.id, section: y.id}});
// a section's detail: where it is, what it is, what you've changed, and its likes
function secDetail(x, i, compact){ const y = x.sections[i], e = EDITS[y.id], ch = e ? changes(y, e.scene) : [], orig = st.cur?.orig;
  return h('div', {class: 'secdetail'},
    h('div', {class: 'sdhead'}, h('button', {class: 'mini', 'aria-label': 'The section before', disabled: i ? undefined : '', onclick: () => goSection(x, i - 1)}, '‹'),
      h('b', {}, `${compact ? x.name + ' › ' : ''}${i + 1}. ${shortName(y)}`), h('small', {class: 'muted'}, ` ${y.bars} bars`),
      h('button', {class: 'mini', 'aria-label': 'The next section', disabled: i < x.sections.length - 1 ? undefined : '', onclick: () => goSection(x, i + 1)}, '›'), h('span', {class: 'spacer'}), likeBar(secItem(x, y))),
    compact ? '' : h('div', {class: 'muted why'}, y.why || ''),
    h('div', {class: 'sdchanges', 'data-orig': orig ? '1' : ''}, orig ? 'Hearing Claude’s original. Your changes aren’t kept while you do.' : !ch.length ? 'As Claude wrote it. Change anything and it’s kept as your version of this part.' :
      h('span', {}, h('b', {}, 'Your changes: '), ch.map(([p, w]) => `${p} ${w.join(', ')}`).join(' · '))),
    h('div', {class: 'sdbtns'}, e || orig ? h('button', {class: 'mini', onclick: () => goSection(x, i, {orig: !orig})}, orig ? 'Back to yours' : 'Hear Claude’s') : '',
      e ? h('button', {class: 'mini', onclick: () => revertSec(y.id)}, 'Revert this part') : '',
      st.arr?.song === x.id ? h('button', {class: 'mini', 'aria-pressed': String(!!st.arr.hold), title: 'Stay on this part instead of moving on', onclick: () => { st.arr.hold = !st.arr.hold; renderIdeas(); renderSongBar(); }}, st.arr.hold ? '⟲ Staying here' : '⟲ Stay here') : '')); }
function songCard(x){ const on = st.arr?.song === x.id, bars = x.sections.reduce((n, y) => n + y.bars, 0), secs = Math.round(bars*4*60/(x.bpm || st.bpm)), cur = curIn(x), nEd = x.sections.filter(y => EDITS[y.id]).length;
  return h('div', {class: 'snap idea song', 'data-on': on ? '1' : ''},
    h('div', {class: 'go'}, h('span', {class: 'kind'}, `song · ${bars} bars · ${Math.floor(secs/60)}:${String(secs % 60).padStart(2, '0')}${nEd ? ` · ${nEd} part${nEd > 1 ? 's' : ''} changed by you` : ''}`), h('b', {}, x.name), h('span', {class: 'muted why'}, x.why || '')),
    h('div', {class: 'secs'}, ...x.sections.map((y, i) => h('button', {class: 'sec', 'data-on': on && st.arr.i === i ? '1' : '', 'data-cur': cur === i ? '1' : '', 'data-ed': EDITS[y.id] ? '1' : '', title: (y.why || '') + (EDITS[y.id] ? ' (changed by you)' : '') + ' — tap to go to it', onclick: () => goSection(x, i)},
      h('b', {}, shortName(y)), h('small', {}, `${y.bars}`)))),
    cur >= 0 ? secDetail(x, cur) : '',
    h('span', {class: 'ideabtns'}, h('button', {class: 'mini', onclick: () => songPlay(x)}, on ? '■ Stop' : cur > 0 ? `▶ Play from ${shortName(x.sections[cur])}` : '▶ Play the song'),
      h('button', {class: 'mini', title: 'Its sections (with your changes) into your song, to reorder and send back', onclick: () => { ARR = x.sections.map(y => ({ref: y.id, bars: y.bars})); storeArr(); renderArr(); flash(x.name + ' is your song now'); }}, 'Make it my song'),
      nEd ? h('button', {class: 'mini', onclick: () => revertSong(x)}, 'Revert the whole song') : '',
      likeBar({kind: 'idea', key: x.id, name: x.name, data: {id: x.id, round: x.round}}))); }
// the song you're in, over the parts (where you change things): the section, what's changed, its likes
function renderSongBar(){ const box = $('songBar'); if (!box) return; const x = st.cur && songOf(st.cur.sec); box.innerHTML = ''; box.hidden = !x; if (!x) return;
  box.append(secDetail(x, curIn(x), true)); }
function songPlay(x){ if (st.arr?.song === x.id) { st.arr = null; renderIdeas(); renderSongBar(); flash('Song stopped'); return; } const from = Math.max(0, curIn(x));
  arrPlay(x.sections.map(y => ({ref: y.id, bars: y.bars})), x.id, from); }
async function keepIdea(x){ const y = {...clone(x), id: 's' + Date.now().toString(36), name: x.name, from: x.id, at: new Date().toISOString()}; for (const k of ['round', 'kind', 'why', 'order']) delete y[k];
  SNAPS.push(y); storeSnaps(); renderSnaps(); flash('Kept ' + x.name + ' in your scenes'); if (db) try { await db.collection('snaps').doc(y.id).set(y); } catch {} }
function arrAdd(id){ ARR.push({ref: id, bars: 8}); storeArr(); renderArr(); flash('Into the song: ' + byRef(id)?.name); }
function renderArr(){ const box = $('arr'); if (!box) return; box.innerHTML = ''; const playing = st.arr && !st.arr.song ? st.arr.i : -1;
  if (!ARR.length) box.append(h('span', {class: 'muted'}, 'Tap ＋ Song on any scene or idea to put it here, in the order you want.'));
  ARR.forEach((e, i) => { const x = byRef(e.ref);
    box.append(h('div', {class: 'arrchip', 'data-on': i === playing ? '1' : ''},
      h('button', {class: 'arrname', title: 'Tap to change its length', onclick: () => { e.bars = BARS[(BARS.indexOf(e.bars) + 1) % BARS.length]; storeArr(); renderArr(); }}, h('b', {}, `${i + 1} · ${x?.name || '(gone)'}`), h('span', {}, e.bars + ' bars')),
      h('span', {class: 'arrbtns'}, h('button', {class: 'mini', 'aria-label': 'Earlier', onclick: () => { if (i) { [ARR[i - 1], ARR[i]] = [ARR[i], ARR[i - 1]]; storeArr(); renderArr(); } }}, '◀'),
        h('button', {class: 'mini', 'aria-label': 'Later', onclick: () => { if (i < ARR.length - 1) { [ARR[i + 1], ARR[i]] = [ARR[i], ARR[i + 1]]; storeArr(); renderArr(); } }}, '▶'),
        h('button', {class: 'mini', 'aria-label': 'Remove', onclick: () => { ARR.splice(i, 1); storeArr(); renderArr(); }}, '✕')))); });
  $('arrPlay').textContent = st.arr && !st.arr.song ? '■ Stop the song' : '▶ Play the song'; $('arrPlay').disabled = !ARR.length; $('arrSend').disabled = !ARR.length; }
// playing it: each scene is recalled a bar before it begins, so its parts land on its first bar. list: your song (going
// round), or one of Claude's (song: its id; played through once from `from`, then it stops; a section held with Stay here)
const goRef = ref => { if (origSec(ref)) { keepEdit(); st.cur = {song: songOf(ref).id, sec: ref, orig: false}; recall(secNow(ref), {keepCur: true}); renderSongBar(); return true; }
  const z = byRef(ref); if (z) { recall(z); return true; } return false; };
function arrPlay(list = ARR, song = null, from = 0){ if (st.arr && !song) { st.arr = null; renderArr(); renderIdeas(); flash('Song stopped: carrying on with what’s playing'); return; } if (!list.length) return;
  if (!goRef(list[from].ref)) return;
  const at = st.playing ? Math.ceil(st.step/16)*16 : 0; st.arr = {list, song, i: from, next: at + list[from].bars*16}; if (!st.playing) start(); renderArr(); renderIdeas(); }
function arrBar(step){ const a = st.arr; if (!a || !a.list.length) return; const L = a.list;
  if (a.hold) { if (step >= a.next) a.next = step + L[a.i].bars*16; return; }
  const end = a.song && a.i === L.length - 1;
  if (step === a.next - 16 && !end) { a.p = (a.i + 1) % L.length; goRef(L[a.p].ref); }
  if (step >= a.next) { if (end) { st.arr = null; renderIdeas(); renderSongBar(); flash('The end'); setTimeout(() => st.playing && stop(), 0); return; }
    a.i = a.p ?? (a.i + 1) % L.length; delete a.p; a.next = step + L[a.i].bars*16; renderArr(); if (a.song) { renderIdeas(); renderSongBar(); flash(byRef(L[a.i].ref)?.name || ''); } } }
async function arrSend(){ if (!ARR.length) return; if (!db) { flash('Sign in to claude.ai to send'); return; }
  const refs = [...new Set(ARR.map(e => e.ref))], note = $('arrNote').value.trim();
  const row = {note, pack: PACK.id, entries: ARR.map(e => ({ref: e.ref, bars: e.bars, name: byRef(e.ref)?.name || '', idea: !!IDEAS.find(x => x.id === e.ref)})), snaps: refs.map(byRef).filter(Boolean), at: new Date().toISOString()};
  try { await db.collection('arrangements').add(row); $('arrNote').value = ''; flash('Sent to Claude: tell Claude it’s there'); $('arrMsg').textContent = `Sent ${new Date().toLocaleTimeString()}: ${ARR.length} scenes. Tell Claude, and the next round of ideas will come from it.`; }
  catch (err) { flash('Not sent (' + (err.code || err.message) + ')'); } }
$('arrPlay').onclick = () => arrPlay(); $('arrSend').onclick = arrSend;
async function loadIdeas(){ if (!db) return; try { const q2 = await db.collection('ideas').get(); IDEAS = q2.docs.map(d => ({...d.data(), id: d.id})).filter(x => x.cols || x.sections); renderIdeas(); renderArr(); renderSongBar(); } catch {} }
window.__jamSound = (i, id) => setSound(st.cols[i], id);   // (for tests)
window.__jamAudio = () => ctx && {ctx, master, out: mstr.vol, echo: rets.echo.duck, verb: rets.verb.duck, cols: st.cols};   // (for the mix tools)
window.__jamIdeas = list => { IDEAS = list; renderIdeas(); renderSongBar(); };   // (for tests)
async function loadSnaps(){ try { SNAPS = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch { SNAPS = []; } renderSnaps();
  if (!db) return; try { const q2 = await db.collection('snaps').get(), have = new Set(SNAPS.map(x => x.id));
    for (const d of q2.docs) { const x = d.data(); if (x && !have.has(x.id)) SNAPS.push(x); }
    for (const x of SNAPS) if (!q2.docs.some(d => d.id === x.id)) try { await db.collection('snaps').doc(x.id).set(x); } catch {}
    SNAPS.sort((a, b) => a.at < b.at ? -1 : 1); storeSnaps(); renderSnaps(); renderArr(); } catch {} }
async function loadLib(){ if (!db) return; try { const q2 = await db.collection('library').get(), have = new Set(MYLIB.map(x => x.id));
    for (const d of q2.docs) { const x = d.data(); if (x && !have.has(x.id)) MYLIB.push(x); } for (const x of MYLIB) if (!q2.docs.some(d => d.id === x.id)) db.collection('library').doc(x.id).set(x).catch(() => {});
    MYLIB.sort((a, b) => a.at < b.at ? 1 : -1); storeLib(); renderLibrary(); } catch {} }

/* ---------- keeping a take (the page's database) ---------- */
let db = null;
$('keepJam').onclick = async () => { if (!db || !lastTake) return; $('keepJam').disabled = true; $('takeNote').textContent = 'Keeping…';
  const used = [...new Set(lastTake.notes.map(n => n[2]).concat(lastTake.macros.filter(m => String(m[2]).startsWith('sound:')).map(m => m[2].slice(6))))];
  try { await db.collection('jams').add({name: $('jamName').value.trim() || `Jam at ${st.bpm} BPM`, note: $('jamNote').value.trim(), pack: PACK.id, bpm: lastTake.bpm, swing: lastTake.swing, echoDiv: lastTake.echoDiv, mix: lastTake.mix, mx: lastTake.mx, bars: lastTake.bars,
      columns: st.cols.map(c => ({id: c.id, role: c.role})), sounds: used.map(id => SND[id]).filter(Boolean), notes: lastTake.notes, macros: lastTake.macros, at: new Date().toISOString()});
    $('takeNote').textContent = 'Kept. Claude will render it at full quality into the listening room.'; lastTake = null; }
  catch (err) { $('takeNote').textContent = 'Not kept (' + (err.code || err.message) + '). Try again.'; $('keepJam').disabled = false; } };

/* ---------- each pack remembers its parts' sounds (from any pack) and its parts as they were left ---------- */
const soundsKey = () => 'studio.jam.sounds.' + PACK.id, partsKey = () => 'studio.jam.parts.' + PACK.id;
function saveSounds(){ try { localStorage.setItem(soundsKey(), JSON.stringify(st.cols.map(c => c.locked ? c.sound : null))); } catch {} }
function packSounds(){ st.cols.forEach((c, i) => { c.locked = false; setSound(c, PACK.columns[i].sound); }); try { localStorage.removeItem(soundsKey()); } catch {} flash('Back to this pack’s own sounds'); }
const PART_KEEP = ['x', 'y', 'motion', 'length', 'oct', 'play', 'echo', 'verb', 'voicing', 'inv', 'arp', 'walk', 'preset'];
function storeParts(){ clearTimeout(storeParts.t); storeParts.t = setTimeout(() => { if (!PACK) return; try { localStorage.setItem(partsKey(), JSON.stringify(st.cols.map(c => { const s = shown(c); return {R: s.R, N: s.N, ...Object.fromEntries(PART_KEEP.map(k => [k, c[k]]))}; }))); } catch {} }, 300); }

/* ---------- the phone: a page at a time, picked from the tabs at the bottom ---------- */
function setTab(t){ if (!['parts', 'ground', 'scenes', 'library', 'mix', 'more'].includes(t)) t = 'parts'; document.body.dataset.tab = t; try { localStorage.setItem('studio.jam.tab2', t); } catch {}
  document.querySelectorAll('#tabs button').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (t === 'mix') renderMix(); if (t === 'more') renderLikes(); if (t === 'library') renderLibrary(); requestAnimationFrame(() => renderCard()); scrollTo(0, 0); }
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
const phoneMQ = matchMedia('(max-width: 640px)');
// on a phone the tempo lives on the More page (the top bar has room only for Play, Record and the chord)
const placeTempo = () => { const tp = document.querySelector('.tempo'); if (phoneMQ.matches) document.querySelector('.tempoSlot').append(tp); else document.querySelector('.chordbox').before(tp); };
phoneMQ.addEventListener?.('change', placeTempo); placeTempo();

/* ---------- buttons and keys ---------- */
$('singB').onclick = () => singOpen(); $('cardMute').onclick = () => { const c = selCol(); c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderParts(); renderCard(); };
$('keepB').onclick = keepPlayed; $('savePart').onclick = () => saveModule('P'); $('packSounds').onclick = packSounds;
for (const [id, fn] of [['m-build', 'build'], ['m-drop', 'drop'], ['m-harm', 'harmony']]) $(id).onclick = () => MOVES[fn]();
$('m-rep').addEventListener('pointerdown', () => repeat(true)); for (const ev of ['pointerup', 'pointerleave']) $('m-rep').addEventListener(ev, () => repeat(false));
$('m-snap').onclick = () => saveSnap();
$('play').onclick = () => st.playing ? stop() : start();
$('rec').onclick = () => record(); $('engAB').onclick = () => engSet(!st.eng); engSet(st.eng, true);
for (const [id, d] of [['bpmDown', -2], ['bpmUp', 2]]) $(id).onclick = () => { st.bpm = Math.max(100, Math.min(140, st.bpm + d)); $('bpmOut').textContent = st.bpm; tempo(); };
// the keyboard: Space play; 1–8 the pack's scenes, Shift+1–9 yours; Q–U a part (Shift mutes); ↑ ↓ the pack's parts for it;
// ← → its tone; N new and V vary (the tab's module, Shift for its notes); P life; X keep that; Z undo; F feel; B D H O moves;
// S save a scene; G K echo and reverb; hold J throw; [ ] octave; A Claude's mix or the plain one
const tabMod = () => st.tab === 'notes' ? 'n' : 'r';
document.addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return; const k = e.key.toUpperCase();
  if (e.key === ' ') { e.preventDefault(); st.playing ? stop() : start(); return; }
  const dg = /^Digit([1-9])$/.exec(e.code); if (e.shiftKey && dg) { const x = SNAPS[+dg[1] - 1]; if (x) recall(x); return; }
  if (/^[1-8]$/.test(e.key)) { scene(+e.key - 1); return; }
  if (k === 'S' && !e.shiftKey) { saveSnap(); return; }
  const ci = 'QWERTYU'.indexOf(k); if (ci >= 0 && ci < st.cols.length && !e.repeat) { if (e.shiftKey) { const c = st.cols[ci]; c.mute = !c.mute; macros(c); renderParts(); renderCard(); } else { st.sel = ci; renderParts(); renderCard(); renderLibrary(); } return; }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); stepPreset(selCol(), e.key === 'ArrowDown' ? 1 : -1); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const c = selCol(); c.x = Math.max(0, Math.min(1, c.x + (e.key === 'ArrowRight' ? .08 : -.08))); macros(c); if (st.tab === 'sound') renderCard(); return; }
  const mod = e.shiftKey ? 'n' : tabMod();
  if (k === 'N') (mod === 'n' ? nTool : rTool)('new'); if (k === 'V') (mod === 'n' ? nTool : rTool)('vary');
  if (k === 'B') MOVES.build(); if (k === 'D') MOVES.drop(); if (k === 'H') MOVES.harmony(); if (k === 'O') repeat(true); if (e.key === '[') octave(-1); if (e.key === ']') octave(1);
  if (k === 'F') nextFeel(); if (k === 'P') { const c = selCol(); setLife(c, ((c.play || 0) + 1) % PLAYS.length); } if (k === 'X') keepPlayed(); if (k === 'Z') undo();
  if (k === 'A') engSet(!st.eng); if (k === 'G') sendTog('echo'); if (k === 'K') sendTog('verb'); if (k === 'J' && !e.repeat) throwTo(true); });
document.addEventListener('keyup', e => { if (e.key.toUpperCase() === 'O') repeat(false); if (e.key.toUpperCase() === 'J') throwTo(false); });
addEventListener('resize', () => renderCard());

/* ---------- the packs: each round of ideas Claude makes; switching stops the music and lays out the new pack's parts ---------- */
async function loadPack(id){ if (st.playing) stop();
  for (const c of st.cols) { try { c.ch?.out.disconnect(); c.ch?.lfo.stop(); } catch {} }
  PACK = ALLPACKS.find(p => p.id === id).data; try { localStorage.setItem('studio.jam.pack', id); } catch {}
  CLIP = Object.fromEntries(PACK.clips.map(c => [c.id, c]));
  st.bpm = PACK.bpm; st.swing = PACK.swing; $('bpmOut').textContent = st.bpm; st.harmony = PACK.harmonies[0]; st.hNext = null; st.sel = 0; st.scene = null;
  let chosen = [], kept = []; try { chosen = JSON.parse(localStorage.getItem(soundsKey()) || '[]'); kept = JSON.parse(localStorage.getItem(partsKey()) || '[]'); } catch {}
  st.cols = PACK.columns.map((c, i) => ({...c, ...(SND[chosen[i]] ? {sound: chosen[i], locked: true} : {}), feel0: c.feel || 0, x: X0(c.role), y: .3, motion: 0, length: 1, oct: 0, play: 0, echo: true, verb: true, voicing: 0, inv: 0, arp: 0, walk: false, level: .85, mix: mixOf(c, i),
    R: null, N: null, clip: null, start: 0, ...Object.fromEntries(['echo', 'verb', 'voicing'].filter(k => c[k] !== undefined).map(k => [k, c[k]]))}));
  st.mx = {...MASTER0, ...(savedMix().master || {})}; if (ctx) { for (const c of st.cols) { makeChan(c); buildSound(c); } tempo(); masterMix(); }
  // a pack comes back as it was left; the first time, on its second scene
  if (kept.length === st.cols.length) st.cols.forEach((c, i) => { const k = kept[i]; for (const f of PART_KEEP) if (k[f] !== undefined) c[f] = k[f]; c.R = k.R; c.N = k.N; c.clip = k.R ? join(c.role, k.R, k.N) : null; prewarm(c); });
  else scene(Math.min(1, PACK.scenes.length - 1));
  renderPacks(); renderHarmony(); renderScenes(); renderParts(); renderCard(); renderSnaps(); renderMix(); renderLibrary(); busy(); }
function renderPacks(){ const box = $('packs'); box.innerHTML = ''; box.append(h('span', {class: 'lab'}, 'Pack'));
  for (const p of ALLPACKS) box.append(h('button', {class: 'pchip', 'data-on': p.id === PACK?.id ? '1' : '', title: p.words || '', onclick: () => p.id !== PACK.id && loadPack(p.id)}, p.name));
  if (PACK?.words) box.append(h('span', {class: 'muted'}, PACK.words)); }
(async () => {
  let index = []; try { index = (await (await fetch('packs/index.json')).json()).packs; } catch { index = [{id: 'pack-1', name: 'Pack 1'}]; }
  ALLPACKS = (await Promise.all(index.map(async p => { try { return {...p, data: await (await fetch(`packs/${p.id}.json`)).json()}; } catch { return null; } }))).filter(Boolean);
  try { LIB = (await (await fetch('packs/library.json')).json()).sounds; } catch { LIB = []; }
  if (!LIB.length) for (const p of ALLPACKS) LIB.push(...p.data.sounds.map(s => ({...s, pack: p.id})));
  SND = Object.fromEntries(LIB.map(s => [s.id, s]));
  try { st.tab = localStorage.getItem('studio.jam.ctab') || 'rhythm'; } catch {}
  let want = null; try { want = localStorage.getItem('studio.jam.pack'); } catch {}
  await loadPack(ALLPACKS.some(p => p.id === want) ? want : ALLPACKS.at(-1).id);
  let tab = 'parts'; try { tab = localStorage.getItem('studio.jam.tab2') || 'parts'; } catch {} setTab(tab); renderLikes();
  loadSnaps(); renderArr();
  db = await window.claude?.use?.('db').catch(() => null) || null;
  loadSnaps(); loadIdeas(); loadLikes(); loadLib(); loadEdits();
})();
