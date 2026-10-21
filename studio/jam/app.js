// Studio Jam: a clip launcher for the ideas Claude makes. Columns are roles (kick, hats, percussion, bass, chords, two
// leads), each playing one clip at a time on one sound from the library; clips follow the harmony (model.js), so any
// clip on any sound over any progression. Everything changes on the next bar. No notes and no sliders: an XY pad (tone
// across, space up), two step buttons (motion, length), jam moves (vary, mutate, build, drop, repeat, next harmony), the
// keyboard. Record writes down what plays, for Claude to render; 👍 / 👎 on clips, sounds and harmonies.
import { improvise, reach, keep, PLAYS } from './play.js';
import { TOOLS, TNAMES, MAX as RIFF_MAX } from './riff.js';
import { notesAt, chordOf, mutate, ROLE_NAMES, nativeSet, cutOf, LEN, X0, vlChain, invert, STYLES, FEELS, feelAt, XFORMS, XNAMES, FOLLOW, ARPS, ECHO } from './model.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { NATIVE } from '../lib/native/index.js';
import { makePoly, PRESETS } from '../../src/audio/engine/inst/poly.js';
import { makeDrums } from '../../src/audio/engine/inst/drums.js';
import widthFx from '../../src/audio/engine/fx/width.js';

const $ = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v != null) e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };
let PACK = null, SND = {}, CLIP = {}, LIB = [];
const st = {smooth: (() => { try { return localStorage.getItem('studio.jam.smooth') !== '0'; } catch { return true; } })(), echoDiv: 0, bar: 0, bpm: 124, swing: .06, harmony: null, hNext: null, hStart: 0, cols: [], sel: 0, playing: false, step: 0, rec: null, build: null, drop: null, rep: null};

/* ---------- audio: a channel per column (filter with an LFO, pan, the kick's pump, echo and reverb sends) ---------- */
let ctx, master, hp, delay, verb, worker, nextT = 0, timer = 0, mstr = null;
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
  delay.lp.frequency.value = 2400; delay.fb.gain.value = .45; delay.in.connect(delay.d); delay.d.connect(delay.lp); delay.lp.connect(delay.fb); delay.fb.connect(delay.d); delay.lp.connect(master);
  verb = ctx.createConvolver(); const L = 2.8*ctx.sampleRate, ir = ctx.createBuffer(2, L, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); let lp = 0; for (let i = 0; i < L; i++) { lp += (.3 - .25*i/L)*((Math.random()*2 - 1) - lp); x[i] = lp*Math.pow(1 - i/L, 2.2); } }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .8; verb.connect(vg); vg.connect(master);
  worker = new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent], {type: 'text/javascript'})));
  worker.onmessage = e => { const {key, L, R, error} = e.data; pending.delete(key); if (!error) { const b = ctx.createBuffer(2, L.length, ctx.sampleRate); b.copyToChannel(L, 0); b.copyToChannel(R, 1); cache.set(key, b); } busy(); };
  for (const c of st.cols) { makeChan(c); buildSound(c); } tempo(); masterMix(); renderMix();
}
function makeChan(c){ const x = {in: ctx.createGain(), lo: ctx.createBiquadFilter(), mid: ctx.createBiquadFilter(), hi: ctx.createBiquadFilter(), f: ctx.createBiquadFilter(), pan: ctx.createStereoPanner(), duck: ctx.createGain(), out: ctx.createGain(), echo: ctx.createGain(), verb: ctx.createGain(), lfo: ctx.createOscillator(), lfoG: ctx.createGain(), meter: ctx.createAnalyser()};
  // the channel: its EQ (low shelf, a bell in the middle, a high shelf), the tone filter, pan, the sidechain duck, the fader
  x.lo.type = 'lowshelf'; x.lo.frequency.value = 120; x.mid.type = 'peaking'; x.mid.frequency.value = 1000; x.mid.Q.value = .8; x.hi.type = 'highshelf'; x.hi.frequency.value = 6000; x.meter.fftSize = 512;
  x.in.connect(x.lo); x.lo.connect(x.mid); x.mid.connect(x.hi); x.hi.connect(x.f); x.f.connect(x.pan); x.out.connect(x.meter); x.pan.connect(x.duck); x.duck.connect(x.out); x.out.connect(master); x.out.connect(x.echo); x.out.connect(x.verb); x.echo.connect(delay.in); x.verb.connect(verb);
  x.lfo.connect(x.lfoG); x.lfoG.connect(x.f.frequency); x.lfo.start(); x.f.Q.value = 1.2; c.ch = x; macros(c); }
// the macros: tone (the channel's filter, and a native sound's mallet), space (echo and reverb), motion (the LFO), length
function macros(c){ if (!c.ch) return; const x = c.ch, now = ctx.currentTime, s = .05;
  x.f.frequency.setTargetAtTime(cutOf(c.x), now, s); x.echo.gain.setTargetAtTime(c.throw ? .95 : c.echo ? c.y*.5 : 0, now, c.throw ? .005 : s); x.verb.gain.setTargetAtTime(c.verb ? c.y*.75 : 0, now, s);
  const M = c.mix, solo = st.cols.some(y => y.mix.solo); x.out.gain.setTargetAtTime(c.mute || solo && !M.solo ? 0 : c.level*Math.pow(10, M.vol/20), now, .02);
  x.pan.pan.setTargetAtTime(M.pan, now, .02); x.lo.gain.setTargetAtTime(M.lo, now, .02); x.mid.gain.setTargetAtTime(M.mid, now, .02); x.hi.gain.setTargetAtTime(M.hi, now, .02);
  const rate = [0, 1/(8*60/st.bpm), 1/(.5*60/st.bpm)][c.motion]; x.lfo.frequency.setTargetAtTime(rate || .1, now, s); x.lfoG.gain.setTargetAtTime([0, .45, .35][c.motion]*cutOf(c.x), now, s); }
function tempo(){ if (!ctx) return; delay.d.delayTime.setTargetAtTime(ECHO[st.echoDiv][1]*60/st.bpm, ctx.currentTime, .05); for (const c of st.cols) macros(c); }

/* ---------- sounds: a column's sound built on its channel (poly synth, drum kits, native instruments) ---------- */
const env = {period: () => 60/st.bpm};
function buildSound(c){ if (!ctx) return; const s = SND[c.sound]; c.inst = {kind: 'pitched'};
  if (s.voices) { const kits = {}; c.inst = {kind: 'drums', voices: {}};
    for (const [v, m] of Object.entries(s.voices)) { if (m.native) { c.inst.voices[v] = {native: m.native, n: m.n, set: m.set || {}}; continue; }
      const key = m.kit + JSON.stringify(m.over || {}); if (!kits[key]) { kits[key] = makeDrums(ctx, c.ch.in); kits[key].load(m.kit, m.over || {}); } c.inst.voices[v] = {kit: kits[key]}; } return; }
  const src = s.src; if (src.palette && !NATIVE_OF[src.palette]) { const [p, set] = PAL[src.palette], syn = makePoly(ctx, c.ch.in, env); syn.load({...PRESETS[p], chord: 0, ...set}); c.inst.poly = syn; c.inst.base = set; }
  else { const name = src.native || NATIVE_OF[src.palette], oct = src.palette ? 12*(PAL[src.palette][1].oct || 0) : 0; c.inst.native = name; c.inst.shift = (src.shift || 0) + oct; c.inst.set = src.set || {}; }
  lengthTo(c); }
