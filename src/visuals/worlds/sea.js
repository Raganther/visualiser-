// The night sea as a woodblock print: flat bands of wave stepping from pale far off to deep blue near, each crest edged
// with foam and carved with lines, under a huge moon wearing a ring of light, its path broken into glints on the water; a
// lighthouse on a dark headland swings its beam to a new angle each bar. The swell follows the bass, the nearest wave
// rises as the tension builds and throws spray on the drop, and each section moves the moon and re-forms the waves.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';

const HOR = -.04, NW = 5, MY = .24, MR = .075;   // the horizon's height; the waves' rows; the moon's height and size
const st = {D0:0, D1:0, tr:1, ty:null, n:0, lvl:.3, flare:0, drops:0, sw:0, bars:0, beam:.4, beamT:.4};
const fr = v => v - Math.floor(v), star = i => fr(Math.sin(i*91.7)*43758.5453);
const moonX = (D, asp) => asp*(-.15 + .5*fr(D*.37));
// row k's crest at x (0 far .. 4 near) in layout D; A = the layouts and the change (nearest first), B = swell, big wave
const crest1 = (x, k, t, D, sw, big) => { const n = k/(NW - 1), f = 14 - k*2.6, a = (.006 + .03*Math.pow(n, 1.5))*(1 + sw*.8)*(k === NW - 1 ? big : 1);
  const q = x*f + D*(1.7 + k) + t*(.25 + .12*k)*(k % 2 ? -1 : 1);
  return HOR - .02 - .42*Math.pow(n, 1.5) + a*Math.pow(1 - Math.abs(Math.sin(q)), 2) + a*.3*Math.sin(x*f*.37 + k + D); };
const crest = (x, k, t, A, big) => { let m = Math.min(1, Math.max(0, A[2]*1.4 - (NW - 1 - k)*.1)); m = m*m*(3 - 2*m);
  return m <= 0 ? crest1(x, k, t, A[0], A[3], big) : m >= 1 ? crest1(x, k, t, A[1], A[3], big) : crest1(x, k, t, A[0], A[3], big)*(1 - m) + crest1(x, k, t, A[1], A[3], big)*m; };
