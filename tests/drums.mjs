// The drum kit (audio/engine/inst/drums.js), every voice in every kit rendered offline and measured: it sounds (and
// doesn't clip), dies away to silence, and sits where it should in the spectrum (the kick lowest, the toms, the snare,
// the hats highest); the tune knob moves the kick's note an octave, the decay knob lengthens a voice, a closed hat
// chokes an open one; then in the page the groovebox plays the kit, its menu changes kit, and a voice's knob is kept.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('drums: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 1000, height: 700, groove: false, noDraw: true});
const r = await page.evaluate(async () => {
  const {makeDrums, VOICES, KIT_NAMES} = await import('/src/audio/engine/inst/drums.js');
  const SR = 44100;
  // render hits: [[voice, time, velocity]], with settings changed first
  async function render(kitName, hits, secs = 2.5, set = {}){
    const ctx = new OfflineAudioContext(2, SR*secs, SR), k = makeDrums(ctx, ctx.destination); k.load(kitName);
    for (const v in set) for (const p in set[v]) k.set(v, p, set[v][p]);
    for (const [v, t, vel] of hits) k.play(v, t, vel ?? 1);
    const b = await ctx.startRendering(); const L = b.getChannelData(0), R = b.getChannelData(1), m = new Float32Array(L.length); for (let i = 0; i < m.length; i++) m[i] = (L[i] + R[i])/2; return m;
  }
  const peak = d => d.reduce((a, x) => Math.max(a, Math.abs(x)), 0);
  // how long until it stays 60 dB under its peak
  const ring = d => { const p = peak(d), th = p*1e-3; for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > th) return i/SR; return 0; };
  // where its energy sits: the spectrum's centre of mass over its first 80 ms (a plain DFT on 1024 points)
  const centroid = (d, t0 = .115) => { const N = 2048, i0 = Math.round(t0*SR); let num = 0, den = 0;
    for (let k = 1; k < N/2; k += 2) { let re = 0, im = 0; const w = 2*Math.PI*k/N; for (let n = 0; n < N; n++) { const x = (d[i0 + n] || 0)*(.5 - .5*Math.cos(2*Math.PI*n/N)); re += x*Math.cos(w*n); im -= x*Math.sin(w*n); }
      const m = re*re + im*im; num += m*k*SR/N; den += m; } return num/den; };   // (by power: the body, not the click)
  const tone = (d, f, a, b) => { const w = 2*Math.PI*f/SR; let s1 = 0, s2 = 0; for (let i = Math.round(a*SR); i < Math.round(b*SR); i++) { const s = d[i] + 2*Math.cos(w)*s1 - s2; s2 = s1; s1 = s; } return Math.hypot(s1 - Math.cos(w)*s2, Math.sin(w)*s2); };
  const out = {voices: {}, kits: {}};
  for (const kn of KIT_NAMES) { const bad = [];
    for (const v of VOICES) { const d = await render(kn, [[v.key, .1]], 4), p = peak(d), rg = ring(d) - .1;
      if (!(p > .02 && p < 1.3) || !d.every(Number.isFinite) || rg > 3.6) bad.push(`${v.key} peak ${p.toFixed(2)} ring ${rg.toFixed(2)}`);
      if (kn === '909') out.voices[v.key] = {peak: +p.toFixed(2), ring: +rg.toFixed(2), centre: Math.round(centroid(d))}; }
    out.kits[kn] = bad; }
  // tune: the kick a full octave up lands its note there (49 Hz → 98 Hz)
  { const a = await render('909', [['kick', .1]], 1), b = await render('909', [['kick', .1]], 1, {kick: {tune: 12}});
    out.tune = {lowAt49: tone(a, 49, .25, .5)/tone(a, 98, .25, .5), highAt98: tone(b, 98, .25, .5)/tone(b, 49, .25, .5)}; }
  // decay: longer rings longer
  { const a = await render('909', [['tomL', .1]], 3), b = await render('909', [['tomL', .1]], 3, {tomL: {decay: 3}}); out.decay = {short: ring(a) - .1, long: ring(b) - .1}; }
  // choke: an open hat, then a closed one 60 ms on, leaves far less of the open hat's ring
  { const a = await render('909', [['ohh', .1]], 1), b = await render('909', [['ohh', .1], ['chh', .16]], 1); const e = (d, x, y) => { let s = 0; for (let i = x*SR; i < y*SR; i++) s += d[i]*d[i]; return s; };
    out.choke = {open: e(a, .3, .6), choked: e(b, .3, .6)}; }
  return out;
});
for (const [k, bad] of Object.entries(r.kits)) check(`kit ${k}: every voice sounds, doesn't clip and dies away`, !bad.length, bad.join('; '));
const V = r.voices, c = k => V[k].centre;
console.log('     909 voices (peak, ring s, centre Hz):', Object.entries(V).map(([k, v]) => `${k} ${v.peak}/${v.ring}/${v.centre}`).join(', '));
check('the kick sits lowest, then the toms, the snare and clap, the hats and cymbals highest', c('kick') < c('tomL') && c('tomL') < c('tomH') && c('tomH') < c('snare') && c('snare') < c('chh') && c('clap') < c('chh') && c('kick') < 250 && c('chh') > 6000 && c('ride') > 3000,
  `kick ${c('kick')}, toms ${c('tomL')}/${c('tomH')}, snare ${c('snare')}, clap ${c('clap')}, hats ${c('chh')}/${c('ohh')}, ride ${c('ride')}`);
