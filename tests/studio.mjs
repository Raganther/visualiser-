// Studio Jam: the model's harmony and shapes in node (voice leading, rungs, inversions, the transforms, mutate, feel), a
// jam's take turned into a session (mixer and master changes as automation on their bars, the ones after the last note
// too), and that session's master and duck automation heard in an offline render on the desk.
import { serve, launch } from './lib.mjs';
import { vlChain, rungFrom, invert, XFORMS, mutate, feelAt, FEELS, chordOf } from '../studio/jam/model.js';
import { jamSession } from '../studio/jam/render-jam.mjs';
import { chord } from '../studio/lib/palette.js';
import { rng } from '../studio/lib/rng.js';

let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const pcs = c => new Set(c.tones.map(t => (c.root + t) % 12));
const near = (a, b) => a.reduce((s, n) => s + Math.min(...b.map(m => Math.abs(n - m))), 0);
const same = (a, b) => JSON.stringify([...a].sort((x, y) => x[0] - y[0])) === JSON.stringify([...b].sort((x, y) => x[0] - y[0]));

/* ---------- voice leading ---------- */
const H = {id: 't', bars: ['A:m7', 'F:maj9', 'C:add9', 'E:7sus']};
for (const style of ['close', 'open', 'spread', 'rootless']) {
  const V = vlChain(H, style), cs = H.bars.map(chord); let worst = 0, bad = [];
  V.forEach((v, i) => { const c = cs[i], nx = V[(i + 1) % V.length];
    if (!v.voicing.every(n => pcs(c).has(n % 12))) bad.push(`bar ${i}: a note outside the chord`);
    if (v.bass % 12 !== c.root % 12 || v.bass < 33 || v.bass > 52) bad.push(`bar ${i}: bass anchor ${v.bass}`);
    if (!pcs(c).has(v.lead % 12) || v.lead < 50 || v.lead > 66) bad.push(`bar ${i}: lead anchor ${v.lead}`);
    worst = Math.max(worst, near(v.voicing, nx.voicing)/v.voicing.length); });
  // each voice moves a few semitones at most on average, the loop round included (the last chord leads into the first)
  check(`voice leading (${style}): chord tones, anchors in range, smooth`, !bad.length && worst <= 3.5, bad.join('; ') || `worst ${worst.toFixed(2)} semitones a voice`);
}
check('voice leading is cached per harmony and style', vlChain(H, 'open') === vlChain(H, 'open') && vlChain(H, 'open') !== vlChain(H, 'close'));
{ const c = chord('A:m7'), at = vlChain(H).at(0).lead, n = pcs(c).size, r = k => rungFrom(c, at, k);
  check('rungs climb the chord from the anchor and repeat an octave up', r(0) === at && r(n) === at + 12 && r(-n) === at - 12 && [0, 1, 2, 3].every(k => r(k) < r(k + 1)) && [1, 2, 3].every(k => pcs(c).has(r(k) % 12)));
  check('chordOf wraps round the harmony', chordOf(H, 4).root === chordOf(H, 0).root && chordOf(H, -1).root === chordOf(H, 3).root); }
{ const v = [57, 60, 64, 67];
  check('an inversion and its opposite come back', JSON.stringify(invert(invert(v, 2), -2)) === JSON.stringify(v) && JSON.stringify(invert(v, 1)) === JSON.stringify([60, 64, 67, 69])); }

