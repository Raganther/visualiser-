// The Corridor: an endless hall of neon frames in the dark, flown through, over a black mirror floor that doubles them.
// Each kick sends a wave of light rushing away down the frames; every fourth frame burns brighter; a build quickens the
// flight, and a drop strobes the whole hall. Each section its own frame (squares, arches, hexagons, rings) and width,
// grown out of the last (a returning section its own again); the colours are the palette's. The most club-like of the
// 3D worlds, for the user's minimal techno, and cheap: no walls, only the frames' glow gathered along each ray. A
// centrepiece stands in the hall every `gate` units, the frames nearer than it passing in front (P.anchor, with its
// distance). Its front plane is the near frames. Simple mode draws the frames as outlines receding, mirrored in the floor.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
const SP = 2.4, FLOOR = -1.1, H = 1.1;   // a frame every SP units; the floor; the frames' top
// a section's hall: its frame (0 square, 1 arch, 2 hexagon, 3 ring), how wide
const LOOK = D => [D ? Math.floor(hh(D + .3)*4) : 1, .85 + hh(D + 1.7)*.5];
const path = z => [Math.sin(z*.045)*2.2 + Math.sin(z*.017)*1.5, 0, z];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
function camFrame(z){   // the camera down the middle of the hall, a little below the frames' centre, looking along it (as crRay)
  const ro = [path(z)[0], -.15, z], a = [path(z + 3)[0], -.15, z + 3], fw = sub3(a, ro), fl = Math.hypot(...fw), f = fw.map(v => v/fl);
  const rl = Math.hypot(f[2], f[0]), r = [f[2]/rl, 0, -f[0]/rl], u = [f[1]*r[2] - f[2]*r[1], f[2]*r[0] - f[0]*r[2], f[0]*r[1] - f[1]*r[0]];
  return {ro, f, r, u};
}
const onScreen = (cam, p) => { const rel = sub3(p, cam.ro), z = dot3(rel, cam.f); return {z, x: dot3(rel, cam.r)/z/1.25, y: dot3(rel, cam.u)/z/1.25}; };
// a frame's outline in its own plane (for simple mode), cut off at the floor
function outline(kind, w){
  const W = 1.5*w, R = 1.35*w, pts = [];
  if (kind === 0) pts.push([-W, FLOOR], [-W, H], [W, H], [W, FLOOR]);
  else if (kind === 1) { pts.push([-W, FLOOR]); for (let i = 0; i <= 12; i++) { const a = Math.PI - i/12*Math.PI; pts.push([Math.cos(a)*W, H - W + Math.sin(a)*W]); } pts.push([W, FLOOR]); }
  else if (kind === 2) for (let i = 0; i <= 6; i++) { const a = i/6*Math.PI*2 + Math.PI/2; pts.push([Math.cos(a)*R, Math.max(FLOOR, Math.sin(a)*R)]); }
  else for (let i = 0; i <= 28; i++) { const a = i/28*Math.PI*2; pts.push([Math.cos(a)*R, Math.max(FLOOR, Math.sin(a)*R)]); }
  return pts;
}
export const corridorAt = z => { st.z = z; };   // (for tests and labs: put the camera this far along)
export default {
  key: 'corridor', kind: 'world', lowRes: () => 1, heavy: () => true, label: 'The Corridor',   // (ray-marched: a slow device or a lower graphics level draws it smaller first, render/quality.js)
  light: {hue: .85, sat: .7, x: 0, y: -.3},
  // driving, percussive music: the kick and the build
  suits: (rf, T) => rf.perc*.35 + rf.busy*.1 + T*.25 - rf.mid*.05,
  onBeat(){ st.wave = 0; },   // each kick: a wave of light rushing away down the frames
  params(P, x){
    const T = TUNE.corridor, J = x.J, on = P.w.corridor > .05, ten = (J && J.tension) || 0;
    sectionLayout(st, 'crD', J, on, x.dt, T.morphSecs);
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) st.surge = 1; st.drop = J.lastDrop; }
    st.surge *= Math.exp(-x.dt/T.surgeSecs);
    const want = T.speed*(T.calm + (1 - T.calm)*ten)*(1 + T.surge*st.surge);
    st.sp += (want - st.sp)*Math.min(1, x.dt*.8);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;   // (in motion time)
    if (on) st.z += st.sp*mdt;
    st.wave += x.dt;
    const A = LOOK(st.D0), B = LOOK(st.D1), m = st.tr*st.tr*(3 - 2*st.tr);
    const strobe = st.surge > .15 ? (Math.floor(x.t*T.strobeHz*2) % 2)*st.surge*x.dim : 0;   // a drop strobes the hall
    P.cr = [st.z, path(st.z)[0], path(st.z + 3)[0], st.surge];
    P.cr2 = [A[0], B[0], m, A[1] + (B[1] - A[1])*m];
    P.cr3 = [st.wave*T.waveSpeed, Math.exp(-st.wave*T.waveFade)*x.dim, strobe, (P.treb || 0)*x.react];
    // the centrepiece stands in the hall every `gate` units, and is gone once the camera is past it
    if (P.w.corridor > .5) {
      const kc = Math.ceil((st.z + 1)/T.gate)*T.gate, C = [path(kc)[0], -.05, kc], cam = camFrame(st.z), s = onScreen(cam, C);
      if (s.z < 1.5) P.anchor = {hide: true};
      else if (s.z < T.gate*.8) P.anchor = {pos: [s.x, s.y], size: T.heartSize/s.z/1.25/.49, dist: Math.hypot(...sub3(C, cam.ro))};
    }
    P.crF = P.anchor && P.anchor.dist ? P.anchor.dist : 2.5;   // its front plane: the frames nearer than the centrepiece, or the near ones
  },
  glsl: {
    uniforms: `uniform vec4 uCr, uCr2, uCr3; uniform float uCrF, uCrG, uCrW;   // the Corridor: where along it, the hall's line here and ahead, the surge; its frames blended, width; the kick's wave (how far, how bright), the strobe, the hats; the front plane's depth; the glow; the glowing layers in the floor`,
    functions: `
float crX(float z){ return sin(z*0.045)*2.2+sin(z*0.017)*1.5; }
// a frame's outline (its distance in the frame's plane): 0 square, 1 arch, 2 hexagon, 3 ring
float crShape(vec2 q,float k,float w){
  float W=1.5*w, R=1.35*w;
  if(k<0.5){ vec2 d=abs(q-vec2(0.0,${((H + FLOOR)/2).toFixed(2)}))-vec2(W,${((H - FLOOR)/2).toFixed(2)}); return abs(length(max(d,0.0))+min(max(d.x,d.y),0.0)); }
  if(k<1.5){ float cy=${H.toFixed(2)}-W; return q.y>cy ? abs(length(q-vec2(0.0,cy))-W) : abs(abs(q.x)-W); }
  if(k<2.5){ vec2 hp=abs(q.yx); hp-=2.0*min(dot(vec2(-0.866025,0.5),hp),0.0)*vec2(-0.866025,0.5); float r=R*0.866;
    return abs(length(hp-vec2(clamp(hp.x,-0.57735*r,0.57735*r),r))*sign(hp.y-r)); }
  return abs(length(q)-R);
}
float crMap(vec3 p,out float id){
  float k=floor(p.z/${SP.toFixed(1)}+0.5); id=k; vec2 q=vec2(p.x-crX(k*${SP.toFixed(1)}),p.y); float dz=p.z-k*${SP.toFixed(1)};
  float s=mix(crShape(q,uCr2.x,uCr2.w),crShape(q,uCr2.y,uCr2.w),uCr2.z);
  return max(length(vec2(s,dz))-0.03,${FLOOR.toFixed(2)}-p.y);   // a thin neon tube, standing on the floor
}
vec3 crRay(vec2 sp,out vec3 ro){ ro=vec3(uCr.y,-0.15,uCr.x); vec3 f=normalize(vec3(uCr.z,-0.15,uCr.x+3.0)-ro), r=normalize(cross(vec3(0.0,1.0,0.0),f)), u=cross(f,r); return normalize(f+(r*sp.x+u*sp.y)*1.25); }
// how bright a frame burns: a little always, every fourth more, the kick's wave rushing away, the drop's strobe
vec3 crCol(float id){
  float ahead=id*${SP.toFixed(1)}-uCr.x, wave=exp(-pow((ahead-uCr3.x)*0.35,2.0))*uCr3.y;
  float lit=0.35+0.4*step(mod(id,4.0),0.5)+2.2*wave+1.2*uCr.w+2.5*uCr3.z;
  float m=mod(id,3.0), h=m<1.0 ? uPal.x : m<2.0 ? uPal.y : uPal.z;
  return hsv(uHue+h,0.85-0.5*uCr3.z,1.0)*lit;
}
// the frames' glow gathered along a ray up to tmax (a hit on a tube adds its core)
vec3 crGlow(vec3 ro,vec3 rd,float tmax,int n){
  vec3 g=vec3(0.0); float t=0.05, id;
  for(int i=0;i<90;i++){ if(i>=n) break; vec3 p=ro+rd*t; float d=crMap(p,id), st=max(d*0.8,0.03);
    g+=crCol(id)*(0.0007/(0.0004+d*d))*st*exp(-t*0.025);
    if(d<0.003){ g+=crCol(id)*0.6*exp(-t*0.025); break; }
    t+=st; if(t>tmax) break; }
  return g;
}
vec3 corridor(vec2 sp){
  vec3 ro, rd=crRay(sp,ro);
  float tf=rd.y<-0.001 ? (${FLOOR.toFixed(2)}-ro.y)/rd.y : 80.0;
  vec3 col=crGlow(ro,rd,min(tf,60.0),90)*uCrG;
  if(tf<60.0){   // the black mirror floor: the hall again, upside down and dimmer, and a faint line under each frame
    vec3 fp=ro+rd*tf, rr=vec3(rd.x,-rd.y,rd.z);
    col+=crGlow(fp+rr*0.02,rr,30.0,40)*uCrG*0.4*exp(-tf*0.04);
    float id=floor(fp.z/${SP.toFixed(1)}+0.5), ln=exp(-pow((fp.z-id*${SP.toFixed(1)})*14.0,2.0))*step(abs(fp.x-crX(id*${SP.toFixed(1)})),1.5*uCr2.w);   // (only between the frame's feet)
    col+=crCol(id)*ln*0.15*exp(-tf*0.06);
    col+=wallGlow(vec2(fp.x*0.12+0.5,fp.z*0.05))*uCrW*exp(-tf*0.05);   // the glowing layers, reflected in the black floor
  }
  return col;
}`,
    fn: 'corridor',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uCr, P.cr); gl.uniform4fv(u.uCr2, P.cr2); gl.uniform4fv(u.uCr3, P.cr3); gl.uniform1f(u.uCrF, P.crF || 2.5); gl.uniform1f(u.uCrG, TUNE.corridor.glow); gl.uniform1f(u.uCrW, TUNE.corridor.wallGlow); },
  front: {
    fn: 'corridorFront',
    glsl: `
float corridorFront(vec2 sp){ vec3 ro, rd=crRay(sp,ro); float t=0.05, id;
  for(int i=0;i<48;i++){ float d=crMap(ro+rd*t,id); if(d<0.03) return 1.0; t+=max(d*0.8,0.02); if(t>uCrF) break; }
  return 0.0; }`,
    path2d(o, P){ const W = o.canvas.width, H2 = o.canvas.height; o.rect(0, 0, W, H2*.06); },
  },
  // simple mode: the frames' outlines far to near, each doubled in the floor
  draw2d(o, P){
    const W = o.canvas.width, Hh = o.canvas.height, a = Math.min(1, P.w.corridor), [kA, kB, m, w] = P.cr2, kind = Math.round(m < .5 ? kA : kB);
    const z0 = P.cr[0], cam = camFrame(z0), [wf, wb, strobe] = P.cr3, surge = P.cr[3], pts = outline(kind, w), pal = P.pal || [0, .33, .66];
    o.globalAlpha = a; o.fillStyle = '#000'; o.fillRect(0, 0, W, Hh);
    o.lineCap = 'round'; o.lineJoin = 'round';
    for (let k = Math.floor(z0/SP) + 22; k > z0/SP; k--) {
      const zc = k*SP, cx = path(zc)[0], c = onScreen(cam, [cx, 0, zc]); if (c.z < .3) continue;
      const ahead = zc - z0, wave = Math.exp(-(((ahead - wf)*.35)**2))*wb, lit = Math.min(1.6, .35 + .4*(k % 4 === 0) + 2.2*wave + 1.2*surge + 2.5*strobe);
      const fog = Math.exp(-c.z*.025), hue = P.hue + pal[((k % 3) + 3) % 3], px = Hh*.5/c.z/1.25;
      for (const mir of [1, 0]) {   // the reflection first, dimmer
        o.beginPath();
        pts.forEach(([qx, qy], i) => { const y = mir ? qy : 2*FLOOR - qy, s = onScreen(cam, [cx + qx, y, zc]);
          const X = W/2 + s.x*Hh*.5, Y = Hh/2 - s.y*Hh*.5; i ? o.lineTo(X, Y) : o.moveTo(X, Y); });
        const al = Math.min(1, lit*fog*(mir ? 1 : .35));
        o.strokeStyle = hc(hue, 90 - 50*strobe, 55, al*.35); o.lineWidth = Math.max(2, .16*px); o.stroke();
        o.strokeStyle = hc(hue, 70 - 50*strobe, 75, al); o.lineWidth = Math.max(1, .05*px); o.stroke();
      }
    }
    o.globalAlpha = 1;
  },
};
