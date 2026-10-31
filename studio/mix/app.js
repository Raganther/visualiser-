// The mix playground: round 4's songs (Clearing, Two rivers, Undertow) mixed the traditional way, on their own sounds or
// the analog drum machine and analog synth, every sound and every processor native. A channel a
// part (input gain, a cut, an EQ, a compressor, the kick's sidechain on the bass, chords and leads), the drums and the
// music each into a bus, an echo and a room on sends, the master bus. Play it through or from a section, round a
// section, hear Claude's mix or the parts straight (every processor out, at the same loudness), change any of it, and
// copy what you changed for Claude. Built on the parts (studio/lib/parts/): mix.js is the song and the mix.
import { $, h, store, clone, startHost, control, chainEditor, showGr, scope, copyOut } from '../lib/parts/shell.js';
import { PROCS } from '../lib/parts/procs.js';
import { mixOf, eventsOf, SETS, soundOf, chanOf } from './mix.js';
import { fmtDb } from '../lib/names.js';

// the songs (round 4's three, the same parts and sounds), each played on its own sounds or the analog set, each of those
// with its own mix kept apart
const SONGS = JSON.parse($('song').textContent), ALL = store('mixlab.');
let P, SND, BASE, K, BAR;
const S = {straight: false, playing: false, from: 0, t0: 0, m: {}};
function pick(id, set){ ({P, SND} = SONGS.find(x => x.P.song === id) || SONGS.find(x => x.P.song === 'r4-3') || SONGS[0]); S.set = set || ALL.load('set.' + P.song, 'analog');
  BASE = mixOf(P, SND, S.set); K = store('mixlab.' + P.song + '.' + (S.set === 'analog' ? 'analog.' : '')); BAR = 4*60/P.bpm;
  // the mix as you've left it (Claude's, with your changes)
  S.mix = K.load('mix', null) || clone(BASE); S.sel = K.load('sel', 'bass'); S.loop = K.load('loop', false); S.from = 0; ALL.keep('song', P.song); ALL.keep('set.' + P.song, S.set);
  if (!S.mix.strips?.every(s => BASE.strips.some(b => b.id === s.id))) S.mix = clone(BASE); }
pick(ALL.load('song', 'r4-3'));
const by = id => S.mix.strips.find(s => s.id === id), base = id => BASE.strips.find(s => s.id === id);
const shown = () => S.mix.strips.filter(s => s.id !== 'master');
let A = null, timer = 0, queue = [], lap = 0;
const send = m => A?.send(m), save = () => K.keep('mix', S.mix);

/* ---------- the host ---------- */
async function start(){ if (A) { if (A.ctx.state !== 'running') await A.ctx.resume(); return; }
  A = await startHost('worklet-src', m => S.m = m); send({type: 'build', ...S.mix}); applyStraight(); scope($('scope'), A.an, '--accent'); meters(); }
// straight: every channel's and bus's processors out (heard at the loudness they gave it), the sidechain off the room
function applyStraight(){ for (const s of S.mix.strips) { if (s.id === 'master') continue;
    if (s.ret) { for (const c of s.chain) if (c.key === 'sidechain') send({type: 'proc', id: s.id, pid: c.id, on: !S.straight && c.on !== false}); }
    else send({type: 'strip', id: s.id, set: {bypass: S.straight, match: true}}); }
  paintBar(); }

/* ---------- the transport: the song's messages a little ahead, round a section if asked ---------- */
const markAt = bar => P.marks.findLast(m => m.at <= bar) || P.marks[0];
function lapOf(from){ const m = markAt(from), end = S.loop ? m.at + m.bars : P.bars; return {from, end, ev: eventsOf(P, SND, from, S.set).filter(e => e.t < (end - from)*BAR)}; }
async function play(from = S.from){ await start(); if (S.playing) stop(); S.playing = true; S.from = from; lap = 0;
  S.t0 = A.ctx.currentTime + .15; const L = lapOf(from); queue = L.ev.map(e => ({...e, t: e.t + S.t0})); S.end = S.t0 + (L.end - from)*BAR;
  tick(); timer = setInterval(tick, 40); paintBar(); }
