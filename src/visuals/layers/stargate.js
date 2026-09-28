// Stargate: rings of light rushing towards you out of the centre, a new one on each kick, faster in a build: the feeling of
// flying down a tunnel of the beat. Each ring is a rounded polygon, turning slowly, in the palette's hues.
const N = 8, GA = new Float32Array(N*4);   // for the shader: radius, width, hue offset, brightness
const rings = Array.from({length: N}, () => ({z: 1, h: 0}));
let next = 0;
export default {
  key: 'stargate', kind: 'layer', label: 'Stargate',
  suits: {perc:.6, T:.5, low:.2},   // what music it suits (features centred on 0): driving, kick-led
  overWorld: -.3,   // how well it sits over a world: it's a place of its own
  paint: 2.2,   // paint order in the trails: after the horizon, before the lasers
  accent: 'bar',   // how it fires when it's the accent
  onBeat(){ const r = rings[next++ % N]; r.z = 0; r.h = next % 3; },   // a new ring from the centre on every beat
  params(P, x){
    const sp = .45 + x.J.tension*.9;   // how fast they rush out (faster as the music builds)
    rings.forEach((r, i) => {
      r.z = Math.min(1, r.z + x.dt*sp*.55);
      const R = .02 + .75*Math.pow(r.z, 2.2);   // slow far off, rushing past up close
      GA[i*4] = R; GA[i*4+1] = .002 + R*.02; GA[i*4+2] = P.pal[r.h]; GA[i*4+3] = r.z >= 1 ? 0 : Math.min(1, r.z*8)*(1 - Math.pow(r.z, 3));
    });
    P.gate = GA; P.gateTurn = x.t*.15;
  },
  feedback: {
    uniforms: 'uniform vec4 uGate[8]; uniform float uGateTurn;',
    main: `
  {
    vec2 q=p; float a=atan(q.y,q.x)+uGateTurn, sides=6.0, seg=6.2831853/sides;
    float rr=length(q)*cos(mod(a,seg)-seg*0.5)/cos(seg*0.5*0.6);   // a rounded hexagon's radius in this direction
    rr=mix(length(q),rr,0.6);
    for(int i=0;i<8;i++){
      vec4 g=uGate[i]; if(g.w<0.01) continue;
      float d=abs(rr-g.x); if(d>g.y*4.0) continue;
      col+=hsv(uHue+g.z,0.7,1.0)*uL_stargate*g.w*(smoothstep(g.y,0.0,d)+0.3*smoothstep(g.y*4.0,0.0,d))*(0.5+uTreb*uReact*0.6);
    }
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uGate[0]'] && P.gate) { gl.uniform4fv(u['uGate[0]'], P.gate); gl.uniform1f(u.uGateTurn, P.gateTurn); } },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.stargate > .01) || !P.gate) return;
    const cx = sx(P.cx), cy = sy(P.cy);
    for (let i = 0; i < N; i++) { const G = P.gate, b = G[i*4+3]*Math.min(1, P.l.stargate); if (b < .01) continue;
      c.beginPath(); for (let k = 0; k <= 6; k++) { const a = k/6*Math.PI*2 - P.gateTurn, R = G[i*4]*u; k ? c.lineTo(cx + Math.cos(a)*R, cy + Math.sin(a)*R) : c.moveTo(cx + Math.cos(a)*R, cy + Math.sin(a)*R); }
      glowStroke(c, al => `hsla(${hsl(P.hue + G[i*4+2])},70%,60%,${Math.min(1, al).toFixed(3)})`, b*(.5 + P.treb*P.react*.6), u*(.5 + G[i*4]*2));
    }
  },
};
