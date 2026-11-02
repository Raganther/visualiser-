// The sound lab: a round of analog sounds (sounds.js) to like or not. Each plays alone, in a phrase for its role, or in
// that phrase over a quiet groove, live in the audio thread (lab.worklet.js), at matched loudness (the build measured
// them: __GAINS__). A rating and a note per sound go to the page's database (`ratings`, a document a sound: rating 1
// like, 2 maybe, -1 not for me), where Claude reads them; without a database they stay on this device and can be copied.
// Each sound opens in the workbench: its instrument's settings (the synth's, or each drum's) to change as it plays, your
// version kept with your rating (`edits`) and Back to the original, and keys to play it (on screen, or the computer's).
import { ROUNDS, ALL, INTROS, GROUPS, ROUND, BPM, BARS, FAMILIES, grooveFor } from './sounds.js';
import { MUSIC, MGROUPS, MROUND, MROUNDS, MSOUNDS, KIT, LEVELS } from './music.js';
import { $, h } from '../lib/dom.js';
import { control } from '../lib/parts/shell.js';
import { PARAMS as APAR, DEF as ADEF } from '../lib/native/asynth.js';
import { PARAMS as NPAR, DEF as NDEF } from '../lib/native/npoly.js';
// each synth engine's settings and their defaults
const ENG = s => s.engine === 'npoly' ? {PARAMS: NPAR, DEF: NDEF} : {PARAMS: APAR, DEF: ADEF};
import { APARAMS, analogParams } from '../lib/native/analogkit.js';
import { voiceName, noteName, SHARPS } from '../lib/names.js';

const GAIN = __GAINS__, LEN = BARS*16;
// the master tempo: every phrase, groove and idea plays at it (kept on this device)
let sd = 60/BPM/4;
const load = (k, d) => { try { const v = localStorage.getItem('soundlab.' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem('soundlab.' + k, JSON.stringify(v)); } catch {} };
const S = {side: load('side', 'sounds'), mtab: MROUNDS[load('mtab', '')] || load('mtab', '') === 'kept' ? load('mtab', '') : 'm' + MROUND, bpm: load('bpm', BPM), tab: ['families', 'new', 'kept', 'palette'].includes(load('tab', 'families')) ? load('tab', 'families') : 'families', pal: load('pal', null), palLv: load('palLv', {}), palMute: load('palMute', {}), sel: load('sel', {}), prev: {}, playing: null, rate: {}, db: null, vol: 1, room: 1, ed: null, loaded: null, oct: 0, held: new Map()};
let ctx = null, node = null, out = null, timer = 0, next = 0, slot = 0, endAt = 0;

/* ---------- the sound ---------- */
async function start(){ if (ctx) { if (ctx.state !== 'running') await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'interactive'});
  const u = URL.createObjectURL(new Blob([$('worklet-src').textContent], {type: 'text/javascript'})); await ctx.audioWorklet.addModule(u);
  node = new AudioWorkletNode(ctx, 'sound-lab', {numberOfInputs: 0, outputChannelCount: [2]}); node.port.postMessage({type: 'room', v: S.room}); out = ctx.createGain(); out.gain.value = S.vol; node.connect(out); out.connect(ctx.destination); }
const send = m => node?.port.postMessage({...m, period: 4*sd});
const byId = id => ALL.find(s => s.id === id) || MSOUNDS.find(s => s.id === id) || MUSIC.find(s => s.id === id);
// the sounds on the page: a round's, or the ones you've kept from any round
const shown = () => S.tab === 'kept' ? ALL.filter(s => S.rate[s.id]?.keep) : S.tab === 'families' ? FAMILIES.map(f => byId(selOf(f))) : ROUNDS[ROUND];
// the palette: a sound for each part, playing together on one loop (each its own phrase, all in A at 122)
const SLOTS = [['kit', 'Kit', ['kits', 'kick']], ['hats', 'Hats', ['hats']], ['perc', 'Percussion', ['perc']], ['bass', 'Bass', ['bass']], ['chords', 'Chords', ['chords']], ['lead', 'Lead', ['lead', 'texture']]];
const PAL0 = {kit: 'kitmine', hats: null, perc: 'tomsdry', bass: 'fmshort', chords: 'gatedsoft', lead: 'bellsoft'}, LV0 = {kit: 1, hats: .8, perc: .7, bass: .9, chords: .6, lead: .65};
const palPick = k => (S.pal || PAL0)[k] ?? null;
// a part's choices: the sounds of its kind you liked or kept (and the one picked, whatever it is), newest round first
const palChoices = (k, roles) => ALL.filter(x => roles.includes(x.role) && (S.rate[x.id]?.rating === 1 || S.rate[x.id]?.keep || x.id === palPick(k))).sort((a, b) => b.round - a.round);
function palSlot(k){ const id = palPick(k), s = id && byId(id), lv = S.palLv[k] ?? LV0[k];
  send(s ? {type: 'slot', slot: k, inst: s.kind === 'drum' ? 'kit' : s.engine, kit: s.kit, over: s.kind === 'drum' ? overOf(s) : null, params: s.kind === 'synth' ? {...patchOf(s), period: 60/BPM} : null, gain: GAIN[id], level: lv, room: s.room, mute: !!S.palMute[k]} : {type: 'slot', slot: k, inst: null}); }
function palSave(){ keep('pal', S.pal || PAL0); keep('palLv', S.palLv); keep('palMute', S.palMute);
  if (S.db) S.db.doc('palette/mine').set({picks: S.pal || PAL0, levels: S.palLv, mutes: S.palMute, at: new Date().toISOString()}).catch(() => {}); }
