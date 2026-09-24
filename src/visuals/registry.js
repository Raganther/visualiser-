// The registry: every world and hit, one module each. Everything else (settings, sliders, the shader,
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

export const WORLD_VISUALS = [land, space, aurora, city];
export const HIT_VISUALS = [star, outline, shock, sparkle];   // Journey scores hits in this order
export const VISUALS = [...WORLD_VISUALS, ...HIT_VISUALS];
export const WORLDS = WORLD_VISUALS.map(v => v.key);
export const HITS = HIT_VISUALS.map(v => v.key);
export const byKey = Object.fromEntries(VISUALS.map(v => [v.key, v]));
