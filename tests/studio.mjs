// The Studio (src/studio/): the song format read right (note names, drum rows, clips, slides, checks); the new instruments
// rendered offline and measured (every preset sounds and dies away, unison widens, paraphonic pads, a moving LFO, legato
// glides, the FM's depth); the mixer's devices (an EQ bell and cut, the compressor, the sidechain ducking on the kick's
// notes, the limiter holding its ceiling); the scheduler (sixteenths on time, swing, chance the same every render,
// polymeter, the arrangement's scenes, automation and modulators); a short song rendered within its ceiling, as WAV and zip;
// every song in src/studio/songs/ checking clean; and the page: it plays, notes reach the note bus, the meters move, a
// launched scene starts on the next bar, a fader writes into the song.
import { serve, launch, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('studio: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const f2 = o => JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v);

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
await page.goto(url + 'studio.html');

const r = await page.evaluate(async () => {
  const S = await import('/src/studio/song.js'), {renderSong} = await import('/src/studio/engine.js'), M = await import('/src/studio/measure.js');
  const {makeAnalog, PRESETS: AP} = await import('/src/audio/engine/inst/analog.js'), {makeFm, PRESETS: FP} = await import('/src/audio/engine/inst/fm.js');
  const {makeDevice} = await import('/src/studio/devices.js'), {wav} = await import('/src/studio/wav.js'), {zip} = await import('/src/studio/zip.js'), {SONGS} = await import('/src/studio/songs/index.js');
  const SR = 44100, o = {};
  const rms = (d, a, b) => { let s = 0; const i0 = Math.round(a*SR), i1 = Math.min(d.length, Math.round(b*SR)); for (let i = i0; i < i1; i++) s += d[i]*d[i]; return Math.sqrt(s/Math.max(1, i1 - i0)); };
  const peak = d => d.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const tone = (d, f, a, b) => { const w = 2*Math.PI*f/SR; let s1 = 0, s2 = 0; for (let i = Math.round(a*SR); i < Math.round(b*SR); i++) { const s = d[i] + 2*Math.cos(w)*s1 - s2; s2 = s1; s1 = s; } return Math.hypot(s1 - Math.cos(w)*s2, Math.sin(w)*s2)/((b - a)*SR); };
  const bright = (d, a, b) => { let hi = 0, all = 0; for (let i = Math.round(a*SR) + 1; i < Math.round(b*SR); i++) { hi += (d[i] - d[i - 1])**2; all += d[i]**2; } return Math.sqrt(hi/all); };
  const off = async (secs, fn) => { const ctx = new OfflineAudioContext(2, Math.round(SR*secs), SR); fn(ctx); const b = await ctx.startRendering(); return [b.getChannelData(0), b.getChannelData(1)]; };

  /* the format */
  o.notes = [S.noteNum('C4'), S.noteNum('A1'), S.noteNum('F#3'), S.noteNum('Bb2'), S.noteNum(40), S.noteNum('kick')];
  const row = S.hitRow('x..o|X.?.|5..r'); o.row = {len: row.len, ev: row.ev.map(e => [e.s, +e.v.toFixed(2), e.p])};
  const cl = S.readClip({notes: [[0, 'A1', 1, .9, {slide: true}], [4, ['C4', 'E4'], 2]], steps: 12}); o.clip = {len: cl.len, n: cl.ev.length, slide: cl.ev[0].l, chord: cl.ev.filter(e => e.s === 4).map(e => e.n)};
  o.bad = S.check({bpm: 120, tracks: [{id: 'a', inst: {type: 'analog', preset: 'Nope'}, clips: {x: {notes: [[0, 'C4']]}}, mix: {to: 'bus', chain: [{type: 'sc', src: 'kick'}]}}],
    scenes: [{id: 's', clips: {a: 'y'}}], arrange: [['t', 4]]});
  o.songs = SONGS.map(s => [s.title, S.check(s)]);

  /* the analog synth: every preset sounds, doesn't clip, dies away */
  o.presets = [];
  for (const [name, p] of Object.entries(AP)) {
    const n = /bass|Reese|Acid/i.test(name) ? 36 : 60, held = .6, [L, R] = await off(held + 6.5, ctx => { const s = makeAnalog(ctx, ctx.destination); s.load(p); s.play(n, .05, held, .8); });
    const pk = Math.max(peak(L), peak(R)), tail = rms(L, held + 6, held + 6.5);
    if (!(pk > .01 && pk < 1 && tail < pk*.003 && L.every(Number.isFinite))) o.presets.push(`${name}: peak ${pk.toFixed(3)}, tail ${tail.toExponential(1)}`);
  }
  // unison widens (seven saws spread against one); the paraphonic pad sounds like a chord
  { const w = (a, b) => { let d = 0, s = 0; for (let i = SR*.2; i < SR*.8; i++) { d += (a[i] - b[i])**2; s += (a[i] + b[i])**2; } return Math.sqrt(d/s); };
    const one = await off(1, ctx => { const s = makeAnalog(ctx, ctx.destination); s.load({uni: 1, cut: 8000, fenv: 0}); s.play(57, .05, .9); });
    const seven = await off(1, ctx => { const s = makeAnalog(ctx, ctx.destination); s.load({uni: 7, det: 20, spread: 1, cut: 8000, fenv: 0}); s.play(57, .05, .9); });
    o.width = [w(...one), w(...seven)]; }
  { const [L] = await off(1.5, ctx => { const s = makeAnalog(ctx, ctx.destination); s.load({...AP['Supersaw pad'], aa: .05, cut: 6000}); s.play(57, .05, 1.2); s.play(64, .05, 1.2); });
    o.para = {a: tone(L, 220, .5, 1.1), e: tone(L, 329.6, .5, 1.1), off: tone(L, 300, .5, 1.1)}; }
  // an LFO in time on the cutoff: the brightness swings
  { const [L] = await off(2.2, ctx => { const s = makeAnalog(ctx, ctx.destination, {period: () => .5, t0: 0}); s.load({w1: 'Saw', cut: 500, fenv: 0, as: 1, l1: 'Sine', l1t: '1/2', matrix: [['lfo1', 'cut', .5]]}); s.play(48, 0, 2.1); });
    const b = []; for (let k = 0; k < 8; k++) b.push(bright(L, .2 + k*.25, .3 + k*.25)); o.lfo = Math.max(...b)/Math.min(...b); }
  // legato with a slide: the second note glides there without a new attack
  { const [L] = await off(1.2, ctx => { const s = makeAnalog(ctx, ctx.destination); s.load({w1: 'Sine', cut: 8000, fenv: 0, mode: 'Legato', glide: .05, aa: .002, as: 1, ar: .05}); s.play(60, .1, .55); s.play(67, .5, .5); });
    o.legato = {to: tone(L, 392, .8, .95)/tone(L, 261.6, .8, .95), dip: rms(L, .5, .52)/rms(L, .44, .48)}; }
  // the FM: every preset sounds and dies; more depth, brighter
  o.fm = [];
  for (const [name, p] of Object.entries(FP)) { const [L] = await off(5, ctx => { const s = makeFm(ctx, ctx.destination); s.load(p); s.play(60, .05, .4, .8); }); const pk = peak(L);
    if (!(pk > .01 && pk < 1 && rms(L, 4.5, 5) < pk*.003)) o.fm.push(`${name}: peak ${pk.toFixed(3)}`); }
  { const b = []; for (const idx of [.2, 2]) { const [L] = await off(.6, ctx => { const s = makeFm(ctx, ctx.destination); s.load({...FP['E-piano'], index: idx}); s.play(60, .05, .5); }); b.push(bright(L, .1, .3)); } o.fmIndex = b[1]/b[0]; }

  // the Moog: its worklet loads, every preset sounds and dies away without DC, the emphasis rings at the cutoff, a slide glides
  { const M = await import('/src/audio/engine/inst/moog.js'); o.moog = {bad: []};
    for (const [name, p] of Object.entries(M.PRESETS)) {
      const ctx = new OfflineAudioContext(2, SR*6, SR); o.moog.ok = await M.prepare(ctx); const s = M.makeMoog(ctx, ctx.destination); s.load(p); s.play(/bass|sub|Squelch/i.test(name) ? 36 : 57, .05, .8, .8);
      const b = await ctx.startRendering(), d = b.getChannelData(0), pk = peak(d); let dc = 0; for (let i = SR*.2; i < SR*.8; i++) dc += d[i]; dc /= SR*.6;
      if (!(pk > .01 && pk < 1 && rms(d, 5.5, 6) < pk*.003 && Math.abs(dc) < rms(d, .2, .8)*.03)) o.moog.bad.push(`${name}: peak ${pk.toFixed(3)}, dc ${dc.toFixed(4)}`);
    }
    // a 220 Hz cutoff with the emphasis up rings there over a saw at 55 Hz (its 4th harmonic, against the 2nd)
    const ring = async res => { const ctx = new OfflineAudioContext(2, SR, SR); await M.prepare(ctx); const s = M.makeMoog(ctx, ctx.destination); s.load({w1: 'Saw', l2: 0, l3: 0, cut: 220, res, cenv: 0, kbd: 0, drive: .2, as: 1}); s.play(33, .05, .9); const b = await ctx.startRendering(), d = b.getChannelData(0); return tone(d, 220, .4, .9)/tone(d, 110, .4, .9); };
    o.moog.ring = [await ring(0), await ring(.9)];
    const ctx = new OfflineAudioContext(2, SR*1.2, SR); await M.prepare(ctx); const s = M.makeMoog(ctx, ctx.destination); s.load({w1: 'Saw', l2: 0, l3: 0, cut: 6000, cenv: 0, glide: .05, as: 1}); s.play(48, .1, .55); s.play(55, .5, .5);
    const b = await ctx.startRendering(), d = b.getChannelData(0); o.moog.glide = tone(d, 196, .8, 1)/tone(d, 130.8, .8, 1); }

  /* the devices */
  const through = async (dev, src, secs = 1, desk) => off(secs, ctx => { const d = makeDevice(ctx, dev, desk || {onNote: () => () => {}, tap: () => null}, {period: () => .5, clock: {}, onNote: () => () => {}}); src(ctx, d.input); d.output.connect(ctx.destination); });
  const sine = f => (ctx, dest) => { const s = ctx.createOscillator(); s.frequency.value = f; const g = ctx.createGain(); g.gain.value = .25; s.connect(g); g.connect(dest); s.start(); };
  { const [a] = await through({type: 'eq', bands: [{type: 'bell', f: 1000, g: 6, q: 1}]}, sine(1000)), [b] = await through({type: 'eq', bands: [{type: 'hp', f: 200, slope: 24}]}, sine(50));
    o.eq = {bell: 20*Math.log10(rms(a, .3, .9)/(.25/Math.SQRT2)), cut: 20*Math.log10(rms(b, .3, .9)/(.25/Math.SQRT2))}; }
  { const loud = (ctx, dest) => { const s = ctx.createOscillator(); s.frequency.value = 220; s.connect(dest); s.start(); };
    const [a] = await through({type: 'comp', thr: -24, ratio: 8, att: .003, rel: .1}, loud), [b] = await through({type: 'comp', thr: 0, ratio: 1}, loud);
    o.comp = 20*Math.log10(rms(a, .5, .9)/rms(b, .5, .9)); }
  // the sidechain on note: a held tone dips by its depth right after each kick note, and is back by the next
  { const subs = []; const desk = {onNote: fn => { subs.push(fn); return () => {}; }, tap: () => null};
    const [a] = await off(2, ctx => { const d = makeDevice(ctx, {type: 'sc', src: 'kick', depth: 12, att: .003, hold: .02, rel: .1}, desk, {}); sine(220)(ctx, d.input); d.output.connect(ctx.destination);
      for (const t of [.5, 1, 1.5]) subs.forEach(fn => fn('kick', {t})); });
    o.sc = {dip: 20*Math.log10(rms(a, 1.006, 1.02)/rms(a, .9, .99)), back: 20*Math.log10(rms(a, 1.4, 1.48)/rms(a, .9, .99))}; }
  // the limiter: a signal 12 dB over full scale comes out under its ceiling
  { const [a, b] = await through({type: 'limiter', gain: 12, ceil: -1}, (ctx, dest) => { const s = ctx.createOscillator(); s.frequency.value = 997; const g = ctx.createGain(); g.gain.value = .9; s.connect(g); g.connect(dest); s.start(); }, 1);
    o.lim = M.truePeak([a.subarray(SR*.1), b.subarray(SR*.1)]); }

  /* no delay in the mixer: the Studio's compressor (a worklet without look-ahead) turns a tone down as Chromium's does,
     make-up and all, and an impulse through a whole song's mixer comes out at once */
  { const {prepare} = await import('/src/studio/engine.js'), {makeComp} = await import('/src/studio/dyn.js'), {makeDesk} = await import('/src/studio/desk.js');
    const lvl = async ours => { const ctx = new OfflineAudioContext(2, SR, SR); if (ours) await prepare(ctx); const c = makeComp(ctx, {thr: -24, ratio: 4, knee: 6, att: .003, rel: .1});
      const s = ctx.createOscillator(); s.frequency.value = 220; const g = ctx.createGain(); g.gain.value = .5; s.connect(g); g.connect(c.input); c.output.connect(ctx.destination); s.start();
      const b = await ctx.startRendering(); return 20*Math.log10(rms(b.getChannelData(0), .5, .9)/(.5/Math.SQRT2)); };
    o.dyn2 = [await lvl(true), await lvl(false)];
    const ctx = new OfflineAudioContext(2, SR*.3, SR); await prepare(ctx); const desk = makeDesk(ctx, SONGS[0], {env: {period: () => .5, clock: {}, onNote: () => () => {}}});
    const b = ctx.createBuffer(1, 1, SR); b.getChannelData(0)[0] = .3; const src = ctx.createBufferSource(); src.buffer = b; src.connect(desk.strips.get('bass').input); src.start(.05);
    const x = (await ctx.startRendering()).getChannelData(0); let pk = 0, at = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > pk) { pk = Math.abs(x[i]); at = i; } o.lat = (at/SR - .05)*1000; }
  /* the mixing tools: multiband, dynamic EQ, mid/side EQ, transient shaper, tape, console */
  { const dB = x => 20*Math.log10(x), tones = (fs, amp) => (ctx, dest) => fs.forEach((f, i) => { const s = ctx.createOscillator(); s.frequency.value = f; const g = ctx.createGain(); g.gain.value = Array.isArray(amp) ? amp[i] : amp; s.connect(g); g.connect(dest); s.start(); });
    const FS = [50, 150, 400, 1200, 3000, 8000], flat = {type: 'multiband', bands: [{}, {}, {}]};
    const [a] = await through(flat, tones(FS, .05)); o.mbFlat = Math.max(...FS.map(f => Math.abs(dB(tone(a, f, .3, .9)/.025))));
    const [b] = await through({type: 'multiband', bands: [{thr: -30, ratio: 8}, {}, {}]}, tones([60, 3000], [.5, .05])), [c] = await through(flat, tones([60, 3000], [.5, .05]));
    o.mb = {low: dB(tone(b, 60, .5, .9)/tone(c, 60, .5, .9)), high: dB(tone(b, 3000, .5, .9)/tone(c, 3000, .5, .9))};
    const [dr] = await through({type: 'multiband', bands: [{drive: 12}, {}, {}]}, tones([80], .4)); o.mbDrive = dB(tone(dr, 240, .3, .9)/tone(dr, 80, .3, .9));
    o.dyn = []; for (const amp of [.5, .01]) { const [d] = await through({type: 'dyneq', bands: [{type: 'bell', f: 300, q: 1.4, thr: -30, range: -6, ratio: 8}]}, tones([300], amp)); o.dyn.push(dB(tone(d, 300, .5, .9)/(amp/2))); }
    const [l, rr] = await through({type: 'mseq', bands: [{type: 'hp', f: 200, ch: 'side'}]}, tones([1000], .2)); o.msMono = [dB(tone(l, 1000, .3, .9)/.1), dB(tone(rr, 1000, .3, .9)/.1)];
    const wide = (ctx, dest) => { const m = ctx.createChannelMerger(2); for (const [ch, amp] of [[0, .2], [1, -.2]]) { const s = ctx.createOscillator(); s.frequency.value = 60; const g = ctx.createGain(); g.gain.value = amp; s.connect(g); g.connect(m, 0, ch); s.start(); } m.connect(dest); };
    const [l2] = await through({type: 'mseq', bands: [{type: 'hp', f: 200, ch: 'side'}]}, wide); o.msSide = dB(tone(l2, 60, .3, .9)/.1);
    const [tp] = await through({type: 'tape', drive: 9}, tones([200], .5)); o.tape = {h2: dB(tone(tp, 400, .3, .9)/tone(tp, 200, .3, .9)), lvl: dB(tone(tp, 200, .3, .9)/.25)};
    const [cs] = await through({type: 'console', drive: 6}, tones([200], .5)); o.cons = {h2: dB(tone(cs, 400, .3, .9)/tone(cs, 200, .3, .9)), h3: dB(tone(cs, 600, .3, .9)/tone(cs, 200, .3, .9))};
    const hit = (ctx, dest) => { const s = ctx.createOscillator(); s.frequency.value = 180; const g = ctx.createGain(); g.gain.value = 0; for (const t of [.2, .7]) { g.gain.setValueAtTime(.5, t); g.gain.setTargetAtTime(0, t + .001, .08); } s.connect(g); g.connect(dest); s.start(); };
    const env = async dev => { const [x] = await through(dev, hit); return [rms(x, .702, .712), rms(x, .85, .95)]; };
    const n = await env({type: 'transient'}), up = await env({type: 'transient', attack: 9}), sus = await env({type: 'transient', sustain: 9});
    o.tr = {atk: [dB(up[0]/n[0]), dB(up[1]/n[1])], sus: [dB(sus[0]/n[0]), dB(sus[1]/n[1])]}; }
  /* the new measures: width by band, masking, a reference compared and matched */
  { const N = SR*2, noise = () => Float32Array.from({length: N}, () => Math.random()*2 - 1), a = noise(), b = noise();
    const mono = M.stereoBands(a, a, SR), wide = M.stereoBands(a, b, SR); o.sb = {mono: Math.max(...mono.map(x => x.side)), wide: Math.min(...wide.map(x => x.side)), corr: [mono[3].corr, wide[3].corr]};
    // a low tone held under a pad's low tone (the same moments) clashes; the hats far above don't
    const sine = (f, on) => Float32Array.from({length: N}, (_, i) => on(i/SR) ? Math.sin(2*Math.PI*f*i/SR)*.3 : 0);
    const bass = sine(200, () => true), pad = sine(220, () => true), hats = Float32Array.from({length: N}, (_, i) => (i % 5512 < 400 ? (Math.random()*2 - 1)*.3 : 0));
    const ms = M.masking({bass: M.bandEnv(bass, SR), pad: M.bandEnv(pad, SR), hats: M.bandEnv(hats, SR)});
    o.mask = ms.map(m => `${m.a}/${m.b}:${m.band}`);
    const mixR = M.report(a, b, SR), dark = new Float32Array(N); let s1 = 0; for (let i = 0; i < N; i++) { s1 += (a[i] - s1)*.05; dark[i] = s1*4; }
    const refR = M.report(dark, dark, SR), d = M.compare(mixR, refR); o.cmp = {air: d.bands.air, tilt: d.tilt, side: d.side, eq: M.matchEq(d).map(x => x.g), adv: M.advise(d).length}; }

  /* the scheduler, on a short song */
  const song = {title: 't', bpm: 120, swing: .2, seed: 3,
    tracks: [{id: 'kick', inst: {type: 'drums', kit: '909'}, clips: {a: {hits: {kick: 'x...x...x...x...'}}, b: {hits: {kick: 'x.x.x.x.x.x.x.x.'}}}},
      {id: 'hat', inst: {type: 'drums', kit: '909'}, clips: {a: {hits: {chh: '????????????????'}}}},
      {id: 'poly', inst: {type: 'fm', preset: 'Wood blip'}, clips: {a: {steps: 12, notes: [[0, 'C4'], [5, 'E4']]}}, mix: {vol: -6}},
      {id: 'pad', inst: {type: 'analog', preset: 'Warm pad'}, clips: {a: {notes: [[0, 'A3', 16]]}}, mix: {vol: -60}}],
    master: {chain: [{type: 'limiter', gain: 6, ceil: -1}]},
    scenes: [{id: 'one', clips: {kick: 'a', hat: 'a', poly: 'a', pad: 'a'}}, {id: 'two', clips: {kick: 'b', poly: 'a', pad: 'a'}}],
    arrange: [['one', 2], ['two', 2]], auto: [{target: 'pad.vol', points: [[0, -60], [2, 0], [4, 0]]}]};
  const ev = []; const buf = await renderSong(song, {onNote: e => ev.push(e), tail: 1}), S16 = .125;
  const kicks = ev.filter(e => e.track === 'kick'), even = kicks.filter(e => Math.round(e.t/S16) % 2 === 0);
  o.sched = {kicks: kicks.length, onGrid: Math.max(...even.map(e => Math.abs(e.t/S16 - Math.round(e.t/S16)))),
    swing: ev.filter(e => e.track === 'hat' && Math.floor(e.t/S16) % 2 === 1).map(e => +((e.t/S16) % 1).toFixed(3)).slice(0, 3),
    hats: ev.filter(e => e.track === 'hat').length, poly: ev.filter(e => e.track === 'poly').map(e => Math.round(e.t/S16)).slice(0, 6)};
  const ev2 = []; await renderSong(song, {onNote: e => ev2.push(e), tail: .1, bars: 2}); o.sched.again = ev2.filter(e => e.track === 'hat').length;
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1); o.render = {peak: M.truePeak([L, Rr]), padRise: 0};
  { const p = (await renderSong(song, {solo: ['pad'], tail: .1})).getChannelData(0); o.render.padRise = 20*Math.log10(rms(p, 3.2, 3.9)/rms(p, .2, .9)); }
  // automation: a sine's level following a lane, and an LFO modulator on its pan
  { const s2 = {bpm: 120, tracks: [{id: 'a', inst: {type: 'analog'}, p: {}, clips: {a: {bars: 4, notes: [[0, 'A3', 63]]}}, mix: {}}], master: {chain: []},
      scenes: [{id: 's', clips: {a: 'a'}}], arrange: [['s', 4]], auto: [{target: 'a.vol', points: [[0, -30], [4, 0]]}], mods: [{target: 'a.pan', shape: 'Square', rate: '1 bar', depth: 1}]};
    s2.tracks[0].inst = {type: 'analog', p: {w1: 'Sine', cut: 8000, fenv: 0, as: 1, aa: .01}};
    const b = await renderSong(s2, {tail: 0}), l = b.getChannelData(0), rr = b.getChannelData(1);
    o.auto = {rise: 20*Math.log10((rms(l, 7, 7.5) + rms(rr, 7, 7.5))/(rms(l, .5, 1) + rms(rr, .5, 1))), pan: [rms(l, .6, .9)/rms(rr, .6, .9), rms(l, 1.6, 1.9)/rms(rr, 1.6, 1.9)]}; }
  // WAV and zip
  const w = new Uint8Array(await wav(buf).arrayBuffer()), z = new Uint8Array(await zip([{name: 'a.wav', data: w}, {name: 'a.json', data: '{}'}]).arrayBuffer());
  o.files = {riff: String.fromCharCode(...w.slice(0, 4)) + String.fromCharCode(...w.slice(8, 12)), size: w.length === 44 + buf.length*4, zip: z[0] === 0x50 && z[1] === 0x4b && z.length > w.length};
  return o;
});
check('note names: C4 is 60, sharps and flats, numbers and drum voices pass through', f2(r.notes) === f2([60, 33, 54, 46, 40, 'kick']), f2(r.notes));
check('a drum row: rests, hits, accents, chance and ratchets', f2(r.row) === f2({len: 12, ev: [[0, .85, 1], [3, .55, 1], [4, 1, 1], [6, .6, .5], [8, .56, 1], [11, .7, 1], [11.5, .56, 1]]}), f2(r.row));
check('a note clip: its length, chords, a slide held into the next note', r.clip.len === 12 && r.clip.n === 3 && Math.abs(r.clip.slide - 4.15) < .01 && f2(r.clip.chord) === '[60,64]', f2(r.clip));
check('check() names what\'s wrong', ['no preset "Nope"', 'isn\'t a group', 'listens to "kick"', 'has no clip "y"', '"t", which isn\'t a scene'].every(s => r.bad.some(b => b.includes(s))), r.bad.join(' | '));
check('every song in src/studio/songs/ checks clean', r.songs.every(([, b]) => !b.length), f2(r.songs));
check('every analog preset sounds, stays under full scale and dies away', !r.presets.length, r.presets.join('; '));
check('unison spreads the stereo', r.width[0] < .01 && r.width[1] > .2, f2(r.width));
check('the paraphonic pad sounds its notes', r.para.a > r.para.off*4 && r.para.e > r.para.off*4, f2(r.para));
check('an LFO in time swings the cutoff', r.lfo > 1.3, r.lfo.toFixed(2));
check('legato glides to the next note without a new attack', r.legato.to > 5 && r.legato.dip > .8, f2(r.legato));
check('every FM preset sounds and dies away', !r.fm.length, r.fm.join('; '));
check('the FM\'s depth makes it brighter', r.fmIndex > 1.3, r.fmIndex.toFixed(2));
check('the Moog\'s worklet loads, and every preset sounds, dies away and carries no DC', r.moog.ok && !r.moog.bad.length, r.moog.bad.join('; '));
check('the Moog\'s emphasis rings at the cutoff', r.moog.ring[1] > r.moog.ring[0]*3, f2(r.moog.ring));
check('the Moog glides to an overlapping note', r.moog.glide > 5, r.moog.glide.toFixed(1));
check('the EQ: a 6 dB bell lifts its frequency 6 dB, a 24 dB cut takes 50 Hz down by far more', Math.abs(r.eq.bell - 6) < .5 && r.eq.cut < -40, f2(r.eq));
check('the compressor turns a loud tone down', r.comp < -6, r.comp.toFixed(1));
check('the sidechain ducks by its depth right after the kick, and is back before the next', r.sc.dip < -9 && r.sc.dip > -13 && Math.abs(r.sc.back) < 1, f2(r.sc));
check('the limiter keeps a signal 12 dB hot under its ceiling (true peak)', r.lim <= -.5 && r.lim > -2.5, r.lim.toFixed(2));
check('the Studio\'s compressor turns a tone down as Chromium\'s does (within 1.5 dB)', Math.abs(r.dyn2[0] - r.dyn2[1]) < 1.5 && r.dyn2[0] < -1, f2(r.dyn2));
check('a sound through a whole song\'s mixer comes out in under 7 ms (only the limiter looks ahead, 1.5 ms)', r.lat >= 0 && r.lat < 7, r.lat.toFixed(1) + ' ms');
check('the multiband\'s bands sum back flat with nothing on', r.mbFlat < .2, r.mbFlat.toFixed(2));
check('the multiband turns its loud low band down by its ratio and leaves the highs', r.mb.low < -15 && Math.abs(r.mb.high) < .5, f2(r.mb));
check('a band\'s drive adds harmonics', r.mbDrive > -30, r.mbDrive.toFixed(1));
check('the dynamic EQ cuts a loud tone by its range and leaves a quiet one', Math.abs(r.dyn[0] + 6) < .7 && Math.abs(r.dyn[1]) < .3, f2(r.dyn));
check('the mid/side EQ passes a mono sound untouched and cuts the sides\' low end', Math.abs(r.msMono[0]) < .1 && Math.abs(r.msMono[1]) < .1 && r.msSide < -30, f2([r.msMono, r.msSide]));
check('tape adds the second harmonic and keeps the level; console only odd ones', r.tape.h2 > -30 && Math.abs(r.tape.lvl) < 1.5 && r.cons.h2 < -80 && r.cons.h3 > -35, f2([r.tape, r.cons]));
check('the transient shaper lifts the attack, or the sustain, by its amount', Math.abs(r.tr.atk[0] - 9) < 1 && Math.abs(r.tr.atk[1]) < 1 && Math.abs(r.tr.sus[0]) < 1 && r.tr.sus[1] > 5, f2(r.tr));
check('width by band: mono reads as no sides, two unrelated channels as wide', r.sb.mono < -60 && r.sb.wide > -3 && r.sb.corr[0] > .99 && Math.abs(r.sb.corr[1]) < .1, f2(r.sb));
check('masking: two tones in the same band at once clash; the hats above don\'t', f2(r.mask) === '["bass/pad:low-mid"]', f2(r.mask));
check('a reference compared: brighter and wider than a dark mono reference, and the match EQ leans darker', r.cmp.air > 6 && r.cmp.tilt > 1 && r.cmp.side > 20 && r.cmp.eq[5] < 0 && r.cmp.adv > 1, f2(r.cmp));
check('the kicks land on the sixteenths, the off ones swung late', r.sched.kicks === 8 + 16 && r.sched.onGrid < 1e-6 && r.sched.swing.length && r.sched.swing.every(x => Math.abs(x - .2) < .01), f2(r.sched));
check('chance: about half the ?-hats play, and the same ones every render', r.sched.hats > 8 && r.sched.hats < 24 && r.sched.again === r.sched.hats, `${r.sched.hats} and ${r.sched.again}`);
check('a 12-step clip goes round every 12 sixteenths (polymeter)', f2(r.sched.poly) === f2([0, 5, 12, 17, 24, 29]), f2(r.sched.poly));
check('a short song renders under its ceiling, the automation bringing the pad up', r.render.peak < -.5 && r.render.padRise > 20, f2(r.render));
check('a lane moves the volume, a square LFO swings the pan right then left', r.auto.rise > 20 && r.auto.pan[0] < .33 && (r.auto.pan[1] === null || r.auto.pan[1] > 3), f2(r.auto));
check('WAV and zip files are made right', r.files.riff === 'RIFFWAVE' && r.files.size && r.files.zip, f2(r.files));

