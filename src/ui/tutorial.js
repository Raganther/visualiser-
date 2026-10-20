// The tutorial (T, or the button) and the walk-throughs (Shift+T, or the help card's button): a card at the top of the
// screen with one thing to try at a time. It watches what you do and moves on by itself once you've done it (a tick
// first), or you step with its buttons. The tutorial walks through the keyboard (ui/keys.js); each walk-through builds one
// combination (a world, layers, a scene, an object, the kaleidoscope, steering) from a clean slate, so it looks the same
// every time: Journey off, nothing on screen, plain motion, the same colours, the trails wiped. The user asked for this
// after the help card: "walk the user through the combinations, each from a clean slate".
import { STEER } from '../journey/steer.js';
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { curP } from '../presets.js';
import { VISUALS } from '../visuals/registry.js';
import { keyMode, leaveGroup, sceneKey } from './keys.js';
import { setPreset } from './presets.js';
import { setJourney } from './controls.js';
import { $ } from '../util.js';

const k = s => `<kbd>${s}</kbd>`;
let likes = 0;
addEventListener('afterglow-like', () => likes++);
// each step: what to do (keys in <kbd>), and when it's done (from a snapshot of the state as the step began)
const STEPS = [
  {say: `Welcome. This walks you through the keys; each step moves on once you've done it. First, ${k('A')} stops Journey, the automatic director, so you can take over.`,
    done: () => !J.on, already: () => !J.on, ok: 'Journey is off: what you see stays until you change it.'},
  {say: `Press ${k('L')}: the Layers group. A strip at the bottom lists them, each with its number.`, done: () => keyMode() === 'l'},
  {say: `Press ${k('1')}: the ring comes in (or goes, if it was on). A dot in the strip marks what's on.`,
    start: () => ({v: S.active.ring}), done: s => S.active.ring !== s.v},
  {say: `Now ${k('5')}: comets. Try other numbers too; ${k('0')} turns every layer off.`,
    start: () => ({v: S.active.comets}), done: s => S.active.comets !== s.v},
  {say: `${k('↑')} makes the last one you touched stronger, ${k('↓')} weaker. Press ${k('↑')} a couple of times.`,
    start: () => ({v: S.active.comets, r: S.active.ring}), done: s => S.active.comets > s.v || S.active.ring > s.r},
  {say: `Worlds: ${k('W')} then ${k('4')} for the city. (One world at a time; its number again takes it away.)`,
    done: () => (S.active.city || 0) > .3},
  {say: `Scenes decide what's in front of what. ${k('S')} then ${k('2')}: "between" puts the glow behind the near buildings.`,
    start: () => ({v: S.scene}), done: s => !!S.scene && S.scene !== s.v},
  {say: `Objects: ${k('O')} then ${k('1')} brings in the wire skull.`, done: () => (S.active.skull || 0) > .3},
  {say: `${k('S')} then ${k('4')}: "among" stands the skull between the city's buildings. Try ${k('6')} (the city in its glass) or ${k('8')} (the glow only through it) too.`,
    start: () => ({v: S.scene}), done: s => !!S.scene && S.scene !== s.v},
  {say: `The kaleidoscope mirrors the picture: ${k('K')} then ${k('6')} for six ways. Then ${k('B')} folds only the world, ${k('G')} only the glow, ${k('I')} only inside the object, ${k('E')} everything. ${k('K')} ${k('0')} turns it off. (${k('Shift')}+${k('K')} is the glow's own ghostly folds.)`,
    done: () => (S.active.kal || 0) >= 2},
  {say: `Hold ${k('Shift')} and press a number in a group to see that one thing alone: try ${k('L')} then ${k('Shift')}+${k('5')}.`,
    start: () => ({n: S.active.name}), done: s => /alone$/.test(S.active.name || '') && S.active.name !== s.n},
  {say: `Like what you see? ${k('+')} keeps it: it's saved in Adjust, under Liked, where a tap brings it back, and Journey favours your likes.`,
    start: () => ({v: likes}), done: s => likes > s.v},
  {say: `${k('A')} hands back to Journey. It carries on from your look, then moves on when the music does.`, done: () => J.on},
  {say: `Steer Journey without stopping it: ${k('[')} calmer, ${k(']')} more intense, ${k(',')} ${k('.')} evolve slower or faster, ${k('R')} somewhere new.`,
    start: () => ({b: J.bias, s: J.speed}), done: s => J.bias !== s.b || J.speed !== s.s},
  {say: `While Journey runs, a group's numbers steer it: ${k('L')} then a number keeps that layer (Journey builds round it), again never uses it, again frees it. ${k(';')} holds the look.`,
    done: () => STEER.hold || Object.keys(STEER.pin).length + Object.keys(STEER.ban).length > 0},
  {say: `The cosmos is a place to fly: ${k('W')} ${k('5')} puts it on, then ${k('C')} and a key: ${k('5')} an eclipse, ${k('L')} land, ${k('J')} jump to another star.`,
    done: () => curP.cosmos > .3 && keyMode() === 'c'},
  {say: `That's the lot. ${k('?')} shows every key any time, ${k('Esc')} leaves a group, and ${k('T')} starts this again. ${k('Shift')}+${k('T')} opens the walk-throughs: combinations built step by step, each from a clean slate.`, last: true},
];

