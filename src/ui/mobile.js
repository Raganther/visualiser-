// The simple controls for a phone (and a computer that wants them): the picture above, a short panel below, and none of the
// rest of the interface. Two pages use it: the phone view of the whole visualiser (src/lab/phone.js: Journey with every
// world, layer and object, the genome on or off, likes) and the genome page (src/lab/genome.js: only the pieces the genome
// reaches, Together against Separate, the Prism always the centrepiece). Both play a song on the groovebox (no track to
// load: pages can't reach the phone's files easily), and on a computer lie in one row with keys: Space plays, N the next
// section, T the genome, 1 2 3 its switches, M hides the controls.
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { STEER } from '../journey/steer.js';
import { steerKal, genKalApply } from '../journey/extras.js';
import { nudge } from '../journey/director.js';
import { NAMES } from '../journey/cast.js';
import { setJourney } from './controls.js';
import { showFps, pickHeavy } from './fps.js';
import { resize } from '../render/gl.js';
import { setGfx } from '../render/quality.js';
import { GB, loadPreset, grooveToggle, bind } from '../audio/groove.js';
import { SONGS, playSong } from '../audio/songs.js';
import { WORLD_VISUALS, LAYER_VISUALS, byKey } from '../visuals/registry.js';
import { GEN, MOTIFS, MATS, FOLDS, genNew, genKeep, genWords } from '../scene/genome.js';
import { $ } from '../util.js';
import { genKey } from './keys.js';

const DESK = matchMedia('(pointer: fine)').matches && innerWidth >= 900;   // (a computer: room for the heavier worlds)
// a song for the groovebox: an intro, the groove, a lift, a breakdown and the drop, 64 bars round and round
const SONG = [...Array(8).fill(0), ...Array(16).fill(1), ...Array(8).fill(3), ...Array(8).fill(2), ...Array(16).fill(1), ...Array(8).fill(3)];
const FULL = 'https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ';

const CSS = `
body.genlab #bar,body.genlab #welcome,body.genlab #caption,body.genlab #keyHud,body.genlab #panel,body.genlab #fps{display:none!important}
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
@media (min-width: 900px){#glab{grid-template-columns:repeat(auto-fit,minmax(220px,auto));justify-content:start;align-items:end;column-gap:24px;max-height:none}
  #glab .gh,#glab .note{grid-column:1/-1}#glab .st b{white-space:normal}#glab.min{grid-template-columns:1fr}#glab button{min-height:40px}#glab button.play{min-width:56px;min-height:56px}}
`;

