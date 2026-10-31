// Lightning: a forked bolt cracking down from the top on the stabs, lighting everything for an instant, then gone.
import { viewAsp } from '../../state.js';
import { hc } from '../../util.js';

const NB = 16, BA = new Float32Array(NB*2), BB = new Float32Array(8*2);   // the bolt's points, and one branch's
const bolt = {age: 9, pts: [], br: []};
export default {
  key: 'lightning', kind: 'hit', label: 'Lightning', trigger: 'stab', level: .8,
  words: 'Lightning cracks on the stabs',
  // sharp, stabby, intense
  suits: (rf, wOn, seed) => rf.busy*.4 + rf.bright*.3 + (rf.T || 0)*.2 + seed + (wOn ? .15 : 0),
  fire(){
    const asp = viewAsp(); let x = (Math.random() - .5)*asp*.8, y = .55;
    const end = -.1 - Math.random()*.35, pts = [];
    for (let i = 0; i < NB; i++) { pts.push([x, y]); y -= (.55 - end)/(NB - 1); x += (Math.random() - .5)*.09; }
    const k = 3 + Math.floor(Math.random()*6), br = []; let [bx, by] = pts[k];
    for (let i = 0; i < 8; i++) { br.push([bx, by]); by -= .04; bx += (Math.random() - .3)*.07; }
    bolt.pts = pts; bolt.br = br; bolt.age = 0;
  },
  step(dt){ bolt.age += dt; },
  params(P, x){
    const a = bolt.age, flick = a < .03 ? 1 : a < .07 ? .3 : a < .11 ? .9 : Math.exp(-(a - .11)*14);   // it flickers, then fades
    P.boltA = x.eff.lightning*x.dim*flick*(bolt.pts.length ? 1 : 0);
    bolt.pts.forEach((p, i) => { BA[i*2] = p[0]; BA[i*2+1] = p[1]; });
    bolt.br.forEach((p, i) => { BB[i*2] = p[0]; BB[i*2+1] = p[1]; });
    P.bolt = BA; P.boltBr = BB;
  },
  glsl: {
    uniforms: 'uniform vec2 uBolt[16], uBoltBr[8]; uniform float uBoltA;   // lightning: the bolt, a branch, how bright',
    functions: `
float boltSeg(vec2 p,vec2 a,vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }`,
    draw: `
  if(uBoltA>0.003){                      // lightning: a white-hot core, a violet glow round it, and the whole sky lit a moment
    float d=1e9; for(int i=0;i<15;i++) d=min(d,boltSeg(sp,uBolt[i],uBolt[i+1]));
    float db=1e9; for(int i=0;i<7;i++) db=min(db,boltSeg(sp,uBoltBr[i],uBoltBr[i+1]));
    c+=vec3(0.95,0.95,1.0)*uBoltA*(smoothstep(0.004,0.0,d)+0.6*smoothstep(0.003,0.0,db));
    c+=hsv(uHue+uPal.x+0.7,0.5,1.0)*uBoltA*(0.35*exp(-d*40.0)+0.2*exp(-db*50.0)+0.06);
  }`,
  },
  uniforms(gl, u, P){ if (u['uBolt[0]']) { gl.uniform2fv(u['uBolt[0]'], P.bolt); gl.uniform2fv(u['uBoltBr[0]'], P.boltBr); gl.uniform1f(u.uBoltA, P.boltA); } },
  draw2d(o, P){
    if (!(P.boltA > .003)) return;
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, a = Math.min(1, P.boltA);
    o.globalCompositeOperation = 'lighter';
    o.fillStyle = hc(P.hue + P.pal[0] + .7, 50, 60, .06*a); o.fillRect(0, 0, W, H);
    for (const [pts, n, w] of [[P.bolt, 16, 1], [P.boltBr, 8, .6]]) {
      o.beginPath(); for (let i = 0; i < n; i++) { const x = X(pts[i*2]), y = Y(pts[i*2+1]); i ? o.lineTo(x, y) : o.moveTo(x, y); }
      o.strokeStyle = hc(P.hue + P.pal[0] + .7, 50, 65, .35*a*w); o.lineWidth = .02*u*w; o.stroke();
      o.strokeStyle = `rgba(245,245,255,${a*w})`; o.lineWidth = Math.max(1, .004*u*w); o.stroke();
    }
    o.globalCompositeOperation = 'source-over';
  },
};
