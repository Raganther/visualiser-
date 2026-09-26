// Star: a crisp star that snaps in on the downbeat, then snaps or flickers out.
import { hc } from '../../util.js';

export const STAR = {x:0, y:0, rot:0, n:5, size:.14, age:9, out:'snap'};
function starEnv(){
  const a = STAR.age;
  if (STAR.out === 'flicker') return a > 1.2 ? 0 : Math.exp(-a*3.5)*(a < .1 || Math.sin(a*55) > 0 ? 1 : .2);
  return a < .16 ? 1 : Math.exp(-(a - .16)*22);
}
export default {
  key: 'star', kind: 'hit', label: 'Star flash', trigger: 'downbeat', level: .9,
  words: 'A star flashes on each downbeat',
  // intense downbeats; stays crisp over a world
  suits: (rf, wOn, seed) => rf.perc*.4 + rf.T*.6 + seed + (wOn ? .1 : 0),
  fire(x){
    const J = x.J, ty = x.ty, asp = innerWidth/innerHeight;
    STAR.n = ty.starN || 5; STAR.out = ty.starOut || 'snap';
    if (ty.starScatter) { STAR.x = (Math.random() - .5)*asp*.6; STAR.y = (Math.random() - .5)*.5; } else { STAR.x = 0; STAR.y = 0; }
    STAR.rot = Math.random()*Math.PI*2; STAR.size = .1 + Math.random()*.05 + (J.on ? J.tension*.06 : .03); STAR.age = 0;
  },
  step(dt){ STAR.age += dt; },
  params(P, x){
    const sa = STAR.age;
    P.star = [STAR.x, STAR.y, STAR.size*(1 + .3*Math.exp(-sa*16))*(1 + x.sBass*x.react*.15), x.eff.star*starEnv()*x.dim];
    P.starRot = STAR.rot + sa*.5; P.starN = STAR.n;
  },
  glsl: {
    uniforms: `uniform vec4 uStar;        // x, y, radius, brightness
uniform vec3 uStarS;       // rotation, points, inner radius as a fraction`,
    functions: `
float sdStar(vec2 p,float R,float n,float ratio){   // tips at R, inner corners at R*ratio
  float an=3.141593/n;
  float a=abs(mod(atan(p.x,p.y),2.0*an)-an);
  vec2 q=length(p)*vec2(sin(a),cos(a));
  vec2 A=vec2(0.0,R), e=ratio*R*vec2(sin(an),cos(an))-A, w=q-A;
  float d=length(w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0));
  return e.x*w.y-e.y*w.x<0.0 ? -d : d;
}`,
    draw: `
  if(uStar.w>0.003){
    vec2 q=sp-uStar.xy; float cs=cos(uStarS.x), sn=sin(uStarS.x); q=mat2(cs,-sn,sn,cs)*q;
    float d=sdStar(q,uStar.z,uStarS.y,uStarS.z);
    float fill=smoothstep(1.5/uRes.y,0.0,d);
    float edge=smoothstep(0.005,0.0,abs(d));
    float halo=exp(-max(d,0.0)*26.0)*(1.0-fill);
    c+=(hsv(uHue+uPal.y,0.35,1.0)*fill*0.9+vec3(1.0)*edge*0.5+hsv(uHue+uPal.y,0.8,1.0)*halo*0.45)*uStar.w;
  }`,
  },
  uniforms(gl, u, P){ gl.uniform4f(u.uStar, P.star[0], P.star[1], P.star[2], P.star[3]); gl.uniform3f(u.uStarS, P.starRot, P.starN, P.starN > 5 ? .5 : .42); },
  draw2d(o, P){
    const [x, y, r, a] = P.star; if (a < .003) return;
    const W = o.canvas.width, H = o.canvas.height, u = H, n = P.starN, R = r*u, cx = W/2 + x*u, cy = H/2 - y*u, inner = R*(n > 5 ? .5 : .42);
    o.save(); o.globalCompositeOperation = 'lighter'; o.translate(cx, cy); o.rotate(P.starRot);
    o.beginPath();
    for (let k = 0; k < n*2; k++) { const ang = k*Math.PI/n - Math.PI/2, rr = k % 2 ? inner : R;
      k ? o.lineTo(Math.cos(ang)*rr, Math.sin(ang)*rr) : o.moveTo(Math.cos(ang)*rr, Math.sin(ang)*rr); }
    o.closePath();
    o.shadowColor = hc(P.hue + P.pal[1], 90, 60, Math.min(1, a)); o.shadowBlur = R*.5;
    o.fillStyle = hc(P.hue + P.pal[1], 90, 85, Math.min(1, a*.9)); o.fill();
    o.shadowBlur = 0; o.strokeStyle = `rgba(255,255,255,${Math.min(1, a*.6)})`; o.lineWidth = Math.max(1, u*.003); o.stroke();
    o.restore();
  },
};
