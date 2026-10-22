// Studio Jam: the model's harmony and shapes in node (voice leading, rungs, inversions, the transforms, mutate, feel), Play
// (the improviser: as written when off, the bar's 1 kept, ideas held, fills in the phrase's last bar, the leads taking
// turns, kept as a variant), a
// jam's take turned into a session (mixer and master changes as automation on their bars, the ones after the last note
// too), that session's master and duck automation heard in an offline render on the desk, parts (a clip taken apart into
// its rhythm and notes and put together again; mixed: notes going round a rhythm of another length, a hats rhythm on the
// bass; the tools), the part card in the page (names, the library, editing, undo, a scene, a reload),
// and the harmony's library and chord matrix (in node: every chord in its scale, distances, keys and spelling; in the
// page: a chord held, a progression written, played and saved, the library in a key, a snapshot bringing it back).
import { serve, launch } from './lib.mjs';
import { vlChain, rungFrom, invert, XFORMS, mutate, feelAt, FEELS, chordOf } from '../studio/jam/model.js';
import { jamSession } from '../studio/jam/render-jam.mjs';
import { chord } from '../studio/lib/palette.js';
import { rng } from '../studio/lib/rng.js';
import { improvise, reach, keep, PLAYS } from '../studio/jam/play.js';
import { KEYS, MODES, LIB, matrix, distance, pcs as pcsOf, inKey, spell, shortOf } from '../studio/jam/chords.js';
import { TOOLS, newRiff, answer, sequence, develop, thin, fill, halfTime, doubleTime, longer, shorter, MAX } from '../studio/jam/riff.js';

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

