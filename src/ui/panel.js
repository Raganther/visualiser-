// The Adjust panel: sliders built from SPEC, and Journey's narration.
import { S } from '../state.js';
import { ACC_WORDS, HIT_WORDS, NAMES, OBJECT_WORDS, sceneWords } from '../journey/cast.js';
import { J } from '../journey/core.js';
import { KAL_KINDS, KAL_WORDS } from '../journey/extras.js';
import { PACE, paceName } from '../journey/pace.js';
import { BASE, SOURCES, SPEC, jumpVal, presets } from '../presets.js';
import { setJourney } from './controls.js';
import { toast } from './toast.js';
import { $, clone } from '../util.js';
import { F } from '../audio/foresee.js';
import { TUNE } from '../tuning.js';
import { MEDIA } from '../media/source.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { solo } from './presets.js';
import { TW_SIZE, TW_SPEED, TW_SRC, knobs, setTweak, twOf } from '../scene/tweaks.js';

const PAL_WORDS = {triad: 'three far-apart hues', analogous: 'neighbouring hues', split: 'one hue against two', contrast: 'opposites'};
export function updateSectionUI(){
  const el = $('#jSection'); if (!el || !J.type) return;
  if (J.on && J.recipe) $('#pName').textContent = J.recipe.name;
  const L = J.lens;
  el.textContent = `Section ${J.type.label}` + (J.type.visits > 1 ? `, heard before (visit ${J.type.visits})` : ', new')
    + (J.recipe ? `, from the ${J.recipe.name} recipe` : '')
    + (J.progStep ? `, evolved ${J.progStep}×` : '')
    + (J.lead ? `. ${MEDIA.on ? `The mirror tunnel leads, on your ${MEDIA.kind}` : NAMES[J.lead]}, with ${NAMES[J.accent].toLowerCase()} ${ACC_WORDS[J.accTrig]}.` : '')
    + (J.centre && !MEDIA.on ? ` ${OBJECT_WORDS[J.centre]}.` : '')
    + ((J.worldHold || J.world) === 'cosmos' && !MEDIA.on ? ' The cosmos: the camera flies with the track, drawn in by builds and let go on drops, each section on the galaxy arm that suits it.' + (J.worldHold ? ' The Cosmos lab is holding it here: switch it off below to let Journey move between worlds.' : '') : '')
    + (J.lead && sceneWords() ? ` ${sceneWords()}` : '')
    + (J.kal && !MEDIA.on ? ` A ${J.kal.mode === 1 ? '' : J.kal.n + '-way '}${KAL_KINDS[J.kal.mode || 0]} folds ${KAL_WORDS[J.kal.where]}${J.kal.turn ? ', turning' : ''}.` : L && !J.centre ? ` ${L.n === 2 ? 'A mirror lens' : `A ${L.n}-way kaleidoscope lens`} when it builds.` : '')
    + (J.grain ? ' Film grain.' : '')
    + (Object.keys(J.tw || {}).length ? ' ' + Object.entries(J.tw).map(([k, t]) => `${NAMES[k]} ${t.speed ? (t.speed > 1 ? 'faster' : 'slower') : ''}${t.speed && t.size ? ' and ' : ''}${t.size ? (t.size > 1 ? 'bigger' : 'smaller') : ''}`).join(', ') + ' than usual.' : '')
    + (J.hit ? ` ${HIT_WORDS[J.hit]}.` : '')
    + (J.lead ? (J.style === 'cut' ? ' Changes cut in on the bar line.' : ' Changes fade in.') : '')
    + (J.type.pal ? ` Colours: ${PAL_WORDS[J.type.pal]}.` : '')
    + (J.pace !== undefined ? ` Pace: ${paceName(J.pace)}, pulsing ${PACE.div === 4 ? 'once a bar' : PACE.div === 2 ? 'every other beat' : 'on every beat'}.` : '');
}
// sliders
export const sliders = {};
const twRows = {};   // each layer's row of its own speed, size and sound
let lastGroup = '';
const SOLO = new Set(['Layers', 'Hits', 'Worlds', 'Media and objects']);   // the groups that are pictures, which Solo can show alone
const optHTML = SOURCES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
for (const s of SPEC) {
  if (s.g !== lastGroup) { const h = document.createElement('h2'); h.textContent = s.g; $('#sliders').appendChild(h); lastGroup = s.g; }
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<label for="s_${s.k}">${s.label}</label><output id="o_${s.k}"></output>${SOLO.has(s.g) ? `<button class="solo" aria-label="Show ${s.label} alone">Solo</button>` : ''}
    <input type="range" id="s_${s.k}" min="${s.min}" max="${s.max}" step="${s.step}">
    <div class="mod"><select aria-label="${s.label} movement">${optHTML}</select>
    <input type="range" class="depth" min="0.02" max="1" step="0.01" aria-label="${s.label} movement amount"></div>`;
  $('#sliders').appendChild(row);
  const input = row.querySelector('input'), out = row.querySelector('output');
  const sel = row.querySelector('select'), depth = row.querySelector('.depth');
  input.addEventListener('input', () => { S.active[s.k] = +input.value; });
  if (SOLO.has(s.g)) row.querySelector('.solo').onclick = () => solo(s.k);
  sel.addEventListener('change', () => {
    if (sel.value === 'none') delete S.active.mods[s.k];
    else S.active.mods[s.k] = {src: sel.value, amt: S.active.mods[s.k] ? S.active.mods[s.k].amt : .25};
    if (sel.value === 'jump') jumpVal[s.k] = Math.random()*2 - 1;
    if (J.on) J.userMods[s.k] = S.active.mods[s.k] ? {...S.active.mods[s.k]} : null;   // Journey keeps your choice from section to section
    syncSliders();
  });
  depth.addEventListener('input', () => { const m = S.active.mods[s.k]; if (!m) return; m.amt = +depth.value; if (J.on) J.userMods[s.k] = {...m}; });
  sliders[s.k] = {input, out, s, sel, depth, row};
  const lv = byKey[s.k]; if (lv && lv.kind === 'layer') twRow(row, lv);
}
// under a layer's slider, while it's on: its own speed, size and the sound it follows (scene/tweaks.js). Journey never
// changes these, so they're open in Journey too
function twRow(row, v){
  const kn = knobs(v), tw = document.createElement('div'); tw.className = 'tw';
  const rng = (f, [a, b], l) => kn.includes(f) ? `<label>${l}<input type="range" data-f="${f}" min="${a}" max="${b}" step="0.05" aria-label="${v.label} ${l.toLowerCase()}"></label>` : '';
  tw.innerHTML = rng('speed', TW_SPEED, 'Speed') + rng('size', TW_SIZE, 'Size')
    + `<label>Follows<select data-f="src" aria-label="${v.label} follows">${TW_SRC.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>`;
  tw.addEventListener('input', e => { const f = e.target.dataset.f; if (f) setTweak(v.key, f, f === 'src' ? e.target.value : +e.target.value); });
  row.appendChild(tw); twRows[v.key] = tw;
}
function syncTweaks(){
  for (const k in twRows) { const t = twOf(k) || {};
    for (const el of twRows[k].querySelectorAll('[data-f]')) el.value = el.dataset.f === 'src' ? t.src || 'auto' : t[el.dataset.f] ?? 1;
    twRows[k].classList.toggle('set', !!twOf(k)); }
}
export function syncSliders(){
  for (const k in sliders) {
    const {input, out, s, sel, depth, row} = sliders[k], m = S.active.mods[k];
    input.value = S.active[k]; out.textContent = (+S.active[k]).toFixed(s.step < .01 ? 3 : s.step >= 1 ? 0 : 2);
    sel.value = m ? m.src : 'none'; depth.value = m ? m.amt : .25; row.classList.toggle('moving', !!m);
  }
  syncTweaks();
}
syncSliders();
/* what's on screen and what set it (twice a second from main.js), so anything over a world can be traced to its slider;
   the rows of the pictures on screen are marked, in Journey too */
export function showNow(e){
  const on = vs => vs.filter(v => e[v.key] > .05).map(v => v.label);
  const w = on(WORLD_VISUALS), l = on(LAYER_VISUALS), h = on(HIT_VISUALS), o = on(OBJECT_VISUALS);
  const parts = [w.length ? w.join(' and ') : 'no world', l.length ? `layers ${l.join(', ')}` : 'no layers'];
  if (h.length) parts.push(`hits ${h.join(', ')}`);
  if (o.length) parts.push(o.join(', '));
  if (e.sym >= 1.5) parts.push(`a ${Math.round(e.sym)}-way kaleidoscope`);
  $('#onNow').textContent = `${parts.join('; ')}. Set by ${J.on ? `Journey${J.recipe ? `, from the ${J.recipe.name} recipe` : ''}` : `the ${S.active.name} preset`}.`;
  for (const k in sliders) if (SOLO.has(sliders[k].s.g)) sliders[k].row.classList.toggle('on', e[k] > .05);
}
// the set arc: over a set of this many minutes, from now, Journey warms up, peaks about two-thirds in and winds down
$('#jArc').addEventListener('change', e => { J.arcMins = +e.target.value; J.arcStart = performance.now(); $('#jArcOut').textContent = J.arcMins ? 'from now' : 'Off'; });
$('#jBias').addEventListener('input', e => { J.bias = +e.target.value;
  $('#jBiasOut').textContent = J.bias < .35 ? 'Calm' : J.bias > .65 ? 'Intense' : 'Balanced'; });
$('#jSpeed').addEventListener('input', e => { J.speed = +e.target.value; $('#jSpeedOut').textContent = J.speed.toFixed(2) + '×'; });
setJourney(true, 'fresh');
$('#react').addEventListener('input', e => $('#reactOut').textContent = (+e.target.value).toFixed(2));
// Sync: this device's speaker and screen delays, remembered between visits
const showSync = v => { S.syncMs = v; $('#sync').value = v; $('#syncOut').textContent = (v > 0 ? '+' : '') + v + ' ms'; };
try { showSync(+(localStorage.getItem('afterglow.syncMs') || 0)); } catch (e) {}
$('#sync').addEventListener('input', e => { showSync(+e.target.value); try { localStorage.setItem('afterglow.syncMs', S.syncMs); } catch (e) {} });
// tap to sync: tapping on the kick as it's heard, against the beat map's beats (audio/foresee.js): how far the speakers are
// behind what the browser says (Bluetooth), the middle of several taps, becomes the Sync setting
const taps = [];
$('#tapSync').addEventListener('pointerdown', e => {
  e.preventDefault();
  const M = F.map, x = F.at && F.at(), out = $('#tapOut');
  if (!M || x == null) { out.textContent = 'needs a track playing (one with a steady beat)'; return; }
  const h = x - (TUNE.sync.displayMs - S.syncMs)/1000, B = M.beats, T = TUNE.sync;   // where the browser says the speakers are
  const g = h - T.tapLead - T.tapMid;   // (the beat heard is looked for around the usual delay, so a long one isn't taken for the next beat)
  let lo = 0, hi = B.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m] < g) lo = m + 1; else hi = m; }
  const b = lo > 0 && Math.abs(B[lo - 1] - g) < Math.abs(B[lo] - g) ? B[lo - 1] : B[lo];
  const now = performance.now(); if (taps.length && now - taps[taps.length - 1].at > 3000) taps.length = 0;   // (a pause: start again)
  taps.push({at: now, d: h - T.tapLead - b});
  if (taps.length < T.taps) { out.textContent = `tap ${taps.length} of ${T.taps}…`; return; }
  const d = taps.map(t => t.d).sort((a, b) => a - b), mid = d[d.length >> 1];
  const ms = Math.max(-200, Math.min(400, Math.round(mid*1000/5)*5)); taps.length = 0;
  showSync(ms); try { localStorage.setItem('afterglow.syncMs', ms); } catch (e) {}
  out.textContent = `set: the visuals ${ms > 0 ? ms + ' ms later' : ms < 0 ? -ms + ' ms earlier' : 'as they were'}`;
});
$('#resetBtn').onclick = () => {
  const i = presets.indexOf(S.active);
  if (i >= 0) { Object.assign(S.active, clone(BASE[i])); syncSliders(); toast('Preset reset'); }
};
$('#copyBtn').onclick = async () => {
  const obj = {}; for (const s of SPEC) obj[s.k] = +(+S.active[s.k]).toFixed(3);
  obj.reactivity = +$('#react').value;
  obj.mods = S.active.mods;
  const txt = JSON.stringify({name: S.active.name, ...obj});
  try { await navigator.clipboard.writeText(txt); toast('Settings copied'); }
  catch(e) { const ta = $('#copyOut'); ta.style.display = 'block'; ta.value = txt; ta.select(); }
};
