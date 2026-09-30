// The Hollow: a cave to fly through for ever. The rock is a gyroid (sin·cos summed round the axes: a labyrinth of smooth
// branching tunnels with no end), with the camera's winding path carved clear through it, so it flies on without striking
// a wall. The walls are lit by a lamp on the camera and fade into coloured fog far off; veins of light (a finer gyroid's
// seams) run through the rock, and each kick sends a wave of light rushing down them into the depths. A build quickens the
// flight, a drop surges it and flares the veins; each section brings its own scale of cave and its own hues (a returning
// section its own again). A place to explore (the user's taste, principle 4). Its front plane is the near walls, so glow
// can sit deep in the tunnel. Simple mode draws rings of the tunnel receding into the fog.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
const LOOK = D => [.75 + hh(D + .3)*.5, -.35 + hh(D + 1.7)*.35, hh(D + 3.1), hh(D + 5.9)];   // a section's cave: scale, how open, two hues
// the camera's path through the rock (the same in both renderers)
const path = z => [Math.sin(z*.13)*1.6 + Math.sin(z*.071)*.9, Math.cos(z*.11)*1.1 + Math.sin(z*.05)*.5, z];
export default {
  key: 'hollow', kind: 'world', label: 'The Hollow',
  light: {hue: .55, sat: .5, x: 0, y: 0},               // the lamp, from the camera
  // driving, hypnotic music: a steady kick, some weight
  suits: (rf, T) => rf.perc*.3 + rf.low*.15 + T*.2 - rf.mid*.1,
  onBeat(){ st.wave = 0; },   // each kick: a wave of light down the veins
  params(P, x){
    const T = TUNE.hollow, J = x.J, on = P.w.hollow > .05;
    sectionLayout(st, 'hollowD', J, on, x.dt, T.morphSecs);
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) st.surge = 1; st.drop = J.lastDrop; }
    st.surge *= Math.exp(-x.dt/T.surgeSecs);
    const want = T.speed*(T.calm + (1 - T.calm)*((J && J.tension) || 0))*(1 + T.surge*st.surge);
    st.sp += (want - st.sp)*Math.min(1, x.dt*.7);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;   // (in motion time: the pace sets how fast it flies)
    if (on) st.z += st.sp*mdt;
    st.wave += x.dt;
    const A = LOOK(st.D0), B = LOOK(st.D1), m = st.tr*st.tr*(3 - 2*st.tr), mix = (a, b) => a + (b - a)*m;
    P.hw = [mix(A[0], B[0]), mix(A[1], B[1]), st.z, st.surge];
    P.hw2 = [A[2] + (((B[2] - A[2] + .5) % 1 + 1) % 1 - .5)*m, A[3] + (((B[3] - A[3] + .5) % 1 + 1) % 1 - .5)*m, st.wave, x.dim];
  },
  glsl: {
    uniforms: 'uniform vec4 uHw, uHw2;   // the cave\'s scale, openness, where the camera is along its path, the surge; two hues, the kick\'s wave, dim',
    functions: `
vec3 hwPath(float z){ return vec3(sin(z*0.13)*1.6+sin(z*0.071)*0.9,cos(z*0.11)*1.1+sin(z*0.05)*0.5,z); }
float hwGy(vec3 p){ return dot(sin(p),cos(p.yzx)); }
// how far from the rock: the gyroid's labyrinth, with the camera's path carved clear through it
float hwMap(vec3 p){
  float s=uHw.x, rock=-(hwGy(p*s)+uHw.y)/s*0.55;
  vec3 c=hwPath(p.z); float tun=0.9-length(p.xy-c.xy);
  return max(rock,tun);
}
vec3 hwCam(vec2 sp,out vec3 ro){
  float z=uHw.z; ro=hwPath(z);
  vec3 f=normalize(hwPath(z+1.5)-ro), r=normalize(cross(vec3(0.0,1.0,0.0),f)), u=cross(f,r);
  return normalize(f+(r*sp.x+u*sp.y)*1.25);
}
// how far along the view the rock is (-1: none near enough), marching at most n steps
float hwMarch(vec3 ro,vec3 rd,int n,float tmax){
  float t=0.05;
  for(int i=0;i<80;i++){ if(i>=n) break; float d=hwMap(ro+rd*t); if(d<0.004*t) return t; t+=d*0.85; if(t>tmax) break; }
  return -1.0;
}
vec3 hollow(vec2 sp){
  vec3 ro, rd=hwCam(sp,ro);
  vec3 fogC=hsv(uHue+uHw2.x,0.7,0.12)*(1.0+uHw.w*0.8), c=fogC*(0.7+0.3*rd.y*rd.y);
  float t=hwMarch(ro,rd,80,28.0);
  if(t<0.0) return c+hsv(uHue+uHw2.x,0.45,0.5)*pow(max(dot(rd,normalize(hwPath(uHw.z+8.0)-ro)),0.0),12.0);   // the light far down the tunnel
  vec3 p=ro+rd*t; vec2 e=vec2(0.01,0.0);
  vec3 n=normalize(vec3(hwMap(p+e.xyy)-hwMap(p-e.xyy),hwMap(p+e.yxy)-hwMap(p-e.yxy),hwMap(p+e.yyx)-hwMap(p-e.yyx)));
  float lamp=max(dot(n,-rd),0.0), fall=1.0/(1.0+t*t*0.035), ao=clamp(hwMap(p+n*0.25)/0.25,0.0,1.0);   // (the crevices darker)
  float band=0.5+0.5*sin(p.z*0.3+hwGy(p*2.3)*1.5);
  vec3 rockC=mix(hsv(uHue+uHw2.x,0.4,0.85),hsv(uHue+uHw2.y,0.55,0.6),band);
  float grain=vnz(vec2(p.x*7.0+p.z*3.0,p.y*7.0-p.z*2.0))*0.6+vnz(vec2(p.z*19.0,p.x*17.0+p.y*13.0))*0.4;   // the rock's grain and strata
  vec3 col=rockC*(0.08+1.1*lamp*lamp+0.35*pow(lamp,24.0))*fall*(0.35+0.65*ao)*(0.6+0.7*grain);
  // the veins: a finer gyroid's seams, glowing, a wave of light rushing down them on each kick
  float g2=abs(hwGy(p*uHw.x*3.3+vec3(1.7,0.3,2.1))), vein=smoothstep(0.05+0.01*t,0.0,g2);
  float wave=exp(-pow((t-uHw2.z*14.0)*0.8,2.0))*exp(-uHw2.z*1.2);
  col+=hsv(uHue+uHw2.y,0.8,1.0)*vein*(0.4+2.5*wave*uHw2.w+1.8*uHw.w)*(0.5+0.5*fall);
  col+=hsv(uHue+uHw2.y,0.7,1.0)*smoothstep(0.3,0.0,g2)*0.08*fall;   // their soft light on the rock round them
  return mix(col,c,1.0-exp(-t*0.07));
}`,
    fn: 'hollow',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uHw, P.hw); gl.uniform4fv(u.uHw2, P.hw2); },
  // its front plane: the near walls
  front: {
    fn: 'hollowFront',
    glsl: `
float hollowFront(vec2 sp){ vec3 ro, rd=hwCam(sp,ro); float t=hwMarch(ro,rd,24,2.2); return t>0.0 ? 1.0 : 0.0; }`,
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
      o.fillStyle = hc(h + (k % 2 ? h1 : h2), 40 - 15*fog, 5 + 22*fog, 1);
      o.beginPath(); r.pts.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y)); o.closePath(); o.fill();
      const w = Math.exp(-(((r.t - wave*14)*.8)**2))*Math.exp(-wave*1.2)*dim;
      o.strokeStyle = hc(h + h2, 80, 60, Math.min(1, (.25 + 2.2*w + 1.5*surge)*(1 - fog*.8))); o.lineWidth = lw; o.stroke();
    }
    o.globalAlpha = 1;
  },
};
// simple mode's tunnel: cross-sections of the carved path ahead, projected (each a wobbling ring), nearest first
function rings(P, W, H){
  const z0 = P.hw[2], u = H, out = [], c0 = path(z0), c1 = path(z0 + 1.5), f = norm3(sub3(c1, c0)), r = norm3(cross3([0, 1, 0], f)), up = cross3(f, r);
  for (let k = 0; k < 22; k++) {
    const t = .6 + k*k*.09, c = path(z0 + t), rel = sub3(c, c0), zc = dot3(rel, f); if (zc <= .2) continue;
    const cx = W/2 + dot3(rel, r)/zc/1.25*u, cy = H/2 - dot3(rel, up)/zc/1.25*u, pts = [];
    for (let j = 0; j < 28; j++) { const a = j/28*Math.PI*2, rad = (.95 + .3*Math.sin(a*3 + (z0 + t)*.7) + .18*Math.sin(a*5 - (z0 + t)*.4))/zc/1.25*u;
      pts.push([cx + Math.cos(a)*rad, cy - Math.sin(a)*rad]); }
    out.push({t, pts});
  }
  return out;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross3 = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v/l); };
