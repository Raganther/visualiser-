// Skull: a stylised skull ray-marched from simple shapes, in parts (cranium, face, cheekbones, jaw, teeth, eyes).
// It turns at the section's pace, the jaw snaps on the pulse, the parts change colour on stabs, the eyes and a halo
// flare on the downbeat, and it breaks apart on drops and big changes, then pulls itself back together.
// Opt-in: Journey uses it as a centrepiece only when TUNE.skull.chance > 0 (try ?lab=skull).
import { TUNE } from '../../tuning.js';
import { hc } from '../../util.js';

const st = {ex: 0, exT: 0, glow: 0, hue: 0, lastHit: 0, seen: false, jOn: false, bars: 0};
export default {
  key: 'skull', kind: 'object', label: 'Skull', optIn: true, words: 'The skull is the centrepiece',
  onBeat(pos){
    if (pos !== 0) return;
    st.glow = 1;                                        // eyes and halo flare on the downbeat
    if (!st.jOn && ++st.bars % 8 === 0) st.exT = 1;     // by hand (no Journey), it breaks apart every 8 bars
  },
  breakApart(){ st.exT = 1; },                          // for tests and labs
  params(P, x){
    const T = TUNE.skull, J = x.J, dt = x.dt;
    // break apart on a drop, a new section or a progression step; the target snaps out then drifts back to whole
    const trigger = st.seen && (J.lastDrop !== st.lastDrop || J.type !== st.lastType || J.progStep !== st.lastStep);
    if (trigger && J.on) st.exT = 1;
    st.seen = true; st.jOn = J.on;
    st.lastDrop = J.lastDrop; st.lastType = J.type; st.lastStep = J.progStep;
    st.exT *= Math.exp(-dt/T.explodeSecs);
    st.ex += (st.exT - st.ex)*Math.min(1, dt*(st.exT > st.ex ? 10 : 2.5));
    if (x.hit > .8 && st.lastHit <= .8) st.hue += .17;   // each stab moves the parts round the colour wheel
    st.lastHit = x.hit;
    st.glow *= Math.exp(-dt*3);
    P.skRot = Math.sin(x.t*T.spin)*T.turn;   // it looks round, side to side (from behind a skull is just an egg)
     P.skPitch = Math.sin(x.t*.23)*.18 - P.beat*.06;
    P.skJaw = P.beat*T.jaw; P.skEx = st.ex*T.explode; P.skHue = st.hue; P.skGlow = st.glow;
    P.skSize = T.size*(1 + x.sBass*x.react*.04); P.skPos = [0, .02];
  },
  glsl: {
    uniforms: 'uniform float uSkRot,uSkPitch,uSkJaw,uSkEx,uSkHue,uSkGlow,uSkSize;\nuniform vec2 uSkPos;',
    functions: `
float sdE(vec3 p,vec3 r){ float k0=length(p/r), k1=length(p/(r*r)); return k0*(k0-1.0)/k1; }
float sdRB(vec3 p,vec3 b,float r){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r; }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float smax(float a,float b,float k){ return -smin(-a,-b,k); }
mat2 rot2(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
// the skull, part by part; each part flies its own way as it breaks apart (uSkEx). id: 1 cranium, 2 face, 3 cheeks, 4 jaw, 5 teeth, 6 eyes
float skullSdf(vec3 p,out float id){
  float e=uSkEx;
  vec3 pc=p-vec3(0.0,0.6,-0.3)*e;
  vec3 pf=p-vec3(0.0,-0.05,0.6)*e;
  vec3 pk=p-vec3(0.55*sign(p.x),0.0,0.25)*e;
  vec3 pj=p-vec3(0.0,-0.65,0.25)*e;
  pj.yz=rot2(-uSkJaw)*(pj.yz-vec2(-0.2,-0.08))+vec2(-0.2,-0.08);   // the jaw hinges open near the ears
  float cr=sdE(pc-vec3(0.0,0.14,-0.06),vec3(0.38,0.40,0.48));
  cr=smin(cr,sdE(pc-vec3(0.0,0.03,0.30),vec3(0.30,0.07,0.12)),0.06);                          // brow ridge
  cr=smax(cr,-sdE(vec3(abs(pc.x),pc.y,pc.z)-vec3(0.43,-0.02,0.08),vec3(0.1,0.15,0.2)),0.05); // temples
  float fa=sdE(pf-vec3(0.0,-0.13,0.16),vec3(0.27,0.19,0.26));
  vec3 fq=vec3(abs(pf.x),pf.y,pf.z);
  float head=smin(cr,fa,0.1);
  head=smax(head,-sdE(fq-vec3(0.15,-0.03,0.36),vec3(0.105,0.10,0.16)),0.03);   // eye sockets
  head=smax(head,-sdE(pf-vec3(0.0,-0.16,0.40),vec3(0.045,0.07,0.12)),0.02);  // nose
  float ck=sdE(vec3(abs(pk.x),pk.y,pk.z)-vec3(0.24,-0.11,0.2),vec3(0.1,0.06,0.12));
  // the mandible: a bowl hollowed into a U, with the rami rising to the hinge
  float jaw=sdE(pj-vec3(0.0,-0.33,0.07),vec3(0.24,0.1,0.24));
  jaw=smax(jaw,-sdE(pj-vec3(0.0,-0.25,-0.02),vec3(0.2,0.13,0.23)),0.02);
  jaw=smin(jaw,sdRB(vec3(abs(pj.x),pj.y,pj.z)-vec3(0.22,-0.22,-0.07),vec3(0.02,0.09,0.05),0.02),0.04);
  float tu=sdRB(pf-vec3(0.0,-0.29,0.30),vec3(0.13,0.035,0.035),0.01);
  float tl=sdRB(pj-vec3(0.0,-0.31,0.27),vec3(0.12,0.03,0.035),0.01);
  float te=min(tu,tl)+0.006*smoothstep(0.6,1.0,abs(sin(p.x*55.0)));       // grooves between teeth
  float eyes=length(fq-vec3(0.15,-0.03,0.30))-0.04;
  float d=head; id=fa<cr ? 2.0 : 1.0;
  if(ck<d){ d=ck; id=3.0; }
  if(jaw<d){ d=jaw; id=4.0; }
  if(te<d){ d=te; id=5.0; }
  if(eyes<d){ d=eyes; id=6.0; }
  return d;
}
// the skull seen from the front, turned by yaw and pitch; returns colour (premultiplied) and coverage, with a halo around it
vec4 skull(vec2 sp){
  vec2 q=(sp-uSkPos)/uSkSize;
  if(length(q)>1.7) return vec4(0.0);
  vec3 ro=vec3(q,2.5), rd=vec3(0.0,0.0,-1.0), L=normalize(vec3(-0.5,0.6,0.7));
  mat2 ry=rot2(uSkRot), rx=rot2(uSkPitch);
  ro.xz=ry*ro.xz; rd.xz=ry*rd.xz; L.xz=ry*L.xz;
  ro.yz=rx*ro.yz; rd.yz=rx*rd.yz; L.yz=rx*L.yz;
  float t=0.0, id=0.0, dmin=9.0; bool hit=false;
  for(int i=0;i<56;i++){
    float d=skullSdf(ro+rd*t,id); dmin=min(dmin,d);
    if(d<0.002){ hit=true; break; }
    t+=d*0.9; if(t>5.0) break;
  }
  vec3 glow=hsv(uHue+uSkHue+0.1,0.7,1.0)*exp(-max(dmin,0.0)*16.0)*uSkGlow*0.7;
  if(!hit) return vec4(glow,0.0);
  vec3 p=ro+rd*t; vec2 e=vec2(0.003,0.0); float di;
  vec3 n=normalize(vec3(skullSdf(p+e.xyy,di)-skullSdf(p-e.xyy,di),skullSdf(p+e.yxy,di)-skullSdf(p-e.yxy,di),skullSdf(p+e.yyx,di)-skullSdf(p-e.yyx,di)));
  float dif=max(dot(n,L),0.0), rim=pow(1.0-max(dot(n,-rd),0.0),3.0), spc=pow(max(dot(reflect(-L,n),-rd),0.0),24.0);
  vec3 base=hsv(uHue+uSkHue+id*0.13,0.45,1.0);
  float ao=clamp(skullSdf(p+n*0.06,di)/0.06,0.0,1.0);   // hollows (sockets, nose, under the brow) fall into shadow
  vec3 col=base*(0.16+0.84*dif)*(0.25+0.75*ao)+hsv(uHue+uSkHue+0.5,0.5,1.0)*rim*0.6+vec3(spc*0.4);
  if(id>5.5) col=hsv(uHue+uSkHue+0.5,0.9,1.0)*(1.0+uBeat*1.2+uSkGlow*1.5);   // the eyes glow
  return vec4(col+glow,1.0);
}`,
    fn: 'skull',
  },
  uniforms(gl, u, P){
    gl.uniform1f(u.uSkRot, P.skRot); gl.uniform1f(u.uSkPitch, P.skPitch); gl.uniform1f(u.uSkJaw, P.skJaw); gl.uniform1f(u.uSkEx, P.skEx);
    gl.uniform1f(u.uSkHue, P.skHue); gl.uniform1f(u.uSkGlow, P.skGlow); gl.uniform1f(u.uSkSize, P.skSize); gl.uniform2f(u.uSkPos, P.skPos[0], P.skPos[1]);
  },
  // simple mode: a flat skull, front on, with the same colours, jaw and break-apart
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, R = P.skSize*H, cx = W/2 + P.skPos[0]*H, cy = H/2 - P.skPos[1]*H, e = P.skEx*R;
    const w = Math.min(1, P.o.skull), col = (id, l = 72) => hc(P.hue + P.skHue + id*.13, 45, l, w);
    const tilt = Math.sin(P.skRot)*.25;                 // a hint of the turn
    o.translate(cx, cy); o.rotate(tilt*.3);
    const part = (dx, dy, fn) => { o.save(); o.translate(dx*e, dy*e); fn(); o.restore(); };
    if (P.skGlow > .02) { const g = o.createRadialGradient(0, 0, R*.3, 0, 0, R*1.3); g.addColorStop(0, hc(P.hue + P.skHue + .1, 70, 60, .5*P.skGlow*w)); g.addColorStop(1, hc(P.hue, 70, 60, 0)); o.fillStyle = g; o.fillRect(-R*1.3, -R*1.3, R*2.6, R*2.6); }
    part(0, -.6, () => { o.fillStyle = col(1); o.beginPath(); o.ellipse(0, -R*.12, R*.42, R*.4, 0, 0, Math.PI*2); o.fill(); });   // cranium
    part(0, .05, () => {                                                                                                          // face, sockets, nose, upper teeth
      o.fillStyle = col(2); o.beginPath(); o.ellipse(0, R*.13, R*.28, R*.2, 0, 0, Math.PI*2); o.fill();
      o.fillStyle = hc(0, 0, 4, w);
      for (const s of [-1, 1]) { o.beginPath(); o.ellipse(s*R*.15, 0, R*.11, R*.1, 0, 0, Math.PI*2); o.fill(); }
      o.beginPath(); o.moveTo(0, R*.08); o.lineTo(-R*.045, R*.2); o.lineTo(R*.045, R*.2); o.closePath(); o.fill();
      o.fillStyle = hc(P.hue + P.skHue + .5, 90, 60, w*Math.min(1, .6 + P.beat + P.skGlow));
      for (const s of [-1, 1]) { o.beginPath(); o.arc(s*R*.15, 0, R*.045, 0, Math.PI*2); o.fill(); }
      o.fillStyle = col(5, 85); for (let i = -3; i <= 3; i++) o.fillRect(i*R*.036 - R*.015, R*.27, R*.03, R*.06);
    });
    for (const s of [-1, 1]) part(s*.55, -.25, () => { o.fillStyle = col(3); o.beginPath(); o.ellipse(s*R*.25, R*.09, R*.12, R*.07, 0, 0, Math.PI*2); o.fill(); });
    part(0, .65, () => {                                                                                                          // jaw and lower teeth
      o.translate(0, R*P.skJaw*.25);
      o.fillStyle = col(4); o.beginPath(); o.ellipse(0, R*.38, R*.21, R*.08, 0, 0, Math.PI*2); o.fill();
      o.fillStyle = col(5, 85); for (let i = -3; i <= 3; i++) o.fillRect(i*R*.034 - R*.014, R*.3, R*.028, R*.05);
    });
  },
};
