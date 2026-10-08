// The groovebox: a drum machine (the kit: audio/engine/inst/drums.js) and a 303-style acid bass on a 16-step sequencer, into the DJ mix; at its own tempo, or locked to the lead deck.
import { djBus, heardNow } from './dj.js';
import { INT, internal, master, next16, setTempo, startAt } from './engine/clock.js';
import { channel } from './engine/mixer.js';
import { note } from './engine/events.js';
import { actx, ensureAudio } from './player.js';
import { KITS, VOICES as KV, kitParams, makeDrums } from './engine/inst/drums.js';
import { TUNE } from '../tuning.js';

export const VOICES = KV.map(v => [v.key, v.label]);   // the kit's voices, a row each
// the bass's notes: A minor pentatonic over an octave and a half up from A1 (hard to play a wrong one), highest first on screen
export const NOTES = [['D3', 50], ['C3', 48], ['A2', 45], ['G2', 43], ['E2', 40], ['D2', 38], ['C2', 36], ['A1', 33]];
const off = () => Array(16).fill(0), rest = () => Array.from({length: 16}, () => ({on: 0, n: 7, a: 0, s: 0}));
const on = (str, a = 1) => [...str].map(c => c === 'x' ? a : c === 'X' ? 2 : 0);   // 'x' a hit, 'X' accented, '.' none
const line = (notes, acc = '', sl = '') => [...notes].map((c, i) => c === '.' ? {on: 0, n: 7, a: 0, s: 0} : {on: 1, n: +c, a: acc[i] === 'x' ? 1 : 0, s: sl[i] === 'x' ? 1 : 0});
// starter patterns, minimal techno and around it: each a kit, a drum grid (voices left out are silent) and a bass line
// (the bass's digits index NOTES: 7 is A1, 2 is A2)
export const PRESETS = {
  'Four to the floor': {kit: '909', kick: on('x...x...x...x...'), clap: on('....x.......x...'), chh: on('..x...x...x...x.'),
    bass: line('..7...7...7..67.')},
  'Minimal': {kit: 'Minimal', kick: on('X...x...X...x...'), rim: on('...x..x...x..x..'), chh: on('xxXxxxXxxxXxxxXx'), clap: on('............x...'), ohh: on('..x.......x.....'),
    clave: on('.......x.....x..'), shaker: on('.x.x.x.x.x.x.x.x'), bass: line('7..7..6.7..7.5..', 'x.....x.......x.')},
  'Rolling acid': {kit: '909', kick: on('x...x...x...x...'), chh: on('..x...x...x...x.'), ohh: on('..x...x...x...x.'), clap: on('....x.......x...'),
    ride: on('x.x.x.x.x.x.x.x.'), bass: line('7727572767273727', 'x...x..x...x..x.', '..x....x....x...')},
  '808 bounce': {kit: '808', kick: on('X......x..x.....'), clap: on('....x.......x...'), chh: on('xx.xxx.xxx.xxx.x'), ohh: on('..x.......x.....'), cow: on('...x......x...x.'),
    clave: on('x..x..x...x..x..'), tomL: on('.............x..'), tomH: on('..............x.'), bass: line('7......7..5.....', 'x.........x.....')},
  'Industrial': {kit: 'Industrial', kick: on('X..xX...X..xX.x.'), snare: on('....x.......x..x'), rim: on('..x...x...x...x.'), chh: on('xxxxxxxxxxxxxxxx'), crash: on('x...............'),
    tomL: on('...........x..x.'), bass: line('7.7.7.7.6.6.5.5.', 'x...x...x...x...')},
  'Breakdown': {kit: 'Lo-fi', snare: on('............xxxx'), chh: on('x.x.x.x.x.x.x.x.'), ohh: on('......x.......x.'), rim: on('x......x..x.....'), shaker: on('..x...x...x...x.'),
    crash: on('x...............'), bass: line('2.......5.......', 'x.......')},
};
const dflt = () => ({sync: true, kit: '909', vp: {}, bpm: 128, swing: 0, level: .8, drums: .9, synth: .6, cut: .3, res: .55, env: .55, decay: .3, wave: 'sawtooth', oct: 0,
  mute: {}, preset: 'Rolling acid', ...JSON.parse(JSON.stringify(PRESETS['Rolling acid']))});
