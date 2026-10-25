// Studio DAW: the songs from Studio Jam laid out as a traditional DAW, to hear, edit and comment on precisely. Tracks down
// the left (level, pan, mute, solo, a like or a note), the arrangement to the right (the sections named across the top,
// the chords under them, each track's clips), the piano roll of the clip being edited below it with each note's velocity.
// A song is written out once as it plays (flatten.js), and from then on it's notes: moved, stretched, copied, split. Your
// version is kept (this device and the page's database), Claude's stays to go back to, and every note you leave says
// exactly where it is (the song, the tracks, the bars) for Claude to read.
import { flatten, holdNotes } from './flatten.js';
import { makeEngine, isDrum } from './engine.js';
import { combineDrums, ensureRacks, isRack } from './rack.js';
import { SETS, addSets, setOf, defaultSet, onSet, moveTo } from './sets.js';
import { makeSounds } from './sounds.js';
import { makeSynthUI } from './synth-ui.js';
import { makeMixer } from './mixer.js';
import ROUND3 from './songs/round3.json';
import ROUND4 from './songs/round4.json';
import LIBRARY from '../listen/packs/library.json';

const $ = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v != null) e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; };
const clone = x => JSON.parse(JSON.stringify(x)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SONGS = [...ROUND4, ...ROUND3], SND = Object.fromEntries(LIBRARY.sounds.map(s => [s.id, s])); addSets(SND);
// (?sounds=song opens Claude's version on the song's own sounds: the tests written before the analog set use it)
const SET_Q = new URLSearchParams(location.search).get('sounds');
const RULER = 72, LANE = 56, COLORS = {drums: '#c2563b', kick: '#c2563b', hats: '#d4a03a', perc: '#8a9a3c', bass: '#3f88c5', chords: '#8b5cc4', lead: '#3aa59a', lead2: '#2f8f6c'};
const VORDER = ['kick', 'snare', 'clap', 'chh', 'ohh', 'ride', 'crash', 'tomL', 'tomH', 'log', 'logH', 'wood', 'rim', 'clave', 'cow', 'shaker', 'metal', 'bowl', 'gong'];
const VNAME = {kick: 'Kick', chh: 'Closed hat', ohh: 'Open hat', ride: 'Ride', snare: 'Snare', clap: 'Clap', crash: 'Crash', cow: 'Cowbell', tomL: 'Low tom', tomH: 'High tom', log: 'Log', logH: 'High log', wood: 'Wood', rim: 'Rim', clave: 'Clave', shaker: 'Shaker', metal: 'Metal', bowl: 'Bowl', gong: 'Gong'}, NN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], nn = p => NN[((p % 12) + 12) % 12] + (Math.floor(p/12) - 1);
const ST = {id: null, P: null, orig: null, mine: true, px: 28, sx: 0, snap: 1, ph: 0, focus: 'arr', past: [], fut: [], sel: {clips: new Set(), range: null, mark: null, track: 0, trackOnly: false},
  open: null, ed: {px: 16, sx: 0, sy: 0, sel: new Set()}, lastLen: 2, lastVel: .8, clipboard: null, noteboard: null, notes: [], rating: 0, nid: 1};
let db = null, MX = null;

/* ---------- the engine, the songs ---------- */
const E = makeEngine({SND, workerSrc: $('worker-src').textContent, workletSrc: $('worklet-src')?.textContent, onBusy: () => status(), onTick: () => {}});
const colorOf = (T, i) => T.role === 'lead' && ST.P.tracks.findIndex(x => x.role === 'lead') !== i ? COLORS.lead2 : COLORS[T.role] || '#888';
const songById = id => SONGS.find(s => s.id === id);
const keyOf = id => 'studio.daw.v1.' + id;
const roundOf = s => `Round ${s.round}: ${s.name}`;
for (const s of SONGS) $('songSel').append(h('option', {value: s.id}, roundOf(s)));
async function open(id){ if (E.playing) E.stop(); const s = songById(id); if (!s) return; ST.id = id; $('songSel').value = id;
  // (Studio Jam's kick, hats and percussion come as one drum rack track: combineDrums, rack.js)
  // (Claude's version on the set it opens on: round 4 on the analog drum machine and synth, sets.js)
  ST.orig = combineDrums(onSet(flatten(s), SETS[SET_Q] ? SET_Q : defaultSet(s)), SND); let P = null;
  if (db) try { const d = await db.collection('versions').doc(id).get(); if (d.exists) P = JSON.parse(d.data().json); } catch {}
  if (!P) try { const l = localStorage.getItem(keyOf(id)); if (l) P = JSON.parse(l).P; } catch {}
  if (P?.v === 1) { ensureRacks(P, SND); P = combineDrums(P, SND); }
  ST.P = P && P.v === 1 ? P : clone(ST.orig); SB.adopt(ST.P.sounds); ST.mine = true; ST.past = []; ST.fut = []; ST.open = null; ST.ed.sel.clear(); clearSel(); ST.ph = 0;
  for (const T of ST.P.tracks) for (const c of T.clips) { const n = +String(c.id).replace(/\D+/g, '') || 0; ST.nid = Math.max(ST.nid, n + 1); }
  E.load(ST.P); E.cycle = false; $('cycle').setAttribute('aria-pressed', 'false');
  ST.px = Math.max(16, ($('arrWrap').clientWidth - 20)/Math.min(ST.P.bars, 48)); ST.sx = 0; ST.sy = 0; scrollTracks();
  $('tempo').textContent = `${ST.P.bpm} BPM · ${ST.P.bars} bars`; renderTracks(); renderVer(); renderSet(); loadNotes(); renderEd(); draw(); status(); try { localStorage.setItem('studio.daw.song', id); } catch {} }
$('songSel').onchange = e => open(e.target.value);

/* ---------- history and saving ---------- */
const snapshot = () => JSON.stringify({tracks: ST.P.tracks, sounds: ST.P.sounds || {}, desk: ST.P.desk || {}, set: setOf(ST.P)});   // (whole tracks: adding and deleting them undo too; the desk's buses and the sound set with them)
function checkpoint(){ ST.past.push(snapshot()); if (ST.past.length > 100) ST.past.shift(); ST.fut = []; }
function restore(json){ const Q = JSON.parse(json), same = Q.tracks.length === ST.P.tracks.length && Q.tracks.every((T, i) => T.id === ST.P.tracks[i].id);
  // the same tracks: each one's contents put back in place (the engine's channels keep them); others: the tracks replaced, the channels made again
  if (same) ST.P.tracks.forEach((T, i) => { for (const k of Object.keys(T)) delete T[k]; Object.assign(T, Q.tracks[i]); }); else { ST.P.tracks = Q.tracks; E.load(ST.P); }
  ST.sel.track = Math.min(ST.sel.track, ST.P.tracks.length - 1); ST.P.sounds = Q.sounds || {}; ST.P.desk = Q.desk || {}; if (Q.set) ST.P.set = Q.set; renderSet(); SB.adopt(ST.P.sounds); E.deskRefresh();
  if (ST.open && !findClip(ST.open.id)) ST.open = null; ST.ed.sel.clear(); for (const id of [...ST.sel.clips]) if (!findClip(id)) ST.sel.clips.delete(id); E.compile(); E.refresh(); changed(true); renderTracks(); SB.render(); }
function undo(){ if (!ST.past.length) { flash('Nothing to undo'); return; } ST.fut.push(snapshot()); restore(ST.past.pop()); flash('Undone'); }
function redo(){ if (!ST.fut.length) { flash('Nothing to redo'); return; } ST.past.push(snapshot()); restore(ST.fut.pop()); flash('Redone'); }
let saveT = 0, dbT = 0;
function changed(mixOnly){ if (!mixOnly) { E.compile(); E.prewarm(); } else E.mix(); draw(); drawEd(); save(); }
function save(){ if (!ST.mine) return; clearTimeout(saveT); clearTimeout(dbT); status('Saving…');
  saveT = setTimeout(() => { try { localStorage.setItem(keyOf(ST.id), JSON.stringify({at: Date.now(), P: ST.P})); } catch {} status(db ? 'Saving…' : 'Saved on this device'); }, 600);
  if (db) dbT = setTimeout(async () => { try { await db.collection('versions').doc(ST.id).set({song: ST.id, name: ST.P.name, round: ST.P.round, at: new Date().toISOString(), json: JSON.stringify(ST.P)}); status('Saved'); } catch (e) { status('Saved on this device (' + (e.code || e.message) + ')'); } }, 2500); }
let stTxt = ''; function status(t){ if (t) stTxt = t; const n = E.busy(); $('status').textContent = n ? `Computing ${n} sound${n > 1 ? 's' : ''}…` : stTxt || 'Ready'; }
let flT = 0; function flash(t){ const f = $('flash'); f.textContent = t; f.dataset.on = '1'; clearTimeout(flT); flT = setTimeout(() => f.dataset.on = '', 1600); }
// Claude's version, as written, or yours: Claude's can be heard, not edited (Revert, in Notes, makes it yours again)
function renderVer(){ $('ver').textContent = ST.mine ? 'Yours' : 'Claude’s'; $('ver').setAttribute('aria-pressed', String(!ST.mine)); }
$('ver').onclick = () => { if (ST.mine) { ST.held = snapshot(); restoreFrom(ST.orig); ST.mine = false; flash('Claude’s version, as written: switch back to edit yours'); }
  else { restore(ST.held); ST.mine = true; flash('Your version'); } renderVer(); };
