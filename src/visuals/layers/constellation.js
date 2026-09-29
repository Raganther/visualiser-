// Constellations: a scatter of stars, and on each beat a new line joining the last star to its nearest unjoined one, so a
// figure builds up over a few bars; then the lines clear and a new figure starts from other stars.
const NS = 14, SA = new Float32Array(NS*3), LA = new Float32Array(16*4);   // stars (x, y, twinkle); lines (x1, y1, x2, y2)
const rnd = i => { const v = Math.sin(i*91.7)*43758.5453; return v - Math.floor(v); };
const C = {seed: 0, n: 0, links: [], cur: 0};
const star = (s, i) => [(rnd(s*31 + i) - .5)*.9, (rnd(s*17 + i*7 + 3) - .5)*.62];
export default {
  key: 'constellation', kind: 'layer', label: 'Constellations',
  suits: {perc:.2, mid:.2, T:-.3},   // what music it suits (features centred on 0): steady and spacious
  overWorld: .5,   // how well it sits over a world: in the sky
  paint: 1.6,   // paint order in the trails
  accent: 'bar',   // how it fires when it's the accent
  onBeat(pos){
    if (pos === 0 && C.n >= 12) { C.seed++; C.links = []; C.cur = 0; C.n = 0; }   // a new figure every few bars
    const s = C.seed, stars = Array.from({length: NS}, (_, i) => star(s, i)), used = new Set(C.links.flat());
    let best = -1, bd = 9;
    for (let j = 0; j < NS; j++) { if (j === C.cur || used.has(j)) continue;
      const d = Math.hypot(stars[j][0] - stars[C.cur][0], stars[j][1] - stars[C.cur][1]); if (d < bd) { bd = d; best = j; } }
    if (best >= 0) { C.links.push([C.cur, best]); C.cur = best; } else C.cur = 0;   // (every star joined: back to the first)
    C.n++;
  },
  params(P, x){
    const s = C.seed;
    for (let i = 0; i < NS; i++) { const [sx, sy] = star(s, i); SA[i*3] = P.cx + sx; SA[i*3 + 1] = P.cy + sy; SA[i*3 + 2] = .6 + .4*Math.sin(x.t*2 + i*1.7); }
    LA.fill(0); C.links.slice(-16).forEach(([a, b], k) => { LA[k*4] = SA[a*3]; LA[k*4 + 1] = SA[a*3 + 1]; LA[k*4 + 2] = SA[b*3]; LA[k*4 + 3] = SA[b*3 + 1]; });
    P.cstars = SA; P.clinks = LA; P.cN = Math.min(16, C.links.length);
  },
  feedback: {
    uniforms: 'uniform vec3 uCStars[14]; uniform vec4 uCLinks[16]; uniform float uCN;',
    functions: `
float cSeg(vec2 p,vec2 a,vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0); return length(pa-ba*h); }`,
    main: `
  {
    float g=0.0;
    for(int i=0;i<14;i++){ float d=length(sp-uCStars[i].xy); g+=uCStars[i].z*(smoothstep(0.005,0.0,d)+0.3*smoothstep(0.02,0.0,d)); }
    for(int i=0;i<16;i++){ if(float(i)>=uCN) break; vec4 l=uCLinks[i]; float d=cSeg(sp,l.xy,l.zw);
      g+=smoothstep(0.0022,0.0,d)*0.55*(0.6+0.4*float(i+1)/max(uCN,1.0)); }
    col+=hsv(uHue+uPal.x+0.55,0.25,1.0)*uL_constellation*g*0.35;
  }`,
  },
  fbUniforms(gl, u, P){ if (u['uCStars[0]']) { gl.uniform3fv(u['uCStars[0]'], P.cstars); gl.uniform4fv(u['uCLinks[0]'], P.clinks); gl.uniform1f(u.uCN, P.cN); } },
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x;
    if (!(P.l.constellation > .01) || !P.cstars) return;
    const a = Math.min(1, P.l.constellation), h = hsl(P.hue + P.pal[0] + .55);
    for (let i = 0; i < NS; i++) { c.fillStyle = `hsla(${h},25%,85%,${(.8*a*P.cstars[i*3 + 2]).toFixed(3)})`; c.beginPath(); c.arc(sx(P.cstars[i*3]), sy(P.cstars[i*3 + 1]), Math.max(1, .004*u), 0, Math.PI*2); c.fill(); }
    c.strokeStyle = `hsla(${h},25%,80%,${(.45*a).toFixed(3)})`; c.lineWidth = 1; c.beginPath();
    for (let k = 0; k < P.cN; k++) { const L = P.clinks; c.moveTo(sx(L[k*4]), sy(L[k*4 + 1])); c.lineTo(sx(L[k*4 + 2]), sy(L[k*4 + 3])); }
    c.stroke();
  },
};