// length: a synth's decay and release stretch (a native sound's ring: nativeSet in model.js)
function lengthTo(c){ if (c.inst?.poly) { const b = c.inst.base; c.inst.poly.set('ad', (b.ad ?? .3)*LEN[c.length]); c.inst.poly.set('ar', (b.ar ?? .2)*LEN[c.length]); } }
const q = (v, s) => Math.round(v/s)*s;
const keyOf = (name, n, vel, o) => `${name}|${n}|${q(vel, .1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;
function nativeNote(c, name, n, vel, o, t, lenSec, fv = 1){ const set = NATIVE[name].held ? {...o, len: Math.round(lenSec*20)/20} : o, k = keyOf(name, n, vel, set), b = cache.get(k);
  if (!b) { want(k, name, n, vel, set); return; }
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = NATIVE[name].gain*(.4 + .6*vel)*fv; s.connect(g); g.connect(c.ch.in); s.start(t); s.onended = () => g.disconnect(); }
function want(k, name, n, vel, set){ if (cache.has(k) || pending.has(k) || !worker) return; pending.add(k); worker.postMessage({key: k, name, n, vel: q(vel, .1), o: set, sr: ctx.sampleRate}); busy(); }
// the harmony's voice-leading chain (smooth), in the chords column's voicing; a column's notes at a step and bar
const chordsCol = () => st.cols.find(c => c.role === 'chords');
const chainOf = H => st.smooth ? vlChain(H, STYLES[chordsCol()?.voicing || 0]) : null;
function partNotes(c, clip, pos, H, bar){ const ch = chainOf(H), i = ((bar % H.bars.length) + H.bars.length) % H.bars.length;
  return notesAt(clip, pos, chordOf(H, bar), {vl: ch && ch[i], inv: c.inv || 0, walk: c.walk ? walkOf(c) : 0}); }
// the two leads' lanes, so the improviser has them take turns resting
const laneOf = c => st.cols.filter(x => x.role === c.role).indexOf(c);
const walkOf = c => c.clip ? Math.floor(Math.max(0, st.step - c.start)/c.clip.len) % 4 : 0;
// every native note a column will need with its clip over the whole harmony, computed ahead
function prewarm(c, clip = c.clip, also = true){ if (!ctx || !clip) return; if (also && c.play) for (const x of reach(c.role, clip)) prewarm(c, x, false); const H = st.hNext || st.harmony, sd = 60/st.bpm/4, ch = chainOf(H), arp = c.role === 'chords' && c.arp;
  for (let bar = 0; bar < H.bars.length; bar++) for (const w of c.walk ? [0, 1, 2, 3] : [0]) for (let p = 0; p < clip.len; p++)
    for (const [n, len, vel] of notesAt(clip, p, chordOf(H, bar), {vl: ch && ch[bar], inv: c.inv || 0, walk: w})) {
      if (c.inst.kind === 'drums') { const v = c.inst.voices[n]; if (v?.native) { const o = nativeSet(c, v.native, v.set); want(keyOf(v.native, v.n, vel, o), v.native, v.n, vel, o); } }
      else if (c.inst.native) { const nm = c.inst.native, o = nativeSet(c, nm, c.inst.set), set = NATIVE[nm].held ? {...o, len: Math.round((arp ? .9 : len)*sd*20)/20} : o, m = n + c.inst.shift + 12*(c.oct || 0);
        want(keyOf(nm, m, vel, set), nm, m, vel, set); } } }
function busy(){ const n = pending.size; $('busy').textContent = !ctx ? 'Press Play' : n ? `Computing ${n} sound${n > 1 ? 's' : ''}…` : st.playing ? 'Playing' : 'Ready'; $('busy').dataset.on = n ? '1' : ''; }

/* ---------- the clock: steps scheduled ahead; launches, harmony and moves land on the next bar ---------- */
const sd = () => 60/st.bpm/4;
function tick(){ while (nextT < ctx.currentTime + .12) { playStep(st.step, nextT); st.step++; nextT += sd(); } }
// one 16th: each column's notes, grooved by its feel (loudness, swing, ahead or behind); a chord column with an arp plays
// its chord's voices one a 16th for as long as the chord is held, following the harmony as it changes
function playStep(step, t0){
  if (step % 16 === 0) barLine(step);
  const H = st.harmony, bar = Math.floor((step - st.hStart)/16), dropped = st.drop && step >= st.drop.at && step < st.drop.at + 16;
  for (const c of st.cols) { if (!c.clip || c.mute || dropped && c.role !== 'chords') continue;
    const eff = st.rep ? st.rep.at + ((step - st.rep.at) % st.rep.len) : step, pos = ((eff - c.start) % c.clip.len + c.clip.len) % c.clip.len;
    const f = FEELS[c.feel || 0], sw = step % 2 ? (f.swing ?? st.swing) : 0, fe = feelAt(f, step), off = sw + fe.dt, t = Math.max(ctx.currentTime, t0 + off*sd());
    const recOff = off - (step % 2 ? st.swing : 0), drum = c.inst.kind === 'drums';
    // Play: the improviser's events at this step (each its own timing and loudness), else the clip as written
    let notes = c.play && c.role !== 'chords' ? improvise({role: c.role, clip: c.clip, pos, step, bar, lane: laneOf(c), a: PLAYS[c.play].a, mem: c.pm ??= {}, seed: st.pseed})
      .flatMap(ev => { (c.heard ??= []).push({step, ...ev}); return partNotes(c, {...c.clip, steps: [ev.s]}, pos, H, bar).map(([n, len, vel]) => [n, len, vel, ev.dt, ev.fv]); })
      : partNotes(c, c.clip, pos, H, bar);
    if (c.role === 'chords' && c.arp) { if (notes.length) c.arpSt = {until: step + Math.max(1, Math.round(notes[0][1])), vel: notes[0][2], i: c.arpSt?.i ?? 0};   // (the arp runs on across hits)
      notes = []; const a = c.arpSt; if (a && step < a.until) { const ch = chainOf(H), bi = ((bar % H.bars.length) + H.bars.length) % H.bars.length;
        const v = invert(ch ? ch[bi].voicing : notesAt({role: 'chords', steps: [[0, 'chord', 1, 1]]}, 0, chordOf(H, bar)).map(x => x[0]), c.inv || 0), m = v.length, k = a.i++;
        const j = {up: k % m, down: m - 1 - k % m, 'up and down': m < 2 ? 0 : [...Array(m).keys(), ...[...Array(m).keys()].slice(1, -1).reverse()][k % (2*m - 2)], random: Math.floor(Math.random()*m)}[ARPS[c.arp]];
        notes = [[v[j], .9, a.vel]]; } }
    if (c.heard?.length > 600) c.heard.splice(0, c.heard.length - 400);
    for (const [n0, len, vel, dt = 0, pv = 1] of notes) { const n = drum ? n0 : n0 + 12*(c.oct || 0); play(c, n, len, vel, Math.max(ctx.currentTime, t + dt*sd()), fe.v*pv);
      if (st.rec && step >= st.rec.from) st.rec.notes.push([step - st.rec.from, c.id, c.sound, n, len, +Math.min(1, vel*fe.v*pv).toFixed(2), +(recOff + dt).toFixed(3)]); } }
  const s = step; setTimeout(() => light(s), Math.max(0, (t0 - ctx.currentTime)*1000));
}
// fv: the feel's loudness (a native note is computed at the clip's own loudness and played louder or softer, so the
// feel never waits on a new note being computed)
function play(c, n, len, vel, t, fv = 1){ const v2 = Math.max(.05, Math.min(1, vel*fv));
  if (c.inst.kind === 'drums') { const v = c.inst.voices[n]; if (!v) return; if (v.kit) v.kit.play(n, t, v2, null); else nativeNote(c, v.native, v.n, vel, nativeSet(c, v.native, v.set), t, .5, fv);
    if (c.role === 'kick') duck(t); return; }
  if (c.inst.poly) c.inst.poly.play(n, t, len*sd(), v2); else nativeNote(c, c.inst.native, n + c.inst.shift, vel, nativeSet(c, c.inst.native, c.inst.set), t, len*sd(), fv); }
function duck(t){ for (const c of st.cols) { if (c.role === 'kick' || !c.ch) continue; const d = DUCKS[c.mix.duck][1]; if (!d) continue; const g = c.ch.duck.gain; g.setTargetAtTime(1 - d, t, .004); g.setTargetAtTime(1, t + .03, .1); } }
function barLine(step){
  if (st.hNext) { st.harmony = st.hNext; st.hNext = null; st.hStart = step; renderHarmony(); }
  for (const c of st.cols) { if (c.next !== undefined) { const nx = c.next; delete c.next; if (nx === 'stop') { c.clip = null; c.clipId = null; } else { c.clip = nx.clip; c.clipId = nx.id; c.var = nx.var || 0; if (!nx.keep) { c.start = step; c.row = c.nextRow; } } renderCol(c); }
    // Follow: the part's variants in turn, one a bar
    else if (c.follow && c.clip && c.vars?.length > 1) { const pat = FOLLOW[c.follow], b = Math.floor(step/16), n = c.vars.length;
      const i = pat === 'random' ? (Math.random() < .5 ? c.vi : Math.floor(Math.random()*n)) : Math.min(n - 1, pat.charCodeAt(b % pat.length) - 65);
      if (i !== c.vi) { c.vi = i; c.clip = {...c.clip, steps: c.vars[i].steps, len: varLen(c, i)}; c.var = i; if (st.sel === st.cols.indexOf(c)) renderShape(); } } }
  arrBar(step);
  if (st.build) { const b = st.build; if (step >= b.at + b.bars*16) { hp.frequency.cancelScheduledValues(ctx.currentTime); hp.frequency.setTargetAtTime(18, ctx.currentTime, .02); st.build = null; $('m-build').dataset.on = ''; } }
  if (st.drop && step >= st.drop.at + 16) { st.drop = null; $('m-drop').dataset.on = ''; }
  const bar = Math.floor((step - st.hStart)/16); st.bar = bar; $('chordNow').textContent = st.harmony.bars[bar % st.harmony.bars.length].replace(':', ' '); $('barNow').textContent = `bar ${bar % st.harmony.bars.length + 1} of ${st.harmony.bars.length}`;
}
async function start(){ initAudio(); await ctx.resume(); if (st.playing) return; st.playing = true; st.step = 0; st.hStart = 0; st.pseed = Math.floor(Math.random()*1e9); for (const c of st.cols) { c.pm = {}; c.heard = []; } nextT = ctx.currentTime + .1;
  for (const c of st.cols) if (c.next === undefined && c.clip) c.start = 0; timer = setInterval(tick, 25); tick(); $('play').textContent = 'Stop'; $('play').setAttribute('aria-pressed', 'true'); busy(); }
function stop(){ st.playing = false; if (st.arr) { st.arr = null; renderArr(); } clearInterval(timer); $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); light(-1); if (st.rec) record(); busy(); }

/* ---------- launching ---------- */
function launch(c, clipId, varIdx = 0, row){ const base = CLIP[clipId]; c.nextRow = row ?? PACK.scenes.findIndex(sc => sc.clips[st.cols.indexOf(c)] === clipId);
  if (!clipId) c.next = 'stop'; else { if (c.varsOf !== clipId) { c.vars = [base.steps, ...base.variations].map(steps => ({steps})); c.varsOf = clipId; }
    const steps = c.vars[varIdx]?.steps || base.steps; c.vi = varIdx; c.next = {id: clipId, clip: {...base, steps}, var: varIdx};
    if (base.sound && !c.locked && SND[base.sound]?.role === SND[c.sound].role && c.sound !== base.sound) setSound(c, base.sound); prewarm(c, c.next.clip); }
  if (!st.playing) { if (c.next !== 'stop') { c.clip = c.next.clip; c.clipId = c.next.id; c.var = c.next.var; c.row = c.nextRow; } else { c.clip = null; c.clipId = null; } delete c.next; c.start = 0; }
  renderCol(c); }
function scene(i){ const sc = PACK.scenes[i]; if (!sc) return; st.cols.forEach((c, j) => launch(c, sc.clips[j] || null, 0, i)); flash('Scene: ' + sc.name); }
function setSound(c, id){ c.sound = id; if (ctx) { buildSound(c); prewarm(c); } renderCol(c); }
const selCol = () => st.cols[st.sel];

/* ---------- variants: each part's versions in a strip (the pack's, and every mutation and transform made) ---------- */
const VMAX = 12, letter = i => String.fromCharCode(65 + i);
// a variant comes in on the next bar, keeping the part's place in its loop (so odd lengths keep drifting)
function setVar(c, i){ if (!c.clip || !c.vars?.[i]) return; c.vi = i; const clip = {...c.clip, steps: c.vars[i].steps, len: varLen(c, i)};
  if (st.playing) c.next = {id: c.clipId, clip, var: i, keep: true}; else { c.clip = clip; c.var = i; } prewarm(c, clip); logMacro(c, 'var', i); flash(`${ROLE_NAMES[c.role]}: variant ${letter(i)}`); renderCol(c); renderShape(); }
// a variant's length: its own (a kept improvisation), else the clip's as the pack has it
const varLen = (c, i) => c.vars[i]?.len || CLIP[c.clipId]?.len || c.vars[0]?.len || c.clip.len;
// a variant onto the part's strip (the oldest of its own made ones dropping off past VMAX)
function pushVar(c, v){ if (!c.vars) c.vars = [{steps: c.clip.steps, len: c.clip.len}]; const base = CLIP[c.clipId] ? 1 + CLIP[c.clipId].variations.length : 1;
  c.vars.push(v); if (c.vars.length > VMAX) c.vars.splice(base, 1); return c.vars.length - 1; }
// (while editing it's heard at once, so the grid and what plays stay the same clip; otherwise on the next bar)
function addVar(c, steps, why, len){ pushUndo(c); const i = pushVar(c, {steps, made: why, ...(len ? {len} : {})}); if (st.edit) { c.editVar = null; now(c, i); } else setVar(c, i); flash(`${why}: variant ${letter(i)}`); }
// undo: the strip and the variant chosen as they were before the last tool or edit
function pushUndo(c){ (c.undo ??= []).push({vars: (c.vars || []).map(v => ({...v})), vi: c.vi || 0}); if (c.undo.length > 40) c.undo.shift(); }
function undo(){ const c = selCol(), u = c?.undo?.pop(); if (!u) { flash('Nothing to undo'); return; } c.vars = u.vars; c.editVar = null; now(c, u.vi); flash('Undone'); }
// a variant at once (an edit is heard straight away, not on the next bar)
function now(c, i){ c.vi = i; c.clip = {...c.clip, steps: c.vars[i].steps, len: varLen(c, i)}; c.var = i; delete c.next; prewarm(c); logMacro(c, 'var', i); renderCol(c); renderShape(); }
// a riff tool on the chosen part: a new variant (a new riff keeps the part's length, at least a bar)
function riffTool(k){ const c = selCol(); if (!c) return;
  // a new riff on a part with nothing playing starts it, on the next bar
  if (!c.clip) { if (k !== 'riff') { flash('Launch a clip first, or N for a new riff'); return; }
    const R = TOOLS.riff(c.role, 16, Math.random, isDrum(c) ? Object.keys(SND[c.sound]?.voices || {chh: 1}) : []), id = 'riff-' + c.id + '-' + Date.now().toString(36);
    const clip = {id, role: c.role, name: 'New riff', len: R.len, steps: R.steps, variations: []}; c.vars = [{steps: R.steps, len: R.len, made: 'New riff'}]; c.varsOf = id; c.vi = 0; c.next = {id, clip, var: 0};
    if (!st.playing) { c.clip = clip; c.clipId = id; c.var = 0; delete c.next; c.start = 0; } prewarm(c, clip); renderCol(c); renderShape(); flash((st.playing ? 'Next bar: ' : '') + 'a new riff'); return; }
  const voices = isDrum(c) ? Object.keys(SND[c.sound]?.voices || {chh: 1}) : [], R = k === 'riff' ? TOOLS.riff(c.role, Math.max(16, Math.min(RIFF_MAX, c.clip.len - c.clip.len % 16 || 16)), Math.random, voices) : TOOLS[k](c.clip);
  if (!R) { flash(k === 'double' ? '2× time needs an even length' : k === 'shorter' ? 'Too short to halve' : 'Four bars at most'); return; }
  if (!R.steps.length) { flash('Nothing to keep'); return; } addVar(c, R.steps, TNAMES[k], R.len); }
function transform(k){ const c = selCol(); if (!c.clip) return; addVar(c, XFORMS[k](c.clip), XNAMES[k], c.clip.len); }
// Keep that: what the improviser played over the last two bars or so (whole times round the clip) as a new variant
function keepPlayed(){ const c = selCol(); if (!c.clip || !c.play || !st.playing) { flash(c?.play ? 'Play it first' : 'Turn Play on first (P)'); return; }
  const L = c.clip.len, k = L >= 32 ? 1 : Math.max(1, Math.min(Math.floor(64/L), Math.ceil(32/L))), cyc = Math.floor((st.step - c.start)/L);
  if (cyc < k) { flash('Let it play a little longer'); return; }
  const from = c.start + (cyc - k)*L, steps = keep(c.heard || [], from, L*k);
  if (!steps.length) { flash('Nothing played to keep'); return; }
  addVar(c, steps, 'Kept', L*k); }

/* ---------- jam moves ---------- */
const MOVES = {
  vary(){ const c = selCol(); if (!c.clipId || !c.vars?.length) return; setVar(c, ((c.vi || 0) + 1) % c.vars.length); },
  mutate(){ const c = selCol(); if (!c.clip) return; addVar(c, mutate(c.clip).steps, 'Mutated', c.clip.len); },
  build(){ if (!st.playing || st.build) return; const at = Math.ceil(st.step/16)*16, bars = 4, t = ctx.currentTime + (at - st.step)*sd();
    hp.frequency.setValueAtTime(18, t); hp.frequency.exponentialRampToValueAtTime(1400, t + bars*16*sd()); st.build = {at, bars}; riser(t, bars*16*sd()); $('m-build').dataset.on = '1'; flash('Building for 4 bars'); },
  drop(){ if (!st.playing) return; st.drop = {at: Math.ceil(st.step/16)*16}; $('m-drop').dataset.on = '1'; flash('Drop: a bar of air, then back'); },
  harmony(){ const hs = PACK.harmonies, i = hs.indexOf(st.hNext || st.harmony); setHarmony(hs[(i + 1) % hs.length].id); },
};
function riser(t, dur){ const n = ctx.createBuffer(2, ctx.sampleRate*2, ctx.sampleRate); for (let c = 0; c < 2; c++) { const x = n.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = Math.random()*2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = n; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.4; s.connect(f); f.connect(g); g.connect(master);
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .03); s.start(t); s.stop(t + dur + .05); }
function repeat(on){ if (on && st.playing && !st.rep) { st.rep = {at: Math.floor(st.step/4)*4, len: 4}; $('m-rep').dataset.on = '1'; } if (!on && st.rep) { st.rep = null; $('m-rep').dataset.on = ''; } }
function setHarmony(id){ const H = PACK.harmonies.find(x => x.id === id); if (!st.playing) { st.harmony = H; st.hStart = 0; } else st.hNext = H; for (const c of st.cols) prewarm(c); renderHarmony(); flash('Harmony: ' + H.name); }

/* ---------- recording: what plays, written down for Claude to render ---------- */
function record(){ if (!st.rec) { if (!st.playing) start(); st.rec = {from: Math.ceil(st.step/16)*16, notes: [], macros: [], bpm: st.bpm, swing: st.swing, echoDiv: st.echoDiv, mix: st.cols.map(c => ({...c.mix, mute: !!c.mute})), mx: {...st.mx}, harmonies: []}; $('rec').setAttribute('aria-pressed', 'true'); flash('Recording from the next bar'); return; }
  const r = st.rec; st.rec = null; $('rec').setAttribute('aria-pressed', 'false'); r.bars = Math.ceil((st.step - r.from)/16); lastTake = r; $('keepJam').disabled = !db || !r.notes.length;
  $('takeNote').textContent = r.notes.length ? `Take: ${r.bars} bars, ${r.notes.length} notes. Keep it for Claude to render, or record again.` : 'Nothing was recorded.'; }
let lastTake = null; window.__jamTake = () => lastTake && {...lastTake, columns: st.cols.map(c => ({id: c.id, role: c.role}))};   // (for tests)
const logMacro = (c, k, v) => st.rec?.macros.push([Math.max(0, st.step - st.rec.from), c.id, k, +(+v).toFixed(3)]);
// a master change, on the '*' column
const logMaster = (k, v) => st.rec?.macros.push([Math.max(0, st.step - st.rec.from), '*', 'master.' + k, v]);

/* ---------- the page ---------- */
function renderGrid(){ const g = $('grid'); g.innerHTML = ''; g.style.setProperty('--cols', st.cols.length);
  g.append(h('div', {class: 'corner'}, h('span', {class: 'lab'}, 'Scenes')));
  st.cols.forEach((c, i) => g.append(c.head = h('div', {class: 'colhead', id: 'head-' + c.id})));
  PACK.scenes.forEach((sc, r) => { g.append(h('button', {class: 'scene', onclick: () => scene(r), title: `Launch ${sc.name} (key ${r + 1})`}, h('b', {}, String(r + 1)), ' ', sc.name));
    st.cols.forEach(c => { const id = sc.clips[st.cols.indexOf(c)]; g.append(h('button', {class: 'cell' + (id ? '' : ' empty'), 'data-col': c.id, 'data-clip': id || '', 'data-row': r, onclick: () => { st.sel = st.cols.indexOf(c); launch(c, id || null, 0, r); renderSel(); }}, id ? CLIP[id].name : '■ stop')); }); });
  st.cols.forEach(renderCol); }
function renderCol(c){ if (!c.head) return; const i = st.cols.indexOf(c), s = SND[c.sound];
  c.head.innerHTML = ''; c.head.dataset.sel = i === st.sel ? '1' : '';
  const key = 'QWERTYU'[i];
  c.head.append(h('button', {class: 'colname', onclick: () => { st.sel = i; renderSel(); }}, h('kbd', {}, key), ' ', ROLE_NAMES[c.role] + (c.role === 'lead' && i > 5 ? ' 2' : '')),
    h('button', {class: 'sound', onclick: () => { st.sel = i; renderSel(); openSounds(c); }, title: 'Change the sound'}, s.name),
    h('button', {class: 'mute', 'aria-pressed': String(!!c.mute), onclick: () => { c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderCol(c); }}, c.mute ? 'Muted' : 'Mute'),
    h('span', {class: 'headlikes', title: 'Like its sound · like its pattern'}, likeBar(soundItem(c.sound), {only: 'up', label: '♪'}), c.clip ? likeBar(patternItem(c), {only: 'up', label: '♫'}) : ''));
  document.querySelectorAll(`.cell[data-col="${c.id}"]`).forEach(b => { b.dataset.on = c.clipId && +b.dataset.row === c.row ? '1' : ''; b.dataset.next = c.next && c.next !== 'stop' && +b.dataset.row === c.nextRow ? '1' : ''; });
  if (i === st.sel) renderSel(); else renderPhone(); }
function renderSel(){ const c = selCol(); st.cols.forEach((x, i) => x.head && (x.head.dataset.sel = i === st.sel ? '1' : ''));
  $('selName').textContent = `${ROLE_NAMES[c.role]}: ${SND[c.sound].name}`; $('selClip').textContent = c.clipId ? CLIP[c.clipId].name + (c.var ? ` (variation ${c.var})` : '') : 'not playing';
  $('octOut').textContent = (c.oct > 0 ? '+' : '') + (c.oct || 0); $('octBox').hidden = ['kick', 'hats', 'perc'].includes(c.role); $('motion').textContent = 'Motion: ' + ['still', 'slow', 'fast'][c.motion]; $('length').textContent = 'Length: ' + ['short', 'normal', 'long'][c.length];
  drawPad(); renderShape(); renderPhone(); renderPartLikes(); }
function renderHarmony(){ const box = $('harmonies'); box.innerHTML = '';
  for (const H of PACK.harmonies) box.append(h('button', {class: 'hchip', 'data-liked': liked(harmonyItem(H)) ? '1' : '', 'data-on': H === st.harmony ? '1' : '', 'data-next': H === st.hNext ? '1' : '', title: H.words, onclick: () => setHarmony(H.id)}, H.name));
  $('hWords').textContent = (st.hNext || st.harmony).words; const hl = $('harmLikes'); hl.innerHTML = ''; hl.append(h('span', {class: 'lab'}, 'This harmony '), likeBar(harmonyItem(st.hNext || st.harmony))); }
let lightCells = []; function light(s){ if (s >= 0 && s % 2 === 0) drawNotes(s);
  const mc = selCol(), mb = mc?.clip && document.querySelector(`#mClips .cell[data-on="1"]`); document.querySelectorAll('#mClips .cell').forEach(b => b !== mb && b.style.removeProperty('--p'));
  if (mb && s >= 0) mb.style.setProperty('--p', (((s - mc.start) % mc.clip.len + mc.clip.len) % mc.clip.len + 1)/mc.clip.len); for (const b of lightCells) b.style.removeProperty('--p'); lightCells = [];
  if (s < 0) return; for (const c of st.cols) { if (!c.clip) continue; const b = document.querySelector(`.cell[data-col="${c.id}"][data-on="1"]`); if (b) { b.style.setProperty('--p', (((s - c.start) % c.clip.len + c.clip.len) % c.clip.len + 1)/c.clip.len); lightCells.push(b); } } }
