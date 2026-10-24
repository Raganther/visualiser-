// The mix playground (studio/mix/): a round 4 song mixed the traditional way on the parts host, every sound native.
// Offline: the host's native instruments, the desk's EQ, the song's mix (every part heard, nothing past full scale, the
// kick's sidechain turning the bass and the chords down, the buses' compressors working, straight at the mix's
// loudness); then the page used. Usage: node tests/mixlab.mjs
import { serve, launch } from './lib.mjs';
import { Host } from '../studio/lib/parts/host.js';
import { make } from '../studio/lib/parts/procs.js';
import { songOf } from '../studio/mix/song.mjs';
import { mixOf, eventsOf } from '../studio/mix/mix.js';
import { execFileSync } from 'node:child_process';

let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const sr = 44100, db = x => 20*Math.log10(Math.max(1e-9, x));
// a host run for secs: the output's peak and loudness, each strip's input energy, its compressors' deepest reduction
function run(H, secs, each){ const n = Math.ceil(secs*sr), L = new Float64Array(128), R = new Float64Array(128), o = {pk: 0, e: 0, n: 0, inp: {}, gr: {}, nan: false};
  for (let a = 0; a < n; a += 128) { L.fill(0); R.fill(0); H.process(L, R, 128, a/sr);
    for (let j = 0; j < 128; j++) { if (!Number.isFinite(L[j])) o.nan = true; o.pk = Math.max(o.pk, Math.abs(L[j]), Math.abs(R[j])); o.e += L[j]*L[j] + R[j]*R[j]; } o.n += 256;
    for (const s of H.st) { let e = 0; for (let j = 0; j < 128; j++) e += s.inp[0][j]**2; o.inp[s.id] = (o.inp[s.id] || 0) + e; }
    const m = H.meters(); for (const [id, s] of Object.entries(m)) for (let [k, v] of Object.entries(s.gr)) { k = k.replace(id + '-', ''); o.gr[id + '.' + k] = Math.max(o.gr[id + '.' + k] || 0, v); } each?.(a); }
  o.rms = 10*Math.log10(o.e/o.n); return o; }

/* ---------- the host's native instruments ---------- */
{ const H = new Host(sr); H.build({sources: {b: {kind: 'native', slots: {'': {name: 'fmpluck', params: {}}}}, h: {kind: 'native', slots: {chh: {name: 'hihat', params: {open: 0}, chokes: 'hat'}, ohh: {name: 'hihat', params: {open: .8}, choke: 'hat', chokes: 'hat'}}}},
    strips: [{id: 'b', input: {src: 'b'}, chain: []}, {id: 'h', input: {src: 'h'}, chain: []}]});
  H.msg({type: 'on', src: 'b', id: 1, n: 45, vel: .8, len: .3, t: 0}); H.msg({type: 'off', src: 'b', id: 1, t: .3});
  const a = run(H, .4), b = run(H, 3); check('a native instrument plays a note on the host and falls silent after it', a.pk > .05 && b.e/b.n < 1e-9, `${db(a.pk).toFixed(1)} dB, then ${(10*Math.log10(b.e/b.n + 1e-20)).toFixed(0)} dB`);
  H.msg({type: 'on', src: 'h', slot: 'ohh', id: 2, n: 60, vel: .8}); run(H, .1); H.msg({type: 'on', src: 'h', slot: 'chh', id: 3, n: 60, vel: .8}); run(H, .15);
  check('a closed hat chokes the open one', H.src.h.obj.v.filter(v => !v.done).length <= 1 && !H.src.h.obj.v.some(v => v.id === 2 && !v.kill), H.src.h.obj.v.map(v => v.id + ':' + (v.kill || 0)).join(' ')); }

/* ---------- the desk's EQ ---------- */
{ const at = f => { const e = make('eq', sr, {lo: 6, mid: -6, hi: 3}), n = sr, L = new Float64Array(n), R = new Float64Array(n); for (let i = 0; i < n; i++) L[i] = R[i] = Math.sin(2*Math.PI*f*i/sr);
    e.process(L, R, 0, n); let m = 0; for (let i = n/2; i < n; i++) m = Math.max(m, Math.abs(L[i])); return db(m); };
  const g = [40, 800, 14000, 3000].map(at);
  check('the EQ: its low shelf lifts the lows, its bell cuts the middle, its high shelf lifts the top, little between', g[0] > 5 && Math.abs(g[1] + 6) < .2 && g[2] > 2.5 && Math.abs(g[3]) < 1, g.map(x => x.toFixed(1)).join(', ') + ' dB'); }

