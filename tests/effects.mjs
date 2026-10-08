// The effects (audio/engine/fx/), each rendered offline on a test sound and measured: the delay echoes on the beat's
// division and ping-pongs, the reverb's tail is wide and dies away, the modulation effects move the sound, drive and
// bitcrush add harmonics, the filter and EQ shape the tone, the compressor and sidechain pull the level down, the width
// narrows the image, the auto-pan swings it. Then the mixer in the page: the strips, an insert on the groovebox, the
// Effects panel's cards, and the chain kept across a reload.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('effects: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 1000, height: 700, groove: false, noDraw: true});
const r = await page.evaluate(async () => {
  const {effect, defaults} = await import('/src/audio/engine/registry.js');
  const SR = 44100, PER = .5, notes = new Set();
  const env = {period: () => PER, clock: () => ({beat: t => t/PER, period: () => PER}), onNote: fn => { notes.add(fn); return () => notes.delete(fn); }};
  // render one effect: its settings, a test sound (a function of time per channel, or a click), and what to do before rendering
  async function render(key, set, src, secs = 1.5, before){
    const ctx = new OfflineAudioContext(2, Math.round(SR*secs), SR), E = effect(key), fx = E.make(ctx, env), p = {...defaults(E), ...set};
    for (const k in p) fx.set(k, p[k]); if (fx.now) fx.now();
    const b = ctx.createBuffer(2, Math.round(SR*secs), SR);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); if (src === 'click') { if (c === 0) d[Math.round(.1*SR)] = 1; } else for (let i = 0; i < d.length; i++) d[i] = src(i/SR, c); }
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(fx.input); fx.output.connect(ctx.destination); s.start(0);
    if (src === 'click') b.getChannelData(1)[Math.round(.1*SR)] = 1;
    for (let t = 0; t < secs; t += .1) if (fx.tick) fx.tick(t);
    if (before) before(fx);
    const out = await ctx.startRendering(); return [out.getChannelData(0), out.getChannelData(1)];
  }
  const rms = (d, a, b) => { let s = 0; const i0 = Math.round(a*SR), i1 = Math.round(b*SR); for (let i = i0; i < i1; i++) s += d[i]*d[i]; return Math.sqrt(s/Math.max(1, i1 - i0)); };
  const peakAt = (d, a, b) => { let m = 0, at = 0; for (let i = Math.round(a*SR); i < Math.round(b*SR); i++) if (Math.abs(d[i]) > m) { m = Math.abs(d[i]); at = i/SR; } return {m, at}; };
  // the level of one frequency (Goertzel) over a stretch
  const tone = (d, f, a = .5, b = 1) => { const w = 2*Math.PI*f/SR; let s1 = 0, s2 = 0; const i0 = Math.round(a*SR), i1 = Math.round(b*SR);
    for (let i = i0; i < i1; i++) { const s = d[i] + 2*Math.cos(w)*s1 - s2; s2 = s1; s1 = s; } return Math.sqrt(s1*s1 + s2*s2 - 2*Math.cos(w)*s1*s2)/(i1 - i0)*2; };
  const sine = (f, a = .5) => t => a*Math.sin(2*Math.PI*f*t), dB = x => 20*Math.log10(Math.max(1e-9, x)), out = {};

  // delay: 1/8 at 120 BPM is .25 s; ping-pong: the first echo left, the next right
  { const [L, R] = await render('delay', {div: 3, fb: .5, ping: 1, mix: 1, tone: 14000}, 'click', 1.2);
    const a = peakAt(L, .3, .4), b = peakAt(R, .55, .65), c = peakAt(R, .3, .4);
    out.delay = {l: a.at - .1, r: b.at - .1, ok: Math.abs(a.at - .35) < .005 && Math.abs(b.at - .6) < .005 && a.m > .1 && b.m > .05 && c.m < a.m*.1}; }
  // reverb: a tail that's still there half a second on, has died by the end, and differs left to right (wide)
  { const [L, R] = await render('reverb', {kind: 0, size: .4, mix: 1, pre: 0, low: 20}, 'click', 3.5);
    const mid = rms(L, .6, 1), end = rms(L, 3.2, 3.5); let diff = 0; for (let i = Math.round(.6*SR); i < SR; i++) diff += Math.abs(L[i] - R[i]);
    out.reverb = {mid, end, ok: mid > 1e-4 && end < mid/20 && diff/(.4*SR) > mid*.3}; }
  // modulation: the output moves against the input
  for (const k of ['chorus', 'flanger', 'phaser']) { const src = sine(440); const [L] = await render(k, {mix: .5, depth: 1, rate: 2}, src, 1.5);
    let d = 0, n = 0; for (let i = Math.round(.3*SR); i < L.length; i++) { d += (L[i] - src(i/SR)*Math.SQRT1_2)**2; n++; }
    out[k] = {move: Math.sqrt(d/n), ok: Math.sqrt(d/n) > .02 && L.every(Number.isFinite)}; }
  // drive and bitcrush: a pure 200 Hz comes out with its third harmonic
  for (const [k, set] of [['drive', {amt: .8, tone: 18000, mix: 1}], ['crush', {bits: 3, tone: 18000, mix: 1}]]) {
    const [L] = await render(k, set, sine(200, .6), 1); const h = tone(L, 600)/tone(L, 200); out[k] = {h3: h, ok: h > .05}; }
  { const [L] = await render('drive', {amt: 0, mix: 1, tone: 18000}, sine(200, .3), 1); out.driveClean = {h3: tone(L, 600)/tone(L, 200), ok: tone(L, 600)/tone(L, 200) < .02}; }
  // filter: a low-pass at 500 Hz keeps 100 Hz and takes 5 kHz down by more than 30 dB
  { const [A] = await render('filter', {kind: 0, cut: 500, res: 0, mix: 1}, sine(100), 1), [B] = await render('filter', {kind: 0, cut: 500, res: 0, mix: 1}, sine(5000), 1);
    const lo = dB(tone(A, 100)/.5), hi = dB(tone(B, 5000)/.5); out.filter = {lo, hi, ok: lo > -3 && hi < -30}; }
  // EQ: the low shelf at +12 dB lifts 60 Hz by most of that, and leaves 3 kHz
  { const [A] = await render('eq', {low: 12}, sine(60, .2), 1), [B] = await render('eq', {low: 12}, sine(3000, .2), 1);
    const lo = dB(tone(A, 60)/.2), hi = dB(tone(B, 3000)/.2); out.eq = {lo, hi, ok: lo > 9 && Math.abs(hi) < 1}; }
  // the compressor: a loud tone comes out quieter
  { const [L] = await render('comp', {thr: -30, ratio: 20, gain: 0, att: .001}, sine(220, .9), 1); const g = dB(rms(L, .5, 1)/(.9*Math.SQRT1_2)); out.comp = {g, ok: g < -6}; }   // (the browser's compressor adds its own make-up gain)
  // sidechain: on every beat it ducks (just after the beat it's low, before the next it's back); on the kick, at the kick
  { const [L] = await render('pump', {src: 1, depth: 1, rel: .3}, sine(300), 2);
    const dip = rms(L, 1.005, 1.03), back = rms(L, 1.35, 1.45); out.pumpBeat = {dip, back, ok: dip < back*.3 && back > .3}; }
  { const [L] = await render('pump', {src: 0, depth: 1, rel: .3}, sine(300), 2, () => notes.forEach(fn => fn({t: .75, ch: 'kick'})));
    const dip = rms(L, .755, .78), before = rms(L, .6, .7); out.pumpKick = {dip, before, ok: dip < before*.3 && before > .3}; }
  // width 0: a tone on the left alone comes out the same both sides (mono); width 2: the sides doubled
  { const src = (t, c) => c ? 0 : .5*Math.sin(2*Math.PI*1000*t); const [L, R] = await render('width', {w: 0}, src, 1);
    let d = 0; for (let i = SR/2; i < SR; i++) d += Math.abs(L[i] - R[i]); out.width = {diff: d/(SR/2), ok: d/(SR/2) < .005 && rms(L, .5, 1) > .1}; }
  // auto-pan: over a beat the sound moves from one side to the other (a quarter-note cycle at 120 BPM: .5 s)
  { const [L, R] = await render('autopan', {mode: 0, div: 5, depth: 1}, sine(500), 2);
    const a = [], b = []; for (let k = 0; k < 8; k++) { a.push(rms(L, .5 + k*.0625, .5 + (k + 1)*.0625)); b.push(rms(R, .5 + k*.0625, .5 + (k + 1)*.0625)); }
    const sw = Math.max(...a.map((x, k) => x - b[k])) - Math.min(...a.map((x, k) => x - b[k])); out.autopan = {sw, ok: sw > .3}; }
  return out;
});
for (const [k, v] of Object.entries(r)) check(k, v.ok, JSON.stringify(v, (key, x) => key === 'ok' ? undefined : typeof x === 'number' ? +x.toFixed(4) : x));

