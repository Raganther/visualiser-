// The glowing forest as a paper-cut poster: six layers of trunks and ferns stepping from pale mist far off to black near,
// in front of a big moon whose shafts of light fall between the trunks; glowing caps on the nearest floors pulse on the
// beat and spores drift up. The layers sway with the bass, the moon brightens as the tension rises and its shafts flare on
// a drop; each section re-arranges the wood (the layers sink and rise again like stage flats, nearest first).
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const st = {D0:0, D1:0, tr:1, ty:null, n:0, lvl:.3, flare:0, drops:0};
const NL = 6, MOON = [0, .14], MR = .12;
const fr = v => v - Math.floor(v), rnd = i => fr(Math.sin(i*91.7)*43758.5453);
// layer k (0 far .. 5 near): how far it has sunk in a change of layout, and which layout it shows
const flat = (k, A) => { const m = Math.min(1, Math.max(0, A[2]*1.6 - (NL - 1 - k)*.12)); return [1 - Math.abs(m*2 - 1), m < .5 ? A[0] : A[1]]; };
const ground = (x, k, D) => -.1 - k*.065 + .025*Math.sin(x*(2 + k*.8) + k*1.7 + D*2.3) + .01*Math.sin(x*(7 + k) + D);
const fern = (x, k, D) => ground(x, k, D) + .012*Math.pow(Math.abs(Math.sin(x*(90 + k*20) + k*7)), 3) + .006*Math.abs(Math.sin(x*230 + k));
// the trunk in slot s of layer k: centre, half-width (0: no trunk there)
const trunk = (s, k, D) => { const f = 2.5 + (NL - 1 - k)*2, r = rnd(s*3 + k + D*7);
  return r > .42 + .06*k ? null : [(s + .5 + (fr(r*17) - .5)*.6)/f, (.005 + .01*fr(r*29))*(1 + k*.5)]; };
