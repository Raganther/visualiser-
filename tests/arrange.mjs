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
// the drum rack: a song's kick, hats and percussion as one track, every note kept on its pad, each part's settings on its pads
{ const {combineDrums, inputsOf} = await import('../studio/arrange/rack.js'), LIB = JSON.parse(fs.readFileSync(new URL('../studio/listen/packs/library.json', import.meta.url))), SND = Object.fromEntries(LIB.sounds.map(x => [x.id, x]));
  for (const s of R4) { const P = flatten(s), Q = combineDrums(P, SND), R = Q.tracks[0], all = T => T.clips.flatMap(c => c.notes.map(n => (c.start*16 + n.s).toFixed(3) + n.p)).sort().join();
    const io = inputsOf(Q, SND), hats = P.tracks.find(T => T.role === 'hats');
    check(`${s.name}: the kick, hats and percussion as one drum rack track, every note in place on its pad, each part's level, pan and tone on its pads, a desk input a pad`,
      Q.tracks.length === P.tracks.length - 2 && R.role === 'drums' && all(R) === P.tracks.slice(0, 3).map(all).join().split(',').sort().join() && R.pads.chh.vol === hats.mix.vol && R.pads.chh.pan === hats.mix.pan && R.pads.chh.x === hats.set.x
      && io[0].pads.length === 19 && io[1].base === 19 && JSON.stringify(combineDrums(Q, SND)) === JSON.stringify(Q)); } }

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

const info = await D(() => { const {ST} = window.__daw; return {id: ST.id, n: ST.P.tracks.length, drums: ST.P.tracks[0].role, songs: [...document.querySelectorAll('#songSel option')].length}; });
check('it opens on the newest round, five tracks (the drums one rack), every song in the picker', info.id === 'r4-1' && info.n === 5 && info.drums === 'drums' && info.songs === 6, JSON.stringify(info));

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
{ await D(() => { window.__daw.ST.sx = 0; }); const [x, y] = await at(0, (await clips(0))[0].start + .5); await page.mouse.dblclick(x, y); await page.waitForTimeout(200);
  const rows = await D(() => { const {ST} = window.__daw, f = ST.P.tracks[0]; return [...new Set(f.clips.flatMap(c => c.notes.map(n => n.p)))]; });
  check('a drum clip opens with named voices', rows.includes('kick'), JSON.stringify(rows));
  // a drum's name clicked: its row picked, the velocity lane its hits alone; clicked again, let go
  const E2 = await ed(), rh = await D(() => { const {ST} = window.__daw; return null; }); await page.mouse.click(E2.x + 20, E2.y + 18 + 8); const r1 = await D(() => window.__daw.ST.ed.row);
  check('clicking a drum’s name picks its row (the velocity lane its hits alone), the same drum in the Instrument tab', r1 === 'kick' && await D(() => window.__daw.SB.voice()) === 'kick', JSON.stringify([r1, await D(() => [window.__daw.SB.voice(), window.__daw.ST.sel.track, window.__daw.ST.open?.id])]));
  await page.click('#tabMix'); await page.waitForTimeout(500); await page.locator('#mxDesk .mxs[data-strip="rack/chh"] .sname').click(); await page.click('#tabNotes'); await page.waitForTimeout(200);
  check('and a pad picked in the Mixer is the drum picked in the notes', await D(() => window.__daw.ST.ed.row === 'chh' && window.__daw.SB.voice() === 'chh')); }

// your version kept across a reload; Claude's heard as written; Revert
{ const mine = await clips(bassI); await page.waitForTimeout(800); await page.reload(); await page.waitForTimeout(1500);
  const back = await clips(bassI); check('your edits come back after a reload', JSON.stringify(back) === JSON.stringify(mine));
  await page.click('#ver'); const claude = await clips(bassI), orig = await D(() => window.__daw.ST.orig.tracks[1].clips.map(c => ({id: c.id, start: c.start, len: c.len, n: c.notes.length})).sort((a, b) => a.start - b.start));
  check('“Claude’s” plays it as written', JSON.stringify(claude) === JSON.stringify(orig) && await D(() => !window.__daw.ST.mine));
  await page.click('#ver'); check('and “Yours” brings your version back', JSON.stringify(await clips(bassI)) === JSON.stringify(mine)); }

// a like and a note about a range: a box over bars 9–12 of the drums and the bass
{ const [x0, y0] = await at(0, 8.2), [x1, y1] = await at(1, 11.8); await page.mouse.move(x0, y0 + 20); await page.mouse.down(); await page.mouse.move(x1, y1 - 20, {steps: 5}); await page.mouse.up();
  // (the box starts on a clip there, so make the selection from the empty space under the chords instead when there's a clip)
  let t = await D(() => document.getElementById('target').textContent);
  if (!/bars 9–12/.test(t)) { await D(() => { const {ST} = window.__daw; ST.sel = {clips: new Set(), range: {a: 8, b: 12, tracks: [0, 1]}, mark: null, track: 0, trackOnly: false}; }); await D(() => document.getElementById('up').click()); }
  else await page.click('#up');
  await page.waitForTimeout(200); const n = await D(() => window.__daw.ST.notes[0]);
  check('👍 on bars 9–12 of the drums and bass says so exactly', n && n.rating === 1 && n.target.bars[0] === 8 && n.target.bars[1] === 12 && n.target.tracks.join() === 'Drums,Bass', JSON.stringify(n?.target));
  // a section: click its name, then a written note
  const [sx] = await at(0, 16.5); await page.mouse.click(sx, arr.y + 11); await page.click('#say'); await page.fill('#cText', 'The path could open up sooner'); await page.click('#cSave'); await page.waitForTimeout(200);
  const n2 = await D(() => window.__daw.ST.notes[0]); check('💬 on a section keeps its name, its bars and the words', n2.text === 'The path could open up sooner' && n2.target.section === 'The path' && n2.target.bars.join() === '16,32', JSON.stringify(n2.target));
  await page.reload(); await page.waitForTimeout(1500); check('the notes are kept', await D(() => window.__daw.ST.notes.length) === 2); }

// another song from the picker
await page.selectOption('#songSel', 'r3-1').catch(() => {}); await page.waitForTimeout(800);
const other = await D(() => window.__daw.ST.id); check('the picker opens another song', other !== 'r4-1', other);

