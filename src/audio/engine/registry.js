// Every instrument and effect, listed once: the panels, the mixer's slots and saving are built from these descriptions.
// An instrument: {key, label, params: [{key, label, min, max, def, unit}], presets, make(ctx, out) → {play(ev, when), stop(when), set(key, v)}}.
// An effect: {key, label, words, params: [{key, label, min, max, def, unit, log?, list?}], make(ctx, env) → {input, output,
// set(key, v), tick?(now), dispose?()}}; env gives it the beat's length (period), the master clock (clock) and the note bus
// (onNote). Adding one is one module (engine/fx/) and one line here.
import delay from './fx/delay.js';
import reverb from './fx/reverb.js';
import chorus from './fx/chorus.js';
import flanger from './fx/flanger.js';
import phaser from './fx/phaser.js';
import drive from './fx/drive.js';
import crush from './fx/crush.js';
import filter from './fx/filter.js';
import eq from './fx/eq.js';
import comp from './fx/comp.js';
import pump from './fx/pump.js';
import width from './fx/width.js';
import autopan from './fx/autopan.js';

export const INSTRUMENTS = [];
export const EFFECTS = [delay, reverb, chorus, flanger, phaser, drive, crush, filter, eq, comp, pump, width, autopan];
export const instrument = key => INSTRUMENTS.find(i => i.key === key);
export const effect = key => EFFECTS.find(e => e.key === key);
// an effect's settings at their defaults
export const defaults = fx => Object.fromEntries(fx.params.map(p => [p.key, p.def]));
