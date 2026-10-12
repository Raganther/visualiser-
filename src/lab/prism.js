// The Prism lab (?lab=prism, or the published dist/prism-lab.html): the Prism alone in its room, with a touch panel to play the
// music's moments (a build, the drop, a breakdown, calm or intense) and to hold or cycle each of its features, without loading a track
import { S } from '../state.js';
import { presets } from '../presets.js';
import { J } from '../journey/core.js';
import { setJourney } from '../ui/controls.js';
import { setPreset } from '../ui/presets.js';
import { prismShape, prismForm, prismTex, prismTexs, prismShapes, prismFigure, prismDetail, prismState, prismBrk, prismTension,
  prismCam, prismLasers, laserShows, prismRunUp, prismClear } from '../visuals/objects/prism.js';
import { RULES } from '../visuals/objects/cells.js';
import { VISUALS } from '../visuals/registry.js';
import { showFps } from '../ui/fps.js';
import { resize } from '../render/gl.js';
import { GB, PRESETS as GROOVES, loadPreset, grooveToggle, setMute } from '../audio/groove.js';

const LAYERS = [['orbit', 'Orbits'], ['comets', 'Comets'], ['fireflies', 'Fireflies'], ['stargate', 'Stargate'], ['rain', 'Rain']];
const LAYER_ON = .3;   // (in the room a layer this strong is drawn fully in 3D: TUNE.prism.show.flat)
const BUILD_BARS = 4;  // a build runs up to its drop over this many bars

const CSS = `
body.prismlab #bar,body.prismlab #welcome,body.prismlab #caption,body.prismlab #keyHud,body.prismlab #panel{display:none!important}
#plab{position:fixed;left:0;right:0;bottom:0;z-index:20;max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(4,6,10,.82);border-top:1px solid var(--line);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:15px;touch-action:manipulation;user-select:none;-webkit-user-select:none}
#plab.min .pg{display:none}
#plab .ph{display:flex;align-items:center;gap:8px}
#plab .ph b{color:var(--accent);letter-spacing:.06em;flex:none}
#plab .st{flex:1;min-width:0;color:var(--dim);font-size:12px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#plab .pg{margin-top:8px}
#plab .pg h3{margin:0 0 4px;font-size:11px;font-weight:500;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}
#plab .pr{display:flex;flex-wrap:wrap;gap:6px}
#plab button{min-height:44px;min-width:44px;padding:6px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);font-size:15px;justify-content:center}
#plab button[aria-pressed=true]{background:var(--accent);color:#000;border-color:var(--accent)}
#plab button.big{font-weight:600}
#plab button.drop{border-color:#ff5a7a;color:#ff9ab0}
#plab .cyc{display:inline-flex;align-items:stretch;border:1px solid var(--line);border-radius:10px;overflow:hidden}
#plab .cyc button{border:0;border-radius:0}
#plab .cyc span{display:flex;align-items:center;justify-content:center;min-width:120px;padding:0 8px;font-size:14px;border-left:1px solid var(--line);border-right:1px solid var(--line)}
#plab .cyc i{font-style:normal;color:var(--dim);font-size:11px;margin-right:6px}
#plab .bar{height:4px;border-radius:2px;background:var(--line);margin-top:6px;overflow:hidden}
#plab .bar i{display:block;height:100%;width:0;background:#ff5a7a}
@media (min-width:700px){ #plab .pgs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px} }
@media (min-width:1180px){ #plab .pgs{grid-template-columns:repeat(3,minmax(0,1fr))} }
#plab .pg{margin-top:6px}
`;

