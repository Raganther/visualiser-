// The Session view: the jam as a clip grid, as in Ableton. A column a track (the same tracks as the Arrangement), a row a
// scene, and beside the scenes the ground (the chords every clip reads). A clip is live: its parts' rhythm and notes
// (Studio Jam's modules, studio/jam/part.js) played over the ground as it goes, with each part's feel and Life, so the
// chords re-voice every clip and Life varies it each time round. A drum rack's clip holds the kick, hats and percussion
// parts, each on its pads. The Clip tab under the grid holds the jam's tools for the chosen clip. The session is kept on
// the project (P.session), seeded from the song's sections (each already a jam scene) the first time it's opened.
import { partNotes } from './flatten.js';
import { split, join, rhythmTool, notesTool, noteTools, isDrum, RHYTHM_TOOLS, NOTE_TOOLS, VOICE0, fresh, sketch } from '../jam/part.js';
import { FEELS, STYLES } from '../jam/model.js';
import { PLAYS } from '../jam/play.js';
import { LIB as PROGS, shortOf } from '../jam/chords.js';
import { isRack, rackSound, PART_ROLES } from './rack.js';

const clone = x => JSON.parse(JSON.stringify(x)), uid = () => 'c' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36);
const DEEP = {id: 'lib-deep', name: 'One chord, deep', bars: Array(8).fill('A:m9')};
const PART_NAME = {kick: 'Kick', hats: 'Hats', perc: 'Percussion', bass: 'Bass', chords: 'Chords', lead: 'Lead'};
const shortName = s => (s || '').split(': ').slice(1).join(': ') || s || 'Scene';

/* ---------- the model ---------- */
// a jam column as a clip part: its rhythm and notes (a clip saved before parts had modules taken apart), feel, Life and the rest
function partOf(c, k){ if (!c || c.mute) return null; let R = c.rhythm, N = c.notes;
  if (!R && c.clip?.steps?.length) { const s = split(c.role, c.clip, c.clip.name || ''); R = s.rhythm; N = s.notes; }
  if (!R?.hits?.length) return null;
  return {role: c.role, k, R: {...clone(R), feel: R.feel ?? c.feel ?? 0}, N: N ? clone(N) : c.role === 'chords' ? fresh({seq: []}, 'The ground') : null,
    play: c.play || 0, oct: c.oct || 0, inv: c.inv || 0, walk: !!c.walk, loop: c.loop || null, voicing: c.voicing || 0}; }
// which of a section's columns a track plays: a drum rack the kick, hats and percussion; a track from the song its own
const colsFor = (T, x) => isRack(T) ? x.cols.map((c, i) => [c, i]).filter(([c]) => PART_ROLES.includes(c.role)) : (m => m && x.cols[+m[1]]?.role === T.role ? [[x.cols[+m[1]], +m[1]]] : [])(/^t(\d+)$/.exec(T.id));
export function seedSession(P, song){ const secs = song?.sections?.length ? song.sections : [];
  const scenes = secs.length ? secs.map((x, si) => ({id: x.id || 's' + si, name: shortName(x.name), ground: {id: x.harmony, name: x.harmonyName || 'Ground', bars: x.harmonyBars || DEEP.bars}}))
    : [{id: 's0', name: 'Scene 1', ground: clone(DEEP)}];
  const cells = {}; for (const T of P.tracks) cells[T.id] = scenes.map((_, si) => { const x = secs[si]; if (!x) return null;
    const parts = colsFor(T, x).map(([c, i]) => partOf({...c, voicing: c.voicing ?? x.cols.find(y => y.role === 'chords')?.voicing}, isRack(T) ? i : 0)).filter(Boolean);
    return parts.length ? {id: uid(), name: [...new Set(parts.map(p => p.R.name).filter(Boolean))].join(' · ') || x.name, parts} : null; });
  return {v: 1, scenes, cells}; }
// a part's notes for one bar from `k` (the jam's 16ths), over the ground at that bar: [{s, p, l, v}]
export function barNotes(part, H, hb, k, start, seed, lane = 0){ const clip = join(part.role, part.R, part.N); if (!clip?.steps.length) return [];
  const lp = part.loop && part.loop[1] <= clip.len && part.loop[1] > part.loop[0] ? part.loop : null, span = lp ? lp[1] - lp[0] : clip.len, n = H.bars.length, b = ((hb % n) + n) % n;
  const c = {role: part.role, rhythm: part.R, notes: part.N, play: part.play, oct: part.oct, inv: part.inv, walk: part.walk, loop: part.loop, phase: (((k - start) % span) + span) % span};
  return partNotes(c, {...H, bars: [...H.bars.slice(b), ...H.bars.slice(0, b)]}, 1, {voicing: part.voicing || 0, seed, lane}); }