let flashT = 0; function flash(t){ $('flash').textContent = t; clearTimeout(flashT); flashT = setTimeout(() => $('flash').textContent = '', 1800); }

/* ---------- notes and groove: the chosen part's notes drawn live, the moves that reshape them, its variants, its feel ---------- */
const NN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], nname = n => NN[n % 12] + (Math.floor(n/12) - 1);
const isDrum = c => ['kick', 'hats', 'perc'].includes(c.role);
function renderShape(){ const c = selCol(); if (!c) return;
  $('shapeName').textContent = `${ROLE_NAMES[c.role]}${c.clipId ? ': ' + (CLIP[c.clipId]?.name || 'saved clip') : ''}`;
  $('smooth').setAttribute('aria-pressed', String(st.smooth));
  const X = $('xforms'); X.innerHTML = ''; const btn = (lab, key, fn, on) => X.append(h('button', {class: 'macro', 'data-on': on ? '1' : '', onclick: fn}, lab, key ? h('small', {}, key) : ''));
  if (c.role === 'chords') { btn('Voicing: ' + STYLES[c.voicing || 0], '', () => { c.voicing = ((c.voicing || 0) + 1) % STYLES.length; logMacro(c, 'voicing', c.voicing); for (const x of st.cols) prewarm(x); renderShape(); flash('Voicing: ' + STYLES[c.voicing]); });
    btn('▲ Inversion', '', () => inv(c, 1)); btn('▼ Inversion', '', () => inv(c, -1));
    btn('Arp: ' + (ARPS[c.arp || 0] || 'off'), '', () => { c.arp = ((c.arp || 0) + 1) % ARPS.length; c.arpSt = null; logMacro(c, 'arp', c.arp); prewarm(c); renderShape(); flash('Arp: ' + (ARPS[c.arp] || 'off')); }, c.arp);
    btn(XNAMES.rotate, '', () => transform('rotate')); btn(XNAMES.reverse, '', () => transform('reverse')); }
  else if (isDrum(c)) { btn(XNAMES.rotate, '', () => transform('rotate')); btn(XNAMES.reverse, '', () => transform('reverse')); btn('Mutate', 'M', () => MOVES.mutate()); }
  else { for (const k of ['up', 'down']) btn(XNAMES[k], '', () => transform(k));
    btn('Walk' + (c.walk ? ': on' : ''), '', () => { c.walk = !c.walk; logMacro(c, 'walk', c.walk ? 1 : 0); prewarm(c); renderShape(); flash(c.walk ? 'Walk: climbing a chord tone each time round' : 'Walk off'); }, c.walk);
    for (const k of ['flip', 'wide', 'narrow', 'reverse', 'rotate']) btn(XNAMES[k], '', () => transform(k)); }
  const RF = $('riffs'); RF.innerHTML = ''; const rb = (lab, fn, on, title) => RF.append(h('button', {class: 'macro', 'data-on': on ? '1' : '', title: title || '', onclick: fn}, lab));
  rb(st.edit ? '✎ Editing' : '✎ Edit notes', () => { st.edit = !st.edit; c.editVar = null; c.edRange = null; if (st.edit && c.next?.keep) now(c, c.next.var); $('notes').classList.toggle('editing', st.edit); renderShape(); flash(st.edit ? 'Tap to add or take away, drag to move, drag the end for length, hold for loudness' : 'Editing off'); }, st.edit, 'Edit the notes by hand on the grid');
  rb('↶ Undo', undo, false, 'Undo the last tool or edit (Z)');
  const tools = c.role === 'chords' ? ['riff', 'thin', 'half', 'double', 'longer', 'shorter'] : isDrum(c) ? ['riff', 'answer', 'develop', 'thin', 'fill', 'half', 'double', 'longer', 'shorter'] : ['riff', 'answer', 'sequence', 'develop', 'thin', 'fill', 'half', 'double', 'longer', 'shorter'];
  const TT = {riff: 'A new riff for this part (N)', answer: 'Two bars: the riff, then its answer coming home', sequence: 'The riff again a chord tone higher each time round', develop: 'A A′ A B: the riff, a variation, the riff, an answer', thin: 'Fewer notes', fill: 'A soft note in the gaps', half: 'Everything twice as long', double: 'Twice as fast, played twice', longer: 'The clip twice as long, to change the second half', shorter: 'Only its first half'};
  for (const k of tools) rb(TNAMES[k], () => riffTool(k), false, TT[k]);
  const cl = c.next?.clip || c.clip; $('lenNow').textContent = cl ? `${cl.len} steps${cl.len % 16 === 0 ? ` · ${cl.len/16} bar${cl.len > 16 ? 's' : ''}` : ''}${c.next?.clip ? ', from the next bar' : ''}` : '';
  const V = $('vars'); V.innerHTML = ''; (c.vars || []).forEach((v, i) => V.append(h('button', {'data-on': i === (c.vi || 0) && c.clip ? '1' : '', 'data-next': c.next?.keep && c.next.var === i ? '1' : '', title: v.made ? `Made by ${v.made}` : i ? 'One of Claude’s variations' : 'The original', onclick: () => setVar(c, i)}, letter(i), v.made ? h('small', {}, v.made.replace(/^[▲▼] /, '').slice(0, 6)) : '')));
  $('follow').textContent = 'Follow: ' + (FOLLOW[c.follow || 0] ? FOLLOW[c.follow].split('').join(' ').replace('r a n d o m', 'random') : 'off'); $('follow').dataset.on = c.follow ? '1' : '';
  $('feel').innerHTML = ''; $('feel').append('Feel: ' + FEELS[c.feel || 0].name, h('small', {}, 'F'));
  $('playB').hidden = $('keepB').hidden = c.role === 'chords'; $('playB').innerHTML = ''; $('playB').append('Play: ' + PLAYS[c.play || 0].name, h('small', {}, 'P')); $('playB').dataset.on = c.play ? '1' : '';
  $('keepB').disabled = !c.play;
  $('echoOn').innerHTML = ''; $('echoOn').append('Echo: ' + (c.echo ? 'on' : 'off'), h('small', {}, 'G')); $('echoOn').dataset.on = c.echo ? '1' : '';
  $('verbOn').innerHTML = ''; $('verbOn').append('Reverb: ' + (c.verb ? 'on' : 'off'), h('small', {}, 'K')); $('verbOn').dataset.on = c.verb ? '1' : '';
  $('echoTime').innerHTML = ''; $('echoTime').append('Echo time: ' + ECHO[st.echoDiv][0], h('small', {}, 'every part'));
  drawNotes(); renderPartLikes(); }
function inv(c, d){ c.inv = Math.max(-3, Math.min(3, (c.inv || 0) + d)); logMacro(c, 'inv', c.inv); prewarm(c); renderShape(); flash(`Inversion ${c.inv > 0 ? '+' : ''}${c.inv}`); }
/* ---------- editing by hand: the chosen part's notes on a grid (a line by chord tone, so it still follows the harmony;
   drums by voice; chords as hits). Tap a gap to add, tap a note to take it away, drag it across or up and down, drag
   its end for its length, hold it (or Shift) for how hard it's played ---------- */
