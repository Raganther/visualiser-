// City: a night skyline in four rows fading into the haze, far to near. Buildings have setbacks and antennas (whose lights
// blink on the beat); their windows are lit floor by floor in each building's own style, some changing on the downbeat;
// a few near ones carry neon signs in the palette's colours. Traffic streams along a wet street that mirrors it all.
import { dataArr } from '../../state.js';
import { hc } from '../../util.js';

const st = {seed:0};
const ROWS = 4, GROUND = -.3;
// a row's building layout, the same in both renderers: width, scroll speed, how tall, how hazy (far rows fade most)
const TALL = [1.35, 1.1, .95, .85], HAZE = [.8, .56, .3, .06];   // far rows are the tall towers downtown, faded into the haze
const row = L => ({w: .03 + L*.018, speed: .004 + L*.009, tall: TALL[L], haze: HAZE[L], off: L*3.7});
let rnd2d = null;                                      // simple mode's building randoms, per row
export default {
  key: 'city', kind: 'world', label: 'City',
  light: {hue: .12, sat: .6, x: .2, y: -.7},             // the windows' warm glow, from below (for objects: scene/context.js)
  horizonY: GROUND,                                    // the horizon layer's grid floor lines up with the street
  // steady kicks and bass at a middling intensity
  suits: (rf, T) => rf.perc*.6 + rf.low*.3 - Math.abs(T)*.5 + .05,
  onBeat(pos){ if (pos === 0) st.seed++; },             // some windows change on the downbeat
  params(P){ P.citySeed = st.seed % 64; },
  glsl: {
    uniforms: 'uniform float uCitySeed;',
    functions: `
// city: a building of row L at x: its top, and which building (id) and where across it (lx, 0..1), for width w
float cityRow(float x,float L,float w,out float id,out float lx){
  float xs=x+uTime*(0.004+L*0.009)+L*3.7;
  id=floor(xs/w); lx=fract(xs/w);
  float hb=hash(vec2(id,L+1.0));
  return -0.3+(0.05+0.2*hb*hb+0.04*hash(vec2(id,L+5.0)))*(L<0.5 ? 1.35 : L<1.5 ? 1.1 : L<2.5 ? 0.95 : 0.85)+specD(fract(id*0.137+L*0.31))*0.05*uReact*(0.3+L*0.25);
}
// its outline: the body with a gap each side, a narrower crown on some (a setback), an antenna on others
float cityShape(float lx,float y,float h,float id,float L,float w){
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
  vec3 c=mix(hsv(uHue+0.95,0.55,0.3),hsv(uHue+0.68,0.7,0.02),pow(t,0.45));   // the city's glow low down, night above
  // a few long clouds, lit from below by the city
  float cl=sin(sp.x*3.1+uTime*0.02+sin(sp.x*7.3)*0.4)*0.5+0.5, band=exp(-pow((sp.y-0.12-0.05*sin(sp.x*1.7))*9.0,2.0));
  c+=hsv(uHue+0.97,0.4,0.16)*band*smoothstep(0.35,0.9,cl)*(0.7+0.3*sin(sp.x*23.0));
  vec2 mp=vec2(-ASP*0.28,0.3); float md=length(sp-mp);
  float moon=smoothstep(0.047,0.044,md);
  float crater=0.12*smoothstep(0.012,0.0,length(sp-mp-vec2(0.012,0.01)))+0.08*smoothstep(0.009,0.0,length(sp-mp-vec2(-0.015,-0.012)));
  c=mix(c,hsv(uHue+0.1,0.12,0.95)*(1.0-crater),moon);
  c+=hsv(uHue+0.1,0.25,1.0)*(0.1*exp(-md*9.0)+0.04*exp(-md*3.0));             // its halo in the haze
  return c;
}
vec3 cityAbove(vec2 sp){
  vec3 c=citySky(sp), haze=hsv(uHue+0.94,0.5,0.3);
  for(int i=0;i<4;i++){
    float L=float(i), w=0.03+L*0.018, id, lx;
    float h=cityRow(sp.x,L,w,id,lx);
    if(cityShape(lx,sp.y,h,id,L,w)<0.5) continue;
    float fl=L/3.0, style=hash(vec2(id,L+3.0));
    vec3 b=hsv(uHue+0.66,0.4,0.035+0.045*fl);                                      // the wall
    b+=hsv(uHue+0.95,0.5,1.0)*0.05*smoothstep(0.15,0.0,sp.y-(h-0.06))*(1.0-fl*0.6); // the top catches the sky's glow
    // windows: a grid per building (offices wider), lit floor by floor, a share changing on the downbeat
    float cols=3.0+floor(style*4.0);
    vec2 wg=vec2(lx*cols,(h-sp.y)/(w*0.2)), wc=floor(wg), wf=fract(wg);
    float win=step(0.18,wf.x)*step(wf.x,style>0.7 ? 0.95 : 0.78)*step(0.28,wf.y)*step(wf.y,0.76)*step(1.0,wc.y)
      *step(0.12,lx)*step(lx,0.88);
    float floorOn=step(0.45,hash(vec2(id*3.1+floor(wc.y/2.0),L+17.0)));
    float cell=hash(vec2(id*7.0+wc.x,wc.y+L*50.0)), swap=step(0.82,hash(vec2(id+wc.x*3.0,wc.y)));
    float lit=floorOn*mix(step(0.5,cell),step(0.5,hash(vec2(id*7.0+wc.x,wc.y+uCitySeed*13.0+L))),swap);
    lit*=step(0.18,style);                                                          // a few buildings stay dark
    vec3 wcol=style<0.55 ? hsv(uHue+0.1+0.04*cell,0.55,1.0) : hsv(uHue+0.55,0.35,1.0);
    b+=wcol*win*lit*(0.22+0.38*fl);
    // neon: a sign down the side of some near buildings, in the palette's colour, lit harder on the beat
    if(i>=2 && hash(vec2(id,L+19.0))>0.72){
      vec2 q=vec2((lx-0.2)*w,sp.y-(h-0.1));
      vec2 d=abs(q)-vec2(0.008,0.055); float sd=length(max(d,0.0))+min(max(d.x,d.y),0.0);
      b+=hsv(uHue+uPal.y+0.2*hash(vec2(id,L+23.0)),0.85,1.0)*(smoothstep(0.0035,0.0,abs(sd))*(1.3+uBeat*1.0)+exp(-max(sd,0.0)*45.0)*0.4);
    }
    // an antenna's light, blinking on the beat
    float ah=hash(vec2(id,L+11.0))>0.8 ? 0.02+0.05*fract(hash(vec2(id,L+11.0))*13.0) : -1.0;
    if(ah>0.0) b+=vec3(1.0,0.15,0.1)*smoothstep(0.004,0.0,length(vec2((lx-0.5)*w,sp.y-h-ah)))*(0.3+uBeat*1.2);
    c=mix(b,haze,L<0.5 ? 0.8 : L<1.5 ? 0.56 : L<2.5 ? 0.3 : 0.06);                 // far rows fade into the haze (row() in JS)
  }
  c+=hsv(uHue+0.95,0.6,1.0)*exp(-(sp.y+0.3)*16.0)*0.14;                            // fog glowing over the street
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
  return cityAbove(r)*0.3*(1.0-clamp(dy*2.5,0.0,0.7))+hsv(uHue+0.95,0.7,1.0)*exp(-dy*10.0)*0.1+cityTraffic(sp);
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
  for(int i=2;i<4;i++){ float L=float(i), w=0.03+L*0.018, id, lx, h=cityRow(sp.x,L,w,id,lx); f=max(f,cityShape(lx,sp.y,h,id,L,w)); }
  return f;
}`,
    path2d(o, P, t){ const g = geo(o, P); for (const L of [2, 3]) buildings2d(g, L, t, P, (x0, y0, x1, y1) => o.rect(x0, y0, x1 - x0, y1 - y0)); },
  },
  uniforms(gl, u, P){ gl.uniform1f(u.uCitySeed, P.citySeed); },
  init2d(){ rnd2d = Array.from({length: ROWS}, () => Array.from({length: 80}, () => Array.from({length: 8}, Math.random))); },
  draw2d(o, P, t){ drawCity(o, P, t); drawStreet(o, P, t); },
};
const geo = (o, P) => { const W = o.canvas.width, H = o.canvas.height; return {W, H, u: H, X: x => W/2 + x*H, Y: y => H/2 - y*H, asp: W/H}; };
// every building of row L on screen, as rectangles (body, crown, antenna) through box(x0, y0, x1, y1); each(b) for extras
function buildings2d(g, L, t, P, box, each){
  const R = row(L), shift = t*R.speed + R.off, first = Math.floor((-g.asp/2 + shift)/R.w);
  for (let id = first; id*R.w - shift < g.asp/2; id++) {
    const r = rnd2d[L][((id % 80) + 80) % 80], sv = dataArr[256 + Math.floor((((id*.137 + L*.31) % 1) + 1) % 1*255)]/255;
    const h = GROUND + (.05 + .2*r[0]*r[0] + .04*r[1])*R.tall + sv*.05*P.react*(.3 + L*.25);
    const e = .05 + .07*r[2], left = id*R.w - shift, x0 = left + R.w*e, x1 = left + R.w*(1 - e), cut = h - (h - GROUND)*.2;
    const inset = r[3] > .5 ? (.14 + .18*r[4])*R.w : 0;
    box(g.X(x0), g.Y(cut), g.X(x1), g.Y(GROUND));                    // the body
    box(g.X(x0 + inset), g.Y(h), g.X(x1 - inset), g.Y(cut) + 1);      // the crown (narrower on a setback)
    const ah = r[3] > .8 ? .02 + .05*r[5] : 0;
    if (ah) box(g.X(left + R.w/2) - 1, g.Y(h + ah), g.X(left + R.w/2) + 1, g.Y(h));   // an antenna
    if (each) each({id, r, h, x0, x1, ah, left});
  }
}
function drawCity(o, P, t){
  const g = geo(o, P), {W, H} = g, a = Math.min(1, P.w.city);
  o.globalAlpha = a;
  const sky = o.createLinearGradient(0, 0, 0, g.Y(GROUND));
  sky.addColorStop(0, hc(P.hue + .68, 70, 2, 1)); sky.addColorStop(.6, hc(P.hue + .8, 55, 8, 1)); sky.addColorStop(1, hc(P.hue + .95, 55, 24, 1));
  o.fillStyle = sky; o.fillRect(0, 0, W, H);
  const mx = g.X(-g.asp*.28), my = g.Y(.3), halo = o.createRadialGradient(mx, my, 0, mx, my, .25*g.u);
  halo.addColorStop(0, hc(P.hue + .1, 30, 70, .25)); halo.addColorStop(1, hc(P.hue + .1, 30, 70, 0));
  o.fillStyle = halo; o.fillRect(mx - .25*g.u, my - .25*g.u, .5*g.u, .5*g.u);
  o.fillStyle = hc(P.hue + .1, 15, 90, 1); o.beginPath(); o.arc(mx, my, .046*g.u, 0, Math.PI*2); o.fill();
  for (let L = 0; L < ROWS; L++) {
    const R = row(L), fl = L/3;
    o.globalAlpha = a;
    // the walls, mixed toward the haze the further back they are
    o.fillStyle = hc(P.hue + .66 + (.94 - .66)*R.haze, 40 + 10*R.haze, 4 + 4*fl + 22*R.haze, 1);
    o.beginPath(); buildings2d(g, L, t, P, (x0, y0, x1, y1) => o.rect(x0, y0, x1 - x0, y1 - y0)); o.fill();
    // windows, lit floor by floor
    buildings2d(g, L, t, P, () => {}, b => {
      const style = b.r[6]; if (style < .18) return;
      const cols = 3 + Math.floor(style*4), fh = R.w*.2, rows = Math.floor((b.h - GROUND)/fh);
      const warm = style < .55, wa = (.22 + .38*fl)*(1 - R.haze*.8)*a;
      o.fillStyle = warm ? hc(P.hue + .1, 60, 60, wa) : hc(P.hue + .55, 40, 70, wa);
      for (let r = 1; r < rows - 1; r++) {
        if (((Math.sin(b.id*3.1 + Math.floor(r/2)*12.9 + L*17)*43758.5) % 1 + 1) % 1 < .45) continue;   // a dark floor
        for (let c = 0; c < cols; c++) {
          const seed = ((Math.sin(b.id*91.7 + c*12.3 + r*7.1 + L*50 + ((c + r) % 5 === 0 ? P.citySeed*13 : 0))*43758.5453) % 1 + 1) % 1;
          if (seed < .5) continue;
          const wx = b.x0 + (b.x1 - b.x0)*(.12 + .76*(c + .18)/cols);
          o.fillRect(g.X(wx), g.Y(b.h - (r + .28)*fh), (b.x1 - b.x0)*.76/cols*.6*g.u, fh*.48*g.u);
        }
      }
      if (L >= 2 && b.r[7] > .72) {                        // neon down the side, in the palette's colour
        o.save(); o.strokeStyle = hc(P.hue + P.pal[1] + .2*b.r[1], 90, 60, a); o.lineWidth = Math.max(1.5, g.u*.005);
        o.shadowColor = o.strokeStyle; o.shadowBlur = g.u*.02*(1 + P.beat);
        const nx = b.x0 + (b.x1 - b.x0)*.2;
        o.strokeRect(g.X(nx - .008), g.Y(b.h - .045), .016*g.u, .11*g.u); o.restore();
      }
      if (b.ah) { o.fillStyle = `rgba(255,40,30,${Math.min(1, (.3 + P.beat*1.2)*a).toFixed(3)})`;   // the antenna's light, on the beat
        o.beginPath(); o.arc(g.X(b.left + R.w/2), g.Y(b.h + b.ah), Math.max(1.5, g.u*.004), 0, Math.PI*2); o.fill(); }
    });
  }
  const fog = o.createLinearGradient(0, g.Y(GROUND + .1), 0, g.Y(GROUND));
  fog.addColorStop(0, hc(P.hue + .95, 60, 50, 0)); fog.addColorStop(1, hc(P.hue + .95, 60, 50, .18*a));
  o.globalAlpha = 1; o.fillStyle = fog; o.fillRect(0, g.Y(GROUND + .1), W, g.Y(GROUND) - g.Y(GROUND + .1));
}
function drawStreet(o, P, t){                          // the street: the skyline reflected in strips, and traffic
  const g = geo(o, P), {W, H} = g, gy = g.Y(GROUND), a = Math.min(1, P.w.city);
  o.globalAlpha = a;
  o.fillStyle = hc(P.hue + .66, 60, 3, 1); o.fillRect(0, gy, W, H - gy);
  for (let yo = 0; yo < H - gy; yo += 3) {
    const src = gy - yo*1.4 - 3; if (src < 0) break;
    o.globalAlpha = a*.3*(1 - Math.min(.7, yo/H*2.5));
    o.drawImage(o.canvas, 0, src, W, 3, Math.sin(yo*.3)*2, gy + yo, W, 3);
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
