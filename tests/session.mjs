// The Session view of the Studio DAW (studio/listen/studio-daw.html; studio/arrange/session.js): the clip grid seeded
// from the song's sections (a column a track, a row a scene, its ground beside it), a scene launched and heard, a clip
// launched while playing coming in on the next bar line, a scene's clips playing the notes the Arrangement writes out for
// that section (the same parts over the same ground), the Clip tab's tools changing the chosen clip (and undo), a new clip
// in an empty slot, a scene captured, a ground changed, all kept across a reload; and stage 2: one editor in both views
// (the Clip tab as Steps or the piano roll), Freeze and Make live, → Session (a section as a scene whose copies know where
// they came from, marked when changed, put back), ● Rec into the Arrangement, and Back to Arrangement; and a drum clip's
// parts one under the other, a part added on any drum at its own length, ← → and [ ] between them, mute and remove.
import { serve, launch } from './lib.mjs';

const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch('2d', ['--autoplay-policy=no-user-gesture-required']), page = await browser.newPage({viewport: {width: 1400, height: 900}});
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(url + 'studio/listen/studio-daw.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await wait(2500);
const Q = (fn, a) => page.evaluate(fn, a);

// the grid, seeded from the song
const g = await Q(() => { const {ST} = window.__daw, S = ST.P.session; return {view: ST.view, scenes: S.scenes.length, secs: ST.P.marks.length, cols: ST.P.tracks.length,
  heads: document.querySelectorAll('#sessWrap .shead').length - 1, slots: document.querySelectorAll('#sessWrap .slot[data-t]').length, full: document.querySelectorAll('#sessWrap .slot[data-has="1"]').length,
  grounds: [...document.querySelectorAll('#sessWrap .ground')].map(b => b.textContent).slice(0, 2), tabs: [...document.querySelectorAll('.etabs button')].filter(b => !b.hidden).map(b => b.textContent)}; });
check('the Session opens: a column a track, a row a section of the song, each with its ground, and the Clip tab', g.view === 'session' && g.scenes === g.secs && g.heads === g.cols && g.slots === g.scenes*g.cols && g.full > g.scenes && g.grounds.every(x => /[A-G]/.test(x)) && g.tabs[0] === 'Clip', JSON.stringify(g));

// a scene's clips play the notes the Arrangement writes out for that section (parts without Life: the same notes, on the same 16ths)
const same = await Q(() => { const {ST, SS} = window.__daw, S = ST.P.session, out = [];
  S.scenes.forEach((sc, r) => { const at = ST.P.marks[r]?.at; if (at == null) return;
    ST.P.tracks.forEach((T, i) => { const cl = S.cells[T.id][r]; if (!cl || cl.parts.some(p => p.play)) return;
      SS.RT.play = {[T.id]: {r, start: 0}}; SS.RT.next = {}; SS.RT.H = sc.ground; SS.RT.hStart = 0; SS.RT.notes.clear();
      const got = []; for (let k = 0; k < 32; k++) { if (k % 16 === 0) SS.hook.bar(k); for (const [j, list] of SS.hook.at(k)) if (j === i) for (const n of list) got.push(`${k}:${n.p}`); }
      const want = ST.orig.tracks.find(x => x.id === T.id)?.clips.filter(c => c.start === at).flatMap(c => c.notes.filter(n => n.s < 32).map(n => `${Math.floor(n.s + 1e-6)}:${n.p}`)) || [];
      out.push({r, t: T.name, ok: got.length > 0 && got.sort().join() === want.sort().join(), got: got.length, want: want.length}); }); });
  SS.RT.play = {}; SS.RT.notes.clear(); return out; });
check(`a scene's clips play the notes the Arrangement writes out for that section (${same.length} clips compared)`, same.length > 5 && same.every(x => x.ok), JSON.stringify(same.filter(x => !x.ok).slice(0, 3)));

// heard: a scene launched; then a clip launched while it plays comes in on the next bar line
await Q(() => { const {E} = window.__daw; E.init(); const a = E.ctx.createAnalyser(); a.fftSize = 2048; E.out.connect(a); window.__peak = 0;
  setInterval(() => { const x = new Float32Array(2048); a.getFloatTimeDomainData(x); let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); window.__peak = Math.max(window.__peak, m); }, 10); });
