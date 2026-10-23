// The instrument: the selected track's sound as a synth's front panel, in the editor's place under the arrangement (B).
// On the left the sound itself, one note of it drawn as it's made (a native model's note as the worker computed it, the
// poly synth or a drum machine rendered offline): its waveform over time and its spectrum. On the right its modules,
// each a card of rotary knobs (the physical model's physics; the poly synth's oscillators, filter with its response
// curve, envelopes drawn as they'll move, LFO, voices and output; a drum machine voice by voice). Under it a keyboard
// to play it (the mouse, or the computer's keys: A to K, W E T Y U O P the black keys, Z X an octave), or pads for a kit.
// Turning a knob is heard at once where the engine can (the poly synth, a drum machine); a native model is computed
// again when it's let go. Every change is one undo step on your own copy of the sound, as in the sound panel.
const WK = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'], BK = {w: 1, e: 3, t: 6, y: 8, u: 10, o: 13, p: 15};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), BLACK = [1, 3, 6, 8, 10];

export function makeSynthUI(A){
  const {ST, E, SB, h, $, isDrum, flash, editable, nn} = A;
  const V = {on: false, oct: null, held: new Map(), buf: null, bufKey: '', drawT: 0, warmKey: ''};
  const box = $('inst');

  /* ---------- a knob: drag up or down (Shift: finer), the wheel, the arrows; double-click puts it back ---------- */
  function knob(it){ const {min, max, log} = it, toU = v => clamp(log ? Math.log(v/min)/Math.log(max/min) : (v - min)/(max - min), 0, 1), fromU = u => log ? min*Math.pow(max/min, u) : min + u*(max - min);
    const snap = v => log ? +v.toPrecision(3) : +(Math.round(v/it.step)*it.step).toFixed(4), fmt = it.fmt || (v => (+v).toFixed(2));
    let u = toU(it.value), cur = it.value;
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 44 44'); svg.setAttribute('class', 'kn-dial');
    const arc = (a0, a1) => { const r = 17, p = a => [22 + r*Math.cos(a), 22 + r*Math.sin(a)], [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`; };
    const A0 = Math.PI*.75, SPAN = Math.PI*1.5, track = document.createElementNS(NS, 'path'), fill = document.createElementNS(NS, 'path'), cap = document.createElementNS(NS, 'circle'), tick = document.createElementNS(NS, 'line');
    track.setAttribute('d', arc(A0, A0 + SPAN)); track.setAttribute('class', 'kn-track'); fill.setAttribute('class', 'kn-fill'); cap.setAttribute('cx', 22); cap.setAttribute('cy', 22); cap.setAttribute('r', 12); cap.setAttribute('class', 'kn-cap'); tick.setAttribute('class', 'kn-tick');
    svg.append(track, fill, cap, tick);
    const val = h('div', {class: 'kn-val'}), el = h('div', {class: 'kn', tabindex: '0', role: 'slider', 'aria-label': it.label, title: `${it.label}: drag up or down (Shift for fine), double-click to put back`}, svg, h('div', {class: 'kn-lab'}, it.label), val);
    const paint = () => { const a = A0 + SPAN*u; fill.setAttribute('d', u > .002 ? arc(A0, a) : ''); tick.setAttribute('x1', 22 + 5*Math.cos(a)); tick.setAttribute('y1', 22 + 5*Math.sin(a)); tick.setAttribute('x2', 22 + 11*Math.cos(a)); tick.setAttribute('y2', 22 + 11*Math.sin(a));
      val.textContent = fmt(cur); el.setAttribute('aria-valuetext', fmt(cur)); };
    paint();
    const move = nu => { u = clamp(nu, 0, 1); cur = snap(fromU(u)); paint(); it.live?.(cur); graphs(it.key, cur); };
    let setT = 0; const later = () => { clearTimeout(setT); setT = setTimeout(() => set(cur), 450); };
    // (let go: one undo step; a note plays to hear it, unless one is being held on the keys already)
    const set = v => { const note = V.held.size ? null : noteFor(); if (!SB.change(it, v, {note, quiet: !!V.held.size})) { u = toU(it.value); cur = it.value; paint(); } };
    el.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); el.focus(); if (!editable()) return; el.setPointerCapture(e.pointerId); let y = e.clientY, moved = false;
      const mm = ev => { const dy = y - ev.clientY; y = ev.clientY; if (dy) { moved = true; move(u + dy/(ev.shiftKey ? 600 : 160)); } };
      const uu = () => { el.removeEventListener('pointermove', mm); el.removeEventListener('pointerup', uu); el.removeEventListener('pointercancel', uu); if (moved) set(cur); };
      el.addEventListener('pointermove', mm); el.addEventListener('pointerup', uu); el.addEventListener('pointercancel', uu); });
    el.addEventListener('wheel', e => { e.preventDefault(); if (!editable()) return; move(u - Math.sign(e.deltaY)*(e.shiftKey ? .005 : .025)); later(); }, {passive: false});
    el.addEventListener('keydown', e => { const d = {ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1}[e.key]; if (!d) return; e.preventDefault(); e.stopPropagation(); if (!editable()) return; move(u + d*(e.shiftKey ? .005 : log ? .02 : Math.max(.01, it.step/(max - min)))); later(); });
    el.addEventListener('dblclick', () => { clearTimeout(setT); set(undefined); });
    return el; }
  // a list: a row of buttons when it's short (the waves, the filter's type), a menu when it's long (the models)
  function choice(it){ const set = v => { if (!SB.change(it, v, {note: noteFor()})) render(); };
    if (it.list.length <= 3) return h('div', {class: 'kn-list', role: 'radiogroup', 'aria-label': it.label}, h('div', {class: 'kn-lab'}, it.label),
      h('div', {class: 'seg'}, ...it.list.map(([v, t]) => h('button', {'aria-pressed': String(String(v) === String(Math.round(it.value)) || v === it.value), onclick: () => set(v)}, t))));
    const s = h('select', {'aria-label': it.label}); for (const [v, t] of it.list) s.append(h('option', {value: v}, t)); s.value = it.value; s.onchange = () => set(s.value);
    return h('div', {class: 'kn-list wide'}, h('div', {class: 'kn-lab'}, it.label), s); }

  /* ---------- the graphs: the filter's response and the envelopes, redrawn as their knobs turn ---------- */
  let M = null, G = {}; const vals = () => ({...(M?.values || {})});
  function graphs(key, v){ if (M?.kind !== 'poly') return; if (key) M.values[key] = v; const P = M.values;
    if (G.filter) drawFilter(G.filter, P); if (G.amp) drawEnv(G.amp, P.aa, P.ad, P.as, P.ar, 1); if (G.fenv) drawEnv(G.fenv, P.fa, P.fd, P.fs, P.fr, P.fenv); }
  const fit = cv => { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.max(1, Math.round(r.width*d)); cv.height = Math.max(1, Math.round(r.height*d)); const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return [g, r.width, r.height]; };
  const css = k => getComputedStyle(document.body).getPropertyValue(k).trim();
  let fctx = null;
  function drawFilter(cv, P){ const [g, W, H] = fit(cv); g.clearRect(0, 0, W, H); fctx ??= new OfflineAudioContext(1, 1, 44100);
    const N = 120, fr = new Float32Array(N), mag = new Float32Array(N), ph = new Float32Array(N); for (let i = 0; i < N; i++) fr[i] = 20*Math.pow(1000, i/(N - 1));
    const curve = (cut, alpha) => { const t = ['lowpass', 'highpass', 'bandpass'][Math.round(P.ft)] || 'lowpass', f1 = fctx.createBiquadFilter(), f2 = fctx.createBiquadFilter(); f1.type = f2.type = t;
      f1.frequency.value = f2.frequency.value = clamp(cut, 20, 20000); f1.Q.value = P.res*14; f2.Q.value = P.res*4; const m2 = new Float32Array(N); f1.getFrequencyResponse(fr, mag, ph); f2.getFrequencyResponse(fr, m2, ph);
      g.beginPath(); for (let i = 0; i < N; i++) { const db = 20*Math.log10(Math.max(1e-5, mag[i]*m2[i])), y = H*.42 - db/48*H*.5; i ? g.lineTo(i/(N - 1)*W, clamp(y, 1, H - 1)) : g.moveTo(0, clamp(y, 1, H - 1)); }
      g.globalAlpha = alpha; g.stroke(); g.globalAlpha = 1; };
    g.strokeStyle = css('--line'); g.lineWidth = 1; for (const f of [100, 1000, 10000]) { const x = Math.log(f/20)/Math.log(1000)*W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.strokeStyle = css('--acc'); g.lineWidth = 1.2; g.setLineDash([3, 3]); curve(P.cut*Math.pow(2, P.fenv*6), .55); g.setLineDash([]); g.lineWidth = 2; curve(P.cut, 1);
    g.fillStyle = css('--mute'); g.font = '10px system-ui'; g.fillText('100', Math.log(5)/Math.log(1000)*W + 2, H - 3); g.fillText('1k', Math.log(50)/Math.log(1000)*W + 2, H - 3); g.fillText('10k', Math.log(500)/Math.log(1000)*W + 2, H - 3); }
  // attack, decay to the sustain, a held stretch, the release: in seconds on a scale that fits them all
  function drawEnv(cv, a, d, s, r, amt){ const [g, W, H] = fit(cv); g.clearRect(0, 0, W, H); const hold = .35, tot = a + d + hold + r, x = t => 4 + (W - 8)*t/tot, top = 6, bot = H - 6, y = v => bot - (bot - top)*v*(amt < 0 ? 1 : 1);
    g.beginPath(); g.moveTo(x(0), y(0)); g.lineTo(x(a), y(1)); for (let i = 1; i <= 24; i++) { const t = d*i/24; g.lineTo(x(a + t), y(s + (1 - s)*Math.exp(-3*t/d))); }
    g.lineTo(x(a + d + hold), y(s)); for (let i = 1; i <= 24; i++) { const t = r*i/24; g.lineTo(x(a + d + hold + t), y(s*Math.exp(-4*t/r))); }
    g.strokeStyle = css('--acc'); g.lineWidth = 2; g.stroke(); g.lineTo(x(tot), bot); g.lineTo(x(0), bot); g.closePath(); g.fillStyle = 'rgba(224,163,58,.12)'; g.fill();
    g.fillStyle = css('--mute'); g.font = '10px system-ui'; g.fillText(tot < 1 ? Math.round(tot*1000) + ' ms' : tot.toFixed(1) + ' s', W - 40, 12); if (amt < 0) g.fillText('down', 6, 12); }

  /* ---------- the sound drawn: one note, its waveform and its spectrum ---------- */
  const noteFor = () => M ? {...M.note} : null;
  async function sound(){ const M0 = M; if (!M0) return; const n = M0.note, key = `${M0.id}|${JSON.stringify(M0.s)}|${n.p}`; if (key === V.bufKey && V.buf) { drawSound(); return; }
    V.bufKey = key; $('iCap').textContent = 'Computing the note…'; const b = await E.render(ST.sel.track, M0.id, n.p, n.v, n.l); if (V.bufKey !== key) return;
    V.buf = b; drawSound(); }
  function drawSound(){ const cv = $('iWave'), [g, W, H] = fit(cv); g.clearRect(0, 0, W, H); const b = V.buf, h1 = Math.round(H*.55);
    g.fillStyle = css('--bg'); g.fillRect(0, 0, W, H); g.strokeStyle = css('--line'); g.beginPath(); g.moveTo(0, h1 + .5); g.lineTo(W, h1 + .5); g.moveTo(0, h1/2 + .5); g.lineTo(W, h1/2 + .5); g.stroke();
    if (!b) { $('iCap').textContent = 'No note to draw'; return; }
    const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L, sr = b.sampleRate; let end = L.length; while (end > 1 && Math.abs(L[end - 1]) < 1e-3) end--; end = Math.max(end, Math.round(sr*.1));
    let pk = 1e-4; for (let i = 0; i < end; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    // the waveform: each column's highest and lowest, both channels
    g.fillStyle = css('--acc'); for (let x = 0; x < W; x++) { const a = Math.floor(x/W*end), z = Math.max(a + 1, Math.floor((x + 1)/W*end)); let lo = 0, hi = 0; for (let i = a; i < z; i++) { const v = (L[i] + R[i])/2; if (v < lo) lo = v; if (v > hi) hi = v; }
      g.fillRect(x, h1/2 - hi/pk*h1*.45, 1, Math.max(1, (hi - lo)/pk*h1*.45)); }
    // the spectrum of its first moments: a Hann-windowed FFT, its harmonics against a log scale of frequency
    const N = 4096, re = new Float32Array(N), im = new Float32Array(N), off = Math.min(Math.round(sr*.01), Math.max(0, end - N)); for (let i = 0; i < N; i++) re[i] = ((L[off + i] || 0) + (R[off + i] || 0))/2*(.5 - .5*Math.cos(2*Math.PI*i/N));
    fft(re, im); const top = H - 4, base = h1 + 6, db = i => 10*Math.log10(re[i]*re[i] + im[i]*im[i] + 1e-12); let mx = -1e9; for (let i = 1; i < N/2; i++) mx = Math.max(mx, db(i));
    g.beginPath(); for (let x = 0; x <= W; x++) { const f0 = 30*Math.pow(16000/30, x/W), f1 = 30*Math.pow(16000/30, (x + 1)/W), i0 = Math.max(1, Math.floor(f0/sr*N)), i1 = Math.max(i0 + 1, Math.ceil(f1/sr*N)); let v = -1e9; for (let i = i0; i < i1 && i < N/2; i++) v = Math.max(v, db(i));
      const y = top - (top - base)*clamp((v - mx + 72)/72, 0, 1); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.lineTo(W, top); g.lineTo(0, top); g.closePath(); g.fillStyle = 'rgba(224,163,58,.22)'; g.fill(); g.strokeStyle = css('--acc'); g.lineWidth = 1; g.stroke();
    g.fillStyle = css('--mute'); g.font = '10px system-ui'; for (const [f, t] of [[100, '100'], [1000, '1k'], [10000, '10k']]) g.fillText(t, Math.log(f/30)/Math.log(16000/30)*W + 2, H - 6);
    g.fillText(`${(end/sr).toFixed(2)} s`, W - 40, 12);
    const n = M.note; $('iCap').textContent = `${typeof n.p === 'number' ? nn(n.p) : SB.VNAME[n.p] || n.p} · ${M.kind === 'poly' || M.s.voices && !M.s.voices[n.p]?.native ? 'rendered by the synth' : E.isLive(ST.sel.track) ? 'the model, played live (drawn from the same maths)' : 'computed by the model, as you’ll hear it'}`; }
  function fft(re, im){ const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2*Math.PI/len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let xr = 1, xi = 0; for (let j = 0; j < len/2; j++) {
      const k = i + j, l = k + len/2, tr = re[l]*xr - im[l]*xi, ti = re[l]*xi + im[l]*xr; re[l] = re[k] - tr; im[l] = im[k] - ti; re[k] += tr; im[k] += ti; const t = xr*wr - xi*wi; xi = xr*wi + xi*wr; xr = t; } } } }

  /* ---------- the keyboard (or a kit's pads) ---------- */
  const T = () => ST.P.tracks[ST.sel.track];
  function lowC(){ if (V.oct != null) return V.oct; const [lo, hi] = A.trackRange(T()); return 12*Math.floor(((lo + hi)/2 - 6)/12); }
  function keyOn(p, v = .8){ if (V.held.has(p)) return; V.held.set(p, 1); E.kbOn(ST.sel.track, SB.current(), p, v); light(p, true); }
  function keyOff(p){ if (!V.held.has(p)) return; V.held.delete(p); E.kbOff(ST.sel.track, p); light(p, false); }
  const light = (p, on) => { const k = box.querySelector(`[data-p="${p}"]`); if (k) k.dataset.down = on ? '1' : ''; };
  function keys(){ const wrap = $('iKeys'); wrap.innerHTML = ''; const drum = isDrum(T().role);
    if (drum) { const vs = M?.voices || []; vs.forEach((v, i) => { const pad = h('button', {class: 'pad', 'data-p': v, 'aria-pressed': String(v === M.voice), title: `${SB.VNAME[v] || v} (${WK[i] || ''})`}, SB.VNAME[v] || v, h('span', {class: 'pk'}, (WK[i] || '').toUpperCase()));
        pad.onpointerdown = e => { const r = pad.getBoundingClientRect(); keyOn(v, clamp(.35 + .65*(e.clientY - r.top)/r.height, .2, 1)); if (v !== M.voice) SB.setVoice(v); };
        pad.onpointerup = pad.onpointerleave = () => keyOff(v); wrap.append(pad); }); return; }
    const c0 = lowC(), oct = h('div', {class: 'koct'}, h('button', {title: 'An octave down (Z)', onclick: () => { V.oct = c0 - 12; keys(); }}, '−'), h('span', {}, nn(c0)), h('button', {title: 'An octave up (X)', onclick: () => { V.oct = c0 + 12; keys(); }}, '+'));
    const kb = h('div', {class: 'kb'}); let wi = 0; const whites = [...Array(25).keys()].filter(i => !BLACK.includes(i % 12)).length;
    for (let i = 0; i <= 24; i++) { const p = c0 + i, black = BLACK.includes(i % 12), comp = i < 10 + 7 ? (black ? Object.keys(BK).find(k => BK[k] === i) : WK[[0, 2, 4, 5, 7, 9, 11, 12, 14, 16].indexOf(i)]) : null;
      const k = h('div', {class: black ? 'bk' : 'wk', 'data-p': p, title: nn(p) + (comp ? ` (${comp.toUpperCase()})` : '')}, !black && p % 12 === 0 ? h('span', {}, nn(p)) : '');
      if (black) k.style.left = `calc(${wi/whites*100}% - ${.32/whites*100}%)`, k.style.width = `${.64/whites*100}%`; else { k.style.left = `${wi/whites*100}%`; k.style.width = `${1/whites*100}%`; wi++; }
      k.onpointerdown = e => { e.preventDefault(); kb.setPointerCapture?.(e.pointerId); const r = k.getBoundingClientRect(); keyOn(p, clamp(.35 + .65*(e.clientY - r.top)/r.height, .2, 1)); V.mouse = p; };
      k.onpointerenter = e => { if (e.buttons && V.mouse != null && V.mouse !== p) { keyOff(V.mouse); keyOn(p); V.mouse = p; } };
      kb.append(k); }
    kb.onpointerup = kb.onpointerleave = () => { if (V.mouse != null) { keyOff(V.mouse); V.mouse = null; } };
    wrap.append(oct, kb); warm(); }
  // the keys' notes computed ahead for a native model, so they're heard as soon as they're pressed
  function warm(){ if (M?.kind !== 'native') return; const c0 = lowC(), k = `${M.id}|${JSON.stringify(M.s.src)}|${c0}`; if (k === V.warmKey) return; V.warmKey = k;
    const ps = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 3, 7, 10].map(d => c0 + d); E.kbWarm(ST.sel.track, M.id, ps); }
  // the computer's keys, while the instrument shows (and nothing with a text box has the focus)
  const map = e => { const k = e.key.toLowerCase(); if (isDrum(T().role)) { const i = WK.indexOf(k); return i >= 0 ? M?.voices?.[i] : undefined; }
    const c0 = lowC(); if (WK.includes(k)) return c0 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16][WK.indexOf(k)]; if (k in BK) return c0 + BK[k]; };
  function onKey(e, down){ if (!V.on || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return false; const k = e.key.toLowerCase();
    if (down && (k === 'z' || k === 'x') && !isDrum(T().role)) { V.oct = lowC() + (k === 'z' ? -12 : 12); keys(); return true; }
    const p = map(e); if (p === undefined) return false; if (down) { if (!e.repeat) keyOn(p); } else keyOff(p); return true; }

  /* ---------- the panel ---------- */
  function render(){ if (!V.on || !ST.P) return; const t = T(); M = SB.model(); G = {}; if (!M) return; const s = M.s;
    $('iName').textContent = s.name; $('iFrom').textContent = `${t.name} · ${SB.famOf(s)} · ${SB.engineOf(s)}${s.mine ? '' : ' · changing it makes your own copy'}`; $('iScope').textContent = 'Changes ' + SB.scopeText();
    const live = E.isLive(ST.sel.track); $('iLive').hidden = !live; $('iLive').title = live ? 'Played live: turn a knob while a note sounds, hold a key to hold the note' : '';
    $('iReset').hidden = !s.mine || !s.base; const mods = $('iMods'); mods.innerHTML = '';
    for (const g of M.groups) { const card = h('section', {class: 'mod'}, h('h3', {}, g.name));
      if (M.kind === 'poly' && g.name === 'Filter') { const a = h('canvas', {class: 'graph', 'aria-label': 'The filter’s response'}), b = h('canvas', {class: 'graph', 'aria-label': 'The filter’s envelope'}); card.append(h('div', {class: 'graphs'}, a, b)); G.filter = a; G.fenv = b; }
      if (M.kind === 'poly' && g.name === 'Amp') { const a = h('canvas', {class: 'graph', 'aria-label': 'The volume’s envelope'}); card.append(h('div', {class: 'graphs'}, a)); G.amp = a; }
      const knobs = h('div', {class: 'knobs'}); for (const it of g.items) knobs.append(it.list ? choice(it) : knob(it)); card.append(knobs); mods.append(card); }
    requestAnimationFrame(() => { graphs(); sound(); }); keys(); }
  function show(on){ V.on = on; box.hidden = !on; $('edWrap').hidden = on; $('tabNotes').setAttribute('aria-pressed', String(!on)); $('tabInst').setAttribute('aria-pressed', String(on)); $('help').hidden = on; $('edName').hidden = on; $('edInfo').hidden = on;
    if (on) { const ed = $('editor'); if (ed.offsetHeight < 330) ed.style.height = Math.min(innerHeight - 200, 360) + 'px'; render(); } A.draw(); A.renderEd(); A.drawEdHead(); }
  $('tabInst').onclick = () => show(true); $('tabNotes').onclick = () => show(false);
  $('iPlay').onclick = () => { const n = noteFor(); if (n) E.preview(ST.sel.track, SB.current(), [n]); };
  $('iTry').onclick = () => SB.tryIt(); $('iSounds').onclick = () => SB.show(true); $('iReset').onclick = () => SB.reset();
  addEventListener('resize', () => { if (V.on) { graphs(); drawSound(); } });
  SB.onChange(() => { if (V.on) render(); });
  return {show, render, isOn: () => V.on, onKey, state: () => ({M, buf: V.buf, cap: $('iCap').textContent})};
}
