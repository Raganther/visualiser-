// Cascades: on the downbeat a chain of light runs out from the centre, one link each 16th, like dominoes falling: up a
// spiral, out along a star's arms all at once, or round a ring. Each link flares and fades as the next one lights, so the
// chain is a movement in time with the music, not a flash (the user asked for cascading movements and patterns that run
// on through the beats). Drawn crisp, over the picture.
import { S } from '../../state.js';
import { hc } from '../../util.js';

const N = 16, C = new Float32Array(N*4);   // each link: x, y, size, brightness
const ch = {age: 9, kind: 0, arms: 3, turn: 0, dir: 1, cx: 0, cy: 0};
export default {
  key: 'cascade', kind: 'hit', label: 'Cascades', trigger: 'downbeat', level: .8,
  words: 'Chains of light run out on the downbeat, a link each 16th',
  // driving music with things going on: the chain follows the 16ths
  suits: (rf, wOn, seed) => rf.perc*.25 + (rf.hat || 0)*.55 + rf.busy*.2 + seed + .05,   // (the hats' busy 16ths: a link each 16th)
  fire(){ ch.age = 0; ch.kind = Math.floor(Math.random()*3); ch.arms = [3, 4, 5, 6][Math.floor(Math.random()*4)]; ch.turn = Math.random()*Math.PI*2; ch.dir = Math.random() < .5 ? 1 : -1; },
  step(dt){ ch.age += dt; },
  params(P, x){
    const st16 = Math.max(.06, S.beatPeriod/4), w = x.eff.cascade*x.dim, cx = P.cx || 0, cy = P.cy || 0;
    for (let i = 0; i < N; i++) {
      // where the link is: up a spiral, along the arms of a star (a link on each arm at a time), or round a ring
      let r, a, step;
      if (ch.kind === 0) { step = i; r = .04 + i*.026; a = ch.turn + ch.dir*i*.62; }
      else if (ch.kind === 1) { const arm = i % ch.arms; step = Math.floor(i/ch.arms); r = .07 + step*.075; a = ch.turn + arm/ch.arms*Math.PI*2 + ch.dir*step*.15; }
      else { step = i; r = .3; a = ch.turn + ch.dir*i/N*Math.PI*2; }
      const t = ch.age - step*st16, on = t >= 0 ? Math.exp(-t*5)*(1 + 1.5*Math.exp(-t*30)) : 0;
      C[i*4] = cx + Math.cos(a)*r; C[i*4 + 1] = cy + Math.sin(a)*r; C[i*4 + 2] = .018 + .012*Math.exp(-Math.max(0, t)*12); C[i*4 + 3] = on*w;
    }
    P.casc = C; P.cascHue = ch.kind;
  },
  glsl: {
    uniforms: 'uniform vec4 uCasc[16]; uniform float uCascH;   // cascades: each link x, y, size, brightness; its kind (for its hue)',
    functions: '',
    draw: `
  for(int i=0;i<16;i++){                 // cascades: diamond flares, a link each 16th
    vec4 k=uCasc[i];
    if(k.w>0.003){
      vec2 q=(sp-k.xy)/k.z; float dm=abs(q.x)+abs(q.y);
      float v=1.4*exp(-dm*1.1)+0.45*exp(-length(q)*0.45);
      c+=hsv(uHue+(uCascH<0.5 ? uPal.x : uCascH<1.5 ? uPal.y : uPal.z)+float(i)*0.015,0.7,1.0)*v*k.w*1.3;
    }
  }`,
  },
  uniforms(gl, u, P){ if (u['uCasc[0]']) { gl.uniform4fv(u['uCasc[0]'], P.casc); gl.uniform1f(u.uCascH, P.cascHue); } },
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, X = x => W/2 + x*H, Y = y => H/2 - y*H, hue = P.hue + P.pal[P.cascHue] ;
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const a = P.casc[i*4 + 3]; if (a < .003) continue;
      const x = X(P.casc[i*4]), y = Y(P.casc[i*4 + 1]), s = P.casc[i*4 + 2]*H*2.2;
      const g = o.createRadialGradient(x, y, 0, x, y, s*1.6); g.addColorStop(0, hc(hue + i*.015, 70, 70, Math.min(1, a))); g.addColorStop(1, hc(hue + i*.015, 70, 70, 0));
      o.fillStyle = g; o.fillRect(x - s*1.6, y - s*1.6, s*3.2, s*3.2);
      o.fillStyle = hc(hue + i*.015, 60, 88, Math.min(1, a)); o.beginPath(); o.moveTo(x, y - s*.6); o.lineTo(x + s*.6, y); o.lineTo(x, y + s*.6); o.lineTo(x - s*.6, y); o.closePath(); o.fill();
    }
  },
};
