// Underwater as a paper-cut poster: bright turquoise light from a rippling silver surface fading to deep blue below,
// slanted shafts of light (brighter with the mids, flaring on a drop), and four layers of kelp and rock stepping from pale
// far off to black near, swaying with the bass. Bubbles rise in columns, livelier with the hi-hats; caustics dance on the
// far floor on the kick. Each section re-arranges the reef (the kelp sinks and grows again, nearest first).
import { hc, sectionLayout } from '../../util.js';
import { L } from '../../audio/listen.js';
import { TUNE } from '../../tuning.js';

const SURF = .36, FLOOR = -.3, NL = 4;   // the surface overhead; the floor's height (for the horizon grid); the reef's layers
const st = {D0:0, D1:0, tr:1, ty:null, n:0, flare:0, drops:0, h:0};
const fr = v => v - Math.floor(v), rnd = i => fr(Math.sin(i*91.7)*43758.5453);
const bubbles = Array.from({length: 40}, (_, i) => ({x: rnd(i) - .5, y: rnd(i + 99) - .5, r: .003 + rnd(i + 7)*.008, v: .05 + rnd(i + 3)*.08}));
// layer k (0 far .. 3 near): how far it has sunk in a change, and which layout it shows; its floor; its kelp in slot s
const flat = (k, A) => { const m = Math.min(1, Math.max(0, A[2]*1.6 - (NL - 1 - k)*.15)); return [1 - Math.abs(m*2 - 1), m < .5 ? A[0] : A[1]]; };
const floorY = (x, k, D) => -.2 - k*.065 + .03*Math.sin(x*(3 + k) + k*2 + D) + .015*Math.abs(Math.sin(x*17 + k + D));
const kelp = (s, k, D) => { const r = rnd(s*3 + k*11 + D*7); return r > .6 ? null : {c: (s + .5 + (fr(r*17) - .5)*.5)/(3 + (NL - 1 - k)*3), h: .25 + .45*fr(r*29), r}; };
export default {
  key: 'deep', kind: 'world', label: 'Underwater',
  light: {hue: .5, sat: .5, x: 0, y: 1},                // blue-green light from the surface above
  horizonY: FLOOR,
  // calm, washed, melodic music; noisy textures read as the water
  suits: (rf, T) => -rf.perc*.5 + (rf.noise || 0)*.3 + rf.mid*.2 - T*.4,
  params(P, x){
    const C = TUNE.deep, J = x.J, on = P.w.deep > .05;
    sectionLayout(st, 'deepD', J, on, x.dt, C.morphSecs);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (on) st.flare = 1; }
    st.flare = Math.max(0, st.flare - x.dt/1.5);
    st.h += (L.hat - st.h)*Math.min(1, x.dt*3);
    if (on) for (const b of bubbles) { b.y += x.dt*b.v*(1 + st.h*2.5); b.x += Math.sin(x.t*2 + b.v*40)*.0006;
      if (b.y > SURF) { b.y = FLOOR + rnd(b.v*999 + x.t)*.1; b.x = (rnd(b.r*999 + x.t) - .5)*x.asp; } }
    P.deepBubbles = bubbles;
    P.deepA = [st.D0, st.D1, st.tr, (x.sBass || 0)*x.react*C.sway];
    P.deepB = [st.h, st.flare*st.flare, P.mid*x.react];
  },
  glsl: {
    uniforms: 'uniform vec4 uDeepA; uniform vec3 uDeepB;',
    functions: `
float deepHue(){ return 0.5+0.05*sin(uHue*6.2831853); }
float deepFloor(float x,float k,float D){ return -0.2-k*0.065+0.03*sin(x*(3.0+k)+k*2.0+D)+0.015*abs(sin(x*17.0+k+D)); }
// layer k at sp (moved for its sinking in a change): covered (1) or not; kelp (1) or rock (0)
float deepLayer(vec2 sp,float k,out float isKelp){
  float m=clamp(uDeepA.z*1.6-(3.0-k)*0.15,0.0,1.0), D=m<0.5 ? uDeepA.x : uDeepA.y; isKelp=0.0;
  vec2 p=vec2(sp.x,sp.y+(1.0-abs(m*2.0-1.0))*0.8);
  float g=deepFloor(p.x,k,D);
  if(p.y<g) return 1.0;
  float f=3.0+(3.0-k)*3.0, sway=uDeepA.w*(k+1.0)/4.0;
  // the kelp's slot, found where its stalk leans at this height (so a swaying stalk isn't cut at the slot's edge)
  float up=p.y-g, lean=(sin(p.y*7.0+uTime*1.1+k)*0.02+sway*sin(uTime*0.8+k*1.3))*min(up*2.0,1.0);
  float s=floor((p.x-lean)*f), r=fract(sin((s*3.0+k*11.0+D*7.0)*91.7)*43758.5453);
  if(r>0.6) return 0.0;
  float c=(s+0.5+(fract(r*17.0)-0.5)*0.5)/f, h=0.25+0.45*fract(r*29.0), gb=deepFloor(c,k,D);
  if(p.y>gb+h) return 0.0;
  float w=0.004*(1.0+k*0.4)*(1.0+2.5*pow(max(0.0,sin(p.y*38.0+r*9.0)),3.0))*(1.0-0.5*smoothstep(gb,gb+h,p.y));   // leaves
  if(abs(p.x-lean-c)>w) return 0.0;
  isKelp=1.0; return 1.0;
}
vec3 deep(vec2 sp){
  float t=uTime, dh=deepHue();
  // the water: bright turquoise under the surface, deep blue below; shafts of light slanting down, swaying
  float y=clamp((sp.y+0.5)/(${SURF.toFixed(3)}+0.5),0.0,1.0);
  vec3 c=mix(hsv(dh+0.12,0.8,0.05),hsv(dh,0.6,0.8),pow(y,1.4));
  float x0=sp.x+(${SURF.toFixed(3)}-sp.y)*0.35+0.03*sin(t*0.3);
  float shaft=smoothstep(0.45,1.0,sin(x0*9.0+sin(x0*2.3)*1.5))*smoothstep(-0.5,${SURF.toFixed(3)},sp.y)*(0.25+0.35*uDeepB.z+0.8*uDeepB.y);
  vec3 lite=hsv(dh-0.03,0.25,1.0);
  // the reef, nearest first: the first layer covering the pixel is drawn, stepping from pale to black
  for(int i=3;i>=0;i--){
    float k=float(i), kl, near=(k+1.0)/4.0;
    if(deepLayer(sp,k,kl)>0.5){
      vec3 col=mix(hsv(dh+0.02,0.45,0.55),hsv(dh+0.1,0.8,0.02),pow(near,0.6));
      col=mix(col,col*vec3(0.7,1.1,0.85),kl*0.6);                                           // the kelp greener
      col=mix(col,lite,shaft*0.3*(1.0-near));
      if(i==0){ vec2 q=sp*vec2(14.0,22.0)+vec2(t*0.3,0.0);                                    // caustics on the far floor, on the kick
        float cs=abs(sin(q.x+sin(q.y*1.3+t)*1.2)*sin(q.y+sin(q.x*1.1-t*0.8)*1.2)); col+=lite*pow(1.0-cs,6.0)*(0.15+0.4*uBeat)*(1.0-kl); }
      return col;
    }
  }
  c+=lite*shaft*0.35;
  // the silver surface overhead, rippling
  float sy=${SURF.toFixed(3)}+0.015*sin(sp.x*8.0+t*1.3)+0.008*sin(sp.x*19.0-t*2.1);
  if(sp.y>sy){ vec2 q=sp*vec2(10.0,30.0)+vec2(t*0.4,t*0.2); float cs=abs(sin(q.x+sin(q.y+t)*1.3)*sin(q.y*0.7+sin(q.x*0.9-t)*1.3));
    c=mix(hsv(dh-0.02,0.35,0.85),vec3(1.0),pow(1.0-cs,4.0)*0.7); }
  // bubbles rising in columns, livelier and brighter with the hi-hats
  for(int j=0;j<7;j++){ float fj=float(j), bx=(fract(sin(fj*37.1)*437.5)-0.5)*ASP, bq=(sp.y-t*(0.12+0.05*fj)*(1.0+uDeepB.x*2.0))*9.0;
    vec2 bp=vec2((sp.x-bx-0.01*sin(sp.y*20.0+fj))*9.0,fract(bq)-0.5); float br=0.07+0.07*fract(sin(floor(bq)*7.1+fj)*91.7);
    c+=lite*smoothstep(0.03,0.0,abs(length(bp)-br))*(0.4+0.6*uDeepB.x)*step(-0.2,sp.y-deepFloor(bx,3.0,uDeepA.y)); }
  return c;
}`,
    fn: 'deep',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uDeepA, P.deepA); gl.uniform3fv(u.uDeepB, P.deepB); },
  // its front plane: the nearest layer of kelp and rock
  front: {
    fn: 'deepFront',
    glsl: `
float deepFront(vec2 sp){ float k; return deepLayer(sp,3.0,k); }`,
    path2d(o, P, t){ layer2d(o, P, t, NL - 1, pts => { o.moveTo(...pts[0]); pts.forEach(p => o.lineTo(...p)); o.closePath(); }); },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.deep);
    const dh = .5 + .05*Math.sin(P.hue*Math.PI*2), [hat, flare, mid] = P.deepB;
    o.globalAlpha = a;
    const g = o.createLinearGradient(0, Y(SURF), 0, H);
    g.addColorStop(0, hc(dh, 60, 70, 1)); g.addColorStop(.5, hc(dh + .05, 70, 30, 1)); g.addColorStop(1, hc(dh + .12, 80, 3, 1));
    o.fillStyle = g; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter';
    o.fillStyle = hc(dh - .03, 25, 80, .08*(.25 + .35*mid + .8*flare)/.3);   // shafts of light slanting down
    for (let i = -8; i < 8; i++) { const xs = i/9*1.4 + .03*Math.sin(t*.3);
      o.beginPath(); o.moveTo(X(xs - .03), Y(SURF)); o.lineTo(X(xs + .03), Y(SURF)); o.lineTo(X(xs + .03 - .3), Y(-.5)); o.lineTo(X(xs - .06 - .3), Y(-.5)); o.fill(); }
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = hc(dh - .02, 35, 82, 1); o.beginPath(); o.moveTo(0, 0);   // the silver surface
    for (let j = 0; j <= 60; j++) { const xs = (j/60 - .5)*asp; o.lineTo(X(xs), Y(SURF + .015*Math.sin(xs*8 + t*1.3) + .008*Math.sin(xs*19 - t*2.1))); }
    o.lineTo(W, 0); o.fill();
    for (let k = 0; k < NL; k++) {   // the reef, far to near: pale to black
      const near = (k + 1)/NL, p = Math.pow(near, .6);
      o.fillStyle = hc(dh + .02 + .08*p, 45 + 35*p, 55*(1 - p) + 2, 1);
      o.beginPath(); layer2d(o, P, t, k, pts => { o.moveTo(...pts[0]); pts.forEach(q => o.lineTo(...q)); o.closePath(); }); o.fill();
    }
    o.strokeStyle = hc(dh - .03, 30, 85, .4 + .5*hat); o.lineWidth = 1;   // bubbles, livelier with the hi-hats
    for (const b of P.deepBubbles) { o.beginPath(); o.arc(X(b.x*asp), Y(b.y), Math.max(1.5, b.r*u), 0, Math.PI*2); o.stroke(); }
    o.globalAlpha = 1;
  },
};
// simple mode's layer k: its floor and each kelp stalk as outlines through poly(points)
function layer2d(o, P, t, k, poly){
  const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
  const [dn, D] = flat(k, P.deepA), dy = dn*.8, sway = P.deepA[3]*(k + 1)/NL, f = 3 + (NL - 1 - k)*3;
  const pts = [[0, H]]; for (let j = 0; j <= 120; j++) { const x = (j/120 - .5)*asp; pts.push([X(x), Y(floorY(x, k, D) - dy)]); } pts.push([W, H]); poly(pts);
  for (let s = Math.floor(-asp/2*f) - 1; s <= Math.ceil(asp/2*f) + 1; s++) {
    const kp = kelp(s, k, D); if (!kp) continue;
    const gb = floorY(kp.c, k, D), L = [], R = [];
    for (let j = 0; j <= 24; j++) { const y = gb + kp.h*j/24, up = y - gb, lean = (Math.sin(y*7 + t*1.1 + k)*.02 + sway*Math.sin(t*.8 + k*1.3))*Math.min(up*2, 1);
      const w = .004*(1 + k*.4)*(1 + 2.5*Math.pow(Math.max(0, Math.sin(y*38 + kp.r*9)), 3))*(1 - .5*j/24);
      L.push([X(kp.c + lean - w), Y(y - dy)]); R.unshift([X(kp.c + lean + w), Y(y - dy)]); }
    poly([...L, ...R]);
  }
}
