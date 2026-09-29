// The keyboard: a letter picks a group, number keys work inside it, and a strip at the bottom shows the group's list with
// what's on. L layers, W worlds, E hits, O objects, K kaleidoscope (Shift+K the glow's own folds), S scene, C the cosmos's camera. Shift + a number solos
// that one thing, ↑ ↓ raise or lower the last one touched, 0 turns the group off, Esc leaves it (so does a few seconds
// idle). A change while Journey runs freezes it first (A hands it back). [ ] calmer or more intense, , . evolve slower or
// faster, ? every key at once. The rest (Space, ← →, R, A, N, X, H, F, P, + −) is in ui/controls.js and ui/taste.js.
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { SPEC, curP } from '../presets.js';
import { TUNE } from '../tuning.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { TEMPLATES } from '../scene/templates.js';
import { setJourney } from './controls.js';
import { solo } from './presets.js';
import { syncSliders } from './panel.js';
import { compose } from './scene.js';
import { FLY, flyKey } from './fly.js';
import { toast } from './toast.js';
import { tutorial } from './tutorial.js';
import { TW_SIZE, TW_SPEED, TW_SRC, knobs, setTweak, twOf } from '../scene/tweaks.js';
import { $ } from '../util.js';

const layers = LAYER_VISUALS.filter(v => !v.optIn), worlds = WORLD_VISUALS.filter(v => !v.optIn);
const SCENE_WORDS = {plain: 'plain', between: 'between', split: 'split', among: 'among', held: 'held', reflect: 'reflect', inside: 'inside', window: 'window', glass: 'glass'};
// the groups: their key, name, and what number n does (items: [label, isOn] for the strip)
const GROUPS = {
  l: {name: 'Layers', list: () => layers.map((v, i) => [v.label, on(v.key), i < 9 ? i + 1 : MORE[i - 9]]), pick: n => toggle(layers[n - 1], TUNE.keys.layer), all: layers},
  w: {name: 'Worlds', list: () => worlds.map(v => [v.label, on(v.key, .3)]), pick: n => one(worlds, worlds[n - 1], 1), all: worlds},
  e: {name: 'Hits', list: () => HIT_VISUALS.map(v => [v.label, on(v.key)]), pick: n => toggle(HIT_VISUALS[n - 1], (HIT_VISUALS[n - 1] || {}).level), all: HIT_VISUALS},
  o: {name: 'Objects', list: () => OBJECT_VISUALS.map(v => [v.label, on(v.key, .3)]), pick: n => one(OBJECT_VISUALS, OBJECT_VISUALS[n - 1], TUNE.mesh.level), all: OBJECT_VISUALS},
  // the kaleidoscope: a mirror fold of the picture (everything, the world, the glow, or inside the object), and its letters
  k: {name: 'Kaleidoscope: mirrors', list: () => [2, 3, 4, 5, 6, 7, 8, 9].map(n => [n + ' ways', Math.round(S.active.kal || 0) === n, n])
      .concat(KAL_WHERE.map(([key, label], i) => [label, (S.active.kal || 0) >= 2 && Math.round(S.active.kalWhere || 0) === i, key.toUpperCase()])),
    pick: n => { if (n === 1) return false; edit(); S.active.kal = n; last = 'kal'; return true; }, off: () => { S.active.kal = 0; }},
  // Shift+K: the glow's own folds, inside the trails (ghostly, lined), and mirrored trails
  kg: {name: 'Glow folds (the trails)', list: () => [2, 3, 4, 5, 6, 7, 8, 9].map(n => [n + ' ways', Math.round(S.active.sym || 1) === n, n]).concat([['mirror trails', (S.active.mirror || 0) > .5, 'M']]),
    pick: n => { if (n === 1) return false; edit(); S.active.sym = n; last = 'sym'; return true; }, off: () => { S.active.sym = 1; }},
  s: {name: 'Scene', list: () => TEMPLATES.map(t => [SCENE_WORDS[t.key] || t.key, J.on ? J.sceneKey === t.key && !!J.sceneLive : sceneIs(t.key)]),
    pick: n => { const t = TEMPLATES[n - 1]; if (!t) return false; edit(); compose(t.key); return true; }, off: () => { S.scene = null; if (S.active) delete S.active.scene; }},
  c: {name: 'Cosmos camera', list: () => FLY.map(([k, l]) => [l, false, k])},
};
const KAL_WHERE = [['e', 'everything'], ['b', 'the world'], ['g', 'the glow'], ['i', 'inside the object']];   // kalWhere 0-3
const MORE = ['Z', 'U', 'I', 'J', 'V', 'Y', 'Q', 'D', 'G'];   // layers past the ninth: letters (lasers, waveform lines, fireflies, stargate, vectorscope, mandala, mood ring, rain, constellations)
const isLayer = k => byKey[k] && byKey[k].kind === 'layer';
const on = (k, min = .05) => (S.active[k] || 0) > min;
let sceneKeyByHand = null;
const sceneIs = k => !!S.scene && sceneKeyByHand === k;
let mode = null, last = null, idle = 0, confirmHelp = false;

