// The drum playground: the analog drum machine (studio/lib/native/analogkit.js) played live in the audio engine's thread
// (the DAW's own worklet, voices.worklet.js), on beats written to test it (beats.js). Pick a kit and a beat, play, edit
// the steps, mute rows, turn a voice's knobs as it plays; A/B plays the same beat on the copy of the browser's kit it
// stands beside (held, or swapping every two bars); notes are kept here and copied out for Claude.
import { BEATS, ROWS, VEL } from './beats.js';
import { ANALOG_KITS, ANALOG_NAMES, APARAMS, analogParams, kitFallback } from '../lib/native/analogkit.js';

const $ = id => document.getElementById(id), h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n.startsWith('on')) e[n] = v; else if (n.startsWith('aria-') && typeof v === 'boolean') e.setAttribute(n, v); else if (v != null && v !== false) e.setAttribute(n, v === true ? '' : v); } e.append(...k.flat().filter(x => x != null)); return e; };
const load = (k, d) => { try { const v = localStorage.getItem('drumlab.' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, keep = (k, v) => { try { localStorage.setItem('drumlab.' + k, JSON.stringify(v)); } catch {} };
const S = {kit: load('kit', 'Analog 808'), beat: load('beat', 'four'), bpm: null, swing: null, playing: false, ab: 'a', abSwap: false, mute: {}, voice: 'kick', over: load('over', {}), edits: load('edits', {}), notes: load('notes', ''), step: -1};
let ctx = null, node = null, an = null, timer = 0, next = 0, slot = 0;
const beat = () => BEATS.find(b => b.id === S.beat) || BEATS[0];
const rowsOf = b => ({...b.rows, ...(S.edits[b.id] || {})});
const sd = () => 60/S.bpm/4;

/* ---------- the sound: one node, the analog kit (a) and the browser copy (b) side by side ---------- */
async function start(){ if (ctx) { await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'});
  const u = URL.createObjectURL(new Blob([$('worklet-src').textContent], {type: 'text/javascript'})); await ctx.audioWorklet.addModule(u);
  node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2]}); const g = ctx.createGain(); g.gain.value = .9;
  an = ctx.createAnalyser(); an.fftSize = 2048; node.connect(g); g.connect(an); g.connect(ctx.destination); loadKit(); scope(); }
// both machines into the node: the pads a.kick … (the analog kit, with your settings) and b.kick … (the copy)
function loadKit(){ if (!node) return; const slots = {}, over = S.over[S.kit] || {};
  for (const [v] of ROWS) { slots['a.' + v] = {kit: 'A:' + S.kit + JSON.stringify(over), voice: v}; slots['b.' + v] = {kit: 'B:' + kitFallback(S.kit), voice: v}; }
  node.port.postMessage({type: 'load', kits: {['A:' + S.kit + JSON.stringify(over)]: {kit: S.kit, over}, ['B:' + kitFallback(S.kit)]: {kit: kitFallback(S.kit)}}, slots}); }

/* ---------- the transport: a 16th at a time, a little ahead on the audio clock ---------- */
function tick(){ while (next < ctx.currentTime + .12) { const b = beat(), R = rowsOf(b), st = slot % 32, sw = st % 2 ? S.swing*sd() : 0, t = next + sw;
    // A/B swapping: the analog kit for two bars, then the copy for two
    const side = S.abSwap ? (Math.floor(slot/32) % 2 ? 'b' : 'a') : S.ab;
    for (const [v] of ROWS) { const c = (R[v] || '')[st]; if (!c || c === '.' || S.mute[v]) continue; const vel = VEL[c] ?? .78;
      node.port.postMessage({type: 'on', id: slot, slot: side + '.' + v, n: 60, vel, t});
      if (c === 'r') node.port.postMessage({type: 'on', id: slot + .5, slot: side + '.' + v, n: 60, vel: vel*.85, t: t + sd()/2}); }
    const when = next, s = st, sideNow = side; setTimeout(() => { if (S.playing) { S.step = s; S.side = sideNow; paintStep(); } }, Math.max(0, (when - ctx.currentTime)*1000));
    next += sd(); slot++; } }
async function play(){ await start(); if (S.playing) return stop(); S.playing = true; slot = 0; next = ctx.currentTime + .08; tick(); timer = setInterval(tick, 25); paintTransport(); }
function stop(){ S.playing = false; clearInterval(timer); node?.port.postMessage({type: 'stop'}); S.step = -1; paintStep(); paintTransport(); }

/* ---------- the panel ---------- */
function pickBeat(id){ S.beat = id; keep('beat', id); const b = beat(); S.bpm = b.bpm; S.swing = b.swing; $('bpm').value = S.bpm; $('swing').value = Math.round(S.swing*100); paintAll(); }
function pickKit(k){ S.kit = k; keep('kit', k); loadKit(); paintAll(); }
function paintTransport(){ $('play').textContent = S.playing ? 'Stop' : 'Play'; $('play').setAttribute('aria-pressed', S.playing); $('bpmOut').textContent = S.bpm; $('swingOut').textContent = Math.round(S.swing*100) + '%';
  for (const [id, on] of [['abA', !S.abSwap && S.ab === 'a'], ['abB', !S.abSwap && S.ab === 'b'], ['abSwap', S.abSwap]]) $(id).setAttribute('aria-pressed', on); }
function paintKits(){ const box = $('kits'); box.replaceChildren(...ANALOG_NAMES.map(k => h('button', {class: 'kit', 'aria-pressed': S.kit === k, onclick: () => pickKit(k)}, h('b', {}, k.replace('Analog ', '')), h('span', {}, ANALOG_KITS[k].words))));
  $('abB').textContent = `Browser copy (${kitFallback(S.kit)})`; }
function paintBeats(){ $('beats').replaceChildren(...BEATS.map(b => h('button', {class: 'beat', 'aria-pressed': S.beat === b.id, onclick: () => pickBeat(b.id)},
  h('b', {}, b.name), h('span', {}, `${b.style} · ${b.bpm} BPM`), S.edits[b.id] ? h('i', {}, 'edited') : null))); }
function paintGrid(){ const b = beat(), R = rowsOf(b), g = $('grid'); g.replaceChildren();
  for (const [v, name] of ROWS) { const row = R[v] || '.'.repeat(32), used = /[^.]/.test(row);
    const lab = h('button', {class: 'lab', 'aria-pressed': S.voice === v, 'data-used': used, title: 'Shape this voice', onclick: () => { S.voice = v; paintGrid(); paintKnobs(); hitNow(v); }}, name);
    const mute = h('button', {class: 'mute', 'aria-pressed': !!S.mute[v], title: S.mute[v] ? 'Unmute' : 'Mute', onclick: () => { S.mute[v] = !S.mute[v]; paintGrid(); }}, 'M');
    const steps = h('div', {class: 'steps'}, ...[...row.padEnd(32, '.')].map((c, i) => h('button', {class: 'st', 'data-c': c === '.' ? '' : c, 'data-i': i, 'data-g': Math.floor((i % 16)/4), 'aria-label': `${name} step ${i + 1}`,
      onclick: () => cycle(v, i)})));
    g.append(h('div', {class: 'row', 'data-muted': !!S.mute[v]}, mute, lab, steps)); }
  paintStep(); }
// a step: rest → hit → accent → ghost → rest
function cycle(v, i){ const b = beat(), R = rowsOf(b), row = [...(R[v] || '.'.repeat(32)).padEnd(32, '.')], nx = {'.': 'x', x: 'X', X: 'o', o: 'r', r: '.'};
  row[i] = nx[row[i]] ?? '.'; S.edits[b.id] = {...S.edits[b.id], [v]: row.join('')}; keep('edits', S.edits); if (row[i] !== '.' && !S.playing) hitNow(v, VEL[row[i]]); paintGrid(); paintBeats(); }
function paintStep(){ for (const e of document.querySelectorAll('.st[data-now]')) e.removeAttribute('data-now'); if (S.step >= 0) for (const e of document.querySelectorAll(`.st[data-i="${S.step}"]`)) e.setAttribute('data-now', '');
  $('side').textContent = S.playing ? (S.side === 'b' ? `Playing: the browser copy (${kitFallback(S.kit)})` : `Playing: ${S.kit}`) : 'Stopped'; $('side').dataset.side = S.playing ? S.side : ''; }
// a voice's knobs: the analog machine's ten, heard at once while it plays, kept on this device
function paintKnobs(){ const v = S.voice, P = {...analogParams(S.kit)[v], ...((S.over[S.kit] || {})[v] || {})}, box = $('knobs'), name = ROWS.find(r => r[0] === v)[1];
  $('voiceName').textContent = name; box.replaceChildren(...APARAMS.map(p => { const step = p.unit === 'st' ? 1 : .01, val = P[p.key] ?? p.def, id = 'k-' + p.key;
    const out = h('output', {for: id}, fmt(p, val)), r = h('input', {type: 'range', id, min: p.min, max: p.max, step, value: val});
    r.oninput = () => { const x = +r.value; out.textContent = fmt(p, x); setVoice(v, p.key, x); };
    r.onchange = () => { if (!S.playing) hitNow(v); };
    return h('label', {class: 'knob'}, h('span', {}, p.key === 'x' ? CH[v] || 'Character' : p.label), r, out); })); }
const CH = {kick: 'Boom → punch', snare: 'Snappy', clap: 'Spread', rim: 'Ring', clave: 'Ring', chh: 'Metal', ohh: 'Metal', ride: 'Bell', crash: 'Metal', tomL: 'Ring', tomH: 'Ring', cow: 'Ring', shaker: 'Swell'};
const fmt = (p, v) => p.unit === 'st' ? (v > 0 ? '+' : '') + Math.round(v) + ' st' : p.unit === 'pan' ? (Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100)) : p.unit === '×' ? (+v).toFixed(2) + '×' : Math.round(v*100) + '%';
function setVoice(v, k, x){ const o = S.over[S.kit] = {...(S.over[S.kit] || {})}; o[v] = {...o[v], [k]: x}; keep('over', S.over);
  // (heard at once: the node's machine is set; it's loaded with the settings next time the kit is picked)
  node?.port.postMessage({type: 'set', kit: true, slot: 'a.' + v, key: k, v: x}); }
