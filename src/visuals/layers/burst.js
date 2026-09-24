// Spectrum burst: the spectrum as rays from a centre that follows a comet when comets are present.
import { dataArr } from '../../state.js';

export default {
  key: 'burst', kind: 'layer', label: 'Spectrum burst',
  suits: {bright:.9, T:.5},   // what music it suits (features centred on 0)
  overWorld: -.4,   // how well it sits over a world
  accent: 'hit', altAccent: 'bar',   // how it fires when it's the accent
  params(P, x){ const pull = Math.min(1, x.eff.comets)*.7; P.bcx = P.cx + (x.comets[0].x - P.cx)*pull; P.bcy = P.cy + (x.comets[0].y - P.cy)*pull; },
  feedback: {
    folded: `
  {
    // spectrum burst radiates from its own centre (which follows a comet when comets are present)
    vec2 db=fold(pb,n);
    float rb=length(db), ab=abs(atan(db.y,db.x))/3.14159265;
    float len=0.06+spec(pow(ab,1.3))*0.55*(0.6+uReact*0.5);
    float f=fract(ab*48.0);
    float bar=smoothstep(0.15,0.3,f)*smoothstep(0.85,0.7,f);
    float gb=uL_burst*(0.6+uHit*1.4)*bar*(smoothstep(0.015,0.0,abs(rb-len))+0.08*step(rb,len)*step(0.06,rb));
    col+=hsv(uHue+rb*0.35+ab*0.15,0.85,1.0)*gb;
  }`,
  },
  fbUniforms(gl, u, P){ gl.uniform2f(u.uBurstC, P.bcx, P.bcy); },
  folded2d(c, P, x){                                   // drawn inside the kaleidoscope fold
    const {u, now, bw, col, glowStroke} = x;
    if (P.l.burst > .01) {
      c.lineWidth = u*.012;
      for (let j = 0; j < 48; j++) {
        const t = (j + .5)/48, sp = dataArr[256 + Math.floor(Math.pow(t, 1.3)*255)]/255;
        const len = u*(.06 + sp*.55*(.6 + P.react*.5));
        for (const a of [t*Math.PI, -t*Math.PI]) {
          const cs = Math.cos(a), sn = Math.sin(a);
          c.strokeStyle = col(t*.15)(.12*P.l.burst*(.6 + P.hit*1.4));
          c.beginPath(); c.moveTo(cs*u*.06, sn*u*.06); c.lineTo(cs*len, sn*len); c.stroke();
          c.fillStyle = col(t*.15)(P.l.burst*(.6 + P.hit*1.4));
          c.beginPath(); c.arc(cs*len, sn*len, u*.01, 0, Math.PI*2); c.fill();
        }
      }
    }
  },
};
