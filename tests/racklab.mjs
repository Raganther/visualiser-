// The parts (studio/lib/parts/: the processors, the host that strings them together) measured offline, then the drum
// rack playground (studio/rack/, built into studio/listen/rack-lab.html) used in the page. Usage: node tests/racklab.mjs
import { serve, launch } from './lib.mjs';
import { make, PROCS, Chain } from '../studio/lib/parts/procs.js';
import { offline } from '../studio/lib/parts/host.js';
import { AnalogKit, ANALOG_KITS, ANALOG_NAMES, busChain } from '../studio/lib/native/analogkit.js';
import { synthRender, DEF } from '../studio/lib/native/asynth.js';
import { VOICES } from '../src/audio/engine/inst/drums.js';
import { execFileSync } from 'node:child_process';

let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const sr = 48000, TAU = 2*Math.PI;
const sine = (f, secs, a = .5) => { const n = Math.round(secs*sr), L = new Float64Array(n), R = new Float64Array(n); for (let i = 0; i < n; i++) L[i] = R[i] = a*Math.sin(TAU*f*i/sr); return [L, R]; };
const run = (key, params, [L, R], env) => { const p = make(key, sr, params); for (let a = 0; a < L.length; a += 128) p.process(L, R, a, Math.min(L.length, a + 128), env); return [L, R, p]; };
const rms = (x, a = 0, b = x.length) => { a = Math.round(a); b = Math.round(b); let s = 0; for (let i = a; i < b; i++) s += x[i]*x[i]; return Math.sqrt(s/(b - a)); };
const peak = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
const mag = (x, f, a, n) => { let re = 0, im = 0; for (let i = a; i < a + n; i++) { const w = .5 - .5*Math.cos(TAU*(i - a)/n), p = TAU*f*i/sr; re += x[i]*w*Math.cos(p); im += x[i]*w*Math.sin(p); } return Math.hypot(re, im); };
const db = x => 20*Math.log10(x);

