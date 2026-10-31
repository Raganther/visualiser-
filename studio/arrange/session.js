// The Session view: the jam as a clip grid, as in Ableton. A column a track (the same tracks as the Arrangement), a row a
// scene, and beside the scenes the ground (the chords every clip reads). A clip is the same as the Arrangement's
// (clips.js): live (its parts' rhythm and notes, studio/jam/part.js, played over the ground as it goes, with each part's
// feel and Life) or notes. A drum rack's live clip holds the kick, hats and percussion parts, each on its pads. The Clip
// tab under the grid holds the jam's tools for the chosen clip, in either view. The Session and the Arrangement are two
// collections of clips, copied between on purpose: Send to Session takes bars of the song into a scene, recording writes
// what plays into the timeline, and a copy remembers where it came from (`from`), showing when it's been changed and
// putting itself back. While the Arrangement plays, a clip launched takes its track over until Back to Arrangement.
// Seeded from the song's sections (each already a jam scene) the first time it's opened; kept on the project (P.session).
import { split, join, rhythmTool, notesTool, noteTools, isDrum, RHYTHM_TOOLS, NOTE_TOOLS, VOICE0, fresh, sketch } from '../jam/part.js';
import { FEELS, STYLES } from '../jam/model.js';
import { PLAYS } from '../jam/play.js';
import { LIB as PROGS, shortOf } from '../jam/chords.js';
import { isRack, rackSound, PART_ROLES, padRole } from './rack.js';
import { barNotes, isLive, loopLen, liveNotes, sigOf, freeze, makeLive, cutRange, sliceTrack, layClip } from './clips.js';
import PACK1 from '../listen/packs/pack-1.json';
import PACK2 from '../listen/packs/pack-2.json';
import PACK3 from '../listen/packs/pack-3.json';
import { clone } from '../lib/dom.js';
import { rhythmsByRole, stepIn } from '../lib/library.js';
import { VNAME, PART_NAMES as PART_NAME, partName, pitchName } from '../lib/names.js';
export { barNotes };

const uid = () => 'c' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36);
const DEEP = {id: 'lib-deep', name: 'One chord, deep', bars: Array(8).fill('A:m9')};



// a new part's first rhythm, by what the drum is (16 steps): somewhere to start, shaped with the tools
const START = [[/^kick/, [0, 4, 8, 12]], [/^(chh|hat)/, [2, 6, 10, 14]], [/^ohh/, [2, 10]], [/^(snare|clap)/, [4, 12]], [/^tom/, [13, 14, 15]], [/^(ride|crash|gong|bowl)/, [0]], [/./, [3, 7, 11, 14]]];
const startHits = pad => START.find(([re]) => re.test(pad))[1].map(s => [s, 1, .8]);
const gcd = (a, b) => b ? gcd(b, a % b) : a;
// the library's rhythms for each kind of part (the jam's packs: what ‹ › steps through), each once
const LIBR = rhythmsByRole([PACK1, PACK2, PACK3]);
const shortName = s => (s || '').split(': ').slice(1).join(': ') || s || 'Scene';
const nn = pitchName;

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
// a notes clip's notes in one bar from 16th k, its loop L long, started at `start` (s from the bar's start)
function fixedBar(cl, k, start){ const L = cl.len || 16, out = [];
  for (let j = 0; j < 16; j++) { const pos = (((k + j - start + (cl.off || 0)) % L) + L) % L; for (const n of cl.notes) if (Math.floor(n.s + 1e-6) === pos) out.push({s: j + (n.s - pos), p: n.p, l: n.l, v: n.v}); }
  return out; }
// a notes clip's hits as a rhythm (for the grid's little picture)
const pseudoR = cl => ({len: Math.min(16, cl.len || 16), hits: [...new Set(cl.notes.filter(n => n.s < 16).map(n => Math.floor(n.s)))].map(s => [s, 1, .8])});

