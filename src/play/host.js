// The play lab: toys for making music with the picture (src/play/toys/), each on a clear overlay over the visualiser, played with the mouse and the keys.
// Opt-in (the bar's Play button): nothing changes until it's open. Every note lands on the master's 16ths and in a scale,
// plays the lab's own drum kit and synth (its own mixer channel) and goes on the note bus, so the visuals answer it.
import { actx, ensureAudio } from '../audio/player.js';
import { heardNow } from '../audio/dj.js';
import { addFollow, internal, master } from '../audio/engine/clock.js';
import { ENV, channel } from '../audio/engine/mixer.js';
import { note as busNote } from '../audio/engine/events.js';
import { makeDrums, VOICES as DRUMS } from '../audio/engine/inst/drums.js';
import { DEF, PRESETS, makePoly } from '../audio/engine/inst/poly.js';
import { viewH } from '../state.js';
import { $ } from '../util.js';
import { toast } from '../ui/toast.js';
import mandala from './toys/mandala.js';
import paint from './toys/paint.js';
import draw from './toys/draw.js';
import orbits from './toys/orbits.js';
import pads from './toys/pads.js';

export const TOYS = [mandala, paint, draw, orbits, pads];
export const SCALES = {'Minor pentatonic': [0, 3, 5, 7, 10], 'Minor': [0, 2, 3, 5, 7, 8, 10], 'Dorian': [0, 2, 3, 5, 7, 9, 10], 'Major pentatonic': [0, 2, 4, 7, 9]};
const ROOT = 45;   // A2: degree 0
export const PLAY = {on: false, toy: 0, scale: 'Minor pentatonic'};
try { Object.assign(PLAY, JSON.parse(localStorage.getItem('afterglow.play') || '{}'), {on: false}); } catch (e) {}
const keep = () => { try { const {on, ...s} = PLAY; localStorage.setItem('afterglow.play', JSON.stringify(s)); } catch (e) {} };
// while it's open, its clock leads the visuals (as the sequencer's does) when nothing else is the master
addFollow(() => PLAY.on ? internal : null);

let kit = null, poly = null, cv = null, g = null, bar = null, timer = 0, lastT = -1, raf = 0;
const clock = () => master() || internal;
const sparks = [];   // what to light, when it's heard: {x, y, t, col, r}
const DRUM_NOTE = Object.fromEntries(DRUMS.map(v => [v.key, v.note]));
// what a toy is given: sounds at audio-clock times, the scale, the clock, and sparks to light as they're heard
export const api = {
  hit(v, t, vel = .9){ if (!kit) return; kit.play(v, t, vel); busNote({t, src: 'play', ch: v, note: DRUM_NOTE[v] || 60, vel, len: .1}); },
  play(n, t, len, vel = .8){ if (!poly) return; poly.play(n, t, len, vel); busNote({t, src: 'play', ch: 'synth', note: n, vel, len}); },
  on(n, t, vel = .8){ if (!poly) return; poly.noteOn(n, vel, t); busNote({t, src: 'play', ch: 'synth', note: n, vel, len: 0}); },
  off(n, t){ if (poly) poly.noteOff(n, t); },
  set(k, v){ if (poly) poly.set(k, v); },
  // a degree of the scale as a MIDI note (0: A2, counting up through the scale and its octaves)
  deg(d, base = ROOT){ const S = SCALES[PLAY.scale] || SCALES['Minor pentatonic'], n = S.length, o = Math.floor(d/n); return base + 12*o + S[((d % n) + n) % n]; },
  scaleLen: () => (SCALES[PLAY.scale] || SCALES['Minor pentatonic']).length,
  // the next 16th from now ({t, s: its count from the clock's bar 1, dur}), and where the clock is at a time, in 16ths
  next16(){ const c = clock(), now = actx.currentTime, k = c.beat(now), P = c.period(now), s = Math.floor(k*4 + 1e-6) + 1; return {t: now + (s/4 - k)*P, s, dur: P/4}; },
  stepAt: t => clock().beat(t)*4,
  heard: () => heardNow(),
  dur: () => clock().period(actx.currentTime)/4,
  now: () => actx.currentTime,
  spark(x, y, t, col = '#fff', r = 1){ sparks.push({x, y, t, col, r}); if (sparks.length > 300) sparks.shift(); },
  W: () => cv.width/devicePixelRatio, H: () => cv.height/devicePixelRatio,
  hint(s){ const h = bar && bar.querySelector('.plhow'); if (h) h.textContent = s; },
};
const toy = () => TOYS[PLAY.toy] || TOYS[0];