/* ---------- the processors, each alone ---------- */
{ const boost = f => { const [L] = run('weight', {db: 6, freq: 70}, sine(f, .5)); return db(rms(L, 12000)/rms(sine(f, .5)[0], 12000)); };
  check('Weight lifts the low end and leaves the rest', Math.abs(boost(30) - 6) < .7 && Math.abs(boost(2000)) < .3, `${boost(30).toFixed(2)} dB at 30 Hz, ${boost(2000).toFixed(2)} at 2 kHz`);
  const cut = f => { const [L] = run('cut', {freq: 200}, sine(f, .5)); return db(rms(L, 12000)/rms(sine(f, .5)[0], 12000)); };
  check('Low cut takes out what\'s under it', cut(50) < -20 && Math.abs(cut(2000)) < .3, `${cut(50).toFixed(1)} dB at 50 Hz`);
  const tone = (t, f) => { const [L] = run('tone', {tone: t}, sine(f, .5)); return db(rms(L, 12000)/rms(sine(f, .5)[0], 12000)); };
  check('Tone softens the highs (and fully open passes them)', tone(.2, 8000) < -6 && Math.abs(tone(.2, 300)) < .5 && Math.abs(tone(1, 8000)) < 1e-9, `${tone(.2, 8000).toFixed(1)} dB at 8 kHz`);
  // tape's bias makes even harmonics; saturation (symmetric) doesn't
  const [tL] = run('tape', {drive: .8}, sine(200, .5, .8)), [sL] = run('saturate', {amount: .8}, sine(200, .5, .8));
  const h2 = x => mag(x, 400, 8000, 8192)/mag(x, 200, 8000, 8192), h3 = x => mag(x, 600, 8000, 8192)/mag(x, 200, 8000, 8192);
  check('Tape warms with even harmonics, saturation with odd ones', h2(tL) > .005 && h2(sL) < h2(tL)/20 && h3(sL) > .02, `tape 2nd ${db(h2(tL)).toFixed(0)} dB, saturation 2nd ${db(h2(sL)).toFixed(0)} dB, 3rd ${db(h3(sL)).toFixed(0)} dB`);
  // glue: above the threshold, 4:1 brings 12 dB over down to 3 dB over; below it, nothing
  const [gL, , g] = run('glue', {thr: -20, ratio: 4, att: 1, rel: 400}, sine(1000, 1, Math.pow(10, -8/20)*Math.SQRT2));
  const over = db(rms(gL, 30000)*Math.SQRT2) + 20, [qL] = run('glue', {thr: -20, ratio: 4}, sine(1000, .5, .05));
  check('Glue compresses at its ratio above the threshold and leaves quiet signals alone', Math.abs(over - 3) < 1 && Math.abs(rms(qL, 12000) - rms(sine(1000, .5, .05)[0], 12000)) < 1e-6 && g.gr > 8,
    `12 dB over → ${over.toFixed(1)} dB over, meter ${g.gr.toFixed(1)} dB`);
  const [pL] = run('glue', {thr: -20, ratio: 4, att: 1, rel: 50, mix: .5}, sine(1000, 1, Math.pow(10, -8/20)*Math.SQRT2));
  check('Glue below 100% mix blends the dry signal back (parallel compression)', rms(pL, 30000) > rms(gL, 30000)*1.3);
  const [wL, wR] = run('width', {width: 0}, [Float64Array.from({length: 4800}, (_, i) => Math.sin(i*.05)), Float64Array.from({length: 4800}, (_, i) => Math.sin(i*.07))]);
  check('Width at 0 makes it mono', wL.every((v, i) => Math.abs(v - wR[i]) < 1e-12));
  const [cL] = run('ceiling', {knee: .8}, sine(100, .2, 3)); check('The ceiling never lets it past full scale', peak(cL) <= 1 && peak(cL) > .95, peak(cL).toFixed(4));
  const dcin = [new Float64Array(sr).fill(.5), new Float64Array(sr).fill(.5)], [dL] = run('dc', {}, dcin); check('DC block brings an offset back to the middle', Math.abs(dL[sr - 1]) < .01);
  // the echo: a click comes back on the beat's division (an 1/8 at 120 BPM: .25 s), quieter each time
  const click = () => { const L = new Float64Array(sr*2), R = new Float64Array(sr*2); L[100] = R[100] = 1; return [L, R]; };
  const [eL, eR] = run('echo', {time: 2, mix: 1, fb: .5, dry: 0}, click(), {period: .5}), at = t => peak(eL, Math.round(t*sr) - 600, Math.round(t*sr) + 600) + peak(eR, Math.round(t*sr) - 600, Math.round(t*sr) + 600);
  check('Echo repeats on the beat\'s division, dying away, without the dry signal', at(.25) > 10*at(.15) && at(.5) > 10*at(.38) && at(.75) < at(.5) && peak(eL, 0, 300) < 1e-3, [.25, .5, .75].map(t => at(t).toFixed(3)).join(' → '));
  // the room: a click's tail is dense and dies at the rate asked (60 dB over the decay)
  const [rL, rR] = run('room', {decay: 1, mix: 1, dry: 0, pre: 0, damp: 0, cut: 20}, click()), e = t => rms(rL, Math.round(t*sr), Math.round(t*sr) + 2400) + rms(rR, Math.round(t*sr), Math.round(t*sr) + 2400);
  const fall = db(e(.8)/e(.3))/.5;
  check('Room\'s tail dies at the rate asked (about 60 dB over its decay)', fall < -45 && fall > -80, `${fall.toFixed(0)} dB a second`);
  const side = rms(rL.map((v, i) => v - rR[i]), 4800, 30000)/rms(rL.map((v, i) => v + rR[i]), 4800, 30000);
  check('Room\'s tail is wide (the two sides different lines)', side > .5, side.toFixed(2));
  check('every processor describes its settings and makes itself', Object.entries(PROCS).every(([k, P]) => P.label && P.words && Array.isArray(P.params) && make(k, sr).process)); }

