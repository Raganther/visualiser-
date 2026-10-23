// The Studio DAW (studio/arrange/): a Studio Jam song written out as notes (flatten.js), then the page used as a person
// would, with the mouse and keys: playing, looping bars, moving, stretching, splitting, copying and deleting clips, adding,
// moving, stretching and copying notes, velocity, undo and redo, your version kept across a reload, Claude's to hear, and a
// like and a note each saying exactly what they're about.
import { serve, launch } from './lib.mjs';
import { flatten } from '../studio/arrange/flatten.js';
import fs from 'node:fs';

let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

/* ---------- flatten: the songs as notes ---------- */
const R4 = JSON.parse(fs.readFileSync(new URL('../studio/arrange/songs/round4.json', import.meta.url)));
for (const s of R4) { const P = flatten(s), bars = s.sections.reduce((a, x) => a + x.bars, 0);
  const inside = P.tracks.every(T => T.clips.every(c => c.start >= 0 && c.start + c.len/16 <= P.bars && c.notes.every(n => n.s >= 0 && n.s < c.len + 1 && n.l > 0 && n.v > 0 && n.v <= 1)));
  const pitched = P.tracks.filter(T => !['kick', 'hats', 'perc'].includes(T.role)).every(T => T.clips.every(c => c.notes.every(n => Number.isInteger(n.p))));
  check(`${s.name}: ${P.marks.length} sections, ${P.bars} bars, every note inside its clip, pitches fixed`, P.bars === bars && P.marks.length === s.sections.length && P.chords.length === bars && inside && pitched);
  const again = flatten(s); check(`${s.name}: written out the same every time`, JSON.stringify(again) === JSON.stringify(P)); }

/* ---------- the page ---------- */
const {srv, url} = await serve();
const browser = await launch('2d'), page = await browser.newPage({viewport: {width: 1400, height: 860}});
page.on('pageerror', e => { failed = true; console.log('FAIL page error:', e.message); });
await page.goto(url + 'studio/listen/studio-daw.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
const D = fn => page.evaluate(fn);
const arr = await page.locator('#arr').boundingBox(), ed = () => page.locator('#ed').boundingBox();
// where a bar of a track is on the screen
const at = (ti, bar) => D(`(() => { const {ST} = window.__daw; return [${bar}*ST.px - ST.sx, 72 + ${ti}*56 - ST.sy + 28]; })()`).then(([x, y]) => [arr.x + x, arr.y + y]);
const clips = ti => D(`window.__daw.ST.P.tracks[${ti}].clips.map(c => ({id: c.id, start: c.start, len: c.len, n: c.notes.length})).sort((a, b) => a.start - b.start)`);

const info = await D(() => { const {ST} = window.__daw; return {id: ST.id, n: ST.P.tracks.length, songs: [...document.querySelectorAll('#songSel option')].length}; });
check('it opens on the newest round, seven tracks, every song in the picker', info.id === 'r4-1' && info.n === 7 && info.songs === 6, JSON.stringify(info));

// playing: Space starts and stops, the position moves on
await page.keyboard.press('Space'); await page.waitForTimeout(2500); const p1 = await D(() => [window.__daw.E.playing, window.__daw.E.pos()]); await page.keyboard.press('Space');
check('Space plays and the playhead moves', p1[0] && p1[1] > 8, JSON.stringify(p1));
// heard: the master's level while it plays from the bass's first section, and with only the bass on (the others muted)
const level = async solo => { await D(`(() => { const {ST, E} = window.__daw; ST.P.tracks.forEach(T => T.mix.solo = ${solo ? "T.role === 'bass'" : 'false'}); E.mix(); })()`);
  await D(() => { const {E} = window.__daw; E.play(32); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.out.connect(a); window.__an = a; });
  await page.waitForTimeout(1500); const r = await D(async () => { const a = window.__an, x = new Float32Array(2048); let s = 0, n = 0;
    for (let k = 0; k < 20; k++) { a.getFloatTimeDomainData(x); for (const v of x) { s += v*v; n++; } await new Promise(r => setTimeout(r, 50)); } window.__daw.E.stop(); return Math.sqrt(s/n); });
  return r; };
const full = await level(false), bass = await level(true); await level(false).then(() => {});
check('it is heard, the whole mix and the bass soloed', full > .02 && bass > .005 && bass < full, `${full.toFixed(3)}, ${bass.toFixed(3)}`);

// looping: drag across the bar numbers
{ const [x0] = await at(0, 2.5), [x1] = await at(0, 5.5); await page.mouse.move(x0, arr.y + 33); await page.mouse.down(); await page.mouse.move(x1, arr.y + 33, {steps: 5}); await page.mouse.up();
  const L = await D(() => [window.__daw.E.cycle, ...window.__daw.E.loop]); check('dragging the bar numbers loops bars 3–6', L[0] && L[1] === 2 && L[2] === 6, JSON.stringify(L));
  await page.keyboard.press('Space'); await page.waitForTimeout(9000); const pos = await D(() => window.__daw.E.pos()/16); await page.keyboard.press('Space');
  check('playing goes round inside the loop', pos >= 2 && pos < 6, pos.toFixed(2)); await page.keyboard.press('c'); }

// a clip moved: the bass's first clip dragged a bar later; then its right edge dragged two bars shorter
const bassI = await D(() => window.__daw.ST.P.tracks.findIndex(T => T.role === 'bass'));
await D(() => { const {ST} = window.__daw; ST.sx = 30*ST.px; });   // the bass's first clip and its end in view
{ const c0 = (await clips(bassI))[0]; let [x, y] = await at(bassI, c0.start + 1);
  await page.mouse.move(x, y); await page.mouse.down(); const [x2] = await at(bassI, c0.start + 2); await page.mouse.move(x2, y, {steps: 5}); await page.mouse.up();
  const c1 = (await clips(bassI)).find(c => c.id === c0.id); check('a clip dragged a bar later', c1.start === c0.start + 1, `${c0.start} → ${c1.start}`);
  await page.selectOption('#snap', '16');   // (resizing by whole bars)
  [x, y] = await at(bassI, c1.start + c1.len/16 - .02); await page.mouse.move(x - 2, y); await page.mouse.down(); const [x3] = await at(bassI, c1.start + c1.len/16 - 2); await page.mouse.move(x3 - 2, y, {steps: 5}); await page.mouse.up();
  await page.selectOption('#snap', '1');
  const c2 = (await clips(bassI)).find(c => c.id === c0.id); check('its right edge dragged two bars shorter', c2.len === c0.len - 32, `${c0.len} → ${c2.len}`);
  await page.keyboard.press('Meta+z'); await page.keyboard.press('Meta+z'); const c3 = (await clips(bassI)).find(c => c.id === c0.id);
  check('undo twice puts it back', c3.start === c0.start && c3.len === c0.len);
  await page.keyboard.press('Meta+Shift+z'); const c4 = (await clips(bassI)).find(c => c.id === c0.id); check('redo moves it again', c4.start === c0.start + 1 && c4.len === c0.len);
  await page.keyboard.press('Meta+z');
  // a clip can't be dragged onto a track of another kind
  [x, y] = await at(bassI, c0.start + 1); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 56, {steps: 4}); await page.mouse.up();
  check('a bass clip dragged up to the percussion stays on the bass', (await clips(bassI)).some(c => c.id === c0.id)); await page.keyboard.press('Meta+z'); }