/* ---------- the transforms, mutate and feel ---------- */
const line = {role: 'bass', len: 7, steps: [[0, 0, 1, .9], [2, 2, 2, .7], [5, 1, 1, .8]]};
const as = steps => ({...line, steps});
check('up then down is the same line', same(XFORMS.down(as(XFORMS.up(line))), line.steps));
check('flip twice is the same line', same(XFORMS.flip(as(XFORMS.flip(line))), line.steps));
check('reverse twice is the same line', same(XFORMS.reverse(as(XFORMS.reverse(line))), line.steps));
check('rotate the clip\'s length round is the same line', same(Array.from({length: line.len}).reduce(s => XFORMS.rotate(as(s)), line.steps), line.steps));
check('wide doubles the leaps, narrow halves them back', same(XFORMS.narrow(as(XFORMS.wide(line))), line.steps));
{ const drums = {role: 'hats', len: 16, steps: [[0, 'ch', 1], [4, 'oh', .7]]};
  check('the pitch moves leave drums as they are', same(XFORMS.up(drums), drums.steps) && same(XFORMS.flip(drums), drums.steps)); }
{ const R = rng(7), before = JSON.stringify(line); let ok = true, why = '';
  for (let i = 0; i < 300 && ok; i++) { const m = mutate(line, R), at = m.steps.map(s => s[0]);
    if (at.some(x => x < 0 || x >= line.len)) { ok = false; why = 'a step outside the clip'; }
    else if (new Set(at).size !== at.length) { ok = false; why = 'two steps on one 16th'; }
    else if (m.steps.length < 2) { ok = false; why = 'fewer than two steps'; } }
  check('mutate keeps every step in the clip, one a 16th, and leaves the original alone', ok && JSON.stringify(line) === before, why); }
{ const f = FEELS.find(x => x.name === 'Straight'), push = FEELS.find(x => x.push < 0), hum = FEELS.find(x => x.name === 'Human'), R = rng(3);
  const hv = Array.from({length: 200}, (_, g) => feelAt(hum, g, R));
  check('feel: straight is untouched, pushed is early, human stays near', JSON.stringify(feelAt(f, 5)) === JSON.stringify({v: 1, dt: 0}) && feelAt(push, 0).dt < 0
    && hv.every(x => Math.abs(x.v - 1) <= hum.human.v + 1e-9 && Math.abs(x.dt) <= hum.human.t + 1e-9) && new Set(hv.map(x => x.v.toFixed(3))).size > 50); }

/* ---------- a take as a session: the mixer and the master automated on their bars ---------- */
const take = {name: 'test', bpm: 124, swing: 0, echoDiv: 1, columns: [{id: 'col0', role: 'kick'}, {id: 'col3', role: 'bass'}],
  sounds: [{id: 'k', role: 'kick', name: 'K', voices: {kick: {native: 'kdub', n: 33}}}, {id: 'b', role: 'bass', name: 'B', src: {native: 'fmround'}}],
  notes: [[0, 'col0', 'k', 'kick', 1, 1], [16, 'col0', 'k', 'kick', 1, 1], [2, 'col3', 'b', 45, 2, .8], [40, 'col3', 'b', 45, 2, .8]],
  macros: [[8, 'col3', 'mix.vol', -6], [32, '*', 'master.glue', 0], [36, 'col3', 'mix.duck', 0], [48, '*', 'master.vol', -4.5], [52, '*', 'master.width', 0], [56, 'col3', 'mix.pan', -.5]],
  mix: [{vol: 0, pan: 0, lo: 0, mid: 0, hi: 0, duck: 0, solo: false}, {vol: 0, pan: .15, lo: 0, mid: 0, hi: 0, duck: 3, solo: false}], mx: {vol: 0, lo: 0, hi: 0, glue: 2, width: 2}};
{ const S = jamSession(take), M = S.ops.find(o => o[0] === 'master')[1], bus = S.ops.find(o => o[0] === 'bus' && o[1] === 'col3')[2];
  const ramp = p => S.ops.find(o => o[0] === 'ramp' && o[1].bus === 'col3' && o[1].p === p)?.[2] || [];
  check('the master starts as the take did', M.glue?.ratio === 3 && M.width === 1 && M.vol === 0, JSON.stringify(M));
  check('master changes are automation on their bars, not the take\'s last value from the start',
    JSON.stringify(M.at) === JSON.stringify([[2, {glue: null}], [3, {vol: -4.5}], [3.25, {width: 0}]]), JSON.stringify(M.at));
  check('the duck changes on its bar', bus.pump?.depth === .65 && JSON.stringify(bus.pump.at) === JSON.stringify([[2.25, 0]]), JSON.stringify(bus.pump));
  check('a fader move is a level change on its bar', ramp('level').some(([b, v]) => b === .5 && Math.abs(v - .85*Math.pow(10, -6/20)) < 1e-9), JSON.stringify(ramp('level')));
  check('changes after the last note are kept', ramp('pan').some(([b, v]) => b === 3.5 && v === -.5), JSON.stringify(ramp('pan'))); }
{ const plain = jamSession({...take, macros: []}), M = plain.ops.find(o => o[0] === 'master')[1], bus = plain.ops.find(o => o[0] === 'bus' && o[1] === 'col3')[2];
  check('a take with no changes has a still master and a steady duck', M.at.length === 0 && bus.pump && !bus.pump.at); }

