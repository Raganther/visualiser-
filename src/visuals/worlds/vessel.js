// The Vessel: a flight along an artery, inside the body. The tube winds on for ever, its walls wet and ribbed with folds,
// a fine network of veins glowing in them, side branches opening off it now and then; red cells (biconcave discs)
// tumble past with the flow. The heart's pulse drives it: each kick sends a wave of swelling
// down the walls and surges the flow, the cells rushing past; a build quickens the flight, a drop floods it with light.
// Each section is its own vessel (an artery, red; a vein, purple-blue; lymph, pale gold; a nerve, blue, with sparks
// running along it instead of cells) and its own size (a returning section its own again). The user asked for more
// self-contained 3D worlds after the Hollow; this one goes with the heart. Its front plane is the near walls. Simple mode
// draws the tube's rings receding, swelling with the pulse, and cells drifting past.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null, flow: 0, push: 0, z2d: null};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
// a section's vessel: its kind (0 artery, 1 vein, 2 lymph, 3 nerve), its width, a hue nudge, how many cells
const LOOK = D => [D ? Math.floor(hh(D + .7)*4) : 0, .9 + hh(D + 2.1)*.5, (hh(D + 4.3) - .5)*.08, .5 + hh(D + 6.1)*.5];
const path = z => [Math.sin(z*.11)*1.4 + Math.sin(z*.053)*1.1, Math.cos(z*.09)*.9 + Math.sin(z*.041)*.8, z];
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
export const vesselAt = z => { st.z = z; };   // (for tests and labs: put the camera this far along)
export default {
  key: 'vessel', kind: 'world', lowRes: () => 1, heavy: () => true, label: 'The Vessel',   // (ray-marched: a slow device or a lower graphics level draws it smaller first, render/quality.js)
  light: {hue: .0, sat: .6, x: 0, y: 0},               // the lamp, warm through the walls
  // a steady, heavy pulse: the kick and the low end
  suits: (rf, T) => rf.low*.3 + rf.perc*.2 - rf.bright*.15 + T*.1,
  onBeat(){ st.wave = 0; st.push = 1; },   // each kick: a wave of swelling down the walls, and the flow surges
  params(P, x){
    const T = TUNE.vessel, J = x.J, on = P.w.vessel > .05;
    sectionLayout(st, 'vesD', J, on, x.dt, T.morphSecs);
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) st.surge = 1; st.drop = J.lastDrop; }
    st.surge *= Math.exp(-x.dt/T.surgeSecs); st.push *= Math.exp(-x.dt*T.pushDecay);
    const want = T.speed*(T.calm + (1 - T.calm)*((J && J.tension) || 0))*(1 + T.surge*st.surge + T.push*st.push);
    st.sp += (want - st.sp)*Math.min(1, x.dt*2);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;   // (in motion time)
    if (on) { st.z += st.sp*mdt; st.flow += st.sp*mdt*T.cellsFaster; }   // the cells drift a little faster than the camera
    st.wave += x.dt;
    const A = LOOK(st.D0), B = LOOK(st.D1), m = st.tr*st.tr*(3 - 2*st.tr), mix = (a, b) => a + (b - a)*m;
    P.vs = [st.z, st.flow, st.wave, st.surge];
    P.vs2 = [A[0], B[0], m, mix(A[1], B[1])];
    P.vs3 = [mix(A[2], B[2]), mix(A[3], B[3])*T.cells, st.push, x.dim];
    // a centrepiece floats in the middle of the vessel every `gate` units, the walls and cells nearer than it passing in front
    if (P.w.vessel > .5) {
      const kc = Math.ceil((st.z + 1)/T.gate)*T.gate, C = path(kc), ro = path(st.z), f = norm3(sub3(path(st.z + 1.5), ro)), r = norm3(cross3([0, 1, 0], f)), u = cross3(f, r);
      const rel = sub3(C, ro), z = dot3(rel, f);
      if (z < 1.2) P.anchor = {hide: true};
      else if (z < T.gate*.8) P.anchor = {pos: [dot3(rel, r)/z/1.25, dot3(rel, u)/z/1.25], size: T.heartSize/z/1.25/.49, dist: Math.hypot(...rel)};
    }
    P.vsF = P.anchor && P.anchor.dist ? P.anchor.dist : 1.8;   // its front plane: what's nearer than the centrepiece, or the near walls
  },
  glsl: {
    uniforms: `uniform vec4 uVs, uVs2, uVs3; uniform float uVsF, uVsG;   // the Vessel: where along it, the cells' drift, the kick's wave, the surge; its kinds blended, its width; a hue nudge, the cells, the pulse, dim; the front plane's depth; the glowing layers on its walls`,
    functions: `
vec3 vsPath(float z){ return vec3(sin(z*0.11)*1.4+sin(z*0.053)*1.1,cos(z*0.09)*0.9+sin(z*0.041)*0.8,z); }
// the tube: a wide radius round the route, ribbed with folds, swelling where the kick's wave has reached; branches open off it
float vsWall(vec3 p){
  vec3 c=vsPath(p.z); vec2 q=p.xy-c.xy; float a=atan(q.y,q.x);
  float R=uVs2.w*(1.0+0.05*sin(p.z*2.3+a*2.0)+0.03*sin(a*7.0+p.z*0.7));
  float wv=uVs.z*6.0, swell=exp(-pow((p.z-uVs.x-wv)*0.7,2.0))*0.12*uVs3.w*exp(-uVs.z*0.9);   // the pulse running down it
  R*=1.0+swell+0.05*uVs3.z;
  float d=R-length(q);
  // a branch every 14 units: a side vessel leaving at an angle
  float k=floor(p.z/14.0), bz=k*14.0+7.0, ang=hash(vec2(k,3.1))*6.2831853;
  vec3 bc=vsPath(bz), bd=normalize(vec3(cos(ang),sin(ang),0.6)), pb=p-bc;
  float h=max(dot(pb,bd),0.0), br=length(pb-bd*h)-uVs2.w*0.55*(1.0-0.15*h);
  return max(d,-br);   // (inside the tube or a branch: open)
}
// the cells: one in each cell of a grid that drifts with the flow, near the tube's middle; red discs dimpled in the middle
float vsCells(vec3 p,out float id){
  vec3 c=vsPath(p.z); vec3 q=vec3(p.xy-c.xy,p.z-uVs.y);
  vec3 g=floor(q/0.9), f=q-(g+0.5)*0.9; id=hash(g.xz+g.y*7.3);
  if(id>uVs3.y||length((g.xy+0.5)*0.9)>uVs2.w*0.8) return 1.0;
  float a=id*40.0+uTime*(0.6+id), b=id*17.0+uTime*0.4;
  f.yz=mat2(cos(a),-sin(a),sin(a),cos(a))*f.yz; f.xy=mat2(cos(b),-sin(b),sin(b),cos(b))*f.xy;
  float r=length(f.xz), disc=length(vec2(max(r-0.13,0.0),f.y))-0.06+0.035*exp(-r*r*60.0);
  return disc;
}
float vsMap(vec3 p,out float hit){ float id, w=vsWall(p), ce=uVs2.x>2.5&&uVs2.y>2.5 ? 1.0 : vsCells(p,id); hit=ce<w ? 1.0 : 0.0; return min(w,ce); }
vec3 vsCam(vec2 sp,out vec3 ro){
  float z=uVs.x; ro=vsPath(z);
  vec3 f=normalize(vsPath(z+1.5)-ro), r=normalize(cross(vec3(0.0,1.0,0.0),f)), u=cross(f,r);
  return normalize(f+(r*sp.x+u*sp.y)*1.25);
}
vec3 vsTint(float k){ return k<0.5 ? vec3(0.75,0.08,0.07) : k<1.5 ? vec3(0.35,0.08,0.3) : k<2.5 ? vec3(0.7,0.55,0.2) : vec3(0.12,0.25,0.7); }   // artery, vein, lymph, nerve
vec3 vessel(vec2 sp){
  vec3 ro, rd=vsCam(sp,ro);
  vec3 tint=mix(vsTint(uVs2.x),vsTint(uVs2.y),uVs2.z), fogC=tint*0.08*(1.0+uVs.w*1.5);
  float t=0.05, hit=0.0;
  for(int i=0;i<70;i++){ float d=vsMap(ro+rd*t,hit); if(d<0.003*t) break; t+=d*0.8; if(t>24.0){ t=-1.0; break; } }
  float nerve=smoothstep(2.5,3.0,mix(uVs2.x,uVs2.y,uVs2.z));
  if(t<0.0) return fogC*(1.0+0.6*exp(-uVs.z*2.0)*uVs3.w);
  vec3 p=ro+rd*t; vec2 e=vec2(0.004,0.0); float hh2;
  vec3 n=normalize(vec3(vsMap(p+e.xyy,hh2)-vsMap(p-e.xyy,hh2),vsMap(p+e.yxy,hh2)-vsMap(p-e.yxy,hh2),vsMap(p+e.yyx,hh2)-vsMap(p-e.yyx,hh2)));
  float lamp=max(dot(n,-rd),0.0), fall=1.0/(1.0+t*t*0.03), fres=pow(1.0-lamp,3.0);
  vec3 col;
  if(hit>0.5){   // a cell: red and glossy, light through its thin middle
    col=vec3(0.85,0.08,0.06)*(0.15+0.9*lamp)+vec3(1.0,0.4,0.3)*fres*0.5+vec3(1.0)*pow(lamp,60.0)*0.6;
  } else {      // the wall: wet, translucent, its veins glowing, brighter where the pulse is
    float vein=smoothstep(0.035,0.0,abs(vnz(vec2(atan(p.y-vsPath(p.z).y,p.x-vsPath(p.z).x)*3.0,p.z*1.7))-0.5));
    float fine=smoothstep(0.04,0.0,abs(vnz(vec2(atan(p.y-vsPath(p.z).y,p.x-vsPath(p.z).x)*9.0,p.z*5.0))-0.5));
    col=tint*(0.12+1.0*lamp*lamp)+tint*fres*0.8+vec3(1.0)*pow(lamp,50.0)*0.5;
    vec3 vc=mix(tint*1.6+0.1,vec3(0.4,0.75,1.0),nerve);
    float pulse=exp(-pow((p.z-uVs.x-uVs.z*6.0)*0.7,2.0))*exp(-uVs.z*0.9)*uVs3.w;
    col+=vc*(vein*(0.3+2.2*pulse+uVs.w)+fine*0.2);
    col+=wallGlow(vec2(atan(p.y-vsPath(p.z).y,p.x-vsPath(p.z).x)/6.2831853+0.5,p.z*0.06))*uVsG*(0.4+0.6*lamp);   // the glowing layers, wrapped round the vessel
    if(nerve>0.0) col+=vec3(0.5,0.8,1.0)*nerve*smoothstep(0.92,1.0,sin(p.z*3.0-uTime*12.0+vein*3.0))*vein*2.0;   // sparks along a nerve
  }
  col*=fall;
  return mix(col,fogC,1.0-exp(-t*0.08));
}`,
    fn: 'vessel',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uVs, P.vs); gl.uniform4fv(u.uVs2, P.vs2); gl.uniform4fv(u.uVs3, P.vs3); gl.uniform1f(u.uVsF, P.vsF || 1.8); gl.uniform1f(u.uVsG, TUNE.vessel.wallGlow); },
  front: {
    fn: 'vesselFront',
    glsl: `
float vesselFront(vec2 sp){ vec3 ro, rd=vsCam(sp,ro); float t=0.05, hit; int n=uVsF>1.9 ? 48 : 20; for(int i=0;i<48;i++){ if(i>=n) break; float d=vsMap(ro+rd*t,hit); if(d<0.003*t) return 1.0; t+=d*0.8; if(t>uVsF) break; } return 0.0; }`,
    path2d(o, P){
      const W = o.canvas.width, H = o.canvas.height, R = rings(P, W, H)[0];
      if (!R) return;
      o.rect(0, 0, W, H); o.moveTo(R.pts[0][0], R.pts[0][1]); for (let j = 1; j < R.pts.length; j++) o.lineTo(R.pts[j][0], R.pts[j][1]); o.closePath();   // (the ring winds against the rect, so it cuts a hole)
    },
  },
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, a = Math.min(1, P.w.vessel), [, , wave, surge] = P.vs, kinds = P.vs2;
    const kind = Math.round(kinds[2] < .5 ? kinds[0] : kinds[1]), hue = [0, .82, .12, .6][kind] + P.vs3[0], dim = P.vs3[3];
    o.globalAlpha = a;
    o.fillStyle = hc(hue, 70, 6*(1 + surge), 1); o.fillRect(0, 0, W, H);
    const R = rings(P, W, H);
    for (let k = 0; k < R.length; k++) {
      const r = R[k], fog = 1 - Math.exp(-r.t*.09), pulse = Math.exp(-(((r.t - wave*6)*.7)**2))*Math.exp(-wave*.9)*dim;
      o.fillStyle = hc(hue, 70, (8 + 22*(1 - fog))*(1 + pulse*.6), 1);
      o.beginPath(); r.pts.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y)); o.closePath(); o.fill();
      o.strokeStyle = hc(hue + .03, 80, 55, Math.min(1, (.2 + 1.5*pulse + surge)*(1 - fog*.8))); o.lineWidth = Math.max(1, H*.01/(1 + r.t*.3)); o.stroke();
    }
    // cells drifting past
    if (kind < 3) {
      const dz = st.z2d == null ? 0 : P.vs[0] - st.z2d; st.z2d = P.vs[0];
      for (const c of CELLS) {
        c.z -= dz*.4; if (c.z < .4) { c.z += 7; c.a = (c.a + 2.1) % (Math.PI*2); }
        const k = 1/c.z, x = W/2 + Math.cos(c.a)*c.r*k*H*.45, y = H/2 + Math.sin(c.a)*c.r*k*H*.45, s = Math.max(1.5, 9*k*H/540);
        o.fillStyle = hc(kind === 1 ? .9 : .0, 80, 45, Math.min(1, k*1.2)); o.beginPath(); o.ellipse(x, y, s, s*(.5 + .5*Math.abs(Math.sin(c.a*3 + P.vs[1]))), c.a, 0, Math.PI*2); o.fill();
      }
    }
    o.globalAlpha = 1;
  },
};
const CELLS = Array.from({length: 40}, (_, i) => ({a: hh(i + .3)*Math.PI*2, r: hh(i + 1.3)*.7, z: .5 + hh(i + 2.3)*6.5}));
// simple mode's tube: cross-sections of the route ahead, projected, nearest first
function rings(P, W, H){
  const z0 = P.vs[0], c0 = path(z0), c1 = path(z0 + 1.5), f = norm3(sub3(c1, c0)), r = norm3(cross3([0, 1, 0], f)), up = cross3(f, r), out = [];
  const Rw = P.vs2[3], wave = P.vs[2];
  for (let k = 0; k < 22; k++) {
    const t = .6 + k*k*.09, c = path(z0 + t), rel = sub3(c, c0), zc = dot3(rel, f); if (zc <= .2) continue;
    const swell = 1 + Math.exp(-(((t - wave*6)*.7)**2))*.12*Math.exp(-wave*.9);
    const cx = W/2 + dot3(rel, r)/zc/1.25*H, cy = H/2 - dot3(rel, up)/zc/1.25*H, pts = [];
    for (let j = 0; j < 24; j++) { const a = j/24*Math.PI*2, rad = Rw*swell*(1 + .05*Math.sin((z0 + t)*2.3 + a*2))/zc/1.25*H; pts.push([cx + Math.cos(a)*rad, cy - Math.sin(a)*rad]); }
    out.push({t, pts});
  }
  return out;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross3 = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v/l); };