/* ---------- the view ---------- */
export function makeSession(A){ const {ST, E, SND, h, $} = A;
  const S = () => ST.P.session, T = i => ST.P.tracks[i], cell = (tid, r) => S()?.cells[tid]?.[r] || null;
  // what plays: each track's clip (its row, the 16th it started on), what's waiting for the next bar, the ground
  const RT = {play: {}, next: {}, nextScene: null, scene: null, H: null, hStart: 0, notes: new Map(), sel: {t: 0, r: 0}, part: 0, undo: []};
  const canEdit = () => { if (ST.mine) return true; A.flash('This is Claude’s version: switch to Yours to change it'); return false; };
  function open(song){ if (!ST.P.session) ST.P.session = seedSession(ST.P, song); for (const T of ST.P.tracks) ST.P.session.cells[T.id] ??= S().scenes.map(() => null);
    RT.play = {}; RT.next = {}; RT.nextScene = null; RT.scene = null; RT.H = null; RT.notes.clear(); RT.undo = []; RT.sel = {t: Math.min(RT.sel.t, ST.P.tracks.length - 1), r: 0}; render(); renderClip(); }
  // the drum voices a part plays, and where they land on its track's pads
  const idsOf = TT => TT.sound?.startsWith('rack:') ? TT.sound.slice(5).split('+') : null;
  const renOf = TT => { const ids = idsOf(TT); return ids ? rackSound(ids, SND).ren : null; };
  const voicesOf = (TT, part) => { if (!isDrum(part.role)) return []; const ids = idsOf(TT), sid = ids ? ids[part.k] : TT.sound; return Object.keys(SND[sid]?.voices || SND[TT.sound]?.voices || {}); };

  /* ---------- playing: the engine asks at each bar line and each 16th ---------- */
  E.session = null;
  const hook = {
    bar(k){ const P = ST.P, Sx = S(); if (!Sx) return;
      if (RT.nextScene != null) { RT.scene = RT.nextScene; RT.H = Sx.scenes[RT.scene]?.ground || RT.H; RT.hStart = k/16; RT.nextScene = null; }
      for (const [tid, r] of Object.entries(RT.next)) { if (r === 'stop') delete RT.play[tid]; else RT.play[tid] = {r, start: k}; } RT.next = {};
      RT.H ??= Sx.scenes[0]?.ground || DEEP;
      P.tracks.forEach((TT, i) => { const pl = RT.play[TT.id], cl = pl && cell(TT.id, pl.r); if (!cl) return; const ren = renOf(TT), lane = P.tracks.filter((x, j) => j < i && x.role === TT.role).length ? 1 : 0;
        cl.parts.forEach((part, j) => { for (const n of barNotes(part, RT.H, k/16 - RT.hStart, k, pl.start, (k*7919 + j*101 + i*13) >>> 0, lane)) {
          const s = Math.floor(n.s + 1e-6), at = k + s, p = isDrum(part.role) ? ren?.[part.k]?.[n.p] || n.p : n.p;
          if (!RT.notes.has(at)) RT.notes.set(at, new Map()); const m = RT.notes.get(at); if (!m.has(i)) m.set(i, []); m.get(i).push({p, l: n.l, v: n.v, off: n.s - s}); } }); });
      A.onBar?.(); },
    at(k){ const m = RT.notes.get(k); RT.notes.delete(k); return m ? [...m.entries()] : []; } };
  function startPlaying(){ E.session = hook; RT.notes.clear(); A.playSession(); }
  // a clip launched: now when stopped (the transport starts), else on the next bar
  function launch(tid, r){ if (!cell(tid, r)) { stopTrack(tid); return; }
    if (!E.playing || E.session !== hook) { RT.play = {}; RT.next = {[tid]: r}; if (RT.H == null) { RT.H = S().scenes[r]?.ground || DEEP; RT.hStart = 0; } startPlaying(); }
    else RT.next[tid] = r; render(); }
  function launchScene(r){ const Sx = S(); if (!Sx.scenes[r]) return; for (const TT of ST.P.tracks) RT.next[TT.id] = cell(TT.id, r) ? r : 'stop'; RT.nextScene = r;
    if (!E.playing || E.session !== hook) { RT.play = {}; RT.H = Sx.scenes[r].ground; RT.hStart = 0; startPlaying(); }
    A.flash(`Scene: ${Sx.scenes[r].name}${E.playing ? ', next bar' : ''}`); render(); }
  function stopTrack(tid){ if (E.playing && E.session === hook) RT.next[tid] = 'stop'; else delete RT.play[tid]; render(); }
  function stopAll(){ RT.next = {}; RT.play = {}; RT.scene = null; if (E.playing && E.session === hook) A.stopTransport(); render(); }

  /* ---------- the grid ---------- */
  function render(){ const box = $('sessWrap'), Sx = S(); if (!box || !Sx) return; box.innerHTML = ''; const P = ST.P, cols = P.tracks.length;
    const grid = h('div', {class: 'sgrid', style: `grid-template-columns: 170px repeat(${cols}, 176px)`});
    grid.append(h('div', {class: 'shead scol'}, h('b', {}, 'Scenes'), h('span', {class: 'small muted'}, 'and their ground')));
    P.tracks.forEach((TT, i) => grid.append(h('div', {class: 'shead', 'data-sel': RT.sel.t === i ? '1' : '', style: `border-top:4px solid ${A.colorOf(TT, i)}`, onclick: () => select(i, RT.sel.r)},
      h('b', {}, TT.name), h('span', {class: 'small muted'}, SND[TT.sound]?.name || TT.sound),
      h('span', {class: 'shbtn'}, h('button', {class: 'ms', 'aria-pressed': String(!!TT.mute), title: 'Mute', onclick: e => { e.stopPropagation(); TT.mute = !TT.mute; A.mixChanged(); render(); }}, 'M'),
        h('button', {class: 'ms s', 'aria-pressed': String(!!TT.mix.solo), title: 'Solo', onclick: e => { e.stopPropagation(); TT.mix.solo = !TT.mix.solo; A.mixChanged(); render(); }}, 'S')))));
    Sx.scenes.forEach((sc, r) => {
      grid.append(h('div', {class: 'scene', 'data-on': RT.scene === r ? '1' : '', 'data-next': RT.nextScene === r ? '1' : ''},
        h('button', {class: 'sgo', title: `Launch the scene (${r + 1})`, onclick: () => launchScene(r)}, '▶'),
        h('div', {class: 'sname'}, h('b', {}, sc.name), h('button', {class: 'ground', title: 'The ground: the chords every clip in this scene reads. Click to change it', onclick: e => groundMenu(e.currentTarget, r)}, groundWords(sc.ground)))));
      P.tracks.forEach((TT, i) => { const cl = cell(TT.id, r), pl = RT.play[TT.id], on = pl?.r === r, nx = RT.next[TT.id];
        const b = h('button', {class: 'slot', 'data-t': i, 'data-r': r, 'data-has': cl ? '1' : '', 'data-on': on ? '1' : '', 'data-next': nx === r ? '1' : nx === 'stop' && on ? 'stop' : '', 'data-sel': RT.sel.t === i && RT.sel.r === r ? '1' : '',
          style: cl ? `--c:${A.colorOf(TT, i)}` : '', title: cl ? `${cl.name}: click to launch` : 'Empty: click to stop this track, double-click for a new clip'},
          ...(cl ? [h('span', {class: 'go'}, on ? '■' : '▶'), h('span', {class: 'cn'}, cl.name), h('span', {class: 'sk'}, sketch(cl.parts[0].R)), h('i', {class: 'prog'})] : [h('span', {class: 'empty'}, '·')]));
        b.onclick = () => { select(i, r); if (cl) on && !nx ? stopTrack(TT.id) : launch(TT.id, r); else stopTrack(TT.id); };
        b.ondblclick = () => { if (!cl) newClip(i, r); };
        grid.append(b); }); });
    grid.append(h('div', {class: 'scene foot'}, h('button', {class: 'sgo', title: 'Stop every track', onclick: stopAll}, '■'), h('span', {class: 'small'}, 'Stop all'),
      h('button', {class: 'mini', title: 'A new empty scene', onclick: addScene}, '＋ Scene'), h('button', {class: 'mini', title: 'A new scene holding what plays now', onclick: capture}, 'Capture')));
    P.tracks.forEach(TT => grid.append(h('button', {class: 'slot stop', title: `Stop ${TT.name}`, onclick: () => stopTrack(TT.id)}, '■')));
    box.append(grid); }
  const groundWords = H => H?.bars ? [...new Set(H.bars)].slice(0, 4).map(shortOf).join(' · ') + (new Set(H.bars).size > 4 ? ' …' : '') : '—';
  // the playing clips' progress round their loops, each frame
  function frame(){ if (!E.playing || E.session !== hook) return; const pos = E.pos(); if (pos == null) return;
    for (const b of document.querySelectorAll('#sessWrap .slot[data-on="1"]')) { const TT = T(+b.dataset.t), pl = RT.play[TT.id], cl = pl && cell(TT.id, pl.r); if (!cl) continue;
      const len = join(cl.parts[0].role, cl.parts[0].R, cl.parts[0].N)?.len || 16; const pr = b.querySelector('.prog'); if (pr) pr.style.width = (((pos - pl.start) % len + len) % len)/len*100 + '%'; } }
  function select(t, r){ RT.sel = {t, r}; RT.part = 0; A.selTrack(t); render(); renderClip(); }
  function groundMenu(at, r){ const Sx = S(), seen = new Map(); for (const sc of Sx.scenes) seen.set(sc.ground.id + JSON.stringify(sc.ground.bars), sc.ground);
    const items = [...seen.values(), ...PROGS].map(H => ({label: `${H.name}`, note: groundWords(H), run: () => { if (!canEdit()) return; Sx.scenes[r].ground = clone({id: H.id, name: H.name, bars: H.bars});
      if (RT.scene === r && E.playing) { RT.H = Sx.scenes[r].ground; } A.save(); render(); A.flash(`${Sx.scenes[r].name}: ${H.name}`); }}));
    A.popup(at, items.slice(0, 40)); }
  function addScene(){ if (!canEdit()) return; const Sx = S(), g = Sx.scenes[Sx.scenes.length - 1]?.ground || DEEP; Sx.scenes.push({id: 's' + uid(), name: `Scene ${Sx.scenes.length + 1}`, ground: clone(g)});
    for (const TT of ST.P.tracks) Sx.cells[TT.id].push(null); A.save(); render(); }
  function capture(){ if (!canEdit()) return; const Sx = S(), r = Sx.scenes.length; Sx.scenes.push({id: 's' + uid(), name: `Scene ${r + 1}`, ground: clone(RT.H || Sx.scenes[0]?.ground || DEEP)});
    for (const TT of ST.P.tracks) { const pl = RT.play[TT.id], cl = pl && cell(TT.id, pl.r); Sx.cells[TT.id].push(cl ? {...clone(cl), id: uid()} : null); }
    A.save(); render(); A.flash(`Captured as ${Sx.scenes[r].name}`); }
  function newClip(t, r){ if (!canEdit()) return; const TT = T(t), roles = isRack(TT) ? ['kick', 'hats'] : [TT.role === 'drums' ? 'kick' : TT.role];
    const parts = roles.map((role, j) => { const k = isRack(TT) ? PART_ROLES.indexOf(role) : 0, p0 = {role, k}, vs = voicesOf(TT, p0), R = rhythmTool('new', role, null, null, Math.random, vs.length ? vs : [VOICE0[role]]).rhythm;
      return {role, k, R, N: role === 'chords' ? fresh({seq: []}, 'The ground') : notesTool('new', role, null, Math.random, {n: R.hits.length, voices: vs}), play: 0, oct: 0, inv: 0, walk: false, loop: null, voicing: 0}; });
    S().cells[TT.id][r] = {id: uid(), name: parts.map(p => p.R.name).join(' · '), parts}; A.save(); select(t, r); A.flash('A new clip: shape it below'); }

  /* ---------- the Clip tab: the chosen clip's parts, rhythm and notes, with the jam's tools ---------- */
  const selCell = () => { const TT = T(RT.sel.t); return TT && cell(TT.id, RT.sel.r); };
  function edit(fn, words){ const cl = selCell(); if (!cl || !canEdit()) return; RT.undo.push({t: RT.sel.t, r: RT.sel.r, json: JSON.stringify(cl)}); if (RT.undo.length > 60) RT.undo.shift();
    fn(cl, cl.parts[Math.min(RT.part, cl.parts.length - 1)]); cl.name = [...new Set(cl.parts.map(p => p.R.name).filter(Boolean))].join(' · ') || cl.name; A.save(); render(); renderClip(); if (words) A.flash(words + (E.playing ? ': from the next bar' : '')); }
  function undo(){ const u = RT.undo.pop(); if (!u) { A.flash('Nothing to undo in the clip'); return; } const TT = T(u.t); S().cells[TT.id][u.r] = JSON.parse(u.json); RT.sel = {t: u.t, r: u.r}; A.save(); render(); renderClip(); A.flash('Undone'); }
  function rTool(k){ edit((cl, p) => { const out = rhythmTool(k, p.role, p.R, p.N, Math.random, voicesOf(T(RT.sel.t), p)); if (!out) { A.flash('That can’t be done to this rhythm'); return; } p.R = {...out.rhythm, feel: p.R.feel}; if (out.notes) p.N = out.notes; }, `Rhythm: ${RHYTHM_TOOLS[k]}`); }
  function nTool(k){ edit((cl, p) => { const out = notesTool(k, p.role, p.N, Math.random, {n: p.R.hits.length, voices: voicesOf(T(RT.sel.t), p)}); if (!out) { A.flash('That can’t be done to these notes'); return; } p.N = out; }, `Notes: ${NOTE_TOOLS[k]}`); }
  function toggleHit(s){ edit((cl, p) => { const i = p.R.hits.findIndex(x => x[0] === s); if (i >= 0) { if (p.R.hits.length < 2) return; p.R.hits = p.R.hits.filter((_, j) => j !== i); } else p.R.hits = [...p.R.hits, [s, 1, .8]].sort((a, b) => a[0] - b[0]); }); }
  function renderClip(){ const box = $('clipPane'); if (!box) return; box.innerHTML = ''; const TT = T(RT.sel.t), sc = S()?.scenes[RT.sel.r], cl = selCell();
    if (!TT || !sc) return;
    if (!cl) { box.append(h('div', {class: 'cempty'}, h('b', {}, `${TT.name} · ${sc.name}: empty`), h('button', {onclick: () => newClip(RT.sel.t, RT.sel.r)}, '＋ New clip'), h('span', {class: 'small muted'}, 'or double-click an empty slot'))); return; }
    const p = cl.parts[Math.min(RT.part, cl.parts.length - 1)], drum = isDrum(p.role);
    const head = h('div', {class: 'chead'}, h('b', {}, cl.name), h('span', {class: 'small muted'}, `${TT.name} · ${sc.name} · over ${sc.ground.name}`));
    if (cl.parts.length > 1) head.append(h('span', {class: 'seg parts'}, ...cl.parts.map((q, j) => h('button', {'aria-pressed': String(q === p), onclick: () => { RT.part = j; renderClip(); }}, PART_NAME[q.role] || q.role))));
    head.append(h('span', {class: 'spacer'}), h('button', {title: 'Undo the last change to a clip', onclick: undo}, '↶ Undo'), h('button', {class: 'danger', title: 'Delete the clip', onclick: () => { if (!canEdit()) return; S().cells[TT.id][RT.sel.r] = null; A.save(); render(); renderClip(); }}, 'Delete'));
    // the rhythm: when it plays (its steps, a hit each lit), its feel and Life, its tools
    const R = p.R, steps = h('div', {class: 'steps', style: `grid-template-columns: repeat(${Math.min(16, R.len)}, 1fr)`});
    for (let s = 0; s < R.len; s++) { const hit = R.hits.find(x => x[0] === s); steps.append(h('button', {class: 'st', 'data-on': hit ? (hit[2] > .8 ? '2' : '1') : '', 'data-beat': s % 4 === 0 ? '1' : '', title: `Step ${s + 1}`, onclick: () => toggleHit(s)})); }
    const sel = (lab, list, val, set, title) => h('label', {class: 'small', title}, lab + ' ', (() => { const x = h('select', {}, ...list.map((n, i) => h('option', {value: i}, n))); x.value = val; x.onchange = () => set(+x.value); return x; })());
    const rhythm = h('section', {class: 'cmod'}, h('div', {class: 'cmh'}, h('b', {}, 'Rhythm'), h('span', {class: 'small muted'}, `when · ${R.name || ''} · ${R.len} steps, ${R.hits.length} hits`),
        sel('Feel', FEELS.map(f => f.name), R.feel || 0, v => edit((c, q) => { q.R = {...q.R, feel: v}; }, `Feel: ${FEELS[v].name}`), 'How it sits in the groove (F)'),
        sel('Life', PLAYS.map(x => x.name), p.play || 0, v => edit((c, q) => { q.play = v; }, `Life: ${PLAYS[v].name}`), 'Life improvises on the riff each time round (P)')),
      steps, h('div', {class: 'tools'}, ...Object.entries(RHYTHM_TOOLS).map(([k, n]) => h('button', {onclick: () => rTool(k)}, n))));
    // the notes: what it plays, in order, one a hit, going round (chords play the ground itself)
    const seq = p.N?.seq || [], chips = h('div', {class: 'nseq'}, ...(p.role === 'chords' ? [h('span', {class: 'small muted'}, 'Plays the ground’s chords')] : seq.map(x => h('span', {class: 'nchip'}, drum ? x : `${x[0] + 1}${x[1] > 0 ? '↑' : x[1] < 0 ? '↓' : ''}`))));
    const notes = h('section', {class: 'cmod'}, h('div', {class: 'cmh'}, h('b', {}, 'Notes'), h('span', {class: 'small muted'}, drum ? 'which drums, in turn' : p.role === 'chords' ? 'the ground, voiced' : 'chord tones (1 the root), in turn: they follow the ground'),
        ...(drum ? [] : [h('span', {class: 'oct'}, 'Octave ', h('button', {onclick: () => edit((c, q) => { q.oct = Math.max(-2, (q.oct || 0) - 1); }, 'Octave down')}, '−'), h('b', {}, String(p.oct || 0)), h('button', {onclick: () => edit((c, q) => { q.oct = Math.min(2, (q.oct || 0) + 1); }, 'Octave up')}, '+'))]),
        ...(p.role === 'chords' ? [sel('Voicing', STYLES, p.voicing || 0, v => edit((c, q) => { q.voicing = v; }, `Voicing: ${STYLES[v]}`)), h('span', {class: 'oct'}, 'Inversion ', h('button', {onclick: () => edit((c, q) => { q.inv = (q.inv || 0) - 1; }, 'Inversion down')}, '−'), h('b', {}, String(p.inv || 0)), h('button', {onclick: () => edit((c, q) => { q.inv = (q.inv || 0) + 1; }, 'Inversion up')}, '+'))] : [])),
      chips, h('div', {class: 'tools'}, ...noteTools(p.role).map(k => h('button', {onclick: () => nTool(k)}, NOTE_TOOLS[k]))));
    box.append(head, h('div', {class: 'cmods'}, rhythm, notes)); }

  /* ---------- keys, while the Session shows ---------- */
  function key(e){ const k = e.key.toLowerCase(), cl = selCell(), Sx = S(); if (!Sx) return false;
    if (/^[1-9]$/.test(e.key) && !e.shiftKey) { launchScene(+e.key - 1); return true; }
    if (e.key === 'Enter') { launchScene(RT.sel.r); return true; }
    if (e.key.startsWith('Arrow')) { const t = RT.sel.t + (e.key === 'ArrowRight') - (e.key === 'ArrowLeft'), r = RT.sel.r + (e.key === 'ArrowDown') - (e.key === 'ArrowUp');
      select(Math.max(0, Math.min(ST.P.tracks.length - 1, t)), Math.max(0, Math.min(Sx.scenes.length - 1, r))); return true; }
    if (e.key === ' ' ) return false;
    if (k === 'p' && cl) { const p = cl.parts[Math.min(RT.part, cl.parts.length - 1)]; edit((c, q) => { q.play = ((q.play || 0) + 1) % PLAYS.length; }, `Life: ${PLAYS[((p.play || 0) + 1) % PLAYS.length].name}`); return true; }
    if (k === 'f' && cl) { const p = cl.parts[Math.min(RT.part, cl.parts.length - 1)], v = ((p.R.feel || 0) + 1) % FEELS.length; edit((c, q) => { q.R = {...q.R, feel: v}; }, `Feel: ${FEELS[v].name}`); return true; }
    if (k === 'v' && cl) { e.shiftKey ? nTool('vary') : rTool('vary'); return true; }
    if (k === 'n' && cl) { rTool('new'); return true; }
    if (k === 'z' && !e.metaKey && !e.ctrlKey) { undo(); return true; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && cl && canEdit()) { const TT = T(RT.sel.t); S().cells[TT.id][RT.sel.r] = null; A.save(); render(); renderClip(); return true; }
    if (k === 'l') { const TT = T(RT.sel.t); if (cl) launch(TT.id, RT.sel.r); return true; }
    return false; }
  return {open, render, renderClip, frame, key, launch, launchScene, stopAll, stopTrack, hook, RT, stop: () => { RT.play = {}; RT.next = {}; RT.scene = null; render(); }, select}; }