await wait(1500); await Q(() => window.__peak = 0); await page.click('#sessWrap .scene .sgo >> nth=3'); await wait(3500);
const heard = await Q(() => ({peak: window.__peak, playing: Object.keys(window.__daw.SS.RT.play).length, scene: window.__daw.SS.RT.scene}));
check('a scene launched plays its clips and is heard', heard.peak > .02 && heard.playing >= 2 && heard.scene === 3, JSON.stringify(heard));
const other = await Q(() => { const {ST, SS} = window.__daw, S = ST.P.session; for (let r = 0; r < S.scenes.length; r++) if (r !== 3 && S.cells.rack?.[r]) return r; return -1; });
await page.click(`#sessWrap .slot[data-t="0"][data-r="${other}"]`); const q0 = await Q(() => ({next: window.__daw.SS.RT.next.rack, step: window.__daw.E.slot}));
await wait(2600); const q1 = await Q(() => window.__daw.SS.RT.play.rack);
check('a clip launched while playing waits for the next bar line, then plays from it', q0.next === other && q1?.r === other && q1.start % 16 === 0 && q1.start > q0.step - 16, JSON.stringify({q0, q1}));
// the grid shows it once it's heard: the clip lit as playing, nothing left flashing; and a scene queued further up (an
// earlier one) takes over on its bar line, the grid with it
const dom = () => Q(() => ({on: [...document.querySelectorAll('#sessWrap .slot[data-on="1"]')].map(b => b.dataset.t + ':' + b.dataset.r), next: document.querySelectorAll('#sessWrap [data-next="1"], #sessWrap [data-next="stop"]').length,
  scene: document.querySelector('#sessWrap .scene[data-on="1"] b')?.textContent, rt: window.__daw.SS.RT.scene}));
const d1 = await dom();
await page.click('#sessWrap .scene .sgo >> nth=0'); await wait(200); const d2 = await dom(); await wait(2600); const d3 = await dom();
const first = await Q(() => window.__daw.ST.P.session.scenes[0].name);
check('the grid shows a launched clip playing once it is heard, and an earlier scene queued takes over on the bar line', d1.on.includes(`0:${other}`) && !d1.next && d2.next > 0 && d3.rt === 0 && d3.scene === first && !d3.next && d3.on.every(x => x.endsWith(':0')), JSON.stringify({d1, d2, d3}));
// a playing clip clicked is chosen, not stopped, and the Clip tab's playhead walks its steps and notes as it plays
const pc = await Q(() => { const b = document.querySelector('#sessWrap .slot[data-on="1"][data-has="1"]:not([data-t="0"])') || document.querySelector('#sessWrap .slot[data-on="1"]'); return [b.dataset.t, b.dataset.r]; });
await page.click(`#sessWrap .slot[data-t="${pc[0]}"][data-r="${pc[1]}"] .cn`); await wait(400);
const still = await Q(([t, r]) => window.__daw.SS.RT.play[window.__daw.ST.P.tracks[t].id]?.r === +r, pc);
const walk = []; for (let i = 0; i < 10; i++) { walk.push(await Q(() => [...document.querySelectorAll('#clipPane .prow[data-sel="1"] .pcells i')].findIndex(x => x.dataset.now === '1'))); await wait(120); }
const steps = walk.filter(x => x >= 0), moves = steps.filter((x, i) => i && x !== steps[i - 1]).length;
check('a playing clip clicked is chosen, not stopped, and the Clip tab lights the step being heard as it plays', still && steps.length >= 8 && moves >= 5, JSON.stringify({still, walk}));
await page.keyboard.press(' '); await wait(300);
check('Space stops it', await Q(() => !window.__daw.E.playing));

