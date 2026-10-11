// Where the tracks fight: each part of a song rendered alone through the master over a stretch where most of it plays, its
// bands' energy over time compared pair by pair (measure.js's masking). A drum rack's kick is its own stem and the rest of
// the rack another, so the kick against the bass shows up as itself.
import { renderSong } from './engine.js';
import { arrangement, scene } from './song.js';
import { bandEnv, loudness, masking } from './measure.js';

// the stems: {id, label, solo (strip ids to solo)}, only tracks with a clip in `sc` when it's given
export function stemList(song, sc = null){
  const out = [];
  for (const t of song.tracks) {
    if (sc && !(sc.clips || {})[t.id]) continue;
    const pads = Object.keys(t.pads || {});
    if (pads.includes('kick')) { out.push({id: t.id + ':kick', label: (t.pads.kick.name || 'Kick'), solo: [t.id + ':kick']});
      const rest = pads.filter(k => k !== 'kick'); if (rest.length) out.push({id: t.id, label: `${t.name || t.id} (no kick)`, solo: rest.map(k => t.id + ':' + k)}); }
    else out.push({id: t.id, label: t.name || t.id, solo: [t.id]});
  }
  return out;
}
// the part of the arrangement with the most tracks playing: where clashes matter (its first `bars` bars)
export function busiest(song, bars = 4){
  const A = arrangement(song); let best = A.parts[0], n = -1;
  for (const p of A.parts) { const s = scene(song, p.scene), k = Object.values((s || {}).clips || {}).filter(Boolean).length; if (k > n) { n = k; best = p; } }
  return best ? {from: best.at, bars: Math.min(bars, best.bars), scene: best.scene} : {from: 0, bars};
}
// render each stem over the stretch, and find the clashes. onProgress(share done, label)
export async function clashes(song, {from, bars, onProgress} = {}){
  const w = from == null ? busiest(song) : {from, bars: bars || 4, scene: null}, sc = w.scene ? scene(song, w.scene) : null, list = stemList(song, sc);
  const env = {}, stems = {};
  for (let i = 0; i < list.length; i++) {
    const s = list[i]; if (onProgress) onProgress(i/list.length, s.label);
    const b = await renderSong(song, {from: w.from, bars: w.bars, solo: s.solo, tail: .2}), L = b.getChannelData(0), R = b.getChannelData(1), M = new Float32Array(L.length);
    for (let k = 0; k < L.length; k++) M[k] = (L[k] + R[k])/2;
    env[s.id] = bandEnv(M, b.sampleRate); stems[s.id] = {label: s.label, lufs: loudness(L, R, b.sampleRate).I};
  }
  if (onProgress) onProgress(1, '');
  return {from: w.from, bars: w.bars, stems, list: masking(env)};
}
