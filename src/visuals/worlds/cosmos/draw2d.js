// The cosmos in simple mode: the same camera and bodies as shaded discs (with glowing atmospheres and shadowed clouds), far to near, with rings split behind and in
// front; the stars as fixed directions turned with the camera. Plainer set pieces: a black hole's shadow, bright edge and
// disk; a pulsar's beams; twin stars; the built ring as a band; the belt's jagged, tumbling rocks and puffs of its gas,
// from pools that follow the camera; oceans, storms, city lights and auroras on the planets.
import { hc } from '../../../util.js';
import { TUNE } from '../../../tuning.js';
import { V, around } from '../../../scene/camera.js';
import { GAL_ARM, rng } from './system.js';

const {add, sub, mul, dot, len, norm} = V;
const STARS = (() => { const r = rng(99), a = []; for (let i = 0; i < 500; i++) a.push(norm([r()*2 - 1, r()*2 - 1, r()*2 - 1]), r()); return a; })();
// the belt's rocks near the camera, and puffs of its gas: pools, each put back ahead of the camera (in the belt) once
// it's passed. Each rock has its own jagged outline (radii round it) and tumbles
const ROCKS = [], GAS = [], rr = rng(77);
function respawn(k, c, near, far, thick){
  const b = c.sys.belt, eye = c.eye, f = near + rr()*(far - near);
  const p = add(eye, add(mul(c.Z, f), add(mul(c.X, (rr() - .5)*f*1.4), mul(c.Y, (rr() - .5)*f*.8))));
  const R = Math.hypot(p[0], p[2]) || 1, want = Math.min(b.R + b.W*thick, Math.max(b.R - b.W*thick, R));
  k.p = [p[0]*want/R, Math.max(-b.H*thick, Math.min(b.H*thick, p[1])), p[2]*want/R]; k.fresh = false;
}
function rocks(c){
  if (!ROCKS.length) for (let i = 0; i < 90; i++) { const big = rr();
    ROCKS.push({p: [0, 0, 0], r: .12 + big*big*.7, s: rr(), spin: (rr() - .5)*2, sq: .5 + rr()*.5, edge: Array.from({length: 9 + Math.floor(rr()*5)}, () => .65 + rr()*.45), fresh: true}); }
  for (const k of ROCKS) { const rel = sub(k.p, c.eye); if (k.fresh || dot(rel, c.Z) < -2 || len(rel) > 45) respawn(k, c, 4, 42, 1); }
  return ROCKS;
}
function gas(c){
  if (!GAS.length) for (let i = 0; i < 14; i++) GAS.push({p: [0, 0, 0], r: 8 + rr()*18, s: rr(), fresh: true});
  for (const k of GAS) { const rel = sub(k.p, c.eye); if (k.fresh || dot(rel, c.Z) < -k.r || len(rel) > 160) respawn(k, c, 10, 150, 1.6); }
  return GAS;
}
// the galaxy's stars, on its three arms (cold, warm, hot), for the galaxy view
const GSTARS = (() => { const r = rng(55), a = []; for (let i = 0; i < 1400; i++) { const arm = i % 3, [a0, r0, dr, turn] = GAL_ARM(arm), rho = 4 + r()*80;
  const th = a0 + (rho - r0)/dr*turn + (r() + r() + r() - 1.5)*(1.5 + rho*.08)/Math.max(rho, 4); a.push({p: [Math.cos(th)*rho, (r() - .5)*.8, Math.sin(th)*rho], arm, s: r()}); } return a; })();
