// Makes a mesh object visual (the wire skull, the unicorn, the maths shapes) from a mesh: glass panes with glowing edges,
// drawn by render/mesh.js. Every one turns at the section's pace (and shows its far side faintly through itself), swings
// its hinged piece on the pulse (the skull's jaw, the unicorn's head), sends a band of light down itself on each downbeat,
// flashes a scatter of panes on stabs as its parts change colour, and shatters on drops and big changes, pulling itself back
// together. It assembles out of flying panes as it arrives, and its panes wink out as it leaves.
// Look and motion come from TUNE.mesh; TUNE[key] gives its size, hinge swing and Journey chance.
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { meshDraw2d, meshGL, meshPath2d, meshPick, panesOf } from '../../render/mesh.js';
import { DANCE } from '../../scene/dance.js';
import { makeFx } from '../../scene/facets.js';
import { hsv2rgb } from '../../util.js';

// motion(U, P, x), if given, changes the frame's settings U after they're made: its own way of moving (the manta's flight).
// dance: its character as a dancer (scene/dance.js): {moves: {move: weight}, sym (its snap turns: a full turn over sym), liftPart}
export function meshObject({key, label, words, mesh, motion, dance}){
  let drawGL = null, glGen = -1, panes2d = null;
  const fx = makeFx(key.length*7.3 + key.charCodeAt(0));   // its panes' facet light, each part of the music its pattern
  const st = {ex: 0, exT: 0, glow: 0, hue: 0, lastHit: 0, seen: false, jOn: false, bars: 0, sw: 1, spark: 0, sparkSeed: 0, off: true};
  return {
    key, kind: 'object', label, words, optIn: true, mesh, dance,   // (the mesh, so its vertex data can be worked out while the page is idle)
    onBeat(pos){
      fx.beat(pos);
      if (pos !== 0) return;
      st.glow = 1; st.sw = 0;                           // the edges flare and a band of light starts down it
      if (!st.jOn && ++st.bars % 16 === 0) st.exT = 1;   // by hand (no Journey), it shatters every 16 bars
    },
    breakApart(){ st.exT = 1; },                        // for tests and labs
    // played by hand (the play lab): a part touched lifts off, nods it and flares; dragged, it turns with the pointer
    pick(P, W, H, x, y){ if (!panes2d) panes2d = panesOf(mesh); const U = P.m && P.m[key]; return U ? meshPick(panes2d, mesh.hinge, U, W, H, x, y) : null; },
    poke(part, amt = 1){ st.poke = amt; st.pokePart = part; st.glow = 1; st.spark = 1; st.sparkSeed = Math.random(); },
    turn(dy, dp){ st.yaw = (st.yaw || 0) + dy; st.tilt = Math.max(-.8, Math.min(.8, (st.tilt || 0) + dp)); st.held = true; },
    letGo(){ st.held = false; },
    params(P, x){
      const M = TUNE.mesh, T = TUNE[key], J = x.J, dt = x.dt, w = P.o[key];
      // shatter on a drop (the rest of the time it dances: scene/dance.js); the target snaps out then drifts back to whole
      const trigger = st.seen && J.lastDrop !== st.lastDrop;
      if (trigger && J.on) st.exT = 1;
      st.seen = true; st.jOn = J.on;
      st.lastDrop = J.lastDrop; st.lastType = J.type; st.lastStep = J.progStep;
      if (w < .01) st.off = true; else if (st.off) { st.off = false; st.ex = st.exT = 1; }   // arriving: it assembles out of flying panes
      st.exT *= Math.exp(-dt/M.explodeSecs);
      st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
      if (x.hit > .8 && st.lastHit <= .8) { st.hue += .17; st.spark = 1; st.sparkSeed = Math.random(); }   // stabs: new colours, a scatter of flashes
      st.lastHit = x.hit;
      st.glow *= Math.exp(-dt*3); st.spark *= Math.exp(-dt*5);
      st.sing = (st.sing || 0) + (Math.min(1, P.mid*x.react*1.4) - (st.sing || 0))*Math.min(1, dt*14);   // the jaw sings with the mids
      st.sw = Math.min(1, st.sw + dt/Math.max(.25, S.beatPeriod));   // the band takes one beat to run down
      P.m = P.m || {};
      const An = P.anchor;   // a world can hold it somewhere in its space (the cosmos's monument): there, at that size
      P.m[key] = {
        rot: x.t*M.spin*(1 - .6*TUNE.dance.amount), pitch: Math.sin(x.t*.23)*.15 - P.beat*.05, size: (An && An.size || T.size)*(1 + x.sBass*x.react*.03),
        pos: An && An.pos ? An.pos : [P.wind.x*TUNE.ctx.windObject, .02 + P.wind.y*TUNE.ctx.windObject],   // it sways in the wind
        pal: P.pal, light: P.light,
        jaw: Math.max(P.beat*.45, st.sing)*T.hinge, ex: st.ex*st.ex*M.explode,   // squared: flies out fast, snaps home cleanly
        gone: An && An.hide ? 1 : Math.max(0, 1 - w/.6),   // leaving: panes wink out, the weight takes the rest (or behind the camera)
        fill: M.fill*(.6 + P.beat*.8), dark: M.dark, xray: M.xray, line: M.line, hue: P.hue, partHue: st.hue,
        sweep: st.sw, sweepAmt: st.sw < 1 ? 1 : 0, spark: st.spark*x.dim, sparkSeed: st.sparkSeed, glow: st.glow*x.dim,
        trail: M.trail, w: Math.min(1, w*1.2), style: Math.round((x.eff && x.eff.objStyle) || 0),
      };
      if (w > .003 && TUNE.mesh.fx.amount > 0) { fx.step(x); const h = P.hue + st.hue, pal = P.pal || [0, .33, .67];
        P.m[key].fx = fx.U; P.m[key].fxC = [hsv2rgb(h + pal[0], .75, 1), hsv2rgb(h + pal[1], .8, 1), hsv2rgb(h + pal[2], .25, 1)].map(c => c.map(v => v*x.dim)); }
      if (motion) motion(P.m[key], P, x);
      const U = P.m[key], d = DANCE.obj[key];   // its dance, on top: a turn, a nod, a lean, a step, a lunge, a squash, a part lifting
      if (d) { U.rot += d.yaw; U.pitch += d.pitch; U.roll = d.roll; U.pos = [U.pos[0] + d.dx, U.pos[1] + d.dy]; U.size *= d.s; U.sq = d.sq; U.lift = d.lift; U.liftPart = d.part; }
      if (st.poke > .005 || st.yaw || st.tilt) {   // (played by hand: src/play/)
        st.poke = (st.poke || 0)*Math.exp(-dt*3.5); if (!st.held) { st.yaw = (st.yaw || 0)*Math.exp(-dt*1.2); st.tilt = (st.tilt || 0)*Math.exp(-dt*2); }
        U.rot += st.yaw || 0; U.pitch += (st.tilt || 0) + (st.poke || 0)*.12; if (st.poke > .01) { U.lift = Math.max(U.lift || 0, st.poke*.8); U.liftPart = st.pokePart; }
        if (st.pokePart === 4) U.jaw += (st.poke || 0)*.5; }
      const Vw = S.view; if (Vw && Vw.key === key) { U.rot = Vw.yaw + (d ? d.yaw : 0); U.pitch += Vw.pitch; U.size *= Vw.zoom; if (Vw.morph !== null) U.morph = Vw.morph; }   // turned and held in the Asset Viewer (ui/assets.js)
    },
    // WebGL: into the trails (edges only, so it leaves glowing ghosts), then crisp on top of the finished picture
    drawGL(gl, P, W, H, stage){ if (stage === 'trails' && !P.m[key].trail) return;   // (no ghosts: TUNE.mesh.trail 0)
      if (!drawGL || glGen !== S.glGen) { drawGL = meshGL(gl, mesh); glGen = S.glGen; } if (drawGL) drawGL(P.m[key], W, H, stage); },   // (null: its program is still being built)
    draw2d(o, P){ if (!panes2d) panes2d = panesOf(mesh); meshDraw2d(o, panes2d, mesh.hinge, P.m[key]); },
    path2d(o, P){ if (!panes2d) panes2d = panesOf(mesh); meshPath2d(o, panes2d, mesh.hinge, P.m[key]); },   // its silhouette, for masks
  };
}
