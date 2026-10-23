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

// the sound panel: a track's sound's name opens it; every sound grouped by how it's made; one tried on the track's notes
// is heard; Use puts it on the track (or only on the selected clips); a setting changed makes your own copy, heard, kept
// with the song and in your library; undo; a drum voice's and the poly synth's own settings; asking Claude for a sound
{ await page.reload(); await page.waitForTimeout(1500); const bi = await D(() => window.__daw.ST.P.tracks.findIndex(T => T.role === 'bass'));
  await page.locator('.trk').nth(bi).locator('.snd').click(); await page.waitForTimeout(300);
  const lib = await D(() => ({open: !document.getElementById('side').hidden, fams: [...document.querySelectorAll('.fam')].map(f => f.textContent.replace(/[▾▸]\s*/, '').replace(/\s*\d+$/, '')), rows: document.querySelectorAll('.snd-row').length, on: document.querySelector('.snd-row[data-on="1"]')?.dataset.id, cur: window.__daw.ST.P.tracks[3].sound}));
  check('the bass’s sound opens the panel: every pitched sound, grouped by how it’s made, the one in use marked', lib.open && lib.rows > 40 && lib.fams.includes('FM') && lib.fams.includes('Bowed and rubbed') && lib.fams.includes('Poly synth') && lib.on === lib.cur, JSON.stringify(lib));
  await page.locator('#sdRoles button', {hasText: 'Bass'}).click(); const nb = await D(() => [...document.querySelectorAll('.snd-row')].every(r => window.__daw.SND[r.dataset.id].role === 'bass'));
  check('the Bass filter leaves only bass sounds', nb); await page.locator('#sdRoles button', {hasText: 'All'}).click();
  await page.fill('#sdSearch', 'marimba'); const found = await D(() => [...document.querySelectorAll('.snd-row')].map(r => r.dataset.id)); check('searching finds the marimba', found.includes('l-marimba'), JSON.stringify(found)); await page.fill('#sdSearch', '');
  // tried: heard on the master while the song is stopped
  await D(() => { const {E} = window.__daw; E.init(); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.out.connect(a); window.__an = a; });
  await page.locator('.snd-row[data-id="b2-sub"]').click(); let peak = 0;
  for (let k = 0; k < 40 && peak < .01; k++) { await page.waitForTimeout(100); peak = await D(() => { const x = new Float32Array(2048); window.__an.getFloatTimeDomainData(x); return Math.max(...x.map(Math.abs)); }); }
  check('clicking a sound plays it on the bass’s notes', peak > .01, peak.toFixed(3));
  await page.locator('.snd-row[data-id="b2-sub"] .use').click(); check('Use puts it on the whole track', await D(() => window.__daw.ST.P.tracks[3].sound) === 'b2-sub');
  await page.keyboard.press('Meta+z'); check('and undo takes it back', await D(() => window.__daw.ST.P.tracks[3].sound) === lib.cur);
  // only the selected clip: the bass's second clip
  const cl = await D(() => window.__daw.ST.P.tracks[3].clips.map(c => c.id).sort()); await D(`(() => { const {ST} = window.__daw; ST.sel.track = 3; ST.sel.clips = new Set(['${cl[1]}']); })()`); await D(() => window.__daw.SB.render());
  const scope = await D(() => document.getElementById('sdScope').textContent); await page.locator('.snd-row[data-id="l-marimba"]').dblclick();
  const per = await D(`window.__daw.ST.P.tracks[3].clips.map(c => [c.id, c.set?.sound || null])`);
  check('with a clip selected, only that clip takes the sound', /1 selected clip/.test(scope) && per.find(p => p[0] === cl[1])[1] === 'l-marimba' && per.filter(p => p[1] === 'l-marimba').length === 1, scope + ' ' + JSON.stringify(per));
  await page.keyboard.press('Meta+z'); await D(() => { window.__daw.ST.sel.clips = new Set(); window.__daw.SB.render(); });
  // the designer: a physical model's own settings, a change making your copy
  await page.click('#tabEdit'); const knobs = await D(() => [...document.querySelectorAll('#sdBody .knob .kl')].map(k => k.textContent));
  check('Edit shows the instrument’s own settings (FM: bend, ratio, decay)', knobs.includes('Instrument') && knobs.includes('Bend') && knobs.includes('Ratio'), knobs.join(', '));
  const r = page.locator('#sdBody .knob', {hasText: /^Bend[0-9.]/}).locator('input'), rb = await r.boundingBox(); await page.mouse.click(rb.x + rb.width*.95, rb.y + rb.height/2); await page.waitForTimeout(300);
  const mine = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[3].sound, s = SND[id]; return {id, name: s.name, base: s.base, knobs: s.src.knobs, kept: !!ST.P.sounds?.[id], lib: !!JSON.parse(localStorage.getItem('studio.daw.sounds') || '{}')[id]}; });
  check('moving Bend makes your own copy, with the setting, kept with the song and in your sounds', mine.id.startsWith('u-') && mine.base === lib.cur && mine.knobs?.index > 4 && mine.kept && mine.lib, JSON.stringify(mine));
  check('the library’s own sound is unchanged', await D(`!window.__daw.SND['${lib.cur}'].src.knobs`));
  await page.locator('#sdBody .knob', {hasText: 'Ratio'}).locator('input').evaluate(el => { el.value = 100; el.dispatchEvent(new Event('change')); });
  const two = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[3].sound; return [id, SND[id].src.knobs]; });
  check('a second change goes on the same copy', two[0] === mine.id && two[1].ratio < 1.5 && two[1].index > 4, JSON.stringify(two));
  await page.fill('#sdName', 'Glassy FM'); await page.locator('#sdName').dispatchEvent('change');
  await page.waitForTimeout(900); await page.reload(); await page.waitForTimeout(1500);
  const back = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[3].sound; return [id, SND[id]?.name, SND[id]?.mine]; });
  check('after a reload the bass plays your sound, by its name', back[0] === mine.id && back[1] === 'Glassy FM' && back[2], JSON.stringify(back));
  await page.locator('.trk').nth(3).locator('.snd').click(); await page.click('#tabLib');
  check('it’s listed under Your sounds', await D(() => { const f = [...document.querySelectorAll('.fam')][0]; return f.textContent.includes('Your sounds'); }));
  // the hats: each voice its own settings; the chords on the poly synth: its oscillators, filter and envelopes
  await page.locator('.trk').nth(1).locator('.snd').click(); await page.click('#tabEdit');
  const hv = await D(() => [[...document.querySelectorAll('.voices button')].map(b => b.textContent), [...document.querySelectorAll('#sdBody .knob .kl')].map(k => k.textContent)]);
  check('the hats’ voices, each with its own settings', hv[0].includes('Open hat') && hv[1].includes('Open') && hv[1].includes('Tone'), JSON.stringify(hv));
  await page.locator('.voices button', {hasText: 'Open hat'}).click(); await page.locator('#sdBody .knob', {hasText: 'Open'}).first().locator('input').evaluate(el => { el.value = 900; el.dispatchEvent(new Event('change')); });
  const hk = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[1].sound]; return [s.mine, s.voices.ohh.knobs, s.voices.chh.knobs]; });
  check('opening the open hat changes that voice alone', hk[0] && hk[1]?.open > .8 && !hk[2], JSON.stringify(hk));
  await D(() => { window.__daw.ST.P.tracks[4].sound = 'c-warm'; }); await page.locator('.trk').nth(4).locator('.snd').click(); await page.click('#tabEdit');
  const groups = await D(() => [...document.querySelectorAll('#sdBody .grp')].map(g => g.textContent)); check('a poly synth sound shows its oscillators, filter and envelopes', ['Oscillators', 'Filter', 'Amp'].every(g => groups.includes(g)), groups.join(', '));
  await page.fill('#sdAskT', 'A hollow wooden bass, soft attack'); await page.click('#sdAskB'); await page.waitForTimeout(200);
  const ask = await D(() => window.__daw.ST.notes[0]); check('asking Claude for a sound keeps the words and the track', ask.text === 'A hollow wooden bass, soft attack' && ask.target.kind === 'sound' && ask.target.tracks[0] === 'Chords', JSON.stringify(ask.target));
  await D(() => window.__daw.SB.show(false)); }

