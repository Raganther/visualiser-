// Studio DAW: the compositions as sessions (studio/sessions/*.json, captured from the scores), laid out as an arrangement
// and played live with the same engine the renders use: the desk (lib/desk.js) on the page's audio clock, the poly synth
// and drum kit as they are, the native notes computed by a worker and cached. Mute, solo and a fader per bus; Keep sends
// the mix (and, later, the edits) to Claude, who renders it at full quality.
import { desk } from '../lib/desk.js';
import { playSession } from '../lib/play-session.js';
import { SOUNDS, NATIVE_OF } from '../lib/palette.js';
import { INST, defaultOf } from '../lib/native/knobs.js';
import { PRESETS } from '../lib/desk.js';
import { $, h } from '../lib/dom.js';



let INDEX = [], S = null, base = null;   // (the songs; the session open, and as it was loaded)
let ctx = null, worker = null, live = null, timer = 0, t0 = 0, playing = false, from = 0;
const cache = new Map(), pending = new Set();
const barDur = () => 240/S.meta.bpm;

/* ---------- native notes: the same keys as lib/native/index.js's cache, computed by the worker ---------- */
const q = (v, s) => Math.round(v/s)*s;
const keyOf = (name, n, vel, o) => `${name}|${n}|${q(vel, .1)}|${Object.entries(o).sort().map(([k, v]) => k + q(+v, .02)).join(',')}`;
function nativeBuf(name, n, vel, o){ const k = keyOf(name, n, vel, o), b = cache.get(k); if (b) return b;
  if (!pending.has(k) && worker) { pending.add(k); worker.postMessage({key: k, name, n, vel: q(vel, .1), o, sr: ctx.sampleRate}); status(); } return null; }
function initAudio(){ if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'});
  worker = new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent], {type: 'text/javascript'})));
  worker.onmessage = e => { const {key, L, R, error} = e.data; pending.delete(key); if (!error) { const b = ctx.createBuffer(2, L.length, ctx.sampleRate); b.copyToChannel(L, 0); b.copyToChannel(R, 1); cache.set(key, b); } status(); }; }
// every native note a session will ask for: the session run on a silent desk whose other instruments do nothing
function prewarm(){ initAudio(); const dry = desk(new OfflineAudioContext(2, 128, ctx.sampleRate), {bpm: S.meta.bpm, swing: S.meta.swing || 0, seed: S.meta.seed || 1, meters: false, nativeBuf});
  const stub = () => ({play(){}, set(){}, load(){}}); dry.kit = stub; dry.synth = stub; dry.noise = () => {};
  playSession(dry, S); dry.start(); dry.feedTo(Infinity); status(); }
function status(){ const n = pending.size; $('status').textContent = !ctx ? 'Press Play to hear it' : n ? `Computing ${n} native sound${n > 1 ? 's' : ''}…` : playing ? 'Playing' : 'Ready'; $('status').dataset.busy = n ? '1' : ''; }

/* ---------- playing: the session built on a live desk from a bar, its queue fed as the clock runs ---------- */
function playFrom(bar){ initAudio(); stopAudio(); ctx.resume(); from = Math.max(0, Math.min(S.meta.bars - 1, bar));
  t0 = ctx.currentTime + .25 - from*barDur();
  const solo = S.tracks.some(t => t.solo), view = {...S, tracks: S.tracks.map(t => ({...t, mute: t.mute || (solo && !t.solo)}))};
  live = desk(ctx, {bpm: S.meta.bpm, swing: S.meta.swing || 0, seed: S.meta.seed || 1, t0, meters: false, nativeBuf});
  playSession(live, view); live.finish(); live.start(ctx.currentTime + .05);
  playing = true; timer = setInterval(() => { if (!live.feedTo(ctx.currentTime + .6) && ctx.currentTime > t0 + S.meta.bars*barDur() + 4) stop(); }, 50);
  live.feedTo(ctx.currentTime + .6); $('play').textContent = 'Stop'; $('play').setAttribute('aria-pressed', 'true'); status(); }
