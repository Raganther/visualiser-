// Vectorscope: the left channel against the right, drawn as a glowing figure (as on a studio's goniometer): sound in the
// middle stands as an upright line, wide sound opens into a cloud, tones trace loops. The trails join the points into lines.
import { scopeLR } from '../../state.js';

const VA = new Float32Array(128);   // for the shader: 64 points, x and y
export default {
  key: 'vectorscope', kind: 'layer', label: 'Vectorscope',
  suits: {mid:.4, noise:.2, T:-.1},   // what music it suits (features centred on 0): melodic, textured
  overWorld: -.2,   // how well it sits over a world
  paint: 1.8,   // paint order in the trails: with the lines
  accent: 'mid',   // how it fires when it's the accent
  params(P, x){
    const g = .32*(1 + x.sBass*x.react*.4);   // a little bigger with the bass
    for (let i = 0; i < 64; i++) { const l = scopeLR[i*2], r = scopeLR[i*2 + 1];
      VA[i*2] = P.cx + (l - r)*.707*g*2; VA[i*2 + 1] = P.cy + (l + r)*.707*g; }   // side across, middle up
    P.vscope = VA;
  },
  feedback: {
    uniforms: 'uniform vec2 uVs[64];',
    main: `
  {
    float m=1e9; for(int i=0;i<64;i++){ vec2 d=sp-uVs[i]; m=min(m,dot(d,d)); }
    float dd=sqrt(m);
    if(dd<0.03) col+=hsv(uHue+uPal.y+0.05,0.5,1.0)*uL_vectorscope*(smoothstep(0.006,0.0,dd)+0.25*smoothstep(0.03,0.0,dd))*(0.45+uMid*uReact*0.5);
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uVs[0]'] && P.vscope) gl.uniform2fv(u['uVs[0]'], P.vscope); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.vectorscope > .01) || !P.vscope) return;
    const V = P.vscope; c.beginPath(); for (let i = 0; i < 64; i++) { const X = sx(V[i*2]), Y = sy(V[i*2 + 1]); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }
    glowStroke(c, al => `hsla(${hsl(P.hue + P.pal[1] + .05)},50%,65%,${Math.min(1, al).toFixed(3)})`, Math.min(1, P.l.vectorscope)*(.45 + P.mid*P.react*.5), u*.6);
  },
};
