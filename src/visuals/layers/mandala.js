// Mandala: the flower of life, seven circles and the ring round them, drawing itself arc by arc over each four-bar phrase
// and starting again on the next, turning slowly with the bars. Sacred geometry that keeps time.
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
    P.mandR = .11*(1 + x.sBass*x.react*.08);
  },
  feedback: {
    uniforms: 'uniform vec3 uMand;   // how much is drawn, turn, radius',
    main: `
  {
    vec2 q=p; float R=uMand.z, ca=cos(uMand.y), sa=sin(uMand.y); q=mat2(ca,-sa,sa,ca)*q;
    float lum=0.0;
    for(int k=0;k<8;k++){
      float fk=float(k), a0=fk*1.0471976;
      vec2 cc=k==0?vec2(0.0):k==7?vec2(0.0):R*vec2(cos(a0),sin(a0)); float cr=k==7?2.0*R:R;
      vec2 d=q-cc; float r=length(d); if(abs(r-cr)>0.012) continue;
      float a=fract((atan(d.y,d.x)-a0)/6.2831853+1.0);   // how far round this circle, from where it starts
      float order=(fk+a)/8.0;                            // circles drawn one after another over the phrase
      if(order>uMand.x) continue;
      float fresh=exp(-(uMand.x-order)*40.0);            // the pen's tip is brightest
      lum+=(smoothstep(0.003,0.0,abs(r-cr))+0.3*smoothstep(0.012,0.0,abs(r-cr)))*(0.5+1.5*fresh);
    }
    col+=hsv(uHue+uPal.z+0.02,0.55,1.0)*uL_mandala*lum*(0.4+uBeat*0.3);
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uMand) gl.uniform3f(u.uMand, P.mandProg || 0, P.mandTurn || 0, P.mandR || .11); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.mandala > .01)) return;
    const cx = sx(P.cx), cy = sy(P.cy), R = (P.mandR || .11)*u, T = -(P.mandTurn || 0), prog = P.mandProg || 0;
    for (let k = 0; k < 8; k++) {
      const a0 = k*Math.PI/3, ox = k === 0 || k === 7 ? 0 : Math.cos(a0 + T)*R, oy = k === 0 || k === 7 ? 0 : -Math.sin(a0 + T)*R, cr = k === 7 ? 2*R : R;
      const part = Math.min(1, Math.max(0, prog*8 - k)); if (part <= 0) continue;
      c.beginPath(); c.arc(cx + ox, cy + oy, cr, -(a0 + T), -(a0 + T) - part*Math.PI*2, true);
      glowStroke(c, al => `hsla(${hsl(P.hue + P.pal[2] + .02)},55%,62%,${Math.min(1, al).toFixed(3)})`, Math.min(1, P.l.mandala)*(.4 + P.beat*.3), u*.6);
    }
  },
};
