// The groovebox's tab in the DJ panel (audio/groove.js): a drum grid, an acid bass line, and their knobs, for the mouse.
import { GB, NOTES, PRESETS, VOICES, audition, clearPattern, grooveToggle, heardStep, levels, loadPreset, locked, save, setBpm, setKit, setVoice, tempo, voiceParams } from '../audio/groove.js';
import { KIT_NAMES, PARAMS, VOICES as KV } from '../audio/engine/inst/drums.js';
import { el, knob, slider } from './widgets.js';

let box = null, lastStep = -2, cells = [], leds = [], pick = 'kick';
const pct = v => Math.round(v*100) + '';
export function buildGroove(container){
  box = container;
  const top = el('div', 'gtop');
  top.innerHTML = `<button class="gplay" aria-label="Play">▶ Play</button>
    <button class="gsync" aria-pressed="${GB.sync}" title="Lock to the master (the lead deck, or your taps): its tempo, its 16ths and bars">Sync to the master</button>
    <span class="tl">Tempo</span>`;
  const bpm = slider('gbpm', 90, 150, 1, 128, 'Tempo', v => setBpm(v), GB.bpm);
  const pre = el('select', 'gpre'); pre.setAttribute('aria-label', 'Starter pattern');
  pre.innerHTML = '<option value="">Pattern…</option>' + Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('');
  pre.addEventListener('change', () => { if (pre.value) { loadPreset(pre.value); paint(); voiceBar(); } pre.value = ''; });
  const clr = el('button', 'gclr', 'Clear'); clr.addEventListener('click', () => { clearPattern(); paint(); });
  const kitSel = el('select', 'gkit'); kitSel.setAttribute('aria-label', 'Drum kit');
  kitSel.innerHTML = KIT_NAMES.map(k => `<option>${k}</option>`).join(''); kitSel.value = GB.kit;
  kitSel.addEventListener('change', () => { setKit(kitSel.value); voiceBar(); });
  top.append(bpm, el('span', 'gbv', ''), pre, clr, el('span', 'tl', 'Kit'), kitSel);
  top.querySelector('.gplay').addEventListener('click', () => { grooveToggle(); paint(); });
  top.querySelector('.gsync').addEventListener('click', e => { GB.sync = !GB.sync; e.target.setAttribute('aria-pressed', GB.sync); save(); });

  // the drums: a row a voice (its name mutes it), a cell a step: off, on, accented
  const drums = el('div', 'gdrums'); cells = []; leds = [];
  // a row of lights over each grid, the step being heard lit (the sync light), the 1 of each beat marked
  const ledRow = (g, mute) => { g.append(el('span', 'glab small', 'Step')); if (mute) g.append(el('span')); for (let i = 0; i < 16; i++) { const l = el('i', 'gled' + (i % 4 === 0 ? ' g4' : '')); l.dataset.i = i; g.append(l); leds.push(l); } };
  ledRow(drums, true);
  for (const [v, name] of VOICES) {
    // the name picks the voice to shape (and plays it); M mutes it
    const lab = el('button', 'glab', name); lab.title = 'Shape this voice (its knobs are above), and hear it'; lab.addEventListener('click', () => { pick = v; audition(v); voiceBar(); paint(); });
    const mu = el('button', 'gmute', 'M'); mu.title = 'Mute or unmute'; mu.addEventListener('click', () => { GB.mute[v] = !GB.mute[v]; save(); paint(); });
    lab.dataset.v = v; mu.dataset.v = v; drums.append(lab, mu);
    for (let i = 0; i < 16; i++) {
      const c = el('button', 'gc' + (i % 4 === 0 ? ' g4' : '')); c.setAttribute('aria-label', `${name}, step ${i + 1}`);
      c.addEventListener('click', () => { GB[v][i] = (GB[v][i] + 1) % 3; save(); paint(); });
      c.dataset.v = v; c.dataset.i = i; drums.append(c); cells.push(c);
    }
  }
  // the bass: a note a step (one at a time: click it again to rest), then a row each for accent and slide
  const roll = el('div', 'groll'); ledRow(roll);
  const rowOf = (label, fn, cls) => { roll.append(el('span', 'glab small', label)); for (let i = 0; i < 16; i++) { const c = el('button', 'gc small ' + cls + (i % 4 === 0 ? ' g4' : '')); c.dataset.i = i; c.addEventListener('click', () => { fn(i); save(); paint(); }); roll.append(c); cells.push(c); } };
  NOTES.forEach(([name], n) => rowOf(name, i => { const s = GB.bass[i]; if (s.on && s.n === n) s.on = 0; else { s.on = 1; s.n = n; } }, 'gn n' + n));
  rowOf('Accent', i => { GB.bass[i].a ^= 1; }, 'ga');
  rowOf('Slide', i => { GB.bass[i].s ^= 1; }, 'gs');
  const knobs = el('div', 'gknobs'), K = (l, k, fmt = pct) => knob(l, 0, 1, .5, fmt, v => { GB[k] = v; levels(); save(); }, GB[k]);
  const wave = el('button', 'gwave'), oct = el('button', 'goct'), eng = el('button', 'geng');
  eng.title = 'Play the bass line on the acid bass (303), or on the Synth (its sound: pick a bass preset there)';
  eng.addEventListener('click', () => { GB.bassEng = GB.bassEng === 'synth' ? 'acid' : 'synth'; save(); sw(); });
  const sw = () => { wave.textContent = GB.wave === 'square' ? 'Square' : 'Saw'; oct.textContent = `Oct ${GB.oct > 0 ? '+' : ''}${GB.oct}`; eng.textContent = GB.bassEng === 'synth' ? 'On: Synth' : 'On: 303'; };
  wave.addEventListener('click', () => { GB.wave = GB.wave === 'square' ? 'sawtooth' : 'square'; save(); sw(); });
  oct.addEventListener('click', () => { GB.oct = GB.oct >= 1 ? -1 : GB.oct + 1; save(); sw(); }); sw();
  knobs.append(K('Cutoff', 'cut'), K('Reso', 'res'), K('Env', 'env'), K('Decay', 'decay'), wave, oct, eng,
    knob('Swing', 0, 1, 0, pct, v => { GB.swing = v; save(); }, GB.swing), K('Drums', 'drums'), K('Bass', 'synth'), K('Volume', 'level'));
  const body = el('div', 'gbody'); body.append(drums, roll, knobs);
  box.append(top, el('div', 'gvoice'), body); voiceBar(); paint();
}
// the picked voice's knobs: tune, decay, tone, drive, level, pan and its own character (punch, snap, metal…)
function voiceBar(){
  const bar = box && box.querySelector('.gvoice'); if (!bar) return;
  const V = KV.find(v => v.key === pick), p = voiceParams(pick); bar.textContent = '';
  bar.append(el('b', '', V.label));
  for (const P of PARAMS) {
    const label = P.key === 'x' ? V.x : P.label, f = P.unit === 'st' ? v => (v > 0 ? '+' : '') + Math.round(v) : P.unit === 'pan' ? v => Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100)
      : P.unit === '×' ? v => v.toFixed(2) + '×' : v => Math.round(v*100) + '%';
    const snap = P.unit === 'st' ? Math.round : x => x;
    bar.append(P.log ? knob(label, 0, 1, Math.log(P.def/P.min)/Math.log(P.max/P.min), u => f(P.min*Math.pow(P.max/P.min, u)), u => setVoice(pick, P.key, P.min*Math.pow(P.max/P.min, u)), Math.log(p[P.key]/P.min)/Math.log(P.max/P.min))
      : knob(label, P.min, P.max, P.def, f, v => setVoice(pick, P.key, snap(v)), p[P.key]));
  }
  const hear = el('button', 'ghear', '▶ Hear'); hear.addEventListener('click', () => audition(pick)); bar.append(hear);
  const k = box.querySelector('.gkit'); if (k) k.value = GB.kit;
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
  box.querySelectorAll('.glab[data-v]').forEach(l => { l.classList.toggle('muted', !!GB.mute[l.dataset.v]); l.classList.toggle('sel', l.dataset.v === pick); });
  box.querySelectorAll('.gmute').forEach(m => m.setAttribute('aria-pressed', !!GB.mute[m.dataset.v]));
  const p = box.querySelector('.gplay'); p.textContent = GB.playing ? '❚❚ Stop' : '▶ Play'; p.setAttribute('aria-label', GB.playing ? 'Stop' : 'Play');
}
// each frame while the panel shows it: the playhead, and the tempo it's at (the lead deck's when locked to it)
export function drawGroove(){
  if (!box || box.hidden) return;
  const s = heardStep();
  if (s !== lastStep) { lastStep = s; for (const c of cells) c.classList.toggle('now', +c.dataset.i === s); for (const l of leds) l.classList.toggle('on', +l.dataset.i === s); }
  const L = locked(), p = box.querySelector('.gplay'), lab = GB.playing ? '❚❚ Stop' : '▶ Play';
  if (p.textContent !== lab) { p.textContent = lab; p.setAttribute('aria-label', GB.playing ? 'Stop' : 'Play'); }
  box.querySelector('.gbv').textContent = `${tempo().toFixed(1)} BPM${L ? ', locked to ' + (L.tap ? 'your taps' : 'deck ' + 'AB'[L.d.i]) : ''}`;
  box.querySelector('.gbpm').disabled = !!L;
}
// for the sync strip (ui/dj.js): playing, the step heard, the tempo, and what it's locked to (or null)
export function grooveState(){ const L = locked(); return {playing: GB.playing, step: heardStep(), bpm: tempo(), locked: L ? (L.tap ? 'your taps' : 'deck ' + 'AB'[L.d.i]) : null}; }

