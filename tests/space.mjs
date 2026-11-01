// Space test (scene/space.js, docs/space-plan.md stages 2 and 3): a light held on one side of the centrepiece lights that
// side of it (against the same light on the other side), for each kind of object (wire, lit, morphing, the Prism) in both renderers; the comets and the orbits' flares
// fly round it in depth, passing behind it (hidden) and in front of it (drawn over it), and place their lights; with the
// switch off they keep to the flat picture.
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('space: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

for (const mode of (process.env.SPACE_MODES || 'gl,2d').split(',')) {
  const browser = await launch(mode), page = await openPage(browser, url, {width: 320, height: 180});
  // a red light held to the object's left: the left half of it reddens more than the right, against the frame before
  for (const obj of ['skull', 'hand', 'ferro', 'jewel']) {
    const r = await page.evaluate(async (obj) => {
      const {solo} = await import('/src/ui/presets.js'), {S} = await import('/src/state.js'), {SPACE} = await import('/src/scene/space.js'), {SUBJ} = await import('/src/scene/subject.js');
      const {TUNE} = await import('/src/tuning.js'); TUNE.dance.amount = 0;   // (held still: the dance moves it from frame to frame)
      solo(obj); S.active[obj] = .9;
      for (let i = 0; i < 40; i++) __step(4);
      const c = document.querySelector('canvas'), g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d');
      // the red against the rest, left and right of the object's middle, within its circle
      const red = () => { x.clearRect(0, 0, g.width, g.height); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data, H = g.height, W = g.width;
        const cx = W/2 + SUBJ.x*H, cy = H/2 - SUBJ.y*H, R = SUBJ.r*H; let L = 0, Rt = 0;
        for (let j = Math.max(0, cy - R | 0); j < Math.min(H, cy + R); j++) for (let i = Math.max(0, cx - R | 0); i < Math.min(W, cx + R); i++) {
          if (Math.hypot(i - cx, j - cy) > R) continue; const q = (j*W + i)*4, e = d[q] - (d[q + 1] + d[q + 2])/2; if (i < cx) L += e; else Rt += e; }
        return [L, Rt]; };
      // off and on in turn, each on against the offs either side of it (the object's own light drifts from frame to frame),
      // with the light on the left and then on the right: what the left one adds to the left half more than the right one does
      let used = 0; const run = side => { const light = [{p: [side*SPACE.rad*1.6, .1, SPACE.rad*.8], c: [1, .05, .05], k: 3}]; let dL = 0, dR = 0, prev;
        SPACE.hold = []; __step(1); prev = red();
        for (let k = 0; k < 3; k++) { SPACE.hold = light; __step(1); const on = red(); used = Math.max(used, SPACE.n); SPACE.hold = []; __step(1); const off = red();
          dL += on[0] - (prev[0] + off[0])/2; dR += on[1] - (prev[1] + off[1])/2; prev = off; }
        return [dL/3, dR/3]; };
      const l = run(-1), rr = run(1);
      TUNE.dance.amount = 1;
      return {dL: Math.round(l[0]), dR: Math.round(l[1]), side: Math.round((l[0] - l[1]) - (rr[0] - rr[1])), used, subj: SUBJ.key};
    }, obj);
    check(`${mode}: a light on the left lights the ${obj}'s left`, r.subj === obj && r.used > 0 && r.dL > 1500 && r.side > 3000, JSON.stringify(r));
  }
  // the comets and the orbits round the skull, in depth
  const r = await page.evaluate(async () => {
    const {solo} = await import('/src/ui/presets.js'), {S} = await import('/src/state.js'), {SPACE, spaceHidden} = await import('/src/scene/space.js'), {danceShape} = await import('/src/scene/dance.js');
    const {comets} = await import('/src/fx/effects.js');
    solo('skull'); S.active.skull = .9; S.active.comets = .9; S.active.orbit = .7; danceShape('vortex');
    let zmin = 9, zmax = -9, front = 0, lights = 0, hid = 0, minR = 9;
    for (let i = 0; i < 120; i++) { __step(2);
      for (const c of comets) if (c.p3) { zmin = Math.min(zmin, c.p3[2]); zmax = Math.max(zmax, c.p3[2]); minR = Math.min(minR, Math.hypot(...c.p3)/SPACE.rad); if (spaceHidden(c.p3) > .5) hid++; }
      front = Math.max(front, SPACE.nFront); lights = Math.max(lights, SPACE.n); }
    S.explore.space = 0; for (let i = 0; i < 30; i++) __step(2);
    const off = {on: SPACE.on, p3: comets.some(c => c.p3), n: SPACE.n}; S.explore.space = 1;
    return {zmin, zmax, front, lights, hid, minR, off};
  });
  check(`${mode}: the comets pass behind the skull and in front of it`, r.zmin < -.1 && r.zmax > .1 && r.hid > 0, JSON.stringify(r));
  check(`${mode}: what's in front is drawn over it, and their lights placed`, r.front > 0 && r.lights >= 3, `${r.front} in front, ${r.lights} lights`);
  check(`${mode}: they skim its surface, never through it nor past the camera`, r.minR > 1.1 && r.zmax < 2, `${r.minR.toFixed(2)} of its radius at the nearest, ${r.zmax.toFixed(2)} at the front`);
  check(`${mode}: with the switch off they keep to the flat picture`, r.off.on === 0 && !r.off.p3 && r.off.n === 0, JSON.stringify(r.off));
  const errors = await page.errors(); check(`${mode}: no page errors`, !errors.length, errors.join(' '));
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