/* ---------- the music: a part alone or with the band, an idea whole ---------- */
let mslots = 0;
function loadParts(parts){ for (let i = 0; i < Math.max(mslots, parts.length); i++) { const x = parts[i];
    if (!x) { send({type: 'slot', slot: 'm' + i, inst: null}); continue; } const s = byId(x.sound);
    send({type: 'slot', slot: 'm' + i, inst: s.kind === 'drum' ? 'kit' : s.engine, kit: s.kit, over: s.kind === 'drum' ? overOf(s) : null, params: s.kind === 'synth' ? {...patchOf(s), period: 4*sd} : null,
      gain: GAIN[s.id], level: (LEVELS[x.slot] ?? .7)*(x.level ?? 1), room: s.room}); }
  mslots = parts.length; }
async function playMusic(id, mode){ const was = S.playing; stop(); if (S.ed) closeEd(); if (was?.id === id && was.mode === mode) return; await start();
  const it = byId(id), parts = mode === 'band' ? [...it.own, ...it.band] : it.own; loadParts(parts);
  S.playing = {id, mode, parts, bars: Math.max(2, Math.ceil(it.bars))}; slot = 0; next = ctx.currentTime + .08; send({type: 'clock', t0: next}); endAt = Infinity;
  tick(); timer = setInterval(tick, 25); paint(); }
const MMODES = [['alone', 'Alone'], ['band', 'With the band']];
const MKIND = {groove: 'Drum groove', bass: 'Bass line', chords: 'Progression', riff: 'Riff', idea: 'Idea'};
function musicCard(m, i){ const r = S.rate[m.id] || {};
  const note = h('textarea', {id: 'note-' + m.id, rows: 2, placeholder: 'A note, if you like: what works, what doesn\'t'}); note.value = r.note || ''; note.oninput = () => rate(m.id, {note: note.value});
  const sounds = [...new Set(m.own.map(x => byId(x.sound).name))].join(', ');
  return h('article', {class: 'snd music', id: 'snd-' + m.id, 'data-rating': r.rating || 0},
    h('div', {class: 'top'}, h('span', {class: 'num'}, String(i + 1).padStart(2, '0')), h('h3', {}, m.name), h('span', {class: 'src'}, MKIND[m.mkind] + ` · ${Math.max(2, Math.ceil(m.bars))} bars`)),
    h('div', {class: 'tools'}, h('span', {class: 'mine', hidden: true}), h('button', {class: 'keep', 'aria-pressed': String(!!r.keep), onclick: () => { rate(m.id, {keep: !S.rate[m.id]?.keep}); paintTabs(); }}, r.keep ? '★ Kept' : '☆ Keep')),
    h('p', {class: 'from'}, 'On ', h('b', {}, sounds)),
    h('p', {}, m.words),
    h('div', {class: 'plays two', role: 'group', 'aria-label': 'Play ' + m.name}, ...(m.mkind === 'idea' ? [['alone', 'Play it']] : MMODES).map(([md, label]) => h('button', {class: 'play', 'data-mode': md, 'aria-pressed': 'false', onclick: () => playMusic(m.id, md)}, h('span', {class: 'ico', 'aria-hidden': 'true'}), label))),
    h('div', {class: 'rate', role: 'group', 'aria-label': 'Rate ' + m.name}, ...RATES.map(([v, label]) => h('button', {'data-v': v, 'aria-pressed': String(r.rating === v), onclick: () => rate(m.id, {rating: (S.rate[m.id]?.rating === v ? 0 : v)})}, label))),
    note); }
function paintMusic(){ const list = S.mtab === 'kept' ? MUSIC.filter(m => S.rate[m.id]?.keep) : MROUNDS[S.mtab];
  $('meta').textContent = S.mtab === 'kept' ? `Music · kept · ${list.length}` : `Music · round ${S.mtab.slice(1)} · ${list.length} parts and ideas · in A, at the tempo you set`;
  $('lede').textContent = S.mtab === 'kept' ? 'The musical parts you have kept.' : S.mtab === 'm2' ? 'Round 2, from your ratings: darker and more minimal, fewer open hats on the off-beat, more space; and every part on its own sound now, not the same pad and bass, with new sounds that move by themselves: a pulsing bass, a delayed bass, a slow sweep, sample and hold, a dark arp, muted keys, a throbbing chord, a drone, dub stabs. Ideas first. Hear a part alone, or with the band (plain and dark, never the pad). Tempo at the top changes the speed of everything.' : 'Musical parts to like or not, as the sounds were: drum grooves, bass lines, chord progressions and riffs, and ideas with them all together. Everything plays on your own palette sounds, so only the music changes. Hear a part alone, or with the band: the same plain backing every time. Tempo at the top changes the speed of everything.';
  const groups = MGROUPS.map(([k, title]) => { const xs = list.filter(m => m.mkind === k); if (!xs.length) return null;
    return h('section', {class: 'group'}, h('h2', {}, title, h('small', {}, ` ${xs.length}`)), h('div', {class: 'cards'}, ...xs.map(m => musicCard(m, list.indexOf(m))))); }).filter(Boolean);
  $('groups').replaceChildren(...(groups.length ? groups : [h('p', {class: 'empty'}, 'Nothing kept yet. Press ☆ Keep on any part and it will be here.')]));
  const n = list.filter(m => S.rate[m.id]?.rating).length; $('count').textContent = `${n} of ${list.length} rated`; $('likes').textContent = ''; $('bar').style.setProperty('--done', list.length ? n/list.length : 0); paint(); }
