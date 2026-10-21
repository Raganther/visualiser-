// Studio Jam: a clip launcher for the ideas Claude makes. Columns are roles (kick, hats, percussion, bass, chords, two
// leads), each playing one clip at a time on one sound from the library; clips follow the harmony (model.js), so any
// clip on any sound over any progression. Everything changes on the next bar. No notes and no sliders: an XY pad (tone
// across, space up), two step buttons (motion, length), jam moves (vary, mutate, build, drop, repeat, next harmony), the
// keyboard. Record writes down what plays, for Claude to render; 👍 / 👎 on clips, sounds and harmonies.
import { notesAt, chordOf, mutate, ROLE_NAMES, nativeSet, cutOf, LEN, X0, vlChain, invert, STYLES, FEELS, feelAt, XFORMS, XNAMES, FOLLOW, ARPS, ECHO } from './model.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { NATIVE } from '../lib/native/index.js';
import { makePoly, PRESETS } from '../../src/audio/engine/inst/poly.js';
import { makeDrums } from '../../src/audio/engine/inst/drums.js';

const $ = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v != null) e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };
let PACK = null, SND = {}, CLIP = {}, LIB = [];
const st = {smooth: (() => { try { return localStorage.getItem('studio.jam.smooth') !== '0'; } catch { return true; } })(), echoDiv: 0, bar: 0, bpm: 124, swing: .06, harmony: null, hNext: null, hStart: 0, cols: [], sel: 0, playing: false, step: 0, rec: null, build: null, drop: null, rep: null};

/* ---------- audio: a channel per column (filter with an LFO, pan, the kick's pump, echo and reverb sends) ---------- */
let ctx, master, hp, delay, verb, worker, nextT = 0, timer = 0;
const cache = new Map(), pending = new Set();
function initAudio(){ if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'});
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .12;
  hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 18; master = ctx.createGain(); master.gain.value = .85;
  master.connect(hp); hp.connect(lim); lim.connect(ctx.destination);
  delay = {in: ctx.createGain(), d: ctx.createDelay(2), fb: ctx.createGain(), lp: ctx.createBiquadFilter()};
  delay.lp.frequency.value = 2400; delay.fb.gain.value = .45; delay.in.connect(delay.d); delay.d.connect(delay.lp); delay.lp.connect(delay.fb); delay.fb.connect(delay.d); delay.lp.connect(master);
  verb = ctx.createConvolver(); const L = 2.8*ctx.sampleRate, ir = ctx.createBuffer(2, L, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); let lp = 0; for (let i = 0; i < L; i++) { lp += (.3 - .25*i/L)*((Math.random()*2 - 1) - lp); x[i] = lp*Math.pow(1 - i/L, 2.2); } }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .8; verb.connect(vg); vg.connect(master);
  worker = new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent], {type: 'text/javascript'})));
  worker.onmessage = e => { const {key, L, R, error} = e.data; pending.delete(key); if (!error) { const b = ctx.createBuffer(2, L.length, ctx.sampleRate); b.copyToChannel(L, 0); b.copyToChannel(R, 1); cache.set(key, b); } busy(); };
  for (const c of st.cols) { makeChan(c); buildSound(c); } tempo();
}
function makeChan(c){ const x = {in: ctx.createGain(), f: ctx.createBiquadFilter(), pan: ctx.createStereoPanner(), duck: ctx.createGain(), out: ctx.createGain(), echo: ctx.createGain(), verb: ctx.createGain(), lfo: ctx.createOscillator(), lfoG: ctx.createGain()};
  x.in.connect(x.f); x.f.connect(x.pan); x.pan.connect(x.duck); x.duck.connect(x.out); x.out.connect(master); x.out.connect(x.echo); x.out.connect(x.verb); x.echo.connect(delay.in); x.verb.connect(verb);
  x.lfo.connect(x.lfoG); x.lfoG.connect(x.f.frequency); x.lfo.start(); x.f.Q.value = 1.2; x.pan.pan.value = [0, .15, -.2, 0, 0, -.3, .3][st.cols.indexOf(c)] || 0; c.ch = x; macros(c); }