// the instrument (B): the track's sound as a synth's front panel, its note drawn, knobs turned with the mouse and heard,
// the poly synth's filter graphed and heard at once, a keyboard played from the computer's keys, a kit's pads
{ await page.reload(); await page.waitForTimeout(1500); await D(() => { const {ST, E} = window.__daw; ST.P.tracks[3].sound = 'b-fmpluck'; E.refresh(); });   // (the library's FM pluck bass again)
  await page.locator('.trk').nth(3).click(); await page.keyboard.press('b');
  for (let k = 0; k < 60 && !(await D(() => !!window.__daw.SI.state().buf)); k++) await page.waitForTimeout(100);
  const st = await D(() => { const s = window.__daw.SI.state(); return {kind: s.M?.kind, buf: s.buf?.length || 0, cap: s.cap, mods: [...document.querySelectorAll('#iMods .mod h3')].map(x => x.textContent), knobs: [...document.querySelectorAll('#iMods .kn .kn-lab')].map(x => x.textContent), keys: document.querySelectorAll('#iKeys .wk').length, notes: getComputedStyle(document.getElementById('edWrap')).display}; });
  check('B shows the bass’s instrument: its model’s knobs, one note of it computed and drawn, a keyboard, in the notes’ place', st.kind === 'native' && st.buf > 1000 && /the model/.test(st.cap) && st.knobs.includes('Bend') && st.keys === 15 && st.notes === 'none', JSON.stringify(st));
  const was = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[3].sound; return [id, JSON.stringify(SND[id].src)]; });
  const bend = page.locator('#iMods .kn', {hasText: /^Bend[0-9.]/}), kb = await bend.boundingBox();
  await page.mouse.move(kb.x + kb.width/2, kb.y + 20); await page.mouse.down(); await page.mouse.move(kb.x + kb.width/2, kb.y - 120, {steps: 8}); await page.mouse.up(); await page.waitForTimeout(400);
  const k1 = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[3].sound]; return [s.mine, s.src.knobs?.index]; });
  check('dragging the Bend knob up turns it up, on your own copy', k1[0] && k1[1] > 3 && k1[1] > (JSON.parse(was[1]).knobs?.index ?? 0), JSON.stringify(k1));
  for (let k = 0; k < 60 && !(await D(() => /the model/.test(window.__daw.SI.state().cap))); k++) await page.waitForTimeout(100);
  check('and the note is drawn again from the changed model', await D(() => window.__daw.SI.state().buf?.length > 1000));
  await page.keyboard.press('Meta+z'); const und = await D(() => { const {ST, SND} = window.__daw, id = ST.P.tracks[3].sound; return [id, JSON.stringify(SND[id].src)]; });
  check('undo puts the library’s sound back', und[0] === was[0] && was[0] === 'b-fmpluck' && und[1] === was[1], JSON.stringify([was, und]));
  // the computer's keys play it: A is the keyboard's lowest C, held while it's down
  await D(() => { const {E} = window.__daw; E.init(); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.out.connect(a); window.__an = a; });
  const low = await D(() => +document.querySelector('#iKeys .wk').dataset.p); await page.keyboard.down('a'); let peak = 0;
  for (let k = 0; k < 30 && peak < .01; k++) { await page.waitForTimeout(100); peak = await D(() => { const x = new Float32Array(2048); window.__an.getFloatTimeDomainData(x); return Math.max(...x.map(Math.abs)); }); }
  const lit = await D(() => document.querySelector('#iKeys [data-down="1"]')?.dataset.p); await page.keyboard.up('a');
  check('the A key plays the keyboard’s lowest C and lights it', +lit === low && peak > .01, `${lit} ${low} ${peak.toFixed(3)}`);
  check('and the letters didn’t reach the page (A plays, it doesn’t select)', await D(() => window.__daw.ST.sel.clips.size === 0 && !document.getElementById('side').hidden === false));
  // the poly synth: its filter drawn, and turned while it's heard
  await D(() => { window.__daw.ST.P.tracks[4].sound = 'c-warm'; window.__daw.E.refresh(); }); await page.locator('.trk').nth(4).click(); await page.waitForTimeout(300);
  const pm = await D(() => ({mods: [...document.querySelectorAll('#iMods .mod h3')].map(x => x.textContent), graphs: document.querySelectorAll('#iMods canvas.graph').length}));
  check('a poly synth: oscillators, filter, amp, LFO, voices, output, with the filter’s curve and both envelopes drawn', ['Oscillators', 'Filter', 'Amp', 'LFO', 'Play', 'Output'].every(m => pm.mods.includes(m)) && pm.graphs === 3, JSON.stringify(pm));
  const cut = page.locator('#iMods .kn', {hasText: 'Cutoff'}), cb = await cut.boundingBox(); await page.mouse.move(cb.x + cb.width/2, cb.y + 20); await page.mouse.down();
  await page.mouse.move(cb.x + cb.width/2, cb.y + 100, {steps: 6}); const liveCut = await D(() => window.__daw.SI.state().M.values.cut); await page.mouse.up(); await page.waitForTimeout(300);
  const cut2 = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[4].sound]; return [s.mine, s.src.poly?.cut]; });
  check('turning the cutoff down moves the graph as it turns, and sets your copy when let go', liveCut < 1300 && cut2[0] && cut2[1] < 1300 && Math.abs(cut2[1] - liveCut) < liveCut*.05, `${liveCut} ${JSON.stringify(cut2)}`);
  await page.keyboard.press('Meta+z');
  // the hats: pads, one a voice; a pad pressed plays it and picks it
  await page.locator('.trk').nth(1).click(); await page.waitForTimeout(300); const pads = await D(() => [...document.querySelectorAll('#iKeys .pad')].map(p => p.dataset.p));
  await page.locator('#iKeys .pad[data-p="ohh"]').click(); await page.waitForTimeout(200);
  check('the hats’ instrument has a pad for each voice, and pressing one picks it', pads.join() === 'chh,ohh,ride' && await D(() => window.__daw.SI.state().M.voice) === 'ohh', pads.join());
  // a clip double-clicked goes back to its notes
  const [cx, cy] = await at(1, (await clips(1))[0].start + .5); await page.mouse.dblclick(cx, cy);
  check('double-clicking a clip shows its notes again', await D(() => !window.__daw.SI.isOn() && getComputedStyle(document.getElementById('edWrap')).display !== 'none')); }