// the page, playing
const p = await page.evaluate(async () => {
  const ev = await import('/src/audio/engine/events.js'), got = []; ev.onNote(e => { if (e.src === 'studio') got.push(e); });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#play').click(); await wait(2500);
  const st = window.__studio, pl = st.player, E = pl.E; let meter = {peak: -90}; for (let k = 0; k < 20; k++) { const m = E.desk.meter('drums:kick', .05); if (m && m.now > meter.peak) meter = {peak: m.now}; await wait(50); }
  const before = Math.floor(pl.pos()); pl.launch('break'); const queued = E.session.next;
  await wait(2500); const n = Math.floor(pl.pos()), sw = E.session.at;
  const f = document.querySelector('.strip[data-id=bass] input.fader'); f.value = -12; f.dispatchEvent(new Event('input'));
  const vol = st.song.tracks.find(t => t.id === 'bass').mix.vol;
  document.querySelector('#stop').click();
  return {notes: got.length, meter: meter && meter.peak, queued, before, sw, n, scene: E.sceneAt(n), vol};
});
check('the page plays: notes reach the note bus, and the meters move', p.notes > 10 && p.meter > -40, `${p.notes} notes, kick meter ${p.meter && p.meter.toFixed(1)} dB`);
check('a launched scene starts on the next bar', p.queued === 'break' && p.sw % 16 === 0 && p.sw > p.before && p.sw <= p.before + 16 && p.scene === 'break', f2(p));
check('a fader writes into the song', p.vol === -12, '' + p.vol);
// making things: a click launches one clip (only that cell lights); a step clicked on edits the clip; a new song, recorded
// into from the play view's pads and keys, saved to the library and added back
const q = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), st = window.__studio, o = {};
  localStorage.removeItem('afterglow.studio.loops');
  document.querySelector('.ses .clip[data-track=bass][data-row=dub]').click(); await wait(2600);
  const pl = st.player, n = Math.floor(pl.pos());
  o.launched = {bass: pl.E.clipOf('bass', n), drums: pl.E.clipOf('drums', n), lit: [...document.querySelectorAll('.ses .clip.live')].map(b => b.dataset.track + '/' + b.dataset.row)};
  pl.stop();
  document.querySelector('.strip[data-id=drums] .nm').click(); await wait(100);
  const rows = () => st.song.tracks[0].clips[document.querySelector('.clipbar .ct').textContent.match(/Clip (\S+)/)[1]].hits;
  const before = JSON.stringify(rows()); document.querySelector('.steps .row button[data-i="2"]').click(); await wait(50); o.stepEdit = JSON.stringify(rows()) !== before;
  // a note added on the roll
  document.querySelector('.strip[data-id=bass] .nm').click(); await wait(100);
  const cv = document.querySelector('canvas.roll'), r = cv.getBoundingClientRect(), nb = st.song.tracks.find(t => t.id === 'bass').clips.a.notes.length;
  cv.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: r.left + r.width*.53, clientY: r.top + r.height*.3, pointerId: 3}));
  cv.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: r.left + r.width*.6, clientY: r.top + r.height*.3, pointerId: 3}));
  cv.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: r.left + r.width*.6, clientY: r.top + r.height*.3, pointerId: 3}));
  o.rollAdd = st.song.tracks.find(t => t.id === 'bass').clips.a.notes.length - nb;
  // a new song, the play view: record claps and two bass notes while it plays
  document.querySelector('#newSong').click(); await wait(100); document.querySelector('#playView').click(); await wait(100);
  document.querySelector('#pvPlay').click(); await wait(900); document.querySelector('#pvRec').click();
  const pad = [...document.querySelectorAll('.pvpad')].find(b => b.textContent === 'Clap');
  for (let i = 0; i < 3; i++) { pad.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: 10, clientY: 10, pointerId: 5})); await wait(300); }
  [...document.querySelectorAll('.pvt')][1].click(); await wait(100);
  const area = document.querySelector('#pvPlayArea'), keys = document.querySelectorAll('.pvkey');
  for (const k of [keys[8], keys[10]]) { const b = k.getBoundingClientRect(), opt = {bubbles: true, clientX: b.left + 5, clientY: b.top + 5, pointerId: 6};
    area.dispatchEvent(new PointerEvent('pointerdown', opt)); await wait(260); area.dispatchEvent(new PointerEvent('pointerup', opt)); await wait(150); }
  const s = st.song; o.rec = {clap: (s.tracks[0].clips.a.hits.clap || '').replace(/\./g, '').length, bass: s.tracks[1].clips.a.notes.length};
  document.querySelector('#pvClose').click(); st.player.stop();
  // saved, then added to the song again
  document.querySelector('.strip[data-id=bass] .nm').click(); await wait(50);
  document.querySelector('#libName').value = 'test loop'; document.querySelector('#saveClip').click(); await wait(200);
  o.lib = [...document.querySelectorAll('#libList li b')].map(b => b.textContent);
  const nClips = Object.keys(s.tracks[1].clips).length; [...document.querySelectorAll('#libList li button')].find(b => b.textContent === 'Add').click(); await wait(200);
  o.added = Object.keys(s.tracks[1].clips).length - nClips;
  localStorage.removeItem('afterglow.studio.loops');
  return o;
});
check('a click launches one clip on the next bar, and only its cell lights', q.launched.bass === 'a' && !q.launched.drums && f2(q.launched.lit) === '["bass/dub"]', f2(q.launched));
check('a step clicked on edits the drum clip; a click and drag on the roll adds a note', q.stepEdit && q.rollAdd === 1, f2([q.stepEdit, q.rollAdd]));
check('the play view records pads and keys into the clips while it plays', q.rec.clap >= 2 && q.rec.bass === 2, f2(q.rec));
check('a clip saved to the library comes back as a new clip', f2(q.lib) === '["test loop"]' && q.added === 1, f2([q.lib, q.added]));
// the mixing tools in the page: devices added to a strip while it plays (each its card), a knob on one written into the
// song, one removed; the goniometer drawing; a reference measured and shown; the clash finder on a short song
const mx = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), st = window.__studio, o = {};
  st.load(0); document.querySelector('#play').click(); await wait(1200);
  document.querySelector('.strip[data-id=bass] .nm').click(); await wait(100);
  const T = () => st.song.tracks.find(t => t.id === 'bass'), n0 = T().mix.chain.length;
  for (const k of ['multiband', 'dyneq', 'mseq', 'transient', 'tape', 'console']) { const sel = document.querySelector('select.adddev'); sel.value = k; sel.dispatchEvent(new Event('change')); await wait(250); }
  o.added = T().mix.chain.slice(n0).map(x => x.type);
  o.cards = [...document.querySelectorAll('.detail .card h4 span:first-child')].map(e => e.textContent).slice(-6);
  st.player.E.set('bass.' + (n0) + '.0.thr', -30); o.mbThr = T().mix.chain[n0].bands[0].thr;
  const cc = [...document.querySelectorAll('.detail .card')].find(c => /Console/.test(c.textContent)), rm = cc.querySelector('.devtools button:last-child'); rm.click(); rm.click(); await wait(200);
  o.removed = !T().mix.chain.some(x => x.type === 'console'); o.playing = st.player.playing;
  await wait(1500); const g = document.querySelector('#gonio').getContext('2d').getImageData(0, 0, 220, 220).data; let lit = 0; for (let i = 0; i < g.length; i += 4) if (g[i + 2] > 120) lit++; o.gonio = lit;
  document.querySelector('#stop').click();
  const b = new AudioBuffer({numberOfChannels: 2, length: 44100*4, sampleRate: 44100}); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2 - 1)*.3; }
  st.setRef(b, 'noise'); o.ref = [st.song.ref.name, /noise: .*LUFS/.test(document.querySelector('#refRep').textContent)];
  const {clashes} = await import('/src/studio/clash.js');
  const tiny = {title: 'c', bpm: 120, tracks: [{id: 'a', inst: {type: 'analog', p: {w1: 'Sine', cut: 8000, fenv: 0, as: 1}}, clips: {a: {notes: [[0, 'G3', 16]]}}}, {id: 'b', inst: {type: 'analog', p: {w1: 'Sine', cut: 8000, fenv: 0, as: 1}}, clips: {a: {notes: [[0, 'A3', 16]]}}}],
    master: {chain: []}, scenes: [{id: 's', clips: {a: 'a', b: 'a'}}], arrange: [['s', 2]]};
  const c = await clashes(tiny); o.clash = c.list.map(x => `${x.a}/${x.b}:${x.band}`);
  return o;
});
check('devices added to a strip while it plays, each with its card', f2(mx.added) === '["multiband","dyneq","mseq","transient","tape","console"]' && mx.cards.join() === 'Multiband,Dynamic EQ,Mid/side EQ,Transient shaper,Tape,Console' && mx.playing, f2([mx.added, mx.cards]));
check('a multiband knob is written into the song; a device removed', mx.mbThr === -30 && mx.removed, f2([mx.mbThr, mx.removed]));
check('the goniometer draws the master', mx.gonio > 10, '' + mx.gonio);
check('a reference is measured and kept with the song', mx.ref[0] === 'noise' && mx.ref[1], f2(mx.ref));
check('the clash finder finds two tones in the same band', f2(mx.clash) === '["a/b:mid"]' || f2(mx.clash) === '["a/b:low-mid"]', f2(mx.clash));
// the clip editor: a row's length (a polyrhythm), its velocity lane drawn rising, a groove shape, a row added, the clip's
// length, a volume envelope drawn, a note's velocity; and everything still plays
const ed = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), st = window.__studio, o = {};
  st.load(0); document.querySelector('.strip[data-id=drums] .nm').click(); await wait(100);
  const id = document.querySelector('.clipbar .ct').textContent.match(/Clip (\S+)/)[1], C = () => st.song.tracks[0].clips[id];
  const head = [...document.querySelectorAll('.rhead')].find(x => /Closed/.test(x.textContent)), ln = head.querySelector('.rlen'); ln.value = '5'; ln.dispatchEvent(new Event('change')); await wait(30);
  o.len5 = C().hits.chh.replace(/[|\s]/g, '').length;
  [...document.querySelectorAll('.rhead .rn')].find(b => /Open/.test(b.textContent)).click(); await wait(30);
  const drag = (el, pts, pid) => { const b = el.getBoundingClientRect(), ev = (t, [x, y]) => el.dispatchEvent(new PointerEvent(t, {bubbles: true, clientX: b.left + x*b.width, clientY: b.top + y*b.height, pointerId: pid}));
    ev('pointerdown', pts[0]); for (const p of pts.slice(1)) ev('pointermove', p); ev('pointerup', pts[pts.length - 1]); };
  drag(document.querySelector('.row.lane:not(.env)'), Array.from({length: 21}, (_, i) => [Math.min(.99, .01 + i/20), Math.max(.01, .99 - i/20)]), 5); await wait(30);
  const v = C().hits.ohh.replace(/[|\s]/g, '').split('').filter(c => /[1-9]/.test(c)).map(Number); o.rising = v.length > 1 && v.every((x, i) => !i || x >= v[i - 1]) && v[v.length - 1] > v[0];
  const gs = document.querySelector('select.groove'); gs.value = 'Ghosts between'; gs.dispatchEvent(new Event('change')); await wait(30); o.groove = C().hits.ohh;
  const add = document.querySelector('select.radd'); add.value = add.options[1].value; add.dispatchEvent(new Event('change')); await wait(30); o.added = C().hits[add.options[1] ? add.value : ''] != null || Object.keys(C().hits).length;
  const cl = document.querySelector('select.clen'); cl.value = '48'; cl.dispatchEvent(new Event('change')); await wait(30); o.bars = C().bars;
  document.querySelector('.envtg').click(); await wait(30); drag(document.querySelector('.row.lane.env'), [[.01, .05], [.5, .95]], 6); await wait(30); o.env = (C().auto || {}).vol;
  document.querySelector('.strip[data-id=bass] .nm').click(); await wait(100);
  const nl = document.querySelector('.row.lane:not(.env)'), bc = st.song.tracks.find(t => t.id === 'bass').clips.a, first = Math.floor((Array.isArray(bc.notes[0]) ? bc.notes[0][0] : bc.notes[0].t));
  drag(nl, [[(first + .5)/nl.children.length, .5]], 7); await wait(30); o.noteVel = (Array.isArray(bc.notes[0]) ? bc.notes[0][3] : bc.notes[0].v);
  document.querySelector('#play').click(); await wait(1500); o.playing = st.player.playing; document.querySelector('#stop').click();
  st.reset(); await wait(50);
  return o;
});
check('a drum row set to 5 steps (a polyrhythm against the 16)', ed.len5 === 5, '' + ed.len5);
check('the velocity lane drawn rising sets rising velocities; a groove shape applies to the hits', ed.rising && /[1-9]/.test(ed.groove), f2([ed.rising, ed.groove]));
check('a row added and the clip set to 3 bars', !!ed.added && ed.bars === 3, f2([ed.added, ed.bars]));
check('a volume envelope drawn into the clip, falling', ed.env && ed.env.length >= 2 && ed.env[0][1] > ed.env[ed.env.length - 1][1], f2(ed.env));
check('a note\'s velocity set from its lane, and the song still plays', Math.abs(ed.noteVel - .5) < .06 && ed.playing, f2([ed.noteVel, ed.playing]));
// the improviser, by itself: the same seed makes the same part; every style's bass stays off the kick and in the key; the
// expression widens the hats' dynamics; the hypnotic style loops at odd lengths; chords leave the bass's steps free; a
// hook walks rather than leaps; a variation moves the hats and keeps the kick
{
  const I = await import('../src/studio/improv.js'), K = I.keyOf('D minor'), inKey = n => K.scale.includes(((n - K.root) % 12 + 12) % 12), o = {bad: []};
  o.same = JSON.stringify(I.makeDrums({style: 'driving', seed: 4})) === JSON.stringify(I.makeDrums({style: 'driving', seed: 4})) && JSON.stringify(I.makeDrums({style: 'driving', seed: 4})) !== JSON.stringify(I.makeDrums({style: 'driving', seed: 5}));
  for (const style of Object.keys(I.STYLES)) for (const seed of [1, 2, 3, 4, 5]) {
    const d = I.makeDrums({style, seed, energy: .6}), g = I.grooveOf(d), b = I.makeBass({style, seed, key: 'D minor', groove: g, energy: .6});
    if (!g.kick.size) o.bad.push(`${style}/${seed}: no kick`);
    const on = b.notes.filter(n => g.kick.has(Math.floor(n[0]) % 16)).length;
    if (style !== 'acid' && on) o.bad.push(`${style}/${seed}: ${on} bass notes on the kick`);
    if (b.notes.length < (style === 'dub' ? 1 : 3)) o.bad.push(`${style}/${seed}: ${b.notes.length} bass notes`);
    if (!b.notes.every(n => inKey(n[1]))) o.bad.push(`${style}/${seed}: a bass note out of key`);
    const c = I.makeChords({style, seed, key: 'D minor', bass: b.notes, energy: .6}), bs = new Set(b.notes.map(n => Math.floor(n[0]) % 16));
    if (style !== 'hypnotic' && c.notes.some(n => n[2] < 4 && bs.has(n[0] % 16))) o.bad.push(`${style}/${seed}: a stab on a bass note`);
    const h = I.makeHook({style, seed, key: 'D minor'}).notes; if (!h.every(n => inKey(n[1])) || h.some((n, i) => i && Math.abs(n[1] - h[i - 1][1]) > 9)) o.bad.push(`${style}/${seed}: the hook leaps or leaves the key`);
  }
  const spread = x => new Set(I.makeDrums({style: 'driving', seed: 2, expr: x}).hits.chh.replace(/[^1-9]/g, '')).size;
  o.dyn = [spread(0), spread(1)];
  const hy = I.makeDrums({style: 'hypnotic', seed: 3}), hb = I.makeBass({style: 'hypnotic', seed: 3, groove: I.grooveOf(hy)});
  o.hyp = [hy.hits.chh.length, hb.steps];
  const d0 = I.makeDrums({style: 'driving', seed: 6}), v = I.vary(d0, {seed: 9, amount: .5}); o.vary = [v.hits.kick === d0.hits.kick, v.hits.chh !== d0.hits.chh];
  check('the improviser: the same seed makes the same part, another seed another', o.same, '');
  check('every style\'s bass stays off the kick and in the key; chords leave its steps free; hooks walk in the key', !o.bad.length, o.bad.slice(0, 6).join('; '));
  check('the expression widens the hats\' dynamics', o.dyn[1] > o.dyn[0] && o.dyn[1] >= 4, f2(o.dyn));
  check('the hypnotic style loops its hats and bass at odd lengths against the bar', o.hyp[0] !== 16 && o.hyp[0] < 32 && [7, 10, 12].includes(o.hyp[1]), f2(o.hyp));
  check('a variation keeps the kick and moves the hats', o.vary[0] && o.vary[1], f2(o.vary));
}
// jamming in the page: Start a jam makes a song and plays its drums and bass; new hats keep the kick; a kick moved by hand
// and the bass refits round it; chords and a hook join; Evolve changes the parts on the next four-bar line
const jm = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), st = window.__studio, o = {}, {onNote} = await import('/src/audio/engine/events.js');
  const heard = []; onNote(e => { if (e.src === 'studio') heard.push(e.ch); });
  document.querySelector('#jamStyle').value = 'driving'; document.querySelector('#jamStyle').dispatchEvent(new Event('change'));
  document.querySelector('#jamStart').click(); await wait(2500);
  const S = st.song, D = S.tracks.find(t => t.id === 'drums'), B = S.tracks.find(t => t.id === 'bass');
  const kicks = () => new Set([...D.clips.jam.hits.kick.replace(/[|\s]/g, '')].map((c, i) => c !== '.' ? i % 16 : -1).filter(i => i >= 0));
  o.start = {title: S.title, bpm: S.bpm, playing: st.player.playing, bass: B.clips.jam.notes.length, onKick: B.clips.jam.notes.filter(n => kicks().has(Math.floor(n[0]) % 16)).length, heard: heard.length};
  const chh = D.clips.jam.hits.chh; document.querySelector('[data-jam=hats]').click(); await wait(100); o.hats = D.clips.jam.hits.chh !== chh && /9/.test(D.clips.jam.hits.kick);
  const b0 = JSON.stringify(B.clips.jam.notes); [...document.querySelectorAll('.steps .row')][0].querySelector('button[data-i="6"]').click(); await wait(100);
  o.follow = JSON.stringify(B.clips.jam.notes) !== b0 && B.clips.jam.notes.filter(n => kicks().has(Math.floor(n[0]) % 16)).length === 0;
  document.querySelector('[data-jam=chords]').click(); document.querySelector('[data-jam=hook]').click(); await wait(100);
  o.parts = Object.values(st.jam.parts).map(p => p.part).sort();
  const LOG = []; for (const k of ['play', 'stop']) { const f = st.player[k].bind(st.player); st.player[k] = (...a) => { LOG.push(k + ' ' + (new Error().stack.split('\n').slice(2, 5).map(x => x.trim()).join(' < '))); return f(...a); }; }
  const ns = []; const iv = setInterval(() => ns.push(st.player.E.n), 500);
  document.querySelector('#jamEvolve').click(); const before = JSON.stringify(S.tracks.map(t => t.clips.jam)); await wait(9500);
  clearInterval(iv); o.log = LOG; o.ns = ns.join(',');
  o.evolved = JSON.stringify(S.tracks.map(t => t.clips.jam)) !== before;
  o.diag = {evolve: st.jam.evolve, phrase: st.jam.phrase, n: st.player.E.n, playing: st.player.playing, checked: document.querySelector('#jamEvolve').checked, same: st.song === S};
  document.querySelector('#jamEvolve').click(); document.querySelector('#stop').click();
  return o;
});
check('Start a jam: a new song, its drums and bass playing, the bass off the kick', /jam/.test(jm.start.title) && jm.start.playing && jm.start.bass > 3 && jm.start.onKick === 0 && jm.start.heard > 10, f2(jm.start));
check('new hats over the drums keep the kick; a kick moved by hand and the bass refits round it', jm.hats && jm.follow, f2([jm.hats, jm.follow]));
check('chords and a hook join the jam, and Evolve varies the parts on the four-bar line', f2(jm.parts) === '["bass","chords","hats","hook"]' && jm.evolved, f2([jm.parts, jm.evolved, jm.diag, jm.log, jm.ns]));
// the user's changes to a song are kept: an edit, saved, is there after a reload, with their own new song as a tab; Revert
// goes back to the song as written
const sv = await page.evaluate(async () => {
  const st = window.__studio, o = {};
  st.load(0); st.song.tracks[1].mix.vol = -7.5; await st.saveNow();
  o.status = document.querySelector('#saved').textContent; o.revert = !document.querySelector('#revert').hidden;
  return o;
});
await page.reload(); await page.waitForFunction(() => window.__studio && /Saved|As written/.test(document.querySelector('#saved').textContent));
const sv2 = await page.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), st = window.__studio, o = {};
  o.vol = st.song.tracks[1].mix.vol; o.tabs = [...document.querySelectorAll('#songs button')].map(b => b.textContent); o.builtIn = (await import('/src/studio/songs/index.js')).SONGS.length;
  const b = document.querySelector('#revert'); b.click(); b.click(); await wait(100);
  o.after = st.song.tracks[1].mix.vol; o.stored = Object.keys(JSON.parse(localStorage.getItem('afterglow.studio.songs') || '{}'));
  o.status = document.querySelector('#saved').textContent;
  localStorage.removeItem('afterglow.studio.songs');
  return o;
});
check('an edit to a song is saved, and is there after a reload', /Saved/.test(sv.status) && sv.revert && sv2.vol === -7.5, f2([sv, sv2.vol]));
check('the songs made here come back as tabs after a reload', sv2.tabs.length === sv2.builtIn + 2 && sv2.tabs.some(t => /My song/.test(t)) && sv2.tabs.some(t => /jam/.test(t)), f2(sv2.tabs));
check('Revert goes back to the song as written and forgets the saved one', sv2.after !== -7.5 && !sv2.stored.includes('night-shift') && sv2.status === 'As written', f2(sv2));
const errs = errors.filter(e => !/Failed to load resource/.test(e));
check('no page errors', !errs.length, errs.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