// a change by hand: Journey stops first, keeping what's on screen (A carries on from there)
function edit(){ if (J.on) { setJourney(false, true); toast('Frozen here: A hands it back to Journey'); } }
function toggle(v, level){ if (!v) return false; edit(); S.active[v.key] = on(v.key) ? 0 : level; last = v.key; return true; }
function one(all, v, level){   // one of a group (a world, an object): the others go; picking the one on turns it off
  if (!v) return false; edit();
  const was = on(v.key, .3); for (const x of all) S.active[x.key] = 0; if (!was) S.active[v.key] = level; last = v.key; return true;
}
function off(g){ edit(); if (g.off) g.off(); else for (const v of g.all) S.active[v.key] = 0; last = null; }

function show(){
  const el = $('#keyHud'); if (!el) return;
  if (!mode) { el.classList.remove('on'); return; }
  const g = GROUPS[mode], items = g.list();
  el.replaceChildren();
  const h = document.createElement('b'); h.textContent = g.name + (mode === 'c' && !(curP.cosmos > .05) ? ' (the cosmos isn’t on screen: W 5)' : ''); el.append(h);
  items.forEach(([label, isOn, key], i) => {   // each with its key: its number in the group, or its own
    const s = document.createElement('span'); s.className = isOn ? 'on' : '';
    const kb = document.createElement('kbd'); kb.textContent = key ?? i + 1; s.append(kb, ' ' + label); el.append(s);
  });
  const tip = document.createElement('i');
  tip.textContent = mode === 'c' ? 'C or Esc leaves' : mode === 'l' ? '0 all off · Shift+number alone · ↑ ↓ more or less · ← → speed · Shift+← → size · B what it follows · Esc leaves'
    : mode === 'k' ? '0 off · ↑ ↓ more or fewer · ← → turning · Esc leaves' : '0 all off · Shift+number alone · ↑ ↓ more or less · Esc leaves';
  el.append(tip); el.classList.add('on');
}
function help(){ const el = $('#keyHelp'); if (el) el.hidden = !el.hidden; }

