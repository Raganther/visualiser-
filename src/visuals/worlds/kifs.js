// The fractal depths: a kaleidoscopic fractal flown through for ever (the user asked to dive into the kaleidoscope's
// endless fractal, "exploring the image from the inside", symmetry and asymmetry, images branching off from images). Space
// is folded through mirrors again and again (abs, then sorted: the cube's own mirrors), turned a little each time, scaled
// about a corner: a kaleidoscopic IFS, halls of arms branching out of arms, repeating along the flight with a clear way
// through for the camera. The music turns the folds (TUNE.kifs): calm keeps it nearly symmetric, intense music twists it,
// a drop breaks it to new angles that settle back; each section is its own fractal (its scale, its corner), morphing
// into the next. The kick sends light rushing away down the halls, the hats glint on the edges, a glow gathers along the
// view, the bass breathes in the folds. Heavy: drawn smaller first when frames run slow (lowRes, heavy). Simple mode flies
// through nested, folded polygons instead.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';
import { S } from '../../state.js';
import { SIG } from '../../scene/signals.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null, roll: 0, t: 0, kickT: -9,
  a: [0, 0], aT: [0, 0], bars: 0};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
const PER = 3.2;   // the fractal repeats along the flight every PER units
// a section's fractal: its scale and the corner it's scaled about (x, y, z)
const LOOK = D => [2.6 + hh(D + .3)*.7, .85 + hh(D + 1.7)*.3, .85 + hh(D + 2.9)*.3, .85 + hh(D + 4.1)*.3];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v)*t);
export const kifsAt = z => { st.z = z; };   // (for tests: put the camera this far along)
export default {
  key: 'kifs', kind: 'world', lowRes: () => 1, heavy: () => true, label: 'Fractal depths',
  light: {hue: .7, sat: .55, x: 0, y: .3},
  // builds and intense, busy music: it's dense and turning
  suits: (rf, T) => rf.busy*.15 + rf.bright*.1 + T*.3 + rf.perc*.1,
  onBeat(pos){ if (pos === 0) st.bars++; },
  params(P, x){
    const T = TUNE.kifs, J = x.J, on = P.w.kifs > .05, ten = (J && J.tension) || 0;
    sectionLayout(st, 'kfD', J, on, x.dt, T.morphSecs);
    st.t += x.dt;
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) { st.surge = 1; st.aT = [(Math.random() - .5)*2*T.dropTwist, (Math.random() - .5)*2*T.dropTwist]; } st.drop = J.lastDrop; }
    st.surge *= Math.exp(-x.dt/T.surgeSecs);
    // the folds' turn: towards the music's (calm: nearly none; intense: more, swaying with the bar), a drop's kick settling back
    const tw = T.twist*(.15 + .85*ten), sw = Math.sin(2*Math.PI*(st.bars + (SIG.barPhase || 0))/8);
    st.aT = st.aT.map(v => v*Math.exp(-x.dt/(T.settleBars*4*Math.max(.25, S.beatPeriod))));
    const want = [tw*sw + st.aT[0], tw*.6*Math.cos(2*Math.PI*(st.bars + (SIG.barPhase || 0))/16) + st.aT[1]];
    st.a = st.a.map((v, i) => v + (want[i] - v)*Math.min(1, x.dt*1.5));
    const v = T.speed*(T.calm + (1 - T.calm)*ten)*(1 + T.surge*st.surge);
    st.sp += (v - st.sp)*Math.min(1, x.dt*.8);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;
    if (on) { st.z += st.sp*mdt; st.roll += mdt*T.turn*(.3 + ten + st.surge*2); }
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; st.wave = 0; }
    st.wave += x.dt;
    const L = mix(LOOK(st.D0), LOOK(st.D1), st.tr*st.tr*(3 - 2*st.tr));   // (morphing into the section's own)
    P.kf = [st.z, st.roll, L[0], 1 + (P.bass || 0)*x.react*T.breath];
    P.kf2 = [st.a[0], st.a[1], L[1], L[2]];
    P.kf3 = [st.wave*T.waveSpeed, Math.exp(-st.wave*T.waveFade)*x.dim, st.surge*x.dim, Math.min(1, (SIG.hat || 0)*1.4)];
    P.kf4 = [L[3], x.t, T.tunnel, T.cell];
    // the centrepiece floats down the clear way ahead
    if (P.w.kifs > .5) { const dz = T.gate - (st.z % T.gate); if (dz < 1.5) P.anchor = {hide: true}; else P.anchor = {pos: [0, 0], size: T.heartSize/dz/1.25/.49, dist: dz}; }
  },
  glsl: {
    uniforms: `uniform vec4 uKf, uKf2, uKf3, uKf4; uniform float uKfG;   // the fractal depths: where along it, its roll, its scale, the bass; the folds' turns, the corner; the kick's wave, the surge, the hats; the corner's depth, time, the clear way, a cell's size; the glow`,
    functions: `
vec2 kfR(vec2 p,float a){ float c=cos(a), s=sin(a); return vec2(c*p.x-s*p.y,s*p.x+c*p.y); }
float kfTrap;
// the fractal: cells of a Menger sponge filling space (its holes line up into halls), each folded through the cube's
// mirrors, turned a little (the music's twist), scaled about its corner, again and again
float kfD(vec3 p){
  vec3 w=mod(p/uKf4.w+1.0,2.0)-1.0; float sc=uKf.z, s=uKf4.w; vec3 off=vec3(uKf2.z,uKf2.w,uKf4.x)*uKf.w; kfTrap=1e3;
  for(int i=0;i<4;i++){
    w=abs(w);
    if(w.x<w.y) w.xy=w.yx; if(w.x<w.z) w.xz=w.zx; if(w.y<w.z) w.yz=w.zy;
    w.xy=kfR(w.xy,uKf2.x); w.xz=kfR(w.xz,uKf2.y);
    w.xy=w.xy*sc-off.xy*(sc-1.0); w.z*=sc; if(w.z>0.5*off.z*(sc-1.0)) w.z-=off.z*(sc-1.0);
    s/=sc; kfTrap=min(kfTrap,dot(w,w));
  }
  vec3 q=abs(w)-1.0;
  return max((min(max(q.x,max(q.y,q.z)),0.0)+length(max(q,0.0)))*s,uKf4.z-length(p.xy));   // (a clear way along the flight, whatever the twist)
}
vec3 kifs(vec2 sp){
  vec2 q=kfR(sp,uKf.y); vec3 rd=normalize(vec3(q*1.1,1.0)), ro=vec3(0.0,0.0,uKf.x);
  float t=0.02, glow=0.0, hit=0.0, d=1.0; float it=0.0;
  for(int i=0;i<72;i++){
    d=kfD(ro+rd*t); glow+=exp(-d*40.0)*0.006;
    if(d<0.0015*t){ hit=1.0; break; }
    t+=d*0.85; it+=1.0; if(t>14.0) break;
  }
  vec3 pal1=hsv(uHue+uPal.x,0.7,1.0), pal2=hsv(uHue+uPal.y,0.75,1.0), pal3=hsv(uHue+uPal.z,0.35,1.0);
  vec3 col=pal1*glow*0.6;
  if(hit>0.5){
    vec3 p=ro+rd*t; float trap=kfTrap; vec2 e=vec2(0.0015*t,0.0);
    vec3 n=normalize(vec3(kfD(p+e.xyy)-kfD(p-e.xyy),kfD(p+e.yxy)-kfD(p-e.yxy),kfD(p+e.yyx)-kfD(p-e.yyx)));
    vec3 ld=normalize(vec3(0.5,0.7,0.3)); float key=max(dot(n,ld),0.0), head=max(dot(n,-rd),0.0), rim=pow(1.0-head,3.0), ao=pow(1.0-it/72.0,1.5);
    float dif=0.06+0.6*key+0.3*head;
    vec3 base=mix(mix(pal2,pal1,smoothstep(0.5,2.5,sqrt(trap))),pal3,0.5+0.5*sin(sqrt(trap)*3.0+p.z*0.4))*0.5;
    float wave=exp(-pow((t-uKf3.x)*0.9,2.0))*uKf3.y;   // the kick's light, rushing away
    float hat=step(0.985,fract(sin(dot(floor(p*30.0),vec3(12.9898,78.233,37.719)))*43758.5453+floor(uKf4.y*8.0)*0.13))*uKf3.w*smoothstep(0.6,2.5,t);   // (glints only in the distance: up close they were blocks)
    col=base*dif*ao+pal3*rim*0.25*ao+pal2*wave*1.4+vec3(hat)*0.8+vec3(uKf3.z*0.3);
    col*=exp(-t*0.16);
  }
  return col*uKfG;
}`,
    fn: 'kifs',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uKf, P.kf); gl.uniform4fv(u.uKf2, P.kf2); gl.uniform4fv(u.uKf3, P.kf3); gl.uniform4fv(u.uKf4, P.kf4); gl.uniform1f(u.uKfG, TUNE.kifs.glow); },
  // simple mode: flown through nested, folded polygons: at each depth a polygon whose corners each carry a smaller copy,
  // turned by the folds' turns (the same numbers as the shader)
  draw2d(o, P){
    const W = o.canvas.width, Hh = o.canvas.height, a = Math.min(1, P.w.kifs), [z0, roll, sc, breath] = P.kf, [a0, a1, ox, oy] = P.kf2, [wd, wb, surge, hat] = P.kf3;
    const pal = P.pal || [0, .33, .66], N = 4 + Math.round((sc - 2.1)/.9*3), step = .55;
    o.globalAlpha = a; o.fillStyle = '#000'; o.fillRect(0, 0, W, Hh); o.lineJoin = 'round';
    const poly = (cx, cy, r, ang, depth, k, fog) => {
      o.beginPath(); for (let i = 0; i <= N; i++) { const t = ang + i*2*Math.PI/N; o[i ? 'lineTo' : 'moveTo'](cx + Math.cos(t)*r, cy + Math.sin(t)*r); } o.stroke();
      if (depth <= 0) return;
      for (let i = 0; i < N; i++) { const t = ang + i*2*Math.PI/N; poly(cx + Math.cos(t)*r*ox, cy + Math.sin(t)*r*ox, r/sc*1.4, ang + a0*2 + (i % 2 ? a1 : -a1), depth - 1, k, fog); }
    };
    for (let k = Math.floor(z0/step) + 22; k >= Math.ceil(z0/step); k--) {
      const ahead = k*step - z0; if (ahead < .15) continue;
      const r = Hh*.9*breath/ahead/1.1, fog = Math.exp(-ahead*.18), wave = Math.exp(-(((ahead - wd)*.9)**2))*wb;
      o.strokeStyle = hc(P.hue + pal[k % 3], 70, 45 + 30*wave, Math.min(1, fog*(.45 + wave + surge*.5 + hat*.2*(k % 2)))); o.lineWidth = Math.max(.6, 2.2/ahead);
      poly(W/2, Hh/2, r, -roll + k*.21 + a0*k*.3, ahead < 2 ? 1 : 2, k, fog);
    }
    o.globalAlpha = 1;
  },
};