// a clean slate: Journey off and unsteered, nothing on screen, plain motion, no scene or kaleidoscope, the same colours,
// the trails wiped, no group open
export function cleanSlate(){
  if (J.on) setJourney(false);
  STEER.pin = {}; STEER.ban = {}; STEER.hold = false; STEER.kalWhere = null; STEER.kalMode = null;
  const p = {name: 'Clean slate', mods: {}, tw: {}, decay: .9, zoom: 1.004, rot: 0, warp: .05, wander: 0, sym: 1, mirror: 0, colorSpeed: .02,
    hueDrift: .004, kal: 0, kalWhere: 0, kalTurn: 0, kalMode: 0, grain: 0, objStyle: 0, mandDetail: .5, fracVortex: 0, litLook: 0};
  for (const v of VISUALS) p[v.key] = 0;
  setPreset(p); for (const key in p) if (typeof p[key] === 'number') curP[key] = p[key];   // at once, not faded
  S.hueKick = 0; S.hueSet = .55; S.wipe = 1; leaveGroup();
}
const on = (key, at = .3) => (S.active[key] || 0) > at;
const pin = key => !!STEER.pin[key];
// the walk-throughs: each a title, what it shows, and its steps (each from the one before; the first from a clean slate)
const LESSONS = [
  {title: 'Glow on the walls of a cave', what: 'A 3D world with a layer laid on its walls, then the glow folded.', steps: [
    {say: `${k('W')} then ${k('H')}: the Hollow, a honeycomb cave you fly through.`, done: () => on('hollow')},
    {say: `${k('L')} then ${k('6')}: the flow field. Its glow is laid on the cave's walls too, so the light slides past with the rock.`, done: () => on('flow')},
    {say: `${k('1')}: the ring joins it. Two layers over a world is plenty: more turns to mush.`, done: () => on('ring')},
    {say: `${k('Shift')}+${k('K')} then ${k('6')}: the glow folds six ways inside its own trails, ghostly; the cave stays whole.`, done: () => (S.active.sym || 1) >= 2},
    {say: `That's the combination: a world, two layers, the glow's own folds. ${k('+')} keeps it in your likes.`, last: true},
  ]},
  {title: 'Comets behind the buildings', what: "A scene puts the glow between the city's rows of buildings.", steps: [
    {say: `${k('W')} then ${k('4')}: the city.`, done: () => on('city')},
    {say: `${k('L')} then ${k('5')}: comets, drawing shapes over the skyline.`, done: () => on('comets')},
    {say: `${k('S')} then ${k('2')}: "between". The comets now fly behind the nearest buildings and in front of the towers.`, done: () => sceneKey() === 'between'},
    {say: `${k('L')} then ${k('1')}: the ring, a second layer.`, done: () => on('ring')},
    {say: `${k('S')} then ${k('3')}: "split". One layer behind the buildings, the other in front: depth from two flat glows.`, done: () => sceneKey() === 'split'},
    {say: `Try ${k('S')} ${k('1')} (plain) and back to ${k('3')} to see what the scene does.`, last: true},
  ]},
  {title: 'A neon tentacle in the club', what: 'An object standing inside a 3D world, in the neon look, with lasers.', steps: [
    {say: `${k('W')} then ${k('D')}: the Corridor, an endless hall of neon frames over a mirror floor.`, done: () => on('corridor')},
    {say: `${k('O')} then ${k('I')}: the tentacle. Every so often it stands in the hall, and the frames nearer than it pass in front.`, done: () => on('tentacle')},
    {say: `${k('M')} twice: the neon look (each press: real, toon, neon, chrome, marble).`, done: () => Math.round(S.active.litLook || 0) === 2},
    {say: `${k('L')} then ${k('Z')}: lasers, fanning from below.`, done: () => on('lasers')},
    {say: `Watch the tentacle: on a drop it turns to face you and reaches out. ${k('O')} then ${k('H')} swaps it for the hand.`, last: true},
  ]},
  {title: 'The kaleidoscope round an object', what: 'The skull in plasma, folded by the kaleidoscope in three ways.', steps: [
    {say: `${k('O')} then ${k('1')}: the wire skull.`, done: () => on('skull')},
    {say: `${k('L')} then ${k('3')}: plasma behind it.`, done: () => on('plasma')},
    {say: `${k('K')} then ${k('6')}: the kaleidoscope, six mirrors round the middle.`, done: () => Math.round(S.active.kal || 0) === 6},
    {say: `${k('I')}: now it folds only inside the skull. (${k('E')} everything, ${k('B')} the world, ${k('G')} the glow.)`, done: () => Math.round(S.active.kalWhere || 0) === 3},
    {say: `${k('E')} then ${k('M')}: the mirror box, a hall of mirrors. ${k('M')} again: the dive, zooming in through the folds.`, done: () => Math.round(S.active.kalMode || 0) === 2},
    {say: `${k('←')} ${k('→')} turn it; ${k('↑')} ${k('↓')} more or fewer mirrors; ${k('0')} takes it away.`, last: true},
  ]},
  {title: 'A world inside the glass', what: 'The skull filled with the city, then the glow seen only through it.', steps: [
    {say: `${k('W')} then ${k('4')}: the city.`, done: () => on('city')},
    {say: `${k('O')} then ${k('1')}: the skull.`, done: () => on('skull')},
    {say: `${k('S')} then ${k('6')}: "reflect". The city shows in the skull's glass, shrunk and brightened.`, done: () => sceneKey() === 'reflect'},
    {say: `${k('L')} then ${k('5')}: comets.`, done: () => on('comets')},
    {say: `${k('S')} then ${k('8')}: "window". The comets are seen only through the skull, as if it were a window.`, done: () => sceneKey() === 'window'},
    {say: `${k('S')} ${k('9')} ("glass") keeps one layer only in the glass. Each scene relates what's there; none adds anything.`, last: true},
  ]},
  {title: 'A crystal ball in space', what: 'The cosmos, flares orbiting a planet, the glow held inside it, a shot by hand.', steps: [
    {say: `${k('W')} then ${k('5')}: the cosmos. The camera flies with the music.`, done: () => on('cosmos')},
    {say: `${k('L')} then ${k('9')}: orbits, flares circling the planet being filmed.`, done: () => on('orbit')},
    {say: `${k('S')} then ${k('5')}: "held". The glow is shrunk into the planet and shown only inside it, like a crystal ball.`, done: () => sceneKey() === 'held'},
    {say: `${k('C')}: the camera's keys. ${k('5')} an eclipse, ${k('U')} a sunrise, ${k('L')} land, ${k('J')} jump to another star.`, done: () => keyMode() === 'c'},
    {say: `${k('G')} (still in ${k('C')}) goes out to the whole galaxy; ${k('C')} or ${k('Esc')} leaves the camera.`, last: true},
  ]},
  {title: 'The neon hand among crystals', what: 'The Geode with the hand standing in a cavern, fireflies drifting.', steps: [
    {say: `${k('W')} then ${k('G')}: the Geode, a crack in the rock lined with crystals that grow as the music builds.`, done: () => on('geode')},
    {say: `${k('O')} then ${k('H')}: the hand. It stands in each cavern as the camera passes through.`, done: () => on('hand')},
    {say: `${k('M')} twice: neon.`, done: () => Math.round(S.active.litLook || 0) === 2},
    {say: `${k('L')} then ${k('I')}: fireflies, soft lights drifting among the crystals.`, done: () => on('fireflies')},
    {say: `On a drop the crystals flash white and the hand reaches out. ${k('M')} once more for chrome.`, last: true},
  ]},
  {title: 'Steering Journey', what: 'Journey composes; you keep a world, a layer and an object, then hold the look.', steps: [
    {say: `${k('A')}: Journey on. It picks everything itself, following the music.`, done: () => J.on},
    {say: `${k('W')} then ${k('D')}: while Journey runs this means "keep the Corridor". It comes in and stays; Journey builds round it.`, done: () => pin('corridor')},
    {say: `${k('L')} then ${k('Z')}: keep the lasers. (Press again for "never", again to free it.)`, done: () => pin('lasers')},
    {say: `${k('O')} then ${k('I')}: keep the tentacle as the centrepiece.`, done: () => pin('tentacle')},
    {say: `${k(';')}: hold the look. No new sections until you press it again; the music still moves everything.`, done: () => STEER.hold},
    {say: `${k(';')} lets go, ${k('0')} in a group frees it, ${k('R')} moves on. Journey keeps your steering for this visit.`, last: true},
  ]},
];

