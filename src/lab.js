// Experiments without editing code. Both are read from the page URL:
//   ?tune=path=value   override a number in TUNE (src/tuning.js), e.g. ?tune=hitNone=.4&tune=pace.divBar=.2
//   ?lab=name          load src/lab/name.js and call its default export with the engine's parts (several: ?lab=a,b)
// Labs can also be switched on in the Adjust panel (an input with data-lab="name"), remembered in localStorage, for hosts
// whose links can't carry a query (the published Artifact).
// The build bundles every file in src/lab/, so labs work in dist/afterglow.html too (if the host passes the URL's query on).
import { TUNE } from './tuning.js';

const q = new URLSearchParams(location.search);
let stored = (() => { try { return JSON.parse(localStorage.getItem('afterglow.labs') || '[]'); } catch (e) { return []; } })();
export const LABS = [...new Set([...q.getAll('lab').flatMap(v => v.split(',')), ...stored])].filter(Boolean);

export function applyTune(){
  for (const t of q.getAll('tune')) {
    const [path, raw] = t.split('='), keys = path.split('.'), last = keys.pop();
    const obj = keys.reduce((o, k) => o && o[k], TUNE);
    if (!obj || !(last in obj) || raw === undefined) { console.warn('tune: no such setting', path); continue; }
    obj[last] = Array.isArray(obj[last]) ? raw.split(',').map(Number) : Number(raw);
  }
}
export async function applyLabs(api){
  for (const name of LABS) {
    try { (await import(`./lab/${name}.js`)).default(api); console.info('lab:', name); }
    catch (e) { console.warn('lab: could not load', name, e); }
  }
}

// the panel's lab switches: on loads the lab now; off forgets it and reloads (labs have no way back)
export function bindLabToggles(api){
  for (const el of document.querySelectorAll('[data-lab]')) {
    const name = el.dataset.lab; el.checked = LABS.includes(name);
    el.addEventListener('change', async () => {
      const on = el.checked, list = on ? [...new Set([...stored, name])] : stored.filter(n => n !== name);
      stored = list; try { localStorage.setItem('afterglow.labs', JSON.stringify(list)); } catch (e) {}
      if (!on) { location.reload(); return; }
      if (!LABS.includes(name)) { LABS.push(name); try { (await import(`./lab/${name}.js`)).default(api); } catch (e) { console.warn('lab: could not load', name, e); } }
    });
  }
}