const VELS = [.45, .7, 1];
function editGrid(c, W, Ht){ const L = 46, len = c.clip.len, cw = (W - L - 8)/len;
  let rows; if (isDrum(c)) rows = [...new Set([...Object.keys(SND[c.sound]?.voices || {}), ...c.clip.steps.map(s => s[1])])];
  else if (c.role === 'chords') rows = ['chord'];
  // a line's chord tones over a steady range, so rows don't move under the finger as notes are added (it only grows)
  else { const rs = c.clip.steps.filter(s => typeof s[1] === 'number').map(s => s[1]), base = c.role === 'bass' ? [-2, 6] : [-1, 9], E = c.edRange ??= [...base];
    E[0] = Math.min(E[0], ...rs); E[1] = Math.max(E[1], ...rs); rows = []; for (let r = E[1]; r >= E[0]; r--) rows.push(r); }
  const rh = (Ht - 10)/rows.length;
  return {L, cw, rows, rh, len, col: x => Math.floor((x - L)/cw), row: y => rows[Math.max(0, Math.min(rows.length - 1, Math.floor((y - 5)/rh)))], yOf: r => 5 + rows.indexOf(r)*rh}; }
// the note under a cell: one starting there or held through it
const spanOf = s => typeof s[1] === 'number' || s[1] === 'chord' ? Math.max(1, Math.ceil(s[2])) : 1;
const noteAt = (c, p, r) => c.clip.steps.find(s => s[1] === r && s[0] <= p && p < s[0] + spanOf(s));
function drawEdit(g, c, W, Ht, pos, css){ const G = editGrid(c, W, Ht), H = st.hNext || st.harmony, bar = st.playing ? st.bar : 0, line = typeof G.rows[0] === 'number';
  g.globalAlpha = .5; for (let p = 0; p <= G.len; p++) { g.fillStyle = css('--line'); g.fillRect(G.L + p*G.cw, 4, p % 16 === 0 ? 2 : p % 4 === 0 ? 1 : .5, Ht - 8); } g.globalAlpha = 1;
  G.rows.forEach((r, i) => { const y = 5 + i*G.rh; g.fillStyle = css('--mute');
    const nm = line ? (x => x ? nname(x[0] + 12*(c.oct || 0)) : '')(partNotes(c, {...c.clip, steps: [[0, r, 1, .7]]}, 0, H, bar)[0]) : r; g.fillText(nm, 4, y + G.rh/2);
    g.fillStyle = css('--line'); g.globalAlpha = .4; g.fillRect(G.L, y + G.rh - .5, W - G.L - 8, .5); g.globalAlpha = 1; });
  for (const s of c.clip.steps) { const r = s[1]; if (!G.rows.includes(r)) continue; const vel = s[typeof r === 'number' || r === 'chord' ? 3 : 2], l = typeof r === 'number' || r === 'chord' ? Math.max(.5, s[2]) : 1;
    g.fillStyle = s[0] === pos ? css('--on') : css('--ink'); g.globalAlpha = .35 + .65*vel; g.fillRect(G.L + s[0]*G.cw + 1, G.yOf(r) + 2, Math.max(3, Math.min(l, G.len - s[0])*G.cw - 2), G.rh - 4); g.globalAlpha = 1;
    if (s[4]) { g.fillStyle = css('--bg'); g.fillText('↑', G.L + s[0]*G.cw + 3, G.yOf(r) + G.rh/2); } }
  if (pos >= 0) { g.fillStyle = css('--acc'); g.globalAlpha = .25; g.fillRect(G.L + pos*G.cw, 0, Math.max(2, G.cw), Ht); g.globalAlpha = 1; } }
// an edit: the first since Edit was turned on (or since another tool) makes an "Edited" variant, the rest change it in place
function editSteps(c, steps){ pushUndo(c); steps.sort((a, b) => a[0] - b[0]);
  if (!c.editVar || c.vars?.[c.vi] !== c.editVar) { c.editVar = {steps, made: 'Edited', len: c.clip.len}; now(c, pushVar(c, c.editVar)); }
  else { c.editVar.steps = steps; now(c, c.vi); } }
let drag = null;
$('notes').addEventListener('pointerdown', e => { const c = selCol(); if (!st.edit || !c?.clip) return; const r = $('notes').getBoundingClientRect(), G = editGrid(c, r.width, r.height), x = e.clientX - r.left, y = e.clientY - r.top, p = G.col(x), row = G.row(y);
  if (p < 0 || p >= G.len) return; e.preventDefault(); $('notes').setPointerCapture(e.pointerId); const s = noteAt(c, p, row);
  if (!s) { const add = typeof row === 'number' ? [p, row, 1, .7] : row === 'chord' ? [p, 'chord', 2, .6] : [p, row, .7]; editSteps(c, [...c.clip.steps.map(t => t.slice()), add]); drag = {s: add, x, y, p0: p, r0: row, moved: true, fresh: true, G}; return; }
  // (a line's or a chord's end, grabbed, stretches it)
  const edge = (typeof s[1] === 'number' || s[1] === 'chord') && x > G.L + (s[0] + spanOf(s))*G.cw - Math.min(10, G.cw*.4);
  drag = {s, x, y, p0: s[0], r0: s[1], l0: s[2], edge, moved: false, G, held: setTimeout(() => { if (drag && !drag.moved) { drag.accent = true; accent(c, s); } }, 450), shift: e.shiftKey}; });
$('notes').addEventListener('pointermove', e => { const c = selCol(); if (!drag || !c?.clip) return; const r = $('notes').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, G = drag.G;
  if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) < 6) return; if (!drag.moved) { drag.moved = true; clearTimeout(drag.held); }
  const steps = c.clip.steps.map(t => t.slice()), i = c.clip.steps.indexOf(drag.cur || drag.s); if (i < 0) return; const t = steps[i];
  if (drag.edge) t[2] = Math.max(1, Math.min(G.len - t[0], Math.round(drag.l0 + (x - drag.x)/G.cw)));
  else { t[0] = Math.max(0, Math.min(G.len - 1, drag.p0 + Math.round((x - drag.x)/G.cw))); if (typeof drag.r0 !== 'string' || isDrum(c)) { const ri = Math.max(0, Math.min(G.rows.length - 1, G.rows.indexOf(drag.r0) + Math.round((y - drag.y)/G.rh))); if (G.rows[ri] !== 'chord') t[1] = G.rows[ri]; } }
  if (JSON.stringify(t) === JSON.stringify(c.clip.steps[i])) return;
  editSteps(c, steps); drag.cur = c.clip.steps.find(q => q === t) || t; });
const endDrag = () => { const c = selCol(); if (!drag) return; clearTimeout(drag.held); const d = drag; drag = null; if (!c?.clip || d.moved || d.accent) return;
  if (d.shift) accent(c, d.s); else editSteps(c, c.clip.steps.filter(t => t !== d.s).map(t => t.slice())); };
$('notes').addEventListener('pointerup', endDrag); $('notes').addEventListener('pointercancel', () => { if (drag) clearTimeout(drag.held); drag = null; });
// how hard a note is played: soft, normal, loud, round again
function accent(c, s){ const vi = typeof s[1] === 'number' || s[1] === 'chord' ? 3 : 2, steps = c.clip.steps.map(t => t.slice()), t = steps[c.clip.steps.indexOf(s)]; if (!t) return;
  t[vi] = VELS[(VELS.findIndex(v => v >= t[vi] - .05) + 1) % VELS.length]; editSteps(c, steps); flash(['Soft', 'Normal', 'Loud'][VELS.indexOf(t[vi])]); }

// the notes: drums as hits by voice; a line as its notes over the clip, named; chords as the voicing chain over the harmony
function drawNotes(step){ const cv = $('notes'), r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1, W = r.width, Ht = r.height; if (!W) return;
  if (cv.width !== Math.round(W*dpr)) { cv.width = W*dpr; cv.height = Ht*dpr; } const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Ht);
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), ink = css('--ink'), mute = css('--mute'), on = css('--on'), acc = css('--acc'), line = css('--line');
  const c = selCol(), H = st.hNext || st.harmony; g.font = '11px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
  if (!c.clip) { g.fillStyle = mute; g.fillText('Not playing: launch a clip above.', 12, Ht/2); return; }
  const L = 46, pw = W - L - 8, pos = step == null ? -1 : ((step - c.start) % c.clip.len + c.clip.len) % c.clip.len;
  if (st.edit) { drawEdit(g, c, W, Ht, pos, css); return; }
  if (c.role === 'chords') { const ch = chainOf(H), nb = Math.min(H.bars.length, 16), vs = [...Array(nb).keys()].map(b => invert(ch ? ch[b].voicing : notesAt({role: 'chords', steps: [[0, 'chord', 1, 1]]}, 0, chordOf(H, b)).map(x => x[0]), c.inv || 0)).map(v => v.map(n => n + 12*(c.oct || 0)));
    const all = vs.flat(), lo = Math.min(...all) - 2, hi = Math.max(...all) + 2, y = n => 8 + (hi - n)/(hi - lo)*(Ht - 30), bw = pw/nb, cur = ((st.bar % H.bars.length) + H.bars.length) % H.bars.length;
    for (let n = lo; n <= hi; n++) if ([0, 5, 7].includes(n % 12) || all.includes(n)) { g.fillStyle = all.includes(n) ? ink : mute; g.globalAlpha = all.includes(n) ? .8 : .35; g.fillText(nname(n), 4, y(n)); } g.globalAlpha = 1;
    vs.forEach((v, b) => { const x0 = L + b*bw; if (b === cur && st.playing) { g.fillStyle = css('--on-soft'); g.fillRect(x0, 4, bw, Ht - 26); }
      g.fillStyle = mute; g.fillText(H.bars[b].replace(':', ' '), x0 + 4, Ht - 10);
      v.forEach((n, i) => { g.fillStyle = b === cur && st.playing ? on : ink; g.fillRect(x0 + 6, y(n) - 3, bw - 12, 6);
        const nx = vs[(b + 1) % nb]; if (b + 1 < nb || nb > 1 && b === nb - 1 && false) { const m = nx.reduce((a, q) => Math.abs(q - n) < Math.abs(a - n) ? q : a, nx[0]); g.strokeStyle = acc; g.globalAlpha = .55; g.beginPath(); g.moveTo(x0 + bw - 6, y(n)); g.lineTo(x0 + bw + 6, y(m)); g.stroke(); g.globalAlpha = 1; } }); });
    g.fillStyle = mute; g.fillText(st.smooth ? `${STYLES[c.voicing || 0]} voicing, voice-led${c.arp ? ', arp ' + ARPS[c.arp] : ''}` : 'free: each chord on its own', L, 10); return; }
  const cw = pw/c.clip.len;
  if (isDrum(c)) { const voices = [...new Set(c.clip.steps.map(s => s[1]))], rh = Math.min(26, (Ht - 12)/voices.length);
    voices.forEach((v, i) => { const y0 = 6 + i*rh; g.fillStyle = mute; g.fillText(v, 4, y0 + rh/2);
      for (const s of c.clip.steps) if (s[1] === v) { g.fillStyle = s[0] === pos ? on : ink; g.globalAlpha = .35 + .65*s[2]; g.fillRect(L + s[0]*cw + 1, y0 + rh*(1 - s[2])*.5 + 2, Math.max(2, cw - 2), Math.max(3, rh*s[2] - 4)); g.globalAlpha = 1; } });
  } else { const bar = st.playing ? st.bar : 0, ns = []; for (let p = 0; p < c.clip.len; p++) for (const [n, len] of partNotes(c, c.clip, p, H, bar)) ns.push([p, n + 12*(c.oct || 0), len]);
    if (!ns.length) return; const lo = Math.min(...ns.map(x => x[1])) - 1, hi = Math.max(...ns.map(x => x[1])) + 1, y = n => 6 + (hi - n)/(hi - lo || 1)*(Ht - 14);
    for (const n of new Set(ns.map(x => x[1]))) { g.fillStyle = mute; g.fillText(nname(n), 4, y(n)); g.strokeStyle = line; g.beginPath(); g.moveTo(L, y(n)); g.lineTo(W - 8, y(n)); g.stroke(); }
    for (const [p, n, len] of ns) { g.fillStyle = p === pos ? on : ink; g.fillRect(L + p*cw + 1, y(n) - 4, Math.max(3, Math.min(len, c.clip.len - p)*cw - 2), 8); } }
  if (pos >= 0) { g.fillStyle = acc; g.globalAlpha = .25; g.fillRect(L + pos*cw, 0, Math.max(2, cw), Ht); g.globalAlpha = 1; } }
$('smooth').onclick = () => { st.smooth = !st.smooth; try { localStorage.setItem('studio.jam.smooth', st.smooth ? '1' : '0'); } catch {} for (const c of st.cols) { c.arpSt = null; prewarm(c); } renderShape(); flash(st.smooth ? 'Smooth voice leading: every part glides between chords' : 'Free: each chord voiced on its own'); };
$('follow').onclick = () => { const c = selCol(); c.follow = ((c.follow || 0) + 1) % FOLLOW.length; logMacro(c, 'follow', c.follow); renderShape(); flash('Follow: ' + (FOLLOW[c.follow] || 'off')); };
// Play: how much the part is improvised on (off, light, loose, wild); the chords hold the harmony as they are
const nextPlay = () => { const c = selCol(); if (c.role === 'chords') return; c.play = ((c.play || 0) + 1) % PLAYS.length; c.pm = {}; logMacro(c, 'play', c.play); prewarm(c); renderShape();
  flash(`${ROLE_NAMES[c.role]}: ${c.play ? 'played ' + PLAYS[c.play].name.toLowerCase() : 'as written'}`); };