function setTempo(b){ S.bpm = Math.round(b); sd = 60/S.bpm/4; keep('bpm', S.bpm); $('bpmOut').textContent = S.bpm + ' BPM'; $('bpm').value = S.bpm; send({type: 'set', params: {}}); }
async function playPalette(){ const was = S.playing; stop(); if (S.ed) closeEd(); if (was?.mode === 'palette') return; await start();
  for (const [k] of SLOTS) palSlot(k); S.playing = {id: 'palette', mode: 'palette'}; slot = 0; next = ctx.currentTime + .08; send({type: 'clock', t0: next}); endAt = Infinity;
  tick(); timer = setInterval(tick, 25); paint(); }
function paintPalette(){ const rows = SLOTS.map(([k, label, roles]) => { const id = palPick(k), ch = palChoices(k, roles), lv = S.palLv[k] ?? LV0[k];
    const sel = h('select', {id: 'pal-' + k, 'aria-label': label}, h('option', {value: ''}, '— none —'), ...ch.map(x => h('option', {value: x.id, selected: x.id === id}, `${x.name} · R${x.round}${S.rate[x.id]?.keep ? ' ★' : ''}${S.rate[x.id]?.edits ? ' · yours' : ''}`)));
    sel.onchange = () => { S.pal = {...(S.pal || PAL0), [k]: sel.value || null}; palSave(); if (S.playing?.mode === 'palette') palSlot(k); paintPalette(); };
    const r = h('input', {type: 'range', min: 0, max: 1.5, step: .01, value: lv, 'aria-label': label + ' level'}); r.oninput = () => { S.palLv[k] = +r.value; send({type: 'mix', slot: k, level: +r.value}); palSave(); };
    const m = h('button', {class: 'ghost', 'aria-pressed': String(!!S.palMute[k]), onclick: () => { S.palMute[k] = !S.palMute[k]; send({type: 'mix', slot: k, mute: S.palMute[k]}); palSave(); paintPalette(); }}, S.palMute[k] ? 'Muted' : 'Mute');
    const open = id ? h('button', {class: 'ghost', onclick: () => { S.tab = 'families'; keep('tab', S.tab); paintAll(); setTimeout(() => $('snd-' + id)?.scrollIntoView({block: 'center'}), 50); }}, 'See it') : null;
    return h('div', {class: 'palrow'}, h('b', {}, label), sel, h('label', {class: 'vol'}, 'Level ', r), m, open); });
  $('groups').replaceChildren(h('section', {class: 'palette'}, h('div', {class: 'palhead'}, h('button', {id: 'palPlay', class: 'play', 'aria-pressed': String(S.playing?.mode === 'palette'), onclick: playPalette}, h('span', {class: 'ico', 'aria-hidden': 'true'}), S.playing?.mode === 'palette' ? 'Stop the palette' : 'Play the palette together'),
      h('p', {}, 'Each part\'s choices are the sounds of its kind you liked or kept, your edits included. Change one while it plays and it swaps in time. Your picks save as you go.')), ...rows)); }
const famOf = id => FAMILIES.find(f => f.root === byId(id).family), selOf = f => f.members.some(x => x.id === S.sel[f.root]) ? S.sel[f.root] : f.last.id;

// play a sound one of three ways (the same button again stops it)
// a sound as you've left it: the round's settings with your changes over them
const edits = id => S.rate[id]?.edits || null;
const patchOf = s => ({...ENG(s).DEF, ...s.patch, ...(edits(s.id) || {})});
const overOf = s => { const o = {...s.over}, e = edits(s.id) || {}; for (const [v, x] of Object.entries(e)) o[v] = {...(o[v] || {}), ...x}; return o; };
function loadSound(id){ const s = byId(id); S.loaded = id;
  if (s.kind === 'synth') send({type: 'synth', engine: s.engine, params: {...patchOf(s), period: 60/BPM}, gain: GAIN[id], room: s.room}); else send({type: 'kit', kit: s.kit, over: overOf(s), gain: GAIN[id], room: s.room}); }
async function play(id, mode){ const was = S.playing; stop(); if (S.ed && S.ed !== id) closeEd(); if (was && was.id === id && was.mode === mode) return;
  await start(); const s = byId(id); loadSound(id);
  S.playing = {id, mode}; slot = 0; next = ctx.currentTime + .08; send({type: 'clock', t0: next});
  endAt = mode === 'alone' ? (s.kind === 'synth' ? Math.max(...s.alone.map(x => x.s + x.l)) + 24 : 16) : Infinity;
  tick(); timer = setInterval(tick, 25); paint(); }