// live: the FM and the Resonator computed sample by sample as they play (an AudioWorklet), the same maths as the notes
// computed ahead; a key held holds the note, a knob turned is heard in the note sounding, and letting go keeps it ringing
{ await page.reload(); await page.waitForTimeout(1500);
  const lv = await D(() => new Promise(r => { const {E, ST} = window.__daw; E.init(); const t0 = Date.now(), w = () => E.liveOK || Date.now() - t0 > 6000 ? r({ok: E.liveOK, err: E.liveErr, t: ST.P.tracks.map((T, i) => [T.name, E.isLive(i)])}) : setTimeout(w, 50); w(); }));
  const L = Object.fromEntries(lv.t);
  const chordsPoly = await D(() => { const {ST, SND} = window.__daw, s = SND[ST.P.tracks[4].sound]; return !!s.src?.palette && !['marimba', 'musicbox', 'steel', 'wood', 'tubular', 'vibes', 'metal'].includes(s.src.palette); });
  check('the FM bass, the bamboo, the marimba and the poly synth play live; the bowed strings and the drums are still computed ahead', lv.ok && L.Bass && L.Lead && L['Lead 2'] && L.Chords === chordsPoly && !L.Kick, JSON.stringify(lv) + ' chords on the poly synth: ' + chordsPoly);
  const eq = await D(async () => { const {NATIVE} = await import('/studio/lib/native/index.js'), u = URL.createObjectURL(new Blob([document.getElementById('worklet-src').textContent], {type: 'text/javascript'})), out = {};
    for (const [name, engine, n, vel, len, params] of [['fmpluck', 'fm', 40, .8, .3, {index: 2.5}], ['fmround', 'fm', 36, .6, .6, {}], ['bamboo', 'md', 57, .9, null, {ring: 1.4}], ['marimba', 'md', 60, .7, null, {hard: .8}]]) {
      const sr = 44100, ctx = new OfflineAudioContext(2, sr*2, sr); await ctx.audioWorklet.addModule(u);
      const node = new AudioWorkletNode(ctx, 'native-voices', {numberOfInputs: 0, outputChannelCount: [2], processorOptions: {init: [{type: 'load', engine, name, gain: NATIVE[name].gain, params}, {type: 'on', id: 1, n, vel, t: .1}, ...(len ? [{type: 'off', id: 1, t: .1 + len}] : [])]}});
      node.connect(ctx.destination); const b = await ctx.startRendering(), ref = NATIVE[name].make(sr, n, vel, len ? {...params, len} : params), g = NATIVE[name].gain*(.4 + .6*vel), off = Math.round(.1*sr);
      let e = 0, s = 0; const m = Math.min(ref.L.length, sr*2 - off); for (let i = 0; i < m; i++) for (const [x, y] of [[ref.L[i]*g, b.getChannelData(0)[off + i]], [ref.R[i]*g, b.getChannelData(1)[off + i]]]) { e += (x - y)**2; s += x*x; }
      out[name] = +(10*Math.log10(e/s)).toFixed(1); } return out; });
  check('played live, each note is the same as computed ahead (the difference far below hearing)', Object.values(eq).every(v => v < -50), JSON.stringify(eq));
  // held: the round FM bass's note, a key held two seconds sounds on (computed ahead it would end after a beat)
  await D(() => { const {ST, E} = window.__daw; ST.P.tracks[3].sound = 'b-fmround'; E.refresh(); const a = E.ctx.createAnalyser(); a.fftSize = 4096; E.out.connect(a); window.__an = a; });
  await page.locator('.trk').nth(3).click(); if (!(await D(() => window.__daw.SI.isOn()))) await page.keyboard.press('b'); await page.waitForTimeout(400);
  check('the Instrument view says it plays live', await D(() => !document.getElementById('iLive').hidden));
  // and it says so when the live voices arrive after the panel is already showing (a fresh page: the instrument shown first)
  { const q = await browser.newPage({viewport: {width: 1400, height: 860}}); await q.goto(url + 'studio/listen/studio-daw.html'); await q.waitForTimeout(1200);
    await q.locator('.trk').nth(3).click(); await q.keyboard.press('b'); const before = await q.evaluate(() => [window.__daw.E.liveOK, document.getElementById('iLive').hidden]);
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
  const ringTail = async ring => { await page.locator('.trk').nth(6).click(); await page.waitForTimeout(300);
    // (heard at the instrument itself, before the track's echo and reverb, whose repeats would hide its tail)
    await D(() => { const {E, ST} = window.__daw; E.kbOn(6, ST.P.tracks[6].sound, 72, .8); const a = E.ctx.createAnalyser(); a.fftSize = 4096; E.kb.c.inst.live.connect(a); window.__an2 = a; });
    await page.waitForTimeout(150); if (ring) await D(`window.__daw.E.live(6, {native: 'ring'}, ${ring})`); await page.waitForTimeout(1300);
    const r = await D(() => { const x = new Float32Array(4096); window.__an2.getFloatTimeDomainData(x); return Math.sqrt(x.reduce((a, v) => a + v*v, 0)/x.length); });
    await D(() => { const {E} = window.__daw; E.kbOff(6, 72); E.live(6, {native: 'ring'}, 1); }); await page.waitForTimeout(2500); return r; };
  const plain = await ringTail(0), longer = await ringTail(3);
  check('the marimba’s Ring turned up while a note rings makes that note ring on', longer > plain*10, `${plain.toFixed(4)} → ${longer.toFixed(4)}`);

  // the native poly synth: Warm pad on the chords, played live: a key held holds it, the cutoff turned while it's held
  // darkens it at once, and offline, every library sound on it about as loud as the browser-built synth made it
  await D(() => { const {ST, E} = window.__daw; ST.P.tracks[4].sound = 'c-warm'; E.refresh(); }); await page.locator('.trk').nth(4).click(); await page.waitForTimeout(400);
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
  // the song plays live too: the bass from its first clip heard
  await D(() => { const {E} = window.__daw; E.play(32); }); await page.waitForTimeout(1500); const song = await rms(); await D(() => window.__daw.E.stop());
  check('the song plays with the live bass', song > .01, song.toFixed(4)); await page.keyboard.press('b'); }

// more tracks: + Add a track (a kind: the new track below the selected one, its sound from a track of that kind), a clip
// made in it, a bass clip dragged onto it, renamed in place, duplicated with its clips, deleted with a second click, and
// every step undone; kept across a reload; Claude's version as written, without them
{ await page.reload(); await page.waitForTimeout(1500); await D(() => { const {ST, E} = window.__daw; ST.P.tracks[4].sound = ST.orig.tracks[4].sound; E.refresh(); });
  const n0 = await D(() => window.__daw.ST.P.tracks.length), names = () => D(() => window.__daw.ST.P.tracks.map(T => T.name));
  await page.locator('.trk').nth(3).click(); await page.click('#addTrk'); await page.locator('#pop button', {hasText: /^Bass/}).click(); await page.waitForTimeout(300);
  const nt = await D(() => { const {ST, E} = window.__daw, T = ST.P.tracks[4]; return {n: ST.P.tracks.length, name: T.name, role: T.role, sound: T.sound, bass: ST.P.tracks[3].sound, clips: T.clips.length, sel: ST.sel.track, rows: document.querySelectorAll('#trackList .trk').length, ch: E.ctx ? E.ch.length : null}; });
  check('+ Add a track → Bass: a “Bass 2” below the bass, empty, on the bass’s sound', nt.n === n0 + 1 && nt.name === 'Bass 2' && nt.role === 'bass' && nt.sound === nt.bass && nt.clips === 0 && nt.sel === 4 && nt.rows === n0 + 1, JSON.stringify(nt));
  // a clip made in it by a double-click, and one of the bass's dragged down onto it
  await D(() => { const {ST} = window.__daw; ST.sx = 30*ST.px; ST.sy = 0; window.__daw.E && 0; }); await D(() => document.getElementById('arr').dispatchEvent(new WheelEvent('wheel', {deltaY: 0})));
  const [x1, y1] = await at(4, 31.5); await page.mouse.dblclick(x1, y1); await page.waitForTimeout(200);
  const made = await D(() => window.__daw.ST.P.tracks[4].clips.map(c => [c.start, c.len]));
  check('a double-click in its lane makes a bar-long clip there', made.length === 1 && made[0][0] === 31 && made[0][1] === 16, JSON.stringify(made));
  await page.keyboard.press('Escape'); const bc = (await clips(3))[0], [bx1, by1] = await at(3, bc.start + 2), [, by2] = await at(4, bc.start + 2);
  await page.mouse.move(bx1, by1); await page.mouse.down(); await page.mouse.move(bx1, by2, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(200);
  check('a bass clip dragged down onto it moves there', await D(`window.__daw.ST.P.tracks[4].clips.some(c => c.id === '${bc.id}') && !window.__daw.ST.P.tracks[3].clips.some(c => c.id === '${bc.id}')`));
  // heard: the song from that clip, the new track's channel playing
  await D(() => { const {E} = window.__daw; E.init(); }); await page.waitForTimeout(200);
  check('the engine has a channel for it', await D(() => window.__daw.E.ch.length === window.__daw.ST.P.tracks.length && window.__daw.E.ch[4].T === window.__daw.ST.P.tracks[4]));
  // renamed in place
  await page.locator('.trk').nth(4).locator('.nm').dblclick(); await page.keyboard.press('Meta+a'); await page.keyboard.type('Sub line'); await page.keyboard.press('Enter');
  check('double-clicking its name renames it', (await names())[4] === 'Sub line', JSON.stringify(await names()));
  // duplicated with its clips, from its ⋯ menu
  await page.locator('.trk').nth(4).locator('.more').click(); await page.locator('#pop button', {hasText: 'Duplicate'}).click(); await page.waitForTimeout(200);
  const dup = await D(() => { const T = window.__daw.ST.P.tracks; return [T.length, T[5].name, T[5].clips.length, T[4].clips.length, new Set(T.flatMap(x => x.clips.map(c => c.id))).size === T.flatMap(x => x.clips).length]; });
  check('⋯ → Duplicate copies it below with its clips (each its own)', dup[0] === n0 + 2 && dup[1] === 'Sub line 2' && dup[2] === dup[3] && dup[4], JSON.stringify(dup));
  // deleted: the first click asks, the second deletes
  await page.locator('.trk').nth(5).locator('.more').click(); const del = page.locator('#pop button', {hasText: 'Delete'}); await del.click();
  const asked = await D(() => [document.querySelector('#pop .danger')?.textContent, window.__daw.ST.P.tracks.length]); await del.click(); await page.waitForTimeout(200);
  check('Delete asks once (naming its clips), then deletes', /click again/.test(asked[0]) && asked[1] === n0 + 2 && (await names()).length === n0 + 1, JSON.stringify(asked));
  // undone step by step: the deletion, the copy, the name, the drag, the clip, the track
  for (let k = 0; k < 6; k++) await page.keyboard.press('Meta+z');
  check('undo takes them all back, track and all', (await names()).length === n0 && !(await names()).includes('Bass 2') && await D(`window.__daw.ST.P.tracks[3].clips.some(c => c.id === '${bc.id}')`), JSON.stringify(await names()));
  for (let k = 0; k < 6; k++) await page.keyboard.press('Meta+Shift+z');
  check('and redo brings them back', (await names()).join() === [...(await D(() => window.__daw.ST.orig.tracks.map(T => T.name))).slice(0, 4), 'Sub line', ...(await D(() => window.__daw.ST.orig.tracks.map(T => T.name))).slice(4)].join(), JSON.stringify(await names()));
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
  await ph.evaluate(() => { const {ST} = window.__daw; ST.sx = 0; }); const c = await ph.evaluate(() => { const {ST} = window.__daw, k = ST.P.tracks[2].clips[0]; return [(k.start + .5)*ST.px, 72 + 2*56 + 28]; });
  const cdp = await ph.context().newCDPSession(ph), tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
  await tp('touchStart', A.x + c[0], A.y + c[1]); for (let k = 1; k <= 5; k++) await tp('touchMove', A.x + c[0] + 20*k, A.y + c[1]); await tp('touchEnd');
  check('a clip dragged on a phone stays put', await ph.evaluate(() => JSON.stringify(window.__daw.ST.P.tracks[0].clips.map(c => c.start))) === before && await ph.evaluate(() => window.__daw.ST.P.tracks[2].clips[0].start) === 0);
  await ph.evaluate(() => document.getElementById('up').click()); await ph.waitForTimeout(200);
  check('a like on a phone is kept', await ph.evaluate(() => window.__daw.ST.notes[0]?.rating === 1)); await ph.close(); }

await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
