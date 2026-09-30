// String art: the times table on a circle. Ninety pins round a ring, each joined by a thread to the pin at its number
// times m; as m slides from one whole number to the next (one step each phrase, eased over its first bar) the threads
// weave a cardioid, then a nephroid, then flowers of more petals, and in between they swirl. The ring turns slowly, the
// bass swells it, the threads nearest the pin being walked light up in turn with the beat. Symmetric, calm geometry (the
// user's taste, principle 9). Simple mode draws the same threads.
import { S } from '../../state.js';
const N = 90, st = {m: 2, from: 2, to: 2, t: 1, phase: -1, walk: 0};
const hh = x => { const s = Math.sin(x*91.7)*43758.5; return s - Math.floor(s); };
export default {
  key: 'chords', kind: 'layer', label: 'String art',
  suits: {mid:.25, bright:.1, T:0},   // what music it suits (features centred on 0): steady, a little melodic
  overWorld: -.1,   // how well it sits over a world
  paint: 1.97,   // paint order in the trails: with the mandalas
  accent: 'bar',   // how it fires when it's the accent
  onBeat(){ st.walk = (st.walk + N/16) % N; },   // the light walks round the pins with the beat
  params(P, x){
    const J = x.J, ph = Math.floor(((J.bar || 0) - (J.phraseAnchor || 0))/4);
    if (ph !== st.phase) {   // a phrase line: on to the next times table (bigger steps when the music is intense)
      if (st.phase !== -1) { st.from = st.m; const T = J.tension || 0; st.to = 2 + (st.to - 2 + 1 + Math.floor(T*2 + hh(ph)*1.5)) % 9; st.t = 0; }   // (2 to 10, a step of one to three)
      st.phase = ph;
    }
    st.t = Math.min(1, st.t + x.dt/Math.max(1, 4*Math.max(.25, S.beatPeriod || .5)));
    const e = st.t*st.t*(3 - 2*st.t); st.m = st.from + (st.to - st.from)*e;
    P.chord = [st.m, .3*(1 + x.sBass*x.react*.06*x.dim), x.t*.03, st.walk];
  },
  feedback: {
    uniforms: 'uniform vec4 uChord;   // the multiplier, the ring\'s radius, its turn, the pin the light is at',
    main: `
  {
    float R=uChord.y, r=length(p);
    if(r<R*1.03){
      float g=0.0, tw=6.2831853/${N}.0;
      for(int i=0;i<${N};i++){
        float fi=float(i), a0=fi*tw+uChord.z, a1=fi*uChord.x*tw+uChord.z;
        vec2 A=R*vec2(cos(a0),sin(a0)), B=R*vec2(cos(a1),sin(a1)), ab=B-A;
        float h=clamp(dot(p-A,ab)/max(dot(ab,ab),1e-6),0.0,1.0), d=length(p-A-ab*h);
        float lit=exp(-pow(mod(fi-uChord.w+${N}.0*0.5,${N}.0)-${N}.0*0.5,2.0)/18.0);   // near the walking light
        g+=(smoothstep(0.0018,0.0,d)+0.15*smoothstep(0.006,0.0,d))*(0.55+1.2*lit);
      }
      g+=smoothstep(0.004,0.0,abs(r-R))*0.8;   // the ring of pins
      col+=hsv(uHue+uPal.z+r*0.6,0.5,1.0)*uL_chords*min(g,1.6)*0.4;
    }
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uChord && P.chord) gl.uniform4fv(u.uChord, P.chord); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.chords > .01) || !P.chord) return;
    const cx = sx(P.cx), cy = sy(P.cy), [m, R0, turn] = P.chord, R = R0*u, tw = Math.PI*2/N;
    const pt = a => [cx + Math.cos(a + turn)*R, cy - Math.sin(a + turn)*R];
    c.beginPath();
    for (let i = 0; i < N; i++) { c.moveTo(...pt(i*tw)); c.lineTo(...pt(i*m*tw)); }
    c.moveTo(cx + R, cy); c.arc(cx, cy, R, 0, Math.PI*2);
    glowStroke(c, al => `hsla(${hsl(P.hue + P.pal[2])},50%,65%,${Math.min(1, al).toFixed(3)})`, Math.min(1, P.l.chords)*.45, u*.35);
  },
};