function stopAudio(){ clearInterval(timer); if (live) { try { live.outNode.disconnect(); } catch {} live = null; } }
function stop(){ stopAudio(); playing = false; $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false'); status(); }
const nowBar = () => playing ? (ctx.currentTime - t0)/barDur() : from;
// a change that needs the song rebuilt (a mute, a solo) restarts it from where it is
const restart = () => { if (playing) playFrom(Math.floor(nowBar())); };

/* ---------- the arrangement: a lane per track, its notes drawn across the bars ---------- */
let ppb = 22;   // (pixels a bar)
const LANE = 44, RULER = 30, lanes = () => S.tracks.filter(t => t.notes.length);
const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function draw(){ const L = lanes(), W = S.meta.bars*ppb, H = RULER + L.length*LANE, cv = $('arr'), dpr = devicePixelRatio || 1;
  cv.width = W*dpr; cv.height = H*dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const ink = css('--ink'), mute = css('--mute'), line = css('--line'), well = css('--well'), on = css('--on'), acc = css('--acc'), band = css('--band');
  // the sections across the top, then the bars
  (S.sections || []).forEach(([name, a, b], i) => { g.fillStyle = i % 2 ? band : well; g.fillRect(a*ppb, 0, (b - a)*ppb, RULER - 12); g.fillStyle = ink; g.font = '500 11px "IBM Plex Mono", monospace'; g.fillText(name, a*ppb + 5, 13); });
  g.fillStyle = mute; g.font = '10px "IBM Plex Mono", monospace';
  for (let b = 0; b <= S.meta.bars; b++) { const x = b*ppb; g.fillStyle = b % 16 === 0 ? line : b % 4 === 0 ? line + '' : 'transparent'; if (b % 4 === 0) g.fillRect(x, RULER - 12, 1, H); if (b % (ppb < 14 ? 16 : 8) === 0) { g.fillStyle = mute; g.fillText(String(b + 1), x + 3, RULER - 2); } }
  L.forEach((t, li) => { const y0 = RULER + li*LANE; g.fillStyle = li % 2 ? 'transparent' : well + '66'; g.fillRect(0, y0, W, LANE); g.fillStyle = line; g.fillRect(0, y0 + LANE - 1, W, 1);
    const dim = t.mute || (S.tracks.some(x => x.solo) && !t.solo); g.globalAlpha = dim ? .25 : 1;
    if (t.engine === 'kit') { const vs = [...new Set(t.notes.map(n => n[2]))], rh = (LANE - 6)/vs.length;
      for (const [bar, step, voice, vel] of t.notes) { const x = (bar + step/16)*ppb, y = y0 + 3 + vs.indexOf(voice)*rh; g.fillStyle = vel > 1 ? acc : on; g.fillRect(x, y, Math.max(1, ppb/16 - .3), Math.max(1.5, rh - 1)); } }
    else { let lo = 127, hi = 0; for (const n of t.notes) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); } const span = Math.max(1, hi - lo), ph = (LANE - 8)/(span + 1);
      for (const [bar, step, n, len, vel] of t.notes) { const x = (bar + step/16)*ppb, y = y0 + 4 + (hi - n)*ph; g.fillStyle = on; g.globalAlpha = (dim ? .25 : 1)*(.45 + .55*Math.min(1, vel)); g.fillRect(x, y, Math.max(1, len*ppb/16 - .3), Math.max(1.5, ph)); } }
    g.globalAlpha = 1; });
  renderHeads(L);
}
// the palette's sound names, as a person would say them
const NICE = {glass: 'Glass bass', glassLong: 'Glass bass', clean: 'Round bass', cleanHeld: 'Round bass', pluck: 'Plucked bass', dubSub: 'Dub sub', warm: 'Warm pad', glassPad: 'Glass pad', sweep: 'Sweeping pad',
  gated: 'Gated chord', dotted: 'Dotted chords', dub: 'Dub chords', dubStab: 'Dub stab', fifths: 'Detroit stabs', arp: 'Arpeggio', ping: 'Ping', marimba: 'Marimba', kalimba: 'Kalimba', vibes: 'Vibraphone',
  musicbox: 'Music box', tubular: 'Tubular bells', steel: 'Steel drum', metal: 'Metal plate', wood: 'Woodblocks', bell: 'Church bell', tom: 'Toms', kick: 'Kick'};