// the Clip tab: a clip chosen, a rhythm tool and a notes tool change it, undo puts it back, a hit tapped in
await page.click('#sessWrap .slot[data-t="1"][data-has="1"] >> nth=0'); await wait(200);
const c0 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
await page.click('#clipPane .cmod >> nth=1 >> .tools button >> text=Develop'); await wait(150);
const c1 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
await page.click('#clipPane .cmod >> nth=2 >> .tools button >> nth=1'); await wait(150);
const c2 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
await page.click('#clipPane .chead button >> text=Undo'); await page.click('#clipPane .chead button >> text=Undo'); await wait(150);
const c3 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
check('the Clip tab\'s rhythm and notes tools change the chosen clip, and undo puts it back', c1 !== c0 && c2 !== c1 && c3 === c0, `${c0.length} → ${c1.length} → ${c2.length} → ${c3.length}`);
const h0 = await page.$$eval('#clipPane .prow[data-sel="1"] .pcells i', s => s.filter(x => x.dataset.on).length); await page.click('#clipPane .prow[data-sel="1"] .pcells i:not([data-on="1"]):not([data-on="2"]) >> nth=0'); await wait(150);
const h1 = await page.$$eval('#clipPane .prow[data-sel="1"] .pcells i', s => s.filter(x => x.dataset.on).length);
await page.keyboard.press('p'); await wait(100); const life = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return ST.P.session.cells[T.id][SS.RT.sel.r].parts[0].play; });
check('a step tapped in adds a hit, and P turns Life up', h1 === h0 + 1 && life >= 1, `${h0} → ${h1} hits, Life ${life}`);

// a new clip in an empty slot, a scene captured, a ground changed; all kept across a reload
const empty = await Q(() => { const {ST} = window.__daw, S = ST.P.session; for (let r = 0; r < S.scenes.length; r++) for (let t = 0; t < ST.P.tracks.length; t++) if (!S.cells[ST.P.tracks[t].id][r]) return [t, r]; return null; });
await page.dblclick(`#sessWrap .slot[data-t="${empty[0]}"][data-r="${empty[1]}"]`); await wait(200);
const made = await Q(([t, r]) => { const {ST} = window.__daw; return !!ST.P.session.cells[ST.P.tracks[t].id][r]?.parts[0].R.hits.length; }, empty);
const n0 = await Q(() => window.__daw.ST.P.session.scenes.length); await page.click('#sessWrap button >> text=Capture'); await wait(150);
await page.click('#sessWrap .ground >> nth=0'); await page.click('#pop button >> nth=-1'); await wait(150);
const gnd = await Q(() => window.__daw.ST.P.session.scenes[0].ground.name);
await wait(3500); await page.reload(); await wait(2500);
const kept = await Q(([t, r]) => { const {ST} = window.__daw, S = ST.P.session; return {made: !!S.cells[ST.P.tracks[t].id][r], scenes: S.scenes.length, ground: S.scenes[0].ground.name}; }, empty);
check('a new clip in an empty slot, a scene captured and a ground changed are kept across a reload', made && kept.made && kept.scenes === n0 + 1 && kept.ground === gnd, JSON.stringify({made, n0, gnd, kept}));

// the views: one editor in both, the Clip tab first (Steps or the piano roll), the Arrangement the timeline, the Session the grid
await page.click('#vArr'); await wait(300);
const va = await Q(() => ({sess: !document.getElementById('sessWrap').hidden, arr: !document.getElementById('arrWrap').hidden, tabs: [...document.querySelectorAll('.etabs button')].filter(b => !b.hidden).map(b => b.textContent)}));
await page.click('#vSess'); await wait(300); const vs = await Q(() => ({sess: !document.getElementById('sessWrap').hidden, clip: !document.getElementById('clipPane').hidden}));
check('both views have the same editor (Clip, Instrument, Mixer): the Arrangement the timeline, the Session the grid', !va.sess && va.arr && va.tabs.join() === 'Clip,Instrument,Mixer' && vs.sess && vs.clip, JSON.stringify({va, vs}));

// stage 2. In the Arrangement: a live clip opened shows as Steps with the jam's tools, or in the piano roll; Freeze makes it notes
await page.click('#vArr'); await wait(300);
const al = await Q(() => { const {ST} = window.__daw, T = ST.P.tracks.find(T => T.role === 'bass'), cl = T.clips[0]; cl.parts = cl.parts || null;
  return {id: cl.id, live: !!cl.parts?.length}; });
