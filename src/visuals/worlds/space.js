// Space: nebulae, stars rushing past, and a ringed planet with two moons.
import { S } from '../../state.js';
import { hc } from '../../util.js';

const st = {starPh:0, lightAng:0, moonAng:0, moonTarget:0, planet:null, moons:null};
let stars = null, lastStarPh = 0;                      // simple mode's own starfield
export default {
  key: 'space', kind: 'world', label: 'Space',
  // bright, intense parts
  suits: (rf, T) => rf.bright*.5 + T*.4 + rf.busy*.2,
  step(dt, x){
    const react = x.react, t = x.tStep;
    st.starPh += dt*x.ts*(.03 + x.J.tension*.25 + S.beat*.25);
    st.lightAng += dt*.05;
    st.moonAng += (st.moonTarget - st.moonAng)*Math.min(1, dt*5);
    const R = .2 + x.sBass*react*.03, px = innerWidth/innerHeight*.18 + Math.sin(t*.05)*.05, py = .06 + Math.sin(t*.037)*.03;
    st.planet = [px, py, R];
    const m = new Float32Array(8);
    [[st.moonAng, 2.6, .032], [st.moonAng*.6 + 2, 3.3, .022]].forEach(([a, orbit, mr], i) => {
      m[i*4] = px + Math.cos(a)*R*orbit; m[i*4 + 1] = py + Math.sin(a)*R*orbit*.3; m[i*4 + 2] = mr; m[i*4 + 3] = Math.sin(a) < 0 ? 1 : 0;
    });
    st.moons = m;
  },
  onBeat(pos, beats){ if (beats % 2 === 0) st.moonTarget += Math.PI/4; },   // the moons step round every other beat
  params(P){ P.planet = st.planet; P.moons = st.moons; P.lightAng = st.lightAng; P.starPh = st.starPh; },
  glsl: {
    uniforms: `uniform float uLightAng,uStarPh;
uniform vec3 uPlanet;      // x, y, radius
uniform vec4 uMoons[2];    // x, y, radius, in front (1) or behind (0)`,
    functions: `
vec3 space(vec2 sp){
  vec3 c=hsv(uHue+0.68,0.7,0.05);
  float neb=sin(sp.x*2.3+uTime*0.05)*sin(sp.y*3.1-uTime*0.04)+sin((sp.x+sp.y)*4.7+uTime*0.03)*0.5;
  c+=hsv(uHue+0.75+neb*0.08,0.6,0.14)*smoothstep(-0.2,1.2,neb);
  for(int i=0;i<3;i++){                  // stars rushing past
    float fi=float(i), depth=fract(fi/3.0+uStarPh), sc=mix(14.0,1.5,depth);
    vec2 g=sp*sc+fi*17.3, cell=floor(g), f=fract(g)-0.5;
    vec2 o=vec2(hash(cell+3.1),hash(cell+7.7))-0.5;
    float b=step(0.75,hash(cell+fi))*smoothstep(0.08,0.0,length(f-o*0.7))*smoothstep(0.0,0.3,depth)*smoothstep(1.0,0.8,depth);
    c+=vec3(0.85,0.9,1.0)*b*(0.6+depth);
  }
  vec2 d=sp-uPlanet.xy; float R=uPlanet.z, r=length(d)/R;
  float rr=length(vec2(d.x,d.y/0.28))/R;
  float ring=smoothstep(1.35,1.4,rr)*smoothstep(2.15,2.1,rr)*(0.55+0.45*sin(rr*38.0))*(0.6+uMid*uReact*0.8);
  vec3 rc=hsv(uHue+0.1+rr*0.08,0.5,0.9);
  if(d.y>0.0) c=mix(c,rc,ring*0.8);      // far side of the rings, behind the planet
  if(r<1.0){
    vec3 n=vec3(d/R,sqrt(1.0-r*r));
    vec3 L=normalize(vec3(cos(uLightAng),0.35,sin(uLightAng)*0.6+0.6));
    float diff=max(dot(n,L),0.0);
    float lon=atan(n.x,n.z)+uTime*0.15;
    float pat=sin(n.y*11.0+sin(lon*3.0+uTime*0.25)*1.4+uTime*0.12)+0.5*sin(n.y*23.0-lon*2.0);
    vec3 pc=hsv(uHue+0.5+pat*0.09+sin(uTime*0.2)*0.05,0.75,1.0)*(0.08+0.92*diff);
    pc+=hsv(uHue+0.55,0.6,1.0)*pow(1.0-n.z,3.0)*0.6;
    c=mix(c,pc,smoothstep(1.0,0.985,r));
  } else c+=hsv(uHue+0.55,0.6,1.0)*0.25*smoothstep(1.35,1.0,r);
  if(d.y<=0.0) c=mix(c,rc,ring*0.9);     // near side of the rings, in front
  for(int i=0;i<2;i++){
    vec4 m=uMoons[i]; vec2 dm=sp-m.xy; float rm=length(dm)/m.z;
    if(rm<1.0 && (m.w>0.5 || r>1.0)){
      vec3 n=vec3(dm/m.z,sqrt(1.0-rm*rm));
      c=hsv(uHue+0.1,0.3,0.95)*(0.08+max(dot(n,normalize(vec3(cos(uLightAng),0.3,0.7))),0.0));
    }
  }
  return c;
}`,
    fn: 'space',
  },
  // its front plane, for scenes that put things between its layers: the planet
  front: {
    fn: 'spaceFront',
    glsl: `
float spaceFront(vec2 sp){ return length(sp-uPlanet.xy)<uPlanet.z ? 1.0 : 0.0; }`,
    path2d(o, P){
      const W = o.canvas.width, H = o.canvas.height, [px, py, pr] = P.planet;
      o.moveTo(W/2 + px*H + pr*H, H/2 - py*H); o.arc(W/2 + px*H, H/2 - py*H, pr*H, 0, Math.PI*2);
    },
  },
  uniforms(gl, u, P){
    gl.uniform1f(u.uLightAng, P.lightAng); gl.uniform1f(u.uStarPh, P.starPh); gl.uniform3fv(u.uPlanet, P.planet);
    if (u['uMoons[0]']) gl.uniform4fv(u['uMoons[0]'], P.moons);
  },
  init2d(){ stars = Array.from({length:220}, () => ({x:(Math.random() - .5)*3, y:(Math.random() - .5)*2, z:Math.random()})); },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u;
  if (P.w.space > .01) {
    o.globalAlpha = Math.min(1, P.w.space);
    o.fillStyle = hc(P.hue + .68, 60, 3, 1); o.fillRect(0, 0, W, H);
    for (let n = 0; n < 2; n++) {
      const nx = X(Math.sin(t*.05 + n*2)*.5), ny = Y(Math.cos(t*.04 + n)*.25), nr = u*.6;
      const ng = o.createRadialGradient(nx, ny, 0, nx, ny, nr);
      ng.addColorStop(0, hc(P.hue + .75 + n*.08, 60, 15, .5)); ng.addColorStop(1, hc(P.hue + .75, 60, 10, 0));
      o.fillStyle = ng; o.fillRect(nx - nr, ny - nr, nr*2, nr*2);
    }
    const adv = Math.max(0, P.starPh - lastStarPh)*1.5; lastStarPh = P.starPh;
    o.fillStyle = '#dfe8ff';
    for (const s of stars) {
      s.z -= adv; if (s.z < .05) { s.z = 1; s.x = (Math.random() - .5)*3; s.y = (Math.random() - .5)*2; }
      const px = X(s.x*.3/s.z), py = Y(s.y*.3/s.z), sz = Math.max(1, 2.2*(1 - s.z));
      if (px > -5 && px < W + 5 && py > -5 && py < H + 5) o.fillRect(px, py, sz, sz);
    }
    const [pxw, pyw, pr] = P.planet, cx = X(pxw), cy = Y(pyw), R = pr*u;
    const ring = (front) => {
      for (let k = 0; k < 10; k++) {
        const rr = 1.4 + k*.075;
        o.beginPath(); o.ellipse(cx, cy, R*rr, R*rr*.28, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI*2);
        o.strokeStyle = hc(P.hue + .1 + rr*.08, 50, 65, (.55 + .45*Math.sin(rr*38))*(.6 + P.mid*P.react*.8)*.8);
        o.lineWidth = R*.06; o.stroke();
      }
    };
    ring(false);
    const halo = o.createRadialGradient(cx, cy, R, cx, cy, R*1.35);
    halo.addColorStop(0, hc(P.hue + .55, 60, 60, .25)); halo.addColorStop(1, hc(P.hue + .55, 60, 60, 0));
    o.fillStyle = halo; o.fillRect(cx - R*1.4, cy - R*1.4, R*2.8, R*2.8);
    o.save(); o.beginPath(); o.arc(cx, cy, R, 0, Math.PI*2); o.clip();
    o.fillStyle = hc(P.hue + .5, 70, 45, 1); o.fillRect(cx - R, cy - R, R*2, R*2);
    for (let k = -12; k <= 12; k++) {                  // swirling colour bands
      o.beginPath();
      for (let j = 0; j <= 24; j++) {
        const xx = cx - R + j/24*R*2, yy = cy + k*R/11 + Math.sin(j*.5 + t*.25 + k)*R*.05;
        j ? o.lineTo(xx, yy) : o.moveTo(xx, yy);
      }
      o.strokeStyle = hc(P.hue + .5 + Math.sin(k*1.3 + t*.12)*.09, 75, 55, .7); o.lineWidth = R/13; o.stroke();
    }
    const lx = cx + Math.cos(P.lightAng)*R*.5, ly = cy - R*.3;
    const shade = o.createRadialGradient(lx, ly, R*.1, lx, ly, R*1.9);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(.55, 'rgba(0,0,0,.35)'); shade.addColorStop(1, 'rgba(0,0,0,.92)');
    o.fillStyle = shade; o.fillRect(cx - R, cy - R, R*2, R*2);
    o.restore();
    ring(true);
    for (let m = 0; m < 2; m++) {
      const mx = X(P.moons[m*4]), my = Y(P.moons[m*4 + 1]), mr = P.moons[m*4 + 2]*u, front = P.moons[m*4 + 3] > .5;
      if (!front && Math.hypot(mx - cx, my - cy) < R) continue;
      const mg = o.createRadialGradient(mx - mr*.4, my - mr*.4, mr*.1, mx, my, mr);
      mg.addColorStop(0, hc(P.hue + .1, 30, 85, 1)); mg.addColorStop(1, hc(P.hue + .1, 30, 12, 1));
      o.fillStyle = mg; o.beginPath(); o.arc(mx, my, mr, 0, Math.PI*2); o.fill();
    }
  }
  },
};
