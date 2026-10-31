// The synth playground: the analog synth (studio/lib/native/asynth.js) played live in the audio engine's thread
// (synth.worklet.js), with the analog drum machine under it. Pick an example (a patch and a phrase written for it),
// play it or the keys, turn any setting while it sounds; your changes are kept per example on this device, sounds can
// be saved by name, and notes are copied out for Claude with what was changed.
import { PARAMS, PLIST, DEF, FILTERS } from '../lib/native/asynth.js';
import { EXAMPLES, DRUMS, NOTE } from './examples.js';
import { $, h } from '../lib/dom.js';


const load = (k, d) => { try { const v = localStorage.getItem('synthlab.' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, keep = (k, v) => { try { localStorage.setItem('synthlab.' + k, JSON.stringify(v)); } catch {} };
const S = {ex: load('ex', 'round'), edits: load('edits', {}), saved: load('saved', []), drums: null, bpm: 120, playing: false, oct: load('oct', 0), hold: false, step: -1, down: new Map(), held: new Set()};
const PK = Object.fromEntries(PLIST.map(p => [p.key, p]));
let ctx = null, node = null, an = null, timer = 0, next = 0, slot = 0;
const ex = () => EXAMPLES.find(e => e.id === S.ex) || EXAMPLES[0];
const patch = () => ({...DEF, ...ex().patch, ...(S.edits[S.ex] || {})});
const sd = () => 60/S.bpm/4;
const send = m => node?.port.postMessage({...m, period: 60/S.bpm});

/* ---------- the sound ---------- */
async function start(){ if (ctx) { if (ctx.state !== 'running') await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'interactive'});
  const u = URL.createObjectURL(new Blob([$('worklet-src').textContent], {type: 'text/javascript'})); await ctx.audioWorklet.addModule(u);
  node = new AudioWorkletNode(ctx, 'analog-synth', {numberOfInputs: 0, outputChannelCount: [2]});
  an = ctx.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = .7; node.connect(an); node.connect(ctx.destination);
  send({type: 'load', params: patch()}); draws(); }

/* ---------- the phrase: a 16th at a time, a little ahead on the audio clock, round and round ---------- */
function tick(){ const e = ex(), len = e.bars*16, D = S.drums && DRUMS[S.drums];
  while (next < ctx.currentTime + .12) { const st = slot % len, lap = Math.floor(slot/len);
    e.notes.forEach((x, i) => { if (Math.floor(x.s) !== st) return; const t = next + (x.s - st)*sd(), id = `p${lap}:${i}`;
      send({type: 'on', id, n: x.n, vel: x.v, t, seq: 1}); send({type: 'off', id, t: t + x.l*sd(), seq: 1}); });
    if (D) for (const [v, row] of Object.entries(D.rows)) { const c = row[st % 16]; if (c && c !== '.') send({type: 'drum', v, vel: c === 'X' ? 1 : c === 'o' ? .4 : .75, t: next, seq: 1}); }
    const when = next, s = st; setTimeout(() => { if (S.playing) { S.step = s; roll(); } }, Math.max(0, (when - ctx.currentTime)*1000));
    next += sd(); slot++; } }
async function play(){ await start(); if (S.playing) return stop(); S.playing = true; slot = 0; next = ctx.currentTime + .06; send({type: 'clock', t0: next}); tick(); timer = setInterval(tick, 25); paintTransport(); }
function stop(){ S.playing = false; clearInterval(timer); send({type: 'stop'}); S.step = -1; roll(); paintTransport(); }

/* ---------- the keys: on screen (a finger or the mouse sliding across), and the computer's ---------- */
const KEYS = 'awsedftgyhujkolp;\'';
const base = () => 48 + 12*S.oct;
async function press(n, vel = .8){ await start(); if (S.hold && S.held.has(n)) { S.held.delete(n); send({type: 'off', id: 'k' + n}); paintKeys(); return; }
  if (S.hold) S.held.add(n); send({type: 'on', id: 'k' + n, n, vel}); paintKeys(n, true); }
function release(n){ if (S.hold) return; send({type: 'off', id: 'k' + n}); paintKeys(n, false); }
function buildKb(){ const kb = $('kb'), n0 = base(), white = []; kb.replaceChildren();
  for (let n = n0; n <= n0 + 24; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) white.push(n);
  const W = 100/white.length;
  white.forEach((n, i) => kb.append(h('div', {class: 'key w', 'data-n': n, style: `left:${i*W}%;width:${W}%`}, n % 12 === 0 ? NOTE(n) : '')));
  for (let n = n0; n <= n0 + 24; n++) if ([1, 3, 6, 8, 10].includes(n % 12)) { const i = white.indexOf(n - 1); kb.append(h('div', {class: 'key b', 'data-n': n, style: `left:${(i + 1)*W - W*.32}%;width:${W*.64}%`})); }
  $('octOut').textContent = `C${3 + S.oct}–C${5 + S.oct}`; paintKeys(); }
const keyAt = e => { const k = document.elementFromPoint(e.clientX, e.clientY)?.closest('.key'); return k ? +k.dataset.n : null; };
function paintKeys(){ const on = new Set([...S.down.values(), ...S.held, ...S.typed.values()]); for (const k of document.querySelectorAll('#kb .key')) on.has(+k.dataset.n) ? k.setAttribute('data-on', '') : k.removeAttribute('data-on'); }
S.typed = new Map();
function kbEvents(){ const kb = $('kb');
  // a press's height on the key is its velocity (lower is harder, as a key pressed further down)
  const vel = e => { const r = e.target.closest('.key')?.getBoundingClientRect(); return r ? Math.min(1, .45 + .55*(e.clientY - r.top)/r.height) : .8; };
  kb.onpointerdown = e => { e.preventDefault(); kb.setPointerCapture(e.pointerId); const n = keyAt(e); if (n == null) return; S.down.set(e.pointerId, n); press(n, vel(e)); };
  kb.onpointermove = e => { if (!S.down.has(e.pointerId)) return; const n = keyAt(e), was = S.down.get(e.pointerId); if (n == null || n === was) return;
    S.down.set(e.pointerId, n); press(n, vel(e)); release(was); };
  kb.onpointerup = kb.onpointercancel = e => { const n = S.down.get(e.pointerId); S.down.delete(e.pointerId); if (n != null) release(n); paintKeys(); }; }
addEventListener('keydown', e => { if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); play(); return; }
  const k = e.key.toLowerCase(); if (k === 'z' || k === 'x') { octave(k === 'z' ? -1 : 1); return; }
  const i = KEYS.indexOf(k); if (i < 0 || e.repeat) return; e.preventDefault(); const n = base() + 12 + i; S.typed.set(k, n); press(n, .8); });
