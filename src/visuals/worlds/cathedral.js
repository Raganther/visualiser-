// The Cathedral: an endless hall church to fly through. Columns stand in rows in every direction under pointed rib vaults,
// the arcades open, so looking aside the halls repeat for ever; smaller copies of the same arches are traced into the
// vaults (the pattern again at a third of the size: a fractal's self-likeness). At the crown of every bay a stained-glass
// oculus glows in the palette's colours and pulses on the kick; light lines inlaid in the floor carry the kick's wave away
// down the nave. The camera flies the nave, weaving a little, rising into the vaults as the music builds; a drop surges it
// and rolls it. Each section brings its own proportions (bay, pointedness, columns) and its own stone: warm stone, white
// marble or black obsidian edged in neon (a returning section its own again). The user asked for more self-contained 3D
// worlds after the Hollow. Its front plane is the nearest columns and ribs. Simple mode draws the nave's bays receding:
// columns, arches and the glowing oculi.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null, y: .3, roll: 0, rollT: 0, look: 0, bars: 0, want: false, alt: null, lastD: null};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
// a section's cathedral: bay length, arch pointedness, column radius, two hues, its stone (0 warm stone, 1 marble, 2 obsidian)
const LOOK = D => [2.6 + hh(D + .4)*1.2, .6 + hh(D + 1.1)*1.1, .2 + hh(D + 2.3)*.14, hh(D + 3.1), hh(D + 5.9), D ? Math.floor(hh(D + 7.3)*3) : 0];
const W = 2.2, SPRING = 1.3, FLOOR = -1.2;   // half a bay's width, where the arches spring, the floor
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
function camera(){   // where the camera is and where it looks (its own frame, handed to the shader)
  const z = st.z, x = Math.sin(z*.09)*.7 + Math.sin(z*.041)*.3, y = st.y;
  let yaw = Math.sin(z*.05)*.25 + st.look, pitch = (y - .3)*.18;
  if (st.alt && st.altW > 0) { const a = Math.atan2(st.alt.x - x, st.alt.z - z); yaw += (a - yaw)*st.altW; }   // turning to the altar as it passes
  return {p: [x, y, z], f: [Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch)]};
}
export const cathedralAltar = () => { st.want = true; };   // (for tests and labs: set an altar ahead now)
export default {
  key: 'cathedral', kind: 'world', lowRes: () => 1, heavy: () => true, label: 'The Cathedral',   // (ray-marched: a slow device or a lower graphics level draws it smaller first, render/quality.js)
  light: {hue: .1, sat: .4, x: 0, y: .6},               // the oculi's light, from above
  // grand, building music: tension and space, less of a busy top
  suits: (rf, T) => T*.3 + rf.low*.1 + rf.bright*.15 + rf.mid*.1 - rf.busy*.1,
  onBeat(pos){ st.wave = 0; if (pos === 0 && ++st.bars % TUNE.cathedral.altarBars === 0) st.want = true; },   // each kick: the oculi pulse and a wave of light runs down the floor; every few bars, an altar
  params(P, x){
    const T = TUNE.cathedral, J = x.J, on = P.w.cathedral > .05, ten = (J && J.tension) || 0;
    sectionLayout(st, 'cathD', J, on, x.dt, T.morphSecs);
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) { st.surge = 1; st.rollT += Math.PI*2*(hh(st.z) < .5 ? -1 : 1); } st.drop = J.lastDrop; }
    st.surge *= Math.exp(-x.dt/T.surgeSecs);
    const want = T.speed*(T.calm + (1 - T.calm)*ten)*(1 + T.surge*st.surge);
    st.sp += (want - st.sp)*Math.min(1, x.dt*.8);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;   // (in motion time)
    if (on) st.z += st.sp*mdt;
    st.y += ((T.low + (T.high - T.low)*sst(.35, .9, ten) + Math.sin(st.z*.057)*.3) - st.y)*Math.min(1, x.dt*.5);   // rising into the vaults with the build
    st.roll += (st.rollT - st.roll)*Math.min(1, x.dt*1.6);   // a drop: a slow barrel roll
    st.look = Math.sin(x.t*.07)*T.lookAside*(1 - ten);          // calm: glancing along the side aisles
    st.wave += x.dt;
    // an altar: a place in a side aisle ahead where a centrepiece stands, seen through the columns as the camera passes
    if (st.lastD !== st.D1) { if (st.lastD !== null) st.want = true; st.lastD = st.D1; }
    if (st.alt && st.z > st.alt.z + 2) st.alt = null;
    if (st.want && !st.alt && on) { const z = st.z + T.altarAhead, side = hh(z*.071 + st.bars) < .5 ? -1 : 1; st.alt = {z, x: side*2*W, y: FLOOR + T.altarHeight}; }
    st.want = false;
    const dz = st.alt ? st.alt.z - st.z : 1e9;
    st.altW = st.alt ? sst(T.altarAhead, T.altarAhead*.4, dz)*sst(-1.5, 2.5, dz)*T.altarLook : 0;
    const A = LOOK(st.D0), B = LOOK(st.D1), m = st.tr*st.tr*(3 - 2*st.tr), mix = (a, b) => a + (b - a)*m, hmix = (a, b) => a + (((b - a + .5) % 1 + 1) % 1 - .5)*m;
    const cam = camera();
    P.ct = [...cam.p, st.surge];
    P.ct2 = [...cam.f, st.roll];
    P.ct3 = [hmix(A[3], B[3]), hmix(A[4], B[4]), st.wave, x.dim];
    P.ct4 = [mix(A[0], B[0]), mix(A[1], B[1]), mix(A[2], B[2]), mix(A[5], B[5])];
    P.ctA = st.alt ? [st.alt.x, st.alt.y, st.alt.z, sst(T.altarAhead + 4, T.altarAhead - 4, dz)] : [0, 0, -1e4, 0];
    P.ctF = 3;
    P.ctG = T.wallGlow*x.dim;   // the layers' glow laid on the stone
    P.ctM = T.motes*(.6 + (P.treb || 0)*x.react*.8 + st.surge*1.5)*x.dim;   // the dust: livelier with the hi-hats, a burst on a drop
    // the centrepiece stands at the altar (the objects read P.anchor): its distance, so the columns nearer than it pass in front
    if (st.alt && P.w.cathedral > .5) {
      const f = cam.f, rl = Math.hypot(f[2], f[0]), r0 = [f[2]/rl, 0, -f[0]/rl], u0 = [f[1]*r0[2] - f[2]*r0[1], f[2]*r0[0] - f[0]*r0[2], f[0]*r0[1] - f[1]*r0[0]];
      const c = Math.cos(st.roll), s = Math.sin(st.roll), r = r0.map((v, i) => v*c + u0[i]*s), u = u0.map((v, i) => v*c - r0[i]*s);
      const d = [st.alt.x - cam.p[0], st.alt.y - cam.p[1], st.alt.z - cam.p[2]], zc = d[0]*f[0] + d[1]*f[1] + d[2]*f[2], near = P.ctA[3];
      if (zc < 1) P.anchor = {hide: true};
      else if (near > 0) { const dist = Math.hypot(...d); P.anchor = {pos: [(d[0]*r[0] + d[1]*r[1] + d[2]*r[2])/zc/1.2*near, (d[0]*u[0] + d[1]*u[1] + d[2]*u[2])/zc/1.2*near], size: (T.altarSize/zc/1.2/.49)*near + (1 - near)*.9, dist}; P.ctF = dist; }
    }
  },
  glsl: {
    uniforms: `uniform vec4 uCt, uCt2, uCt3, uCt4, uCtA; uniform float uCtF, uCtM, uCtG;   // the altar (where, how near), the front plane's depth; the camera (where, the surge), where it looks and its roll; two hues, the kick's wave, dim; the bay, pointedness, columns, the stone`,
    functions: `
// the arches' curve: a pointed arch spanning a bay's width, springing at ${SPRING}: two circles, each through the far column
float ctArch(float ax,float y,float e){ float R=${W.toFixed(1)}+e; return length(vec2(ax+e,y-${SPRING.toFixed(1)}))-R; }
float ctApex(float e){ float R=${W.toFixed(1)}+e; return ${SPRING.toFixed(1)}+sqrt(R*R-e*e); }
// the hall at one scale: vaults over every bay, columns, the transverse ribs and the arcades between the columns
float ctHall(vec3 p,float bay,float e,float cr,out float rib){
  float xr=mod(p.x+${W.toFixed(1)},${(2*W).toFixed(1)})-${W.toFixed(1)}, ax=abs(xr), pz=mod(p.z,bay)-bay*0.5;
  float dc=ctArch(ax,p.y,e), vault=max(-dc,${SPRING.toFixed(1)}-p.y);
  float col=length(vec2(ax-${W.toFixed(1)},pz))-cr*(1.0+0.35*smoothstep(${SPRING.toFixed(1)}-0.5,${SPRING.toFixed(1)},p.y)+0.3*smoothstep((${(FLOOR + .4).toFixed(1)}),(${FLOOR.toFixed(1)}),p.y));
  col+=0.012*sin(atan(pz,ax-${W.toFixed(1)})*16.0);   // fluted
  float r1=max(length(vec2(dc,pz))-cr*0.55,${SPRING.toFixed(1)}-0.2-p.y);   // the rib across the nave
  float hb=bay*0.5, e2=hb*0.35, dl=length(vec2(abs(pz)+e2,p.y-${SPRING.toFixed(1)}))-(hb+e2);
  float r2=max(length(vec2(dl,ax-${W.toFixed(1)}))-cr*0.5,${SPRING.toFixed(1)}-0.2-p.y);   // the arcade along it
  rib=min(r1,r2);
  return min(min(vault,col),rib);
}
float ctMap(vec3 p){
  float rib, d=min(p.y-(${FLOOR.toFixed(1)}),ctHall(p,uCt4.x,uCt4.y,uCt4.z,rib));
  float rib2; ctHall(p*3.0+vec3(${W.toFixed(1)},0.0,uCt4.x*0.5),uCt4.x,uCt4.y,uCt4.z,rib2);   // the same arches at a third of the size, traced into the vaults
  return min(d,max(rib2/3.0,d-0.07));   // (only close to the stone: the tracery, not arches hanging in the air)
}
vec3 ctRay(vec2 sp,out vec3 ro){
  ro=uCt.xyz; vec3 f=normalize(uCt2.xyz), r0=normalize(cross(vec3(0.0,1.0,0.0),f)), u0=cross(f,r0);
  vec3 r=r0*cos(uCt2.w)+u0*sin(uCt2.w), u=u0*cos(uCt2.w)-r0*sin(uCt2.w);
  return normalize(f+(r*sp.x+u*sp.y)*1.2);
}
float ctMarch(vec3 ro,vec3 rd,int n,float tmax){
  float t=0.02;
  for(int i=0;i<96;i++){ if(i>=n) break; float d=ctMap(ro+rd*t); if(d<0.0025*t) return t; t+=d*0.9; if(t>tmax) break; }
  return -1.0;
}
vec3 ctGlass(vec3 p,float h1,float h2){   // an oculus's stained glass: petals and rings in the palette's colours
  float xr=mod(p.x+${W.toFixed(1)},${(2*W).toFixed(1)})-${W.toFixed(1)}, pz=mod(p.z,uCt4.x)-uCt4.x*0.5, a=atan(pz,xr), r=length(vec2(xr,pz));
  float petal=0.5+0.5*cos(a*8.0), ring=0.5+0.5*cos(r*28.0), lead=smoothstep(0.08,0.0,abs(fract(r*5.0)-0.5)-0.38)+smoothstep(0.1,0.0,abs(fract(a*8.0/6.2831853)-0.5)-0.44);
  vec3 g=mix(hsv(uHue+h1,0.85,1.0),hsv(uHue+h2,0.85,1.0),petal*ring);
  return g*(1.0-0.85*clamp(lead,0.0,1.0));
}
vec3 cathedral(vec2 sp){
  vec3 ro, rd=ctRay(sp,ro);
  float h1=uCt3.x, h2=uCt3.y, kick=exp(-uCt3.z*2.5)*uCt3.w, apex=ctApex(uCt4.y);
  vec3 fogC=hsv(uHue+h1,0.55,0.1)*(1.0+uCt.w), c=fogC*(0.8+0.4*max(rd.y,0.0));
  float t=ctMarch(ro,rd,96,42.0);
  float dust=motes(ro,rd,t<0.0 ? 12.0 : min(t,12.0),0.5,vec3(sin(uTime*0.07)*0.2,uTime*0.02,0.0),0.0045*(1.0+uCt.w),0.5,vec2(${(2*W).toFixed(1)},uCt4.x));   // dust in the oculi's columns of light
  vec3 dC=mix(hsv(uHue+h1,0.3,1.0),hsv(uHue+h2,0.3,1.0),0.5)*dust*uCtM*(0.7+kick);
  if(t<0.0) return c+dC;
  vec3 p=ro+rd*t; vec2 e=vec2(0.004,0.0);
  vec3 n=normalize(vec3(ctMap(p+e.xyy)-ctMap(p-e.xyy),ctMap(p+e.yxy)-ctMap(p-e.yxy),ctMap(p+e.yyx)-ctMap(p-e.yyx)));
  float stone=uCt4.w, obs=smoothstep(1.5,2.0,stone), mar=smoothstep(0.5,1.0,stone)*(1.0-obs);
  float xr=mod(p.x+${W.toFixed(1)},${(2*W).toFixed(1)})-${W.toFixed(1)}, pz=mod(p.z,uCt4.x)-uCt4.x*0.5;
  // the stone: warm and grained, or white marble, or black obsidian
  float grain=vnz(vec2(p.x*5.0+p.z*2.0,p.y*9.0))*0.6+vnz(vec2(p.z*13.0,p.y*11.0+p.x*7.0))*0.4;
  vec3 base=mix(hsv(uHue+h1,0.25,0.75)*(0.7+0.5*grain),vec3(0.82,0.8,0.76)*(0.9+0.15*grain),mar);
  base=mix(base,vec3(0.03,0.03,0.04),obs);
  // light: a lamp on the camera, the oculi from above, the crevices darker
  float lamp=max(dot(n,-rd),0.0), fall=1.0/(1.0+t*t*0.02), ao=clamp(ctMap(p+n*0.2)/0.2,0.0,1.0);
  vec3 ocC=mix(hsv(uHue+h1,0.7,1.0),hsv(uHue+h2,0.7,1.0),0.5)*(0.6+1.6*kick+uCt.w);
  float dOc=length(vec3(xr,p.y-apex,pz));
  vec3 col=base*(0.05+0.9*lamp*lamp)*fall*(0.4+0.6*ao);
  col+=base*ocC*(0.25+0.75*max(n.y,0.0))/(1.0+dOc*dOc*0.12)*0.8*(0.4+0.6*ao);   // the oculi's light down into the bay
  col+=vec3(1.0)*pow(lamp,40.0)*(0.15+0.6*mar+0.9*obs)*fall;                    // polish
  col+=mix(hsv(uHue+h2,0.9,1.0),hsv(uHue+h1,0.9,1.0),0.3)*obs*pow(1.0-lamp,4.0)*0.9*fall;   // obsidian's neon edges
  if(uCtA.w>0.0){ vec3 L=uCtA.xyz-p; float d=length(L); col+=base*hsv(uHue+h2,0.5,1.0)*(0.8+1.2*kick)*max(dot(n,L/d),0.0)/(1.0+d*d*0.35)*uCtA.w*1.4; }   // the altar's light
  { vec2 wuv=abs(n.y)>0.6 ? vec2(p.x*0.11,p.z*0.07) : vec2((p.x+p.z)*0.09,p.y*0.16); col+=wallGlow(wuv)*uCtG*(0.3+0.7*fall)*(0.5+0.5*ao); }   // the glowing layers laid on the stone, floor and vaults and columns
  // an oculus: stained glass at each bay's crown
  float oc=length(vec2(xr,pz));
  if(p.y>apex-0.35&&oc<0.62) col=mix(col,ctGlass(p,h1,h2)*(0.8+1.8*kick+uCt.w)*1.4,smoothstep(0.62,0.55,oc));
  // light lines in the floor, the kick's wave running away down the nave
  if(p.y<(${(FLOOR + .01).toFixed(2)})){
    float line=smoothstep(0.03,0.0,abs(pz))+smoothstep(0.03,0.0,abs(abs(xr)-${W.toFixed(1)}*0.5));
    float wv=exp(-pow((t-uCt3.z*16.0)*0.6,2.0))*exp(-uCt3.z*0.8)*uCt3.w;
    col+=hsv(uHue+h2,0.8,1.0)*line*(0.15+2.0*wv+uCt.w)*(0.5+0.5*fall);
  }
  col=mix(col,c,1.0-exp(-t*0.055));
  if(uCtA.w>0.0){ float tc=dot(uCtA.xyz-ro,rd); if(tc>0.0&&tc<t){ float dd=length(ro+rd*tc-uCtA.xyz); col+=hsv(uHue+h2,0.5,1.0)*exp(-dd*dd*1.5)*0.35*uCtA.w; } }   // its haze
  return col+dC;
}`,
    fn: 'cathedral',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uCt, P.ct); gl.uniform4fv(u.uCt2, P.ct2); gl.uniform4fv(u.uCt3, P.ct3); gl.uniform4fv(u.uCt4, P.ct4); gl.uniform4fv(u.uCtA, P.ctA); gl.uniform1f(u.uCtF, P.ctF || 3); gl.uniform1f(u.uCtM, P.ctM || 0); gl.uniform1f(u.uCtG, P.ctG || 0); },
  // its front plane: the nearest columns and ribs
  front: {
    fn: 'cathFront',
    glsl: `
float cathFront(vec2 sp){ vec3 ro, rd=ctRay(sp,ro); float t=ctMarch(ro,rd,uCtF>3.1 ? 64 : 28,uCtF);   // (the stone nearer than uCtF)
  return t>0.0&&(ro+rd*t).y>(${(FLOOR + .05).toFixed(2)}) ? 1.0 : 0.0; }`,
    path2d(o, P){   // the nearest bay's columns
      const Wc = o.canvas.width, H = o.canvas.height;
      for (const b of bays(P, Wc, H).slice(0, 1)) for (const c of b.cols) o.rect(c[0] - c[2], c[1], c[2]*2, c[3] - c[1]);
    },
  },
  draw2d(o, P){
    const Wc = o.canvas.width, H = o.canvas.height, a = Math.min(1, P.w.cathedral), h = P.hue, [h1, h2, wave, dim] = P.ct3, surge = P.ct[3], kick = Math.exp(-wave*2.5)*dim;
    o.globalAlpha = a;
    o.fillStyle = hc(h + h1, 50, 7*(1 + surge), 1); o.fillRect(0, 0, Wc, H);
    const B = bays(P, Wc, H), stone = P.ct4[3];
    for (let k = B.length - 1; k >= 0; k--) {   // far to near: arches, columns, the oculus glowing at the crown
      const b = B[k], fog = 1 - Math.exp(-b.z*.055), light = stone > 1.5 ? 8 : stone > .5 ? 70 : 45;
      o.strokeStyle = hc(h + h1, 25, light*(1 - fog*.85), 1); o.lineWidth = Math.max(1, H*.05/b.z);
      for (const arc of b.arcs) { o.beginPath(); arc.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y)); o.stroke(); }
      o.fillStyle = hc(h + h1, 25, light*(1 - fog*.85)*.8, 1);
      for (const c of b.cols) o.fillRect(c[0] - c[2], c[1], c[2]*2, c[3] - c[1]);
      if (stone > 1.5) { o.strokeStyle = hc(h + h2, 90, 55, (1 - fog)*.8); o.lineWidth = 1; for (const c of b.cols) o.strokeRect(c[0] - c[2], c[1], c[2]*2, c[3] - c[1]); }
      o.fillStyle = hc(h + (k % 2 ? h1 : h2), 85, 55, Math.min(1, (.35 + 1.2*kick + surge)*(1 - fog*.7)));
      o.beginPath(); o.arc(b.oc[0], b.oc[1], b.oc[2], 0, Math.PI*2); o.fill();
    }
    motes2d(o, Wc, H, (P.ct[2] - (st.z2d ?? P.ct[2])), a2 => hc(h + h1, 30, 80, a2), P.ctM || 0, P.t2 || 0); st.z2d = P.ct[2];   // the dust
    o.globalAlpha = 1;
  },
};
// simple mode's motes: points streaming past as the camera flies, bigger and brighter near, twinkling
const MOTES = Array.from({length: 70}, (_, i) => ({a: hh(i + .5)*Math.PI*2, r: .15 + hh(i + 1.5)*.85, z: hh(i + 2.5)*8, tw: hh(i + 3.5)*6}));
function motes2d(o, W, H, dz, col, amt, t){
  o.globalCompositeOperation = 'lighter';
  for (const m of MOTES) {
    m.z -= dz; if (m.z < .3) { m.z += 8; m.a = (m.a + 2.4) % (Math.PI*2); }
    const k = 1/m.z, x = W/2 + Math.cos(m.a)*m.r*k*H*.5, y = H/2 + Math.sin(m.a)*m.r*k*H*.5, s = Math.max(1, 2.5*k*H/540);
    o.fillStyle = col(Math.min(1, amt*(.4 + .6*Math.sin(t*3 + m.tw)**2)*k*.9)); o.beginPath(); o.arc(x, y, s, 0, Math.PI*2); o.fill();
  }
  o.globalCompositeOperation = 'source-over';
}
// simple mode's nave: its bays ahead, projected (columns, the rib across and the oculus at its crown), nearest first
function bays(P, Wc, H){
  const [cx, cy, cz] = P.ct, [fx, fy, fz, roll] = P.ct2, bay = P.ct4[0], e = P.ct4[1], out = [], R = W + e, apex = SPRING + Math.sqrt(R*R - e*e);
  const fl = Math.hypot(fx, fy, fz), f = [fx/fl, fy/fl, fz/fl], rl = Math.hypot(f[2], f[0]), r0 = [f[2]/rl, 0, -f[0]/rl], u0 = [f[1]*r0[2] - f[2]*r0[1], f[2]*r0[0] - f[0]*r0[2], f[0]*r0[1] - f[1]*r0[0]];
  const c = Math.cos(roll), s = Math.sin(roll), r = r0.map((v, i) => v*c + u0[i]*s), u = u0.map((v, i) => v*c - r0[i]*s);
  const proj = q => { const d = [q[0] - cx, q[1] - cy, q[2] - cz], z = d[0]*f[0] + d[1]*f[1] + d[2]*f[2]; return z <= .1 ? null : [Wc/2 + (d[0]*r[0] + d[1]*r[1] + d[2]*r[2])/z/1.2*H, H/2 - (d[0]*u[0] + d[1]*u[1] + d[2]*u[2])/z/1.2*H, z]; };
  const z0 = Math.ceil((cz - bay*.5)/bay)*bay + bay*.5;
  for (let k = 0; k < 14; k++) {
    const z = z0 + k*bay, b = {z: z - cz, cols: [], arcs: []};
    for (const xc of [-3*W, -W, W, 3*W]) {
      const top = proj([xc, SPRING, z]), bot = proj([xc, FLOOR, z]); if (!top || !bot) continue;
      b.cols.push([top[0], top[1], Math.max(1, .25*H/top[2]/1.2), bot[1]]);
    }
    for (const xm of [-2*W, 0, 2*W]) {   // each bay's rib: the pointed arch across it
      const pts = []; for (let j = 0; j <= 16; j++) { const t = j/16, ax = W*(1 - 2*t), sgn = ax < 0 ? -1 : 1, aa = Math.abs(ax), y = SPRING + Math.sqrt(Math.max(0, R*R - (aa + e)**2));
        const q = proj([xm + sgn*aa, y, z]); if (q) pts.push(q); }
      if (pts.length > 2) b.arcs.push(pts);
    }
    const oc = proj([0, apex, z - bay*.5]); b.oc = oc ? [oc[0], oc[1], Math.max(1, .55*H/oc[2]/1.2)] : [-99, -99, 0];
    if (b.cols.length) out.push(b);
  }
  return out;
}