/* ---------- the view ---------- */
export function makeSession(A){ const {ST, E, SND, h, $} = A;
  const S = () => ST.P.session, T = i => ST.P.tracks[i], cell = (tid, r) => S()?.cells[tid]?.[r] || null;
  // what plays: each track's clip (its row, the 16th it started on), what's waiting for the next bar, the ground; the
  // mode (the Session alone, or over the Arrangement: `own` the tracks it has taken over); recording into the timeline
  const RT = {whole: (() => { try { return localStorage.getItem('studio.daw.whole') === '1'; } catch { return false; } })(), mode: 'session', own: new Set(), play: {}, next: {}, nextScene: null, scene: null, H: null, hStart: 0, notes: new Map(), sel: {t: 0, r: 0}, part: 0, undo: [], rec: null};
  const canEdit = () => { if (ST.mine) return true; A.flash('This is Claude’s version: switch to Yours to change it'); return false; };
  function open(song){ if (!ST.P.session) ST.P.session = seedSession(ST.P, song); fill();
    RT.play = {}; RT.next = {}; RT.nextScene = null; RT.scene = null; RT.H = null; RT.notes.clear(); RT.undo = []; RT.own.clear(); RT.rec = null; RT.sel = {t: Math.min(RT.sel.t, ST.P.tracks.length - 1), r: 0}; render(); renderClip(); }
  const fill = () => { for (const TT of ST.P.tracks) S().cells[TT.id] ??= S().scenes.map(() => null); };
  // the drum voices a part plays, and where they land on its track's pads
  const idsOf = TT => TT.sound?.startsWith('rack:') ? TT.sound.slice(5).split('+') : null;
  const renOf = TT => { const ids = idsOf(TT); return ids ? rackSound(ids, SND).ren : null; };
  const voicesOf = (TT, part) => { if (!isDrum(part.role)) return []; if (part.pads?.length) return part.pads;   // (a part added on its own pads)
    const ids = idsOf(TT), sid = ids ? ids[part.k] : TT.sound; return Object.keys(SND[sid]?.voices || SND[TT.sound]?.voices || {}); };
  const laneOf = (P, i) => P.tracks.filter((x, j) => j < i && x.role === P.tracks[i].role).length ? 1 : 0;
  // the ground at the bar: the scene's while the Session plays alone, the song's own chords while it plays over the Arrangement
  const harmAt = k => RT.mode === 'mix' ? {H: {id: 'lane', bars: ST.P.chords?.length ? ST.P.chords : DEEP.bars}, hb: k/16} : {H: RT.H, hb: k/16 - RT.hStart};

  /* ---------- playing: the engine asks at each bar line and each 16th ---------- */
  E.session = null;
  const hook = {
    owns: i => RT.mode === 'session' || RT.own.has(T(i)?.id), endless: () => RT.mode === 'session',
    bar(k, t){ const P = ST.P, Sx = S(); if (!Sx) return; const moved = RT.nextScene != null || Object.keys(RT.next).length > 0;
      if (RT.nextScene != null) { RT.scene = RT.nextScene; RT.H = Sx.scenes[RT.scene]?.ground || RT.H; RT.hStart = k/16; RT.nextScene = null; }
      for (const [tid, r] of Object.entries(RT.next)) { if (RT.mode === 'mix') RT.own.add(tid); if (r === 'stop') delete RT.play[tid]; else RT.play[tid] = {r, start: k}; } RT.next = {};
      RT.H ??= Sx.scenes[0]?.ground || DEEP; const {H, hb} = harmAt(k);
      P.tracks.forEach((TT, i) => { if (!hook.owns(i)) return; const pl = RT.play[TT.id], cl = pl && cell(TT.id, pl.r); if (!cl) return; const ren = renOf(TT), lane = laneOf(P, i);
        const put = (n, p) => { const s = Math.floor(n.s + 1e-6), at = k + s; if (!RT.notes.has(at)) RT.notes.set(at, new Map()); const m = RT.notes.get(at); if (!m.has(i)) m.set(i, []); m.get(i).push({p, l: n.l, v: n.v, off: n.s - s}); };
        if (!isLive(cl)) { for (const n of fixedBar(cl, k, pl.start)) put(n, n.p); return; }
        cl.parts.forEach((part, j) => { for (const n of barNotes(part, H, hb, k, pl.start - (cl.off || 0), (k*7919 + j*101 + i*13) >>> 0, lane)) put(n, isDrum(part.role) ? ren?.[part.k]?.[n.p] || n.p : n.p); }); });
      if (RT.rec) record(k);
      // (the grid shows the change when it's heard: the bar is scheduled a moment ahead of the speakers)
      if (moved || RT.rec) setTimeout(() => { render(); A.arrChanged?.(); }, Math.max(0, ((t ?? E.ctx.currentTime) - E.ctx.currentTime)*1000)); },
    at(k){ const m = RT.notes.get(k); RT.notes.delete(k); return m ? [...m.entries()] : []; } };
  // the Session playing alone, from the Arrangement's playhead (so what's recorded lands where you'd expect)
  function startPlaying(){ RT.mode = 'session'; RT.own.clear(); E.session = hook; RT.notes.clear(); A.playSession(); }
  // the Arrangement playing, the Session ready to take tracks over
  function mixHook(){ RT.mode = 'mix'; RT.own.clear(); RT.play = {}; RT.next = {}; RT.scene = null; RT.notes.clear(); return hook; }
  const live = () => E.playing && E.session === hook;
  // a clip launched: now when stopped (the transport starts), else on the next bar
  function launch(tid, r){ if (!cell(tid, r)) { stopTrack(tid); return; }
    if (!live()) { RT.play = {}; RT.next = {[tid]: r}; if (RT.H == null) { RT.H = S().scenes[r]?.ground || DEEP; RT.hStart = 0; } startPlaying(); }
    else RT.next[tid] = r; render(); }
  function launchScene(r){ const Sx = S(); if (!Sx.scenes[r]) return; for (const TT of ST.P.tracks) RT.next[TT.id] = cell(TT.id, r) ? r : 'stop'; RT.nextScene = r;
    if (!live()) { RT.play = {}; RT.H = Sx.scenes[r].ground; RT.hStart = 0; startPlaying(); }
    A.flash(`Scene: ${Sx.scenes[r].name}${E.playing ? ', next bar' : ''}`); render(); }
  function stopTrack(tid){ if (live()) RT.next[tid] = 'stop'; else delete RT.play[tid]; render(); }
  function stopAll(){ RT.next = {}; RT.play = {}; RT.scene = null; if (live() && RT.mode === 'session') A.stopTransport(); else if (live()) for (const TT of ST.P.tracks) RT.own.add(TT.id); render(); }
  // Back to Arrangement: every track the timeline's again, from the next 16th
  function backToArr(){ RT.own.clear(); RT.play = {}; RT.next = {}; RT.scene = null; render(); A.arrChanged?.(); A.flash('Back to the arrangement'); }

  /* ---------- recording what plays into the Arrangement, bar by bar where it's heard ---------- */
  function recToggle(){ if (RT.rec) { RT.rec = null; A.flash('Recorded into the arrangement'); A.recOn(false); A.changed(); return; }
    if (!canEdit()) return; A.checkpoint(); RT.rec = {last: {}}; A.recOn(true); A.flash('Recording into the arrangement from the next bar'); }
  function record(k){ const P = ST.P, bar = k/16, R = RT.rec, Sx = S();
    if (bar >= P.bars) { const last = P.chords[P.chords.length - 1] || 'A:m9'; while (P.chords.length < bar + 1) P.chords.push(last); P.bars = bar + 1; }
    // the chords: the scene's ground at this bar (over the Arrangement, the song's own stay)
    if (RT.mode === 'session') { const n = RT.H.bars.length, hb = ((bar - RT.hStart) % n + n) % n; P.chords[bar] = RT.H.bars[hb];
      // the sections: a scene's run of bars is one, named after it
      const name = RT.scene != null ? Sx.scenes[RT.scene]?.name : 'Jam', m = P.marks.find(x => x.at + x.bars === bar && x.rec === R.id && x.name === name);
      P.marks = P.marks.filter(x => !(x.at >= bar && x.at < bar + 1)).map(x => x.at < bar && x.at + x.bars > bar ? {...x, bars: bar - x.at} : x);
      if (m && P.marks.includes(m)) m.bars++; else P.marks.push({id: 'rec' + uid(), name, at: bar, bars: 1, rec: R.id ??= uid(), why: '', harmony: RT.H.name}); P.marks.sort((a, b) => a.at - b.at); }
    P.tracks.forEach((TT, i) => { if (!hook.owns(i)) return; const pl = RT.play[TT.id], cl = pl && cell(TT.id, pl.r), last = R.last[TT.id];
      const prev = last && TT.clips.find(c => c.id === last.id);
      if (cl && prev && last.cell === cl.id && last.sig === sigOf(cl) && Math.abs(prev.start + prev.len/16 - bar) < 1e-6) {   // (the same clip carrying on: longer)
        if (!isLive(cl)) prev.notes.push(...fixedBar(cl, k, pl.start).map(n => ({...n, s: +(n.s + prev.len).toFixed(3)})));
        prev.len += 16; prev._k = undefined; return; }
      cutRange(TT, bar, bar + 1); delete R.last[TT.id]; if (!cl) return;
      const id = 'rc' + uid(), phase = (((k - pl.start + (cl.off || 0)) % loopLen(cl)) + loopLen(cl)) % loopLen(cl);
      const c = isLive(cl) ? {id, start: bar, len: 16, name: cl.name, parts: clone(cl.parts), off: phase, notes: [], set: {}}
        : {id, start: bar, len: 16, name: cl.name, notes: fixedBar(cl, k, pl.start), set: {}};
      c.from = {cell: cl.id, scene: Sx.scenes[pl.r]?.name || '', sig: sigOf(cl)}; TT.clips.push(c); TT.clips.sort((x, y) => x.start - y.start); R.last[TT.id] = {id, cell: cl.id, sig: sigOf(cl)}; }); }

  /* ---------- Send to Session, and back ---------- */
  // bars [a, b) of the song as a new scene: each track's clips there as one clip (a single live one stays live), the
  // song's chords there as its ground; each remembers where it came from
  function fromArr(a, b, name){ if (!canEdit()) return; const P = ST.P, Sx = S(); fill(); const r = Sx.scenes.length;
    Sx.scenes.push({id: 's' + uid(), name: name || `Bars ${a + 1}–${b}`, ground: {id: 'arr' + a, name: `the song’s chords, bars ${a + 1}–${b}`, bars: P.chords.slice(a, b).length ? P.chords.slice(a, b) : DEEP.bars}, from: {song: ST.id, a, b}});
    for (const TT of P.tracks) { const x = sliceTrack(TT, a, b); let c = null;
      if (x && (isLive(x) || x.notes.length)) { c = {id: uid(), ...x}; c.from = {song: ST.id, track: TT.id, a, b, sig: sigOf(c)}; }
      Sx.cells[TT.id].push(c); }
    A.save(); RT.sel = {t: RT.sel.t, r}; A.setView('session'); render(); renderClip(); A.flash(`Bars ${a + 1}–${b} are a scene now: jam on them, then Put back or record over`); }
  // a copy put back over the bars it came from (its notes going round to fill them), and marked as matching again
  function putBack(TT, c){ const f = c.from; if (!f || f.song !== ST.id || !canEdit()) return false; A.checkpoint();
    cutRange(TT, f.a, f.b); TT.clips.push(layClip(c, f.a, f.b, 'pb' + uid())); TT.clips.sort((x, y) => x.start - y.start); f.sig = sigOf(c); return true; }
  function putBackCell(t, r){ const TT = T(t), c = cell(TT.id, r); if (c && putBack(TT, c)) { A.changed(); render(); renderClip(); A.flash(`Put back: ${TT.name}, bars ${c.from.a + 1}–${c.from.b}`); } }
  function putBackScene(r){ const Sx = S(), sc = Sx.scenes[r]; if (!sc?.from || sc.from.song !== ST.id || !canEdit()) return; let n = 0;
    for (const TT of ST.P.tracks) { const c = cell(TT.id, r); if (c?.from && sigOf(c) !== c.from.sig && putBack(TT, c)) n++; }
    A.changed(); render(); renderClip(); A.flash(n ? `Put back ${n} changed clip${n > 1 ? 's' : ''} into bars ${sc.from.a + 1}–${sc.from.b}` : 'Nothing changed to put back'); }
  const changedCopy = c => !!c?.from?.sig && c.from.song === ST.id && sigOf(c) !== c.from.sig;

  /* ---------- the grid ---------- */
  function render(){ const box = $('sessWrap'), Sx = S(); if (!box || !Sx) return; fill(); box.innerHTML = '';
    if (RT.stack) { renderStack(box, Sx); A.renderBack?.(RT.mode === 'mix' && E.playing && RT.own.size > 0); return; } const P = ST.P, cols = P.tracks.length;
    const grid = h('div', {class: 'sgrid', style: `grid-template-columns: 170px repeat(${cols}, 176px)`});
    grid.append(h('div', {class: 'shead scol'}, h('b', {}, 'Scenes'), h('span', {class: 'small muted'}, RT.mode === 'mix' && E.playing ? 'over the song’s chords' : 'and their ground')));
    P.tracks.forEach((TT, i) => grid.append(h('div', {class: 'shead', 'data-sel': RT.sel.t === i ? '1' : '', 'data-own': RT.mode === 'mix' && RT.own.has(TT.id) ? '1' : '', style: `border-top:4px solid ${A.colorOf(TT, i)}`, onclick: () => select(i, RT.sel.r)},
      h('b', {}, TT.name), h('span', {class: 'small muted'}, SND[TT.sound]?.name || TT.sound),
      h('span', {class: 'shbtn'}, h('button', {class: 'ms', 'aria-pressed': String(!!TT.mute), title: 'Mute', onclick: e => { e.stopPropagation(); TT.mute = !TT.mute; A.mixChanged(); render(); }}, 'M'),
        h('button', {class: 'ms s', 'aria-pressed': String(!!TT.mix.solo), title: 'Solo', onclick: e => { e.stopPropagation(); TT.mix.solo = !TT.mix.solo; A.mixChanged(); render(); }}, 'S')))));
    Sx.scenes.forEach((sc, r) => { const back = sc.from?.song === ST.id && P.tracks.some(TT => changedCopy(cell(TT.id, r)));
      grid.append(h('div', {class: 'scene', 'data-on': RT.scene === r ? '1' : '', 'data-next': RT.nextScene === r ? '1' : ''},
        h('button', {class: 'sgo', title: `Launch the scene (${r + 1})`, onclick: () => launchScene(r)}, '▶'),
        h('div', {class: 'sname'}, h('b', {}, sc.name), h('span', {class: 'srow'}, h('button', {class: 'ground', title: 'The ground: the chords every clip in this scene reads. Click to change it', onclick: e => groundMenu(e.currentTarget, r)}, groundWords(sc.ground)),
          ...(back ? [h('button', {class: 'putback', title: `Put this scene's changed clips back into the song, bars ${sc.from.a + 1}–${sc.from.b}`, onclick: () => putBackScene(r)}, '↩ Put back')] : [])))));
      P.tracks.forEach((TT, i) => { const cl = cell(TT.id, r), pl = RT.play[TT.id], on = pl?.r === r, nx = RT.next[TT.id], ch = changedCopy(cl);
        const b = h('button', {class: 'slot', 'data-t': i, 'data-r': r, 'data-has': cl ? '1' : '', 'data-on': on ? '1' : '', 'data-next': nx === r ? '1' : nx === 'stop' && on ? 'stop' : '', 'data-sel': RT.sel.t === i && RT.sel.r === r ? '1' : '',
          style: cl ? `--c:${A.colorOf(TT, i)}` : '', title: cl ? (on ? `${cl.name}: playing (■ stops it)` : `${cl.name}: click to launch`) + (cl.from?.a != null ? ` · from bars ${cl.from.a + 1}–${cl.from.b}${ch ? ', changed' : ''}` : '') : 'Empty: click to stop this track, double-click for a new clip'},
          ...(cl ? [h('span', {class: 'go'}, on ? '■' : '▶'), h('span', {class: 'cn'}, (isLive(cl) ? '' : '♪ ') + cl.name), h('span', {class: 'sk'}, sketch(isLive(cl) ? cl.parts[0].R : pseudoR(cl)), ch ? h('em', {class: 'chg'}, ' changed') : ''), h('i', {class: 'prog'})] : [h('span', {class: 'empty'}, '·')]));
        // a clip: clicked, it's chosen and launched; already playing, only chosen (its ■ stops it); an empty slot stops the track
        b.onclick = e => { select(i, r); if (!cl) stopTrack(TT.id); else if (!on || nx) launch(TT.id, r); else if (e.target.closest('.go')) stopTrack(TT.id); };
        b.ondblclick = () => { if (!cl) newClip(i, r); };
        grid.append(b); }); });
    grid.append(h('div', {class: 'scene foot'}, h('button', {class: 'sgo', title: 'Stop every track', onclick: stopAll}, '■'), h('span', {class: 'small'}, 'Stop all'),
      h('button', {class: 'mini', title: 'A new empty scene', onclick: addScene}, '＋ Scene'), h('button', {class: 'mini', title: 'A new scene holding what plays now', onclick: capture}, 'Capture')));
    P.tracks.forEach(TT => grid.append(h('button', {class: 'slot stop', title: `Stop ${TT.name}`, onclick: () => stopTrack(TT.id)}, '■')));
    box.append(grid); A.renderBack?.(RT.mode === 'mix' && E.playing && RT.own.size > 0); }
  const groundWords = H => H?.bars ? [...new Set(H.bars)].slice(0, 4).map(shortOf).join(' · ') + (new Set(H.bars).size > 4 ? ' …' : '') : '—';
  // the playing clips' progress round their loops, each frame
  function frame(){ if (!E.playing || E.session !== hook) return; const pos = E.pos(); if (pos == null) return;
    for (const b of document.querySelectorAll('#sessWrap .slot[data-on="1"]')) { const TT = T(+b.dataset.t), pl = RT.play[TT.id], cl = pl && cell(TT.id, pl.r); if (!cl) continue;
      const len = loopLen(cl); const pr = b.querySelector('.prog'); if (pr) pr.style.width = (((pos - pl.start + (cl.off || 0)) % len + len) % len)/len*100 + '%'; }
    playhead(pos); }
  // the Clip tab's playhead: the step heard lit on the rhythm, the note heard on the notes (when the chosen clip is playing)
  function playhead(pos){ const box = $('clipPane'); if (!box || (box.hidden && !RT.stack)) return; const X = target(), TT = X?.T, pl = X?.where === 'sess' && TT && RT.play[TT.id], cl = X?.cl;
    let step = -1, note = -1;
    if (X?.where === 'arr' && cl && pos != null && E.playing && !hook.owns(X.ti)) { const rel = Math.floor(pos) - Math.round(cl.start*16); if (rel >= 0 && rel < cl.len) { if (isLive(cl)) { const p = cl.parts[Math.min(RT.part, cl.parts.length - 1)], c = join(p.role, p.R, p.N); if (c) step = ((rel + (cl.off || 0)) % c.len) % p.R.len; } else step = rel % Math.min(64, cl.len); } }
    else if (pl && pl.r === RT.sel.r && cl && pos != null) {
      if (!isLive(cl)) step = ((Math.floor(pos) - pl.start + (cl.off || 0)) % (cl.len || 16) + (cl.len || 16)) % (cl.len || 16) % 64;
      else { const p = cl.parts[Math.min(RT.part, cl.parts.length - 1)], clip = join(p.role, p.R, p.N);
        if (clip) { const lp = p.loop && p.loop[1] <= clip.len && p.loop[1] > p.loop[0] ? p.loop : null, span = lp ? lp[1] - lp[0] : clip.len, rel = Math.floor(pos) - pl.start + (cl.off || 0);
          const at = (lp ? lp[0] : 0) + ((rel % span) + span) % span; step = at % p.R.len;
          // which note that is: the notes go round the hits, so count the hits played since the clip's start
          const H = p.R.hits.length, seq = p.N?.seq?.length || 0, cyc = Math.floor(at/p.R.len), done = p.R.hits.filter(x => x[0] <= step).length;
          if (seq && done) note = ((cyc*H + done - 1) % seq + seq) % seq; } } }
    // each part's row lit at its own place round its own length (in the whole scene, by its own track's clip)
    if (pos != null && E.playing) document.querySelectorAll('#clipPane .prow, #sessWrap .prow').forEach(row => { const ti = row.dataset.t == null ? X?.ti : +row.dataset.t, TT2 = T(ti), c = X?.where === 'arr' ? cl : TT2 && cell(TT2.id, RT.sel.r);
        let rel = null; if (c && X?.where === 'arr') { if (!hook.owns(X.ti)) { const r = Math.floor(pos) - Math.round(c.start*16); if (r >= 0 && r < c.len) rel = r + (c.off || 0); } }
        else { const pl2 = TT2 && RT.play[TT2.id]; if (c && pl2 && pl2.r === RT.sel.r) rel = Math.floor(pos) - pl2.start + (c.off || 0); }
        const q = isLive(c) ? c.parts[+row.dataset.j || 0] : null, L = q ? q.R.len : Math.min(64, c?.len || 16), s = rel == null || !c ? -1 : ((rel % L) + L) % L;
        row.querySelectorAll('.pcells [data-s]').forEach(x => { const on = +x.dataset.s === s ? '1' : ''; if (x.dataset.now !== on) x.dataset.now = on; }); });
    else document.querySelectorAll('.pcells i[data-now="1"]').forEach(c => { c.dataset.now = ''; });
    box.querySelectorAll('.st').forEach((b, i) => { const on = +b.dataset.s === step ? '1' : ''; if (b.dataset.now !== on) b.dataset.now = on; });
    box.querySelectorAll('.nchip').forEach((b, i) => { const on = i === note ? '1' : ''; if (b.dataset.now !== on) b.dataset.now = on; }); }
  function select(t, r){ RT.sel = {t, r}; RT.part = 0; A.selTrack(t); render(); renderClip(); A.clipChosen?.(); }
  function groundMenu(at, r){ const Sx = S(), seen = new Map(); for (const sc of Sx.scenes) seen.set(sc.ground.id + JSON.stringify(sc.ground.bars), sc.ground);
    const items = [...seen.values(), ...PROGS].map(H => ({label: `${H.name}`, note: groundWords(H), run: () => { if (!canEdit()) return; Sx.scenes[r].ground = clone({id: H.id, name: H.name, bars: H.bars});
      if (RT.scene === r && E.playing) { RT.H = Sx.scenes[r].ground; } A.save(); render(); A.flash(`${Sx.scenes[r].name}: ${H.name}`); }}));
    A.popup(at, items.slice(0, 40)); }
  function addScene(){ if (!canEdit()) return; const Sx = S(), g = Sx.scenes[Sx.scenes.length - 1]?.ground || DEEP; Sx.scenes.push({id: 's' + uid(), name: `Scene ${Sx.scenes.length + 1}`, ground: clone(g)});
    for (const TT of ST.P.tracks) Sx.cells[TT.id].push(null); A.save(); render(); }
  function capture(){ if (!canEdit()) return; const Sx = S(), r = Sx.scenes.length; Sx.scenes.push({id: 's' + uid(), name: `Scene ${r + 1}`, ground: clone(RT.H || Sx.scenes[0]?.ground || DEEP)});
    for (const TT of ST.P.tracks) { const pl = RT.play[TT.id], cl = pl && cell(TT.id, pl.r); Sx.cells[TT.id].push(cl ? {...clone(cl), id: uid(), from: undefined} : null); }
    A.save(); render(); A.flash(`Captured as ${Sx.scenes[r].name}`); }
  function newParts(TT){ const roles = isRack(TT) ? ['kick', 'hats'] : [TT.role === 'drums' ? 'kick' : TT.role];
    return roles.map(role => { const k = isRack(TT) ? PART_ROLES.indexOf(role) : 0, p0 = {role, k}, vs = voicesOf(TT, p0), R = rhythmTool('new', role, null, null, Math.random, vs.length ? vs : [VOICE0[role]]).rhythm;
      return {role, k, R, N: role === 'chords' ? fresh({seq: []}, 'The ground') : notesTool('new', role, null, Math.random, {n: R.hits.length, voices: vs}), play: 0, oct: 0, inv: 0, walk: false, loop: null, voicing: 0}; }); }
  function newClip(t, r){ if (!canEdit()) return; const TT = T(t), parts = newParts(TT);
    S().cells[TT.id][r] = {id: uid(), name: parts.map(p => p.R.name).join(' · '), parts}; A.save(); select(t, r); A.flash('A new clip: shape it below'); }

  /* ---------- the Clip tab: the chosen clip (a Session slot's, or the Arrangement's), in steps ---------- */
  const selCell = () => { const TT = T(RT.sel.t); return TT && cell(TT.id, RT.sel.r); };
  // what the Clip tab shows: in the Session the chosen slot's clip; in the Arrangement the clip open (or chosen)
  function target(){ if (ST.view === 'arrange') { const f = A.arrClip(); return f && {where: 'arr', cl: f.cl, T: f.T, ti: f.ti}; }
    const TT = T(RT.sel.t), sc = S()?.scenes[RT.sel.r]; return TT && sc && {where: 'sess', cl: selCell(), T: TT, ti: RT.sel.t, sc}; }
  // a change to the chosen clip: kept for undo; the Arrangement's clip worked out again over the song's chords
  function edit(fn, words){ const X = target(), cl = X?.cl; if (!cl || !canEdit()) return; RT.undo.push({where: X.where, id: cl.id, t: X.ti, r: RT.sel.r, json: JSON.stringify(cl)}); if (RT.undo.length > 60) RT.undo.shift();
    fn(cl, isLive(cl) ? cl.parts[Math.min(RT.part, cl.parts.length - 1)] : null); if (isLive(cl)) cl.name = [...new Set(cl.parts.map(p => p.R.name).filter(Boolean))].join(' · ') || cl.name; cl._k = undefined;
    if (X.where === 'arr') A.changed(); else A.save(); render(); renderClip(); if (words) A.flash(words + (E.playing && X.where === 'sess' ? ': from the next bar' : '')); }
  function undo(){ const u = RT.undo.pop(); if (!u) { A.flash('Nothing to undo in the clip'); return; } const back = JSON.parse(u.json);
    if (u.where === 'arr') { const f = A.findArrClip(u.id); if (f) { for (const k of Object.keys(f.cl)) delete f.cl[k]; Object.assign(f.cl, back); f.cl._k = undefined; A.changed(); } }
    else { const TT = T(u.t); S().cells[TT.id][u.r] = back; RT.sel = {t: u.t, r: u.r}; A.save(); } render(); renderClip(); A.flash('Undone'); }
  function rTool(k){ edit((cl, p) => { if (!p) return; const out = rhythmTool(k, p.role, p.R, p.N, Math.random, voicesOf(target().T, p)); if (!out) { A.flash('That can’t be done to this rhythm'); return; } p.R = {...out.rhythm, feel: p.R.feel}; if (out.notes) p.N = out.notes; }, `Rhythm: ${RHYTHM_TOOLS[k]}`); }
  function nTool(k){ edit((cl, p) => { if (!p) return; const out = notesTool(k, p.role, p.N, Math.random, {n: p.R.hits.length, voices: voicesOf(target().T, p)}); if (!out) { A.flash('That can’t be done to these notes'); return; } p.N = out; }, `Notes: ${NOTE_TOOLS[k]}`); }
  function toggleHit(s, accent){ edit((cl, p) => { const i = p.R.hits.findIndex(x => x[0] === s); if (accent) { p.R.hits = i >= 0 ? p.R.hits.map((x, k) => k === i ? [x[0], x[1], x[2] > .8 ? .8 : 1] : x) : [...p.R.hits, [s, 1, 1]].sort((a, b) => a[0] - b[0]); return; }
    if (i >= 0) { if (p.R.hits.length < 2) return; p.R.hits = p.R.hits.filter((_, j) => j !== i); } else p.R.hits = [...p.R.hits, [s, 1, .8]].sort((a, b) => a[0] - b[0]); }); }
  // a notes clip's step: a note of that row's pitch on (or off) at that 16th
  function toggleNote(s, pitch, drum){ edit(cl => { const i = cl.notes.findIndex(n => Math.floor(n.s + 1e-6) === s && n.p === pitch); if (i >= 0) cl.notes.splice(i, 1); else { cl.notes.push({s, p: pitch, l: drum ? 1 : 2, v: .8}); cl.notes.sort((a, b) => a.s - b.s); } }); }
  // Freeze: a live clip's notes kept, as worked out (in the Session over its scene's ground, one loop or the ground's length)
  function viewNotes(cl, TT, ground){ if (!isLive(cl)) return cl; const vk = sigOf(cl) + (ground?.bars || []).join() + (cl.off || 0); if (cl._vk === vk && cl.notes?.length) return cl; cl._vk = vk; const L = Math.min(256, Math.max(loopLen(cl), (ground?.bars.length || 1)*16)), bars = Math.ceil(L/16);
    cl.notes = liveNotes({...cl, off: cl.off || 0}, ground?.bars || DEEP.bars, 0, bars, {ren: renOf(TT), lane: laneOf(ST.P, ST.P.tracks.indexOf(TT))}).filter(n => n.s < L); cl.len = L; cl.start = 0; return cl; }
  function doFreeze(){ const X = target(); if (!X?.cl || !isLive(X.cl)) return; edit(cl => { if (X.where === 'sess') viewNotes(cl, X.T, X.sc.ground); freeze(cl); }, 'Frozen to notes: edit them in the piano roll (it no longer follows the chords)'); }
  function doLive(){ const X = target(); if (!X?.cl || isLive(X.cl)) return; const chords = X.where === 'arr' ? ST.P.chords : X.sc.ground.bars, at0 = X.where === 'arr' ? Math.floor(X.cl.start) : 0;
    const parts = makeLive(X.cl, X.T.role, chords, at0, p => padRole(p, SND[X.T.sound]?.voices?.[p], SND)); if (!parts.length) { A.flash('No notes to make live'); return; }
    edit(cl => { cl.parts = parts; cl.off = 0; if (X.where === 'sess') { delete cl.len; cl.notes = []; } }, 'Live: it follows the chords again (read from its notes, so check it by ear)'); }
  let watched = false; const watch = () => { if (watched) return; watched = true; $('clipPane')?.addEventListener('pointerdown', () => { RT.focus = 'clip'; }); $('sessWrap')?.addEventListener('pointerdown', () => { RT.focus = 'grid'; }); };
  function renderClip(){ watch(); const box = $('clipPane'); if (!box) return; box.innerHTML = ''; const X = target();
    if (ST.view === 'session' && !RT.stack) box.append(h('div', {class: 'cview'}, h('span', {class: 'seg'}, h('button', {'aria-pressed': String(!RT.whole), title: 'The chosen clip alone', onclick: () => setWhole(false)}, 'This clip'),
      h('button', {'aria-pressed': String(!!RT.whole), title: 'Every part of the scene, one under the other: ↑ ↓ to choose, ← → through the library', onclick: () => setWhole(true)}, 'Whole scene'))));
    if (!X) { box.append(h('div', {class: 'cempty'}, h('b', {}, ST.view === 'arrange' ? 'Double-click a clip on the timeline to edit it here' : 'Choose a slot'))); return; }
    const {cl, T: TT} = X, where = X.where === 'arr' ? `${TT.name} · bars ${Math.floor(cl?.start ?? 0) + 1}–${Math.ceil((cl?.start ?? 0) + (cl?.len || 0)/16)}` : `${TT.name} · ${X.sc.name} · over ${X.sc.ground.name}`;
    if (!cl) { if (wholeOn()) { box.append(sceneRows()); return; } box.append(h('div', {class: 'cempty'}, h('b', {}, `${TT.name} · ${X.sc.name}: empty`), h('button', {onclick: () => newClip(RT.sel.t, RT.sel.r)}, '＋ New clip'), h('span', {class: 'small muted'}, 'or double-click an empty slot'))); return; }
    const head = h('div', {class: 'chead'}, h('b', {}, cl.name || TT.name), h('span', {class: 'tag'}, isLive(cl) ? 'live: follows the chords' : 'notes'), h('span', {class: 'small muted'}, where));
    const p = isLive(cl) ? cl.parts[Math.min(RT.part, cl.parts.length - 1)] : null;
    head.append(h('span', {class: 'spacer'}));
    if (X.where === 'sess' && changedCopy(cl)) head.append(h('button', {class: 'putback', title: `Put this clip back into the song over bars ${cl.from.a + 1}–${cl.from.b}`, onclick: () => putBackCell(RT.sel.t, RT.sel.r)}, `↩ Put back in bars ${cl.from.a + 1}–${cl.from.b}`));
    else if (X.where === 'sess' && cl.from?.a != null) head.append(h('span', {class: 'small muted'}, `from bars ${cl.from.a + 1}–${cl.from.b}`));
    head.append(isLive(cl) ? h('button', {title: 'Its notes kept as they play now, to edit one by one in the piano roll (it stops following the chords)', onclick: doFreeze}, '❄ Freeze to notes')
      : h('button', {title: 'Read its notes back into a rhythm and chord tones, so it follows the chords again', onclick: doLive}, '∿ Make live'));
    head.append(h('button', {title: 'Undo the last change to a clip', onclick: undo}, '↶ Undo'));
    if (X.where === 'sess') head.append(h('button', {class: 'danger', title: 'Delete the clip', onclick: () => { if (!canEdit()) return; S().cells[TT.id][RT.sel.r] = null; A.save(); render(); renderClip(); }}, 'Delete'));
    box.append(head);
    if (wholeOn()) box.append(sceneRows());
    if (!p) { box.append(noteSteps(cl, TT)); return; }
    const drum = isDrum(p.role);
    if (!wholeOn() && !RT.stack) box.append(partsRows(cl, TT, p));
    // the rhythm: when it plays (its steps, a hit each lit), its feel and Life, its tools
    const R = p.R;
    const sel = (lab, list, val, set, title) => h('label', {class: 'small', title}, lab + ' ', (() => { const x = h('select', {}, ...list.map((n, i) => h('option', {value: i}, n))); x.value = val; x.onchange = () => set(+x.value); return x; })());
    const rhythm = h('section', {class: 'cmod'}, h('div', {class: 'cmh'}, h('b', {}, partName(p)), h('span', {class: 'small muted'}, `${R.name || ''} · ${R.len} steps, ${R.hits.length} hits`),
        sel('Feel', FEELS.map(f => f.name), R.feel || 0, v => edit((c, q) => { q.R = {...q.R, feel: v}; }, `Feel: ${FEELS[v].name}`), 'How it sits in the groove (F)'),
        sel('Life', PLAYS.map(x => x.name), p.play || 0, v => edit((c, q) => { q.play = v; }, `Life: ${PLAYS[v].name}`), 'Life improvises on the riff each time round (P)'),
        h('span', {class: 'oct', title: 'Its length in steps: parts of different lengths go round against each other (a polyrhythm). Shift: by four'}, 'Length ', h('button', {class: 'lenDn', onclick: e => setLen(-(e.shiftKey ? 4 : 1))}, '−'), h('b', {}, String(R.len)), h('button', {class: 'lenUp', onclick: e => setLen(e.shiftKey ? 4 : 1)}, '+'))),
      h('div', {class: 'tools'}, ...Object.entries(RHYTHM_TOOLS).map(([k, n]) => h('button', {onclick: () => rTool(k)}, n))));
    // the notes: what it plays, in order, one a hit, going round (chords play the ground itself)
    const seq = p.N?.seq || [], chips = h('div', {class: 'nseq'}, ...(p.role === 'chords' ? [h('span', {class: 'small muted'}, 'Plays the ground’s chords')] : seq.map(x => h('span', {class: 'nchip'}, drum ? x : `${x[0] + 1}${x[1] > 0 ? '↑' : x[1] < 0 ? '↓' : ''}`))));
    const notes = h('section', {class: 'cmod'}, h('div', {class: 'cmh'}, h('b', {}, 'Notes'), h('span', {class: 'small muted'}, drum ? 'which drums, in turn' : p.role === 'chords' ? 'the ground, voiced' : 'chord tones (1 the root), in turn: they follow the ground'),
        ...(drum ? [] : [h('span', {class: 'oct'}, 'Octave ', h('button', {onclick: () => edit((c, q) => { q.oct = Math.max(-2, (q.oct || 0) - 1); }, 'Octave down')}, '−'), h('b', {}, String(p.oct || 0)), h('button', {onclick: () => edit((c, q) => { q.oct = Math.min(2, (q.oct || 0) + 1); }, 'Octave up')}, '+'))]),
        ...(p.role === 'chords' ? [sel('Voicing', STYLES, p.voicing || 0, v => edit((c, q) => { q.voicing = v; }, `Voicing: ${STYLES[v]}`)), h('span', {class: 'oct'}, 'Inversion ', h('button', {onclick: () => edit((c, q) => { q.inv = (q.inv || 0) - 1; }, 'Inversion down')}, '−'), h('b', {}, String(p.inv || 0)), h('button', {onclick: () => edit((c, q) => { q.inv = (q.inv || 0) + 1; }, 'Inversion up')}, '+'))] : [])),
      chips, h('div', {class: 'tools'}, ...noteTools(p.role).map(k => h('button', {onclick: () => nTool(k)}, NOTE_TOOLS[k]))));
    box.append(h('div', {class: 'cmods'}, rhythm, notes)); }
  // the clip's parts, one under the other (a drum rack's kick, hats, percussion and any added): each its own rhythm at its
  // own length, so they go round against each other; the chosen one opens below with its tools. ← → or [ ] move between
  // them, ＋ Part adds one on any of the rack's drums, M mutes, ✕ takes one away
  function partsRows(cl, TT, p){ const lens = cl.parts.map(q => q.R.len), cyc = lens.reduce((a, b) => a*b/gcd(a, b), 16), W = Math.max(...lens, 16);
    const box = h('section', {class: 'cmod parts'}, h('div', {class: 'cmh'}, h('b', {}, cl.parts.length > 1 ? 'Parts' : 'Steps'),
      h('span', {class: 'small muted'}, new Set(lens).size > 1 ? `a polyrhythm: all together again every ${cyc % 16 ? cyc + ' steps' : cyc/16 + ' bar' + (cyc > 16 ? 's' : '')}` : 'click a step: a hit · Shift: an accent · ‹ › the library’s rhythms'), h('span', {class: 'spacer'}), addMenu(cl, TT)));
    cl.parts.forEach((q, j) => box.append(partRow(RT.sel.t, cl, q, j, W, q === p)));
    return box; }
  // one part's line: its name, ‹ › through the library, its steps (a click a hit, Shift an accent), length, M, ✕. `ti` is its
  // track: in the whole scene each row acts on its own track's clip (the chosen slot moved there first)
  function partRow(ti, cl, q, j, W, sel, wide){ const hits = new Map(q.R.hits.map(x => [x[0], x])), row = h('div', {class: wide ? 'prow wide' : 'prow', 'data-t': ti, 'data-j': j, 'data-sel': sel ? '1' : '', 'data-mute': q.mute ? '1' : ''});
    const at = () => { if (RT.sel.t !== ti) { RT.sel = {t: ti, r: RT.sel.r}; A.selTrack?.(ti); render(); } RT.part = j; };
    const cells = h('div', {class: 'pcells', style: `grid-template-columns: repeat(${W}, 1fr)`, title: `${partName(q)}: click a step for a hit, Shift-click an accent`, onclick: e => { const s0 = e.target.dataset?.s; if (s0 == null) return; at(); toggleHit(+s0, e.shiftKey); }});
    for (let s = 0; s < q.R.len; s++) { const x = hits.get(s); cells.append(h('i', {'data-s': s, 'data-on': x ? (x[2] > .8 ? '2' : '1') : '', 'data-beat': s % 4 === 0 ? '1' : ''})); }
    row.append(h('button', {class: 'pname', title: `Choose ${partName(q)}: its notes and tools below`, onclick: () => { at(); renderClip(); }}, partName(q)),
      h('button', {class: 'pv', 'aria-label': 'The library’s rhythm before', title: `The library’s ${PART_NAME[q.role] || q.role} rhythms`, onclick: () => { at(); libStep(j, -1); }}, '‹'),
      h('button', {class: 'pv', 'aria-label': 'The library’s next rhythm', title: `The library’s ${PART_NAME[q.role] || q.role} rhythms`, onclick: () => { at(); libStep(j, 1); }}, '›'),
      cells, h('span', {class: 'plen small muted', title: 'Its length in steps'}, String(q.R.len)),
      ...(wide ? [h('button', {class: 'pq', title: 'Vary its rhythm (V)', onclick: () => { at(); rTool('vary'); }}, 'Vary'),
        h('button', {class: 'pq', title: 'Life: how much it improvises each time round (P cycles)', 'data-on': q.play ? '1' : '', onclick: () => { at(); edit((c, x) => { x.play = ((x.play || 0) + 1) % PLAYS.length; }, `${partName(q)}: Life ${PLAYS[((q.play || 0) + 1) % PLAYS.length].name}`); }}, `Life · ${PLAYS[q.play || 0].name}`),
        h('button', {class: 'pq', title: 'Feel: how it sits in the groove (F cycles)', 'data-on': q.R.feel ? '1' : '', onclick: () => { at(); edit((c, x) => { x.R = {...x.R, feel: ((x.R.feel || 0) + 1) % FEELS.length}; }, `${partName(q)}: ${FEELS[((q.R.feel || 0) + 1) % FEELS.length].name}`); }}, FEELS[q.R.feel || 0].name)] : []),
      h('button', {class: 'pm', 'aria-pressed': String(!!q.mute), title: q.mute ? 'Unmute this part' : 'Mute this part', onclick: () => { at(); edit(c => { c.parts[j].mute = !c.parts[j].mute || undefined; }, `${partName(q)} ${q.mute ? 'back in' : 'muted'}`); }}, 'M'),
      cl.parts.length > 1 ? h('button', {class: 'px', title: `Take ${partName(q)} out of the clip`, onclick: () => { at(); removePart(j); }}, '✕') : h('span'));
    return row; }
  // the whole scene: every track's parts in this scene, one under the other (as in the jam), the steps lined up across
  // tracks; a track with no clip here gets ＋, a notes clip shows its hits (choose it to edit them)
  function sceneRows(wide){ const Sx = S(), r = RT.sel.r, P = ST.P, cl0 = P.tracks.map(TT => cell(TT.id, r));
    const W = Math.max(16, ...cl0.flatMap(c => isLive(c) ? c.parts.map(q => q.R.len) : c ? [Math.min(64, c.len || 16)] : []));
    const box = h('section', {class: 'cmod parts whole'}, h('div', {class: 'cmh'}, h('b', {}, `${Sx.scenes[r]?.name || 'Scene'}: every part`), h('span', {class: 'small muted'}, '↑ ↓ choose a part · ← → its library rhythms · click a step: a hit' + (wide ? ' · V vary · P Life · F feel' : ''))));
    P.tracks.forEach((TT, ti) => { const cl = cl0[ti]; box.append(h('div', {class: 'ptrack', style: `--c:${A.colorOf(TT, ti)}`}, TT.name));
      if (isLive(cl)) cl.parts.forEach((q, j) => box.append(partRow(ti, cl, q, j, W, ti === RT.sel.t && j === Math.min(RT.part, cl.parts.length - 1), wide)));
      else if (cl) { const R = pseudoR({...cl, len: Math.min(64, cl.len || 16)}), on = new Set(R.hits.map(x => x[0])), cells = h('div', {class: 'pcells', style: `grid-template-columns: repeat(${W}, 1fr)`});
        for (let s = 0; s < Math.min(64, cl.len || 16); s++) cells.append(h('i', {'data-s': s, 'data-on': on.has(s) ? '1' : '', 'data-beat': s % 4 === 0 ? '1' : ''}));
        box.append(h('div', {class: wide ? 'prow wide' : 'prow', 'data-t': ti, 'data-sel': ti === RT.sel.t ? '1' : ''}, h('button', {class: 'pname', title: 'A notes clip: choose it to edit its notes', onclick: () => select(ti, r)}, '♪ ' + (cl.name || 'Notes')), h('span'), h('span'), cells, h('span', {class: 'plen small muted'}, String(cl.len || 16)), h('span'), h('span'))); }
      else box.append(h('div', {class: wide ? 'prow wide empty' : 'prow empty', 'data-t': ti}, h('button', {class: 'pname', title: `A new clip for ${TT.name} in this scene`, onclick: () => newClip(ti, r)}, '＋ Clip'), h('span'), h('span'), h('span', {class: 'small muted'}, 'nothing here in this scene'))); });
    return box; }
  // ↑ ↓ through every part of the scene
  const stackList = () => ST.P.tracks.flatMap((TT, ti) => { const c = cell(TT.id, RT.sel.r); return isLive(c) ? c.parts.map((_, j) => [ti, j]) : c ? [[ti, 0]] : []; });
  function stackStep(d){ const L = stackList(); if (!L.length) return false; const now = L.findIndex(([t, j]) => t === RT.sel.t && j === RT.part), [t, j] = L[((now < 0 ? 0 : now + d) + L.length) % L.length];
    if (t !== RT.sel.t) { RT.sel = {t, r: RT.sel.r}; A.selTrack?.(t); render(); } RT.part = j; renderClip(); const c = cell(T(t).id, RT.sel.r); A.flash(`${T(t).name}${isLive(c) ? ' · ' + partName(c.parts[j]) : ''}`); return true; }
  const wholeOn = () => RT.whole && ST.view === 'session' && !RT.stack;
  // the Scene view (the Session's third face): the scenes along the top (a click chooses one, ▶ launches it), then every
  // part of the chosen one, one under the other, each with its most used controls; the chosen part's tools below
  function renderStack(box, Sx){ const bar = h('div', {class: 'stbar'});
    Sx.scenes.forEach((sc, r) => bar.append(h('span', {class: 'schip', 'data-sel': r === RT.sel.r ? '1' : '', 'data-on': RT.scene === r && E.playing && E.session === hook ? '1' : '', 'data-next': RT.nextScene === r ? '1' : ''},
      h('button', {class: 'sgo', title: `Launch ${sc.name} (${r < 9 ? r + 1 : ''})`, onclick: () => launchScene(r)}, '▶'),
      h('button', {class: 'sname2', title: `Show ${sc.name}'s parts`, onclick: () => { RT.sel = {t: RT.sel.t, r}; RT.part = 0; render(); renderClip(); }}, sc.name))));
    bar.append(h('button', {class: 'mini', title: 'Stop every clip', onclick: stopAll}, '■ Stop'));
    const sc = Sx.scenes[RT.sel.r];
    box.append(bar, h('div', {class: 'stground small muted'}, 'Over ', h('button', {class: 'ground', title: 'The chords this scene reads: click to change', onclick: e => groundMenu(e.currentTarget, RT.sel.r)}, groundWords(sc.ground))), sceneRows(true)); }
  function setStack(on){ RT.stack = !!on; render(); renderClip(); }
  function setWhole(on){ RT.whole = on; try { localStorage.setItem('studio.daw.whole', on ? '1' : ''); } catch {} renderClip(); }
  // ‹ ›: the library's rhythms for this kind of part, in turn; only the rhythm changes (its notes, its drums, stay)
  function libStep(j, d){ const X = target(); if (!X?.cl || !isLive(X.cl)) return; const q = X.cl.parts[j], list = LIBR[isDrum(q.role) ? q.role : q.role] || [];
    if (!list.length) { A.flash('No rhythms in the library for this part'); return; }
    const {item: c, i} = stepIn(list, q.lib, d), R = clone(c.R);
    RT.part = j; edit((cl, p) => { p.R = {...R, len: Math.min(64, R.len), hits: R.hits.filter(x => x[0] < 64), feel: p.R.feel || 0}; p.lib = c.id; }, `${partName(q)}: ${c.name} (${i + 1} of ${list.length})`); }
  // ＋ Part: any of the track's drums as a part of its own (a rack's pads; a kit's voices), or on a pitched instrument another line
  function addMenu(cl, TT){ if (!isDrum(TT.role)) return h('button', {class: 'addp', title: 'Another line on this instrument, with its own rhythm and length', onclick: () => addLine()}, '＋ Part');
    const pads = Object.keys(SND[TT.sound]?.voices || {}); if (!pads.length) return '';
    const x = h('select', {class: 'addp', title: 'Add a part: one drum with its own rhythm and length'}, h('option', {value: ''}, '＋ Part…'), ...pads.map(v => h('option', {value: v}, VNAME[v.replace(/\d+$/, '')] || v)));
    x.onchange = () => { const v = x.value; x.value = ''; if (v) addPart(v); }; return x; }
  function addLine(){ const X = target(); if (!X?.cl || !isLive(X.cl)) return; const role = X.cl.parts[0]?.role || X.T.role, n = X.cl.parts.filter(q => q.role === role).length + 1, name = `${PART_NAME[role] || role} ${n}`;
    const R = rhythmTool('new', role, null, null, Math.random, []).rhythm, N = role === 'chords' ? fresh({seq: []}, 'The ground') : notesTool('new', role, null, Math.random, {n: R.hits.length, voices: []});
    edit(cl => { cl.parts.push({role, k: 0, name, R, N, play: 0, oct: 0, inv: 0, walk: false, loop: null, voicing: cl.parts[0]?.voicing || 0}); RT.part = cl.parts.length - 1; }, `${name}: another line, ${R.len} steps`); }
  function addPart(pad){ const X = target(); if (!X?.cl || !isLive(X.cl)) return; const name = VNAME[pad.replace(/\d+$/, '')] || pad, role = padRole(pad, SND[X.T.sound]?.voices?.[pad], SND);
    edit(cl => { cl.parts.push({role, k: -1, pads: [pad], name, R: fresh({len: 16, hits: startHits(pad), feel: 0}, name), N: fresh({seq: [pad]}, name), play: 0, oct: 0, inv: 0, walk: false, loop: null, voicing: 0}); RT.part = cl.parts.length - 1; }, `${name}: a part of its own, 16 steps`); }
  function removePart(j){ const X = target(); if (!X?.cl || X.cl.parts.length < 2) return; const n = partName(X.cl.parts[j]);
    edit(cl => { cl.parts.splice(j, 1); RT.part = Math.min(RT.part, cl.parts.length - 1); }, `${n} taken out`); }
  // a part's length (its hits past the end let go): different lengths are the polyrhythm
  function setLen(d){ edit((cl, q) => { const len = Math.max(1, Math.min(64, q.R.len + d)); if (len === q.R.len) return; const hits = q.R.hits.filter(x => x[0] < len);
    q.R = {...q.R, len, hits: hits.length ? hits : [[0, 1, .8]]}; }); const q = target()?.cl?.parts?.[RT.part]; if (q) A.flash(`${partName(q)}: ${q.R.len} steps`); }
  // ← → or [ ] move between the chosen clip's parts
  function partStep(d){ const cl = target()?.cl; if (!isLive(cl) || cl.parts.length < 2) return false; RT.part = (Math.min(RT.part, cl.parts.length - 1) + d + cl.parts.length) % cl.parts.length; renderClip(); A.flash(partName(cl.parts[RT.part])); return true; }
  function partKey(e){ const inClip = (RT.focus === 'clip' && !$('clipPane').hidden) || RT.stack;
    if (wholeOn() || RT.stack) { if ((e.key === '[' || e.key === ']') || (inClip && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))) return stackStep(e.key === ']' || e.key === 'ArrowDown' ? 1 : -1);
      if (inClip && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { const c = selCell(); if (isLive(c)) { libStep(Math.min(RT.part, c.parts.length - 1), e.key === 'ArrowRight' ? 1 : -1); return true; } } }
    if ((e.key === '[' || e.key === ']') && partStep(e.key === ']' ? 1 : -1)) return true;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && RT.focus === 'clip' && !$('clipPane').hidden && partStep(e.key === 'ArrowRight' ? 1 : -1)) return true;
    return false; }
  // a notes clip in steps: a row a pitch (a drum's pad), a column a 16th, a page of 64 at a time
  let page = 0;
  function noteSteps(cl, TT){ const drum = isDrum(TT.role), L = cl.len || 16, pages = Math.ceil(L/64); page = Math.min(page, pages - 1); const s0 = page*64, s1 = Math.min(L, s0 + 64);
    let rows = [...new Set(cl.notes.map(n => n.p))]; if (!drum) { const ps = rows.length ? rows : [57]; const lo = Math.min(...ps), hi = Math.max(...ps); rows = []; for (let p = hi + 2; p >= lo - 2; p--) rows.push(p); }
    else rows = [...new Set([...rows, ...Object.keys(SND[TT.sound]?.voices || {})])].slice(0, 19);
    const grid = h('div', {class: 'nsteps', style: `grid-template-columns: 62px repeat(${s1 - s0}, minmax(14px, 1fr))`});
    for (const p of rows) { grid.append(h('span', {class: 'nrow'}, String(nn(p))));
      for (let s = s0; s < s1; s++) { const on = cl.notes.find(n => Math.floor(n.s + 1e-6) === s && n.p === p);
        grid.append(h('button', {class: 'st', 'data-s': s - s0, 'data-on': on ? (on.v > .8 ? '2' : '1') : '', 'data-beat': s % 4 === 0 ? '1' : '', title: `${nn(p)}, step ${s + 1}`, onclick: () => toggleNote(s, p, drum)})); } }
    const pager = pages > 1 ? h('span', {class: 'seg'}, ...Array.from({length: pages}, (_, i) => h('button', {'aria-pressed': String(i === page), onclick: () => { page = i; renderClip(); }}, `${i*4 + 1}–${Math.min(i*4 + 4, Math.ceil(L/16))}`))) : '';
    return h('section', {class: 'cmod'}, h('div', {class: 'cmh'}, h('b', {}, 'Steps'), h('span', {class: 'small muted'}, `${drum ? 'a row a drum' : 'a row a note'}, a column a 16th · ${cl.notes.length} notes · tap to add or take one away`), pager), grid); }

  /* ---------- keys, while the Session shows ---------- */
  function key(e){ const k = e.key.toLowerCase(), cl = selCell(), Sx = S(); if (!Sx) return false;
    if (partKey(e)) return true;
    if (/^[1-9]$/.test(e.key) && !e.shiftKey) { launchScene(+e.key - 1); return true; }
    if (e.key === 'Enter') { launchScene(RT.sel.r); return true; }
    if (e.key.startsWith('Arrow')) { const t = RT.sel.t + (e.key === 'ArrowRight') - (e.key === 'ArrowLeft'), r = RT.sel.r + (e.key === 'ArrowDown') - (e.key === 'ArrowUp');
      select(Math.max(0, Math.min(ST.P.tracks.length - 1, t)), Math.max(0, Math.min(Sx.scenes.length - 1, r))); return true; }
    if (e.key === ' ' ) return false;
    const p = cl && isLive(cl) ? cl.parts[Math.min(RT.part, cl.parts.length - 1)] : null;
    if (k === 'p' && p) { edit((c, q) => { q.play = ((q.play || 0) + 1) % PLAYS.length; }, `Life: ${PLAYS[((p.play || 0) + 1) % PLAYS.length].name}`); return true; }
    if (k === 'f' && p) { const v = ((p.R.feel || 0) + 1) % FEELS.length; edit((c, q) => { q.R = {...q.R, feel: v}; }, `Feel: ${FEELS[v].name}`); return true; }
    if (k === 'v' && p) { e.shiftKey ? nTool('vary') : rTool('vary'); return true; }
    if (k === 'n' && p) { rTool('new'); return true; }
    if (k === 'z' && !e.metaKey && !e.ctrlKey) { undo(); return true; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && cl && canEdit()) { const TT = T(RT.sel.t); S().cells[TT.id][RT.sel.r] = null; A.save(); render(); renderClip(); return true; }
    if (k === 'l') { const TT = T(RT.sel.t); if (cl) launch(TT.id, RT.sel.r); return true; }
    return false; }
  // a Session clip as the piano roll sees it (its notes; a live one's worked out over its scene's ground)
  // where a Session clip open in the piano roll is being heard, in 16ths round its loop (null: not playing)
  function edPos(id){ if (!E.playing || E.session !== hook) return null; const pos = E.pos(); if (pos == null) return null;
    for (const [tid, pl] of Object.entries(RT.play)) { const cl = cell(tid, pl.r); if (cl?.id !== id) continue; const L = cl.len || loopLen(cl);
      return (((pos - pl.start + (isLive(cl) ? 0 : cl.off || 0)) % L) + L) % L; } return null; }
  function findCell(id){ const Sx = S(); if (!Sx) return null; for (const [ti, TT] of ST.P.tracks.entries()) { const r = (Sx.cells[TT.id] || []).findIndex(c => c?.id === id);
    if (r >= 0) { const cl = Sx.cells[TT.id][r]; if (isLive(cl)) viewNotes(cl, TT, Sx.scenes[r].ground); cl.start = 0; return {T: TT, ti, cl, sess: true}; } } return null; }
  return {open, render, renderClip, frame, edPos, partKey, partStep, setWhole, stackStep, setStack, key, launch, launchScene, stopAll, stopTrack, hook, mixHook, RT, select, target, selCell, findCell, recToggle, fromArr, backToArr, doFreeze, doLive, isLive,
    stop: () => { RT.play = {}; RT.next = {}; RT.scene = null; RT.own.clear(); if (RT.rec) recToggle(); render(); playhead(null); }}; }
