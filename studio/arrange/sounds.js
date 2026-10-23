// The sound panel beside the arrangement: the library of every sound a track's part can play, grouped by how each is
// made, tried on the track's own notes before it's chosen; and the sound's designer, its instrument's own settings on
// sliders. The sounds stay Claude's native kind: a physical model's settings (a struck bar's hardness, a bowed string's
// pressure, an FM bass's bend) computed note by note in the worker, the analog poly synth's oscillators, filter and
// envelopes, or a drum kit voice by voice. Changing a sound from the library makes your own copy (Your sounds), kept with
// the song and in your library, which Claude reads; and a sound can be asked of Claude in words.
import { INST, defaultOf } from '../lib/native/knobs.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { nativeSet } from '../jam/model.js';
import { PARAMS as POLY, PRESETS as POLYP, DEF as POLYD } from '../lib/native/npoly.js';   // (the native poly synth's: the browser-built one's settings, and its drift and filter drive)
import { PARAMS as KITP, KIT_NAMES, kitParams } from '../../src/audio/engine/inst/drums.js';

const NATURE = ['drop', 'stone', 'leaf', 'twig', 'insect', 'bamboo', 'click', 'bird'], ANALOG = /^(va|k(round|dub|tight|deep)$|hat808|rumble|sub808)/;
const PADS = ['addpad', 'breath', 'grainpad', 'formant'], BOWED = ['bowed', 'bowmetal', 'glassharm', 'rubbowl'];
const DRUMISH = ['kick', 'tom', 'hand', 'hat', 'hihat', 'hat808', 'shaker', 'twig', 'leaf', 'insect', 'click', 'stone', 'drop', 'kround', 'kdub', 'ktight', 'kdeep', 'wood', 'rim', 'bamboo', 'logdrum', 'bowl', 'gong', 'plate', 'glass'];
const NOTPITCHED = ['kick', 'hat', 'hihat', 'hat808', 'shaker', 'twig', 'leaf', 'insect', 'kround', 'kdub', 'ktight', 'kdeep'];
// the families, in the order the library shows them
export const FAMS = ['Your sounds', 'Struck: mallets, bells and bars', 'Plucked', 'Bowed and rubbed', 'FM', 'Analog circuits', 'Pads and breath', 'Poly synth', 'Drum machine', 'Acoustic drums (modelled)', 'Nature'];
const nativeOf = s => s.src ? s.src.native || NATIVE_OF[s.src.palette] || null : null;
// the synthesizers: each an engine with its own settings, its sounds the presets made on it (and your own copies of them)
export const SYNTHS = [
  ['resonator', 'Resonator', 'Struck and rubbed objects: bars, tines, bells, bowls, gongs, glass. A set of resonances that ring.'],
  ['fm', 'FM', 'One sine bending another: glassy, round and plucked basses, bells.'],
  ['analog', 'Analog', 'A subtractive analog voice, computed sample by sample: gated and dub chords, stabs, pads, subs, plucks.'],
  ['poly', 'Poly Synth', 'The live analog poly synth: two oscillators or a supersaw, drifting, through a ladder filter.'],
  ['string', 'String', 'Strings, plucked and bowed.'],
  ['pads', 'Pads', 'Additive, breath, grain and formant pads: sounds that bloom.'],
  ['skin', 'Skin', 'Struck skins: kicks, toms and hand drums.'],
  ['akick', 'Analog Kick', 'Analog kick circuits: round, dub, tight, deep.'],
  ['cymbal', 'Cymbal', 'Hi-hats, cymbals and shakers.'],
  ['nature', 'Nature', 'Water drops, stones, leaves, twigs, insects and birds.'],
  ['kit', 'Drum Machine', 'The drum machine’s kits: 909, 808, Minimal, Industrial, Lo-fi.']];
