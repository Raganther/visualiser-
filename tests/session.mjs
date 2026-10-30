// The Session view of the Studio DAW (studio/listen/studio-daw.html; studio/arrange/session.js): the clip grid seeded
// from the song's sections (a column a track, a row a scene, its ground beside it), a scene launched and heard, a clip
// launched while playing coming in on the next bar line, a scene's clips playing the notes the Arrangement writes out for
// that section (the same parts over the same ground), the Clip tab's tools changing the chosen clip (and undo), a new clip
// in an empty slot, a scene captured, a ground changed, all kept across a reload, and the views flipping (the Clip tab in
// the Session, Notes in the Arrangement).
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
await page.keyboard.press(' '); await wait(300);
check('Space stops it', await Q(() => !window.__daw.E.playing));

// the Clip tab: a clip chosen, a rhythm tool and a notes tool change it, undo puts it back, a hit tapped in
await page.click('#sessWrap .slot[data-t="1"][data-has="1"] >> nth=0'); await wait(200);
const c0 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
await page.click('#clipPane .cmod >> nth=0 >> .tools button >> text=Develop'); await wait(150);
const c1 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
await page.click('#clipPane .cmod >> nth=1 >> .tools button >> nth=1'); await wait(150);
const c2 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
await page.click('#clipPane .chead button >> text=Undo'); await page.click('#clipPane .chead button >> text=Undo'); await wait(150);
const c3 = await Q(() => { const {ST, SS} = window.__daw, T = ST.P.tracks[SS.RT.sel.t]; return JSON.stringify(ST.P.session.cells[T.id][SS.RT.sel.r]); });
check('the Clip tab\'s rhythm and notes tools change the chosen clip, and undo puts it back', c1 !== c0 && c2 !== c1 && c3 === c0, `${c0.length} → ${c1.length} → ${c2.length} → ${c3.length}`);
const h0 = await page.$$eval('#clipPane .st[data-on]', s => s.filter(x => x.dataset.on).length); await page.click('#clipPane .st:not([data-on="1"]):not([data-on="2"]) >> nth=0'); await wait(150);
const h1 = await page.$$eval('#clipPane .st[data-on]', s => s.filter(x => x.dataset.on).length);
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

// the views: the Arrangement shows the timeline and Notes, the Session the grid and the Clip tab
await page.click('#vArr'); await wait(300);
const va = await Q(() => ({sess: !document.getElementById('sessWrap').hidden, arr: !document.getElementById('arrWrap').hidden, tabs: [...document.querySelectorAll('.etabs button')].filter(b => !b.hidden).map(b => b.textContent)}));
await page.click('#vSess'); await wait(300); const vs = await Q(() => ({sess: !document.getElementById('sessWrap').hidden, clip: !document.getElementById('clipPane').hidden}));
check('the Arrangement shows the timeline and Notes, the Session the grid and the Clip tab', !va.sess && va.arr && va.tabs[0] === 'Notes' && vs.sess && vs.clip, JSON.stringify({va, vs}));
check('no page errors', !errs.length, errs.join('; '));
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
