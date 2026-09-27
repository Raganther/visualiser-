// On a planet's surface: terrain the camera flies through, under a sky lit by the system's own star. The ground is ridged
// mountains stepped into strata (ledges and cliffs), with a river valley winding through them whose floor is flat by
// construction, so the camera can fly it safely. Each kind of world has its own ground: layered rock, smooth snow and
// ice, black basalt with lava glowing in the valleys, green land with the sea in the valleys. The sky follows the sun's
// height (day, dusk, night), with clouds, and at night stars, auroras over ice worlds and cities' lights in the valleys.
// SF is the surface camera's state (fly.js moves it); GLSL is its shader; sfH is the height, the same in simple mode.
import { TUNE } from '../../../tuning.js';

export const SF = {amt: 0, want: 0, body: null, pos: [0, 60, 0], look: [0, 60, 10], X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1], fov: 62,
  z: 0, alt: 60, altTo: 60, sun: .25, sunTo: .25, sunDir: [0, .25, 1], mode: 'valley', t: 0, seed: 0, kind: 0, haze: 0, dive: 0, hold: 0, phase: null};

// the river's line across the ground (x at each z), and a seeded value noise (simple mode's; the shader has its own)
export const sfPath = (z, sd) => 18*Math.sin(z*.021 + sd) + 9*Math.sin(z*.057 + sd*2);
const hash = (x, y, s) => { const h = Math.sin(x*127.1 + y*311.7 + s*74.7)*43758.5453; return h - Math.floor(h); };
function vnoise(x, y, s){
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx*fx*(3 - 2*fx); fy = fy*fy*(3 - 2*fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a)*fx + (c - a)*fy + (a - b - c + d)*fx*fy;
}
// the ground's height at (x, z): ridged crests, strata on rocky worlds, the valley carved along the river's line
export function sfH(x, z, kind, sd){
  const v = Math.abs(x - sfPath(z, sd)); let m = 0, a = 1, f = .012, qx = x, qz = z;
  for (let i = 0; i < 4; i++) { m += a*(1 - Math.abs(vnoise(qx*f, qz*f, sd)*2 - 1)); a *= .5; f *= 2.1; qx += 13.1; qz += 7.7; }
  m = m*m*(kind === 2 ? 26 : kind === 3 ? 22 : 38);
  if (kind === 0 || kind === 4) { const st = 6; m = Math.floor(m/st)*st + st*sstep(.15, .55, m/st - Math.floor(m/st)); }
  return m*sstep(6, 45, v) - (v < 6 ? 1.5 : 0);
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };

