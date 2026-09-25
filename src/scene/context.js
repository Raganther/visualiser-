// The shared context every visual reads, so they feel like one piece rather than separate effects:
//   a palette (three hues, as offsets from the running hue) that every layer, hit and object takes its colours from;
//   one wind that pushes the comets, the flow, the ribbons, the objects and the trails' drift the same way;
//   one light, from whichever world is on screen, falling on the objects.
// A leaf module: main.js updates it once a frame (updateContext); visuals read CTX, or the fields it puts in P.
import { TUNE } from '../tuning.js';

export const CTX = {pal: [0, .33, .67], palName: 'triad', wind: {x: 0, y: 0, s: 0, a: 0}, light: {hue: 0, sat: 0, amt: 0, x: -.4, y: .6}, gust: 0};
const cur = [0, .33, .67];
// x: pal (the target offsets), clock (Journey's clock), dt, bass (0..1 band), section (the section-change swell),
// drop (the drop glow), worlds [{w, light}] (each world's weight and its light, or null)
export function updateContext(x){
  const T = TUNE.ctx, k = Math.min(1, x.dt/T.palSecs);
  for (let i = 0; i < 3; i++) { let d = x.pal[i] - cur[i]; d -= Math.round(d); cur[i] += d*k; CTX.pal[i] = cur[i]; }   // the short way round
  // the wind: a slowly turning direction, blowing harder on bass swells, section changes and drops
  const W = CTX.wind;
  W.a = x.clock*T.windTurn + Math.sin(x.clock*.13)*1.3;
  CTX.gust = Math.max(CTX.gust*Math.exp(-x.dt/T.gustSecs), x.section, x.drop);
  const s = T.windBase + x.bass*T.windBass + CTX.gust*T.windGust;
  W.s += (s - W.s)*Math.min(1, x.dt*2);
  W.x = Math.cos(W.a)*W.s; W.y = Math.sin(W.a)*W.s*.6;   // mostly sideways, like weather
  // the light: the worlds' lights, by weight
  const L = CTX.light; let tw = 0, h = 0, sat = 0, lx = 0, ly = 0, hx = 0, hy = 0;
  for (const {w, light} of x.worlds) if (light && w > .01) {
    tw += w; sat += light.sat*w; lx += light.x*w; ly += light.y*w;
    hx += Math.cos(light.hue*Math.PI*2)*w; hy += Math.sin(light.hue*Math.PI*2)*w;
  }
  const amt = Math.min(1, tw)*T.light;
  L.amt += (amt - L.amt)*Math.min(1, x.dt*1.5);
  if (tw > .01) { h = Math.atan2(hy, hx)/(Math.PI*2); L.hue = h; L.sat = sat/tw; L.x = lx/tw; L.y = ly/tw; }
}
