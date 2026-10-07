// Fractal: an endless dive into a snowflake fractal (fold n ways, turn, scale, shift, again: branches carrying smaller
// branches). Four octaves are nested, each growing out of the heart of the one before and fading as it passes the screen's
// edge, so the fall never ends: the octave at the centre is always being born. The user asked for "constantly zooming in
// on a fractal ... it keeps unfolding forever". The music shapes each octave as it's born (calm: few folds, gentle
// branches; intense: more folds, sharper and denser), the tension sets the speed of the fall, a drop is a surge, each
// kick sends a flash racing out through the octaves, and the bass swells the branches. The vortex (the "Fractal
// vortex" setting, or Journey now and then) twists the dive into a logarithmic whirlpool that spins as it falls, turning
// the other way after each drop. Simple mode draws the same dive at low resolution, scaled up.
import { TUNE } from '../../tuning.js';
const N = 4, IT = 7, REACH = .55;
const st = {depth: 0, lt: null, surge: 0, drop: null, echo: 9, vort: 0, dir: 1, oct: []};
const hh = x => { const s = Math.sin(x*12.9898)*43758.5453; return s - Math.floor(s); };
// an octave's shape, chosen as it's born from the music at that moment: folds, branch angle, branching scale, hue
function born(id, T){
  const F = TUNE.fractal, h = hh(id + 1.3), h2 = hh(id*1.7 + 4.1);
  const folds = F.folds[Math.min(F.folds.length - 1, Math.floor(T*F.folds.length*.8 + h*F.folds.length*.5))];
  return {id, n: folds, ang: .18 + .12*T + h2*.2, k: 1.5 + .12*folds + (hh(id + 9.2) - .3)*.25, hue: (((id % 3) + 3) % 3)};   // (more folds need a bigger scale, or it fills the plane)
}
function octave(id, T){ let o = st.oct.find(o => o.id === id); if (!o) { o = born(id, T); st.oct.push(o); if (st.oct.length > 8) st.oct.shift(); } return o; }
const U = new Float32Array(N*8);   // the octaves for the shader: (folds, angle, scale, weight), (turn, reach, hue, zoom)
// the same sum as the shader's: one octave's branches at q (pw: a pixel, in q's units)
function flake(qx, qy, o, pw){
  const s = Math.PI*2/o.n, ca = Math.cos(o.ang), sa = Math.sin(o.ang), R = o.reach; let G = 0, sc = 1, w = 1;
  for (let i = 0; i < IT; i++) {
    let a = Math.atan2(qy, qx); a = ((a % s) + s) % s; a = Math.abs(a - s/2); const r = Math.hypot(qx, qy); qx = r*Math.cos(a); qy = r*Math.sin(a);
    const px = pw*sc*1.5, ay = Math.abs(qy);
    if (ay < px && qx >= (i === 0 ? R*.4 : 0) && qx < R) G += (1 - ay/px)*w;
    if (i === 0) { const d = Math.abs(r - R*.4); if (d < px*1.5) G += (1 - d/px/1.5)*.7; }
    const x2 = ca*qx - sa*qy, y2 = sa*qx + ca*qy; qx = x2*o.k - R; qy = y2*o.k; sc *= o.k; w *= .75;
    if (qx*qx + qy*qy > 36 || R/sc/pw < 5) break;
  }
  return G;
}
let can = null, img = null;
export default {
  key: 'fractal', kind: 'layer', label: 'Fractal',
  suits: {mid:.2, bright:.3, T:.1},   // what music it suits (features centred on 0): melodic, bright
  overWorld: -.4,   // how well it sits over a world: it's a place of its own
  paint: 1.85,   // paint order in the trails: before the mandalas
  accent: 'bar',   // how it fires when it's the accent
  onBeat(){ st.echo = 0; },   // each kick: a flash racing out through the octaves
  params(P, x){
    const F = TUNE.fractal, J = x.J, T = J.tension || 0;
    const mdt = st.lt == null ? 0 : Math.min(.1, Math.max(0, x.t - st.lt)); st.lt = x.t;
    if (st.drop !== J.lastDrop) { if (st.drop != null) { st.surge = F.surge; st.dir = -st.dir; } st.drop = J.lastDrop; }   // a drop: a surge, and the vortex turns the other way
    st.surge *= Math.exp(-x.dt/F.surgeSecs);
    st.depth += mdt*F.speed*(F.calm + (1 - F.calm)*T)*(1 + st.surge);
    st.echo += x.dt*F.echoSpeed;
    st.vort += ((x.eff.fracVortex || 0)*st.dir - st.vort)*Math.min(1, x.dt*1.5);   // (eases in, and through 0 when it turns)
    const fl = Math.floor(st.depth), fr = st.depth - fl, swell = 1 + x.sBass*x.react*.06*x.dim;
    for (let j = 0; j < N; j++) {
      const k = j + fr, o = octave(fl - j, T), wt = Math.min(1, k/.8)*Math.min(1, (N - k));
      U.set([o.n, o.ang, o.k, wt*wt*(3 - 2*wt), (fl - j)*2.39996 + x.t*.02 + st.vort*k*1.2, REACH*swell, o.hue, Math.pow(F.octave, -k)*F.octave**N*.33], j*8);
      o.reach = REACH*swell;
    }
    P.frac = U; P.fracV = [st.vort, Math.log(.05) + st.echo, Math.exp(-st.echo*.5)*x.dim, fr];
  },
  feedback: {
    uniforms: 'uniform vec4 uFracO[8]; uniform vec4 uFracV;   // each octave: (folds, angle, scale, weight), (turn, reach, hue, zoom); the vortex, the kick\'s flash (where, how bright)',
    functions: `
float fracFlake(vec2 q,vec4 a,vec4 b,float pw){   // one octave's branches, lines a pixel or so wide at every scale
  float s=6.2831853/a.x, ca=cos(a.y), sa=sin(a.y), R=b.y, G=0.0, sc=1.0, w=1.0;
  for(int i=0;i<${IT};i++){
    float an=mod(atan(q.y,q.x),s); an=abs(an-s*0.5); float r=length(q); q=r*vec2(cos(an),sin(an));
    float px=pw*sc*1.5;
    G+=max(0.0,1.0-abs(q.y)/px)*step(i==0?R*0.4:0.0,q.x)*step(q.x,R)*w;
    if(i==0) G+=max(0.0,1.0-abs(r-R*0.4)/(px*1.5))*0.7;
    q=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y)*a.z-vec2(R,0.0); sc*=a.z; w*=0.75;
    if(dot(q,q)>36.0||R/sc/pw<5.0) break;
  }
  return G;
}`,
    main: `
  {
    vec2 v=p; float lr=log(length(p)+1e-4);
    if(uFracV.x!=0.0){ float tw=uFracV.x*lr*0.9, c=cos(tw), s=sin(tw); v=mat2(c,s,-s,c)*v; }   // the vortex: a logarithmic spiral
    float flash=uFracV.z*exp(-pow((lr-uFracV.y)*2.0,2.0));                                      // the kick's flash, racing outwards
    for(int j=0;j<4;j++){
      vec4 a=uFracO[j*2], b=uFracO[j*2+1]; if(a.w<0.002) continue;
      float c=cos(b.x), s=sin(b.x); vec2 q=mat2(c,s,-s,c)*v*b.w;
      float g=fracFlake(q,a,b,b.w/uRes.y);
      col+=hsv(uHue+(b.z<0.5?uPal.x:b.z<1.5?uPal.y:uPal.z)+float(j)*0.03,0.6,1.0)*uL_fractal*min(g,1.2)*a.w*(0.3+flash*0.9+uBeat*0.2);
    }
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uFracO[0]'] && P.frac) { gl.uniform4fv(u['uFracO[0]'], P.frac); gl.uniform4fv(u.uFracV, P.fracV); } },
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x;
    if (!(P.l.fractal > .01) || !P.frac) return;
    const W = 128, H = 72, cw = c.canvas.width, ch = c.canvas.height, A = P.frac, [vort, front, fl] = P.fracV;
    if (!can) { can = document.createElement('canvas'); can.width = W; can.height = H; img = can.getContext('2d').createImageData(W, H); }
    const lvl = Math.min(1, P.l.fractal)*(.3 + P.beat*.2)*255, oct = [], ox = (sx(P.cx) - cw/2)/ch, oy = (sy(P.cy) - ch/2)/ch;
    for (let j = 0; j < N; j++) {
      const o = j*8, hue = ((P.hue + P.pal[A[o + 6]] + j*.03) % 1 + 1) % 1;
      oct.push({n: A[o], ang: A[o + 1], k: A[o + 2], wt: A[o + 3], turn: A[o + 4], reach: A[o + 5], zoom: A[o + 7], rgb: [0, 1/3, 2/3].map(h => .6 + .4*Math.cos((hue - h)*Math.PI*2))});
    }
    img.data.fill(0);
    for (let jy = 0; jy < H; jy++) for (let ix = 0; ix < W; ix++) {
      let px = ((ix + .5)/W - .5)*cw/ch - ox, py = -((jy + .5)/H - .5 - oy);
      const lr = Math.log(Math.hypot(px, py) + 1e-4);
      if (vort) { const t = vort*lr*.9, c0 = Math.cos(t), s0 = Math.sin(t); [px, py] = [c0*px - s0*py, s0*px + c0*py]; }
      const flash = fl*Math.exp(-(((lr - front)*2)**2)), o = (jy*W + ix)*4; let r = 0, g = 0, b = 0;
      for (const O of oct) {
        if (O.wt < .002) continue;
        const c0 = Math.cos(O.turn), s0 = Math.sin(O.turn), v = Math.min(1.2, flake((c0*px - s0*py)*O.zoom, (s0*px + c0*py)*O.zoom, O, O.zoom/H))*O.wt*(1 + flash*3);
        r += v*O.rgb[0]; g += v*O.rgb[1]; b += v*O.rgb[2];
      }
      img.data[o] = Math.min(255, r*lvl); img.data[o + 1] = Math.min(255, g*lvl); img.data[o + 2] = Math.min(255, b*lvl); img.data[o + 3] = 255;
    }
    can.getContext('2d').putImageData(img, 0, 0);
    c.save(); c.globalCompositeOperation = 'lighter'; c.imageSmoothingEnabled = true; c.drawImage(can, 0, 0, cw, ch); c.restore();
  },
};
