// The DJ panel's instruments played as a person would, with real audio, measured at the analyser: every voice of every kit
// from its pad after the sections are switched on and off in different orders; the synth's on-screen keys; the synth and
// the drums from the computer's keys (the page's own single-letter keys used to take E, H, K, S and T from the synth);
// one instrument holding the keys at a time; the page's keys back once Keys is off; and the sections never overlapping
// (squeezed, the decks' buttons lay over the drum rack's and took their clicks).
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('instruments: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 1100, height: 900, groove: false, noDraw: true});
await page.evaluate(async () => { const pl = await import('/src/audio/player.js'); pl.ensureAudio();
  // the loudest the output got since the last read, sampled every 10 ms
  window.__peak = 0; setInterval(() => { const a = pl.analyser; if (!a) return; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); window.__peak = Math.max(window.__peak, m); }, 10); });
const peak = async fn => { await page.evaluate(() => { window.__peak = 0; }); await fn(); await wait(400); return page.evaluate(() => window.__peak); };
const SEC = {decks: '#dj .djb', groove: '#dj .gbx', syn: '#dj .syb', fx: '#dj .fxb'};
const shown = t => page.evaluate(s => !document.querySelector(s).hidden, SEC[t]);
const want = async (t, on) => { if (await shown(t) !== on) await page.click(`#dj .tab[data-t="${t}"]`); await wait(120); };
await page.click('#djBtn'); await wait(300);

// every voice of every kit from its pad, the sections switched about before each kit
const voices = await page.$$eval('#dj .gdrums .glab[data-v]', ls => ls.map(l => l.dataset.v)), kits = await page.$$eval('#dj .gkit option', os => os.map(o => o.value));
const orders = [[['groove', true]], [['groove', false], ['syn', true], ['groove', true]], [['fx', true], ['decks', false], ['syn', false]], [['groove', false], ['groove', true], ['fx', false]], [['decks', true], ['syn', true]]];
const silent = [], covered = [];
for (const [ki, kit] of kits.entries()) {
  for (const [t, on] of orders[ki % orders.length]) await want(t, on);
  await want('groove', true); await page.selectOption('#dj .gkit', kit); await wait(80);
  for (const v of voices) { const sel = `#dj .gdrums .glab[data-v="${v}"]`; await page.$eval(sel, e => e.scrollIntoView({block: 'center'}));
    const top = await page.$eval(sel, e => { const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return e.contains(t); });
    if (!top) covered.push(`${kit} ${v}`);
    const p = await peak(() => page.click(sel)); if (p < .01) silent.push(`${kit} ${v}`); }
}
check(`every voice of every kit sounds from its pad (${kits.length} kits × ${voices.length} voices, the sections switched about)`, !silent.length, silent.join(', ') || 'all heard');
check('no pad is covered by another section', !covered.length, covered.join(', '));

// the synth: its on-screen keys, then the computer's keys with Keys on (every key, E H K S T included)
await want('syn', true);
const keys = await page.$$('#dj .skb .sk'), quiet = [];
for (const [i, k] of keys.slice(0, 24).entries()) { await k.scrollIntoViewIfNeeded(); const b = await k.boundingBox();
  const p = await peak(async () => { await page.mouse.move(b.x + b.width/2, b.y + b.height*.8); await page.mouse.down(); await wait(150); await page.mouse.up(); }); if (p < .01) quiet.push(i); }
check('the synth\'s 24 on-screen keys sound', !quiet.length, quiet.length ? 'silent: ' + quiet.join(' ') : '');
await page.evaluate(() => { const b = document.querySelector('#dj .skeys'); if (b.getAttribute('aria-pressed') !== 'true') b.click(); });
const typed = []; for (const k of 'awsedftgyhujk') { const p = await peak(async () => { await page.keyboard.down(k); await wait(120); await page.keyboard.up(k); }); if (p < .01) typed.push(k); }
check('the synth plays from every computer key (A W S E D F T G Y H U J K)', !typed.length, typed.length ? 'silent: ' + typed.join(' ') : '');
const kNotStolen = await page.evaluate(() => !document.querySelector('#keyHud')?.classList.contains('on'));
check('those keys don\'t reach the page while Keys is on (no group opened)', kNotStolen);

// the drums from the computer's keys: switching them on lets the synth's go
await want('groove', true); await page.click('#dj .gkeys');
const synthOff = await page.$eval('#dj .skeys', b => b.getAttribute('aria-pressed') !== 'true');
const drumQuiet = []; for (const k of 'asdfghjkzxcvb') { const p = await peak(async () => { await page.keyboard.down(k); await wait(60); await page.keyboard.up(k); }); if (p < .01) drumQuiet.push(k); }
check('the drums play from the computer\'s keys (13 voices), and taking the keys lets the synth\'s go', !drumQuiet.length && synthOff, `${drumQuiet.length ? 'silent: ' + drumQuiet.join(' ') + '; ' : ''}synth Keys ${synthOff ? 'off' : 'still on'}`);

// Keys off: the page's own keys again (K opens the kaleidoscope's group)
await page.click('#dj .gkeys'); await page.keyboard.press('k'); await wait(100);
const hud = await page.evaluate(() => { const h = document.querySelector('#keyHud'); return h?.classList.contains('on') ? h.textContent.slice(0, 13) : ''; });
check('with Keys off the page\'s own keys work again (K opens its group)', /Kaleidoscope/.test(hud), hud);
await page.keyboard.press('Escape');

// the sections at their own heights, never over each other, and the head in place
await want('decks', true); await want('groove', true); await want('syn', true); await want('fx', true);
const lay = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), ss = ['#dj .djb', '#dj .gbx', '#dj .syb', '#dj .fxb'].map(r);
  return {overlap: ss.some((a, i) => i && a.top < ss[i - 1].bottom - 1), head: r('#dj .djh').height}; });
check('with every section showing, none lies over another, and the head keeps its height', !lay.overlap && lay.head >= 30, JSON.stringify(lay));

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
