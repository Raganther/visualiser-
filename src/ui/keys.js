// The keyboard: a letter picks a group, number keys work inside it, and a strip at the bottom shows the group's list with
// what's on. L layers, W worlds, E hits, O objects, K kaleidoscope (Shift+K the glow's own folds), S scene, C the cosmos's camera. Shift + a number solos
// that one thing, ↑ ↓ raise or lower the last one touched, 0 turns the group off, Esc leaves it (so does a few seconds
// idle). While Journey runs, a group's numbers steer it instead (in and kept, or out; Alt: never: journey/steer.js), ; holds the
// look, R moves on; Shift+number takes over by hand, freezing it (A hands it back). [ ] calmer or more intense, , . evolve slower or
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
import { combos, tutorial } from './tutorial.js';
import { TW_SIZE, TW_SPEED, TW_SRC, knobs, setTweak, twOf } from '../scene/tweaks.js';
import { STEER, clearSteer } from '../journey/steer.js';
import { applySteer } from '../journey/cast.js';
import { KAL_KINDS, KAL_N, steerKal } from '../journey/extras.js';
import { updateSectionUI, gearUI } from './panel.js';
import { GEARS } from '../journey/gear.js';
import { $ } from '../util.js';
import { INNER } from '../visuals/objects/jewel.js';
import { morphSet } from './morph.js';

