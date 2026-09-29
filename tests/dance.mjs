// Dance test (scene/dance.js): the choreographer changes each dancer's move over the bars, a breakdown stills them, the
// comets trace the shape they're given, a layer's dance moves its picture and an object's lift moves one part, in both
// renderers, with no page errors. Runs on index.html (reads the modules).
import { serve, launch, openPage, ENTRY, THUMB } from './lib.mjs';

if (!ENTRY.endsWith('index.html')) { console.log('dance: skipped for', ENTRY); process.exit(0); }
const {srv, url} = await serve();
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)/a.length;

// the choreographer's choices, driven directly (no drawing)
{
  const browser = await launch('2d'), page = await openPage(browser, url, {noDraw: true});
  const r = await page.evaluate(async () => {
    const d = await import('/src/scene/dance.js'), {J} = await import('/src/journey/core.js'), {L} = await import('/src/audio/listen.js');
    const {TUNE} = await import('/src/tuning.js'), fx = await import('/src/fx/effects.js');
    const step = (n, keys, objs) => { for (let i = 0; i < n; i++) d.stepDance(1/60, {J}, keys, objs, {skull: {moves: {bang: 2}, sym: 4, liftPart: 1}}); };
    const moves = {layer: new Set(), obj: new Set()}, poses = [];
    step(1, ['ring', 'comets'], ['skull']);
    for (let bar = 0; bar < 40; bar++) {
      J.tension = bar < 20 ? .3 : .85;
      for (let pos = 0; pos < 4; pos++) { d.danceBeat(pos, J); step(30, ['ring', 'comets'], ['skull']); }
      moves.layer.add(JSON.stringify(d.DANCE.layer.ring)); poses.push(d.DANCE.obj.skull);
    }
    // a breakdown stills them: over many bars in one, the layer barely moves
    L.brk = true; J.tension = .1; const still = [];
    for (let bar = 0; bar < 24; bar++) { for (let pos = 0; pos < 4; pos++) { d.danceBeat(pos, J); step(30, ['ring'], []); } const p = d.DANCE.layer.ring; still.push(Math.abs(p.rot) + Math.abs(p.dx) + Math.abs(p.dy) + Math.abs(p.s - 1)); }
    L.brk = false;
    // the comets go where their shape says
    d.danceShape('lissa'); step(60, ['comets'], []); fx.stepFX(1/60, 1, 0);
    let err = 0; for (let i = 0; i < 90; i++) { step(1, ['comets'], []); fx.stepFX(1/60, 1, 0); }
    // (they follow a moment behind, so each is compared with the nearest of the shape's recent places)
    const t0 = d.DANCE.comets.t;
    for (let i = 0; i < 3; i++) { let best = 9; for (let lag = 0; lag <= .6; lag += .01) { d.DANCE.comets.t = t0 - lag; const t = d.cometTarget(i, 3, [0, 0], TUNE.dance.cometR);
      best = Math.min(best, Math.hypot(t[0] - fx.comets[i].x, t[1] - fx.comets[i].y)); } err += best; }
    d.DANCE.comets.t = t0;
    const yaw = poses.map(p => p.yaw), pitch = poses.map(p => p.pitch);
    return {distinct: moves.layer.size, spread: Math.max(...yaw) - Math.min(...yaw) + Math.max(...pitch) - Math.min(...pitch),
      stillMost: still.filter(x => x < .05).length/still.length, cometErr: err/3};
  });
  check('a layer changes how it dances over the bars', r.distinct >= 5, `${r.distinct} different poses at 40 downbeats`);
  check('an object moves (turns and nods) as it dances', r.spread > .2, `range ${r.spread.toFixed(2)} rad`);
  check('a breakdown mostly stills the dancers', r.stillMost >= .6, `${Math.round(r.stillMost*100)}% of bars nearly still`);
  check('the comets trace the shape they are given', r.cometErr < .03, `${r.cometErr.toFixed(3)} from their places on it`);
  const errors = await page.errors(); check('no page errors (logic)', !errors.length, errors.join(' '));
  await browser.close();
}
// in both renderers: a layer's dance moves its picture, and an object's lift moves a part
for (const mode of ['2d', 'gl']) {
  const browser = await launch(mode), page = await openPage(browser, url, {groove: true, width: 320, height: 180});
  const r = await page.evaluate(`(async () => {
    const d = await import('/src/scene/dance.js'), {TUNE} = await import('/src/tuning.js'), {solo} = await import('/src/ui/presets.js');
    const frames = ${mode === 'gl' ? 30 : 60};
    solo('ring'); TUNE.dance.barsPerMove = 999; __step(frames);
    d.danceMove('ring', 'still'); __step(frames); const a = ${THUMB};
    d.danceMove('ring', 'orbit'); TUNE.dance.layer.orbit = .3; __step(frames); const b = ${THUMB};
    solo('skull'); __step(frames);
    d.danceMove('o:skull', 'still'); __step(frames); const s0 = ${THUMB};
    d.danceMove('o:skull', 'lift'); __step(frames); const s1 = ${THUMB};
    return {layer: [a, b], obj: [s0, s1]};
  })()`);
  check(`${mode}: a layer's dance moves its picture`, diff(...r.layer) > .5, `change ${diff(...r.layer).toFixed(1)}`);
  check(`${mode}: an object's lift moves a part`, diff(...r.obj) > .3, `change ${diff(...r.obj).toFixed(1)}`);
  const errors = await page.errors(); check(`${mode}: no page errors`, !errors.length, errors.join(' '));
  await browser.close();
}
srv.close();
process.exit(failed ? 1 : 0);
