// Looking ahead test (audio/foresee.js and Journey's run-up in journey/director.js): a synthetic track with a breakdown
// is read before it plays, and the drop found where the kick comes back; then, on the texture groove (its breakdown ends
// at 80 s) with that drop known, Journey builds towards it (the run-up, the tension, the held breath in the last beat),
// saves any new section for it, and drops on the moment, not when the live listening notices. Reads the modules.
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('foresee: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve(), browser = await launch('2d');
const page = await openPage(browser, url, {groove: 'texture', noDraw: true});
// 1. the scan: 60 s at 120 BPM, kick and bass, a breakdown (hats only) from 30 s, the kick and bass back at 44 s
const scan = await page.evaluate(async () => {
  const {findDrops, foresee} = await import('/src/audio/foresee.js');
  const sr = 22050, n = sr*60, buf = new AudioBuffer({length: n, sampleRate: sr, numberOfChannels: 1}), x = buf.getChannelData(0);
  let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647 - .5;
  for (let i = 0; i < n; i++) {
    const t = i/sr, b = t % .5, low = t < 30 || t >= 44;
    let v = 0;
    if (low) { v += Math.sin(2*Math.PI*(45 + 90*Math.exp(-b*30))*b)*Math.exp(-b*8)*.8;   // the kick
      const o = (t + .25) % .5; v += Math.sin(2*Math.PI*55*t)*Math.exp(-o*6)*.35; }       // an off-beat bass
    const h = t % .25; v += rnd()*Math.exp(-h*60)*.15;                                     // hats all through
    x[i] = v;
  }
  const F = await foresee(buf);
  return {drops: F.drops, brks: F.brks};
});
// 2. Journey on the texture groove, told of a drop at 80 s (its breakdown from 66 s): the look-ahead's clock is the groove's
const run = await page.evaluate(async () => {
  const {F} = await import('/src/audio/foresee.js'), {J} = await import('/src/journey/core.js'), {L} = await import('/src/audio/listen.js');
  window.__ft = 0; F.ready = true; F.drops = [{t: 80, brk: 66, depth: 20}]; F.at = () => window.__ft;
  const out = [];
  for (let f = 1; f <= 90*60; f++) {
    window.__ft = f/60; __step(1);
    if (f >= 60*60) out.push({t: f/60, a: J.anticip, hush: J.hush, T: J.tension, drop: J.lastDrop, sec: J.type && J.type.label, secAge: J.secAge, live: L.drops, fd: J.foreDrops || 0, hold: J.foreHold});
  }
  return out;
});
const errors = await page.errors();
const at = t => run.reduce((m, s) => Math.abs(s.t - t) < Math.abs(m.t - t) ? s : m);
const firstDrop = run.find(s => s.fd > 0), liveAt = run.find(s => s.live > 0);
const secStarts = run.filter((s, i) => i && s.secAge < run[i - 1].secAge).map(s => +s.t.toFixed(2));
const fx = v => typeof v === 'number' ? +v.toFixed(3) : v;
const checks = [
  ['the scan finds the one drop, where the kick comes back at 44 s', [scan.drops.length, scan.drops[0] && scan.drops[0].t], ([n, t]) => n === 1 && Math.abs(t - 44) < .03],
  ['...and its breakdown from about 30 s', [scan.drops[0] && scan.drops[0].brk], ([b]) => b > 29 && b < 34],
  ['no run-up long before the drop, then one rising to it', [at(66).a, at(75).a, at(79.9).a], ([a, b, c]) => a === 0 && b > .1 && c > .95],
  ['the tension lifted by the drop coming', [at(79.5).T], ([t]) => t > .75],
  ['the breath held only in the last beat', [at(78).hush, at(79.9).hush], ([a, b]) => a === 0 && b > .5],
  ['Journey drops on the moment (80 s), before the live listening hears it', [firstDrop && firstDrop.t, liveAt && liveAt.t], ([a, b]) => a !== undefined && a >= 80 && a < 80.05 && (b === undefined || b > a)],
  ['...and only once', [new Set(run.filter(s => s.t > 80).map(s => s.drop)).size], ([n]) => n === 1],
  ['no new section in the last bars before the drop', [secStarts.filter(t => t > 66 && t < 80)], ([s]) => s.length === 0],
  ['no page errors', [errors.length], ([n]) => n === 0],
];
let failed = false;
for (const [name, v, ok] of checks) { const pass = ok(v); failed ||= !pass; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(v.map(fx))}`); }
if (errors.length) console.log(errors);
console.log('sections started at', secStarts.join(', '));
await browser.close(); srv.close();
if (failed) process.exitCode = 1;
