// The Adjust panel: sliders built from SPEC, and Journey's narration.
import { S } from '../state.js';
import { ACC_WORDS, HIT_WORDS, NAMES } from '../journey/cast.js';
import { J } from '../journey/core.js';
import { PACE, paceName } from '../journey/pace.js';
import { BASE, SOURCES, SPEC, jumpVal, presets } from '../presets.js';
import { setJourney } from './controls.js';
import { toast } from './toast.js';
import { $, clone } from '../util.js';
import { MEDIA } from '../media/source.js';

export function updateSectionUI(){
  const el = $('#jSection'); if (!el || !J.type) return;
  if (J.on && J.recipe) $('#pName').textContent = J.recipe.name;
  const L = J.lens;
  el.textContent = `Section ${J.type.label}` + (J.type.visits > 1 ? `, heard before (visit ${J.type.visits})` : ', new')
    + (J.recipe ? `, from the ${J.recipe.name} recipe` : '')
    + (J.progStep ? `, evolved ${J.progStep}×` : '')
    + (J.lead ? `. ${MEDIA.on ? `The mirror tunnel leads, on your ${MEDIA.kind}` : NAMES[J.lead]}, with ${NAMES[J.accent].toLowerCase()} ${ACC_WORDS[J.accTrig]}.` : '')
    + (L ? ` ${L.n === 2 ? 'A mirror lens' : `A ${L.n}-way kaleidoscope lens`} when it builds.` : '')
    + (J.hit ? ` ${HIT_WORDS[J.hit]}.` : '')
    + (J.lead ? (J.style === 'cut' ? ' Changes cut in on the bar line.' : ' Changes fade in.') : '')
    + (J.pace !== undefined ? ` Pace: ${paceName(J.pace)}, pulsing ${PACE.div === 4 ? 'once a bar' : PACE.div === 2 ? 'every other beat' : 'on every beat'}.` : '');
}
// sliders
export const sliders = {};
let lastGroup = '';
const optHTML = SOURCES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
for (const s of SPEC) {
  if (s.g !== lastGroup) { const h = document.createElement('h2'); h.textContent = s.g; $('#sliders').appendChild(h); lastGroup = s.g; }
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<label for="s_${s.k}">${s.label}</label><output id="o_${s.k}"></output>
    <input type="range" id="s_${s.k}" min="${s.min}" max="${s.max}" step="${s.step}">
    <div class="mod"><select aria-label="${s.label} movement">${optHTML}</select>
    <input type="range" class="depth" min="0.02" max="1" step="0.01" aria-label="${s.label} movement amount"></div>`;
  $('#sliders').appendChild(row);
  const input = row.querySelector('input'), out = row.querySelector('output');
  const sel = row.querySelector('select'), depth = row.querySelector('.depth');
  input.addEventListener('input', () => { S.active[s.k] = +input.value; });
  sel.addEventListener('change', () => {
    if (sel.value === 'none') delete S.active.mods[s.k];
    else S.active.mods[s.k] = {src: sel.value, amt: S.active.mods[s.k] ? S.active.mods[s.k].amt : .25};
    if (sel.value === 'jump') jumpVal[s.k] = Math.random()*2 - 1;
    syncSliders();
  });
  depth.addEventListener('input', () => { if (S.active.mods[s.k]) S.active.mods[s.k].amt = +depth.value; });
  sliders[s.k] = {input, out, s, sel, depth, row};
}
export function syncSliders(){
  for (const k in sliders) {
    const {input, out, s, sel, depth, row} = sliders[k], m = S.active.mods[k];
    input.value = S.active[k]; out.textContent = (+S.active[k]).toFixed(s.step < .01 ? 3 : s.step >= 1 ? 0 : 2);
    sel.value = m ? m.src : 'none'; depth.value = m ? m.amt : .25; row.classList.toggle('moving', !!m);
  }
}
syncSliders();
$('#jBias').addEventListener('input', e => { J.bias = +e.target.value;
  $('#jBiasOut').textContent = J.bias < .35 ? 'Calm' : J.bias > .65 ? 'Intense' : 'Balanced'; });
$('#jSpeed').addEventListener('input', e => { J.speed = +e.target.value; $('#jSpeedOut').textContent = J.speed.toFixed(2) + '×'; });
setJourney(true, 'fresh');
$('#react').addEventListener('input', e => $('#reactOut').textContent = (+e.target.value).toFixed(2));
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