function resetVoice(){ const o = {...(S.over[S.kit] || {})}; delete o[S.voice]; S.over[S.kit] = o; keep('over', S.over); loadKit(); paintKnobs(); }
async function hitNow(v, vel = .9){ await start(); node.port.postMessage({type: 'on', id: 'p', slot: (S.ab === 'b' && !S.abSwap ? 'b.' : 'a.') + v, n: 60, vel, t: ctx.currentTime + .01}); }
// the waveform as heard
function scope(){ const c = $('scope'), g = c.getContext('2d'), x = new Float32Array(an.fftSize), css = getComputedStyle(document.documentElement);
  const draw = () => { const w = c.width = c.clientWidth*devicePixelRatio, hh = c.height = c.clientHeight*devicePixelRatio; an.getFloatTimeDomainData(x); g.clearRect(0, 0, w, hh);
    g.strokeStyle = css.getPropertyValue('--lamp').trim() || '#e35d2a'; g.lineWidth = 1.5*devicePixelRatio; g.beginPath();
    for (let i = 0; i < x.length; i++) { const px = i/x.length*w, py = hh/2 - x[i]*hh*.46; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); requestAnimationFrame(draw); };
  draw(); }
// notes for Claude: what you think, with what you were hearing and what you changed
function copyNotes(){ const b = beat(), txt = `Drum playground notes\n${$('notes').value.trim() || '(no notes)'}\n\nHeard: ${b.name} on ${S.kit}, ${S.bpm} BPM, swing ${Math.round(S.swing*100)}%\nYour voice settings: ${JSON.stringify(S.over)}\nYour edited beats: ${JSON.stringify(S.edits)}`;
  const done = () => { $('copied').textContent = 'Copied: paste it to Claude'; setTimeout(() => $('copied').textContent = '', 3000); };
  navigator.clipboard?.writeText(txt).then(done, () => { $('notes').value = txt; $('notes').select(); $('copied').textContent = 'Selected: copy it with your keyboard'; }) ?? ($('notes').value = txt); }
function paintAll(){ paintKits(); paintBeats(); paintGrid(); paintKnobs(); paintTransport(); }

$('play').onclick = play; $('bpm').oninput = e => { S.bpm = +e.target.value; paintTransport(); }; $('swing').oninput = e => { S.swing = +e.target.value/100; paintTransport(); };
$('abA').onclick = () => { S.ab = 'a'; S.abSwap = false; paintTransport(); }; $('abB').onclick = () => { S.ab = 'b'; S.abSwap = false; paintTransport(); }; $('abSwap').onclick = () => { S.abSwap = !S.abSwap; paintTransport(); };
$('resetVoice').onclick = resetVoice; $('resetBeat').onclick = () => { delete S.edits[S.beat]; keep('edits', S.edits); paintGrid(); paintBeats(); };
$('notes').value = S.notes; $('notes').oninput = e => keep('notes', e.target.value); $('copy').onclick = copyNotes;
addEventListener('keydown', e => { if (e.target.matches('input, textarea')) return; if (e.code === 'Space') { e.preventDefault(); play(); } });
pickBeat(S.beat);
window.__drums = {S, BEATS, get ctx(){ return ctx; }, get node(){ return node; }, play, stop, pickKit, pickBeat};   // (for tests)