/* ---------- the instruments, rebuilt on the processors ---------- */
{ // the kit's bus is a chain of processors now: the kit alone, and its pads summed into the same chain by the host, the same
  const ev = []; for (let k = 0; k < 16; k++) { ev.push({type: 'hit', src: 'k', voice: 'kick', vel: 1, t: k*.5}); ev.push({type: 'hit', src: 'k', voice: 'chh', vel: .7, t: k*.5 + .25}); if (k % 2) ev.push({type: 'hit', src: 'k', voice: 'clap', vel: .8, t: k*.5}); }
  const worst = ANALOG_NAMES.map(kit => { const pads = VOICES.map(v => ({id: v.key, input: {src: 'k', pad: v.key}, chain: [], out: 'bus'}));
    const rack = offline(sr, {sources: {k: {kind: 'kit', kit}}, strips: [...pads, {id: 'bus', input: null, chain: busChain(ANALOG_KITS[kit].bus), out: 'master'}]}, ev, 8.5);
    const whole = offline(sr, {sources: {k: {kind: 'kit', kit}}, strips: [{id: 'd', input: {src: 'k'}, chain: [], out: 'master'}]}, ev, 8.5);
    let d = 0; for (let i = 0; i < rack.L.length; i++) d = Math.max(d, Math.abs(rack.L[i] - whole.L[i]), Math.abs(rack.R[i] - whole.R[i])); return db(d/peak(whole.L) + 1e-30); });
  check('the kit taken apart into pads, summed into its bus by the host, sounds the same as the kit whole', worst.every(x => x < -120), worst.map(x => x.toFixed(0)).join(', ') + ' dB');
  // the synth through the host sounds as it does alone (its effects are processors inside it)
  // (the times on 128-sample blocks: synthRender starts notes at a block, the host on their sample)
  const B = 128/sr, P = {...DEF, chorus: 2, emix: .3}, notes = [{t: 0, len: 188*B, n: 57, vel: .8}, {t: 188*B, len: 375*B, n: 64, vel: .8}];
  const alone = synthRender(sr, P, notes, 2.5), hosted = offline(sr, {sources: {s: {kind: 'synth', params: P}}, strips: [{id: 's', input: {src: 's'}, chain: [], out: 'master'}]},
    notes.flatMap((x, i) => [{type: 'on', src: 's', id: i, n: x.n, vel: x.vel, t: x.t}, {type: 'off', src: 's', id: i, t: x.t + x.len}]), 2.5);
  let d = 0; for (let i = 0; i < alone.L.length; i++) d = Math.max(d, Math.abs(alone.L[i] - hosted.L[i]));
  check('the synth in the host sounds as it does alone', db(d/peak(alone.L) + 1e-30) < -60, db(d/peak(alone.L) + 1e-30).toFixed(0) + ' dB'); }

/* ---------- the host's wiring ---------- */
{ const kit = 'Analog 909', ev = [0, .5, 1, 1.5].map(t => ({type: 'hit', src: 'k', voice: 'kick', vel: 1, t})).concat([.25, .75, 1.25, 1.75].map(t => ({type: 'hit', src: 'k', voice: 'chh', vel: .8, t})));
  const D = (pads = {}, bus = {}) => ({sources: {k: {kind: 'kit', kit}}, strips: [...['kick', 'chh'].map(v => ({id: v, input: {src: 'k', pad: v}, chain: [], out: 'bus', ...(pads[v] || {})})),
    {id: 'bus', input: null, chain: busChain(ANALOG_KITS[kit].bus), out: 'master', ...bus}, {id: 'room', input: null, chain: [{key: 'room', params: {mix: 1, dry: 0, decay: 2}}], out: 'master'}]});
  const lo = x => rms(x.L.map((v, i) => v + x.R[i]), 0, x.L.length), hi = x => { let s = 0; for (let i = 1; i < x.L.length; i++) s += (x.L[i] - x.L[i - 1])**2; return Math.sqrt(s/x.L.length); };
  const all = offline(sr, D(), ev, 2.5), noKick = offline(sr, D({kick: {mute: true}}), ev, 2.5), solo = offline(sr, D({chh: {solo: true}}), ev, 2.5);
  check('a pad muted leaves the rest, and soloed leaves only it', lo(noKick) < lo(all)*.6 && Math.abs(lo(solo) - lo(noKick)) < 1e-9, `${lo(all).toFixed(3)} all, ${lo(noKick).toFixed(3)} without the kick`);
  const dry = offline(sr, D({kick: {mute: true}}), ev, 3.5), wet = offline(sr, D({kick: {mute: true}, chh: {sends: {room: -6}}}), ev, 3.5);
  check('a send to the room leaves a tail after the last hit', rms(wet.L, 2.2*sr, 3*sr) > 10*rms(dry.L, 2.2*sr, 3*sr) + 1e-6, `${rms(wet.L, 2.2*sr, 3*sr).toExponential(1)} against ${rms(dry.L, 2.2*sr, 3*sr).toExponential(1)}`);
  // bypass with match: the dry sum at the loudness the bus gives it
  const busIn = offline(sr, D(), ev.concat(ev.map(e => ({...e, t: e.t + 2}))).concat(ev.map(e => ({...e, t: e.t + 4}))), 6);
  const r = busIn.H.by.bus.ratio, out = offline(sr, D({}, {bypass: true, match: true}), ev.concat(ev.map(e => ({...e, t: e.t + 2}))).concat(ev.map(e => ({...e, t: e.t + 4}))), 6);
  const L1 = rms(busIn.L, 4*sr, 6*sr), L2 = rms(out.L, 4*sr, 6*sr);
  check('the bus switched out with Match loudness sounds as loud as it does in', Math.abs(db(L2/L1)) < 1.5 && Math.abs(db(r)) > .5, `the bus adds ${db(r).toFixed(1)} dB; out, matched, ${db(L2/L1).toFixed(2)} dB from in`);
  // a chain edited live keeps the processors it kept (their state), and takes the new order
  const H = offline(sr, D(), ev, 1).H, glue = H.by.bus.chain.list.find(p => p.key === 'glue'), env = glue.env;
  H.msg({type: 'chain', id: 'bus', chain: [{key: 'glue', id: glue.id, params: glue.p}, {key: 'tape', id: 'new', params: {drive: .5}}]});
  check('a chain edited live keeps the processors it keeps, with their state, in the new order', H.by.bus.chain.list[0] === glue && glue.env === env && H.by.bus.chain.list[1].key === 'tape' && H.by.bus.chain.list.length === 2); }

