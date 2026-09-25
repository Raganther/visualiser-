// The cosmos lab (?lab=cosmos): the camera's shots change with the bars, a section change moves on, a jump reaches another
// system, the camera never goes inside a body, and both renderers draw it with no errors.
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('cosmos: skipped for', ENTRY); process.exit(0); }   // reads the modules
const {srv, url} = await serve();
let failed = false;
const check = (ok, msg) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

for (const mode of (process.env.COSMOS_MODES ?? '2d,gl').split(',').filter(Boolean)) {   // COSMOS_MODES: which renderers (none: just the camera's logic)
  const gl = mode === 'gl', browser = await launch(mode), page = await openPage(browser, url, {width: gl ? 240 : 480, height: gl ? 135 : 270, query: '?lab=cosmos'});
  await page.waitForFunction(async () => (await import('/src/journey/core.js')).J.worldHold === 'cosmos', null, {timeout: 20000, polling: 100});
  const r = await page.evaluate(async ({gl, thumb}) => {
    const {byKey} = await import('/src/visuals/registry.js'), {J} = await import('/src/journey/core.js'), cz = byKey.cosmos;
    const shots = new Set(), systems = new Set();
    let clear = 99; const look = () => { const i = cz.info(); shots.add(i.shot); systems.add(i.system); clear = Math.min(clear, i.clear); };
    const secs = gl ? 40 : 120;
    for (let s = 0; s < secs; s++) { __step(60); look(); }
    cz.jump(); __step(60*4); look();
    return {shots: [...shots], systems: [...systems], clear, lit: eval(thumb).filter(v => v > 12).length, w: J.worldHold};
  }, {gl, thumb: THUMB});
  const errors = await page.errors();
  check(!errors.length && r.lit > 20, `${mode}: draws the cosmos (${r.lit}/576 tiles lit)${errors.length ? ' ' + errors : ''}`);
  check(r.shots.length >= (gl ? 2 : 3) && r.systems.length >= 2, `${mode}: the shots change with the music and a jump reaches another system (shots ${r.shots.join(', ')}; systems ${r.systems.join(', ')})`);
  check(r.clear >= 1.2, `${mode}: the camera never goes inside a body (nearest ${r.clear.toFixed(2)} radii)`);
  await browser.close();
}
// the track's shape, driving the camera directly (no page frames): a build draws it in, a drop lets it go, the quiet
// slows it; sections go to the arm that suits them and a returning one goes back; the same track, the same systems
{
  const browser = await launch('2d'), page = await openPage(browser, url, {noDraw: true});
  const r = await page.evaluate(async () => {
    const {C, fly} = await import('/src/visuals/worlds/cosmos/fly.js'), {V} = await import('/src/scene/camera.js');
    const J = {on: true, type: {pace: .5}, tension: .4, lastDrop: 0}, x = {J, ts: 1, react: 1, kickAgo: 0, track: 'test track'};
    const run = (secs, f) => { for (let i = 0; i < secs*60; i++) { if (f) f(i/60); fly(1/60, x); } };
    const dist = () => C.subj ? V.len(V.sub(C.cam.pos, C.subj.p))/C.subj.r : 99, out = {};
    run(20); out.first = C.sys.idx; out.noEarly = !C.building;
    run(8, t => J.tension = .4 + t/8*.5); out.building = C.building; out.near1 = dist(); out.prog1 = C.prog;
    run(14, () => J.tension = .9); out.near2 = dist(); out.prog2 = C.prog;
    J.lastDrop = 1; run(3); out.afterDrop = {building: C.building, shot: C.kind, warp: C.warpDir !== 0 || C.warp > 0 || C.sys.idx !== out.first};
    J.tension = .3; run(10); x.kickAgo = 5000; run(5); out.calm = C.calm; out.calmShot = C.kind;
    x.kickAgo = 0; run(2); out.calmAfter = C.calm;
    // sections: a calm one and an intense one land on different arms; the calm one, coming back, returns to its system
    const calmType = {pace: 0}, hotType = {pace: 1};
    J.tension = .1; J.type = calmType; run(8); const calmIdx = calmType.cosmos.idx;
    J.tension = .95; J.type = hotType; run(8); const hotIdx = hotType.cosmos.idx;
    J.tension = .1; J.type = calmType; run(8);
    out.arms = [Math.floor((calmIdx % 1000)/300), Math.floor((hotIdx % 1000)/300)]; out.back = C.sys.idx === calmIdx;
    return out;
  });
  check(r.noEarly, 'a track settling in is not a build');
  check(r.building && r.near2 < r.near1 && r.prog2 > r.prog1 && r.prog2 > .5, `a build draws the camera in (${r.near1.toFixed(1)} → ${r.near2.toFixed(1)} radii, build ${r.prog1.toFixed(2)} → ${r.prog2.toFixed(2)})`);
  check(!r.afterDrop.building && (r.afterDrop.shot === 'reveal' || r.afterDrop.warp), `the drop lets it go (${r.afterDrop.warp ? 'a jump' : r.afterDrop.shot})`);
  check(r.calm && ['drift', 'orbit'].includes(r.calmShot) && !r.calmAfter, `the quiet drifts or circles (${r.calmShot}), and the kick coming back moves on`);
  check(r.arms[0] === 0 && r.arms[1] === 2 && r.back, `a calm section goes to the cold arm, an intense one to the hot arm, and the calm one comes back to its system (arms ${r.arms.join(', ')})`);
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
