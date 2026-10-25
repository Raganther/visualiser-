// The DAW's mixer (the editor's Mixer tab, X): the native desk's strips (desk.js), one a track, then the drum and music
// buses, the echo and room returns and the master bus. Each with its meter, its compressors' reduction, its fader, pan,
// sends, mute and solo; a strip's name opens its processors to change, switch off, move, take out or add to (the parts'
// own, studio/lib/parts/procs.js; the score-reading ducker left out). A track's fader is its level in the track list;
// what you change is kept with the song (a track's `T.desk`, the buses' `P.desk`), undone and redone with it.
import { control, chainEditor, showGr } from '../lib/parts/shell.js';
import { PROCS } from '../lib/parts/procs.js';
import { sendsOf } from '../lib/parts/desk.js';

const clone = x => JSON.parse(JSON.stringify(x));
const PAN = {key: 'pan', label: 'Pan', min: -1, max: 1, def: 0, unit: 'pan'};
const CHIP = {cut: 'Low cut', glue: 'Comp', saturate: 'Sat', sidechain: 'Sidechain', ceiling: 'Ceiling', trim: 'Gain'};
const fmtDb = v => v <= -59.5 ? 'off' : (v > 0 ? '+' : '') + (+v).toFixed(1);

export function makeMixer(A){
  const {ST, E, $, checkpoint, changed, flash, editable} = A, V = {on: false, sel: null, raf: 0};
  // (the page's own maker of elements, leaving out what isn't there)
  const h = (t, a, ...k) => A.h(t, a, ...k.flat().filter(x => x != null && x !== false));
  const T_ = id => ST.P.tracks.find(T => T.id === id), strip = id => E.D?.strips.find(s => s.id === id);
  // a strip's settings changed: kept with the song, heard at once
  function keep(id, f, undoable = true){ if (!editable()) { render(); return; } if (undoable) checkpoint(); const T = T_(id);
    if (T) f(T.desk ||= {}); else { ST.P.desk ||= {}; f(ST.P.desk[id] ||= {}); } A.save(); }
  function show(on){ V.on = on; $('mixer').hidden = !on; if (on) { A.SI?.show(false); $('edWrap').hidden = true; $('help').hidden = true; $('edName').hidden = true; $('edInfo').hidden = true;
      const ed = $('editor'); if (ed.offsetHeight < 380) ed.style.height = Math.min(innerHeight - 200, 420) + 'px'; render(); meters(); }
    else { cancelAnimationFrame(V.raf); if (!A.SI?.isOn()) { $('edWrap').hidden = false; $('help').hidden = false; $('edName').hidden = false; $('edInfo').hidden = false; } }
    $('tabMix').setAttribute('aria-pressed', String(on)); if (on) { $('tabNotes').setAttribute('aria-pressed', 'false'); $('tabInst').setAttribute('aria-pressed', 'false'); } else if (!A.SI?.isOn()) $('tabNotes').setAttribute('aria-pressed', 'true'); }
  function render(){ if (!V.on) return; const desk = $('mxDesk');
    if (!E.D) { desk.replaceChildren(h('p', {class: 'muted small'}, E.ctx ? 'Starting the desk…' : 'The desk plays with the music: press Play.')); $('mxEdit').replaceChildren(); return; }
    desk.replaceChildren(...E.D.strips.filter(s => s.id !== 'master').map(s => stripView(s))); edit(); }
  function stripView(s){ const T = T_(s.id), i = ST.P.tracks.indexOf(T), set = (k, v) => keep(s.id, d => { d[k] = v; }, false);
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
    return h('section', {class: 'mxs', 'data-kind': s.ret ? 'ret' : s.bus ? 'bus' : 'ch', 'data-strip': s.id, 'aria-current': String(V.sel === s.id)},
      h('button', {class: 'sname', title: 'Its processors', onclick: () => { V.sel = s.id; render(); }}, h('b', {}, T?.name || s.label), h('span', {}, T ? A.soundName(T.sound) : s.ret ? 'a return' : s.id === 'bus' ? 'everything' : 'a bus')),
      h('div', {class: 'meter'}, h('i', {'data-meter': s.id})), h('div', {class: 'chips'}, ...chips),
      h('label', {class: 'fdr'}, h('span', {}, T ? 'Level' : 'Fader'), fo, fader),
      T ? control(PAN, T.mix.pan || 0, v => { if (!editable()) return; T.mix.pan = v; changed(true); A.renderTracks(); }) : null,
      T ? h('div', {class: 'sends'}, sendRow('echo'), sendRow('room')) : null, h('div', {class: 'msb'}, ...ms)); }
  // the strip picked: its processors in order, to change, switch off, move, take out or add to
  function edit(){ const s = strip(V.sel) || strip(ST.P.tracks[ST.sel.track]?.id) || E.D.strips[0]; V.sel = s.id; const T = T_(s.id);
    $('mxName').textContent = T ? `${T.name} · ${A.soundName(T.sound)}` : s.label;
    $('mxWords').textContent = T ? 'Its input gain sets how hard it hits the processors (set from its sound’s peak); its level takes back what they add. The bass, chords and leads have a sidechain compressor the kick keys.'
      : s.ret ? 'A return: what the tracks send it, through its processors, into the master bus.' : s.id === 'bus' ? 'Everything ends here: a little EQ, a gentle compressor, width, then the ceiling.' : 'A bus: its tracks compressed together.';
    const chain = clone(s.chain);
    chainEditor($('mxChain'), chain, (ch, what, c, k) => { if (!editable()) { render(); return; }
      keep(s.id, d => { d.chain = clone(ch); if (c?.key === 'trim' && what === 'param') d.gainSet = true; }, what !== 'param'); s.chain = clone(ch);
      if (what === 'param') E.desk({type: 'proc', id: s.id, pid: c.id, params: {[k]: c.params[k]}}); else if (what === 'on') E.desk({type: 'proc', id: s.id, pid: c.id, on: c.on !== false}); else E.desk({type: 'chain', id: s.id, chain: clone(ch)});
      if (what !== 'param') render(); }, {add: Object.keys(PROCS).filter(k => k !== 'duck')});
    $('mxReset').hidden = !(T ? T.desk?.chain : ST.P.desk?.[s.id]?.chain); }
  $('mxReset').onclick = () => { const T = T_(V.sel); keep(V.sel, d => { delete d.chain; delete d.gainSet; }); E.deskRefresh(); render(); flash('Its processors as the desk set them'); };
  function meters(){ if (!V.on) return; const M = E.meters || {};
    for (const e of document.querySelectorAll('#mxDesk [data-meter]')) { const m = M[e.dataset.meter], d = m ? 20*Math.log10(Math.max(1e-6, m.pk)) : -120; e.style.width = Math.max(0, Math.min(100, (d + 48)/48*100)) + '%'; e.dataset.hot = String(d > -1); }
    showGr(M); V.raf = requestAnimationFrame(meters); }
  $('tabMix').onclick = () => show(!V.on);
  return {show, render, isOn: () => V.on};
}
