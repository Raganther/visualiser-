// Fireflies: soft out-of-focus lights drifting on the wind, each blinking in its own time, brighter and livelier with the
// hi-hats. Bokeh for the calm parts: they give atmosphere without taking the eye.
import { L } from '../../audio/listen.js';

const N = 20, FA = new Float32Array(N*4);   // for the shader: x, y, size, brightness
const rnd = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
const flies = Array.from({length: N}, (_, i) => ({x: rnd(i) - .5, y: rnd(i + 40) - .5, s: .012 + rnd(i + 80)*.03, ph: rnd(i + 120)*6.28, v: .5 + rnd(i + 160)}));
export default {
  key: 'fireflies', kind: 'layer', label: 'Fireflies',
  suits: {perc:-.4, T:-.4, hat:.3},   // what music it suits (features centred on 0): calm, airy, some top end
  overWorld: .6,   // how well it sits over a world: well, they belong in a place
  paint: 4.5,   // paint order in the trails: after the comets and shockwaves, before the flow
  accent: 'hit',   // how it fires when it's the accent
  params(P, x){
    const h = L.hat, wx = P.wind ? P.wind.x : 0, wy = P.wind ? P.wind.y : 0;
    flies.forEach((f, i) => {
      f.x += (Math.sin(x.t*.4*f.v + f.ph)*.02 + wx*.15)*x.dt; f.y += (Math.cos(x.t*.33*f.v + f.ph*1.3)*.015 + wy*.15)*x.dt;
      const hw = x.asp/2 + .05; if (f.x > hw) f.x = -hw; if (f.x < -hw) f.x = hw; if (f.y > .55) f.y = -.55; if (f.y < -.55) f.y = .55;
      const blink = Math.pow(.5 + .5*Math.sin(x.t*(1.1 + f.v*.8)*(1 + h) + f.ph*3), 3);
      FA[i*4] = f.x; FA[i*4+1] = f.y; FA[i*4+2] = f.s; FA[i*4+3] = blink*(.35 + .65*h + P.beat*.2);
    });
    P.flies = FA;
  },
  feedback: {
    uniforms: 'uniform vec4 uFlies[20];',
    main: `
  for(int i=0;i<20;i++){
    vec4 f=uFlies[i]; if(f.w<0.02) continue;
    float d=length(sp-f.xy); if(d>f.z*1.3) continue;   // (nothing this far out)
    float disc=smoothstep(f.z,f.z*0.8,d), rim=exp(-pow((d-f.z*0.88)/(f.z*0.1),2.0));   // an out-of-focus disc, brighter at its rim
    col+=hsv(uHue+(mod(float(i),3.0)<1.0?uPal.x:mod(float(i),3.0)<2.0?uPal.y:uPal.z)+0.1,0.45,1.0)*uL_fireflies*f.w*(disc*0.22+rim*0.25);
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uFlies[0]'] && P.flies) gl.uniform4fv(u['uFlies[0]'], P.flies); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x;
    if (!(P.l.fireflies > .01) || !P.flies) return;
    for (let i = 0; i < N; i++) { const F = P.flies, b = F[i*4+3]*Math.min(1, P.l.fireflies); if (b < .02) continue;
      const X = sx(F[i*4]), Y = sy(F[i*4+1]), r = F[i*4+2]*u, h = hsl(P.hue + P.pal[i % 3] + .1);
      const g = c.createRadialGradient(X, Y, r*.5, X, Y, r);
      g.addColorStop(0, `hsla(${h},45%,65%,${(.2*b).toFixed(3)})`); g.addColorStop(.85, `hsla(${h},45%,75%,${(.35*b).toFixed(3)})`); g.addColorStop(1, `hsla(${h},45%,70%,0)`);
      c.fillStyle = g; c.beginPath(); c.arc(X, Y, r, 0, Math.PI*2); c.fill();
    }
  },
};
