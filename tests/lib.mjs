// Shared helpers for the browser tests: a static server, Playwright launch, and a deterministic page
// (seeded Math.random, a fake 60 fps clock stepped by the test, and optionally the synthetic groove).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRY = process.env.AFTERGLOW_ENTRY || 'afterglow.html';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const TYPES = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json'};
export function serve(){
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res({srv, url: `http://127.0.0.1:${srv.address().port}/`}));
  });
}

export const MODES = {
  gl: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  '2d': ['--disable-gpu', '--disable-webgl'],
};
export const launch = mode => chromium.launch({args: MODES[mode]});

const DETERMINISM = seed => `
(() => {
  let a = ${seed} >>> 0;                              // mulberry32
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0)/4294967296; };
  let now = 0; const q = [];
  performance.now = () => now;
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
  window.__step = n => { for (let i = 0; i < n; i++) { now += 1000/60; q.splice(0).forEach(cb => cb(now)); } };
  window.__now = () => now;
})();`;

// open the page with a fixed seed and clock; groove: feed tests/fixtures/groove.js instead of the built-in beat
export async function openPage(browser, url, {seed = 1, groove = true, width = 320, height = 180} = {}){
  const page = await browser.newPage({viewport: {width, height}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(DETERMINISM(seed));
  if (groove) await page.addInitScript({path: path.join(ROOT, 'tests/fixtures/groove.js')});
  await page.goto(url + ENTRY);
  page.errors = async () => errors.concat(await page.evaluate(() => { const e = document.querySelector('#err'); return e && e.textContent ? [e.textContent] : []; }));
  return page;
}

// a 32x18 grey thumbnail of whatever the canvas shows right now (read in the same task as the last frame)
export const THUMB = `(() => {
  const c = document.querySelector('canvas'); const w = c.width, h = c.height; let px;
  const g = c.getContext('webgl2') || c.getContext('webgl');
  if (g) { px = new Uint8Array(w*h*4); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); }
  else px = c.getContext('2d').getImageData(0, 0, w, h).data;
  const out = [];
  for (let ty = 0; ty < 18; ty++) for (let tx = 0; tx < 32; tx++) {
    let s = 0, n = 0;
    for (let y = Math.floor(ty*h/18); y < Math.floor((ty + 1)*h/18); y += 2) for (let x = Math.floor(tx*w/32); x < Math.floor((tx + 1)*w/32); x += 2) {
      const i = ((g ? h - 1 - y : y)*w + x)*4; s += px[i] + px[i + 1] + px[i + 2]; n += 3; }
    out.push(n ? Math.round(s/n) : 0);
  }
  return out;
})()`;
