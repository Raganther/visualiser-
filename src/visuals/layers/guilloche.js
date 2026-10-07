// Guilloché: the engraved rosettes of banknotes and watch dials. Two families of fine waving rings, r = R + A·sin(kθ + φ),
// each ring's phase a step on from the one inside it, and the second family running the other way, so they weave into a
// rope-like net round the centre. A new rosette (its number of lobes: more when the music is intense) is engraved on each
// phrase line, the burin sweeping round once over the first bar; it turns a notch each bar, and the bass swells its waves.
// Symmetric, calm and precise: the user's taste (docs/taste.md, principle 9). Simple mode draws the same curves as lines.
import { S } from '../../state.js';
const st = {k: 8, pk: 8, prog: 1, phase: -1, turn: 0};
const LOBES = [5, 6, 7, 8, 9, 10, 12];
const LINES = 12;
export default {
  key: 'guilloche', kind: 'layer', label: 'Guilloché',
  suits: {mid:.3, perc:-.1, T:-.1},   // what music it suits (features centred on 0): steady, melodic, not frantic
  overWorld: 0,   // how well it sits over a world
  paint: 1.95,   // paint order in the trails: with the mandalas
  accent: 'bar',   // how it fires when it's the accent
  params(P, x){
    const J = x.J, ph = Math.floor(((J.bar || 0) - (J.phraseAnchor || 0))/4);
    if (ph !== st.phase) {   // a phrase line: a new rosette, engraved over the next bar
      if (st.phase !== -1) { st.pk = st.k; const T = J.tension || 0, i = Math.min(LOBES.length - 1, Math.floor(T*LOBES.length*.8 + (Math.sin(ph*91.7)*43758.5 % 1 + 1) % 1*3)); st.k = LOBES[i] === st.k ? LOBES[(i + 2) % LOBES.length] : LOBES[i]; st.prog = 0; }
      st.phase = ph;
    }
    st.prog = Math.min(1, st.prog + x.dt/Math.max(1, 4*Math.max(.25, S.beatPeriod || .5)));   // (engraved over a bar)
    st.turn += ((J.bar || 0)*Math.PI/st.k/2 - st.turn)*Math.min(1, x.dt*2);   // a notch each bar, eased
    P.guil = [.17, .035 + .02*x.sBass*x.react*x.dim, st.k, st.turn + x.t*.02];
    P.guil2 = [st.prog, .42, .0135, st.pk];
  },
  feedback: {
    uniforms: 'uniform vec4 uGuil, uGuil2;   // inner radius, wave, lobes, turn; how far engraved, twist per ring, ring spacing, the last rosette\'s lobes',
    functions: `
float guilLines(vec2 q,float k,float prog){   // both families of rings at q: how close to a line
  float r=length(q), th=atan(q.y,q.x)+uGuil.w, A=uGuil.y, g=0.0;
  if(r<uGuil.x-A*1.2-0.01||r>uGuil.x+uGuil2.z*${LINES}.0+A*1.2+0.01) return 0.0;
  float sweep=fract((atan(q.y,q.x)+3.14159265)/6.2831853), on=smoothstep(prog*1.02,prog*1.02-0.02,sweep);   // the burin's sweep
  if(on<=0.0) return 0.0;
  for(int i=0;i<${LINES};i++){
    float fi=float(i), R=uGuil.x+fi*uGuil2.z;
    for(int s=0;s<2;s++){
      float sg=s==0?1.0:-1.0, ph=k*th*sg+fi*uGuil2.y;
      float f=r-R-A*sin(ph), gd=A*k*cos(ph)/max(r,0.02), d=abs(f)/sqrt(1.0+gd*gd);
      g+=smoothstep(0.0018,0.0,d)+0.12*smoothstep(0.006,0.0,d);
    }
  }
  return g*on;
}`,
    main: `
  {
    float g=guilLines(p,uGuil.z,uGuil2.x);
    if(uGuil2.x<1.0) g+=guilLines(p,uGuil2.w,1.0)*(1.0-uGuil2.x);   // the last rosette fading as the new one is engraved
    col+=hsv(uHue+uPal.y+0.08*sin(length(p)*18.0),0.45,1.0)*uL_guilloche*min(g,1.2)*0.32;
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uGuil && P.guil) { gl.uniform4fv(u.uGuil, P.guil); gl.uniform4fv(u.uGuil2, P.guil2); } },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.guilloche > .01) || !P.guil) return;
    const cx = sx(P.cx), cy = sy(P.cy), [R0, A, k, turn] = P.guil, [prog, tw, dr, pk] = P.guil2;
    const draw = (kk, pr, amt) => {
      c.beginPath();
      const n = Math.max(2, Math.round(360*pr));
      for (let i = 0; i < LINES; i++) for (const sg of [1, -1]) {
        for (let j = 0; j <= n; j++) {
          const a = -Math.PI + j/360*Math.PI*2, th = a + turn, r = (R0 + i*dr + A*Math.sin(kk*th*sg + i*tw))*u;
          const X = cx + Math.cos(a)*r, Y = cy - Math.sin(a)*r; j ? c.lineTo(X, Y) : c.moveTo(X, Y);
        }
      }
      glowStroke(c, al => `hsla(${hsl(P.hue + P.pal[1])},45%,65%,${Math.min(1, al).toFixed(3)})`, Math.min(1, P.l.guilloche)*amt*.5, u*.35);
    };
    draw(k, prog, 1); if (prog < 1) draw(pk, 1, 1 - prog);
  },
};
