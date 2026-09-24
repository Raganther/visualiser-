// Journey: whether a section's changes cut in on the bar or fade.
import { J, OPENING } from './core.js';
import { TUNE } from '../tuning.js';

// how this section's changes arrive: some sections cut in hard on the bar line, others fade.
// intense music, a strong change or a recent drop all push towards a cut
export function pickStyle(strength){
  const ty = J.type || OPENING;
  const recentDrop = performance.now() - J.lastDrop < TUNE.cutAfterDropMs;
  J.style = recentDrop || (ty.cut || 0)*.8 + J.tension*.7 + Math.min(1, strength || 0)*.4 > TUNE.cutThreshold ? 'cut' : 'fade';
}
