// Mood ring: a soft halo round the subject in the colour of the music's mood, the way a mood ring changes. The key sets its
// hue (round the circle of fifths, so related keys sit near each other), tone against noise its richness, how full the music
// is its brightness; it breathes with the bass and shifts slowly, as a mood does. It keeps its own colour, not the palette's.
import { L } from '../../audio/listen.js';

const M = {h: .6, s: .5, v: .5, bh: 0};
const hsv = (h, s, v) => { const f = n => { const k = (n + h*6) % 6; return v - v*s*Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
export default {
  key: 'mood', kind: 'layer', label: 'Mood ring',
  suits: {mid:.4, T:-.1, low:.1},   // what music it suits (features centred on 0): melodic, with a key to read
  overWorld: .4,   // how well it sits over a world: round the planet, the moon
  paint: 1.7,   // paint order in the trails
  accent: 'mid',   // how it fires when it's the accent
  params(P, x){
    const fifths = L.key >= 0 ? ((L.key*7) % 12)/12 : M.h;   // C, G, D, A… round the wheel
    let dh = fifths - M.h; if (dh > .5) dh -= 1; if (dh < -.5) dh += 1;
    const k = Math.min(1, x.dt*.25);   // it shifts over several seconds, as a mood does
    M.h = ((M.h + dh*k) % 1 + 1) % 1; M.s += ((.35 + .6*(1 - L.noise)) - M.s)*k; M.v += ((.35 + .65*L.full) - M.v)*k;
    M.bh += (x.sBass*x.react - M.bh)*Math.min(1, x.dt*6);
    P.mood = [...hsv(M.h, M.s, M.v), .25*(1 + M.bh*.12)]; P.moodSpin = x.t*.2;
  },
  feedback: {
    uniforms: 'uniform vec4 uMood; uniform float uMoodSpin;   // its colour and radius, and its shimmer\'s turn',
    main: `
  {
    float r=length(p), d=abs(r-uMood.w);
    if(d<0.08){
      float a=atan(p.y,p.x)+uMoodSpin, sh=0.75+0.25*sin(a*5.0)*sin(a*3.0-uMoodSpin*2.0);   // a slow shimmer round it
      col+=uMood.rgb*uL_mood*sh*(smoothstep(0.01,0.0,d)*0.22+smoothstep(0.08,0.0,d)*0.05);
    }
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uMood && P.mood) { gl.uniform4fv(u.uMood, P.mood); gl.uniform1f(u.uMoodSpin, P.moodSpin); } },
  trails2d(c, P, x){
    const {u, sx, sy} = x;
    if (!(P.l.mood > .01) || !P.mood) return;
    const [r, g, b, R] = P.mood, a = Math.min(1, P.l.mood), col = al => `rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},${Math.min(1, al).toFixed(3)})`;
    c.beginPath(); c.arc(sx(P.cx), sy(P.cy), R*u, 0, Math.PI*2);
    c.strokeStyle = col(.08*a); c.lineWidth = .08*u; c.stroke();
    c.strokeStyle = col(.3*a); c.lineWidth = Math.max(1, .01*u); c.stroke();
  },
};
