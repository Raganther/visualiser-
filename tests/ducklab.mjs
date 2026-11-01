// Ducking, two ways (studio/lib/parts/procs.js: the ducker that reads the score, `duck`, and the classic sidechain
// compressor, `sidechain`), measured offline in the host; then the ducking playground (studio/duck/, built into
// studio/listen/duck-lab.html) used in the page. Usage: node tests/ducklab.mjs
import { serve, launch } from './lib.mjs';
import { Host, offline } from '../studio/lib/parts/host.js';
import { make } from '../studio/lib/parts/procs.js';
import { DEF } from '../studio/lib/native/asynth.js';
import { execFileSync } from 'node:child_process';

let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const sr = 48000, db = x => 20*Math.log10(x);
const BASS = {...DEF, w1: 0, l2: 0, cut: 400, res: .2, fenv: 0, as: 1, mode: 1, chorus: 0, emix: 0};
// a held bass under kicks (or a pad under a lead), its ducker traced: the gain it gave, sample by sample, in dB at t
function traced(chain, events, secs = 2.3, extra = []){ const key = chain[0].key === 'sidechain';
  const r = offline(sr, {period: .5, sources: {k: {kind: 'kit', kit: 'Analog 909'}, b: {kind: 'synth', params: BASS}, l: {kind: 'synth', params: {...BASS, mode: 0}}},
    strips: [{id: 'kick', input: {src: 'k', pad: 'kick'}, chain: [], out: 'master', mute: true}, {id: 'lead', input: {src: 'l'}, chain: [], out: 'master', mute: true},
      {id: 'bass', input: {src: 'b'}, chain, out: 'master'}, ...extra]}, [{type: 'on', src: 'b', id: 'B', n: 45, vel: .8, t: 0}, {type: 'off', src: 'b', id: 'B', t: secs}, ...events], secs,
    H => { H.by.bass.chain.list[0].trace = []; });
  const tr = r.H.by.bass.chain.list[0].trace; return {g: t => db(tr[Math.round(t*sr)] ?? 1), H: r.H, key}; }
const kicks = (vel = [1, 1, 1, 1]) => [.2, .7, 1.2, 1.7].map((t, i) => ({type: 'hit', src: 'k', voice: 'kick', vel: vel[i], t}));

/* ---------- the ducker that reads the score ---------- */
{ const {g} = traced([{key: 'duck', params: {from: 'k:kick', depth: 12, pre: 5, hold: 10, len: .4, vel: 0}}], kicks());
  check('the ducker moves before the kick: halfway down 2.5 ms ahead, all the way down on it', g(.7 - .0025) < -4 && g(.7 - .0025) > -8 && g(.7) < -11.9 && g(.7 - .006) > -.01,
    `${g(.7 - .006).toFixed(1)}, ${g(.7 - .0025).toFixed(1)}, ${g(.7).toFixed(1)} dB at -6, -2.5 and 0 ms`);
  check('it holds, then comes back over its length (.4 of a beat: 200 ms)', g(.7 + .008) < -11.9 && g(.7 + .11) > -11 && g(.7 + .11) < -1 && g(.7 + .215) > -.01, [.008, .11, .215].map(x => g(.7 + x).toFixed(1)).join(', ') + ' dB');
  const v = traced([{key: 'duck', params: {from: 'k:kick', depth: 12, pre: 5, hold: 10, len: .4, vel: 1}}], kicks([1, .4, 1, .4])).g;
  check('a softer hit dips less (velocity)', v(.7) > -6 && v(1.2) < -11.9, `${v(.7).toFixed(1)} dB at velocity .4, ${v(1.2).toFixed(1)} at 1`);
  const s = [0, 1, 2].map(k => traced([{key: 'duck', params: {from: 'k:kick', depth: 12, pre: 0, hold: 0, len: .5, shape: k, vel: 0}}], kicks()).g(.7 + .05));
  check('its shapes come back differently: like a compressor fastest at first, pumping held down longest', s[1] > s[0] && s[0] > s[2], s.map(x => x.toFixed(1)).join(', ') + ' dB 50 ms after');
  // following notes: down while the lead plays, back after it ends
  const n = traced([{key: 'duck', params: {from: 'l', depth: 6, pre: 20, len: .4, vel: 0}}], [{type: 'on', src: 'l', id: 1, n: 64, vel: .8, t: .5}, {type: 'off', src: 'l', id: 1, t: 1.2}]).g;
  check('following a part\'s notes, it\'s down from just before each note to just after it', n(.45) > -.01 && n(.49) < -2 && n(.8) < -5.9 && n(1.25) < -1 && n(1.45) > -.01, [.45, .49, .8, 1.25, 1.45].map(t => n(t).toFixed(1)).join(', ') + ' dB'); }

/* ---------- the classic sidechain compressor ---------- */
{ const {g} = traced([{key: 'sidechain', params: {key: 'kick', thr: -20, ratio: 8, att: 3, rel: 140, range: 12}}], kicks());
  check('the compressor dips only once the kick sounds, its attack after it (the kick muted still keys it)', g(.7 - .002) > -.5 && g(.7 + .012) < -6, `${g(.7 - .002).toFixed(1)} dB before, ${g(.7 + .012).toFixed(1)} dB 12 ms after`); }

