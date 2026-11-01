// The sound lab: a round of analog sounds (sounds.js) to like or not. Each plays alone, in a phrase for its role, or in
// that phrase over a quiet groove, live in the audio thread (lab.worklet.js), at matched loudness (the build measured
// them: __GAINS__). A rating and a note per sound go to the page's database (`ratings`, a document a sound: rating 1
// like, 2 maybe, -1 not for me), where Claude reads them; without a database they stay on this device and can be copied.
import { SOUNDS, GROUPS, ROUND, BPM, BARS, grooveFor } from './sounds.js';
import { $, h } from '../lib/dom.js';

const GAIN = __GAINS__, sd = 60/BPM/4, LEN = BARS*16;
const S = {playing: null, rate: {}, db: null, vol: 1};
const load = (k, d) => { try { const v = localStorage.getItem('soundlab.' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem('soundlab.' + k, JSON.stringify(v)); } catch {} };
let ctx = null, node = null, out = null, timer = 0, next = 0, slot = 0, endAt = 0;

/* ---------- the sound ---------- */
async function start(){ if (ctx) { if (ctx.state !== 'running') await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'interactive'});
  const u = URL.createObjectURL(new Blob([$('worklet-src').textContent], {type: 'text/javascript'})); await ctx.audioWorklet.addModule(u);
  node = new AudioWorkletNode(ctx, 'sound-lab', {numberOfInputs: 0, outputChannelCount: [2]}); out = ctx.createGain(); out.gain.value = S.vol; node.connect(out); out.connect(ctx.destination); }
const send = m => node?.port.postMessage({...m, period: 60/BPM});
const byId = id => SOUNDS.find(s => s.id === id);

// play a sound one of three ways (the same button again stops it)
async function play(id, mode){ const was = S.playing; stop(); if (was && was.id === id && was.mode === mode) return;
  await start(); const s = byId(id);
  if (s.kind === 'synth') send({type: 'synth', params: {...s.patch, period: 60/BPM}, gain: GAIN[id]}); else send({type: 'kit', kit: s.kit, over: s.over, gain: GAIN[id]});
  S.playing = {id, mode}; slot = 0; next = ctx.currentTime + .08; send({type: 'clock', t0: next});
  endAt = mode === 'alone' ? (s.kind === 'synth' ? Math.max(...s.alone.map(x => x.s + x.l)) + 24 : 16) : Infinity;
  tick(); timer = setInterval(tick, 25); paint(); }
function stop(){ if (!S.playing) return; S.playing = null; clearInterval(timer); send({type: 'stop'}); paint(); }
// a 16th at a time, a little ahead on the audio clock
function tick(){ const p = S.playing; if (!p) return; const s = byId(p.id);
  while (next < ctx.currentTime + .12) {
    if (slot >= endAt) { stop(); return; }
    const st = p.mode === 'alone' ? slot : slot % LEN, lap = p.mode === 'alone' ? 0 : Math.floor(slot/LEN);
    const notes = p.mode === 'alone' ? (slot < LEN ? s.alone : []) : s.phrase;
    for (const [i, x] of notes.entries()) { if (Math.floor(x.s) !== st) continue; const t = next + (x.s - st)*sd;
      if (s.kind === 'synth') { const id = `${lap}:${i}`; send({type: 'on', id, n: x.n, vel: x.v, t}); send({type: 'off', id, t: t + x.l*sd}); }
      else send({type: 'hit', v: x.v, vel: x.vel, t}); }
    if (p.mode === 'loop') for (const x of grooveFor(s)) if (x.s === st) send({type: 'hit', groove: 1, v: x.v, vel: x.vel, t: next});
    next += sd; slot++; } }

/* ---------- the ratings: the page's database, or this device ---------- */
const RATES = [[1, 'Like'], [2, 'Maybe'], [-1, 'Not for me']];
function rate(id, patch){ const s = byId(id), r = {...(S.rate[id] || {}), ...patch}; if (r.rating === undefined) r.rating = 0; S.rate[id] = r; keep('rate', S.rate); paintCard(id); count();
  if (S.db) { saying('Saving…'); clearTimeout(rate.t[id]); rate.t[id] = setTimeout(() => S.db.doc('ratings/' + id).set({rating: r.rating, note: r.note || '', name: s.name, kind: s.kind, role: s.role, round: ROUND, at: new Date().toISOString()})
    .then(() => saying('Saved'), e => saying(e?.code === 'not_granted' || e?.code === 'forbidden' ? 'Not saved: this page can only save for its owner' : 'Not saved: try again in a moment')), patch.note !== undefined ? 700 : 0); } }
