// The DJ panel under the picture (audio/dj.js): two decks and a mixer, for the mouse; it opens and collapses from the bar's DJ button.
import { DJ, PEAK_HZ, barBeat, beatAt, bpm, djBend, djCue, djEq, djFader, djFilter, djLoad, djLoop, djPlay, djSeek, djSetCue, djSync, djTempo, djXf, onDJ, pos, timeOfBeat } from '../audio/dj.js';
import { actx, tracks } from '../audio/player.js';
import { resize } from '../render/gl.js';
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { toast } from './toast.js';
import { $ } from '../util.js';

const root = $('#dj'), btn = $('#djBtn'), COL = ['#5ad1ff', '#ff7ab8'], LOOPS = [1, 2, 4, 8, 16];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const mmss = t => { t = Math.max(0, t); return `${Math.floor(t/60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };

// a knob: drag up or down (or the wheel) to turn it, double-click to set it back
function knob(label, min, max, def, fmt, onChange){
  const k = el('div', 'knob'), svg = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" class="kt"/><path class="ka"/><line x1="20" y1="20" x2="20" y2="7" class="kp"/></svg>`;
  k.innerHTML = svg + `<span class="kv"></span><span class="kl">${label}</span>`; k.tabIndex = 0; k.setAttribute('role', 'slider'); k.setAttribute('aria-label', label);
  let v = def;
  // the setting it goes back to sits at twelve o'clock (0 dB, the filter off), the arc growing either way from there
  const ang = x => x < def ? -2.4*(def - x)/(def - min || 1) : 2.4*(x - def)/(max - def || 1);
  const arc = a => { const r = 15, p = t => [20 + r*Math.sin(t), 20 - r*Math.cos(t)], [x0, y0] = p(Math.min(0, a)), [x1, y1] = p(Math.max(0, a)); return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const set = (nv, quiet) => {
    v = Math.max(min, Math.min(max, nv)); const a = ang(v);
    k.querySelector('.ka').setAttribute('d', arc(a)); k.querySelector('.kp').setAttribute('transform', `rotate(${a*180/Math.PI} 20 20)`);
    k.querySelector('.kv').textContent = fmt(v); k.setAttribute('aria-valuenow', v.toFixed(2)); if (!quiet) onChange(v);
  };
  let y0 = 0, v0 = 0;
  k.addEventListener('pointerdown', e => { y0 = e.clientY; v0 = v; k.setPointerCapture(e.pointerId); k.classList.add('on'); e.preventDefault(); });
  k.addEventListener('pointermove', e => { if (k.hasPointerCapture(e.pointerId)) set(v0 + (y0 - e.clientY)/140*(max - min)); });
  k.addEventListener('pointerup', e => { k.releasePointerCapture(e.pointerId); k.classList.remove('on'); });
  k.addEventListener('wheel', e => { e.preventDefault(); set(v - Math.sign(e.deltaY)*(max - min)/40); }, {passive: false});
  k.addEventListener('dblclick', () => set(def));
  set(def, true); return k;
}
// a slider (range input) that double-click sets back
function slider(cls, min, max, step, def, label, onInput){
  const s = el('input', cls); Object.assign(s, {type: 'range', min, max, step, value: def}); s.setAttribute('aria-label', label);
  s.addEventListener('input', () => onInput(+s.value)); s.addEventListener('dblclick', () => { s.value = def; onInput(def); });
  return s;
}

/* ---------- the decks ---------- */
const UI = DJ.decks.map(d => {
  const i = d.i, L = 'AB'[i], box = el('div', 'deck d' + L);
  box.innerHTML = `<div class="dh"><b style="color:${COL[i]}">${L}</b><span class="dn">Drop a track here, or Load</span><span class="lead" hidden>visuals follow</span>
    <span class="ph">${'<i></i>'.repeat(4)}</span><span class="db">— BPM</span><span class="dt">0:00</span></div>
    <canvas class="zoom" height="64"></canvas><canvas class="over" height="18"></canvas>
    <div class="dc"><label class="btn small">Load<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" hidden></label><select class="pl" aria-label="Load from the playlist" hidden></select>
    <button class="cue" title="Back to the cue point (the orange mark), stopped">Cue</button><button class="play" aria-label="Play">▶</button>
    <button class="sync" aria-pressed="false" title="Match the other deck's tempo and line up the bars">Sync</button>
    <button class="nd" title="Hold: slow down a touch">−</button><button class="nu" title="Hold: speed up a touch">+</button>
    <span class="tl">Tempo</span></div>
    <div class="dl"><button class="set" title="Put the cue point here, on the nearest beat">Set cue</button><span class="tl">Loop</span>${LOOPS.map(n => `<button class="lp" data-n="${n}" aria-pressed="false" title="Loop ${n} beat${n > 1 ? 's' : ''} from here (again: out of the loop)">${n}</button>`).join('')}<span class="tl">beats</span></div>`;
  const q = s => box.querySelector(s), tempo = slider('tempo', -1, 1, .0005, 0, 'Tempo', v => djTempo(i, v));
  q('.dc').append(tempo, el('span', 'tv', '0.0%'));
  const load = f => { if (f) djLoad(i, f).catch(() => toast('Could not read that file')); };
  q('input[type=file]').addEventListener('change', e => { load(e.target.files[0]); e.target.value = ''; });
  q('.pl').addEventListener('change', e => { const t = tracks[+e.target.value]; if (t) djLoad(i, t.file, t.name).catch(() => toast('Could not read that file')); e.target.value = ''; });
  q('.cue').addEventListener('click', () => djCue(i));
  q('.set').addEventListener('click', () => djSetCue(i));
  box.querySelectorAll('.lp').forEach(b => b.addEventListener('click', () => djLoop(i, +b.dataset.n)));
  q('.play').addEventListener('click', () => djPlay(i));
  q('.sync').addEventListener('click', () => { if (djSync(i) === null) toast('No steady beat was read in one of the tracks'); });
  for (const [s, dir] of [['.nd', -1], ['.nu', 1]]) {
    const b = q(s), up = () => djBend(i, 0);
    b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); djBend(i, dir); }); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  // a track dropped on a deck goes into it (not into the playlist)
  box.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); box.classList.remove('drag'); document.body.classList.remove('dragging'); load([...e.dataTransfer.files].find(f => /^audio\//.test(f.type) || /\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(f.name))); });
  // the overview: click or drag to move through the track
  const over = q('.over'), seekAt = e => { const r = over.getBoundingClientRect(); if (d.buf) djSeek(i, (e.clientX - r.left)/r.width*d.buf.duration); };
  over.addEventListener('pointerdown', e => { over.setPointerCapture(e.pointerId); seekAt(e); });
  over.addEventListener('pointermove', e => { if (over.hasPointerCapture(e.pointerId)) seekAt(e); });
  return {d, box, q, tempo, zoom: q('.zoom'), over, ov: null};
});

