// The jam's core: an improvising instrument with no screen of its own, so any face (a grid of pads, strips, one part
// big) can sit on it and they all behave the same. Six lanes (jam/song.js), each a loop that keeps every idea it's had:
// New makes one, Vary a variation, Rec plays one in, Clear starts it empty; each is a new take, so nothing is ever lost
// (Undo is the take before). Changes land on the next bar, mutes at once or on the bar, so nothing can fall out of time.
// Recording overdubs into the loop as it goes round, on the 16ths, the 8ths, the beat or as played (quantise), and a
// lane with nothing in it gets a new loop the moment you play into it. The song underneath is the Studio's own format,
// so a jam opens in the Studio as it is.
import { makePlayer, prepare } from '../engine.js';
import { readClip, forget } from '../song.js';
import { makeDrums, makeBass, makeChords, makeHook, vary as varyClip, grooveOf } from '../improv.js';
import { instrument } from '../../audio/engine/registry.js';
import { PARTS, VOICES, part, jamSong } from './song.js';
import { macrosOf, at as macroAt, back } from './macros.js';

const BARS = {drums: 2, hats: 2, perc: 2, bass: 4, chords: 4, hook: 2};
const hasHits = c => c && Object.values(c.hits || {}).some(r => /[^.\-\s|]/.test(typeof r === 'string' ? r : r.p));
const empty = c => !c || (!hasHits(c) && !(c.notes || []).length);

