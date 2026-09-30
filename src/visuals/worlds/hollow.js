// The Hollow: a cave to fly through for ever, now a journey. The rock is a gyroid (a honeycomb of smooth branching tunnels
// with no end; hwTp holds three more labyrinths, unused: they broke into floating blobs), each section with its own stuff (stone,
// crystal, flesh that breathes with the bass, ice) and hues (a returning section its own again). The camera's route is
// carved clear through it, a run of stretches each its own kind (a wander, a corkscrew, great swoops up and down, a
// slalom), blended into one another, and the camera banks into the turns. Every few bars, and at each new section, the
// tunnel opens into a chamber ahead: a vaulted hall ringed with pillars, lit from a glowing heart that pulses on the kick;
// the camera slows, turns to look at it as it passes, and flies on. A centrepiece on screen stands there, in the heart of
// the hall (P.anchor, as the cosmos's monument). Veins of light run through the rock, each kick rushing a wave of light
// down them; a build quickens the flight, a drop surges it. The user loved the Hollow and asked for a real journey with
// chambers, not a straight line (docs/taste.md). Its front plane is the near walls. Simple mode draws rings of the
// tunnel along the same route, widening into the chambers, with the heart's glow.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null, bars: 0, lastD: null, ch: null, want: false, roll: 0, look: 0, bass: 0};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
// a section's cave: scale, how open, two hues, its labyrinth (0 gyroid, 1 Schwarz P, 2 diamond, 3 Neovius), its stuff (0 stone, 1 crystal, 2 flesh, 3 ice)
// (always the gyroid: the user loved its honeycomb, and the other labyrinths broke into floating blobs, "an asteroid belt")
const LOOK = D => [.75 + hh(D + .3)*.5, -.35 + hh(D + 1.7)*.35, hh(D + 3.1), hh(D + 5.9), 0, D ? Math.floor(hh(D + 9.3)*4) : 0];
// the route: stretches of SEG units, each its kind, the next blended in over the last part of each
const SEG = 40, kindOf = k => Math.floor(hh(k*1.37 + .11)*4);
function off(kind, z){
  return kind === 0 ? [Math.sin(z*.13)*1.6 + Math.sin(z*.071)*.9, Math.cos(z*.11)*1.1 + Math.sin(z*.05)*.5]   // a wander
    : kind === 1 ? [Math.cos(z*.4)*1.3, Math.sin(z*.4)*1.3]                                                  // a corkscrew
    : kind === 2 ? [Math.sin(z*.1)*2.2 + Math.sin(z*.047)*.8, Math.sin(z*.085 + 1.3)*2.6]                   // swoops, up and down
    : [Math.sin(z*.3)*2.2, Math.cos(z*.15)*.8];                                                             // a slalom
}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
export function path(z){
  const k = Math.floor(z/SEG), m = sst(.7, 1, z/SEG - k), a = off(kindOf(k), z), b = off(kindOf(k + 1), z);
  return [a[0] + (b[0] - a[0])*m, a[1] + (b[1] - a[1])*m, z];
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2], add3 = (a, b, s = 1) => [a[0] + b[0]*s, a[1] + b[1]*s, a[2] + b[2]*s];
const cross3 = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v/l); };
// the camera: along the route, looking ahead (or turned towards a chamber's heart), banked into the turn; as the shader's hwCam
function camFrame(z, look, roll, C){
  const ro = path(z), f0 = norm3(sub3(path(z + 1.5), ro)), f = C && look > 0 ? norm3(add3(f0.map(v => v*(1 - look)), norm3(sub3(C, ro)), look)) : f0;
  const r0 = norm3(cross3([0, 1, 0], f)), u0 = cross3(f, r0), c = Math.cos(roll), s = Math.sin(roll);
  return {ro, f, r: add3(r0.map(v => v*c), u0, s), u: add3(u0.map(v => v*c), r0, -s)};
}
const onScreen = (cam, p) => { const rel = sub3(p, cam.ro), z = dot3(rel, cam.f); return {z, x: dot3(rel, cam.r)/z/1.25, y: dot3(rel, cam.u)/z/1.25}; };