let saved = null; try { saved = JSON.parse(localStorage.getItem('afterglow.groove') || 'null'); } catch (e) {}
// the groovebox's state: playing, locked to the lead deck (sync), its own tempo, swing, the levels, the bass's sound,
// muted voices, and the pattern (a drum grid per voice: 0 off, 1 on, 2 accented; the bass: a note, accent and slide a step)
export const GB = {playing: false, step: -1, ...dflt(), ...(saved || {})};
for (const [v] of VOICES) if (!Array.isArray(GB[v])) GB[v] = off();   // (voices added since a pattern was saved: silent)
let saveT = 0;
export const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { const {playing, step, ...s} = GB; localStorage.setItem('afterglow.groove', JSON.stringify(s)); } catch (e) {} }, 300); };
export function loadPreset(name){ const p = PRESETS[name]; if (!p) return;
  for (const [v] of VOICES) GB[v] = off(); Object.assign(GB, JSON.parse(JSON.stringify(p)), {preset: name}); if (p.kit) setKit(p.kit); save(); }
export function clearPattern(){ for (const [v] of VOICES) GB[v] = off(); GB.bass = rest(); GB.preset = ''; save(); }

/* ---------- the sound ---------- */
let bus = null, dBus = null, sBus = null, kit = null, osc = null, filt = null, vca = null;
function chain(){
  if (bus) return;
  bus = actx.createGain(); dBus = actx.createGain(); sBus = actx.createGain();
  dBus.connect(bus); sBus.connect(bus); bus.connect(channel('groove', 'Groovebox').input); levels();
  kit = makeDrums(actx, dBus); kit.load(GB.kit, GB.vp);
}
export function levels(){ if (!bus) return; bus.gain.value = GB.level*GB.level; dBus.gain.value = GB.drums; sBus.gain.value = GB.synth*.5; }
// the kit (its voices' settings start from the kit's), and one voice's setting changed by hand (kept over the kit's)
export function setKit(name){ if (!KITS[name]) return; GB.kit = name; GB.vp = {}; if (kit) kit.load(name); save(); }
export function setVoice(key, k, v){ (GB.vp[key] = GB.vp[key] || {})[k] = v; if (kit) kit.set(key, k, v); save(); }
export const voiceParams = key => kit ? kit.P[key] : {...kitParams(GB.kit)[key], ...(GB.vp[key] || {})};
// a voice heard now (the panel's audition, when a voice is picked)
export function audition(key){ ensureAudio(); chain(); if (actx.state === 'suspended') actx.resume(); kit.play(key, actx.currentTime + .01, .9); }

// the bass: one oscillator held through a resonant low-pass and a gate, as a 303 is; each note opens the filter and lets
// it fall back (an accent opens it further, and louder), and a slide glides into the next note without a new attack
function voice(){
  if (osc) return;
  osc = actx.createOscillator(); filt = actx.createBiquadFilter(); vca = actx.createGain();
  osc.type = GB.wave; filt.type = 'lowpass'; vca.gain.value = 0;
  osc.connect(filt); filt.connect(vca); vca.connect(sBus); osc.start();
}
const hz = m => 440*Math.pow(2, (m - 69)/12), cutHz = c => 60*Math.pow(8000/60, c);
function bass(i, t, dur){
  const st = GB.bass[i], prev = GB.bass[(i + 15) % 16], next = GB.bass[(i + 1) % 16];
  if (!st || !st.on) return;
  voice(); osc.type = GB.wave;
  const f = hz(NOTES[st.n][1] + 12*GB.oct), glide = prev.on && prev.s;
  if (glide) osc.frequency.setTargetAtTime(f, t, .035); else osc.frequency.setValueAtTime(f, t);
  const peak = (st.a ? 1 : .7);
  if (!glide) { vca.gain.cancelScheduledValues(t); vca.gain.setValueAtTime(0, t); vca.gain.linearRampToValueAtTime(peak, t + .004); }
  else vca.gain.setTargetAtTime(peak, t, .01);
  if (!(st.s && next.on)) vca.gain.setTargetAtTime(0, t + dur*.75, .012);   // (held into the next note on a slide)
  const base = cutHz(GB.cut), top = Math.min(12000, base + GB.env*6000*(st.a ? 1.5 : 1));
  filt.Q.setValueAtTime(GB.res*18, t); filt.frequency.setValueAtTime(top, t); filt.frequency.setTargetAtTime(base, t + .004, .02 + GB.decay*.5*(st.a ? .6 : 1));
}