// getCtx: () → the page's AudioContext (made and resumed on a touch); song: a jam song to carry on with
export function makeJam({getCtx, song = null, onNote = null} = {}){
  song = song || jamSong();
  const J = song.jam = {style: 'minimal', energy: .5, expr: .6, q: 1, launch: 'bar', recBars: 2, click: false, seed: 1, lanes: {}, ...(song.jam || {})};
  for (const p of PARTS) J.lanes[p.key] = {takes: [], take: null, mute: false, ...(J.lanes[p.key] || {})};
  const L = k => J.lanes[k], T = k => song.tracks.find(t => t.id === k), clipOf = k => L(k).take ? T(k).clips[L(k).take] : null;
  const subs = new Set(), emit = what => { for (const f of subs) f(what); };
  let pl = null, building = null, ctx = null;
  const rec = {on: false, pass: {}, held: new Map()};

  /* ---------- sound ---------- */
  // the player, built once the page has its audio (prepare loads the worklets)
  function ready(){
    if (pl) return Promise.resolve(pl);
    return building = building || (async () => { ctx = getCtx(); await prepare(ctx); pl = makePlayer(ctx, song, {onNote, meters: false}); building = null; return pl; })();   // (no meters: the jam shows none, and an analyser a strip is work the audio thread needn't do)
  }
  const playing = () => !!(pl && pl.playing);
  const clipsNow = () => Object.fromEntries(PARTS.filter(p => L(p.key).take && !L(p.key).mute).map(p => [p.key, [L(p.key).take, null]]));
  async function start(){ await ready(); pl.play({clips: clipsNow()}); emit('transport'); }
  function stop(){ if (pl) pl.stop(); rec.on = false; emit('transport'); }
  const toggle = () => playing() ? stop() : start();
  // the song changed in a way the graph can't follow (a preset, a kit, the tempo): built again, playing on from the bar
  async function rebuild(){
    if (!pl) return; const was = playing(), bar = was ? Math.ceil(pl.pos()/16) : 0; pl.dispose(); pl = null; await ready();
    if (was) pl.play({bar, clips: clipsNow()}); emit('transport');
  }
  // what a lane plays from here: its take, or nothing (on the bar, or at once for a mute when launch is 'now')
  function launch(k, now = J.launch === 'now'){ if (!playing()) return; pl.launchClip(k, L(k).mute ? null : L(k).take, null, {now}); }

  // the click: a blip on each beat (higher on the 1) while J.click is on, scheduled ahead like the notes
  let clicked = {t0: null, b: -1};
  function blip(t, one){ const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = one ? 1760 : 1320; g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.25, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .05); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .06); }
  setInterval(() => { if (!J.click || !playing()) return; const E = pl.E, B = 4*E.S16; if (clicked.t0 !== E.t0) clicked = {t0: E.t0, b: -1};
    for (let b = Math.max(clicked.b + 1, Math.ceil((ctx.currentTime - E.t0)/B)); E.t0 + b*B < ctx.currentTime + .2; b++) { blip(E.t0 + b*B, b % 4 === 0); clicked.b = b; } }, 25);

  /* ---------- takes ---------- */
  function addTake(k, clip, {go = true} = {}){
    const t = T(k), n = Math.max(0, ...Object.keys(t.clips).map(x => +x.slice(1) || 0)) + 1, id = 't' + n;
    t.clips[id] = clip; L(k).takes.push(id); if (go) { L(k).take = id; launch(k); }
    sceneNow(); emit('takes'); return id;
  }
  function pick(k, id){ if (!T(k).clips[id] || L(k).take === id) return; L(k).take = id; launch(k); sceneNow(); emit('takes'); }
  // back to the take before this one, or on to the next (history in the order they were made)
  function step(k, d){ const l = L(k), i = l.takes.indexOf(l.take), j = Math.max(0, Math.min(l.takes.length - 1, i + d)); if (j !== i) pick(k, l.takes[j]); }
  function mute(k, on = !L(k).mute){ L(k).mute = on; launch(k); sceneNow(); emit('mute'); }
  // only this lane (and its tap again: everything back)
  function solo(k){ const others = PARTS.filter(p => p.key !== k), all = others.every(p => L(p.key).mute) && !L(k).mute;
    for (const p of others) { L(p.key).mute = !all; launch(p.key); } if (!all) { L(k).mute = false; launch(k); } sceneNow(); emit('mute'); }
  // the jam's scene: what plays now, so the song opened in the Studio starts as you left it
  function sceneNow(){ song.scenes[0].clips = Object.fromEntries(PARTS.filter(p => L(p.key).take && !L(p.key).mute).map(p => [p.key, L(p.key).take])); }

  /* ---------- ideas ---------- */
  const opts = () => ({style: J.style, energy: J.energy, expr: J.expr, key: song.key, seed: J.seed++});
  const notesOf = k => (clipOf(k) || {}).notes || null;
  const only = (hits, keys) => Object.fromEntries(Object.entries(hits).filter(([k]) => keys.includes(k)));
  // a new idea for a lane, from what the others play: the bass round the kick, the chords round the bass
  function make(k, o = opts()){
    const g = part(k).gen;
    if (g === 'drums') { const c = makeDrums({...o, part: 'drums', bars: BARS.drums}); return {bars: c.bars, hits: only(c.hits, VOICES.drums)}; }
    if (g === 'hats') { const c = makeDrums({...o, part: 'hats', bars: BARS.hats}); return {bars: c.bars, hits: only(c.hits, VOICES.hats)}; }
    if (g === 'perc') { const kick = ((clipOf('drums') || {}).hits || {}).kick, c = makeDrums({...o, part: 'perc', bars: BARS.perc, base: kick ? {kick} : null}); return {bars: c.bars, hits: only(c.hits, VOICES.perc)}; }
    if (g === 'bass') return makeBass({...o, bars: BARS.bass, groove: clipOf('drums') ? grooveOf(clipOf('drums')) : null});
    if (g === 'chords') return makeChords({...o, bars: BARS.chords, bass: notesOf('bass')});
    return makeHook({...o, bars: BARS.hook});
  }
  const fresh = k => addTake(k, make(k));
  function vary(k){ const c = clipOf(k); if (empty(c)) return fresh(k); return addTake(k, varyClip(c, {seed: J.seed++, amount: .35 + .4*J.energy, key: song.key})); }
  // a whole groove at once: every lane a new idea (the drums first, so the rest fit round them)
  function all(){ for (const p of PARTS) addTake(p.key, make(p.key)); }
  function clear(k){ const c = clipOf(k), len = c ? readClip(c).len : J.recBars*16; addTake(k, part(k).kind === 'drums' ? {steps: len, hits: {}} : {steps: len, notes: []}); }
  // the loop twice as long (the same notes twice), for a variation in its second half; or half as long
  function length(k, f){
    const c = clipOf(k); if (!c) return; const n = readClip(c).len, to = Math.max(1, Math.round(n*f)), x = JSON.parse(JSON.stringify(c)); delete x.bars; x.steps = to;
    if (x.notes) x.notes = f > 1 ? [...x.notes, ...x.notes.map(e => [e[0] + n, ...e.slice(1)])] : x.notes.filter(e => e[0] < to);
    if (x.hits) for (const v of Object.keys(x.hits)) { const s = rowStr(x.hits[v]); if (s.length >= n) x.hits[v] = f > 1 ? s.padEnd(n, '.').repeat(Math.round(f)) : s.slice(0, to); }
    addTake(k, x);
  }
  // a take snapped to the grid (q sixteenths), as a new take
  function quantise(k, q = J.q || 1){ const c = clipOf(k); if (!c || !c.notes) return; const len = readClip(c).len, x = JSON.parse(JSON.stringify(c));
    x.notes = x.notes.map(e => [((Math.round(e[0]/q)*q) % len + len) % len, ...e.slice(1)]); addTake(k, x); }

  /* ---------- playing and recording ---------- */
  const live = k => pl && pl.E.tracks.find(x => x.t.id === k);
  const rowStr = r => (typeof r === 'string' ? r : r ? r.p : '').replace(/[\s|]/g, '');
  // the moment as heard (the speakers are behind the clock), in the loop's sixteenths
  const heard = () => ctx.currentTime - (ctx.outputLatency || 0);
  function where(k, t){
    const E = pl.E, x = (t - E.t0)/E.S16; let run = E.clipRun(k, Math.floor(x));
    // (nothing playing in the lane: a new empty loop from this bar, so the first note played starts it)
    if (!run || L(k).mute || run.id !== L(k).take) {
      if (!L(k).take || empty(clipOf(k))) { const len = J.recBars*16; L(k).mute = false; const id = addTake(k, part(k).kind === 'drums' ? {steps: len, hits: {}} : {steps: len, notes: []}, {go: false});
        L(k).take = id; rec.pass[k] = id; E.over[k] = {clip: id, at: Math.floor(x/16)*16}; sceneNow(); emit('takes'); run = {id, at: E.over[k].at}; }
      else { L(k).mute = false; E.over[k] = {clip: L(k).take, at: Math.floor(x/16)*16}; sceneNow(); emit('mute'); run = {id: L(k).take, at: E.over[k].at}; }
    }
    const len = readClip(clipOf(k)).len, q = J.q, pos = x - run.at;
    const s = q ? Math.round(pos/q)*q : Math.round(pos*100)/100, abs = run.at + (q ? Math.round(pos/q)*q : Math.floor(pos));
    return {s: ((s % len) + len) % len, len, abs};
  }
  // the first thing recorded in a pass makes a new take (a copy of the loop), so Undo takes the whole pass back
  function passTake(k){
    if (rec.pass[k] === L(k).take) return clipOf(k);
    const id = addTake(k, JSON.parse(JSON.stringify(clipOf(k))), {go: false}); pl.swapClip(k, id); L(k).take = id; rec.pass[k] = id; sceneNow(); emit('takes');
    return clipOf(k);
  }
  // (a hit or note recorded just ahead of the scheduler would play again a moment later: that one sixteenth is skipped)
  const skip = (k, abs, n) => { if (abs >= pl.E.n) (pl.E.skip = pl.E.skip || new Set()).add(`${k}|${abs}|${n}`); };
  // a drum: heard now, and written into its row (on the grid: drums are always on the 16ths at least)
  async function hit(k, voice, vel = .85){
    await ready(); const tr = live(k); if (!tr) return; tr.inst.play(voice, ctx.currentTime, .2, vel);
    emit({hit: k, voice});
    if (!rec.on || !playing()) return;
    const w = where(k, heard()), c = passTake(k), s = Math.round(w.s) % w.len;
    c.hits = c.hits || {}; const row = rowStr(c.hits[voice]) || '.'.repeat(w.len), arr = [...row.padEnd(Math.min(row.length, w.len) || w.len, '.')];
    arr[s % arr.length] = String(Math.max(1, Math.min(9, Math.round(vel*9)))); c.hits[voice] = arr.join('');
    skip(k, w.abs, voice); forget(c); emit('notes');
  }
  // a note held down: heard at once, written when it's let go (as long as it was held)
  async function noteOn(k, n, vel = .85, id = n){
    await ready(); const tr = live(k); if (!tr || !tr.inst.noteOn) return; tr.inst.noteOn(n, vel, ctx.currentTime);
    rec.held.set(k + ':' + id, {n, vel, t: heard(), w: rec.on && playing() ? where(k, heard()) : null}); emit({note: k, n, on: true});
  }
  function noteOff(k, id){
    const x = rec.held.get(k + ':' + id); if (!x) return; rec.held.delete(k + ':' + id);
    const tr = live(k); if (tr && tr.inst.noteOff) tr.inst.noteOff(x.n, ctx.currentTime); emit({note: k, n: x.n, on: false});
    if (!x.w || !rec.on || !playing()) return;
    const c = passTake(k), S16 = pl.E.S16, held = (heard() - x.t)/S16, q = J.q, l = q ? Math.max(q/2, Math.round(held*2)/2) : Math.max(.25, Math.round(held*100)/100);
    c.notes = [...(c.notes || []), [x.w.s, x.n, Math.min(l, x.w.len), Math.round(x.vel*100)/100]].sort((a, b) => a[0] - b[0]);
    skip(k, x.w.abs, x.n); forget(c); emit('notes');
  }
  async function setRec(on = !rec.on){ rec.on = on; rec.pass = {}; if (on && !playing()) await start(); emit('rec'); }
  // a step in the loop by hand (the focus face's grid): a drum's hit on, then louder, then off
  function toggleStep(k, s, voice){
    if (!clipOf(k)) clear(k);
    const c = clipOf(k), len = readClip(c).len; c.hits = c.hits || {};
    const a = [...(rowStr(c.hits[voice]) || '.'.repeat(len))], i = s % a.length, v = a[i];
    a[i] = v === '.' || v === '-' ? '6' : /[1-7]/.test(v) || v === 'o' || v === '?' ? '9' : '.'; c.hits[voice] = a.join('');
    forget(c); emit('notes');
  }
  function toggleNote(k, s, pitch){
    if (!clipOf(k)) clear(k);
    const c = clipOf(k), i = (c.notes || []).findIndex(e => Math.floor(e[0]) === s && [].concat(e[1]).includes(pitch));
    if (i >= 0) c.notes.splice(i, 1); else c.notes = [...(c.notes || []), [s, pitch, 1, .8]].sort((a, b) => a[0] - b[0]);
    forget(c); emit('notes');
  }

  /* ---------- the sound: macros up front, everything behind More ---------- */
  const typeOf = k => T(k).inst.type;
  const macros = k => macrosOf(typeOf(k));
  // a setting's path in the engine: 'inst.cut' → 'bass.inst.cut'; 'pads.tone' → every voice the lane owns
  const paths = (k, p) => p.startsWith('pads.') ? (VOICES[k] || []).map(v => `${k}.inst.${v}.${p.slice(5)}`) : [`${k}.${p}`];
  function macro(k, i){ if (!pl) return .5; const m = macros(k)[i], tg = m.set[0], q = pl.E.target(paths(k, tg[0])[0]); const v = q && q.get(); return v == null ? .5 : back(tg, v); }
  function setMacro(k, i, x){ if (!pl) return; for (const tg of macros(k)[i].set) for (const p of paths(k, tg[0])) pl.E.set(p, macroAt(tg, x)); emit('sound'); }
  // the instrument's own settings, in its groups (for More), and setting one
  const groups = k => { const I = instrument(typeOf(k)); return I.key === 'drums' ? [] : (I.groups || I.params || []); };
  const get = (k, key) => { if (!pl) return null; const q = pl.E.target(`${k}.inst.${key}`); return q && q.get(); };
  const set = (k, key, v) => { if (pl) pl.E.set(`${k}.inst.${key}`, v); emit('sound'); };
  const presets = k => Object.keys(instrument(typeOf(k)).presets || {});
  const presetOf = k => typeOf(k) === 'drums' ? T(k).inst.kit : T(k).inst.preset;
  async function preset(k, name){ const t = T(k); if (typeOf(k) === 'drums') t.inst.kit = name; else { t.inst.preset = name; t.inst.p = {}; } await rebuild(); emit('sound'); }
  // a lane's volume (dB)
  const vol = k => (T(k).mix || {}).vol || 0;
  const setVol = (k, v) => { if (pl) pl.E.set(`${k}.vol`, v); else (T(k).mix = T(k).mix || {}).vol = v; emit('sound'); };

  /* ---------- the jam's settings ---------- */
  async function setTempo(bpm){ song.bpm = Math.max(60, Math.min(200, Math.round(bpm))); await rebuild(); emit('settings'); }
  function setKey(key){ song.key = key; emit('settings'); }
  function setSwing(x){ song.swing = x; emit('settings'); }
  function setting(k, v){ J[k] = v; emit('settings'); }

  // where each lane's loop is: the sixteenth being heard in it, and its length
  function lanePos(k){ if (!playing()) return null; const n = pl.pos(), run = pl.E.clipRun(k, Math.floor(n)); if (!run || !clipOf(k)) return null;
    const len = readClip(T(k).clips[run.id]).len; return {s: ((Math.floor(n - run.at) % len) + len) % len, len, id: run.id}; }

  return {song, J, PARTS, ready, start, stop, toggle, playing, rebuild, pos: () => pl ? pl.pos() : -1, lanePos,
    lane: L, clip: clipOf, empty: k => empty(clipOf(k)), takes: k => L(k).takes, pick, step, mute, solo, fresh, vary, all, clear, length, quantise,
    hit, noteOn, noteOff, rec, setRec, toggleStep, toggleNote,
    macros, macro, setMacro, groups, get, set, presets, presetOf, preset, vol, setVol,
    setTempo, setKey, setSwing, setting, on: f => (subs.add(f), () => subs.delete(f)), get player(){ return pl; }, get ctx(){ return ctx; }};
}
