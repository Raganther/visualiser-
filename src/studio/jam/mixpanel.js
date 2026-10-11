// The jam's Mix panel: one button that mixes (listening first, saying what it hears), Before / After at the same
// loudness, the mastering presets to try in turn (each with its loudness, heard to be there), Auto, and the list of what
// it changed and why. mountMixPanel(parent, getMixer) → {toggle, el, paint}
import { h, btn } from './kit.js';
import { TUNE } from '../../tuning.js';

export function mountMixPanel(parent, getMixer){
  const el = h('div', 'jmix'); el.hidden = true; parent.appendChild(el);
  let unsub = null;
  function paint(){
    const mx = getMixer(), st = mx.state;
    el.innerHTML = '';
    const head = h('div', 'mxhead'); head.append(h('b', null, 'Mix'), btn('✕', 'mxclose', () => toggle(false), 'Close')); el.appendChild(head);
    el.appendChild(h('p', 'mxwords', 'Listens to the parts as they play, then sets their levels, EQ, ducking under the kick and compression, and masters the whole. It only turns knobs: the music carries on.'));
    const go = btn(st.busy ? 'Listening…' : 'Mix it', 'mxgo' + (st.busy ? ' busy' : ''), () => mx.mix(), 'Listen and mix (about ten bars)');
    go.disabled = st.busy; el.appendChild(go);
    const say = h('div', 'mxsay'); say.textContent = st.say || ''; const pr = h('i'); pr.style.width = (st.progress*100).toFixed(0) + '%'; say.appendChild(pr); el.appendChild(say);
    // Before / After
    const ab = h('div', 'mxab'), seg = h('div', 'jseg');
    for (const [v, l] of [['before', 'Before'], ['after', 'After']]) { const b = btn(l, st.side === v && st.after ? 'cur' : '', () => mx.ab(v)); b.disabled = !st.after || st.busy; seg.appendChild(b); }
    const match = h('label', 'mxmatch'), cb = h('input'); cb.type = 'checkbox'; cb.checked = st.match; cb.onchange = () => mx.setMatch(cb.checked); match.append(cb, ' Same loudness');
    ab.append(h('span', 'jlab', 'Compare'), seg, match); el.appendChild(ab);
    // mastering
    el.appendChild(h('div', 'jlab mxlab', 'Mastering'));
    const ms = h('div', 'mxmasters');
    for (const [k, p] of Object.entries(TUNE.studio.masters)) { const b = btn(`<b>${p.label}</b><small>${p.lufs == null ? 'no target' : p.lufs + ' LUFS'}</small>`, k === mx.masterKey() ? 'cur' : '', () => mx.setPreset(k), p.words); b.disabled = st.busy; ms.appendChild(b); }
    el.appendChild(ms);
    const lv = h('div', 'mxlevel'); lv.textContent = isFinite(st.lufs) && st.lufs != null ? `Last heard: ${st.lufs.toFixed(1)} LUFS, peak ${st.peak.toFixed(1)} dB` : 'Not measured yet'; el.appendChild(lv);
    // auto
    const au = h('label', 'mxauto'), ac = h('input'); ac.type = 'checkbox'; ac.checked = st.auto; ac.onchange = () => mx.setAuto(ac.checked);
    au.append(ac, ` Auto: every ${TUNE.studio.mix.autoBars} bars, keep the levels and the loudness where the mix put them`); el.appendChild(au);
    // what it did
    if (st.log.length) { el.appendChild(h('div', 'jlab mxlab', 'What it did')); const ul = h('ul', 'mxlog'); for (const l of st.log) ul.appendChild(h('li', null, l)); el.appendChild(ul); }
  }
  function toggle(on = el.hidden){
    el.hidden = !on; if (unsub) { unsub(); unsub = null; }
    // (just under the top bar, however many rows it wraps to)
    const top = parent.querySelector('.jtop'); if (top) el.style.top = (top.offsetHeight + 8) + 'px';
    if (on) { unsub = getMixer().on(() => { if (!el.hidden) paint(); }); paint(); }
  }
  return {el, toggle, paint, rebind(){ if (!el.hidden) toggle(true); }};
}
