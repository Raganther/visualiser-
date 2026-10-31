// The ducking playground: one part making room for another, two ways side by side. The sidechain compressor listens to
// the kick (or the lead) and reacts once it hears it; the ducker reads the score, so it knows each hit and note before it
// sounds and can move ahead of it, follow the beat and the velocity. Pairs (kick → bass, lead → pad, kick → pad), each
// switched on or off, each with both ways' settings and a drawing of what each does to the gain over a bar; the whole
// lot off, the compressor, or the notes, swapped every two bars if you like. Built on the parts (studio/lib/parts/).
import { $, h, store, startHost, control, showGr, scope, copyOut } from '../lib/parts/shell.js';
import { PROCS } from '../lib/parts/procs.js';
import { offline } from '../lib/parts/host.js';
import { ANALOG_KITS, busChain } from '../lib/native/analogkit.js';
import { VOICES } from '../../src/audio/engine/inst/drums.js';
import { GROOVES, PAIRS } from './grooves.js';

const K = store('ducklab.'), MODES = [['off', 'Off'], ['comp', 'Sidechain compressor'], ['notes', 'From the notes']];
const S = {groove: K.load('groove', 'held'), mode: K.load('mode', 'notes'), swap: false, on: K.load('on', {}), set: K.load('set', {}), lv: K.load('lv', {drums: 0, bass: 0, pad: 0, lead: 0}),
  mute: {}, bpm: 120, playing: false, m: {}};
const G = () => GROOVES.find(g => g.id === S.groove) || GROOVES[0], sd = () => 60/S.bpm/4;
const on = p => S.on[S.groove + p.id] ?? !!G().pairs[p.id];
// a pair's settings for each way: the pair's own over the processor's defaults, then yours
const conf = (p, way) => ({...(way === 'comp' ? p.comp : p.notes), ...(S.set[p.id + way] || {})});
const save = () => { K.keep('on', S.on); K.keep('set', S.set); K.keep('lv', S.lv); K.keep('mode', S.mode); };
let A = null, timer = 0, next = 0, slot = 0, trace = 0;
const send = m => A?.send({...m, period: 60/S.bpm});

/* ---------- the description: the kit's pads into its bus, the kick on its own strip (the compressors' key); the bass,
   pad and lead each a synth, their duckers (both ways) on their strips, switched by the mode ---------- */
const procOn = (p, way) => on(p) && S.mode === way;
function chains(){ const c = {bass: [], pad: [], lead: []};
  for (const p of PAIRS) c[p.target].push({id: p.id + '-c', key: 'sidechain', params: {...conf(p, 'comp'), key: p.key}, on: procOn(p, 'comp')}, {id: p.id + '-n', key: 'duck', params: {...conf(p, 'notes'), from: p.from}, on: procOn(p, 'notes')});
  return c; }
const lv = k => S.mute[k] ? -120 : S.lv[k] ?? 0;
function desc(){ const g = G(), c = chains(); return {period: 60/S.bpm, sources: {k: {kind: 'kit', kit: g.kit}, b: {kind: 'synth', params: g.bass.patch}, p: {kind: 'synth', params: g.pad.patch}, l: {kind: 'synth', params: g.lead.patch}},
  strips: [...VOICES.map(v => ({id: v.key, input: {src: 'k', pad: v.key}, chain: [], out: 'drums'})),
    {id: 'drums', input: null, chain: busChain(ANALOG_KITS[g.kit].bus).map((s, i) => ({...s, id: 'd' + i})), level: lv('drums'), out: 'master'},
    {id: 'bass', input: {src: 'b'}, chain: c.bass, level: lv('bass'), out: 'master'}, {id: 'pad', input: {src: 'p'}, chain: c.pad, level: lv('pad'), out: 'master'},
    {id: 'lead', input: {src: 'l'}, chain: c.lead, level: lv('lead'), out: 'master'},
    {id: 'master', input: null, chain: [{id: 'mg', key: 'glue', params: {thr: -10, ratio: 2, att: 10, rel: 150, makeup: 1}}, {id: 'mc', key: 'ceiling', params: {knee: .92}}], out: null}]}; }