// (the songs write their clips out as notes: one is made live first, through the Clip tab's Make live)
await Q(id => window.__daw.openEd(id, true), al.id); await page.click('#tabClip'); await page.click('#clipMode button[data-m="steps"]'); await wait(200);
if (!al.live) { await page.click('#clipPane button:has-text("Make live")'); await wait(300); }
const ar = await Q(id => { const {ST} = window.__daw, T = ST.P.tracks.find(T => T.clips.some(c => c.id === id)), cl = T.clips.find(c => c.id === id);
  return {live: !!cl.parts?.length, notes: cl.notes.length, steps: document.querySelectorAll('#clipPane .prow .pcells i').length, tools: document.querySelectorAll('#clipPane .tools button').length, pane: !document.getElementById('clipPane').hidden}; }, al.id);
check('in the Arrangement a clip opens in the Clip tab as Steps with the jam\'s tools, and Make live has it follow the chords (its notes worked out)', ar.live && ar.notes > 0 && ar.steps >= 16 && ar.tools > 4 && ar.pane, JSON.stringify(ar));
await page.click('#clipMode button[data-m="roll"]'); await wait(200);
const roll = await Q(() => ({roll: !document.getElementById('edWrap').hidden, pane: !document.getElementById('clipPane').hidden, live: document.getElementById('edLive').textContent}));
await page.click('#edLive button'); await wait(300);
const fz = await Q(id => { const {ST} = window.__daw, cl = ST.P.tracks.flatMap(T => T.clips).find(c => c.id === id); return {live: !!cl.parts?.length, notes: cl.notes.length}; }, al.id);
check('the piano roll shows the same clip, and ❄ Freeze to notes keeps its notes to edit one by one', roll.roll && !roll.pane && /Freeze/.test(roll.live) && !fz.live && fz.notes === ar.notes, JSON.stringify({roll, fz}));

// Send to Session: a section of the song becomes a scene, its clips remembering where they came from
const s0 = await Q(() => window.__daw.ST.P.session.scenes.length);
await Q(() => { const {ST} = window.__daw; ST.sel = {clips: new Set(), range: null, mark: 1, track: 0}; }); await page.click('#toSess'); await wait(500);
const sent = await Q(() => { const {ST, SS} = window.__daw, S = ST.P.session, r = S.scenes.length - 1, sc = S.scenes[r], m = ST.P.marks[1];
  return {view: ST.view, n: S.scenes.length, name: sc.name, mark: m.name, from: sc.from, ground: sc.ground.bars.join() === ST.P.chords.slice(m.at, m.at + m.bars).join(),
    cells: ST.P.tracks.filter(T => S.cells[T.id][r]).length, withFrom: ST.P.tracks.filter(T => S.cells[T.id][r]?.from?.a === m.at).length, sel: SS.RT.sel.r === r}; });
check('→ Session: a section of the song becomes a new scene over the song\'s chords there, each clip knowing where it came from', sent.view === 'session' && sent.n === s0 + 1 && sent.name === sent.mark && sent.ground && sent.cells > 1 && sent.withFrom === sent.cells && sent.sel, JSON.stringify(sent));
// a copy changed: marked, and Put back writes it into those bars of the song
const chg0 = await Q(() => document.querySelectorAll('#sessWrap .slot .chg').length);
const ci = await Q(() => { const {ST, SS} = window.__daw, S = ST.P.session, r = S.scenes.length - 1; const t = ST.P.tracks.findIndex(T => S.cells[T.id][r]?.notes?.length && T.role !== 'drums'); SS.select(t, r); return t; });
await page.click('#clipPane .nsteps .st >> nth=1'); await wait(300);
const chg = await Q(() => ({tags: document.querySelectorAll('#sessWrap .slot .chg').length, back: document.querySelectorAll('#sessWrap .putback').length, clipBack: !!document.querySelector('#clipPane .putback')}));
await page.click('#clipPane .putback'); await wait(300);
const pb = await Q(t => { const {ST} = window.__daw, S = ST.P.session, r = S.scenes.length - 1, T = ST.P.tracks[t], c = S.cells[T.id][r], f = c.from;
  const over = T.clips.filter(x => x.start < f.b && x.start + x.len/16 > f.a); return {tags: document.querySelectorAll('#sessWrap .slot .chg').length, over: over.length, same: over[0] && JSON.stringify(over[0].notes.filter(n => n.s < c.len)) === JSON.stringify(c.notes), span: over[0] && [over[0].start, over[0].len/16], f: [f.a, f.b]}; }, ci);
