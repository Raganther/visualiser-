// The drum rack playground: the analog drum machine taken apart into a rack, each pad its own channel (its fader, pan,
// mute and solo, sends to an echo and a room, its own processors, and whether it goes through the bus or around it),
// the pads summed into a bus whose processors (the kit's own: weight, tape, tone, glue, width, ceiling) can be switched,
// moved, taken out and added to, and switched out all at once at the same loudness, to hear what the bus does. Built on
// the parts (studio/lib/parts/): the host strings them together from a description, the shell makes the controls.
import { $, h, store, clone, startHost, control, chainEditor, showGr, scope, copyOut } from '../lib/parts/shell.js';
import { ANALOG_KITS, ANALOG_NAMES, APARAMS, analogParams, busChain } from '../lib/native/analogkit.js';
import { BEATS, ROWS, VEL } from '../drums/beats.js';

const K = store('racklab.'), OFF = -40;
// a pad's channel as it starts: at its kit's own level, centred, through the bus, no sends, no processors of its own
const PAD = () => ({level: 0, pan: 0, mute: false, solo: false, echo: OFF, room: OFF, to: 'bus', chain: []});
const RET = () => ({echo: {level: -6, chain: [{id: 'echo', key: 'echo', params: {time: 1, mix: 1, dry: 0, fb: .45, tone: .45}, on: true}]},
  room: {level: -6, chain: [{id: 'room', key: 'room', params: {size: .8, decay: 1.2, damp: .55, pre: 10, cut: 250, mix: 1, dry: 0}, on: true}]}});
const MASTER = [{id: 'm-ceil', key: 'ceiling', params: {knee: .92}, on: true}];
const S = {kit: K.load('kit', 'Analog 808'), beat: K.load('beat', 'four'), bpm: 120, swing: 0, playing: false, sel: K.load('sel', 'kick'), step: -1,
  pads: K.load('pads', {}), bus: K.load('bus', {}), busLevel: K.load('busLevel', 0), bypass: false, match: K.load('match', true), ret: K.load('ret', RET()), over: K.load('over', {}), m: {}};
const beat = () => BEATS.find(b => b.id === S.beat) || BEATS[0], sd = () => 60/S.bpm/4;
const pad = v => (S.pads[v] ||= PAD());
// the kit's own bus as a chain of processors: what the drum machine does to its sum, now in pieces
const kitBus = k => busChain(ANALOG_KITS[k].bus).map(s => ({id: 'b-' + s.key, ...s, on: true}));
const bus = () => (S.bus[S.kit] ||= kitBus(S.kit));
const save = () => { K.keep('pads', S.pads); K.keep('bus', S.bus); K.keep('busLevel', S.busLevel); K.keep('ret', S.ret); K.keep('over', S.over); K.keep('match', S.match); };
let A = null, timer = 0, next = 0, slot = 0;
const send = m => A?.send({...m, period: 60/S.bpm});

/* ---------- the description: what's wired to what ---------- */
const sends = p => Object.fromEntries([['echo', p.echo], ['room', p.room]].filter(([, d]) => d > OFF));
const level = d => d <= OFF ? -120 : d;
function desc(){ return {sources: {k: {kind: 'kit', kit: S.kit, over: S.over[S.kit] || {}}}, strips: [
  ...ROWS.map(([v]) => { const p = pad(v); return {id: v, input: {src: 'k', pad: v}, chain: p.chain, level: level(p.level), pan: p.pan, mute: p.mute, solo: p.solo, out: p.to === 'bus' ? 'bus' : 'master', sends: sends(p)}; }),
  {id: 'bus', input: null, chain: bus(), level: level(S.busLevel), out: 'master', bypass: S.bypass, match: S.match},
  {id: 'echo', input: null, chain: S.ret.echo.chain, level: level(S.ret.echo.level), out: 'master'},
  {id: 'room', input: null, chain: S.ret.room.chain, level: level(S.ret.room.level), out: 'master'},
  {id: 'master', input: null, chain: MASTER, level: 0, out: null}]}; }
async function start(){ if (A) { if (A.ctx.state !== 'running') await A.ctx.resume(); return; }
  A = await startHost('worklet-src', m => S.m = m); send({type: 'build', ...desc()}); scope($('scope'), A.an, '--accent'); meters(); }

