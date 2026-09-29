// Each layer's own speed, size and sound: set by hand (the panel's row under a layer's slider, or the keys) and kept on the
// preset (S.active.tw[key] = {speed, size, src}). Journey never writes them, so they carry through it. A leaf module.
import { S } from '../state.js';
import { sig } from './signals.js';

// what a layer can follow instead of its own part of the music
export const TW_SRC = [['auto', 'its own sound'], ['bass', 'bass'], ['mid', 'mids'], ['treb', 'treble'], ['kick', 'every kick'],
  ['stab', 'stabs'], ['level', 'loudness'], ['hat', 'the hi-hats'], ['full', 'fullness'], ['fresh', 'something new'], ['none', 'nothing']];
export const TW_SPEED = [.25, 3], TW_SIZE = [.4, 2.5];
// this frame, for each tweaked layer: its clock (seconds of motion time ahead of everyone's), size, and the level it follows
// in place of bass, mids and treble (null: its own)
export const TW = {};
const off = {};
export const twOf = k => (S.active && S.active.tw && S.active.tw[k]) || null;
export const speedOf = k => { const t = twOf(k); return t && t.speed != null ? t.speed : 1; };
// which knobs a layer has: a layer with no clock of its own (the ring, the scope, the burst) has no speed
export const knobs = v => v.tweaks || ['speed', 'size', 'src'];
export function setTweak(k, field, val){
  const a = S.active; if (!a) return;
  const t = (a.tw || (a.tw = {}))[k] || (a.tw[k] = {});
  t[field] = val;
  if ((t.speed ?? 1) === 1 && (t.size ?? 1) === 1 && (t.src || 'auto') === 'auto') delete a.tw[k];   // back to how it was made
}
export function stepTweaks(mdt, react){
  for (const k in TW) delete TW[k];
  const all = (S.active && S.active.tw) || {};
  for (const k in all) {
    const t = all[k]; off[k] = (off[k] || 0) + mdt*((t.speed ?? 1) - 1);
    TW[k] = {off: off[k], size: t.size ?? 1, band: !t.src || t.src === 'auto' ? null : t.src === 'none' ? 0 : Math.min(1.5, sig(t.src, react))};
  }
}
