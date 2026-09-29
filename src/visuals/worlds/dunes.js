// Dunes: a synthwave desert as a stylised poster. A huge banded sun on a violet-to-gold sky, its rays turning slowly;
// ridges of sand as silhouettes stepping from pale far off to black near, their crests rimmed with hot light (brighter on
// the beat). The sun sinks towards the dunes through a build and flares on the drop; each section re-forms the ridges
// into its own shapes (a returning section brings its dunes back); sand streams off the crests on the hi-hats.
import { hc, sectionLayout } from '../../util.js';
import { L } from '../../audio/listen.js';
import { TUNE } from '../../tuning.js';

const st = {D0:0, D1:0, tr:1, ty:null, n:0, lvl:.3, flare:0, drops:0, h:0};
const rnd = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
const fr = v => v - Math.floor(v);
// a ridge's height at x, for ridge k (0 far .. 3 near) in layout D: sharp crests, long slopes (the same in both renderers)
// (a sharp crest where sin crosses zero, a long gentle slope on one side and a steeper one on the other, like wind-built sand)
const ridge1 = (x, k, t, D) => { const f = 1.1 + k*.7 + .25*fr(D*.37), q = x*f + k*2.3 + D*(1.3 + k*.7) + t*.01*(k + 1), p = q + .45*Math.sin(q),
  c = 1 - Math.abs(Math.sin(p)), s = Math.sin(q*.37 + k + D);
  return -.03 - k*.075 + (.035 + k*.014)*(.8 + .5*fr(D*.61 + k*.3))*Math.pow(c, 1.8) + .015*s; };
const ridge = (x, k, t, A) => { let m = Math.min(1, Math.max(0, A[2]*1.4 - (3 - k)*.13)); m = m*m*(3 - 2*m);   // (nearest first)
  return m <= 0 ? ridge1(x, k, t, A[0]) : m >= 1 ? ridge1(x, k, t, A[1]) : ridge1(x, k, t, A[0])*(1 - m) + ridge1(x, k, t, A[1])*m; };
