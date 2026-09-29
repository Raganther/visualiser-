// The paper sea: seven cut-paper layers of wave, each casting a soft shadow on the one behind, its edge catching the light,
// its face shaded from crest to trough, under a dusk sky of scalloped paper clouds. Each section brings its own sea: a
// palette (Hokusai's prussian blue and cream, a violet dusk, a tropical lagoon, a storm, liquid gold, blush, midnight)
// and a family of wave shapes (long swells, Hokusai's curling crests, chop, scallops like a seigaiha print, stepped
// terraces), its edges cut clean or torn, and the new sea morphs out of the old. The swell follows the bass, the crests
// flare on the kick, the waves grow with the tension, and a drop sends a great wave curling across the front. The user
// found the woodblock night sea flat and its moon naff, and asked for waves that change shape and colour.
import { sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';
import { L } from '../../audio/listen.js';

const HOR = -.02, NW = 6, BOAT_K = 2, HS = `(${HOR.toFixed(3)})`;
// the palettes: sky top, sky at the horizon, far sea, near sea, foam, the sun (and whether there is one)
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)/255);
const PALS = [   // (the sea always stands against its sky: deep blues and teals under warm skies)
  {name: 'hokusai', c: ['#b9a67c', '#f3ead2', '#6f8fa6', '#0f2a52', '#fbf6e9', '#d8452b'], sun: 1},
  {name: 'dusk',    c: ['#1d1140', '#ff8a5c', '#9c5f9a', '#1b1f5e', '#ffe1d0', '#ffd166'], sun: 1},
  {name: 'tropic',  c: ['#0b6fa3', '#bff5ec', '#4fd6c8', '#004e6e', '#ffffff', '#fff6c0'], sun: 0},
  {name: 'storm',   c: ['#15191f', '#7d8b96', '#4b5a66', '#0b141c', '#e8eef2', '#c9d3da'], sun: 0},
  {name: 'gold',    c: ['#40132a', '#ffb04a', '#c8745a', '#1e2a5a', '#fff1c9', '#fff0a0'], sun: 1},
  {name: 'blush',   c: ['#58508d', '#ffc6d0', '#b98bb0', '#2c3a70', '#fffaf4', '#ffe38a'], sun: 1},
  {name: 'midnight',c: ['#03040b', '#1e2c5c', '#26407a', '#050a1f', '#a9c0ff', '#dfe6ff'], sun: 0},
  {name: 'mint',    c: ['#123c3a', '#f2e8b6', '#83c5a6', '#0d3b4a', '#fffbe6', '#ff7b5c'], sun: 1},
].map(p => ({...p, c: p.c.map(hex)}));
const fr = v => v - Math.floor(v), rnd = (D, s) => fr(Math.sin(D*127.1 + s*311.7)*43758.5453);
// a section's sea (by its layout number): palette, wave family weights (swell, curl, chop, scallop), steps, torn edges,
// inner cut lines, cloudiness
function style(D){
  const f = Math.floor(rnd(D, 1)*5), w = [0, 0, 0, 0], st = 0;
  if (f < 4) w[f] = 1; else { w[0] = .6; w[2] = .5; } w[Math.floor(rnd(D, 2)*4)] += .35; w[0] += .15;
  return {pal: PALS[Math.floor(rnd(D, 3)*PALS.length)], w, st, tear: rnd(D, 4) < .4 ? .003 + rnd(D, 5)*.005 : 0, inner: rnd(D, 6) < .5 ? 1 : 0, cloud: .3 + rnd(D, 7)*.7,
    gulls: rnd(D, 8) < .55 ? 1 : 0, boat: rnd(D, 9) < .4 ? 1 : 0};
}
const vn = x => { const i = Math.floor(x), f = x - i, h = j => fr(Math.sin(j*127.1)*43758.5453), s = f*f*(3 - 2*f); return h(i) + (h(i + 1) - h(i))*s; };
const lerp = (a, b, m) => a + (b - a)*m, lerp3 = (a, b, m) => a.map((v, i) => lerp(v, b[i], m));
const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, lvl: .3, sw: 0, drops: 0, great: 1, flare: 0, kick: 0, hat: 0, flap: 0};
let cur = null, force = null;
// for looking at one sea (tools/look.mjs --eval): hold layout D, and optionally the great wave part way
export function seaForce(D, great){ force = D; st.D0 = st.D1 = D; st.tr = 1; if (great != null) { st.great = great; st.flare = 1; st.hold = great; } }   // this frame's blended sea (for simple mode and the front plane)
function blend(){
  const m0 = Math.min(1, st.tr), m = m0*m0*(3 - 2*m0), a = style(st.D0), b = style(st.D1);
  return {w: a.w.map((v, i) => lerp(v, b.w[i], m)), st: lerp(a.st, b.st, m), tear: lerp(a.tear, b.tear, m), inner: lerp(a.inner, b.inner, m),
    m, gulls: lerp(a.gulls, b.gulls, m), boat: lerp(a.boat, b.boat, m), cloud: lerp(a.cloud, b.cloud, m), sun: lerp(a.pal.sun, b.pal.sun, m), c: a.pal.c.map((c, i) => lerp3(c, b.pal.c[i], m)), D: m < .5 ? st.D0 : st.D1};
}
// the shape of one wave, u along it (0..1), from the family weights: 0..1 high
function prof(u, w, stp){
  const s0 = .5 + .5*Math.cos(u*Math.PI*2), a = .72, v = u < a ? u/a : (1 - u)/(1 - a), s1 = Math.pow(v, 2.2);
  const s2 = Math.pow(1 - Math.abs(Math.sin(Math.PI*u)), 1.3)*.7 + s0*.3, q = 2*fr(u + .5) - 1, s3 = Math.sqrt(Math.max(0, 1 - q*q)), s4 = s0*.3 + .7*Math.floor(s0*3 + .5)/3;
  return (s0*w[0] + s1*w[1] + s2*w[2] + s3*w[3] + s4*stp)/(w[0] + w[1] + w[2] + w[3] + stp + 1e-4);
}
// layer k's crest at x (0 far .. NW-1 near)
function crest(x, k, t, S, A, B){
  const n = k/(NW - 1), f = 9 - 7.4*Math.pow(n, .7), amp = (.012 + .15*Math.pow(n, 1.8))*(1 + A[3]*.9)*(1 + (B[0] - 1)*n);
  const q = x*f + k*1.93 + S.D*.71 + t*(.05 + .09*n)*(k % 2 ? -1 : 1), u = fr(q);
  let y = HOR - .015 - .4*Math.pow(n, 1.4) + amp*(prof(u, S.w, S.st) - .5) + amp*.25*Math.sin(x*f*.41 + k);
  y += A[3]*.012*n*Math.sin(t*.7 + k);                              // the swell lifts the near waves
  if (S.tear > 0) y += S.tear*(vn(x*50 + k*7) - .5);
  if (k >= NW - 2 && B[2] < 1) { const g = B[2], xg = -1.2 + g*2.6, d = x - xg, e = Math.sin(Math.PI*Math.min(1, g*1.2));   // the great wave
    y += .14*e*(k === NW - 1 ? 1 : .45)*Math.exp(-Math.pow(d/(d > 0 ? .1 : .4), 2)); }
  return y;
}
const f3 = v => v.map(x => x.toFixed(4)).join(',');
export default {
  key: 'sea', kind: 'world', label: 'Paper sea',
  light: {hue: .08, sat: .35, x: .4, y: .6},              // low sun or dusk light, from the side
  horizonY: HOR,
  // calm, spacious, melodic music; a warm low end suits the swell
  suits: (rf, T) => -rf.perc*.4 + rf.low*.3 + rf.mid*.2 - T*.3 - (rf.hat || 0)*.3,
  onBeat(){ st.kick = 1; },
  params(P, x){
    const C = TUNE.sea, J = x.J, on = P.w.sea > .05;
    if (force === null) sectionLayout(st, 'seaD', J, on, x.dt, C.morphSecs);
    st.lvl += ((J ? J.tension : .4) - st.lvl)*Math.min(1, x.dt*.4);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (on) { st.great = 0; st.flare = 1; } }
    st.great = st.hold != null ? st.hold : Math.min(1, st.great + x.dt/C.greatSecs); if (st.hold != null) st.flare = 1; st.flare = Math.max(0, st.flare - x.dt/1.5);
    st.kick *= Math.exp(-x.dt*5); st.hat += (L.hat - st.hat)*Math.min(1, x.dt*3);
    st.flap += x.dt*(3 + 5*st.lvl);   // the gulls' wings
    st.sw += ((x.sBass || 0)*x.react - st.sw)*Math.min(1, x.dt*1.5);   // the swell, eased
    cur = blend();
    P.seaA = [cur.D, cur.tear, cur.inner, st.sw];
    P.seaB = [1 + C.bigWave*st.lvl, st.flare, st.great, st.kick];
    P.seaW = cur.w; P.seaS = [cur.st, cur.sun, cur.cloud, 0];
    P.seaK = cur.c.flat(); P.seaD = [st.D0, st.D1, cur.m, st.hat]; P.seaE = [cur.gulls, cur.boat, st.flap, BOAT_K];
  },
  glsl: {
    uniforms: 'uniform vec4 uSeaA,uSeaB,uSeaW,uSeaS,uSeaD,uSeaE; uniform vec3 uSeaK[6];',
    functions: `
float seaProf(float u){
  vec4 w=uSeaW; float stp=uSeaS.x;
  float s0=0.5+0.5*cos(u*6.2831853), v=u<0.72 ? u/0.72 : (1.0-u)/0.28, s1=pow(v,2.2);
  float s2=pow(1.0-abs(sin(3.14159265*u)),1.3)*0.7+s0*0.3, q=2.0*fract(u+0.5)-1.0, s3=sqrt(max(0.0,1.0-q*q)), s4=s0*0.3+0.7*floor(s0*3.0+0.5)/3.0;
  return (s0*w.x+s1*w.y+s2*w.z+s3*w.w+s4*stp)/(w.x+w.y+w.z+w.w+stp+1e-4);
}
float seaCrest(float x,float k){
  float n=k/${(NW - 1).toFixed(1)}, f=9.0-7.4*pow(n,0.7), amp=(0.012+0.15*pow(n,1.8))*(1.0+uSeaA.w*0.9)*(1.0+(uSeaB.x-1.0)*n);
  float q=x*f+k*1.93+uSeaA.x*0.71+uTime*(0.05+0.09*n)*(mod(k,2.0)>0.5 ? -1.0 : 1.0);
  float y=${HS}-0.015-0.4*pow(n,1.4)+amp*(seaProf(fract(q))-0.5)+amp*0.25*sin(x*f*0.41+k);
  y+=uSeaA.w*0.012*n*sin(uTime*0.7+k);
  if(uSeaA.y>0.0){ float xi=x*50.0+k*7.0, i0=floor(xi), fx=fract(xi); fx=fx*fx*(3.0-2.0*fx);
    y+=uSeaA.y*(mix(fract(sin(i0*127.1)*43758.5453),fract(sin((i0+1.0)*127.1)*43758.5453),fx)-0.5); }
  if(k>${(NW - 2.5).toFixed(1)}&&uSeaB.z<1.0){ float g=uSeaB.z, d=x-(-1.2+g*2.6), e=sin(3.14159265*min(1.0,g*1.2));
    y+=0.14*e*(k>${(NW - 1.5).toFixed(1)} ? 1.0 : 0.45)*exp(-pow(d/(d>0.0 ? 0.1 : 0.4),2.0)); }
  return y;
}
float seaCloud1(vec2 sp,float i,float D){   // a band of paper clouds (each section its own): scalloped tops on a flat base; above 0 inside
  float h1=hash(vec2(D,i)), h2=hash(vec2(i,D+3.0)), w=0.06+0.07*h1, x=sp.x+uTime*(0.006+0.004*i)+i*3.1+D, c=floor(x/w), u=fract(x/w)*2.0-1.0;
  float r=0.35+0.65*hash(vec2(c,i*7.0+D)), on=step(0.5-uSeaS.z*0.4,fract(sin(floor(x/(w*(3.0+h2*4.0)))*91.3+i+D)*437.5));
  float base=0.06+i*(0.08+0.06*h2)+0.04*h1, top=base+w*0.55*r*sqrt(max(0.0,1.0-u*u));
  return on*min(sp.y-base+0.02, top-sp.y);
}
float seaCloud(vec2 sp,float i){ float a=seaCloud1(sp,i,uSeaD.x); return uSeaD.z<0.01 ? a : mix(a,seaCloud1(sp,i,uSeaD.y),uSeaD.z); }
vec3 seaSky(vec2 sp){
  float t=clamp((sp.y-${HS})/0.55,0.0,1.0);
  vec3 c=mix(uSeaK[1],uSeaK[0],pow(t,0.7));
  float dark=smoothstep(0.2,0.04,dot(uSeaK[0],vec3(0.3,0.5,0.2)));   // stars, when the sky is dark enough
  if(dark>0.0){ vec2 g=sp*80.0, cell=floor(g); float h=hash(cell);
    c+=vec3(0.85,0.9,1.0)*dark*step(0.985,h)*smoothstep(0.3,0.0,length(fract(g)-0.5))*smoothstep(0.1,0.5,t)*(0.6+0.4*sin(uTime*1.7+h*50.0)); }
  // the sun, a paper disc cut with bands, sitting on the horizon (not every sea has one)
  vec2 sc=vec2(0.18*ASP,${HS}+0.07); float ds=length(sp-sc);
  if(uSeaS.y>0.01){
    c+=uSeaK[5]*exp(-ds*4.0)*0.35*uSeaS.y;
    float disc=smoothstep(0.155,0.15,ds)*step(0.05,sp.y-${HS}+0.05);
    float band=step(0.35,fract((sc.y-sp.y)*26.0))+step(sp.y,sc.y);
    disc*=mix(1.0,band,smoothstep(sc.y+0.02,sc.y-0.04,sp.y));
    c=mix(c,mix(uSeaK[5],uSeaK[4],0.25+0.3*smoothstep(-0.15,0.15,sp.y-sc.y)),disc*uSeaS.y);
  }
  // three bands of paper clouds, far to near, each lighter on top and casting a shadow below
  for(int j=0;j<3;j++){ float i=float(j), d=seaCloud(sp,i), ds2=seaCloud(sp+vec2(-0.006,0.012),i);
    c*=1.0-0.25*smoothstep(0.0,0.01,ds2)*step(d,0.0);
    vec3 cc=mix(mix(uSeaK[1],uSeaK[4],0.55-i*0.12),uSeaK[0],0.18*i);
    c=mix(c,cc*(0.92+0.1*smoothstep(0.0,0.03,d)),smoothstep(0.0,0.002,d)); }
  // paper gulls gliding across, their wings beating
  if(uSeaE.x>0.01) for(int j=0;j<4;j++){ float i=float(j), gx=(fract(uTime*0.012*(1.0+i*0.3)+i*0.29)-0.5)*ASP*1.3, gy=0.2+0.12*hash(vec2(i,9.0))+0.02*sin(uTime*0.3+i);
    vec2 q=(sp-vec2(gx,gy))/(0.018+0.01*hash(vec2(i,3.0))); float fl=sin(uSeaE.z+i*1.7);
    float wing=q.y-(abs(q.x)*(0.35+0.5*fl)-0.25*abs(q.x)*abs(q.x)*(1.0+fl));
    c=mix(c,uSeaK[3]*0.6,uSeaE.x*smoothstep(0.22,0.1,abs(wing))*step(abs(q.x),1.0)); }
  return c*paper(sp);
}
vec4 seaBoat(vec2 sp){   // a small paper boat riding a wave, tilting with it: a hull and a sail
  float bx=0.3*ASP*sin(uTime*0.02)-0.1, y0=seaCrest(bx,${BOAT_K}.0), sl=(seaCrest(bx+0.02,${BOAT_K}.0)-seaCrest(bx-0.02,${BOAT_K}.0))/0.04, a=atan(sl)*0.7;
  vec2 q=sp-vec2(bx,y0-0.004); q=vec2(cos(a)*q.x+sin(a)*q.y,-sin(a)*q.x+cos(a)*q.y); q/=0.085;
  float hull=step(-0.12,q.y)*step(q.y,0.12)*step(abs(q.x),0.55+q.y*1.5);
  float sail=step(0.12,q.y)*step(q.y,1.0)*step(0.0,q.x+0.05)*step(q.x,0.5*(1.0-q.y));
  if(hull>0.5) return vec4(mix(uSeaK[4],uSeaK[3],0.2)*(0.85+0.15*step(0.0,q.y)),1.0);
  if(sail>0.5) return vec4(mix(uSeaK[5],uSeaK[4],0.3)*(0.8+0.2*step(0.2,q.x)),1.0);
  return vec4(0.0);
}
vec4 seaGreat(vec2 sp){   // the drop's great wave: a crescent of water whose lip curls over, its rim breaking into claws of foam
  if(uSeaB.z>=1.0) return vec4(0.0);
  float g=uSeaB.z, e=sin(3.14159265*min(1.0,g*1.2)), gx=-1.2+g*2.6, R=0.26*e;
  if(R<0.01) return vec4(0.0);
  float yb=seaCrest(gx,${(NW - 1).toFixed(1)});
  vec2 co=vec2(gx-R*0.1,yb+R*0.5), ci=vec2(gx+R*0.3,yb+R*0.38); float dO=length(sp-co), dI=length(sp-ci), rI=R*0.64;
  if(dO>R||sp.y<yb-0.02||(dI<rI&&sp.y>yb+R*0.02)) return vec4(0.0);
  float a=atan(sp.y-co.y,sp.x-co.x), rim=R-dO, inner=dI-rI;
  vec3 col=mix(mix(uSeaK[3],uSeaK[2],0.35),uSeaK[3]*0.7,smoothstep(0.0,R*0.5,rim));
  col=mix(col,col*0.8,step(0.8,fract(rim*70.0)));   // lines following the curl
  col*=1.0-0.35*exp(-max(inner,0.0)*50.0);           // shade inside the hollow's edge
  float up=smoothstep(-0.6,0.4,a)*smoothstep(3.0,2.2,a);
  float claw=step(0.4,fract(a*7.0+rim*45.0));        // the lip's foam, in claws
  col=mix(col,uSeaK[4],smoothstep(0.012+0.03*claw*up,0.004,rim)*up);
  return vec4(col*paper(sp),1.0);
}
vec3 sea(vec2 sp){
  vec4 gw=seaGreat(sp); if(gw.w>0.0) return gw.rgb;
  float yf=-9.0;   // the crest of the layer in front, for its shadow
  for(int i=${NW - 1};i>=0;i--){
    float k=float(i), cy=seaCrest(sp.x,k);
    if(i==${BOAT_K}&&uSeaE.y>0.5){ vec4 b=seaBoat(sp); if(b.w>0.0) return b.rgb*paper(sp); }
    if(sp.y<cy){
      float n=k/${(NW - 1).toFixed(1)}, depth=cy-sp.y;
      vec3 base=mix(uSeaK[2],uSeaK[3],pow(n,0.8));
      vec3 col=mix(mix(base,uSeaK[4],0.25-0.1*n),base*0.72,smoothstep(0.0,0.03+0.1*n,depth));   // lit near the crest, deep below
      if(uSeaA.z>0.5){ float l=fract(depth*(60.0-30.0*n)); col=mix(col,col*0.86,step(0.85,l)*smoothstep(0.01,0.03,depth)); }   // inner cut lines
      float fw=0.004+0.006*n+0.004*uSeaB.w;   // the foam rim
      col=mix(col,uSeaK[4],smoothstep(fw,fw*0.4,depth)*(0.85+0.15*vnz(vec2(sp.x*80.0,k))));
      col=mix(col,uSeaK[4],0.6*step(0.975-0.04*uSeaD.w,hash(floor(vec2(sp.x*160.0,depth*260.0))+floor(uTime*6.0*uSeaD.w)))*smoothstep(0.025,0.006,depth));   // flecks of foam, sparkling with the hats
      if(uSeaS.y>0.01){ float px=(sp.x-0.18*ASP)/(0.05+(${HS}-sp.y)*0.3);   // the sun's light on the faces, strongest just under each crest
        col=mix(col,mix(uSeaK[5],uSeaK[4],0.3),0.45*exp(-px*px*3.0)*smoothstep(0.08,0.01,depth)*uSeaS.y); }
      if(yf>-8.0){ float up=sp.y-seaCrest(sp.x-0.008,k+1.0); col*=1.0-0.4*exp(-max(up,0.0)*55.0); }   // the shadow of the wave in front
      return col*paper(sp+k);
    }
    yf=cy;
  }
  vec3 c=seaSky(sp);
  float up=sp.y-seaCrest(sp.x-0.008,0.0); c*=1.0-0.25*exp(-max(up,0.0)*80.0);   // the far sea's shadow on the sky
  if(uSeaB.y>0.02){ float above=sp.y-seaCrest(sp.x,${(NW - 1).toFixed(1)});   // spray off the great wave
    if(above>0.0&&above<0.16*uSeaB.y) c=mix(c,uSeaK[4],step(0.88,hash(floor(sp*110.0)+floor(uTime*9.0)))*uSeaB.y); }
  return c;
}`,
    fn: 'sea',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uSeaA, P.seaA); gl.uniform4fv(u.uSeaB, P.seaB); gl.uniform4fv(u.uSeaW, P.seaW); gl.uniform4fv(u.uSeaS, P.seaS); gl.uniform4fv(u.uSeaD, P.seaD); gl.uniform4fv(u.uSeaE, P.seaE);
    if (u['uSeaK[0]']) gl.uniform3fv(u['uSeaK[0]'], P.seaK); },
  // its front plane: the nearest wave
  front: {
    fn: 'seaFront',
    glsl: `
float seaFront(vec2 sp){ return sp.y<seaCrest(sp.x,${(NW - 1).toFixed(1)}) ? 1.0 : 0.0; }`,
    path2d(o, P, t){
      if (!cur) return;
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
      o.moveTo(0, H); for (let j = 0; j <= 120; j++) { const xs = (j/120 - .5)*asp; o.lineTo(X(xs), Y(crest(xs, NW - 1, t, cur, P.seaA, P.seaB))); }
      o.lineTo(W, H); o.closePath();
    },
  },
  draw2d(o, P, t){
    if (!cur) return;
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.sea);
    const K = cur.c, rgb = (c, m = 1) => `rgb(${c.map(v => Math.round(Math.min(1, v*m)*255)).join(',')})`, mix = (p, q, m) => p.map((v, i) => v + (q[i] - v)*m);
    o.save(); o.globalAlpha = a;
    const sky = o.createLinearGradient(0, Y(.55), 0, Y(HOR)); sky.addColorStop(0, rgb(K[0], .9)); sky.addColorStop(1, rgb(K[1], .82));   // (a little darker: simple mode's glow would wash it out)
    o.fillStyle = sky; o.fillRect(0, 0, W, Y(HOR) + 2);
    if (cur.sun > .01) {   // the banded paper sun
      const sx = X(.18*asp), sy = Y(HOR + .07), R = .15*u, g = o.createRadialGradient(sx, sy, 0, sx, sy, R*3);
      g.addColorStop(0, `rgba(${K[5].map(v => Math.round(v*255)).join(',')},${(.35*cur.sun).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = g; o.fillRect(0, 0, W, Y(HOR));
      o.save(); o.beginPath(); o.rect(0, 0, W, Y(HOR)); o.clip(); o.globalAlpha = a*cur.sun; o.fillStyle = rgb(mix(K[5], K[4], .35));
      o.beginPath(); o.arc(sx, sy, R, Math.PI, 0); o.fill();
      for (let b = 0; b < 6; b++) { const y0 = sy + b*R*.16 + R*.04, h = R*.1*(1 - b*.1); o.fillRect(sx - R, y0, 2*R, h); }
      o.restore();
    }
    const D = cur.m < .5 ? st.D0 : st.D1, h2d = (a, b) => fr(Math.sin(a*127.1 + b*311.7)*43758.5453);
    for (let i = 0; i < 3; i++) {   // paper clouds (each section its own): scalloped tops, a shadow under each
      const h1 = h2d(D, i), h2 = h2d(i, D + 3), w = .06 + .07*h1, base = .06 + i*(.08 + .06*h2) + .04*h1, cc = mix(mix(K[1], K[4], .55 - i*.12), K[0], .18*i);
      o.fillStyle = rgb(cc); o.shadowColor = 'rgba(0,0,0,.22)'; o.shadowOffsetY = .012*u; o.shadowOffsetX = .006*u; o.shadowBlur = .01*u;
      const off = t*(.006 + .004*i) + i*3.1 + D, gw = w*(3 + h2*4);
      for (let c = Math.floor((-asp/2 + off)/w) - 1; c <= Math.ceil((asp/2 + off)/w) + 1; c++) {
        if (fr(Math.sin(Math.floor((c + .5)*w/gw)*91.3 + i + D)*437.5) < .5 - cur.cloud*.4) continue;
        const r = .35 + .65*h2d(c, i*7 + D), cx = X((c + .5)*w - off);
        o.beginPath(); o.ellipse(cx, Y(base), w*u*.5, w*.55*r*u, 0, Math.PI, 0); o.fill();
      }
      o.shadowColor = 'transparent';
    }
    if (cur.gulls > .01) { o.strokeStyle = rgb(K[3], .6); o.lineWidth = Math.max(1, .004*u); o.globalAlpha = a*cur.gulls;   // paper gulls
      for (let i = 0; i < 4; i++) { const h = (a2, b2) => fr(Math.sin(a2*127.1 + b2*311.7)*43758.5453), gx = (fr(t*.012*(1 + i*.3) + i*.29) - .5)*asp*1.3, gy = .2 + .12*h(i, 9) + .02*Math.sin(t*.3 + i);
        const sz = (.018 + .01*h(i, 3))*u, fl = Math.sin(P.seaE[2] + i*1.7), d = (.35 + .5*fl)*sz;
        o.beginPath(); o.moveTo(X(gx) - sz, Y(gy) - d); o.quadraticCurveTo(X(gx) - sz*.4, Y(gy) - d*.2, X(gx), Y(gy)); o.quadraticCurveTo(X(gx) + sz*.4, Y(gy) - d*.2, X(gx) + sz, Y(gy) - d); o.stroke(); }
      o.globalAlpha = a; }
    for (let k = 0; k < NW; k++) {   // the waves, far to near, each with its shadow on the one behind
      const n = k/(NW - 1), pts = []; for (let j = 0; j <= 150; j++) { const xs = (j/150 - .5)*asp; pts.push([X(xs), Y(crest(xs, k, t, cur, P.seaA, P.seaB))]); }
      const top = Math.min(...pts.map(p => p[1])), base = mix(K[2], K[3], Math.pow(n, .8)), g = o.createLinearGradient(0, top, 0, top + (.04 + n*.12)*u);
      g.addColorStop(0, rgb(mix(base, K[4], .25 - .1*n))); g.addColorStop(1, rgb(base, .72));
      o.shadowColor = 'rgba(0,0,0,.4)'; o.shadowBlur = .02*u; o.shadowOffsetY = -.006*u; o.shadowOffsetX = .008*u;
      o.fillStyle = g; o.beginPath(); o.moveTo(0, H); for (const [x, y] of pts) o.lineTo(x, y); o.lineTo(W, H); o.fill();
      o.shadowColor = 'transparent';
      o.strokeStyle = rgb(K[4], .85); o.lineWidth = Math.max(1, (.003 + .004*n + .003*P.seaB[3])*u);
      o.beginPath(); pts.forEach(([x, y], j) => j ? o.lineTo(x, y + o.lineWidth/2) : o.moveTo(x, y + o.lineWidth/2)); o.stroke();
      if (cur.sun > .01) { o.fillStyle = rgb(K[5]); o.globalAlpha = a*.6*cur.sun;   // the sun's glints: short strips on the faces
        for (let q = 0; q < 10; q++) { const gx = X(.18*asp + (h2d(q, k + Math.floor(t*2)) - .5)*(.08 + n*.25)), gy = top + (.01 + h2d(k, q)*(.03 + n*.08))*u;
          o.fillRect(gx, gy, (.01 + .03*n)*u, Math.max(1, .004*u)); }
        o.globalAlpha = a; }
      if (k === BOAT_K && cur.boat > .5) {   // the paper boat, riding this wave
        const bx = .3*asp*Math.sin(t*.02) - .1, y0 = crest(bx, k, t, cur, P.seaA, P.seaB), sl = (crest(bx + .02, k, t, cur, P.seaA, P.seaB) - crest(bx - .02, k, t, cur, P.seaA, P.seaB))/.04, s3 = .085*u;
        o.save(); o.translate(X(bx), Y(y0 - .004)); o.rotate(-Math.atan(sl)*.7);
        o.fillStyle = rgb(mix(K[4], K[3], .2)); o.beginPath(); o.moveTo(-.73*s3, -.12*s3); o.lineTo(.73*s3, -.12*s3); o.lineTo(.37*s3, .12*s3); o.lineTo(-.37*s3, .12*s3); o.fill();
        o.fillStyle = rgb(mix(K[5], K[4], .3)); o.beginPath(); o.moveTo(-.05*s3, -.12*s3); o.lineTo(-.05*s3, -s3); o.lineTo(.45*s3, -.12*s3); o.fill(); o.restore(); }
      if (k === NW - 1 && P.seaB[2] < 1) {   // the great wave's crest breaking into claws of foam
        const g = P.seaB[2], xg = -1.2 + g*2.6, e = Math.sin(Math.PI*Math.min(1, g*1.2)); o.fillStyle = rgb(K[4]);
        for (let q = 0; q < 26; q++) { const xs = xg - .02 + (q/26 - .8)*.3, y = crest(xs, k, t, cur, P.seaA, P.seaB), s2 = e*Math.exp(-Math.pow(xs - xg, 2)*12);
          if (s2 < .05) continue; o.beginPath(); o.arc(X(xs), Y(y) + .01*u, .012*u*s2, 0, Math.PI*2); o.fill(); } }
    }
    if (P.seaB[2] < 1) {   // the great wave: a crescent whose lip curls over, foam on its rim
      const g = P.seaB[2], e = Math.sin(Math.PI*Math.min(1, g*1.2)), gx = -1.2 + g*2.6, R = .26*e;
      if (R > .01) { const yb = crest(gx, NW - 1, t, cur, P.seaA, P.seaB), co = [gx - R*.1, yb + R*.5], ci = [gx + R*.3, yb + R*.38];
        o.save(); o.beginPath(); o.rect(0, 0, W, Y(yb - .02)); o.clip();
        o.beginPath(); o.arc(X(co[0]), Y(co[1]), R*u, 0, Math.PI*2); o.moveTo(X(ci[0]) + R*.64*u, Y(ci[1])); o.arc(X(ci[0]), Y(ci[1]), R*.64*u, 0, Math.PI*2, true);
        const gg = o.createRadialGradient(X(co[0]), Y(co[1]), R*.3*u, X(co[0]), Y(co[1]), R*u); gg.addColorStop(0, rgb(K[3], .7)); gg.addColorStop(1, rgb(mix(K[3], K[2], .35)));
        o.fillStyle = gg; o.fill('evenodd');
        o.fillStyle = rgb(K[4]); for (let q = 0; q < 18; q++) { const an = -.5 + q/17*2.9, rr = R*(.97 - (q % 2)*.04);
          o.beginPath(); o.arc(X(co[0] + Math.cos(an)*rr), Y(co[1] + Math.sin(an)*rr), (.008 + (q % 3)*.006)*u*e, 0, Math.PI*2); o.fill(); }
        o.restore(); }
    }
    if (P.seaB[1] > .02) { o.fillStyle = rgb(K[4]); o.globalAlpha = a*P.seaB[1];   // spray off the great wave
      for (let q = 0; q < 80; q++) { const xs = (fr(Math.sin(q*12.9 + Math.floor(t*9))*437.5) - .5)*asp, y = crest(xs, NW - 1, t, cur, P.seaA, P.seaB);
        o.fillRect(X(xs), Y(y + fr(Math.sin(q*78.2)*437.5)*.16*P.seaB[1]), 2, 2); } }
    o.restore();
  },
};
