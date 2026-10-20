// Studio Jam: a clip launcher for the ideas Claude makes. Columns are roles (kick, hats, percussion, bass, chords, two
// leads), each playing one clip at a time on one sound from the library; clips follow the harmony (model.js), so any
// clip on any sound over any progression. Everything changes on the next bar. No notes and no sliders: an XY pad (tone
// across, space up), two step buttons (motion, length), jam moves (vary, mutate, build, drop, repeat, next harmony), the
// keyboard. Record writes down what plays, for Claude to render; 👍 / 👎 on clips, sounds and harmonies.
import { notesAt, chordOf, mutate, ROLE_NAMES, nativeSet, cutOf, LEN, X0 } from './model.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { NATIVE } from '../lib/native/index.js';
import { makePoly, PRESETS } from '../../src/audio/engine/inst/poly.js';
import { makeDrums } from '../../src/audio/engine/inst/drums.js';

const $ = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v != null) e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };
let PACK = null, SND = {}, CLIP = {};
const st = {bpm: 124, swing: .06, harmony: null, hNext: null, hStart: 0, cols: [], sel: 0, playing: false, step: 0, rec: null, build: null, drop: null, rep: null};

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
  x.f.frequency.setTargetAtTime(cutOf(c.x), now, s); x.echo.gain.setTargetAtTime(c.y*.5, now, s); x.verb.gain.setTargetAtTime(c.y*.75, now, s);
  x.out.gain.setTargetAtTime(c.mute ? 0 : c.level, now, .01);
  const rate = [0, 1/(8*60/st.bpm), 1/(.5*60/st.bpm)][c.motion]; x.lfo.frequency.setTargetAtTime(rate || .1, now, s); x.lfoG.gain.setTargetAtTime([0, .45, .35][c.motion]*cutOf(c.x), now, s); }
function tempo(){ if (!ctx) return; delay.d.delayTime.setTargetAtTime(.75*60/st.bpm, ctx.currentTime, .05); for (const c of st.cols) macros(c); }

/* ---------- sounds: a column's sound built on its channel (poly synth, drum kits, native instruments) ---------- */
const env = {period: () => 60/st.bpm};
function buildSound(c){ if (!ctx) return; const s = SND[c.sound]; c.inst = {kind: 'pitched'};
  if (s.voices) { const kits = {}; c.inst = {kind: 'drums', voices: {}};
    for (const [v, m] of Object.entries(s.voices)) { if (m.native) { c.inst.voices[v] = {native: m.native, n: m.n, set: m.set || {}}; continue; }
      const key = m.kit + JSON.stringify(m.over || {}); if (!kits[key]) { kits[key] = makeDrums(ctx, c.ch.in); kits[key].load(m.kit, m.over || {}); } c.inst.voices[v] = {kit: kits[key]}; } return; }
  const src = s.src; if (src.palette && !NATIVE_OF[src.palette]) { const [p, set] = PAL[src.palette], syn = makePoly(ctx, c.ch.in, env); syn.load({...PRESETS[p], chord: 0, ...set}); c.inst.poly = syn; c.inst.base = set; }
  else { const name = src.native || NATIVE_OF[src.palette], oct = src.palette ? 12*(PAL[src.palette][1].oct || 0) : 0; c.inst.native = name; c.inst.shift = (src.shift || 0) + oct; }
  lengthTo(c); }