const SUNX = .18, SUNR = .2;
export default {
  key: 'dunes', kind: 'world', label: 'Dunes',
  light: {hue: .05, sat: .7, x: .4, y: .1},              // the low sun, ahead and to the right
  horizonY: -.05,
  // open, slow, hypnotic music: a steady groove without much going on above it
  suits: (rf, T) => -rf.busy*.4 + rf.low*.2 - (rf.hat || 0)*.2 + rf.perc*.1 - T*.2,
  params(P, x){
    const C = TUNE.dunes, J = x.J, on = P.w.dunes > .05;
    sectionLayout(st, 'dunesD', J, on, x.dt, C.morphSecs);
    st.lvl += ((J ? J.tension : .4) - st.lvl)*Math.min(1, x.dt*.4);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (on) st.flare = 1; }
    st.flare = Math.max(0, st.flare - x.dt/C.flareSecs);
    st.h += (L.hat - st.h)*Math.min(1, x.dt*3);
    P.dunesA = [st.D0, st.D1, st.tr, st.h];
    P.dunesS = [C.sunHigh - st.lvl*C.sink, st.flare*st.flare];
  },
  glsl: {
    uniforms: 'uniform vec4 uDunesA; uniform vec2 uDunesS;',
    functions: `
float dunesR1(float x,float k,float t,float D){ float f=1.1+k*0.7+0.25*fract(D*0.37), q=x*f+k*2.3+D*(1.3+k*0.7)+t*0.01*(k+1.0), p=q+0.45*sin(q), c=1.0-abs(sin(p)), s=sin(q*0.37+k+D);
  return -0.03-k*0.075+(0.035+k*0.014)*(0.8+0.5*fract(D*0.61+k*0.3))*pow(c,1.8)+0.015*s; }
float dunesRidge(float x,float k,float t){ float m=clamp(uDunesA.z*1.4-(3.0-k)*0.13,0.0,1.0); m=m*m*(3.0-2.0*m);
  if(m<=0.0) return dunesR1(x,k,t,uDunesA.x); if(m>=1.0) return dunesR1(x,k,t,uDunesA.y);
  return mix(dunesR1(x,k,t,uDunesA.x),dunesR1(x,k,t,uDunesA.y),m); }
vec3 dunesSky(vec2 sp){
  float t=clamp((sp.y+0.05)/0.55,0.0,1.0);
  vec3 c=mix(hsv(uHue+0.03,0.8,1.0),hsv(uHue+0.9,0.75,0.6),smoothstep(0.0,0.35,t));      // gold at the horizon, magenta,
  c=mix(c,hsv(uHue+0.73,0.8,0.07),smoothstep(0.3,1.0,t));                               // deep violet above
  vec2 g=sp*80.0, cell=floor(g); float h=hash(cell);                                      // a few stars up high
  c+=vec3(0.9)*step(0.988,h)*smoothstep(0.35,0.0,length(fract(g)-0.5))*smoothstep(0.35,0.8,t)*(0.6+0.4*sin(uTime*1.9+h*60.0));
  // the sun: its glow and slowly turning rays, the disc banded gold to pink, cut by bands sliding down its lower half
  vec2 sc=vec2(ASP*${SUNX.toFixed(3)},uDunesS.x), v=sp-sc; float R=${SUNR.toFixed(3)}*(1.0+uDunesS.y*0.08), d=length(v);
  c+=hsv(uHue+0.04,0.75,1.0)*(0.22+0.6*uDunesS.y)*exp(-max(d-R,0.0)*5.0);
  c+=hsv(uHue+0.06,0.5,1.0)*0.08*(1.0+2.0*uDunesS.y)*smoothstep(0.3,1.0,sin(atan(v.y,v.x)*16.0+uTime*0.12))*exp(-d*1.8)*step(R,d);
  if(d<R){
    float k=v.y/R, cut=1.0;
    if(k<0.3){ float band=fract(k*7.0+uTime*0.3); cut=step((0.3-k)*0.38,band); }
    c=mix(c,mix(hsv(uHue+0.92,0.8,1.0),hsv(uHue+0.14,0.75,1.0),k*0.5+0.5)*(1.0+uDunesS.y*0.4),smoothstep(R,R-0.004,d)*cut);
  }
  return c;
}
vec3 dunes(vec2 sp){
  float t=uTime;
  // the nearest ridge covering this pixel (near to far): a silhouette stepping darker nearer, the slope facing the sun
  // warmed, its crest rimmed with hot light
  for(int i=3;i>=0;i--){
    float k=float(i), y=dunesRidge(sp.x,k,t);
    if(sp.y<y){
      float e=0.002, sl=(dunesRidge(sp.x+e,k,t)-dunesRidge(sp.x-e,k,t))/(2.0*e);
      float toward=sp.x<ASP*${SUNX.toFixed(3)} ? 1.0 : -1.0, facing=clamp(sl*toward*1.5,0.0,1.0);   // the slope rising towards the sun
      float depth=y-sp.y, near=(k+1.0)/4.0;
      vec3 sand=mix(hsv(uHue+0.88,0.5,0.62),hsv(uHue+0.76,0.75,0.035),pow(near,0.6));   // far ridges pale, near ones dark
      sand+=hsv(uHue+0.02,0.8,0.6)*facing*exp(-depth*6.0)*(1.0-near*0.5)*0.55;
      sand*=1.0-smoothstep(0.0,0.2,depth)*0.35;
      sand+=hsv(uHue+0.8,0.6,0.5)*0.05*step(0.9,sin(depth*170.0+sin(sp.x*5.0+k*2.0)*2.5))*(1.0-smoothstep(0.0,0.15,depth))*(0.5+near);   // ripples in the sand
      sand+=hsv(uHue+0.05,0.7,1.0)*exp(-depth*260.0)*(0.55+0.4*facing)*(0.7+0.9*uBeat)*(0.6+0.4*near);
      return sand;
    }
  }
  // above every ridge: the sky, and sand streaming off the crests in a fine haze on the hi-hats
  vec3 c=dunesSky(sp);
  if(uDunesA.w>0.05) for(int i=0;i<4;i++){ float k=float(i), above=sp.y-dunesRidge(sp.x,k,t);
    if(above<0.04) c=mix(c,hsv(uHue+0.05,0.5,0.9),exp(-above*60.0)*(0.5+0.5*sin(sp.x*90.0-t*20.0+k*3.0))*uDunesA.w*0.3*(0.4+0.6*(k+1.0)/4.0)); }
  return c;
}`,
    fn: 'dunes',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uDunesA, P.dunesA); gl.uniform2fv(u.uDunesS, P.dunesS); },
  // its front plane: the nearest ridge
  front: {
    fn: 'dunesFront',
    glsl: `
float dunesFront(vec2 sp){ return sp.y<dunesRidge(sp.x,3.0,uTime) ? 1.0 : 0.0; }`,
    path2d(o, P, t){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
      o.moveTo(0, H); for (let j = 0; j <= 80; j++) { const xs = (j/80 - .5)*asp; o.lineTo(X(xs), Y(ridge(xs, 3, t, P.dunesA))); } o.lineTo(W, H); o.closePath();
    },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.dunes), h = P.hue;
    const [sunY, flare] = P.dunesS;
    o.globalAlpha = a;
    const sky = o.createLinearGradient(0, Y(.5), 0, Y(-.05));
    sky.addColorStop(0, hc(h + .73, 80, 4, 1)); sky.addColorStop(.45, hc(h + .8, 75, 18, 1)); sky.addColorStop(.8, hc(h + .9, 75, 38, 1)); sky.addColorStop(1, hc(h + .03, 85, 60, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) { const y = .2 + rnd(i + 999)*.3; o.fillStyle = `rgba(235,230,245,${((.3 + .6*rnd(i + 5))*(.6 + .4*Math.sin(t*1.9 + i))).toFixed(3)})`; o.fillRect(X((rnd(i) - .5)*asp), Y(y), 1.4, 1.4); }
    const sx = X(asp*SUNX), sy = Y(sunY), R = SUNR*(1 + flare*.08)*u;
    const glow = o.createRadialGradient(sx, sy, R*.9, sx, sy, R*3);
    glow.addColorStop(0, hc(h + .04, 80, 60, .35 + .5*flare)); glow.addColorStop(1, hc(h + .04, 80, 60, 0));
    o.fillStyle = glow; o.fillRect(sx - R*3, sy - R*3, R*6, R*6);
    o.fillStyle = hc(h + .06, 60, 70, .05*(1 + 2*flare));   // the rays, turning slowly
    for (let r = 0; r < 16; r++) { const a0 = (r/16)*Math.PI*2 + t*.12/16*2, a1 = a0 + Math.PI/32;
      o.beginPath(); o.moveTo(sx, sy); o.lineTo(sx + Math.cos(a0)*u*1.5, sy - Math.sin(a0)*u*1.5); o.lineTo(sx + Math.cos(a1)*u*1.5, sy - Math.sin(a1)*u*1.5); o.fill(); }
    o.globalCompositeOperation = 'source-over';
    const disc = o.createLinearGradient(0, sy - R, 0, sy + R);
    disc.addColorStop(0, hc(h + .14, 85, 65, 1)); disc.addColorStop(1, hc(h + .92, 85, 60, 1));
    o.save(); o.beginPath(); o.arc(sx, sy, R, 0, Math.PI*2); o.clip();
    o.fillStyle = disc; o.fillRect(sx - R, sy - R, R*2, R*2);
    o.fillStyle = sky;                                    // cut the bands through its lower half
    for (let k = .3; k > -1; k -= .01) { const band = fr(k*7 + t*.3); if (band < (.3 - k)*.38) o.fillRect(sx - R, sy - k*R, R*2, .012*R + 1); }
    o.restore();
    for (let k = 0; k < 4; k++) {   // far to near: silhouettes stepping darker, crests rimmed with hot light
      const pts = []; for (let j = 0; j <= 90; j++) { const xs = (j/90 - .5)*asp; pts.push([X(xs), Y(ridge(xs, k, t, P.dunesA))]); }
      const near = (k + 1)/4, top = Math.min(...pts.map(p => p[1]));
      const g = o.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, hc(h + .88 - .12*near, 50 + 25*near, 50*(1 - Math.pow(near, .6)) + 3, 1)); g.addColorStop(1, hc(h + .76, 70, 2 + 14*(1 - near), 1));
      o.fillStyle = g; o.beginPath(); o.moveTo(0, H); for (const [x, y] of pts) o.lineTo(x, y); o.lineTo(W, H); o.fill();
      o.strokeStyle = hc(h + .05, 85, 68, Math.min(1, (.6 + .6*P.beat)*(.6 + .4*near))); o.lineWidth = Math.max(1.2, u*.004);
      o.beginPath(); pts.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y)); o.stroke();
      if (P.dunesA[3] > .05) { o.fillStyle = hc(h + .05, 50, 75, .15*P.dunesA[3]); for (let j = 0; j < 90; j += 2) { const [x, y] = pts[j]; o.fillRect(x + ((t*60 + j*7) % 20), y - 6, 10, 3); } }
    }
    o.globalAlpha = 1;
  },
};