// the sound panel: a track's sound's name opens it; every sound grouped by how it's made; one tried on the track's notes
// is heard; Use puts it on the track (or only on the selected clips); a setting changed makes your own copy, heard, kept
// with the song and in your library; undo; a drum voice's and the poly synth's own settings; asking Claude for a sound
{ await page.reload(); await page.waitForTimeout(1500); const bi = await D(() => window.__daw.ST.P.tracks.findIndex(T => T.role === 'bass'));
  await page.locator('.trk').nth(bi).locator('.snd').click(); await page.waitForTimeout(300);
  const lib = await D(() => ({open: !document.getElementById('side').hidden, fams: [...document.querySelectorAll('.fam')].map(f => f.textContent.replace(/[▾▸]\s*/, '').replace(/\s*\d+$/, '')), rows: document.querySelectorAll('.snd-row').length, on: document.querySelector('.snd-row[data-on="1"]')?.dataset.id, cur: window.__daw.ST.P.tracks[1].sound}));
  const syn = await D(() => ({by: [...document.querySelectorAll('#sdBy button')].map(b => [b.textContent, b.getAttribute('aria-pressed')]), words: document.querySelectorAll('.fam-words').length,
    fm: (() => { const out = []; let f = null; for (const el of document.getElementById('sdList').children) { if (el.classList.contains('fam')) f = el.textContent; else if (el.dataset.id && /FM/.test(f)) out.push(window.__daw.SND[el.dataset.id].src?.native); } return out; })()}));
  check('the bass’s sound opens the panel by synthesizer: every pitched sound under the synth it’s made on (FM, Resonator, Analog, Poly Synth, String, Pads), each with what it is, the one in use marked',
    lib.open && lib.rows > 40 && ['FM', 'Resonator', 'Analog', 'Poly Synth', 'String', 'Pads'].every(f => lib.fams.includes(f)) && syn.words === lib.fams.length && syn.fm.length && syn.fm.every(n => /^fm/.test(n)) && lib.on === lib.cur && syn.by[0][1] === 'true', JSON.stringify({lib, syn}));
  await page.locator('#sdSyn button', {hasText: /^Resonator$/}).click();
  const only = await D(() => ({fams: [...document.querySelectorAll('.fam')].map(f => f.textContent), ids: [...document.querySelectorAll('.snd-row')].map(r => r.dataset.id)}));
  check('a synth’s chip shows that synth alone (Resonator: the marimba, the bells …)', only.fams.length === 1 && /Resonator/.test(only.fams[0]) && only.ids.includes('l-marimba') && await D(`${JSON.stringify(only.ids)}.every(id => window.__daw.SB.synthOf(window.__daw.SND[id]) === 'resonator')`), JSON.stringify(only.fams));
  await page.locator('#sdSyn button', {hasText: 'All synths'}).click();
  await page.locator('#sdBy button', {hasText: 'By kind'}).click();
  const kinds = await D(() => [...document.querySelectorAll('.fam')].map(f => f.textContent.replace(/[▾▸]\s*/, '').replace(/\s*\d+$/, '')));
  check('By kind groups them by what they are (struck, bowed, FM, analog …) instead', kinds.includes('Bowed and rubbed') && kinds.includes('Poly synth') && kinds.includes('FM'), JSON.stringify(kinds));
  await page.locator('#sdBy button', {hasText: 'By synth'}).click();
  await page.locator('#sdRoles button', {hasText: 'Bass'}).click(); const nb = await D(() => [...document.querySelectorAll('.snd-row')].every(r => window.__daw.SND[r.dataset.id].role === 'bass'));
  check('the Bass filter leaves only bass sounds', nb); await page.locator('#sdRoles button', {hasText: 'All'}).click();
  await page.fill('#sdSearch', 'marimba'); const found = await D(() => [...document.querySelectorAll('.snd-row')].map(r => r.dataset.id)); check('searching finds the marimba', found.includes('l-marimba'), JSON.stringify(found)); await page.fill('#sdSearch', '');
  // tried: heard on the master while the song is stopped
  await D(() => { const {E} = window.__daw; E.init(); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.out.connect(a); window.__an = a; });
  await page.locator('.snd-row[data-id="b2-sub"]').click(); let peak = 0;
  for (let k = 0; k < 40 && peak < .01; k++) { await page.waitForTimeout(100); peak = await D(() => { const x = new Float32Array(2048); window.__an.getFloatTimeDomainData(x); return Math.max(...x.map(Math.abs)); }); }
  check('clicking a sound plays it on the bass’s notes', peak > .01, peak.toFixed(3));
  await page.locator('.snd-row[data-id="b2-sub"] .use').click(); check('Use puts it on the whole track', await D(() => window.__daw.ST.P.tracks[1].sound) === 'b2-sub');
  await page.keyboard.press('Meta+z'); check('and undo takes it back', await D(() => window.__daw.ST.P.tracks[1].sound) === lib.cur);
  // only the selected clip: the bass's second clip
  const cl = await D(() => window.__daw.ST.P.tracks[1].clips.map(c => c.id).sort()); await D(`(() => { const {ST} = window.__daw; ST.sel.track = 1; ST.sel.clips = new Set(['${cl[1]}']); })()`); await D(() => window.__daw.SB.render());
  const scope = await D(() => document.getElementById('sdScope').textContent); await page.locator('.snd-row[data-id="l-marimba"]').dblclick();
  const per = await D(`window.__daw.ST.P.tracks[1].clips.map(c => [c.id, c.set?.sound || null])`);
  check('with a clip selected, only that clip takes the sound', /1 selected clip/.test(scope) && per.find(p => p[0] === cl[1])[1] === 'l-marimba' && per.filter(p => p[1] === 'l-marimba').length === 1, scope + ' ' + JSON.stringify(per));
  await page.keyboard.press('Meta+z'); await D(() => { window.__daw.ST.sel.clips = new Set(); window.__daw.SB.render(); });
  // the designer: a physical model's own settings, a change making your copy
  await page.click('#tabEdit'); const knobs = await D(() => [...document.querySelectorAll('#sdBody .knob .kl')].map(k => k.textContent));
  check('Edit shows the instrument’s own settings (FM: bend, ratio, decay)', knobs.includes('Instrument') && knobs.includes('Bend') && knobs.includes('Ratio'), knobs.join(', '));
  const r = page.locator('#sdBody .knob', {hasText: /^Bend[0-9.]/}).locator('input'), rb = await r.boundingBox(); await page.mouse.click(rb.x + rb.width*.95, rb.y + rb.height/2); await page.waitForTimeout(300);
  const mine = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[1].sound, s = SND[id]; return {id, name: s.name, base: s.base, knobs: s.src.knobs, kept: !!ST.P.sounds?.[id], lib: !!JSON.parse(localStorage.getItem('studio.daw.sounds') || '{}')[id]}; });
  check('moving Bend makes your own copy, with the setting, kept with the song and in your sounds', mine.id.startsWith('u-') && mine.base === lib.cur && mine.knobs?.index > 4 && mine.kept && mine.lib, JSON.stringify(mine));
  check('the library’s own sound is unchanged', await D(`!window.__daw.SND['${lib.cur}'].src.knobs`));
  await page.locator('#sdBody .knob', {hasText: 'Ratio'}).locator('input').evaluate(el => { el.value = 100; el.dispatchEvent(new Event('change')); });
  const two = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[1].sound; return [id, SND[id].src.knobs]; });
  check('a second change goes on the same copy', two[0] === mine.id && two[1].ratio < 1.5 && two[1].index > 4, JSON.stringify(two));
  await page.fill('#sdName', 'Glassy FM'); await page.locator('#sdName').dispatchEvent('change');
  await page.waitForTimeout(900); await page.reload(); await page.waitForTimeout(1500);
  const back = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[1].sound; return [id, SND[id]?.name, SND[id]?.mine]; });
  check('after a reload the bass plays your sound, by its name', back[0] === mine.id && back[1] === 'Glassy FM' && back[2], JSON.stringify(back));
  await page.locator('.trk').nth(1).locator('.snd').click(); await page.click('#tabLib');
  const under = await D(() => { let f = null; for (const el of document.getElementById('sdList').children) { if (el.classList.contains('fam')) f = el.textContent; else if (el.dataset?.id && window.__daw.SND[el.dataset.id].name === 'Glassy FM') return [f, !!el.querySelector('.yours')]; } return null; });
  check('by synth it’s under FM, the synth it was made on, marked as yours', under && /FM/.test(under[0]) && under[1], JSON.stringify(under));
  await page.locator('#sdBy button', {hasText: 'By kind'}).click();
  check('and by kind under Your sounds', await D(() => { const f = [...document.querySelectorAll('.fam')][0]; return f.textContent.includes('Your sounds'); }));
  await page.locator('#sdBy button', {hasText: 'By synth'}).click();
  // the hats: each voice its own settings; the chords on the poly synth: its oscillators, filter and envelopes
  await page.locator('.trk').nth(0).locator('.snd').click(); await page.click('#tabEdit');
  await page.locator('.voices button', {hasText: 'Open hat'}).click();
  const hv = await D(() => [[...document.querySelectorAll('.voices button')].map(b => b.textContent), [...document.querySelectorAll('#sdBody .knob .kl')].map(k => k.textContent)]);
  check('the drum rack’s pads (the kick, the hats, the percussion), each with its own settings', hv[0].includes('Open hat') && hv[1].includes('Open') && hv[1].includes('Tone'), JSON.stringify(hv));
  await page.locator('.voices button', {hasText: 'Open hat'}).click(); await page.locator('#sdBody .knob', {hasText: 'Open'}).first().locator('input').evaluate(el => { el.value = 900; el.dispatchEvent(new Event('change')); });
  const hk = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[0].sound]; return [s.mine, s.voices.ohh.knobs, s.voices.chh.knobs]; });
  check('opening the open hat changes that voice alone', hk[0] && hk[1]?.open > .8 && !hk[2], JSON.stringify(hk));
  await D(() => { window.__daw.ST.P.tracks[2].sound = 'c-warm'; }); await page.locator('.trk').nth(2).locator('.snd').click(); await page.click('#tabEdit');
  const groups = await D(() => [...document.querySelectorAll('#sdBody .grp')].map(g => g.textContent)); check('a poly synth sound shows its oscillators, filter and envelopes', ['Oscillators', 'Filter', 'Amp'].every(g => groups.includes(g)), groups.join(', '));
  await page.fill('#sdAskT', 'A hollow wooden bass, soft attack'); await page.click('#sdAskB'); await page.waitForTimeout(200);
  const ask = await D(() => window.__daw.ST.notes[0]); check('asking Claude for a sound keeps the words and the track', ask.text === 'A hollow wooden bass, soft attack' && ask.target.kind === 'sound' && ask.target.tracks[0] === 'Chords', JSON.stringify(ask.target));
  await D(() => window.__daw.SB.show(false)); }

// the instrument (B): the track's sound as a synth's front panel, its note drawn, knobs turned with the mouse and heard,
// the poly synth's filter graphed and heard at once, a keyboard played from the computer's keys, a kit's pads
{ await page.reload(); await page.waitForTimeout(1500); await D(() => { const {ST, E} = window.__daw; ST.P.tracks[1].sound = 'b-fmpluck'; E.refresh(); });   // (the library's FM pluck bass again)
  await page.locator('.trk').nth(1).click(); await page.keyboard.press('b');
  for (let k = 0; k < 60 && !(await D(() => !!window.__daw.SI.state().buf)); k++) await page.waitForTimeout(100);
  const st = await D(() => { const s = window.__daw.SI.state(); return {kind: s.M?.kind, buf: s.buf?.length || 0, cap: s.cap, mods: [...document.querySelectorAll('#iMods .mod h3')].map(x => x.textContent), knobs: [...document.querySelectorAll('#iMods .kn .kn-lab')].map(x => x.textContent), keys: document.querySelectorAll('#iKeys .wk').length, notes: getComputedStyle(document.getElementById('edWrap')).display}; });
  check('B shows the bass’s instrument: its model’s knobs, one note of it computed and drawn, a keyboard, in the notes’ place', st.kind === 'native' && st.buf > 1000 && /the model/.test(st.cap) && st.knobs.includes('Bend') && st.keys === 15 && st.notes === 'none', JSON.stringify(st));
  const was = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[1].sound; return [id, JSON.stringify(SND[id].src)]; });
  const bend = page.locator('#iMods .kn', {hasText: /^Bend[0-9.]/}), kb = await bend.boundingBox();
  await page.mouse.move(kb.x + kb.width/2, kb.y + 20); await page.mouse.down(); await page.mouse.move(kb.x + kb.width/2, kb.y - 120, {steps: 8}); await page.mouse.up(); await page.waitForTimeout(400);
  const k1 = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[1].sound]; return [s.mine, s.src.knobs?.index]; });
  check('dragging the Bend knob up turns it up, on your own copy', k1[0] && k1[1] > 3 && k1[1] > (JSON.parse(was[1]).knobs?.index ?? 0), JSON.stringify(k1));
  for (let k = 0; k < 60 && !(await D(() => /the model/.test(window.__daw.SI.state().cap))); k++) await page.waitForTimeout(100);
  check('and the note is drawn again from the changed model', await D(() => window.__daw.SI.state().buf?.length > 1000));
  await page.keyboard.press('Meta+z'); const und = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[1].sound; return [id, JSON.stringify(SND[id].src)]; });
  check('undo puts the library’s sound back', und[0] === was[0] && was[0] === 'b-fmpluck' && und[1] === was[1], JSON.stringify([was, und]));
  // the computer's keys play it: A is the keyboard's lowest C, held while it's down
  await D(() => { const {E} = window.__daw; E.init(); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.out.connect(a); window.__an = a; });
  const low = await D(() => +document.querySelector('#iKeys .wk').dataset.p); await page.keyboard.down('a'); let peak = 0;
  for (let k = 0; k < 30 && peak < .01; k++) { await page.waitForTimeout(100); peak = await D(() => { const x = new Float32Array(2048); window.__an.getFloatTimeDomainData(x); return Math.max(...x.map(Math.abs)); }); }
  const lit = await D(() => document.querySelector('#iKeys [data-down="1"]')?.dataset.p); await page.keyboard.up('a');
  check('the A key plays the keyboard’s lowest C and lights it', +lit === low && peak > .01, `${lit} ${low} ${peak.toFixed(3)}`);
  check('and the letters didn’t reach the page (A plays, it doesn’t select)', await D(() => window.__daw.ST.sel.clips.size === 0 && !document.getElementById('side').hidden === false));
  // the poly synth: its filter drawn, and turned while it's heard
  await D(() => { window.__daw.ST.P.tracks[2].sound = 'c-warm'; window.__daw.E.refresh(); }); await page.locator('.trk').nth(2).click(); await page.waitForTimeout(300);
  const pm = await D(() => ({mods: [...document.querySelectorAll('#iMods .mod h3')].map(x => x.textContent), graphs: document.querySelectorAll('#iMods canvas.graph').length}));
  check('a poly synth: oscillators, filter, amp, LFO, voices, output, with the filter’s curve and both envelopes drawn', ['Oscillators', 'Filter', 'Amp', 'LFO', 'Play', 'Output'].every(m => pm.mods.includes(m)) && pm.graphs === 3, JSON.stringify(pm));
  const cut = page.locator('#iMods .kn', {hasText: 'Cutoff'}), cb = await cut.boundingBox(); await page.mouse.move(cb.x + cb.width/2, cb.y + 20); await page.mouse.down();
  await page.mouse.move(cb.x + cb.width/2, cb.y + 100, {steps: 6}); const liveCut = await D(() => window.__daw.SI.state().M.values.cut); await page.mouse.up(); await page.waitForTimeout(300);
  const cut2 = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[2].sound]; return [s.mine, s.src.poly?.cut]; });
  check('turning the cutoff down moves the graph as it turns, and sets your copy when let go', liveCut < 1300 && cut2[0] && cut2[1] < 1300 && Math.abs(cut2[1] - liveCut) < liveCut*.05, `${liveCut} ${JSON.stringify(cut2)}`);
  await page.keyboard.press('Meta+z');
  // the hats: pads, one a voice; a pad pressed plays it and picks it
  await page.locator('.trk').nth(0).click(); await page.waitForTimeout(300); const pads = await D(() => [...document.querySelectorAll('#iKeys .pad')].map(p => p.dataset.p));
  await page.locator('#iKeys .pad[data-p="ohh"]').click(); await page.waitForTimeout(200);
  check('the drum rack’s instrument has a pad for each drum of its kit, and pressing one picks it', ['kick', 'chh', 'ohh', 'ride', 'tomL', 'wood'].every(p => pads.includes(p)) && await D(() => window.__daw.SI.state().M.voice) === 'ohh', pads.join());
  // a clip double-clicked goes back to its notes
  const [cx, cy] = await at(0, (await clips(0))[0].start + .5); await page.mouse.dblclick(cx, cy);
  check('double-clicking a clip shows its notes again', await D(() => !window.__daw.SI.isOn() && getComputedStyle(document.getElementById('edWrap')).display !== 'none')); }