/* ---------- Play: the improviser ---------- */
{ const hats = {role: 'hats', len: 16, steps: Array.from({length: 16}, (_, i) => [i, 'chh', i % 2 ? .45 : .8])};
  const lead = {role: 'lead', len: 16, steps: [[0, 4, 1, .7], [3, 2, 1, .5], [6, 5, 1, .55], [11, 3, 1, .5]]};
  // a part played for some bars: each bar's events as a string of what happened on each 16th
  const run = (clip, a, bars, lane = 0, seed = 7) => { const mem = {}, out = [];
    for (let b = 0; b < bars; b++) { const bar = []; for (let q = 0; q < 16; q++) { const step = b*16 + q; bar.push(improvise({role: clip.role, clip, pos: step % clip.len, step, bar: b, lane, a, mem, seed})); } out.push(bar); }
    return out; };
  const sig = bar => bar.map(ev => ev.map(e => `${e.s[1]}${e.s[4] || ''}@${e.dt.toFixed(2)}`).join('+') || '.').join(' ');
  const off = run(hats, 0, 8), offL = run(lead, 0, 8);
  check('Play off: every step as written, on time, as loud', off.every(b => b.every((ev, q) => ev.length === 1 && ev[0].s === hats.steps[q] && ev[0].dt === 0 && ev[0].fv === 1))
    && offL.every(b => b.every((ev, q) => ev.length === lead.steps.filter(s => s[0] === q).length)));
  for (const p of PLAYS.slice(1)) { const B = run(hats, p.a, 64), L = run(lead, p.a, 64);
    // (a lead resting its whole bar aside)
    check(`Play ${p.name}: the bar's first beat as written`, [...B, ...L].every((b, i) => { const ev = b[0], clip = i < 64 ? hats : lead; return i >= 64 && b.every(e => !e.length) || ev.length === 1 && ev[0].s[1] === clip.steps[0][1] && ev[0].dt === 0; })); }
  const changed = a => { const B = run(hats, a, 64); return B.reduce((n, b) => n + b.filter((ev, q) => ev.length !== 1 || ev[0].s[1] !== 'chh').length, 0); };   // (notes left out, added, rolled or opened; not the timing's jitter)
  const light = changed(.35), wild = changed(1);
  check('Play: Wild changes more than Light, Light only a little', light > 10 && light < 160 && wild > 1.8*light, `${light} and ${wild} of 1024 steps`);
  { const B = run(hats, .65, 64), byPh = [0, 0, 0, 0], fills = [0, 0, 0, 0], drops = [0, 0, 0, 0];
    B.forEach((b, i) => { const ph = i % 4; b.forEach((ev, q) => { if (ev.length > 1) fills[ph]++; if (!ev.length) drops[ph]++; if (ev.length !== 1 || ev[0].s[1] !== 'chh') byPh[ph]++; }); });
    check('Play: the fills come in the phrase\'s last bar, and changes grow through it', fills[3] > 0 && fills[0] + fills[1] + fills[2] === 0 && byPh[3] > byPh[0], `fills ${fills}, changes by bar ${byPh}`);
    check('Play: a fill rolls the last beat, louder as it goes', B.filter((b, i) => i % 4 === 3).some(b => b[12].length >= 3 && b[12].every((e, j, a) => !j || e.fv > a[j - 1].fv && e.dt > a[j - 1].dt) && b.slice(13).every(ev => !ev.length))); }
  { const B = run(hats, .65, 64), same = B.filter((b, i) => i % 4 < 3 && i % 4 && sig(b) === sig(B[i - 1])).length;
    check('Play: an idea comes round again before the next (bars repeat inside the phrase)', same >= 6, `${same} bars the same as the bar before`); }
  { const A = run(lead, 1, 64, 0), Bl = run(lead, 1, 64, 1), rests = A.map((b, i) => [b.every(ev => !ev.length), Bl[i].every(ev => !ev.length)]);
    check('Play: the two leads take turns resting a bar, never both, never on the phrase\'s first', rests.some(r => r[0]) && rests.some(r => r[1]) && !rests.some(r => r[0] && r[1]) && rests.every((r, i) => i % 4 || !r[0] && !r[1]));
    const rungs = A.flat(2).filter(e => typeof e.s[1] === 'number'), home = new Set(lead.steps.map(s => s[1]));
    check('Play: a melody stays a chord tone from its own notes', rungs.every(e => [...home].some(k => Math.abs(e.s[1] - k) <= 1)) && rungs.some(e => !home.has(e.s[1])) && rungs.some(e => e.s[4] === 1)); }
  { const R = reach('lead', lead), Rh = reach('hats', hats);
    check('Play: everything it may reach is computed ahead (a tone up, down, an octave up; the open hat)', R.length === 3 && R[0].steps[0][1] === 5 && R[1].steps[0][1] === 3 && R[2].steps[0][4] === 1 && Rh[0].steps.every(s => s[1] === 'ohh')); }
  { const mem = {}, heard = []; for (let step = 0; step < 64; step++) for (const ev of improvise({role: 'hats', clip: hats, pos: step % 16, step, bar: step >> 4, a: .65, mem, seed: 3})) heard.push({step, ...ev});
    const k = keep(heard, 32, 32), want = new Set(heard.filter(e => e.step >= 32).map(e => ((e.step - 32 + Math.round(e.dt)) % 32 + 32) % 32 + e.s[1]));
    check('Keep that: two bars as played become a 32-step variant', k.every(s => s[0] >= 0 && s[0] < 32) && k.length === want.size && new Set(k.map(s => s[0] + s[1])).size === k.length && k.some(s => s[2] < .45), `${k.length} notes`); }
}

