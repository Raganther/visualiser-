// Simple mode: the same picture drawn with the Canvas 2D API, for browsers without WebGL.
import { NP, parts } from '../fx/particles.js';
import { H, W } from './gl.js';
import { dataArr } from '../state.js';
import { sstep } from '../util.js';
import { HIT_VISUALS, WORLD_VISUALS } from '../visuals/registry.js';

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
  WORLD_VISUALS.forEach(v => v.init2d && v.init2d());    // worlds that keep their own simple-mode state (in registry order)
  // simple mode draws aurora and city before land and space (legacy order, kept so the golden recording matches)
  const worlds2d = [...WORLD_VISUALS].sort((a, b) => (a.order2d || 0) - (b.order2d || 0));
  function drawWorlds(P, now){
    for (const v of worlds2d) if (P.w[v.key] > .01) { out.save(); v.draw2d(out, P, now/1000); out.restore(); }
  }
  function drawHits(P){
    for (const v of HIT_VISUALS) if (v.draw2d) { out.save(); v.draw2d(out, P); out.restore(); }
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
    drawWorlds(P, now);
    out.globalCompositeOperation = 'lighter';
    out.drawImage(bufs[i], 0, 0, W, H);
    drawHits(P);
    out.globalCompositeOperation = 'source-over';
    out.fillStyle = vignette; out.fillRect(0, 0, W, H);
  }
  return {resize, draw};
}
