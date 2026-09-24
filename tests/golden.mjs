// Golden test: run the page deterministically on the synthetic groove and compare Journey's decisions and
// what's on screen against a saved recording. Any refactor must reproduce it; an intended change re-records it.
//   node tests/golden.mjs            compare both renderers
//   node tests/golden.mjs --update   re-record
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, openPage, THUMB } from './lib.mjs';

const RUNS = {'2d': {seconds: 180, thumbEvery: 10}, gl: {seconds: 45, thumbEvery: 5}};
const update = process.argv.includes('--update');
const only = process.argv.find(a => a in RUNS);

// numbers compared with a little slack, so harmless reordering of float maths doesn't fail the test
function diff(a, b, where, out){
  if (out.length > 20) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 1e-6*Math.max(1, Math.abs(a), Math.abs(b))) out.push(`${where}: ${b} -> ${a}`);
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${where}.${k}`, out);
  } else if (a !== b) out.push(`${where}: ${JSON.stringify(b)} -> ${JSON.stringify(a)}`);
}

async function record(mode, url){
  const {seconds, thumbEvery} = RUNS[mode];
  const browser = await launch(mode), page = await openPage(browser, url);
  const timeline = [], thumbs = [];
  for (let s = 1; s <= seconds; s++) {
    const snap = await page.evaluate(`(() => { __step(60); return {t: ${s}, j: __jdbg(), sec: document.querySelector('#jSection').textContent, thumb: ${s % thumbEvery === 0} ? ${THUMB} : null}; })()`);
    if (snap.thumb) thumbs.push({t: s, px: snap.thumb});
    delete snap.thumb; timeline.push(snap);
  }
  const errors = await page.errors();
  await browser.close();
  return {timeline, thumbs, errors};
}

const {srv, url} = await serve();
let failed = false;
for (const mode of only ? [only] : Object.keys(RUNS)) {
  const t0 = Date.now(), got = await record(mode, url), file = path.join(ROOT, `tests/golden/${mode}.json`);
  if (got.errors.length) { console.log(`${mode}: page errors`, got.errors); failed = true; }
  if (update || !fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(got));
    console.log(`${mode}: recorded ${got.timeline.length} s, ${got.thumbs.length} frames (${((Date.now() - t0)/1000).toFixed(0)} s)`);
    continue;
  }
  const want = JSON.parse(fs.readFileSync(file)), problems = [];
  diff(got.timeline, want.timeline, 'timeline', problems);
  got.thumbs.forEach((th, i) => {
    const w = want.thumbs[i], d = w ? th.px.reduce((a, v, k) => a + Math.abs(v - w.px[k]), 0)/th.px.length : 999;
    if (d > 1.5) problems.push(`frame at ${th.t} s differs by ${d.toFixed(2)} grey levels on average`);
  });
  if (problems.length) { failed = true; console.log(`${mode}: DIFFERS from golden\n  ` + problems.slice(0, 20).join('\n  ')); }
  else console.log(`${mode}: matches golden (${got.timeline.length} s, ${got.thumbs.length} frames, ${((Date.now() - t0)/1000).toFixed(0)} s)`);
}
srv.close();
process.exit(failed ? 1 : 0);
