// The night sea: a dark ocean under the moon, the moon wearing a ring of light (a halo, as on a frosty night), a path of
// moonlight glittering on the swell, the swell rising with the bass, and a lighthouse on a far headland sweeping its beam.
import { hc } from '../../util.js';

const HOR = -.04;   // the horizon's height
const star = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
export default {
  key: 'sea', kind: 'world', label: 'Night sea',
  light: {hue: .6, sat: .25, x: .35, y: .8},             // pale moonlight, from above and to the right
  horizonY: HOR,
  // calm, spacious, melodic music; a warm low end suits the swell
  suits: (rf, T) => -rf.perc*.4 + rf.low*.3 + rf.mid*.2 - T*.3 - (rf.hat || 0)*.3,
  params(P, x){
    if (!(P.w.sea > .003)) return;
    this.sw = (this.sw || 0) + (x.sBass*x.react - (this.sw || 0))*Math.min(1, x.dt*1.5);   // the swell, eased
    P.seaSwell = this.sw; P.seaBeam = x.t*.55;                  // the lighthouse turns at motion time
    P.seaMoon = [.34*x.asp*.5 + .1, .27];
  },
  glsl: {
    uniforms: 'uniform vec3 uSea;   // the swell, the lighthouse beam\'s turn, the moon\'s x',
    functions: `
// the night sea: sky, moon and its ring, stars, the lighthouse, and the ocean with the moon's path on it
float seaHue(){ return 0.6+0.06*sin(uHue*6.2831853); }   // night blue, only tinted by the palette
vec3 seaSky(vec2 sp){
  vec2 mp=vec2(uSea.z,0.27); float dm=length(sp-mp), sh=seaHue();
  vec3 c=mix(hsv(sh,0.5,0.2),hsv(sh+0.04,0.75,0.035),clamp((sp.y-(${HOR.toFixed(3)}))*1.8,0.0,1.0));
  c+=hsv(sh-0.02,0.3,0.3)*exp(-dm*6.0)*0.6;                                  // the moon's glow in the haze
  vec2 g=sp*70.0, cell=floor(g); float h=hash(cell);
  c+=vec3(0.75)*step(0.988,h)*smoothstep(0.35,0.0,length(fract(g)-0.5))*(0.6+0.4*sin(uTime*1.7+h*50.0))*smoothstep(0.1,0.25,dm);
  // the ring: a thin halo well out from the moon, faintly coloured, brightening on the downbeat
  float ring=exp(-pow((dm-0.16)/0.012,2.0));
  c+=mix(hsv(uHue+0.02,0.35,1.0),hsv(uHue+0.55,0.35,1.0),smoothstep(0.15,0.17,dm))*ring*(0.16+0.12*uBeat);
  c+=vec3(0.95,0.95,0.88)*smoothstep(0.034,0.028,dm);                          // the moon
  c-=vec3(0.12)*smoothstep(0.034,0.02,length(sp-mp-vec2(0.008,0.006)))*step(dm,0.034)*0.6;   // a darker sea on it
  // the lighthouse's beam, from the headland on the left, sweeping round
  vec2 lh=vec2(-0.55*ASP,(${HOR.toFixed(3)})+0.035), d=sp-lh; float r=length(d);
  float ang=atan(d.y,d.x), bs=cos(uSea.y)*0.9;                                  // the beam's direction, seen from the side
  float beam=exp(-pow(ang-(0.12+0.5*(0.5+0.5*sin(uSea.y))),2.0)*260.0)*exp(-r*1.3)*step(0.0,d.y+0.01);
  c+=hsv(uHue+0.12,0.25,1.0)*beam*(0.35+0.4*max(bs,0.0))*step(0.01,r);
  c+=hsv(uHue+0.12,0.2,1.0)*exp(-r*r*6000.0)*(0.6+0.8*pow(max(bs,0.0),8.0));   // its lamp, flashing as it faces us
  return c;
}
vec3 sea(vec2 sp){
  if(sp.y>(${HOR.toFixed(3)})){
    // the headland under the lighthouse, black against the sky
    float hx=sp.x+0.55*ASP, head=(${HOR.toFixed(3)})+0.03*exp(-hx*hx*30.0)+0.012*exp(-hx*hx*4.0);
    if(sp.y<head) return hsv(seaHue(),0.5,0.02);
    return seaSky(sp);
  }
  float dy=(${HOR.toFixed(3)})-sp.y, z=0.06/max(dy,0.001);                                   // how far away this bit of sea is
  vec2 w=vec2(sp.x*z, z);
  float sw=0.6+uSea.x*1.6, t=uTime;
  // the swell's slope: a few long waves and ripples, stronger with the bass
  float s=sin(w.x*1.3+w.y*2.1-t*0.9)*0.5+sin(w.x*3.1-w.y*1.7+t*1.3)*0.3+sin(w.x*7.0+w.y*6.0-t*2.1)*0.15;
  s*=sw;
  float sh=seaHue();
  vec3 c=mix(hsv(sh+0.02,0.6,0.1),hsv(sh+0.03,0.7,0.02),clamp(dy*2.5,0.0,1.0))*(0.8+0.25*s);
  // the sky mirrored in it, stronger towards the horizon (grazing), broken up by the swell
  c+=seaSky(vec2(sp.x+s*0.012,(${HOR.toFixed(3)})+dy*0.7+s*0.01))*(0.15+0.45*exp(-dy*14.0));
  // the moon's path: a column under the moon that widens nearer, glittering where the waves face it
  float px=abs(sp.x-uSea.z)/(0.03+dy*0.9);
  float path=exp(-px*px*2.2)*smoothstep(0.0,0.02,dy);
  vec2 gc=floor(vec2(w.x*18.0,w.y*9.0)+vec2(0.0,t*0.6)); float gl=hash(gc+floor(t*6.0));
  c+=vec3(0.85,0.88,0.95)*path*(0.18+smoothstep(0.8,1.0,gl)*(1.4+uBeat)*(0.4+0.6*smoothstep(0.0,0.6,s+0.4)));
  c+=hsv(uHue+0.12,0.3,1.0)*exp(-pow((sp.x+0.55*ASP)/(0.01+dy*0.3),2.0))*exp(-dy*9.0)*0.2;   // the lamp's light on the water
  // the nearest swell, a dark crest rolling across the bottom
  float crest=-0.4+0.035*sin(sp.x*2.7+t*0.7)+0.02*sin(sp.x*6.3-t*1.1)+uSea.x*0.04;
  if(sp.y<crest) c=hsv(sh+0.03,0.6,0.025)+vec3(0.5,0.55,0.6)*exp(-(crest-sp.y)*160.0)*0.07;   // a faint rim of moonlight on its crest
  return c;
}`,
    fn: 'sea',
  },
  uniforms(gl, u, P){ if (u.uSea) gl.uniform3f(u.uSea, P.seaSwell || 0, P.seaBeam || 0, P.seaMoon ? P.seaMoon[0] : .3); },
  // its front plane: the nearest swell
  front: {
    fn: 'seaFront',
    glsl: `
float seaFront(vec2 sp){ return sp.y<-0.4+0.035*sin(sp.x*2.7+uTime*0.7)+0.02*sin(sp.x*6.3-uTime*1.1)+uSea.x*0.04 ? 1.0 : 0.0; }`,
    path2d(o, P, t){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, sw = P.seaSwell || 0;
      o.moveTo(0, H); for (let j = 0; j <= 40; j++) { const xs = (j/40 - .5)*asp; o.lineTo(X(xs), Y(-.4 + .035*Math.sin(xs*2.7 + t*.7) + .02*Math.sin(xs*6.3 - t*1.1) + sw*.04)); }
      o.lineTo(W, H); o.closePath();
    },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.sea);
    const mx = P.seaMoon ? P.seaMoon[0] : .3, my = .27, sw = P.seaSwell || 0, bh = .6 + .06*Math.sin(P.hue*Math.PI*2) - P.hue;   // (night blue: hc adds P.hue back)
    o.globalAlpha = a;
    const sky = o.createLinearGradient(0, 0, 0, Y(HOR));
    sky.addColorStop(0, hc(P.hue + bh + .04, 75, 3, 1)); sky.addColorStop(1, hc(P.hue + bh, 50, 18, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, Y(HOR) + 1);
    for (let i = 0; i < 160; i++) { const sx = star(i)*W, sy = star(i + 500)*Y(HOR); if (Math.hypot(sx - X(mx), sy - Y(my)) < .1*u) continue;
      o.fillStyle = `rgba(220,225,240,${(.3 + .5*star(i + 900))*(.6 + .4*Math.sin(t*1.7 + i))})`; o.fillRect(sx, sy, 1.5, 1.5); }
    const glow = o.createRadialGradient(X(mx), Y(my), 0, X(mx), Y(my), .35*u);
    glow.addColorStop(0, hc(P.hue + bh - .02, 30, 30, .45)); glow.addColorStop(1, hc(P.hue + bh - .02, 30, 30, 0));
    o.fillStyle = glow; o.fillRect(0, 0, W, Y(HOR));
    o.strokeStyle = `rgba(230,225,215,${(.16 + .12*P.beat)*a})`; o.lineWidth = Math.max(1, .006*u);   // the ring
    o.beginPath(); o.arc(X(mx), Y(my), .16*u, 0, Math.PI*2); o.stroke();
    o.fillStyle = '#f2f2e0'; o.beginPath(); o.arc(X(mx), Y(my), .031*u, 0, Math.PI*2); o.fill();
    // the lighthouse's beam
    const lx = X(-.55*asp), ly = Y(HOR + .035), ang = .12 + .5*(.5 + .5*Math.sin(P.seaBeam || 0)), bs = Math.max(0, Math.cos(P.seaBeam || 0));
    const bg = o.createLinearGradient(lx, ly, lx + Math.cos(ang)*u, ly - Math.sin(ang)*u);
    bg.addColorStop(0, hc(P.hue + .12, 25, 85, .35 + .3*bs)); bg.addColorStop(1, hc(P.hue + .12, 25, 85, 0));
    o.fillStyle = bg; o.beginPath(); o.moveTo(lx, ly); o.lineTo(lx + Math.cos(ang - .05)*u, ly - Math.sin(ang - .05)*u); o.lineTo(lx + Math.cos(ang + .05)*u, ly - Math.sin(ang + .05)*u); o.closePath(); o.fill();
    o.fillStyle = hc(P.hue + bh, 50, 2, 1); o.beginPath(); o.moveTo(X(-.55*asp - .3), Y(HOR)); o.quadraticCurveTo(lx, Y(HOR + .06), X(-.55*asp + .3), Y(HOR)); o.fill();
    o.fillStyle = `rgba(255,245,215,${.6 + .4*Math.pow(bs, 8)})`; o.fillRect(lx - 2, ly - 2, 4, 4);
    // the sea, and the moon's path glittering on it
    const sea = o.createLinearGradient(0, Y(HOR), 0, H);
    sea.addColorStop(0, hc(P.hue + bh + .02, 55, 12, 1)); sea.addColorStop(1, hc(P.hue + bh + .03, 70, 3, 1));
    o.fillStyle = sea; o.fillRect(0, Y(HOR), W, H - Y(HOR));
    for (let k = 0; k < 220; k++) { const dy = Math.pow(star(k + 1300), 1.6)*.45, wd = (.03 + dy*.9)*u*.8, fl = star(k*7 + Math.floor(t*6));
      if (fl < .55) continue;
      o.fillStyle = `rgba(215,225,240,${(fl - .55)*(1.4 + P.beat)*.7})`; o.fillRect(X(mx) + (star(k + 1700) - .5)*2*wd, Y(HOR - dy), 1 + dy*6, 1); }
    o.strokeStyle = hc(P.hue + bh, 40, 22, .5); o.lineWidth = 1;   // a few long swells, closer together far off
    for (let r = 1; r < 9; r++) { const yy = HOR - .45*Math.pow(r/9, 1.8); o.beginPath();
      for (let j = 0; j <= 30; j++) { const xs = (j/30 - .5)*asp; o.lineTo(X(xs), Y(yy + .006*(1 + sw*2)*Math.sin(xs*6/(r*.4 + .3) + t*.9 + r))); } o.stroke(); }
    o.fillStyle = hc(P.hue + bh + .03, 60, 2, 1); o.beginPath(); o.moveTo(0, H);   // the nearest swell
    for (let j = 0; j <= 40; j++) { const xs = (j/40 - .5)*asp; o.lineTo(X(xs), Y(-.4 + .035*Math.sin(xs*2.7 + t*.7) + .02*Math.sin(xs*6.3 - t*1.1) + sw*.04)); }
    o.lineTo(W, H); o.closePath(); o.fill();
    o.globalAlpha = 1;
  },
};