export const GLSL = {
  uniforms: `uniform float uSurf, uSfHaze; uniform vec3 uSfEye, uSfX, uSfY, uSfZ, uSfSun; uniform float uSfTan;   // the surface: how far landed, the whiteout of the clouds between; its camera; the sun's direction
uniform vec4 uSfK, uSfE;   // the world: kind, seed, hue, water level; cities, aurora, cloud cover, night (0 day .. 1 night)`,
  functions: `
float sfPath(float z){ return 18.0*sin(z*0.021+uSfK.y)+9.0*sin(z*0.057+uSfK.y*2.0); }
float sfN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=czH(vec3(i,uSfK.y)), b=czH(vec3(i+vec2(1.0,0.0),uSfK.y)), c=czH(vec3(i+vec2(0.0,1.0),uSfK.y)), d=czH(vec3(i+vec2(1.0,1.0),uSfK.y));
  return a+(b-a)*f.x+(c-a)*f.y+(a-b-c+d)*f.x*f.y; }
// the ground's height: ridged crests, strata stepping rocky worlds into ledges and cliffs, the valley along the river's line
float sfH(vec2 p){
  float v=abs(p.x-sfPath(p.y)), m=0.0, a=1.0, f=0.012; vec2 q=p;
  for(int i=0;i<4;i++){ m+=a*(1.0-abs(sfN(q*f)*2.0-1.0)); a*=0.5; f*=2.1; q+=vec2(13.1,7.7); }
  m=m*m*(uSfK.x>1.5&&uSfK.x<2.5?26.0:uSfK.x>2.5&&uSfK.x<3.5?22.0:38.0);
  if(uSfK.x<0.5||uSfK.x>3.5){ float st=6.0; m=floor(m/st)*st+st*smoothstep(0.15,0.55,fract(m/st)); }
  return m*smoothstep(6.0,45.0,v)-(v<6.0?1.5:0.0);
}
// the sky from below: its colour by the sun's height (blue by day, red at dusk, dark at night), the sun and its glow,
// clouds, and at night the stars and, over ice worlds, auroras
vec3 sfSky(vec3 rd,vec3 ro){
  float e=uSfSun.y, mu=dot(rd,uSfSun), day=smoothstep(-0.12,0.25,e), dusk=exp(-abs(e-0.02)*9.0);
  vec3 zen=hsv((uHue+uSfK.z)+0.58,0.65,0.55)*day, hor=mix(hsv((uHue+uSfK.z)+0.56,0.35,0.95)*day,vec3(1.0,0.42,0.18),dusk*0.8)+vec3(0.02,0.03,0.06);
  vec3 col=mix(hor,zen,smoothstep(-0.02,0.45,rd.y));
  col+=uCosSunC*(pow(max(mu,0.0),900.0)*8.0+pow(max(mu,0.0),24.0)*0.35*(0.4+dusk)+pow(max(mu,0.0),4.0)*0.12*dusk);
  float night=uSfE.w;
  if(rd.y>0.0){ vec3 g=rd*160.0; float s=step(0.975,czH(floor(g)))*smoothstep(0.35,0.0,length(fract(g)-0.5)); col+=vec3(0.9,0.92,1.0)*s*night*rd.y;
    if(uSfE.y>0.5){ float x=atan(rd.x,rd.z)*3.0, cu=sin(x*2.0+uTime*0.3+sin(x*5.0-uTime*0.5)*0.6);   // an aurora's curtains over an ice world
      col+=hsv((uHue+uSfK.z)+0.33,0.8,1.0)*smoothstep(0.55,1.0,cu)*smoothstep(0.05,0.25,rd.y)*smoothstep(0.7,0.3,rd.y)*night*(0.5+uBeat*0.6); }
    float tc=(420.0-ro.y)/max(rd.y,0.02);   // clouds, lit by the sun, dark at night
    if(tc>0.0){ vec2 cp=(ro+rd*tc).xz*0.0025+vec2(uTime*0.01,0.0); float cl=smoothstep(1.0-uSfE.z,1.0,czF(vec3(cp,uSfK.y)))*smoothstep(0.0,0.12,rd.y);
      col=mix(col,mix(vec3(0.15,0.16,0.2),vec3(1.0,0.95,0.9)*(0.55+0.45*day)+vec3(0.3,0.1,0.0)*dusk,day+dusk*0.5)*(0.3+0.7*day+0.4*dusk),cl*0.85); } }
  return col;
}
// the ground where the view hits it: colour by kind, slope and height, lit by the sun with soft shadows, the sea in the
// valleys (ocean worlds), lava glowing in them (lava worlds), cities' lights at night; fading into the sky with distance
vec3 sfGround(vec3 ro,vec3 rd,float t){
  vec3 p=ro+rd*t; vec2 e=vec2(0.35,0.0);
  vec3 n=normalize(vec3(sfH(p.xz-e.xy)-sfH(p.xz+e.xy),2.0*e.x,sfH(p.xz-e.yx)-sfH(p.xz+e.yx)));
  float k=uSfK.x, slope=1.0-n.y, v=abs(p.x-sfPath(p.z)), st=0.5+0.5*sin(p.y*1.3+czN(vec3(p.xz*0.05,1.0))*3.0), hue=uHue+uSfK.z;
  vec3 c;
  if(k<0.5) c=mix(hsv(hue+0.07,0.35,0.45+0.2*st),hsv(hue+0.03,0.25,0.25+0.15*st),smoothstep(0.35,0.7,slope));   // rock: strata, cliffs darker
  else if(k>1.5&&k<2.5) c=mix(vec3(0.92,0.95,1.0),hsv(hue+0.55,0.35,0.6),smoothstep(0.45,0.8,slope));             // ice: snow, blue where steep
  else if(k>2.5&&k<3.5) c=hsv(hue+0.02,0.3,0.08+0.06*st);                                                         // lava worlds: basalt
  else c=mix(mix(hsv(hue+0.28,0.45,0.35),hsv(hue+0.1,0.3,0.4),smoothstep(0.2,0.45,slope)),vec3(0.9),smoothstep(70.0,95.0,p.y)*(1.0-slope));   // green land, rock, snow on the peaks
  if(k<0.5||k>3.5) c=mix(c,vec3(0.92),smoothstep(95.0,120.0,p.y)*smoothstep(0.5,0.2,slope));   // snow high up
  float dif=max(dot(n,uSfSun),0.0), sh=1.0, ts=1.0;
  for(int i=0;i<12;i++){ vec3 q=p+uSfSun*ts; float hh=q.y-sfH(q.xz); sh=min(sh,6.0*hh/ts); ts+=clamp(hh,2.0,25.0); if(sh<0.0||q.y>150.0) break; }
  sh=clamp(sh,0.0,1.0);
  vec3 sky=hsv(hue+0.56,0.4,0.5)*smoothstep(-0.2,0.3,uSfSun.y), col=c*(uCosSunC*0.8*dif*sh+sky*(0.35+0.25*n.y)+0.02);
  if(k>2.5&&k<3.5) col+=hsv(hue+0.03,0.9,1.0)*(smoothstep(8.0,0.0,v)+0.6*smoothstep(0.05,0.0,abs(czN(vec3(p.xz*0.08,2.0))-0.5)))*(0.7+0.5*uBass*uReact);   // lava in the valley and its cracks
  if(uSfE.x>0.5){ float blk=smoothstep(0.55,0.75,czN(vec3(p.xz*0.02,4.0)))*smoothstep(28.0,4.0,p.y)*smoothstep(0.5,0.2,slope);   // a city: districts of lights over the valley floor and lower slopes, at night
    col+=vec3(1.0,0.75,0.4)*(step(0.72,czH(floor(vec3(p.xz*0.6,3.0))))+0.25)*max(blk,smoothstep(14.0,4.0,v))*uSfE.w*(0.6+0.4*uBeat); }
  return col;
}
vec3 czSurface(vec2 sp){
  vec3 ro=uSfEye, rd=normalize(uSfZ+(uSfX*sp.x+uSfY*sp.y)*2.0*uSfTan);
  float t=0.5, hit=0.0, W=uSfK.w;
  for(int i=0;i<96;i++){ vec3 p=ro+rd*t; float h=p.y+t*t*0.00008-sfH(p.xz);   // the ground curves away with distance
    if(h<0.004*t){ hit=1.0; break; } t+=max(h*0.42,0.02+t*0.001); if(t>1400.0) break; }
  vec3 sky=sfSky(rd,ro), col=sky;
  float tw=W>-50.0&&rd.y<0.0?(W-ro.y)/rd.y:1e9;   // the sea (ocean worlds): a plane over the valleys
  if(tw>0.0&&tw<(hit>0.5?t:1e9)){ vec3 rr=reflect(rd,vec3(0.0,1.0,0.0)); vec3 wp=ro+rd*tw;
    rr.xz+=0.03*vec2(sin(wp.x*0.4+uTime),cos(wp.z*0.35-uTime*1.3));   // ripples
    col=mix(hsv((uHue+uSfK.z)+0.56,0.6,0.12),sfSky(normalize(rr),wp),0.55)+uCosSunC*pow(max(dot(normalize(rr),uSfSun),0.0),200.0)*2.0; t=tw; hit=1.0; }
  else if(hit>0.5) col=sfGround(ro,rd,t);
  if(hit>0.5){ float fog=1.0-exp(-t*0.0021);
    col=mix(col,sfSky(normalize(vec3(rd.x,max(rd.y,0.01),rd.z)),ro),fog);
    float low=exp(-max(ro.y+rd.y*t+1.5,0.0)/7.0), dawn=exp(-abs(uSfSun.y-0.05)*6.0)*0.8+0.15;   // mist lying in the valleys, thickest at dawn and dusk
    col=mix(col,mix(vec3(0.75,0.78,0.85),vec3(1.0,0.7,0.5),exp(-abs(uSfSun.y)*8.0)*0.6)*(0.25+0.75*smoothstep(-0.15,0.2,uSfSun.y)),low*dawn*smoothstep(15.0,120.0,t)*0.7); }
  return mix(col,vec3(0.85,0.87,0.9)*(0.35+0.65*smoothstep(-0.1,0.3,uSfSun.y)),uSfHaze);   // the cloud layer passed through on the way down or up
}`,
};