// the macros: tone (the channel's filter, and a native sound's mallet), space (echo and reverb), motion (the LFO), length
function macros(c){ if (!c.ch) return; const x = c.ch, now = ctx.currentTime, s = .05;
  x.f.frequency.setTargetAtTime(cutOf(c.x), now, s); x.echo.gain.setTargetAtTime(c.throw ? .95 : c.echo ? c.y*.5 : 0, now, c.throw ? .005 : s); x.verb.gain.setTargetAtTime(c.verb ? c.y*.75 : 0, now, s);
  x.out.gain.setTargetAtTime(c.mute ? 0 : c.level, now, .01);
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
const walkOf = c => c.clip ? Math.floor(Math.max(0, st.step - c.start)/c.clip.len) % 4 : 0;
// every native note a column will need with its clip over the whole harmony, computed ahead
function prewarm(c, clip = c.clip){ if (!ctx || !clip) return; const H = st.hNext || st.harmony, sd = 60/st.bpm/4, ch = chainOf(H), arp = c.role === 'chords' && c.arp;
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
    let notes = partNotes(c, c.clip, pos, H, bar);
    if (c.role === 'chords' && c.arp) { if (notes.length) c.arpSt = {until: step + Math.max(1, Math.round(notes[0][1])), vel: notes[0][2], i: c.arpSt?.i ?? 0};   // (the arp runs on across hits)
      notes = []; const a = c.arpSt; if (a && step < a.until) { const ch = chainOf(H), bi = ((bar % H.bars.length) + H.bars.length) % H.bars.length;
        const v = invert(ch ? ch[bi].voicing : notesAt({role: 'chords', steps: [[0, 'chord', 1, 1]]}, 0, chordOf(H, bar)).map(x => x[0]), c.inv || 0), m = v.length, k = a.i++;
        const j = {up: k % m, down: m - 1 - k % m, 'up and down': m < 2 ? 0 : [...Array(m).keys(), ...[...Array(m).keys()].slice(1, -1).reverse()][k % (2*m - 2)], random: Math.floor(Math.random()*m)}[ARPS[c.arp]];
        notes = [[v[j], .9, a.vel]]; } }
    for (const [n0, len, vel] of notes) { const n = drum ? n0 : n0 + 12*(c.oct || 0); play(c, n, len, vel, t, fe.v);
      if (st.rec && step >= st.rec.from) st.rec.notes.push([step - st.rec.from, c.id, c.sound, n, len, +Math.min(1, vel*fe.v).toFixed(2), +recOff.toFixed(3)]); } }
  const s = step; setTimeout(() => light(s), Math.max(0, (t0 - ctx.currentTime)*1000));
}
// fv: the feel's loudness (a native note is computed at the clip's own loudness and played louder or softer, so the
// feel never waits on a new note being computed)
function play(c, n, len, vel, t, fv = 1){ const v2 = Math.max(.05, Math.min(1, vel*fv));
  if (c.inst.kind === 'drums') { const v = c.inst.voices[n]; if (!v) return; if (v.kit) v.kit.play(n, t, v2, null); else nativeNote(c, v.native, v.n, vel, nativeSet(c, v.native, v.set), t, .5, fv);
    if (c.role === 'kick') duck(t); return; }
  if (c.inst.poly) c.inst.poly.play(n, t, len*sd(), v2); else nativeNote(c, c.inst.native, n + c.inst.shift, vel, nativeSet(c, c.inst.native, c.inst.set), t, len*sd(), fv); }
