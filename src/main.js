// Boot and the render loop: sets up the renderer, seeds the particles and Journey clock, then runs a frame per animation tick.
import './util.js';
import './ui/toast.js';
import './render/gl.js';
import './render/shaders.js';
import './state.js';
import './render/canvas2d.js';
import './presets.js';
import './fx/particles.js';
import './journey/core.js';
import './audio/analysis.js';
import './journey/sections.js';
import './journey/worlds.js';
import './journey/transitions.js';
import './journey/cast.js';
import './journey/recipes.js';
import './journey/progression.js';
import './ui/panel.js';
import './journey/director.js';
import './fx/movers.js';
import './journey/pace.js';
import './fx/pulse.js';
import './fx/effects.js';
import './audio/beatgrid.js';
import './ui/presets.js';
import './audio/player.js';
import './audio/synth.js';
import './ui/controls.js';
import './ui/keys.js';   // the keyboard: groups, numbers, the strip
import './ui/transport.js';
import { refreshScene } from './ui/scene.js';
import { fpsTick } from './ui/fps.js';
import { showNow } from './ui/panel.js';
import { tasteFrame } from './ui/taste.js';
import { SF } from './visuals/worlds/cosmos/surface.js';   // (landed on a world, its planets aren't on screen)
import { showCaption } from './ui/caption.js';
import { S } from './state.js';
import { analyse, bands, hit, lastBeat, sBass, sMid, sTreb } from './audio/analysis.js';
import { tIndex, tracks } from './audio/player.js';
import { SIG, sig, updateSignals } from './scene/signals.js';
import { CTX, updateContext } from './scene/context.js';
import { resolveScene } from './scene/graph.js';
import { G } from './audio/beatgrid.js';
import { comets, shocks, stepFX } from './fx/effects.js';
import { applyMods } from './fx/movers.js';
import { NP, parts, seedParticles, stepParts } from './fx/particles.js';
import { J, SNAP } from './journey/core.js';
import { energyLevel } from './journey/sections.js';
import { stepJourney } from './journey/director.js';
import { PACE, paceDiv, setPace } from './journey/pace.js';
import { BASE, SPEC, curP, eff } from './presets.js';
import { drawGL, fbInfo, gl, initRenderer, r2d, resize, warmScenes } from './render/gl.js';
import { Q, qualityTick } from './render/quality.js';
import { TEMPLATES } from './scene/templates.js';
import { keyHold, live, padBlocked, padHold, pollPad } from './ui/controls.js';
import { sliders, updateSectionUI } from './ui/panel.js';
import { updateTimeUI } from './ui/transport.js';
import { TW, speedOf, stepTweaks } from './scene/tweaks.js';
import { stepDance } from './scene/dance.js';
import { L } from './audio/listen.js';
import { $, noise, reduceMotion } from './util.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, WORLD_VISUALS } from './visuals/registry.js';
const DANCE_CHARS = Object.fromEntries(OBJECT_VISUALS.map(v => [v.key, v.dance || {}]));   // each object's character as a dancer
import * as registry from './visuals/registry.js';
import { LABS, applyLabs, applyTune, bindLabToggles } from './lab.js';
import { TUNE } from './tuning.js';
import { F } from './audio/foresee.js';

