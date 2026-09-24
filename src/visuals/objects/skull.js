// Wire skull: a low-poly skull of glass panes with glowing edges (mesh from tools/skull-mesh.mjs, drawn by render/mesh.js).
// It turns at the section's pace and, being wire, shows its far side through itself. The jaw drops on the pulse, a band of
// light runs down it on each downbeat, a scatter of panes flashes on stabs, and the parts change colour. It shatters into
// flying panes on drops and big changes and pulls itself back together; it assembles out of flying panes as it arrives,
// and its panes wink out one by one as it leaves. Opt-in: Journey uses it as a centrepiece only when TUNE.skull.chance > 0.
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { meshDraw2d, meshGL, panesOf } from '../../render/mesh.js';
import SKULL from './meshes/skull.js';

const MESH = {pieces: [SKULL.skull, {...SKULL.jaw, hinge: true}], hinge: SKULL.hinge};
let drawGL = null, panes2d = null;
const st = {ex: 0, exT: 0, glow: 0, hue: 0, lastHit: 0, seen: false, jOn: false, bars: 0, sw: 1, spark: 0, sparkSeed: 0, off: true};
export default {
  key: 'skull', kind: 'object', label: 'Wire skull', optIn: true, words: 'The wire skull is the centrepiece',
  onBeat(pos){
    if (pos !== 0) return;
    st.glow = 1; st.sw = 0;                             // the edges flare and a band of light starts down the skull
    if (!st.jOn && ++st.bars % 8 === 0) st.exT = 1;     // by hand (no Journey), it shatters every 8 bars
  },
  breakApart(){ st.exT = 1; },                          // for tests and labs
  params(P, x){
    const T = TUNE.skull, J = x.J, dt = x.dt, w = P.o.skull;
    // shatter on a drop, a new section or a progression step; the target snaps out then drifts back to whole
    const trigger = st.seen && (J.lastDrop !== st.lastDrop || J.type !== st.lastType || J.progStep !== st.lastStep);
    if (trigger && J.on) st.exT = 1;
    st.seen = true; st.jOn = J.on;
    st.lastDrop = J.lastDrop; st.lastType = J.type; st.lastStep = J.progStep;
    if (w < .01) st.off = true; else if (st.off) { st.off = false; st.ex = st.exT = 1; }   // arriving: it assembles out of flying panes
    st.exT *= Math.exp(-dt/T.explodeSecs);
    st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
    if (x.hit > .8 && st.lastHit <= .8) { st.hue += .17; st.spark = 1; st.sparkSeed = Math.random(); }   // stabs: new colours, a scatter of flashes
    st.lastHit = x.hit;
    st.glow *= Math.exp(-dt*3); st.spark *= Math.exp(-dt*5);
    st.sw = Math.min(1, st.sw + dt/Math.max(.25, S.beatPeriod));   // the band takes one beat to run down
    P.sk = {
      rot: x.t*T.spin, pitch: Math.sin(x.t*.23)*.15 - P.beat*.05, size: T.size*(1 + x.sBass*x.react*.03), pos: [0, .02],
      jaw: P.beat*T.jaw, ex: st.ex*st.ex*T.explode,   // squared: flies out fast, snaps home cleanly
      gone: Math.max(0, 1 - w/.6),   // leaving: panes wink out, the weight takes the rest
      fill: T.fill*(.6 + P.beat*.8), dark: T.dark, xray: T.xray, line: T.line, hue: P.hue, partHue: st.hue,
      sweep: st.sw, sweepAmt: st.sw < 1 ? 1 : 0, spark: st.spark*x.dim, sparkSeed: st.sparkSeed, glow: st.glow*x.dim,
      trail: T.trail, w: Math.min(1, w*1.2),
    };
  },
  // WebGL: into the trails (edges only, so it leaves glowing ghosts), then crisp on top of the finished picture
  drawGL(gl, P, W, H, stage){ if (!drawGL) drawGL = meshGL(gl, MESH); drawGL(P.sk, W, H, stage); },
  draw2d(o, P){ if (!panes2d) panes2d = panesOf(MESH); meshDraw2d(o, panes2d, MESH.hinge, P.sk); },
};
