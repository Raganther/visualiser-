// Listening test: on a synthetic minimal-techno track whose parts differ in texture, not loudness (tests/fixtures/texture.js),
// the listening (audio/listen.js) must hear the hi-hats come in, the breakdown, the drop when the bass returns, the noisy
// wash, the chord moving, the stereo widening and the loop running on; and Journey must start a new section when the hats
// come in, though the loudness hardly changes. Reads the modules, so it runs on index.html (not the single-file bundle).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('listen: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve(), browser = await launch('2d');
const page = await openPage(browser, url, {groove: 'texture', noDraw: true});
const secs = await page.evaluate(async () => {
  const {L} = await import('/src/audio/listen.js'), {J} = await import('/src/journey/core.js');
  const out = [];
  for (let f = 1; f <= 140*60; f++) {
    __step(1);
    if (f % 30 === 0) out.push({t: f/60, part: __part, hat: L.hat, noise: L.noise, bass: L.bass, brk: L.brk, drops: L.drops, harm: L.harm,
      nov: L.nov, loop: L.loop, width: L.width, lvl: J.fS.lvl, sec: J.type && J.type.label, lastDrop: J.lastDrop});
  }
  return out;
});
const errors = await page.errors();
const at = (a, b) => secs.filter(s => s.t >= a && s.t < b), mean = (a, b, k) => { const x = at(a, b); return x.reduce((s, v) => s + v[k], 0)/x.length; };
const any = (a, b, f) => at(a, b).some(f), all = (a, b, f) => at(a, b).every(f);
const fx = v => typeof v === 'number' ? v.toFixed(2) : v;
const checks = [
  ['hi-hats heard only once they come in (before, after)', [mean(10, 30, 'hat'), mean(40, 62, 'hat')], ([a, b]) => a < .3 && b > .6],
  ['the breakdown heard (in it, before and after it)', [all(68, 79, s => s.brk), any(20, 62, s => s.brk) || any(84, 140, s => s.brk)], ([a, b]) => a && !b],
  ['one drop as the bass comes back at 80 s', [at(0, 140).at(-1).drops, at(0, 79).at(-1).drops], ([a, b]) => a === 1 && b === 0],
  ['Journey drops then too', [secs.find(s => s.lastDrop > 0 && s.t > 79)?.t], ([t]) => t !== undefined && t < 85],
  ['the noisy wash heard (before, with it)', [mean(40, 62, 'noise'), mean(86, 110, 'noise')], ([a, b]) => b > a + .15],
  ['the chord moving heard at 96 s (the most change, then)', [secs.reduce((m, s) => s.t > 20 && s.harm > m.harm ? s : m, {harm: 0}).t], ([t]) => t >= 95 && t < 102],
  ['stereo widening heard', [mean(80, 98, 'width'), mean(110, 140, 'width')], ([a, b]) => a < .1 && b > .25],
  ['the loop running on counted', [Math.max(...at(112, 140).map(s => s.loop))], ([n]) => n >= 6],
  ['loudness nearly the same when the hats come in', [mean(20, 31, 'lvl'), mean(44, 62, 'lvl')], ([a, b]) => Math.abs(a - b) < .2],
  ['...and still a new section there', [new Set(at(20, 31).map(s => s.sec)).size, at(20, 31).at(-1).sec, at(40, 62).map(s => s.sec)], ([, a, b]) => b.some(x => x !== a)],
  ['no page errors', [errors.length], ([n]) => n === 0],
];
let failed = false;
for (const [name, v, ok] of checks) { const pass = ok(v); failed ||= !pass; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(v.map(fx))}`); }
if (errors.length) console.log(errors);
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
