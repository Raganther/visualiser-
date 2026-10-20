// The rose window: stained glass in rings round the centre, each ring's cells lit in patterns with the music, as the
// prism's facets are (the user loved the faceted objects' facets lighting up; this is the same idea flat, in the glow):
// - each kick sends a cascade out from the middle, ring by ring, a ring each 16th;
// - stabs light one of the section's wedges (3 to 8 of them) and step it on round;
// - the hi-hats light a new random handful of cells each 16th;
// - the melody turns a spiral through it;
// - in a drop's run-up it lights from the rim inwards, closing in as the drop nears;
// - the rings turn slowly, each the other way from the last, and its cells grow finer as a section runs;
// - the stabs' pattern comes in after 4 bars of a section, the hats' after 8, as the prism's do (TUNE.rosette).
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';
import { SIG } from '../../scene/signals.js';

const W = new Float32Array(4), K = new Float32Array(4), SS = new Float32Array(4), M = new Float32Array(4);
const st = {waves: [], sec: 0, secT: -9, t: 0, s16: -1, bars: 0, secBars: 0, type: undefined, n: 6, per: 6, lastHit: 0, kickT: -9, turn: 0};
const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0)/4294967296; };
const tids = new WeakMap(); let tidN = 0; const tid = t => t == null ? 0 : tids.get(t) || (tids.set(t, ++tidN), tidN);   // a section type's own number (types are objects)
export default {
  key: 'rosette', kind: 'layer', label: 'Rose window',
  suits: {perc:.4, busy:.2, mid:.1, T:.1},   // what music it suits (features centred on 0): a steady beat with things going on over it
  overWorld: -.2,   // how well it sits over a world: it's a picture of its own
  paint: 1.4,   // paint order in the trails
  accent: 'stab',   // how it fires when it's the accent
  onBeat(pos){ if (pos === 0) { st.bars++; st.secBars++; } },
  params(P, x){
    const T = TUNE.rosette, J = x.J, dt = x.dt, bp = Math.max(.25, S.beatPeriod), ten = J ? J.tension || 0 : .5;
    st.t += dt;
    const type = J && J.on ? J.type : null;
    if (type !== st.type) { st.type = type; st.secBars = 0; const h = hashStr('r' + tid(type));
      st.n = [3, 4, 5, 6, 8][Math.floor(hash(h*7)*5)]; st.per = [6, 8, 6, 12][Math.floor(hash(h*11)*4)]; }
    if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; st.waves.push(st.t); if (st.waves.length > 2) st.waves.shift(); }
    if (x.hit > .8 && st.lastHit <= .8) { st.sec++; st.secT = st.t; }
    st.lastHit = x.hit;
    const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : Math.floor(st.t/(bp/4)) % 16;
    if (s16 !== st.s16) st.s16 = s16;
    st.turn += dt*T.turn*(.4 + ten);
    const rings = T.rings + Math.min(T.grow, Math.floor(st.secBars/8));   // finer as the section runs
    W[0] = rings/T.span; W[1] = rings; W[2] = st.per; W[3] = st.turn;
    // the kick's cascades: where each front is, in rings (a ring a 16th), and how bright
    for (let i = 0; i < 2; i++) { const t0 = st.waves[st.waves.length - 1 - i]; const a = t0 == null ? 1e9 : (st.t - t0)/(bp/4);
      K[i*2] = a; K[i*2 + 1] = t0 == null || a > rings + 2 ? 0 : 1 - .3*i; }
    SS[0] = st.sec % st.n; SS[1] = st.secBars >= T.layerBars.stab ? .35 + .65*Math.exp(-(st.t - st.secT)*2.5) : 0; SS[2] = st.n; SS[3] = (st.s16 + st.bars*16) % 256;
    const anticip = (J && J.anticip) || 0;
    M[0] = anticip > .02 ? (1 - anticip)*rings : 99; M[1] = st.secBars >= T.layerBars.hat ? Math.min(1, SIG.hat*1.4)*T.hatShare : 0;
    M[2] = Math.min(1, (SIG.harm || 0) + (P.mid || 0)*x.react*.5); M[3] = x.t;
    P.rose = {W, K, SS, M};
  },
  feedback: {
    uniforms: 'uniform vec4 uRwW, uRwK, uRwS, uRwM;',
    functions: `
float rwHash(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }`,
    main: `
  {
    float rr=length(p)*uRwW.x, ri=floor(rr);
    if(ri<uRwW.y&&uL_rosette>0.001){
      float ns=max(1.0,ri*uRwW.z), dir=mod(ri,2.0)*2.0-1.0;
      float a=fract(atan(p.y,p.x)/6.2831853+0.5+uRwW.w*dir/(ri+1.0)), sa=a*ns, si=floor(sa);
      float er=min(fract(rr),1.0-fract(rr))/uRwW.x, ea=ri<0.5 ? 1.0 : min(fract(sa),1.0-fract(sa))/ns*6.2831853*length(p);
      float edge=smoothstep(0.0035,0.0,min(er,ea));
      float ac=(si+0.5)/ns-uRwW.w*dir/(ri+1.0), id=ri*131.0+si;
      float k=max(uRwK.y*exp(-pow((ri-uRwK.x)/0.55,2.0)),uRwK.w*exp(-pow((ri-uRwK.z)/0.55,2.0)));
      float s=abs(floor(mod(ac*uRwS.z+8.0*uRwS.z,uRwS.z))-uRwS.x)<0.5 ? uRwS.y : 0.0;
      float h=uRwM.y>0.0&&rwHash(id*0.37+uRwS.w*17.1)<uRwM.y ? 1.0 : 0.0;
      float m=ri>=uRwM.x ? 0.8 : 0.0;
      float sp=pow(max(0.0,cos(ac*6.2831853*2.0-ri*0.9-uRwM.w*1.5)),8.0)*uRwM.z;
      vec3 lc=hsv(uHue+uPal.x,0.75,1.0)*(k+m)+hsv(uHue+uPal.y,0.8,1.0)*s+hsv(uHue+uPal.z,0.25,1.0)*h+hsv(uHue+uPal.z,0.9,1.0)*sp;
      float tot=k+s+h+m+sp;
      col+=uL_rosette*(lc*0.045*(ri<0.5 ? 0.3 : 1.0)+edge*(hsv(uHue+uPal.x+ri*0.04,0.6,1.0)*0.03+lc*0.14+vec3(tot*0.015)));   // (small: it builds up in the trails)
    }
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uRwW && P.rose) { gl.uniform4fv(u.uRwW, P.rose.W); gl.uniform4fv(u.uRwK, P.rose.K); gl.uniform4fv(u.uRwS, P.rose.SS); gl.uniform4fv(u.uRwM, P.rose.M); } },
  // simple mode: each lit cell filled as an arc of its ring, then the rings' and cells' lines
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x;
    if (!(P.l.rosette > .01) || !P.rose) return;
    const {W: Wr, K: Kr, SS: Sr, M: Mr} = P.rose, cx = sx(P.cx), cy = sy(P.cy), a0 = Math.min(1, P.l.rosette), unit = u/Wr[0];
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let ri = 0; ri < Wr[1]; ri++) {
      const ns = Math.max(1, ri*Wr[2]), dir = ri % 2 ? 1 : -1, r0 = ri*unit, r1 = (ri + 1)*unit;
      const k = Math.max(Kr[1]*Math.exp(-(((ri - Kr[0])/.55)**2)), Kr[3]*Math.exp(-(((ri - Kr[2])/.55)**2))), m = ri >= Mr[0] ? .8 : 0;
      for (let si = 0; si < ns; si++) {
        const ac = (si + .5)/ns - Wr[3]*dir/(ri + 1), s = Math.abs(Math.floor(((ac*Sr[2]) % Sr[2] + Sr[2]*8) % Sr[2]) - Sr[0]) < .5 ? Sr[1] : 0;
        const h = Mr[1] > 0 && hash((ri*131 + si)*.37 + Sr[3]*17.1) < Mr[1] ? 1 : 0, sp = Math.max(0, Math.cos(ac*Math.PI*4 - ri*.9 - Mr[3]*1.5))**8*Mr[2];
        const tot = k + s + h + m + sp; if (tot < .05) continue;
        const hue = s > Math.max(k, h, sp) ? P.pal[1] : h > Math.max(k, sp) ? P.pal[2] : P.pal[0];
        // (the canvas's y runs down: angles mirrored)
        const b0 = -((si/ns - Wr[3]*dir/(ri + 1) - .5)*Math.PI*2), b1 = -(((si + 1)/ns - Wr[3]*dir/(ri + 1) - .5)*Math.PI*2);
        c.beginPath(); if (ri) { c.arc(cx, cy, r1, b0, b1, true); c.arc(cx, cy, r0, b1, b0, false); } else c.arc(cx, cy, r1, 0, Math.PI*2);
        c.closePath(); c.fillStyle = `hsla(${hsl(P.hue + hue)},75%,55%,${Math.min(1, tot*.14*a0*(ri ? 1 : .3)).toFixed(3)})`; c.fill();
      }
    }
    c.strokeStyle = `hsla(${hsl(P.hue + P.pal[0])},60%,60%,${(.06*a0).toFixed(3)})`; c.lineWidth = 1; c.beginPath();
    for (let ri = 1; ri <= Wr[1]; ri++) { c.moveTo(cx + ri*unit, cy); c.arc(cx, cy, ri*unit, 0, Math.PI*2); }
    c.stroke(); c.restore();
  },
};