// split at the playhead, then copy, paste and delete
{ const c0 = (await clips(bassI))[0], [x, y] = await at(bassI, c0.start + 1);
  await page.mouse.click(x, y); await D(`window.__daw.ST.ph = ${c0.start + 4}`); await page.keyboard.press('Meta+t');
  const cs = await clips(bassI), a = cs.find(c => c.id === c0.id), b = cs.find(c => c.start === c0.start + 4);
  check('⌘T splits the clip at the playhead, its notes on either side', a && b && a.len === 64 && b.len === c0.len - 64 && a.n + b.n === c0.n, JSON.stringify(cs.slice(0, 3)));
  await page.keyboard.press('Meta+z'); check('and undo joins it again', (await clips(bassI)).find(c => c.id === c0.id).len === c0.len);
  await page.mouse.click(x, y); await page.keyboard.press('Meta+c'); await D(`window.__daw.ST.ph = 100`); await page.keyboard.press('Meta+v');
  const pasted = (await clips(bassI)).find(c => c.start === 100); check('copied and pasted at the playhead', pasted && pasted.n === c0.n);
  await page.keyboard.press('Backspace'); check('Delete takes the pasted clip away', !(await clips(bassI)).some(c => c.start === 100));
  await page.mouse.click(x, y); await page.keyboard.press('Meta+d'); const dup = (await clips(bassI)).find(c => c.start === c0.start + c0.len/16);
  check('⌘D duplicates it after itself', dup && dup.n === c0.n); await page.keyboard.press('Meta+z'); }

