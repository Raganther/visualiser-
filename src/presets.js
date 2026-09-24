// Settings (SPEC), movers, and the hand-made presets that Journey also reads as recipes.
import { S } from './state.js';
import { clone } from './util.js';
import { HIT_VISUALS, LAYER_VISUALS, VISUALS, WORLD_VISUALS } from './visuals/registry.js';

/* ---------- presets ---------- */
export const SPEC = [
  {g:'Motion', k:'decay', label:'Trail length', min:.8, max:.995, step:.001},
  {g:'Motion', k:'zoom', label:'Zoom', min:.94, max:1.1, step:.001},
  {g:'Motion', k:'rot', label:'Spin', min:-.05, max:.05, step:.001},
  {g:'Motion', k:'warp', label:'Warp', min:0, max:2, step:.01},
  {g:'Motion', k:'wander', label:'Centre wander', min:0, max:.5, step:.01},
  {g:'Lens', k:'sym', label:'Kaleidoscope folds', min:1, max:12, step:1},
  {g:'Lens', k:'mirror', label:'Mirror trails', min:0, max:1, step:.01},
  ...LAYER_VISUALS.filter(v => !v.optIn).map(v => ({g:'Layers', k:v.key, label:v.label, min:0, max:1, step:.01})),
  ...HIT_VISUALS.map(v => ({g:'Hits', k:v.key, label:v.label, min:0, max:1, step:.01})),
  ...WORLD_VISUALS.map(v => ({g:'Worlds', k:v.key, label:v.label, min:0, max:1, step:.01})),
  {g:'Colour', k:'colorSpeed', label:'Colour cycle', min:0, max:.5, step:.005},
  {g:'Colour', k:'hueDrift', label:'Trail hue drift', min:0, max:.06, step:.001},
  // opt-in visuals last, so the settings above keep their places (movers seed their drift by position)
  ...VISUALS.filter(v => v.optIn).map(v => ({g:'Media and objects', k:v.key, label:v.label, min:0, max:1, step:.01})),
];
/* movers: what makes a setting move by itself. amt is a fraction of the setting's full range */
export const SOURCES = [['none','Fixed'], ['drift','Slow drift'], ['bass','Follows bass'], ['mid','Follows mids'],
  ['treb','Follows treble'], ['pulse','Pulses on beat'], ['jump','Jumps on beat']];