const nice = t => NICE[t.label] || t.label;
function renderHeads(L){ const box = $('heads'); box.innerHTML = ''; box.append(h('div', {class: 'rulerhead'}, h('span', {class: 'lab'}, 'Track')));
  for (const t of L) { const desc = t.engine === 'kit' ? `${t.kit} kit` : t.engine === 'poly' ? `synth · ${t.preset}` : t.engine === 'native' ? `native · ${t.name}` : (t.over?.poly ? 'synth' : 'native') + ` · ${t.name}`;
    const m = h('button', {class: 'ms', 'aria-pressed': String(!!t.mute), title: 'Mute', onclick: () => { t.mute = !t.mute; m.setAttribute('aria-pressed', String(t.mute)); dirty(); draw(); restart(); }}, 'M');
    const s = h('button', {class: 'ms solo', 'aria-pressed': String(!!t.solo), title: 'Solo', onclick: () => { t.solo = !t.solo; s.setAttribute('aria-pressed', String(t.solo)); dirty(); draw(); restart(); }}, 'S');
    box.append(h('div', {class: 'head' + (t === sel ? ' sel' : ''), onclick: e => { if (e.target.tagName !== 'BUTTON') selectTrack(t, Math.floor(nowBar())); }}, h('div', {class: 'tn'}, h('b', {}, nice(t)), h('span', {class: 'muted'}, `${desc} · ${t.bus}`)), m, s)); } }
// the playhead, moved each frame
(function frame(){ if (S) { const b = nowBar(), x = b*ppb; $('head').style.transform = `translateX(${x}px)`; $('clock').textContent = `${fmt(b*barDur())} · bar ${Math.floor(b) + 1}`;
  if (playing && $('follow').checked) { const sc = $('scroll'), left = sc.scrollLeft, w = sc.clientWidth - 180; if (x < left || x > left + w*.85) sc.scrollLeft = Math.max(0, x - w*.15); } } requestAnimationFrame(frame); })();
$('arr').addEventListener('pointerdown', e => { const r = $('arr').getBoundingClientRect(), bar = Math.floor((e.clientX - r.left)/ppb), li = Math.floor((e.clientY - r.top - RULER)/LANE), t = lanes()[li];
  from = bar; if (playing) playFrom(bar); else $('head').style.transform = `translateX(${bar*ppb}px)`; if (t) selectTrack(t, bar); });

/* ---------- the mixer: a fader per bus (dB on top of the piece's own mix) ---------- */
function renderMixer(){ const box = $('mixer'); box.innerHTML = ''; S.mix = S.mix || {};
  const used = [...new Set(lanes().map(t => t.bus))], rets = Object.keys(S.trims || {}).filter(k => !used.includes(k));
  for (const bus of [...used, ...['echo', 'verb', 'wash'].filter(k => S.ops.some(o => (o[0] === 'returns' && k !== 'wash') || (o[0] === 'addReturn' && o[1] === k)))]) {
    const v = S.mix[bus] || 0, out = h('output', {}, (v > 0 ? '+' : '') + v + ' dB'), r = h('input', {type: 'range', min: -24, max: 12, step: 1, value: v, id: 'mx-' + bus, 'aria-label': bus + ' level'});
    r.oninput = () => { const dB = +r.value; S.mix[bus] = dB; out.textContent = (dB > 0 ? '+' : '') + dB + ' dB';
      if (live?.buses[bus]) live.buses[bus].in.gain.value = Math.pow(10, ((S.trims?.[bus] || 0) + dB)/20); dirty(); };
    r.ondblclick = () => { r.value = 0; r.oninput(); };
    box.append(h('label', {class: 'fader'}, h('span', {}, ({echo: 'Echo return', verb: 'Reverb return', wash: 'Wash return'})[bus] || bus), r, out)); } void rets; }

