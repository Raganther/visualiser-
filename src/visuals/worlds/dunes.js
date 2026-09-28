// Dunes under the stars: rolling ridges of sand in moonlight, sharp crests lit on one side and shadowed on the other, a sky
// thick with stars and the Milky Way's band across it, and sand lifting off the crests on the hi-hats.
import { hc } from '../../util.js';
import { L } from '../../audio/listen.js';

const rnd = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
// a ridge's height at x, for ridge k (0 far .. 3 near): sharp crests, long slopes (the same in both renderers)
// (a sharp crest where sin crosses zero, a long gentle slope on one side and a steeper one on the other, like wind-built sand)
const ridge = (x, k, t) => { const f = 1.1 + k*.7, q = x*f + k*2.3 + t*.01*(k + 1), p = q + .45*Math.sin(q), c = 1 - Math.abs(Math.sin(p)), s = Math.sin(q*.37 + k);
  return -.03 - k*.075 + (.035 + k*.012)*Math.pow(c, 1.8) + .015*s; };
export default {
  key: 'dunes', kind: 'world', label: 'Dunes',
  light: {hue: .1, sat: .25, x: -.5, y: .7},             // moonlight from the upper left, warm off the sand
  horizonY: -.05,
  // open, slow, hypnotic music: a steady groove without much going on above it
  suits: (rf, T) => -rf.busy*.4 + rf.low*.2 - (rf.hat || 0)*.2 + rf.perc*.1 - T*.2,
  params(P, x){
    if (!(P.w.dunes > .003)) return;
    this.h = (this.h || 0) + (L.hat - (this.h || 0))*Math.min(1, x.dt*3);
    P.dunesHat = this.h;
  },
  glsl: {
    uniforms: 'uniform float uDunesHat;',
    functions: `
float dunesRidge(float x,float k,float t){ float f=1.1+k*0.7, q=x*f+k*2.3+t*0.01*(k+1.0), p=q+0.45*sin(q), c=1.0-abs(sin(p)), s=sin(q*0.37+k);
  return -0.03-k*0.075+(0.035+k*0.012)*pow(c,1.8)+0.015*s; }
float dunesHue(){ return 0.08+0.04*sin(uHue*6.2831853); }
vec3 dunesSky(vec2 sp){
  float t=uTime, sh=dunesHue();
  vec3 c=mix(hsv(0.62,0.5,0.1),hsv(0.66,0.7,0.02),clamp((sp.y+0.05)*1.6,0.0,1.0));
  // the Milky Way: a band of haze and thick stars, tilted across the sky
  float bd=dot(sp,normalize(vec2(0.45,1.0)))-0.12, band=exp(-bd*bd*40.0);
  float n=0.5+0.5*sin(sp.x*23.0+sin(sp.y*17.0)*2.0)*sin(sp.y*31.0-sp.x*7.0);
  c+=mix(hsv(0.6,0.25,0.25),hsv(sh,0.3,0.28),n)*band*(0.35+0.4*n)*(1.0-0.6*exp(-pow(bd/0.02,2.0))*n);
  vec2 g=sp*85.0, cell=floor(g); float h=hash(cell);
  c+=vec3(0.85)*step(0.985-band*0.03,h)*smoothstep(0.35,0.0,length(fract(g)-0.5))*(0.6+0.4*sin(t*1.9+h*60.0));
  c+=hsv(sh,0.4,0.2)*exp(-(sp.y+0.05)*7.0)*0.6;   // a faint glow along the horizon
  return c;
}
vec3 dunes(vec2 sp){
  float t=uTime, sh=dunesHue();
  // the nearest ridge that covers this pixel (near to far), lit on the slope that faces the moon
  for(int i=3;i>=0;i--){
    float k=float(i), y=dunesRidge(sp.x,k,t);
    if(sp.y<y){
      float e=0.002, sl=(dunesRidge(sp.x+e,k,t)-dunesRidge(sp.x-e,k,t))/(2.0*e);   // the slope: facing the moon (left) or away
      float depth=y-sp.y, lit=mix(0.45,clamp(0.5-sl*0.9,0.0,1.0),exp(-depth*9.0));   // the crest's two sides, blending lower down
      vec3 sand=hsv(sh,0.45,0.07+0.22*lit)*(0.55+0.45*(k+1.0)/4.0);
      sand*=1.0-smoothstep(0.0,0.25,depth)*0.5;
      float fog=exp(-(3.0-k)*0.35);                                              // far ridges fade into the night
      sand=mix(hsv(0.62,0.4,0.08),sand,fog);
      sand+=hsv(sh,0.3,0.6)*exp(-depth*400.0)*lit*0.25;                         // the crest catching the moon
      return sand;
    }
  }
  // above every ridge: the sky, and sand lifting off the crests in a fine streaming haze on the hi-hats
  vec3 c=dunesSky(sp);
  if(uDunesHat>0.05) for(int i=0;i<4;i++){ float k=float(i), above=sp.y-dunesRidge(sp.x,k,t);
    if(above<0.04) c=mix(c,hsv(sh,0.3,0.35),exp(-above*60.0)*(0.5+0.5*sin(sp.x*90.0-t*20.0+k*3.0))*uDunesHat*0.35*(0.4+0.6*(k+1.0)/4.0)); }
  return c;
}`,
    fn: 'dunes',
  },
  uniforms(gl, u, P){ if (u.uDunesHat) gl.uniform1f(u.uDunesHat, P.dunesHat || 0); },
  // its front plane: the nearest ridge
  front: {
    fn: 'dunesFront',
    glsl: `
float dunesFront(vec2 sp){ return sp.y<dunesRidge(sp.x,3.0,uTime) ? 1.0 : 0.0; }`,
    path2d(o, P, t){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
      o.moveTo(0, H); for (let j = 0; j <= 80; j++) { const xs = (j/80 - .5)*asp; o.lineTo(X(xs), Y(ridge(xs, 3, t))); } o.lineTo(W, H); o.closePath();
    },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.dunes);
    const sh = .08 + .04*Math.sin(P.hue*Math.PI*2) - P.hue;   // (the sand's own warm hue: hc adds P.hue back)
    o.globalAlpha = a;
    const sky = o.createLinearGradient(0, 0, 0, Y(-.05));
    sky.addColorStop(0, hc(.66, 70, 2, 1)); sky.addColorStop(1, hc(.62, 50, 10, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 400; i++) { const x = (rnd(i) - .5)*asp, y = rnd(i + 999)*.55 - .05, bd = x*.41 + y*.91 - .12;
      if (rnd(i + 77) > .35 + Math.exp(-bd*bd*40)*.6) continue;
      o.fillStyle = `rgba(230,230,240,${(.3 + .6*rnd(i + 5))*(.6 + .4*Math.sin(t*1.9 + i))})`; o.fillRect(X(x), Y(y), 1.4, 1.4); }
    o.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 4; k++) {   // far to near
      const pts = []; for (let j = 0; j <= 80; j++) { const xs = (j/80 - .5)*asp; pts.push([X(xs), Y(ridge(xs, k, t))]); }
      const fog = Math.exp(-(3 - k)*.35), g = o.createLinearGradient(0, Y(-.03 - k*.075 + .05), 0, H);
      g.addColorStop(0, hc(P.hue + sh, 40, (4 + 14*(k + 1)/4)*fog + 4*(1 - fog), 1)); g.addColorStop(1, hc(P.hue + sh, 45, 2, 1));
      o.fillStyle = g; o.beginPath(); o.moveTo(0, H); for (const [x, y] of pts) o.lineTo(x, y); o.lineTo(W, H); o.fill();
      o.strokeStyle = hc(P.hue + sh, 30, 55, .25*fog); o.lineWidth = 1; o.beginPath(); pts.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y)); o.stroke();
      if (P.dunesHat > .05) { o.fillStyle = hc(P.hue + sh, 30, 60, .12*P.dunesHat); for (let j = 0; j < 80; j += 2) { const [x, y] = pts[j]; o.fillRect(x + ((t*60 + j*7) % 20), y - 6, 10, 3); } }
    }
    o.globalAlpha = 1;
  },
};
