// Settings (SPEC), movers, and the hand-made presets that Journey also reads as recipes.
import { S } from './state.js';
import { clone } from './util.js';
import { SIGNALS } from './scene/signals.js';
import { HIT_VISUALS, LAYER_VISUALS, VISUALS, WORLD_VISUALS } from './visuals/registry.js';

/* ---------- presets ---------- */
export const SPEC = [
  {g:'Motion', k:'decay', label:'Trail length', min:.8, max:.995, step:.001},
  {g:'Motion', k:'zoom', label:'Zoom', min:.94, max:1.1, step:.001},
  {g:'Motion', k:'rot', label:'Spin', min:-.05, max:.05, step:.001},
  {g:'Motion', k:'warp', label:'Warp', min:0, max:2, step:.01},
  {g:'Motion', k:'wander', label:'Centre wander', min:0, max:.5, step:.01},
  {g:'Lens', k:'sym', label:'Glow folds (the trails, ghostly)', min:1, max:12, step:1},
  {g:'Lens', k:'mirror', label:'Mirror trails', min:0, max:1, step:.01},
  ...LAYER_VISUALS.filter(v => !v.optIn).map(v => ({g:'Layers', k:v.key, label:v.label, min:0, max:1, step:.01})),
  ...HIT_VISUALS.map(v => ({g:'Hits', k:v.key, label:v.label, min:0, max:1, step:.01})),
  ...WORLD_VISUALS.filter(v => !v.optIn).map(v => ({g:'Worlds', k:v.key, label:v.label, min:0, max:1, step:.01})),
  {g:'Colour', k:'colorSpeed', label:'Colour cycle', min:0, max:.5, step:.005},
  {g:'Colour', k:'hueDrift', label:'Trail hue drift', min:0, max:.06, step:.001},
  // opt-in visuals last, so the settings above keep their places (movers seed their drift by position)
  ...[...VISUALS.filter(v => v.optIn && v.kind !== 'world'), ...WORLD_VISUALS.filter(v => v.optIn)].map(v => ({g:'Media and objects', k:v.key, label:v.label, min:0, max:1, step:.01})),
  // the kaleidoscope: a mirror fold of the picture itself (the whole of it, the world only, the glow only, or inside an
  // object), round the trails' centre (the world's subject); after the others, so their places (movers' seeds) stay
  {g:'Kaleidoscope', k:'kal', label:'Mirrors (under 2: off)', min:0, max:12, step:1},
  {g:'Kaleidoscope', k:'kalWhere', label:'Folds: 0 everything, 1 the world, 2 the glow, 3 inside the object', min:0, max:3, step:1},
  {g:'Kaleidoscope', k:'kalTurn', label:'Turning', min:-.5, max:.5, step:.01},
  // the finish: film grain, scan lines and a little colour fringing, for an older, warmer look (last, so the rest keep their places)
  {g:'Finish', k:'grain', label:'Film grain and VHS', min:0, max:1, step:.01},
  // how the 3D objects are drawn (render/mesh.js); last, so the rest keep their places
  // the kaleidoscope's kind (last, so the rest keep their places): wedges meeting at a point, a mirror box (a hall of mirrors), a dive (zooming in through its folds)
  {g:'Kaleidoscope', k:'kalMode', label:'Kind: 0 wedges, 1 mirror box, 2 dive', min:0, max:2, step:1},
  {g:'Objects', k:'objStyle', label:'Object style: 0 glass wire, 1 solid, 2 outline, 3 hologram, 4 points, 5 shaded', min:0, max:5, step:1},
  // how intricate the mandalas are: few folds and plain rings, to many folds, doubled petals and ornament (last, so the rest keep their places)
  {g:'Mandala', k:'mandDetail', label:'Mandala detail: simple to intricate', min:0, max:1, step:.01, def:.5},
  // the fractal's dive twisting into a logarithmic whirlpool, spinning as it falls (last, so the rest keep their places)
  {g:'Fractal', k:'fracVortex', label:'Fractal vortex: the dive twists into a spiral (0 off, 1 on)', min:0, max:1, step:1},
  // how the lit objects (Blender models, render/lit.js) are drawn (last, so the rest keep their places)
  {g:'Objects', k:'litLook', label:'Lit objects: 0 real, 1 toon, 2 neon, 3 chrome, 4 marble', min:0, max:4, step:1},
];
/* movers: what makes a setting move by itself. amt is a fraction of the setting's full range */
export const SOURCES = [['none','Fixed'], ...SIGNALS.map(([k, l]) => [k, l])];   // every signal on the bus
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
  {name:'Orbits', decay:.97, zoom:1.0, rot:0, warp:.05, sym:1, cosmos:1, orbit:1, ring:.35, sparkle:.6, colorSpeed:.03, hueDrift:.006,
    mods:{orbit:{src:'mid', amt:.25}}},
  {name:'Lasers', decay:.9, zoom:1.008, rot:0, warp:0, sym:1, lasers:1, shock:.3, colorSpeed:.06, hueDrift:.01,
    mods:{zoom:{src:'kick', amt:.15}}},
  {name:'Moonlit sea', decay:.95, zoom:1.0, rot:0, warp:.15, sym:1, sea:1, ribbons:.4, sparkle:.5, colorSpeed:.02, hueDrift:.004,
    mods:{ribbons:{src:'bass', amt:.2}}},
  {name:'Deep water', decay:.96, zoom:1.0, rot:0, warp:.4, sym:1, deep:1, flow:.6, plasma:.15, colorSpeed:.02, hueDrift:.005, mods:{}},
  {name:'Desert night', decay:.93, zoom:1.002, rot:0, warp:.05, sym:1, dunes:1, lines:.5, colorSpeed:.015, hueDrift:.003, mods:{}},
  {name:'Fireflies', decay:.94, zoom:1.0, rot:0, warp:.2, sym:1, aurora:1, fireflies:1, colorSpeed:.015, hueDrift:.004, mods:{}},
  {name:'Stargate', decay:.9, zoom:1.01, rot:.004, warp:0, sym:1, stargate:1, glitch:.6, shock:.3, colorSpeed:.05, hueDrift:.01, mods:{}},
  {name:'Goniometer', decay:.93, zoom:1.0, rot:0, warp:.1, sym:1, vectorscope:1, ring:.3, colorSpeed:.03, hueDrift:.006, mods:{}},
  {name:'Unfolding', decay:.94, zoom:1.0, rot:0, warp:0, sym:1, unfold:1, mandala:.5, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Fractal', decay:.93, zoom:1.0, rot:.002, warp:0, sym:1, fractal:1, fireflies:.3, colorSpeed:.03, hueDrift:.006, mods:{}},
  // the engraved rosette, the times table on a circle, and a spiral galaxy over the stars
  {name:'Engraving', decay:.93, zoom:1.0, rot:.001, warp:0, sym:1, guilloche:1, fireflies:.3, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'String art', decay:.92, zoom:1.0, rot:0, warp:0, sym:1, chords:1, mandala:.4, colorSpeed:.03, hueDrift:.005, mods:{}},
  {name:'Galaxy', decay:.9, zoom:1.002, rot:.001, warp:0, sym:1, galaxy:1, space:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  // the cave flown through, with the flow's particles streaming past
  {name:'Into the Hollow', decay:.9, zoom:1.004, rot:0, warp:.05, sym:1, hollow:1, flow:.5, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'The Vessel', journey:false, decay:.9, zoom:1.004, rot:0, warp:.05, sym:1, vessel:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'The Geode', journey:false, decay:.9, zoom:1.004, rot:0, warp:.05, sym:1, geode:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'The Corridor', journey:false, decay:.88, zoom:1.006, rot:0, warp:.03, sym:1, corridor:1, colorSpeed:.03, hueDrift:.005, mods:{}},
  {name:'The Cathedral', journey:false, decay:.9, zoom:1.003, rot:0, warp:.03, sym:1, cathedral:1, fireflies:.4, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Flower of life', decay:.95, zoom:1.0, rot:.002, warp:0, sym:1, mandala:1, fireflies:.4, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Storm', decay:.9, zoom:1.004, rot:0, warp:.1, sym:1, sea:1, lightning:1, ribbons:.3, colorSpeed:.03, hueDrift:.006, mods:{}},
  {name:'Glowing wood', decay:.93, zoom:1.0, rot:0, warp:.15, sym:1, forest:1, fireflies:.7, colorSpeed:.012, hueDrift:.003, mods:{}},
  {name:'Night rain', decay:.9, zoom:1.001, rot:0, warp:.05, sym:1, rain:1, lightning:.6, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Star map', decay:.95, zoom:1.001, rot:.0005, warp:.05, sym:1, constellation:1, star:.5, colorSpeed:.01, hueDrift:.003, mods:{}},
  // the rose window: stained glass in rings, its cells lit by the kick's cascades, the stabs' wedges and the hats
  {name:'Rose window', decay:.9, zoom:1.003, rot:.001, warp:0, sym:1, rosette:1, sparkle:.4, colorSpeed:.02, hueDrift:.005, mods:{}},
  // the Lattice: a tunnel of glass facets lighting with the music, a stargate rushing down it
  {name:'The Lattice', decay:.9, zoom:1.006, rot:0, warp:0, sym:1, lattice:1, stargate:.6, colorSpeed:.03, hueDrift:.006, mods:{}},
  {name:'Pleasures', decay:.85, zoom:1.0, rot:0, warp:0, sym:1, lines:1, colorSpeed:.01, hueDrift:.002, mods:{}},
  // manual-mode looks that Journey doesn't use as recipes (journey:false); with media loaded, Journey brings the tunnel in itself
  {name:'Mirror tunnel', journey:false, decay:.9, zoom:1.01, rot:.004, warp:.1, sym:1, tunnel:1, comets:.4, colorSpeed:.03, hueDrift:.006,
    mods:{rot:{src:'drift', amt:.2}}},
  {name:'Skull', journey:false, decay:.9, zoom:1.006, rot:0, warp:.15, sym:1, space:1, skull:1, ring:.6, comets:.3, colorSpeed:.03, hueDrift:.005,
    mods:{ring:{src:'bass', amt:.3}}},
  {name:'Unicorn', journey:false, decay:.9, zoom:1.004, rot:0, warp:.1, sym:1, aurora:1, unicorn:1, ribbons:.4, colorSpeed:.03, hueDrift:.005,
    mods:{ribbons:{src:'mid', amt:.3}}},
  {name:'Manta', journey:false, decay:.92, zoom:1.002, rot:0, warp:.1, sym:1, deep:1, manta:1, fireflies:.4, colorSpeed:.02, hueDrift:.004, mods:{}},
  // the new centrepieces: the lotus over the unfolding mandala, the jellyfish in deep water, the crystals under the aurora
  {name:'Lotus', journey:false, decay:.9, zoom:1.004, rot:.001, warp:0, sym:1, unfold:.8, lotus:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Jellyfish', journey:false, decay:.92, zoom:1.002, rot:0, warp:.1, sym:1, deep:1, jelly:1, fireflies:.35, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Crystals', journey:false, decay:.9, zoom:1.003, rot:.002, warp:0, sym:1, aurora:1, crystal:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  // the prism: a faceted gem that grows facets, morphs and lights them with the music (alone, and in the Cathedral)
  {name:'Prism', journey:false, decay:.9, zoom:1.003, rot:.002, warp:0, sym:1, prism:1, fireflies:.3, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Gem orbit', journey:false, decay:.9, zoom:1.003, rot:.002, warp:0, sym:1, gems:1, constellation:.3, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Prism in the cathedral', journey:false, decay:.9, zoom:1.002, rot:0, warp:0, sym:1, cathedral:1, prism:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  // scenes (scene/graph.js): a kaleidoscope inside the skull, with the trails kept outside it; comets between the city's buildings
  {name:'Skull kaleidoscope', journey:false, decay:.92, zoom:1.006, rot:0, warp:.1, sym:1, skull:1, ring:.5, comets:.4, colorSpeed:.04, hueDrift:.006,
    mods:{ring:{src:'kick', amt:.3}},
    scene:[{world:'all'}, {trails:'main', mask:{object:'skull', keep:'outside'}}, {hits:true}, {object:'skull', fill:{layers:['plasma', 'ring', 'burst', 'scope'], fold:6}}]},
  {name:'City comets', journey:false, decay:.96, zoom:1.002, rot:0, warp:.1, sym:1, city:1, comets:1, colorSpeed:.04, hueDrift:.008,
    mods:{},
    scene:[{world:'all'}, {trails:'main'}, {world:'front'}, {hits:true}, {objects:true}]},
  // an object standing among the city's buildings; comets flying behind the buildings while the ring pulses in front
  {name:'Skull in the city', journey:false, decay:.93, zoom:1.004, rot:0, warp:.1, sym:1, city:1, skull:1, comets:.6, colorSpeed:.04, hueDrift:.008,
    mods:{},
    scene:[{world:'all'}, {trails:'main'}, {object:'skull'}, {world:'front'}, {hits:true}]},
  {name:'Behind and in front', journey:false, decay:.95, zoom:1.003, rot:0, warp:.1, sym:1, city:1, comets:1, ring:.7, colorSpeed:.04, hueDrift:.008,
    mods:{ring:{src:'kick', amt:.3}},
    scene:[{world:'all'}, {trails:'back', layers:['comets']}, {world:'front'}, {trails:'main'}, {hits:true}, {objects:true}]},
  // fills from any image: the sunset landscape only inside the skull; comets seen only through its glass; the mirror tunnel in its eyes
  {name:'Sunset in the skull', journey:false, decay:.92, zoom:1.004, rot:0, warp:.1, sym:1, land:1, skull:1, ring:.5, colorSpeed:.04, hueDrift:.008,
    mods:{ring:{src:'kick', amt:.3}},
    scene:[{trails:'main'}, {object:'skull', fill:{world:true}}, {hits:true}]},
  {name:'Comets in the glass', journey:false, decay:.95, zoom:1.004, rot:0, warp:.1, sym:1, space:1, skull:1, comets:1, ring:.5, colorSpeed:.04, hueDrift:.008,
    mods:{},
    scene:[{world:'all'}, {trails:'main'}, {object:'skull', fill:{trails:'inner', layers:['comets']}}, {hits:true}]},
  {name:'Tunnel eyes', journey:false, decay:.92, zoom:1.004, rot:0, warp:.1, sym:1, aurora:1, skull:1, ribbons:.4, colorSpeed:.04, hueDrift:.008,
    mods:{},
    scene:[{world:'all'}, {trails:'main'}, {object:'skull', fill:{layers:['tunnel'], part:7, zoom:1.5}}, {hits:true}]},
  {name:'Torus knot', journey:false, decay:.93, zoom:1.01, rot:.003, warp:.2, sym:1, knot:1, comets:.5, colorSpeed:.04, hueDrift:.008,
    mods:{rot:{src:'drift', amt:.3}}},
  // a world alone, to look at it: the cosmos with nothing over it (Solo on any slider does the same for anything)
  // the fractal's endless dive twisted into its vortex
  {name:'Vortex', journey:false, decay:.9, zoom:1, rot:0, warp:0, sym:1, fractal:1, fracVortex:1, colorSpeed:.03, hueDrift:.006, mods:{}},
  // the lit goblin alone under its moving lights (a Blender sculpt baked for real time)
  {name:'Goblin, lit', journey:false, decay:.9, zoom:1, rot:0, warp:0, sym:1, goblinLit:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Tentacle', journey:false, decay:.9, zoom:1, rot:0, warp:0, sym:1, tentacle:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Hand', journey:false, decay:.9, zoom:1, rot:0, warp:0, sym:1, hand:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Heart', journey:false, decay:.9, zoom:1, rot:0, warp:0, sym:1, heart:1, colorSpeed:.02, hueDrift:.004, mods:{}},
  {name:'Cosmos', journey:false, decay:.9, zoom:1, rot:0, warp:0, sym:1, cosmos:1, colorSpeed:.02, hueDrift:.004, mods:{}},
];
BASE.forEach(p => { for (const s of SPEC) if (p[s.k] === undefined) p[s.k] = s.def ?? (s.k === 'sym' ? 1 : 0); p.mods = p.mods || {}; });   // (a setting can carry its own default)
export const presets = BASE.map(clone);
// the looks the user liked (👍, ui/taste.js), each as a preset: every setting, its movers, its scene. Journey reads them as
// recipes too, favoured (TUNE.liked), so what the user likes comes back when the music suits it
export const LIKED = [];
S.active = presets[0];
export const curP = {};
SPEC.forEach(s => curP[s.k] = S.active[s.k]);
export const eff = {...curP}, modSm = {}, jumpVal = {};
let auto = true;
