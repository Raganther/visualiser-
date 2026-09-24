// Keyboard, gamepad, buttons, drag and drop, Journey on/off, and hiding idle controls.
import { S } from '../state.js';
import { actx, addFiles, nextTrack, playing, prevTrack, togglePlay } from '../audio/player.js';
import { J, jState } from '../journey/core.js';
import { freshJourney } from '../journey/director.js';
import { SPEC, curP } from '../presets.js';
import { syncSliders } from './panel.js';
import { nextPreset, randomize, setPreset } from './presets.js';
import { toast } from './toast.js';
import { $, clone } from '../util.js';

/* ---------- controller + keyboard ---------- */
export const live = {rot:0, zoom:0, warp:0, cx:0, cy:0};
export let prevBtn = [], keyHold = false, padHold = false, padBlocked = false;
export function pollPad(){
  let tr = 0, tz = 0, tw = 0, tx = 0, ty = 0; padHold = false;
  let pads = [];
  try { pads = navigator.getGamepads ? navigator.getGamepads() || [] : []; } catch(e) { padBlocked = true; }
  const gp = [...pads].find(p => p && p.connected);
  if (gp) {
    const dz = v => Math.abs(v || 0) < .15 ? 0 : v;
    const bv = i => gp.buttons[i] ? gp.buttons[i].value : 0;
    const pressed = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const edge = i => pressed(i) && !prevBtn[i];
    tr = dz(gp.axes[0]) * .04; tw = Math.abs(dz(gp.axes[1])) * 1.5;
    tx = dz(gp.axes[2]) * .35; ty = -dz(gp.axes[3]) * .35;
    tz = (bv(7) - bv(6)) * .05;
    if (edge(0)) nextPreset(1);
    if (edge(1)) randomize();
    padHold = pressed(2);
    if (edge(3)) toggleAuto();
    if (edge(4)) prevTrack();
    if (edge(5)) nextTrack();
    if (edge(9)) togglePlay();
    if (edge(14)) nextPreset(-1);
    if (edge(15)) nextPreset(1);
    prevBtn = gp.buttons.map(b => b.pressed);
  }
  live.rot += (tr - live.rot)*.15; live.zoom += (tz - live.zoom)*.15; live.warp += (tw - live.warp)*.1;
  live.cx += (tx - live.cx)*.08; live.cy += (ty - live.cy)*.08;
}
addEventListener('gamepadconnected', () => toast('Controller connected'));
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
  wake();
  switch (e.key.toLowerCase()) {
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'arrowright': nextPreset(1); break;
    case 'arrowleft': nextPreset(-1); break;
    case 'r': randomize(); break;
    case 'a': toggleAuto(); break;
    case 'n': nextTrack(); break;
    case 'x': keyHold = true; break;
    case 'h': document.body.classList.toggle('clean'); break;
    case 'f': fullscreen(); break;
  }
});
addEventListener('keyup', e => { if (e.key.toLowerCase() === 'x') keyHold = false; });
export function setJourney(on, snapshot){
  J.on = on;
  $('#autoBtn').setAttribute('aria-pressed', on);
  $('#randBtn').textContent = on ? 'Nudge' : 'Randomize';
  $('#sliders').classList.toggle('locked', on); $('#jNote').hidden = !on;
  if (on) { SPEC.forEach(s => jState[s.k] = curP[s.k]); J.goal = {}; J.held = {}; J.cutSince = 0; if (snapshot === 'fresh') freshJourney(); S.active = jState; $('#pName').textContent = 'Journey'; toast('Journey'); syncSliders(); }
  else if (snapshot) { const snap = clone(jState); snap.name = 'Snapshot'; setPreset(snap); }
}
function toggleAuto(){ setJourney(!J.on, true); }
$('#autoBtn').onclick = toggleAuto;
$('#adjBtn').onclick = () => { const o = $('#panel').classList.toggle('open'); $('#adjBtn').setAttribute('aria-pressed', o); };
function fullscreen(){
  const d = document;
  if (d.fullscreenElement) d.exitFullscreen();
  else {
    const el = d.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen;
    const fallback = () => { document.body.classList.add('clean'); toast('Press H to show controls'); };
    try { const r = fn ? fn.call(el) : null; if (r && r.catch) r.catch(fallback); else if (!fn) fallback(); } catch(e) { fallback(); }
  }
}
$('#fsBtn').onclick = fullscreen;
['#pickBtn','#addBtn'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); $('#fileIn').click(); } }));
$('#fileIn').onchange = e => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ''; };
addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dragging');
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
// hide controls when idle
let idleT;
function wake(){
  document.body.classList.remove('idle'); clearTimeout(idleT);
  idleT = setTimeout(() => { if (playing && !$('#panel').classList.contains('open')) document.body.classList.add('idle'); }, 3000);
}
['mousemove','pointerdown','touchstart'].forEach(ev => addEventListener(ev, () => { wake(); if (actx && actx.state==='suspended') actx.resume(); }, {passive:true}));
wake();