/* ---------- songs ---------- */
async function open(file){ stop(); sel = null; $('editor').hidden = true; undo.length = 0; const s = await (await fetch('sessions/' + file)).json(); S = s; base = file; from = 0;
  $('title').textContent = S.meta.title; $('facts').innerHTML = [['Tempo', S.meta.bpm + ' BPM'], ['Key', S.meta.key || '—'], ['Length', fmt(S.meta.bars*barDur())], ['Version', 'v' + S.meta.version]].map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
  $('words').textContent = S.meta.words || ''; draw(); renderMixer(); $('scroll').scrollLeft = 0; if (ctx) prewarm(); status();
  try { localStorage.setItem('studio.daw.song', file); } catch {} }
let changed = false; const dirty = () => { changed = true; $('keep').disabled = !db; };
let restartT = 0; const restartSoon = () => { clearTimeout(restartT); restartT = setTimeout(() => { if (playing) playFrom(Math.floor(nowBar())); }, 350); };
$('play').onclick = () => { if (playing) stop(); else { if (!pending.size && !cache.size) prewarm(); playFrom(from); } };
$('zoom').oninput = e => { ppb = +e.target.value; draw(); };
$('song').onchange = e => open(e.target.value);
document.addEventListener('keydown', e => { if (e.key === ' ' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); $('play').click(); } });

/* ---------- keeping for Claude: the mix and the mutes (the edits, once there are any) ---------- */
let db = null;
$('keep').onclick = async () => { if (!db || !S) return; $('keep').disabled = true; $('keepStatus').textContent = 'Keeping…';
  try { await db.collection('edits').add({song: base, title: S.meta.title, version: S.meta.version, note: $('note').value.trim(), mix: S.mix || {},
      mute: S.tracks.filter(t => t.mute).map(t => t.id), solo: S.tracks.filter(t => t.solo).map(t => t.id),
      tracks: S.tracks.filter(t => t.edited).map(({id, label, engine, bus, preset, set, name, over, kit, side, skins, notes, morph}) => ({id, label, engine, bus, preset, set, name, over, kit, side, skins, notes, morph})), at: new Date().toISOString()});
    $('keepStatus').textContent = `Kept your version of ${S.meta.title}. Claude will render it and put it in the listening room.`; $('note').value = ''; changed = false; }
  catch (e) { $('keepStatus').textContent = 'That wasn\'t kept (' + (e.code || e.message) + '). Try again.'; $('keep').disabled = false; } };

(async () => {
  INDEX = await (await fetch('sessions/index.json')).json();
  for (const s of INDEX) $('song').append(h('option', {value: s.file}, `${s.title} (v${s.version})`));
  let want = null; try { want = localStorage.getItem('studio.daw.song'); } catch {}
  const first = INDEX.find(s => s.file === want) || INDEX[0]; $('song').value = first.file; await open(first.file);
  db = await window.claude?.use?.('db').catch(() => null) || null;
  if (!db) $('keepStatus').textContent = 'Keeping for Claude needs the page open signed in to claude.ai.';
})();

/* ---------- the editor: a piano roll for the chosen track over a few bars, its notes added, moved, stretched, deleted ---------- */
let sel = null, win = 0, winN = 4, picked = null, clip = null; const undo = [];
const KITV = ['kick', 'snare', 'clap', 'rim', 'clave', 'chh', 'ohh', 'ride', 'crash', 'tomL', 'tomH', 'cowbell', 'shaker'];
const isKit = t => t.engine === 'kit', NOTE = 'C C# D D# E F F# G G# A A# B'.split(' '), nm = n => NOTE[n % 12] + (Math.floor(n/12) - 1);
const abs = n => n[0]*16 + n[1];
function rowsOf(t){ if (isKit(t)) { const used = new Set(t.notes.map(n => n[2])); return KITV.filter(v => used.has(v)).concat(KITV.filter(v => !used.has(v))); }
  let lo = 127, hi = 0; for (const n of t.notes) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); } if (lo > hi) { lo = 48; hi = 72; }
  lo = Math.max(24, lo - 3); hi = Math.min(96, Math.max(hi + 3, lo + 14)); const out = []; for (let n = hi; n >= lo; n--) out.push(n); return out; }
