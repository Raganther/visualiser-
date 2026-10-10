// The Studio page: play a song (its arrangement, or scenes and clips launched by hand), see its tracks, clips and mixer
// (meters, the compressors' and sidechains' gain reduction), mute, solo and tweak, render it offline to measure and save
// it, and read or paste the song as data. Every tweak is written into the song, so what's heard is what's copied out.
import { SONGS } from './songs/index.js';
import { makePlayer, renderSong } from './engine.js';
import { arrangement, check, forget, hitRow, noteName, readClip, stripsOf } from './song.js';
import { instrument, EFFECTS } from '../audio/engine/registry.js';
import { note as busNote } from '../audio/engine/events.js';
import { report, paint } from './measure.js';
import { wav } from './wav.js';
import { zip } from './zip.js';
import { knob } from '../ui/widgets.js';
import { TUNE } from '../tuning.js';

const $ = id => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const HUE = i => `hsl(${(195 + i*47) % 360} 70% 60%)`;
const fmtDb = v => (v <= -40 ? '−∞' : (v > 0 ? '+' : '') + v.toFixed(1));
const fmtHz = v => v >= 1000 ? (v/1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Math.round(v) + '';

let ctx = null, player = null, song = null, idx = 0, sel = null, selClip = null, last = null, rendered = null, specAn = null;
const pristine = SONGS.map(s => structuredClone(s));
const songs = SONGS.map(s => structuredClone(s));
const audio = () => { if (!ctx) ctx = new AudioContext({latencyHint: 'playback'}); if (ctx.state === 'suspended') ctx.resume(); return ctx; };

/* ---------- a song in ---------- */
function load(i){
  if (player) { player.dispose(); player = null; }
  idx = i; song = songs[i]; sel = song.tracks[0].id; selClip = null; rendered = null;
  [...$('songs').children].forEach((b, k) => b.setAttribute('aria-current', k === i));
  $('tempo').textContent = `${song.bpm} BPM · ${song.key || ''}`;
  const A = arrangement(song), secs = A.bars*240/song.bpm;
  $('about').innerHTML = `<b>${esc(song.title)}</b>: ${song.tracks.length} tracks, ${song.scenes.length} scenes, ${A.bars} bars (${Math.floor(secs/60)}:${String(Math.round(secs % 60)).padStart(2, '0')}). ` +
    `Press Play for the arrangement, or launch scenes and clips below.`;
  $('rep').innerHTML = ''; $('save').hidden = true; $('gram').hidden = true;
  drawArr(); drawSession(); if (ctx) build(); drawMixer(); drawDetail(); showData();
}
// the graph, on the page's audio context (made on the first click: browsers start sound only from one)
function build(){
  if (player) return player;
  player = makePlayer(audio(), song, {onNote: e => busNote({t: e.t, src: 'studio', ch: e.voice || e.track, note: typeof e.note === 'number' ? e.note : 36, vel: e.vel, len: e.len})});
  specAn = ctx.createAnalyser(); specAn.fftSize = 4096; specAn.smoothingTimeConstant = .8;
  player.E.desk.strips.get('master').out.connect(specAn);
  return player;
}
const rebuild = () => { if (!player) return; const was = player.playing; player.rebuild(); specAn = ctx.createAnalyser(); specAn.fftSize = 4096; specAn.smoothingTimeConstant = .8; player.E.desk.strips.get('master').out.connect(specAn); if (!was) player.stop(); drawMixer(); };

/* ---------- arrangement ---------- */
function drawArr(){
  const A = arrangement(song), a = $('arr'); a.querySelectorAll('.part').forEach(p => p.remove());
  for (const p of A.parts) { const d = h('div', 'part', `<b>${esc(p.scene)}</b>${p.bars} bars`); d.style.width = (p.bars/A.bars*100) + '%'; d.dataset.at = p.at; d.title = `Play from bar ${p.at + 1}`; a.insertBefore(d, $('head')); }
}
$('arr').addEventListener('click', e => {
  const A = arrangement(song), r = $('arr').getBoundingClientRect(), bar = Math.floor((e.clientX - r.left)/r.width*A.bars);
  const p = A.parts.find(x => bar >= x.at && bar < x.at + x.bars); build().play({bar: e.target.closest('.part') ? p.at : bar}); setPlay();
});

/* ---------- session ---------- */
function drawSession(){
  const t = $('ses'); t.innerHTML = '';
  const hd = h('thead'), tr = h('tr'); tr.appendChild(h('th', null, 'Scene'));
  song.tracks.forEach((x, i) => { const th = h('th', null, esc(x.name || x.id)); th.style.setProperty('--tc', HUE(i)); tr.appendChild(th); }); hd.appendChild(tr); t.appendChild(hd);
  const tb = h('tbody');
  for (const sc of song.scenes) {
    const r = h('tr'), th = h('th', 'scene'), b = h('button', null, '▶ ' + esc(sc.id)); b.dataset.scene = sc.id; b.title = `Launch ${sc.id} on the next bar`;
    b.onclick = () => { if (!player || !player.playing) build().play({scene: sc.id}); else player.launch(sc.id); setPlay(); };
    th.appendChild(b); r.appendChild(th);
    song.tracks.forEach((x, i) => { const td = h('td'), c = (sc.clips || {})[x.id];
      if (c) { const cb = h('button', 'clip', esc(c)); cb.style.setProperty('--tc', HUE(i)); cb.dataset.track = x.id; cb.dataset.clip = c; cb.title = `${x.name || x.id}: clip ${c}. Click to see it; double-click to launch it alone`;
        cb.onclick = () => { sel = x.id; selClip = c; drawDetail(); markSel(); };
        cb.ondblclick = () => { if (!player || !player.playing) { build().play({scene: sc.id}); setPlay(); } else player.launchClip(x.id, player.E.clipOf(x.id, player.E.n) === c ? null : c); };
        td.appendChild(cb); }
      r.appendChild(td); });
    tb.appendChild(r);
  }
  t.appendChild(tb);
}

/* ---------- the mixer ---------- */
const DEV = {eq: 'EQ', comp: 'Comp', sc: 'Sidechain', limiter: 'Limiter', gain: 'Gain', mono: 'Mono'};
function drawMixer(){
  const m = $('mixer'); m.innerHTML = '';
  stripsOf(song).forEach(d => {
    const ti = song.tracks.findIndex(t => t.id === d.id), s = h('div', `strip kind-${d.kind}` + (d.id === sel ? ' sel' : ''));
    s.dataset.id = d.id; if (ti >= 0) s.style.setProperty('--tc', HUE(ti));
    const nm = h('button', 'nm', esc(d.name || d.id)); nm.title = `Open ${d.name || d.id}`; nm.onclick = () => { sel = d.id; selClip = null; drawDetail(); markSel(); };
    const chips = h('div', 'chips'); (d.chain || []).forEach((x, k) => { const c = h('span', 'chip', DEV[x.type] || x.type); c.dataset.k = k; chips.appendChild(c); });
    const ff = h('div', 'ff'), cv = h('canvas', 'met'); cv.width = 14; cv.height = 150;
    const f = h('input', 'fader'); Object.assign(f, {type: 'range', min: -40, max: 6, step: .5, value: d.vol || 0}); f.setAttribute('aria-label', `${d.name || d.id} volume`);
    const db = h('div', 'db', fmtDb(d.vol || 0) + ' dB');
    f.oninput = () => { setVal(`${d.id}.vol`, +f.value); db.textContent = fmtDb(+f.value) + ' dB'; };
    f.ondblclick = () => { f.value = 0; f.oninput(); };
    ff.append(cv, f);
    const pan = knob('Pan', -1, 1, 0, v => Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100), v => setVal(`${d.id}.pan`, v), d.pan || 0);
    const ms = h('div', 'ms');
    if (d.kind === 'track' || d.kind === 'group') for (const k of ['mute', 'solo']) { const b = h('button', k[0], k[0].toUpperCase()); b.setAttribute('aria-pressed', !!d[k]); b.title = k[0].toUpperCase() + k.slice(1);
      b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', v); setVal(`${d.id}.${k}`, v); }; ms.appendChild(b); }
    s.append(nm, chips, ff, db, pan, ms); m.appendChild(s);
    s._met = cv; s._chips = chips;
  });
}
const markSel = () => { document.querySelectorAll('.strip').forEach(s => s.classList.toggle('sel', s.dataset.id === sel)); document.querySelectorAll('.ses .clip').forEach(b => b.classList.toggle('sel', b.dataset.track === sel && b.dataset.clip === selClip)); };
// a change: into the song (and heard, when it's playing)
function setVal(path, v){
  const [id, ...r] = path.split('.'), k = r.join('.');
  if (player) player.E.set(path, v);
  else { // (not playing yet: the song itself)
    const T = song.tracks.find(t => t.id === id), d = T ? (T.mix = T.mix || {}) : id === 'master' ? song.master : [...(song.groups || []), ...(song.returns || [])].find(x => x.id === id);
    if (T && r[0] === 'inst') { if (T.inst.type === 'drums') { const vo = T.inst.voices = T.inst.voices || {}; (vo[r[1]] = vo[r[1]] || {})[r[2]] = v; } else (T.inst.p = T.inst.p || {})[r.slice(1).join('.')] = v; }
    else if (['vol', 'pan', 'mute', 'solo'].includes(k)) d[k] = v;
    else if (r[0] === 'send') (d.sends = d.sends || {})[r[1]] = v;
    else { const dv = (d.chain || [])[+r[0]]; if (dv) { const q = r.slice(1); if (dv.bands && q.length === 2) dv.bands[+q[0]][q[1]] = v; else if (DEV[dv.type]) dv[q[0]] = v; else (dv.p = dv.p || {})[q[0]] = v; } }
  }
  dataStale = true;
}

/* ---------- the open strip: its instrument, its devices, its sends, and a clip ---------- */
// the knobs worth having at hand for each instrument
const PICK = {analog: ['cut', 'res', 'fenv', 'drive', 'fd', 'det', 'uni', 'sub', 'glide', 'aa', 'ar', 'level'], fm: ['i2', 'i3', 'r2', 'r3', 'm2d', 'index', 'ad', 'cut', 'drive', 'level'],
  poly: ['cut', 'res', 'fenv', 'drive', 'level']};
const fmtOf = p => p.unit === 'Hz' ? fmtHz : p.unit === 's' ? (v => v < 1 ? Math.round(v*1000) + 'ms' : v.toFixed(2) + 's') : p.unit === 'st' || p.step ? (v => Math.round(v) + (p.unit || '')) : p.unit === '%' ? (v => Math.round(v*100) + '%') : (v => v.toFixed(2));
function kn(label, min, max, def, cur, fmt, path, log){
  // a log knob turns evenly in octaves
  if (log) { const L = x => Math.log(x), E = x => Math.exp(x); return knob(label, L(min), L(max), L(def), x => fmt(E(x)), x => setVal(path, E(x)), L(Math.max(min, cur))); }
  return knob(label, min, max, def, fmt, v => setVal(path, v), cur);
}
function drawDetail(){
  const D = $('detail'); D.innerHTML = '';
  const d = stripsOf(song).find(x => x.id === sel); if (!d) return;
  const T = song.tracks.find(t => t.id === sel), ti = song.tracks.indexOf(T);
  D.style.setProperty('--tc', ti >= 0 ? HUE(ti) : 'var(--accent)');
  D.appendChild(h('h3', null, `${esc(d.name || d.id)} <small>${T ? `${instrument(T.inst.type).label}${T.inst.preset ? ': ' + esc(T.inst.preset) : T.inst.kit ? ': ' + esc(T.inst.kit) + ' kit' : ''}` : d.kind === 'master' ? 'the master bus' : d.kind}${d.to ? ' → ' + esc(d.to) : ''}</small>`));
  const cards = h('div', 'cards');
  if (T) cards.appendChild(instCard(T));
  (d.chain || []).forEach((x, k) => cards.appendChild(devCard(d, x, k)));
  if (d.sends && Object.keys(d.sends).length) { const c = h('div', 'card', '<h4>Sends</h4>'), ks = h('div', 'knobs');
    for (const [r, v] of Object.entries(d.sends)) ks.appendChild(kn((song.returns.find(x => x.id === r) || {}).name || r, -40, 6, -40, v, fmtDb, `${d.id}.send.${r}`));
    c.appendChild(ks); cards.appendChild(c); }
  D.appendChild(cards);
  if (T) { const clip = selClip || Object.keys(T.clips)[0]; if (clip) D.appendChild(clipView(T, clip, ti)); }
}
function instCard(T){
  const I = instrument(T.inst.type), c = h('div', 'card', `<h4>${I.label}</h4>`), ks = h('div', 'knobs');
  if (I.key === 'drums') {
    const used = new Set(Object.values(T.clips).flatMap(cl => Object.keys(cl.hits || {})));
    const live = player && player.E.tracks.find(x => x.t.id === T.id), P = live ? live.inst.P : null;
    for (const v of I.voices.filter(v => used.has(v.key))) for (const p of I.params.filter(p => ['tune', 'decay', 'tone', 'drive', 'level'].includes(p.key))) {
      const cur = P ? P[v.key][p.key] : ((T.inst.voices || {})[v.key] || {})[p.key] ?? p.def;
      ks.appendChild(kn(`${v.label} ${p.label.toLowerCase()}`, p.min, p.max, p.def, cur, fmtOf(p), `${T.id}.inst.${v.key}.${p.key}`, p.log));
    }
  } else {
    const preset = (I.presets || {})[T.inst.preset] || {}, live = player && player.E.tracks.find(x => x.t.id === T.id);
    for (const k of PICK[I.key] || []) { const p = I.params.find(q => q.key === k); if (!p) continue;
      const cur = live ? live.inst.P[k] : (T.inst.p || {})[k] ?? preset[k] ?? p.def;
      ks.appendChild(kn(p.label, p.min, p.max, p.def, typeof cur === 'number' ? cur : p.def, fmtOf(p), `${T.id}.inst.${k}`, p.log)); }
  }
  c.appendChild(ks); return c;
}
function devCard(d, x, k){
  const c = h('div', 'card'), path = `${d.id}.${k}`, ks = h('div', 'knobs');
  c.innerHTML = `<h4><span>${DEV[x.type] || x.type}${x.type === 'sc' ? ' from ' + esc(x.src || 'kick') : ''}</span><span class="gr" data-k="${k}"></span></h4>`;
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
  if (!dv || !dv.curve) { g.fillStyle = '#4a5566'; g.font = '20px sans-serif'; g.fillText('Play to see the curve', 12, 30); return; }
  const F = Array.from({length: W/2}, (_, i) => 20*Math.pow(1000, i/(W/2))), r = dv.curve(F);
  g.strokeStyle = getComputedStyle(cv).getPropertyValue('--tc') || '#5cf'; g.lineWidth = 3; g.beginPath();
  r.forEach((db, i) => { const x = i*2, y = H/2 - Math.max(-24, Math.min(24, db))/24*(H/2 - 6); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
}
// a clip: drum rows you can click step by step, or the notes drawn on a roll
function clipView(T, id, ti){
  const clip = T.clips[id], r = readClip(clip), wrap = h('div', 'clipv');
  wrap.appendChild(h('h4', null, `<span style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)">Clip ${esc(id)} · ${r.len/16} bar${r.len > 16 ? 's' : ''}${r.len % 16 ? ` (${r.len} steps)` : ''}</span>`));
  if (clip.hits) {
    const st = h('div', 'steps'); st.style.setProperty('--tc', HUE(ti));
    for (const [voice, row] of Object.entries(clip.hits)) {
      const str = typeof row === 'string' ? row : row.p, clean = str.replace(/[\s|]/g, ''), rw = h('div', 'row');
      st.appendChild(h('span', null, esc(voice)));
      [...clean].forEach((ch, i) => { const b = h('button', i % 4 === 0 ? 'b' : ''), v = hitRow(ch).ev[0];
        if (v) { b.classList.add('on'); b.style.setProperty('--v', v.v); b.title = ch === '?' ? 'half the time' : `velocity ${Math.round(v.v*100)}%`; }
        b.setAttribute('aria-label', `${voice} step ${i + 1}${v ? ' on' : ''}`); b.dataset.i = i;
        b.onclick = () => { const s = [...clean]; s[i] = s[i] === '.' ? 'x' : '.'; const ns = s.join('');
          if (typeof row === 'string') clip.hits[voice] = ns; else row.p = ns; forget(clip); dataStale = true; drawDetail(); };
        rw.appendChild(b); });
      st.appendChild(rw);
    }
    wrap.appendChild(st);
  } else {
    const cv = h('canvas', 'roll'); cv.width = 1200; cv.height = 320; wrap.appendChild(cv);
    requestAnimationFrame(() => { const g = cv.getContext('2d'), W = cv.width, H = cv.height, ns = r.ev.map(e => e.n), lo = Math.min(...ns) - 2, hi = Math.max(...ns) + 2, rows = hi - lo + 1;
      g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
      for (let n = lo; n <= hi; n++) { if ([1, 3, 6, 8, 10].includes(((n % 12) + 12) % 12)) { g.fillStyle = '#0a0d12'; g.fillRect(0, H - (n - lo + 1)*H/rows, W, H/rows); } }
      for (let s = 0; s <= r.len; s++) { g.fillStyle = s % 16 ? s % 4 ? '#0e131a' : '#1a222d' : '#2a3442'; g.fillRect(s*W/r.len, 0, 1, H); }
      g.fillStyle = '#8794a6'; g.font = '18px IBM Plex Mono, monospace'; for (let n = lo; n <= hi; n++) if (n % 12 === 0 || n === lo + 2) g.fillText(noteName(n), 4, H - (n - lo)*H/rows - 4);
      for (const e of r.ev) { const x = e.s*W/r.len, w = Math.max(3, e.l*W/r.len - 2), y = H - (e.n - lo + 1)*H/rows;
        g.globalAlpha = .35 + .65*e.v*(e.p < 1 ? .6 : 1); g.fillStyle = HUE(ti); g.fillRect(x, y + 1, w, H/rows - 2); g.globalAlpha = 1; } });
  }
  return wrap;
}

/* ---------- transport and the live view ---------- */
const setPlay = () => { $('play').textContent = player && player.playing ? '↺ Restart' : '▶ Play'; };
$('play').onclick = () => { build().play({bar: 0}); setPlay(); };
$('stop').onclick = () => { if (player) player.stop(); setPlay(); };
document.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); if (player && player.playing) $('stop').onclick(); else $('play').onclick(); } });