// the sounds: the analog set or the song's own, every track's (and its clips') changed at once; on your version an
// edit, undone like any other, on Claude's only what's heard
function renderSet(){ $('setB').textContent = 'Sounds: ' + SETS[setOf(ST.P)]; }
function setSounds(set){ const s = songById(ST.id), ref = combineDrums(onSet(flatten(s), set), SND);
  if (ST.mine) checkpoint(); restore(JSON.stringify(moveTo(JSON.parse(snapshot()), ref, set, SND))); E.refresh();
  flash(set === 'analog' ? 'The analog drum machine and synth, as the Mix Lab plays them' : 'The sounds Studio Jam wrote the song with'); }
$('setB').onclick = () => setSounds(setOf(ST.P) === 'analog' ? 'song' : 'analog');
function restoreFrom(P){ restore(JSON.stringify({tracks: P.tracks, sounds: P.sounds || {}, desk: P.desk || {}, set: setOf(P)})); }
const PHONE = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
if (PHONE) { document.body.classList.add('phone'); $('rulerHead').lastElementChild.textContent = 'tap a section to loop it'; }
const editable = () => { if (PHONE) return false; if (ST.mine) return true; flash('This is Claude’s version: switch to Yours to edit'); return false; };

/* ---------- tracks (left) ---------- */
function renderTracks(){ const box = $('trackList'); box.innerHTML = '';
  ST.P.tracks.forEach((T, i) => { const M = T.mix;
    const row = h('div', {class: 'trk', 'data-sel': ST.sel.track === i ? '1' : '', style: `height:${LANE}px`},
      h('div', {class: 'nm', style: `border-left:4px solid ${colorOf(T, i)}`, title: SND[T.sound]?.name || T.sound}, T.name, ' ', h('span', {class: 'snd', role: 'button', tabindex: '0', title: 'Change the sound (Y)', onclick: e => { e.stopPropagation(); selTrack(i); SB.show(true); }}, SND[T.sound]?.name || T.sound)),
      h('div', {class: 'btns'}, h('button', {class: 'ms', 'aria-pressed': String(!!T.mute), title: 'Mute', onclick: e => { e.stopPropagation(); T.mute = !T.mute; changed(true); renderTracks(); }}, 'M'),
        h('button', {class: 'ms s', 'aria-pressed': String(!!M.solo), title: 'Solo', onclick: e => { e.stopPropagation(); M.solo = !M.solo; changed(true); renderTracks(); }}, 'S'),
        h('button', {title: 'A note about this track', onclick: e => { e.stopPropagation(); selTrack(i); compose(); }}, '💬'),
        h('button', {class: 'more', title: 'Rename, duplicate or delete the track', 'aria-haspopup': 'menu', onclick: e => { e.stopPropagation(); selTrack(i); trackMenu(e.currentTarget, i); }}, '⋯')),
      h('div', {class: 'sliders'}, h('span', {class: 'small muted', style: 'width:52px; font-family:var(--mono)'}, (M.vol > 0 ? '+' : '') + (+M.vol).toFixed(1)),
        slider(-40, 6, .5, M.vol, v => { M.vol = v; row.querySelector('.sliders span').textContent = (v > 0 ? '+' : '') + v.toFixed(1); changed(true); }, 'Level (dB)'),
        slider(-1, 1, .05, M.pan || 0, v => { M.pan = v; changed(true); }, 'Pan', 'pan')));
    row.onclick = () => selTrack(i); row.querySelector('.nm').ondblclick = e => { e.stopPropagation(); rename(i); }; box.append(row); });
  MX?.render();
  if (!PHONE) box.append(h('div', {class: 'addTrk'}, h('button', {id: 'addTrk', title: 'A new track (⌥⌘N)', 'aria-haspopup': 'menu', onclick: e => addMenu(e.currentTarget)}, '+ Add a track'))); }
function slider(min, max, step, val, set, label, cls = ''){ const s = h('input', {type: 'range', min, max, step, value: val, 'aria-label': label, title: label, class: cls}); s.oninput = () => set(+s.value); s.ondblclick = () => { s.value = 0; set(0); }; s.onclick = e => e.stopPropagation(); return s; }
function selTrack(i){ ST.sel = {clips: new Set(), range: null, mark: null, track: i, trackOnly: true}; renderTracks(); draw(); target(); }
function clearSel(){ ST.sel = {clips: new Set(), range: null, mark: null, track: ST.sel?.track ?? 0, trackOnly: false}; }

/* ---------- adding, renaming, duplicating and deleting tracks ---------- */
const ROLES = [['drums', 'Drum rack', 'a whole kit: every drum on its own pad'], ['kick', 'Kick', 'a drum: the kick'], ['hats', 'Hats', 'a drum: hats and cymbals'], ['perc', 'Percussion', 'drums: hand drums, wood, metal'], ['bass', 'Bass', 'a bass line'], ['chords', 'Chords', 'chords and pads'], ['lead', 'Lead', 'a melody']];
const uniqueName = base => { const names = new Set(ST.P.tracks.map(T => T.name)); if (!names.has(base)) return base; let k = 2; while (names.has(`${base} ${k}`)) k++; return `${base} ${k}`; };
// a menu by a button: its items, closed by a click elsewhere or Escape
function popup(at, items){ closePop(); const r = at.getBoundingClientRect(), m = h('div', {class: 'pop', role: 'menu', id: 'pop'});
  for (const it of items) m.append(it.sep ? h('div', {class: 'sep'}) : h('button', {role: 'menuitem', class: it.danger ? 'danger' : '', onclick: e => { e.stopPropagation(); if (it.keep) it.run(e.currentTarget); else { closePop(); it.run(); } }}, it.dot ? h('span', {class: 'dot', style: `background:${it.dot}`}) : '', it.label, it.note ? h('span', {class: 'muted small'}, ' ' + it.note) : ''));
  document.body.append(m); const W = m.offsetWidth, H = m.offsetHeight; m.style.left = Math.max(8, Math.min(innerWidth - W - 8, r.left)) + 'px'; m.style.top = (r.bottom + H + 8 > innerHeight ? Math.max(8, r.top - H - 4) : r.bottom + 4) + 'px';
  m.querySelector('button')?.focus(); setTimeout(() => addEventListener('pointerdown', outside), 0); }
const outside = e => { if (!e.target.closest('#pop')) closePop(); };
function closePop(){ $('pop')?.remove(); removeEventListener('pointerdown', outside); }
function addMenu(at){ if (!editable()) return; popup(at, [...ROLES.map(([r, label, note]) => ({label, note, dot: COLORS[r], run: () => addTrack(r)})), {sep: true}, {label: 'Duplicate the selected track', run: () => addTrack(null, ST.sel.track)}]); }
function trackMenu(at, i){ const T = ST.P.tracks[i]; popup(at, [{label: 'Rename…', run: () => rename(i)}, {label: 'Change the sound…', run: () => SB.show(true)}, {label: 'Duplicate', run: () => addTrack(null, i)},
  {label: `Add a ${(ROLES.find(r => r[0] === T.role)?.[1] || 'track').toLowerCase()} track below`, run: () => addTrack(T.role)}, {sep: true},
  {label: 'Delete the track', danger: true, keep: true, run: b => { if (b.dataset.sure) { closePop(); delTrack(i); } else { b.dataset.sure = '1'; b.textContent = `Delete “${T.name}” and its ${T.clips.length} clip${T.clips.length === 1 ? '' : 's'}: click again`; } }}]); }
// a new track below the selected one: of a kind (its sound and settings taken from a track of that kind, else the library's
// first), empty; or a copy of a track, its clips with it
function addTrack(role, from){ if (!editable()) return; checkpoint(); const src = from != null ? ST.P.tracks[from] : null, at = Math.min(ST.P.tracks.length, (ST.sel.track ?? ST.P.tracks.length - 1) + 1), id = 't' + Date.now().toString(36) + (ST.nid++);
  let T; if (src) T = {...clone(src), id, name: uniqueName(src.name), mute: false, mix: {...clone(src.mix), solo: false}, clips: src.clips.map(c => ({...clone(c), id: 'n' + ST.nid++}))};
  else { const like = ST.P.tracks.find(x => x.role === role), first = Object.values(SND).find(x => x.role === role && !x.mine), name = ROLES.find(r => r[0] === role)[1];
    T = {id, role, name: uniqueName(name), sound: like?.sound || first?.id, mix: {vol: 0, pan: 0, duck: like?.mix.duck ?? 2, lo: 0, mid: 0, hi: 0, solo: false}, set: like ? clone(like.set) : {x: .62, y: .3, motion: 0, length: 1, echo: false, verb: false}, mute: false, clips: []}; }
  ST.P.tracks.splice(at, 0, T); E.load(ST.P); ST.sel = {clips: new Set(), range: null, mark: null, track: at, trackOnly: true}; changed(); renderTracks(); target();
  const y = at*LANE; if (y < ST.sy || y + LANE > ST.sy + AH - RULER) { ST.sy = Math.min(maxSy(), Math.max(0, y - (AH - RULER)/2)); scrollTracks(); draw(); }
  flash(src ? `“${T.name}”: a copy of ${src.name}, with its clips` : `“${T.name}” added: double-click in its lane for a clip, drag clips onto it, or change its sound (Y)`); }
