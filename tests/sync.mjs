// Sync test: with real audio through the analyser, the pulse is drawn on time (a screen's delay ahead of the kick being heard);
// the picture is brightest on the pulse, not after it; and each "follows" mover moves with its own part of the groove.
// Runs on index.html (reads the modules); the audio part runs in real time (about 20 s).
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('sync: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const report = (ok, msg) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

// 1. real audio: a synthetic 125 BPM loop (kick every beat, offbeat hat, clap on 2 and 4) played through the page
{
  const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
  const page = await browser.newPage({viewport: {width: 320, height: 180}});
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(url + ENTRY); await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const SR = 44100, dur = 22, P = 60/125, n = SR*dur, x = new Float32Array(n), kicks = [];
    let seed = 1; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647*2 - 1;
    for (let b = 0; b*P < dur - 1; b++) {
      const t0 = .5 + b*P, i0 = Math.round(t0*SR); kicks.push(t0); let ph = 0;
      for (let i = 0; i < SR*.3 && i0 + i < n; i++) { const t = i/SR; ph += 2*Math.PI*(45 + 110*Math.exp(-t*30))/SR; x[i0 + i] += Math.sin(ph)*Math.exp(-t*9)*.9; }
      const h0 = Math.round((t0 + P/2)*SR); for (let i = 0; i < SR*.04 && h0 + i < n; i++) x[h0 + i] += rnd()*.12*Math.exp(-i/SR*120);
      if (b % 4 === 1 || b % 4 === 3) for (let i = 0; i < SR*.12 && i0 + i < n; i++) x[i0 + i] += rnd()*.15*Math.exp(-i/SR*30);
    }
    const buf = new ArrayBuffer(44 + n*2), dv = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); dv.setUint32(4, 36 + n*2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, SR, true); dv.setUint32(28, SR*2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n*2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i*2, Math.max(-1, Math.min(1, x[i]))*32000, true);
    const dt = new DataTransfer(); dt.items.add(new File([buf], 'loop.wav', {type: 'audio/wav'}));
    const fi = document.querySelector('#fileIn'); fi.files = dt.files; fi.dispatchEvent(new Event('change'));
    const pl = await import('/src/audio/player.js'), {S} = await import('/src/state.js'), {G} = await import('/src/audio/beatgrid.js');
    for (let i = 0; i < 100 && !pl.playing; i++) await new Promise(r => setTimeout(r, 50));
    const errs = []; let lastB = 0;
    await new Promise(done => { const f = () => {
      const pos = pl.actx.currentTime - pl.startedAt, o = pl.actx.getOutputTimestamp(), heard = o.contextTime + (performance.now() - o.performanceTime)/1000 - pl.startedAt;
      if (S.beat > lastB + .2 && G.locked) { let e = 9; for (const k of kicks) if (Math.abs(heard - k) < Math.abs(e)) e = heard - k; errs.push(e*1000); }
      lastB = S.beat; if (pos < 20) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    const {TUNE} = await import('/src/tuning.js');
    return {errs: errs.sort((a, b) => a - b), display: TUNE.sync.displayMs};
  });
  const med = r.errs[r.errs.length >> 1];
  // drawn a screen's delay before it's heard, so it's seen as it's heard; real-time timing in a busy test machine, so a loose window
  report(r.errs.length > 15 && Math.abs(med + r.display) < 25, `pulse with real audio: ${Math.round(med)} ms against the kick as heard (aim ${-r.display}, drawn early by the screen's delay), ${r.errs.length} pulses`);
  await browser.close();
}

// 2. the picture is brightest on the pulse, not after it (the trails used to build the kick up over 8 frames)
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), page = await openPage(browser, url);
  const r = await page.evaluate(`(async () => {
    const {S} = await import('/src/state.js');
    document.querySelector('#autoBtn').click();
    const set = (k, v) => { const s = document.querySelector('#s_' + k); s.value = v; s.dispatchEvent(new Event('input')); };
    for (const s of document.querySelectorAll('input[id^=s_]')) if (!/decay|zoom|colorSpeed/.test(s.id)) set(s.id.slice(2), 0);
    set('sym', 1); set('ring', 1); S.active.mods = {};
    __step(${mode === 'gl' ? 120 : 600});
    const curve = Array(10).fill(0); let n = 0, lastB = S.beat, since = -1;
    for (let i = 0; i < ${mode === 'gl' ? 70 : 400}; i++) {
      __step(1); if (S.beat > lastB + .1) { since = 0; n++; } else if (since >= 0) since++;
      lastB = S.beat; if (since >= 0 && since < 10) { const t = ${THUMB}; curve[since] += t.reduce((a, b) => a + b, 0)/t.length; }
    }
    return curve.map(v => v/n);
  })()`);
  // the kick frame should be the bright one: before the fix, WebGL's was 88% of a peak 8 frames later; now the ring's
  // only later rise is a few percent, as it shrinks back across its own trail
  const rel = r[0]/Math.max(...r);
  report(rel > .95, `${mode}: the kick frame is ${Math.round(rel*100)}% as bright as the brightest frame after it`);
  await browser.close();
}

// 3. each "follows" mover moves with its own part of the groove: bass every beat, mids on the claps (2 and 4), treble on the crash (1)
{
  const browser = await launch('2d'), prof = {};
  for (const src of ['bass', 'mid', 'treb']) {
    const page = await openPage(browser, url);
    prof[src] = await page.evaluate(async src => {
      const {S} = await import('/src/state.js'), {eff} = await import('/src/presets.js');
      document.querySelector('#autoBtn').click(); __step(600);
      S.active.ring = .4; S.active.mods = {ring: {src, amt: .5}}; __step(120);
      const p = [0, 0, 0, 0], n = [0, 0, 0, 0];
      for (let i = 0; i < 1200; i++) { __step(1); if (Math.abs(__truthErr) < .06) { p[__truth] += eff.ring; n[__truth]++; } }
      return p.map((v, i) => v/n[i]);
    }, src);
    await page.close();
  }
  const {bass, mid, treb} = prof, f = a => a.map(v => v.toFixed(2)).join(' ');
  report(Math.min(...bass) > .6*Math.max(...bass) && Math.max(...bass) - .4 > .1, `bass follows every kick (${f(bass)})`);
  report(Math.min(mid[1], mid[3]) > Math.max(mid[0], mid[2]) + .05, `mids follow the claps on 2 and 4 (${f(mid)})`);
  report(treb[0] > Math.max(treb[1], treb[2], treb[3]) + .05, `treble follows the crash on 1 (${f(treb)})`);
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