const nextFeel = () => { const c = selCol(); c.feel = ((c.feel || 0) + 1) % FEELS.length; logMacro(c, 'feel', c.feel); renderShape(); flash(`${ROLE_NAMES[c.role]} feel: ${FEELS[c.feel].name}`); };
const sendTog = k => { const c = selCol(); c[k] = !c[k]; macros(c); logMacro(c, k, c[k] ? 1 : 0); renderShape(); flash(`${ROLE_NAMES[c.role]} ${k === 'echo' ? 'echo' : 'reverb'} ${c[k] ? 'on' : 'off'}`); };
const throwTo = on => { const c = selCol(); if (!!c.throw === on) return; c.throw = on; macros(c); logMacro(c, 'throw', on ? 1 : 0); $('throw').dataset.on = on ? '1' : ''; };
$('feel').onclick = nextFeel; $('playB').onclick = nextPlay; $('keepB').onclick = keepPlayed; $('echoOn').onclick = () => sendTog('echo'); $('verbOn').onclick = () => sendTog('verb');
$('throw').addEventListener('pointerdown', e => { e.preventDefault(); throwTo(true); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('throw').addEventListener(ev, () => throwTo(false));
$('echoTime').onclick = () => { st.echoDiv = (st.echoDiv + 1) % ECHO.length; tempo(); if (st.rec) st.rec.macros.push([Math.max(0, st.step - st.rec.from), '*', 'echoDiv', st.echoDiv]); renderShape(); flash('Echo time: ' + ECHO[st.echoDiv][0]); };

// the sound picker: the library's sounds for this column's role
function openSounds(c){ const box = $('sounds'); box.innerHTML = ''; box.hidden = false;
  box.append(h('div', {class: 'sndhead'}, h('b', {}, `Sounds for ${ROLE_NAMES[c.role]}`), h('button', {class: 'ghost', onclick: () => box.hidden = true}, 'Close')));
  const mine = LIB.filter(s => s.role === c.role), groups = [PACK.id, ...new Set(mine.map(s => s.pack).filter(p => p !== PACK.id))];
  for (const g of groups) { const list = mine.filter(s => s.pack === g); if (!list.length) continue;
    box.append(h('div', {class: 'sndgroup lab'}, (PACKS.find(p => p.id === g)?.name || g) + (g === PACK.id ? ' (this pack)' : '')));
    for (const s of list) box.append(h('button', {class: 'snd', 'data-on': s.id === c.sound ? '1' : '', onclick: () => { c.locked = true; setSound(c, s.id); saveSounds(); logMacro(c, 'sound:' + s.id, 1); openSounds(c); flash('Sound: ' + s.name); }},
      h('b', {}, s.name), h('span', {class: 'muted'}, s.words || ''), likeBar(soundItem(s.id)))); }
  box.append(h('button', {class: 'sndclose phone', onclick: () => box.hidden = true}, 'Close')); }
// each pack remembers the sounds chosen for its columns (from any pack); Pack sounds puts its own back
const soundsKey = () => 'studio.jam.sounds.' + PACK.id;
function saveSounds(){ try { localStorage.setItem(soundsKey(), JSON.stringify(st.cols.map(c => c.locked ? c.sound : null))); } catch {} }
function packSounds(){ st.cols.forEach((c, i) => { c.locked = false; setSound(c, PACK.columns[i].sound); }); try { localStorage.removeItem(soundsKey()); } catch {} flash('Back to this pack’s own sounds'); }

/* ---------- the phone: a page at a time, picked from the tabs at the bottom ---------- */
const SHORT = {kick: 'Kick', hats: 'Hats', perc: 'Perc', bass: 'Bass', chords: 'Chords', lead: 'Lead'};
const mCols = h('div', {class: 'strip', id: 'mCols', 'aria-label': 'Parts'});
function setTab(t){ document.body.dataset.tab = t; try { localStorage.setItem('studio.jam.tab', t); } catch {}
  document.querySelectorAll('#tabs button').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const slot = document.querySelector(`[data-tabs~="${t}"] .mslot`); if (slot) slot.append(mCols);
  if (t === 'mix') renderMix();
  const ls = document.querySelector(`[data-tabs~="${t}"] .likeslot`); if (ls && phoneMQ.matches) ls.append($('partLikes')); if (t === 'likes') renderLikes();
  requestAnimationFrame(() => { drawPad(); drawNotes(); }); scrollTo(0, 0); }
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
// the rating row lives on the More page on a phone, under the moves elsewhere
// on a phone the rating row and the tempo live on the More page (the rest of the time beside the moves and in the top bar)
const phoneMQ = matchMedia('(max-width: 640px)'), placeFb = () => { const tp = document.querySelector('.tempo');
  if (phoneMQ.matches) document.querySelector('.tempoSlot').append(tp); else { document.querySelector('.chordbox').before(tp); document.querySelector('.perform .likeslot.desk').append($('partLikes')); } };
phoneMQ.addEventListener?.('change', placeFb);
function renderPhone(){ if (!PACK || !st.cols.length) return; const c = selCol();
  const sc = $('mScenes'); sc.innerHTML = ''; PACK.scenes.forEach((x, r) => sc.append(h('button', {class: 'mscene', onclick: () => scene(r)}, h('b', {}, String(r + 1)), x.name)));
  mCols.innerHTML = ''; st.cols.forEach((x, i) => { const b = h('button', {class: 'mchip', 'data-liked': liked(soundItem(x.sound)) || x.clip && liked(patternItem(x)) ? '1' : '', 'data-sel': i === st.sel ? '1' : '', 'data-on': x.clip ? '1' : '', 'data-mute': x.mute ? '1' : '', title: 'Tap to choose; hold to mute'},
      h('b', {}, SHORT[x.role] + (x.role === 'lead' && i > 5 ? ' 2' : '')), h('span', {}, x.mute ? 'muted' : x.clipId ? (CLIP[x.clipId]?.name || 'saved clip') : '—'));
    let held = null, long = false;
    b.addEventListener('pointerdown', () => { long = false; held = setTimeout(() => { long = true; x.mute = !x.mute; macros(x); logMacro(x, 'mute', x.mute ? 1 : 0); renderCol(x); flash(`${SHORT[x.role]} ${x.mute ? 'muted' : 'back in'}`); navigator.vibrate?.(15); }, 450); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(held));
    b.onclick = () => { if (long) return; st.sel = i; renderSel(); }; mCols.append(b); });
  $('mSound').textContent = '♪ ' + SND[c.sound].name; $('mSound').onclick = () => openSounds(c);
  $('mMute').textContent = c.mute ? 'Muted' : 'Mute'; $('mMute').setAttribute('aria-pressed', String(!!c.mute)); $('mMute').onclick = () => { c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderCol(c); };
  const box = $('mClips'); box.innerHTML = ''; const seen = new Set();
  PACK.scenes.forEach((x, r) => { const id = x.clips[st.sel]; if (!id || seen.has(id)) return; seen.add(id);
    box.append(h('button', {class: 'cell', 'data-on': c.clipId === id ? '1' : '', 'data-next': c.next && c.next !== 'stop' && c.next.id === id && !c.next.keep ? '1' : '', onclick: () => launch(c, id, 0, r)}, CLIP[id].name)); });
  box.append(h('button', {class: 'cell empty', 'data-next': c.next === 'stop' ? '1' : '', onclick: () => launch(c, null)}, '■ Stop')); }
$('m-snap').onclick = () => saveSnap();

// the XY pad: tone across, space up; drag (mouse or finger)
function drawPad(){ const cv = $('pad'), r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1, W = r.width, H = r.height; if (!W) return;
  cv.width = W*dpr; cv.height = H*dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr); const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  g.fillStyle = css('--well'); g.fillRect(0, 0, W, H); g.strokeStyle = css('--line'); g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i*W/4, 0); g.lineTo(i*W/4, H); g.stroke(); g.beginPath(); g.moveTo(0, i*H/4); g.lineTo(W, i*H/4); g.stroke(); }
  for (const [i, c] of st.cols.entries()) { const x = c.x*W, y = (1 - c.y)*H; g.globalAlpha = i === st.sel ? 1 : .25; g.fillStyle = css(i === st.sel ? '--on' : '--mute'); g.beginPath(); g.arc(x, y, i === st.sel ? 16 : 6, 0, Math.PI*2); g.fill(); }
  g.globalAlpha = 1; g.fillStyle = css('--mute'); g.font = '11px "IBM Plex Mono", monospace'; g.fillText('dark', 8, H - 8); g.fillText('bright', W - 48, H - 8); g.fillText('wet, far', 8, 16); g.fillText('dry, close', 8, H - 24); }
let padDrag = false;
const padAt = e => { const r = $('pad').getBoundingClientRect(), c = selCol(); c.x = Math.max(0, Math.min(1, (e.clientX - r.left)/r.width)); c.y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top)/r.height)); macros(c); logMacro(c, 'x', c.x); logMacro(c, 'y', c.y); drawPad(); clearTimeout(padAt.t); padAt.t = setTimeout(() => prewarm(c), 150); };
$('pad').addEventListener('pointerdown', e => { padDrag = true; $('pad').setPointerCapture(e.pointerId); padAt(e); });
$('pad').addEventListener('pointermove', e => { if (padDrag) padAt(e); });
$('pad').addEventListener('pointerup', () => padDrag = false);
const octave = d => { const c = selCol(); if (['kick', 'hats', 'perc'].includes(c.role)) return; c.oct = Math.max(-2, Math.min(2, (c.oct || 0) + d)); logMacro(c, 'oct', c.oct); prewarm(c); renderSel(); flash(`Octave ${c.oct > 0 ? '+' : ''}${c.oct}`); };
$('octDown').onclick = () => octave(-1); $('octUp').onclick = () => octave(1); $('packSounds').onclick = () => packSounds();
$('motion').onclick = () => { const c = selCol(); c.motion = (c.motion + 1) % 3; macros(c); logMacro(c, 'motion', c.motion); renderSel(); };
$('length').onclick = () => { const c = selCol(); c.length = (c.length + 1) % 3; lengthTo(c); logMacro(c, 'length', c.length); prewarm(c); renderSel(); };
for (const [id, fn] of [['m-vary', 'vary'], ['m-mutate', 'mutate'], ['m-build', 'build'], ['m-drop', 'drop'], ['m-harm', 'harmony']]) $(id).onclick = () => MOVES[fn]();
$('m-rep').addEventListener('pointerdown', () => repeat(true)); for (const ev of ['pointerup', 'pointerleave']) $('m-rep').addEventListener(ev, () => repeat(false));
$('play').onclick = () => st.playing ? stop() : start();
$('rec').onclick = () => record();
for (const [id, d] of [['bpmDown', -2], ['bpmUp', 2]]) $(id).onclick = () => { st.bpm = Math.max(100, Math.min(140, st.bpm + d)); $('bpmOut').textContent = st.bpm; tempo(); };
// the keyboard: 1–8 scenes; Q–U a column; ↑ ↓ its clip; Shift+Q–U mute; V M B D H moves; R held repeats; Space play
document.addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = e.key.toUpperCase();
  if (e.key === ' ') { e.preventDefault(); st.playing ? stop() : start(); return; }
  const dg = /^Digit([1-9])$/.exec(e.code); if (e.shiftKey && dg) { const x = SNAPS[+dg[1] - 1]; if (x) recall(x); return; }
  if (/^[1-8]$/.test(e.key)) { scene(+e.key - 1); return; }
  if (k === 'S' && !e.shiftKey && !e.metaKey && !e.ctrlKey) { saveSnap(); return; }
  const ci = 'QWERTYU'.indexOf(k); if (ci >= 0 && ci < st.cols.length && !e.repeat) { if (e.shiftKey) { const c = st.cols[ci]; c.mute = !c.mute; macros(c); renderCol(c); } else { st.sel = ci; renderSel(); } return; }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const c = selCol(), ids = PACK.scenes.map(s => s.clips[st.sel]).filter(Boolean), uniq = [...new Set(ids)], i = uniq.indexOf(c.next?.id || c.clipId); launch(c, uniq[(i + (e.key === 'ArrowDown' ? 1 : -1) + uniq.length) % uniq.length]); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const c = selCol(); c.x = Math.max(0, Math.min(1, c.x + (e.key === 'ArrowRight' ? .08 : -.08))); macros(c); drawPad(); return; }
  if (k === 'V') MOVES.vary(); if (k === 'M') MOVES.mutate(); if (k === 'B') MOVES.build(); if (k === 'D') MOVES.drop(); if (k === 'H') MOVES.harmony(); if (k === 'O') repeat(true); if (e.key === '[') octave(-1); if (e.key === ']') octave(1); if (k === 'F') nextFeel(); if (k === 'P') nextPlay(); if (k === 'X') keepPlayed(); if (k === 'N') riffTool('riff'); if (k === 'Z') undo(); if (k === 'G') sendTog('echo'); if (k === 'K') sendTog('verb'); if (k === 'L') $('follow').click(); if (k === 'J' && !e.repeat) throwTo(true); });
document.addEventListener('keyup', e => { if (e.key.toUpperCase() === 'O') repeat(false); if (e.key.toUpperCase() === 'J') throwTo(false); });
addEventListener('resize', () => { drawPad(); drawNotes(); });

