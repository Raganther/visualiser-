// Every instrument and effect, listed once: the panels, the sequencer's tracks and saving are built from these descriptions.
// An instrument: {key, label, params: [{key, label, min, max, def, unit}], presets, make(ctx, out) → {play(ev, when), stop(when), set(key, v)}}.
// An effect: {key, label, params, make(ctx) → {input, output, set(key, v)}}. Adding one is one module and one line here.
export const INSTRUMENTS = [];
export const EFFECTS = [];
export const instrument = key => INSTRUMENTS.find(i => i.key === key);
export const effect = key => EFFECTS.find(e => e.key === key);
