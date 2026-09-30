// Unfolding mandala: an Indian mandala growing outwards for ever. A lotus blooms at the heart, opening and closing with
// the bar; a new ring is born round it each bar and flows outwards, its motifs blooming open as it goes: lotus petals
// (doubled, overlapped, veined as the detail rises), rings of dots and beads, scalloped arches, temple teeth,
// teardrops, a leafy vine, and now and then a ring of animals (pairs of elephants facing each other, trunks raised;
// fish; doves). Each ring has its own motif and number of folds, so the whole keeps evolving while staying symmetric.
// The detail setting (mandDetail: simple to intricate) sets how many folds and how much ornament; Journey picks one per
// section. The user loved the mandala "as it evolves and unfolds" and asked for flowers, Indian patterns and elephants.
// A ring's place is its log radius minus the time in bars, so each grows by the same factor a bar.
import { TUNE } from '../../tuning.js';

const L = .55, R0 = .07;   // each ring is e^L times the one inside it; the lotus at the heart
const st = {};
const hh = (id, s) => { const v = Math.sin(id*s + 311.7)*43758.5453; return v - Math.floor(v); };
// ring id's motif (0 petals, 1 dots, 2 arches, 3 teeth, 4 teardrops, 5 vine, 6 animals), its folds, animal (0 elephant, 1 fish, 2 dove)
function ring(id, d){
  const h = hh(id, 127.1), h2 = hh(id, 269.5), cum = [.25, .37, .49, .59, .72, .82, 1];
  const kind = cum.findIndex(v => h < v);
  const n = kind === 6 ? (d < .33 ? 6 : 8) : [[4, 6, 6, 8], [6, 8, 8, 12], [8, 12, 16, 24]][d < .33 ? 0 : d < .66 ? 1 : 2][Math.floor(h2*4)];
  return {kind, n, animal: Math.floor(hh(id, 71.3)*3), hue: ((id % 3) + 3) % 3, turn: h2*Math.PI};
}
export default {
  key: 'unfold', kind: 'layer', label: 'Unfolding mandala',
  suits: {mid:.3, T:-.1, perc:.1},   // what music it suits (features centred on 0): melodic and steady
  overWorld: -.2,   // how well it sits over a world: it wants the dark
  paint: 1.95,   // paint order in the trails: just after the mandala
  accent: 'bar',   // how it fires when it's the accent
  params(P, x){
    // time in bars (the grid's, roughly where in the bar too), eased so the rings glide out rather than step; never back
    const J = x.J, bp = Math.min(1, Math.max(0, ((J.pos || 0) + .5)/4)), want = ((J.bar || 0) + bp)/TUNE.unfold.barsPerRing;
    st.t = st.t === undefined ? want : st.t + Math.max(0, Math.min(.25, want - st.t))*Math.min(1, x.dt*2) + x.dt*.02;
    const d = Math.min(1, Math.max(0, x.eff && x.eff.mandDetail != null ? x.eff.mandDetail : .5));
    P.unfT = st.t; P.unfTurn = x.t*.03; P.unfD = d; P.unfOpen = .55 + .45*Math.sin(st.t*TUNE.unfold.barsPerRing*Math.PI*2);   // the heart's lotus opens and closes with the bar
  },
  feedback: {
    uniforms: 'uniform vec4 uUnf;   // time in bars, turn, detail, how open the lotus is',
    functions: `
float unfH(float id,float s){ return fract(sin(id*s+311.7)*43758.5453); }
float unfE(vec2 p,vec2 r){ return (length(p/r)-1.0)*min(r.x,r.y); }                                   // an ellipse, near enough
float unfS(vec2 p,vec2 a,vec2 b){ vec2 pa=p-a, ba=b-a; return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0)); }   // a segment
float unfLn(float d,float w){ return smoothstep(w,w*0.3,abs(d)); }                                      // a drawn line
float unfIn(float d){ return smoothstep(0.004,-0.004,d); }                                               // inside a shape
// an animal in its cell (q.x from the pair's middle outwards, q.y up the ring, 0..1), facing the middle; returns its outline
float unfSm(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }   // a smooth union
float unfAnimal(vec2 q,float kind,float det,float w){
  float d, deco=9.0;
  if(kind<0.5){   // an elephant: body, head, raised trunk, legs, tail; its ear, tusk, eye and a saddle cloth with a scalloped hem
    float body=unfE(q-vec2(0.38,0.47),vec2(0.2,0.15)), head=length(q-vec2(0.18,0.57))-0.105;
    float trunk=min(unfS(q,vec2(0.09,0.54),vec2(0.045,0.7)),unfS(q,vec2(0.045,0.7),vec2(0.1,0.85)))-0.03*(1.0-max(0.0,q.y-0.54)*1.2);
    float legs=min(min(unfS(q,vec2(0.25,0.38),vec2(0.25,0.14)),unfS(q,vec2(0.33,0.38),vec2(0.33,0.14))),min(unfS(q,vec2(0.43,0.38),vec2(0.43,0.14)),unfS(q,vec2(0.51,0.38),vec2(0.51,0.14))))-0.034;
    d=min(unfSm(unfSm(unfSm(body,head,0.04),trunk,0.03),legs,0.03),unfS(q,vec2(0.57,0.5),vec2(0.6,0.34))-0.008);
    deco=min(abs(unfE(q-vec2(0.235,0.56),vec2(0.06,0.09))),min(unfS(q,vec2(0.12,0.5),vec2(0.07,0.47)),unfS(q,vec2(0.07,0.47),vec2(0.045,0.5)))-0.006);
    deco=min(deco,length(q-vec2(0.15,0.6))-0.014);
    if(det>0.4){ float hem=0.38+0.018*abs(sin(q.x*70.0)), bx=max(max(0.3-q.x,q.x-0.47),hem-q.y); deco=min(deco,abs(bx)+step(0.01,bx)*9.0); }
  } else if(kind<1.5){   // a fish, its tail to the edge; its eye, gill and a line of scales
    float body=unfE(q-vec2(0.27,0.5),vec2(0.2,0.12)), tail=max(abs(q.y-0.5)-(q.x-0.44)*0.95,max(0.44-q.x,q.x-0.6));
    d=min(unfSm(body,tail,0.02),unfE(q-vec2(0.3,0.6),vec2(0.07,0.04)));
    deco=min(length(q-vec2(0.14,0.53))-0.018,abs(length(q-vec2(0.2,0.5))-0.11)+step(0.2,q.x)*9.0);
    if(det>0.5) deco=min(deco,abs(q.x-0.36-0.02*sin(q.y*50.0))+step(0.09,abs(q.y-0.5))*9.0);
  } else {   // a dove, a wing raised, a fan tail
    vec2 wq=q-vec2(0.37,0.56); float wing=unfE(vec2(wq.x*0.87-wq.y*0.5,wq.x*0.5+wq.y*0.87),vec2(0.06,0.15));
    float body=unfE(q-vec2(0.3,0.44),vec2(0.17,0.075)), head=length(q-vec2(0.13,0.5))-0.055;
    float beak=max(abs(q.y-0.5)-(0.09-q.x)*0.5,max(0.04-q.x,q.x-0.09)), tail=max(abs(q.y-0.42)-(q.x-0.44)*0.9,max(0.44-q.x,q.x-0.6));
    d=unfSm(unfSm(unfSm(body,head,0.02),wing,0.03),min(tail,beak),0.02);
    deco=length(q-vec2(0.12,0.52))-0.012;
  }
  return max(unfLn(d,w),unfLn(deco,w*0.8)*unfIn(d-0.01))+0.05*unfIn(d);
}
// how bright this point is, in the ring it falls in (the rings flow outwards as t grows)
float unfRing(vec2 p){
  float t=uUnf.x, det=uUnf.z, r=length(p)+1e-5, lr=log(r/${R0})/${L.toFixed(2)}, w=0.045-0.02*det;
  if(lr<0.0){   // the lotus at the heart, opening and closing with the bar
    float a=atan(p.y,p.x)+uUnf.y, s=6.2831853/8.0, c=(mod(a,s)/s-0.5), f=r/${R0}, op=uUnf.w;
    float pw=0.5*pow(max(0.0,sin(3.14159*min(1.0,f/op))),0.8)*(1.0-f*0.2);
    float c2=mod(a+s*0.5,s)/s-0.5, pw2=0.45*pow(max(0.0,sin(3.14159*min(1.0,f/(op*0.75)))),0.8);
    return unfLn(abs(c)-pw,0.06)*step(f,op)+(det>0.3 ? unfLn(abs(c2)-pw2,0.06)*step(f,op*0.75)*0.8 : 0.0)+smoothstep(0.25,0.1,f);
  }
  float v=lr-t, id=floor(v), f=fract(v), age=id+t;   // f: 0 at the ring's inner edge, 1 its outer; age: 0 as it's born
  float h=unfH(id,127.1), h2=unfH(id,269.5), kind=h<0.25?0.0:h<0.37?1.0:h<0.49?2.0:h<0.59?3.0:h<0.72?4.0:h<0.82?5.0:6.0;
  float band=det<0.33?0.0:det<0.66?1.0:2.0, pick=floor(h2*4.0);
  float n=kind>5.5 ? (det<0.33?6.0:8.0) : band<0.5 ? (pick<0.5?4.0:pick<2.5?6.0:8.0) : band<1.5 ? (pick<0.5?6.0:pick<2.5?8.0:12.0) : (pick<0.5?8.0:pick<1.5?12.0:pick<2.5?16.0:24.0);
  float a=atan(p.y,p.x)+h2*3.14159+uUnf.y*(mod(id,2.0)*2.0-1.0), s=6.2831853/n, c=mod(a,s)/s-0.5;   // c: -0.5..0.5 across one fold
  float A=6.2831853/(n*${L.toFixed(2)});   // the cell's width against its depth, so shapes keep their proportions
  float grow=smoothstep(-0.1,1.3,age), fg=f/max(grow,0.05);   // a newborn ring's motifs start small and bloom open
  float g=0.0;
  if(kind<0.5){   // lotus petals: doubled, overlapped and veined as the detail rises
    float pw=0.46*pow(max(0.0,sin(3.14159*min(fg,1.0))),0.75)*(1.0-0.25*fg)*grow;
    g=unfLn(abs(c)-pw,w/A)*step(fg,1.0)+0.05*step(abs(c),pw)*step(fg,1.0);
    if(det>0.3) g+=0.8*unfLn(abs(c)-pw*0.55,w/A)*step(fg,0.8);
    if(det>0.45){ float c2=mod(a+s*0.5,s)/s-0.5, pw2=0.4*pow(max(0.0,sin(3.14159*min(fg/0.7,1.0))),0.75)*grow; g=max(g,0.7*unfLn(abs(c2)-pw2,w/A)*step(fg,0.7)); }
    if(det>0.65) g+=0.6*unfLn(c,w*0.5/A)*step(fg,0.75)*step(0.15,fg);
  } else if(kind<1.5){   // dots, beads between, a thread of seeds
    vec2 q=vec2(c*A,f-0.5); float rr=0.2*grow;
    g=unfLn(length(q)-rr,w)+0.5*unfIn(length(q)-rr*0.35);
    if(det>0.4){ vec2 q2=vec2((c<0.0?c+0.5:c-0.5)*A,f-0.5); g+=0.8*unfIn(length(q2)-0.07*grow); }
    if(det>0.7) g+=0.6*unfLn(length(vec2(fract(c*4.0+0.5)-0.5,(f-0.12)*4.0/A))-0.2,0.08);
  } else if(kind<2.5){   // scalloped arches, each with its inner arch and a drop
    vec2 q=vec2(c*A,f-0.05); float ra=0.5*A*grow;
    g=unfLn(length(q)-ra,w)*step(0.0,q.y);
    if(det>0.35) g+=0.7*unfLn(length(q)-ra*0.72,w)*step(0.0,q.y);
    if(det>0.6) g+=0.7*unfIn(length(q-vec2(0.0,ra*0.35))-0.05*grow);
  } else if(kind<3.5){   // temple teeth: a zigzag crown, doubled
    float z=0.1+0.8*grow*(1.0-2.0*abs(c));
    g=unfLn(f-z,w);
    if(det>0.4) g+=0.7*unfLn(f-z*0.6,w);
    if(det>0.7) g+=0.6*unfIn(length(vec2(c*A,f-z-0.07))-0.035);
  } else if(kind<4.5){   // teardrops (paisley), with an eye
    vec2 q=vec2(c*A,f-0.32); float rr=0.17*grow;
    float td=max(length(q)-rr,-q.y*0.0-9.0); td=min(td,max(abs(q.x)-rr*(1.0-q.y/(0.55*grow+1e-3)),max(-q.y,q.y-0.55*grow)));
    g=unfLn(td,w)+0.05*unfIn(td);
    if(det>0.35) g+=0.7*unfIn(length(q)-rr*0.35);
    if(det>0.65) g+=0.6*unfLn(td+0.04,w*0.8);
  } else if(kind<5.5){   // a leafy vine winding round
    float y=0.5+0.22*sin(c*6.2831853), wl=unfLn(f-y,w);
    vec2 q=vec2(c*A-0.25*A,f-0.72); float leaf=unfE(vec2(q.x*0.8+q.y*0.6,q.y*0.8-q.x*0.6),vec2(0.13,0.06)*grow);
    g=wl+unfLn(leaf,w)+0.06*unfIn(leaf);
    if(det>0.5){ vec2 q2=vec2(c*A+0.25*A,f-0.28); float l2=unfE(vec2(q2.x*0.8-q2.y*0.6,q2.y*0.8+q2.x*0.6),vec2(0.13,0.06)*grow); g+=unfLn(l2,w)+0.06*unfIn(l2); }
  } else {   // a ring of animals, in facing pairs
    float kindA=floor(unfH(id,71.3)*3.0);
    vec2 q=vec2(abs(c)*A,f)/vec2(max(grow,0.05)*A*0.5/0.62,max(grow,0.05));
    g=unfAnimal(q,kindA,det,w/(A*0.5/0.62));
  }
  g+=0.55*(unfLn(f,w*0.6)+unfLn(f-1.0,w*0.6));                               // each ring's edges
  if(det>0.55) g+=0.4*unfLn(f-0.04,w*0.4);                                      // doubled, with a fine inner line
  return g*smoothstep(-0.2,0.6,age)*smoothstep(0.78,0.48,r);
}`,
    main: `
  {
    float r=length(p)+1e-5, v=log(r/${R0})/${L.toFixed(2)}-uUnf.x, id=floor(v), hk=mod(id,3.0);
    float hue=r<${R0} ? uPal.x : hk<0.5?uPal.x:hk<1.5?uPal.y:uPal.z;
    col+=hsv(uHue+hue,0.6,1.0)*uL_unfold*unfRing(p)*(0.42+uBeat*0.3+uMid*uReact*0.25);
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uUnf) gl.uniform4f(u.uUnf, P.unfT || 0, P.unfTurn || 0, P.unfD ?? .5, P.unfOpen ?? 1); },
  // simple mode: the same rings, plainer (each motif as a few strokes)
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.unfold > .01)) return;
    const cx = sx(P.cx), cy = sy(P.cy), t = P.unfT || 0, d = P.unfD ?? .5, lvl = Math.min(1, P.l.unfold)*(.42 + P.beat*.3);
    const stroke = (hue, al) => glowStroke(c, a2 => `hsla(${hsl(P.hue + P.pal[hue])},60%,62%,${Math.min(1, a2).toFixed(3)})`, al, u*.5);
    // the heart's lotus
    c.beginPath(); for (let k = 0; k < 8; k++) { const a0 = -(P.unfTurn + k*Math.PI/4), a1 = a0 - Math.PI/4, am = (a0 + a1)/2, R = R0*u*(P.unfOpen ?? 1);
      c.moveTo(cx, cy); c.quadraticCurveTo(cx + Math.cos(a0)*R*.8, cy + Math.sin(a0)*R*.8, cx + Math.cos(am)*R, cy + Math.sin(am)*R); c.quadraticCurveTo(cx + Math.cos(a1)*R*.8, cy + Math.sin(a1)*R*.8, cx, cy); }
    stroke(0, lvl);
    for (let id = Math.floor(-t) - 1; ; id++) {   // each ring on screen, inner to outer
      const age = id + t, r0 = R0*Math.exp(L*age), r1 = r0*Math.exp(L), rm = (r0 + r1)/2, bw = r1 - r0;
      if (r0 > .78) break; if (age < -.2) continue;
      const R = ring(id, d), grow = Math.min(1, Math.max(0, (age + .1)/1.4)), fade = Math.min(1, Math.max(0, (age + .2)/.8))*Math.min(1, Math.max(0, (.78 - rm)/.3));
      if (fade < .02) continue;
      const turn = R.turn + (P.unfTurn || 0)*(id & 1 ? 1 : -1), s = Math.PI*2/R.n, P2 = (rr, a) => [cx + Math.cos(-a)*rr*u, cy + Math.sin(-a)*rr*u];
      c.beginPath();
      c.moveTo(cx + r0*u, cy); c.arc(cx, cy, r0*u, 0, Math.PI*2);
      for (let k = 0; k < R.n; k++) {
        const a0 = turn + k*s, am = a0 + s/2, a1 = a0 + s;
        if (R.kind === 0 || R.kind === 3) {   // petals and teeth
          const tip = P2(r0 + bw*grow*(R.kind === 3 ? .9 : 1), am), b0 = P2(r0, a0 + s*(.5 - .46*grow)), b1 = P2(r0, a1 - s*(.5 - .46*grow));
          c.moveTo(...b0); if (R.kind === 0) c.quadraticCurveTo(...P2(r0 + bw*.6*grow, a0 + s*.05), ...tip); else c.lineTo(...tip);
          if (R.kind === 0) c.quadraticCurveTo(...P2(r0 + bw*.6*grow, a1 - s*.05), ...b1); else c.lineTo(...b1);
        } else if (R.kind === 1 || R.kind === 4) {   // dots and teardrops
          const [ox, oy] = P2(rm, am), rr = bw*(R.kind === 1 ? .2 : .17)*grow*u; c.moveTo(ox + rr, oy); c.arc(ox, oy, rr, 0, Math.PI*2);
          if (R.kind === 4) { const [tx, ty] = P2(r0 + bw*(.32 + .55*grow), am); c.moveTo(ox + Math.cos(-am + Math.PI/2)*rr, oy + Math.sin(-am + Math.PI/2)*rr); c.lineTo(tx, ty); c.lineTo(ox - Math.cos(-am + Math.PI/2)*rr, oy - Math.sin(-am + Math.PI/2)*rr); }
        } else if (R.kind === 2) {   // arches
          const [ox, oy] = P2(r0, am); c.moveTo(...P2(r0, a0)); c.quadraticCurveTo(...P2(r0 + bw*1.1*grow, am), ...P2(r0, a1));
        } else if (R.kind === 5) {   // the vine
          for (let j = 0; j <= 8; j++) { const aa = a0 + s*j/8, rr = rm + bw*.22*Math.sin(j/8*Math.PI*2); j ? c.lineTo(...P2(rr, aa)) : c.moveTo(...P2(rr, aa)); }
        } else {   // animals: a pair facing each other (elephants: body, head, raised trunk, legs)
          for (const sg of [-1, 1]) {
            const at = (fx, fy) => P2(r0 + bw*fy*grow, am + sg*fx*grow*s*.62/.5*.5);
            const [bx, by] = at(.36, .42), [hx, hy] = at(.16, .5), br = bw*.12*grow*u;
            c.moveTo(bx + br*1.5, by); c.ellipse(bx, by, br*1.5, br, -am, 0, Math.PI*2);
            c.moveTo(hx + br*.8, hy); c.arc(hx, hy, br*.8, 0, Math.PI*2);
            if (R.animal === 0) { c.moveTo(...at(.08, .5)); c.quadraticCurveTo(...at(.02, .66), ...at(.09, .78)); for (const lx of [.24, .32, .42, .5]) { c.moveTo(...at(lx, .34)); c.lineTo(...at(lx, .1)); } }
          }
        }
      }
      stroke(R.hue, lvl*fade);
    }
  },
};