// the sounds, made on first use: a 909 kit and a synth on the lab's own mixer channel
function sounds(){
  if (kit) return; ensureAudio();
  const out = channel('play', 'Play lab').input;
  kit = makeDrums(actx, out); kit.load('909');
  poly = makePoly(actx, out, ENV);
}
function loadPreset(){ const p = PRESETS[toy().preset] || {}; poly.load({...DEF, ...p, chord: 0, mode: 0, ...(toy().synth || {})}); }

/* ---------- the clock: each 16th, a little ahead, handed to the toy ---------- */
function tick(){
  const c = clock(), now = actx.currentTime, T = toy();
  let {t, s, dur} = api.next16();
  for (; t < now + .1; t += dur, s++) if (t > lastT + dur*.5) { lastT = t; if (T.step) T.step({t, s, dur}); }
}

/* ---------- open and close; switching toys ---------- */
export function setPlay(on){
  if (on === PLAY.on) return;
  PLAY.on = on; $('#playLabBtn').setAttribute('aria-pressed', on); document.body.classList.toggle('playlab', on);
  if (on) {
    sounds(); if (actx.state === 'suspended') actx.resume();
    $('#welcome').classList.add('gone');
    build(); cv.hidden = bar.hidden = false; start(PLAY.toy);
    lastT = -1; timer = setInterval(tick, 25); raf = requestAnimationFrame(frame);
  } else {
    clearInterval(timer); cancelAnimationFrame(raf); const T = toy(); if (T.stop) T.stop(); if (poly) poly.allOff();
    cv.hidden = bar.hidden = true;
  }
}
function start(i){
  const old = toy(); if (old.stop && PLAY.on) old.stop(); if (poly) poly.allOff();
  PLAY.toy = (i + TOYS.length) % TOYS.length; keep();
  const T = toy(); loadPreset(); if (!T.ready) { T.init(api); T.ready = true; } if (T.start) T.start();
  bar.querySelector('.plname').textContent = `${PLAY.toy + 1}. ${T.label}`; api.hint(T.how); rated();
}

