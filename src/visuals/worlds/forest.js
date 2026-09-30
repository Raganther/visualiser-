// The paper forest: six cut-paper layers of wood stepping back into the mist, each casting a soft shadow on the one
// behind and catching the light on its upper edges. Its trees are paper shapes (pines of stacked triangles, round
// canopies, tall poplars), mixed differently in each section, and each section is a season with its own colours: autumn
// under an amber sky, a pink dawn, winter (snow on the pines, snow falling), an enchanted night of fireflies, a misty
// morning, a violet sunset, cherry blossom. Some have a low banded sun whose rays fan out between the trees; none has a
// moon. The trees bend with the bass and whip round in a gust on the drop; leaves (or petals, or snow) drift down on the
// wind, more of them with the hi-hats. Each section's wood rises as the old one sinks, like stage flats. The user found
// the first glowing forest dark and flat, and the moon naff.
import { sectionLayout } from '../../util.js';
import { L } from '../../audio/listen.js';
import { TUNE } from '../../tuning.js';

const NL = 6, HOR = -.28;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)/255);
// palettes: sky top, sky at the horizon, far wood, near wood, foliage A, foliage B, light; and a sun, fireflies, snow,
// how much falls (leaves, petals or snow), and what colour the falling things are (from the foliage or the light)
const PALS = [
  {name: 'autumn',  c: ['#3a1f4f', '#ffb86b', '#c98a6b', '#2b1a1f', '#e8702a', '#b8322a', '#ffe7a3'], sun: 1, ff: 0, snow: 0, fall: 1},
  {name: 'dawn',    c: ['#6a7fdb', '#ffd3c4', '#a8b8c8', '#1f3b3a', '#8fd694', '#3f8f6a', '#fff1d6'], sun: 1, ff: 0, snow: 0, fall: .4},
  {name: 'winter',  c: ['#2b3d6b', '#dfe8f2', '#9fb3c8', '#12203a', '#3e6b7a', '#1d3b4a', '#ffffff'], sun: 0, ff: 0, snow: 1, fall: 1},
  {name: 'night',   c: ['#07061a', '#2f5d6b', '#1f3d4a', '#050a10', '#1f6b5a', '#6b2fa0', '#b8ffea'], sun: 0, ff: 1, snow: 0, fall: 0},
  {name: 'mist',    c: ['#8c9a92', '#e6ece4', '#b7c4b8', '#2c3a33', '#6f8f6a', '#3d5a45', '#ffffff'], sun: 0, ff: 0, snow: 0, fall: .3},
  {name: 'sunset',  c: ['#2e1b5b', '#ff6f61', '#b0567a', '#1a0f24', '#ff9e5e', '#8a2c6b', '#ffd27a'], sun: 1, ff: .5, snow: 0, fall: .6},
  {name: 'blossom', c: ['#e89ab8', '#fff4e6', '#e7b7c8', '#4a2b3a', '#ff9ec4', '#e85d9a', '#fffaf0'], sun: 0, ff: 0, snow: 0, fall: 1},
].map(p => ({...p, c: p.c.map(hex)}));
const fr = v => v - Math.floor(v), rnd = (D, s) => fr(Math.sin(D*127.1 + s*311.7)*43758.5453);
// a section's wood: its palette, and how much of each tree (pines, round canopies, poplars; and gaps)
function style(D){ const w = [0, 0, 0].map((_, i) => rnd(D, 20 + i) < .45 ? .1 : 1); return {pal: PALS[Math.floor(rnd(D, 3)*PALS.length)], w}; }
const lerp = (a, b, m) => a + (b - a)*m, lerp3 = (a, b, m) => a.map((v, i) => lerp(v, b[i], m));
const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, lvl: .3, gust: 0, drops: 0, h: 0, sw: 0};
let cur = null, force = null;
export function forestForce(D, gust){ force = D; st.D0 = st.D1 = D; st.tr = 1; if (gust != null) st.gustHold = gust; }
function blend(){
  const m0 = Math.min(1, st.tr), m = m0*m0*(3 - 2*m0), a = style(st.D0), b = style(st.D1), P2 = k => lerp(a.pal[k], b.pal[k], m);
  return {m, w: a.w.map((v, i) => lerp(v, b.w[i], m)), sun: P2('sun'), ff: P2('ff'), snow: P2('snow'), fall: P2('fall'), c: a.pal.c.map((c, i) => lerp3(c, b.pal.c[i], m))};
}
const SUN = [-.35, HOR + .1];
// layer k's ground (0 far .. NL-1 near) in layout D
const ground = (x, k, D) => -.02 - .085*k + .03*Math.sin(x*(1.6 + k*.5) + k*1.7 + D*2.3) + .012*Math.sin(x*(5 + k) + D);
// the tree in slot s of layer k: [type 1 pine, 2 round, 3 poplar, centre, height] or null
function tree(s, k, D, w){
  const n = k/(NL - 1), fw = .045 + .075*n, h1 = rnd(s, k*13 + D), h2 = rnd(s + 7, k + D*3), tot = w[0] + w[1] + w[2] + .5;
  let pick = h2*tot, type = 0; for (let i = 0; i < 3; i++) { if (pick < w[i]) { type = i + 1; break; } pick -= w[i]; }
  return type ? [type, (s + .5 + (h1 - .5)*.5)*fw, (.12 + .14*h1)*(.7 + 1.5*n)] : null;
}
export default {
  key: 'forest', kind: 'world', label: 'Paper forest',
  light: {hue: .1, sat: .4, x: -.4, y: .5},              // a low sun (or glow) behind the wood
  horizonY: HOR,
  // calm to steady, melodic, a little noisy (texture): the wood's mood
  suits: (rf, T) => -rf.perc*.2 + rf.mid*.3 + (rf.noise || 0)*.2 - T*.2,
  params(P, x){
    const C = TUNE.forest, J = x.J, on = P.w.forest > .05;
    if (force === null) sectionLayout(st, 'forestD', J, on, x.dt, C.morphSecs);
    st.lvl += ((J ? J.tension : .4) - st.lvl)*Math.min(1, x.dt*.4);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (on) st.gust = 1; }
    st.gust = Math.max(0, st.gust - x.dt/C.gustSecs); st.h += (L.hat - st.h)*Math.min(1, x.dt*3);
    st.sw += ((x.sBass || 0)*x.react - st.sw)*Math.min(1, x.dt*2);
    const gust = st.gustHold != null ? st.gustHold : Math.sin(Math.PI*Math.min(1, (1 - st.gust)*1.5))*st.gust;   // a bend that whips over and springs back
    cur = blend();
    P.forA = [st.D0, st.D1, st.tr, st.sw*C.sway + gust*C.gust];
    P.forB = [st.lvl, gust, st.h, cur.m];
    P.forW = [...cur.w, 0]; P.forS = [cur.sun, cur.ff, cur.snow, cur.fall]; P.forK = cur.c.flat();
  },
  glsl: {
    uniforms: 'uniform vec4 uForA,uForB,uForW,uForS; uniform vec3 uForK[7];',
    functions: `
float forGround(float x,float k,float D){ return -0.02-0.085*k+0.03*sin(x*(1.6+k*0.5)+k*1.7+D*2.3)+0.012*sin(x*(5.0+k)+D); }
// what layer k covers at p, in layout D: 0 nothing, 1 ground, 2 trunk, 3 foliage (4: snow on it)
float forCov1(vec2 p,float k,float D){
  float g=forGround(p.x,k,D);
  if(p.y<g) return 1.0;
  float n=k/${(NL - 1).toFixed(1)}, fw=0.045+0.075*n, bend=uForA.w*(0.3+n)*(0.7+0.3*sin(uTime*0.9+k*1.3));
  // (a tree bends from its root: find its slot where its trunk leans at this height)
  float s=floor((p.x-bend*max(p.y-g,0.0)*3.0)/fw);
  for(int j=-1;j<2;j++){ float sj=s+float(j);   // (this slot and both neighbours: a canopy can reach over)
    float h1=hash(vec2(sj,k*13.0+D)), h2=hash(vec2(sj+7.0,k+D*3.0)), tot=uForW.x+uForW.y+uForW.z+0.5, pick=h2*tot, type=0.0;
    if(pick<uForW.x) type=1.0; else if(pick<uForW.x+uForW.y) type=2.0; else if(pick<uForW.x+uForW.y+uForW.z) type=3.0;
    if(type<0.5) continue;
    float c=(sj+0.5+(h1-0.5)*0.5)*fw, gb=forGround(c,k,D), h=(0.12+0.14*h1)*(0.7+1.5*n), y=p.y-gb, cap=fw*1.3;
    if(y<-0.02||y>h*1.05) continue;
    float x=p.x-c-bend*y*y/h*3.0, tw=0.004+0.004*n;   // (the bend grows up the tree)
    if(type<1.5){   // a pine: three stacked triangles
      for(int q=0;q<3;q++){ float fq=float(q), yb=h*(0.14+fq*0.24), yt=yb+h*0.42, hw=min(h*0.28,cap)*(1.0-fq*0.22);
        if(y>yb&&y<yt&&abs(x)<hw*(yt-y)/(yt-yb)) return (uForS.z>0.01&&y>yt-h*0.14-0.01*abs(sin(x*300.0))) ? 4.0 : 3.0+h1*0.45; }
      if(abs(x)<tw&&y<h*0.2) return 2.0;
    } else if(type<2.5){   // a round canopy of three circles
      float r=min(h*0.3,cap*0.72); if(length(vec2(x,y-h*0.7))<r||length(vec2(abs(x)-r*0.62,y-h*0.55))<r*0.72) return (uForS.z>0.01&&y>h*0.7+r*0.55) ? 4.0 : 3.0+h1*0.45;
      if(abs(x)<tw*1.2&&y<h*0.6) return 2.0;
    } else {   // a poplar: a tall flame
      vec2 e=vec2(x/min(h*0.13,cap),(y-h*0.58)/(h*0.46)); if(dot(e,e)<1.0) return 3.0+h1*0.45;
      if(abs(x)<tw&&y<h*0.3) return 2.0;
    }
  }
  return 0.0;
}
float forCov(vec2 p,float k){   // (a new wood rises as the old sinks, nearest first)
  float m=clamp(uForB.w*1.6-(${(NL - 1).toFixed(1)}-k)*0.12,0.0,1.0), D=m<0.5 ? uForA.x : uForA.y;
  float tr=clamp(uForA.z*1.6-(${(NL - 1).toFixed(1)}-k)*0.12,0.0,1.0);
  return forCov1(vec2(p.x,p.y+(1.0-abs(tr*2.0-1.0))*0.7),k,D);
}
vec3 forSky(vec2 sp){
  float t=clamp((sp.y-(${HOR.toFixed(3)}))/0.7,0.0,1.0);
  vec3 c=mix(uForK[1],uForK[0],pow(t,0.8));
  vec2 v=sp-vec2((${SUN[0]})*ASP,(${SUN[1].toFixed(3)})); float d=length(v);
  c+=uForK[6]*exp(-d*3.0)*(0.25+0.2*uForB.x)*(0.4+0.6*uForS.x);                               // the glow low in the sky
  if(uForS.x>0.01){ float ray=smoothstep(0.6,1.0,sin(atan(v.y,v.x)*14.0+uTime*0.04));          // its rays fanning out
    c=mix(c,uForK[6],ray*0.18*uForS.x*exp(-d*1.2));
    float disc=smoothstep(0.1,0.095,d), band=step(0.35,fract(((${SUN[1].toFixed(3)})-sp.y)*28.0))+step(sp.y,(${SUN[1].toFixed(3)})-0.01);
    c=mix(c,mix(uForK[6],uForK[1],0.3),disc*mix(1.0,band,smoothstep(0.0,-0.06,sp.y-(${SUN[1].toFixed(3)})))*uForS.x); }
  return c;
}
vec3 forest(vec2 sp){
  float t=uTime;
  vec3 sky=forSky(sp), col=sky; float lay=-1.0;
  for(int i=${NL - 1};i>=0;i--){
    float k=float(i), cv=forCov(sp,k);
    if(cv>0.5){
      float n=k/${(NL - 1).toFixed(1)};
      vec3 base=mix(uForK[2],uForK[3],pow(n,0.75));
      vec3 fol=mix(uForK[4],uForK[5],clamp((cv-3.0)*2.2,0.0,1.0));   // each tree its own shade
      col=cv>3.5 ? mix(uForK[6],base,0.1) : cv>2.5 ? mix(base,fol,0.25+0.55*n) : cv>1.5 ? base*0.7 : base;
      col=mix(col,uForK[1],0.55*pow(1.0-n,1.6));                                                 // the mist: far layers fade into the sky
      if(forCov(sp+vec2(0.004,0.006),k)<0.5) col=mix(col,uForK[6],0.3+0.2*n);                    // the light on its upper edges
      if(i<${NL - 1}&&forCov(sp+vec2(-0.008,0.014),k+1.0)>0.5) col*=0.65;                        // the shadow of the layer in front
      if(uForS.x>0.01){ vec2 v=sp-vec2((${SUN[0]})*ASP,(${SUN[1].toFixed(3)}));                     // the sun's rays over the far layers
        col=mix(col,uForK[6],smoothstep(0.6,1.0,sin(atan(v.y,v.x)*14.0+t*0.04))*0.12*uForS.x*(1.0-n)*exp(-length(v)*1.2)); }
      col*=paper(sp+k); lay=k; break;
    }
  }
  if(lay<0.0) col=sky*paper(sp);
  // leaves, petals or snow drifting down on the wind (in front of all but the nearest layer)
  if(uForS.w>0.01&&lay<${(NL - 1).toFixed(1)}){ vec2 g=vec2(sp.x*14.0+t*0.25+sin(sp.y*3.0+t*0.5)*0.6,sp.y*14.0+t*(0.6+0.3*uForS.z));
    vec2 id=floor(g), f=fract(g)-0.5; float h=hash(id);
    if(h>0.86-0.08*uForB.z){ float a=h*40.0+t*(1.0+h*2.0); vec2 q=vec2(cos(a)*f.x+sin(a)*f.y,-sin(a)*f.x+cos(a)*f.y);
      float leaf=length(q*vec2(1.0,uForS.z>0.5 ? 1.0 : 2.4))-(uForS.z>0.5 ? 0.09 : 0.14);
      col=mix(col,mix(mix(uForK[4],uForK[5],fract(h*7.0)),uForK[6],uForS.z),smoothstep(0.02,0.0,leaf)*uForS.w*(0.8+0.2*step(0.0,q.y))); } }
  // fireflies, blinking with the hi-hats
  if(uForS.y>0.01){ vec2 g=sp*vec2(9.0,11.0)+vec2(sin(t*0.3)*0.5,t*0.1); vec2 id=floor(g); float h=hash(id+3.0);
    vec2 fp=fract(g)-0.5+0.3*vec2(sin(t*0.7+h*20.0),cos(t*0.6+h*13.0));
    col+=uForK[6]*uForS.y*step(0.7,h)*exp(-dot(fp,fp)*900.0)*(0.5+0.8*abs(sin(t*2.0+h*30.0))*(0.6+uForB.z)); }
  return col;
}`,
    fn: 'forest',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uForA, P.forA); gl.uniform4fv(u.uForB, P.forB); gl.uniform4fv(u.uForW, P.forW); gl.uniform4fv(u.uForS, P.forS);
    if (u['uForK[0]']) gl.uniform3fv(u['uForK[0]'], P.forK); },
  // its front plane: the nearest layer of the wood
  front: {
    fn: 'forestFront',
    glsl: `
float forestFront(vec2 sp){ return forCov(sp,${(NL - 1).toFixed(1)})>0.5 ? 1.0 : 0.0; }`,
    path2d(o, P, t){ if (!cur) return; const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, D = cur.m < .5 ? st.D0 : st.D1;
      o.moveTo(0, H); for (let j = 0; j <= 100; j++) { const x = (j/100 - .5)*asp; o.lineTo(X(x), Y(ground(x, NL - 1, D))); } o.lineTo(W, H); o.closePath(); },
  },
  draw2d(o, P, t){
    if (!cur) return;
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.forest);
    const K = cur.c, rgb = (c, m = 1) => `rgb(${c.map(v => Math.round(Math.min(1, v*m)*255)).join(',')})`, mix = (p, q, m) => p.map((v, i) => v + (q[i] - v)*m);
    const D = cur.m < .5 ? st.D0 : st.D1, bend0 = P.forA[3];
    o.save(); o.globalAlpha = a;
    const sky = o.createLinearGradient(0, Y(.5), 0, Y(HOR)); sky.addColorStop(0, rgb(K[0], .85)); sky.addColorStop(1, rgb(K[1], .75));   // (darker: simple mode's glow would wash it out)
    o.fillStyle = sky; o.fillRect(0, 0, W, H);
    const sx = X(SUN[0]*asp), sy = Y(SUN[1]), gl = o.createRadialGradient(sx, sy, 0, sx, sy, .5*u);
    gl.addColorStop(0, `rgba(${K[6].map(v => Math.round(v*255)).join(',')},${(.3*(.4 + .6*cur.sun)).toFixed(3)})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = gl; o.fillRect(0, 0, W, H);
    if (cur.sun > .01) { o.globalAlpha = a*cur.sun; o.fillStyle = rgb(mix(K[6], K[1], .3)); o.beginPath(); o.arc(sx, sy, .1*u, Math.PI, 0); o.fill();
      for (let b = 0; b < 4; b++) o.fillRect(sx - .1*u, sy + (b*.018 + .005)*u, .2*u, .01*u); o.globalAlpha = a; }
    for (let k = 0; k < NL; k++) {   // the wood, far to near, each layer shadowing the one behind
      const n = k/(NL - 1), base = mix(mix(K[2], K[3], Math.pow(n, .75)), K[1], .55*Math.pow(1 - n, 1.6)), fol = mix(mix(base, mix(K[4], K[5], .5), .25 + .55*n), K[1], .55*Math.pow(1 - n, 1.6));
      o.shadowColor = 'rgba(0,0,0,.35)'; o.shadowBlur = .015*u; o.shadowOffsetY = -.014*u; o.shadowOffsetX = .008*u;
      o.fillStyle = rgb(base); o.beginPath(); o.moveTo(0, H);
      for (let j = 0; j <= 100; j++) { const x = (j/100 - .5)*asp; o.lineTo(X(x), Y(ground(x, k, D))); } o.lineTo(W, H); o.fill();
      const fw = .045 + .075*n, bend = bend0*(.3 + n)*(.7 + .3*Math.sin(t*.9 + k*1.3));
      o.fillStyle = rgb(fol);
      for (let s = Math.floor(-asp/2/fw) - 1; s <= Math.ceil(asp/2/fw) + 1; s++) {
        const tr = tree(s, k, D, cur.w); if (!tr) continue;
        const [type, c, h] = tr, gb = ground(c, k, D), bx = y => c + bend*y*y/h*3;
        o.fillStyle = rgb(mix(mix(base, mix(K[4], K[5], rnd(s, k*13 + D)), .25 + .55*n), K[1], .55*Math.pow(1 - n, 1.6)));
        o.beginPath();
        if (type === 1) for (let q = 0; q < 3; q++) { const yb = h*(.14 + q*.24), yt = yb + h*.42, hw = Math.min(h*.28, fw*1.3)*(1 - q*.22);
          o.moveTo(X(bx(yb) - hw), Y(gb + yb)); o.lineTo(X(bx(yt)), Y(gb + yt)); o.lineTo(X(bx(yb) + hw), Y(gb + yb)); }
        else if (type === 2) { const r = Math.min(h*.3, fw*1.3*.72); o.moveTo(X(bx(h*.7) + r), Y(gb + h*.7)); o.arc(X(bx(h*.7)), Y(gb + h*.7), r*u, 0, Math.PI*2);
          for (const sg of [-1, 1]) { o.moveTo(X(bx(h*.55) + sg*r*.62 + r*.72), Y(gb + h*.55)); o.arc(X(bx(h*.55) + sg*r*.62), Y(gb + h*.55), r*.72*u, 0, Math.PI*2); } }
        else { o.ellipse(X(bx(h*.58)), Y(gb + h*.58), h*.13*u, h*.46*u, -bend*.5, 0, Math.PI*2); }
        o.rect(X(c) - Math.max(1, .004*u), Y(gb + h*.3), Math.max(2, .008*u), h*.3*u);
        o.fill();
      }
      o.shadowColor = 'transparent';
    }
    if (cur.fall > .01) { o.globalAlpha = a*cur.fall;   // leaves, petals or snow drifting down
      for (let i = 0; i < 50; i++) { const h = rnd(i, 3), px = fr(h*7 + t*.02*(1 + h))*asp - asp/2 + .03*Math.sin(t + i), py = .5 - fr(h*3 + t*(.05 + .03*h)*(1 + cur.snow*.5));
        o.fillStyle = rgb(mix(mix(K[4], K[5], fr(h*7)), K[6], cur.snow)); o.beginPath(); o.ellipse(X(px), Y(py), .007*u, cur.snow > .5 ? .007*u : .003*u, t*(1 + h*2) + h*40, 0, Math.PI*2); o.fill(); }
      o.globalAlpha = a; }
    if (cur.ff > .01) { o.globalCompositeOperation = 'lighter'; o.fillStyle = rgb(K[6]);   // fireflies
      for (let i = 0; i < 30; i++) { const h = rnd(i, 9), px = (h - .5)*asp + .05*Math.sin(t*.7 + h*20), py = -.3 + .5*rnd(i, 4) + .04*Math.cos(t*.6 + h*13);
        o.globalAlpha = a*cur.ff*(.3 + .7*Math.abs(Math.sin(t*2 + h*30))); o.beginPath(); o.arc(X(px), Y(py), .004*u, 0, Math.PI*2); o.fill(); }
      o.globalCompositeOperation = 'source-over'; }
    o.restore();
  },
};
