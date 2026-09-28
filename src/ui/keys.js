// The keyboard: a letter picks a group, number keys work inside it, and a strip at the bottom shows the group's list with
// what's on. L layers, W worlds, E hits, O objects, K kaleidoscope, S scene, C the cosmos's camera. Shift + a number solos
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
import { $ } from '../util.js';

const layers = LAYER_VISUALS.filter(v => !v.optIn), worlds = WORLD_VISUALS.filter(v => !v.optIn);
const SCENE_WORDS = {plain: 'plain', between: 'between', split: 'split', among: 'among', held: 'held', reflect: 'reflect', inside: 'inside', window: 'window', glass: 'glass'};
// the groups: their key, name, and what number n does (items: [label, isOn] for the strip)
const GROUPS = {
  l: {name: 'Layers', list: () => layers.map(v => [v.label, on(v.key)]), pick: n => toggle(layers[n - 1], TUNE.keys.layer), all: layers},
  w: {name: 'Worlds', list: () => worlds.map(v => [v.label, on(v.key, .3)]), pick: n => one(worlds, worlds[n - 1], 1), all: worlds},
  e: {name: 'Hits', list: () => HIT_VISUALS.map(v => [v.label, on(v.key)]), pick: n => toggle(HIT_VISUALS[n - 1], (HIT_VISUALS[n - 1] || {}).level), all: HIT_VISUALS},
  o: {name: 'Objects', list: () => OBJECT_VISUALS.map(v => [v.label, on(v.key, .3)]), pick: n => one(OBJECT_VISUALS, OBJECT_VISUALS[n - 1], TUNE.mesh.level), all: OBJECT_VISUALS},
  k: {name: 'Kaleidoscope (glow only): folds', list: () => [2, 3, 4, 5, 6, 7, 8, 9].map(n => [n + ' ways', Math.round(S.active.sym || 1) === n, n]).concat([['mirror trails', (S.active.mirror || 0) > .5, 'M']]),
    pick: n => { if (n === 1) return false; edit(); S.active.sym = n; last = 'sym'; return true; }, off: () => { S.active.sym = 1; }},
  s: {name: 'Scene', list: () => TEMPLATES.map(t => [SCENE_WORDS[t.key] || t.key, J.on ? J.sceneKey === t.key && !!J.sceneLive : sceneIs(t.key)]),
    pick: n => { const t = TEMPLATES[n - 1]; if (!t) return false; edit(); compose(t.key); return true; }, off: () => { S.scene = null; if (S.active) delete S.active.scene; }},
  c: {name: 'Cosmos camera', list: () => FLY.map(([k, l]) => [l, false, k])},
};
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
  tip.textContent = mode === 'c' ? 'C or Esc leaves' : '0 all off · Shift+number alone · ↑ ↓ more or less · Esc leaves';
  el.append(tip); el.classList.add('on');
}
function help(){ const el = $('#keyHelp'); if (el) el.hidden = !el.hidden; }

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(), digit = /^Digit[0-9]$/.test(e.code) ? +e.code.slice(5) : /^[0-9]$/.test(e.key) ? +e.key : null;
  let done = true;
  if (k === '?' || (k === '/' && e.shiftKey)) help();
  else if (k === 't' && mode !== 'c') { mode = null; tutorial(); }   // (in the camera group T takes off)
  else if (k === 'escape') { if (!$('#keyHelp').hidden) help(); mode = null; }
  else if (mode === 'c' && k.length === 1 && flyKey(k)) {}   // the camera takes its own letters and numbers
  else if (GROUPS[k] && !(mode === 'k' && k === 'm')) mode = mode === k ? null : k;
  else if (mode === 'k' && k === 'm') { edit(); S.active.mirror = (S.active.mirror || 0) > .5 ? 0 : 1; }
  else if (digit !== null && mode && mode !== 'c') {
    const g = GROUPS[mode];
    if (e.shiftKey && g.all && digit > 0) { const v = g.all[digit - 1]; if (v) { solo(v.key); last = v.key; } }
    else if (digit === 0) off(g);
    else { g.pick(digit); if (mode === 's') sceneKeyByHand = (TEMPLATES[digit - 1] || {}).key || null; }
  }
  else if (digit !== null && !mode) { toast('Pick a group first: L layers, W worlds, E hits, O objects, K kaleidoscope, S scene, C camera (? for all)'); }
  else if ((k === 'arrowup' || k === 'arrowdown') && mode && last) {
    e.preventDefault(); edit();
    const d = k === 'arrowup' ? 1 : -1;
    if (last === 'sym') S.active.sym = Math.max(1, Math.min(12, Math.round(S.active.sym || 1) + d));
    else S.active[last] = Math.max(0, Math.min(1, +((S.active[last] || 0) + d*.1).toFixed(2)));
  }
  else if (k === '[' || k === ']') { J.bias = Math.max(0, Math.min(1, J.bias + (k === ']' ? .1 : -.1))); const s = $('#jBias'); s.value = J.bias; s.dispatchEvent(new Event('input')); toast(J.bias < .35 ? 'Calmer' : J.bias > .65 ? 'More intense' : 'Balanced'); }
  else if (k === ',' || k === '.') { J.speed = Math.max(.25, Math.min(3, J.speed*(k === '.' ? 1.25 : .8))); const s = $('#jSpeed'); s.value = J.speed; s.dispatchEvent(new Event('input')); toast(`Evolving ${J.speed.toFixed(2)}×`); }
  else done = false;
  if (!done) return;
  if (mode === 's' && S.scene == null) sceneKeyByHand = null;
  if (!J.on) syncSliders();
  idle = performance.now(); show();
});
// the strip goes (and the group with it) after a while untouched, so a stray number later doesn't change anything
setInterval(() => { if (mode && performance.now() - idle > TUNE.keys.idleSecs*1000) { mode = null; show(); } else if (mode) show(); }, 500);
export const keyMode = () => mode;