addEventListener('keyup', e => { const k = e.key.toLowerCase(), n = S.typed.get(k); if (n == null) return; S.typed.delete(k); release(n); paintKeys(); });
addEventListener('blur', () => { for (const [k, n] of S.typed) release(n); S.typed.clear(); paintKeys(); });
function octave(d){ S.oct = Math.max(-2, Math.min(2, S.oct + d)); keep('oct', S.oct); buildKb(); }

/* ---------- the panel: one module a group, a control a setting ---------- */
// a slider's position (0..1000) and its value: log for frequencies and times, a power curve where the fine end matters
const toV = (p, x) => { x /= 1000; return p.log ? p.min*Math.pow(p.max/p.min, x) : p.pow ? p.min + (p.max - p.min)*Math.pow(x, p.pow) : p.min + (p.max - p.min)*x; };
const toX = (p, v) => Math.round(1000*(p.log ? Math.log(v/p.min)/Math.log(p.max/p.min) : p.pow ? Math.pow((v - p.min)/(p.max - p.min), 1/p.pow) : (v - p.min)/(p.max - p.min)));
const whole = p => ['oct', 'st', '#'].includes(p.unit) && !p.pow;
function fmt(p, v){ if (p.list) return p.list[Math.round(v)];
  switch (p.unit) {
    case 'Hz': return v < 1000 ? `${v < 100 ? v.toFixed(1) : Math.round(v)} Hz` : `${(v/1000).toFixed(v < 10000 ? 2 : 1)} kHz`;
    case 's': return v < 1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`;
    case '±': return (v > 0 ? '+' : '') + Math.round(v*100) + '%';
    case 'st': return (v > 0 ? '+' : '') + (Math.abs(v - Math.round(v)) < .01 ? Math.round(v) : v.toFixed(2)) + ' st';
    case 'ct': return (v > 0 ? '+' : '') + Math.round(v) + ' ct';
    case 'oct': return (v > 0 ? '+' : '') + (Number.isInteger(+v.toFixed(2)) ? Math.round(v) : v.toFixed(2)) + ' oct';
    case '#': return String(Math.round(v));
    default: return Math.round(v*100) + '%'; } }
const SUB = {'Oscillator 1': 'the master', 'Oscillator 2': 'synced to 1 when Hard sync is on', Mixer: 'into the filter, driven', Filter: '', 'Filter envelope': '', 'Amp envelope': 'the VCA', Modulation: 'one LFO for all', Voices: 'eight voice cards', Output: 'chorus, tape echo'};
function control(p, v){ const id = 'p-' + p.key, changed = Math.abs(v - (ex().patch[p.key] ?? DEF[p.key])) > 1e-9, attr = {class: 'ctl', 'data-key': p.key, 'data-changed': changed};
  if (p.list && p.list.length <= 4) return h('div', attr, h('span', {}, p.label), h('div', {class: 'seg', role: 'group', 'aria-label': p.label},
    ...p.list.map((name, i) => h('button', {id: id + '-' + i, 'aria-pressed': Math.round(v) === i, onclick: () => setParam(p.key, i)}, name))));
  if (p.list) { const sel = h('select', {id, 'aria-label': p.label}, ...p.list.map((name, i) => h('option', {value: i, selected: Math.round(v) === i}, name))); sel.onchange = () => setParam(p.key, +sel.value);
    return h('div', attr, h('span', {}, p.label), sel); }
  const w = whole(p), r = h('input', {type: 'range', id, min: w ? p.min : 0, max: w ? p.max : 1000, step: 1, value: w ? Math.round(v) : toX(p, v)}), out = h('output', {for: id}, fmt(p, v));
  r.oninput = () => { const x = w ? +r.value : toV(p, +r.value); out.textContent = fmt(p, x); setParam(p.key, x, true); };
  r.ondblclick = () => setParam(p.key, ex().patch[p.key] ?? DEF[p.key]);
  return h('label', {...attr, title: 'Double-click: back to the example'}, h('span', {}, p.label), out, r); }
const DRAW = {'Filter': 'fcurve', 'Filter envelope': 'fenvc', 'Amp envelope': 'aenvc'};
function paintPanel(){ const P = patch();
  $('mods').replaceChildren(...PARAMS.map(([g, ps]) => h('section', {class: 'mod'}, h('h3', {}, g, SUB[g] ? h('small', {}, ' · ' + SUB[g]) : null),
    DRAW[g] ? h('canvas', {id: DRAW[g]}) : null, ...ps.map(p => control(p, P[p.key])))));
  curves(); }
// a setting changed: heard at once, kept for this example, the panel's marks and drawings brought up to date
function setParam(k, v, live){ const e = ex(), ed = {...(S.edits[S.ex] || {})}, def = e.patch[k] ?? DEF[k];
  if (Math.abs(v - def) < 1e-9) delete ed[k]; else ed[k] = v; S.edits[S.ex] = ed; keep('edits', S.edits);
  send({type: 'set', params: {[k]: v}});
  if (live) { document.querySelector(`.ctl[data-key="${k}"]`)?.toggleAttribute('data-changed', k in ed); curves(); } else paintPanel();
  paintExs(); sayPatch(); }
function setPatch(full){ const e = ex(), ed = {}; for (const p of PLIST) { const v = full[p.key] ?? DEF[p.key], def = e.patch[p.key] ?? DEF[p.key]; if (Math.abs(v - def) > 1e-9) ed[p.key] = v; }
  S.edits[S.ex] = ed; keep('edits', S.edits); send({type: 'load', params: patch()}); paintPanel(); paintExs(); sayPatch(); }
function sayPatch(){ const n = Object.keys(S.edits[S.ex] || {}).length; $('sayPatch').textContent = n ? `${n} setting${n > 1 ? 's' : ''} changed from ${ex().name}` : `As in ${ex().name}`; }

/* ---------- the examples, the phrase, the transport ---------- */
async function pickEx(id){ const was = S.playing; if (was) stop(); S.ex = id; keep('ex', id); const e = ex(); S.bpm = e.bpm; S.drums = e.drums; $('bpm').value = S.bpm;
  send({type: 'panic'}); send({type: 'load', params: patch()}); paintAll(); if (was) await play(); }
function paintExs(){ $('exs').replaceChildren(...EXAMPLES.map(e => h('button', {class: 'ex', 'aria-pressed': S.ex === e.id, onclick: () => pickEx(e.id)},
  h('b', {}, e.name), h('span', {}, `${e.style} · ${e.bpm} BPM`), Object.keys(S.edits[e.id] || {}).length ? h('i', {}, 'your version') : null))); }
function paintTransport(){ $('play').textContent = S.playing ? 'Stop' : 'Play'; $('play').setAttribute('aria-pressed', S.playing); $('bpmOut').textContent = S.bpm;
  $('drums').replaceChildren(...[[null, 'Off'], ...Object.entries(DRUMS).map(([k, d]) => [k, d.name])].map(([k, name]) => h('button', {'aria-pressed': S.drums === k, onclick: () => { S.drums = k; paintTransport(); }}, name)));
  $('hold').setAttribute('aria-pressed', S.hold); }
function paintAll(){ const e = ex(); $('exName').textContent = `${e.name}, ${e.bars} bars`; $('exWords').textContent = e.words; paintExs(); paintTransport(); paintPanel(); sayPatch(); roll(); }

/* ---------- the drawings: the waveform, the spectrum, the phrase, the filter's curve, the envelopes ---------- */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fit = c => { const w = c.width = Math.round(c.clientWidth*devicePixelRatio), hh = c.height = Math.round(c.clientHeight*devicePixelRatio); const g = c.getContext('2d'); g.clearRect(0, 0, w, hh); return [g, w, hh]; };
function draws(){ const x = new Float32Array(an.fftSize), f = new Float32Array(an.frequencyBinCount);
  const frame = () => { an.getFloatTimeDomainData(x);
    // the waveform, held still from a rising zero crossing
    { const [g, w, hh] = fit($('scope')); let z = 0; for (let i = 1; i < x.length/2; i++) if (x[i - 1] < 0 && x[i] >= 0) { z = i; break; }
      g.strokeStyle = css('--trace'); g.lineWidth = 1.5*devicePixelRatio; g.beginPath(); const N = 1024;
      for (let i = 0; i < N; i++) { const px = i/N*w, py = hh/2 - x[z + i]*hh*.46; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
    // the spectrum, 30 Hz to 16 kHz on octaves
    { an.getFloatFrequencyData(f); const [g, w, hh] = fit($('spec')), sr = ctx.sampleRate; g.fillStyle = css('--trace'); g.globalAlpha = .85;
      for (let px = 0; px < w; px += 2*devicePixelRatio) { const fr = 30*Math.pow(16000/30, px/w), b = Math.round(fr/sr*an.fftSize), db = f[b] ?? -120, y = Math.max(0, Math.min(1, (db + 100)/80));
        g.fillRect(px, hh*(1 - y), 1.5*devicePixelRatio, hh*y); } }
    requestAnimationFrame(frame); };
  frame(); }
function roll(){ const c = $('roll'); if (!c) return; const [g, w, hh] = fit(c), e = ex(), len = e.bars*16, ns = e.notes.map(x => x.n), lo = Math.min(...ns) - 2, hi = Math.max(...ns) + 2;
  g.strokeStyle = css('--line'); g.lineWidth = 1; for (let b = 0; b <= e.bars*4; b++) { const px = b/(e.bars*4)*w; g.globalAlpha = b % 4 ? .35 : .9; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, hh); g.stroke(); }
  g.globalAlpha = 1; const rowH = hh/(hi - lo + 1);
  for (const x of e.notes) { const on = S.step >= 0 && S.step >= Math.floor(x.s) && S.step < x.s + x.l; g.fillStyle = on ? css('--glow') : css('--amber'); g.globalAlpha = on ? 1 : .35 + .5*x.v;
    g.fillRect(x.s/len*w + 1, hh - (x.n - lo + 1)*rowH, Math.max(2, x.l/len*w - 2), Math.max(2, rowH - 1)); }
  if (S.step >= 0) { g.globalAlpha = 1; g.fillStyle = css('--ink'); g.fillRect(S.step/len*w, 0, 2*devicePixelRatio, hh); } }
// the filter's response at its cutoff (the solid line) and where the envelope takes it (the faint one): the analog prototypes
function response(P, f, fc){ const s = f/fc, k = 4.3*P.res*P.res*(3 - 2*P.res), t = Math.round(P.ftype), c = (re, im) => [re, im];
  const mul = (a, b) => c(a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]), absC = a => Math.hypot(a[0], a[1]), one = c(1, s);
  if (t <= 1) { const kk = t ? k*.6 : k; let p = mul(one, one); if (!t) p = mul(p, p); const d = c(p[0] + kk, p[1]); return (1 + kk*.45)/absC(d); }
  const R = P.res, q = 2 - 1.96*R, d = c(1 - s*s, q*s), m = absC(d);
  return t === 2 ? 1/m : t === 3 ? q*s/m : t === 4 ? s*s/m : Math.abs(1 - s*s)/m; }
function curves(){ const P = patch(), fcv = $('fcurve'); if (!fcv) return;
  { const [g, w, hh] = fit(fcv), dB = v => 20*Math.log10(Math.max(1e-4, v)), y = v => hh*(1 - (Math.max(-36, Math.min(18, dB(v))) + 36)/54);
    g.strokeStyle = css('--line'); g.globalAlpha = .6; g.beginPath(); g.moveTo(0, y(1)); g.lineTo(w, y(1)); g.stroke(); g.globalAlpha = 1;
    const top = Math.min(18000, P.cut*Math.pow(2, Math.max(0, P.fenv)*7));
    for (const [fc, a] of [[top, .3], [P.cut, 1]]) { g.strokeStyle = css('--trace'); g.globalAlpha = a; g.lineWidth = 1.5*devicePixelRatio; g.beginPath();
      for (let px = 0; px <= w; px += 2) { const f = 20*Math.pow(1000, px/w); px ? g.lineTo(px, y(response(P, f, fc))) : g.moveTo(px, y(response(P, f, fc))); } g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = css('--mute'); g.font = `${10*devicePixelRatio}px ${css('--mono')}`; g.fillText(FILTERS[Math.round(P.ftype)], 6*devicePixelRatio, 13*devicePixelRatio); }
  for (const [id, A, D, Sl, R] of [['fenvc', P.fa, P.fd, P.fs, P.fr], ['aenvc', P.aa, P.ad, P.as, P.ar]]) { const c = $(id); if (!c) continue; const [g, w, hh] = fit(c);
    // the shapes the circuits make: the attack charging towards past full, the falls exponential; held a moment at the sustain
    const hold = .35, tot = A + D + hold + R, xs = t => t/tot*w, OV = 1.3, pts = [];
    for (let i = 0; i <= 60; i++) { const t = A*i/60; pts.push([xs(t), Math.min(1, OV*(1 - Math.pow(1 - 1/OV, i/60)))]); }
    for (let i = 1; i <= 60; i++) { const t = D*i/60; pts.push([xs(A + t), Sl + (1 - Sl)*Math.pow(.001, i/60)]); }
    pts.push([xs(A + D + hold), Sl]); for (let i = 1; i <= 60; i++) pts.push([xs(A + D + hold + R*i/60), Sl*Math.pow(.001, i/60)]);
    g.strokeStyle = css('--trace'); g.lineWidth = 1.5*devicePixelRatio; g.beginPath(); pts.forEach(([px, v], i) => { const py = hh - 4 - v*(hh - 10); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    g.fillStyle = css('--mute'); g.font = `${10*devicePixelRatio}px ${css('--mono')}`; g.fillText(`${tot < 1 ? Math.round(tot*1000) + ' ms' : tot.toFixed(1) + ' s'} shown`, 6*devicePixelRatio, 13*devicePixelRatio); } }

/* ---------- your patches: saved by name, back to the example, from scratch, a surprise ---------- */
function paintSaved(){ $('saved').replaceChildren(...S.saved.map((s, i) => h('span', {class: 'chip'}, h('button', {title: 'Play this sound with the phrase', onclick: () => setPatch(s.params)}, s.name),
  h('button', {'aria-label': 'Remove ' + s.name, onclick: () => { S.saved.splice(i, 1); keep('saved', S.saved); paintSaved(); }}, '×')))); }
function save(){ const name = $('saveName').value.trim() || `${ex().name} ${S.saved.length + 1}`; S.saved = [...S.saved.filter(s => s.name !== name), {name, params: patch(), from: S.ex}]; keep('saved', S.saved);
  $('saveName').value = ''; paintSaved(); }
// a surprise: every setting drawn from where it sounds musical, not from its whole range
function surprise(){ const R = Math.random, pick = a => a[Math.floor(R()*a.length)], lg = (a, b) => a*Math.pow(b/a, R());
  const mode = pick([0, 0, 0, 1, 1, 2, 3]), pad = mode === 0 && R() < .5;
  setPatch({...DEF, w1: pick([0, 0, 1, 2]), w2: pick([0, 0, 1, 2, 3]), oct2: pick([-1, 0, 0, 1]), semi2: pick([0, 0, 0, 7, 12, -5, 5]), fine2: (R() - .5)*24, pw1: .2 + R()*.3, pw2: .2 + R()*.3,
    sync: R() < .15 ? 1 : 0, xmod: R() < .15 ? R()*.4 : 0, l1: .6 + R()*.4, l2: R()*.9, lsub: R() < .4 ? R()*.5 : 0, lnoise: R() < .2 ? R()*.25 : 0, lring: R() < .1 ? R()*.6 : 0, drive: R()*.6,
    ftype: pick([0, 0, 0, 1, 2, 3]), cut: lg(180, 4000), res: R()*.8, fenv: (R() - .2)*.8, fkey: R(), fa: pad ? lg(.2, 2) : lg(.001, .05), fd: lg(.08, 2), fs: R()*.7, fr: lg(.05, 2),
    aa: pad ? lg(.2, 2) : lg(.001, .03), ad: lg(.1, 2), as: R(), ar: pad ? lg(.5, 3) : lg(.05, .6), lshape: Math.floor(R()*6), lrate: lg(.1, 8), lpwm: R() < .3 ? R()*.3 : 0, lcut: R() < .3 ? R()*2 : 0,
    lpitch: R() < .15 ? R()*.2 : 0, mode, uni: 2 + Math.floor(R()*6), udet: R()*.6, glide: mode && R() < .5 ? R()*.15 : 0, slop: .2 + R()*.5, chorus: Math.floor(R()*4), emix: R() < .5 ? R()*.4 : 0,
    etime: Math.floor(R()*6), efb: R()*.6, level: .5}); }

/* ---------- notes for Claude ---------- */
function copyNotes(){ const e = ex(), ed = S.edits[S.ex] || {}, txt = `Synth playground notes\n${$('notes').value.trim() || '(no notes)'}\n\nHeard: ${e.name} at ${S.bpm} BPM, drums ${S.drums ? DRUMS[S.drums].name : 'off'}\n` +
  `Changed from the example: ${Object.keys(ed).length ? Object.entries(ed).map(([k, v]) => `${PK[k].label} (${k}) ${fmt(PK[k], v)}`).join(', ') : 'nothing'}\n` +
  `Your saved sounds: ${S.saved.length ? S.saved.map(s => s.name).join(', ') : 'none'}\nAll your changes: ${JSON.stringify(S.edits)}\nSaved sounds: ${JSON.stringify(S.saved)}`;
  const done = () => { $('copied').textContent = 'Copied: paste it to Claude'; setTimeout(() => $('copied').textContent = '', 3000); };
  try { navigator.clipboard.writeText(txt).then(done, fallback); } catch { fallback(); }
  function fallback(){ $('notes').value = txt; $('notes').select(); $('copied').textContent = 'Selected: copy it with your keyboard'; } }

$('play').onclick = play; $('bpm').oninput = e => { S.bpm = +e.target.value; send({type: 'set', params: {}}); paintTransport(); };
$('bend').oninput = e => send({type: 'bend', v: +e.target.value}); $('bend').onpointerup = $('bend').onchange = e => { e.target.value = 0; send({type: 'bend', v: 0}); };
$('wheel').oninput = e => send({type: 'wheel', v: +e.target.value});
$('octDn').onclick = () => octave(-1); $('octUp').onclick = () => octave(1);
$('hold').onclick = () => { S.hold = !S.hold; if (!S.hold) { for (const n of S.held) send({type: 'off', id: 'k' + n}); S.held.clear(); paintKeys(); } paintTransport(); };
$('panic').onclick = () => { S.held.clear(); send({type: 'panic'}); if (S.playing) stop(); paintKeys(); };
$('save').onclick = save; $('saveName').onkeydown = e => { if (e.key === 'Enter') save(); };
$('reset').onclick = () => setPatch({...DEF, ...ex().patch}); $('init').onclick = () => setPatch({...DEF}); $('surprise').onclick = surprise;
$('notes').value = load('notes', ''); $('notes').oninput = e => keep('notes', e.target.value); $('copy').onclick = copyNotes;
addEventListener('resize', () => { roll(); curves(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { roll(); curves(); });
{ const e = ex(); S.bpm = e.bpm; S.drums = e.drums; $('bpm').value = S.bpm; }
buildKb(); kbEvents(); paintAll(); paintSaved();
window.__synthlab = {S, EXAMPLES, get ctx(){ return ctx; }, get node(){ return node; }, get an(){ return an; }, play, stop, pickEx, setParam, press, release, patch, start};   // (for tests)