check('a copy changed in the Session says so (the slot, the scene\'s ↩ Put back, the Clip tab), and Put back writes it into its bars of the song', chg0 === 0 && chg.tags === 1 && chg.back >= 1 && chg.clipBack && pb.tags === 0 && pb.over === 1 && pb.same && pb.span[0] === pb.f[0] && pb.span[1] === pb.f[1] - pb.f[0], JSON.stringify({chg0, chg, pb}));
// Make live and Freeze in the Session too
await page.click('#clipPane button:has-text("Make live")'); await wait(200);
const sl = await Q(t => { const {ST} = window.__daw, S = ST.P.session, r = S.scenes.length - 1, c = S.cells[ST.P.tracks[t].id][r]; return {live: !!c.parts?.length, steps: document.querySelectorAll('#clipPane .prow .pcells i').length}; }, ci);
await page.click('#clipPane button:has-text("Freeze")'); await wait(200);
const sf = await Q(t => { const {ST} = window.__daw, S = ST.P.session, r = S.scenes.length - 1, c = S.cells[ST.P.tracks[t].id][r]; return {live: !!c.parts?.length, notes: c.notes.length, rows: document.querySelectorAll('#clipPane .nsteps .nrow').length, cn: document.querySelector('#sessWrap .slot[data-sel="1"] .cn')?.textContent}; }, ci);
check('in the Session Make live has a clip follow the chords, and Freeze makes it notes again (steps a pitch a row, ♪ in the grid)', sl.live && sl.steps >= 16 && !sf.live && sf.notes > 0 && sf.rows > 0 && /♪/.test(sf.cn), JSON.stringify({sl, sf}));

// recording what the Session plays into the Arrangement: the scene's bars, clips knowing their scene, a section named after it
const r0 = await Q(() => ({bars: window.__daw.ST.P.bars, bpm: window.__daw.ST.P.bpm}));
await Q(() => { const {ST} = window.__daw; ST.ph = ST.P.bars; }); await page.click('#recArr'); await page.click('#sessWrap .scene .sgo >> nth=2');
const barMs = 4*60/r0.bpm*1000; await wait(barMs*3.5); await page.click('#recArr'); await page.keyboard.press(' '); await wait(300);
const rec = await Q(r0 => { const {ST} = window.__daw, P = ST.P, name = P.session.scenes[2].name, m = P.marks.filter(x => x.at >= r0.bars);
  const clips = P.tracks.flatMap(T => T.clips.filter(c => c.start >= r0.bars)); return {bars: P.bars, marks: m.map(x => x.name + ':' + x.bars), name, clips: clips.length, from: clips.filter(c => c.from?.scene === name).length, chords: P.chords.length}; }, r0);
check('● Rec records what the Session plays onto the end of the song: its bars, a section named after the scene, the clips knowing where they came from', rec.bars >= r0.bars + 2 && rec.marks.length === 1 && rec.marks[0].startsWith(rec.name) && rec.clips > 1 && rec.from === rec.clips && rec.chords >= rec.bars, JSON.stringify(rec));

