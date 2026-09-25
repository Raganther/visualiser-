// The cosmos lab (?lab=cosmos, or the panel's switch): holds the cosmos on screen as Journey's world (Journey also picks it
// on its own now), and adds keys to fly it by hand:
//   1 orbit  2 approach  3 fly by  4 pull back  5 eclipse  6 drift  J jump to another star system
export default function({J, registry}){
  const cz = registry.byKey.cosmos;
  J.worldHold = 'cosmos';
  const SHOT = {1: 'orbit', 2: 'approach', 3: 'flyby', 4: 'reveal', 5: 'eclipse', 6: 'drift'};
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (SHOT[k]) cz.shot(SHOT[k]); else if (k === 'j') cz.jump();
  });
}
