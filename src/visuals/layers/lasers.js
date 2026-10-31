// Lasers: thin beams from below the screen, fanning and sweeping like a club's; the pattern changes every two bars
// (a fan, beams crossing from the corners, a turning star round the centre, a scan from above), brightest on the hats and kick.
// With a centrepiece on screen (scene/subject.js) they play round it: the beams lean in to shine at it, a ring of them from
// round the screen aims in at it, and each catches on it with a flare, by the genome's material (scene/genome.js) stopping
// there (stone, neon), splitting into a rainbow through it (glass) or glancing off it (metal); on the kick a pulse of light
// leaves the object and runs back out along every beam. With the genome's symmetry its stars, fans and rings have its count,
// and its motif picks the show.
import { genN, genMotif, genMat } from '../../scene/genome.js';
import { SUBJ, subjTouch } from '../../scene/subject.js';
import { TUNE } from '../../tuning.js';
import { lasers3d, BEAMS } from '../../scene/lasers3d.js';
import { COND } from '../../scene/conductor.js';
import { SPACE } from '../../scene/space.js';
import { hsv2rgb } from '../../util.js';
const N = 12, LA = new Float32Array(N*4), HIT = new Float32Array(N*4);   // the beams for the shader: x, y, angle, hue (under -5: off); where each meets the object (along it, out of it, -, -)
const MAT = [[1.8, .55, 0, 0], [1, .8, 1, 1], [1, .9, 0, 0], [.8, .25, 0, 2]];   // by the genome's material: width, saturation, rainbow split, what the object does to a beam (0 stops it, 1 glass, 2 metal)
const PLAN = [0, 1, 2, 3], BY_MOTIF = [0, 1, 4, 2];   // the shows in turn; the genome's motif's own: a rose a fan, a pointed arch the crossing, a hexagon the ring, a star the star
let bars = 0, kickAt = -9;
export default {
  key: 'lasers', kind: 'layer', label: 'Lasers',
  suits: {perc:.3, T:.3, hat:.6},   // what music it suits (features centred on 0): the full, driving parts, hats in
  overWorld: .2,   // how well it sits over a world
  paint: 2.5,   // paint order in the trails: ribbons, horizon, lasers, comets, shockwaves, flow
  accent: 'bar', altAccent: 'hit',   // how it fires when it's the accent
  onBeat(pos){ if (pos === 0) bars++; },
  params(P, x){
    // in 3D round the centrepiece (scene/lasers3d.js): the beams traced against it, drawn after the objects; none here
    BEAMS.n = 0;
    if (TUNE.lasers3d.on && SPACE.on > .02) {
      const m = genMotif(), c = COND.on && COND.key ? COND.las : null, w3 = P.l.lasers || 0;
      lasers3d({show: c ? c.show : m != null ? m : Math.floor(bars/4) % 3, n: c ? c.n : genN(3, 8) || 6, phase: c ? c.phase : x.t*.15, sweep: c ? c.sweep : .3, narrow: c ? c.narrow : 0,
        bright: (c ? c.bright : .6 + (P.beat || 0)*.6)*SPACE.on, mat: genMat() ?? 1, t: x.t, w: w3, cols: [0, 1, 2].map(i => hsv2rgb((P.hue || 0) + P.pal[i], .75, 1))});
      for (let i = 0; i < N; i++) LA[i*4 + 3] = -9; P.lasers = LA; P.lasHit = HIT.fill(0); P.lasM = MAT[1]; P.lasS = [0, 0, 0, 3]; return;
    }
    const t = x.t, hw = x.asp/2, sw = Math.sin(t*.8), beams = [], T = TUNE.lasers, sub = SUBJ.on > .05 ? SUBJ : null;
    const g = genN(3, N), m = genMotif(), aim = sub ? sub.on*T.aim : 0;
    // the show: in turn every two bars; with the genome its motif's own every other turn; with an object the ring that aims at it every other
    const turn = Math.floor(bars/2), pat = sub && turn % 2 ? 4 : m != null && turn % 2 === 0 ? BY_MOTIF[m] : PLAN[turn % 4];
    const cx = sub ? sub.x : P.cx, cy = sub ? sub.y : P.cy, k = g || 0;
    if (pat === 0) { const n = k || 7; for (let i = 0; i < n; i++) beams.push([0, -.58, Math.PI/2 + (i/(n - 1) - .5)*(1 + .25*Math.sin(t*.5)) + sw*.35, i]); }   // a fan from below
    else if (pat === 1) { const n = Math.min(N, k ? k + k % 2 : 8), h = n/2; for (let i = 0; i < n; i++) { const s = i < h ? -1 : 1, j = i % h;   // crossing from the two corners
      beams.push([s*hw, -.56, Math.PI/2 + s*(.35 + j*.72/h) - sw*.2, i]); } }   // (leaning inward, so they cross: they leaned out, off the screen)
    else if (pat === 2) { const n = k || 8; for (let i = 0; i < n; i++) beams.push([cx, cy, t*.5 + i*Math.PI*2/n, i]); }   // a star turning round the centre (or out of the object)
    else if (pat === 3) { const n = Math.min(N, k || 6); for (let i = 0; i < n; i++) beams.push([Math.sin(t*.3)*hw*.5, .58, -Math.PI/2 + (i/Math.max(1, n - 1) - .5)*.5 + sw*.6, i]); }   // a scan from above
    else { const n = k || 6, R = Math.max(.75, hw*1.1); for (let i = 0; i < n; i++) { const a = t*.12 + i*Math.PI*2/n, ox = cx + Math.cos(a)*R, oy = cy + Math.sin(a)*R;   // a ring from round the screen, all aimed in
      beams.push([ox, oy, Math.atan2(cy - oy, cx - ox) + Math.sin(t*.7 + i)*.03, i]); } }
    // with an object, every beam from outside it leans in to shine at it
    if (sub && pat !== 2) for (const b of beams) { const want = Math.atan2(sub.y - b[1], sub.x - b[0]); let d = want - b[2]; d = Math.atan2(Math.sin(d), Math.cos(d)); b[2] += d*aim*(pat === 4 ? 1 : .85); }
    const M = MAT[genMat() ?? 2], kick = (P.beat || 0) > .8;
    if (kick && x.t - kickAt > .15) kickAt = x.t;
    for (let i = 0; i < N; i++) { const b = beams[i];
      if (!b) { LA[i*4+3] = -9; continue; }
      LA[i*4] = b[0]; LA[i*4+1] = b[1]; LA[i*4+2] = b[2]; LA[i*4+3] = P.pal[b[3] % 3];
      // where it meets the object (a circle on screen): the entry along the beam, and how far it travels inside
      let t0 = -1, t1 = -1;
      if (sub && pat !== 2) { const dx = Math.cos(b[2]), dy = Math.sin(b[2]), ox = b[0] - sub.x, oy = b[1] - sub.y, bb = ox*dx + oy*dy, c = ox*ox + oy*oy - sub.r*sub.r, D = bb*bb - c;
        if (D > 0) { const s = Math.sqrt(D); t0 = -bb - s; t1 = -bb + s; if (t0 < 0) t0 = t1 = -1; else subjTouch(b[0] + dx*t0, b[1] + dy*t0, sub.on*(.5 + .5*(P.beat || 0))); } }
      HIT[i*4] = t0; HIT[i*4+1] = t1; HIT[i*4+2] = sub && pat === 2 ? sub.r : 0; HIT[i*4+3] = sub ? sub.on : 0;
    }
    P.lasers = LA; P.lasHit = HIT; P.lasM = M; P.lasS = [sub ? sub.x : 0, sub ? sub.y : 0, sub ? sub.r : 0, Math.min(3, x.t - kickAt)];
  },
  feedback: {
    uniforms: 'uniform vec4 uLas[12], uLasH[12], uLasM, uLasS;   // the beams; where each meets the object; the material: width, saturation, rainbow, what it does; the object, the time since the kick',
    functions: `
vec3 lasRay(vec2 sp,vec2 o,vec2 dir,float a0,float a1,float w,float hue,float sat){   // one beam from o, between a0 and a1 along it
  vec2 dv=sp-o; float al=dot(dv,dir); if(al<a0||al>a1) return vec3(0.0);
  float pd=abs(dv.x*dir.y-dv.y*dir.x); if(pd>=0.03*w) return vec3(0.0);
  return hsv(uHue+hue,sat,1.0)*(smoothstep(0.0035*w,0.0,pd)+0.22*smoothstep(0.03*w,0.0,pd))*exp(-al*0.45);
}`,
    main: `
  for(int i=0;i<12;i++){
    vec4 lb=uLas[i]; if(lb.w<-5.0) continue;
    vec4 lh=uLasH[i]; vec2 dir=vec2(cos(lb.z),sin(lb.z));
    float lv=uL_lasers*(0.4+uTreb*uReact*0.9+uBeat*0.9), w=uLasM.x, end=lh.x>0.0 ? lh.x : 99.0;
    vec3 c=lasRay(sp,lb.xy,dir,lh.z,end,w,lb.w,uLasM.y);   // (a star from the object starts at its rim)
    float age=uLasS.w, run=lh.x>0.0 ? lh.x-age*1.6 : lh.z+age*1.6;   // the kick's pulse: out of the object, back along the beam (or out from the star's heart)
    vec2 dv=sp-lb.xy; float al=dot(dv,dir), pd=abs(dv.x*dir.y-dv.y*dir.x);
    c+=hsv(uHue+lb.w,uLasM.y*0.6,1.0)*exp(-pow((al-run)/0.05,2.0))*smoothstep(0.012*w,0.0,pd)*exp(-age*1.4)*step(0.0,run)*0.6*lh.w;   // (only round an object)
    if(lh.x>0.0){   // it meets the object: a flare where it catches, then by the material
      vec2 hp=lb.xy+dir*lh.x, nn=normalize(hp-uLasS.xy);
      c+=hsv(uHue+lb.w,uLasM.y*0.5,1.0)*exp(-dot(sp-hp,sp-hp)/(0.0004*w))*0.35*lh.w;   // (small: it builds up in the trails)
      if(uLasM.w>0.5&&uLasM.w<1.5){   // glass: through it, split into a rainbow fanning out beyond
        vec2 ep=lb.xy+dir*lh.y; vec2 pn=vec2(-dir.y,dir.x);
        for(int k=0;k<3;k++){ float f=float(k)-1.0; vec2 d2=normalize(dir+pn*f*0.06*uLasM.z); c+=lasRay(sp,ep,d2,0.0,99.0,w*0.8,float(k)*0.33,1.0)*0.7*lh.w; }
      } else if(uLasM.w>1.5){   // metal: glancing off it
        vec2 rd=reflect(dir,nn); c+=lasRay(sp,hp,rd,0.0,99.0,w,lb.w,uLasM.y)*0.8*lh.w;
      }
    }
    col+=c*lv;
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uLas[0]'] && P.lasers) { gl.uniform4fv(u['uLas[0]'], P.lasers); gl.uniform4fv(u['uLasH[0]'], P.lasHit); gl.uniform4fv(u.uLasM, P.lasM); gl.uniform4fv(u.uLasS, P.lasS); } },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.lasers > .01) || !P.lasers) return;
    const a = Math.min(1, P.l.lasers*(.4 + P.treb*P.react*.9 + P.beat*.9)), L = P.lasers, H = P.lasHit, M = P.lasM;
    const line = (x0, y0, an, l0, l1, h, sat, al, wd) => { c.beginPath(); c.moveTo(sx(x0 + Math.cos(an)*l0), sy(y0 + Math.sin(an)*l0)); c.lineTo(sx(x0 + Math.cos(an)*l1), sy(y0 + Math.sin(an)*l1));
      glowStroke(c, q => `hsla(${hsl(P.hue + h)},${sat}%,60%,${Math.min(1, q).toFixed(3)})`, al, u*.6*wd); };
    for (let i = 0; i < N; i++) { const h = L[i*4+3]; if (h < -5) continue;
      const ox = L[i*4], oy = L[i*4+1], an = L[i*4+2], t0 = H[i*4], t1 = H[i*4+1];
      line(ox, oy, an, H[i*4+2], t0 > 0 ? t0 : 2.5, h, Math.round(M[1]*100), a, M[0]);
      if (t0 > 0) {   // where it catches on the object, and what the material does to it
        const hx = ox + Math.cos(an)*t0, hy = oy + Math.sin(an)*t0, s = P.lasS;
        c.fillStyle = `hsla(${hsl(P.hue + h)},60%,80%,${Math.min(1, a*H[i*4+3]).toFixed(3)})`; c.beginPath(); c.arc(sx(hx), sy(hy), u*.012*M[0], 0, Math.PI*2); c.fill();
        if (M[3] === 1) for (let k = -1; k <= 1; k++) line(ox + Math.cos(an)*t1, oy + Math.sin(an)*t1, an + k*.06*M[2], 0, 2.5, (k + 1)*.33, 100, a*.7, M[0]*.8);
        else if (M[3] === 2) { const nx = hx - s[0], ny = hy - s[1], nl = Math.hypot(nx, ny) || 1, dx = Math.cos(an), dy = Math.sin(an), dn = (dx*nx + dy*ny)/nl;
          line(hx, hy, Math.atan2(dy - 2*dn*ny/nl, dx - 2*dn*nx/nl), 0, 2.5, h, Math.round(M[1]*100), a*.8, M[0]); }
      }
    }
  },
};
