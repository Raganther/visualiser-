// The genome on the phone (?lab=genome, or the published dist/genome.html): the whole visualiser with the genome on
// (scene/genome.js: one symmetry, motif, material and colour a section that the Prism, the Lattice, the Corridor, the rose
// window, the kaleidoscope and the palette all read), and none of the rest of the interface: a big Play button that plays a
// song on the groovebox (no track to load), Together or Separate, the genome's switches, the next section, and the graphics.
// Journey runs throughout, casting only from the pieces the genome reaches; the Prism is always the centrepiece. The genome
// itself is Journey's (each section its own, journey/sections.js; the kaleidoscope from it, journey/extras.js): this page only
// turns it on and shows it. On a computer the controls lie in one row, and keys work: Space plays, N the next section, T
// together or separate, 1 2 3 the switches, M hides the controls.
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { STEER } from '../journey/steer.js';
import { steerKal, genKalApply } from '../journey/extras.js';
import { nudge } from '../journey/director.js';
import { setJourney } from '../ui/controls.js';
import { showFps } from '../ui/fps.js';
import { resize } from '../render/gl.js';
import { setGfx } from '../render/quality.js';
import { GB, loadPreset, grooveToggle, bind } from '../audio/groove.js';
import { WORLD_VISUALS, LAYER_VISUALS, byKey } from '../visuals/registry.js';
import { GEN, MOTIFS, MATS, FOLDS, genNew } from '../scene/genome.js';

const DESK = matchMedia('(pointer: fine)').matches && innerWidth >= 900;   // (a computer: room for the heavier worlds)
const WORLDS = ['lattice', 'corridor', 'kifs', ...(DESK ? ['hollow', 'cathedral'] : [])];   // (the worlds the genome reaches, and light enough for a phone)
const LAYERS = ['fireflies', 'orbit', 'comets', 'rosette', 'stargate', 'mandala', 'ring'];
const SAVE = 'afterglow.genomelab';
// a song for the groovebox: an intro, the groove, a lift, a breakdown and the drop, 64 bars round and round
const SONG = [...Array(8).fill(0), ...Array(16).fill(1), ...Array(8).fill(3), ...Array(8).fill(2), ...Array(16).fill(1), ...Array(8).fill(3)];

const CSS = `
body.genlab #bar,body.genlab #welcome,body.genlab #caption,body.genlab #keyHud,body.genlab #panel{display:none!important}
#glab{position:fixed;left:0;right:auto;bottom:0;width:100vw;max-width:100vw;box-sizing:border-box;z-index:20;max-height:55vh;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:10px max(14px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(14px,env(safe-area-inset-left,0px));
  background:rgba(5,6,12,.86);border-top:1px solid var(--line);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  font-size:15px;touch-action:manipulation;user-select:none;-webkit-user-select:none;display:grid;gap:10px}
#glab *{box-sizing:border-box}
#glab.min > :not(.gh){display:none}
#glab > *{min-width:0}
#glab .gh{display:flex;align-items:center;gap:10px}
#glab .st{flex:1;min-width:0;font-size:13px;line-height:1.3;color:var(--dim)}
#glab .st b{display:block;color:var(--ink);font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#glab .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:baseline}
#glab .row{display:flex;flex-wrap:wrap;gap:8px}
#glab h3{margin:0 0 6px;font-size:11px;font-weight:500;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}
#glab button{min-height:46px;min-width:46px;padding:6px 14px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.05);font-size:15px}
#glab button[aria-pressed=true]{background:var(--accent);color:#000;border-color:var(--accent)}
#glab button.play{min-width:64px;min-height:64px;border-radius:50%;font-size:24px;font-weight:600;padding:0}
#glab .seg{display:flex;border:1px solid var(--line);border-radius:12px;overflow:hidden}
#glab .seg button{flex:1;border:0;border-radius:0}
#glab .note{margin:0;font-size:12px;color:var(--dim);line-height:1.4}
#glab .note a{color:var(--accent)}
#glab kbd{font:inherit;font-size:11px;opacity:.6;margin-left:6px}
@media (pointer: coarse){#glab kbd{display:none}}
@media (min-width: 900px){#glab{grid-template-columns:minmax(200px,auto) 1fr auto;align-items:end;column-gap:24px;max-height:none}
  #glab .gh,#glab .note{grid-column:1/-1}#glab .st b{white-space:normal}#glab.min{grid-template-columns:1fr}#glab button{min-height:40px}#glab button.play{min-width:56px;min-height:56px}}
`;

