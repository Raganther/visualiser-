// The groovebox: a 909-style drum machine and a 303-style acid bass on a 16-step sequencer, into the DJ mix; at its own tempo, or locked to the lead deck.
import { djBus, djMaster, heardNow, masterBeat, masterBpm, masterPeriod } from './dj.js';
import { actx } from './player.js';
import { TUNE } from '../tuning.js';

export const VOICES = [['kick', 'Kick'], ['clap', 'Clap'], ['snare', 'Snare'], ['chh', 'Closed hat'], ['ohh', 'Open hat'], ['rim', 'Rim']];
// the bass's notes: A minor pentatonic over an octave and a half up from A1 (hard to play a wrong one), highest first on screen
export const NOTES = [['D3', 50], ['C3', 48], ['A2', 45], ['G2', 43], ['E2', 40], ['D2', 38], ['C2', 36], ['A1', 33]];
const off = () => Array(16).fill(0), rest = () => Array.from({length: 16}, () => ({on: 0, n: 7, a: 0, s: 0}));
const on = (str, a = 1) => [...str].map(c => c === 'x' ? a : c === 'X' ? 2 : 0);   // 'x' a hit, 'X' accented, '.' none
const line = (notes, acc = '', sl = '') => [...notes].map((c, i) => c === '.' ? {on: 0, n: 7, a: 0, s: 0} : {on: 1, n: +c, a: acc[i] === 'x' ? 1 : 0, s: sl[i] === 'x' ? 1 : 0});
// starter patterns, minimal techno: each a drum grid and a bass line (the bass's digits index NOTES: 7 is A1, 2 is A2)
export const PRESETS = {
  'Four to the floor': {kick: on('x...x...x...x...'), clap: on('....x.......x...'), chh: on('..x...x...x...x.'), ohh: off(), snare: off(), rim: off(),
    bass: line('..7...7...7..67.')},
  'Minimal': {kick: on('X...x...X...x...'), rim: on('...x..x...x..x..'), chh: on('xxXxxxXxxxXxxxXx'), clap: on('............x...'), ohh: on('..x.......x.....'), snare: off(),
    bass: line('7..7..6.7..7.5..', 'x.....x.......x.')},
  'Rolling acid': {kick: on('x...x...x...x...'), chh: on('..x...x...x...x.'), ohh: on('..x...x...x...x.'), clap: on('....x.......x...'), snare: off(), rim: off(),
    bass: line('7727572767273727', 'x...x..x...x..x.', '..x....x....x...')},
  'Breakdown': {kick: off(), clap: off(), snare: on('............xxxx'), chh: on('x.x.x.x.x.x.x.x.'), ohh: on('......x.......x.'), rim: on('x......x..x.....'),
    bass: line('2.......5.......', 'x.......')},
};
const dflt = () => ({sync: true, bpm: 128, swing: 0, level: .8, drums: .9, synth: .6, cut: .3, res: .55, env: .55, decay: .3, wave: 'sawtooth', oct: 0,
  mute: {}, preset: 'Rolling acid', ...JSON.parse(JSON.stringify(PRESETS['Rolling acid']))});
let saved = null; try { saved = JSON.parse(localStorage.getItem('afterglow.groove') || 'null'); } catch (e) {}
// the groovebox's state: playing, locked to the lead deck (sync), its own tempo, swing, the levels, the bass's sound,
// muted voices, and the pattern (a drum grid per voice: 0 off, 1 on, 2 accented; the bass: a note, accent and slide a step)
export const GB = {playing: false, step: -1, ...dflt(), ...(saved || {})};
let saveT = 0;
export const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { const {playing, step, ...s} = GB; localStorage.setItem('afterglow.groove', JSON.stringify(s)); } catch (e) {} }, 300); };
export function loadPreset(name){ const p = PRESETS[name]; if (!p) return; Object.assign(GB, JSON.parse(JSON.stringify(p)), {preset: name}); save(); }
export function clearPattern(){ for (const [v] of VOICES) GB[v] = off(); GB.bass = rest(); GB.preset = ''; save(); }

