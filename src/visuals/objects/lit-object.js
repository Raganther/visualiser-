// Makes a lit object (render/lit.js) from a model baked in Blender: drawn solid under a rig of three moving lights, the
// lights themselves the show. The user asked how lifelike a Blender asset could look in the visualiser, lit from
// different angles, with shadows, zooming in and out:
// - the key light, warm, swings round it over the phrase (its shadows move with it) and changes height each bar; stabs
//   flash it white;
// - a rim light in the palette's second colour from behind the other side (thin parts glow where it passes through them);
// - a kick light from below in the palette's third colour, flaring on each pulse;
// - a drop spins the lights round it, bright, and the camera lunges in; a build pushes in slowly; a breakdown leaves the key.
// It turns slowly between three-quarter views and dances. Its look (the Lit look setting, litLook): real, toon, neon,
// chrome or marble. Its own motion(U, P, x, st) adds the rest: the goblin's snarl, the tentacle's writhing, the hand's
// grip, the heart's beat; beat(pos, st) hears each beat. Rig numbers in TUNE.lit, its own in TUNE[key].
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { hsv2rgb } from '../../util.js';
import { DANCE } from '../../scene/dance.js';
import { L } from '../../audio/listen.js';
import { litData, litGL, lit2d, litPath2d, litLod } from '../../render/lit.js';

const ELEV = [.2, .6, 1.1, .9, .35];   // the key light's heights, a new one each bar
export function litObject({key, label, words, asset: A, dance, motion, beat, bend}){
  const st = {bar: 0, hit: 0, ka: 0, el: .6, elT: .6, drop: 0, flash: 0, glow: 0, startle: 0, lastDrop: null, lastHit: 0};
  let gl1 = null, glGen = -1, lod = null, lodMesh = null;
  litData(A, bend);   // its textures start decoding now, so they're ready long before it first appears
  const lodOf = () => lod || (lod = litLod(A, bend));
  return {
    key, kind: 'object', label, words, optIn: true, noJourney: true, lit: true, dance,
    stats: `${A.t.toLocaleString()} triangles · textures from Blender · 3 lights`,
    get mesh(){ const M = lodOf(); return lodMesh || (lodMesh = {pieces: [{pos: M.pos, tri: M.tri, part: M.part, morph: M.morph}], hinge: [0, 0, 0]}); },   // (simple mode's, for the tests and the Asset Viewer)
    onBeat(pos){ if (pos === 0) { st.hit = 1; st.glow = 1; st.elT = ELEV[st.bar = (st.bar + 1) % ELEV.length]; } if (beat) beat(pos, st); },   // (no Math.random: it runs off screen too, and would shift Journey's draws)
    breakApart(){ st.startle = 1; st.flash = 1; },   // (it can't shatter: it startles, whipping round in a flash)
    params(P, x){
      const R0 = TUNE.lit, T = TUNE[key], J = x.J, dt = x.dt, w = P.o[key], ten = (J && J.tension) || 0;
      if (J && st.lastDrop !== null && J.lastDrop !== st.lastDrop) { st.drop = 1; st.flash = 1; }
      st.lastDrop = J ? J.lastDrop : null;
      if (x.hit > .8 && st.lastHit <= .8) st.flash = Math.max(st.flash, .7);
      st.lastHit = x.hit;
      for (const k of ['drop', 'flash', 'glow', 'startle']) st[k] *= Math.exp(-dt*{drop: 1/R0.dropSecs, flash: 7, glow: 2.5, startle: 3}[k]);
      // the key light swings over the phrase (faster when intense), and spins on a drop
      st.ka += dt*(R0.keySpeed*(.4 + ten) + st.drop*R0.dropSpin);
      st.el += (st.elT - st.el)*Math.min(1, dt*2);
      const brk = L.brk ? 1 : 0, calm = 1 - Math.min(1, ten*1.5);
      const a = Math.sin(st.ka)*R0.keySwing + st.drop*st.ka*.5, R = R0.lightDist;
      const hue = P.hue || 0, pal = P.pal || [0, .33, .67];
      const key0 = {p: [Math.sin(a)*R, st.el*R*.6, Math.cos(a)*R], c: [1, .88, .74].map(c => c*R0.key*(1 + st.flash*2 + st.drop))};
      const rimA = -a*.6 + Math.PI*.8, rimC = hsv2rgb(hue + pal[1], .55, 1);
      const rim = {p: [Math.sin(rimA)*R, .5, Math.cos(rimA)*R - .4], c: rimC.map(c => c*R0.rim*(1 - .6*calm*brk)*(.7 + .6*(P.bass || 0)*x.react + st.drop))};
      const kickC = hsv2rgb(hue + pal[2], .7, 1);
      const kick = {p: [-Math.sin(a)*R*.6, -R*.7, R*.8], c: kickC.map(c => c*R0.kick*(.15 + P.beat*1.2 + st.drop)*(1 - brk))};
      // the camera: a slow push in over the build, a lunge on the drop, a slow breathing in and out
      const zoom = 1 + R0.zoom*(.5 - .5*Math.cos(x.t*R0.zoomRate)) + R0.buildZoom*((J && J.anticip) || 0) + st.drop*R0.dropZoom;
      const Lt = P.light || {amt: 0}, amb = hsv2rgb(hue + (Lt.hue || 0), (Lt.sat || 0)*.6, 1).map(c => c*R0.amb*(.5 + .5*(Lt.amt || 0)));
      const An = P.anchor;
      P.m = P.m || {};
      const U = P.m[key] = {
        rot: Math.sin(x.t*T.turn)*T.turnSwing + st.startle*2.5, pitch: T.pitch + Math.sin(x.t*.23)*.04 - P.beat*.02, roll: 0,
        size: (An && An.size || T.size)*zoom, pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, .02 + P.wind.y*TUNE.ctx.windObject],
        morph: 0, w: An && An.hide ? 0 : Math.min(1, w*1.2), lights: [key0, rim, kick], amb, glow: .25 + st.glow*.8, trans: R0.trans, trail: R0.trail,
        look: Math.round((x.eff && x.eff.litLook) || 0), neon: [hsv2rgb(hue + pal[0], .8, 1), hsv2rgb(hue + pal[1], .8, 1)], t: x.t,
      };
      if (motion) motion(U, P, x, st);
      const d = DANCE.obj[key];   // its dance, on top
      if (d) { U.rot += d.yaw; U.pitch += d.pitch; U.roll = d.roll; U.pos = [U.pos[0] + d.dx, U.pos[1] + d.dy]; U.size *= d.s; U.sq = d.sq; }
      const Vw = S.view; if (Vw && Vw.key === key) { U.rot = Vw.yaw + (d ? d.yaw : 0); U.pitch += Vw.pitch; U.size *= Vw.zoom; if (Vw.morph !== null) U.morph = Vw.morph; }   // turned and held in the Asset Viewer
    },
    drawGL(gl, P, W, H, stage){ if (stage === 'trails' && !P.m[key].trail) return;
      if (!gl1 || glGen !== S.glGen) { gl1 = litGL(gl, A, bend); glGen = S.glGen; } gl1(P.m[key], W, H, stage); },
    draw2d(o, P){ lit2d(o, lodOf(), P.m[key]); },
    path2d(o, P){ litPath2d(o, lodOf(), P.m[key]); },
  };
}
