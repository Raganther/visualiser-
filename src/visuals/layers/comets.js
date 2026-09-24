// Comets: three glowing heads that roam and turn on the pulse, leaving trails.
export default {
  key: 'comets', kind: 'layer', label: 'Comets',
  suits: {busy:.4, T:-.2},   // what music it suits (features centred on 0)
  overWorld: .3,   // how well it sits over a world
  paint: 3,   // paint order in the trails: ribbons, horizon, comets, shockwaves, flow
  accent: 'hit', altAccent: 'bar',   // how it fires when it's the accent
  params(P, x){ P.comets = x.comets; },
  feedback: {
    uniforms: 'uniform vec3 uComets[3];',
    main: `
  for(int i=0;i<3;i++){
    vec3 cm=uComets[i];
    float dd=length(sp-cm.xy);
    col+=hsv(uHue+float(i)*0.33,0.75,1.0)*uL_comets*cm.z*(smoothstep(0.018,0.0,dd)+0.35*smoothstep(0.06,0.0,dd));
  }`,
  },
  fbUniforms(gl, u, P){
    const ca = new Float32Array(9);
    P.comets.forEach((c, i) => { ca[i*3] = c.x; ca[i*3+1] = c.y; ca[i*3+2] = c.z; });
    if (u['uComets[0]']) gl.uniform3fv(u['uComets[0]'], ca);
  },
  trails2d(c, P, x){
    const {u, bw, bh, sx, sy, hsl, glowStroke} = x;
    if (P.l.comets > .01) P.comets.forEach((cm, j) => {
      const x = sx(cm.x), y = sy(cm.y), rad = u*.06, h = hsl(P.hue + j*.33), a = Math.min(1, P.l.comets*cm.z);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `hsla(${h},80%,75%,${a})`); g.addColorStop(.3, `hsla(${h},90%,55%,${a*.4})`); g.addColorStop(1, `hsla(${h},90%,50%,0)`);
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad*2, rad*2);
    });
  },
};
