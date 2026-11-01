// Orbits: bright flares circling the world's subject (the planet the cosmos films, space's planet, or the trails' centre)
// on tilted orbits, leaving rings and spirals in the trails. They pass behind the planet, tighten and speed up as the music
// builds, and a drop flings them wide, like a slingshot, before they settle back.
import { SUBJ } from '../../scene/subject.js';
import { genFold } from '../../scene/genome.js';
import { SPACE, spaceProj, spaceScale, spaceHidden, spaceLight, spaceFront } from '../../scene/space.js';
import { hsv2rgb } from '../../util.js';
import { TUNE } from '../../tuning.js';
const N = 10, O = [];
for (let i = 0; i < N; i++) O.push({rf: 1.25 + (i % 5)*.24 + (i*.37 % 1)*.15, ph: i*2.399, tilt: .35 + (i*.61 % 1)*.5, rot: (i*.83 % 1 - .5)*.7, slot: i % 3});
let plane = 0, sling = 0, lastDrop, T = 0;
const OUT = new Float32Array(N*4);   // the flares for the shader
export default {
  key: 'orbit', kind: 'layer', label: 'Orbits',
  suits: {perc:.3, mid:.2, T:.1},   // what music it suits (features centred on 0)
  overWorld: .6,   // how well it sits over a world (best round a planet)
  paint: 3,   // paint order in the trails: with the comets
  accent: 'bar',   // how it fires when it's the accent
  params(P, x){
    const out = P.orbs = OUT.fill(0), w = P.l.orbit || 0;   // (reused each frame)
    if (w < .003) return;
    const sp = SPACE.on > .02 && SUBJ.on > .3, sub = SUBJ.on > .3, f = sub ? {x: SUBJ.x, y: SUBJ.y, r: SUBJ.r, k: 1} : P.focus || {x: 0, y: 0, r: 0, k: 0}, on = f.k > .3;   // round the centrepiece (scene/subject.js), a world's subject, or the trails' centre
    const g = genFold(3, N);   // the genome's symmetry: a crown of its count on one orbit, evenly spaced
    const cx = on ? f.x : P.cx, cy = on ? f.y : P.cy, base = on ? Math.max(.035, f.r) : .09;
    if (lastDrop === undefined) lastDrop = x.J.lastDrop;
    if (x.J.lastDrop !== lastDrop) { lastDrop = x.J.lastDrop; sling = 1; }   // a drop flings them wide
    sling *= Math.exp(-x.dt/.9);
    const tight = 1 - .3*Math.max(0, x.J.tension - .4)/.6;   // a build pulls them in, and quickens them
    T += x.dt*(.6 + .8*(1 - tight)); plane += x.dt*.05;
    O.forEach((o0, i) => {
      if (g && i >= g) { out.set([0, 0, 0, 0], i*4); return; }
      const o = g ? {rf: 1.5, ph: i*Math.PI*2/g, tilt: .55, rot: 0, slot: i % 3} : o0;
      const rr = base*o.rf*tight*(1 + 1.6*sling*(.6 + .4*(i % 3)/2)), a = o.ph + T*1.1/Math.pow(o.rf, 1.5);
      const ex = Math.cos(a), ey = Math.sin(a)*Math.cos(o.tilt), z = Math.sin(a)*Math.sin(o.tilt), pr = plane + o.rot;
      const px = cx + rr*(ex*Math.cos(pr) - ey*Math.sin(pr)), py = cy + rr*(ex*Math.sin(pr) + ey*Math.cos(pr));
      if (sp) {   // in the space round the centrepiece (scene/space.js): a light on a real orbit, hidden behind it, lighting it
        const k = spaceScale(), q = [rr*(ex*Math.cos(pr) - ey*Math.sin(pr))/k, rr*(ex*Math.sin(pr) + ey*Math.cos(pr))/k, rr*z/k], l = Math.hypot(q[0], q[1], q[2]), m = SPACE.rad*TUNE.space.skim;
        if (l < m && l > 1e-4) { q[0] *= m/l; q[1] *= m/l; q[2] *= m/l; }
        const s = spaceProj(q), so = SPACE.on, b = (.55 + .45*z)*(1 + P.beat*.8)*(1 - spaceHidden(q)), rgb = hsv2rgb(P.hue + P.pal[o.slot], .6, 1);
        out.set([px + (s[0] - px)*so, py + (s[1] - py)*so, b, o.slot], i*4);
        spaceLight(q, rgb, w*b*TUNE.space.orbit); spaceFront(q, .014, rgb, Math.min(1, w*b)*TUNE.space.front);
        return;
      }
      const hid = on && z < 0 && Math.hypot(px - cx, py - cy) < f.r*1.02;   // behind the planet
      out.set([px, py, hid ? 0 : (.55 + .45*z)*(1 + P.beat*.8), o.slot], i*4);
    });
  },
  feedback: {
    uniforms: 'uniform vec4 uOrbs[10];',
    main: `
  for(int i=0;i<10;i++){
    vec4 ob=uOrbs[i]; if(ob.z<=0.0) continue;
    float dd=length(sp-ob.xy); if(dd>=0.035) continue;   // (both edges are 0 this far out)
    col+=hsv(uHue+(ob.w<0.5?uPal.x:ob.w<1.5?uPal.y:uPal.z),0.6,1.0)*uL_orbit*ob.z*(smoothstep(0.009,0.0,dd)+0.3*smoothstep(0.035,0.0,dd));
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uOrbs[0]'] && P.orbs && P.orbs.length) gl.uniform4fv(u['uOrbs[0]'], P.orbs); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x, o = P.orbs;
    if (!(P.l.orbit > .01) || !o || !o.length) return;
    for (let i = 0; i < 10; i++) {
      const b = o[i*4 + 2]; if (b <= 0) continue;
      const X = sx(o[i*4]), Y = sy(o[i*4 + 1]), rad = u*.03, h = hsl(P.hue + P.pal[o[i*4 + 3]]), a = Math.min(1, P.l.orbit*b);
      const g = c.createRadialGradient(X, Y, 0, X, Y, rad);
      g.addColorStop(0, `hsla(${h},70%,80%,${a})`); g.addColorStop(.3, `hsla(${h},80%,60%,${a*.35})`); g.addColorStop(1, `hsla(${h},80%,55%,0)`);
      c.fillStyle = g; c.fillRect(X - rad, Y - rad, rad*2, rad*2);
    }
  },
};
