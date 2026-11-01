// The Studio's settings with your account and Export / Import (studio/studio/settings.js), against a stand-in database:
// mirrored into it, an Export file holding everything, a new browser given them back, and Import on an empty one
import { serve, launch } from './lib.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
let failed = false;
const {srv, url} = await serve(); const browser = await launch('2d');
const FAKE = (seed) => { const S = seed || {}; window.__DB = S;
  const col = c => ({doc: id => ({set: async d => { (S[c] ??= {})[id] = JSON.parse(JSON.stringify(d)); }, get: async () => ({exists: !!S[c]?.[id], data: () => S[c][id]})}),
    get: async () => ({docs: Object.entries(S[c] || {}).map(([id, d]) => ({id, data: () => d}))})});
  window.claude = {use: async n => n === 'db' ? {collection: col} : null}; };
const ok = (n, c, d = '') => { if (!c) failed = true; console.log(c ? 'ok  ' : 'FAIL', n, d); };
// 1. a browser with settings: mirrored into the database; Export downloads everything
let ctx = await browser.newContext({acceptDownloads: true}), p = await ctx.newPage(); p.on('pageerror', e => { failed = true; console.log('FAIL page error', e.message); });
await p.addInitScript(FAKE, {likes: {'sound:x': {rating: 1}}});
await p.goto(url + 'studio/listen/studio.html'); await p.evaluate(() => { localStorage.setItem('studio.jam.pack', 'pack-3'); localStorage.setItem('mixlab.x', '1'); localStorage.setItem('studio.daw.v1.r4-1', '{"big":1}'); localStorage.setItem('other.thing', 'no'); });
await p.waitForTimeout(17000);
const st = await p.evaluate(() => window.__DB.settings?.local); const L = st && JSON.parse(st.json);
ok('settings mirrored into the database (not your song versions, not other pages\')', L && L['studio.jam.pack'] === 'pack-3' && L['mixlab.x'] === '1' && !L['studio.daw.v1.r4-1'] && !L['other.thing'], JSON.stringify(L)?.slice(0, 200));
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exp')]); const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')), 'bk.json'); await dl.saveAs(f); const X = JSON.parse(fs.readFileSync(f, 'utf8'));
ok('Export: one file with the database and the settings, song versions included', X.studio && X.db.likes['sound:x'] && X.db.settings && X.local['studio.daw.v1.r4-1'] && X.local['studio.jam.pack'], dl.suggestedFilename());
await ctx.close();
// 2. a new browser, the database restored: its settings come back
ctx = await browser.newContext(); p = await ctx.newPage(); p.on('pageerror', e => { failed = true; console.log('FAIL page error', e.message); });
await p.addInitScript(FAKE, {settings: {local: st}});
await p.goto(url + 'studio/listen/studio.html'); await p.waitForTimeout(4000);
ok('a new browser gets the settings back from the database', await p.evaluate(() => localStorage.getItem('studio.jam.pack') === 'pack-3' && localStorage.getItem('mixlab.x') === '1'));
await ctx.close();
// 3. another account (an empty database): Import the file
ctx = await browser.newContext(); p = await ctx.newPage(); p.on('pageerror', e => { failed = true; console.log('FAIL page error', e.message); });
await p.addInitScript(FAKE, {}); await p.goto(url + 'studio/listen/studio.html'); await p.waitForTimeout(2500);
await p.setInputFiles('#impF', f); await p.waitForTimeout(2500);
const im = await p.evaluate(() => ({like: !!window.__DB.likes?.['sound:x'], song: localStorage.getItem('studio.daw.v1.r4-1'), flash: document.getElementById('flash').textContent}));
ok('Import on another account: the documents into its database, the settings and song versions into the browser', im.like && im.song === '{"big":1}', JSON.stringify(im));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
