// Fractal: the Kali set (fold a point by its own distance, p = |p|/dot(p,p) - c, seven times), mirrored n ways, lit where
// its orbit passes near the axes: lacy, organic filigree that grows new structure as c drifts and the view breathes in
// and out of it. The music moves it: c steps on each bar and drifts with the tension, the kick flares it, and now and
// then a new symmetry. The user asked for "some sort of evolving fractal" to explore, beside the kaleidoscope. Simple
// mode draws the same fractal at low resolution, scaled up.
const st = {cx: .6, cy: .5, tx: .6, ty: .5, n: 6};
const IT = 7, K = 18, DEC = .7;
function kali(qx, qy, cx, cy, zoom, n){   // the same sum as the shader's
  const s = Math.PI*2/n; let a = Math.atan2(qy, qx); a = ((a % s) + s) % s; a = Math.abs(a - s/2);
  const r = Math.hypot(qx, qy)*zoom; qx = r*Math.cos(a); qy = r*Math.sin(a);
  let g = 0, w = .3;
  for (let i = 0; i < IT; i++) { const d = qx*qx + qy*qy + 1e-6; qx = Math.abs(qx)/d - cx; qy = Math.abs(qy)/d - cy; g += Math.exp(-Math.min(Math.abs(qx), Math.abs(qy))*K)*w; w *= DEC; }
  return g;
}
let can = null, img = null;
export default {
  key: 'fractal', kind: 'layer', label: 'Fractal',
  suits: {mid:.2, bright:.3, T:.1},   // what music it suits (features centred on 0): melodic, bright
  overWorld: -.4,   // how well it sits over a world: it's a place of its own
  paint: 1.85,   // paint order in the trails: before the mandalas
  accent: 'bar',   // how it fires when it's the accent
  onBeat(pos){   // each bar a small step to a new shape; now and then a new symmetry
    if (pos !== 0) return;
    st.tx = .5 + Math.random()*.35; st.ty = .4 + Math.random()*.35;
    if (Math.random() < .1) st.n = [5, 6, 7, 8][Math.floor(Math.random()*4)];
  },
  params(P, x){
    const T = x.J.tension, k = Math.min(1, x.dt*.4);   // (glides over a few seconds: the shape grows rather than jumps)
    st.cx += (st.tx + T*.08 - st.cx)*k; st.cy += (st.ty - st.cy)*k;
    // breathing in and out of itself over about 20 s, so detail keeps opening up
    P.frac = [x.t*.03, st.cx + x.sBass*x.react*.01, st.cy, 1.6*Math.exp(Math.sin(x.t*.05)*.5)]; P.fracN = st.n;
  },
  feedback: {
    uniforms: 'uniform vec4 uFrac; uniform float uFracN;   // turn, c, zoom; folds',
    functions: `
float fracG(vec2 q){
  float s=6.2831853/uFracN, a=mod(atan(q.y,q.x)+uFrac.x,s); a=abs(a-s*0.5);
  q=length(q)*uFrac.w*vec2(cos(a),sin(a));
  float g=0.0, w=0.3;
  for(int i=0;i<${IT};i++){ q=abs(q)/(dot(q,q)+1e-6)-uFrac.yz; g+=exp(-min(abs(q.x),abs(q.y))*${K.toFixed(1)})*w; w*=${DEC}; }
  return g;
}`,
    main: `
  {
    float g=fracG(p);
    col+=hsv(uHue+uPal.y+g*0.3,0.55,1.0)*uL_fractal*min(g*g,1.5)*(0.6+uBeat*0.4);
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uFrac && P.frac) { gl.uniform4fv(u.uFrac, P.frac); gl.uniform1f(u.uFracN, P.fracN || 6); } },
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x;
    if (!(P.l.fractal > .01) || !P.frac) return;
    const W = 128, H = 72, cw = c.canvas.width, ch = c.canvas.height;
    if (!can) { can = document.createElement('canvas'); can.width = W; can.height = H; img = can.getContext('2d').createImageData(W, H); }
    const [turn, cx, cy, zoom] = P.frac, n = P.fracN || 6, lvl = Math.min(1, P.l.fractal)*(.5 + P.beat*.4)*255;
    const hue = ((P.hue + P.pal[1]) % 1 + 1) % 1, rgb = [0, 1/3, 2/3].map(o => .55 + .45*Math.cos((hue - o)*Math.PI*2));
    const ox = (sx(P.cx) - cw/2)/ch, oy = (sy(P.cy) - ch/2)/ch, ca = Math.cos(turn), sa = Math.sin(turn);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const px = ((i + .5)/W - .5)*cw/ch - ox, py = (j + .5)/H - .5 - oy;
      const g = kali(px*ca + py*sa, -px*sa + py*ca, cx, cy, zoom, n), v = Math.min(1, g*g*1.8)*lvl, o = (j*W + i)*4;
      img.data[o] = v*rgb[0]; img.data[o + 1] = v*rgb[1]; img.data[o + 2] = v*rgb[2]; img.data[o + 3] = 255;
    }
    can.getContext('2d').putImageData(img, 0, 0);
    c.save(); c.globalCompositeOperation = 'lighter'; c.imageSmoothingEnabled = true; c.drawImage(can, 0, 0, cw, ch); c.restore();
  },
};
