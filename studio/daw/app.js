// Studio DAW: the compositions as sessions (studio/sessions/*.json, captured from the scores), laid out as an arrangement
// and played live with the same engine the renders use: the desk (lib/desk.js) on the page's audio clock, the poly synth
// and drum kit as they are, the native notes computed by a worker and cached. Mute, solo and a fader per bus; Keep sends
// the mix (and, later, the edits) to Claude, who renders it at full quality.
import { desk } from '../lib/desk.js';
import { playSession } from '../lib/play-session.js';

const $ = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };
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
    box.append(h('div', {class: 'head'}, h('div', {class: 'tn'}, h('b', {}, nice(t)), h('span', {class: 'muted'}, `${desc} · ${t.bus}`)), m, s)); } }
// the playhead, moved each frame
(function frame(){ if (S) { const b = nowBar(), x = b*ppb; $('head').style.transform = `translateX(${x}px)`; $('clock').textContent = `${fmt(b*barDur())} · bar ${Math.floor(b) + 1}`;
  if (playing && $('follow').checked) { const sc = $('scroll'), left = sc.scrollLeft, w = sc.clientWidth - 180; if (x < left || x > left + w*.85) sc.scrollLeft = Math.max(0, x - w*.15); } } requestAnimationFrame(frame); })();
$('arr').addEventListener('pointerdown', e => { const r = $('arr').getBoundingClientRect(), bar = Math.floor((e.clientX - r.left)/ppb); from = bar; if (playing) playFrom(bar); else $('head').style.transform = `translateX(${bar*ppb}px)`; });

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
async function open(file){ stop(); const s = await (await fetch('sessions/' + file)).json(); S = s; base = file; from = 0;
  $('title').textContent = S.meta.title; $('facts').innerHTML = [['Tempo', S.meta.bpm + ' BPM'], ['Key', S.meta.key || '—'], ['Length', fmt(S.meta.bars*barDur())], ['Version', 'v' + S.meta.version]].map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
  $('words').textContent = S.meta.words || ''; draw(); renderMixer(); $('scroll').scrollLeft = 0; if (ctx) prewarm(); status();
  try { localStorage.setItem('studio.daw.song', file); } catch {} }
let changed = false; const dirty = () => { changed = true; $('keep').disabled = !db; };
$('play').onclick = () => { if (playing) stop(); else { if (!pending.size && !cache.size) prewarm(); playFrom(from); } };
$('zoom').oninput = e => { ppb = +e.target.value; draw(); };
$('song').onchange = e => open(e.target.value);
document.addEventListener('keydown', e => { if (e.key === ' ' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); $('play').click(); } });

/* ---------- keeping for Claude: the mix and the mutes (the edits, once there are any) ---------- */
let db = null;
$('keep').onclick = async () => { if (!db || !S) return; $('keep').disabled = true; $('keepStatus').textContent = 'Keeping…';
  try { await db.collection('edits').add({song: base, title: S.meta.title, version: S.meta.version, note: $('note').value.trim(), mix: S.mix || {},
      mute: S.tracks.filter(t => t.mute).map(t => t.id), solo: S.tracks.filter(t => t.solo).map(t => t.id), at: new Date().toISOString()});
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