function selectTrack(t, bar){ sel = t; picked = null; win = Math.max(0, Math.min(S.meta.bars - winN, Math.floor(bar/winN)*winN)); $('editor').hidden = false; renderHeads(lanes()); renderEditor(); }
function snapshot(){ undo.push({t: sel, notes: JSON.stringify(sel.notes)}); if (undo.length > 60) undo.shift(); }
function edited(){ sel.edited = true; dirty(); clearTimeout(edited.t); edited.t = setTimeout(draw, 120); restartSoon(); }
const ROW = () => isKit(sel) ? 22 : 15, LEFT = 44;
function drawRoll(){ if (!sel) return; const rows = rowsOf(sel), cv = $('roll'), W = Math.max(320, $('rollbox').clientWidth - 2), cols = winN*16, cw = (W - LEFT)/cols, H = rows.length*ROW(), dpr = devicePixelRatio || 1;
  cv.width = W*dpr; cv.height = H*dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const well = css('--well'), line = css('--line'), mute = css('--mute'), on = css('--on'), acc = css('--acc'), ink = css('--ink'), band = css('--band');
  g.fillStyle = css('--panel'); g.fillRect(0, 0, W, H);
  rows.forEach((r, i) => { const y = i*ROW(); g.fillStyle = !isKit(sel) && [1, 3, 6, 8, 10].includes(r % 12) ? well : 'transparent'; g.fillRect(LEFT, y, W - LEFT, ROW());
    g.fillStyle = line; g.fillRect(LEFT, y + ROW() - 1, W - LEFT, 1); g.fillStyle = mute; g.font = '10px "IBM Plex Mono", monospace'; g.fillText(isKit(sel) ? r : nm(r), 4, y + ROW() - 4); });
  for (let c = 0; c <= cols; c++) { g.fillStyle = c % 16 === 0 ? ink : c % 4 === 0 ? line : band; g.fillRect(LEFT + c*cw, 0, c % 16 === 0 ? 1.5 : 1, H); }
  for (const n of sel.notes) { const a = abs(n) - win*16; if (a < -16 || a >= cols) continue; const ri = rows.indexOf(n[2]); if (ri < 0) continue;
    const len = isKit(sel) ? 1 : n[3], vel = isKit(sel) ? n[3] : n[4], x = LEFT + a*cw, w = Math.max(3, len*cw - 1);
    g.globalAlpha = .4 + .6*Math.min(1, vel); g.fillStyle = n === picked ? acc : on; g.fillRect(x, ri*ROW() + 2, w, ROW() - 4); g.globalAlpha = 1; }
  $('win').textContent = `Bars ${win + 1}–${win + winN}`;
  const v = picked ? (isKit(sel) ? picked[3] : picked[4]) : null; $('vel').disabled = !picked; $('del').disabled = !picked; if (picked) { $('vel').value = v; $('velOut').textContent = Math.round(v*100) + '%'; } else $('velOut').textContent = '—';
}
function renderEditor(){ $('edName').textContent = nice(sel); $('edDesc').textContent = isKit(sel) ? `${sel.kit} kit on ${sel.bus}` : `on ${sel.bus}`; renderInst(); drawRoll(); }
// the pointer: on a note, move it (or near its right end, stretch it); on an empty cell, a new note (drag to set its length)
let drag = null;
$('roll').addEventListener('pointerdown', e => { if (!sel) return; const rows = rowsOf(sel), r = $('roll').getBoundingClientRect(), cols = winN*16, cw = (r.width - LEFT)/cols;
  const x = e.clientX - r.left, y = e.clientY - r.top; if (x < LEFT) return; const col = (x - LEFT)/cw, ri = Math.floor(y/ROW()), row = rows[ri]; if (row == null) return;
  const hit = sel.notes.find(n => n[2] === row && col >= abs(n) - win*16 && col < abs(n) - win*16 + (isKit(sel) ? 1 : Math.max(n[3], .5)));
  snapshot(); $('roll').setPointerCapture(e.pointerId);
  if (hit) { picked = hit; const endX = LEFT + (abs(hit) - win*16 + (isKit(sel) ? 1 : hit[3]))*cw; drag = {mode: !isKit(sel) && endX - x < 7 ? 'size' : 'move', n: hit, c0: col, r0: ri, a0: abs(hit), len0: hit[3]}; }
  else { const a = win*16 + Math.floor(col), n = isKit(sel) ? [Math.floor(a/16), a % 16, row, .8] : [Math.floor(a/16), a % 16, row, 1, .8]; sel.notes.push(n); picked = n; drag = {mode: isKit(sel) ? 'move' : 'size', n, c0: col, r0: ri, a0: a, len0: 1}; }
  drawRoll(); });