export default function(){
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('genlab');
  const el = document.createElement('section'); el.id = 'glab'; el.setAttribute('aria-label', 'Genome controls'); document.body.appendChild(el);
  const LS = {min: false, gfx: 'fast'};
  try { Object.assign(LS, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (e) {}
  const keep = () => { try { localStorage.setItem(SAVE, JSON.stringify({gfx: LS.gfx, on: GEN.on, geo: GEN.geo, col: GEN.col, line: GEN.line})); } catch (e) {} };
  try { const s = JSON.parse(localStorage.getItem(SAVE) || '{}'); for (const k of ['on', 'geo', 'col', 'line']) if (k in s) GEN[k] = s[k]; else if (k === 'on') GEN.on = true; } catch (e) { GEN.on = true; }
  requestAnimationFrame(() => requestAnimationFrame(start));

  function start(){
    setJourney(true); showFps(false); setGfx(LS.gfx);
    // Journey casts only from the pieces the genome reaches; the Prism every section's centrepiece
    S.skipW = new Set(WORLD_VISUALS.map(v => v.key).filter(k => !WORLDS.includes(k)));
    for (const v of LAYER_VISUALS) if (!LAYERS.includes(v.key)) STEER.ban[v.key] = true;
    STEER.pin.jewel = true; J.recast = 'fresh';
    S.explore.link = 1;   // (the fractal depths fold round the kaleidoscope's mirrors, which are the genome's)
    if (GEN.on) genNew(J.type); apply(); render(); setInterval(watch, 250);
    new ResizeObserver(fit).observe(el); addEventListener('resize', fit); fit();
  }
  // the picture sits above the controls (S.djH: render/gl.js draws it that much shorter)
  function fit(){ const h = Math.round(Math.min(el.offsetHeight, innerHeight*.55)); if (h === S.djH) return;
    S.djH = h; document.documentElement.style.setProperty('--djH', h + 'px'); document.body.classList.add('djopen'); resize(); }

  // together, the genome is Journey's own (each section its own, the kaleidoscope from it); apart, the kaleidoscope gets its
  // own count and kind each section, pinned here
  let sepKal = null;
  function apply(){
    if (GEN.on) { delete STEER.pin.kal; delete STEER.ban.kal; STEER.kalMode = STEER.kalWhere = null; genKalApply(); return; }
    STEER.kalWhere = null; if (!sepKal) sepKal = {n: 3 + Math.floor(Math.random()*7), mode: Math.floor(Math.random()*14)}; STEER.pin.kal = sepKal.n; STEER.kalMode = sepKal.mode;
    steerKal();
  }
  // each new section: apart, a new kaleidoscope; mostly in one of its worlds, taking turns (the dark is rarer here)
  let lastType = null, lastAge = 0, lastWorld = 'kifs';
  function watch(){
    const fresh = J.type !== lastType || J.secAge < lastAge; lastType = J.type; lastAge = J.secAge;
    if (fresh && J.type) { sepKal = null; apply();
      if (J.world === 'none' && Math.random() < .8) { J.world = WORLDS[(WORLDS.indexOf(lastWorld) + 1) % WORLDS.length]; J.worldTime = 0; J.recast = J.recast || 'keep'; } }
    if (J.world !== 'none') lastWorld = J.world;
    status();
  }

  // the music: the groovebox playing a song of its starters
  function song(){
    const load = (i, name) => { GB.pat = i; loadPreset(name); };
    load(2, 'Breakdown'); load(3, 'Four to the floor'); load(0, 'Minimal'); load(1, 'Rolling acid');
    GB.pat = 0; bind(); GB.song = SONG.slice(); GB.songOn = true; GB.bpm = 126;
  }
  function play(){ if (!GB.playing) song(); grooveToggle(); render(); }

  const btn = (id, label, on, cls) => `<button data-id="${id}"${on != null ? ` aria-pressed="${!!on}"` : ''}${cls ? ` class="${cls}"` : ''}>${label}</button>`;
  const words = () => {
    const w = byKey[J.world] ? byKey[J.world].label : 'the dark';
    if (!GEN.on) return {head: 'Separate: each part its own', sub: `${w}, the Prism, a ${STEER.pin.kal || '?'}-mirror kaleidoscope`};
    const g = [GEN.geo ? `${GEN.n}-fold, ${MOTIFS[GEN.motif]}` : 'own shapes', GEN.col ? MATS[GEN.mat] : 'own colours'].join(' · ');
    const f = GEN.geo ? FOLDS[GEN.fold] + ', ' : '';
    return {head: `Together: ${g}`, sub: `${w} and the Prism, ${f}generation ${GEN.id + 1}`};
  };
  function status(){ const s = el.querySelector('.st'); if (!s) return; const w = words();
    s.innerHTML = `<b>${GEN.on && GEN.col ? `<span class="dot" style="background:hsl(${Math.round(GEN.hue*360)} 80% 60%)"></span>` : ''}${w.head}</b>${w.sub}`; }
  function render(){
    el.classList.toggle('min', LS.min);
    el.innerHTML = `<div class="gh">${btn('play', GB.playing ? '■' : '▶', null, 'play')}<div class="st"></div>${btn('next', 'Next<kbd>N</kbd>')}${btn('min', (LS.min ? '▴' : '▾') + '<kbd>M</kbd>')}</div>
      <div class="seg">${btn('on:1', 'Together<kbd>T</kbd>', GEN.on)}${btn('on:0', 'Separate', !GEN.on)}</div>
      <div><h3>What the genome shares</h3><div class="row">${btn('geo', 'Symmetry and shape<kbd>1</kbd>', GEN.on && GEN.geo)}${btn('col', 'Material and colour<kbd>2</kbd>', GEN.on && GEN.col)}${btn('line', 'Grows from the last<kbd>3</kbd>', GEN.on && GEN.line)}</div></div>
      <div><h3>Graphics</h3><div class="row">${btn('gfx:fastest', 'Fastest', LS.gfx === 'fastest')}${btn('gfx:fast', 'Fast', LS.gfx === 'fast')}${btn('gfx:balanced', 'Balanced', LS.gfx === 'balanced')}${btn('gfx:best', 'Best', LS.gfx === 'best')}</div></div>
      <p class="note">Together: the Prism, the world, the layers and the kaleidoscope share one symmetry, shape and material each section; the genome also picks what the kaleidoscope folds (mostly everything), and each section grows from the last. Separate: each picks its own. Next moves on to a new section. The full visualiser has the same switch (Adjust, then Genome on): <a href="https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ" target="_blank" rel="noopener">open it</a>.</p>`;
    status(); fit();
  }
  function act(id, v){
    if (id === 'play') play();
    else if (id === 'next') { nudge(); sepKal = null; apply(); }   // (nudge grows the genome's next generation: journey/director.js)
    else if (id === 'min') LS.min = !LS.min;
    else if (id === 'on') { GEN.on = v === '1'; sepKal = null; if (GEN.on) genNew(J.type); apply(); J.recast = 'fresh'; }
    else if (id === 'geo' || id === 'col' || id === 'line') { if (!GEN.on) GEN.on = true; GEN[id] = !GEN[id]; if (id !== 'line') genNew(J.type); apply(); }
    else if (id === 'gfx') { LS.gfx = v; setGfx(v); }
    keep(); render();
  }
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const [id, v] = b.dataset.id.split(':'); act(id, v); b.blur(); });
  // on a computer: the keys (taken before the page's own, which this page doesn't show)
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase(), m = {' ': ['play'], n: ['next'], m: ['min'], t: ['on', GEN.on ? '0' : '1'], 1: ['geo'], 2: ['col'], 3: ['line']}[k];
    if (!m) return; e.preventDefault(); e.stopImmediatePropagation(); act(...m);
  }, true);
}
