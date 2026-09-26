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
export const FINISH = PREC + `varying vec2 vUv; uniform sampler2D uTex, uBloom; uniform float uAmt, uKnee;
void main(){
  vec3 c=texture2D(uTex,vUv).rgb+texture2D(uBloom,vUv).rgb*uAmt;
  float m=max(c.r,max(c.g,c.b));
  if(m>uKnee){ float k=1.0-uKnee; c*=(uKnee+k*(1.0-exp(-(m-uKnee)/k)))/m; }   // roll off, keeping the colour
  c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;   // dither
  gl_FragColor=vec4(max(c,0.0),1.0);
}`;
export const PVERT = `attribute vec3 a; uniform vec2 uScale; uniform float uSize; varying float vB;
void main(){ vB=a.z; gl_Position=vec4(a.x*uScale.x,a.y*uScale.y,0.0,1.0); gl_PointSize=uSize; }`;
export const PFRAG = PREC + `varying float vB; uniform vec3 uCol;
void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(uCol*vB*smoothstep(0.5,0.0,d),1.0); }`;
