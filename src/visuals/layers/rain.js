// Rain: fine slanted streaks falling through the picture, heavier and faster with the hi-hats and the noise, blown by the
// wind, with a flash of splashes along the bottom on the kick.
import { L } from '../../audio/listen.js';

export default {
  key: 'rain', kind: 'layer', label: 'Rain',
  suits: {hat:.5, noise:.4, T:-.1},   // what music it suits (features centred on 0): hissing, textured tops
  overWorld: .7,   // how well it sits over a world: it's weather
  paint: 4.6,   // paint order in the trails: near the top
  accent: 'hit',   // how it fires when it's the accent
  params(P, x){
    this.h = (this.h || 0) + ((L.hat*.6 + L.noise*.4) - (this.h || 0))*Math.min(1, x.dt*2);
    this.fall = (this.fall || 0) + x.dt*(1.1 + this.h*1.4);
    P.rain = [this.fall, .25 + .75*this.h, (P.wind ? P.wind.x : 0)*.4 - .12];   // how far it's fallen, how heavy, its slant
  },
  feedback: {
    uniforms: 'uniform vec3 uRain;',
    main: `
  {
    vec2 q=sp; q.x-=q.y*uRain.z;                          // slanted by the wind
    vec2 g=vec2(q.x*70.0,q.y*6.0+uRain.x*6.0); vec2 ce=floor(g); float h=hash(ce);
    if(h<uRain.y*0.6){                                    // a drop in this cell (more of them the heavier it is)
      vec2 f=fract(g); float x0=0.2+0.6*hash(ce+7.0), d=abs(f.x-x0);
      float streak=smoothstep(0.08,0.0,d)*smoothstep(0.0,0.3,f.y)*smoothstep(1.0,0.6,f.y);
      col+=hsv(uHue+uPal.y+0.5,0.15,1.0)*uL_rain*streak*0.16;
    }
    float sy=sp.y+0.48; if(sy>0.0&&sy<0.03){ float sh=hash(floor(vec2(sp.x*90.0,uRain.x*4.0)));   // splashes along the bottom on the kick
      col+=vec3(0.8,0.85,0.9)*uL_rain*uBeat*step(0.75,sh)*smoothstep(0.03,0.0,sy)*0.4; }
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uRain && P.rain) gl.uniform3fv(u.uRain, P.rain); },
  trails2d(c, P, x){
    const {u, bw, bh, sy} = x;
    if (!(P.l.rain > .01) || !P.rain) return;
    const [fall, heavy, slant] = P.rain, n = Math.floor(160*heavy), a = Math.min(1, P.l.rain);
    const r = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
    c.strokeStyle = `rgba(200,215,230,${(.22*a).toFixed(3)})`; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < n; i++) { const r1 = r(i), r2 = r(i + 500);
      const X = ((r1 + fall*.05) % 1)*bw, Y = ((r2 + fall*.9*(.8 + r1*.4)) % 1)*bh, len = .04*u;
      c.moveTo(X, Y); c.lineTo(X - slant*len, Y + len); }
    c.stroke();
    if (P.beat > .3) { c.fillStyle = `rgba(210,220,235,${(.4*a*P.beat).toFixed(3)})`; for (let i = 0; i < 30; i++) c.fillRect(r(i*3 + Math.floor(fall*4))*bw, sy(-.48) - 2, 3, 2); }
  },
};