export default {
  key: 'forest', kind: 'world', label: 'Glowing forest',
  light: {hue: .45, sat: .5, x: 0, y: .6},               // the moon behind the wood
  horizonY: -.28,
  // calm to steady, melodic, a little noisy (texture): the wood's mood
  suits: (rf, T) => -rf.perc*.2 + rf.mid*.3 + (rf.noise || 0)*.2 - T*.2,
  params(P, x){
    const C = TUNE.forest, J = x.J, on = P.w.forest > .05;
    sectionLayout(st, 'forestD', J, on, x.dt, C.morphSecs);
    st.lvl += ((J ? J.tension : .4) - st.lvl)*Math.min(1, x.dt*.4);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (on) st.flare = 1; }
    st.flare = Math.max(0, st.flare - x.dt/1.5);
    P.forA = [st.D0, st.D1, st.tr, (x.sBass || 0)*x.react*C.sway];
    P.forS = [st.lvl, st.flare*st.flare];
  },
  glsl: {
    uniforms: 'uniform vec4 uForA; uniform vec2 uForS;',
    functions: `
float forestHue(){ return 0.45+0.08*sin(uHue*6.2831853); }
float forGround(float x,float k,float D){ return -0.1-k*0.065+0.025*sin(x*(2.0+k*0.8)+k*1.7+D*2.3)+0.01*sin(x*(7.0+k)+D); }
// layer k at p, moved for its sway and its sinking in a change: covered (1) or not, and across a trunk (-1..1, 0 off one)
vec2 forP(vec2 p,float k,out float D){ float m=clamp(uForA.z*1.6-(5.0-k)*0.12,0.0,1.0); D=m<0.5 ? uForA.x : uForA.y;
  return vec2(p.x+uForA.w*(k+1.0)/6.0*sin(uTime*0.7+k),p.y+(1.0-abs(m*2.0-1.0))*0.7); }
float forLayer(vec2 sp,float k,out float side){
  float D; vec2 p=forP(sp,k,D); side=0.0;
  float g=forGround(p.x,k,D);
  if(p.y<g+0.012*pow(abs(sin(p.x*(90.0+k*20.0)+k*7.0)),3.0)+0.006*abs(sin(p.x*230.0+k))) return 1.0;   // the floor and its ferns
  if(p.y>0.56) return 0.0;                                                          // (the trunks end just above the picture)
  float f=2.5+(5.0-k)*2.0, s=floor(p.x*f), r=fract(sin((s*3.0+k+D*7.0)*91.7)*43758.5453);
  if(r>0.42+0.06*k) return 0.0;                                                     // (fewer trunks far off, so the moon shows)
  float c=(s+0.5+(fract(r*17.0)-0.5)*0.6)/f, w=(0.005+0.01*fract(r*29.0))*(1.0+k*0.5)*(1.0+0.9*exp(-(p.y-g)*10.0));   // flaring at the root
  float d=p.x-c; if(abs(d)>w) return 0.0;
  side=d/w; return 1.0;
}
// a glowing cap on the floor of a near layer
float forCap(vec2 sp,float k){
  float D; vec2 p=forP(sp,k,D); float q=p.x*14.0+k*3.0, id=floor(q), h=hash(vec2(id,k+D));
  if(h<0.7) return 0.0;
  float cx=(id+0.5-k*3.0)/14.0+(fract(h*13.0)-0.5)*0.03, cy=forGround(cx,k,D)+0.006+0.01*fract(h*7.0);
  vec2 e=(p-vec2(cx,cy))/vec2(0.018,0.01)*(1.2-0.4*fract(h*31.0));
  return smoothstep(1.0,0.6,length(e))*step(cy-0.004,p.y);
}
vec3 forest(vec2 sp){
  float t=uTime, fh=forestHue();
  vec2 mc=vec2(${MOON[0].toFixed(3)},${MOON[1].toFixed(3)}), v=sp-mc; float d=length(v);
  // shafts of light falling from the moon, which show between the trunks and over the mist of the far layers
  float shaft=smoothstep(0.55,1.0,sin(atan(v.x,-v.y)*11.0+t*0.05))*smoothstep(mc.y+0.06,mc.y-0.06,sp.y)*exp(-d*1.3)*(0.5+0.4*uForS.x+1.2*uForS.y);
  vec3 lite=hsv(fh+0.02,0.3,1.0);
  // the layers, nearest first: the first that covers the pixel is drawn (a glowing cap before its own layer)
  for(int i=5;i>=0;i--){
    float k=float(i), side, near=(k+1.0)/6.0;
    if(i>=4){ float cp=forCap(sp,k); if(cp>0.0) return hsv(fh+(fract(k*0.37)>0.5 ? 0.45 : -0.05),0.6,1.0)*cp*(0.6+0.8*uBeat)+hsv(fh+0.3,0.6,0.02)*(1.0-cp); }
    if(forLayer(sp,k,side)>0.5){
      vec3 col=mix(hsv(fh+0.03,0.35,0.6),hsv(fh+0.28,0.6,0.018),pow(near,0.6));        // pale mist far off, black near
      float toward=sp.x<mc.x ? 1.0 : -1.0;
      col+=lite*smoothstep(0.5,1.0,side*toward)*0.22*(1.0-near*0.5);                 // the edge facing the moon
      col=mix(col,lite,shaft*0.25*(1.0-near));
      col+=hsv(fh,0.5,0.9)*exp(-(sp.y+0.1+k*0.065)*9.0)*0.05*(1.0-near);                 // mist lying low
      return col;
    }
  }
  // the sky: bright round the moon, deep blue at the edges; the moon, its shafts, and spores drifting up
  vec3 c=mix(hsv(fh+0.02,0.5,0.8),hsv(fh+0.22,0.75,0.06),smoothstep(0.0,0.85,d));
  c=mix(c,lite*(1.0+0.3*uForS.x),smoothstep(${MR.toFixed(3)},${(MR - .004).toFixed(3)},d));
  c+=lite*(0.25+0.25*uForS.x+0.6*uForS.y)*exp(-max(d-${MR.toFixed(3)},0.0)*7.0)*step(${MR.toFixed(3)},d);
  c+=lite*shaft*0.3;
  vec2 g=vec2(sp.x*45.0,sp.y*45.0-t*0.5), cell=floor(g); float h=hash(cell);
  c+=hsv(fh-0.05,0.6,1.0)*step(0.985,h)*smoothstep(0.3,0.0,length(fract(g)-0.5))*(0.4+0.4*sin(t*2.0+h*40.0));
  return c;
}`,
    fn: 'forest',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uForA, P.forA); gl.uniform2fv(u.uForS, P.forS); },
  // its front plane: the nearest layer of trunks and ferns
  front: {
    fn: 'forestFront',
    glsl: `
float forestFront(vec2 sp){ float s; return forLayer(sp,5.0,s); }`,
    path2d(o, P, t){ layer2d(o, P, t, NL - 1, (x, y, w, h) => o.rect(x, y, w, h), pts => { o.moveTo(...pts[0]); pts.forEach(p => o.lineTo(...p)); o.closePath(); }); },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, a = Math.min(1, P.w.forest);
    const fh = .45 + .08*Math.sin(P.hue*Math.PI*2), [lvl, flare] = P.forS, mx = X(MOON[0]), my = Y(MOON[1]);
    o.globalAlpha = a;
    const sky = o.createRadialGradient(mx, my, 0, mx, my, .85*u*1.2);
    sky.addColorStop(0, hc(fh + .02, 50, 70, 1)); sky.addColorStop(1, hc(fh + .22, 75, 4, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter';
    const glow = o.createRadialGradient(mx, my, MR*u, mx, my, MR*u*4);
    glow.addColorStop(0, hc(fh + .02, 30, 80, .35 + .25*lvl + .5*flare)); glow.addColorStop(1, hc(fh + .02, 30, 80, 0));
    o.fillStyle = glow; o.fillRect(mx - MR*u*4, my - MR*u*4, MR*u*8, MR*u*8);
    o.fillStyle = hc(fh + .02, 30, 80, .06*(.5 + .4*lvl + 1.2*flare));   // shafts falling from the moon
    for (let r = 0; r < 11; r++) { const a0 = Math.PI*(.5 + (r + .25 + t*.05/(2*Math.PI))/11*2), a1 = a0 + Math.PI/22;
      if (Math.sin(a0) > .2) continue;
      o.beginPath(); o.moveTo(mx, my); o.lineTo(mx + Math.cos(a0)*u*1.5, my - Math.sin(a0)*u*1.5); o.lineTo(mx + Math.cos(a1)*u*1.5, my - Math.sin(a1)*u*1.5); o.fill(); }
    for (let i = 0; i < 60; i++) { o.fillStyle = hc(fh - .05, 60, 65, .4*(.5 + .5*Math.sin(t*2 + i))); o.fillRect(X((rnd(i) - .5)*W/u), Y(fr(rnd(i + 50) + t*.011)*.9 - .4), 1.5, 1.5); }
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = hc(fh + .02, 30, 88, 1); o.beginPath(); o.arc(mx, my, MR*u, 0, Math.PI*2); o.fill();
    for (let k = 0; k < NL; k++) {   // far to near: pale mist to black
      const near = (k + 1)/NL, p = Math.pow(near, .6);
      o.fillStyle = hc(fh + .03 + .25*p, 30 + 30*p, 68*Math.pow(1 - p, 1.3) + 2, 1);
      o.beginPath(); layer2d(o, P, t, k, (x, y, w, h) => o.rect(x, y, w, h), pts => { o.moveTo(...pts[0]); pts.forEach(q => o.lineTo(...q)); o.closePath(); }); o.fill();
      o.fillStyle = hc(fh + .02, 30, 80, .2*(1 - near*.5));   // the edge facing the moon
      layer2d(o, P, t, k, (x, y, w, h) => { const c = x + w/2 > mx ? x : x + w - Math.max(1, w*.2); o.fillRect(c, y, Math.max(1, w*.2), h); }, null);
      if (k >= 4) { o.globalCompositeOperation = 'lighter'; caps2d(o, P, t, k, fh); o.globalCompositeOperation = 'source-over'; }
    }
    o.globalAlpha = 1;
  },
};
// simple mode's layer k: its trunks through rect(x, y, w, h), its floor and ferns as one outline through poly(points)
function layer2d(o, P, t, k, rect, poly){
  const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
  const [dn, D] = flat(k, P.forA), sx = P.forA[3]*(k + 1)/NL*Math.sin(t*.7 + k), dy = dn*.7;
  const f = 2.5 + (NL - 1 - k)*2;
  for (let s = Math.floor((-asp/2 - .1 + sx)*f); s <= Math.ceil((asp/2 + .1 + sx)*f); s++) {
    const tr = trunk(s, k, D); if (!tr) continue;
    const [c, w] = tr, g = ground(c, k, D) - dy;
    rect(X(c - w - sx), Y(.56 - dy), Math.max(1, w*2*u), Y(g) - Y(.56 - dy) + 2);
    rect(X(c - w*1.9 - sx), Y(g + .04), w*3.8*u, Y(g) - Y(g + .04) + 2);   // flaring at the root
  }
  if (poly) { const pts = [[0, H]]; for (let j = 0; j <= 480; j++) { const x = (j/480 - .5)*asp; pts.push([X(x), Y(fern(x + sx, k, D) - dy)]); } pts.push([W, H]); poly(pts); }
}
function caps2d(o, P, t, k, fh){   // glowing caps on the nearest floors, pulsing on the beat
  const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
  const [dn, D] = flat(k, P.forA), sx = P.forA[3]*(k + 1)/NL*Math.sin(t*.7 + k), dy = dn*.7;
  o.fillStyle = hc(fh + (fr(k*.37) > .5 ? .45 : -.05), 60, 60, Math.min(1, .6 + .8*P.beat));
  for (let id = Math.floor((-asp/2)*14 + k*3) - 1; id < (asp/2)*14 + k*3 + 1; id++) {
    const h = fr(Math.sin(id*12.9898 + (k + D)*78.233)*43758.5453); if (h < .7) continue;
    const cx = (id + .5 - k*3)/14 + (fr(h*13) - .5)*.03, cy = ground(cx, k, D) + .006 + .01*fr(h*7) - dy;
    o.beginPath(); o.ellipse(X(cx - sx), Y(cy), .018*u, .01*u, 0, Math.PI, 0); o.fill();
  }
}
