// Builds the shaders from the registry. A display segment: shared helpers, every visual's uniforms and functions, then
// main(), which runs the segment's items in stack order over what's below (black, or the picture so far).
import { PREC } from './shaders.js';
import { HIT_VISUALS, LAYER_VISUALS, VISUALS, WORLD_VISUALS } from '../visuals/registry.js';

// texture units the display segments use (1 history, 2 audio data, 3 media and 4 fills belong to others)
export const UNIT = {main: 0, group: 6, under: 7, mask: [5, 4]};
// one full-screen pass for a run of items: worlds, their front planes, trail groups (masked or not) and hits.
// c holds the picture so far; each item lays itself over it
export function composeSegment(seg, plan){
  const worlds = WORLD_VISUALS.map(v => `  if(uW_${v.key}>0.003) w+=${v.glsl.fn}(sp)*uW_${v.key};`).join('\n');
  const fronts = WORLD_VISUALS.filter(v => v.front).map(v => `  if(uW_${v.key}>0.003) fc=max(fc,${v.front.fn}(sp)*min(uW_${v.key},1.0));`).join('\n');
  const hits = HIT_VISUALS.filter(v => v.glsl).map(v => v.glsl.draw.replace(/^\n/, '')).join('\n');
  const groups = [...new Set(seg.seg.filter(it => it.t === 'trails').map(it => it.g))];
  const needW = seg.seg.some(it => it.t === 'world' || it.t === 'front');
  const body = seg.seg.map(it => {
    const k = it.drive ? `*uK${it.i}` : '';   // a weight that follows a signal
    if (it.t === 'world') return `  c+=w${k};   // worlds sit behind what comes after, drawn crisp every frame instead of smeared by the trails`;
    if (it.t === 'front') return `  c=mix(c,w,frontCov(sp)${k});   // the worlds' front planes repaint their own colour over what's below`;
    if (it.t === 'hits') return '  // hits: crisp, with a small halo of glow\n' + hits;
    const tex = `uT_${it.g}`, m = it.mask;   // sampled at uv: the whole screen, or shrunk into a fill
    const mask = !m ? '' : m.world ? `    { float m=frontCov(sp); t*=mix(1.0-m,m,${m.inside ? '1.0' : '0.0'}); }\n`
      : `    { float m=texture2D(uMask${plan.masks.indexOf(m.object)},vUv).r; t*=mix(1.0-m,m,${m.inside ? '1.0' : '0.0'}); }\n`;
    return `  {                                     // trails (${it.g}): softened a little, lit by the kick, dimming what's below where bright
    vec3 t=texture2D(${tex},uv).rgb;
    vec3 b=(texture2D(${tex},uv+vec2(px.x,0.0)).rgb+texture2D(${tex},uv-vec2(px.x,0.0)).rgb
           +texture2D(${tex},uv+vec2(0.0,px.y)).rgb+texture2D(${tex},uv-vec2(0.0,px.y)).rgb)*0.25;
    t+=b*0.35;
    t*=1.0+uBeat*0.6;   // the kick flashes here, after the trails, so the brightest moment lands on the kick
${mask}${k ? `    t${k.replace('*', '*=')};\n` : ''}    c=c*(1.0-0.4*clamp(max(t.r,max(t.g,t.b)),0.0,1.0))+t;
  }`;
  }).join('\n');
  return PREC + `
varying vec2 vUv;
uniform sampler2D uHist, uUnder, uMask0, uMask1; uniform vec2 uRes;
${groups.map(g => `uniform sampler2D uT_${g};`).join('\n')}
${seg.seg.filter(it => it.drive).map(it => `uniform float uK${it.i};`).join('\n')}
uniform float uTime,uHue,uBass,uMid,uBeat,uReact,uSpZ,uGain; uniform vec3 uPal;   // the palette: three hue offsets   // shrinks and brightens the picture (for one filling an object)
uniform sampler2D uData;   // waveform and spectrum
${WORLD_VISUALS.map(v => `uniform float uW_${v.key};`).join('\n')}
${VISUALS.filter(v => v.glsl && v.glsl.uniforms).map(v => v.glsl.uniforms).join('\n')}
float ASP;
float specD(float t){ return texture2D(uData, vec2(0.502+clamp(t,0.0,1.0)*0.497,0.5)).r; }
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
${VISUALS.filter(v => v.glsl && v.glsl.functions).map(v => v.glsl.functions.replace(/^\n/, '')).join('\n')}
${WORLD_VISUALS.filter(v => v.front).map(v => v.front.glsl.replace(/^\n/, '')).join('\n')}
float frontCov(vec2 sp){ float fc=0.0;
${fronts}
  return fc; }
void main(){
  ASP=uRes.x/uRes.y;
  vec2 sp=(vUv-0.5)*vec2(ASP,1.0)*max(uSpZ,1.0), uv=${seg.fill ? '(vUv-0.5)*uSpZ+0.5' : 'vUv'};
  vec2 px=3.0/uRes;
  vec3 c=${seg.first ? 'vec3(0.0)' : 'texture2D(uUnder,vUv).rgb'};
${needW ? '  vec3 w=vec3(0.0);\n' + worlds : ''}
${body}
${seg.last ? '  c*=smoothstep(1.15,0.35,length(vUv-0.5));' : ''}${seg.fill ? '  c*=uGain;' : ''}
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
uniform vec3 uPal; uniform vec2 uDrift;   // the palette's three hue offsets; the wind's push on the trails this frame
uniform vec2 uSoft; uniform float uFloor;   // how far the last frame is softened as it's read (so fast shapes smear), and what it loses
uniform float uFillMode,uFillGain,uFillZoom;   // 1: draw a fill instead (the chosen layers alone, through the kaleidoscope, no trails)
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
  q-=uDrift;   // the trails stream downwind
  vec2 uv=(q+uCenter)/vec2(ASP,1.0)+0.5;
  uv=1.0-abs(1.0-mod(uv,2.0));
  return (texture2D(uPrev,uv+uSoft)+texture2D(uPrev,uv-uSoft)+texture2D(uPrev,uv+vec2(uSoft.x,-uSoft.y))+texture2D(uPrev,uv+vec2(-uSoft.x,uSoft.y))).rgb*0.25;
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
  bool fill=uFillMode>0.5;   // a fill: the chosen layers alone, smaller, with no trails, brought up to trail brightness
  if(fill) sp*=uFillZoom;
  vec2 disp=vec2(0.0);
${displace}
  vec2 p=sp-uCenter;
  float sym=max(uSym,1.0), n1=floor(sym), fr=sym-n1;

  // feedback: last frame, transformed; symmetry crossfades between fold counts
  vec2 pf=p+disp*0.3;
  vec3 col=vec3(0.0);
  if(!fill){
    col=sampleFb(pf,n1);
    if(fr>0.002) col=mix(col,sampleFb(pf,n1+1.0),fr);
    col=hueRot(col,uHueShift);
    col=max(col*uDecay-uFloor,0.0);
    col-=0.16*col*col;
  }

  vec2 pe=p+disp, pb=sp-uBurstC+disp;
  vec3 e=elements(pe,pb,n1);
  if(fr>0.002) e=mix(e,elements(pe,pb,n1+1.0),fr);
  col+=e*(fill ? uFillGain*(0.6+uBeat*0.4) : 0.35+uTreb*uReact*0.5+uHit*0.5);   // no kick boost in the trails: it would build up and peak late
${main}
  gl_FragColor=vec4(min(col,vec3(1.0)),1.0);
}`;
}
