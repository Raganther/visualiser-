// The DAW's mixer (the editor's Mixer tab, X): the native desk's strips (desk.js), one a track, then the drum and music
// buses, the echo and room returns and the master bus. Each with its meter, its compressors' reduction, its fader, pan,
// sends, mute and solo; a strip's name opens its processors to change, switch off, move, take out or add to (the parts'
// own, studio/lib/parts/procs.js; the score-reading ducker left out). A track's fader is its level in the track list;
// what you change is kept with the song (a track's `T.desk`, the buses' `P.desk`), undone and redone with it. A drum
// rack's strip opens out into its pads (▾), each with its own fader, pan, sends, mute, solo and processors (`T.pads`,
// `T.desk.pads`).
import { control, chainEditor, showGr } from '../lib/parts/shell.js';
import { PROCS } from '../lib/parts/procs.js';
import { sendsOf, channel } from '../lib/parts/desk.js';
import { kickOf } from './desk.js';
import { clone } from '../lib/dom.js';
import { VNAME, fmtDb } from '../lib/names.js';


const PAN = {key: 'pan', label: 'Pan', min: -1, max: 1, def: 0, unit: 'pan'};
const CHIP = {cut: 'Low cut', glue: 'Comp', saturate: 'Sat', sidechain: 'Sidechain', ceiling: 'Ceiling', trim: 'Gain'};