const layers = LAYER_VISUALS.filter(v => !v.optIn), worlds = WORLD_VISUALS.filter(v => !v.optIn);
const SCENE_WORDS = {plain: 'plain', between: 'between', split: 'split', among: 'among', held: 'held', reflect: 'reflect', inside: 'inside', window: 'window', glass: 'glass'};
// the groups: their key, name, and what number n does (items: [label, isOn] for the strip)
const GROUPS = {
  l: {name: 'Layers', list: () => layers.map((v, i) => [v.label, on(v.key), i < 9 ? i + 1 : MORE[i - 9] || '']), pick: n => toggle(layers[n - 1], TUNE.keys.layer), all: layers},
  w: {name: 'Worlds', list: () => worlds.map((v, i) => [v.label, on(v.key, .3), i < 9 ? i + 1 : WMORE[i - 9] || '']), pick: n => one(worlds, worlds[n - 1], 1), all: worlds},
  e: {name: 'Hits', list: () => HIT_VISUALS.map(v => [v.label, on(v.key)]), pick: n => toggle(HIT_VISUALS[n - 1], (HIT_VISUALS[n - 1] || {}).level), all: HIT_VISUALS},
  o: {name: 'Objects', list: () => OBJECT_VISUALS.map((v, i) => [v.label, on(v.key, .3), i < 9 ? i + 1 : OMORE[i - 9] || '']), pick: n => one(OBJECT_VISUALS, OBJECT_VISUALS[n - 1], TUNE.mesh.level), all: OBJECT_VISUALS},
  // the kaleidoscope: a mirror fold of the picture (everything, the world, the glow, or inside the object), and its letters
  k: {name: 'Kaleidoscope: mirrors', list: () => [2, 3, 4, 5, 6, 7, 8, 9].map(n => [n + ' ways', Math.round(S.active.kal || 0) === n, n])
      .concat(KAL_WHERE.map(([key, label], i) => [label, (S.active.kal || 0) >= 2 && Math.round(S.active.kalWhere || 0) === i, key.toUpperCase()]))
      .concat([['inside the Prism: ' + (S.jewelInner == null ? 'auto' : INNER[S.jewelInner]), S.jewelInner > 0, 'P'], ['objects wander', !!TUNE.sdf.wander.on, 'D']]),
    pick: n => { if (n === 1) return false; edit(); S.active.kal = n; last = 'kal'; return true; }, off: () => { S.active.kal = 0; }},
  // K then M: the kaleidoscope's kind, each on its own key (the user found stepping through fourteen with M slow)
  km: {name: 'Kaleidoscope: kind', list: () => KAL_KINDS.map((n, i) => [n, kindNow() === i, KIND_KEYS[i]])},
  // Shift+K: the glow's own folds, inside the trails (ghostly, lined), and mirrored trails
  kg: {name: 'Glow folds (the trails)', list: () => [2, 3, 4, 5, 6, 7, 8, 9].map(n => [n + ' ways', Math.round(S.active.sym || 1) === n, n]).concat([['mirror trails', (S.active.mirror || 0) > .5, 'M']]),
    pick: n => { if (n === 1) return false; edit(); S.active.sym = n; last = 'sym'; return true; }, off: () => { S.active.sym = 1; }},
  s: {name: 'Scene', list: () => TEMPLATES.map(t => [SCENE_WORDS[t.key] || t.key, J.on ? J.sceneKey === t.key && !!J.sceneLive : sceneIs(t.key)]),
    pick: n => { const t = TEMPLATES[n - 1]; if (!t) return false; edit(); compose(t.key); return true; }, off: () => { S.scene = null; if (S.active) delete S.active.scene; }},
  c: {name: 'Cosmos camera', list: () => FLY.map(([k, l]) => [l, false, k])},
};
const KIND_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'H', 'D', 'C', 'T'];   // the kinds: wedges … tiles on the numbers, then Hyperbolic, Droste, Curved, Two centres
const kindNow = () => J.on ? (J.kal ? J.kal.mode || 0 : -1) : (S.active.kal || 0) >= 2 ? Math.round(S.active.kalMode || 0) : -1;
function setKind(m){   // (while Journey runs, it keeps that kind)
  if (J.on) { STEER.kalMode = m; steerKalKey(null, J.kal ? J.kal.where : null, true); }
  else { edit(); S.active.kalMode = m; if ((S.active.kal || 0) < 2) S.active.kal = 6; last = 'kal'; }
  toast('Kaleidoscope: ' + KAL_KINDS[m]);
}
const KAL_WHERE = [['e', 'everything'], ['b', 'the world'], ['g', 'the glow'], ['i', 'inside the object']];   // kalWhere 0-3
const STYLES = ['glass wire', 'solid', 'outline', 'hologram', 'points', 'shaded'];   // the objects' styles (render/mesh.js), Y in the objects group
const WMORE = ['H', 'N', 'V', 'G', 'D', 'I'];   // worlds past the ninth: letters (the Hollow, the Cathedral's nave, the Vessel, the Geode, the Corridor: D for the dance hall, the lattIce), none a group's letter, T, R, A or X
const OMORE = ['J', 'Q', 'G', 'U', 'I', 'H', 'B', 'P', 'R', 'X', 'F', 'D', 'V', 'N', 'A', 'Z'];   // objects past the ninth: letters (jellyfish, crystal (quartz), goblin, the lit goblin, tentacle, hand, heart (its beat), the Prism, the gem oRbit, the full Prism (eXtra), Ferrofluid, liquid metal (Droplet), bubble (Vapour), cell (Nucleus), corAl, growing crystals (Z)); Y is the style, M the lit look
const LOOKS = ['real', 'toon', 'neon', 'chrome', 'marble'];   // the lit objects' looks (litLook), M in the objects group
const MORE = ['Z', 'U', 'I', 'J', 'V', 'Y', 'Q', 'D', 'G', 'M', 'X', 'N', 'H', 'P', 'F'];   // layers past the ninth: letters (lasers, waveform lines, fireflies, stargate, vectorscope, mandala, mood ring, rain, constellations, the unfolding mandala, the fractal, guilloché (eNgraving), string art (Harp), spiral galaxy (sPiral), the rose window (F: its flower)); the mirror tunnel (media) stays on its slider
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
// steering Journey from a group while it runs: each item's key, and the ones of which only one can be pinned
const STEERS = {l: () => layers.map(v => v.key), w: () => worlds.map(v => v.key), e: () => HIT_VISUALS.map(v => v.key),
  o: () => OBJECT_VISUALS.map(v => v.key), s: () => TEMPLATES.map(t => t.key)};
