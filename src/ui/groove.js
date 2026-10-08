// The groovebox's section in the DJ panel (audio/groove.js), the sequencer for the mouse: patterns and the song, the drum grid
// (each row its own length, in pages of 16), a picked voice's knobs, a step's own settings, and the bass line or the synth's piano roll.
import { CONDS, GB, MAX, NOTES, PRESETS, VOICES, audition, clearPattern, copyPattern, euclid, grooveToggle, heardAt, lenOf, levels, loadPreset, locked, pastePattern,
  pat, pickPattern, recHit, save, setBpm, setKit, setLen, setStepX, setVoice, stepX, tempo, toggleNote, voiceParams, heardStep } from '../audio/groove.js';
import { KIT_NAMES, PARAMS, VOICES as KV } from '../audio/engine/inst/drums.js';
import { el, knob, slider } from './widgets.js';
import { toast } from './toast.js';

let box = null, cells = [], leds = [], pick = 'kick', page = 0, edit = false, sel = null, lane = 'bass', rollLo = 48, noteLen = 2, lastKey = '';
const pct = v => Math.round(v*100) + '', SLOTS = 'ABCDEFGH', NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const nn = n => NAMES[n % 12] + (Math.floor(n/12) - 1);
const btn = (cls, text, title, fn) => { const b = el('button', cls, text); if (title) b.title = title; b.addEventListener('click', fn); return b; };
export function buildGroove(container){
  box = container;
  // the top bar: play, sync, tempo, starters, clear, kit
  const top = el('div', 'gtop');
  top.innerHTML = `<button class="gplay" aria-label="Play">▶ Play</button>
    <button class="gsync" aria-pressed="${GB.sync}" title="Lock to the master (the lead deck, or your taps): its tempo, its 16ths and bars">Sync to the master</button>
    <span class="tl">Tempo</span>`;
  const bpm = slider('gbpm', 90, 150, 1, 128, 'Tempo', v => setBpm(v), GB.bpm);
  const pre = el('select', 'gpre'); pre.setAttribute('aria-label', 'Starter pattern');
  pre.innerHTML = '<option value="">Starter…</option>' + Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('');
  pre.addEventListener('change', () => { if (pre.value) { loadPreset(pre.value); paint(); voiceBar(); } pre.value = ''; });
  const kitSel = el('select', 'gkit'); kitSel.setAttribute('aria-label', 'Drum kit');
  kitSel.innerHTML = KIT_NAMES.map(k => `<option>${k}</option>`).join(''); kitSel.value = GB.kit;
  kitSel.addEventListener('change', () => { setKit(kitSel.value); voiceBar(); });
  top.append(bpm, el('span', 'gbv', ''), pre, btn('gclr', 'Clear', 'Clear this pattern', () => { clearPattern(); paint(); }), el('span', 'tl', 'Kit'), kitSel);
  top.querySelector('.gplay').addEventListener('click', () => { grooveToggle(); paint(); });
  top.querySelector('.gsync').addEventListener('click', e => { GB.sync = !GB.sync; e.target.setAttribute('aria-pressed', GB.sync); save(); });

  // the pattern bar: eight patterns, copy and paste, the song, fill, record, step editing, the page
  const pb = el('div', 'gpat');
  pb.append(el('span', 'tl', 'Pattern'));
  for (let i = 0; i < 8; i++) { const b = btn('gslot', SLOTS[i], `Pattern ${SLOTS[i]} (while playing, it starts at the next bar)`, () => { pickPattern(i); paint(); }); b.dataset.i = i; pb.append(b); }
  pb.append(btn('gcopy', 'Copy', 'Copy this pattern', () => { copyPattern(); toast('Pattern ' + SLOTS[GB.pat] + ' copied'); }),
    btn('gpaste', 'Paste', 'Paste the copied pattern over this one', () => { if (pastePattern()) paint(); }));
  const song = btn('gsong', 'Song', 'Play the chain of patterns, a bar each, round and round', () => { GB.songOn = !GB.songOn; save(); paint(); });
  const chain = el('span', 'gchain');
  pb.append(song, chain, btn('gadd', '+ Bar', 'Add this pattern to the end of the song', () => { GB.song.push(GB.pat); save(); paint(); }),
    btn('gunc', '⌫', 'Take the last bar off the song', () => { GB.song.pop(); save(); paint(); }));
  const fill = el('button', 'gfill', 'Fill'); fill.title = 'Hold for a fill: steps set to Fill play, Not fill rest';
  fill.addEventListener('pointerdown', e => { GB.fill = true; fill.setAttribute('aria-pressed', true); fill.setPointerCapture(e.pointerId); });
  const fillOff = () => { GB.fill = false; fill.setAttribute('aria-pressed', false); }; fill.addEventListener('pointerup', fillOff); fill.addEventListener('pointercancel', fillOff);
  pb.append(fill, btn('grec', 'Rec', 'Record: while playing, a drum\'s name (or a synth key) lands on the step heard', () => { GB.rec = !GB.rec; paint(); }),
    btn('gedit', 'Edit step', 'Click a step to open its own settings (or right-click any step)', () => { edit = !edit; if (!edit) sel = null; paint(); stepBar(); }));
  pb.append(el('span', 'tl', 'Page'));
  for (let i = 0; i < 4; i++) { const b = btn('gpage', '' + (i + 1), `Steps ${i*16 + 1} to ${i*16 + 16}`, () => { page = i; paint(); }); b.dataset.i = i; pb.append(b); }

  // the drums: a row a voice (its name picks it, M mutes, Shift+M solos), a cell a step: off, on, accented
  const drums = el('div', 'gdrums'); cells = []; leds = [];
  const ledRow = (g, extra) => { g.append(el('span', 'glab small', 'Step')); if (extra) g.append(el('span')); for (let c = 0; c < 16; c++) { const l = el('i', 'gled' + (c % 4 === 0 ? ' g4' : '')); l.dataset.c = c; g.append(l); leds.push(l); } };
  ledRow(drums, true);
  for (const [v, name] of VOICES) {
    const lab = btn('glab', name, 'Shape this voice (its knobs are above) and hear it; with Rec on while playing, it records', () => { pick = v; audition(v); recHit(v); voiceBar(); paint(); });
    const mu = el('button', 'gmute', 'M'); mu.title = 'Mute (Shift: solo)';
    mu.addEventListener('click', e => { if (e.shiftKey) GB.solo = GB.solo === v ? null : v; else GB.mute[v] = !GB.mute[v]; save(); paint(); });
    lab.dataset.v = v; mu.dataset.v = v; drums.append(lab, mu);
    for (let c = 0; c < 16; c++) {
      const cell = el('button', 'gc' + (c % 4 === 0 ? ' g4' : '')); cell.setAttribute('aria-label', `${name}, step ${c + 1}`);
      cell.addEventListener('click', () => { const j = page*16 + c; if (j >= lenOf(v)) return; if (edit) { if (!GB[v][j]) GB[v][j] = 1; select(v, j); } else { GB[v][j] = (GB[v][j] + 1) % 3; if (!GB[v][j] && sel && sel.k === v && sel.j === j) sel = null; } save(); paint(); });
      cell.addEventListener('contextmenu', e => { e.preventDefault(); const j = page*16 + c; if (j >= lenOf(v)) return; if (!GB[v][j]) GB[v][j] = 1; select(v, j); save(); paint(); });
      cell.dataset.v = v; cell.dataset.c = c; drums.append(cell); cells.push(cell);
    }
  }
  // the right: the bass line or the synth's piano roll
  const right = el('div', 'gright'), lh = el('div', 'glane');
  lh.append(btn('glb', 'Bass line', 'The acid bass line (or on the synth: On: Synth)', () => { lane = 'bass'; lanes(); paint(); }),
    btn('gls', 'Synth notes', 'A piano roll for the synth: click to add a note, click it again to take it away', () => { lane = 'synth'; lanes(); paint(); }), el('span', 'glopts'));
  const roll = el('div', 'groll'), piano = el('div', 'gpiano');
  right.append(lh, roll, piano);
  ledRow(roll);
  const rowOf = (label, fn, cls) => { roll.append(el('span', 'glab small', label)); for (let c = 0; c < 16; c++) { const b = el('button', 'gc small ' + cls + (c % 4 === 0 ? ' g4' : '')); b.dataset.c = c;
    b.addEventListener('click', () => { const j = page*16 + c; if (j >= lenOf('bass')) return; if (edit) { if (!GB.bass[j].on) GB.bass[j].on = 1; select('bass', j); } else fn(j); save(); paint(); });
    b.addEventListener('contextmenu', e => { e.preventDefault(); const j = page*16 + c; if (j < lenOf('bass')) { select('bass', j); paint(); } });
    roll.append(b); cells.push(b); } };
  NOTES.forEach(([name], n) => rowOf(name, j => { const s = GB.bass[j]; if (s.on && s.n === n) s.on = 0; else { s.on = 1; s.n = n; } }, 'gn n' + n));
  rowOf('Accent', j => { GB.bass[j].a ^= 1; }, 'ga');
  rowOf('Slide', j => { GB.bass[j].s ^= 1; }, 'gs');
  buildPiano(piano);
  // the knobs: the bass's sound, swing and the levels
  const knobs = el('div', 'gknobs'), K = (l, k, fmt = pct) => knob(l, 0, 1, .5, fmt, v => { GB[k] = v; levels(); save(); }, GB[k]);
  const wave = el('button', 'gwave'), oct = el('button', 'goct'), eng = el('button', 'geng');
  eng.title = 'Play the bass line on the acid bass (303), or on the Synth (its sound: pick a bass preset there)';
  eng.addEventListener('click', () => { GB.bassEng = GB.bassEng === 'synth' ? 'acid' : 'synth'; save(); sw(); });
  const sw = () => { wave.textContent = GB.wave === 'square' ? 'Square' : 'Saw'; oct.textContent = `Oct ${GB.oct > 0 ? '+' : ''}${GB.oct}`; eng.textContent = GB.bassEng === 'synth' ? 'On: Synth' : 'On: 303'; };
  wave.addEventListener('click', () => { GB.wave = GB.wave === 'square' ? 'sawtooth' : 'square'; save(); sw(); });
  oct.addEventListener('click', () => { GB.oct = GB.oct >= 1 ? -1 : GB.oct + 1; save(); sw(); }); sw();
  knobs.append(K('Cutoff', 'cut'), K('Reso', 'res'), K('Env', 'env'), K('Decay', 'decay'), wave, oct, eng,
    knob('Swing', 0, 1, 0, pct, v => { GB.swing = v; save(); }, GB.swing), K('Drums', 'drums'), K('Bass', 'synth'), K('Volume', 'level'));
  const body = el('div', 'gbody'); body.append(drums, right, knobs);
  box.append(top, pb, el('div', 'gvoice'), el('div', 'gstep'), body); lanes(); voiceBar(); stepBar(); paint();
}
// the piano roll: two octaves from rollLo, a row a note (black keys darker), a cell a step; the length a click adds
function buildPiano(p){
  p.textContent = '';
  const head = el('div', 'gph');
  head.append(btn('gpo', 'Oct −', 'Lower', () => { rollLo = Math.max(24, rollLo - 12); buildPiano(p); paint(); }), btn('gpo', 'Oct +', 'Higher', () => { rollLo = Math.min(84, rollLo + 12); buildPiano(p); paint(); }), el('span', 'tl', 'New note'));
  const ls = el('select', 'gnl'); ls.setAttribute('aria-label', 'New note length'); ls.innerHTML = [1, 2, 3, 4, 6, 8, 16].map(n => `<option value="${n}">${n} step${n > 1 ? 's' : ''}</option>`).join(''); ls.value = noteLen;
  ls.addEventListener('change', () => { noteLen = +ls.value; }); head.append(ls);
  const grid = el('div', 'gpg');
  for (let n = rollLo + 23; n >= rollLo; n--) {
    const black = [1, 3, 6, 8, 10].includes(n % 12); grid.append(el('span', 'glab small' + (black ? ' bk' : ''), n % 12 === 0 ? nn(n) : ''));
    for (let c = 0; c < 16; c++) { const b = el('button', 'gc tiny' + (black ? ' bk' : '') + (c % 4 === 0 ? ' g4' : '')); b.dataset.c = c; b.dataset.n = n;
      b.addEventListener('click', () => { const j = page*16 + c; if (j >= lenOf('synth')) return; if (edit) { select('synth', j); paint(); return; } toggleNote(j, n, noteLen); paint(); });
      b.addEventListener('contextmenu', e => { e.preventDefault(); const j = page*16 + c; if (j < lenOf('synth')) { select('synth', j); paint(); } });
      grid.append(b); }
  }
  p.append(head, grid);
}
// which lane shows, and its length knob
function lanes(){
  box.querySelector('.groll').hidden = lane !== 'bass'; box.querySelector('.gpiano').hidden = lane !== 'synth';
  box.querySelector('.glb').setAttribute('aria-pressed', lane === 'bass'); box.querySelector('.gls').setAttribute('aria-pressed', lane === 'synth');
  const o = box.querySelector('.glopts'); o.textContent = '';
  o.append(knob('Length', 1, MAX, 16, v => Math.round(v) + '', v => { setLen(lane, v); paint(); }, lenOf(lane)));
}
// the picked voice's knobs: tune, decay, tone, drive, level, pan and its own character; then its row's length and a euclidean rhythm
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
  const hits = GB[pick].slice(0, lenOf(pick)).filter(Boolean).length;
  let rot = 0, k = hits;
  bar.append(el('span', 'gsep'), knob('Length', 1, MAX, 16, v => Math.round(v) + '', v => { setLen(pick, v); paint(); }, lenOf(pick)),
    knob('Euclid', 0, 16, 0, v => Math.round(v) + '', v => { k = Math.round(v); euclid(pick, k, rot); paint(); }, k),
    knob('Rotate', 0, 15, 0, v => Math.round(v) + '', v => { rot = Math.round(v); euclid(pick, k, rot); paint(); }, 0));
  bar.append(btn('ghear', '▶ Hear', 'Hear this voice', () => audition(pick)));
  const ks = box.querySelector('.gkit'); if (ks) ks.value = GB.kit;
}
// a step's own settings: velocity, chance, a condition, ratchets, a nudge, and locks of the voice's tune, decay and character
function select(k, j){ sel = {k, j}; stepBar(); }
function stepBar(){
  const bar = box && box.querySelector('.gstep'); if (!bar) return; bar.textContent = ''; bar.hidden = !sel;
  if (!sel) return;
  const {k, j} = sel, x = stepX(k, j) || {}, drum = KV.find(v => v.key === k), set = (key, v) => { setStepX(k, j, key, v); paint(); };
  bar.append(el('b', '', `${drum ? drum.label : k === 'bass' ? 'Bass' : 'Synth'} · step ${j + 1}`));
  if (drum) bar.append(knob('Velocity', .1, 1, .72, pct, v => set('vel', v), x.vel ?? (GB[k][j] === 2 ? 1 : .72)));
  bar.append(knob('Chance', 0, 1, 1, v => Math.round(v*100) + '%', v => set('chance', v >= .995 ? null : v), x.chance ?? 1));
  const cs = el('select', 'gcond'); cs.setAttribute('aria-label', 'Condition'); cs.innerHTML = CONDS.map(c => `<option>${c}</option>`).join(''); cs.value = x.cond || 'Always';
  cs.addEventListener('change', () => set('cond', cs.value === 'Always' ? null : cs.value)); bar.append(el('span', 'tl', 'Plays'), cs);
  if (drum) bar.append(knob('Ratchet', 1, 4, 1, v => '×' + Math.round(v), v => set('rat', Math.round(v) > 1 ? Math.round(v) : null), x.rat || 1));
  bar.append(knob('Nudge', -.5, .5, 0, v => (v > 0 ? '+' : '') + Math.round(v*100) + '%', v => set('nudge', Math.abs(v) < .02 ? null : v), x.nudge || 0));
  if (drum) { const p = voiceParams(k);
    bar.append(el('span', 'gsep'), el('span', 'tl', 'Locks'), knob('Tune', -12, 12, p.tune, v => (v > 0 ? '+' : '') + Math.round(v), v => set('tune', Math.round(v)), x.tune ?? p.tune),
      knob('Decay', .25, 4, p.decay, v => v.toFixed(2) + '×', v => set('decay', v), x.decay ?? p.decay), knob(drum.x, 0, 1, p.x, pct, v => set('x', v), x.x ?? p.x)); }
  bar.append(btn('gsx', 'Reset step', 'This step back to plain', () => { for (const key of ['vel', 'chance', 'cond', 'rat', 'nudge', 'tune', 'decay', 'x']) setStepX(k, j, key, null); stepBar(); paint(); }),
    btn('gsx', '✕', 'Close', () => { sel = null; stepBar(); paint(); }));
}
// what the grids and buttons show (for the page in view)
function paint(){
  if (!box) return;
  const P = pat();
  for (const c of cells) {
    const col = +c.dataset.c, j = page*16 + col, v = c.dataset.v;
    if (v) { const L = lenOf(v), h = GB[v][j], x = P.x[v + ':' + j];
      c.classList.toggle('out', j >= L); c.classList.toggle('on', j < L && h > 0); c.classList.toggle('acc', h === 2); c.classList.toggle('muted', !!GB.mute[v] || (GB.solo && GB.solo !== v));
      c.classList.toggle('fx', !!x && h > 0); c.classList.toggle('pk', !!sel && sel.k === v && sel.j === j); continue; }
    const L = lenOf('bass'), s = GB.bass[j], k = c.className.match(/\bn(\d)\b/); c.classList.toggle('out', j >= L);
    if (k) c.classList.toggle('on', j < L && !!s.on && s.n === +k[1]);
    else if (c.classList.contains('ga')) c.classList.toggle('on', !!s.a);
    else if (c.classList.contains('gs')) c.classList.toggle('on', !!s.s);
  }
  // the piano roll's notes: a note's first step, and the steps it's held through
  const Ls = lenOf('synth');
  box.querySelectorAll('.gpg .gc').forEach(b => { const j = page*16 + +b.dataset.c, n = +b.dataset.n, o = P.synth.find(o => o.n === n && j >= o.s && j < o.s + o.l);
    b.classList.toggle('out', j >= Ls); b.classList.toggle('on', !!o && o.s === j); b.classList.toggle('tail', !!o && o.s !== j); b.classList.toggle('pk', !!sel && sel.k === 'synth' && sel.j === j); });
  box.querySelectorAll('.glab[data-v]').forEach(l => { l.classList.toggle('muted', !!GB.mute[l.dataset.v]); l.classList.toggle('sel', l.dataset.v === pick); });
  box.querySelectorAll('.gmute').forEach(m => { m.setAttribute('aria-pressed', !!GB.mute[m.dataset.v]); m.classList.toggle('solo', GB.solo === m.dataset.v); m.textContent = GB.solo === m.dataset.v ? 'S' : 'M'; });
  box.querySelectorAll('.gslot').forEach(b => { const i = +b.dataset.i, p = GB.pats[i]; b.setAttribute('aria-pressed', i === GB.pat); b.classList.toggle('queued', GB.next === i);
    b.classList.toggle('has', KV.some(v => p[v.key].some(Boolean)) || p.bass.some(s => s.on) || p.synth.length > 0); });
  const longest = Math.max(...[...KV.map(v => v.key), 'bass', 'synth'].map(lenOf));
  box.querySelectorAll('.gpage').forEach(b => { const i = +b.dataset.i; b.setAttribute('aria-pressed', i === page); b.disabled = i*16 >= longest; });
  box.querySelector('.gsong').setAttribute('aria-pressed', !!GB.songOn); box.querySelector('.grec').setAttribute('aria-pressed', !!GB.rec); box.querySelector('.gedit').setAttribute('aria-pressed', edit);
  const ch = box.querySelector('.gchain'); ch.textContent = '';
  GB.song.forEach((p, i) => { const c = btn('gchip', SLOTS[p], 'Take this bar off the song', () => { GB.song.splice(i, 1); save(); paint(); }); c.classList.toggle('now', GB.songOn && GB.songPos === i); ch.append(c); });
  if (!GB.song.length) ch.append(el('span', 'tl', '(no song: + Bar adds this pattern)'));
  const pl = box.querySelector('.gplay'); pl.textContent = GB.playing ? '❚❚ Stop' : '▶ Play'; pl.setAttribute('aria-label', GB.playing ? 'Stop' : 'Play');
}
// each frame while the panel shows it: every row's playhead (each at its own length), the pattern and song as heard, the tempo
export function drawGroove(){
  if (!box || box.hidden) return;
  const e = heardAt(), key = e ? `${e.rel}:${GB.pat}:${page}` : '-';
  if (key !== lastKey) { lastKey = key;
    const at = k => { if (!e) return -1; const L = lenOf(k), j = ((e.rel % L) + L) % L; return j >= page*16 && j < page*16 + 16 ? j - page*16 : -1; };
    for (const c of cells) c.classList.toggle('now', +c.dataset.c === at(c.dataset.v || 'bass'));
    const sp = at('synth'); box.querySelectorAll('.gpg .gc').forEach(b => b.classList.toggle('now', +b.dataset.c === sp));
    const step = e ? e.i : -1; for (const l of leds) l.classList.toggle('on', +l.dataset.c === step);
    paint();
  }
  const L = locked(), p = box.querySelector('.gplay'), lab = GB.playing ? '❚❚ Stop' : '▶ Play';
  if (p.textContent !== lab) { p.textContent = lab; p.setAttribute('aria-label', GB.playing ? 'Stop' : 'Play'); }
  box.querySelector('.gbv').textContent = `${tempo().toFixed(1)} BPM${L ? ', locked to ' + (L.tap ? 'your taps' : 'deck ' + 'AB'[L.d.i]) : ''}`;
  box.querySelector('.gbpm').disabled = !!L;
}
// for the sync strip (ui/dj.js): playing, the step heard, the tempo, and what it's locked to (or null)
export function grooveState(){ const L = locked(); return {playing: GB.playing, step: heardStep(), bpm: tempo(), locked: L ? (L.tap ? 'your taps' : 'deck ' + 'AB'[L.d.i]) : null, pat: SLOTS[GB.pat]}; }
