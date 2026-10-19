// Bench test (?lab=bench, src/lab/bench.js; the light rig in scene/space.js; audio/songs.js): the bench builds its panel
// with nothing on screen but the object and its own light show on the beat off; picking an object solos it; the rig leads (the object's own lamps set aside) and
// its presets move the lights; dragging on the sky map moves the chosen light; a light from the left lights the skull's
// left in both renderers; each song loads into the groovebox (its order, its synth's pumping chain) and plays with no
// errors; on a phone the panel fits under the picture.
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('bench: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
// the lab's panel is built a couple of frames after the lab loads
const built = page => page.waitForFunction(() => { __step(2); return !!document.querySelector('#bench button[data-id="o:skull"]'); }, null, {timeout: 30000, polling: 200});

for (const mode of (process.env.BENCH_MODES || '2d,gl').split(',')) {
  const browser = await launch(mode, ['--autoplay-policy=no-user-gesture-required']), page = await openPage(browser, url, {width: 390, height: 700, query: '?lab=bench'});
  await built(page);
  const r = await page.evaluate(async () => {
    const {S} = await import('/src/state.js'), {SPACE} = await import('/src/scene/space.js'), {SUBJ} = await import('/src/scene/subject.js');
    const {OBJECT_VISUALS, LAYER_VISUALS, WORLD_VISUALS} = await import('/src/visuals/registry.js'), {TUNE} = await import('/src/tuning.js');
    const click = id => document.querySelector(`#bench button[data-id="${id}"]`).click();
    click('o:skull'); TUNE.dance.amount = 0; for (let i = 0; i < 40; i++) __step(3);
    const others = [...OBJECT_VISUALS, ...LAYER_VISUALS, ...WORLD_VISUALS].filter(v => v.key !== 'skull' && (S.active[v.key] || 0) > .01).map(v => v.key);
    const rig = {on: SPACE.rig.on, own: SPACE.own, n: SPACE.rig.n, subj: SUBJ.key};
    click('pre:Back'); const back = SPACE.rig.lights[0].az;
    // a drag on the sky map: the key light to the camera's side (the bottom of the map)
    click('sel:0'); const sky = document.querySelector('#bench canvas.sky'), b = sky.getBoundingClientRect(), opt = {bubbles: true, pointerId: 1, clientX: b.left + b.width/2, clientY: b.top + b.height*.85};
    sky.dispatchEvent(new PointerEvent('pointerdown', opt)); sky.dispatchEvent(new PointerEvent('pointerup', opt));
    const dragged = SPACE.rig.lights[0].az;
    // the key alone from the left against from the right: the skull's left reddens more
    const c = document.querySelector('canvas:not(.sky)'), g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d');
    const red = () => { x.clearRect(0, 0, g.width, g.height); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data, H = g.height, W = g.width;
      const cx = W/2 + SUBJ.x*H, cy = H/2 - SUBJ.y*H, R = SUBJ.r*H; let L = 0, Rt = 0;
      for (let j = Math.max(0, cy - R | 0); j < Math.min(H, cy + R); j++) for (let i = Math.max(0, cx - R | 0); i < Math.min(W, cx + R); i++) {
        if (Math.hypot(i - cx, j - cy) > R) continue; const q = (j*W + i)*4, e = d[q] - (d[q + 1] + d[q + 2])/2; if (i < cx) L += e; else Rt += e; }
      return L - Rt; };
    const L0 = SPACE.rig.lights; L0[1].on = L0[2].on = 0; L0[0].c = [1, .05, .05]; L0[0].k = 1.6; L0[0].el = .1;
    L0[0].az = -1.4; __step(2); const left = red(); L0[0].az = 1.4; __step(2); const right = red();
    L0[1].on = L0[2].on = 1;
    // the songs
    const {SONGS} = await import('/src/audio/songs.js'), g2 = await import('/src/audio/groove.js'), {STRIPS} = await import('/src/audio/engine/mixer.js');
    const songs = [];
    for (const s of SONGS) { click('song:' + s.name); if (!g2.GB.playing) click('play'); await new Promise(r => setTimeout(r, 900)); __step(4);
      const ins = (STRIPS.get('synth') || {ins: []}).ins.map(i => i.k);
      songs.push({name: s.name, playing: g2.GB.playing, order: g2.GB.song.length === s.order.length, bpm: g2.GB.bpm === s.bpm, pump: ins[0] === 'pump', ins: ins.join(' ')}); }
    click('play');
    const panel = document.querySelector('#bench').getBoundingClientRect();
    return {others, rig, back, dragged, side: left - right, songs, panelH: panel.height, djH: S.djH, vh: innerHeight, show: TUNE.show.on};
  });
  check(`${mode}: the skull alone on the bench`, !r.others.length, r.others.join(' '));
  check(`${mode}: the object's own light show on the beat is off on the bench`, r.show === 0, String(r.show));
  check(`${mode}: the rig leads, the object's own lamps set aside`, r.rig.on === 1 && r.rig.own === 0 && r.rig.n === 3 && r.rig.subj === 'skull', JSON.stringify(r.rig));
  check(`${mode}: a preset moves the lights, a drag on the sky map moves the chosen one`, Math.abs(r.back - 3) < .01 && Math.abs(Math.cos(r.dragged) - 1) < .2, `${r.back.toFixed(2)}, ${r.dragged.toFixed(2)}`);
  check(`${mode}: the key from the left lights the skull's left more than from the right`, r.side > 3000, String(Math.round(r.side)));
  for (const s of r.songs) check(`${mode}: ${s.name} loads and plays, the synth pumping on the kick`, s.playing && s.order && s.bpm && s.pump, JSON.stringify(s));
  check(`${mode}: the panel fits under the picture on a phone`, r.panelH <= r.vh*.57 && r.djH > 100, `${Math.round(r.panelH)} of ${r.vh}, picture ${r.vh - r.djH}`);
  const errors = await page.errors(); check(`${mode}: no page errors`, !errors.length, errors.join(' '));
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