/* ---------- the playground ---------- */
execFileSync(process.execPath, [new URL('../studio/rack/build.mjs', import.meta.url).pathname]);
const {srv, url} = await serve(); const browser = await launch('2d');
{ const q = await browser.newPage({viewport: {width: 1280, height: 900}}); q.on('pageerror', e => { failed = true; console.log('FAIL page error:', e.message); });
  await q.goto(url + 'studio/listen/rack-lab.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(400);
  await q.click('#play'); await q.waitForFunction(() => window.__rack.A, null, {timeout: 6000});
  const listen = ms => q.evaluate(async ms => { const {A} = window.__rack, x = new Float32Array(A.an.fftSize); let p = 0, s = 0, c = 0; const t = performance.now();
    while (performance.now() - t < ms) { await new Promise(r => setTimeout(r, 40)); A.an.getFloatTimeDomainData(x); for (const v of x) { p = Math.max(p, Math.abs(v)); s += v*v; c++; } } return {p, rms: Math.sqrt(s/c)}; }, ms);
  await q.waitForTimeout(1500); const busIn = await listen(2500);
  check('the rack plays the beat through its bus, within full scale', busIn.p > .1 && busIn.p <= 1.001, `peak ${busIn.p.toFixed(2)}`);
  const gr = await q.evaluate(() => window.__rack.S.m.bus?.gr?.['b-glue'] ?? -1); check('the glue\'s meter reads how far it turns the sum down', gr >= 0, gr.toFixed(2) + ' dB');
  await q.keyboard.press('b'); await q.waitForTimeout(800); const busOut = await listen(2500); const said = await q.textContent('#matched');
  check('B switches the bus out at the same loudness', Math.abs(db(busOut.rms/busIn.rms)) < 2 && /bus out/.test(said), `${db(busOut.rms/busIn.rms).toFixed(2)} dB; "${said}"`);
  await q.keyboard.press('b');
  // the bus's processors: switched off, taken out, one added; each heard in the host's chain
  await q.locator('#busChain .proc[data-key="glue"] .pname').click(); await q.locator('#busChain .proc[data-key="width"] button[aria-label^="Take out"]').click();
  await q.selectOption('#busChain .padd select', 'room'); await q.waitForTimeout(300);
  const chain = await q.evaluate(() => window.__rack.S.bus[window.__rack.S.kit].map(s => s.key + (s.on === false ? ':off' : '')));
  check('a bus processor switched off, one taken out and one added', chain.includes('glue:off') && !chain.includes('width') && chain.at(-1) === 'room', chain.join(' → '));
  // a pad muted, a voice knob turned, a processor added to a pad; all kept across a reload
  await q.locator('.strip').nth(0).locator('.ms button').first().click(); await q.locator('.strip').nth(1).locator('.sname').click();
  await q.evaluate(() => { const r = document.querySelector('#voice .ctl[data-key="decay"] input'); r.value = 900; r.dispatchEvent(new Event('input')); });
  await q.selectOption('#padChain .padd select', 'tape'); await q.waitForTimeout(300); await q.reload(); await q.waitForTimeout(400);
  const kept = await q.evaluate(() => { const S = window.__rack.S; return {mute: S.pads.kick.mute, sel: S.sel, decay: S.over[S.kit]?.snare?.decay, ins: S.pads.snare.chain.map(c => c.key), bus: S.bus[S.kit].length,
    strip: document.querySelectorAll('.strip')[1].textContent.includes('1 processor')}; });
  check('a muted pad, a voice\'s setting, a pad\'s processor and the bus are kept across a reload', kept.mute && kept.sel === 'snare' && kept.decay > 1 && kept.ins[0] === 'tape' && kept.bus === 6 && kept.strip, JSON.stringify(kept));
  await q.close(); }
{ const ph = await browser.newPage({viewport: {width: 390, height: 800}}); await ph.goto(url + 'studio/listen/rack-lab.html'); await ph.waitForTimeout(400);
  check('on a phone the page fits its width (the rack scrolls on its own)', await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await ph.close(); }
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