/* ---------- the song, mixed ---------- */
const {P, SND} = songOf('r4-3'), D = mixOf(P, SND);
const host = (desc, from, bars) => { const H = new Host(sr); H.build(JSON.parse(JSON.stringify(desc))); for (const e of eventsOf(P, SND, from)) if (e.t < bars*2) H.msg({...e.m, t: e.t}); return H; };
{ const H = host(D, 32, 8), o = run(H, 16);
  const parts = ['kick', 'hats', 'perc', 'chords', 'lead2'];
  check('the Surface section: every part playing in it is heard', parts.every(k => o.inp[k] > 1e-3), parts.map(k => `${k} ${(10*Math.log10(o.inp[k] + 1e-12)).toFixed(0)}`).join(', '));
  check('the mix stays within full scale and is a healthy level', !o.nan && o.pk <= 1 && o.rms > -24 && o.rms < -8, `peak ${db(o.pk).toFixed(1)} dB, loudness ${o.rms.toFixed(1)} dB`);
  check('the kick\'s sidechain turns the chords and the room down; the buses\' compressors work', o.gr['chords.sidechain'] > 3 && o.gr['room.sidechain'] > 2 && o.gr['drums.glue'] > 1 && o.gr['music.glue'] > .5 && o.gr['bus.glue'] > 1,
    ['chords.sidechain', 'room.sidechain', 'drums.glue', 'music.glue', 'bus.glue'].map(k => `${k} ${(o.gr[k] || 0).toFixed(1)}`).join(', '));
  // straight: every channel and bus bypassed at the loudness its processors gave it
  const B = JSON.parse(JSON.stringify(D)); for (const s of B.strips) if (s.id !== 'master' && !s.ret) { s.bypass = true; s.match = true; }
  const st = run(host(B, 32, 8), 16);
  check('straight (every processor out, matched) comes out near the mix\'s loudness', Math.abs(st.rms - o.rms) < 2 && st.pk <= 1, `${st.rms.toFixed(1)} against ${o.rms.toFixed(1)} dB`); }
{ // the bass dips on each kick: its level just after a kick against just before the next
  const H = host(D, 16, 2); let tr = []; const sc = H.by.bass.chain.find('bass-sidechain'); sc.trace = tr; run(H, 4);
  const beat = .5, at = t => db(tr[Math.round(t*sr)] ?? 1), kicks = P.tracks[0].clips.find(c => c.start === 16).notes.filter(n => n.s < 32).map(n => n.s*.125);
  const k = kicks.find(t => t > 1), dip = at(k + .03), back = at(k + beat - .02);
  check('in Current, the bass ducks under each kick and comes back before the next (the sidechain compressor)', dip < -4 && back > dip + 3, `${dip.toFixed(1)} dB just after a kick, ${back.toFixed(1)} before the next`); }
{ const o = run(host(D, 0, P.bars), P.bars*2 + 2);
  const all = ['kick', 'hats', 'perc', 'bass', 'chords', 'lead', 'lead2'];
  check('the whole song: every part heard, nothing past full scale', all.every(k => o.inp[k] > 1e-3) && o.pk <= 1 && !o.nan, `peak ${db(o.pk).toFixed(1)} dB, loudness ${o.rms.toFixed(1)} dB`); }

/* ---------- the playground ---------- */
execFileSync(process.execPath, [new URL('../studio/mix/build.mjs', import.meta.url).pathname]);
const {srv, url} = await serve(); const browser = await launch('2d');
{ const q = await browser.newPage({viewport: {width: 1280, height: 900}}); q.on('pageerror', e => { failed = true; console.log('FAIL page error:', e.message); });
  await q.goto(url + 'studio/listen/mix-lab.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(400);
  check('the desk shows every channel, both buses, the returns and the master bus', await q.evaluate(() => document.querySelectorAll('.strip').length) === 12);
  await q.locator('.mark').nth(3).click(); await q.waitForFunction(() => window.__mix.A, null, {timeout: 6000}); await q.waitForTimeout(3000);
  const m = await q.evaluate(() => { const M = window.__mix.S.m; return {kick: M.kick?.pk, chords: M.chords?.pk, master: M.master?.pk, sc: M.chords?.gr?.['chords-sidechain'], pos: document.querySelector('#pos').textContent}; });
  check('playing Surface: the kick and chords heard, the chords\' sidechain working, the master within full scale', m.kick > .01 && m.chords > .001 && m.sc > 1 && m.master > .05 && m.master <= 1, JSON.stringify(m));
  await q.click('#hear button:nth-child(2)'); await q.waitForTimeout(1500);
  const st = await q.evaluate(() => ({on: window.__mix.S.straight, master: window.__mix.S.m.master?.pk, words: document.querySelector('#hearing').textContent}));
  check('Straight takes the processors out and is still heard', st.on && st.master > .05 && st.master <= 1 && /straight/.test(st.words), JSON.stringify(st));
  await q.click('#hear button:nth-child(1)'); await q.click('#play');
  // a fader moved and a processor switched off on the bass, kept across a reload and named in the notes
  await q.evaluate(() => { const r = document.querySelector('[data-strip="bass"] .fdr input'); r.value = -12; r.dispatchEvent(new Event('input')); });
  await q.locator('[data-strip="bass"] .sname').click(); await q.locator('#chain .proc[data-key="saturate"] .pname').click(); await q.reload(); await q.waitForTimeout(400);
  const kept = await q.evaluate(() => ({level: window.__mix.by('bass').level, sat: window.__mix.by('bass').chain.find(c => c.key === 'saturate').on, ch: window.__mix.changes()}));
  check('a fader and a processor switched off are kept across a reload, and named in the notes for Claude', kept.level === -12 && kept.sat === false && kept.ch.some(x => /Bass/.test(x) && /Saturation off/.test(x)), JSON.stringify(kept.ch));
  await q.click('#reset'); check('Back to Claude\'s mix undoes it', (await q.evaluate(() => window.__mix.changes())).length === 0);
  await q.close(); }
{ const ph = await browser.newPage({viewport: {width: 390, height: 800}}); await ph.goto(url + 'studio/listen/mix-lab.html'); await ph.waitForTimeout(500);
  check('on a phone the page fits its width (the desk scrolls inside itself)', await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await ph.close(); }
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
