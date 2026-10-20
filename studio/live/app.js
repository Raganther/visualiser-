// Studio Live: a step sequencer that plays the native instruments live in the page. Each track has its own length (so
// tracks go round against each other: polyrhythms), its instrument, the instrument's physics (hardness, strike point,
// ring, FM bend, bloom…), and a channel (level, filter, resonance, an LFO on the filter, pan, echo and reverb sends). Notes
// are computed by a worker from the same engine the offline renders use, cached, and recomputed as knobs move; Save keeps
// the pattern in the page's database for Claude to build a track from.
import { NATIVE } from '../lib/native/index.js';

/* ---------- the instruments the page offers, and the physics each one's knobs move ---------- */
const MODAL_K = [['hard', 'Hardness', .1, 1, .01], ['pos', 'Strike point', .05, .5, .01], ['ring', 'Ring', .3, 3, .05]];
const INST = {
  kick: {label: 'Kick (struck skin)', knobs: [['drop', 'Pitch drop', .3, 3, .05], ['decay', 'Decay', .2, 1.2, .02], ['body', 'Body', 0, 1, .02], ['hard', 'Beater', .1, 1, .02]]},
  hat: {label: 'Hats (noise and metal)', knobs: [['decay', 'Decay', .02, .3, .005], ['tone', 'Tone', 0, 1, .02]]},
  tom: {label: 'Toms (struck skins)', knobs: [['decay', 'Decay', .2, 1.2, .02], ['drop', 'Pitch drop', 0, .6, .01], ['hard', 'Hardness', .1, 1, .02], ['pos', 'Strike point', .1, .5, .01]]},
  hand: {label: 'Hand drum', knobs: [['decay', 'Decay', .1, .8, .02], ['drop', 'Pitch drop', 0, .4, .01], ['hard', 'Hardness', .1, 1, .02]]},
  marimba: {label: 'Marimba', knobs: MODAL_K}, kalimba: {label: 'Kalimba', knobs: MODAL_K}, steel: {label: 'Steel drum', knobs: MODAL_K},
  musicbox: {label: 'Music box', knobs: MODAL_K}, vibes: {label: 'Vibraphone', knobs: [...MODAL_K, ['trem', 'Tremolo', 0, .9, .02]]},
  wood: {label: 'Woodblock', knobs: MODAL_K}, tubular: {label: 'Tubular bell', knobs: MODAL_K}, bell: {label: 'Church bell', knobs: MODAL_K},
  plate: {label: 'Metal plate', knobs: MODAL_K}, glass: {label: 'Glass bar', knobs: MODAL_K},
  fmglass: {label: 'FM glass bass', held: 1, knobs: [['index', 'Bend', .2, 6, .05], ['ratio', 'Ratio', .5, 7, .05], ['dec', 'Decay', .05, .8, .01], ['sus', 'Sustain', 0, 1, .02]]},
  fmround: {label: 'FM round bass', held: 1, knobs: [['index', 'Bend', .2, 4, .05], ['ratio', 'Ratio', .5, 4, .05], ['dec', 'Decay', .05, .8, .01], ['sus', 'Sustain', 0, 1, .02]]},
  fmpluck: {label: 'FM pluck bass', held: 1, knobs: [['index', 'Bend', .2, 6, .05], ['ratio', 'Ratio', .5, 7, .05], ['dec', 'Decay', .03, .5, .01], ['fb', 'Feedback', 0, 1, .02]]},
  pluck: {label: 'Plucked string', knobs: [['bright', 'Brightness', .05, 1, .02], ['damp', 'Sustain', .98, .999, .0005], ['body', 'Body', 0, 1, .02]]},
  fmbell: {label: 'FM bell', held: 1, knobs: [['index', 'Bend', .2, 5, .05], ['ratio', 'Ratio', .5, 7, .05], ['r', 'Release', .1, 2.5, .05]]},
  addpad: {label: 'Bloom pad (additive)', held: 1, knobs: [['bloom', 'Bloom', 0, 10, .1], ['wob', 'Sway', 0, .8, .02], ['tilt', 'Darkness', .6, 2.4, .02], ['a', 'Attack', .05, 3, .05]]},
  breath: {label: 'Breath pad', held: 1, knobs: [['q', 'Focus', 15, 160, 1], ['air', 'Air', 0, .3, .01], ['a', 'Attack', .05, 3, .05]]},
  grainpad: {label: 'Grain pad', held: 1, knobs: [['density', 'Density', 4, 60, 1], ['a', 'Attack', .05, 3, .05]]},
};
// the note rows of each kind of track (top row highest): over A, the notes that sit inside every suspended chord
const ROWS = {kick: [33], hat: [60], tom: [55, 50, 45, 43], bells: [79, 76, 74, 71, 69, 67, 64, 62, 59, 57], bass: [57, 55, 52, 50, 48, 45, 43, 40, 38, 36, 33]};
const NAMES = 'C C# D D# E F F# G G# A A# B'.split(' '), nm = n => NAMES[n % 12] + (Math.floor(n/12) - 1);
const CHORDS = [['Asus4 add9', [64, 69, 71, 74]], ['Fsus2 / A', [65, 67, 72, 76]], ['Gsus2 / A', [62, 67, 69, 74]], ['A6sus2', [64, 66, 69, 71]], ['Am9', [60, 64, 67, 71]], ['Dsus2 / A', [62, 64, 69, 74]], ['Em7 / A', [62, 64, 67, 71]], ['Cmaj7#11', [60, 64, 66, 71]], ['—', []]];
const DIVS = [['2 bars', 8], ['1 bar', 4], ['1/2', 2], ['1/4', 1], ['1/8', .5]];