const ONE = {w: true, o: true, s: true};
const labelOf = k => k === 'kal' ? (STEER.pin.kal ? `a ${STEER.pin.kal}-way kaleidoscope` : 'the kaleidoscope') : (byKey[k] && byKey[k].label) || SCENE_WORDS[k] || k;
// while Journey runs a number puts its item into the composition and keeps it there, or, when it's already in, takes it
// out (free: Journey may bring it back later). Alt+number: never (again: free). Pressing twice used to mean never, so
// taking something out banned it for the rest of the visit, and Journey seemed to lose things the more it was played
const inNow = k => STEER.pin[k] || [J.lead, J.accent, J.world, J.hit, J.centre, J.sceneKey].includes(k);
function steerItem(k, g, alt){
  if (!k) return false;
  let st;
  if (alt) { if (STEER.ban[k]) { delete STEER.ban[k]; st = 'free'; } else { delete STEER.pin[k]; STEER.ban[k] = true; st = 'ban'; } }
  else if (inNow(k)) { delete STEER.pin[k]; delete STEER.ban[k]; st = 'out'; }
  else { delete STEER.ban[k]; if (ONE[g]) for (const o of STEERS[g]()) delete STEER.pin[o]; STEER.pin[k] = true; st = 'pin'; }
  if (J.on) applySteer(k, st);
  toast(`${labelOf(k)}: ${st === 'pin' ? 'in, and kept (Journey builds round it)' : st === 'ban' ? 'never (Journey leaves it out; Alt+number again frees it)' : st === 'out' ? 'taken out (Journey may bring it back later)' : 'free again'}`);
  steerLine(); return true;
}
// the kaleidoscope while Journey runs: a number keeps it at that many mirrors (the same again: free), 0 never (again: free),
// E B G I what it folds (journey/extras.js)
function steerKalKey(n, where, quiet){
  if (quiet && where == null) { if (!STEER.pin.kal) STEER.pin.kal = (J.kal && J.kal.n) || 6; delete STEER.ban.kal; }
  else if (where != null) { STEER.kalWhere = where; if (!STEER.pin.kal) STEER.pin.kal = (J.kal && J.kal.n) || 6; delete STEER.ban.kal; }
  else if (n === 0) { if (STEER.ban.kal) delete STEER.ban.kal; else { STEER.ban.kal = true; delete STEER.pin.kal; } }
  else if (STEER.pin.kal === n) { delete STEER.pin.kal; STEER.kalWhere = null; STEER.kalMode = null; }
  else { STEER.pin.kal = n; delete STEER.ban.kal; }
  steerKal(); updateSectionUI(); steerLine();
  if (!quiet) toast(STEER.ban.kal ? 'Kaleidoscope: never (Journey leaves it out)' : STEER.pin.kal ? `Kaleidoscope: kept at ${STEER.pin.kal} mirrors, folding ${KAL_WHERE[J.kal ? J.kal.where : 0][1]}` : 'Kaleidoscope: Journey chooses freely again');
}
// what's steering Journey, said in the panel
export function steerLine(){
  const el = $('#jSteer'); if (!el) return;
  const keep = Object.keys(STEER.pin).map(labelOf), never = Object.keys(STEER.ban).map(labelOf);
  el.textContent = !keep.length && !never.length && !STEER.hold ? '' : 'Steering: ' + [STEER.hold ? 'holding this look' : '', keep.length ? 'keeping ' + keep.join(', ') : '',
    never.length ? 'never ' + never.join(', ') : ''].filter(Boolean).join('; ') + '.';
}

