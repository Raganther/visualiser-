// The Synth section of the DJ panel (audio/keys.js, audio/engine/inst/poly.js): presets, the arpeggiator and latch, every knob in its group, and a keyboard to play it with the mouse or the computer's keys.
import { ARP_DIVS, ARP_MODES, SY, held, keyDown, keyUp, loadSynthPreset, onKeys, saveSynth, setArp, setLatch, setSynth } from '../audio/keys.js';
import { PARAMS, PRESETS } from '../audio/engine/inst/poly.js';
import { el } from './widgets.js';
import { paramKnob } from './mix.js';

// the computer's keys as a piano: the home row the white keys from C, the row above the black ones; Z and X shift the octave
const KEYMAP = {a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16};
const BASE = 48;   // C3: the keyboard's left end, before its octave shift
let box = null, kb = null, fillPre = () => {};
const sel = (cls, opts, val, on, label) => { const s = el('select', cls); s.setAttribute('aria-label', label); s.innerHTML = opts.map((o, i) => `<option value="${i}">${o}</option>`).join(''); s.value = val; s.addEventListener('change', () => on(+s.value)); return s; };
export function buildSynth(container){
  box = container;
  const top = el('div', 'stop');
  const pre = el('select', 'spre'); pre.setAttribute('aria-label', 'Synth preset');
  fillPre = () => { pre.innerHTML = (SY.preset ? '' : '<option value="">(your sound)</option>') + Object.keys(PRESETS).map(k => `<option>${k}</option>`).join(''); pre.value = SY.preset; };
  pre.addEventListener('change', () => { if (pre.value) { loadSynthPreset(pre.value); knobs(); fillPre(); } });
  const keys = el('button', 'skeys'); keys.title = 'Play with the computer\'s keys: A to K the white keys, W E T Y U the black ones, Z and X the octave (the page\'s own keys wait while this is on)';
  const latch = el('button', 'slatch', 'Latch'); latch.title = 'Hold the notes after letting go (a new chord replaces them)';
  keys.addEventListener('click', () => { SY.keys = !SY.keys; saveSynth(); state(); });
  latch.addEventListener('click', () => setLatch(!SY.latch));
  const dn = el('button', 'soct', 'Oct −'), up = el('button', 'soct', 'Oct +');
  dn.addEventListener('click', () => { SY.oct = Math.max(-3, SY.oct - 1); saveSynth(); state(); }); up.addEventListener('click', () => { SY.oct = Math.min(3, SY.oct + 1); saveSynth(); state(); });
  top.append(el('b', '', 'Synth'), pre, keys, latch, dn, up, el('span', 'tl', 'Arp'),
    sel('sarp', ARP_MODES, SY.arp, v => setArp('arp', v), 'Arpeggiator'), sel('sdiv', ARP_DIVS.map(d => d[0]), SY.div, v => setArp('div', v), 'Arpeggio step'),
    sel('saoct', ['1 oct', '2 oct', '3 oct'], SY.aoct - 1, v => setArp('aoct', v + 1), 'Arpeggio octaves'), el('span', 'shint'));
  fillPre();
  box.append(top, el('div', 'sgroups'), kb = el('div', 'skb'));
  knobs(); keyboard(); state();
  onKeys(state);
}
// the knobs, a box a group (oscillators, filter, amp, LFO, play, output)
function knobs(){
  const g = box.querySelector('.sgroups'); g.textContent = '';
  for (const [name, ps] of PARAMS) { const b = el('div', 'sgrp'); b.append(el('span', 'sgl', name)); const r = el('div', 'sgk'); for (const p of ps) r.append(paramKnob(p, SY.p[p.key], v => { const was = SY.preset; setSynth(p.key, v); if (was) fillPre(); })); b.append(r); g.append(b); }
}
// two octaves of keys, from the octave chosen; played with the mouse or a finger (sliding across plays the next key)
function keyboard(){
  kb.textContent = '';
  const white = [0, 2, 4, 5, 7, 9, 11], names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  let downKey = null;
  for (let o = 0; o < 2; o++) for (let s = 0; s < 12; s++) {
    const n = BASE + 12*o + s, b = el('div', 'sk ' + (white.includes(s) ? 'w' : 'b')); b.dataset.n = n; b.setAttribute('aria-label', names[s] + (3 + o));
    if (s === 0) b.textContent = 'C' + (3 + o);
    kb.append(b);
  }
  const at = e => { const x = document.elementFromPoint(e.clientX, e.clientY); return x && x.dataset && x.dataset.n ? +x.dataset.n : null; };
  kb.addEventListener('pointerdown', e => { const n = at(e); if (n == null) return; kb.setPointerCapture(e.pointerId); downKey = n; keyDown(n); e.preventDefault(); });
  kb.addEventListener('pointermove', e => { if (downKey == null || !kb.hasPointerCapture(e.pointerId)) return; const n = at(e); if (n != null && n !== downKey) { keyUp(downKey); downKey = n; keyDown(n); } });
  const end = () => { if (downKey != null) { keyUp(downKey); downKey = null; } };
  kb.addEventListener('pointerup', end); kb.addEventListener('pointercancel', end);
}
// what's lit: the keys sounding, the buttons' states
function state(){
  if (!box) return;
  box.querySelector('.skeys').textContent = SY.keys ? 'Keys: on' : 'Keys: off'; box.querySelector('.skeys').setAttribute('aria-pressed', SY.keys);
  box.querySelector('.slatch').setAttribute('aria-pressed', SY.latch);
  box.querySelector('.shint').textContent = `Octave ${SY.oct > 0 ? '+' : ''}${SY.oct}` + (SY.arp && !held.length ? ' · hold keys to arpeggiate' : '');
  kb.querySelectorAll('.sk').forEach(k => k.classList.toggle('on', held.includes(+k.dataset.n)));
}
// the computer's keys play it while Keys is on and the panel shows the synth (they're kept from the page's own while they do)
const pressed = new Set();
const mine = e => SY.keys && box && !box.hidden && !box.closest('[hidden]') && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
addEventListener('keydown', e => {
  if (!mine(e)) return; const k = e.key.toLowerCase();
  if (k === 'z' || k === 'x') { if (!e.repeat) { SY.oct = Math.max(-3, Math.min(3, SY.oct + (k === 'x' ? 1 : -1))); saveSynth(); state(); } }
  else if (k in KEYMAP) { if (!e.repeat && !pressed.has(k)) { pressed.add(k); keyDown(BASE + KEYMAP[k]); } }
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (pressed.has(k)) { pressed.delete(k); keyUp(BASE + KEYMAP[k]); e.stopImmediatePropagation(); } }, true);