/* ---------- the transport ---------- */
function tick(){ while (next < A.ctx.currentTime + .12) { const b = beat(), st = slot % 32, t = next + (st % 2 ? S.swing*sd() : 0);
    for (const [v] of ROWS) { const c = (b.rows[v] || '')[st]; if (!c || c === '.') continue; const vel = VEL[c] ?? .78;
      send({type: 'hit', src: 'k', voice: v, vel, t, seq: 1}); if (c === 'r') send({type: 'hit', src: 'k', voice: v, vel: vel*.85, t: t + sd()/2, seq: 1}); }
    const when = next, s = st; setTimeout(() => { if (S.playing) { S.step = s; $('pos').textContent = `${Math.floor(s/16) + 1}.${Math.floor(s % 16/4) + 1}`; } }, Math.max(0, (when - A.ctx.currentTime)*1000));
    next += sd(); slot++; } }
async function play(){ await start(); if (S.playing) return stop(); S.playing = true; slot = 0; next = A.ctx.currentTime + .06; tick(); timer = setInterval(tick, 25); paintBar(); }
function stop(){ S.playing = false; clearInterval(timer); send({type: 'stop'}); S.step = -1; $('pos').textContent = '–'; paintBar(); }
async function hit(v, vel = .9){ await start(); send({type: 'hit', src: 'k', voice: v, vel}); }

/* ---------- the mixer: a strip for each pad, then the bus, the returns, the master ---------- */
const NAME = Object.fromEntries(ROWS), used = v => /[^.]/.test(beat().rows[v] || '');
function fader(id, d, on){ const out = h('output', {}, d <= OFF ? '−∞' : (d > 0 ? '+' : '') + (+d).toFixed(1)), r = h('input', {type: 'range', class: 'fader', id: 'f-' + id, min: OFF, max: 6, step: .5, value: d, 'aria-label': 'Level'});
  r.oninput = () => { const x = +r.value; out.textContent = x <= OFF ? '−∞' : (x > 0 ? '+' : '') + x.toFixed(1); on(x); }; r.ondblclick = () => { r.value = 0; r.oninput(); };
  return [h('div', {class: 'fadwrap'}, h('div', {class: 'meter'}, h('i', {'data-meter': id})), r), out]; }
const small = (label, min, max, step, v, on, f) => { const out = h('output', {}, f(v)), r = h('input', {type: 'range', min, max, step, value: v, 'aria-label': label}); r.oninput = () => { out.textContent = f(+r.value); on(+r.value); }; return h('label', {class: 'small'}, h('span', {}, label, ' ', out), r); };
const sendF = d => d <= OFF ? 'off' : (+d).toFixed(0) + ' dB', panF = v => Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100);
function strip(v){ const p = pad(v), set = o => { Object.assign(p, o); save(); };
  return h('div', {class: 'strip', 'data-sel': S.sel === v, 'data-used': used(v)},
    h('button', {class: 'sname', onclick: () => { S.sel = v; K.keep('sel', v); paintMixer(); paintPad(); hit(v); }}, NAME[v]),
    ...fader(v, p.level, x => { set({level: x}); send({type: 'strip', id: v, set: {level: level(x)}}); }),
    small('Pan', -1, 1, .02, p.pan, x => { set({pan: x}); send({type: 'strip', id: v, set: {pan: x}}); }, panF),
    h('div', {class: 'ms'}, h('button', {'aria-pressed': p.mute, title: 'Mute', onclick: () => { set({mute: !p.mute}); send({type: 'strip', id: v, set: {mute: p.mute}}); paintMixer(); }}, 'M'),
      h('button', {'aria-pressed': p.solo, title: 'Solo', onclick: () => { set({solo: !p.solo}); send({type: 'strip', id: v, set: {solo: p.solo}}); paintMixer(); }}, 'S')),
    small('Echo', OFF, 0, 1, p.echo, x => { set({echo: x}); send({type: 'strip', id: v, set: {sends: sends(p)}}); }, sendF),
    small('Room', OFF, 0, 1, p.room, x => { set({room: x}); send({type: 'strip', id: v, set: {sends: sends(p)}}); }, sendF),
    h('button', {class: 'route', 'aria-pressed': p.to === 'bus', title: p.to === 'bus' ? 'Through the bus: click to send it straight to the master' : 'Around the bus: click to send it through the bus',
      onclick: () => { set({to: p.to === 'bus' ? 'master' : 'bus'}); send({type: 'strip', id: v, set: {out: p.to}}); paintMixer(); }}, p.to === 'bus' ? '→ Bus' : '→ Master'),
    p.chain.length ? h('i', {class: 'ins'}, `${p.chain.length} processor${p.chain.length > 1 ? 's' : ''}`) : null); }