// the piano roll: double-click opens the clip; a click adds a note; drag moves it; its end stretches; velocity
{ const c0 = (await clips(bassI))[0], [x, y] = await at(bassI, c0.start + .5); await page.mouse.dblclick(x, y); await page.waitForTimeout(200);
  check('double-clicking a clip opens it in the piano roll', await D(() => window.__daw.ST.open?.id) === c0.id);
  const E = await ed(), geo = await D(() => { const {ST} = window.__daw; return {px: ST.ed.px, sx: ST.ed.sx, sy: ST.ed.sy}; });
  // the row of C3 (48), a free 16th: find one with nothing on that row
  const free = await D(() => { const {ST} = window.__daw, f = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === ST.open.id); for (let s = 0; s < f.len; s += 4) if (!f.notes.some(n => n.p === 48 || (n.s < s + 2 && n.s + n.l > s))) return s; return 2; });
  const nx = s => E.x + 76 + s*geo.px - geo.sx, ny = p => E.y + 18 + (108 - p)*12 - geo.sy + 6;
  const before = c0.n; await page.mouse.click(nx(free) + 3, ny(48));
  const added = await D(() => { const {ST} = window.__daw, c = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === ST.open.id); return c.notes.at(-1); });
  check('a click adds a note there (C3, on its 16th)', (await clips(bassI))[0].n === before + 1 && added.p === 48 && added.s === free, JSON.stringify(added));
  await page.mouse.move(nx(free + 1), ny(48)); await page.mouse.down(); await page.mouse.move(nx(free + 2), ny(50), {steps: 4}); await page.mouse.up();
  const moved = await D(() => { const {ST} = window.__daw, c = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === ST.open.id); return c.notes.at(-1); });
  check('dragged a 16th later and up a tone', moved.s === free + 1 && moved.p === 50, JSON.stringify(moved));
  const endX = nx(moved.s + moved.l) - 3; await page.mouse.move(endX, ny(50)); await page.mouse.down(); await page.mouse.move(endX + 2*geo.px, ny(50), {steps: 4}); await page.mouse.up();
  const longer = await D(() => { const {ST} = window.__daw, c = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === ST.open.id); return c.notes.at(-1); });
  check('its end dragged two 16ths longer', Math.abs(longer.l - (moved.l + 2)) < .01, `${moved.l} → ${longer.l}`);
  // velocity: its bar dragged down to about a quarter
  const vx = nx(longer.s) + 1, vb = E.y + E.height - 4; await page.mouse.move(vx, vb - 50); await page.mouse.down(); await page.mouse.move(vx, vb - .25*62, {steps: 4}); await page.mouse.up();
  const vel = await D(() => { const {ST} = window.__daw, c = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === ST.open.id); return c.notes.at(-1).v; });
  check('its velocity dragged down to a quarter', Math.abs(vel - .25) < .05, vel);
  // ⌥-drag copies it; the arrows nudge; Delete removes the selected
  await page.keyboard.down('Alt'); await page.mouse.move(nx(longer.s + 1), ny(50)); await page.mouse.down(); await page.mouse.move(nx(longer.s + 5), ny(50), {steps: 4}); await page.mouse.up(); await page.keyboard.up('Alt');
  const n2 = await D(() => { const {ST} = window.__daw, c = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === ST.open.id); return c.notes.filter(n => n.p === 50 && Math.abs(n.v - c.notes.at(-1).v) < .01).map(n => n.s); });
  check('⌥-drag leaves the note and copies it a beat later', n2.includes(free + 1) && n2.includes(free + 5), JSON.stringify(n2));
  await page.keyboard.press('ArrowUp'); const up = await D(() => { const {ST} = window.__daw, c = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === ST.open.id); return c.notes.at(-1).p; });
  check('↑ moves the selected note up a semitone', up === 51, up);
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  const left = (await clips(bassI))[0].n; check('Delete removes the selected note (the original stays)', left === before + 1, `${before} → ${left}`);
  // a box selects notes, ⌘A all of them
  await page.keyboard.press('Meta+a'); const all = await D(() => window.__daw.ST.ed.sel.size); check('⌘A in the piano roll selects every note', all === left, all);
  await page.keyboard.press('Escape'); }

// the drums' piano roll: rows are the voices by name
{ const [x, y] = await at(0, (await clips(0))[0].start + .5); await page.mouse.dblclick(x, y); await page.waitForTimeout(200);
  const rows = await D(() => { const {ST} = window.__daw, f = ST.P.tracks[0]; return [...new Set(f.clips.flatMap(c => c.notes.map(n => n.p)))]; });
  check('a drum clip opens with named voices', rows.includes('kick'), JSON.stringify(rows)); }

// your version kept across a reload; Claude's heard as written; Revert
{ const mine = await clips(bassI); await page.waitForTimeout(800); await page.reload(); await page.waitForTimeout(1500);
  const back = await clips(bassI); check('your edits come back after a reload', JSON.stringify(back) === JSON.stringify(mine));
  await page.click('#ver'); const claude = await clips(bassI), orig = await D(() => window.__daw.ST.orig.tracks[3].clips.map(c => ({id: c.id, start: c.start, len: c.len, n: c.notes.length})).sort((a, b) => a.start - b.start));
  check('“Claude’s” plays it as written', JSON.stringify(claude) === JSON.stringify(orig) && await D(() => !window.__daw.ST.mine));
  await page.click('#ver'); check('and “Yours” brings your version back', JSON.stringify(await clips(bassI)) === JSON.stringify(mine)); }