function tick(){ const now = A.ctx.currentTime;
  while (queue.length && queue[0].t < now + .5) { const e = queue.shift(); send({...own(e.m), t: e.t, seq: 1}); }
  // round the section again (its first bar's settings set anew), or the end of the song
  if (now > S.end - .6 && S.loop && !S.next) { const m = markAt(S.from), L = lapOf(m.at), t0 = S.end; queue.push(...L.ev.map(e => ({...e, t: e.t + t0}))); S.lapAt = t0; S.next = t0 + (L.end - m.at)*BAR; S.lapFrom = m.at; }
  if (S.next && now >= S.end) { S.t0 = S.lapAt; S.from = S.lapFrom; S.end = S.next; S.next = 0; }
  if (!S.loop && now > S.end + 3) stop();
  paintPos(); }
function stop(){ S.playing = false; clearInterval(timer); queue = []; S.next = 0; send({type: 'stop'}); paintBar(); }
// a section's own sends and tone, over what you've set: its sends moved by as much as the song moves them from where
// they start, your tone kept once you've changed it
function own(m){ if (m.type !== 'strip') return m; const s = by(m.id), b = base(m.id); if (!s || !b) return m; const set = {...m.set};
  if (set.sends) set.sends = Object.fromEntries(Object.entries(set.sends).map(([k, v]) => { const mine = s.sends?.[k] ?? -60, was = b.sends?.[k] ?? -60;
    // (a send the section switches off stays off; one the song started off is yours)
    return [k, mine === was ? v : v <= -59.5 ? -60 : was <= -59.5 ? mine : Math.max(-60, Math.min(0, mine + (v - was)))]; }));
  if ('lp' in set && s.lp !== b.lp) delete set.lp;
  return {...m, set}; }
const posBar = () => S.playing && A ? S.from + Math.max(0, A.ctx.currentTime - S.t0)/BAR : S.from;

/* ---------- the page ---------- */
function paintBar(){ $('play').textContent = S.playing ? 'Stop' : 'Play'; $('play').setAttribute('aria-pressed', S.playing);
  $('hear').replaceChildren(...[[false, 'Claude\'s mix'], [true, 'Straight']].map(([v, name]) => h('button', {'aria-pressed': S.straight === v, onclick: () => { S.straight = v; applyStraight(); }}, name)));
  $('loop').checked = S.loop; $('hearing').textContent = S.straight ? 'Hearing the parts straight: every processor out, at the loudness the mix gives each (the echo and room still on)' : 'Hearing Claude\'s mix'; paintPos(); }
function paintPos(){ const b = posBar(), m = markAt(Math.floor(b)); $('pos').textContent = S.playing ? `${Math.floor(b) + 1}.${Math.floor((b % 1)*4) + 1}` : '–';
  for (const e of document.querySelectorAll('[data-mark]')) e.setAttribute('aria-current', S.playing && e.dataset.mark === m.id); }
function paintMarks(){ $('marks').replaceChildren(...P.marks.map(m => h('button', {class: 'mark', 'data-mark': m.id, onclick: () => play(m.at), title: m.why || ''},
  h('b', {}, m.name), h('span', {}, `bar ${m.at + 1} · ${m.bars} bars`)))); }

