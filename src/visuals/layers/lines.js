// Waveform lines: a stack of lines like a mountain range seen edge on (the Unknown Pleasures sleeve), each a peak of the
// spectrum and a little noise, the nearer hiding the farther, rolling slowly towards you; they swell with the bass.
import { dataArr } from '../../state.js';

const NL = 26, GAP = .027, Y0 = -.36, XW = .36;   // lines, spacing, the nearest's place, half the width
// one line's height above its place at x (the same in both renderers): a peak in the middle, of the spectrum and noise
const lineH = (x, id, s, bass) => { const ax = Math.abs(x), k = Math.max(0, Math.min(1, (XW - .02 - ax)/(XW - .07))), e = k*k*(3 - 2*k);
  const sp = dataArr[256 + Math.floor(((ax*1.3 + ((id*.618) % 1)*.5) % 1)*255)]/255;
  const n = Math.sin(x*47 + id*7.31)*Math.sin(x*19 - id*3.17 + s*2)*.5 + .5;
  return e*e*(sp*.07 + n*.035)*(.6 + bass*1.2); };
export default {
  key: 'lines', kind: 'layer', label: 'Waveform lines',
  suits: {mid:.3, T:-.2, low:.4},   // what music it suits (features centred on 0)
  overWorld: -.4,   // how well it sits over a world
  paint: 1.5,   // paint order in the trails: ribbons, lines, horizon, lasers, comets, shockwaves, flow
  accent: 'peak',   // how it fires when it's the accent
  params(P, x){ P.lnScroll = x.t*.35; },
  feedback: {
    uniforms: 'uniform float uLnScroll;',
    functions: `
float lnH(float x,float id){
  float ax=abs(x), e=smoothstep(${(XW - .02).toFixed(2)},0.05,ax);
  float s=texture2D(uData,vec2(0.502+fract(ax*1.3+fract(id*0.618)*0.5)*0.497,0.5)).r;
  float n=sin(x*47.0+id*7.31)*sin(x*19.0-id*3.17+uLnScroll*2.0)*0.5+0.5;
  return e*e*(s*0.07+n*0.035)*(0.6+uBass*uReact*1.2);
}
// the nearest line first: a pixel under a line's curve is hidden by it (the lines behind don't show there)
vec4 wlines(vec2 sp){
  if(abs(sp.x)>${XW.toFixed(2)}||sp.y<${(Y0 - .02).toFixed(2)}) return vec4(0.0);
  float fr=fract(uLnScroll), base=floor(uLnScroll);
  for(int j=0;j<${NL};j++){
    float fj=float(j), y0=${Y0.toFixed(2)}+(fj+1.0-fr)*${GAP}, f=min(1.0,fj+1.0-fr)*min(1.0,${NL - 1}.0-fj+fr);
    float d=sp.y-(y0+lnH(sp.x,fj+base));
    if(d<0.0005) return vec4(hsv(uHue+uPal.x,0.25,1.0)*f*(smoothstep(0.003,0.0,abs(d))+0.06*smoothstep(0.012,0.0,abs(d))),1.0);
    if(d<0.012) return vec4(hsv(uHue+uPal.x,0.25,1.0)*f*(0.06*smoothstep(0.012,0.0,d)+smoothstep(0.003,0.0,d)),0.0);
  }
  return vec4(0.0);
}`,
    main: `
  { vec4 wl=wlines(sp+disp); col=col*(1.0-wl.a*uL_lines*0.75)+wl.rgb*uL_lines*(0.35+uBeat*0.35+uHit*0.3); }`,
  },
  fbUniforms(gl, u, P){ gl.uniform1f(u.uLnScroll, P.lnScroll); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x;
    if (!(P.l.lines > .01)) return;
    const s = P.lnScroll, fr = s - Math.floor(s), base = Math.floor(s), a = Math.min(1, P.l.lines*(.5 + P.beat*.5)), bass = P.bass*P.react;
    c.lineWidth = Math.max(1, u*.003);
    for (let j = NL - 1; j >= 0; j--) {   // the farthest first: each nearer one's black hides what's behind it
      const y0 = Y0 + (j + 1 - fr)*GAP, f = Math.min(1, j + 1 - fr)*Math.min(1, NL - 1 - j + fr);
      const line = new Path2D();
      for (let k = 0; k <= 60; k++) { const xx = (k/60*2 - 1)*XW, yy = y0 + lineH(xx, j + base, s, bass); k ? line.lineTo(sx(xx), sy(yy)) : line.moveTo(sx(xx), sy(yy)); }
      const under = new Path2D(line); under.lineTo(sx(XW), sy(Y0 - .02)); under.lineTo(sx(-XW), sy(Y0 - .02)); under.closePath();
      c.globalCompositeOperation = 'source-over'; c.fillStyle = `rgba(0,0,0,${(.6*Math.min(1, P.l.lines)).toFixed(3)})`; c.fill(under);
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = `hsla(${hsl(P.hue + P.pal[0])},25%,85%,${(a*f).toFixed(3)})`; c.stroke(line);
    }
  },
};