async function start(){ if (A) { if (A.ctx.state !== 'running') await A.ctx.resume(); return; }
  A = await startHost('worklet-src', m => S.m = m); send({type: 'build', ...desc()}); scope($('scope'), A.an, '--accent'); meters(); }
// the mode (or a pair switched): every ducker on or off at once, nothing rebuilt
function applyMode(){ for (const p of PAIRS) for (const way of ['comp', 'notes']) send({type: 'proc', id: p.target, pid: p.id + (way === 'comp' ? '-c' : '-n'), on: procOn(p, way)}); paintBar(); }

/* ---------- the events: the drums and the three parts, a 16th at a time, round the four bars ---------- */
function events(from, to, at, lap){ const g = G(), out = [], len = 64;
  for (let s = from; s < to; s++) { const st = s % len, t = at + (s - from)*sd();
    for (const [v, row] of Object.entries(g.drums)) { const c = row[st % 16]; if (c && c !== '.') out.push({type: 'hit', src: 'k', voice: v, vel: c === 'X' ? 1 : c === 'o' ? .45 : .8, t, seq: 1}); }
    for (const [src, part] of [['b', g.bass], ['p', g.pad], ['l', g.lead]]) part.notes.forEach((x, i) => { if (Math.floor(x.s) !== st) return; const id = `${src}${lap(s)}:${i}`, t0 = t + (x.s - st)*sd();
      out.push({type: 'on', src, id, n: x.n, vel: x.v, t: t0, seq: 1}, {type: 'off', src, id, t: t0 + x.l*sd(), seq: 1}); }); }
  return out; }
function tick(){ while (next < A.ctx.currentTime + .15) { const s = slot;
    for (const e of events(s, s + 1, next, x => Math.floor(x/64))) send(e);
    // swapping every two bars: the compressor, then the notes
    if (S.swap && s % 32 === 0 && s > 0) { S.mode = S.mode === 'comp' ? 'notes' : 'comp'; const when = next; setTimeout(applyMode, Math.max(0, (when - A.ctx.currentTime)*1000 - 20)); }
    const when = next; setTimeout(() => { if (S.playing) { S.step = s % 64; $('pos').textContent = `${Math.floor(S.step/16) + 1}.${Math.floor(S.step % 16/4) + 1}`; } }, Math.max(0, (when - A.ctx.currentTime)*1000));
    next += sd(); slot++; } }
async function play(){ await start(); if (S.playing) return stop(); S.playing = true; slot = 0; next = A.ctx.currentTime + .08; tick(); timer = setInterval(tick, 25); paintBar(); }
function stop(){ S.playing = false; clearInterval(timer); send({type: 'stop'}); $('pos').textContent = '–'; paintBar(); }