function duck(t){ for (const c of st.cols) { if (c.role === 'kick' || !c.ch) continue; const g = c.ch.duck.gain; g.setTargetAtTime(c.role === 'chords' ? .35 : .6, t, .004); g.setTargetAtTime(1, t + .03, .1); } }
function barLine(step){
  if (st.hNext) { st.harmony = st.hNext; st.hNext = null; st.hStart = step; renderHarmony(); }
  for (const c of st.cols) { if (c.next !== undefined) { const nx = c.next; delete c.next; if (nx === 'stop') { c.clip = null; c.clipId = null; } else { c.clip = nx.clip; c.clipId = nx.id; c.var = nx.var || 0; if (!nx.keep) { c.start = step; c.row = c.nextRow; } } renderCol(c); }
    // Follow: the part's variants in turn, one a bar
    else if (c.follow && c.clip && c.vars?.length > 1) { const pat = FOLLOW[c.follow], b = Math.floor(step/16), n = c.vars.length;
      const i = pat === 'random' ? (Math.random() < .5 ? c.vi : Math.floor(Math.random()*n)) : Math.min(n - 1, pat.charCodeAt(b % pat.length) - 65);
      if (i !== c.vi) { c.vi = i; c.clip = {...c.clip, steps: c.vars[i].steps}; c.var = i; if (st.sel === st.cols.indexOf(c)) renderShape(); } } }
  if (st.build) { const b = st.build; if (step >= b.at + b.bars*16) { hp.frequency.cancelScheduledValues(ctx.currentTime); hp.frequency.setTargetAtTime(18, ctx.currentTime, .02); st.build = null; $('m-build').dataset.on = ''; } }
  if (st.drop && step >= st.drop.at + 16) { st.drop = null; $('m-drop').dataset.on = ''; }
  const bar = Math.floor((step - st.hStart)/16); st.bar = bar; $('chordNow').textContent = st.harmony.bars[bar % st.harmony.bars.length].replace(':', ' '); $('barNow').textContent = `bar ${bar % st.harmony.bars.length + 1} of ${st.harmony.bars.length}`;
}
async function start(){ initAudio(); await ctx.resume(); if (st.playing) return; st.playing = true; st.step = 0; st.hStart = 0; nextT = ctx.currentTime + .1;
  for (const c of st.cols) if (c.next === undefined && c.clip) c.start = 0; timer = setInterval(tick, 25); tick(); $('play').textContent = 'Stop'; $('play').setAttribute('aria-pressed', 'true'); busy(); }
function stop(){ st.playing = false; clearInterval(timer); $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); light(-1); if (st.rec) record(); busy(); }

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
function setVar(c, i){ if (!c.clip || !c.vars?.[i]) return; c.vi = i; const clip = {...c.clip, steps: c.vars[i].steps};
  if (st.playing) c.next = {id: c.clipId, clip, var: i, keep: true}; else { c.clip = clip; c.var = i; } prewarm(c, clip); logMacro(c, 'var', i); flash(`${ROLE_NAMES[c.role]}: variant ${letter(i)}`); renderCol(c); renderShape(); }
function addVar(c, steps, why){ if (!c.vars) c.vars = [{steps: c.clip.steps}]; const base = CLIP[c.clipId] ? 1 + CLIP[c.clipId].variations.length : 1;
  c.vars.push({steps, made: why}); if (c.vars.length > VMAX) c.vars.splice(base, 1); setVar(c, c.vars.length - 1); flash(`${why}: variant ${letter(c.vars.length - 1)}`); }
function transform(k){ const c = selCol(); if (!c.clip) return; addVar(c, XFORMS[k](c.clip), XNAMES[k]); }