function delTrack(i){ if (!editable()) return; if (ST.P.tracks.length < 2) { flash('A song keeps at least one track'); return; } checkpoint(); const [T] = ST.P.tracks.splice(i, 1);
  if (ST.open && !findClip(ST.open.id)) ST.open = null; E.load(ST.P); ST.sel = {clips: new Set(), range: null, mark: null, track: Math.min(i, ST.P.tracks.length - 1), trackOnly: false};
  changed(); renderTracks(); renderEd(); target(); flash(`Deleted “${T.name}” (⌘Z brings it back)`); }
// a track's name, typed in its place: Enter keeps it, Escape leaves it as it was
function rename(i){ if (!editable()) return; const T = ST.P.tracks[i], nm = $('trackList').children[i]?.querySelector('.nm'); if (!nm) return;
  const inp = h('input', {class: 'ren', value: T.name, 'aria-label': 'The track’s name', maxlength: '40'}); nm.replaceChildren(inp); inp.focus(); inp.select(); let done = false;
  const end = keep => { if (done) return; done = true; const v = inp.value.trim(); if (keep && v && v !== T.name) { checkpoint(); T.name = v; changed(true); flash(`Renamed “${v}”`); } renderTracks(); target(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); }; inp.onblur = () => end(true); inp.onclick = e => e.stopPropagation(); }

/* ---------- the arrangement (right) ---------- */
const arr = $('arr'), actx = arr.getContext('2d'); let AW = 0, AH = 0;
function fit(cv){ const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.round(r.width*d); cv.height = Math.round(r.height*d); cv.getContext('2d').setTransform(d, 0, 0, d, 0, 0); return [r.width, r.height]; }
const bx = b => b*ST.px - ST.sx, xb = x => (x + ST.sx)/ST.px, ly = i => RULER + i*LANE - ST.sy, lane = y => Math.floor((y - RULER + ST.sy)/LANE);
const maxSy = () => Math.max(0, (ST.P.tracks.length + .7)*LANE - (AH - RULER));   // (room under the tracks for the row that adds one)
function findClip(id){ for (const [ti, T] of ST.P.tracks.entries()) { const cl = T.clips.find(c => c.id === id); if (cl) return {T, ti, cl}; } return null; }
const unit = () => ST.snap || 1;                                          // snapping, in 16ths
const snap16 = v => ST.snap ? Math.round(v/ST.snap)*ST.snap : Math.round(v);
function trackRange(T){ let lo = 1e9, hi = -1e9; for (const c of T.clips) for (const n of c.notes) if (typeof n.p === 'number') { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); } return lo > hi ? [48, 72] : [lo - 1, hi + 1]; }
function voicesOf(T){ const s = SND[T.sound], have = new Set(Object.keys(s?.voices || {})); for (const c of T.clips) for (const n of c.notes) have.add(n.p); return [...VORDER.filter(v => have.has(v)), ...[...have].filter(v => !VORDER.includes(v))]; }
function draw(){ if (!ST.P) return; [AW, AH] = fit(arr); const g = actx, P = ST.P, px = ST.px, b0 = Math.max(0, Math.floor(xb(0))), b1 = Math.min(P.bars, Math.ceil(xb(AW)));
  g.fillStyle = '#16181d'; g.fillRect(0, 0, AW, AH);
  P.tracks.forEach((T, i) => { g.fillStyle = ST.sel.track === i ? '#20242b' : i % 2 ? '#191c21' : '#1b1e23'; g.fillRect(0, ly(i), AW, LANE); });
  // the loop and a selected range
  if (E.cycle || ST.loopShown) { g.fillStyle = 'rgba(224,163,58,.10)'; g.fillRect(bx(E.loop[0]), 0, (E.loop[1] - E.loop[0])*px, AH); }
  const R = ST.sel.range; if (R) { g.fillStyle = 'rgba(255,255,255,.07)'; for (const ti of R.tracks) g.fillRect(bx(R.a), ly(ti), (R.b - R.a)*px, LANE); }
  // the grid: bars, every fourth stronger, beats when there's room
  for (let b = b0; b <= b1; b++) { const x = Math.round(bx(b)) + .5; g.strokeStyle = b % 4 ? '#262a31' : '#353b45'; g.beginPath(); g.moveTo(x, 22); g.lineTo(x, AH); g.stroke();
    if (px >= 56) for (let q = 1; q < 4; q++) { const xq = Math.round(bx(b + q/4)) + .5; g.strokeStyle = '#1f2329'; g.beginPath(); g.moveTo(xq, RULER); g.lineTo(xq, AH); g.stroke(); } }
  // the ruler: sections, bar numbers, chords
  g.fillStyle = '#1f2228'; g.fillRect(0, 0, AW, RULER); g.font = '12px system-ui'; g.textBaseline = 'middle';
  P.marks.forEach((m, i) => { const x = bx(m.at), w = m.bars*px; if (x + w < 0 || x > AW) return; g.fillStyle = ST.sel.mark === i ? '#e0a33a' : i % 2 ? '#3a3350' : '#33405a'; g.fillRect(x + 1, 2, w - 2, 18);
    g.fillStyle = ST.sel.mark === i ? '#111' : '#e7e9ee'; g.save(); g.beginPath(); g.rect(x + 1, 2, w - 4, 18); g.clip(); g.fillText(m.name, x + 6, 11); g.restore(); });
  g.fillStyle = '#9aa1ad'; const every = px < 22 ? 4 : px < 40 ? 2 : 1;
  for (let b = b0; b < b1; b++) if (b % every === 0) g.fillText(String(b + 1), bx(b) + 3, 33);
  g.fillStyle = '#c9b38a'; let cEnd = -1e9;   // (a chord's name only where it fits after the last)
  for (let b = b0; b < b1; b++) if (b === 0 || P.chords[b] !== P.chords[b - 1]) { const t = P.chords[b].replace(':', ' '), x = bx(b) + 3; if (x < cEnd) continue; g.fillText(t, x, 58); cEnd = x + g.measureText(t).width + 6; }
  g.strokeStyle = '#343944'; g.beginPath(); g.moveTo(0, 22.5); g.lineTo(AW, 22.5); g.moveTo(0, 46.5); g.lineTo(AW, 46.5); g.moveTo(0, RULER - .5); g.lineTo(AW, RULER - .5); g.stroke();
  if (E.cycle) { g.fillStyle = '#e0a33a'; g.fillRect(bx(E.loop[0]), 23, (E.loop[1] - E.loop[0])*px, 4); }
  // the clips, each with its notes in miniature
  g.save(); g.beginPath(); g.rect(0, RULER, AW, AH - RULER); g.clip();
  P.tracks.forEach((T, ti) => { const y = ly(ti) + 4, hh = LANE - 8, col = colorOf(T, ti), drum = isDrum(T.role), [lo, hi] = drum ? [0, 1] : trackRange(T), vs = drum ? voicesOf(T) : null;
    for (const c of T.clips) { const x = bx(c.start), w = c.len/16*px; if (x + w < 0 || x > AW) continue; const sel = ST.sel.clips.has(c.id) || ST.open?.id === c.id;
      g.globalAlpha = sel ? .95 : .62; g.fillStyle = col; roundRect(g, x + 1, y, w - 2, hh, 5); g.fill(); g.globalAlpha = 1;
      if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 2; roundRect(g, x + 1, y, w - 2, hh, 5); g.stroke(); g.lineWidth = 1; }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 1, y, w - 2, 14); g.fillStyle = '#fff'; g.font = '11px system-ui'; g.save(); g.beginPath(); g.rect(x + 2, y, w - 6, 14); g.clip(); g.fillText(c.name || T.name, x + 5, y + 7); g.restore();
      g.fillStyle = 'rgba(255,255,255,.85)'; const top = y + 16, span = hh - 19;
      for (const n of c.notes) { if (n.s >= c.len) continue; const nx = x + n.s/16*px, nw = Math.max(1, n.l/16*px - .5); if (nx > x + w) continue;
        const ny = drum ? top + (vs.indexOf(n.p) + .5)/vs.length*span : top + (1 - (n.p - lo)/Math.max(1, hi - lo))*span; g.fillRect(nx, ny - 1, Math.min(nw, x + w - nx), 2); } } }); g.restore();
  // a marquee being drawn, the playhead
  if (ST.box) { const b = ST.box; g.strokeStyle = '#fff'; g.setLineDash([4, 3]); g.strokeRect(Math.min(b.x0, b.x1) + .5, Math.min(b.y0, b.y1) + .5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); g.setLineDash([]); }
  const x = Math.round(bx(ST.ph)) + .5; g.strokeStyle = '#ff5a4f'; g.beginPath(); g.moveTo(x, 22); g.lineTo(x, AH); g.stroke(); g.fillStyle = '#ff5a4f'; g.beginPath(); g.moveTo(x - 6, 22); g.lineTo(x + 6, 22); g.lineTo(x, 30); g.fill(); }
