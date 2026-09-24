// Outline: a polygon that snaps in on the downbeat and zooms out, trailing two echoes.
import { hc } from '../../util.js';

const OUTL = {age:9, n:4, rot:0};
export default {
  key: 'outline', kind: 'hit', label: 'Outline zoom', trigger: 'downbeat', level: .8,
  words: 'An outline zooms out on each downbeat',
  // steady, bassy grooves
  suits: (rf, wOn, seed) => rf.perc*.5 + rf.low*.4 - rf.T*.2 + seed,
  fire(x){ const ty = x.ty; OUTL.n = ty.outN || 4; OUTL.rot = Math.random()*Math.PI*2; OUTL.age = 0; },
  step(dt){ OUTL.age += dt; },
  params(P, x){
    P.outline = new Float32Array(12);
    for (let i = 0; i < 3; i++) { const a = OUTL.age - i*.09; if (a < 0) continue;
      P.outline.set([.05 + a*1.1 + x.sBass*x.react*.02, x.eff.outline*x.dim*(a < .06 ? 1 : Math.exp(-(a - .06)*3.2))*(1 - i*.3), OUTL.n, OUTL.rot + a*.3], i*4); }
  },
  glsl: {
    uniforms: 'uniform vec4 uOut[3];      // outline echoes: radius, brightness, sides, rotation',
    functions: `
float sdNgon(vec2 p,float r,float n){ float an=3.141593/n; float a=mod(atan(p.x,p.y),2.0*an)-an; return length(p)*cos(a)-r*cos(an); }`,
    draw: `
  for(int i=0;i<3;i++){                  // outline: a polygon zooming out, with echoes
    vec4 o=uOut[i];
    if(o.y>0.003){
      vec2 q=sp; float cs=cos(o.w), sn=sin(o.w); q=mat2(cs,-sn,sn,cs)*q;
      float d=abs(sdNgon(q,o.x,o.z));
      c+=(vec3(1.0)*smoothstep(0.004,0.0,d)*0.7+hsv(uHue+0.3,0.8,1.0)*exp(-d*55.0)*0.45)*o.y;
    }
  }`,
  },
  uniforms(gl, u, P){ if (u['uOut[0]']) gl.uniform4fv(u['uOut[0]'], P.outline); },
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u;
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const r = P.outline[i*4], a = P.outline[i*4 + 1], n = P.outline[i*4 + 2], rot = P.outline[i*4 + 3];
      if (a < .003) continue;
      o.beginPath();
      for (let k = 0; k <= n; k++) { const ang = rot + k/n*Math.PI*2, R = r/Math.cos(Math.PI/n)*u;
        const px = X(0) + Math.sin(ang)*R, py = Y(0) - Math.cos(ang)*R; k ? o.lineTo(px, py) : o.moveTo(px, py); }
      o.shadowColor = hc(P.hue + .3, 80, 60, a); o.shadowBlur = u*.02;
      o.strokeStyle = `rgba(255,255,255,${Math.min(1, a*.8)})`; o.lineWidth = Math.max(1, u*.004); o.stroke();
    }
  },
};
