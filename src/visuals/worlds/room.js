// The room (docs/prism-plan.md, stage 7): a dark hall for the Prism to stand in, the same space as its facets (the camera
// the Prism's camera, scene/stage.js holding what it works out each frame): a floor below it with a faint grid, the walls a
// dark dome round it, the lamps' beams through the haze, their pools of light on the floor, the Prism's shadow, and the spots
// its facets throw off the key lamp, sweeping round the walls and floor as it turns, a mirror ball's. Opt-in: Journey brings
// it in only with the Prism as centrepiece (J.stage), and by hand it's a slider under "Media and objects".
import { hc, hsv2rgb } from '../../util.js';
import { STAGE, MAXSPOTS } from '../../scene/stage.js';
import { TUNE } from '../../tuning.js';

export const STYLES = ['cove', 'mirror', 'void', 'dome', 'glass'];
const L3 = new Float32Array(12), C3 = new Float32Array(9), A3 = new Float32Array(12), B3 = new Float32Array(12);
function pack(){
  STAGE.lamps.slice(0, 3).forEach((l, i) => { L3.set([l.p[0], l.p[1], l.p[2], l.k], i*4); C3.set(l.c, i*3); A3.set([l.a ? l.a[0] : 0, l.a ? l.a[1] : 0, l.a ? l.a[2] : -1, Math.cos(l.cone*1.3)], i*4);
    B3.set([l.s[0], l.s[1], l.k*(l.vis ?? 0)*TUNE.prism.on.beams, l.cone], i*4); });
}
// without the Prism (the room alone, or another object standing in it on a plinth): the same calm rig the Prism has, its key
// light drifting slowly at the height asked, a rim light behind and a low fill (TUNE.prism.light), the key's shadow on the floor
let it = 0;
function idle(P, x, w){
  it += x.dt; const LT = TUNE.prism.light, R = TUNE.prism.room, h = P.hue || 0, pal = P.pal || [0, .33, .67], e = R.tilt, cam = 3.2, f = 1.3, fl = .8;
  const n = [0, Math.cos(e), Math.sin(e)], fv = [0, -Math.sin(e), Math.cos(e)], az = .6 + .35*Math.sin(it*.05*LT.move), el = -.35 + 1.45*LT.height, ce = Math.cos(el), RR = 2.6;
  const tint = (c, i, sat) => { const q = hsv2rgb(h + pal[i], sat, 1); return c.map((v, j) => v + (q[j] - v)*LT.colour); };
  const rig = [[[RR*ce*Math.sin(az), RR*Math.sin(el), RR*ce*Math.cos(az)], tint([1, .88, .74], 0, .45), .9*w, R.cone*1.4],
    [[-RR*.6*Math.sin(az), RR*.7, -RR*.8], tint([.72, .84, 1], 1, .6), .7*w, R.rimCone], [[-RR*.8*Math.sin(az - .4), -.45, RR*.6*Math.cos(az - .4)], tint([.88, .9, 1], 2, .6), LT.fill*w, .55]];
  STAGE.lamps.forEach((l, i) => { if (i >= 3) { l.k = 0; return; } const [p, c, k, cone] = rig[i], ax = -p[0], ay = -.1 - p[1], az2 = -p[2], al = Math.hypot(ax, ay, az2), dz = cam - p[2];
    Object.assign(l, {p, c, k, a: [ax/al, ay/al, az2/al], cone, s: dz > .05 ? [p[0]*f/dz, p[1]*f/dz] : [0, 0], vis: 1}); });
  const Lp = rig[0][0], ll = Math.hypot(...Lp), d = Lp.map(v => -v/ll), dn = n[1]*d[1] + n[2]*d[2];
  if (dn < -.05) { const t = (-fl - (n[1]*Lp[1] + n[2]*Lp[2]))/dn, q = Lp.map((v, i) => v + d[i]*t); STAGE.shadow = [q[0], q[1]*fv[1] + q[2]*fv[2], .5*w, .55*t/ll]; } else STAGE.shadow = [0, 0, 0, 1];
  STAGE.amb = tint([.55, .6, .72], 1, .4).map(v => v*LT.ambient*w); STAGE.refl = 0; STAGE.ch = [0, 0, 0, 0]; STAGE.plinth = [w > .5 ? 1 : 0, -.62, .42];
  const sty = (x.J && x.J.on && x.J.stageStyle) || 'cove'; STAGE.style = sty === 'mirror' ? 'cove' : sty;   // (the mirror chamber's images are the Prism's own)
  Object.assign(STAGE, {on: 0, cam, f, pos: [0, 0], tilt: e, floor: fl, walls: 3.4, haze: R.haze*.5*w, hue: h + pal[1], n, fv, nSpots: 0, nBeams: 0, nCaus: 0, rain: 0, t: it});
  STAGE.spots.fill(0);
}
export default {
  key: 'room', kind: 'world', label: 'The room', optIn: true,
  light: {hue: .1, sat: .3, x: .4, y: .6},
  suits: () => 0,
  params(P, x){ if (!(P.w.room > .003) || (x.eff && x.eff.prism) > .003) return; idle(P, x, Math.min(1, P.w.room)); },   // (with the Prism on, it sets the room up itself)
  glsl: {
    uniforms: `uniform vec4 uRm, uRm2, uRmSh, uRmAmb, uRmCh, uRm3, uRmPl, uRmOn; uniform float uRmSt; uniform vec2 uRmR; uniform vec4 uRmL[3], uRmA[3], uRmB[3]; uniform vec3 uRmC[3]; uniform vec4 uRmS[${MAXSPOTS}], uRmZ[24], uRmZC[24], uRmK[8]; uniform vec3 uRmKC[8];   // the room: camera distance, focal length, tilt, floor; the Prism's place on screen, haze, hue; the shadow; the lamps (place, brightness; aim, cone; on screen); the mirror ball's spots`,
    functions: `
vec3 room(vec2 sp){
  float cam=uRm.x, f=uRm.y, e=uRm.z, fl=uRm.w;
  vec3 o=vec3(0.0,0.0,cam), d=normalize(vec3(sp-uRm2.xy,-f)), n=vec3(0.0,cos(e),sin(e)), fv=vec3(0.0,-sin(e),cos(e));
  // the mirror chamber (uRmCh: its sides, how far out, its turn, how far stood up): the ray bounces off its walls a few times,
  // dimming each time, before it meets the floor or the ceiling; where two mirrors meet, a seam of light
  float att=1.0, seam=0.0;
  if(uRmCh.w>0.01){ vec3 ex=vec3(1.0,0.0,0.0);
    for(int k=0;k<4;k++){
      vec2 oq=vec2(o.x,dot(o,fv)), dq=vec2(d.x,dot(d,fv)); float tb=1e9; vec2 mb=vec2(0.0);
      for(int i=0;i<6;i++){ if(float(i)>=uRmCh.x) break; float a=uRmCh.z+float(i)*6.2831853/uRmCh.x; vec2 m=vec2(cos(a),sin(a)); float dm=dot(dq,m);
        if(m.y*cam*cos(e)>uRmCh.y) continue;   // (the open end, towards the camera)
        if(dm>1e-4){ float t=(uRmCh.y-dot(oq,m))/dm; if(t>1e-3&&t<tb){ tb=t; mb=m; } } }
      float hy=dot(o,n), dy=dot(d,n), tfl=dy<-1e-4 ? (-fl-hy)/dy : 1e9, tce=dy>1e-4 ? (uRm3.z-hy)/dy : 1e9;
      if(tb>=min(tfl,tce)) break;
      o+=d*tb; vec3 mv=mb.x*ex+mb.y*fv; d=d-2.0*dot(d,mv)*mv;
      vec2 q2=vec2(o.x,dot(o,fv)); float along=dot(q2,vec2(-mb.y,mb.x)), hw=uRmCh.y*tan(3.14159265/uRmCh.x);
      seam+=att*smoothstep(0.08,0.0,hw-abs(along))*uRmCh.w; att*=mix(1.0,uRm3.y,uRmCh.w);
    }
  }
  float b=dot(o,d), c=dot(o,o)-uRm3.x, tw=-b+sqrt(max(0.0,b*b-c)), dn=dot(n,d), tf=dn<-1e-4 ? (-fl-dot(n,o))/dn : 1e9;
  bool onF=tf>0.0&&tf<tw; float t=onF ? tf : tw; vec3 p=o+d*t;
  // the style (uRmSt: 0 the cove, 1 the mirror chamber, 2 a black mirror void, 3 a ribbed dome, 4 a hall of glass panes)
  float stV=step(1.5,uRmSt)*step(uRmSt,2.5), stD=step(2.5,uRmSt)*step(uRmSt,3.5), stG=step(3.5,uRmSt);
  vec3 base=hsv(uRm2.w,0.45,1.0), amb=uRmAmb.rgb*(1.0-0.75*stV), col=base*(0.012+0.012*max(0.0,d.y));
  // a plinth under an object that isn't the Prism (uRmPl: on, its top, its half-width)
  bool onP=false; vec3 pn=vec3(0.0);
  if(uRmPl.x>0.5){ vec3 of=vec3(o.x,dot(o,n),dot(o,fv)), df=vec3(d.x,dot(d,n),dot(d,fv)), lo=vec3(-uRmPl.z,-fl,-uRmPl.z), hi=vec3(uRmPl.z,uRmPl.y,uRmPl.z);
    vec3 t1=(lo-of)/df, t2=(hi-of)/df, tn=min(t1,t2), tx=max(t1,t2); float ta=max(max(tn.x,tn.y),tn.z), tb2=min(min(tx.x,tx.y),tx.z);
    if(ta<tb2&&ta>0.0&&ta<tf&&ta<tw){ onP=true; vec3 ax=step(vec3(ta-1e-4),tn)*step(tn,vec3(ta+1e-4)), sg=-sign(df); vec3 nf=ax*sg; pn=nf.x*vec3(1.0,0.0,0.0)+nf.y*n+nf.z*fv; onF=false; p=o+d*ta; } }
  // ambient light as a studio's: brightest on the floor round the Prism, falling off with distance and with height up the walls,
  // one falloff for both so the floor curves into the walls with no edge (a seamless cove), the far wall fading into darkness
  float hgt=max(0.0,dot(p,n)+fl), rh=length(p-n*dot(p,n));
  col+=amb*0.42*exp(-rh*0.42)*exp(-hgt*0.95)*(onF ? 1.0 : 0.85);
  if(!onF&&!onP){ vec3 wp=normalize(p); float az=atan(wp.x,dot(wp,fv)), el=asin(clamp(dot(wp,n),-1.0,1.0));
    // the dome's ribs and rings, catching the light
    float rib=smoothstep(0.035,0.0,abs(fract(az*12.0/6.2831853)-0.5)-0.465)+smoothstep(0.03,0.0,abs(fract(el*9.0/3.14159)-0.5)-0.47);
    col+=stD*rib*amb*0.25*exp(-hgt*0.6);
    // the glass hall: frosted panes between mullions, each softly lit from behind, in its own time
    vec2 pg=vec2(az*16.0/6.2831853,el*7.0), pc=floor(pg), pf=fract(pg); float ph=fract(sin(dot(pc,vec2(12.9898,78.233)))*43758.5453);
    float pane=smoothstep(0.0,0.06,min(min(pf.x,1.0-pf.x),min(pf.y,1.0-pf.y))), glow=0.12+0.4*pow(0.5+0.5*sin(uRmR.y*0.4+ph*6.2831853),3.0);
    col=mix(col,col*0.3+(amb*0.6+hsv(uRm2.w+ph*0.15,0.35,1.0)*0.12)*glow*pane+amb*0.05*(1.0-pane),stG);
    col*=1.0-0.85*stV; }
  if(onP){ col=amb*(0.35+0.25*max(0.0,dot(pn,n)))+base*0.02;   // the plinth: lit stone
    for(int i=0;i<3;i++){ vec3 l=normalize(uRmL[i].xyz-p); col+=uRmC[i]*uRmL[i].w*max(0.0,dot(pn,l))*0.35; } }
  // the lamps: their pools on the floor and walls (in each cone, facing it, falling off with distance)
  vec3 nn=onF ? n : -normalize(p);
  for(int i=0;i<3;i++){ vec3 l=uRmL[i].xyz-p; float ld=length(l); l/=ld;
    float ca=dot(-l,uRmA[i].xyz), cone=smoothstep(uRmA[i].w,mix(uRmA[i].w,1.0,0.6),ca);
    col+=uRmC[i]*uRmL[i].w*cone*max(0.0,dot(nn,l))*(onF ? 0.5 : 0.18)/(1.0+ld*ld*0.12); }
  if(onF){
    vec2 q=vec2(p.x,dot(p,fv)), g=abs(fract(q*2.0)-0.5); float w=0.012+t*0.006;
    float ln=smoothstep(0.5-w,0.5,max(g.x,g.y))*exp(-length(q)*0.3)*uRmOn.x*(1.0-stV);   // the grid (off unless switched on)
    col+=base*ln*0.06+col*ln*0.5;
    for(int i=0;i<3;i++){ vec3 l=normalize(uRmL[i].xyz-p), r=reflect(d,n); col+=uRmC[i]*uRmL[i].w*pow(max(0.0,dot(r,l)),10.0)*0.12*uRmOn.y; }   // the lamps' soft sheen on the polished floor
    vec2 sq=(q-uRmSh.xy)/max(uRmSh.w,0.05); col*=1.0-uRmSh.z*smoothstep(1.0,0.2,length(sq*vec2(1.0,1.3)));   // the key light's shadow
    col*=1.0-0.6*uRmOn.z*exp(-dot(q,q)/0.09);   // a soft contact shadow right under it
  }
  // the spots off the facets
  for(int i=0;i<${MAXSPOTS};i++){ vec4 s=uRmS[i]; if(s.w<0.002) continue; vec2 dd=(sp-s.xy)/max(s.z,1e-3); col+=uRmC[0]*s.w*exp(-dot(dd,dd)*2.0)*0.7; }
  // caustics: light that's been through the glass landing on the floor and walls, rainbow patches
  for(int i=0;i<8;i++){ vec4 k=uRmK[i]; if(k.w<0.5) continue; vec2 dd=(sp-k.xy)/max(k.z,1e-3); col+=uRmKC[i]*exp(-dot(dd,dd)*1.5)*1.6; }
  // the beams through the haze, from each lamp past the Prism
  for(int i=0;i<3;i++){ vec4 B=uRmB[i]; if(B.z<0.01) continue; vec2 a=B.xy, ab=(uRm2.xy-a)*1.8; float h=clamp(dot(sp-a,ab)/dot(ab,ab),0.0,1.0);
    float r=length(sp-a-ab*h), wd=0.01+h*length(ab)*B.w*0.9, bm=exp(-r*r/(wd*wd))*smoothstep(0.0,0.15,h)*(1.0-h*0.6);
    vec2 rq=vec2((sp.x+sp.y*0.22)*90.0,sp.y*7.0+uRmR.y*9.0); float rn=step(0.93,fract(sin(dot(floor(rq),vec2(127.1,311.7)))*43758.5453))*smoothstep(0.5,0.0,abs(fract(rq.y)-0.5));   // rain falling through the light
    col+=uRmC[i]*B.z*uRm2.z*bm*(0.12+uRmR.x*rn*1.4); }
  col+=base*uRm2.z*0.05*exp(-length(sp-uRm2.xy)*2.5);   // the haze lit round it
  for(int i=0;i<24;i++){ vec4 z=uRmZ[i], zc=uRmZC[i]; if(zc.w<1e-4) continue; vec2 ab=z.zw-z.xy; float h=clamp(dot(sp-z.xy,ab)/max(dot(ab,ab),1e-6),0.0,1.0);   // the lasers behind the Prism
    float r=length(sp-z.xy-ab*h)/zc.w; col+=zc.rgb*(exp(-r*r*2.0)+0.12*exp(-r*0.6)); }
  col*=att; col+=hsv(uRm2.w,0.3,1.0)*seam*uRm3.w*(0.4+amb.g);   // (the mirrors' dimming, and their seams of light)
  col=mix(col,amb*0.03,uRmOn.w*(1.0-exp(-max(0.0,t-1.5)*0.18)));   // depth fog: the far room falling away
  col*=1.0-uRmOn.w*0.5*smoothstep(0.35,1.1,length(sp*vec2(0.8,1.0)));   // and a vignette
  return col;
}`,
    fn: 'room',
  },
  uniforms(gl, u, P){ pack();
    gl.uniform4f(u.uRm, STAGE.cam, STAGE.f, STAGE.tilt, STAGE.floor); gl.uniform4f(u.uRm2, STAGE.pos[0], STAGE.pos[1], STAGE.haze, STAGE.hue); const am = STAGE.amb || [0, 0, 0]; gl.uniform4f(u.uRmAmb, am[0], am[1], am[2], STAGE.refl || 0); gl.uniform2f(u.uRmR, STAGE.rain, STAGE.t % 1000); const ON = TUNE.prism.on; gl.uniform4f(u.uRmOn, ON.grid, ON.glints, ON.shadow, ON.fog); gl.uniform1f(u.uRmSt, STYLES.indexOf(STAGE.style) < 0 ? 0 : STYLES.indexOf(STAGE.style)); const pl = STAGE.plinth || [0, 0, 0]; gl.uniform4f(u.uRmPl, pl[0], pl[1], pl[2], 0); const ch = STAGE.ch || [0, 0, 0, 0], CH = TUNE.prism.chamber; gl.uniform4f(u.uRmCh, ch[0], ch[1], ch[2], ch[3]); gl.uniform4f(u.uRm3, Math.max(11.56, (ch[1]*1.3)**2), CH.fade, CH.ceil, CH.seam); gl.uniform4fv(u.uRmSh, STAGE.shadow.length === 4 ? STAGE.shadow : [0, 0, 0, 1]);
    const v = k => u[k + '[0]'] || u[k] || null;
    gl.uniform4fv(v('uRmL'), L3); gl.uniform4fv(v('uRmA'), A3); gl.uniform4fv(v('uRmB'), B3); gl.uniform3fv(v('uRmC'), C3); gl.uniform4fv(v('uRmS'), STAGE.spots); if (!STAGE.nBeams) STAGE.beamC.fill(0); if (!STAGE.nCaus) STAGE.caus.fill(0); gl.uniform4fv(v('uRmK'), STAGE.caus); gl.uniform3fv(v('uRmKC'), STAGE.causC); gl.uniform4fv(v('uRmZ'), STAGE.beams); gl.uniform4fv(v('uRmZC'), STAGE.beamC); },
  // simple mode: the floor's grid in perspective, the shadow, the beams as soft wedges, the spots
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, a = Math.min(1, P.w.room), X = s => W/2 + s[0]*H, Y = s => H/2 - s[1]*H;
    o.globalAlpha = a; o.fillStyle = '#000'; o.fillRect(0, 0, W, H);
    const am = (STAGE.amb || [0, 0, 0]).map(v => Math.round(Math.min(1, v*.35)*255)).join(',');   // ambient light: the walls a soft wash, the floor a little brighter
    const sty = STAGE.style || 'cove', wash = sty === 'void' ? .25 : 1;
    { const g = o.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(${am},${.25*wash})`); g.addColorStop(.6, `rgba(${am},${.55*wash})`); g.addColorStop(1, `rgba(${am},${.9*wash})`); o.fillStyle = g; o.fillRect(0, 0, W, H); }
    if (sty === 'glass') { const cw = W/12, rh = H*.11; for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) { const ph = Math.sin(c*12.9 + r*78.2)*43758.5 % 1, gl = .12 + .35*Math.pow(.5 + .5*Math.sin((STAGE.t || 0)*.4 + ph*6.28), 3);   // the glass hall's panes, lit from behind
      o.fillStyle = `rgba(${am},${gl.toFixed(3)})`; o.fillRect(c*cw + 3, r*rh + 3, cw - 6, rh - 6); } }
    if (sty === 'dome') { o.strokeStyle = `rgba(${am},.5)`; o.lineWidth = 1.5; o.beginPath(); for (let i = 1; i < 12; i++) { const x = W*i/12; o.moveTo(W/2 + (x - W/2)*.4, 0); o.quadraticCurveTo(x, H*.25, x + (x - W/2)*.3, H*.5); } for (let r = 1; r < 4; r++) { o.moveTo(0, H*.12*r); o.quadraticCurveTo(W/2, H*.12*r - H*.06, W, H*.12*r); } o.stroke(); }
    const {cam, f, tilt: e, floor: fl, pos} = STAGE, n = [0, Math.cos(e), Math.sin(e)], fv = [0, -Math.sin(e), Math.cos(e)];
    const at = (x, z) => { const p = [x, -fl*n[1] + z*fv[1], -fl*n[2] + z*fv[2]], dz = cam - p[2]; return dz > .05 ? [pos[0] + p[0]*f/dz, pos[1] + p[1]*f/dz] : null; };
    o.lineWidth = 1; o.strokeStyle = hc(STAGE.hue, 45, 30, .25*TUNE.prism.on.grid); o.beginPath();
    const zMax = Math.min(3, (cam - .3 + fl*n[2])/fv[2]);   // (the floor's lines stop short of the camera)
    for (let i = -6; i <= 6; i++) { const A = at(i/2, -3), B = at(i/2, zMax); if (A && B) { o.moveTo(X(A), Y(A)); o.lineTo(X(B), Y(B)); }
      const C = i/2 <= zMax && at(-3, i/2), D = C && at(3, i/2); if (C && D) { o.moveTo(X(C), Y(C)); o.lineTo(X(D), Y(D)); } }
    o.stroke();
    const ch = STAGE.ch || [0, 0, 0, 0];   // the mirror chamber: its walls standing on the floor, their seams
    if (ch[3] > .01) { o.strokeStyle = hc(STAGE.hue, 30, 70, .5*ch[3]); o.lineWidth = 2; o.beginPath();
      for (let i = 0; i < ch[0]; i++) { const a = ch[2] + (i + .5)*2*Math.PI/ch[0]; if (Math.sin(a)*cam*Math.cos(e) > ch[1]*1.2) continue; const r = ch[1]/Math.cos(Math.PI/ch[0]), A = at(r*Math.cos(a), r*Math.sin(a)); if (!A) continue;
        const up = [A[0], A[1] + 1.2*f/(cam + .5)]; o.moveTo(X(A), Y(A)); o.lineTo(X(up), Y(up)); }
      o.stroke(); }
    const sh = STAGE.shadow, c = sh[2] > .01 && at(sh[0], sh[1]);
    const pl = STAGE.plinth || [0, 0, 0];   // the plinth: its front face and top
    if (pl[0] > .5) { const at3 = (x, y, z) => { const p = [x, y*n[1] + z*fv[1], y*n[2] + z*fv[2]], dz = cam - p[2]; return [pos[0] + p[0]*f/dz, pos[1] + p[1]*f/dz]; }, w2 = pl[2];
      const q = [at3(-w2, -fl, w2), at3(w2, -fl, w2), at3(w2, pl[1], w2), at3(-w2, pl[1], w2)], tq = [at3(-w2, pl[1], w2), at3(w2, pl[1], w2), at3(w2, pl[1], -w2), at3(-w2, pl[1], -w2)];
      const poly = (pts, col) => { o.fillStyle = col; o.beginPath(); pts.forEach((p, i) => i ? o.lineTo(X(p), Y(p)) : o.moveTo(X(p), Y(p))); o.closePath(); o.fill(); };
      const pc = (STAGE.amb || [0, 0, 0]).map(v => Math.round(Math.min(1, v*1.2)*255)).join(','); poly(tq, `rgba(${pc},.9)`); poly(q, `rgba(${pc},.55)`); }
    if (c) { const r = sh[3]*f/(cam + .5)*H; o.fillStyle = `rgba(0,0,0,${(sh[2]*.8).toFixed(3)})`; o.beginPath(); o.ellipse(X(c), Y(c), r, r*.35, 0, 0, Math.PI*2); o.fill(); }
    { const c0 = TUNE.prism.on.shadow && at(0, 0); if (c0) { const r = .35*f/cam*H, g = o.createRadialGradient(X(c0), Y(c0), 0, X(c0), Y(c0), r);   // a soft contact shadow under it
        g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); o.save(); o.translate(X(c0), Y(c0)); o.scale(1, .35); o.translate(-X(c0), -Y(c0)); o.fillStyle = g; o.fillRect(X(c0) - r, Y(c0) - r, r*2, r*2); o.restore(); } }
    if (TUNE.prism.on.fog) { const g = o.createRadialGradient(W/2, H/2, H*.35, W/2, H/2, H*1.1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); o.fillStyle = g; o.fillRect(0, 0, W, H); }   // the vignette
    o.globalCompositeOperation = 'lighter';
    for (const l of STAGE.lamps.slice(0, 3)) { const k = l.k*(l.vis ?? 0)*TUNE.prism.on.beams*.6; if (k < .01) continue;
      const ax = X(l.s), ay = Y(l.s), bx = X(pos) + (X(pos) - ax)*.8, by = Y(pos) + (Y(pos) - ay)*.8, len = Math.hypot(bx - ax, by - ay) || 1, wd = len*l.cone*.9;
      const g = o.createLinearGradient(ax, ay, bx, by), col = l.c.map(v => Math.round(v*255)).join(',');
      g.addColorStop(0, `rgba(${col},${(k*STAGE.haze*.35).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`);
      o.fillStyle = g; o.beginPath(); o.moveTo(ax, ay); o.lineTo(bx + (by - ay)/len*wd, by - (bx - ax)/len*wd); o.lineTo(bx - (by - ay)/len*wd, by + (bx - ax)/len*wd); o.fill(); }
    const sc = STAGE.lamps[0].c.map(v => Math.round(v*255)).join(',');
    for (let i = 0; i < STAGE.nSpots; i++) { const s = STAGE.spots.subarray(i*4, i*4 + 4); if (s[3] < .01) continue; const r = Math.max(1.5, s[2]*H);
      const g = o.createRadialGradient(X(s), Y(s), 0, X(s), Y(s), r); g.addColorStop(0, `rgba(${sc},${Math.min(1, s[3]*.8).toFixed(3)})`); g.addColorStop(1, `rgba(${sc},0)`);
      o.fillStyle = g; o.fillRect(X(s) - r, Y(s) - r, r*2, r*2); }
    for (let i = 0; i < STAGE.nCaus; i++) { const k = STAGE.caus.subarray(i*4, i*4 + 4), c = STAGE.causC.subarray(i*3, i*3 + 3), r = Math.max(2, k[2]*H), cs = [...c].map(v => Math.min(255, v*255|0)).join(',');
      const g = o.createRadialGradient(X(k), Y(k), 0, X(k), Y(k), r); g.addColorStop(0, `rgba(${cs},.9)`); g.addColorStop(1, `rgba(${cs},0)`); o.fillStyle = g; o.fillRect(X(k) - r, Y(k) - r, r*2, r*2); }
    o.lineCap = 'round';
    for (let i = 0; i < STAGE.nBeams; i++) { const z = STAGE.beams.subarray(i*4, i*4 + 4), c = STAGE.beamC.subarray(i*4, i*4 + 4), cs = `${Math.min(255, c[0]*255|0)},${Math.min(255, c[1]*255|0)},${Math.min(255, c[2]*255|0)}`;
      o.strokeStyle = `rgba(${cs},.3)`; o.lineWidth = c[3]*H*1.6; o.beginPath(); o.moveTo(X([z[0], z[1]]), Y([z[0], z[1]])); o.lineTo(X([z[2], z[3]]), Y([z[2], z[3]])); o.stroke();
      o.strokeStyle = `rgba(${cs},1)`; o.lineWidth = Math.max(1, c[3]*H*.35); o.stroke(); }
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
  },
};
