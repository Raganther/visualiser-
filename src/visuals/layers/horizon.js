// Horizon: a perspective floor rushing toward you, with the spectrum as a skyline.
import { dataArr } from '../../state.js';
import { sstep } from '../../util.js';

export default {
  key: 'horizon', kind: 'layer', label: 'Horizon',
  suits: {perc:.7, low:.4, T:.3},   // what music it suits (features centred on 0)
  overWorld: .1,   // how well it sits over a world
  accent: 'peak', altAccent: 'bar',   // how it fires when it's the accent
  params(P, x){ P.horScroll = x.J.horScroll; P.horY = x.J.on ? x.J.horY : .05; },   // worlds with ground move horY to it afterwards
  feedback: {
    uniforms: 'uniform float uHorScroll,uHorY;',
    functions: `
// a perspective floor rushing toward you, with the spectrum as a skyline
vec3 horizon(vec2 sp){
  vec3 c=vec3(0.0);
  float above=sp.y-uHorY;
  float h=spec(clamp(abs(sp.x)/(ASP*0.5),0.0,1.0)*0.8)*0.22*(0.5+uReact*0.5);
  float ds=abs(above-h);
  c+=hsv(uHue+0.1,0.7,1.0)*(smoothstep(0.006,0.0,ds)+0.3*smoothstep(0.03,0.0,ds))*step(abs(sp.x),ASP*0.5);
  float y=-above;
  if(y>0.003){
    float z=0.25/y;
    float fz=fract(z*2.0+uHorScroll);
    float sd=min(fz,1.0-fz)*0.5*y*y/0.25;
    float fx=fract(sp.x*z*4.0);
    float sx=min(fx,1.0-fx)/4.0/z;
    c+=hsv(uHue+0.8,0.75,1.0)*(smoothstep(0.004,0.0,sd)+smoothstep(0.003,0.0,sx))*smoothstep(0.0,0.25,y);
  }
  return c;
}`,
    main: `
  if(uL_horizon>0.003) col+=horizon(sp+disp)*uL_horizon*(0.4+uBeat*0.6+uHit*0.6);`,
    paint: 2,
  },
  fbUniforms(gl, u, P){ gl.uniform1f(u.uHorScroll, P.horScroll); gl.uniform1f(u.uHorY, P.horY); },
  paint2d: 4,
  trails2d(c, P, x){
    const {u, bw, bh, sx, sy, hsl, glowStroke} = x;
    if (P.l.horizon > .01) {
      const a = Math.min(1, P.l.horizon*(.5 + P.beat*.6)), hc = hsl(P.hue + .8), asp2 = bw/bh/2;
      c.lineWidth = Math.max(1, u*.003);
      const fr = ((P.horScroll % 1) + 1) % 1;
      for (let k = 0; k < 40; k++) {
        const z = .5*(k + 1 - fr), yy = .25/z; if (yy > P.horY + .5) continue;
        c.strokeStyle = `hsla(${hc},80%,60%,${(a*sstep(0, .25, yy)).toFixed(3)})`;
        c.beginPath(); c.moveTo(0, sy(P.horY - yy)); c.lineTo(bw, sy(P.horY - yy)); c.stroke();
      }
      const zb = .25/(P.horY + .5);
      c.strokeStyle = `hsla(${hc},80%,60%,${(a*.8).toFixed(3)})`;
      for (let X = -40; X <= 40; X++) { const xw = X/4;
        c.beginPath(); c.moveTo(sx(0), sy(P.horY)); c.lineTo(sx(xw/zb), sy(-.5)); c.stroke(); }
      c.beginPath();
      for (let j = 0; j <= 80; j++) {
        const xs = (j/80 - .5)*2*asp2, h = dataArr[256 + Math.floor(Math.min(1, Math.abs(xs)/asp2)*.8*255)]/255*.22*(.5 + P.react*.5);
        j ? c.lineTo(sx(xs), sy(P.horY + h)) : c.moveTo(sx(xs), sy(P.horY + h));
      }
      glowStroke(c, al => `hsla(${hsl(P.hue + .1)},75%,60%,${Math.min(1, al).toFixed(3)})`, a, u);
    }
  },
};
