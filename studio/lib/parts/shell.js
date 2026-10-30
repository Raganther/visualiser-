// The lab shell: what every playground's page shares, so a new one is a page asking one question. The host started in
// the audio thread, knobs built from any part's settings, a processor chain to edit (add, take out, move, switch off),
// meters, the waveform, things kept on this device, and notes copied out for Claude.
import { PROCS } from './procs.js';

export const $ = id => document.getElementById(id);
export const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n.startsWith('on')) e[n] = v; else if (/^(aria|data)-/.test(n) && typeof v === 'boolean') e.setAttribute(n, v); else if (v != null && v !== false) e.setAttribute(n, v === true ? '' : v); } e.append(...k.flat().filter(x => x != null && x !== false)); return e; };
// kept on this device under a prefix (a private window or blocked storage just forgets)
export const store = pre => ({ load: (k, d) => { try { const v = localStorage.getItem(pre + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  keep: (k, v) => { try { localStorage.setItem(pre + k, JSON.stringify(v)); } catch {} } });
export const clone = x => JSON.parse(JSON.stringify(x));

/* ---------- the host in the audio thread ---------- */
// the worklet's source is bundled into the page (a script tag of type text/plain), so the page needs nothing else
export async function startHost(srcId = 'worklet-src', onMeters){ const ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'interactive'});
  const u = URL.createObjectURL(new Blob([$(srcId).textContent], {type: 'text/javascript'})); await ctx.audioWorklet.addModule(u);
  const node = new AudioWorkletNode(ctx, 'parts-host', {numberOfInputs: 0, outputChannelCount: [2]}), an = ctx.createAnalyser(); an.fftSize = 2048;
  node.connect(an); node.connect(ctx.destination); node.port.onmessage = e => { if (e.data.type === 'meters') onMeters?.(e.data.m); };
  return {ctx, node, an, send: m => node.port.postMessage(m)}; }

/* ---------- settings as words and knobs ---------- */
export function fmt(p, v){ if (p.list) return p.list[Math.round(v)];
  switch (p.unit) {
    case 'dB': return (v > 0 ? '+' : '') + (+v).toFixed(1) + ' dB';
    case 'knee': return (20*Math.log10(v)).toFixed(1) + ' dB';
    case 'Hz0': if (v < 20) return 'all of it';
    // falls through
    case 'Hz': return v < 1000 ? `${Math.round(v)} Hz` : `${(v/1000).toFixed(1)} kHz`;
    case 'ms': return v < 10 ? (+v).toFixed(1) + ' ms' : Math.round(v) + ' ms';
    case 's': return (+v).toFixed(2) + ' s';
    case 'beat': return (+v).toFixed(2) + ' beat';
    case ':1': return (+v).toFixed(1) + ':1';
    case '×': return (+v).toFixed(2) + '×';
    case 'st': return (v > 0 ? '+' : '') + Math.round(v) + ' st';
    case 'pan': return Math.abs(v) < .02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100);
    default: return Math.round(v*100) + '%'; } }