/* ---------- the mixer ---------- */
const mix = el('div', 'mixer'), T = TUNE.dj, dbf = v => v <= T.eqMin + .1 ? 'kill' : (v > 0 ? '+' : '') + v.toFixed(0);
const chans = el('div', 'chans');
for (const d of DJ.decks) {
  const c = el('div', 'chan'), i = d.i;
  c.append(el('b', '', 'AB'[i]));
  for (const [band, lab] of [['high', 'Hi'], ['mid', 'Mid'], ['low', 'Low']]) c.append(knob(lab, T.eqMin, T.eqMax, 0, dbf, v => djEq(i, band, v)));
  c.append(knob('Filter', -1, 1, 0, v => Math.abs(v) < .02 ? 'off' : v < 0 ? 'LP' : 'HP', v => djFilter(i, v)));
  c.append(slider('fader', 0, 1, .01, 1, 'Deck ' + 'AB'[i] + ' volume', v => djFader(i, v)));
  chans.append(c);
}
mix.append(chans, el('div', 'xfl', '<span>A</span><span>Crossfader</span><span>B</span>'), slider('xf', 0, 1, .005, .5, 'Crossfader', djXf));
const head = el('div', 'djh', '<b>DJ</b><span>Two decks and a mixer: the visuals follow the mix, and keep time with the deck the faders favour. Drag knobs up or down; double-click sets one back.</span><button class="djx" aria-label="Collapse the DJ panel">▾ Hide</button>');
const body = el('div', 'djb'); body.append(UI[0].box, mix, UI[1].box);
root.append(head, body);
head.querySelector('.djx').addEventListener('click', () => setOpen(false));
root.addEventListener('keydown', e => e.stopPropagation());   // (keys on a knob or slider don't reach the page's own)

