// The room (docs/prism-plan.md, stage 7): a dark hall for the Prism to stand in, the same space as its facets (the camera
// the Prism's camera, scene/stage.js holding what it works out each frame): a floor below it with a faint grid, the walls a
// dark dome round it, the lamps' beams through the haze, their pools of light on the floor, the Prism's shadow, and the spots
// its facets throw off the key lamp, sweeping round the walls and floor as it turns, a mirror ball's. Opt-in: Journey brings
// it in only with the Prism as centrepiece (J.stage), and by hand it's a slider under "Media and objects".
import { hc, hsv2rgb } from '../../util.js';
import { STAGE, MAXSPOTS } from '../../scene/stage.js';

const L3 = new Float32Array(12), C3 = new Float32Array(9), A3 = new Float32Array(12), B3 = new Float32Array(12);
function pack(){
  STAGE.lamps.slice(0, 3).forEach((l, i) => { L3.set([l.p[0], l.p[1], l.p[2], l.k], i*4); C3.set(l.c, i*3); A3.set([l.a ? l.a[0] : 0, l.a ? l.a[1] : 0, l.a ? l.a[2] : -1, Math.cos(l.cone*1.3)], i*4);
    B3.set([l.s[0], l.s[1], l.k*(l.vis ?? 0), l.cone], i*4); });
}
// without the Prism: the room alone, its lamps sweeping slowly over an empty floor
let it = 0;
function idle(P, x, w){
  it += x.dt; const h = P.hue || 0, pal = P.pal || [0, .33, .67], e = .22, cam = 3.2, f = 1.3, n = [0, Math.cos(e), Math.sin(e)], fv = [0, -Math.sin(e), Math.cos(e)];
  STAGE.lamps.forEach((l, i) => { const a = it*.2 + i*2.1, p = [2.2*Math.sin(a), 1.4, .4*Math.cos(a) - .6], ax = .3*Math.sin(it*.3 + i) - p[0], ay = -.8 - p[1], az = -p[2], al = Math.hypot(ax, ay, az), dz = cam - p[2];
    Object.assign(l, {p, c: hsv2rgb(h + pal[i % 3], .6, 1), k: i < 3 ? .6*w : 0, a: [ax/al, ay/al, az/al], cone: .3, s: [p[0]*f/dz, p[1]*f/dz], vis: 1}); });
  Object.assign(STAGE, {on: 0, cam, f, pos: [0, 0], tilt: e, floor: .8, walls: 3.4, haze: .5*w, hue: h + pal[1], n, fv, shadow: [0, 0, 0, 1], nSpots: 0, nBeams: 0, rain: 0, t: it});
  STAGE.spots.fill(0);
}
export default {
  key: 'room', kind: 'world', label: 'The room', optIn: true,
  light: {hue: .1, sat: .3, x: .4, y: .6},
  suits: () => 0,
  params(P, x){ if (!(P.w.room > .003) || (x.eff && x.eff.prism) > .003) return; idle(P, x, Math.min(1, P.w.room)); },   // (with the Prism on, it sets the room up itself)
  glsl: {
    uniforms: `uniform vec4 uRm, uRm2, uRmSh; uniform vec2 uRmR; uniform vec4 uRmL[3], uRmA[3], uRmB[3]; uniform vec3 uRmC[3]; uniform vec4 uRmS[${MAXSPOTS}], uRmZ[24], uRmZC[24];   // the room: camera distance, focal length, tilt, floor; the Prism's place on screen, haze, hue; the shadow; the lamps (place, brightness; aim, cone; on screen); the mirror ball's spots`,
    functions: `
vec3 room(vec2 sp){
  float cam=uRm.x, f=uRm.y, e=uRm.z, fl=uRm.w;
  vec3 o=vec3(0.0,0.0,cam), d=normalize(vec3(sp-uRm2.xy,-f)), n=vec3(0.0,cos(e),sin(e)), fv=vec3(0.0,-sin(e),cos(e));
  float b=dot(o,d), c=dot(o,o)-11.56, tw=-b+sqrt(max(0.0,b*b-c)), dn=dot(n,d), tf=dn<-1e-4 ? (-fl-dot(n,o))/dn : 1e9;
  bool onF=tf>0.0&&tf<tw; float t=onF ? tf : tw; vec3 p=o+d*t;
  vec3 base=hsv(uRm2.w,0.45,1.0), col=base*(0.012+0.012*max(0.0,d.y));
  // the lamps: their pools on the floor and walls (in each cone, facing it, falling off with distance)
  vec3 nn=onF ? n : -normalize(p);
  for(int i=0;i<3;i++){ vec3 l=uRmL[i].xyz-p; float ld=length(l); l/=ld;
    float ca=dot(-l,uRmA[i].xyz), cone=smoothstep(uRmA[i].w,mix(uRmA[i].w,1.0,0.6),ca);
    col+=uRmC[i]*uRmL[i].w*cone*max(0.0,dot(nn,l))*(onF ? 0.5 : 0.18)/(1.0+ld*ld*0.12); }
  if(onF){
    vec2 q=vec2(p.x,dot(p,fv)), g=abs(fract(q*2.0)-0.5); float w=0.012+t*0.006;
    float ln=smoothstep(0.5-w,0.5,max(g.x,g.y))*exp(-length(q)*0.3);
    col+=base*ln*0.1+col*ln*1.5;
    vec2 sq=(q-uRmSh.xy)/max(uRmSh.w,0.05); col*=1.0-uRmSh.z*smoothstep(1.0,0.2,length(sq*vec2(1.0,1.3)));   // the Prism's shadow
    col*=smoothstep(3.4,1.0,length(q));
  }
  // the spots off the facets
  for(int i=0;i<${MAXSPOTS};i++){ vec4 s=uRmS[i]; if(s.w<0.002) continue; vec2 dd=(sp-s.xy)/max(s.z,1e-3); col+=uRmC[0]*s.w*exp(-dot(dd,dd)*2.0)*0.7; }
  // the beams through the haze, from each lamp past the Prism
  for(int i=0;i<3;i++){ vec4 B=uRmB[i]; if(B.z<0.01) continue; vec2 a=B.xy, ab=(uRm2.xy-a)*1.8; float h=clamp(dot(sp-a,ab)/dot(ab,ab),0.0,1.0);
    float r=length(sp-a-ab*h), wd=0.01+h*length(ab)*B.w*0.9, bm=exp(-r*r/(wd*wd))*smoothstep(0.0,0.15,h)*(1.0-h*0.6);
    vec2 rq=vec2((sp.x+sp.y*0.22)*90.0,sp.y*7.0+uRmR.y*9.0); float rn=step(0.93,fract(sin(dot(floor(rq),vec2(127.1,311.7)))*43758.5453))*smoothstep(0.5,0.0,abs(fract(rq.y)-0.5));   // rain falling through the light
    col+=uRmC[i]*B.z*uRm2.z*bm*(0.22+uRmR.x*rn*1.4); }
  col+=base*uRm2.z*0.05*exp(-length(sp-uRm2.xy)*2.5);   // the haze lit round it
  for(int i=0;i<24;i++){ vec4 z=uRmZ[i], zc=uRmZC[i]; if(zc.w<1e-4) continue; vec2 ab=z.zw-z.xy; float h=clamp(dot(sp-z.xy,ab)/max(dot(ab,ab),1e-6),0.0,1.0);   // the lasers behind the Prism
    float r=length(sp-z.xy-ab*h)/zc.w; col+=zc.rgb*(exp(-r*r*2.0)+0.12*exp(-r*0.6)); }
  return col;
}`,
    fn: 'room',
  },
  uniforms(gl, u, P){ pack();
    gl.uniform4f(u.uRm, STAGE.cam, STAGE.f, STAGE.tilt, STAGE.floor); gl.uniform4f(u.uRm2, STAGE.pos[0], STAGE.pos[1], STAGE.haze, STAGE.hue); gl.uniform2f(u.uRmR, STAGE.rain, STAGE.t % 1000); gl.uniform4fv(u.uRmSh, STAGE.shadow.length === 4 ? STAGE.shadow : [0, 0, 0, 1]);
    const v = k => u[k + '[0]'] || u[k] || null;
    gl.uniform4fv(v('uRmL'), L3); gl.uniform4fv(v('uRmA'), A3); gl.uniform4fv(v('uRmB'), B3); gl.uniform3fv(v('uRmC'), C3); gl.uniform4fv(v('uRmS'), STAGE.spots); if (!STAGE.nBeams) STAGE.beamC.fill(0); gl.uniform4fv(v('uRmZ'), STAGE.beams); gl.uniform4fv(v('uRmZC'), STAGE.beamC); },
  // simple mode: the floor's grid in perspective, the shadow, the beams as soft wedges, the spots
  draw2d(o, P){
    const W = o.canvas.width, H = o.canvas.height, a = Math.min(1, P.w.room), X = s => W/2 + s[0]*H, Y = s => H/2 - s[1]*H;
    o.globalAlpha = a; o.fillStyle = '#000'; o.fillRect(0, 0, W, H);
    const {cam, f, tilt: e, floor: fl, pos} = STAGE, n = [0, Math.cos(e), Math.sin(e)], fv = [0, -Math.sin(e), Math.cos(e)];
    const at = (x, z) => { const p = [x, -fl*n[1] + z*fv[1], -fl*n[2] + z*fv[2]], dz = cam - p[2]; return dz > .05 ? [pos[0] + p[0]*f/dz, pos[1] + p[1]*f/dz] : null; };
    o.lineWidth = 1; o.strokeStyle = hc(STAGE.hue, 45, 30, .25); o.beginPath();
    const zMax = Math.min(3, (cam - .3 + fl*n[2])/fv[2]);   // (the floor's lines stop short of the camera)
    for (let i = -6; i <= 6; i++) { const A = at(i/2, -3), B = at(i/2, zMax); if (A && B) { o.moveTo(X(A), Y(A)); o.lineTo(X(B), Y(B)); }
      const C = i/2 <= zMax && at(-3, i/2), D = C && at(3, i/2); if (C && D) { o.moveTo(X(C), Y(C)); o.lineTo(X(D), Y(D)); } }
    o.stroke();
    const sh = STAGE.shadow, c = sh[2] > .01 && at(sh[0], sh[1]);
    if (c) { const r = sh[3]*f/(cam + .5)*H; o.fillStyle = `rgba(0,0,0,${(sh[2]*.8).toFixed(3)})`; o.beginPath(); o.ellipse(X(c), Y(c), r, r*.35, 0, 0, Math.PI*2); o.fill(); }
    o.globalCompositeOperation = 'lighter';
    for (const l of STAGE.lamps.slice(0, 3)) { const k = l.k*(l.vis ?? 0); if (k < .01) continue;
      const ax = X(l.s), ay = Y(l.s), bx = X(pos) + (X(pos) - ax)*.8, by = Y(pos) + (Y(pos) - ay)*.8, len = Math.hypot(bx - ax, by - ay) || 1, wd = len*l.cone*.9;
      const g = o.createLinearGradient(ax, ay, bx, by), col = l.c.map(v => Math.round(v*255)).join(',');
      g.addColorStop(0, `rgba(${col},${(k*STAGE.haze*.35).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`);
      o.fillStyle = g; o.beginPath(); o.moveTo(ax, ay); o.lineTo(bx + (by - ay)/len*wd, by - (bx - ax)/len*wd); o.lineTo(bx - (by - ay)/len*wd, by + (bx - ax)/len*wd); o.fill(); }
    const sc = STAGE.lamps[0].c.map(v => Math.round(v*255)).join(',');
    for (let i = 0; i < STAGE.nSpots; i++) { const s = STAGE.spots.subarray(i*4, i*4 + 4); if (s[3] < .01) continue; const r = Math.max(1.5, s[2]*H);
      const g = o.createRadialGradient(X(s), Y(s), 0, X(s), Y(s), r); g.addColorStop(0, `rgba(${sc},${Math.min(1, s[3]*.8).toFixed(3)})`); g.addColorStop(1, `rgba(${sc},0)`);
      o.fillStyle = g; o.fillRect(X(s) - r, Y(s) - r, r*2, r*2); }
    o.lineCap = 'round';
    for (let i = 0; i < STAGE.nBeams; i++) { const z = STAGE.beams.subarray(i*4, i*4 + 4), c = STAGE.beamC.subarray(i*4, i*4 + 4), cs = `${Math.min(255, c[0]*255|0)},${Math.min(255, c[1]*255|0)},${Math.min(255, c[2]*255|0)}`;
      o.strokeStyle = `rgba(${cs},.3)`; o.lineWidth = c[3]*H*1.6; o.beginPath(); o.moveTo(X([z[0], z[1]]), Y([z[0], z[1]])); o.lineTo(X([z[2], z[3]]), Y([z[2], z[3]])); o.stroke();
      o.strokeStyle = `rgba(${cs},1)`; o.lineWidth = Math.max(1, c[3]*H*.35); o.stroke(); }
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
  },
};
