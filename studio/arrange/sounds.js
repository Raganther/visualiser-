// The sound panel beside the arrangement: the library of every sound a track's part can play, grouped by how each is
// made, tried on the track's own notes before it's chosen; and the sound's designer, its instrument's own settings on
// sliders. The sounds stay Claude's native kind: a physical model's settings (a struck bar's hardness, a bowed string's
// pressure, an FM bass's bend) computed note by note in the worker, the analog poly synth's oscillators, filter and
// envelopes, or a drum kit voice by voice. Changing a sound from the library makes your own copy (Your sounds), kept with
// the song and in your library, which Claude reads; and a sound can be asked of Claude in words.
import { INST, defaultOf } from '../lib/native/knobs.js';
import { SOUNDS as PAL, NATIVE_OF } from '../lib/palette.js';
import { nativeSet } from '../jam/model.js';
import { PARAMS as POLY, PRESETS as POLYP, DEF as POLYD } from '../../src/audio/engine/inst/poly.js';
import { PARAMS as KITP, KIT_NAMES, kitParams } from '../../src/audio/engine/inst/drums.js';

const NATURE = ['drop', 'stone', 'leaf', 'twig', 'insect', 'bamboo', 'click', 'bird'], ANALOG = /^(va|k(round|dub|tight|deep)$|hat808|rumble|sub808)/;
const PADS = ['addpad', 'breath', 'grainpad', 'formant'], BOWED = ['bowed', 'bowmetal', 'glassharm', 'rubbowl'];
const DRUMISH = ['kick', 'tom', 'hand', 'hat', 'hihat', 'hat808', 'shaker', 'twig', 'leaf', 'insect', 'click', 'stone', 'drop', 'kround', 'kdub', 'ktight', 'kdeep', 'wood', 'rim', 'bamboo', 'logdrum', 'bowl', 'gong', 'plate', 'glass'];
const NOTPITCHED = ['kick', 'hat', 'hihat', 'hat808', 'shaker', 'twig', 'leaf', 'insect', 'kround', 'kdub', 'ktight', 'kdeep'];
// the families, in the order the library shows them
export const FAMS = ['Your sounds', 'Struck: mallets, bells and bars', 'Plucked', 'Bowed and rubbed', 'FM', 'Analog circuits', 'Pads and breath', 'Poly synth', 'Drum machine', 'Acoustic drums (modelled)', 'Nature'];
const nativeOf = s => s.src ? s.src.native || NATIVE_OF[s.src.palette] || null : null;
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
  const UI = {open: false, tab: 'lib', pick: null, q: '', voice: null, fold: new Set(), role: 'all', seen: null};
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
    const all = Object.values(SND).filter(s => fits(s) && (!UI.q || `${s.name} ${s.words || ''} ${engineOf(s)} ${famOf(s)}`.toLowerCase().includes(UI.q)));
    for (const fam of FAMS) { const list = all.filter(s => famOf(s) === fam).sort((a, b) => a.name.localeCompare(b.name)); if (!list.length) continue;
      const shut = UI.fold.has(fam) && !UI.q, head = h('button', {class: 'fam', 'aria-expanded': String(!shut), onclick: () => { shut ? UI.fold.delete(fam) : UI.fold.add(fam); renderLib(); }}, `${shut ? '▸' : '▾'} ${fam}`, h('span', {class: 'muted'}, ` ${list.length}`));
      box.append(head); if (shut) continue;
      for (const s of list) { const on = s.id === cur, picked = s.id === UI.pick;
        const row = h('div', {class: 'snd-row', 'data-on': on ? '1' : '', 'data-pick': picked ? '1' : '', 'data-id': s.id, tabindex: '0', title: s.words || ''},
          h('div', {class: 'snd-txt'}, h('div', {class: 'snd-nm'}, (on ? '● ' : '') + s.name), h('div', {class: 'snd-eng'}, engineOf(s) + (names[s.name] > 1 && s.pack ? ` · ${s.pack === 'mine' ? 'yours' : s.pack.replace('pack-', 'pack ')}` : '') + (!drum && s.role !== T.role ? ` · a ${s.role === 'chords' ? 'chord' : s.role} sound` : ''))),
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
  // a setting changed: the copy saved, the track's instrument built again and the phrase played with it
  let tT = 0; function commit(d){ SND[d.id] = d; ST.P.sounds = {...ST.P.sounds, [d.id]: clone(strip(d))}; keep(strip(d)); changed(); E.refresh(); A.renderTracks();
    clearTimeout(tT); tT = setTimeout(() => tryIt(d.id), 120); }
  function slider(label, min, max, step, val, set, fmt = v => (+v).toFixed(step >= 1 ? 0 : step >= .1 ? 1 : 2), log = false){
    const toS = v => log ? Math.log(v/min)/Math.log(max/min) : (v - min)/(max - min), fromS = u => log ? min*Math.pow(max/min, u) : min + u*(max - min);
    const out = h('span', {class: 'kv'}, fmt(val)), r = h('input', {type: 'range', min: 0, max: 1000, step: 1, value: Math.round(1000*clamp(toS(val), 0, 1)), 'aria-label': label});
    const val0 = () => { const u = +r.value/1000, v = fromS(u); return log ? +v.toPrecision(3) : Math.round(v/step)*step; };
    r.oninput = () => { out.textContent = fmt(val0()); };
    // (let go: the change made, on your copy, as one undo step; the panel is drawn again only then, never mid-drag)
    r.onchange = () => { if (!editable()) return; checkpoint(); const d = mine(); set(d, +val0().toFixed(4)); commit(d); render(); };
    r.ondblclick = () => { if (!editable()) return; checkpoint(); const dd = mine(); set(dd, undefined); commit(dd); render(); };
    return h('label', {class: 'knob'}, h('span', {class: 'kl'}, label), r, out); }
  function pick(label, opts, val, set){ const s = h('select', {'aria-label': label}); for (const [v, t] of opts) s.append(h('option', {value: v}, t)); s.value = val;
    s.onchange = () => { if (!editable()) { s.value = val; return; } checkpoint(); const d = mine(); set(d, s.value); commit(d); render(); }; return h('label', {class: 'knob'}, h('span', {class: 'kl'}, label), s); }
  // the knobs of a native instrument: the value shown is what it plays now (your setting, else the section's, else its own)
  function nativeKnobs(box, name, base, knobs, write){ const K = INST[name]; if (!K) { box.append(h('div', {class: 'muted small'}, 'This instrument has no settings yet.')); return; }
    const eff = {...nativeSet({...track().set}, name, base || {}), ...knobs};
    for (const [k, label, lo, hi, step] of K.knobs) box.append(slider(label, lo, hi, step, eff[k] ?? defaultOf(name, k, lo, hi), (d, v) => write(d, k, v))); }
  const instOpts = (list) => list.filter(k => INST[k]).map(k => [k, INST[k].label]).sort((a, b) => a[1].localeCompare(b[1]));

  function renderEdit(){ const box = $('sdBody'), id = current(), s = SND[id], T = track(); box.innerHTML = ''; if (!s) return;
    $('sdName').value = s.name; $('sdName').disabled = !s.mine; $('sdFrom').textContent = s.mine ? (s.base && SND[s.base] ? `From ${SND[s.base].name} · ${famOf(SND[s.base])}` : 'Your sound') : `${famOf(s)} · ${engineOf(s)}. Changing anything makes your own copy.`;
    $('sdReset').hidden = !s.mine || !s.base;
    if (s.voices) { const vs = Object.keys(s.voices); if (!vs.includes(UI.voice)) UI.voice = vs[0];
      box.append(h('div', {class: 'voices'}, ...vs.map(v => h('button', {'aria-pressed': String(v === UI.voice), onclick: () => { UI.voice = v; renderEdit(); E.preview(ST.sel.track, current(), [{s: 0, p: v, l: 1, v: .9}, {s: 4, p: v, l: 1, v: .55}]); }}, VNAME[v] || v))));
      const m = s.voices[UI.voice];
      if (m.native) { box.append(pick('Instrument', instOpts(DRUMISH), m.native, (d, v) => { d.voices[UI.voice] = {native: v, n: d.voices[UI.voice].n}; }));
        if (!NOTPITCHED.includes(m.native)) box.append(slider('Pitch', 24, 96, 1, m.n ?? 48, (d, v) => { d.voices[UI.voice].n = v ?? 48; }, v => A.nn(Math.round(v))));
        nativeKnobs(box, m.native, m.set, m.knobs || {}, (d, k, v) => { const w = d.voices[UI.voice]; w.knobs = {...w.knobs}; if (v === undefined) delete w.knobs[k]; else w.knobs[k] = v; }); }
      else { box.append(pick('Drum machine', KIT_NAMES.map(k => [k, k]), m.kit, (d, v) => { d.voices[UI.voice].kit = v; }));
        const P = {...kitParams(m.kit)[UI.voice], ...(m.over?.[UI.voice] || {})};
        for (const p of KITP) box.append(slider(p.key === 'x' ? 'Character' : p.label, p.min, p.max, p.unit === 'st' ? 1 : .01, P[p.key] ?? p.def, (d, v) => { const w = d.voices[UI.voice]; w.over = {...w.over}; w.over[UI.voice] = {...w.over[UI.voice]}; if (v === undefined) delete w.over[UI.voice][p.key]; else w.over[UI.voice][p.key] = v; }, undefined, !!p.log)); } }
    else { const n = nativeOf(s);
      if (n) { box.append(pick('Instrument', instOpts(Object.keys(INST).filter(k => !NOTPITCHED.includes(k))), n, (d, v) => { d.src = {native: v, shift: d.src.shift || 0}; }));
        box.append(slider('Octave', -3, 3, 1, Math.round((s.src.shift || 0)/12), (d, v) => { d.src.shift = 12*(v ?? 0); }, v => (v > 0 ? '+' : '') + Math.round(v)));
        nativeKnobs(box, n, s.src.set, s.src.knobs || {}, (d, k, v) => { d.src.knobs = {...d.src.knobs}; if (v === undefined) delete d.src.knobs[k]; else d.src.knobs[k] = v; }); }
      else { const [preset, set] = PAL[s.src.palette], base = {...POLYD, ...POLYP[preset], ...set, ...s.src.poly};
        for (const [group, ps] of POLY) { const list = ps.filter(p => p.key !== 'chord'); if (!list.length) continue; box.append(h('div', {class: 'grp'}, group));
          for (const p of list) { const w = (d, v) => { d.src.poly = {...d.src.poly}; if (v === undefined) delete d.src.poly[p.key]; else d.src.poly[p.key] = p.list ? +v : v; };
            box.append(p.list ? pick(p.label, p.list.map((t, i) => [i, t]), base[p.key] ?? p.def, w) : slider(p.label, p.min, p.max, p.step || (p.max - p.min > 50 ? 1 : .01), base[p.key] ?? p.def, w, undefined, !!p.log)); } } } }
    box.append(h('div', {class: 'muted small', style: 'margin-top:8px'}, 'Drag a slider and let go to hear it on this track’s notes. Double-click a slider to put it back.')); }
  $('sdName').onchange = e => { const s = SND[current()]; if (!s?.mine) return; const d = {...s, name: e.target.value.trim() || s.name}; commit(d); render(); };
  $('sdReset').onclick = () => { const s = SND[current()]; if (!s?.base || !editable()) return; checkpoint(); assign(s.base); };
  $('sdTry').onclick = () => tryIt(current());
  $('sdAskB').onclick = async () => { const t = $('sdAskT').value.trim(); if (!t) return; const T = track();
    await addNote(0, t, {kind: 'sound', tracks: [T.name], role: T.role, sound: current(), desc: `A sound for the ${T.name.toLowerCase()}`}); $('sdAskT').value = ''; flash('Asked Claude for the sound: it’s in your notes'); };

  return {show, render, isOpen: () => UI.open, loadDb, adopt, keep};
}
