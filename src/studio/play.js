// The Studio's play view: a touch-first surface (made for an iPad, fine with a mouse). Pick a track, play its pads or keys
// live in the song's key, record what you play into its clip on the sixteenths, sweep its filter on an XY pad, step the
// clip, launch its clips or start a new one. Everything played and moved is written into the song, so it can be saved and
// shown to Claude.
import { readClip, noteName } from './song.js';

const SCALES = {minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10]};
const ROOTS = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};
// the song's key ('A minor', 'D dorian') as a root and a scale
const keyOf = k => { const m = /^([A-G][#b]?)\s*(\w+)?/.exec(k || 'A minor') || []; return {root: ROOTS[m[1]] ?? 9, scale: SCALES[(m[2] || 'minor').toLowerCase()] || SCALES.minor}; };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const $ = id => document.getElementById(id);
// (a pointer capture can fail for a pointer the browser no longer tracks: the note still plays)
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (x) {} };

// api: {song(), player(), ctx(), build(), edited(clip), setVal(path, v), select(track, clip), stepsOf(T, clip), newClip(T), hue(i), padLabel(T, k), sel()}
export function mountPlay(api){
  const st = {track: null, oct: 0, rec: false, held: new Map()};
  const T = () => api.song().tracks.find(t => t.id === st.track) || api.song().tracks[0];
  const clipId = () => { const t = T(), s = api.sel(); return s.track === t.id && t.clips[s.clip] ? s.clip : Object.keys(t.clips)[0]; };
  const isDrums = t => t.inst.type === 'drums';
  const open = () => { st.track = api.sel().track || api.song().tracks[0].id; $('pv').hidden = false; document.body.classList.add('pvon'); draw(); };
  const close = () => { $('pv').hidden = true; document.body.classList.remove('pvon'); for (const [, x] of st.held) off(x); st.held.clear(); };
  $('pvClose').onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('pv').hidden) close(); });

  // the transport: play the scene holding this clip, round and round; record on or off
  $('pvPlay').onclick = () => api.build().then(pl => { if (pl.playing) { pl.stop(); return paintTx(); }
    const t = T(), c = clipId(), sc = api.song().scenes.find(s => (s.clips || {})[t.id] === c) || api.song().scenes[0];
    pl.play({scene: sc.id}); if (sc.clips[t.id] !== c) pl.launchClip(t.id, c); paintTx(); });
  $('pvRec').onclick = () => { st.rec = !st.rec; $('pvRec').setAttribute('aria-pressed', st.rec); };
  const paintTx = () => { const pl = api.player(); $('pvPlay').textContent = pl && pl.playing ? '■' : '▶'; };

  function draw(){
    const song = api.song(), t = T(), ti = song.tracks.indexOf(t);
    $('pv').style.setProperty('--tc', api.hue(ti));
    // the tracks
    const tr = $('pvTracks'); tr.innerHTML = '';
    song.tracks.forEach((x, i) => { const b = h('button', 'pvt', x.name || x.id); b.style.setProperty('--tc', api.hue(i)); b.setAttribute('aria-pressed', x.id === t.id);
      b.onclick = () => { st.track = x.id; api.select(x.id, Object.keys(x.clips)[0]); draw(); }; tr.appendChild(b); });
    // its clips: a tap launches one (and opens it); + New starts an empty one
    const cl = $('pvClips'); cl.innerHTML = '';
    for (const id of Object.keys(t.clips)) { const b = h('button', 'pvc', id); b.dataset.clip = id; b.setAttribute('aria-pressed', id === clipId());
      b.onclick = () => { api.select(t.id, id); api.build().then(pl => { if (pl.playing) pl.launchClip(t.id, id); }); draw(); }; cl.appendChild(b); }
    const nb = h('button', 'pvc new', '+ New clip'); nb.onclick = () => { const id = api.newClip(t); api.build().then(pl => { if (pl.playing) pl.launchClip(t.id, id); }); draw(); }; cl.appendChild(nb);
    if (!isDrums(t)) { const o = h('span', 'pvoct'); const dn = h('button', null, 'Oct −'), up = h('button', null, 'Oct +'), lab = h('span', null, '');
      const show = () => lab.textContent = ` ${st.oct >= 0 ? '+' : ''}${st.oct} `; show();
      dn.onclick = () => { st.oct = Math.max(-2, st.oct - 1); show(); keys(); }; up.onclick = () => { st.oct = Math.min(2, st.oct + 1); show(); keys(); }; o.append(dn, lab, up); cl.appendChild(o); }
    isDrums(t) ? pads() : keys();
    xy(); steps(); paintTx();
  }
  // the pads of a drum rack (or the voices its clips use): hit hard at the top of a pad, softly at the bottom
  function pads(){
    const t = T(), area = $('pvPlayArea'); area.innerHTML = ''; area.className = 'pvplay pads';
    const keys = [...new Set([...Object.keys(t.pads || {}), ...Object.values(t.clips).flatMap(c => Object.keys(c.hits || {}))])];
    for (const k of keys) { const b = h('button', 'pvpad', api.padLabel(t, k));
      b.addEventListener('pointerdown', e => { e.preventDefault(); const r = b.getBoundingClientRect(), vel = Math.max(.35, Math.min(1, 1.1 - (e.clientY - r.top)/r.height*.7));
        b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); hit(k, vel); });
      area.appendChild(b); }
  }
  // two octaves of the song's scale from its root, the octave up on top
  function keys(){
    const t = T(), area = $('pvPlayArea'); area.innerHTML = ''; area.className = 'pvplay keys';
    const {root, scale} = keyOf(api.song().key), bass = /bass|sub/i.test((t.name || '') + (t.inst.preset || '')), base = 12*((bass ? 2 : 4) + st.oct) + root + 12;
    for (const row of [1, 0]) { const r = h('div', 'pvrow');
      for (let d = 0; d <= scale.length; d++) { const n = base + 12*row + (d === scale.length ? 12 : scale[d]), b = h('button', 'pvkey' + (d === 0 || d === scale.length ? ' root' : ''), noteName(n)); b.dataset.n = n; r.appendChild(b); }
      area.appendChild(r); }
    // (a finger held plays; sliding to another key moves the note there)
    const at = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest && el.closest('.pvkey'); };
    area.onpointerdown = e => { const k = at(e); if (!k) return; e.preventDefault(); capture(area, e); press(e.pointerId, k); };
    area.onpointermove = e => { const x = st.held.get(e.pointerId); if (!x) return; const k = at(e); if (k && k !== x.el) { release(e.pointerId); press(e.pointerId, k); } };
    area.onpointerup = area.onpointercancel = e => release(e.pointerId);
  }
  const press = (id, el) => { const n = +el.dataset.n, x = {el, n, t: api.ctx().currentTime}; el.classList.add('hit'); st.held.set(id, x); on(x); };
  const release = id => { const x = st.held.get(id); if (!x) return; st.held.delete(id); x.el.classList.remove('hit'); off(x); };

  /* ---------- sound, and recording into the clip ---------- */
  const live = () => { const pl = api.player(); return pl && pl.E.tracks.find(x => x.t.id === T().id); };
  function hit(k, vel){ api.build().then(pl => { const tr = pl.E.tracks.find(x => x.t.id === T().id); if (!tr) return; tr.inst.play(k, api.ctx().currentTime, .2, vel); record({k, vel}); }); }
  function on(x){ api.build().then(() => { const tr = live(); if (tr && tr.inst.noteOn) tr.inst.noteOn(x.n, .85, api.ctx().currentTime); }); }
  function off(x){ const tr = live(); if (tr && tr.inst.noteOff) tr.inst.noteOff(x.n, api.ctx().currentTime); record({n: x.n, len: api.ctx().currentTime - x.t, t: x.t}); }
  // where in the playing clip a moment falls, to the nearest sixteenth (null if the clip isn't the one playing)
  function stepAt(t){
    const pl = api.player(), tr = T(), id = clipId(); if (!st.rec || !pl || !pl.playing) return null;
    const E = pl.E, x = (t - E.t0)/E.S16, run = E.clipRun(tr.id, Math.floor(x)); if (!run || run.id !== id) return null;
    const len = readClip(tr.clips[id]).len; return {s: ((Math.round(x - run.at) % len) + len) % len, len};
  }
  function record({k, vel, n, len, t}){
    const tr = T(), clip = tr.clips[clipId()], at = stepAt(t == null ? api.ctx().currentTime : t); if (!at) return;
    if (k) { clip.hits = clip.hits || {}; const row = clip.hits[k], str = (typeof row === 'string' ? row : row ? row.p : '').replace(/[\s|]/g, '') || '.'.repeat(at.len);
      const s = [...str.padEnd(at.len, '.')]; s[at.s % s.length] = vel > .9 ? 'X' : 'x'; const ns = s.join(''); clip.hits[k] = row && typeof row === 'object' ? {...row, p: ns} : ns; }
    else { const S16 = api.player().E.S16, l = Math.max(1, Math.round(len/S16)); clip.notes = [...(clip.notes || []), [at.s, n, l, .85]]; }
    api.edited(clip); steps();
  }

  /* ---------- the XY pad: across the cutoff, up the resonance (drums: brightness and decay) ---------- */
  const XY = {analog: ['cut', 'res', 60, 12000, 0, 1], moog: ['cut', 'res', 60, 12000, 0, 1.05], fm: ['cut', 'index', 300, 16000, 0, 2], poly: ['cut', 'res', 60, 12000, 0, 1]};
  let xyv = [.5, .3];
  function xy(){
    const t = T(), cv = $('pvXY'), lbl = $('pvXYl'), d = isDrums(t), m = XY[t.inst.type];
    lbl.textContent = d ? '← darker · brighter →   ↑ longer' : m ? `← ${m[0] === 'cut' ? 'cutoff' : m[0]} →   ↑ ${m[1] === 'res' ? 'resonance' : m[1]}` : '';
    const P = (live() || {}).inst ? live().inst.P : null;
    if (P && m) xyv = [Math.log((P[m[0]] || 1000)/m[2])/Math.log(m[3]/m[2]), ((P[m[1]] || 0) - m[4])/(m[5] - m[4])];
    paintXY();
    const move = e => { const r = cv.getBoundingClientRect(); xyv = [Math.max(0, Math.min(1, (e.clientX - r.left)/r.width)), Math.max(0, Math.min(1, 1 - (e.clientY - r.top)/r.height))]; apply(); paintXY(); };
    cv.onpointerdown = e => { e.preventDefault(); capture(cv, e); move(e); };
    cv.onpointermove = e => { if (cv.hasPointerCapture(e.pointerId)) move(e); };
  }
  let applyT = 0;
  function apply(){
    const t = T(), m = XY[t.inst.type];
    if (isDrums(t)) { clearTimeout(applyT); applyT = setTimeout(() => { for (const k of Object.keys(t.pads || {})) { api.setVal(`${t.id}.inst.${k}.tone`, .3 + .7*xyv[0]); api.setVal(`${t.id}.inst.${k}.decay`, .4 + 1.6*xyv[1]); } }, 30); return; }
    if (!m) return;
    api.setVal(`${t.id}.inst.${m[0]}`, m[2]*Math.pow(m[3]/m[2], xyv[0])); api.setVal(`${t.id}.inst.${m[1]}`, m[4] + (m[5] - m[4])*xyv[1]);
  }
  function paintXY(){
    const cv = $('pvXY'), g = cv.getContext('2d'), W = cv.width, H = cv.height, tc = getComputedStyle($('pv')).getPropertyValue('--tc') || '#5cf';
    g.fillStyle = '#080b10'; g.fillRect(0, 0, W, H); g.strokeStyle = '#18202b'; g.lineWidth = 2;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i*W/6, 0); g.lineTo(i*W/6, H); g.moveTo(0, i*H/6); g.lineTo(W, i*H/6); g.stroke(); }
    const x = xyv[0]*W, y = (1 - xyv[1])*H, gr = g.createRadialGradient(x, y, 0, x, y, 90); gr.addColorStop(0, tc); gr.addColorStop(1, 'transparent');
    g.globalAlpha = .45; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    g.strokeStyle = tc; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 22, 0, 2*Math.PI); g.stroke();
  }
  // the clip's steps, big
  function steps(){ const box = $('pvSteps'), t = T(); box.innerHTML = ''; box.style.setProperty('--tc', api.hue(api.song().tracks.indexOf(t))); box.appendChild(api.stepsOf(t, t.clips[clipId()])); }

  // the playhead and the position, each frame (from the page's own loop)
  function frame(n){
    if ($('pv').hidden) return;
    const pl = api.player(); $('pvPos').textContent = n >= 0 ? `${Math.floor(n/16) + 1}.${Math.floor(n/4) % 4 + 1}` : '–';
    const t = T(), run = pl && pl.playing && pl.E.clipRun(t.id, n);
    document.querySelectorAll('#pvClips .pvc').forEach(b => b.classList.toggle('live', !!run && run.id === b.dataset.clip));
    document.querySelectorAll('#pvSteps .row button.ph').forEach(b => b.classList.remove('ph'));
    if (run && run.id === clipId()) { const r = readClip(t.clips[run.id]), pos = ((n - run.at) % r.len + r.len) % r.len;
      document.querySelectorAll('#pvSteps .row').forEach(rw => { const b = rw.children[pos - +rw.dataset.from]; if (b) b.classList.add('ph'); }); }
  }
  return {open, close, draw, frame, steps};
}