function busStrip(id, name, d, on, extra){ return h('div', {class: 'strip bus', 'data-id': id}, h('div', {class: 'sname static'}, name), ...fader(id, d, on), ...(extra || [])); }
function paintMixer(){ $('mixer').replaceChildren(...ROWS.map(([v]) => strip(v)),
  busStrip('bus', 'Bus', S.busLevel, x => { S.busLevel = x; save(); send({type: 'strip', id: 'bus', set: {level: level(x)}}); }, [h('span', {class: 'gr strip-gr', 'data-gr': 'b-glue'}, '')]),
  busStrip('echo', 'Echo', S.ret.echo.level, x => { S.ret.echo.level = x; save(); send({type: 'strip', id: 'echo', set: {level: level(x)}}); }),
  busStrip('room', 'Room', S.ret.room.level, x => { S.ret.room.level = x; save(); send({type: 'strip', id: 'room', set: {level: level(x)}}); }),
  h('div', {class: 'strip bus'}, h('div', {class: 'sname static'}, 'Master'), h('div', {class: 'fadwrap'}, h('div', {class: 'meter tall'}, h('i', {'data-meter': 'master'}))))); }
// the meters: each strip's peak on a scale of -48 to 0 dB, and the compressors' reduction
function meters(){ const m = S.m; for (const e of document.querySelectorAll('[data-meter]')) { const s = m[e.dataset.meter], db = s ? 20*Math.log10(Math.max(1e-6, s.pk)) : -120;
    e.style.height = Math.max(0, Math.min(100, (db + 48)/48*100)) + '%'; e.dataset.hot = db > -1; }
  showGr(m); const r = m.bus?.ratio; $('matched').textContent = S.bypass && S.match && r ? `bus out, turned ${r >= 1 ? 'up' : 'down'} ${Math.abs(20*Math.log10(r)).toFixed(1)} dB to its loudness` : S.bypass ? 'bus out' : 'bus in';
  requestAnimationFrame(meters); }

/* ---------- the bus, the selected pad, the returns ---------- */
function paintBus(){ chainEditor($('busChain'), bus(), (c, what, s, key) => { save();
  if (what === 'param') send({type: 'proc', id: 'bus', pid: s.id, params: {[key]: s.params[key]}}); else if (what === 'on') send({type: 'proc', id: 'bus', pid: s.id, on: s.on !== false}); else send({type: 'chain', id: 'bus', chain: c}); }); }
function paintPad(){ const v = S.sel, P = {...analogParams(S.kit)[v], ...((S.over[S.kit] || {})[v] || {})};
  $('padName').textContent = NAME[v];
  $('voice').replaceChildren(...APARAMS.map(p => control(p, P[p.key] ?? p.def, x => { const o = S.over[S.kit] ||= {}; o[v] = {...o[v], [p.key]: x}; save(); send({type: 'voice', src: 'k', voice: v, key: p.key, v: x}); },
    {reset: analogParams(S.kit)[v][p.key]})));
  chainEditor($('padChain'), pad(v).chain, (c, what, s, key) => { save(); paintMixer();
    if (what === 'param') send({type: 'proc', id: v, pid: s.id, params: {[key]: s.params[key]}}); else if (what === 'on') send({type: 'proc', id: v, pid: s.id, on: s.on !== false}); else send({type: 'chain', id: v, chain: c}); }); }
function paintReturns(){ for (const r of ['echo', 'room']) chainEditor($(r + 'Chain'), S.ret[r].chain, (c, what, s, key) => { save();
  if (what === 'param') send({type: 'proc', id: r, pid: s.id, params: {[key]: s.params[key]}}); else if (what === 'on') send({type: 'proc', id: r, pid: s.id, on: s.on !== false}); else send({type: 'chain', id: r, chain: c}); }); }

/* ---------- the bar: play, tempo, kit, beat, the bus in or out ---------- */
function paintBar(){ $('play').textContent = S.playing ? 'Stop' : 'Play'; $('play').setAttribute('aria-pressed', S.playing); $('bpmOut').textContent = S.bpm;
  $('busIn').setAttribute('aria-pressed', !S.bypass); $('busOut').setAttribute('aria-pressed', S.bypass); $('match').checked = S.match; }