addEventListener('keydown', e => {   // (in the capture phase, so ← → on a layer come here before the presets take them)
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(), digit = /^Digit[0-9]$/.test(e.code) ? +e.code.slice(5) : /^[0-9]$/.test(e.key) ? +e.key : null;
  let done = true;
  if (k === '?' || (k === '/' && e.shiftKey)) help();
  else if (k === 't' && mode !== 'c') { mode = null; tutorial(); }   // (in the camera group T takes off)
  else if (k === 'escape') { if (!$('#keyHelp').hidden) help(); mode = null; }
  else if (mode === 'c' && k.length === 1 && flyKey(k)) {}   // the camera takes its own letters and numbers
  else if (mode === 'k' && KAL_WHERE.some(w => w[0] === k)) {   // what the kaleidoscope folds (on at 6 if it was off)
    edit(); S.active.kalWhere = KAL_WHERE.findIndex(w => w[0] === k); if ((S.active.kal || 0) < 2) S.active.kal = 6; last = 'kal'; }
  else if (mode === 'kg' && k === 'm') { edit(); S.active.mirror = (S.active.mirror || 0) > .5 ? 0 : 1; }
  else if (k === 'k' && e.shiftKey) mode = mode === 'kg' ? null : 'kg';
  else if (GROUPS[k] && k !== 'kg') mode = mode === k ? null : k;
  else if (digit !== null && mode && mode !== 'c') {
    const g = GROUPS[mode];
    if (e.shiftKey && g.all && digit > 0) { const v = g.all[digit - 1]; if (v) { solo(v.key); last = v.key; } }
    else if (digit === 0) off(g);
    else { g.pick(digit); if (mode === 's') sceneKeyByHand = (TEMPLATES[digit - 1] || {}).key || null; }
  }
  else if (digit !== null && !mode) { toast('Pick a group first: L layers, W worlds, E hits, O objects, K kaleidoscope, S scene, C camera (? for all)'); }
  else if ((k === 'arrowleft' || k === 'arrowright') && mode && last && (last === 'kal' || isLayer(last))) {
    // the last layer touched: ← → its speed (Shift: its size); the kaleidoscope: which way and how fast it turns
    e.preventDefault(); e.stopImmediatePropagation();
    const d = k === 'arrowright' ? 1 : -1;
    if (last === 'kal') { edit(); S.active.kalTurn = Math.max(-.5, Math.min(.5, +((S.active.kalTurn || 0) + d*.05).toFixed(2))); toast(`Kaleidoscope turning ${S.active.kalTurn}`); }
    else {
      const f = e.shiftKey || !knobs(byKey[last]).includes('speed') ? 'size' : 'speed', [lo, hi] = f === 'size' ? TW_SIZE : TW_SPEED, t = twOf(last) || {};
      const v = Math.max(lo, Math.min(hi, +((t[f] ?? 1)*(d > 0 ? 1.25 : .8)).toFixed(2)));
      setTweak(last, f, Math.abs(v - 1) < .06 ? 1 : v); toast(`${byKey[last].label}: ${f} ${(twOf(last) || {})[f] ?? 1}×`);
    }
  }
  else if (mode === 'l' && MORE.includes(e.key.toUpperCase()) && layers[9 + MORE.indexOf(e.key.toUpperCase())]) {
    const v = layers[9 + MORE.indexOf(e.key.toUpperCase())];
    if (e.shiftKey) { solo(v.key); last = v.key; } else toggle(v, TUNE.keys.layer); }
  else if (k === 'b' && mode === 'l' && last && isLayer(last)) {   // what the last layer follows: its own sound, bass, mids…
    const t = twOf(last) || {}, i = TW_SRC.findIndex(s => s[0] === (t.src || 'auto'));
    setTweak(last, 'src', TW_SRC[(i + 1) % TW_SRC.length][0]); toast(`${byKey[last].label} follows ${TW_SRC[(i + 1) % TW_SRC.length][1]}`);
  }
  else if ((k === 'arrowup' || k === 'arrowdown') && mode && last) {
    e.preventDefault(); edit();
    const d = k === 'arrowup' ? 1 : -1;
    if (last === 'kal') S.active.kal = Math.max(2, Math.min(12, Math.round(S.active.kal || 0) + d));
    else if (last === 'sym') S.active.sym = Math.max(1, Math.min(12, Math.round(S.active.sym || 1) + d));
    else S.active[last] = Math.max(0, Math.min(1, +((S.active[last] || 0) + d*.1).toFixed(2)));
  }
  else if (k === '[' || k === ']') { J.bias = Math.max(0, Math.min(1, J.bias + (k === ']' ? .1 : -.1))); const s = $('#jBias'); s.value = J.bias; s.dispatchEvent(new Event('input')); toast(J.bias < .35 ? 'Calmer' : J.bias > .65 ? 'More intense' : 'Balanced'); }
  else if (k === ',' || k === '.') { J.speed = Math.max(.25, Math.min(3, J.speed*(k === '.' ? 1.25 : .8))); const s = $('#jSpeed'); s.value = J.speed; s.dispatchEvent(new Event('input')); toast(`Evolving ${J.speed.toFixed(2)}×`); }
  else done = false;
  if (!done) return;
  if (mode === 's' && S.scene == null) sceneKeyByHand = null;
  syncSliders();
  idle = performance.now(); show();
}, true);
// the strip goes (and the group with it) after a while untouched, so a stray number later doesn't change anything
setInterval(() => { if (mode && performance.now() - idle > TUNE.keys.idleSecs*1000) { mode = null; show(); } else if (mode) show(); }, 500);
export const keyMode = () => mode;
