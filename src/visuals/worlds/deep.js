// The paper reef: looking into a lagoon cut from paper. Five layers of reef (rock mounds, sea fans cut with ribs,
// branching coral, tube sponges, swaying seaweed) step from pale in the far haze to rich coral near, each casting a soft
// shadow on the one behind and catching the light from the surface on its upper edges. A school of paper fish swims
// through the middle, turning together; on a drop it gathers into a spinning bait ball. Jellyfish drift and pulse on the
// kick, shafts of light slant down (brighter with the mids, flaring on a drop), bubbles rise livelier with the hi-hats.
// Each section brings its own reef and colours (a lagoon, the abyss glowing with life, golden shallows, an emerald kelp
// bed, a violet twilight), grown out of the old one. The user found the first underwater world flat.
import { hc, sectionLayout } from '../../util.js';
import { L } from '../../audio/listen.js';
import { TUNE } from '../../tuning.js';

const SURF = .4, FLOOR = -.3, NL = 5, NF = 16, FISH_K = 2;   // the surface; the floor (for the horizon grid); layers; fish; the layer the fish swim in front of
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)/255);
// palettes: water at the surface, water in the deep, far reef, near reef, coral A, coral B, light, and how much things glow
const PALS = [
  {name: 'lagoon',  c: ['#8ff0e6', '#0a4f6e', '#7fc6c8', '#1b3a52', '#ff7a6b', '#ffb347', '#ffffff'], glow: 0},
  {name: 'abyss',   c: ['#1d3b7a', '#02030d', '#23305e', '#050814', '#ff3fa4', '#35f2ff', '#9fd8ff'], glow: 1},
  {name: 'shallow', c: ['#fff0b3', '#1a7f86', '#e3c98a', '#224b52', '#ff8c5a', '#f25f5c', '#fff8e0'], glow: 0},
  {name: 'kelp',    c: ['#a8e6a1', '#06302b', '#6fa888', '#0d2a24', '#f6c85f', '#9dd66b', '#f0ffe0'], glow: 0},
  {name: 'twilight',c: ['#b39ddb', '#120b2e', '#8a79b8', '#1c1440', '#ff8fb1', '#7ee8fa', '#fde7ff'], glow: .6},
].map(p => ({...p, c: p.c.map(hex)}));
const fr = v => v - Math.floor(v), rnd = (D, s) => fr(Math.sin(D*127.1 + s*311.7)*43758.5453), rnd1 = i => fr(Math.sin(i*91.7)*43758.5453);
// a section's reef: palette, and how much of each form (seaweed, fans, branching coral, tubes)
function style(D){ const w = [.4, .4, .4, .4].map((v, i) => rnd(D, 10 + i) < .5 ? .15 : 1); return {pal: PALS[Math.floor(rnd(D, 3)*PALS.length)], w}; }
const lerp = (a, b, m) => a + (b - a)*m, lerp3 = (a, b, m) => a.map((v, i) => lerp(v, b[i], m));
const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, flare: 0, drops: 0, h: 0, kick: 0, ball: 0, fx: 0, fy: 0, fa: 0, fdir: 1, bar: 0};
let cur = null, force = null;
export function deepForce(D, ball){ force = D; st.D0 = st.D1 = D; st.tr = 1; if (ball != null) st.ballHold = ball; }
function blend(){
  const m0 = Math.min(1, st.tr), m = m0*m0*(3 - 2*m0), a = style(st.D0), b = style(st.D1);
  return {m, w: a.w.map((v, i) => lerp(v, b.w[i], m)), glow: lerp(a.pal.glow, b.pal.glow, m), c: a.pal.c.map((c, i) => lerp3(c, b.pal.c[i], m))};
}
const bubbles = Array.from({length: 40}, (_, i) => ({x: rnd1(i) - .5, y: rnd1(i + 99) - .5, r: .003 + rnd1(i + 7)*.008, v: .05 + rnd1(i + 3)*.08}));
// layer k's ground (0 far .. NL-1 near) in layout D: a line with rounded mounds on it
const ground = (x, k, D) => { const w = .16 - .02*k, c = Math.floor((x + D)/w), u = fr((x + D)/w)*2 - 1, r = .3 + .7*rnd(c, k*7 + D);
  return -.1 - .075*k + .03*Math.sin(x*(2.2 + k*.6) + k*1.7 + D) + w*.35*r*Math.sqrt(Math.max(0, 1 - u*u)); };