function roundRect(g, x, y, w, hh, r){ r = Math.min(r, w/2, hh/2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const compatible = (a, b) => a.role === b.role;
function hitClip(ti, b){ const T = ST.P.tracks[ti]; if (!T) return null; for (let k = T.clips.length - 1; k >= 0; k--) { const c = T.clips[k]; if (b >= c.start && b < c.start + c.len/16) return c; } return null; }
const pt = (cv, e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
arr.addEventListener('pointerdown', e => { if (!ST.P || e.button) return; ST.focus = 'arr'; arr.focus(); const [x, y] = pt(arr, e), b = xb(x);
  if (y < 22) { const i = ST.P.marks.findIndex(m => b >= m.at && b < m.at + m.bars); if (i >= 0) { const m = ST.P.marks[i];
      ST.sel = {clips: new Set(), range: {a: m.at, b: m.at + m.bars, tracks: ST.P.tracks.map((_, k) => k)}, mark: i, track: ST.sel.track, trackOnly: false}; draw(); target(); if (PHONE) loopTo(m.at, m.at + m.bars); } return; }
  if (y < RULER) { // the bar numbers and chords: click to move the playhead, drag to choose the bars to loop
    const a0 = Math.floor(b); let moved = false;
    drag(e, (xx) => { const bb = xb(xx); if (Math.abs(bb - b) > .3 || moved) { moved = true; const lo = Math.max(0, Math.min(a0, Math.floor(bb))), hi = Math.min(ST.P.bars, Math.max(a0 + 1, Math.ceil(bb))); E.loop = [lo, hi]; E.cycle = true; $('cycle').setAttribute('aria-pressed', 'true'); draw(); } },
      () => { if (!moved) seek(clamp(Math.round(b*4)/4, 0, ST.P.bars)); else { flash(`Looping bars ${E.loop[0] + 1}–${E.loop[1]}`); if (E.playing) play(E.loop[0]); } target(); });
    return; }
  const ti = lane(y); if (ti < 0 || ti >= ST.P.tracks.length) return;
  const c = hitClip(ti, b); ST.sel.track = ti; ST.sel.trackOnly = false; ST.sel.mark = null;
  if (c) { if (e.shiftKey) { ST.sel.clips.has(c.id) ? ST.sel.clips.delete(c.id) : ST.sel.clips.add(c.id); } else if (!ST.sel.clips.has(c.id)) ST.sel.clips = new Set([c.id]); ST.sel.range = null;
    renderTracks(); draw(); target(); if (PHONE) { pan(e, x, y); return; } if (!ST.sel.clips.has(c.id) || !ST.mine) return;
    const edge = x > bx(c.start + c.len/16) - 7, items = [...ST.sel.clips].map(id => findClip(id)).filter(Boolean).map(f => ({...f, s0: f.cl.start, l0: f.cl.len, t0: f.ti}));
    let started = false;
    drag(e, (xx, yy) => { const d16 = (xb(xx) - b)*16, dl = Math.round((yy - y)/LANE);
      if (!started) { if (Math.abs(xx - x) < 3 && Math.abs(yy - y) < 3) return; started = true; checkpoint(); }
      if (edge) { for (const it of items) it.cl.len = Math.max(unit(), snap16(it.l0 + d16)); }
      else for (const it of items) { it.cl.start = Math.max(0, snap16(it.s0*16 + d16)/16);
        const to = it.t0 + dl, T2 = ST.P.tracks[to]; const cur = ST.P.tracks.findIndex(T => T.clips.includes(it.cl));
        const dest = T2 && compatible(T2, ST.P.tracks[it.t0]) ? to : it.t0; if (dest !== cur) { ST.P.tracks[cur].clips.splice(ST.P.tracks[cur].clips.indexOf(it.cl), 1); ST.P.tracks[dest].clips.push(it.cl); } }
      draw(); }, () => { if (started) { changed(); target(); } }); return; }
  if (PHONE) { pan(e, x, y); return; }
  // empty: a box selects clips and the bars and tracks it covers (for looping or a note)
  ST.box = {x0: x, y0: y, x1: x, y1: y};
  drag(e, (xx, yy) => { ST.box.x1 = xx; ST.box.y1 = yy; draw(); }, () => { const B = ST.box; ST.box = null;
    if (Math.abs(B.x1 - B.x0) < 4 && Math.abs(B.y1 - B.y0) < 4) { if (!e.shiftKey) ST.sel.clips.clear(); ST.sel.range = null; renderTracks(); draw(); target(); return; }
    const a = Math.max(0, Math.floor(xb(Math.min(B.x0, B.x1)))), bb = Math.min(ST.P.bars, Math.ceil(xb(Math.max(B.x0, B.x1)))), t0 = clamp(lane(Math.min(B.y0, B.y1)), 0, ST.P.tracks.length - 1), t1 = clamp(lane(Math.max(B.y0, B.y1)), 0, ST.P.tracks.length - 1);
    const tracks = []; for (let k = t0; k <= t1; k++) tracks.push(k); ST.sel.range = {a, b: Math.max(a + 1, bb), tracks}; ST.sel.clips = new Set();
    for (const k of tracks) for (const c of ST.P.tracks[k].clips) if (c.start < ST.sel.range.b && c.start + c.len/16 > a) ST.sel.clips.add(c.id);
    draw(); target(); }); });
// on a phone a finger drags the song along and the tracks up and down
function pan(e, x, y){ const sx0 = ST.sx, sy0 = ST.sy; drag(e, (xx, yy) => { ST.sx = clamp(sx0 - (xx - x), 0, Math.max(0, ST.P.bars*ST.px - AW + 40)); ST.sy = clamp(sy0 - (yy - y), 0, maxSy()); scrollTracks(); draw(); }, () => {}); }
arr.addEventListener('dblclick', e => { const [x, y] = pt(arr, e), b = xb(x), ti = lane(y);
  if (y < 22) { const m = ST.P.marks.find(m => b >= m.at && b < m.at + m.bars); if (m) { loopTo(m.at, m.at + m.bars); } return; }
  if (ti < 0 || ti >= ST.P.tracks.length) return; const c = hitClip(ti, b);
  if (c) { openEd(c.id); return; }
  if (!editable()) return; checkpoint(); const T = ST.P.tracks[ti], start = Math.floor(b), nc = {id: 'n' + ST.nid++, start, len: 16, name: 'New', set: {}, notes: []};
  T.clips.push(nc); ST.sel.clips = new Set([nc.id]); changed(); openEd(nc.id); flash('A new empty bar: click in the piano roll to add notes'); });
arr.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey || e.metaKey) { const [x] = pt(arr, e), b = xb(x); ST.px = clamp(ST.px*Math.exp(-e.deltaY*.0025), 6, 240); ST.sx = Math.max(0, b*ST.px - x); }
  else { const dx = e.shiftKey ? e.deltaX || e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
    // up and down scroll the tracks while they don't all fit, otherwise along the song
    if (dy && maxSy() > 0) { ST.sy = clamp(ST.sy + dy, 0, maxSy()); scrollTracks(); } else if (dy) ST.sx = clamp(ST.sx + dy, 0, Math.max(0, ST.P.bars*ST.px - AW + 40));
    if (dx) ST.sx = clamp(ST.sx + dx, 0, Math.max(0, ST.P.bars*ST.px - AW + 40)); } draw(); }, {passive: false});
const scrollTracks = () => { $('trackList').style.transform = `translateY(${-ST.sy}px)`; };
$('tracks').addEventListener('wheel', e => { e.preventDefault(); if (!ST.P) return; ST.sy = clamp(ST.sy + e.deltaY, 0, maxSy()); scrollTracks(); draw(); }, {passive: false});
function drag(e, move, up){ const mm = ev => { const [x, y] = pt(e.target, ev); move(x, y, ev); }, uu = ev => { removeEventListener('pointermove', mm); removeEventListener('pointerup', uu); up(ev); };
  addEventListener('pointermove', mm); addEventListener('pointerup', uu); }

/* ---------- the transport ---------- */
function play(from = ST.ph){ if (E.cycle && (from < E.loop[0] || from >= E.loop[1])) from = E.loop[0]; E.play(from); $('play').textContent = 'Stop'; anim(); }
function stop(){ E.stop(); $('play').textContent = 'Play'; }
function seek(b){ ST.ph = b; if (E.playing) play(b); draw(); posText(); }
function loopTo(a, b){ E.loop = [a, b]; E.cycle = true; $('cycle').setAttribute('aria-pressed', 'true'); ST.ph = a; draw(); posText(); flash(`Looping bars ${a + 1}–${b}`); if (E.playing) play(a); }
$('play').onclick = () => E.playing ? stop() : play();
$('cycle').onclick = () => { E.cycle = !E.cycle; $('cycle').setAttribute('aria-pressed', String(E.cycle)); draw(); };
$('snap').onchange = e => { ST.snap = +e.target.value; };
$('undo').onclick = undo; $('redo').onclick = redo;
// Claude's mix, or every channel and bus straight (at the loudness the mix gives each: B on the desk's comparison)
$('engAB').onclick = () => { const v = !E.eng; E.setEng(v); $('engAB').textContent = v ? 'Mix: Claude’s' : 'Mix: straight'; $('engAB').setAttribute('aria-pressed', String(v)); };
function posText(){ const s = Math.max(0, ST.ph*16), bar = Math.floor(s/16) + 1, beat = Math.floor(s % 16/4) + 1, six = Math.floor(s % 4) + 1; $('pos').textContent = `${bar}.${beat}.${six}`; }
function anim(){ if (!E.playing) { $('play').textContent = 'Play'; return; } const p = E.pos(); if (p != null) { ST.ph = p/16; posText();
    const x = bx(ST.ph); if (x > AW - 40 || x < 0) ST.sx = Math.max(0, ST.ph*ST.px - 60); draw(); drawEdHead();
    const f = cur(); if (f) { const s = (ST.ph - f.cl.start)*16; if (s >= 0 && s <= f.cl.len) { const xe = ex(s); if (xe > EW - 30 || xe < KEYW) ST.ed.sx = Math.max(0, s*ST.ed.px - 20); } drawEd(); } }
  requestAnimationFrame(anim); }