/* ---------- the sound ---------- */
let bus = null, dBus = null, sBus = null, noise = null, osc = null, filt = null, vca = null, ohhG = null;
function chain(){
  if (bus) return;
  bus = actx.createGain(); dBus = actx.createGain(); sBus = actx.createGain();
  dBus.connect(bus); sBus.connect(bus); bus.connect(djBus()); levels();
  noise = actx.createBuffer(1, actx.sampleRate, actx.sampleRate); const n = noise.getChannelData(0); for (let i = 0; i < n.length; i++) n[i] = Math.random()*2 - 1;
}
export function levels(){ if (!bus) return; bus.gain.value = GB.level*GB.level; dBus.gain.value = GB.drums; sBus.gain.value = GB.synth*.5; }
const env = (t, peak, dec, g = actx.createGain()) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .002); g.gain.exponentialRampToValueAtTime(.0005, t + dec); return g; };
function noiseHit(t, dec, type, f, q, peak, out = dBus){
  const s = actx.createBufferSource(), b = actx.createBiquadFilter(), g = env(t, peak, dec);
  s.buffer = noise; b.type = type; b.frequency.value = f; if (q) b.Q.value = q;
  s.connect(b); b.connect(g); g.connect(out); s.start(t, Math.random()*.5); s.stop(t + dec + .05); return g;
}
// the drums, made the way a 909 makes them: a falling sine for the kick, filtered noise for the rest
const DRUM = {
  kick(t, v){ const o = actx.createOscillator(), g = env(t, v, .45); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(48, t + .09);
    o.connect(g); g.connect(dBus); o.start(t); o.stop(t + .5); noiseHit(t, .012, 'highpass', 3000, 0, v*.25); },
  clap(t, v){ for (const d of [0, .011, .023]) noiseHit(t + d, .02, 'bandpass', 1200, 1.4, v*.7); noiseHit(t + .03, .18, 'bandpass', 1200, 1.2, v*.5); },
  snare(t, v){ const o = actx.createOscillator(), g = env(t, v*.5, .1); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.connect(g); g.connect(dBus); o.start(t); o.stop(t + .15);
    noiseHit(t, .18, 'highpass', 1500, 0, v*.55); },
  chh(t, v){ if (ohhG) { ohhG.gain.cancelScheduledValues(t); ohhG.gain.setTargetAtTime(0, t, .005); ohhG = null; } noiseHit(t, .045, 'highpass', 7500, 0, v*.45); },   // (a closed hat chokes an open one)
  ohh(t, v){ ohhG = noiseHit(t, .32, 'highpass', 7000, 0, v*.35); },
  rim(t, v){ const o = actx.createOscillator(), g = env(t, v*.5, .035); o.frequency.setValueAtTime(1700, t); o.connect(g); g.connect(dBus); o.start(t); o.stop(t + .06); noiseHit(t, .012, 'bandpass', 2500, 2, v*.3); },
};
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
// lead deck it lands on that deck's own 16ths and bars (from its beat map), otherwise at its own tempo
let timer = null, nextT = 0, nextI = 0, lastT = -1;
export const LOG = [];   // the steps scheduled lately: {t, i} (for the playhead, and tests)
// locked to the master (audio/dj.js: the lead deck, or the taps) while Sync is on and there is one
export const locked = () => GB.sync ? djMaster() : null;
export const tempo = () => { const m = locked(); return m ? masterBpm(m) : GB.bpm; };
function fromLead(m, now){
  const k = masterBeat(m, now), P = masterPeriod(m, now), s = Math.floor(k*4 + 1e-6) + 1;   // the next 16th, counted from the master's bar's 1
  return {t: now + (s/4 - k)*P, i: ((s % 16) + 16) % 16, dur: P/4};
}
function play(i, t, dur){
  const sw = i % 2 ? GB.swing*dur*.5 : 0, at = t + sw;   // (swing: the off 16ths a little late)
  for (const [v] of VOICES) { const h = GB[v][i]; if (h && !GB.mute[v]) DRUM[v](at, h === 2 ? 1 : .72); }
  if (!GB.mute.bass) bass(i, at, dur);
  LOG.push({t: at, i}); if (LOG.length > 64) LOG.shift();
}
function tick(){
  const now = actx.currentTime, L = locked();
  if (L) {
    let {t, i, dur} = fromLead(L, now);
    for (; t < now + TUNE.groove.ahead; t += dur, i = (i + 1) % 16) if (t > lastT + dur*.5) { play(i, t, dur); lastT = t; nextT = t + dur; nextI = (i + 1) % 16; }
    return;
  }
  const dur = 60/GB.bpm/4;
  if (nextT < now) nextT = now + .02;   // (starting, or after a gap: no burst to catch up)
  while (nextT < now + TUNE.groove.ahead) { play(nextI, nextT, dur); lastT = nextT; nextT += dur; nextI = (nextI + 1) % 16; }
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