// live: every native instrument, the poly synth and the drum machine computed sample by sample as they play (an
// AudioWorklet), the same code as the notes computed ahead; a key held holds the note, a knob turned is heard in the note
// sounding, and letting go keeps it ringing
{ await page.reload(); await page.waitForTimeout(1500);
  const lv = await D(() => new Promise(r => { const {E, ST} = window.__daw; E.init(); const t0 = Date.now(), w = () => E.liveOK || Date.now() - t0 > 6000 ? r({ok: E.liveOK, err: E.liveErr, t: ST.P.tracks.map((T, i) => [T.name, E.isLive(i)])}) : setTimeout(w, 50); w(); }));
  const L = Object.fromEntries(lv.t);
  const chordsPoly = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[2].sound]; return !!s.src?.palette && !['marimba', 'musicbox', 'steel', 'wood', 'tubular', 'vibes', 'metal'].includes(s.src.palette); });
  check('every track plays live: the kick, hats and percussion, the bass, the chords, both leads', lv.ok && lv.t.every(([, l]) => l), JSON.stringify(lv) + ' chords on the poly synth: ' + chordsPoly);
  const eq = await D(async () => { const {NATIVE} = await import('/studio/lib/native/index.js'), u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), out = {};
    for (const [name, engine, n, vel, len, params] of [['fmpluck', 'fm', 40, .8, .3, {index: 2.5}], ['fmround', 'fm', 36, .6, .6, {}], ['bamboo', 'md', 57, .9, null, {ring: 1.4}], ['marimba', 'md', 60, .7, null, {hard: .8}]]) {
      const sr = 44100, ctx = new OfflineAudioContext(2, sr*2, sr); await ctx.audioWorklet.addModule(u);
      const node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init: [{type: 'load', engine, name, gain: NATIVE[name].gain, params}, {type: 'on', id: 1, n, vel, t: .1}, ...(len ? [{type: 'off', id: 1, t: .1 + len}] : [])]}});
      node.connect(ctx.destination); const b = await ctx.startRendering(), ref = NATIVE[name].make(sr, n, vel, len ? {...params, len} : params), g = NATIVE[name].gain*(.4 + .6*vel), off = Math.round(.1*sr);
      let e = 0, s = 0; const m = Math.min(ref.L.length, sr*2 - off); for (let i = 0; i < m; i++) for (const [x, y] of [[ref.L[i]*g, b.getChannelData(0)[off + i]], [ref.R[i]*g, b.getChannelData(1)[off + i]]]) { e += (x - y)**2; s += x*x; }
      out[name] = +(10*Math.log10(e/s)).toFixed(1); } return out; });
  check('played live, each note is the same as computed ahead (the difference far below hearing)', Object.values(eq).every(v => v < -50), JSON.stringify(eq));
  // every native instrument: one note played live (held half a second where it's held) against the same note computed
  // ahead: the same code, so the same samples; the Resonator's live voice is its own (a rotation per mode), close to it
  const all = await D(async () => { const {NATIVE} = await import('/studio/lib/native/index.js'), {MODAL} = await import('/studio/lib/native/modal.js'), u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), sr = 44100, out = {};
    for (const name of Object.keys(NATIVE)) { const I = NATIVE[name], n = 57, vel = .7, len = .5, ctx = new OfflineAudioContext(2, sr*3, sr); await ctx.audioWorklet.addModule(u);
      const node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init: [{type: 'load', slots: {'': {name, gain: I.gain, params: {}}}}, {type: 'on', id: 1, n, vel, t: .1, len}, {type: 'off', id: 1, t: .1 + len}]}});
      node.connect(ctx.destination); const b = await ctx.startRendering(), ref = I.make(sr, n, vel, I.held ? {len} : {}), g = I.gain*(.4 + .6*vel), off = Math.round(.1*sr);
      let e = 0, s = 0; const m = Math.min(ref.L.length, sr*3 - off); for (let i = 0; i < m; i++) for (const [x, y] of [[ref.L[i]*g, b.getChannelData(0)[off + i]], [ref.R[i]*g, b.getChannelData(1)[off + i]]]) { e += (x - y)**2; s += x*x; }
      out[name] = [+(10*Math.log10(e/s + 1e-30)).toFixed(1), !!MODAL[name]]; } return out; });
  const same = Object.entries(all).filter(([, [d, md]]) => !md), mdl = Object.entries(all).filter(([, [, md]]) => md);
  check(`all ${Object.keys(all).length} native instruments play live: ${same.length} sample for sample as computed ahead, the ${mdl.length} Resonator sounds within -40 dB`, same.every(([, [d]]) => d < -100) && mdl.every(([, [d]]) => d < -40), JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, [d]]) => [k, d]))));
  // held: a knob turned while each held instrument sounds changes the note from that moment (the same note untouched
  // until then): the analog voice's tone and resonance, the bow's pressure, the bloom's darkness, the breath's focus …
  const KN = {vapad: ['tone', 0], vastrings: ['res', .9], vasub: ['drive', 1], bowed: ['bright', .1], glassharm: ['bright', .9], addpad: ['tilt', 2.4], breath: ['q', 15], grainpad: ['density', 4],
    formant: ['q', 18], fmround: ['indexEnd', 3], sub808: ['drive', 1], rumble: ['grit', 1], pluck: ['damp', .98]};
  const turned = await page.evaluate(async KN => { const {NATIVE} = await import('/studio/lib/native/index.js'), u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), sr = 22050, out = {};
    const one = async (name, set) => { const I = NATIVE[name], ctx = new OfflineAudioContext(2, sr*2.2, sr); await ctx.audioWorklet.addModule(u);
      const init = [{type: 'load', slots: {'': {name, gain: I.gain, params: {}}}}, {type: 'on', id: 1, n: 48, vel: .8, t: .05, len: 2}, ...(set ? [{type: 'set', params: set, t: 1}] : []), {type: 'off', id: 1, t: 2.05}];
      const node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init}}); node.connect(ctx.destination); return (await ctx.startRendering()).getChannelData(0); };
    for (const [name, [k, v]] of Object.entries(KN)) { const a = await one(name), b = await one(name, {[k]: v}), d = (x, y, i0, i1) => { let e = 0, s = 0; for (let i = i0; i < i1; i++) { e += (x[i] - y[i])**2; s += x[i]**2; } return 10*Math.log10(e/(s + 1e-20) + 1e-30); };
      out[name] = [+d(a, b, 0, sr).toFixed(0), +d(a, b, Math.round(1.05*sr), Math.round(1.6*sr)).toFixed(0)]; } return out; }, KN);
  check('a knob turned while a held note sounds changes it from that moment, on every kind of held instrument (unchanged before, changed after)', Object.values(turned).every(([pre, post]) => pre < -100 && post > -25), JSON.stringify(turned));
  // held: the round FM bass's note, a key held two seconds sounds on (computed ahead it would end after a beat)
  await D(() => { const {ST, E} = window.__daw; ST.P.tracks[1].sound = 'b-fmround'; E.refresh(); const a = E.ctx.createAnalyser(); a.fftSize = 4096; E.out.connect(a); window.__an = a; });
  await page.locator('.trk').nth(1).click(); if (!(await D(() => window.__daw.SI.isOn()))) await page.keyboard.press('b'); await page.waitForTimeout(400);
  check('the Instrument view says it plays live', await D(() => !document.getElementById('iLive').hidden));
  // and it says so when the live voices arrive after the panel is already showing (a fresh page: the instrument shown first)
  { const q = await browser.newPage({viewport: {width: 1400, height: 860}}); await q.goto(url + 'studio/listen/studio-daw.html'); await q.waitForTimeout(1200);
    await q.locator('.trk').nth(1).click(); await q.keyboard.press('b'); const before = await q.evaluate(() => [window.__daw.E.liveOK, document.getElementById('iLive').hidden]);
    await q.evaluate(() => window.__daw.E.init()); await q.waitForFunction(() => window.__daw.E.liveOK, null, {timeout: 6000}); await q.waitForTimeout(200);
    const after = await q.evaluate(() => !document.getElementById('iLive').hidden); await q.close();
    check('opened before the live voices arrive, the LIVE tag appears once they do', before[0] !== before[1] && after, JSON.stringify([before, after])); }   // (the tag as the voices were then, and shown once they're there)
  const rms = () => D(() => { const x = new Float32Array(4096); window.__an.getFloatTimeDomainData(x); return Math.sqrt(x.reduce((a, v) => a + v*v, 0)/x.length); });
  // (the spectrum's centre of mass, in Hz)
  const bright = () => D(() => { const a = window.__an, f = new Float32Array(a.frequencyBinCount); a.getFloatFrequencyData(f); let m = 0, all = 0; f.forEach((db, i) => { const p = Math.pow(10, db/10); all += p; m += p*i*a.context.sampleRate/a.fftSize; }); return m/all; });
  await page.keyboard.down('a'); await page.waitForTimeout(1800); const held = await rms(), b0 = await bright();
  // turned while it sounds: the held bend up, the held note brighter at once, before the knob is let go
  const kn = await page.locator('#iMods .kn', {hasText: 'Bend (held)'}).boundingBox(); await page.mouse.move(kn.x + kn.width/2, kn.y + 20); await page.mouse.down();
  await page.mouse.move(kn.x + kn.width/2, kn.y - 140, {steps: 8}); await page.waitForTimeout(250); const b1 = await bright();
  await page.mouse.up(); await page.waitForTimeout(500); const after = await rms(); await page.keyboard.up('a'); await page.waitForTimeout(700); const gone = await rms();
  check('a key held holds the note (still sounding after almost two seconds), and letting go ends it', held > .01 && gone < held/8, `${held.toFixed(4)} → ${gone.toFixed(4)}`);
  check('Bend (held) turned while the note is held makes it brighter at once', b1 > b0*1.3, `${Math.round(b0)} Hz → ${Math.round(b1)} Hz`);
  check('and letting go of the knob (your copy made, the instrument rebuilt) keeps the held note ringing', after > held*.3, `${after.toFixed(4)}`);
  // the Resonator: a marimba note struck, then Ring turned up while it rings: it rings on longer than the same note left alone
  const ringTail = async ring => { await page.locator('.trk').nth(4).click(); await page.waitForTimeout(300);
    // (heard at the instrument itself, before the track's echo and reverb, whose repeats would hide its tail)
    await D(() => { const {E, ST} = window.__daw; E.kbOn(4, ST.P.tracks[4].sound, 72, .8); const a = E.ctx.createAnalyser(); a.fftSize = 4096; E.kb.c.inst.live.connect(a); window.__an2 = a; });
    await page.waitForTimeout(150); if (ring) await D(`window.__daw.E.live(4, {native: 'ring'}, ${ring})`); await page.waitForTimeout(1300);
    const r = await D(() => { const x = new Float32Array(4096); window.__an2.getFloatTimeDomainData(x); return Math.sqrt(x.reduce((a, v) => a + v*v, 0)/x.length); });
    await D(() => { const {E} = window.__daw; E.kbOff(6, 72); E.live(6, {native: 'ring'}, 1); }); await page.waitForTimeout(2500); return r; };
  const plain = await ringTail(0), longer = await ringTail(3);
  check('the marimba’s Ring turned up while a note rings makes that note ring on', longer > plain*10, `${plain.toFixed(4)} → ${longer.toFixed(4)}`);

  // the native poly synth: Warm pad on the chords, played live: a key held holds it, the cutoff turned while it's held
  // darkens it at once, and offline, every library sound on it about as loud as the browser-built synth made it
  await D(() => { const {ST, E} = window.__daw; ST.P.tracks[2].sound = 'c-warm'; E.refresh(); }); await page.locator('.trk').nth(2).click(); await page.waitForTimeout(400);
  const pl = await D(() => ({live: window.__daw.E.isLive(4), tag: !document.getElementById('iLive').hidden, knobs: [...document.querySelectorAll('#iMods .kn .kn-lab')].map(x => x.textContent)}));
  check('the poly synth plays live, with its analog character’s own knobs (drift, filter drive)', pl.live && pl.tag && pl.knobs.includes('Drift') && pl.knobs.includes('Filter drive'), JSON.stringify(pl));
  // (heard at the synth itself, before the track's echo and reverb; its level, as the cutoff closes)
  const own = () => D(() => { const x = new Float32Array(4096); window.__an3.getFloatTimeDomainData(x); return Math.sqrt(x.reduce((a, v) => a + v*v, 0)/x.length); });
  await page.keyboard.down('d'); await page.waitForTimeout(200); await D(() => { const {E} = window.__daw, a = E.ctx.createAnalyser(); a.fftSize = 4096; E.kb.c.inst.live.connect(a); window.__an3 = a; });
  await page.waitForTimeout(1400); const pb0 = await own(), ph = pb0;
  const ck = await page.locator('#iMods .kn', {hasText: /^Cutoff/}).boundingBox(); await page.mouse.move(ck.x + ck.width/2, ck.y + 20); await page.mouse.down(); await page.mouse.move(ck.x + ck.width/2, ck.y + 140, {steps: 8}); await page.waitForTimeout(250);
  const pb1 = await own(); await page.mouse.up(); await page.keyboard.up('d'); await page.waitForTimeout(300); await page.keyboard.press('Meta+z');
  check('a held pad note, the cutoff turned right down while it sounds: muffled at once (its level well down)', ph > .005 && pb1 < pb0*.4, `${pb0.toFixed(4)} → ${pb1.toFixed(4)}`);
  const lev = await D(async () => { const {makePoly, PRESETS} = await import('/src/audio/engine/inst/poly.js'), {SOUNDS, NATIVE_OF} = await import('/studio/lib/palette.js'), {DEF} = await import('/studio/lib/native/npoly.js');
    const u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), sr = 22050, notes = [[48, 0, .45], [55, .5, .45], [60, 1, .9], [63, 2, 1.2]], out = {};
    const db = b => { let s = 0; for (const c of [0, 1]) for (const x of b.getChannelData(c)) s += x*x; return 10*Math.log10(s/b.length/2 + 1e-12); };
    for (const [k, [p, set]] of Object.entries(SOUNDS).filter(([k]) => !NATIVE_OF[k])) { const P = {...PRESETS[p], chord: 0, ...set};
      const a = new OfflineAudioContext(2, sr*4, sr), syn = makePoly(a, a.destination, {period: () => .5}); syn.load(P); for (const [n, t, l] of notes) syn.play(n, t + .05, l, .8);
      const b = new OfflineAudioContext(2, sr*4, sr); await b.audioWorklet.addModule(u); const init = [{type: 'load', engine: 'poly', params: {...DEF, ...P, period: .5}}];
      notes.forEach(([n, t, l], i) => init.push({type: 'on', id: i, n, vel: .8, gv: .8, t: t + .05}, {type: 'off', id: i, t: t + .05 + l}));
      const nd = new AudioWorkletNode(b, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init}}); nd.connect(b.destination);
      out[k] = +(db(await b.startRendering()) - db(await a.startRendering())).toFixed(1); } return out; });
  check('every library sound on the native poly synth within 5 dB of the browser-built one (most within 2)', Object.values(lev).every(d => Math.abs(d) < 5) && Object.values(lev).filter(d => Math.abs(d) < 2).length >= Object.keys(lev).length*.6, JSON.stringify(lev));
  // the native drum machine: every voice of every kit against the browser's (rendered offline, the browser's once it's
  // settled): as loud, as bright, as long (its noise is drawn at random, so they differ as two of the browser's hits do)
  const kits = await D(async () => { const {makeDrums, VOICES, KIT_NAMES} = await import('/src/audio/engine/inst/drums.js'), {kitHit} = await import('/studio/lib/native/kit.js'), sr = 44100, secs = 2.5, out = [];
    const st = (L, R) => { let e = 0, pk = 0; const m = new Float32Array(8192); for (let i = 0; i < L.length; i++) { e += L[i]**2 + R[i]**2; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); if (i < 8192) m[i] = (L[i] + R[i])/2*(.5 - .5*Math.cos(2*Math.PI*i/8192)); }
      // brightness: the spectrum's centre of mass (a plain DFT, every 4th bin); length: to 30 dB under its peak
      let c = 0, t = 0; for (let k = 1; k < 4096; k += 4) { let re = 0, im = 0; const w = 2*Math.PI*k/8192; for (let i = 0; i < 8192; i += 2) { re += m[i]*Math.cos(w*i); im += m[i]*Math.sin(w*i); } const p = re*re + im*im; c += p*k*sr/8192; t += p; }
      let env = 0, end = 0; for (let i = 0; i < L.length; i++) { env = Math.max(Math.abs(L[i] + R[i])/2, env*Math.exp(-1/(.005*sr))); if (env > pk*.0316) end = i; } return {e: 10*Math.log10(e), c: c/t, end: end/sr}; };
    for (const kit of KIT_NAMES) for (const v of VOICES) { const ctx = new OfflineAudioContext(2, sr*(secs + .5), sr), d = makeDrums(ctx, ctx.destination); d.load(kit); d.play(v.key, .5, 1, null);
      const b = await ctx.startRendering(), cut = c => b.getChannelData(c).subarray(Math.round(.5*sr)), a = st(cut(0), cut(1)), h = kitHit(sr, kit, v.key, 1, {}, secs), n = st(h.L, h.R);
      out.push([kit + ' ' + v.key, +(n.e - a.e).toFixed(1), +(12*Math.log2(n.c/a.c)).toFixed(1), +(n.end/a.end).toFixed(2)]); } return out; });
  // (brightness within 2.5 semitones: the browser's kit starts its noise at a random place and varies each hit's velocity, so a noisy voice's brightness moves a little from run to run)
  const kbad = kits.filter(([, e, c, l]) => Math.abs(e) > 2 || Math.abs(c) > 2.5 || l < .8 || l > 1.25);
  check(`the native drum machine: all ${kits.length} voices of the five kits as loud (within 2 dB), as bright (within 2.5 semitones) and as long (within a fifth) as the browser's`, !kbad.length, JSON.stringify(kbad.length ? kbad : kits.slice(0, 13)));
  // the analog drum machine (analogkit.js): every voice of its five kits sounds, never past full scale, and dies away;
  // the kick sits lowest and the hats highest; tuning and decay do what they say; softer is darker and a tom sags further
  // the harder it's hit; its parts drift from hit to hit only as far as Variation says; a closed hat closes the open one;
  // played live it's the same as computed ahead
  const an = await D(async () => { const {analogHit, ANALOG_NAMES, AnalogKit} = await import('/studio/lib/native/analogkit.js'), {VOICES} = await import('/src/audio/engine/inst/drums.js'), sr = 22050, out = {bad: [], kits: 0};
    const pk = h => { let p = 0, ok = true; for (let i = 0; i < h.L.length; i++) { if (!isFinite(h.L[i]) || !isFinite(h.R[i])) ok = false; p = Math.max(p, Math.abs(h.L[i]), Math.abs(h.R[i])); } return ok ? p : NaN; };
    const tailOf = h => { let p = 0; for (let i = h.L.length - Math.round(.2*sr); i < h.L.length; i++) p = Math.max(p, Math.abs(h.L[i])); return p; };
    const cen = (h, n = 2048) => { let c = 0, t = 0; for (let k = 2; k < n/2; k += 2) { let re = 0, im = 0; const w = 2*Math.PI*k/n; for (let i = 0; i < n; i++) { const x = (h.L[i] + h.R[i])*(.5 - .5*Math.cos(2*Math.PI*i/n)); re += x*Math.cos(w*i); im += x*Math.sin(w*i); } c += (re*re + im*im)*k*sr/n; t += re*re + im*im; } return c/t; };
    // a pitch from its zero crossings (a stretch where it has settled into its note)
    const f0 = (h, a, b) => { let z = 0; for (let i = Math.round(a*sr) + 1; i < Math.round(b*sr); i++) if (h.L[i - 1] < 0 && h.L[i] >= 0) z++; return z/(b - a); };
    const len = h => { const p = pk(h); let end = 0; for (let i = 0; i < h.L.length; i++) if (Math.abs(h.L[i]) > p*.01) end = i; return end/sr; };
    const C = {};
    for (const kit of ANALOG_NAMES) { out.kits++; for (const v of VOICES) { const h = analogHit(sr, kit, v.key, 1, {}, 4), p = pk(h); if (!(p > .03 && p <= 1.001 && tailOf(h) < p*.001)) out.bad.push([kit, v.key, +p.toFixed(3), +(tailOf(h)/p).toFixed(4)]); if (kit === 'Analog 808') C[v.key] = cen(h); } }
    out.order = C.kick < C.tomL && C.tomL < C.snare && C.snare < C.chh; out.cen = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, Math.round(v)]));
    const k0 = analogHit(sr, 'Analog 808', 'kick', 1, {kick: {vary: 0}}, 1), k12 = analogHit(sr, 'Analog 808', 'kick', 1, {kick: {vary: 0, tune: 10}}, 1);
    out.tune = [Math.round(f0(k0, .25, .6)), Math.round(f0(k12, .25, .6))];
    out.decay = [+len(analogHit(sr, 'Analog 909', 'tomL', 1, {}, 3)).toFixed(2), +len(analogHit(sr, 'Analog 909', 'tomL', 1, {tomL: {decay: 2}}, 3)).toFixed(2)];
    out.vel = ['snare', 'chh'].map(k => [Math.round(cen(analogHit(sr, 'Analog 909', k, .35, {}, .2))), Math.round(cen(analogHit(sr, 'Analog 909', k, 1, {}, .2)))]);
    out.sag = [.3, 1].map(v => Math.round(f0(analogHit(sr, 'Analog 808', 'tomL', v, {tomL: {vary: 0}}, .3), .005, .04)));
    // two hits of the kick on one machine: their tails (past the click's noise and the snare wires' buzz) the same without variation, apart with it
    const two = vary => { const K = new AnalogKit(sr); K.load('Analog 808', {kick: {vary, decay: .5}}); const n = Math.round(1.2*sr), L = new Float32Array(n), R = new Float32Array(n); K.on('kick', 1); for (let a = 0; a < n; a += 128) K.render(L, R, a, Math.min(n, a + 128));
      const L2 = new Float32Array(n), R2 = new Float32Array(n); K.on('kick', 1); for (let a = 0; a < n; a += 128) K.render(L2, R2, a, Math.min(n, a + 128));
      let d = 0, s = 0; for (let i = Math.round(.3*sr); i < n; i++) { d += (L[i] - L2[i])**2; s += L[i]**2; } return +(10*Math.log10(d/s + 1e-30)).toFixed(0); };
    out.vary = [two(0), two(1)];
    const choke = on2 => { const K = new AnalogKit(sr); K.load('Analog 909'); const n = Math.round(.6*sr), L = new Float32Array(n), R = new Float32Array(n); K.on('ohh', .9); for (let a = 0; a < n; a += 128) { if (on2 && a === 128*40) K.on('chh', .3); K.render(L, R, a, Math.min(n, a + 128)); }
      let e = 0; for (let i = Math.round(.4*sr); i < Math.round(.55*sr); i++) e += L[i]**2; return e; };
    out.choke = [choke(false), choke(true)];
    return out; });
  check(`the analog drum machine: every voice of its ${an.kits} kits sounds, never past full scale, and dies away`, an.kits === 5 && !an.bad.length, JSON.stringify(an.bad));
  check('its kick sits lowest, then the toms, the snare, the hats highest', an.order, JSON.stringify(an.cen));
  check('its kick’s Tune moves its note (from the kit’s -2 to +10: an octave up)', Math.abs(an.tune[1]/an.tune[0] - 2) < .12, JSON.stringify(an.tune));
  check('its Decay lengthens a drum (a tom at twice its decay)', an.decay[1] > an.decay[0]*1.6, JSON.stringify(an.decay));
  check('softer is darker (the snare, the closed hat), and a tom hit harder starts sharper (its pitch sags with its ring)', an.vel.every(([a, b]) => b > a*1.15) && an.sag[1] > an.sag[0]*1.05, JSON.stringify([an.vel, an.sag]));
  check('two kicks the same without Variation (all but the bus’s own state), apart with it', an.vary[0] < -80 && an.vary[1] > -40, JSON.stringify(an.vary));
  check('its closed hat closes the open one', an.choke[1] < an.choke[0]/50, JSON.stringify(an.choke));
  const anLive = await D(async () => { const {analogHit} = await import('/studio/lib/native/analogkit.js'), u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), sr = 44100, out = {};
    for (const [kit, v] of [['Analog 808', 'kick'], ['Analog 909', 'snare'], ['Analog Deep', 'ohh'], ['Analog Warm', 'clap'], ['Analog Grit', 'tomL']]) { const ctx = new OfflineAudioContext(2, sr*2, sr); await ctx.audioWorklet.addModule(u);
      const node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init: [{type: 'load', kits: {g: {kit}}, slots: {p: {kit: 'g', voice: v}}}, {type: 'on', id: 1, slot: 'p', vel: .9, t: 128*40/sr}]}}); node.connect(ctx.destination);
      const b = await ctx.startRendering(), ref = analogHit(sr, kit, v, .9, {}, 1.5), off = 128*40; let e = 0, s = 0;
      for (let i = 0; i < ref.L.length; i++) { e += (ref.L[i] - b.getChannelData(0)[off + i])**2; s += ref.L[i]**2; } out[kit + ' ' + v] = +(10*Math.log10(e/s + 1e-30)).toFixed(0); } return out; });
  check('played live, the analog machine is the same as computed ahead (each sample)', Object.values(anLive).every(d => d < -100), JSON.stringify(anLive));
  // in the DAW: its kits are sounds in the library under their own synth, a track on one plays live and draws
  const anDaw = await D(async () => { const {ST, E, SND, SB} = window.__daw, ids = Object.keys(SND).filter(k => /^[khp]4-/.test(k));
    ST.P.tracks[0].sound = 'r6-808'; E.refresh(); const b = await E.render(0, 'r6-808', 'kick', .9); return {n: ids.length, synth: ids.every(k => SB.synthOf(SND[k]) === 'akit'), live: E.isLive(0), drawn: !!b?.length}; });
  check('its five kits are in the library (a kick, hats and a full kit each) under the Analog Drum Machine, and a track on one plays live and draws', anDaw.n === 15 && anDaw.synth && anDaw.live && anDaw.drawn, JSON.stringify(anDaw));
  await D(() => { const {ST, E} = window.__daw; ST.P.tracks[0].sound = ST.orig.tracks[0].sound; E.refresh(); });
  // a drum track plays live: an open hat choked by the closed one, a drum machine voice's knob heard on the next hit
  const drum = await D(async () => { const u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), sr = 22050;
    const one = async init => { const ctx = new OfflineAudioContext(2, sr*2, sr); await ctx.audioWorklet.addModule(u); const node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init}}); node.connect(ctx.destination); return (await ctx.startRendering()).getChannelData(0); };
    const rms = (x, a, b) => { let e = 0; for (let i = Math.round(a*sr); i < Math.round(b*sr); i++) e += x[i]**2; return Math.sqrt(e/((b - a)*sr)); };
    const nat = {type: 'load', slots: {chh: {name: 'hihat', gain: .18, params: {open: 0}, chokes: 'hat'}, ohh: {name: 'hihat', gain: .18, params: {open: .9}, choke: 'hat', chokes: 'hat'}}};
    const open = await one([nat, {type: 'on', id: 1, slot: 'ohh', n: 60, vel: .9, t: .1}]), choked = await one([nat, {type: 'on', id: 1, slot: 'ohh', n: 60, vel: .9, t: .1}, {type: 'on', id: 2, slot: 'chh', n: 60, vel: .5, t: .3}]);
    const kit = {type: 'load', kits: {g: {kit: '909'}}, slots: {chh: {kit: 'g', voice: 'chh'}, ohh: {kit: 'g', voice: 'ohh'}, kick: {kit: 'g', voice: 'kick'}}};
    const kOpen = await one([kit, {type: 'on', id: 1, slot: 'ohh', vel: .9, t: .1}]), kChoked = await one([kit, {type: 'on', id: 1, slot: 'ohh', vel: .9, t: .1}, {type: 'on', id: 2, slot: 'chh', vel: .5, t: .3}]);
    const k1 = await one([kit, {type: 'on', id: 1, slot: 'kick', vel: 1, t: .1}]), k2 = await one([kit, {type: 'set', kit: true, slot: 'kick', key: 'decay', v: 3}, {type: 'on', id: 1, slot: 'kick', vel: 1, t: .1}]);
    return {hat: [rms(open, .4, .6), rms(choked, .4, .6)], kit: [rms(kOpen, .37, .5), rms(kChoked, .37, .5)], decay: [rms(k1, .6, 1), rms(k2, .6, 1)]}; });
  check('the closed hat chokes the open one, native and on the drum machine', drum.hat[1] < drum.hat[0]/20 && drum.kit[1] < drum.kit[0]/20, JSON.stringify(drum));
  check('a drum machine voice’s setting (the kick’s decay) is heard on its next hit', drum.decay[1] > drum.decay[0]*4, JSON.stringify(drum.decay));
  // how fast: the heaviest held sounds four notes at once, and a drum machine's busy pattern, each well ahead of real time
  const cpu = await D(async () => { const {NATIVE} = await import('/studio/lib/native/index.js'), u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), sr = 44100, secs = 4, out = {};
    const run = async init => { const ctx = new OfflineAudioContext(2, sr*secs, sr); await ctx.audioWorklet.addModule(u); const node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init}}); node.connect(ctx.destination);
      const t0 = performance.now(); await ctx.startRendering(); return +(secs*1000/(performance.now() - t0)).toFixed(1); };
    for (const name of ['addpad', 'breath', 'vastrings', 'bowed']) out[name] = await run([{type: 'load', slots: {'': {name, gain: NATIVE[name].gain, params: {}}}}, ...[48, 55, 60, 64].flatMap((n, i) => [{type: 'on', id: i, n, vel: .8, t: .05, len: 3.5}, {type: 'off', id: i, t: 3.55}])]);
    const pat = [], sd = 60/125/4; for (let k = 0; k < secs/sd - 2; k++) { const t = .05 + k*sd; pat.push({type: 'on', id: k, slot: 'chh', t, vel: .7}); if (k % 4 === 0) pat.push({type: 'on', id: 'k' + k, slot: 'kick', t, vel: 1}); if (k % 8 === 4) pat.push({type: 'on', id: 'c' + k, slot: 'clap', t, vel: .9}); if (k % 4 === 2) pat.push({type: 'on', id: 'o' + k, slot: 'ohh', t, vel: .8}); }
    out['drum machine'] = await run([{type: 'load', kits: {g: {kit: '909'}}, slots: Object.fromEntries(['kick', 'chh', 'ohh', 'clap'].map(v => [v, {kit: 'g', voice: v}]))}, ...pat]);
    out['analog drum machine'] = await run([{type: 'load', kits: {g: {kit: 'Analog 808'}}, slots: Object.fromEntries(['kick', 'chh', 'ohh', 'clap'].map(v => [v, {kit: 'g', voice: v}]))}, ...pat]); return out; });
  check('the live engine runs well ahead of real time: four-note pads and bowed chords, a busy drum machine, the analog one (× real time here)', Object.values(cpu).every(x => x > 4), JSON.stringify(cpu));
  // the drum tracks play live in the song: the kick's own instrument heard
  { await D(() => { const {E} = window.__daw, a = E.ctx.createAnalyser(); a.fftSize = 4096; E.ch[0].inst.live.connect(a); window.__an4 = a; E.play(32); }); let kick = 0;
    for (let w = 0; w < 12; w++) { await page.waitForTimeout(120); kick = Math.max(kick, await D(() => { const x = new Float32Array(4096); window.__an4.getFloatTimeDomainData(x); return Math.sqrt(x.reduce((a, v) => a + v*v, 0)/x.length); })); }
    await D(() => window.__daw.E.stop()); check('the kick plays live in the song (its drum machine heard)', kick > .01, kick.toFixed(4)); }
  // the song plays live too: the bass from its first clip heard
  await D(() => { const {E} = window.__daw; E.play(32); }); await page.waitForTimeout(1500); const song = await rms(); await D(() => window.__daw.E.stop());
  check('the song plays with the live bass', song > .01, song.toFixed(4)); await page.keyboard.press('b'); }