function galaxy2d(o, P, c){
  const W = o.canvas.width, H = o.canvas.height, u = H, g = c.galCam, k2 = 1/(2*c.galTan), HUE = [.58, .12, .98];
  o.globalAlpha = Math.min(1, P.w.cosmos)*c.gal; o.fillStyle = hc(P.hue + .68, 50, 2, 1); o.fillRect(0, 0, W, H);
  const at = p => { const rel = sub(p, g.pos), z = dot(rel, g.Z); return z > .05 ? {x: W/2 + dot(rel, g.X)/z*k2*u, y: H/2 - dot(rel, g.Y)/z*k2*u, z} : null; };
  const core = at([0, 0, 0]);
  if (core) { const R = u*.9*k2/core.z*6, gr = o.createRadialGradient(core.x, core.y, 0, core.x, core.y, R);
    gr.addColorStop(0, 'rgba(255,230,190,.8)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); o.fillStyle = gr; o.fillRect(core.x - R, core.y - R, R*2, R*2); }
  for (const st of GSTARS) { const s = at(st.p); if (!s) continue; o.fillStyle = hc(P.hue + HUE[st.arm], 55, 55 + st.s*30, .8); o.fillRect(s.x, s.y, Math.max(1, u/400), Math.max(1, u/400)); }
  [[c.galA, 'rgba(180,200,255,.9)'], [c.galB, `rgba(255,215,130,${.7 + P.beat*.3})`]].forEach(([p, col]) => { const s = at(p); if (!s) return;
    o.fillStyle = col; o.beginPath(); o.arc(s.x, s.y, Math.max(2, u/120), 0, 7); o.fill(); });
  o.globalAlpha = 1;
}
export function draw2d(o, P){
  const c = P.cz; if (!c) return;
  if (c.gal > .999) return galaxy2d(o, P, c);
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
  const path = (pts, close) => { o.beginPath(); let on = false;   // a polyline through the points in front of the camera
    for (const pt of pts) { const s = scr(pt); if (s.z <= .05) { on = false; continue; } if (on) o.lineTo(s.x, s.y); else o.moveTo(s.x, s.y); on = true; } };
  if (c.halo[2]) {   // the built ring round the star: its two edges and a band between, seen from wherever the camera is
    const [R, Hh] = c.halo, pts = y => Array.from({length: 97}, (_, j) => { const a = j/96*Math.PI*2; return sub([Math.cos(a)*R, y, Math.sin(a)*R], c.eye); });
    o.lineWidth = Math.max(1, u/400); o.strokeStyle = hc(P.hue + c.halo[3], 15, 55, .7);
    path(pts(Hh)); o.stroke(); path(pts(-Hh)); o.stroke();
    o.strokeStyle = hc(P.hue + c.halo[3], 80, 65, .35 + P.beat*.4); o.lineWidth = Math.max(1, u/250); path(pts(0)); o.stroke();
  }
  if (c.belt[0]) {   // the belt from afar: bands of gas along its ring, wide and faint, then narrower
    const [R, Wb] = c.belt, pts = Array.from({length: 121}, (_, j) => { const a = j/120*Math.PI*2; return sub([Math.cos(a)*R, 0, Math.sin(a)*R], c.eye); });
    const dn = Math.max(6, Math.abs(Math.hypot(c.eye[0], c.eye[2]) - R) + Math.abs(c.eye[1])), w = Math.min(u*.35, u*k2*Wb*2/dn);
    o.globalCompositeOperation = 'lighter'; o.lineCap = 'round';
    for (const [k, hue, a] of [[2.2, .08, .05], [1, .55, .08]]) { o.lineWidth = Math.max(1, w*k); o.strokeStyle = hc(P.hue + hue, 40, 55, a); path(pts); o.stroke(); }
    o.globalCompositeOperation = 'source-over';
  }
  const sunCol = c.sunC.map(v => Math.round(Math.min(1, v)*255)).join(',');
  const items = [{sun: true, rel: c.sRel, r: c.sunR}, ...(c.twin[3] ? [{sun: true, twin: true, rel: c.twin.slice(0, 3), r: c.twin[3]}] : []),
    ...c.vis.map(v => ({b: v.b, rel: v.rel, r: v.b.r})), ...(c.belt[3] ? rocks(c).map(k => ({rock: k, rel: sub(k.p, c.eye), r: k.r})) : []),
    ...(c.belt[0] ? gas(c).map(k => ({puff: k, rel: sub(k.p, c.eye), r: k.r})) : [])]
    .map(it => ({...it, ...scr(it.rel)})).filter(it => it.z > it.r*.3).sort((a, b) => b.z - a.z);
  for (const it of items) {
    const R = it.r*it.k; if (it.x < -R*6 || it.x > W + R*6 || it.y < -R*6 || it.y > H + R*6) continue;
    if (it.rock) {   // a rock: its jagged outline, squashed and tumbling, lit on the star's side
      const k = it.rock, L = norm(sub(c.sRel, it.rel)), g = o.createRadialGradient(it.x + dot(L, c.X)*R*.5, it.y - dot(L, c.Y)*R*.5, 0, it.x, it.y, R*1.3);
      g.addColorStop(0, hc(P.hue + .06 + (k.s - .5)*.08, 20, 50, 1)); g.addColorStop(1, hc(P.hue + .06, 20, 5, 1));
      const a0 = k.s*6.28 + (P.t2d || 0)*k.spin, n = k.edge.length; o.fillStyle = g; o.beginPath();
      for (let j = 0; j < n; j++) { const a = j/n*Math.PI*2, e = k.edge[j]*Math.max(.7, R), x = Math.cos(a)*e, y = Math.sin(a)*e*k.sq;
        const px = it.x + x*Math.cos(a0) - y*Math.sin(a0), py = it.y + x*Math.sin(a0) + y*Math.cos(a0); if (j) o.lineTo(px, py); else o.moveTo(px, py); }
      o.fill();
      continue;
    }
    if (it.puff) {   // a puff of the belt's gas: a soft glow, brighter towards the star, with a wisp streaming away from it
      const k = it.puff, toward = norm(sub(c.sRel, it.rel)), g = .3 + .7*Math.pow(Math.max(0, dot(toward, norm(it.rel))), 4);
      const ax = -dot(toward, c.X), ay = dot(toward, c.Y), al = Math.hypot(ax, ay) || 1, hue = P.hue + (k.s < .5 ? .08 : .55);
      o.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 3; j++) { const x = it.x + ax/al*R*j*.7, y = it.y + ay/al*R*j*.7, rad = R*(1 - j*.22), gr = o.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, hc(hue, 45, 60, .2*g*(1 - j*.25))); gr.addColorStop(1, hc(hue, 40, 60, 0)); o.fillStyle = gr; o.fillRect(x - rad, y - rad, rad*2, rad*2); }
      o.globalCompositeOperation = 'source-over';
      continue;
    }
    if (it.sun) {
      const col = it.twin ? c.twinC.map(v => Math.round(Math.min(1, v)*255)).join(',') : sunCol, hole = !it.twin && c.type === 'hole';
      const disk = half => {   // a hole's disk: the half behind, then the half in front of its shadow
        const [ua, va] = around(c.axis); o.lineWidth = Math.max(1, it.r*3*it.k); o.strokeStyle = `rgba(${col},.55)`; o.beginPath();
        for (let j = 0; j <= 64; j++) {
          const a = j/64*Math.PI*2, pt = add(it.rel, add(mul(ua, Math.cos(a)*it.r*4.5), mul(va, Math.sin(a)*it.r*4.5))), s = scr(pt);
          if (s.z <= .01 || (s.z > it.z) !== half) { o.stroke(); o.beginPath(); continue; }
          o.lineTo(s.x, s.y);
        }
        o.stroke();
      };
      o.globalCompositeOperation = 'lighter';
      if (c.type === 'pulsar' && !it.twin) {   // the beams, both ways along its axis
        o.lineWidth = Math.max(1, R*.8); o.strokeStyle = `rgba(${col},.35)`;
        for (const sgn of [1, -1]) { const e = scr(add(it.rel, mul(c.axis, sgn*it.r*60))); if (e.z > .05) { o.beginPath(); o.moveTo(it.x, it.y); o.lineTo(e.x, e.y); o.stroke(); } }
      }
      if (hole) disk(true);
      const g = o.createRadialGradient(it.x, it.y, 0, it.x, it.y, R*(hole ? 3 : 5));
      g.addColorStop(0, `rgba(${col},${hole ? 0 : .9})`); g.addColorStop(hole ? .5 : .2, `rgba(${col},.35)`); g.addColorStop(1, `rgba(${col},0)`);
      o.fillStyle = g; o.fillRect(it.x - R*5, it.y - R*5, R*10, R*10);
      o.globalCompositeOperation = 'source-over';
      if (hole) {   // its shadow, the bright ring round it, then the near half of the disk
        o.fillStyle = '#000'; o.beginPath(); o.arc(it.x, it.y, Math.max(1, R*1.5), 0, 7); o.fill();
        o.strokeStyle = `rgba(${col},${.8 + P.beat*.2})`; o.lineWidth = Math.max(1, R*.12); o.beginPath(); o.arc(it.x, it.y, R*1.55, 0, 7); o.stroke();
        disk(false);
      } else { o.fillStyle = `rgb(${col})`; o.beginPath(); o.arc(it.x, it.y, Math.max(1, R), 0, 7); o.fill(); }
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
    const base = {rock: [hue + .05, 30, 45], gas: [hue, 50, 60], ice: [hue + .5, 18, 80], lava: [hue + .02, 55, 18], ocean: [hue + .56, 60, 32]}[b.kind];
    const r = rng(Math.floor(b.seed*1e6)), turn = -Math.atan2(dot(b.axis, c.Y), dot(b.axis, c.X)) + Math.PI/2;
    o.save(); o.beginPath(); o.arc(it.x, it.y, Math.max(.8, R), 0, 7); o.clip();
    o.fillStyle = hc(base[0], base[1], base[2], 1); o.fillRect(it.x - R, it.y - R, R*2, R*2);
    if (b.kind === 'ocean' && R > 3) { o.fillStyle = hc(hue + .12, 35, 40, 1);   // land
      for (let j = 0; j < 6; j++) { o.beginPath(); o.arc(it.x + (r() - .5)*R*1.6, it.y + (r() - .5)*R*1.6, R*(.15 + r()*.3), 0, 7); o.fill(); } }
    if (b.kind === 'gas' && R > 3) {   // bands, square to its axis, and a storm in them
      o.translate(it.x, it.y); o.rotate(turn);
      for (let j = -4; j <= 4; j++) { o.fillStyle = hc(hue + (j & 1 ? .08 : 0), 40, j & 1 ? 72 : 50, .5); o.fillRect(-R, j*R/4.5, R*2, R/9); }
      if (b.storm) { o.fillStyle = hc(hue + .93, 55, 60, .8); o.beginPath(); o.ellipse(R*.25, R*.3, R*.22, R*.13, 0, 0, 7); o.fill(); }
      o.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (b.kind === 'lava') { o.strokeStyle = hc(hue + .03, 90, 55, .7 + Math.min(1, P.hit)*.3); o.lineWidth = Math.max(1, R/25); o.beginPath();   // glowing cracks, flaring on stabs
      for (let j = 0; j < 7; j++) { o.moveTo(it.x + (r() - .5)*R*2, it.y + (r() - .5)*R*2); o.lineTo(it.x + (r() - .5)*R*2, it.y + (r() - .5)*R*2); } o.stroke(); }
    if (b.cloud && R > 4) {   // clouds, each with its shadow cast away from the star (shaded with the ground below)
      const cr = rng(Math.floor(b.seed*1e6) + 7), drift = (P.t2d || 0)*.02, cl = [];
      for (let j = 0; j < 9; j++) { const a = cr()*6.28 + drift, d = Math.sqrt(cr())*R*.85; cl.push([it.x + Math.cos(a)*d, it.y + Math.sin(a)*d*.8, R*(.12 + cr()*.2)]); }
      for (const pass of [0, 1]) { o.fillStyle = pass ? `rgba(235,240,245,${.5*b.cloud + .2})` : `rgba(0,0,0,${.35*b.cloud})`;
        for (const [x, y, w] of cl) { o.beginPath(); o.ellipse(x - (pass ? 0 : lx*R*.05), y + (pass ? 0 : ly*R*.05), w, w*.45, turn, 0, 7); o.fill(); } } }
    const sx = it.x + lx*R*.55, sy = it.y - ly*R*.55, sh = o.createRadialGradient(sx, sy, R*.1, sx, sy, R*2.1);   // lit towards the star
    sh.addColorStop(0, `rgba(0,0,0,${1 - lit})`); sh.addColorStop(.45, `rgba(0,0,0,${Math.min(.95, 1.1 - lit*.6)})`); sh.addColorStop(1, 'rgba(0,0,0,.97)');
    o.fillStyle = sh; o.fillRect(it.x - R, it.y - R, R*2, R*2);
    if (b.city && R > 4) { o.fillStyle = `rgba(255,190,110,${.6 + P.beat*.3})`;   // city lights, on the side away from the star
      for (let j = 0; j < 40; j++) { const a = r()*Math.PI*2, d = Math.sqrt(r())*R*.95, px = Math.cos(a)*d, py = Math.sin(a)*d;
        if (px*lx - py*ly < -R*.15) o.fillRect(it.x + px, it.y + py, Math.max(1, R/60), Math.max(1, R/60)); } }
    o.restore();
    if (b.aurora && R > 4) { o.save(); o.translate(it.x, it.y); o.rotate(turn); o.strokeStyle = hc(hue + .33, 80, 60, .2 + P.beat*.6); o.lineWidth = Math.max(1, R*.06);   // auroras round the poles, on the kick
      for (const sg of [1, -1]) { o.beginPath(); o.ellipse(0, sg*R*.82, R*.5, R*.12, 0, 0, 7); o.stroke(); } o.restore(); }
    const at = !b.moon && TUNE.cosmos.atmo[b.kind];
    if (at && R > 2) {   // its atmosphere: haze thickening to the limb, and a glow round it, brightest on the side facing the star
      const ah = hue + at[1], dn = at[2], ox = lx*R*.18, oy = -ly*R*.18, Ro = R*(1 + at[0]*2.6);
      o.save(); o.globalCompositeOperation = 'lighter';
      const gi = o.createRadialGradient(it.x + ox, it.y + oy, R*.55, it.x, it.y, R);
      gi.addColorStop(0, hc(ah, 55, 60, 0)); gi.addColorStop(1, hc(ah, 55, 60, .4*dn*Math.max(lit, .25))); o.fillStyle = gi;
      o.beginPath(); o.arc(it.x, it.y, R, 0, 7); o.fill();
      const go = o.createRadialGradient(it.x + ox, it.y + oy, R*.96, it.x + ox*.4, it.y + oy*.4, Ro);
      const back = Math.max(0, dot(L, c.Z));   // the star behind it: a ring of light all round
      go.addColorStop(0, hc(ah, 60, 68, Math.min(.9, dn*(.2 + .45*lit + .6*back)))); go.addColorStop(.35, hc(ah + .9, 70, 55, .15*dn*(1 + back))); go.addColorStop(1, hc(ah, 60, 60, 0));
      o.fillStyle = go; o.beginPath(); o.arc(it.x, it.y, Ro + Math.abs(ox) + Math.abs(oy), 0, 7); o.arc(it.x, it.y, R*.98, 0, 7, true); o.fill('evenodd');
      o.restore(); }
    ring(false);
  }
  if (c.warp > .02) { o.fillStyle = `rgba(130,150,255,${c.warp*c.warp*.2})`; o.fillRect(0, 0, W, H); }
  o.globalAlpha = 1;
  if (c.gal > .001) galaxy2d(o, P, c);
}