/* ---------- ducking only the lows ---------- */
{ const sine = f => { const n = sr, L = new Float64Array(n), R = new Float64Array(n); for (let i = 0; i < n; i++) L[i] = R[i] = .5*Math.sin(2*Math.PI*f*i/sr); return [L, R]; };
  const run = (f, hits) => { const p = make('duck', sr, {from: 'k:kick', depth: 18, pre: 0, hold: 400, len: .2, vel: 0, band: 150}), [L, R] = sine(f), tl = {k: {hits, notes: []}};
    for (let a = 0; a < sr; a += 128) p.process(L, R, a, a + 128, {tl, now: a/sr, sr, period: .5}); let s = 0; for (let i = 24000; i < 24000 + 4800; i++) s += L[i]*L[i]; return Math.sqrt(s/4800)/(.5/Math.SQRT2); };
  const lo = run(50, [{t: .45, voice: 'kick', vel: 1}]), hi = run(1500, [{t: .45, voice: 'kick', vel: 1}]), none = run(50, []);
  check('Only below ducks the lows and leaves the highs, and is flat when nothing ducks', db(lo) < -10 && db(hi) > -.6 && Math.abs(db(none)) < .05, `${db(lo).toFixed(1)} dB at 50 Hz, ${db(hi).toFixed(2)} at 1.5 kHz, ${db(none).toFixed(3)} untouched`); }

/* ---------- the host's timeline ---------- */
{ const H = new Host(sr); H.build({sources: {k: {kind: 'kit', kit: 'Analog 909'}}, strips: [{id: 'kick', input: {src: 'k', pad: 'kick'}, chain: [], out: 'master'}]});
  for (const e of kicks()) H.msg({...e, seq: 1}); const L = new Float64Array(128), R = new Float64Array(128); for (let a = 0; a < .5*sr; a += 128) H.process(L, R, 128, a/sr);
  H.msg({type: 'stop'}); const left = H.tl.k.hits.map(h => h.t);
  check('the host keeps the hits it\'s given ahead, and forgets the future ones when stopped', left.length === 1 && left[0] === .2, JSON.stringify(left)); }

/* ---------- the playground ---------- */
execFileSync(process.execPath, [new URL('../studio/duck/build.mjs', import.meta.url).pathname]);
const {srv, url} = await serve(); const browser = await launch('2d');
{ const q = await browser.newPage({viewport: {width: 1280, height: 900}}); q.on('pageerror', e => { failed = true; console.log('FAIL page error:', e.message); });
  await q.goto(url + 'studio/listen/duck-lab.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(800);
  const drawn = await q.evaluate(() => [...document.querySelectorAll('canvas.trace')].map(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) n += d[i] > 0; return n; }));
  check('each pair draws what both ways do to the gain over a bar', drawn.length === 3 && drawn.every(n => n > 2000), drawn.join(', '));
  await q.click('#play'); await q.waitForFunction(() => window.__duck.A, null, {timeout: 6000});
  const hear = async () => { await q.waitForTimeout(1600); return q.evaluate(() => { const g = window.__duck.S.m.bass?.gr || {}, p = window.__duck.S.m.pad?.gr || {}; return {c: g['kb-c'] || 0, n: g['kb-n'] || 0, pc: p['lp-c'] || 0, pn: p['lp-n'] || 0, pk: window.__duck.S.m.master?.pk || 0}; }); };
  await q.keyboard.press('2'); const notes = await hear(); await q.keyboard.press('1'); const comp = await hear(); await q.keyboard.press('0'); const off = await hear();
  check('From the notes ducks the bass with the ducker, the compressor with the compressor, Off with neither', notes.n > 3 && notes.c === 0 && comp.c > 1 && comp.n === 0 && off.c === 0 && off.n === 0 && notes.pk > .05 && notes.pk <= 1.001,
    JSON.stringify({notes, comp, off}));
  await q.keyboard.press('2'); await q.check('#swap'); const seen = new Set();
  for (let i = 0; i < 40; i++) { await q.waitForTimeout(250); seen.add(await q.evaluate(() => window.__duck.S.mode)); }
  check('Swap every 2 bars alternates the compressor and the notes', seen.has('comp') && seen.has('notes'), [...seen].join(', '));
  // a setting turned and a pair switched off, kept across a reload
  await q.evaluate(() => { const r = document.querySelector('.pair .way[data-way="notes"] .ctl[data-key="depth"] input'); r.value = 900; r.dispatchEvent(new Event('input')); });
  await q.locator('.pair').nth(1).locator('.pairhead input').uncheck(); await q.reload(); await q.waitForTimeout(400);
  const kept = await q.evaluate(() => ({depth: window.__duck.S.set.kbnotes?.depth, lp: window.__duck.S.on.heldlp, mark: document.querySelectorAll('.pair')[1].dataset.on}));
  check('a ducker\'s setting and a pair switched off are kept across a reload', kept.depth > 30 && kept.lp === false && kept.mark === 'false', JSON.stringify(kept));
  await q.close(); }
{ const ph = await browser.newPage({viewport: {width: 390, height: 800}}); await ph.goto(url + 'studio/listen/duck-lab.html'); await ph.waitForTimeout(500);
  check('on a phone the page fits its width', await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await ph.close(); }
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