export const BASE = [
  {name:'Tunnel', decay:.955, zoom:1.035, rot:.006, warp:.15, wander:.15, sym:1, ring:1, shock:.3, colorSpeed:.08, hueDrift:.012,
    mods:{rot:{src:'drift', amt:.4}, zoom:{src:'pulse', amt:.15}}},
  {name:'Comets', decay:.975, zoom:1.004, rot:0, warp:.2, sym:1, comets:1, shock:.5, colorSpeed:.06, hueDrift:.01,
    mods:{zoom:{src:'drift', amt:.12}, rot:{src:'drift', amt:.3}}},
  {name:'Kaleido', decay:.93, zoom:1.012, rot:-.012, warp:.35, wander:.1, sym:6, mirror:1, ring:.2, scope:.6, burst:.8, colorSpeed:.12, hueDrift:.02,
    mods:{sym:{src:'jump', amt:.35}, rot:{src:'drift', amt:.5}, hueDrift:{src:'mid', amt:.3}}},
  {name:'Ripples', decay:.94, zoom:1.0, rot:0, warp:.5, sym:1, plasma:.15, shock:1, colorSpeed:.1, hueDrift:.02,
    mods:{warp:{src:'bass', amt:.3}, hueDrift:{src:'drift', amt:.5}}},
  {name:'Melt', decay:.975, zoom:.992, rot:.003, warp:1.2, wander:.2, sym:2, mirror:.3, ring:.35, plasma:1, colorSpeed:.05, hueDrift:.008,
    mods:{warp:{src:'bass', amt:.3}, rot:{src:'drift', amt:.6}}},
  {name:'Constellation', decay:.96, zoom:1.01, rot:.01, warp:.1, wander:.15, sym:5, mirror:1, comets:1, shock:.3, colorSpeed:.07, hueDrift:.015,
    mods:{rot:{src:'drift', amt:.5}, sym:{src:'jump', amt:.25}}},
  {name:'Starburst', decay:.9, zoom:1.06, rot:.02, warp:0, sym:8, burst:1, shock:.4, star:.8, colorSpeed:.2, hueDrift:.03,
    mods:{sym:{src:'jump', amt:.3}, zoom:{src:'pulse', amt:.2}}},
  {name:'Currents', decay:.965, zoom:1.0, rot:0, warp:.3, sym:1, flow:1, ribbons:.6, colorSpeed:.04, hueDrift:.01,
    mods:{ribbons:{src:'mid', amt:.3}, rot:{src:'drift', amt:.2}}},
  {name:'Horizon', decay:.93, zoom:1.006, rot:0, warp:0, sym:1, horizon:1, comets:.6, shock:.3, colorSpeed:.05, hueDrift:.008,
    mods:{zoom:{src:'pulse', amt:.1}}},
  {name:'Sunset', decay:.94, zoom:1.0, rot:0, warp:.2, sym:1, land:1, ribbons:.35, comets:.5, colorSpeed:.02, hueDrift:.005,
    mods:{ribbons:{src:'mid', amt:.25}}},
  {name:'Orbit', decay:.95, zoom:1.002, rot:0, warp:.1, sym:1, space:1, comets:.7, flow:.3, colorSpeed:.03, hueDrift:.008,
    mods:{flow:{src:'bass', amt:.2}}},
  {name:'Scope drift', decay:.96, zoom:1.018, rot:0, warp:.6, wander:.25, sym:1, scope:1, plasma:.15, colorSpeed:.1, hueDrift:.015,
    mods:{rot:{src:'drift', amt:.5}, warp:{src:'treb', amt:.4}}},
  {name:'Northern lights', decay:.965, zoom:1.0, rot:0, warp:.4, wander:.1, sym:1, aurora:1, ribbons:.7, flow:.3, sparkle:.7, colorSpeed:.02, hueDrift:.006,
    mods:{warp:{src:'mid', amt:.2}}},
  {name:'Night drive', decay:.93, zoom:1.004, rot:0, warp:0, sym:1, city:1, horizon:1, comets:.5, outline:.8, colorSpeed:.04, hueDrift:.008,
    mods:{zoom:{src:'pulse', amt:.1}}},
  // manual-mode looks that Journey doesn't use as recipes (journey:false); with media loaded, Journey brings the tunnel in itself
  {name:'Mirror tunnel', journey:false, decay:.9, zoom:1.01, rot:.004, warp:.1, sym:1, tunnel:1, comets:.4, colorSpeed:.03, hueDrift:.006,
    mods:{rot:{src:'drift', amt:.2}}},
  {name:'Skull', journey:false, decay:.9, zoom:1.006, rot:0, warp:.15, sym:1, space:1, skull:1, ring:.6, comets:.3, colorSpeed:.03, hueDrift:.005,
    mods:{ring:{src:'bass', amt:.3}}},
  {name:'Unicorn', journey:false, decay:.9, zoom:1.004, rot:0, warp:.1, sym:1, aurora:1, unicorn:1, ribbons:.4, colorSpeed:.03, hueDrift:.005,
    mods:{ribbons:{src:'mid', amt:.3}}},
  {name:'Torus knot', journey:false, decay:.93, zoom:1.01, rot:.003, warp:.2, sym:1, knot:1, comets:.5, colorSpeed:.04, hueDrift:.008,
    mods:{rot:{src:'drift', amt:.3}}},
];
BASE.forEach(p => { for (const s of SPEC) if (p[s.k] === undefined) p[s.k] = s.k === 'sym' ? 1 : 0; p.mods = p.mods || {}; });
export const presets = BASE.map(clone);
S.active = presets[0];
export const curP = {};
SPEC.forEach(s => curP[s.k] = S.active[s.k]);
export const eff = {...curP}, modSm = {}, jumpVal = {};
let auto = true;
