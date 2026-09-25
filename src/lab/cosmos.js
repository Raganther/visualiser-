// The cosmos lab (?lab=cosmos, or the panel's switch): holds the cosmos on screen as Journey's world (Journey also picks it
// on its own), and adds keys to fly it by hand:
//   1 orbit  2 approach  3 fly by  4 pull back  5 eclipse  6 drift  7 through the belt  J jump to another star system
//   8 to a black hole  9 to a pulsar  0 to twin stars  S skim a surface  G out to the galaxy and into another system
export default function({J, TUNE, registry}){
  const cz = registry.byKey.cosmos;
  J.worldHold = 'cosmos';
  const SHOT = {1: 'orbit', 2: 'approach', 3: 'flyby', 4: 'reveal', 5: 'eclipse', 6: 'drift', 7: 'belt', s: 'skim'}, VISIT = {8: 'hole', 9: 'pulsar', 0: 'binary'};
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (SHOT[k]) cz.shot(SHOT[k]);   // (a shot by hand holds the camera a while)
    else if (VISIT[k] || k === 'j' || k === 'g') { if (VISIT[k]) cz.visit(VISIT[k]); else if (k === 'j') cz.jump(); else cz.galaxy(); cz.hold(TUNE.cosmos.handSecs); }
  });
}