/* ---------- what each does to the gain: a bar rendered here, offline, each ducker's trace drawn over the key ---------- */
function traces(){ clearTimeout(trace); trace = setTimeout(() => { const sr = 24000, g = G(), bar = 16*sd(), D = desc();
    // (both ways on, each traced: neither listens to the part it turns down, so each trace is its own)
    for (const s of D.strips) for (const c of s.chain) if (/-(c|n)$/.test(c.id)) c.on = true;
    const ev = events(0, 18, 0, () => 0), r = offline(sr, D, ev, bar + .05, H => { for (const p of PAIRS) for (const w of ['c', 'n']) { const x = H.by[p.target].chain.find(p.id + '-' + w); if (x) x.trace = []; } });
    for (const p of PAIRS) { const c = $('tr-' + p.id); if (!c) continue; const tc = r.H.by[p.target].chain.find(p.id + '-c').trace, tn = r.H.by[p.target].chain.find(p.id + '-n').trace;
      const w = c.width = c.clientWidth*devicePixelRatio, hh = c.height = c.clientHeight*devicePixelRatio, x = c.getContext('2d'), css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const n = Math.round(bar*sr), Y = gain => 6 + (hh - 12)*Math.min(1, -20*Math.log10(Math.max(1e-4, gain))/24), X = t => t/bar*w;
      x.clearRect(0, 0, w, hh); x.fillStyle = css('--line'); x.font = `${10*devicePixelRatio}px ${css('--mono')}`;
      for (const db of [0, -6, -12, -18, -24]) { const y = Y(Math.pow(10, db/20)); x.globalAlpha = .5; x.fillRect(0, y, w, 1); x.globalAlpha = 1; x.fillText(db + ' dB', 4, y - 2); }
      // the key: the kick's hits as ticks, or the lead's notes as bars along the top
      x.fillStyle = css('--key'); const [src, voice] = p.from.split(':');
      for (const e of ev) if (e.src === src && e.t < bar) { if (voice && e.type === 'hit' && e.voice === voice) x.fillRect(X(e.t) - 1, 0, 3*devicePixelRatio, hh);
        else if (!voice && e.type === 'on') { const off = ev.find(f => f.type === 'off' && f.id === e.id); x.globalAlpha = .35; x.fillRect(X(e.t), 0, X(Math.min(bar, off.t)) - X(e.t), 5*devicePixelRatio); x.globalAlpha = 1; } }
      for (const [tr, col, dash] of [[tc, '--comp', [6, 4]], [tn, '--accent', []]]) { x.strokeStyle = css(col); x.lineWidth = 2*devicePixelRatio; x.setLineDash(dash.map(d => d*devicePixelRatio)); x.beginPath();
        for (let i = 0; i < n; i += 8) { const px = X(i/sr), py = Y(tr[i] ?? 1); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
      x.setLineDash([]); } }, 250); }

/* ---------- the page ---------- */
function paintBar(){ $('play').textContent = S.playing ? 'Stop' : 'Play'; $('play').setAttribute('aria-pressed', S.playing); $('bpmOut').textContent = S.bpm;
  $('mode').replaceChildren(...MODES.map(([k, name]) => h('button', {'aria-pressed': S.mode === k, onclick: () => { S.mode = k; save(); applyMode(); }}, name))); $('swap').checked = S.swap;
  $('hearing').textContent = S.mode === 'off' ? 'Hearing: no ducking' : `Hearing: ${S.mode === 'comp' ? 'the sidechain compressor' : 'the ducker that reads the notes'}${S.swap ? ' (swapping every 2 bars)' : ''}`; }
function paintGrooves(){ $('grooves').replaceChildren(...GROOVES.map(g => h('button', {class: 'card', 'aria-pressed': S.groove === g.id, onclick: () => pickGroove(g.id)}, h('b', {}, g.name), h('span', {}, `${g.style} · ${g.bpm} BPM`), h('span', {}, g.words)))); }
function pickGroove(id){ const was = S.playing; if (was) stop(); S.groove = id; K.keep('groove', id); S.bpm = G().bpm; $('bpm').value = S.bpm; send({type: 'build', ...desc()}); paintAll(); if (was) setTimeout(play, 50); }
function paintPairs(){ $('pairs').replaceChildren(...PAIRS.map(p => { const set = (way, k, x) => { (S.set[p.id + way] ||= {})[k] = x; save(); send({type: 'proc', id: p.target, pid: p.id + (way === 'comp' ? '-c' : '-n'), params: {[k]: x}}); traces(); };
  const col = (way, title, words) => h('div', {class: 'way', 'data-way': way}, h('h3', {}, title, h('span', {class: 'gr', 'data-gr': p.id + (way === 'comp' ? '-c' : '-n')})), h('p', {class: 'pwords'}, words),
    ...PROCS[way === 'comp' ? 'sidechain' : 'duck'].params.map(q => control(q, conf(p, way)[q.key] ?? q.def, x => set(way, q.key, x), {reset: (way === 'comp' ? p.comp : p.notes)[q.key]})));
  return h('section', {class: 'pair', 'data-on': on(p)}, h('div', {class: 'pairhead'}, h('label', {class: 'check'}, h('input', {type: 'checkbox', checked: on(p), onchange: e => { S.on[S.groove + p.id] = e.target.checked; save(); applyMode(); paintPairs(); }}), h('b', {}, p.name)),
      h('span', {class: 'legend'}, p.words), h('button', {class: 'ghost', onclick: () => { delete S.set[p.id + 'comp']; delete S.set[p.id + 'notes']; save(); send({type: 'build', ...desc()}); paintPairs(); }}, 'Reset')),
    h('canvas', {class: 'trace', id: 'tr-' + p.id, 'aria-label': `What each way does to the ${p.target}'s level over a bar`}),
    h('div', {class: 'legend keyline'}, h('i', {class: 'sw comp'}), 'Sidechain compressor ', h('i', {class: 'sw notes'}), 'From the notes ', h('i', {class: 'sw key'}), p.key === 'kick' ? 'the kicks' : 'the lead\'s notes'),
    h('div', {class: 'ways'}, col('comp', 'Sidechain compressor', 'Hears the key, then reacts: its attack decides how late the dip comes.'), col('notes', 'From the notes', 'Reads the score: the dip starts Ahead of the hit and comes back over part of a beat.'))); }));
  traces(); }
function paintMix(){ $('mix').replaceChildren(...['drums', 'bass', 'pad', 'lead'].map(k => { const out = h('output', {}, (S.lv[k] > 0 ? '+' : '') + (S.lv[k] ?? 0).toFixed(1) + ' dB'), r = h('input', {type: 'range', min: -24, max: 6, step: .5, value: S.lv[k] ?? 0, 'aria-label': k + ' level'});
  r.oninput = () => { S.lv[k] = +r.value; out.textContent = (S.lv[k] > 0 ? '+' : '') + S.lv[k].toFixed(1) + ' dB'; save(); send({type: 'strip', id: k, set: {level: lv(k)}}); };
  return h('div', {class: 'chan'}, h('b', {}, k[0].toUpperCase() + k.slice(1)), h('div', {class: 'meter'}, h('i', {'data-meter': k})), r, out,
    h('button', {class: 'ghost', 'aria-pressed': !!S.mute[k], onclick: e => { S.mute[k] = !S.mute[k]; e.target.setAttribute('aria-pressed', S.mute[k]); send({type: 'strip', id: k, set: {level: lv(k)}}); }}, 'Mute')); })); }
function meters(){ for (const e of document.querySelectorAll('[data-meter]')) { const s = S.m[e.dataset.meter], db = s ? 20*Math.log10(Math.max(1e-6, s.pk)) : -120; e.style.width = Math.max(0, Math.min(100, (db + 48)/48*100)) + '%'; }
  showGr(S.m); requestAnimationFrame(meters); }
function copyNotes(){ const g = G(), txt = `Ducking notes\n${$('notes').value.trim() || '(no notes)'}\n\nHeard: ${g.name}, ${S.bpm} BPM, ${MODES.find(m => m[0] === S.mode)[1]}${S.swap ? ', swapping every 2 bars' : ''}\n` +
  PAIRS.map(p => `${p.name} ${on(p) ? 'on' : 'off'}: compressor ${JSON.stringify(conf(p, 'comp'))}; notes ${JSON.stringify(conf(p, 'notes'))}`).join('\n') + `\nLevels: ${JSON.stringify(S.lv)}`;
  copyOut(txt, $('copied'), $('notes')); }
function paintAll(){ paintGrooves(); paintBar(); paintPairs(); paintMix(); }

$('play').onclick = play; $('bpm').oninput = e => { S.bpm = +e.target.value; send({type: 'build', ...desc()}); paintBar(); traces(); };
$('swap').onchange = e => { S.swap = e.target.checked; paintBar(); };
$('notes').value = K.load('notes', ''); $('notes').oninput = e => K.keep('notes', e.target.value); $('copy').onclick = copyNotes;
addEventListener('keydown', e => { if (e.target.matches('input, textarea, select')) return; if (e.code === 'Space') { e.preventDefault(); play(); }
  const k = {'0': 'off', '1': 'comp', '2': 'notes'}[e.key]; if (k) { S.mode = k; save(); applyMode(); } });
addEventListener('resize', traces);
S.bpm = G().bpm; $('bpm').value = S.bpm; paintAll();
window.__duck = {S, G, desc, get A(){ return A; }, play, stop, pickGroove, applyMode, PAIRS};   // (for tests)