/* ---------- the clock ---------- */
// a step is scheduled a little ahead on the audio clock (so a frame that stalls can't knock it out of time); locked to the
// master (audio/engine/clock.js: the lead deck, or the taps) it lands on its 16ths and bars, otherwise on the internal clock
// at its own tempo (the taps' clock too: one clock, so taps set its tempo and where its bar starts)
let timer = null, nextT = 0, nextI = 0, lastT = -1, wasL = false;
export const LOG = [];   // the steps scheduled lately: {t, i} (for the playhead, and tests)
// locked to the master while Sync is on and there is one
export const locked = () => GB.sync ? master() : null;
export const tempo = () => { const m = locked(); return m ? m.bpm() : INT.tapped ? 60/INT.P : GB.bpm; };
// its own tempo (the panel's slider): the internal clock's, kept in phase
// (in phase at the next step not yet scheduled, so nothing already scheduled is played twice)
export function setBpm(v){ GB.bpm = v; if (INT.tapped && actx) setTempo(v, GB.playing ? Math.max(nextT, actx.currentTime) : actx.currentTime); save(); }
function play(i, t, dur){
  const sw = i % 2 ? GB.swing*dur*.5 : 0, at = t + sw;   // (swing: the off 16ths a little late)
  for (const V of KV) { const v = V.key, h = GB[v][i]; if (h && !GB.mute[v]) { const vel = h === 2 ? 1 : .72; kit.play(v, at, vel); note({t: at, src: 'groove', ch: v, note: V.note, vel, len: dur}); } }
  const st = GB.bass[i];
  if (!GB.mute.bass) { bass(i, at, dur); if (st && st.on) note({t: at, src: 'groove', ch: 'bass', note: NOTES[st.n][1] + 12*GB.oct, vel: st.a ? 1 : .7, len: dur*(st.s ? 1 : .75)}); }
  LOG.push({t: at, i}); if (LOG.length > 64) LOG.shift();
}
function tick(){
  const now = actx.currentTime, L = locked();
  if (!L && !INT.tapped) {
    // on its own with no taps: the internal clock at the groovebox's tempo, its bar carrying on from the step it's on
    // (starting, after a gap, or when the master it was locked to stops: no burst to catch up, no jump)
    // (and when its tempo changes, from the next step not yet scheduled)
    if (nextT < now || wasL || Math.abs(60/INT.P - GB.bpm) > 1e-6) { INT.P = 60/GB.bpm; startAt((nextT < now ? now + .02 : nextT) - nextI*INT.P/4); }
  }
  wasL = !!L;
  let {t, i, dur} = next16(L || internal, now);
  for (; t < now + TUNE.groove.ahead; t += dur, i = (i + 1) % 16) if (t > lastT + dur*.5) { play(i, t, dur); lastT = t; nextT = t + dur; nextI = (i + 1) % 16; }
}
export function grooveToggle(){
  if (GB.playing) { clearInterval(timer); timer = null; GB.playing = false; if (vca) vca.gain.setTargetAtTime(0, actx.currentTime, .01); return false; }
  djBus(); chain(); if (actx.state === 'suspended') actx.resume();
  nextT = 0; nextI = 0; lastT = -1; LOG.length = 0; GB.playing = true;
  tick(); timer = setInterval(tick, TUNE.groove.tickMs); return true;
}
// the step being heard now (for the playhead), or -1
export function heardStep(){
  if (!GB.playing || !actx) return -1;
  const at = heardNow(); let i = -1;
  for (const s of LOG) if (s.t <= at) i = s.i;
  return i;
}