/* ---------- the riff tools ---------- */
{ const line = {role: 'lead', len: 16, steps: [[0, 4, 1, .7], [3, 2, 1, .5], [6, 5, 1, .55], [11, 3, 2, .5]]}, hats = {role: 'hats', len: 16, steps: [[2, 'chh', .8], [6, 'chh', .8], [10, 'chh', .8], [14, 'chh', .5]]};
  const R = rng(11), ok = (r, len) => r && r.len === len && r.steps.every(s => s[0] >= 0 && s[0] < r.len) && new Set(r.steps.map(s => s[0] + '|' + s[1])).size === r.steps.length;
  const half = (r, i, L) => JSON.stringify(r.steps.filter(s => s[0] >= i*L && s[0] < (i + 1)*L).map(s => [s[0] - i*L, ...s.slice(1)]));
  let good = true, why = '';
  for (const role of ['kick', 'hats', 'perc', 'bass', 'chords', 'lead']) for (const len of [16, 32, 64]) for (let i = 0; i < 20; i++) { const r = newRiff(role, len, R, ['chh', 'ohh', 'rim']);
    if (!ok(r, len) || !r.steps.length) { good = false; why = `${role} ${len}`; }
    if (role === 'bass' && r.steps.some(s => s[1] < 0 || s[1] > 4)) { good = false; why = 'bass out of range'; }
    if (role === 'lead' && r.steps.at(-1)[1] !== r.steps[0][1]) { good = false; why = 'a lead not coming home'; } }
  check('a new riff for every part fits its length, one note a step, a lead coming home', good, why);
  { const a = answer(line); check('answer: two bars, the riff then its answer on the same rhythm, coming home', ok(a, 32) && half(a, 0, 16) === JSON.stringify(line.steps)
    && JSON.stringify(a.steps.filter(s => s[0] >= 16).map(s => s[0] - 16)) === JSON.stringify(line.steps.map(s => s[0])) && a.steps.at(-1)[1] === line.steps[0][1] && half(a, 1, 16) !== half(a, 0, 16)); }
  { const q = sequence(line); check('sequence: four times round, a chord tone higher, then home', ok(q, 64) && [0, 1, 2, 0].every((d, i) => half(q, i, 16) === JSON.stringify(line.steps.map(s => [s[0], s[1] + d, ...s.slice(2)])))); }
  { const d = develop(line, rng(2)), d2 = develop({...line, len: 32}, rng(2)), dh = develop(hats, rng(2));
    check('develop: A A′ A B in four bars (A B when longer), on drums too', ok(d, 64) && half(d, 0, 16) === half(d, 2, 16) && half(d, 0, 16) === JSON.stringify(line.steps) && half(d, 1, 16) !== half(d, 0, 16) && half(d, 3, 16) !== half(d, 0, 16) && ok(d2, 64) && ok(dh, 64) && half(dh, 1, 16) !== half(dh, 0, 16)); }
  { const t = thin(line, rng(3)), f = fill(line, rng(3)), fh = fill(hats, rng(3)), str = s => JSON.stringify(s);
    check('thin keeps the first note and takes some away; fill only adds, softly, in the gaps', ok(t, 16) && t.steps.length < line.steps.length && t.steps.length >= 2 && t.steps[0][0] === 0 && t.steps.every(s => line.steps.some(x => str(x) === str(s)))
      && line.steps.every(x => f.steps.some(s => str(s) === str(x))) && f.steps.length > line.steps.length && f.steps.filter(s => !line.steps.some(x => str(x) === str(s))).every(s => s[3] < .5) && fh.steps.length > hats.steps.length); }
  { const h2 = halfTime(line), d2 = doubleTime(line);
    check('half time stretches it over two bars; double time plays it twice as fast, twice; an odd length can\'t double', ok(h2, 32) && h2.steps.every((s, i) => s[0] === 2*line.steps[i][0] && s[2] === 2*line.steps[i][2])
      && ok(d2, 16) && half(d2, 0, 8) === half(d2, 1, 8) && doubleTime({...line, len: 7}) === null); }
  check('longer and shorter undo each other; four bars at most', JSON.stringify(shorter(longer(line))) === JSON.stringify({len: 16, steps: line.steps}) && longer({...line, len: MAX}) === null && shorter({...line, len: 7}) === null);
  check('no tool changes the clip it was given', JSON.stringify(line) === JSON.stringify({role: 'lead', len: 16, steps: [[0, 4, 1, .7], [3, 2, 1, .5], [6, 5, 1, .55], [11, 3, 2, .5]]}));
}

