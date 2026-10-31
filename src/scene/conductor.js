// The conductor (docs/space-plan.md, the bench's step 3): one hand moving the centrepiece, the light rig and the 3D lasers
// together, in time with the music and by the genome's genes (scene/genome.js): its symmetry n sets the notch the object turns
// by (1/n of a turn), its motion genes (mo) how often (every few beats), which way, and how the lights go with it (in unison,
// against it, or one after another); its colour lights the rig; its motif picks the lasers' show. The music shapes it: the
// kick flashes the rim light and the lasers, stabs swing the key, the hats glint the fill; a build draws the lights in and
// narrows the lasers; a breakdown leaves the key alone, drifting, and one laser; the drop swings the lights behind it,
// bursts the lasers into a star from it and sends the object in towards you. Each frame from main.js before the space is
// laid out (spaceBegin); the objects take its turn in place of their own (condTurn), the rig its lights, the lasers their
// show (scene/lasers3d.js reads COND.las).
import { TUNE } from '../tuning.js';
import { GEN } from './genome.js';
import { SIG } from './signals.js';
import { SPACE } from './space.js';
import { hsv2rgb } from '../util.js';

export const COND = {on: 0, key: null, yaw: 0, yawT: 0, pitch: 0, s: 1, beats: 0, bars: 0, lit: 0, drop: 0, brk: 0, build: 0, kick: 0, stab: 0, hat: 0,
  las: {show: 0, n: 6, phase: 0, sweep: .25, bright: 1, burst: 0, one: 0, narrow: 0}};
const C = COND;
let lastPhase = 0, lastBeat = 0, quiet = 0, lastStab = 0, phiT = 0;
const phi = [0, 0, 0], due = [];   // each light's own turn, and the turns waiting for their beat (one after another: a beat apart)
// the genome's genes, or a plain 6-fold if it's off
const genes = () => GEN.on ? {n: Math.max(3, Math.min(12, GEN.n)), mo: GEN.mo || {every: 4, dir: 1, lights: 0}, hue: GEN.hue, motif: GEN.motif} : {n: 6, mo: {every: 4, dir: 1, lights: 0}, hue: .58, motif: 0};
// x: {dt, t, J (Journey's state: tension, its run-up), hat, hit (stabs)}
export function condFrame(x){
  C.key = SPACE.key; if (!C.on || !C.key) return;
  const T = TUNE.conductor, dt = x.dt, g = genes(), J = x.J || {};
  // the beat: a new beat each time the beat ramp wraps (the bar's 1 when the bar ramp wraps)
  const beat = SIG.beatPhase < lastPhase - .5; lastPhase = SIG.beatPhase;
  if (SIG.barPhase < lastBeat - .5) C.bars++; lastBeat = SIG.barPhase;
  // the groove: a kick lifts it, beats without one let it fall; a breakdown after bars without, the drop when it comes back
  if (SIG.kick > .95) { if (quiet >= T.brkBeats) { C.drop = 1; C.brk = 0; } quiet = 0; }
  if (beat) { C.beats++; if (SIG.kick < .5) quiet++; if (quiet >= T.brkBeats) C.brk = Math.min(1, C.brk + .25); }
  C.drop *= Math.exp(-dt/T.dropSecs);
  // a build: the tension rising (Journey's run-up when it knows one), or the snare and hats filling in before the kick returns
  C.build += ((Math.max(J.anticip || 0, SIG.coming || 0, (J.tension || 0) > .8 ? .4 : 0) ) - C.build)*Math.min(1, dt*1.5);
  C.kick = Math.max(C.kick*Math.exp(-dt/.12), SIG.kick > .95 ? 1 : 0);
  if (x.hit > .8 && lastStab <= .8) { C.stab = 1; phiT += (Math.random() < .5 ? -1 : 1)*T.stabSwing; } lastStab = x.hit; C.stab *= Math.exp(-dt/.4);
  C.hat = Math.max(C.hat*Math.exp(-dt/.1), x.hat || 0);
  // the object: a notch of 1/n of a turn every few beats (the genome's), eased; the lights with it, against it, or in turn
  if (beat && C.beats % g.mo.every === 0 && !(C.brk > .5)) { const d = g.mo.dir*Math.PI*2/g.n; C.yawT += d;
    for (let i = 0; i < 3; i++) due.push({at: C.beats + (g.mo.lights === 2 ? i : 0), i, d: g.mo.lights === 1 ? -d : d}); }
  if (beat) for (let j = due.length - 1; j >= 0; j--) if (due[j].at <= C.beats) { phi[due[j].i] += due[j].d; due.splice(j, 1); }
  C.yaw += (C.yawT - C.yaw)*Math.min(1, dt*T.ease);
  C.pitch += ((C.drop > .3 ? -T.reach : 0) - C.pitch)*Math.min(1, dt*3);
  C.s += ((1 + T.dropIn*C.drop + T.kickSwell*C.kick) - C.s)*Math.min(1, dt*8);
  // the rig: the key in front to one side, the rim behind, the fill low on the other side, each turned by its own phi; a
  // build draws them in and up; the drop swings the key and the fill round behind it, either side of the rim
  const R = SPACE.rig.lights, base = [-.7, Math.PI*.9, 1.2], els = [.4, .3, -.25], back = [Math.PI - .7, Math.PI, Math.PI + .7];
  R.forEach((l, i) => {
    let a = base[i] + phi[i] + (i === 0 ? phiT : 0) + T.drift*Math.sin(x.t*.11 + i*2);
    a += (back[i] + phi[i] - a)*Math.min(1, C.drop*1.5);
    l.az += (a - l.az)*Math.min(1, dt*T.lightEase);
    l.el += ((els[i] + C.build*T.buildUp) - l.el)*Math.min(1, dt*T.lightEase);
    l.dist = 3 - C.build*T.buildIn;
    l.on = C.brk > .5 ? (i === 0 ? 1 : 0) : 1;
    l.c = hsv2rgb(g.hue + [.08, 0, .5][i], [.25, .7, .45][i], 1);
    l.k = [T.key, T.rim, T.fill][i]*(1 + [C.stab*T.stabFlash, C.kick*T.kickFlash, C.hat*T.hatGlint][i])*(1 + C.drop*.6);
  });
  // the lasers: the genome's motif picks the show, its symmetry their number; they turn with the lights, sweep across the
  // object (wider as it builds), flash on the kick; one in a breakdown; a star bursting out of it on the drop
  const L = C.las;
  L.show = C.drop > .4 ? 3 : g.motif; L.n = C.brk > .5 ? 1 : Math.max(3, Math.min(8, g.n));
  L.phase += ((phi[0]*.5) - L.phase)*Math.min(1, dt*T.lightEase);
  L.sweep = T.sweep*(1 - .6*C.build); L.narrow = C.build; L.bright = (T.laser + C.kick*T.kickFlash*.8)*(1 + C.drop); L.burst = C.drop; L.one = C.brk;
}
// an object's turn while the conductor holds it: {yaw, pitch, s}, or null (its own turn then)
export const condTurn = key => C.on && C.key === key ? C : null;
// in words, for the bench
export function condWords(){
  const g = genes();
  return `${g.n}-fold: a ${Math.round(360/g.n)}° turn every ${g.mo.every} beats, ${g.mo.dir > 0 ? 'clockwise' : 'anticlockwise'}, the lights ${['in unison', 'against it', 'one after another'][g.mo.lights]}`;
}
