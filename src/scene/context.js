// The shared context every visual reads, so they feel like one piece rather than separate effects:
//   a palette (three hues, as offsets from the running hue) that every layer, hit and object takes its colours from;
//   one wind that pushes the comets, the flow, the ribbons, the objects and the trails' drift the same way;
//   one light, from whichever world is on screen, falling on the objects;
//   one focus: where a world's subject is on screen (a planet the camera films), which the trails centre on.
// A leaf module: main.js updates it once a frame (updateContext); visuals read CTX, or the fields it puts in P.
import { TUNE } from '../tuning.js';

export const CTX = {pal: [0, .33, .67], palName: 'triad', wind: {x: 0, y: 0, s: 0, a: 0}, light: {hue: 0, sat: 0, amt: 0, x: -.4, y: .6}, gust: 0,
  fly: {x: 0, y: 0, z: 0}, focus: {x: 0, y: 0, r: .3, k: 0}};   // fly: a moving world's camera (how the view slides, screens a second; how fast it closes in)
const cur = [0, .33, .67];
// x: pal (the target offsets), clock (Journey's clock), dt, bass (0..1 band), section (the section-change swell),
// drop (the drop glow), worlds [{w, light, motion, focus}] (each world's weight, its light, its camera's movement and its
// subject on screen ({x, y, r}: where, and its radius, in the display's units), or null)
export function updateContext(x){
  const T = TUNE.ctx, k = Math.min(1, x.dt/T.palSecs);
  for (let i = 0; i < 3; i++) { let d = x.pal[i] - cur[i]; d -= Math.round(d); cur[i] += d*k; CTX.pal[i] = cur[i]; }   // the short way round
  // the wind: a slowly turning direction, blowing harder on bass swells, section changes and drops
  const W = CTX.wind;
  W.a = x.clock*T.windTurn + Math.sin(x.clock*.13)*1.3;
  CTX.gust = Math.max(CTX.gust*Math.exp(-x.dt/T.gustSecs), x.section, x.drop);
  const s = T.windBase + x.bass*T.windBass + CTX.gust*T.windGust;
  W.s += (s - W.s)*Math.min(1, x.dt*2);
  // a world with a moving camera adds its movement, so everything drifts the way the view does
  const F = CTX.fly; F.x = F.y = F.z = 0;
  for (const {w, motion} of x.worlds) if (motion && w > .01) { const k = Math.min(1, w); F.x += motion.x*k; F.y += motion.y*k; F.z += motion.z*k; }
  W.x = Math.cos(W.a)*W.s + F.x*T.flyWind; W.y = Math.sin(W.a)*W.s*.6 + F.y*T.flyWind;   // mostly sideways, like weather
  // the light: the worlds' lights, by weight
  const L = CTX.light; let tw = 0, h = 0, sat = 0, lx = 0, ly = 0, hx = 0, hy = 0;
  for (const {w, light} of x.worlds) if (light && w > .01) {
    tw += w; sat += light.sat*w; lx += light.x*w; ly += light.y*w;
    hx += Math.cos(light.hue*Math.PI*2)*w; hy += Math.sin(light.hue*Math.PI*2)*w;
  }
  const amt = Math.min(1, tw)*T.light;
  L.amt += (amt - L.amt)*Math.min(1, x.dt*1.5);
  if (tw > .01) { h = Math.atan2(hy, hx)/(Math.PI*2); L.hue = h; L.sat = sat/tw; L.x = lx/tw; L.y = ly/tw; }
  // the focus: the trails centre on a world's subject, easing across as the camera moves or the subject changes
  const Fo = CTX.focus, fw = x.worlds.find(o => o.focus && o.w > .3), e = Math.min(1, x.dt*T.focusEase);
  Fo.k += ((fw ? Math.min(1, fw.w)*T.focus : 0) - Fo.k)*e;
  if (fw) { Fo.x += (fw.focus.x - Fo.x)*e; Fo.y += (fw.focus.y - Fo.y)*e; Fo.r += ((fw.focus.r || .3) - Fo.r)*e; }
}
