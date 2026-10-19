// The bench (?lab=bench, or the published dist/bench.html): the systems tested one at a time before they join the main
// stage (docs/space-plan.md). Step 1: one object and the light rig (scene/space.js: a key, a rim and a fill round it, the
// object's own lamps set aside), nothing else on screen, a song from audio/songs.js playing. The panel picks the object and
// how it's drawn, places the lights (presets, a map of the sky round it to drag them on, or a drag across the picture),
// sets their colour and brightness, keeps the object's own light show on the beat off (TUNE.show), compares the rig with the object's own lamps, and keeps an audit (a checklist and notes
// to copy for Claude). Laid out for a phone, the picture above; on a computer in rows, with keys.
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { solo } from '../ui/presets.js';
import { showFps } from '../ui/fps.js';
import { resize } from '../render/gl.js';
import { setGfx } from '../render/quality.js';
import { SPACE, RIG_PRESETS, rigPreset } from '../scene/space.js';
import { GB, grooveToggle } from '../audio/groove.js';
import { SONGS, playSong } from '../audio/songs.js';

const OBJECTS = [['jewel', 'Prism', 'facet'], ['skull', 'Skull', 'wire'], ['knot', 'Knot', 'wire'], ['hand', 'Hand', 'lit'], ['heart', 'Heart', 'lit'],
  ['mercury', 'Liquid metal', 'sdf'], ['ferro', 'Ferrofluid', 'sdf'], ['coral', 'Coral', 'sdf']];
// how each kind can be drawn: [label, setting, value]
const LOOKS = {wire: [['Glass', 'objStyle', 0], ['Solid', 'objStyle', 1], ['Shaded', 'objStyle', 5], ['Hologram', 'objStyle', 3]],
  lit: [['Real', 'litLook', 0], ['Chrome', 'litLook', 3], ['Marble', 'litLook', 4], ['Neon', 'litLook', 2]],
  sdf: [['Own', 'sdf', 0], ['Chrome', 'sdf', 1], ['Glass', 'sdf', 2], ['Iridescent', 'sdf', 4]], facet: []};
const COLOURS = {Warm: [1, .86, .7], White: [1, 1, 1], Cool: [.68, .8, 1], Amber: [1, .62, .28], Magenta: [1, .42, .88], Teal: [.35, 1, .88]};
const AUDIT = ['The key light\'s highlight follows it as I move it round', 'The rim light outlines the edge from behind', 'Light from below reads as from below',
  'The Prism, the skull, the hand and the liquid metal each look right', 'The colours feel right, nothing washed out', 'The rig looks better than the object\'s own lamps'];
const KEEP = 'afterglow.bench';

const CSS = `
body.bench #bar,body.bench #welcome,body.bench #caption,body.bench #keyHud,body.bench #panel,body.bench #fps{display:none!important}
#bench{position:fixed;left:0;bottom:0;width:100vw;box-sizing:border-box;z-index:20;max-height:56vh;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:10px max(14px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(14px,env(safe-area-inset-left,0px));
  background:rgba(5,6,12,.88);border-top:1px solid var(--line);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  font-size:15px;touch-action:manipulation;user-select:none;-webkit-user-select:none;display:grid;gap:12px}
#bench *{box-sizing:border-box}
#bench.min > :not(.bh){display:none}
#bench .bh{display:flex;align-items:center;gap:10px}
#bench .st{flex:1;min-width:0;font-size:13px;line-height:1.35;color:var(--dim)}
#bench .st b{display:block;color:var(--ink);font-size:14px;font-weight:600}
#bench h3{margin:0 0 6px;font-size:11px;font-weight:500;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}
#bench .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#bench button{min-height:44px;min-width:44px;padding:6px 13px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.05);font-size:15px;color:var(--ink)}
#bench button[aria-pressed=true]{background:var(--accent);color:#000;border-color:var(--accent)}
#bench button.play{min-width:60px;min-height:60px;border-radius:50%;font-size:22px;padding:0}
#bench .sw{width:26px;height:26px;border-radius:50%;padding:0;min-width:26px;min-height:26px;border:2px solid transparent}
#bench .sw[aria-pressed=true]{border-color:#fff}
#bench .map{display:flex;gap:12px;align-items:center}
#bench canvas.sky{position:static;inset:auto;display:block;z-index:auto;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,#141826 0 50%,#0a0c14 50% 100%);touch-action:none;flex:none;cursor:crosshair}
#bench .note{margin:0;font-size:12px;color:var(--dim);line-height:1.45}
#bench label.chk{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.3;padding:4px 0}
#bench label.chk input{width:22px;height:22px;flex:none;margin:0}
#bench textarea{width:100%;min-height:60px;background:rgba(255,255,255,.04);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px;font:inherit;font-size:14px}
#bench kbd{font:inherit;font-size:11px;opacity:.6;margin-left:4px}
@media (pointer: coarse){#bench kbd{display:none}}
@media (min-width: 900px){#bench{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start;column-gap:26px;max-height:48vh}#bench .bh,#bench .wide{grid-column:1/-1}#bench.min{grid-template-columns:1fr}}
`;

