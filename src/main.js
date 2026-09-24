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
import './ui/transport.js';
import { S } from './state.js';
import { analyse, hit, sBass, sMid, sTreb } from './audio/analysis.js';
import { G } from './audio/beatgrid.js';
import { comets, shocks, stepFX } from './fx/effects.js';
import { applyMods } from './fx/movers.js';
import { NP, parts, seedParticles, stepParts } from './fx/particles.js';
import { J, SNAP } from './journey/core.js';
import { stepJourney } from './journey/director.js';
import { PACE, setPace } from './journey/pace.js';
import { SPEC, curP, eff } from './presets.js';
import { drawGL, gl, initRenderer, r2d } from './render/gl.js';
import { keyHold, live, padBlocked, padHold, pollPad } from './ui/controls.js';
import { sliders, updateSectionUI } from './ui/panel.js';
import { updateTimeUI } from './ui/transport.js';
import { $, noise, reduceMotion } from './util.js';
import { HIT_VISUALS, LAYER_VISUALS, WORLD_VISUALS } from './visuals/registry.js';

initRenderer();
seedParticles();
J.clock = Math.random()*100;
/* ---------- render loop ---------- */
let frameN = 0, hueAcc = 0;
const VIS = {bass:0, mid:0, treb:0};
function frame(now){
  requestAnimationFrame(frame);
  try { render(now); } catch(e) { if (!frame.err) { frame.err = 1; showErr(e.message); } }
}
function render(now){
  analyse(now);
  if (!padBlocked) pollPad();
  const dt = Math.min(.05, Math.max(0, (now - (render.last || now))/1000)); render.last = now;
  stepJourney(now, dt);
  const pv = J.on && J.pace !== undefined ? J.pace : 1;
  if (Math.abs(pv - PACE.v) > .001 || PACE.div !== (pv < .3 ? 4 : pv < .6 ? 2 : 1)) {
    const d0 = PACE.div; setPace(pv); if (d0 !== PACE.div && J.on) updateSectionUI();
  }
  const mdt = dt*PACE.ts; S.MT += mdt;
  const vk = Math.min(1, .06 + .94*PACE.v);           // calm sections follow the levels more gently
  VIS.bass += (sBass - VIS.bass)*vk; VIS.mid += (sMid - VIS.mid)*vk; VIS.treb += (sTreb - VIS.treb)*vk;
  const morph = 1 - Math.pow(1 - (J.on ? .05 : .012), dt*60);   // same speed at any frame rate
  for (const s of SPEC) curP[s.k] += (S.active[s.k] - curP[s.k]) * (J.on && SNAP.has(s.k) ? 1 : morph);
  const react = +$('#react').value;
  applyMods(now, react);
  stepFX(dt, react, S.MT*1000);
  const wx = {J, react, sBass, ts: PACE.ts, tStep: S.MT*1000/1000};
  for (const v of WORLD_VISUALS) if (v.step) v.step(dt, wx);          // worlds' own animation
  J.ribPh += mdt*(.4 + J.tension*1.2 + S.beat*2); J.horScroll += mdt*(.4 + J.tension*1.6 + S.beat*2.5);
  if (eff.flow > .01) stepParts(mdt, react, S.MT*1000);
  hueAcc += mdt*eff.colorSpeed;
  const hue = hueAcc + S.hueKick + (J.on ? J.hueOff : 0), t = S.MT, asp = innerWidth/innerHeight;
  // the tunnel's zoom and spin are per-frame steps, so they slow with the pace too
  const P = {zoom: 1 + (eff.zoom - 1)*PACE.ts + live.zoom, rot: eff.rot*PACE.ts + live.rot, warp: eff.warp + live.warp,
    decay: (keyHold || padHold) ? .995 : eff.decay*(1 - (J.on ? J.wipe : 0)*.3), sym: eff.sym, mirror: eff.mirror,
    hue, hueShift: eff.hueDrift*PACE.ts, bass: VIS.bass, mid: VIS.mid, treb: VIS.treb, beat: S.beat, hit: hit*PACE.punch, react,
    cx: live.cx + noise(t*1.6, 50)*eff.wander*asp*.5, cy: live.cy + noise(t*1.6, 57)*eff.wander*.5,
    l: {}, w: {}};
  // what the visuals need from the engine this frame; each layer, world and hit adds what it draws with
  const vx = {eff, react, sBass, sTreb, dim: reduceMotion ? .5 : 1, t, J, comets, shocks, parts, NP};
  for (const v of LAYER_VISUALS) { P.l[v.key] = eff[v.key]; if (v.params) v.params(P, vx); }
  for (const v of WORLD_VISUALS) {                              // world weights; the horizon's grid floor lines up with a world's ground
    P.w[v.key] = eff[v.key];
    if (v.horizonY !== undefined) P.horY += (v.horizonY - P.horY)*Math.min(1, eff[v.key]*2);
  }
  for (const v of [...WORLD_VISUALS, ...HIT_VISUALS]) if (v.params) v.params(P, vx);
  if (gl) drawGL(S.MT*1000, P); else r2d.draw(S.MT*1000, P);

  if (++frameN % 6 === 0) {
    document.documentElement.style.setProperty('--accent', `hsl(${((hue % 1)+1)%1*360} 90% 65%)`);
    updateTimeUI();
    $('#jMeter').style.width = (J.tension*100).toFixed(0) + '%';
    const gEl = $('#jGrid');
    if (gEl && $('#panel').classList.contains('open')) gEl.textContent = G.locked
      ? `Beat grid: ${(60/G.period).toFixed(1)} BPM, ${[0, 1, 2, 3].map(i => i === J.pos ? '●' : '○').join(' ')}` + (G.ev < 16 ? ', finding the 1' : G.dsure < .3 ? ', unsure of the 1' : '')
      : G.period ? `Finding the beat (about ${(60/G.period).toFixed(0)} BPM)` : 'Finding the beat';
    if ($('#panel').classList.contains('open')) for (const k in sliders) {
      const {out, s, input} = sliders[k]; if (J.on) input.value = S.active[k]; out.textContent = eff[k].toFixed(s.step < .01 ? 3 : s.step >= 1 ? 0 : 2);
    }
  }
}
requestAnimationFrame(frame);