const SYNTH_OF = n => !n ? null : n.startsWith('fm') ? 'fm' : /^k(round|dub|tight|deep)$/.test(n) ? 'akick' : /^va/.test(n) || n === 'sub808' || n === 'rumble' ? 'analog'
  : PADS.includes(n) ? 'pads' : n === 'pluck' || n === 'bowed' ? 'string' : ['kick', 'tom', 'hand'].includes(n) ? 'skin' : ['hihat', 'hat', 'hat808', 'shaker'].includes(n) ? 'cymbal'
  : NATURE.includes(n) && n !== 'bamboo' ? 'nature' : 'resonator';
// the synthesizer a sound is made on (a drum sound: its first voice's)
export function synthOf(s){ if (s.voices) { const v = Object.values(s.voices)[0]; return v.kit ? 'kit' : SYNTH_OF(v.native); } return SYNTH_OF(nativeOf(s)) || 'poly'; }
export function famOf(s){ if (s.mine) return FAMS[0];
  if (s.voices) { const vs = Object.values(s.voices); if (vs.every(v => v.kit)) return 'Drum machine'; if (vs.some(v => NATURE.includes(v.native))) return 'Nature';
    if (vs.some(v => ANALOG.test(v.native || ''))) return 'Analog circuits'; return 'Acoustic drums (modelled)'; }
  const n = nativeOf(s); if (!n) return 'Poly synth'; if (n.startsWith('fm')) return 'FM'; if (ANALOG.test(n)) return 'Analog circuits'; if (PADS.includes(n)) return 'Pads and breath';
  if (BOWED.includes(n)) return 'Bowed and rubbed'; if (n === 'pluck') return 'Plucked'; if (NATURE.includes(n)) return 'Nature'; return FAMS[1]; }
export function engineOf(s){ if (s.voices) { const vs = Object.values(s.voices), k = vs.find(v => v.kit); return k ? `${k.kit} drum machine` : [...new Set(vs.map(v => INST[v.native]?.label.replace(/ \(.*\)/, '') || v.native))].slice(0, 3).join(', '); }
  const n = nativeOf(s); return n ? INST[n]?.label || n : `Poly synth: ${PAL[s.src.palette]?.[0] || s.src.palette}`; }
