// Shockwaves: rings that ripple out on the pulse and push everything they pass through.
// They live in the trails: they draw in the feedback pass and displace everything there. Their motion is in fx/effects.js.
export default {
  key: 'shock', kind: 'hit', label: 'Shockwaves', trigger: 'pulse', level: .8, inTrails: true,
  words: 'Shockwaves ripple out on the kicks',
  // busy, driving music; less suited to a world
  suits: (rf, wOn, seed) => rf.busy*.4 + rf.low*.3 + rf.T*.2 + seed - (wOn ? .2 : 0),
  params(P, x){ P.shockW = Math.max(x.eff.shock, x.J.dropGlow); P.shocks = x.shocks; },   // drops flash the rings too
  feedback: {
    uniforms: 'uniform vec4 uShocks[8];\nuniform float uShockW;',
    functions: `
// shockwave fronts push everything they pass through
vec2 shockDisp(vec2 sp){
  vec2 d=vec2(0.0);
  for(int i=0;i<8;i++){
    vec4 sh=uShocks[i];
    vec2 v=sp-sh.xy; float l=length(v)+0.0001; float x=(l-sh.z)/0.05;
    d+=v/l*sh.w*exp(-x*x)*0.035;
  }
  return d*uShockW;
}`,
    displace: 'shockDisp(sp)',
    main: `
  for(int i=0;i<8;i++){
    vec4 sh=uShocks[i];
    float dd=abs(length(sp-sh.xy)-sh.z);
    col+=hsv(uHue+0.5+sh.z*0.3,0.7,1.0)*uShockW*sh.w*(smoothstep(0.006+sh.z*0.015,0.0,dd)+0.3*smoothstep(0.03+sh.z*0.03,0.0,dd));
  }`,
    paint: 4,
  },
  fbUniforms(gl, u, P){
    const sa = new Float32Array(32);
    P.shocks.forEach((h, i) => { sa[i*4] = h.x; sa[i*4+1] = h.y; sa[i*4+2] = h.r; sa[i*4+3] = h.s; });
    if (u['uShocks[0]']) gl.uniform4fv(u['uShocks[0]'], sa); gl.uniform1f(u.uShockW, P.shockW);
  },
  paint2d: 2,
  trails2d(c, P, x){
    const {u, bw, bh, sx, sy, hsl, glowStroke} = x;
    if (P.shockW > .01) P.shocks.forEach(sh => {
      if (sh.s < .02) return;
      c.beginPath(); c.arc(sx(sh.x), sy(sh.y), sh.r*u, 0, Math.PI*2);
      c.lineWidth = u*(.006 + sh.r*.015);
      c.strokeStyle = `hsla(${hsl(P.hue + .5 + sh.r*.3)},80%,60%,${Math.min(1, P.shockW*sh.s)})`; c.stroke();
    });
  },
};
