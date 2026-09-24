// Plasma: slow interference bands that swell with the mids.
export default {
  key: 'plasma', kind: 'layer', label: 'Plasma',
  suits: {perc:-.6, T:-.5, low:.3},   // what music it suits (features centred on 0)
  overWorld: -.6,   // how well it sits over a world
  accent: 'mid',   // how it fires when it's the accent
  feedback: {
    glow: `
  {
    float v=sin(p.x*4.0+uTime*0.7)+sin(p.y*5.0-uTime*0.9)+sin(length(p)*9.0-uTime*1.7+uBass*uReact*3.0);
    g+=uL_plasma*smoothstep(0.85,1.0,sin(v*2.5+uMid*uReact*2.0))*(0.25+uMid*uReact*0.6);
  }`,
  },
  folded2d(c, P, x){                                   // drawn inside the kaleidoscope fold
    const {u, now, bw, col, glowStroke} = x;
    if (P.l.plasma > .01) {
      const s = now/1000, sz = u*(.3 + P.mid*P.react*.25);
      for (let m = 0; m < 3; m++) {
        c.beginPath();
        for (let j = 0; j <= 160; j++) {
          const t = j/160*Math.PI*2;
          const x = Math.sin(t*(2+m) + s*(.5+m*.2))*sz, y = Math.sin(t*(3+m) - s*.7 + P.bass*P.react*2)*sz*.8;
          j ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        glowStroke(c, col(.3 + m*.08), P.l.plasma*.45, u);
      }
    }
  },
};