// the processors' short names on the desk
const CHIP = {cut: 'Low cut', glue: 'Comp', saturate: 'Sat', sidechain: 'Sidechain', ceiling: 'Ceiling', trim: 'Gain'};
const PAN = {key: 'pan', label: 'Pan', min: -1, max: 1, def: 0, unit: 'pan'};
function paintDesk(){ $('desk').replaceChildren(...shown().map(s => { const set = (k, v) => { s[k] = v; save(); send({type: 'strip', id: s.id, set: {[k]: v}}); paintCopy(); };
  const fader = h('input', {type: 'range', min: -30, max: 10, step: .5, value: s.level ?? 0, 'aria-label': s.label + ' fader'}), fo = h('output', {}, fmtDb(s.level ?? 0) + ' dB');
  fader.oninput = () => { fo.textContent = fmtDb(+fader.value) + ' dB'; set('level', +fader.value); }; fader.ondblclick = () => { fader.value = base(s.id).level; fader.oninput(); };
  const send1 = k => { const r = h('input', {type: 'range', min: -60, max: 0, step: .5, value: s.sends?.[k] ?? -60, 'aria-label': `${s.label} to the ${k}`}), o = h('output', {}, fmtDb(s.sends?.[k] ?? -60));
    r.oninput = () => { o.textContent = fmtDb(+r.value); s.sends = {...s.sends, [k]: +r.value}; save(); send({type: 'strip', id: s.id, set: {sends: s.sends}}); paintCopy(); };
    return h('label', {class: 'snd'}, h('span', {}, k === 'echo' ? 'Echo' : 'Room'), o, r); };
  const procs = s.chain.filter(c => c.key !== 'trim');
  return h('section', {class: 'strip', 'data-kind': s.ret ? 'ret' : s.bus ? 'bus' : 'ch', 'aria-current': S.sel === s.id, 'data-strip': s.id},
    h('button', {class: 'sname', onclick: () => { S.sel = s.id; K.keep('sel', s.id); paintDesk(); paintEdit(); }}, h('b', {}, s.label), s.sound ? h('i', {class: 'snd-name'}, s.sound) : null, h('span', {}, s.out === 'master' ? 'to the out' : `to the ${by(s.out)?.label.toLowerCase() || s.out}`)),
    h('div', {class: 'meter'}, h('i', {'data-meter': s.id})),
    h('div', {class: 'chips'}, ...procs.map(c => h('span', {class: 'chip', 'data-off': c.on === false}, CHIP[c.key] || PROCS[c.key].label, PROCS[c.key].meter ? h('em', {class: 'gr', 'data-gr': c.id}) : null))),
    h('label', {class: 'fdr'}, h('span', {}, 'Fader'), fo, fader),
    s.id === 'bus' ? null : control(PAN, s.pan || 0, v => set('pan', v)),
    s.input ? h('div', {class: 'sends'}, send1('echo'), send1('room')) : null,
    s.input || s.bus ? h('div', {class: 'ms'}, h('button', {class: 'ghost', 'aria-pressed': !!s.mute, onclick: () => { set('mute', !s.mute); paintDesk(); }}, 'Mute'),
      s.input ? h('button', {class: 'ghost', 'aria-pressed': !!s.solo, onclick: () => { set('solo', !s.solo); paintDesk(); }}, 'Solo') : null) : null); })); }
// the strip picked: its processors in order, to change, switch off, move, take out or add to; a part's tone as its song set it
function paintEdit(){ const s = by(S.sel) || by('bass'); $('editName').textContent = s.sound ? `${s.label} · ${s.sound}` : s.label;
  $('editWords').textContent = s.ret ? 'A return: what the channels send it, through its processors, into the master bus.' : s.bus ? (s.id === 'bus' ? 'Everything ends here: a little EQ, a gentle compressor, width, then the ceiling.' : 'A bus: the channels sent to it, compressed together.') :
    `${soundOf(P, SND, P.tracks.findIndex((T, i) => chanOf(P, i) === s.id), S.set).words} Its input gain sets how hard it hits the processors; the fader takes the level back. ${s.role === 'kick' ? 'Its sound after its processors keys the sidechain compressors.' : ''}`;
  $('tone').replaceChildren(...(s.input ? [control({key: 'lp', label: 'The part\'s tone (as the song set it)', min: 300, max: 18000, def: base(s.id).lp, unit: 'Hz', log: true}, s.lp, v => { s.lp = v; save(); send({type: 'strip', id: s.id, set: {lp: v}}); paintCopy(); })] : []));
  chainEditor($('chain'), s.chain, (chain, what, c, k) => { s.chain = chain; save();
    if (what === 'param') send({type: 'proc', id: s.id, pid: c.id, params: {[k]: c.params[k]}}); else if (what === 'on') send({type: 'proc', id: s.id, pid: c.id, on: c.on !== false}); else send({type: 'chain', id: s.id, chain: clone(chain)});
    paintDesk(); paintCopy(); }, {add: Object.keys(PROCS).filter(k => k !== 'duck')}); }
function meters(){ for (const e of document.querySelectorAll('[data-meter]')) { const s = S.m[e.dataset.meter], d = s ? 20*Math.log10(Math.max(1e-6, s.pk)) : -120;
    e.style.width = Math.max(0, Math.min(100, (d + 48)/48*100)) + '%'; e.dataset.hot = d > -1; }
  showGr(S.m); requestAnimationFrame(meters); }
