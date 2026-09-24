// Audio playback: loading tracks, play, pause, seek and the playlist.
import { S } from '../state.js';
import { gridReset } from './beatgrid.js';
import { J } from '../journey/core.js';
import { freshJourney } from '../journey/director.js';
import { toast } from '../ui/toast.js';
import { updatePlayUI, updateTrackUI } from '../ui/transport.js';
import { $ } from '../util.js';

/* ---------- audio ---------- */
export let actx = null, analyser = null, source = null, buffer = null;
export let playing = false, startedAt = 0, tracks = [], tIndex = -1, loadToken = 0;
function ensureAudio(){
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .2;
    analyser.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
}
function stopSource(){ if (source) { source.onended = null; try { source.stop(); } catch(e){} source.disconnect(); source = null; } }
export function playFrom(offset){
  if (!buffer) return;
  gridReset(true);
  ensureAudio(); stopSource();
  const s = actx.createBufferSource(); s.buffer = buffer; s.connect(analyser);
  s.onended = () => { if (source === s) { source = null; playing = false; nextTrack(true); } };
  s.start(0, Math.max(0, Math.min(offset, buffer.duration - .01)));
  source = s; startedAt = actx.currentTime - offset; playing = true; updatePlayUI();
}
function pause(){ if (!playing) return; gridReset(true); S.pausedAt = actx.currentTime - startedAt; stopSource(); playing = false; updatePlayUI(); }
export function togglePlay(){
  if (!buffer) { $('#fileIn').click(); return; }
  playing ? pause() : playFrom(S.pausedAt);
}
export function position(){ return buffer ? (playing ? actx.currentTime - startedAt : S.pausedAt) : 0; }
async function loadTrack(i){
  if (i < 0 || i >= tracks.length) return;
  ensureAudio(); const token = ++loadToken; tIndex = i;
  stopSource(); playing = false;
  $('#track').innerHTML = 'Loading…';
  try {
    const ab = await tracks[i].file.arrayBuffer();
    const buf = await actx.decodeAudioData(ab);
    if (token !== loadToken) return;
    buffer = buf; S.pausedAt = 0; gridReset(false); if (J.on) freshJourney(); playFrom(0);
  } catch(e) {
    if (token !== loadToken) return;
    toast('Could not read that file'); tracks.splice(i,1);
    if (tracks.length) loadTrack(Math.min(i, tracks.length-1)); else { buffer = null; updatePlayUI(); }
    return;
  }
  updateTrackUI();
}
export function nextTrack(fromEnd){
  if (tIndex < tracks.length - 1) loadTrack(tIndex + 1);
  else if (fromEnd) { S.pausedAt = 0; updatePlayUI(); }
  else if (tracks.length) loadTrack(0);
}
export function prevTrack(){
  if (position() > 3 || tIndex <= 0) { playing ? playFrom(0) : (S.pausedAt = 0); }
  else loadTrack(tIndex - 1);
}
export function addFiles(list){
  const files = [...list].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(f.name));
  if (!files.length) { toast('Those files aren’t audio'); return; }
  const first = tracks.length;
  files.forEach(f => tracks.push({file:f, name:f.name.replace(/\.[^.]+$/, '')}));
  $('#welcome').classList.add('gone');
  if (!buffer || !playing) loadTrack(first); else updateTrackUI();
}
