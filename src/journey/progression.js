// Journey: moving on through steady music, one step per phrase.
import { varySmall } from './cast.js';
import { J, OPENING, worldOn } from './core.js';
import { pickPace } from './pace.js';
import { recipeMods } from './recipes.js';
import { randomLens } from './sections.js';
import { updateSectionUI } from '../ui/panel.js';

/* progression: when the music stays the same, Journey still moves on, one step per phrase line,
   smallest first: a new accent or hit, then a lens or colour shift, then a new recipe and lead */
export function progress(){
  const ty = J.type || OPENING, step = J.progStep % 3;
  J.progStep++; J.progBeats = 0; J.progT = 0;
  if (step === 0) varySmall();
  else if (step === 1) {
    ty.hue = (ty.hue + (Math.random() < .5 ? 1 : -1)*(.12 + Math.random()*.18) + 1) % 1;   // colour family drifts
    ty.pace = pickPace();                                                                   // and the pace changes
    if (J.lens && J.lens.n > 2) J.lensShift = [-1, 1, 2][Math.floor(Math.random()*3)];
    else if (!J.lens && !(worldOn()) && Math.random() < .4) { J.lens = randomLens() || {n:2, mirror:1}; recipeMods(); }
  }
  else J.recast = 'fresh';
  updateSectionUI();
}