// the fish: where each one is this frame (the school's centre, heading, and each fish in its formation)
function fishAt(i, P){
  const [cx, cy, ang, ball] = P.deepF, [ph] = P.deepG, h1 = rnd1(i*3.1 + 1), h2 = rnd1(i*7.3 + 2);
  const ox = (h1 - .5)*.3, oy = (h2 - .5)*.12, ca = Math.cos(ang), sa = Math.sin(ang);
  const sx = cx + ox*ca - oy*sa, sy = cy + ox*sa + oy*ca;
  const ra = i/NF*Math.PI*2 + ph*1.4, rr = .09 + .03*h1, bx = cx + Math.cos(ra)*rr*1.3, by = cy + Math.sin(ra)*rr*.8;
  return [sx + (bx - sx)*ball, sy + (by - sy)*ball, ang + (ra + Math.PI/2 - ang)*ball];
}
export default {
  key: 'deep', kind: 'world', label: 'Paper reef',
  light: {hue: .5, sat: .5, x: 0, y: 1},                // light from the surface above
  horizonY: FLOOR,
  // calm, washed, melodic music; noisy textures read as the water
  suits: (rf, T) => -rf.perc*.5 + (rf.noise || 0)*.3 + rf.mid*.2 - T*.4,
  onBeat(pos){ st.kick = 1; if (pos === 0 && ++st.bar % 2 === 0) st.fdir *= -1; },   // the school turns every other bar
  params(P, x){
    const C = TUNE.deep, J = x.J, on = P.w.deep > .05;
    if (force === null) sectionLayout(st, 'deepD', J, on, x.dt, C.morphSecs);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (on) { st.flare = 1; st.ball = 1; } }
    st.flare = Math.max(0, st.flare - x.dt/1.5); st.ball = Math.max(0, st.ball - x.dt/C.ballSecs);
    st.kick *= Math.exp(-x.dt*4); st.h += (L.hat - st.h)*Math.min(1, x.dt*3);
    if (on) for (const b of bubbles) { b.y += x.dt*b.v*(1 + st.h*2.5); b.x += Math.sin(x.t*2 + b.v*40)*.0006;
      if (b.y > SURF) { b.y = FLOOR + rnd1(b.v*999 + x.t)*.1; b.x = (rnd1(b.r*999 + x.t) - .5)*x.asp; } }
    // the school: gliding on a slow figure through the middle, heading the way it's going (turning on the bar)
    const tt = x.t*.12, tx = Math.sin(tt)*.45*x.asp, ty = -.02 + .08*Math.sin(tt*1.7);
    st.fa += (Math.atan2(ty - st.fy, (tx - st.fx) || 1e-4)*0 + (st.fdir > 0 ? 0 : Math.PI) - st.fa)*Math.min(1, x.dt*2);
    st.fx += (tx - st.fx)*Math.min(1, x.dt*.8); st.fy += (ty - st.fy)*Math.min(1, x.dt*.8);
    const ball = st.ballHold != null ? st.ballHold : Math.sin(Math.PI*Math.min(1, st.ball*1.1))**.5*(st.ball > 0 ? 1 : 0);
    cur = blend();
    P.deepBubbles = bubbles;
    P.deepA = [st.D0, st.D1, cur.m, (x.sBass || 0)*x.react*C.sway];
    P.deepB = [st.h, st.flare*st.flare, P.mid*x.react, st.kick];
    P.deepW = cur.w; P.deepK = cur.c.flat();
    P.deepF = [st.fx, st.fy, st.fa, ball]; P.deepG = [x.t, cur.glow, 0, 0];
  },
  glsl: {
    uniforms: 'uniform vec4 uDeepA,uDeepB,uDeepW,uDeepF,uDeepG; uniform vec3 uDeepK[7];',
    functions: `
float deepGround(float x,float k,float D){ float w=0.16-0.02*k, c=floor((x+D)/w), u=fract((x+D)/w)*2.0-1.0, r=0.3+0.7*fract(sin(c*127.1+(k*7.0+D)*311.7)*43758.5453);
  return -0.1-0.075*k+0.03*sin(x*(2.2+k*0.6)+k*1.7+D)+w*0.35*r*sqrt(max(0.0,1.0-u*u)); }
// layer k in layout D at p: 0 open water, else what covers it (1 rock, 2 seaweed, 3 fan, 4 coral, 5 tube)
float deepCov1(vec2 p,float k,float D){
  float g=deepGround(p.x,k,D);
  if(p.y<g) return 1.0;
  float n=k/${(NL - 1).toFixed(1)}, fw=0.11+0.09*n, up=p.y-g;
  float lean=(sin(p.y*6.0+uDeepG.x*1.1+k)*0.015+uDeepA.w*(0.4+n)*sin(uDeepG.x*0.8+k*1.3))*min(up*3.0,1.0);
  float s=floor((p.x-lean)/fw), h1=hash(vec2(s,k*13.0+D)), h2=hash(vec2(s+7.0,k+D*3.0)), c=(s+0.5+(h1-0.5)*0.4)*fw, gb=deepGround(c,k,D), sc=0.8+1.6*n;
  // which form grows in this slot, by the reef's own mix
  vec4 w=uDeepW; float tot=w.x+w.y+w.z+w.w+1.8, pick=h2*tot;
  if(pick<w.x){ float h=(0.12+0.25*h1)*sc, y=p.y-gb, x=p.x-lean-c;   // seaweed: a ribbon with leaves, swaying
    if(y<0.0||y>h) return 0.0; float wd=0.011*sc*(1.0-0.75*y/h)*(1.0+0.25*sin(y*20.0/sc+h1*9.0));
    return abs(x)<wd ? 2.0 : 0.0; }
  pick-=w.x;
  if(pick<w.y){ float R=(0.04+0.04*h1)*sc; vec2 q=vec2(p.x-lean*0.3-c,p.y-gb-R*0.25);   // a sea fan: a disc cut with ribs, on a stalk
    float r=length(q), a=atan(q.y,q.x);
    if(abs(q.x)<0.003*sc&&q.y<0.0&&q.y>-R*0.3) return 3.0;
    if(r<R&&q.y>0.0&&fract((a/3.14159265)*9.0)>0.14+0.1*(1.0-r/R)) return 3.0;
    return 0.0; }
  pick-=w.y;
  if(pick<w.z){ for(int j=0;j<3;j++){ float fj=float(j)-1.0, xj=c+fj*0.013*sc+lean*0.2, hj=(0.05+0.07*hash(vec2(s+fj,k+D)))*sc, wj=0.0045*sc;   // branching coral: rounded fingers
      if(abs(p.x-xj)<wj&&p.y<gb+hj&&p.y>gb-0.01) return 4.0; if(length(vec2(p.x-xj,p.y-gb-hj))<wj*1.25) return 4.0; }
    return 0.0; }
  pick-=w.z;
  if(pick<w.w){ for(int j=0;j<2;j++){ float fj=float(j), xj=c+(fj-0.5)*0.022*sc, hj=(0.04+0.05*hash(vec2(s+fj*3.0,k*2.0+D)))*sc, y=p.y-gb;   // vase sponges, open at the top
      float wj=0.0065*sc*(0.7+0.5*clamp(y/hj,0.0,1.0));
      if(abs(p.x-xj)<wj&&y<hj&&y>-0.01) return abs(p.x-xj)<wj*0.6&&y>hj-wj*0.7 ? 1.5 : 5.0; }
    return 0.0; }
  return 0.0;
}
float deepCov(vec2 p,float k){   // (a new reef grows in: the old layer sinks away as the new one rises, nearest first)
  float m=clamp(uDeepA.z*1.6-(${(NL - 1).toFixed(1)}-k)*0.15,0.0,1.0), D=m<0.5 ? uDeepA.x : uDeepA.y;
  return deepCov1(vec2(p.x,p.y+(1.0-abs(m*2.0-1.0))*0.7),k,D);
}
vec3 deepWater(vec2 sp){
  float t=uDeepG.x, y=clamp((sp.y+0.5)/(${SURF.toFixed(3)}+0.5),0.0,1.0);
  vec3 c=mix(uDeepK[1],uDeepK[0],pow(y,1.3));
  float x0=sp.x+(${SURF.toFixed(3)}-sp.y)*0.35+0.03*sin(t*0.3);   // shafts of light, slanting down
  c+=uDeepK[6]*smoothstep(0.5,1.0,sin(x0*8.0+sin(x0*2.3)*1.5))*smoothstep(-0.45,${SURF.toFixed(3)},sp.y)*(0.08+0.12*uDeepB.z+0.3*uDeepB.y);
  return c;
}
vec3 deepFish(vec2 sp,vec3 col){   // the school: paper fish, two-tone, each with an eye; mid-water
  vec4 F=uDeepF; if(length((sp-F.xy)*vec2(0.6,1.0))>0.34) return col;
  for(int i=0;i<${NF};i++){ float fi=float(i), h1=fract(sin((fi*3.1+1.0)*91.7)*43758.5453), h2=fract(sin((fi*7.3+2.0)*91.7)*43758.5453);
    float ox=(h1-0.5)*0.3, oy=(h2-0.5)*0.12, ca=cos(F.z), sa=sin(F.z);
    vec2 s1=F.xy+vec2(ox*ca-oy*sa,ox*sa+oy*ca);
    float ra=fi/${NF.toFixed(1)}*6.2831853+uDeepG.x*1.4, rr=0.09+0.03*h1; vec2 b=F.xy+vec2(cos(ra)*rr*1.3,sin(ra)*rr*0.8);
    vec2 fp=mix(s1,b,F.w); float fa=mix(F.z,ra+1.5707963,F.w);
    vec2 q=sp-fp; q=vec2(cos(fa)*q.x+sin(fa)*q.y,-sin(fa)*q.x+cos(fa)*q.y)/(1.05+0.5*h2);
    q.y+=0.002*sin(uDeepG.x*14.0+fi+q.x*120.0);   // the body wags
    float body=length(q*vec2(1.0,2.4))-0.016, tail=step(q.x,-0.013)*step(-0.028,q.x)*step(abs(q.y),(-0.013-q.x)*0.9);
    if(body<0.0||tail>0.5){ vec3 fc=q.y>0.0 ? uDeepK[4] : mix(uDeepK[4],uDeepK[6],0.6);
      if(length(q-vec2(0.008,0.002))<0.0022) fc=vec3(0.05);
      return fc*(0.85+0.15*step(0.0,-body-0.004)); } }
  return col;
}
vec3 deep(vec2 sp){
  float t=uDeepG.x;
  for(int i=${NL - 1};i>=0;i--){
    float k=float(i), cv=deepCov(sp,k);
    if(i==${FISH_K}){ vec3 f=deepFish(sp,vec3(-1.0)); if(f.x>=0.0) return f*paper(sp); }
    if(cv>0.5){
      float n=k/${(NL - 1).toFixed(1)};
      vec3 base=mix(uDeepK[2],uDeepK[3],pow(n,0.8));
      vec3 tint=cv>4.5 ? mix(uDeepK[4],uDeepK[5],0.5) : cv>3.5 ? uDeepK[5] : cv>2.5 ? uDeepK[4] : cv>1.5 ? mix(uDeepK[3],uDeepK[5],0.4) : base;
      vec3 col=mix(base,tint,(cv>1.5 ? 0.25+0.6*n : 0.0));
      col=mix(col,deepWater(sp),0.35*(1.0-n));                                                   // far layers hazed by the water
      if(deepCov(sp+vec2(0.0,0.006),k)<0.5) col=mix(col,uDeepK[6],0.35+0.25*n);                 // the light on its upper edge
      else col*=0.78+0.22*smoothstep(-0.25,0.2,sp.y);
      if(i<${NL - 1}&&deepCov(sp+vec2(-0.006,0.016),k+1.0)>0.5) col*=0.62;                       // the shadow of the layer in front
      if(uDeepG.y>0.01&&cv>1.5) col+=tint*uDeepG.y*(0.25+0.5*uDeepB.w)*0.6;                      // (in the abyss, the reef glows)
      if(i==0&&cv<1.5){ vec2 q=sp*vec2(14.0,22.0)+vec2(t*0.3,0.0);                               // caustics on the far floor, on the kick
        float cs=abs(sin(q.x+sin(q.y*1.3+t)*1.2)*sin(q.y+sin(q.x*1.1-t*0.8)*1.2)); col+=uDeepK[6]*pow(1.0-cs,6.0)*(0.1+0.3*uBeat); }
      return col*paper(sp+k);
    }
  }
  vec3 c=deepWater(sp);
  // jellyfish drifting up, pulsing on the kick: a dome and trailing tentacles, glowing where the water's dark
  for(int j=0;j<3;j++){ float fj=float(j), jx=(fract(fj*0.37+t*0.004)-0.5)*ASP*0.9, jy=fract(fj*0.29+t*0.012)*0.9-0.45, s=0.04*(1.0+0.3*fj)*(1.0-0.18*uDeepB.w);
    vec2 q=(sp-vec2(jx+0.02*sin(t*0.5+fj),jy))/s; float dome=length(q*vec2(1.0,1.3+0.3*uDeepB.w))-1.0;
    vec3 jc=mix(uDeepK[5],uDeepK[6],0.4);
    if(dome<0.0&&q.y>-0.2) c=mix(c,jc,0.55+0.3*uDeepG.y);
    float ten=abs(fract(q.x*1.6+0.5)-0.5)-0.06*(1.0-q.y*0.1)+0.08*sin(q.y*3.0+t*3.0+fj);
    if(q.y<-0.1&&q.y>-3.2&&abs(q.x)<0.9&&abs(ten)<0.06) c=mix(c,jc,0.45*(1.0+q.y/3.2));
    c+=jc*uDeepG.y*exp(-max(dome,0.0)*1.5)*0.25; }
  // the silver surface overhead, rippling
  float sy=${SURF.toFixed(3)}+0.015*sin(sp.x*8.0+t*1.3)+0.008*sin(sp.x*19.0-t*2.1);
  if(sp.y>sy){ vec2 q=sp*vec2(10.0,30.0)+vec2(t*0.4,t*0.2); float cs=abs(sin(q.x+sin(q.y+t)*1.3)*sin(q.y*0.7+sin(q.x*0.9-t)*1.3));
    c=mix(mix(uDeepK[0],uDeepK[6],0.4),uDeepK[6],pow(1.0-cs,4.0)*0.7); }
  // bubbles rising in columns, livelier and brighter with the hi-hats
  for(int j=0;j<7;j++){ float fj=float(j), bx=(fract(sin(fj*37.1)*437.5)-0.5)*ASP, bq=(sp.y-t*(0.12+0.05*fj)*(1.0+uDeepB.x*2.0))*9.0;
    vec2 bp=vec2((sp.x-bx-0.01*sin(sp.y*20.0+fj))*9.0,fract(bq)-0.5); float br=0.07+0.07*fract(sin(floor(bq)*7.1+fj)*91.7);
    c+=uDeepK[6]*smoothstep(0.03,0.0,abs(length(bp)-br))*(0.3+0.5*uDeepB.x); }
  return c*paper(sp);
}`,
    fn: 'deep',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uDeepA, P.deepA); gl.uniform4fv(u.uDeepB, P.deepB); gl.uniform4fv(u.uDeepW, P.deepW);
    gl.uniform4fv(u.uDeepF, P.deepF); gl.uniform4fv(u.uDeepG, P.deepG); if (u['uDeepK[0]']) gl.uniform3fv(u['uDeepK[0]'], P.deepK); },
  // its front plane: the nearest layer of the reef
  front: {
    fn: 'deepFront',
    glsl: `
float deepFront(vec2 sp){ return deepCov(sp,${(NL - 1).toFixed(1)})>0.5 ? 1.0 : 0.0; }`,
    path2d(o, P, t){ const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, D = P.deepA[2] < .5 ? P.deepA[0] : P.deepA[1];
      o.moveTo(0, H); for (let j = 0; j <= 120; j++) { const x = (j/120 - .5)*asp; o.lineTo(X(x), Y(ground(x, NL - 1, D))); } o.lineTo(W, H); o.closePath(); },
  },
  draw2d(o, P, t){
    if (!cur) return;
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.deep);
    const K = cur.c, rgb = (c, m = 1) => `rgb(${c.map(v => Math.round(Math.min(1, v*m)*255)).join(',')})`, mix = (p, q, m) => p.map((v, i) => v + (q[i] - v)*m);
    const [hat, flare, mid, kick] = P.deepB, D = cur.m < .5 ? st.D0 : st.D1;
    o.save(); o.globalAlpha = a;
    const g = o.createLinearGradient(0, Y(SURF), 0, H); g.addColorStop(0, rgb(K[0], .9)); g.addColorStop(1, rgb(K[1]));
    o.fillStyle = g; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter'; o.fillStyle = rgb(K[6], .07*(1 + mid + 3*flare));   // shafts of light slanting down
    for (let i = -8; i < 8; i++) { const xs = i/8*1.2 + .03*Math.sin(t*.3);
      o.beginPath(); o.moveTo(X(xs - .03), Y(SURF)); o.lineTo(X(xs + .03), Y(SURF)); o.lineTo(X(xs + .03 - .3), Y(-.5)); o.lineTo(X(xs - .06 - .3), Y(-.5)); o.fill(); }
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = rgb(mix(K[0], K[6], .4)); o.beginPath(); o.moveTo(0, 0);   // the silver surface
    for (let j = 0; j <= 60; j++) { const xs = (j/60 - .5)*asp; o.lineTo(X(xs), Y(SURF + .015*Math.sin(xs*8 + t*1.3) + .008*Math.sin(xs*19 - t*2.1))); }
    o.lineTo(W, 0); o.fill();
    for (let j = 0; j < 3; j++) {   // jellyfish
      const jx = (fr(j*.37 + t*.004) - .5)*asp*.9 + .02*Math.sin(t*.5 + j), jy = fr(j*.29 + t*.012)*.9 - .45, s = .04*(1 + .3*j)*(1 - .18*kick)*u;
      o.fillStyle = rgb(mix(K[5], K[6], .4)); o.globalAlpha = a*.7; o.beginPath(); o.ellipse(X(jx), Y(jy), s, s/(1.3 + .3*kick), 0, Math.PI, 0); o.fill();
      o.strokeStyle = o.fillStyle; o.lineWidth = Math.max(1, s*.08); o.globalAlpha = a*.45;
      for (let q = -1; q <= 1; q++) { o.beginPath(); for (let y = 0; y < 12; y++) o.lineTo(X(jx) + q*s*.55 + Math.sin(y*.8 + t*3 + j)*s*.12, Y(jy) + y*s*.27); o.stroke(); }
      o.globalAlpha = a; }
    for (let k = 0; k < NL; k++) {   // the reef, far to near: each layer's ground and its forms, with a shadow on the one behind
      const n = k/(NL - 1), base = mix(mix(K[2], K[3], Math.pow(n, .8)), mix(K[0], K[1], .5), .35*(1 - n));
      o.shadowColor = 'rgba(0,0,0,.35)'; o.shadowBlur = .015*u; o.shadowOffsetY = -.012*u; o.shadowOffsetX = .006*u;
      o.fillStyle = rgb(base); o.beginPath(); o.moveTo(0, H);
      for (let j = 0; j <= 140; j++) { const x = (j/140 - .5)*asp; o.lineTo(X(x), Y(ground(x, k, D))); } o.lineTo(W, H); o.fill();
      const fw = .11 + .09*n, sc = .8 + 1.6*n, tot = cur.w.reduce((s, v) => s + v, 0) + 1.8;
      for (let s = Math.floor(-asp/2/fw) - 1; s <= Math.ceil(asp/2/fw) + 1; s++) {
        const h1 = rnd(s, k*13 + D), h2 = rnd(s + 7, k + D*3), c = (s + .5 + (h1 - .5)*.4)*fw, gb = ground(c, k, D);
        let pick = h2*tot, form = 0; for (let f = 0; f < 4; f++) { if (pick < cur.w[f]) { form = f + 1; break; } pick -= cur.w[f]; }
        if (!form) continue;
        o.fillStyle = rgb(mix(base, form === 3 ? K[5] : form === 2 ? K[4] : form === 4 ? mix(K[4], K[5], .5) : mix(K[3], K[5], .4), .25 + .6*n));
        const sway = (Math.sin(gb*6 + t*1.1 + k)*.015 + P.deepA[3]*(.4 + n)*Math.sin(t*.8 + k*1.3));
        o.beginPath();
        if (form === 1) { const h = (.12 + .25*h1)*sc; o.moveTo(X(c - .009*sc), Y(gb)); o.quadraticCurveTo(X(c + sway*.5 - .016*sc), Y(gb + h*.6), X(c + sway), Y(gb + h)); o.quadraticCurveTo(X(c + sway*.5 + .016*sc), Y(gb + h*.6), X(c + .009*sc), Y(gb)); }
        else if (form === 2) { const R = (.04 + .04*h1)*sc; o.moveTo(X(c + R), Y(gb + R*.25)); o.arc(X(c), Y(gb + R*.25), R*u, 0, Math.PI, true); o.rect(X(c) - 1, Y(gb + R*.25), 2, .3*R*u); }
        else if (form === 3) { for (let j = -1; j <= 1; j++) { const hj = (.05 + .07*rnd(s + j, k + D))*sc, wj = .0045*sc; o.rect(X(c + j*.013*sc - wj), Y(gb + hj), 2*wj*u, hj*u + 2); o.moveTo(X(c + j*.013*sc + wj*1.25), Y(gb + hj)); o.arc(X(c + j*.013*sc), Y(gb + hj), wj*1.25*u, 0, Math.PI*2); } }
        else { for (let j = 0; j < 2; j++) { const hj = (.04 + .05*rnd(s + j*3, k*2 + D))*sc, wj = .0065*sc, xj = c + (j - .5)*.022*sc;   // vase sponges
          o.moveTo(X(xj - wj*.7), Y(gb)); o.lineTo(X(xj - wj*1.2), Y(gb + hj)); o.lineTo(X(xj + wj*1.2), Y(gb + hj)); o.lineTo(X(xj + wj*.7), Y(gb)); } }
        o.fill();
      }
      o.shadowColor = 'transparent';
      if (k === FISH_K) {   // the school
        for (let i = 0; i < NF; i++) { const [fx, fy, fa] = fishAt(i, P), sz = .016*u*(1.05 + .5*rnd1(i*7.3 + 2));
          o.save(); o.translate(X(fx), Y(fy)); o.rotate(-fa); o.fillStyle = rgb(K[4]);
          o.beginPath(); o.ellipse(0, 0, sz, sz/2.4, 0, 0, Math.PI*2); o.moveTo(-sz*.8, 0); o.lineTo(-sz*1.75, -sz*.55); o.lineTo(-sz*1.75, sz*.55); o.fill(); o.restore(); } }
    }
    o.strokeStyle = rgb(K[6], .9); o.globalAlpha = a*(.4 + .5*hat); o.lineWidth = 1;   // bubbles, livelier with the hi-hats
    for (const b of P.deepBubbles) { o.beginPath(); o.arc(X(b.x*asp), Y(b.y), Math.max(1.5, b.r*u), 0, Math.PI*2); o.stroke(); }
    o.restore();
  },
};