/* ---------- the chord library and matrix ---------- */
{ let bad = [];
  for (const key of KEYS) for (const mode of Object.keys(MODES)) { const sc = MODES[mode].map(i => (KEYS.indexOf(key) + i) % 12), M = matrix(key, mode);
    if (!M[0].cells.some(Boolean)) bad.push(`${key} ${mode}: nothing on i`);
    for (const r of M) for (const c of r.cells) if (c && !pcsOf(c).every(p => sc.includes(p))) bad.push(`${key} ${mode}: ${c} outside the scale`); }
  check('the matrix: every chord in its key and mode, a chord on the home degree in each', !bad.length, bad.slice(0, 3).join('; '));
  const M = matrix('A', 'minor'), all = M.flatMap(r => r.cells.filter(Boolean));
  check('the matrix in A minor has its chords where they belong', M[0].cells[1] === 'A:m9' && M[5].cells[0] === 'F:maj7' && M[1].numeral === 'ii' && M[2].numeral === 'III' && all.length >= 30, `${all.length} chords`);
  check('distance: none to itself, symmetric, a shared-note move smoother than a leap', distance('A:m9', 'A:m9') === 0 && Math.abs(distance('A:m9', 'C:maj7') - distance('C:maj7', 'A:m9')) < 1e-9
    && distance('A:m9', 'C:maj7') < distance('A:m9', 'E:m9') && distance('A:m9', 'E:m9') < distance('A:m9', 'Eb:maj7'));
  bad = []; for (const H of LIB) for (const key of KEYS) { const T = inKey(H, key), n = (KEYS.indexOf(key) - 9 + 12) % 12;
    T.bars.forEach((b, i) => { const a = pcsOf(H.bars[i]).map(p => (p + n) % 12).sort().join(), t = pcsOf(b).sort().join(); if (a !== t || b.split(':')[1] !== H.bars[i].split(':')[1]) bad.push(`${H.name} in ${key}: ${b}`); }); }
  check('every library progression moves to any key with its chords intact', !bad.length && LIB.length >= 20, bad.slice(0, 3).join('; ') || `${LIB.length} progressions`);
  check('chords are spelled for their key (flats in F minor, sharps in E minor)', inKey(LIB.find(H => H.id === 'lib-aeolian'), 'F').bars.includes('Db:maj9') && inKey(LIB.find(H => H.id === 'lib-aeolian'), 'E').bars.includes('D:add9')
    && spell(1, 'F', 'minor') === 'Db' && spell(6, 'E', 'minor') === 'F#' && shortOf('Bb:maj7') === 'B♭maj7'); }

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

