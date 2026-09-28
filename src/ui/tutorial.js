// The tutorial (T, or the button): a card at the top of the screen with one thing to try at a time. It watches what you do
// and moves on by itself once you've done it (a tick first), or you step with its buttons. It walks through the keyboard
// (ui/keys.js): stopping Journey, the groups and their numbers, a scene, the objects, the kaleidoscope, a like, handing back
// to Journey and steering it, and flying the cosmos. Nothing it asks is kept apart from what you do.
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { curP } from '../presets.js';
import { keyMode } from './keys.js';
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
  {say: `The cosmos is a place to fly: ${k('W')} ${k('5')} puts it on, then ${k('C')} and a key: ${k('5')} an eclipse, ${k('L')} land, ${k('J')} jump to another star.`,
    done: () => curP.cosmos > .3 && keyMode() === 'c'},
  {say: `That's the lot. ${k('?')} shows every key any time, ${k('Esc')} leaves a group, and ${k('T')} starts this again. Enjoy.`, last: true},
];
let step = -1, base = null, doneAt = 0, ticks = 0;   // doneAt: the check (of the watcher's, every quarter second) it was done at
export const tutorialOn = () => step >= 0;
export function tutorial(on = step < 0){
  if (on) $('#welcome').classList.add('gone');   // (the welcome's words would sit under the card)
  step = on ? 0 : -1; enter(); render();
}
function enter(){ const s = STEPS[step]; base = s && s.start ? s.start() : {}; doneAt = s && s.already && s.already() ? ticks || 1 : 0; }
function go(d){ step = Math.max(0, Math.min(STEPS.length - 1, step + d)); enter(); render(); }
function render(){
  const el = $('#tutorial'); if (!el) return;
  if (step < 0) { el.hidden = true; return; }
  const s = STEPS[step];
  el.hidden = false;
  el.innerHTML = `<div class="tstep">${step + 1} of ${STEPS.length}</div><p>${s.say}</p>${doneAt ? `<p class="tok">✓ ${s.ok || 'Done.'}</p>` : ''}
    <div class="tbtns"><button data-t="back"${step ? '' : ' disabled'}>Back</button><button data-t="next">${s.last ? 'Finish' : doneAt ? 'Next' : 'Skip'}</button><button data-t="exit" aria-label="Leave the tutorial">✕</button></div>`;
}
$('#tutorial').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.t === 'exit' || (b.dataset.t === 'next' && STEPS[step].last)) tutorial(false);
  else go(b.dataset.t === 'next' ? 1 : -1);
});
// watch for the step being done: a tick, then on to the next a moment later
setInterval(() => {
  ticks++;
  if (step < 0) return;
  const s = STEPS[step];
  if (!doneAt && !s.last && s.done && s.done(base)) { doneAt = ticks; render(); }
  else if (doneAt && ticks - doneAt > 6 && !s.last) go(1);   // (a second and a half to see the tick)
}, 250);
$('#tutBtn').addEventListener('click', () => { $('#welcome').classList.add('gone'); tutorial(true); });
