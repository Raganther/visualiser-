// Lasers: thin beams from below the screen, fanning and sweeping like a club's; the pattern changes every two bars
// (a fan, beams crossing from the corners, a turning star round the centre, a scan from above), brightest on the hats and kick.
const LA = new Float32Array(32), N = 8;   // the beams for the shader, reused each frame: x, y, angle, hue (under -5: off)
let bars = 0;
export default {
  key: 'lasers', kind: 'layer', label: 'Lasers',
  suits: {perc:.6, T:.6, bright:.3},   // what music it suits (features centred on 0)
  overWorld: .2,   // how well it sits over a world
  paint: 2.5,   // paint order in the trails: ribbons, horizon, lasers, comets, shockwaves, flow
  accent: 'bar', altAccent: 'hit',   // how it fires when it's the accent
  onBeat(pos){ if (pos === 0) bars++; },
  params(P, x){
    const t = x.t, pat = Math.floor(bars/2) % 4, hw = x.asp/2, sw = Math.sin(t*.8), beams = [];
    if (pat === 0) for (let i = 0; i < 7; i++) beams.push([0, -.58, Math.PI/2 + (i/6 - .5)*(1 + .25*Math.sin(t*.5)) + sw*.35, i]);   // a fan from below
    else if (pat === 1) for (let i = 0; i < 8; i++) { const s = i < 4 ? -1 : 1, k = i % 4;   // crossing from the two corners
      beams.push([s*hw, -.56, Math.PI/2 - s*(.35 + k*.18 + sw*.2*s), i]); }
    else if (pat === 2) for (let i = 0; i < 8; i++) beams.push([P.cx, P.cy, t*.5 + i*Math.PI/4, i]);   // a star turning round the centre
    else for (let i = 0; i < 6; i++) beams.push([Math.sin(t*.3)*hw*.5, .58, -Math.PI/2 + (i/5 - .5)*.5 + sw*.6, i]);   // a scan from above
    for (let i = 0; i < N; i++) { const b = beams[i];
      if (b) { LA[i*4] = b[0]; LA[i*4+1] = b[1]; LA[i*4+2] = b[2]; LA[i*4+3] = P.pal[b[3] % 3]; } else LA[i*4+3] = -9; }
    P.lasers = LA;
  },
  feedback: {
    uniforms: 'uniform vec4 uLas[8];',
    main: `
  for(int i=0;i<8;i++){
    vec4 lb=uLas[i]; if(lb.w<-5.0) continue;
    vec2 dv=sp-lb.xy, dir=vec2(cos(lb.z),sin(lb.z));
    float al=dot(dv,dir); if(al<0.0) continue;
    float pd=abs(dv.x*dir.y-dv.y*dir.x); if(pd>=0.03) continue;   // (both edges are 0 this far out)
    col+=hsv(uHue+lb.w,0.9,1.0)*uL_lasers*(0.4+uTreb*uReact*0.9+uBeat*0.9)*(smoothstep(0.0035,0.0,pd)+0.22*smoothstep(0.03,0.0,pd))*exp(-al*0.45);
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uLas[0]'] && P.lasers) gl.uniform4fv(u['uLas[0]'], P.lasers); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl, glowStroke} = x;
    if (!(P.l.lasers > .01) || !P.lasers) return;
    const a = Math.min(1, P.l.lasers*(.4 + P.treb*P.react*.9 + P.beat*.9));
    for (let i = 0; i < N; i++) { const L = P.lasers, h = L[i*4+3]; if (h < -5) continue;
      const ox = L[i*4], oy = L[i*4+1], an = L[i*4+2];
      c.beginPath(); c.moveTo(sx(ox), sy(oy)); c.lineTo(sx(ox + Math.cos(an)*2.5), sy(oy + Math.sin(an)*2.5));
      glowStroke(c, al => `hsla(${hsl(P.hue + h)},95%,60%,${Math.min(1, al).toFixed(3)})`, a, u*.6);
    }
  },
};
