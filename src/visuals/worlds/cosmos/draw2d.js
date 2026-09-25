// The cosmos in simple mode: the same camera and bodies as shaded discs, far to near, with rings split behind and in
// front, and the stars as fixed directions turned with the camera.
import { hc } from '../../../util.js';
import { V, around } from '../../../scene/camera.js';
import { rng } from './system.js';

const {add, sub, mul, dot, norm} = V;
const STARS = (() => { const r = rng(99), a = []; for (let i = 0; i < 500; i++) a.push(norm([r()*2 - 1, r()*2 - 1, r()*2 - 1]), r()); return a; })();
export function draw2d(o, P){
  const c = P.cz; if (!c) return;
  const W = o.canvas.width, H = o.canvas.height, u = H, cx = W/2, cy = H/2, asp = W/H, k2 = 1/(2*c.tan);
  o.globalAlpha = Math.min(1, P.w.cosmos);
  o.fillStyle = hc(P.hue + .68, 60, 3, 1); o.fillRect(0, 0, W, H);
  o.strokeStyle = 'rgba(220,230,255,.85)'; o.fillStyle = 'rgba(220,230,255,.85)'; o.lineWidth = Math.max(1, u/500); o.beginPath();
  for (let i = 0; i < STARS.length; i += 2) {
    const d = STARS[i], z = dot(d, c.Z); if (z <= .05) continue;
    const x = dot(d, c.X)/z*k2, y = dot(d, c.Y)/z*k2; if (Math.abs(x) > asp/2 || Math.abs(y) > .5) continue;
    if (c.warp > .02) { o.moveTo(cx + x*u, cy - y*u); o.lineTo(cx + x*u*(1 - c.warp*.35), cy - y*u*(1 - c.warp*.35)); }
    else { const s = (.6 + STARS[i + 1])*Math.max(1, u/500); o.rect(cx + x*u, cy - y*u, s, s); }
  }
  if (c.warp > .02) o.stroke(); else o.fill();
  const scr = rel => { const z = dot(rel, c.Z), k = k2/z; return {x: cx + dot(rel, c.X)*k*u, y: cy - dot(rel, c.Y)*k*u, z, k: k*u}; };
  const items = [{sun: true, rel: c.sRel, r: c.sunR}, ...c.vis.map(v => ({b: v.b, rel: v.rel, r: v.b.r}))].map(it => ({...it, ...scr(it.rel)}))
    .filter(it => it.z > it.r*.3).sort((a, b) => b.z - a.z);
  const sunCol = c.sunC.map(v => Math.round(Math.min(1, v)*255)).join(',');
  for (const it of items) {
    const R = it.r*it.k; if (it.x < -R*4 || it.x > W + R*4 || it.y < -R*4 || it.y > H + R*4) continue;
    if (it.sun) {
      o.globalCompositeOperation = 'lighter';
      const g = o.createRadialGradient(it.x, it.y, 0, it.x, it.y, R*5);
      g.addColorStop(0, `rgba(${sunCol},.9)`); g.addColorStop(.2, `rgba(${sunCol},.35)`); g.addColorStop(1, `rgba(${sunCol},0)`);
      o.fillStyle = g; o.fillRect(it.x - R*5, it.y - R*5, R*10, R*10);
      o.globalCompositeOperation = 'source-over'; o.fillStyle = `rgb(${sunCol})`; o.beginPath(); o.arc(it.x, it.y, Math.max(1, R), 0, 7); o.fill();
      continue;
    }
    const b = it.b, hue = P.hue + P.pal[b.slot] + b.off, L = norm(sub(c.sRel, it.rel));
    const lx = dot(L, c.X), ly = dot(L, c.Y), lit = Math.max(.08, 1 - Math.max(0, dot(L, c.Z))*.9);
    const ring = half => {   // the half of the ring behind (or in front of) the planet
      if (!b.ring) return;
      const [ua, va] = around(b.axis); o.lineWidth = Math.max(1, b.r*b.ring*.38*it.k); o.strokeStyle = hc(hue + .08, 30, 70, .55); o.beginPath();
      for (let j = 0; j <= 48; j++) {
        const a = j/48*Math.PI*2, pt = add(it.rel, add(mul(ua, Math.cos(a)*b.r*b.ring*.81), mul(va, Math.sin(a)*b.r*b.ring*.81)));
        const s = scr(pt), back = s.z > it.z; if (s.z <= .01 || back !== half) { o.stroke(); o.beginPath(); continue; }
        o.lineTo(s.x, s.y);
      }
      o.stroke();
    };
    ring(true);
    const base = {rock: [hue + .05, 30, 45], gas: [hue, 50, 60], ice: [hue + .5, 18, 80], lava: [hue + .02, 55, 18]}[b.kind];
    o.save(); o.beginPath(); o.arc(it.x, it.y, Math.max(.8, R), 0, 7); o.clip();
    o.fillStyle = hc(base[0], base[1], base[2], 1); o.fillRect(it.x - R, it.y - R, R*2, R*2);
    if (b.kind === 'gas' && R > 3) {   // bands, square to its axis
      o.translate(it.x, it.y); o.rotate(-Math.atan2(dot(b.axis, c.Y), dot(b.axis, c.X)) + Math.PI/2);
      for (let j = -4; j <= 4; j++) { o.fillStyle = hc(hue + (j & 1 ? .08 : 0), 40, j & 1 ? 72 : 50, .5); o.fillRect(-R, j*R/4.5, R*2, R/9); }
      o.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (b.kind === 'lava') { o.strokeStyle = hc(hue + .03, 90, 55, .7); o.lineWidth = Math.max(1, R/25); o.beginPath();   // glowing cracks
      const r = rng(Math.floor(b.seed*1e6)); for (let j = 0; j < 7; j++) { o.moveTo(it.x + (r() - .5)*R*2, it.y + (r() - .5)*R*2); o.lineTo(it.x + (r() - .5)*R*2, it.y + (r() - .5)*R*2); } o.stroke(); }
    const sx = it.x + lx*R*.55, sy = it.y - ly*R*.55, sh = o.createRadialGradient(sx, sy, R*.1, sx, sy, R*2.1);   // lit towards the star
    sh.addColorStop(0, `rgba(0,0,0,${1 - lit})`); sh.addColorStop(.45, `rgba(0,0,0,${Math.min(.95, 1.1 - lit*.6)})`); sh.addColorStop(1, 'rgba(0,0,0,.97)');
    o.fillStyle = sh; o.fillRect(it.x - R, it.y - R, R*2, R*2);
    o.restore();
    if (b.kind === 'gas' || b.kind === 'ice') { o.strokeStyle = hc(hue + .55, 50, 70, .35); o.lineWidth = Math.max(1, R*.08); o.beginPath(); o.arc(it.x, it.y, R*1.03, 0, 7); o.stroke(); }
    ring(false);
  }
  if (c.warp > .02) { o.fillStyle = `rgba(130,150,255,${c.warp*c.warp*.2})`; o.fillRect(0, 0, W, H); }
  o.globalAlpha = 1;
}