export default function(){
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('prismlab');
  const el = document.createElement('section'); el.id = 'plab'; el.setAttribute('aria-label', 'Prism lab'); document.body.appendChild(el);
  // (after the page's own setup has run: Journey off, the Prism in its room)
  requestAnimationFrame(() => requestAnimationFrame(start));

  const L = {room: true, brk: false, build: null, ten: 'auto', beat: 'auto', cam: 'auto', laser: 'auto', shape: -1, tex: -1, fig: -1, groove: -1};
  let p;   // the lab's own preset
  function start(){
    setJourney(false);
    const base = presets.find(q => q.name === 'Prism in the room');
    p = {...JSON.parse(JSON.stringify(base)), name: 'Prism lab'}; for (const v of VISUALS) p[v.key] = 0; p.prism = p.room = 1;   // (the Prism in its room, nothing else)
    setPreset(p, 'Prism lab'); showFps(false); render(); setInterval(tick, 100);
    new ResizeObserver(fit).observe(el); addEventListener('resize', fit);
  }
  const set = (k, v) => { p[k] = v; };   // (the page eases what's drawn towards it)

  // the picture sits above the panel, as it does above the DJ panel (S.djH: render/gl.js draws it that much shorter)
  function fit(){ const h = Math.round(Math.min(el.offsetHeight, innerHeight*.6)); if (h === S.djH) return;
    S.djH = h; document.documentElement.style.setProperty('--djH', h + 'px'); document.body.classList.add('djopen'); resize(); }
  // the music's moments
  const drop = () => { prismRunUp(undefined); L.build = null; J.lastDrop = performance.now(); };
  const build = () => { if (L.build) { L.build = null; prismRunUp(undefined); } else L.build = {t: performance.now()}; render(); };
  const brk = () => { L.brk = !L.brk; prismBrk(L.brk || undefined); if (GB.playing) { setMute('kick', L.brk); setMute('bass', L.brk); } render(); };
  const TEN = {auto: undefined, calm: .1, mid: .5, intense: .95}, BEAT = {auto: undefined, steady: 1, free: 0};
  const groove = () => {
    const names = Object.keys(GROOVES); L.groove = L.groove + 1 >= names.length ? -1 : L.groove + 1;
    if (L.groove < 0) { if (GB.playing) grooveToggle(); }
    else { loadPreset(names[L.groove]); if (!GB.playing) grooveToggle(); if (L.brk) { setMute('kick', true); setMute('bass', true); } }
    render();
  };
  function tick(){
    if (L.build) { const a = (performance.now() - L.build.t)/1000/(BUILD_BARS*4*Math.max(.25, S.beatPeriod || .5)); if (a >= 1) drop(); else prismRunUp(a); }
    const s = prismState(), b = el.querySelector('.bar i'); if (b) b.style.width = (L.build ? Math.min(100, (performance.now() - L.build.t)/10/(BUILD_BARS*4*Math.max(.25, S.beatPeriod || .5))) : 0) + '%';
    const t = el.querySelector('.st'); if (t) t.textContent = `${s.form || ''} · ${s.tex} · ${s.prog ? s.prog.figure : ''} · detail ${s.det} · activity ${(s.act*100|0)}% · beams ${s.beams}`;
  }

  // cycling: ◂ name ▸, the first entry letting the music choose
  const cyc = (label, list, i, go) => { const cur = i < 0 ? 'Auto' : list[i];
    return `<span class="cyc" data-c="${label}"><button data-d="-1" aria-label="Previous ${label}">◂</button><span><i>${label}</i>${cur}</span><button data-d="1" aria-label="Next ${label}">▸</button></span>`; };
  const CYC = {
    Shape: [() => prismShapes(), 'shape', (n) => n ? prismShape(n) : prismForm(null)],
    Texture: [() => prismTexs(), 'tex', (n) => prismTex(n || 'glass')],
    Pattern: [() => [...RULES, 'life', 'improv'], 'fig', (n) => n && prismFigure(n)],
  };
  const btn = (id, text, on, cls = '') => `<button data-b="${id}" class="${cls}" ${on === undefined ? '' : `aria-pressed="${!!on}"`}>${text}</button>`;
  const opts = (key, list) => list.map(v => btn(`${key}:${v}`, v[0].toUpperCase() + v.slice(1), L[key] === v)).join('');
  function render(){
    const gn = Object.keys(GROOVES), min = el.classList.contains('min');
    el.innerHTML = `<div class="ph"><b>PRISM LAB</b><span class="st"></span>${btn('fps', 'Frame rate', !document.querySelector('#fps').hidden)}${btn('min', min ? 'Show ▴' : 'Hide ▾')}</div>
    <div class="pgs">
    <div class="pg"><h3>Music</h3><div class="pr">${btn('groove', L.groove < 0 ? '♪ Sound: off' : '♪ ' + gn[L.groove], L.groove >= 0)}
      ${btn('build', L.build ? 'Building…' : 'Build → drop', !!L.build, 'big')}${btn('drop', 'Drop now', undefined, 'big drop')}${btn('brk', 'Breakdown', L.brk)}</div>
      <div class="bar"><i></i></div></div>
    <div class="pg"><h3>Energy</h3><div class="pr">${opts('ten', Object.keys(TEN))}</div></div>
    <div class="pg"><h3>Beat</h3><div class="pr">${opts('beat', Object.keys(BEAT))}</div></div>
    <div class="pg"><h3>Prism</h3><div class="pr">${Object.entries(CYC).map(([k, [list, key]]) => cyc(k, list(), L[key])).join('')}
      ${btn('det:-1', 'Facets −')}${btn('det:1', 'Facets +')}</div></div>
    <div class="pg"><h3>Room and camera</h3><div class="pr">${btn('room', 'Room', L.room)}${opts('cam', ['auto', 'far', 'mid', 'near', 'inside', 'low'])}</div></div>
    <div class="pg"><h3>3D lasers</h3><div class="pr">${opts('laser', ['auto', ...laserShows(), 'off'])}</div></div>
    <div class="pg"><h3>Layers in 3D</h3><div class="pr">${LAYERS.map(([k, n]) => btn('layer:' + k, n, p && p[k] > 0)).join('')}</div></div>
    </div>`;
    tick();
  }
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-c]'), b = e.target.closest('[data-b]');
    if (c && e.target.closest('[data-d]')) { const [list, key, go] = CYC[c.dataset.c], ls = list(), d = +e.target.closest('[data-d]').dataset.d;
      L[key] = ((L[key] + 1 + d) % (ls.length + 1) + ls.length + 1) % (ls.length + 1) - 1; go(L[key] < 0 ? null : ls[L[key]]); render(); return; }
    if (!b) return; const [id, v] = b.dataset.b.split(':');
    if (id === 'min') { el.classList.toggle('min'); render(); }
    else if (id === 'fps') { showFps(document.querySelector('#fps').hidden); render(); }
    else if (id === 'groove') groove();
    else if (id === 'build') build();
    else if (id === 'drop') { drop(); render(); }
    else if (id === 'brk') brk();
    else if (id === 'ten') { L.ten = v; prismTension(TEN[v]); render(); }
    else if (id === 'beat') { L.beat = v; prismClear(BEAT[v]); render(); }
    else if (id === 'det') { prismDetail(Math.max(0, Math.min(4, prismState().det + +v))); render(); }
    else if (id === 'room') { L.room = !L.room; set('room', L.room ? 1 : 0); render(); }
    else if (id === 'cam') { L.cam = v; prismCam(v === 'auto' ? undefined : v); render(); }
    else if (id === 'laser') { L.laser = v; prismLasers(v === 'off' ? false : undefined, v === 'auto' || v === 'off' ? undefined : v); render(); }
    else if (id === 'layer') { set(v, p[v] > 0 ? 0 : LAYER_ON); render(); }
  });
}
