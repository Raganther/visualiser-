// GLSL source for the feedback pass (trails and layers) and the display pass (worlds and hits).

/* ---------- shaders ---------- */
export const VERT = `attribute vec2 a; varying vec2 vUv; void main(){ vUv=a*0.5+0.5; gl_Position=vec4(a,0.0,1.0); }`;
const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
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
export const DISPLAY = PREC + `
varying vec2 vUv;
uniform sampler2D uTex, uHist; uniform vec2 uRes;
uniform float uTime,uHue,uBass,uMid,uBeat,uReact,uLand,uSpace,uLandY,uHistFrac,uSunX,uLightAng,uStarPh,uAur,uCity,uCitySeed;
uniform sampler2D uData;   // waveform and spectrum
uniform vec4 uOut[3];      // outline echoes: radius, brightness, sides, rotation
uniform vec4 uSpark[6];    // sparkles: x, y, size, brightness
uniform vec3 uPlanet;      // x, y, radius
uniform vec4 uMoons[2];    // x, y, radius, in front (1) or behind (0)
uniform vec4 uStar;        // x, y, radius, brightness
uniform vec3 uStarS;       // rotation, points, inner radius as a fraction
float ASP;
float specD(float t){ return texture2D(uData, vec2(0.502+clamp(t,0.0,1.0)*0.497,0.5)).r; }
float sdNgon(vec2 p,float r,float n){ float an=3.141593/n; float a=mod(atan(p.x,p.y),2.0*an)-an; return length(p)*cos(a)-r*cos(an); }
float sdStar(vec2 p,float R,float n,float ratio){   // tips at R, inner corners at R*ratio
  float an=3.141593/n;
  float a=abs(mod(atan(p.x,p.y),2.0*an)-an);
  vec2 q=length(p)*vec2(sin(a),cos(a));
  vec2 A=vec2(0.0,R), e=ratio*R*vec2(sin(an),cos(an))-A, w=q-A;
  float d=length(w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0));
  return e.x*w.y-e.y*w.x<0.0 ? -d : d;
}
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
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
}
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
}
// aurora: curtains of light over a dark treeline, swelling with the melody
vec3 aurora(vec2 sp){
  float t=uTime;
  vec3 c=mix(hsv(uHue+0.62,0.7,0.12),hsv(uHue+0.7,0.6,0.02),clamp(sp.y+0.5,0.0,1.0));
  vec2 g=sp*60.0, cell=floor(g); float h=hash(cell);
  c+=vec3(0.8)*step(0.985,h)*smoothstep(0.35,0.0,length(fract(g)-0.5))*(0.55+0.45*sin(t*2.0+h*40.0));
  for(int i=0;i<3;i++){
    float fi=float(i), x=sp.x*(1.2+fi*0.3)+fi*1.7;
    float base=-0.08+fi*0.09+0.08*sin(x*1.3+t*0.15+fi)+0.04*sin(x*3.1-t*0.23)-uMid*uReact*0.05;
    float d=sp.y-base;
    float fold=0.5+0.5*sin(x*14.0+sin(x*3.0+t*0.4)*2.0+t*(0.6+fi*0.2));
    float body=smoothstep(-0.015,0.02,d)*exp(-max(d,0.0)*(3.0+fi*1.5));
    vec3 col=mix(hsv(uHue+0.33,0.8,1.0),hsv(uHue+0.8,0.7,1.0),clamp(d*2.5,0.0,1.0));
    c+=col*body*(0.3+0.7*fold)*(0.45+0.5*uMid*uReact+0.2*uBeat)*(1.0-fi*0.25);
  }
  float cx=fract(sp.x*38.0)-0.5, id=floor(sp.x*38.0);
  float top=-0.3+0.02*sin(sp.x*7.0)+0.012*sin(sp.x*23.0)+(0.03+0.05*hash(vec2(id,3.0)))*(1.0-abs(cx)*2.0);
  if(sp.y<top) c=hsv(uHue+0.62,0.5,0.03);
  return c;
}
// city: a night skyline whose rooftops follow the spectrum and whose windows change on the downbeat
vec3 cityAbove(vec2 sp){
  float t=uTime;
  vec3 c=mix(hsv(uHue+0.9,0.6,0.32),hsv(uHue+0.65,0.7,0.035),pow(clamp(sp.y+0.5,0.0,1.0),0.6));
  vec2 mp=vec2(-ASP*0.28,0.28); float md=length(sp-mp);
  c+=hsv(uHue+0.1,0.2,1.0)*smoothstep(0.052,0.048,md)*0.8+hsv(uHue+0.1,0.3,1.0)*0.12*exp(-md*8.0);
  for(int L=0;L<2;L++){
    float fl=float(L), w=0.035+fl*0.035;
    float x=sp.x+t*(0.008+fl*0.02)+fl*3.7;
    float id=floor(x/w), lx=fract(x/w), hb=hash(vec2(id,fl+1.0));
    float h=-0.3+(0.06+0.2*hb)*(0.8+fl*0.35)+specD(fract(id*0.137))*0.1*uReact*(0.5+fl*0.5);
    if(sp.y<h && lx>0.06 && lx<0.94){
      vec3 b=hsv(uHue+0.65,0.5,0.05+fl*0.04);
      vec2 wg=vec2(lx*5.0,(h-sp.y)/(w*0.3)), wc=floor(wg), wf=fract(wg);
      float win=step(0.25,wf.x)*step(wf.x,0.75)*step(0.3,wf.y)*step(wf.y,0.8)*step(1.0,wc.y);
      float lit=step(0.74,hash(vec2(id*7.0+wc.x,wc.y+uCitySeed*13.0+fl*50.0)));
      b+=hsv(uHue+0.12+0.06*hash(vec2(id,wc.y)),0.6,1.0)*win*lit*(0.45+0.3*fl+0.35*uBeat);
      b+=hsv(uHue+0.55,0.6,1.0)*smoothstep(0.004,0.0,h-sp.y)*(0.25+uBeat*0.6)*fl;
      c=mix(b,c,0.3*(1.0-fl));
    }
  }
  return c;
}
vec3 city(vec2 sp){
  if(sp.y>=-0.3) return cityAbove(sp)+hsv(uHue+0.95,0.7,1.0)*exp(-(sp.y+0.3)*14.0)*0.18;
  float dy=-0.3-sp.y;                    // a wet street: the skyline reflected, rippling
  vec2 r=vec2(sp.x+sin(dy*80.0-uTime*2.5)*0.004*(1.0+uBeat*3.0),-0.3+dy*1.4);
  return cityAbove(r)*0.35*(1.0-clamp(dy*2.5,0.0,0.7))+hsv(uHue+0.95,0.7,1.0)*exp(-dy*10.0)*0.12;
}
void main(){
  ASP=uRes.x/uRes.y;
  vec2 sp=(vUv-0.5)*vec2(ASP,1.0);
  vec2 px=3.0/uRes;
  vec3 c=texture2D(uTex,vUv).rgb;
  vec3 b=(texture2D(uTex,vUv+vec2(px.x,0.0)).rgb+texture2D(uTex,vUv-vec2(px.x,0.0)).rgb
         +texture2D(uTex,vUv+vec2(0.0,px.y)).rgb+texture2D(uTex,vUv-vec2(0.0,px.y)).rgb)*0.25;
  c+=b*0.35;
  // worlds sit behind the glow, drawn crisp every frame instead of smeared by the trails
  vec3 w=vec3(0.0);
  if(uLand>0.003) w+=landscape(sp)*uLand;
  if(uSpace>0.003) w+=space(sp)*uSpace;
  if(uAur>0.003) w+=aurora(sp)*uAur;
  if(uCity>0.003) w+=city(sp)*uCity;
  c=w*(1.0-0.4*clamp(max(c.r,max(c.g,c.b)),0.0,1.0))+c;
  // hits sit on top, crisp, with a small halo of glow
  if(uStar.w>0.003){
    vec2 q=sp-uStar.xy; float cs=cos(uStarS.x), sn=sin(uStarS.x); q=mat2(cs,-sn,sn,cs)*q;
    float d=sdStar(q,uStar.z,uStarS.y,uStarS.z);
    float fill=smoothstep(1.5/uRes.y,0.0,d);
    float edge=smoothstep(0.005,0.0,abs(d));
    float halo=exp(-max(d,0.0)*26.0)*(1.0-fill);
    c+=(hsv(uHue+0.12,0.35,1.0)*fill*0.9+vec3(1.0)*edge*0.5+hsv(uHue+0.12,0.8,1.0)*halo*0.45)*uStar.w;
  }
  for(int i=0;i<3;i++){                  // outline: a polygon zooming out, with echoes
    vec4 o=uOut[i];
    if(o.y>0.003){
      vec2 q=sp; float cs=cos(o.w), sn=sin(o.w); q=mat2(cs,-sn,sn,cs)*q;
      float d=abs(sdNgon(q,o.x,o.z));
      c+=(vec3(1.0)*smoothstep(0.004,0.0,d)*0.7+hsv(uHue+0.3,0.8,1.0)*exp(-d*55.0)*0.45)*o.y;
    }
  }
  for(int i=0;i<6;i++){                  // sparkles: four-point glints
    vec4 s=uSpark[i];
    if(s.w>0.003){
      vec2 q=(sp-s.xy)/s.z;
      float v=exp(-abs(q.x)*9.0-abs(q.y)*0.9)+exp(-abs(q.y)*9.0-abs(q.x)*0.9)+exp(-length(q)*5.0);
      c+=hsv(uHue+0.15,0.3,1.0)*v*s.w*0.8;
    }
  }
  c*=smoothstep(1.15,0.35,length(vUv-0.5));
  gl_FragColor=vec4(c,1.0);
}`;
export const PVERT = `attribute vec3 a; uniform vec2 uScale; uniform float uSize; varying float vB;
void main(){ vB=a.z; gl_Position=vec4(a.x*uScale.x,a.y*uScale.y,0.0,1.0); gl_PointSize=uSize; }`;
export const PFRAG = PREC + `varying float vB; uniform vec3 uCol;
void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(uCol*vB*smoothstep(0.5,0.0,d),1.0); }`;
