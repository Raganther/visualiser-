// Simple mode: the same picture drawn with the Canvas 2D API, for browsers without WebGL.
import { H, W } from './gl.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS } from '../visuals/registry.js';

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
  // the layers drawn inside the kaleidoscope fold (ring, scope, plasma, burst)
  function layers(c, P, u, now, bright){
    const col = off => a => `hsla(${((((P.hue+off)%1)+1)%1*360).toFixed(1)},95%,55%,${Math.min(1,a*bright).toFixed(3)})`;
    const x = {u, now, bw, col, glowStroke};
    for (const v of LAYER_VISUALS) if (v.folded2d) v.folded2d(c, P, x);
  }
  // everything else in the trails, in the same paint order as WebGL
  const trails2d = VISUALS.filter(v => v.trails2d).sort((a, b) => a.paint - b.paint);
  WORLD_VISUALS.forEach(v => v.init2d && v.init2d());    // worlds that keep their own simple-mode state (in registry order)
  function drawWorlds(P, now){
    for (const v of WORLD_VISUALS) if (P.w[v.key] > .01) { out.save(); v.draw2d(out, P, now/1000); out.restore(); }
  }
  function drawObjects(P){
    for (const v of OBJECT_VISUALS) if (P.o[v.key] > .01) { out.save(); out.globalCompositeOperation = 'source-over'; v.draw2d(out, P); out.restore(); }
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
    c.globalAlpha = Math.min(.995, P.decay);
    if (hasFilter && P.hueShift > 0) c.filter = `hue-rotate(${(P.hueShift*57.3).toFixed(2)}deg)`;
    c.drawImage(src, 0, 0);
    c.restore();
    if (hasFilter) c.filter = 'none';
    // subtract a little each frame so faint trails fully fade instead of leaving grey haze
    c.globalAlpha = 1; c.globalCompositeOperation = 'difference';
    c.fillStyle = 'rgb(5,5,5)'; c.fillRect(0, 0, bw, bh);

    c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round'; c.lineCap = 'round';
    const bright = .35 + P.treb*P.react*.5;   // no kick boost here: in the trails it would build up and peak late
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
    const tx = {u, bw, bh, sx, sy, hsl, glowStroke};
    for (const v of trails2d) { c.save(); v.trails2d(c, P, tx); c.restore(); }

    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
    drawWorlds(P, now);
    out.globalCompositeOperation = 'lighter';
    out.drawImage(bufs[i], 0, 0, W, H);
    // the kick flashes here, after the trails, so the brightest moment lands on the kick instead of building up after it
    if (P.beat > .01) { out.globalAlpha = Math.min(1, P.beat*.6); out.drawImage(bufs[i], 0, 0, W, H); out.globalAlpha = 1; }
    drawObjects(P);
    drawHits(P);
    out.globalCompositeOperation = 'source-over';
    out.fillStyle = vignette; out.fillRect(0, 0, W, H);
  }
  return {resize, draw};
}
