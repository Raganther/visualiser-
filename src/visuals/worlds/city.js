// City: a night skyline whose rooftops follow the spectrum and whose windows change on the downbeat, above a wet street.
import { dataArr } from '../../state.js';
import { hc } from '../../util.js';

const st = {seed:0};
let cityB = null;                                      // simple mode's building heights
export default {
  key: 'city', kind: 'world', label: 'City',
  horizonY: -.3,                                       // the horizon layer's grid floor lines up with the street
  // steady kicks and bass at a middling intensity
  suits: (rf, T) => rf.perc*.6 + rf.low*.3 - Math.abs(T)*.5 + .05,
  onBeat(pos){ if (pos === 0) st.seed++; },             // the windows change on the downbeat
  params(P){ P.citySeed = st.seed % 64; },
  glsl: {
    uniforms: 'uniform float uCitySeed;',
    functions: `
// city: a night skyline whose rooftops follow the spectrum and whose windows change on the downbeat
vec3 cityAbove(vec2 sp){
  float t=uTime;
  vec3 c=mix(hsv(uHue+0.9,0.6,0.32),hsv(uHue+0.65,0.7,0.035),pow(clamp(sp.y+0.5,0.0,1.0),0.6));
  vec2 mp=vec2(-ASP*0.28,0.28); float md=length(sp-mp);
  c+=hsv(uHue+0.1,0.2,1.0)*smoothstep(0.052,0.048,md)*0.8+hsv(uHue+0.1,0.3,1.0)*0.12*exp(-md*8.0);
  for(int L=0;L<2;L++){
    float fl=float(L), w=0.035+fl*0.035;
    float x=sp.x+t*(0.008+fl*0.02)+fl*3.7;
    float id=floor(x/w), lx=fract(x/w), hb=hash(vec2(id,fl+1.0));
    float h=-0.3+(0.06+0.2*hb)*(0.8+fl*0.35)+specD(fract(id*0.137))*0.1*uReact*(0.5+fl*0.5);
    if(sp.y<h && lx>0.06 && lx<0.94){
      vec3 b=hsv(uHue+0.65,0.5,0.05+fl*0.04);
      vec2 wg=vec2(lx*5.0,(h-sp.y)/(w*0.3)), wc=floor(wg), wf=fract(wg);
      float win=step(0.25,wf.x)*step(wf.x,0.75)*step(0.3,wf.y)*step(wf.y,0.8)*step(1.0,wc.y);
      float lit=step(0.74,hash(vec2(id*7.0+wc.x,wc.y+uCitySeed*13.0+fl*50.0)));
      b+=hsv(uHue+0.12+0.06*hash(vec2(id,wc.y)),0.6,1.0)*win*lit*(0.45+0.3*fl+0.35*uBeat);
      b+=hsv(uHue+0.55,0.6,1.0)*smoothstep(0.004,0.0,h-sp.y)*(0.25+uBeat*0.6)*fl;
      c=mix(b,c,0.3*(1.0-fl));
    }
  }
  return c;
}
vec3 city(vec2 sp){
  if(sp.y>=-0.3) return cityAbove(sp)+hsv(uHue+0.95,0.7,1.0)*exp(-(sp.y+0.3)*14.0)*0.18;
  float dy=-0.3-sp.y;                    // a wet street: the skyline reflected, rippling
  vec2 r=vec2(sp.x+sin(dy*80.0-uTime*2.5)*0.004*(1.0+uBeat*3.0),-0.3+dy*1.4);
  return cityAbove(r)*0.35*(1.0-clamp(dy*2.5,0.0,0.7))+hsv(uHue+0.95,0.7,1.0)*exp(-dy*10.0)*0.12;
}`,
    fn: 'city',
  },
  uniforms(gl, u, P){ gl.uniform1f(u.uCitySeed, P.citySeed); },
  init2d(){ cityB = [0, 1].map(L => Array.from({length:80}, () => Math.random())); },
  draw2d(o, P, t){ drawCity(o, P, t); drawStreet(o, P); },
};
function drawCity(o, P, t){
  const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
  o.globalAlpha = Math.min(1, P.w.city);
  const sky = o.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, hc(P.hue + .65, 70, 3, 1)); sky.addColorStop(1, hc(P.hue + .9, 60, 25, 1));
  o.fillStyle = sky; o.fillRect(0, 0, W, H);
  o.fillStyle = hc(P.hue + .1, 20, 85, .8); o.beginPath(); o.arc(X(-asp*.28), Y(.28), .05*u, 0, Math.PI*2); o.fill();
  for (let L = 0; L < 2; L++) {
    const w = .035 + L*.035, shift = t*(.008 + L*.02) + L*3.7, first = Math.floor((-asp/2 + shift)/w);
    for (let id = first; id*w - shift < asp/2; id++) {
      const hb = cityB[L][((id % 80) + 80) % 80], sv = dataArr[256 + Math.floor((((id*.137) % 1) + 1) % 1*255)]/255;
      const h = -.3 + (.06 + .2*hb)*(.8 + L*.35) + sv*.1*P.react*(.5 + L*.5);
      const x0 = X(id*w - shift + w*.06), x1 = X(id*w - shift + w*.94);
      o.fillStyle = hc(P.hue + .65, 50, 5 + L*4, 1); o.fillRect(x0, Y(h), x1 - x0, Y(-.3) - Y(h));
      const rows = Math.floor((h + .3)/(w*.3));
      for (let r = 1; r < rows; r++) for (let c = 0; c < 5; c++) {
        const lit = ((Math.sin(id*91.7 + c*12.3 + r*7.1 + P.citySeed*13 + L*50)*43758.5453) % 1 + 1) % 1 > .74;
        if (!lit) continue;
        o.fillStyle = hc(P.hue + .12, 60, 60, Math.min(1, .45 + .3*L + .35*P.beat));
        o.fillRect(x0 + (x1 - x0)*(c + .25)/5, Y(h - (r + .3)*w*.3), (x1 - x0)*.1, w*.3*.5*u);
      }
    }
  }
}
function drawStreet(o, P){                             // the street: the skyline reflected in strips
  const W = o.canvas.width, H = o.canvas.height, gy = H/2 + .3*H;
  o.globalAlpha = Math.min(1, P.w.city);
  o.fillStyle = hc(P.hue + .65, 60, 3, 1); o.fillRect(0, gy, W, H - gy);
  for (let yo = 0; yo < H - gy; yo += 3) {
    const src = gy - yo*1.4 - 3; if (src < 0) break;
    o.globalAlpha = Math.min(1, P.w.city)*.35*(1 - Math.min(.7, yo/H*2.5));
    o.drawImage(o.canvas, 0, src, W, 3, Math.sin(yo*.3)*2, gy + yo, W, 3);
  }
}