applyTune();                                          // ?tune= overrides, before anything reads TUNE
initRenderer();
seedParticles();
J.clock = Math.random()*100;
/* ---------- render loop ---------- */
let frameN = 0, hueAcc = 0;
const UI = {acc: '', meter: ''};   // what the page last showed, so it's written only when it changes
const VIS = {bass:0, mid:0, treb:0};
function frame(now){
  requestAnimationFrame(frame);
  // 60 frames a second at most: trails, fades and flashes are counted per frame, so a 120 Hz screen would halve them. Paced
  // by a running deadline, not the time since the last frame, so screens whose ticks don't divide 60 (75, 90, 144 Hz) still
  // draw 60 a second instead of every other or third tick (37-48 fps, which the resolution then took for a slow device)
  if (frame.due === undefined) frame.due = now;
  if (now < frame.due - 3) return;   // (a tick up to 3 ms early counts: the timestamps jitter)
  frame.due = now - frame.due > 1000/60 ? now + 1000/60 : frame.due + 1000/60;   // after a stall, no burst to catch up
  const t0 = performance.now();
  try { render(now); } catch(e) { if (!frame.err) { frame.err = 1; showErr(e.message); } }
  fpsTick(now, performance.now() - t0, fpsInfo);
  tasteFrame();   // a like or dislike takes this frame's picture
  if (now - (frame.now || 0) > 500) { frame.now = now; showNow(eff); }   // the panel's "On screen" line
  if (!window.__noDraw && qualityTick(performance.now())) resize();   // slow frames: draw smaller (render/quality.js)
}
// the fps readout's last line: the renderer and its size, and what's on screen, so a slow stretch can be matched to its scene
function fpsInfo(){
  const c = $('#gl'), up = vs => vs.filter(v => eff[v.key] > .05).map(v => v.key);
  const what = [...up(WORLD_VISUALS), ...up(LAYER_VISUALS), ...up(OBJECT_VISUALS)].join(', ') || 'nothing';
  const sc = J.on ? (J.sceneLive ? J.sceneKey : 'plain') : S.scene ? 'custom' : 'plain';
  return `${gl ? 'WebGL' : 'Simple mode'} ${c.width}×${c.height}` + (Q.scale < 1 ? ` (${Math.round(Q.scale*100)}%, lowered for speed)` : '') + (Q.heavy && Q.world < 1 ? `, the cosmos at ${Math.round(Q.world*100)}%` : '')
    + `\n${what}; scene ${sc}` + (gl ? `\ntrails shader: ${fbInfo()}` : '');
}
let kalA = 0, kalZ = 0;   // the kaleidoscope's turn, and how far it has dived
function render(now){
  analyse(now);
  if (!padBlocked) pollPad();
  const dt = Math.min(.05, Math.max(0, (now - (render.last || now))/1000)); render.last = now;
  stepJourney(now, dt);
  const pv = J.on && J.pace !== undefined ? J.pace : 1;
  if (Math.abs(pv - PACE.v) > .001 || PACE.div !== paceDiv(pv)) {
    const d0 = PACE.div; setPace(pv); if (d0 !== PACE.div && J.on) updateSectionUI();
  }
  const mdt = dt*PACE.ts; S.MT += mdt;
  const vk = Math.min(1, .06 + .94*PACE.v);           // calm sections follow the levels more gently
  VIS.bass += (sBass - VIS.bass)*vk; VIS.mid += (sMid - VIS.mid)*vk; VIS.treb += (sTreb - VIS.treb)*vk;
  const morph = 1 - Math.pow(1 - (J.on ? .05 : .012), dt*60);   // same speed at any frame rate
  for (const s of SPEC) curP[s.k] += (S.active[s.k] - curP[s.k]) * (J.on && SNAP.has(s.k) ? 1 : morph);
  const react = +$('#react').value;
  updateSignals({bands, beat: S.beat, hit, beats: J.beats, pos: J.pos, t: now/1000, next: G.next, period: G.period, locked: G.locked,
    tension: J.tension, level: (J.fS && J.fS.lvl) || 0, type: J.type, dt, L, coming: J.anticip});
  // the shared context: the section's palette, one wind, the worlds' light
  updateContext({pal: J.on && J.type && J.type.pal ? TUNE.palettes[J.type.pal] : TUNE.palettes.triad, clock: S.MT, dt, bass: bands.bass,
    section: SIG.section, drop: J.dropGlow, worlds: WORLD_VISUALS.map(v => ({w: eff[v.key], light: v.light, motion: v.motion, focus: v.focus}))});
  applyMods(now, react);
  stepTweaks(mdt, react);   // each layer's own speed, size and sound (scene/tweaks.js)
  // every layer and object on screen dances (scene/dance.js): its move this bar, through springs
  stepDance(dt, {J, dim: reduceMotion ? .5 : 1}, LAYER_VISUALS.filter(v => eff[v.key] > .02).map(v => v.key),
    OBJECT_VISUALS.filter(v => eff[v.key] > .02).map(v => v.key), DANCE_CHARS);
  stepFX(dt, react, S.MT*1000);
  const wx = {J, react, sBass, ts: PACE.ts, tStep: S.MT*1000/1000, lvl: energyLevel(), kickAgo: now - lastBeat, track: tracks[tIndex] ? tracks[tIndex].name : ''};
  for (const v of WORLD_VISUALS) if (v.step) v.step(dt, wx);          // worlds' own animation
  J.ribPh += mdt*speedOf('ribbons')*(.4 + J.tension*1.2 + S.beat*2 + CTX.wind.s*TUNE.ctx.windRibbons); J.horScroll += mdt*speedOf('horizon')*(.4 + J.tension*1.6 + S.beat*2.5);
  if (eff.flow > .01) stepParts(mdt*speedOf('flow'), react, S.MT*1000);
  hueAcc += mdt*eff.colorSpeed;
  const hue = hueAcc + S.hueKick + (J.on ? J.hueOff : 0), t = S.MT, asp = innerWidth/innerHeight;
  // the tunnel's zoom and spin are per-frame steps, so they slow with the pace too
  // (a world's camera flying in streams the trails outwards: CTX.fly.z)
  const P = {zoom: 1 + (eff.zoom - 1)*PACE.ts + live.zoom + CTX.fly.z*TUNE.ctx.flyZoom/60, rot: eff.rot*PACE.ts + live.rot, warp: eff.warp + live.warp,
    decay: (keyHold || padHold) ? .995 : eff.decay*(1 - (J.on ? J.wipe : 0)*.3), sym: eff.sym, mirror: eff.mirror,
    hue, hueShift: eff.hueDrift*PACE.ts, bass: VIS.bass, mid: VIS.mid, treb: VIS.treb, beat: S.beat, hit: hit*PACE.punch, react,
    cx: live.cx + noise(t*1.6, 50)*eff.wander*asp*.5, cy: live.cy + noise(t*1.6, 57)*eff.wander*.5,   // (and towards a world's subject: below)
    l: {}, w: {}, o: {}, sc: resolveScene(J.on ? J.sceneLive : S.scene),   // Journey composes its own (journey/cast.js)
    frame: frameN, pal: CTX.pal, light: CTX.light, wind: CTX.wind, drift: [CTX.wind.x*mdt*TUNE.ctx.windTrails, CTX.wind.y*mdt*TUNE.ctx.windTrails]};
  P.cx += (CTX.focus.x - P.cx)*CTX.focus.k; P.cy += (CTX.focus.y - P.cy)*CTX.focus.k;   // the glow centres on the planet a world films
  // the kaleidoscope: a mirror fold of the picture round the trails' centre. Under 2 mirrors it's off; between two counts it
  // eases (the share of the next), and it turns at motion time
  kalA += mdt*(eff.kalTurn || 0);
  const km = Math.max(0, Math.min(2, Math.round(eff.kalMode || 0)));   // the kind: wedges, a mirror box, a dive
  kalZ += km === 2 ? mdt*TUNE.kal.dive*(.6 + .8*(SIG.tension || 0)) : 0;
  const kn = eff.kal || 0, kw = Math.max(0, Math.min(3, Math.round(eff.kalWhere || 0)));
  P.kal = {on: kn > 1.01, where: kw, c: [P.cx, P.cy], n: kn,
    v: [Math.max(2, Math.floor(kn)), kn >= 2 ? kn - Math.floor(kn) : 0, Math.min(1, Math.max(0, kn - 1)), kalA - Math.PI/(2*Math.max(2, Math.floor(kn)))],
    mode: km, v2: [km, TUNE.kal.hall, kalZ, TUNE.kal.band]};
  P.grain = eff.grain || 0; P.t2 = now/1000;   // the film grain (render: the finish)
  P.hush = J.on ? J.hush*TUNE.foresee.hush*(reduceMotion ? .5 : 1) : 0;   // the breath held before a drop we saw coming (journey/director.js)
  P.focus = {...CTX.focus};   // for layers that circle the subject (the orbits)
  // is any world's front (a planet, the buildings) on screen? The cosmos's planets only while it has a subject in view
  P.frontOn = ['land', 'space', 'aurora', 'city', 'sea', 'deep', 'dunes', 'forest'].some(k => eff[k] > .1) || (eff.cosmos > .1 && CTX.focus.k > .3 && SF.amt < .5) ? 1 : 0;
  P.fit = [CTX.focus.x, CTX.focus.y, P.frontOn ? Math.min(TUNE.scene.fitMax, Math.max(1, TUNE.scene.fitSpan/Math.max(CTX.focus.r, .01))) : 1];   // and can be shrunk into it
  P.kw = P.sc.driven.map(it => Math.max(0, 1 - it.drive.amt + it.drive.amt*sig(it.drive.src, react)));   // scene entries that follow a signal
  // what the visuals need from the engine this frame; each layer, world and hit adds what it draws with
  const vx = {eff, react, sBass, sTreb, dim: reduceMotion ? .5 : 1, t, dt, hit: P.hit, J, comets, shocks, parts, NP, asp};
  for (const v of LAYER_VISUALS) { P.l[v.key] = eff[v.key]; if (v.params) v.params(P, TW[v.key] ? {...vx, t: t + TW[v.key].off} : vx); }   // (a layer at its own speed: its own clock)
  for (const v of WORLD_VISUALS) {                              // world weights; the horizon's grid floor lines up with a world's ground
    P.w[v.key] = eff[v.key];
    if (v.horizonY !== undefined) P.horY += (v.horizonY - P.horY)*Math.min(1, eff[v.key]*2);
  }
  for (const v of OBJECT_VISUALS) P.o[v.key] = eff[v.key];
  for (const v of [...WORLD_VISUALS, ...HIT_VISUALS, ...OBJECT_VISUALS]) if (v.params) v.params(P, vx);
  if (!window.__noDraw) { if (gl) drawGL(S.MT*1000, P); else r2d.draw(S.MT*1000, P); }   // tests that only read Journey skip drawing

  if (++frameN % 6 === 0) {
    // (the page's styles are written only when they change: each write restyles the whole document)
    const acc = `hsl(${Math.round(((hue % 1)+1)%1*360)} 90% 65%)`;
    if (acc !== UI.acc) { UI.acc = acc; document.documentElement.style.setProperty('--accent', acc); }
    updateTimeUI();
    const cw = WORLD_VISUALS.find(v => v.caption && eff[v.key] > .3); if (cw) showCaption(cw.caption());   // what a world's camera is doing
    const mw = (J.tension*100).toFixed(0) + '%'; if (mw !== UI.meter) { UI.meter = mw; $('#jMeter').style.width = mw; }
    const gEl = $('#jGrid');
    if (gEl && $('#panel').classList.contains('open')) gEl.textContent = G.locked
      ? `Beat grid: ${(60/G.period).toFixed(1)} BPM, ${[0, 1, 2, 3].map(i => i === J.pos ? '●' : '○').join(' ')}` + (G.ev < 16 ? ', finding the 1' : G.dsure < .3 ? ', unsure of the 1' : '')
      : G.period ? `Finding the beat (about ${(60/G.period).toFixed(0)} BPM)` : 'Finding the beat';
    const ao = $('#jArcOut');   // how far through the set arc, and what it's doing
    if (ao && J.arcMins && $('#panel').classList.contains('open')) { const m = (now - J.arcStart)/60000, f = m/J.arcMins;
      ao.textContent = f >= 1 ? 'the set is over: winding down' : `${Math.floor(m)} of ${J.arcMins} min, ${f < TUNE.arc.peakAt*.8 ? 'warming up' : f < TUNE.arc.peakAt*1.1 ? 'at the peak' : 'winding down'}`; }
    const hr = $('#jHear');   // what the listening hears (audio/listen.js)
    if (hr && $('#panel').classList.contains('open')) hr.textContent = `Hearing: hi-hats ${L.hat > .45 ? 'in' : 'out'}, bass ${L.brk ? 'out (a breakdown)' : L.bass > .5 ? 'in' : 'low'}, `
      + `${L.noise > .5 ? 'noisy' : 'tonal'}, filter ${Math.round(L.cut*100)}%${L.width > .15 ? ', wide' : ''}`
      + `${L.loop >= 4 ? `, the same loop ${L.loop} bars` : ''}${L.nov > .3 ? ', something new' : ''}${L.harm > .25 ? ', the notes moved' : ''}.`
      + (J.fore && J.fore.left < 60 ? ` Read ahead: the drop in ${J.fore.bars < 16 ? Math.max(1, Math.ceil(J.fore.bars)) + ' bars' : Math.round(J.fore.left) + ' s'}${J.anticip > 0 ? ', building to it' : ''}.`
        : F.ready ? ` Read ahead: ${F.drops.length ? F.drops.length + (F.drops.length === 1 ? ' drop' : ' drops') + ' in this track' : 'no drops in this track'}.` : '');
    if ($('#panel').classList.contains('open')) refreshScene();
    if ($('#panel').classList.contains('open')) for (const k in sliders) {
      const sl = sliders[k], {out, s, input} = sl, v = eff[k].toFixed(s.step < .01 ? 3 : s.step >= 1 ? 0 : 2);
      if (!J.on) sl.lastIn = undefined;   // (by hand the slider is the user's: written again once Journey takes over)
      else if (sl.lastIn !== S.active[k]) { sl.lastIn = S.active[k]; input.value = S.active[k]; }
      if (v !== sl.lastOut) { sl.lastOut = v; out.textContent = v; }
    }
  }
}
// the shaders every scene template and scene preset will need, compiled while the page is idle (the cast doesn't change
// a scene's shape, so any stands in)
setTimeout(() => { const c = {world: 'city', lead: 'ring', accent: 'comets', centre: 'skull', label: k => k};
  warmScenes([...TEMPLATES.map(t => t.build(c)).filter(Boolean), ...BASE.filter(p => p.scene).map(p => p.scene)]); }, 1500);
// ?lab= experiments load before the first frame; without them the loop starts straight away
bindLabToggles({TUNE, J, PACE, registry});
if (LABS.length) applyLabs({TUNE, J, PACE, registry}).then(() => requestAnimationFrame(frame));
else requestAnimationFrame(frame);
