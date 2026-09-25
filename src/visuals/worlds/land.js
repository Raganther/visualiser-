// Landscape: a sunset over mountain ranges shaped by the song's loudness history, reflected in water.
import { HIST } from '../../state.js';
import { hc } from '../../util.js';

const st = {histT:0, landY:-.05};
export default {
  key: 'land', kind: 'world', label: 'Landscape',
  light: {hue: .04, sat: .8, x: 0, y: .2},               // the low sun, ahead (for objects: scene/context.js)
  horizonY: st.landY,                                  // the horizon layer's grid floor lines up with the water
  // calm, melodic, kickless parts
  suits: (rf, T) => -rf.perc*.9 + rf.mid*.4 - T*.3,
  step(dt, x){
    st.histT += dt;
    while (st.histT >= .12) {                          // record loudness for the mountains
      st.histT -= .12; HIST.copyWithin(0, 1);
      const J = x.J, lvl = (J.eM - J.lo)/Math.max(.06, J.hi - J.lo);
      HIST[255] = Math.round(Math.min(1, Math.max(0, lvl*.7 + x.sBass*.4))*255);
    }
  },
  params(P, x){ P.landY = st.landY; P.histFrac = st.histT/.12; P.sunX = Math.sin(x.t*.03)*.15; },
  glsl: {
    uniforms: 'uniform float uLandY,uHistFrac,uSunX;',
    functions: `
// loudness history: the right edge of the screen is now, further left is further back in the song
float histAt(float x,float span){
  float age=(ASP*0.5-x)/ASP*span;
  float idx=clamp(255.0-age/0.12+uHistFrac,0.0,255.0);
  return texture2D(uHist,vec2((idx+0.5)/256.0,0.5)).r;
}
vec3 sky(vec2 sp){ float t=clamp((sp.y-uLandY)/0.6,0.0,1.0); return mix(hsv(uHue+0.02,0.75,0.55),hsv(uHue+0.62,0.65,0.08),pow(t,0.7)); }
vec3 landAbove(vec2 sp){
  vec3 c=sky(sp);
  vec2 sc=vec2(uSunX,uLandY+0.16); float R=0.19+uBass*uReact*0.02;
  float d=length(sp-sc);
  c+=hsv(uHue+0.05,0.8,1.0)*0.35*smoothstep(R*2.2,R,d);
  if(d<R){
    float k=(sp.y-sc.y)/R;
    vec3 sun=mix(hsv(uHue-0.04,0.85,1.0),hsv(uHue+0.12,0.7,1.0),k*0.5+0.5);
    float cut=1.0;
    if(k<0.2){ float band=fract(-k*6.0+uTime*0.4); cut=step((0.2-k)*0.35*(0.6+uBass*uReact*0.8),band); }
    c=mix(c,sun,smoothstep(R,R-0.004,d)*cut);
  }
  for(int i=0;i<3;i++){                 // far, middle, near ranges
    float fi=float(i), span=30.0-fi*10.0;
    float h=0.03+histAt(sp.x,span)*(0.22-fi*0.05)+sin(sp.x*(9.0+fi*7.0)+fi*3.0)*0.012+sin(sp.x*(31.0+fi*11.0))*0.005;
    float top=uLandY+h;
    if(sp.y<top){
      float hm=uHue+0.55+fi*0.07+0.09*sin(sp.x*2.5+uTime*0.35+fi*1.7);
      float depth=clamp((top-sp.y)/max(h,0.02),0.0,1.0);
      vec3 m=hsv(hm,0.8-fi*0.08,0.5+0.17*fi)*(1.0-0.5*depth);
      c=mix(m,sky(sp),0.35-fi*0.15);
      c+=hsv(uHue+0.1+fi*0.05,0.6,1.0)*smoothstep(0.006,0.0,top-sp.y)*(0.4+uBeat*0.9)*(0.4+0.3*fi);
    }
  }
  return c;
}
vec3 landscape(vec2 sp){
  if(sp.y>=uLandY) return landAbove(sp);
  float dy=uLandY-sp.y;                  // water: a rippling reflection
  vec2 r=vec2(sp.x+sin(dy*90.0-uTime*3.0)*0.003*(1.0+uBeat*4.0)*(1.0+dy*6.0),uLandY+dy);
  vec3 c=landAbove(r)*0.55*(0.85+0.15*sin(dy*140.0-uTime*4.0));
  return c*mix(1.0,0.45,clamp(dy*2.0,0.0,1.0));
}`,
    fn: 'landscape',
  },
  // its front plane, for scenes that put things between its layers: the nearest ridge
  front: {
    fn: 'landFront',
    glsl: `
float landFront(vec2 sp){
  float h=0.03+histAt(sp.x,10.0)*0.12+sin(sp.x*23.0+6.0)*0.012+sin(sp.x*53.0)*0.005;
  return (sp.y>=uLandY && sp.y<uLandY+h) ? 1.0 : 0.0;
}`,
    path2d(o, P){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, i = 2, span = 30 - i*10;
      o.moveTo(0, Y(P.landY));
      for (let j = 0; j <= 120; j++) {
        const x = (j/120 - .5)*asp, age = (asp/2 - x)/asp*span, idx = Math.max(0, Math.min(255, 255 - age/.12 + P.histFrac));
        const h = .03 + HIST[Math.floor(idx)]/255*(.22 - i*.05) + Math.sin(x*(9 + i*7) + i*3)*.012 + Math.sin(x*(31 + i*11))*.005;
        o.lineTo(X(x), Y(P.landY + h));
      }
      o.lineTo(W, Y(P.landY)); o.closePath();
    },
  },
  uniforms(gl, u, P){ gl.uniform1f(u.uLandY, P.landY); gl.uniform1f(u.uHistFrac, P.histFrac); gl.uniform1f(u.uSunX, P.sunX); },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
  if (P.w.land > .01) {
    o.globalAlpha = Math.min(1, P.w.land);
    const hy = Y(P.landY);
    const sky = o.createLinearGradient(0, Y(P.landY + .6), 0, hy);
    sky.addColorStop(0, hc(P.hue + .62, 65, 5, 1)); sky.addColorStop(1, hc(P.hue + .02, 75, 32, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, hy);
    const sx = X(P.sunX), sy = Y(P.landY + .16), R = (.19 + P.bass*P.react*.02)*u;
    const glow = o.createRadialGradient(sx, sy, R, sx, sy, R*2.2);
    glow.addColorStop(0, hc(P.hue + .05, 80, 55, .35)); glow.addColorStop(1, hc(P.hue + .05, 80, 55, 0));
    o.fillStyle = glow; o.fillRect(sx - R*2.2, sy - R*2.2, R*4.4, R*4.4);
    const sun = o.createLinearGradient(0, sy - R, 0, sy + R);
    sun.addColorStop(0, hc(P.hue + .12, 90, 65, 1)); sun.addColorStop(1, hc(P.hue - .04, 95, 55, 1));
    o.fillStyle = sun; o.beginPath(); o.arc(sx, sy, R, 0, Math.PI*2); o.fill();
    o.fillStyle = sky;                                    // cut the stripes through the lower half
    for (let k = .2; k > -1; k -= .015) {
      const band = ((-k*6 + t*.4) % 1 + 1) % 1, w = (.2 - k)*.35*(.6 + P.bass*P.react*.8);
      if (band < w) o.fillRect(sx - R, sy - k*R, R*2, .016*R + 1);
    }
    for (let i = 0; i < 3; i++) {
      const span = 30 - i*10, top = [];
      for (let j = 0; j <= 120; j++) {
        const x = (j/120 - .5)*asp, age = (asp/2 - x)/asp*span;
        const idx = Math.max(0, Math.min(255, 255 - age/.12 + P.histFrac));
        const hv = HIST[Math.floor(idx)]/255;
        const h = .03 + hv*(.22 - i*.05) + Math.sin(x*(9 + i*7) + i*3)*.012 + Math.sin(x*(31 + i*11))*.005;
        top.push([X(x), Y(P.landY + h)]);
      }
      const g = o.createLinearGradient(0, 0, W, 0);
      for (let q = 0; q <= 4; q++) g.addColorStop(q/4, hc(P.hue + .55 + i*.07 + .09*Math.sin(q*1.6 + t*.35 + i*1.7), 70 - i*8, 24 + i*9, 1));
      o.fillStyle = g; o.beginPath(); o.moveTo(0, hy);
      top.forEach(([x, y]) => o.lineTo(x, y)); o.lineTo(W, hy); o.closePath(); o.fill();
      if (i < 2) { o.fillStyle = hc(P.hue + .62, 60, 30, .35 - i*.15); o.fill(); }   // haze on distant ranges
      o.beginPath(); top.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y));
      o.strokeStyle = hc(P.hue + .1 + i*.05, 70, 65, Math.min(1, (.4 + P.beat*.9)*(.4 + .3*i))); o.lineWidth = Math.max(1, u*.004); o.stroke();
    }
    for (let yo = 0; yo < H - hy; yo += 3) {           // water: the landscape reflected in strips that ripple
      const dy = yo/u, dx = Math.sin(dy*90 - t*3)*.003*(1 + P.beat*4)*(1 + dy*6)*u;
      const src = hy - yo - 3; if (src < 0) break;
      o.globalAlpha = Math.min(1, P.w.land)*.5*(1 - Math.min(1, dy*2)*.5);
      o.drawImage(o.canvas, 0, src, W, 3, dx, hy + yo, W, 3);
    }
  }
  },
};
