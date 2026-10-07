// The groovebox's tab in the DJ panel (audio/groove.js): a drum grid, an acid bass line, and their knobs, for the mouse.
import { GB, NOTES, PRESETS, VOICES, clearPattern, grooveToggle, heardStep, levels, loadPreset, save, tempo } from '../audio/groove.js';
import { DJ } from '../audio/dj.js';
import { el, knob, slider } from './widgets.js';

let box = null, lastStep = -2, cells = [];
const pct = v => Math.round(v*100) + '';
export function buildGroove(container){
  box = container;
  const top = el('div', 'gtop');
  top.innerHTML = `<button class="gplay" aria-label="Play">▶ Play</button>
    <button class="gsync" aria-pressed="${GB.sync}" title="Lock to the deck the visuals follow: its tempo, its 16ths and bars">Sync to the decks</button>
    <span class="tl">Tempo</span>`;
  const bpm = slider('gbpm', 90, 150, 1, 128, 'Tempo', v => { GB.bpm = v; save(); }, GB.bpm);
  const pre = el('select', 'gpre'); pre.setAttribute('aria-label', 'Starter pattern');
  pre.innerHTML = '<option value="">Pattern…</option>' + Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('');
  pre.addEventListener('change', () => { if (pre.value) { loadPreset(pre.value); paint(); } pre.value = ''; });
  const clr = el('button', 'gclr', 'Clear'); clr.addEventListener('click', () => { clearPattern(); paint(); });
  top.append(bpm, el('span', 'gbv', ''), pre, clr);
  top.querySelector('.gplay').addEventListener('click', () => { grooveToggle(); paint(); });
  top.querySelector('.gsync').addEventListener('click', e => { GB.sync = !GB.sync; e.target.setAttribute('aria-pressed', GB.sync); save(); });

  // the drums: a row a voice (its name mutes it), a cell a step: off, on, accented
  const drums = el('div', 'gdrums'); cells = [];
  for (const [v, name] of VOICES) {
    const lab = el('button', 'glab', name); lab.title = 'Mute or unmute'; lab.addEventListener('click', () => { GB.mute[v] = !GB.mute[v]; save(); paint(); });
    lab.dataset.v = v; drums.append(lab);
    for (let i = 0; i < 16; i++) {
      const c = el('button', 'gc' + (i % 4 === 0 ? ' g4' : '')); c.setAttribute('aria-label', `${name}, step ${i + 1}`);
      c.addEventListener('click', () => { GB[v][i] = (GB[v][i] + 1) % 3; save(); paint(); });
      c.dataset.v = v; c.dataset.i = i; drums.append(c); cells.push(c);
    }
  }
  // the bass: a note a step (one at a time: click it again to rest), then a row each for accent and slide
  const roll = el('div', 'groll');
  const rowOf = (label, fn, cls) => { roll.append(el('span', 'glab small', label)); for (let i = 0; i < 16; i++) { const c = el('button', 'gc small ' + cls + (i % 4 === 0 ? ' g4' : '')); c.dataset.i = i; c.addEventListener('click', () => { fn(i); save(); paint(); }); roll.append(c); cells.push(c); } };
  NOTES.forEach(([name], n) => rowOf(name, i => { const s = GB.bass[i]; if (s.on && s.n === n) s.on = 0; else { s.on = 1; s.n = n; } }, 'gn n' + n));
  rowOf('Accent', i => { GB.bass[i].a ^= 1; }, 'ga');
  rowOf('Slide', i => { GB.bass[i].s ^= 1; }, 'gs');
  const knobs = el('div', 'gknobs'), K = (l, k, fmt = pct) => knob(l, 0, 1, .5, fmt, v => { GB[k] = v; levels(); save(); }, GB[k]);
  const wave = el('button', 'gwave'), oct = el('button', 'goct');
  const sw = () => { wave.textContent = GB.wave === 'square' ? 'Square' : 'Saw'; oct.textContent = `Oct ${GB.oct > 0 ? '+' : ''}${GB.oct}`; };
  wave.addEventListener('click', () => { GB.wave = GB.wave === 'square' ? 'sawtooth' : 'square'; save(); sw(); });
  oct.addEventListener('click', () => { GB.oct = GB.oct >= 1 ? -1 : GB.oct + 1; save(); sw(); }); sw();
  knobs.append(K('Cutoff', 'cut'), K('Reso', 'res'), K('Env', 'env'), K('Decay', 'decay'), wave, oct,
    knob('Swing', 0, 1, 0, pct, v => { GB.swing = v; save(); }, GB.swing), K('Drums', 'drums'), K('Bass', 'synth'), K('Volume', 'level'));
  const body = el('div', 'gbody'); body.append(drums, roll, knobs);
  box.append(top, body); paint();
}
// what the grids and buttons show
function paint(){
  if (!box) return;
  for (const c of cells) {
    const i = +c.dataset.i, v = c.dataset.v;
    if (v) { const h = GB[v][i]; c.classList.toggle('on', h > 0); c.classList.toggle('acc', h === 2); c.classList.toggle('muted', !!GB.mute[v]); continue; }
    const s = GB.bass[i], k = c.className.match(/\bn(\d)\b/);
    if (k) c.classList.toggle('on', !!s.on && s.n === +k[1]);
    else if (c.classList.contains('ga')) c.classList.toggle('on', !!s.a);
    else if (c.classList.contains('gs')) c.classList.toggle('on', !!s.s);
  }
  box.querySelectorAll('.glab[data-v]').forEach(l => l.classList.toggle('muted', !!GB.mute[l.dataset.v]));
  const p = box.querySelector('.gplay'); p.textContent = GB.playing ? '❚❚ Stop' : '▶ Play'; p.setAttribute('aria-label', GB.playing ? 'Stop' : 'Play');
}
// each frame while the panel shows it: the playhead, and the tempo it's at (the lead deck's when locked to it)
export function drawGroove(){
  if (!box || box.hidden) return;
  const s = heardStep();
  if (s !== lastStep) { lastStep = s; for (const c of cells) c.classList.toggle('now', +c.dataset.i === s); }
  const L = GB.sync && DJ.lead && DJ.lead.playing && DJ.lead.ana && DJ.lead.ana.map;
  box.querySelector('.gbv').textContent = `${tempo().toFixed(1)} BPM${L ? ', locked to deck ' + 'AB'[DJ.lead.i] : ''}`;
  box.querySelector('.gbpm').disabled = !!L;
}
