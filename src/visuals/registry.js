// The registry: every world, hit, layer and object, one module each. Everything else (settings, sliders, the shader,
// simple mode, Journey's choices) is built from these lists. To add a visual, write its module and list it here.
// Visual modules import only leaf modules (state.js, util.js); the engine hands them what they need.
import land from './worlds/land.js';
import space from './worlds/space.js';
import aurora from './worlds/aurora.js';
import city from './worlds/city.js';
import star from './hits/star.js';
import outline from './hits/outline.js';
import shock from './hits/shock.js';
import sparkle from './hits/sparkle.js';
import ring from './layers/ring.js';
import scope from './layers/scope.js';
import plasma from './layers/plasma.js';
import burst from './layers/burst.js';
import comets from './layers/comets.js';
import flow from './layers/flow.js';
import ribbons from './layers/ribbons.js';
import horizon from './layers/horizon.js';
import tunnel from './layers/tunnel.js';
import skull from './objects/skull.js';

export const WORLD_VISUALS = [land, space, aurora, city];
export const HIT_VISUALS = [star, outline, shock, sparkle];   // Journey scores hits in this order
export const LAYER_VISUALS = [ring, scope, plasma, burst, comets, flow, ribbons, horizon, tunnel];
export const OBJECT_VISUALS = [skull];   // 3D centrepieces, drawn crisp between the glow and the hits
export const VISUALS = [...WORLD_VISUALS, ...HIT_VISUALS, ...LAYER_VISUALS, ...OBJECT_VISUALS];
export const WORLDS = WORLD_VISUALS.map(v => v.key);
export const HITS = HIT_VISUALS.map(v => v.key);
// opt-in visuals are drawn and get a slider, but Journey leaves them out of its usual choices (the tunnel comes in with media)
export const OPT_IN = VISUALS.filter(v => v.optIn).map(v => v.key);
const POOL = LAYER_VISUALS.filter(v => !v.optIn);
export const ELEMS = POOL.map(v => v.key);
export const byKey = Object.fromEntries(VISUALS.map(v => [v.key, v]));
// features: perc steady kicks, busy lots of stabs and hits, bright treble-heavy, low bass-heavy, mid melodic middle,
// T overall intensity (centred on 0). accents fire on the bar's downbeat, on stabs, while the melody swells, or at loud phrases.
// what Journey knows about each layer: the music it suits, how it sits over a world, how it fires as an accent, its name
export const SUITS = Object.fromEntries(POOL.map(v => [v.key, v.suits]));
export const OVER_WORLD = Object.fromEntries(POOL.filter(v => v.overWorld !== undefined).map(v => [v.key, v.overWorld]));
export const ACCENT = Object.fromEntries(POOL.map(v => [v.key, v.accent]));
export const ALT_TRIG = Object.fromEntries(POOL.filter(v => v.altAccent).map(v => [v.key, v.altAccent]));
export const NAMES = Object.fromEntries(LAYER_VISUALS.map(v => [v.key, v.label]));
