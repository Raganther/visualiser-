// The glowing forest: a night wood of dark trunks in rows, far to near, with bioluminescent plants and mushrooms on the
// ground pulsing on the beat, spores drifting up, and moss glowing up the trunks with the mids. Front plane: the near trunks.
import { hc } from '../../util.js';

const rnd = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
// the trunks in row k (0 far .. 2 near): where their edges fall across x, as [centre, half-width] per slot
const trunk = (x, k) => { const f = 3 + (2 - k)*3, s = Math.floor(x*f + k*7.3), c = (s + .5 + (rnd(s*3 + k) - .5)*.5)/f, w = (.006 + .012*rnd(s*5 + k*11))*(1 + k*1.3);
  return rnd(s*7 + k*13) < .75 ? [c, w] : [c, 0]; };
export default {
  key: 'forest', kind: 'world', label: 'Glowing forest',
  light: {hue: .45, sat: .6, x: 0, y: -.8},              // the plants' cyan-green light, from below
  horizonY: -.28,
  // calm to steady, melodic, a little noisy (texture): the wood's mood
  suits: (rf, T) => -rf.perc*.2 + rf.mid*.3 + (rf.noise || 0)*.2 - T*.2,
  glsl: {
    uniforms: '',
    functions: `
vec2 forestTrunk(float x,float k){ float f=3.0+(2.0-k)*3.0, s=floor(x*f+k*7.3), c=(s+0.5+(fract(sin((s*3.0+k)*91.7)*43758.5453)-0.5)*0.5)/f;
  float w=(0.006+0.012*fract(sin((s*5.0+k*11.0)*91.7)*43758.5453))*(1.0+k*1.3);
  return fract(sin((s*7.0+k*13.0)*91.7)*43758.5453)<0.75 ? vec2(c,w) : vec2(c,0.0); }
float forestHue(){ return 0.45+0.08*sin(uHue*6.2831853); }
vec3 forest(vec2 sp){
  float t=uTime, fh=forestHue();
  float mist=exp(-abs(sp.y+0.18)*4.5);
  vec3 c=hsv(fh+0.12,0.45,0.025+0.13*mist);                                                    // mist glowing between the trunks, low down
  float beam=smoothstep(0.55,1.0,sin((sp.x+sp.y*0.35)*8.0+1.3))*smoothstep(-0.3,0.5,sp.y);     // moonbeams slanting down through the canopy
  c+=hsv(fh+0.05,0.2,0.07)*beam*(0.75+0.25*sin(t*0.3));
  vec2 g=vec2(sp.x*50.0,sp.y*50.0-t*0.6), cell=floor(g); float h=hash(cell);                  // spores drifting up
  c+=hsv(fh,0.6,1.0)*step(0.985,h)*smoothstep(0.3,0.0,length(fract(g)-0.5))*(0.4+0.4*sin(t*2.0+h*40.0))*0.6;
  float ground=-0.28+0.015*sin(sp.x*5.0);
  // the trunks, near first: dark columns, the far ones fading into the mist, rimmed by the glow, moss up their feet with the mids
  for(int i=2;i>=0;i--){
    float k=float(i); vec2 tr=forestTrunk(sp.x,k); float d=abs(sp.x-tr.x), foot=ground-0.05*k;
    if(tr.y>0.0&&d<tr.y&&sp.y>foot){
      float side=(sp.x-tr.x)/tr.y, fog=(2.0-k)*0.5;
      vec3 bark=mix(hsv(fh+0.2,0.5,0.012),c,fog*0.6)*(1.0-0.35*abs(side));
      float rim=smoothstep(0.55,1.0,abs(side))*exp(-(sp.y-foot)*3.0)*(0.3+0.2*k);
      float moss=exp(-(sp.y-foot)*6.0)*(0.5+0.5*sin(sp.y*40.0+tr.x*30.0))*(0.3+0.7*uMid*uReact);
      return bark+hsv(fh,0.7,0.5)*rim*0.25+hsv(fh,0.8,1.0)*moss*0.3*(0.4+0.3*k)*smoothstep(1.0,0.0,abs(side));
    }
  }
  if(sp.y<ground){
    // the forest floor, lit by glowing plants and mushroom caps pulsing on the beat, and pools of light at the trunks' feet
    vec3 fl=hsv(fh+0.2,0.6,0.02)+hsv(fh+0.12,0.45,0.08)*exp(-(ground-sp.y)*12.0);
    vec2 q=vec2(sp.x*14.0,(ground-sp.y)*30.0); vec2 ce=floor(q); float hh=hash(ce);
    if(hh>0.8){ vec2 f=fract(q)-0.5; float cap=smoothstep(0.35,0.2,length(f*vec2(1.0,1.6)));
      fl+=hsv(fh+hh*0.3-0.1,0.7,1.0)*cap*(0.35+0.65*uBeat+0.2*sin(t*1.5+hh*20.0)); }
    vec2 tr=forestTrunk(sp.x,2.0);
    if(tr.y>0.0) fl+=hsv(fh,0.7,1.0)*exp(-abs(sp.x-tr.x)/(tr.y*2.5))*exp(-(ground-sp.y)*9.0)*(0.1+0.12*uBeat);
    return fl+hsv(fh,0.7,0.6)*exp(-(ground-sp.y)*25.0)*0.08;
  }
  return c;
}`,
    fn: 'forest',
  },
  front: {
    fn: 'forestFront',
    glsl: `
float forestFront(vec2 sp){ vec2 tr=forestTrunk(sp.x,2.0); return (tr.y>0.0&&abs(sp.x-tr.x)<tr.y)||sp.y<-0.28+0.015*sin(sp.x*5.0)-0.02 ? 1.0 : 0.0; }`,
    path2d(o){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
      for (let s = -20; s < 20; s++) { const x = (s + .5)/3; const [c, w] = trunk(x, 2); if (w > 0 && Math.abs(c) < asp/2 + .05) o.rect(X(c - w), 0, w*2*u, H); }
      o.rect(0, Y(-.3), W, H - Y(-.3));
    },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.forest);
    const fh = .45 + .08*Math.sin(P.hue*Math.PI*2) - P.hue;   // (the wood's own green: hc adds P.hue back)
    o.globalAlpha = a;
    const g = o.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hc(P.hue + fh + .2, 70, 1, 1)); g.addColorStop(.75, hc(P.hue + fh + .15, 60, 5, 1)); g.addColorStop(1, hc(P.hue + fh + .2, 60, 2, 1));
    o.fillStyle = g; o.fillRect(0, 0, W, H);
    const m = o.createLinearGradient(0, Y(.2), 0, Y(-.45));   // mist glowing between the trunks
    m.addColorStop(0, hc(P.hue + fh + .12, 45, 14, 0)); m.addColorStop(.6, hc(P.hue + fh + .12, 45, 14, .8)); m.addColorStop(1, hc(P.hue + fh + .12, 45, 14, 0));
    o.fillStyle = m; o.fillRect(0, Y(.2), W, Y(-.45) - Y(.2));
    o.globalCompositeOperation = 'lighter'; o.fillStyle = hc(P.hue + fh + .05, 20, 6, .6);   // moonbeams slanting down
    for (let b = -3; b <= 3; b++) { const x0 = b*.785 + .1; o.beginPath(); o.moveTo(X(x0 - .05), 0); o.lineTo(X(x0 + .05), 0); o.lineTo(X(x0 + .2), Y(-.3)); o.lineTo(X(x0 + .08), Y(-.3)); o.fill(); }
    o.globalCompositeOperation = 'source-over';
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) { const x = (rnd(i) - .5)*asp, y = ((rnd(i + 50) + t*.012) % 1)*.8 - .3;
      o.fillStyle = hc(P.hue + fh, 60, 60, .35*(.5 + .5*Math.sin(t*2 + i))); o.fillRect(X(x), Y(y), 1.5, 1.5); }
    o.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 3; k++) {   // far to near
      for (let s = -30; s < 30; s++) { const f = 3 + (2 - k)*3, x = (s + .5)/f; const [c, w] = trunk(x, k); if (w <= 0 || Math.abs(c) > asp/2 + .05) continue;
        o.fillStyle = hc(P.hue + fh + .2 - (2 - k)*.04, 50 - (2 - k)*5, 1.5 + (2 - k)*4, 1); o.fillRect(X(c - w), 0, w*2*u, Y(-.28 - .05*k));
        const mg = o.createLinearGradient(0, Y(-.28), 0, Y(-.1));
        mg.addColorStop(0, hc(P.hue + fh, 80, 50, (.1 + .15*P.mid*P.react)*(.4 + .3*k))); mg.addColorStop(1, hc(P.hue + fh, 80, 50, 0));
        o.fillStyle = mg; o.fillRect(X(c - w*.6), Y(-.1), w*1.2*u, Y(-.28) - Y(-.1)); }
    }
    o.fillStyle = hc(P.hue + fh + .2, 60, 2, 1); o.fillRect(0, Y(-.28), W, H - Y(-.28));   // the floor and its glowing caps
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) { const x = (rnd(i + 300) - .5)*asp, y = -.29 - rnd(i + 400)*.2, r = (.006 + .008*rnd(i + 500))*u;
      o.fillStyle = hc(P.hue + fh + rnd(i)*.3 - .1, 70, 55, .35 + .5*P.beat); o.beginPath(); o.ellipse(X(x), Y(y), r, r*.6, 0, 0, Math.PI*2); o.fill(); }
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
  },
};