/* ---------- jam moves ---------- */
const MOVES = {
  vary(){ const c = selCol(); if (!c.clipId || !c.vars?.length) return; setVar(c, ((c.vi || 0) + 1) % c.vars.length); },
  mutate(){ const c = selCol(); if (!c.clip) return; addVar(c, mutate(c.clip).steps, 'Mutated'); },
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
function record(){ if (!st.rec) { if (!st.playing) start(); st.rec = {from: Math.ceil(st.step/16)*16, notes: [], macros: [], bpm: st.bpm, swing: st.swing, echoDiv: st.echoDiv, harmonies: []}; $('rec').setAttribute('aria-pressed', 'true'); flash('Recording from the next bar'); return; }
  const r = st.rec; st.rec = null; $('rec').setAttribute('aria-pressed', 'false'); r.bars = Math.ceil((st.step - r.from)/16); lastTake = r; $('keepJam').disabled = !db || !r.notes.length;
  $('takeNote').textContent = r.notes.length ? `Take: ${r.bars} bars, ${r.notes.length} notes. Keep it for Claude to render, or record again.` : 'Nothing was recorded.'; }
let lastTake = null; window.__jamTake = () => lastTake && {...lastTake, columns: st.cols.map(c => ({id: c.id, role: c.role}))};   // (for tests)
const logMacro = (c, k, v) => st.rec?.macros.push([Math.max(0, st.step - st.rec.from), c.id, k, +(+v).toFixed(3)]);

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
    h('button', {class: 'mute', 'aria-pressed': String(!!c.mute), onclick: () => { c.mute = !c.mute; macros(c); logMacro(c, 'mute', c.mute ? 1 : 0); renderCol(c); }}, c.mute ? 'Muted' : 'Mute'));
  document.querySelectorAll(`.cell[data-col="${c.id}"]`).forEach(b => { b.dataset.on = c.clipId && +b.dataset.row === c.row ? '1' : ''; b.dataset.next = c.next && c.next !== 'stop' && +b.dataset.row === c.nextRow ? '1' : ''; });
  if (i === st.sel) renderSel(); else renderPhone(); }
function renderSel(){ const c = selCol(); st.cols.forEach((x, i) => x.head && (x.head.dataset.sel = i === st.sel ? '1' : ''));
  $('selName').textContent = `${ROLE_NAMES[c.role]}: ${SND[c.sound].name}`; $('selClip').textContent = c.clipId ? CLIP[c.clipId].name + (c.var ? ` (variation ${c.var})` : '') : 'not playing';
  $('octOut').textContent = (c.oct > 0 ? '+' : '') + (c.oct || 0); $('octBox').hidden = ['kick', 'hats', 'perc'].includes(c.role); $('motion').textContent = 'Motion: ' + ['still', 'slow', 'fast'][c.motion]; $('length').textContent = 'Length: ' + ['short', 'normal', 'long'][c.length];
  drawPad(); renderShape(); renderPhone(); }
function renderHarmony(){ const box = $('harmonies'); box.innerHTML = '';
  for (const H of PACK.harmonies) box.append(h('button', {class: 'hchip', 'data-on': H === st.harmony ? '1' : '', 'data-next': H === st.hNext ? '1' : '', title: H.words, onclick: () => setHarmony(H.id)}, H.name));
  $('hWords').textContent = (st.hNext || st.harmony).words; }
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
  const V = $('vars'); V.innerHTML = ''; (c.vars || []).forEach((v, i) => V.append(h('button', {'data-on': i === (c.vi || 0) && c.clip ? '1' : '', 'data-next': c.next?.keep && c.next.var === i ? '1' : '', title: v.made ? `Made by ${v.made}` : i ? 'One of Claude’s variations' : 'The original', onclick: () => setVar(c, i)}, letter(i), v.made ? h('small', {}, v.made.replace(/^[▲▼] /, '').slice(0, 6)) : '')));
  $('follow').textContent = 'Follow: ' + (FOLLOW[c.follow || 0] ? FOLLOW[c.follow].split('').join(' ').replace('r a n d o m', 'random') : 'off'); $('follow').dataset.on = c.follow ? '1' : '';
  $('feel').innerHTML = ''; $('feel').append('Feel: ' + FEELS[c.feel || 0].name, h('small', {}, 'F'));
  $('echoOn').innerHTML = ''; $('echoOn').append('Echo: ' + (c.echo ? 'on' : 'off'), h('small', {}, 'G')); $('echoOn').dataset.on = c.echo ? '1' : '';
  $('verbOn').innerHTML = ''; $('verbOn').append('Reverb: ' + (c.verb ? 'on' : 'off'), h('small', {}, 'K')); $('verbOn').dataset.on = c.verb ? '1' : '';
  $('echoTime').innerHTML = ''; $('echoTime').append('Echo time: ' + ECHO[st.echoDiv][0], h('small', {}, 'every part'));
  drawNotes(); }
