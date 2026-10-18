// The subject (a leaf module): where the centrepiece stands on screen and how big, so the layers can play round it, the
// user's ask after the genome: lasers that shine at the object and catch on it, comets circling it, orbits passing behind it,
// fireflies gathering round it, its facets lighting where they touch it. main.js reads the strongest object on screen after
// the objects' params each frame (subjFrame), from what each writes to P.m (its place, U.pos, and size, U.size, in screen
// heights from the centre, y up, as the layers' own coordinates); the layers read it the next frame. It eases in and out
// with the object, so a layer slides from its own centre to the object's and back.
import { TUNE } from '../tuning.js';
export const SUBJ = {on: 0, x: 0, y: 0, r: 0, key: null, touch: 0, tx: 0, ty: 0, kick: 0};
const CAMZ = 3.2, FOCAL = 2.6;   // (render/mesh.js's camera)
// each frame, after the objects: the strongest object with a place on screen becomes the subject
export function subjFrame(P, keys, dt){
  const T = TUNE.subject; let best = null, bw = .05;
  for (const k of keys) { const U = P.m && P.m[k], w = (P.o && P.o[k]) || 0; if (U && U.pos && U.size && w > bw && (U.w ?? 1) > .05) { best = {k, U}; bw = w; } }
  const e = Math.min(1, dt*T.ease);
  if (best) {
    const r = best.U.size*FOCAL*(best.U.br || T.radius)/CAMZ;   // (its radius on screen: a mesh is about .45 across from its middle)
    if (SUBJ.on < .02) { SUBJ.x = best.U.pos[0]; SUBJ.y = best.U.pos[1]; SUBJ.r = r; }   // (arriving: no slide in from elsewhere)
    SUBJ.x += (best.U.pos[0] - SUBJ.x)*e; SUBJ.y += (best.U.pos[1] - SUBJ.y)*e; SUBJ.r += (r - SUBJ.r)*e; SUBJ.key = best.k;
  }
  SUBJ.on += ((best ? Math.min(1, bw*1.5) : 0) - SUBJ.on)*e;
  if (SUBJ.on < .01) SUBJ.key = null;
  SUBJ.touch *= Math.exp(-dt*T.touchFade);
}
// a layer touching the subject (a laser's beam, a comet passing close): its facets light from that side (scene/facets.js)
export function subjTouch(x, y, amt){ if (amt > SUBJ.touch) { SUBJ.touch = Math.min(1, amt); SUBJ.tx = x - SUBJ.x; SUBJ.ty = y - SUBJ.y; } }