check('tune +12 moves the kick\'s note up an octave', r.tune.lowAt49 > 3 && r.tune.highAt98 > 3, JSON.stringify(r.tune));
check('the decay knob lengthens a voice', r.decay.long > r.decay.short*2, `${r.decay.short.toFixed(2)} s → ${r.decay.long.toFixed(2)} s`);
check('a closed hat chokes an open one', r.choke.choked < r.choke.open*.05, `${r.choke.open.toExponential(2)} → ${r.choke.choked.toExponential(2)}`);

// in the page: the kit plays in the groovebox, the menu changes it, a voice's knob is kept with the pattern
const g = await page.evaluate(async () => {
  const g = await import('/src/audio/groove.js'), pl = await import('/src/audio/player.js');
  document.querySelector('#djBtn').click(); const sel = document.querySelector('#dj .gkit'); sel.value = '808'; sel.dispatchEvent(new Event('change'));
  document.querySelector('#dj .gdrums .glab[data-v=clap]').click();
  const knobs = [...document.querySelectorAll('#dj .gvoice .knob')].map(k => k.querySelector('.kl').textContent).join();
  g.setVoice('clap', 'decay', 2); g.loadPreset('808 bounce'); g.setVoice('kick', 'tune', -5); g.grooveToggle();
  await new Promise(r => setTimeout(r, 1200)); const a = new Float32Array(pl.analyser.fftSize); pl.analyser.getFloatTimeDomainData(a); g.grooveToggle();
  await new Promise(r => setTimeout(r, 400));
  return {kit: g.GB.kit, knobs, heard: Math.max(...a.map(Math.abs)), saved: JSON.parse(localStorage.getItem('afterglow.groove')).vp, cow: g.GB.cow.join('')};
});
check('the groovebox plays the kit, and its menu changes kit', g.kit === '808' && g.heard > .01 && g.cow.includes('1'), `${g.kit}, heard ${g.heard.toFixed(3)}`);
check('a picked voice shows its knobs, its own character among them', g.knobs === 'Tune,Decay,Tone,Drive,Level,Pan,Spread', g.knobs);
check('a voice\'s setting is kept', g.saved && g.saved.kick && g.saved.kick.tune === -5, JSON.stringify(g.saved));

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