export default function bench(){
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('bench');
  const el = document.createElement('section'); el.id = 'bench'; el.setAttribute('aria-label', 'The bench'); document.body.appendChild(el);
  const R = SPACE.rig;
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEEP) || '{}'); } catch (e) {}
  const B = {obj: 'jewel', look: {}, sel: 0, mode: 'rig', song: SONGS[0].name, min: false, audit: {}, notes: '', show: false, ...saved};
  if (saved.lights) saved.lights.forEach((l, i) => Object.assign(R.lights[i], l));
  const keep = () => { try { localStorage.setItem(KEEP, JSON.stringify({...B, lights: R.lights.map(({az, el, k, c, on}) => ({az, el, k, c, on}))})); } catch (e) {} };
  requestAnimationFrame(() => requestAnimationFrame(start));

  function start(){
    showFps(false); S.explore.stage = 1; S.explore.space = 1;   // (the space round the object, for this visit: not saved)
    TUNE.show.on = B.show ? 1 : 0;   // (the object's own light show on the beat: off, so only the rig lights it)
    if (matchMedia('(pointer: coarse)').matches) setGfx('fast');   // (a phone: the picture lighter, so the music has time to play)
    pick(B.obj); mode(B.mode); render();
    new ResizeObserver(fit).observe(el); addEventListener('resize', fit); fit();
    addEventListener('keydown', keys, true);
    dragOn(window, 'pic');
    setInterval(status, 300);
  }
  // the picture sits above the panel (S.djH: the renderer draws it that much shorter)
  function fit(){ const h = Math.round(Math.min(el.offsetHeight, innerHeight*.56)); if (h === S.djH) return;
    S.djH = h; document.documentElement.style.setProperty('--djH', h + 'px'); document.body.classList.add('djopen'); resize(); }

  // the object alone, drawn the way chosen for its kind
  function pick(k){ B.obj = k; solo(k); S.active[k] = .9; look(); keep(); }
  const kind = () => (OBJECTS.find(o => o[0] === B.obj) || OBJECTS[0])[2];
  function look(){ const L = LOOKS[kind()], i = B.look[kind()] || 0, l = L[i]; if (!l) return;
    if (l[1] === 'sdf') TUNE.sdf.look = l[2]; else S.active[l[1]] = l[2]; }
  // the rig alone, the object's own lamps alone, or both
  function mode(m){ B.mode = m; R.on = m === 'own' ? 0 : 1; R.own = m === 'both' ? 1 : 0; keep(); }

  // the sky round the object: the middle straight overhead, the circle the horizon, outside it below; the camera at the bottom
  const SKY = 150, R0 = SKY*.25;
  const toSky = l => { const r = (Math.PI/2 - l.el)/(Math.PI/2)*R0*2*.98/2; return [SKY/2 + Math.sin(l.az)*r, SKY/2 + Math.cos(l.az)*r]; };
  function drawSky(c){ const g = c.getContext('2d'), d = devicePixelRatio || 1; if (c.width !== SKY*d) { c.width = c.height = SKY*d; } g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, SKY, SKY); g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(SKY/2, SKY/2, R0, 0, Math.PI*2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText('camera', SKY/2, SKY - 4); g.fillText('behind', SKY/2, 11);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(SKY/2, SKY/2, 6, 0, Math.PI*2); g.fill();
    R.lights.forEach((l, i) => { const [x, y] = toSky(l), c3 = l.c.map(v => Math.round(Math.min(1, v)*255)).join(',');
      g.globalAlpha = l.on ? 1 : .3; g.fillStyle = `rgb(${c3})`; g.beginPath(); g.arc(x, y, i === B.sel ? 9 : 6, 0, Math.PI*2); g.fill();
      if (i === B.sel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); } g.fillStyle = '#000'; g.font = 'bold 9px sans-serif'; g.fillText('KRF'[i], x, y + 3); g.globalAlpha = 1; }); }
  // dragging the selected light: on the sky, to where the finger is; across the picture, round it and up and down
  function dragOn(node, how){
    let last = null;
    node.addEventListener('pointerdown', e => { if (how === 'pic' && (e.target.tagName !== 'CANVAS' || el.contains(e.target))) return; last = [e.clientX, e.clientY]; node.setPointerCapture && node.setPointerCapture(e.pointerId); move(e, true); });
    node.addEventListener('pointermove', e => { if (last) move(e); });
    const up = () => { if (last) { last = null; keep(); } }; node.addEventListener('pointerup', up); node.addEventListener('pointercancel', up);
    function move(e, first){ const l = R.lights[B.sel];
      if (how === 'sky') { const r = node.getBoundingClientRect(), x = (e.clientX - r.left)/r.width*SKY - SKY/2, y = (e.clientY - r.top)/r.height*SKY - SKY/2;
        l.az = Math.atan2(x, y); l.el = Math.max(-1.45, Math.min(1.5, Math.PI/2 - Math.hypot(x, y)/R0*Math.PI/2)); }
      else if (!first) { l.az -= (e.clientX - last[0])*.012; l.el = Math.max(-1.45, Math.min(1.5, l.el - (e.clientY - last[1])*.01)); }
      last = [e.clientX, e.clientY]; drawSky(el.querySelector('canvas.sky')); status(); }
  }
  const where = l => { const a = ((l.az*180/Math.PI) % 360 + 540) % 360 - 180, e = Math.round(l.el*180/Math.PI);
    const side = Math.abs(a) < 30 ? 'in front' : Math.abs(a) > 150 ? 'behind' : a < 0 ? (Math.abs(a) < 90 ? 'front left' : 'back left') : (Math.abs(a) < 90 ? 'front right' : 'back right');
    return `${side}, ${e >= 0 ? e + '° up' : -e + '° below'}`; };

  // the music: a song on the groovebox
  function play(){ if (GB.playing) { grooveToggle(); } else { playSong(B.song); grooveToggle(); } render(); }
  function song(name){ B.song = name; keep(); if (GB.playing) { grooveToggle(); playSong(name); grooveToggle(); } render(); }

  function keys(e){
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const l = R.lights[B.sel], k = e.key; let used = true;
    if (k === '1' || k === '2' || k === '3') B.sel = +k - 1;
    else if (k === 'ArrowLeft') l.az += .15; else if (k === 'ArrowRight') l.az -= .15;
    else if (k === 'ArrowUp') l.el = Math.min(1.5, l.el + .12); else if (k === 'ArrowDown') l.el = Math.max(-1.45, l.el - .12);
    else if (k === ' ') play();
    else if (k === 'o' || k === 'O') { const i = OBJECTS.findIndex(o => o[0] === B.obj); pick(OBJECTS[(i + 1) % OBJECTS.length][0]); }
    else if (k === 'p' || k === 'P') { const n = Object.keys(RIG_PRESETS), i = (n.indexOf(B.preset) + 1) % n.length; B.preset = n[i]; rigPreset(n[i]); }
    else if (k === 'm' || k === 'M') { B.min = !B.min; }
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); keep(); render(); }
  }

  const btn = (id, label, on, cls, kb) => `<button data-id="${id}"${on != null ? ` aria-pressed="${!!on}"` : ''}${cls ? ` class="${cls}"` : ''}>${label}${kb ? `<kbd>${kb}</kbd>` : ''}</button>`;
  function status(){ const s = el.querySelector('.st'); if (!s) return; const l = R.lights[B.sel];
    s.innerHTML = `<b>Step 1: the object and the light rig</b>${(OBJECTS.find(o => o[0] === B.obj) || [])[1]} · ${R.on ? `${l.name} light ${where(l)}` : 'its own lamps'}${GB.playing ? ` · ♪ ${B.song}` : ''}`; }
  function render(){
    el.classList.toggle('min', !!B.min);
    const L = LOOKS[kind()], li = B.look[kind()] || 0, l = R.lights[B.sel];
    el.innerHTML = `
      <div class="bh">${btn('play', GB.playing ? '■' : '▶', null, 'play')}<div class="st"></div>${btn('min', B.min ? '▴' : '▾')}</div>
      <div><h3>Object</h3><div class="row">${OBJECTS.map(([k, n]) => btn('o:' + k, n, k === B.obj)).join('')}</div>
        ${L.length ? `<div class="row" style="margin-top:8px">${L.map((x, i) => btn('look:' + i, x[0], i === li)).join('')}</div>` : ''}</div>
      <div><h3>Light</h3><div class="row">${btn('m:rig', 'The rig', B.mode === 'rig')}${btn('m:own', 'Its own lamps', B.mode === 'own')}${btn('m:both', 'Both', B.mode === 'both')}</div>
        <div class="row" style="margin-top:8px">${Object.keys(RIG_PRESETS).map(n => btn('pre:' + n, n, n === B.preset)).join('')}</div>
        <div class="row" style="margin-top:8px">${btn('show', `Its own light show on the beat: ${B.show ? 'on' : 'off'}`, B.show)}</div></div>
      <div class="map"><canvas class="sky" aria-label="Where the lights stand round the object: drag the chosen one"></canvas>
        <div style="display:grid;gap:8px"><div class="row">${R.lights.map((x, i) => btn('sel:' + i, x.name[0].toUpperCase() + x.name.slice(1), i === B.sel, null, i + 1)).join('')}</div>
          <div class="row">${btn('onoff', l.on ? 'On' : 'Off', l.on)}${btn('k:-', '−')}<span style="min-width:44px;text-align:center">${Math.round(l.k*100)}%</span>${btn('k:+', '+')}</div>
          <div class="row">${Object.entries(COLOURS).map(([n, c]) => `<button class="sw" data-id="col:${n}" aria-label="${n}" aria-pressed="${c.every((v, j) => Math.abs(v - l.c[j]) < .01)}" style="background:rgb(${c.map(v => Math.round(v*255)).join(',')})"></button>`).join('')}</div></div></div>
      <div><h3>Music</h3><div class="row">${SONGS.map(s => btn('song:' + s.name, s.name, s.name === B.song)).join('')}</div>
        <p class="note">Drag a light on the sky map (the middle is overhead, the ring the horizon, outside it below; the camera at the bottom), or drag across the picture to swing the chosen light round. ${matchMedia('(pointer: fine)').matches ? 'Keys: 1 2 3 a light, arrows move it, P presets, O objects, Space music, M hide.' : ''}</p></div>
      <div class="wide"><h3>Audit: step 1</h3>${AUDIT.map((t, i) => `<label class="chk"><input type="checkbox" data-a="${i}"${B.audit[i] ? ' checked' : ''}> ${t}</label>`).join('')}
        <textarea placeholder="Notes: what looks wrong, what to change">${B.notes || ''}</textarea><div class="row">${btn('copy', 'Copy the audit for Claude')}</div></div>`;
    drawSky(el.querySelector('canvas.sky')); dragOn(el.querySelector('canvas.sky'), 'sky'); status(); fit();
    el.querySelectorAll('input[data-a]').forEach(c => c.onchange = () => { B.audit[c.dataset.a] = c.checked; keep(); });
    el.querySelector('textarea').oninput = e => { B.notes = e.target.value; keep(); };
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const [a, v] = b.dataset.id.split(/:(.*)/), l = R.lights[B.sel];
    if (a === 'play') return play();
    if (a === 'min') B.min = !B.min;
    else if (a === 'o') pick(v);
    else if (a === 'look') { B.look[kind()] = +v; look(); }
    else if (a === 'm') mode(v);
    else if (a === 'pre') { B.preset = v; rigPreset(v); }
    else if (a === 'sel') B.sel = +v;
    else if (a === 'onoff') l.on = l.on ? 0 : 1;
    else if (a === 'show') { B.show = !B.show; TUNE.show.on = B.show ? 1 : 0; }
    else if (a === 'k') l.k = Math.max(0, Math.min(3, +(l.k + (v === '+' ? .1 : -.1)).toFixed(2)));
    else if (a === 'col') l.c = COLOURS[v].slice();
    else if (a === 'song') return song(v);
    else if (a === 'copy') { const t = `The bench, step 1 (object and light rig)\nObject: ${B.obj}, light: ${B.mode}\n${AUDIT.map((x, i) => `${B.audit[i] ? '✓' : '✗'} ${x}`).join('\n')}\nLights: ${R.lights.map(x => `${x.name} ${where(x)} at ${Math.round(x.k*100)}%${x.on ? '' : ' (off)'}`).join('; ')}\nNotes: ${B.notes || '(none)'}`;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Couldn\'t copy'; }); return; }
    keep(); render();
  });
}