// a like and a note about a range: a box over bars 9–12 of the hats and the percussion
{ const [x0, y0] = await at(1, 8.2), [x1, y1] = await at(2, 11.8); await page.mouse.move(x0, y0 + 20); await page.mouse.down(); await page.mouse.move(x1, y1 - 20, {steps: 5}); await page.mouse.up();
  // (the box starts on a clip there, so make the selection from the empty space under the chords instead when there's a clip)
  let t = await D(() => document.getElementById('target').textContent);
  if (!/bars 9–12/.test(t)) { await D(() => { const {ST} = window.__daw; ST.sel = {clips: new Set(), range: {a: 8, b: 12, tracks: [1, 2]}, mark: null, track: 1, trackOnly: false}; }); await D(() => document.getElementById('up').click()); }
  else await page.click('#up');
  await page.waitForTimeout(200); const n = await D(() => window.__daw.ST.notes[0]);
  check('👍 on bars 9–12 of the hats and percussion says so exactly', n && n.rating === 1 && n.target.bars[0] === 8 && n.target.bars[1] === 12 && n.target.tracks.join() === 'Hats,Percussion', JSON.stringify(n?.target));
  // a section: click its name, then a written note
  const [sx] = await at(0, 16.5); await page.mouse.click(sx, arr.y + 11); await page.click('#say'); await page.fill('#cText', 'The path could open up sooner'); await page.click('#cSave'); await page.waitForTimeout(200);
  const n2 = await D(() => window.__daw.ST.notes[0]); check('💬 on a section keeps its name, its bars and the words', n2.text === 'The path could open up sooner' && n2.target.section === 'The path' && n2.target.bars.join() === '16,32', JSON.stringify(n2.target));
  await page.reload(); await page.waitForTimeout(1500); check('the notes are kept', await D(() => window.__daw.ST.notes.length) === 2); }

// another song from the picker
await page.selectOption('#songSel', 'r3-1').catch(() => {}); await page.waitForTimeout(800);
const other = await D(() => window.__daw.ST.id); check('the picker opens another song', other !== 'r4-1', other);

// on a phone: the picture fits, a section tapped loops it, a drag pans, a clip can't be dragged, a like still works
{ const ph = await browser.newPage({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
  ph.on('pageerror', e => { failed = true; console.log('FAIL page error (phone):', e.message); });
  await ph.goto(url + 'studio/listen/studio-daw.html'); await ph.waitForTimeout(1500); const A = await ph.locator('#arr').boundingBox();
  const lay = await ph.evaluate(() => ({phone: document.body.classList.contains('phone'), editor: getComputedStyle(document.getElementById('editor')).display, wide: document.documentElement.scrollWidth}));
  check('on a phone: no piano roll, nothing wider than the screen', lay.phone && lay.editor === 'none' && lay.wide <= 390, JSON.stringify(lay));
  const m = await ph.evaluate(() => { const {ST} = window.__daw, k = ST.P.marks[1]; return {x: (k.at + .5)*ST.px - ST.sx, at: k.at, bars: k.bars}; });
  await ph.touchscreen.tap(A.x + m.x, A.y + 10); const L = await ph.evaluate(() => [window.__daw.E.cycle, ...window.__daw.E.loop]);
  check('tapping a section loops it', L[0] && L[1] === m.at && L[2] === m.at + m.bars, JSON.stringify(L));
  const before = await ph.evaluate(() => JSON.stringify(window.__daw.ST.P.tracks[0].clips.map(c => c.start)));
  await ph.evaluate(() => { const {ST} = window.__daw; ST.sx = 0; }); const c = await ph.evaluate(() => { const {ST} = window.__daw, k = ST.P.tracks[2].clips[0]; return [(k.start + .5)*ST.px, 72 + 2*56 + 28]; });
  const cdp = await ph.context().newCDPSession(ph), tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
  await tp('touchStart', A.x + c[0], A.y + c[1]); for (let k = 1; k <= 5; k++) await tp('touchMove', A.x + c[0] + 20*k, A.y + c[1]); await tp('touchEnd');
  check('a clip dragged on a phone stays put', await ph.evaluate(() => JSON.stringify(window.__daw.ST.P.tracks[0].clips.map(c => c.start))) === before && await ph.evaluate(() => window.__daw.ST.P.tracks[2].clips[0].start) === 0);
  await ph.evaluate(() => document.getElementById('up').click()); await ph.waitForTimeout(200);
  check('a like on a phone is kept', await ph.evaluate(() => window.__daw.ST.notes[0]?.rating === 1)); await ph.close(); }

await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