// a slider's place (0..1000) and its value: log where it's asked for (frequencies, times, ratios)
const toV = (p, x) => { x /= 1000; return p.log ? p.min*Math.pow(p.max/p.min, x) : p.min + (p.max - p.min)*x; };
const toX = (p, v) => Math.round(1000*(p.log ? Math.log(v/p.min)/Math.log(p.max/p.min) : (v - p.min)/(p.max - p.min)));
// one setting as a control: a slider with its value in words, or buttons for a short list, a menu for a long one;
// double-click a slider: back to `reset` (or the setting's default)
export function control(p, v, on, {id, reset} = {}){ id ||= 'c-' + p.key + '-' + Math.random().toString(36).slice(2, 7);
  if (p.list && p.list.length <= 4) return h('div', {class: 'ctl', 'data-key': p.key}, h('span', {}, p.label), h('div', {class: 'seg', role: 'group', 'aria-label': p.label},
    ...p.list.map((name, i) => h('button', {'aria-pressed': Math.round(v) === i, onclick: e => { for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', b === e.target); on(i); }}, name))));
  if (p.list) { const s = h('select', {id, 'aria-label': p.label}, ...p.list.map((name, i) => h('option', {value: i, selected: Math.round(v) === i}, name))); s.onchange = () => on(+s.value);
    return h('div', {class: 'ctl', 'data-key': p.key}, h('span', {}, p.label), s); }
  const whole = p.unit === 'st', r = h('input', {type: 'range', id, min: whole ? p.min : 0, max: whole ? p.max : 1000, step: 1, value: whole ? Math.round(v) : toX(p, v)}), out = h('output', {for: id}, fmt(p, v));
  r.oninput = () => { const x = whole ? +r.value : toV(p, +r.value); out.textContent = fmt(p, x); on(x); };
  r.ondblclick = () => { const x = reset ?? p.def; r.value = whole ? x : toX(p, x); out.textContent = fmt(p, x); on(x); };
  return h('label', {class: 'ctl', 'data-key': p.key, title: 'Double-click: back to where it started'}, h('span', {}, p.label), out, r); }

/* ---------- a processor chain to edit ---------- */
// chain: [{id, key, params, on}]; change(chain, what) is called with a new array: 'param' (one setting: heard at once,
// nothing rebuilt), 'on', or 'list' (added, taken out, moved). The compressors' cards carry a meter (data-gr).
export function chainEditor(box, chain, change, {title = 'Processors', add = Object.keys(PROCS)} = {}){
  const paint = () => box.replaceChildren(...chain.map((s, i) => { const P = PROCS[s.key];
    const head = h('div', {class: 'phead'}, h('button', {class: 'pname', 'aria-pressed': s.on !== false, title: s.on !== false ? 'Switch off (bypass)' : 'Switch on', onclick: () => { s.on = s.on === false; change(chain, 'on', s); paint(); }}, P.label),
      P.meter ? h('span', {class: 'gr', 'data-gr': s.id}, '') : null,
      h('span', {class: 'pmove'}, h('button', {'aria-label': 'Move earlier', disabled: i === 0, onclick: () => { chain.splice(i - 1, 0, chain.splice(i, 1)[0]); change(chain, 'list'); paint(); }}, '◂'),
        h('button', {'aria-label': 'Move later', disabled: i === chain.length - 1, onclick: () => { chain.splice(i + 1, 0, chain.splice(i, 1)[0]); change(chain, 'list'); paint(); }}, '▸'),
        h('button', {'aria-label': 'Take out ' + P.label, onclick: () => { chain.splice(i, 1); change(chain, 'list'); paint(); }}, '✕')));
    return h('section', {class: 'proc', 'data-off': s.on === false, 'data-key': s.key}, head, h('p', {class: 'pwords'}, P.words),
      ...P.params.map(p => control(p, s.params?.[p.key] ?? p.def, x => { (s.params ||= {})[p.key] = x; change(chain, 'param', s, p.key); }))); }),
    h('div', {class: 'padd'}, h('select', {'aria-label': 'Add a processor', onchange: e => { if (!e.target.value) return; const key = e.target.value;
      chain.push({id: key + '-' + Math.random().toString(36).slice(2, 7), key, params: {}, on: true}); change(chain, 'list'); paint(); }},
      h('option', {value: ''}, '+ Add a processor…'), ...add.map(k => h('option', {value: k}, PROCS[k].label)))));
  paint(); return {paint, set: c => { chain = c; paint(); }}; }
// the compressors' meters: how much each is turning down, from the host's meters
export function showGr(meters){ for (const e of document.querySelectorAll('[data-gr]')) { let v = 0; for (const s of Object.values(meters)) if (s.gr && e.dataset.gr in s.gr) v = s.gr[e.dataset.gr];
  e.textContent = v > .05 ? `−${v.toFixed(1)} dB` : ''; e.style.setProperty('--gr', Math.min(1, v/12)); } }

/* ---------- the waveform, notes for Claude ---------- */
export function scope(c, an, color){ const x = new Float32Array(an.fftSize);
  const draw = () => { const w = c.width = c.clientWidth*devicePixelRatio, hh = c.height = c.clientHeight*devicePixelRatio, g = c.getContext('2d'); an.getFloatTimeDomainData(x); g.clearRect(0, 0, w, hh);
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(color).trim(); g.lineWidth = 1.5*devicePixelRatio; g.beginPath();
    for (let i = 0; i < x.length; i++) { const px = i/x.length*w, py = hh/2 - x[i]*hh*.46; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); requestAnimationFrame(draw); };
  draw(); }
export function copyOut(txt, status, area){ const done = () => { status.textContent = 'Copied: paste it to Claude'; setTimeout(() => status.textContent = '', 3000); };
  const fall = () => { area.value = txt; area.select(); status.textContent = 'Selected: copy it with your keyboard'; };
  try { navigator.clipboard.writeText(txt).then(done, fall); } catch { fall(); } }
// the shell's own styles for the chain editor and controls (a page adds its palette as --face, --line, --ink, --mute, --accent)
export const CSS = `
.ctl { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; font-size: 12.5px } .ctl > span { color: var(--mute) }
.ctl input[type=range] { grid-column: 1 / -1; width: 100%; accent-color: var(--accent) } .ctl output { font-family: var(--mono); font-size: 12px; font-variant-numeric: tabular-nums }
.ctl .seg, .ctl select { grid-column: 1 / -1 } .ctl select { background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 4px; padding: 5px 6px; font: inherit; font-size: 13px }
.seg { display: flex; border: 1px solid var(--line); border-radius: 4px; overflow: hidden } .seg button { flex: 1 1 auto; border: 0; background: transparent; padding: 6px 6px; font-size: 12px; font-weight: 600; white-space: nowrap }
.seg button + button { border-left: 1px solid var(--line) } .seg button[aria-pressed="true"] { background: var(--ink); color: var(--panel) }
.proc { background: var(--face); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; display: grid; gap: 8px; align-content: start; min-width: 0 }
.proc[data-off="true"] { opacity: .55 } .phead { display: flex; align-items: center; gap: 8px }
.pname { border: 1px solid var(--line); background: transparent; border-radius: 4px; padding: 4px 9px; font-weight: 700; font-size: 13px }
.pname[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); border-color: var(--accent) }
.pmove { margin-left: auto; display: flex; gap: 2px } .pmove button { border: 1px solid var(--line); background: transparent; border-radius: 3px; width: 26px; height: 24px; font-size: 12px }
.pmove button:disabled { opacity: .3 } .pwords { margin: 0; font-size: 12px; color: var(--mute); line-height: 1.35 }
.gr { font: 600 11.5px var(--mono); color: var(--accent); display: inline-block; width: 8ch; text-align: right } .padd select { width: 100%; background: transparent; color: var(--ink); border: 1px dashed var(--line); border-radius: 6px; padding: 10px; font: inherit; font-size: 13px }
`;
