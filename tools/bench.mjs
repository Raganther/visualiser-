// Speed, and proof the picture didn't change: fixed scenes timed frame by frame in headless Chromium (software WebGL by
// default, so the graphics chip's work shows up as time), each with a 32x18 thumbnail taken at the same moment every run
// (a seeded, fake clock). Save one run, change the code, run again with --compare: it prints how much faster each scene is
// and how far its thumbnail moved (0: the same picture). --root runs another checkout (a worktree of main) the same way.
// Usage: node tools/bench.mjs [--scenes land,space] [--mode gl|2d] [--size 320x180] [--frames 6] [--rounds 3]
//                             [--root ../main-wt] [--out a.json] [--compare a.json]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve(opt('root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { serve, launch, openPage, THUMB } = await import(path.join(root, 'tests/lib.mjs'));
const mode = opt('mode', 'gl'), [width, height] = opt('size', '320x180').split('x').map(Number);
const frames = +opt('frames', 6), rounds = +opt('rounds', 3);
const LAB = '?lab=cosmos&tune=scene.centreChance=0&tune=render.auto.on=0', HAND = '?tune=render.auto.on=0';
// each scene: its query, and what to do before timing (in the page; cz is the cosmos, preset(name) plays a preset by hand)
const SCENES = {
  journey: {q: HAND, go: '__step(600)'},                                  // Journey's own first sections on the groove
  kaleido: {q: HAND, go: `preset('Kaleido'); __step(240)`},
  city: {q: HAND, go: `preset('City comets'); __step(240)`},
  skull: {q: HAND, go: `preset('Skull in the city'); __step(240)`},
  aurora: {q: HAND, go: `preset('Northern lights'); __step(240)`},
  space: {q: LAB, go: `cz.shot('reveal'); __step(240)`},
  planet: {q: LAB, go: `cz.shot('orbit'); __step(480)`},
  belt: {q: LAB, go: `cz.visit('belt'); __step(240); cz.shot('belt'); __step(480)`},
  land: {q: LAB, go: `cz.land(); let k = 0; while (cz.info().surf < 1 && k++ < 200) __step(10, 50); __step(40, 50)`},
};
const pick = opt('scenes', Object.keys(SCENES).join(',')).split(',');
const {srv, url} = await serve(), b = await launch(mode), res = {};
for (const name of pick) {
  const sc = SCENES[name]; if (!sc) { console.log('no scene ' + name); continue; }
  const page = await openPage(b, url, {width, height, query: sc.q});
  if (sc.q === LAB) await page.waitForFunction(async () => (await import('/src/journey/core.js')).J.worldHold === 'cosmos', null, {timeout: 60000, polling: 100});
  await page.evaluate(async go => {
    const {byKey} = await import('/src/visuals/registry.js'), {presets} = await import('/src/presets.js');
    const {setPreset} = await import('/src/ui/presets.js'), {setJourney} = await import('/src/ui/controls.js');
    window.cz = byKey.cosmos; if (location.search.includes('lab=cosmos')) { __step(120); cz.hold(9999); }
    window.preset = n => { setJourney(false); setPreset(presets.find(p => p.name === n)); };
    // wait for the frame to be drawn: reading a pixel back waits for the graphics work queued before it
    const cv = document.querySelector('canvas'), g = cv.getContext('webgl2') || cv.getContext('webgl'), px = new Uint8Array(4);
    window.__sync = g ? () => g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px) : () => cv.getContext('2d').getImageData(0, 0, 1, 1);
    await (0, eval)(`(async () => { ${go} })()`);
  }, sc.go);
  await page.evaluate(() => __sync());   // (the setup's frames are queued: drain them before timing)
  const ms = [];
  for (let r = 0; r < rounds; r++) {
    await page.evaluate(() => { __step(1, 50); __sync(); });
    const t = Date.now();
    for (let i = 0; i < frames; i++) await page.evaluate(() => { __step(1, 50); __sync(); });
    ms.push((Date.now() - t)/frames);
  }
  ms.sort((a, b) => a - b);
  res[name] = {ms: +ms[Math.floor(ms.length/2)].toFixed(1), thumb: await page.evaluate(THUMB), errors: await page.errors()};
  console.log(`${name.padEnd(8)} ${String(res[name].ms).padStart(7)} ms a frame${res[name].errors.length ? '  errors ' + JSON.stringify(res[name].errors) : ''}`);
  await page.close();
}
await b.close(); srv.close();
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(res));
if (opt('compare')) {
  const was = JSON.parse(fs.readFileSync(opt('compare'), 'utf8'));
  console.log('\nscene     before    after   speed   picture (largest tile change, of 255)');
  for (const k in res) if (was[k]) {
    const d = Math.max(...res[k].thumb.map((v, i) => Math.abs(v - was[k].thumb[i])));
    console.log(`${k.padEnd(8)} ${String(was[k].ms).padStart(7)} ${String(res[k].ms).padStart(8)}  ${(was[k].ms/res[k].ms).toFixed(2)}×   ${d}`);
  }
}
