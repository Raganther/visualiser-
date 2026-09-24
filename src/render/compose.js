// Builds both shaders from the registry. The display shader: shared helpers, then each visual's uniforms and functions,
// then main(), which lays the worlds behind the glow, the objects in front of it and the hits on top.
import { PREC } from './shaders.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS } from '../visuals/registry.js';

export function composeDisplay(){
  const worlds = WORLD_VISUALS.map(v => `  if(uW_${v.key}>0.003) w+=${v.glsl.fn}(sp)*uW_${v.key};`).join('\n');
  // an object returns premultiplied colour and coverage; it covers what's behind it
  const objects = OBJECT_VISUALS.map(v => `  if(uO_${v.key}>0.003){ vec4 ob=${v.glsl.fn}(sp); c=c*(1.0-ob.a*uO_${v.key})+ob.rgb*uO_${v.key}; }`).join('\n');
  const hits = HIT_VISUALS.filter(v => v.glsl).map(v => v.glsl.draw.replace(/^\n/, '')).join('\n');
  return PREC + `
varying vec2 vUv;
uniform sampler2D uTex, uHist; uniform vec2 uRes;
uniform float uTime,uHue,uBass,uMid,uBeat,uReact;
uniform sampler2D uData;   // waveform and spectrum
${WORLD_VISUALS.map(v => `uniform float uW_${v.key};`).join('\n')}
${OBJECT_VISUALS.map(v => `uniform float uO_${v.key};`).join('\n')}
${VISUALS.filter(v => v.glsl && v.glsl.uniforms).map(v => v.glsl.uniforms).join('\n')}
float ASP;
float specD(float t){ return texture2D(uData, vec2(0.502+clamp(t,0.0,1.0)*0.497,0.5)).r; }
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
${VISUALS.filter(v => v.glsl && v.glsl.functions).map(v => v.glsl.functions.replace(/^\n/, '')).join('\n')}
void main(){
  ASP=uRes.x/uRes.y;
  vec2 sp=(vUv-0.5)*vec2(ASP,1.0);
  vec2 px=3.0/uRes;
  vec3 c=texture2D(uTex,vUv).rgb;
  vec3 b=(texture2D(uTex,vUv+vec2(px.x,0.0)).rgb+texture2D(uTex,vUv-vec2(px.x,0.0)).rgb
         +texture2D(uTex,vUv+vec2(0.0,px.y)).rgb+texture2D(uTex,vUv-vec2(0.0,px.y)).rgb)*0.25;
  c+=b*0.35;
  // the kick flashes here, after the trails, so the brightest moment lands on the kick instead of building up after it
  c*=1.0+uBeat*0.6;
  // worlds sit behind the glow, drawn crisp every frame instead of smeared by the trails
  vec3 w=vec3(0.0);
${worlds}
  c=w*(1.0-0.4*clamp(max(c.r,max(c.g,c.b)),0.0,1.0))+c;
  // objects stand in front of the world and the glow, solid and crisp
${objects}
  // hits sit on top, crisp, with a small halo of glow
${hits}
  c*=smoothstep(1.15,0.35,length(vUv-0.5));
  gl_FragColor=vec4(c,1.0);
}`;
}

// The feedback pass: last frame zoomed, spun, warped and faded, with the layers drawn on top. Layers slot in by role:
// glow (adds to the shared brightness g, coloured by one gradient), folded (own colour, inside the kaleidoscope fold),
// main (drawn over everything, in paint order), displace (pushes where everything is sampled, like shockwaves).
export function composeFeedback(){
  const fb = VISUALS.filter(v => v.feedback).map(v => v.feedback);
  const part = (k, sep = '\n') => fb.filter(f => f[k]).map(f => f[k].replace(/^\n/, '')).join(sep);
  const layers = LAYER_VISUALS.filter(v => v.feedback);
  const main = VISUALS.filter(v => v.feedback && v.feedback.main).sort((a, b) => a.paint - b.paint)
    .map(v => v.feedback.main.replace(/^\n/, '')).join('\n');
  const displace = fb.filter(f => f.displace).map(f => `  disp+=${f.displace};`).join('\n');
  return PREC + `
varying vec2 vUv;
uniform sampler2D uPrev, uData;
uniform vec2 uRes, uCenter, uBurstC;
uniform float uTime,uZoom,uRot,uWarp,uDecay,uSym,uMirror,uHue,uHueShift,uBass,uMid,uTreb,uBeat,uReact,uHit;
${layers.map(v => `uniform float uL_${v.key};`).join('\n')}
${part('uniforms')}
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
${part('functions')}
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
vec3 elements(vec2 p,vec2 pb,float n){
  vec2 d=fold(p,n);
  float r=length(d), at=abs(atan(d.y,d.x))/3.14159265;
  float g=0.0;
${part('glow')}
  vec3 col=hsv(uHue+r*0.35+at*0.15,0.85,1.0)*g;
${part('folded')}
  return col;
}
void main(){
  ASP=uRes.x/uRes.y;
  vec2 sp=(vUv-0.5)*vec2(ASP,1.0);
  vec2 disp=vec2(0.0);
${displace}
  vec2 p=sp-uCenter;
  float sym=max(uSym,1.0), n1=floor(sym), fr=sym-n1;

  // feedback: last frame, transformed; symmetry crossfades between fold counts
  vec2 pf=p+disp*0.3;
  vec3 col=sampleFb(pf,n1);
  if(fr>0.002) col=mix(col,sampleFb(pf,n1+1.0),fr);
  col=hueRot(col,uHueShift);
  col=max(col*uDecay-0.004,0.0);
  col-=0.16*col*col;

  vec2 pe=p+disp, pb=sp-uBurstC+disp;
  vec3 e=elements(pe,pb,n1);
  if(fr>0.002) e=mix(e,elements(pe,pb,n1+1.0),fr);
  col+=e*(0.35+uTreb*uReact*0.5+uHit*0.5);   // no kick boost here: in the trails it would build up and peak late
${main}
  gl_FragColor=vec4(min(col,vec3(1.0)),1.0);
}`;
}
