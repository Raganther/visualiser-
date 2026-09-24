// Simple mode: the same picture drawn with the Canvas 2D API, for browsers without WebGL.
import { NP, parts } from '../fx/particles.js';
import { H, W } from './gl.js';
import { HIST, dataArr } from '../state.js';
import { sstep } from '../util.js';

/* Simple mode: the same feedback idea with the plain 2D canvas, for browsers without WebGL */
export function make2D(view){
  const out = view.getContext('2d');
  const bufs = [document.createElement('canvas'), document.createElement('canvas')];
  const ctxs = bufs.map(b => b.getContext('2d'));
  const hasFilter = typeof ctxs[0].filter === 'string';
  let bw = 2, bh = 2, i = 0, vignette = null;
  function resize(w, h){
    const sc = Math.min(1, 900 / Math.max(w, h));
    bw = Math.max(2, Math.round(w*sc)); bh = Math.max(2, Math.round(h*sc));
    bufs.forEach((b, k) => { b.width = bw; b.height = bh; ctxs[k].fillStyle = '#000'; ctxs[k].fillRect(0,0,bw,bh); });
    vignette = out.createRadialGradient(w/2, h/2, Math.min(w,h)*.3, w/2, h/2, Math.hypot(w,h)*.6);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.75)');
  }
  function glowStroke(c, colour, weight, u){
    if (weight < .01) return;
    c.strokeStyle = colour(.12*weight); c.lineWidth = u*.03; c.stroke();
    c.strokeStyle = colour(.6*weight); c.lineWidth = u*.008; c.stroke();
  }
  function layers(c, P, u, now, bright){
    const col = off => a => `hsla(${((((P.hue+off)%1)+1)%1*360).toFixed(1)},95%,55%,${Math.min(1,a*bright).toFixed(3)})`;
    if (P.ring > .01) {
      const R = u*(P.ringR + P.beat*P.react*.07), amp = u*.12*(.6 + P.react*.6);
      c.save(); c.scale(1/(1 + P.ringSq), 1/(1 - P.ringSq));
      c.beginPath();
      for (let j = 0; j <= 128; j++) {
        const a = j/128*Math.PI*2, t = a <= Math.PI ? a/Math.PI : 2 - a/Math.PI;
        const r = R + (dataArr[Math.min(255, Math.floor(t*255))]/128 - 1)*amp;
        j ? c.lineTo(Math.cos(a)*r, Math.sin(a)*r) : c.moveTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      c.closePath(); c.restore(); glowStroke(c, col(.1), P.ring, u);
    }
    if (P.scope > .01) {
      c.beginPath();
      for (let j = 0; j <= 128; j++) {
        const x = (j/128 - .5)*bw*.9, y = -(dataArr[j*2 > 255 ? 255 : j*2]/128 - 1)*.3*u*(.6 + P.react*.5);
        j ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      glowStroke(c, col(.2), P.scope*(.6 + P.hit*1.6), u);
    }
    if (P.plasma > .01) {
      const s = now/1000, sz = u*(.3 + P.mid*P.react*.25);
      for (let m = 0; m < 3; m++) {
        c.beginPath();
        for (let j = 0; j <= 160; j++) {
          const t = j/160*Math.PI*2;
          const x = Math.sin(t*(2+m) + s*(.5+m*.2))*sz, y = Math.sin(t*(3+m) - s*.7 + P.bass*P.react*2)*sz*.8;
          j ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        glowStroke(c, col(.3 + m*.08), P.plasma*.45, u);
      }
    }
    if (P.burst > .01) {
      c.lineWidth = u*.012;
      for (let j = 0; j < 48; j++) {
        const t = (j + .5)/48, sp = dataArr[256 + Math.floor(Math.pow(t, 1.3)*255)]/255;
        const len = u*(.06 + sp*.55*(.6 + P.react*.5));
        for (const a of [t*Math.PI, -t*Math.PI]) {
          const cs = Math.cos(a), sn = Math.sin(a);
          c.strokeStyle = col(t*.15)(.12*P.burst*(.6 + P.hit*1.4));
          c.beginPath(); c.moveTo(cs*u*.06, sn*u*.06); c.lineTo(cs*len, sn*len); c.stroke();
          c.fillStyle = col(t*.15)(P.burst*(.6 + P.hit*1.4));
          c.beginPath(); c.arc(cs*len, sn*len, u*.01, 0, Math.PI*2); c.fill();
        }
      }
    }
  }
  const stars = Array.from({length:220}, () => ({x:(Math.random() - .5)*3, y:(Math.random() - .5)*2, z:Math.random()}));
  let lastStarPh = 0;
  const hc = (h, s, l, a) => `hsla(${((((h)%1)+1)%1*360).toFixed(1)},${s}%,${l}%,${a})`;
  function drawAurora(P, t){
    const o = out, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
    o.globalAlpha = Math.min(1, P.aurW);
    const sky = o.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, hc(P.hue + .7, 60, 2, 1)); sky.addColorStop(1, hc(P.hue + .62, 70, 10, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j <= 60; j++) {
        const xs = (j/60 - .5)*asp, x = xs*(1.2 + i*.3) + i*1.7;
        const base = -.08 + i*.09 + .08*Math.sin(x*1.3 + t*.15 + i) + .04*Math.sin(x*3.1 - t*.23) - P.mid*P.react*.05;
        const fold = .5 + .5*Math.sin(x*14 + Math.sin(x*3 + t*.4)*2 + t*(.6 + i*.2));
        const a = (.3 + .7*fold)*(.3 + .45*P.mid*P.react + .2*P.beat)*(1 - i*.25)*.5;
        const g = o.createLinearGradient(0, Y(base), 0, Y(base + .3));
        g.addColorStop(0, hc(P.hue + .33, 80, 55, a)); g.addColorStop(1, hc(P.hue + .8, 70, 50, 0));
        o.fillStyle = g; const x0 = Math.floor(X(xs)), x1 = Math.floor(X(xs + asp/60)); o.fillRect(x0, Y(base + .3), x1 - x0, .3*u);
      }
    }
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = hc(P.hue + .62, 50, 3, 1); o.beginPath(); o.moveTo(0, H);
    for (let j = 0; j <= 76; j++) { const xs = (j/76 - .5)*asp, id = Math.floor(xs*38);
      const top = -.3 + .02*Math.sin(xs*7) + .012*Math.sin(xs*23) + (j % 2 ? 0 : .03 + .05*((Math.sin(id*12.9898)*43758.5453) % 1 + 1) % 1);
      o.lineTo(X(xs), Y(top)); }
    o.lineTo(W, H); o.closePath(); o.fill();
  }
  const cityB = [0, 1].map(L => Array.from({length:80}, () => Math.random()));
  function drawCity(P, t){
    const o = out, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H;
    o.globalAlpha = Math.min(1, P.cityW);
    const sky = o.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, hc(P.hue + .65, 70, 3, 1)); sky.addColorStop(1, hc(P.hue + .9, 60, 25, 1));
    o.fillStyle = sky; o.fillRect(0, 0, W, H);
    o.fillStyle = hc(P.hue + .1, 20, 85, .8); o.beginPath(); o.arc(X(-asp*.28), Y(.28), .05*u, 0, Math.PI*2); o.fill();
    for (let L = 0; L < 2; L++) {
      const w = .035 + L*.035, shift = t*(.008 + L*.02) + L*3.7, first = Math.floor((-asp/2 + shift)/w);
      for (let id = first; id*w - shift < asp/2; id++) {
        const hb = cityB[L][((id % 80) + 80) % 80], sv = dataArr[256 + Math.floor((((id*.137) % 1) + 1) % 1*255)]/255;
        const h = -.3 + (.06 + .2*hb)*(.8 + L*.35) + sv*.1*P.react*(.5 + L*.5);
        const x0 = X(id*w - shift + w*.06), x1 = X(id*w - shift + w*.94);
        o.fillStyle = hc(P.hue + .65, 50, 5 + L*4, 1); o.fillRect(x0, Y(h), x1 - x0, Y(-.3) - Y(h));
        const rows = Math.floor((h + .3)/(w*.3));
        for (let r = 1; r < rows; r++) for (let c = 0; c < 5; c++) {
          const lit = ((Math.sin(id*91.7 + c*12.3 + r*7.1 + P.citySeed*13 + L*50)*43758.5453) % 1 + 1) % 1 > .74;
          if (!lit) continue;
          o.fillStyle = hc(P.hue + .12, 60, 60, Math.min(1, .45 + .3*L + .35*P.beat));
          o.fillRect(x0 + (x1 - x0)*(c + .25)/5, Y(h - (r + .3)*w*.3), (x1 - x0)*.1, w*.3*.5*u);
        }
      }
    }
  }
  function drawStreet(P){                                // the street: the skyline reflected in strips
    const o = out, gy = H/2 + .3*H;
    o.globalAlpha = Math.min(1, P.cityW);
    o.fillStyle = hc(P.hue + .65, 60, 3, 1); o.fillRect(0, gy, W, H - gy);
    for (let yo = 0; yo < H - gy; yo += 3) {
      const src = gy - yo*1.4 - 3; if (src < 0) break;
      o.globalAlpha = Math.min(1, P.cityW)*.35*(1 - Math.min(.7, yo/H*2.5));
      o.drawImage(o.canvas, 0, src, W, 3, Math.sin(yo*.3)*2, gy + yo, W, 3);
    }
  }
  function drawWorld(P, now){
    if (P.aurW > .01) drawAurora(P, now/1000);
    if (P.cityW > .01) { drawCity(P, now/1000); drawStreet(P); }
    out.globalAlpha = 1;
    if (P.landW < .01 && P.spaceW < .01) return;
    const t = now/1000, u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u, asp = W/H, o = out;
    o.save();
    if (P.landW > .01) {
      o.globalAlpha = Math.min(1, P.landW);
      const hy = Y(P.landY);
      const sky = o.createLinearGradient(0, Y(P.landY + .6), 0, hy);
      sky.addColorStop(0, hc(P.hue + .62, 65, 5, 1)); sky.addColorStop(1, hc(P.hue + .02, 75, 32, 1));
      o.fillStyle = sky; o.fillRect(0, 0, W, hy);
      const sx = X(P.sunX), sy = Y(P.landY + .16), R = (.19 + P.bass*P.react*.02)*u;
      const glow = o.createRadialGradient(sx, sy, R, sx, sy, R*2.2);
      glow.addColorStop(0, hc(P.hue + .05, 80, 55, .35)); glow.addColorStop(1, hc(P.hue + .05, 80, 55, 0));
      o.fillStyle = glow; o.fillRect(sx - R*2.2, sy - R*2.2, R*4.4, R*4.4);
      const sun = o.createLinearGradient(0, sy - R, 0, sy + R);
      sun.addColorStop(0, hc(P.hue + .12, 90, 65, 1)); sun.addColorStop(1, hc(P.hue - .04, 95, 55, 1));
      o.fillStyle = sun; o.beginPath(); o.arc(sx, sy, R, 0, Math.PI*2); o.fill();
      o.fillStyle = sky;                                    // cut the stripes through the lower half
      for (let k = .2; k > -1; k -= .015) {
        const band = ((-k*6 + t*.4) % 1 + 1) % 1, w = (.2 - k)*.35*(.6 + P.bass*P.react*.8);
        if (band < w) o.fillRect(sx - R, sy - k*R, R*2, .016*R + 1);
      }
      for (let i = 0; i < 3; i++) {
        const span = 30 - i*10, top = [];
        for (let j = 0; j <= 120; j++) {
          const x = (j/120 - .5)*asp, age = (asp/2 - x)/asp*span;
          const idx = Math.max(0, Math.min(255, 255 - age/.12 + P.histFrac));
          const hv = HIST[Math.floor(idx)]/255;
          const h = .03 + hv*(.22 - i*.05) + Math.sin(x*(9 + i*7) + i*3)*.012 + Math.sin(x*(31 + i*11))*.005;
          top.push([X(x), Y(P.landY + h)]);
        }
        const g = o.createLinearGradient(0, 0, W, 0);
        for (let q = 0; q <= 4; q++) g.addColorStop(q/4, hc(P.hue + .55 + i*.07 + .09*Math.sin(q*1.6 + t*.35 + i*1.7), 70 - i*8, 24 + i*9, 1));
        o.fillStyle = g; o.beginPath(); o.moveTo(0, hy);
        top.forEach(([x, y]) => o.lineTo(x, y)); o.lineTo(W, hy); o.closePath(); o.fill();
        if (i < 2) { o.fillStyle = hc(P.hue + .62, 60, 30, .35 - i*.15); o.fill(); }   // haze on distant ranges
        o.beginPath(); top.forEach(([x, y], j) => j ? o.lineTo(x, y) : o.moveTo(x, y));
        o.strokeStyle = hc(P.hue + .1 + i*.05, 70, 65, Math.min(1, (.4 + P.beat*.9)*(.4 + .3*i))); o.lineWidth = Math.max(1, u*.004); o.stroke();
      }
      for (let yo = 0; yo < H - hy; yo += 3) {           // water: the landscape reflected in strips that ripple
        const dy = yo/u, dx = Math.sin(dy*90 - t*3)*.003*(1 + P.beat*4)*(1 + dy*6)*u;
        const src = hy - yo - 3; if (src < 0) break;
        o.globalAlpha = Math.min(1, P.landW)*.5*(1 - Math.min(1, dy*2)*.5);
        o.drawImage(o.canvas, 0, src, W, 3, dx, hy + yo, W, 3);
      }
    }
    if (P.spaceW > .01) {
      o.globalAlpha = Math.min(1, P.spaceW);
      o.fillStyle = hc(P.hue + .68, 60, 3, 1); o.fillRect(0, 0, W, H);
      for (let n = 0; n < 2; n++) {
        const nx = X(Math.sin(t*.05 + n*2)*.5), ny = Y(Math.cos(t*.04 + n)*.25), nr = u*.6;
        const ng = o.createRadialGradient(nx, ny, 0, nx, ny, nr);
        ng.addColorStop(0, hc(P.hue + .75 + n*.08, 60, 15, .5)); ng.addColorStop(1, hc(P.hue + .75, 60, 10, 0));
        o.fillStyle = ng; o.fillRect(nx - nr, ny - nr, nr*2, nr*2);
      }
      const adv = Math.max(0, P.starPh - lastStarPh)*1.5; lastStarPh = P.starPh;
      o.fillStyle = '#dfe8ff';
      for (const s of stars) {
        s.z -= adv; if (s.z < .05) { s.z = 1; s.x = (Math.random() - .5)*3; s.y = (Math.random() - .5)*2; }
        const px = X(s.x*.3/s.z), py = Y(s.y*.3/s.z), sz = Math.max(1, 2.2*(1 - s.z));
        if (px > -5 && px < W + 5 && py > -5 && py < H + 5) o.fillRect(px, py, sz, sz);
      }
      const [pxw, pyw, pr] = P.planet, cx = X(pxw), cy = Y(pyw), R = pr*u;
      const ring = (front) => {
        for (let k = 0; k < 10; k++) {
          const rr = 1.4 + k*.075;
          o.beginPath(); o.ellipse(cx, cy, R*rr, R*rr*.28, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI*2);
          o.strokeStyle = hc(P.hue + .1 + rr*.08, 50, 65, (.55 + .45*Math.sin(rr*38))*(.6 + P.mid*P.react*.8)*.8);
          o.lineWidth = R*.06; o.stroke();
        }
      };
      ring(false);
      const halo = o.createRadialGradient(cx, cy, R, cx, cy, R*1.35);
      halo.addColorStop(0, hc(P.hue + .55, 60, 60, .25)); halo.addColorStop(1, hc(P.hue + .55, 60, 60, 0));
      o.fillStyle = halo; o.fillRect(cx - R*1.4, cy - R*1.4, R*2.8, R*2.8);
      o.save(); o.beginPath(); o.arc(cx, cy, R, 0, Math.PI*2); o.clip();
      o.fillStyle = hc(P.hue + .5, 70, 45, 1); o.fillRect(cx - R, cy - R, R*2, R*2);
      for (let k = -12; k <= 12; k++) {                  // swirling colour bands
        o.beginPath();
        for (let j = 0; j <= 24; j++) {
          const xx = cx - R + j/24*R*2, yy = cy + k*R/11 + Math.sin(j*.5 + t*.25 + k)*R*.05;
          j ? o.lineTo(xx, yy) : o.moveTo(xx, yy);
        }
        o.strokeStyle = hc(P.hue + .5 + Math.sin(k*1.3 + t*.12)*.09, 75, 55, .7); o.lineWidth = R/13; o.stroke();
      }
      const lx = cx + Math.cos(P.lightAng)*R*.5, ly = cy - R*.3;
      const shade = o.createRadialGradient(lx, ly, R*.1, lx, ly, R*1.9);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(.55, 'rgba(0,0,0,.35)'); shade.addColorStop(1, 'rgba(0,0,0,.92)');
      o.fillStyle = shade; o.fillRect(cx - R, cy - R, R*2, R*2);
      o.restore();
      ring(true);
      for (let m = 0; m < 2; m++) {
        const mx = X(P.moons[m*4]), my = Y(P.moons[m*4 + 1]), mr = P.moons[m*4 + 2]*u, front = P.moons[m*4 + 3] > .5;
        if (!front && Math.hypot(mx - cx, my - cy) < R) continue;
        const mg = o.createRadialGradient(mx - mr*.4, my - mr*.4, mr*.1, mx, my, mr);
        mg.addColorStop(0, hc(P.hue + .1, 30, 85, 1)); mg.addColorStop(1, hc(P.hue + .1, 30, 12, 1));
        o.fillStyle = mg; o.beginPath(); o.arc(mx, my, mr, 0, Math.PI*2); o.fill();
      }
    }
    o.restore();
  }
  function drawHits(P){
    const u = H, X = x => W/2 + x*u, Y = y => H/2 - y*u;
    out.save(); out.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const r = P.outline[i*4], a = P.outline[i*4 + 1], n = P.outline[i*4 + 2], rot = P.outline[i*4 + 3];
      if (a < .003) continue;
      out.beginPath();
      for (let k = 0; k <= n; k++) { const ang = rot + k/n*Math.PI*2, R = r/Math.cos(Math.PI/n)*u;
        const px = X(0) + Math.sin(ang)*R, py = Y(0) - Math.cos(ang)*R; k ? out.lineTo(px, py) : out.moveTo(px, py); }
      out.shadowColor = hc(P.hue + .3, 80, 60, a); out.shadowBlur = u*.02;
      out.strokeStyle = `rgba(255,255,255,${Math.min(1, a*.8)})`; out.lineWidth = Math.max(1, u*.004); out.stroke();
    }
    out.shadowBlur = 0;
    for (let i = 0; i < 6; i++) {
      const x = P.sparks[i*4], y = P.sparks[i*4 + 1], s = P.sparks[i*4 + 2]*u, a = P.sparks[i*4 + 3];
      if (a < .003) continue;
      const g = out.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), s*.5);
      g.addColorStop(0, hc(P.hue + .15, 60, 90, a)); g.addColorStop(1, hc(P.hue + .15, 60, 90, 0));
      out.fillStyle = g; out.fillRect(X(x) - s, Y(y) - s, s*2, s*2);
      out.fillStyle = hc(P.hue + .15, 40, 92, a*.8);
      out.fillRect(X(x) - s, Y(y) - s*.03, s*2, s*.06); out.fillRect(X(x) - s*.03, Y(y) - s, s*.06, s*2);
    }
    out.restore();
  }
  function drawStar(P){
    const [x, y, r, a] = P.star; if (a < .003) return;
    const u = H, n = P.starN, R = r*u, cx = W/2 + x*u, cy = H/2 - y*u, inner = R*(n > 5 ? .5 : .42);
    out.save(); out.globalCompositeOperation = 'lighter'; out.translate(cx, cy); out.rotate(P.starRot);
    out.beginPath();
    for (let k = 0; k < n*2; k++) { const ang = k*Math.PI/n - Math.PI/2, rr = k % 2 ? inner : R;
      k ? out.lineTo(Math.cos(ang)*rr, Math.sin(ang)*rr) : out.moveTo(Math.cos(ang)*rr, Math.sin(ang)*rr); }
    out.closePath();
    out.shadowColor = hc(P.hue + .12, 90, 60, Math.min(1, a)); out.shadowBlur = R*.5;
    out.fillStyle = hc(P.hue + .12, 90, 85, Math.min(1, a*.9)); out.fill();
    out.shadowBlur = 0; out.strokeStyle = `rgba(255,255,255,${Math.min(1, a*.6)})`; out.lineWidth = Math.max(1, u*.003); out.stroke();
    out.restore();
  }
  function draw(now, P){
    const src = bufs[i], c = ctxs[1-i]; i = 1 - i;
    const u = bh, cx = bw/2 + P.cx*u, cy = bh/2 - P.cy*u;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = '#000'; c.fillRect(0, 0, bw, bh);
    const z = Math.max(1.002, P.zoom + P.bass*P.react*.035 + P.beat*.015), wob = P.warp*.012;
    c.save();
    c.translate(cx, cy);
    c.rotate(P.rot + Math.sin(now/700)*wob*.5);
    c.scale(z*(1 + Math.sin(now/530)*wob), z*(1 + Math.cos(now/610)*wob));
    c.translate(-cx, -cy);
    c.globalAlpha = Math.min(.995, P.decay - P.beat*.09);
    if (hasFilter && P.hueShift > 0) c.filter = `hue-rotate(${(P.hueShift*57.3).toFixed(2)}deg)`;
    c.drawImage(src, 0, 0);
    c.restore();
    if (hasFilter) c.filter = 'none';
    // subtract a little each frame so faint trails fully fade instead of leaving grey haze
    c.globalAlpha = 1; c.globalCompositeOperation = 'difference';
    c.fillStyle = 'rgb(5,5,5)'; c.fillRect(0, 0, bw, bh);

    c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round'; c.lineCap = 'round';
    const bright = .35 + P.treb*P.react*.5 + P.beat*.8;
    const symF = Math.max(1, P.sym), n1 = Math.floor(symF), fr = symF - n1;
    const drawSym = (n, w) => {
      if (w < .02) return;
      c.save(); c.translate(cx, cy);
      if (n === 1) layers(c, P, u, now, bright*w);
      else {
        const seg = Math.PI*2/n, far = Math.hypot(bw, bh);
        for (let k = 0; k < n; k++) for (const flip of [1, -1]) {
          c.save(); c.rotate(k*seg); c.scale(1, flip);
          c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, far, 0, seg/2 + .002); c.closePath(); c.clip();
          layers(c, P, u, now, bright*w);
          c.restore();
        }
      }
      c.restore();
    };
    drawSym(n1, 1 - fr); drawSym(n1 + 1, fr);

    const sx = x => bw/2 + x*u, sy = y => bh/2 - y*u, hsl = h => ((((h)%1)+1)%1*360).toFixed(1);
    if (P.cometW > .01) P.comets.forEach((cm, j) => {
      const x = sx(cm.x), y = sy(cm.y), rad = u*.06, h = hsl(P.hue + j*.33), a = Math.min(1, P.cometW*cm.z);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `hsla(${h},80%,75%,${a})`); g.addColorStop(.3, `hsla(${h},90%,55%,${a*.4})`); g.addColorStop(1, `hsla(${h},90%,50%,0)`);
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad*2, rad*2);
    });
    if (P.shockW > .01) P.shocks.forEach(sh => {
      if (sh.s < .02) return;
      c.beginPath(); c.arc(sx(sh.x), sy(sh.y), sh.r*u, 0, Math.PI*2);
      c.lineWidth = u*(.006 + sh.r*.015);
      c.strokeStyle = `hsla(${hsl(P.hue + .5 + sh.r*.3)},80%,60%,${Math.min(1, P.shockW*sh.s)})`; c.stroke();
    });

    if (P.ribW > .01) {
      c.save(); c.translate(bw/2, bh/2); c.rotate(-P.ribAng);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        for (let j = 0; j <= 96; j++) {
          const qx = (j/96 - .5)*1.6*bw/u;
          const wv = dataArr[Math.floor((((qx*.5 + .5 + i*.13) % 1) + 1) % 1*255)]/128 - 1;
          const yv = .28*(i - 1) + Math.sin(qx*(2 + i*.7) + P.ribPh*(1 + i*.3) + i*2.1)*(.08 + P.mid*P.react*.25) + wv*.05*P.react;
          j ? c.lineTo(qx*u, -yv*u) : c.moveTo(qx*u, -yv*u);
        }
        glowStroke(c, a => `hsla(${hsl(P.hue + .15 + i*.08)},85%,60%,${Math.min(1, a).toFixed(3)})`, P.ribW*(.5 + P.beat*.8), u);
      }
      c.restore();
    }
    if (P.horW > .01) {
      const a = Math.min(1, P.horW*(.5 + P.beat*.6)), hc = hsl(P.hue + .8), asp2 = bw/bh/2;
      c.lineWidth = Math.max(1, u*.003);
      const fr = ((P.horScroll % 1) + 1) % 1;
      for (let k = 0; k < 40; k++) {
        const z = .5*(k + 1 - fr), yy = .25/z; if (yy > P.horY + .5) continue;
        c.strokeStyle = `hsla(${hc},80%,60%,${(a*sstep(0, .25, yy)).toFixed(3)})`;
        c.beginPath(); c.moveTo(0, sy(P.horY - yy)); c.lineTo(bw, sy(P.horY - yy)); c.stroke();
      }
      const zb = .25/(P.horY + .5);
      c.strokeStyle = `hsla(${hc},80%,60%,${(a*.8).toFixed(3)})`;
      for (let X = -40; X <= 40; X++) { const xw = X/4;
        c.beginPath(); c.moveTo(sx(0), sy(P.horY)); c.lineTo(sx(xw/zb), sy(-.5)); c.stroke(); }
      c.beginPath();
      for (let j = 0; j <= 80; j++) {
        const xs = (j/80 - .5)*2*asp2, h = dataArr[256 + Math.floor(Math.min(1, Math.abs(xs)/asp2)*.8*255)]/255*.22*(.5 + P.react*.5);
        j ? c.lineTo(sx(xs), sy(P.horY + h)) : c.moveTo(sx(xs), sy(P.horY + h));
      }
      glowStroke(c, al => `hsla(${hsl(P.hue + .1)},75%,60%,${Math.min(1, al).toFixed(3)})`, a, u);
    }
    if (P.flowW > .01) {
      const [r, g, b] = P.flowCol.map(v => Math.round(Math.min(1, v)*255));
      c.fillStyle = `rgb(${r},${g},${b})`; const s2 = Math.max(1.5, u/300);
      for (let i = 0; i < NP; i++) c.fillRect(sx(parts[i*3]) - s2/2, sy(parts[i*3+1]) - s2/2, s2, s2);
    }

    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
    drawWorld(P, now);
    out.globalCompositeOperation = 'lighter';
    out.drawImage(bufs[i], 0, 0, W, H);
    drawStar(P); drawHits(P);
    out.globalCompositeOperation = 'source-over';
    out.fillStyle = vignette; out.fillRect(0, 0, W, H);
  }
  return {resize, draw};
}
