// The cosmos in WebGL: each pixel's ray tested against the star and the nearest bodies (rock, banded gas, cracked ice, lava
// glowing through its cracks), lit from the star, with atmospheres, rings and the star's glow; far off, gas clouds and stars.
export const GLSL = {
  uniforms: `uniform vec3 uCosX,uCosY,uCosZ; uniform float uCosTan,uCosWarp,uCosSeed;   // the camera's axes, its field of view, the jump
uniform vec4 uCosSun; uniform vec3 uCosSunC;          // the star: where (from the camera) and how big, its colour
uniform vec4 uCosB[6], uCosK[6], uCosA[6];           // the nearest bodies: where and how big (0: none); kind, hue, seed, spin; axis, ring size`,
  functions: `
float czH(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float czN(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(czH(i),czH(i+vec3(1.0,0.0,0.0)),f.x),mix(czH(i+vec3(0.0,1.0,0.0)),czH(i+vec3(1.0,1.0,0.0)),f.x),f.y),
             mix(mix(czH(i+vec3(0.0,0.0,1.0)),czH(i+vec3(1.0,0.0,1.0)),f.x),mix(czH(i+vec3(0.0,1.0,1.0)),czH(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z); }
float czF(vec3 p){ return czN(p)*0.5+czN(p*2.03)*0.25+czN(p*4.01)*0.125; }
// how far along d a sphere (centre c from the eye, radius r) is hit, or -1
float czHit(vec3 d,vec3 c,float r){ float b=dot(c,d), h=b*b-dot(c,c)+r*r; if(h<0.0) return -1.0; float t=b-sqrt(h); return t>0.0?t:-1.0; }
// far away: two clouds of gas and the stars, which streak towards the middle of the view in a jump
vec3 czSky(vec3 d){
  vec3 c=hsv(uHue+0.68,0.6,0.03);
  float n=czF(d*2.2+uCosSeed); c+=hsv(uHue+0.72+n*0.2,0.6,0.16)*smoothstep(0.35,0.75,n);
  float n2=czF(d*3.7-uCosSeed); c+=hsv(uHue+0.95,0.55,0.08)*smoothstep(0.45,0.8,n2);
  float s=0.0;
  for(int k=0;k<6;k++){
    vec3 dk=normalize(d-uCosZ*float(k)*uCosWarp*0.05);
    vec3 g=dk*120.0, id=floor(g), f=fract(g)-0.5; float h=czH(id);
    s+=step(0.965,h)*smoothstep(0.35,0.0,length(f))*(0.55+0.45*sin(uTime*2.0+h*50.0))*(k==0?1.0:0.5);
    if(uCosWarp<0.01) break;
  }
  return c+vec3(0.85,0.9,1.0)*s*(1.0+uBeat*0.3)+vec3(0.5,0.6,1.0)*uCosWarp*uCosWarp*0.25;
}
// a body's surface where the view hits it: rock, banded gas, pale cracked ice, or lava glowing through its cracks
vec3 czBody(vec3 d,float t,vec3 c,float r,vec4 K,vec4 A){
  vec3 p=d*t, n=normalize(p-c), L=normalize(uCosSun.xyz-p), ax=A.xyz;
  float diff=max(dot(n,L),0.0), sp=uTime*K.w, lat=dot(n,ax), hue=uHue+K.y, atm=0.0;
  vec3 q=n*cos(sp)+cross(ax,n)*sin(sp)+ax*dot(ax,n)*(1.0-cos(sp)), qs=q*2.0+K.z, base, emit=vec3(0.0);
  if(K.x<0.5){ base=hsv(hue+0.05,0.35,0.3+0.6*czF(qs*1.6))*(0.75+0.25*smoothstep(0.3,0.5,czN(qs*5.0))); }
  else if(K.x<1.5){ float b=sin(lat*14.0+czF(q*0.9+K.z)*6.0); base=mix(hsv(hue,0.55,0.7),hsv(hue+0.08,0.35,0.95),0.5+0.5*b); atm=0.7; }
  else if(K.x<2.5){ base=hsv(hue+0.5,0.18,0.72+0.25*czF(qs*1.3))*(0.8+0.2*smoothstep(0.0,0.05,abs(czN(qs*4.0)-0.5))); atm=0.45; }
  else { base=hsv(hue+0.02,0.5,0.1+0.1*czF(qs*1.8)); emit=hsv(hue+0.03,0.9,1.0)*smoothstep(0.06,0.0,abs(czN(qs*3.5)-0.5))*(0.7+0.5*uBass*uReact); }
  vec3 col=base*(0.03+0.97*diff)+emit;
  col+=hsv(hue+0.55,0.5,1.0)*pow(1.0-max(dot(n,-d),0.0),3.0)*atm*(0.25+0.75*diff)*(0.85+uBeat*0.3);   // its atmosphere at the edge
  return col;
}
// a body's ring where the view crosses it in front of what's already hit (premultiplied colour, cover)
vec4 czRing(vec3 d,vec3 c,float r,vec4 A,float hue,float tmax){
  float den=dot(d,A.xyz); if(A.w<=0.0||abs(den)<1e-4) return vec4(0.0);
  float t=dot(c,A.xyz)/den; if(t<=0.0||t>tmax) return vec4(0.0);
  vec3 p=d*t; float rr=length(p-c)/r, inner=A.w*0.62; if(rr<inner||rr>A.w) return vec4(0.0);
  float x=(rr-inner)/(A.w-inner), band=0.5+0.5*sin(x*40.0)*sin(x*13.0+1.3), gap=smoothstep(0.04,0.0,abs(x-0.55));
  float a=smoothstep(0.0,0.05,x)*smoothstep(1.0,0.9,x)*(0.35+0.65*band)*(1.0-0.85*gap)*0.8;
  float sh=czHit(normalize(uCosSun.xyz-p),c-p,r)>0.0?0.15:1.0;   // the planet's shadow across it
  return vec4(mix(hsv(hue+0.08,0.3,0.9),hsv(hue+0.55,0.4,0.75),x)*sh*(0.6+uMid*uReact*0.6)*a,a);
}
vec3 cosmos(vec2 sp){
  vec3 d=normalize(uCosZ+(uCosX*sp.x+uCosY*sp.y)*2.0*uCosTan), col=czSky(d);
  float tMin=1e9, ts=czHit(d,uCosSun.xyz,uCosSun.w);
  if(ts>0.0){ tMin=ts; vec3 n=normalize(d*ts-uCosSun.xyz); col=uCosSunC*(1.2+0.8*max(dot(n,-d),0.0))*(0.85+0.3*czF(n*9.0+uTime*0.1)); }
  int hit=-1;
  for(int i=0;i<6;i++){ vec4 B=uCosB[i]; if(B.w<=0.0) continue; float t=czHit(d,B.xyz,B.w); if(t>0.0&&t<tMin){ tMin=t; hit=i; } }
  for(int i=0;i<6;i++) if(i==hit) col=czBody(d,tMin,uCosB[i].xyz,uCosB[i].w,uCosK[i],uCosA[i]);
  // the star's glow, where nothing nearer covers it (so it rims a planet in front of it)
  float sb=dot(uCosSun.xyz,d);
  if(sb>0.0&&(hit<0||tMin>sb)){ float h=length(uCosSun.xyz-d*sb), R=uCosSun.w; col+=uCosSunC*R*R/(h*h+R*R*0.3)*0.22*(1.0+uBass*uReact*0.5); }
  for(int i=0;i<6;i++){
    vec4 B=uCosB[i]; if(B.w<=0.0) continue;
    float b=dot(B.xyz,d), k=uCosK[i].x, atm=k>0.5&&k<1.5?0.7:(k>1.5&&k<2.5?0.45:0.0);
    if(b>0.0&&b<tMin&&atm>0.0){   // an atmosphere's glow just past its edge, brighter on the sunlit side
      vec3 q=d*b; float h=length(B.xyz-q);
      if(h>B.w) col+=hsv(uHue+uCosK[i].y+0.55,0.5,1.0)*exp(-(h-B.w)/(B.w*0.08))*atm*0.35*(0.3+0.7*max(dot(normalize(q-B.xyz),normalize(uCosSun.xyz-q)),0.0));
    }
    vec4 rg=czRing(d,B.xyz,B.w,uCosA[i],uHue+uCosK[i].y,tMin); col=col*(1.0-rg.a)+rg.rgb;
  }
  return col;
}`,
};
