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
// the kaleidoscope's fold (a point round the centre into one mirrored wedge, n of them), shared with the segments
export const KAL = `vec2 kalF(vec2 p,float n,float ang){ float r=length(p), s=6.2831853/n, a=mod(atan(p.y,p.x)-ang,s); a=min(a,s-a)+ang; return r*vec2(cos(a),sin(a)); }
vec2 kalUv(vec2 uv,vec2 asp){   // uKal: mirrors, the share of one more (easing between counts), how far folded, turn
  vec2 p=(uv-0.5)*asp-uKalC, f=kalF(p,uKal.x,uKal.w);
  if(uKal.y>0.0) f=mix(f,kalF(p,uKal.x+1.0,uKal.w),uKal.y);
  vec2 q=(uKalC+mix(p,f,uKal.z))/asp+0.5;
  return 1.0-abs(1.0-mod(q,2.0));   // off the picture: mirrored back into it
}`;
export const FINISH = PREC + `varying vec2 vUv; uniform sampler2D uTex, uBloom, uKalM; uniform float uAmt, uKnee, uKalOn; uniform vec4 uKal; uniform vec2 uKalC, uAsp;
uniform vec2 uGl; uniform float uGrain, uT;   // the glitch (how much, which slicing), film grain, time
vec3 pic(vec2 uv){ return texture2D(uTex,uv).rgb+texture2D(uBloom,uv).rgb*uAmt; }
${KAL}
void main(){
  vec2 uv=vUv;
  if(uKalOn>0.0){ float m=uKalOn>1.5?texture2D(uKalM,vUv).r:1.0; if(m>0.0) uv=mix(vUv,kalUv(vUv,uAsp),m); }   // the whole picture, or inside the objects (2)
  // the glitch: bands of the picture jump sideways; with the grain, the colours split a little (a worn tape)
  if(uGl.x>0.0){ float row=floor(uv.y*22.0), h=fract(sin(row*12.9898+uGl.y*78.233)*43758.5453);
    if(h>0.5) uv.x=fract(uv.x+(h-0.75)*0.25*uGl.x); }
  float so=0.007*uGl.x+0.0022*uGrain;
  vec3 c=so>0.0?vec3(pic(uv+vec2(so,0.0)).r,pic(uv).g,pic(uv-vec2(so,0.0)).b):pic(uv);
  float m=max(c.r,max(c.g,c.b));
  if(m>uKnee){ float k=1.0-uKnee; c*=(uKnee+k*(1.0-exp(-(m-uKnee)/k)))/m; }   // roll off, keeping the colour
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