$('roll').addEventListener('pointermove', e => { if (!drag) return; const rows = rowsOf(sel), r = $('roll').getBoundingClientRect(), cw = (r.width - LEFT)/(winN*16), col = (e.clientX - r.left - LEFT)/cw, ri = Math.floor((e.clientY - r.top)/ROW()), n = drag.n;
  if (drag.mode === 'move') { const a = Math.max(0, Math.min(S.meta.bars*16 - 1, drag.a0 + Math.round(col - drag.c0))); n[0] = Math.floor(a/16); n[1] = a % 16 + (drag.a0 % 1); const row = rows[Math.max(0, Math.min(rows.length - 1, ri))]; n[2] = row; }
  else n[3] = Math.max(.25, Math.round((col - (drag.a0 - win*16))*4)/4 || .25);
  drawRoll(); });
$('roll').addEventListener('pointerup', () => { if (drag) { drag = null; edited(); } });
$('roll').addEventListener('dblclick', e => { if (picked) { snapshot(); sel.notes.splice(sel.notes.indexOf(picked), 1); picked = null; edited(); drawRoll(); } });
document.addEventListener('keydown', e => { if (!sel || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && picked) { e.preventDefault(); $('del').click(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); $('undo').click(); } });
$('del').onclick = () => { if (!picked) return; snapshot(); sel.notes.splice(sel.notes.indexOf(picked), 1); picked = null; edited(); drawRoll(); };
$('vel').oninput = () => { if (!picked) return; const v = +$('vel').value; if (isKit(sel)) picked[3] = v; else picked[4] = v; $('velOut').textContent = Math.round(v*100) + '%'; edited(); drawRoll(); };
$('vel').onpointerdown = () => snapshot();
$('undo').onclick = () => { const u = undo.pop(); if (!u) return; sel = u.t; sel.notes.splice(0, sel.notes.length, ...JSON.parse(u.notes)); picked = null; edited(); renderEditor(); };
$('prev').onclick = () => { win = Math.max(0, win - winN); picked = null; drawRoll(); };
$('next').onclick = () => { win = Math.min(S.meta.bars - winN, win + winN); picked = null; drawRoll(); };
$('winN').onchange = () => { winN = +$('winN').value; win = Math.min(win, S.meta.bars - winN); drawRoll(); };
$('playWin').onclick = () => { from = win; playFrom(win); };
const inWin = (n, a, b) => abs(n) >= a*16 && abs(n) < b*16;
$('copy').onclick = () => { clip = {n: winN, notes: sel.notes.filter(n => inWin(n, win, win + winN)).map(n => { const c = n.slice(); c[0] -= win; return c; }), kit: isKit(sel)}; $('paste').disabled = false; $('edStatus').textContent = `Copied bars ${win + 1}–${win + winN} (${clip.notes.length} notes).`; };
$('paste').onclick = () => { if (!clip || clip.kit !== isKit(sel)) { $('edStatus').textContent = clip ? 'Those notes came from a drum track; paste them on one.' : ''; return; } snapshot();
  const keep = sel.notes.filter(n => !inWin(n, win, win + clip.n)); sel.notes.splice(0, sel.notes.length, ...keep, ...clip.notes.map(n => { const c = n.slice(); c[0] += win; return c; }));
  picked = null; edited(); drawRoll(); $('edStatus').textContent = `Pasted over bars ${win + 1}–${win + clip.n}.`; };
$('clear').onclick = () => { snapshot(); const keep = sel.notes.filter(n => !inWin(n, win, win + winN)); sel.notes.splice(0, sel.notes.length, ...keep); picked = null; edited(); drawRoll(); $('edStatus').textContent = `Cleared bars ${win + 1}–${win + winN}.`; };
addEventListener('resize', () => { if (sel) drawRoll(); });

