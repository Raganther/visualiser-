// Simple mode: the same picture drawn with the Canvas 2D API, for browsers without WebGL.
import { H, W } from './gl.js';
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';

/* Simple mode: the same feedback idea with the plain 2D canvas, for browsers without WebGL */
export function make2D(view){
  const out = view.getContext('2d');
  const bufs = [document.createElement('canvas'), document.createElement('canvas')];
  const ctxs = bufs.map(b => b.getContext('2d'));
  const hasFilter = typeof ctxs[0].filter === 'string';
  let bw = 2, bh = 2, i = 0, vignette = null;
  const groups = {};   // extra trail groups' buffer pairs, made on first use
  function resize(w, h){
    const sc = Math.min(1, 900 / Math.max(w, h));
    bw = Math.max(2, Math.round(w*sc)); bh = Math.max(2, Math.round(h*sc));
    bufs.forEach((b, k) => { b.width = bw; b.height = bh; ctxs[k].fillStyle = '#000'; ctxs[k].fillRect(0,0,bw,bh); });
    for (const g in groups) delete groups[g];
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
  // the folded layers, n ways round (cx, cy), into any canvas g: the trails, or a scene's fill
  function drawSym(g, P, n, w, cx, cy, now, bright, zoom = 1){
    if (w < .02) return;
    const u = bh;
    g.save(); g.translate(cx, cy); if (zoom !== 1) g.scale(1/zoom, 1/zoom);
    if (n === 1) layers(g, P, u, now, bright*w);
    else {
      const seg = Math.PI*2/n, far = Math.hypot(bw, bh)*zoom;
      for (let k = 0; k < n; k++) for (const flip of [1, -1]) {
        g.save(); g.rotate(k*seg); g.scale(1, flip);
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, far, 0, seg/2 + .002); g.closePath(); g.clip();
        layers(g, P, u, now, bright*w);
        g.restore();
      }
    }
    g.restore();
  }
  // a scene's fills: another image seen through an object's glass. A trail group is already a picture; layers are drawn
  // alone (folded ones through the kaleidoscope, the rest as they are); worlds are drawn whole, then shrunk
  const fillCan = {};
  function drawFills(P, now, glows){
    for (const key in P.sc.fills) {
      if (!(P.o[key] > .01)) continue;
      const f = P.sc.fills[key];
      P.m[key].fillAmt = TUNE.scene.fillAmt*(f.part ? TUNE.scene.partFillAmt : 1); P.m[key].fillPart = f.part;

      const fc = fillCan[key] || (fillCan[key] = document.createElement('canvas')), g = fc.getContext('2d');
      if (fc.width !== bw || fc.height !== bh) { fc.width = bw; fc.height = bh; }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, bw, bh);
      if (f.src !== 'layers') {   // a world or a trail group, shrunk into the glass (a world brightened: it's mostly dark sky)
        const img = f.src === 'world' ? (keepBlankWorlds(P, now), worldCan) : glows[f.g], z = 1/f.zoom;
        g.drawImage(img, bw*(1 - z)/2, bh*(1 - z)/2, bw*z, bh*z);
        if (f.src === 'world') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, TUNE.scene.worldFillGain - 1); g.drawImage(fc, 0, 0); g.globalAlpha = 1; }
      } else {
        g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
        const Pf = {...P, l: {}};
        for (const k in P.l) Pf.l[k] = f.layers.includes(k) ? 1 : 0;
        for (const h of HIT_VISUALS) if (h.inTrails && !f.layers.includes(h.key)) Pf[h.trailWeight] = 0;
        const zoom = f.zoom || TUNE.scene.fillZoom;
        drawSym(g, Pf, Math.max(1, Math.round(f.fold)), 1, bw/2, bh/2, now, .35*TUNE.scene.fillGain, zoom);
        const u = bh, sx = x => bw/2 + x*u, sy = y => bh/2 - y*u, hsl = h => ((((h)%1)+1)%1*360).toFixed(1);
        g.save(); g.translate(bw/2, bh/2); g.scale(1/zoom, 1/zoom); g.translate(-bw/2, -bh/2);
        for (const v of trails2d) if (f.layers.includes(v.key)) { g.save(); v.trails2d(g, Pf, {u, bw, bh, sx, sy, hsl, glowStroke}); g.restore(); }
        g.restore();
      }
      P.m[key].fillImg = fc;
    }
  }
  // between: a copy of the worlds, laid back over the trails through their front planes' outlines
  const worldCan = document.createElement('canvas'), wctx = worldCan.getContext('2d');
  function keepWorlds(){
    if (worldCan.width !== W || worldCan.height !== H) { worldCan.width = W; worldCan.height = H; }
    wctx.globalCompositeOperation = 'copy'; wctx.drawImage(out.canvas, 0, 0);
  }
  function drawFronts(P, now){
    out.save(); out.beginPath();
    for (const v of WORLD_VISUALS) if (v.front && P.w[v.key] > .01) v.front.path2d(out, P, now/1000);
    out.clip(); out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1; out.drawImage(worldCan, 0, 0); out.restore();
  }
  // a trail group cut to (or away from) a shape: an object's silhouette or the worlds' front planes
  const maskCans = [];
  function maskedGlow(P, src, m, k){
    const mc = maskCans[k] || (maskCans[k] = document.createElement('canvas')), mctx = mc.getContext('2d');
    if (mc.width !== W || mc.height !== H) { mc.width = W; mc.height = H; }
    mctx.globalCompositeOperation = 'source-over'; mctx.globalAlpha = 1; mctx.clearRect(0, 0, W, H); mctx.drawImage(src, 0, 0, W, H);
    mctx.globalCompositeOperation = m.inside ? 'destination-in' : 'destination-out';
    mctx.beginPath();
    if (m.world) { for (const v of WORLD_VISUALS) if (v.front && P.w[v.key] > .01) v.front.path2d(mctx, P, P.t2d); }
    else byKey[m.object].path2d(mctx, P);
    mctx.fillStyle = '#fff'; mctx.fill();
    return mc;
  }
  // everything else in the trails, in the same paint order as WebGL
  const trails2d = VISUALS.filter(v => v.trails2d).sort((a, b) => a.paint - b.paint);
  WORLD_VISUALS.forEach(v => v.init2d && v.init2d());    // worlds that keep their own simple-mode state (in registry order)
  function drawWorlds(P, now){
    for (const v of WORLD_VISUALS) if (P.w[v.key] > .01) { out.save(); v.draw2d(out, P, now/1000); out.restore(); }
  }
  function drawObjects(P, step){
    for (const v of OBJECT_VISUALS) if (P.o[v.key] > .01 && (step.mesh === '*' ? !P.sc.placed.has(v.key) : v.key === step.mesh)) {
      out.save(); out.globalCompositeOperation = 'source-over'; v.draw2d(out, P); out.restore(); }
  }
  function drawHits(P){
    for (const v of HIT_VISUALS) if (v.draw2d) { out.save(); v.draw2d(out, P); out.restore(); }
  }
  // one trail group's feedback: its last frame moved and faded, then its own layers drawn on top
  function trails(now, P, g){
    const sc = P.sc, inG = k => sc.groupOf(k) === g;
    let pr = g === 'main' ? null : groups[g];
    if (g !== 'main' && !pr) { const b = [0, 1].map(() => { const e = document.createElement('canvas'); e.width = bw; e.height = bh; const x = e.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, bw, bh); return e; });
      pr = groups[g] = {bufs: b, ctxs: b.map(e => e.getContext('2d')), i: 0}; }
    const B = pr ? pr.bufs : bufs, C = pr ? pr.ctxs : ctxs, k = pr ? pr.i : i;
    const src = B[k], c = C[1-k];
    if (pr) pr.i = 1 - k; else i = 1 - i;
    // only this group's layers (and hits drawn in the trails) show in it
    const Pg = {...P, l: {}};
    for (const key in P.l) Pg.l[key] = inG(key) ? P.l[key] : 0;
    for (const h of HIT_VISUALS) if (h.inTrails && !inG(h.key)) Pg[h.trailWeight] = 0;
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
    c.drawImage(src, P.drift[0]*u, -P.drift[1]*u);   // the trails stream downwind
    c.restore();
    if (hasFilter) c.filter = 'none';
    // subtract a little each frame so faint trails fully fade instead of leaving grey haze
    c.globalAlpha = 1; c.globalCompositeOperation = 'difference';
    c.fillStyle = 'rgb(5,5,5)'; c.fillRect(0, 0, bw, bh);

    c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round'; c.lineCap = 'round';
    const bright = .35 + P.treb*P.react*.5;   // no kick boost here: in the trails it would build up and peak late
    const symF = Math.max(1, P.sym), n1 = Math.floor(symF), fr = symF - n1;
    drawSym(c, Pg, n1, 1 - fr, cx, cy, now, bright); drawSym(c, Pg, n1 + 1, fr, cx, cy, now, bright);

    const sx = x => bw/2 + x*u, sy = y => bh/2 - y*u, hsl = h => ((((h)%1)+1)%1*360).toFixed(1);
    const tx = {u, bw, bh, sx, sy, hsl, glowStroke};
    for (const v of trails2d) { c.save(); v.trails2d(c, Pg, tx); c.restore(); }
    return B[1-k];
  }
  // the stack, bottom to top, drawn straight onto the screen
  function draw(now, P){
    const sc = P.sc, glows = {};
    P.t2d = now/1000;
    for (const g in sc.groups) glows[g] = trails(now, P, g);
    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
    drawFills(P, now, glows);
    let kept = false;
    for (const st of sc.steps) {
      if (st.mesh) { drawObjects(P, st); continue; }
      for (const it of st.seg) {
        if (it.t === 'world') { drawWorlds(P, now); if (sc.front) { keepWorlds(); kept = true; } }
        else if (it.t === 'front') { if (!kept) { keepBlankWorlds(P, now); kept = true; } drawFronts(P, now); }
        else if (it.t === 'hits') drawHits(P);
        else {
          const m = it.mask, on = m && (m.world || byKey[m.object] && P.o[m.object] > .01);
          const glow = on ? maskedGlow(P, glows[it.g], m, sc.masks.indexOf(m.object) + 1) : glows[it.g];
          out.globalCompositeOperation = 'lighter';
          out.drawImage(glow, 0, 0, W, H);
          // the kick flashes here, after the trails, so the brightest moment lands on the kick instead of building up after it
          if (P.beat > .01) { out.globalAlpha = Math.min(1, P.beat*.6); out.drawImage(glow, 0, 0, W, H); out.globalAlpha = 1; }
        }
      }
    }
    out.globalCompositeOperation = 'source-over';
    out.fillStyle = vignette; out.fillRect(0, 0, W, H);
  }
  // the worlds alone, for front planes when nothing below drew them
  function keepBlankWorlds(P, now){
    if (worldCan.width !== W || worldCan.height !== H) { worldCan.width = W; worldCan.height = H; }
    wctx.globalCompositeOperation = 'source-over'; wctx.globalAlpha = 1; wctx.fillStyle = '#000'; wctx.fillRect(0, 0, W, H);
    for (const v of WORLD_VISUALS) if (P.w[v.key] > .01) { wctx.save(); v.draw2d(wctx, P, now/1000); wctx.restore(); }
  }
  return {resize, draw};
}
