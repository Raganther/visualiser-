// Hit shapes: the star, the outline and the sparkles.
import { J, OPENING } from '../journey/core.js';

/* the star: a crisp shape that snaps in on the downbeat, then snaps or flickers out */
export const STAR = {x:0, y:0, rot:0, n:5, size:.14, age:9, out:'snap'};
export function fireStar(){
  const ty = J.on ? J.type || OPENING : OPENING, asp = innerWidth/innerHeight;
  STAR.n = ty.starN || 5; STAR.out = ty.starOut || 'snap';
  if (ty.starScatter) { STAR.x = (Math.random() - .5)*asp*.6; STAR.y = (Math.random() - .5)*.5; } else { STAR.x = 0; STAR.y = 0; }
  STAR.rot = Math.random()*Math.PI*2; STAR.size = .1 + Math.random()*.05 + (J.on ? J.tension*.06 : .03); STAR.age = 0;
}
export function starEnv(){
  const a = STAR.age;
  if (STAR.out === 'flicker') return a > 1.2 ? 0 : Math.exp(-a*3.5)*(a < .1 || Math.sin(a*55) > 0 ? 1 : .2);
  return a < .16 ? 1 : Math.exp(-(a - .16)*22);
}
/* the outline: a polygon that snaps in on the downbeat and zooms out, trailing two echoes */
export const OUTL = {age:9, n:4, rot:0};
export function fireOutline(){ const ty = J.on ? J.type || OPENING : OPENING; OUTL.n = ty.outN || 4; OUTL.rot = Math.random()*Math.PI*2; OUTL.age = 0; }
/* sparkles: small four-point glints that pop on the stabs */
export const SPARKS = Array.from({length:6}, () => ({x:0, y:0, s:.05, age:9}));
let sparkN = 0;
export function fireSparkles(){
  const asp = innerWidth/innerHeight, n = 2 + Math.floor(Math.random()*3);
  for (let i = 0; i < n; i++) { const sp = SPARKS[sparkN++ % 6];
    sp.x = (Math.random() - .5)*asp*.85; sp.y = (Math.random() - .5)*.8; sp.s = .04 + Math.random()*.05; sp.age = 0; }
}
