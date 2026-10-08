// The groovebox: the sequencer, playing the drum kit (audio/engine/inst/drums.js), a 303-style acid bass and the synth, in eight patterns and a song; at its own tempo, or locked to the master.
import { djBus, heardNow } from './dj.js';
import { INT, PLAN, addFollow, internal, leader, master, next16, setTempo, startAt } from './engine/clock.js';
import { F } from './foresee.js';
import { channel } from './engine/mixer.js';
import { note } from './engine/events.js';
import { actx, ensureAudio } from './player.js';
import { KITS, VOICES as KV, kitParams, makeDrums } from './engine/inst/drums.js';
import { onKey, synth } from './keys.js';
import { TUNE } from '../tuning.js';

export const VOICES = KV.map(v => [v.key, v.label]);   // the kit's voices, a row each
// the bass's notes: A minor pentatonic over an octave and a half up from A1 (hard to play a wrong one), highest first on screen
export const NOTES = [['D3', 50], ['C3', 48], ['A2', 45], ['G2', 43], ['E2', 40], ['D2', 38], ['C2', 36], ['A1', 33]];
export const MAX = 64;   // a track's steps at most (each its own length: polymeter)
const off = (n = MAX) => Array(n).fill(0), rest = (n = MAX) => Array.from({length: n}, () => ({on: 0, n: 7, a: 0, s: 0}));
// a pattern: a row of steps a drum voice (0 off, 1 on, 2 accented), the bass line, the synth's notes ({s: its step, n: the
// MIDI note, l: steps long, v: velocity}), each track's length (16 unless set), and each step's own settings (x, by
// 'track:step': vel, chance, a condition, ratchets, a nudge, and locks of the voice's tune, decay and character)
export const blank = () => ({...Object.fromEntries(KV.map(v => [v.key, off()])), bass: rest(), synth: [], len: {}, x: {}});
const pad = (a, f) => { const r = a.slice(0, MAX); while (r.length < MAX) r.push(f()); return r; };
const fit = p => { const q = {...blank(), ...p}; for (const v of KV) q[v.key] = pad(q[v.key] || [], () => 0); q.bass = pad(q.bass || [], () => ({on: 0, n: 7, a: 0, s: 0})); q.len = {...(p.len || {})}; q.x = {...(p.x || {})}; q.synth = [...(p.synth || [])]; return q; };
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
const dflt = () => ({sync: true, kit: '909', vp: {}, bassEng: 'acid', pat: 0, song: [], songOn: false, bpm: 128, swing: 0, level: .8, drums: .9, synth: .6, cut: .3, res: .55, env: .55, decay: .3, wave: 'sawtooth', oct: 0,
  mute: {}, solo: null, preset: 'Rolling acid', pats: [fit(JSON.parse(JSON.stringify(PRESETS['Rolling acid']))), ...Array.from({length: 7}, blank)]});
let saved = null; try { saved = JSON.parse(localStorage.getItem('afterglow.groove') || 'null'); } catch (e) {}
// the groovebox's state: playing, locked to the lead deck (sync), its own tempo, swing, the levels, the bass's sound,
// muted voices, and the pattern (a drum grid per voice: 0 off, 1 on, 2 accented; the bass: a note, accent and slide a step)
export const GB = {playing: false, step: -1, fill: false, rec: false, next: null, ...dflt(), ...(saved || {})};
// a groovebox saved before patterns: its one pattern becomes the first
if (saved && !saved.pats) GB.pats = [fit(Object.fromEntries([...KV.map(v => [v.key, saved[v.key] || []]), ['bass', saved.bass || []]])), ...Array.from({length: 7}, blank)];
GB.pats = Array.from({length: 8}, (_, i) => fit(GB.pats[i] || {}));
// the pattern being edited and played: its rows are GB[voice] and GB.bass (as before patterns, for the panel and tests)
export const pat = () => GB.pats[GB.pat];
export function bind(){ const p = pat(); for (const v of KV) GB[v.key] = p[v.key]; GB.bass = p.bass; }
bind();
export const lenOf = k => pat().len[k] || 16;
let saveT = 0;
export const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { const {playing, step, fill, rec, next, ...s} = GB; for (const v of KV) delete s[v.key]; delete s.bass;
  localStorage.setItem('afterglow.groove', JSON.stringify(s)); } catch (e) {} }, 300); };
// a starter loaded into the pattern being edited (and its kit)
export function loadPreset(name){ const p = PRESETS[name]; if (!p) return; const {kit: k, ...rows} = JSON.parse(JSON.stringify(p));
  GB.pats[GB.pat] = fit(rows); bind(); GB.preset = name; if (k) setKit(k); save(); }
