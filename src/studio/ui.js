// The Studio page: play a song (its arrangement, or scenes and clips launched by hand), see its tracks, clips and mixer
// (meters, the compressors' and sidechains' gain reduction), mute, solo and tweak, edit clips (a step sequencer or a piano
// roll), render it offline to measure and save it, and read or paste the song as data. Every tweak and edit is written
// into the song, so what's heard is what's copied out.
import { SONGS } from './songs/index.js';
import { makePlayer, renderSong, prepare } from './engine.js';
import { arrangement, check, forget, hitRow, noteName, noteNum, readClip, stripsOf } from './song.js';
import { instrument, EFFECTS } from '../audio/engine/registry.js';
import { note as busNote } from '../audio/engine/events.js';
import { report, paint, gonio, compare, matchEq, advise } from './measure.js';
import { clashes } from './clash.js';
import { wav } from './wav.js';
import { zip } from './zip.js';
import { knob } from '../ui/widgets.js';
import { TUNE } from '../tuning.js';
import { blankSong } from './songs/blank.js';
import { mountPlay } from './play.js';
import * as LIB from './library.js';
import * as SAVE from './saved.js';
import { STYLES, makeDrums, makeBass, makeChords, makeHook, grooveOf, vary } from './improv.js';

const $ = id => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const HUE = i => `hsl(${(195 + i*47) % 360} 70% 60%)`;
const fmtDb = v => (v <= -40 ? '−∞' : (v > 0 ? '+' : '') + v.toFixed(1));
const fmtHz = v => v >= 1000 ? (v/1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Math.round(v) + '';
const BLACK = n => [1, 3, 6, 8, 10].includes(((n % 12) + 12) % 12);

let ctx = null, player = null, song = null, idx = 0, sel = null, selClip = null, rendered = null, specAn = null, dataStale = false;
const open = new Set();        // racks whose pads show in the mixer
const view = {d: 'steps', n: 'roll'};   // how clips are edited: drums and notes, each 'steps' or 'roll'
const range = {};              // each note clip's pitch range in the editors (kept while editing, so the grid doesn't jump)
const pristine = SONGS.map(s => structuredClone(s));
const songs = SONGS.map(s => structuredClone(s));
// each song's id in the store of saved songs (a built-in's from its title; one the user started, its own), and which are theirs
const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ids = SONGS.map(s => slug(s.title)), mine = SONGS.map(() => false);
const myId = () => 'my-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const audio = () => { if (!ctx) ctx = new AudioContext({latencyHint: TUNE.studio.latency}); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
const trackOf = id => song.tracks.find(t => t.id === id);
// a strip's track (a pad's is its rack) and, for a pad, which
const ownerOf = id => { const [t, k] = String(id).split(':'); const T = trackOf(t); return {T, k: k && T && T.pads && T.pads[k] ? k : null}; };

/* ---------- a song in ---------- */
function load(i){
  if (player) { player.dispose(); player = null; }
  idx = i; song = songs[i]; sel = song.tracks[0].id; selClip = null; rendered = null;
  [...$('songs').children].forEach((b, k) => b.setAttribute('aria-current', k === i));
  $('tempo').textContent = `${song.bpm} BPM · ${song.key || ''}`;
  const A = arrangement(song), secs = A.bars*240/song.bpm;
  $('about').innerHTML = `<b>${esc(song.title)}</b>: ${song.tracks.length} tracks, ${song.scenes.length} scenes, ${A.bars} bars (${Math.floor(secs/60)}:${String(Math.round(secs % 60)).padStart(2, '0')}). ` +
    `Press Play for the arrangement, or click clips and scenes in the session to launch them on the next bar.`;
  $('rep').innerHTML = ''; $('save').hidden = true; $('gram').hidden = true; $('clashRep').innerHTML = ''; showRef();
  showSaved();
  drawArr(); drawSession(); if (ctx) build(); drawMixer(); drawDetail(); showData();
}
// the graph, on the page's audio context (made on the first click: browsers start sound only from one)
// (async: the Moog's worklet is loaded onto the context first; a second call while it loads gets the same player)
let building = null;
function build(){
  if (player) return Promise.resolve(player);
  return building = building || (async () => {
    const c = audio(); await prepare(c);
    const s0 = song;
    if (!player && s0 === song) {
      player = makePlayer(c, song, {onNote: e => busNote({t: e.t, src: 'studio', ch: e.voice || e.track, note: typeof e.note === 'number' ? e.note : 36, vel: e.vel, len: e.len}), onBuild: hook});
      drawDetail();
    }
    building = null; return player;
  })();
}

// the spectrum and the goniometer listen to the master; hung on again each time the graph is built
let gonA = null, gonSp = null;
function hook(E){
  if (!specAn) { specAn = ctx.createAnalyser(); specAn.fftSize = 4096; specAn.smoothingTimeConstant = .8;
    gonSp = ctx.createChannelSplitter(2); gonA = [0, 1].map(i => { const a = ctx.createAnalyser(); a.fftSize = 2048; gonSp.connect(a, i); a.buf = new Float32Array(2048); return a; }); }
  const out = E.desk.strips.get('master').out; out.connect(specAn); out.connect(gonSp);
}

/* ---------- arrangement ---------- */
function drawArr(){
  const A = arrangement(song), a = $('arr'); a.querySelectorAll('.part').forEach(p => p.remove());
  for (const p of A.parts) { const d = h('div', 'part', `<b>${esc(p.scene)}</b>${p.bars} bars`); d.style.width = (p.bars/A.bars*100) + '%'; d.dataset.at = p.at; d.dataset.bars = p.bars; d.title = `Play from bar ${p.at + 1}`; a.insertBefore(d, $('head')); }
}
$('arr').addEventListener('click', e => {
  const A = arrangement(song), r = $('arr').getBoundingClientRect(), bar = Math.floor((e.clientX - r.left)/r.width*A.bars);
  const p = A.parts.find(x => bar >= x.at && bar < x.at + x.bars); build().then(pl => { pl.play({bar: e.target.closest('.part') ? p.at : bar}); setPlay(); });
});

/* ---------- session: a click launches a clip (or a scene) on the next bar ---------- */
function drawSession(){
  const t = $('ses'); t.innerHTML = ''; t.style.setProperty('--cols', song.tracks.length);
  const hd = h('thead'), tr = h('tr'); tr.appendChild(h('th', 'scene', 'Scene'));
  song.tracks.forEach((x, i) => { const th = h('th', null, esc(x.name || x.id)); th.style.setProperty('--tc', HUE(i)); tr.appendChild(th); }); hd.appendChild(tr); t.appendChild(hd);
  const tb = h('tbody');
  for (const sc of song.scenes) {
    const r = h('tr'), th = h('th', 'scene'), b = h('button', null, '▶ ' + esc(sc.id)); b.dataset.scene = sc.id; b.title = `Launch the scene ${sc.id} on the next bar`;
    b.onclick = () => build().then(pl => { pl.launch(sc.id); setPlay(); });
    th.appendChild(b); r.appendChild(th);
    song.tracks.forEach((x, i) => { const td = h('td'), c = (sc.clips || {})[x.id];
      if (c) { const cb = h('button', 'clip', `<span class="tri">▶</span>${esc(c)}`); cb.style.setProperty('--tc', HUE(i)); cb.dataset.track = x.id; cb.dataset.clip = c; cb.dataset.row = sc.id;
        cb.title = `${x.name || x.id}: launch clip ${c} on the next bar (and edit it below)`;
        cb.onclick = () => { sel = x.id; selClip = c; drawDetail(); markSel(); build().then(pl => { pl.launchClip(x.id, c, sc.id); setPlay(); }); };
        td.appendChild(cb); }
      r.appendChild(td); });
    tb.appendChild(r);
  }
  // a stop for each track
  const sr = h('tr', 'stops'); sr.appendChild(h('th', 'scene', '<span class="dim">Stop</span>'));
  song.tracks.forEach(x => { const td = h('td'), b = h('button', 'stop', '■'); b.title = `Stop ${x.name || x.id} at the next bar`; b.setAttribute('aria-label', b.title);
    b.onclick = () => { if (player && player.playing) player.launchClip(x.id, null); }; td.appendChild(b); sr.appendChild(td); });
  tb.appendChild(sr);
  t.appendChild(tb);
}

/* ---------- the mixer ---------- */
const DEV = {eq: 'EQ', comp: 'Comp', sc: 'SC', limiter: 'Lim', gain: 'Gain', mono: 'Mono', multiband: 'MB', dyneq: 'DynEQ', transient: 'Trans', mseq: 'M/S', tape: 'Tape', console: 'Cons',
  reverb: 'Verb', delay: 'Delay', width: 'Width', filter: 'Filt', drive: 'Drive', autopan: 'Pan'};
// the mixer's own devices as the page adds them (a registry effect comes in at its defaults)
const NEW_DEV = {
  eq: {type: 'eq', bands: [{type: 'hp', f: 30, slope: 24}, {type: 'bell', f: 300, q: 1, g: 0}, {type: 'bell', f: 2500, q: 1, g: 0}, {type: 'hs', f: 9000, g: 0}]},
  dyneq: {type: 'dyneq', bands: [{type: 'bell', f: 250, q: 1.4, thr: -30, range: -6, ratio: 3}, {type: 'bell', f: 3500, q: 2, thr: -30, range: -4, ratio: 3}]},
  mseq: {type: 'mseq', side: 0, bands: [{type: 'hp', f: 150, slope: 24, ch: 'side'}, {type: 'hs', f: 8000, g: 0, ch: 'side'}, {type: 'bell', f: 300, q: 1, g: 0, ch: 'mid'}]},
  comp: {type: 'comp', thr: -18, ratio: 3, att: .01, rel: .15, gain: 0, mix: 1},
  multiband: {type: 'multiband', lo: 200, hi: 2500, att: .01, rel: .15, mix: 1, bands: [0, 1, 2].map(() => ({thr: -18, ratio: 2, gain: 0, drive: 0}))},
  transient: {type: 'transient', attack: 0, sustain: 0},
  tape: {type: 'tape', drive: 6, bump: 1.5, hf: 15000, bias: .2},
  console: {type: 'console', drive: 3},
  limiter: {type: 'limiter', gain: 0, ceil: -.3}, mono: {type: 'mono', f: 120}, gain: {type: 'gain', db: 0}};
const TITLE = {eq: 'EQ', comp: 'Compressor', limiter: 'Limiter', multiband: 'Multiband', dyneq: 'Dynamic EQ', transient: 'Transient shaper', mseq: 'Mid/side EQ', tape: 'Tape', console: 'Console', mono: 'Mono bass', gain: 'Gain'};
const ADD = [['eq', 'EQ'], ['dyneq', 'Dynamic EQ'], ['mseq', 'Mid/side EQ'], ['comp', 'Compressor'], ['multiband', 'Multiband compressor'], ['transient', 'Transient shaper'],
  ['tape', 'Tape'], ['console', 'Console'], ['limiter', 'Limiter'], ['mono', 'Mono bass']];
// where a strip's settings live in the song, and its chain of devices
const mixOf = id => { const {T, k} = ownerOf(id); if (k) return T.pads[k].mix = T.pads[k].mix || {}; if (T) return T.mix = T.mix || {};
  return id === 'master' ? (song.master = song.master || {}) : [...(song.groups || []), ...(song.returns || [])].find(x => x.id === id); };
const chainOf = id => { const m = mixOf(id); return m.chain = m.chain || []; };
// a chain changed: the graph is built again (playing on), and the page redrawn
function rechained(){ dataStale = true; if (player) { const was = player.playing; player.rebuild(); if (!was) player.stop(); } drawMixer(); drawDetail(); markSel(); }
function drawMixer(){
  const m = $('mixer'); m.innerHTML = '';
  stripsOf(song).filter(d => d.kind !== 'pad' || open.has(d.rack)).forEach(d => {
    const {T} = ownerOf(d.id), ti = song.tracks.indexOf(T), s = h('div', `strip kind-${d.kind}` + (d.id === sel ? ' sel' : ''));
    s.dataset.id = d.id; if (ti >= 0) s.style.setProperty('--tc', HUE(ti));
    const label = d.kind === 'pad' ? padLabel(T, d.pad) : d.name || d.id, nm = h('button', 'nm', esc(label)); nm.title = `Open ${label}`; nm.onclick = () => { sel = d.id; selClip = null; drawDetail(); markSel(); };
    // (each chip a fixed size, its reduction in a fixed slot: nothing moves while it plays)
    const chips = h('div', 'chips'); (d.chain || []).slice(0, 4).forEach((x, k) => { const c = h('span', 'chip', `<b>${DEV[x.type] || x.type.slice(0, 5)}</b><i></i>`); c.dataset.k = k; chips.appendChild(c); });
    const ff = h('div', 'ff'), cv = h('canvas', 'met'); cv.width = 14; cv.height = 150;
    const f = h('input', 'fader'); Object.assign(f, {type: 'range', min: -40, max: 6, step: .5, value: d.vol || 0}); f.setAttribute('aria-label', `${d.name || d.id} volume`);
    const db = h('div', 'db', fmtDb(d.vol || 0));
    f.oninput = () => { setVal(`${d.id}.vol`, +f.value); db.textContent = fmtDb(+f.value); };
    f.ondblclick = () => { f.value = 0; f.oninput(); };
    ff.append(cv, f);
    const pan = knob('Pan', -1, 1, 0, v => Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100), v => setVal(`${d.id}.pan`, v), d.pan || 0);
    const ms = h('div', 'ms');
    if (d.kind !== 'return' && d.kind !== 'master') for (const k of ['mute', 'solo']) { const b = h('button', k[0], k[0].toUpperCase()); b.setAttribute('aria-pressed', !!d[k]); b.title = k[0].toUpperCase() + k.slice(1);
      b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', v); setVal(`${d.id}.${k}`, v); }; ms.appendChild(b); }
    if (T && T.pads && d.kind === 'track') { const b = h('button', 'pads', open.has(T.id) ? '◂' : '▸'); b.title = `${open.has(T.id) ? 'Hide' : 'Show'} the rack's ${Object.keys(T.pads).length} pads`; b.setAttribute('aria-pressed', open.has(T.id));
      b.onclick = () => { open.has(T.id) ? open.delete(T.id) : open.add(T.id); drawMixer(); }; ms.appendChild(b); }
    s.append(nm, chips, ff, db, pan, ms); m.appendChild(s);
    s._met = cv; s._chips = chips;
  });
}
const markSel = () => { document.querySelectorAll('.strip').forEach(s => s.classList.toggle('sel', s.dataset.id === sel)); const {T} = ownerOf(sel); document.querySelectorAll('.ses .clip').forEach(b => b.classList.toggle('sel', T && b.dataset.track === T.id && b.dataset.clip === selClip)); };
// a change: into the song (and heard, when it's playing)
function setVal(path, v){
  const [id, ...r] = path.split('.'), k = r.join('.');
  if (player) player.E.set(path, v);
  else { // (not playing yet: the song itself)
    const {T, k: pk} = ownerOf(id), d = pk ? (T.pads[pk].mix = T.pads[pk].mix || {}) : T ? (T.mix = T.mix || {}) : id === 'master' ? song.master : [...(song.groups || []), ...(song.returns || [])].find(x => x.id === id);
    if (T && !pk && r[0] === 'inst') { const pad = T.pads && T.pads[r[1]];
      if (pad) (pad.voice = pad.voice || {})[r[2]] = v; else if (T.inst.type === 'drums') { const vo = T.inst.voices = T.inst.voices || {}; (vo[r[1]] = vo[r[1]] || {})[r[2]] = v; } else (T.inst.p = T.inst.p || {})[r.slice(1).join('.')] = v; }
    else if (['vol', 'pan', 'mute', 'solo'].includes(k)) d[k] = v;
    else if (r[0] === 'send') (d.sends = d.sends || {})[r[1]] = v;
    else { const dv = (d.chain || [])[+r[0]]; if (dv) { const q = r.slice(1); if (dv.bands && q.length === 2) dv.bands[+q[0]][q[1]] = v; else if (DEV[dv.type] && !EFFECTS.some(e => e.key === dv.type && !['eq', 'comp'].includes(e.key))) dv[q[0]] = v; else (dv.p = dv.p || {})[q[0]] = v; } }
  }
  dataStale = true;
}

/* ---------- the open strip: its instrument (or the rack's pads), its devices, its sends, and a clip ---------- */
const fmtOf = p => p.unit === 'Hz' ? fmtHz : p.unit === 's' ? (v => v < 1 ? Math.round(v*1000) + 'ms' : v.toFixed(2) + 's') : p.unit === 'st' || p.step ? (v => Math.round(v) + (p.unit || '')) : p.unit === '%' ? (v => Math.round(v*100) + '%') : p.unit === 'pan' ? (v => Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100)) : (v => v.toFixed(2));
function kn(label, min, max, def, cur, fmt, path, log, step){
  // a log knob turns evenly in octaves; a stepped one lands on its steps (the Moog's footage in octaves)
  if (log) { const L = x => Math.log(x), E = x => Math.exp(x); return knob(label, L(min), L(max), L(def), x => fmt(E(x)), x => setVal(path, E(x)), L(Math.max(min, cur))); }
  const snap = v => step ? Math.round(v/step)*step : v;
  return knob(label, min, max, def, v => fmt(snap(v)), v => setVal(path, snap(v)), cur);
}
const card = (title, extra = '') => h('div', 'card', `<h4><span>${title}</span>${extra}</h4>`);
function drawDetail(){
  const D = $('detail'); D.innerHTML = '';
  const d = stripsOf(song).find(x => x.id === sel); if (!d) return;
  const {T, k: pk} = ownerOf(sel), ti = song.tracks.indexOf(T);
  D.style.setProperty('--tc', ti >= 0 ? HUE(ti) : 'var(--accent)');
  const what = pk ? `a pad of the ${esc(T.name || T.id)} rack` : T ? `${instrument(T.inst.type).label}${T.pads ? ' rack' : ''}${T.inst.preset ? ': ' + esc(T.inst.preset) : T.inst.kit ? ': ' + esc(T.inst.kit) + ' kit' : ''}` : d.kind === 'master' ? 'the master bus' : d.kind;
  D.appendChild(h('h3', null, `${esc(d.name || d.id)} <small>${what}${d.to ? ' → ' + esc(d.to) : ''}</small>`));
  const cards = h('div', 'cards');
  if (pk) cards.appendChild(voiceCard(T, pk));
  else if (T && T.pads) cards.appendChild(padsCard(T));
  else if (T) cards.appendChild(instCard(T));
  (d.chain || []).forEach((x, k) => cards.appendChild(devCard(d, x, k)));
  { const add = h('select', 'adddev'); add.setAttribute('aria-label', `Add a device to ${d.name || d.id}`);
    add.innerHTML = '<option value="">+ Device…</option><optgroup label="Mixing">' + ADD.map(([k, l]) => `<option value="${k}">${l}</option>`).join('') +
      '</optgroup><optgroup label="Effects">' + EFFECTS.filter(e => !['eq', 'comp'].includes(e.key)).map(e => `<option value="${e.key}">${esc(e.label)}</option>`).join('') + '</optgroup>';
    // (on the master, before its limiter: the limiter stays last)
    add.onchange = () => { if (!add.value) return; const ch = chainOf(d.id), x = structuredClone(NEW_DEV[add.value] || {type: add.value, p: {}}), li = ch.findIndex(z => z.type === 'limiter');
      ch.splice(li >= 0 && add.value !== 'limiter' ? li : ch.length, 0, x); rechained(); };
    cards.appendChild(add); }
  if (d.sends && Object.keys(d.sends).length) { const c = card('Sends'), ks = h('div', 'knobs');
    for (const [r, v] of Object.entries(d.sends)) ks.appendChild(kn((song.returns.find(x => x.id === r) || {}).name || r, -40, 6, -40, v, fmtDb, `${d.id}.send.${r}`));
    c.appendChild(ks); cards.appendChild(c); }
  D.appendChild(cards);
  if (T) { const clip = selClip && T.clips[selClip] ? selClip : Object.keys(T.clips)[0]; selClip = clip; if (clip) D.appendChild(clipView(T, clip, ti)); }
}
// a drum rack: its pads, to hear (a click plays it) and open
function padsCard(T){
  const c = card('Pads <small>click to hear, double-click to open</small>'), g = h('div', 'padgrid'), I = instrument('drums');
  for (const k of Object.keys(T.pads)) { const v = I.voices.find(x => x.key === k), b = h('button', 'pad', esc(T.pads[k].name || (v ? v.label : k)));
    b.onclick = () => audition(T, k); b.ondblclick = () => { sel = T.id + ':' + k; drawDetail(); markSel(); }; g.appendChild(b); }
  c.appendChild(g); return c;
}
const audition = (T, k, n) => build().then(pl => { const tr = pl.E.tracks.find(x => x.t.id === T.id); if (tr) tr.inst.play(n == null ? k : n, ctx.currentTime, .25, .9); });
// one pad: its voice's knobs
function voiceCard(T, k){
  const I = instrument('drums'), v = I.voices.find(x => x.key === k), c = card(`${v ? v.label : k} <small>${esc(T.pads[k].kit || T.inst.kit)} kit</small>`), ks = h('div', 'knobs');
  const live = player && player.E.tracks.find(x => x.t.id === T.id), P = live ? live.inst.P[k] : null;
  for (const p of I.params) { const cur = P ? P[p.key] : (T.pads[k].voice || {})[p.key] ?? p.def;
    ks.appendChild(kn(p.key === 'x' && v ? v.x : p.label, p.min, p.max, p.def, cur, fmtOf(p), `${T.id}.inst.${k}.${p.key}`, p.log)); }
  const hear = h('button', null, '▶ Hear it'); hear.onclick = () => audition(T, k);
  c.append(ks, hear); return c;
}
function instCard(T){
  const I = instrument(T.inst.type), c = card(I.label), ks = h('div', 'knobs');
  if (I.key === 'drums') {
    const used = new Set(Object.values(T.clips).flatMap(cl => Object.keys(cl.hits || {})));
    const live = player && player.E.tracks.find(x => x.t.id === T.id), P = live ? live.inst.P : null;
    for (const v of I.voices.filter(v => used.has(v.key))) for (const p of I.params.filter(p => ['tune', 'decay', 'tone', 'drive', 'level'].includes(p.key))) {
      const cur = P ? P[v.key][p.key] : ((T.inst.voices || {})[v.key] || {})[p.key] ?? p.def;
      ks.appendChild(kn(`${v.label} ${p.label.toLowerCase()}`, p.min, p.max, p.def, cur, fmtOf(p), `${T.id}.inst.${v.key}.${p.key}`, p.log));
    }
    c.appendChild(ks); return c;
  }
  return synthFace(T, I);
}
// a synth's own face, like the hardware's: its preset, then every control in its sections (Oscillators, Filter, the
// envelopes, the LFOs …), knobs for amounts and switches for wave shapes and modes; built from the instrument's own groups
function synthFace(T, I){
  const c = h('div', 'card synth'), live = () => player && player.E.tracks.find(x => x.t.id === T.id), preset = (I.presets || {})[T.inst.preset] || {};
  const head = h('div', 'synhead'); head.innerHTML = `<h4><span>${esc(I.label)}</span></h4>`;
  if (I.presets) { const sel = h('select', 'preset'); sel.setAttribute('aria-label', `${I.label} preset`);
    sel.innerHTML = `<option value="">Preset…</option>` + Object.keys(I.presets).map(n => `<option${n === T.inst.preset ? ' selected' : ''}>${esc(n)}</option>`).join('');
    // (a preset replaces the sound: its settings over the defaults, the track's own changes cleared)
    sel.onchange = () => { if (!sel.value) return; T.inst.preset = sel.value; T.inst.p = {}; const tr = live(); if (tr) tr.inst.load({...I.presets[sel.value]}); dataStale = true; drawDetail(); };
    head.appendChild(sel); }
  if (I.words) head.appendChild(h('span', 'synwords', esc(I.words)));
  c.appendChild(head);
  const body = h('div', 'synbody');
  for (const [gname, params] of I.groups || [['Settings', I.params]]) {
    const g = h('div', 'syngroup', `<h5>${esc(gname)}</h5>`), ks = h('div', 'knobs');
    for (const p of params) {
      const tr = live(), raw = tr ? tr.inst.P[p.key] : (T.inst.p || {})[p.key] ?? preset[p.key] ?? p.def;
      if (p.list) {
        const cur = typeof raw === 'string' ? Math.max(0, p.list.indexOf(raw)) : Math.round(raw || 0), w = h('label', 'sw'), s2 = h('select');
        s2.innerHTML = p.list.map((x, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${esc(x)}</option>`).join('');
        s2.onchange = () => setVal(`${T.id}.inst.${p.key}`, +s2.value);
        w.append(s2, h('span', null, esc(p.label))); ks.appendChild(w);
      } else ks.appendChild(kn(p.label, p.min, p.max, p.def, typeof raw === 'number' ? raw : p.def, fmtOf(p), `${T.id}.inst.${p.key}`, p.log, p.step));
    }
    g.appendChild(ks); body.appendChild(g);
  }
  c.appendChild(body);
  return c;
}
function devCard(d, x, k){
  const nm = x.type === 'sc' ? 'Sidechain from ' + esc(x.src || 'kick') : TITLE[x.type] || (EFFECTS.find(e => e.key === x.type) || {}).label || x.type;
  const c = card(`${nm}${x.id ? ` <i class="dim">${esc(x.id)}</i>` : ''}`, `<span class="gr" data-k="${k}"></span>`), path = `${d.id}.${k}`, ks = h('div', 'knobs');
  // (◂ moves it earlier in the chain, ✕ takes it out)
  const tools = h('span', 'devtools'), mv = h('button', null, '◂'), rm = h('button', null, '✕'); mv.title = 'Earlier in the chain'; rm.title = `Remove the ${nm}`; mv.disabled = !k;
  mv.onclick = () => { const ch = chainOf(d.id); [ch[k - 1], ch[k]] = [ch[k], ch[k - 1]]; rechained(); };
  rm.onclick = () => { if (!rm.dataset.sure) { rm.dataset.sure = 1; rm.textContent = 'Remove?'; setTimeout(() => { delete rm.dataset.sure; rm.textContent = '✕'; }, 3000); return; } chainOf(d.id).splice(k, 1); rechained(); };
  tools.append(mv, rm); c.querySelector('h4').appendChild(tools);
  const sub = (name, ...kids) => { const g = h('div', 'syngroup', `<h5>${name}</h5>`), kk = h('div', 'knobs'); kk.append(...kids); g.appendChild(kk); return g; };
  const sec = fmtOf({unit: 's'}), pct = fmtOf({unit: '%'}), ratio = r => r.toFixed(1) + ':1';
  if (x.type === 'eq') {
    const cv = h('canvas', 'eqc'); cv.width = 520; cv.height = 160; c.appendChild(cv); drawEq(cv, d, k);
    (x.bands || []).forEach((b, i) => {
      const lbl = {hp: 'Low cut', lp: 'High cut', ls: 'Low shelf', hs: 'High shelf', bell: 'Bell', notch: 'Notch'}[b.type];
      ks.appendChild(kn(lbl, 20, 20000, b.f, b.f, fmtHz, `${path}.${i}.f`, true));
      if (!['hp', 'lp', 'notch'].includes(b.type)) ks.appendChild(kn(lbl + ' gain', -18, 18, 0, b.g || 0, fmtDb, `${path}.${i}.g`));
    });
    ks.addEventListener('pointermove', () => drawEq(cv, d, k)); ks.addEventListener('wheel', () => setTimeout(() => drawEq(cv, d, k)));
  } else if (x.type === 'comp') {
    const v = {thr: -18, ratio: 3, att: .01, rel: .15, gain: 0, mix: 1, ...x};
    ks.append(kn('Threshold', -48, 0, -18, v.thr, fmtDb, `${path}.thr`), kn('Ratio', 1, 20, 3, v.ratio, r => r.toFixed(1) + ':1', `${path}.ratio`, true),
      kn('Attack', .001, .2, .01, v.att, fmtOf({unit: 's'}), `${path}.att`, true), kn('Release', .02, 1, .15, v.rel, fmtOf({unit: 's'}), `${path}.rel`, true),
      kn('Make-up', 0, 18, 0, v.gain, fmtDb, `${path}.gain`), kn('Mix', 0, 1, 1, v.mix, fmtOf({unit: '%'}), `${path}.mix`));
  } else if (x.type === 'sc') {
    const v = {depth: 8, rel: .18, hold: .03, ...x};
    ks.append(kn('Depth', 0, 24, 8, v.depth, v => v.toFixed(1) + 'dB', `${path}.depth`), kn('Hold', 0, .2, .03, v.hold, fmtOf({unit: 's'}), `${path}.hold`), kn('Release', .02, 1, .18, v.rel, fmtOf({unit: 's'}), `${path}.rel`, true));
  } else if (x.type === 'multiband') {
    const v = {lo: 200, hi: 2500, att: .01, rel: .15, mix: 1, ...x};
    ks.append(kn('Low | mid', 40, 1000, 200, v.lo, fmtHz, `${path}.lo`, true), kn('Mid | high', 500, 12000, 2500, v.hi, fmtHz, `${path}.hi`, true),
      kn('Attack', .001, .2, .01, v.att, sec, `${path}.att`, true), kn('Release', .02, 1, .15, v.rel, sec, `${path}.rel`, true), kn('Mix', 0, 1, 1, v.mix, pct, `${path}.mix`));
    c.appendChild(ks);
    const row = h('div', 'mbands');
    ['Low', 'Mid', 'High'].forEach((n, i) => { const b = {thr: 0, ratio: 1, gain: 0, drive: 0, ...(x.bands || [])[i]};
      row.appendChild(sub(n, kn('Threshold', -48, 0, 0, b.thr, fmtDb, `${path}.${i}.thr`), kn('Ratio', 1, 20, 1, b.ratio, ratio, `${path}.${i}.ratio`, true),
        kn('Make-up', -12, 12, 0, b.gain, fmtDb, `${path}.${i}.gain`), kn('Drive', 0, 18, 0, b.drive, fmtDb, `${path}.${i}.drive`))); });
    c.appendChild(row); c.classList.add('wide'); return c;
  } else if (x.type === 'dyneq') {
    c.appendChild(ks); const row = h('div', 'mbands');
    (x.bands || []).forEach((b, i) => row.appendChild(sub(`${{ls: 'Low shelf', hs: 'High shelf'}[b.type] || 'Bell'} ${i + 1}`,
      kn('Freq', 30, 16000, 300, b.f || 300, fmtHz, `${path}.${i}.f`, true), kn('Q', .3, 8, 1.4, b.q || 1.4, v => v.toFixed(1), `${path}.${i}.q`, true),
      kn('Threshold', -60, 0, -30, b.thr ?? -30, fmtDb, `${path}.${i}.thr`), kn('Range', -18, 12, -6, b.range ?? -6, fmtDb, `${path}.${i}.range`),
      kn('Ratio', 1.1, 20, 3, b.ratio || 3, ratio, `${path}.${i}.ratio`, true))));
    c.appendChild(row); c.classList.add('wide'); return c;
  } else if (x.type === 'mseq') {
    const cv = h('canvas', 'eqc'); cv.width = 520; cv.height = 160; c.appendChild(cv); drawEq(cv, d, k);
    ks.appendChild(kn('Sides', -18, 12, 0, x.side || 0, fmtDb, `${path}.side`));
    (x.bands || []).forEach((b, i) => { const lbl = (b.ch === 'side' ? 'Side ' : 'Mid ') + {hp: 'low cut', lp: 'high cut', ls: 'low shelf', hs: 'high shelf', bell: 'bell', notch: 'notch'}[b.type];
      ks.appendChild(kn(lbl, 20, 20000, b.f, b.f, fmtHz, `${path}.${i}.f`, true));
      if (!['hp', 'lp', 'notch'].includes(b.type)) ks.appendChild(kn(lbl + ' gain', -18, 18, 0, b.g || 0, fmtDb, `${path}.${i}.g`)); });
    ks.addEventListener('pointermove', () => drawEq(cv, d, k)); ks.addEventListener('wheel', () => setTimeout(() => drawEq(cv, d, k)));
  } else if (x.type === 'transient') {
    ks.append(kn('Attack', -12, 12, 0, x.attack || 0, fmtDb, `${path}.attack`), kn('Sustain', -12, 12, 0, x.sustain || 0, fmtDb, `${path}.sustain`));
  } else if (x.type === 'tape') {
    const v = {drive: 6, bump: 1.5, hf: 15000, bias: .2, ...x};
    ks.append(kn('Drive', 0, 18, 6, v.drive, fmtDb, `${path}.drive`), kn('Head bump', 0, 4, 1.5, v.bump, fmtDb, `${path}.bump`), kn('Highs to', 4000, 20000, 15000, v.hf, fmtHz, `${path}.hf`, true),
      kn('Warmth', 0, .5, .2, v.bias, v => Math.round(v*200) + '%', `${path}.bias`));
  } else if (x.type === 'console') {
    ks.append(kn('Drive', 0, 12, 3, x.drive ?? 3, fmtDb, `${path}.drive`));
  } else if (x.type === 'mono') {
    ks.append(kn('Mono below', 40, 300, 120, x.f || 120, fmtHz, `${path}.f`, true));
  } else if (x.type === 'limiter') {
    const v = {gain: 0, ceil: -.3, ...x};
    ks.append(kn('Drive', 0, 12, 0, v.gain, fmtDb, `${path}.gain`), kn('Ceiling', -6, 0, -.3, v.ceil, fmtDb, `${path}.ceil`));
  } else {
    const E = EFFECTS.find(e => e.key === x.type);
    for (const p of (E ? E.params : []).filter(p => !p.list)) ks.appendChild(kn(p.label, p.min, p.max, p.def, (x.p || {})[p.key] ?? p.def, fmtOf(p), `${path}.${p.key}`, p.log));
  }
  c.appendChild(ks); return c;
}
// the EQ's curve, from the live filters (or not drawn until there's a graph)
function drawEq(cv, d, k){
  const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1e2733'; g.lineWidth = 1; for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { const x = Math.log(f/20)/Math.log(1000)*W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.beginPath(); g.moveTo(0, H/2); g.lineTo(W, H/2); g.stroke();
  const s = player && player.E.desk.strips.get(d.id), dv = s && s.dev[k];
  if (!dv || !(dv.curve || dv.curves)) { g.fillStyle = '#4a5566'; g.font = '20px sans-serif'; g.fillText('Play to see the curve', 12, 30); return; }
  const F = Array.from({length: W/2}, (_, i) => 20*Math.pow(1000, i/(W/2))), line = (r, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath();
    r.forEach((db, i) => { const x = i*2, y = H/2 - Math.max(-24, Math.min(24, db))/24*(H/2 - 6); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  // (a mid/side EQ: the middle in the track's colour, the sides in violet)
  if (dv.curves) { const c2 = dv.curves(F); line(c2.side, '#b48cff', 2); line(c2.mid, getComputedStyle(cv).getPropertyValue('--tc') || '#5cf', 3);
    g.font = '18px sans-serif'; g.fillStyle = '#b48cff'; g.fillText('sides', W - 60, 22); return; }
  line(dv.curve(F), getComputedStyle(cv).getPropertyValue('--tc') || '#5cf', 3);
}

/* ---------- editing a clip: a step sequencer, or a piano roll ---------- */
let clipBox = null, clipFor = null;
const edited = clip => { forget(clip); dataStale = true; jamFollow(clip); if (clipFor) { const [T, id, ti] = clipFor, old = clipBox, nb = clipView(T, id, ti); if (old && old.isConnected) old.replaceWith(nb); } if (pv && !$('pv').hidden) pv.steps(); };
function clipView(T, id, ti){
  const clip = T.clips[id], drums = !!clip.hits || T.inst.type === 'drums', key = drums ? 'd' : 'n', wrap = h('div', 'clipv');
  clipBox = wrap; clipFor = [T, id, ti]; wrap.style.setProperty('--tc', HUE(ti));
  const r = readClip(clip), bar = h('div', 'clipbar');
  bar.innerHTML = `<span class="ct">Clip ${esc(id)} · ${r.len % 16 ? r.len + ' steps' : r.len/16 + (r.len > 16 ? ' bars' : ' bar')}</span>`;
  const tg = h('div', 'seg'); for (const [v, label] of [['steps', 'Steps'], ['roll', 'Piano roll']]) { const b = h('button', null, label); b.setAttribute('aria-pressed', view[key] === v);
    b.onclick = () => { view[key] = v; edited(clip); }; tg.appendChild(b); }
  bar.appendChild(tg);
  // its length: the steps before it starts again (rows can be shorter, going round inside it)
  const cl = h('select', 'clen'); cl.setAttribute('aria-label', 'Clip length');
  cl.innerHTML = [...new Set([4, 8, 12, 16, 24, 32, 48, 64, 96, 128, r.len])].sort((a, b) => a - b).map(n => `<option value="${n}"${n === r.len ? ' selected' : ''}>${n % 16 ? n + ' steps' : n/16 + (n > 16 ? ' bars' : ' bar')}</option>`).join('');
  cl.onchange = () => { const n = +cl.value; if (n % 16) { clip.steps = n; delete clip.bars; } else { clip.bars = n/16; delete clip.steps; } edited(clip); };
  bar.appendChild(cl);
  const nc = h('button', null, '+ New clip'); nc.title = 'An empty clip for this track (in the session\'s "new" row)'; nc.onclick = () => { newClip(T); drawDetail(); markSel(); }; bar.appendChild(nc);
  bar.appendChild(h('span', 'hint', drums ? (view.d === 'steps' ? 'Click a step: on, accent, off. Set a row\'s length for polyrhythms; drag the velocity lane for its groove.' : 'Click to add a hit, click a hit to remove it.') : (view.n === 'steps' ? 'Click a step to add a note there, click a note to remove it.' : 'Click to add a note, drag right for longer; click a note to remove it.')));
  wrap.appendChild(bar);
  wrap.appendChild(drums ? (view.d === 'steps' ? drumSteps(T, clip) : drumRoll(T, clip)) : (view.n === 'steps' ? noteSteps(T, id, clip) : noteRoll(T, id, clip)));
  return wrap;
}
// velocity shapes for a drum row (j: the step, n: the row's length, r: a random number), applied to its hits only
const GROOVES = {
  'Even': () => .75, 'Beats loud': j => j % 4 === 0 ? 1 : .6, 'Offbeats loud': j => j % 4 === 2 ? 1 : .5,
  'Ghosts between': j => j % 2 ? .3 : .85, 'Push and pull': j => [.95, .45, .7, .55][j % 4], 'Rise': (j, n) => .3 + .7*j/Math.max(1, n - 1),
  'Fall': (j, n) => 1 - .7*j/Math.max(1, n - 1), 'Breathing': (j, n) => .55 + .4*Math.sin(j/n*Math.PI*2), 'Human': (j, n, r) => .55 + .4*r()};
// (the same "human" every time for the same clip and row)
const rng = (clip, k) => { let x = [...k].reduce((a, c) => a*31 + c.charCodeAt(0), 7) >>> 0; return () => ((x = (x*1664525 + 1013904223) >>> 0)/4294967296); };
const LENS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 24, 28, 32, 48, 64];
const velSel = {};   // the drum row whose velocity lane shows, per track
// (the row picked, or the first with hits: the hats first)
const velOf = (T, clip) => { const hits = clip.hits || {}, has = k => hits[k] && /[^.\-\s|]/.test(typeof hits[k] === 'string' ? hits[k] : hits[k].p);
  return velSel[T.id] && hits[velSel[T.id]] != null ? velSel[T.id] : ['chh', 'ohh', 'shaker', 'ride'].find(has) || Object.keys(hits).find(has) || null; };
// a lane of values drawn by dragging across it, a bar a step: a row's velocity, a clip's notes', or a volume envelope
function lane(label, cols, from, get, set, {min = 0, max = 1, fmt = v => Math.round(v*100) + '%', done, cls = ''} = {}){
  const name = h('span', 'rn lanen', esc(label)), rw = h('div', 'row lane ' + cls), cells = [];
  rw.style.gridTemplateColumns = `repeat(${cols}, minmax(12px, 1fr))`;
  const show = (c, v) => { const b = cells[c]; b.classList.toggle('none', v == null); if (v != null) { b.style.setProperty('--h', Math.max(0, Math.min(1, (v - min)/(max - min)))); b.title = fmt(v); } };
  for (let c = 0; c < cols; c++) { const b = h('i', (from + c) % 4 === 0 ? 'b' : ''); cells.push(b); rw.appendChild(b); show(c, get(from + c)); }
  let on = false;
  const paint = e => { const r = rw.getBoundingClientRect(), c = Math.floor((e.clientX - r.left)/r.width*cols); if (c < 0 || c >= cols || get(from + c) == null) return;
    set(from + c, min + (max - min)*Math.max(0, Math.min(1, 1 - (e.clientY - r.top)/r.height))); for (let k = 0; k < cols; k++) show(k, get(from + k)); };
  rw.addEventListener('pointerdown', e => { on = true; e.preventDefault(); try { rw.setPointerCapture(e.pointerId); } catch (x) {} paint(e); });
  rw.addEventListener('pointermove', e => { if (on) paint(e); });
  rw.addEventListener('pointerup', () => { if (on) { on = false; if (done) done(); } });
  return [name, rw];
}
// a clip's volume envelope (its `auto.vol`, dB a step, going round with the clip): shown on demand, drawn like the lanes
const envOn = new WeakSet();
function envLane(T, clip, cols, from){
  const box = h('div', 'steps envbox'), pts = () => (clip.auto || {}).vol, fader = () => (T.mix || {}).vol || 0;
  const tg = h('button', 'envtg', envOn.has(clip) ? 'Volume envelope ▾' : 'Volume envelope ▸'); tg.setAttribute('aria-pressed', envOn.has(clip));
  tg.title = 'Draw the track’s volume over the clip (it goes round with the clip)'; tg.onclick = () => { envOn.has(clip) ? envOn.delete(clip) : envOn.add(clip); edited(clip); };
  if (!envOn.has(clip)) { box.append(tg, h('span', 'hint', pts() ? 'drawn' : '')); return box; }
  // (straight between its points; before the first and after the last, held; with none, the fader)
  const at = i => { const P = pts(); if (!P || !P.length) return fader(); if (i <= P[0][0]) return P[0][1]; for (let k = 1; k < P.length; k++) if (i <= P[k][0]) { const [a, va] = P[k - 1], [b, vb] = P[k]; return va + (vb - va)*(i - a)/Math.max(1e-9, b - a); } return P[P.length - 1][1]; };
  const [ln, lr] = lane('Volume', cols, from, at, (i, v) => { clip.auto = clip.auto || {}; const P = (clip.auto.vol || []).filter(q => q[0] !== i); P.push([i, Math.round(v*2)/2]); P.sort((a, b) => a[0] - b[0]); clip.auto.vol = P; forget(clip); dataStale = true; },
    {min: -30, max: 6, fmt: v => fmtDb(v) + ' dB', cls: 'env', done: () => edited(clip)});
  const clr = h('button', null, 'Clear'); clr.title = 'Take the envelope away (the fader again)'; clr.onclick = () => { if (clip.auto) { delete clip.auto.vol; if (!Object.keys(clip.auto).length) delete clip.auto; } edited(clip); };
  box.append(tg, clr, ln, lr); return box;
}
// a clip's drum rows: every pad of the rack (or voice in the clip), each its own length (a row shorter than the clip goes round)
function drumRows(T, clip){
  const len = readClip(clip).len, keys = [...new Set([...Object.keys(T.pads || {}), ...Object.keys(clip.hits || {})])];
  return keys.map(k => { const row = (clip.hits || {})[k], str = row == null ? '' : typeof row === 'string' ? row : row.p, clean = str.replace(/[\s|]/g, '');
    return {k, row, steps: [...(clean || '.'.repeat(Math.min(len, 64)))]}; });
}
const setRow = (clip, k, row, steps) => { const s = steps.join(''); clip.hits = clip.hits || {}; clip.hits[k] = row && typeof row === 'object' ? {...row, p: s} : s; };
const padLabel = (T, k) => { const v = instrument('drums').voices.find(x => x.key === k); return (T.pads && T.pads[k] && T.pads[k].name) || (v ? v.label : k); };
// (long clips page 64 steps at a time: the page each clip is on)
const pageOf = new WeakMap();
function pager(key, len, redraw){
  const n = Math.ceil(len/64), pg = Math.min(pageOf.get(key) || 0, n - 1); if (n < 2) return [0, null];
  const bar = h('div', 'seg pager'); for (let i = 0; i < n; i++) { const b = h('button', null, `bars ${i*4 + 1}–${Math.min(len/16, i*4 + 4)}`); b.setAttribute('aria-pressed', i === pg); b.onclick = () => { pageOf.set(key, i); redraw(); }; bar.appendChild(b); }
  return [pg, bar];
}
function drumSteps(T, clip){
  const len = readClip(clip).len, box = h('div'), st = h('div', 'steps'), [pg, pgr] = pager(clip, len, () => edited(clip)), from = pg*64, cols = Math.min(64, len - from);
  if (pgr) box.appendChild(pgr);
  const rows = drumRows(T, clip);
  for (const {k, row, steps} of rows) {
    // (its name plays it and picks it for the velocity lane; its length makes polyrhythms: a 3 against the 16 goes round on its own)
    const head = h('div', 'rhead' + (velOf(T, clip) === k ? ' vel' : '')), name = h('button', 'rn', esc(padLabel(T, k))); name.title = 'Hear it, and shape its velocity below';
    name.onclick = () => { velSel[T.id] = k; audition(T, k); edited(clip); };
    const ln = h('select', 'rlen'); ln.title = `${padLabel(T, k)}: steps before it repeats`; ln.setAttribute('aria-label', ln.title);
    ln.innerHTML = [...new Set([...LENS, steps.length])].sort((a, b) => a - b).map(n => `<option${n === steps.length ? ' selected' : ''}>${n}</option>`).join('');
    ln.onchange = () => { const n = +ln.value, s2 = steps.slice(0, n); while (s2.length < n) s2.push('.'); setRow(clip, k, row, s2); edited(clip); };
    const rm = h('button', 'rrm', '✕'); rm.title = `Clear the ${padLabel(T, k)} row`; rm.onclick = () => { delete clip.hits[k]; if (velSel[T.id] === k) delete velSel[T.id]; edited(clip); };
    head.append(name, ln, rm);
    const rw = h('div', 'row'); rw.dataset.len = len; rw.dataset.from = from; rw.style.gridTemplateColumns = `repeat(${cols}, minmax(14px, 1fr))`;
    // (a row shorter than the clip goes round: its repeats are drawn dimmer, and a click on one edits the row)
    for (let c = 0; c < cols; c++) { const i = from + c, j = i % steps.length, ch = steps[j], b = h('button', (i % 4 === 0 ? 'b' : '') + (i >= steps.length ? ' rep' : '') + (j === 0 && i ? ' wrap' : '')), e = hitRow(ch).ev[0];
      if (e) { b.classList.add('on'); b.style.setProperty('--v', e.v); if (ch === 'X') b.classList.add('acc'); b.title = ch === '?' ? 'half the time' : `velocity ${Math.round(e.v*100)}%`; }
      b.setAttribute('aria-label', `${padLabel(T, k)} step ${i + 1}${e ? ' on' : ''}`); b.dataset.i = i;
      // (a step goes off → on → accent → off)
      b.onclick = () => { const s = [...steps]; s[j] = s[j] === '.' || s[j] === '-' ? 'x' : s[j] === 'X' ? '.' : 'X'; if (s[j] !== '.') audition(T, k); setRow(clip, k, row, s); edited(clip); };
      rw.appendChild(b); }
    st.append(head, rw);
  }
  // + a row: any drum voice not in the clip yet (a rack plays it on its own kit if it has no pad)
  const D = instrument('drums'), have = new Set(rows.map(x => x.k)), add = h('select', 'radd'); add.setAttribute('aria-label', 'Add a drum row');
  add.innerHTML = '<option value="">+ Row…</option>' + D.voices.filter(v => !have.has(v.key)).map(v => `<option value="${v.key}">${esc(v.label)}</option>`).join('');
  add.onchange = () => { if (!add.value) return; clip.hits = clip.hits || {}; clip.hits[add.value] = '.'.repeat(16); velSel[T.id] = add.value; edited(clip); };
  st.append(h('span'), add);
  // the velocity lane of the row picked: drag across to shape its dynamics (a hat's groove), or a shape from the menu
  const vk = velOf(T, clip);
  if (vk) {
    // (over the row's own length, a bar a step of it: a short row's lane is short too)
    const cur = () => drumRows(T, clip).find(x => x.k === vk), ev = i => { const R = cur(); if (!R || i >= R.steps.length) return null; const e = hitRow(R.steps[i]).ev[0]; return e ? e.v : null; };
    const vlen = Math.min(64, (cur() || {steps: []}).steps.length || 16);
    const [ln, lr] = lane(`${padLabel(T, vk)} velocity`, vlen, 0, ev, (i, v) => { const R = cur(), s2 = [...R.steps]; s2[i % s2.length] = String(Math.max(1, Math.min(9, Math.round(v*9)))); setRow(clip, vk, R.row, s2); forget(clip); dataStale = true; }, {done: () => edited(clip)});
    st.append(ln, lr);
    const gs = h('select', 'groove'); gs.setAttribute('aria-label', 'A velocity shape for the row');
    gs.innerHTML = '<option value="">Groove…</option>' + Object.keys(GROOVES).map(g => `<option>${g}</option>`).join('');
    gs.onchange = () => { const R = cur(); if (!R || !GROOVES[gs.value]) return; const n = R.steps.length, rnd = rng(clip, vk);
      setRow(clip, vk, R.row, R.steps.map((c, j) => hitRow(c).ev[0] ? String(Math.max(1, Math.min(9, Math.round(GROOVES[gs.value](j, n, rnd)*9)))) : c)); edited(clip); };
    st.append(h('span'), gs);
  }
  box.appendChild(st); box.appendChild(envLane(T, clip, cols, from)); return box;
}
// the roll for drums: a lane a pad, the clip's whole length, hits as blocks
function drumRoll(T, clip){
  const r = readClip(clip), rows = drumRows(T, clip), RH = 22, W = 1200, H = rows.length*RH, box = h('div', 'rollbox'), cv = h('canvas', 'roll');
  cv.width = W; cv.height = H; cv.style.height = H + 'px'; box.append(cv, h('i', 'ph'));
  const g = cv.getContext('2d'); g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
  rows.forEach(({k}, j) => { if (j % 2) { g.fillStyle = '#0a0d12'; g.fillRect(0, j*RH, W, RH); } });
  for (let s = 0; s <= r.len; s++) { g.fillStyle = s % 16 ? s % 4 ? '#0e131a' : '#1a222d' : '#2a3442'; g.fillRect(s*W/r.len, 0, 1, H); }
  g.font = '13px IBM Plex Mono, monospace';
  for (const e of r.ev) { const j = rows.findIndex(x => x.k === e.n); if (j < 0) continue; g.globalAlpha = .35 + .65*e.v; g.fillStyle = getComputedStyle(box).getPropertyValue('--tc') || '#5cf'; g.fillRect(e.s*W/r.len + 1, j*RH + 3, Math.max(4, W/r.len - 2), RH - 6); }
  g.globalAlpha = 1; g.fillStyle = '#8794a6'; rows.forEach(({k}, j) => g.fillText(padLabel(T, k), 4, j*RH + 15));
  cv.onclick = e => { const b = cv.getBoundingClientRect(), s = Math.floor((e.clientX - b.left)/b.width*r.len), j = Math.floor((e.clientY - b.top)/b.height*rows.length), R = rows[j]; if (!R) return;
    const steps = R.steps.length >= r.len ? [...R.steps] : Array.from({length: r.len}, (_, i) => R.steps[i % R.steps.length]);   // (a short row, edited here, is written out to the clip's length)
    steps[s] = steps[s] === '.' || steps[s] === '-' || steps[s] == null ? 'x' : '.'; if (steps[s] === 'x') audition(T, R.k); setRow(clip, R.k, R.row, steps); edited(clip); };
  return box;
}
// note clips are kept as one note an entry ([step, pitch number, length, velocity, options]) while they're edited
function flatNotes(clip){
  const out = []; for (const x of clip.notes || []) { const [s, p, l = 1, v = .8, o] = Array.isArray(x) ? x : [x.t, x.n, x.l, x.v, x];
    for (const q of [].concat(p)) out.push(o && Object.keys(o).length ? [s, noteNum(q), l, v, o] : [s, noteNum(q), l, v]); }
  return out;
}
function pitchRange(T, id, clip){
  // (two octaves round the notes, or round where the instrument plays when the clip is empty; kept while editing, and
  // widened to take in any note that falls outside)
  const k = T.id + '/' + id, ns = flatNotes(clip).map(x => x[1]), low = /bass|sub/i.test((T.name || '') + (T.inst.preset || '')) ? 33 : 52;
  let [lo, hi] = range[k] || (ns.length ? [Math.min(...ns) - 3, Math.max(...ns) + 3] : [low, low + 24]);
  if (ns.length) { lo = Math.min(lo, Math.min(...ns) - 1); hi = Math.max(hi, Math.max(...ns) + 1); }
  while (hi - lo < 24) { hi++; if (hi - lo < 24) lo--; }
  return range[k] = [lo, hi];
}
function noteSteps(T, id, clip){
  const r = readClip(clip), [lo, hi] = pitchRange(T, id, clip), notes = flatNotes(clip), st = h('div', 'steps notes'), box = h('div'), [pg, pgr] = pager(clip, r.len, () => edited(clip)), from = pg*64, cols = Math.min(64, r.len - from);
  if (pgr) box.appendChild(pgr);
  for (let n = hi; n >= lo; n--) {
    const name = h('button', 'rn' + (BLACK(n) ? ' blk' : ''), noteName(n)); name.onclick = () => audition(T, null, n);
    const rw = h('div', 'row'); rw.dataset.len = r.len; rw.dataset.from = from; rw.style.gridTemplateColumns = `repeat(${cols}, minmax(12px, 1fr))`;
    for (let i = from; i < from + cols; i++) {
      const b = h('button', i % 4 === 0 ? 'b' : ''), at = notes.findIndex(x => x[1] === n && Math.floor(x[0]) === i), held = at < 0 && notes.some(x => x[1] === n && x[0] < i && x[0] + x[2] > i);
      if (at >= 0) { b.classList.add('on'); b.style.setProperty('--v', notes[at][3]); } else if (held) b.classList.add('held');
      b.dataset.i = i; b.setAttribute('aria-label', `${noteName(n)} step ${i + 1}${at >= 0 ? ' on' : ''}`);
      b.onclick = () => { const N = flatNotes(clip), j = N.findIndex(x => x[1] === n && Math.floor(x[0]) === i);
        if (j >= 0) N.splice(j, 1); else { N.push([i, n, 1, .8]); audition(T, null, n); } N.sort((a, b) => a[0] - b[0] || a[1] - b[1]); clip.notes = N; edited(clip); };
      rw.appendChild(b);
    }
    st.append(name, rw);
  }
  st.append(...noteVel(clip, cols, from));
  box.appendChild(st); box.appendChild(envLane(T, clip, cols, from)); return box;
}
// the velocity lane under a note clip: a bar for the notes starting on each step (a chord's together)
function noteVel(clip, cols, from){
  const get = i => { const v = flatNotes(clip).filter(x => Math.floor(x[0]) === i).map(x => x[3]); return v.length ? Math.max(...v) : null; };
  return lane('Velocity', cols, from, get, (i, v) => { clip.notes = flatNotes(clip).map(x => Math.floor(x[0]) === i ? [x[0], x[1], x[2], Math.round(v*100)/100, ...(x[4] ? [x[4]] : [])] : x); forget(clip); dataStale = true; }, {done: () => edited(clip)});
}
function noteRoll(T, id, clip){
  const r = readClip(clip), [lo, hi] = pitchRange(T, id, clip), rows = hi - lo + 1, RH = 14, W = 1200, H = rows*RH, box = h('div', 'rollbox'), cv = h('canvas', 'roll');
  cv.width = W; cv.height = H; cv.style.height = H + 'px'; box.append(cv, h('i', 'ph'));
  const tc = () => getComputedStyle(box).getPropertyValue('--tc') || '#5cf';
  const draw = (extra) => { const g = cv.getContext('2d'); g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
    for (let n = lo; n <= hi; n++) if (BLACK(n)) { g.fillStyle = '#0a0d12'; g.fillRect(0, (hi - n)*RH, W, RH); }
    for (let s = 0; s <= r.len; s++) { g.fillStyle = s % 16 ? s % 4 ? '#0e131a' : '#1a222d' : '#2a3442'; g.fillRect(s*W/r.len, 0, 1, H); }
    g.fillStyle = '#8794a6'; g.font = '11px IBM Plex Mono, monospace'; for (let n = lo; n <= hi; n++) if (n % 12 === 0) g.fillText(noteName(n), 3, (hi - n)*RH + 11);
    for (const x of [...flatNotes(clip), ...(extra ? [extra] : [])]) { const [s, n, l, v, o] = x; if (n < lo || n > hi) continue;
      g.globalAlpha = .4 + .6*v*(o && o.p < 1 ? .6 : 1); g.fillStyle = tc(); g.fillRect(s*W/r.len + 1, (hi - n)*RH + 1, Math.max(3, l*W/r.len - 2), RH - 2); }
    g.globalAlpha = 1; };
  draw();
  // a click on a note takes it away; on space, a new note there, as long as the drag (in sixteenths)
  let drag = null;
  const at = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left)/b.width*r.len, hi - Math.floor((e.clientY - b.top)/b.height*rows)]; };
  cv.addEventListener('pointerdown', e => { const [x, n] = at(e), N = flatNotes(clip), j = N.findIndex(q => q[1] === n && x >= q[0] && x < q[0] + q[2]);
    if (j >= 0) { N.splice(j, 1); clip.notes = N; edited(clip); return; }
    drag = {s: Math.floor(x), n, l: 1}; try { cv.setPointerCapture(e.pointerId); } catch (x) {} audition(T, null, n); draw([drag.s, n, 1, .8]); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const [x] = at(e); drag.l = Math.max(1, Math.ceil(x) - drag.s); draw([drag.s, drag.n, drag.l, .8]); });
  cv.addEventListener('pointerup', () => { if (!drag) return; const N = flatNotes(clip); N.push([drag.s, drag.n, drag.l, .8]); N.sort((a, b) => a[0] - b[0] || a[1] - b[1]); clip.notes = N; drag = null; edited(clip); });
  // (velocity and the volume envelope under it, a bar a step over the whole clip)
  const out = h('div'), vs = h('div', 'steps rollvel'); vs.append(...noteVel(clip, r.len, 0)); out.append(box, vs, envLane(T, clip, r.len, 0)); return out;
}

/* ---------- transport and the live view ---------- */
const setPlay = () => { $('play').textContent = player && player.playing ? '↺ Restart' : '▶ Play'; };
$('play').onclick = () => build().then(pl => { pl.play({bar: 0}); setPlay(); });
$('stop').onclick = () => { if (player) player.stop(); setPlay(); };
document.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); if (player && player.playing) $('stop').onclick(); else $('play').onclick(); } });

let lastT = 0, specBuf = null;
function frame(t){
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (t - lastT)/1000 || .016); lastT = t;
  if (!player) return;
  const E = player.E, A = arrangement(song), n = player.playing ? Math.floor(player.pos()) : -1;
  if (player.playing && player.end && n > A.bars*16 + 32) { player.stop(); setPlay(); }
  if (n >= 0) {
    const bar = Math.floor(n/16), beat = Math.floor(n/4) % 4, six = n % 4; $('pos').textContent = `${String(bar + 1).padStart(3, ' ')}.${beat + 1}.${six + 1}`;
    $('head').style.transform = `translateX(${E.mode === 'arrange' ? Math.min(1, n/(A.bars*16))*$('arr').clientWidth : -8}px)`;
    document.querySelectorAll('.arr .part').forEach(p => p.classList.toggle('now', E.mode === 'arrange' && bar >= +p.dataset.at && bar < +p.dataset.at + +p.dataset.bars));
    // which cell is playing: the clip a track plays, in the row it was launched from (or the scene playing)
    const sc = E.sceneAt(n), row = id => { const o = E.over[id]; return o && n >= o.at ? (o.clip ? o.row : null) : sc; };
    document.querySelectorAll('.ses .clip').forEach(b => { const id = b.dataset.track, o = E.over[id], rw = row(id);
      b.classList.toggle('live', E.clipOf(id, n) === b.dataset.clip && (rw == null || rw === b.dataset.row));
      b.classList.toggle('queued', !!(o && o.next === b.dataset.clip && (o.nrow == null || o.nrow === b.dataset.row)) || (E.session.next === b.dataset.row)); });
    document.querySelectorAll('.ses th.scene button').forEach(b => b.classList.toggle('live', b.dataset.scene === sc || b.dataset.scene === E.session.next && false));
    // the playhead in the open clip
    const {T} = ownerOf(sel), run = T && E.clipRun(T.id, n);
    document.querySelectorAll('.steps .row button.ph').forEach(b => b.classList.remove('ph'));
    if (run && run.id === selClip) { const r = readClip(T.clips[selClip]), pos = ((n - run.at) % r.len + r.len) % r.len;
      document.querySelectorAll('.steps .row').forEach(rw => { const b = rw.children[pos - +rw.dataset.from]; if (b) b.classList.add('ph'); });
      const ph = document.querySelector('.rollbox .ph'); if (ph) { ph.style.display = 'block'; ph.style.transform = `translateX(${(pos + .5)/r.len*ph.parentNode.clientWidth}px)`; } }
    else { const ph = document.querySelector('.rollbox .ph'); if (ph) ph.style.display = 'none'; }
  } else { $('pos').textContent = '  –'; }
  pv.frame(n);
  // meters: peak and level, with how far each device is turning it down
  for (const s of document.querySelectorAll('.strip')) {
    const m = E.desk.meter(s.dataset.id, dt, TUNE.studio.meterFall); if (!m) continue;
    const g = s._met.getContext('2d'), H = s._met.height, y = db => H*(1 - Math.max(0, Math.min(1, (db + 48)/54)));
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 14, H);
    const grd = g.createLinearGradient(0, H, 0, 0); grd.addColorStop(0, '#3fd68a'); grd.addColorStop(.75, '#3fd68a'); grd.addColorStop(.88, '#f2b33d'); grd.addColorStop(1, '#ff5a5a');
    g.fillStyle = grd; g.fillRect(2, y(m.rms + 3), 10, H - y(m.rms + 3));
    g.fillStyle = m.peak > -.5 ? '#ff5a5a' : '#e8eef5'; g.fillRect(1, y(m.peak), 12, 2);
    const gr = Math.max(0, ...m.gr); if (gr > .1) { g.fillStyle = '#b48cff'; g.fillRect(0, 0, 3, Math.min(H, gr/24*H)); }
    s._chips.querySelectorAll('.chip').forEach(c => { const v = m.gr[+c.dataset.k] || 0; c.classList.toggle('gr', v > .3); c.lastChild.textContent = v > .3 ? '−' + Math.min(99, v).toFixed(0) : ''; });
    if (s.dataset.id === sel) document.querySelectorAll('.detail .gr').forEach(e => { const v = m.gr[+e.dataset.k] || 0; e.textContent = v > .1 ? `−${v.toFixed(1)} dB` : ''; });
  }
  // the goniometer: the master's left against right
  if (gonA && player.playing) { gonA[0].getFloatTimeDomainData(gonA[0].buf); gonA[1].getFloatTimeDomainData(gonA[1].buf); gonio($('gonio'), gonA[0].buf, gonA[1].buf); }
  // the spectrum
  if (specAn) {
    const cv = $('spec'), g = cv.getContext('2d'), W = cv.width, H = cv.height; specBuf = specBuf || new Float32Array(specAn.frequencyBinCount); specAn.getFloatFrequencyData(specBuf);
    g.fillStyle = '#0c1016'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1e2733'; g.font = '11px IBM Plex Mono, monospace'; for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { const x = Math.log(f/20)/Math.log(1000)*W; g.fillRect(x, 0, 1, H); g.fillStyle = '#4a5566'; g.fillText(fmtHz(f), x + 3, H - 4); g.fillStyle = '#1e2733'; }
    const sr = ctx.sampleRate, N = specAn.fftSize; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x < W; x += 2) { const f = 20*Math.pow(1000, x/W), k = Math.min(specBuf.length - 1, Math.round(f*N/sr)), v = specBuf[k] + 4.5*Math.log2(f/1000);   // (tilted 4.5 dB an octave, so a balanced mix reads level)
      g.lineTo(x, H - Math.max(0, Math.min(1, (v + 90)/80))*H); }
    g.lineTo(W, H); g.closePath(); g.fillStyle = 'rgba(85,204,255,.22)'; g.fill(); g.strokeStyle = '#5cf'; g.lineWidth = 1.5; g.stroke();
  }
}
requestAnimationFrame(frame);

/* ---------- render, measure, save ---------- */
$('render').onclick = async () => {
  const b = $('render'); b.disabled = true; $('prog').hidden = false; $('progBar').style.width = '0';
  b.textContent = 'Rendering…'; const t0 = performance.now();
  try {
    const buf = await renderSong(song, {onProgress: p => $('progBar').style.width = (p*100).toFixed(1) + '%'});
    $('progBar').style.width = '100%'; b.textContent = 'Measuring…'; await new Promise(r => setTimeout(r, 30));
    const L = buf.getChannelData(0), R = buf.getChannelData(1), r = report(L, R, buf.sampleRate);
    rendered = {buf, r, title: song.title};
    const max = Math.max(...Object.values(r.bands));
    $('rep').innerHTML = `<b>${r.lufs.toFixed(1)} LUFS</b> integrated · short-term max ${r.short.toFixed(1)}<br>true peak <b>${r.truePeak.toFixed(1)} dBTP</b> · range ${r.lra.toFixed(1)} LU<br>` +
      `stereo correlation ${r.corr.toFixed(2)} · sides ${r.side.toFixed(1)} dB<br>rendered in ${((performance.now() - t0)/1000).toFixed(0)} s` +
      `<div class="bands">${Object.entries(r.bands).map(([k, v]) => `<span>${k}</span><i style="width:${Math.max(2, 100 + (v - max)*3)}%"></i><span>${v.toFixed(1)}</span>`).join('')}</div>` +
      // (each band's sides against its middle: the low end should be near mono, the top can open out)
      `<div class="wid" title="The sides against the middle, band by band (dB)">${r.width.map(w => `<span>${w.band}</span><i style="width:${Math.max(2, Math.min(100, (w.side + 40)*2.5))}%"></i><span>${w.side.toFixed(0)}</span>`).join('')}</div>` +
      `<small class="dim">above: each band's share of the energy; below: how wide each band is (sides against middle, dB)</small>`;
    showRef();
    const g = $('gram'); g.hidden = false; paint(g, L, R, buf.sampleRate, {bar: 240/song.bpm});
    $('save').hidden = false; $('save').textContent = (await downloads()) ? 'Save WAV (zip)' : 'Save WAV';
  } catch (e) { $('rep').textContent = 'The render failed: ' + e.message; }
  b.disabled = false; b.textContent = 'Render and measure'; $('prog').hidden = true;
};
let dl;
const downloads = async () => { if (dl !== undefined) return dl; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; } return dl; };
$('save').onclick = async () => {
  if (!rendered) return; const name = rendered.title.replace(/\W+/g, '-').toLowerCase(), w = wav(rendered.buf), d = await downloads();
  if (d) { try { await d.save({filename: name + '.zip', data: zip([{name: name + '.wav', data: new Uint8Array(await w.arrayBuffer())}, {name: name + '.json', data: JSON.stringify(song, null, 1)}])}); } catch (e) { if (e.code !== 'declined') $('rep').insertAdjacentText('beforeend', ` Saving failed (${e.code}).`); } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(w); a.download = name + '.wav'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

/* ---------- a reference track: measured here, the song compared with it ---------- */
const f1 = v => (v > 0 ? '+' : '') + v.toFixed(1);
// (what's kept of it, in the song: the numbers, not the audio, so it comes back with the song and Claude can read it)
const REF_KEYS = ['lufs', 'truePeak', 'lra', 'tilt', 'side', 'lowSide', 'corr', 'bands', 'thirds', 'width'];
$('refPick').onclick = () => $('refFile').click();
$('refFile').onchange = async () => {
  const f = $('refFile').files[0]; if (!f) return; $('refRep').textContent = `Measuring ${f.name}…`;
  try { const buf = await audio().decodeAudioData(await f.arrayBuffer()); await new Promise(r => setTimeout(r, 30));
    setRef(buf, f.name.replace(/\.[^.]+$/, '')); }
  catch (e) { $('refRep').textContent = 'That file couldn’t be read as audio: ' + (e.message || e); }
  $('refFile').value = '';
};
function setRef(buf, name){
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, r = report(L, R, buf.sampleRate);
  song.ref = JSON.parse(JSON.stringify({name, ...Object.fromEntries(REF_KEYS.map(k => [k, r[k]]))}, (k, v) => typeof v === 'number' ? Math.round(v*100)/100 : v));
  dataStale = true; showRef();
}
function showRef(){
  const ref = song.ref, e = $('refRep'); $('refMatch').hidden = true; if (!ref) { e.innerHTML = ''; return; }
  let html = `<b>${esc(ref.name)}</b>: ${ref.lufs.toFixed(1)} LUFS · true peak ${ref.truePeak.toFixed(1)} dBTP · range ${ref.lra.toFixed(1)} LU · tilt ${ref.tilt.toFixed(2)} dB/oct · sides ${ref.side.toFixed(1)} dB`;
  if (rendered) { const d = compare(rendered.r, ref);
    html += `<div class="bands" title="Your mix against the reference, band by band, at the same loudness">${Object.entries(d.bands).map(([k, v]) => `<span>${k}</span><i style="margin-left:${v < 0 ? 50 - Math.min(50, -v*5) : 50}%;width:${Math.max(1, Math.min(50, Math.abs(v)*5))}%;background:${v < 0 ? '#5cf' : '#f2b33d'}"></i><span>${f1(v)}</span>`).join('')}</div>` +
      `<small class="dim">your mix against it, band by band at the same loudness (orange: more than the reference)</small><ul class="adv">${advise(d).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    $('refMatch').hidden = false; }
  else html += '<br>Render the song (above) to compare it.';
  e.innerHTML = html;
}
// an EQ on the master, before its limiter, leaning the balance part of the way towards the reference's (called match: again replaces it)
$('refMatch').onclick = () => {
  if (!rendered || !song.ref) return; const bands = matchEq(compare(rendered.r, song.ref)), ch = chainOf('master');
  let x = ch.find(z => z.id === 'match'); if (x) x.bands = bands; else { x = {type: 'eq', id: 'match', bands}; const li = ch.findIndex(z => z.type === 'limiter'); ch.splice(li >= 0 ? li : ch.length, 0, x); }
  rechained();
  $('refRep').insertAdjacentHTML('beforeend', `<p>An EQ called <b>match</b> is on the master now (${bands.map(b => `${fmtHz(b.f)} ${f1(b.g)}`).join(', ')}). Render again to compare; open the master to change it or take it out.</p>`);
};

/* ---------- clashes: where two tracks fill the same frequencies at the same moments ---------- */
$('clashBtn').onclick = async () => {
  const b = $('clashBtn'), e = $('clashRep'); b.disabled = true;
  try {
    const r = await clashes(song, {onProgress: (p, l) => { e.textContent = l ? `Rendering ${l} alone… ${Math.round(p*100)}%` : 'Comparing…'; }}), name = id => esc((r.stems[id] || {}).label || id);
    e.innerHTML = r.list.length ? `Bars ${r.from + 1}–${r.from + r.bars}, the busiest part:` : `Bars ${r.from + 1}–${r.from + r.bars}: no two tracks fill the same band at the same moments.`;
    for (const c of r.list.slice(0, 6)) {
      const row = h('div', 'clash'), f = Math.round(Math.sqrt(c.lo*c.hi)), T = trackOf(c.cut);
      row.innerHTML = `<span><b>${name(c.a)}</b> and <b>${name(c.b)}</b> in the ${c.band} (${fmtHz(c.lo)}–${fmtHz(c.hi)} Hz): ${Math.round(c.overlap*100)}% at the same moments. It matters less to <b>${name(c.cut)}</b>.</span>`;
      // (a dip on the one it matters less to; not on a rack whose kick is its own stem, which would dip the kick too)
      if (!(T && T.pads && T.pads.kick)) { const cut = h('button', null, `Dip ${name(c.cut)} 3 dB at ${fmtHz(f)}`);
        cut.onclick = () => { const ch = chainOf(c.cut); let eq = ch.find(z => z.type === 'eq'); if (!eq) { eq = {type: 'eq', bands: []}; ch.unshift(eq); }
          eq.bands.push({type: 'bell', f, q: 1.2, g: -3}); cut.disabled = true; cut.textContent = 'Dipped: render or play to hear'; rechained(); };
        row.appendChild(cut); }
      e.appendChild(row);
    }
  } catch (err) { e.textContent = 'It failed: ' + err.message; }
  b.disabled = false;
};

/* ---------- the song as data ---------- */
// JSON with the short arrays (notes, points) kept on one line each
const pretty = o => JSON.stringify(o, null, 2).replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (m, x) => '[' + x.replace(/\s*\n\s*/g, ' ') + ']');
const showData = () => { $('json').value = pretty(song); dataStale = false; $('dmsg').textContent = ''; $('dmsg').className = 'dmsg'; };
setInterval(() => { if (dataStale && document.activeElement !== $('json')) showData(); }, 1000);
$('copy').onclick = async () => { const t = $('json'); try { await navigator.clipboard.writeText(t.value); $('dmsg').textContent = 'Copied.'; } catch (e) { t.select(); $('dmsg').textContent = 'Selected: copy it with your keyboard.'; } };
$('paste').onclick = () => {
  let s; try { s = JSON.parse($('json').value); } catch (e) { $('dmsg').textContent = 'That isn’t valid JSON: ' + e.message; $('dmsg').className = 'dmsg bad'; return; }
  const bad = check(s); if (bad.length) { $('dmsg').textContent = bad.slice(0, 4).join(' · '); $('dmsg').className = 'dmsg bad'; return; }
  const was = player && player.playing; songs[idx] = s; load(idx); if (was) build().then(pl => { pl.play({bar: 0}); setPlay(); }); $('dmsg').textContent = 'Loaded.';
};

/* ---------- making your own: a new song, a new clip ---------- */
// a new, empty clip for a track (a bar long; a drum rack's gets a row for each pad), put in the session's "new" row
function newClip(T){
  let i = 0, id; do { id = String.fromCharCode(97 + (i % 26)) + (i >= 26 ? Math.floor(i/26) : ''); i++; } while (T.clips[id]);
  T.clips[id] = T.inst.type === 'drums' ? {bars: 1, hits: Object.fromEntries(Object.keys(T.pads || {kick: 1}).map(k => [k, '.'.repeat(16)]))} : {bars: 1, notes: []};
  let sc = song.scenes.find(x => x.id === 'new'); if (!sc) { sc = {id: 'new', clips: {}}; song.scenes.push(sc); }
  sc.clips[T.id] = id; sel = T.id; selClip = id; dataStale = true; drawSession(); return id;
}
// a song of the user's own, as a new tab (saved straight away, so it comes back)
function addMine(s, id = myId()){ songs.push(s); pristine.push(structuredClone(s)); ids.push(id); mine.push(true); addSongTab(songs.length - 1); return songs.length - 1; }
$('newSong').onclick = () => { if (player) player.stop();
  const i = addMine(blankSong(mine.filter(Boolean).length + 1)); load(i); setPlay(); };
function addSongTab(i){ const b = h('button', null, esc(songs[i].title)); b.onclick = () => { const was = player && player.playing; load(i); if (was) build().then(pl => { pl.play({bar: 0}); setPlay(); }); }; $('songs').appendChild(b); }

/* ---------- the library: save what you made, load it back (and Claude can read it) ---------- */
const libMsg = (t, bad) => { $('libMsg').textContent = t; $('libMsg').className = 'dmsg' + (bad ? ' bad' : ''); };
const nameOr = def => ($('libName').value.trim() || def);
$('saveClip').onclick = async () => { const {T} = ownerOf(sel); if (!T || !selClip) return libMsg('Open a track\'s clip first (click it in the session).', true);
  const tr = {...T, clips: {[selClip]: T.clips[selClip]}};
  await LIB.save({name: nameOr(`${T.name || T.id} ${selClip}`), kind: 'clip', song: song.title, bpm: song.bpm, key: song.key || '', data: {track: tr, clip: selClip}}); libMsg('Saved.'); $('libName').value = ''; };
$('saveTrack').onclick = async () => { const {T} = ownerOf(sel); if (!T) return libMsg('Open a track first (its name in the mixer).', true);
  await LIB.save({name: nameOr(T.name || T.id), kind: 'track', song: song.title, bpm: song.bpm, key: song.key || '', data: {track: T}}); libMsg('Saved.'); $('libName').value = ''; };
$('saveSong').onclick = async () => { await LIB.save({name: nameOr(song.title), kind: 'song', song: song.title, bpm: song.bpm, key: song.key || '', data: {song}}); libMsg('Saved.'); $('libName').value = ''; };
// loading: a song opens as its own tab; a track joins the open song; a clip joins the open track if it can play it (drums
// on a drum track, notes on a synth), else comes in with its own track
function loadItem(it){
  const d = structuredClone(it.data);
  if (it.kind === 'song') { d.song.title = it.name; load(addMine(d.song)); return libMsg(`Opened ${it.name}.`); }
  const {T} = ownerOf(sel), clip = d.track.clips[d.clip], fits = it.kind === 'clip' && T && (!!clip.hits === (T.inst.type === 'drums'));
  if (fits) { let id = d.clip; while (T.clips[id]) id += "'"; T.clips[id] = clip; let sc = song.scenes.find(x => x.id === 'new'); if (!sc) song.scenes.push(sc = {id: 'new', clips: {}}); sc.clips[T.id] = id;
    selClip = id; dataStale = true; drawSession(); drawDetail(); markSel(); if (player && player.playing) player.launchClip(T.id, id, 'new'); return libMsg(`Added ${it.name} to ${T.name || T.id} as clip ${id}.`); }
  const tr = d.track; let id = tr.id; while (song.tracks.some(t => t.id === id)) id += '2';
  // (a track's sidechain still listens to the song's kick if it has one; sends to returns the song lacks are dropped)
  tr.id = id; tr.name = tr.name || id; for (const x of (tr.mix || {}).chain || []) if (x.type === 'sc' && !song.tracks.some(t => x.src === t.id || (x.src || '').startsWith(t.id + ':'))) x.src = song.tracks.find(t => t.pads && t.pads.kick) ? song.tracks.find(t => t.pads && t.pads.kick).id + ':kick' : (song.tracks[0] || {}).id;
  if ((tr.mix || {}).sends) for (const r in tr.mix.sends) if (!(song.returns || []).some(x => x.id === r)) delete tr.mix.sends[r];
  if (tr.mix && tr.mix.to && ![...(song.groups || []), ...song.tracks].some(x => x.id === tr.mix.to)) delete tr.mix.to;
  song.tracks.push(tr); let sc = song.scenes.find(x => x.id === 'new'); if (!sc) song.scenes.push(sc = {id: 'new', clips: {}}); sc.clips[id] = Object.keys(tr.clips)[0];
  sel = id; selClip = Object.keys(tr.clips)[0]; dataStale = true;
  const bad = check(song); if (bad.length) { song.tracks.pop(); delete sc.clips[id]; return libMsg('It doesn\'t fit this song: ' + bad[0], true); }
  if (player) { const was = player.playing; player.rebuild(); if (!was) player.stop(); }
  drawSession(); drawMixer(); drawDetail(); markSel(); libMsg(`Added the track ${tr.name}.`);
}
const KIND = {clip: 'Loop', track: 'Track', song: 'Song'};
function drawLib(items){
  const ul = $('libList'); ul.innerHTML = '';
  if (!items.length) { ul.appendChild(h('li', 'empty', 'Nothing saved yet. Make something (a clip in the steps or the piano roll, or in the Play view), then save it here.')); return; }
  for (const it of items) {
    const li = h('li'), when = it.at ? new Date(it.at).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'}) : '';
    li.innerHTML = `<span class="lk">${KIND[it.kind] || it.kind}</span><b>${esc(it.name)}</b><span class="lm">${esc(it.song || '')} · ${it.bpm || ''} BPM · ${esc(when)}</span>`;
    const ld = h('button', null, it.kind === 'song' ? 'Open' : 'Add'); ld.onclick = () => loadItem(it);
    const rn = h('button', null, 'Rename'); rn.onclick = () => { const v = $('libName').value.trim(); if (!v) return libMsg('Type the new name in the box above, then Rename.', true); LIB.rename(it.id, v); $('libName').value = ''; };
    const del = h('button', 'del', 'Delete'); del.onclick = () => { if (del.dataset.sure) { LIB.remove(it.id); return; } del.dataset.sure = 1; del.textContent = 'Sure?'; setTimeout(() => { delete del.dataset.sure; del.textContent = 'Delete'; }, 3000); };
    li.append(ld, rn, del); ul.appendChild(li);
  }
}
LIB.onLibrary(drawLib);
LIB.start().then(() => { $('libWhere').textContent = 'saved in ' + LIB.where(); });

/* ---------- jam: parts made on the spot, to start a track from nothing or play along with the user's ---------- */
// (each part it made: the track, what part, its first take and seed, so Evolve varies round it and Follow can remake it)
const JAM = {style: 'minimal', energy: .55, expr: .65, follow: true, evolve: false, seed: Math.floor(Math.random()*1e5), parts: {}, phrase: -1};
const TEMPO = {minimal: 124, driving: 128, hypnotic: 126, broken: 122, dub: 118, acid: 130}, KEYS = ['A minor', 'D minor', 'F minor', 'G minor', 'C minor', 'E minor', 'D dorian', 'A dorian'];
// which track plays what: the song's own, or one like the blank song's added for it
const ROLE = {drums: T => T.inst.type === 'drums', bass: T => /bass|sub/i.test(T.id + ' ' + (T.name || '')) && T.inst.type !== 'drums',
  chords: T => /pad|chord|stab|drone/i.test(T.id + ' ' + (T.name || '')), hook: T => /pluck|arp|seq|blip|lead|bell|hook/i.test(T.id + ' ' + (T.name || ''))};
const FROM = {drums: 'drums', bass: 'bass', chords: 'pad', hook: 'pluck'};
function roleTrack(role){
  const T = song.tracks.find(ROLE[role]); if (T) return T;
  const N = structuredClone(blankSong(1).tracks.find(t => t.id === FROM[role])); let id = N.id; while (song.tracks.some(t => t.id === id)) id += '2'; N.id = id; N.clips = {};
  // (its sidechain on the song's kick, if it has one; its sends only to returns the song has)
  const rack = song.tracks.find(t => t.pads && t.pads.kick), m = N.mix || {};
  m.chain = (m.chain || []).filter(d => d.type !== 'sc' || rack).map(d => d.type === 'sc' ? {...d, src: rack.id + ':kick'} : d);
  for (const r in m.sends || {}) if (!(song.returns || []).some(x => x.id === r)) delete m.sends[r];
  song.tracks.push(N); return N;
}
// the drum clip the music is playing (or the one open, or the jam's): what the bass listens to and new hats go over
function grooveClip(){
  const D = song.tracks.find(ROLE.drums); if (!D) return null;
  const n = player && player.playing ? Math.floor(player.pos()) : -1, id = n >= 0 && player.E.clipOf(D.id, n) || (sel === D.id && selClip) || (D.clips.jam ? 'jam' : Object.keys(D.clips)[0]);
  return D.clips[id] || null;
}
const beats = set => [...set].sort((a, b) => a - b).map(i => i % 4 ? `${Math.floor(i/4) + 1}${['', 'e', '&', 'a'][i % 4]}` : `${i/4 + 1}`).join(' ');
const jamSay = html => { $('jamSay').innerHTML = html; };
// make one part (a new take each time: a new seed) into its track's "jam" clip, in the session's jam row; launched on
// the next bar if it's playing. quiet: don't move the page's attention (Follow remaking the bass while the drums are edited)
function jamMake(part, {seed = ++JAM.seed, launch = true, quiet = false} = {}){
  const role = ['drums', 'hats', 'perc'].includes(part) ? 'drums' : part, had = song.tracks.length, T = roleTrack(role), key = song.key || 'A minor';
  const o = {style: JAM.style, energy: JAM.energy, expr: JAM.expr, seed, key};
  let clip, said;
  if (role === 'drums') {
    const base = part === 'drums' ? null : grooveClip();
    clip = makeDrums({...o, part, bars: JAM.style === 'hypnotic' ? 4 : 2, base: base ? base.hits : null});
    said = part === 'hats' ? `<b>Hats</b>: ${(clip.hits.chh || '').replace(/[^1-9?]/g, '').length} hits on a ${(clip.hits.chh || '').length}-step row${clip.hits.ohh ? ', open hats on the off-beats' : ''}, over the drums playing`
      : part === 'perc' ? `<b>Percussion</b>: ${Object.keys(clip.hits).filter(k => ['rim', 'clave', 'shaker'].includes(k)).join(', ')} round the kick` : `<b>Drums</b> (${STYLES[JAM.style].label.toLowerCase()}): kick on ${beats(grooveOf(clip).kick)}`;
  } else if (part === 'bass') {
    const g = grooveOf(grooveClip()); clip = makeBass({...o, groove: g});
    said = `<b>Bass</b>: ${clip.notes.length} notes in ${key}${clip.steps ? `, a ${clip.steps}-step loop` : ''}, round the kick on ${beats(g.kick) || 'nothing yet'}`;
  } else if (part === 'chords') {
    const B = song.tracks.find(ROLE.bass), bn = B && B.clips.jam ? B.clips.jam.notes : null; clip = makeChords({...o, bass: bn});
    said = `<b>Chords</b>: ${clip.notes.length} ${JAM.style === 'hypnotic' && JAM.energy < .5 ? 'held' : 'stabs'} in the gaps the bass leaves`;
  } else { clip = makeHook(o); said = `<b>Hook</b>: ${clip.notes.length} notes${clip.steps ? `, a ${clip.steps}-step loop against the bar` : ''}`; }
  T.clips.jam = clip; JAM.parts[T.id] = {part, base: structuredClone(clip), seed};
  let sc = song.scenes.find(x => x.id === 'jam'); if (!sc) song.scenes.push(sc = {id: 'jam', clips: {}}); sc.clips[T.id] = 'jam';
  forget(clip); dataStale = true;
  if (song.tracks.length !== had && player) { const was = player.playing; player.rebuild(); if (!was) player.stop(); }
  if (launch && player && player.playing) player.launchClip(T.id, 'jam', 'jam');
  drawSession();
  if (!quiet) { if (song.tracks.length !== had) drawMixer(); sel = T.id; selClip = 'jam'; drawDetail(); markSel(); jamSay(said + `. <span class="dim">Again for another take.</span>`); }
  // (new drums: the bass it made fits itself to them, as when they're changed by hand)
  if (role === 'drums' && !quiet) { const B = song.tracks.find(ROLE.bass); if (JAM.follow && B && JAM.parts[B.id]) { jamMake('bass', {seed: JAM.parts[B.id].seed, launch: false, quiet: true}); $('jamSay').insertAdjacentHTML('beforeend', ' The bass refitted itself.'); } }
  return T;
}
$('jamStyle').innerHTML = Object.entries(STYLES).map(([k, v]) => `<option value="${k}" title="${esc(v.words)}">${esc(v.label)}</option>`).join('');
$('jamStyle').onchange = () => { JAM.style = $('jamStyle').value; jamSay(`<b>${STYLES[JAM.style].label}</b>: ${esc(STYLES[JAM.style].words)}.`); };
$('jamEnergy').oninput = () => { JAM.energy = +$('jamEnergy').value; };
$('jamExpr').oninput = () => { JAM.expr = +$('jamExpr').value; };
$('jamFollow').onchange = () => { JAM.follow = $('jamFollow').checked; };
$('jamEvolve').onchange = () => { JAM.evolve = $('jamEvolve').checked; JAM.phrase = -1; };
document.querySelectorAll('[data-jam]').forEach(b => b.onclick = () => {
  const p = b.dataset.jam;
  if (p === 'all') { for (const q of ['drums', 'bass', 'chords', 'hook']) jamMake(q); jamSay(`<b>Everything</b> (${STYLES[JAM.style].label.toLowerCase()}): drums, a bass round the kick, chords in its gaps and a hook, in ${esc(song.key || 'A minor')}.`); }
  else jamMake(p);
  if (!(player && player.playing)) build().then(pl => { pl.play({scene: 'jam'}); setPlay(); });
});
// a new song, made to jam in: its tempo and key from the style, drums and a bass made for each other, playing
$('jamStart').onclick = () => {
  if (player) player.stop();
  const s0 = blankSong(mine.filter(Boolean).length + 1, {bpm: TEMPO[JAM.style], key: KEYS[Math.floor(Math.random()*KEYS.length)]});
  s0.title = `${STYLES[JAM.style].label} jam ${mine.filter(Boolean).length + 1}`; load(addMine(s0)); JAM.parts = {};
  jamMake('drums', {launch: false}); jamMake('bass', {launch: false});
  build().then(pl => { pl.play({scene: 'jam'}); setPlay(); });
  jamSay(`<b>${esc(song.title)}</b>, ${song.bpm} BPM in ${esc(song.key)}: drums and a bass round their kick. Add hats, chords or a hook; change the drums and the bass follows; Evolve keeps it moving.`);
};
$('jamKeep').onclick = async () => {
  const {T} = ownerOf(sel); if (!T || !T.clips.jam) return jamSay('Open a track with a jam clip first (its name in the mixer).');
  const P = JAM.parts[T.id] || {part: 'part', seed: 0};
  await LIB.save({name: `${STYLES[JAM.style].label} ${P.part} ${P.seed}`, kind: 'clip', song: song.title, bpm: song.bpm, key: song.key || '', data: {track: {...T, clips: {jam: T.clips.jam}}, clip: 'jam'}});
  jamSay(`Kept in the library as <b>${STYLES[JAM.style].label} ${P.part} ${P.seed}</b>.`);
};
// Follow: the drums changed (by hand, or a new take), so the bass it made fits itself to the kick again
function jamFollow(clip){
  if (!JAM.follow) return; const D = song.tracks.find(ROLE.drums), B = song.tracks.find(ROLE.bass);
  if (!D || !B || !JAM.parts[B.id] || !Object.values(D.clips).includes(clip)) return;
  jamMake('bass', {seed: JAM.parts[B.id].seed, launch: false, quiet: true});
  jamSay(`The bass fitted itself to your kick on ${beats(grooveOf(clip).kick)}.`);
}
// Evolve: on each four-bar line the scheduler reaches, each part it made becomes a new variation of its first take; every
// sixteen bars the hats are made again a little busier or calmer, building and settling
function jamEvolve(){
  if (!JAM.evolve || !player || !player.playing) return;
  const ph = Math.floor((player.E.n + 1)/64); if (ph === JAM.phrase) return; JAM.phrase = ph; if (ph < 1) return;
  for (const [id, P] of Object.entries(JAM.parts)) {
    const T = trackOf(id); if (!T || !T.clips.jam) continue;
    let v = vary(P.base, {seed: P.seed + ph, amount: .25 + .35*JAM.energy, key: song.key || 'A minor'});
    if (P.part === 'drums' && ph % 4 === 0) v = makeDrums({style: JAM.style, part: 'hats', seed: P.seed + ph, expr: JAM.expr, energy: Math.max(0, Math.min(1, JAM.energy + .3*Math.sin(ph*Math.PI/8))), bars: v.bars, base: v.hits});
    T.clips.jam = v; forget(v);
  }
  dataStale = true;
  if (clipFor && clipFor[1] === 'jam') { const [T, id, ti] = clipFor, old = clipBox, nb = clipView(T, id, ti); if (old && old.isConnected) old.replaceWith(nb); }
}

// (on its own timer, as the scheduler is: drawing stops in a hidden tab, and the jam shouldn't)
setInterval(jamEvolve, 200);

/* ---------- the play view (touch first, for the iPad) ---------- */
const pv = mountPlay({song: () => song, player: () => player, ctx: () => audio(), build, edited, setVal, newClip: T => newClip(T),
  select: (track, clip) => { sel = track; selClip = clip; drawDetail(); markSel(); }, sel: () => ({track: ownerOf(sel).T ? ownerOf(sel).T.id : null, clip: selClip}),
  stepsOf: (T, clip) => clip.hits || T.inst.type === 'drums' ? drumSteps(T, clip) : noteSteps(T, Object.keys(T.clips).find(k => T.clips[k] === clip), clip), hue: HUE, padLabel});
$('playView').onclick = () => pv.open();

/* ---------- your changes, kept: every edit to a song is saved a moment after it settles ---------- */
// what was last saved of each song (by id), and what was seen at the last look (a song saves once it holds still a second)
const savedJson = {}, seen = {};
let saving = 0, saveErr = '', storeReady = false;
const jsonOf = i => JSON.stringify(songs[i]);
const changedFrom = i => savedJson[ids[i]] != null ? savedJson[ids[i]] !== jsonOf(i) : jsonOf(i) !== JSON.stringify(pristine[i]) || mine[i];
function showSaved(){
  const e = $('saved'), i = idx, dirty = changedFrom(i), edited = !mine[i] && jsonOf(i) !== JSON.stringify(pristine[i]);
  e.textContent = saveErr ? 'Not saved: ' + saveErr : !storeReady ? '' : saving ? 'Saving…' : dirty ? 'Unsaved changes…' : edited || mine[i] ? 'Saved in ' + SAVE.where() : 'As written';
  e.className = 'saved' + (dirty || saveErr ? ' dirty' : '');
  $('revert').hidden = mine[i] || !edited;
}
let looking = false;
async function autosave(){
  if (!storeReady || looking) return;
  looking = true;
  for (let i = 0; i < songs.length; i++) {
    const j = jsonOf(i), id = ids[i], was = seen[id]; seen[id] = j;
    if (!changedFrom(i) || j !== was) continue;
    saving++; showSaved();
    try { await SAVE.put(id, songs[i], mine[i]); savedJson[id] = j; saveErr = ''; } catch (e) { saveErr = e.code || e.message || 'error'; }
    saving--;
  }
  looking = false; showSaved();
}
setInterval(autosave, 1000);
$('revert').onclick = async () => {
  const b = $('revert'); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Sure? Your changes go'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Revert to original'; }, 3000); return; }
  delete b.dataset.sure; b.textContent = 'Revert to original'; revert();
};
async function revert(){
  const was = player && player.playing, id = ids[idx];
  songs[idx] = structuredClone(pristine[idx]); delete savedJson[id]; seen[id] = jsonOf(idx);
  load(idx); if (was) build().then(pl => { pl.play({bar: 0}); setPlay(); });
  try { await SAVE.drop(id); } catch (e) {}
  showSaved();
}
// the saved versions come in once the store answers: a built-in song as the user left it, and their own songs as tabs
SAVE.start().then(() => {
  for (const d of SAVE.all()) {
    if (check(d.song).length) continue;
    const i = ids.indexOf(d.id);
    if (i < 0) { addMine(d.song, d.id); savedJson[d.id] = JSON.stringify(d.song); continue; }
    const untouched = jsonOf(i) === JSON.stringify(pristine[i]);
    savedJson[d.id] = JSON.stringify(d.song);
    if (untouched) { songs[i] = d.song; if (i === idx && !(player && player.playing)) load(i); }
  }
  storeReady = true; showSaved();
});

/* ---------- start ---------- */
SONGS.forEach((s, i) => addSongTab(i));
load(0);
// (for tests: the player, the song, a reset to the song as written, and saving now)
window.__studio = {get player(){ return player; }, get song(){ return song; }, reset: revert, load, view, setRef, jam: JAM, jamMake, jamEvolve, saveNow: async () => { await SAVE.start(); for (const i in songs) seen[ids[i]] = jsonOf(i); await autosave(); }};