/* ---------- the instrument: its sound, and its settings on knobs (the physics for a native one) ---------- */
const POLY_K = [['cut', 'Filter', 100, 8000, 10], ['res', 'Resonance', 0, .9, .01], ['fenv', 'Filter envelope', 0, 1, .01], ['ad', 'Decay', .02, 2, .01], ['ar', 'Release', .02, 3, .01], ['level', 'Level', 0, 1, .01]];
const KITS = ['Minimal', '909', '808', 'Industrial', 'Lo-fi'];
const NAT_OPTS = Object.keys(INST).filter(k => !['kick', 'hat', 'tom', 'hand'].includes(k));
function renderInst(){ const box = $('inst'); box.innerHTML = ''; const t = sel;
  const sound = h('select', {id: 'sound', 'aria-label': 'Sound'});
  if (isKit(t)) { for (const k of KITS) sound.append(h('option', {value: 'k:' + k}, k + ' kit')); sound.value = 'k:' + t.kit; }
  else { const g1 = h('optgroup', {label: 'Native (computed from physics)'}), g2 = h('optgroup', {label: 'Synth (subtractive)'});
    for (const k of NAT_OPTS) g1.append(h('option', {value: 'n:' + k}, INST[k].label));
    for (const k of Object.keys(SOUNDS).filter(k => !NATIVE_OF[k])) g2.append(h('option', {value: 'p:' + k}, NICE[k] || k));
    sound.append(g1, g2); if (t.engine === 'poly') sound.append(h('option', {value: 'x:'}, `${t.preset} (as written)`));
    sound.value = t.engine === 'native' ? 'n:' + t.name : t.engine === 'palette' ? (NATIVE_OF[t.name] ? 'n:' + NATIVE_OF[t.name] : 'p:' + t.name) : 'x:'; }
  sound.onchange = () => { const [k, v] = sound.value.split(':'); if (k === 'x') return;
    if (k === 'k') t.kit = v; else if (k === 'n') { t.engine = 'native'; t.name = v; t.set = {}; delete t.over; } else { t.engine = 'palette'; t.name = v; t.over = {}; delete t.set; }
    t.label = k === 'n' ? v : k === 'p' ? v : t.label; t.morph = []; sel.edited = true; dirty(); renderEditor(); draw(); if (ctx) prewarm(); restartSoon(); };
  box.append(h('label', {class: 'fader'}, h('span', {}, 'Sound'), sound, h('output', {}, '')));
  if (isKit(t)) return;
  const nat = t.engine === 'native' ? t.name : t.engine === 'palette' && NATIVE_OF[t.name] ? NATIVE_OF[t.name] : null, store = t.engine === 'native' ? (t.set = t.set || {}) : t.engine === 'palette' ? (t.over = t.over || {}) : (t.set = t.set || {});
  const base = t.engine === 'palette' ? SOUNDS[t.name]?.[1] || {} : PRESETS[t.preset] || {};
  const knobs = nat ? INST[nat].knobs : POLY_K;
  for (const [k, label, lo, hi, st] of knobs) { const v0 = store[k] ?? (nat ? defaultOf(nat, k, lo, hi) : base[k] ?? (t.set?.[k]) ?? (lo + hi)/2), out = h('output', {}, (+v0).toFixed(2)), r = h('input', {type: 'range', min: lo, max: hi, step: st, value: v0, id: `kn-${t.id}-${k}`, 'aria-label': label});
    r.oninput = () => { store[k] = +r.value; out.textContent = (+r.value).toFixed(2); t.edited = true; dirty(); if (nat && ctx) prewarm(); restartSoon(); };
    box.append(h('label', {class: 'fader'}, h('span', {}, label), r, out)); }
  if (t.morph.length) box.append(h('p', {class: 'muted', style: 'font-size:12px'}, `This track's ${[...new Set(t.morph.map(m => m[0]))].join(', ')} also move over the song as written; the knobs set where they start.`));
}
