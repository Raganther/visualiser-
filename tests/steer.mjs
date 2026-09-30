// Steering test (journey/steer.js): over many sections a pinned layer is always the lead or the accent, a pinned world and
// object always come in, banned ones never do; hold stops new sections and progression; and while Journey runs, a group's
// number keys steer it (keep, never, free) without freezing it. Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('steer: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const browser = await launch('2d');

// the casting, over many sections with random music
{
  const page = await openPage(browser, url, {groove: false, noDraw: true});
  const r = await page.evaluate(async () => {
    const {J} = await import('/src/journey/core.js'), {chooseWorld} = await import('/src/journey/worlds.js'), st = await import('/src/journey/steer.js');
    __step(60*12);
    const run = n => { const out = []; for (let i = 0; i < n; i++) {
      for (const f in J.fS) { J.fS[f] = Math.random(); J.fMin[f] = 0; J.fMax[f] = 1; }
      J.tension = Math.random(); Object.assign(J.type, {worldBias: null, hitSeed: null, recipeSeed: {}, casts: {}});
      chooseWorld(true); J.recast = 'fresh'; __step(1);
      out.push({lead: J.lead, accent: J.accent, world: J.world, hit: J.hit, centre: J.centre, scene: J.sceneKey}); } return out; };
    st.STEER.pin.mandala = true; st.STEER.pin.sea = true; st.STEER.pin.manta = true; st.STEER.ban.lightning = true; st.STEER.ban.lasers = true;
    const a = run(150);
    st.clearSteer(Object.keys({...st.STEER.pin, ...st.STEER.ban}));
    st.STEER.ban.city = true; st.STEER.ban.cosmos = true; st.STEER.pin.ring = true; st.STEER.pin.comets = true; st.STEER.pin.between = true;
    const b = run(150);
    st.clearSteer(Object.keys({...st.STEER.pin, ...st.STEER.ban}));
    return {
      pinLayer: a.filter(s => s.lead === 'mandala' || s.accent === 'mandala').length, pinWorld: a.filter(s => s.world === 'sea').length,
      pinObj: a.filter(s => s.centre === 'manta').length, banHit: a.filter(s => s.hit === 'lightning').length, banLayer: a.filter(s => s.lead === 'lasers' || s.accent === 'lasers').length,
      banWorld: b.filter(s => s.world === 'city' || s.world === 'cosmos').length, twoPins: b.filter(s => [s.lead, s.accent].sort().join() === 'comets,ring').length,
      pinScene: b.filter(s => s.scene === 'between').length, betweenFits: b.filter(s => s.world !== 'none').length, n: a.length};
  });
  check('a pinned layer is the lead or the accent in every section', r.pinLayer === r.n, `${r.pinLayer}/${r.n}`);
  check('a pinned world comes in every section', r.pinWorld === r.n, `${r.pinWorld}/${r.n}`);
  check('a pinned object is the centrepiece in every section', r.pinObj === r.n, `${r.pinObj}/${r.n}`);
  check('a banned hit and a banned layer never appear', r.banHit + r.banLayer === 0, `${r.banHit} hits, ${r.banLayer} layers`);
  check('banned worlds never come in', r.banWorld === 0, `${r.banWorld}`);
  check('two pinned layers take the lead and the accent', r.twoPins === r.n, `${r.twoPins}/${r.n}`);
  check('a pinned scene is used whenever it fits the cast', r.pinScene >= r.betweenFits*.9, `${r.pinScene} of ${r.betweenFits} sections with a world`);
  const errors = await page.errors(); check('no page errors (casting)', !errors.length, errors.join(' '));
  await page.close();
}
// holding, and the keys, on the groove
{
  const page = await openPage(browser, url, {noDraw: true});
  const r = await page.evaluate(async () => {
    const {J} = await import('/src/journey/core.js'), st = await import('/src/journey/steer.js');
    const key = k => document.body.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true}));
    __step(60*10); J.speed = 3;
    key(';'); const held = st.STEER.hold, p0 = J.progStep, s0 = J.type; __step(60*60);
    const heldSteps = J.progStep - p0, heldType = J.type === s0; key(';');
    key('l'); key('1'); const pin = !!st.STEER.pin.ring, lead = J.lead === 'ring' || J.accent === 'ring', stillOn = J.on;
    key('1'); const ban = !!st.STEER.ban.ring && J.lead !== 'ring' && J.accent !== 'ring';
    key('1'); const free = !st.STEER.pin.ring && !st.STEER.ban.ring;
    key('w'); key('6'); const world = J.world === 'sea'; key('0'); const cleared = !st.STEER.pin.sea;
    // the kaleidoscope: K 5 keeps a five-way one (through new sections), G folds the glow, 0 bans it, 0 again frees it
    key('escape'); key('k'); key('5'); J.recast = 'fresh'; __step(60*3);
    const kal = J.on && J.kal && J.kal.n === 5 && Math.round(window.__jdbg().kal) === 5; key('g'); const kalG = J.kal && J.kal.where === 2;
    key('0'); J.recast = 'fresh'; __step(2); const kalBan = !J.kal && !!st.STEER.ban.kal; key('0'); const kalFree = !st.STEER.ban.kal && !st.STEER.pin.kal;
    return {held, heldSteps, heldType, pin, lead, stillOn, ban, free, world, cleared, kal, kalG, kalBan, kalFree, line: document.querySelector('#jSteer').textContent};
  });
  check('; holds: no progression and no new section for a minute', r.held && r.heldSteps === 0 && r.heldType, `${r.heldSteps} steps`);
  check('L 1 while Journey runs keeps the ring (it leads), without freezing Journey', r.pin && r.lead && r.stillOn);
  check('again: never (it leaves its role), and again: free', r.ban && r.free);
  check('W 6 pins the night sea (it comes in), and 0 clears the group', r.world && r.cleared);
  check('K 5 keeps a five-way kaleidoscope through a new section (Journey still on), G folds the glow', r.kal && r.kalG);
  check('K 0 bans the kaleidoscope, and 0 again frees it', r.kalBan && r.kalFree);
  const errors = await page.errors(); check('no page errors (keys)', !errors.length, errors.join(' '));
}
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