rate.t = {};
function saying(t){ $('saved').textContent = t; }
async function connect(){ S.rate = load('rate', {}); paintAll();
  let db = null; try { db = await window.claude?.use?.('db'); } catch {}
  if (!db) { saying('Saved on this device. Copy your ratings to send them to Claude.'); $('copy').hidden = false; return; }
  S.db = db; saying('Your ratings save as you go.');
  try { const q = await db.collection('ratings').get(); for (const d of q.docs) { const x = d.data(); if (x) S.rate[d.id] = {rating: x.rating ?? 0, note: x.note || ''}; } keep('rate', S.rate); paintAll(); }
  catch { saying('Couldn\'t load your earlier ratings. New ones still save.'); } }
function copyRatings(){ const lines = SOUNDS.map((s, i) => { const r = S.rate[s.id]; return r?.rating || r?.note ? `${i + 1}. ${s.name} (${s.id}): ${RATES.find(x => x[0] === r.rating)?.[1] || 'unrated'}${r.note ? ' — ' + r.note : ''}` : null; }).filter(Boolean);
  const txt = `Analog sound lab, round ${ROUND}\n${lines.join('\n') || '(nothing rated yet)'}`;
  const done = () => { saying('Copied: paste it to Claude'); };
  try { navigator.clipboard.writeText(txt).then(done, fallback); } catch { fallback(); }
  function fallback(){ $('dump').hidden = false; $('dump').value = txt; $('dump').select(); saying('Selected: copy it with your keyboard'); } }

/* ---------- the page ---------- */
const MODES = [['alone', 'Alone'], ['phrase', 'Phrase'], ['loop', 'In a loop']];
const source = s => s.kind === 'synth' ? 'Analog synth' : s.kit.replace('Analog ', '') + ' kit';
function card(s, i){ const r = S.rate[s.id] || {};
  const note = h('textarea', {id: 'note-' + s.id, rows: 2, placeholder: 'A note, if you like: what works, what doesn\'t'}); note.value = r.note || '';
  note.oninput = () => rate(s.id, {note: note.value});
  return h('article', {class: 'snd', id: 'snd-' + s.id, 'data-rating': r.rating || 0},
    h('div', {class: 'top'}, h('span', {class: 'num'}, String(i + 1).padStart(2, '0')), h('h3', {}, s.name), h('span', {class: 'src'}, source(s))),
    h('p', {}, s.words),
    h('div', {class: 'plays', role: 'group', 'aria-label': 'Play ' + s.name}, ...MODES.map(([m, label]) => h('button', {class: 'play', 'data-mode': m, 'aria-pressed': 'false', onclick: () => play(s.id, m)}, h('span', {class: 'ico', 'aria-hidden': 'true'}), label))),
    h('div', {class: 'rate', role: 'group', 'aria-label': 'Rate ' + s.name}, ...RATES.map(([v, label]) => h('button', {'data-v': v, 'aria-pressed': String(r.rating === v), onclick: () => rate(s.id, {rating: (S.rate[s.id]?.rating === v ? 0 : v)})}, label))),
    note); }
function paintAll(){ let i = 0; $('groups').replaceChildren(...GROUPS.map(([role, title]) => { const list = SOUNDS.filter(s => s.role === role); if (!list.length) return null;
  return h('section', {class: 'group'}, h('h2', {}, title, h('small', {}, ` ${list.length}`)), h('div', {class: 'cards'}, ...list.map(s => card(s, SOUNDS.indexOf(s))))); }).filter(Boolean)); count(); paint(); }
function paintCard(id){ const el = $('snd-' + id), r = S.rate[id] || {}; if (!el) return; el.dataset.rating = r.rating || 0;
  for (const b of el.querySelectorAll('.rate button')) b.setAttribute('aria-pressed', String(+b.dataset.v === r.rating)); }
function paint(){ for (const b of document.querySelectorAll('.play')) { const id = b.closest('.snd').id.slice(4); b.setAttribute('aria-pressed', String(S.playing?.id === id && S.playing.mode === b.dataset.mode)); }
  $('stop').disabled = !S.playing; $('now').textContent = S.playing ? `${byId(S.playing.id).name}, ${MODES.find(m => m[0] === S.playing.mode)[1].toLowerCase()}` : 'Nothing playing'; }
function count(){ const n = SOUNDS.filter(s => S.rate[s.id]?.rating).length, likes = SOUNDS.filter(s => S.rate[s.id]?.rating === 1).length;
  $('count').textContent = `${n} of ${SOUNDS.length} rated`; $('likes').textContent = likes ? `${likes} liked` : ''; $('bar').style.setProperty('--done', n/SOUNDS.length); }

$('stop').onclick = stop; $('copy').onclick = copyRatings;
$('vol').oninput = e => { S.vol = +e.target.value; if (out) out.gain.value = S.vol; };
addEventListener('keydown', e => { if (e.key === 'Escape' || (e.code === 'Space' && !e.target.matches('textarea, input, button'))) { if (S.playing) { e.preventDefault(); stop(); } } });
connect();
window.__soundlab = {S, SOUNDS, GAIN, play, stop, rate, get ctx(){ return ctx; }, get node(){ return node; }, get out(){ return out; }};   // (for tests)
