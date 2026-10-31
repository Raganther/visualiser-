// The mixer: channels (each deck, each instrument), each through its insert effects, then its pan, level and two sends;
// the sends' own buses (A an echo, B a space) returned into the mix; and the master, its inserts, a limiter and the analyser
// the visuals listen to (so they follow the effects too). Untouched, every strip passes its sound unchanged.
import { actx, analyser, ensureAudio } from '../player.js';
import { internal, master as clockMaster } from './clock.js';
import { onNote } from './events.js';
import { defaults, effect } from './registry.js';

export const STRIPS = new Map();     // key → strip: {key, label, kind ('ch', 'send', 'master'), input, pan, out, sends, ins, st}
export const CHANNELS = new Map();   // the channels alone (what plugs in: the decks, the groovebox, instruments)
export const OFF = -40;              // a level or send at this many dB is off
const gainOf = db => db <= OFF ? 0 : Math.pow(10, db/20);
// what an effect is given: the beat's length and the master clock now (for times in step with the music), and the note bus
const clock = () => clockMaster() || internal;
export const ENV = {period: () => clock().period(actx ? actx.currentTime : 0), clock, onNote};

// every strip's settings, kept on this device: level and pan, the sends, and the inserts in order, each on or off with its settings
const FRESH = {sendA: {ins: [{k: 'delay', on: 1}]}, sendB: {ins: [{k: 'reverb', on: 1}]}};
let SAVED = {}; try { SAVED = JSON.parse(localStorage.getItem('afterglow.mix') || '{}') || {}; } catch (e) {}
let saveT = 0;
export function save(){ clearTimeout(saveT); saveT = setTimeout(() => {
  const o = {}; for (const [k, s] of STRIPS) o[k] = {level: s.st.level, pan: s.st.pan, A: s.st.A, B: s.st.B, ins: s.ins.map(i => ({k: i.k, on: i.on, p: i.p}))};
  try { localStorage.setItem('afterglow.mix', JSON.stringify(o)); } catch (e) {} }, 300); }
const subs = new Set();
export const onMix = fn => subs.add(fn);
const changed = () => { subs.forEach(fn => fn()); save(); };

let lim = null, timer = 0;
// the master (made on first use) and the two send buses
export function mixMaster(){
  if (lim) return STRIPS.get('master').input;
  ensureAudio();
  lim = actx.createDynamicsCompressor();
  lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .003; lim.release.value = .1;
  lim.connect(analyser);
  make('master', 'Master', 'master', lim);
  const m = STRIPS.get('master').input;
  make('sendA', 'Send A', 'send', m); make('sendB', 'Send B', 'send', m);
  // effects that follow the tempo (a delay's time, an LFO's rate, a pump on the beat) look at the clock a few times a second
  timer = setInterval(() => { const now = actx.currentTime; for (const s of STRIPS.values()) for (const i of s.ins) if (i.fx.tick) i.fx.tick(now); }, 40);
  return m;
}
// a channel into the master: what plugs in connects to its input
export function channel(key, label = key){
  let c = CHANNELS.get(key);
  if (c) return c;
  const m = mixMaster(); c = make(key, label, 'ch', m);
  CHANNELS.set(key, c); changed();
  return c;
}
function make(key, label, kind, dest){
  const s = {key, label, kind, input: actx.createGain(), pan: actx.createStereoPanner(), out: actx.createGain(), sends: {}, ins: [],
    st: {level: 0, pan: 0, A: OFF, B: OFF, ...(SAVED[key] || {})}};
  s.pan.connect(s.out); s.out.connect(dest);
  if (kind === 'ch') for (const b of ['A', 'B']) { const g = s.sends[b] = actx.createGain(); s.out.connect(g); g.connect(STRIPS.get('send' + b).input); }
  STRIPS.set(key, s);
  for (const i of (SAVED[key] || FRESH[key] || {}).ins || []) if (effect(i.k)) addInsert(key, i.k, i, true);
  apply(s); wire(s);
  return s;
}
function apply(s){
  const t = actx.currentTime;
  s.out.gain.setTargetAtTime(gainOf(s.st.level), t, .015); s.pan.pan.setTargetAtTime(s.st.pan, t, .015);
  for (const b in s.sends) s.sends[b].gain.setTargetAtTime(gainOf(s.st[b]), t, .015);
}
// the input through each insert that's on, in order, to the pan
function wire(s){
  s.input.disconnect(); for (const i of s.ins) i.fx.output.disconnect();
  let n = s.input; for (const i of s.ins) if (i.on) { n.connect(i.fx.input); n = i.fx.output; }
  n.connect(s.pan);
}

/* ---------- changing it (the Effects panel, saved looks, tests) ---------- */
const S_ = key => STRIPS.get(key);
export function setStrip(key, field, v){ const s = S_(key); if (!s) return; s.st[field] = v; apply(s); changed(); }
// an insert: made, given its settings (saved ones, or the effect's defaults), and wired in at the end (or at `at`)
export function addInsert(key, fxKey, saved = {}, quiet = false, at = -1){
  const s = S_(key), E = effect(fxKey); if (!s || !E) return null;
  const fx = E.make(actx, ENV), p = {...defaults(E), ...(saved.p || {})}, ins = {k: fxKey, on: saved.on == null ? 1 : saved.on, p, fx};
  for (const k in p) fx.set(k, p[k]);
  if (at < 0) s.ins.push(ins); else s.ins.splice(at, 0, ins);
  if (!quiet) { wire(s); changed(); }
  return ins;
}
export function removeInsert(key, i){ const s = S_(key), x = s && s.ins[i]; if (!x) return; s.ins.splice(i, 1); wire(s); x.fx.output.disconnect(); if (x.fx.dispose) x.fx.dispose(); changed(); }
export function moveInsert(key, i, d){ const s = S_(key), j = i + d; if (!s || j < 0 || j >= s.ins.length) return; [s.ins[i], s.ins[j]] = [s.ins[j], s.ins[i]]; wire(s); changed(); }
export function toggleInsert(key, i){ const s = S_(key), x = s && s.ins[i]; if (!x) return; x.on = x.on ? 0 : 1; wire(s); changed(); }
export function setParam(key, i, k, v){ const x = S_(key) && S_(key).ins[i]; if (!x) return; x.p[k] = v; x.fx.set(k, v); save(); }