/* ---------- the piano roll ---------- */
const ed = $('ed'), ectx = ed.getContext('2d'), TOP = 18, VEL = 72, KEYW = 76; let EW = 0, EH = 0;
const cur = () => ST.open && findClip(ST.open.id);
function openEd(id){ const f = findClip(id); if (!f) return; ST.open = {id}; ST.ed.sel.clear(); ST.sel.track = f.ti; ST.sel.clips = new Set([id]);
  [EW, EH] = fit(ed); ST.ed.px = clamp((EW - KEYW - 10)/Math.min(f.cl.len, 64), 3, 48); const s16 = (ST.ph - f.cl.start)*16; ST.ed.sx = s16 < 0 || s16 > f.cl.len ? 0 : clamp(s16*ST.ed.px - 40, 0, Math.max(0, f.cl.len*ST.ed.px - (EW - KEYW) + 40));
  if (!isDrum(f.T.role)) { const ps = f.cl.notes.map(n => n.p).sort((a, b) => a - b), mid = ps.length ? ps[ps.length >> 1] : 60; ST.ed.sy = Math.max(0, (108 - mid)*12 - (EH - TOP - VEL)/2); } else ST.ed.sy = 0;
  if (SI?.isOn()) SI.show(false); renderTracks(); renderEd(); draw(); target(); ed.focus(); ST.focus = 'ed'; }
// (a drum clip's rows fit the editor: a whole kit's pads a little shorter than a few drums')
function rowsOf(f){ if (!isDrum(f.T.role)) return {drum: false, hi: 108, lo: 24, rh: 12}; const rows = voicesOf(f.T); return {drum: true, rows, rh: clamp(Math.floor((EH - TOP - VEL)/rows.length), 13, 22)}; }
const rowOfNote = (R, n) => R.drum ? R.rows.indexOf(n.p) : R.hi - n.p;
const ex = s => KEYW + s*ST.ed.px - ST.ed.sx, es = x => (x - KEYW + ST.ed.sx)/ST.ed.px;
function renderEd(){ const f = cur(); drawEdHead(); [EW, EH] = fit(ed); drawEd(); }
function drawEdHead(){ const f = cur(); if (!f) { $('edName').textContent = 'Double-click a clip to edit its notes'; $('edInfo').textContent = ''; return; }
  $('edName').textContent = `${f.T.name} · ${f.cl.name || ''}`; $('edInfo').textContent = `bars ${Math.floor(f.cl.start) + 1}–${Math.ceil(f.cl.start + f.cl.len/16)} · ${f.cl.notes.length} notes${ST.ed.sel.size ? ` · ${ST.ed.sel.size} selected` : ''}`; }
function drawEd(){ const g = ectx, f = cur(); g.fillStyle = '#1b1e23'; g.fillRect(0, 0, EW, EH); if (!f) return;
  const R = rowsOf(f), n = R.drum ? R.rows.length : R.hi - R.lo + 1, yb = EH - VEL, yOf = r => TOP + r*R.rh - ST.ed.sy, px = ST.ed.px, cl = f.cl, col = colorOf(f.T, f.ti);
  // rows (the black keys darker), the grid, past the clip's end shaded
  for (let r = 0; r < n; r++) { const y = yOf(r); if (y + R.rh < TOP || y > yb) continue; const p = R.hi - r, black = !R.drum && [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
    g.fillStyle = black ? '#17191d' : R.drum && R.rows[r] === focusRow(R) ? '#2c2f37' : r % 2 && R.drum ? '#1d2026' : '#1f2228'; g.fillRect(KEYW, y, EW, R.rh); g.fillStyle = '#262a31'; g.fillRect(KEYW, y + R.rh - 1, EW, 1); }
  const s0 = Math.max(0, Math.floor(es(KEYW))), s1 = Math.ceil(es(EW));
  for (let s = s0; s <= s1; s++) { const x = Math.round(ex(s)) + .5; g.strokeStyle = s % 16 === 0 ? '#4a515d' : s % 4 === 0 ? '#323741' : '#24282e'; if (px < 6 && s % 4) continue; g.beginPath(); g.moveTo(x, TOP); g.lineTo(x, EH); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ex(cl.len), TOP, EW, EH);
  // the bar numbers over it, the playhead
  g.fillStyle = '#1f2228'; g.fillRect(KEYW, 0, EW, TOP); g.fillStyle = '#9aa1ad'; g.font = '11px system-ui'; g.textBaseline = 'middle';
  for (let s = Math.ceil(s0/16)*16; s <= s1; s += 16) g.fillText(String(Math.floor(cl.start + s/16) + 1), ex(s) + 3, 9);
  // the notes
  g.save(); g.beginPath(); g.rect(KEYW, TOP, EW, yb - TOP); g.clip();
  cl.notes.forEach((nt, i) => { const r = rowOfNote(R, nt); if (r < 0) return; const x = ex(nt.s), y = yOf(r), w = Math.max(3, nt.l*px - 1), sel = ST.ed.sel.has(i);
    g.globalAlpha = nt.s >= cl.len ? .3 : .45 + .55*nt.v; g.fillStyle = sel ? '#fff' : col; g.fillRect(x, y + 1, w, R.rh - 2); g.globalAlpha = 1;
    g.strokeStyle = sel ? '#e0a33a' : 'rgba(0,0,0,.6)'; g.strokeRect(x + .5, y + 1.5, w - 1, R.rh - 3);
    if (R.rh >= 12 && w > 26 && !R.drum) { g.fillStyle = sel ? '#111' : '#fff'; g.font = '9px system-ui'; g.fillText(nn(nt.p), x + 3, y + R.rh/2); } });
  if (ST.ebox) { const b = ST.ebox; g.strokeStyle = '#fff'; g.setLineDash([4, 3]); g.strokeRect(Math.min(b.x0, b.x1) + .5, Math.min(b.y0, b.y1) + .5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); g.setLineDash([]); }
  g.restore();
  // the velocity lane
  const fr = focusRow(R); g.fillStyle = '#15171b'; g.fillRect(0, yb, EW, VEL); g.fillStyle = '#343944'; g.fillRect(0, yb, EW, 1); g.fillStyle = '#9aa1ad'; g.fillText('Velocity', 8, yb + 12);
  if (fr) { g.fillStyle = col; g.fillText(VNAME[fr] || fr, 8, yb + 28); }
  cl.notes.forEach((nt, i) => { const x = ex(nt.s); if (x < KEYW - 2 || fr && nt.p !== fr) return; const hh = (VEL - 10)*nt.v, sel = ST.ed.sel.has(i); g.fillStyle = sel ? '#e0a33a' : col; g.fillRect(x, EH - 4 - hh, 3, hh); g.fillRect(x - 2, EH - 4 - hh, 7, 2); });
  // the keys (or the drum's voices) down the left
  g.fillStyle = '#1f2228'; g.fillRect(0, 0, KEYW, yb);
  for (let r = 0; r < n; r++) { const y = yOf(r); if (y + R.rh < TOP || y > yb) continue;
    if (R.drum) { const v = R.rows[r], nat = SND[f.T.sound]?.voices?.[v]?.native; if (v === fr) { g.fillStyle = col; g.fillRect(0, y, 3, R.rh - 1); g.fillStyle = '#2c2f37'; g.fillRect(3, y, KEYW - 3, R.rh - 1); }
      g.fillStyle = v === fr ? '#fff' : '#e7e9ee'; g.font = (v === fr ? '600 ' : '') + '11px system-ui'; g.fillText((VNAME[v] || v) + (nat ? ' · ' + nat : ''), 6, y + R.rh/2); g.fillStyle = '#343944'; g.fillRect(0, y + R.rh - 1, KEYW, 1); continue; }
    const p = R.hi - r, black = [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12); g.fillStyle = black ? '#0c0d10' : '#d9dce2'; g.fillRect(black ? 0 : 0, y, black ? KEYW*.62 : KEYW, R.rh - (black ? 0 : 1));
    if (p % 12 === 0) { g.fillStyle = '#333'; g.font = '10px system-ui'; g.fillText(nn(p), KEYW - 30, y + R.rh/2); } }
  const ph = (ST.ph - cl.start)*16; if (ph >= 0 && ph <= cl.len) { const x = Math.round(ex(ph)) + .5; g.strokeStyle = '#ff5a4f'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, EH); g.stroke(); } }
