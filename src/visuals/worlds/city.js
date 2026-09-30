// City: a skyline in four rows against a glowing dusk, far to near, as a stylised poster: dark blocks lit on the side facing
// the light and shadowing the rows behind, far towers pale in the haze. Each section brings its own district (the old
// buildings sink and the new ones rise in a wave; a returning section brings its skyline back). The lights follow the
// build: windows light floor by floor from the street up and neon signs switch on one by one as the tension rises,
// flickering on stabs; antenna lights blink on the beat; searchlights swing on the bar. The skyline breathes a little
// with the spectrum and leaps on a drop. Traffic streams along a wet street that mirrors it all.
import { dataArr } from '../../state.js';
import { hc, rowsAbove, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

// the district on screen and the one rising (D0, D1, how far the change has got), the lights' level, the drop's leap,
// the searchlights' angles now and where they're swinging to
const st = {seed:0, D0:0, D1:0, tr:1, ty:null, n:0, lvl:.3, jump:0, drops:0, bars:0, sw:[.35, -.3], swT:[.35, -.3]};
const ROWS = 4, GROUND = -.3, MX = -.28, MY = .3;   // where the light comes from: across (times the aspect) and up (a glow; the moon is gone)
// a row's building layout, the same numbers in both renderers (each draws its own buildings): width, scroll speed, how
// tall, how hazy (far rows fade most)
const TALL = [1.35, 1.1, .95, .85], HAZE = [.72, .5, .26, .04];   // far rows are the tall towers downtown, pale in the haze
const R0 = {w: .03, dw: .018, speed: .004, dspeed: .009, off: 3.7};   // a row's width, scroll speed and offset grow nearer
const row = L => ({w: R0.w + L*R0.dw, speed: R0.speed + L*R0.dspeed, tall: TALL[L], haze: HAZE[L], off: L*R0.off});
// the same numbers in GLSL: a float, and a pick by row (L) from a table
const f = x => x.toFixed(4), byRow = a => a.map((v, i) => i < a.length - 1 ? `L<${i}.5 ? ${f(v)} : ` : f(v)).join('');
const GW = L => `${f(R0.w)}+${L}*${f(R0.dw)}`;
const hs = (a, b) => ((Math.sin(a*12.9898 + b*78.233)*43758.5453) % 1 + 1) % 1;
let rnd2d = null;                                      // simple mode's building randoms, per row
export default {
  key: 'city', kind: 'world', label: 'City',
  light: {hue: .6, sat: .3, x: -.5, y: .6},              // the glow, up to the left (for objects: scene/context.js)
  horizonY: GROUND,                                    // the horizon layer's grid floor lines up with the street
  // steady kicks and bass at a middling intensity
  suits: (rf, T) => rf.perc*.6 + rf.low*.3 - Math.abs(T)*.5 + .05,
  onBeat(pos){
    if (pos !== 0) return;
    st.seed++;                                         // some windows change on the downbeat
    if (++st.bars % TUNE.city.sweepBars === 0) st.swT = [.5*Math.sin(st.bars*2.3) + .1, .5*Math.sin(st.bars*1.7 + 2) - .1];   // the searchlights swing
  },
  params(P, x){
    const C = TUNE.city, J = x.J, off = !(P.w.city > .05);
    sectionLayout(st, 'cityD', J, !off, x.dt, C.riseSecs);   // a new section brings its own district, a returning one its old skyline
    st.lvl += ((J ? J.tension : .5) - st.lvl)*Math.min(1, x.dt*C.lightEase);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (!off) st.jump = 1; }
    st.jump = Math.max(0, st.jump - x.dt*1.2);
    for (let k = 0; k < 2; k++) st.sw[k] += (st.swT[k] - st.sw[k])*Math.min(1, x.dt*2.5);
    P.citySeed = st.seed % 64;
    P.cityA = [st.D0, st.D1, st.tr, st.lvl];
    P.cityB = [Math.min(1, x.hit || 0), st.jump*st.jump, st.sw[0], st.sw[1]];
  },
  glsl: {
    uniforms: 'uniform float uCitySeed; uniform vec4 uCityA,uCityB;',
    functions: `
// city: a building of row L at x: its top, and which building (id, its key in its district) and where across it (lx,
// 0..1), for width w. A change of district reaches each building in turn: the old one sinks, the new one rises
float cityRow(float x,float L,float w,out float id,out float lx){
  float xs=x+uTime*(${f(R0.speed)}+L*${f(R0.dspeed)})+L*${f(R0.off)};
  float n=floor(xs/w); lx=fract(xs/w);
  float s=clamp(uCityA.z*1.6-hash(vec2(n,L+41.0))*0.6,0.0,1.0);
  id=n+(s<0.5 ? uCityA.x : uCityA.y)*61.7;
  float hb=hash(vec2(id,L+1.0)), g=abs(s*2.0-1.0); g=g*g*(3.0-2.0*g);
  return -0.3+(0.05+0.2*hb*hb+0.04*hash(vec2(id,L+5.0)))*(${byRow(TALL)})*g
    +specD(fract(n*0.137+L*0.31))*${f(TUNE.city.breathe)}*uReact*(0.3+L*0.25)+uCityB.y*${f(TUNE.city.jump)}*(0.5+hb)*g;
}
// its outline: the body with a gap each side, a narrower crown on some (a setback), an antenna on others
float cityShape(float lx,float y,float h,float id,float L,float w){
  if(h<-0.299) return 0.0;
  float e=0.05+0.07*hash(vec2(id,L+7.0)), sb=hash(vec2(id,L+11.0));
  float inset=sb>0.5 ? 0.14+0.18*fract(sb*7.0) : 0.0, cut=h-(h+0.3)*0.2;
  float x0=y>cut ? e+inset : e;
  float body=step(x0,lx)*step(lx,1.0-x0)*step(y,h);
  float ah=sb>0.8 ? 0.02+0.05*fract(sb*13.0) : 0.0;
  float ant=step(abs(lx-0.5)*w,0.0011)*step(h,y)*step(y,h+ah);
  return max(body,ant);
}
vec3 citySky(vec2 sp){
  float t=clamp(sp.y+0.3,0.0,1.0);
  vec3 c=mix(hsv(uHue+0.93,0.7,0.62),hsv(uHue+0.7,0.75,0.04),pow(t,0.5));      // a glowing dusk low down, deep night above
  c+=hsv(uHue+0.04,0.8,0.6)*exp(-(sp.y+0.3)*10.0)*0.45;                          // a hot band along the horizon
  // long clouds, lit from below by the city
  float cl=sin(sp.x*3.1+uTime*0.02+sin(sp.x*7.3)*0.4)*0.5+0.5, band=exp(-pow((sp.y-0.14-0.05*sin(sp.x*1.7))*9.0,2.0));
  c+=hsv(uHue+0.96,0.55,0.4)*band*smoothstep(0.35,0.9,cl)*(0.7+0.3*sin(sp.x*23.0));
  // two searchlights from behind the towers, swinging to a new angle each bar, brighter on the beat
  for(int k=0;k<2;k++){
    float a=k==0 ? uCityB.z : uCityB.w; vec2 d=vec2(sin(a),cos(a)), v=sp-vec2((k==0 ? -0.12 : 0.3)*ASP,-0.3);
    float al=dot(v,d), ac=abs(v.x*d.y-v.y*d.x);
    c+=hsv(uHue+0.6,0.12,1.0)*step(0.0,al)*exp(-ac/(0.003+max(al,0.0)*0.045))*exp(-al*0.9)*(0.16+uBeat*0.22);
  }
  vec2 mp=vec2(ASP*${f(MX)},${f(MY)}); float md=length(sp-mp);
  c+=hsv(uHue+0.1,0.3,1.0)*(0.12*exp(-md*6.0)+0.06*exp(-md*2.5));               // a glow in the haze where the light comes from (no moon: the user found it naff)
  return c;
}
vec3 cityAbove(vec2 sp){
  // the nearest row covering the pixel hides the rest (and the sky), so the rows are tried near to far and the first one
  // found is the one shaded; the sky only where no building stands
  vec3 c=vec3(0.0), haze=hsv(uHue+0.93,0.55,0.5); bool built=false;
  float away=sp.x>ASP*${f(MX)} ? 1.0 : -1.0;                                      // which way the light falls
  for(int j=0;j<4;j++){
    int i=3-j; float L=float(i), w=${GW('L')}, id, lx;
    float h=cityRow(sp.x,L,w,id,lx);
    if(cityShape(lx,sp.y,h,id,L,w)<0.5) continue;
    float fl=L/3.0, style=hash(vec2(id,L+3.0)), e=0.05+0.07*hash(vec2(id,L+7.0));
    float u=clamp((lx-e)/(1.0-2.0*e),0.0,1.0); if(away<0.0) u=1.0-u;              // across the body, 0 on the side facing the light
    float face=step(u,0.2);                                                        // that side, turned toward the light
    vec3 b=hsv(uHue+0.68,0.45,0.025+0.03*fl);                                      // the front, in shadow
    b+=face*hsv(uHue+0.6,0.35,0.13+0.07*fl);                                       // the side, lit
    b+=hsv(uHue+0.6,0.25,0.6)*smoothstep(0.025,0.0,u)*0.35;                        // its edge catching the light
    b+=hsv(uHue+0.93,0.6,1.0)*0.07*smoothstep(0.15,0.0,sp.y-(h-0.06))*(1.0-fl*0.6); // the top catches the sky's glow
    // windows on the front: a grid per building (offices wider), lit floor by floor from the street up as the build rises,
    // a share changing on the downbeat
    float cols=3.0+floor(style*4.0), lf=(u-0.2)/0.8;
    vec2 wg=vec2(lf*cols,(h-sp.y)/(w*0.2)), wc=floor(wg), wf=fract(wg);
    float win=(1.0-face)*step(0.18,wf.x)*step(wf.x,style>0.7 ? 0.95 : 0.78)*step(0.28,wf.y)*step(wf.y,0.76)*step(1.0,wc.y)
      *step(0.04,lf)*step(lf,0.94);
    float yf=clamp((sp.y+0.3)/max(h+0.3,0.01),0.0,1.0);
    float floorOn=step(hash(vec2(id*3.1+floor(wc.y/2.0),L+17.0))*0.45+yf*0.55,0.2+uCityA.w*0.9);
    float cell=hash(vec2(id*7.0+wc.x,wc.y+L*50.0)), swap=step(0.82,hash(vec2(id+wc.x*3.0,wc.y)));
    float lit=floorOn*mix(step(0.5,cell),step(0.5,hash(vec2(id*7.0+wc.x,wc.y+uCitySeed*13.0+L))),swap);
    lit*=step(0.15,style);                                                          // a few buildings stay dark
    vec3 wcol=style<0.55 ? hsv(uHue+0.1+0.04*cell,0.6,1.0) : hsv(uHue+0.55,0.4,1.0);
    b+=wcol*win*lit*(0.3+0.4*fl);
    // neon: a sign down the front of many buildings in the nearer rows, in the palette's colours, switching on one by one
    // as the tension rises and flickering on stabs; lit harder on the beat
    float nh=hash(vec2(id,L+19.0));
    if(i>=1 && nh>0.45){
      float on=step(fract(nh*37.0),uCityA.w*1.15-0.05)*(1.0-step(0.4,uCityB.x)*step(0.5,hash(vec2(id,floor(uTime*18.0)))));
      vec2 q=vec2((u-(nh>0.72 ? 0.3 : 0.8))*w,sp.y-(h-0.1));
      vec2 d=abs(q)-vec2(0.007+0.004*fl,0.05); float sd=length(max(d,0.0))+min(max(d.x,d.y),0.0);
      b+=hsv(uHue+(nh>0.72 ? uPal.y : uPal.z)+0.15*hash(vec2(id,L+23.0)),0.85,1.0)*on*(smoothstep(0.003,0.0,abs(sd))*(1.4+uBeat)+exp(-max(sd,0.0)*45.0)*0.45);
    }
    // an antenna's light, blinking on the beat
    float ah=hash(vec2(id,L+11.0))>0.8 ? 0.02+0.05*fract(hash(vec2(id,L+11.0))*13.0) : -1.0;
    if(ah>0.0) b+=vec3(1.0,0.15,0.1)*smoothstep(0.004,0.0,length(vec2((lx-0.5)*w,sp.y-h-ah)))*(0.3+uBeat*1.2);
    // the shadow of the row in front, cast away from the light
    if(i<3){ float L2=L+1.0, w2=${GW('L2')}, id2, lx2; vec2 q=sp+vec2(-0.03*away,0.035);
      float h2=cityRow(q.x,L2,w2,id2,lx2); b*=1.0-0.6*cityShape(lx2,q.y,h2,id2,L2,w2)*(0.6+0.4*face); }
    c=mix(b,haze,${byRow(HAZE)});                                               // far rows fade into the haze
    built=true; break;
  }
  if(!built) c=citySky(sp);
  c+=hsv(uHue+0.95,0.6,1.0)*exp(-(sp.y+0.3)*16.0)*0.16;                            // fog glowing over the street
  return c;
}
// traffic: headlights one way, tail lights the other, and their streaks down the wet street
vec3 cityTraffic(vec2 sp){
  vec3 c=vec3(0.0);
  for(int k=0;k<2;k++){
    float fk=float(k), y=-0.307-fk*0.012, dir=fk<0.5 ? 1.0 : -1.0;
    float xs=sp.x*14.0-dir*uTime*(0.9+fk*0.4), id=floor(xs), f=fract(xs);
    float car=step(0.55,hash(vec2(id,fk+31.0)));
    vec3 col=fk<0.5 ? vec3(1.0,0.92,0.75) : vec3(1.0,0.12,0.08);
    float dx=(f-0.5)/14.0;
    c+=col*car*exp(-pow(dx/0.004,2.0)-pow((sp.y-y)/0.0022,2.0))*0.9;              // the lamp
    c+=col*car*exp(-pow(dx/0.003,2.0))*smoothstep(0.1,0.0,y-sp.y)*step(sp.y,y)*0.08; // its streak on the wet road
  }
  return c;
}
vec3 city(vec2 sp){
  if(sp.y>=-0.3) return cityAbove(sp);
  float dy=-0.3-sp.y;                    // a wet street: the skyline reflected, rippling
  vec2 r=vec2(sp.x+sin(dy*80.0-uTime*2.5)*0.004*(1.0+uBeat*3.0),-0.3+dy*1.4);
  return cityAbove(r)*0.38*(1.0-clamp(dy*2.5,0.0,0.7))+hsv(uHue+0.95,0.7,1.0)*exp(-dy*10.0)*0.12+cityTraffic(sp);
}`,
    fn: 'city',
  },
  // its front plane, for scenes that put things between its layers: the two nearest rows (the hazy towers stay behind)
  front: {
    fn: 'cityFront',
    glsl: `
float cityFront(vec2 sp){
  if(sp.y<-0.3) return 0.0;
  float f=0.0;
  for(int i=2;i<4;i++){ float L=float(i), w=${GW('L')}, id, lx, h=cityRow(sp.x,L,w,id,lx); f=max(f,cityShape(lx,sp.y,h,id,L,w)); }
  return f;
}`,
    path2d(o, P, t){ const g = geo(o, P); for (const L of [2, 3]) buildings2d(g, L, t, P, (x0, y0, x1, y1) => o.rect(x0, y0, x1 - x0, y1 - y0)); },
  },
  uniforms(gl, u, P){ gl.uniform1f(u.uCitySeed, P.citySeed); gl.uniform4fv(u.uCityA, P.cityA); gl.uniform4fv(u.uCityB, P.cityB); },
  init2d(){ rnd2d = Array.from({length: ROWS}, () => Array.from({length: 80}, () => Array.from({length: 8}, Math.random))); },
  draw2d(o, P, t){ drawCity(o, P, t); drawStreet(o, P, t); },
};
const geo = (o, P) => { const W = o.canvas.width, H = o.canvas.height; return {W, H, u: H, X: x => W/2 + x*H, Y: y => H/2 - y*H, asp: W/H}; };
// every building of row L on screen, as rectangles (body, crown, antenna) through box(x0, y0, x1, y1); each(b) for extras
function buildings2d(g, L, t, P, box, each){
  const R = row(L), shift = t*R.speed + R.off, first = Math.floor((-g.asp/2 + shift)/R.w), [D0, D1, tr] = P.cityA, C = TUNE.city;
  for (let n = first; n*R.w - shift < g.asp/2; n++) {
    const s = Math.min(1, Math.max(0, tr*1.6 - hs(n, L + 41)*.6)), D = s < .5 ? D0 : D1;   // the change of district, in a wave
    const id = n + D*37, r = rnd2d[L][((id % 80) + 80) % 80], sv = dataArr[256 + Math.floor((((n*.137 + L*.31) % 1) + 1) % 1*255)]/255;
    let gr = Math.abs(s*2 - 1); gr = gr*gr*(3 - 2*gr); if (gr < .01) continue;
    const h = GROUND + (.05 + .2*r[0]*r[0] + .04*r[1])*R.tall*gr + sv*C.breathe*P.react*(.3 + L*.25) + P.cityB[1]*C.jump*(.5 + r[0])*gr;
    const e = .05 + .07*r[2], left = n*R.w - shift, x0 = left + R.w*e, x1 = left + R.w*(1 - e), cut = h - (h - GROUND)*.2;
    const inset = r[3] > .5 ? (.14 + .18*r[4])*R.w : 0;
    box(g.X(x0), g.Y(cut), g.X(x1), g.Y(GROUND));                    // the body
    box(g.X(x0 + inset), g.Y(h), g.X(x1 - inset), g.Y(cut) + 1);      // the crown (narrower on a setback)
    const ah = r[3] > .8 ? .02 + .05*r[5] : 0;
    if (ah) box(g.X(left + R.w/2) - 1, g.Y(h + ah), g.X(left + R.w/2) + 1, g.Y(h));   // an antenna
    if (each) each({id, r, h, x0, x1, ah, left, cut, inset});
  }
}
function drawCity(o, P, t){
  const g = geo(o, P), {W, H} = g, a = Math.min(1, P.w.city), mxw = g.asp*MX, lvl = P.cityA[3];
  o.globalAlpha = a;
  const sky = o.createLinearGradient(0, 0, 0, g.Y(GROUND));   // a glowing dusk low down, deep night above
  sky.addColorStop(0, hc(P.hue + .7, 75, 2, 1)); sky.addColorStop(.55, hc(P.hue + .8, 65, 14, 1)); sky.addColorStop(.88, hc(P.hue + .93, 70, 42, 1)); sky.addColorStop(1, hc(P.hue + .02, 80, 55, 1));
  o.fillStyle = sky; o.fillRect(0, 0, W, H);
  o.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {                          // the searchlights, swinging on the bar
    const ang = P.cityB[2 + k], bx = g.X((k ? .3 : -.12)*g.asp), by = g.Y(GROUND), len = g.u*1.2, sp = .045*1.2*g.u;
    const dx = Math.sin(ang), dy = -Math.cos(ang), ex = bx + dx*len, ey = by + dy*len;
    const bg = o.createLinearGradient(bx, by, ex, ey); bg.addColorStop(0, hc(P.hue + .6, 15, 80, .18 + P.beat*.2)); bg.addColorStop(1, hc(P.hue + .6, 15, 80, 0));
    o.fillStyle = bg; o.beginPath(); o.moveTo(bx, by); o.lineTo(ex - dy*sp, ey + dx*sp); o.lineTo(ex + dy*sp, ey - dx*sp); o.closePath(); o.fill();
  }
  o.globalCompositeOperation = 'source-over';
  const mx = g.X(mxw), my = g.Y(MY), halo = o.createRadialGradient(mx, my, 0, mx, my, .3*g.u);
  halo.addColorStop(0, hc(P.hue + .1, 30, 75, .35)); halo.addColorStop(1, hc(P.hue + .1, 30, 75, 0));
  o.fillStyle = halo; o.fillRect(mx - .3*g.u, my - .3*g.u, .6*g.u, .6*g.u);
  const rects = L => { const out = []; buildings2d(g, L, t, P, (x0, y0, x1, y1) => out.push([x0, y0, x1 - x0, y1 - y0])); return out; };
  for (let L = 0; L < ROWS; L++) {
    const R = row(L), fl = L/3, mix = (c1, c2) => c1 + (c2 - c1)*R.haze;
    o.globalAlpha = a;
    // the walls in shadow, mixed toward the haze the further back they are
    o.fillStyle = hc(P.hue + mix(.68, .93), mix(45, 55), mix(3 + 3*fl, 50), 1);
    o.beginPath(); rects(L).forEach(r => o.rect(...r)); o.fill();
    buildings2d(g, L, t, P, () => {}, b => {
      const toward = (b.x0 + b.x1)/2 > g.asp*MX ? 0 : 1, fw = (b.x1 - b.x0)*.2;   // the side facing the light
      const sx0 = toward ? b.x1 - fw : b.x0;
      o.fillStyle = hc(P.hue + mix(.6, .93), mix(35, 55), mix(13 + 7*fl, 55), 1);
      o.fillRect(g.X(sx0), g.Y(b.cut), fw*g.u, g.Y(GROUND) - g.Y(b.cut));
      o.fillStyle = hc(P.hue + .6, 25, 60, .35*(1 - R.haze)); o.fillRect(g.X(toward ? b.x1 : b.x0) - (toward ? 1 : 0), g.Y(b.cut), 1, g.Y(GROUND) - g.Y(b.cut));
      // windows on the front, lit floor by floor from the street up as the build rises
      const style = b.r[6]; if (style < .15) return;
      const cols = 3 + Math.floor(style*4), fh = R.w*.2, rows = Math.floor((b.h - GROUND)/fh), fx0 = toward ? b.x0 : b.x0 + fw, fwid = (b.x1 - b.x0) - fw;
      const warm = style < .55, wa = (.3 + .4*fl)*(1 - R.haze*.8)*a;
      o.fillStyle = warm ? hc(P.hue + .1, 65, 62, wa) : hc(P.hue + .55, 45, 72, wa);
      for (let r = 1; r < rows - 1; r++) {
        const yf = 1 - (r + .5)/rows;
        if (hs(b.id*3.1 + Math.floor(r/2), L + 17)*.45 + yf*.55 > .2 + lvl*.9) continue;   // a dark floor
        for (let c = 0; c < cols; c++) {
          const seed = hs(b.id*91.7 + c*12.3, r*7.1 + L*50 + ((c + r) % 5 === 0 ? P.citySeed*13 : 0));
          if (seed < .5) continue;
          const wx = fx0 + fwid*(.04 + .9*(c + .18)/cols);
          o.fillRect(g.X(wx), g.Y(b.h - (r + .28)*fh), fwid*.9/cols*.6*g.u, fh*.48*g.u);
        }
      }
      const nh = b.r[7];                                  // neon, switching on as the build rises, flickering on stabs
      if (L >= 1 && nh > .45 && ((nh*37) % 1) < lvl*1.15 - .05 && !(P.cityB[0] > .4 && hs(b.id, Math.floor(t*18)) < .5)) {
        o.save(); o.strokeStyle = hc(P.hue + (nh > .72 ? P.pal[1] : P.pal[2]) + .15*b.r[1], 90, 62, a); o.lineWidth = Math.max(1.5, g.u*.005);
        o.shadowColor = o.strokeStyle; o.shadowBlur = g.u*.02*(1 + P.beat);
        const nx = fx0 + fwid*(nh > .72 ? .15 : .75), nw = .007 + .004*fl;
        o.strokeRect(g.X(nx - nw), g.Y(b.h - .05), nw*2*g.u, .1*g.u); o.restore();
      }
      if (b.ah) { o.fillStyle = `rgba(255,40,30,${Math.min(1, (.3 + P.beat*1.2)*a).toFixed(3)})`;   // the antenna's light, on the beat
        o.beginPath(); o.arc(g.X(b.left + R.w/2), g.Y(b.h + b.ah), Math.max(1.5, g.u*.004), 0, Math.PI*2); o.fill(); }
    });
    if (L < ROWS - 1) {                                   // the shadow of the row in front, cast away from the light
      o.save(); o.beginPath(); rects(L).forEach(r => o.rect(...r)); o.clip();
      o.fillStyle = `rgba(0,0,0,${(.55*a).toFixed(3)})`; o.beginPath();
      rects(L + 1).forEach(([x, y, w, h]) => { const away = x + w/2 > g.X(g.asp*MX) ? 1 : -1; o.rect(x + away*.03*g.u, y + .035*g.u, w, h); });
      o.fill(); o.restore();
    }
  }
  const fog = o.createLinearGradient(0, g.Y(GROUND + .1), 0, g.Y(GROUND));
  fog.addColorStop(0, hc(P.hue + .95, 60, 50, 0)); fog.addColorStop(1, hc(P.hue + .95, 60, 50, .2*a));
  o.globalAlpha = 1; o.fillStyle = fog; o.fillRect(0, g.Y(GROUND + .1), W, g.Y(GROUND) - g.Y(GROUND + .1));
}
function drawStreet(o, P, t){                          // the street: the skyline reflected in strips, and traffic
  const g = geo(o, P), {W, H} = g, gy = g.Y(GROUND), a = Math.min(1, P.w.city);
  o.globalAlpha = a;
  o.fillStyle = hc(P.hue + .66, 60, 3, 1); o.fillRect(0, gy, W, H - gy);
  const sky = rowsAbove(o.canvas, gy);
  for (let yo = 0; yo < H - gy; yo += 3) {
    const src = gy - yo*1.4 - 3; if (src < 0) break;
    o.globalAlpha = a*.38*(1 - Math.min(.7, yo/H*2.5));
    o.drawImage(sky, 0, src, W, 3, Math.sin(yo*.3)*2, gy + yo, W, 3);
  }
  o.globalAlpha = a; o.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {
    const y = g.Y(-.307 - k*.012), dir = k ? -1 : 1, off = -dir*t*(.9 + k*.4)/14;
    o.fillStyle = k ? 'rgba(255,40,25,.9)' : 'rgba(255,235,190,.9)';
    for (let i = Math.floor((-g.asp/2 + off)*14) - 1; i < (g.asp/2 + off)*14 + 1; i++) {
      if (((Math.sin(i*127.1 + k*31)*43758.5453) % 1 + 1) % 1 < .55) continue;
      const x = g.X((i + .5)/14 - off);
      o.fillRect(x - 2, y - 1, 4, 2);
      o.globalAlpha = a*.1; o.fillRect(x - 1, y, 2, g.u*.08); o.globalAlpha = a;   // its streak on the wet road
    }
  }
  o.globalCompositeOperation = 'source-over';
}