/* ---------- heard: the desk renders the master's and the duck's automation ---------- */
const {srv, url} = await serve();
const browser = await launch('2d'), page = await browser.newPage();
page.on('pageerror', e => { failed = true; console.log('FAIL page error:', e.message); });
await page.goto(url + 'studio/');
const r = await page.evaluate(async () => {
  const {desk} = await import('/studio/lib/desk.js'), SR = 22050, bpm = 120, bar = 2, secs = 5*bar;
  const ctx = new OfflineAudioContext(2, SR*secs, SR), d = desk(ctx, {bpm, meters: false});
  d.returns({}); d.bus('a', {level: 0, pump: {depth: .6, rel: .4, at: [[1, 0]]}});
  // the master: glue off, 12 dB down from bar 2, mono from bar 3
  d.masterSet({glue: null, vol: 0, width: 1, at: [[2, {vol: -12}], [3, {width: 0}]]});
  // a steady 1 kHz tone, louder on the left, and a kick on every beat for the duck
  const o = ctx.createOscillator(), pl = ctx.createStereoPanner(), g = ctx.createGain(); o.frequency.value = 1000; pl.pan.value = -.8; g.gain.value = .1;
  o.connect(g); g.connect(pl); pl.connect(d.buses.a.in); o.start(0);
  for (let b = 0; b < 5*4; b++) d.kicks.push(d.t(0, b*4));
  d.finish(); const buf = await d.render(), L = buf.getChannelData(0), R = buf.getChannelData(1);
  const rms = (x, a, b) => { let s = 0; const i0 = Math.round(a*SR), i1 = Math.round(b*SR); for (let i = i0; i < i1; i++) s += x[i]*x[i]; return Math.sqrt(s/(i1 - i0)); };
  const side = (a, b) => { let s = 0, m = 0; for (let i = Math.round(a*SR); i < Math.round(b*SR); i++) { s += (L[i] - R[i])**2; m += (L[i] + R[i])**2; } return Math.sqrt(s/m); };
  // the dip just after each kick against the level just before the next, over a bar
  const dip = b0 => { let lo = 0, hi = 0; for (let k = 0; k < 4; k++) { const t = b0*bar + k*.5; lo += rms(L, t + .01, t + .04); hi += rms(L, t + .4, t + .49); } return lo/hi; };
  return {db: 20*Math.log10(rms(L, 4.5, 5.5)/rms(L, .5, 1.5)), sideBefore: side(4.2, 5.8), sideAfter: side(6.2, 7.8), dip0: dip(0), dip1: dip(1)};
});
check('the master\'s volume drops 12 dB on its bar', Math.abs(r.db + 12) < 1, r.db.toFixed(2) + ' dB');
check('the master goes mono on its bar', r.sideBefore > .3 && r.sideAfter < .02, `side/mid ${r.sideBefore.toFixed(3)} → ${r.sideAfter.toFixed(3)}`);
check('the duck pumps, then stops on its bar', r.dip0 < .7 && r.dip1 > .95, `${r.dip0.toFixed(2)} → ${r.dip1.toFixed(2)}`);
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
