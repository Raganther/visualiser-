// The terrain lab (?lab=terrain): the cosmos lab, landed straight away on a world, flying its valleys and over its peaks
// with the music (a build climbs for the view, a drop dives back into the valley). L lands again, T takes off.
import cosmosLab from './cosmos.js';
export default function(x){
  cosmosLab(x);
  const cz = x.registry.byKey.cosmos, go = () => { if (cz.info().system) { cz.land(); cz.hold(x.TUNE.cosmos.handSecs*20); } else setTimeout(go, 200); };
  setTimeout(go, 300);
}
