// The Prism lab (?lab=prism, or the published dist/prism-lab.html): the Prism alone in its room, with a touch panel to play the
// music's moments (a build, the drop, a breakdown, calm or intense), to play a track of your own, to hold or cycle each of its
// features, and to tune how it reacts (the Tune tab: TUNE.prism's feel numbers, kept on this device)
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { presets } from '../presets.js';
import { J } from '../journey/core.js';
import { setJourney } from '../ui/controls.js';
import { setPreset } from '../ui/presets.js';
import { prismShape, prismForm, prismTex, prismTexs, prismShapes, prismFigure, prismDetail, prismState, prismBrk, prismTension,
  prismCam, prismLasers, laserShows, prismRunUp, prismClear, prismSection, prismStyle, roomStyles, JAM, prismPick, jamGrab, jamTap } from '../visuals/objects/prism.js';
import { RULES } from '../visuals/objects/cells.js';
import { VISUALS } from '../visuals/registry.js';
import { showFps } from '../ui/fps.js';
import { resize } from '../render/gl.js';
import { GFX, setGfx, gfxLevel, Q } from '../render/quality.js';
import { GB, PRESETS as GROOVES, loadPreset, grooveToggle, setMute } from '../audio/groove.js';
import { buffer, playing, tracks, tIndex, togglePlay, nextTrack, prevTrack, playFrom, position } from '../audio/player.js';
import { F } from '../audio/foresee.js';
import { L as HEAR } from '../audio/listen.js';
import { G } from '../audio/beatgrid.js';
import { fmt } from '../util.js';

const LAYERS = [['orbit', 'Orbits'], ['comets', 'Comets'], ['fireflies', 'Fireflies'], ['stargate', 'Stargate'], ['rain', 'Rain']];
const LAYER_ON = .3;   // (in the room a layer this strong is drawn fully in 3D: TUNE.prism.show.flat)
const BUILD_BARS = 4;  // a build runs up to its drop over this many bars
const SAVE = 'afterglow.prismlab';   // the Tune tab's settings, on this device

// the Tune tab: [path in TUNE.prism, label, min, max, step]
const KNOBS = [
  ['How lively', [
    ['act.cap', 'Liveliness between drops', 0, 1, .01],
    ['act.base', 'Liveliness at rest', 0, .5, .01],
    ['act.rise', 'Wakes up over (seconds)', .5, 15, .5],
    ['act.fall', 'Settles over (seconds)', .5, 10, .5],
    ['act.brk', 'Liveliness in a breakdown', 0, 1, .05],
    ['act.dropBars', 'A drop lasts (bars)', 1, 16, 1],
    ['spin', 'Turning speed', 0, 1, .01],
    ['act.danceCalm', 'Dancing when calm', 0, 1, .05]]],
  ['Shapes', [
    ['morphSecs', 'A shape change takes (seconds)', .5, 8, .1],
    ['imp.next', 'How often it moves on to a new shape', 0, 1, .05],
    ['imp.step', 'How far each variation goes', 0, .6, .02],
    ['openChance', 'How often it opens up', 0, 1, .05],
    ['explode', 'Shatter on a drop', 0, 2, .05],
    ['breath', 'The bass swells it', 0, .3, .01],
    ['detCalm', 'Levels of facets when calm', 0, 3, 1]]],
  ['Light', [
    ['lit', 'Pattern brightness', 0, 2, .05],
    ['act.kickCalm', 'Kick light when calm', 0, 1, .05],
    ['glint', 'Glints', 0, 2, .05],
    ['tex.fire', 'Rainbow fire', 0, 2, .05],
    ['show.strobe', 'Kick strobe', 0, 3, .1]]],
  ['Room light', [
    ['light.ambient', 'Ambient light', 0, 1.5, .05],
    ['light.fill', 'Fill light from below', 0, 1, .05],
    ['light.height', 'Key light height (below → above)', 0, 1, .05],
    ['light.move', 'How much the lights move', 0, 1, .05],
    ['light.colour', 'Light colour (white → palette)', 0, 1, .05],
    ['light.aim', 'How much the beams wander', 0, .3, .01],
    ['show.swing', 'Stabs swing the key light', 0, 1, .05],
    ['light.refl', 'Floor reflection', 0, 1, .05]]],
  ['Room and lasers', [
    ['room.ease', 'The camera moves over (seconds)', .3, 5, .1],
    ['room.far', 'Camera distance when calm', 1.5, 8, .1],
    ['room.haze', 'Haze', 0, 1.5, .05],
    ['room.lampCalm', 'Lamps when calm', 0, 1, .05],
    ['lasers.max', 'Laser beams at most', 1, 8, 1],
    ['lasers.calm', 'Laser brightness when calm', 0, 1, .05]]],
];
// the Switches: each element on or off (TUNE.prism.on), kept with the Tune tab's settings
const SWITCHES = [['refl', 'Floor reflection'], ['shadow', 'Shadows'], ['fog', 'Fog and vignette'], ['glints', 'Sheen on the floor'], ['grid', 'Floor grid'],
  ['beams', 'Lamp beams'], ['spots', 'Mirror-ball spots'], ['lasers', '3D lasers'], ['caustics', 'Caustics'], ['fire', 'Rainbow fire'], ['patterns', 'Lit patterns'],
  ['strobe', 'Kick strobe'], ['dance', 'Its dance'], ['shatter', 'Shatter on drops'], ['layers3d', 'Layers in 3D'], ['camera', 'Camera moves']];
