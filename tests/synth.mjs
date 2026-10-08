// The polysynth (audio/engine/inst/poly.js), rendered offline and measured: every preset sounds without clipping and
// falls silent after its release; the supersaw is wide and a mono bass isn't; a chord sounds its notes; a pluck's
// filter closes; legato glides to the next note without a new attack, and mono plays one note at a time; velocity
// sets the level; the LFO moves the volume; a ninth note takes the oldest voice. Then in the page: the Synth section
// opens, its keyboard plays, the arpeggiator steps in time, the groovebox's bass plays on it, and the computer's keys
// play it without reaching the page's own.
// Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('synth: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']);
const page = await openPage(browser, url, {width: 1000, height: 700, groove: false, noDraw: true});
const r = await page.evaluate(async () => {
  const {makePoly, PRESETS, DEF} = await import('/src/audio/engine/inst/poly.js');
  const SR = 44100, hz = n => 440*Math.pow(2, (n - 69)/12);
  async function render(p, play, secs = 2){
    const ctx = new OfflineAudioContext(2, Math.round(SR*secs), SR), s = makePoly(ctx, ctx.destination); s.load(p); play(s);
    const b = await ctx.startRendering(); return [b.getChannelData(0), b.getChannelData(1), s];
  }
  const rms = (d, a, b) => { let s = 0; for (let i = Math.round(a*SR); i < Math.min(d.length, Math.round(b*SR)); i++) s += d[i]*d[i]; return Math.sqrt(s/Math.max(1, Math.round((b - a)*SR))); };
  const peak = d => d.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const tone = (d, f, a, b) => { const w = 2*Math.PI*f/SR; let s1 = 0, s2 = 0; for (let i = Math.round(a*SR); i < Math.round(b*SR); i++) { const s = d[i] + 2*Math.cos(w)*s1 - s2; s2 = s1; s1 = s; } return Math.hypot(s1 - Math.cos(w)*s2, Math.sin(w)*s2)/((b - a)*SR); };
  const bright = (d, a, b) => { let hi = 0, all = 0; for (let i = Math.round(a*SR) + 1; i < Math.round(b*SR); i++) { hi += (d[i] - d[i - 1])**2; all += d[i]**2; } return Math.sqrt(hi/all); };   // (more in the highs, more change sample to sample)
  const out = {presets: []};
  for (const [name, p] of Object.entries(PRESETS)) {
    const P = {...DEF, ...p}, off = Math.min(1.5, .3 + P.aa*1.2), secs = off + P.ar*2.2 + .6;
    const [L, R] = await render(P, s => s.play(60, .05, off), secs), pk = Math.max(peak(L), peak(R)), tail = rms(L, secs - .2, secs);
    const ok = pk > .03 && pk < 1.2 && L.every(Number.isFinite) && tail < pk*.003;
    if (!ok) out.presets.push(`${name}: peak ${pk.toFixed(2)}, tail ${tail.toExponential(1)}`);
  }
  // width: the supersaw differs left to right, the sub bass doesn't
  { const [L, R] = await render({...DEF, ...PRESETS['Supersaw lead']}, s => s.play(60, .05, 1), 1.2), [l2, r2] = await render({...DEF, ...PRESETS['Sub bass']}, s => s.play(48, .05, 1), 1.2);
    const w = (a, b) => { let d = 0, s = 0; for (let i = SR*.3; i < SR*.9; i++) { d += (a[i] - b[i])**2; s += (a[i] + b[i])**2; } return Math.sqrt(d/s); };
    out.width = {saw: w(L, R), sub: w(l2, r2)}; }
  // a chord: Minor 7 on C4 sounds E♭ and G, not D
  { const [L] = await render({...DEF, ...PRESETS['Stab chord'], ad: 1, as: 1, fenv: 0, cut: 6000}, s => s.play(60, .05, 1), 1.2);
    out.chord = {eb: tone(L, hz(63), .3, .9), g: tone(L, hz(67), .3, .9), d: tone(L, hz(62), .3, .9)}; }
  // a pluck: bright at first, dark a moment on
  { const [L] = await render({...DEF, ...PRESETS.Pluck, as: .5}, s => s.play(60, .05, 1), 1.2); out.pluck = {early: bright(L, .06, .1), late: bright(L, .5, .6)}; }
  // legato: a second note overlapping the first glides there, with no new attack; the first's release is taken back
  { const P = {...DEF, w1: 3, mix2: 0, chorus: 0, cut: 18000, fenv: 0, mode: 2, glide: .05, aa: .002, ad: .1, as: 1, ar: .05};
    const [L] = await render(P, s => { s.play(60, .1, .55); s.play(67, .5, .5); }, 1.3);
    out.legato = {to: tone(L, hz(67), .8, .95)/tone(L, hz(60), .8, .95), dip: rms(L, .5, .52)/rms(L, .44, .48), held: rms(L, .7, .9)/rms(L, .3, .45)}; }
  // mono: the second note cuts the first
  { const P = {...DEF, w1: 3, mix2: 0, chorus: 0, cut: 18000, fenv: 0, mode: 1, aa: .002, as: 1, ar: .05};
    const [L] = await render(P, s => { s.play(60, .1, 1); s.play(67, .4, .4); }, 1.2); out.mono = tone(L, hz(60), .5, .75)/tone(L, hz(67), .5, .75); }
  // velocity: softer is quieter
  { const [a] = await render({...DEF, vel: 1}, s => s.play(60, .05, .5, .2), .7), [b] = await render({...DEF, vel: 1}, s => s.play(60, .05, .5, 1), .7); out.vel = rms(a, .2, .4)/rms(b, .2, .4); }
  // the LFO on the volume, at 4 Hz: the level swings
  { const [L] = await render({...DEF, ldest: 2, lsync: 0, lrate: 4, lamt: 1, as: 1, chorus: 0}, s => s.play(60, .05, 1.5), 1.6);
    const w = []; for (let k = 0; k < 16; k++) w.push(rms(L, .4 + k*.05, .45 + k*.05)); out.lfo = Math.min(...w)/Math.max(...w); }
  // ten notes held: eight voices
  { const [, , s] = await render({...DEF, ar: 2}, s => { for (let k = 0; k < 10; k++) s.noteOn(48 + k, .8, .05 + k*.01); }, .5); out.voices = s.voices.filter(v => v.end === Infinity).length; }
  return out;
});
check('every preset sounds, doesn\'t clip, and falls silent after its release', !r.presets.length, r.presets.join('; '));
check('the supersaw is wide, a sub bass is mono', r.width.saw > .2 && r.width.sub < .02, `${r.width.saw.toFixed(3)} / ${r.width.sub.toFixed(3)}`);
check('a minor seventh chord sounds its notes', r.chord.eb > r.chord.d*5 && r.chord.g > r.chord.d*5, JSON.stringify(r.chord, (k, v) => typeof v === 'number' ? +v.toExponential(2) : v));
check('a pluck\'s filter closes', r.pluck.early > r.pluck.late*1.5, `${r.pluck.early.toFixed(3)} → ${r.pluck.late.toFixed(3)}`);
check('legato glides to the next note without a new attack, and holds through the first\'s release', r.legato.to > 5 && r.legato.dip > .8 && r.legato.held > .8, JSON.stringify(r.legato, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
check('mono plays one note at a time', r.mono < .05, r.mono.toFixed(3));
check('velocity sets the level', r.vel < .6, r.vel.toFixed(2));
check('the LFO swings the volume', r.lfo < .4, r.lfo.toFixed(2));
check('a ninth note takes the oldest voice: eight at most', r.voices === 8, '' + r.voices);

// in the page
const p = await page.evaluate(async () => {
  const keys = await import('/src/audio/keys.js'), ev = await import('/src/audio/engine/events.js'), J = (await import('/src/journey/core.js')).J, notes = [];
  ev.onNote(e => notes.push(e));
  document.querySelector('#djBtn').click(); document.querySelector('#dj .tab[data-t=syn]').click();
  const shown = !document.querySelector('#dj .syb').hidden && document.querySelectorAll('#dj .syb .knob').length;
  // the on-screen keyboard
  const k = document.querySelector('#dj .sk[data-n="52"]'), r0 = k.getBoundingClientRect(), opt = {bubbles: true, clientX: r0.x + r0.width/2, clientY: r0.bottom - 6, pointerId: 1};
  k.dispatchEvent(new PointerEvent('pointerdown', opt)); await new Promise(r => setTimeout(r, 150)); document.querySelector('#dj .skb').dispatchEvent(new PointerEvent('pointerup', opt));
  const played = notes.filter(e => e.src === 'synth').map(e => e.note);
  // the arpeggiator: two keys held, up, 1/16: the notes alternate on the master's 16ths
  keys.setArp('arp', 1); keys.setArp('div', 0); keys.keyDown(60); keys.keyDown(64); notes.length = 0;
  await new Promise(r => setTimeout(r, 1500)); keys.keyUp(60); keys.keyUp(64); keys.setArp('arp', 0);
  const {internal} = await import('/src/audio/engine/clock.js'), arp = notes.filter(e => e.src === 'synth');
  const on16 = arp.every(e => { const q = internal.beat(e.t)*4; return Math.abs(q - Math.round(q)) < 1e-3; }), alt = arp.every((e, i) => !i || e.note !== arp[i - 1].note);
  // the groovebox's bass on the synth
  const g = await import('/src/audio/groove.js'); g.loadPreset('Rolling acid'); g.GB.bassEng = 'synth'; notes.length = 0; g.grooveToggle(); await new Promise(r => setTimeout(r, 900));
  const s = keys.synth(), bassVoices = s.voices.length; g.grooveToggle(); g.GB.bassEng = 'acid';
  // the computer's keys: A plays C3 with Keys on, and the page's A (Journey on and off) doesn't fire
  const j0 = J.on; keys.SY.keys = true; notes.length = 0;
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'a', bubbles: true})); document.body.dispatchEvent(new KeyboardEvent('keyup', {key: 'a', bubbles: true}));
  const typed = notes.filter(e => e.src === 'synth').map(e => e.note), j1 = J.on; keys.SY.keys = false;
  return {shown, played, arpN: arp.length, on16, alt, bassVoices, bassNotes: notes.length, typed, journeyKept: j0 === j1};
});
check('the Synth section opens with its knobs, and its keyboard plays', p.shown > 30 && p.played.includes(52), `${p.shown} knobs, played ${p.played}`);
check('the arpeggiator steps on the master\'s 16ths, up through the keys held', p.arpN >= 8 && p.on16 && p.alt, `${p.arpN} notes, on 16ths ${p.on16}, alternating ${p.alt}`);
check('the groovebox\'s bass line plays on the synth', p.bassVoices > 0, `${p.bassVoices} voices`);
check('the computer\'s keys play it, and don\'t reach the page\'s own', p.typed.includes(48) && p.journeyKept, `${p.typed}, Journey kept ${p.journeyKept}`);

const errors = await page.errors();
check('no page errors', !errors.length, errors.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
