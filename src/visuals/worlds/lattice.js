// The Lattice: a tunnel of glass facets flown through, its walls a polygon (six to twelve sides, a section's own) cut into
// triangles, each facet lighting in patterns with the music, as the prism's do (the user loves the faceted objects' facets
// lighting up, and the 3D worlds' depth):
// - each kick sends a ring of light rushing away down the tunnel;
// - stabs light a spiral stripe of facets winding down it, stepping on round with each stab;
// - the hi-hats light a new random handful of facets each 16th; the melody turns a helix of light along it;
// - in a drop's run-up the light rushes back towards the camera as the drop nears, and the drop surges the flight and
//   flashes the whole tunnel; the tunnel turns slowly, faster in a build, and breathes with the bass;
// - each facet is tilted a little its own way, so they glint as they pass under the camera's light.
// Cheap: one ray against a polygonal tube, no marching. A centrepiece floats in the tunnel ahead (P.anchor). Its front plane
// is the near walls. Simple mode draws the facets as quads between rings of the polygon, far to near.
import { hc, sectionLayout } from '../../util.js';
import { TUNE } from '../../tuning.js';
import { S } from '../../state.js';
import { SIG } from '../../scene/signals.js';

const st = {D0: 0, D1: 0, tr: 1, ty: null, n: 0, z: 0, sp: 0, surge: 0, drop: null, wave: 9, lt: null, roll: 0, sec: 0, secT: -9, lastHit: 0, s16: 0, bars: 0, t: 0, kickT: -9};
const hh = x => { const s = Math.sin(x*91.7)*43758.5453; return s - Math.floor(s); };
const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const LC = 1.4, RW = 1.6;   // a ring of facets every LC units; the tunnel's radius
// a section's tunnel: its sides, the spiral's step, how many stripes
const LOOK = D => [[6, 8, 10, 12][Math.floor(hh(D + .3)*4)], 1 + Math.floor(hh(D + 1.1)*3), [2, 3, 4][Math.floor(hh(D + 2.3)*3)]];
export const latticeAt = z => { st.z = z; };   // (for tests: put the camera this far along)
export default {
  key: 'lattice', kind: 'world', lowRes: () => 1, heavy: () => true, label: 'The Lattice',
  light: {hue: .55, sat: .5, x: 0, y: .2},
  // steady, driving music with things going on over the beat
  suits: (rf, T) => rf.perc*.25 + rf.busy*.2 + T*.2 + rf.bright*.05,
  onBeat(pos){ if (pos === 0) st.bars++; },
  params(P, x){
    const T = TUNE.lattice, J = x.J, on = P.w.lattice > .05, ten = (J && J.tension) || 0, bp = Math.max(.25, S.beatPeriod);
    sectionLayout(st, 'ltD', J, on, x.dt, T.morphSecs);
    st.t += x.dt;
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null && on) st.surge = 1; st.drop = J.lastDrop; }
    st.surge *= Math.exp(-x.dt/T.surgeSecs);
    const want = T.speed*(T.calm + (1 - T.calm)*ten)*(1 + T.surge*st.surge);
    st.sp += (want - st.sp)*Math.min(1, x.dt*.8);
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;
    if (on) { st.z += st.sp*mdt; st.roll += mdt*T.turn*(.3 + ten + st.surge*2); }
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; st.wave = 0; }
    st.wave += x.dt;
    if (x.hit > .8 && st.lastHit <= .8) { st.sec++; st.secT = st.t; }
    st.lastHit = x.hit;
    st.s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : Math.floor(st.t/(bp/4)) % 16;
    const A = LOOK(st.D0), B = LOOK(st.D1), L0 = st.tr < .5 ? A : B, anticip = (J && J.anticip) || 0;
    P.lt = [st.z, st.roll, L0[0], RW*(1 + (P.bass || 0)*x.react*T.breath)];
    P.lt2 = [st.wave*T.waveSpeed, Math.exp(-st.wave*T.waveFade)*x.dim, st.sec % L0[2], .35 + .65*Math.exp(-(st.t - st.secT)*2.5)];
    P.lt3 = [(st.s16 + st.bars*16) % 256, Math.min(1, SIG.hat*1.4)*T.hatShare, Math.min(1, (SIG.harm || 0) + (P.mid || 0)*x.react*.5), anticip > .02 ? (1 - anticip)*T.anticipDist : 999];
    P.lt4 = [x.t, st.surge*x.dim, L0[1], L0[2]];
    P.ltM = st.tr;
    // the centrepiece floats in the tunnel ahead (the camera's straight down it)
    if (P.w.lattice > .5) { const dz = T.gate - (st.z % T.gate); if (dz < 1.5) P.anchor = {hide: true}; else P.anchor = {pos: [0, 0], size: T.heartSize/dz/1.25/.49, dist: dz}; }
    P.ltF = P.anchor && P.anchor.dist ? P.anchor.dist : 2.5;
  },
  glsl: {
    uniforms: `uniform vec4 uLt, uLt2, uLt3, uLt4; uniform float uLtF, uLtG;   // the Lattice: where along it, its turn, sides, radius; the kick's wave, the stabs' stripe and fade; the hats' step and share, the melody, a drop's run-up; time, the surge, the spiral's step and stripes; the front plane's depth; the glow`,
    functions: `
float ltHash(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
// the ray down the tunnel, turned by its roll; where it meets the wall: t, the side, across it (0..1), along it
vec4 ltHit(vec2 sp,out vec3 rd){
  float c=cos(uLt.y), s=sin(uLt.y); vec2 q=mat2(c,-s,s,c)*sp;
  rd=normalize(vec3(q*1.25,1.0));
  float N=uLt.z, seg=6.2831853/N, a=atan(rd.y,rd.x), si=floor(a/seg+0.5);
  vec2 n=vec2(cos(si*seg),sin(si*seg)); float ap=uLt.w*cos(seg*0.5), t=ap/max(dot(rd.xy,n),1e-3);
  vec2 h=rd.xy*t; float w=dot(h,vec2(-n.y,n.x))/(uLt.w*sin(seg*0.5))*0.5+0.5;
  return vec4(t,mod(si,N),w,uLt.x+rd.z*t);
}
vec3 lattice(vec2 sp){
  vec3 rd; vec4 H=ltHit(sp,rd); float t=H.x, N=uLt.z;
  if(t>80.0) return vec3(0.0);
  float zz=H.w/${LC.toFixed(1)}, k=floor(zz), v=fract(zz), u=H.z, s=H.y;
  bool flip=mod(s+k,2.0)>0.5; float up=flip ? step(1.0,u+v) : step(v,u);   // the quad's two triangles, the diagonal alternating
  float fid=s+N*(k*2.0+up), sd=ltHash(fid*0.37);
  // edges: across, along, and the diagonal (in world units, widened with distance so they stay a line)
  float du=min(u,1.0-u)*uLt.w*1.0, dv=min(v,1.0-v)*${LC.toFixed(1)}, dd=(flip ? abs(u+v-1.0) : abs(u-v))*0.7*${LC.toFixed(1)};
  float e=min(min(du,dv),dd), lw=0.012+t*0.0025, edge=smoothstep(lw,0.0,e)+0.25*smoothstep(lw*5.0,0.0,e);
  // the facet's light: the kick's ring rushing away, the stabs' spiral stripe, the hats, the helix, the run-up, the drop
  float ahead=k*${LC.toFixed(1)}-uLt.x, wave=exp(-pow((ahead-uLt2.x)*0.4,2.0))*uLt2.y;
  float stripe=abs(mod(s+k*uLt4.z+uLt4.w*8.0,uLt4.w)-uLt2.z)<0.5 ? uLt2.w*0.8 : 0.0;
  float hat=uLt3.y>0.0&&ltHash(fid*0.11+uLt3.x*17.1)<uLt3.y ? 1.0 : 0.0;
  float hel=pow(max(0.0,cos(s/N*6.2831853*2.0-k*0.45-uLt4.x*1.2)),10.0)*uLt3.z;
  float run=ahead>uLt3.w ? 0.9 : 0.0;
  vec3 pal3=hsv(uHue+(mod(s,3.0)<1.0 ? uPal.x : mod(s,3.0)<2.0 ? uPal.y : uPal.z),0.7,1.0);
  vec3 lc=hsv(uHue+uPal.x,0.75,1.0)*(wave+run)+hsv(uHue+uPal.y,0.8,1.0)*stripe+hsv(uHue+uPal.z,0.25,1.0)*hat+hsv(uHue+uPal.z,0.9,1.0)*hel+vec3(uLt4.y*1.2);
  // the glass: dark, tinted, each facet tilted its own way catching the camera's light as it passes
  float tilt=0.35+0.65*pow(max(0.0,sin(sd*6.2831853+k*0.7)),4.0)*smoothstep(12.0,2.0,t);
  vec3 col=pal3*(0.04+0.1*tilt)+lc*0.55+edge*(pal3*0.35+lc*0.8);
  return col*uLtG*exp(-t*0.045);
}`,
    fn: 'lattice',
  },
  uniforms(gl, u, P){ gl.uniform4fv(u.uLt, P.lt); gl.uniform4fv(u.uLt2, P.lt2); gl.uniform4fv(u.uLt3, P.lt3); gl.uniform4fv(u.uLt4, P.lt4); gl.uniform1f(u.uLtF, P.ltF || 2.5); gl.uniform1f(u.uLtG, TUNE.lattice.glow); },
  front: {
    fn: 'latticeFront',
    glsl: `
float latticeFront(vec2 sp){ vec3 rd; vec4 H=ltHit(sp,rd); return H.x*rd.z<uLtF ? 1.0 : 0.0; }`,
    path2d(o, P){ const W = o.canvas.width, H2 = o.canvas.height, b = H2*.12; o.rect(0, 0, W, b); o.rect(0, H2 - b, W, b); o.rect(0, b, b, H2 - 2*b); o.rect(W - b, b, b, H2 - 2*b); },
  },
  // simple mode: the facets as quads (two triangles) between rings of the polygon, far to near
  draw2d(o, P){
    const W = o.canvas.width, Hh = o.canvas.height, a = Math.min(1, P.w.lattice), [z0, roll, N, R] = P.lt, [wd, wb, sIdx, sFade] = P.lt2, [step, share, hel, run] = P.lt3, [tt, surge, sStep, sN] = P.lt4;
    const pal = P.pal || [0, .33, .66], seg = Math.PI*2/N;
    o.globalAlpha = a; o.fillStyle = '#000'; o.fillRect(0, 0, W, Hh);
    const pt = (i, z) => { const ang = i*seg - seg/2 + Math.PI/2*0, x = Math.cos(ang + 0)*R, y = Math.sin(ang)*R, c = Math.cos(-roll), s = Math.sin(-roll);
      const xr = c*x - s*y, yr = s*x + c*y, dz = Math.max(.05, z - z0); return [W/2 + xr/dz/1.25*Hh, Hh/2 - yr/dz/1.25*Hh]; };
    o.lineJoin = 'round';
    for (let k = Math.floor(z0/LC) + 40; k >= Math.floor(z0/LC); k--) {
      const za = k*LC, zb = za + LC; if (zb - z0 < .2) continue;
      const ahead = za - z0, fog = Math.exp(-Math.max(.5, ahead)*.045), wave = Math.exp(-(((ahead - wd)*.4)**2))*wb;
      for (let s = 0; s < N; s++) for (let up = 0; up < 2; up++) {
        const fid = s + N*(k*2 + up), flip = (s + k) % 2 === 1;
        const stripe = Math.abs(((s + k*sStep + sN*8) % sN) - sIdx) < .5 ? sFade*.8 : 0, hat = share > 0 && hash(fid*.11 + step*17.1) < share ? 1 : 0;
        const hl = Math.max(0, Math.cos(s/N*Math.PI*4 - k*.45 - tt*1.2))**10*hel, rn = ahead > run ? .9 : 0;
        const tot = wave + rn + stripe + hat + hl + surge*1.2;
        // corners: this side's two edges, at this ring and the next
        const A = pt(s, za), B = pt(s + 1, za), C = pt(s + 1, zb), D = pt(s, zb);
        const tri = flip ? (up ? [B, C, D] : [A, B, D]) : (up ? [A, B, C] : [A, C, D]);
        const hue = P.hue + pal[s % 3], lhue = P.hue + (stripe > Math.max(wave, hat, hl) ? pal[1] : hat > Math.max(wave, hl) ? pal[2] : pal[0]);
        o.beginPath(); o.moveTo(...tri[0]); o.lineTo(...tri[1]); o.lineTo(...tri[2]); o.closePath();
        o.fillStyle = tot > .05 ? hc(lhue, 75, 50, Math.min(1, tot*.5)*fog) : hc(hue, 60, 12, fog); o.fill();
        o.strokeStyle = hc(tot > .05 ? lhue : hue, 70, 60, Math.min(1, (.35 + tot*.8)*fog)); o.lineWidth = 1; o.stroke();
      }
    }
    o.globalAlpha = 1;
  },
};