// a drum clip's row picked (its name clicked): lit, and the velocity lane shows that drum's hits alone
const focusRow = R => R.drum && R.rows.includes(ST.ed.row) ? ST.ed.row : null;
function noteAt(f, R, x, y){ for (let i = f.cl.notes.length - 1; i >= 0; i--) { const nt = f.cl.notes[i], r = rowOfNote(R, nt), y0 = TOP + r*R.rh - ST.ed.sy, x0 = ex(nt.s), w = Math.max(3, nt.l*ST.ed.px - 1);
    if (y >= y0 && y < y0 + R.rh && x >= x0 - 1 && x <= x0 + w + 1) return {i, nt, x0, w}; } return null; }
const pitchOfRow = (R, r) => R.drum ? R.rows[clamp(r, 0, R.rows.length - 1)] : clamp(R.hi - r, R.lo, R.hi);
const eSnap = v => ST.snap ? Math.round(v/ST.snap)*ST.snap : Math.round(v*100)/100;
ed.addEventListener('pointerdown', e => { if (e.button) return; const f = cur(); ST.focus = 'ed'; ed.focus(); if (!f) return; const [x, y] = pt(ed, e), R = rowsOf(f), yb = EH - VEL;
  if (x < KEYW && y > TOP && y < yb) { const r = Math.floor((y - TOP + ST.ed.sy)/R.rh), p = pitchOfRow(R, r); E.audition(f.ti, p);
    // (a drum's name: picked, here and in the Instrument and Mixer tabs too)
    if (R.drum) { ST.sel.track = f.ti; pickPad(p); } return; }
  if (y >= yb) { // velocity: the nearest note's bar; dragging a selected one moves every selected one together
    const fr = focusRow(R); let best = null, bd = 8; f.cl.notes.forEach((nt, i) => { if (fr && nt.p !== fr) return; const d = Math.abs(ex(nt.s) + 1 - x); if (d < bd || d === bd && ST.ed.sel.has(i)) { bd = d; best = i; } });
    if (best == null || !editable()) return; const group = ST.ed.sel.has(best) ? [...ST.ed.sel].filter(i => !fr || f.cl.notes[i].p === fr) : [best], v0 = group.map(i => f.cl.notes[i].v), b0 = f.cl.notes[best].v; let started = false;
    drag(e, (xx, yy) => { if (!started) { started = true; checkpoint(); } const v = clamp((EH - 4 - yy)/(VEL - 10), .02, 1); group.forEach((i, k) => f.cl.notes[i].v = +clamp(v0[k] + v - b0, .02, 1).toFixed(3)); ST.lastVel = v; drawEd(); }, () => { if (started) changed(); });
    return; }
  const hit = noteAt(f, R, x, y);
  if (hit) { const {i, nt, x0, w} = hit; if (e.shiftKey) { ST.ed.sel.has(i) ? ST.ed.sel.delete(i) : ST.ed.sel.add(i); drawEd(); drawEdHead(); return; }
    if (!ST.ed.sel.has(i)) ST.ed.sel = new Set([i]); E.audition(f.ti, nt.p, nt.v, Math.min(nt.l, 4)); drawEd(); drawEdHead(); if (!editable()) return;
    const mode = w > 10 && x > x0 + w - 6 ? 'end' : w > 10 && x < x0 + 4 ? 'start' : 'move'; let idx = [...ST.ed.sel], orig = idx.map(k => ({...f.cl.notes[k]})), started = false, last = nt.p;
    drag(e, (xx, yy) => { if (!started) { if (Math.abs(xx - x) < 3 && Math.abs(yy - y) < 3) return; started = true; checkpoint();
        if (e.altKey && mode === 'move') { const copies = orig.map(o => ({...o})); const base = f.cl.notes.length; f.cl.notes.push(...copies); idx = copies.map((_, k) => base + k); ST.ed.sel = new Set(idx); } }
      const ds = eSnap((xx - x)/ST.ed.px), dr = Math.round((yy - y)/R.rh);
      idx.forEach((k, j) => { const o = orig[j], nt2 = f.cl.notes[k];
        if (mode === 'move') { nt2.s = Math.max(0, +(o.s + ds).toFixed(3)); if (R.drum) nt2.p = R.rows[clamp(R.rows.indexOf(o.p) + dr, 0, R.rows.length - 1)]; else nt2.p = clamp(o.p - dr, R.lo, R.hi); }
        else if (mode === 'end') nt2.l = Math.max(ST.snap ? Math.min(ST.snap, 1) : .25, +(o.l + ds).toFixed(3));
        else { const s2 = clamp(+(o.s + ds).toFixed(3), 0, o.s + o.l - .25); nt2.l = +(o.l - (s2 - o.s)).toFixed(3); nt2.s = s2; } });
      if (mode === 'move' && f.cl.notes[idx[0]].p !== last) { last = f.cl.notes[idx[0]].p; E.audition(f.ti, last, f.cl.notes[idx[0]].v, 1); }
      if (mode === 'end') ST.lastLen = f.cl.notes[idx[0]].l; drawEd(); }, () => { if (started) changed(); });
    return; }
  // empty: a click adds a note, a drag selects with a box
  ST.ebox = {x0: x, y0: y, x1: x, y1: y};
  drag(e, (xx, yy) => { ST.ebox.x1 = xx; ST.ebox.y1 = yy; drawEd(); }, () => { const B = ST.ebox; ST.ebox = null;
    if (Math.abs(B.x1 - B.x0) < 4 && Math.abs(B.y1 - B.y0) < 4) { if (e.shiftKey) { drawEd(); return; } if (ST.ed.sel.size) { ST.ed.sel.clear(); drawEd(); drawEdHead(); return; }
      if (!editable()) return; const s = Math.max(0, ST.snap ? Math.floor(es(x)/ST.snap)*ST.snap : Math.round(es(x)*4)/4), r = Math.floor((y - TOP + ST.ed.sy)/R.rh), p = pitchOfRow(R, r);
      if (s >= f.cl.len) { flash('Past the clip’s end: drag its right edge in the arrangement to make it longer'); return; }
      checkpoint(); f.cl.notes.push({s, p, l: R.drum ? 1 : ST.lastLen, v: ST.lastVel}); ST.ed.sel = new Set([f.cl.notes.length - 1]); E.audition(f.ti, p, ST.lastVel, ST.lastLen); changed(); drawEdHead(); return; }
    const xa = Math.min(B.x0, B.x1), xz = Math.max(B.x0, B.x1), ya = Math.min(B.y0, B.y1), yz = Math.max(B.y0, B.y1); if (!e.shiftKey) ST.ed.sel.clear();
    f.cl.notes.forEach((nt, i) => { const r = rowOfNote(R, nt), y0 = TOP + r*R.rh - ST.ed.sy, x0 = ex(nt.s), w = nt.l*ST.ed.px; if (x0 < xz && x0 + w > xa && y0 < yz && y0 + R.rh > ya) ST.ed.sel.add(i); });
    drawEd(); drawEdHead(); target(); }); });
ed.addEventListener('wheel', e => { e.preventDefault(); const f = cur(); if (!f) return; const R = rowsOf(f), n = R.drum ? R.rows.length : R.hi - R.lo + 1;
  if (e.ctrlKey || e.metaKey) { const [x] = pt(ed, e), s = es(x); ST.ed.px = clamp(ST.ed.px*Math.exp(-e.deltaY*.0025), 2, 80); ST.ed.sx = Math.max(0, s*ST.ed.px - (x - KEYW)); }
  else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) ST.ed.sx = clamp(ST.ed.sx + (e.deltaX || e.deltaY), 0, Math.max(0, f.cl.len*ST.ed.px - (EW - KEYW) + 40));
  else ST.ed.sy = clamp(ST.ed.sy + e.deltaY, 0, Math.max(0, n*R.rh - (EH - TOP - VEL))); drawEd(); }, {passive: false});
// the editor's height, dragged
$('split').addEventListener('pointerdown', e => { const y0 = e.clientY, h0 = $('editor').offsetHeight;
  drag(e, (x, y, ev) => { $('editor').style.height = clamp(h0 - (ev.clientY - y0), 120, innerHeight - 220) + 'px'; draw(); renderEd(); }, () => {}); });

/* ---------- edits: clips and notes ---------- */
function selClips(){ return [...ST.sel.clips].map(findClip).filter(Boolean); }
function delSel(){ if (!editable()) return; const f = cur();
  if (ST.focus === 'ed' && f) { if (!ST.ed.sel.size) return; checkpoint(); f.cl.notes = f.cl.notes.filter((_, i) => !ST.ed.sel.has(i)); ST.ed.sel.clear(); changed(); drawEdHead(); return; }   // (in the piano roll only notes go)
  const cs = selClips(); if (!cs.length) return; checkpoint(); for (const {T, cl} of cs) T.clips.splice(T.clips.indexOf(cl), 1); if (ST.open && !findClip(ST.open.id)) ST.open = null; ST.sel.clips.clear(); changed(); renderEd(); flash(`Deleted ${cs.length} clip${cs.length > 1 ? 's' : ''}`); }