/* ---------- snapshots: the user's own saved combinations, recalled on the next bar ---------- */
let SNAPS = [], snapOn = null, snapDel = null;
const SNAP_FIELDS = ['play', 'feel', 'echo', 'verb', 'voicing', 'inv', 'arp', 'walk', 'follow', 'mix'], SNAP_KEY = 'studio.jam.snaps', pitchedRole = r => !['kick', 'hats', 'perc'].includes(r);
const storeSnaps = () => { try { localStorage.setItem(SNAP_KEY, JSON.stringify(SNAPS)); } catch {} };
function capture(){ const n = SNAPS.reduce((m, x) => Math.max(m, +(/^Snap (\d+)$/.exec(x.name)?.[1] || 0)), 0) + 1;
  return {id: 's' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36), name: `Snap ${n}`, pack: PACK.id, bpm: st.bpm, smooth: st.smooth, echoDiv: st.echoDiv, mx: {...st.mx}, harmony: (st.hNext || st.harmony).id, at: new Date().toISOString(),
    cols: st.cols.map(c => { const cl = c.next === 'stop' ? null : c.next ? c.next : c.clipId ? {id: c.clipId, clip: c.clip, var: c.var} : null;
      return {role: c.role, sound: c.sound, locked: !!c.locked, x: +c.x.toFixed(3), y: +c.y.toFixed(3), motion: c.motion, length: c.length, oct: c.oct || 0, mute: !!c.mute, ...Object.fromEntries(SNAP_FIELDS.map(k => [k, c[k]])), mix: {...c.mix, solo: false}, vars: (c.vars || []).map(v => v.steps), lens: (c.vars || []).map(v => v.len || null), made: (c.vars || []).map(v => v.made || null), vi: c.vi || 0,
        clip: cl && {id: cl.id, var: cl.var || 0, len: cl.clip.len, steps: cl.clip.steps}}; })}; }
async function saveSnap(){ if (!PACK) return; const x = capture(); SNAPS.push(x); storeSnaps(); snapOn = x.id; renderSnaps(); flash('Saved ' + x.name);
  if (db) try { await db.collection('snaps').doc(x.id).set(x); } catch (err) { flash('Saved here only (' + (err.code || err.message) + ')'); } }
// sounds and settings change at once (so their notes are computed in time); clips and the harmony on the next bar
async function recall(x){ if (x.pack !== PACK.id) { if (!PACKS.some(p => p.id === x.pack)) { flash('That pack is gone'); return; } await loadPack(x.pack); }
  if (x.mx) { st.mx = {...st.mx, ...x.mx}; masterMix(); } snapOn = x.id; st.bpm = x.bpm; if (x.smooth !== undefined) st.smooth = x.smooth; if (x.echoDiv !== undefined) st.echoDiv = x.echoDiv; $('bpmOut').textContent = st.bpm; tempo();
  x.cols.forEach((v, i) => { const c = st.cols[i]; if (!c || c.role !== v.role) return;
    if (SND[v.sound] && v.sound !== c.sound) { setSound(c, v.sound); logMacro(c, 'sound:' + v.sound, 1); } c.locked = v.locked;
    for (const k of ['x', 'y', 'motion', 'length', 'oct', ...SNAP_FIELDS]) if (v[k] !== undefined && c[k] !== v[k]) { if (k === 'mix') { c.mix = {...c.mix, ...v.mix}; for (const [mk, mv] of Object.entries(v.mix)) logMacro(c, 'mix.' + mk, typeof mv === 'boolean' ? +mv : mv); continue; } c[k] = v[k]; logMacro(c, k, typeof v[k] === 'boolean' ? +v[k] : v[k]); }
    c.arpSt = null; if (v.vars) { c.vars = v.vars.map((steps, j) => ({steps, made: v.made?.[j] || undefined, ...(v.lens?.[j] ? {len: v.lens[j]} : {})})); c.varsOf = v.clip?.id; c.vi = v.vi || 0; }
    if (c.mute !== v.mute) { c.mute = v.mute; logMacro(c, 'mute', c.mute ? 1 : 0); } lengthTo(c); macros(c);
    if (!v.clip) c.next = 'stop'; else { const base = CLIP[v.clip.id] || {id: v.clip.id, role: c.role, name: 'Saved clip', variations: []}; c.next = {id: v.clip.id, clip: {...base, len: v.clip.len, steps: v.clip.steps}, var: v.clip.var}; prewarm(c, c.next.clip); }
    c.nextRow = PACK.scenes.findIndex(sc => sc.clips[i] === v.clip?.id);
    if (!st.playing) { if (c.next === 'stop') { c.clip = null; c.clipId = null; } else { c.clip = c.next.clip; c.clipId = c.next.id; c.var = c.next.var; c.row = c.nextRow; } delete c.next; c.start = 0; }
    renderCol(c); });
  if (PACK.harmonies.some(H => H.id === x.harmony)) setHarmony(x.harmony);
  saveSounds(); storeMix(); renderMix(); renderSel(); renderSnaps(); renderIdeas(); flash((st.playing ? 'Next bar: ' : '') + x.name); }
async function renameSnap(x){ const name = prompt('Name this snapshot', x.name)?.trim(); if (!name || name === x.name) return; x.name = name.slice(0, 40); storeSnaps(); renderSnaps();
  if (db) try { await db.collection('snaps').doc(x.id).update({name: x.name}); } catch {} }
async function deleteSnap(x){ if (snapDel !== x.id) { snapDel = x.id; renderSnaps(); flash('Press ✕ again to delete ' + x.name); setTimeout(() => { if (snapDel === x.id) { snapDel = null; renderSnaps(); } }, 3000); return; }
  SNAPS = SNAPS.filter(y => y !== x); snapDel = null; storeSnaps(); renderSnaps(); flash('Deleted ' + x.name); if (db) try { await db.collection('snaps').doc(x.id).delete(); } catch {} }
function renderSnaps(){ const box = $('snaps'); if (!box) return; box.innerHTML = '';
  box.append(h('button', {class: 'snap save', onclick: saveSnap, title: 'Save what’s playing (S)'}, h('b', {}, '＋ Save'), h('span', {class: 'muted'}, 'what’s playing now')));
  const list = [...SNAPS.filter(x => x.pack === PACK?.id), ...SNAPS.filter(x => x.pack !== PACK?.id)];
  list.forEach(x => { const k = SNAPS.indexOf(x), pk = PACKS.find(p => p.id === x.pack), H = (pk && x.pack === PACK.id ? PACK.harmonies.find(y => y.id === x.harmony)?.name : '') || '';
    box.append(h('div', {class: 'snap', 'data-on': x.id === snapOn ? '1' : '', 'data-del': x.id === snapDel ? '1' : ''},
      h('button', {class: 'go', onclick: () => recall(x), title: k < 9 ? `Recall (Shift+${k + 1})` : 'Recall'}, h('b', {}, (k < 9 ? k + 1 + ' · ' : '') + x.name), h('span', {class: 'muted'}, x.pack === PACK?.id ? H || ' ' : (pk?.name.split(':')[0] || x.pack))),
      h('span', {class: 'snapbtns'}, likeBar({kind: 'snap', key: x.id, name: x.name, data: {id: x.id}}, {noDown: true}), h('button', {class: 'mini', title: 'Into the arrangement', onclick: () => arrAdd(x.id)}, '＋ Arr'), h('button', {class: 'mini', title: 'Rename', onclick: () => renameSnap(x)}, '✎'), h('button', {class: 'mini', title: 'Delete', onclick: () => deleteSnap(x)}, '✕')))); }); }
/* ---------- the mixer: each part's fader, pan, mute and solo, EQ and how hard the kick ducks it; the master's volume, EQ,
   width and glue; all remembered per pack, kept in snapshots and recorded for the render ---------- */
const DUCKS = [['Off', 0], ['Light', .25], ['Medium', .4], ['Heavy', .65]];
const GLUE = [['Off', null], ['Gentle', {thr: -14, ratio: 1.8, att: .03, rel: .25}], ['Glue', {thr: -20, ratio: 3, att: .01, rel: .2}], ['Punch', {thr: -24, ratio: 4, att: .03, rel: .12}]];
const WIDTHS = [['Mono', 0], ['Narrow', .6], ['Normal', 1], ['Wide', 1.35], ['Wider', 1.7]];
const MASTER0 = {vol: 0, lo: 0, hi: 0, glue: 1, width: 2}, PAN0 = [0, .15, -.2, 0, 0, -.3, .3];
const mixKey = () => 'studio.jam.mix.' + PACK.id, savedMix = () => { try { return JSON.parse(localStorage.getItem(mixKey()) || '{}'); } catch { return {}; } };
function mixOf(c, i){ const saved = savedMix().cols?.[i]; return {vol: 0, pan: PAN0[i] || 0, lo: 0, mid: 0, hi: 0, duck: c.role === 'kick' ? 0 : c.role === 'chords' ? 3 : 2, solo: false, ...(saved || {}), ...(c.mix || {})}; }
const storeMix = () => { try { localStorage.setItem(mixKey(), JSON.stringify({cols: st.cols.map(c => ({...c.mix, solo: false})), master: st.mx})); } catch {} };
function masterMix(){ if (!mstr) return; const M = st.mx, now = ctx.currentTime, g = GLUE[M.glue][1];
  mstr.lo.gain.setTargetAtTime(M.lo, now, .02); mstr.hi.gain.setTargetAtTime(M.hi, now, .02); mstr.width.set('w', WIDTHS[M.width][1]); mstr.vol.gain.setTargetAtTime(Math.pow(10, M.vol/20), now, .02);
  const C = mstr.glue; if (g) { C.threshold.value = g.thr; C.ratio.value = g.ratio; C.attack.value = g.att; C.release.value = g.rel; C.knee.value = 8; } else { C.threshold.value = 0; C.ratio.value = 1; } }
const fmtDb = v => v <= -40 ? '−∞' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' dB';
const fmtPan = v => Math.abs(v) < .01 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100);
// a change from the mixer: applied, remembered, recorded (master changes on the '*' column)
function mixSet(c, k, v){ if (c) { c.mix[k] = v; if (k === 'solo') st.cols.forEach(macros); else macros(c); logMacro(c, 'mix.' + k, typeof v === 'boolean' ? +v : v); }
  else { st.mx[k] = v; masterMix(); logMaster(k, v); }
  storeMix(); renderMix(); }
// a fader: drag up and down (mouse or finger), − and + for 1.5 dB steps, a double tap back to 0 dB
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
const step = (lab, txt, dn, up) => h('div', {class: 'mstep'}, h('span', {class: 'lab'}, lab), h('button', {class: 'mini', 'aria-label': lab + ' down', onclick: dn}, '−'), h('b', {}, txt), h('button', {class: 'mini', 'aria-label': lab + ' up', onclick: up}, '+'));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let meters = [];
function renderMix(){ const box = $('mixer'); if (!box || !st.cols.length) return; const fi = [...box.querySelectorAll('.ftrack')].indexOf(document.activeElement); box.innerHTML = ''; meters = [];
  st.cols.forEach((c, i) => { const M = c.mix, f = fader(M.vol, (v, live, end) => { if (live) { c.mix.vol = v; macros(c); f.setAttribute('aria-valuenow', String(v)); f.parentNode.querySelector('.fval').textContent = fmtDb(v); } else { if (end) logMacro(c, 'mix.vol', c.mix.vol); if (!end) mixSet(c, 'vol', v); else { storeMix(); } } });
    meters.push([c.ch?.meter, f.meter]);
    box.append(h('div', {class: 'mstrip', 'data-sel': i === st.sel ? '1' : ''},
      h('button', {class: 'sname', onclick: () => { st.sel = i; renderSel(); renderMix(); }}, h('b', {}, SHORT[c.role] + (c.role === 'lead' && i > 5 ? ' 2' : '')), h('span', {}, SND[c.sound]?.name || '')),
      f, h('span', {class: 'fval'}, fmtDb(M.vol)),
      h('div', {class: 'mrow'}, h('button', {class: 'mini', 'aria-label': 'Quieter', onclick: () => mixSet(c, 'vol', clamp(M.vol - 1.5, -40, 6))}, '−'), h('button', {class: 'mini', 'aria-label': 'Louder', onclick: () => mixSet(c, 'vol', clamp(M.vol + 1.5, -40, 6))}, '+')),
      h('div', {class: 'mrow'}, h('button', {class: 'mini ms', 'aria-pressed': String(!!c.mute), onclick: () => { c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderCol(c); renderMix(); }}, 'M'),
        h('button', {class: 'mini ms solo', 'aria-pressed': String(!!M.solo), onclick: () => mixSet(c, 'solo', !M.solo)}, 'S')),
      step('Pan', fmtPan(M.pan), () => mixSet(c, 'pan', clamp(Math.round((M.pan - .25)*4)/4, -1, 1)), () => mixSet(c, 'pan', clamp(Math.round((M.pan + .25)*4)/4, -1, 1))),
      ...[['lo', 'Low'], ['mid', 'Mid'], ['hi', 'High']].map(([k, lab]) => step(lab, (M[k] > 0 ? '+' : '') + M[k], () => mixSet(c, k, clamp(M[k] - 1.5, -15, 9)), () => mixSet(c, k, clamp(M[k] + 1.5, -15, 9)))),
      c.role === 'kick' ? h('span', {class: 'muted sidenote'}, 'drives the duck') : h('button', {class: 'mini duckb', title: 'How far the kick ducks this part (sidechain)', onclick: () => mixSet(c, 'duck', (M.duck + 1) % DUCKS.length)}, 'Duck: ' + DUCKS[M.duck][0]))); });
  const X = st.mx, mf = fader(X.vol, (v, live, end) => { if (live) { st.mx.vol = v; masterMix(); mf.setAttribute('aria-valuenow', String(v)); mf.parentNode.querySelector('.fval').textContent = fmtDb(v); } else if (!end) mixSet(null, 'vol', v); else { logMaster('vol', st.mx.vol); storeMix(); } });
  meters.push([mstr?.meter, mf.meter]);
  box.append(h('div', {class: 'mstrip master'}, h('div', {class: 'sname'}, h('b', {}, 'Master'), h('span', {}, 'limiter always on')), mf, h('span', {class: 'fval'}, fmtDb(X.vol)),
    h('div', {class: 'mrow'}, h('button', {class: 'mini', onclick: () => mixSet(null, 'vol', clamp(X.vol - 1.5, -40, 6))}, '−'), h('button', {class: 'mini', onclick: () => mixSet(null, 'vol', clamp(X.vol + 1.5, -40, 6))}, '+')),
    h('button', {class: 'mini duckb', title: 'The glue compressor on the whole mix', onclick: () => mixSet(null, 'glue', (X.glue + 1) % GLUE.length)}, 'Glue: ' + GLUE[X.glue][0]),
    h('button', {class: 'mini duckb', title: 'Stereo width (the bass stays mono)', onclick: () => mixSet(null, 'width', (X.width + 1) % WIDTHS.length)}, 'Width: ' + WIDTHS[X.width][0]),
    ...[['lo', 'Low'], ['hi', 'High']].map(([k, lab]) => step(lab, (X[k] > 0 ? '+' : '') + X[k], () => mixSet(null, k, clamp(X[k] - 1.5, -12, 6)), () => mixSet(null, k, clamp(X[k] + 1.5, -12, 6)))),
    h('button', {class: 'mini duckb', onclick: () => { st.cols.forEach((c, i) => { c.mix = {...mixOf({role: c.role}, i), vol: 0, pan: PAN0[i] || 0, lo: 0, mid: 0, hi: 0, duck: c.role === 'kick' ? 0 : c.role === 'chords' ? 3 : 2, solo: false}; macros(c); }); st.mx = {...MASTER0}; masterMix(); storeMix(); renderMix(); flash('Mix reset'); }}, 'Reset mix')));
  if (fi >= 0) box.querySelectorAll('.ftrack')[fi]?.focus(); }