export function clearPattern(){ GB.pats[GB.pat] = blank(); bind(); GB.preset = ''; save(); }
// patterns: pick one (now when stopped, at the next bar while playing), copy one into another; the song: a chain of them, a bar each
let clip = null;
export function pickPattern(i){ if (GB.playing) GB.next = i; else { GB.pat = i; bind(); } save(); plan(); }
export function copyPattern(){ clip = JSON.parse(JSON.stringify(pat())); }
export function pastePattern(){ if (!clip) return false; GB.pats[GB.pat] = fit(JSON.parse(JSON.stringify(clip))); bind(); save(); return true; }
export function setLen(k, n){ pat().len[k] = Math.max(1, Math.min(MAX, Math.round(n))); save(); }
// a euclidean rhythm: k hits spread as evenly as they go over the track's length, turned by `rot` steps
export function euclid(v, k, rot = 0){ const L = lenOf(v), row = GB[v]; for (let j = 0; j < L; j++) { const i = ((j - rot) % L + L) % L; row[j] = k > 0 && Math.floor(i*k/L) !== Math.floor((i - 1)*k/L) || (k > 0 && i === 0) ? 1 : 0; } save(); }
// a step's own settings (the step editor), and the synth's notes (the piano roll)
export const stepX = (k, j) => pat().x[k + ':' + j] || null;
export function setStepX(k, j, key, v){ const id = k + ':' + j, x = pat().x[id] = pat().x[id] || {}; if (v == null) delete x[key]; else x[key] = v; if (!Object.keys(x).length) delete pat().x[id]; save(); }
export function toggleNote(s, n, l = 1){ const N = pat().synth, i = N.findIndex(o => o.n === n && s >= o.s && s < o.s + o.l); if (i >= 0) N.splice(i, 1); else N.push({s, n, l, v: .8}); save(); }

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
function bass(i, t, dur, L = 16){
  const st = GB.bass[i], prev = GB.bass[(i + L - 1) % L], next = GB.bass[(i + 1) % L];
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
let timer = null, nextT = 0, nextS = 0, lastT = -1, wasL = false, first = true;
export const LOG = [];   // the steps scheduled lately: {t, i: the step in the bar, s: the clock's count, rel: from the pattern's start} (the playhead, recording, tests)
// locked to the master while Sync is on and there is one
export const locked = () => GB.sync ? master() : null;
export const tempo = () => { const m = locked(); return m ? m.bpm() : INT.tapped ? 60/INT.P : GB.bpm; };
// its own tempo (the panel's slider): the internal clock's, kept in phase
// (in phase at the next step not yet scheduled, so nothing already scheduled is played twice)
export function setBpm(v){ GB.bpm = v; if (INT.tapped && actx) setTempo(v, GB.playing ? Math.max(nextT, actx.currentTime) : actx.currentTime); save(); }
// a step's condition: always, a:b (the a-th time of every b the track goes round), on a fill or not, or the first time round
export const CONDS = ['Always', '1:2', '2:2', '1:3', '2:3', '3:3', '1:4', '2:4', '3:4', '4:4', 'Fill', 'Not fill', 'First'];
function passes(x, cycle){
  if (!x) return true;
  if (x.chance != null && Math.random() >= x.chance) return false;
  const c = x.cond; if (!c || c === 'Always') return true;
  if (c === 'Fill') return GB.fill; if (c === 'Not fill') return !GB.fill; if (c === 'First') return cycle === 0;
  const [a, b] = c.split(':').map(Number); return cycle % b === a - 1;
}
let kickAt = 0, start = 0;   // the kick on this step (its velocity); the step count the pattern started at (its tracks' times round count from there)
/* ---------- Journey following it ---------- */
// playing on its own, the sequencer leads the visuals (its clock gives the beat grid its beats), and what it knows is
// coming goes into PLAN: the song's pattern changes and drops (a kick back after brkBars without one) planBars ahead, and
// the live ones as they happen (a pattern picked, a mute, the kick coming back)
addFollow(() => GB.playing ? internal : null);
const live = {changes: [], drops: []};
let lastKickS = null;   // the step count of the last kick played
const leads = () => leader() === internal;
const tOf = s => INT.a + s/4*INT.P;   // a step count's time on the internal clock (as heard)
const kickIn = p => { const P = GB.pats[p], L = P.len.kick || 16; return !(GB.solo ? GB.solo !== 'kick' : GB.mute.kick) && P.kick.slice(0, L).some(Boolean); };
const firstKick = p => Math.max(0, GB.pats[p].kick.findIndex(Boolean));
// a change on the next bar line (a pattern picked, a mute): Journey starts a section there
function liveChange(){ if (!GB.playing || !leads()) return; const nb = Math.ceil(nextS/16)*16; live.changes.push({t: tOf(nb), nov: TUNE.groove.nov}); plan(); }
function plan(){
  if (!GB.playing || !leads()) return;
  const T = TUNE.groove, nb = Math.ceil(nextS/16)*16, now = actx.currentTime, changes = [], drops = [];
  for (const k of ['changes', 'drops']) live[k] = live[k].filter(e => e.t > now - 30);
  const seq = []; for (let k = 0; k < T.planBars; k++) seq.push(GB.songOn && GB.song.length ? GB.song[((GB.songPos ?? -1) + 1 + k) % GB.song.length] : GB.next ?? GB.pat);
  let prev = GB.pat, gone = lastKickS != null && nextS - lastKickS > 8 ? lastKickS : kickIn(GB.pat) ? null : nextS;
  seq.forEach((p, k) => { const s0 = nb + 16*k;
    if (p !== prev) changes.push({t: tOf(s0), nov: T.nov}); prev = p;
    if (kickIn(p)) { if (gone != null && s0 + firstKick(p) - gone >= T.brkBars*16) drops.push({t: tOf(s0 + firstKick(p)), brk: tOf(gone), seq: 1, plan: true}); gone = null; }
    else if (gone == null) gone = s0; });
  const merge = (a, b) => [...a, ...b.filter(x => !a.some(y => Math.abs(y.t - x.t) < .05))].sort((x, y) => x.t - y.t);
  PLAN.changes = merge(live.changes, changes); PLAN.drops = merge(live.drops, drops); PLAN.rev++;
}
export function setMute(v, on){ GB.mute[v] = on; save(); liveChange(); }
export function setSolo(v){ GB.solo = v; save(); liveChange(); }
// one 16th: every track at its own place (its step count modulo its length), each hit as its step says
function play(s, t, dur){
  const i = ((s % 16) + 16) % 16;
  if (i === 0) {   // the bar line: the next pattern, or the song's next
    const was = GB.pat;
    if (GB.songOn && GB.song.length) { GB.songPos = (GB.songPos == null ? 0 : GB.songPos + 1) % GB.song.length; const n = GB.song[GB.songPos]; if (n !== GB.pat) { GB.pat = n; bind(); start = s; } }
    else if (GB.next != null) { if (GB.next !== GB.pat) start = s; GB.pat = GB.next; GB.next = null; bind(); }
    if (GB.pat !== was && leads()) live.changes.push({t, nov: TUNE.groove.nov});   // (kept, so Journey still finds it once it's begun)
  }
  const P = pat(), rel = s - start, sw = i % 2 ? GB.swing*dur*.5 : 0; kickAt = 0;
  const heard = k => !(GB.solo ? GB.solo !== k : GB.mute[k]);
  for (const V of KV) {
    const v = V.key, L = P.len[v] || 16, j = ((rel % L) + L) % L, h = P[v][j];
    if (!h || !heard(v)) continue;
    const x = P.x[v + ':' + j], cyc = Math.floor(rel/L); if (!passes(x, cyc)) continue;
    const vel = x && x.vel != null ? x.vel : h === 2 ? 1 : .72, r = x && x.rat || 1, at = t + sw + (x && x.nudge || 0)*dur;
    const lock = x && (x.tune != null || x.decay != null || x.x != null) ? {...(x.tune != null && {tune: x.tune}), ...(x.decay != null && {decay: x.decay}), ...(x.x != null && {x: x.x})} : null;
    for (let k = 0; k < r; k++) { const tk = at + k*dur/r; kit.play(v, tk, vel*(k ? .8 : 1), lock); note({t: tk, src: 'groove', ch: v, note: V.note, vel, len: dur/r}); }
    if (v === 'kick') {   // the kick back after a breakdown: a drop, landing on it
      if (lastKickS != null && s - lastKickS >= TUNE.groove.brkBars*16 && leads()) live.drops.push({t: at, brk: tOf(lastKickS), seq: 1});
      lastKickS = s; if (i % 4 === 0) kickAt = Math.max(kickAt, vel); }
  }
  // the bass line, at its own length
  { const L = P.len.bass || 16, j = ((rel % L) + L) % L, st = P.bass[j], x = P.x['bass:' + j], at = t + sw + (x && x.nudge || 0)*dur;
    if (st && st.on && heard('bass') && passes(x, Math.floor(rel/L))) {
      const n = NOTES[st.n][1] + 12*GB.oct, vel = st.a ? 1 : .7;
      if (GB.bassEng === 'synth') { const nx = P.bass[(j + 1) % L], len = st.s && nx.on ? dur*1.15 : dur*.6; synth().play(n, at, len, vel); note({t: at, src: 'groove', ch: 'bass', note: n, vel, len}); }
      else { bass(j, at, dur, L); note({t: at, src: 'groove', ch: 'bass', note: n, vel, len: dur*(st.s ? 1 : .75)}); }
    } }
  // the synth's notes that start on this step of its track
  { const L = P.len.synth || 16, j = ((rel % L) + L) % L;
    if (P.synth.length && heard('synth')) for (const o of P.synth) if (o.s === j) { const x = P.x['synth:' + j]; if (!passes(x, Math.floor(rel/L))) continue;
      const at = t + sw + (x && x.nudge || 0)*dur, len = o.l*dur*.92; synth().play(o.n, at, len, o.v); note({t: at, src: 'groove', ch: 'synth', note: o.n, vel: o.v, len}); } }
  LOG.push({t: t + sw, i, s, rel, p: GB.pat}); if (LOG.length > 64) LOG.shift();
  // each beat's pulse as strong as the kick on it (soft where there's none: a breakdown), on the beat grid's map
  const M = F.map; if (i % 4 === 0 && M && M.src === 'internal' && leads()) { const j = Math.round((t - M.beats[0])/M.P); if (j >= 0 && j < M.kick.length) M.kick[j] = kickAt; }
}
function tick(){
  const now = actx.currentTime, L = locked();
  if (!L && !INT.tapped) {
    // on its own with no taps: the internal clock at the groovebox's tempo, its bar carrying on from the step it's on
    // (starting, after a gap, or when the master it was locked to stops: no burst to catch up, no jump)
    // (and when its tempo changes, from the next step not yet scheduled)
    if (nextT < now || wasL || Math.abs(60/INT.P - GB.bpm) > 1e-6) { INT.P = 60/GB.bpm; startAt((nextT < now ? now + .02 : nextT) - nextS*INT.P/4); }   // (the count carries on: each track keeps its place)
  }
  wasL = !!L;
  let {t, s, dur} = next16(L || internal, now);
  plan();
  for (; t < now + TUNE.groove.ahead; t += dur, s++) if (t > lastT + dur*.5) { if (first) { start = s - ((s % 16) + 16) % 16; GB.songPos = null; first = false; } play(s, t, dur); lastT = t; nextT = t + dur; nextS = s + 1; }
}
export function grooveToggle(){
  if (GB.playing) { clearInterval(timer); timer = null; GB.playing = false; if (vca) vca.gain.setTargetAtTime(0, actx.currentTime, .01); return false; }
  djBus(); chain(); if (actx.state === 'suspended') actx.resume();
  nextT = 0; nextS = 0; lastT = -1; LOG.length = 0; GB.playing = true; first = true; lastKickS = null; live.changes = []; live.drops = [];
  tick(); timer = setInterval(tick, TUNE.groove.tickMs); return true;
}
// the step being heard now (for the playhead), or -1; heardAt: its log entry (each track's place is rel modulo its length)
export function heardAt(){ if (!GB.playing || !actx) return null; const at = heardNow(); let e = null; for (const s of LOG) if (s.t <= at) e = s; return e; }
export function heardStep(){ const e = heardAt(); return e ? e.i : -1; }
// recording: a voice played (or a synth key) lands on the step nearest to when it was heard
export function nearest(){ if (!GB.playing || !actx) return null; const at = heardNow(); let e = null; for (const s of LOG) if (!e || Math.abs(s.t - at) < Math.abs(e.t - at)) e = s; return e; }
// a synth key recorded into the piano roll: its note on the step heard, as long as it was held (whole steps, at least one)
const recKeys = new Map();
onKey((k, down, n, vel = .8) => {
  if (down) { const e = GB.rec && nearest(); if (!e) return; const L = lenOf('synth'), j = ((e.rel % L) + L) % L, N = pat().synth;
    let o = N.find(o => o.n === n && o.s === j); if (!o) N.push(o = {s: j, n, l: 1, v: Math.round(vel*100)/100}); recKeys.set(k, {o, t: heardNow()}); save(); }
  else { const r = recKeys.get(k); if (!r) return; recKeys.delete(k); r.o.l = Math.max(1, Math.min(MAX, Math.round((heardNow() - r.t)/(15/tempo())))); save(); }
});
export function recHit(v){ const e = GB.rec && nearest(); if (!e) return false; const L = lenOf(v), j = ((e.rel % L) + L) % L; GB[v][j] = GB[v][j] || 1; save(); return true; }