// Back to Arrangement: a Session clip launched while the Arrangement plays takes its track over until handed back
await page.click('#vArr'); await wait(200); await Q(() => { window.__daw.ST.ph = 0; }); await page.click('#play'); await wait(600);
const tid = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks.find(T => ST.P.session.cells[T.id][0]); SS.launch(T.id, 0); return T.id; });
await wait(barMs*1.6);
const own = await Q(tid => ({mode: window.__daw.SS.RT.mode, own: window.__daw.SS.RT.own.has(tid), back: !document.getElementById('backArr').hidden}), tid);
await page.click('#backArr'); await wait(300);
const gave = await Q(tid => ({own: window.__daw.SS.RT.own.size, back: !document.getElementById('backArr').hidden, playing: window.__daw.E.playing}), tid);
await page.click('#play');
check('a Session clip launched while the Arrangement plays takes its track over on the bar line, and Back to Arrangement hands it back', own.mode === 'mix' && own.own && own.back && !gave.own && !gave.back && gave.playing, JSON.stringify({own, gave}));
// the drum parts: a rack clip's parts one under the other, ＋ Part adds a drum of its own at its own length (a polyrhythm),
// heard on its own cycle; ← → (after a click in the Clip tab) and [ ] move between them; M mutes one; ✕ takes it away
await page.click('#vSess'); await wait(300);
const dt = await Q(() => { const {ST, SS} = window.__daw, t = ST.P.tracks.findIndex(T => T.role === 'drums'); SS.select(t, 3); return t; }); await wait(200);
const p0 = await Q(() => ({rows: document.querySelectorAll('#clipPane .prow').length, opts: [...document.querySelectorAll('#clipPane .addp option')].map(o => o.value).filter(Boolean)}));
const pad = p0.opts.find(v => /ride|rim|clave|cow/.test(v)) || p0.opts.at(-1);
await page.selectOption('#clipPane .addp', pad); await wait(200); for (let i = 0; i < 4; i++) await page.click('#clipPane .lenDn'); await wait(200);
// what the drums play over 48 steps, from the hook as the engine asks it
const hear = () => Q(([t, pad]) => { const {ST, SS} = window.__daw, S = ST.P.session; SS.RT.mode = 'session'; SS.RT.play = {[ST.P.tracks[t].id]: {r: 3, start: 0}}; SS.RT.next = {}; SS.RT.H = S.scenes[3].ground; SS.RT.hStart = 0; SS.RT.notes.clear();
  const got = []; for (let k = 0; k < 48; k++) { if (k % 16 === 0) SS.hook.bar(k); for (const [j, list] of SS.hook.at(k)) if (j === t) for (const n of list) if (n.p === pad) got.push(k); }
  SS.RT.play = {}; SS.RT.notes.clear(); return got; }, [dt, pad]);