function copy(){ const f = cur();
  if (ST.focus === 'ed' && f && ST.ed.sel.size) { const ns = [...ST.ed.sel].map(i => f.cl.notes[i]), s0 = Math.min(...ns.map(n => n.s)); ST.noteboard = ns.map(n => ({...n, s: n.s - s0})); flash(`Copied ${ns.length} note${ns.length > 1 ? 's' : ''}`); return; }
  const cs = selClips(); if (!cs.length) return; const b0 = Math.min(...cs.map(c => c.cl.start)), t0 = Math.min(...cs.map(c => c.ti));
  ST.clipboard = cs.map(c => ({ti: c.ti, dt: c.ti - t0, rel: c.cl.start - b0, cl: clone(c.cl)})); flash(`Copied ${cs.length} clip${cs.length > 1 ? 's' : ''}`); }
function paste(){ if (!editable()) return; const f = cur();
  if (ST.focus === 'ed' && f && ST.noteboard) { checkpoint(); const at = clamp((ST.ph - f.cl.start)*16, 0, f.cl.len - 1), s = ST.snap ? Math.round(at/ST.snap)*ST.snap : at, base = f.cl.notes.length;
    f.cl.notes.push(...ST.noteboard.map(n => ({...n, s: +(s + n.s).toFixed(3)}))); ST.ed.sel = new Set(ST.noteboard.map((_, k) => base + k)); changed(); drawEdHead(); return; }
  if (!ST.clipboard) return; checkpoint(); const one = new Set(ST.clipboard.map(c => c.ti)).size === 1, at = Math.round(ST.ph*16)/16, ids = [];
  for (const c of ST.clipboard) { let ti = one ? ST.sel.track : c.ti; if (!compatible(ST.P.tracks[ti], ST.P.tracks[c.ti])) ti = c.ti;
    const nc = {...clone(c.cl), id: 'n' + ST.nid++, start: at + c.rel}; ST.P.tracks[ti].clips.push(nc); ids.push(nc.id); }
  ST.sel.clips = new Set(ids); changed(); flash(`Pasted at bar ${Math.floor(at) + 1}`); }
function duplicate(){ if (!editable()) return; const f = cur();
  if (ST.focus === 'ed' && f && ST.ed.sel.size) { checkpoint(); const ns = [...ST.ed.sel].map(i => f.cl.notes[i]), a = Math.min(...ns.map(n => n.s)), b = Math.max(...ns.map(n => n.s + n.l)), span = Math.ceil((b - a)/4)*4 || 4, base = f.cl.notes.length;
    f.cl.notes.push(...ns.map(n => ({...n, s: +(n.s + span).toFixed(3)}))); ST.ed.sel = new Set(ns.map((_, k) => base + k)); changed(); drawEdHead(); return; }
  const cs = selClips(); if (!cs.length) return; checkpoint(); const a = Math.min(...cs.map(c => c.cl.start)), b = Math.max(...cs.map(c => c.cl.start + c.cl.len/16)), ids = [];
  for (const {T, cl} of cs) { const nc = {...clone(cl), id: 'n' + ST.nid++, start: cl.start + (b - a)}; T.clips.push(nc); ids.push(nc.id); }
  ST.sel.clips = new Set(ids); changed(); flash('Duplicated after itself'); }
// split at the playhead: the selected clips (or the selected track's) that it falls inside
function split(){ if (!editable()) return; let cs = selClips(); if (!cs.length) cs = ST.P.tracks[ST.sel.track].clips.map(cl => ({T: ST.P.tracks[ST.sel.track], cl}));
  const at = Math.round(ST.ph*16)/16, hit = cs.filter(({cl}) => at > cl.start && at < cl.start + cl.len/16); if (!hit.length) { flash('Put the playhead inside a clip to split it'); return; }
  checkpoint(); const ids = [];
  for (const {T, cl} of hit) { const cut = Math.round((at - cl.start)*16), b = {...clone(cl), id: 'n' + ST.nid++, start: at, len: cl.len - cut, notes: cl.notes.filter(n => n.s >= cut).map(n => ({...n, s: +(n.s - cut).toFixed(3)}))};
    cl.notes = cl.notes.filter(n => n.s < cut); cl.len = cut; T.clips.push(b); ids.push(cl.id, b.id); }
  ST.sel.clips = new Set(ids); changed(); flash(`Split at bar ${Math.floor(at) + 1}${at % 1 ? ', beat ' + (Math.round(at % 1*4) + 1) : ''}`); }
function nudge(dx, dy, big){ if (!editable()) return; const f = cur();
  if (ST.focus === 'ed' && f && ST.ed.sel.size) { checkpoint(); const R = rowsOf(f);
    for (const i of ST.ed.sel) { const n = f.cl.notes[i]; n.s = Math.max(0, +(n.s + dx*(ST.snap || 1)).toFixed(3));
      if (dy) { if (R.drum) n.p = R.rows[clamp(R.rows.indexOf(n.p) - dy, 0, R.rows.length - 1)]; else n.p = clamp(n.p + dy*(big ? 12 : 1), R.lo, R.hi); } }
    if (dy) { const n = f.cl.notes[[...ST.ed.sel][0]]; E.audition(f.ti, n.p, n.v, 1); } changed(); return; }
  const cs = selClips(); if (!cs.length || !dx) return; checkpoint(); for (const {cl} of cs) cl.start = Math.max(0, cl.start + dx*(ST.snap || 16)/16); changed(); }

// Legato (⇧L): the selected notes (or the clip's) held on to where the next begins, at most a beat, never shortened,
// so a plucked sound rings out
function legato(){ if (!editable()) return; const f = cur(); if (!f || rowsOf(f).drum) { flash('Open a pitched clip’s notes first (double-click it)'); return; }
  const sel = ST.ed.sel.size ? ST.ed.sel : null, was = JSON.stringify(f.cl.notes); checkpoint(); holdNotes(f.cl.notes, 4, f.cl.len, (n, i) => !sel || sel.has(i));
  if (JSON.stringify(f.cl.notes) === was) { ST.past.pop(); flash('Already held on'); return; }
  changed(); flash(`Legato: ${sel ? sel.size + ' note' + (sel.size > 1 ? 's' : '') : 'every note'} held on to the next, up to a beat`); }
$('legato').onclick = legato;

/* ---------- keys ---------- */
addEventListener('keyup', e => { if (SI?.onKey(e, false)) e.preventDefault(); });
addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
  if (SI?.onKey(e, true)) { e.preventDefault(); return; }   // (the instrument showing: the letters play it)
  if (e.key === ' ') { e.preventDefault(); E.playing ? stop() : play(); return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; } if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'c') { e.preventDefault(); copy(); return; } if (mod && k === 'v') { e.preventDefault(); paste(); return; }
  if (mod && e.altKey && (k === 'n' || e.code === 'KeyN')) { e.preventDefault(); addMenu($('addTrk')); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicate(); return; } if (mod && k === 't') { e.preventDefault(); split(); return; }
  if (mod && k === 'a') { e.preventDefault(); const f = cur(); if (ST.focus === 'ed' && f) { ST.ed.sel = new Set(f.cl.notes.map((_, i) => i)); drawEd(); drawEdHead(); }
    else { ST.sel.clips = new Set(ST.P.tracks.flatMap(T => T.clips.map(c => c.id))); draw(); } target(); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); return; }
  if (k === 'l' && e.shiftKey) { legato(); return; }
  if (k === 'c') { $('cycle').click(); return; } if (k === 'l') { loopSel(); return; } if (k === 'y') { SB.show(!SB.isOpen()); return; } if (k === 'b') { MX.show(false); SI.show(!SI.isOn()); return; } if (k === 'x') { MX.show(!MX.isOn()); return; }
  if (e.key === 'Escape' && $('pop')) { closePop(); return; }
  if (e.key === 'Escape') { ST.ed.sel.clear(); clearSel(); renderTracks(); draw(); drawEd(); target(); return; }
  if (e.key === 'Home' || e.key === 'Enter') { seek(E.cycle ? E.loop[0] : 0); return; }
  const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1]}[e.key]; if (arrows) { e.preventDefault(); nudge(arrows[0], arrows[1], e.shiftKey); } });
// L: loop what's selected (a range, the clips, a section)
function loopSel(){ const R = ST.sel.range, cs = selClips(), f = cur();
  if (R) loopTo(R.a, R.b); else if (cs.length) loopTo(Math.floor(Math.min(...cs.map(c => c.cl.start))), Math.ceil(Math.max(...cs.map(c => c.cl.start + c.cl.len/16))));
  else if (f) loopTo(Math.floor(f.cl.start), Math.ceil(f.cl.start + f.cl.len/16)); else flash('Select some bars first (drag across the bar numbers, or a box in the tracks)'); }