const clone = x => JSON.parse(JSON.stringify(x)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const VNAME = {kick: 'Kick', chh: 'Closed hat', ohh: 'Open hat', ride: 'Ride', tomL: 'Low tom', tomH: 'High tom', log: 'Log', logH: 'High log', wood: 'Wood', rim: 'Rim', clave: 'Clave', shaker: 'Shaker', metal: 'Metal', bowl: 'Bowl', gong: 'Gong'};

export function makeSounds(A){
  const {ST, E, SND, h, $, isDrum, checkpoint, changed, flash, editable, addNote, trackRange, PHONE} = A;
  const UI = {open: false, tab: 'lib', pick: null, q: '', voice: null, fold: new Set(), role: 'all', seen: null, by: 'synth', synth: 'all'};
  try { UI.by = localStorage.getItem('studio.daw.by') || 'synth'; } catch {}
  let MY = {}; try { MY = JSON.parse(localStorage.getItem('studio.daw.sounds') || '{}'); } catch {}
  const adopt = defs => { for (const d of Object.values(defs || {})) if (d?.id) SND[d.id] = {...d, mine: true}; };
  adopt(MY);
  // your sounds, kept on this device and (on the published page) in the library Claude reads
  let dbT = {}; const keep = d => { MY[d.id] = d; try { localStorage.setItem('studio.daw.sounds', JSON.stringify(MY)); } catch {}
    const db = A.db(); if (db) { clearTimeout(dbT[d.id]); dbT[d.id] = setTimeout(() => db.collection('sounds').doc(d.id).set({...d, at: new Date().toISOString()}).catch(() => {}), 1500); } };
  async function loadDb(db){ try { const q = await db.collection('sounds').get(); for (const d of q.docs) { const x = d.data(); if (x?.id && !MY[x.id]) MY[x.id] = x; } adopt(MY); render(); } catch {} }

  /* ---------- what's being changed: the selected clips on the track, else the whole track ---------- */
  const track = () => ST.P?.tracks[ST.sel.track];
  const scopeClips = () => { const T = track(); return T ? T.clips.filter(c => ST.sel.clips.has(c.id)) : []; };
  const current = () => { const T = track(), cs = scopeClips(); return cs.length ? cs[0].set?.sound || T.sound : T.sound; };
  const scopeText = () => { const n = scopeClips().length; return n ? `${n} selected clip${n > 1 ? 's' : ''}` : 'the whole track'; };
  function assign(id, {quiet} = {}){ const T = track(), cs = scopeClips();
    if (cs.length) for (const c of cs) { c.set = c.set || {}; if (id === T.sound) delete c.set.sound; else c.set.sound = id; }
    else { T.sound = id; for (const c of T.clips) if (c.set) delete c.set.sound; }
    if (SND[id]?.mine) ST.P.sounds = {...ST.P.sounds, [id]: clone(strip(SND[id]))};
    changed(); E.refresh(); A.renderTracks(); render(); if (!quiet) flash(`${SND[id]?.name || id} on ${scopeText()} of the ${T.name.toLowerCase()}`); }
  const strip = d => { const {mine, ...x} = d; return x; };
  const use = id => { if (!editable()) return; checkpoint(); assign(id); };

  /* ---------- trying a sound: the track's own notes, a bar or two of them ---------- */
  function phrase(){ const T = track(), drum = isDrum(T.role), cs = scopeClips(), open = A.openClip(), pick = cs[0] || (open?.T === T ? open.cl : null) || T.clips.find(c => c.notes.length);
    if (pick?.notes.length) { const ns = pick.notes.filter(n => n.s < pick.len).sort((a, b) => a.s - b.s), s0 = Math.floor(ns[0].s/16)*16, out = ns.filter(n => n.s - s0 < (drum ? 16 : 32)).slice(0, 24);
      return out.map(n => ({...n, s: n.s - s0})); }
    if (drum) return Object.keys(SND[current()]?.voices || {}).map((v, i) => ({s: i*4, p: v, l: 1, v: .8}));
    const [lo, hi] = trackRange(T), m = Math.round((lo + hi)/2); return [0, 3, 7, 12, 7, 3].map((d, i) => ({s: i*4, p: m + d, l: 3, v: .8})); }
  const tryIt = id => { E.preview(ST.sel.track, id, phrase()); };

  /* ---------- the panel ---------- */
  const side = $('side');
  function show(v){ UI.open = v; side.hidden = !v; $('soundsB').setAttribute('aria-pressed', String(v)); A.draw(); A.renderEd(); if (v) render(); }
  $('soundsB').onclick = () => show(!UI.open); $('sdClose').onclick = () => show(false);
  $('tabLib').onclick = () => { UI.tab = 'lib'; render(); }; $('tabEdit').onclick = () => { UI.tab = 'edit'; render(); };
  $('sdSearch').oninput = e => { UI.q = e.target.value.trim().toLowerCase(); renderLib(); };
  function render(){ if (!UI.open || !ST.P) return; const T = track(); if (!T) return;
    $('sdTrack').textContent = T.name; $('sdScope').textContent = 'Changes ' + scopeText();
    $('tabLib').setAttribute('aria-pressed', String(UI.tab === 'lib')); $('tabEdit').setAttribute('aria-pressed', String(UI.tab === 'edit'));
    if (PHONE) UI.tab = 'lib'; $('tabEdit').hidden = PHONE;
    $('sdLib').hidden = UI.tab !== 'lib'; $('sdEdit').hidden = UI.tab !== 'edit'; UI.tab === 'lib' ? renderLib() : renderEdit(); }

  function renderLib(){ const T = track(), box = $('sdList'), cur = current(); box.innerHTML = '';
    const drum = isDrum(T.role), roles = $('sdRoles'); roles.hidden = drum; roles.innerHTML = '';
    if (!drum) for (const [r, t] of [['all', 'All'], ['bass', 'Bass'], ['chords', 'Chords'], ['lead', 'Lead']]) roles.append(h('button', {'aria-pressed': String(UI.role === r), onclick: () => { UI.role = r; renderLib(); }}, t));
    const fits = s => drum ? s.role === T.role : !isDrum(s.role) && (UI.role === 'all' || s.role === UI.role);
    const names = {}; for (const s of Object.values(SND)) names[s.name] = (names[s.name] || 0) + 1;
    // browsed by synthesizer (each its presets, your copies among them) or by what kind of sound it is
    const by = $('sdBy'); by.innerHTML = ''; for (const [k, t] of [['synth', 'By synth'], ['kind', 'By kind']]) by.append(h('button', {'aria-pressed': String(UI.by === k), onclick: () => { UI.by = k; try { localStorage.setItem('studio.daw.by', k); } catch {} renderLib(); }}, t));
    const syn = UI.by === 'synth', name = k => SYNTHS.find(x => x[0] === k)?.[1] || k;
    const all = Object.values(SND).filter(s => fits(s) && (!UI.q || `${s.name} ${s.words || ''} ${engineOf(s)} ${famOf(s)} ${name(synthOf(s))}`.toLowerCase().includes(UI.q)));
    // by synth: a chip for each synth this part can use, to show one alone
    const chips = $('sdSyn'); chips.innerHTML = ''; chips.hidden = !syn;
    const have = SYNTHS.filter(([k]) => all.some(s => synthOf(s) === k)); if (UI.synth !== 'all' && !have.some(x => x[0] === UI.synth)) UI.synth = 'all';
    if (syn) for (const [k, t] of [['all', 'All synths'], ...have]) chips.append(h('button', {'aria-pressed': String(UI.synth === k), onclick: () => { UI.synth = k; box.scrollTop = 0; renderLib(); }}, t));
    const groups = syn ? SYNTHS.filter(([k]) => UI.synth === 'all' || k === UI.synth).map(([k, t, w]) => [k, t, w, all.filter(s => synthOf(s) === k)]) : FAMS.map(f => [f, f, null, all.filter(s => famOf(s) === f)]);
    for (const [fam, title, words, items] of groups) { const list = items.sort((a, b) => (a.mine ? 1 : 0) - (b.mine ? 1 : 0) || a.name.localeCompare(b.name)); if (!list.length) continue;
      const shut = UI.fold.has(fam) && !UI.q && !(syn && UI.synth !== 'all'), head = h('button', {class: 'fam', 'aria-expanded': String(!shut), onclick: () => { shut ? UI.fold.delete(fam) : UI.fold.add(fam); renderLib(); }}, `${shut ? '▸' : '▾'} ${title}`, h('span', {class: 'muted'}, ` ${list.length}`));
      box.append(head); if (shut) continue; if (words) box.append(h('div', {class: 'fam-words'}, words));
      for (const s of list) { const on = s.id === cur, picked = s.id === UI.pick;
        const row = h('div', {class: 'snd-row', 'data-on': on ? '1' : '', 'data-pick': picked ? '1' : '', 'data-id': s.id, tabindex: '0', title: s.words || ''},
          h('div', {class: 'snd-txt'}, h('div', {class: 'snd-nm'}, (on ? '● ' : '') + s.name, syn && s.mine ? h('span', {class: 'yours'}, 'yours') : ''), h('div', {class: 'snd-eng'}, engineOf(s) + (names[s.name] > 1 && s.pack ? ` · ${s.pack === 'mine' ? 'yours' : s.pack.replace('pack-', 'pack ')}` : '') + (!drum && s.role !== T.role ? ` · a ${s.role === 'chords' ? 'chord' : s.role} sound` : ''))),
          picked && !on ? h('button', {class: 'use', onclick: e => { e.stopPropagation(); use(s.id); }}, 'Use') : '');
        row.onclick = () => { UI.pick = s.id; tryIt(s.id); renderLib(); }; row.ondblclick = () => use(s.id);
        row.onkeydown = e => { if (e.key === 'Enter') use(s.id); };
        box.append(row); } }
    if (!box.children.length) box.append(h('div', {class: 'muted small', style: 'padding:8px'}, 'No sounds match.'));
    // (opening on a track, the sound in use is scrolled into view)
    const key = T.id + cur; if (UI.seen !== key) { UI.seen = key; const el = box.querySelector('[data-on="1"]'); box.scrollTop = el ? el.offsetTop - box.offsetTop - box.clientHeight/2 : 0; }
    const ask = $('sdAsk'); ask.hidden = false; }

  /* ---------- the designer: the sound's own settings ---------- */
  // your copy of the sound in use (made on the first change, so the library's stays as it was)
  function mine(){ const id = current(), s = SND[id]; if (s.mine) return s;
    const d = {...clone(strip(s)), id: 'u-' + Date.now().toString(36) + Math.floor(Math.random()*1e3), name: s.name + ' (yours)', base: id, pack: 'mine', words: `Your version of ${s.name}.`, mine: true};
    SND[d.id] = d; assign(d.id, {quiet: true}); flash(`Your own copy: “${d.name}”, in Your sounds`); return d; }
  // a setting changed: the copy saved, the track's instrument built again, and it heard (the phrase, or one note)
  let tT = 0; function commit(d, {note, quiet} = {}){ SND[d.id] = d; ST.P.sounds = {...ST.P.sounds, [d.id]: clone(strip(d))}; keep(strip(d)); changed(); E.refresh(); A.renderTracks();
    clearTimeout(tT); if (!quiet) tT = setTimeout(() => note ? E.preview(ST.sel.track, d.id, [note]) : tryIt(d.id), 120); for (const f of HOOKS) f(); }
  const HOOKS = [];

  // the sound's controls, whatever makes it: groups of settings, each with its value now, its range, how it's written on
  // your copy, and (the poly synth's and a drum machine's) how it's heard at once while it's being turned
  const instOpts = (list) => list.filter(k => INST[k]).map(k => [k, INST[k].label]).sort((a, b) => a[1].localeCompare(b[1]));
  const fmtOf = step => v => (+v).toFixed(step >= 1 ? 0 : step >= .1 ? 1 : step >= .01 ? 2 : 3);
  const knobsOf = (name, base, knobs, write) => { const K = INST[name]; if (!K) return [];
    const eff = {...nativeSet({...track().set}, name, base || {}), ...knobs};      // (what it plays now: your setting, else the section's, else its own)
    return K.knobs.map(([k, label, lo, hi, step]) => ({key: k, label, min: lo, max: hi, step, value: eff[k] ?? defaultOf(name, k, lo, hi), fmt: fmtOf(step), write: (d, v) => write(d, k, v)})); };
  function model(){ const id = current(), s = SND[id], ti = ST.sel.track; if (!s) return null;
    if (s.voices) { const vs = Object.keys(s.voices); if (!vs.includes(UI.voice)) UI.voice = vs[0]; const vo = UI.voice, m = s.voices[vo];
      const W = f => (d, v) => { const w = d.voices[vo] = {...d.voices[vo]}; f(w, v); };
      if (m.native) { const items = [{key: 'native', label: 'Instrument', list: instOpts(DRUMISH), value: m.native, write: W((w, v) => { d0(w); w.native = v; })}];
        if (!NOTPITCHED.includes(m.native)) items.push({key: 'n', label: 'Pitch', min: 24, max: 96, step: 1, value: m.n ?? 48, fmt: v => A.nn(Math.round(v)), write: W((w, v) => { w.n = v ?? 48; })});
        return {id, s, kind: 'drums', voices: vs, voice: vo, note: {s: 0, p: vo, l: 1, v: .9}, groups: [{name: INST[m.native]?.label || m.native, items: [...items, ...knobsOf(m.native, m.set, m.knobs || {}, (d, k, v) => W((w, v) => { w.knobs = {...w.knobs}; if (v === undefined) delete w.knobs[k]; else w.knobs[k] = v; })(d, v))
          .map(it => ({...it, live: v => E.live(ti, {native: it.key, slot: vo}, v)}))]}]}; }
      const P = {...kitParams(m.kit)[vo], ...(m.over?.[vo] || {})};
      return {id, s, kind: 'drums', voices: vs, voice: vo, note: {s: 0, p: vo, l: 1, v: .9}, groups: [{name: `${m.kit} drum machine · ${VNAME[vo] || vo}`, items: [
        {key: 'kit', label: 'Drum machine', list: KIT_NAMES.map(k => [k, k]), value: m.kit, write: W((w, v) => { w.kit = v; })},
        ...KITP.map(p => ({key: p.key, label: p.key === 'x' ? 'Character' : p.label, min: p.min, max: p.max, step: p.unit === 'st' ? 1 : .01, log: !!p.log, value: P[p.key] ?? p.def, def: p.def, fmt: fmtOf(p.unit === 'st' ? 1 : .01),
          live: v => E.live(ti, {kit: vo, key: p.key}, v), write: W((w, v) => { w.over = {...w.over}; w.over[vo] = {...w.over[vo]}; if (v === undefined) delete w.over[vo][p.key]; else w.over[vo][p.key] = v; })}))]}]}; }
    const T = track(), [lo, hi] = trackRange(T), mid = Math.round((lo + hi)/2), note = {s: 0, p: mid, l: 4, v: .85}, n = nativeOf(s);
    if (n) return {id, s, kind: 'native', native: n, note, groups: [
      {name: 'Instrument', items: [{key: 'native', label: 'Instrument', list: instOpts(Object.keys(INST).filter(k => !NOTPITCHED.includes(k))), value: n, write: (d, v) => { d.src = {native: v, shift: d.src.shift || 0}; }},
        {key: 'shift', label: 'Octave', min: -3, max: 3, step: 1, value: Math.round((s.src.shift || 0)/12), def: 0, fmt: v => (v > 0 ? '+' : '') + Math.round(v), write: (d, v) => { d.src = {...d.src, shift: 12*(v ?? 0)}; }}]},
      {name: INST[n]?.label || n, items: knobsOf(n, s.src.set, s.src.knobs || {}, (d, k, v) => { d.src = {...d.src, knobs: {...d.src.knobs}}; if (v === undefined) delete d.src.knobs[k]; else d.src.knobs[k] = v; })
        .map(it => ({...it, live: v => E.live(ti, {native: it.key}, v)}))}]};   // (heard as it turns where the instrument plays live)
    const [preset, set] = PAL[s.src.palette], base = {...POLYD, ...POLYP[preset], ...set, ...s.src.poly};
    return {id, s, kind: 'poly', preset, values: base, note, groups: POLY.map(([group, ps]) => ({name: group, items: ps.filter(p => p.key !== 'chord').map(p => ({key: p.key, label: p.label, list: p.list && p.list.map((t, i) => [i, t]), min: p.min, max: p.max, log: !!p.log,
      step: p.step || (p.max - p.min > 50 ? 1 : .01), value: base[p.key] ?? p.def, def: (POLYP[preset] || {})[p.key] ?? set[p.key] ?? p.def, unit: p.unit, fmt: v => polyFmt(p, v),
      live: v => E.live(ti, {poly: p.key}, v), write: (d, v) => { d.src = {...d.src, poly: {...d.src.poly}}; if (v === undefined) delete d.src.poly[p.key]; else d.src.poly[p.key] = p.list ? +v : v; }}))})).filter(g => g.items.length)}; }
  const d0 = w => { delete w.knobs; };
  const polyFmt = (p, v) => p.unit === 'Hz' ? (v >= 1000 ? (v/1000).toFixed(1) + 'k' : Math.round(v)) : p.unit === 's' ? (v < 1 ? Math.round(v*1000) + 'ms' : (+v).toFixed(2) + 's') : p.unit === '%' ? Math.round(v*100) + '%' : p.unit === 'st' ? (v > 0 ? '+' : '') + Math.round(v) : p.unit === 'ct' ? Math.round(v) + 'ct' : p.unit === 'oct' ? (v > 0 ? '+' : '') + Math.round(v) : (+v).toFixed(2);
  // a control set: one undo step, on your copy, heard
  function change(item, v, {note, quiet} = {}){ if (!editable()) return false; checkpoint(); const d = mine(); item.write(d, v); commit(d, {note, quiet}); render(); return true; }

  // the side panel's Edit tab: the same controls as sliders and menus
  function slider(it){ const {min, max, log} = it, toS = v => log ? Math.log(v/min)/Math.log(max/min) : (v - min)/(max - min), fromS = u => log ? min*Math.pow(max/min, u) : min + u*(max - min);
    const fmt = it.fmt || fmtOf(it.step), out = h('span', {class: 'kv'}, fmt(it.value)), r = h('input', {type: 'range', min: 0, max: 1000, step: 1, value: Math.round(1000*clamp(toS(it.value), 0, 1)), 'aria-label': it.label});
    const val0 = () => { const v = fromS(+r.value/1000); return log ? +v.toPrecision(3) : Math.round(v/it.step)*it.step; };
    r.oninput = () => { out.textContent = fmt(val0()); it.live?.(val0()); };
    // (let go: the change made, on your copy, as one undo step; the panel is drawn again only then, never mid-drag)
    r.onchange = () => change(it, +val0().toFixed(4)); r.ondblclick = () => change(it, undefined);
    return h('label', {class: 'knob'}, h('span', {class: 'kl'}, it.label), r, out); }
  function pick(it){ const s = h('select', {'aria-label': it.label}); for (const [v, t] of it.list) s.append(h('option', {value: v}, t)); s.value = it.value;
    s.onchange = () => { if (!change(it, s.value)) s.value = it.value; }; return h('label', {class: 'knob'}, h('span', {class: 'kl'}, it.label), s); }

  function renderEdit(){ const box = $('sdBody'), M = model(); box.innerHTML = ''; if (!M) return; const s = M.s;
    $('sdName').value = s.name; $('sdName').disabled = !s.mine; $('sdFrom').textContent = s.mine ? (s.base && SND[s.base] ? `From ${SND[s.base].name} · ${famOf(SND[s.base])}` : 'Your sound') : `${famOf(s)} · ${engineOf(s)}. Changing anything makes your own copy.`;
    $('sdReset').hidden = !s.mine || !s.base;
    if (M.voices) box.append(h('div', {class: 'voices'}, ...M.voices.map(v => h('button', {'aria-pressed': String(v === M.voice), onclick: () => { setVoice(v); E.preview(ST.sel.track, current(), [{s: 0, p: v, l: 1, v: .9}, {s: 4, p: v, l: 1, v: .55}]); }}, VNAME[v] || v))));
    for (const g of M.groups) { if (M.groups.length > 1) box.append(h('div', {class: 'grp'}, g.name)); for (const it of g.items) box.append(it.list ? pick(it) : slider(it)); }
    box.append(h('div', {class: 'muted small', style: 'margin-top:8px'}, 'Drag a slider and let go to hear it on this track’s notes. Double-click a slider to put it back. The instrument itself, with its knobs, graphs and a keyboard: B.')); }
  function setVoice(v){ UI.voice = v; render(); for (const f of HOOKS) f(); }
  $('sdName').onchange = e => { const s = SND[current()]; if (!s?.mine) return; const d = {...s, name: e.target.value.trim() || s.name}; commit(d); render(); };
  $('sdReset').onclick = () => { const s = SND[current()]; if (!s?.base || !editable()) return; checkpoint(); assign(s.base); };
  $('sdTry').onclick = () => tryIt(current());
  $('sdAskB').onclick = async () => { const t = $('sdAskT').value.trim(); if (!t) return; const T = track();
    await addNote(0, t, {kind: 'sound', tracks: [T.name], role: T.role, sound: current(), desc: `A sound for the ${T.name.toLowerCase()}`}); $('sdAskT').value = ''; flash('Asked Claude for the sound: it’s in your notes'); };

  return {synthOf, show, render, isOpen: () => UI.open, loadDb, adopt, keep, model, change, setVoice, current, track, scopeText, famOf, engineOf, onChange: f => HOOKS.push(f), reset: () => $('sdReset').onclick(), tryIt: () => tryIt(current()), VNAME};
}
