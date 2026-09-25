// A quiet caption at the bottom left saying what a world's camera is doing ("Approaching a ringed gas giant"): it fades in
// when the words change and out a few seconds later.
import { $ } from '../util.js';

let last = '', hide = 0;
export function showCaption(text){
  if (!text || text === last) return;
  const el = $('#caption'); last = text; el.textContent = text; el.classList.add('show');
  clearTimeout(hide); hide = setTimeout(() => el.classList.remove('show'), 5000);
}