// what you changed, in words, against Claude's mix
function changes(){ const out = [];
  for (const s of S.mix.strips) { const b = base(s.id); if (!b) continue; const d = [];
    for (const k of ['level', 'pan', 'mute', 'solo', 'lp']) if (JSON.stringify(s[k] ?? null) !== JSON.stringify(b[k] ?? null)) d.push(`${k} ${typeof s[k] === 'number' ? (+s[k]).toFixed(2) : s[k]} (was ${typeof b[k] === 'number' ? (+b[k]).toFixed(2) : b[k]})`);
    for (const k of Object.keys({...b.sends, ...s.sends})) if ((s.sends?.[k] ?? -60) !== (b.sends?.[k] ?? -60)) d.push(`${k} send ${s.sends?.[k]} dB (was ${b.sends?.[k] ?? -60})`);
    const ids = c => c.map(x => x.id).join(','); if (ids(s.chain) !== ids(b.chain)) d.push(`processors now ${s.chain.map(c => PROCS[c.key].label + (c.on === false ? ' (off)' : '')).join(' → ')}`);
    for (const c of s.chain) { const o = b.chain.find(x => x.id === c.id); if (!o) continue; if ((c.on !== false) !== (o.on !== false)) d.push(`${PROCS[c.key].label} ${c.on === false ? 'off' : 'on'}`);
      for (const [k, v] of Object.entries(c.params || {})) if (v !== (o.params?.[k] ?? PROCS[c.key].params.find(p => p.key === k)?.def)) d.push(`${PROCS[c.key].label} ${k} ${typeof v === 'number' ? +v.toFixed(3) : v} (was ${o.params?.[k] ?? 'default'})`); }
    if (d.length) out.push(`${s.label}: ${d.join('; ')}`); }
  return out; }
function paintCopy(){ const n = changes().length; $('changed').textContent = n ? `${n} strip${n > 1 ? 's' : ''} changed from Claude's mix` : 'Claude\'s mix as it was'; }
function copyNotes(){ copyOut(`Mix notes: ${P.name} (round ${P.round || 4}), ${SETS.find(x => x[0] === S.set)[1].toLowerCase()}\n${$('notes').value.trim() || '(no notes)'}\n\nChanged from Claude's mix:\n${changes().join('\n') || '(nothing)'}`, $('copied'), $('notes')); }
function reset(){ S.mix = clone(BASE); save(); send({type: 'build', ...S.mix}); applyStraight(); paintDesk(); paintEdit(); paintCopy(); }

// another song: stopped, its own mix built, the page painted for it
function song(id, set){ const was = S.playing, at = Math.floor(posBar()); if (S.playing) stop(); pick(id, set); send({type: 'build', ...S.mix}); if (A) applyStraight(); paintAll();
  // (the sounds swapped while it plays: on from the bar it was at)
  if (was && set) play(at); }
function paintAll(){ $('title').textContent = P.name; $('notes').value = K.load('notes', ''); $('songs').replaceChildren(...SONGS.map(x => h('button', {'aria-pressed': x.P.song === P.song, onclick: () => song(x.P.song)}, x.P.name)));
  $('sets').replaceChildren(...SETS.map(([k, name]) => h('button', {'aria-pressed': S.set === k, onclick: () => song(P.song, k)}, name)));
  paintMarks(); paintBar(); paintDesk(); paintEdit(); paintCopy(); }
$('play').onclick = () => S.playing ? stop() : play(S.from);
$('loop').onchange = e => { S.loop = e.target.checked; K.keep('loop', S.loop); if (S.playing) play(Math.floor(posBar())); };
$('reset').onclick = reset; $('copy').onclick = copyNotes; $('notes').oninput = e => K.keep('notes', e.target.value);
addEventListener('keydown', e => { if (e.target.matches('input, textarea, select')) return; if (e.code === 'Space') { e.preventDefault(); S.playing ? stop() : play(S.from); }
  if (e.key === 'b' || e.key === 'B') { S.straight = !S.straight; applyStraight(); } });
paintAll();
window.__mix = {S, get P(){ return P; }, get BASE(){ return BASE; }, song, own, by, get A(){ return A; }, play, stop, applyStraight, reset, changes};   // (for tests)