let lastT = 0, specBuf = null;
function frame(t){
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (t - lastT)/1000 || .016); lastT = t;
  if (!player) return;
  const E = player.E, A = arrangement(song), n = player.playing ? Math.floor(player.pos()) : -1;
  if (player.playing && player.end && n > A.bars*16 + 32) { player.stop(); setPlay(); }
  // where it is
  if (n >= 0) { const bar = Math.floor(n/16), beat = Math.floor(n/4) % 4, six = n % 4; $('pos').textContent = `${bar + 1}.${beat + 1}.${six + 1}`;
    $('head').style.left = E.mode === 'arrange' ? `${Math.min(100, n/(A.bars*16)*100)}%` : '-4px';
    document.querySelectorAll('.arr .part').forEach(p => p.classList.toggle('now', E.mode === 'arrange' && bar >= +p.dataset.at && bar < +p.dataset.at + A.parts.find(x => x.at === +p.dataset.at).bars));
    const live = Object.fromEntries(song.tracks.map(x => [x.id, E.clipOf(x.id, n)])), sc = E.sceneAt(n);
    document.querySelectorAll('.ses .clip').forEach(b => { const q = E.over[b.dataset.track]; b.classList.toggle('live', live[b.dataset.track] === b.dataset.clip && (E.mode !== 'session' || !q || q.clip === b.dataset.clip));
      b.classList.toggle('queued', !!(q && q.next === b.dataset.clip) || (E.session.next && song.scenes.find(s => s.id === E.session.next).clips[b.dataset.track] === b.dataset.clip)); });
    document.querySelectorAll('.ses th.scene button').forEach(b => b.classList.toggle('live', b.dataset.scene === sc));
    document.querySelectorAll('.steps .row button').forEach(b => b.classList.remove('ph'));
    const T = song.tracks.find(x => x.id === sel), cid = selClip || (T && Object.keys(T.clips)[0]);
    const run = T && E.clipRun(T.id, n);
    if (run && run.id === cid) { const r = readClip(T.clips[cid]), pos = ((n - run.at) % r.len + r.len) % r.len;
      document.querySelectorAll(`.steps .row button[data-i="${pos}"]`).forEach(b => b.classList.add('ph')); }
  } else { $('pos').textContent = '–'; }
  // meters: peak and level, with how far each device is turning it down
  for (const s of document.querySelectorAll('.strip')) {
    const m = E.desk.meter(s.dataset.id, dt, TUNE.studio.meterFall); if (!m) continue;
    const g = s._met.getContext('2d'), H = s._met.height, y = db => H*(1 - Math.max(0, Math.min(1, (db + 48)/54)));
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 14, H);
    const grd = g.createLinearGradient(0, H, 0, 0); grd.addColorStop(0, '#3fd68a'); grd.addColorStop(.75, '#3fd68a'); grd.addColorStop(.88, '#f2b33d'); grd.addColorStop(1, '#ff5a5a');
    g.fillStyle = grd; g.fillRect(2, y(m.rms + 3), 10, H - y(m.rms + 3));
    g.fillStyle = m.peak > -.5 ? '#ff5a5a' : '#e8eef5'; g.fillRect(1, y(m.peak), 12, 2);
    const gr = Math.max(0, ...m.gr); if (gr > .1) { g.fillStyle = '#b48cff'; g.fillRect(0, 0, 3, Math.min(H, gr/24*H)); }
    s._chips.querySelectorAll('.chip').forEach(c => { const v = m.gr[+c.dataset.k] || 0; c.classList.toggle('gr', v > .3); c.textContent = (DEV[(stripsOf(song).find(x => x.id === s.dataset.id).chain[+c.dataset.k] || {}).type] || 'fx') + (v > .3 ? ' −' + v.toFixed(0) : ''); });
    if (s.dataset.id === sel) document.querySelectorAll('.detail .gr').forEach(e => { const v = m.gr[+e.dataset.k] || 0; e.textContent = v > .1 ? `−${v.toFixed(1)} dB` : ''; });
  }
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
      `<div class="bands">${Object.entries(r.bands).map(([k, v]) => `<span>${k}</span><i style="width:${Math.max(2, 100 + (v - max)*3)}%"></i><span>${v.toFixed(1)}</span>`).join('')}</div>`;
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