// more tracks: + Add a track (a kind: the new track below the selected one, its sound from a track of that kind), a clip
// made in it, a bass clip dragged onto it, renamed in place, duplicated with its clips, deleted with a second click, and
// every step undone; kept across a reload; Claude's version as written, without them
{ await page.reload(); await page.waitForTimeout(1500); await D(() => { const {ST, E} = window.__daw; ST.P.tracks[2].sound = ST.orig.tracks[2].sound; E.refresh(); });
  const n0 = await D(() => window.__daw.ST.P.tracks.length), names = () => D(() => window.__daw.ST.P.tracks.map(T => T.name));
  await page.locator('.trk').nth(1).click(); await page.click('#addTrk'); await page.locator('#pop button', {hasText: /^Bass/}).click(); await page.waitForTimeout(300);
  const nt = await D(() => { const {ST, E} = window.__daw, T = ST.P.tracks[2]; return {n: ST.P.tracks.length, name: T.name, role: T.role, sound: T.sound, bass: ST.P.tracks[1].sound, clips: T.clips.length, sel: ST.sel.track, rows: document.querySelectorAll('#trackList .trk').length, ch: E.ctx ? E.ch.length : null}; });
  check('+ Add a track → Bass: a “Bass 2” below the bass, empty, on the bass’s sound', nt.n === n0 + 1 && nt.name === 'Bass 2' && nt.role === 'bass' && nt.sound === nt.bass && nt.clips === 0 && nt.sel === 2 && nt.rows === n0 + 1, JSON.stringify(nt));
  // a clip made in it by a double-click, and one of the bass's dragged down onto it
  await D(() => { const {ST} = window.__daw; ST.sx = 30*ST.px; ST.sy = 0; window.__daw.E && 0; }); await D(() => document.getElementById('arr').dispatchEvent(new WheelEvent('wheel', {deltaY: 0})));
  const [x1, y1] = await at(2, 31.5); await page.mouse.dblclick(x1, y1); await page.waitForTimeout(200);
  const made = await D(() => window.__daw.ST.P.tracks[2].clips.map(c => [c.start, c.len]));
  check('a double-click in its lane makes a bar-long clip there', made.length === 1 && made[0][0] === 31 && made[0][1] === 16, JSON.stringify(made));
  await page.keyboard.press('Escape'); const bc = (await clips(1))[0], [bx1, by1] = await at(1, bc.start + 2), [, by2] = await at(2, bc.start + 2);
  await page.mouse.move(bx1, by1); await page.mouse.down(); await page.mouse.move(bx1, by2, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(200);
  check('a bass clip dragged down onto it moves there', await D(`window.__daw.ST.P.tracks[2].clips.some(c => c.id === '${bc.id}') && !window.__daw.ST.P.tracks[1].clips.some(c => c.id === '${bc.id}')`));
  // heard: the song from that clip, the new track's channel playing
  await D(() => { const {E} = window.__daw; E.init(); }); await page.waitForTimeout(200);
  check('the engine has a channel for it', await D(() => window.__daw.E.ch.length === window.__daw.ST.P.tracks.length && window.__daw.E.ch[2].T === window.__daw.ST.P.tracks[2]));
  // renamed in place
  await page.locator('.trk').nth(2).locator('.nm').dblclick(); await page.keyboard.press('Meta+a'); await page.keyboard.type('Sub line'); await page.keyboard.press('Enter');
  check('double-clicking its name renames it', (await names())[2] === 'Sub line', JSON.stringify(await names()));
  // duplicated with its clips, from its ⋯ menu
  await page.locator('.trk').nth(2).locator('.more').click(); await page.locator('#pop button', {hasText: 'Duplicate'}).click(); await page.waitForTimeout(200);
  const dup = await D(() => { const T = window.__daw.ST.P.tracks; return [T.length, T[3].name, T[3].clips.length, T[2].clips.length, new Set(T.flatMap(x => x.clips.map(c => c.id))).size === T.flatMap(x => x.clips).length]; });
  check('⋯ → Duplicate copies it below with its clips (each its own)', dup[0] === n0 + 2 && dup[1] === 'Sub line 2' && dup[2] === dup[3] && dup[4], JSON.stringify(dup));
  // deleted: the first click asks, the second deletes
  await page.locator('.trk').nth(3).locator('.more').click(); const del = page.locator('#pop button', {hasText: 'Delete'}); await del.click();
  const asked = await D(() => [document.querySelector('#pop .danger')?.textContent, window.__daw.ST.P.tracks.length]); await del.click(); await page.waitForTimeout(200);
  check('Delete asks once (naming its clips), then deletes', /click again/.test(asked[0]) && asked[1] === n0 + 2 && (await names()).length === n0 + 1, JSON.stringify(asked));
  // undone step by step: the deletion, the copy, the name, the drag, the clip, the track
  for (let k = 0; k < 6; k++) await page.keyboard.press('Meta+z');
  check('undo takes them all back, track and all', (await names()).length === n0 && !(await names()).includes('Bass 2') && await D(`window.__daw.ST.P.tracks[1].clips.some(c => c.id === '${bc.id}')`), JSON.stringify(await names()));
  for (let k = 0; k < 6; k++) await page.keyboard.press('Meta+Shift+z');
  check('and redo brings them back', (await names()).join() === [...(await D(() => window.__daw.ST.orig.tracks.map(T => T.name))).slice(0, 2), 'Sub line', ...(await D(() => window.__daw.ST.orig.tracks.map(T => T.name))).slice(2)].join(), JSON.stringify(await names()));
  await page.waitForTimeout(900); await page.reload(); await page.waitForTimeout(1500);
  check('the new track is kept after a reload', (await names()).includes('Sub line') && await D(() => window.__daw.ST.P.tracks.find(T => T.name === 'Sub line').clips.length === 2));
  await page.click('#ver'); const cl = await names(); await page.click('#ver');
  check('Claude’s version plays as written, without it; yours brings it back', cl.length === n0 && !cl.includes('Sub line') && (await names()).includes('Sub line'), JSON.stringify(cl));
  // a new track of a kind no track has yet: Lead → its sound from the library; ⌥⌘N opens the menu
  await page.keyboard.press('Escape'); await page.keyboard.press('Meta+Alt+n'); const menu = await D(() => !!document.getElementById('pop'));
  await page.locator('#pop button', {hasText: /^Chords/}).click(); await page.waitForTimeout(200);
  const ch = await D(() => { const {ST, SND} = window.__daw, T = ST.P.tracks[ST.sel.track]; return [T.name, T.role, SND[T.sound]?.role]; });
  check('⌥⌘N opens the menu; Chords adds “Chords 2” on a chords sound', menu && ch[0] === 'Chords 2' && ch[1] === 'chords' && ch[2] === 'chords', JSON.stringify(ch)); }

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
  await ph.evaluate(() => { const {ST} = window.__daw; ST.sx = 0; }); const c = await ph.evaluate(() => { const {ST} = window.__daw, k = ST.P.tracks[0].clips[0]; return [(k.start + .5)*ST.px, 72 + 28]; });
  const cdp = await ph.context().newCDPSession(ph), tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
  await tp('touchStart', A.x + c[0], A.y + c[1]); for (let k = 1; k <= 5; k++) await tp('touchMove', A.x + c[0] + 20*k, A.y + c[1]); await tp('touchEnd');
  check('a clip dragged on a phone stays put', await ph.evaluate(() => JSON.stringify(window.__daw.ST.P.tracks[0].clips.map(c => c.start))) === before && await ph.evaluate(() => window.__daw.ST.P.tracks[0].clips[0].start) === 0);
  await ph.evaluate(() => document.getElementById('up').click()); await ph.waitForTimeout(200);
  check('a like on a phone is kept', await ph.evaluate(() => window.__daw.ST.notes[0]?.rating === 1)); await ph.close(); }

