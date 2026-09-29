// Underwater: light falling from a rippling silver surface in shifting caustics and god rays, motes drifting, bubbles
// rising on the hi-hats, and a sandy floor with rocks, the deep blue fading to black below.
import { hc } from '../../util.js';
import { L } from '../../audio/listen.js';

const SURF = .36, FLOOR = -.3;   // the surface overhead and the floor's height
const rnd = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
const bubbles = Array.from({length: 40}, (_, i) => ({x: rnd(i) - .5, y: rnd(i + 99) - .5, r: .003 + rnd(i + 7)*.008, v: .05 + rnd(i + 3)*.08}));
export default {
  key: 'deep', kind: 'world', label: 'Underwater',
  light: {hue: .52, sat: .5, x: 0, y: 1},               // blue-green light from the surface above
  horizonY: FLOOR,
  // calm, washed, melodic music; noisy textures read as the water
  suits: (rf, T) => -rf.perc*.5 + (rf.noise || 0)*.3 + rf.mid*.2 - T*.4,
  params(P, x){
    if (!(P.w.deep > .003)) return;
    this.h = (this.h || 0) + (L.hat - (this.h || 0))*Math.min(1, x.dt*3);
    P.deepHat = this.h;
    for (const b of bubbles) { b.y += x.dt*b.v*(1 + this.h*2.5); b.x += Math.sin(x.t*2 + b.v*40)*.0006; if (b.y > SURF) { b.y = FLOOR + rnd(b.v*999 + x.t)*.1; b.x = (rnd(b.r*999 + x.t) - .5)*x.asp; } }
    P.deepBubbles = bubbles;
  },
  glsl: {
    uniforms: 'uniform float uDeepHat;',
    functions: `
// caustics: the bright web light makes through a rippling surface
float deepCaustic(vec2 p,float t){
  vec2 q=p; float c=0.0;
  for(int i=0;i<3;i++){ float fi=float(i); q+=vec2(sin(q.y*3.1+t*(0.6+fi*0.2)+fi),cos(q.x*2.7-t*(0.5+fi*0.15)+fi*1.7))*0.35; c+=0.33/(0.25+abs(sin(q.x*4.0+fi)*sin(q.y*4.0-fi)));  }
  return pow(c*0.33,3.0)*0.08;
}
float deepHue(){ return 0.53+0.05*sin(uHue*6.2831853); }
vec3 deep(vec2 sp){
  float t=uTime, dh=deepHue(), y=sp.y;
  vec3 c=mix(hsv(dh+0.08,0.85,0.015),hsv(dh,0.75,0.3),smoothstep(-0.55,0.4,y));   // the deep below, the light above
  if(y>${SURF}){   // the surface from beneath: silver ripples, brightest straight up
    float yy=y-${SURF}, z=0.05/(yy+0.03);   // seen at a slant: the ripples finer towards the far edge
    float r=clamp(deepCaustic(vec2(sp.x*z*1.5,z*2.0+t*0.15),t)*5.0,0.0,1.0);
    return hsv(dh-0.02,0.3,0.35+0.45*r)*(0.75+0.5*exp(-sp.x*sp.x*3.0))*(0.8+0.3*uMid*uReact);
  }
  // god rays: slanted shafts from the surface, swaying, stronger with the mids
  float rx=sp.x+(${SURF}-y)*0.35, ray=pow(0.5+0.5*sin(rx*9.0+sin(rx*2.3+t*0.3)*2.0+t*0.2),6.0)*(0.5+0.5*sin(rx*3.7-t*0.17));
  c+=hsv(dh-0.03,0.4,1.0)*ray*0.26*smoothstep(${FLOOR},${SURF},y)*(0.6+0.6*uMid*uReact);
  // motes drifting in the water
  vec2 g=vec2(sp.x*40.0,sp.y*40.0+t*0.8), cell=floor(g); float h=hash(cell);
  c+=vec3(0.6,0.8,0.8)*step(0.975,h)*smoothstep(0.25,0.0,length(fract(g)-0.5))*0.35;
  // bubbles rising in a few columns, brighter and livelier with the hi-hats
  for(int i=0;i<10;i++){
    float fi=float(i), bx=(hash(vec2(fi,7.0))-0.5)*ASP*0.9, sp2=0.05+0.06*hash(vec2(fi,3.0));
    for(int j=0;j<2;j++){ float fj=float(j), by=${FLOOR}+mod(t*sp2*(1.0+uDeepHat)+hash(vec2(fi,fj+11.0)),1.0)*(${SURF}-(${FLOOR}));
      vec2 b=vec2(bx+sin(t*2.0+fi+fj)*0.01,by); float br=0.004+0.006*hash(vec2(fi,fj+5.0)), d=length(sp-b);
      if(d<br*1.6) c+=vec3(0.75,0.95,1.0)*smoothstep(br*0.35,0.0,abs(d-br))*(0.35+0.5*uDeepHat); }
  }
  // the floor: sand with caustics dancing on it, rocks dark against it
  float fl=${FLOOR}+0.02*sin(sp.x*3.0)+0.012*sin(sp.x*11.0+1.0);
  if(y<fl){
    float d=fl-y, z=0.08/(d+0.02);
    vec3 sand=hsv(dh+0.5,0.25,0.18)*exp(-d*3.0);
    sand+=hsv(dh-0.04,0.35,1.0)*deepCaustic(vec2(sp.x*z*0.6,z),t)*exp(-d*2.5)*(1.0+uBeat*0.6);
    c=mix(c,sand,smoothstep(0.0,0.01,d));
    float rock=-0.4+0.07*abs(sin(sp.x*4.0+2.0))+0.05*sin(sp.x*13.0);
    if(y<rock) c=hsv(dh+0.05,0.6,0.02);
  }
  return c;
}`,
    fn: 'deep',
  },
  uniforms(gl, u, P){ if (u.uDeepHat) gl.uniform1f(u.uDeepHat, P.deepHat || 0); },
  // its front plane: the near rocks on the floor
  front: {
    fn: 'deepFront',
    glsl: `
float deepFront(vec2 sp){ return sp.y<-0.4+0.07*abs(sin(sp.x*4.0+2.0))+0.05*sin(sp.x*13.0) ? 1.0 : 0.0; }`,
    path2d(o){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
      o.moveTo(0, H); for (let j = 0; j <= 60; j++) { const xs = (j/60 - .5)*asp; o.lineTo(X(xs), Y(-.4 + .07*Math.abs(Math.sin(xs*4 + 2)) + .05*Math.sin(xs*13))); }
      o.lineTo(W, H); o.closePath();
    },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.deep);
    const bh = .53 + .05*Math.sin(P.hue*Math.PI*2) - P.hue;   // (the water's own blue-green: hc adds P.hue back)
    o.globalAlpha = a;
    const g = o.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hc(P.hue + bh - .02, 40, 55, 1)); g.addColorStop(1 - (SURF + .5), hc(P.hue + bh, 70, 28, 1)); g.addColorStop(1, hc(P.hue + bh + .08, 85, 2, 1));
    o.fillStyle = g; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {   // god rays
      const rx = ((i/9 + Math.sin(t*.1 + i)*.03) - .5)*asp*1.3, w = .03 + .03*rnd(i);
      const rg = o.createLinearGradient(0, Y(SURF), 0, Y(FLOOR));
      rg.addColorStop(0, hc(P.hue + bh - .03, 40, 70, .12*(.6 + .6*P.mid*P.react))); rg.addColorStop(1, hc(P.hue + bh - .03, 40, 70, 0));
      o.fillStyle = rg; o.beginPath(); o.moveTo(X(rx - w), Y(SURF)); o.lineTo(X(rx + w), Y(SURF)); o.lineTo(X(rx + w - .25), Y(FLOOR)); o.lineTo(X(rx - w - .3), Y(FLOOR)); o.fill();
    }
    o.strokeStyle = hc(P.hue + bh - .02, 30, 80, .45); o.lineWidth = 1;   // the ripples overhead
    for (let r = 0; r < 5; r++) { o.beginPath(); for (let j = 0; j <= 40; j++) { const xs = (j/40 - .5)*asp; o.lineTo(X(xs), Y(SURF + .02 + r*.03 + .008*Math.sin(xs*22 + t*1.4 + r))); } o.stroke(); }
    for (const b of P.deepBubbles || []) { o.strokeStyle = `rgba(210,240,255,${.35 + .4*(P.deepHat || 0)})`; o.beginPath(); o.arc(X(b.x), Y(b.y), Math.max(1, b.r*u), 0, Math.PI*2); o.stroke(); }
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = hc(P.hue + bh + .5, 25, 12, 1); o.beginPath(); o.moveTo(0, H);   // the sand
    for (let j = 0; j <= 40; j++) { const xs = (j/40 - .5)*asp; o.lineTo(X(xs), Y(FLOOR + .02*Math.sin(xs*3) + .012*Math.sin(xs*11 + 1))); } o.lineTo(W, H); o.fill();
    o.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 60; k++) { const cx = (rnd(k) - .5)*asp, cy = FLOOR - rnd(k + 50)*.18, f = .5 + .5*Math.sin(t*1.3 + k);   // caustic glints on it
      o.fillStyle = hc(P.hue + bh - .04, 40, 70, .18*f*(1 + P.beat*.6)); o.beginPath(); o.ellipse(X(cx), Y(cy), (.02 + .02*rnd(k + 9))*u, .006*u, 0, 0, Math.PI*2); o.fill(); }
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = hc(P.hue + bh + .05, 60, 2, 1); o.beginPath(); o.moveTo(0, H);   // the near rocks
    for (let j = 0; j <= 60; j++) { const xs = (j/60 - .5)*asp; o.lineTo(X(xs), Y(-.4 + .07*Math.abs(Math.sin(xs*4 + 2)) + .05*Math.sin(xs*13))); } o.lineTo(W, H); o.fill();
    o.globalAlpha = 1;
  },
};