/* ---------- the pattern: what plays (defaults: a groove after Copper Wire and Tidal Clock) ---------- */
const st = (str, n = 0) => [...str].map(c => c === '.' ? null : {n, v: c === 'X' ? 2 : 1});
const mel = (len, pairs) => { const a = Array(16).fill(null); for (const [i, n, v = 1] of pairs) a[i] = {n, v}; return {len, steps: a}; };
const CH = (o = {}) => ({level: .8, cut: 9000, res: 1, lfoDiv: 2, lfoAmt: 0, pan: 0, echo: 0, verb: .15, ...o});
const DEFAULT = {bpm: 124, swing: .06, pump: .45, tracks: [
  {id: 'kick', name: 'Kick', kind: 'kick', inst: 'kick', len: 16, steps: st('X...x...x...x...', 33), set: {}, ch: CH({level: .95, cut: 12000, verb: 0})},
  {id: 'hats', name: 'Hats', kind: 'hat', inst: 'hat', len: 16, steps: st('..x...x...x...xo', 60), set: {}, ch: CH({level: .45, verb: .1})},
  {id: 'toms', name: 'Toms', kind: 'tom', inst: 'tom', ...mel(6, [[0, 50, 1], [3, 43, 2]]), set: {}, ch: CH({level: .6, verb: .2})},
  {id: 'bells', name: 'Bells', kind: 'bells', inst: 'steel', ...mel(12, [[0, 69, 2], [3, 74], [6, 71], [9, 64]]), set: {}, ch: CH({level: .55, cut: 3200, res: 3, lfoDiv: 1, lfoAmt: .5, echo: .3, verb: .3})},
  {id: 'bass', name: 'Bass', kind: 'bass', inst: 'fmglass', ...mel(16, [[0, 33, 2], [2, 45], [3, 40], [4, 43], [6, 45], [7, 38], [8, 33, 2], [10, 45], [11, 43], [12, 40], [14, 45], [15, 38]]), set: {}, ch: CH({level: .7, cut: 2200, res: 2, lfoDiv: 0, lfoAmt: .3, echo: .08, verb: .05})},
  {id: 'pad', name: 'Pad', kind: 'pad', inst: 'addpad', len: 4, chords: [0, 1, 2, 3], set: {}, ch: CH({level: .45, cut: 4000, res: 1, lfoDiv: 0, lfoAmt: .4, verb: .45})},
]};
for (const t of DEFAULT.tracks) for (const [k, , lo, hi] of INST[t.inst].knobs) if (t.set[k] == null) t.set[k] = defaultOf(t.inst, k, lo, hi);
function defaultOf(inst, k, lo, hi){ const D = {hard: .5, pos: .27, ring: 1, drop: inst === 'kick' ? 1.6 : .25, decay: inst === 'kick' ? .45 : inst === 'hat' ? .06 : .55, body: inst === 'pluck' ? .55 : .5, tone: .6, trem: .45,
  index: 2, ratio: inst === 'fmglass' ? 3.5 : inst === 'fmpluck' ? 2 : inst === 'fmbell' ? 1.4 : 1, dec: .25, sus: .2, fb: .3, bright: .45, damp: .993, r: .8, bloom: 3, wob: .35, tilt: 1.3, a: inst === 'addpad' ? 1.2 : .8, q: 70, air: .04, density: 26};
  return D[k] ?? (lo + hi)/2; }