export const hollowChamber = () => { st.want = true; };   // (for tests and labs: open a chamber ahead now)
export default {
  key: 'hollow', kind: 'world', label: 'The Hollow',
  light: {hue: .55, sat: .5, x: 0, y: 0},               // the lamp, from the camera
  // driving, hypnotic music: a steady kick, some weight
  suits: (rf, T) => rf.perc*.3 + rf.low*.15 + T*.2 - rf.mid*.1,
  onBeat(pos){ st.wave = 0; if (pos === 0 && ++st.bars % TUNE.hollow.chamberBars === 0) st.want = true; },   // each kick: a wave of light down the veins; every few bars, a chamber
  params(P, x){
    const T = TUNE.hollow, J = x.J, on = P.w.hollow > .05;
    sectionLayout(st, 'hollowD', J, on, x.dt, T.morphSecs);
    if (st.lastD !== st.D1) { if (st.lastD !== null) st.want = true; st.lastD = st.D1; }   // a new section opens into a chamber
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) st.surge = 1; st.drop = J.lastDrop; }
    st.surge *= Math.exp(-x.dt/T.surgeSecs);
    // a chamber: set ahead on the route, its heart off to one side so the camera passes beside it
    if (st.ch && st.z > st.ch.z + st.ch.R*1.6) st.ch = null;
    if (st.want && !st.ch && on) {
      const z = st.z + T.chamberAhead, R = T.chamberR[0] + hh(z*.013 + st.bars)*(T.chamberR[1] - T.chamberR[0]), c = path(z);
      const f = norm3(sub3(path(z + 1), c)), side = norm3(cross3([0, 1, 0], f)), sg = hh(z*.031) < .5 ? -1 : 1;
      st.ch = {z, R, C: add3(add3(c, side, sg*R*T.chamberSide), [0, 1, 0], R*.08)};
    }
    st.want = false;
    const ch = st.ch, dz = ch ? ch.z - st.z : 1e9, inside = ch ? sst(ch.R*1.3, ch.R*.3, Math.abs(dz)) : 0;
    const want = T.speed*(T.calm + (1 - T.calm)*((J && J.tension) || 0))*(1 + T.surge*st.surge)*(1 - (1 - T.chamberSlow)*inside);
    st.sp += (want - st.sp)*Math.min(1, x.dt*.9);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;   // (in motion time: the pace sets how fast it flies)
    if (on) st.z += st.sp*mdt;
    st.wave += x.dt;
    // banking into the turn (the route's sideways pull, seen from the camera), and turning to look at a chamber's heart
    const a = path(st.z - 1), b = path(st.z), c = path(st.z + 1), acc = [a[0] - 2*b[0] + c[0], a[1] - 2*b[1] + c[1], 0], f0 = norm3(sub3(c, a)), r0 = norm3(cross3([0, 1, 0], f0));
    st.roll += (Math.max(-T.bankMax, Math.min(T.bankMax, -dot3(acc, r0)*T.bank)) - st.roll)*Math.min(1, x.dt*1.5);
    st.look += ((ch ? sst(ch.R*2.6, ch.R*.9, dz)*sst(-ch.R*.2, ch.R*.4, dz)*T.lookAt : 0) - st.look)*Math.min(1, x.dt*2);
    st.bass += ((P.bass || 0)*x.react - st.bass)*Math.min(1, x.dt*8);
    const A = LOOK(st.D0), B = LOOK(st.D1), m = st.tr*st.tr*(3 - 2*st.tr), mix = (u, v) => u + (v - u)*m;
    const flesh = mix(A[5] === 2 ? 1 : 0, B[5] === 2 ? 1 : 0), k0 = Math.floor((st.z - 2)/SEG);
    P.hw = [mix(A[0], B[0]), mix(A[1], B[1]) + flesh*st.bass*T.breathe, st.z, st.surge];
    P.hw2 = [A[2] + (((B[2] - A[2] + .5) % 1 + 1) % 1 - .5)*m, A[3] + (((B[3] - A[3] + .5) % 1 + 1) % 1 - .5)*m, st.wave, x.dim];
    P.hw3 = [st.roll, st.look, (ch ? 1 : 0)*sst(T.chamberAhead + 6, T.chamberAhead - 4, dz), m];
    P.hw4 = [A[4], B[4], A[5], B[5]];
    P.hwC = ch ? [...ch.C, ch.R] : [0, 0, -1e4, 0];
    P.hwK = [k0, kindOf(k0), kindOf(k0 + 1), kindOf(k0 + 2)];
    // a centrepiece stands in the chamber's heart as the camera comes to it (the objects read P.anchor), and is gone once passed
    if (ch && P.w.hollow > .5) {
      const cam = camFrame(st.z, st.look, st.roll, ch.C), s = onScreen(cam, ch.C), near = sst(T.chamberAhead + 4, T.chamberAhead - 6, dz);
      if (s.z < ch.R*.35 || near <= 0) { if (s.z < ch.R*.35) P.anchor = {hide: true}; }
      else { P.anchor = {pos: [s.x*near, s.y*near], size: (ch.R*T.heartSize/s.z/1.25/.49)*near + (1 - near)*.9, dist: Math.hypot(...sub3(ch.C, cam.ro))}; }
    }
    P.hwF = P.anchor && P.anchor.dist ? P.anchor.dist : 2.2;   // its front plane: the walls nearer than the centrepiece (they pass in front of it), or the near walls
  },
  glsl: {
    uniforms: `uniform vec4 uHw, uHw2, uHw3, uHw4, uHwC, uHwK; uniform float uHwF;   // the cave (scale, openness, where along the route, surge); two hues, the kick's wave, dim;
// the camera's bank and turn to the chamber, the chamber's light, the section's blend; the labyrinths and stuffs blended; the chamber (its heart, its size); the route's stretches`,
    functions: `
vec2 hwOff(float k,float z){
  if(k<0.5) return vec2(sin(z*0.13)*1.6+sin(z*0.071)*0.9,cos(z*0.11)*1.1+sin(z*0.05)*0.5);
  if(k<1.5) return vec2(cos(z*0.4),sin(z*0.4))*1.3;
  if(k<2.5) return vec2(sin(z*0.1)*2.2+sin(z*0.047)*0.8,sin(z*0.085+1.3)*2.6);
  return vec2(sin(z*0.3)*2.2,cos(z*0.15)*0.8);
}
vec3 hwPath(float z){   // the route: the stretch z falls in, blended into the next over its last part (their kinds from uHwK)
  float k=floor(z/${SEG}.0), i=k-uHwK.x, m=smoothstep(0.7,1.0,z/${SEG}.0-k);
  float ka=i<0.5 ? uHwK.y : i<1.5 ? uHwK.z : uHwK.w, kb=i<0.5 ? uHwK.z : uHwK.w;
  vec2 o=hwOff(ka,z); if(m>0.0) o=mix(o,hwOff(kb,z),m);
  return vec3(o,z);
}
float hwGy(vec3 p){ return dot(sin(p),cos(p.yzx)); }
float hwTp(vec3 p,float k){   // the section's labyrinth
  if(k<0.5) return hwGy(p);
  if(k<1.5) return (cos(p.x)+cos(p.y)+cos(p.z))*0.55;
  vec3 s=sin(p), c=cos(p);
  if(k<2.5) return (s.x*s.y*s.z+s.x*c.y*c.z+c.x*s.y*c.z+c.x*c.y*s.z)*1.1;
  return (3.0*(c.x+c.y+c.z)+4.0*c.x*c.y*c.z)*0.12;
}
// how far from the rock: the labyrinth, with the route carved clear through it, and a chamber (a hall ringed with pillars)
float hwMap(vec3 p){
  float s=uHw.x, f=hwTp(p*s,uHw4.x); if(uHw3.w>0.001&&uHw4.y!=uHw4.x) f=mix(f,hwTp(p*s,uHw4.y),uHw3.w);
  float rock=-(f+uHw.y)/s*0.55;
  vec3 c=hwPath(p.z); float tun=0.9-length(p.xy-c.xy), d=max(rock,tun);
  if(uHwC.w>0.0){
    vec3 q=p-uHwC.xyz; float R=uHwC.w;
    float hall=R*(1.0+0.12*hwGy(p*0.9))-length(q*vec3(1.0,1.35,1.0));   // a vault, lumpy
    float a=atan(q.z,q.x), sec=6.2831853/7.0, aa=mod(a+sec*0.5,sec)-sec*0.5;
    vec2 pq=vec2(cos(aa),sin(aa))*length(q.xz)-vec2(R*0.74,0.0);
    float pil=length(pq)-R*0.075*(1.0+0.6*abs(q.y)/R);   // pillars round it, flaring at floor and roof
    d=max(min(max(d,hall),pil),tun);
  }
  return d;
}
vec3 hwCam(vec2 sp,out vec3 ro){
  float z=uHw.z; ro=hwPath(z);
  vec3 f=normalize(hwPath(z+1.5)-ro); if(uHw3.y>0.0) f=normalize(f*(1.0-uHw3.y)+normalize(uHwC.xyz-ro)*uHw3.y);
  vec3 r0=normalize(cross(vec3(0.0,1.0,0.0),f)), u0=cross(f,r0), r=r0*cos(uHw3.x)+u0*sin(uHw3.x), u=u0*cos(uHw3.x)-r0*sin(uHw3.x);
  return normalize(f+(r*sp.x+u*sp.y)*1.25);
}
// how far along the view the rock is (-1: none near enough), marching at most n steps
float hwMarch(vec3 ro,vec3 rd,int n,float tmax){
  float t=0.05;
  for(int i=0;i<80;i++){ if(i>=n) break; float d=hwMap(ro+rd*t); if(d<0.004*t) return t; t+=d*0.85; if(t>tmax) break; }
  return -1.0;
}
vec4 hwStuff(float k){ return k<0.5 ? vec4(0.0) : k<1.5 ? vec4(1.0,0.0,0.0,0.0) : k<2.5 ? vec4(0.0,1.0,1.0,0.0) : vec4(0.0,0.5,0.0,1.0); }   // crystal, wet, flesh, ice
vec3 hollow(vec2 sp){
  vec3 ro, rd=hwCam(sp,ro);
  vec3 fogC=hsv(uHue+uHw2.x,0.7,0.12)*(1.0+uHw.w*0.8), c=fogC*(0.7+0.3*rd.y*rd.y);
  vec3 heartC=hsv(uHue+uHw2.y,0.55,1.0)*(0.7+1.3*exp(-uHw2.z*3.0)*uHw2.w);
  float t=hwMarch(ro,rd,80,28.0);
  // the chamber's heart: a glow in the middle of the hall, seen through the haze
  float glow=0.0;
  if(uHwC.w>0.0){ float tc=dot(uHwC.xyz-ro,rd); if(tc>0.0&&(t<0.0||tc<t)){ float dd=length(ro+rd*tc-uHwC.xyz); glow=exp(-dd*dd*1.1)*uHw3.z; } }
  if(t<0.0) return c+hsv(uHue+uHw2.x,0.45,0.5)*pow(max(dot(rd,normalize(hwPath(uHw.z+8.0)-ro)),0.0),12.0)+heartC*glow*0.35;   // the light far down the tunnel
  vec3 p=ro+rd*t; vec2 e=vec2(0.01,0.0);
  vec3 n=normalize(vec3(hwMap(p+e.xyy)-hwMap(p-e.xyy),hwMap(p+e.yxy)-hwMap(p-e.yxy),hwMap(p+e.yyx)-hwMap(p-e.yyx)));
  vec4 M=mix(hwStuff(uHw4.z),hwStuff(uHw4.w),uHw3.w);
  if(M.x>0.0) n=normalize(mix(n,normalize(floor(n*2.2+0.5)),M.x*0.85));   // crystal: faceted
  float lamp=max(dot(n,-rd),0.0), fall=1.0/(1.0+t*t*0.035), ao=clamp(hwMap(p+n*0.25)/0.25,0.0,1.0);   // (the crevices darker)
  float band=0.5+0.5*sin(p.z*0.3+hwGy(p*2.3)*1.5);
  vec3 rockC=mix(hsv(uHue+uHw2.x,0.4,0.85),hsv(uHue+uHw2.y,0.55,0.6),band);
  rockC=mix(rockC,vec3(0.62,0.13,0.14)*(0.7+0.6*band),M.z*0.8);   // flesh
  rockC=mix(rockC,vec3(0.62,0.82,0.95),M.w*0.6);                    // ice
  float grain=vnz(vec2(p.x*7.0+p.z*3.0,p.y*7.0-p.z*2.0))*0.6+vnz(vec2(p.z*19.0,p.x*17.0+p.y*13.0))*0.4;   // the rock's grain and strata
  vec3 col=rockC*(0.08+1.1*lamp*lamp+0.35*pow(lamp,24.0))*fall*(0.35+0.65*ao)*(0.6+0.7*grain*(1.0-M.x*0.6));
  col+=vec3(1.0)*(pow(lamp,50.0)*(M.x*1.4+M.y*0.7))*fall;                      // glints: crystal's facets, wet flesh and ice
  col+=vec3(0.3,0.5,0.6)*pow(1.0-lamp,2.0)*M.w*0.5*fall;                       // ice: light through its edges
  if(uHwC.w>0.0){   // the heart's light on the hall
    vec3 L=uHwC.xyz-p; float d=length(L);
    col+=rockC*heartC*max(dot(n,L/d),0.0)/(1.0+d*d*0.25)*uHw3.z*0.75*(0.4+0.6*ao);
  }
  // the veins: a finer gyroid's seams, glowing, a wave of light rushing down them on each kick
  float g2=abs(hwGy(p*uHw.x*3.3+vec3(1.7,0.3,2.1))), vein=smoothstep(0.05+0.01*t,0.0,g2);
  float wave=exp(-pow((t-uHw2.z*14.0)*0.8,2.0))*exp(-uHw2.z*1.2);
  col+=hsv(uHue+uHw2.y,0.8,1.0)*vein*(0.4+2.5*wave*uHw2.w+1.8*uHw.w)*(0.5+0.5*fall);
  col+=hsv(uHue+uHw2.y,0.7,1.0)*smoothstep(0.3,0.0,g2)*0.08*fall;   // their soft light on the rock round them
  return mix(col,c,1.0-exp(-t*0.07))+heartC*glow*0.35;
}`,
    fn: 'hollow',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uHw, P.hw); gl.uniform4fv(u.uHw2, P.hw2); gl.uniform4fv(u.uHw3, P.hw3); gl.uniform4fv(u.uHw4, P.hw4); gl.uniform4fv(u.uHwC, P.hwC); gl.uniform4fv(u.uHwK, P.hwK); gl.uniform1f(u.uHwF, P.hwF || 2.2); },
  // its front plane: the near walls
  front: {
    fn: 'hollowFront',
    glsl: `
float hollowFront(vec2 sp){ vec3 ro, rd=hwCam(sp,ro); float t=hwMarch(ro,rd,uHwF>2.3 ? 56 : 24,uHwF); return t>0.0 ? 1.0 : 0.0; }   // (the walls nearer than uHwF)`,
    path2d(o, P){   // the near walls: the edge of the frame, outside the tunnel's nearest ring
      const W = o.canvas.width, H = o.canvas.height, R = rings(P, W, H)[0];
      if (!R) return;
      o.rect(0, 0, W, H); o.moveTo(R.pts[0][0], R.pts[0][1]); for (let j = R.pts.length - 1; j >= 0; j--) o.lineTo(R.pts[j][0], R.pts[j][1]); o.closePath();
    },
  },
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, a = Math.min(1, P.w.hollow), h = P.hue, [, , , surge] = P.hw, [h1, h2, wave, dim] = P.hw2;
    o.globalAlpha = a;
    o.fillStyle = hc(h + h1, 65, 12*(1 + surge*.6), 1); o.fillRect(0, 0, W, H);
    const R = rings(P, W, H);
    for (let k = 0; k < R.length; k++) {   // near to far, each ring inside the last: the rock giving way to fog, the veins glowing, the kick's wave rushing down them
      const r = R[k], fog = 1 - Math.exp(-r.t*.085), lw = Math.max(1, H*.012/(1 + r.t*.3));
      o.fillStyle = hc(h + (k % 2 ? h1 : h2), 40 - 15*fog, 5 + 22*fog + 14*r.hall, 1);
      o.beginPath(); r.pts.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y)); o.closePath(); o.fill();
      const w = Math.exp(-(((r.t - wave*14)*.8)**2))*Math.exp(-wave*1.2)*dim;
      o.strokeStyle = hc(h + h2, 80, 60, Math.min(1, (.25 + 2.2*w + 1.5*surge)*(1 - fog*.8))); o.lineWidth = lw; o.stroke();
    }
    const [, , glow] = P.hw3, C = P.hwC;   // the chamber's heart, glowing
    if (C[3] > 0 && glow > .01) {
      const cam = camFrame(P.hw[2], P.hw3[1], P.hw3[0], C), s = onScreen(cam, C);
      if (s.z > .3) { const x = W/2 + s.x*H, y = H/2 - s.y*H, rr = H*C[3]*.5/s.z/1.25, g = o.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, hc(h + h2, 70, 75, .8*glow)); g.addColorStop(1, hc(h + h2, 70, 40, 0));
        o.globalCompositeOperation = 'lighter'; o.fillStyle = g; o.fillRect(x - rr, y - rr, rr*2, rr*2); o.globalCompositeOperation = 'source-over'; }
    }
    o.globalAlpha = 1;
  },
};
// simple mode's tunnel: cross-sections of the route ahead, projected (each a wobbling ring, widening into a chamber), nearest first
function rings(P, W, H){
  const z0 = P.hw[2], C = P.hwC, cam = camFrame(z0, P.hw3[1], P.hw3[0], C[3] > 0 ? C : null), out = [];
  for (let k = 0; k < 22; k++) {
    const t = .6 + k*k*.09, c = path(z0 + t), s = onScreen(cam, c); if (s.z <= .2) continue;
    const hall = C[3] > 0 ? sst(C[3]*1.3, C[3]*.4, Math.abs(z0 + t - C[2])) : 0, pts = [];
    const cx = W/2 + s.x*H, cy = H/2 - s.y*H, base = .95 + hall*(C[3] - .95);
    for (let j = 0; j < 28; j++) { const a = j/28*Math.PI*2 + P.hw3[0], rad = (base + .3*Math.sin(a*3 + (z0 + t)*.7) + .18*Math.sin(a*5 - (z0 + t)*.4))/s.z/1.25*H;
      pts.push([cx + Math.cos(a)*rad, cy - Math.sin(a)*rad]); }
    out.push({t, pts, hall});
  }
  return out;
}