// length: a synth's decay and release stretch (a native sound's ring: nativeSet in model.js)
function lengthTo(c){ if (c.inst?.poly) { const b = c.inst.base; c.inst.poly.set('ad', (b.ad ?? .3)*LEN[c.length]); c.inst.poly.set('ar', (b.ar ?? .2)*LEN[c.length]); } }
const q = (v, s) => Math.round(v/s)*s;
const keyOf = (name, n, vel, o) => `${name}|${n}|${q(vel, .1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;
function nativeNote(c, name, n, vel, o, t, lenSec){ const set = NATIVE[name].held ? {...o, len: Math.round(lenSec*20)/20} : o, k = keyOf(name, n, vel, set), b = cache.get(k);
  if (!b) { want(k, name, n, vel, set); return; }
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = NATIVE[name].gain*(.4 + .6*vel); s.connect(g); g.connect(c.ch.in); s.start(t); s.onended = () => g.disconnect(); }
function want(k, name, n, vel, set){ if (cache.has(k) || pending.has(k) || !worker) return; pending.add(k); worker.postMessage({key: k, name, n, vel: q(vel, .1), o: set, sr: ctx.sampleRate}); busy(); }
// every native note a column will need with its clip over the whole harmony, computed ahead
function prewarm(c, clip = c.clip){ if (!ctx || !clip) return; const H = st.hNext || st.harmony, sd = 60/st.bpm/4;
  for (let bar = 0; bar < H.bars.length; bar++) for (let p = 0; p < clip.len; p++) for (const [n, len, vel] of notesAt(clip, p, chordOf(H, bar))) {
    if (c.inst.kind === 'drums') { const v = c.inst.voices[n]; if (v?.native) { const o = nativeSet(c, v.native, v.set); want(keyOf(v.native, v.n, vel, o), v.native, v.n, vel, o); } }
    else if (c.inst.native) { const nm = c.inst.native, o = nativeSet(c, nm), set = NATIVE[nm].held ? {...o, len: Math.round(len*sd*20)/20} : o; want(keyOf(nm, n + c.inst.shift, vel, set), nm, n + c.inst.shift, vel, set); } } }
function busy(){ const n = pending.size; $('busy').textContent = !ctx ? 'Press Play' : n ? `Computing ${n} sound${n > 1 ? 's' : ''}…` : st.playing ? 'Playing' : 'Ready'; $('busy').dataset.on = n ? '1' : ''; }

/* ---------- the clock: steps scheduled ahead; launches, harmony and moves land on the next bar ---------- */
const sd = () => 60/st.bpm/4;
function tick(){ while (nextT < ctx.currentTime + .12) { playStep(st.step, nextT + (st.step % 2 ? st.swing*sd() : 0)); st.step++; nextT += sd(); } }
function playStep(step, t){
  if (step % 16 === 0) barLine(step);
  const H = st.harmony, chord = chordOf(H, Math.floor((step - st.hStart)/16)), dropped = st.drop && step >= st.drop.at && step < st.drop.at + 16;
  for (const c of st.cols) { if (!c.clip || c.mute || dropped && c.role !== 'chords') continue;
    const eff = st.rep ? st.rep.at + ((step - st.rep.at) % st.rep.len) : step, pos = ((eff - c.start) % c.clip.len + c.clip.len) % c.clip.len;
    for (const [n, len, vel] of notesAt(c.clip, pos, chord)) { play(c, n, len, vel, t); if (st.rec && step >= st.rec.from) st.rec.notes.push([step - st.rec.from, c.id, c.sound, n, len, +vel.toFixed(2)]); } }
  const s = step; setTimeout(() => light(s), Math.max(0, (t - ctx.currentTime)*1000));
}
function play(c, n, len, vel, t){
  if (c.inst.kind === 'drums') { const v = c.inst.voices[n]; if (!v) return; if (v.kit) v.kit.play(n, t, vel, null); else nativeNote(c, v.native, v.n, vel, nativeSet(c, v.native, v.set), t, .5);
    if (c.role === 'kick') duck(t); return; }
  if (c.inst.poly) c.inst.poly.play(n, t, len*sd(), vel); else nativeNote(c, c.inst.native, n + c.inst.shift, vel, nativeSet(c, c.inst.native), t, len*sd()); }
function duck(t){ for (const c of st.cols) { if (c.role === 'kick' || !c.ch) continue; const g = c.ch.duck.gain; g.setTargetAtTime(c.role === 'chords' ? .35 : .6, t, .004); g.setTargetAtTime(1, t + .03, .1); } }
function barLine(step){
  if (st.hNext) { st.harmony = st.hNext; st.hNext = null; st.hStart = step; renderHarmony(); }
  for (const c of st.cols) { if (c.next !== undefined) { const nx = c.next; delete c.next; if (nx === 'stop') { c.clip = null; c.clipId = null; } else { c.clip = nx.clip; c.clipId = nx.id; c.var = nx.var || 0; c.start = step; c.row = c.nextRow; } renderCol(c); } }
  if (st.build) { const b = st.build; if (step >= b.at + b.bars*16) { hp.frequency.cancelScheduledValues(ctx.currentTime); hp.frequency.setTargetAtTime(18, ctx.currentTime, .02); st.build = null; $('m-build').dataset.on = ''; } }
  if (st.drop && step >= st.drop.at + 16) { st.drop = null; $('m-drop').dataset.on = ''; }
  const bar = Math.floor((step - st.hStart)/16); $('chordNow').textContent = st.harmony.bars[bar % st.harmony.bars.length].replace(':', ' '); $('barNow').textContent = `bar ${bar % st.harmony.bars.length + 1} of ${st.harmony.bars.length}`;
}
async function start(){ initAudio(); await ctx.resume(); if (st.playing) return; st.playing = true; st.step = 0; st.hStart = 0; nextT = ctx.currentTime + .1;
  for (const c of st.cols) if (c.next === undefined && c.clip) c.start = 0; timer = setInterval(tick, 25); tick(); $('play').textContent = 'Stop'; $('play').setAttribute('aria-pressed', 'true'); busy(); }
function stop(){ st.playing = false; clearInterval(timer); $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); light(-1); if (st.rec) record(); busy(); }

/* ---------- launching ---------- */
function launch(c, clipId, varIdx = 0, row){ const base = CLIP[clipId]; c.nextRow = row ?? PACK.scenes.findIndex(sc => sc.clips[st.cols.indexOf(c)] === clipId);
  if (!clipId) c.next = 'stop'; else { const steps = varIdx ? base.variations[varIdx - 1] : base.steps; c.next = {id: clipId, clip: {...base, steps}, var: varIdx};
    if (base.sound && !c.locked && SND[base.sound]?.role === SND[c.sound].role && c.sound !== base.sound) setSound(c, base.sound); prewarm(c, c.next.clip); }
  if (!st.playing) { if (c.next !== 'stop') { c.clip = c.next.clip; c.clipId = c.next.id; c.var = c.next.var; c.row = c.nextRow; } else { c.clip = null; c.clipId = null; } delete c.next; c.start = 0; }
  renderCol(c); }
function scene(i){ const sc = PACK.scenes[i]; if (!sc) return; st.cols.forEach((c, j) => launch(c, sc.clips[j] || null, 0, i)); flash('Scene: ' + sc.name); }
function setSound(c, id){ c.sound = id; if (ctx) { buildSound(c); prewarm(c); } renderCol(c); }
const selCol = () => st.cols[st.sel];

/* ---------- jam moves ---------- */
const MOVES = {
  vary(){ const c = selCol(); if (!c.clipId) return; const n = CLIP[c.clipId].variations.length + 1; launch(c, c.clipId, ((c.var || 0) + 1) % n); flash(`Variation ${((c.var || 0) + 1) % n || 'original'}`); },
  mutate(){ const c = selCol(); if (!c.clip) return; const m = mutate(c.clip); c.next = {id: c.clipId, clip: m, var: c.var}; if (!st.playing) { c.clip = m; delete c.next; } prewarm(c, m); flash('Mutated'); renderCol(c); },
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
function record(){ if (!st.rec) { if (!st.playing) start(); st.rec = {from: Math.ceil(st.step/16)*16, notes: [], macros: [], bpm: st.bpm, swing: st.swing, harmonies: []}; $('rec').setAttribute('aria-pressed', 'true'); flash('Recording from the next bar'); return; }
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
  if (i === st.sel) renderSel(); }
function renderSel(){ const c = selCol(); st.cols.forEach((x, i) => x.head && (x.head.dataset.sel = i === st.sel ? '1' : ''));
  $('selName').textContent = `${ROLE_NAMES[c.role]}: ${SND[c.sound].name}`; $('selClip').textContent = c.clipId ? CLIP[c.clipId].name + (c.var ? ` (variation ${c.var})` : '') : 'not playing';
  $('motion').textContent = 'Motion: ' + ['still', 'slow', 'fast'][c.motion]; $('length').textContent = 'Length: ' + ['short', 'normal', 'long'][c.length];
  drawPad(); }
function renderHarmony(){ const box = $('harmonies'); box.innerHTML = '';
  for (const H of PACK.harmonies) box.append(h('button', {class: 'hchip', 'data-on': H === st.harmony ? '1' : '', 'data-next': H === st.hNext ? '1' : '', title: H.words, onclick: () => setHarmony(H.id)}, H.name));
  $('hWords').textContent = (st.hNext || st.harmony).words; }
let lightCells = []; function light(s){ for (const b of lightCells) b.style.removeProperty('--p'); lightCells = [];
  if (s < 0) return; for (const c of st.cols) { if (!c.clip) continue; const b = document.querySelector(`.cell[data-col="${c.id}"][data-on="1"]`); if (b) { b.style.setProperty('--p', (((s - c.start) % c.clip.len + c.clip.len) % c.clip.len + 1)/c.clip.len); lightCells.push(b); } } }
let flashT = 0; function flash(t){ $('flash').textContent = t; clearTimeout(flashT); flashT = setTimeout(() => $('flash').textContent = '', 1800); }

// the sound picker: the library's sounds for this column's role
function openSounds(c){ const box = $('sounds'); box.innerHTML = ''; box.hidden = false;
  box.append(h('div', {class: 'sndhead'}, h('b', {}, `Sounds for ${ROLE_NAMES[c.role]}`), h('button', {class: 'ghost', onclick: () => box.hidden = true}, 'Close')));
  for (const s of PACK.sounds.filter(s => s.role === c.role)) box.append(h('button', {class: 'snd', 'data-on': s.id === c.sound ? '1' : '', onclick: () => { c.locked = true; setSound(c, s.id); logMacro(c, 'sound:' + s.id, 1); openSounds(c); flash('Sound: ' + s.name); }},
    h('b', {}, s.name), h('span', {class: 'muted'}, s.words || ''), rateBtns('sound', s.id, s.name))); }

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
  if (/^[1-8]$/.test(e.key)) { scene(+e.key - 1); return; }
  const ci = 'QWERTYU'.indexOf(k); if (ci >= 0 && ci < st.cols.length && !e.repeat) { if (e.shiftKey) { const c = st.cols[ci]; c.mute = !c.mute; macros(c); renderCol(c); } else { st.sel = ci; renderSel(); } return; }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const c = selCol(), ids = PACK.scenes.map(s => s.clips[st.sel]).filter(Boolean), uniq = [...new Set(ids)], i = uniq.indexOf(c.next?.id || c.clipId); launch(c, uniq[(i + (e.key === 'ArrowDown' ? 1 : -1) + uniq.length) % uniq.length]); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const c = selCol(); c.x = Math.max(0, Math.min(1, c.x + (e.key === 'ArrowRight' ? .08 : -.08))); macros(c); drawPad(); return; }
  if (k === 'V') MOVES.vary(); if (k === 'M') MOVES.mutate(); if (k === 'B') MOVES.build(); if (k === 'D') MOVES.drop(); if (k === 'H') MOVES.harmony(); if (k === 'O') repeat(true); });
document.addEventListener('keyup', e => { if (e.key.toUpperCase() === 'O') repeat(false); });
addEventListener('resize', drawPad);

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
  try { await db.collection('jams').add({name: $('jamName').value.trim() || `Jam at ${st.bpm} BPM`, note: $('jamNote').value.trim(), pack: PACK.id, bpm: lastTake.bpm, swing: lastTake.swing, bars: lastTake.bars,
      columns: st.cols.map(c => ({id: c.id, role: c.role})), sounds: used.map(id => SND[id]).filter(Boolean), notes: lastTake.notes, macros: lastTake.macros, at: new Date().toISOString()});
    $('takeNote').textContent = 'Kept. Claude will render it at full quality into the listening room.'; lastTake = null; }
  catch (err) { $('takeNote').textContent = 'Not kept (' + (err.code || err.message) + '). Try again.'; $('keepJam').disabled = false; } };

// the packs: each round of ideas Claude makes; switching stops the music and lays out the new pack's grid
let PACKS = [];
async function loadPack(id){ if (st.playing) stop();
  for (const c of st.cols) { try { c.ch?.out.disconnect(); c.ch?.lfo.stop(); } catch {} }
  PACK = await (await fetch(`packs/${id}.json`)).json(); try { localStorage.setItem('studio.jam.pack', id); } catch {}
  SND = Object.fromEntries(PACK.sounds.map(s => [s.id, s])); CLIP = Object.fromEntries(PACK.clips.map(c => [c.id, c]));
  st.bpm = PACK.bpm; st.swing = PACK.swing; $('bpmOut').textContent = st.bpm; st.harmony = PACK.harmonies[0]; st.hNext = null; st.sel = 0;
  st.cols = PACK.columns.map(c => ({...c, x: X0(c.role), y: .3, motion: 0, length: 1, level: .85, clip: null, clipId: null, start: 0}));
  if (ctx) { for (const c of st.cols) { makeChan(c); buildSound(c); } tempo(); }
  renderPacks(); renderGrid(); renderHarmony(); scene(1); renderSel(); busy(); }
function renderPacks(){ const box = $('packs'); box.innerHTML = ''; box.append(h('span', {class: 'lab'}, 'Pack'));
  for (const p of PACKS) box.append(h('button', {class: 'pchip', 'data-on': p.id === PACK?.id ? '1' : '', title: p.words || '', onclick: () => p.id !== PACK.id && loadPack(p.id)}, p.name));
  if (PACK?.words) box.append(h('span', {class: 'muted'}, PACK.words)); }
(async () => {
  try { PACKS = (await (await fetch('packs/index.json')).json()).packs; } catch { PACKS = [{id: 'pack-1', name: 'Pack 1'}]; }
  let want = null; try { want = localStorage.getItem('studio.jam.pack'); } catch {}
  await loadPack(PACKS.some(p => p.id === want) ? want : PACKS.at(-1).id);
  db = await window.claude?.use?.('db').catch(() => null) || null;
})();
