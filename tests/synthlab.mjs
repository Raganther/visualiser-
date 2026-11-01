// The analog synth (studio/lib/native/asynth.js), rendered offline and measured, then its playground
// (studio/synth/, built into studio/listen/synth-lab.html) played in the page. Usage: node tests/synthlab.mjs
import { serve, launch } from './lib.mjs';
import { synthRender, DEF, AnalogSynth } from '../studio/lib/native/asynth.js';
import { EXAMPLES } from '../studio/synth/examples.js';
import { execFileSync } from 'node:child_process';

let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const sr = 48000, hz = n => 440*Math.pow(2, (n - 69)/12);
// a windowed DFT's magnitude at f, over n samples from a
const mag = (x, f, a, n) => { let re = 0, im = 0; for (let i = a; i < a + n; i++) { const w = .5 - .5*Math.cos(2*Math.PI*(i - a)/n), p = 2*Math.PI*f*i/sr; re += x[i]*w*Math.cos(p); im += x[i]*w*Math.sin(p); } return Math.hypot(re, im); };
const peak = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i]*x[i]; return Math.sqrt(s/(b - a)); };
// the brightness: the spectrum's centre of weight, from 40 bins on octaves
const centroid = (x, a, n) => { let w = 0, s = 0; for (let k = 0; k < 40; k++) { const f = 50*Math.pow(2, k/4), m = mag(x, f, a, n); w += m; s += m*f; } return s/w; };
// how bright a note of f0 is: its 4th to 20th harmonics against its fundamental
const bright = (x, f0, a, n) => { let s = 0; for (let k = 4; k <= 20; k++) s += mag(x, k*f0, a, n); return s/mag(x, f0, a, n); };
// the pitch, from rising zero crossings
const pitch = (x, a, b) => { let first = -1, last = -1, c = 0; for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) { const t = i - x[i]/(x[i] - x[i - 1]); if (first < 0) first = t; last = t; c++; } return (c - 1)*sr/(last - first); };
// a bare oscillator: the filter open, nothing coloured, every voice alike
const RAW = {...DEF, cut: 18000, res: 0, fenv: 0, fkey: 0, fvel: 0, drive: 0, l2: 0, slop: 0, vdrive: 0, chorus: 0, emix: 0, as: 1, avel: 0, level: 1, spread: 0};
const note = (n, len = 1, t = 0, vel = .8) => ({t, len, n, vel});

/* ---------- the oscillators ---------- */
{ // band-limited: a high saw's aliases well below the plain one's (that would fold back from every harmonic past Nyquist)
  const f0 = hz(100), alias = x => { let h = 0, a = 0; for (let k = 1; k*f0 < 20000; k++) h += mag(x, k*f0, 12000, 16384)**2;
    for (let f = 200; f < 20000; f += 37.3) { const near = Math.abs(f/f0 - Math.round(f/f0))*f0; if (near > 60) a += mag(x, f, 12000, 16384)**2; } return 10*Math.log10(a/h); };
  const naive = new Float32Array(48000); let t = 0; for (let i = 0; i < naive.length; i++) { naive[i] = 2*t - 1; t = (t + f0/sr) % 1; }
  const out = {naive: alias(naive)}; for (const [w, name] of [[0, 'saw'], [1, 'pulse'], [2, 'triangle']]) out[name] = alias(synthRender(sr, {...RAW, w1: w}, [note(100)], 1).L);
  check('the oscillators are band-limited: a saw at 2.6 kHz aliases 15 dB less than a plain one, the pulse too, the triangle hardly at all', out.saw < out.naive - 15 && out.pulse < out.naive - 12 && out.triangle < -60,
    Object.entries(out).map(([k, v]) => `${k} ${v.toFixed(1)} dB`).join(', '));
  // hard sync: oscillator 2 a fifth up, reset each time 1 wraps, so its pitch is 1's
  const s = synthRender(sr, {...RAW, l1: 0, l2: 1, w2: 2, sync: 1, semi2: 7}, [note(57)], 1).L, f = hz(57), fund = mag(s, f, 12000, 16384), fifth = mag(s, f*1.5, 12000, 16384);
  check('hard sync locks oscillator 2 to 1: its fundamental is 1\'s, the fifth it was tuned to gone', fund > 3*fifth, `${fund.toFixed(0)} against ${fifth.toFixed(0)}`);
  // the sub: an octave below oscillator 1, and two with Sub octave −2
  const sub = o => { const x = synthRender(sr, {...RAW, l1: 0, lsub: 1, subo: o}, [note(57)], 1).L; return pitch(x, 10000, 40000); };
  const s1 = sub(0), s2 = sub(1); check('the sub plays an octave down, or two', Math.abs(s1 - 110) < 1 && Math.abs(s2 - 55) < 1, `${s1.toFixed(1)} Hz, ${s2.toFixed(1)} Hz`);
  // ring modulation: the sum and difference of the two, neither of the two themselves
  const r = synthRender(sr, {...RAW, w1: 3, w2: 3, l1: 0, lring: 1, semi2: 7, fine2: 0}, [note(69)], 1).L, a = 440, b = 440*Math.pow(2, 7/12);
  check('the ring modulator makes the sum and difference of the two oscillators, not either', mag(r, a + b, 12000, 16384) > 10*mag(r, a, 12000, 16384) && mag(r, b - a, 12000, 16384) > 10*mag(r, b, 12000, 16384)); }

