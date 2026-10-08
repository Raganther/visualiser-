// The DJ panel under the picture (audio/dj.js): two decks and a mixer, for the mouse; it opens and collapses from the bar's DJ button.
import { DJ, PEAK_HZ, barBeat, beatAt, bpm, djBend, djCue, djEq, djFader, djFilter, djLoad, djLoop, djPlay, djScrub, djSetCue, djSync, djTempo, djXf, heard, onDJ, timeOfBeat } from '../audio/dj.js';
import { tracks } from '../audio/player.js';
import { resize } from '../render/gl.js';
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { toast } from './toast.js';
import { $ } from '../util.js';
import { el, knob, slider } from './widgets.js';
import { buildGroove, drawGroove, grooveState } from './groove.js';

const root = $('#dj'), btn = $('#djBtn'), COL = ['#5ad1ff', '#ff7ab8'], LOOPS = [1, 2, 4, 8, 16];
const mmss = t => { t = Math.max(0, t); return `${Math.floor(t/60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };

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
  // scrubbing: the overview dragged moves through the whole track, the close waveform dragged moves it under the playhead;
  // the deck is quiet while it's dragged and plays on from there when let go
  const over = q('.over'), zoom = q('.zoom');
  const drag = (c, at) => {
    let x0 = 0, o0 = 0;
    c.addEventListener('pointerdown', e => { if (!d.buf) return; c.setPointerCapture(e.pointerId); x0 = e.clientX; o0 = d.off; djScrub(i, 'start'); o0 = d.off; djScrub(i, 'move', at(e, x0, o0)); });
    c.addEventListener('pointermove', e => { if (c.hasPointerCapture(e.pointerId)) djScrub(i, 'move', at(e, x0, o0)); });
    const end = e => { if (c.hasPointerCapture(e.pointerId)) { c.releasePointerCapture(e.pointerId); djScrub(i, 'end'); } };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  };
  drag(over, e => { const r = over.getBoundingClientRect(); return (e.clientX - r.left)/r.width*d.buf.duration; });
  drag(zoom, (e, x0, o0) => o0 - (e.clientX - x0)/zoom.getBoundingClientRect().width*T.zoomSecs);
  return {d, box, q, tempo, zoom, over, ov: null};
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
// the head: the sections' switches, and the sync strip (the beat, the bar, the tempo, and what's locked to what)
const head = el('div', 'djh', `<b>DJ</b><span class="tabs"><button class="tab" data-t="decks">Decks</button><button class="tab" data-t="groove">Groovebox</button></span>
  <span class="sync" aria-live="off"><span class="lamps">${'<i></i>'.repeat(4)}</span><span class="sbar">—</span><span class="sbpm">— BPM</span><span class="sgb"></span></span>
  <button class="djx" aria-label="Collapse the DJ panel">▾ Hide</button>`);
const body = el('div', 'djb'); body.append(UI[0].box, mix, UI[1].box);
const gbx = el('div', 'gbx');
root.append(head, body, gbx); buildGroove(gbx);
// the sections: the decks and mixer, and the groovebox (a drum machine and an acid bass), each on or off, one above the other
let show = {decks: true, groove: true};
try { Object.assign(show, JSON.parse(localStorage.getItem('afterglow.djShow') || '{}')); } catch (e) {}
head.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  show[t.dataset.t] = !show[t.dataset.t];
  try { localStorage.setItem('afterglow.djShow', JSON.stringify(show)); } catch (e) {}
  if (DJ.open) setOpen(true);
}));
head.querySelector('.djx').addEventListener('click', () => setOpen(false));
root.addEventListener('keydown', e => e.stopPropagation());   // (keys on a knob or slider don't reach the page's own)

/* ---------- open and collapse ---------- */
export function setOpen(on){
  DJ.open = on; root.hidden = !on; btn.setAttribute('aria-pressed', on);
  body.hidden = !show.decks; gbx.hidden = !show.groove; body.style.flex = `1 1 ${T.decksH}px`; gbx.style.flex = `1 1 ${T.grooveH}px`;
  head.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-pressed', !!show[t.dataset.t]));
  const want = T.headH + (show.decks ? T.decksH : 0) + (show.groove ? T.grooveH : 0);
  S.djH = on ? Math.round(Math.min(want, innerHeight*T.maxShare)) : 0;
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
const at = d => d.buf ? heard(d) : d.off;   // as heard (smooth: audio/dj.js)
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
  drawGroove(); syncStrip();
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
// the sync strip: the beat (lamp 1 is the bar's 1), the bar, the tempo, from the lead deck while one plays (or else the
// groovebox's own clock), and the groovebox: locked to which deck, or on its own, and its step
let gBar = 0, gLast = -1;
function syncStrip(){
  const L = DJ.lead && DJ.lead.playing && DJ.lead.ana && DJ.lead.ana.map ? DJ.lead : null, g = grooveState(), q = c => head.querySelector(c);
  let beat = -1, bar = '', tempo = '';
  if (L) { const k = beatAt(L, heard(L)) - L.ana.map.down; beat = Math.floor(((k % 4) + 4) % 4); bar = `Bar ${Math.floor(k/4) + 1} · ${beat + 1}`; tempo = `${bpm(L).toFixed(1)} BPM · deck ${'AB'[L.i]}`; }
  else if (g.step >= 0) { if (g.step < gLast) gBar++; gLast = g.step; beat = g.step >> 2; bar = `Bar ${gBar + 1} · ${beat + 1}`; tempo = `${g.bpm.toFixed(1)} BPM · groovebox`; }
  q('.lamps').querySelectorAll('i').forEach((e, k) => { e.classList.toggle('on', k === beat); e.classList.toggle('one', k === 0); });
  q('.sbar').textContent = bar || '—'; q('.sbpm').textContent = tempo || '— BPM';
  q('.sgb').textContent = !g.playing ? 'Groovebox stopped' : `Groovebox ${g.locked !== null ? 'locked to deck ' + 'AB'[g.locked] : 'on its own tempo'} · ${g.step >= 0 ? `step ${g.step + 1}/16` : 'starting'}`;
  q('.sgb').classList.toggle('lock', !!g.playing && g.locked !== null);
}

