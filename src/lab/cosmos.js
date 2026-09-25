// The cosmos lab (?lab=cosmos): space as a 3D place a camera explores (visuals/worlds/cosmos.js). Journey holds the cosmos
// on screen as its world and the music picks the shots; keys fly it by hand:
//   1 orbit  2 approach  3 fly by  4 pull back  5 eclipse  6 drift  J jump to another star system
// A caption at the bottom left says what the camera is doing.
export default function({J, registry}){
  const cz = registry.byKey.cosmos;
  J.worldHold = 'cosmos';
  const SHOT = {1: 'orbit', 2: 'approach', 3: 'flyby', 4: 'reveal', 5: 'eclipse', 6: 'drift'};
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (SHOT[k]) cz.shot(SHOT[k]); else if (k === 'j') cz.jump();
  });
  const cap = document.createElement('div'); cap.id = 'cosmosCap';
  cap.style.cssText = 'position:fixed;left:16px;bottom:96px;z-index:5;pointer-events:none;font-size:15px;letter-spacing:.04em;opacity:0;transition:opacity 1.2s;text-shadow:0 0 12px #000';
  document.body.append(cap);
  let last = '', hide = 0;
  setInterval(() => {
    const c = cz.info().caption;
    if (c && c !== last) { last = c; cap.textContent = c; cap.style.opacity = .85; clearTimeout(hide); hide = setTimeout(() => cap.style.opacity = 0, 5000); }
  }, 250);
}
