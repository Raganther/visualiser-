// GLSL source for the feedback pass (trails and layers) and the display pass (worlds and hits).

/* ---------- shaders ---------- */
export const VERT = `attribute vec2 a; varying vec2 vUv; void main(){ vUv=a*0.5+0.5; gl_Position=vec4(a,0.0,1.0); }`;
export const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
export const FEEDBACK = PREC + `
varying vec2 vUv;
uniform sampler2D uPrev, uData;
uniform vec2 uRes, uCenter, uBurstC, uRingShape; // ring: radius, squash
uniform float uTime,uZoom,uRot,uWarp,uDecay,uSym,uMirror,uHue,uHueShift,uBass,uMid,uTreb,uBeat,uReact,uHit;
uniform vec4 uLayers; // ring, scope, plasma, burst
uniform vec3 uComets[3];
uniform vec4 uShocks[8];
uniform vec2 uFx; // comets, shockwaves
uniform float uRib,uRibAng,uRibPh,uHor,uHorScroll,uHorY;
float ASP;

float wave(float t){ return texture2D(uData, vec2(0.001+clamp(t,0.0,1.0)*0.497,0.5)).r*2.0-1.0; }
float spec(float t){ return texture2D(uData, vec2(0.502+clamp(t,0.0,1.0)*0.497,0.5)).r; }
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
vec3 hueRot(vec3 c,float a){ vec3 k=vec3(0.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.0-ca); }
vec2 fold(vec2 p,float n){
  if(n<1.5) return p;
  float r=length(p), a=atan(p.y,p.x), seg=6.2831853/n;
  a=mod(a,seg); a=abs(a-seg*0.5);
  return r*vec2(cos(a),sin(a));
}
// shockwave fronts push everything they pass through
vec2 shockDisp(vec2 sp){
  vec2 d=vec2(0.0);
  for(int i=0;i<8;i++){
    vec4 sh=uShocks[i];
    vec2 v=sp-sh.xy; float l=length(v)+0.0001; float x=(l-sh.z)/0.05;
    d+=v/l*sh.w*exp(-x*x)*0.035;
  }
  return d*uFx.y;
}
vec3 sampleFb(vec2 p,float n){
  vec2 q=mix(p,fold(p,n),uMirror);
  float z=uZoom+uBass*uReact*0.012+uBeat*0.045*uReact;
  float c=cos(uRot), s=sin(uRot);
  q=mat2(c,-s,s,c)*q;
  q/=z;
  q+=uWarp*0.012*vec2(sin(q.y*7.0+uTime*1.3),cos(q.x*6.0-uTime*1.1));
  vec2 uv=(q+uCenter)/vec2(ASP,1.0)+0.5;
  uv=1.0-abs(1.0-mod(uv,2.0));
  return texture2D(uPrev,uv).rgb;
}
// three ribbons sweeping across the whole screen
vec3 ribbons(vec2 sp){
  float ca=cos(uRibAng), sa=sin(uRibAng);
  vec2 q=vec2(ca*sp.x+sa*sp.y,-sa*sp.x+ca*sp.y);
  vec3 c=vec3(0.0);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float y=0.28*(fi-1.0)+sin(q.x*(2.0+fi*0.7)+uRibPh*(1.0+fi*0.3)+fi*2.1)*(0.08+uMid*uReact*0.25)
           +wave(fract(q.x*0.5+0.5+fi*0.13))*0.05*uReact;
    float d=abs(q.y-y);
    c+=hsv(uHue+0.15+fi*0.08,0.8,1.0)*(smoothstep(0.005+0.008*uBeat,0.0,d)+0.25*smoothstep(0.05,0.0,d));
  }
  return c;
}
// a perspective floor rushing toward you, with the spectrum as a skyline
vec3 horizon(vec2 sp){
  vec3 c=vec3(0.0);
  float above=sp.y-uHorY;
  float h=spec(clamp(abs(sp.x)/(ASP*0.5),0.0,1.0)*0.8)*0.22*(0.5+uReact*0.5);
  float ds=abs(above-h);
  c+=hsv(uHue+0.1,0.7,1.0)*(smoothstep(0.006,0.0,ds)+0.3*smoothstep(0.03,0.0,ds))*step(abs(sp.x),ASP*0.5);
  float y=-above;
  if(y>0.003){
    float z=0.25/y;
    float fz=fract(z*2.0+uHorScroll);
    float sd=min(fz,1.0-fz)*0.5*y*y/0.25;
    float fx=fract(sp.x*z*4.0);
    float sx=min(fx,1.0-fx)/4.0/z;
    c+=hsv(uHue+0.8,0.75,1.0)*(smoothstep(0.004,0.0,sd)+smoothstep(0.003,0.0,sx))*smoothstep(0.0,0.25,y);
  }
  return c;
}
vec3 elements(vec2 p,vec2 pb,float n){
  vec2 d=fold(p,n);
  float r=length(d), at=abs(atan(d.y,d.x))/3.14159265;
  float g=0.0;
  vec2 dq=d*vec2(1.0+uRingShape.y,1.0-uRingShape.y);
  float rq=length(dq), aq=abs(atan(dq.y,dq.x))/3.14159265;
  float rr=uRingShape.x+uBeat*uReact*0.07+wave(aq)*0.12*(0.6+uReact*0.6);
  float dr=abs(rq-rr);
  g+=uLayers.x*(smoothstep(0.012,0.0,dr)+0.35*smoothstep(0.05,0.0,dr));
  float wy=wave(clamp(d.x/ASP+0.5,0.0,1.0))*0.3*(0.6+uReact*0.5);
  float ds=abs(d.y-wy);
  g+=uLayers.y*(0.6+uHit*1.6)*(smoothstep(0.01,0.0,ds)+0.3*smoothstep(0.04,0.0,ds))*smoothstep(0.5*ASP,0.38*ASP,abs(d.x));
  float v=sin(p.x*4.0+uTime*0.7)+sin(p.y*5.0-uTime*0.9)+sin(length(p)*9.0-uTime*1.7+uBass*uReact*3.0);
  g+=uLayers.z*smoothstep(0.85,1.0,sin(v*2.5+uMid*uReact*2.0))*(0.25+uMid*uReact*0.6);
  vec3 col=hsv(uHue+r*0.35+at*0.15,0.85,1.0)*g;
  // spectrum burst radiates from its own centre (which follows a comet when comets are present)
  vec2 db=fold(pb,n);
  float rb=length(db), ab=abs(atan(db.y,db.x))/3.14159265;
  float len=0.06+spec(pow(ab,1.3))*0.55*(0.6+uReact*0.5);
  float f=fract(ab*48.0);
  float bar=smoothstep(0.15,0.3,f)*smoothstep(0.85,0.7,f);
  float gb=uLayers.w*(0.6+uHit*1.4)*bar*(smoothstep(0.015,0.0,abs(rb-len))+0.08*step(rb,len)*step(0.06,rb));
  col+=hsv(uHue+rb*0.35+ab*0.15,0.85,1.0)*gb;
  return col;
}
void main(){
  ASP=uRes.x/uRes.y;
  vec2 sp=(vUv-0.5)*vec2(ASP,1.0);
  vec2 disp=shockDisp(sp);
  vec2 p=sp-uCenter;
  float sym=max(uSym,1.0), n1=floor(sym), fr=sym-n1;

  // feedback: last frame, transformed; symmetry crossfades between fold counts
  vec2 pf=p+disp*0.3;
  vec3 col=sampleFb(pf,n1);
  if(fr>0.002) col=mix(col,sampleFb(pf,n1+1.0),fr);
  col=hueRot(col,uHueShift);
  // the kick briefly cuts the trails, so the whole image pumps in time
  col=max(col*(uDecay-uBeat*0.09)-0.004,0.0);
  col-=0.16*col*col;

  vec2 pe=p+disp, pb=sp-uBurstC+disp;
  vec3 e=elements(pe,pb,n1);
  if(fr>0.002) e=mix(e,elements(pe,pb,n1+1.0),fr);
  col+=e*(0.35+uTreb*uReact*0.5+uBeat*0.8+uHit*0.5);
  if(uRib>0.003) col+=ribbons(sp+disp)*uRib*(0.35+uBeat*0.8+uMid*uReact*0.4+uHit*0.7);
  if(uHor>0.003) col+=horizon(sp+disp)*uHor*(0.4+uBeat*0.6+uHit*0.6);

  for(int i=0;i<3;i++){
    vec3 cm=uComets[i];
    float dd=length(sp-cm.xy);
    col+=hsv(uHue+float(i)*0.33,0.75,1.0)*uFx.x*cm.z*(smoothstep(0.018,0.0,dd)+0.35*smoothstep(0.06,0.0,dd));
  }
  for(int i=0;i<8;i++){
    vec4 sh=uShocks[i];
    float dd=abs(length(sp-sh.xy)-sh.z);
    col+=hsv(uHue+0.5+sh.z*0.3,0.7,1.0)*uFx.y*sh.w*(smoothstep(0.006+sh.z*0.015,0.0,dd)+0.3*smoothstep(0.03+sh.z*0.03,0.0,dd));
  }
  gl_FragColor=vec4(min(col,vec3(1.0)),1.0);
}`;
export const PVERT = `attribute vec3 a; uniform vec2 uScale; uniform float uSize; varying float vB;
void main(){ vB=a.z; gl_Position=vec4(a.x*uScale.x,a.y*uScale.y,0.0,1.0); gl_PointSize=uSize; }`;
export const PFRAG = PREC + `varying float vB; uniform vec3 uCol;
void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(uCol*vB*smoothstep(0.5,0.0,d),1.0); }`;
