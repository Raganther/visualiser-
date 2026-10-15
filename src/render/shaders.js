// GLSL source for the feedback pass (trails and layers) and the display pass (worlds and hits).

/* ---------- shaders ---------- */
export const VERT = `attribute vec2 a; varying vec2 vUv; void main(){ vUv=a*0.5+0.5; gl_Position=vec4(a,0.0,1.0); }`;
export const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
// the finish, after the whole scene: the bright parts picked out (small), blurred both ways, and added back as a glow;
// then bright colours roll off softly instead of clipping, and a touch of dither hides banding
export const BRIGHT = PREC + `varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uPx; uniform float uThresh;
void main(){
  vec3 c=(texture2D(uTex,vUv+uPx*vec2(-1.0,-1.0)).rgb+texture2D(uTex,vUv+uPx*vec2(1.0,-1.0)).rgb
         +texture2D(uTex,vUv+uPx*vec2(-1.0,1.0)).rgb+texture2D(uTex,vUv+uPx*vec2(1.0,1.0)).rgb)*0.25;
  float m=max(c.r,max(c.g,c.b));
  gl_FragColor=vec4(c*max(m-uThresh,0.0)/max(m,0.0001),1.0);
}`;
export const BLUR = PREC + `varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir;
void main(){   // 9 taps from 5 fetches, using the texture's own filtering
  vec3 c=texture2D(uTex,vUv).rgb*0.2270;
  c+=(texture2D(uTex,vUv+uDir*1.3846).rgb+texture2D(uTex,vUv-uDir*1.3846).rgb)*0.3162;
  c+=(texture2D(uTex,vUv+uDir*3.2308).rgb+texture2D(uTex,vUv-uDir*3.2308).rgb)*0.0703;
  gl_FragColor=vec4(c,1.0);
}`;
// the kaleidoscope's fold, shared with the segments. uKal: mirrors, the share of one more (easing between counts), how far
// folded, turn. uKal2: the kind (0 wedges meeting at a point; 1 a mirror box: the square round the centre reflected across
// its walls, the copies shrinking into the distance like a hall of mirrors by uKal2.y; 2 a dive: the wedges' rings repeat
// inward, mirrored, and zoom in by uKal2.z, each band uKal2.w wide in log radius, so it reveals more as it goes)
// The kinds added after the user loved the Prism under a kaleidoscope and asked for ones "symmetrical but asymmetrical at
// the same time" (uKal3: motion time, the bar count, how asymmetric the music wants it (settling through a drop's run-up,
// breaking on the drop), the bass): 3 a pinwheel (wedges turned, not mirrored); 4 ripple (each wedge turned and swelled a
// moment after the one before, a wave running round); 5 inverted pairs (every other wedge shows the far side, its colours
// turned to their opposites, the pairs changing over each bar); 6 the odd one out (one wedge unfolded and turned, moving on
// each bar); 7 imperfect mirrors (uneven wedges whose seams don't quite meet); 8 colour wedges (the same shape, each wedge
// its own hue); 9 tiles (the plane tiled with triangles, each folded on its medians); 10 hyperbolic (Escher's Circle Limit:
// tiles shrinking for ever towards the rim of a disc, drifting); 11 Droste (a spiral of copies, each inside the last,
// zooming); 12 curved mirrors (bending with the bass); 13 two centres (two kaleidoscopes drifting apart and together).
// kalH is a hue turn for the point's wedge, applied once the picture is read (kalCol).
export const KAL = `float kalH=0.0;
vec2 kRot(vec2 p,float a){ float c=cos(a), s=sin(a); return vec2(c*p.x-s*p.y,s*p.x+c*p.y); }
float kH1(float x){ return fract(sin(x*127.1+3.7)*43758.5453); }
vec2 kalF(vec2 p,float n,float ang){ float r=length(p), s=6.2831853/n, a=mod(atan(p.y,p.x)-ang,s); a=min(a,s-a)+ang; return r*vec2(cos(a),sin(a)); }
vec2 kalPin(vec2 p,float n,float ang){ float r=length(p), s=6.2831853/n, a=mod(atan(p.y,p.x)-ang,s)+ang; return r*vec2(cos(a),sin(a)); }
float kalI(vec2 p,float n,float ang){ return floor(mod(atan(p.y,p.x)-ang,6.2831853)/(6.2831853/n)); }
vec2 kalBox(vec2 p,float b){ vec2 t=mod(p+b,4.0*b); return b-abs(t-2.0*b); }
vec2 kalTri(vec2 p,float b){   // the plane in equilateral triangles of side b, each folded on its medians (seamless: their content has the triangle's symmetry)
  float v=p.y/(0.8660254*b), u=p.x/b-0.5*v; vec2 fu=fract(vec2(u,v)); if(fu.x+fu.y>1.0) fu=1.0-fu;
  vec2 q=vec2(fu.x*b+fu.y*0.5*b,fu.y*0.8660254*b), g=vec2(0.5*b,0.2886751*b);
  return kalF(q-g,3.0,0.5235988);
}
vec2 kalHyp(vec2 p,float n,float ang,float R,vec2 mv){   // the {p,q} tiling of the Poincare disc: into the wedge, out of the circle, again
  vec2 z=kRot(p,-ang)/R; float m2=dot(z,z); if(m2>1.0) z/=m2;   // (outside the disc: its mirror image)
  vec2 num=z+mv, den=vec2(1.0+mv.x*z.x+mv.y*z.y,mv.x*z.y-mv.y*z.x); z=vec2(num.x*den.x+num.y*den.y,num.y*den.x-num.x*den.y)/dot(den,den);   // drifting: (z+a)/(1+conj(a)z)
  float P=max(n,3.0), Q=P<3.5?7.0:(P<4.5?5.0:4.0), th=3.14159265/P, cq=cos(3.14159265/Q), d=cq/sqrt(cq*cq-sin(th)*sin(th)), r2=d*d-1.0;
  for(int i=0;i<24;i++){
    float a=mod(atan(z.y,z.x),2.0*th); a=min(a,2.0*th-a); z=length(z)*vec2(cos(a),sin(a));
    vec2 w=z-vec2(d,0.0); float l2=dot(w,w); if(l2>=r2) break; z=vec2(d,0.0)+w*(r2/l2);
  }
  return z*R;
}
vec2 kalDroste(vec2 p,float L,float z0){   // turning once round climbs one band of log radius: a spiral of copies
  float r=length(p)+1e-5, a=atan(p.y,p.x), k=L/6.2831853, u=log(r/0.5)-k*a+z0*L, w=abs(fract(u/L)*2.0-1.0)*L;   // (mirrored in each band, so no seam where the spiral wraps)
  return 0.5*exp(-w)*vec2(cos(a),sin(a));
}
vec3 kalCol(vec3 c){ if(abs(kalH)<0.001) return c; float a=kalH*6.2831853, ca=cos(a); vec3 k=vec3(0.5773503);   // a hue turn about the grey axis
  return max(c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.0-ca),0.0); }
vec2 kalUv(vec2 uv,vec2 asp){
  vec2 p=(uv-0.5)*asp-uKalC, f; float m=uKal2.x, n=uKal.x, ang=uKal.w, t=uKal3.x, as=uKal3.z; kalH=0.0;
  if(m>0.5&&m<1.5){
    float ca=cos(ang), sa=sin(ang), b=0.9/(n+uKal.y);   // more mirrors: a smaller box, more copies
    vec2 pr=vec2(ca*p.x+sa*p.y,-sa*p.x+ca*p.y);
    pr/=max(0.1,1.0-max(abs(pr.x),abs(pr.y))*uKal2.y);   // the hall: copies further out, further away
    f=kalBox(pr,b); f=vec2(ca*f.x-sa*f.y,sa*f.x+ca*f.y);
  } else if(m<2.5){
    f=kalF(p,n,ang);
    if(uKal.y>0.0) f=mix(f,kalF(p,n+1.0,ang),uKal.y);
    if(m>1.5){ float r=length(f)+1e-5, u=log(r/0.5)/uKal2.w-uKal2.z, v=abs(fract(u*0.5)*2.0-1.0);
      f*=0.5*exp((v-1.0)*uKal2.w)/r; }
  }
  else if(m<3.5) f=kalPin(p,n,ang);
  else if(m<4.5){ float i=kalI(p,n,ang), ph=t*2.2-i*6.2831853/n; f=kRot(kalF(p,n,ang),0.13*as*sin(ph))*(1.0+0.07*as*sin(ph+1.3)); }
  else if(m<5.5){ float i=kalI(p,n,ang); f=kalF(p,n,ang); if(mod(i+uKal3.y,2.0)>0.5){ f=-f; kalH=0.5*min(1.0,as); } }
  else if(m<6.5){ float i=kalI(p,n,ang); f=kalF(p,n,ang); if(abs(i-mod(uKal3.y,n))<0.5){ f=kRot(p,0.5*as)*0.85; kalH=0.06*as; } }
  else if(m<7.5){ float r=length(p), s=6.2831853/n, a=atan(p.y,p.x)-ang; a+=0.3*s*as*sin(a+1.7);
    float i=floor(mod(a,6.2831853)/s), aa=mod(a,s); aa=min(aa,s-aa)+(kH1(i)-0.5)*0.08*as; f=r*vec2(cos(aa+ang),sin(aa+ang)); }
  else if(m<8.5){ f=kalF(p,n,ang); kalH=kalI(p,n,ang)/n*0.6; }
  else if(m<9.5) f=kRot(kalTri(kRot(p,-ang),1.6/n),ang);
  else if(m<10.5) f=kalHyp(p,n,ang,0.46,0.22*as*vec2(sin(t*0.13),cos(t*0.17)));
  else if(m<11.5) f=kalF(kalDroste(p,uKal2.w,uKal2.z),n,ang);
  else if(m<12.5){ float r=length(p), b=(0.35+0.9*uKal3.w)*0.2*sin(r*7.0-t*1.5)*max(0.3,as); f=kRot(kalF(kRot(p,b),n,ang),-b); }
  else { vec2 c1=kRot(vec2(0.24*(0.55+0.45*sin(t*0.27))*max(0.4,as),0.0),t*0.11), cc=length(p-c1)<length(p+c1)?c1:-c1; f=kalF(p-cc,n,ang); }
  kalH*=uKal.z;
  vec2 q=(uKalC+mix(p,f,uKal.z))/asp+0.5;
  return 1.0-abs(1.0-mod(q,2.0));   // off the picture: mirrored back into it
}`;
export const FINISH = PREC + `varying vec2 vUv; uniform sampler2D uTex, uBloom, uKalM; uniform float uAmt, uKnee, uKalOn; uniform vec4 uKal, uKal2, uKal3; uniform vec2 uKalC, uAsp;
uniform vec2 uGl; uniform float uGrain, uT, uHush;   // the glitch (how much, which slicing), film grain, time; the breath held before a drop
vec3 pic(vec2 uv){ return texture2D(uTex,uv).rgb+texture2D(uBloom,uv).rgb*uAmt; }
${KAL}
void main(){
  vec2 uv=vUv;
  if(uKalOn>0.0){ float m=uKalOn>1.5?texture2D(uKalM,vUv).r:1.0; if(m>0.0){ uv=mix(vUv,kalUv(vUv,uAsp),m); kalH*=m; } }   // the whole picture, or inside the objects (2)
  // the glitch: bands of the picture jump sideways; with the grain, the colours split a little (a worn tape)
  if(uGl.x>0.0){ float row=floor(uv.y*22.0), h=fract(sin(row*12.9898+uGl.y*78.233)*43758.5453);
    if(h>0.5) uv.x=fract(uv.x+(h-0.75)*0.25*uGl.x); }
  float so=0.007*uGl.x+0.0022*uGrain;
  vec3 c=so>0.0?vec3(pic(uv+vec2(so,0.0)).r,pic(uv).g,pic(uv-vec2(so,0.0)).b):pic(uv);
  c=kalCol(c);   // (the colour kinds: each wedge's own hue)
  float m=max(c.r,max(c.g,c.b));
  if(m>uKnee){ float k=1.0-uKnee; c*=(uKnee+k*(1.0-exp(-(m-uKnee)/k)))/m; }   // roll off, keeping the colour
  if(uHush>0.0) c*=1.0-uHush*min(1.0,0.75+0.6*length(vUv-0.5));   // holding its breath before a drop: darker, most at the edges
  c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;   // dither
  if(uGrain>0.0){   // film grain and scan lines
    float n=fract(sin(dot(gl_FragCoord.xy+fract(uT*7.3)*vec2(113.0,71.0),vec2(12.9898,78.233)))*43758.5453);
    c+=(n-0.5)*0.14*uGrain*(0.4+max(c.r,max(c.g,c.b)));
    c*=1.0-0.12*uGrain*(0.5+0.5*sin(gl_FragCoord.y*2.0));
  }
  gl_FragColor=vec4(max(c,0.0),1.0);
}`;
export const PVERT = `attribute vec3 a; uniform vec2 uScale; uniform float uSize; varying float vB;
void main(){ vB=a.z; gl_Position=vec4(a.x*uScale.x,a.y*uScale.y,0.0,1.0); gl_PointSize=uSize; }`;
export const PFRAG = PREC + `varying float vB; uniform vec3 uCol;
void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(uCol*vB*smoothstep(0.5,0.0,d),1.0); }`;