export function makeMixer(A){
  const {ST, E, $, checkpoint, changed, flash, editable, SND} = A, V = {on: false, sel: null, raf: 0, shut: new Set()};
  // (the page's own maker of elements, leaving out what isn't there)
  const h = (t, a, ...k) => A.h(t, a, ...k.flat().filter(x => x != null && x !== false));
  const T_ = id => ST.P.tracks.find(T => T.id === id), strip = id => E.D?.strips.find(s => s.id === id);
  // a strip's settings changed: kept with the song, heard at once
  // a pad's strip: its rack's track and the pad
  const padOf = id => { const s = strip(id); return s?.pad ? {T: T_(s.rack), pad: s.pad} : null; };
  function keep(id, f, undoable = true){ if (!editable()) { render(); return; } if (undoable) checkpoint(); const T = T_(id), pd = padOf(id);
    if (pd) { const d = pd.T.desk ||= {}; f((d.pads ||= {})[pd.pad] ||= {}); } else if (T) f(T.desk ||= {}); else { ST.P.desk ||= {}; f(ST.P.desk[id] ||= {}); } A.save(); }
  function show(on){ V.on = on; $('mixer').hidden = !on; if (on) { A.SI?.show(false); $('edWrap').hidden = true; $('help').hidden = true; $('edName').hidden = true; $('edInfo').hidden = true;
      const ed = $('editor'); if (ed.offsetHeight < 380) ed.style.height = Math.min(innerHeight - 200, 420) + 'px'; render(); meters(); }
    else { cancelAnimationFrame(V.raf); if (!A.SI?.isOn()) { $('edWrap').hidden = false; $('help').hidden = false; $('edName').hidden = false; $('edInfo').hidden = false; } }
    $('tabMix').setAttribute('aria-pressed', String(on)); if (on) { $('tabNotes').setAttribute('aria-pressed', 'false'); $('tabInst').setAttribute('aria-pressed', 'false'); } else if (!A.SI?.isOn()) $('tabNotes').setAttribute('aria-pressed', 'true'); }
  function render(){ if (!V.on) return; const desk = $('mxDesk');
    if (!E.D) { desk.replaceChildren(h('p', {class: 'muted small'}, E.ctx ? 'Starting the desk…' : 'The desk plays with the music: press Play.')); $('mxEdit').replaceChildren(); return; }
    // (a drum rack's strip, then its pads: those its kit has or its notes play)
    const list = []; for (const s of E.D.strips) { if (s.id === 'master' || s.pad) continue; list.push(stripView(s));
      if (s.rackOf && !V.shut.has(s.id)) { const T = T_(s.id), kit = SND[T.sound]?.voices || {}, used = new Set(T.clips.flatMap(c => c.notes.map(n => n.p)));
        for (const p of E.D.strips.filter(x => x.rack === s.id && (kit[x.pad] || used.has(x.pad)))) list.push(padView(p, T)); } }
    desk.replaceChildren(...list); edit(); }
  // a pad of a drum rack: its level, pan, mute and solo the song's (`T.pads`), its sends and processors yours over them
  function padView(s, T){ const pad = s.pad, pd = () => (T.pads ||= {})[pad] ||= {}, m = SND[T.sound]?.voices?.[pad];
    const upd = () => { const d = T.pads?.[pad] || {}; E.desk({type: 'strip', id: s.id, set: {mute: !!d.mute, solo: !!(d.solo || T.mix.solo)}}); };
    const fv = T.pads?.[pad]?.vol || 0, fader = h('input', {type: 'range', min: -40, max: 10, step: .5, value: fv, 'aria-label': (VNAME[pad] || pad) + ' fader'}), fo = h('output', {}, fmtDb(fv) + ' dB');
    fader.oninput = () => { const v = +fader.value; fo.textContent = fmtDb(v) + ' dB'; if (!editable()) return; pd().vol = v; changed(true); };
    fader.ondblclick = () => { fader.value = 0; fader.oninput(); };
    const sendRow = k => { const base = sendsOf(T.pads?.[pad] || {})[k], mine = T.desk?.pads?.[pad]?.sends?.[k] ?? base, r = h('input', {type: 'range', min: -60, max: 0, step: .5, value: mine, 'aria-label': `${VNAME[pad] || pad} to the ${k}`}), o = h('output', {}, fmtDb(mine));
      r.oninput = () => { o.textContent = fmtDb(+r.value); keep(s.id, d => { d.sends = {...d.sends, [k]: +r.value}; }, false); const d = T.desk?.pads?.[pad]?.sends || {}; E.desk({type: 'strip', id: s.id, set: {sends: {echo: d.echo ?? sendsOf(T.pads?.[pad] || {}).echo, room: d.room ?? sendsOf(T.pads?.[pad] || {}).room}}}); };
      r.ondblclick = () => { r.value = base; r.oninput(); };
      return h('label', {class: 'snd'}, h('span', {}, k === 'echo' ? 'Echo' : 'Room'), o, r); };
    const flip = k => () => { if (!editable()) return; checkpoint(); pd()[k] = !pd()[k]; A.save(); upd(); render(); };
    const chips = s.chain.filter(c => c.key !== 'trim').map(c => h('span', {class: 'chip', 'data-off': String(c.on === false)}, CHIP[c.key] || PROCS[c.key]?.label || c.key, PROCS[c.key]?.meter ? h('em', {class: 'gr', 'data-gr': c.id}) : null));
    return h('section', {class: 'mxs', 'data-kind': 'pad', 'data-strip': s.id, 'aria-current': String(V.sel === s.id)},
      h('button', {class: 'sname', title: 'Its processors', onclick: () => { V.sel = s.id; const i = ST.P.tracks.indexOf(T); if (i >= 0) ST.sel.track = i; A.pickPad(pad); render(); }}, h('b', {}, VNAME[pad] || pad), h('span', {}, m ? (m.kit ? m.kit : m.native) + (m.voice ? ' · ' + (VNAME[m.voice] || m.voice) : '') : 'no drum in this kit')),
      h('div', {class: 'meter'}, h('i', {'data-meter': s.id})), h('div', {class: 'chips'}, ...chips),
      h('label', {class: 'fdr'}, h('span', {}, 'Level'), fo, fader),
      control(PAN, T.pads?.[pad]?.pan || 0, v => { if (!editable()) return; pd().pan = v; changed(true); }),
      h('div', {class: 'sends'}, sendRow('echo'), sendRow('room')),
      h('div', {class: 'msb'}, h('button', {class: 'ms', 'aria-pressed': String(!!T.pads?.[pad]?.mute), onclick: flip('mute')}, 'M'), h('button', {class: 'ms s', 'aria-pressed': String(!!T.pads?.[pad]?.solo), onclick: flip('solo')}, 'S'))); }
  function stripView(s){ const T = T_(s.id), i = ST.P.tracks.indexOf(T), set = (k, v) => keep(s.id, d => { d[k] = v; }, false), rack = !!s.rackOf;
    const fv = T ? T.mix.vol || 0 : ST.P.desk?.[s.id]?.level ?? s.level, fader = h('input', {type: 'range', min: -40, max: 10, step: .5, value: fv, 'aria-label': (T?.name || s.label) + ' fader'}), fo = h('output', {}, fmtDb(fv) + ' dB');
    fader.oninput = () => { const v = +fader.value; fo.textContent = fmtDb(v) + ' dB'; if (!editable()) return;
      if (T) { T.mix.vol = v; changed(true); A.renderTracks(); } else { set('level', v); E.desk({type: 'strip', id: s.id, set: {level: v}}); } };
    fader.ondblclick = () => { fader.value = T ? 0 : s.level; fader.oninput(); };
    const sendRow = k => { const base = sendsOf(T.set)[k], mine = T.desk?.sends?.[k] ?? base, r = h('input', {type: 'range', min: -60, max: 0, step: .5, value: mine, 'aria-label': `${T.name} to the ${k}`}), o = h('output', {}, fmtDb(mine));
      r.oninput = () => { o.textContent = fmtDb(+r.value); keep(s.id, d => { d.sends = {...d.sends, [k]: +r.value}; }, false); E.resection(i); };
      r.ondblclick = () => { r.value = base; r.oninput(); };
      return h('label', {class: 'snd'}, h('span', {}, k === 'echo' ? 'Echo' : 'Room'), o, r); };
    const chips = s.chain.filter(c => c.key !== 'trim').map(c => h('span', {class: 'chip', 'data-off': String(c.on === false)}, CHIP[c.key] || PROCS[c.key]?.label || c.key, PROCS[c.key]?.meter ? h('em', {class: 'gr', 'data-gr': c.id}) : null));
    const ms = T ? [h('button', {class: 'ms', 'aria-pressed': String(!!T.mute), onclick: () => { if (!editable()) return; T.mute = !T.mute; changed(true); A.renderTracks(); render(); }}, 'M'),
        h('button', {class: 'ms s', 'aria-pressed': String(!!T.mix.solo), onclick: () => { if (!editable()) return; T.mix.solo = !T.mix.solo; changed(true); A.renderTracks(); render(); }}, 'S')]
      : s.id === 'bus' ? [] : [h('button', {class: 'ms', 'aria-pressed': String(!!ST.P.desk?.[s.id]?.mute), onclick: () => { const m = !ST.P.desk?.[s.id]?.mute; set('mute', m); E.desk({type: 'strip', id: s.id, set: {mute: m}}); render(); }}, 'M')];
    return h('section', {class: 'mxs', 'data-kind': rack ? 'rack' : s.ret ? 'ret' : s.bus ? 'bus' : 'ch', 'data-strip': s.id, 'aria-current': String(V.sel === s.id)},
      h('button', {class: 'sname', title: 'Its processors', onclick: () => { V.sel = s.id; render(); }}, h('b', {}, T?.name || s.label), h('span', {}, T ? A.soundName(T.sound) : s.ret ? 'a return' : s.id === 'bus' ? 'everything' : 'a bus')),
      h('div', {class: 'meter'}, h('i', {'data-meter': s.id})), h('div', {class: 'chips'}, ...chips),
      h('label', {class: 'fdr'}, h('span', {}, T ? 'Level' : 'Fader'), fo, fader),
      T ? control(PAN, T.mix.pan || 0, v => { if (!editable()) return; T.mix.pan = v; changed(true); A.renderTracks(); }) : null,
      T && !rack ? h('div', {class: 'sends'}, sendRow('echo'), sendRow('room')) : null,
      rack ? h('button', {class: 'pads', 'aria-expanded': String(!V.shut.has(s.id)), title: 'Its pads', onclick: () => { V.shut.has(s.id) ? V.shut.delete(s.id) : V.shut.add(s.id); render(); }}, (V.shut.has(s.id) ? '▸ ' : '▾ ') + 'Pads') : null,
      h('div', {class: 'msb'}, ...ms)); }
  // the strip picked: its processors in order, to change, switch off, move, take out or add to
  function edit(){ const s = strip(V.sel) || strip(ST.P.tracks[ST.sel.track]?.id) || E.D.strips[0]; V.sel = s.id; const T = T_(s.id), pd = padOf(s.id);
    $('mxName').textContent = pd ? `${pd.T.name} · ${VNAME[pd.pad] || pd.pad}` : T ? `${T.name} · ${A.soundName(T.sound)}` : s.label;
    $('mxWords').textContent = pd ? 'A pad of the drum rack: its input gain set from its drum’s peak, its own processors, then into the rack’s strip. Its level and sends are its own.'
      : s.rackOf ? 'The drum rack’s own strip: its pads come into it, and it goes to the drum bus. Add processors here to treat the whole kit.' : T ? 'Its input gain sets how hard it hits the processors (set from its sound’s peak); its level takes back what they add. The bass, chords and leads have a sidechain compressor the kick keys.'
      : s.ret ? 'A return: what the tracks send it, through its processors, into the master bus.' : s.id === 'bus' ? 'Everything ends here: a little EQ, a gentle compressor, width, then the ceiling.' : 'A bus: its tracks compressed together.';
    chainOf($('mxChain'), s, () => render());
    $('mxReset').hidden = !(pd ? pd.T.desk?.pads?.[pd.pad]?.chain : T ? T.desk?.chain : ST.P.desk?.[s.id]?.chain);
    $('mxFull').hidden = !canFull(s) || !!(pd ? pd.T.desk?.pads?.[pd.pad]?.full : T?.desk?.full); }
  // Claude's full chain (the Mix Lab's, for the part's role: an EQ and a compressor, and the bass's saturation and
  // width, the chords' and percussion's width), loaded onto a track's or a pad's strip in place of the lighter start;
  // its fader takes off what the full chain adds. Back to the desk's goes back to the lighter start
  const canFull = s => !!s && !s.bus && !s.ret && s.id !== 'master' && !!s.input;
  function loadFull(id, after){ const s = strip(id); if (!canFull(s) || !editable()) return; const trim = s.chain.find(c => c.key === 'trim');
    const chain = channel({id, role: s.role, key: kickOf(ST.P), gain: trim?.params.gain ?? 0}).chain.map(c => ({...c, id: id + '-' + c.key}));
    if (trim) chain[0] = trim; keep(id, d => { d.chain = clone(chain); d.full = true; }); s.chain = clone(chain);
    E.desk({type: 'chain', id, chain: clone(chain)}); changed(true); after(); flash('Claude’s full chain: an EQ and a compressor, as the Mix Lab mixes it'); }
  $('mxFull').onclick = () => loadFull(V.sel, () => render());
  // a strip's effects to change, switch off, move, take out or add to (here, and beside the instrument: the same chain)
  function chainOf(box, s, after){ const chain = clone(s.chain);
    return chainEditor(box, chain, (ch, what, c, k) => { if (!editable()) { after(); return; }
      keep(s.id, d => { d.chain = clone(ch); if (c?.key === 'trim' && what === 'param') d.gainSet = true; }, what !== 'param'); s.chain = clone(ch);
      if (what === 'param') E.desk({type: 'proc', id: s.id, pid: c.id, params: {[k]: c.params[k]}}); else if (what === 'on') E.desk({type: 'proc', id: s.id, pid: c.id, on: c.on !== false}); else E.desk({type: 'chain', id: s.id, chain: clone(ch)});
      if (what !== 'param') after(); }, {add: Object.keys(PROCS).filter(k => k !== 'duck')}); }
  // the Instrument tab's device chain: after the instrument, its effects in order, as Ableton lays a track out (a drum
  // rack: the picked drum's own, then the whole kit's on the rack's strip); the input gain left to the Mixer
  function fxInto(mods, T, pad, redo){ const one = (id, title, words) => { const s = strip(id); if (!s) return;
      const box = h('div', {class: 'chain'}), full = canFull(s) && !(s.pad ? T.desk?.pads?.[s.pad]?.full : T.desk?.full),
        card = h('section', {class: 'ifx', 'data-strip': id}, h('h3', {}, title), h('p', {class: 'small muted'}, words, full ? h('button', {class: 'ifull', title: 'An EQ and a compressor, as the Mix Lab mixes it', onclick: () => loadFull(id, redo)}, 'Claude’s full chain') : null), box);
      const shown = {...s, chain: s.chain.filter(c => c.key !== 'trim')}, trim = s.chain.filter(c => c.key === 'trim');
      chainEditor(box, clone(shown.chain), (ch, what, c, k) => { if (!editable()) { redo(); return; } const full = [...trim, ...ch];
        keep(s.id, d => { d.chain = clone(full); }, what !== 'param'); s.chain = clone(full);
        if (what === 'param') E.desk({type: 'proc', id: s.id, pid: c.id, params: {[k]: c.params[k]}}); else if (what === 'on') E.desk({type: 'proc', id: s.id, pid: c.id, on: c.on !== false}); else E.desk({type: 'chain', id: s.id, chain: clone(full)});
        if (what !== 'param') redo(); }, {add: Object.keys(PROCS).filter(k => k !== 'duck' && k !== 'trim')});
      mods.append(card); };
    if (!E.D) { mods.append(h('section', {class: 'ifx'}, h('h3', {}, 'Effects'), h('p', {class: 'small muted'}, 'The track’s effects show here once the desk starts: press Play.'))); return; }
    if (T.role === 'drums') { if (pad) one(T.id + '/' + pad, `${VNAME[pad] || pad} · its effects`, 'This drum alone, before the kit’s.'); one(T.id, `${T.name} · the kit’s effects`, 'The whole kit, after each drum’s.'); }
    else one(T.id, `${T.name} · track effects`, 'In order, after the instrument.'); }
  $('mxReset').onclick = () => { keep(V.sel, d => { delete d.chain; delete d.gainSet; delete d.full; }); E.deskRefresh(); E.mix(); render(); flash('Its processors as the desk starts them'); };
  function meters(){ if (!V.on) return; const M = E.meters || {};
    for (const e of document.querySelectorAll('#mxDesk [data-meter]')) { const m = M[e.dataset.meter], d = m ? 20*Math.log10(Math.max(1e-6, m.pk)) : -120; e.style.width = Math.max(0, Math.min(100, (d + 48)/48*100)) + '%'; e.dataset.hot = String(d > -1); }
    showGr(M); V.raf = requestAnimationFrame(meters); }
  $('tabMix').onclick = () => show(!V.on);
  // a drum picked in another tab: its pad's strip picked here too
  function pad(id, p){ const s = strip(id + '/' + p); if (!s || V.sel === s.id) return; V.sel = s.id; render(); }
  return {show, render, pad, fxInto, isOn: () => V.on};
}
