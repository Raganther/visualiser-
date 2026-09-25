// Ribbons: three ribbons sweeping across the whole screen, waving with the melody.
import { dataArr } from '../../state.js';

export default {
  key: 'ribbons', kind: 'layer', label: 'Ribbons',
  suits: {mid:.6, perc:-.3, bright:.3},   // what music it suits (features centred on 0)
  overWorld: .3,   // how well it sits over a world
  paint: 1,   // paint order in the trails: ribbons, horizon, comets, shockwaves, flow
  accent: 'mid',   // how it fires when it's the accent
  params(P, x){ P.ribAng = x.J.on ? x.J.ribAng : 0; P.ribPh = x.J.ribPh; },
  feedback: {
    uniforms: 'uniform float uRibAng,uRibPh;',
    functions: `
// three ribbons sweeping across the whole screen
vec3 ribbons(vec2 sp){
  float ca=cos(uRibAng), sa=sin(uRibAng);
  vec2 q=vec2(ca*sp.x+sa*sp.y,-sa*sp.x+ca*sp.y);
  vec3 c=vec3(0.0);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float y=0.28*(fi-1.0)+sin(q.x*(2.0+fi*0.7)+uRibPh*(1.0+fi*0.3)+fi*2.1)*(0.08+uMid*uReact*0.25)
           +wave(fract(q.x*0.5+0.5+fi*0.13))*0.05*uReact;
    float d=abs(q.y-y);
    c+=hsv(uHue+(i==0?uPal.x:i==1?uPal.y:uPal.z),0.8,1.0)*(smoothstep(0.005+0.008*uBeat,0.0,d)+0.25*smoothstep(0.05,0.0,d));
  }
  return c;
}`,
    main: `
  if(uL_ribbons>0.003) col+=ribbons(sp+disp)*uL_ribbons*(0.35+uBeat*0.8+uMid*uReact*0.4+uHit*0.7);`,
  },
  fbUniforms(gl, u, P){ gl.uniform1f(u.uRibAng, P.ribAng); gl.uniform1f(u.uRibPh, P.ribPh); },
  trails2d(c, P, x){
    const {u, bw, bh, sx, sy, hsl, glowStroke} = x;
    if (P.l.ribbons > .01) {
      c.save(); c.translate(bw/2, bh/2); c.rotate(-P.ribAng);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        for (let j = 0; j <= 96; j++) {
          const qx = (j/96 - .5)*1.6*bw/u;
          const wv = dataArr[Math.floor((((qx*.5 + .5 + i*.13) % 1) + 1) % 1*255)]/128 - 1;
          const yv = .28*(i - 1) + Math.sin(qx*(2 + i*.7) + P.ribPh*(1 + i*.3) + i*2.1)*(.08 + P.mid*P.react*.25) + wv*.05*P.react;
          j ? c.lineTo(qx*u, -yv*u) : c.moveTo(qx*u, -yv*u);
        }
        glowStroke(c, a => `hsla(${hsl(P.hue + P.pal[i])},85%,60%,${Math.min(1, a).toFixed(3)})`, P.l.ribbons*(.5 + P.beat*.8), u);
      }
      c.restore();
    }
  },
};