/* ---------- the song as data ---------- */
let dataStale = false;
// JSON with the short arrays (notes, points) kept on one line each
const pretty = o => JSON.stringify(o, null, 2).replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (m, x) => '[' + x.replace(/\s*\n\s*/g, ' ') + ']');
const showData = () => { $('json').value = pretty(song); dataStale = false; $('dmsg').textContent = ''; $('dmsg').className = 'dmsg'; };
setInterval(() => { if (dataStale && document.activeElement !== $('json')) showData(); }, 1000);
$('copy').onclick = async () => { const t = $('json'); try { await navigator.clipboard.writeText(t.value); $('dmsg').textContent = 'Copied.'; } catch (e) { t.select(); $('dmsg').textContent = 'Selected: copy it with your keyboard.'; } };
$('paste').onclick = () => {
  let s; try { s = JSON.parse($('json').value); } catch (e) { $('dmsg').textContent = 'That isn’t valid JSON: ' + e.message; $('dmsg').className = 'dmsg bad'; return; }
  const bad = check(s); if (bad.length) { $('dmsg').textContent = bad.slice(0, 4).join(' · '); $('dmsg').className = 'dmsg bad'; return; }
  const was = player && player.playing; songs[idx] = s; load(idx); if (was) { build().play({bar: 0}); setPlay(); } $('dmsg').textContent = 'Loaded.';
};

/* ---------- start ---------- */
SONGS.forEach((s, i) => { const b = h('button', null, esc(s.title)); b.onclick = () => { const was = player && player.playing; load(i); if (was) { build().play({bar: 0}); setPlay(); } }; $('songs').appendChild(b); });
load(0);
// (a reset to the song as written: drop the page's changes)
window.__studio = {get player(){ return player; }, get song(){ return song; }, reset(){ songs[idx] = structuredClone(pristine[idx]); load(idx); }, load};