function pickBeat(id){ S.beat = id; K.keep('beat', id); const b = beat(); S.bpm = b.bpm; S.swing = b.swing; $('bpm').value = S.bpm; $('beat').value = id; paintBar(); paintMixer(); }
function pickKit(k){ S.kit = k; K.keep('kit', k); $('kit').value = k; $('kitWords').textContent = ANALOG_KITS[k].words;
  send({type: 'kit', src: 'k', kit: k, over: S.over[k] || {}}); send({type: 'chain', id: 'bus', chain: bus()}); paintBus(); paintPad(); }
function setBypass(b){ S.bypass = b; send({type: 'strip', id: 'bus', set: {bypass: b, match: S.match}}); paintBar(); }
// A/B every two bars: the bus in, then out (at its loudness), so the difference comes round on its own
let ab = 0; function abSwap(){ clearInterval(ab); if (!$('abAuto').checked) return; ab = setInterval(() => { if (S.playing) setBypass(!S.bypass); }, 8*60/S.bpm*1000); }

function copyNotes(){ const b = beat(), on = c => c.map(s => `${s.key}${s.on === false ? ' (off)' : ''} ${JSON.stringify(s.params)}`).join(' → ');
  const txt = `Drum rack notes\n${$('notes').value.trim() || '(no notes)'}\n\nHeard: ${b.name} on ${S.kit}, ${S.bpm} BPM\nBus (${S.busLevel} dB): ${on(bus())}\n` +
    `Pads: ${ROWS.map(([v]) => { const p = pad(v), d = JSON.stringify(PAD()) === JSON.stringify(p) ? null : `${v} ${p.level} dB pan ${panF(p.pan)}${p.mute ? ' muted' : ''}${p.solo ? ' solo' : ''} echo ${sendF(p.echo)} room ${sendF(p.room)} ${p.to === 'bus' ? '' : 'around the bus '}${p.chain.length ? on(p.chain) : ''}`; return d; }).filter(Boolean).join('; ') || 'as they start'}\n` +
    `Echo return: ${on(S.ret.echo.chain)}\nRoom return: ${on(S.ret.room.chain)}\nVoices changed: ${JSON.stringify(S.over)}`;
  copyOut(txt, $('copied'), $('notes')); }

$('play').onclick = play; $('bpm').oninput = e => { S.bpm = +e.target.value; paintBar(); abSwap(); };
$('busIn').onclick = () => setBypass(false); $('busOut').onclick = () => setBypass(true);
$('match').onchange = e => { S.match = e.target.checked; save(); send({type: 'strip', id: 'bus', set: {match: S.match}}); };
$('abAuto').onchange = abSwap;
$('kit').replaceChildren(...ANALOG_NAMES.map(k => h('option', {value: k}, k))); $('kit').onchange = e => pickKit(e.target.value);
$('beat').replaceChildren(...BEATS.map(b => h('option', {value: b.id}, `${b.name} · ${b.bpm}`))); $('beat').onchange = e => pickBeat(e.target.value);
$('busReset').onclick = () => { S.bus[S.kit] = kitBus(S.kit); save(); send({type: 'chain', id: 'bus', chain: bus()}); paintBus(); };
$('padReset').onclick = () => { const o = S.over[S.kit] || {}; delete o[S.sel]; S.pads[S.sel] = PAD(); save(); send({type: 'build', ...desc()}); paintMixer(); paintPad(); };
$('retReset').onclick = () => { S.ret = RET(); save(); send({type: 'build', ...desc()}); paintMixer(); paintReturns(); };
$('allReset').onclick = () => { S.pads = {}; S.bus = {}; S.busLevel = 0; S.ret = RET(); S.over = {}; save(); send({type: 'build', ...desc()}); paintAll(); };
$('notes').value = K.load('notes', ''); $('notes').oninput = e => K.keep('notes', e.target.value); $('copy').onclick = copyNotes;
addEventListener('keydown', e => { if (e.target.matches('input, textarea, select')) return; if (e.code === 'Space') { e.preventDefault(); play(); } if (e.key === 'b') setBypass(!S.bypass); });
function paintAll(){ pickKit(S.kit); pickBeat(S.beat); paintMixer(); paintBus(); paintPad(); paintReturns(); paintBar(); }
paintAll();
window.__rack = {S, desc, get A(){ return A; }, play, stop, pickKit, pickBeat, setBypass, hit, clone};   // (for tests)
