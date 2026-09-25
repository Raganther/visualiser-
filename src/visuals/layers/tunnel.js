// Mirror tunnel: a three-mirror tube kaleidoscope. Whatever goes in the end of the tube (your video, image or camera,
// or, with none, rods and beads that move with the music) is reflected into an endless triangular pattern, and can be
// bent onto a lit sphere so it reads as a solid, evolving orb. Opt-in: Journey only uses it while media is loaded.
import { MEDIA } from '../../media/source.js';
import { S } from '../../state.js';
import { TUNE } from '../../tuning.js';

let tex = null, uploaded = -1, upFrame = -1, glGen = -1;
export default {
  key: 'tunnel', kind: 'layer', label: 'Mirror tunnel', optIn: true,
  suits: {mid:.4, T:.2},   // what music it suits (features centred on 0); unused until it joins Journey's pool
  overWorld: -.8,   // full-screen imagery: it hides a world
  accent: 'peak',   // how it fires when it's the accent
  paint: 0,   // paint order in the trails: the tunnel first, then ribbons, horizon, comets, shockwaves, flow
  params(P, x){
    const T = TUNE.tunnel;
    P.tunRot = x.t*T.spin; P.tunZoom = T.zoom*(1 + .25*Math.sin(x.t*.11)); P.tunOrb = T.orb; P.tunDrift = x.t*T.drift;
  },
  feedback: {
    uniforms: `uniform sampler2D uMedia;
uniform float uMediaOn,uMediaAsp,uTunRot,uTunZoom,uTunOrb,uTunDrift;`,
    functions: `
// three mirrors in a triangle: reflect the point back into the triangle until it's inside
vec2 foldTri(vec2 p){
  const vec2 n0=vec2(0.0,-1.0), n1=vec2(0.8660254,0.5), n2=vec2(-0.8660254,0.5);
  for(int i=0;i<24;i++){
    float d=dot(p,n0)-0.5; if(d>0.0) p-=2.0*d*n0;
    d=dot(p,n1)-0.5; if(d>0.0) p-=2.0*d*n1;
    d=dot(p,n2)-0.5; if(d>0.0) p-=2.0*d*n2;
  }
  return p;
}
// with no media: rods and beads tumbling past the end of the tube, lit by the spectrum and the kick
vec3 tubeObjects(vec2 q){
  vec3 c=vec3(0.0); float t=uTime;
  for(int i=0;i<5;i++){
    float fi=float(i);
    vec2 a=vec2(sin(t*0.31+fi*1.7),cos(t*0.23+fi*2.3))*0.6, b=a+vec2(cos(t*0.47+fi),sin(t*0.39+fi*1.3))*0.55;
    vec2 pa=q-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0), d=length(pa-ba*h);
    c+=hsv(uHue+fi*0.13+spec(fi*0.2)*0.2,0.8,1.0)*smoothstep(0.05+0.03*spec(fi*0.2),0.0,d)*(0.4+spec(0.1+fi*0.15));
    vec2 bp=vec2(sin(t*0.37+fi*3.1),cos(t*0.29+fi*1.1))*0.7;
    c+=hsv(uHue+0.5+fi*0.07,0.6,1.0)*smoothstep(0.12+uBeat*0.05,0.0,length(q-bp))*0.8;
  }
  float wy=wave(fract(q.x*0.5+0.5))*0.3;
  c+=hsv(uHue+0.3,0.7,1.0)*smoothstep(0.02,0.0,abs(q.y-wy))*0.6;
  return c;
}
vec3 tubeImage(vec2 q){
  float c=cos(uTunRot), s=sin(uTunRot); q=mat2(c,-s,s,c)*q;
  if(uMediaOn<0.5) return tubeObjects(q)*1.8;
  vec2 uv=0.5+q*0.45*vec2(1.0/max(uMediaAsp,1.0),min(uMediaAsp,1.0))+vec2(sin(uTunDrift),cos(uTunDrift*0.7))*0.08;
  uv=1.0-abs(1.0-mod(uv,2.0));
  return texture2D(uMedia,uv).rgb*(0.85+uBeat*uReact*0.35);
}`,
    main: `
  if(uL_tunnel>0.003){
    // the orb: the tiled view bent onto a sphere that swells a little on the kick, lit from above left, with a rim glow
    float R=0.46+uBeat*uReact*0.03, rr=length(sp)/R;
    float inside=smoothstep(1.0,0.98,rr), z=sqrt(max(1.0-rr*rr,0.0));
    vec2 qs=sp/R*asin(min(rr,1.0))/max(rr,0.0001)*1.2;
    vec2 qq=mix(sp*2.4,qs,uTunOrb)*uTunZoom;
    vec3 m=tubeImage(foldTri(qq));
    vec3 n=vec3(sp/R,z);
    float light=(0.3+0.7*max(dot(n,normalize(vec3(-0.4,0.5,0.8))),0.0))*inside;
    vec3 rim=hsv(uHue+0.55,0.6,1.0)*pow(1.0-z,3.0)*inside*0.6;
    // blended over the trails rather than added, so a picture stays itself instead of burning out to white
    col=mix(col,m*mix(1.0,light,uTunOrb)+rim*uTunOrb,uL_tunnel*0.45);
  }`,
  },
  fbUniforms(gl, u, P){
    gl.uniform1f(u.uTunRot, P.tunRot); gl.uniform1f(u.uTunZoom, P.tunZoom); gl.uniform1f(u.uTunOrb, P.tunOrb); gl.uniform1f(u.uTunDrift, P.tunDrift);
    const on = MEDIA.on && MEDIA.ready && P.l.tunnel > .003;
    gl.uniform1f(u.uMediaOn, on ? 1 : 0);
    if (!on) return;
    gl.activeTexture(gl.TEXTURE3);
    if (!tex || glGen !== S.glGen) {                  // the media's own texture, made the first time it's needed (or after a lost context)
      glGen = S.glGen; uploaded = -1;
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else gl.bindTexture(gl.TEXTURE_2D, tex);
    // video and camera once a frame (however many passes draw the tunnel), a still image once
    if (uploaded !== MEDIA.version || MEDIA.kind !== 'image' && upFrame !== P.frame) {
      upFrame = P.frame;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, MEDIA.el); uploaded = MEDIA.version; } catch (e) {}
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    gl.uniform1i(u.uMedia, 3); gl.uniform1f(u.uMediaAsp, MEDIA.w/Math.max(1, MEDIA.h));
  },
  // simple mode: a six-way mirror of the media (or of glowing beads) around the centre
  trails2d(c, P, x){
    const {bw, bh} = x, w = P.l.tunnel; if (w < .01) return;
    const R = Math.min(bw, bh)*.48, src = MEDIA.on && MEDIA.ready ? MEDIA.el : null, t = P.tunRot/TUNE.tunnel.spin;
    // blended over the trails (not added), like the WebGL version, so a picture doesn't burn out
    c.translate(bw/2, bh/2); c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.min(1, w*.45);
    for (let k = 0; k < 6; k++) {
      c.save(); c.rotate((k + k % 2)*Math.PI/3 + P.tunRot); if (k % 2) c.scale(1, -1);   // every other wedge is a mirror image
      c.beginPath(); c.moveTo(0, 0); c.lineTo(R, 0); c.lineTo(R/2, R*.866); c.closePath(); c.clip();
      if (src) { const s = R*1.2*P.tunZoom; c.drawImage(src, -s*.1, -s*.1, s, s*(MEDIA.h/Math.max(1, MEDIA.w))); }
      else for (let i = 0; i < 5; i++) {
        const bx = (.5 + .35*Math.sin(t*.37 + i*3.1))*R, by = (.3 + .25*Math.cos(t*.29 + i*1.1))*R;
        c.fillStyle = `hsla(${((((P.hue + .5 + i*.07)%1)+1)%1*360).toFixed(1)},80%,60%,.8)`;
        c.beginPath(); c.arc(bx, by, R*(.06 + P.beat*.03), 0, Math.PI*2); c.fill();
      }
      c.restore();
    }
  },
};
