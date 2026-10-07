// Small controls for the panels under the picture (ui/dj.js, ui/groove.js): an element, a knob, a slider.
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// a knob: drag up or down (or the wheel) to turn it, double-click to set it back
export function knob(label, min, max, def, fmt, onChange, init = def){   // (init: where it starts, if not at def)
  const k = el('div', 'knob'), svg = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" class="kt"/><path class="ka"/><line x1="20" y1="20" x2="20" y2="7" class="kp"/></svg>`;
  k.innerHTML = svg + `<span class="kv"></span><span class="kl">${label}</span>`; k.tabIndex = 0; k.setAttribute('role', 'slider'); k.setAttribute('aria-label', label);
  let v = def;
  // the setting it goes back to sits at twelve o'clock (0 dB, the filter off), the arc growing either way from there
  const ang = x => x < def ? -2.4*(def - x)/(def - min || 1) : 2.4*(x - def)/(max - def || 1);
  const arc = a => { const r = 15, p = t => [20 + r*Math.sin(t), 20 - r*Math.cos(t)], [x0, y0] = p(Math.min(0, a)), [x1, y1] = p(Math.max(0, a)); return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const set = (nv, quiet) => {
    v = Math.max(min, Math.min(max, nv)); const a = ang(v);
    k.querySelector('.ka').setAttribute('d', arc(a)); k.querySelector('.kp').setAttribute('transform', `rotate(${a*180/Math.PI} 20 20)`);
    k.querySelector('.kv').textContent = fmt(v); k.setAttribute('aria-valuenow', v.toFixed(2)); if (!quiet) onChange(v);
  };
  let y0 = 0, v0 = 0;
  k.addEventListener('pointerdown', e => { y0 = e.clientY; v0 = v; k.setPointerCapture(e.pointerId); k.classList.add('on'); e.preventDefault(); });
  k.addEventListener('pointermove', e => { if (k.hasPointerCapture(e.pointerId)) set(v0 + (y0 - e.clientY)/140*(max - min)); });
  k.addEventListener('pointerup', e => { k.releasePointerCapture(e.pointerId); k.classList.remove('on'); });
  k.addEventListener('wheel', e => { e.preventDefault(); set(v - Math.sign(e.deltaY)*(max - min)/40); }, {passive: false});
  k.addEventListener('dblclick', () => set(def));
  set(init, true); k.set = set; return k;
}
// a slider (range input) that double-click sets back
export function slider(cls, min, max, step, def, label, onInput, init = def){
  const s = el('input', cls); Object.assign(s, {type: 'range', min, max, step, value: init}); s.setAttribute('aria-label', label);
  s.addEventListener('input', () => onInput(+s.value)); s.addEventListener('dblclick', () => { s.value = def; onInput(def); });
  return s;
}