/* ---------- likes and notes for Claude: each about exactly what's selected ---------- */
const bars = (a, b) => b - a <= 1 ? `bar ${a + 1}` : `bars ${a + 1}–${b}`;
let lastT = -1; function target(){ const t = currentTarget(); $('target').textContent = t.desc; SB?.render(); if (SI?.isOn() && ST.sel.track !== lastT) SI.render(); lastT = ST.sel.track; return t; }
function currentTarget(){ const P = ST.P, f = cur(); if (!P) return {kind: 'song', desc: ''};
  if (f && ST.ed.sel.size) { const ns = [...ST.ed.sel].map(i => f.cl.notes[i]), a = f.cl.start + Math.min(...ns.map(n => n.s))/16, b = f.cl.start + Math.max(...ns.map(n => n.s + n.l))/16;
    return {kind: 'notes', tracks: [f.T.name], bars: [Math.floor(a), Math.ceil(b)], clip: f.cl.name, count: ns.length, notes: ns.map(n => ({s: +(f.cl.start*16 + n.s).toFixed(2), p: n.p})), desc: `${ns.length} note${ns.length > 1 ? 's' : ''} · ${f.T.name} · ${bars(Math.floor(a), Math.ceil(b))}`}; }
  const R = ST.sel.range; if (R) { const names = R.tracks.length === P.tracks.length ? ['all tracks'] : R.tracks.map(i => P.tracks[i].name); const m = ST.sel.mark != null ? P.marks[ST.sel.mark] : null;
    return {kind: m ? 'section' : 'range', section: m?.name, tracks: names, bars: [R.a, R.b], desc: m ? `“${m.name}” · ${bars(R.a, R.b)}` : `${bars(R.a, R.b)} · ${names.join(', ')}`}; }
  const cs = selClips(); if (cs.length) { const a = Math.min(...cs.map(c => c.cl.start)), b = Math.max(...cs.map(c => c.cl.start + c.cl.len/16)), names = [...new Set(cs.map(c => c.T.name))];
    return {kind: 'clips', tracks: names, bars: [Math.floor(a), Math.ceil(b)], clip: cs.length === 1 ? cs[0].cl.name : `${cs.length} clips`, desc: `${cs.length === 1 ? `“${cs[0].cl.name}”` : cs.length + ' clips'} · ${names.join(', ')} · ${bars(Math.floor(a), Math.ceil(b))}`}; }
  if (ST.sel.trackOnly) { const T = P.tracks[ST.sel.track]; return {kind: 'track', tracks: [T.name], desc: `The ${T.name.toLowerCase()} track`}; }
  return {kind: 'song', desc: `The whole of ${P.name}`}; }
async function addNote(rating, text, t = currentTarget()){ const n = {song: ST.id, name: ST.P.name, round: ST.P.round, version: ST.mine ? 'yours' : 'claude', target: t, rating, text: text || '', at: new Date().toISOString()};
  if (db) try { const ref = await db.collection('notes').add(n); n.id = ref.id; } catch (e) { flash('Kept on this device (' + (e.code || e.message) + ')'); }
  if (!n.id) { n.id = 'l' + Date.now(); const all = localNotes(); all.push(n); try { localStorage.setItem('studio.daw.notes', JSON.stringify(all)); } catch {} }
  ST.notes.unshift(n); renderNotes(); flash(`${rating > 0 ? '👍' : rating < 0 ? '👎' : '💬'} ${t.desc}`); }
const localNotes = () => { try { return JSON.parse(localStorage.getItem('studio.daw.notes') || '[]'); } catch { return []; } };
async function loadNotes(){ let list = localNotes().filter(n => n.song === ST.id);
  if (db) try { const q = await db.collection('notes').get(); list = [...q.docs.map(d => ({...d.data(), id: d.id})).filter(n => n.song === ST.id), ...list]; } catch {}
  ST.notes = list.sort((a, b) => (b.at || '').localeCompare(a.at || '')); renderNotes(); }
function renderNotes(){ const box = $('noteList'); box.innerHTML = '';
  if (!ST.notes.length) box.append(h('div', {class: 'muted small'}, 'No notes yet. Select something (bars, a section, clips, notes, a track), then 👍, 👎 or 💬.'));
  for (const n of ST.notes) box.append(h('div', {class: 'note'}, h('button', {class: 'x', title: 'Remove', onclick: () => delNote(n)}, '✕'),
    h('div', {class: 'tg', onclick: () => goTo(n.target)}, `${n.rating > 0 ? '👍 ' : n.rating < 0 ? '👎 ' : ''}${n.target?.desc || ''}`), n.text ? h('div', {}, n.text) : '', h('div', {class: 'muted small'}, new Date(n.at).toLocaleString())));
  box.append(h('div', {style: 'margin-top:10px; border-top:1px solid var(--line); padding-top:8px'}, h('button', {onclick: revert}, 'Revert this song to Claude’s'))); }
async function delNote(n){ ST.notes = ST.notes.filter(x => x !== n); renderNotes(); if (String(n.id).startsWith('l')) { try { localStorage.setItem('studio.daw.notes', JSON.stringify(localNotes().filter(x => x.id !== n.id))); } catch {} }
  else if (db) try { await db.collection('notes').doc(n.id).delete(); } catch {} }
function goTo(t){ if (!t?.bars) return; const [a, b] = t.bars, tracks = t.tracks?.[0] === 'all tracks' ? ST.P.tracks.map((_, i) => i) : (t.tracks || []).map(nm => ST.P.tracks.findIndex(T => T.name === nm)).filter(i => i >= 0);
  ST.sel = {clips: new Set(), range: {a, b, tracks: tracks.length ? tracks : ST.P.tracks.map((_, i) => i)}, mark: null, track: tracks[0] ?? 0, trackOnly: false}; ST.ph = a; ST.sx = Math.max(0, a*ST.px - 60); draw(); posText(); target(); }
// (the viewer has no confirm(): the button asks once, and a second click within a few seconds does it)
let revArm = 0;
async function revert(e){ const b = e?.target; if (b && Date.now() - revArm > 4000) { revArm = Date.now(); b.textContent = 'Click again: your edits go (Undo brings them back)'; setTimeout(() => { if (b.isConnected) b.textContent = 'Revert this song to Claude’s'; }, 4000); return; }
  revArm = 0; if (!ST.mine) { ST.mine = true; renderVer(); }
  checkpoint(); restoreFrom(ST.orig); flash('Back to Claude’s version'); }
function compose(){ const t = target(); $('notes').hidden = false; $('notesB').setAttribute('aria-pressed', 'true'); $('composer').hidden = false; $('cTarget').textContent = 'About: ' + t.desc; ST.rating = 0; rateBtns(); $('cText').value = ''; $('cText').focus(); }
const rateBtns = () => { $('cUp').setAttribute('aria-pressed', String(ST.rating > 0)); $('cDown').setAttribute('aria-pressed', String(ST.rating < 0)); };
$('cUp').onclick = () => { ST.rating = ST.rating > 0 ? 0 : 1; rateBtns(); }; $('cDown').onclick = () => { ST.rating = ST.rating < 0 ? 0 : -1; rateBtns(); };
$('cCancel').onclick = () => { $('composer').hidden = true; }; $('cSave').onclick = () => { const t = $('cText').value.trim(); if (!t && !ST.rating) return; addNote(ST.rating, t); $('composer').hidden = true; };
$('up').onclick = () => addNote(1); $('down').onclick = () => addNote(-1); $('say').onclick = compose;
$('notesB').onclick = () => { const v = $('notes').hidden; $('notes').hidden = !v; $('notesB').setAttribute('aria-pressed', String(v)); };

/* ---------- the sound panel ---------- */
let SI = null; const SB = makeSounds({ST, E, SND, h, $, isDrum, checkpoint, changed, flash, editable, addNote, trackRange, PHONE, nn, db: () => db, draw: () => draw(), renderEd: () => renderEd(), renderTracks: () => renderTracks(), openClip: () => cur()});
SI = makeSynthUI({ST, E, SB, h, $, isDrum, fx: (mods, T, pad, redo) => MX?.fxInto(mods, T, pad, redo), flash, editable, nn, trackRange, draw: () => draw(), renderEd: () => renderEd(), drawEdHead: () => drawEdHead()});
// one drum picked at a time, the same in the notes, the instrument and the mixer (and the sound panel's voices): the
// sound panel holds it (SB.voice), and whichever tab picks one, the others follow
function pickPad(v){ if (v !== SB.voice()) SB.setVoice(v); else padPicked(); }
function padPicked(){ const T = ST.P.tracks[ST.sel.track], v = SB.voice(); if (!T || !isDrum(T.role) || !v) return; if (ST.ed.row !== v) { ST.ed.row = v; drawEd(); } MX?.pad(T.id, v); }
SB.onChange(padPicked);
MX = makeMixer({ST, E, SND, pickPad, h, $, checkpoint, changed, flash, editable, save, renderTracks: () => renderTracks(), soundName: id => SND[id]?.name || id, get SI(){ return SI; }});
$('tabInst').onclick = () => { MX.show(false); SI.show(true); }; $('tabNotes').onclick = () => { MX.show(false); SI.show(false); };
E.onLive = () => { if (SI.isOn()) SI.render(); };   // (the live voices arrive a moment after the page: the instrument says so then)

/* ---------- start ---------- */
addEventListener('resize', () => { draw(); renderEd(); });
(async () => { let first = null; try { first = localStorage.getItem('studio.daw.song'); } catch {}
  await open(songById(first) ? first : SONGS[0].id);
  try { const c = await window.claude?.use?.('db'); if (c) { db = c; await SB.loadDb(c); await open(ST.id); } } catch {} })();
window.__daw = {ST, E, open, flatten, SB, SND, get SI(){ return SI; }, get MX(){ return MX; }};   // (for tests)