const added = await Q(() => { const {ST, SS} = window.__daw, c = ST.P.session.cells[ST.P.tracks.find(T => T.role === 'drums').id][3], q = c.parts.at(-1); return {n: c.parts.length, part: SS.RT.part, len: q.R.len, hits: q.R.hits.map(x => x[0]), rows: document.querySelectorAll('#clipPane .prow').length}; });
const got = await hear(), want = []; for (let k = 0; k < 48; k++) if (added.hits.includes(k % added.len)) want.push(k);
check(`＋ Part adds ${pad} as a part of its own (a row under the others), its length set to 12, heard on its own 12-step cycle`, added.n === p0.rows + 1 && added.rows === added.n && added.part === added.n - 1 && added.len === 12 && got.join() === want.join() && got.length >= 4, JSON.stringify({p0: p0.rows, added, got, want}));
await page.click('#clipPane .cmh b'); await page.keyboard.press('ArrowLeft'); await wait(100); const l1 = await Q(() => window.__daw.SS.RT.part);
await page.keyboard.press(']'); await wait(100); const l2 = await Q(() => window.__daw.SS.RT.part);
await page.keyboard.press(']'); await wait(100); const l3 = await Q(() => window.__daw.SS.RT.part);
check('← → after a click in the Clip tab, and [ ], move between the parts (round from the last to the first)', l1 === added.n - 2 && l2 === added.n - 1 && l3 === 0, JSON.stringify([l1, l2, l3]));
await page.click(`#clipPane .prow[data-j="${added.n - 1}"] .pm`); await wait(200); const muted = await hear();
await page.click(`#clipPane .prow[data-j="${added.n - 1}"] .px`); await wait(200);
const gone = await Q(() => window.__daw.ST.P.session.cells[window.__daw.ST.P.tracks.find(T => T.role === 'drums').id][3].parts.length);
check('M mutes a part (nothing from it heard) and ✕ takes it out of the clip', !muted.length && gone === p0.rows, JSON.stringify({muted: muted.length, gone}));
// one sequencer for every instrument: ‹ › steps a part through the library's rhythms for its kind (only that part's rhythm
// changes: its notes stay, and the other parts keep theirs); Shift-click accents a step; ＋ Part adds a second line on a
// pitched instrument, heard with the first
const lib0 = await Q(() => { const {ST} = window.__daw, c = ST.P.session.cells[ST.P.tracks.find(T => T.role === 'drums').id][3]; return c.parts.map(q => JSON.stringify([q.R.len, q.R.hits, q.N])); });
await page.click('#clipPane .prow[data-j="1"] .pv >> nth=1'); await wait(200); await page.click('#clipPane .prow[data-j="1"] .pv >> nth=1'); await wait(200);
const lib1 = await Q(() => { const {ST} = window.__daw, c = ST.P.session.cells[ST.P.tracks.find(T => T.role === 'drums').id][3]; return {parts: c.parts.map(q => JSON.stringify([q.R.len, q.R.hits, q.N])), lib: c.parts[1].lib, notes: JSON.stringify(c.parts[1].N)}; });
await page.click('#clipPane .prow[data-j="1"] .pv >> nth=0'); await wait(200);
const lib2 = await Q(() => { const {ST} = window.__daw; return ST.P.session.cells[ST.P.tracks.find(T => T.role === 'drums').id][3].parts[1].lib; });
check('‹ › steps the hats through the library\'s hat rhythms (forward twice and back once), the other parts and the hats\' own drums kept', lib1.lib && lib2 && lib2 !== lib1.lib && lib1.parts[1] !== lib0[1] && lib1.parts[0] === lib0[0] && lib1.parts[2] === lib0[2] && JSON.stringify(JSON.parse(lib0[1])[2]) === lib1.notes, JSON.stringify({lib1: lib1.lib, lib2}));
const acc = async () => Q(() => { const {ST} = window.__daw, q = ST.P.session.cells[ST.P.tracks.find(T => T.role === 'drums').id][3].parts[0]; return q.R.hits.find(x => x[0] === 0)?.[2]; });
const a0 = await acc(); await page.click('#clipPane .prow[data-j="0"] .pcells i[data-s="0"]', {modifiers: ['Shift']}); await wait(200); const a1 = await acc();
check('Shift-click on a step makes it an accent (or back)', a0 != null && a1 != null && (a0 > .8) !== (a1 > .8), JSON.stringify([a0, a1]));
const bt = await Q(() => { const {ST, SS} = window.__daw, t = ST.P.tracks.findIndex(T => T.role === 'bass'); SS.select(t, 3); return t; }); await wait(200);
await page.click('#clipPane .addp'); await wait(200);
const line = await Q(t => { const {ST, SS} = window.__daw, S = ST.P.session, c = S.cells[ST.P.tracks[t].id][3]; SS.RT.mode = 'session'; SS.RT.play = {[ST.P.tracks[t].id]: {r: 3, start: 0}}; SS.RT.next = {}; SS.RT.H = S.scenes[3].ground; SS.RT.hStart = 0; SS.RT.notes.clear();
  const at = new Set(); for (let k = 0; k < 64; k++) { if (k % 16 === 0) SS.hook.bar(k); for (const [j, list] of SS.hook.at(k)) if (j === t && list.length) at.add(k); }
  SS.RT.play = {}; SS.RT.notes.clear(); const q = c.parts[1], want = []; for (let k = 0; k < 64; k++) if (q.R.hits.some(x => x[0] === k % q.R.len)) want.push(k);
  return {n: c.parts.length, name: q.name, rows: document.querySelectorAll('#clipPane .prow').length, heard: want.filter(k => at.has(k)).length, want: want.length}; }, bt);
check('＋ Part on the bass adds a second line ("Bass 2") with its own rhythm, its hits heard with the first line\'s', line.n === 2 && line.rows === 2 && line.name === 'Bass 2' && line.want > 0 && line.heard === line.want, JSON.stringify(line));
check('no page errors', !errs.length, errs.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
