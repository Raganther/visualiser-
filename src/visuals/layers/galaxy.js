// Spiral galaxy: a disc of stars and glowing gas wound into two, three or four arms round a bright core, turning slowly
// with the bar. The arms are logarithmic spirals, dust lanes darkening their inner edges, with star-forming knots along
// them; the core swells with the bass, the winding tightens as the tension builds, and a drop flings the arms open before
// they wind back. Each section its own number of arms. Rotational symmetry, calm and grand (the user's taste, principles 3
// and 9). Simple mode draws its stars as dots along the arms, with the core's glow.
const st = {arms: 2, type: null, wind: 0, drop: null, fling: 0, turn: 0};
const hh = x => { const s = Math.sin(x*127.1)*43758.5453; return s - Math.floor(s); };
const STARS = Array.from({length: 700}, (_, i) => [hh(i + .5), hh(i*1.7 + 3.1), hh(i*2.3 + 7.7), hh(i*.9 + 1.3)]);   // (simple mode's stars: where along, which arm, spread, size)
export default {
  key: 'galaxy', kind: 'layer', label: 'Spiral galaxy',
  suits: {mid:.1, low:.2, T:-.2},   // what music it suits (features centred on 0): spacious, a steady low end
  overWorld: .1,   // how well it sits over a world: over the sky it's at home
  paint: 1.6,   // paint order in the trails: under the drawn figures
  accent: 'bar',   // how it fires when it's the accent
  params(P, x){
    const J = x.J;
    if (J && J.type !== st.type) { st.type = J.type; st.arms = 2 + Math.floor(hh((J.types || []).length + 2.3)*3); }   // each section its own arms
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null) st.fling = 1; st.drop = J.lastDrop; }
    st.fling *= Math.exp(-x.dt/2.5);
    const T = (J && J.tension) || 0;
    st.wind += ((.28 + .35*T - .25*st.fling) - st.wind)*Math.min(1, x.dt*.8);   // how tightly wound: tighter as it builds, flung open on a drop
    st.turn += x.dt*(.05 + .08*T);
    P.gal = [st.arms, st.wind, st.turn, .03*(1 + x.sBass*x.react*.35*x.dim)];
  },
  feedback: {
    uniforms: 'uniform vec4 uGalL;   // arms, winding, turn, the core\'s size',
    functions: `
float galH(vec2 q){ return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453); }
float galN(vec2 q){ vec2 i=floor(q), f=fract(q); f=f*f*(3.0-2.0*f); return mix(mix(galH(i),galH(i+vec2(1,0)),f.x),mix(galH(i+vec2(0,1)),galH(i+vec2(1,1)),f.x),f.y); }`,
    main: `
  {
    float r=length(p);
    if(r<0.46){
      float th=atan(p.y,p.x)-uGalL.z, n=uGalL.x, lr=log(max(r,0.004));
      float s=fract((th-lr/uGalL.y)*n/6.2831853);   // where between the arms, 0..1
      float arm=exp(-pow((s-0.5)*4.2,2.0)), lane=exp(-pow((s-0.34)*14.0,2.0));   // the arm, and the dust lane on its inner edge
      float disc=smoothstep(0.46,0.1,r)*smoothstep(0.0,0.05,r);
      float gas=galN(vec2(th*2.0,lr*3.0)+uGalL.z*0.2)*0.35+0.65;
      float knots=pow(galN(vec2(th*9.0,lr*14.0)),8.0)*arm*2.5;   // star-forming knots strung along the arms
      float stars=step(0.9975,galH(floor(p*uRes.y*0.5)))*(0.25+arm);   // single fine stars, thicker in the arms
      float core=exp(-r*r/(uGalL.w*uGalL.w)), bulge=exp(-r*r/(uGalL.w*uGalL.w*9.0))*0.35;
      float g=(arm*gas*(1.0-0.8*lane)*0.5+knots+stars*0.7)*disc+core*1.2+bulge;
      col+=mix(hsv(uHue+uPal.x,0.55,1.0),vec3(1.0,0.92,0.8),min(1.0,core*1.5))*uL_galaxy*g*0.5
        +hsv(uHue+uPal.z,0.7,1.0)*uL_galaxy*knots*disc*0.25;
    }
  }`,
  },
  fbUniforms(gl, u, P){ if (u.uGalL && P.gal) gl.uniform4fv(u.uGalL, P.gal); },
  trails2d(c, P, x){
    const {u, sx, sy, hsl} = x;
    if (!(P.l.galaxy > .01) || !P.gal) return;
    const [n, wind, turn, core] = P.gal, cx = sx(P.cx), cy = sy(P.cy), w = Math.min(1, P.l.galaxy);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, core*u*3);   // the core
    g.addColorStop(0, `rgba(255,240,220,${(.8*w).toFixed(3)})`); g.addColorStop(1, 'rgba(255,240,220,0)');
    c.fillStyle = g; c.fillRect(cx - core*u*3, cy - core*u*3, core*u*6, core*u*6);
    c.fillStyle = `hsla(${hsl(P.hue + P.pal[0])},60%,70%,${(.55*w).toFixed(3)})`;
    for (const [a, b, sp, sz] of STARS) {   // stars along the arms: r from the centre out, the arm's angle there, a little spread
      const r = .02 + .42*Math.pow(a, .8), arm = Math.floor(b*n), th = Math.log(r)/wind + arm*Math.PI*2/n + turn + (sp - .5)*.9*(1 - a*.5);
      c.fillRect(cx + Math.cos(th)*r*u, cy - Math.sin(th)*r*u, 1 + sz*1.5, 1 + sz*1.5);
    }
    c.restore();
  },
};
