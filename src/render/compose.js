// Builds the shaders from the registry. A display segment: shared helpers, every visual's uniforms and functions, then
// main(), which runs the segment's items in stack order over what's below (black, or the picture so far).
import { KAL, PREC } from './shaders.js';
import { HIT_VISUALS, VISUALS, WORLD_VISUALS } from '../visuals/registry.js';

// texture units the display segments use (1 history, 2 audio data, 3 media and 4 fills belong to others)
export const UNIT = {main: 0, group: [6, 3], under: 7, mask: [5, 4], low: 8};   // 3 (media) is free in a segment; low only where there are more than 8
// one full-screen pass for a run of items: worlds, their front planes, trail groups (masked or not) and hits.
// c holds the picture so far; each item lays itself over it
// wk: the worlds whose code it holds (those drawing now; the cosmos alone is bigger than the rest together), or all of them
export function composeSegment(seg, plan, wk){
  const WV = WORLD_VISUALS.filter(v => !wk || wk.includes(v.key));
  // a world that draws at its own lower resolution (lowRes: the cosmos's ground) is read from that picture instead (uLow)
  // a heavy world drawn in its own pass ('cosmos~' in wk) is only read back here: its code (the cosmos's is 40 KB) isn't in
  // this shader at all, so a new run with it in is quick to build
  const RO = WORLD_VISUALS.filter(v => wk && wk.includes(v.key + '~'));
  const worlds = WV.map(v => `  if(uW_${v.key}>0.003) w+=${v.lowRes ? `(uLow>0.5?texture2D(uLowT,wuv).rgb:${v.glsl.fn}(wsp))` : `${v.glsl.fn}(wsp)`}*uW_${v.key};`)
    .concat(RO.map(v => `  if(uW_${v.key}>0.003&&uLow>0.5) w+=texture2D(uLowT,wuv).rgb*uW_${v.key};`)).join('\n');
  const fronts = WV.filter(v => v.front).map(v => `  if(uW_${v.key}>0.003) fc=max(fc,${v.front.fn}(sp)*min(uW_${v.key},1.0));`).join('\n');
  const hits = HIT_VISUALS.filter(v => v.glsl).map(v => v.glsl.draw.replace(/^\n/, '')).join('\n');
  const groups = [...new Set([...seg.seg.filter(it => it.t === 'trails').map(it => it.g), ...(seg.only ? ['main'] : [])])];   // (a world drawn alone still reads the main trails, for the glow on its walls)
  const needW = seg.seg.some(it => it.t === 'world');
  const body = seg.seg.map(it => {
    const k = it.drive ? `*uK${it.i}` : '';   // a weight that follows a signal
    if (it.t === 'world') return `  c+=w${k};   // worlds sit behind what comes after, drawn crisp every frame instead of smeared by the trails`;
    // the worlds' front planes repaint their own colour over what's below. With no whole world in this segment (an object
    // stands between the planes), the worlds are worked out only where a front covers the pixel: elsewhere mix(c,w,0) is c
    if (it.t === 'front') return needW ? `  c=mix(c,w,frontCov(wsp)${k});`
      : `  { float fcv=frontCov(wsp)${k}; if(fcv!=0.0){ vec3 w=vec3(0.0);\n${worlds}\n    c=mix(c,w,fcv); } }`;
    if (it.t === 'hits') return '  // hits: crisp, with a small halo of glow\n' + hits;
    const tex = `uT_${it.g}`, m = it.mask;   // sampled at uv: the whole screen, or shrunk into a fill
    const j = m && !m.world ? plan.masks.indexOf(m.object) : -1;   // an object's mask applies only while it's on screen (uMaskOn)
    // the mask's share, worked out first: where it (or a driven weight) is 0 the group adds nothing and dims nothing, so
    // its texture isn't read there
    const mf = !m ? '' : m.world ? `    float m=${m.inside ? '(uFrontOn>0.0?mix(1.0,frontCov(wsp),uFrontOn):1.0)' : 'frontCov(wsp)'}, mf=mix(1.0-m,m,${m.inside ? '1.0' : '0.0'});\n`   // (inside a front that isn't on screen: all of it)
      : `    float m=texture2D(uMask${j},vUv).r, mf=mix(1.0,mix(1.0-m,m,${m.inside ? '1.0' : '0.0'}),uMaskOn${j});\n`;
    const skip = [m && 'mf!=0.0', k && `uK${it.i}!=0.0`].filter(Boolean).join('&&');
    const at = it.fit ? 'fuv' : 'tuv';   // fit: shrunk round the world's subject, the glow's centre landing on it
    return `  {                                     // trails (${it.g}): softened a little, lit by the kick, dimming what's below where bright
${mf}${skip ? `    if(${skip}){\n` : ''}${it.fit ? '    vec2 fuv=(uFitSrc+(tsp-uFit.xy)*uFit.z)/vec2(ASP,1.0)+0.5;\n' : ''}    vec3 t=texture2D(${tex},${at}).rgb;
    vec3 b=(texture2D(${tex},${at}+vec2(px.x,0.0)).rgb+texture2D(${tex},${at}-vec2(px.x,0.0)).rgb
           +texture2D(${tex},${at}+vec2(0.0,px.y)).rgb+texture2D(${tex},${at}-vec2(0.0,px.y)).rgb)*0.25;
    t+=b*0.35;
    t*=1.0+uBeat*0.6;   // the kick flashes here, after the trails, so the brightest moment lands on the kick
${m ? '    t*=mf;\n' : ''}${k ? `    t${k.replace('*', '*=')};\n` : ''}    c=c*(1.0-0.4*clamp(max(t.r,max(t.g,t.b)),0.0,1.0))+t;
${skip ? '    }\n' : ''}  }`;
  }).join('\n');
  return PREC + `
varying vec2 vUv;
uniform sampler2D uHist, uUnder, uMask0, uMask1; uniform vec2 uRes; uniform float uMaskOn0, uMaskOn1, uFrontOn;
uniform sampler2D uLowT; uniform float uLow;   // a world drawn at its own lower resolution this frame, and whether to read it
uniform vec4 uKal, uKal2; uniform vec2 uKalC; uniform float uKalW, uKalT;   // the kaleidoscope, folding the worlds (uKalW) or the glow (uKalT)
uniform vec3 uFit; uniform vec2 uFitSrc;   // fitting a trail group into a world's subject: where, how much smaller; the glow's centre
${groups.map(g => `uniform sampler2D uT_${g};`).join('\n')}
${groups.includes('main') ? '#define HAS_MAIN 1' : ''}
${seg.seg.filter(it => it.drive).map(it => `uniform float uK${it.i};`).join('\n')}
uniform float uTime,uHue,uBass,uMid,uBeat,uReact,uSpZ,uGain; uniform vec3 uPal;   // the palette: three hue offsets   // shrinks and brightens the picture (for one filling an object)
uniform sampler2D uData;   // waveform and spectrum
${WORLD_VISUALS.map(v => `uniform float uW_${v.key};`).join('\n')}
${VISUALS.filter(v => v.glsl && v.glsl.uniforms && (v.kind !== 'world' || WV.includes(v))).map(v => v.glsl.uniforms).join('\n')}
float ASP;
${KAL}
float specD(float t){ return texture2D(uData, vec2(0.502+clamp(t,0.0,1.0)*0.497,0.5)).r; }
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
// the painted worlds' paper (sea, deep, forest): value noise, and the fibres of the paper each cut layer is made of
float vnz(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }
float paper(vec2 sp){ return 0.93+0.05*vnz(sp*vec2(90.0,260.0))+0.03*vnz(sp*420.0); }
// motes floating in a 3D world (the Hollow's spores, the Cathedral's dust): one in each cell of a grid, found along the view
// ray up to tmax (so the rock hides those behind it), each a soft point a few pixels wide, twinkling (sparkle), dimmer far
// off; drift moves them all (world units); shaft (x and z periods) gathers them into columns of light where it's set
// the glowing layers' picture (the main trails), wrapped onto a 3D world's walls: tiled mirrored, so it has no seams; black
// where this pass doesn't draw the trails
vec3 wallGlow(vec2 uv){
#ifdef HAS_MAIN
  return texture2D(uT_main,abs(fract(uv*0.5)*2.0-1.0)).rgb;
#else
  return vec3(0.0);
#endif
}
float motes(vec3 ro,vec3 rd,float tmax,float cell,vec3 drift,float size,float sparkle,vec2 shaft){
  float g=0.0, dt=cell*0.34;
  for(int i=0;i<30;i++){
    float t=0.25+float(i)*dt; if(t>tmax) break;
    vec3 c=floor((ro+rd*t+drift)/cell);
    vec3 h=fract(sin(vec3(dot(c,vec3(127.1,311.7,74.7)),dot(c,vec3(269.5,183.3,246.1)),dot(c,vec3(113.5,271.9,124.6))))*43758.5453);
    vec3 m=(c+h)*cell-drift; float along=dot(m-ro,rd);
    if(abs(along-t)>dt*0.5||along>tmax||along<0.2) continue;   // (each counted once, from the sample nearest it)
    float d=length(cross(m-ro,rd)), r=max(0.011,size*along),   // (near ones bigger and soft, like lights out of focus; far ones a few pixels)
      w=(0.25+0.75*step(0.55,h.z))*(1.0-sparkle+sparkle*(0.5+0.5*sin(uTime*(3.0+h.x*7.0)+h.y*40.0)));
    if(shaft.x>0.0){ vec2 q=vec2(mod(m.x+shaft.x*0.5,shaft.x)-shaft.x*0.5,mod(m.z,shaft.y)-shaft.y*0.5); w*=0.15+exp(-dot(q,q)*1.8); }
    g+=exp(-d*d/(r*r))*w/(1.0+along*0.2);
  }
  return g;
}
${VISUALS.filter(v => v.glsl && v.glsl.functions && (v.kind !== 'world' || WV.includes(v))).map(v => v.glsl.functions.replace(/^\n/, '')).join('\n')}
${WV.filter(v => v.front).map(v => v.front.glsl.replace(/^\n/, '')).join('\n')}
float frontCov(vec2 sp){ float fc=0.0;
${fronts}
  return fc; }
void main(){
  ASP=uRes.x/uRes.y;
  vec2 sp=(vUv-0.5)*vec2(ASP,1.0)*max(uSpZ,1.0), uv=${seg.fill ? '(vUv-0.5)*uSpZ+0.5' : 'vUv'};
  vec2 px=3.0/uRes;
  // the kaleidoscope: the worlds (and their fronts) or the trails read from the folded place
  vec2 kuv=uKalW+uKalT>0.0?kalUv(vUv,vec2(ASP,1.0)):vUv, ksp=(kuv-0.5)*vec2(ASP,1.0);
  vec2 wuv=uKalW>0.0?kuv:vUv, wsp=uKalW>0.0?ksp:sp, tuv=uKalT>0.0?kuv:uv, tsp=uKalT>0.0?ksp:sp;
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
// keys: build it from just these visuals (the ones drawing now), or from every one when left out
export const FB_VISUALS = VISUALS.filter(v => v.feedback);
export function composeFeedback(keys){
  // every visual's code runs only while it has weight: most are off at any moment, and this shader runs for every pixel of
  // every trail group (a layer's weight is uL_<key>; a hit drawn in the trails names its own, fbWeight)
  const fbv = FB_VISUALS.filter(v => !keys || keys.has(v.key)), wt = v => v.fbWeight || 'uL_' + v.key;
  // a layer's own speed, size and sound (scene/tweaks.js): its code reads its own clock and levels (uTw_<key>: time, bass,
  // mids, treble), and sees the picture's coordinates scaled round the centre (uSz_<key>). Untweaked they're the shared ones
  const own = (v, code) => v.kind !== 'layer' ? code : code.replace(/\buTime\b/g, `uTw_${v.key}.x`).replace(/\buBass\b/g, `uTw_${v.key}.y`)
    .replace(/\buMid\b/g, `uTw_${v.key}.z`).replace(/\buTreb\b/g, `uTw_${v.key}.w`);
  // and its dance (scene/dance.js): turned, shifted and scaled round the centre (uDn_<key>: turn, x, y; uSz_<key> the scale)
  const sized = (v, k) => v.kind !== 'layer' ? '' : k === 'main'
    ? `    vec2 sp=uSz_${v.key}==1.0&&uDn_${v.key}==vec3(0.0)?sp:uCenter+dnT(sp-uCenter,uDn_${v.key},uSz_${v.key}), p=dnT(p,uDn_${v.key},uSz_${v.key}), pe=dnT(pe,uDn_${v.key},uSz_${v.key}), pb=dnT(pb,uDn_${v.key},uSz_${v.key});\n`
    : `    vec2 d=dnT(d,uDn_${v.key},uSz_${v.key}), p=dnT(p,uDn_${v.key},uSz_${v.key}), pb=dnT(pb,uDn_${v.key},uSz_${v.key}); float r=length(d);\n`;
  const guard = (v, code, k) => `  if(${wt(v)}>0.003){\n${sized(v, k)}${own(v, code).replace(/^\n/, '')}\n  }`;
  const part = (k, sep = '\n') => fbv.filter(v => v.feedback[k]).map(v => k === 'uniforms' ? v.feedback[k].replace(/^\n/, '') : k === 'functions' ? own(v, v.feedback[k]).replace(/^\n/, '') : guard(v, v.feedback[k], k)).join(sep);
  const layers = fbv.filter(v => v.kind === 'layer');
  const main = fbv.filter(v => v.feedback.main).sort((a, b) => a.paint - b.paint).map(v => guard(v, v.feedback.main, 'main')).join('\n');
  const displace = fbv.filter(v => v.feedback.displace).map(v => `  if(${wt(v)}>0.003) disp+=${v.feedback.displace};`).join('\n');
  return PREC + `
varying vec2 vUv;
uniform sampler2D uPrev, uData;
uniform vec2 uRes, uCenter, uBurstC;
uniform float uTime,uZoom,uRot,uWarp,uDecay,uSym,uMirror,uHue,uHueShift,uBass,uMid,uTreb,uBeat,uReact,uHit;
uniform vec3 uPal; uniform vec2 uDrift;   // the palette's three hue offsets; the wind's push on the trails this frame
uniform vec2 uSoft; uniform float uFloor;   // how far the last frame is softened as it's read (so fast shapes smear), and what it loses
uniform float uFillMode,uFillGain,uFillZoom;   // 1: draw a fill instead (the chosen layers alone, through the kaleidoscope, no trails)
${layers.map(v => `uniform float uL_${v.key}; uniform vec4 uTw_${v.key}; uniform float uSz_${v.key}; uniform vec3 uDn_${v.key};`).join('\n')}
${part('uniforms')}
float ASP;

float wave(float t){ return texture2D(uData, vec2(0.001+clamp(t,0.0,1.0)*0.497,0.5)).r*2.0-1.0; }
float spec(float t){ return texture2D(uData, vec2(0.502+clamp(t,0.0,1.0)*0.497,0.5)).r; }
vec3 hsv(float h,float s,float v){ vec3 p=abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
vec2 dnT(vec2 q,vec3 dn,float s){ float c=cos(dn.x), si=sin(dn.x); return mat2(c,-si,si,c)*(q-dn.yz)/s; }   // a layer's dance, undone on the coordinates it reads
vec3 hueRot(vec3 c,float a){ vec3 k=vec3(0.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.0-ca); }
vec2 fold(vec2 p,float n){
  if(n<1.5) return p;
  float r=length(p), a=atan(p.y,p.x), seg=6.2831853/n;
  a=mod(a,seg); a=abs(a-seg*0.5);
  return r*vec2(cos(a),sin(a));
}
${part('functions')}
vec3 sampleFb(vec2 p,float n){
  vec2 q=uMirror>0.0?mix(p,fold(p,n),uMirror):p;   // (mirror off: the fold count doesn't touch the trails)
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
    if(fr>0.002&&uMirror>0.0) col=mix(col,sampleFb(pf,n1+1.0),fr);   // (with mirror off both fold counts read the same)
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