function inv(c, d){ c.inv = Math.max(-3, Math.min(3, (c.inv || 0) + d)); logMacro(c, 'inv', c.inv); prewarm(c); renderShape(); flash(`Inversion ${c.inv > 0 ? '+' : ''}${c.inv}`); }
// the notes: drums as hits by voice; a line as its notes over the clip, named; chords as the voicing chain over the harmony
function drawNotes(step){ const cv = $('notes'), r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1, W = r.width, Ht = r.height; if (!W) return;
  if (cv.width !== Math.round(W*dpr)) { cv.width = W*dpr; cv.height = Ht*dpr; } const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Ht);
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), ink = css('--ink'), mute = css('--mute'), on = css('--on'), acc = css('--acc'), line = css('--line');
  const c = selCol(), H = st.hNext || st.harmony; g.font = '11px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
  if (!c.clip) { g.fillStyle = mute; g.fillText('Not playing: launch a clip above.', 12, Ht/2); return; }
  const L = 46, pw = W - L - 8, pos = step == null ? -1 : ((step - c.start) % c.clip.len + c.clip.len) % c.clip.len;
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
const nextFeel = () => { const c = selCol(); c.feel = ((c.feel || 0) + 1) % FEELS.length; logMacro(c, 'feel', c.feel); renderShape(); flash(`${ROLE_NAMES[c.role]} feel: ${FEELS[c.feel].name}`); };
const sendTog = k => { const c = selCol(); c[k] = !c[k]; macros(c); logMacro(c, k, c[k] ? 1 : 0); renderShape(); flash(`${ROLE_NAMES[c.role]} ${k === 'echo' ? 'echo' : 'reverb'} ${c[k] ? 'on' : 'off'}`); };
const throwTo = on => { const c = selCol(); if (!!c.throw === on) return; c.throw = on; macros(c); logMacro(c, 'throw', on ? 1 : 0); $('throw').dataset.on = on ? '1' : ''; };
$('feel').onclick = nextFeel; $('echoOn').onclick = () => sendTog('echo'); $('verbOn').onclick = () => sendTog('verb');
$('throw').addEventListener('pointerdown', e => { e.preventDefault(); throwTo(true); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('throw').addEventListener(ev, () => throwTo(false));
$('echoTime').onclick = () => { st.echoDiv = (st.echoDiv + 1) % ECHO.length; tempo(); if (st.rec) st.rec.macros.push([Math.max(0, st.step - st.rec.from), '*', 'echoDiv', st.echoDiv]); renderShape(); flash('Echo time: ' + ECHO[st.echoDiv][0]); };

// the sound picker: the library's sounds for this column's role
function openSounds(c){ const box = $('sounds'); box.innerHTML = ''; box.hidden = false;
  box.append(h('div', {class: 'sndhead'}, h('b', {}, `Sounds for ${ROLE_NAMES[c.role]}`), h('button', {class: 'ghost', onclick: () => box.hidden = true}, 'Close')));
  const mine = LIB.filter(s => s.role === c.role), groups = [PACK.id, ...new Set(mine.map(s => s.pack).filter(p => p !== PACK.id))];
  for (const g of groups) { const list = mine.filter(s => s.pack === g); if (!list.length) continue;
    box.append(h('div', {class: 'sndgroup lab'}, (PACKS.find(p => p.id === g)?.name || g) + (g === PACK.id ? ' (this pack)' : '')));
    for (const s of list) box.append(h('button', {class: 'snd', 'data-on': s.id === c.sound ? '1' : '', onclick: () => { c.locked = true; setSound(c, s.id); saveSounds(); logMacro(c, 'sound:' + s.id, 1); openSounds(c); flash('Sound: ' + s.name); }},
      h('b', {}, s.name), h('span', {class: 'muted'}, s.words || ''), rateBtns('sound', s.id, s.name))); }
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
  requestAnimationFrame(() => { drawPad(); drawNotes(); }); scrollTo(0, 0); }
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
// the rating row lives on the More page on a phone, under the moves elsewhere
// on a phone the rating row and the tempo live on the More page (the rest of the time beside the moves and in the top bar)
const phoneMQ = matchMedia('(max-width: 640px)'), placeFb = () => { const fb = document.querySelector('.fb'), tp = document.querySelector('.tempo');
  if (phoneMQ.matches) { document.querySelector('.fbslot').append(fb); document.querySelector('.tempoSlot').append(tp); } else { document.querySelector('.side .keys').before(fb); document.querySelector('.chordbox').before(tp); } };
phoneMQ.addEventListener?.('change', placeFb);
function renderPhone(){ if (!PACK || !st.cols.length) return; const c = selCol();
  const sc = $('mScenes'); sc.innerHTML = ''; PACK.scenes.forEach((x, r) => sc.append(h('button', {class: 'mscene', onclick: () => scene(r)}, h('b', {}, String(r + 1)), x.name)));
  mCols.innerHTML = ''; st.cols.forEach((x, i) => { const b = h('button', {class: 'mchip', 'data-sel': i === st.sel ? '1' : '', 'data-on': x.clip ? '1' : '', 'data-mute': x.mute ? '1' : '', title: 'Tap to choose; hold to mute'},
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
  if (k === 'V') MOVES.vary(); if (k === 'M') MOVES.mutate(); if (k === 'B') MOVES.build(); if (k === 'D') MOVES.drop(); if (k === 'H') MOVES.harmony(); if (k === 'O') repeat(true); if (e.key === '[') octave(-1); if (e.key === ']') octave(1); if (k === 'F') nextFeel(); if (k === 'G') sendTog('echo'); if (k === 'K') sendTog('verb'); if (k === 'L') $('follow').click(); if (k === 'J' && !e.repeat) throwTo(true); });
document.addEventListener('keyup', e => { if (e.key.toUpperCase() === 'O') repeat(false); if (e.key.toUpperCase() === 'J') throwTo(false); });
addEventListener('resize', () => { drawPad(); drawNotes(); });

/* ---------- snapshots: the user's own saved combinations, recalled on the next bar ---------- */
let SNAPS = [], snapOn = null, snapDel = null;
const SNAP_FIELDS = ['feel', 'echo', 'verb', 'voicing', 'inv', 'arp', 'walk', 'follow'], SNAP_KEY = 'studio.jam.snaps', pitchedRole = r => !['kick', 'hats', 'perc'].includes(r);
const storeSnaps = () => { try { localStorage.setItem(SNAP_KEY, JSON.stringify(SNAPS)); } catch {} };
function capture(){ const n = SNAPS.reduce((m, x) => Math.max(m, +(/^Snap (\d+)$/.exec(x.name)?.[1] || 0)), 0) + 1;
  return {id: 's' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36), name: `Snap ${n}`, pack: PACK.id, bpm: st.bpm, smooth: st.smooth, echoDiv: st.echoDiv, harmony: (st.hNext || st.harmony).id, at: new Date().toISOString(),
    cols: st.cols.map(c => { const cl = c.next === 'stop' ? null : c.next ? c.next : c.clipId ? {id: c.clipId, clip: c.clip, var: c.var} : null;
      return {role: c.role, sound: c.sound, locked: !!c.locked, x: +c.x.toFixed(3), y: +c.y.toFixed(3), motion: c.motion, length: c.length, oct: c.oct || 0, mute: !!c.mute, ...Object.fromEntries(SNAP_FIELDS.map(k => [k, c[k]])), vars: (c.vars || []).map(v => v.steps), made: (c.vars || []).map(v => v.made || null), vi: c.vi || 0,
        clip: cl && {id: cl.id, var: cl.var || 0, len: cl.clip.len, steps: cl.clip.steps}}; })}; }
async function saveSnap(){ if (!PACK) return; const x = capture(); SNAPS.push(x); storeSnaps(); snapOn = x.id; renderSnaps(); flash('Saved ' + x.name);
  if (db) try { await db.collection('snaps').doc(x.id).set(x); } catch (err) { flash('Saved here only (' + (err.code || err.message) + ')'); } }
// sounds and settings change at once (so their notes are computed in time); clips and the harmony on the next bar
async function recall(x){ if (x.pack !== PACK.id) { if (!PACKS.some(p => p.id === x.pack)) { flash('That pack is gone'); return; } await loadPack(x.pack); }
  snapOn = x.id; st.bpm = x.bpm; if (x.smooth !== undefined) st.smooth = x.smooth; if (x.echoDiv !== undefined) st.echoDiv = x.echoDiv; $('bpmOut').textContent = st.bpm; tempo();
  x.cols.forEach((v, i) => { const c = st.cols[i]; if (!c || c.role !== v.role) return;
    if (SND[v.sound] && v.sound !== c.sound) { setSound(c, v.sound); logMacro(c, 'sound:' + v.sound, 1); } c.locked = v.locked;
    for (const k of ['x', 'y', 'motion', 'length', 'oct', ...SNAP_FIELDS]) if (v[k] !== undefined && c[k] !== v[k]) { c[k] = v[k]; logMacro(c, k, typeof v[k] === 'boolean' ? +v[k] : v[k]); }
    c.arpSt = null; if (v.vars) { c.vars = v.vars.map((steps, j) => ({steps, made: v.made?.[j] || undefined})); c.varsOf = v.clip?.id; c.vi = v.vi || 0; }
    if (c.mute !== v.mute) { c.mute = v.mute; logMacro(c, 'mute', c.mute ? 1 : 0); } lengthTo(c); macros(c);
    if (!v.clip) c.next = 'stop'; else { const base = CLIP[v.clip.id] || {id: v.clip.id, role: c.role, name: 'Saved clip', variations: []}; c.next = {id: v.clip.id, clip: {...base, len: v.clip.len, steps: v.clip.steps}, var: v.clip.var}; prewarm(c, c.next.clip); }
    c.nextRow = PACK.scenes.findIndex(sc => sc.clips[i] === v.clip?.id);
    if (!st.playing) { if (c.next === 'stop') { c.clip = null; c.clipId = null; } else { c.clip = c.next.clip; c.clipId = c.next.id; c.var = c.next.var; c.row = c.nextRow; } delete c.next; c.start = 0; }
    renderCol(c); });
  if (PACK.harmonies.some(H => H.id === x.harmony)) setHarmony(x.harmony);
  saveSounds(); renderSel(); renderSnaps(); flash((st.playing ? 'Next bar: ' : '') + x.name); }
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
      h('span', {class: 'snapbtns'}, h('button', {class: 'mini', title: 'Rename', onclick: () => renameSnap(x)}, '✎'), h('button', {class: 'mini', title: 'Delete', onclick: () => deleteSnap(x)}, '✕')))); }); }