function show(){
  const el = $('#keyHud'); if (!el) return;
  if (!mode) { el.classList.remove('on'); return; }
  const g = GROUPS[mode], items = g.list();
  el.replaceChildren();
  const h = document.createElement('b'); h.textContent = g.name + (mode === 'c' && !(curP.cosmos > .05) ? ' (the cosmos isn’t on screen: W 5)' : ''); el.append(h);
  const ids = STEERS[mode] ? STEERS[mode]() : [];
  items.forEach(([label, isOn, key], i) => {   // each with its key: its number in the group, or its own; and how it's steered
    const s = document.createElement('span'); s.className = (isOn ? 'on' : '') + (STEER.pin[ids[i]] ? ' pin' : STEER.ban[ids[i]] ? ' ban' : '');
    const kb = document.createElement('kbd'); kb.textContent = key ?? i + 1; s.append(kb, ' ' + label); el.append(s);
  });
  const tip = document.createElement('i');
  tip.textContent = mode === 'c' ? 'C or Esc leaves' : J.on && mode === 'k' ? 'number: Journey keeps that many mirrors (again: free) · 0 never (again: free) · E B G I what it folds · M the kind (a list of fourteen) · Esc leaves' : J.on && STEERS[mode] ? 'number: in and kept, or out again (Journey carries on) · Alt+number never · Shift+number takes over by hand · 0 clears · ; holds · R moves on' + (mode === 'o' ? ' · Y style · M lit look' : '') + ' · Esc leaves'
    : mode === 'l' ? '0 all off · Shift+number alone · ↑ ↓ more or less · ← → speed · Shift+← → size · B what it follows · Esc leaves'
    : mode === 'o' ? '0 all off · Shift+number alone · Y style (glass wire, solid, outline, hologram, points, shaded) · M lit look (real, toon, neon, chrome, marble) · C centred or carried through the 3D worlds · Esc leaves'
    : mode === 'km' ? 'a key picks that kind · ↑ ↓ the next or the one before · M back to the mirrors · Esc leaves'
    : mode === 'k' ? '0 off · ↑ ↓ more or fewer · ← → turning · M the kind (a list of fourteen) · Esc leaves' : '0 all off · Shift+number alone · ↑ ↓ more or less · Esc leaves';
  el.append(tip); el.classList.add('on');
}
function setObjWorld(v, quiet){ S.objWorld = v; try { localStorage.setItem('afterglow.objWorld', v ? '1' : '0'); } catch (e) {}
  const c = $('#objWorld'); if (c) c.checked = v; if (!quiet) toast(v ? 'Objects travel through the 3D worlds' : 'Objects stay in the centre'); }
{ const c = $('#objWorld'); if (c) { c.checked = S.objWorld; c.addEventListener('change', e => setObjWorld(e.target.checked)); } }
function help(){ const el = $('#keyHelp'); if (el) el.hidden = !el.hidden; }

