// Simple mode: the same picture drawn with the Canvas 2D API, for browsers without WebGL.
import { HIT_VISUALS, LAYER_VISUALS, OBJECT_VISUALS, VISUALS, WORLD_VISUALS, byKey } from '../visuals/registry.js';
import { TUNE } from '../tuning.js';
import { TW } from '../scene/tweaks.js';
import { DANCE } from '../scene/dance.js';
// a layer following another sound: that level in place of its bass, mids and treble
const own = (P, t) => t.band === null ? P : {...P, bass: t.band, mid: t.band, treb: t.band};

/* Simple mode: the same feedback idea with the plain 2D canvas, for browsers without WebGL */
export function make2D(view){
  const out = view.getContext('2d');
  const bufs = [document.createElement('canvas'), document.createElement('canvas')];
  const ctxs = bufs.map(b => b.getContext('2d'));
  const hasFilter = typeof ctxs[0].filter === 'string';
  let W = 2, H = 2, bw = 2, bh = 2, i = 0, vignette = null;   // W, H: the screen's size (from resize)
  const groups = {};   // extra trail groups' buffer pairs, made on first use
  function resize(w, h){
    W = w; H = h;
    const sc = Math.min(1, 900 / Math.max(w, h)), nw = Math.max(2, Math.round(w*sc)), nh = Math.max(2, Math.round(h*sc));
    if (nw !== bw || nh !== bh) {   // (the trails are at most 900 wide: a smaller screen step often leaves them as they are, and them kept)
      bw = nw; bh = nh;
      bufs.forEach((b, k) => { b.width = bw; b.height = bh; ctxs[k].fillStyle = '#000'; ctxs[k].fillRect(0,0,bw,bh); });
      for (const g in groups) delete groups[g];
    }
    vignette = out.createRadialGradient(w/2, h/2, Math.min(w,h)*.3, w/2, h/2, Math.hypot(w,h)*.6);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.75)');
  }
  // a layer's dance (scene/dance.js), round the point the canvas is at: shifted, turned, scaled (y up in the picture)
  const dance2d = (c, dn, u) => { if (!dn) return; c.translate(dn.dx*u, -dn.dy*u); c.rotate(-dn.rot); c.scale(dn.s, dn.s); };
  function glowStroke(c, colour, weight, u){
    if (weight < .01) return;
    c.strokeStyle = colour(.12*weight); c.lineWidth = u*.03; c.stroke();
    c.strokeStyle = colour(.6*weight); c.lineWidth = u*.008; c.stroke();
  }
  // the layers drawn inside the kaleidoscope fold (ring, scope, plasma, burst)
  function layers(c, P, u, now, bright){
    const col = off => a => `hsla(${((((P.hue+off)%1)+1)%1*360).toFixed(1)},95%,55%,${Math.min(1,a*bright).toFixed(3)})`;
    const x = {u, now, bw, col, glowStroke};
    for (const v of LAYER_VISUALS) if (v.folded2d) {
      const t = TW[v.key], dn = DANCE.layer[v.key];
      if (!t && !dn) { v.folded2d(c, P, x); continue; }
      c.save(); dance2d(c, dn, u); if (t) c.scale(t.size, t.size);   // (drawn round the centre)
      v.folded2d(c, t ? own(P, t) : P, t ? {...x, now: now + t.off*1000} : x); c.restore();
    }
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
  function drawFronts(P, now, a = 1){
    out.save(); out.beginPath();
    for (const v of WORLD_VISUALS) if (v.front && P.w[v.key] > .01) v.front.path2d(out, P, now/1000);
    out.clip(); out.globalCompositeOperation = 'source-over'; out.globalAlpha = a; out.drawImage(worldCan, 0, 0); out.restore();
  }
  // a trail group cut to (or away from) a shape: an object's silhouette or the worlds' front planes
  const maskCans = [];
  function maskedGlow(P, src, m, k){
    const mc = maskCans[k] || (maskCans[k] = document.createElement('canvas')), mctx = mc.getContext('2d');
    if (mc.width !== W || mc.height !== H) { mc.width = W; mc.height = H; }
    mctx.globalCompositeOperation = 'source-over'; mctx.globalAlpha = 1; mctx.clearRect(0, 0, W, H); mctx.drawImage(src, 0, 0, W, H);
    if (m.world && m.inside && !P.frontOn) return mc;   // held inside a front that isn't on screen: all of it
    mctx.globalCompositeOperation = m.inside ? 'destination-in' : 'destination-out';
    mctx.beginPath();
    if (m.world) { for (const v of WORLD_VISUALS) if (v.front && P.w[v.key] > .01) v.front.path2d(mctx, P, P.t2d); }
    else byKey[m.object].path2d(mctx, P);
    mctx.fillStyle = '#fff'; mctx.fill();
    return mc;
  }
  // a trail group shrunk into a world's subject (fit): its centre onto the subject, smaller by P.fit[2]
  const fitCan = document.createElement('canvas');
  function fitted(P, src){
    if (fitCan.width !== W || fitCan.height !== H) { fitCan.width = W; fitCan.height = H; }
    const f = fitCan.getContext('2d'), [fx, fy, k] = P.fit, sx = W/2 + P.cx*H, sy = H/2 - P.cy*H;
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H);
    f.setTransform(1/k, 0, 0, 1/k, W/2 + fx*H - sx/k, H/2 - fy*H - sy/k); f.drawImage(src, 0, 0, W, H); f.setTransform(1, 0, 0, 1, 0, 0);
    return fitCan;
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
    for (const v of trails2d) { const t = TW[v.key], dn = DANCE.layer[v.key]; c.save();
      if (t || dn) { c.translate(cx, cy); dance2d(c, dn, u); if (t) c.scale(t.size, t.size); c.translate(-cx, -cy); }   // its own size and dance round the centre
      v.trails2d(c, t ? own(Pg, t) : Pg, tx); c.restore(); }
    return B[1-k];
  }
  // the stack, bottom to top, drawn straight onto the screen
  function draw(now, P){
    const sc = P.sc, glows = {};
    P.t2d = now/1000;
    for (const g in groups) if (!(g in sc.groups)) delete groups[g];   // a group this scene doesn't use: gone (no stale frames later)
    for (const g in sc.groups) glows[g] = trails(now, P, g);
    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
    drawFills(P, now, glows);
    let kept = false;
    for (const st of sc.steps) {
      if (st.mesh) { drawObjects(P, st); continue; }
      for (const it of st.seg) {
        const kw = it.drive ? P.kw[it.i] : 1;   // a weight that follows a signal
        if (it.t === 'world') { drawWorlds(kw === 1 ? P : {...P, w: Object.fromEntries(Object.entries(P.w).map(([k, v]) => [k, v*kw]))}, now);
          if (kal(P, 1)) foldOnto(out, snap(out.canvas), P);   // the kaleidoscope on the world alone (drawn first, onto black)
          if (sc.front) { keepWorlds(); kept = true; } }
        else if (it.t === 'front') { if (!kept) { keepBlankWorlds(P, now); kept = true; } drawFronts(P, now, Math.min(1, kw)); }
        else if (it.t === 'hits') drawHits(P);
        else {
          if (!glows[it.g]) continue;
          const m = it.mask, on = m && (m.world || byKey[m.object] && P.o[m.object] > .01);
          const src = it.fit ? fitted(P, glows[it.g]) : glows[it.g];
          const g0 = on ? maskedGlow(P, src, m, sc.masks.indexOf(m.object) + 1) : src;
          const glow = kal(P, 2) ? foldGlow(g0, P) : g0;   // the kaleidoscope on the glow alone
          out.globalCompositeOperation = 'lighter'; out.globalAlpha = Math.min(1, kw);
          out.drawImage(glow, 0, 0, W, H);
          // the kick flashes here, after the trails, so the brightest moment lands on the kick instead of building up after it
          if (P.beat > .01) { out.globalAlpha = Math.min(1, P.beat*.6*kw); out.drawImage(glow, 0, 0, W, H); }
          out.globalAlpha = 1;
        }
      }
    }
    glow2d();
    if (kal(P, 0)) foldOnto(out, snap(out.canvas), P);   // the kaleidoscope on everything
    else if (kal(P, 3)) {   // or inside the objects on screen
      const obs = OBJECT_VISUALS.filter(v => P.o[v.key] > .01 && v.path2d);
      if (obs.length) { const c = snap(out.canvas); out.save(); out.beginPath(); for (const v of obs) v.path2d(out, P); out.clip(); foldOnto(out, c, P); out.restore(); }
    }
    finish2d(P);
    out.globalCompositeOperation = 'source-over';
    out.fillStyle = vignette; out.fillRect(0, 0, W, H);
  }
  // the glow: the picture at quarter size, its darks pushed down (a rough bright-pass: contrast), blurred, and added back.
  // Browsers without canvas filters go without
  const bloomCan = document.createElement('canvas'), bctx = bloomCan.getContext('2d');
  function glow2d(){
    const R = TUNE.render; if (!hasFilter || R.bloom <= 0) return;
    const w = Math.max(1, W >> 2), h = Math.max(1, H >> 2);
    if (bloomCan.width !== w || bloomCan.height !== h) { bloomCan.width = w; bloomCan.height = h; }
    bctx.globalCompositeOperation = 'copy'; bctx.filter = `contrast(${(1/(1 - R.bloomThresh)).toFixed(2)}) blur(${(R.bloomRadius*1.5).toFixed(1)}px)`;
    bctx.drawImage(out.canvas, 0, 0, w, h); bctx.filter = 'none';
    out.globalCompositeOperation = 'lighter'; out.globalAlpha = Math.min(1, R.bloom*.6); out.drawImage(bloomCan, 0, 0, W, H); out.globalAlpha = 1;
  }
  // the kaleidoscope (P.kal, see main.js): the picture copied, then laid back as mirrored wedges round the trails' centre,
  // over the unfolded picture as far as it's folded
  const kal = (P, where) => P.kal && P.kal.on && P.kal.where === where;
  const snapCan = document.createElement('canvas'), foldCan2 = document.createElement('canvas');
  function snap(src){
    if (snapCan.width !== W || snapCan.height !== H) { snapCan.width = W; snapCan.height = H; }
    const x = snapCan.getContext('2d'); x.globalCompositeOperation = 'copy'; x.globalAlpha = 1; x.drawImage(src, 0, 0, W, H);
    return snapCan;
  }
  const diveCan = document.createElement('canvas');
  function foldOnto(o, src, P){
    const [n, , amt, ang] = P.kal.v, h = Math.PI/n, A = -ang - h;   // (the canvas turns the other way)
    const x0 = W/2 + P.kal.c[0]*H, y0 = H/2 - P.kal.c[1]*H, R = Math.hypot(W, H), mode = P.kal.mode || 0;
    if (mode === 1) {   // the mirror box: the square round the centre, reflected across its walls in every direction (flat walls here)
      const b = .9/(n + P.kal.v[1])*H, s2 = 2*b, nx = Math.ceil(W/s2/2) + 1, ny = Math.ceil(H/s2/2) + 1;
      o.save(); o.globalCompositeOperation = 'source-over'; o.globalAlpha = amt;
      for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) {
        o.save(); o.translate(x0 + i*s2, y0 + j*s2); o.scale(i & 1 ? -1 : 1, j & 1 ? -1 : 1);
        o.drawImage(src, x0 - b, y0 - b, s2, s2, -b, -b, s2, s2); o.restore(); }
      o.restore(); return;
    }
    if (mode === 2) {   // the dive: the wedges drawn aside, then laid back as copies nested inwards, growing as it dives
      if (diveCan.width !== W || diveCan.height !== H) { diveCan.width = W; diveCan.height = H; }
      const d = diveCan.getContext('2d'); d.globalCompositeOperation = 'copy'; d.globalAlpha = 1; d.drawImage(src, 0, 0, W, H);
      foldOnto(d, src, {kal: {...P.kal, mode: 0, v: [n, P.kal.v[1], 1, ang]}});
      const L = P.kal.v2[3], f = P.kal.v2[2] % 1, R0 = .5*H;
      o.save(); o.globalCompositeOperation = 'source-over'; o.globalAlpha = amt;
      for (let k = -1; k < 7; k++) { const sc = Math.exp(L*(f - k)), r = R0*sc; if (r < 2) break;
        o.save(); o.beginPath(); o.arc(x0, y0, k < 0 ? R : r, 0, Math.PI*2); o.clip(); o.translate(x0, y0); o.scale(sc, sc); o.drawImage(diveCan, -x0, -y0, W, H); o.restore(); }
      o.restore(); return;
    }
    o.save(); o.globalCompositeOperation = 'source-over'; o.globalAlpha = amt;
    for (let j = 0; j < 2*n; j++) { o.save(); o.beginPath(); o.moveTo(x0, y0); o.arc(x0, y0, R, A + j*h, A + (j + 1)*h + .002); o.closePath(); o.clip();
      o.translate(x0, y0);
      if (j & 1) { const L = A + (j + 1)*h/2; o.rotate(L); o.scale(1, -1); o.rotate(-L); } else o.rotate(j*h);
      o.drawImage(src, -x0, -y0, W, H); o.restore(); }
    o.restore();
  }
  function foldGlow(g, P){
    if (foldCan2.width !== W || foldCan2.height !== H) { foldCan2.width = W; foldCan2.height = H; }
    const x = foldCan2.getContext('2d'); x.globalCompositeOperation = 'copy'; x.globalAlpha = 1 - P.kal.v[2]; x.drawImage(g, 0, 0, W, H);
    foldOnto(x, g, P); return foldCan2;
  }
  // the glitch (bands of the picture jumping sideways, the colours split) and the film grain (noise and scan lines)
  let grainCan = null;
  function finish2d(P){
    const gl = P.glitch ? P.glitch[0] : 0, gr = P.grain || 0;
    if (gl > .01) {
      const c = snap(out.canvas), n = 22, h = i => { const v = Math.sin(i*12.9898 + P.glitch[1]*78.233)*43758.5453; return v - Math.floor(v); };
      out.save(); out.globalCompositeOperation = 'source-over';
      for (let i = 0; i < n; i++) { const hv = h(i), y0 = Math.floor(H - (i + 1)*H/n), hh = Math.ceil(H/n) + 1;
        if (hv > .5) { const dx = (hv - .75)*.25*gl*W; out.drawImage(c, 0, y0, W, hh, dx, y0, W, hh); out.drawImage(c, 0, y0, W, hh, dx - Math.sign(dx)*W, y0, W, hh); } }
      out.globalCompositeOperation = 'lighter'; out.globalAlpha = .25*gl;   // the colours split: a faint offset copy
      out.drawImage(c, .007*gl*W, 0); out.restore();
    }
    if ((P.hush || 0) > .01) {   // holding its breath before a drop: darker, most at the edges
      out.save(); const g = out.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.hypot(W, H)/2);
      g.addColorStop(0, `rgba(0,0,0,${(P.hush*.75).toFixed(3)})`); g.addColorStop(1, `rgba(0,0,0,${Math.min(1, P.hush*1.05).toFixed(3)})`);
      out.globalCompositeOperation = 'source-over'; out.fillStyle = g; out.fillRect(0, 0, W, H); out.restore();
    }
    if (gr > .01) {
      if (!grainCan) { grainCan = document.createElement('canvas'); grainCan.width = grainCan.height = 128; const x = grainCan.getContext('2d'), id = x.createImageData(128, 128);
        for (let i = 0; i < id.data.length; i += 4) { const v = Math.random()*255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); }
      out.save(); out.globalCompositeOperation = 'overlay'; out.globalAlpha = .07*gr;
      const ox = Math.floor(Math.random()*128), oy = Math.floor(Math.random()*128);
      out.fillStyle = out.createPattern(grainCan, 'repeat'); out.translate(-ox, -oy); out.fillRect(0, 0, W + 128, H + 128); out.restore();
      out.save(); out.globalCompositeOperation = 'multiply'; out.fillStyle = `rgba(0,0,0,${(.08*gr).toFixed(3)})`;
      for (let y = 0; y < H; y += 3) out.fillRect(0, y, W, 1);
      out.restore();
    }
  }
  // the worlds alone, for front planes when nothing below drew them
  function keepBlankWorlds(P, now){
    if (worldCan.width !== W || worldCan.height !== H) { worldCan.width = W; worldCan.height = H; }
    wctx.globalCompositeOperation = 'source-over'; wctx.globalAlpha = 1; wctx.fillStyle = '#000'; wctx.fillRect(0, 0, W, H);
    for (const v of WORLD_VISUALS) if (P.w[v.key] > .01) { wctx.save(); v.draw2d(wctx, P, now/1000); wctx.restore(); }
  }
  return {resize, draw};
}
