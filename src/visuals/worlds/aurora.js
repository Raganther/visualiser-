// Aurora: curtains of light over a dark treeline under the stars, swelling with the melody.
import { hc } from '../../util.js';

export default {
  key: 'aurora', kind: 'world', label: 'Aurora',
  light: {hue: .33, sat: .7, x: 0, y: .9},              // the curtains' green, from above (for objects: scene/context.js)
  // airy, melodic, without much bass
  suits: (rf, T) => -rf.perc*.6 + rf.mid*.5 - rf.low*.3 - T*.4,
  glsl: {
    uniforms: '',
    functions: `
// aurora: curtains of light over a dark treeline, swelling with the melody
vec3 auroraSky(vec2 sp){
  float t=uTime;
  vec3 c=mix(hsv(uHue+0.62,0.7,0.12),hsv(uHue+0.7,0.6,0.02),clamp(sp.y+0.5,0.0,1.0));
  vec2 g=sp*60.0, cell=floor(g); float h=hash(cell);
  c+=vec3(0.8)*step(0.985,h)*smoothstep(0.35,0.0,length(fract(g)-0.5))*(0.55+0.45*sin(t*2.0+h*40.0));
  for(int i=0;i<3;i++){
    float fi=float(i), x=sp.x*(1.2+fi*0.3)+fi*1.7;
    float base=-0.08+fi*0.09+0.08*sin(x*1.3+t*0.15+fi)+0.04*sin(x*3.1-t*0.23)-uMid*uReact*0.05;
    float d=sp.y-base;
    float fold=0.5+0.5*sin(x*14.0+sin(x*3.0+t*0.4)*2.0+t*(0.6+fi*0.2));
    float rays=0.75+0.25*sin(x*60.0+sin(x*7.0+t*0.3)*3.0+fi*5.0);               // fine vertical rays in the curtain, near its foot
    float body=smoothstep(-0.015,0.02,d)*exp(-max(d,0.0)*(3.5+fi*1.5))*mix(1.0,rays,smoothstep(0.0,0.08,d)*smoothstep(0.35,0.1,d));
    vec3 col=mix(hsv(uHue+0.33,0.8,1.0),hsv(uHue+0.8,0.7,1.0),clamp(d*2.5,0.0,1.0));
    c+=col*body*(0.3+0.7*fold)*(0.45+0.5*uMid*uReact+0.2*uBeat)*(1.0-fi*0.25);
  }
  return c;
}
vec3 aurora(vec2 sp){
  float cx=fract(sp.x*38.0)-0.5, id=floor(sp.x*38.0);
  float top=-0.3+0.02*sin(sp.x*7.0)+0.012*sin(sp.x*23.0)+(0.03+0.05*hash(vec2(id,3.0)))*(1.0-abs(cx)*2.0);
  if(sp.y>=top) return auroraSky(sp);
  if(sp.y>-0.36) return hsv(uHue+0.62,0.5,0.03);                                 // the treeline
  float dy=-0.36-sp.y;                                                             // a still lake mirroring the sky, rippling faintly
  vec2 r=vec2(sp.x+sin(dy*70.0-uTime*1.5)*0.002,-0.24+dy*1.2);
  return auroraSky(r)*0.6*(1.0-clamp(dy*2.0,0.0,0.6))+hsv(uHue+0.62,0.5,0.02);
}`,
    fn: 'aurora',
  },
  // its front plane, for scenes that put things between its layers: the treeline
  front: {
    fn: 'auroraFront',
    glsl: `
float auroraFront(vec2 sp){
  float cx=fract(sp.x*38.0)-0.5, id=floor(sp.x*38.0);
  float top=-0.3+0.02*sin(sp.x*7.0)+0.012*sin(sp.x*23.0)+(0.03+0.05*hash(vec2(id,3.0)))*(1.0-abs(cx)*2.0);
  return sp.y<top ? 1.0 : 0.0;
}`,
    path2d(o){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
      o.moveTo(0, H);
      for (let j = 0; j <= 76; j++) { const xs = (j/76 - .5)*asp, id = Math.floor(xs*38);
        const top = -.3 + .02*Math.sin(xs*7) + .012*Math.sin(xs*23) + (j % 2 ? 0 : .03 + .05*((Math.sin(id*12.9898)*43758.5453) % 1 + 1) % 1);
        o.lineTo(X(xs), Y(top)); }
      o.lineTo(W, H); o.closePath();
    },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
    o.globalAlpha = Math.min(1, P.w.aurora);
    const sky = o.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, hc(P.hue + .7, 60, 2, 1)); sky.addColorStop(1, hc(P.hue + .62, 70, 10, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j <= 60; j++) {
        const xs = (j/60 - .5)*asp, x = xs*(1.2 + i*.3) + i*1.7;
        const base = -.08 + i*.09 + .08*Math.sin(x*1.3 + t*.15 + i) + .04*Math.sin(x*3.1 - t*.23) - P.mid*P.react*.05;
        const fold = .5 + .5*Math.sin(x*14 + Math.sin(x*3 + t*.4)*2 + t*(.6 + i*.2));
        const a = (.3 + .7*fold)*(.3 + .45*P.mid*P.react + .2*P.beat)*(1 - i*.25)*.5;
        const g = o.createLinearGradient(0, Y(base), 0, Y(base + .3));
        g.addColorStop(0, hc(P.hue + .33, 80, 55, a)); g.addColorStop(1, hc(P.hue + .8, 70, 50, 0));
        o.fillStyle = g; const x0 = Math.floor(X(xs)), x1 = Math.floor(X(xs + asp/60)); o.fillRect(x0, Y(base + .3), x1 - x0, .3*u);
      }
    }
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = hc(P.hue + .62, 50, 3, 1); o.beginPath(); o.moveTo(0, H);
    for (let j = 0; j <= 76; j++) { const xs = (j/76 - .5)*asp, id = Math.floor(xs*38);
      const top = -.3 + .02*Math.sin(xs*7) + .012*Math.sin(xs*23) + (j % 2 ? 0 : .03 + .05*((Math.sin(id*12.9898)*43758.5453) % 1 + 1) % 1);
      o.lineTo(X(xs), Y(top)); }
    o.lineTo(W, H); o.closePath(); o.fill();
    const ly = Y(-.36), sy = Y(-.24);                     // a still lake below the treeline, mirroring the sky
    for (let yo = 0; ly + yo < H; yo += 3) {
      if (sy - yo*1.2 - 3 < 0) break;
      o.globalAlpha = Math.min(1, P.w.aurora)*.6*(1 - Math.min(.6, yo/u*2));
      o.drawImage(o.canvas, 0, sy - yo*1.2 - 3, W, 3, Math.sin(yo*.4 + t*1.5)*1.5, ly + yo, W, 3);
    }
    o.globalAlpha = 1;
  },
};
