// Builds the display shader from the registry: shared helpers, then each visual's uniforms and functions,
// then main(), which lays the worlds behind the glow and the hits on top of it.
import { PREC } from './shaders.js';
import { HIT_VISUALS, VISUALS, WORLD_VISUALS } from '../visuals/registry.js';

export function composeDisplay(){
  const worlds = WORLD_VISUALS.map(v => `  if(uW_${v.key}>0.003) w+=${v.glsl.fn}(sp)*uW_${v.key};`).join('\n');
  const hits = HIT_VISUALS.filter(v => v.glsl).map(v => v.glsl.draw.replace(/^\n/, '')).join('\n');
  return PREC + `
varying vec2 vUv;
uniform sampler2D uTex, uHist; uniform vec2 uRes;
uniform float uTime,uHue,uBass,uMid,uBeat,uReact;
uniform sampler2D uData;   // waveform and spectrum
${WORLD_VISUALS.map(v => `uniform float uW_${v.key};`).join('\n')}
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
  // worlds sit behind the glow, drawn crisp every frame instead of smeared by the trails
  vec3 w=vec3(0.0);
${worlds}
  c=w*(1.0-0.4*clamp(max(c.r,max(c.g,c.b)),0.0,1.0))+c;
  // hits sit on top, crisp, with a small halo of glow
${hits}
  c*=smoothstep(1.15,0.35,length(vUv-0.5));
  gl_FragColor=vec4(c,1.0);
}`;
}