/* ---------- open and collapse ---------- */
export function setOpen(on){
  DJ.open = on; root.hidden = !on; btn.setAttribute('aria-pressed', on);
  S.djH = on ? Math.round(Math.min(T.panelH, innerHeight*T.maxShare)) : 0;
  document.documentElement.style.setProperty('--djH', S.djH + 'px'); document.body.classList.toggle('djopen', on);
  resize();   // (the picture is drawn that much shorter: render/gl.js)
  if (on) { $('#welcome').classList.add('gone'); refresh(); requestAnimationFrame(draw); }
}
btn.addEventListener('click', () => setOpen(!DJ.open));
addEventListener('resize', () => { if (DJ.open) setOpen(true); });

// what the decks say: their names, whether they're playing, synced or leading, and the playlist to load from
function refresh(){
  for (const u of UI) {
    const d = u.d, q = u.q;
    q('.dn').textContent = d.reading ? `${d.name}: reading…` : d.name || 'Drop a track here, or Load';
    q('.play').textContent = d.playing ? '❚❚' : '▶'; q('.play').setAttribute('aria-label', d.playing ? 'Pause' : 'Play'); q('.play').disabled = !d.buf;
    q('.cue').disabled = q('.set').disabled = !d.buf; q('.sync').setAttribute('aria-pressed', d.sync);
    u.box.querySelectorAll('.lp').forEach(b => { b.disabled = !(d.ana && d.ana.map); b.setAttribute('aria-pressed', !!d.loop && d.loop.n === +b.dataset.n); }); q('.lead').hidden = DJ.lead !== d;
    u.tempo.value = (d.base - 1)/T.tempoRange; u.tempo.disabled = d.sync;
    const pl = q('.pl'); pl.hidden = !tracks.length;
    if (tracks.length && pl.options.length !== tracks.length + 1) pl.innerHTML = '<option value="">Playlist…</option>' + tracks.map((t, k) => `<option value="${k}">${t.name.replace(/</g, '&lt;')}</option>`).join('');
    u.ov = null;   // (the overview redrawn: a new track, or its waveform arrived)
  }
}
onDJ(() => { if (DJ.open) refresh(); });