/* ---------- the overlay and its bar ---------- */
function build(){
  if (cv) return;
  cv = document.createElement('canvas'); cv.id = 'playCv'; document.body.append(cv); g = cv.getContext('2d');
  bar = document.createElement('div'); bar.id = 'playBar';
  bar.innerHTML = `<div class="plrow"><button class="plprev" title="The toy before (←)">◂</button><b class="plname"></b><button class="plnext" title="The next toy (→)">▸</button>
    <select class="plscale" aria-label="Scale">${Object.keys(SCALES).map(k => `<option>${k}</option>`).join('')}</select>
    <button class="plup" title="I like this toy">👍</button><button class="pldown" title="Not for me">👎</button><button class="plnote" title="Say what works and what doesn't">💬</button>
    <button class="plcopy" title="Copy every rating and note, to paste to Claude">Copy notes</button><button class="plx" title="Close the play lab (Esc)">✕</button></div>
    <div class="plhow"></div>`;
  document.body.append(bar);
  const q = s => bar.querySelector(s);
  q('.plprev').onclick = () => start(PLAY.toy - 1); q('.plnext').onclick = () => start(PLAY.toy + 1); q('.plx').onclick = () => setPlay(false);
  q('.plscale').value = PLAY.scale; q('.plscale').onchange = e => { PLAY.scale = e.target.value; keep(); const T = toy(); if (T.rescale) T.rescale(); };
  q('.plup').onclick = () => rate(1); q('.pldown').onclick = () => rate(-1);
  q('.plnote').onclick = () => { const t = prompt(`Your note on "${toy().label}": what feels good, what doesn't?`); if (t) { notes().push({toy: toy().key, note: t, at: Date.now()}); save(); toast('Note kept'); } };
  q('.plcopy').onclick = () => { const txt = notes().map(n => `${n.toy}: ${n.v ? (n.v > 0 ? '👍' : '👎') : ''} ${n.note || ''}`.trim()).join('\n') || '(no notes yet)';
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Notes copied: paste them to Claude'), () => prompt('Copy these notes:', txt)); };
  // the pointer: the toy gets positions in the overlay's own pixels
  const at = e => { const r = cv.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top, b: e.button, shift: e.shiftKey, alt: e.altKey, id: e.pointerId}; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); const T = toy(); if (T.down) T.down(at(e)); });
  cv.addEventListener('pointermove', e => { const T = toy(); if (T.move) T.move(at(e), cv.hasPointerCapture(e.pointerId)); });
  const up = e => { const T = toy(); if (T.up) T.up(at(e)); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const T = toy(); if (T.wheel) T.wheel({...at(e), d: Math.sign(e.deltaY)}); }, {passive: false});
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
// the ratings and notes, kept on the device
const notes = () => { try { return PLAY.notes || (PLAY.notes = JSON.parse(localStorage.getItem('afterglow.playnotes') || '[]')); } catch (e) { return PLAY.notes = []; } };
const save = () => { try { localStorage.setItem('afterglow.playnotes', JSON.stringify(notes())); } catch (e) {} };
function rate(v){ notes().push({toy: toy().key, v, at: Date.now()}); save(); rated(); toast(v > 0 ? 'Liked' : 'Noted: not for you'); }
function rated(){ const mine = notes().filter(n => n.toy === toy().key && n.v), last = mine[mine.length - 1];
  bar.querySelector('.plup').setAttribute('aria-pressed', !!last && last.v > 0); bar.querySelector('.pldown').setAttribute('aria-pressed', !!last && last.v < 0); }

/* ---------- drawing: the toy, then the sparks as they're heard ---------- */
function frame(){
  if (!PLAY.on) return; raf = requestAnimationFrame(frame);
  const dpr = devicePixelRatio || 1, W = innerWidth, H = viewH();
  if (cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)) { cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); cv.style.height = H + 'px'; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const h = heardNow(), T = toy();
  if (T.draw) T.draw(g, W, H, h);
  g.globalCompositeOperation = 'lighter';
  for (const s of sparks) { const a = h - s.t; if (a < 0 || a > .6) continue; const k = 1 - a/.6, r = (8 + 40*a)*s.r;
    const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r); gr.addColorStop(0, s.col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = k; g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

/* ---------- the keys: while it's open they're the lab's (← → switch toys, Esc closes, the toy gets the rest) ---------- */
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
addEventListener('keydown', e => {
  if (!PLAY.on || typing(e) || e.metaKey || e.ctrlKey) return;
  const T = toy();
  if (T.key && T.key(e, true)) {}
  else if (e.key === 'Escape') setPlay(false);
  else if (e.key === 'ArrowLeft') start(PLAY.toy - 1);
  else if (e.key === 'ArrowRight') start(PLAY.toy + 1);
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
addEventListener('keyup', e => { if (!PLAY.on || typing(e)) return; const T = toy(); if (T.key) T.key(e, false); e.stopImmediatePropagation(); }, true);
$('#playLabBtn').addEventListener('click', () => setPlay(!PLAY.on));
