// The Effects section of the DJ panel (audio/engine/mixer.js): a row a strip (the groovebox, the decks, the two sends, the
// master), each with its level, pan and sends, and its chain of effects as cards of knobs, built from each effect's own description.
import { EFFECTS, effect } from '../audio/engine/registry.js';
import { OFF, STRIPS, addInsert, mixMaster, moveInsert, onMix, removeInsert, setParam, setStrip, toggleInsert } from '../audio/engine/mixer.js';
import { el, knob } from './widgets.js';

const ORDER = ['groove', 'synth', 'play', 'deckA', 'deckB', 'sendA', 'sendB', 'master'];
const NAMES = {groove: 'Groovebox', synth: 'Synth', play: 'Play lab', deckA: 'Deck A', deckB: 'Deck B', sendA: 'Send A', sendB: 'Send B', master: 'Master'};
const db = v => v <= OFF + .1 ? 'off' : (v > 0 ? '+' : '') + v.toFixed(1);
// how a setting reads, by its unit
const fmt = p => p.list ? v => p.list[Math.round(v)] || '' : {
  '%': v => Math.round(v*100) + '%', Hz: v => v >= 1000 ? (v/1000).toFixed(1) + 'k' : v < 10 ? v.toFixed(2) : Math.round(v) + '',
  dB: v => (v > 0 ? '+' : '') + v.toFixed(1), ms: v => Math.round(v*1000) + 'ms', x: v => v.toFixed(2) + '×', '×': v => v.toFixed(2) + '×', ':1': v => v.toFixed(1) + ':1',
  s: v => v < 1 ? Math.round(v*1000) + 'ms' : v.toFixed(2) + 's', st: v => (v > 0 ? '+' : '') + Math.round(v), ct: v => Math.round(v) + 'ct', oct: v => (v > 0 ? '+' : '') + Math.round(v)}[p.unit] || (v => (p.step ? Math.round(v) : v.toFixed(2)) + '');
// a knob for a setting: a log setting turns evenly in octaves, a list steps through its names
export function paramKnob(p, v, on){
  if (p.log) { const L = Math.log(p.max/p.min), u = x => Math.log(x/p.min)/L, x = u => p.min*Math.exp(u*L), f = fmt(p);
    return knob(p.label, 0, 1, u(p.def), w => f(x(w)), w => on(x(w)), u(v)); }
  const snap = p.list || p.step ? Math.round : x => x;
  return knob(p.label, p.list ? 0 : p.min, p.list ? p.list.length - 1 : p.max, p.def, fmt(p), w => on(snap(w)), v);
}

let box = null;
export function buildMix(container){
  box = container;
  box.append(el('div', 'mxnote', 'Effects on each channel, in order (click a name to bypass it). Sends A and B feed two shared effects (an echo and a space) back into the mix.'));
  const rows = el('div', 'mxrows'); box.append(rows);
  onMix(() => { if (!box.hidden) paint(); });
}
// the rows, built again when the strips or their chains change
export function paint(){
  if (!box) return;
  mixMaster();
  const rows = box.querySelector('.mxrows'); rows.textContent = '';
  for (const key of ORDER) {
    const s = STRIPS.get(key); if (!s) continue;
    const row = el('div', 'mxrow ' + s.kind), head = el('div', 'mxh');
    head.append(el('b', '', NAMES[key] || s.label));
    head.append(knob('Level', OFF, 6, 0, db, v => setStrip(key, 'level', v), s.st.level));
    if (s.kind !== 'master') head.append(knob('Pan', -1, 1, 0, v => Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100), v => setStrip(key, 'pan', v), s.st.pan));
    if (s.kind === 'ch') for (const b of ['A', 'B']) head.append(knob('Send ' + b, OFF, 6, OFF, db, v => setStrip(key, b, v), s.st[b]));
    const chain = el('div', 'mxc');
    s.ins.forEach((x, i) => {
      const E = effect(x.k), card = el('div', 'fxc' + (x.on ? '' : ' off'));
      const top = el('div', 'fxh');
      const nm = el('button', 'fxn', E.label); nm.title = `${E.words}: click to ${x.on ? 'bypass' : 'switch on'}`; nm.setAttribute('aria-pressed', !!x.on);
      nm.addEventListener('click', () => toggleInsert(key, i));
      const lt = el('button', 'fxm', '◂'), rt = el('button', 'fxm', '▸'), rm = el('button', 'fxm', '✕');
      lt.title = 'Earlier in the chain'; rt.title = 'Later in the chain'; rm.title = 'Remove';
      lt.disabled = i === 0; rt.disabled = i === s.ins.length - 1;
      lt.addEventListener('click', () => moveInsert(key, i, -1)); rt.addEventListener('click', () => moveInsert(key, i, 1)); rm.addEventListener('click', () => removeInsert(key, i));
      top.append(nm, lt, rt, rm);
      const ks = el('div', 'fxk'); for (const p of E.params) ks.append(paramKnob(p, x.p[p.key], v => setParam(key, i, p.key, v)));
      card.append(top, ks); chain.append(card);
    });
    const add = el('select', 'mxadd'); add.setAttribute('aria-label', 'Add an effect to ' + (NAMES[key] || key));
    add.innerHTML = '<option value="">+ Effect…</option>' + EFFECTS.map(e => `<option value="${e.key}">${e.label}: ${e.words}</option>`).join('');
    add.addEventListener('change', () => { if (add.value) addInsert(key, add.value); });
    chain.append(add); row.append(head, chain); rows.append(row);
  }
}