// the mixer in the page: the strips, an effect on the groovebox (heard by the analyser), the panel's cards, kept across a reload
const m = await page.evaluate(async () => {
  const mx = await import('/src/audio/engine/mixer.js'), g = await import('/src/audio/groove.js');
  g.grooveToggle(); mx.addInsert('groove', 'delay'); mx.addInsert('groove', 'drive'); mx.setParam('groove', 0, 'fb', .7); mx.setStrip('groove', 'B', -6);
  document.querySelector('#djBtn').click(); document.querySelector('#dj .tab[data-t=fx]').click();
  await new Promise(r => setTimeout(r, 900));
  const rows = [...document.querySelectorAll('#dj .mxrow')].map(e => e.querySelector('b').textContent), cards = [...document.querySelectorAll('#dj .mxrow')][0].querySelectorAll('.fxc').length;
  const knobs = document.querySelectorAll('#dj .mxrow .fxc .knob').length, h = (await import('/src/state.js')).S.djH;
  const {analyser} = await import('/src/audio/player.js'), a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
  g.grooveToggle(); document.querySelector('#dj .fxn').click();
  await new Promise(r => setTimeout(r, 500));
  return {strips: [...mx.STRIPS.keys()].join(), rows, cards, knobs, h, heard: Math.max(...a.map(Math.abs)), on: mx.STRIPS.get('groove').ins[0].on};
});
check('the mixer has its strips: the channels, two sends and the master', m.strips.includes('master') && m.strips.includes('sendA') && m.strips.includes('sendB') && m.strips.includes('groove'), m.strips);
check('the Effects panel shows a row a strip and the groovebox\'s chain as cards of knobs', m.rows.join() === 'Groovebox,Deck A,Deck B,Send A,Send B,Master' && m.cards === 2 && m.knobs >= 10 && m.h > 400, `${m.rows.join(', ')}; ${m.cards} cards, ${m.knobs} knobs, panel ${m.h} px`);
check('the groovebox through its effects reaches the analyser', m.heard > .01, m.heard.toFixed(3));
check('a click on an effect\'s name bypasses it', m.on === 0, '' + m.on);
await page.reload(); await page.waitForFunction(() => window.__step);
const k = await page.evaluate(async () => { const mx = await import('/src/audio/engine/mixer.js'), g = await import('/src/audio/groove.js'); g.grooveToggle(); g.grooveToggle();
  const s = mx.STRIPS.get('groove'); return {ins: s.ins.map(i => i.k + (i.on ? '' : '(off)')).join(), fb: s.ins[0].p.fb, B: s.st.B}; });
check('the chain, its settings and the sends are kept across a reload', k.ins === 'delay(off),drive' && k.fb === .7 && k.B === -6, JSON.stringify(k));

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
