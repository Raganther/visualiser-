// Unfolding mandala: rings of sacred geometry born at the centre, one a bar, flowing outwards for ever, each ring its own
// pattern (petals, interlocking circles, a crown of points, beads) with its own number of folds, so the whole keeps
// evolving and never repeats exactly, while staying perfectly symmetric. The user loved the mandala "as it evolves and
// unfolds" and asked for one that constantly moves outwards. A ring's place: its log radius minus the time (in bars), so
// each grows by the same factor a bar, slow near the middle and sweeping past at the edge, like the kaleidoscope's dive.
const L = .55;   // each ring is e^L times the one inside it
const st = {};
const ring = id => {   // ring id's pattern: its kind (0 petals, 1 circles, 2 points, 3 beads), folds, hue (0-2 in the palette), turn
  const h = Math.abs(Math.sin(id*127.1 + 311.7)*43758.5453) % 1, h2 = Math.abs(Math.sin(id*269.5 + 183.3)*43758.5453) % 1;
  return {kind: Math.floor(h*4), n: [6, 8, 12, 6, 10, 16][Math.floor(h2*6)], hue: ((id % 3) + 3) % 3, turn: h2*Math.PI};
};
export default {
  key: 'unfold', kind: 'layer', label: 'Unfolding mandala',
  suits: {mid:.3, T:-.1, perc:.1},   // what music it suits (features centred on 0): melodic and steady
  overWorld: -.2,   // how well it sits over a world: it wants the dark
  paint: 1.95,   // paint order in the trails: just after the mandala
  accent: 'bar',   // how it fires when it's the accent
  params(P, x){
    // time in bars (the grid's, roughly where in the bar too), eased so the rings glide out rather than step; never back
    const J = x.J, want = (J.bar || 0) + Math.min(1, Math.max(0, ((J.pos || 0) + .5)/4));
    st.t = st.t === undefined ? want : st.t + Math.max(0, Math.min(.25, want - st.t))*Math.min(1, x.dt*2) + x.dt*.02;
    P.unfT = st.t; P.unfTurn = x.t*.03;
  },
  feedback: {
    uniforms: 'uniform vec2 uUnf;   // time in bars, turn',
    functions: `
float unfH(float id,float s){ return fract(sin(id*s+311.7)*43758.5453); }
float unfRing(vec2 q,float t){   // how bright this point is, in the ring it falls in (the rings flow outwards as t grows)
  float r=length(q)+1e-5, v=log(r/0.06)/${L.toFixed(2)}-t, id=floor(v), f=fract(v);   // f: 0 at the ring's inner edge, 1 its outer
  float h=abs(unfH(id,127.1)), h2=abs(unfH(id,269.5)), kind=floor(h*4.0);
  float n=h2<0.1667?6.0:h2<0.3333?8.0:h2<0.5?12.0:h2<0.6667?6.0:h2<0.8333?10.0:16.0;
  float a=atan(q.y,q.x)+h2*3.14159+uUnf.y*(mod(id,2.0)*2.0-1.0), s=6.2831853/n, c=mod(a,s)/s-0.5;   // c: -0.5..0.5 across one fold
  float w=0.05, g=0.0;
  if(kind<0.5){ float e=abs(f-0.5-0.38*cos(c*6.2831853)); g=smoothstep(w,0.0,abs(e-0.1)); }                  // petals
  else if(kind<1.5){ vec2 d=vec2(c*1.6,f-0.5); g=smoothstep(w*1.3,0.0,abs(length(d)-0.42)); }               // interlocking circles
  else if(kind<2.5){ g=smoothstep(w,0.0,abs(f-(0.15+0.7*(1.0-2.0*abs(c))))); }                             // a crown of points
  else { vec2 d=vec2(c*1.6,f-0.5); g=smoothstep(0.2,0.1,length(d))+0.5*smoothstep(w,0.0,abs(f-0.08)); }      // beads, and a thread
  g+=0.6*smoothstep(0.03,0.0,f)+0.6*smoothstep(0.97,1.0,f);   // each ring's edges
  return g*smoothstep(-0.5,1.2,log(r/0.06)/${L.toFixed(2)})*smoothstep(0.75,0.45,r);
}`,
    main: `
  {
    float r=length(p)+1e-5, v=log(r/0.06)/${L.toFixed(2)}-uUnf.x, id=floor(v), hk=mod(id,3.0);
    float hue=hk<0.5?uPal.x:hk<1.5?uPal.y:uPal.z;
    col+=hsv(uHue+hue,0.6,1.0)*uL_unfold*unfRing(p,uUnf.x)*(0.45+uBeat*0.35+uMid*uReact*0.3);
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uUnf) gl.uniform2f(u.uUnf, P.unfT || 0, P.unfTurn || 0); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.unfold > .01)) return;
    const cx = sx(P.cx), cy = sy(P.cy), t = P.unfT || 0, lvl = Math.min(1, P.l.unfold)*(.45 + P.beat*.35);
    for (let id = Math.floor(-t) - 1; ; id++) {   // each ring on screen, inner to outer
      const r0 = .06*Math.exp(L*(id + t)), r1 = r0*Math.exp(L), rm = (r0 + r1)/2, bw = r1 - r0;
      if (r0 > .75) break; if (r1 < .02) continue;
      const R = ring(id), fade = Math.min(1, Math.max(0, (Math.log(rm/.06)/L + .5)/1.7))*Math.min(1, Math.max(0, (.75 - rm)/.3));
      if (fade < .02) continue;
      const turn = R.turn + (P.unfTurn || 0)*(id & 1 ? 1 : -1), s = Math.PI*2/R.n;
      c.beginPath();
      for (let k = 0; k < R.n; k++) {
        const a = -(turn + (k + .5)*s), ox = cx + Math.cos(a)*rm*u, oy = cy + Math.sin(a)*rm*u;
        if (R.kind === 1 || R.kind === 3) { c.moveTo(ox + bw*u*(R.kind === 1 ? .42 : .15), oy); c.arc(ox, oy, bw*u*(R.kind === 1 ? .42 : .15), 0, Math.PI*2); }
        else { const a0 = -(turn + k*s), a1 = a0 - s, ro = (R.kind === 0 ? rm + bw*.35 : r1 - bw*.15)*u, ri = (R.kind === 0 ? rm - bw*.25 : r0 + bw*.15)*u;   // petals and points
          c.moveTo(cx + Math.cos(a0)*ri, cy + Math.sin(a0)*ri); c.quadraticCurveTo(ox + Math.cos(a)*(ro - rm*u)*1.4, oy + Math.sin(a)*(ro - rm*u)*1.4, cx + Math.cos(a1)*ri, cy + Math.sin(a1)*ri); }
      }
      c.moveTo(cx + r0*u, cy); c.arc(cx, cy, r0*u, 0, Math.PI*2);
      glowStroke(c, al => `hsla(${hsl(P.hue + P.pal[R.hue])},60%,62%,${Math.min(1, al).toFixed(3)})`, lvl*fade, u*.5);
    }
  },
};