/* ---------- parts: a clip taken apart into its rhythm and notes and put together again, mixed and matched ---------- */
{ const P = await import('../studio/jam/part.js'), fs = await import('node:fs'); let bad = 0, n = 0;
  const norm = (role, st) => JSON.stringify([...st].map(x => x.slice(0, role === 'chords' ? 4 : 5).filter((v, i) => !(i === 4 && !v))).sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1]))));
  for (const f of ['pack-1', 'pack-2', 'pack-3']) for (const c of JSON.parse(fs.readFileSync(new URL(`../studio/jam/packs/${f}.json`, import.meta.url))).clips) { n++;
    const s = P.split(c.role, c, c.name), j = P.join(c.role, s.rhythm, s.notes); if (norm(c.role, j.steps) !== norm(c.role, c.steps) || j.len !== c.len) bad++; }
  check('every pack clip taken apart and put together again is the same clip', !bad && n > 100, `${bad} of ${n} differ`);
  const R = P.spread('bass', 5, 16), N = P.notesTool('new', 'bass', null, rng(4), {n: 7}), J = P.join('bass', R, N);
  check('7 notes over 5 hits go round 7 times (7 bars), each hit the next note', P.cycles(R, N) === 7 && J.len === 112 && J.steps.length === 35 && J.steps[5][1] === N.seq[5][0] && J.steps[7][1] === N.seq[0][0], `${J.len} steps, ${J.steps.length} notes`);
  const linkedN = {...N, seq: N.seq.slice(0, 5)}, th = P.rhythmTool('thin', 'bass', R, linkedN, rng(2)), un = P.rhythmTool('thin', 'bass', R, N, rng(2));
  check('a rhythm tool carries linked notes with their hits, and leaves notes going round alone', th.notes && th.notes.seq.length === th.rhythm.hits.length && th.notes.seq.every(x => linkedN.seq.some(y => y[0] === x[0])) && !un.notes, `${th.rhythm.hits.length} hits, ${th.notes?.seq.length} notes`);
  const hats = {len: 16, steps: [[2, 'chh', .7], [6, 'ohh', .7], [10, 'chh', .7], [14, 'chh', .7]]}, H = P.split('hats', hats), onBass = P.join('bass', H.rhythm, N);
  check('a hats rhythm carries the bass\'s notes', onBass.steps.every(s => [2, 6, 10, 14].includes(s[0] % 16)) && typeof onBass.steps[0][1] === 'number', JSON.stringify(onBass.steps.slice(0, 4)));
  check('drum notes can\'t go on a line, and voices a sound hasn\'t got become its main one', P.fitNotes('bass', H.notes) === null && P.fitNotes('hats', H.notes, ['chh', 'ride']).seq.join() === 'chh,chh,chh,chh');
  const ans = P.notesTool('answer', 'lead', {seq: [[2, 0], [3, 0], [4, 0]], name: 'Rise', base: 'Rise', ops: []});
  check('notes answered come home, and are named after it', ans.seq.length === 6 && ans.seq.at(-1)[0] === 2 && ans.name === 'Rise, answered', JSON.stringify(ans.seq));
  const ev = P.spread('kick', 3, 8); check('an even rhythm: 3 over 8 is the tresillo', ev.hits.map(h => h[0]).join() === '0,2,5', ev.hits.map(h => h[0]).join()); }

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
// the part card, in the jam's own page: a rhythm tool names the rhythm after what was done, the notes keep theirs; the
// hats' off-beats from the library onto the bass keep the bass's notes, going round them; a hit tapped in by hand carries
// its note (linked) and Undo takes it back; a scene saved and recalled brings the modules back; the part comes back after
// a reload
{ const q = await browser.newPage({viewport: {width: 1300, height: 1300}}); q.on('pageerror', e => { failed = true; console.log('FAIL jam page error:', e.message); }); q.on('dialog', d => d.accept('Bamboo walk'));
  await q.goto(url + 'studio/listen/jam-live.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(2000);
  const mods = () => q.evaluate(async () => { const r = document.querySelector('#rHead .mname')?.textContent; return {sub: document.querySelector('#cardSub').textContent, r, rw: document.querySelector('#ctabs button small').textContent}; });
  await q.keyboard.press('r'); const n0 = (await mods()).sub.split(' · ')[1];
  await q.click('#rTools button:has-text("Thin")'); const thin = await mods();
  check('a rhythm tool names the rhythm after it, and (linked) the notes come along', /, thinned$/.test(thin.r) && thin.sub.split(' · ')[1] === n0 + ', thinned', JSON.stringify(thin));
  await q.click('#ctabs button:has-text("Notes")'); await q.click('#nTools button:has-text("Sequence")'); const nw = await q.textContent('#nWords');
  check('notes sequenced run four times as long as the rhythm, and say so', /round 4 times/.test(nw), nw);
  await q.click('#libFilters button:has-text("From every part")'); await q.fill('#libSearch', 'Off-beats'); await q.click('#libList .libcard:has(.kind:text-is("Hats")) button:has-text("Rhythm")'); const took = await mods();
  check('the hats\' off-beats onto the bass keep the bass\'s notes', took.sub.startsWith('Off-beats · ') && took.sub.includes(', sequenced') && /4 hits/.test(took.rw), took.sub);
  await q.click('#ctabs button:has-text("Rhythm")'); await q.click('#rInfo button:has-text("Edit")'); const box = await q.$eval('#rgrid', e => { const r = e.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; });
  await q.mouse.click(box.x + 8 + (box.w - 16)*(.5/16), box.y + box.h - 20); const added = await mods(); await q.keyboard.press('z'); const undone = await mods();
  check('a hit tapped in by hand, and Undo takes it out', /5 hits/.test(added.rw) && /, edited/.test(added.r) && /4 hits/.test(undone.rw), [added.rw, undone.rw].join(' / '));
  await q.click('#rInfo button:has-text("Editing")'); await q.keyboard.press('s'); await q.keyboard.press('1'); const other = await mods(); await q.keyboard.press('Shift+Digit1'); await q.waitForTimeout(200); const back = await mods();
  check('a scene saved and recalled brings the part\'s modules back', other.sub !== took.sub && back.sub === took.sub, [other.sub, back.sub].join(' / '));
  await q.waitForTimeout(500); await q.reload(); await q.waitForTimeout(2000); await q.keyboard.press('r'); const reloaded = await mods();
  check('the part comes back as it was left, after a reload', reloaded.sub === took.sub, reloaded.sub); await q.close(); }
// one of Claude's songs in the page: its sections recalled one after another on the bar, played through once, then it
// stops (two one-bar sections at 140 BPM, the second without the kick)
{ const q = await browser.newPage({viewport: {width: 1300, height: 1300}}); q.on('pageerror', e => { failed = true; console.log('FAIL jam page error:', e.message); });
  await q.goto(url + 'studio/listen/jam-live.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(2000);
  await q.keyboard.press('s'); const scene = await q.evaluate(() => JSON.parse(localStorage.getItem('studio.jam.snaps'))[0]);
  const sec = (i, kick) => ({...scene, id: 't.' + i, name: `Test: part ${i}`, bars: 1, bpm: 140, cols: scene.cols.map(c => c.role === 'kick' && !kick ? {...c, rhythm: null, notes: null, clip: null} : c)});
  await q.evaluate(x => window.__jamIdeas([x]), {id: 't', kind: 'song', name: 'Test', round: 9, bpm: 140, sections: [sec(1, true), sec(2, false)]});
  await q.click('.snap.song button:has-text("Play the song")'); const seen = [];
  for (let k = 0; k < 14; k++) { await q.waitForTimeout(250); const on = await q.$eval('.snap.song', e => e.querySelector('.sec[data-on="1"] b')?.textContent || '—'); if (seen.at(-1) !== on) seen.push(on); }
  const kick = await q.$eval('#parts .prow', e => e.dataset.rest), playing = await q.getAttribute('#play', 'aria-pressed');
  check('a song plays its sections in turn on the bar and stops at its end', seen.join() === 'part 1,part 2,—' && kick === '1' && playing === 'false', `${seen.join(' → ')}, kick resting: ${kick}, playing: ${playing}`); await q.close(); }
// a song's parts as you change them: going to a part changes nothing; a sound changed there is kept as your version of
// that part (marked, and said what changed), comes back when you return to it, Claude's can be heard without losing
// yours, and Revert puts Claude's back
{ const q = await browser.newPage({viewport: {width: 1300, height: 1300}}); q.on('pageerror', e => { failed = true; console.log('FAIL jam page error:', e.message); });
  await q.goto(url + 'studio/listen/jam-live.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(2000);
  await q.keyboard.press('s'); const scene = await q.evaluate(() => JSON.parse(localStorage.getItem('studio.jam.snaps'))[0]);
  await q.evaluate(x => window.__jamIdeas([x]), {id: 'u', kind: 'song', name: 'Edit me', round: 9, bpm: scene.bpm, sections: [1, 2].map(i => ({...scene, id: 'u.' + i, name: `Edit me: part ${i}`, bars: 4}))});
  const edits = () => q.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('studio.jam.songedits') || '{}')).join()), sound = () => q.$eval('#parts .prow[data-part="col3"] .psub', e => e.textContent);
  const chip = i => q.click(`.snap.song .sec >> nth=${i}`);
  await chip(1); await chip(0); await q.waitForTimeout(1700); const none = await edits();
  await q.keyboard.press('r'); await q.click('#ctabs button:has-text("Sound")'); const pick = await q.$eval('#soundList .snd:not([data-on="1"]) b', e => e.textContent);
  await q.click(`#soundList .snd:has-text("${pick}")`); await q.waitForTimeout(1700); const kept = await edits(), said = await q.textContent('#songBar .sdchanges'), marked = await q.$$eval('.sec[data-ed="1"]', x => x.length);
  await chip(1); await q.waitForTimeout(100); const other = await sound(); await chip(0); await q.waitForTimeout(100); const back = await sound();
  await q.click('#songBar button:has-text("Hear Claude")'); await q.waitForTimeout(1700); const orig = [await sound(), await edits()]; await q.click('#songBar button:has-text("Back to yours")'); const yours = await sound();
  await q.click('#songBar button:has-text("Revert this part")'); await q.waitForTimeout(1700); const reverted = [await edits(), await sound()];
  check('going to a song\'s parts changes nothing', none === '', none);
  check('a sound changed on a part is kept as your version, marked and said', kept === 'u.1' && said.includes(pick) && marked === 1 && other !== pick && back === pick, `${kept}: ${said}; others ${other}, back ${back}`);
  check('Claude\'s part heard without losing yours, and Revert puts it back', orig[0] === other && orig[1] === 'u.1' && yours === pick && reverted[0] === '' && reverted[1] === other, JSON.stringify({orig, yours, reverted})); await q.close(); }