const at = path => { const ks = path.split('.'), last = ks.pop(); return [ks.reduce((o, k) => o[k], TUNE.prism), last]; };
const getT = path => { const [o, k] = at(path); return o[k]; };
const setT = (path, v) => { const [o, k] = at(path); o[k] = v; };
const DEF = Object.fromEntries([...KNOBS.flatMap(([, ks]) => ks.map(([p]) => [p, getT(p)])), ...SWITCHES.map(([k]) => ['on.' + k, getT('on.' + k)])]);   // (the defaults, before any saved ones)

const CSS = `
body.prismlab #bar,body.prismlab #welcome,body.prismlab #caption,body.prismlab #keyHud,body.prismlab #panel{display:none!important}
#plab{position:fixed;left:0;right:0;bottom:0;z-index:20;max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(4,6,10,.82);border-top:1px solid var(--line);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:15px;touch-action:manipulation;user-select:none;-webkit-user-select:none}
#plab.min .pgs,#plab.min .tune{display:none}
#plab .ph{display:flex;align-items:center;gap:8px}
#plab .ph b{color:var(--accent);letter-spacing:.06em;flex:none}
#plab .st{flex:1;min-width:0;color:var(--dim);font-size:12px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#plab .pg{margin-top:6px}
#plab .pg h3{margin:0 0 4px;font-size:11px;font-weight:500;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}
#plab .pr{display:flex;flex-wrap:wrap;gap:6px}
#plab button,#plab .lbtn{min-height:44px;min-width:44px;padding:6px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);font-size:15px;justify-content:center}
#plab button[aria-pressed=true]{background:var(--accent);color:#000;border-color:var(--accent)}
#plab button.big,#plab .lbtn{font-weight:600}
#plab button.drop{border-color:#ff5a7a;color:#ff9ab0}
#plab .cyc{display:inline-flex;align-items:stretch;border:1px solid var(--line);border-radius:10px;overflow:hidden}
#plab .cyc button{border:0;border-radius:0}
#plab .cyc span{display:flex;align-items:center;justify-content:center;min-width:120px;padding:0 8px;font-size:14px;border-left:1px solid var(--line);border-right:1px solid var(--line)}
#plab .cyc i{font-style:normal;color:var(--dim);font-size:11px;margin-right:6px}
#plab .bar{height:4px;border-radius:2px;background:var(--line);margin-top:6px;overflow:hidden}
#plab .bar i{display:block;height:100%;width:0;background:#ff5a7a}
#plab .trk{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}
#plab .tn{max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
#plab .sk{flex:1;position:relative;min-width:80px}
#plab .sk input{width:100%}
#plab .sk i{position:absolute;top:0;width:2px;height:6px;background:#ff5a7a;border-radius:1px;pointer-events:none}
#plab input[type=range]{height:32px}
#plab input[type=range]::-webkit-slider-thumb{width:22px;height:22px;margin-top:-9.5px}
#plab input[type=range]::-moz-range-thumb{width:22px;height:22px}
#plab .knob{display:grid;grid-template-columns:1fr auto;align-items:center;gap:0 8px;font-size:13px}
#plab .knob input{grid-column:1 / -1;width:100%}
#plab .knob output{color:var(--dim);font-variant-numeric:tabular-nums}
#plab .knob.set label,#plab .knob.set output{color:var(--accent)}
#plab .note{font-size:12px;color:var(--dim);margin:6px 0 0}
body.jamming canvas{touch-action:none;cursor:grab}
@media (min-width:700px){ #plab .pgs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px} }
@media (min-width:1180px){ #plab .pgs{grid-template-columns:repeat(3,minmax(0,1fr))} }
`;

