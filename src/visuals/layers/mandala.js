// Mandala: the flower of life drawing itself arc by arc over each four-bar phrase and starting again on the next, turning
// slowly with the bars. Sacred geometry that keeps time. The detail setting grows it: the seed (7 circles), the flower (19), 37.
export default {
  key: 'mandala', kind: 'layer', label: 'Mandala',
  suits: {mid:.3, perc:.2, T:-.2},   // what music it suits (features centred on 0): steady, melodic, not frantic
  overWorld: -.1,   // how well it sits over a world
  paint: 1.9,   // paint order in the trails
  accent: 'bar',   // how it fires when it's the accent
  params(P, x){
    const J = x.J, bars = ((J.bar - J.phraseAnchor) % 4 + 4) % 4;
    const beat = Math.min(1, Math.max(0, (J.pos || 0) + .5)/4);   // (roughly where in the bar: the pulse's own ramp isn't here)
    P.mandProg = Math.min(1, (bars + beat)/4 + .06);   // how much of the figure is drawn (a phrase: all of it)
    P.mandTurn = x.t*.05 + J.bar*.13;                  // it turns a notch each bar, and slowly between
    P.mandRings = (x.eff.mandDetail ?? .5) < .33 ? 1 : (x.eff.mandDetail ?? .5) < .66 ? 2 : 3;   // hexagonal rings of circles round the first
    P.mandR = (.22 + .05*(P.mandRings - 1))/(P.mandRings + 1)*(1 + x.sBass*x.react*.08);
  },
  feedback: {
    uniforms: 'uniform vec4 uMand;   // how much is drawn, turn, radius, rings',
    main: `
  {
    vec2 q=p; float R=uMand.z, ca=cos(uMand.y), sa=sin(uMand.y); q=mat2(ca,-sa,sa,ca)*q;
    float lum=0.0, M=uMand.w, N=1.0+3.0*M*(M+1.0);   // circles in all, then the ring round them
    for(int i=-3;i<=3;i++) for(int j=-3;j<=3;j++){
      float fi=float(i), fj=float(j), k=max(max(abs(fi),abs(fj)),abs(fi+fj)); if(k>M) continue;   // the hexagonal ring it's in
      vec2 cc=R*vec2(fi+0.5*fj,0.8660254*fj);
      vec2 d=q-cc; float r=length(d); if(abs(r-R)>0.012) continue;
      float a0=atan(cc.y,cc.x), a=fract((atan(d.y,d.x)-a0)/6.2831853+1.0);   // how far round this circle, from where it starts
      float order=k<0.5 ? a/(N+1.0) : (1.0+3.0*k*(k-1.0)+mod(floor(fract(a0/6.2831853+1.0)*6.0*k+0.5),6.0*k)+a)/(N+1.0);   // ring by ring, round each
      if(order>uMand.x) continue;
      float fresh=exp(-(uMand.x-order)*40.0);            // the pen's tip is brightest
      lum+=(smoothstep(0.003,0.0,abs(r-R))+0.3*smoothstep(0.012,0.0,abs(r-R)))*(0.5+1.5*fresh);
    }
    { float r=length(q), cr=(M+1.0)*R, a=fract(atan(q.y,q.x)/6.2831853+1.0), order=(N+a)/(N+1.0);   // the ring round it all
      if(abs(r-cr)<0.012 && order<=uMand.x) lum+=(smoothstep(0.003,0.0,abs(r-cr))+0.3*smoothstep(0.012,0.0,abs(r-cr)))*(0.5+1.5*exp(-(uMand.x-order)*40.0)); }
    col+=hsv(uHue+uPal.z+0.02,0.55,1.0)*uL_mandala*lum*(0.4+uBeat*0.3);
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uMand) gl.uniform4f(u.uMand, P.mandProg || 0, P.mandTurn || 0, P.mandR || .11, P.mandRings || 1); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.mandala > .01)) return;
    const cx = sx(P.cx), cy = sy(P.cy), R = (P.mandR || .11)*u, T = -(P.mandTurn || 0), prog = P.mandProg || 0;
    const M = P.mandRings || 1, N = 1 + 3*M*(M + 1), circ = [[0, 0, 0, 0]];   // centre, start angle, order
    for (let k = 1; k <= M; k++) for (let s = 0; s < 6; s++) for (let m = 0; m < k; m++) {   // ring by ring, round each
      const a = s*Math.PI/3, b = a + 2*Math.PI/3, x0 = k*Math.cos(a) + m*Math.cos(b), y0 = k*Math.sin(a) + m*Math.sin(b);
      circ.push([x0*R, y0*R, Math.atan2(y0, x0), 1 + 3*k*(k - 1) + s*k + m]);
    }
    circ.push([0, 0, 0, N, (M + 1)*R]);
    const col = al => `hsla(${hsl(P.hue + P.pal[2] + .02)},55%,62%,${Math.min(1, al).toFixed(3)})`, amt = Math.min(1, P.l.mandala)*(.4 + P.beat*.3);
    c.beginPath();
    for (const [x0, y0, a0, o, cr = R] of circ) {
      const part = Math.min(1, Math.max(0, prog*(N + 1) - o)); if (part <= 0) continue;
      const ox = Math.cos(T)*x0 - Math.sin(T)*y0, oy = -(Math.sin(T)*x0 + Math.cos(T)*y0), s0 = -(a0 + T);
      c.moveTo(cx + ox + Math.cos(s0)*cr, cy + oy + Math.sin(s0)*cr); c.arc(cx + ox, cy + oy, cr, s0, s0 - part*Math.PI*2, true);
    }
    glowStroke(c, col, amt, u*.6);
  },
};