// opts: save (where its own settings are kept), pool ({worlds, layers}: Journey casts only from these, the Prism always the
// centrepiece; none: everything), separate (off means each piece its own kaleidoscope, pinned here, rather than Journey's
// own), gfx (the graphics level to start at), heavy (the 3D worlds' row), likes, leave (a way back to the full controls)
export function mobilePage(o){
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('genlab');
  const el = document.createElement('section'); el.id = 'glab'; el.setAttribute('aria-label', 'Controls'); document.body.appendChild(el);
  const LS = {min: false, gfx: o.gfx || 'fast', heavy: null, song: SONGS[0].name};
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(o.save) || '{}'); } catch (e) {}
  Object.assign(LS, saved);
  const keep = () => { try { localStorage.setItem(o.save, JSON.stringify({gfx: LS.gfx, heavy: LS.heavy, min: LS.min, song: LS.song, on: GEN.on, geo: GEN.geo, col: GEN.col, line: GEN.line})); } catch (e) {} genKeep(); };
  for (const k of ['on', 'geo', 'col', 'line']) if (k in saved) GEN[k] = saved[k]; else if (k === 'on') GEN.on = true;   // (the genome on, the first time)
  const worlds = o.pool ? [...o.pool.worlds, ...(DESK ? o.pool.desk || [] : [])] : null;
  requestAnimationFrame(() => requestAnimationFrame(start));

  function start(){
    setJourney(true); showFps(false); setGfx(LS.gfx);
    if (o.heavy && LS.heavy) pickHeavy(LS.heavy);
    if (worlds) {   // Journey casts only from the pool; the Prism every section's centrepiece
      S.skipW = new Set(WORLD_VISUALS.map(v => v.key).filter(k => !worlds.includes(k)));
      for (const v of LAYER_VISUALS) if (!o.pool.layers.includes(v.key)) STEER.ban[v.key] = true;
      STEER.pin.jewel = true; S.explore.link = 1;   // (the fractal depths fold round the kaleidoscope's mirrors, which are the genome's)
    }
    J.recast = 'fresh';
    if (GEN.on) genNew(J.type); apply(); render(); setInterval(watch, 250);
    new ResizeObserver(fit).observe(el); addEventListener('resize', fit); fit();
  }
  // the picture sits above the controls (S.djH: render/gl.js draws it that much shorter)
  function fit(){ const h = Math.round(Math.min(el.offsetHeight, innerHeight*.55)); if (h === S.djH) return;
    S.djH = h; document.documentElement.style.setProperty('--djH', h + 'px'); document.body.classList.add('djopen'); resize(); }

  // the genome is Journey's own (each section its own, the kaleidoscope from it); apart on the genome page, the kaleidoscope
  // gets its own count and kind each section, pinned here
  let sepKal = null;
  function apply(){
    if (GEN.on || !o.separate) { if (o.separate) { delete STEER.pin.kal; delete STEER.ban.kal; STEER.kalMode = STEER.kalWhere = null; } genKalApply(); return; }
    STEER.kalWhere = null; if (!sepKal) sepKal = {n: 3 + Math.floor(Math.random()*7), mode: Math.floor(Math.random()*14)}; STEER.pin.kal = sepKal.n; STEER.kalMode = sepKal.mode;
    steerKal();
  }
  // each new section: apart, a new kaleidoscope; with a pool, mostly in one of its worlds, taking turns (the dark is rarer)
  let lastType = null, lastAge = 0, lastWorld = worlds ? worlds[0] : null;
  function watch(){
    const fresh = J.type !== lastType || J.secAge < lastAge; lastType = J.type; lastAge = J.secAge;
    if (fresh && J.type) { sepKal = null; apply();
      if (worlds && J.world === 'none' && Math.random() < .8) { J.world = worlds[(worlds.indexOf(lastWorld) + 1) % worlds.length]; J.worldTime = 0; J.recast = J.recast || 'keep'; } }
    if (J.world !== 'none') lastWorld = J.world;
    status();
  }

  // the music: one of the songs (audio/songs.js), or the groovebox playing a song of its starters
  function song(){
    if (playSong(LS.song)) return;
    const load = (i, name) => { GB.pat = i; loadPreset(name); };
    load(2, 'Breakdown'); load(3, 'Four to the floor'); load(0, 'Minimal'); load(1, 'Rolling acid');
    GB.pat = 0; bind(); GB.song = SONG.slice(); GB.songOn = true; GB.bpm = 126;
  }
  function play(){ if (!GB.playing) song(); grooveToggle(); render(); }

  const btn = (id, label, on, cls) => `<button data-id="${id}"${on != null ? ` aria-pressed="${!!on}"` : ''}${cls ? ` class="${cls}"` : ''}>${label}</button>`;
  const label = k => k && byKey[k] ? byKey[k].label : null;
  const words = () => {
    const w = label(J.world) || 'the dark';
    if (!o.separate) {   // the whole visualiser: what's on screen, and the genome
      const on = [w, NAMES[J.lead], J.centre && label(J.centre), J.kal && `a ${J.kal.n}-mirror kaleidoscope`].filter(Boolean).join(', ');
      return {head: GEN.on ? `Genome: ${genWords() || 'its own'}` : 'Journey, each piece its own', sub: `${on}${GEN.on ? `, generation ${GEN.id + 1}` : ''}`};
    }
    if (!GEN.on) return {head: 'Separate: each part its own', sub: `${w}, the Prism, a ${STEER.pin.kal || '?'}-mirror kaleidoscope`};
    const g = [GEN.geo ? `${GEN.n}-fold, ${MOTIFS[GEN.motif]}` : 'own shapes', GEN.col ? MATS[GEN.mat] : 'own colours'].join(' · ');
    return {head: `Together: ${g}`, sub: `${w} and the Prism, ${GEN.geo ? FOLDS[GEN.fold] + ', ' : ''}generation ${GEN.id + 1}`};
  };
  function status(){ const s = el.querySelector('.st'); if (!s) return; const w = words();
    s.innerHTML = `<b>${GEN.on && GEN.col ? `<span class="dot" style="background:hsl(${Math.round(GEN.hue*360)} 80% 60%)"></span>` : ''}${w.head}</b>${w.sub}`; }
  function render(){
    el.classList.toggle('min', LS.min);
    const heavy = LS.heavy || (() => { try { return localStorage.getItem('afterglow.heavyW') || 'all'; } catch (e) { return 'all'; } })();
    el.innerHTML = `<div class="gh">${btn('play', GB.playing ? '■' : '▶', null, 'play')}<div class="st"></div>${btn('next', 'Next<kbd>N</kbd>')}${btn('min', (LS.min ? '▴' : '▾') + '<kbd>M</kbd>')}</div>
      <div><h3>${o.separate ? 'The parts' : 'Genome'}</h3><div class="seg">${btn('on:1', (o.separate ? 'Together' : 'On') + '<kbd>T</kbd>', GEN.on)}${btn('on:0', o.separate ? 'Separate' : 'Off', !GEN.on)}</div></div>
      <div><h3>What the genome shares</h3><div class="row">${btn('geo', 'Symmetry and shape<kbd>1</kbd>', GEN.on && GEN.geo)}${btn('col', 'Material and colour<kbd>2</kbd>', GEN.on && GEN.col)}${btn('line', 'Grows from the last<kbd>3</kbd>', GEN.on && GEN.line)}</div></div>
      ${GEN.on ? `<div><h3>Steer the genome (held until let go)</h3><div class="row">${btn('gk:dn', '−')}${btn('gk:n', `${GEN.n}-fold`, !!GEN.held.n)}${btn('gk:up', '+')}${btn('gk:motif', MOTIFS[GEN.motif], !!GEN.held.motif)}${btn('gk:mat', MATS[GEN.mat], !!GEN.held.mat)}${btn('gk:hue', 'Colour', !!GEN.held.hue)}${btn('gk:back', '↶ Before')}${btn('gk:free', 'Let go')}</div></div>` : ''}
      <div><h3>Music</h3><div class="row">${[...SONGS.map(s => s.name), 'Starters'].map(n => btn('song:' + n, n, n === LS.song)).join('')}</div></div>
      ${o.likes ? `<div><h3>This moment</h3><div class="row">${btn('like', '👍')}${btn('dislike', '👎')}</div></div>` : ''}
      <div><h3>Graphics</h3><div class="row">${btn('gfx:fastest', 'Fastest', LS.gfx === 'fastest')}${btn('gfx:fast', 'Fast', LS.gfx === 'fast')}${btn('gfx:balanced', 'Balanced', LS.gfx === 'balanced')}${btn('gfx:best', 'Best', LS.gfx === 'best')}</div></div>
      ${o.heavy ? `<div><h3>3D worlds</h3><div class="row">${btn('heavy:all', 'All', heavy === 'all')}${btn('heavy:cosmos', 'No cosmos', heavy === 'cosmos')}${btn('heavy:none', 'Flat only', heavy === 'none')}</div></div>` : ''}
      <p class="note">${o.note}</p>`;
    status(); fit();
  }
  function act(id, v){
    if (id === 'play') play();
    else if (id === 'next') { nudge(); sepKal = null; apply(); }   // (nudge grows the genome's next generation: journey/director.js)
    else if (id === 'min') LS.min = !LS.min;
    else if (id === 'on') { GEN.on = v === '1'; sepKal = null; if (GEN.on) genNew(J.type); apply(); J.recast = 'fresh'; }
    else if (id === 'geo' || id === 'col' || id === 'line') { if (!GEN.on) GEN.on = true; GEN[id] = !GEN[id]; if (id !== 'line') genNew(J.type); apply(); }
    else if (id === 'song') { LS.song = v; if (GB.playing) { grooveToggle(); song(); grooveToggle(); } }
    else if (id === 'gfx') { LS.gfx = v; setGfx(v); }
    else if (id === 'heavy') { LS.heavy = v; pickHeavy(v); }
    else if (id === 'gk') {   // the genome steered by hand (ui/keys.js, as G then its keys): what's set is held
      if (v === 'dn' || v === 'up') genKey('n', Math.max(3, Math.min(12, GEN.n + (v === 'up' ? 1 : -1))), true);
      else if (v === 'n') genKey('n', GEN.n, true); else genKey(v, undefined, true);
    }
    else if (id === 'like' || id === 'dislike') { const b = $(id === 'like' ? '#likeBtn' : '#dislikeBtn'); if (b) b.click(); return; }   // (the bar's own: ui/taste.js keeps the moment)
    else if (id === 'leave') { o.leave(); return; }
    keep(); render();
  }
  el.addEventListener('click', e => { const b = e.target.closest('button, a[data-id]'); if (!b || !b.dataset.id) return; e.preventDefault(); const [id, v] = b.dataset.id.split(':'); act(id, v); b.blur(); });
  // on a computer: the keys (taken before the page's own, which this page doesn't show)
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === 'INPUT') return;
    const m = {' ': ['play'], n: ['next'], m: ['min'], t: ['on', GEN.on ? '0' : '1'], 1: ['geo'], 2: ['col'], 3: ['line']}[e.key.toLowerCase()];
    if (!m) return; e.preventDefault(); e.stopImmediatePropagation(); act(...m);
  }, true);
}
export { FULL };