// the meters: each fader's peak, while the mixer shows
const buf = new Float32Array(1024);
(function meterLoop(){ requestAnimationFrame(meterLoop); if (!ctx || !st.playing || !meters.length || (phoneMQ.matches && document.body.dataset.tab !== 'mix')) return;
  for (const [an, el] of meters) { if (!an || !el) continue; an.getFloatTimeDomainData(buf.subarray(0, an.fftSize)); let pk = 0; for (let i = 0; i < an.fftSize; i++) pk = Math.max(pk, Math.abs(buf[i]));
    const dB = 20*Math.log10(pk || 1e-6), p = Math.max(0, Math.min(1, (dB + 48)/48)), held = Math.max(p, (+el.dataset.p || 0) - .02); el.dataset.p = held; el.style.height = held*100 + '%'; el.dataset.hot = dB > -1 ? '1' : ''; } })();

/* ---------- likes: one per thing (a sound, a part's pattern, a sound as shaped, a harmony, an idea, a snapshot), each
   👍, 👎 or neither, with a note; they stay lit, live in the page's database (and this device), and gather on the Likes page ---------- */
let LIKES = {}, likeFilter = 'all', noteFor = null;
const LIKE_KEY = 'studio.jam.likes';
try { LIKES = JSON.parse(localStorage.getItem(LIKE_KEY) || '{}'); } catch {}
const storeLikes = () => { try { localStorage.setItem(LIKE_KEY, JSON.stringify(LIKES)); } catch {} };
const hashOf = v => { let x = 2166136261; for (const ch of JSON.stringify(v)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
const likeId = it => `${it.kind}:${it.key}`.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 190);
const liked = it => LIKES[likeId(it)]?.rating === 1;
const soundItem = id => ({kind: 'sound', key: id, name: SND[id]?.name || id, sum: `${ROLE_NAMES[SND[id]?.role] || ''} · ${PACKS.find(p => p.id === SND[id]?.pack)?.name.split(':')[0] || ''}`, data: {sound: id, role: SND[id]?.role, pack: SND[id]?.pack}});
function patternItem(c){ const cl = c.clip, nm = (CLIP[c.clipId]?.name || 'a saved pattern') + (c.vi ? ` (variant ${letter(c.vi)})` : '');
  return {kind: 'pattern', key: `${c.role}:${c.clipId || 'saved'}:${hashOf(cl.steps)}`, name: `${nm} on ${SND[c.sound]?.name}`, sum: `${ROLE_NAMES[c.role]} · ${cl.len} steps · over ${(st.hNext || st.harmony).name}`,
    data: {role: c.role, col: c.id, clipId: c.clipId, len: cl.len, steps: cl.steps, sound: c.sound, harmony: (st.hNext || st.harmony).id, vi: c.vi || 0, pack: PACK.id}}; }
const SET_KEYS = ['x', 'y', 'motion', 'length', 'oct', 'play', 'feel', 'voicing', 'inv', 'arp', 'echo', 'verb'];
function settingsItem(c){ const set = Object.fromEntries(SET_KEYS.map(k => [k, typeof c[k] === 'number' ? +c[k].toFixed(2) : c[k]]));
  const words = [set.x < .35 ? 'dark' : set.x > .75 ? 'bright' : '', set.y > .6 ? 'wet' : set.y < .15 ? 'dry' : '', ['', 'slow motion', 'fast motion'][set.motion], ['short', '', 'long'][set.length], set.oct ? `octave ${set.oct > 0 ? '+' : ''}${set.oct}` : '',
    set.play ? 'played ' + PLAYS[set.play].name.toLowerCase() : '', set.feel ? FEELS[set.feel].name : '', c.role === 'chords' ? STYLES[set.voicing || 0] + (set.inv ? ` inv ${set.inv}` : '') + (set.arp ? ', arp ' + ARPS[set.arp] : '') : '', set.echo ? '' : 'no echo', set.verb ? '' : 'no reverb'].filter(Boolean);
  return {kind: 'settings', key: `${c.sound}:${hashOf(set)}`, name: `${SND[c.sound]?.name} · ${words.join(', ') || 'as it comes'}`, sum: ROLE_NAMES[c.role], data: {role: c.role, sound: c.sound, set}}; }
const harmonyItem = H => ({kind: 'harmony', key: H.id, name: H.name, sum: H.bars.filter((b, i, a) => b !== a[i - 1]).map(b => b.replace(':', ' ')).join(' → '), data: {id: H.id, name: H.name, words: H.words, bars: H.bars, pack: PACK.id}});
// a 👍 👎 💬 group; it stays lit, and every copy of it on the page changes together
function likeBar(it, o = {}){ const id = likeId(it), box = h('span', {class: 'likebar', 'data-like': id});
  const up = h('button', {class: 'up', title: 'I like this', 'aria-label': 'Like ' + it.name, onclick: e => { e.stopPropagation(); setLike(it, 1); }}, o.label ? o.label + '👍' : '👍');
  const dn = h('button', {class: 'dn', title: 'Not for me', 'aria-label': 'Dislike ' + it.name, onclick: e => { e.stopPropagation(); setLike(it, -1); }}, '👎');
  const nt = h('button', {class: 'nt', title: 'A note on it', 'aria-label': 'Note on ' + it.name, onclick: e => { e.stopPropagation(); openNote(it); }}, '💬');
  box.append(up); if (o.only !== 'up') { if (!o.noDown) box.append(dn); box.append(nt); } paintLike(box); return box; }
function paintLike(box){ const L = LIKES[box.dataset.like]; box.querySelector('.up')?.setAttribute('aria-pressed', String(L?.rating === 1)); box.querySelector('.dn')?.setAttribute('aria-pressed', String(L?.rating === -1));
  const nt = box.querySelector('.nt'); if (nt) nt.dataset.has = L?.note ? '1' : ''; }
function likesChanged(id){ document.querySelectorAll('.likebar').forEach(b => b.dataset.like === id && paintLike(b)); renderPhone(); renderHarmony(); if (document.body.dataset.tab === 'likes' || !phoneMQ.matches) renderLikes(); }
// a cleared like stays as a marker (`cleared`, with its time), so neither an older copy on another device or in the
// database nor the old ratings bring it back
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
// the part being played: its sound, its pattern, its settings
function renderPartLikes(){ const box = $('partLikes'), c = selCol(); if (!box || !c) return; box.innerHTML = '';
  const row = (lab, it) => box.append(h('span', {class: 'lab'}, lab), h('span', {class: 'what', title: it ? it.name : ''}, it ? it.name : 'not playing'), it ? likeBar(it) : h('span'));
  row('Sound', soundItem(c.sound)); row(isDrum(c) ? 'Pattern' : 'Melody', c.clip ? patternItem(c) : null); row('Settings', settingsItem(c)); }
// the Likes page
const KIND_NAMES = {sound: 'Sound', pattern: 'Pattern', settings: 'Settings', harmony: 'Harmony', idea: 'Idea', snap: 'Snapshot'};
const FILTERS = [['all', 'All'], ['sound', 'Sounds'], ['pattern', 'Patterns'], ['settings', 'Settings'], ['harmony', 'Harmonies'], ['snaps', 'Ideas & snapshots'], ['notes', 'Notes'], ['down', '👎']];
const inFilter = (L, f) => f === 'all' ? L.rating >= 0 : f === 'down' ? L.rating === -1 : f === 'notes' ? !!L.note : f === 'snaps' ? (L.kind === 'idea' || L.kind === 'snap') && L.rating >= 0 : L.kind === f && L.rating >= 0;
function renderLikes(){ const fl = $('likeFilters'), list = $('likeList'); if (!fl) return; const all = Object.entries(LIKES).filter(([, L]) => !L.cleared), q = $('likeSearch').value.trim().toLowerCase();
  fl.innerHTML = ''; for (const [k, lab] of FILTERS) { const n = all.filter(([, L]) => inFilter(L, k)).length; fl.append(h('button', {class: 'lchip', 'data-on': likeFilter === k ? '1' : '', onclick: () => { likeFilter = k; renderLikes(); }}, lab, h('small', {}, String(n)))); }
  list.innerHTML = ''; const items = all.filter(([, L]) => inFilter(L, likeFilter) && (!q || (L.name + ' ' + (L.note || '') + ' ' + (L.sum || '')).toLowerCase().includes(q))).sort((a, b) => a[1].at < b[1].at ? 1 : -1);
  if (!items.length) list.append(h('span', {class: 'muted'}, all.length ? 'Nothing here yet.' : 'Nothing liked yet. Tap 👍 on a sound, a pattern, its settings or a harmony as you play, and it gathers here.'));
  for (const [id, L] of items) { const it = {kind: L.kind, key: L.key, name: L.name, sum: L.sum, data: L.data};
    list.append(h('div', {class: 'likecard'}, h('span', {class: 'kind'}, KIND_NAMES[L.kind] || L.kind), h('b', {}, L.name), L.sum ? h('span', {class: 'sum'}, L.sum) : '', L.note ? h('span', {class: 'note'}, L.note) : '',
      h('div', {class: 'row'}, canUse(L) ? h('button', {class: 'use', onclick: () => useLike(L)}, 'Use') : '', likeBar(it), h('button', {class: 'mini', title: 'Forget it', onclick: () => saveLike(id, null)}, '✕')))); } }
$('likeSearch').oninput = () => renderLikes();
const canUse = L => L.kind === 'sound' ? !!SND[L.key] : L.kind === 'pattern' || L.kind === 'settings' ? !!SND[L.data?.sound] : L.kind === 'harmony' ? !!L.data?.bars : !!byRef(L.key);
// using a like: the sound, pattern or settings onto a part of its role (the chosen part if it is one), a harmony, a combination
const partFor = role => { const c = selCol(); return c.role === role ? c : st.cols.find(x => x.role === role); };
function useLike(L){ const d = L.data || {};
  if (L.kind === 'sound') { const c = partFor(d.role); if (!c) return; c.locked = true; setSound(c, L.key); saveSounds(); st.sel = st.cols.indexOf(c); renderSel(); flash(`${ROLE_NAMES[c.role]}: ${L.name}`); return; }
  if (L.kind === 'harmony') { if (!PACK.harmonies.some(H => H.id === d.id)) PACK.harmonies.push({id: d.id, name: d.name, words: d.words || '', bars: d.bars}); setHarmony(d.id); return; }
  if (L.kind === 'idea' || L.kind === 'snap') { const x = byRef(L.key); if (x) recall(x); return; }
  const c = st.cols.find(x => x.id === d.col && x.role === d.role) || partFor(d.role); if (!c) return; st.sel = st.cols.indexOf(c);
  if (d.sound && SND[d.sound] && c.sound !== d.sound) { c.locked = true; setSound(c, d.sound); saveSounds(); }
  if (L.kind === 'settings') { for (const k of SET_KEYS) if (d.set?.[k] !== undefined) c[k] = d.set[k]; c.arpSt = null; macros(c); lengthTo(c); prewarm(c); renderSel(); flash('Settings: ' + L.name); return; }
  const base = CLIP[d.clipId] || {id: d.clipId || 'liked', role: c.role, name: 'Liked pattern', variations: []}, clip = {...base, len: d.len, steps: d.steps};
  if (c.varsOf !== base.id) { c.vars = [{steps: d.steps}]; c.varsOf = base.id; c.vi = 0; } else if (!c.vars.some(v => hashOf(v.steps) === hashOf(d.steps))) { c.vars.push({steps: d.steps, made: 'Liked'}); c.vi = c.vars.length - 1; }
  c.next = {id: base.id, clip, var: c.vi}; c.nextRow = PACK.scenes.findIndex(sc => sc.clips[st.cols.indexOf(c)] === base.id); prewarm(c, clip);
  if (!st.playing) { c.clip = clip; c.clipId = base.id; c.var = c.vi; c.row = c.nextRow; delete c.next; c.start = 0; }
  renderCol(c); renderSel(); flash((st.playing ? 'Next bar: ' : '') + L.name); }
async function loadLikes(){ if (!db) return;
  try { const q = await db.collection('likes').get(), there = {};
    for (const d of q.docs) { const L = d.data(); if (!L) continue; there[d.id] = L.at; if (!LIKES[d.id] || LIKES[d.id].at <= L.at) LIKES[d.id] = L; }
    // what changed here while the database couldn't be written (a like or a clear), sent now
    for (const [id, L] of Object.entries(LIKES)) if (!there[id] || there[id] < L.at) try { await db.collection('likes').doc(id).set(L); } catch {}
    // the ratings given before likes stayed lit: the latest for each thing, brought in once
    const fb = await db.collection('feedback').get(), rows = fb.docs.map(d => d.data()).filter(Boolean).sort((a, b) => a.at < b.at ? -1 : 1), latest = {};
    for (const r of rows) latest[(r.kind === 'clip' ? 'pattern' : r.kind) + ':' + r.id] = r;
    for (const [k, r] of Object.entries(latest)) { const kind = r.kind === 'clip' ? 'pattern' : r.kind, it = kind === 'sound' ? soundItem(r.id) : {kind, key: r.id, name: r.name, data: kind === 'harmony' ? {id: r.id} : {id: r.id}}, id = likeId(it);
      if (!LIKES[id]) { LIKES[id] = {kind, key: it.key, name: it.name || r.name, sum: it.sum || '', data: it.data, rating: r.rating, note: r.note || '', at: r.at}; try { await db.collection('likes').doc(id).set(LIKES[id]); } catch {} } }
    storeLikes(); document.querySelectorAll('.likebar').forEach(paintLike); renderPhone(); renderHarmony(); renderLikes(); } catch {} }

/* ---------- the idea loop: Claude's ideas (written into the page's database by Claude), and the arrangement: snapshots
   and ideas in an order, played as a sketch and sent to Claude, who makes the next round from it ---------- */
let IDEAS = [], ARR = [], arrNote = '';
const ARR_KEY = 'studio.jam.arr', BARS = [4, 8, 16, 32], byRef = id => SNAPS.find(x => x.id === id) || IDEAS.find(x => x.id === id);
try { ARR = JSON.parse(localStorage.getItem(ARR_KEY) || '[]'); } catch {}
const storeArr = () => { try { localStorage.setItem(ARR_KEY, JSON.stringify(ARR)); } catch {} };
function renderIdeas(){ const box = $('ideas'); if (!box) return; box.innerHTML = ''; box.hidden = !IDEAS.length; if (!IDEAS.length) return;
  const rounds = [...new Set(IDEAS.map(x => x.round || 1))].sort((a, b) => b - a);
  for (const r of rounds) { box.append(h('div', {class: 'lab ideahead'}, `Claude’s ideas · round ${r}`)); const g = h('div', {class: 'snapgrid'}); box.append(g);
    for (const x of IDEAS.filter(y => (y.round || 1) === r).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      g.append(h('div', {class: 'snap idea', 'data-on': x.id === snapOn ? '1' : ''},
        h('button', {class: 'go', onclick: () => recall(x)}, h('span', {class: 'kind'}, x.kind || 'idea'), h('b', {}, x.name), h('span', {class: 'muted why'}, x.why || '')),
        h('span', {class: 'ideabtns'}, h('button', {class: 'mini', title: 'Into the arrangement', onclick: () => arrAdd(x.id)}, '＋ Arr'), h('button', {class: 'mini', title: 'Keep it in your snapshots', onclick: () => keepIdea(x)}, 'Keep'), likeBar({kind: 'idea', key: x.id, name: x.name, data: {id: x.id, round: x.round}})))); } }
async function keepIdea(x){ const y = {...JSON.parse(JSON.stringify(x)), id: 's' + Date.now().toString(36), name: x.name, from: x.id, at: new Date().toISOString()}; for (const k of ['round', 'kind', 'why', 'order']) delete y[k];
  SNAPS.push(y); storeSnaps(); renderSnaps(); flash('Kept ' + x.name + ' in your snapshots'); if (db) try { await db.collection('snaps').doc(y.id).set(y); } catch {} }
function arrAdd(id){ ARR.push({ref: id, bars: 8}); storeArr(); renderArr(); flash('Into the arrangement: ' + byRef(id)?.name); }
function renderArr(){ const box = $('arr'); if (!box) return; box.innerHTML = ''; const playing = st.arr ? st.arr.i : -1;
  if (!ARR.length) box.append(h('span', {class: 'muted'}, 'Tap ＋ Arr on any snapshot or idea to put it here, in the order you want.'));
  ARR.forEach((e, i) => { const x = byRef(e.ref);
    box.append(h('div', {class: 'arrchip', 'data-on': i === playing ? '1' : ''},
      h('button', {class: 'arrname', title: 'Tap to change its length', onclick: () => { e.bars = BARS[(BARS.indexOf(e.bars) + 1) % BARS.length]; storeArr(); renderArr(); }}, h('b', {}, `${i + 1} · ${x?.name || '(gone)'}`), h('span', {}, e.bars + ' bars')),
      h('span', {class: 'arrbtns'}, h('button', {class: 'mini', 'aria-label': 'Earlier', onclick: () => { if (i) { [ARR[i - 1], ARR[i]] = [ARR[i], ARR[i - 1]]; storeArr(); renderArr(); } }}, '◀'),
        h('button', {class: 'mini', 'aria-label': 'Later', onclick: () => { if (i < ARR.length - 1) { [ARR[i + 1], ARR[i]] = [ARR[i], ARR[i + 1]]; storeArr(); renderArr(); } }}, '▶'),
        h('button', {class: 'mini', 'aria-label': 'Remove', onclick: () => { ARR.splice(i, 1); storeArr(); renderArr(); }}, '✕')))); });
  $('arrPlay').textContent = st.arr ? '■ Stop arrangement' : '▶ Play arrangement'; $('arrPlay').disabled = !ARR.length; $('arrSend').disabled = !ARR.length; }
// playing it: each entry is recalled a bar before it begins, so its clips land on its first bar
function arrPlay(){ if (st.arr) { st.arr = null; renderArr(); flash('Arrangement stopped: carrying on with what’s playing'); return; } if (!ARR.length) return;
  const first = byRef(ARR[0].ref); if (!first) return; recall(first);
  const at = st.playing ? Math.ceil(st.step/16)*16 : 0; st.arr = {i: 0, next: at + ARR[0].bars*16}; if (!st.playing) start(); renderArr(); }
function arrBar(step){ const a = st.arr; if (!a || !ARR.length) return;
  if (step === a.next - 16) { a.p = (a.i + 1) % ARR.length; const x = byRef(ARR[a.p].ref); if (x) recall(x); }
  if (step >= a.next) { a.i = a.p ?? (a.i + 1) % ARR.length; a.next = step + ARR[a.i].bars*16; renderArr(); } }
async function arrSend(){ if (!ARR.length) return; if (!db) { flash('Sign in to claude.ai to send'); return; }
  const refs = [...new Set(ARR.map(e => e.ref))], note = $('arrNote').value.trim();
  const row = {note, pack: PACK.id, entries: ARR.map(e => ({ref: e.ref, bars: e.bars, name: byRef(e.ref)?.name || '', idea: !!IDEAS.find(x => x.id === e.ref)})), snaps: refs.map(byRef).filter(Boolean), at: new Date().toISOString()};
  try { await db.collection('arrangements').add(row); $('arrNote').value = ''; flash('Sent to Claude: tell Claude it’s there'); $('arrMsg').textContent = `Sent ${new Date().toLocaleTimeString()}: ${ARR.length} parts. Tell Claude, and the next round of ideas will come from it.`; }
  catch (err) { flash('Not sent (' + (err.code || err.message) + ')'); } }
$('arrPlay').onclick = arrPlay; $('arrSend').onclick = arrSend;
async function loadIdeas(){ if (!db) return; try { const q = await db.collection('ideas').get(); IDEAS = q.docs.map(d => ({...d.data(), id: d.id})).filter(x => x.cols); renderIdeas(); renderArr(); } catch {} }

async function loadSnaps(){ try { SNAPS = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch { SNAPS = []; } renderSnaps();
  if (!db) return; try { const q = await db.collection('snaps').get(), have = new Set(SNAPS.map(x => x.id));
    for (const d of q.docs) { const x = d.data(); if (x && !have.has(x.id)) SNAPS.push(x); }
    for (const x of SNAPS) if (!q.docs.some(d => d.id === x.id)) try { await db.collection('snaps').doc(x.id).set(x); } catch {}
    SNAPS.sort((a, b) => a.at < b.at ? -1 : 1); storeSnaps(); renderSnaps(); renderArr(); } catch {} }

/* ---------- feedback and keeping (the page's database) ---------- */
let db = null;
$('keepJam').onclick = async () => { if (!db || !lastTake) return; $('keepJam').disabled = true; $('takeNote').textContent = 'Keeping…';
  const used = [...new Set(lastTake.notes.map(n => n[2]).concat(lastTake.macros.filter(m => String(m[2]).startsWith('sound:')).map(m => m[2].slice(6))))];
  try { await db.collection('jams').add({name: $('jamName').value.trim() || `Jam at ${st.bpm} BPM`, note: $('jamNote').value.trim(), pack: PACK.id, bpm: lastTake.bpm, swing: lastTake.swing, echoDiv: lastTake.echoDiv, mix: lastTake.mix, mx: lastTake.mx, bars: lastTake.bars,
      columns: st.cols.map(c => ({id: c.id, role: c.role})), sounds: used.map(id => SND[id]).filter(Boolean), notes: lastTake.notes, macros: lastTake.macros, at: new Date().toISOString()});
    $('takeNote').textContent = 'Kept. Claude will render it at full quality into the listening room.'; lastTake = null; }
  catch (err) { $('takeNote').textContent = 'Not kept (' + (err.code || err.message) + '). Try again.'; $('keepJam').disabled = false; } };

// the packs: each round of ideas Claude makes; switching stops the music and lays out the new pack's grid
let PACKS = [];
async function loadPack(id){ if (st.playing) stop();
  for (const c of st.cols) { try { c.ch?.out.disconnect(); c.ch?.lfo.stop(); } catch {} }
  PACK = await (await fetch(`packs/${id}.json`)).json(); try { localStorage.setItem('studio.jam.pack', id); } catch {}
  CLIP = Object.fromEntries(PACK.clips.map(c => [c.id, c]));
  st.bpm = PACK.bpm; st.swing = PACK.swing; $('bpmOut').textContent = st.bpm; st.harmony = PACK.harmonies[0]; st.hNext = null; st.sel = 0;
  let chosen = []; try { chosen = JSON.parse(localStorage.getItem(soundsKey()) || '[]'); } catch {}
  st.cols = PACK.columns.map((c, i) => ({...c, ...(SND[chosen[i]] ? {sound: chosen[i], locked: true} : {}), x: X0(c.role), y: .3, motion: 0, length: 1, oct: 0, play: 0, feel: 0, echo: true, verb: true, voicing: 0, inv: 0, arp: 0, walk: false, follow: 0, vars: [], vi: 0, level: .85, mix: mixOf(c, i), clip: null, clipId: null, start: 0, ...Object.fromEntries(['feel', 'echo', 'verb', 'voicing'].filter(k => c[k] !== undefined).map(k => [k, c[k]]))}));   // (a pack can start a column on its own feel and sends)
  st.mx = {...MASTER0, ...(savedMix().master || {})}; if (ctx) { for (const c of st.cols) { makeChan(c); buildSound(c); } tempo(); masterMix(); renderMix(); }
  renderPacks(); renderGrid(); renderHarmony(); scene(1); renderSel(); renderSnaps(); renderMix(); busy(); }
function renderPacks(){ const box = $('packs'); box.innerHTML = ''; box.append(h('span', {class: 'lab'}, 'Pack'));
  for (const p of PACKS) box.append(h('button', {class: 'pchip', 'data-on': p.id === PACK?.id ? '1' : '', title: p.words || '', onclick: () => p.id !== PACK.id && loadPack(p.id)}, p.name));
  if (PACK?.words) box.append(h('span', {class: 'muted'}, PACK.words)); }
(async () => {
  try { PACKS = (await (await fetch('packs/index.json')).json()).packs; } catch { PACKS = [{id: 'pack-1', name: 'Pack 1'}]; }
  try { LIB = (await (await fetch('packs/library.json')).json()).sounds; } catch { LIB = []; }
  if (!LIB.length) for (const p of PACKS) LIB.push(...(await (await fetch(`packs/${p.id}.json`)).json()).sounds.map(s => ({...s, pack: p.id})));
  SND = Object.fromEntries(LIB.map(s => [s.id, s]));
  let want = null; try { want = localStorage.getItem('studio.jam.pack'); } catch {}
  await loadPack(PACKS.some(p => p.id === want) ? want : PACKS.at(-1).id);
  let tab = 'clips'; try { tab = localStorage.getItem('studio.jam.tab') || 'clips'; } catch {} setTab(tab); placeFb(); renderLikes();
  loadSnaps(); renderArr();
  db = await window.claude?.use?.('db').catch(() => null) || null;
  loadSnaps(); loadIdeas(); loadLikes();
})();
