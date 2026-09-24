// The transport bar: time, seek, play and track name.
import { S } from '../state.js';
import { buffer, nextTrack, playFrom, playing, position, prevTrack, tIndex, togglePlay, tracks } from '../audio/player.js';
import { nextPreset, randomize } from './presets.js';
import { $, fmt } from '../util.js';

let seeking = false;
export function updateTimeUI(){
  const d = buffer ? buffer.duration : 0, p = Math.min(position(), d);
  $('#tNow').textContent = fmt(p); $('#tDur').textContent = fmt(d);
  if (!seeking) $('#seek').value = d ? p/d*1000 : 0;
}
export function updatePlayUI(){
  $('#playIcon').innerHTML = playing ? '<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>';
  $('#playBtn').setAttribute('aria-label', playing ? 'Pause' : 'Play');
}
export function updateTrackUI(){
  const t = tracks[tIndex]; if (!t) return;
  const el = $('#track'); el.textContent = t.name;
  if (tracks.length > 1) { const sm = document.createElement('small'); sm.textContent = `${tIndex+1} of ${tracks.length}`; el.appendChild(sm); }
}
$('#seek').addEventListener('input', () => { seeking = true; });
$('#seek').addEventListener('change', e => {
  seeking = false; if (!buffer) return;
  const off = e.target.value/1000 * buffer.duration;
  playing ? playFrom(off) : (S.pausedAt = off);
});
$('#playBtn').onclick = togglePlay;
$('#nextT').onclick = () => nextTrack();
$('#prevT').onclick = prevTrack;
$('#nextP').onclick = () => nextPreset(1);
$('#prevP').onclick = () => nextPreset(-1);
$('#randBtn').onclick = randomize;