function stop(){ if (!S.playing) return; S.playing = null; clearInterval(timer); send({type: 'stop'}); paint(); }
// a 16th at a time, a little ahead on the audio clock
function tick(){ const p = S.playing; if (!p) return;
  // music: each part its own loop (from the start of play, or from its bar within the idea's length), swung if it says
  if (p.parts) { const loopLen = p.bars*16; while (next < ctx.currentTime + .12) { const pos = slot % loopLen, lap = Math.floor(slot/loopLen);
      for (const [pi, x] of p.parts.entries()) { const from = (x.from || 0)*16; if (pos < from) continue; const k = from ? pos - from : slot, st = k % x.len, cyc = Math.floor(k/x.len) + (from ? lap*1000 : 0), s = byId(x.sound);
        for (const [i, q] of x.notes.entries()) { if (Math.floor(q.s) !== st) continue; const t = next + (q.s - st)*sd + (x.swing && st % 2 ? x.swing*sd : 0);
          if (s.kind === 'synth') { const nid = `${pi}:${cyc}:${i}`; send({type: 'on', slot: 'm' + pi, id: nid, n: q.n, vel: q.v, t}); send({type: 'off', slot: 'm' + pi, id: nid, t: t + q.l*sd}); }
          else send({type: 'hit', slot: 'm' + pi, v: q.v, vel: q.vel, t}); } }
      next += sd; slot++; } return; }
  if (p.mode === 'palette') { while (next < ctx.currentTime + .12) { const st = slot % LEN, lap = Math.floor(slot/LEN);
      for (const [k] of SLOTS) { const id = palPick(k), s = id && byId(id); if (!s) continue;
        for (const [i, x] of s.phrase.entries()) { if (Math.floor(x.s) !== st) continue; const t = next + (x.s - st)*sd;
          if (s.kind === 'synth') { const nid = `${k}:${lap}:${i}`; send({type: 'on', slot: k, id: nid, n: x.n, vel: x.v, t}); send({type: 'off', slot: k, id: nid, t: t + x.l*sd}); } else send({type: 'hit', slot: k, v: x.v, vel: x.vel, t}); } }
      next += sd; slot++; } return; }
  const s = byId(p.id);
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
function rate(id, patch){ const s = byId(id), r = {...(S.rate[id] || {}), ...patch}; if (r.rating === undefined) r.rating = 0; S.rate[id] = r; keep('rate', S.rate); paintCard(id); count(); if ('rating' in patch && S.tab === 'families' && s.family) paintFamily(s.family); if (s.kind === 'music' && 'rating' in patch && S.side === 'music') { const L = S.mtab === 'kept' ? MUSIC.filter(m => S.rate[m.id]?.keep) : MROUNDS[S.mtab], n = L.filter(m => S.rate[m.id]?.rating).length; $('count').textContent = `${n} of ${L.length} rated`; }
  if (S.db) { saying('Saving…'); clearTimeout(rate.t[id]); rate.t[id] = setTimeout(() => S.db.doc('ratings/' + id).set({rating: r.rating, note: r.note || '', edits: r.edits || null, keep: !!r.keep, name: s.name, kind: s.kind, role: s.role, round: s.round, at: new Date().toISOString()})
    .then(() => saying('Saved'), e => saying(e?.code === 'not_granted' || e?.code === 'forbidden' ? 'Not saved: this page can only save for its owner' : 'Not saved: try again in a moment')), patch.note !== undefined || 'edits' in patch ? 700 : 0); } }
rate.t = {};
function saying(t){ $('saved').textContent = t; }
async function connect(){ S.rate = load('rate', {}); paintAll();
  let db = null; try { db = await window.claude?.use?.('db'); } catch {}
  if (!db) { saying('Saved on this device. Copy your ratings to send them to Claude.'); $('copy').hidden = false; return; }
  S.db = db; saying('Your ratings save as you go.');
  try { const d = await db.doc('palette/mine').get(); const x = d.data?.(); if (x?.picks) { S.pal = x.picks; S.palLv = x.levels || {}; S.palMute = x.mutes || {}; } } catch {}
  try { const q = await db.collection('ratings').get(); for (const d of q.docs) { const x = d.data(); if (x) S.rate[d.id] = {rating: x.rating ?? 0, note: x.note || '', edits: x.edits || null, keep: !!x.keep}; } keep('rate', S.rate); paintAll(); }
  catch { saying('Couldn\'t load your earlier ratings. New ones still save.'); } }
function copyRatings(){ const lines = [...ALL, ...MUSIC].map((s, i) => { const r = S.rate[s.id]; return r?.rating || r?.note || r?.edits || r?.keep ? `Round ${s.round}: ${s.name} (${s.id})${r.keep ? ' ★ kept' : ''}: ${RATES.find(x => x[0] === r.rating)?.[1] || 'unrated'}${r.note ? ' — ' + r.note : ''}${r.edits ? ' · your changes: ' + JSON.stringify(r.edits) : ''}` : null; }).filter(Boolean);
  const txt = `Analog sound lab\n${lines.join('\n') || '(nothing rated yet)'}`;
  const done = () => { saying('Copied: paste it to Claude'); };
  try { navigator.clipboard.writeText(txt).then(done, fallback); } catch { fallback(); }
  function fallback(){ $('dump').hidden = false; $('dump').value = txt; $('dump').select(); saying('Selected: copy it with your keyboard'); } }

/* ---------- the page ---------- */
const MODES = [['alone', 'Alone'], ['phrase', 'Phrase'], ['loop', 'In a loop']];
const source = s => s.kind === 'synth' ? (s.engine === 'npoly' ? 'Native poly synth' : 'Analog synth') : s.kit.replace('Analog ', '') + ' kit';
function card(s, i){ const r = S.rate[s.id] || {};
  const note = h('textarea', {id: 'note-' + s.id, rows: 2, placeholder: 'A note, if you like: what works, what doesn\'t'}); note.value = r.note || '';
  note.oninput = () => rate(s.id, {note: note.value});
  return h('article', {class: 'snd', id: 'snd-' + s.id, 'data-family': s.family, 'data-rating': r.rating || 0},
    h('div', {class: 'top'}, h('span', {class: 'num'}, String(i + 1).padStart(2, '0')), h('h3', {}, s.name), h('span', {class: 'src'}, source(s))),
    h('div', {class: 'tools'}, h('button', {class: 'ghost open', onclick: () => openEd(s.id)}, s.kind === 'synth' ? 'Open the synth' : 'Open the drums'), h('span', {class: 'mine', hidden: !r.edits}, 'Your version'),
      S.tab !== 'new' ? h('span', {class: 'rnd'}, 'Round ' + s.round) : null,
      h('button', {class: 'keep', 'aria-pressed': String(!!r.keep), title: 'Keep this sound: it joins the Kept tab', onclick: () => { rate(s.id, {keep: !S.rate[s.id]?.keep}); if (S.tab === 'kept') paintAll(); else paintFamily(s.family); paintTabs(); }}, r.keep ? '★ Kept' : '☆ Keep')),
    s.from ? h('p', {class: 'from'}, 'From ', h('b', {}, s.from), s.room ? ' · in the room' : '') : (s.room ? h('p', {class: 'from'}, 'In the room') : null),
    h('p', {}, s.words),
    h('div', {class: 'plays', role: 'group', 'aria-label': 'Play ' + s.name}, ...MODES.map(([m, label]) => h('button', {class: 'play', 'data-mode': m, 'aria-pressed': 'false', onclick: () => play(s.id, m)}, h('span', {class: 'ico', 'aria-hidden': 'true'}), label))),
    h('div', {class: 'rate', role: 'group', 'aria-label': 'Rate ' + s.name}, ...RATES.map(([v, label]) => h('button', {'data-v': v, 'aria-pressed': String(r.rating === v), onclick: () => rate(s.id, {rating: (S.rate[s.id]?.rating === v ? 0 : v)})}, label))),
    note); }
/* ---------- families: a card a sound's line, its versions round by round, one heard at a time, A/B between two ---------- */
const RMARK = {1: '👍', 2: '~', '-1': '👎'};
function famCard(f, i){ const sel = selOf(f), cur = byId(sel), prev = S.prev[f.root];
  const chips = f.rounds.map(r => h('div', {class: 'vround'}, h('span', {class: 'vr'}, 'R' + r), ...f.members.filter(x => x.round === r).map(x => { const rt = S.rate[x.id]?.rating;
    return h('button', {class: 'ver', 'aria-pressed': String(x.id === sel), 'data-b': String(x.id === prev), title: `Round ${x.round}: ${x.name}${x.id === prev ? ' (B: the one A/B swaps to)' : ''}`, onclick: () => pick(f, x.id)},
      x.name, rt ? h('i', {class: 'r' + rt}, RMARK[rt]) : null, S.rate[x.id]?.keep ? h('i', {class: 'k'}, '★') : null); })));
  const note = f.ended ? `Last in round ${f.members.at(-1).round}` : f.members.length === 1 ? 'New in round ' + f.members[0].round : '';
  return h('div', {class: 'fam', id: 'fam-' + f.root},
    h('div', {class: 'vers'}, ...chips,
      h('div', {class: 'vtools'}, note ? h('span', {class: 'vnote'}, note) : null,
        f.members.length > 1 ? h('button', {class: 'ab ghost', disabled: !prev, title: prev ? `Swap to ${byId(prev).name}, in time if it's playing` : 'Pick another version first: A/B swaps between the last two', onclick: () => prev && pick(f, prev)}, '⇄ A/B', prev ? h('small', {}, ' ' + byId(prev).name) : null) : null)),
    card(cur, i)); }
// a version picked: shown, and if this line is playing it carries on in time with the new one (A/B); the workbench follows
function pick(f, id){ const was = selOf(f); if (id === was) return; S.prev[f.root] = was; S.sel[f.root] = id; keep('sel', S.sel);
  if (S.playing && famOf(S.playing.id)?.root === f.root) { S.playing.id = id; loadSound(id); }
  if (S.ed && famOf(S.ed)?.root === f.root) { S.ed = id; S.pad = drumsOf(byId(id))[0]; paintEd(); }
  paintFamily(f.root); paint(); }
function paintFamily(root){ const el = $('fam-' + root); if (!el) { const c = document.querySelector(`.snd[data-family="${root}"]`); if (c) paintCard(c.id.slice(4)); return; }
  const f = FAMILIES.find(x => x.root === root); el.replaceWith(famCard(f, FAMILIES.indexOf(f))); }

function paintAll(){ paintSide(); if (S.side === 'music') { paintTabs(); paintMusic(); return; }
  if (S.tab === 'palette') { paintTabs(); $('meta').textContent = 'Palette · a sound for each part, together'; $('lede').textContent = 'Your liked sounds playing together: a kit, hats, percussion, a bass, chords and a lead, on one loop. Pick each part, set its level, and hear how they sit with each other before we write songs with them.'; $('count').textContent = ''; $('likes').textContent = ''; paintPalette(); paint(); return; }
  const all = shown(); paintTabs();
  const NR = Object.keys(ROUNDS).length;
  $('meta').textContent = S.tab === 'kept' ? `Kept · ${all.length} sound${all.length === 1 ? '' : 's'} from every round` : S.tab === 'families' ? `${FAMILIES.length} sounds and their versions · ${NR} rounds · all in A at ${BPM} BPM` : `New in round ${ROUND} · ${all.length} sounds · all in A at ${BPM} BPM`;
  $('lede').textContent = S.tab === 'kept' ? 'The sounds you have kept, from every round, side by side. ☆ Keep on any card adds it here; ★ Kept takes it away.'
    : S.tab === 'families' ? 'Each card is one sound and every version of it, round by round (R1, R2, R3), where it branched and where it stopped. Pick a version to hear it; ⇄ A/B swaps between the last two you picked, in time if it\'s playing. Your ratings show on each version.' : INTROS[ROUND];
  const groups = S.tab === 'families' ? GROUPS.map(([role, title]) => { const list = FAMILIES.filter(f => f.role === role); if (!list.length) return null;
      return h('section', {class: 'group'}, h('h2', {}, title, h('small', {}, ` ${list.length}`)), h('div', {class: 'cards'}, ...list.map(f => famCard(f, FAMILIES.indexOf(f))))); }).filter(Boolean)
    : GROUPS.map(([role, title]) => { const list = all.filter(s => s.role === role); if (!list.length) return null;
    return h('section', {class: 'group'}, h('h2', {}, title, h('small', {}, ` ${list.length}`)), h('div', {class: 'cards'}, ...list.map(s => card(s, all.indexOf(s))))); }).filter(Boolean);
  $('groups').replaceChildren(...(groups.length ? groups : [h('p', {class: 'empty'}, 'Nothing kept yet. Press ☆ Keep on any sound in any round and it will be here.')])); count(); paint(); }
// the tabs: each round, newest last, and what you've kept
function paintSide(){ for (const b of document.querySelectorAll('#side button')) b.setAttribute('aria-pressed', String(b.dataset.side === S.side)); }
function pickSide(sd2){ if (S.ed) closeEd(); stop(); S.side = sd2; keep('side', sd2); paintAll(); scrollTo({top: 0}); }
function paintTabs(){ if (S.side === 'music') { const kept = MUSIC.filter(m => S.rate[m.id]?.keep).length;
    const mt = t => () => { S.mtab = t; keep('mtab', t); stop(); paintAll(); scrollTo({top: 0}); };
    $('tabs').replaceChildren(...Object.entries(MROUNDS).map(([k, xs]) => h('button', {role: 'tab', 'aria-selected': String(S.mtab === k), onclick: mt(k)}, `Round ${k.slice(1)}`, h('small', {}, ` ${xs.length}`))),
      h('button', {role: 'tab', class: 'kepttab', 'aria-selected': String(S.mtab === 'kept'), onclick: mt('kept')}, '★ Kept', h('small', {}, ` ${kept}`))); return; }
  const kept = ALL.filter(s => S.rate[s.id]?.keep).length;
  $('tabs').replaceChildren(h('button', {role: 'tab', 'aria-selected': String(S.tab === 'families'), onclick: () => pickTab('families')}, 'Every sound', h('small', {}, ` ${FAMILIES.length}`)),
    h('button', {role: 'tab', 'aria-selected': String(S.tab === 'new'), onclick: () => pickTab('new')}, `New in round ${ROUND}`, h('small', {}, ` ${ROUNDS[ROUND].length}`)),
    h('button', {role: 'tab', 'aria-selected': String(S.tab === 'palette'), onclick: () => pickTab('palette')}, 'Palette'),
    h('button', {role: 'tab', class: 'kepttab', 'aria-selected': String(S.tab === 'kept'), onclick: () => pickTab('kept')}, '★ Kept', h('small', {}, ` ${kept}`))); }
function pickTab(t){ if (S.ed) closeEd(); stop(); S.tab = t; keep('tab', t); paintAll(); scrollTo({top: 0}); }
function paintCard(id){ const el = $('snd-' + id), r = S.rate[id] || {}; if (!el) return; el.dataset.rating = r.rating || 0; el.querySelector('.mine').hidden = !r.edits; const kb = el.querySelector('.keep'); kb.setAttribute('aria-pressed', String(!!r.keep)); kb.textContent = r.keep ? '★ Kept' : '☆ Keep';
  for (const b of el.querySelectorAll('.rate button')) b.setAttribute('aria-pressed', String(+b.dataset.v === r.rating)); }
function paint(){ for (const b of document.querySelectorAll('.snd .play')) { const id = b.closest('.snd').id.slice(4); b.setAttribute('aria-pressed', String(S.playing?.id === id && S.playing.mode === b.dataset.mode)); }
  for (const [b, m] of [['edAlone', 'alone'], ['edPhrase', 'phrase'], ['edLoop', 'loop']]) $(b).setAttribute('aria-pressed', String(!!S.ed && S.playing?.id === S.ed && S.playing.mode === m));
  $('stop').disabled = !S.playing; $('mini').hidden = !S.playing; $('now').textContent = !S.playing ? 'Nothing playing' : S.playing.mode === 'palette' ? 'The palette, together' : S.playing.parts ? `${byId(S.playing.id).name}, ${S.playing.mode === 'band' ? 'with the band' : S.playing.mode === 'alone' && byId(S.playing.id).mkind !== 'idea' ? 'alone' : 'playing'}` : `${byId(S.playing.id).name}, ${MODES.find(m => m[0] === S.playing.mode)[1].toLowerCase()}`; $('miniName').textContent = $('now').textContent; if ($('palPlay')) { $('palPlay').setAttribute('aria-pressed', String(S.playing?.mode === 'palette')); $('palPlay').lastChild.textContent = S.playing?.mode === 'palette' ? 'Stop the palette' : 'Play the palette together'; } }
function count(){ const all = shown(), n = all.filter(s => S.rate[s.id]?.rating).length, likes = all.filter(s => S.rate[s.id]?.rating === 1).length;
  $('count').textContent = `${n} of ${all.length} rated`; $('likes').textContent = likes ? `${likes} liked` : ''; $('bar').style.setProperty('--done', all.length ? n/all.length : 0); }

/* ---------- the workbench: the sound's settings, your version, and keys to play it ---------- */
// where each kind of sound's keyboard starts (the lowest C), and the computer's keys over two octaves from it
const BASE = {bass: 24, chords: 48, lead: 60, texture: 48}, KEYS = 'awsedftgyhujkolp;\'', PADKEYS = 'asdfghjkl';
const drumsOf = s => [...new Set([...s.alone.map(x => x.v), ...s.phrase.map(x => x.v)])];
async function openEd(id){ await start(); const s = byId(id); if (S.playing && S.playing.id !== id) stop(); S.ed = id; S.pad = drumsOf(s)[0]; loadSound(id); paintEd(); $('bench').hidden = false; document.body.classList.add('benching'); }
function closeEd(){ releaseAll(); fold(false); S.ed = null; $('bench').hidden = true; document.body.classList.remove('benching'); }
// a change: heard at once and kept as your version (set back to the round's value, it's no longer a change)
function change(s, key, v, voice){ const e = structuredClone(edits(s.id) || {});
  if (voice) { const orig = {...analogParams(s.kit)[voice], ...(s.over[voice] || {})}[key]; e[voice] ||= {}; if (Math.abs(v - orig) < 1e-9) delete e[voice][key]; else e[voice][key] = v; if (!Object.keys(e[voice]).length) delete e[voice];
    send({type: 'voice', v: voice, key, val: v}); }
  else { const orig = {...ENG(s).DEF, ...s.patch}[key]; if (Math.abs(v - orig) < 1e-9) delete e[key]; else e[key] = v; send({type: 'set', params: {[key]: v}}); }
  rate(s.id, {edits: Object.keys(e).length ? e : null}); sayEd(s); }
function revert(){ const s = byId(S.ed); rate(s.id, {edits: null}); loadSound(s.id); paintEd(); }
function sayEd(s){ const e = edits(s.id), n = !e ? 0 : s.kind === 'synth' ? Object.keys(e).length : Object.values(e).reduce((a, x) => a + Object.keys(x).length, 0);
  $('edSay').textContent = n ? `${n} setting${n > 1 ? 's' : ''} changed from the original` : 'As in the round'; $('revert').disabled = !n; }
function paintEd(){ const s = byId(S.ed); $('edName').textContent = s.name; $('edSrc').textContent = source(s); sayEd(s);
  // the keys: a piano for a synth sound, a pad a drum for a drum sound
  if (s.kind === 'synth') { const lo = BASE[s.role] + 12*S.oct, white = [], keys = [];
    for (let n = lo; n <= lo + 24; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) white.push(n);
    const W = 100/white.length;
    for (const n of white) keys.push(h('div', {class: 'key w', 'data-n': n, style: `left:${white.indexOf(n)*W}%;width:${W}%`}, n % 12 === 0 ? noteName(n, SHARPS) : ''));
    for (let n = lo; n <= lo + 24; n++) if ([1, 3, 6, 8, 10].includes(n % 12)) keys.push(h('div', {class: 'key b', 'data-n': n, style: `left:${(white.indexOf(n - 1) + 1)*W - W*.32}%;width:${W*.64}%`}));
    $('kb').replaceChildren(...keys); $('kb').hidden = false; $('pads').hidden = true;
    $('kbSay').textContent = `Keys: A to ' play from ${noteName(lo + 12, SHARPS)} · Z X octave down, up`; }
  else { $('pads').replaceChildren(...drumsOf(s).map((v, i) => h('button', {class: 'pad', 'data-v': v, 'aria-pressed': String(S.pad === v), onpointerdown: e => { e.preventDefault(); hit(v, .9); S.pad = v; paintEd(); }},
      h('b', {}, voiceName(v)), h('span', {}, PADKEYS[i]?.toUpperCase() || '')))); $('pads').hidden = false; $('kb').hidden = true;
    $('kbSay').textContent = 'Keys: ' + drumsOf(s).map((v, i) => `${PADKEYS[i].toUpperCase()} ${voiceName(v).toLowerCase()}`).join(' · ') + ' · a pad picked shows its settings'; }
  // the settings: the synth's modules, or the picked drum's
  if (s.kind === 'synth') { const P = patchOf(s), O = {...ENG(s).DEF, ...s.patch};
    $('edSet').replaceChildren(...ENG(s).PARAMS.map(([g, ps]) => h('section', {class: 'mod'}, h('h4', {}, g), ...ps.map(p => { const c = control(p, P[p.key], v => change(s, p.key, v), {reset: O[p.key]}); if (Math.abs(P[p.key] - O[p.key]) > 1e-9) c.classList.add('changed'); return c; })))); }
  else { const v = S.pad, P = overOf(s)[v] ? {...analogParams(s.kit)[v], ...overOf(s)[v]} : analogParams(s.kit)[v], O = {...analogParams(s.kit)[v], ...(s.over[v] || {})};
    $('edSet').replaceChildren(h('section', {class: 'mod wide'}, h('h4', {}, voiceName(v) + ' · ' + s.kit), ...APARAMS.map(p => { const c = control(p, P[p.key] ?? p.def, x => change(s, p.key, x, v), {reset: O[p.key] ?? p.def}); if (Math.abs((P[p.key] ?? p.def) - (O[p.key] ?? p.def)) > 1e-9) c.classList.add('changed'); return c; }))); } }
// playing it: a note held while the key is, a drum hit
let kid = 0;
function noteOn(n, vel = .8){ if (S.held.has(n)) return; const id = 'k' + (++kid); S.held.set(n, id); send({type: 'on', id, n, vel}); litKeys(); }
function noteOff(n){ const id = S.held.get(n); if (!id) return; S.held.delete(n); send({type: 'off', id}); litKeys(); }
function releaseAll(){ for (const n of [...S.held.keys()]) noteOff(n); }
function hit(v, vel){ send({type: 'hit', v, vel}); }
function litKeys(){ for (const k of $('kb').children) k.toggleAttribute('data-on', S.held.has(+k.dataset.n)); }
{ const kb = $('kb'), down = new Map(), at = e => { const k = document.elementFromPoint(e.clientX, e.clientY)?.closest('.key'); return k ? +k.dataset.n : null; },
    vel = e => { const r = e.target.closest('.key')?.getBoundingClientRect(); return r ? Math.min(1, .45 + .55*(e.clientY - r.top)/r.height) : .8; };
  kb.onpointerdown = e => { e.preventDefault(); kb.setPointerCapture(e.pointerId); const n = at(e); if (n == null) return; down.set(e.pointerId, n); noteOn(n, vel(e)); };
  kb.onpointermove = e => { if (!down.has(e.pointerId)) return; const n = at(e), was = down.get(e.pointerId); if (n == null || n === was) return; down.set(e.pointerId, n); noteOn(n, vel(e)); noteOff(was); };
  kb.onpointerup = kb.onpointercancel = e => { const n = down.get(e.pointerId); down.delete(e.pointerId); if (n != null) noteOff(n); }; }
const typed = new Map();
addEventListener('keydown', e => { if (!S.ed || e.target.matches('textarea, input, select') || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return; const s = byId(S.ed), k = e.key.toLowerCase();
  if (s.kind === 'synth') { if (k === 'z' || k === 'x') { S.oct = Math.max(-2, Math.min(2, S.oct + (k === 'z' ? -1 : 1))); releaseAll(); paintEd(); return; }
    const i = KEYS.indexOf(k); if (i < 0) return; e.preventDefault(); const n = BASE[s.role] + 12*S.oct + 12 + i; typed.set(k, n); noteOn(n); }
  else { const i = PADKEYS.indexOf(k), v = drumsOf(s)[i]; if (i < 0 || !v) return; e.preventDefault(); hit(v, .9); } });
addEventListener('keyup', e => { const n = typed.get(e.key.toLowerCase()); if (n == null) return; typed.delete(e.key.toLowerCase()); noteOff(n); });
addEventListener('blur', () => { typed.clear(); releaseAll(); });
$('edClose').onclick = closeEd; $('revert').onclick = revert;
// the workbench's height: drag its top edge (or the arrow keys on it), kept on this device; Fold leaves just its head
{ const g = $('grip'), MIN = 90, maxH = () => innerHeight*.88;
  const setH = px => { const v = Math.round(Math.max(MIN, Math.min(maxH(), px))); document.documentElement.style.setProperty('--benchH', v + 'px'); keep('benchH', v); fold(false); };
  const saved = load('benchH', 0); if (saved) document.documentElement.style.setProperty('--benchH', Math.min(saved, innerHeight*.88) + 'px');
  g.onpointerdown = e => { e.preventDefault(); g.setPointerCapture(e.pointerId); g.classList.add('drag'); };
  g.onpointermove = e => { if (g.classList.contains('drag')) setH(innerHeight - e.clientY); };
  g.onpointerup = g.onpointercancel = () => g.classList.remove('drag');
  g.onkeydown = e => { const h0 = $('bench').getBoundingClientRect().height; if (e.key === 'ArrowUp') { e.preventDefault(); setH(h0 + 40); } else if (e.key === 'ArrowDown') { e.preventDefault(); setH(h0 - 40); } };
  g.ondblclick = () => fold(!$('bench').classList.contains('folded'));
  $('edFold').onclick = () => fold(!$('bench').classList.contains('folded')); }
function fold(on){ const b = $('bench'); b.classList.toggle('folded', on); $('edFold').textContent = on ? 'Unfold' : 'Fold'; $('edFold').setAttribute('aria-expanded', String(!on));
  if (on) b.style.height = 'auto'; else b.style.height = ''; document.body.style.paddingBottom = on ? (b.getBoundingClientRect().height + 16) + 'px' : ''; }
for (const [b, m] of [['edAlone', 'alone'], ['edPhrase', 'phrase'], ['edLoop', 'loop']]) $(b).onclick = () => play(S.ed, m);

$('stop').onclick = stop; $('mini').onclick = stop; $('copy').onclick = copyRatings;
for (const b of document.querySelectorAll('#side button')) b.onclick = () => pickSide(b.dataset.side);
$('bpm').oninput = e => setTempo(+e.target.value); $('bpmReset').onclick = () => setTempo(BPM); setTempo(S.bpm);
$('vol').oninput = e => { S.vol = +e.target.value; if (out) out.gain.value = S.vol; };
$('room').oninput = e => { S.room = +e.target.value; $('roomOut').textContent = S.room ? Math.round(S.room*100) + '%' : 'off'; node?.port.postMessage({type: 'room', v: S.room}); };
addEventListener('keydown', e => { if (e.key === 'Escape' && S.ed && !S.playing) { closeEd(); return; } if (e.key === 'Escape' || (e.code === 'Space' && !e.target.matches('textarea, input, button'))) { if (S.playing) { e.preventDefault(); stop(); } } });
connect();
window.__soundlab = {playMusic, setTempo, pickSide, MUSIC, playPalette, palPick, pick, FAMILIES, S, get SOUNDS(){ return shown(); }, ALL, pickTab, GAIN, play, stop, rate, openEd, closeEd, change, revert, noteOn, noteOff, hit, patchOf, overOf, get ctx(){ return ctx; }, get node(){ return node; }, get out(){ return out; }};   // (for tests)
