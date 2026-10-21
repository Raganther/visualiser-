// Facets as cells (docs/prism-plan.md, stage 5): a state on each facet of a coarse level of the Prism, moved by its
// neighbours' (each facet touches three), so its light lives on its own between the music's touches. A leaf module.
// The rules, each a section's character:
// - spots and stripes: reaction and diffusion (Gray and Scott's), slow patterns growing and settling: for calm;
// - swell: waves spreading from facet to facet and fading, set going where the music touches;
// - frost: light growing out from seeds along the facets, like frost on glass, melting slowly;
// - fireflies: each facet blinking on its own clock; the closer they're coupled (a build) the more they fall into step,
//   until they all flash as one (the drop), then scatter.
export const RULES = ['spots', 'stripes', 'swell', 'frost', 'fireflies'];
const GS = {spots: [.03, .062], stripes: [.04, .06]};   // feed, kill (found to hold a pattern on a few hundred facets: a fifth lit as spots, half as a maze)

export function makeCells(NA, ADJ, rnd){
  const C = {NA, ADJ, u: new Float32Array(NA).fill(1), v: new Float32Array(NA), lu: new Float32Array(NA), lv: new Float32Array(NA),
    h: new Float32Array(NA), hv: new Float32Array(NA), f: new Float32Array(NA), ph: new Float32Array(NA), om: new Float32Array(NA), out: new Float32Array(NA), R: 0, K: 0, acc: 0};
  for (let c = 0; c < NA; c++) { C.ph[c] = rnd()*Math.PI*2; C.om[c] = rnd() - .5; }
  return C;
}
// each facet's neighbours' mean, less its own (the edges of an open square have fewer)
function lap(C, x, o){ const {NA, ADJ} = C;
  for (let c = 0; c < NA; c++) { let s = 0, n = 0; for (let j = 0; j < 3; j++) { const k = ADJ[c*3 + j]; if (k >= 0) { s += x[k]; n++; } } o[c] = n ? s/n - x[c] : 0; } }
// the music touching it: amt at these facets (each rule takes it its own way)
export function touch(C, rule, cells, amt = 1){
  for (const c of cells) {
    if (rule === 'spots' || rule === 'stripes') { C.v[c] = Math.min(1, C.v[c] + .5*amt); C.u[c] = Math.max(0, C.u[c] - .5*amt); }
    else if (rule === 'swell') C.hv[c] += amt;
    else if (rule === 'frost') C.f[c] = 1;
    else if (rule === 'fireflies') C.ph[c] = 0;
  }
}
// a stab clears part of it (a wedge melts, a spot wipes)
export function clear(C, cells){ for (const c of cells) { C.v[c] = 0; C.u[c] = 1; C.f[c] = 0; C.h[c] = C.hv[c] = 0; } }
// on the drop: every firefly in step (they flash as one)
export function syncAll(C){ C.ph.fill(0); }
export function scatter(C, rnd){ for (let c = 0; c < C.NA; c++) C.ph[c] = rnd()*Math.PI*2; }
// a frame: dt seconds; T the tuning (TUNE.prism.cells); beat the beat's length; K how strongly the fireflies are coupled
export function stepCells(C, rule, dt, T, beat, K, rnd){
  const {NA, out} = C; beat = beat > .2 ? beat : .5;   // (before the beat is known it can read 0: an endless clock, and a NaN that blacked out the whole picture)
  if (rule === 'spots' || rule === 'stripes') {
    const [F, k] = GS[rule]; C.acc += dt*T.rdRate;
    for (; C.acc >= 1; C.acc--) {   // (a fixed step, as many a frame as the rate asks)
      lap(C, C.u, C.lu); lap(C, C.v, C.lv);
      for (let c = 0; c < NA; c++) { const u = C.u[c], v = C.v[c], r = u*v*v;
        C.u[c] = Math.max(0, Math.min(1, u + T.du*C.lu[c] - r + F*(1 - u))); C.v[c] = Math.max(0, Math.min(1, v + T.dv*C.lv[c] + r - (F + k)*v)); }
    }
    let mx = 0; for (let c = 0; c < NA; c++) { mx = Math.max(mx, C.v[c]); const x = Math.max(0, Math.min(1, (C.v[c] - .04)*T.rdGain)); out[c] = x*x*(3 - 2*x); }   // (a spot's v sits about .15–.3)
    if (mx < .08) for (let i = 0; i < 8; i++) { const c = Math.floor(rnd()*NA); C.v[c] = .5; C.u[c] = .5; }   // (died out: seeded afresh; sparse seeds sometimes fade)
  } else if (rule === 'swell') {
    const s = Math.min(1, dt*60); lap(C, C.h, C.lu);
    for (let c = 0; c < NA; c++) { C.hv[c] = (C.hv[c] + T.waveC*C.lu[c]*s)*Math.exp(-T.waveDamp*dt); }
    for (let c = 0; c < NA; c++) { C.h[c] += C.hv[c]*s; out[c] = Math.min(1, Math.abs(C.h[c])*T.waveGain); }
  } else if (rule === 'frost') {
    C.acc += dt*T.frostRate;
    for (; C.acc >= 1; C.acc--) {
      for (let c = 0; c < NA; c++) if (C.f[c] < .5) { let n = 0; for (let j = 0; j < 3; j++) { const k = C.ADJ[c*3 + j]; if (k >= 0 && C.f[k] > .9) n++; }
        if (n && rnd() < T.frostGrow*(n === 1 ? 1 : .35)) C.lv[c] = 1; else C.lv[c] = 0; } else C.lv[c] = 0;   // (one frosted neighbour grows it most: fronds, not blobs)
      for (let c = 0; c < NA; c++) if (C.lv[c]) C.f[c] = 1;
    }
    for (let c = 0; c < NA; c++) { C.f[c] *= Math.exp(-dt/T.frostMelt); out[c] = C.f[c]; }
  } else if (rule === 'fireflies') {
    // each its own clock round a cycle of a few beats; pulled towards the swarm's mean phase by K (the order R says how in step)
    let sx = 0, sy = 0; for (let c = 0; c < NA; c++) { sx += Math.cos(C.ph[c]); sy += Math.sin(C.ph[c]); }
    const R = Math.hypot(sx, sy)/NA, psi = Math.atan2(sy, sx), w0 = Math.PI*2/(beat*T.flyBeats); C.R = R; C.K = K;
    for (let c = 0; c < NA; c++) {
      let p = C.ph[c] + dt*(w0*(1 + C.om[c]*T.flySpread) + K*w0*R*Math.sin(psi - C.ph[c]));
      p %= Math.PI*2; if (p < 0) p += Math.PI*2; C.ph[c] = p;
      const d = p > Math.PI ? p - Math.PI*2 : p; out[c] = Math.exp(-(d*d)/(2*T.flyWidth*T.flyWidth));
    }
  } else out.fill(0);
  return out;
}
