// The synth played live (audio/engine/inst/poly.js): keys down and up from the on-screen or computer keyboard, the arpeggiator (in time with the master) and latch, and its settings kept on the device.
import { actx, ensureAudio } from './player.js';
import { ENV, channel } from './engine/mixer.js';
import { note } from './engine/events.js';
import { internal, master } from './engine/clock.js';
import { DEF, PRESETS, makePoly } from './engine/inst/poly.js';
import { DIVS, beatsOf } from './engine/fx/kit.js';

export const ARP_MODES = ['Off', 'Up', 'Down', 'Up-down', 'Random', 'As played'];
export const ARP_DIVS = DIVS.slice(1, 8);   // 1/16 to 1/2
const dflt = () => ({preset: 'Supersaw lead', p: {...DEF, ...PRESETS['Supersaw lead']}, arp: 0, div: 0, aoct: 1, gate: .7, latch: false, oct: 0, keys: false});
let saved = null; try { saved = JSON.parse(localStorage.getItem('afterglow.synth') || 'null'); } catch (e) {}
// the synth's state: its preset and settings, the arpeggiator (mode, its step as one of ARP_DIVS, octaves, gate), latch,
// the keyboard's octave, and whether the computer's keys play it
export const SY = {...dflt(), ...(saved || {})};
SY.p = {...DEF, ...SY.p};
let saveT = 0;
export const saveSynth = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('afterglow.synth', JSON.stringify(SY)); } catch (e) {} }, 300); };
const subs = new Set();
export const onKeys = fn => subs.add(fn);
const changed = () => subs.forEach(fn => fn());

let poly = null, timer = 0;
export const held = [];   // keys held (or latched), in the order pressed
// the synth, made on first use, on its own mixer channel
export function synth(){
  if (poly) return poly;
  ensureAudio(); poly = makePoly(actx, channel('synth', 'Synth').input, ENV); poly.load(SY.p);
  timer = setInterval(tick, 25);
  return poly;
}
export function loadSynthPreset(name){ const p = PRESETS[name]; if (!p) return; SY.preset = name; SY.p = {...DEF, ...p}; synth().load(SY.p); saveSynth(); changed(); }
export function setSynth(k, v){ SY.p[k] = v; SY.preset = ''; synth().set(k, v); saveSynth(); }

const on = new Map(), down = new Set();   // key → the note it sounds (as played: the octave it was in); the keys physically down
// a key down: it sounds now (or joins the arpeggio)
export function keyDown(k, vel = .85){
  const s = synth(); if (actx.state === 'suspended') actx.resume();
  if (SY.latch && !down.size && held.length) { held.length = 0; s.allOff(); on.clear(); }   // (latch: a new chord, after letting go, replaces the held one)
  if (!held.includes(k)) held.push(k); down.add(k);
  if (!SY.arp) { const n = k + 12*SY.oct, t = actx.currentTime; on.set(k, n); s.noteOn(n, vel, t); note({t, src: 'synth', ch: 'poly', note: n, vel, len: 0}); }
  changed();
}
export function keyUp(k){
  down.delete(k);
  if (!SY.latch) { const i = held.indexOf(k); if (i >= 0) held.splice(i, 1); if (!SY.arp && on.has(k)) { synth().noteOff(on.get(k)); on.delete(k); } }
  changed();
}
export function setLatch(v){ SY.latch = v; if (!v) { for (const k of [...held]) if (!down.has(k)) { held.splice(held.indexOf(k), 1); if (on.has(k)) { synth().noteOff(on.get(k)); on.delete(k); } } } saveSynth(); changed(); }
export function setArp(k, v){ SY[k] = v; if (k === 'arp' && poly) { poly.allOff(); on.clear(); } saveSynth(); changed(); }

// the arpeggio's notes: the keys held, spread over its octaves, in its order (up, down, up and down, random, as played)
function sequence(){
  const base = SY.arp === 5 ? [...held] : [...held].sort((a, b) => a - b), seq = [];
  for (let o = 0; o < SY.aoct; o++) for (const k of base) seq.push(k + 12*(o + SY.oct));
  if (SY.arp === 2) seq.reverse();
  if (SY.arp === 3 && seq.length > 2) seq.push(...seq.slice(1, -1).reverse());
  return seq;
}
let lastJ = -1;
// the arpeggiator: a step every ARP_DIVS[div] of the master's beat, scheduled a little ahead on the audio clock
function tick(){
  const t0 = actx.currentTime; poly.tick(t0);
  if (!SY.arp || !held.length) { lastJ = -1; return; }
  const c = master() || internal, L = beatsOf(DIVS.indexOf(ARP_DIVS[SY.div] || ARP_DIVS[0])), k = c.beat(t0), P = c.period(t0), seq = sequence();
  for (let j = Math.floor(k/L) + 1; ; j++) {
    const t = t0 + (j*L - k)*P; if (t > t0 + .12) break; if (j <= lastJ) continue; lastJ = j;
    const n = SY.arp === 4 ? seq[Math.floor(Math.random()*seq.length)] : seq[((j % seq.length) + seq.length) % seq.length], len = L*P*SY.gate;
    poly.play(n, t, len, .8); note({t, src: 'synth', ch: 'poly', note: n, vel: .8, len});
  }
}