let P = load() || structuredClone(DEFAULT);

/* ---------- audio ---------- */
let ctx = null, master, delay, verb, worker, playing = false, step = 0, nextT = 0, timer = null;
const chans = {}, cache = new Map(), asked = new Set();
const SR = () => ctx?.sampleRate || 48000;
function initAudio(){
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'});
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .12;
  master = ctx.createGain(); master.gain.value = .9; master.connect(lim); lim.connect(ctx.destination);
  // the echo: a dotted 8th, darkening as it repeats
  delay = {in: ctx.createGain(), d: ctx.createDelay(2), fb: ctx.createGain(), lp: ctx.createBiquadFilter()};
  delay.lp.frequency.value = 2400; delay.fb.gain.value = .45; delay.in.connect(delay.d); delay.d.connect(delay.lp); delay.lp.connect(delay.fb); delay.fb.connect(delay.d); delay.lp.connect(master);
  // the reverb: a made impulse, stereo noise dying away, its highs first
  verb = ctx.createConvolver(); const L = 2.8*ctx.sampleRate, ir = ctx.createBuffer(2, L, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); let lp = 0; for (let i = 0; i < L; i++) { lp += (.3 - .25*i/L)*((Math.random()*2 - 1) - lp); x[i] = lp*Math.pow(1 - i/L, 2.2); } }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .8; verb.connect(vg); vg.connect(master);
  for (const t of P.tracks) makeChan(t);
  worker = new Worker(URL.createObjectURL(new Blob([document.getElementById('worker-src').textContent], {type: 'text/javascript'})));
  worker.onmessage = e => { const {key, L, R, error} = e.data; asked.delete(key); if (error) { console.error(error); return; }
    const b = ctx.createBuffer(2, L.length, ctx.sampleRate); b.copyToChannel(L, 0); b.copyToChannel(R, 1); cache.set(key, b); busy(); };
  applyTempo(); prewarm();
}
function makeChan(t){
  const c = {in: ctx.createGain(), f: ctx.createBiquadFilter(), pan: ctx.createStereoPanner(), duck: ctx.createGain(), out: ctx.createGain(), echo: ctx.createGain(), verb: ctx.createGain(), lfo: ctx.createOscillator(), lfoG: ctx.createGain()};
  c.in.connect(c.f); c.f.connect(c.pan); c.pan.connect(c.duck); c.duck.connect(c.out); c.out.connect(master); c.out.connect(c.echo); c.out.connect(c.verb); c.echo.connect(delay.in); c.verb.connect(verb);
  c.lfo.connect(c.lfoG); c.lfoG.connect(c.f.frequency); c.lfo.start(); chans[t.id] = c; applyChan(t);
}
function applyChan(t){ const c = chans[t.id]; if (!c) return; const now = ctx.currentTime, ch = t.ch, s = .04;
  c.out.gain.setTargetAtTime(ch.level*ch.level, now, s); c.f.frequency.setTargetAtTime(ch.cut, now, s); c.f.Q.setTargetAtTime(ch.res, now, s); c.pan.pan.setTargetAtTime(ch.pan, now, s);
  c.echo.gain.setTargetAtTime(ch.echo, now, s); c.verb.gain.setTargetAtTime(ch.verb, now, s);
  c.lfo.frequency.setTargetAtTime(1/(DIVS[ch.lfoDiv][1]*60/P.bpm), now, s); c.lfoG.gain.setTargetAtTime(ch.lfoAmt*ch.cut*.7, now, s); }