let steps = STEPS, lesson = -1, menu = false, step = -1, base = null, doneAt = 0, ticks = 0;   // doneAt: the check (of the watcher's, every quarter second) it was done at
export const tutorialOn = () => step >= 0 || menu;
export function tutorial(on = step < 0 || lesson >= 0 || menu){
  if (on) $('#welcome').classList.add('gone');   // (the welcome's words would sit under the card)
  steps = STEPS; lesson = -1; menu = false; step = on ? 0 : -1; enter(); render();
}
// the walk-throughs: the list, or one of them started from a clean slate
export function combos(on = !menu){
  $('#welcome').classList.add('gone'); const kh = $('#keyHelp'); if (kh) kh.hidden = true;
  menu = on; step = -1; lesson = -1; render();
}
function begin(n){ cleanSlate(); lesson = n; steps = LESSONS[n].steps; menu = false; step = 0; enter(); render(); }
function enter(){ const s = steps[step]; base = s && s.start ? s.start() : {}; doneAt = s && s.already && s.already() ? ticks || 1 : 0; }
function go(d){ step = Math.max(0, Math.min(steps.length - 1, step + d)); enter(); render(); }
function render(){
  const el = $('#tutorial'); if (!el) return;
  if (menu) {
    el.hidden = false;
    el.innerHTML = `<div class="tstep">Walk-throughs: combinations</div><p>Each one starts from a clean slate (Journey off, nothing on screen), so it looks the same every time, and builds one combination a key at a time.</p>
      <div class="tlist">${LESSONS.map((l, i) => `<button data-l="${i}"><b>${i + 1}. ${l.title}</b><span>${l.what}</span></button>`).join('')}</div>
      <div class="tbtns"><button data-t="tour">The key tour (T)</button><button data-t="exit" aria-label="Close">✕</button></div>`;
    return;
  }
  if (step < 0) { el.hidden = true; return; }
  const s = steps[step], L = LESSONS[lesson];
  el.hidden = false;
  el.innerHTML = `<div class="tstep">${L ? `${L.title} · ` : ''}${step + 1} of ${steps.length}</div><p>${s.say}</p>${doneAt ? `<p class="tok">✓ ${s.ok || 'Done.'}</p>` : ''}
    <div class="tbtns">${L ? '<button data-t="list">All walk-throughs</button><button data-t="again">Start over</button>' : ''}<button data-t="back"${step ? '' : ' disabled'}>Back</button>${s.last && L && lesson < LESSONS.length - 1 ? '<button data-t="nextl">Next walk-through</button>' : ''}<button data-t="next">${s.last ? 'Finish' : doneAt ? 'Next' : 'Skip'}</button><button data-t="exit" aria-label="Leave">✕</button></div>`;
}
$('#tutorial').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.l != null) return begin(+b.dataset.l);
  const t = b.dataset.t;
  if (t === 'tour') tutorial(true);
  else if (t === 'list') combos(true);
  else if (t === 'again') begin(lesson);
  else if (t === 'nextl') begin(lesson + 1);
  else if (t === 'exit' || (t === 'next' && steps[step].last)) { if (lesson >= 0 && t === 'next') combos(true); else { menu = false; step = -1; lesson = -1; render(); } }
  else go(t === 'next' ? 1 : -1);
});
// watch for the step being done: a tick, then on to the next a moment later
setInterval(() => {
  ticks++;
  if (step < 0 || menu) return;
  const s = steps[step];
  if (!doneAt && !s.last && s.done && s.done(base)) { doneAt = ticks; render(); }
  else if (doneAt && ticks - doneAt > 6 && !s.last) go(1);   // (a second and a half to see the tick)
}, 250);
$('#tutBtn').addEventListener('click', () => { $('#welcome').classList.add('gone'); tutorial(true); });
const cb = $('#combosBtn'); if (cb) cb.addEventListener('click', () => combos(true));
const hb = $('#helpCombos'); if (hb) hb.addEventListener('click', () => combos(true));