// the native desk (studio/arrange/desk.js, the parts host): a strip a track, the buses, the returns, the master bus; the
// sidechain the kick keys; the Mixer (X); Straight; a track added and taken away; an old song's settings carried over;
// and the analog synth in the sound panel, played live
// (a context of its own: the pages above keep their songs, solos and all, in this one's storage)
{ const q = await (await browser.newContext({viewport: {width: 1400, height: 950}})).newPage(); q.on('pageerror', e => { failed = true; console.log('FAIL desk page error:', e.message); });
  await q.goto(url + 'studio/listen/studio-daw.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(800);
  const Q = (fn, x) => q.evaluate(fn, x);
  await Q(() => window.__daw.E.init()); await q.waitForFunction(() => window.__daw.E.liveOK && window.__daw.E.deskNode, null, {timeout: 8000});
  const strips = await Q(() => { const {E, ST} = window.__daw; return {ids: E.D.strips.map(s => s.id), tracks: ST.P.tracks.flatMap((T, i) => T.role === 'drums' ? [...E.IO[i].pads.map(p => T.id + '/' + p), T.id] : [T.id]),
    rack: E.D.strips.filter(s => s.rack === 'rack').map(s => [s.out, s.input?.ext]), out: E.D.strips.find(s => s.id === 'rack')?.out}; });
  check('the desk has a strip a track (the drum rack a strip a pad, into its own), the drum and music buses, the echo and room returns, the master bus and the out',
    JSON.stringify(strips.ids) === JSON.stringify([...strips.tracks, 'drums', 'music', 'echo', 'room', 'bus', 'master']) && strips.rack.length === 19 && strips.rack.every(([o, e], j) => o === 'rack' && e === j) && strips.out === 'drums', strips.ids.join(' '));
  // where the bass and the kick play together (Clearing's "The bass arrives"), the meters as it plays
  const listen = async (bar, ms = 5000) => { await Q(b => { const {E} = window.__daw; window.__mx = {}; window.__gr = {}; E.play(b);
    clearInterval(window.__mxT); window.__mxT = setInterval(() => { for (const [k, v] of Object.entries(E.meters || {})) { window.__mx[k] = Math.max(window.__mx[k] || 0, v.pk); for (const [p, g] of Object.entries(v.gr)) window.__gr[p] = Math.max(window.__gr[p] || 0, g); } }, 25); }, bar);
    await q.waitForTimeout(ms); return Q(() => ({pk: window.__mx, gr: window.__gr})); };
  const m = await listen(32);
  check('playing through the desk: every track playing in the section heard, the master within full scale and well up', ['rack/kick', 'rack/chh', 'rack/tomL', 'rack', 't3', 't5'].every(k => m.pk[k] > .003) && m.pk.master > .3 && m.pk.master <= 1.0001,
    Object.entries(m.pk).map(([k, v]) => `${k} ${(20*Math.log10(v + 1e-9)).toFixed(1)}`).join(', '));
  check('the rack’s kick pad keys the sidechain: the bass and the chords turned down on its hits, the buses\' compressors working', m.gr['t3-sidechain'] > 3 && m.gr['t4-sidechain'] > 3 && m.gr['drums-glue'] > .5,
    ['t3-sidechain', 't4-sidechain', 'drums-glue', 'bus-glue'].map(k => `${k} ${(m.gr[k] || 0).toFixed(1)}`).join(', '));
  // Straight: every channel and bus bypassed at the loudness the mix gives it
  await q.click('#engAB'); const st = await listen(32, 3000); await q.click('#engAB');
  check('Straight: the processors out, still heard at about the same loudness', st.pk.master > .2 && st.pk.master <= 1.0001 && /straight/.test(await Q(() => document.getElementById('engAB').textContent)) === false,
    `master ${(20*Math.log10(st.pk.master)).toFixed(1)} dB against ${(20*Math.log10(m.pk.master)).toFixed(1)}`);
  // the Mixer: its strips, a processor switched off and one added on the bass, kept with the song across a reload, undone
  await Q(() => window.__daw.E.stop()); await q.keyboard.press('x'); await q.waitForTimeout(400);
  const shown = await Q(() => ({on: window.__daw.MX.isOn(), n: document.querySelectorAll('#mxDesk .mxs').length}));
  check('X opens the Mixer: a strip a track (the drum rack’s and its kit’s fifteen pads), the buses, the returns and the master bus', shown.on && shown.n === 25, JSON.stringify(shown));
  await q.locator('#mxDesk .mxs[data-strip="rack"] .pads').click(); const shut = await Q(() => document.querySelectorAll('#mxDesk .mxs').length); await q.locator('#mxDesk .mxs[data-strip="rack"] .pads').click();
  check('the rack’s ▾ Pads folds its pads away and opens them again', shut === 10 && await Q(() => document.querySelectorAll('#mxDesk .mxs[data-kind="pad"]').length) === 15, shut);
  await q.locator('#mxDesk .mxs[data-strip="t3"] .sname').click(); await q.locator('#mxChain .proc[data-key="saturate"] .pname').click();
  await q.selectOption('#mxChain .padd select', 'tape'); await q.waitForTimeout(300);
  const ch = await Q(() => { const T = window.__daw.ST.P.tracks[1], s = window.__daw.E.D.strips.find(x => x.id === 't3'); return {mine: T.desk?.chain?.map(c => c.key + (c.on === false ? '-off' : '')), desk: s.chain.map(c => c.key + (c.on === false ? '-off' : ''))}; });
  check('on the bass: Saturation switched off and Tape added, kept on the track and on the desk', ch.mine?.includes('saturate-off') && ch.mine?.includes('tape') && JSON.stringify(ch.mine) === JSON.stringify(ch.desk), JSON.stringify(ch));
  await q.waitForTimeout(900); await q.reload(); await q.waitForTimeout(800);
  const kept = await Q(() => window.__daw.ST.P.tracks[1].desk?.chain?.map(c => c.key + (c.on === false ? '-off' : '')));
  check('the bass\'s processors are kept across a reload', kept?.includes('saturate-off') && kept?.includes('tape'), JSON.stringify(kept));
  await Q(() => { window.__daw.E.init(); }); await q.waitForFunction(() => window.__daw.E.deskNode, null, {timeout: 8000});
  await q.keyboard.press('x'); await q.locator('#mxDesk .mxs[data-strip="t3"] .sname').click();
  await q.locator('#mxChain .proc[data-key="tape"] .pmove button[aria-label^="Take out"]').click(); await q.keyboard.press('Meta+z'); await q.waitForTimeout(200);
  check('taking a processor out is undone', (await Q(() => window.__daw.ST.P.tracks[1].desk?.chain?.map(c => c.key)))?.includes('tape'));
  // a fader on the Mixer is the track's level; a pad's is its own; a bus's fader is kept on the song
  await Q(() => { const t = document.querySelector('#mxDesk .mxs[data-strip="t3"] .fdr input'); t.value = -4; t.dispatchEvent(new Event('input')); const r = document.querySelector('#mxDesk .mxs[data-strip="rack/chh"] .fdr input'); r.value = -4; r.dispatchEvent(new Event('input')); const b = document.querySelector('#mxDesk .mxs[data-strip="drums"] .fdr input'); b.value = -3; b.dispatchEvent(new Event('input')); });
  check('a track\'s fader on the Mixer is its level; a pad\'s its own; a bus\'s is kept with the song', await Q(() => window.__daw.ST.P.tracks[1].mix.vol === -4 && window.__daw.ST.P.tracks[0].pads.chh.vol === -4 && window.__daw.ST.P.desk?.drums?.level === -3));
  // a pad's own processors: one added on the closed hat, kept on its pad, the others untouched; muted on its own
  await q.locator('#mxDesk .mxs[data-strip="rack/chh"] .sname').click(); await q.selectOption('#mxChain .padd select', 'tape'); await q.waitForTimeout(300);
  await q.locator('#mxDesk .mxs[data-strip="rack/chh"] .ms').first().click(); await q.waitForTimeout(100);
  const pc = await Q(() => { const {ST, E} = window.__daw, T = ST.P.tracks[0]; return {mine: T.desk?.pads?.chh?.chain?.map(c => c.key), desk: E.D.strips.find(x => x.id === 'rack/chh').chain.map(c => c.key), other: E.D.strips.find(x => x.id === 'rack/ohh').chain.map(c => c.key), mute: T.pads.chh.mute}; });
  check('a pad’s own processors: Tape added on the closed hat alone, kept on its pad; M mutes it alone', pc.mine?.includes('tape') && pc.desk.includes('tape') && !pc.other.includes('tape') && pc.mute === true, JSON.stringify(pc));
  await q.locator('#mxDesk .mxs[data-strip="rack/chh"] .ms').first().click();
  // a track added gets a strip by its role (the sidechain on, listening to the kick); taken away, its strip goes
  await Q(() => { const {ST} = window.__daw; ST.sel.track = 1; }); await q.locator('#addTrk').click(); await q.locator('#pop button', {hasText: 'Bass'}).first().click(); await q.waitForTimeout(400);
  const added = await Q(() => { const {E, ST} = window.__daw, T = ST.P.tracks[2], s = E.D.strips.find(x => x.id === T.id); return {n: E.D.strips.length, role: T.role, sc: s?.chain.find(c => c.key === 'sidechain'), mx: document.querySelectorAll('#mxDesk .mxs').length}; });
  check('a bass track added gets its strip, its sidechain on and keyed by the kick, on the Mixer too', added.n === 31 && added.role === 'bass' && added.sc?.on !== false && added.sc?.params.key === 'rack/kick' && added.mx === 26, JSON.stringify(added));
  await q.keyboard.press('Meta+z'); await q.waitForTimeout(300); check('undone, its strip goes', await Q(() => window.__daw.E.D.strips.length === 30));
  // another drum rack: from + Add a track, on the first analog kit, every pad its own strip (heard on its own)
  await q.locator('#addTrk').click(); await q.locator('#pop button', {hasText: 'Drum rack'}).first().click(); await q.waitForTimeout(400);
  const rk = await Q(async () => { const {E, ST} = window.__daw, i = ST.sel.track, T = ST.P.tracks[i]; T.sound = 'r6-808'; E.refresh(); await new Promise(r => setTimeout(r, 300)); const pads = E.D.strips.filter(s => s.rack === T.id);
    E.audition(i, 'snare', .9, 1); E.audition(i, 'kick', .9, 1); let sn = 0, ki = 0; for (let w = 0; w < 10; w++) { await new Promise(r => setTimeout(r, 60)); sn = Math.max(sn, E.meters?.[T.id + '/snare']?.pk || 0); ki = Math.max(ki, E.meters?.[T.id + '/kick']?.pk || 0); }
    return {role: T.role, sound: T.sound, pads: pads.length, sn, ki, other: E.meters?.[T.id + '/clap']?.pk || 0}; });
  check('+ Add a track → Drum rack (the song’s kit), put on the Analog 808 rack: nineteen pads each its own strip, a hit heard on its own pad', rk.role === 'drums' && rk.sound === 'r6-808' && rk.pads === 19 && rk.sn > .01 && rk.ki > .01 && rk.other < .001, JSON.stringify(rk));
  await q.keyboard.press('Meta+z'); await q.waitForTimeout(300);
  // the kit changed: the song's drums on the Analog 909 rack, every pad's strip kept, heard
  const kit = await Q(async () => { const {E, ST} = window.__daw, n = E.D.strips.length; ST.P.tracks[0].sound = 'r6-909'; E.refresh(); E.play(32); await new Promise(r => setTimeout(r, 2500));
    const m = E.meters; E.stop(); return {n: E.D.strips.length === n, kick: m['rack/kick']?.pk, chh: m['rack/chh']?.pk, rack: m.rack?.pk, live: E.isLive(0)}; });
  check('the rack’s kit changed to the Analog 909 rack: the same strips, its kick and hats heard on their pads', kit.n && kit.kick > .01 && kit.chh > .005 && kit.live, JSON.stringify(kit));
  // the kit's own bus on the rack's strip (glued once, the pads dry), the drum bus only summing
  const bus = await Q(() => { const {E} = window.__daw, st = id => E.D.strips.find(x => x.id === id).chain; return {rack: st('rack').map(c => c.key), drums: st('drums').map(c => c.on !== false)}; });
  check('the 909 rack’s own bus (weight, tape, its glue compressor, width) on the rack’s strip, the drum bus’s compressor and tape off', ['weight', 'tape', 'glue', 'width'].every(k => bus.rack.includes(k)) && bus.drums.every(on => !on), JSON.stringify(bus));
  // beside the instrument: the picked drum's effects, then the kit's; one added there is on the desk and in the Mixer
  await Q(() => { const {ST} = window.__daw; ST.sel.track = 0; }); await q.click('#tabInst'); await q.waitForTimeout(600);
  const ifx = await Q(() => [...document.querySelectorAll('#iMods .ifx')].map(e => [e.dataset.strip, e.querySelectorAll('.proc').length]));
  await q.locator('#iMods .ifx[data-strip="rack"] .padd select').selectOption('echo'); await q.waitForTimeout(300);
  const added2 = await Q(() => { const {ST, E} = window.__daw; return {mine: ST.P.tracks[0].desk?.chain?.map(c => c.key), desk: E.D.strips.find(x => x.id === 'rack').chain.map(c => c.key)}; });
  check('the Instrument tab shows the drum’s effects and the kit’s to the right of the instrument; Echo added there is on the rack’s strip', ifx.length === 2 && ifx[1][0] === 'rack' && ifx[1][1] >= 4 && ifx[0][0].startsWith('rack/') && added2.mine?.includes('echo') && added2.desk.includes('echo'), JSON.stringify({ifx, added2}));
  await q.keyboard.press('Meta+z'); await q.click('#tabMix');
  await Q(() => { const {E, ST} = window.__daw; ST.P.tracks[0].sound = ST.orig.tracks[0].sound; E.refresh(); });
  // a song saved before the desk: its old three-band EQ carried over as an EQ, a duck of 0 as the sidechain off
  const mig = await Q(() => { const {ST, E} = window.__daw, T = ST.P.tracks[2]; T.mix.lo = 3; T.mix.hi = -2; T.mix.duck = 0; delete T.desk; E.deskRefresh(); const s = E.D.strips.find(x => x.id === T.id);
    return {eq: s.chain.find(c => c.id === T.id + '-eq0')?.params, sc: s.chain.find(c => c.key === 'sidechain')?.on}; });
  check('an old song\'s EQ comes over as an EQ, its duck at 0 as the sidechain off', mig.eq?.lo === 3 && mig.eq?.hi === -2 && mig.sc === false, JSON.stringify(mig));
  // the analog synth: in the sound panel under its own synth, on the bass played live, a knob heard at once
  const lib = await Q(() => { const {SND, SB} = window.__daw, ids = Object.keys(SND).filter(k => SND[k].src?.asynth); return {n: ids.length, synth: ids.every(k => SB.synthOf(SND[k]) === 'asynth'), roles: [...new Set(ids.map(k => SND[k].role))].sort().join(' ')}; });
  check('the analog synth\'s sounds are in the library under their own synth, for the bass, chords and leads', lib.n >= 18 && lib.synth && lib.roles === 'bass chords lead', JSON.stringify(lib));
  const syn = await Q(async () => { const {ST, E} = window.__daw; ST.P.tracks[1].sound = 'a5-round'; E.refresh(); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.ch[1].inst.live.connect(a);
    E.audition(1, 45, .9, 8); let pk = 0; for (let w = 0; w < 12; w++) { await new Promise(r => setTimeout(r, 60)); const x = new Float32Array(2048); a.getFloatTimeDomainData(x); for (const v of x) pk = Math.max(pk, Math.abs(v)); }
    E.live(1, {asynth: 'cut'}, 90); return {engine: E.ch[1].inst.engine, live: E.isLive(1), pk, cut: E.ch[1].inst.full.cut}; });
  check('an analog synth sound on the bass plays live, and a knob turned reaches it', syn.engine === 'asynth' && syn.live && syn.pk > .01 && syn.cut === 90, JSON.stringify(syn));
  const drawn = await Q(async () => { const b = await window.__daw.E.render(1, 'a5-juno', 57, .85, 4); let pk = 0; if (b) for (const v of b.getChannelData(0)) pk = Math.max(pk, Math.abs(v)); return {len: b?.duration, pk}; });
  check('a note of it drawn for the instrument view (rendered by the analog synth)', drawn.len > 2 && drawn.pk > .01, JSON.stringify(drawn));
  await q.close(); }

// the drum playground (studio/drums/, built into studio/listen/drum-lab.html): every beat on every analog kit heard,
// the swap alternating the analog kit and its browser copy every two bars, a step clicked on, a knob turned and kept
{ const q = await browser.newPage({viewport: {width: 1280, height: 900}}); q.on('pageerror', e => { failed = true; console.log('FAIL playground page error:', e.message); });
  await q.goto(url + 'studio/listen/drum-lab.html'); await q.evaluate(() => localStorage.clear()); await q.reload(); await q.waitForTimeout(500);
  await q.click('#play'); await q.waitForFunction(() => window.__drums.node, null, {timeout: 6000});
  const heard = await q.evaluate(async () => { const {ctx, node, BEATS, pickBeat, pickKit} = window.__drums, a = ctx.createAnalyser(), out = {}, kits = ['Analog 808', 'Analog 909', 'Analog Deep', 'Analog Warm', 'Analog Grit']; a.fftSize = 2048; node.connect(a);
    for (const [i, b] of BEATS.entries()) { pickBeat(b.id); pickKit(kits[i % 5]); let pk = 0; for (let w = 0; w < 14; w++) { await new Promise(r => setTimeout(r, 70)); const x = new Float32Array(2048); a.getFloatTimeDomainData(x); for (const v of x) pk = Math.max(pk, Math.abs(v)); } out[b.id + ' ' + kits[i % 5]] = +pk.toFixed(3); }
    return out; });
  check('the drum playground plays every beat, each on an analog kit, never past full scale', Object.values(heard).every(p => p > .05 && p <= 1.001), JSON.stringify(heard));
  await q.evaluate(() => window.__drums.pickBeat('four')); await q.click('#abSwap'); const sides = new Set();
  for (let w = 0; w < 50; w++) { await q.waitForTimeout(200); sides.add(await q.evaluate(() => window.__drums.S.side)); }
  check('Swap every 2 bars plays the analog kit and its browser copy in turn', sides.has('a') && sides.has('b'), JSON.stringify([...sides]));
  await q.locator('.row').nth(1).locator('.st').nth(3).click(); await q.evaluate(() => { const r = document.getElementById('k-decay'); r.value = 2; r.dispatchEvent(new Event('input')); });
  const kept = await q.evaluate(() => { const S = window.__drums.S; return {step: S.edits.four?.snare?.[3], decay: S.over[S.kit]?.kick?.decay}; });
  check('a step clicked on and a knob turned are kept', kept.step === 'x' && kept.decay === 2, JSON.stringify(kept));
  await q.close(); }

await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