export default function(){
  try { if (localStorage.getItem('afterglow.sharp')) TUNE.render.maxDpr = 2; } catch (e) {}   // (Sharp, remembered)
  // the Tune tab's settings saved on this device
  try { const s = JSON.parse(localStorage.getItem(SAVE) || '{}'); for (const p in s) if (p in DEF) setT(p, s[p]); } catch (e) {}
  const save = () => { const s = {}; for (const p in DEF) if (getT(p) !== DEF[p]) s[p] = getT(p); try { localStorage.setItem(SAVE, JSON.stringify(s)); } catch (e) {} return s; };

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('prismlab');
  const el = document.createElement('section'); el.id = 'plab'; el.setAttribute('aria-label', 'Prism lab'); document.body.appendChild(el);
  // (after the page's own setup has run: Journey off, the Prism in its room)
  requestAnimationFrame(() => requestAnimationFrame(start));

  const LS = {tab: 'play', room: true, brk: false, build: null, ten: 'auto', beat: 'auto', cam: 'auto', style: 'auto', jam: false, laser: 'auto', shape: -1, tex: -1, fig: -1, groove: -1, seeking: false};
  let p;   // the lab's own preset
  function start(){
    setJourney(false);
    const base = presets.find(q => q.name === 'Prism in the room');
    p = {...JSON.parse(JSON.stringify(base)), name: 'Prism lab'}; for (const v of VISUALS) p[v.key] = 0; p.prism = p.room = 1;   // (the Prism in its room, nothing else)
    setPreset(p, 'Prism lab'); showFps(false); render(); setInterval(tick, 100); requestAnimationFrame(watch);
    new ResizeObserver(fit).observe(el); addEventListener('resize', fit);
  }
  const set = (k, v) => { p[k] = v; };   // (the page eases what's drawn towards it)

  // the picture sits above the panel, as it does above the DJ panel (S.djH: render/gl.js draws it that much shorter)
  function fit(){ const h = Math.round(Math.min(el.offsetHeight, innerHeight*.6)); if (h === S.djH) return;
    S.djH = h; document.documentElement.style.setProperty('--djH', h + 'px'); document.body.classList.add('djopen'); resize(); }
  // the music's moments
  const drop = () => { prismRunUp(undefined); LS.build = null; J.lastDrop = performance.now(); };
  const build = () => { if (LS.build) { LS.build = null; prismRunUp(undefined); } else LS.build = {t: performance.now()}; render(); };
  const brk = () => { LS.brk = !LS.brk; prismBrk(LS.brk || undefined); if (GB.playing) { setMute('kick', LS.brk); setMute('bass', LS.brk); } render(); };
  const TEN = {auto: undefined, calm: .1, mid: .5, intense: .95}, BEAT = {auto: undefined, steady: 1, free: 0};
  const groove = () => {
    const names = Object.keys(GROOVES); LS.groove = LS.groove + 1 >= names.length ? -1 : LS.groove + 1;
    if (LS.groove < 0) { if (GB.playing) grooveToggle(); }
    else { if (playing) togglePlay(); loadPreset(names[LS.groove]); if (!GB.playing) grooveToggle(); if (LS.brk) { setMute('kick', true); setMute('bass', true); } }
    render();
  };

  // a track of your own, as Journey would hear it (Journey is off here, so the lab does its part): the drops read ahead land on
  // the moment (the run-up to them is Journey's, J.anticip, worked out with Journey off too), the live listening's drops where
  // nothing was read ahead, a new part of the Prism's program at each change the read-ahead found, and how steady the beat is
  const W = {t: null, id: -1, n: 0, ld: HEAR.drops, clear: 1};
  function watch(){
    requestAnimationFrame(watch);
    const now = performance.now(), t = F.ready && F.at ? F.at() : null;
    if (t != null && playing) {
      if (W.id !== F.id) { W.id = F.id; W.t = t; prismSection({n: ++W.n}); }
      if (W.t == null || t < W.t - .5) W.t = t;   // (a seek, or back to the start: the lab's own seeks clear W.t)
      for (const d of F.drops) if (d.t > W.t && d.t <= t && now - J.lastDrop > 2000) drop();
      for (const c of (F.map && F.map.changes) || []) if (c.t > W.t && c.t <= t) prismSection({n: ++W.n});
      W.t = t;
    }
    if (HEAR.drops !== W.ld) { W.ld = HEAR.drops; if (!(F.ready && F.drops.length && playing) && now - J.lastDrop > 15000) drop(); }
    W.clear += ((G.acP ? G.acConf : 1) - W.clear)*Math.min(1, 1/240);
    if (LS.beat === 'auto') prismClear(playing || GB.playing ? W.clear : undefined);
  }

  function tick(){
    if (playing && GB.playing) { grooveToggle(); LS.groove = -1; render(); }   // (a track started: the groovebox stops)
    if (LS.build) { const a = (performance.now() - LS.build.t)/1000/(BUILD_BARS*4*Math.max(.25, S.beatPeriod || .5)); if (a >= 1) drop(); else prismRunUp(a); }
    const b = el.querySelector('.bar i'); if (b) b.style.width = Math.max(LS.build ? Math.min(100, (performance.now() - LS.build.t)/10/(BUILD_BARS*4*Math.max(.25, S.beatPeriod || .5))) : 0, J.anticip*100) + '%';
    const s = prismState(), t = el.querySelector('.st');
    const next = playing && F.ready ? F.drops.find(d => d.t > position()) : null;
    if (t) t.textContent = `${s.form || ''} · ${s.tex} · ${s.prog ? s.prog.figure : ''} · detail ${s.det} · activity ${(s.act*100|0)}% · beams ${s.beams} · drawn at ${Math.round(Q.scale*Math.min(devicePixelRatio || 1, TUNE.render.maxDpr)*100/(devicePixelRatio || 1))}%${HEAR.brk ? ' · breakdown' : ''}${next ? ` · drop in ${Math.round(next.t - position())} s` : ''}`;
    const sk = el.querySelector('.sk input'), tt = el.querySelector('.tt'), pb = el.querySelector('[data-b=play]');
    if (sk && buffer && !LS.seeking) { sk.max = buffer.duration; sk.value = position(); }
    if (tt) tt.textContent = buffer ? `${fmt(position())} / ${fmt(buffer.duration)}` : '';
    if (pb) pb.textContent = playing ? '⏸' : '▶';
    const tn = el.querySelector('.tn'), name = tracks[tIndex] ? tracks[tIndex].name : 'No track: add one, or play the groovebox';
    if (tn && tn.textContent !== name) { tn.textContent = name; marks(); }
    if (F.id !== LS.markId || !F.ready) marks();
  }
  // the drops read ahead, marked on the seek bar
  function marks(){ const sk = el.querySelector('.sk'); if (!sk) return; sk.querySelectorAll('i').forEach(i => i.remove());
    if (!buffer || !F.ready) return; LS.markId = F.id; for (const d of F.drops) { const i = document.createElement('i'); i.style.left = (d.t/buffer.duration*100) + '%'; sk.appendChild(i); } }

  // cycling: ◂ name ▸, the first entry letting the music choose
  const cyc = (label, list, i) => { const cur = i < 0 ? 'Auto' : list[i];
    return `<span class="cyc" data-c="${label}"><button data-d="-1" aria-label="Previous ${label}">◂</button><span><i>${label}</i>${cur}</span><button data-d="1" aria-label="Next ${label}">▸</button></span>`; };
  const CYC = {
    Shape: [() => prismShapes(), 'shape', (n) => n ? prismShape(n) : prismForm(null)],
    Texture: [() => prismTexs(), 'tex', (n) => prismTex(n || 'glass')],
    Pattern: [() => [...RULES, 'life', 'improv'], 'fig', (n) => n && prismFigure(n)],
  };
  const btn = (id, text, on, cls = '') => `<button data-b="${id}" class="${cls}" ${on === undefined ? '' : `aria-pressed="${!!on}"`}>${text}</button>`;
  const opts = (key, list) => list.map(v => btn(`${key}:${v}`, v[0].toUpperCase() + v.slice(1), LS[key] === v)).join('');
  const num = (v, step) => step >= 1 ? String(v) : (+v).toFixed(step < .1 ? 2 : 1);
  function play(){
    const gn = Object.keys(GROOVES);
    return `<div class="pgs">
    <div class="pg"><h3>Music</h3><div class="pr"><label class="btn lbtn" for="fileIn" tabindex="0">＋ Add music</label>${btn('prev', '⏮')}${btn('play', '▶')}${btn('next', '⏭')}
      ${btn('groove', LS.groove < 0 ? '♪ Groovebox: off' : '♪ ' + gn[LS.groove], LS.groove >= 0)}</div>
      <div class="trk"><span class="tn"></span><span class="sk"><input type="range" min="0" max="1" step="0.1" value="0" aria-label="Seek"></span><span class="tt"></span></div></div>
    <div class="pg"><h3>Your hand</h3><div class="pr">${btn('jam', LS.jam ? '✋ Jamming' : '✋ Jam', LS.jam, 'big')}</div>
      <p class="note">${LS.jam ? 'Drag beside it to turn and tip it; press on it and drag out to pull, in (or hold) to push; tap for a ring of light, brightest on the beat.' : 'Shape the Prism by hand as the music plays.'}</p></div>
    <div class="pg"><h3>Moments</h3><div class="pr">${btn('build', LS.build ? 'Building…' : 'Build → drop', !!LS.build, 'big')}${btn('drop', 'Drop now', undefined, 'big drop')}${btn('brk', 'Breakdown', LS.brk)}</div>
      <div class="bar"><i></i></div></div>
    <div class="pg"><h3>Energy</h3><div class="pr">${opts('ten', Object.keys(TEN))}</div></div>
    <div class="pg"><h3>Beat</h3><div class="pr">${opts('beat', Object.keys(BEAT))}</div></div>
    <div class="pg"><h3>Prism</h3><div class="pr">${Object.entries(CYC).map(([k, [list, key]]) => cyc(k, list(), LS[key])).join('')}
      ${btn('det:-1', 'Facets −')}${btn('det:1', 'Facets +')}</div></div>
    <div class="pg"><h3>Room and camera</h3><div class="pr">${btn('room', 'Room', LS.room)}${opts('cam', ['auto', 'far', 'mid', 'near', 'inside', 'low'])}</div></div>
    <div class="pg"><h3>Room style</h3><div class="pr">${opts('style', ['auto', ...roomStyles()])}</div></div>
    <div class="pg"><h3>Graphics</h3><div class="pr">${GFX.map(([k, n]) => btn('gfx:' + k, n, gfxLevel() === k)).join('')}${btn('sharp', 'Sharp (Retina)', TUNE.render.maxDpr > 1.5)}</div>
      <p class="note">Auto draws smaller while frames run slow; Best always draws full size. Sharp draws every Retina pixel (slower).</p></div>
    <div class="pg"><h3>Switches</h3><div class="pr">${SWITCHES.map(([k, label]) => btn('sw:' + k, label, getT('on.' + k) > 0)).join('')}</div></div>
    <div class="pg"><h3>3D lasers</h3><div class="pr">${opts('laser', ['auto', ...laserShows(), 'off'])}</div></div>
    <div class="pg"><h3>Layers in 3D</h3><div class="pr">${LAYERS.map(([k, n]) => btn('layer:' + k, n, p && p[k] > 0)).join('')}</div></div>
    </div>`;
  }
  function tune(){
    return `<div class="tune"><p class="note">How the Prism reacts to the music. Changes apply at once and are kept on this device; a highlighted one differs from the default.</p>
    <div class="pgs">${KNOBS.map(([g, ks]) => `<div class="pg"><h3>${g}</h3>${ks.map(([path, label, mn, mx, step]) => { const v = getT(path);
      return `<div class="knob${v !== DEF[path] ? ' set' : ''}"><label for="k-${path}">${label}</label><output>${num(v, step)}</output>
        <input type="range" id="k-${path}" data-k="${path}" min="${mn}" max="${mx}" step="${step}" value="${v}"></div>`; }).join('')}</div>`).join('')}</div>
    <div class="pr" style="margin-top:8px">${btn('reset', 'Reset all')}${btn('copy', 'Copy settings')}</div></div>`;
  }
  function render(){
    const min = el.classList.contains('min');
    el.innerHTML = `<div class="ph"><b>PRISM LAB</b><span class="st"></span>${btn('tab:play', 'Play', LS.tab === 'play')}${btn('tab:tune', 'Tune', LS.tab === 'tune')}${btn('fps', 'FPS', !document.querySelector('#fps').hidden)}${btn('min', min ? 'Show ▴' : 'Hide ▾')}</div>
    ${LS.tab === 'play' ? play() : tune()}`;
    LS.markId = null; tick();
  }
  // jamming: the pointer on the picture (screen heights from its middle), the Prism's hooks doing the rest (prism.js: JAM)
  const JT = TUNE.prism.jam, G2 = {p: null};
  const spOf = e => { const H = innerHeight - (S.djH || 0); return [(e.clientX - innerWidth/2)/H, (H/2 - e.clientY)/H]; };
  addEventListener('pointerdown', e => {
    if (!LS.jam || e.target.closest('#plab') || e.target.tagName !== 'CANVAS') return;
    e.preventDefault(); e.stopPropagation();
    const [sx, sy] = spOf(e), pk = prismPick(sx, sy); JAM.drag = true; JAM.yawV = 0;
    G2.p = {id: e.pointerId, sx, sy, lx: sx, ly: sy, lt: performance.now(), t0: performance.now(), pk, q: pk && pk.hit ? jamGrab(pk.dir) : null, moved: false,
      r0: pk ? Math.hypot(sx - pk.c[0], sy - pk.c[1]) : 0};
  }, true);
  addEventListener('pointermove', e => {
    const g = G2.p; if (!g || e.pointerId !== g.id) return; e.preventDefault();
    const [sx, sy] = spOf(e), now = performance.now(), dx = sx - g.lx, dy = sy - g.ly, dt = Math.max(.008, (now - g.lt)/1000);
    if (Math.hypot(sx - g.sx, sy - g.sy) > .015) g.moved = true;
    if (g.q) { const r = Math.hypot(sx - g.pk.c[0], sy - g.pk.c[1]); g.q.target = Math.max(-JT.maxPull, Math.min(JT.maxPull, (r - g.r0)*JT.pull)); JAM.yaw += dx*JT.turn*.25; }
    else { JAM.yaw += dx*JT.turn; JAM.yawV = Math.max(-JT.maxSpin, Math.min(JT.maxSpin, JAM.yawV*.5 + dx*JT.turn/dt*.5)); JAM.tilt = Math.max(-.8, Math.min(.8, JAM.tilt - dy*JT.tilt)); JAM.tiltV = 0; }
    g.lx = sx; g.ly = sy; g.lt = now;
  }, true);
  const up = e => { const g = G2.p; if (!g || e.pointerId !== g.id) return; G2.p = null; JAM.drag = false;
    const quick = performance.now() - g.t0 < 250;
    if (!g.moved && quick && g.pk && g.pk.hit) { jamTap(g.pk.dir); if (g.q) { g.q.held = false; g.q.target = 0; } }
    else if (g.q) g.q.held = false;
    if (performance.now() - g.lt > 80) JAM.yawV = 0; };   // (a drag that stopped before letting go doesn't fling)
  addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  (function hold(){ requestAnimationFrame(hold); const g = G2.p; if (g && g.q && !g.moved && performance.now() - g.t0 > 250) g.q.target = Math.max(-JT.maxPull, g.q.target - JT.holdRate/60); })();   // holding still on it pushes a dent in

  el.addEventListener('input', e => {
    const k = e.target.dataset.k;
    if (k) { const v = +e.target.value; setT(k, v); const row = e.target.closest('.knob'); row.querySelector('output').textContent = num(v, +e.target.step); row.classList.toggle('set', v !== DEF[k]); save(); }
    else if (e.target.closest('.sk')) LS.seeking = true;
  });
  el.addEventListener('change', e => { if (e.target.closest('.sk')) { LS.seeking = false; W.t = null; const v = +e.target.value; playing ? playFrom(v) : (S.pausedAt = v); } });
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-c]'), b = e.target.closest('[data-b]');
    if (c && e.target.closest('[data-d]')) { const [list, key, go] = CYC[c.dataset.c], ls = list(), d = +e.target.closest('[data-d]').dataset.d;
      LS[key] = ((LS[key] + 1 + d) % (ls.length + 1) + ls.length + 1) % (ls.length + 1) - 1; go(LS[key] < 0 ? null : ls[LS[key]]); render(); return; }
    if (!b) return; const [id, v] = b.dataset.b.split(':');
    if (id === 'min') { el.classList.toggle('min'); render(); }
    else if (id === 'tab') { LS.tab = v; render(); }
    else if (id === 'fps') { showFps(document.querySelector('#fps').hidden); render(); }
    else if (id === 'play') { if (GB.playing && buffer) { grooveToggle(); LS.groove = -1; } togglePlay(); setTimeout(render, 50); }
    else if (id === 'prev') { W.t = null; prevTrack(); }
    else if (id === 'next') { W.t = null; nextTrack(); }
    else if (id === 'groove') groove();
    else if (id === 'build') build();
    else if (id === 'drop') { drop(); render(); }
    else if (id === 'brk') brk();
    else if (id === 'ten') { LS.ten = v; prismTension(TEN[v]); render(); }
    else if (id === 'beat') { LS.beat = v; prismClear(BEAT[v]); render(); }
    else if (id === 'det') { prismDetail(Math.max(0, Math.min(4, prismState().det + +v))); render(); }
    else if (id === 'room') { LS.room = !LS.room; set('room', LS.room ? 1 : 0); render(); }
    else if (id === 'gfx') { setGfx(v); render(); }
    else if (id === 'sharp') { TUNE.render.maxDpr = TUNE.render.maxDpr > 1.5 ? 1.5 : 2; try { localStorage.setItem('afterglow.sharp', TUNE.render.maxDpr > 1.5 ? '1' : ''); } catch (e) {} Q.pending = true; resize(); render(); }
    else if (id === 'sw') { setT('on.' + v, getT('on.' + v) > 0 ? 0 : 1); save(); render(); }
    else if (id === 'jam') { LS.jam = !LS.jam; JAM.on = LS.jam; document.body.classList.toggle('jamming', LS.jam); render(); }
    else if (id === 'style') { LS.style = v; prismStyle(v === 'auto' ? undefined : v); render(); }
    else if (id === 'cam') { LS.cam = v; prismCam(v === 'auto' ? undefined : v); render(); }
    else if (id === 'laser') { LS.laser = v; prismLasers(v === 'off' ? false : undefined, v === 'auto' || v === 'off' ? undefined : v); render(); }
    else if (id === 'layer') { set(v, p[v] > 0 ? 0 : LAYER_ON); render(); }
    else if (id === 'reset') { for (const k in DEF) setT(k, DEF[k]); save(); render(); }
    else if (id === 'copy') { const s = JSON.stringify(save(), null, 1); (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Could not copy'; }); }
  });
}
