// Makes a mesh object visual (the wire skull, the unicorn, the maths shapes) from a mesh: glass panes with glowing edges,
// drawn by render/mesh.js. Every one turns at the section's pace (and shows its far side faintly through itself), swings
// its hinged piece on the pulse (the skull's jaw, the unicorn's head), sends a band of light down itself on each downbeat,
// flashes a scatter of panes on stabs as its parts change colour, and shatters on drops and big changes, pulling itself back
// together. It assembles out of flying panes as it arrives, and its panes wink out as it leaves.
// Look and motion come from TUNE.mesh; TUNE[key] gives its size, hinge swing and Journey chance.
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { meshDraw2d, meshGL, meshPath2d, panesOf } from '../../render/mesh.js';

export function meshObject({key, label, words, mesh}){
  let drawGL = null, panes2d = null;
  const st = {ex: 0, exT: 0, glow: 0, hue: 0, lastHit: 0, seen: false, jOn: false, bars: 0, sw: 1, spark: 0, sparkSeed: 0, off: true};
  return {
    key, kind: 'object', label, words, optIn: true,
    onBeat(pos){
      if (pos !== 0) return;
      st.glow = 1; st.sw = 0;                           // the edges flare and a band of light starts down it
      if (!st.jOn && ++st.bars % 8 === 0) st.exT = 1;   // by hand (no Journey), it shatters every 8 bars
    },
    breakApart(){ st.exT = 1; },                        // for tests and labs
    params(P, x){
      const M = TUNE.mesh, T = TUNE[key], J = x.J, dt = x.dt, w = P.o[key];
      // shatter on a drop, a new section or a progression step; the target snaps out then drifts back to whole
      const trigger = st.seen && (J.lastDrop !== st.lastDrop || J.type !== st.lastType || J.progStep !== st.lastStep);
      if (trigger && J.on) st.exT = 1;
      st.seen = true; st.jOn = J.on;
      st.lastDrop = J.lastDrop; st.lastType = J.type; st.lastStep = J.progStep;
      if (w < .01) st.off = true; else if (st.off) { st.off = false; st.ex = st.exT = 1; }   // arriving: it assembles out of flying panes
      st.exT *= Math.exp(-dt/M.explodeSecs);
      st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
      if (x.hit > .8 && st.lastHit <= .8) { st.hue += .17; st.spark = 1; st.sparkSeed = Math.random(); }   // stabs: new colours, a scatter of flashes
      st.lastHit = x.hit;
      st.glow *= Math.exp(-dt*3); st.spark *= Math.exp(-dt*5);
      st.sw = Math.min(1, st.sw + dt/Math.max(.25, S.beatPeriod));   // the band takes one beat to run down
      P.m = P.m || {};
      P.m[key] = {
        rot: x.t*M.spin, pitch: Math.sin(x.t*.23)*.15 - P.beat*.05, size: T.size*(1 + x.sBass*x.react*.03),
        pos: [P.wind.x*TUNE.ctx.windObject, .02 + P.wind.y*TUNE.ctx.windObject],   // it sways in the wind
        pal: P.pal, light: P.light,
        jaw: P.beat*T.hinge, ex: st.ex*st.ex*M.explode,   // squared: flies out fast, snaps home cleanly
        gone: Math.max(0, 1 - w/.6),                     // leaving: panes wink out, the weight takes the rest
        fill: M.fill*(.6 + P.beat*.8), dark: M.dark, xray: M.xray, line: M.line, hue: P.hue, partHue: st.hue,
        sweep: st.sw, sweepAmt: st.sw < 1 ? 1 : 0, spark: st.spark*x.dim, sparkSeed: st.sparkSeed, glow: st.glow*x.dim,
        trail: M.trail, w: Math.min(1, w*1.2),
      };
    },
    // WebGL: into the trails (edges only, so it leaves glowing ghosts), then crisp on top of the finished picture
    drawGL(gl, P, W, H, stage){ if (!drawGL) drawGL = meshGL(gl, mesh); drawGL(P.m[key], W, H, stage); },
    draw2d(o, P){ if (!panes2d) panes2d = panesOf(mesh); meshDraw2d(o, panes2d, mesh.hinge, P.m[key]); },
    path2d(o, P){ if (!panes2d) panes2d = panesOf(mesh); meshPath2d(o, panes2d, mesh.hinge, P.m[key]); },   // its silhouette, for masks
  };
}
