// Sparkles: small four-point glints that pop at random spots on the stabs.
import { hc } from '../../util.js';

const SPARKS = Array.from({length:6}, () => ({x:0, y:0, s:.05, age:9}));
let sparkN = 0;
export default {
  key: 'sparkle', kind: 'hit', label: 'Sparkles', trigger: 'stab', level: .8,
  words: 'Sparkles pop on the stabs',
  // bright and stabby
  suits: (rf, wOn, seed) => rf.busy*.5 + rf.bright*.5 - rf.low*.2 + seed + (wOn ? .1 : 0),
  fire(){
    const asp = innerWidth/innerHeight, n = 2 + Math.floor(Math.random()*3);
    for (let i = 0; i < n; i++) { const sp = SPARKS[sparkN++ % 6];
      sp.x = (Math.random() - .5)*asp*.85; sp.y = (Math.random() - .5)*.8; sp.s = .04 + Math.random()*.05; sp.age = 0; }
  },
  step(dt){ SPARKS.forEach(p => p.age += dt); },
  params(P, x){
    P.sparks = new Float32Array(24);
    SPARKS.forEach((p, i) => P.sparks.set([p.x, p.y, p.s*(1 + .5*Math.exp(-p.age*20)), x.eff.sparkle*x.dim*(p.age < .05 ? 1 : Math.exp(-(p.age - .05)*9))], i*4));
  },
  glsl: {
    uniforms: 'uniform vec4 uSpark[6];    // sparkles: x, y, size, brightness',
    functions: '',
    draw: `
  for(int i=0;i<6;i++){                  // sparkles: four-point glints
    vec4 s=uSpark[i];
    if(s.w>0.003){
      vec2 q=(sp-s.xy)/s.z;
      float v=exp(-abs(q.x)*9.0-abs(q.y)*0.9)+exp(-abs(q.y)*9.0-abs(q.x)*0.9)+exp(-length(q)*5.0);
      c+=hsv(uHue+uPal.z,0.3,1.0)*v*s.w*0.8;
    }
  }`,
  },
  uniforms(gl, u, P){ if (u['uSpark[0]']) gl.uniform4fv(u['uSpark[0]'], P.sparks); },
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u;
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = P.sparks[i*4], y = P.sparks[i*4 + 1], s = P.sparks[i*4 + 2]*u, a = P.sparks[i*4 + 3];
      if (a < .003) continue;
      const g = o.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), s*.5);
      g.addColorStop(0, hc(P.hue + P.pal[2], 60, 90, a)); g.addColorStop(1, hc(P.hue + P.pal[2], 60, 90, 0));
      o.fillStyle = g; o.fillRect(X(x) - s, Y(y) - s, s*2, s*2);
      o.fillStyle = hc(P.hue + P.pal[2], 40, 92, a*.8);
      o.fillRect(X(x) - s, Y(y) - s*.03, s*2, s*.06); o.fillRect(X(x) - s*.03, Y(y) - s, s*.06, s*2);
    }
  },
};