async function loadSnaps(){ try { SNAPS = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch { SNAPS = []; } renderSnaps();
  if (!db) return; try { const q = await db.collection('snaps').get(), have = new Set(SNAPS.map(x => x.id));
    for (const d of q.docs) { const x = d.data(); if (x && !have.has(x.id)) SNAPS.push(x); }
    for (const x of SNAPS) if (!q.docs.some(d => d.id === x.id)) try { await db.collection('snaps').doc(x.id).set(x); } catch {}
    SNAPS.sort((a, b) => a.at < b.at ? -1 : 1); storeSnaps(); renderSnaps(); } catch {} }

/* ---------- feedback and keeping (the page's database) ---------- */
let db = null;
function rateBtns(kind, id, name){ const box = h('span', {class: 'rate'});
  for (const [r, lab] of [[1, '👍'], [-1, '👎']]) box.append(h('button', {class: 'mini', title: lab === '👍' ? 'I like this' : 'Not for me', onclick: async e => { e.stopPropagation(); if (!db) { flash('Sign in to claude.ai to rate'); return; }
    try { await db.collection('feedback').add({kind, id, name, rating: r, pack: PACK.id, at: new Date().toISOString()}); flash(`${lab} ${name}`); } catch (err) { flash('Not saved: ' + (err.code || err.message)); } }}, lab));
  return box; }
function rateNow(kind){ const c = selCol(); const id = kind === 'clip' ? c.clipId : kind === 'sound' ? c.sound : st.harmony.id, name = kind === 'clip' ? CLIP[c.clipId]?.name : kind === 'sound' ? SND[c.sound].name : st.harmony.name; return {id, name}; }
for (const kind of ['clip', 'sound', 'harmony']) for (const r of [1, -1]) { const b = $(`r-${kind}-${r > 0 ? 'up' : 'down'}`); if (b) b.onclick = async () => { const {id, name} = rateNow(kind); if (!id) return; if (!db) { flash('Sign in to claude.ai to rate'); return; }
  try { await db.collection('feedback').add({kind, id, name, rating: r, pack: PACK.id, note: $('fbNote').value.trim(), at: new Date().toISOString()}); flash(`${r > 0 ? '👍' : '👎'} ${name}`); $('fbNote').value = ''; } catch (err) { flash('Not saved: ' + (err.code || err.message)); } }; }
$('keepJam').onclick = async () => { if (!db || !lastTake) return; $('keepJam').disabled = true; $('takeNote').textContent = 'Keeping…';
  const used = [...new Set(lastTake.notes.map(n => n[2]).concat(lastTake.macros.filter(m => String(m[2]).startsWith('sound:')).map(m => m[2].slice(6))))];
  try { await db.collection('jams').add({name: $('jamName').value.trim() || `Jam at ${st.bpm} BPM`, note: $('jamNote').value.trim(), pack: PACK.id, bpm: lastTake.bpm, swing: lastTake.swing, echoDiv: lastTake.echoDiv, bars: lastTake.bars,
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
  st.cols = PACK.columns.map((c, i) => ({...c, ...(SND[chosen[i]] ? {sound: chosen[i], locked: true} : {}), x: X0(c.role), y: .3, motion: 0, length: 1, oct: 0, feel: 0, echo: true, verb: true, voicing: 0, inv: 0, arp: 0, walk: false, follow: 0, vars: [], vi: 0, level: .85, clip: null, clipId: null, start: 0, ...Object.fromEntries(['feel', 'echo', 'verb', 'voicing'].filter(k => c[k] !== undefined).map(k => [k, c[k]]))}));   // (a pack can start a column on its own feel and sends)
  if (ctx) { for (const c of st.cols) { makeChan(c); buildSound(c); } tempo(); }
  renderPacks(); renderGrid(); renderHarmony(); scene(1); renderSel(); renderSnaps(); busy(); }
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
  let tab = 'clips'; try { tab = localStorage.getItem('studio.jam.tab') || 'clips'; } catch {} setTab(tab); placeFb();
  loadSnaps();
  db = await window.claude?.use?.('db').catch(() => null) || null;
  loadSnaps();
})();