/* ---------- the filter ---------- */
{ const sv = (P, n = 45) => { const {L} = synthRender(sr, {...RAW, w1: 0, ...P}, [note(n, 1.5)], 1.5); return L; };
  const dark = centroid(sv({cut: 300}), 20000, 16384), open = centroid(sv({cut: 4000}), 20000, 16384);
  check("the cutoff darkens the sound", dark < open*.5, `${Math.round(dark)} Hz at 300, ${Math.round(open)} Hz at 4 kHz`);
  // resonance: a peak at the cutoff; at the top the ladder sings on its own, at the cutoff, and stays within full scale
  const res = sv({cut: 1000, res: .85}), flat = sv({cut: 1000, res: 0}), ratio = (x => mag(x, 1000, 20000, 16384)/mag(x, 330, 20000, 16384));
  check('resonance lifts the cutoff', ratio(res) > 4*ratio(flat), `${ratio(res).toFixed(2)} against ${ratio(flat).toFixed(2)}`);
  const so = synthRender(sr, {...RAW, l1: 0, lnoise: .02, res: 1, cut: 1000, fkey: 0}, [note(60, 1.5)], 1.5).L; let best = 0, bf = 0;
  for (let f = 500; f < 2000; f += 10) { const m = mag(so, f, 30000, 16384); if (m > best) { best = m; bf = f; } }
  check('at full resonance the ladder self-oscillates at its cutoff, within full scale', Math.abs(bf - 1000) < 40 && peak(so, 30000) > .05 && peak(so) <= 1, `${bf} Hz, peak ${peak(so, 30000).toFixed(3)}`);
  // the types: low passes the lows, high the highs, band the middle, the notch takes the middle out
  const tone = (ft, f) => { const x = synthRender(sr, {...RAW, w1: 3, ftype: ft, cut: 1000, res: .3}, [note(Math.round(69 + 12*Math.log2(f/440)), 1)], 1).L; return rms(x, 12000, 40000); };
  const lp = [tone(2, 200), tone(2, 4000)], hp = [tone(4, 200), tone(4, 4000)], bp = [tone(3, 1000), tone(3, 4000)], nt = [tone(5, 1000), tone(5, 4000)];
  check('the state-variable filter\'s low, high, band and notch each keep their part', lp[0] > 4*lp[1] && hp[1] > 4*hp[0] && bp[0] > 2*bp[1] && nt[1] > 4*nt[0],
    JSON.stringify({lp, hp, bp, nt}, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
  // the envelope opens it, and key tracking takes it up with the note
  const env = sv({cut: 150, fenv: .8, fa: .001, fd: .25, fs: 0}), early = bright(env, 110, 600, 2048), late = bright(env, 110, 40000, 2048);
  check('the filter envelope opens the filter and lets it close', early > 4*late, `brightness ${early.toFixed(3)} then ${late.toFixed(3)}`);
  const hp2 = synthRender(sr, {...RAW, hpf: 800}, [note(45)], 1).L, nohp = synthRender(sr, RAW, [note(45)], 1).L;
  check('the high-pass takes the low end away', mag(hp2, 110, 12000, 16384) < .3*mag(nohp, 110, 12000, 16384)); }

/* ---------- the envelopes, velocity ---------- */
{ const a = synthRender(sr, {...RAW, aa: .3, ad: .3, as: .5, ar: .4}, [note(57, .8)], 1.6).L, at = i => rms(a, i - 480, i + 480);
  check('the amp envelope rises over its attack, falls to its sustain and releases', at(1200) < .4*at(14400) && at(30000) < .8*at(14400) && at(30000) > .3*at(14400) && at(75000) < .05*at(30000),
    [1200, 14400, 30000, 75000].map(i => at(i).toFixed(3)).join(' → '));
  const v = (vel, P = {}) => { const x = synthRender(sr, {...DEF, cut: 400, fenv: .5, fvel: .8, avel: .8, chorus: 0, slop: 0, ...P}, [note(45, .5, 0, vel)], .5).L; return [rms(x, 2000, 20000), bright(x, 110, 2000, 8192)]; };
  const soft = v(.3), hard = v(1); check('a harder note is louder and brighter', hard[0] > 1.5*soft[0] && hard[1] > 1.2*soft[1], `level ${soft[0].toFixed(3)} → ${hard[0].toFixed(3)}, brightness ${soft[1].toFixed(2)} → ${hard[1].toFixed(2)}`);
  // retriggering a sounding voice starts its attack from where it is (no click: no sudden jump)
  const S = new AnalogSynth(sr); S.load({...RAW, aa: .05, ar: .5, mode: 1}); const L = new Float32Array(sr), R = new Float32Array(sr);
  S.on(1, 57); S.render(L, R, 0, 12000); S.off(1); S.render(L, R, 12000, 14000); S.on(2, 57); S.render(L, R, 14000, 30000);
  let jump = 0; for (let i = 13900; i < 14200; i++) jump = Math.max(jump, Math.abs(L[i] - L[i - 1])); let typ = 0; for (let i = 6000; i < 6300; i++) typ = Math.max(typ, Math.abs(L[i] - L[i - 1]));
  check('a note started on a voice still releasing carries on from its level, without a click', jump < 1.5*typ, `${jump.toFixed(3)} against ${typ.toFixed(3)}`); }

/* ---------- voices ---------- */
{ // poly: eight at most, a ninth taking the one released longest ago, else the oldest
  const S = new AnalogSynth(sr); S.load({...DEF, ar: 2}); const L = new Float32Array(4096), R = new Float32Array(4096);
  for (let i = 0; i < 9; i++) S.on(i, 48 + i); S.render(L, R, 0, 4096);
  check('eight voices at most', S.sounding === 8 && S.V.some(v => v.id === 8) && !S.V.some(v => v.id === 0), `${S.sounding} sounding`);
  // mono: last-note priority, back to the note still held when the newest is let go
  const M = new AnalogSynth(sr); M.load({...RAW, mode: 1}); const x = new Float32Array(sr*2), y = new Float32Array(sr*2);
  M.on('a', 57); M.render(x, y, 0, 20000); M.on('b', 64); M.render(x, y, 20000, 40000); M.off('b'); M.render(x, y, 40000, 60000);
  const p = [pitch(x, 8000, 20000), pitch(x, 28000, 40000), pitch(x, 48000, 60000)];
  check('mono plays the newest key, and goes back to the one still held', Math.abs(p[0] - 220) < 2 && Math.abs(p[1] - hz(64)) < 2 && Math.abs(p[2] - 220) < 2 && M.sounding === 1, p.map(v => v.toFixed(1)).join(' → '));
  // glide: the pitch travels from one note to the next
  const G = synthRender(sr, {...RAW, mode: 2, glide: .3}, [note(57, .6), note(69, .6, .5)], 1.2).L, mid = pitch(G, 27000, 30000), end = pitch(G, 52000, 56000);
  check('glide carries the pitch from one note to the next', mid > 230 && mid < 430 && Math.abs(end - 440) < 4, `${mid.toFixed(0)} Hz on the way, ${end.toFixed(0)} Hz there`);
  // unison: several voices on one note, detuned and spread wide
  const U = synthRender(sr, {...DEF, mode: 3, uni: 6, udet: .6, spread: 1, chorus: 0}, [note(45)], 1), P1 = synthRender(sr, {...DEF, chorus: 0}, [note(45)], 1);
  const side = r => { let s = 0, m = 0; for (let i = 10000; i < 40000; i++) { s += (r.L[i] - r.R[i])**2; m += (r.L[i] + r.R[i])**2; } return Math.sqrt(s/m); };
  check('unison stacks the voices on one note, detuned across the stereo', side(U) > .3 && side(P1) < .1, `side ${side(U).toFixed(2)} against ${side(P1).toFixed(2)}`);
  // the analog cards: alike with Analog at 0, a little apart with it up
  const card = slop => { const S = new AnalogSynth(sr, 5); S.load({...RAW, slop}); const L = new Float32Array(sr), R = new Float32Array(sr); S.on(1, 57); S.on(2, 57); S.render(L, R, 0, 100); return [S.V[0].tune*slop*3, S.V[1].tune*slop*3]; };
  const c0 = card(0), c1 = card(1); check('each voice card is its own, a few cents apart with Analog up and alike without', c0[0] === c0[1] && Math.abs(c1[0] - c1[1]) > .2, `${c1.map(v => v.toFixed(2) + ' ct').join(', ')}`); }

/* ---------- modulation, effects ---------- */
{ // the LFO in time follows the song's beats: a swell on every beat (its peak a sixth of a beat in), moved by its phase; the
  // right side behind the left with LFO stereo; the air above the filter, the low end as it was
  const P = {...RAW, w1: 3, lshape: 6, lsync: 3, lamp: 1}, per = .5, lev = x => k => rms(x, Math.round((k*.02)*sr), Math.round((k*.02 + .02)*sr));
  const peakIn = (x, b) => { let best = 0, at = 0; for (let k = 0; k < 25; k++) { const v = lev(x)(b*25 + k); if (v > best) { best = v; at = k*20 + 10; } } return at; };
  const sw = synthRender(sr, P, [note(57, 3)], 3), pk = [1, 2, 3, 4].map(b => peakIn(sw.L, b));
  check('the swell peaks on every beat, a sixth of a beat in', pk.every(v => Math.abs(v - per*1000/6) < 30), pk.join(' ms, ') + ' ms');
  const ph = synthRender(sr, {...P, lphase: .5}, [note(57, 3)], 3), pp = [1, 2, 3].map(b => peakIn(ph.L, b));
  check('LFO phase moves it (half a beat: half a beat later)', pp.every(v => Math.abs(((v - pk[0] + 500) % 500) - 250) < 40), pp.join(' ms, ') + ' ms');
  const wd = synthRender(sr, {...P, lwide: .25}, [note(57, 3)], 3), l = peakIn(wd.L, 2), r = peakIn(wd.R, 2);
  check('LFO stereo: the right side swells a quarter of a beat behind the left', Math.abs(r - l - 125) < 35, `${l} ms / ${r} ms`);
  const dark = {...RAW, w1: 0, cut: 400}, a0 = synthRender(sr, dark, [note(45, 1)], 1).L, a1 = synthRender(sr, {...dark, air: .5}, [note(45, 1)], 1);
  const hi = x => mag(x, 8000, 12000, 16384) + mag(x, 10000, 12000, 16384), lo = x => mag(x, hz(45), 12000, 16384);
  check('air adds a breath above the filter, the low end as it was', hi(a1.L) > hi(a0)*8 && Math.abs(20*Math.log10(lo(a1.L)/lo(a0))) < .5 && Math.abs(rms(a1.L, 12000, 30000) - rms(a1.R, 12000, 30000))/rms(a1.L, 12000, 30000) < .2 && peak(a1.L) < 1,
    `${(20*Math.log10(hi(a1.L)/hi(a0))).toFixed(1)} dB above 8 kHz`); }
{ const vib = synthRender(sr, {...RAW, lpitch: .5, lrate: 4}, [note(57, 1.5)], 1.5).L, ps = [0, 1, 2, 3, 4, 5].map(k => pitch(vib, 20000 + k*2000, 22000 + k*2000));
  check('the LFO bends the pitch (vibrato)', Math.max(...ps) - Math.min(...ps) > 6, ps.map(v => v.toFixed(0)).join(' '));
  const del = synthRender(sr, {...RAW, lpitch: .5, lrate: 4, ldelay: 1}, [note(57, 1.5)], 1.5).L, pd = [0, 1, 2, 3].map(k => pitch(del, 2000 + k*2000, 4000 + k*2000));
  check('the LFO\'s delay holds it back at the note\'s start', Math.max(...pd) - Math.min(...pd) < 3, pd.map(v => v.toFixed(0)).join(' '));
  const pwmA = synthRender(sr, {...RAW, w1: 1, lpwm: .4, lrate: 1, hpf: 10}, [note(45, 1.2)], 1.2).L, duty = k => { let up = 0, s = 0; for (let i = 4000 + k*4000; i < 6000 + k*4000; i++) s += pwmA[i]; s /= 2000; for (let i = 4000 + k*4000; i < 6000 + k*4000; i++) up += pwmA[i] > s; return up/2000; };
  const dts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(duty);
  check('the LFO sweeps the pulse width', Math.max(...dts) - Math.min(...dts) > .3, dts.map(v => v.toFixed(2)).join(' '));
  // the chorus widens a mono voice; the echo repeats it on the beat's division
  const dry = synthRender(sr, {...RAW, chorus: 0}, [note(57)], 1), wet = synthRender(sr, {...RAW, chorus: 1}, [note(57)], 1);
  const side = r => { let s = 0, m = 0; for (let i = 10000; i < 40000; i++) { s += (r.L[i] - r.R[i])**2; m += (r.L[i] + r.R[i])**2; } return Math.sqrt(s/m); };
  check('the chorus widens the sound', side(wet) > .15 && side(dry) < .01, `${side(dry).toFixed(3)} → ${side(wet).toFixed(3)}`);
  const ec = synthRender(sr, {...RAW, emix: .6, efb: .3, etime: 0, aa: .001, ad: .05, as: 0, ar: .05}, [note(69, .05)], 1.5), e0 = rms(ec.L, 0, 2400), at = s => rms(ec.L, Math.round(s*sr) - 1200, Math.round(s*sr) + 1200) + rms(ec.R, Math.round(s*sr) - 1200, Math.round(s*sr) + 1200);
  check('the echo repeats on the beat (a quarter at 120 BPM: .5 s)', at(.5) > .1*e0 && at(.3) < .3*at(.5), `${at(.3).toFixed(3)} at .3 s, ${at(.5).toFixed(3)} at .5 s`); }

/* ---------- the examples: every one sounds, within full scale, and is let go ---------- */
{ const out = {}, slow = []; for (const e of EXAMPLES) { const sd = 60/e.bpm/4, P = {...DEF, ...e.patch}, secs = e.bars*16*sd, t0 = performance.now();
    const {L, R} = synthRender(sr, P, e.notes.map(x => ({t: x.s*sd, len: x.l*sd, n: x.n, vel: x.v})), secs + 8), ms = performance.now() - t0;
    out[e.id] = [peak(L, 0, secs*sr), peak(R, 0, secs*sr), peak(L, L.length - sr/2)]; if ((secs + 8)*1000/ms < 4) slow.push(e.id); }
  check('every example sounds, never past full scale, and falls silent after its last note', Object.values(out).every(([l, r, tail]) => Math.max(l, r) > .15 && Math.max(l, r) <= 1 && tail < .01),
    Object.entries(out).map(([k, v]) => `${k} ${v[0].toFixed(2)}`).join(', '));
  check('the engine runs every example at least four times faster than real time', !slow.length, slow.join(', ')); }

/* ---------- the playground ---------- */
execFileSync(process.execPath, [new URL('../studio/synth/build.mjs', import.meta.url).pathname]);
const {srv, url} = await serve(); const browser = await launch('2d');
{ const q = await browser.newPage({viewport: {width: 1280, height: 900}}); q.on('pageerror', e => { failed = true; console.log('FAIL page error:', e.message); });
  await q.goto(url + 'studio/listen/synth-lab.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(400);
  await q.click('#play'); await q.waitForFunction(() => window.__synthlab.node, null, {timeout: 6000});
  const listen = (ms = 900) => q.evaluate(async ms => { const {an} = window.__synthlab, x = new Float32Array(an.fftSize), f = new Float32Array(an.frequencyBinCount); let p = 0, c = 0, w = 0; const t = performance.now();
    while (performance.now() - t < ms) { await new Promise(r => setTimeout(r, 50)); an.getFloatTimeDomainData(x); for (const v of x) p = Math.max(p, Math.abs(v)); an.getFloatFrequencyData(f);
      for (let i = 2; i < f.length; i++) { const m = Math.pow(10, f[i]/20); w += m; c += m*i; } } return {p, c: c/w*window.__synthlab.ctx.sampleRate/an.fftSize}; }, ms);
  const heard = {}; for (const e of await q.evaluate(() => window.__synthlab.EXAMPLES.map(e => e.id))) { await q.evaluate(id => window.__synthlab.pickEx(id), e); heard[e] = +(await listen(700)).p.toFixed(2); }
  check('the playground plays every example, never past full scale', Object.values(heard).every(p => p > .05 && p <= 1.001), JSON.stringify(heard));
  // the keys: the phrase stopped, a key played on screen sounds
  await q.evaluate(async () => { await window.__synthlab.pickEx('juno'); window.__synthlab.stop(); }); await q.waitForTimeout(4500);
  const quiet = (await listen(300)).p; const k = await q.locator('#kb .key.w').nth(5).boundingBox(); await q.mouse.move(k.x + k.width/2, k.y + k.height*.8); await q.mouse.down(); await q.waitForTimeout(1200);
  const held = (await listen(400)).p; await q.mouse.up(); check('a key pressed on screen sounds', held > .05 && held > 5*quiet, `${quiet.toFixed(3)} → ${held.toFixed(3)}`);
  // the computer's keys, and a setting heard at once: the cutoff turned down darkens the note held
  // (the pad's release from the key before let ring out first, or its open filter is heard in the measure)
  await q.waitForTimeout(3500); await q.keyboard.down('a'); await q.waitForTimeout(1500); const open = await listen(500);
  await q.evaluate(() => { const r = document.getElementById('p-cut'); r.value = 360; r.dispatchEvent(new Event('input')); }); await q.waitForTimeout(300); const shut = await listen(500); await q.keyboard.up('a');
  check('the computer\'s keys play it, and the cutoff turned down darkens the note as it sounds', open.p > .05 && shut.c < open.c*.75, `${Math.round(open.c)} Hz → ${Math.round(shut.c)} Hz`);
  // kept: the setting with its example, a sound saved by name, both back after a reload
  await q.fill('#saveName', 'Dark pad'); await q.click('#save'); await q.reload(); await q.waitForTimeout(400);
  const kept = await q.evaluate(() => ({ex: window.__synthlab.S.ex, cut: window.__synthlab.patch().cut, saved: window.__synthlab.S.saved.map(s => s.name), mark: !!document.querySelector('.ctl[data-key="cut"][data-changed]')}));
  check('a setting changed and a sound saved are kept on this device', kept.ex === 'juno' && Math.abs(kept.cut - 30*Math.pow(600, .36)) < 1 && kept.saved.includes('Dark pad') && kept.mark, JSON.stringify(kept));
  await q.click('#reset'); check('Back to the example puts its settings back', await q.evaluate(() => window.__synthlab.patch().cut === 1300));
  await q.close(); }
{ const ph = await browser.newPage({viewport: {width: 390, height: 800}}); await ph.goto(url + 'studio/listen/synth-lab.html'); await ph.waitForTimeout(400);
  check('on a phone the page fits its width (the keyboard scrolls on its own)', await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await ph.close(); }
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
