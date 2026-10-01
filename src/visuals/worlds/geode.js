// The Geode: a winding fissure through the rock, its walls carpeted with crystal points, opening every so often into a
// cavern where the crystals grow huge. Each crystal is a hexagonal prism ending in a point, milky at its base and deep and
// glowing at its tip; the rock between is banded like agate. The crystals grow longer as the music builds, a wave of light
// runs through them on each kick, they glint with the hi-hats, and a drop flares them all. Each section its own crystal
// (amethyst, citrine, quartz, emerald; a returning section its own again). The user asked for more self-contained 3D
// worlds; a centrepiece stands in the middle of each cavern as the camera passes through it (P.anchor, with its distance,
// so the crystals nearer than it pass in front). Its front plane is the near crystals. Simple mode draws the fissure's
// cross-sections receding, each a ring of crystal points.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null, grow: .5, age: 99};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
const GAP = 24, R0 = 2.8, RB = 3.2;   // a cavern every GAP units along the way; the fissure's radius, and how much wider a cavern is
// a section's crystal: its kind (0 amethyst, 1 citrine, 2 quartz, 3 emerald), how thick the points grow
const LOOK = D => [D ? Math.floor(hh(D + .9)*4) : 0, .85 + hh(D + 2.7)*.4];
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
const path = z => [Math.sin(z*.09)*1.6 + Math.sin(z*.043)*1.2, Math.cos(z*.07)*1.0 + Math.sin(z*.037)*.7, z];
const bulge = z => (.5 + .5*Math.cos(Math.PI*2*z/GAP))**4;   // 1 in a cavern's middle, 0 in the fissure
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
function camFrame(z){   // the camera on the route, looking along it (as gdRay)
  const ro = path(z), a = path(z + 2), fw = sub3(a, ro), fl = Math.hypot(...fw), f = fw.map(v => v/fl);
  const rl = Math.hypot(f[2], f[0]), r = [f[2]/rl, 0, -f[0]/rl], u = [f[1]*r[2] - f[2]*r[1], f[2]*r[0] - f[0]*r[2], f[0]*r[1] - f[1]*r[0]];
  return {ro, a, f, r, u};
}
const onScreen = (cam, p) => { const rel = sub3(p, cam.ro), z = dot3(rel, cam.f); return {z, x: dot3(rel, cam.r)/z/1.25, y: dot3(rel, cam.u)/z/1.25}; };
export const geodeAt = z => { st.z = z; };   // (for tests and labs: put the camera this far along)
export default {
  key: 'geode', kind: 'world', label: 'The Geode',
  light: {hue: .78, sat: .5, x: 0, y: 0},
  // bright, glittering music: the top end and some space
  suits: (rf, T) => rf.bright*.35 + (rf.hat || 0)*.2 - rf.low*.1 + T*.1,
  onBeat(){ st.wave = 0; },   // each kick: a wave of light through the crystals
  params(P, x){
    const T = TUNE.geode, J = x.J, on = P.w.geode > .05, ten = (J && J.tension) || 0;
    sectionLayout(st, 'geoD', J, on, x.dt, T.morphSecs);
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) { st.surge = 1; st.age = 0; } st.drop = J.lastDrop; }
    st.age += x.dt;
    st.surge *= Math.exp(-x.dt/T.surgeSecs);
    const slow = 1 - (1 - T.cavitySlow)*bulge(st.z);   // slower through a cavern, to take it in
    const want = T.speed*(T.calm + (1 - T.calm)*ten)*(1 + T.surge*st.surge)*slow;
    st.sp += (want - st.sp)*Math.min(1, x.dt*.8);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;   // (in motion time)
    if (on) st.z += st.sp*mdt;
    st.wave += x.dt;
    st.grow += ((T.growCalm + (T.growHigh - T.growCalm)*ten + st.surge*.3) - st.grow)*Math.min(1, x.dt*.4);   // the crystals grow as it builds
    const A = LOOK(st.D0), B = LOOK(st.D1), m = st.tr*st.tr*(3 - 2*st.tr);
    P.gd = [st.z, Math.min(st.age, 99), x.dim, st.surge];   // (the drop's age: its white flash racing out through the crystals)
    P.gd2 = [0, 0, 0, st.grow];
    P.gd3 = [A[0], B[0], m, A[1] + (B[1] - A[1])*m];
    P.gd4 = [st.wave, x.dim, (P.treb || 0)*x.react, 0];
    // the centrepiece stands in the middle of the cavern ahead, and is gone once the camera is through it
    if (P.w.geode > .5) {
      const kc = Math.ceil((st.z - GAP*.08)/GAP), C = path(kc*GAP), cam = camFrame(st.z), s = onScreen(cam, C);
      if (s.z < 1.5) P.anchor = {hide: true};
      else if (s.z < GAP*.9) P.anchor = {pos: [s.x, s.y], size: T.heartSize*RB/s.z/1.25/.49, dist: Math.hypot(...sub3(C, cam.ro))};
    }
    P.gdF = P.anchor && P.anchor.dist ? P.anchor.dist : 1.6;   // its front plane: the crystals nearer than the centrepiece, or the near ones
  },
  glsl: {
    uniforms: `uniform vec4 uGd, uGd2, uGd3, uGd4; uniform float uGdF, uGdM, uGdG;   // the Geode: where along it, the surge; the crystals' growth; their kinds blended, thickness; the kick's wave, dim, the hats; the front plane's depth; the dust, the glow on the rock`,
    functions: `
vec3 gdPath(float z){ return vec3(sin(z*0.09)*1.6+sin(z*0.043)*1.2,cos(z*0.07)*1.0+sin(z*0.037)*0.7,z); }
float gdR(float z,float a){ return ${R0.toFixed(1)}+${RB.toFixed(1)}*pow(0.5+0.5*cos(6.2831853*z/${GAP}.0),4.0)+0.12*sin(a*3.0+z*0.7); }
// the rock: a tube round the route, widening into caverns; crystals growing in from its wall, one in each cell of a grid of
// angle round the route and distance along it, each its own length, lean and turn: a hexagonal prism, then its point
float gdMap(vec3 p,out float cry){
  vec3 c=gdPath(p.z); vec2 q=p.xy-c.xy; float rq=length(q), a=atan(q.y,q.x);
  float w=gdR(p.z,a)-rq, rock=w*0.8;   // the distance to the rock: positive in the open
  float NA=36.0, CZ=0.55, fa=(a+3.14159)/6.28318*NA, fz=p.z/CZ, ia=floor(fa), iz=floor(fz);
  float hs=hash(vec2(ia,iz)), hs2=hash(vec2(iz+3.3,ia*1.7));
  float ca=(ia+0.5)/NA*6.28318-3.14159, zc=(iz+0.5)*CZ;
  vec3 cc=gdPath(zc), dc=vec3(cos(ca),sin(ca),0.0); float Rc=gdR(zc,ca), sc=0.55+0.45*Rc/${R0.toFixed(1)};   // bigger in the caverns
  vec3 B=vec3(cc.xy+dc.xy*Rc,zc), ax=normalize(-dc+vec3(-dc.y,dc.x,0.0)*(hs-0.5)*0.4+vec3(0.0,0.0,(hs2-0.5)*0.5));
  vec3 b1=normalize(cross(ax,vec3(0.0,0.0,1.0))), b2=cross(ax,b1), rel=p-B;
  float along=dot(rel,ax); vec2 xy=vec2(dot(rel,b1),dot(rel,b2)); float tw=hs*6.28; xy=mat2(cos(tw),-sin(tw),sin(tw),cos(tw))*xy;
  float L=(0.25+hs*hs*0.95)*sc*uGd2.w*step(0.05,hs2), rb=0.12*sc*uGd3.w*(0.8+0.3*hs2), rr=rb*clamp((L-along)/(L*0.4),0.0,1.0);
  vec2 hp=abs(xy); hp-=2.0*min(dot(vec2(-0.866025,0.5),hp),0.0)*vec2(-0.866025,0.5);
  float hex=length(hp-vec2(clamp(hp.x,-0.57735*rr,0.57735*rr),rr))*sign(hp.y-rr);
  float cr=max(hex,max(along-L,-along-0.4))*0.7;
  // never step past this cell's edge, where the next crystal begins; out in the open no crystal reaches: step to their zone
  float edge=min(min(fract(fa),1.0-fract(fa))*6.28318/NA*rq,min(fract(fz),1.0-fract(fz))*CZ);
  cr=w>2.6 ? w-2.5 : min(cr,edge+0.05);
  cry=cr<rock && along<L+0.05 && hex<0.02 ? 0.5+0.5*clamp(along/max(L,0.01),0.0,1.0) : 0.0;   // on a crystal: how far up it (0.5 its base, 1 its tip)
  return min(rock,cr);
}
vec3 gdRay(vec2 sp,out vec3 ro){ ro=gdPath(uGd.x); vec3 f=normalize(gdPath(uGd.x+2.0)-ro), r=normalize(cross(vec3(0.0,1.0,0.0),f)), u=cross(f,r); return normalize(f+(r*sp.x+u*sp.y)*1.25); }
vec3 gdTint(float k){ return k<0.5 ? vec3(0.55,0.2,0.85) : k<1.5 ? vec3(0.95,0.6,0.15) : k<2.5 ? vec3(0.8,0.88,1.0) : vec3(0.15,0.85,0.45); }   // amethyst, citrine, quartz, emerald
float gdMarch(vec3 ro,vec3 rd,int n,float tmax,out float cry){
  float t=0.05; cry=0.0;
  for(int i=0;i<110;i++){ if(i>=n) break; float d=gdMap(ro+rd*t,cry); if(d<0.002*t) return t; t+=d; if(t>tmax) break; }
  return -1.0;
}
vec3 geode(vec2 sp){
  vec3 ro, rd=gdRay(sp,ro); float cry;
  vec3 tint=mix(gdTint(uGd3.x),gdTint(uGd3.y),uGd3.z), fogC=tint*0.04*(1.0+uGd.w);
  float t=gdMarch(ro,rd,110,30.0,cry);
  float dust=motes(ro,rd,t<0.0 ? 9.0 : min(t,9.0),0.7,vec3(0.0,-uTime*0.04,0.0),0.005*(1.0+uGd.w*3.0),min(1.0,0.75+0.25*uGd4.z+uGd.w),vec2(0.0))*uGdM;   // glittering dust hanging in the air
  if(t<0.0) return fogC+tint*dust;
  vec3 p=ro+rd*t; vec2 e=vec2(0.003,0.0); float cc;
  vec3 n=normalize(vec3(gdMap(p+e.xyy,cc)-gdMap(p-e.xyy,cc),gdMap(p+e.yxy,cc)-gdMap(p-e.yxy,cc),gdMap(p+e.yyx,cc)-gdMap(p-e.yyx,cc)));
  float lamp=max(dot(n,-rd),0.0), fall=1.0/(1.0+t*t*0.02), fres=pow(1.0-lamp,3.0);
  float kick=exp(-pow((t-uGd4.x*16.0)*0.6,2.0))*exp(-uGd4.x*0.8)*uGd4.y;   // the kick's wave rushing through the crystals
  float flash=exp(-pow((t-uGd.y*14.0),2.0)*0.15)*exp(-uGd.y*0.6)*uGd.z;   // a drop: a white flash racing out from us through the cavern
  vec3 col;
  if(cry>0.25){
    float up=cry*2.0-1.0;   // the crystal's base pale and milky, its tip deep and glowing
    vec3 hv=normalize(-rd+normalize(vec3(0.3,0.8,-0.2)));
    float l2=max(dot(n,-rd),0.0), glint=pow(max(dot(n,hv),0.0),40.0)*(1.0+3.0*uGd4.z);
    vec3 body=mix(mix(tint,vec3(0.9),0.55)*0.5,tint*1.3,up);
    col=body*(0.15+0.5*l2)+tint*fres*1.4+vec3(1.0)*glint*0.9+tint*(0.12+0.35*up)*(1.0+5.0*kick+3.0*uGd.w)+mix(tint,vec3(1.0),0.7)*flash*(0.6+1.4*up);
  } else {
    vec3 cp=gdPath(p.z); vec2 q=p.xy-cp.xy; float band=sin(p.z*1.3+atan(q.y,q.x)*2.0+vnz(p.xz*2.0+p.y)*3.0);
    col=mix(vec3(0.22,0.2,0.19),mix(tint*0.6,vec3(0.85,0.8,0.75),0.5),0.5+0.5*band)*(0.2+0.7*lamp)+vec3(0.25)*flash;   // agate bands
    col+=wallGlow(vec2(atan(q.y,q.x)/6.2831853+0.5,p.z*0.06))*uGdG*(0.4+0.6*lamp);   // the glowing layers on the rock
  }
  col*=fall;
  return mix(col,fogC,1.0-exp(-t*0.07))+tint*dust;
}`,
    fn: 'geode',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uGd, P.gd); gl.uniform4fv(u.uGd2, P.gd2); gl.uniform4fv(u.uGd3, P.gd3); gl.uniform4fv(u.uGd4, P.gd4); gl.uniform1f(u.uGdF, P.gdF || 1.6); gl.uniform1f(u.uGdM, TUNE.geode.motes); gl.uniform1f(u.uGdG, TUNE.geode.wallGlow); },
  front: {
    fn: 'geodeFront',
    glsl: `
float geodeFront(vec2 sp){ vec3 ro, rd=gdRay(sp,ro); float cry; float t=gdMarch(ro,rd,uGdF>1.7 ? 70 : 30,uGdF,cry); return t>0.0 ? 1.0 : 0.0; }`,
    path2d(o, P){ const W = o.canvas.width, H = o.canvas.height; o.rect(0, 0, W, H*.08); o.rect(0, H*.92, W, H*.08); },
  },
  // simple mode: the fissure's cross-sections ahead, far to near, each a ring of crystal points pointing in
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, a = Math.min(1, P.w.geode), [kA, kB, m] = P.gd3, kind = Math.round(m < .5 ? kA : kB);
    const hue = [.78, .1, .6, .38][kind], sat = kind === 2 ? 15 : 70, z0 = P.gd[0], [wave, dim, hats] = P.gd4, surge = P.gd[3];
    const cam = camFrame(z0), STEP = 1.1;
    o.globalAlpha = a;
    o.fillStyle = hc(hue, sat, 4*(1 + surge), 1); o.fillRect(0, 0, W, H);
    for (let j = 16; j >= 1; j--) {
      const zj = (Math.floor(z0/STEP) + j)*STEP, c = path(zj), s = onScreen(cam, c); if (s.z < .4) continue;
      const R = R0 + RB*bulge(zj), px = H*.5/s.z/1.25, cx = W/2 + s.x*H*.5, cy = H/2 - s.y*H*.5;
      const fog = 1 - Math.exp(-s.z*.07), kick = Math.exp(-(((s.z - wave*16)*.6)**2))*Math.exp(-wave*.8)*dim, n = 22;
      const flash = Math.exp(-((s.z - P.gd[1]*14)**2)*.15)*Math.exp(-P.gd[1]*.6)*P.gd[2];   // a drop's white flash racing out
      for (let i = 0; i < n; i++) {
        const an = (i + (j & 1)*.5)/n*Math.PI*2, h = hh(i + Math.round(zj/STEP)*7.1), L = (.25 + h*h*.95)*(.55 + .45*R/R0)*P.gd2[3];
        const x0 = cx + Math.cos(an)*R*px, y0 = cy + Math.sin(an)*R*px, wd = .12*(.55 + .45*R/R0)*px;
        o.fillStyle = hc(hue, sat*(1 - .7*Math.min(1, flash)), (18 + 60*flash + 45*kick + 25*hats*hh(i*3 + j) + 30*surge)*(1 - fog*.85)*(.6 + .6*h), 1);
        o.beginPath(); o.moveTo(x0 - Math.sin(an)*wd, y0 + Math.cos(an)*wd); o.lineTo(x0 - Math.cos(an)*L*px, y0 - Math.sin(an)*L*px); o.lineTo(x0 + Math.sin(an)*wd, y0 - Math.cos(an)*wd); o.closePath(); o.fill();
      }
    }
    o.globalAlpha = 1;
  },
};