function applyTempo(){ if (!ctx) return; delay.d.delayTime.setTargetAtTime(.75*60/P.bpm, ctx.currentTime, .05); for (const t of P.tracks) applyChan(t); }

// a note's key: its instrument, pitch, accent and physics (rounded, so a slider's small moves reuse what's computed)
const q = (v, lo, hi) => { const s = (hi - lo)/40; return +(Math.round((v - lo)/s)*s + lo).toFixed(4); };
function noteOf(t, n, v, lenSec){ const I = INST[t.inst], o = {}; for (const [k, , lo, hi] of I.knobs) o[k] = q(t.set[k], lo, hi);
  if (I.held) o.len = Math.round(lenSec*20)/20; const vel = v === 2 ? 1 : .72;
  return {key: `${t.inst}|${n}|${vel}|${JSON.stringify(o)}`, name: t.inst, n, vel, o}; }
const stepDur = () => 60/P.bpm/4;
function notesOfTrack(t){ const out = [];
  if (t.kind === 'pad') t.chords.forEach(ci => { for (const n of CHORDS[ci][1]) out.push(noteOf(t, n, 1, 16*stepDur())); });
  else for (let i = 0; i < t.len; i++) { const c = t.steps[i]; if (c) out.push(noteOf(t, c.n, c.v, (t.kind === 'bass' ? 1.6 : 2)*stepDur())); }
  return out; }
function want(nt){ if (cache.has(nt.key) || asked.has(nt.key) || !worker) return; asked.add(nt.key); worker.postMessage({...nt, sr: SR()}); busy(); }
let warmT = 0; function prewarm(){ clearTimeout(warmT); warmT = setTimeout(() => { for (const t of P.tracks) for (const nt of notesOfTrack(t)) want(nt); }, 90); }
function play(t, nt, at){ const b = cache.get(nt.key); if (!b) { want(nt); return; }
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = NATIVE[nt.name].gain*(.4 + .6*nt.vel); s.connect(g); g.connect(chans[t.id].in); s.start(at); s.onended = () => g.disconnect(); }
function duck(at){ for (const t of P.tracks) { if (t.kind === 'kick') continue; const g = chans[t.id].duck.gain; g.setTargetAtTime(1 - P.pump*(t.kind === 'pad' ? 1 : .6), at, .004); g.setTargetAtTime(1, at + .03, .1); } }

/* ---------- the clock: steps scheduled a little ahead of the audio clock ---------- */
function tick(){ while (nextT < ctx.currentTime + .14) { const at = nextT + (step % 2 ? P.swing*stepDur() : 0);
  for (const t of P.tracks) {
    if (t.mute) continue;
    if (t.kind === 'pad') { if (step % 16 === 0) { const ci = t.chords[Math.floor(step/16) % t.len]; for (const n of CHORDS[ci][1]) play(t, noteOf(t, n, 1, 16*stepDur()), at); } continue; }
    const c = t.steps[step % t.len]; if (!c) continue;
    play(t, noteOf(t, c.n, c.v, (t.kind === 'bass' ? 1.6 : 2)*stepDur()), at); if (t.kind === 'kick') duck(at); }
  const s = step; setTimeout(() => lightStep(s), Math.max(0, (at - ctx.currentTime)*1000));
  step++; nextT += stepDur(); } }
