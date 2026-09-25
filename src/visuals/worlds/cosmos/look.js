// The cosmos in WebGL: each pixel's ray tested against the star (or twin stars, a pulsar with its beams, a black hole
// bending the light behind it round a glowing disk) and the nearest bodies: rock, banded gas with storms, cracked ice,
// ocean worlds catching the star's glint, lava glowing through its cracks; cities on night sides, auroras at the poles.
// An asteroid belt's rocks rush past up close (the ray steps through a grid of cells) and show as dust from afar; a vast
// ring can be built round the star. Far off, gas clouds and stars, which stretch in a build and streak in a jump.
export const GLSL = {
  uniforms: `uniform vec3 uCosX,uCosY,uCosZ,uCosEye; uniform float uCosTan,uCosWarp,uCosSeed;   // the camera: axes, where it is, field of view; the jump
uniform vec4 uCosSun; uniform vec3 uCosSunC,uCosAxis; uniform vec4 uCosStar;   // the star: where (from the camera), size, colour; beam or disk axis; kind
uniform vec4 uCosTwin; uniform vec3 uCosTwinC;        // a twin star (size 0: none)
uniform vec4 uCosBelt, uCosHalo;                      // the belt (radius, half width, half height, near); the built ring (radius, half height, on, hue)
uniform vec4 uCosB[6], uCosK[6], uCosA[6], uCosE[6];  // the nearest bodies: where, size; kind, hue, seed, spin; axis, ring; cities, aurora, storm, cloud
uniform vec2 uCosFx;                                  // the treble (lightning) and the stabs (lava flares)
uniform float uGal,uGalTan; uniform vec3 uGalX,uGalY,uGalZ,uGalEye,uGalA,uGalB;   // the galaxy view: how far in, its camera, the systems it's between`,
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
// a body's surface where the view hits it, with what lives on it (E: cities, aurora, storm, cloud)
vec3 czBody(vec3 d,float t,vec3 c,float r,vec4 K,vec4 A,vec4 E){
  vec3 p=d*t, n=normalize(p-c), L=normalize(uCosSun.xyz-p), ax=A.xyz;
  float nl=dot(n,L), diff=max(nl,0.0), sp=uTime*K.w, lat=dot(n,ax), hue=uHue+K.y, atm=0.0, land=1.0;
  vec3 q=n*cos(sp)+cross(ax,n)*sin(sp)+ax*dot(ax,n)*(1.0-cos(sp)), qs=q*2.0+K.z, base, emit=vec3(0.0);
  float close=smoothstep(r*4.0,r*1.15,t);   // up close the surface gains finer detail
  if(K.x<0.5){ base=hsv(hue+0.05,0.35,0.3+0.6*czF(qs*1.6)+close*0.15*(czN(qs*14.0)-0.5))*(0.75+0.25*smoothstep(0.3,0.5,czN(qs*5.0))); }
  else if(K.x<1.5){   // gas: bands, and a great storm turning in them, lightning on the hi-hats
    float b=sin(lat*14.0+czF(q*0.9+K.z)*6.0); base=mix(hsv(hue,0.55,0.7),hsv(hue+0.08,0.35,0.95),0.5+0.5*b); atm=0.7;
    if(E.z>0.5){
      vec3 sd=normalize(ax*(0.3*sin(K.z))+normalize(cross(ax,vec3(0.3,0.1,0.95)))); float ds=length(q-sd);
      float sw=sin(atan(dot(q-sd,cross(ax,sd)),dot(q-sd,ax))*3.0+ds*40.0-uTime*1.5);
      base=mix(base,hsv(hue+0.93,0.6,0.85+0.1*sw),smoothstep(0.32,0.2,ds));
      emit+=vec3(0.7,0.8,1.0)*step(0.94,czH(floor(q*18.0)+floor(uTime*9.0)))*smoothstep(0.5,0.25,ds)*smoothstep(0.1,-0.2,nl)*uCosFx.x*2.0;
    }
  }
  else if(K.x<2.5){ base=hsv(hue+0.5,0.18,0.72+0.25*czF(qs*1.3))*(0.8+0.2*smoothstep(0.0,0.05,abs(czN(qs*4.0)-0.5))); atm=0.45; }
  else if(K.x<3.5){ base=hsv(hue+0.02,0.5,0.1+0.1*czF(qs*1.8)); emit=hsv(hue+0.03,0.9,1.0)*smoothstep(0.06,0.0,abs(czN(qs*3.5)-0.5))*(0.7+0.5*uBass*uReact)*(1.0+uCosFx.y*2.5); }
  else {   // ocean: deep water and land, the star's glint on the sea
    land=smoothstep(0.5,0.54,czF(qs*1.4)+close*0.05*czN(qs*16.0));
    base=mix(hsv(hue+0.56,0.7,0.35),hsv(hue+0.12,0.4,0.45),land); atm=0.6;
    emit+=uCosSunC*pow(max(dot(reflect(-L,n),-d),0.0),60.0)*(1.0-land)*0.8*step(0.0,nl);
  }
  if(E.w>0.0){ float cl=smoothstep(0.52,0.62,czF(q*3.0+vec3(uTime*0.02,0.0,0.0))); base=mix(base,vec3(0.9),cl*E.w); land*=1.0-cl; }
  vec3 col=base*(0.03+0.97*diff)+emit;
  if(E.x>0.5) col+=vec3(1.0,0.75,0.4)*step(0.7,czN(qs*22.0))*land*smoothstep(0.08,-0.1,nl)*(0.55+0.35*uBeat);   // cities on the night side
  if(E.y>0.5){ float lon=atan(dot(n,cross(ax,vec3(0.0,0.0,1.0))),dot(n,vec3(0.0,0.0,1.0)));   // auroras round the poles, on the kick
    col+=hsv(hue+0.33,0.8,1.0)*smoothstep(0.7,0.85,abs(lat))*smoothstep(1.0,0.9,abs(lat))*(0.5+0.5*sin(lon*18.0+uTime*2.0))*(0.25+uBeat*0.9)*(0.4+0.6*smoothstep(0.2,-0.2,nl)); }
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
// the belt's rocks near the camera: the ray steps through a grid of cells, and each cell in the belt may hold a rock
vec4 czRocks(vec3 d,float tmax){
  const float S=1.6;
  vec3 o=uCosEye/S, cell=floor(o), st=sign(d)+step(0.0,-abs(sign(d))), inv=1.0/max(abs(d),vec3(1e-4)), tm=(st*(cell-o)+st*0.5+0.5)*inv;
  for(int i=0;i<28;i++){
    vec3 cc=(cell+0.5)*S; float rr=length(cc.xz);
    if(abs(rr-uCosBelt.x)<uCosBelt.y&&abs(cc.y)<uCosBelt.z&&czH(cell)>0.55){
      vec3 ctr=cc+(vec3(czH(cell+3.1),czH(cell+5.7),czH(cell+9.2))-0.5)*0.8-uCosEye; float rad=S*(0.1+0.22*czH(cell+1.3));
      float t=czHit(d,ctr,rad);
      if(t>0.0&&t<tmax){ vec3 n=normalize(d*t-ctr), L=normalize(uCosSun.xyz-d*t);
        float g=czF(n*3.0+cell); vec3 c=hsv(uHue+0.06,0.25,0.35+0.35*g)*(0.04+0.96*max(dot(n,L),0.0));
        return vec4(c*(1.0-smoothstep(25.0,44.0,t)),t); }
    }
    if(tm.x<tm.y){ if(tm.x<tm.z){ cell.x+=st.x; tm.x+=inv.x; } else { cell.z+=st.z; tm.z+=inv.z; } }
    else { if(tm.y<tm.z){ cell.y+=st.y; tm.y+=inv.y; } else { cell.z+=st.z; tm.z+=inv.z; } }
  }
  return vec4(0.0,0.0,0.0,-1.0);
}
// the vast built ring round the star: its inner face lit, seams and lights on it, a pulse running round on the beat
vec4 czHalo(vec3 d,float tmax){
  vec3 o=uCosEye; float a=dot(d.xz,d.xz), b=dot(o.xz,d.xz), c=dot(o.xz,o.xz)-uCosHalo.x*uCosHalo.x, h=b*b-a*c;
  if(h<0.0||a<1e-6) return vec4(0.0,0.0,0.0,-1.0);
  h=sqrt(h);
  for(int k=0;k<2;k++){
    float t=(-b+(k==0?-h:h))/a; vec3 p=o+d*t;
    if(t>0.0&&t<tmax&&abs(p.y)<uCosHalo.y){
      vec3 n=normalize(vec3(-p.x,0.0,-p.z)); bool inner=dot(n,d)<0.0; float ang=atan(p.z,p.x)*uCosHalo.x;
      float seam=max(step(fract(ang/3.0),0.04),step(fract(p.y/0.8+0.5),0.06)), lit=inner?0.25+0.75*max(dot(n,normalize(-p)),0.0):0.05;
      vec3 col=hsv(uHue+uCosHalo.w,0.15,0.55)*lit*(1.0-0.5*seam);
      col+=vec3(1.0,0.8,0.5)*step(0.85,czH(floor(vec3(ang/1.2,p.y/0.5,1.0))))*(inner?0.2:0.6);   // windows
      col+=hsv(uHue+uCosHalo.w,0.8,1.0)*exp(-abs(fract(ang/80.0-uTime*0.2)-0.5)*30.0)*(0.3+uBeat);   // a pulse running round it
      return vec4(col,t);
    }
  }
  return vec4(0.0,0.0,0.0,-1.0);
}
// the galaxy from outside: three spiral arms (cold, warm and hot music), a bright core, and the two systems the camera
// is travelling between, pulsing on the beat
vec3 czGalaxy(vec2 sp){
  vec3 d=normalize(uGalZ+(uGalX*sp.x+uGalY*sp.y)*2.0*uGalTan), o=uGalEye, col=czSky(d)*0.4;
  if(abs(d.y)>1e-4){ float t=-o.y/d.y;
    if(t>0.0){ vec3 p=o+d*t; float rho=length(p.xz), th=atan(p.z,p.x); vec3 ac=vec3(0.0);
      for(int a=0;a<3;a++){
        float ta=float(a)*2.0944+(rho-10.0)/1.6*0.3, dd=mod(th-ta+3.14159,6.28318)-3.14159, w=1.5+rho*0.08;
        ac+=hsv(uHue+(a==0?0.58:(a==1?0.12:0.98)),0.55,1.0)*exp(-dd*dd*rho*rho/(2.0*w*w));
      }
      col+=(ac*0.95*(0.3+0.7*step(0.6,czN(p*2.5)))*smoothstep(95.0,25.0,rho)+vec3(1.0,0.9,0.75)*exp(-rho/5.0)*1.2)*(0.6+0.4*czN(p*0.4));
    } }
  float hb=dot(-o,d), h0=length(-o-d*hb); if(hb>0.0) col+=vec3(1.0,0.85,0.7)*exp(-h0/3.0)*0.5;   // the bulge, seen edge-on too
  for(int k=0;k<2;k++){ vec3 q=(k==0?uGalA:uGalB)-o; float b=dot(q,d), h=length(q-d*b);
    if(b>0.0) col+=(k==0?vec3(0.7,0.8,1.0):vec3(1.0,0.85,0.5))*exp(-h/(0.05+b*0.004))*(0.8+0.8*uBeat*float(k)); }
  return col;
}
vec3 czSystem(vec2 sp);
vec3 cosmos(vec2 sp){
  if(uGal>0.999) return czGalaxy(sp);
  vec3 col=czSystem(sp);
  return uGal>0.001?mix(col,czGalaxy(sp),uGal):col;
}
vec3 czSystem(vec2 sp){
  vec3 d=normalize(uCosZ+(uCosX*sp.x+uCosY*sp.y)*2.0*uCosTan), S=uCosSun.xyz;
  float R=uCosSun.w, sb=dot(S,d), sh=length(S-d*sb), hole=step(2.5,uCosStar.x);
  // a black hole bends the light from behind it towards itself
  vec3 dl=d;
  if(hole>0.5&&sb>0.0) dl=normalize(d+normalize(S-d*sb)*min(2.0*R/max(sh,R*0.5),1.2));
  vec3 col=czSky(dl);
  float tMin=1e9;
  if(hole<0.5){ float ts=czHit(d,S,R);
    if(ts>0.0){ tMin=ts; vec3 n=normalize(d*ts-S); col=uCosSunC*(1.2+0.8*max(dot(n,-d),0.0))*(0.85+0.3*czF(n*9.0+uTime*0.1)); } }
  else if(sb>0.0&&sh<R*1.5){ tMin=sb; col=vec3(0.0); }   // its shadow
  if(uCosTwin.w>0.0){ float tt=czHit(d,uCosTwin.xyz,uCosTwin.w); if(tt>0.0&&tt<tMin){ tMin=tt; col=uCosTwinC*1.6; } }
  if(uCosHalo.z>0.5){ vec4 hl=czHalo(d,tMin); if(hl.w>0.0){ tMin=hl.w; col=hl.rgb; } }
  int hit=-1;
  for(int i=0;i<6;i++){ vec4 B=uCosB[i]; if(B.w<=0.0) continue; float t=czHit(d,B.xyz,B.w); if(t>0.0&&t<tMin){ tMin=t; hit=i; } }
  for(int i=0;i<6;i++) if(i==hit) col=czBody(d,tMin,uCosB[i].xyz,uCosB[i].w,uCosK[i],uCosA[i],uCosE[i]);
  if(uCosBelt.w>0.5){ vec4 rk=czRocks(d,tMin); if(rk.w>0.0){ tMin=rk.w; col=rk.rgb; } }
  if(uCosBelt.x>0.0&&abs(d.y)>1e-4){   // the belt from afar: a band of glinting dust across the system's plane
    float tp=-uCosEye.y/d.y; vec3 pp=uCosEye+d*tp;
    if(tp>0.0&&tp<tMin){ float band=smoothstep(uCosBelt.y,uCosBelt.y*0.4,abs(length(pp.xz)-uCosBelt.x));
      col+=hsv(uHue+0.08,0.2,0.6)*band*(0.05+0.25*step(0.82,czN(pp*1.3)))*(1.0-uCosBelt.w*0.7); }
  }
  // the stars' glow, where nothing nearer covers it (so they rim a planet in front of them)
  if(hole<0.5&&sb>0.0&&(hit<0||tMin>sb)) col+=uCosSunC*R*R/(sh*sh+R*R*0.3)*0.22*(1.0+uBass*uReact*0.5);
  if(uCosTwin.w>0.0){ float tb=dot(uCosTwin.xyz,d), th=length(uCosTwin.xyz-d*tb), r2=uCosTwin.w;
    if(tb>0.0&&(hit<0||tMin>tb)) col+=uCosTwinC*r2*r2/(th*th+r2*r2*0.3)*0.2; }
  if(hole>0.5&&sb>0.0){   // the hole: a ring of light at its edge, and its disk, the far side's image bent up over the top
    vec3 N=uCosAxis; vec3 dc=vec3(1.0,0.72,0.45)*uCosSunC;
    if(hit<0||tMin>sb) col+=dc*exp(-abs(sh-R*1.5)/(R*0.06))*1.4*(1.0+uBeat*0.5);
    for(int k=0;k<2;k++){
      vec3 dd=k==0?d:dl; float den=dot(dd,N); if(abs(den)<1e-4) continue;
      float t=dot(S,N)/den; vec3 p=dd*t-S; float rr=length(p)/R;
      if(t>0.0&&rr>2.2&&rr<7.0&&(k==0?t<tMin:(t>sb&&sh>R*1.5&&hit<0))){
        vec3 tg=normalize(cross(N,p)); float ang=atan(dot(p,cross(N,tg)),dot(p,tg));
        float sw=czF(vec3(rr*3.0,ang*2.0-uTime*(3.0/rr)*4.0,1.0)), heat=smoothstep(7.0,2.2,rr), dop=1.0+0.7*dot(tg,-dd);
        float a=smoothstep(7.0,5.5,rr)*smoothstep(2.2,2.6,rr)*(0.5+0.6*sw)*(k==0?1.0:0.8);
        col=mix(col,mix(dc*0.8,vec3(1.3,1.2,1.1),heat*heat)*(0.6+heat)*dop*(1.0+uBeat*0.4),clamp(a,0.0,1.0));
      }
    }
  }
  if(uCosStar.x>1.5&&uCosStar.x<2.5){   // a pulsar's beams, sweeping round once a beat
    for(int k=0;k<2;k++){
      vec3 B=uCosAxis*(k==0?1.0:-1.0); float bd=dot(d,B), den=1.0-bd*bd;
      if(den<1e-4) continue;
      float s=clamp((bd*sb-dot(B,S))/den,0.0,R*60.0);   // the point on the beam nearest the view's ray
      vec3 q=S+B*s; float tq=max(dot(q,d),0.0), dist=length(q-d*tq);
      if(hit<0||tMin>tq) col+=uCosSunC*exp(-dist/(R*0.4+s*0.05))*(1.0-s/(R*60.0))*0.9;
    }
    col+=uCosSunC*pow(max(dot(uCosAxis,-normalize(S)),max(dot(-uCosAxis,-normalize(S)),0.0)),60.0)*0.35;   // it flashes when a beam faces the camera
  }
  return col;
}`,
};