/* ---------- drawing, while the panel is open ---------- */
function fit(c){ const w = Math.max(10, Math.round(c.clientWidth*devicePixelRatio)), h = Math.round(c.clientHeight*devicePixelRatio); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c.getContext('2d'); }
const at = d => actx && d.buf ? pos(d, actx.currentTime - (actx.outputLatency || actx.baseLatency || 0)) : d.off;   // as heard
function draw(){
  if (!DJ.open) return;
  for (const u of UI) {
    const d = u.d, x = at(d), M = d.ana && d.ana.map, q = u.q;
    q('.dt').textContent = d.buf ? `${mmss(x)} / -${mmss(d.buf.duration - x)}` : '0:00';
    q('.db').textContent = M ? `${bpm(d).toFixed(1)} BPM` : d.buf && !d.reading ? 'no steady beat' : '— BPM';
    q('.tv').textContent = `${d.base >= 1 ? '+' : ''}${((d.base - 1)*100).toFixed(1)}%`;
    const bb = M && d.buf ? Math.floor(barBeat(d, x)) : -1; q('.ph').querySelectorAll('i').forEach((e, k) => e.classList.toggle('on', k === bb));
    zoomView(u, x); overView(u, x);
  }
  requestAnimationFrame(draw);
}
// the close waveform: the playhead in the middle, the beats, bars and phrases across it, the drops in red
function zoomView(u, x){
  const c = u.zoom, g = fit(c), W = c.width, H = c.height, d = u.d, P = d.peaks, zs = T.zoomSecs, x0 = x - zs/2, col = COL[d.i];
  g.clearRect(0, 0, W, H); if (!d.buf) return;
  const M = d.ana && d.ana.map;
  if (M) {
    const k0 = Math.ceil(beatAt(d, x0)), k1 = Math.floor(beatAt(d, x0 + zs));
    for (let k = k0; k <= k1; k++) {
      const bar = (k - M.down)/4, isBar = Number.isInteger(bar), phrase = isBar && ((bar - M.phrase) % 4 + 4) % 4 === 0, px = (timeOfBeat(d, k) - x0)/zs*W;
      g.fillStyle = phrase ? 'rgba(255,255,255,.55)' : isBar ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)'; g.fillRect(Math.round(px), 0, phrase ? 2 : 1, H);
    }
  }
  if (d.loop) { const la = (d.loop.a - x0)/zs*W, lb = (d.loop.b - x0)/zs*W; g.fillStyle = 'rgba(255,176,0,.16)'; g.fillRect(la, 0, lb - la, H); g.fillStyle = '#ffb000'; g.fillRect(la, 0, 2, H); g.fillRect(lb - 2, 0, 2, H); }
  if (P) for (let px = 0; px < W; px++) {
    const a = Math.floor((x0 + px/W*zs)*PEAK_HZ), b = Math.max(a + 1, Math.floor((x0 + (px + 1)/W*zs)*PEAK_HZ));
    let m = 0; for (let j = Math.max(0, a); j < Math.min(P.length, b); j++) if (P[j] > m) m = P[j];
    const h = Math.min(1, m)*H*.92; g.fillStyle = px < W/2 ? col + '88' : col; g.fillRect(px, (H - h)/2, 1, h);
  }
  if (d.ana) { g.fillStyle = '#ff4040'; for (const dr of d.ana.drops) { const px = (dr.t - x0)/zs*W; if (px > -2 && px < W) g.fillRect(px, 0, 2, H); } }
  const cx = (d.cue - x0)/zs*W; g.fillStyle = '#ffb000'; g.beginPath(); g.moveTo(cx - 5, 0); g.lineTo(cx + 5, 0); g.lineTo(cx, 7); g.fill();
  g.fillStyle = '#fff'; g.fillRect(Math.floor(W/2), 0, 2, H);
}
// the whole track: its waveform (drawn once), how far it's played, the drops and the cue
function overView(u, x){
  const c = u.over, g = fit(c), W = c.width, H = c.height, d = u.d, P = d.peaks;
  if (!d.buf) { g.clearRect(0, 0, W, H); return; }
  if (!u.ov || u.ov.width !== W || u.ov.height !== H) {
    const o = u.ov = document.createElement('canvas'); o.width = W; o.height = H; const og = o.getContext('2d'); og.fillStyle = COL[d.i];
    if (P) for (let px = 0; px < W; px++) { const a = Math.floor(px/W*P.length), b = Math.max(a + 1, Math.floor((px + 1)/W*P.length)); let m = 0; for (let j = a; j < b; j++) if (P[j] > m) m = P[j]; const h = Math.min(1, m)*H; og.fillRect(px, (H - h)/2, 1, h); }
    if (d.ana) { og.fillStyle = '#ff4040'; for (const dr of d.ana.drops) og.fillRect(dr.t/d.buf.duration*W, 0, 2, H); }
  }
  g.clearRect(0, 0, W, H); g.drawImage(u.ov, 0, 0);
  const px = x/d.buf.duration*W; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, px, H);
  if (d.loop) { g.fillStyle = 'rgba(255,176,0,.45)'; g.fillRect(d.loop.a/d.buf.duration*W, 0, Math.max(2, (d.loop.b - d.loop.a)/d.buf.duration*W), H); }
  g.fillStyle = '#ffb000'; g.fillRect(d.cue/d.buf.duration*W, 0, 2, H); g.fillStyle = '#fff'; g.fillRect(px, 0, 2, H);
}