async function start(){ if (!ctx) initAudio(); await ctx.resume(); if (playing) return; playing = true; step = 0; nextT = ctx.currentTime + .08; timer = setInterval(tick, 25); tick(); $('play').textContent = 'Stop'; $('play').setAttribute('aria-pressed', 'true'); }
function stop(){ playing = false; clearInterval(timer); $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); lightStep(-1); }

/* ---------- the page ---------- */
const $ = id => document.getElementById(id), h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };
function busy(){ const n = asked.size; $('busy').textContent = !worker ? 'Sounds are computed when you press Play' : n ? `Computing ${n} note${n > 1 ? 's' : ''}…` : 'All notes ready'; $('busy').dataset.on = n ? '1' : ''; }
let saveT = 0; function changed(t, what){ if (t && what === 'ch') applyChan(t); prewarm(); clearTimeout(saveT); saveT = setTimeout(save, 400); }
function save(){ try { localStorage.setItem('studio.live', JSON.stringify(P)); } catch {} }
function load(){ try { const s = JSON.parse(localStorage.getItem('studio.live')); return s?.tracks?.length ? s : null; } catch { return null; } }

function slider(label, val, lo, hi, stepv, fmt, onInput, id){
  const out = h('output', {}, fmt(val)), r = h('input', {type: 'range', min: lo, max: hi, step: stepv, value: val, id, 'aria-label': label});
  r.oninput = () => { out.textContent = fmt(+r.value); onInput(+r.value); };
  return h('label', {class: 'knob'}, h('span', {}, label), r, out);
}
const f2 = v => (+v).toFixed(2), hz = v => v >= 1000 ? (v/1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz', pct = v => Math.round(v*100) + '%';
function renderTrack(t){
  const el = h('section', {class: 'track', id: 'tr-' + t.id, 'data-kind': t.kind});
  // the head: name, instrument, length, mute
  const sel = h('select', {id: 'inst-' + t.id, 'aria-label': t.name + ' instrument'});
  const fit = {kick: ['kick'], hat: ['hat'], tom: ['tom', 'hand', 'wood'], bells: ['steel', 'marimba', 'kalimba', 'musicbox', 'vibes', 'wood', 'tubular', 'bell', 'plate', 'glass', 'fmbell'], bass: ['fmglass', 'fmround', 'fmpluck', 'pluck', 'glass', 'marimba'], pad: ['addpad', 'breath', 'grainpad']}[t.kind];
  for (const k of fit) sel.append(h('option', {value: k}, INST[k].label)); sel.value = t.inst;
  sel.onchange = () => { t.inst = sel.value; for (const [k, , lo, hi] of INST[t.inst].knobs) if (t.set[k] == null) t.set[k] = defaultOf(t.inst, k, lo, hi); el.replaceWith(renderTrack(t)); changed(t); };
  const lenOut = h('output', {class: 'len'}, String(t.len));
  const lenBtn = d => h('button', {class: 'mini', 'aria-label': (d > 0 ? 'Longer' : 'Shorter') + ' loop', onclick: () => { t.len = Math.max(1, Math.min(t.kind === 'pad' ? 4 : 16, t.len + d)); lenOut.textContent = t.len; el.replaceWith(renderTrack(t)); changed(t); }}, d > 0 ? '+' : '−');
  const mute = h('button', {class: 'mini mute', 'aria-pressed': String(!!t.mute), onclick: () => { t.mute = !t.mute; mute.setAttribute('aria-pressed', String(t.mute)); changed(); }}, 'Mute');
  el.append(h('div', {class: 'head'}, h('h2', {}, t.name), sel, h('span', {class: 'lenbox'}, h('span', {class: 'lab'}, t.kind === 'pad' ? 'Bars' : 'Steps'), lenBtn(-1), lenOut, lenBtn(1)), mute));
  // the grid
  const grid = h('div', {class: 'grid'});
  if (t.kind === 'pad') {
    for (let b = 0; b < 4; b++) { const on = b < t.len, c = h('button', {class: 'chord', 'data-off': on ? '' : '1', 'data-bar': b, 'aria-label': `Bar ${b + 1} chord`}, CHORDS[t.chords[b]][0]);
      c.onclick = () => { if (!on) return; t.chords[b] = (t.chords[b] + 1) % CHORDS.length; c.textContent = CHORDS[t.chords[b]][0]; changed(t); }; grid.append(c); }
    grid.classList.add('chords');
  } else {
    const rows = ROWS[t.kind === 'tom' && t.inst === 'wood' ? 'bells' : t.kind === 'tom' ? 'tom' : t.kind];
    grid.style.setProperty('--rows', rows.length);
    rows.forEach((n, r) => { if (rows.length > 1) grid.append(h('span', {class: 'note'}, nm(n)));
      for (let i = 0; i < 16; i++) { const c = t.steps[i], cell = h('button', {class: 'cell', 'data-i': i, 'aria-label': `${t.name} step ${i + 1}${rows.length > 1 ? ' ' + nm(n) : ''}`});
        const paint = () => { const s = t.steps[i]; cell.dataset.v = s && s.n === n ? s.v : 0; cell.dataset.off = i >= t.len ? '1' : ''; cell.dataset.beat = i % 4 === 0 ? '1' : ''; };
        cell.onclick = () => { const s = t.steps[i]; t.steps[i] = s && s.n === n ? (s.v === 1 ? {n, v: 2} : null) : {n, v: 1}; grid.querySelectorAll(`.cell[data-i="${i}"]`).forEach(x => x._paint()); changed(t); };
        cell._paint = paint; paint(); grid.append(cell); } });
    if (rows.length > 1) grid.classList.add('roll');
  }
  el.append(grid);
  // the sound: the instrument's physics, then the channel
  const phys = h('div', {class: 'knobs'}), chan = h('div', {class: 'knobs'});
  for (const [k, label, lo, hi, sv] of INST[t.inst].knobs) phys.append(slider(label, t.set[k], lo, hi, sv, f2, v => { t.set[k] = v; changed(t); }, `k-${t.id}-${k}`));
  const C = t.ch, cs = (k, label, lo, hi, sv, fmt) => slider(label, C[k], lo, hi, sv, fmt, v => { C[k] = v; changed(t, 'ch'); }, `c-${t.id}-${k}`);
  chan.append(cs('level', 'Level', 0, 1, .01, pct), cs('cut', 'Filter', 200, 14000, 10, hz), cs('res', 'Resonance', .5, 12, .1, f2), cs('lfoAmt', 'LFO depth', 0, 1, .01, pct));
  const div = h('select', {id: `c-${t.id}-lfoDiv`, 'aria-label': 'LFO speed'}); DIVS.forEach(([l], i) => div.append(h('option', {value: i}, l))); div.value = C.lfoDiv; div.onchange = () => { C.lfoDiv = +div.value; changed(t, 'ch'); };
  chan.append(h('label', {class: 'knob'}, h('span', {}, 'LFO speed'), div, h('output', {}, '')), cs('pan', 'Pan', -1, 1, .02, v => v ? (v < 0 ? 'L ' : 'R ') + Math.round(Math.abs(v)*100) : 'C'), cs('echo', 'Echo', 0, 1, .01, pct), cs('verb', 'Reverb', 0, 1, .01, pct));
  el.append(h('details', {class: 'sound'}, h('summary', {}, 'Sound'), h('div', {class: 'cols'}, h('div', {}, h('h3', {}, 'The instrument'), phys), h('div', {}, h('h3', {}, 'The channel'), chan))));
  return el;
}
function lightStep(s){ document.querySelectorAll('.cell[data-now="1"], .chord[data-now="1"]').forEach(c => c.dataset.now = '');
  if (s < 0) return; for (const t of P.tracks) { if (t.kind === 'pad') { const b = document.querySelector(`#tr-${t.id} .chord[data-bar="${Math.floor(s/16) % t.len}"]`); if (b) b.dataset.now = '1'; continue; }
    document.querySelectorAll(`#tr-${t.id} .cell[data-i="${s % t.len}"]`).forEach(c => c.dataset.now = '1'); } }
function renderAll(){ const box = $('tracks'); box.innerHTML = ''; for (const t of P.tracks) box.append(renderTrack(t));
  $('bpm').value = P.bpm; $('bpmOut').textContent = P.bpm; $('swing').value = P.swing; $('swingOut').textContent = pct(P.swing); $('pump').value = P.pump; $('pumpOut').textContent = pct(P.pump); }

$('play').onclick = () => playing ? stop() : start();
$('bpm').oninput = e => { P.bpm = +e.target.value; $('bpmOut').textContent = P.bpm; applyTempo(); changed(); };
$('swing').oninput = e => { P.swing = +e.target.value; $('swingOut').textContent = pct(P.swing); changed(); };
$('pump').oninput = e => { P.pump = +e.target.value; $('pumpOut').textContent = pct(P.pump); changed(); };
$('reset').onclick = () => { if ($('reset').dataset.sure) { P = structuredClone(DEFAULT); for (const t of P.tracks) if (ctx && !chans[t.id]) makeChan(t); renderAll(); applyTempo(); changed(); $('reset').dataset.sure = ''; $('reset').textContent = 'Start again'; }
  else { $('reset').dataset.sure = '1'; $('reset').textContent = 'Tap again to reset'; setTimeout(() => { $('reset').dataset.sure = ''; $('reset').textContent = 'Start again'; }, 2500); } };
document.addEventListener('keydown', e => { if (e.key === ' ' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); playing ? stop() : start(); } });