// the harmony in the jam's page: a chord held from the matrix, a progression written, played and saved, the library in a
// key, and a snapshot bringing a library progression back
{ const q = await browser.newPage({viewport: {width: 1300, height: 1300}}); q.on('pageerror', e => { failed = true; console.log('FAIL jam page error:', e.message); }); q.on('dialog', d => d.type() === 'prompt' ? d.accept('Night walk') : d.accept());
  await q.goto(url + 'studio/listen/jam-live.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(2000);
  const words = () => q.textContent('#hWords');
  await q.click('#hTabs button:has-text("Chords")'); const shown = await q.$eval('#harmonies', e => getComputedStyle(e).display), cells = await q.$$eval('#hMat .mcell:not(.empty)', x => x.length);
  await q.click('#hMat .mcell:text-is("Fmaj9")'); const held = await words(), heldNext = await q.$$eval('#hMat .mcell[data-on="1"], #hMat .mcell[data-next="1"]', x => x.map(e => e.textContent));
  check('the matrix: the chords of the key, the pack\'s row hidden, a chord tapped held', cells >= 30 && shown === 'none' && /Held from the matrix/.test(held) && heldNext.includes('Fmaj9'), `${cells} chords, ${heldNext}`);
  await q.click('#hMat .mwrite .tog'); for (const c of ['Am9', 'Fmaj9', 'Cadd9']) await q.click(`#hMat .mcell:text-is("${c}")`); await q.click('#hMine .mchord >> nth=0');
  const mine = await q.$$eval('#hMine .mchord', x => x.map(e => e.textContent.replace('✕', ''))); await q.click('#hMine button:has-text("Play it")'); const playing = await words();
  await q.click('#hMine button:has-text("Save")'); const yours = await q.$$eval('#hYours .libitem b', x => x.map(e => e.textContent));
  check('a progression written in the matrix plays and is saved as yours', mine.join() === 'Am9×2,Fmaj9×1,Cadd9×1' && /Written in the matrix/.test(playing) && yours.includes('Night walk'), [mine.join(' '), yours].join(' / '));
  await q.click('#hTabs button:has-text("Library")'); await q.selectOption('#hLib select', 'F'); await q.click('#hLib .libitem:has-text("Aeolian loop")');
  const line = await q.$eval('#hLib .libitem[data-on="1"] span', e => e.textContent); await q.keyboard.press('s'); await q.waitForTimeout(200);
  await q.click('#hTabs button:has-text("This pack")'); await q.click('#harmonies .hchip >> nth=1'); await q.keyboard.press('Shift+Digit1'); await q.waitForTimeout(200);
  check('the library in F minor, kept by a snapshot and brought back', /^Fm9 → D♭maj9 → A♭add9 → E♭add9/.test(line) && /minor loop/.test(await words()), line); }
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