const H3 = HOR.toFixed(3);
export default {
  key: 'sea', kind: 'world', label: 'Night sea',
  light: {hue: .6, sat: .25, x: .2, y: .8},              // pale moonlight, from above
  horizonY: HOR,
  // calm, spacious, melodic music; a warm low end suits the swell
  suits: (rf, T) => -rf.perc*.4 + rf.low*.3 + rf.mid*.2 - T*.3 - (rf.hat || 0)*.3,
  onBeat(pos){ if (pos === 0) { st.bars++; st.beamT = .15 + .6*fr(st.bars*.618); } },   // the beam swings each bar
  params(P, x){
    const C = TUNE.sea, J = x.J, on = P.w.sea > .05;
    sectionLayout(st, 'seaD', J, on, x.dt, C.morphSecs);
    st.lvl += ((J ? J.tension : .4) - st.lvl)*Math.min(1, x.dt*.4);
    if (J && J.drops !== st.drops) { st.drops = J.drops; if (on) st.flare = 1; }
    st.flare = Math.max(0, st.flare - x.dt/1.5);
    st.sw += ((x.sBass || 0)*x.react - st.sw)*Math.min(1, x.dt*1.5);   // the swell, eased
    st.beam += (st.beamT - st.beam)*Math.min(1, x.dt*C.beamEase);
    const m = Math.min(1, st.tr*1.2), mm = m*m*(3 - 2*m);
    P.seaA = [st.D0, st.D1, st.tr, st.sw];
    P.seaB = [1 + C.bigWave*st.lvl, st.flare, st.beam, moonX(st.D0, x.asp)*(1 - mm) + moonX(st.D1, x.asp)*mm];
  },
  glsl: {
    uniforms: 'uniform vec4 uSeaA,uSeaB;',
    functions: `
float seaHue(){ return 0.6+0.06*sin(uHue*6.2831853); }   // night blue, only tinted by the palette
float seaC1(float x,float k,float D){ float n=k/${(NW - 1).toFixed(1)}, f=14.0-k*2.6, a=(0.006+0.03*pow(n,1.5))*(1.0+uSeaA.w*0.8)*(k>3.5 ? uSeaB.x : 1.0);
  float q=x*f+D*(1.7+k)+uTime*(0.25+0.12*k)*(mod(k,2.0)>0.5 ? -1.0 : 1.0);
  return ${H3}-0.02-0.42*pow(n,1.5)+a*pow(1.0-abs(sin(q)),2.0)+a*0.3*sin(x*f*0.37+k+D); }
float seaCrest(float x,float k){ float m=clamp(uSeaA.z*1.4-(4.0-k)*0.1,0.0,1.0); m=m*m*(3.0-2.0*m);
  if(m<=0.0) return seaC1(x,k,uSeaA.x); if(m>=1.0) return seaC1(x,k,uSeaA.y);
  return mix(seaC1(x,k,uSeaA.x),seaC1(x,k,uSeaA.y),m); }
vec3 seaSky(vec2 sp){
  float sh=seaHue(), t=clamp((sp.y-(${H3}))/0.5,0.0,1.0);
  vec2 mp=vec2(uSeaB.w,${MY.toFixed(3)}); float dm=length(sp-mp);
  vec3 c=mix(hsv(sh-0.04,0.3,0.62),hsv(sh+0.02,0.6,0.3),smoothstep(0.0,0.4,t));        // a pale, moonlit haze low down,
  c=mix(c,hsv(sh+0.06,0.8,0.05),smoothstep(0.35,1.0,t));                                 // deep indigo above
  c+=hsv(sh-0.02,0.2,0.5)*exp(-dm*5.0)*0.5;
  // long flat clouds, pale on top and shaded under, like cut paper
  for(int i=0;i<3;i++){ float fi=float(i), y=0.14+fi*0.1+0.012*sin(sp.x*2.3+fi*1.9), on=step(0.3,sin(sp.x*(1.1+fi*0.45)+fi*2.1+uTime*0.01));
    float d=sp.y-y; c=mix(c,hsv(sh-0.03,0.2,0.7-fi*0.12),on*smoothstep(0.024,0.02,abs(d-0.008)));
    c=mix(c,hsv(sh+0.02,0.4,0.28),on*smoothstep(0.009,0.006,abs(d+0.02))); }
  vec2 g=sp*70.0, cell=floor(g); float h=hash(cell);
  c+=vec3(0.8)*step(0.988,h)*smoothstep(0.35,0.0,length(fract(g)-0.5))*smoothstep(0.3,0.8,t)*(0.6+0.4*sin(uTime*1.7+h*50.0));
  // the ring: a halo well out from the moon, faintly coloured, brightening on the downbeat; the moon itself
  float ring=exp(-pow((dm-0.17)/0.014,2.0));
  c+=mix(hsv(uHue+0.02,0.35,1.0),hsv(uHue+0.55,0.35,1.0),smoothstep(0.16,0.18,dm))*ring*(0.22+0.15*uBeat);
  c=mix(c,vec3(1.0,0.97,0.86),smoothstep(${MR.toFixed(3)},${(MR - .004).toFixed(3)},dm));
  c-=vec3(0.1)*smoothstep(0.03,0.018,length(sp-mp-vec2(0.02,0.015)))*step(dm,${MR.toFixed(3)});
  // the lighthouse's beam: a solid cone from the lamp, swinging to a new angle each bar
  vec2 lh=vec2(-0.4*ASP,${H3}+0.1), d=sp-lh; float r=length(d), ang=atan(d.y,d.x);
  c+=hsv(uHue+0.12,0.2,1.0)*smoothstep(0.06,0.035,abs(ang-uSeaB.z))*exp(-r*1.1)*0.4*step(0.01,r);
  c+=hsv(uHue+0.12,0.2,1.0)*exp(-r*r*5000.0)*(0.8+0.6*uBeat);                          // the lamp
  return c;
}
vec3 sea(vec2 sp){
  float sh=seaHue(), t=uTime;
  // the waves, nearest first: the first whose crest stands above the pixel is drawn; its face lit under the crest, carved
  // lines along it, foam and flecks on the crest, the moon's path glinting across it
  for(int i=4;i>=0;i--){
    float k=float(i), cy=seaCrest(sp.x,k);
    if(sp.y<cy){
      float n=k/4.0, depth=cy-sp.y;
      vec3 far=hsv(sh-0.02,0.35,0.55), deep=hsv(sh+0.03,0.85,0.1);
      vec3 col=mix(mix(far,deep,pow(n,0.6)),mix(far,deep,min(1.0,pow(n,0.6)+0.35)),smoothstep(0.0,0.03+n*0.05,depth));
      col*=1.0-0.35*step(0.9,sin(depth*(220.0-n*120.0)+sin(sp.x*9.0+k)*1.5))*smoothstep(0.004,0.02,depth);
      float foam=exp(-depth*(500.0-n*250.0))+step(0.82,hash(floor(vec2(sp.x*120.0,depth*300.0))))*step(depth,0.01+n*0.012)*0.7;
      col=mix(col,vec3(0.93,0.95,1.0),min(1.0,foam*(0.75+0.25*uBeat+(k>3.5 ? uSeaB.y : 0.0))));
      float px=abs(sp.x-uSeaB.w)/(0.02+(${H3}-sp.y)*0.35);
      col+=vec3(1.0,0.93,0.72)*exp(-px*px*2.0)*step(0.6,hash(floor(vec2(sp.x*30.0,sp.y*260.0))+floor(t*4.0)))*(0.5+0.5*uBeat)*0.8;
      return col;
    }
  }
  vec3 c=seaSky(sp);
  // the headland and its lighthouse, black against the sky
  float hx=sp.x+0.4*ASP, hill=${H3}+0.07*exp(-hx*hx*14.0)+0.015*exp(-hx*hx*2.0);
  if(sp.y<hill||(abs(hx)<0.008-(sp.y-hill)*0.03&&sp.y<${H3}+0.1)) return hsv(sh+0.04,0.6,0.025);
  // spray thrown up off the nearest wave on the drop
  if(uSeaB.y>0.02){ float above=sp.y-seaCrest(sp.x,4.0);
    if(above>0.0&&above<0.12*uSeaB.y) c+=vec3(0.9)*step(0.9,hash(floor(sp*vec2(110.0,110.0))+floor(t*8.0)))*uSeaB.y; }
  return c;
}`,
    fn: 'sea',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uSeaA, P.seaA); gl.uniform4fv(u.uSeaB, P.seaB); },
  // its front plane: the nearest wave
  front: {
    fn: 'seaFront',
    glsl: `
float seaFront(vec2 sp){ return sp.y<seaCrest(sp.x,4.0) ? 1.0 : 0.0; }`,
    path2d(o, P, t){
      const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
      o.moveTo(0, H); for (let j = 0; j <= 120; j++) { const xs = (j/120 - .5)*asp; o.lineTo(X(xs), Y(crest(xs, NW - 1, t, P.seaA, P.seaB[0]))); }
      o.lineTo(W, H); o.closePath();
    },
  },
  draw2d(o, P, t){
    const W = o.canvas.width, H = o.canvas.height, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, a = Math.min(1, P.w.sea);
    const [big, flare, beam, mx] = P.seaB, bh = .6 + .06*Math.sin(P.hue*Math.PI*2);
    o.globalAlpha = a;
    const sky = o.createLinearGradient(0, Y(.46), 0, Y(HOR));
    sky.addColorStop(0, hc(bh + .06, 80, 3, 1)); sky.addColorStop(.6, hc(bh + .02, 55, 17, 1)); sky.addColorStop(1, hc(bh - .04, 30, 58, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, Y(HOR) + 1);
    for (let i = 0; i < 120; i++) { const sx = star(i)*W, sy = star(i + 500)*Y(.2); o.fillStyle = `rgba(220,225,240,${((.3 + .5*star(i + 900))*(.6 + .4*Math.sin(t*1.7 + i))).toFixed(3)})`; o.fillRect(sx, sy, 1.5, 1.5); }
    for (let i = 0; i < 3; i++) {   // long flat clouds, pale on top and shaded under
      const y = .14 + i*.1; o.fillStyle = hc(bh - .03, 20, 68 - i*11, 1);
      for (let j = 0; j < 90; j++) { const xs = (j/90 - .5)*asp; if (Math.sin(xs*(1.1 + i*.45) + i*2.1 + t*.01) < .3) continue;
        const yy = y + .012*Math.sin(xs*2.3 + i*1.9); o.fillRect(X(xs), Y(yy + .032), asp/90*u + 1, .044*u);
        o.fillStyle = hc(bh + .02, 40, 26, 1); o.fillRect(X(xs), Y(yy - .012), asp/90*u + 1, .012*u); o.fillStyle = hc(bh - .03, 20, 68 - i*11, 1); }
    }
    const glow = o.createRadialGradient(X(mx), Y(MY), 0, X(mx), Y(MY), .35*u);
    glow.addColorStop(0, hc(bh - .02, 20, 60, .4)); glow.addColorStop(1, hc(bh - .02, 20, 60, 0));
    o.fillStyle = glow; o.fillRect(0, 0, W, Y(HOR));
    o.strokeStyle = `rgba(235,228,215,${((.22 + .15*P.beat)*a).toFixed(3)})`; o.lineWidth = Math.max(1, .01*u);   // the ring
    o.beginPath(); o.arc(X(mx), Y(MY), .17*u, 0, Math.PI*2); o.stroke();
    o.fillStyle = '#fff8dc'; o.beginPath(); o.arc(X(mx), Y(MY), MR*u, 0, Math.PI*2); o.fill();
    const lx = X(-.4*asp), ly = Y(HOR + .1);   // the lighthouse's beam, swinging each bar
    const bg = o.createLinearGradient(lx, ly, lx + Math.cos(beam)*u, ly - Math.sin(beam)*u);
    bg.addColorStop(0, hc(P.hue + .12, 25, 88, .5)); bg.addColorStop(1, hc(P.hue + .12, 25, 88, 0));
    o.fillStyle = bg; o.beginPath(); o.moveTo(lx, ly); o.lineTo(lx + Math.cos(beam - .05)*u*1.3, ly - Math.sin(beam - .05)*u*1.3); o.lineTo(lx + Math.cos(beam + .05)*u*1.3, ly - Math.sin(beam + .05)*u*1.3); o.closePath(); o.fill();
    o.fillStyle = hc(bh + .04, 60, 2.5, 1); o.beginPath(); o.moveTo(0, Y(HOR));   // the headland and its tower
    for (let j = 0; j <= 40; j++) { const hx = (j/40)*.5 - .25; o.lineTo(X(-.4*asp + hx), Y(HOR + .07*Math.exp(-hx*hx*14) + .015*Math.exp(-hx*hx*2))); }
    o.lineTo(X(-.4*asp + .25), Y(HOR)); o.fill();
    o.fillRect(lx - .008*u, ly, .016*u, Y(HOR + .07) - ly + 1);
    o.fillStyle = `rgba(255,245,215,${Math.min(1, .8 + .6*P.beat).toFixed(3)})`; o.beginPath(); o.arc(lx, ly, .006*u, 0, Math.PI*2); o.fill();
    for (let k = 0; k < NW; k++) {   // the waves, far to near: pale to deep blue, foam on the crests
      const n = k/(NW - 1), pts = []; for (let j = 0; j <= 160; j++) { const xs = (j/160 - .5)*asp; pts.push([X(xs), Y(crest(xs, k, t, P.seaA, big))]); }
      const top = Math.min(...pts.map(p => p[1])), p6 = Math.pow(n, .6), g = o.createLinearGradient(0, top, 0, top + (.05 + n*.08)*u);
      g.addColorStop(0, hc(bh - .02 + .05*p6, 35 + 50*p6, 55 - 45*p6, 1)); g.addColorStop(1, hc(bh - .02 + .05*Math.min(1, p6 + .35), 35 + 50*Math.min(1, p6 + .35), 55 - 45*Math.min(1, p6 + .35), 1));
      o.fillStyle = g; o.beginPath(); o.moveTo(0, H); for (const [x, y] of pts) o.lineTo(x, y); o.lineTo(W, H); o.fill();
      o.strokeStyle = `rgba(238,242,255,${Math.min(1, .75 + .25*P.beat + (k === NW - 1 ? flare : 0)).toFixed(3)})`; o.lineWidth = Math.max(1, (1 + n*2)*u*.0015);
      o.beginPath(); pts.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y)); o.stroke();
      o.fillStyle = 'rgba(255,240,200,.6)';   // the moon's path, broken into glints
      const wy = (H/2 - top)/u, wd = (.02 + (HOR - wy)*.35)*u;
      for (let q = 0; q < 14; q++) { if (star(q*13 + k*7 + Math.floor(t*4)) < .5) continue;
        o.fillRect(X(mx) + (star(q + k*31) - .5)*2*Math.abs(wd), top + (2 + star(q*3 + k)*.04*u), 3 + n*6, 1.5); }
      if (k === NW - 1 && flare > .02) { o.fillStyle = `rgba(235,240,255,${flare.toFixed(3)})`;   // spray on the drop
        for (let q = 0; q < 60; q++) { const j = Math.floor(star(q + Math.floor(t*8))*160); o.fillRect(pts[j][0], pts[j][1] - star(q*5)*.12*flare*u, 2, 2); } }
    }
    o.globalAlpha = 1;
  },
};