/* ---------- saving for Claude (the page's database) ---------- */
let db = null;
async function initDb(){ db = await window.claude?.use?.('db').catch(() => null) || null;
  if (!db) { $('saveNote').textContent = 'Saving for Claude needs the page open signed in to claude.ai. Your pattern is still kept in this browser.'; $('keep').disabled = true; return; }
  db.collection('patterns').orderBy('at', 'desc').limit(30).onSnapshot(qs => { const list = $('kept'); list.innerHTML = '';
    if (qs.empty) { list.append(h('li', {class: 'muted'}, 'Nothing kept yet. Keep a pattern you like and Claude will build a track from it.')); return; }
    for (const d of qs.docs) { const p = d.data(); list.append(h('li', {}, h('button', {class: 'recall', onclick: () => { P = structuredClone(p.pattern); for (const t of P.tracks) if (ctx && !chans[t.id]) makeChan(t); renderAll(); applyTempo(); changed(); $('status').textContent = `Loaded “${p.name}”.`; }}, p.name || 'Untitled'), h('span', {class: 'muted'}, (p.note ? p.note + ' · ' : '') + new Date(p.at).toLocaleString()))); } }, () => {}); }
$('keep').onclick = async () => { if (!db) return; const name = $('name').value.trim() || `Pattern at ${P.bpm} BPM`;
  $('keep').disabled = true; $('status').textContent = 'Keeping…';
  try { await db.collection('patterns').add({name, note: $('note').value.trim(), pattern: P, at: new Date().toISOString()}); $('status').textContent = `Kept “${name}”. Claude can read it now.`; $('name').value = ''; $('note').value = ''; }
  catch (e) { $('status').textContent = 'That wasn\'t kept (' + (e.code || e.message) + '). Try again.'; }
  $('keep').disabled = false; };

renderAll(); busy(); initDb();