addEventListener('keydown', e => {   // (in the capture phase, so ← → on a layer come here before the presets take them)
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey && !(J.on && STEERS[mode])) return;   // (Alt+number while Journey runs: never)
  const was = mode, k = e.key.toLowerCase(), digit = /^Digit[0-9]$/.test(e.code) ? +e.code.slice(5) : /^[0-9]$/.test(e.key) ? +e.key : null;
  let done = true;
  if (k === '?' || (k === '/' && e.shiftKey)) help();
  else if (k === 't' && mode !== 'c' && mode !== 'km') { mode = null; if (e.shiftKey) combos(); else tutorial(); }   // (Shift+T: the walk-throughs of combinations)   // (in the camera group T takes off)
  else if (k === 'escape') { if (!$('#keyHelp').hidden) help(); mode = null; }
  else if (mode === 'c' && k.length === 1 && flyKey(k)) {}   // the camera takes its own letters and numbers
  else if (mode === 'o' && k === 'c') setObjWorld(!S.objWorld);   // objects carried through the 3D worlds, or kept in the centre
  else if (mode === 'k' && k === 'm') mode = 'km';
  else if (mode === 'k' && k === 'd') {   // the morphing objects wandering round the screen under a kaleidoscope that folds everything
    const W = TUNE.sdf.wander; morphSet('sdf.wander.on', W.on ? 0 : 1);
    toast(W.on ? 'Morphing objects wander under the kaleidoscope (when it folds everything: K then E)' : 'Morphing objects stay in the centre'); }
  else if (mode === 'k' && k === 'p') {   // the Prism's own kaleidoscope: auto (Journey's sections choose), off, skin, mirrors, tunnel
    S.jewelInner = S.jewelInner == null ? 0 : S.jewelInner >= INNER.length - 1 ? null : S.jewelInner + 1;
    toast('Inside the Prism: ' + (S.jewelInner == null ? 'auto (each section its own)' : INNER[S.jewelInner])); }   // the kinds' own list
  else if (mode === 'km' && (k === 'm' || k === 'backspace')) mode = 'k';   // (back to the mirrors)
  else if (mode === 'km' && KIND_KEYS.includes(e.key.toUpperCase())) setKind(KIND_KEYS.indexOf(e.key.toUpperCase()));
  else if (mode === 'km' && (k === 'arrowup' || k === 'arrowdown')) { e.preventDefault(); setKind((Math.max(0, kindNow()) + (k === 'arrowdown' ? 1 : KAL_N - 1)) % KAL_N); }
  else if (mode === 'k' && J.on && KAL_WHERE.some(w => w[0] === k)) steerKalKey(null, KAL_WHERE.findIndex(w => w[0] === k));
  else if (mode === 'k' && KAL_WHERE.some(w => w[0] === k)) {   // what the kaleidoscope folds (on at 6 if it was off)
    edit(); S.active.kalWhere = KAL_WHERE.findIndex(w => w[0] === k); if ((S.active.kal || 0) < 2) S.active.kal = 6; last = 'kal'; }
  else if (mode === 'kg' && k === 'm') { edit(); S.active.mirror = (S.active.mirror || 0) > .5 ? 0 : 1; }
  else if (k === 'k' && e.shiftKey) mode = mode === 'kg' ? null : 'kg';
  else if (GROUPS[k] && k !== 'kg') mode = mode === k ? null : k;
  else if (digit !== null && mode && mode !== 'c') {
    const g = GROUPS[mode];
    if (e.shiftKey && g.all && digit > 0) { const v = g.all[digit - 1]; if (v) { solo(v.key); last = v.key; } }
    else if (J.on && mode === 'k') { if (digit !== 1) steerKalKey(digit); }
    else if (J.on && STEERS[mode]) { if (digit === 0) { clearSteer(STEERS[mode]()); toast(g.name + ': Journey chooses freely again'); steerLine(); } else steerItem(STEERS[mode]()[digit - 1], mode, e.altKey); }
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
    e.stopPropagation();   // (X is also a single key outside the groups)
    if (e.shiftKey) { solo(v.key); last = v.key; } else if (J.on) steerItem(v.key, 'l', e.altKey); else toggle(v, TUNE.keys.layer); }
  else if (mode === 'w' && WMORE.includes(e.key.toUpperCase()) && worlds[9 + WMORE.indexOf(e.key.toUpperCase())]) {
    const v = worlds[9 + WMORE.indexOf(e.key.toUpperCase())];
    e.stopPropagation();
    if (e.shiftKey) { solo(v.key); last = v.key; } else if (J.on) steerItem(v.key, 'w', e.altKey); else one(worlds, v, 1); }
  else if (mode === 'o' && OMORE.includes(e.key.toUpperCase()) && OBJECT_VISUALS[9 + OMORE.indexOf(e.key.toUpperCase())]) {
    const v = OBJECT_VISUALS[9 + OMORE.indexOf(e.key.toUpperCase())];
    e.stopPropagation();
    if (e.shiftKey) { solo(v.key); last = v.key; } else if (J.on) steerItem(v.key, 'o', e.altKey); else one(OBJECT_VISUALS, v, TUNE.mesh.level); }
  else if (k === 'm' && mode === 'o') {   // the lit objects' look: real, toon, neon, chrome, marble (Journey keeps it going)
    const n = ((J.on ? J.litLook || 0 : Math.round(S.active.litLook || 0)) + 1) % LOOKS.length;
    if (J.on) J.litLook = n; else S.active.litLook = n; curP.litLook = n;
    toast('Lit objects: ' + LOOKS[n]);
  }
  else if (k === 'y' && mode === 'o') {   // the objects' style: glass wire, solid, outline, hologram, points, shaded (Journey keeps it going)
    const n = ((J.on ? J.objStyle || 0 : Math.round(S.active.objStyle || 0)) + 1) % STYLES.length;
    if (J.on) { J.objStyle = n; } else { S.active.objStyle = n; } curP.objStyle = n;
    toast('Objects: ' + STYLES[n]);
  }
  else if (k === 'b' && mode === 'l' && last && isLayer(last)) {   // what the last layer follows: its own sound, bass, mids…
    const t = twOf(last) || {}, i = TW_SRC.findIndex(s => s[0] === (t.src || 'auto'));
    setTweak(last, 'src', TW_SRC[(i + 1) % TW_SRC.length][0]); toast(`${byKey[last].label} follows ${TW_SRC[(i + 1) % TW_SRC.length][1]}`);
  }
  else if ((k === 'arrowleft' || k === 'arrowright') && mode) {   // in a group, never the next preset (that changes the whole look)
    e.preventDefault(); e.stopImmediatePropagation();
    toast(mode === 'l' ? '← → change the last layer\'s speed: toggle a layer first' : 'Esc leaves the group; then ← → change the preset');
  }
  else if ((k === 'arrowup' || k === 'arrowdown') && mode && last) {
    e.preventDefault(); edit();
    const d = k === 'arrowup' ? 1 : -1;
    if (last === 'kal') S.active.kal = Math.max(2, Math.min(12, Math.round(S.active.kal || 0) + d));
    else if (last === 'sym') S.active.sym = Math.max(1, Math.min(12, Math.round(S.active.sym || 1) + d));
    else S.active[last] = Math.max(0, Math.min(1, +((S.active[last] || 0) + d*.1).toFixed(2)));
  }
  else if (k === ';') {   // hold the look as it is (Journey keeps moving with the music, but no new sections or steps)
    if (!J.on) toast('Hold steers Journey: A starts it');
    else { STEER.hold = !STEER.hold; toast(STEER.hold ? 'Holding this look (; lets go)' : 'Journey moves on again'); steerLine(); }
  }
  else if (k === '[' || k === ']') { J.bias = Math.max(0, Math.min(1, J.bias + (k === ']' ? .1 : -.1))); const s = $('#jBias'); s.value = J.bias; s.dispatchEvent(new Event('input')); toast(J.bias < .35 ? 'Calmer' : J.bias > .65 ? 'More intense' : 'Balanced'); }
  else if (k === "'") {   // the movement's speed gear: with the music, then held at half, normal or double time (journey/gear.js)
    STEER.gear = STEER.gear == null ? 0 : STEER.gear < 2 ? STEER.gear + 1 : null; gearUI();
    toast(STEER.gear == null ? 'Movement follows the music: half, normal or double time' : `Movement held at ${GEARS[STEER.gear].name} (' again changes it)`);
  }
  else if (k === ',' || k === '.') { J.speed = Math.max(.25, Math.min(3, J.speed*(k === '.' ? 1.25 : .8))); const s = $('#jSpeed'); s.value = J.speed; s.dispatchEvent(new Event('input')); toast(`Evolving ${J.speed.toFixed(2)}×`); }
  else done = false;
  if (!done) return;
  if (was && k.length === 1) e.stopImmediatePropagation();   // (a group's own letter: not the page's too, as O then P once also toggled the frame rate, X froze the trails, H hid the controls)
  if (mode === 's' && S.scene == null) sceneKeyByHand = null;
  syncSliders();
  idle = performance.now(); show();
}, true);
// the strip goes (and the group with it) after a while untouched, so a stray number later doesn't change anything
setInterval(() => { if (mode && performance.now() - idle > TUNE.keys.idleSecs*1000) { mode = null; show(); } else if (mode) show(); }, 500);
export const keyMode = () => mode;
export const sceneKey = () => S.scene ? sceneKeyByHand : null;   // the scene template picked by hand (S then a number), while it's on
export function leaveGroup(){ mode = null; show(); }
