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
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1); o.render = {peak: M.truePeak([L, Rr]), padRise: rms(L, 3.2, 3.9) > rms(L, .2, .9)};
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
check('the EQ: a 6 dB bell lifts its frequency 6 dB, a 24 dB cut takes 50 Hz down by far more', Math.abs(r.eq.bell - 6) < .5 && r.eq.cut < -40, f2(r.eq));
check('the compressor turns a loud tone down', r.comp < -6, r.comp.toFixed(1));
check('the sidechain ducks by its depth right after the kick, and is back before the next', r.sc.dip < -9 && r.sc.dip > -13 && Math.abs(r.sc.back) < 1, f2(r.sc));
check('the limiter keeps a signal 12 dB hot under its ceiling (true peak)', r.lim <= -.5 && r.lim > -2, r.lim.toFixed(2));
check('the kicks land on the sixteenths, the off ones swung late', r.sched.kicks === 8 + 16 && r.sched.onGrid < 1e-6 && r.sched.swing.length && r.sched.swing.every(x => Math.abs(x - .2) < .01), f2(r.sched));
check('chance: about half the ?-hats play, and the same ones every render', r.sched.hats > 8 && r.sched.hats < 24 && r.sched.again === r.sched.hats, `${r.sched.hats} and ${r.sched.again}`);
check('a 12-step clip goes round every 12 sixteenths (polymeter)', f2(r.sched.poly) === f2([0, 5, 12, 17, 24, 29]), f2(r.sched.poly));
check('a short song renders under its ceiling, the automation bringing the pad up', r.render.peak < -.5 && r.render.padRise, f2(r.render));
check('a lane moves the volume, a square LFO swings the pan right then left', r.auto.rise > 20 && r.auto.pan[0] < .33 && (r.auto.pan[1] === null || r.auto.pan[1] > 3), f2(r.auto));
check('WAV and zip files are made right', r.files.riff === 'RIFFWAVE' && r.files.size && r.files.zip, f2(r.files));

// the page, playing
const p = await page.evaluate(async () => {
  const ev = await import('/src/audio/engine/events.js'), got = []; ev.onNote(e => { if (e.src === 'studio') got.push(e); });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#play').click(); await wait(2500);
  const st = window.__studio, pl = st.player, E = pl.E, meter = E.desk.meter('kick');
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
const errs = errors.filter(e => !/Failed to load resource/.test(e));
check('no page errors', !errs.length, errs.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
